/* ============ 📘 My textbook: your own book → read with translation, listen, new words → cards, self-check ============
 * The book stays ONLY on this device (IndexedDB «norsk-kort-books»): it is never uploaded or shared.
 * Formats: PDF (text layer; scanned pages → OCR), EPUB, DOCX, ODT, FB2, HTML, TXT/MD, RTF, photos/scans of pages
 * (JPG, PNG, WEBP, GIF, BMP — several at once = one book), CBZ/ZIP with page images. MOBI/AZW/DjVu/DOC/Pages: a hint
 * how to convert them (they are closed or binary formats).
 * Reading: page by page, every sentence with 🔊 and the same views as the cards: as is / sentence (translation) /
 * word (translation). 🆕 New words of a page or pages → base form (Ordbøkene) → translation → cards with the
 * sentence from the book and «📘 book, p. N». 📋 Word lists in the book → cards. ✍️ Self-check (AI). 🎧 Listen.
 */
(function () {
  const DBN = 'norsk-kort-books';
  const IMG = /\.(jpe?g|png|webp|gif|bmp|tiff?|avif)$/i;
  const CLOSED = { mobi: 'MOBI', azw: 'Kindle AZW', azw3: 'Kindle AZW3', kfx: 'Kindle KFX', djvu: 'DjVu', djv: 'DjVu', doc: 'Word 97–2003 (.doc)', pages: 'Apple Pages', lit: 'Microsoft LIT', ibooks: 'iBooks', key: 'Keynote' };
  const ACCEPT = '.pdf,.epub,.docx,.odt,.fb2,.html,.htm,.xhtml,.txt,.md,.rtf,.cbz,.zip,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tif,.tiff,.avif,.mobi,.azw,.azw3,.kfx,.djvu,.djv,.doc,.pages,image/*,application/pdf';

  /* ---------- storage: the book itself only on this device ---------- */
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DBN, 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('books')) r.result.createObjectStore('books', { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function store(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction('books', mode); const s = t.objectStore('books');
      let out; const rq = fn(s); if (rq) rq.onsuccess = () => { out = rq.result; };
      // Safari Private Browsing cannot keep files (Blob) in IndexedDB: the error is null there — never reject with null
      const fail = () => rej(t.error || new Error('Браузер не сохранил книгу (в приватном режиме Safari файлы не сохраняются)'));
      t.oncomplete = () => res(out); t.onerror = fail; t.onabort = fail;
    });
  }
  const all = () => store('readonly', s => s.getAll());
  const get = id => store('readonly', s => s.get(id));
  const put = rec => store('readwrite', s => s.put(rec));
  const del = id => store('readwrite', s => s.delete(id));
  // one pending save per book (a single shared timer dropped the progress of the book you just left)
  const pending = new Map();
  const saveSoon = rec => { const o = pending.get(rec.id); if (o) clearTimeout(o.t); pending.set(rec.id, { rec, t: setTimeout(() => { pending.delete(rec.id); put(rec).catch(() => {}); }, 800) }); };
  const flush = () => Promise.all([...pending.values()].map(o => { clearTimeout(o.t); pending.delete(o.rec.id); return put(o.rec).catch(() => {}); }));
  const unsave = id => { const o = pending.get(id); if (o) { clearTimeout(o.t); pending.delete(id); } };

  /* ---------- text helpers ---------- */
  const letters = t => (String(t || '').match(/\p{L}/gu) || []).length;
  function decodeEntities(s) { const ta = document.createElement('textarea'); ta.innerHTML = s; return ta.value; }
  function htmlText(html) {
    const d = new DOMParser().parseFromString(String(html).replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/tr|\/blockquote|\/section|\/title|\/dd|\/dt)\b[^>]*>/gi, '$&\n'), 'text/html');
    d.querySelectorAll('script,style,noscript,svg').forEach(x => x.remove());
    if (window.PageText) PageText.stripDom(d.body || d.documentElement); // EPUB page-break markers (<span epub:type="pagebreak">, .pagenum)
    return ((d.body || d.documentElement).textContent || '').replace(/[ \t ]+/g, ' ').replace(/ *\n[ \n]*/g, '\n').trim();
  }
  /** long text → «pages» of about 2000 characters, cut between paragraphs */
  function chunk(text, size = 2000) {
    const out = []; let cur = '';
    String(text || '').split('\n').forEach(p => {
      p = p.trim(); if (!p) return;
      if (cur && cur.length + p.length > size) { out.push(cur); cur = ''; }
      cur += (cur ? '\n' : '') + p;
    });
    if (cur) out.push(cur);
    return out.length ? out : [''];
  }
  async function readText(file) {
    const buf = await file.arrayBuffer();
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { /* not UTF-8 */ }
    const w1251 = new TextDecoder('windows-1251').decode(buf);
    // Russian text in an old Windows encoding is mostly Cyrillic letters; Norwegian (æøå read as жше) only a few
    return (w1251.match(/[а-яё]/gi) || []).length > letters(w1251) * 0.5 ? w1251 : new TextDecoder('windows-1252').decode(buf);
  }
  function rtfText(rtf) {
    // drop the header groups (font / colour tables, styles, info, \* destinations) with everything nested in them
    let s = String(rtf);
    for (let k = s.search(/\{\\(?:\*|(?:fonttbl|colortbl|stylesheet|info|listtable|listoverridetable|pict)\b)/); k >= 0; k = s.search(/\{\\(?:\*|(?:fonttbl|colortbl|stylesheet|info|listtable|listoverridetable|pict)\b)/)) {
      let d = 0, j = k;
      for (; j < s.length; j++) { if (s[j] === '\\') { j++; continue; } if (s[j] === '{') d++; else if (s[j] === '}' && --d === 0) break; }
      s = s.slice(0, k) + s.slice(j + 1);
    }
    return s.replace(/\\par[d]?\b/g, '\n').replace(/\\line\b/g, '\n')
      .replace(/\\'([0-9a-f]{2})/gi, (m, h) => new TextDecoder('windows-1252').decode(new Uint8Array([parseInt(h, 16)])))
      .replace(/\\u(-?\d+)\??/g, (m, n) => String.fromCharCode(+n < 0 ? +n + 65536 : +n))
      .replace(/\\[a-z]+-?\d* ?/gi, '').replace(/[{}]/g, '').replace(/\n\s*\n+/g, '\n').trim();
  }
  const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

  /* ---------- import: every format → a book record ---------- */
  async function importFiles(files) {
    files = [...files];
    if (!files.length) return null;
    // several pictures at once = the pages of one book (photos of a textbook)
    if (files.length > 1 && files.every(f => IMG.test(f.name) || /^image\//.test(f.type))) {
      files.sort((a, b) => natural(a.name, b.name));
      const copies = [];
      for (const f of files) copies.push(new Blob([await f.arrayBuffer()], { type: f.type || 'image/jpeg' })); // full copies, not links to files
      return makeRec(files[0].name.replace(/\.[^.]+$/, '').replace(/[-_ ]*\d+$/, '') || 'Фото страниц', 'images', files.reduce((n, f) => n + f.size, 0), { kind: 'images', images: copies, n: copies.length });
    }
    const f = files[0];
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    const title = f.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
    if (CLOSED[ext]) throw new Error(`${CLOSED[ext]} — закрытый формат, браузер его не читает. Бесплатно переведите книгу в EPUB или PDF программой Calibre (calibre-ebook.com) — или сфотографируйте страницы и загрузите фото`);
    if (ext === 'pdf' || f.type === 'application/pdf') {
      // a full copy of the file is kept (Safari otherwise keeps only a link to the file on disk — when the file is
      // moved / renamed / updated by Telegram, the book is lost: «The object can not be found here»)
      const buf = await f.arrayBuffer();
      const copy = new Blob([buf], { type: 'application/pdf' });
      const pdf = await (await U.lib.pdf()).getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
      let t = title;
      try { const md = await pdf.getMetadata(); const mt = String((md && md.info && md.info.Title) || '').trim();
        // a real title — not «about:blank», a URL, «Untitled», «Microsoft Word - x.docx» or a file name
        if (mt.length > 2 && !/^(about:|https?:|file:|blob:|untitled|unbenannt|без имени|microsoft word)|\.\w{2,4}$/i.test(mt)) t = mt; } catch (e) { /* no metadata */ }
      return makeRec(t, 'pdf', f.size, { kind: 'pdf', blob: copy, n: pdf.numPages });
    }
    if (IMG.test(f.name) || /^image\//.test(f.type)) return makeRec(title, 'image', f.size, { kind: 'images', images: [new Blob([await f.arrayBuffer()], { type: f.type || 'image/jpeg' })], n: 1 });
    if (ext === 'cbz' || ext === 'zip') {
      const zip = await (await U.lib.jszip()).loadAsync(f);
      const names = Object.keys(zip.files).filter(n => IMG.test(n) && !zip.files[n].dir && !/__MACOSX/.test(n)).sort(natural);
      if (!names.length) {
        // a zip with one book inside (pdf/epub/…) — open that one
        const inner = Object.keys(zip.files).find(n => /\.(pdf|epub|docx|odt|fb2|txt|html?)$/i.test(n) && !/__MACOSX/.test(n));
        if (!inner) throw new Error('В архиве нет страниц-картинок или книги');
        const blob = await zip.file(inner).async('blob');
        return importFiles([new File([blob], inner.split('/').pop(), { type: /\.pdf$/i.test(inner) ? 'application/pdf' : '' })]);
      }
      const images = [];
      for (const n of names) images.push(new File([await zip.file(n).async('blob')], n.split('/').pop()));
      return makeRec(title, ext, f.size, { kind: 'images', images, n: images.length });
    }
    let text = '';
    let t = title;
    if (ext === 'epub') {
      const zip = await (await U.lib.jszip()).loadAsync(f);
      const cont = await zip.file('META-INF/container.xml').async('text');
      const opfPath = (/full-path="([^"]+)"/.exec(cont) || [])[1];
      if (!opfPath) throw new Error('EPUB повреждён: нет описания книги');
      const opf = new DOMParser().parseFromString(await zip.file(opfPath).async('text'), 'application/xml');
      const base = opfPath.includes('/') ? opfPath.replace(/[^/]+$/, '') : '';
      const tt = opf.getElementsByTagNameNS('*', 'title')[0]; if (tt && tt.textContent.trim()) t = tt.textContent.trim();
      const man = {}; [...opf.getElementsByTagNameNS('*', 'item')].forEach(i => { man[i.getAttribute('id')] = i.getAttribute('href'); });
      const spine = [...opf.getElementsByTagNameNS('*', 'itemref')].map(i => man[i.getAttribute('idref')]).filter(Boolean);
      const norm = p => { const parts = []; p.split('/').forEach(s => { if (s === '..') parts.pop(); else if (s && s !== '.') parts.push(s); }); return parts.join('/'); };
      const parts = [];
      for (const href of spine) {
        const file = zip.file(norm(base + decodeURIComponent(href.split('#')[0])));
        if (file) parts.push(htmlText(await file.async('text')));
      }
      text = parts.join('\n');
    } else if (ext === 'docx') {
      const zip = await (await U.lib.jszip()).loadAsync(f);
      const xml = await zip.file('word/document.xml').async('text');
      text = decodeEntities(xml.replace(/<w:tab\/>/g, ' ').replace(/<w:br[^>]*\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, ''));
    } else if (ext === 'odt') {
      const zip = await (await U.lib.jszip()).loadAsync(f);
      const xml = await zip.file('content.xml').async('text');
      text = decodeEntities(xml.replace(/<text:s[^>]*\/>/g, ' ').replace(/<text:tab\/>/g, ' ').replace(/<text:line-break\/>/g, '\n').replace(/<\/text:(p|h)>/g, '\n').replace(/<[^>]+>/g, ''));
    } else if (ext === 'fb2') {
      const raw = await readText(f);
      const d = new DOMParser().parseFromString(raw.replace(/<binary[\s\S]*?<\/binary>/g, ''), 'application/xml');
      const bt = d.getElementsByTagName('book-title')[0]; if (bt && bt.textContent.trim()) t = bt.textContent.trim();
      text = [...d.getElementsByTagName('body')].map(b => [...b.querySelectorAll('subtitle, p, v')].map(p => p.textContent.trim()).join('\n')).join('\n');
    } else if (/^(html?|xhtml)$/.test(ext)) {
      text = htmlText(await readText(f));
    } else if (ext === 'rtf') {
      text = rtfText(await readText(f));
    } else if (/^(txt|md|text)$/.test(ext) || /^text\//.test(f.type)) {
      text = (await readText(f)).replace(/\r\n?/g, '\n');
    } else {
      throw new Error(`Формат .${ext} не поддерживается. Подходят: PDF, EPUB, DOCX, ODT, FB2, HTML, TXT, RTF, фото страниц (JPG/PNG), CBZ/ZIP`);
    }
    // 📄 page breaks («\f»), page numbers («- 6 -», «Side 6 av 40», 1-2-3 runs), separators, words cut at line ends (util.js)
    if (window.PageText) { try { text = PageText.cleanText(text); } catch (e) { /* as it is */ } }
    if (letters(text) < 20) throw new Error('В файле не нашлось текста');
    const pages = chunk(text);
    const rec = makeRec(t, ext, f.size, { kind: 'text', n: pages.length });
    pages.forEach((p, i) => { rec.text[i + 1] = p; });
    return rec;
  }
  function makeRec(title, ext, size, extra) {
    return Object.assign({ id: U.uid(), title, ext, size, added: Date.now(), last: 1, read: [], ocr: [], text: {}, cards: 0 }, extra);
  }

  /* ---------- pages: text (PDF text layer → OCR for scans), picture of the page ---------- */
  const docs = new Map(); // book id → pdf.js document
  async function pdfDoc(rec) {
    if (!docs.has(rec.id)) {
      docs.set(rec.id, (async () => {
        let buf;
        // the file behind the book is gone (Safari kept only a link to it, and it was moved / renamed / updated)
        try { buf = await rec.blob.arrayBuffer(); } catch (e) { throw Object.assign(new Error('файл книги больше недоступен'), { lost: true }); }
        return (await U.lib.pdf()).getDocument({ data: new Uint8Array(buf) }).promise;
      })());
      docs.get(rec.id).catch(() => docs.delete(rec.id)); // try again next time
    }
    return docs.get(rec.id);
  }
  /**
   * pdf.js text items → lines in reading order.
   * The items are taken in the order of the file (the text blocks of a page — columns, boxes, speech bubbles — come
   * one after another, unlike grouping by height, which mixes columns). Scanned books with an OCR text layer
   * («God i norsk»: PDF24 OCR) give every word as its own item with FAKE widths — so a space is put between words
   * whenever the widths cannot be trusted, and gaps are measured only for books with real fonts.
   */
  async function pdfLines(page) {
    const tc = await page.getTextContent();
    const items = tc.items.filter(it => typeof it.str === 'string').map(it => ({ x: it.transform[4], y: it.transform[5], w: it.width || 0, h: Math.abs(it.transform[3]) || 10, s: it.str, eol: !!it.hasEOL }));
    // 📄 a page number in the top / bottom margin of the page is not text (util.js PageText)
    const v = page.view || [0, 0, 0, 0], H = (v[3] || 0) - (v[1] || 0);
    if (window.PageText && H > 50) for (let k = items.length - 1; k >= 0; k--) { const i = items[k]; if ((i.y > v[3] - H * 0.09 || i.y < v[1] + H * 0.09) && PageText.isPageNum(i.s, true)) items.splice(k, 1); }
    const words = items.filter(i => i.s.trim());
    if (!words.length) return [];
    // fake widths: most neighbours on one line «overlap» → one item = one word
    let pairs = 0, over = 0;
    for (let k = 1; k < words.length; k++) { const a = words[k - 1], b = words[k]; if (Math.abs(a.y - b.y) < 2 && b.x > a.x) { pairs++; if (a.x + a.w > b.x + 0.5) over++; } }
    const fake = pairs > 8 && over > pairs * 0.5;
    const lines = [];
    let cur = '', prev = null;
    const push = () => { if (cur.trim()) lines.push(cur.replace(/\s+/g, ' ').trim()); cur = ''; };
    items.forEach(i => {
      if (!i.s.trim()) { if (i.eol) { push(); prev = null; } else if (cur && !/\s$/.test(cur)) cur += ' '; return; }
      if (prev) {
        const dy = Math.abs(prev.y - i.y), lh = Math.max(prev.h, i.h);
        if (dy > lh * 0.5 || i.x < prev.x - lh) {
          // a new line; a big jump (another block, a column, a picture caption) = a new paragraph
          push();
          if (dy > lh * 2.2 || i.y > prev.y + lh) lines.push('');
        } else if (cur && !/\s$/.test(cur) && !/^\s/.test(i.s) && (fake || i.x - (prev.x + prev.w) > i.h * 0.15 || prev.x + prev.w - i.x > i.h * 0.3)) cur += ' '; // a big overlap = a fake width of an OCR word (Substantivet|står)
      }
      cur += i.s;
      prev = i;
      if (i.eol) { push(); prev = null; }
    });
    push();
    return lines;
  }
  /** OCR-layer clean-up: running footers, bullets, broken section numbers, picture noise */
  function tidyLines(lines) {
    return lines.map(l => l
      .replace(/^\s*(?:\*\s*)?[»*]\s+/, '• ')                               // »  *»  * → •
      .replace(/\((\d{1,2}),(\d)\)/g, '($1.$2)')                            // (1,4) → (1.4)
      .replace(/([.!?])\s+[A-ZÆØÅ]{1,2}$/, '$1')                            // «God morgen! N» — a stray letter from a photo
    ).filter(l => {
      if (!l) return true;
      if (/^\d{1,3}\s*Kapittel\s*\d+\s*[—–-]/i.test(l) || /^Kapittel\s*\d+\s*[—–-].*\s\d{1,3}$/i.test(l)) return false; // footer «18 Kapittel 1 — Vi blir kjent»
      const lt = (l.match(/\p{L}/gu) || []).length;
      if (lt < 2) return false;                                              // «7», «—», «/»
      // short junk from photos: «eQ», «dn», «ME», «ee ——»; real short words stay (Hei!, Ja., Nei)
      if (l.length <= 4 && !/[.!?:]$/.test(l) && !NoGloss.has(l.replace(/[^\p{L}]/gu, '')) && !/^\p{Lu}\p{Ll}+$/u.test(l)) return false;
      // a short line that is mostly not words («Def h», «5 P. p |», «5 é Å EE» — letters on the cover picture)
      if (l.split(/\s+/).length <= 5 && junkRatio(l) >= 0.5) return false;
      return true;
    });
  }
  async function renderCanvas(page, scale) {
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    return c;
  }
  async function ocr(img, log) {
    log && log('распознаю текст на странице (OCR)… первый раз загружаются словари ≈ 8 МБ');
    const busy = UI.busy('Подождите — распознаю текст страницы…');
    busy.set('первый раз загружаются словари ≈ 8 МБ');
    let r;
    try { const worker = await U.lib.ocr(); r = await worker.recognize(img); } finally { busy.close(); }
    return tidyLines(((r && r.data && r.data.text) || '').split('\n').map(s => s.trim())).join('\n');
  }
  async function pageText(rec, n, log, force) {
    if (!force && rec.text[n] != null) return rec.text[n];
    let t = '';
    if (rec.kind === 'pdf') {
      const page = await (await pdfDoc(rec)).getPage(n);
      const raw = force ? [] : await pdfLines(page);
      // the number printed on the page (footer «18 Kapittel 1 — …»): the book's own page numbering
      if (rec.off == null) {
        const pn = raw.map(l => (/^(\d{1,3})\s*Kapittel\s*\d/i.exec(l) || /^Kapittel\s*\d+\s*[—–-].*\s(\d{1,3})$/i.exec(l) || [])[1]).find(Boolean);
        if (pn && Math.abs(n - +pn) < 30) rec.off = n - +pn;
      }
      t = tidyLines(raw).join('\n');
      // a scanned page (or broken fonts): read the picture
      if (force || letters(t) < 25 || (t.match(/�|[-]/g) || []).length > letters(t) * 0.2) {
        t = await ocr(await renderCanvas(page, 2.2), log);
        if (!rec.ocr.includes(n)) rec.ocr.push(n);
      }
    } else if (rec.kind === 'images') {
      t = await ocr(rec.images[n - 1], log);
      if (!rec.ocr.includes(n)) rec.ocr.push(n);
    } else t = rec.text[n] || '';
    rec.text[n] = t;
    saveSoon(rec);
    return t;
  }
  /** 📄 running headers / footers of a book: short lines at the top / bottom of ≥3 of the pages read so far (util.js PageText) */
  const HF = new WeakMap(), HFS = new WeakMap();
  function hfKeys(rec) {
    if (!rec || !rec.text || rec.kind === 'text' || !window.PageText) return null;
    const ks = Object.keys(rec.text).filter(k => rec.text[k]);
    const sample = (HFS.get(rec) || {}).got || {};
    const all = Object.assign({}, sample, ...ks.map(k => ({ [k]: rec.text[k] })));
    const n = Object.keys(all).length;
    if (n < 3) return null;
    const c = HF.get(rec);
    if (c && c.n === n) return c.keys;
    const keys = PageText.repeatKeys(Object.values(all).map(t => String(t).split('\n').map(l => l.trim())));
    HF.set(rec, { n, keys });
    return keys;
  }
  /** a PDF opened on its first pages: the text layer (no OCR) of up to 8 pages around, once — to know its running headers */
  async function hfPrime(rec, at) {
    if (!rec || rec.kind !== 'pdf' || !window.PageText || (rec.n || 0) < 3) return;
    if (HFS.has(rec)) { await HFS.get(rec).done; return; }
    const got = {};
    const done = (async () => {
      try {
        const pdf = await pdfDoc(rec);
        const from = Math.max(1, Math.min((rec.n || 1) - 7, (at || 1) - 3));
        for (let p = from; p <= Math.min(rec.n, from + 7); p++) { if (rec.text[p] == null) got[p] = (await pdfLines(await pdf.getPage(p))).join('\n'); }
      } catch (e) { /* headers are found from the pages read */ }
    })();
    HFS.set(rec, { got, done });
    await done;
  }
  /** 📄 page numbers («6», «- 6 -», «Side 6 av 40», «[6]»), running headers / footers, «. . .» separators out (util.js PageText) */
  function pageClean(lines, rec) {
    if (!window.PageText) return lines;
    try {
      if (rec && rec.kind === 'text') return PageText.cleanText(lines.join('\n')).split('\n'); // «pages» of a text file: no page edges
      return PageText.cleanPages([lines], { keys: hfKeys(rec) || new Set(), pdf: rec && rec.kind === 'pdf' })[0];
    } catch (e) { return lines; }
  }
  /** page text → [{k:'h'|'p', t}] (wrapped lines joined, page numbers and running headers dropped) */
  function paras(text, rec) {
    // the clean-up rules also for pages read before they existed (their text is kept on the device)
    const lines = tidyLines(pageClean(String(text || '').split('\n').map(l => l.trim()), rec)).filter(l => !/^\d{1,3}$/.test(l));
    const out = [];
    let block = [];
    // wrapped lines of one paragraph are joined; short lines without a full stop are headings (KAPITTEL 1, Hjemme hos meg)
    const join = ls => {
      const r = [];
      ls.forEach((l, i) => {
        const prev = r[r.length - 1];
        const next = ls[i + 1] || '';
        const open = prev && !/[.!?:]["»”)]?$/.test(prev.t); // the previous line has not finished its sentence
        // a continuation: starts small («tekstbok og arbeidsbok.»), or the previous line was a long wrapped line
        // («…og ansatte i» + «Aschehoug som har kommet…»), or the previous line ends with a comma / dash
        const cont = open && (/^[\p{Ll}(,–-]/u.test(l) || prev.t.length > 38 || /[,–-]$/.test(prev.t));
        if (cont) {
          prev.t = /\p{L}-$/u.test(prev.t) && /^\p{Ll}/u.test(l) ? prev.t.slice(0, -1) + l : prev.t + ' ' + l;
          prev.k = 'p';
          return;
        }
        // a heading: short, no end punctuation, and the next line does not continue it
        const head = l.length < 60 && !/[.!?:,;]["»”]?$/.test(l) && l.split(' ').length <= 8 && /^[\p{Lu}0-9«"•]/u.test(l) && !/^\p{Ll}/u.test(next);
        r.push({ k: head && !/^•/.test(l) ? 'h' : 'p', t: l });
      });
      return r;
    };
    const flush = () => { if (block.length) out.push(...join(block)); block = []; };
    lines.forEach(l => { if (!l) flush(); else block.push(l); });
    flush();
    return out.filter(p => letters(p.t) > 0);
  }
  const isNo = s => U.cyrRatio(s) < 0.3 && letters(s) > 0;

  /* ---------- quality of the book's text: is it good enough to read, translate and make cards? ---------- */
  /** share of «words» that are not words: no vowel, digits inside, mixed cAsE, stray single letters (typical OCR noise) */
  function junkRatio(text) {
    const toks = String(text || '').split(/\s+/).filter(t => /\p{L}/u.test(t));
    if (!toks.length) return 1;
    const bad = toks.filter(t => {
      const w = t.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
      if (!w) return true;
      if (/\d/.test(w) || /\p{Ll}\p{Lu}/u.test(w)) return true;
      if (w.length === 1) return !/^[iåoaeIÅOAE]$/.test(w);
      if (!/[aeiouyæøåéèêóòôüаеёиоуыэюя]/i.test(w) && !NoGloss.has(w)) return true;
      return false;
    }).length;
    return bad / toks.length;
  }
  /** check 12 pages spread over the book (without OCR — just what the file gives) */
  async function assess(rec) {
    const q = { at: Date.now(), sampled: 0, noText: 0, junk: 0, ocrLayer: false, scan: rec.kind === 'images', producer: '' };
    if (rec.kind === 'images') { q.level = 'scan'; return q; }
    const n = rec.n, pick = [...new Set(Array.from({ length: Math.min(12, n) }, (_, i) => Math.max(1, Math.min(n, Math.round(1 + i * (n - 1) / Math.max(1, Math.min(12, n) - 1))))))];
    let junkSum = 0, textPages = 0;
    if (rec.kind === 'pdf') {
      const pdf = await pdfDoc(rec);
      try { const md = await pdf.getMetadata(); q.producer = [md.info && md.info.Producer, md.info && md.info.Creator].filter(Boolean).join(' · '); } catch (e) { /* none */ }
      q.ocrLayer = /ocr|tesseract|abbyy|finereader|readiris|pdf24|scan/i.test(q.producer);
      for (const p of pick) {
        const lines = await pdfLines(await pdf.getPage(p));
        const t = lines.join('\n');
        q.sampled++;
        if (letters(t) < 25) { q.noText++; continue; }
        textPages++; junkSum += junkRatio(t);
      }
    } else {
      pick.forEach(p => { const t = rec.text[p] || ''; q.sampled++; if (letters(t) < 25) q.noText++; else { textPages++; junkSum += junkRatio(t); } });
    }
    q.junk = textPages ? junkSum / textPages : 1;
    const noShare = q.noText / Math.max(1, q.sampled);
    q.level = noShare > 0.5 ? 'image' : q.junk > 0.12 || noShare > 0.25 ? 'poor' : q.ocrLayer || q.junk > 0.05 ? 'ok' : 'good';
    return q;
  }
  const QUALITY = {
    good: { icon: '✅', name: 'Хорошее качество текста', text: 'Текст книги настоящий (его можно выделить и скопировать) — чтение, перевод и карточки будут точными.' },
    ok: { icon: '🟡', name: 'Текст распознан со сканов — среднее качество', text: 'Это отсканированная книга, к которой программа уже «приписала» текст распознаванием (OCR). Обычный текст читается хорошо, но бывают опечатки: пропущенные буквы, «1,4» вместо «1.4», обрывки букв с фотографий; таблицы и списки слов в несколько колонок могут перемешаться.' },
    poor: { icon: '🟠', name: 'Плохое качество текста', text: 'Текст в файле распознан со сканов с большим количеством ошибок: много «мусора», пропущенных и склеенных слов. Перевод и новые слова будут неточными.' },
    image: { icon: '🔴', name: 'В файле нет текста — только картинки страниц', text: 'Это скан без текстового слоя: текст нельзя выделить и скопировать. Приложение будет распознавать каждую страницу само прямо на устройстве (OCR) — это медленнее (несколько секунд на страницу), и возможны ошибки.' },
    scan: { icon: '📷', name: 'Фото страниц — текст будет распознан', text: 'Каждое фото распознаётся прямо на устройстве (OCR). Чем ровнее и чётче фото, тем меньше ошибок: снимайте при хорошем свете, без бликов, страницу целиком и прямо.' },
  };
  function qualityHtml(q, full) {
    if (!q) return '';
    const Q = QUALITY[q.level] || QUALITY.ok;
    const stats = q.sampled ? `Проверено ${q.sampled} ${U.plural(q.sampled, ['страница', 'страницы', 'страниц'])} из разных частей книги: без текста — ${q.noText}, «мусора» в тексте ≈ ${Math.round(q.junk * 100)}%${q.producer ? ` · файл сделан: ${U.esc(q.producer)}` : ''}.` : '';
    return `<div class="tb-quality q-${q.level}"><div><b>${Q.icon} ${Q.name}</b></div>
      ${full ? `<div class="small">${Q.text}</div>${stats ? `<div class="tiny muted">${stats}</div>` : ''}
      ${q.level !== 'good' ? `<div class="small"><b>Что можно сделать:</b> принять как есть (на каждой странице есть «🖼 Как в книге» — сверяться с оригиналом — и «🔍 Распознать заново»), или загрузить книгу лучшего качества: <b>EPUB</b> или <b>PDF с настоящим текстом</b> — такой, где текст выделяется мышкой и копируется (электронная версия от издательства, а не скан). Проверить просто: откройте PDF, выделите строку и вставьте в Заметки — если вставился ровный текст, книга хорошая.</div>` : ''}` : ''}</div>`;
  }

  /* ---------- the window ---------- */
  const Textbook = {
    ACCEPT,
    async open(id) {
      const m = UI.modal({ title: '📘 Мой учебник', cls: 'wide tb-modal', body: '<div data-tb><div class="small muted"><span class="spinner sm"></span> открываю…</div></div>', onClose: () => { this._m = null; this._rec = null; TTS.stop(); flush(); } });
      this._m = m;
      this.bindDrop(m);
      if (id) { await flush(); const rec = await get(id); if (rec) return this.read(rec); }
      await this.shelf();
    },
    /** a book from the free shelf (or any file) → straight into the reader; the same book again → opens where you stopped */
    async openWith(file, title) {
      const have = (await all().catch(() => [])).find(b => b.title === title || b.title === file.name.replace(/\.[^.]+$/, ''));
      await this.open();
      if (have) { await flush(); const rec = await get(have.id); if (rec) return this.read(rec); }
      await this.add([file]);
      // keep the shelf's nice title (the file may carry an odd one)
      const rec = this._rec;
      if (rec && title && rec.title !== title) { rec.title = title; saveSoon(rec); const h = this._m && this._m.$('.modal-head h2'); if (h) h.textContent = `📘 ${title}`; }
    },
    bindDrop(m) {
      const el = m.el;
      el.addEventListener('dragover', e => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); el.classList.add('tb-drag'); } });
      el.addEventListener('dragleave', e => { if (e.target === el) el.classList.remove('tb-drag'); });
      el.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); el.classList.remove('tb-drag'); if (e.dataTransfer.files.length) this.add(e.dataTransfer.files); });
    },
    /** 📚 my books */
    async shelf() {
      const m = this._m; if (!m) return;
      await flush(); // the progress of the page you just read
      const list = (await all().catch(() => [])).sort((a, b) => (b.opened || b.added) - (a.opened || a.added));
      m.$('.modal-head h2').textContent = '📘 Мой учебник';
      m.$('[data-tb]').innerHTML = `
        <div class="lib-intro">📘 <span>Загрузите <b>свой учебник</b> — например «God i norsk». Читайте по страницам с переводом каждого предложения или каждого слова, слушайте, превращайте новые слова в карточки с примером из книги и проверяйте себя.
          <b>Книга хранится только на этом устройстве</b> — никуда не отправляется.</span></div>
        <label class="tb-drop">
          <input type="file" multiple accept="${ACCEPT}" hidden data-tb-file>
          <div class="tb-drop-ico">📥</div>
          <b>Выберите файл книги или перетащите его сюда</b>
          <span class="small muted">PDF (в том числе сканы — текст распознаётся) · EPUB · DOCX · ODT · FB2 · HTML · TXT · RTF · фото страниц JPG/PNG (можно сразу много) · CBZ/ZIP</span>
          <span class="tiny muted">MOBI / AZW (Kindle), DjVu, DOC: переведите в EPUB или PDF бесплатной программой Calibre — или сфотографируйте страницы</span>
        </label>
        <div class="tb-shelf">${list.map(b => {
          const pct = b.n ? Math.round((b.read || []).length / b.n * 100) : 0;
          return `<div class="tb-book" data-open="${b.id}">
            <div class="tb-book-ico">${b.kind === 'images' ? '🖼' : b.ext === 'pdf' ? '📕' : '📗'}</div>
            <div class="grow" style="min-width:0"><b>${U.esc(b.title)}</b>${b.quality ? ` <span class="small" title="${U.esc((QUALITY[b.quality.level] || QUALITY.ok).name)}">${(QUALITY[b.quality.level] || QUALITY.ok).icon}</span>` : ''}
              <div class="small muted">${b.n} ${U.plural(b.n, ['страница', 'страницы', 'страниц'])} · прочитано ${(b.read || []).length} (${pct}%) · стр. ${b.last || 1}${b.cards ? ` · карточек: ${b.cards}` : ''}</div>
              <div class="tb-bar"><i style="width:${pct}%"></i></div></div>
            <button class="btn sm primary" data-open="${b.id}">▶ ${b.last > 1 ? 'Продолжить' : 'Открыть'}</button>
            <button class="icon-btn sm danger-btn" data-del="${b.id}" title="Удалить книгу с устройства (с подтверждением)">${UI.TRASH_SVG(16)}</button>
          </div>`;
        }).join('') || ''}</div>
        <div class="tiny muted" style="margin-top:10px">Учебник защищён авторским правом издательства: загружайте свою книгу для себя. Карточки из него можно отправить себе на другое устройство; выкладывать их публично нельзя.</div>`;
      const box = m.$('[data-tb]');
      box.querySelector('[data-tb-file]').addEventListener('change', e => this.add(e.target.files));
      box.onclick = async e => {
        const d = e.target.closest('[data-del]');
        if (d) {
          e.stopPropagation();
          const rec = await get(d.dataset.del);
          if (rec && await UI.confirm(`Удалить книгу «${U.esc(rec.title)}» с этого устройства?<br><span class="small muted">Карточки, которые вы из неё сделали, останутся.</span>`, { danger: true, ok: 'Да, удалить' })) { unsave(rec.id); await del(rec.id); docs.delete(rec.id); this.shelf(); }
          return;
        }
        const o = e.target.closest('[data-open]');
        if (o) { await flush(); const rec = await get(o.dataset.open); if (rec) this.read(rec); }
      };
    },
    async add(files) {
      const m = this._m; if (!m) return;
      const box = m.$('[data-tb]');
      box.insertAdjacentHTML('afterbegin', '<div class="mt-warn" data-tb-busy><span class="spinner sm"></span><span>Загружаю книгу…</span></div>');
      try {
        let rec = await importFiles(files);
        // the same book again (e.g. its file was lost): keep the bookmark, read pages, text and cards — only the file is new
        const same = (await all().catch(() => [])).find(b => b.title === rec.title && b.n === rec.n && b.kind === rec.kind);
        if (same && await UI.confirm(`«${U.esc(rec.title)}» уже есть на полке (прочитано ${(same.read || []).length} стр., закладка — стр. ${same.last}).<br>Обновить файл и сохранить ваш прогресс?`, { ok: 'Да, сохранить прогресс' })) {
          same.blob = rec.blob; same.images = rec.images; same.size = rec.size;
          docs.delete(same.id);
          await put(same);
          UI.toast('📘 Файл книги обновлён — прогресс сохранён', 'good');
          return this.read(same);
        }
        // how good is the text? (real text / OCR of scans / pictures only) — told straight away, with what to do
        const busy = UI.busy('Проверяю качество текста книги…');
        try { rec.quality = await assess(rec); } catch (e) { /* unknown */ }
        busy.close();
        // not saved (Safari private mode, …) — still readable now, only for this visit; no space — a real error
        try { await put(rec); } catch (e) { if (/Quota/i.test(String(e && e.name))) throw e; UI.toast(`${e && e.message ? e.message : 'Книга не сохранилась'} — читать можно сейчас, но после закрытия её придётся загрузить снова`, 'warn', 9000); }
        UI.toast(`📘 «${rec.title}» — ${rec.n} ${U.plural(rec.n, ['страница', 'страницы', 'страниц'])}`, 'good');
        if (rec.quality && rec.quality.level !== 'good') {
          const go = await new Promise(res => {
            const qm = UI.modal({ title: '📘 Качество книги', cls: 'narrow', body: qualityHtml(rec.quality, true),
              foot: '<button class="btn ghost" data-other>📥 Загрузить другую книгу</button><button class="btn primary" data-ok>Принять как есть и читать</button>', onClose: r => res(r) });
            qm.$('[data-ok]').onclick = () => qm.close('read');
            qm.$('[data-other]').onclick = () => qm.close('other');
          });
          if (go === 'other') { this.shelf(); setTimeout(() => { const i = this._m && this._m.$('[data-tb-file]'); if (i) i.click(); }, 200); return; }
        }
        this.read(rec);
      } catch (e) {
        const b = box.querySelector('[data-tb-busy]'); if (b) b.remove();
        e = e || new Error('Не получилось открыть книгу');
        UI.toast(/QuotaExceeded|места/.test(e.message + e.name) ? 'Не хватает места на устройстве для книги' : e.message, 'bad', 8000);
      }
    },

    /* ---------- reader ---------- */
    async read(rec, page) {
      const m = this._m; if (!m) return;
      this._rec = rec;
      rec.opened = Date.now();
      const n = U.clamp(page || rec.last || 1, 1, rec.n);
      rec.last = n;
      saveSoon(rec);
      // books added before the quality check: checked once in the background, the note appears when it is ready
      if (!rec.quality && !rec._assessing) {
        rec._assessing = true;
        assess(rec).then(q => {
          rec.quality = q; delete rec._assessing; saveSoon(rec);
          const box = this._m && this._rec === rec && this._m.$('[data-q]');
          if (box && q.level !== 'good') box.innerHTML = `<details class="tb-qd" open><summary>${qualityHtml(q, false)}</summary>${qualityHtml(q, true)}</details>`;
        }).catch(() => { delete rec._assessing; });
      }
      m.$('.modal-head h2').textContent = `📘 ${rec.title}`;
      const v = Store.settings.exView || 'asis';
      m.$('[data-tb]').innerHTML = `
        <div class="tb-top">
          <button class="btn sm ghost" data-a="shelf" title="Мои книги">← Книги</button>
          <span class="tb-nav"><button class="btn sm" data-a="prev" ${n <= 1 ? 'disabled' : ''} title="Предыдущая (←)">‹</button>
            <span class="small">стр. <input class="input tb-page" type="number" min="1" max="${rec.n}" value="${n}" data-a-page> из ${rec.n}${rec.off ? `<span class="muted"> · в книге ${n - rec.off}</span>` : ''}</span>
            <button class="btn sm" data-a="next" ${n >= rec.n ? 'disabled' : ''} title="Следующая (→)">›</button></span>
          <span class="seg-mini ex-view sm" title="Как показывать перевод">${Study.EXV.map(([id, l, t]) => `<button class="${v === id ? 'active' : ''}" data-v="${id}" title="${t}">${l}</button>`).join('')}</span>
        </div>
        <div class="tb-tools">
          <button class="btn sm listen-cta" data-a="listen-page" title="Каждое предложение: по-норвежски, затем по-русски — в наушниках или через динамик">🎧 Слушать страницу: 🇳🇴 → 🇷🇺</button>
          <button class="btn sm listen-cta" data-a="listen-book" title="Читать вслух по-норвежски с этой страницы дальше — можно в наушниках с выключенным экраном">🎧 Слушать дальше</button>
          <button class="btn sm primary" data-a="page-cards" title="Перенести эту страницу в карточки: одна карточка со всем текстом и переводом — или каждое предложение отдельной карточкой">🃏 Страница → карточки</button>
          <button class="btn sm primary" data-a="words" title="Слова этой страницы, которых ещё нет в ваших карточках → в карточки с примером из книги">🆕 Новые слова → карточки</button>
          <button class="btn sm" data-a="pairs" hidden title="На странице есть список «слово — перевод»">📋 Список слов → карточки</button>
          <button class="btn sm ai" data-a="quiz" title="Вопросы по тексту страницы — проверка понимания (нейросеть)">✍️ Проверь себя</button>
          <button class="btn sm ghost" data-a="orig" title="Показать страницу как в книге — с картинками и упражнениями">🖼 Как в книге</button>
          <button class="btn sm ghost" data-a="ocr" title="Распознать страницу заново по картинке (если текст получился с ошибками)">🔍 Распознать заново</button>
        </div>
        <div data-q>${rec.quality && rec.quality.level !== 'good' ? `<details class="tb-qd"><summary>${qualityHtml(rec.quality, false)}</summary>${qualityHtml(rec.quality, true)}</details>` : ''}</div>
        <div class="tb-bar big"><i style="width:${Math.round(rec.read.length / rec.n * 100)}%"></i></div>
        <div class="tb-orig" data-orig hidden></div>
        <div class="tb-text ${v}" data-text><div class="small muted"><span class="spinner sm"></span> читаю страницу…</div></div>
        <div data-extra></div>`;
      const box = m.$('[data-tb]');
      box.onclick = e => this.click(e);
      box.querySelector('[data-a-page]').addEventListener('change', e => this.read(rec, +e.target.value));
      box.querySelector('[data-a-page]').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } }); // blur → one «change» (Enter + change opened the page twice)
      if (!this._keys) {
        this._keys = e => {
          if (!this._m || !this._rec || /input|textarea|select/i.test(e.target.tagName || '') || document.querySelectorAll('.modal-backdrop').length > 1) return;
          if (e.key === 'ArrowRight' && this._rec.last < this._rec.n) { e.preventDefault(); this.read(this._rec, this._rec.last + 1); }
          if (e.key === 'ArrowLeft' && this._rec.last > 1) { e.preventDefault(); this.read(this._rec, this._rec.last - 1); }
        };
        document.addEventListener('keydown', this._keys);
      }
      let sx = null;
      const tx = box.querySelector('[data-text]');
      tx.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
      tx.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 90) this.read(rec, rec.last + (dx < 0 ? 1 : -1)); }, { passive: true });
      const log = t => { const el = box.querySelector('[data-text]'); if (el && /spinner/.test(el.innerHTML)) el.innerHTML = `<div class="small muted"><span class="spinner sm"></span> ${U.esc(t)}</div>`; };
      let text;
      try { text = await pageText(rec, n, log); await hfPrime(rec, n); } catch (e) {
        const lost = e.lost || /can not be found|NotFound|NotReadable/i.test(e.message + ' ' + e.name);
        if (!lost) { tx.innerHTML = `<div class="mt-warn"><span>⚠️</span><span>Страница не прочиталась: ${U.esc(U.niceErr(e, '', true))}</span></div>`; return; }
        // the book's file is gone — choose it again; the bookmark, read pages and cards stay
        tx.innerHTML = `<div class="mt-warn tb-lost"><span>📂</span><span><b>Файл книги больше недоступен.</b> Браузер хранил только ссылку на файл «${U.esc(rec.title)}», а его переместили, переименовали или обновили (например, Telegram).
            Выберите этот же файл ещё раз — <b>закладка, прочитанные страницы и карточки сохранятся</b>, и теперь книга будет храниться в приложении целиком.</span></div>
          <label class="btn primary tb-relink">📥 Выбрать файл книги заново<input type="file" accept="${ACCEPT}" hidden data-relink></label>`;
        tx.querySelector('[data-relink]').addEventListener('change', async ev => {
          const f = ev.target.files[0]; if (!f) return;
          try {
            const fresh = await importFiles([f]);
            if (fresh.kind !== rec.kind) throw new Error('это другой формат — выберите тот же файл книги');
            if (fresh.n !== rec.n && !(await UI.confirm(`В этом файле ${fresh.n} стр., а в книге было ${rec.n}. Это точно та же книга?`, { ok: 'Да, та же' }))) return;
            rec.blob = fresh.blob; rec.images = fresh.images; rec.n = fresh.n; rec.size = fresh.size;
            docs.delete(rec.id);
            await put(rec);
            UI.toast('📘 Книга снова на месте — продолжайте читать', 'good');
            this.read(rec, n);
          } catch (err) { UI.toast(err.message, 'bad', 6000); }
        });
        return;
      }
      if (this._rec !== rec || rec.last !== n) return;
      if (!rec.read.includes(n)) { rec.read.push(n); saveSoon(rec); }
      this._paras = paras(text, rec);
      this.drawPage();
      // a list «word – translation» on this page → offer it as cards
      const pr = Telegram.pairs(text).filter(x => x.ru || x.en);
      const pb = box.querySelector('[data-a="pairs"]'); if (pb && pr.length >= 3) { pb.hidden = false; pb.textContent = `📋 Список слов (${pr.length}) → карточки`; }
      // books with pictures: show the page itself when there is almost no text
      if (letters(text) < 40 && rec.kind !== 'text') this.showOrig(true);
      this.translatePage();
      // 🎓 «Учить по книге»: after three pages — «Сделать колоду из прочитанного?» (js/learnby.js)
      if (window.LearnBy && LearnBy.offer) LearnBy.offer({ key: 'textbook:' + rec.id, title: rec.title, page: n, src: 'textbook', id: rec.id, open: () => Textbook.open(rec.id), text: () => this._paras.filter(x => x.k !== 'h').map(x => x.t).join(' ') });
    },
    sentences() { return (this._paras || []).flatMap(p => p.k === 'h' ? [p.t] : Study.splitSent(p.t)).filter(isNo); },
    /** 🎭 who says each paragraph of the page (js/voices.js Voices.dialogRoles: «– …» lines take turns, «Kari: …» by
     *  name; headings and narration are nobody's) + the speakers in the order of the page */
    paraRoles() {
      const ps = this._paras || [];
      if (this._roles && this._roles.ps === ps) return this._roles;
      let keys = null;
      try { keys = window.Voices && Voices.dialogRoles ? Voices.dialogRoles(ps.map(p => (p.k === 'h' ? '# ' : '') + String(p.t || '').replace(/\s*\n\s*/g, ' '))) : null; } catch (e) { keys = null; }
      const roster = [];
      (keys || []).forEach(x => { if (x != null && !roster.includes(x)) roster.push(x); });
      return (this._roles = { ps, keys: keys || [], roster });
    },
    /** the text of «🎧 Слушать страницу»: every sentence with its translation under it — a speaker's line (🎭) stays
     *  whole, so the voice of the speaker reads all of it (and its translation follows it) */
    listenText(c) {
      const R = this.paraRoles(), tr = s => c['s:' + s];
      const out = [];
      R.ps.forEach((p, i) => {
        const ss = (p.k === 'h' ? [p.t] : Study.splitSent(p.t)).filter(isNo);
        if (!ss.length) return;
        if (R.keys[i] != null && ss.length > 1) {
          out.push(ss.join(' '));
          const t = ss.map(tr).filter(Boolean).join(' ');
          if (t) out.push(t);
        } else ss.forEach(s => { out.push(s); if (tr(s)) out.push(tr(s)); });
      });
      return out.join('\n');
    },
    drawPage() {
      const m = this._m; const rec = this._rec; if (!m || !rec) return;
      const tx = m.$('[data-text]'); if (!tx) return;
      const v = Store.settings.exView || 'asis';
      tx.className = `tb-text ${v}`;
      const c = Study.exCache();
      const say = (t, lang) => `<button class="icon-btn sm ex-say" data-say="${U.esc(t)}" data-lang="${lang}" title="${lang === 'ru' ? 'Только русский' : 'Произнести'}">🔊${lang === 'ru' ? '<small>RU</small>' : ''}</button>`;
      const sent = s => {
        if (!isNo(s)) return `<span class="tb-s">${U.esc(s)}</span>`;
        const tr = Study.sentTr(s);
        const ru = tr ? U.esc(tr) : tr === '' ? '—' : '…';
        if (v === 'word') return `<span class="tb-s"><span class="wbw-line">${Study.glossHtml(s)}</span> ${say(s, 'no')}<span class="ex-ru tb-ru">${ru} ${tr ? say(tr, 'ru') : ''}</span>${Study.litHtml ? Study.litHtml([[s, tr || undefined]], 'span') : ''}</span>`;
        if (v === 'sent') return `<span class="tb-s">${U.esc(s)} <span class="ex-ru-in">(${ru})</span> ${say(s, 'no')}${tr ? say(tr, 'ru') : ''}</span>`;
        return `<span class="tb-s">${U.esc(s)} ${say(s, 'no')}</span>`;
      };
      const ps = this._paras || [];
      // this page's own text quality (OCR noise) — said right above the text
      const j = ps.length ? junkRatio(ps.map(p => p.t).join(' ')) : 0;
      const pageWarn = j > 0.15 ? `<div class="mt-warn tb-pw"><span>⚠️</span><span>На этой странице текст распознан плохо (≈${Math.round(j * 100)}% слов с ошибками): перевод и новые слова будут неточными. Сверяйтесь с «🖼 Как в книге»${rec.kind !== 'text' ? ' или нажмите «🔍 Распознать заново»' : ''}.</span></div>` : '';
      tx.innerHTML = pageWarn + (ps.length ? ps.map(p => p.k === 'h' ? `<h4 class="tb-h">${sent(p.t)}</h4>` : `<p class="tb-p">${Study.splitSent(p.t).map(sent).join(' ')}</p>`).join('')
        : `<div class="small muted">На этой странице нет текста${rec.kind !== 'text' ? ' — посмотрите «🖼 Как в книге»' : ''}.</div>`);
      const by = (Study._exBy || []).map(id => id === 'ai' ? AI.name(Translators.lastAI) : (Translators.LIST[id] || {}).name || id).join(' + ');
      if (v !== 'asis' && ps.length) tx.insertAdjacentHTML('beforeend', `<div class="tiny muted ex-mt">⚠️ Перевод — ${(Study._exBy || []).includes('ai') ? U.esc(AI.name(Translators.lastAI)) + ' по смыслу' : 'машинный' + (by ? ' (' + U.esc(by) + ')' : '')}; частые слова — из встроенного словарика. Перепроверяйте.${rec.ocr.includes(rec.last) ? ' Текст этой страницы распознан с картинки (OCR) — возможны опечатки.' : ''}</div>`);
      else if (rec.ocr.includes(rec.last)) tx.insertAdjacentHTML('beforeend', '<div class="tiny muted ex-mt">Текст этой страницы распознан с картинки (OCR) — возможны опечатки: сверяйте с «🖼 Как в книге».</div>');
    },
    async translatePage() {
      const v = Store.settings.exView || 'asis';
      if (v === 'asis') return;
      const rec = this._rec, n = rec && rec.last;
      const ss = this.sentences();
      // lines appear one by one while the translation runs (redrawn at most twice a second)
      let t = null;
      Translators.onPut = () => { if (t) return; t = setTimeout(() => { t = null; if (this._rec === rec && rec.last === n) this.drawPage(); }, 500); };
      try { await Study.translateUnits(ss, v === 'word' ? ss : []); } finally { Translators.onPut = null; clearTimeout(t); }
      if (!(this._rec === rec && rec.last === n)) return;
      this.drawPage();
      // the translator did not answer: a window in the middle of the screen — why, and a big «🔄 Повторить перевод»
      if (Study._lastFail) {
        Study.failModal(() => this.translatePage());
        const tx = this._m && this._m.$('[data-text]');
        if (tx) tx.insertAdjacentHTML('afterbegin', `<div class="mt-warn tb-fail"><span>⚠️</span><span>Перевод не пришёл: ${U.esc(Study._lastFail.error)}.</span><button class="media-btn sm main" data-a="retry" title="Повторить перевод" aria-label="Повторить перевод">${UI.icon('retry', 18)}</button></div>`);
      }
    },
    async showOrig(on) {
      const m = this._m, rec = this._rec; if (!m || !rec) return;
      const box = m.$('[data-orig]');
      if (on === false || (on === undefined && !box.hidden)) { box.hidden = true; box.innerHTML = ''; return; }
      box.hidden = false;
      if (rec.kind === 'text') { box.innerHTML = '<div class="small muted">У этой книги нет картинок страниц — только текст.</div>'; return; }
      box.innerHTML = '<div class="small muted"><span class="spinner sm"></span> рисую страницу…</div>';
      try {
        if (rec.kind === 'pdf') {
          const page = await (await pdfDoc(rec)).getPage(rec.last);
          const w = Math.min(1100, box.clientWidth || 800);
          const c = await renderCanvas(page, (w * (window.devicePixelRatio || 1)) / page.getViewport({ scale: 1 }).width);
          c.className = 'tb-canvas'; box.innerHTML = ''; box.appendChild(c);
        } else {
          const url = URL.createObjectURL(rec.images[rec.last - 1]);
          box.innerHTML = `<img class="tb-canvas" src="${url}" alt="">`;
        }
      } catch (e) { box.innerHTML = `<div class="small muted">Не получилось показать страницу: ${U.esc(U.niceErr(e, '', true))}</div>`; }
    },
    async click(e) {
      const rec = this._rec;
      const vb = e.target.closest('[data-v]');
      if (vb) { Store.setSetting('exView', vb.dataset.v); this._m.$$('.tb-top [data-v]').forEach(b => b.classList.toggle('active', b === vb)); this.drawPage(); this.translatePage(); return; }
      const sb = e.target.closest('[data-say]');
      if (sb) {
        const lang = sb.dataset.lang || 'no', o = { place: 'reader' };
        // 🎭 a speaker's sentence: the speaker's own voice, as in «🎧 Слушать страницу»
        if (lang === 'no' && window.Voices && Voices.speakerOpts) {
          try {
            const R = this.paraRoles(), pe = sb.closest('.tb-p, .tb-h'), all = pe ? [...pe.parentNode.querySelectorAll(':scope > .tb-p, :scope > .tb-h')] : [];
            const who = pe ? R.keys[all.indexOf(pe)] : null;
            if (who != null && all.length === R.ps.length) Object.assign(o, Voices.speakerOpts('no', who, R.roster.slice(), 'reader'));
          } catch (x) { /* the usual voice */ }
        }
        TTS.speak(sb.dataset.say, lang, o);
        return;
      }
      const a = e.target.closest('[data-a]'); if (!a || !rec) return;
      switch (a.dataset.a) {
        case 'shelf': TTS.stop(); this._rec = null; this.shelf(); break;
        case 'prev': this.read(rec, rec.last - 1); break;
        case 'next': this.read(rec, rec.last + 1); break;
        case 'orig': this.showOrig(); break;
        case 'retry': a.disabled = true; a.classList.add('spin'); this.translatePage(); break;
        case 'ocr': {
          if (rec.kind === 'text') { UI.toast('Эта книга — текстовая, распознавать нечего', ''); break; }
          a.disabled = true; a.innerHTML = '<span class="spinner sm"></span> распознаю…';
          try { await pageText(rec, rec.last, null, true); this.read(rec, rec.last); } catch (err) { UI.toast(err.message, 'bad'); a.disabled = false; }
          break;
        }
        case 'listen-page': {
          Listen.prime();
          const ss = this.sentences();
          if (!ss.length) { UI.toast('На странице нет текста', 'warn'); break; }
          a.disabled = true; const label = a.innerHTML; a.innerHTML = '<span class="spinner sm"></span> перевожу…';
          await Study.translateUnits(ss, []);
          a.disabled = false; a.innerHTML = label;
          const c = Study.exCache();
          Listen.startText(`📘 ${rec.title} · стр. ${rec.last}`, [{ title: `стр. ${rec.last}`, page: rec.last, text: this.listenText(c) }], { loop: false, totalPages: rec.n });
          break;
        }
        case 'listen-book': {
          Listen.prime();
          a.disabled = true; const label = a.innerHTML;
          const pieces = [];
          await hfPrime(rec, rec.last);
          for (let p = rec.last; p <= Math.min(rec.n, rec.last + 29); p++) {
            a.innerHTML = `<span class="spinner sm"></span> стр. ${p}…`;
            try { const t = paras(await pageText(rec, p), rec).map(x => x.t).join('\n'); if (letters(t) > 3) pieces.push({ title: `стр. ${p}`, page: p, text: t }); } catch (err) { /* skip page */ }
          }
          a.disabled = false; a.innerHTML = label;
          if (pieces.length) Listen.startText(`📘 ${rec.title}`, pieces, { loop: false, totalPages: rec.n });
          else UI.toast('На этих страницах нет текста', 'warn');
          break;
        }
        case 'pairs': {
          const t = await pageText(rec, rec.last);
          Telegram.toCards({ src: 'local', chatTitle: `📘 ${rec.title}, стр. ${rec.last}`, link: '', text: t, photos: [], video: null }, null);
          break;
        }
        case 'words': this.wordsDialog(rec); break;
        case 'page-cards': this.pageCards(rec); break;
        case 'quiz': this.quiz(rec, a); break;
      }
    },

    /* ---------- 🃏 the page → cards (the whole page as one card, or every sentence as its own card) ---------- */
    async pageCards(rec) {
      const n = rec.last;
      const ps = this._paras || [];
      const sents = this.sentences();
      if (!sents.length) { UI.toast('На этой странице нет текста', 'warn'); return; }
      // «every sentence»: the sentences of the text — headings (Kapittel 1, Hjemme hos meg) are not sentences; a page of headings only keeps them
      const body = ps.filter(p => p.k !== 'h').flatMap(p => Study.splitSent(p.t)).filter(isNo);
      const each = body.length ? body : sents;
      const decks = Store.decks();
      const def = decks.find(d => d.textbook === rec.title) || decks.find(d => d.name === `📘 ${rec.title}`);
      const head = (ps.find(p => p.k === 'h' && isNo(p.t)) || {}).t || '';
      const m = UI.modal({
        title: `🃏 Страница ${n}${rec.off ? ` (в книге ${n - rec.off})` : ''} → карточки`, cls: 'narrow',
        body: `<label class="tb-opt"><input type="radio" name="tbpc" value="page" checked>
            <span><b>📄 Одна карточка — вся страница</b><small>Спереди — заголовок страницы, на обороте — весь текст с переводом каждого предложения. Читать, слушать, переводить по предложениям или по словам — как в любой карточке.</small></span></label>
          <label class="tb-opt"><input type="radio" name="tbpc" value="sent">
            <span><b>💬 Каждое предложение — своя карточка (${each.filter(s => letters(s) >= 4).length})</b><small>Спереди — предложение по-норвежски, на обороте — перевод. Удобно учить фразы целиком.</small></span></label>
          <label class="field"><span>Колода</span><select class="input" data-deck>${decks.map(d => `<option value="${d.id}" ${def && def.id === d.id ? 'selected' : ''}>${U.esc(d.name)}</option>`).join('')}<option value="__new" ${def ? '' : 'selected'}>➕ Новая: «📘 ${U.esc(rec.title)}»</option></select></label>`,
        foot: '<button class="btn ghost" data-x>Отмена</button><button class="btn primary" data-go>🃏 Создать</button>',
      });
      m.$('[data-x]').onclick = () => m.close();
      m.$('[data-go]').onclick = async () => {
        const how = m.$('input[name="tbpc"]:checked').value;
        let deckId = m.$('[data-deck]').value;
        m.close();
        // the translation first (⏳ shows while it works); what does not come stays untranslated — the card says so
        await Study.translateUnits(sents, []);
        const by = Study._exBy || [];
        const warn = Translators.mtFlag(by);
        if (deckId === '__new') { const d = Store.addDeck(`📘 ${rec.title}`, `Учебник «${rec.title}»`); Store.updateDeck(d.id, { textbook: rec.title }); deckId = d.id; }
        const where = `📘 «${rec.title}», стр. ${n}${rec.off ? ` (в книге ${n - rec.off})` : ''}`;
        const hist = note => [Prov.entry('import', 'create', null, `${where}${note ? ' · ' + note : ''}`), ...Translators.provKeys(by).map(k => Prov.entry(k, 'translate', null, 'перевод текста страницы'))];
        // only a real Russian translation: an answer that is the Norwegian text again (a translator glitch) would break the card's views
        const ruOf = s => { const t = String(Study.sentTr(s) || '').trim(); return /[а-яё]/i.test(t) ? t : ''; };
        let made = 0;
        if (how === 'page') {
          // the back: every paragraph, each Norwegian sentence with (its translation) — the card's views work on these lines
          const lines = [where];
          // «NO (RU)»: round brackets inside the translation itself become [ ] — otherwise the views cannot find it
          ps.forEach(p => {
            const ss = p.k === 'h' ? [p.t] : Study.splitSent(p.t);
            lines.push('');
            ss.forEach(s => { const tr = isNo(s) ? ruOf(s).replace(/\(/g, '[').replace(/\)/g, ']') : ''; lines.push(p.k === 'h' ? `▸ ${s}${tr ? ` (${tr})` : ''}` : `${s}${tr ? ` (${tr})` : ''}`); });
          });
          const front = head || `${rec.title} · стр. ${n - (rec.off || 0)}`;
          Store.addCard(deckId, { no: front, ru: (head && ruOf(head)) || `стр. ${n - (rec.off || 0)}`, description: lines.join('\n').trim(), tags: ['textbook', 'page'], history: hist('вся страница'), mtWarn: warn });
          made = 1;
        } else {
          each.forEach(s => {
            if (letters(s) < 4) return;
            Store.addCard(deckId, { no: s, ru: ruOf(s), description: where, tags: ['textbook', 'sentence'], history: hist('предложение'), mtWarn: warn });
            made++;
          });
        }
        rec.cards = (rec.cards || 0) + made; saveSoon(rec);
        await Store.saveNow();
        const d = Store.deck(deckId);
        UI.toast(`🃏 ${U.cards(made)} в «${d ? d.name : ''}»${warn ? ' · ⚠️ перевод машинный — перепроверьте' : ''}`, 'good', 5000);
        if (Study._lastFail) UI.toast(`Часть перевода не пришла: ${Study._lastFail.error}. Перевод можно добавить потом: откройте карточку → «По предложениям»`, 'warn', 8000);
      };
    },

    /* ---------- 🆕 new words → cards ---------- */
    lemmaCache() { if (!this._lc) { try { this._lc = JSON.parse(localStorage.getItem('nk-lemma') || '{}'); } catch (e) { this._lc = {}; } } return this._lc; },
    /** a form from the text → its dictionary form (husene → hus, kjørte → kjøre) via Ordbøkene */
    async lemma(w) {
      const c = this.lemmaCache();
      if (c[w] !== undefined) return c[w];
      // offline first: the Norsk ordbank lexicon in the app (no network); Ordbøkene only for words it does not know
      if (window.Lexicon) { try { const lx = await Lexicon.lemma(w); if (lx) { c[w] = String(lx).toLowerCase(); return c[w]; } } catch (e) { /* not loaded — online below */ } }
      let l = w;
      try {
        const j = await (await fetch(`https://ord.uib.no/api/suggest?q=${encodeURIComponent(w)}&dict=bm&n=5&include=ei&dform=int`)).json();
        const a = (j && j.a) || {};
        const ex = (a.exact || []).map(x => Array.isArray(x) ? x[0] : x);
        const inf = (a.inflect || []).map(x => Array.isArray(x) ? x[0] : x);
        if (ex.some(x => String(x).toLowerCase() === w)) l = w;
        else if (inf.length) l = String(inf[0]).toLowerCase();
        else if (!ex.length) l = '';
      } catch (e) { /* offline: keep the form */ }
      c[w] = l;
      return l;
    },
    known() {
      const k = new Set();
      Store.cards().forEach(c => String(c.no).split('\n')[0].toLowerCase().replace(/^(en|ei|et|å)\s+/, '').split(/[,/;]/).forEach(x => { x = x.trim(); if (x) k.add(x); }));
      return k;
    },
    async wordsDialog(rec) {
      const from0 = rec.last, ask = await UI.prompt('Новые слова — со страниц (например «12» или «12-15»)', String(from0), 'номер страницы или диапазон');
      if (ask == null) return;
      const mm = String(ask).match(/(\d+)\s*(?:[-–—]\s*(\d+))?/);
      const a = U.clamp(mm ? +mm[1] : from0, 1, rec.n), b = U.clamp(mm && mm[2] ? +mm[2] : a, a, Math.min(rec.n, a + 19));
      const dm = UI.modal({ title: `🆕 Новые слова · стр. ${a}${b > a ? '–' + b : ''}`, cls: 'wide', body: '<div data-w><div class="small muted"><span class="spinner sm"></span> собираю слова…</div></div>' });
      const box = dm.$('[data-w]');
      const log = t => { box.innerHTML = `<div class="small muted"><span class="spinner sm"></span> ${U.esc(t)}</div>`; };
      try {
        // 1) every word of the pages with the sentence it is in
        const found = new Map();
        await hfPrime(rec, a);
        for (let p = a; p <= b; p++) {
          log(`читаю стр. ${p}…`);
          paras(await pageText(rec, p, log), rec).forEach(pa => (pa.k === 'h' ? [pa.t] : Study.splitSent(pa.t)).filter(isNo).forEach(s => {
            Study.glossToks(s).forEach((w, k) => {
              const bare = w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
              const low = bare.toLowerCase();
              if (low.length < 2 || !/^[\p{L}-]+$/u.test(bare) || NoGloss.has(low) || Study.isName(w, k) || /^\p{Lu}+$/u.test(bare) && bare.length > 1) return;
              const f = found.get(low);
              if (f) f.n++; else found.set(low, { form: low, n: 1, sent: s, page: p });
            });
          }));
        }
        if (!found.size) { box.innerHTML = '<div class="muted">На этих страницах не нашлось норвежских слов.</div>'; return; }
        // 2) dictionary form (Ordbøkene) and what you already have
        const known = this.known();
        const forms = [...found.values()];
        let done = 0;
        const lemmas = new Map();
        await (async () => {
          let i = 0;
          await Promise.all(Array.from({ length: 6 }, async () => {
            while (i < forms.length) {
              const f = forms[i++];
              const l = await this.lemma(f.form);
              done++; if (done % 8 === 0) log(`ищу словарную форму: ${done} из ${forms.length}…`);
              if (!l) continue; // not a Norwegian word (typo, OCR noise)
              if (known.has(l) || known.has(f.form)) continue;
              const e = lemmas.get(l);
              if (e) { e.n += f.n; if (!e.forms.includes(f.form)) e.forms.push(f.form); }
              else lemmas.set(l, { no: l, forms: [f.form], n: f.n, sent: f.sent, page: f.page });
            }
          }));
        })();
        try { localStorage.setItem('nk-lemma', JSON.stringify(this.lemmaCache())); } catch (e) { /* full */ }
        const list = [...lemmas.values()].sort((x, y) => x.page - y.page);
        if (!list.length) { box.innerHTML = '<div class="muted">🎉 Все слова этих страниц уже есть в ваших карточках.</div>'; return; }
        // 3) translation: AI with the sentence (and en/ei/et/å), else the dictionary list + machine translation
        log(`перевожу ${list.length} слов…`);
        let by = [];
        if (AI.available()) {
          try {
            for (let k = 0; k < list.length; k += 30) {
              const part = list.slice(k, k + 30);
              const arr = AI.parseJSON(await AI.call({ system: 'You are a Norwegian–Russian dictionary for A1–A2 learners.',
                user: `For each Norwegian word give: "no" — the dictionary form with en/ei/et for nouns and å for verbs (e.g. "en bil", "å kjøre"), "ru" — the Russian meaning it has in the given sentence (1–3 words). Return ONLY a JSON array of {"no","ru"}, same order.\n${JSON.stringify(part.map(x => ({ word: x.no, sentence: x.sent })))}`,
                maxTokens: 200 + part.length * 40, temperature: 0 }));
              part.forEach((x, j) => { const r = Array.isArray(arr) && arr[j]; if (r && r.ru) { x.ru = String(r.ru).trim(); if (r.no && U.norm(String(r.no)).replace(/^(en|ei|et|å) /, '') === U.norm(x.no)) x.noFull = String(r.no).trim(); } });
            }
            by = ['ai']; Translators.lastAI = AI.lastProvider;
          } catch (e) { /* machine translation below */ }
        }
        const rest = list.filter(x => !x.ru);
        if (rest.length) {
          const res = await Translators.translateMany(rest.map(x => x.no), 'no', 'ru');
          rest.forEach((x, j) => { x.ru = NoGloss.get(x.no) || Study.cleanGloss(x.no, res.out[j]) || ''; });
          by = [...new Set(by.concat(res.by))];
        }
        // the sentence translations (for the example on the card)
        await Study.translateUnits(list.map(x => x.sent), []);
        this.wordsPick(dm, rec, list, by);
      } catch (e) { box.innerHTML = `<div class="mt-warn"><span>⚠️</span><span>${U.esc(U.niceErr(e))}</span></div>`; }
    },
    wordsPick(dm, rec, list, by) {
      const box = dm.$('[data-w]');
      const decks = Store.decks();
      const def = decks.find(d => d.textbook === rec.title) || decks.find(d => d.name === `📘 ${rec.title}`);
      box.innerHTML = `
        <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
          <b>${list.length} ${U.plural(list.length, ['новое слово', 'новых слова', 'новых слов'])}</b>
          <button class="btn sm" data-all>☑ Все</button><button class="btn sm ghost" data-none>Снять</button>
          <span class="grow"></span>
          <label class="small">Колода: <select class="input" data-deck style="max-width:240px">${decks.map(d => `<option value="${d.id}" ${def && def.id === d.id ? 'selected' : ''}>${U.esc(d.name)}</option>`).join('')}<option value="__new" ${def ? '' : 'selected'}>➕ «📘 ${U.esc(rec.title)}»</option></select></label>
        </div>
        <div class="tb-words">${list.map((x, i) => `<label class="tb-word">
          <input type="checkbox" data-i="${i}" checked>
          <span class="tb-w-no"><b>${U.esc(x.noFull || x.no)}</b>${x.forms.some(f => f !== x.no) ? `<small class="muted"> · в тексте: ${U.esc(x.forms.filter(f => f !== x.no).slice(0, 3).join(', '))}</small>` : ''}</span>
          <input class="input tb-w-ru" data-ru="${i}" value="${U.esc(x.ru || '')}" placeholder="перевод">
          <span class="tb-w-ex small muted">«${U.esc(x.sent.slice(0, 140))}» · стр. ${x.page}</span>
        </label>`).join('')}</div>
        ${Translators.machineWarnHtml(by, false)}
        <div class="row" style="gap:8px;margin-top:10px"><button class="btn primary" data-make>➕ Создать карточки</button><span class="small muted" data-cnt></span></div>`;
      const cnt = () => { box.querySelector('[data-cnt]').textContent = `выбрано: ${box.querySelectorAll('[data-i]:checked').length}`; };
      cnt();
      box.addEventListener('change', cnt);
      box.querySelector('[data-all]').onclick = () => { box.querySelectorAll('[data-i]').forEach(x => { x.checked = true; }); cnt(); };
      box.querySelector('[data-none]').onclick = () => { box.querySelectorAll('[data-i]').forEach(x => { x.checked = false; }); cnt(); };
      box.querySelector('[data-make]').onclick = async () => {
        const pick = [...box.querySelectorAll('[data-i]:checked')].map(x => +x.dataset.i);
        if (!pick.length) { UI.toast('Отметьте слова', 'warn'); return; }
        let deckId = box.querySelector('[data-deck]').value;
        if (deckId === '__new') { const d = Store.addDeck(`📘 ${rec.title}`, `Слова из учебника «${rec.title}»`); Store.updateDeck(d.id, { textbook: rec.title }); deckId = d.id; }
        const c = Study.exCache();
        const warn = Translators.mtFlag(by);
        pick.forEach(i => {
          const x = list[i];
          const ru = (box.querySelector(`[data-ru="${i}"]`).value || '').trim();
          Store.addCard(deckId, {
            no: x.noFull || x.no, ru, example: x.sent, exampleRu: c['s:' + x.sent] || '',
            description: `📘 «${rec.title}», стр. ${x.page}${x.forms.some(f => f !== x.no) ? ` · в тексте: ${x.forms.join(', ')}` : ''}`,
            tags: ['textbook'],
            history: [Prov.entry('import', 'create', null, `учебник «${rec.title}», стр. ${x.page}`), ...Translators.provKeys(by).map(k => Prov.entry(k, 'translate', null, 'перевод слова и примера из учебника'))],
            mtWarn: warn,
          });
        });
        rec.cards = (rec.cards || 0) + pick.length; put(rec).catch(() => {});
        await Store.saveNow();
        dm.close();
        UI.toast(`➕ ${U.cards(pick.length)} из «${rec.title}»${warn ? ' · ⚠️ перевод машинный — перепроверьте' : ''}`, 'good', 5000);
        App.render();
      };
    },

    /* ---------- ✍️ self-check on the page (AI) ---------- */
    async quiz(rec, btn) {
      if (!AI.available()) { Guides.needAI('Проверь себя'); return; }
      const text = this.sentences().join(' ').slice(0, 3500);
      if (letters(text) < 40) { UI.toast('На странице слишком мало текста для вопросов', 'warn'); return; }
      const box = this._m.$('[data-extra]');
      btn.disabled = true;
      box.innerHTML = `<div class="panel tb-quiz"><span class="spinner sm"></span> ${U.esc(AI.name())} составляет вопросы по странице…</div>`;
      try {
        const qs = AI.parseJSON(await AI.call({ system: 'You are a friendly Norwegian teacher (level A1–A2) for a Russian speaker.',
          user: `Text from a textbook page:\n"""${text}"""\nMake 5 short questions in simple Norwegian about this text (comprehension and the key words/grammar of the page). Return ONLY JSON array: [{"q":"question in Norwegian","q_ru":"the same in Russian","a":"a short model answer in Norwegian"}]`,
          maxTokens: 900, temperature: 0.3 }));
        if (!Array.isArray(qs) || !qs.length) throw new Error('нейросеть не вернула вопросы');
        box.innerHTML = `<div class="panel tb-quiz"><h3>✍️ Проверь себя · стр. ${rec.last} <span class="small muted">· ${U.esc(AI.name(AI.lastProvider))}</span></h3>
          ${qs.map((q, i) => `<div class="tb-q"><div><b>${i + 1}. ${U.esc(q.q)}</b> <button class="icon-btn sm ex-say" data-say="${U.esc(q.q)}" data-lang="no">🔊</button></div>
            <div class="small muted">${U.esc(q.q_ru || '')}</div>
            <input class="input" data-ans="${i}" placeholder="Ответ по-норвежски" autocomplete="off" autocapitalize="off" spellcheck="false">
            <div class="tb-fb" data-fb="${i}"></div></div>`).join('')}
          <div class="row" style="gap:8px"><button class="btn primary" data-check>Проверить ответы</button><button class="btn ghost" data-show>Показать ответы</button></div></div>`;
        box.querySelector('[data-show]').onclick = () => qs.forEach((q, i) => { box.querySelector(`[data-fb="${i}"]`).innerHTML = `💡 ${U.esc(q.a)}`; });
        box.querySelector('[data-check]').onclick = async ev => {
          const b = ev.currentTarget; b.disabled = true; b.innerHTML = '<span class="spinner sm"></span> проверяю…';
          const ans = qs.map((q, i) => ({ q: q.q, model: q.a, answer: box.querySelector(`[data-ans="${i}"]`).value.trim() }));
          try {
            const res = AI.parseJSON(await AI.call({ system: 'You are a kind Norwegian teacher for a Russian speaker (A1–A2).',
              user: `Check the learner's answers. For each return {"ok":true|false,"fix":"corrected Norwegian answer (or the model answer if empty)","note":"short explanation in Russian of the mistake or praise"}. Return ONLY a JSON array, same order.\n${JSON.stringify(ans)}`,
              maxTokens: 900, temperature: 0 }));
            (res || []).forEach((r, i) => { const el = box.querySelector(`[data-fb="${i}"]`); if (el) el.innerHTML = `${r.ok ? '✅' : '❌'} ${U.esc(r.fix || '')} <span class="small muted">${U.esc(r.note || '')}</span>`; });
          } catch (err) { UI.toast(err.message, 'warn'); }
          b.disabled = false; b.textContent = 'Проверить ещё раз';
        };
      } catch (e) { box.innerHTML = ''; UI.toast(e.message, 'bad', 6000); }
      btn.disabled = false;
    },
  };

  window.Textbook = Textbook;
})();
