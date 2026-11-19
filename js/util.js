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

  window.U = U;
})();
