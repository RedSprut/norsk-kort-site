/* ============ 🔖 RdSync: bookmarks, highlights, notes and the reading place of every book — on all your devices ============
 * The reader (js/reader.js) keeps, per book, one small record in localStorage «nk-reader-marks» (works with no account):
 *   { v: 1, t: title, a: author, n: chars, ext, at,
 *     pos: { b, o, pg, pct, at }          — a STABLE locator: block index + character offset (not a pixel), its time
 *     m: { <id>: mark },                  — mark = { id, k: 'bm' | 'hl', b, s, b2, e, c: colour, note, text, pg, at, del? }
 *     f: { h, size, mime, name } }        — the book file (content hash) for the other devices
 * The book key is the SHA-256 of the file (so the same book has the same record on every device), or a hash of
 * title + length for books added before files were kept.
 * Sync (js/cloudsync.js, kind «ls», ids «rd:<key>» + «rd:_set» for the reader's settings): MERGE —
 *   marks: a union by id; the same mark changed on both devices → the newer one; a deletion travels as a tombstone
 *   (the newer one wins against an edit); the place in the book: the latest time wins; settings: per key, the latest.
 * Book files: in the background to the private bucket (nk-media, «<user id>/book-<hash>»), a quiet status, never blocking
 *   reading; another device gets the file in the background and the book appears on its shelf.
 * Public: window.RdSync (see the bottom). merge() is pure — tested in node.
 */
(function (root) {
  'use strict';
  const KEY = 'nk-reader-marks', UP_KEY = 'nk-reader-up', GONE_KEY = 'nk-reader-gone';
  const PREFIX = 'rd:', SET_ID = 'rd:_set';
  const TOMB_DAYS = 400;
  const MAX_FILE = 25 * 1024 * 1024;
  const SYNC_SET = ['mode', 'size', 'lh', 'width', 'font', 'hl', 'hls', 'kar', 'hideTr', 'read', 'speed', 'pause', 'repeat'];
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const num = v => (Number.isFinite(+v) ? +v : 0);
  const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const str = (v, n) => String(v == null ? '' : v).slice(0, n);

  /* ---------- a mark from anywhere (another device, an old version) → a clean one ---------- */
  const COLORS = ['yellow', 'green', 'blue', 'pink', 'violet'];
  function cleanMark(id, m) {
    if (!isObj(m) || !/^[\w-]{1,40}$/.test(String(id))) return null;
    const at = Math.max(0, num(m.at));
    if (m.del) return { id: String(id), del: 1, at };
    const k = m.k === 'bm' ? 'bm' : m.k === 'hl' ? 'hl' : '';
    if (!k) return null;
    const o = { id: String(id), k, b: Math.max(0, Math.floor(num(m.b))), s: Math.max(0, Math.floor(num(m.s))), at };
    if (k === 'hl') {
      o.b2 = Math.max(o.b, Math.floor(num(m.b2 != null ? m.b2 : m.b)));
      o.e = Math.max(0, Math.floor(num(m.e)));
      if (o.b2 === o.b && o.e <= o.s) o.e = o.s + 1;
      o.c = COLORS.includes(m.c) ? m.c : 'yellow';
    }
    if (m.note) o.note = str(m.note, 4000);
    if (m.text) o.text = str(m.text, 1200);
    if (m.pg) o.pg = Math.max(1, Math.floor(num(m.pg)));
    return o;
  }
  function cleanPos(p) {
    if (!isObj(p)) return null;
    return { b: Math.max(0, Math.floor(num(p.b))), o: Math.max(0, Math.floor(num(p.o))), pg: Math.max(1, Math.floor(num(p.pg) || 1)), pct: Math.min(1, Math.max(0, num(p.pct))), at: Math.max(0, num(p.at)) };
  }
  function cleanRec(r) {
    if (!isObj(r)) return null;
    const o = { v: 1, t: str(r.t, 300), a: str(r.a, 200), n: Math.max(0, Math.floor(num(r.n))), ext: str(r.ext, 10).toLowerCase().replace(/[^a-z0-9]/g, ''), at: Math.max(0, num(r.at)), m: {} };
    const p = cleanPos(r.pos); if (p) o.pos = p;
    if (isObj(r.m)) Object.keys(r.m).slice(0, 5000).forEach(id => { const m = cleanMark(id, r.m[id]); if (m) o.m[m.id] = m; });
    if (isObj(r.f) && /^[0-9a-f]{16,64}$/.test(String(r.f.h || ''))) o.f = { h: String(r.f.h), size: Math.max(0, Math.floor(num(r.f.size))), mime: str(r.f.mime, 80), name: str(r.f.name, 200) };
    return o;
  }

  /* ---------- MERGE (pure): two records of the same book → one ---------- */
  function newer(x, y) { // y wins a tie only when it is a deletion (a deletion is never undone by an equal-time edit)
    const tx = num(x.at), ty = num(y.at);
    if (tx !== ty) return ty > tx ? y : x;
    if (!!x.del !== !!y.del) return x.del ? x : y;
    return JSON.stringify(y) > JSON.stringify(x) ? y : x; // the same everywhere, whatever the order
  }
  function merge(L, R, now) {
    L = cleanRec(L); R = cleanRec(R);
    if (!L) return R; if (!R) return L;
    const base = num(R.at) > num(L.at) ? R : L, other = base === R ? L : R;
    const o = { v: 1, t: base.t || other.t, a: base.a || other.a, n: base.n || other.n, ext: base.ext || other.ext, at: Math.max(num(L.at), num(R.at)), m: {} };
    if (L.pos || R.pos) o.pos = !L.pos ? R.pos : !R.pos ? L.pos : newer(L.pos, R.pos);
    const f = base.f || other.f; if (f) o.f = f;
    const old = (now || Date.now()) - TOMB_DAYS * 864e5;
    new Set(Object.keys(L.m).concat(Object.keys(R.m))).forEach(id => {
      const x = L.m[id], y = R.m[id];
      const m = !x ? y : !y ? x : newer(x, y);
      if (m.del && m.at && m.at < old) return; // very old tombstones are forgotten
      o.m[id] = m;
    });
    return o;
  }
  /** settings: { <key>: { v, at } } — per key, the latest */
  function mergeSet(L, R) {
    const o = {};
    [L, R].forEach(S => { if (!isObj(S)) return; Object.keys(S).forEach(k => { const e = S[k]; if (!SYNC_SET.includes(k) || !isObj(e) || !('v' in e)) return; if (!o[k] || num(e.at) > num(o[k].at) || (num(e.at) === num(o[k].at) && JSON.stringify(e.v) > JSON.stringify(o[k].v))) o[k] = { v: e.v, at: num(e.at) }; }); });
    return o;
  }

  /* ---------- the store (localStorage — small, synchronous: the cloud's scan reads it) ---------- */
  const hasLS = (() => { try { return typeof localStorage !== 'undefined'; } catch (e) { return false; } })();
  let mem = null;
  function load() {
    if (mem) return mem;
    let d = null;
    if (hasLS) { try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; } }
    mem = { books: {}, set: {} };
    if (isObj(d)) {
      if (isObj(d.books)) Object.keys(d.books).forEach(k => { if (/^[\w-]{4,80}$/.test(k)) { const r = cleanRec(d.books[k]); if (r) mem.books[k] = r; } });
      if (isObj(d.set)) mem.set = mergeSet(d.set, {});
    }
    return mem;
  }
  let saveT = 0;
  function save(now) {
    clearTimeout(saveT);
    const w = () => {
      if (!hasLS) return;
      try { localStorage.setItem(KEY, JSON.stringify(load())); } catch (e) { emit('full'); }
    };
    if (now) w(); else saveT = setTimeout(w, 250);
    try { if (root.CloudSync && CloudSync.soon) CloudSync.soon(); } catch (e) { /* no cloud */ }
  }
  const listeners = new Set();
  function emit(what, key) { listeners.forEach(fn => { try { fn(what, key); } catch (e) { /* a listener's own problem */ } }); }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function rec(key) { return load().books[key] || null; }
  function ensure(key, info) {
    const D = load();
    let r = D.books[key];
    if (!r) { r = D.books[key] = { v: 1, t: '', a: '', n: 0, ext: '', at: Date.now(), m: {} }; }
    if (info) {
      let ch = false;
      ['t', 'a', 'n', 'ext'].forEach(k => { if (info[k] != null && info[k] !== '' && r[k] !== info[k]) { r[k] = info[k]; ch = true; } });
      if (info.f && (!r.f || r.f.h !== info.f.h)) { r.f = info.f; ch = true; }
      if (ch) { r.at = Date.now(); save(); }
    }
    return r;
  }
  function marks(key, kind) {
    const r = rec(key); if (!r) return [];
    return Object.values(r.m).filter(m => !m.del && (!kind || m.k === kind)).sort((x, y) => x.b - y.b || x.s - y.s || x.at - y.at);
  }
  function addMark(key, m) {
    const r = ensure(key);
    const id = m.id || uid();
    const c = cleanMark(id, Object.assign({}, m, { at: Date.now() }));
    if (!c) return null;
    r.m[id] = c; r.at = Date.now(); save(); emit('marks', key);
    return c;
  }
  function updMark(key, id, patch) {
    const r = rec(key); if (!r || !r.m[id] || r.m[id].del) return null;
    const c = cleanMark(id, Object.assign({}, r.m[id], patch, { at: Math.max(Date.now(), num(r.m[id].at) + 1) }));
    if (!c) return null;
    r.m[id] = c; r.at = Date.now(); save(); emit('marks', key);
    return c;
  }
  function delMark(key, id) {
    const r = rec(key); if (!r || !r.m[id]) return false;
    r.m[id] = { id, del: 1, at: Math.max(Date.now(), num(r.m[id].at) + 1) };
    r.at = Date.now(); save(); emit('marks', key);
    return true;
  }
  function setPos(key, pos) {
    const r = ensure(key);
    const p = cleanPos(Object.assign({}, pos, { at: Date.now() }));
    if (!p) return;
    if (r.pos && r.pos.b === p.b && r.pos.o === p.o) return;
    r.pos = p; save();
  }
  function getPos(key) { const r = rec(key); return r && r.pos ? r.pos : null; }
  function setSetting(k, v) { if (!SYNC_SET.includes(k)) return; const D = load(); D.set[k] = { v, at: Date.now() }; save(); }
  function settings() { const D = load(), o = {}; Object.keys(D.set).forEach(k => { o[k] = D.set[k].v; }); return o; }

  /* ---------- the cloud provider (js/cloudsync.js CloudSync.extend) ---------- */
  const provider = {
    each(fn) {
      const D = load();
      Object.keys(D.books).forEach(k => fn(PREFIX + k, D.books[k], 0));
      if (Object.keys(D.set).length) fn(SET_ID, { set: D.set }, 0);
    },
    get(id) {
      const D = load();
      if (id === SET_ID) return Object.keys(D.set).length ? { set: D.set } : null;
      return D.books[String(id).slice(PREFIX.length)] || null;
    },
    apply(id, data) {
      const D = load();
      if (id === SET_ID) { if (isObj(data) && isObj(data.set)) { D.set = mergeSet(D.set, data.set); save(true); emit('settings'); } return; }
      const key = String(id).slice(PREFIX.length);
      if (!/^[\w-]{4,80}$/.test(key)) return;
      const m = merge(D.books[key], data);
      if (!m) return;
      D.books[key] = m;
      save(true);
      emit('remote', key);
    },
    after() { emit('pulled'); fileTick(2000); },
    wipe() { mem = { books: {}, set: {} }; if (hasLS) { try { localStorage.removeItem(KEY); localStorage.removeItem(UP_KEY); } catch (e) { /* ignore */ } } emit('remote'); },
  };
  let registered = false;
  function register() {
    if (registered || !root.CloudSync || !CloudSync.extend) return;
    registered = true;
    CloudSync.extend(PREFIX, provider);
  }

  /* ---------- 📦 book files through the private bucket, in the background ----------
   * The reader tells how to reach its files: RdSync.files = { get(hash) → Promise<Blob|null>, have(key) → bool, add(blob, info) → Promise }. */
  const status = { phase: '', text: '', at: 0 };
  function setStatus(phase, text) { status.phase = phase; status.text = text || ''; status.at = Date.now(); emit('status'); }
  const lsSet = (k, v) => { if (hasLS) try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* full */ } };
  const lsGet = k => { if (!hasLS) return null; try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const upDone = () => { const o = lsGet(UP_KEY); return isObj(o) ? o : {}; };
  const gone = () => { const o = lsGet(GONE_KEY); return isObj(o) ? o : {}; };
  /** this device deleted the book: its file is not downloaded again here (the marks stay — a new import restores them) */
  function forget(key) { const g = gone(); g[key] = Date.now(); lsSet(GONE_KEY, g); }
  function unforget(key) { const g = gone(); if (g[key]) { delete g[key]; lsSet(GONE_KEY, g); } }
  const refused = new Set();
  let fileT = 0, fileBusy = false;
  function fileTick(ms) { clearTimeout(fileT); fileT = setTimeout(fileRun, ms == null ? 4000 : ms); }
  async function fileRun() {
    if (fileBusy) return;
    const cs = root.CloudSync, M = cs && cs.media, F = RdSync.files;
    if (!M || !F || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    fileBusy = true;
    try {
      const D = load(), done = upDone(), g = gone();
      // up: files this device has and the bucket has not got yet
      for (const key of Object.keys(D.books)) {
        const r = D.books[key], f = r.f;
        if (!f || done[f.h] || refused.has(f.h) || !F.have(key)) continue;
        if (f.size > MAX_FILE) { refused.add(f.h); continue; }
        const blob = await F.get(f.h);
        if (!blob) continue;
        setStatus('up', `Сохраняю книгу «${r.t || 'книга'}» в облако…`);
        try {
          const { error } = await M.sb.storage.from(M.bucket).upload(`${M.uid}/book-${f.h}`, blob, { contentType: f.mime || 'application/octet-stream', upsert: true, cacheControl: '31536000' });
          if (error) throw error;
          done[f.h] = Date.now(); lsSet(UP_KEY, done);
        } catch (e) {
          if (cs.kindOf && cs.kindOf(e) === 'offline') { setStatus('offline', 'Нет сети — книги сохранятся в облако позже'); return; }
          refused.add(f.h);
          setStatus('note', 'Файл книги остаётся только на этом устройстве (облако его не приняло) — закладки и заметки всё равно синхронизируются');
        }
      }
      // down: books the other devices have, this one not (and did not delete)
      for (const key of Object.keys(D.books)) {
        const r = D.books[key], f = r.f;
        if (!f || g[key] || F.have(key) || refused.has('d' + f.h)) continue;
        setStatus('down', `Загружаю книгу «${r.t || 'книга'}» из облака…`);
        try {
          const { data, error } = await M.sb.storage.from(M.bucket).download(`${M.uid}/book-${f.h}`);
          if (error || !data) throw error || new Error('no data');
          await F.add(data, { key, name: f.name || (r.t || 'book') + '.' + (r.ext || 'epub'), mime: f.mime, title: r.t, author: r.a });
          done[f.h] = Date.now(); lsSet(UP_KEY, done);
        } catch (e) {
          if (cs.kindOf && cs.kindOf(e) === 'offline') { setStatus('offline', 'Нет сети — книги из облака загрузятся позже'); return; }
          refused.add('d' + f.h);
        }
      }
      setStatus('ok', '');
    } finally { fileBusy = false; }
  }

  /* ---------- the book key: SHA-256 of the file ---------- */
  function h53(s, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < s.length; i++) { ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  }
  async function hashFile(blob) {
    const buf = blob.arrayBuffer ? await blob.arrayBuffer() : blob;
    try {
      if (root.crypto && crypto.subtle) {
        const d = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
        return [...d.slice(0, 16)].map(x => x.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) { /* not a secure context: below */ }
    const u = new Uint8Array(buf), step = Math.max(1, Math.floor(u.length / 200000));
    let s = String(u.length) + ':';
    for (let i = 0; i < u.length; i += step) s += String.fromCharCode(u[i]);
    return h53(s) + h53(s, 9);
  }
  const keyOfText = (title, chars) => 't' + h53(String(title || '') + '|' + (chars || 0));

  /* ---------- 📝 Markdown export ---------- */
  function toMarkdown(info, list) {
    const head = `# ${info.title || 'Книга'}${info.author ? `\n\n*${info.author}*` : ''}\n\nЗакладки и заметки — Norsk Kort, ${new Date().toLocaleDateString('ru-RU')}\n`;
    const COL = { yellow: 'жёлтый', green: 'зелёный', blue: 'голубой', pink: 'розовый', violet: 'сиреневый' };
    const md = s => String(s || '').replace(/([\\`*_{}[\]<>#|])/g, '\\$1');
    const body = list.map(m => {
      const where = m.pg ? `стр. ${m.pg}` : '';
      if (m.k === 'bm') return `- 🔖 Закладка${where ? ` · ${where}` : ''}${m.text ? ` — ${md(m.text)}` : ''}${m.note ? `\n  - Заметка: ${md(m.note)}` : ''}`;
      const quote = md(m.text || '').split('\n').map(l => `> ${l}`).join('\n');
      return `${quote}\n\n${where ? `*${where}* · ` : ''}*выделение: ${COL[m.c] || m.c}*${m.note ? `\n\n**Заметка:** ${md(m.note)}` : ''}`;
    }).join('\n\n---\n\n');
    return head + '\n' + (body || '_Пока нет ни закладок, ни выделений._') + '\n';
  }

  const RdSync = {
    KEY, SYNC_SET, COLORS,
    rec, ensure, marks, addMark, updMark, delMark, setPos, getPos, setSetting, settings,
    merge, mergeSet, cleanRec, hashFile, keyOfText, toMarkdown, forget, unforget,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get status() { return Object.assign({}, status); },
    files: null,
    /** the reader is ready to give / take files → start the background transfer */
    filesReady(F) { RdSync.files = F; fileTick(3000); },
    kick: () => fileTick(500),
    register,
    _t: { provider, cleanMark, load: () => load(), reset() { mem = null; } },
  };
  root.RdSync = RdSync;
  if (typeof module !== 'undefined' && module.exports) module.exports = RdSync;
  // the cloud module may come later in the page: try now, and when the app is up
  register();
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', register);
  if (typeof window !== 'undefined') window.addEventListener('load', () => { register(); fileTick(5000); });
})(typeof window !== 'undefined' ? window : globalThis);
