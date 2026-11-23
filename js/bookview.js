/* ============ 📖 BookView: a PDF book drawn by the app itself — the word being read lights up ON the page ============
 * 📚 Книги → «📖 Читать здесь» (js/books.js) mounts it instead of the browser's own PDF viewer whenever the file can be
 * read (the site allows it, or the Mac bridge fetches it); otherwise the browser's viewer stays as before.
 *  - pages: pdf.js (the same one the app loads for text, U.lib.pdf) → a canvas (pictures stay) + a text layer;
 *    only the visible pages ± 1 are drawn, pages far away give their canvas back (memory on phones);
 *  - our own zoom: − / + / «По ширине», two fingers on a phone, ctrl + wheel / trackpad pinch on a computer — the spot
 *    under the fingers stays put; remembered for all books;
 *  - 🎤 reading aloud (js/listen.js 'listen-word' / 'listen-state'): the word being said lights up on the page itself
 *    (CSS Custom Highlight API `bv-say` / `bv-done` through TTS.Karaoke; elsewhere the text is cut into spans for the
 *    time), the words of the line already said keep a soft tint; «вся строка» lights the whole line; the line is kept
 *    in view (smooth scroll; reduced motion — a jump); the reader's own scrolling pauses the following for a few seconds;
 *  - the voice says the CLEANED page text (util.js PageText: no page numbers, running headers, «. . .», joined lines),
 *    so its words are matched to the text-layer words in order: words the voice never says are simply stepped over;
 *  - a page with no text layer (a scan): a calm note and «🔎 Распознать текст» (Tesseract, the app's OCR) — the found
 *    words get the same highlight and are read aloud;
 *  - «Aa» (lookPop): highlight colour — the reader's PALETTE and the SAME setting (js/reader.js Reader.look), word /
 *    whole line / off, page zoom; «🔊 Голос» (voicePop): the voices of the 🎧 player for the book's languages.
 * Public: BookView.mount(host, { doc, lib, url, title, page, langs, onPage(n) }) → Promise<view>
 *         view = { goTo(n, smooth), page(), zoom(), setZoom(z), fit(), destroy() };
 *         BookView.lookPop(anchor, view), BookView.voicePop(anchor, langs), BookView.ocrText(url, n), BookView.prefs()
 */
(function () {
  const KEY = 'nk-bookview';
  const ZMIN = 0.5, ZMAX = 3;
  const ZSTEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2, 2.5, 3];
  const GAP = 12;                // between pages, px
  const FOLLOW_REST = 5000;      // after the reader scrolls by hand, the voice does not move the page for 5 s
  const DEF = { zoom: 1, unit: 'word' }; // zoom: × «по ширине»; unit: 'word' | 'line' | 'off'
  const esc = s => U.esc(s == null ? '' : String(s));
  const clampZ = z => Math.max(ZMIN, Math.min(ZMAX, +z || 1));
  const motion = () => (window.TTS && TTS.motionOk ? TTS.motionOk() : !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches));
  const wordsOf = s => (window.TTS && TTS.wordsOf ? TTS.wordsOf(s) : []);
  /** a word for matching: case, ё/е, soft hyphens, footnote marks, apostrophes do not count */
  const normW = w => String(w || '').toLowerCase().normalize('NFC').replace(/ё/g, 'е').replace(/[­​-‍⁠﻿]/g, '').replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, '').replace(/[’ʼ]/g, "'");

  /* ---------- settings: own (zoom, word / line) + the reader's highlight colour ---------- */
  function prefs() { try { return Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return Object.assign({}, DEF); } }
  function setPref(k, v) {
    const p = prefs(); p[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* private mode: for this visit */ }
    document.dispatchEvent(new CustomEvent('bookview-pref', { detail: { k } }));
  }
  const look = () => (window.Reader && Reader.look) || null;
  const FALLBACK = [['amber', 'Янтарь', '#ffc94d'], ['mint', 'Мята', '#6fe0b0'], ['sky', 'Небо', '#7cc4ff'], ['lilac', 'Сирень', '#c2a8ff']];
  const palette = () => (look() && look().PALETTE) || FALLBACK;
  const hlKey = () => (look() ? look().get('hl') : 'amber') || 'amber';
  const hlColor = () => (palette().find(x => x[0] === hlKey()) || palette()[0])[2];
  /** the highlight is on: the reader's «Бегущая подсветка» and our «Слово / Вся строка / Не подсвечивать» */
  const unit = () => { const L = look(); if (L && L.get('kar') === false) return 'off'; const u = prefs().unit; return u === 'line' || u === 'off' ? u : 'word'; };
  const rgba = (hex, a) => { const n = parseInt(String(hex).replace('#', ''), 16) || 0xffc94d; return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  /** ::highlight colours as a real rule (custom properties inside highlight pseudos are not reliable in every browser) */
  function paintStyle() {
    let st = document.getElementById('bv-hl-style');
    if (!st) { st = document.createElement('style'); st.id = 'bv-hl-style'; document.head.appendChild(st); }
    const c = hlColor();
    st.textContent = `::highlight(bv-say){background-color:${rgba(c, 0.55)};color:transparent}
::highlight(bv-done){background-color:${rgba(c, 0.2)};color:transparent}
.bv-text .bv-w-say{background-color:${rgba(c, 0.55)};border-radius:2px}
.bv-text .bv-w-done{background-color:${rgba(c, 0.2)}}
.bv{--bv-hl:${c}}`;
  }

  /* ---------- OCR results of scanned pages (this visit): url → { n: { text, words } } ---------- */
  const OCR = {};
  const ocrText = (url, n) => ((OCR[url] || {})[n] || {}).text || '';

  /**
   * spoken words → page words, in order. A spoken word matches a page word, or 2–3 page words glued together (a word
   * cut at a line end «beskri-» + «velse», or split into pieces by the PDF). A jump over several page words (a header,
   * a page number the voice skipped) has to be confirmed by the next spoken word too. Unmatched words stay null.
   */
  function align(sp, pg) {
    const map = new Array(sp.length).fill(null);
    const glued = (q, w) => {
      if (pg[q].w === w) return 1;
      let acc = pg[q].w;
      for (let k = 1; k < 3 && q + k < pg.length && w.startsWith(acc); k++) { acc += pg[q + k].w; if (acc === w) return k + 1; }
      return 0;
    };
    let j = 0;
    for (let i = 0; i < sp.length; i++) {
      const w = sp[i];
      if (!w) continue;
      let hit = null;
      for (let q = j; q < Math.min(pg.length, j + 80) && !hit; q++) {
        const len = glued(q, w);
        if (!len) continue;
        if (q - j > 2 && i + 1 < sp.length && sp[i + 1]) {
          const nx = sp[i + 1], a = pg[q + len], b = pg[q + len + 1];
          if (!((a && (a.w === nx || nx.startsWith(a.w))) || (b && b.w === nx))) continue;
        }
        hit = { q, len };
      }
      if (hit) { map[i] = pg.slice(hit.q, hit.q + hit.len); j = hit.q + hit.len; }
    }
    return map;
  }

  /* ---------- the view ---------- */
  async function mount(host, o) {
    const doc = o.doc, lib = o.lib || {}, url = o.url || '', N = doc.numPages;
    host.innerHTML = `<div class="bv" data-bv>
        <div class="bv-stage" tabindex="0" role="region" aria-label="Страницы книги${o.title ? ' «' + esc(o.title) + '»' : ''}"><div class="bv-pages"></div></div>
        <div class="bv-zoom" role="group" aria-label="Масштаб страницы">
          <button type="button" class="bv-zb" data-z="-" title="Мельче (−)" aria-label="Мельче">−</button>
          <span class="bv-zv" data-zv aria-live="polite">100%</span>
          <button type="button" class="bv-zb" data-z="+" title="Крупнее (+)" aria-label="Крупнее">+</button>
          <button type="button" class="bv-zb bv-zfit" data-z="fit" title="Страница по ширине окна">По ширине</button></div>
      </div>`;
    const root = host.querySelector('.bv'), stage = root.querySelector('.bv-stage'), wrap = root.querySelector('.bv-pages');
    paintStyle();
    const first = await doc.getPage(1);
    const v1 = first.getViewport({ scale: 1 });
    const pages = [];
    const frag = document.createDocumentFragment();
    for (let n = 1; n <= N; n++) {
      const el = document.createElement('div');
      el.className = 'bv-page'; el.dataset.n = n;
      el.setAttribute('role', 'group'); el.setAttribute('aria-label', `Страница ${n} из ${N}`);
      el.innerHTML = `<div class="bv-ph" aria-hidden="true">${n}</div>`;
      frag.appendChild(el);
      pages.push({ n, w: v1.width, h: v1.height, el, cv: null, tl: null, drawn: 0, words: null, lines: null, ver: 0 });
    }
    wrap.appendChild(frag);
    let zoom = clampZ(prefs().zoom), base = 1, scale = 1, cur = Math.max(1, Math.min(N, o.page || 1)), tops = [];
    let dead = false, userAt = 0, last = null, readingPage = 0, raf = 0;
    const tcache = new Map();
    const K = window.TTS && TTS.Karaoke ? new TTS.Karaoke({ name: 'bv', cls: 'bv-kmark' }) : null;
    const mine = p => !!(p && p.o && p.o.bookUrl === url);
    const busy = () => Date.now() - userAt < FOLLOW_REST;

    /* sizes and places */
    const maxW = () => pages.reduce((m, p) => Math.max(m, p.w), 1);
    function layout(keep = true) {
      const a = keep ? anchor() : null;
      const pad = stage.clientWidth < 520 ? 8 : 16;
      base = Math.max(0.1, (stage.clientWidth - pad * 2) / maxW());
      scale = base * zoom;
      pages.forEach(p => {
        p.el.style.width = Math.round(p.w * scale) + 'px';
        p.el.style.height = Math.round(p.h * scale) + 'px';
        // a drawn text layer follows the new size at once (its words are placed in % and sized by --scale-factor); the canvas is redrawn soon
        if (p.tl) { p.tl.style.setProperty('--scale-factor', scale); p.tl.style.setProperty('--total-scale-factor', scale); }
      });
      tops = pages.map(p => p.el.offsetTop);
      const zv = root.querySelector('[data-zv]'); if (zv) zv.textContent = Math.round(zoom * 100) + '%';
      root.classList.toggle('zoomed', zoom > 1.001);
      if (a) restore(a);
      schedule();
    }
    /** where the view is: page + share of it at the top (kept through zoom / size changes) */
    function anchor() {
      const t = stage.scrollTop, k = Math.max(0, pageAt(t));
      const p = pages[k];
      return { k, f: p.el.offsetHeight ? (t - tops[k]) / p.el.offsetHeight : 0, x: stage.scrollWidth > stage.clientWidth ? (stage.scrollLeft + stage.clientWidth / 2) / stage.scrollWidth : 0.5 };
    }
    function restore(a) {
      const p = pages[a.k]; if (!p) return;
      stage.scrollTop = tops[a.k] + a.f * p.el.offsetHeight;
      if (stage.scrollWidth > stage.clientWidth) stage.scrollLeft = a.x * stage.scrollWidth - stage.clientWidth / 2;
    }
    function pageAt(y) {
      let lo = 0, hi = pages.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (tops[mid] <= y) lo = mid; else hi = mid - 1; }
      return lo;
    }

    /* drawing: visible pages ± 1, nearest first, one at a time; far pages give their canvas back */
    let drawing = false;
    function schedule() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; update(); }); }
    function update() {
      if (dead || !tops.length) return;
      const top = stage.scrollTop, bot = top + stage.clientHeight;
      const a = pageAt(top), b = pageAt(Math.max(top, bot - 1));
      const now = pageAt(top + stage.clientHeight * 0.4) + 1;
      if (now !== cur) { cur = now; if (o.onPage) { try { o.onPage(cur); } catch (e) { /* the caller's */ } } }
      pages.forEach((p, k) => { if ((p.drawn || p.cv) && (k < a - 3 || k > b + 3)) release(p); });
      pump(a, b);
    }
    async function pump(a, b) {
      if (drawing || dead) return;
      drawing = true;
      try {
        for (;;) {
          if (dead) break;
          const top = stage.scrollTop, bot = top + stage.clientHeight;
          a = pageAt(top); b = pageAt(Math.max(top, bot - 1));
          const want = [];
          for (let k = Math.max(0, a - 1); k <= Math.min(pages.length - 1, b + 1); k++) want.push(k);
          const mid = (a + b) / 2;
          want.sort((x, y) => Math.abs(x - mid) - Math.abs(y - mid));
          const k = want.find(i => pages[i].drawn !== scale && !pages[i].failed);
          if (k == null) break;
          await draw(pages[k]);
        }
      } finally { drawing = false; }
    }
    async function draw(p) {
      const s = scale, gen = p.gen = (p.gen || 0) + 1;
      try {
        const page = await doc.getPage(p.n);
        if (dead || s !== scale || gen !== p.gen) return;
        const vp = page.getViewport({ scale: s });
        if (Math.abs(vp.width / s - p.w) > 0.5 || Math.abs(vp.height / s - p.h) > 0.5) { p.w = vp.width / s; p.h = vp.height / s; layout(true); if (s !== scale) return; }
        // the canvas: sharp on retina screens, but never more than ~12 Mpx (phones run out of canvas memory)
        const dpr = Math.min(window.devicePixelRatio || 1, 2), k = Math.max(0.5, Math.min(dpr, Math.sqrt(12e6 / Math.max(1, vp.width * vp.height))));
        const cv = document.createElement('canvas');
        cv.width = Math.floor(vp.width * k); cv.height = Math.floor(vp.height * k);
        cv.className = 'bv-cv'; cv.setAttribute('aria-hidden', 'true');
        const ctx = cv.getContext('2d', { alpha: false });
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
        const task = p.task = page.render({ canvasContext: ctx, canvas: cv, viewport: page.getViewport({ scale: s * k }) });
        try { await task.promise; } catch (e) { cv.width = cv.height = 0; if (e && /cancel/i.test(e.name + e.message)) return; throw e; }
        p.task = null;
        if (dead || gen !== p.gen || s !== scale) { cv.width = cv.height = 0; return; }
        if (p.cv) { p.cv.width = p.cv.height = 0; p.cv.remove(); }
        const ph = p.el.querySelector('.bv-ph'); if (ph) ph.remove();
        p.el.insertBefore(cv, p.el.firstChild); p.cv = cv;
        // the text layer (the words to light up)
        let tc = tcache.get(p.n);
        if (!tc) { tc = await page.getTextContent(); tcache.set(p.n, tc); }
        if (dead || gen !== p.gen) return;
        const tl = document.createElement('div');
        tl.className = 'bv-text';
        tl.style.setProperty('--scale-factor', s); tl.style.setProperty('--total-scale-factor', s);
        if (p.tl) p.tl.remove();
        p.el.appendChild(tl); p.tl = tl; p.drawnScale = s;
        const letters = tc.items.reduce((n, it) => n + ((it.str || '').match(/\p{L}/gu) || []).length, 0);
        p.scan = letters < 3;
        if (!p.scan) {
          if (lib.TextLayer) await new lib.TextLayer({ textContentSource: tc, container: tl, viewport: vp }).render();
          else if (lib.renderTextLayer) await lib.renderTextLayer({ textContentSource: tc, container: tl, viewport: vp, textDivs: [] }).promise;
        } else if ((OCR[url] || {})[p.n]) ocrLayer(p, tl);
        if (dead || gen !== p.gen) return;
        index(p);
        scanNote(p);
        p.drawn = s;
        if (last && last.page === p.n) paint();
      } catch (e) {
        if (dead) return;
        p.failed = true;
        console.warn('book page', p.n, e);
        if (!p.cv) { const ph = p.el.querySelector('.bv-ph'); if (ph) ph.innerHTML = `<span class="bv-err">Эту страницу не удалось показать</span>`; }
      }
    }
    function release(p) {
      p.gen = (p.gen || 0) + 1;
      try { if (p.task) p.task.cancel(); } catch (e) { /* ignore */ }
      p.task = null;
      if (p.cv) { p.cv.width = p.cv.height = 0; p.cv.remove(); p.cv = null; }
      if (p.tl) { p.tl.remove(); p.tl = null; }
      p.words = null; p.lines = null; p.drawn = 0; p.align = null;
      if (!p.el.querySelector('.bv-ph')) { const ph = document.createElement('div'); ph.className = 'bv-ph'; ph.setAttribute('aria-hidden', 'true'); ph.textContent = p.n; p.el.insertBefore(ph, p.el.firstChild); }
    }
    /** the page's words in reading order, with their line */
    function index(p) {
      const spans = p.tl ? [...p.tl.querySelectorAll('span')].filter(x => !x.classList.contains('markedContent') && x.childNodes.length === 1 && x.firstChild.nodeType === 3) : [];
      const words = [], lines = [];
      let lt = 0, lh = 0, li = -1;
      spans.forEach(sp => {
        const t = sp.offsetTop, h = sp.offsetHeight || 1;
        if (!/\S/.test(sp.textContent)) { if (li >= 0) { lines[li].push(sp); sp._bvLine = li; } return; }
        if (li < 0 || Math.abs(t - lt) > Math.max(h, lh) * 0.6) { li++; lines.push([]); lt = t; lh = h; }
        lines[li].push(sp); sp._bvLine = li;
        wordsOf(sp.textContent).forEach(w => words.push({ w: normW(w.w), el: sp, s: w.s, e: w.e, line: li }));
      });
      p.words = words; p.lines = lines; p.ver++; p.align = null;
    }

    /* 🔎 a page without a text layer (a scan) */
    function scanNote(p) {
      let n = p.el.querySelector('.bv-scan');
      if (!p.scan || (OCR[url] || {})[p.n]) { if (n && !n.dataset.keep) n.remove(); return; }
      if (n) return;
      n = document.createElement('div');
      n.className = 'bv-scan'; n.setAttribute('role', 'note');
      const can = !!(U.lib && U.lib.ocr);
      n.innerHTML = `<span data-scan-t>На этой странице текст — картинка: подсветить нечего.${can ? ' Распознать текст?' : ''}</span>${can ? '<button type="button" class="btn sm" data-ocr title="Найти текст на картинке страницы — тогда его можно слушать и он будет подсвечиваться">🔎 Распознать</button>' : ''}`;
      p.el.appendChild(n);
    }
    async function runOcr(p, btn) {
      const note = btn.closest('.bv-scan'), t = note.querySelector('[data-scan-t]');
      btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> распознаю…';
      t.textContent = 'Ищу текст на странице. В первый раз загружаются словари (около 8 МБ) — это займёт до минуты.';
      try {
        const page = await doc.getPage(p.n);
        const vp = page.getViewport({ scale: Math.min(3, 1800 / Math.max(p.w, p.h)) });
        const cv = document.createElement('canvas');
        cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
        const ctx = cv.getContext('2d', { alpha: false }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
        await page.render({ canvasContext: ctx, canvas: cv, viewport: vp }).promise;
        const worker = await U.lib.ocr();
        let r;
        try { r = await worker.recognize(cv, {}, { text: true, blocks: true }); } catch (e) { r = await worker.recognize(cv); }
        cv.width = cv.height = 0;
        const d = (r && r.data) || {}, words = [];
        const push = w => { if (w && w.text && w.text.trim() && w.bbox && !(w.confidence < 35)) words.push({ t: w.text.trim(), x0: w.bbox.x0 / vp.width, y0: w.bbox.y0 / vp.height, x1: w.bbox.x1 / vp.width, y1: w.bbox.y1 / vp.height }); };
        if (Array.isArray(d.blocks)) d.blocks.forEach(b => (b.paragraphs || []).forEach(pa => (pa.lines || []).forEach(l => (l.words || []).forEach(push))));
        else (d.words || []).forEach(push);
        const text = String(d.text || words.map(w => w.t).join(' ')).replace(/[ \t]+/g, ' ').trim();
        if (!text || !/\p{L}{2}/u.test(text)) { t.textContent = 'Текста здесь не нашлось — похоже, на странице только рисунок.'; btn.remove(); return; }
        (OCR[url] = OCR[url] || {})[p.n] = { text, words };
        if (p.tl) { p.tl.innerHTML = ''; ocrLayer(p, p.tl); index(p); }
        note.dataset.keep = '1';
        t.textContent = '✓ Текст распознан: при чтении вслух эта страница прозвучит и будет подсвечиваться.';
        btn.remove();
        setTimeout(() => { if (note.isConnected) note.remove(); }, 6000);
      } catch (e) {
        console.warn('book ocr', e);
        t.textContent = U.niceErr ? U.niceErr(e, 'Распознать текст не получилось') : 'Распознать текст не получилось — попробуйте ещё раз';
        btn.disabled = false; btn.textContent = '🔎 Ещё раз';
      }
    }
    /** OCR words as an invisible text layer (each word its own span, stretched to its box) */
    function ocrLayer(p, tl) {
      const rec = (OCR[url] || {})[p.n]; if (!rec) return;
      const W = p.w * scale, H = p.h * scale;
      tl.classList.add('bv-ocr');
      rec.words.forEach(w => {
        const sp = document.createElement('span');
        sp.textContent = w.t;
        sp.style.left = (w.x0 * 100).toFixed(3) + '%'; sp.style.top = (w.y0 * 100).toFixed(3) + '%';
        sp.style.fontSize = Math.max(4, (w.y1 - w.y0) * H * 0.9).toFixed(1) + 'px';
        sp.dataset.w = ((w.x1 - w.x0) * W).toFixed(1);
        tl.appendChild(sp);
      });
      tl.querySelectorAll('span').forEach(sp => { const sw = sp.scrollWidth || sp.offsetWidth; if (sw > 0) sp.style.transform = `scaleX(${(+sp.dataset.w / sw).toFixed(4)})`; });
    }

    /* 🎤 the word being said */
    function alignment(p, card, lo) {
      const items = Listen.cardItems(card, lo);
      const sig = items.map(x => x.text).join('\u0001');
      if (p.align && p.align.sig === sig && p.align.ver === p.ver) return p.align;
      const sp = [], start = [], count = [];
      items.forEach(it => { start.push(sp.length); const ws = wordsOf(it.text); count.push(ws.length); ws.forEach(w => sp.push(normW(w.w))); });
      return (p.align = { sig, ver: p.ver, start, count, map: align(sp, p.words || []) });
    }
    function clearHl() { if (K) K.clear(); root.classList.remove('reading'); }
    function paint() {
      const lp = window.Listen && Listen.p;
      if (!last || !K || !mine(lp) || unit() === 'off') { clearHl(); return; }
      const p = pages[last.page - 1];
      if (!p) return;
      if (!p.words) { if (!busy()) goTo(last.page, true); return; } // drawn soon — painted then
      const card = lp.cards[last.i]; if (!card) return;
      const al = alignment(p, card, lp.o);
      const cnt = al.count[last.n] || 0;
      if (!cnt) return;
      const done = last.done || last.w >= cnt;
      const gi = (al.start[last.n] || 0) + Math.min(last.w, cnt - 1);
      // the word now (or, when it was not found on the page, the last one found before it — for the line)
      let say = done ? null : al.map[gi];
      let ref = say;
      for (let q = gi; !ref && q >= 0 && q >= gi - 12; q--) ref = al.map[q];
      if (!ref) { clearHl(); return; }
      const line = ref[ref.length - 1].line;
      const ents = new Map();
      const ent = el => { let x = ents.get(el); if (!x) { x = { el, cur: null, done: 0 }; ents.set(el, x); } return x; };
      if (unit() === 'line') {
        (p.lines[line] || []).forEach(el => { ent(el).cur = [0, el.textContent.length]; });
      } else {
        const firstPw = (say || ref)[0];
        const fi = p.words.indexOf(firstPw);
        // words of this line said before: a soft tint
        for (let q = fi - 1; q >= 0 && p.words[q].line === line; q--) { const w = p.words[q]; const x = ent(w.el); x.done = Math.max(x.done, w.e); }
        if (!say) { const w = ref[ref.length - 1]; const x = ent(w.el); x.done = Math.max(x.done, w.e); }
        else say.forEach(w => { const x = ent(w.el); x.cur = [w.s, w.e]; });
      }
      try { K.show([...ents.values()]); } catch (e) { /* the page goes on without the highlight */ }
      root.classList.add('reading');
      // keep the line in view
      if (!busy()) {
        const w = (say || ref)[0];
        let r = null;
        try { const rg = document.createRange(); const tn = w.el.firstChild; if (tn && tn.nodeType === 3) { rg.setStart(tn, Math.min(w.s, tn.length)); rg.setEnd(tn, Math.min(w.e, tn.length)); r = rg.getBoundingClientRect(); } } catch (e) { r = null; }
        if (!r || !r.height) r = w.el.getBoundingClientRect();
        keepInView(r);
      }
    }
    function keepInView(r) {
      const sr = stage.getBoundingClientRect();
      if (!sr.height) return;
      let dy = 0, dx = 0;
      if (r.top < sr.top + sr.height * 0.1 || r.bottom > sr.bottom - sr.height * 0.22) dy = r.top - (sr.top + sr.height * 0.35);
      if (r.left < sr.left + 6 || r.right > sr.right - 6) dx = r.left - (sr.left + sr.width * 0.3);
      if (Math.abs(dy) > 2 || Math.abs(dx) > 2) stage.scrollBy({ top: dy, left: dx, behavior: motion() ? 'smooth' : 'auto' });
    }
    const onWord = e => {
      const d = e && e.detail;
      if (!d || !d.page || !mine(window.Listen && Listen.p)) return;
      last = d;
      paint();
    };
    const onState = () => {
      const lp = window.Listen && Listen.p;
      if (!mine(lp)) { if (last || readingPage) { last = null; readingPage = 0; clearHl(); } return; }
      const c = lp.cards[lp.i];
      if (!c || !c.page) return;
      if (c.page !== readingPage) {
        readingPage = c.page;
        if (last && last.page !== c.page) { last = null; clearHl(); }
        if (!busy() && c.page !== cur) goTo(c.page, true);
      }
    };
    const onLook = () => { paintStyle(); paint(); };

    /* zoom */
    function setZoom(z, fx, fy) {
      z = clampZ(z);
      if (Math.abs(z - zoom) < 0.001) return;
      // the point under the fingers / the pointer (or the middle of the view) stays where it is
      const sr = stage.getBoundingClientRect();
      const px = fx != null ? fx - sr.left : stage.clientWidth / 2, py = fy != null ? fy - sr.top : stage.clientHeight / 2;
      const cx = stage.scrollLeft + px, cy = stage.scrollTop + py;
      const k = pageAt(cy), p = pages[k];
      const relY = p.el.offsetHeight ? (cy - tops[k]) / p.el.offsetHeight : 0, relX = (cx - p.el.offsetLeft) / Math.max(1, p.el.offsetWidth);
      zoom = z;
      setPref('zoom', Math.round(z * 100) / 100);
      layout(false);
      stage.scrollTop = tops[k] + relY * p.el.offsetHeight - py;
      stage.scrollLeft = p.el.offsetLeft + relX * p.el.offsetWidth - px;
      schedule();
    }
    const step = d => { const i = ZSTEPS.findIndex(z => z >= zoom - 0.001); const k = d > 0 ? (ZSTEPS[i] > zoom + 0.001 ? i : i + 1) : i - 1; setZoom(ZSTEPS[Math.max(0, Math.min(ZSTEPS.length - 1, k))]); };
    root.querySelector('.bv-zoom').addEventListener('click', e => {
      const b = e.target.closest('[data-z]'); if (!b) return;
      if (b.dataset.z === 'fit') setZoom(1); else step(b.dataset.z === '+' ? 1 : -1);
    });

    /* the reader's own hands: scrolling pauses the following; two fingers / ctrl + wheel zoom */
    const touched = () => { userAt = Date.now(); };
    stage.addEventListener('wheel', e => {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); previewZoom(zoom * Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY); return; }
      touched();
    }, { passive: false });
    stage.addEventListener('keydown', e => {
      if (/^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End| )$/.test(e.key)) touched();
      if (e.key === '+' || e.key === '=') { e.preventDefault(); step(1); }
      else if (e.key === '-') { e.preventDefault(); step(-1); }
      else if (e.key === '0') { e.preventDefault(); setZoom(1); }
    });
    stage.addEventListener('pointerdown', touched);
    stage.addEventListener('scroll', schedule, { passive: true });
    // a quick preview by CSS while the fingers move, the real drawing when they stop
    let pinch = null, pz = null;
    function previewZoom(z, x, y) {
      z = clampZ(z);
      if (!pz) pz = { z0: zoom, x, y };
      pz.z = z; pz.x = x; pz.y = y;
      const sr = stage.getBoundingClientRect();
      wrap.style.transformOrigin = `${stage.scrollLeft + x - sr.left}px ${stage.scrollTop + y - sr.top}px`;
      wrap.style.transform = `scale(${(z / pz.z0).toFixed(4)})`;
      clearTimeout(pz.t);
      pz.t = setTimeout(commitZoom, 180);
    }
    function commitZoom() {
      if (!pz) return;
      const { z, x, y } = pz;
      clearTimeout(pz.t); pz = null;
      wrap.style.transform = ''; wrap.style.transformOrigin = '';
      setZoom(z, x, y);
    }
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    stage.addEventListener('touchstart', e => {
      touched();
      if (e.touches.length === 2) pinch = { d0: dist(e.touches) || 1, z0: zoom };
    }, { passive: true });
    stage.addEventListener('touchmove', e => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const x = (e.touches[0].clientX + e.touches[1].clientX) / 2, y = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      previewZoom(pinch.z0 * dist(e.touches) / pinch.d0, x, y);
    }, { passive: false });
    stage.addEventListener('touchend', e => { if (pinch && e.touches.length < 2) { pinch = null; commitZoom(); } });
    // Safari's own page zoom must not take the pinch (the page would zoom, not the book)
    ['gesturestart', 'gesturechange'].forEach(t => stage.addEventListener(t, e => e.preventDefault()));
    root.addEventListener('click', e => { const b = e.target.closest('[data-ocr]'); if (b) { const p = pages[+b.closest('.bv-page').dataset.n - 1]; if (p) runOcr(p, b); } });

    const ro = window.ResizeObserver ? new ResizeObserver(() => { const w = stage.clientWidth; if (w && Math.abs(w - (ro._w || 0)) > 2) { ro._w = w; layout(true); } }) : null;
    if (ro) ro.observe(stage);
    document.addEventListener('listen-word', onWord);
    document.addEventListener('listen-state', onState);
    document.addEventListener('reader-look', onLook);
    document.addEventListener('bookview-pref', onLook);

    function goTo(n, smooth) {
      n = Math.max(1, Math.min(N, +n || 1));
      const k = n - 1;
      if (!tops.length) return;
      const y = Math.max(0, tops[k] - 6);
      // a glide only for a short way (the next page); far away — at once (a long glide takes seconds)
      stage.scrollTo({ top: y, behavior: smooth && motion() && Math.abs(y - stage.scrollTop) < stage.clientHeight * 1.6 ? 'smooth' : 'auto' });
      if (cur !== n) { cur = n; if (o.onPage) { try { o.onPage(n); } catch (e) { /* the caller's */ } } }
      schedule();
    }
    // sizes of every page (most books: all alike) — read quietly in the background
    (async () => {
      for (let n = 2; n <= N && !dead; n++) {
        try {
          const pg = await doc.getPage(n), v = pg.getViewport({ scale: 1 }), p = pages[n - 1];
          if (Math.abs(v.width - p.w) > 0.5 || Math.abs(v.height - p.h) > 0.5) { p.w = v.width; p.h = v.height; p.resized = true; }
        } catch (e) { /* that page keeps the first page's size */ }
        if (n % 20 === 0) await new Promise(r => setTimeout(r, 0));
      }
      if (!dead && pages.some(p => p.resized)) layout(true);
    })();

    ro && (ro._w = stage.clientWidth);
    layout(false);
    goTo(cur, false);
    onState();

    const view = {
      root, stage,
      goTo,
      page: () => cur,
      total: () => N,
      zoom: () => zoom,
      setZoom: z => setZoom(z),
      step,
      fit: () => setZoom(1),
      repaint: () => { paintStyle(); paint(); },
      /** for tests: what is lit now */
      _state: () => ({ last, cur, scale, drawn: pages.filter(p => p.drawn).map(p => p.n), canvases: pages.filter(p => p.cv).length }),
      destroy() {
        if (dead) return;
        dead = true;
        if (raf) cancelAnimationFrame(raf);
        if (ro) ro.disconnect();
        document.removeEventListener('listen-word', onWord);
        document.removeEventListener('listen-state', onState);
        document.removeEventListener('reader-look', onLook);
        document.removeEventListener('bookview-pref', onLook);
        clearHl();
        pages.forEach(release);
        tcache.clear();
      },
    };
    return view;
  }

  /* ---------- small popovers right in the player row ---------- */
  let pop = null;
  function closePop() {
    if (!pop) return;
    const p = pop; pop = null;
    document.removeEventListener('pointerdown', p.out, true);
    window.removeEventListener('keydown', p.key, true);
    window.removeEventListener('resize', p.place);
    p.el.remove();
    if (p.anchor) { p.anchor.setAttribute('aria-expanded', 'false'); if (p.focusBack) try { p.anchor.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  function openPop(anchor, html, label, wire) {
    const same = pop && pop.anchor === anchor;
    closePop();
    if (same) return null;
    const el = document.createElement('div');
    el.className = 'bv-pop'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', label);
    el.innerHTML = html;
    document.body.appendChild(el);
    const place = () => {
      const r = anchor.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
      const w = Math.min(340, vw - 24);
      el.style.width = w + 'px';
      const left = Math.max(12, Math.min(vw - w - 12, r.right - w));
      const h = el.offsetHeight;
      const below = r.bottom + 8 + h <= vh - 12 || r.top - 8 - h < 12;
      el.style.left = left + 'px';
      el.style.top = Math.max(12, below ? r.bottom + 8 : r.top - 8 - h) + 'px';
    };
    const out = e => { if (!el.contains(e.target) && !anchor.contains(e.target)) closePop(); };
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); pop.focusBack = true; closePop(); } };
    pop = { el, anchor, out, key, place };
    anchor.setAttribute('aria-expanded', 'true');
    place();
    document.addEventListener('pointerdown', out, true);
    window.addEventListener('keydown', key, true); // before the window's own Escape (document, capture): only the popover closes
    window.addEventListener('resize', place);
    if (wire) wire(el, place);
    const f = el.querySelector('button, [tabindex]'); if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    return el;
  }
  /** «Aa»: highlight colour (shared with the reader), word / whole line / off, page zoom */
  function lookPop(anchor, view) {
    const html = () => {
      const u = unit(), k = hlKey(), z = view ? view.zoom() : clampZ(prefs().zoom);
      const segB = (v, l, t) => `<button type="button" class="bv-seg-b${u === v ? ' on' : ''}" data-unit="${v}" aria-pressed="${u === v}" title="${t}">${l}</button>`;
      return `<div class="bv-pop-h">Как показывать чтение</div>
        <div class="bv-pop-row"><span class="bv-pop-l">Цвет подсветки</span>
          <div class="bv-sw-row" role="group" aria-label="Цвет подсветки">${palette().map(([key, l, c]) => `<button type="button" class="bv-sw${key === k ? ' on' : ''}" data-hl="${key}" style="--c:${c}" aria-label="${esc(l)}" aria-pressed="${key === k}" title="${esc(l)}"></button>`).join('')}</div></div>
        <div class="bv-pop-row"><span class="bv-pop-l">Подсвечивать</span>
          <div class="bv-seg" role="group" aria-label="Что подсвечивать">${segB('word', 'Слово', 'Загорается слово, которое звучит; прочитанные слова строки чуть темнее')}${segB('line', 'Всю строку', 'Загорается вся строка, которая звучит')}${segB('off', 'Ничего', 'Без подсветки — только голос')}</div></div>
        ${view ? `<div class="bv-pop-row"><span class="bv-pop-l">Масштаб страницы</span>
          <div class="bv-zrow"><button type="button" class="bv-zb" data-pz="-" title="Мельче" aria-label="Мельче">−</button><span class="bv-zv" data-pzv>${Math.round(z * 100)}%</span><button type="button" class="bv-zb" data-pz="+" title="Крупнее" aria-label="Крупнее">+</button><button type="button" class="bv-zb bv-zfit" data-pz="fit" title="Страница по ширине окна">По ширине</button></div></div>` : ''}
        <div class="bv-pop-note">Запоминается для всех книг. Цвет — тот же, что в читалке.</div>`;
    };
    return openPop(anchor, html(), 'Вид страницы и подсветки', (el, place) => {
      el.addEventListener('click', e => {
        const h = e.target.closest('[data-hl]'), u = e.target.closest('[data-unit]'), z = e.target.closest('[data-pz]');
        if (h) { if (look()) look().set('hl', h.dataset.hl); else { paintStyle(); } document.dispatchEvent(new CustomEvent('bookview-pref', { detail: { k: 'hl' } })); }
        else if (u) {
          setPref('unit', u.dataset.unit);
          // «Ничего» here also turns the reader's running highlight off; a choice of word / line turns it on again
          if (look() && look().get('kar') === false !== (u.dataset.unit === 'off')) look().set('kar', u.dataset.unit !== 'off');
        } else if (z && view) { if (z.dataset.pz === 'fit') view.fit(); else view.step(z.dataset.pz === '+' ? 1 : -1); }
        else return;
        const f = document.activeElement && el.contains(document.activeElement) ? document.activeElement.getAttribute('data-hl') || document.activeElement.getAttribute('data-unit') || document.activeElement.getAttribute('data-pz') : null;
        el.innerHTML = html();
        if (f) { const b = el.querySelector(`[data-hl="${f}"], [data-unit="${f}"], [data-pz="${f}"]`); if (b) try { b.focus({ preventScroll: true }); } catch (err) { /* ignore */ } }
        place();
      });
    });
  }
  /** «🔊 Голос»: the 🎧 player's voices (place 'listen' — the one that reads books aloud) for the book's languages */
  function voicePop(anchor, langs) {
    langs = (langs && langs.length ? langs : ['no', 'ru']).filter((l, i, a) => a.indexOf(l) === i);
    const order = ['no', 'ru', 'uk'].filter(l => langs.includes(l));
    const btns = window.Voices && Voices.langButtons ? Voices.langButtons('listen', { langs: order, names: true }) : '';
    const html = `<div class="bv-pop-h">Голоса для чтения вслух</div>
      ${btns || '<div class="bv-pop-note">Выбор голосов сейчас недоступен — попробуйте позже.</div>'}
      <div class="bv-pop-note">Это голоса плеера «Слушать» — книги читает он. Если сменить голос во время чтения, книга продолжится с той же фразы новым голосом.</div>`;
    return openPop(anchor, html, 'Голоса для чтения вслух', el => {
      el.addEventListener('click', e => { if (e.target.closest('[data-voices-open]')) setTimeout(closePop, 0); });
    });
  }
  /** the languages of a book from its flags («🇷🇺🇳🇴» → ['no', 'ru']) */
  function langsOf(flags) {
    const s = String(flags || ''), out = [];
    if (/🇳🇴/u.test(s)) out.push('no');
    if (/🇷🇺/u.test(s)) out.push('ru');
    if (/🇺🇦/u.test(s)) out.push('uk');
    if (!out.includes('no')) out.unshift('no');
    return out;
  }

  window.BookView = { mount, lookPop, voicePop, closePop, langsOf, ocrText, prefs, _align: align, _norm: normW };
})();
