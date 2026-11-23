/* ============ 📖 Читалка: your own books — read, listen with two voices, tap a word for its translation ============
 * Books are loaded from the device (PDF with a text layer, EPUB, TXT, DOCX, FB2, HTML) and kept ONLY on this device
 * (IndexedDB «norsk-kort-reader»: meta and text in separate stores — the shelf never loads whole books).
 * Reading: pages (CSS columns, one or two on wide screens) or one long ribbon; size, line height, width, font,
 * app theme or sepia. Every sentence is its own unit; a bracketed translation «(Жил-был король.)» right after a
 * Norwegian sentence is a unit of its own. Read aloud: each piece in its own voice (Norwegian / Russian /
 * Ukrainian) through TTS.speak — no own speech engine; the sentence being read is highlighted and followed, and inside it
 * the word being said (🎤 «бегущая подсветка слов», karPaint — on by default, «Aa» → off).
 * Position (sentence + book page) is saved per book; on opening: «continue / start over».
 * Public: window.Reader = { open(), openBook(id), importFiles(files) }.
 */
(function () {
  const DBN = 'norsk-kort-reader';
  const PREF_KEY = 'nk-reader';
  const ACCEPT = '.pdf,.epub,.txt,.text,.md,.docx,.fb2,.html,.htm,.xhtml,application/pdf,application/epub+zip,text/plain,text/html';
  const CLOSED = { mobi: 'MOBI', azw: 'Kindle AZW', azw3: 'Kindle AZW3', kfx: 'Kindle KFX', djvu: 'DjVu', djv: 'DjVu', doc: 'Word 97–2003 (.doc)', pages: 'Apple Pages', rtf: 'RTF', odt: 'ODT' };
  const PAGE_CHARS = 1500;      // a «book page»: the same number on every screen and in both modes
  const SECTION_CHARS = 14000;  // how much text is laid out at once (big books stay light)
  const RM = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const esc = s => (window.U && U.esc ? U.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
  const uid = () => (window.U && U.uid ? U.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2, 9));
  const plural = (n, f) => (window.U && U.plural ? U.plural(n, f) : f[2]);
  const toast = (msg, type = '', ms) => { try { UI.toast(msg, type, ms); } catch (e) { /* no UI */ } };
  const S = () => { try { return (window.Store && Store.state && Store.settings) || {}; } catch (e) { return {}; } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- storage: only on this device ---------- */
  let dbp = null;
  function db() {
    if (!dbp) {
      dbp = new Promise((res, rej) => {
        if (!window.indexedDB) { rej(new Error('noidb')); return; }
        const r = indexedDB.open(DBN, 1);
        r.onupgradeneeded = () => {
          const d = r.result;
          if (!d.objectStoreNames.contains('books')) d.createObjectStore('books', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('texts')) d.createObjectStore('texts', { keyPath: 'id' });
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error || new Error('idb'));
      });
      dbp.catch(() => { dbp = null; });
    }
    return dbp;
  }
  async function tx(stores, mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(stores, mode);
      let out;
      const rq = fn(t);
      if (rq && 'onsuccess' in rq) rq.onsuccess = () => { out = rq.result; };
      t.oncomplete = () => res(out);
      t.onerror = t.onabort = () => rej(t.error || new Error('idb'));
    });
  }
  const DB = {
    list: () => tx(['books'], 'readonly', t => t.objectStore('books').getAll()),
    meta: id => tx(['books'], 'readonly', t => t.objectStore('books').get(id)),
    text: id => tx(['texts'], 'readonly', t => t.objectStore('texts').get(id)),
    putMeta: m => tx(['books'], 'readwrite', t => { t.objectStore('books').put(m); }),
    add: (m, text) => tx(['books', 'texts'], 'readwrite', t => { t.objectStore('books').put(m); t.objectStore('texts').put(text); }),
    del: id => tx(['books', 'texts'], 'readwrite', t => { t.objectStore('books').delete(id); t.objectStore('texts').delete(id); }),
  };

  /* ---------- the reader's own look & listening options (small, per device) ---------- */
  const DEF = { mode: 'page', size: 19, lh: 2, width: 2, font: 'serif', skin: 'app', hl: 'amber', hls: 'fill', kar: true, hideTr: false, read: 'both', speed: 'normal', pause: 1, repeat: 1 };
  let P = Object.assign({}, DEF);
  try { Object.assign(P, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch (e) { /* defaults */ }
  const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(P)); } catch (e) { /* full / private */ } };
  const LH = [1.35, 1.5, 1.65, 1.8, 2.0];
  const WIDTH_EM = [20, 25, 30, 35, 41, 48];
  const FONTS = {
    serif: ['С засечками', '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Charter, "Bitstream Charter", Georgia, Cambria, serif'],
    sans: ['Без засечек', 'var(--font)'],
    clear: ['Разборчивый', 'Verdana, "Trebuchet MS", "Segoe UI", Tahoma, "DejaVu Sans", sans-serif'],
  };
  const PALETTE = [['amber', 'Янтарь', '#ffc94d'], ['mint', 'Мята', '#6fe0b0'], ['sky', 'Небо', '#7cc4ff'], ['lilac', 'Сирень', '#c2a8ff'],
    ['rose', 'Роза', '#ff9fbd'], ['peach', 'Персик', '#ffb07a'], ['aqua', 'Бирюза', '#5fe3e0'], ['lime', 'Лайм', '#c6ef6a']];
  const SPEEDS = [['slow', 'Медленно'], ['calm', 'Спокойно'], ['normal', 'Обычно'], ['brisk', 'Быстрее'], ['fast', 'Быстро']];
  const PAUSES = [[0, 'Без паузы', 0], [1, 'Короткая', 350], [2, 'Средняя', 800], [3, 'Длинная', 1600], [4, 'Очень длинная', 3000]];
  const READS = [['both', 'Оба языка'], ['no', 'Только норвежский'], ['tr', 'Только перевод']];
  /** the speed levels of the whole app (TTS.SPEEDS: slow / normal / fast) with two steps in between */
  function rateNow() {
    const T = window.TTS || {}, sp = T.SPEEDS || {};
    const normal = S().ttsRate || 0.9;
    return ({ slow: sp.slow || 0.5, calm: 0.7, normal, brisk: 1.15, fast: sp.fast || 1.4 })[P.speed] || normal;
  }

  /* ---------- text: languages, sentences, bracketed translations ---------- */
  const CYR = /[Ѐ-ӿ]/;
  const cyrN = s => (String(s).match(/[Ѐ-ӿ]/g) || []).length;
  const latN = s => (String(s).match(/[A-Za-zÀ-ÖØ-öø-ɏ]/g) || []).length;
  function scriptOf(s) { const c = cyrN(s), l = latN(s); return !c && !l ? '' : c >= l ? 'cyr' : 'lat'; }
  /** Russian or Ukrainian: letters only one of them has; otherwise what the whole book mostly is */
  function cyrLang(s, bookUk) {
    if (/[ыэъёЫЭЪЁ]/.test(s)) return 'ru';
    if (/[іїєґІЇЄҐ]/.test(s)) return 'uk';
    return bookUk ? 'uk' : 'ru';
  }
  const ABBR = new Set(('f.eks bl.a osv dvs ca nr kl mr mrs dr st jf evt ev mht pga ifm iflg t.o.m f.o.m o.l m.m m.fl s ss kap tlf ref nb obs'
    + ' т.е т.д т.п т.к и.т.д и.т.п г гг ул им см стр с тыс млн млрд руб проф акад др пр ст т англ рус норв напр пер изд ред вв н.э р.х тис грн').split(' '));
  /** a paragraph → sentences (no look-behind: works in every Safari) */
  function splitSentences(text) {
    const out = [];
    let start = 0, m;
    const re = /[.!?…]+["»”’')\]]*\s+/g;
    while ((m = re.exec(text))) {
      const end = m.index + m[0].length;
      if (!/^["«„“'(\[—–-]?\s?[\p{Lu}\p{N}Ѐ-Я]/u.test(text.slice(end, end + 3))) continue;
      if (m[0].trim() === '.') {
        const last = ((text.slice(start, m.index).match(/(\S+)$/) || [, ''])[1]).replace(/^[«"„“(\[]+/, '').toLowerCase();
        if (ABBR.has(last) || /^\p{L}$/u.test(last)) continue;
      }
      const s = text.slice(start, end).trim();
      if (s) out.push(s);
      start = end;
    }
    const rest = text.slice(start).trim();
    if (rest) out.push(rest);
    return out;
  }
  /**
   * A paragraph → units. «Det var en gang en konge. (Жил-был король.)» → two units: the Norwegian sentence and its
   * bracketed translation. Brackets in the same script as the text («(se side 5)») stay inside the sentence; a short
   * gloss in the other script inside a sentence («Hun (Она) er snill») stays inline too and is read in its own voice.
   */
  function paraUnits(text) {
    const pieces = [];
    let depth = 0, buf = '', grp = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') { if (depth++ === 0) { if (buf) pieces.push({ t: 'plain', s: buf }); buf = ''; grp = ''; continue; } }
      else if (ch === ')' && depth > 0) { if (--depth === 0) { pieces.push({ t: 'br', s: grp }); grp = ''; continue; } }
      if (depth > 0) grp += ch; else buf += ch;
    }
    if (depth > 0) buf += '(' + grp;
    if (buf) pieces.push({ t: 'plain', s: buf });
    const units = [];
    const inl = [];
    let cur = '';
    const flush = () => {
      // punctuation right after a gloss («folk (люди). Neste…») belongs to the sentence before the gloss
      const lead = /^\s*([.,;:!?…»”"]+)(?=\s|$)/.exec(cur);
      if (lead && units.length) {
        for (let j = units.length - 1; j >= 0; j--) if (!units[j].tr) { units[j].text += lead[1]; break; }
        cur = cur.slice(lead[0].length);
      }
      if (!cur.trim()) { cur = ''; return; }
      splitSentences(cur.replace(/\s+/g, ' ').trim()).forEach(s => {
        const t = s.replace(/(\d+)/g, (x, n) => '(' + inl[+n] + ')');
        units.push({ text: t, tr: false });
      });
      cur = '';
    };
    pieces.forEach((p, k) => {
      if (p.t === 'plain') { cur += p.s; return; }
      const inner = p.s.replace(/\s+/g, ' ').trim();
      const ctx = scriptOf(cur.slice(-200)) || scriptOf(((pieces[k + 1] || {}).s) || '') || scriptOf(units.length ? units[units.length - 1].text : '');
      // a Russian gloss full of Norwegian word forms («ligge, lå, ligget — лежать») is still a translation
      const sc = (ctx === 'lat' && cyrN(inner) >= 6) ? 'cyr' : scriptOf(inner);
      const before = cur.trim();
      const own = sc && ctx && sc !== ctx && (inner.split(' ').length >= 2 || !before || /[.!?…:;"»”]$/.test(before));
      if (own) { flush(); units.push({ text: '(' + inner + ')', tr: true }); }
      else { inl.push(inner); cur += '' + (inl.length - 1) + ''; }
    });
    flush();
    return units;
  }
  /** words of a text: [[start, end], …] (the same word rule as TTS — 🎤 «бегущая подсветка») */
  const wordsAt = (t, at) => (window.TTS && TTS.wordsOf ? TTS.wordsOf(t).map(x => [x.s + at, x.e + at]) : []);
  /** a unit → the pieces read aloud, each with its language; w: where its words are in the unit's text */
  function segsOf(u, uk) {
    if (u.segs) return u.segs;
    const toks = [];
    const re = /\S+\s*/g;
    let m;
    while ((m = re.exec(u.text))) toks.push({ t: m[0], at: m.index });
    const segs = [];
    let pend = [];
    toks.forEach(tok => {
      const sc = scriptOf(tok.t), last = segs[segs.length - 1];
      if (!sc) { if (last) last.toks.push(tok); else pend.push(tok); return; }
      if (last && last.sc === sc) last.toks.push(tok);
      else { segs.push({ sc, toks: pend.concat(tok) }); pend = []; }
    });
    u.segs = segs.map(s => {
      const t = s.toks.map(x => x.t).join('');
      const say = t.replace(/[()[\]{}«»"“”„]/g, ' ').replace(/\s+/g, ' ').trim();
      const w = [].concat(...s.toks.map(x => wordsAt(x.t, x.at)));
      return { lang: s.sc === 'lat' ? 'no' : cyrLang(t, uk), say, w };
    }).filter(s => /[\p{L}\p{N}]/u.test(s.say));
    return u.segs;
  }
  function wantedSegs(u, uk) {
    const out = [];
    // 📄 books added before the clean-up: a page number / separator left in the text is not read («Side 6 av 40», «- 6 -»)
    if (window.PageText && u.text && u.text.length <= 24 && PageText.isJunk(u.text, false)) return out;
    segsOf(u, uk).forEach(s => {
      if (P.read === 'no' && s.lang !== 'no') return;
      if (P.read === 'tr' && s.lang === 'no') return;
      const last = out[out.length - 1];
      if (last && last.lang === s.lang) { last.say += (/[.!?,:;]$/.test(last.say) ? ' ' : ', ') + s.say; last.w = last.w.concat(s.w); }
      else out.push(Object.assign({}, s, { w: s.w.slice() }));
    });
    // 🎤 the words TTS reports are the words of «say»: the same count → each one has its place in the text
    out.forEach(s => { s.wok = s.w.length > 0 && wordsAt(s.say, 0).length === s.w.length; });
    return out;
  }

  /** blocks [[kind, text]] → units, book pages, sections */
  function buildModel(blocks, uk) {
    const units = [], bStart = [];
    let chars = 0;
    blocks.forEach(([k, t], b) => {
      bStart[b] = units.length;
      const parts = k === 'h' ? [{ text: t, tr: false }] : paraUnits(t);
      parts.forEach(x => {
        units.push({ i: units.length, b, k, text: x.text, tr: x.tr, cyr: scriptOf(x.text) === 'cyr', p: Math.floor(chars / PAGE_CHARS) + 1 });
        chars += x.text.length + 1;
      });
    });
    bStart[blocks.length] = units.length;
    const secs = [];
    let s = null, sc = 0;
    blocks.forEach(([k, t], b) => {
      if (bStart[b + 1] <= bStart[b]) return;
      if (!s || sc >= SECTION_CHARS || (k === 'h' && sc >= SECTION_CHARS * 0.35)) { s = { b0: b, b1: b, u0: bStart[b] }; secs.push(s); sc = 0; }
      s.b1 = b; sc += t.length;
    });
    secs.forEach((x, j) => { x.u1 = j + 1 < secs.length ? secs[j + 1].u0 - 1 : units.length - 1; });
    return { blocks, units, secs, bStart, pages: units.length ? units[units.length - 1].p : 1, uk: !!uk };
  }
  function secOf(M, i) {
    let lo = 0, hi = M.secs.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (M.secs[mid].u0 <= i) lo = mid; else hi = mid - 1; }
    return lo;
  }

  /* ---------- import: every format → blocks of text ---------- */
  const letters = t => (String(t || '').match(/\p{L}/gu) || []).length;
  function isHeading(t) {
    return t.length <= 72 && !/[.!?,;:…»"”)\]—–-]$/.test(t) && t.split(/\s+/).length <= 10 && /^[\p{Lu}\p{N}«"IVX§]/u.test(t);
  }
  /** tidy blocks: no empty ones, very long paragraphs cut at sentence ends (one paragraph = one reading chunk) */
  function normBlocks(blocks) {
    const out = [];
    // 📄 a paragraph that is only a page number: «- 6 -», «Side 6 av 40», «[6]» — or bare numbers running 1, 2, 3…
    const PT = window.PageText;
    const nums = PT ? blocks.map(([k, t], i) => (k === 'p' && /^\s*\d{1,4}\s*$/.test(t) ? i : -1)).filter(i => i >= 0) : [];
    const run = new Set();
    if (nums.length >= 3) {
      const v = nums.map(i => +blocks[i][1]);
      const steps = v.slice(1).filter((x, j) => x === v[j] + 1).length;
      const span = blocks.slice(nums[0], nums[nums.length - 1]).reduce((n, b) => n + String(b[1] || '').length, 0) / (nums.length - 1);
      if (steps >= (nums.length - 1) * 0.6 && span < 6000) nums.forEach((i, j) => { if (v[j - 1] === v[j] - 1 || v[j + 1] === v[j] + 1) run.add(i); });
    }
    blocks.forEach(([k, t], i) => {
      t = String(t || '').replace(/[­​﻿]/g, '').replace(/\s+/g, ' ').trim();
      if (!t || !/[\p{L}\p{N}]/u.test(t)) return;
      if (PT && (run.has(i) || PT.isJunk(t, false))) return;
      if (PT) t = PT.tidy(t);
      if (k === 'h' && t.length > 160) k = 'p';
      if (t.length <= 2600) { out.push([k, t]); return; }
      let cur = '';
      splitSentences(t).forEach(s => { if (cur && cur.length + s.length > 1600) { out.push(['p', cur]); cur = ''; } cur += (cur ? ' ' : '') + s; });
      if (cur) out.push(['p', cur]);
    });
    return out;
  }
  function textBlocks(text) {
    text = String(text || '').replace(/\r\n?/g, '\n').replace(/ /g, ' ').replace(/^﻿/, '');
    // 📄 page breaks («\f»), page numbers («- 6 -», 1-2-3 runs), separators, words cut at line ends (util.js PageText)
    if (window.PageText) { try { text = PageText.cleanText(text); } catch (e) { /* as it is */ } }
    const lines = text.split('\n');
    const blank = lines.filter(l => !l.trim()).length / Math.max(1, lines.length);
    const blocks = [];
    const add = t => {
      t = t.trim(); if (!t) return;
      const md = /^#{1,6}\s+(.+)$/.exec(t);
      if (md) { blocks.push(['h', md[1]]); return; }
      blocks.push([isHeading(t) ? 'h' : 'p', t]);
    };
    if (blank > 0.06) {
      text.split(/\n[ \t]*\n+/).forEach(par => {
        const ls = par.split('\n').map(l => l.trim()).filter(Boolean);
        if (!ls.length) return;
        if (ls.length > 1 && isHeading(ls[0]) && ls[0].length < 50 && /^[\p{Lu}«"„—–-]/u.test(ls[1])) { add(ls.shift()); }
        add(ls.reduce((a, l) => (/\p{L}-$/u.test(a) && /^\p{Ll}/u.test(l) ? a.slice(0, -1) + l : a ? a + ' ' + l : l), ''));
      });
    } else lines.forEach(add);
    return blocks;
  }
  const BLOCK = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'SECTION', 'ARTICLE', 'TD', 'TH', 'DD', 'DT',
    'FIGCAPTION', 'TR', 'UL', 'OL', 'TABLE', 'HEADER', 'FOOTER', 'ASIDE', 'MAIN', 'BODY', 'DL', 'FIGURE', 'CENTER', 'ADDRESS', 'HR', 'TBODY', 'THEAD']);
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'HEAD', 'TITLE', 'IMG', 'NAV', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'IFRAME', 'OBJECT', 'MATH', 'RT', 'RP']);
  function domBlocks(root, out) {
    if (window.PageText) PageText.stripDom(root); // EPUB / HTML page-break markers (<span epub:type="pagebreak">, .pagenum)
    let buf = '';
    const flush = k => { const t = buf.replace(/\s+/g, ' ').trim(); if (t && /[\p{L}\p{N}]/u.test(t)) out.push([k, t]); buf = ''; };
    const walk = (el, k) => {
      for (const n of el.childNodes) {
        if (n.nodeType === 3) { buf += n.nodeValue; continue; }
        if (n.nodeType !== 1) continue;
        const tag = String(n.localName || n.tagName || '').toUpperCase();
        if (SKIP.has(tag)) continue;
        if (tag === 'BR') { buf += ' '; continue; }
        if (BLOCK.has(tag)) { flush(k); const hk = /^H[1-6]$/.test(tag) ? 'h' : k; walk(n, hk); flush(hk); }
        else walk(n, k);
      }
    };
    walk(root, 'p'); flush('p');
    return out;
  }
  function parseHtml(str) {
    let d = null;
    try { d = new DOMParser().parseFromString(str, 'application/xhtml+xml'); if (d.getElementsByTagName('parsererror').length) d = null; } catch (e) { d = null; }
    if (!d) d = new DOMParser().parseFromString(str, 'text/html');
    return d;
  }
  function bodyOf(d) { return d.body || d.getElementsByTagName('body')[0] || d.documentElement; }
  async function zipOf(file) {
    if (!window.U || !U.lib || !U.lib.jszip) throw friendly('Для этого формата нужен интернет при первой загрузке — попробуйте позже');
    let JSZip;
    try { JSZip = await U.lib.jszip(); } catch (e) { throw friendly('Не получилось загрузить помощника для этого формата — проверьте интернет и попробуйте ещё раз'); }
    return JSZip.loadAsync(await file.arrayBuffer());
  }
  function friendly(msg) { const e = new Error(msg); e.friendly = true; return e; }
  async function readEpub(file) {
    const zip = await zipOf(file);
    const cf = zip.file('META-INF/container.xml');
    if (!cf) throw friendly('Файл EPUB повреждён — откройте его в другой программе и сохраните заново');
    const opfPath = (/full-path="([^"]+)"/.exec(await cf.async('text')) || [])[1];
    const of = opfPath && zip.file(opfPath);
    if (!of) throw friendly('Файл EPUB повреждён — откройте его в другой программе и сохраните заново');
    const opf = new DOMParser().parseFromString(await of.async('text'), 'application/xml');
    const base = opfPath.includes('/') ? opfPath.replace(/[^/]+$/, '') : '';
    const norm = p => { const parts = []; p.split('/').forEach(s => { if (s === '..') parts.pop(); else if (s && s !== '.') parts.push(s); }); return parts.join('/'); };
    const tag = n => [...opf.getElementsByTagNameNS('*', n)];
    const title = ((tag('title')[0] || {}).textContent || '').trim();
    const author = ((tag('creator')[0] || {}).textContent || '').trim();
    const man = {};
    tag('item').forEach(i => { man[i.getAttribute('id')] = { href: i.getAttribute('href') || '', type: i.getAttribute('media-type') || '', props: i.getAttribute('properties') || '' }; });
    const blocks = [];
    for (const ir of tag('itemref')) {
      const it = man[ir.getAttribute('idref')];
      if (!it || (it.type && !/html|xml/.test(it.type)) || /\bnav\b/.test(it.props)) continue;
      const f = zip.file(norm(base + decodeURIComponent(it.href.split('#')[0])));
      if (f) domBlocks(bodyOf(parseHtml(await f.async('text'))), blocks);
    }
    // the cover picture (EPUB 3 «cover-image», EPUB 2 <meta name="cover">)
    let cover = '';
    try {
      let it = Object.values(man).find(x => /\bcover-image\b/.test(x.props));
      if (!it) { const mc = tag('meta').find(x => x.getAttribute('name') === 'cover'); if (mc) it = man[mc.getAttribute('content')]; }
      if (it && /^image\//.test(it.type)) {
        const f = zip.file(norm(base + decodeURIComponent(it.href)));
        if (f) cover = await smallCover(new Blob([await f.async('uint8array')], { type: it.type }));
      }
    } catch (e) { /* no cover — a drawn one */ }
    return { title, author, blocks, cover };
  }
  async function smallCover(blob) {
    if (!window.U || !U.compressImage) return '';
    try { return await U.compressImage(blob, 420, 0.8); } catch (e) { return ''; }
  }
  async function readDocx(file) {
    const zip = await zipOf(file);
    const f = zip.file('word/document.xml');
    if (!f) throw friendly('В этом файле Word не нашлось текста');
    const doc = new DOMParser().parseFromString(await f.async('text'), 'application/xml');
    const blocks = [];
    [...doc.getElementsByTagName('w:p')].forEach(p => {
      let t = '';
      [...p.getElementsByTagName('*')].forEach(n => { if (n.tagName === 'w:t') t += n.textContent; else if (n.tagName === 'w:tab' || n.tagName === 'w:br') t += ' '; });
      const st = p.getElementsByTagName('w:pStyle')[0];
      const sv = st ? st.getAttribute('w:val') || '' : '';
      const head = /heading|overskrift|title|tittel|заголов|berschrift/i.test(sv) || p.getElementsByTagName('w:outlineLvl').length > 0;
      blocks.push([head ? 'h' : 'p', t]);
    });
    let title = '', author = '';
    try {
      const c = zip.file('docProps/core.xml');
      if (c) { const x = new DOMParser().parseFromString(await c.async('text'), 'application/xml'); title = ((x.getElementsByTagNameNS('*', 'title')[0] || {}).textContent || '').trim(); author = ((x.getElementsByTagNameNS('*', 'creator')[0] || {}).textContent || '').trim(); }
    } catch (e) { /* no properties */ }
    return { title, author, blocks };
  }
  async function readFb2(file) {
    const raw = window.U && U.decodeText ? U.decodeText(await file.arrayBuffer()) : await file.text();
    const d = new DOMParser().parseFromString(raw, 'application/xml');
    if (d.getElementsByTagName('parsererror').length) throw friendly('Файл FB2 повреждён — попробуйте сохранить его заново');
    const T = n => [...d.getElementsByTagName(n)];
    const title = ((T('book-title')[0] || {}).textContent || '').trim();
    const au = T('author')[0];
    const author = au ? ['first-name', 'last-name'].map(n => ((au.getElementsByTagName(n)[0] || {}).textContent || '').trim()).filter(Boolean).join(' ') : '';
    const blocks = [];
    T('body').filter(b => !/notes|comments/i.test(b.getAttribute('name') || '')).forEach(body => {
      const walk = el => {
        for (const n of el.children) {
          const tn = n.localName;
          if (tn === 'title' || tn === 'subtitle') { blocks.push(['h', n.textContent]); continue; }
          if (tn === 'p' || tn === 'v' || tn === 'text-author') { blocks.push(['p', n.textContent]); continue; }
          if (tn === 'image' || tn === 'binary') continue;
          walk(n);
        }
      };
      walk(body);
    });
    let cover = '';
    try {
      const img = (T('coverpage')[0] || { getElementsByTagName: () => [] }).getElementsByTagName('image')[0];
      const href = img && (img.getAttribute('l:href') || img.getAttribute('xlink:href') || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || '');
      const bin = href && T('binary').find(b => b.getAttribute('id') === href.replace(/^#/, ''));
      if (bin) cover = await smallCover(await (await fetch(`data:${bin.getAttribute('content-type') || 'image/jpeg'};base64,${bin.textContent.replace(/\s+/g, '')}`)).blob());
    } catch (e) { /* drawn cover */ }
    return { title, author, blocks, cover };
  }
  /** PDF text layer → lines (with their height and font size) → paragraphs */
  async function readPdf(file, busy) {
    if (!window.U || !U.lib || !U.lib.pdf) throw friendly('PDF сейчас открыть не получается — попробуйте позже');
    let pdf;
    try { pdf = await (await U.lib.pdf()).getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; }
    catch (e) { throw friendly(/password/i.test(String(e && e.name)) ? 'Этот PDF защищён паролем — откройте его без пароля и сохраните копию' : 'Не получилось открыть этот PDF (нужен интернет при первой загрузке или файл повреждён)'); }
    let title = '', author = '';
    try { const md = await pdf.getMetadata(); const i = (md && md.info) || {}; title = String(i.Title || '').trim(); author = String(i.Author || '').trim(); } catch (e) { /* none */ }
    if (/^(about:|https?:|file:|untitled|unbenannt|без имени|microsoft word)|\.\w{2,4}$/i.test(title)) title = '';
    const pages = [];
    let empty = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      if (busy) busy.set(`страница ${n} из ${pdf.numPages}`, n, pdf.numPages);
      const page = await pdf.getPage(n);
      const tc = await page.getTextContent();
      const lines = [];
      let cur = null;
      tc.items.forEach(it => {
        if (typeof it.str !== 'string') return;
        const x = it.transform[4], y = it.transform[5], h = Math.abs(it.transform[3]) || Math.abs(it.transform[0]) || 10;
        if (!it.str.trim() && !it.hasEOL) { if (cur && !/\s$/.test(cur.s)) cur.s += ' '; return; }
        if (!cur || Math.abs(y - cur.y) > Math.max(h, cur.h) * 0.5) { if (cur) lines.push(cur); cur = { y, h, s: '', xe: x }; }
        else if (cur.s && !/\s$/.test(cur.s) && !/^\s/.test(it.str) && x - cur.xe > h * 0.15) cur.s += ' ';
        cur.s += it.str; cur.xe = x + (it.width || 0); cur.h = Math.max(cur.h, h);
        if (it.hasEOL) { lines.push(cur); cur = null; }
      });
      if (cur) lines.push(cur);
      // the top / bottom margins of the page (page numbers, running headers / footers live there — util.js PageText)
      const v = page.view || [0, 0, 0, 0], H = (v[3] || 0) - (v[1] || 0);
      const band = y => (H > 50 ? (y > v[3] - H * 0.09 ? 'top' : y < v[1] + H * 0.09 ? 'bottom' : '') : '');
      const ls = lines.map(l => Object.assign(l, { s: l.s.replace(/\s+/g, ' ').trim(), band: band(l.y) })).filter(l => l.s && (window.PageText || !/^[-–—\s]*\d{1,4}[-–—\s]*$/.test(l.s)));
      pages.push(ls);
      if (n % 8 === 0) await sleep(0);
    }
    // 📄 no page numbers («6», «- 6 -», «Side 6 av 40»), running headers / footers, «. . .» separators
    if (window.PageText) { try { PageText.cleanPages(pages, { pdf: true }).forEach((ls, k) => { pages[k] = ls; }); } catch (e) { /* as they are */ } }
    pages.forEach(ls => { if (letters(ls.map(l => l.s).join(' ')) < 20) empty++; });
    if (empty > pdf.numPages * 0.6) throw friendly('В этом PDF текст нарисован картинкой (это скан). Откройте его в «📘 Мой учебник» — там текст распознаётся с картинок');
    // typical line: length, height, spacing
    const all = pages.flat();
    const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
    const mLen = med(all.map(l => l.s.length).filter(n => n > 20)) || 60;
    const mH = med(all.map(l => l.h)) || 10;
    const gaps = [];
    pages.forEach(ls => { for (let k = 1; k < ls.length; k++) { const g = ls[k - 1].y - ls[k].y; if (g > 0 && g < mH * 4) gaps.push(g); } });
    const mGap = med(gaps) || mH * 1.3;
    const blocks = [];
    let cur = '', prev = null;
    const flush = () => { if (cur.trim()) blocks.push(['p', cur]); cur = ''; };
    pages.forEach(ls => {
      ls.forEach((l, k) => {
        const big = l.h > mH * 1.25 && l.s.length < 90;
        const gap = k > 0 ? ls[k - 1].y - l.y : 0;
        const ended = prev && /[.!?…:»"”)]$/.test(prev.s);
        const newPar = !cur || big || (k > 0 && gap > mGap * 1.45) || (ended && prev.s.length < mLen * 0.8) || (ended && /^[—–-]\s/.test(l.s));
        if (big) { flush(); blocks.push(['h', l.s]); prev = l; return; }
        if (newPar) flush();
        cur = !cur ? l.s : /\p{L}-$/u.test(cur) && /^\p{Ll}/u.test(l.s) ? cur.slice(0, -1) + l.s : cur + ' ' + l.s;
        prev = l;
      });
      // a page ends: a paragraph that ended there ends; an unfinished sentence goes on onto the next page
      if (prev && /[.!?…»"”)]$/.test(prev.s) && prev.s.length < mLen * 0.8) flush();
    });
    flush();
    return { title, author, blocks };
  }
  async function readFile(file, busy) {
    const name = file.name || 'Книга';
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (CLOSED[ext]) throw friendly(`${CLOSED[ext]} браузер прочитать не может. Сохраните книгу как EPUB, PDF или TXT (например, бесплатной программой Calibre) и загрузите снова`);
    let r;
    if (ext === 'pdf' || file.type === 'application/pdf') r = await readPdf(file, busy);
    else if (ext === 'epub' || file.type === 'application/epub+zip') r = await readEpub(file);
    else if (ext === 'docx') r = await readDocx(file);
    else if (ext === 'fb2') r = await readFb2(file);
    else if (/^(html?|xhtml)$/.test(ext) || /html/.test(file.type)) {
      const raw = window.U && U.decodeText ? U.decodeText(await file.arrayBuffer()) : await file.text();
      const d = parseHtml(raw);
      const t = d.querySelector && d.querySelector('title');
      r = { title: t ? t.textContent.trim() : '', author: '', blocks: domBlocks(bodyOf(d), []) };
    } else if (/^(txt|text|md|markdown)$/.test(ext) || /^text\//.test(file.type) || !ext || ext === name.toLowerCase()) {
      const raw = window.U && U.decodeText ? U.decodeText(await file.arrayBuffer()) : await file.text();
      r = { title: '', author: '', blocks: textBlocks(raw) };
    } else throw friendly(`Файлы .${ext} читалка не открывает. Подходят: PDF, EPUB, TXT, DOCX, FB2, HTML`);
    r.blocks = normBlocks(r.blocks);
    const all = r.blocks.map(b => b[1]).join(' ');
    if (letters(all) < 20) throw friendly('В файле не нашлось текста для чтения');
    if (!r.title) r.title = name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || 'Книга';
    // languages of the book (for the voices and the cover flags)
    const c = cyrN(all), l = latN(all), ukL = (all.match(/[іїєґІЇЄҐ]/g) || []).length, ruL = (all.match(/[ыэъёЫЭЪЁ]/g) || []).length;
    r.uk = c > 0 && ukL > ruL * 1.5 && ukL > c * 0.004;
    r.langs = [l > 50 ? 'no' : '', c > 50 && !r.uk ? 'ru' : '', c > 50 && r.uk ? 'uk' : ''].filter(Boolean);
    r.chars = all.length;
    return r;
  }

  /* ---------- a sample: a short original fairy tale (Norwegian sentence + Russian translation in brackets) ---------- */
  const SAMPLE = `Den lille reven og månen

Det var en gang en liten rev som bodde i en skog langt mot nord. (Жил-был маленький лисёнок, который жил в лесу далеко на севере.) Hver kveld satt han på en stein og så på månen. (Каждый вечер он сидел на камне и смотрел на луну.)

«Hvorfor er du så langt borte?» spurte reven. («Почему ты так далеко?» — спросил лисёнок.) Månen svarte ikke, men den lyste litt sterkere. (Луна не ответила, но засветила чуть ярче.)

En dag bestemte reven seg for å gå til månen. (Однажды лисёнок решил пойти к луне.) Han gikk over fjellet og gjennom den mørke skogen. (Он перешёл через гору и прошёл сквозь тёмный лес.) Underveis møtte han en gammel ugle. (По дороге он встретил старую сову.)

«Du kan ikke gå til månen,» sa ugla, «men du kan se den i vannet.» («Ты не можешь дойти до луны, — сказала сова, — но ты можешь увидеть её в воде.») Reven gikk ned til innsjøen. (Лисёнок спустился к озеру.) Der, i det stille vannet, lå månen og smilte til ham. (Там, в тихой воде, лежала луна и улыбалась ему.)

Fra den dagen var reven aldri ensom. (С того дня лисёнок больше никогда не был одинок.) Hver kveld besøkte han månen i innsjøen, og de snakket sammen til morgenen kom. (Каждый вечер он навещал луну в озере, и они разговаривали, пока не наступало утро.)

Snipp, snapp, snute, så er eventyret ute. (Вот и сказке конец.)`;

  /* ---------- covers: the book's own picture or a drawn one ---------- */
  function hash(s) { let h = 2166136261; for (const ch of String(s || '')) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  const FLAG = { no: '🇳🇴', ru: '🇷🇺', uk: '🇺🇦' };
  function coverHtml(b) {
    if (b.cover) return `<img src="${esc(b.cover)}" alt="" loading="lazy" decoding="async">`;
    const h1 = hash(b.title) % 360, h2 = (h1 + 30 + hash(b.author || b.title + '·') % 90) % 360;
    return `<span class="rd-gen" style="--h1:${h1};--h2:${h2}"><span class="rd-gen-flags" aria-hidden="true">${(b.langs || []).map(l => FLAG[l] || '').join(' ')}</span>
      <b class="rd-gen-t">${esc(b.title)}</b>${b.author ? `<small class="rd-gen-a">${esc(b.author)}</small>` : ''}<i class="rd-gen-orn" aria-hidden="true"></i></span>`;
  }
  function ago(ts) {
    if (!ts) return 'ещё не открывали';
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const days = Math.round((d0.getTime() - new Date(ts).setHours(0, 0, 0, 0)) / 86400000);
    if (days <= 0) return 'открывали сегодня';
    if (days === 1) return 'открывали вчера';
    if (days < 30) return `открывали ${days} ${plural(days, ['день', 'дня', 'дней'])} назад`;
    const mo = Math.round(days / 30);
    return mo < 12 ? `открывали ${mo} ${plural(mo, ['месяц', 'месяца', 'месяцев'])} назад` : 'открывали больше года назад';
  }
  const ICON = {
    trash: s => (window.UI && UI.TRASH_SVG ? UI.TRASH_SVG(s) : '🗑'),
    play: '<svg class="ico" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" fill="currentColor"/></svg>',
    pause: '<svg class="ico" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor"/><rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor"/></svg>',
    prevS: '<svg class="ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.5 19.5 9 12l9.5-7.5z" fill="currentColor"/><path d="M5.5 5v14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    nextS: '<svg class="ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 19.5 15 12 5.5 4.5z" fill="currentColor"/><path d="M18.5 5v14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    print: '<svg class="ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="2"/><path d="M7 14h10v6.5H7z" fill="var(--panel, #fff)"/><circle cx="17" cy="12" r=".9" fill="currentColor" stroke="none"/></svg>',
    again: '<svg class="ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/></svg>',
    left: '<svg class="ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>',
    right: '<svg class="ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',
    phones: '<svg class="ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4.5" height="6.5" rx="1.6"/><rect x="16.5" y="14" width="4.5" height="6.5" rx="1.6"/></svg>',
    speaker: '<svg class="ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18.2 6.3a7.8 7.8 0 0 1 0 11.4"/></svg>',
    toc: '<svg class="ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>',
    more: '<svg class="ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>',
  };

  /* =====================================================================
   * 📚 Моя полка
   * ===================================================================== */
  let shelfM = null;
  async function openShelf() {
    if (shelfM && document.body.contains(shelfM.el)) { await drawShelf(); return shelfM; }
    shelfM = UI.modal({
      title: '📖 Читалка — моя полка', cls: 'wide rd-shelf-modal',
      body: '<div class="rd-shelf" data-rd-shelf><div class="rd-wait"><span class="spinner sm"></span> открываю полку…</div></div>',
      onClose: () => { shelfM = null; },
    });
    const el = shelfM.el;
    el.addEventListener('dragover', e => { if ([...((e.dataTransfer && e.dataTransfer.types) || [])].includes('Files')) { e.preventDefault(); el.classList.add('rd-drag'); } });
    el.addEventListener('dragleave', e => { if (e.target === el || !el.contains(e.relatedTarget)) el.classList.remove('rd-drag'); });
    el.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); el.classList.remove('rd-drag'); if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files); });
    el.addEventListener('click', onShelfClick);
    el.addEventListener('change', e => { if (e.target.matches('[data-rd-file]')) { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) importFiles(fs); } });
    await drawShelf();
    return shelfM;
  }
  async function drawShelf() {
    // the library window (js/bookshelf.js) and the home strip follow the shelf too
    try { document.dispatchEvent(new CustomEvent('reader-shelf')); } catch (e) { /* old browser */ }
    if (!shelfM) return;
    const box = shelfM.$('[data-rd-shelf]');
    if (!box) return;
    let list = [];
    let failed = false;
    try { list = (await DB.list()) || []; } catch (e) { failed = true; }
    list.sort((a, b) => {
      // books added together («Добавить всю книгу») and not opened yet keep the book's own order: chapter 1, 2, 3…
      if (!a.opened && !b.opened && Math.abs((a.added || 0) - (b.added || 0)) < 120000)
        return String(a.title || '').localeCompare(String(b.title || ''), 'nb', { numeric: true });
      return (b.opened || b.added || 0) - (a.opened || a.added || 0);
    });
    box.innerHTML = `
      <div class="rd-intro"><span aria-hidden="true">📖</span><span>Загрузите свои книги — норвежские, двуязычные, сказки с переводом в скобках. Читайте страницами или лентой, слушайте двумя голосами: норвежский текст — норвежским, перевод — русским или украинским.
        <b>Книги хранятся только на этом устройстве</b> и никуда не отправляются.</span></div>
      ${failed ? '<div class="rd-note">Этот браузер сейчас не даёт сохранять книги (например, в приватном режиме). Книгу можно открыть и читать, но после закрытия её придётся загрузить снова.</div>' : ''}
      <label class="rd-drop" tabindex="0" role="button" aria-label="Добавить книгу с устройства">
        <input type="file" multiple accept="${ACCEPT}" hidden data-rd-file>
        <span class="rd-drop-ico" aria-hidden="true">📥</span>
        <b>Добавить книгу</b>
        <span class="rd-drop-sub">Выберите файл или перетащите его сюда · PDF · EPUB · TXT · DOCX · FB2 · HTML</span>
      </label>
      ${mineAvailable() ? '<section class="rd-mine" data-rd-mine aria-label="Мои учебники"><div class="rd-wait"><span class="spinner sm"></span> ищу ваши учебники…</div></section>' : ''}
      ${list.length ? `<div class="rd-grid">${list.map(bookCard).join('')}</div>` : `<div class="rd-empty"><span aria-hidden="true">📚</span><b>Полка пока пустая</b><span>Добавьте свою книгу — или попробуйте на примере короткой сказки.</span></div>`}
      <div class="rd-shelf-foot">
        <button class="btn ghost rd-sample" data-rd="sample">✨ Добавить пример: сказка «Лисёнок и луна» (норвежский + русский)</button>
        <span class="rd-tiny">Сканы без текста (картинки страниц) лучше открывать в «📘 Мой учебник» — там текст распознаётся.</span>
      </div>`;
    if (mineAvailable()) drawMine(list);
  }

  /* ---------- 📘 «Мои учебники»: chapter texts of the owner's own course books (private/reader/, this Mac only) ----------
   * private/reader/index.json → { books: [{ id, title, author?, level?, note?, dir?, files: [{ file, title, id? }] }] } (see its "_format").
   * A chapter added from here is an ordinary shelf book with meta.srcId = «mine:<book id>:<file id>», so the status
   * («добавлено / не добавлено») follows the shelf itself: a chapter the owner deleted shows as «не добавлено» again. */
  const MINE_DIR = 'private/reader/';
  const mineAvailable = () => {
    try { if (window.MyCourse && typeof MyCourse.available === 'function') return !!MyCourse.available(); } catch (e) { /* below */ }
    try { return ['localhost', '127.0.0.1'].includes(String(location.hostname || '')); } catch (e) { return false; }
  };
  const mineOpen = new Set();
  let mineSeen = false, mineBusy = false;
  const cleanId = s => String(s == null ? '' : s).trim().slice(0, 120);
  const minePath = (B, F) => MINE_DIR + [B.dir, F.file].filter(Boolean).join('/').split('/').filter(p => p && p !== '..' && p !== '.').map(encodeURIComponent).join('/');
  const mineSrc = (B, F) => `mine:${B.id}:${F.id}`;
  const baseName = f => String(f || '').split('/').pop().replace(/\.[^.]+$/, '').trim();
  async function mineIndex() {
    let r;
    try { r = await fetch(MINE_DIR + 'index.json', { cache: 'no-store', credentials: 'same-origin' }); } catch (e) { return { error: 'none' }; }
    if (!r || !r.ok) return { error: 'none' };
    let j;
    try { j = await r.json(); } catch (e) { return { error: 'broken' }; }
    const books = (j && Array.isArray(j.books) ? j.books : []).map((b, i) => {
      if (!b || typeof b !== 'object' || !Array.isArray(b.files)) return null;
      const id = cleanId(b.id) || `book${i + 1}`;
      const files = b.files.map((f, k) => {
        if (typeof f === 'string') f = { file: f };
        if (!f || typeof f !== 'object' || !f.file) return null;
        const file = String(f.file);
        return { file, id: cleanId(f.id) || file, title: String(f.title || baseName(file) || `Часть ${k + 1}`).slice(0, 160) };
      }).filter(Boolean);
      if (!files.length) return null;
      return { id, title: String(b.title || 'Учебник').slice(0, 160), author: String(b.author || '').slice(0, 120), level: String(b.level || '').slice(0, 40),
        note: String(b.note || '').slice(0, 300), dir: String(b.dir || '').replace(/^\/+|\/+$/g, ''), files };
    }).filter(Boolean);
    return books.length ? { books } : { error: 'empty' };
  }
  /** the shelf book for a chapter: by its stable id; a chapter the owner once loaded by hand is recognised by its file name */
  function mineFind(list, B, F) {
    const src = mineSrc(B, F);
    return list.find(m => m.srcId === src) || list.find(m => !m.srcId && m.title === baseName(F.file) && m.ext === (F.file.split('.').pop() || '').toLowerCase()) || null;
  }
  async function drawMine(list, into) {
    const where = () => (into ? (into.isConnected ? into : null) : shelfM && shelfM.$('[data-rd-mine]'));
    if (!where()) return;
    const idx = await mineIndex();
    const box2 = where();
    if (!box2) return;
    const head = `<div class="rd-mine-head"><h3 class="rd-mine-h">📘 Мои учебники</h3>
      <span class="rd-tiny">Тексты глав из ваших учебников — с переводом в скобках, как в книге. Они лежат только на этом Mac и никуда не отправляются.</span></div>`;
    if (idx.error) {
      box2.innerHTML = head + `<div class="rd-note rd-mine-none">${idx.error === 'broken'
        ? '📘 Список учебников (private/reader/index.json) не получилось прочитать — похоже, в нём опечатка. Поправьте файл, и полка появится здесь.'
        : '📘 Здесь появятся тексты ваших учебников, когда в папке private/reader/ будет файл index.json со списком глав.'}</div>`;
      return;
    }
    if (!mineSeen && idx.books[0]) { mineOpen.add(idx.books[0].id); mineSeen = true; }
    box2.innerHTML = head + idx.books.map(B => {
      const rows = B.files.map(F => ({ F, have: mineFind(list, B, F) }));
      const n = rows.filter(x => x.have).length;
      const meta = [B.author, B.level ? `уровень ${B.level}` : ''].filter(Boolean).join(' · ');
      return `<details class="rd-mine-book" data-rd-minebook="${esc(B.id)}" ${mineOpen.has(B.id) ? 'open' : ''}>
        <summary class="rd-mine-sum"><span class="rd-mine-name">${esc(B.title)}</span>
          <span class="rd-mine-meta">${meta ? esc(meta) + ' · ' : ''}${n === rows.length ? `✓ все ${rows.length} в читалке` : `в читалке ${n} из ${rows.length}`}</span></summary>
        <div class="rd-mine-body">
          ${B.note ? `<p class="rd-tiny">${esc(B.note)}</p>` : ''}
          <ul class="rd-mine-list">${rows.map(({ F, have }) => `<li class="rd-mine-row${have ? ' is-in' : ''}">
            <span class="rd-mine-t">${esc(F.title)}<span class="rd-mine-st">${have ? '✓ добавлено' : 'не добавлено'}</span></span>
            ${have ? `<button type="button" class="btn sm ghost rd-mine-btn" data-rd="open" data-id="${esc(have.id)}" aria-label="Открыть «${esc(F.title)}»">📖 Открыть</button>`
              : `<button type="button" class="btn sm rd-mine-btn" data-rd="mine-add" data-book="${esc(B.id)}" data-file="${esc(F.id)}" aria-label="Добавить в читалку «${esc(F.title)}»"><b aria-hidden="true" style="font-size:1.15em;line-height:1">＋</b> Добавить в читалку</button>`}
          </li>`).join('')}</ul>
          ${n < rows.length ? `<button type="button" class="btn primary rd-mine-all" data-rd="mine-all" data-book="${esc(B.id)}"><b aria-hidden="true" style="font-size:1.15em;line-height:1">＋</b> Добавить всю книгу${n ? ` (ещё ${rows.length - n})` : ''}</button>`
            : '<span class="rd-tiny">🎉 Вся книга уже на полке — приятного чтения!</span>'}
        </div></details>`;
    }).join('');
    box2.querySelectorAll('details[data-rd-minebook]').forEach(d => d.addEventListener('toggle', () => { if (d.open) mineOpen.add(d.dataset.rdMinebook); else mineOpen.delete(d.dataset.rdMinebook); }));
  }
  /** add one chapter (file id) or every missing chapter of a book to the shelf — through the ordinary import */
  async function mineAdd(bookId, fileId, o = {}) {
    if (!mineAvailable()) return;
    if (mineBusy || importing) { toast('Подождите — предыдущая глава ещё загружается', 'warn'); return; }
    mineBusy = true;
    try {
      const idx = await mineIndex();
      const B = idx.books && idx.books.find(b => b.id === bookId);
      if (!B) { toast('📘 Этого учебника больше нет в списке — обновите полку', 'warn'); return; }
      let list = [];
      try { list = (await DB.list()) || []; } catch (e) { /* no storage: import keeps the book for this visit */ }
      const want = B.files.filter(F => (fileId == null || F.id === fileId));
      const files = [], missing = [];
      for (const F of want) {
        const have = mineFind(list, B, F);
        if (have) {
          if (!have.srcId) { try { have.srcId = mineSrc(B, F); await DB.putMeta(have); } catch (e) { /* still recognised by the name */ } }
          if (fileId != null) { openBook(have.id); return; }
          continue;
        }
        let r = null;
        try { r = await fetch(minePath(B, F), { cache: 'no-store', credentials: 'same-origin' }); } catch (e) { r = null; }
        if (!r || !r.ok) { missing.push(F.title); continue; }
        let text = '';
        try { text = await r.text(); } catch (e) { missing.push(F.title); continue; }
        const f = new File([text], String(F.file).split('/').pop() || 'glava.txt', { type: 'text/plain' });
        f._rdExtra = { title: F.title, author: B.title, srcId: mineSrc(B, F) };
        files.push(f);
      }
      if (missing.length) toast(`📘 Не нашёл ${missing.length === 1 ? `файл главы «${missing[0]}»` : `файлы ${missing.length} ${plural(missing.length, ['главы', 'глав', 'глав'])}`} в папке private/reader/ — проверьте имя в index.json`, 'warn', 7000);
      if (!files.length) { if (!missing.length && fileId == null) toast('🎉 Вся книга уже на полке', 'good'); return; }
      mineBusy = false;
      await importFiles(files, {}, o);
    } finally { mineBusy = false; drawShelf(); }
  }
  function bookCard(b) {
    const pct = Math.round((b.pct || 0) * 100);
    return `<article class="rd-book" data-id="${esc(b.id)}">
      <button class="rd-cover" data-rd="open" data-id="${esc(b.id)}" aria-label="Открыть книгу «${esc(b.title)}»">${coverHtml(b)}${pct ? `<span class="rd-cover-pct" aria-hidden="true">${pct}%</span>` : ''}</button>
      <div class="rd-book-info">
        <button class="rd-book-t" data-rd="open" data-id="${esc(b.id)}">${esc(b.title)}</button>
        ${b.author ? `<span class="rd-book-a">${esc(b.author)}</span>` : ''}
        <div class="rd-bar" role="progressbar" aria-label="Прочитано" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
        <span class="rd-book-m">Прочитано ${pct}% · ${b.pages || 1} ${plural(b.pages || 1, ['страница', 'страницы', 'страниц'])}</span>
        <span class="rd-book-m">${ago(b.opened)}</span>
      </div>
      <button class="rd-del" data-rd="del" data-id="${esc(b.id)}" aria-label="Удалить книгу «${esc(b.title)}» с устройства" title="Удалить книгу">${ICON.trash(18)}</button>
    </article>`;
  }
  async function onShelfClick(e, o = {}) {
    if (!o || o instanceof Event) o = {};
    const b = e.target.closest('[data-rd]');
    if (!b) return;
    const act = b.dataset.rd, id = b.dataset.id;
    if (act === 'open') openBook(id);
    else if (act === 'del') {
      let meta = null;
      try { meta = await DB.meta(id); } catch (err) { /* gone */ }
      if (!meta) { drawShelf(); return; }
      const ok = await UI.confirm(`Удалить книгу «${esc(meta.title)}» с этого устройства?<br><span class="small muted">Место, где вы остановились, тоже удалится. Карточки, сделанные из книги, останутся.</span>`, { danger: true, ok: 'Да, удалить', title: 'Удалить книгу?' });
      if (!ok) return;
      if (R && R.meta.id === id) { R.forceClose = true; R.m.close(); }
      recentForget(id);
      try { await DB.del(id); toast(`Книга «${meta.title}» удалена с устройства`, 'good'); } catch (err) { toast('Не получилось удалить книгу — попробуйте ещё раз', 'warn'); }
      drawShelf();
    } else if (act === 'mine-add' || act === 'mine-all') {
      b.disabled = true;
      try { await mineAdd(b.dataset.book, act === 'mine-add' ? b.dataset.file : null, o); } finally { b.disabled = false; }
    } else if (act === 'sample') {
      importFiles([new File([SAMPLE], 'Den lille reven og månen.txt', { type: 'text/plain' })], { title: 'Den lille reven og månen', author: 'Сказка · норвежский и русский' }, o);
    }
  }

  /** files → books on the shelf; one book → it opens straight away */
  let importing = false;
  async function importFiles(files, extra = {}, o = {}) {
    files = [...(files || [])].filter(f => f && f.size !== 0);
    if (!files.length) return null;
    if (importing) { toast('Подождите — предыдущая книга ещё загружается', 'warn'); return null; }
    importing = true;
    if (!shelfM && !(o && o.noShelf)) { try { await openShelf(); } catch (e) { /* no shelf — still import */ } }
    let lastId = null, added = 0;
    try {
      for (const f of files) {
        const busy = UI.busy ? UI.busy(`Загружаю книгу «${String(f.name || '').replace(/\.[^.]+$/, '').slice(0, 60)}»…`) : { set() {}, close() {} };
        try {
          const r = await readFile(f, busy);
          const ex = Object.assign({}, extra, f._rdExtra || {});
          if (ex.title) r.title = ex.title;
          if (ex.author) r.author = ex.author;
          let same = null;
          try { same = ((await DB.list()) || []).find(x => (ex.srcId && x.srcId === ex.srcId) || (x.title === r.title && x.chars === r.chars)); } catch (e) { /* no storage */ }
          if (same) {
            if (ex.srcId && !same.srcId) { try { same.srcId = String(ex.srcId).slice(0, 300); await DB.putMeta(same); } catch (e) { /* recognised by the title anyway */ } }
            toast(`«${r.title}» уже есть на полке`, '', 2600); lastId = same.id; continue;
          }
          const M = buildModel(r.blocks, r.uk);
          const meta = { id: uid(), title: r.title, author: r.author || '', ext: (f.name.split('.').pop() || '').toLowerCase(), size: f.size, chars: r.chars,
            langs: r.langs, uk: r.uk, cover: r.cover || '', added: Date.now(), opened: 0, pos: 0, pct: 0, pages: M.pages, units: M.units.length };
          if (ex.srcId) meta.srcId = String(ex.srcId).slice(0, 300);
          try {
            await DB.add(meta, { id: meta.id, blocks: r.blocks });
            try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* not supported */ }
          } catch (e) {
            const full = /quota/i.test(String((e && e.name) || '') + (e && e.message));
            toast(full ? 'На устройстве не хватает места для этой книги' : 'Книга открыта, но браузер не дал её сохранить — после закрытия её придётся загрузить снова', 'warn', 8000);
            if (full) continue;
            TEMP.set(meta.id, { meta, text: { id: meta.id, blocks: r.blocks } });
          }
          lastId = meta.id; added++;
        } catch (e) {
          toast(e && e.friendly ? e.message : `Не получилось открыть «${f.name}». Попробуйте другой файл этой книги (лучше EPUB или PDF с настоящим текстом)`, 'warn', 8000);
        } finally { busy.close(); }
      }
    } finally { importing = false; }
    await drawShelf();
    if (added > 1) toast(`На полку добавлено книг: ${added}`, 'good');
    if (lastId && files.length === 1) openBook(lastId, { fresh: added === 1 });
    return lastId;
  }
  const TEMP = new Map(); // books the browser refused to keep (private mode): readable during this visit

  /* ---------- 🕘 recently read: a tiny list on this device for the home strip «Продолжить чтение» and the library ----------
   * localStorage 'nk-reader-recent' → [{ id, title, author, page, pages, pct, at }] (newest first, at most 12). The book itself
   * and its exact place stay in IndexedDB (meta.pos) — this list only lets the home screen draw itself without waiting. */
  const RECENT_KEY = 'nk-reader-recent';
  const recentAll = () => { try { const a = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(a) ? a.filter(x => x && x.id) : []; } catch (e) { return []; } };
  const recentPut = a => { try { localStorage.setItem(RECENT_KEY, JSON.stringify(a.slice(0, 12))); } catch (e) { /* full / private mode */ } };
  let recentLast = '';
  function recentNote(meta, M, i) {
    if (!meta || !meta.id || !M || !M.units.length || TEMP.has(meta.id)) return;
    const u = M.units[clamp(i, 0, M.units.length - 1)];
    const e = { id: meta.id, title: String(meta.title || '').slice(0, 140), author: String(meta.author || '').slice(0, 100), page: u ? u.p : 1, pages: M.pages,
      pct: M.units.length > 1 ? Math.round(clamp(i, 0, M.units.length - 1) / (M.units.length - 1) * 1000) / 1000 : 1, at: Date.now() };
    const sig = `${e.id}|${e.page}`;
    if (sig === recentLast && recentAll()[0] && recentAll()[0].id === e.id) return; // same page: nothing new to write
    recentLast = sig;
    try { if (window.Resume && Resume.note) Resume.note('reader', e.id, e.page, 'r'); } catch (err) { /* ⏱ reading time for «Мой прогресс» */ }
    // 🎓 «Учить по книге»: after three pages read — a gentle «Сделать колоду из прочитанного?» (js/learnby.js)
    try {
      if (window.LearnBy && LearnBy.offer) {
        const pg = e.page, id = e.id;
        LearnBy.offer({ key: 'reader:' + id, title: e.title, sub: e.author, page: pg, src: 'reader', id, open: () => openBook(id),
          text: () => M.units.filter(x => x.p === pg && !x.cyr && x.k !== 'h').map(x => x.text).join(' ') });
      }
    } catch (err) { /* a convenience */ }
    recentPut([e].concat(recentAll().filter(x => x.id !== e.id)));
  }
  function recentForget(id) { recentLast = ''; recentPut(recentAll().filter(x => x.id !== id)); }
  // Settings → «Забыть все места продолжения»: the home strip forgets the books too (the books themselves stay)
  document.addEventListener('resume-cleared', () => { recentLast = ''; try { localStorage.removeItem(RECENT_KEY); } catch (e) { /* ignore */ } });

  /* =====================================================================
   * 📖 the reader
   * ===================================================================== */
  let R = null;
  // 🔊 a voice chosen for the reader (or «как везде» again): the open «Aa» / «Чтение вслух» panel shows it at once
  document.addEventListener('voices-pick', () => { if (R && (R.panel === 'look' || R.panel === 'listen')) try { redrawPanel(R); } catch (e) { /* ignore */ } });
  const metaGet = async id => (TEMP.get(id) || {}).meta || DB.meta(id);
  const textGet = async id => (TEMP.get(id) || {}).text || DB.text(id);

  async function openBook(id, opts = {}) {
    if (R) {
      if (R.meta.id === id) { if (opts.listen) setLmode(R, true, true); return; }
      const ok = await R.m.tryClose(); if (!ok) return;
    }
    let meta = null, text = null;
    const busy = UI.busy ? UI.busy('Открываю книгу…') : { close() {} };
    try { [meta, text] = await Promise.all([metaGet(id), textGet(id)]); } catch (e) { /* below */ } finally { busy.close(); }
    if (!meta || !text || !text.blocks) { recentForget(id); toast('Эту книгу не получилось открыть — возможно, её удалили. Загрузите её снова', 'warn', 6000); drawShelf(); return; }
    const M = buildModel(text.blocks, meta.uk);
    if (!M.units.length) { toast('В этой книге не нашлось текста для чтения', 'warn'); return; }
    let start = clamp(meta.pos || 0, 0, M.units.length - 1);
    // «▶ Продолжить» (home strip, library) already IS the answer: straight to the saved place
    if (start > 0 && !opts.fresh && !opts.cont) {
      const u = M.units[start];
      const snip = u.text.length > 140 ? u.text.slice(0, 140) + '…' : u.text;
      const r = await UI.choose(`📖 ${esc(meta.title)}`,
        `<p class="rd-resume">Вы остановились на странице ${u.p} из ${M.pages} (${Math.round((meta.pct || 0) * 100)}%).</p><blockquote class="rd-resume-q">${esc(snip)}</blockquote>`,
        [{ label: 'Начать сначала', value: 'start', cls: 'ghost' }, { label: `▶ Продолжить с места, где остановились (стр. ${u.p})`, value: 'cont', cls: 'primary' }]);
      if (r == null) return;
      if (r === 'start') start = 0;
    }
    meta.opened = Date.now();
    putSoon(meta);
    mountReader(meta, M, start);
    recentNote(meta, M, start);
    if (opts.listen && R && R.meta === meta) setLmode(R, true, true);
  }

  let saveT = null, saveMeta = null;
  function putSoon(meta) {
    saveMeta = meta;
    clearTimeout(saveT);
    saveT = setTimeout(flushSave, 700);
  }
  function flushSave() {
    clearTimeout(saveT);
    const m = saveMeta; saveMeta = null;
    if (!m) return Promise.resolve();
    if (TEMP.has(m.id)) return Promise.resolve();
    return DB.putMeta(m).catch(() => {});
  }

  function readerHtml() {
    return `<div class="rd" data-rd-root tabindex="-1">
      <div class="rd-stage" data-stage>
        <button class="rd-side rd-side-prev" data-a="prev" aria-label="Предыдущая страница">${ICON.left}</button>
        <div class="rd-view" data-view tabindex="0" aria-label="Текст книги"><div class="rd-flow" data-flow lang="nb"></div></div>
        <button class="rd-side rd-side-next" data-a="next" aria-label="Следующая страница">${ICON.right}</button>
      </div>
      <div class="rd-bottom">
        <div class="rd-progress">
          <button class="rd-ctl rd-pagebtn" data-a="prev" aria-label="Предыдущая страница">${ICON.left}</button>
          <div class="rd-prog-mid">
            <span class="rd-pg" data-pg aria-live="polite"></span>
            <input type="range" class="rd-range" data-range min="1" max="1" value="1" aria-label="Страница книги">
          </div>
          <button class="rd-ctl rd-pagebtn" data-a="next" aria-label="Следующая страница">${ICON.right}</button>
        </div>
        <div class="rd-player" role="group" aria-label="Чтение вслух">
          <button class="rd-ctl" data-a="sprev" aria-label="Предыдущее предложение">${ICON.prevS}</button>
          <button class="rd-ctl rd-play" data-a="play" aria-label="Читать вслух">${ICON.play}</button>
          <button class="rd-ctl" data-a="snext" aria-label="Следующее предложение">${ICON.nextS}</button>
          <button class="rd-ctl rd-again" data-a="again" aria-label="Повторить предложение">${ICON.again}</button>
          <button class="rd-ctl" data-a="listen" data-panel-btn="listen" aria-label="Настройки чтения вслух и таймер сна" title="Настройки чтения вслух и таймер сна" aria-expanded="false">${ICON.phones}</button>
        </div>
      </div>
    </div>`;
  }

  function mountReader(meta, M, start) {
    const state = R = {
      meta, M, cur: start, hl: -1, s0: 0, s1: 0, page: 0, nPages: 1, step: 1, per: 1, colW: 600, gap: 40,
      playing: false, tok: 0, gen: null, panel: null, panelEl: null, pop: null, userNav: 0, warnedRu: false, warnedUk: false, spans: [],
    };
    const m = UI.modal({
      title: `📖 ${esc(meta.title)}`, cls: 'rd-modal', body: readerHtml(),
      beforeClose: UI.guard ? UI.guard(() => (state.playing && !state.forceClose ? {
        title: 'Закрыть книгу?', line: 'Чтение вслух остановится. Место, где вы остановились, сохранится.',
        actions: [{ label: 'Закрыть', value: 'close', cls: 'bad' }],
      } : null)) : undefined,
      onClose: () => teardown(state),
    });
    state.m = m;
    const bd = m.el.parentElement; if (bd) bd.classList.add('rd-backdrop');
    state.root = m.$('[data-rd-root]');
    state.stage = m.$('[data-stage]');
    state.view = m.$('[data-view]');
    state.flow = m.$('[data-flow]');
    // header: contents, look, menu — next to 🏠 and ✕
    const h2 = m.el.querySelector('.modal-head h2');
    if (h2) {
      h2.classList.add('rd-h2');
      h2.insertAdjacentHTML('afterend', `<div class="rd-head-btns">
        <button class="rd-hb" data-a="toc" aria-label="Содержание" title="Содержание">${ICON.toc}</button>
        ${window.PrintX ? `<button class="rd-hb rd-print" data-a="print" aria-haspopup="dialog" aria-label="Печать и файлы: распечатать книгу или сохранить в Word" title="🖨 Печать и файлы — распечатать страницы книги или сохранить в Word">${ICON.print}</button>` : ''}
        <button class="rd-hb rd-aa" data-a="look" data-panel-btn="look" aria-label="Вид текста: размер, шрифт, фон" aria-expanded="false" title="Вид текста">Aa</button>
        <button class="rd-hb" data-a="menu" data-panel-btn="menu" aria-label="Меню книги" aria-expanded="false" title="Меню книги">${ICON.more}</button></div>`);
    }
    if (window.TrBadge) TrBadge.mount(m.$('.modal-head'), { place: 'reader' }); // 🌐 who translates now
    applyLook(state);
    m.el.addEventListener('click', e => onClick(state, e));
    m.el.addEventListener('input', e => onInput(state, e));
    m.el.addEventListener('change', e => onChange(state, e));
    m.el.addEventListener('keydown', e => onKey(state, e));
    state.view.addEventListener('scroll', () => onScroll(state), { passive: true });
    state.view.addEventListener('wheel', () => { state.userNav = Date.now(); }, { passive: true });
    bindSwipe(state);
    state.escKey = e => {
      if (e.key !== 'Escape' || R !== state) return;
      const top = [...document.querySelectorAll('#modal-root > .modal-backdrop:not(.closing)')].pop();
      if (top && !top.contains(state.m.el)) return; // a window above the book (🔊 Голоса…) closes first
      if (state.pop) { e.stopPropagation(); e.preventDefault(); closePop(state); return; }
      if (state.panel) { e.stopPropagation(); e.preventDefault(); closePanel(state, true); }
    };
    window.addEventListener('keydown', state.escKey, true);
    state.outside = e => {
      if (state.panel && state.panelEl && !state.panelEl.contains(e.target) && !e.target.closest('[data-panel-btn]')) closePanel(state);
      if (state.pop && !state.pop.contains(e.target) && !state.view.contains(e.target)) closePop(state);
    };
    document.addEventListener('pointerdown', state.outside, true);
    state.save = () => { if (R === state) { savePos(state); flushSave(); } };
    state.vis = () => { if (document.visibilityState === 'hidden') state.save(); };
    document.addEventListener('visibilitychange', state.vis);
    window.addEventListener('pagehide', state.save);
    let rt = 0;
    state.ro = window.ResizeObserver ? new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (R === state) relayout(state); }, 140); }) : null;
    if (state.ro) state.ro.observe(state.stage); else window.addEventListener('resize', state.onResize = () => { clearTimeout(rt); rt = setTimeout(() => relayout(state), 140); });
    // the reader's text starts in the right place once the fonts are there
    renderAt(state, start);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (R === state) relayout(state); });
    state.watch = setInterval(() => watchdog(state), 700);
    setTimeout(() => { try { state.view.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 80);
  }

  function teardown(state) {
    stopSpeech(state, true);
    savePos(state);
    const saved = flushSave();
    closePop(state); closePanel(state);
    clearInterval(state.watch);
    if (state.ro) state.ro.disconnect(); else window.removeEventListener('resize', state.onResize);
    if (state.io) state.io.disconnect();
    window.removeEventListener('keydown', state.escKey, true);
    document.removeEventListener('pointerdown', state.outside, true);
    document.removeEventListener('visibilitychange', state.vis);
    window.removeEventListener('pagehide', state.save);
    msRelease();
    if (R === state) R = null;
    // the shelf, the library (js/bookshelf.js) and the home strip show the new page once it is stored
    saved.then(() => drawShelf(), () => drawShelf());
  }

  /* ---------- look ---------- */
  function applyLook(st) {
    const el = st.m.el, root = st.root;
    el.dataset.skin = P.skin;
    root.dataset.mode = P.mode;
    root.dataset.hls = P.hls;
    root.toggleAttribute('data-hidetr', !!P.hideTr);
    const hl = (PALETTE.find(x => x[0] === P.hl) || PALETTE[0])[2];
    root.style.setProperty('--rd-size', P.size + 'px');
    root.style.setProperty('--rd-lh', LH[clamp(P.lh, 0, LH.length - 1)]);
    root.style.setProperty('--rd-font', (FONTS[P.font] || FONTS.serif)[1]);
    root.style.setProperty('--rd-hl', hl);
    if (st.pop) st.pop.dataset.skin = P.skin;
  }
  /** column width, one or two columns (wide screens), page step */
  function measure(st) {
    const stageW = st.stage.clientWidth;
    const sides = P.mode === 'page' && stageW >= 700;
    st.root.toggleAttribute('data-sides', sides);
    const avail = Math.max(200, stageW - (sides ? 2 * 64 : 2 * 18));
    const want = WIDTH_EM[clamp(P.width, 0, WIDTH_EM.length - 1)] * P.size;
    const gap = clamp(Math.round(avail * 0.06), 28, 72);
    const per = P.mode === 'page' && avail >= 940 && (avail - gap) / 2 >= Math.min(want, 23 * P.size) ? 2 : 1;
    const colW = Math.floor(per === 2 ? Math.min(want, (avail - gap) / 2) : Math.min(want, avail));
    Object.assign(st, { per, colW, gap, step: per * colW + per * gap });
  }
  function relayout(st) {
    if (!st.flow || !document.body.contains(st.flow)) return;
    const keep = st.playing ? st.hl : st.cur;
    renderAt(st, keep >= 0 ? keep : st.cur, true);
  }

  /* ---------- rendering sections ---------- */
  function sectionHtml(st, j) {
    const M = st.M, s = M.secs[j];
    let h = '';
    for (let b = s.b0; b <= s.b1; b++) {
      const u0 = M.bStart[b], u1 = M.bStart[b + 1];
      if (u1 <= u0) continue;
      let inner = '';
      for (let i = u0; i < u1; i++) {
        const u = M.units[i];
        inner += `<span class="rd-s${u.cyr ? ' rd-cyr' : ''}${u.tr ? ' rd-tr' : ''}" data-i="${i}"${u.cyr ? ` lang="${M.uk ? 'uk' : 'ru'}"` : ''}>${esc(u.text)}</span> `;
      }
      h += M.blocks[b][0] === 'h' ? `<h3 class="rd-h">${inner}</h3>` : `<p class="rd-p">${inner}</p>`;
    }
    return `<div class="rd-sec" data-sec="${j}">${h}</div>`;
  }
  function renderSecs(st, s0, s1) {
    st.s0 = s0; st.s1 = s1;
    let h = '';
    if (P.mode === 'scroll' && s0 > 0) h += `<div class="rd-edge"><button class="btn ghost rd-edge-btn" data-a="prevpart">↑ Показать предыдущую часть</button></div>`;
    for (let j = s0; j <= s1; j++) h += sectionHtml(st, j);
    if (P.mode === 'scroll') h += st.s1 < st.M.secs.length - 1 ? '<div class="rd-edge" data-more><span class="rd-tiny">Дальше…</span></div>' : '<div class="rd-end" aria-hidden="true">❦</div>';
    st.flow.innerHTML = h;
    st.spans = [...st.flow.querySelectorAll('.rd-s')];
    if (st.hl >= 0) { const el = spanOf(st, st.hl); if (el) el.classList.add('rd-cur'); }
    if (st.kw) karPaint(st, false);
    watchMore(st);
  }
  const spanOf = (st, i) => st.flow.querySelector(`.rd-s[data-i="${i}"]`);
  function renderAt(st, i, keepCur) {
    closePop(st);
    measure(st);
    const fl = st.flow, v = st.view;
    const j = secOf(st.M, i);
    if (P.mode === 'page') {
      v.style.width = (st.per * st.colW + (st.per - 1) * st.gap) + 'px';
      fl.style.maxWidth = '';
      fl.style.columnWidth = st.colW + 'px';
      fl.style.columnGap = st.gap + 'px';
      fl.style.height = v.clientHeight + 'px';
      fl.style.transition = 'none';
      renderSecs(st, j, j);
      fl.style.height = v.clientHeight + 'px';
      countPages(st);
      goPage(st, pageOfUnit(st, i), false);
    } else {
      v.style.width = '';
      fl.style.columnWidth = ''; fl.style.columnGap = ''; fl.style.height = ''; fl.style.transform = ''; fl.style.transition = '';
      fl.style.maxWidth = st.colW + 'px';
      renderSecs(st, j, j);
      scrollToUnit(st, i, false);
    }
    if (!keepCur || !st.playing) st.cur = i;
    progressUi(st);
  }
  function countPages(st) {
    const fl = st.flow, last = fl.lastElementChild && (fl.lastElementChild.lastElementChild || fl.lastElementChild);
    if (!last) { st.nPages = 1; return; }
    const fr = fl.getBoundingClientRect();
    const spans = st.spans;
    const lastSpan = spans[spans.length - 1] || last;
    const rects = lastSpan.getClientRects();
    const rr = rects.length ? rects[rects.length - 1] : lastSpan.getBoundingClientRect();
    const cols = Math.floor(Math.max(0, rr.left - fr.left + 2) / (st.colW + st.gap)) + 1;
    st.nPages = Math.max(1, Math.ceil(cols / st.per));
  }
  function pageOfUnit(st, i) {
    const el = spanOf(st, i);
    if (!el) return 0;
    const r = el.getClientRects()[0] || el.getBoundingClientRect();
    const fr = st.flow.getBoundingClientRect();
    return clamp(Math.floor((r.left - fr.left + 2) / st.step), 0, st.nPages - 1);
  }
  function goPage(st, n, anim = true) {
    st.page = clamp(n, 0, st.nPages - 1);
    st.flow.style.transition = anim && !RM() ? 'transform .34s cubic-bezier(.22,.8,.3,1)' : 'none';
    st.flow.style.transform = `translateX(${-st.page * st.step}px)`;
    sidesUi(st);
  }
  /** the first sentence one sees (page: the first one on the page; ribbon: the first one at the top) */
  function firstVisible(st) {
    const sp = st.spans;
    if (!sp.length) return st.cur;
    let lo = 0, hi = sp.length - 1;
    if (P.mode === 'page') {
      const fr = st.flow.getBoundingClientRect(), x0 = st.page * st.step - 2;
      while (lo < hi) { const mid = (lo + hi) >> 1; const r = sp[mid].getClientRects(); const left = (r.length ? r[r.length - 1].left : sp[mid].getBoundingClientRect().left) - fr.left; if (left >= x0) hi = mid; else lo = mid + 1; }
    } else {
      const top = st.view.getBoundingClientRect().top + 6;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (sp[mid].getBoundingClientRect().bottom > top) hi = mid; else lo = mid + 1; }
    }
    return +sp[lo].dataset.i;
  }
  function scrollToUnit(st, i, smooth) {
    const el = spanOf(st, i), v = st.view;
    if (!el) return;
    if (i === st.M.secs[st.s0].u0 && st.s0 === 0) { v.scrollTop = 0; return; }
    const top = el.getBoundingClientRect().top - v.getBoundingClientRect().top + v.scrollTop - v.clientHeight * 0.28;
    v.scrollTo({ top: Math.max(0, top), behavior: smooth && !RM() ? 'smooth' : 'auto' });
  }
  function watchMore(st) {
    if (st.io) st.io.disconnect();
    if (P.mode !== 'scroll' || !window.IntersectionObserver) return;
    const more = st.flow.querySelector('[data-more]');
    if (!more) return;
    st.io = new IntersectionObserver(ents => { if (ents.some(e => e.isIntersecting)) appendNext(st); }, { root: st.view, rootMargin: '600px 0px' });
    st.io.observe(more);
  }
  function appendNext(st) {
    if (P.mode !== 'scroll' || st.s1 >= st.M.secs.length - 1) return;
    const keep = st.view.scrollTop;
    const more = st.flow.querySelector('[data-more]'); if (more) more.remove();
    st.s1++;
    st.flow.insertAdjacentHTML('beforeend', sectionHtml(st, st.s1) + (st.s1 < st.M.secs.length - 1 ? '<div class="rd-edge" data-more><span class="rd-tiny">Дальше…</span></div>' : '<div class="rd-end" aria-hidden="true">❦</div>'));
    st.spans = [...st.flow.querySelectorAll('.rd-s')];
    st.view.scrollTop = keep;
    watchMore(st);
  }
  function prependPrev(st) {
    if (st.s0 <= 0) return;
    const v = st.view, h0 = v.scrollHeight, t0 = v.scrollTop;
    const edge = st.flow.querySelector('.rd-edge'); if (edge && edge.querySelector('[data-a="prevpart"]')) edge.remove();
    st.s0--;
    st.flow.insertAdjacentHTML('afterbegin', (st.s0 > 0 ? '<div class="rd-edge"><button class="btn ghost rd-edge-btn" data-a="prevpart">↑ Показать предыдущую часть</button></div>' : '') + sectionHtml(st, st.s0));
    st.spans = [...st.flow.querySelectorAll('.rd-s')];
    v.scrollTop = t0 + (v.scrollHeight - h0);
  }
  /** a unit that is not laid out yet → lay out its part of the book */
  function ensureShown(st, i) {
    const j = secOf(st.M, i);
    if (j >= st.s0 && j <= st.s1) return;
    if (P.mode === 'scroll' && j === st.s1 + 1) { appendNext(st); return; }
    renderAt(st, i, true);
  }

  /* ---------- paging ---------- */
  function nextPage(st) {
    st.userNav = Date.now();
    if (P.mode === 'scroll') { st.view.scrollBy({ top: st.view.clientHeight * 0.86, behavior: RM() ? 'auto' : 'smooth' }); return; }
    if (st.page < st.nPages - 1) goPage(st, st.page + 1);
    else if (st.s0 < st.M.secs.length - 1) renderAt(st, st.M.secs[st.s0 + 1].u0, true);
    else { toast('Это последняя страница книги', '', 1800); return; }
    afterNav(st);
  }
  function prevPage(st) {
    st.userNav = Date.now();
    if (P.mode === 'scroll') { st.view.scrollBy({ top: -st.view.clientHeight * 0.86, behavior: RM() ? 'auto' : 'smooth' }); return; }
    if (st.page > 0) goPage(st, st.page - 1);
    else if (st.s0 > 0) { renderAt(st, st.M.secs[st.s0 - 1].u0, true); goPage(st, st.nPages - 1, false); }
    else return;
    afterNav(st);
  }
  function afterNav(st) {
    closePop(st);
    if (!st.playing) st.cur = firstVisible(st);
    progressUi(st);
    savePos(st);
  }
  function sidesUi(st) {
    const first = st.page <= 0 && st.s0 <= 0, last = st.page >= st.nPages - 1 && st.s1 >= st.M.secs.length - 1;
    st.m.$$('[data-a="prev"]').forEach(b => { b.disabled = P.mode === 'page' && first; });
    st.m.$$('[data-a="next"]').forEach(b => { b.disabled = P.mode === 'page' && last; });
  }
  let scT = 0;
  function onScroll(st) {
    if (P.mode !== 'scroll') return;
    closePop(st);
    clearTimeout(scT);
    scT = setTimeout(() => {
      if (R !== st) return;
      if (!st.playing) { st.cur = firstVisible(st); savePos(st); }
      progressUi(st);
    }, 160);
  }
  function bindSwipe(st) {
    let s = null, t0 = null;
    st.view.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') s = { x: e.clientX, y: e.clientY, t: Date.now() }; }, { passive: true });
    st.view.addEventListener('pointerup', e => {
      if (!s || P.mode !== 'page') { s = null; return; }
      const dx = e.clientX - s.x, dy = e.clientY - s.y, dt = Date.now() - s.t;
      s = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 800) { st.swiped = Date.now(); if (dx < 0) nextPage(st); else prevPage(st); }
    }, { passive: true });
    st.view.addEventListener('pointercancel', () => { s = null; }, { passive: true });
    // horizontal swipes are page turns, not page scrolls
    st.view.addEventListener('touchstart', e => { const t = e.touches[0]; t0 = t ? { x: t.clientX, y: t.clientY } : null; }, { passive: true });
    st.view.addEventListener('touchmove', e => {
      const t = e.touches[0];
      if (P.mode === 'page' && e.cancelable && t0 && t && Math.abs(t.clientX - t0.x) > Math.abs(t.clientY - t0.y)) e.preventDefault();
    }, { passive: false });
  }

  /* ---------- progress ---------- */
  function progressUi(st) {
    const M = st.M, i = clamp(st.playing && st.hl >= 0 ? st.hl : st.cur, 0, M.units.length - 1);
    const u = M.units[i];
    const pct = M.units.length > 1 ? Math.round(i / (M.units.length - 1) * 100) : 100;
    const pg = st.m.$('[data-pg]'), rg = st.m.$('[data-range]');
    if (pg) pg.textContent = `стр. ${u.p} из ${M.pages} · ${pct}%`;
    if (rg && document.activeElement !== rg) { rg.max = M.pages; rg.value = u.p; rg.disabled = M.pages <= 1; }
    if (P.mode === 'page') sidesUi(st);
    else st.m.$$('[data-a="prev"],[data-a="next"]').forEach(b => { b.disabled = false; });
    if (st.lisEl) lisUi(st);
  }
  function savePos(st) {
    const M = st.M;
    const i = clamp(st.playing && st.hl >= 0 ? st.hl : st.cur, 0, M.units.length - 1);
    st.meta.pos = i;
    st.meta.pct = M.units.length > 1 ? i / (M.units.length - 1) : 1;
    st.meta.pages = M.pages;
    putSoon(st.meta);
    recentNote(st.meta, M, i);
  }
  function unitOfPage(M, p) {
    let lo = 0, hi = M.units.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (M.units[mid].p >= p) hi = mid; else lo = mid + 1; }
    return lo;
  }
  function goUnit(st, i) {
    i = clamp(i, 0, st.M.units.length - 1);
    st.userNav = 0;
    ensureShown(st, i);
    if (P.mode === 'page') goPage(st, pageOfUnit(st, i), false); else scrollToUnit(st, i, false);
    st.cur = i;
    if (st.playing) playFrom(st, i);
    progressUi(st); savePos(st);
  }

  /* ---------- clicks, keys ---------- */
  function onClick(st, e) {
    const a = e.target.closest('[data-a]');
    if (a && !a.disabled) {
      const act = a.dataset.a;
      if (act === 'prev') prevPage(st);
      else if (act === 'next') nextPage(st);
      else if (act === 'play') togglePlay(st);
      else if (act === 'sprev') stepUnit(st, -1);
      else if (act === 'snext') stepUnit(st, 1);
      else if (act === 'again') again(st);
      else if (act === 'listen' || act === 'look' || act === 'menu') togglePanel(st, act, a);
      else if (act === 'toc') showToc(st);
      else if (act === 'print') printBook(st);
      else if (act === 'prevpart') prependPrev(st);
      else if (act === 'lmode') { closePanel(st); setLmode(st, true); }
      else if (act === 'lmode-off') setLmode(st, false);
      return;
    }
    const sl = e.target.closest('[data-sleep]');
    if (sl) { setSleep(st, sl.dataset.sleep); return; }
    const set = e.target.closest('[data-set]');
    if (set) { applySet(st, set.dataset.set, set.dataset.v); return; }
    const mi = e.target.closest('[data-mi]');
    if (mi) { menuAct(st, mi.dataset.mi); return; }
    if (st.view.contains(e.target)) onTextTap(st, e);
  }
  function onInput(st, e) {
    if (e.target.matches('[data-range]')) {
      const p = +e.target.value;
      const pg = st.m.$('[data-pg]');
      if (pg) pg.textContent = `стр. ${p} из ${st.M.pages}`;
    }
  }
  function onChange(st, e) {
    if (e.target.matches('[data-range]')) { goUnit(st, unitOfPage(st.M, +e.target.value)); e.target.blur(); }
  }
  function onKey(st, e) {
    const t = e.target;
    if (t.closest && t.closest('input, select, textarea, .rd-panel')) return;
    const btn = t.closest && t.closest('button');
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { if (P.mode === 'page' || e.key === 'PageDown') { e.preventDefault(); nextPage(st); } }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { if (P.mode === 'page' || e.key === 'PageUp') { e.preventDefault(); prevPage(st); } }
    else if ((e.key === ' ' || e.key === 'Spacebar') && !btn) { e.preventDefault(); togglePlay(st); }
  }

  /* ---------- panels: look, listening, book menu ---------- */
  const seg = (key, opts, cur, cls = '') => `<div class="rd-seg ${cls}" role="group">${opts.map(([v, l]) => `<button type="button" data-set="${key}" data-v="${v}" aria-pressed="${String(v) === String(cur)}" class="${String(v) === String(cur) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  /** 🔊 the reader's own voice (🔊 Голоса → «Где какой голос»): the button + what reads now */
  function voiceBtn() {
    if (!window.Voices || !Voices.openChooser) return '';
    let now = '';
    try { now = Voices.label('no', '', 'reader'); } catch (e) { now = ''; }
    const own = (() => { try { return ['no', 'uk', 'ru'].some(l => Voices.placePick('reader', l)); } catch (e) { return false; } })();
    return `<div class="rd-tiny">🔊 Голоса для читалки${own ? ' (свои)' : ' — как везде'}:</div>${Voices.langButtons('reader', { names: !!now })}`;
  }
  function panelHtml(st, name) {
    if (name === 'look') {
      return `<div class="rd-pt">Вид текста</div>
        <div class="rd-row"><span class="rd-lbl">Как читать</span>${seg('mode', [['page', '📄 Страницы'], ['scroll', '📜 Лента']], P.mode)}</div>
        <div class="rd-row"><span class="rd-lbl">Размер текста</span><div class="rd-step"><button type="button" data-set="size" data-v="-1" aria-label="Мельче">A−</button><span>${P.size}</span><button type="button" data-set="size" data-v="1" aria-label="Крупнее">A+</button></div></div>
        <div class="rd-row"><span class="rd-lbl">Между строками</span><div class="rd-step"><button type="button" data-set="lh" data-v="-1" aria-label="Плотнее">−</button><span>${['очень тесно', 'тесно', 'обычно', 'свободно', 'очень свободно'][clamp(P.lh, 0, 4)]}</span><button type="button" data-set="lh" data-v="1" aria-label="Свободнее">+</button></div></div>
        <div class="rd-row"><span class="rd-lbl">Ширина строки</span><div class="rd-step"><button type="button" data-set="width" data-v="-1">Уже</button><span>${P.width + 1} из ${WIDTH_EM.length}</span><button type="button" data-set="width" data-v="1">Шире</button></div></div>
        <div class="rd-row"><span class="rd-lbl">Шрифт</span><div class="rd-seg">${Object.entries(FONTS).map(([k, [l, f]]) => `<button type="button" data-set="font" data-v="${k}" style="font-family:${esc(f)}" aria-pressed="${P.font === k}" class="${P.font === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div class="rd-row"><span class="rd-lbl">Фон</span>${seg('skin', [['app', 'Как в приложении'], ['sepia', 'Сепия']], P.skin)}</div>
        <div class="rd-row"><span class="rd-lbl">Перевод в скобках</span>${seg('hideTr', [['0', 'Показывать'], ['1', 'Скрыть до нажатия']], P.hideTr ? '1' : '0')}</div>
        <div class="rd-row"><span class="rd-lbl">Подсветка при чтении</span>
          <div class="rd-swatches" role="group" aria-label="Цвет подсветки">${PALETTE.map(([k, l, c]) => `<button type="button" class="rd-sw${P.hl === k ? ' on' : ''}" data-set="hl" data-v="${k}" style="--c:${c}" aria-label="${l}" aria-pressed="${P.hl === k}" title="${l}"></button>`).join('')}</div>
          ${seg('hls', [['fill', 'Заливка'], ['line', 'Подчёркивание']], P.hls)}</div>
        <div class="rd-row"><span class="rd-lbl">Бегущая подсветка слов</span>${seg('kar', [['1', 'Вкл'], ['0', 'Выкл']], P.kar !== false ? '1' : '0')}
          <span class="rd-tiny">Во время чтения вслух слово, которое звучит, подсвечивается внутри фразы — как караоке.</span></div>
        ${voiceBtn()}`;
    }
    if (name === 'listen') {
      const vi = voiceInfo(st);
      return `<div class="rd-pt">Чтение вслух</div>
        ${vi.noRu ? `<div class="rd-note">На этом устройстве нет русского голоса. ${vi.online ? 'Перевод будет читаться голосом из интернета — или выберите «Только норвежский».' : 'Без интернета перевод не прочитать — выберите «Только норвежский».'}</div>` : ''}
        <div class="rd-row"><span class="rd-lbl">Читать</span>${seg('read', READS, P.read, 'rd-seg-col')}</div>
        <div class="rd-row"><span class="rd-lbl">Скорость</span>${seg('speed', SPEEDS, P.speed)}</div>
        <div class="rd-row"><span class="rd-lbl">Пауза между фразами</span>${seg('pause', PAUSES.map(x => [x[0], x[1]]), P.pause)}</div>
        <div class="rd-row"><span class="rd-lbl">Повторять каждую фразу</span>${seg('repeat', [[1, '1 раз'], [2, '2 раза'], [3, '3 раза']], P.repeat)}</div>
        <div class="rd-row"><span class="rd-lbl">🌙 Таймер сна</span>${sleepSeg(st)}<span class="rd-sleep-st" data-sleep-left aria-live="polite">${esc(sleepText(st))}</span></div>
        <button type="button" class="btn ghost rd-wide" data-a="again" title="Прочитать текущую фразу ещё раз">${ICON.again} Повторить текущую фразу</button>
        <button type="button" class="btn ghost rd-wide" data-a="lmode" title="Крупные кнопки, текущая фраза и таймер сна — удобно слушать лёжа или в наушниках">🎧 Режим прослушивания — крупные кнопки</button>
        ${voiceBtn()}
        <div class="rd-tiny">Норвежский текст читает норвежский голос, перевод — русский${st.M.uk ? ' (украинский — украинским голосом устройства или онлайн-голосом, но не русским)' : ''}.</div>`;
    }
    return `<div class="rd-menu" role="menu">
      <button type="button" role="menuitem" data-mi="toc">📑 Содержание</button>
      <button type="button" role="menuitem" data-mi="goto">🔢 Перейти к странице…</button>
      ${window.PrintX ? '<button type="button" role="menuitem" data-mi="print">🖨 Печать и файлы</button>' : ''}
      <button type="button" role="menuitem" data-mi="reset">↺ Сбросить прогресс</button>
      <button type="button" role="menuitem" data-mi="shelf">📚 Моя полка</button>
      <button type="button" role="menuitem" data-mi="del" class="rd-danger">${ICON.trash(16)} Удалить книгу с устройства</button></div>`;
  }
  function togglePanel(st, name, anchor) {
    if (st.panel === name) { closePanel(st, true); return; }
    closePanel(st);
    closePop(st);
    const el = document.createElement('div');
    el.className = `rd-panel rd-panel-${name}`;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', name === 'look' ? 'Вид текста' : name === 'listen' ? 'Чтение вслух' : 'Меню книги');
    el.innerHTML = panelHtml(st, name);
    st.stage.appendChild(el);
    st.panel = name; st.panelEl = el;
    st.m.$$(`[data-panel-btn="${name}"]`).forEach(b => b.setAttribute('aria-expanded', 'true'));
    st.panelAnchor = anchor;
    setTimeout(() => { const f = el.querySelector('button.on, button'); if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
  }
  function closePanel(st, refocus) {
    if (!st.panelEl) return;
    st.panelEl.remove();
    st.m.$$('[data-panel-btn]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    const a = st.panelAnchor;
    st.panel = null; st.panelEl = null; st.panelAnchor = null;
    if (refocus && a) try { a.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function redrawPanel(st) {
    if (!st.panelEl) return;
    const f = document.activeElement && st.panelEl.contains(document.activeElement) ? [document.activeElement.dataset.set, document.activeElement.dataset.v] : null;
    st.panelEl.innerHTML = panelHtml(st, st.panel);
    if (f) { const b = st.panelEl.querySelector(`[data-set="${f[0]}"][data-v="${f[1]}"]`); if (b) try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  function applySet(st, key, v) {
    let layout = false;
    if (key === 'mode') { if (P.mode !== v) { P.mode = v; layout = true; } }
    else if (key === 'size') { P.size = clamp(P.size + +v, 14, 34); layout = true; }
    else if (key === 'lh') { P.lh = clamp(P.lh + +v, 0, LH.length - 1); layout = true; }
    else if (key === 'width') { P.width = clamp(P.width + +v, 0, WIDTH_EM.length - 1); layout = true; }
    else if (key === 'font') { P.font = FONTS[v] ? v : 'serif'; layout = true; }
    else if (key === 'skin') P.skin = v === 'sepia' ? 'sepia' : 'app';
    else if (key === 'hideTr') P.hideTr = v === '1';
    else if (key === 'hl') P.hl = v;
    else if (key === 'hls') P.hls = v === 'line' ? 'line' : 'fill';
    else if (key === 'kar') { P.kar = v !== '0'; if (!P.kar) karClear(st); }
    else if (key === 'read') { P.read = v; if (st.playing) playFrom(st, st.hl >= 0 ? st.hl : st.cur); }
    else if (key === 'speed') { P.speed = v; if (st.playing) playFrom(st, st.hl >= 0 ? st.hl : st.cur); }
    else if (key === 'pause') P.pause = +v;
    else if (key === 'repeat') P.repeat = clamp(+v, 1, 3);
    savePrefs();
    applyLook(st);
    try { document.dispatchEvent(new CustomEvent('reader-look', { detail: { k: key } })); } catch (e) { /* ignore */ }
    if (layout) relayout(st);
    redrawPanel(st);
    if (st.lisEl) lisUi(st, true);
  }
  /** 🖨 «Печать и файлы» (js/printx.js): the book paragraph by paragraph — Norwegian, its bracketed translation, the book page.
   *  Chapters of «📘 Мои учебники» (private/reader/) are the owner's own textbooks: printed only for personal use. */
  function printBook(st) {
    if (!window.PrintX) { toast('Печать ещё загружается — попробуйте через секунду'); return; }
    stopSpeech(st);
    const M = st.M, blocks = [];
    M.blocks.forEach((b, j) => {
      const us = M.units.slice(M.bStart[j], M.bStart[j + 1]);
      if (!us.length) return;
      const no = us.filter(u => !u.cyr && !u.tr).map(u => u.text).join(' ').trim();
      const tr = us.filter(u => u.cyr || u.tr).map(u => u.text).join(' ').trim();
      if (no) blocks.push(Object.assign({ no, page: us[0].p }, tr ? { [M.uk && /[іїєґ]/i.test(tr) ? 'uk' : 'ru']: tr } : {}));
    });
    const mine = /^mine:/.test(String(st.meta.srcId || ''));
    PrintX.text({ title: st.meta.title || 'Книга', author: st.meta.author || '', blocks,
      source: { id: 'book:' + st.meta.id, name: st.meta.title || '', kind: 'book', protected: mine } });
  }
  async function menuAct(st, k) {
    closePanel(st);
    if (k === 'toc') showToc(st);
    else if (k === 'print') printBook(st);
    else if (k === 'goto') {
      const v = await UI.prompt(`Перейти к странице (1–${st.M.pages})`, String(st.M.units[st.cur].p), '');
      const n = parseInt(v, 10);
      if (v == null || v === '') return;
      if (!(n >= 1 && n <= st.M.pages)) { toast(`В книге страницы с 1 по ${st.M.pages}`, 'warn'); return; }
      goUnit(st, unitOfPage(st.M, n));
    } else if (k === 'reset') {
      const ok = await UI.confirm('Сбросить прогресс этой книги? Закладка вернётся на начало книги.', { ok: 'Да, сбросить', title: 'Сбросить прогресс?', danger: true });
      if (!ok) return;
      stopSpeech(st);
      st.hl = -1;
      goUnit(st, 0);
      st.meta.pos = 0; st.meta.pct = 0; putSoon(st.meta); flushSave();
      toast('Прогресс сброшен — книга начнётся сначала', 'good');
    } else if (k === 'shelf') {
      if (shelfM && document.body.contains(shelfM.el)) { st.m.tryClose(); } else { const ok = await st.m.tryClose(); if (ok) openShelf(); }
    } else if (k === 'del') {
      const ok = await UI.confirm(`Удалить книгу «${esc(st.meta.title)}» с этого устройства?<br><span class="small muted">Место, где вы остановились, тоже удалится. Карточки, сделанные из книги, останутся.</span>`, { danger: true, ok: 'Да, удалить', title: 'Удалить книгу?' });
      if (!ok) return;
      const id = st.meta.id, title = st.meta.title;
      st.forceClose = true;
      st.m.close();
      saveMeta = null; clearTimeout(saveT);
      recentForget(id);
      try { await DB.del(id); TEMP.delete(id); toast(`Книга «${title}» удалена с устройства`, 'good'); } catch (e) { toast('Не получилось удалить книгу — попробуйте ещё раз', 'warn'); }
      drawShelf();
    }
  }
  function showToc(st) {
    closePanel(st);
    const M = st.M;
    let items = M.units.filter(u => u.k === 'h' && u.i === M.bStart[u.b]).map(u => [u.i, u.text, u.p]);
    if (items.length < 2) items = M.secs.map((s, j) => [s.u0, `Часть ${j + 1}: ${M.units[s.u0].text.slice(0, 60)}${M.units[s.u0].text.length > 60 ? '…' : ''}`, M.units[s.u0].p]);
    const here = st.playing && st.hl >= 0 ? st.hl : st.cur;
    let curK = 0; items.forEach((x, k) => { if (x[0] <= here) curK = k; });
    const tm = UI.modal({
      title: '📑 Содержание', cls: 'narrow rd-toc-modal',
      body: `<div class="rd-toc">${items.map((x, k) => `<button type="button" class="rd-toc-i${k === curK ? ' on' : ''}" data-u="${x[0]}"><span>${esc(x[1])}</span><small>стр. ${x[2]}</small></button>`).join('')}</div>`,
    });
    tm.el.addEventListener('click', e => { const b = e.target.closest('[data-u]'); if (!b) return; tm.close(); goUnit(st, +b.dataset.u); });
    setTimeout(() => { const on = tm.el.querySelector('.rd-toc-i.on'); if (on) { on.scrollIntoView({ block: 'center' }); try { on.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }, 60);
  }

  /* ---------- 👆 tap a word: translation, 🔊, into the cards ---------- */
  function wordAt(x, y) {
    let node = null, off = 0;
    try {
      if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (r) { node = r.startContainer; off = r.startOffset; } }
      else if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (p) { node = p.offsetNode; off = p.offset; } }
    } catch (e) { return null; }
    if (!node || node.nodeType !== 3) return null;
    const t = node.nodeValue, isL = c => c && /[\p{L}\p{M}\p{N}'’-]/u.test(c);
    let a = off, b = off;
    while (a > 0 && isL(t[a - 1])) a--;
    while (b < t.length && isL(t[b])) b++;
    while (a < b && /['’-]/.test(t[a])) a++;
    while (b > a && /['’-]/.test(t[b - 1])) b--;
    const word = t.slice(a, b);
    if (!word || !/\p{L}/u.test(word)) return null;
    const range = document.createRange();
    range.setStart(node, a); range.setEnd(node, b);
    const rect = range.getBoundingClientRect();
    if (x < rect.left - 6 || x > rect.right + 6 || y < rect.top - 6 || y > rect.bottom + 6) return null;
    return { word, range, rect, span: node.parentElement && node.parentElement.closest('.rd-s') };
  }
  function onTextTap(st, e) {
    if (st.swiped && Date.now() - st.swiped < 400) return;
    const sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed && String(sel).trim()) return; // a selection: the app's own selection bubble answers
    const hid = e.target.closest && e.target.closest('.rd-tr');
    if (P.hideTr && hid && !hid.classList.contains('rd-shown')) { hid.classList.add('rd-shown'); return; }
    const w = wordAt(e.clientX, e.clientY);
    if (!w) { closePop(st); return; }
    showPop(st, w);
  }
  function closePop(st) {
    if (!st || !st.pop) return;
    st.pop.remove(); st.pop = null;
    try { if (window.CSS && CSS.highlights) CSS.highlights.delete('rd-word'); } catch (e) { /* ignore */ }
  }
  function sentenceOfSpan(st, span) {
    if (!span) return '';
    const u = st.M.units[+span.dataset.i];
    return u && !u.tr ? u.text.replace(/\s*\([^()]*[Ѐ-ӿ][^()]*\)/g, '').trim() : '';
  }
  function showPop(st, w) {
    closePop(st);
    const cyr = CYR.test(w.word);
    const i = w.span ? +w.span.dataset.i : st.cur;
    const sentence = sentenceOfSpan(st, w.span);
    const canCard = !cyr && window.Store && Store.addCard && Store.addDeck;
    const canTr = !!(window.Translators && Translators.translateMany);
    const el = document.createElement('div');
    el.className = 'rd-pop';
    el.dataset.skin = P.skin;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Перевод слова');
    el.innerHTML = `<div class="rd-pop-head"><b class="rd-pop-w" lang="${cyr ? cyrLang(String(sentence || w.word), st.M && st.M.uk) : 'nb'}">${esc(w.word)}</b>
        <button type="button" class="rd-ib" data-pa="say" aria-label="Произнести слово">${ICON.speaker}</button>
        <button type="button" class="rd-ib" data-pa="x" aria-label="Закрыть">✕</button></div>
      <div class="rd-pop-tr" aria-live="polite">${canTr || (!cyr && window.NoGloss) ? '<span class="spinner sm"></span> перевожу…' : '<span class="rd-muted">Перевод здесь недоступен</span>'}</div>
      <div class="rd-pop-row">
        ${canCard ? '<button type="button" class="btn sm primary" data-pa="card">➕ В карточки</button>' : ''}
        <button type="button" class="btn sm" data-pa="from">▶ Читать отсюда</button>
        ${canTr && sentence && !cyr ? '<button type="button" class="btn sm ghost" data-pa="sent">Перевод фразы</button>' : ''}
      </div>`;
    document.body.appendChild(el);
    st.pop = el;
    // a soft mark on the word itself (where the browser can)
    try { if (window.CSS && CSS.highlights && window.Highlight) CSS.highlights.set('rd-word', new Highlight(w.range)); } catch (e) { /* ignore */ }
    const place = () => {
      const r = w.rect, pw = Math.min(340, window.innerWidth - 16);
      el.style.width = pw + 'px';
      const ph = el.offsetHeight || 120;
      el.style.left = clamp(r.left + r.width / 2 - pw / 2, 8, window.innerWidth - pw - 8) + 'px';
      el.style.top = (r.bottom + 10 + ph < window.innerHeight - 8 ? r.bottom + 10 : Math.max(8, r.top - ph - 10)) + 'px';
    };
    place();
    const info = { word: w.word, tr: '', by: [], sentence, i };
    info.ready = (async () => {
      let tr = !cyr && window.NoGloss ? NoGloss.get(w.word) : null, by = [];
      if (!tr && canTr) {
        try { const r = await Translators.translateMany([w.word], cyr ? 'ru' : 'no', cyr ? 'no' : 'ru', { quiet: true }); tr = (r && r.out && r.out[0]) || ''; by = (r && r.by) || []; } catch (e) { tr = ''; }
      }
      info.tr = tr || ''; info.by = by || [];
    })();
    info.ready.then(() => {
      if (st.pop !== el) return;
      const box = el.querySelector('.rd-pop-tr');
      box.innerHTML = info.tr ? `<span class="rd-pop-t" lang="${cyr ? 'nb' : 'ru'}">${esc(info.tr)}</span>` : '<span class="rd-muted">Перевод не пришёл — проверьте интернет и нажмите на слово ещё раз</span>';
      place();
    });
    el.addEventListener('click', async e => {
      const b = e.target.closest('[data-pa]'); if (!b) return;
      e.stopPropagation();
      const a = b.dataset.pa;
      if (a === 'x') closePop(st);
      else if (a === 'say') { try { if (st.playing) pauseRead(st); TTS.speak(w.word, cyr ? cyrLang(String(sentence || w.word), st.M && st.M.uk) : 'no', { place: 'reader' }); } catch (err) { toast('Озвучка сейчас недоступна', 'warn'); } }
      else if (a === 'from') { closePop(st); st.cur = i; playFrom(st, i); }
      else if (a === 'card') { b.disabled = true; b.innerHTML = '<span class="spinner sm"></span> сохраняю…'; await info.ready; await addCard(st, info); closePop(st); }
      else if (a === 'sent') {
        b.disabled = true;
        const box = el.querySelector('.rd-pop-tr');
        try {
          const r = await Translators.translateMany([sentence], 'no', 'ru', { quiet: true });
          const t = (r && r.out && r.out[0]) || '';
          if (st.pop === el && t) { box.insertAdjacentHTML('beforeend', `<div class="rd-pop-s" lang="ru">${esc(t)}</div>`); place(); }
          else if (st.pop === el) toast('Перевод фразы не пришёл — проверьте интернет', 'warn');
        } catch (err) { toast('Перевод фразы не пришёл — проверьте интернет', 'warn'); }
      }
    });
  }
  async function addCard(st, info) {
    try {
      if (!info.tr) { toast('Перевода нет — карточку сделать не из чего', 'warn'); return; }
      const title = st.meta.title.slice(0, 60);
      const name = `📖 ${title}`;
      let deck = Store.decks().find(d => d.name === name);
      if (!deck) deck = Store.addDeck(name, `Слова из книги «${st.meta.title}» (Читалка)`);
      const norm = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      if (Store.cards(deck.id).some(c => norm(String(c.no).split('\n')[0]) === norm(info.word))) { toast(`«${info.word}» уже есть в колоде «${deck.name}»`, 'warn'); return; }
      let exRu = '';
      if (info.sentence && window.Study && Study.sentTr) { try { exRu = Study.sentTr(info.sentence) || ''; } catch (e) { /* none */ } }
      const label = `📖 «${st.meta.title}», стр. ${st.M.units[info.i] ? st.M.units[info.i].p : 1}`;
      const card = { no: info.word, ru: info.tr, example: info.sentence || '', exampleRu: exRu, description: label, tags: ['reader'] };
      try {
        if (window.Prov && Prov.entry) card.history = [Prov.entry('import', 'create', null, label)].concat(window.Translators && Translators.provKeys ? Translators.provKeys(info.by).map(k => Prov.entry(k, 'translate', null, 'перевод слова из книги')) : []);
        if (window.Translators && Translators.mtFlag) card.mtWarn = Translators.mtFlag(info.by);
      } catch (e) { /* plain card */ }
      Store.addCard(deck.id, card);
      if (Store.saveNow) await Store.saveNow();
      toast(`➕ «${info.word}» → ${deck.name}`, 'good', 2600);
    } catch (e) { toast('Карточку сохранить не получилось — попробуйте ещё раз', 'warn'); }
  }

  /* =====================================================================
   * 🔊 reading aloud: two voices through the app's TTS
   * ===================================================================== */
  function sysVoices() { try { return (window.speechSynthesis && speechSynthesis.getVoices()) || []; } catch (e) { return []; } }
  function voiceInfo(st) {
    // 🔊 Голоса: the Russian voice may be an audio voice (Edge, Azure, Piper…) or Google — not only the device's
    let cloud = false, gtr = false;
    try { const id = window.Voices ? Voices.chain('ru', '', 'reader')[0] || '' : ''; cloud = /^(piper|edge|azure|gcloud|eleven):/.test(id); gtr = id.startsWith('gtr:'); } catch (e) { cloud = false; }
    const vs = sysVoices();
    const ru = cloud || vs.some(v => /^ru([-_]|$)/i.test(v.lang));
    const needRu = st.M.units.some(u => u.cyr || u.tr);
    return { noRu: vs.length > 0 && !ru && needRu && !gtr, online: navigator.onLine !== false };
  }
  function anyToRead(st, from) {
    const M = st.M;
    for (let i = from; i < M.units.length && i < from + 4000; i++) if (wantedSegs(M.units[i], M.uk).length) return true;
    return false;
  }
  async function togglePlay(st) {
    if (st.playing) { pauseRead(st); return; }
    let from = st.cur;
    // the sentence the reader looks at (not one far away from an old session)
    if (st.hl >= 0 && st.hl >= st.s0 && Math.abs(st.hl - st.cur) < 40) from = st.hl;
    playFrom(st, from);
  }
  async function playFrom(st, i) {
    if (!window.TTS || !TTS.speak) { toast('Чтение вслух на этом устройстве недоступно', 'warn'); return; }
    // no Russian voice: say it once, gently, and offer the Norwegian text only
    const vi = voiceInfo(st);
    if (vi.noRu && P.read !== 'no' && !st.warnedRu) {
      st.warnedRu = true;
      const r = await UI.choose('🔊 Русского голоса нет',
        `<p>На этом устройстве не установлен русский голос. ${vi.online ? 'Перевод можно читать голосом из интернета, а можно слушать только норвежский текст.' : 'Без интернета перевод прочитать не получится — можно слушать только норвежский текст.'}</p><p class="small muted">Русский голос можно добавить в настройках телефона или компьютера (Универсальный доступ → Устная речь).</p>`,
        vi.online ? [{ label: 'Читать оба языка', value: 'both', cls: 'ghost' }, { label: 'Только норвежский', value: 'no', cls: 'primary' }] : [{ label: 'Только норвежский', value: 'no', cls: 'primary' }]);
      if (r == null) return;
      if (r === 'no') { P.read = 'no'; savePrefs(); redrawPanel(st); }
    }
    if (!anyToRead(st, i)) {
      toast(P.read === 'tr' ? 'Дальше в книге нет перевода — выберите «Оба языка» или «Только норвежский»' : P.read === 'no' ? 'Дальше в книге нет норвежского текста' : 'Дальше читать нечего', 'warn', 4000);
      return;
    }
    stopSpeech(st);
    // 🌙 «до конца главы»: the reader jumped to another chapter — the timer now means that chapter
    if (st.sleep && st.sleep.kind === 'ch' && (i >= st.sleep.endUnit || i < st.sleep.from)) { st.sleep = { kind: 'ch', from: i, endUnit: chapterEnd(st, i) }; sleepUi(st); }
    const tok = ++st.tok;
    st.playing = true;
    try { if (window.Listen && Listen.p && Listen.p.playing) Listen.pause(); } catch (e) { /* ignore */ }
    try { TTS.stop(); } catch (e) { /* ignore */ } // one voice at a time; also gives a fresh «generation» to watch
    st.gen = TTS._gen;
    msClaim(st);
    try { if (TTS.keepAlive) TTS.keepAlive(true); } catch (e) { /* ignore */ }
    playUi(st);
    const M = st.M;
    let k = clamp(i, 0, M.units.length - 1);
    while (tok === st.tok && k < M.units.length) {
      if (st.sleep && st.sleep.kind === 'ch' && k >= st.sleep.endUnit) { sleepStop(st); return; } // 🌙 «до конца главы»
      const u = M.units[k];
      const segs = wantedSegs(u, M.uk);
      if (!segs.length) { k++; continue; }
      st.again = false;
      mark(st, k);
      for (let rep = 0; rep < P.repeat && tok === st.tok; rep++) {
        for (let si = 0; si < segs.length; si++) {
          const s = segs[si];
          if (tok !== st.tok) return;
          prefetchNext(st, k, si, segs, rep); // ⏩ the next phrase's audio is made while this one is said
          await say(st, s, k);
          if (tok !== st.tok) return;
          if (TTS._gen !== st.gen) { externalStop(st); return; }
          if (sleepDue(st)) { sleepStop(st); return; } // 🌙 the timer ran out: the phrase is finished — stop here
          let ms = (PAUSES.find(x => x[0] === P.pause) || PAUSES[1])[2];
          ms += sleepFadePause(st); // the last minute: calmer, longer pauses — the voice fades out gently
          if (ms) await sleep(ms);
        }
        if (st.again) break;
      }
      if (tok !== st.tok) return;
      if (st.again) continue;
      k++;
    }
    if (tok === st.tok) {
      st.playing = false;
      st.tok++;
      playUi(st);
      msState('none');
      try { if (TTS.keepAlive) TTS.keepAlive(false); } catch (e) { /* ignore */ }
      if (k >= M.units.length) { toast('🎉 Книга дочитана до конца', 'good', 4000); if (st.sleep) { st.sleep = null; sleepUi(st); } }
    }
  }
  const ttsLang = s => (s.lang === 'no' ? 'no' : s.lang === 'uk' ? 'uk' : 'ru');
  /** ⏩ cloud voices: the phrase after this one is made now (js/tts.js TTS.prefetch) — no wait between phrases */
  function prefetchNext(st, k, si, segs, rep) {
    if (!window.TTS || !TTS.prefetch) return;
    try {
      let nx = segs[si + 1] || (rep + 1 < P.repeat ? segs[0] : null), nk = k;
      for (let j = k + 1; !nx && j < Math.min(st.M.units.length, k + 8); j++) { nx = wantedSegs(st.M.units[j], st.M.uk)[0]; nk = j; }
      if (nx) TTS.prefetch(nx.say, ttsLang(nx), Object.assign({ rate: rateNow(), place: 'reader' }, roleOpts(st, nk, ttsLang(nx))));
    } catch (e) { /* a hint only */ }
  }
  /** 🎭 who says each paragraph (js/voices.js Voices.dialogRoles: «– …» lines take turns, «Kari: …» by name; a
   *  heading and the narration are nobody's) + the speakers in the order of the book — the same voice for the same
   *  speaker wherever reading starts */
  function rolesOf(M) {
    if (M.roles) return M.roles;
    let keys = null;
    try { keys = window.Voices && Voices.dialogRoles ? Voices.dialogRoles(M.blocks.map(([k, t]) => (k === 'h' ? '# ' : '') + String(t || '').replace(/\s*\n\s*/g, ' '))) : null; } catch (e) { keys = null; }
    const roster = [];
    (keys || []).forEach(x => { if (x != null && !roster.includes(x)) roster.push(x); });
    return (M.roles = { keys: keys || [], roster });
  }
  /** the voice of the speaker of unit k: {} = the reader's voice; { voiceId } / { pitch } for the other speakers */
  function roleOpts(st, k, lang) {
    try {
      const u = st.M.units[k], R = rolesOf(st.M), who = u ? R.keys[u.b] : null;
      if (who == null || !window.Voices || !Voices.speakerOpts) return {};
      const o = Voices.speakerOpts(lang, who, R.roster.slice(), 'reader');
      delete o.place;
      return o;
    } catch (e) { return {}; }
  }
  async function say(st, s, k) {
    const rate = rateNow();
    const o = Object.assign({ keep: true, rate, place: 'reader' }, roleOpts(st, k, ttsLang(s)));
    // 🎤 «бегущая подсветка»: TTS says which word of «say» is being said; s.w knows where it is in the sentence
    if (karOn() && s.wok) o.onWord = (i, a, b, info) => karWord(st, k, s, i, info);
    // 🇺🇦 Ukrainian goes to TTS as 'uk': the device's Ukrainian voice, the cloud voice or the online Google voice —
    // never a Russian voice (with no Ukrainian voice TTS says so once and how to add one)
    try { await TTS.speak(s.say, ttsLang(s), o); } catch (e) { await sleep(300); }
  }
  /** someone else took the voice (another player, a 🔊 elsewhere): the reader pauses too */
  function watchdog(st) {
    if (st.playing && window.TTS && TTS._gen !== st.gen) externalStop(st);
    sleepTick(st);
  }
  function externalStop(st) {
    st.tok++; st.playing = false;
    karClear(st);
    if (st.hl >= 0) st.cur = st.hl;
    playUi(st); msState('paused'); savePos(st);
  }
  function stopSpeech(st, release) {
    const was = st.playing;
    st.tok++;
    st.playing = false;
    karClear(st);
    if (was && st.hl >= 0) st.cur = st.hl; // the place to continue from is the sentence that was being read
    if (was || release) { try { TTS.stop(); } catch (e) { /* ignore */ } }
    if (!release) playUi(st);
  }
  function pauseRead(st) {
    stopSpeech(st);
    if (st.hl >= 0) st.cur = st.hl;
    msState('paused');
    savePos(st);
  }
  function stepUnit(st, d) {
    const M = st.M;
    let k = (st.hl >= 0 ? st.hl : st.cur) + d;
    while (k >= 0 && k < M.units.length && !wantedSegs(M.units[k], M.uk).length) k += d;
    k = clamp(k, 0, M.units.length - 1);
    st.userNav = 0;
    if (st.playing) { playFrom(st, k); return; }
    mark(st, k);
    st.cur = k;
    savePos(st);
  }
  function again(st) {
    const k = st.hl >= 0 ? st.hl : st.cur;
    closePanel(st);
    playFrom(st, k);
  }
  /** highlight the sentence being read and keep it in view (page turns, scrolling) */
  function mark(st, k) {
    if (!st.kw || st.kw.k !== k) karClear(st);
    const old = st.hl >= 0 && spanOf(st, st.hl);
    if (old) old.classList.remove('rd-cur');
    st.hl = k;
    if (!st.playing) st.cur = k;
    const recent = st.userNav && Date.now() - st.userNav < 5000;
    if (!recent) ensureShown(st, k);
    const el = spanOf(st, k);
    if (el) {
      el.classList.add('rd-cur');
      if (!recent) {
        if (P.mode === 'page') { const pg = pageOfUnit(st, k); if (pg !== st.page) goPage(st, pg); }
        else {
          const r = el.getBoundingClientRect(), vr = st.view.getBoundingClientRect();
          if (r.top < vr.top + 30 || r.bottom > vr.bottom - 50) scrollToUnit(st, k, true);
        }
      }
    }
    progressUi(st);
    msMeta(st, k);
    savePos(st);
  }
  function playUi(st) {
    st.m.$$('[data-a="play"]').forEach(b => {
      b.innerHTML = st.playing ? ICON.pause : ICON.play;
      b.setAttribute('aria-label', st.playing ? 'Пауза' : 'Читать вслух');
      b.title = st.playing ? 'Пауза (пробел)' : 'Читать вслух (пробел)';
      b.classList.toggle('on', st.playing);
    });
    st.root.classList.toggle('rd-reading', st.playing);
  }

  /* ---------- 🎤 «бегущая подсветка слов»: the word being said, inside the sentence being read ----------
   * TTS.speak tells which word is said now (the voice's own word boundaries, or an estimate by syllables and the
   * voice's measured speed, or the audio clip's clock — js/tts.js). The word gets a soft mark that glides under it,
   * the words already said in this sentence get calmer. CSS Custom Highlight API ('rd-say' / 'rd-done' — the text is
   * not touched, so tapping a word, selecting and the layout stay as they are), else short-lived spans
   * (js/tts.js Karaoke). Reduced motion: the mark jumps from word to word. Nothing works → the sentence highlight only. */
  let KAR = null;
  function kar() {
    if (KAR || !window.TTS || !TTS.Karaoke) return KAR;
    try { KAR = new TTS.Karaoke({ name: 'rd', cls: 'rd-kmark', host: el => (el.matches('[data-lis-now]') ? el.parentElement : el.closest('.rd-flow')) }); } catch (e) { KAR = null; }
    return KAR;
  }
  const karOn = () => P.kar !== false && !!(window.TTS && TTS.wordsOf && TTS.Karaoke);
  function karClear(st) {
    if (st) st.kw = null;
    if (KAR) try { KAR.clear(); } catch (e) { /* ignore */ }
  }
  function karWord(st, k, s, i, info) {
    if (R !== st || !st.playing || st.hl !== k || !karOn()) return;
    st.kw = { k, s, i: Math.max(0, Math.min(i, s.w.length)) };
    karPaint(st, true);
  }
  /** paint the current word (again: after a new layout, a size change, the listening mode) */
  function karPaint(st, follow) {
    const kw = st.kw, K = kar();
    if (!kw || !K) return;
    try {
      const w = kw.s.w, cur = kw.i < w.length ? w[kw.i] : null;
      const done = cur ? cur[0] : (w.length ? w[w.length - 1][1] : 0);
      const els = [];
      const sp = spanOf(st, kw.k);
      if (sp) els.push(sp);
      const now = st.lisEl && !st.lisEl.hidden && st.lisEl.querySelector('[data-lis-now]');
      if (now && now.dataset.i === String(kw.k)) els.push(now);
      K.show(els.map(el => ({ el, cur, done })));
      if (follow && cur && sp && !st.lmode) karFollow(st, sp, cur);
    } catch (e) { karClear(st); } // never an error on the screen: the sentence highlight stays
  }
  /** the word runs onto the next page / below the screen: the page turns, the ribbon scrolls (not right after the reader's own turn) */
  function karFollow(st, sp, cur) {
    if (st.userNav && Date.now() - st.userNav < 5000) return;
    const node = sp.firstChild;
    let r = null;
    if (node && node.nodeType === 3 && sp.childNodes.length === 1) {
      const rg = document.createRange(); rg.setStart(node, cur[0]); rg.setEnd(node, cur[1]);
      r = rg.getClientRects()[0] || null;
    } else { const w = sp.querySelector('.rd-w-say'); r = w && w.getClientRects()[0]; }
    if (!r) return;
    if (P.mode === 'page') {
      const fr = st.flow.getBoundingClientRect();
      const pg = clamp(Math.floor((r.left - fr.left + 2) / st.step), 0, st.nPages - 1);
      if (pg !== st.page) goPage(st, pg);
    } else {
      const v = st.view, vr = v.getBoundingClientRect();
      if (r.bottom > vr.bottom - 40 || r.top < vr.top + 8) v.scrollTo({ top: Math.max(0, v.scrollTop + r.top - vr.top - v.clientHeight * 0.3), behavior: RM() ? 'auto' : 'smooth' });
    }
  }

  /* =====================================================================
   * 🎧 listening mode («аудиокнига»): big buttons, the phrase being read, speed, what to read, 🌙 sleep timer
   * ===================================================================== */
  function lisHtml(st) {
    return `<div class="rd-lis-top">
        <div class="rd-lis-cover" aria-hidden="true">${coverHtml(st.meta)}</div>
        <div class="rd-lis-meta"><b class="rd-lis-t">${esc(st.meta.title)}</b>${st.meta.author ? `<span class="rd-lis-a">${esc(st.meta.author)}</span>` : ''}
          <span class="rd-lis-pg" data-lis-pg></span><div class="rd-bar" aria-hidden="true"><i data-lis-bar></i></div></div>
      </div>
      <p class="rd-lis-now" data-lis-now aria-live="polite" lang="nb"></p>
      <div class="rd-lis-ctl" role="group" aria-label="Чтение вслух">
        <button type="button" class="rd-ctl rd-lis-b" data-a="sprev" aria-label="Предыдущее предложение" title="Предыдущее предложение">${ICON.prevS}</button>
        <button type="button" class="rd-ctl rd-play rd-lis-play" data-a="play" aria-label="Читать вслух" title="Читать вслух (пробел)">${ICON.play}</button>
        <button type="button" class="rd-ctl rd-lis-b" data-a="snext" aria-label="Следующее предложение" title="Следующее предложение">${ICON.nextS}</button>
      </div>
      <div class="rd-lis-opts" data-lis-opts></div>
      <div class="rd-lis-foot">
        <button type="button" class="btn ghost" data-a="again" title="Прочитать текущую фразу ещё раз">${ICON.again} Повторить фразу</button>
        <button type="button" class="btn ghost" data-a="lmode-off" title="Вернуться к тексту книги — чтение не прерывается">📖 Показать текст книги</button>
      </div>`;
  }
  function lisOptsHtml(st) {
    return `<div class="rd-row"><span class="rd-lbl">Скорость</span>${seg('speed', SPEEDS, P.speed)}</div>
      <div class="rd-row"><span class="rd-lbl">Читать</span>${seg('read', READS, P.read)}</div>
      <div class="rd-row"><span class="rd-lbl">🌙 Таймер сна</span>${sleepSeg(st)}<span class="rd-sleep-st" data-sleep-left aria-live="polite">${esc(sleepText(st))}</span></div>`;
  }
  function setLmode(st, on, autoplay) {
    st.lmode = !!on;
    st.root.toggleAttribute('data-lmode', st.lmode);
    if (st.lmode) {
      closePop(st); closePanel(st);
      if (!st.lisEl) {
        const el = document.createElement('div');
        el.className = 'rd-lis'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Режим прослушивания');
        el.innerHTML = lisHtml(st);
        st.root.appendChild(el);
        st.lisEl = el;
      }
      st.lisEl.hidden = false;
      lisUi(st, true); playUi(st);
      setTimeout(() => { const b = st.lisEl && st.lisEl.querySelector('.rd-lis-play'); if (b) try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 60);
      if (autoplay && !st.playing) togglePlay(st);
    } else {
      if (st.lisEl) st.lisEl.hidden = true;
      // back to the text: the page with the phrase being read
      const i = st.playing && st.hl >= 0 ? st.hl : st.cur;
      setTimeout(() => { if (R === st) { relayout(st); ensureShown(st, i); if (P.mode === 'page') goPage(st, pageOfUnit(st, i), false); else scrollToUnit(st, i, false); progressUi(st); } }, 30);
    }
  }
  function lisUi(st, full) {
    const el = st.lisEl; if (!el || el.hidden) return;
    const M = st.M, i = clamp(st.playing && st.hl >= 0 ? st.hl : st.cur, 0, M.units.length - 1), u = M.units[i];
    const pct = M.units.length > 1 ? Math.round(i / (M.units.length - 1) * 100) : 100;
    const pg = el.querySelector('[data-lis-pg]'); if (pg) pg.textContent = `стр. ${u.p} из ${M.pages} · ${pct}%`;
    const bar = el.querySelector('[data-lis-bar]'); if (bar) bar.style.width = pct + '%';
    const now = el.querySelector('[data-lis-now]');
    if (now && now.dataset.i !== String(i)) { now.dataset.i = String(i); now.textContent = u.text; now.lang = u.cyr || u.tr ? 'ru' : 'nb'; if (st.kw) karPaint(st, false); }
    if (full) { const o = el.querySelector('[data-lis-opts]'); if (o) o.innerHTML = lisOptsHtml(st); }
  }

  /* ---------- 🌙 sleep timer: 10–60 min or «до конца главы»; the last minute reads calmer, then it stops after the phrase ---------- */
  const SLEEPS = [['off', 'Выкл'], ['10', '10 мин'], ['15', '15 мин'], ['30', '30 мин'], ['45', '45 мин'], ['60', '60 мин'], ['ch', 'До конца главы']];
  const FADE_MS = 60000;
  const nowMs = () => Date.now();
  const mmss = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  /** the first unit of the next chapter (headings as in «Содержание»; no headings → the next part) */
  function chapterEnd(st, from) {
    const M = st.M;
    let heads = M.units.filter(u => u.k === 'h' && u.i === M.bStart[u.b]).map(u => u.i);
    if (heads.length < 2) heads = M.secs.map(x => x.u0);
    const nx = heads.find(h => h > from);
    return nx == null ? M.units.length : nx;
  }
  const sleepVal = st => (!st.sleep ? 'off' : st.sleep.kind === 'ch' ? 'ch' : String(st.sleep.min));
  function sleepSeg(st) {
    const cur = sleepVal(st);
    return `<div class="rd-seg rd-sleep-seg" role="group" aria-label="Таймер сна">${SLEEPS.map(([v, l]) => `<button type="button" data-sleep="${v}" aria-pressed="${v === cur}" class="${v === cur ? 'on' : ''}" title="${v === 'off' ? 'Выключить таймер сна' : v === 'ch' ? 'Остановить чтение в конце этой главы' : `Остановить чтение через ${l}`}">${l}</button>`).join('')}</div>`;
  }
  function sleepText(st) {
    const sl = st.sleep;
    if (!sl) return 'Чтение не остановится само. Выберите время — и можно засыпать.';
    if (sl.kind === 'ch') {
      const M = st.M, here = clamp(st.playing && st.hl >= 0 ? st.hl : st.cur, 0, M.units.length - 1);
      const endP = sl.endUnit >= M.units.length ? M.pages : M.units[sl.endUnit].p;
      const left = Math.max(0, endP - M.units[here].p);
      return sl.endUnit >= M.units.length ? `🌙 Остановлю в конце книги${left ? ` — ещё ${left} ${plural(left, ['страница', 'страницы', 'страниц'])}` : ''}`
        : `🌙 Остановлю в конце главы${left ? ` — ещё примерно ${left} ${plural(left, ['страница', 'страницы', 'страниц'])}` : ''}`;
    }
    const left = sl.end - nowMs();
    return left > 0 ? `🌙 Осталось ${mmss(left)}${left <= FADE_MS ? ' — читаю тише и медленнее, скоро остановлюсь' : ''}` : '🌙 Дочитываю фразу и останавливаюсь…';
  }
  function setSleep(st, v) {
    if (v === 'off') { st.sleep = null; st.sleepEnding = 0; toast('🌙 Таймер сна выключен', '', 2200); }
    else if (v === 'ch') {
      const here = st.playing && st.hl >= 0 ? st.hl : st.cur;
      st.sleep = { kind: 'ch', from: here, endUnit: chapterEnd(st, here) };
      toast(st.sleep.endUnit >= st.M.units.length ? '🌙 Чтение остановится в конце книги' : '🌙 Чтение остановится в конце главы', 'good', 2600);
    } else {
      const min = clamp(parseInt(v, 10) || 30, 1, 180);
      st.sleep = { kind: 'min', min, end: nowMs() + min * 60000 };
      st.sleepEnding = 0;
      toast(`🌙 Таймер сна: ${min} мин${st.playing ? '' : ' — нажмите ▶, чтобы слушать'}`, 'good', 2600);
    }
    sleepUi(st);
  }
  const sleepDue = st => !!(st.sleep && st.sleep.kind === 'min' && nowMs() >= st.sleep.end);
  /** extra pause between phrases in the last minute (up to +1.6 s): the reading winds down instead of cutting off */
  function sleepFadePause(st) {
    if (!st.sleep || st.sleep.kind !== 'min') return 0;
    const left = st.sleep.end - nowMs();
    return left > 0 && left < FADE_MS ? Math.round(400 + (1 - left / FADE_MS) * 1200) : 0;
  }
  function sleepStop(st) {
    st.sleep = null; st.sleepEnding = 0;
    if (st.playing) pauseRead(st);
    sleepUi(st);
    toast('🌙 Таймер сна: чтение остановлено. Место сохранено — ▶ продолжит с этой фразы.', 'good', 7000);
  }
  function sleepTick(st) {
    if (!st.sleep) return;
    if (st.sleep.kind === 'min' && nowMs() >= st.sleep.end) {
      if (!st.playing) { st.sleep = null; sleepUi(st); return; } // already quiet — nothing to stop
      // the phrase is being finished; a very long one (or a voice that hangs) is stopped anyway after 12 s
      if (!st.sleepEnding) st.sleepEnding = nowMs();
      else if (nowMs() - st.sleepEnding > 12000) { sleepStop(st); return; }
    }
    sleepUi(st, true);
  }
  function sleepUi(st, textOnly) {
    const t = sleepText(st);
    st.m.$$('[data-sleep-left]').forEach(x => { if (x.textContent !== t) x.textContent = t; });
    st.m.$$('[data-a="listen"]').forEach(b => { b.classList.toggle('rd-sleeping', !!st.sleep); b.title = st.sleep ? `Настройки чтения вслух · ${t}` : 'Настройки чтения вслух и таймер сна'; });
    if (textOnly) return;
    const cur = sleepVal(st);
    st.m.$$('[data-sleep]').forEach(b => { const on = b.dataset.sleep === cur; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  }

  /* ---------- lock screen / headphones (Media Session) ---------- */
  const hasMS = () => 'mediaSession' in navigator;
  function msClaim(st) {
    if (!hasMS()) return;
    const ms = navigator.mediaSession;
    const set = (a, f) => { try { ms.setActionHandler(a, f); } catch (e) { /* not supported */ } };
    if (window.TTS) TTS.msOwner = 'reader';
    set('play', () => { if (R === st && !st.playing) playFrom(st, st.hl >= 0 ? st.hl : st.cur); });
    set('pause', () => { if (R === st && st.playing) pauseRead(st); });
    set('stop', () => { if (R === st) pauseRead(st); });
    set('nexttrack', () => { if (R === st) stepUnit(st, 1); });
    set('previoustrack', () => { if (R === st) stepUnit(st, -1); });
    ['seekto', 'seekbackward', 'seekforward'].forEach(a => set(a, null));
    msState('playing');
  }
  function msMeta(st, k) {
    if (!hasMS() || !window.TTS || TTS.msOwner !== 'reader') return;
    try {
      const u = st.M.units[k];
      const art = st.meta.cover ? [{ src: st.meta.cover, sizes: '420x420', type: st.meta.cover.slice(5, st.meta.cover.indexOf(';')) || 'image/jpeg' }]
        : [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }];
      navigator.mediaSession.metadata = new MediaMetadata({ title: u.text.slice(0, 120), artist: st.meta.title, album: `Norsk Kort · Читалка · стр. ${u.p} из ${st.M.pages}`, artwork: art });
      navigator.mediaSession.playbackState = st.playing ? 'playing' : 'paused';
    } catch (e) { /* old browser */ }
  }
  function msState(s) { if (hasMS() && window.TTS && TTS.msOwner === 'reader') try { navigator.mediaSession.playbackState = s; } catch (e) { /* ignore */ } }
  function msRelease() {
    if (!hasMS() || !window.TTS || TTS.msOwner !== 'reader') return;
    TTS.msOwner = '';
    const ms = navigator.mediaSession;
    ['play', 'pause', 'stop', 'previoustrack', 'nexttrack', 'seekto', 'seekbackward', 'seekforward'].forEach(a => { try { ms.setActionHandler(a, null); } catch (e) { /* ignore */ } });
    try { ms.metadata = null; ms.playbackState = 'none'; } catch (e) { /* ignore */ }
    try { if (window.Listen && Listen.p && Listen.claimSession) Listen.claimSession(); } catch (e) { /* ignore */ }
  }

  window.Reader = {
    ACCEPT,
    open: () => openShelf(),
    /** opts: { cont: true } — straight to the saved place (no question); { listen: true } — the listening mode, reading starts */
    openBook: (id, opts) => openBook(id, opts),
    importFiles: (files, extra, o) => importFiles(files, extra, o),
    /* ---- for the library (js/bookshelf.js) and the home strip — the shelf's own logic, no copies ---- */
    /** every book on this device (IndexedDB + the ones kept only for this visit), the last opened first */
    async list() {
      let a = [];
      try { a = (await DB.list()) || []; } catch (e) { a = []; }
      TEMP.forEach(x => { if (!a.some(b => b.id === x.meta.id)) a.push(x.meta); });
      return a.sort((x, y) => (y.opened || y.added || 0) - (x.opened || x.added || 0));
    },
    /** recently read (sync, localStorage): [{ id, title, author, page, pages, pct, at }] newest first */
    recent: () => recentAll(),
    coverHtml: b => coverHtml(b || {}),
    bookCardHtml: b => bookCard(b),
    ago: ts => ago(ts),
    /** a click inside a box with the shelf's [data-rd] buttons (open, del, mine-add, mine-all, sample) — same as on the shelf */
    shelfClick: (e, o) => onShelfClick(e, Object.assign({ noShelf: true }, o || {})),
    /** «📘 Мои учебники» (private/reader/index.json, read now — it may have grown) drawn into a box */
    async drawMine(box) { let list = []; try { list = await this.list(); } catch (e) { /* none */ } return drawMine(list, box); },
    mineAvailable: () => mineAvailable(),
    isOpen: () => !!R,
    /** 🎨 the reading look shared with the 📖 book window (js/bookview.js «Aa»): the highlight colour P.hl (PALETTE),
     *  the running word highlight P.kar — one choice for the reader and the books, kept on this device */
    look: {
      PALETTE,
      get: k => P[k],
      set(k, v) {
        P[k] = v; savePrefs();
        try { if (R) applyLook(R); } catch (e) { /* the reader redraws on its next open */ }
        document.dispatchEvent(new CustomEvent('reader-look', { detail: { k } }));
      },
    },
    /** for tests and help: the text logic without the screen */
    _t: { splitSentences, paraUnits, segsOf, buildModel, textBlocks, normBlocks, cyrLang, scriptOf, wantedSegs, P: () => P },
  };
})();
