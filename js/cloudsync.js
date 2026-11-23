/* ============ ☁️ CloudSync — your data on all your devices (v228) ============
 * The owner's own Supabase project (Settings → ☁️ Облако: Project URL + anon key; sign-in: js/account.js, js/signin.js).
 * Offline-first: everything keeps working on the device; the cloud follows when there is a network and a signed-in user.
 * One-time setup in Supabase: supabase/norsk-kort-sync.sql (steps in Russian: docs/cloud-sync-setup.md).
 *
 * MODEL — one row per record in public.nk_items (user_id, kind, id, data jsonb, updated_at, deleted, device, server_at):
 *   deck · card (with its review state srs, aiCheck, forms, examples, history) · log (the answer log, one row per UTC day)
 *   · set (one setting) · ls (⭐ XP, 🌅 «Фраза дня», 🎓 «Учить по материалам», 🎯 тест уровня — their localStorage blobs)
 *   · utr (your own corrected sentence translations / word glosses, Study.userTr).
 *   Pictures and sounds (data: URLs) go ONCE to the private bucket nk-media at «<user id>/<content hash>»; the rows carry
 *   «nkmedia:<hash>»; another device downloads them and keeps an ordinary data: URL (the rest of the app sees no change).
 * CYCLE (CloudSync.sync): scan — a fingerprint per record against the last synced one (changed → dirty with the time of
 *   the change; gone → a tombstone) · pull — rows the cloud got since this device's cursor (server_at, with an overlap) ·
 *   merge · push — the dirty records in chunks (media first). The dirty set, the cursor and the fingerprints are kept in
 *   IndexedDB per project + user, so an offline device sends its changes when the network is back.
 * MERGE: last writer wins per record by updated_at (tie → the larger device id); a card changed on both devices keeps the
 *   newer content AND, per direction, the review state with the more recent review; the answer log is a union (an undone
 *   answer travels as a removal mark); XP, «Фраза дня» and the level-test history are unions as well. The server keeps
 *   the same rule (a trigger never lets an older write replace a newer one).
 * NEVER SYNCED: API keys / tokens (Store.SECRET_KEYS — the backup strip list — aiCfg, any key- / token-like setting or
 *   value), the cloud's own URL + anon key, the Mac bridge and Telegram settings, device things (installed voices,
 *   the audio unlock, window / panel sizes and positions live in other localStorage keys that are simply not listed),
 *   🔒 personal course decks. A last check drops any row that would contain one of this device's keys.
 * TRIGGERS: sign-in (the first sync of a device asks once when both sides have data: «Объединить» / «Взять из облака» /
 *   «Взять с этого устройства»), app start, every 60 s while visible, 5 s after an edit, back online, page hide.
 * STATUS: CloudSync.statusHtml() / .text() — «Синхронизировано · 2 мин назад», «Нет сети — синхронизирую, когда
 *   появится», «Ждём входа»… (never technical error text). Live: elements with [data-sync-status].
 */
(function () {
  'use strict';
  const TABLE = 'nk_items', BUCKET = 'nk-media';
  const PAGE = 1000, PUSH_ROWS = 200, PUSH_BYTES = 800e3, OVERLAP = 120e3, DEBOUNCE = 5000, EVERY = 60e3, MEDIA_TRIES = 3;
  const LS_KEYS = ['nk-xp', 'nk-phraseday', 'nk-learnby', 'nk-leveltest'];
  const KINDS = ['deck', 'card', 'log', 'set', 'ls', 'utr'];
  // settings that never leave the device (on top of Store.SECRET_KEYS and the name / value checks below)
  const NEVER_SET = new Set(['aiCfg', 'aiMode', 'bridgeModel', 'bridgeUrl', 'plusToken', 'plusProxy', 'plusEnabled', 'vkToken', 'vkExtra',
    'tgExtra', 'tgOff', 'castAppId', 'asrQuality', 'cloudUrl', 'cloudAnon']);
  const SECRET_NAME = /key|token|secret|passw|anon|bridge|proxy|cookie|session|auth|cred|^tg|^vk|telegram/i;
  const SECRET_VAL = /^(sk-|sk_|rk_|pk_live|AIza|ghp_|gho_|github_pat_|xox[abpr]-|hf_|gsk_|AKIA|eyJ[\w-]{8,}\.[\w-]{8,}\.)|^[0-9a-f-]{30,}:fx$/i;
  const DATA_URL = /^data:(image|audio)\/[a-z0-9.+-]+;base64,/i;

  /* ---------- small tools ---------- */
  /** cyrb53 → 16 hex chars (fingerprints, media names) */
  function h53(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  }
  /** JSON with sorted keys — «is it the same content?» regardless of key order (jsonb reorders keys) */
  function stable(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(x => (x === undefined ? 'null' : stable(x))).join(',') + ']';
    return '{' + Object.keys(v).filter(k => v[k] !== undefined && typeof v[k] !== 'function').sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  }
  const same = (a, b) => stable(a) === stable(b);
  const iso = t => new Date(t).toISOString();
  const ms = s => { const t = Date.parse(s); return Number.isFinite(t) ? t : 0; };
  /** a drawn icon of the top-bar family (js/app.js NavIcons.icon) */
  const IC = (n, s) => (window.NavIcons && NavIcons.icon ? NavIcons.icon(n, s) : '');
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
  const dayOf = ts => new Date(ts).toISOString().slice(0, 10);
  const logKey = (ts, c, d) => `${ts}|${c}|${d}`;
  /** a day's answers in one order on every device: time, card, direction */
  const byEntry = (p, q) => p[0] - q[0] || (p[1] < q[1] ? -1 : p[1] > q[1] ? 1 : 0) || (p[2] < q[2] ? -1 : p[2] > q[2] ? 1 : 0);
  const dayForm = (e, x) => { const seen = new Set(), out = []; e.slice().sort(byEntry).forEach(a => { const k = logKey(a[0], a[1], a[2]); if (!seen.has(k)) { seen.add(k); out.push(a); } }); return { e: out, x: (x || []).slice().sort() }; };
  function deviceId() {
    let d = '';
    try { d = localStorage.getItem('nk-device') || ''; } catch (e) { /* private mode */ }
    if (!/^d-[a-z0-9]{6,}$/.test(d)) {
      d = 'd-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      try { localStorage.setItem('nk-device', d); } catch (e) { /* this visit only */ }
    }
    return d;
  }

  /* ---------- 🖼 media: data: URLs ⇄ nkmedia:<hash> ---------- */
  const mediaOf = new Map();   // the data: URL string → { h, mime, src } (computed once per string)
  const byHash = new Map();    // hash → a data: URL we have (local or downloaded)
  let live = null;             // during a scan: the media still in use (the rest is forgotten after it)
  function mediaRef(src) {
    let m = mediaOf.get(src);
    if (!m) {
      const head = DATA_URL.exec(src);
      if (!head) return null;
      const mime = head[0].slice(5, head[0].indexOf(';')).toLowerCase();
      const b64 = src.slice(head[0].length).replace(/\s+/g, '');
      const canon = `data:${mime};base64,${b64}`;
      m = { h: h53(canon) + h53(canon, 7).slice(0, 8) + '-' + canon.length.toString(36), mime, src };
      mediaOf.set(src, m);
      if (!byHash.has(m.h)) byHash.set(m.h, canon === src ? src : canon);
    }
    return m;
  }
  /** the record as it goes to the cloud: JSON text, every picture / sound replaced by its reference (collected in `media`) */
  function toJson(obj, media) {
    return JSON.stringify(obj, (k, v) => {
      if (typeof v === 'string' && v.length > 256 && v.charCodeAt(0) === 100 && DATA_URL.test(v.slice(0, 60))) {
        if (meta && meta.inl && meta.inl[(mediaRef(v) || {}).h]) return v; // the bucket refused this one: it travels inline
        const m = mediaRef(v);
        if (!m) return v;
        if (media) media.set(m.h, m);
        if (live) live.add(v);
        return 'nkmedia:' + m.h;
      }
      return v;
    });
  }
  /** references inside cloud data */
  function refsIn(v, out) {
    if (typeof v === 'string') { if (v.startsWith('nkmedia:')) out.add(v.slice(8)); }
    else if (Array.isArray(v)) v.forEach(x => refsIn(x, out));
    else if (isObj(v)) Object.keys(v).forEach(k => refsIn(v[k], out));
    return out;
  }
  /** cloud data → local data: references back to data: URLs (unknown → '') */
  function resolve(v) {
    if (typeof v === 'string') return v.startsWith('nkmedia:') ? byHash.get(v.slice(8)) || '' : v;
    if (Array.isArray(v)) return v.map(resolve);
    if (isObj(v)) { const o = {}; Object.keys(v).forEach(k => { o[k] = resolve(v[k]); }); return o; }
    return v;
  }
  const b64bytes = s => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const blobUrl = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });

  /* ---------- 🔑 what must never leave ---------- */
  function secretish(v, depth = 0) {
    if (typeof v === 'string') return SECRET_VAL.test(v.trim());
    if (depth > 6 || v == null || typeof v !== 'object') return false;
    if (v.__enc) return true; // a sealed key (Store.Vault)
    return (Array.isArray(v) ? v : Object.values(v)).some(x => secretish(x, depth + 1));
  }
  function settingSyncs(k, v) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/.test(k)) return false;
    if (NEVER_SET.has(k) || (Store.SECRET_KEYS || []).includes(k) || SECRET_NAME.test(k)) return false;
    if (typeof v === 'function' || v === undefined) return false;
    return !secretish(v);
  }
  /** this device's real keys (≥ 8 characters) — no row may contain one */
  function mySecrets() {
    const out = [];
    try {
      const s = Store.secrets(Store.settings);
      Object.keys(s).forEach(k => { if (k !== 'aiCfg' && typeof s[k] === 'string' && s[k].trim().length >= 8) out.push(s[k].trim()); });
      Object.values(s.aiCfg || {}).forEach(v => { if (typeof v === 'string' && v.trim().length >= 8) out.push(v.trim()); });
      ['plusToken', 'bridgeToken'].forEach(k => { const v = Store.settings[k]; if (typeof v === 'string' && v.trim().length >= 8) out.push(v.trim()); });
    } catch (e) { /* no settings yet */ }
    return out;
  }

  /* ---------- records of each kind ---------- */
  let K = null; // per-cycle caches (log grouping, personal card ids)
  const cyc = () => K || (K = {});
  function personalIds() {
    const k = cyc();
    if (!k.pers) { k.pers = new Set(); (Store.state.cards || []).forEach(c => { if (Store.isPersonalCard(c)) k.pers.add(c.id); }); }
    return k.pers;
  }
  function logGroups() {
    const k = cyc();
    if (k.logs) return k.logs;
    const g = new Map(), pers = personalIds();
    (Store.state.log || []).forEach(l => {
      if (!l || typeof l.ts !== 'number' || pers.has(l.c)) return;
      const d = dayOf(l.ts);
      let a = g.get(d); if (!a) g.set(d, a = []);
      a.push(l.n ? [l.ts, l.c, l.d, l.g, 1] : [l.ts, l.c, l.d, l.g]);
    });
    Object.keys(meta && meta.logX || {}).forEach(d => { if (!g.has(d)) g.set(d, []); });
    k.logs = g;
    return g;
  }
  const lsRead = key => { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return isObj(v) ? v : null; } catch (e) { return null; } };
  const utrOf = () => (window.Study && Study.userTr ? Study.userTr() : (Store.state.userTr || { s: {}, g: {} }));

  /** an untouched starter deck (the sample of a fresh install): not «data» worth asking about, not worth sending */
  function untouchedSample(d, cards) {
    const sd = window.SAMPLE_DECK;
    if (!d || !(d.sample || (sd && d.name === sd.name && d.description === sd.description))) return false;
    cards = cards || Store.cards(d.id);
    return cards.length <= ((sd && sd.cards && sd.cards.length) || 60) && !cards.some(c => c.srs && ((c.srs.nr && c.srs.nr.reps) || (c.srs.rn && c.srs.rn.reps)));
  }

  const C = {
    deck: {
      tomb: true,
      each(fn) { Store.state.decks.forEach(d => { if (!Store.isPersonalDeck(d)) fn(d.id, d, +d.updated || +d.created || 0); }); },
      get(id) { const d = Store.deck(id); return d && !Store.isPersonalDeck(d) ? { obj: d, own: +d.updated || +d.created || 0 } : null; },
      exists: id => !!Store.deck(id),
      apply(id, data) {
        const nd = Store.sanitizeDeck(Object.assign({}, data, { id }));
        const d = Store.deck(id);
        if (d) { Object.keys(d).forEach(k => { if (!(k in nd)) delete d[k]; }); Object.assign(d, nd); return; }
        // a new deck: in the order of creation (Settings → «Порядок колод» → «как создавали»)
        const list = Store.state.decks, at = list.findIndex(x => (+x.created || 0) > (+nd.created || 0));
        if (at < 0) list.push(nd); else list.splice(at, 0, nd);
      },
      remove(ids) { ids.forEach(id => { if (Store.deck(id)) { const e = Store.deleteDeck(id); if (e) e.cloud = 1; } }); },
      /** both changed: the newer content; «in work» = the later one */
      merge(L, R, rWins) { const o = clone(rWins ? R : L); const lu = Math.max(+L.lastUsed || 0, +R.lastUsed || 0); if (lu) o.lastUsed = lu; return o; },
    },
    card: {
      tomb: true,
      each(fn) { const pers = personalIds(); Store.state.cards.forEach(c => { if (!pers.has(c.id)) fn(c.id, c, +c.updated || +c.created || 0); }); },
      get(id) { const c = Store.card(id); return c && !personalIds().has(c.id) ? { obj: c, own: +c.updated || +c.created || 0 } : null; },
      exists: id => !!Store.card(id),
      apply(id, data) {
        const nc = Store.migrateCard(Object.assign({}, data, { id }));
        const c = Store.card(id);
        if (c) { Object.keys(c).forEach(k => { if (!(k in nc)) delete c[k]; }); Object.assign(c, nc); }
        else Store.state.cards.push(nc);
      },
      remove(ids) { const have = ids.filter(id => Store.card(id)); if (have.length) { const e = Store.deleteCards(have); if (e) e.cloud = 1; } },
      /** both changed: the newer content; per direction the review state with the more recent review (never lose a review) */
      merge(L, R, rWins) {
        const o = clone(rWins ? R : L), a = isObj(L.srs) ? L.srs : {}, b = isObj(R.srs) ? R.srs : {}, srs = {};
        new Set(Object.keys(a).concat(Object.keys(b))).forEach(d => {
          const x = a[d], y = b[d];
          if (!x || !y) { srs[d] = clone(x || y); return; }
          const tx = +x.lastReview || 0, ty = +y.lastReview || 0;
          srs[d] = clone(tx !== ty ? (tx > ty ? x : y) : (+x.reps || 0) !== (+y.reps || 0) ? ((+x.reps || 0) > (+y.reps || 0) ? x : y) : (rWins ? y : x));
        });
        o.srs = srs;
        const leech = d => d && d.lapses >= (Store.settings.leechLapses || 6);
        if (Object.values(srs).some(leech) && Array.isArray(o.tags) && !o.tags.includes('leech')) o.tags = o.tags.concat('leech');
        o.updated = Math.max(+L.updated || 0, +R.updated || 0);
        return o;
      },
    },
    log: {
      tomb: false, union: true,
      each(fn) { logGroups().forEach((e, d) => fn(d, dayForm(e, meta.logX[d]), 0)); },
      get(id) { const e = logGroups().get(id); return e ? { obj: dayForm(e, meta.logX[id]), own: 0 } : null; },
      /** nothing here that the cloud's row lacks → no need to send it back */
      covered(L, R) {
        const re = new Set((Array.isArray(R.e) ? R.e : []).map(a => Array.isArray(a) ? logKey(a[0], a[1], a[2]) : '')), rx = new Set(Array.isArray(R.x) ? R.x : []);
        return L.e.every(a => re.has(logKey(a[0], a[1], a[2]))) && L.x.every(x => rx.has(x));
      },
      exists: id => logGroups().has(id),
      /** union of answers minus the removal marks of both sides */
      apply(id, data) {
        const k = cyc();
        const xs = new Set((Array.isArray(data.x) ? data.x : []).filter(s => typeof s === 'string' && s.length < 140).concat(meta.logX[id] || []));
        if (xs.size) meta.logX[id] = [...xs].slice(-500);
        const log = Store.state.log;
        if (!k.logKeys) { k.logKeys = new Set(); log.forEach(l => { if (l) k.logKeys.add(logKey(l.ts, l.c, l.d)); }); }
        let changed = false;
        const g = logGroups();
        if (!g.has(id)) g.set(id, []);
        if (xs.size && g.get(id).some(a => xs.has(logKey(a[0], a[1], a[2])))) {
          Store.state.log = log.filter(l => !(l && xs.has(logKey(l.ts, l.c, l.d)) && dayOf(l.ts) === id));
          g.set(id, g.get(id).filter(a => !xs.has(logKey(a[0], a[1], a[2]))));
          k.logKeys = null; changed = true;
        }
        const add = [];
        (Array.isArray(data.e) ? data.e : []).forEach(a => {
          if (!Array.isArray(a)) return;
          const e = Store.Safe.log([{ ts: a[0], c: a[1], d: a[2], g: a[3], n: a[4] }])[0];
          if (!e) return;
          const key = logKey(e.ts, e.c, e.d);
          if (xs.has(key) || (k.logKeys && k.logKeys.has(key))) return;
          if (k.logKeys) k.logKeys.add(key);
          add.push(e);
          if (!personalIds().has(e.c)) g.get(id).push(e.n ? [e.ts, e.c, e.d, e.g, 1] : [e.ts, e.c, e.d, e.g]);
        });
        if (add.length) { Store.state.log.push(...add); k.logSort = true; changed = true; }
      },
      remove() { /* the answer log is never deleted through the cloud */ },
    },
    set: {
      tomb: false,
      each(fn) { const s = Store.settings; Object.keys(s).forEach(k => { if (settingSyncs(k, s[k])) fn(k, { v: s[k] }, 0); }); },
      get(id) { const s = Store.settings; return id in s && settingSyncs(id, s[id]) ? { obj: { v: s[id] }, own: 0 } : null; },
      exists: id => id in Store.settings,
      apply(id, data) {
        if (!isObj(data) || !('v' in data) || !settingSyncs(id, data.v)) return; // a key-like setting from the cloud is ignored
        const s = Store.settings, v = data.v;
        if (id === 'avatar' && v && !/^(data:image\/(png|jpe?g|gif|webp);base64,|https:\/\/)/i.test(String(v))) return;
        if (id === 'theme' && s.theme !== v) cyc().theme = true;
        s[id] = clone(v);
        if (id === 'fsrsW') s.fsrsW = Store.Safe.weights(s.fsrsW);
        if (id === 'fsrsOpt') s.fsrsOpt = Store.Safe.fsrsMeta(s.fsrsOpt);
        if (/^art/.test(id)) Store.sanitizeArt(s);
        if (/^voice|^cloudVoices/.test(id)) Store.sanitizeVoices(s);
        if (id === 'avatar' || id === 'userName') cyc().avatar = true;
      },
      remove() { /* a setting is never deleted */ },
    },
    ls: {
      tomb: false, blend: true,
      each(fn) { LS_KEYS.forEach(k => { const v = lsRead(k); if (v) fn(k, v, 0); }); },
      get(id) { if (!LS_KEYS.includes(id)) return null; const v = lsRead(id); return v ? { obj: v, own: 0 } : null; },
      exists: id => LS_KEYS.includes(id) && !!lsRead(id),
      apply(id, data, o) {
        if (!LS_KEYS.includes(id) || !isObj(data)) return;
        const L = lsRead(id);
        const v = L && (o.dirty || LS_MERGE_ALWAYS.has(id)) ? LS_MERGE[id](L, data, o.rWins) : data;
        try { localStorage.setItem(id, JSON.stringify(v)); } catch (e) { return; }
        cyc().ls = (cyc().ls || new Set()).add(id);
      },
      remove() { /* kept */ },
      unionFor: id => LS_MERGE_ALWAYS.has(id),
    },
    utr: {
      tomb: true,
      each(fn) {
        const u = utrOf();
        Object.keys(u.s || {}).forEach(k => fn('s' + h53(k), { k, v: u.s[k] }, 0));
        Object.keys(u.g || {}).forEach(k => fn('g' + h53(k), { k, m: u.g[k] }, 0));
      },
      get(id) { const hit = utrIndex().get(id); return hit ? { obj: hit, own: 0 } : null; },
      exists: id => utrIndex().has(id),
      apply(id, data) {
        if (!isObj(data) || typeof data.k !== 'string') return;
        const u = utrOf(), S = Store.Safe, k = S.text(data.k, 2000).replace(/\s+/g, ' ').trim();
        if (!k || ('s' + h53(k)) !== id && ('g' + h53(k)) !== id) return;
        if (id[0] === 's') { const v = S.text(data.v, 2000).trim(); if (v) u.s[k] = v; }
        else if (isObj(data.m)) { const m = {}; Object.keys(data.m).forEach(i => { if (/^\d{1,3}$/.test(i)) { const t = S.text(data.m[i], 80).trim(); if (t) m[i] = t; } }); if (Object.keys(m).length) u.g[k] = m; }
        cyc().utr = true; cyc().utrIdx = null;
      },
      remove(ids) {
        const u = utrOf(), idx = utrIndex();
        ids.forEach(id => { const hit = idx.get(id); if (!hit) return; if (id[0] === 's') delete u.s[hit.k]; else delete u.g[hit.k]; });
        cyc().utr = true; cyc().utrIdx = null;
      },
    },
  };
  function utrIndex() {
    const k = cyc();
    if (!k.utrIdx) { k.utrIdx = new Map(); C.utr.each((id, obj) => k.utrIdx.set(id, obj)); }
    return k.utrIdx;
  }

  /* ---------- merges of the localStorage blobs ---------- */
  const unionBy = (a, b, key, max) => { const m = new Map(); (Array.isArray(a) ? a : []).concat(Array.isArray(b) ? b : []).forEach(x => { if (x && typeof x === 'object') m.set(key(x), x); }); const out = [...m.values()]; return max ? out.slice(-max) : out; };
  /** deep union: objects merge key by key, other values — the newer side's */
  function deep(a, b, bWins) {
    if (!isObj(a) || !isObj(b)) return clone(bWins ? (b === undefined ? a : b) : (a === undefined ? b : a));
    const o = {};
    new Set(Object.keys(a).concat(Object.keys(b))).forEach(k => { o[k] = !(k in a) ? clone(b[k]) : !(k in b) ? clone(a[k]) : deep(a[k], b[k], bWins); });
    return o;
  }
  const LS_MERGE_ALWAYS = new Set(['nk-xp', 'nk-phraseday', 'nk-leveltest']);
  const LS_MERGE = {
    'nk-xp'(a, b) {
      const days = {}, done = Object.assign({}, a.done || {}, b.done || {});
      new Set(Object.keys(a.days || {}).concat(Object.keys(b.days || {}))).forEach(d => { days[d] = Math.max(+(a.days || {})[d] || 0, +(b.days || {})[d] || 0); });
      const sum = Object.values(days).reduce((s, n) => s + n, 0);
      const log = unionBy(a.log, b.log, x => `${x.t}|${x.kind}`).sort((p, q) => p.t - q.t).slice(-60);
      return Object.assign(deep(a, b, true), { days, done, log, total: Math.max(+a.total || 0, +b.total || 0, sum) });
    },
    'nk-phraseday'(a, b, bWins) {
      const o = deep(a, b, bWins);
      // the walk through a level's phrases starts on the earliest day any device saw it (the same phrase everywhere)
      if (isObj(a.start) && isObj(b.start)) { o.start = Object.assign({}, a.start, b.start); Object.keys(a.start).forEach(L => { if (Number.isFinite(b.start[L])) o.start[L] = Math.min(a.start[L], b.start[L]); }); }
      return o;
    },
    'nk-learnby'(a, b, bWins) {
      const o = deep(a, b, bWins), pa = isObj(a.plans) ? a.plans : {}, pb = isObj(b.plans) ? b.plans : {};
      o.plans = {};
      new Set(Object.keys(pa).concat(Object.keys(pb))).forEach(id => { const x = pa[id], y = pb[id]; o.plans[id] = clone(!x ? y : !y ? x : (+y.at || 0) > (+x.at || 0) || ((+y.at || 0) === (+x.at || 0) && bWins) ? y : x); });
      return o;
    },
    'nk-leveltest'(a, b) { return Object.assign(deep(a, b, true), { runs: unionBy(a.runs, b.runs, x => String(x.t)).sort((p, q) => p.t - q.t).slice(-20) }); },
  };

  /* ---------- state of this device (IndexedDB, per project + user) ---------- */
  let meta = null, metaKey = '';
  function freshMeta() { return { v: 1, first: false, cursor: 0, items: {}, dirty: {}, logX: {}, up: {}, inl: {}, pend: {}, last: 0 }; }
  async function loadMeta(uid) {
    const key = 'cloudsync:' + h53(String(Store.settings.cloudUrl || '').trim().replace(/\/+$/, '')) + ':' + uid;
    if (meta && metaKey === key) return meta;
    let m = null;
    try { m = await Store.idbGet(key); } catch (e) { /* no IndexedDB: memory only */ }
    meta = Object.assign(freshMeta(), isObj(m) ? m : {});
    ['items', 'dirty', 'logX', 'up', 'inl', 'pend'].forEach(k => { if (!isObj(meta[k])) meta[k] = {}; });
    metaKey = key;
    return meta;
  }
  async function saveMeta() {
    if (!meta || !metaKey) return;
    // removal marks of the answer log: 10 days are plenty for every device to see them
    const old = dayOf(Date.now() - 10 * 864e5);
    Object.keys(meta.logX).forEach(d => { if (d < old) delete meta.logX[d]; });
    try { await Store.idbSet(metaKey, meta); } catch (e) { /* memory only */ }
  }

  /* ---------- the engine ---------- */
  const S = { phase: 'off', last: 0, pending: 0, err: '' };
  let sb = null, uid = '', dev = '', busy = null, again = false, applying = false, editT = 0, tickT = 0, wired = false;

  /** what changed here since the last sync → meta.dirty (with the time of the change) */
  function scan(o = {}) {
    K = null;
    live = new Set();
    const now = Date.now(), seen = new Set();
    KINDS.forEach(kind => {
      C[kind].each((id, obj, own) => {
        const key = kind + ':' + id;
        seen.add(key);
        const h = h53(toJson(obj));
        const base = meta.items[key], d = meta.dirty[key];
        if (o.force) { meta.dirty[key] = { t: now, h }; return; }
        if (base && !base.del && base.h === h) { if (d) delete meta.dirty[key]; return; }
        if (d && !d.del && d.h === h) return;
        let t;
        if (!base && o.first) t = own || 1; // the first sync: a record without its own time loses to the cloud's
        else {
          const floor = base ? base.t + 1 : 0;
          t = own && own >= floor && own <= now + 60e3 ? own : Math.max(now, floor);
        }
        meta.dirty[key] = { t: d ? Math.max(d.t, t) : t, h };
      });
    });
    // gone here → a tombstone (decks, cards, own translations); never synced and gone → forget it
    Object.keys(meta.items).forEach(key => {
      const it = meta.items[key]; if (it.del || seen.has(key)) return;
      const kind = key.slice(0, key.indexOf(':')), id = key.slice(kind.length + 1);
      if (!C[kind] || !C[kind].tomb || C[kind].exists(id)) return; // personal now / not tomb-able: left as it is in the cloud
      const d = meta.dirty[key];
      if (!(d && d.del)) meta.dirty[key] = { t: Math.max(now, it.t + 1), del: 1 };
    });
    Object.keys(meta.dirty).forEach(key => { if (!seen.has(key) && !meta.items[key] && !meta.dirty[key].del) delete meta.dirty[key]; });
    // forget pictures no record uses any more (old versions of an edited picture)
    const keep = new Set();
    mediaOf.forEach((m, src) => { if (live.has(src)) keep.add(m.h); else mediaOf.delete(src); });
    byHash.forEach((v, h) => { if (!keep.has(h)) byHash.delete(h); });
    live = null;
    S.pending = Object.keys(meta.dirty).length;
  }

  /** rows the cloud has since `since` (ms), page by page */
  async function fetchSince(since) {
    const out = [];
    for (let off = 0; ; off += PAGE) {
      let q = sb.from(TABLE).select('kind,id,data,updated_at,deleted,device,server_at').eq('user_id', uid);
      if (since) q = q.gte('server_at', iso(since));
      const { data, error } = await q.order('server_at', { ascending: true }).order('kind', { ascending: true }).order('id', { ascending: true }).range(off, off + PAGE - 1);
      if (error) throw error;
      (data || []).forEach(r => { if (r && KINDS.includes(r.kind) && typeof r.id === 'string' && r.id.length <= 200) out.push(r); });
      if (!data || data.length < PAGE) break;
    }
    return out;
  }
  const cursorOf = rows => rows.reduce((m, r) => Math.max(m, ms(r.server_at)), 0);

  /** download the pictures / sounds the rows need; rows whose media cannot come yet wait (meta.pend) */
  async function fetchMedia(rows) {
    const need = new Set();
    rows.forEach(r => { if (!r.deleted && r.data) refsIn(r.data, new Set()).forEach(h => { if (!byHash.has(h)) need.add(h); }); });
    const bad = new Set(), list = [...need];
    let offline = false;
    for (let i = 0; i < list.length; i += 4) {
      await Promise.all(list.slice(i, i + 4).map(async h => {
        try {
          const { data, error } = await sb.storage.from(BUCKET).download(`${uid}/${h}`);
          if (error || !data) throw error || new Error('no data');
          const url = await blobUrl(data);
          const head = /^data:([a-z0-9.+\/-]+)(;[^,]*)?;base64,/i.exec(url);
          if (!head) throw new Error('not media');
          byHash.set(h, `data:${head[1].toLowerCase()};base64,${url.slice(head[0].length)}`);
        } catch (e) { bad.add(h); if (kindOf(e) === 'offline') offline = true; }
      }));
    }
    return { bad, offline };
  }

  /** apply cloud rows (merge with what changed here) */
  async function applyRows(rows, o = {}) {
    if (!rows.length) return { changed: false };
    // the newest row per record (the overlap and waiting rows may bring one twice)
    const last = new Map();
    rows.forEach(r => { const key = r.kind + ':' + r.id, p = last.get(key); if (!p || ms(r.updated_at) >= ms(p.updated_at)) last.set(key, r); });
    rows = [...last.values()];
    const { bad, offline } = await fetchMedia(rows);
    K = null;
    const removals = {}, now = Date.now();
    let changed = false;
    applying = true;
    try {
      for (const r of rows) {
        const key = r.kind + ':' + r.id, kind = r.kind, id = r.id, c = C[kind];
        if (!c || (r.device === dev && !o.force && meta.items[key] && meta.items[key].t === ms(r.updated_at))) continue;
        const rt = ms(r.updated_at), base = meta.items[key], d = o.force ? null : meta.dirty[key];
        if (base && !o.force && (rt < base.t || (rt === base.t && !!base.del === !!r.deleted && !c.union && !(c.unionFor && c.unionFor(id))))) continue;
        // its pictures could not come yet → this row waits (a few tries, then without them)
        if (!r.deleted && r.data) {
          const refs = refsIn(r.data, new Set());
          if ([...refs].some(h => bad.has(h))) {
            const p = meta.pend[key] = meta.pend[key] && meta.pend[key].row.updated_at === r.updated_at ? meta.pend[key] : { row: r, tries: 0 };
            if (!offline) p.tries++;
            if (p.tries < MEDIA_TRIES) continue;
          }
        }
        delete meta.pend[key];
        const rWins = !d || rt > d.t || (rt === d.t && String(r.device || '') > dev);
        const union = c.union || (c.unionFor && c.unionFor(id)) || (c.blend && !!d && !d.del); // ls changed on both sides: blended
        if (r.deleted) {
          if (!rWins) continue;                                   // edited here after it was deleted there → stays, goes up again
          if (c.tomb && c.exists(id)) { (removals[kind] = removals[kind] || []).push(id); changed = true; }
          meta.items[key] = { t: rt, del: 1 };
          delete meta.dirty[key];
          continue;
        }
        if (!isObj(r.data)) continue;
        if (d && d.del && !rWins) continue;                       // deleted here later than changed there
        let data = r.data, mark = false;
        if (d && !d.del && c.merge) {                             // changed on both devices
          const L = c.get(id);
          if (L) { data = c.merge(JSON.parse(toJson(L.obj)), r.data, rWins); mark = !same(data, r.data); }
        } else if (d && !d.del && !rWins && !union) continue;     // the change here is newer: it goes up, the cloud's is dropped
        c.apply(id, resolve(data), { dirty: !!d, rWins });
        changed = true;
        const after = c.get(id), h = after ? h53(toJson(after.obj)) : '';
        if (union && after) { const F = JSON.parse(toJson(after.obj)); if (c.covered ? !c.covered(F, r.data) : !same(F, r.data)) mark = true; }
        meta.items[key] = { t: rt, h: mark ? '~' : h };
        if (mark) meta.dirty[key] = { t: Math.max(d ? d.t : 0, rt, now) + 1, h };
        else delete meta.dirty[key];
      }
      // deletions: decks first (a deck takes its cards to the trash with it — «restore» brings both back)
      ['deck', 'card', 'utr'].forEach(kind => { if (removals[kind]) C[kind].remove(removals[kind]); });
    } finally { applying = false; }
    if (changed) afterApply();
    return { changed };
  }
  function afterApply() {
    const k = cyc();
    if (k.logSort) Store.state.log.sort((p, q) => p.ts - q.ts);
    try { if (window.FSRS && FSRS.Load) FSRS.Load.invalidate(); } catch (e) { /* ignore */ }
    if (k.utr && window.Study) Study._glVer = (Study._glVer || 0) + 1;
    if (k.ls) {
      if (k.ls.has('nk-learnby') && window.LearnBy && LearnBy._sync) LearnBy._sync.reload();
      if (k.ls.has('nk-xp')) { try { window.dispatchEvent(new CustomEvent('nk-xp', { detail: { added: 0 } })); } catch (e) { /* old browser */ } }
    }
    applying = true; try { Store.saveNow(); } finally { applying = false; }
    try { if (k.theme && window.App && App.applyTheme) App.applyTheme(); } catch (e) { /* ignore */ }
    try { if (k.avatar && window.Account) Account.paintTop(); } catch (e) { /* ignore */ }
    try { if (window.App && App.updateBadge) App.updateBadge(); } catch (e) { /* ignore */ }
    // redraw the page — never in the middle of a card session or while typing
    try {
      const a = document.activeElement, typing = a && a.closest && a.closest('#view') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
      if (window.App && App.view && App.render && App.view.name !== 'study' && !typing && !document.querySelector('#modal-root .modal-backdrop')) App.render();
    } catch (e) { /* ignore */ }
    K = null;
  }

  /** upload what the rows need, then the rows in chunks */
  async function push() {
    const keys = Object.keys(meta.dirty);
    if (!keys.length) return 0;
    const secrets = mySecrets(), items = [];
    K = null;
    for (const key of keys) {
      const d = meta.dirty[key], kind = key.slice(0, key.indexOf(':')), id = key.slice(kind.length + 1), c = C[kind];
      if (!c) { delete meta.dirty[key]; continue; }
      const base = meta.items[key];
      const rec = d.del ? null : c.get(id);
      if (!rec) {
        if (!base || base.del || !c.tomb) { delete meta.dirty[key]; continue; }
        items.push({ key, d, h: '', media: new Map(), row: { kind, id, data: null, deleted: true, updated_at: iso(d.t), device: dev }, size: 100 });
        continue;
      }
      const media = new Map(), json = toJson(rec.obj, media);
      if (secrets.some(s => json.includes(s))) { console.warn('cloudsync: a record with a key stays on this device', kind); delete meta.dirty[key]; continue; }
      items.push({ key, d, h: h53(json), media, row: { kind, id, data: JSON.parse(json), deleted: false, updated_at: iso(d.t), device: dev }, size: json.length });
    }
    // 🖼 media once per content hash
    const up = new Map();
    items.forEach(it => it.media.forEach((m, h) => { if (!meta.up[h] && !meta.inl[h]) up.set(h, m); }));
    const waiting = new Set();
    for (const m of up.values()) {
      try {
        const head = DATA_URL.exec(m.src);
        const { error } = await sb.storage.from(BUCKET).upload(`${uid}/${m.h}`, b64bytes(m.src.slice(head[0].length).replace(/\s+/g, '')), { contentType: m.mime, upsert: true, cacheControl: '31536000' });
        if (error) throw error;
        meta.up[m.h] = 1;
      } catch (e) {
        const k = kindOf(e);
        if (k === 'offline' || k === 'setup' || k === 'auth') throw e;
        // the bucket refused it (type / size): small ones travel inline in the row, big ones wait
        m.fails = (m.fails || 0) + 1;
        if (m.src.length < 700e3) meta.inl[m.h] = 1; else waiting.add(m.h);
      }
    }
    let sent = 0, chunk = [], size = 0;
    const flush = async () => {
      if (!chunk.length) return;
      const rows = chunk.map(it => {
        // a picture that went inline after its upload failed: rebuild the row with it inline
        if (!it.row.deleted && [...it.media.keys()].some(h => meta.inl[h])) { const rec = C[it.row.kind].get(it.row.id); if (rec) it.row.data = JSON.parse(toJson(rec.obj)); }
        return Object.assign({ user_id: uid }, it.row);
      });
      const { error } = await sb.from(TABLE).upsert(rows, { onConflict: 'user_id,kind,id' });
      if (error) throw error;
      chunk.forEach(it => {
        meta.items[it.key] = it.row.deleted ? { t: it.d.t, del: 1 } : { t: it.d.t, h: it.h };
        if (meta.dirty[it.key] === it.d || (meta.dirty[it.key] && meta.dirty[it.key].h === it.h)) delete meta.dirty[it.key];
      });
      sent += chunk.length; chunk = []; size = 0;
      await saveMeta();
    };
    for (const it of items) {
      if ([...it.media.keys()].some(h => waiting.has(h))) continue;
      if (chunk.length >= PUSH_ROWS || (chunk.length && size + it.size > PUSH_BYTES)) await flush();
      chunk.push(it); size += it.size;
    }
    await flush();
    return sent;
  }

  /* ---------- the first sync of this device for this account ---------- */
  function localHasData() {
    const cards = Store.state.cards;
    return Store.state.decks.some(d => !Store.isPersonalDeck(d) && !untouchedSample(d, cards.filter(c => c.deckId === d.id)))
      || cards.some(c => !Store.deck(c.deckId) && !Store.isPersonalCard(c));
  }
  function remoteHasData(rows) {
    const decks = new Map();
    rows.forEach(r => { if (r.kind === 'deck' && !r.deleted && isObj(r.data)) decks.set(r.id, r.data); });
    const sd = window.SAMPLE_DECK, sampleLike = d => !!d && (d.sample || (sd && d.name === sd.name && d.description === sd.description));
    if ([...decks.values()].some(d => !sampleLike(d))) return true;
    return rows.some(r => r.kind === 'card' && !r.deleted && isObj(r.data) && (!sampleLike(decks.get(r.data.deckId)) || Object.values(r.data.srs || {}).some(s => s && s.reps)));
  }
  function askFirst() {
    return new Promise(res => {
      let v = 'merge';
      const m = UI.modal({
        title: `<span class="ui-t">${IC('cloud', 22)}<span>В облаке уже есть ваши данные</span></span>`, cls: 'narrow cs-first',
        body: `<p class="cs-first-p">На этом устройстве тоже есть колоды и карточки. Как поступить? Спросим только один раз.</p>
          <div class="cs-opts">
            <button type="button" class="cs-opt rec" data-first="merge">${IC('sync', 22)}<span class="cs-opt-t"><b>Объединить</b><small>Рекомендуем: всё отсюда и из облака — вместе, ничего не потеряется</small></span></button>
            <button type="button" class="cs-opt" data-first="cloud">${IC('download', 22)}<span class="cs-opt-t"><b>Взять из облака</b><small>Колоды этого устройства уйдут в корзину — их можно вернуть 30 дней</small></span></button>
            <button type="button" class="cs-opt" data-first="local">${IC('upload', 22)}<span class="cs-opt-t"><b>Взять с этого устройства</b><small>Облако и другие ваши устройства получат то, что здесь</small></span></button>
          </div>`,
        onClose: () => res(v),
      });
      m.el.addEventListener('click', e => { const b = e.target.closest('[data-first]'); if (b) { v = b.dataset.first; m.close(); } });
      setTimeout(() => { const b = m.el.querySelector('[data-first="merge"]'); if (b) b.focus(); }, 60);
    });
  }
  async function firstSync() {
    const rows = await fetchSince(0);
    const rHas = remoteHasData(rows), lHas = localHasData();
    let mode = 'merge';
    if (rHas && lHas) { setStatus('ask'); mode = await askFirst(); setStatus('sync'); }
    // an untouched starter deck here is not sent when the cloud already has decks
    if (rows.some(r => r.kind === 'deck' && !r.deleted)) {
      const drop = Store.state.decks.filter(d => !Store.isPersonalDeck(d) && untouchedSample(d));
      if (drop.length) { applying = true; try { drop.forEach(d => Store.deleteDeck(d.id)); } finally { applying = false; } }
    }
    if (mode === 'cloud') {
      // this device becomes the cloud's copy: what the cloud does not have goes to the trash (decks, cards) / away
      meta.dirty = {};
      await applyRows(rows, { force: true });
      const alive = new Set(rows.filter(r => !r.deleted).map(r => r.kind + ':' + r.id));
      K = null;
      const gone = { deck: [], card: [], utr: [] };
      Object.keys(gone).forEach(kind => C[kind].each(id => { if (!alive.has(kind + ':' + id)) gone[kind].push(id); }));
      applying = true;
      try { Object.keys(gone).forEach(kind => { if (gone[kind].length) C[kind].remove(gone[kind]); }); } finally { applying = false; }
      afterApply();
      scan();
    } else if (mode === 'local') {
      // the cloud becomes this device's copy: everything here goes up as the newest; records only the cloud has are deleted there
      meta.items = {};
      scan({ force: true });
      const now = Date.now();
      rows.forEach(r => { const key = r.kind + ':' + r.id; if (!r.deleted && C[r.kind] && C[r.kind].tomb && !meta.dirty[key]) { meta.items[key] = { t: ms(r.updated_at), h: '?' }; meta.dirty[key] = { t: Math.max(now, ms(r.updated_at) + 1), del: 1 }; } });
    } else {
      scan({ first: true });
      await applyRows(rows);
    }
    meta.cursor = Math.max(meta.cursor || 0, cursorOf(rows));
    meta.first = true;
    await push();
  }

  /* ---------- status ---------- */
  function setStatus(phase, extra) {
    S.phase = phase;
    if (extra) Object.assign(S, extra);
    paint();
  }
  function ago(t) {
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'только что';
    const m = Math.round(s / 60);
    if (m < 60) return `${m} мин назад`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} ч назад`;
    return new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }
  function text() {
    switch (S.phase) {
      case 'off': return '';
      case 'wait': return 'Ждём входа';
      case 'sync': return S.last ? `Синхронизирую… · ${ago(S.last)}` : 'Синхронизирую…';
      case 'ask': return 'Ждём вашего выбора';
      case 'ok': return S.last ? `Синхронизировано · ${ago(S.last)}` : 'Синхронизировано';
      case 'offline': return 'Нет сети — синхронизирую, когда появится';
      case 'setup': return 'Облако ещё не готово к синхронизации — нужен один шаг в Supabase';
      case 'auth': return 'Войдите снова, чтобы синхронизировать';
      default: return 'Не получилось — попробую ещё раз через минуту';
    }
  }
  /* drawn icons of the top-bar family (js/app.js NavIcons.icon), no emoji (v229) */
  const ICON = { wait: 'cloud', sync: 'sync', ask: 'info', ok: 'cloud-check', offline: 'cloud-off', setup: 'alert', auth: 'lock', error: 'alert' };
  const icoHtml = phase => IC(ICON[phase] || 'cloud', 16);
  function statusHtml() {
    const t = text();
    return t ? `<span class="cs-status cs-${S.phase}" data-sync-status role="status"><span class="cs-ico" aria-hidden="true" data-ph="${S.phase}">${icoHtml(S.phase)}</span><span class="cs-txt">${U.esc(t)}</span></span>` : '';
  }
  function paint() {
    document.querySelectorAll('[data-sync-status]').forEach(el => {
      el.className = `cs-status cs-${S.phase}`;
      const i = el.querySelector('.cs-ico'), t = el.querySelector('.cs-txt');
      if (i && i.dataset.ph !== S.phase) { i.innerHTML = icoHtml(S.phase); i.dataset.ph = S.phase; }
      if (t) t.textContent = text();
    });
    document.querySelectorAll('[data-sync-now]').forEach(b => { b.disabled = S.phase === 'sync' || S.phase === 'ask'; });
  }
  function kindOf(e) {
    const msg = String((e && (e.message || e.error_description || e.error)) || e || ''), st = +(e && (e.status || e.statusCode)) || 0, code = String((e && e.code) || '');
    if ((typeof navigator !== 'undefined' && navigator.onLine === false) || /Failed to fetch|NetworkError|Load failed|network|ERR_INTERNET|fetch failed|aborted|timed? ?out/i.test(msg)) return 'offline';
    if (/^(PGRST205|PGRST202|42P01|42703)$/.test(code) || /relation .* does not exist|Could not find the table|schema cache|Bucket not found|column .* does not exist/i.test(msg)) return 'setup';
    if (st === 401 || /JWT|not authenticated|invalid claim|refresh token/i.test(msg)) return 'auth';
    return 'error';
  }

  /* ---------- the public side ---------- */
  async function run(o) {
    if (!navigator.onLine) { setStatus('offline'); return false; }
    // «Синхронизирую…» only when it takes a moment (no blinking every minute)
    const showT = setTimeout(() => { if (S.phase !== 'ask') setStatus('sync'); }, o.manual ? 0 : 700);
    try {
      await loadMeta(uid);
      if (window.LearnBy && LearnBy._sync) LearnBy._sync.flush();
      if (!meta.first) await firstSync();
      else if (o.pushOnly) { scan(); await push(); }
      else {
        scan();
        const pend = Object.values(meta.pend).map(p => p.row);
        const rows = await fetchSince(meta.cursor ? meta.cursor - OVERLAP : 0);
        await applyRows(pend.concat(rows));
        meta.cursor = Math.max(meta.cursor || 0, cursorOf(rows));
        if (!o.pullOnly) { scan(); await push(); }
      }
      meta.last = Date.now();
      S.pending = Object.keys(meta.dirty).length;
      await saveMeta();
      setStatus('ok', { last: meta.last, err: '' });
      return true;
    } catch (e) {
      await saveMeta();
      const k = kindOf(e);
      if (k !== 'offline') console.warn('cloudsync', e && (e.message || e.code || e));
      setStatus(k, { err: String((e && (e.code || e.message)) || '') });
      return false;
    } finally { clearTimeout(showT); K = null; }
  }

  const CloudSync = {
    get state() { return Object.assign({}, S); },
    get device() { return dev || (dev = deviceId()); },
    /** sync now (one at a time; a request meanwhile runs once more afterwards) → true when it went well */
    sync(o = {}) {
      if (!sb || !uid) { setStatus(window.Account && Account.cloudReady && Account.cloudReady() ? 'wait' : 'off'); return Promise.resolve(false); }
      if (busy) { again = true; return busy; }
      clearTimeout(editT);
      busy = run(o).finally(() => { busy = null; if (again) { again = false; CloudSync.soon(800); } });
      return busy;
    },
    /** the «🔄 Синхронизировать сейчас» button */
    async syncNow() { const ok = await this.sync({ manual: true }); if (window.UI) UI.toast(ok ? 'Синхронизировано' : text(), ok ? 'good' : 'warn', 3000); return ok; },
    /** a sync a little later (after edits) */
    soon(ms) { clearTimeout(editT); if (uid) editT = setTimeout(() => this.sync(), ms == null ? DEBOUNCE : ms); },
    /** the user signed in / out (js/account.js) */
    onAuth(user) {
      wire();
      const A = window.Account;
      if (!user || !A || !A.sb) {
        sb = null; uid = ''; meta = null; metaKey = '';
        clearTimeout(editT);
        setStatus(A && A.cloudReady && A.cloudReady() ? 'wait' : 'off');
        return;
      }
      if (uid === user.id && sb === A.sb) return;
      sb = A.sb; uid = user.id; dev = deviceId();
      // outside supabase-js's auth callback (a query inside it would wait for its own lock)
      setTimeout(() => this.sync(), 0);
    },
    /** sign-out «убрать данные с устройства»: synced data off this device (🔒 personal course decks stay — they exist only here) */
    async wipeLocal() {
      const st = Store.state;
      const keep = new Set(st.decks.filter(d => Store.isPersonalDeck(d)).map(d => d.id));
      st.decks = st.decks.filter(d => keep.has(d.id));
      st.cards = st.cards.filter(c => keep.has(c.deckId) || Store.isPersonalCard(c));
      const ids = new Set(st.cards.map(c => c.id));
      st.log = st.log.filter(l => l && ids.has(l.c));
      st.trash = []; st.userTr = { s: {}, g: {} };
      st.settings.avatar = '';
      LS_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
      if (window.LearnBy && LearnBy._sync) LearnBy._sync.reload();
      try { if (window.FSRS) FSRS.Load.invalidate(); } catch (e) { /* ignore */ }
      if (metaKey) { try { await Store.idbSet(metaKey, null); } catch (e) { /* ignore */ } }
      meta = null; metaKey = '';
      applying = true; try { await Store.saveNow(); } finally { applying = false; }
    },
    /** changes waiting to go up (after a scan) */
    pending() { if (!meta) return 0; scan(); return Object.keys(meta.dirty).length; },
    text, statusHtml, kindOf,
    /** what never leaves the device — shown in «Мой кабинет» */
    LS_KEYS,
    _t: { h53, stable, toJson, resolve, scan: () => scan(), get meta() { return meta; }, settingSyncs, mySecrets, untouchedSample, LS_MERGE, C },
  };

  /* ---------- triggers ---------- */
  function wire() {
    if (wired) return; wired = true;
    // after an edit (every change of the data goes through Store.save) → a sync 5 s later
    const save0 = Store.save;
    Store.save = function () { const r = save0.apply(this, arguments); if (!applying && uid) CloudSync.soon(); return r; };
    // an undone answer travels as a removal mark (the other devices drop it from their log too)
    const unlog0 = Store.unlog;
    Store.unlog = function (entry) {
      if (entry && meta && uid) { const d = dayOf(entry.ts); (meta.logX[d] = meta.logX[d] || []).push(logKey(entry.ts, entry.c, entry.d)); }
      return unlog0.apply(this, arguments);
    };
    window.addEventListener('nk-xp', e => { if (!applying && uid && !(e.detail && e.detail.added === 0)) CloudSync.soon(); });
    document.addEventListener('learnby-changed', () => { if (!applying && uid) CloudSync.soon(); });
    window.addEventListener('online', () => { if (uid) CloudSync.soon(400); });
    window.addEventListener('offline', () => { if (uid) setStatus('offline'); });
    document.addEventListener('visibilitychange', () => {
      if (!uid) return;
      if (document.visibilityState === 'visible') { if (Date.now() - S.last > 30e3) CloudSync.soon(300); }
      else if (meta && Object.keys(meta.dirty).length + (editT ? 1 : 0)) CloudSync.sync({ pushOnly: true }); // best effort before the page sleeps
    });
    window.addEventListener('pagehide', () => { if (uid && editT) CloudSync.sync(); });
    tickT = setInterval(() => {
      if (!uid) return;
      if (document.visibilityState === 'visible') CloudSync.sync();
    }, EVERY);
    // «2 мин назад» stays true
    setInterval(() => { if (S.phase === 'ok' || S.phase === 'sync') paint(); }, 20e3);
  }

  window.CloudSync = CloudSync;
})();
