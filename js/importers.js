/* ============ Universal importer ============
 * Supports: .json .jsonl .csv .tsv .txt .tab .md .yaml .yml .xml .html .htm .xhtml .rtf
 *           .xlsx .xlsm .xlsb .xls .ods .numbers(*) .docx .odt .pptx .pdf
 *           .apkg .colpkg .anki2 .anki21 .zip (any of the above inside)
 *           any other extension -> content sniffing, then treated as text
 */
(function () {
  const HEADER_RULES = [
    // columns of our own «CSV (все поля)» export that have no simple field: skipped instead of landing in a wrong column
    ['ignore', /^(формы слова|синонимы|примеры по формам|forms|synonyms|examples by form)$/i],
    ['exampleRu', /(пример|example|eksempel|setning|sentence).*(рус|ru|перев|transl|oversett)|(перевод|translation|oversettelse)\s+(пример|example|eksempel)|^(example_?ru|eksempel_?ru)$/i],
    ['example', /^(пример|примеры|example|examples|eksempel|setning|sentence|usage|контекст)s?$|^example_?no$/i],
    ['no', /^(no|nb|nn|nor|norsk|norwegian|bokmål|bokmal|норв.*|front|term|word|question|ord|q|вопрос|лицевая|слово|термин|лицо|forside|spørsmål|norsk ord)$/i],
    ['ru', /^(ru|rus|russian|russisk|рус.*|back|definition|answer|translation|перевод|ответ|обратная|значение|a|meaning|baksida|bakside|svar|oversettelse|betydning)$/i],
    ['description', /(desc|описан|note|notes|comment|коммент|примеч|заметк|info|грамм|grammar|extra|beskrivelse|forklaring|merknad|bøyning|формы|hint|подсказ)/i],
    ['wordClass', /(word ?class|part of speech|pos|часть речи|ordklasse|тип)/i],
    ['tags', /^(tags?|теги|тег|метки|метка|emneord|stikkord|category|категория)$/i],
    ['image', /(image|img|picture|photo|bilde|картинк|изображ|фото)/i],
    ['en', /^(en|eng|english|англ.*|engelsk)$/i],
  ];
  const FIELD_LABELS = {
    ignore: '— пропустить —', no: '🇳🇴 Норвежский', ru: '🇷🇺 Русский', description: '📝 Описание', example: '💬 Пример (NO)',
    exampleRu: '💬 Пример (RU)', wordClass: 'Часть речи', tags: '🏷 Теги', image: '🖼 Картинка', en: 'English',
  };
  const DELIMS = [
    ['\t', 'Табуляция'], [';', 'Точка с запятой ;'], ['|', 'Черта |'], [' — ', 'Тире —'], [' – ', 'Тире –'], [' - ', 'Дефис -'],
    [' = ', 'Равно ='], ['=', 'Равно = (без пробелов)'], [' → ', 'Стрелка →'], [' -> ', 'Стрелка ->'], ['—', 'Тире — (без пробелов)'],
    [':', 'Двоеточие :'], [',', 'Запятая ,'],
  ];

  /* ---------- CSV parser (RFC 4180, multiline, quotes) ---------- */
  function parseCSV(text, delim) {
    const rows = []; let row = []; let field = ''; let i = 0; let inQ = false; const n = text.length;
    const dl = delim.length;
    while (i < n) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"' && field.trim() === '') { inQ = true; field = ''; i++; continue; }
      if (text.substr(i, dl) === delim) { row.push(field); field = ''; i += dl; continue; }
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      field += ch; i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function detectDelimiter(lines) {
    const sample = lines.slice(0, 300);
    if (!sample.length) return null;
    for (const [d] of DELIMS) {
      if (d === ',') continue;
      const hit = sample.filter(l => l.includes(d)).length / sample.length;
      if (hit >= 0.6) return d;
    }
    // comma: require consistent count (CSV) — translations themselves often contain commas
    const counts = sample.map(l => (l.match(/,/g) || []).length);
    const withComma = counts.filter(c => c > 0).length / sample.length;
    if (withComma >= 0.6) return ',';
    return null;
  }

  /** record-level CSV check (handles quoted multi-line fields, CRLF, "" escapes) */
  function csvScore(text, d) {
    const sample = text.length > 400000 ? text.slice(0, 400000) : text;
    if (!sample.includes(d)) return null;
    const rows = parseCSV(sample, d).filter(r => r.some(c => c.trim()));
    if (!rows.length) return null;
    const counts = {};
    rows.forEach(r => { counts[r.length] = (counts[r.length] || 0) + 1; });
    const [modal, freq] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (+modal < 2) return null;
    const multiline = /(^|[,;\t])"[^"]*\n/.test(sample);
    return { d, modal: +modal, score: freq / rows.length, multiline };
  }

  const LIST_MARK = /^\s*(?:[-*•▪◦·–—]\s+|\d{1,4}[.)]\s+(?=\D)|\[\s?[x ]?\]\s+)/i;

  function parseDelimited(text, forced) {
    let lines = text.replace(/\r\n?/g, '\n').split('\n');
    let delim = forced && forced !== 'auto' ? forced : null;
    let isHtml = false; let headers = null;
    // Anki text export headers
    while (lines.length && /^#[a-z ]+:/i.test(lines[0])) {
      const m = lines.shift().match(/^#([a-z ]+):(.*)$/i);
      const key = m[1].trim().toLowerCase(), val = m[2].trim();
      if (key === 'separator' && !delim) delim = ({ tab: '\t', comma: ',', semicolon: ';', pipe: '|', space: ' ', colon: ':' })[val.toLowerCase()] || val;
      if (key === 'html') isHtml = /true/i.test(val);
      if (key === 'columns') headers = val;
    }
    const nonEmpty = lines.filter(l => l.trim() && !/^\s*(#|\/\/)/.test(l));
    // markdown table
    if (!delim && nonEmpty.length && nonEmpty.filter(l => /^\s*\|.*\|\s*$/.test(l)).length / nonEmpty.length > 0.6) {
      const rows = nonEmpty.filter(l => /^\s*\|/.test(l) && !/^\s*\|?\s*:?-{2,}/.test(l))
        .map(l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()));
      return { rows, delimiter: '|' };
    }
    const joined = lines.join('\n');
    let csvInfo = null;
    if (!delim) {
      // 1) real CSV/TSV structure (quoted multi-line fields are typical for flashcard app exports)
      const cands = ['\t', ';', ','].map(d => csvScore(joined, d)).filter(Boolean);
      const quoted = /(^|,)"[^"\n]*,/m.test(joined.slice(0, 200000));
      const strong = cands.filter(c => c.score >= 0.85 && (c.d !== ',' || c.multiline || (quoted && c.score >= 0.95)));
      if (strong.length) csvInfo = strong[0];
    }
    if (!delim && csvInfo) delim = csvInfo.d;
    if (!delim) delim = detectDelimiter(nonEmpty.map(l => l.replace(LIST_MARK, '')));
    let rows;
    const lineBased = !(delim === '\t' || delim === ',' || delim === ';');
    if (delim === 'pairs' || !delim) {
      rows = pairRows(lines);
      delim = delim || (rows.length && rows[0].length > 1 ? 'pairs' : null);
    } else if (!lineBased) {
      rows = parseCSV(joined, delim);
      // "word,перевод, синоним" without quotes: glue extra columns back into the last one
      const info = csvInfo || csvScore(joined, delim);
      if (info && info.modal === 2 && delim === ',') rows = rows.map(r => r.length > 2 ? [r[0], r.slice(1).join(',')] : r);
    } else {
      rows = nonEmpty.map(l => l.split(delim));
    }
    rows = rows.map(r => r.map((c, i) => {
      let v = isHtml ? U.stripHtml(c) : String(c);
      if (i === 0 && lineBased) v = v.replace(LIST_MARK, '');
      return v.replace(/^[ \t]+|[ \t]+$/g, '').replace(/^\n+|\n+$/g, '');
    })).filter(r => r.some(c => c.trim()));
    if (headers) {
      const h = headers.split(delim === 'pairs' || !delim ? '\t' : delim).map(s => s.trim());
      return { rows, headers: h, delimiter: delim };
    }
    return { rows, delimiter: delim };
  }

  /** no delimiter: blocks separated by blank lines, or alternating NO / RU lines */
  function pairRows(lines) {
    const blocks = []; let cur = [];
    lines.forEach(l => {
      if (!l.trim()) { if (cur.length) blocks.push(cur); cur = []; }
      else if (!/^\s*(#|\/\/)/.test(l)) cur.push(l.trim());
    });
    if (cur.length) blocks.push(cur);
    if (blocks.length > 1 && blocks.filter(b => b.length >= 2).length / blocks.length > 0.7) return blocks;
    const flat = blocks.flat();
    if (flat.length >= 2 && flat.length % 2 === 0) {
      let alt = 0;
      for (let i = 0; i < flat.length; i += 2) {
        const a = U.cyrRatio(flat[i]), b = U.cyrRatio(flat[i + 1]);
        if (Math.abs(a - b) > 0.5) alt++;
      }
      if (alt / (flat.length / 2) > 0.7) {
        const rows = [];
        for (let i = 0; i < flat.length; i += 2) rows.push([flat[i], flat[i + 1]]);
        return rows;
      }
    }
    return flat.map(l => [l]);
  }

  /* ---------- JSON ---------- */
  function objectsToTable(arr) {
    const keys = [];
    arr.forEach(o => Object.keys(o || {}).forEach(k => { if (!keys.includes(k)) keys.push(k); }));
    const val = v => v == null ? '' : Array.isArray(v) ? v.map(val).join(', ') : typeof v === 'object' ? (v.text || v.value || v.name || JSON.stringify(v)) : String(v);
    return { headers: keys, rows: arr.map(o => keys.map(k => val(o && o[k]))) };
  }
  function parseJSONText(text) {
    let data;
    try { data = JSON.parse(text); }
    catch (e) {
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      try { data = lines.map(l => JSON.parse(l)); } catch (e2) { throw new Error('Некорректный JSON'); }
    }
    if (data && !Array.isArray(data) && Array.isArray(data.cards) && (Array.isArray(data.decks) || data.app === 'norsk-kort')) {
      return { native: data };
    }
    if (data && !Array.isArray(data)) {
      const arrKey = ['cards', 'flashcards', 'items', 'data', 'words', 'terms', 'notes', 'vocabulary', 'entries', 'list', 'rows']
        .find(k => Array.isArray(data[k]));
      if (arrKey) data = data[arrKey];
      else if (Object.values(data).every(v => typeof v === 'string')) return { rows: Object.entries(data) };
      else { const firstArr = Object.values(data).find(Array.isArray); if (firstArr) data = firstArr; else data = [data]; }
    }
    if (!data.length) throw new Error('В JSON нет записей');
    if (Array.isArray(data[0])) return { rows: data.map(r => r.map(x => x == null ? '' : String(x))) };
    if (typeof data[0] === 'string') return { rows: data.map(s => [s]) };
    return objectsToTable(data);
  }

  /* ---------- YAML (common simple shapes) ---------- */
  function parseYAML(text) {
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim() && !/^\s*#/.test(l) && l.trim() !== '---');
    const unq = s => s.trim().replace(/^["']|["']$/g, '');
    if (lines.some(l => /^\s*-\s+\w[\w\s]*:/.test(l))) {
      const objs = []; let cur = null;
      lines.forEach(l => {
        const m = l.match(/^\s*(-\s+)?([^:]+):\s*(.*)$/);
        if (!m) return;
        if (m[1]) { cur = {}; objs.push(cur); }
        if (cur) cur[m[2].trim()] = unq(m[3]);
      });
      return objectsToTable(objs);
    }
    const rows = lines.map(l => { const m = l.match(/^\s*-?\s*([^:]+):\s*(.*)$/); return m ? [unq(m[1]), unq(m[2])] : [unq(l.replace(/^\s*-\s*/, ''))]; });
    return { rows };
  }

  /* ---------- XML / HTML ---------- */
  function parseXML(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) return parseHTML(text);
    // find the most repeated element having >=2 child elements (or attributes)
    const counts = new Map();
    doc.querySelectorAll('*').forEach(el => {
      const kids = el.children.length, attrs = el.attributes.length;
      if (kids >= 2 || (kids === 0 && attrs >= 2)) counts.set(el.tagName, (counts.get(el.tagName) || 0) + 1);
    });
    const best = [...counts.entries()].filter(([, n]) => n >= 1).sort((a, b) => b[1] - a[1])[0];
    if (!best) return parseDelimited(doc.documentElement.textContent || '');
    const items = [...doc.getElementsByTagName(best[0])];
    const objs = items.map(el => {
      const o = {};
      [...el.attributes].forEach(a => { o['@' + a.name] = a.value; });
      [...el.children].forEach(ch => { const k = ch.tagName; o[k] = o[k] ? o[k] + ', ' + ch.textContent.trim() : ch.textContent.trim(); });
      return o;
    });
    const t = objectsToTable(objs);
    // drop attribute columns that look like ids/timestamps
    return t;
  }
  function parseHTML(text) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const tables = [...doc.querySelectorAll('table')].sort((a, b) => b.rows.length - a.rows.length);
    if (tables.length && tables[0].rows.length >= 1) {
      const t = tables[0];
      const rows = []; const meta = []; let headers = null;
      [...t.rows].forEach((tr, i) => {
        const cells = [...tr.cells];
        if (i === 0 && cells.every(c => c.tagName === 'TH')) { headers = cells.map(c => c.textContent.trim()); return; }
        rows.push(cells.map(c => U.stripHtml(c.innerHTML)));
        const img = tr.querySelector('img');
        meta.push({ image: img && /^(https?:|data:)/.test(img.getAttribute('src') || '') ? img.getAttribute('src') : '' });
      });
      return { headers, rows, meta };
    }
    const dts = doc.querySelectorAll('dt');
    if (dts.length) return { rows: [...dts].map(dt => { const dd = dt.nextElementSibling; return [dt.textContent.trim(), dd && dd.tagName === 'DD' ? dd.textContent.trim() : '']; }) };
    const lis = doc.querySelectorAll('li');
    if (lis.length >= 2) return parseDelimited([...lis].map(li => li.textContent.trim()).join('\n'));
    return parseDelimited(U.stripHtml(doc.body ? doc.body.innerHTML : text));
  }

  /* ---------- RTF ---------- */
  function rtfToText(rtf) {
    const cp = /\\ansicpg1251/.test(rtf) ? 'windows-1251' : 'windows-1252';
    const dec = new TextDecoder(cp);
    let s = rtf.replace(/\{\\\*[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '')
      .replace(/\{\\(fonttbl|colortbl|stylesheet|info)[\s\S]*?\}\s*\}/g, '');
    s = s.replace(/\\u(-?\d+)\??/g, (_, n) => { let c = parseInt(n, 10); if (c < 0) c += 65536; return String.fromCharCode(c); });
    s = s.replace(/(?:\\'[0-9a-f]{2})+/gi, m => dec.decode(new Uint8Array(m.split("\\'").filter(Boolean).map(h => parseInt(h, 16)))));
    s = s.replace(/\\(par|line)\b ?/g, '\n').replace(/\\tab\b ?/g, '\t').replace(/\\cell\b ?/g, '\t').replace(/\\row\b ?/g, '\n')
      .replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '').replace(/\\([\\{}])/g, '$1');
    return s;
  }

  /* ---------- Office / OpenDocument via JSZip ---------- */
  function xmlDoc(text) { return new DOMParser().parseFromString(text, 'application/xml'); }
  function byTag(root, tag) { return [...root.getElementsByTagName(tag)]; }
  async function parseDocx(zip) {
    const doc = xmlDoc(await zip.file('word/document.xml').async('string'));
    const pText = p => byTag(p, 'w:t').map(t => t.textContent).join('');
    const tblRows = [];
    byTag(doc, 'w:tbl').forEach(tbl => byTag(tbl, 'w:tr').forEach(tr => {
      tblRows.push(byTag(tr, 'w:tc').map(tc => byTag(tc, 'w:p').map(pText).join('\n').trim()));
    }));
    if (tblRows.length >= 2) return { rows: tblRows };
    const text = byTag(doc, 'w:p').map(p => {
      const parts = [];
      [...p.getElementsByTagName('*')].forEach(n => { if (n.tagName === 'w:t') parts.push(n.textContent); else if (n.tagName === 'w:tab') parts.push('\t'); });
      return parts.join('');
    }).join('\n');
    return parseDelimited(text);
  }
  async function parseOdt(zip) {
    const doc = xmlDoc(await zip.file('content.xml').async('string'));
    const rows = byTag(doc, 'table:table-row').map(tr => byTag(tr, 'table:table-cell').map(tc => tc.textContent.trim()));
    if (rows.length >= 2) return { rows };
    return parseDelimited(byTag(doc, 'text:p').concat(byTag(doc, 'text:h')).map(p => p.textContent).join('\n'));
  }
  async function parsePptx(zip) {
    const slides = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
    const lines = [];
    for (const s of slides) {
      const doc = xmlDoc(await zip.file(s).async('string'));
      byTag(doc, 'a:p').forEach(p => { const t = byTag(p, 'a:t').map(x => x.textContent).join(''); if (t.trim()) lines.push(t); });
      lines.push('');
    }
    return parseDelimited(lines.join('\n'));
  }

  async function parseSheet(buf) {
    const XLSX = await U.lib.xlsx();
    const wb = XLSX.read(buf, { type: 'array', codepage: 1251 });
    let rows = []; let headers = null;
    wb.SheetNames.forEach(name => {
      const r = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false, blankrows: false })
        .map(row => row.map(c => String(c == null ? '' : c).trim()));
      if (r.filter(x => x.some(Boolean)).length) rows = rows.concat(r);
    });
    return { rows, headers };
  }

  async function parsePdf(buf) {
    const pdfjs = await U.lib.pdf();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const lines = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const byY = new Map();
      tc.items.forEach(it => {
        if (!it.str) return;
        const y = Math.round(it.transform[5] / 2) * 2;
        if (!byY.has(y)) byY.set(y, []);
        byY.get(y).push(it);
      });
      [...byY.entries()].sort((a, b) => b[0] - a[0]).forEach(([, items]) => {
        items.sort((a, b) => a.transform[4] - b.transform[4]);
        let line = ''; let lastEnd = null;
        items.forEach(it => {
          const x = it.transform[4];
          const fs = Math.abs(it.transform[0]) || 10;
          if (lastEnd != null) {
            const gap = x - lastEnd;
            line += gap > fs * 1.5 ? '\t' : (gap > fs * 0.15 && !line.endsWith(' ') && !it.str.startsWith(' ') ? ' ' : '');
          }
          line += it.str; lastEnd = x + (it.width || 0);
        });
        lines.push(line);
      });
      lines.push('');
    }
    return parseDelimited(lines.join('\n'));
  }

  /* ---------- sniffing ---------- */
  function startsWith(bytes, arr) { return arr.every((b, i) => bytes[i] === b); }

  async function parseBuffer(name, buf, depth = 0) {
    const bytes = new Uint8Array(buf.slice ? buf.slice(0, 16) : buf);
    const ext = (name.match(/\.([^.\/\\]+)$/) || [, ''])[1].toLowerCase();

    // ZIP family
    if (startsWith(bytes, [0x50, 0x4B, 0x03, 0x04]) || ['apkg', 'colpkg', 'zip', 'docx', 'xlsx', 'xlsm', 'ods', 'odt', 'pptx', 'numbers'].includes(ext)) {
      const JSZip = await U.lib.jszip();
      const zip = await JSZip.loadAsync(buf);
      const has = n => !!zip.file(n);
      if (has('collection.anki21b') || has('collection.anki21') || has('collection.anki2')) return Object.assign(await Anki.importPackage(buf), { format: 'Anki' });
      if (has('word/document.xml')) return Object.assign(await parseDocx(zip), { format: 'Word' });
      if (has('ppt/presentation.xml')) return Object.assign(await parsePptx(zip), { format: 'PowerPoint' });
      if (has('xl/workbook.xml') || has('xl/workbook.bin') || has('Index/Document.iwa')) return Object.assign(await parseSheet(buf), { format: 'Excel' });
      if (has('content.xml')) {
        const mt = has('mimetype') ? await zip.file('mimetype').async('string') : '';
        if (/spreadsheet/.test(mt)) return Object.assign(await parseSheet(buf), { format: 'OpenDocument таблица' });
        return Object.assign(await parseOdt(zip), { format: 'OpenDocument текст' });
      }
      if (depth > 1) throw new Error('Слишком глубокая вложенность архивов');
      // generic archive: parse all supported files inside
      const entries = Object.values(zip.files).filter(f => !f.dir && !/(^|\/)(__MACOSX|\.)/.test(f.name));
      const assets = {};
      entries.forEach(f => { if (U.mimeFromName(f.name)) assets[f.name.split('/').pop()] = f; });
      let merged = null;
      for (const f of entries) {
        if (U.mimeFromName(f.name) || /\.(mp3|wav|ogg|m4a|mp4|ttf|woff2?)$/i.test(f.name)) continue;
        try {
          const r = await parseBuffer(f.name, await f.async('arraybuffer'), depth + 1);
          if (r.native) return r;
          if (!merged) merged = Object.assign({ meta: [] }, r, { meta: r.meta || r.rows.map(() => ({})) });
          else { merged.rows = merged.rows.concat(r.rows); merged.meta = merged.meta.concat(r.meta || r.rows.map(() => ({}))); }
        } catch (e) { console.warn('skip', f.name, e); }
      }
      if (!merged) throw new Error('В архиве не найдено файлов с карточками');
      merged.assets = assets;
      merged.format = 'ZIP-архив';
      return merged;
    }
    if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46]) || ext === 'pdf') return Object.assign(await parsePdf(buf), { format: 'PDF' });
    const sqliteMagic = [0x53, 0x51, 0x4C, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6F, 0x72, 0x6D, 0x61, 0x74];
    if (startsWith(bytes, sqliteMagic) || ['anki2', 'anki21', 'db', 'sqlite'].includes(ext) || startsWith(bytes, [0x28, 0xB5, 0x2F, 0xFD])) {
      return Object.assign(await Anki.importCollectionFile(buf), { format: 'Anki (коллекция)' });
    }
    if (startsWith(bytes, [0xD0, 0xCF, 0x11, 0xE0]) || ['xls', 'xlsb', 'xlw', 'wk1', 'wk3', 'wks', 'dbf', 'sylk', 'slk', 'dif', 'prn', 'fods', 'et'].includes(ext)) {
      try { return Object.assign(await parseSheet(buf), { format: 'Таблица' }); }
      catch (e) { if (ext === 'doc' || ext === 'ppt') throw new Error('Старые .doc/.ppt не поддерживаются браузером — сохраните как .docx/.pptx'); throw e; }
    }
    if (U.mimeFromName(name)) throw new Error('Это изображение, а не файл с карточками');

    // text-based
    const text = U.decodeText(buf).replace(/^﻿/, '');
    const t = text.trimStart();
    if (['json', 'jsonl', 'ndjson', 'json5'].includes(ext) || /^[\[{]/.test(t)) {
      try { return Object.assign(parseJSONText(text), { format: 'JSON' }); } catch (e) { if (ext.startsWith('json')) throw e; }
    }
    if (ext === 'rtf' || t.startsWith('{\\rtf')) return Object.assign(parseDelimited(rtfToText(text)), { format: 'RTF' });
    if (['yaml', 'yml'].includes(ext)) return Object.assign(parseYAML(text), { format: 'YAML' });
    if (['html', 'htm', 'xhtml', 'mhtml'].includes(ext) || /^<!doctype html|^<html/i.test(t)) return Object.assign(parseHTML(text), { format: 'HTML' });
    if (['xml', 'mnemosyne', 'cards', 'kvtml', 'plist', 'svg'].includes(ext) || t.startsWith('<?xml') || /^<[a-z]/i.test(t)) return Object.assign(parseXML(text), { format: 'XML' });
    if (['csv', 'tsv', 'tab', 'txt', 'text', 'md', 'markdown', 'list', 'lst', 'dat', 'srt', 'vtt', 'log', 'ini'].includes(ext) || true) {
      return Object.assign(parseDelimited(text), { format: ext ? ext.toUpperCase() : 'Текст', rawText: text });
    }
  }

  /* ---------- header detection & auto mapping ---------- */
  function headerField(h) {
    const s = String(h || '').trim();
    if (!s) return null;
    for (const [f, re] of HEADER_RULES) if (re.test(s)) return f;
    return null;
  }
  function detectHeaderRow(res) {
    if (res.headers || !res.rows.length || res.rows.length < 2) return res;
    const first = res.rows[0];
    const known = first.filter(c => headerField(c)).length;
    if (known >= Math.min(2, first.filter(Boolean).length) && first.every(c => String(c).length < 40)) {
      res.headers = first; res.rows = res.rows.slice(1);
      if (res.meta) res.meta = res.meta.slice(1);
    }
    return res;
  }

  function autoMap(res) {
    const ncol = Math.max(0, ...res.rows.slice(0, 500).map(r => r.length), (res.headers || []).length);
    const map = new Array(ncol).fill('ignore');
    const used = new Set();
    const fixed = new Set(); // columns whose header says «skip» — the content guesser must not take them
    if (res.headers) res.headers.forEach((h, i) => {
      const f = headerField(h);
      if (f === 'ignore') { fixed.add(i); return; }
      if (f && !used.has(f)) { map[i] = f; used.add(f); }
    });
    const sample = res.rows.slice(0, 200);
    const colStat = [];
    for (let i = 0; i < ncol; i++) {
      const vals = sample.map(r => String(r[i] || '').trim().split('\n')[0].slice(0, 300)).filter(Boolean);
      const cyr = vals.length ? vals.reduce((a, v) => a + U.cyrRatio(v), 0) / vals.length : 0;
      const lat = vals.length ? vals.reduce((a, v) => a + U.latRatio(v), 0) / vals.length : 0;
      const nordic = vals.filter(v => /[æøå]/i.test(v)).length;
      const len = vals.length ? vals.reduce((a, v) => a + v.length, 0) / vals.length : 0;
      const isUrl = vals.length && vals.filter(v => /^(https?:\/\/|data:image)|\.(jpe?g|png|gif|webp)$/i.test(v)).length / vals.length > 0.6;
      colStat.push({ i, cyr, lat, nordic, len, filled: vals.length, isUrl });
    }
    colStat.forEach(s => { if (s.isUrl && map[s.i] === 'ignore' && !used.has('image')) { map[s.i] = 'image'; used.add('image'); } });
    const free = () => colStat.filter(s => map[s.i] === 'ignore' && !fixed.has(s.i) && s.filled && !s.isUrl);
    // headerless "front,back" export (Quizlet, Cram, most flashcard apps): keep column order
    if (!res.headers && !used.has('no') && !used.has('ru')) {
      const textCols = free().filter(s => !/^\d+$/.test(String((sample[0] || [])[s.i] || '').trim()));
      if (textCols.length >= 2) {
        const [a, b] = textCols;
        const reversed = a.cyr > 0.6 && b.lat > 0.6 && b.cyr < 0.3;
        map[(reversed ? b : a).i] = 'no'; map[(reversed ? a : b).i] = 'ru';
        used.add('no'); used.add('ru');
      }
    }
    if (!used.has('no')) {
      const c = free().filter(s => s.lat > 0.5).sort((a, b) => (b.nordic - a.nordic) || (a.len - b.len) || (a.i - b.i))[0];
      if (c && c.len < 80) { map[c.i] = 'no'; used.add('no'); }
    }
    if (!used.has('ru')) {
      const c = free().filter(s => s.cyr > 0.5).sort((a, b) => (a.len - b.len) || (a.i - b.i))[0];
      if (c) { map[c.i] = 'ru'; used.add('ru'); }
    }
    if (!used.has('no') || !used.has('ru')) {
      const fr = free();
      if (!used.has('no') && fr[0]) { map[fr[0].i] = 'no'; used.add('no'); }
      const fr2 = free();
      if (!used.has('ru') && fr2[0]) { map[fr2[0].i] = 'ru'; used.add('ru'); }
    }
    free().sort((a, b) => a.i - b.i).forEach(s => {
      if (s.lat > 0.6 && s.len > 12 && !used.has('example')) { map[s.i] = 'example'; used.add('example'); }
      else if (s.cyr > 0.5 && used.has('example') && !used.has('exampleRu') && s.len > 12) { map[s.i] = 'exampleRu'; used.add('exampleRu'); }
      else if (!used.has('description') && s.len > 0) { map[s.i] = 'description'; used.add('description'); }
    });
    return map;
  }

  /**
   * "Забирать\n\n**Перевод слова...** examples..." -> ru = "Забирать", description = the rest (nothing is lost).
   * Only when the first line looks like a short translation.
   */
  function splitMultiline(c) {
    const v = String(c.ru || '');
    if (!v.includes('\n')) return;
    const lines = v.split('\n');
    const first = lines[0].trim();
    const rest = lines.slice(1).join('\n').replace(/^\s*\n/, '').trim();
    if (!first || !rest || first.length > 120) return;
    c.ru = first;
    c.description = c.description ? rest + '\n\n' + c.description : rest;
  }

  /** build card objects from parsed table + mapping */
  async function buildCards(res, map, opts = {}) {
    const out = [];
    for (let r = 0; r < res.rows.length; r++) {
      const row = res.rows[r];
      const c = { no: '', ru: '', description: '', example: '', exampleRu: '', wordClass: '', en: '', tags: [], image: '' };
      map.forEach((f, i) => {
        if (f === 'ignore' || row[i] == null) return;
        const v = String(row[i]).trim();
        if (!v) return;
        if (f === 'tags') c.tags = c.tags.concat(v.split(/[\s,;]+/).filter(Boolean));
        else if (f === 'image') c.image = v;
        else c[f] = c[f] ? c[f] + '\n' + v : v;
      });
      const m = (res.meta && res.meta[r]) || {};
      if (!c.image && m.image) c.image = m.image;
      if (m.tags && m.tags.length) c.tags = [...new Set(c.tags.concat(m.tags))];
      if (c.image && !/^(https?:|data:)/.test(c.image)) {
        const asset = res.assets && res.assets[c.image.split(/[\\/]/).pop()];
        if (asset) {
          try { c.image = await U.compressImage(new Blob([await asset.async('uint8array')], { type: U.mimeFromName(asset.name) }), 600); }
          catch (e) { c.image = ''; }
        } else c.image = '';
      }
      if (opts.swap) { const t = c.no; c.no = c.ru; c.ru = t; }
      if (opts.splitMultiline) splitMultiline(c);
      if (!c.no && !c.ru) continue;
      out.push(c);
    }
    return out;
  }

  const Importer = {
    FIELD_LABELS, DELIMS,
    async parse(file) {
      const buf = await U.readArrayBuffer(file);
      const res = await parseBuffer(file.name || 'file', buf);
      if (res.native) return { native: res.native, name: file.name, format: 'Norsk Kort (резервная копия)' };
      res.rows = (res.rows || []).map(r => r.map(c => String(c == null ? '' : c).trim()));
      if (!res.meta) res.meta = res.rows.map(() => ({}));
      // drop empty rows (keep meta aligned)
      const keep = res.rows.map(r => r.some(Boolean));
      res.rows = res.rows.filter((_, i) => keep[i]); res.meta = res.meta.filter((_, i) => keep[i]);
      detectHeaderRow(res);
      if (!res.rows.length) throw new Error('Не удалось найти карточки в файле');
      res.name = file.name;
      res.map = autoMap(res);
      return res;
    },
    reparseText(res, delimiter) {
      const p = parseDelimited(res.rawText, delimiter);
      const nr = Object.assign({}, res, { rows: p.rows, headers: p.headers || null, meta: p.rows.map(() => ({})) });
      detectHeaderRow(nr);
      nr.map = autoMap(nr);
      return nr;
    },
    buildCards,
    autoMap,

    /** import our own backup / deck export, preserving progress */
    importNative(data, { replace = false } = {}) {
      if (replace) return Store.replaceAll(data);
      const idMap = {};
      (data.decks || []).forEach(d => {
        const nd = Store.addDeck(d.name, d.description || '');
        // the deck's own cover comes along (not replaced by a random photo)
        Store.updateDeck(nd.id, { cover: d.cover || '', coverCredit: d.coverCredit || '', coverTried: !!d.cover || !!d.coverTried, coverAuto: !!d.coverAuto,
          ...(d.lastUsed ? { lastUsed: d.lastUsed } : {}), ...(d.pinned ? { pinned: d.pinned } : {}), ...(d.autoName === true ? { autoName: true } : {}) }); // 🕘 📌 the order of your decks comes along · 🏷 still unnamed by the user
        idMap[d.id] = nd.id;
      });
      let fallbackDeck = null;
      let n = 0;
      (data.cards || []).forEach(c => {
        let deckId = idMap[c.deckId];
        // cards without their deck: a deck named from its cards (🏷 Store.autoNameDeck below), not «Импорт 18 нояб. 2026 г.»
        if (!deckId) { fallbackDeck = fallbackDeck || Store.addDeck(Store.AUTO_DECK, '', { autoName: true }); deckId = fallbackDeck.id; }
        const copy = JSON.parse(JSON.stringify(c));
        delete copy.id;
        // backups from older versions carry no origin record — keep the card's origin visible
        if (!Array.isArray(copy.history) || !copy.history.length) copy.history = [Prov.entry('import', 'import', null, 'резервная копия / экспорт колоды Norsk Kort')];
        Store.addCard(deckId, copy); n++;
      });
      if (fallbackDeck) Store.autoNameDeck(fallbackDeck.id);
      return { decks: Object.keys(idMap).length, cards: n };
    },
  };

  window.Importer = Importer;
})();
