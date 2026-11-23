/* ============ Utilities ============ */
(function () {
  const DAY = 86400000;
  const scriptCache = {};

  const U = {
    DAY,
    uid() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    },
    esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    debounce(fn, ms) {
      let t;
      return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
    },
    sleep(ms) { return new Promise(r => setTimeout(r, ms)); },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    clamp(v, a, b) { return Math.min(b, Math.max(a, v)); },
    plural(n, forms) {
      const n10 = n % 10, n100 = n % 100;
      if (n10 === 1 && n100 !== 11) return forms[0];
      if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
      return forms[2];
    },
    cards(n) { return n + ' ' + U.plural(n, ['карта', 'карты', 'карт']); },
    dayKey(ts) {
      const d = new Date(ts == null ? Date.now() : ts);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },
    startOfDay(ts) { const d = new Date(ts == null ? Date.now() : ts); d.setHours(0, 0, 0, 0); return d.getTime(); },
    fmtDate(ts) {
      if (!ts) return '—';
      return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
    },
    fmtInterval(ms) {
      if (ms <= 0) return 'сейчас';
      const m = ms / 60000;
      if (m < 60) return Math.round(m) + ' мин';
      const h = m / 60;
      if (h < 24) return Math.round(h) + ' ч';
      const d = h / 24;
      if (d < 31) return Math.round(d) + ' дн';
      if (d < 365) return (d / 30).toFixed(1).replace('.0', '') + ' мес';
      return (d / 365).toFixed(1).replace('.0', '') + ' г';
    },
    fmtDuration(ms) {
      const s = Math.round(ms / 1000);
      const m = Math.floor(s / 60);
      return m ? `${m} мин ${s % 60} с` : `${s} с`;
    },

    /* ---------- text ---------- */
    cyrRatio(s) {
      s = String(s || '');
      const letters = s.match(/\p{L}/gu);
      if (!letters) return 0;
      const cyr = s.match(/[Ѐ-ӿ]/g);
      return (cyr ? cyr.length : 0) / letters.length;
    },
    latRatio(s) {
      s = String(s || '');
      const letters = s.match(/\p{L}/gu);
      if (!letters) return 0;
      const lat = s.match(/[A-Za-zÀ-ÿæøåÆØÅ]/g);
      return (lat ? lat.length : 0) / letters.length;
    },
    stripHtml(html) {
      if (html == null) return '';
      let s = String(html);
      if (!/[<&]/.test(s)) return s.replace(/\[sound:[^\]]*\]/g, '').trim();
      s = s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p|li|tr|h\d)>/gi, '\n');
      const doc = new DOMParser().parseFromString('<body>' + s + '</body>', 'text/html');
      return (doc.body.textContent || '').replace(/\[sound:[^\]]*\]/g, '').replace(/ /g, ' ')
        .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    },
    firstImgSrc(html) {
      const m = String(html || '').match(/<img[^>]+src\s*=\s*["']?([^"' >]+)/i);
      return m ? m[1] : null;
    },
    /** normalize for answer comparison */
    norm(s, opts = {}) {
      let t = String(s || '').toLowerCase().normalize('NFC').trim();
      t = t.replace(/ё/g, 'е');
      t = t.replace(/\([^)]*\)/g, ' ');
      t = t.replace(/[.,!?;:"'«»„“”()\[\]{}…\-–—_/\\]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (opts.stripArticles) t = t.replace(/^(en|ei|et|å)\s+/, '');
      if (opts.foldNordic) t = t.replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'aa');
      return t;
    },
    levenshtein(a, b) {
      if (a === b) return 0;
      const m = a.length, n = b.length;
      if (!m) return n; if (!n) return m;
      let prev = Array.from({ length: n + 1 }, (_, i) => i);
      for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) {
          cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
      }
      return prev[n];
    },
    /** char diff (LCS based) -> html highlighting typed vs expected */
    diffHtml(typed, expected) {
      const a = [...typed], b = [...expected];
      const m = a.length, n = b.length;
      const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
      for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--)
        dp[i][j] = a[i].toLowerCase() === b[j].toLowerCase() ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      let i = 0, j = 0, out = '';
      while (i < m && j < n) {
        if (a[i].toLowerCase() === b[j].toLowerCase()) { out += U.esc(b[j]); i++; j++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) { out += `<span class="diff-del">${U.esc(a[i])}</span>`; i++; }
        else { out += `<span class="diff-ins">${U.esc(b[j])}</span>`; j++; }
      }
      while (i < m) out += `<span class="diff-del">${U.esc(a[i++])}</span>`;
      while (j < n) out += `<span class="diff-ins">${U.esc(b[j++])}</span>`;
      return out;
    },
    /** split "a, b; c" into alternative answers */
    alternatives(s) {
      return String(s || '').split(/[,;/]|\s+\|\s+|\n/).map(x => x.trim()).filter(Boolean);
    },
    escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); },

    /* ---------- files ---------- */
    download(filename, data, mime) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    },
    safeFileName(s) { return String(s || 'deck').replace(/[\\/:*?"<>|]+/g, '_').trim().slice(0, 80) || 'deck'; },
    readArrayBuffer(file) {
      if (file.arrayBuffer) return file.arrayBuffer();
      return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsArrayBuffer(file); });
    },
    /** decode bytes to text, auto-detecting UTF-8 / UTF-16 / Windows-1251 / KOI8-R */
    decodeText(buf) {
      const bytes = new Uint8Array(buf);
      if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
      if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
      if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return new TextDecoder('utf-8').decode(bytes.subarray(3));
      // UTF-16 without BOM: many zero bytes
      let zeros = 0; const sample = Math.min(bytes.length, 4000);
      for (let i = 0; i < sample; i++) if (bytes[i] === 0) zeros++;
      if (sample && zeros / sample > 0.25) {
        const le = bytes[1] === 0;
        return new TextDecoder(le ? 'utf-16le' : 'utf-16be').decode(bytes);
      }
      try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch (e) {
        const cp = new TextDecoder('windows-1251').decode(bytes);
        try {
          const koi = new TextDecoder('koi8-r').decode(bytes);
          // choose decoding with more lowercase cyrillic (natural text is mostly lowercase)
          const lc = s => (s.match(/[а-яё]/g) || []).length;
          return lc(koi) > lc(cp) * 1.3 ? koi : cp;
        } catch (_) { return cp; }
      }
    },
    loadScript(src) {
      if (scriptCache[src]) return scriptCache[src];
      scriptCache[src] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src; s.async = true;
        s.onload = () => resolve();
        s.onerror = () => { delete scriptCache[src]; reject(new Error('Не удалось загрузить библиотеку: ' + src + ' (нужен интернет)')); };
        document.head.appendChild(s);
      });
      return scriptCache[src];
    },
    blobToDataURL(blob) {
      return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
    },
    dataURLToBytes(dataUrl) {
      const [head, b64] = dataUrl.split(',');
      const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { bytes, mime };
    },
    /** downscale/compress an image (Blob | dataURL | URL) -> JPEG/PNG dataURL */
    compressImage(src, max = 640, quality = 0.84) {
      return new Promise((resolve, reject) => {
        const url = src instanceof Blob ? URL.createObjectURL(src) : src;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
            const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
            const c = document.createElement('canvas'); c.width = w; c.height = h;
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            resolve(c.toDataURL('image/jpeg', quality));
          } catch (e) { reject(e); }
          finally { if (src instanceof Blob) URL.revokeObjectURL(url); }
        };
        img.onerror = () => { if (src instanceof Blob) URL.revokeObjectURL(url); reject(new Error('Изображение не загрузилось')); };
        img.src = url;
      });
    },
    mimeFromName(name) {
      const ext = String(name).split('.').pop().toLowerCase();
      return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', avif: 'image/avif' })[ext] || '';
    },
    async sha1Hex(text) {
      const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    },
    $(sel, root) { return (root || document).querySelector(sel); },
    $$(sel, root) { return [...(root || document).querySelectorAll(sel)]; },
  };

  // CDN libraries (loaded lazily, only when needed)
  U.LIBS = {
    jszip: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
    sqljs: 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/sql-wasm.js',
    sqljsDir: 'https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/',
    xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    fzstd: 'https://cdn.jsdelivr.net/npm/fzstd@0.1.1/umd/index.js',
    pdf: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    pdfWorker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
    yaml: 'https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js',
    tesseract: 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js',
  };
  U.lib = {
    async yaml() { await U.loadScript(U.LIBS.yaml); return window.jsyaml; },
    /** OCR (text on pictures): Tesseract.js, Norwegian + Russian + Ukrainian + English, one shared worker */
    _ocr: null,
    async ocr() {
      if (this._ocr) return this._ocr;
      await U.loadScript(U.LIBS.tesseract);
      this._ocr = window.Tesseract.createWorker(['nor', 'rus', 'ukr', 'eng']);
      return this._ocr;
    },
    async jszip() { await U.loadScript(U.LIBS.jszip); return window.JSZip; },
    async xlsx() { await U.loadScript(U.LIBS.xlsx); return window.XLSX; },
    async fzstd() { await U.loadScript(U.LIBS.fzstd); return window.fzstd; },
    _sql: null,
    async sql() {
      if (this._sql) return this._sql;
      await U.loadScript(U.LIBS.sqljs);
      this._sql = await window.initSqlJs({ locateFile: f => U.LIBS.sqljsDir + f });
      return this._sql;
    },
    async pdf() {
      await U.loadScript(U.LIBS.pdf);
      // load the worker code into the main thread (works even from file://)
      await U.loadScript(U.LIBS.pdfWorker);
      const lib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
      lib.GlobalWorkerOptions.workerSrc = U.LIBS.pdfWorker;
      return lib;
    },
  };

  /* ---------- 🙂 calm words instead of technical errors ----------
   * «Failed to fetch», «NetworkError…», «The operation was aborted», «HTTP 503», «Unexpected token <»… never reach the
   * person: U.niceErr(e, 'Перевод') → «Перевод: нет интернета — попробуйте, когда связь появится».
   * U.calm(text) cleans a ready message (UI.toast runs every message through it). The technical detail stays in the console. */
  const CYR = /[а-яё]/i;
  const T = {
    off: 'Нет интернета — попробуйте, когда связь появится',
    down: 'Сервис сейчас не отвечает — попробуйте позже',
    slow: 'Сервис слишком долго не отвечает — попробуйте позже',
    key: 'Ключ не подошёл — проверьте его в Настройках',
    limit: 'Лимит запросов исчерпан — попробуйте чуть позже',
    odd: 'Сервис ответил что-то непонятное — попробуйте позже',
    missing: 'Не нашлось — попробуйте позже',
    space: 'На устройстве не хватает места',
    sound: 'Браузер не дал включить звук — нажмите ещё раз',
    denied: 'Нет разрешения — разрешите доступ в настройках браузера',
    oops: 'Что-то пошло не так — попробуйте ещё раз',
  };
  const offline = () => { try { return navigator.onLine === false; } catch (e) { return false; } };
  const RX = {
    net: /failed to fetch|networkerror|network ?error|load failed|network request failed|net::err_|err_internet|err_name_not_resolved|err_connection|econnrefused|enotfound|econnreset|could not connect|connection (?:refused|reset|closed)|fetch failed/i,
    slow: /\babort(?:ed|error)?\b|signal is aborted|timed? ?out|timeouterror/i,
    space: /quotaexceedederror|exceeded the quota|not enough space|disk full/i,
    limit: /\b(?:429|456)\b|rate.?limit|too many requests|exceeded your current quota|quota exceeded|resource.?exhausted|insufficient.?quota/i,
    key: /\b40[13]\b|unauthori[sz]ed|forbidden|invalid.{0,24}(?:api.?key|token|key)|incorrect api key|api key not valid|authentication/i,
    down: /\b5\d\d\b|bad gateway|service unavailable|internal server error|gateway time-?out|overloaded/i,
    missing: /\b404\b|not found/i,
    odd: /unexpected token|unexpected end of (?:json|input)|not valid json|syntaxerror|json\.parse/i,
    sound: /play\(\) (?:failed|request)|user didn'?t interact|notallowederror.*play/i,
    denied: /notallowederror|permission denied|not allowed by the user agent|securityerror/i,
  };
  /** a technical text (English, no Russian) → one calm Russian sentence */
  function classify(msg, name) {
    const s = `${name || ''} ${msg || ''}`;
    if (RX.space.test(s)) return T.space;
    if (RX.net.test(s) || (name === 'TypeError' && /fetch/i.test(s))) return offline() ? T.off : T.down;
    if (RX.slow.test(s)) return offline() ? T.off : T.slow;
    if (offline()) return T.off;
    if (RX.limit.test(s)) return T.limit;
    if (RX.key.test(s)) return T.key;
    if (RX.down.test(s)) return T.down;
    if (RX.odd.test(s)) return T.odd;
    if (RX.sound.test(s)) return T.sound;
    if (RX.denied.test(s)) return T.denied;
    if (RX.missing.test(s)) return T.missing;
    return T.oops;
  }
  const lower1 = s => s.charAt(0).toLowerCase() + s.slice(1);
  // technical fragments inside an otherwise Russian message («Не удалось собрать аудио (Failed to fetch)»)
  const FRAG = /(?:\b(?:TypeError|DOMException|AbortError|NetworkError|TimeoutError|SyntaxError|Error)\s*:\s*)?(?:Failed to fetch|NetworkError when attempting to fetch resource\.?|Network ?Error|Load failed|Network request failed|fetch failed|The (?:operation|user) (?:was )?aborted(?: a request)?\.?|signal is aborted without reason|This operation was aborted|The operation timed out\.?|net::ERR_[A-Z_]+|Unexpected token[^,;)»]*|Unexpected end of JSON input|[^,;()«»]*is not valid JSON|Cannot read propert(?:y|ies) of (?:undefined|null)[^,;)»]*|undefined is not an object[^,;)»]*|[\w.$]+ is not (?:a function|defined)|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Time-?out|Too Many Requests|Unauthorized|Forbidden|(?:HTTP|status(?: code)?|ошибка)\s*\d{3}\b)/gi;
  const FRAG1 = new RegExp(FRAG.source, 'i'); // the same, for .test() (no lastIndex)
  const TECH_ONLY = /\b(?:error|errors|failed|failure|invalid|cannot|can't|unable|unexpected|denied|refused|exception|undefined|null|not found|not allowed|not supported|does not exist|timeout|timed out|aborted|fetch|status \d{3}|HTTP \d{3})\b/i;
  /** a ready message (toast, status line) without technical words; a clean message comes back unchanged */
  U.calm = function (text) {
    const s = String(text == null ? '' : text);
    if (!s) return s;
    if (!CYR.test(s)) {
      if (!TECH_ONLY.test(s) && !FRAG1.test(s)) return s;
      const who = /^([A-Z][\w .+-]{1,24}):\s+(?=\S)/.exec(s); // «Gemini: HTTP 503» → «Gemini: сервис сейчас не отвечает…»
      return who && !/error|exception/i.test(who[1]) ? `${who[1]}: ${lower1(classify(s.slice(who[0].length)))}` : classify(s);
    }
    // no internet at all: «Нет связи с сервисом (… мост bridge/server.py …)» says just that, calmly
    if (offline() && /^(?:[^:]{1,40}:\s*)?нет связи/i.test(s)) return T.off;
    if (!FRAG1.test(s)) return s;
    return s.replace(FRAG, m => lower1(classify(m)).replace(/ — .*$/, ''));
  };
  /**
   * any error → a calm Russian sentence for the person (the technical one: console only).
   * U.niceErr(e) · U.niceErr(e, 'Перевод') → «Перевод: нет интернета — попробуйте, когда связь появится»
   * U.niceErr(e, '', true) → «нет интернета» (short, for «Перевод не пришёл (…)»).
   * Our own Russian messages (thrown by the app on purpose) stay as they are.
   */
  U.niceErr = function (e, ctx, short) {
    const name = (e && e.name) || '';
    const msg = typeof e === 'string' ? e : String((e && (e.message || e.error || e.reason)) || '');
    let t;
    if (name === 'AbortError' || name === 'TimeoutError') t = offline() ? T.off : T.slow;
    else if (name === 'QuotaExceededError') t = T.space;
    else if (!msg.trim()) t = offline() ? T.off : T.oops;
    else if (!CYR.test(msg)) t = classify(msg, name);
    else t = U.calm(msg);
    if (e && typeof e === 'object' && t !== msg) { try { console.warn('[niceErr]', ctx || '', e); } catch (_) { /* ignore */ } }
    const ours = !Object.values(T).includes(t); // the app's own Russian words: kept as they are
    if (short && !ours) t = lower1(t.replace(/ — .*$/, '')); // «нет интернета» — inside a sentence of the caller
    return ctx ? `${ctx}: ${ours ? t : lower1(t)}` : t;
  };
  U.NICE = T;

  window.U = U;
})();

/* ============ 📄 PageText: what a book page has that is NOT the book's text ============
 * ONE cleaner for every book and file that is read aloud or shown paragraph by paragraph (📖 Книги «Читать вслух»,
 * 📖 Читалка, 📘 Мой учебник, Telegram «Книги и аудио», 🎧 Listen.startText): the voice must not read page numbers
 * («6», «- 6 -», «6/13», «Side 6 av 40», «стр. 6», «[6]», «vii»), running headers / footers (a short line repeated at the
 * top or bottom of ≥3 pages: «Kapittel 3 · 45» = «Kapittel 3 · 46» — digits do not count), separators («. . .», «***»,
 * «———», a lone bullet), soft hyphens, words cut at a line end («beskri-» + «velse») and footnote marks glued to a
 * word («ord¹»; «ord12» only in a PDF page that has the footnote «12 …»). Conservative: numbers inside sentences
 * («Jeg er 12 år gammel.», «I 1814 fikk Norge grunnloven.») always stay; a bare number is dropped only at the edge of
 * a page (or when bare numbers run 1, 2, 3… through a text — page numbers of a TXT without page breaks).
 * Public: window.PageText = { cleanPages, cleanText, cleanPieces, pdfLines, joinSentences, isJunk, stripDom, repeatKeys, filterHeaders }.
 */
(function () {
  const INVIS = /[­​‌‍⁠﻿]/g; // soft hyphen, zero-width characters
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const PFX = '(?:side|sida|seite|page|pg|страница|сторінка|стр|стор|s\\.|p\\.|с\\.)';
  const RE = {
    bare: /^\d{1,4}$/,
    deco: /^[-–—‒―~•·*=_]+\s*\d{1,4}\s*[-–—‒―~•·*=_]+$/,                                 // «- 6 -», «— 6 —», «-6-»
    bracket: new RegExp(`^[\\[(]\\s*(?:${PFX}\\.?\\s*)?\\d{1,4}\\s*[\\])]$`, 'i'),        // «[6]», «(6)», «[Pg 6]», «[s. 6]»
    of: new RegExp(`^(?:${PFX}\\.?\\s*)?(\\d{1,4})\\s*(?:\\/|av|of|из|з|von|de|sur)\\s*(\\d{1,4})\\.?$`, 'i'), // «6/13», «Side 6 av 40», «Page 6 of 13»
    word: new RegExp(`^${PFX}\\.?\\s*\\d{1,4}\\.?$`, 'i'),                                // «Side 6», «s. 6», «стр. 6», «Страница 6»
    roman: /^(?:x{0,2}(?:ix|iv|v?i{0,3})|xxx)$/i,
  };
  const SENT_END = /[.!?…:;»"”’)\]]$/;
  const letters = s => (String(s).match(/\p{L}/gu) || []).length;
  const script = s => { const c = (String(s).match(/[Ѐ-ӿ]/g) || []).length, l = (String(s).match(/[A-Za-zÀ-ÖØ-öø-ɏ]/g) || []).length; return !c && !l ? '' : c >= l ? 'cyr' : 'lat'; };

  /** a line that is only a page number. edge: it stands at the top / bottom of a page (a bare «6» or «vii» counts only there) */
  function isPageNum(t, edge) {
    t = String(t || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 24) return false;
    if (RE.deco.test(t) || RE.bracket.test(t) || RE.word.test(t)) return true;
    const m = RE.of.exec(t);
    if (m && +m[1] >= 1 && +m[1] <= +m[2]) return true;
    if (!edge) return false;
    if (RE.bare.test(t)) return true;
    // roman page numbers of the front matter (i–xxx): lowercase, or uppercase of 2+ letters; «i» / «vi» are Norwegian words
    if (RE.roman.test(t) && (t === t.toLowerCase() ? !/^(i|vi)$/.test(t) : t === t.toUpperCase() && t.length >= 2)) return true;
    return false;
  }
  /** a line with nothing to read: «. . .», «***», «———», «•», «* * *», «~» (emoji-only lines are left to the voice rules) */
  function isSeparator(t) {
    t = String(t || '').trim();
    return !!t && !/[\p{L}\p{N}]/u.test(t) && /^[\p{P}\p{S}\s]+$/u.test(t) && !/\p{Extended_Pictographic}/u.test(t);
  }
  /** junk line: a separator or a page number (edge: a bare number counts too) */
  const isJunk = (t, edge) => isSeparator(t) || isPageNum(t, edge);

  /** one line: no soft hyphens, footnote superscripts off words («ord¹» → «ord»; «m²» stays) */
  function tidy(s) {
    return String(s == null ? '' : s).replace(INVIS, '').replace(/[\t   ]/g, ' ')
      .replace(new RegExp(`(\\p{L}{3,}[.,;:!?»"”’)]?)[${SUP}]+(?=[\\s.,;:!?»"”’)]|$)`, 'gu'), '$1')
      .replace(/ {2,}/g, ' ').trim();
  }
  /** «RU-строка . . . NB-строка» in one line → two lines (spaced dots / «* * *» / «***» inside a line = a separator) */
  const splitSeps = s => String(s).split(/\s+(?:\.\s+){2,}\.(?=\s|$)|(?:^|\s+)(?:\*\s*){3,}(?=\s|$)|\s+[•·]\s+(?=[•·]\s)/).map(x => x.trim()).filter(Boolean);

  /** the key of a line for «the same header on every page»: digits (and roman numbers) do not count */
  const norm = s => String(s || '').toLowerCase().replace(/\d+/g, '#').replace(/\b[ivxlc]{1,6}\b/g, '#').replace(/[^\p{L}#]+/gu, ' ').replace(/\s+/g, ' ').trim();
  /** a header / footer candidate: short, not a sentence (a refrain «Hvor er katten?» on three pages is the book's text) */
  function headerLike(s) {
    s = String(s || '').trim();
    if (!s || s.length > 80 || isSeparator(s)) return false;
    if (/©|\(c\)|https?:|www\.|\.(?:no|com|org|net|se)\b|isbn|cc[ -]by/i.test(s)) return true;
    const body = s.replace(/^\d{1,4}\s+|\s+\d{1,4}$/g, ''); // «Hun bodde i et hus. 6» is a sentence with a page number
    return !(/[.!?…»"”]$/.test(body) && body.split(/\s+/).length >= 2);
  }
  /** which lines are candidates at the top / bottom of a page: band tags (PDF positions) or the first / last 3 lines */
  function edgeIdx(lines) {
    const out = new Set();
    // the PDF told where the lines are: only the top / bottom margins
    if (lines.some(l => 'band' in l)) { lines.forEach((l, i) => { if (l.band && l.s) out.add(i); }); return out; }
    const full = lines.map((l, i) => (l.s ? i : -1)).filter(i => i >= 0);
    full.slice(0, 2).concat(full.slice(-2)).forEach(i => out.add(i));
    return out;
  }
  /** running headers / footers: keys of short lines that stand at the edge of ≥ min pages */
  function repeatKeys(pages, min = 3) {
    const cnt = new Map();
    pages.forEach(p => {
      const ls = toObjs(p), seen = new Set();
      edgeIdx(ls).forEach(i => { const s = ls[i].s; if (!headerLike(s)) return; const k = norm(s); if (k && /\p{L}/u.test(k) && !seen.has(k)) { seen.add(k); cnt.set(k, (cnt.get(k) || 0) + 1); } });
    });
    return new Set([...cnt].filter(([, n]) => n >= min).map(([k]) => k));
  }
  const toObjs = p => (Array.isArray(p) ? p : (p && p.lines) || String(p || '').split('\n')).map(l => (typeof l === 'string' ? { s: l } : Object.assign({}, l, { s: String(l.s == null ? '' : l.s) })));

  /** words cut at the line end: «beskri-» + «velse» → «beskrivelse» (not «barne-» + «og ungdom», not «кто-» + «то») */
  function hyphenJoin(a, b) {
    if (!/[\p{L}]{2}-$/u.test(a) || /[-–—]{2}$/.test(a) || !/^\p{Ll}/u.test(b)) return null;
    const w = (/^(\p{L}+)/u.exec(b) || [])[1] || '';
    if (/^(og|eller|und|and|or|samt|enn|и|или|та|і|й|або|чи)$/i.test(w)) return null;
    if (/^(то|нибудь|либо|таки|ка|де|бо|от)$/i.test(w) || /(?:^|\s)(по|из|кое|во|в|з|с)-$/i.test(a)) return a + b; // кто-то, по-русски
    return a.slice(0, -1) + b;
  }
  /** a line that cannot end a sentence: it ends with a preposition / conjunction / article («…ручку для», «…og», «…til») */
  const OPEN_END = /(?:^|[\s(«"„])(?:в|во|на|с|со|к|ко|о|об|обо|у|для|из|от|до|по|за|под|над|при|про|без|через|между|и|а|но|или|что|чтобы|как|не|ни|же|бы|ли|у|з|із|та|й|або|чи|що|щоб|i|på|til|fra|med|og|men|eller|en|et|ei|av|for|om|ved|hos|mot|som|at|å|den|det|de|sin|sitt|sine|min|mitt|mine|the|a|an|of|to|and|in|on|at|with)$/iu;
  /** the next line goes on the sentence: a small letter, a number, a quote / bracket before a small letter */
  const GOES_ON = /^(?:\p{Ll}|\d|[«"„“(]\p{Ll})/u;
  /** PDF lines of one sentence → one line, so the voice reads on without a pause. Only the same script, and: a small
   *  letter after; or the line before ends with a word that cannot end a sentence («…ручку для» + «Тяпки.»); or the line
   *  before fills the column (a wrapped line, ≥ 70 % of the page's longest) — «…Hvem hjalp bestemor? Barnebarnet» +
   *  «Tom hjalp henne…»; a short line without a full stop before a capital is a heading and stays apart («Spør og svar»). */
  function joinLines(ls, sentences = true) {
    const out = [];
    const long = ls.reduce((m, l) => Math.max(m, String(l.s || '').length), 0);
    ls.forEach(l => {
      const prev = out[out.length - 1];
      if (prev && prev.s && l.s) {
        const h = hyphenJoin(prev.s, l.s);
        if (h != null) { prev.s = h; return; }
        const wrapped = long >= 25 && (prev.w || prev.s.length) >= long * 0.7 && /^\p{Lu}/u.test(l.s);
        // «…и сказала:» + «спасибо, Том!» — a colon / semicolon before a small letter goes on too
        const soft = /[:;]$/.test(prev.s) && /^\p{Ll}/u.test(l.s);
        if (sentences && (!SENT_END.test(prev.s) || soft) && (GOES_ON.test(l.s) || OPEN_END.test(prev.s) || wrapped) && script(prev.s.slice(-40)) === script(l.s.slice(0, 40)) && script(l.s)) {
          if (prev.w == null) prev.w = prev.s.length; // the length of its LAST line decides about the next one
          prev.s += ' ' + l.s; prev.w = l.s.length; return;
        }
      }
      out.push(Object.assign({}, l));
    });
    out.forEach(l => { delete l.w; });
    return out;
  }
  /** 🎧 a text's lines → lines of whole sentences for the voice: a line break inside a sentence (a PDF line, a narrow
   *  column, a post written in short lines) is not a pause. Empty lines (paragraphs) stay; words cut at a line end are glued. */
  function joinSentences(text) {
    return joinLines(String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n').map(s => ({ s: s.replace(/[ \t]+/g, ' ').trim() }))).map(l => l.s).join('\n');
  }

  /**
   * pages → the same pages without page numbers, running headers / footers, separators.
   * pages: [[line…]] — a line is a string or { s, band: 'top'|'bottom'|'' } (band = from the PDF position, the best clue);
   * o.join: also glue lines of one sentence (for the voice), o.hyph / o.join: words cut at line ends («beskri-» + «velse»); o.nums: the page number of each
   * page (for numbers glued to the first / last line: «… slutt. 6» — dropped only when they follow the page numbering);
   * o.pdf: footnote marks «ord12» are dropped where the page has the footnote «12 …».
   * Returns the pages in the same form (strings → strings, objects → objects).
   */
  function cleanPages(pages, o = {}) {
    const asStr = pages.map(p => { const a = Array.isArray(p) ? p : (p && p.lines) || [p]; return !a.length || typeof a[0] === 'string'; });
    let P = pages.map(p => {
      const out = [];
      toObjs(p).forEach(l => { const t = tidy(l.s); if (!t) { if (l.s === '' || !l.s.trim()) out.push(Object.assign(l, { s: '' })); return; } splitSeps(t).forEach(x => out.push(Object.assign({}, l, { s: x }))); });
      return out;
    });
    const keys = o.keys || (P.length >= 3 ? repeatKeys(P, o.min || 3) : new Set());
    P = P.map(ls => {
      // 1) separators and unmistakable page numbers anywhere; running headers / footers at the edges
      const edge = edgeIdx(ls);
      ls = ls.filter((l, i) => !(l.s && (isSeparator(l.s) || isPageNum(l.s, false) || (l.band && isPageNum(l.s, true)) || (keys.size && edge.has(i) && headerLike(l.s) && keys.has(norm(l.s))))));
      // 2) a bare number at the top / bottom of the page (also behind a removed header)
      for (let guard = 0; guard < 4; guard++) {
        const full = ls.map((l, i) => (l.s ? i : -1)).filter(i => i >= 0);
        if (!full.length) break;
        const f = full[0], z = full[full.length - 1];
        if (isPageNum(ls[z].s, true)) ls.splice(z, 1);
        else if (isPageNum(ls[f].s, true)) ls.splice(f, 1);
        else break;
      }
      return ls;
    });
    // 3) a page number glued to the first / last line («… slutt. 6», «6 Det var en gang»): only when such numbers follow
    //    the page numbering (page − number is the same on ≥3 pages)
    if (o.nums && P.length >= 3) {
      const cand = P.map((ls, k) => {
        const full = ls.filter(l => l.s);
        if (!full.length || !o.nums[k]) return null;
        const a = /^(\d{1,4})\s+(?=\p{Lu})/u.exec(full[0].s), z = /[.!?…»"”)]\s+(\d{1,4})$/.exec(full[full.length - 1].s);
        return { a: a && +a[1], z: z && +z[1], n: o.nums[k] };
      });
      const off = new Map();
      cand.forEach(c => { if (!c) return; new Set([c.a, c.z].filter(v => v != null).map(v => c.n - v)).forEach(d => off.set(d, (off.get(d) || 0) + 1)); });
      const best = [...off].sort((x, y) => y[1] - x[1])[0];
      if (best && best[1] >= 3) {
        P.forEach((ls, k) => {
          const c = cand[k]; if (!c) return;
          const full = ls.filter(l => l.s);
          if (c.z != null && c.n - c.z === best[0]) full[full.length - 1].s = full[full.length - 1].s.replace(/\s+\d{1,4}$/, '');
          if (c.a != null && c.n - c.a === best[0]) full[0].s = full[0].s.replace(/^\d{1,4}\s+/, '');
        });
      }
    }
    // 4) footnote marks glued to words, only where this page has the footnote itself («12 Se kapittel 3.»)
    if (o.pdf) P = P.map(ls => {
      const full = ls.filter(l => l.s);
      const notes = new Set(full.slice(Math.floor(full.length / 2)).map(l => (/^(\d{1,2})\s+\S/.exec(l.s) || [])[1]).filter(Boolean));
      if (!notes.size) return ls;
      return ls.map(l => (/^\d{1,2}\s/.test(l.s) ? l : Object.assign(l, { s: l.s.replace(/(\p{Ll}{3,})(\d{1,2})(?=[\s.,;:!?»"”)]|$)/gu, (m, w, d) => (notes.has(d) ? w : m)) })));
    });
    if (o.join || o.hyph) P = P.map(ls => joinLines(ls, !!o.join));
    return P.map((ls, k) => (asStr[k] ? ls.map(l => l.s) : ls));
  }

  /** bare number lines that run 1, 2, 3… through a text (page numbers of a TXT / Word file without page breaks) */
  function numberRun(lines) {
    const at = [];
    let chars = 0;
    lines.forEach((l, i) => { const t = String(l).trim(); if (RE.bare.test(t)) at.push({ i, v: +t, c: chars }); chars += t.length + 1; });
    if (at.length < 3) return new Set();
    const steps = at.slice(1).filter((x, k) => x.v === at[k].v + 1).length;
    const gap = (at[at.length - 1].c - at[0].c) / Math.max(1, at.length - 1);
    if (steps < (at.length - 1) * 0.6 || gap > 6000) return new Set();
    return new Set(at.filter((x, k) => (at[k - 1] && at[k - 1].v === x.v - 1) || (at[k + 1] && at[k + 1].v === x.v + 1)).map(x => x.i));
  }

  /**
   * a whole text (TXT, MD, Word, EPUB/HTML text): «\f» page breaks are pages; without them only unmistakable page
   * numbers, a 1-2-3 run of bare numbers, separators and words cut at line ends. Blank lines (paragraphs) stay.
   * o.join: also join lines of one sentence (for the voice).
   */
  function cleanText(text, o = {}) {
    text = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
    if (/\f/.test(text)) {
      const pages = cleanPages(text.split('\f').map(p => p.split('\n')), { join: o.join, hyph: true });
      return pages.map(ls => ls.join('\n').replace(/^\n+|\n+$/g, '')).filter(Boolean).reduce((a, p) => {
        if (!a) return p;
        // a word cut at the end of a page goes on on the next one
        const h = hyphenJoin(a.slice(a.lastIndexOf('\n') + 1), p.split('\n')[0]);
        if (h != null) return a.slice(0, a.lastIndexOf('\n') + 1) + h + p.slice(p.split('\n')[0].length);
        return a + (SENT_END.test(a.trim()) ? '\n\n' : '\n') + p;
      }, '');
    }
    let ls = text.split('\n');
    const run = numberRun(ls);
    ls = ls.map((l, i) => (run.has(i) ? null : l)).filter(l => l != null).map(l => {
      const t = tidy(l);
      if (!t) return [''];
      return splitSeps(t).filter(x => !isJunk(x, false));
    }).reduce((a, x) => a.concat(x.length ? x : []), []);
    // words cut at a line end
    const out = [];
    ls.forEach(l => { const p = out.length - 1; const h = p >= 0 && l ? hyphenJoin(out[p], l) : null; if (h != null) out[p] = h; else out.push(l); });
    let res = out;
    if (o.join) res = joinLines(out.map(s => ({ s }))).map(l => l.s);
    return res.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  /**
   * 🎧 pieces [{ title, text, page }] for Listen.startText. o.book (pages of a book / PDF): page numbers at the edges,
   * running headers / footers over the pages, sentences joined across PDF line breaks; otherwise (posts, news, a
   * block of the app) only separators and unmistakable page numbers.
   */
  function cleanPieces(pieces, o = {}) {
    const list = (pieces || []).filter(x => x && String(x.text || '').trim());
    if (!o.book) return list.map(x => Object.assign({}, x, { text: cleanText(x.text) })).filter(x => /[\p{L}\p{N}]/u.test(x.text));
    const nums = list.map(x => +x.page || +((/стр\.\s*(\d+)\s*$/.exec(x.title || '') || [])[1]) || 0);
    const pages = cleanPages(list.map(x => String(x.text).replace(/\r\n?/g, '\n').split(/\n|\f/)), { join: true, nums: nums.every(Boolean) ? nums : null, pdf: true });
    return list.map((x, k) => Object.assign({}, x, { text: pages[k].filter(Boolean).join('\n') })).filter(x => /[\p{L}\p{N}]/u.test(x.text));
  }

  /**
   * pdf.js text items of one page → lines { s, y, h, band }. view: page.view ([x0, y0, x1, y1]) — lines in the top /
   * bottom 9 % of the page are tagged (that is where page numbers and running headers live).
   */
  function pdfLines(items, view) {
    const y0 = view ? +view[1] || 0 : 0, y1 = view ? +view[3] || 0 : 0, H = y1 - y0;
    const lines = [];
    let cur = null;
    (items || []).forEach(it => {
      if (!it || typeof it.str !== 'string') return;
      const tr = it.transform || [1, 0, 0, 1, 0, 0];
      const x = tr[4], y = tr[5], h = Math.abs(tr[3]) || Math.abs(tr[0]) || 10;
      if (!it.str.trim()) { if (cur && it.hasEOL) { lines.push(cur); cur = null; } else if (cur && !/\s$/.test(cur.s)) cur.s += ' '; return; }
      if (!cur || Math.abs(y - cur.y) > Math.max(h, cur.h) * 0.5) { if (cur) lines.push(cur); cur = { y, h, s: '', xe: x }; }
      else if (cur.s && !/\s$/.test(cur.s) && !/^\s/.test(it.str) && x - cur.xe > h * 0.15) cur.s += ' ';
      cur.s += it.str; cur.xe = x + (it.width || 0); cur.h = Math.max(cur.h, h);
      if (it.hasEOL) { lines.push(cur); cur = null; }
    });
    if (cur) lines.push(cur);
    return lines.map(l => ({ s: l.s.replace(/\s+/g, ' ').trim(), y: l.y, h: l.h, band: H > 50 ? (l.y > y1 - H * 0.09 ? 'top' : l.y < y0 + H * 0.09 ? 'bottom' : '') : '' })).filter(l => l.s);
  }

  /** EPUB / HTML: page-break markers out of the text (<span epub:type="pagebreak">, role="doc-pagebreak", .pagenum…) */
  function stripDom(root) {
    if (!root || !root.getElementsByTagName) return root;
    const kill = [];
    for (const el of root.getElementsByTagName('*')) {
      const txt = String(el.textContent || '').trim();
      if (txt.length > 20) continue; // a page marker is empty or «6» / «[Pg 6]» — never a paragraph
      const ty = [...(el.attributes || [])].filter(a => /(^|:)type$/.test(a.name) && a.name !== 'type').map(a => a.value).join(' ');
      const cls = String(el.getAttribute('class') || '');
      if (/\bpagebreak\b/.test(ty) || /doc-pagebreak/.test(el.getAttribute('role') || '') || /(^|\s)(pagenum|page-?num(ber)?|pageno|page-?break|folio)(\s|$)/i.test(cls)
        || (/^(span|a)$/i.test(el.localName || el.tagName) && /^(page|pg|p)[_-]?\d+$/i.test(el.getAttribute('id') || '') && isPageNum(txt, true))) kill.push(el);
    }
    kill.forEach(el => { if (el.parentNode) el.parentNode.removeChild(el); });
    return root;
  }
  /** lines of a page without the running headers / footers found over a book's pages (keys from repeatKeys) */
  function filterHeaders(lines, keys) {
    if (!keys || !keys.size) return lines;
    const ls = toObjs(lines), edge = edgeIdx(ls);
    return lines.filter((l, i) => !(edge.has(i) && headerLike(ls[i].s) && keys.has(norm(ls[i].s))));
  }

  window.PageText = { cleanPages, cleanText, cleanPieces, pdfLines, joinSentences, isJunk, isPageNum, isSeparator, stripDom, repeatKeys, filterHeaders, norm, tidy };
})();
