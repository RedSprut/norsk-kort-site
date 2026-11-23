/* ============ 📖 Читалка: your own books — read, listen with two voices, tap a word for its translation ============
 * Books are loaded from the device (PDF with a text layer, EPUB, TXT, DOCX, FB2, HTML) and kept ONLY on this device
 * (IndexedDB «norsk-kort-reader»: meta and text in separate stores — the shelf never loads whole books).
 * Reading: pages (CSS columns, one or two on wide screens) or one long ribbon; size, line height, width, font,
 * app theme or sepia. Every sentence is its own unit; a bracketed translation «(Жил-был король.)» right after a
 * Norwegian sentence is a unit of its own. Read aloud: each piece in its own voice (Norwegian / Russian /
 * Ukrainian) through TTS.speak — no own speech engine; the sentence being read is highlighted and followed, and inside it
 * the word being said (🎤 «бегущая подсветка слов», karPaint — on by default, «Aa» → off).
 * Position (sentence + book page) is saved per book; on opening: «continue / start over».
 * Books with their real look (v232): EPUB 2/3, FB2, MOBI, AZW3/KF8, HTML go through js/rdformat.js — pictures (blob:
 * URLs, tap to zoom), italic / bold / small caps / sup / sub, lists, tables, quotations, poetry, internal links,
 * footnotes in a pop-up, the book's own nested table of contents; the book's HTML never reaches the page (rebuilt from
 * plain blocks). DjVu (js/djvu.js — our own decoder in a Web Worker) opens in a page view with the hidden text layer
 * (js/rddjvu.js). 🔖 bookmarks, highlights in five colours, notes, the panel «Закладки и заметки» (Markdown, «в карточки»),
 * 🔎 search in the whole book (in chunks — a long book never freezes), themes: app / sepia / OLED black / e-ink.
 * Places, marks and notes follow the account on every device (js/rdsync.js through js/cloudsync.js); the book file
 * itself is kept on the device (IndexedDB «files») and travels in the background.
 * Public: window.Reader = { open(), openBook(id), importFiles(files) }.
 */
(function () {
  const DBN = 'norsk-kort-reader';
  const PREF_KEY = 'nk-reader';
  const ACCEPT = '.pdf,.epub,.txt,.text,.md,.docx,.fb2,.html,.htm,.xhtml,.mobi,.azw,.azw3,.prc,.pdb,.kfx,.djvu,.djv,application/pdf,application/epub+zip,text/plain,text/html,image/vnd.djvu,application/x-mobipocket-ebook';
  const CLOSED = { doc: 'Word 97–2003 (.doc)', pages: 'Apple Pages', rtf: 'RTF', odt: 'ODT' };
  const KINDLE = /^(mobi|azw|azw3|prc|pdb|kfx)$/;
  const MIME = { epub: 'application/epub+zip', fb2: 'application/x-fictionbook+xml', mobi: 'application/x-mobipocket-ebook', azw: 'application/vnd.amazon.ebook', azw3: 'application/vnd.amazon.ebook', prc: 'application/x-mobipocket-ebook', pdb: 'application/x-mobipocket-ebook', djvu: 'image/vnd.djvu', djv: 'image/vnd.djvu', pdf: 'application/pdf', txt: 'text/plain', md: 'text/plain', html: 'text/html', htm: 'text/html', xhtml: 'text/html', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  const TEXT_KINDS = new Set(['h', 'p', 'q', 'v', 'li', 'pre']);
  /** our own helper scripts, loaded on first use (the app's start stays light) */
  const loaded = {};
  function need(name) {
    const glob = { rdformat: 'RdFormat', mobi: 'MobiBook', djvu: 'DjVuDoc', rddjvu: 'RdDjvu' }[name];
    if (window[glob]) return Promise.resolve(window[glob]);
    if (!loaded[name]) {
      loaded[name] = new Promise((res, rej) => {
        const sc = document.createElement('script');
        sc.src = `js/${name}.js?v=231`;
        sc.onload = () => (window[glob] ? res(window[glob]) : rej(new Error('noglobal')));
        sc.onerror = () => rej(new Error('noload'));
        document.head.appendChild(sc);
      });
      loaded[name].catch(() => { delete loaded[name]; });
    }
    return loaded[name];
  }
  const PAGE_CHARS = 1500;      // a «book page»: the same number on every screen and in both modes
  const SECTION_CHARS = 14000;  // how much text is laid out at once (big books stay light)
  const RM = () => { try { return P.skin === 'eink' || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
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
        const r = indexedDB.open(DBN, 2);
        r.onupgradeneeded = () => {
          const d = r.result;
          if (!d.objectStoreNames.contains('books')) d.createObjectStore('books', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('texts')) d.createObjectStore('texts', { keyPath: 'id' });
          if (!d.objectStoreNames.contains('files')) d.createObjectStore('files', { keyPath: 'id' }); // v232: the book file itself (sync, DjVu)
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
    add: (m, text, file) => tx(['books', 'texts', 'files'], 'readwrite', t => { t.objectStore('books').put(m); t.objectStore('texts').put(text); if (file) t.objectStore('files').put(file); }),
    del: id => tx(['books', 'texts', 'files'], 'readwrite', t => { t.objectStore('books').delete(id); t.objectStore('texts').delete(id); t.objectStore('files').delete(id); }),
    file: id => tx(['files'], 'readonly', t => t.objectStore('files').get(id)),
    putText: text => tx(['texts'], 'readwrite', t => { t.objectStore('texts').put(text); }),
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
  // 🎨 the reading surface: the app's own theme, sepia, true black (OLED), e-ink (pure black on white, no motion, pages)
  const SKINS = [['app', 'Как в приложении'], ['sepia', 'Сепия'], ['oled', 'Чёрный (OLED)'], ['eink', 'E-ink']];
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
      if (!TEXT_KINDS.has(k)) return; // pictures, tables, separators: drawn, not read aloud
      const parts = k === 'h' ? [{ text: t, tr: false }] : paraUnits(t);
      let at = 0;
      parts.forEach(x => {
        // where the sentence sits in its block (formatting, highlights, search hits are kept in block offsets)
        let o = t.indexOf(x.text, at);
        if (o < 0) { const head = x.text.slice(0, 24); o = head ? t.indexOf(head, at) : -1; if (o >= 0 && t.slice(o, o + x.text.length) !== x.text) o = -1; }
        if (o >= 0) at = o + x.text.length;
        units.push({ i: units.length, b, k, o, text: x.text, tr: x.tr, cyr: scriptOf(x.text) === 'cyr', p: Math.floor(chars / PAGE_CHARS) + 1 });
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
    // every block belongs to a part (a picture before the first sentence, after the last one)
    secs.forEach((x, j) => { x.u1 = j + 1 < secs.length ? secs[j + 1].u0 - 1 : units.length - 1; x.b1 = j + 1 < secs.length ? secs[j + 1].b0 - 1 : blocks.length - 1; });
    if (secs.length) secs[0].b0 = 0;
    return { blocks, units, secs, bStart, pages: units.length ? units[units.length - 1].p : 1, uk: !!uk };
  }
  /** the unit at a stable place (block + offset) — the place saved on one device opens the same sentence on another */
  function unitAt(M, b, o) {
    b = clamp(b | 0, 0, Math.max(0, M.blocks.length - 1));
    let i = M.bStart[b];
    while (i >= M.units.length && b > 0) i = M.bStart[--b];
    if (i >= M.bStart[b + 1]) { // a picture / table: the next sentence after it
      let k = b + 1; while (k < M.blocks.length && M.bStart[k + 1] <= M.bStart[k]) k++;
      return clamp(M.bStart[Math.min(k, M.blocks.length - 1)] || 0, 0, M.units.length - 1);
    }
    for (let j = i; j < M.bStart[b + 1]; j++) if (M.units[j].o >= 0 && M.units[j].o <= o) i = j;
    return clamp(i, 0, M.units.length - 1);
  }
  const locOf = (M, i) => { const u = M.units[clamp(i, 0, M.units.length - 1)]; return u ? { b: u.b, o: Math.max(0, u.o) } : { b: 0, o: 0 }; };
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
  /** EPUB / FB2 / MOBI / AZW3 / HTML with their real look (js/rdformat.js); an unexpected failure → the plain text reader */
  async function readRich(file, ext, busy) {
    let RF;
    try { RF = await need('rdformat'); if (KINDLE.test(ext)) await need('mobi'); } catch (e) { RF = null; }
    if (!RF) {
      if (KINDLE.test(ext)) throw friendly('Помощник для книг Kindle не загрузился — проверьте интернет и попробуйте ещё раз');
      return null;
    }
    let r;
    try {
      if (ext === 'epub' || file.type === 'application/epub+zip') r = await RF.epub(file, busy);
      else if (ext === 'fb2') r = await RF.fb2(file, busy);
      else if (KINDLE.test(ext)) r = await RF.mobi(file, busy);
      else {
        const raw = window.U && U.decodeText ? U.decodeText(await file.arrayBuffer()) : await file.text();
        r = await RF.html(raw, file.name || 'index.html');
      }
    } catch (e) {
      if (e && e.friendly) throw e;
      console.warn('rdformat', e);
      if (KINDLE.test(ext)) throw friendly('Не получилось прочитать эту книгу Kindle. Попробуйте другой файл этой книги (EPUB, AZW3 или MOBI)');
      return null; // the plain reader below tries
    }
    const cover = r.coverBlob ? await smallCover(r.coverBlob) : '';
    return { title: r.title || '', author: r.author || '', lang: r.lang || '', blocks: r.blocks, cover, rich: { anchors: r.anchors || {}, notes: r.notes || {}, toc: r.toc || [], res: r.res || {} } };
  }
  /** DjVu: pages are pictures; the hidden text layer (if any) is what is searched and translated */
  async function readDjvu(file, busy) {
    let D;
    try { D = await need('djvu'); } catch (e) { throw friendly('Помощник для DjVu не загрузился — проверьте интернет и попробуйте ещё раз'); }
    let doc;
    try { doc = await D.open(await file.arrayBuffer()); } catch (e) {
      const c = e && e.code;
      throw friendly(c === 'indirect' ? 'Это «многофайловый» DjVu (страницы лежат отдельными файлами). Соберите его в один файл (например, программой DjVuLibre «djvmcvt -b») и загрузите снова'
        : c === 'notdjvu' ? 'Этот файл не похож на DjVu — попробуйте другой файл этой книги' : 'Файл DjVu повреждён — попробуйте другой файл этой книги');
    }
    try {
      let outline = [];
      try { outline = await doc.outline(); } catch (e) { outline = []; }
      let cover = '';
      try {
        if (busy) busy.set('рисую обложку', 1, 2);
        const pg = await doc.render(0, { width: 420 });
        const cv = document.createElement('canvas'); cv.width = pg.width; cv.height = pg.height;
        const cx = cv.getContext('2d');
        if (pg.bitmap instanceof ImageData) cx.putImageData(pg.bitmap, 0, 0); else cx.drawImage(pg.bitmap, 0, 0);
        cover = cv.toDataURL('image/jpeg', 0.78);
      } catch (e) { cover = ''; }
      const sizes = []; for (let i = 0; i < doc.pages; i++) { const f = doc.info(i); sizes.push([f.width, f.height, f.dpi]); }
      return { title: '', author: '', cover, djvu: { pages: doc.pages, hasText: !!doc.hasText, outline, sizes } };
    } finally { try { doc.close(); } catch (e) { /* closed */ } }
  }
  async function readFile(file, busy) {
    const name = file.name || 'Книга';
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (CLOSED[ext]) throw friendly(`${CLOSED[ext]} браузер прочитать не может. Сохраните книгу как EPUB, PDF или TXT (например, бесплатной программой Calibre) и загрузите снова`);
    let r = null;
    if (ext === 'djvu' || ext === 'djv' || /djvu/.test(file.type)) {
      r = await readDjvu(file, busy);
      if (!r.title) r.title = name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim() || 'Книга';
      r.blocks = []; r.chars = 0; r.langs = []; r.uk = false;
      return r;
    }
    if (ext === 'epub' || ext === 'fb2' || KINDLE.test(ext) || /^(html?|xhtml)$/.test(ext) || file.type === 'application/epub+zip' || /html/.test(file.type)) r = await readRich(file, ext, busy);
    if (r) { /* the real look */ }
    else if (ext === 'pdf' || file.type === 'application/pdf') r = await readPdf(file, busy);
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
    } else throw friendly(`Файлы .${ext} читалка не открывает. Подходят: PDF, EPUB, FB2, MOBI, AZW3, DjVu, TXT, DOCX, HTML`);
    r.blocks = r.rich ? r.blocks : normBlocks(r.blocks); // rich blocks keep their offsets (links, formatting) as they are
    const all = r.blocks.filter(b => TEXT_KINDS.has(b[0])).map(b => b[1]).join(' ');
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
    get toc() { return NI('toc', 20); },
    more: '<svg class="ico" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>',
    // the drawn family of the app (js/app.js NavIcons.icon) — never an emoji in the reader's chrome
    get search() { return NI('search', 20); }, get bookmark() { return NI('bookmark', 20); }, get notes() { return NI('note', 20); },
    get highlight() { return NI('highlight', 18); }, get theme() { return NI('theme', 18); }, get close() { return NI('close', 18); },
    get zin() { return NI('zoom-in', 20); }, get zout() { return NI('zoom-out', 20); }, get trash2() { return NI('trash', 18); },
    get md() { return NI('download', 18); }, get cards() { return NI('copy', 18); },
  };
  function NI(n, s) { return window.NavIcons && NavIcons.icon ? NavIcons.icon(n, s) : ''; }

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
    keysNote(list);
    list.sort((a, b) => {
      // books added together («Добавить всю книгу») and not opened yet keep the book's own order: chapter 1, 2, 3…
      if (!a.opened && !b.opened && Math.abs((a.added || 0) - (b.added || 0)) < 120000)
        return String(a.title || '').localeCompare(String(b.title || ''), 'nb', { numeric: true });
      return (b.opened || b.added || 0) - (a.opened || a.added || 0);
    });
    box.innerHTML = `
      <div class="rd-intro"><span aria-hidden="true">📖</span><span>Загрузите свои книги — норвежские, двуязычные, сказки с переводом в скобках. Читайте страницами или лентой, слушайте двумя голосами: норвежский текст — норвежским, перевод — русским или украинским.
        <b>Книги хранятся на этом устройстве.</b> Если вы вошли в аккаунт, закладки, выделения, заметки и место чтения появятся на всех ваших устройствах, а файл книги — в вашем личном облаке (его видите только вы).</span></div>
      <div class="rd-cloud" data-rd-cloud aria-live="polite">${esc(cloudLine())}</div>
      ${failed ? '<div class="rd-note">Этот браузер сейчас не даёт сохранять книги (например, в приватном режиме). Книгу можно открыть и читать, но после закрытия её придётся загрузить снова.</div>' : ''}
      <label class="rd-drop" tabindex="0" role="button" aria-label="Добавить книгу с устройства">
        <input type="file" multiple accept="${ACCEPT}" hidden data-rd-file>
        <span class="rd-drop-ico" aria-hidden="true">📥</span>
        <b>Добавить книгу</b>
        <span class="rd-drop-sub">Выберите файл или перетащите его сюда · EPUB · FB2 · MOBI · AZW3 · DjVu · PDF · TXT · DOCX · HTML</span>
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
      const ok = await UI.confirm(`Удалить книгу «${esc(meta.title)}» с этого устройства?<br><span class="small muted">${DEL_NOTE}</span>`, { danger: true, ok: 'Да, удалить', title: 'Удалить книгу?' });
      if (!ok) return;
      if (R && R.meta.id === id) { R.forceClose = true; R.m.close(); }
      if (meta.key && window.RdSync) RdSync.forget(meta.key);
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
    if (importing) {
      if (o && o.quiet) { while (importing) await sleep(400); } // a book from the cloud waits its turn
      else { toast('Подождите — предыдущая книга ещё загружается', 'warn'); return null; }
    }
    importing = true;
    if (!shelfM && !(o && (o.noShelf || o.quiet))) { try { await openShelf(); } catch (e) { /* no shelf — still import */ } }
    let lastId = null, added = 0;
    try {
      for (const f of files) {
        const quiet = !!(o && o.quiet);
        const busy = !quiet && UI.busy ? UI.busy(`Загружаю книгу «${String(f.name || '').replace(/\.[^.]+$/, '').slice(0, 60)}»…`) : { set() {}, close() {} };
        try {
          // the book key: the file's own hash — the same book has the same marks on every device
          let key = '';
          try { key = window.RdSync ? await RdSync.hashFile(f) : ''; } catch (e) { key = ''; }
          let list0 = [];
          try { list0 = (await DB.list()) || []; } catch (e) { /* no storage */ }
          const twin = key && list0.find(x => x.key === key);
          if (twin) { if (!quiet) toast(`«${twin.title}» уже есть на полке`, '', 2600); lastId = twin.id; continue; }
          const r = await readFile(f, busy);
          const ex = Object.assign({}, extra, f._rdExtra || {});
          if (ex.title) r.title = ex.title;
          if (ex.author) r.author = ex.author;
          const same = list0.find(x => (ex.srcId && x.srcId === ex.srcId) || (!r.djvu && x.title === r.title && x.chars === r.chars && !x.key));
          if (same) {
            if (ex.srcId && !same.srcId) { try { same.srcId = String(ex.srcId).slice(0, 300); await DB.putMeta(same); } catch (e) { /* recognised by the title anyway */ } }
            if (!quiet) toast(`«${r.title}» уже есть на полке`, '', 2600); lastId = same.id; continue;
          }
          const M = buildModel(r.blocks, r.uk);
          const ext = (f.name.split('.').pop() || '').toLowerCase();
          const meta = { id: uid(), title: r.title, author: r.author || '', ext, size: f.size, chars: r.chars,
            langs: r.langs, uk: r.uk, cover: r.cover || '', added: Date.now(), opened: 0, pos: 0, pct: 0, pages: r.djvu ? r.djvu.pages : M.pages, units: M.units.length,
            fmt: r.djvu ? 'djvu' : r.rich ? 'rich' : 'plain' };
          if (key) meta.key = key;
          if (ex.srcId) meta.srcId = String(ex.srcId).slice(0, 300);
          const text = Object.assign({ id: meta.id, blocks: r.blocks }, r.rich || {}, r.djvu ? { djvu: r.djvu } : {});
          // pictures and the file as plain bytes: Safari (private windows, older versions) cannot keep a Blob in IndexedDB
          if (text.res) text.res = await bytesOf(text.res);
          // the file itself stays on the device: DjVu pages are drawn from it, the other devices get it from the cloud
          const mime = MIME[ext] || f.type || 'application/octet-stream';
          const fileRec = key && (r.djvu || f.size <= 60 * 1024 * 1024) ? { id: meta.id, h: key, buf: await f.arrayBuffer(), name: f.name, type: mime } : null;
          if (key && window.RdSync) {
            RdSync.unforget(key);
            RdSync.ensure(key, { t: meta.title, a: meta.author, n: meta.chars || 0, ext, f: fileRec ? { h: key, size: f.size, mime, name: String(f.name || '').slice(0, 200) } : null });
            const pos = RdSync.getPos(key); // read on another device already: the same place here
            if (pos && !r.djvu && M.units.length) { meta.pos = unitAt(M, pos.b, pos.o); meta.pct = pos.pct || 0; meta.posAt = pos.at; }
            else if (pos && r.djvu) { meta.pos = clamp(pos.b, 0, r.djvu.pages - 1); meta.pct = pos.pct || 0; meta.posAt = pos.at; }
          }
          try {
            await DB.add(meta, text, fileRec);
            try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* not supported */ }
          } catch (e) {
            const full = /quota/i.test(String((e && e.name) || '') + (e && e.message));
            toast(full ? 'На устройстве не хватает места для этой книги' : 'Книга открыта, но браузер не дал её сохранить — после закрытия её придётся загрузить снова', 'warn', 8000);
            if (full) continue;
            TEMP.set(meta.id, { meta, text, file: fileRec });
          }
          lastId = meta.id; added++;
        } catch (e) {
          if (!quiet) toast(e && e.friendly ? e.message : `Не получилось открыть «${f.name}». Попробуйте другой файл этой книги (лучше EPUB или PDF с настоящим текстом)`, 'warn', 8000);
          else console.warn('reader: a book from the cloud', e && e.message);
        } finally { busy.close(); }
      }
    } finally { importing = false; }
    await drawShelf();
    if (o && o.quiet) return lastId;
    if (added > 1) toast(`На полку добавлено книг: ${added}`, 'good');
    if (lastId && files.length === 1) openBook(lastId, { fresh: added === 1 });
    return lastId;
  }
  const TEMP = new Map(); // books the browser refused to keep (private mode): readable during this visit
  /** { key: Blob } → { key: { b: ArrayBuffer, t: type } } and back (a stored book's pictures; a stored file) */
  async function bytesOf(res) { const o = {}; for (const k of Object.keys(res || {})) { const v = res[k]; try { o[k] = v instanceof Blob ? { b: await v.arrayBuffer(), t: v.type } : v; } catch (e) { /* that picture is skipped */ } } return o; }
  const blobOf = v => (!v ? null : v instanceof Blob ? v : v.b ? new Blob([v.b], { type: v.t || '' }) : v.buf ? new Blob([v.buf], { type: v.type || '' }) : v.blob || null);
  /* ---------- ☁️ book files for the other devices (js/rdsync.js): which books are here, their files, a book that came ---------- */
  const keysHere = new Set();
  function keysNote(list) { keysHere.clear(); (list || []).forEach(m => { if (m && m.key) keysHere.add(m.key); }); TEMP.forEach(x => { if (x.meta.key) keysHere.add(x.meta.key); }); }
  const cloudLine = () => (window.RdSync && RdSync.status.text) || '';
  if (window.RdSync) {
    DB.list().then(keysNote, () => {});
    RdSync.filesReady({
      have: key => keysHere.has(key),
      async get(h) {
        try { const m = ((await DB.list()) || []).find(x => x.key === h); const f = m && await DB.file(m.id); return blobOf(f); } catch (e) { return null; }
      },
      async add(blob, info) {
        const f = new File([blob], String(info.name || 'book').replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 120), { type: info.mime || blob.type || '' });
        await importFiles([f], { title: info.title || '', author: info.author || '' }, { quiet: true });
        try { keysNote((await DB.list()) || []); } catch (e) { /* next time */ }
      },
    });
    RdSync.on(what => {
      // the reader's settings chosen on another device: here too (open or not)
      if (what === 'settings') { try { applyRemoteSettings(); } catch (e) { /* next open */ } return; }
      if (what !== 'status') return;
      document.querySelectorAll('[data-rd-cloud]').forEach(el => { el.textContent = cloudLine(); });
    });
  }
  const DEL_NOTE = 'Файл книги удалится с этого устройства. Закладки, выделения и заметки сохранятся: если загрузить эту книгу снова, они вернутся. Карточки, сделанные из книги, останутся.';

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
        // hold: never while reading — the offer waits for a natural pause (chapter end / the book closed: rdPause)
        LearnBy.offer({ key: 'reader:' + id, hold: true, title: e.title, sub: e.author, page: pg, src: 'reader', id, open: () => openBook(id),
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
    if (!meta || !text || !(text.blocks || text.djvu)) { recentForget(id); toast('Эту книгу не получилось открыть — возможно, её удалили. Загрузите её снова', 'warn', 6000); drawShelf(); return; }
    // books added before v232: a key from the title and length, so their marks and place sync too
    if (!meta.key && window.RdSync) { meta.key = RdSync.keyOfText(meta.title, meta.chars); RdSync.ensure(meta.key, { t: meta.title, a: meta.author || '', n: meta.chars || 0, ext: meta.ext || '' }); putSoon(meta); }
    const rp = meta.key && window.RdSync ? RdSync.getPos(meta.key) : null;
    if (meta.fmt === 'djvu' || text.djvu) { openDjvu(meta, text, opts, rp); return; }
    const M = buildModel(text.blocks, meta.uk);
    if (!M.units.length) { toast('В этой книге не нашлось текста для чтения', 'warn'); return; }
    let start = clamp(meta.pos || 0, 0, M.units.length - 1);
    // read further on another device (a newer place): open there
    if (rp && rp.at > (meta.posAt || 0) + 1000) { start = unitAt(M, rp.b, rp.o); meta.pos = start; meta.posAt = rp.at; meta.pct = M.units.length > 1 ? start / (M.units.length - 1) : 1; }
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
    mountReader(meta, M, start, text);
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

  function mountReader(meta, M, start, text) {
    const state = R = {
      meta, M, cur: start, hl: -1, s0: 0, s1: 0, page: 0, nPages: 1, step: 1, per: 1, colW: 600, gap: 40,
      playing: false, tok: 0, gen: null, panel: null, panelEl: null, pop: null, userNav: 0, warnedRu: false, warnedUk: false, spans: [],
      rich: text && (text.anchors || text.res || text.toc) ? { anchors: text.anchors || {}, notes: text.notes || {}, toc: text.toc || [], res: text.res || {} } : null,
      urls: new Map(), key: meta.key || '', hlBy: new Map(), find: null,
    };
    marksIndex(state);
    const m = UI.modal({
      title: esc(meta.title), cls: 'rd-modal', body: readerHtml(),
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
        <button class="rd-hb" data-a="find" aria-label="Поиск по книге" title="Поиск по книге">${ICON.search}</button>
        <button class="rd-hb" data-a="bm" aria-label="Закладка на этой странице" aria-pressed="false" title="Закладка на этой странице">${ICON.bookmark}</button>
        <button class="rd-hb" data-a="marks" aria-label="Закладки и заметки" title="Закладки и заметки">${ICON.notes}</button>
        ${window.PrintX ? `<button class="rd-hb rd-print" data-a="print" aria-haspopup="dialog" aria-label="Печать и файлы: распечатать книгу или сохранить в Word" title="🖨 Печать и файлы — распечатать страницы книги или сохранить в Word">${ICON.print}</button>` : ''}
        <button class="rd-hb rd-aa" data-a="look" data-panel-btn="look" aria-label="Вид текста: размер, шрифт, фон" aria-expanded="false" title="Вид текста">Aa</button>
        <button class="rd-hb" data-a="menu" data-panel-btn="menu" aria-label="Меню книги" aria-expanded="false" title="Меню книги">${ICON.more}</button></div>`);
    }
    if (window.TrBadge) TrBadge.mount(m.$('.modal-head'), { place: 'reader' }); // 🌐 who translates now
    applyLook(state);
    // 🔖 marks / the place changed on another device (js/rdsync.js) → redrawn here
    state.offSync = window.RdSync ? RdSync.on((what, key) => onSync(state, what, key)) : null;
    state.selT = 0;
    state.onSel = () => { clearTimeout(state.selT); state.selT = setTimeout(() => selUi(state), 260); };
    document.addEventListener('selectionchange', state.onSel);
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
      if (state.selEl) { e.stopPropagation(); e.preventDefault(); selHide(state); try { getSelection().removeAllRanges(); } catch (err) { /* ignore */ } return; }
      if (state.panel) { e.stopPropagation(); e.preventDefault(); closePanel(state, true); return; }
      if (state.findEl) { e.stopPropagation(); e.preventDefault(); findClose(state); }
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
    rdPause(state, 450); // the book is closed: after the reader's window has gone
    const saved = flushSave();
    closePop(state); closePanel(state); selHide(state); findClose(state, true);
    if (state.offSync) state.offSync();
    document.removeEventListener('selectionchange', state.onSel);
    state.urls.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) { /* gone */ } });
    state.urls.clear();
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
  const isEink = () => P.skin === 'eink';
  /** e-ink: pages only (no smooth scrolling) */
  const modeNow = () => (isEink() ? 'page' : P.mode);
  function applyLook(st) {
    const el = st.m.el, root = st.root;
    el.dataset.skin = P.skin;
    root.dataset.mode = modeNow();
    root.toggleAttribute('data-eink', isEink());
    root.dataset.hls = P.hls;
    root.toggleAttribute('data-hidetr', !!P.hideTr);
    const hl = (PALETTE.find(x => x[0] === P.hl) || PALETTE[0])[2];
    root.style.setProperty('--rd-size', P.size + 'px');
    root.style.setProperty('--rd-lh', LH[clamp(P.lh, 0, LH.length - 1)]);
    root.style.setProperty('--rd-font', (FONTS[P.font] || FONTS.serif)[1]);
    root.style.setProperty('--rd-hl', hl);
    if (st.pop) st.pop.dataset.skin = P.skin;
    if (st.selEl) st.selEl.dataset.skin = P.skin;
  }
  /** column width, one or two columns (wide screens), page step */
  function measure(st) {
    const stageW = st.stage.clientWidth;
    const sides = modeNow() === 'page' && stageW >= 700;
    st.root.toggleAttribute('data-sides', sides);
    const avail = Math.max(200, stageW - (sides ? 2 * 64 : 2 * 18));
    const want = WIDTH_EM[clamp(P.width, 0, WIDTH_EM.length - 1)] * P.size;
    const gap = clamp(Math.round(avail * 0.06), 28, 72);
    const per = modeNow() === 'page' && avail >= 940 && (avail - gap) / 2 >= Math.min(want, 23 * P.size) ? 2 : 1;
    const colW = Math.floor(per === 2 ? Math.min(want, (avail - gap) / 2) : Math.min(want, avail));
    Object.assign(st, { per, colW, gap, step: per * colW + per * gap });
  }
  function relayout(st) {
    if (!st.flow || !document.body.contains(st.flow)) return;
    const keep = st.playing ? st.hl : st.cur;
    renderAt(st, keep >= 0 ? keep : st.cur, true);
  }

  /* ---------- rendering sections ---------- */
  /** inline pieces of a sentence: the book's own formatting, highlights, search hits — ranges in the unit's text.
   *  Every piece is rebuilt from text + a closed list of tags (nothing of the book's markup is ever copied). */
  const TAG_ORDER = ['a', 'hl', 'sr', 'i', 'b', 'sc', 'sup', 'sub', 'u', 's', 'code'];
  function richHtml(text, ranges) {
    if (!ranges.length) return esc(text);
    const cut = new Set([0, text.length]);
    const brs = new Set();
    ranges.forEach(r => { if (r[2] === 'br') { brs.add(r[0]); return; } cut.add(clamp(r[0], 0, text.length)); cut.add(clamp(r[1], 0, text.length)); });
    brs.forEach(p => cut.add(p + 1));
    const pts = [...cut].sort((a, b) => a - b);
    let h = '';
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k], z = pts[k + 1];
      if (z <= a) continue;
      const on = ranges.filter(r => r[2] !== 'br' && r[0] <= a && r[1] >= z);
      on.sort((x, y) => TAG_ORDER.indexOf(x[2]) - TAG_ORDER.indexOf(y[2]));
      let open = '', close = '';
      const seen = new Set();
      on.forEach(r => {
        const t = r[2], arg = r[3];
        if (seen.has(t)) return; seen.add(t);
        let o = '', c = '';
        if (t === 'a') {
          if (String(arg).startsWith('*')) { o = `<a class="rd-a rd-fnref" data-note="${esc(String(arg).slice(1))}" role="button" tabindex="0" aria-label="Сноска">`; c = '</a>'; }
          else { o = `<a class="rd-a" data-href="${esc(arg)}" role="link" tabindex="0">`; c = '</a>'; }
        } else if (t === 'hl') { o = `<mark class="rd-hl rd-hl-${esc(arg.c)}${arg.note ? ' rd-hl-n' : ''}" data-h="${esc(arg.id)}">`; c = '</mark>'; }
        else if (t === 'sr') { o = `<mark class="rd-sr${arg ? ' rd-sr-cur' : ''}">`; c = '</mark>'; }
        else if (t === 'i') { o = '<em>'; c = '</em>'; }
        else if (t === 'b') { o = '<strong>'; c = '</strong>'; }
        else if (t === 'sc') { o = '<span class="rd-sc">'; c = '</span>'; }
        else if (t === 'sup' || t === 'sub' || t === 'u' || t === 's' || t === 'code') { o = `<${t}>`; c = `</${t}>`; }
        open += o; close = c + close;
      });
      h += open + esc(text.slice(a, z)) + close + (brs.has(z - 1) ? '<br>' : '');
    }
    return h;
  }
  /** the ranges of one unit (unit offsets) from its block's formatting, the highlights and the search hits */
  function unitRanges(st, u) {
    const out = [];
    if (u.o < 0) return out;
    const a = u.o, z = u.o + u.text.length, x = st.M.blocks[u.b][2];
    const put = (s0, e0, tag, arg) => { const s1 = Math.max(s0, a), e1 = Math.min(e0, z); if (tag === 'br' ? s0 >= a && s0 < z : e1 > s1) out.push([s1 - a, (tag === 'br' ? s1 + 1 : e1) - a, tag, arg]); };
    if (x && x.m) x.m.forEach(r => put(r[0], r[1], r[2], r[3]));
    const hl = st.hlBy && st.hlBy.get(u.b);
    if (hl) hl.forEach(h => put(h.s, h.e, 'hl', h));
    const sr = st.find && st.find.byB && st.find.byB.get(u.b);
    if (sr) sr.forEach(r => put(r[0], r[1], 'sr', r[2] === st.find.cur));
    return out;
  }
  function blobUrl(st, key) {
    if (!st.rich || !st.rich.res || !st.rich.res[key]) return '';
    let u = st.urls.get(key);
    if (!u) { try { u = URL.createObjectURL(blobOf(st.rich.res[key])); st.urls.set(key, u); } catch (e) { u = ''; } }
    return u;
  }
  function blockHtml(st, b) {
    const M = st.M, blk = M.blocks[b], k = blk[0], x = blk[2] || {};
    const u0 = M.bStart[b], u1 = M.bStart[b + 1];
    const cls = (x.al === 'c' ? ' rd-al-c' : x.al === 'r' ? ' rd-al-r' : '') + (x.fn ? ' rd-fn' : '');
    if (k === 'img') {
      const src = blobUrl(st, x.src);
      if (!src) return '';
      const w = x.w || 0, h = x.h || 0;
      return `<figure class="rd-fig${w && w < 160 ? ' rd-fig-sm' : ''}" data-b="${b}"><img class="rd-img" src="${esc(src)}" alt="${esc(blk[1] || '')}"${w && h ? ` width="${w}" height="${h}" style="aspect-ratio:${w}/${h}"` : ''} loading="lazy" decoding="async" data-zoom="${b}" tabindex="0" role="button" aria-label="${esc(blk[1] ? 'Картинка: ' + blk[1] + ' — нажмите, чтобы увеличить' : 'Картинка — нажмите, чтобы увеличить')}"></figure>`;
    }
    if (k === 'hr') return '<hr class="rd-hr" aria-hidden="true">';
    if (k === 'tb') {
      const rows = (x.rows || []).map(r => `<tr>${r.map(c => { const t = c[1] ? 'th' : 'td'; return `<${t}${c[2] > 1 ? ` colspan="${c[2] | 0}"` : ''}>${esc(c[0])}</${t}>`; }).join('')}</tr>`).join('');
      return `<div class="rd-tbw" data-b="${b}"><table class="rd-tb">${rows}</table></div>`;
    }
    if (u1 <= u0) return '';
    let inner = '';
    for (let i = u0; i < u1; i++) {
      const u = M.units[i];
      inner += `<span class="rd-s${u.cyr ? ' rd-cyr' : ''}${u.tr ? ' rd-tr' : ''}" data-i="${i}"${u.cyr ? ` lang="${M.uk ? 'uk' : 'ru'}"` : ''}>${richHtml(u.text, unitRanges(st, u))}</span> `;
    }
    if (k === 'h') { const lv = clamp(x.lv || 2, 1, 6); return `<h3 class="rd-h rd-h${lv}${cls}" data-b="${b}">${inner}</h3>`; }
    if (k === 'q') return `<p class="rd-p rd-q${cls}" data-b="${b}">${inner}</p>`;
    if (k === 'v') return `<p class="rd-v${x.gap ? ' rd-gap' : ''}${cls}" data-b="${b}">${inner}</p>`;
    if (k === 'li') return `<p class="rd-li${cls}" data-b="${b}" data-mk="${esc(x.ol || '•')}" style="--lv:${clamp(x.lv || 1, 1, 6)}">${inner}</p>`;
    if (k === 'pre') return `<pre class="rd-pre${cls}" data-b="${b}">${inner}</pre>`;
    return `<p class="rd-p${cls}" data-b="${b}">${inner}</p>`;
  }
  function sectionHtml(st, j) {
    const M = st.M, s = M.secs[j];
    let h = '';
    for (let b = s.b0; b <= s.b1; b++) h += blockHtml(st, b);
    return `<div class="rd-sec" data-sec="${j}">${h}</div>`;
  }
  function renderSecs(st, s0, s1) {
    st.s0 = s0; st.s1 = s1;
    let h = '';
    if (modeNow() === 'scroll' && s0 > 0) h += `<div class="rd-edge"><button class="btn ghost rd-edge-btn" data-a="prevpart">↑ Показать предыдущую часть</button></div>`;
    for (let j = s0; j <= s1; j++) h += sectionHtml(st, j);
    if (modeNow() === 'scroll') h += st.s1 < st.M.secs.length - 1 ? '<div class="rd-edge" data-more><span class="rd-tiny">Дальше…</span></div>' : '<div class="rd-end" aria-hidden="true">❦</div>';
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
    if (modeNow() === 'page') {
      v.style.width = (st.per * st.colW + (st.per - 1) * st.gap) + 'px';
      fl.style.maxWidth = '';
      fl.style.columnWidth = st.colW + 'px';
      fl.style.columnGap = st.gap + 'px';
      fl.style.height = v.clientHeight + 'px';
      fl.style.setProperty('--rd-colh', v.clientHeight + 'px'); // a picture always fits one page
      fl.style.transition = 'none';
      renderSecs(st, j, j);
      fl.style.height = v.clientHeight + 'px';
      countPages(st);
      goPage(st, pageForUnit(st, i), false);
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
  /** the page to show for a sentence: the start of a part shows the part from its top (a cover / a picture before the first sentence) */
  function pageForUnit(st, i) { const s = st.M.secs[st.s0]; return s && i === s.u0 ? 0 : pageOfUnit(st, i); }
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
    if (modeNow() === 'page') {
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
    if (modeNow() !== 'scroll' || !window.IntersectionObserver) return;
    const more = st.flow.querySelector('[data-more]');
    if (!more) return;
    st.io = new IntersectionObserver(ents => { if (ents.some(e => e.isIntersecting)) appendNext(st); }, { root: st.view, rootMargin: '600px 0px' });
    st.io.observe(more);
  }
  function appendNext(st) {
    if (modeNow() !== 'scroll' || st.s1 >= st.M.secs.length - 1) return;
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
    if (modeNow() === 'scroll' && j === st.s1 + 1) { appendNext(st); return; }
    renderAt(st, i, true);
  }

  /* ---------- paging ---------- */
  function nextPage(st) {
    st.userNav = Date.now();
    if (modeNow() === 'scroll') { st.view.scrollBy({ top: st.view.clientHeight * 0.86, behavior: RM() ? 'auto' : 'smooth' }); return; }
    if (st.page < st.nPages - 1) goPage(st, st.page + 1);
    else if (st.s0 < st.M.secs.length - 1) renderAt(st, st.M.secs[st.s0 + 1].u0, true);
    else { toast('Это последняя страница книги', '', 1800); return; }
    afterNav(st);
  }
  function prevPage(st) {
    st.userNav = Date.now();
    if (modeNow() === 'scroll') { st.view.scrollBy({ top: -st.view.clientHeight * 0.86, behavior: RM() ? 'auto' : 'smooth' }); return; }
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
    st.m.$$('[data-a="prev"]').forEach(b => { b.disabled = modeNow() === 'page' && first; });
    st.m.$$('[data-a="next"]').forEach(b => { b.disabled = modeNow() === 'page' && last; });
  }
  let scT = 0;
  function onScroll(st) {
    // pages are moved by a transform, the view itself never scrolls: something else scrolling it (a help tour's
    // scrollIntoView, the browser revealing a focused word) would show half of two pages — back to the page
    if (modeNow() === 'page') { if (st.view.scrollLeft || st.view.scrollTop) { st.view.scrollLeft = 0; st.view.scrollTop = 0; } return; }
    if (modeNow() !== 'scroll') return;
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
      if (!s || modeNow() !== 'page') { s = null; return; }
      const dx = e.clientX - s.x, dy = e.clientY - s.y, dt = Date.now() - s.t;
      s = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 800) { st.swiped = Date.now(); if (dx < 0) nextPage(st); else prevPage(st); }
    }, { passive: true });
    st.view.addEventListener('pointercancel', () => { s = null; }, { passive: true });
    // horizontal swipes are page turns, not page scrolls
    st.view.addEventListener('touchstart', e => { const t = e.touches[0]; t0 = t ? { x: t.clientX, y: t.clientY } : null; }, { passive: true });
    st.view.addEventListener('touchmove', e => {
      const t = e.touches[0];
      if (modeNow() === 'page' && e.cancelable && t0 && t && Math.abs(t.clientX - t0.x) > Math.abs(t.clientY - t0.y)) e.preventDefault();
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
    if (modeNow() === 'page') sidesUi(st);
    else st.m.$$('[data-a="prev"],[data-a="next"]').forEach(b => { b.disabled = false; });
    if (st.lisEl) lisUi(st);
  }
  function savePos(st) {
    const M = st.M;
    const i = clamp(st.playing && st.hl >= 0 ? st.hl : st.cur, 0, M.units.length - 1);
    st.meta.pos = i;
    st.meta.pct = M.units.length > 1 ? i / (M.units.length - 1) : 1;
    st.meta.pages = M.pages;
    if (st.key && window.RdSync) {
      const L = locOf(M, i), was = RdSync.getPos(st.key);
      if (!was || was.b !== L.b || was.o !== L.o) { RdSync.setPos(st.key, Object.assign(L, { pg: M.units[i] ? M.units[i].p : 1, pct: st.meta.pct })); st.meta.posAt = Date.now(); }
    }
    putSoon(st.meta);
    recentNote(st.meta, M, i);
    bmUi(st);
    // 🎓 a chapter was finished (the reader moved on into the next one, or reached the last page): a natural pause
    const ch = chapterStart(st, i), last = i >= M.units.length - 1;
    if (st.chapAt != null && (ch > st.chapAt || (last && !st.chapLast)) && !st.playing) rdPause(st);
    st.chapAt = ch; st.chapLast = last;
  }
  /** the first unit of the chapter that unit i is in (the same headings as chapterEnd / «Содержание») */
  function chapterStart(st, i) {
    const M = st.M;
    let heads = M._chapHeads;
    if (!heads) { heads = M.units.filter(u => u.k === 'h' && u.i === M.bStart[u.b]).map(u => u.i); if (heads.length < 2) heads = M.secs.map(x => x.u0); M._chapHeads = heads; }
    let c = 0; for (const h of heads) { if (h <= i) c = h; else break; }
    return c;
  }
  /** «Колода из прочитанного» (js/learnby.js) — only at a natural pause, never in the middle of reading */
  function rdPause(st, delay) {
    const k = st && st.meta && st.meta.id; if (!k || TEMP.has(k) || !(window.LearnBy && LearnBy.pause)) return;
    setTimeout(() => { try { LearnBy.pause('reader:' + k); } catch (e) { /* a convenience */ } }, delay || 0);
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
    if (modeNow() === 'page') goPage(st, pageForUnit(st, i), false); else scrollToUnit(st, i, false);
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
      else if (act === 'find') findOpen(st);
      else if (act === 'bm') toggleBookmark(st);
      else if (act === 'marks') marksPanel(st);
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
    if (st.view.contains(e.target)) {
      const sel = window.getSelection && getSelection();
      const selecting = sel && !sel.isCollapsed && String(sel).trim();
      const ln = !selecting && e.target.closest('.rd-a');
      if (ln) { e.preventDefault(); if (ln.dataset.note != null) showNote(st, ln.dataset.note, ln); else followLink(st, ln.dataset.href); return; }
      const im = !selecting && e.target.closest('[data-zoom]');
      if (im) { zoomImage(st, im); return; }
      // e-ink: the outer fifths of the page turn it (big tap zones)
      if (isEink() && !selecting && !e.target.closest('.rd-s')) { const vr = st.view.getBoundingClientRect(), x = (e.clientX - vr.left) / vr.width; if (x < 0.2) { prevPage(st); return; } if (x > 0.8) { nextPage(st); return; } }
      onTextTap(st, e);
    }
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
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); findOpen(st); return; }
    if (t.closest && t.closest('input, select, textarea, .rd-panel, .rd-find')) return;
    if ((e.key === 'Enter' || e.key === ' ') && t.closest && t.closest('.rd-a, [data-zoom]')) { e.preventDefault(); t.click(); return; }
    const btn = t.closest && t.closest('button');
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { if (modeNow() === 'page' || e.key === 'PageDown') { e.preventDefault(); nextPage(st); } }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { if (modeNow() === 'page' || e.key === 'PageUp') { e.preventDefault(); prevPage(st); } }
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
        <div class="rd-row"><span class="rd-lbl">Как читать</span>${isEink() ? '<span class="rd-tiny">В режиме e-ink — только страницами.</span>' : seg('mode', [['page', 'Страницы'], ['scroll', 'Лента']], P.mode)}</div>
        <div class="rd-row"><span class="rd-lbl">Размер текста</span><div class="rd-step"><button type="button" data-set="size" data-v="-1" aria-label="Мельче">A−</button><span>${P.size}</span><button type="button" data-set="size" data-v="1" aria-label="Крупнее">A+</button></div></div>
        <div class="rd-row"><span class="rd-lbl">Между строками</span><div class="rd-step"><button type="button" data-set="lh" data-v="-1" aria-label="Плотнее">−</button><span>${['очень тесно', 'тесно', 'обычно', 'свободно', 'очень свободно'][clamp(P.lh, 0, 4)]}</span><button type="button" data-set="lh" data-v="1" aria-label="Свободнее">+</button></div></div>
        <div class="rd-row"><span class="rd-lbl">Ширина строки</span><div class="rd-step"><button type="button" data-set="width" data-v="-1">Уже</button><span>${P.width + 1} из ${WIDTH_EM.length}</span><button type="button" data-set="width" data-v="1">Шире</button></div></div>
        <div class="rd-row"><span class="rd-lbl">Шрифт</span><div class="rd-seg">${Object.entries(FONTS).map(([k, [l, f]]) => `<button type="button" data-set="font" data-v="${k}" style="font-family:${esc(f)}" aria-pressed="${P.font === k}" class="${P.font === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div class="rd-row"><span class="rd-lbl">Тема</span>${seg('skin', SKINS, P.skin, 'rd-seg-skins')}
          ${isEink() ? '<span class="rd-tiny">E-ink: чёрный текст на белом, без анимаций и теней, листание страницами, крупные зоны нажатия по краям.</span>' : P.skin === 'oled' ? '<span class="rd-tiny">Настоящий чёрный фон — экономит заряд на OLED-экранах и не слепит в темноте.</span>' : ''}
          <span class="rd-tiny">Тема запоминается на этом устройстве.</span></div>
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
      <button type="button" role="menuitem" data-mi="toc">${ICON.toc} Содержание</button>
      <button type="button" role="menuitem" data-mi="find">${ICON.search} Поиск по книге</button>
      <button type="button" role="menuitem" data-mi="bm">${ICON.bookmark} Закладка на этой странице</button>
      <button type="button" role="menuitem" data-mi="marks">${ICON.notes} Закладки и заметки</button>
      <button type="button" role="menuitem" data-mi="goto">${NI('goto', 20)} Перейти к странице…</button>
      ${window.PrintX ? `<button type="button" role="menuitem" data-mi="print">${ICON.print} Печать и файлы</button>` : ''}
      <button type="button" role="menuitem" data-mi="reset">${NI('refresh', 20)} Сбросить прогресс</button>
      <button type="button" role="menuitem" data-mi="shelf">${NI('shelf', 20)} Моя полка</button>
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
    else if (key === 'skin') { const was = modeNow(); P.skin = SKINS.some(x => x[0] === v) ? v : 'app'; if (modeNow() !== was) layout = true; }
    else if (key === 'hideTr') P.hideTr = v === '1';
    else if (key === 'hl') P.hl = v;
    else if (key === 'hls') P.hls = v === 'line' ? 'line' : 'fill';
    else if (key === 'kar') { P.kar = v !== '0'; if (!P.kar) karClear(st); }
    else if (key === 'read') { P.read = v; if (st.playing) playFrom(st, st.hl >= 0 ? st.hl : st.cur); }
    else if (key === 'speed') { P.speed = v; if (st.playing) playFrom(st, st.hl >= 0 ? st.hl : st.cur); }
    else if (key === 'pause') P.pause = +v;
    else if (key === 'repeat') P.repeat = clamp(+v, 1, 3);
    savePrefs();
    if (window.RdSync && RdSync.SYNC_SET.includes(key)) RdSync.setSetting(key, P[key]); // the theme stays on this device
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
    else if (k === 'find') findOpen(st);
    else if (k === 'bm') toggleBookmark(st);
    else if (k === 'marks') marksPanel(st);
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
      const ok = await UI.confirm(`Удалить книгу «${esc(st.meta.title)}» с этого устройства?<br><span class="small muted">${DEL_NOTE}</span>`, { danger: true, ok: 'Да, удалить', title: 'Удалить книгу?' });
      if (!ok) return;
      const id = st.meta.id, title = st.meta.title;
      if (st.meta.key && window.RdSync) RdSync.forget(st.meta.key);
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
    const own = bookToc(st);
    let items = own ? own.map(e => { const u = unitOfBlock(st, e.b); return [u, e.t, M.units[u] ? M.units[u].p : 1, e.lv, e.b]; })
      : M.units.filter(u => u.k === 'h' && u.i === M.bStart[u.b]).map(u => [u.i, u.text, u.p, Math.max(0, ((M.blocks[u.b][2] || {}).lv || 1) - 1)]);
    if (items.length < 2) items = M.secs.map((s, j) => [s.u0, `Часть ${j + 1}: ${M.units[s.u0].text.slice(0, 60)}${M.units[s.u0].text.length > 60 ? '…' : ''}`, M.units[s.u0].p, 0]);
    const minLv = Math.min(...items.map(x => x[3] || 0));
    const here = st.playing && st.hl >= 0 ? st.hl : st.cur;
    let curK = 0; items.forEach((x, k) => { if (x[0] <= here) curK = k; });
    const tm = UI.modal({
      title: `<span class="ui-t">${ICON.toc}<span>Содержание</span></span>`, cls: 'narrow rd-toc-modal',
      body: `${own ? '<div class="rd-tiny rd-toc-src">Оглавление самой книги</div>' : ''}<div class="rd-toc">${items.map((x, k) => `<button type="button" class="rd-toc-i${k === curK ? ' on' : ''}" data-u="${x[0]}"${x[4] != null ? ` data-b="${x[4]}"` : ''} style="--lv:${clamp((x[3] || 0) - minLv, 0, 5)}"${k === curK ? ' aria-current="true"' : ''}><span>${esc(x[1])}</span><small>${k === curK ? 'вы здесь · ' : ''}стр. ${x[2]}</small></button>`).join('')}</div>`,
    });
    tm.el.addEventListener('click', e => { const b = e.target.closest('[data-u]'); if (!b) return; tm.close(); if (b.dataset.b != null) goBlock(st, +b.dataset.b); else goUnit(st, +b.dataset.u); });
    setTimeout(() => { const on = tm.el.querySelector('.rd-toc-i.on'); if (on) { on.scrollIntoView({ block: 'center' }); try { on.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }, 60);
  }

  /* =====================================================================
   * 🔗 links, footnotes, pictures · 🔖 bookmarks, highlights, notes · 🔎 search (v232)
   * ===================================================================== */
  const HL_COLORS = [['yellow', 'Жёлтый'], ['green', 'Зелёный'], ['blue', 'Голубой'], ['pink', 'Розовый'], ['violet', 'Сиреневый']];
  const RS = () => window.RdSync || null;
  /** highlights by block (for drawing): b → [{ id, s, e, c, note }] in that block's offsets */
  function marksIndex(st) {
    st.hlBy = new Map();
    if (!st.key || !RS()) return;
    RS().marks(st.key, 'hl').forEach(m => {
      for (let b = m.b; b <= m.b2 && b < st.M.blocks.length; b++) {
        const t = st.M.blocks[b][1] || '';
        const s0 = b === m.b ? m.s : 0, e0 = b === m.b2 ? m.e : t.length;
        if (e0 <= s0) continue;
        if (!st.hlBy.has(b)) st.hlBy.set(b, []);
        st.hlBy.get(b).push({ id: m.id, s: s0, e: e0, c: m.c, note: m.note || '' });
      }
    });
  }
  /** redraw the laid-out part in place (the page / scroll position stays) */
  function redrawMarks(st) {
    marksIndex(st);
    if (!st.flow || !document.body.contains(st.flow)) return;
    const keepTop = st.view.scrollTop;
    const sel = window.getSelection && getSelection();
    if (sel && !sel.isCollapsed && st.view.contains(sel.anchorNode)) sel.removeAllRanges();
    st.flow.querySelectorAll('.rd-sec').forEach(sec => {
      const j = +sec.dataset.sec;
      const tmp = document.createElement('div'); tmp.innerHTML = sectionHtml(st, j);
      sec.replaceWith(tmp.firstElementChild);
    });
    st.spans = [...st.flow.querySelectorAll('.rd-s')];
    if (st.hl >= 0) { const el = spanOf(st, st.hl); if (el) el.classList.add('rd-cur'); }
    if (modeNow() === 'scroll') st.view.scrollTop = keepTop;
    else goPage(st, st.page, false);
    bmUi(st);
  }
  function onSync(st, what, key) {
    if (R !== st) return;
    if (what === 'marks' && key === st.key) { redrawMarks(st); return; }
    if (what === 'remote' && (!key || key === st.key)) {
      redrawMarks(st);
      const p = RS() && RS().getPos(st.key);
      if (p && p.at > (st.meta.posAt || 0) + 1000) {
        const i = unitAt(st.M, p.b, p.o);
        st.meta.posAt = p.at;
        if (Math.abs(i - st.cur) > 3 && !st.playing) jumpChip(st, i, `На другом устройстве вы читали стр. ${st.M.units[i].p}`);
      }
    }
  }
  /** a quiet offer at the bottom: «go there» (never a jump by itself) */
  function jumpChip(st, i, text) {
    const old = st.root.querySelector('.rd-chip'); if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'rd-chip';
    el.innerHTML = `<span>${esc(text)}</span><button type="button" class="btn sm primary" data-chip="go">Перейти</button><button type="button" class="rd-ib" data-chip="x" aria-label="Не нужно">${ICON.close || '✕'}</button>`;
    st.stage.appendChild(el);
    el.addEventListener('click', e => { const b = e.target.closest('[data-chip]'); if (!b) return; e.stopPropagation(); if (b.dataset.chip === 'go') goUnit(st, i); el.remove(); });
    setTimeout(() => { if (el.isConnected) el.remove(); }, 15000);
  }

  /* ---------- 🔗 internal links and footnotes ---------- */
  function targetBlock(st, key) {
    const A = st.rich && st.rich.anchors;
    if (!A || !key) return -1;
    let v = A[key];
    if (v == null && key.includes('#')) v = A[key.split('#')[0]];
    return typeof v === 'number' ? v : -1;
  }
  function unitOfBlock(st, b) {
    const M = st.M;
    for (let k = clamp(b, 0, M.blocks.length - 1); k < M.blocks.length; k++) if (M.bStart[k + 1] > M.bStart[k]) return M.bStart[k];
    return M.units.length - 1;
  }
  function followLink(st, key) {
    const b = targetBlock(st, key);
    if (b < 0) { toast('Эта ссылка ведёт за пределы книги — такие ссылки читалка не открывает', '', 3200); return; }
    const from = st.cur;
    goBlock(st, b);
    backChip(st, from);
  }
  /** a block itself in view — a picture / table has no sentence, so the page that SHOWS it (not the next sentence's page) */
  function goBlock(st, b) {
    const i = unitOfBlock(st, b);
    goUnit(st, i);
    if (st.M.bStart[b + 1] > st.M.bStart[b]) return; // a text block: its first sentence is the place
    const el = st.flow.querySelector(`[data-b="${b}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect(), fr = st.flow.getBoundingClientRect();
    if (modeNow() === 'page') goPage(st, clamp(Math.floor((r.left - fr.left + 2) / st.step), 0, st.nPages - 1), false);
    else st.view.scrollTop += r.top - st.view.getBoundingClientRect().top - 12;
    sidesUi(st);
  }
  function backChip(st, from) {
    const old = st.root.querySelector('.rd-chip'); if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'rd-chip';
    el.innerHTML = `<button type="button" class="btn sm" data-chip="back">${ICON.left} Вернуться назад</button><button type="button" class="rd-ib" data-chip="x" aria-label="Закрыть">${ICON.close || '✕'}</button>`;
    st.stage.appendChild(el);
    el.addEventListener('click', e => { const b = e.target.closest('[data-chip]'); if (!b) return; e.stopPropagation(); if (b.dataset.chip === 'back') goUnit(st, from); el.remove(); });
    setTimeout(() => { if (el.isConnected) el.remove(); }, 12000);
  }
  /** a footnote in a pop-up: the note's own blocks (EPUB 3 aside, FB2 notes) or the block the link points at */
  function showNote(st, key, anchorEl) {
    closePop(st);
    let blocks = st.rich && st.rich.notes && st.rich.notes[key];
    let target = -1;
    if (!blocks) {
      target = targetBlock(st, key);
      const A = st.rich && st.rich.anchors && st.rich.anchors[key];
      if (typeof A === 'string' && A.startsWith('n:')) blocks = st.rich.notes[A.slice(2)];
      else if (target >= 0) {
        const B0 = st.M.blocks[target], fn = B0 && B0[2] && B0[2].fn;
        blocks = [B0];
        // the whole note group (a note of several paragraphs)
        for (let k = target + 1; fn && k < st.M.blocks.length && blocks.length < 6; k++) { const bk = st.M.blocks[k]; if (bk[2] && bk[2].fn === fn) blocks.push(bk); else break; }
      }
    }
    if (!blocks || !blocks.length) { toast('Текст этой сноски в книге не нашёлся', '', 2600); return; }
    const html = blocks.slice(0, 12).map(bk => {
      const x = bk[2] || {};
      return `<p class="rd-note-p${bk[0] === 'h' ? ' rd-note-h' : ''}">${richHtml(bk[1], (x.m || []).filter(r => r[2] !== 'a'))}</p>`;
    }).join('');
    const el = document.createElement('div');
    el.className = 'rd-pop rd-notepop';
    el.dataset.skin = P.skin;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Сноска');
    el.innerHTML = `<div class="rd-pop-head"><b class="rd-pop-w">Сноска</b><button type="button" class="rd-ib" data-pa="x" aria-label="Закрыть">${ICON.close || '✕'}</button></div>
      <div class="rd-note-body" lang="nb">${html}</div>
      ${target >= 0 ? '<div class="rd-pop-row"><button type="button" class="btn sm ghost" data-pa="go">Перейти к сноске в книге</button></div>' : ''}`;
    document.body.appendChild(el);
    st.pop = el;
    const r = anchorEl.getBoundingClientRect(), pw = Math.min(380, window.innerWidth - 16);
    el.style.width = pw + 'px';
    const ph = Math.min(el.offsetHeight || 160, window.innerHeight * 0.6);
    el.style.left = clamp(r.left + r.width / 2 - pw / 2, 8, window.innerWidth - pw - 8) + 'px';
    el.style.top = (r.bottom + 10 + ph < window.innerHeight - 8 ? r.bottom + 10 : Math.max(8, r.top - ph - 10)) + 'px';
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-pa]'); if (!b) return;
      e.stopPropagation();
      if (b.dataset.pa === 'x') closePop(st);
      if (b.dataset.pa === 'go') { closePop(st); const from = st.cur; goBlock(st, target); backChip(st, from); }
    });
    setTimeout(() => { const x = el.querySelector('[data-pa="x"]'); if (x) try { x.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
  }

  /* ---------- 🖼 a picture: tap to zoom (pinch / wheel / double tap; Escape or ✕ closes) ---------- */
  function zoomImage(st, img) {
    const ov = document.createElement('div');
    ov.className = 'rd-zoom';
    ov.dataset.skin = P.skin;
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', 'Картинка крупно');
    ov.innerHTML = `<div class="rd-zoom-in"><img src="${esc(img.currentSrc || img.src)}" alt="${esc(img.alt || '')}" draggable="false"></div>
      <div class="rd-zoom-bar"><button type="button" class="rd-ib" data-z="-" aria-label="Мельче">${ICON.zout}</button><button type="button" class="rd-ib" data-z="+" aria-label="Крупнее">${ICON.zin}</button><button type="button" class="rd-ib" data-z="x" aria-label="Закрыть">${ICON.close || '✕'}</button></div>`;
    document.body.appendChild(ov);
    const box = ov.querySelector('.rd-zoom-in'), pic = ov.querySelector('img');
    let z = 1;
    const fit = () => { pic.style.width = ''; pic.style.maxWidth = '100%'; pic.style.maxHeight = '100%'; };
    const set = nz => {
      z = clamp(nz, 1, 5);
      if (z === 1) { fit(); ov.classList.remove('zoomed'); return; }
      ov.classList.add('zoomed');
      const base = Math.min(box.clientWidth / (pic.naturalWidth || 1), box.clientHeight / (pic.naturalHeight || 1), 1) * (pic.naturalWidth || box.clientWidth);
      pic.style.maxWidth = 'none'; pic.style.maxHeight = 'none'; pic.style.width = Math.round(base * z) + 'px';
    };
    fit();
    const close = () => { window.removeEventListener('keydown', key, true); ov.remove(); try { img.focus({ preventScroll: true }); } catch (e) { /* ignore */ } };
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } else if (e.key === '+' || e.key === '=') set(z * 1.4); else if (e.key === '-') set(z / 1.4); };
    window.addEventListener('keydown', key, true);
    ov.addEventListener('click', e => {
      const b = e.target.closest('[data-z]');
      if (b) { e.stopPropagation(); if (b.dataset.z === 'x') close(); else set(b.dataset.z === '+' ? z * 1.5 : z / 1.5); return; }
      if (e.target === pic) set(z > 1 ? 1 : 2.2); else if (e.target === ov || e.target === box) close();
    });
    ov.addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) { e.preventDefault(); set(z * (e.deltaY < 0 ? 1.12 : 1 / 1.12)); } }, { passive: false });
    let pinch = null;
    ov.addEventListener('touchstart', e => { if (e.touches.length === 2) pinch = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), z }; }, { passive: true });
    ov.addEventListener('touchmove', e => { if (pinch && e.touches.length === 2) { e.preventDefault(); const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); set(pinch.z * d / pinch.d); } }, { passive: false });
    ov.addEventListener('touchend', () => { pinch = null; }, { passive: true });
    setTimeout(() => { const x = ov.querySelector('[data-z="x"]'); if (x) try { x.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
  }

  /* ---------- ✍️ a selection in the text → a highlight (five colours) or a note ---------- */
  /** a DOM point → [block, offset in the block's text] (or null outside the sentences) */
  function pointOf(st, node, off, isEnd) {
    let el = node.nodeType === 3 ? node.parentElement : node;
    let span = el && el.closest ? el.closest('.rd-s') : null;
    if (!span || !st.flow.contains(span)) {
      // between sentences / blocks: the nearest sentence in reading order
      const all = st.spans;
      if (!all.length) return null;
      const pos = n => { const r = document.createRange(); r.selectNode(n); return r; };
      let pick = null;
      try {
        const pr = document.createRange(); pr.setStart(node, off); pr.collapse(true);
        for (const sp of all) { const c = pr.compareBoundaryPoints(Range.START_TO_START, pos(sp)); if (c <= 0) { pick = sp; break; } }
      } catch (e) { pick = null; }
      if (!pick) pick = all[all.length - 1];
      if (isEnd) { const k = all.indexOf(pick); const prev = all[Math.max(0, k - 1)]; const u = st.M.units[+prev.dataset.i]; return u && u.o >= 0 ? [u.b, u.o + u.text.length] : null; }
      const u = st.M.units[+pick.dataset.i]; return u && u.o >= 0 ? [u.b, u.o] : null;
    }
    const u = st.M.units[+span.dataset.i];
    if (!u || u.o < 0) return null;
    let k = 0;
    try { const r = document.createRange(); r.setStart(span, 0); r.setEnd(node, off); k = r.toString().length; } catch (e) { k = 0; }
    return [u.b, u.o + clamp(k, 0, u.text.length)];
  }
  function selRange(st) {
    const sel = window.getSelection && getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0);
    if (!st.flow.contains(r.commonAncestorContainer)) return null;
    const text = String(sel).replace(/\s+/g, ' ').trim();
    if (!text || !/[\p{L}\p{N}]/u.test(text)) return null;
    const a = pointOf(st, r.startContainer, r.startOffset, false), z = pointOf(st, r.endContainer, r.endOffset, true);
    if (!a || !z || z[0] < a[0] || (z[0] === a[0] && z[1] <= a[1])) return null;
    return { b: a[0], s: a[1], b2: z[0], e: z[1], text: text.slice(0, 1200), rect: r.getBoundingClientRect() };
  }
  function selHide(st) { if (st.selEl) { st.selEl.remove(); st.selEl = null; } }
  function selUi(st) {
    if (R !== st || st.lmode) return;
    const S = selRange(st);
    if (!S || !st.key) { selHide(st); return; }
    st.selNow = S;
    if (!st.selEl) {
      const el = document.createElement('div');
      el.className = 'rd-selbar';
      el.dataset.skin = P.skin;
      el.setAttribute('role', 'toolbar');
      el.setAttribute('aria-label', 'Выделить цветом или добавить заметку');
      el.innerHTML = `${HL_COLORS.map(([c, l]) => `<button type="button" class="rd-hlsw rd-hl-${c}" data-hlc="${c}" aria-label="Выделить: ${l}" title="Выделить: ${l}"></button>`).join('')}
        <button type="button" class="rd-ib rd-selnote" data-hlc="note" aria-label="Выделить и добавить заметку" title="Заметка">${ICON.notes}</button>`;
      el.addEventListener('pointerdown', e => e.preventDefault()); // the selection stays while a colour is chosen
      el.addEventListener('click', e => { const b = e.target.closest('[data-hlc]'); if (!b) return; e.stopPropagation(); makeHighlight(st, b.dataset.hlc); });
      document.body.appendChild(el);
      st.selEl = el;
    }
    const el = st.selEl, rc = S.rect;
    const w = el.offsetWidth || 300, h = el.offsetHeight || 52;
    let top = rc.bottom + 12;
    if (top + h > window.innerHeight - 8) top = Math.max(8, rc.top - h - 12);
    el.style.left = clamp(rc.left + rc.width / 2 - w / 2, 8, window.innerWidth - w - 8) + 'px';
    el.style.top = top + 'px';
    // the app's own translation bubble (js/selection.js) sits on one side — never on top of it
    setTimeout(() => {
      const sp = document.querySelector('.sel-pop');
      if (!sp || !st.selEl) return;
      const a = sp.getBoundingClientRect(), b = st.selEl.getBoundingClientRect();
      if (a.bottom > b.top && a.top < b.bottom) st.selEl.style.top = (a.top > b.top ? Math.max(8, a.top - b.height - 8) : a.bottom + 8) + 'px';
    }, 380);
  }
  async function makeHighlight(st, c) {
    const S = st.selNow || selRange(st);
    selHide(st);
    if (!S || !RS()) return;
    const pg = (st.M.units[unitAt(st.M, S.b, S.s)] || {}).p || 1;
    let note = '';
    if (c === 'note') {
      note = await UI.prompt('Заметка к выделенному', '', 'Ваша мысль, перевод, вопрос…', true);
      if (note == null) return;
      c = 'yellow';
    }
    try { getSelection().removeAllRanges(); } catch (e) { /* ignore */ }
    const m = RS().addMark(st.key, { k: 'hl', b: S.b, s: S.s, b2: S.b2, e: S.e, c, text: S.text, pg, note: note || undefined });
    if (m) toast(note ? 'Выделение с заметкой сохранено' : 'Выделено', 'good', 1600);
  }
  /** the highlight under a tapped word (if any) */
  function hlAt(st, node) {
    const mk = node && (node.nodeType === 3 ? node.parentElement : node);
    const el = mk && mk.closest && mk.closest('mark.rd-hl');
    if (!el || !st.key || !RS()) return null;
    return RS().marks(st.key, 'hl').find(m => m.id === el.dataset.h) || null;
  }
  async function editNote(st, m) {
    const v = await UI.prompt(m.k === 'bm' ? 'Заметка к закладке' : 'Заметка к выделению', m.note || '', 'Ваша мысль, перевод, вопрос…', true);
    if (v == null) return;
    RS().updMark(st.key, m.id, { note: v });
    toast(v ? 'Заметка сохранена' : 'Заметка убрана', 'good', 1600);
  }
  async function deleteMark(st, m) {
    const what = m.k === 'bm' ? 'закладку' : m.note ? 'выделение вместе с заметкой' : 'выделение';
    const ok = await UI.confirm(`Удалить ${what}?${m.text ? `<br><span class="small muted">«${esc(m.text.slice(0, 140))}${m.text.length > 140 ? '…' : ''}»</span>` : ''}`, { danger: true, ok: 'Да, удалить', title: 'Удалить?' });
    if (!ok) return false;
    RS().delMark(st.key, m.id);
    toast(m.k === 'bm' ? 'Закладка удалена' : 'Выделение удалено', 'good', 1600);
    return true;
  }

  /* ---------- 🔖 bookmarks: the page you look at ---------- */
  function pageUnits(st) {
    if (!st.spans.length) return [st.cur, st.cur];
    const a = firstVisible(st);
    if (modeNow() === 'page') {
      const fr = st.flow.getBoundingClientRect(), x1 = (st.page + 1) * st.step - st.gap / 2;
      let last = a;
      for (let k = st.spans.indexOf(spanOf(st, a)); k >= 0 && k < st.spans.length; k++) { const r = st.spans[k].getClientRects()[0]; if (!r || r.left - fr.left >= x1) break; last = +st.spans[k].dataset.i; }
      return [a, last];
    }
    const vb = st.view.getBoundingClientRect().bottom;
    let last = a;
    for (let k = st.spans.indexOf(spanOf(st, a)); k >= 0 && k < st.spans.length; k++) { const r = st.spans[k].getBoundingClientRect(); if (r.top > vb) break; last = +st.spans[k].dataset.i; }
    return [a, last];
  }
  function bmHere(st) {
    if (!st.key || !RS() || !st.M.units.length) return null;
    const [a, z] = pageUnits(st);
    const ua = st.M.units[a], uz = st.M.units[z];
    if (!ua || !uz) return null;
    return RS().marks(st.key, 'bm').find(m => (m.b > ua.b || (m.b === ua.b && m.s >= Math.max(0, ua.o))) && (m.b < uz.b || (m.b === uz.b && m.s <= Math.max(0, uz.o)))) || null;
  }
  function bmUi(st) {
    const b = st.m && st.m.$('[data-a="bm"]');
    if (!b) return;
    const on = !!bmHere(st);
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('on', on);
    b.title = on ? 'Убрать закладку с этой страницы' : 'Закладка на этой странице';
    b.setAttribute('aria-label', b.title);
    st.root.toggleAttribute('data-bm', on);
  }
  function toggleBookmark(st) {
    if (!st.key || !RS()) { toast('Закладки здесь недоступны', 'warn'); return; }
    const have = bmHere(st);
    if (have) { RS().delMark(st.key, have.id); toast('Закладка снята', '', 1500); bmUi(st); return; }
    const i = firstVisible(st), u = st.M.units[i];
    if (!u) return;
    RS().addMark(st.key, { k: 'bm', b: u.b, s: Math.max(0, u.o), text: u.text.slice(0, 160), pg: u.p });
    toast(`Закладка на стр. ${u.p}`, 'good', 1500);
    bmUi(st);
  }
  function goMark(st, m) {
    const i = unitAt(st.M, m.b, m.s);
    goUnit(st, i);
  }

  /* ---------- 📒 «Закладки и заметки»: the list, jump, edit, delete, Markdown, «в карточки» ---------- */
  function marksPanel(st) {
    closePanel(st); closePop(st);
    if (!st.key || !RS()) { toast('Закладки здесь недоступны', 'warn'); return; }
    let filter = 'all';
    const COLN = Object.fromEntries(HL_COLORS);
    const mm = UI.modal({ title: `<span class="ui-t">${ICON.notes}<span>Закладки и заметки</span></span>`, cls: 'rd-marks-modal', body: '<div class="rd-marks" data-marks></div>' });
    const box = mm.$('[data-marks]');
    const draw = () => {
      const all = RS().marks(st.key);
      const list = all.filter(m => filter === 'all' || (filter === 'bm' && m.k === 'bm') || (filter === 'hl' && m.k === 'hl') || (filter === 'note' && m.note));
      const n = { all: all.length, bm: all.filter(m => m.k === 'bm').length, hl: all.filter(m => m.k === 'hl').length, note: all.filter(m => m.note).length };
      box.innerHTML = `
        <div class="rd-seg rd-marks-f" role="group" aria-label="Что показать">${[['all', 'Все'], ['bm', 'Закладки'], ['hl', 'Выделения'], ['note', 'Заметки']].map(([v, l]) => `<button type="button" data-f="${v}" aria-pressed="${filter === v}" class="${filter === v ? 'on' : ''}">${l} <small>${n[v]}</small></button>`).join('')}</div>
        <div class="rd-marks-acts">
          <button type="button" class="btn sm ghost" data-ma="md" ${all.length ? '' : 'disabled'}>${ICON.md}<span>Экспорт в Markdown</span></button>
          <button type="button" class="btn sm ghost" data-ma="cards" ${n.hl ? '' : 'disabled'}>${ICON.cards}<span>Выделения в карточки</span></button>
        </div>
        ${list.length ? `<ul class="rd-marks-list">${list.map(m => `<li class="rd-mk" data-id="${esc(m.id)}">
            <button type="button" class="rd-mk-go" data-ma="go" aria-label="Перейти: стр. ${m.pg || '?'}">
              <span class="rd-mk-ico ${m.k === 'hl' ? 'rd-hl-' + esc(m.c) : 'rd-mk-bm'}" aria-hidden="true">${m.k === 'bm' ? ICON.bookmark : ''}</span>
              <span class="rd-mk-t"><span class="rd-mk-q">${esc((m.text || (m.k === 'bm' ? 'Закладка' : '')).slice(0, 260))}${(m.text || '').length > 260 ? '…' : ''}</span>
                ${m.note ? `<span class="rd-mk-n">${ICON.notes}<span>${esc(m.note)}</span></span>` : ''}
                <small class="rd-mk-m">${m.k === 'bm' ? 'Закладка' : 'Выделение · ' + esc((COLN[m.c] || '').toLowerCase())}${m.pg ? ` · стр. ${m.pg}` : ''}</small></span>
            </button>
            <div class="rd-mk-btns">
              <button type="button" class="rd-ib" data-ma="note" aria-label="${m.note ? 'Изменить заметку' : 'Добавить заметку'}" title="${m.note ? 'Изменить заметку' : 'Добавить заметку'}">${ICON.notes}</button>
              <button type="button" class="rd-ib rd-ib-bad" data-ma="del" aria-label="Удалить" title="Удалить">${ICON.trash2}</button>
            </div></li>`).join('')}</ul>`
          : `<div class="rd-empty"><b>${filter === 'all' ? 'Пока пусто' : 'Здесь пока ничего нет'}</b><span>Выделите текст пальцем или мышью — появятся цвета и заметка. Закладка — кнопка с ленточкой вверху.</span></div>`}`;
    };
    draw();
    const off = RS().on((what, key) => { if ((what === 'marks' || what === 'remote') && (!key || key === st.key) && box.isConnected) draw(); });
    const obs = new MutationObserver(() => { if (!box.isConnected) { off(); obs.disconnect(); } });
    obs.observe(document.getElementById('modal-root') || document.body, { childList: true });
    box.addEventListener('click', async e => {
      const f = e.target.closest('[data-f]');
      if (f) { filter = f.dataset.f; draw(); return; }
      const b = e.target.closest('[data-ma]'); if (!b) return;
      const li = b.closest('[data-id]');
      const m = li && RS().marks(st.key).find(x => x.id === li.dataset.id);
      const act = b.dataset.ma;
      if (act === 'go' && m) { mm.close(); goMark(st, m); }
      else if (act === 'note' && m) await editNote(st, m);
      else if (act === 'del' && m) await deleteMark(st, m);
      else if (act === 'md') exportMarks(st);
      else if (act === 'cards') marksToCards(st, b);
    });
  }
  function exportMarks(st) {
    const md = RS().toMarkdown({ title: st.meta.title, author: st.meta.author }, RS().marks(st.key));
    const name = (window.U && U.safeFileName ? U.safeFileName(st.meta.title) : 'kniga') + ' — заметки.md';
    try { U.download(name, md, 'text/markdown;charset=utf-8'); toast('Файл с заметками сохранён', 'good', 2200); }
    catch (e) { toast('Сохранить файл не получилось — попробуйте ещё раз', 'warn'); }
  }
  /** «в карточки»: the sentence of every highlight → a card (the same card path as a tapped word) */
  async function marksToCards(st, btn) {
    if (!window.Store || !Store.addCard) { toast('Карточки сейчас недоступны', 'warn'); return; }
    const hls = RS().marks(st.key, 'hl');
    if (!hls.length) return;
    const sents = [];
    hls.forEach(m => {
      const i0 = unitAt(st.M, m.b, m.s), i1 = unitAt(st.M, m.b2, Math.max(0, m.e - 1));
      const txt = st.M.units.slice(i0, i1 + 1).filter(u => !u.tr && !u.cyr).map(u => u.text.replace(/\s*\([^()]*[Ѐ-ӿ][^()]*\)/g, '').trim()).join(' ').trim();
      if (txt && txt.length <= 600 && !sents.some(x => x.no === txt)) sents.push({ no: txt, m, p: st.M.units[i0] ? st.M.units[i0].p : 1 });
    });
    if (!sents.length) { toast('В выделениях нет норвежских предложений для карточек', 'warn'); return; }
    const ok = await UI.confirm(`Сделать ${sents.length} ${plural(sents.length, ['карточку', 'карточки', 'карточек'])} из выделенных предложений?<br><span class="small muted">Каждое предложение — лицевая сторона, перевод — обратная. Колода «📖 ${esc(st.meta.title.slice(0, 60))}».</span>`, { ok: 'Сделать карточки', title: 'В карточки' });
    if (!ok) return;
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> перевожу…'; }
    let tr = [], by = [];
    try {
      if (window.Translators && Translators.translateMany) { const r = await Translators.translateMany(sents.map(x => x.no), 'no', 'ru', { quiet: true }); tr = (r && r.out) || []; by = (r && r.by) || []; }
    } catch (e) { tr = []; }
    const name = `📖 ${st.meta.title.slice(0, 60)}`;
    let deck = Store.decks().find(d => d.name === name);
    if (!deck) deck = Store.addDeck(name, `Слова из книги «${st.meta.title}» (Читалка)`);
    const norm = x => String(x || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const have = new Set(Store.cards(deck.id).map(c => norm(String(c.no).split('\n')[0])));
    let made = 0, noTr = 0, dup = 0;
    sents.forEach((x, k) => {
      const ru = String(tr[k] || '').trim() || (window.Study && Study.sentTr ? (Study.sentTr(x.no) || '') : '');
      if (!ru) { noTr++; return; }
      if (have.has(norm(x.no))) { dup++; return; }
      const label = `📖 «${st.meta.title}», стр. ${x.p}`;
      const card = { no: x.no, ru, example: '', exampleRu: '', description: x.m.note ? `${label} · заметка: ${x.m.note.slice(0, 200)}` : label, tags: ['reader', 'highlight'] };
      try {
        if (window.Prov && Prov.entry) card.history = [Prov.entry('import', 'create', null, label)].concat(window.Translators && Translators.provKeys ? Translators.provKeys(by).map(kk => Prov.entry(kk, 'translate', null, 'перевод выделенного предложения')) : []);
        if (window.Translators && Translators.mtFlag) card.mtWarn = Translators.mtFlag(by);
      } catch (e) { /* a plain card */ }
      Store.addCard(deck.id, card); have.add(norm(x.no)); made++;
    });
    try { if (Store.saveNow) await Store.saveNow(); } catch (e) { /* saved later */ }
    if (btn) { btn.disabled = false; btn.innerHTML = `${ICON.cards}<span>Выделения в карточки</span>`; }
    const extra = [dup ? `уже были: ${dup}` : '', noTr ? `без перевода (нет интернета?): ${noTr}` : ''].filter(Boolean).join(', ');
    toast(made ? `➕ ${made} ${plural(made, ['карточка', 'карточки', 'карточек'])} → ${deck.name}${extra ? ` (${extra})` : ''}` : `Новых карточек нет${extra ? ` — ${extra}` : ''}`, made ? 'good' : 'warn', 4200);
  }

  /* ---------- 🔎 search in the whole book: in chunks (a long book never freezes), hits marked in the text ---------- */
  const fold = t => t.toLowerCase().replace(/ё/g, 'е');
  function findOpen(st) {
    closePanel(st); closePop(st);
    if (st.findEl) { const i = st.findEl.querySelector('input'); if (i) i.focus(); return; }
    const el = document.createElement('div');
    el.className = 'rd-find';
    el.setAttribute('role', 'search');
    el.innerHTML = `<div class="rd-find-bar">
        <span class="rd-find-ico" aria-hidden="true">${ICON.search}</span>
        <input type="search" class="rd-find-in" placeholder="Найти в книге…" aria-label="Найти в книге" enterkeyhint="search" autocomplete="off" spellcheck="false">
        <span class="rd-find-n" data-fn aria-live="polite"></span>
        <button type="button" class="rd-ib" data-fa="prev" aria-label="Предыдущее совпадение" disabled>${ICON.left}</button>
        <button type="button" class="rd-ib" data-fa="next" aria-label="Следующее совпадение" disabled>${ICON.right}</button>
        <button type="button" class="rd-ib" data-fa="list" aria-label="Список совпадений" aria-expanded="false" disabled>${ICON.toc}</button>
        <button type="button" class="rd-ib" data-fa="x" aria-label="Закрыть поиск">${ICON.close || '✕'}</button>
      </div><div class="rd-find-res" data-fres hidden></div>`;
    st.stage.appendChild(el);
    st.findEl = el;
    st.root.setAttribute('data-finding', '');
    const inp = el.querySelector('input');
    let t = 0;
    inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => runFind(st, inp.value), 260); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); if (st.find && st.find.q === inp.value.trim() && st.find.hits.length) findStep(st, e.shiftKey ? -1 : 1); else runFind(st, inp.value); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); findClose(st); }
    });
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-fa]');
      if (b) { e.stopPropagation(); const a = b.dataset.fa; if (a === 'x') findClose(st); else if (a === 'next') findStep(st, 1); else if (a === 'prev') findStep(st, -1); else if (a === 'list') findList(st, null); return; }
      const h = e.target.closest('[data-hit]');
      if (h) { e.stopPropagation(); findGo(st, +h.dataset.hit); findList(st, false); }
    });
    setTimeout(() => inp.focus(), 30);
  }
  function findClose(st, quiet) {
    if (st.find) st.find.tok = -1;
    const had = !!(st.find && st.find.hits && st.find.hits.length);
    st.find = null;
    if (st.findEl) { st.findEl.remove(); st.findEl = null; }
    if (st.root) st.root.removeAttribute('data-finding');
    if (had && !quiet && st.flow && document.body.contains(st.flow)) redrawMarks(st);
  }
  async function runFind(st, q) {
    q = String(q || '').replace(/\s+/g, ' ').trim();
    const tok = (st.findTok = (st.findTok || 0) + 1);
    const nEl = st.findEl && st.findEl.querySelector('[data-fn]');
    const btns = st.findEl ? [...st.findEl.querySelectorAll('[data-fa="prev"],[data-fa="next"],[data-fa="list"]')] : [];
    if (q.length < 2) { st.find = null; if (nEl) nEl.textContent = q ? 'ещё буква…' : ''; btns.forEach(b => { b.disabled = true; }); findList(st, false); redrawMarks(st); return; }
    const F = st.find = { q, hits: [], byB: new Map(), cur: -1, tok, done: false };
    const qq = fold(q), M = st.M, LIMIT = 2000;
    if (nEl) nEl.textContent = 'ищу…';
    const t0 = performance.now();
    for (let b = 0; b < M.blocks.length; b++) {
      if (!TEXT_KINDS.has(M.blocks[b][0])) continue;
      const t = M.blocks[b][1] || '';
      const lt = fold(t);
      const same = lt.length === t.length; // a letter that changes length when folded: offsets kept by a slower path
      let from = 0, k;
      while ((k = lt.indexOf(qq, from)) >= 0 && F.hits.length < LIMIT) {
        const s0 = same ? k : fold(t.slice(0, k)).length === k ? k : k, e0 = s0 + q.length;
        F.hits.push([b, s0, e0]);
        if (!F.byB.has(b)) F.byB.set(b, []);
        F.byB.get(b).push([s0, e0, F.hits.length - 1]);
        from = k + Math.max(1, qq.length);
      }
      if (F.hits.length >= LIMIT) break;
      // every ~12 ms: give the page back (typing, scrolling, reading aloud go on)
      if (performance.now() - t0 > 12 && b % 40 === 0) {
        await new Promise(r => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 60 }) : setTimeout(r, 0)));
        if (st.find !== F || F.tok !== tok || R !== st) return;
        if (nEl) nEl.textContent = `ищу… ${Math.round(b / M.blocks.length * 100)}%`;
      }
    }
    if (st.find !== F || R !== st) return;
    F.done = true;
    btns.forEach(b => { b.disabled = !F.hits.length; });
    if (!F.hits.length) { if (nEl) nEl.textContent = 'не найдено'; redrawMarks(st); findList(st, false); return; }
    // the first hit after the place you read
    const here = st.M.units[st.cur] || { b: 0, o: 0 };
    let k = F.hits.findIndex(h => h[0] > here.b || (h[0] === here.b && h[1] >= Math.max(0, here.o)));
    if (k < 0) k = 0;
    findGo(st, k);
  }
  function findNum(st) {
    const F = st.find, nEl = st.findEl && st.findEl.querySelector('[data-fn]');
    if (!F || !nEl) return;
    nEl.textContent = `${F.cur + 1} из ${F.hits.length}${F.hits.length >= 2000 ? '+' : ''}`;
  }
  function findGo(st, k) {
    const F = st.find; if (!F || !F.hits.length) return;
    F.cur = (k + F.hits.length) % F.hits.length;
    const [b, s0] = F.hits[F.cur];
    const i = unitAt(st.M, b, s0);
    marksIndex(st);
    st.userNav = 0;
    renderAt(st, i, true);
    st.cur = i;
    const mk = st.flow.querySelector('.rd-sr-cur');
    if (mk) {
      if (modeNow() === 'page') { const fr = st.flow.getBoundingClientRect(), r = mk.getClientRects()[0]; if (r) goPage(st, clamp(Math.floor((r.left - fr.left + 2) / st.step), 0, st.nPages - 1), false); }
      else { const vr = st.view.getBoundingClientRect(), r = mk.getBoundingClientRect(); st.view.scrollTop += r.top - vr.top - st.view.clientHeight * 0.35; }
    }
    progressUi(st); savePos(st);
    findNum(st);
  }
  function findStep(st, d) { if (st.find && st.find.hits.length) findGo(st, st.find.cur + d); }
  /** the list of hits with a bit of text around each (shown / hidden) */
  function findList(st, show) {
    const box = st.findEl && st.findEl.querySelector('[data-fres]'), btn = st.findEl && st.findEl.querySelector('[data-fa="list"]');
    if (!box) return;
    if (show == null) show = box.hidden;
    const F = st.find;
    if (!show || !F || !F.hits.length) { box.hidden = true; if (btn) btn.setAttribute('aria-expanded', 'false'); return; }
    const M = st.M, max = 300;
    box.innerHTML = `<div class="rd-tiny rd-find-sum">Найдено: ${F.hits.length}${F.hits.length >= 2000 ? '+' : ''}${F.hits.length > max ? ` · показаны первые ${max}` : ''}</div>` + F.hits.slice(0, max).map(([b, s0, e0], k) => {
      const t = M.blocks[b][1];
      const a = Math.max(0, s0 - 50), z = Math.min(t.length, e0 + 60);
      const i = unitAt(M, b, s0), pg = M.units[i] ? M.units[i].p : 1;
      return `<button type="button" class="rd-hit${k === F.cur ? ' on' : ''}" data-hit="${k}"><span>${a > 0 ? '…' : ''}${esc(t.slice(a, s0))}<mark>${esc(t.slice(s0, e0))}</mark>${esc(t.slice(e0, z))}${z < t.length ? '…' : ''}</span><small>стр. ${pg}</small></button>`;
    }).join('');
    box.hidden = false;
    if (btn) btn.setAttribute('aria-expanded', 'true');
    const on = box.querySelector('.rd-hit.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }

  /* ---------- 📑 the book's own table of contents (EPUB 3 nav / EPUB 2 NCX / Kindle NCX / FB2 sections), nested ---------- */
  function bookToc(st) {
    const toc = st.rich && st.rich.toc;
    if (!toc || !toc.length) return null;
    const out = [];
    const walk = (list, lv) => list.forEach(e => { if (lv > 5) return; out.push({ t: e.t, b: e.b, lv }); if (e.c && e.c.length) walk(e.c, lv + 1); });
    walk(toc, 0);
    return out.length >= 2 ? out : null;
  }

  /* ---------- 🎨 the reader's settings from another device ---------- */
  function applyRemoteSettings() {
    if (!RS()) return;
    const S0 = RS().settings();
    let ch = false;
    RS().SYNC_SET.forEach(k => { if (k in S0 && S0[k] !== P[k]) { P[k] = S0[k]; ch = true; } });
    if (!ch) return;
    savePrefs();
    if (R) { applyLook(R); relayout(R); }
  }
  /* ---------- 📄 DjVu: the page view (js/rddjvu.js) inside the same reader window ---------- */
  async function openDjvu(meta, text, opts, rp) {
    let V;
    const busy = UI.busy ? UI.busy('Открываю DjVu…') : { close() {} };
    try { V = await need('rddjvu'); await need('djvu'); } catch (e) { busy.close(); toast('Помощник для DjVu не загрузился — проверьте интернет и попробуйте ещё раз', 'warn'); return; }
    let file = null;
    try { file = (TEMP.get(meta.id) || {}).file || await DB.file(meta.id); } catch (e) { file = null; }
    busy.close();
    const fileBlob = blobOf(file);
    if (!fileBlob) { toast('Файл этой книги не нашёлся на устройстве — загрузите его снова', 'warn', 6000); return; }
    let page = clamp(meta.pos || 0, 0, (text.djvu.pages || 1) - 1);
    if (rp && rp.at > (meta.posAt || 0) + 1000) { page = clamp(rp.b, 0, text.djvu.pages - 1); meta.posAt = rp.at; }
    meta.opened = Date.now();
    putSoon(meta);
    V.open({
      meta, text, blob: fileBlob, page, key: meta.key, P, PALETTE, ICON, esc, toast, savePrefs,
      skins: SKINS,
      onPage(n, pages) {
        meta.pos = n; meta.pct = pages > 1 ? n / (pages - 1) : 1; meta.pages = pages;
        if (meta.key && RS()) { RS().setPos(meta.key, { b: n, o: 0, pg: n + 1, pct: meta.pct }); meta.posAt = Date.now(); }
        putSoon(meta);
        try { const e = { id: meta.id, title: String(meta.title || '').slice(0, 140), author: String(meta.author || '').slice(0, 100), page: n + 1, pages, pct: meta.pct, at: Date.now() }; recentPut([e].concat(recentAll().filter(x => x.id !== e.id))); } catch (err) { /* a convenience */ }
      },
      onClose() { flushSave().then(() => drawShelf(), () => drawShelf()); },
      onDelete: async () => {
        const ok = await UI.confirm(`Удалить книгу «${esc(meta.title)}» с этого устройства?<br><span class="small muted">${DEL_NOTE}</span>`, { danger: true, ok: 'Да, удалить', title: 'Удалить книгу?' });
        if (!ok) return false;
        if (meta.key && RS()) RS().forget(meta.key);
        saveMeta = null; clearTimeout(saveT); recentForget(meta.id);
        try { await DB.del(meta.id); TEMP.delete(meta.id); toast(`Книга «${meta.title}» удалена с устройства`, 'good'); } catch (e) { toast('Не получилось удалить книгу — попробуйте ещё раз', 'warn'); }
        drawShelf();
        return true;
      },
      wordPop: (word, rect, sentence, range, page, hl) => showWordPopFree(word, rect, sentence, range, meta, page, hl),
    });
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
    w.hl = hlAt(st, w.range.startContainer);
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
    const sentence = w.sentence != null ? w.sentence : sentenceOfSpan(st, w.span);
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
        ${st.free ? '' : '<button type="button" class="btn sm" data-pa="from">▶ Читать отсюда</button>'}
        ${canTr && sentence && !cyr ? '<button type="button" class="btn sm ghost" data-pa="sent">Перевод фразы</button>' : ''}
      </div>
      ${w.hl ? `<div class="rd-pop-hl" role="group" aria-label="Выделение">
        ${HL_COLORS.map(([c, l]) => `<button type="button" class="rd-hlsw rd-hl-${c}${w.hl.c === c ? ' on' : ''}" data-pa="hlc" data-c="${c}" aria-label="Цвет: ${l}" aria-pressed="${w.hl.c === c}"></button>`).join('')}
        <button type="button" class="rd-ib" data-pa="hlnote" aria-label="${w.hl.note ? 'Изменить заметку' : 'Добавить заметку'}" title="${w.hl.note ? 'Изменить заметку' : 'Добавить заметку'}">${ICON.notes}</button>
        <button type="button" class="rd-ib rd-ib-bad" data-pa="hldel" aria-label="Удалить выделение" title="Удалить выделение">${ICON.trash2}</button>
        ${w.hl.note ? `<div class="rd-pop-note">${esc(w.hl.note)}</div>` : ''}</div>` : ''}`;
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
      else if (a === 'hlc' && w.hl) { RS().updMark(st.key, w.hl.id, { c: b.dataset.c }); closePop(st); }
      else if (a === 'hlnote' && w.hl) { closePop(st); editNote(st, w.hl); }
      else if (a === 'hldel' && w.hl) { closePop(st); deleteMark(st, w.hl); }
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
  /** the same word bubble outside the text view (DjVu pages, js/rddjvu.js): translation, 🔊, «в карточки» */
  const FREE = { pop: null, free: true, freePage: 1, M: { uk: false, units: [] }, meta: { title: '' }, cur: 0, playing: false };
  function showWordPopFree(word, rect, sentence, range, meta, page, hl) {
    FREE.meta = meta; FREE.freePage = page || 1; FREE.key = meta.key || '';
    showPop(FREE, { word, rect, range, span: null, sentence: sentence || '', hl: hl || null });
    const out = e => { if (FREE.pop && !FREE.pop.contains(e.target)) { closePop(FREE); document.removeEventListener('pointerdown', out, true); } };
    setTimeout(() => document.addEventListener('pointerdown', out, true), 0);
    return () => closePop(FREE);
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
      const label = `📖 «${st.meta.title}», стр. ${st.free ? st.freePage : st.M.units[info.i] ? st.M.units[info.i].p : 1}`;
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
        if (modeNow() === 'page') { const pg = pageOfUnit(st, k); if (pg !== st.page) goPage(st, pg); }
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
    if (modeNow() === 'page') {
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
      setTimeout(() => { if (R === st) { relayout(st); ensureShown(st, i); if (modeNow() === 'page') goPage(st, pageForUnit(st, i), false); else scrollToUnit(st, i, false); progressUi(st); } }, 30);
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
    _t: { splitSentences, paraUnits, segsOf, buildModel, textBlocks, normBlocks, cyrLang, scriptOf, wantedSegs, unitAt, richHtml, P: () => P, R: () => R, goUnit: i => R && goUnit(R, i) },
  };
})();
