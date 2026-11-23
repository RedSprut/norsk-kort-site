/* ============ 🎓 «Учить по материалам» — a film, a programme, a song or a book becomes a course (js/learnby.js) ============
 * A material (NRK TV / YouTube / own video / Telegram video · NRK radio / podcast / Telegram audio · a song the player
 * recognized · a book) is split into parts of ~10–15 min at natural pauses (the gaps between subtitle lines). Each part:
 *   ① watch with the translation under the line («Под строкой»)       ② learn the part's deck (words for your level +
 *   ③ again, the translation blurred («Размыт»)                          whole phrases in the actor's own voice)
 *   ④ Norwegian subtitles only («Скрыт»)                              ⑤ no subtitles at all
 * Opening a step sets the player's mode by itself (Subs.openStep), ≥ 85 % of the part played marks it done and unlocks
 * the next one. At the end «🎧 Проверка на слух»: 10 phrases in the actor's voice — choose or type the translation.
 * The deck of a part: the lines the player already has (cues + translations — the same queue and cache, js/subs.js),
 * the Kelly list (data/kelly.json via js/levels.js) for words of your level not in your cards yet, the sound of a line
 * (Subs.learnCtx().pcm — own file / Telegram / NRK; YouTube has none: «▶ посмотреть момент» plays the embed instead)
 * and a still frame where the browser allows reading the picture.
 *
 *   LearnBy.offer(material)  a gentle «Сделать колоду?» after ≥ 3 pages read (books, js/reader.js …): material = { kind: 'book',
 *                            key, title, sub?, page?, text(): string | Promise<string> — the text of the page now, open?(),
 *                            src?: 'reader' | 'textbook' | 'books' | 'news', id? — to open it again after a reload }
 *                            (js/reader.js, js/textbook.js, js/books.js, js/news.js call it)
 *   LearnBy.open(key)        the plan of a material (its id or the player's place id) in a window; no plan → the section
 *   LearnBy.attach(ctx)      the player calls it after every redraw (js/subs.js learnHook) — the bar, the step, the offer
 *   LearnBy.btnHtml(stream)  «🎓 Учить по этому видео / этой передаче» in the player
 *   LearnBy.continueItems() / progressList()   «▶ Продолжить» (js/continue.js) and «📈 Мой прогресс» (js/mypath.js)
 *   Views.learn             the section page (#/learn)
 * State: localStorage 'nk-learnby' (plans, offers); the actor's voice and stills: IndexedDB 'nk-learnby' (μ-law, ≤ 40 MB,
 * the least recently used materials go first). Event 'learnby-changed' on document.
 */
(function () {
  'use strict';
  const KEY = 'nk-learnby', DBN = 'nk-learnby', CLIP_CAP = 40e6, PART_MIN = 600, PART_MAX = 900, DONE = 0.85, BUCKET = 10;
  const OFFER_SEC = 12 * 60, OFFER_PAGES = 3, MAX_PLANS = 30, SR = 16000;
  const esc = s => (window.U && U.esc ? U.esc(s == null ? '' : String(s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
  const pl = (n, f) => (window.U && U.plural ? U.plural(n, f) : f[2]);
  const mss = s => { s = Math.max(0, Math.floor(+s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
  const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const low = s => String(s || '').toLowerCase();
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const emit = () => { try { document.dispatchEvent(new CustomEvent('learnby-changed')); } catch (e) { /* old browser */ } };
  const toast = (m, t, ms) => { if (window.UI && UI.toast) UI.toast(m, t || '', ms || 3500); };

  /* ---------------- words of the steps ---------------- */
  const KIND = {
    video: { ico: '🎬', name: 'Учить по видео', what: 'видео', btn: 'по этому видео', watch: 'Смотреть', seen: ['первый просмотр', 'второй просмотр', 'третий просмотр'] },
    audio: { ico: '📻', name: 'Учить по радио', what: 'передачу', btn: 'по этой передаче', watch: 'Слушать', seen: ['первое прослушивание', 'второе прослушивание', 'третье прослушивание'] },
    song: { ico: '🎵', name: 'Учить по песне', what: 'песню', btn: 'по этой песне', watch: 'Слушать', seen: ['первое прослушивание', 'второе прослушивание', 'третье прослушивание'] },
    book: { ico: '📖', name: 'Учить по книге', what: 'книгу', btn: 'по этой книге', watch: 'Читать', seen: ['чтение', 'перечитать', 'перечитать'] },
  };
  /** the five steps (a book: read · deck · check) */
  function steps(kind) {
    const K = KIND[kind] || KIND.video;
    if (kind === 'book') return [
      { n: 1, mode: null, t: 'Прочитать с переводом', short: 'чтение', sub: 'страницы, из которых сделана колода' },
      { n: 2, mode: null, t: 'Выучить слова и фразы', short: 'слова и фразы', sub: 'колода этих страниц' },
      { n: 3, mode: null, t: 'Проверка на слух', short: 'проверка на слух', sub: 'фразы из книги — голосом приложения' },
    ];
    const by = kind === 'video' ? 'голосом героев' : kind === 'song' ? 'голосом исполнителя' : 'голосом ведущих';
    return [
      { n: 1, mode: 'show', t: `${K.watch} с переводом`, short: K.seen[0], sub: 'перевод — под каждой строкой' },
      { n: 2, mode: null, t: 'Выучить слова и фразы', short: 'слова и фразы', sub: `нужные слова для вашего уровня и целые фразы ${by}` },
      { n: 3, mode: 'blur', t: `${kind === 'video' ? 'Второй просмотр' : 'Второе прослушивание'}: перевод размыт`, short: K.seen[1], sub: 'подсматривайте, только если не поняли' },
      { n: 4, mode: 'hide', t: 'Только норвежские субтитры', short: K.seen[2], sub: 'перевода нет, норвежский текст остаётся' },
      { n: 5, mode: 'off', t: 'Без субтитров', short: 'на слух', sub: kind === 'video' ? 'только картинка и звук' : 'только звук' },
    ];
  }
  const NUM = ['①', '②', '③', '④', '⑤'];

  /* ---------------- state ---------------- */
  let S = null;
  function load() {
    if (S) return S;
    try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { S = null; }
    if (!S || typeof S !== 'object' || !S.plans) S = { v: 1, plans: {}, no: {}, later: {}, seen: {}, pages: {} };
    ['no', 'later', 'seen', 'pages'].forEach(k => { if (!S[k] || typeof S[k] !== 'object') S[k] = {}; });
    return S;
  }
  let saveT = 0, full = false;
  function save(now) {
    clearTimeout(saveT);
    const go = () => {
      saveT = 0;
      const s = load();
      const ids = Object.keys(s.plans).sort((a, b) => (s.plans[b].at || 0) - (s.plans[a].at || 0));
      ids.slice(MAX_PLANS).forEach(id => delete s.plans[id]);
      ['seen', 'no', 'later', 'pages'].forEach(k => { const ks = Object.keys(s[k]); if (ks.length > 200) ks.slice(0, ks.length - 200).forEach(x => delete s[k][x]); });
      try { localStorage.setItem(KEY, JSON.stringify(s)); full = false; } catch (e) {
        if (!full) toast('На устройстве не хватает места — прогресс плана сохранится, когда место освободится', 'warn', 6000);
        full = true;
      }
      emit();
    };
    if (now) go(); else saveT = setTimeout(go, 1500);
  }
  window.addEventListener('pagehide', () => { if (saveT) save(true); });
  const plans = () => Object.values(load().plans).filter(p => p && p.id && Array.isArray(p.parts));
  const planOf = id => load().plans[id] || null;
  const plansFor = mkey => plans().filter(p => p.mkey === mkey);

  /** the share of a part's buckets covered in a step */
  const cov = (p, i, n) => { const x = p.parts[i] && p.parts[i].st && p.parts[i].st[n]; if (!x) return 0; if (x.done) return 1; const s = String(x.c || ''); return s ? (s.split('').filter(c => c === '1').length / s.length) : 0; };
  const stepDone = (p, i, n) => !!(p.parts[i] && p.parts[i].st && p.parts[i].st[n] && p.parts[i].st[n].done);
  function deckDone(p, i) {
    const part = p.parts[i]; if (!part || !part.deckId || !window.Store || !Store.deck(part.deckId)) return false;
    const cs = Store.cards(part.deckId); if (!cs.length) return false;
    const seen = cs.filter(c => ['nr', 'rn'].some(k => c.srs && c.srs[k] && c.srs[k].reps)).length;
    return seen / cs.length >= DONE;
  }
  /** refresh the deck step from the deck itself (studied elsewhere too) */
  function sync(p) {
    let ch = false;
    p.parts.forEach((part, i) => {
      if (part.deckId && window.Store && Store.deck && !Store.deck(part.deckId)) { part.deckId = ''; part.nw = 0; part.np = 0; ch = true; }
      if (!stepDone(p, i, 2) && deckDone(p, i)) { mark(p, i, 2); ch = true; }
    });
    if (ch) save();
    return p;
  }
  function mark(p, i, n) {
    const part = p.parts[i]; part.st = part.st || {};
    part.st[n] = Object.assign(part.st[n] || {}, { done: 1, at: Date.now() });
    p.at = Date.now();
  }
  /** the step a part is on: the first not done (all done → null) */
  function nextStep(p, i) { const n = steps(p.kind).find(s => !stepDone(p, i, s.n)); return n ? n.n : null; }
  const unlocked = (p, i, n) => n === 1 || stepDone(p, i, n - 1) || stepDone(p, i, n);
  function planPct(p) {
    const ns = steps(p.kind).length; let d = 0;
    p.parts.forEach((part, i) => steps(p.kind).forEach(s => { d += stepDone(p, i, s.n) ? 1 : s.mode ? Math.min(0.99, cov(p, i, s.n)) : 0; }));
    return p.parts.length ? d / (p.parts.length * ns) : 0;
  }
  /** where to go on: { part, step } */
  function cursor(p) {
    const c = p.cur && p.parts[p.cur.part] ? p.cur : null;
    if (c && !stepDone(p, c.part, c.step)) return c;
    for (let i = c ? c.part : 0; i < p.parts.length; i++) { const n = nextStep(p, i); if (n) return { part: i, step: n }; }
    for (let i = 0; i < p.parts.length; i++) { const n = nextStep(p, i); if (n) return { part: i, step: n }; }
    return null;
  }

  /* ---------------- 💾 the actor's voice and stills (IndexedDB) ---------------- */
  let dbP = null;
  function db() {
    if (dbP) return dbP;
    dbP = new Promise((res, rej) => {
      let r; try { r = indexedDB.open(DBN, 1); } catch (e) { rej(e); return; }
      r.onupgradeneeded = () => { const d = r.result; ['clip', 'deck'].forEach(n => { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); }); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    dbP.catch(() => { dbP = null; });
    return dbP;
  }
  async function idb(store, mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const tx = d.transaction(store, mode), os = tx.objectStore(store);
      let out; try { out = fn(os); } catch (e) { rej(e); return; }
      tx.oncomplete = () => res(out && 'result' in out ? out.result : out); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('abort'));
    });
  }
  const iget = (st, k) => idb(st, 'readonly', os => os.get(k)).catch(() => null);
  const iput = (st, k, v) => idb(st, 'readwrite', os => { os.put(v, k); });
  const idelPrefix = (st, pre) => idb(st, 'readwrite', os => { os.delete(IDBKeyRange.bound(pre, pre + '￿')); }).catch(() => {});
  const isQuota = e => !!e && (e.name === 'QuotaExceededError' || /quota|space|full/i.test(String(e.message || '')));
  /** μ-law (G.711): half the size of 16-bit sound, fine for a voice */
  function mulaw(f) {
    const out = new Uint8Array(f.length);
    for (let i = 0; i < f.length; i++) {
      let s = Math.max(-1, Math.min(1, f[i])) * 32635, sign = 0;
      if (s < 0) { s = -s; sign = 0x80; }
      s += 132; let e = 7; for (let m = 0x4000; (s & m) === 0 && e > 0; e--, m >>= 1);
      out[i] = ~(sign | (e << 4) | ((s >> (e + 3)) & 0x0f)) & 0xff;
    }
    return out;
  }
  function unmulaw(u) {
    const f = new Int16Array(u.length);
    for (let i = 0; i < u.length; i++) {
      const x = ~u[i] & 0xff, sign = x & 0x80, e = (x >> 4) & 7, m = x & 0x0f;
      let s = ((m << 3) + 132) << e; s -= 132;
      f[i] = sign ? -s : s;
    }
    return f;
  }
  function wav16(i16, rate) {
    const b = new ArrayBuffer(44 + i16.length * 2), v = new DataView(b);
    const w = (o, s) => { for (let k = 0; k < s.length; k++) v.setUint8(o + k, s.charCodeAt(k)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + i16.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, i16.length * 2, true);
    new Int16Array(b, 44).set(i16);
    return new Blob([b], { type: 'audio/wav' });
  }
  /** loudness evened, soft edges; null when it is silence */
  function polish(f) {
    let peak = 0; for (let i = 0; i < f.length; i++) peak = Math.max(peak, Math.abs(f[i]));
    if (peak < 0.004) return null;
    const g = Math.min(4, 0.89 / peak), fade = Math.min(Math.round(SR * 0.012), f.length >> 2), o = new Float32Array(f.length);
    for (let i = 0; i < f.length; i++) o[i] = f[i] * g * (fade ? Math.max(0, Math.min(1, i / fade, (f.length - 1 - i) / fade)) : 1);
    return o;
  }
  const toI16 = f => { const o = new Int16Array(f.length); for (let i = 0; i < f.length; i++) o[i] = Math.max(-1, Math.min(1, f[i])) * 0x7fff; return o; };
  const clipBytes = () => { const m = load().bytes || {}; return Object.values(m).reduce((a, x) => a + (+x.b || 0), 0); };
  async function putClip(planId, k, f) {
    const u = mulaw(f);
    await iput('clip', `${planId}|${k}`, { u: new Blob([u]), r: SR, at: Date.now() });
    const s = load(); s.bytes = s.bytes || {};
    s.bytes[planId] = { b: (+(s.bytes[planId] || {}).b || 0) + u.length, at: Date.now() };
    await cleanup(planId);
  }
  /** over the cap: the voices of the materials not opened for the longest time go first */
  async function cleanup(keep) {
    const s = load(); s.bytes = s.bytes || {};
    Object.keys(s.bytes).forEach(id => { if (!s.plans[id]) { idelPrefix('clip', id + '|'); delete s.bytes[id]; } });
    let total = clipBytes();
    const old = Object.keys(s.bytes).filter(id => id !== keep).sort((a, b) => ((s.plans[a] || {}).at || 0) - ((s.plans[b] || {}).at || 0));
    while (total > CLIP_CAP && old.length) {
      const id = old.shift(); total -= +s.bytes[id].b || 0;
      await idelPrefix('clip', id + '|'); delete s.bytes[id];
      if (s.plans[id]) s.plans[id].voiceGone = 1;
    }
    save();
  }
  const urls = new Map();
  /** a playable address of a stored voice ('' when there is none) */
  async function clipUrl(planId, k) {
    const id = `${planId}|${k}`;
    if (urls.has(id)) return urls.get(id);
    const r = await iget('clip', id);
    if (!r || !r.u) return '';
    const u = new Uint8Array(await r.u.arrayBuffer());
    const url = URL.createObjectURL(wav16(unmulaw(u), r.r || SR));
    urls.set(id, url);
    return url;
  }
  async function wavDataUrl(f) {
    const blob = wav16(toI16(f), SR);
    return window.U && U.blobToDataURL ? U.blobToDataURL(blob) : new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
  }

  /* ---------------- 🔪 parts at natural pauses ---------------- */
  /** lines (player time) + the length → [{ a, b }] of ~10–15 min, cut in the longest pause near each mark */
  function split(lines, dur) {
    const L = lines.filter(l => l.b > l.a).sort((x, y) => x.a - y.a);
    const end = Math.max(dur || 0, L.length ? L[L.length - 1].b + 1 : 0);
    if (!(end > 0)) return [];
    const n = end <= PART_MAX + 180 ? 1 : Math.max(2, Math.round(end / ((PART_MIN + PART_MAX) / 2)));
    const cuts = [];
    for (let k = 1; k < n; k++) {
      const mark = end * k / n, lo = mark - 150, hi = mark + 150;
      let best = null;
      for (let i = 0; i + 1 < L.length; i++) {
        const g0 = L[i].b, g1 = L[i + 1].a, mid = (g0 + g1) / 2;
        if (mid < lo || mid > hi || (cuts.length && mid <= cuts[cuts.length - 1] + 120)) continue;
        const gap = g1 - g0 - Math.abs(mid - mark) / 150; // a long pause, near the mark
        if (!best || gap > best.gap) best = { gap, t: mid };
      }
      cuts.push(best ? best.t : mark);
    }
    const out = []; let a = 0;
    cuts.concat([end]).forEach(b => { out.push({ a: Math.round(a * 10) / 10, b: Math.round(b * 10) / 10 }); a = b; });
    return out;
  }

  /* ---------------- 📚 words for the user's level ---------------- */
  const LV = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const ENDS = ['ene', 'ane', 'ende', 'en', 'et', 'er', 'ere', 'est', 'ede', 'te', 'de', 'a', 'r', 'e', 's', 't', 'ne'];
  const FUNC = new Set(['conj', 'prep', 'pron', 'det', 'interj', 'num', 'subj', 'inf']);
  const VERBY = new Set(['er', 'r', 'te', 'de', 'ede', 'et', 't']);
  const CONTENT = /^(n|v|adj)$/;
  function knownSet() {
    const k = new Set();
    try {
      Store.cards().forEach(c => String(c.no || '').split('\n')[0].toLowerCase().split(/[,/;]/).forEach(x => {
        x = x.trim().replace(/^(en|ei|et|å)\s+/, ''); if (x) k.add(x);
      }));
    } catch (e) { /* no cards */ }
    return k;
  }
  function lemma(tok, idx) {
    if (idx.has(tok)) return idx.get(tok);
    for (const e of ENDS) {
      if (tok.length - e.length < 2 || !tok.endsWith(e)) continue;
      const s = tok.slice(0, -e.length);
      // «leker», «ringte», «vært»: a verb first (leke, ringe, være), then the noun (lek, ring, vær)
      const cs = VERBY.has(e) ? [s + 'e', s, s + 'en', s.replace(/(.)\1$/, '$1')] : [s, s + 'e', s + 'en', s.replace(/(.)\1$/, '$1')];
      for (const c of cs) if (idx.has(c)) return idx.get(c);
    }
    return null;
  }
  const userLevel = () => { try { const L = window.Levels && Levels.currentLevel ? Levels.currentLevel() : ''; return LV.includes(L) ? L : 'A2'; } catch (e) { return 'A2'; } };
  async function kelly() { if (!(window.Levels && Levels.load)) return null; try { return await Levels.load(); } catch (e) { return null; } }
  /** the most useful words of these lines: [{ w, rank, level, pos, en, n, line }] */
  function pickWords(K, lines, want) {
    const known = knownSet(), L = userLevel(), li = LV.indexOf(L), seen = new Map();
    lines.forEach(l => {
      if (!l.t || l.skip) return;
      const toks = String(l.t).match(/\p{L}+(?:-\p{L}+)?/gu) || [];
      toks.forEach((raw, j) => {
        if (j > 0 && /^\p{Lu}/u.test(raw)) return; // a name
        const tok = low(raw); if (tok.length < 3) return;
        const x = lemma(tok, K.idx); if (!x) return;
        const w = low(x.w), pos = String(x.pos || '').split(',')[0].trim();
        if (known.has(w) || FUNC.has(pos) || (x.rank < 300 && !CONTENT.test(pos))) return; // «ikke», «her», «når»: too common to be worth a card
        const d = LV.indexOf(x.level) - li;
        if (d > 2) return;
        let e = seen.get(w);
        if (!e) { e = { w: x.w, rank: x.rank, level: x.level, pos, en: x.en, n: 0, d, lines: [] }; seen.set(w, e); }
        e.n++; if (e.lines.length < 4) e.lines.push(l);
      });
    });
    const score = e => e.n * (e.d === 0 ? 3 : e.d === 1 ? 2.6 : e.d < 0 ? 1.4 : 1) + (e.d <= 1 ? Math.max(0, 1 - e.rank / 6000) : 0);
    return [...seen.values()].sort((a, b) => score(b) - score(a)).slice(0, want).map(e => {
      const ln = e.lines.filter(l => l.ru).sort((a, b) => a.t.length - b.t.length)[0] || e.lines[0];
      return Object.assign(e, { line: ln });
    });
  }
  const kQ = x => (x.pos === 'v' ? 'å ' + x.w : x.w);
  async function wordRu(words) {
    let c = {}; try { c = JSON.parse(localStorage.getItem('nk-kelly-ru') || '{}') || {}; } catch (e) { c = {}; }
    words.forEach(x => { if (c[x.w] && c[x.w][0]) { x.ru = c[x.w][0]; x.by = c[x.w][1]; } });
    const need = words.filter(x => !x.ru);
    if (need.length && window.Translators && Translators.translateMany) {
      try {
        const r = await Translators.translateMany(need.map(kQ), 'no', 'ru', { quiet: true, noAI: true });
        need.forEach((x, j) => { const t = String((r.out || [])[j] || '').trim().replace(/^(чтобы|к)\s+/i, ''); if (t && (!U.cyrRatio || U.cyrRatio(t) > 0.5) && low(t) !== low(x.w)) { x.ru = t; x.by = 'tr:' + ((r.by || [])[0] || 'google'); } });
      } catch (e) { /* the words stay without a card */ }
    }
    return words.filter(x => x.ru);
  }
  /** whole phrases: a line with a translation, 3–14 words, said in 0.8–8 s, near the chosen words, spread over the part */
  function pickPhrases(lines, words, max, song) {
    const W = new Set(words.map(x => low(x.w)));
    const cand = lines.filter(l => l.ru && !l.skip && !l.frame && (song ? l.song : true) && l.b - l.a >= 0.8 && l.b - l.a <= 8).map(l => {
      const toks = (String(l.t).match(/\p{L}+/gu) || []).map(low), wc = toks.length;
      if (wc < 3 || wc > 14) return null;
      const hit = toks.filter(t => W.has(t) || [...W].some(w => t.startsWith(w) && t.length - w.length <= 3)).length;
      return { l, s: hit * 2 + (wc >= 5 && wc <= 10 ? 2 : 0) - (l.auto ? 0.5 : 0) - (l.song && !song ? 3 : 0) };
    }).filter(Boolean).sort((a, b) => b.s - a.s);
    const out = [], seenT = new Set();
    for (const c of cand) {
      if (out.length >= max) break;
      const k = low(c.l.t).replace(/[^\p{L} ]/gu, '');
      if (seenT.has(k) || out.some(o => Math.abs(o.a - c.l.a) < (song ? 2 : 20))) continue;
      seenT.add(k); out.push(c.l);
    }
    return out.sort((a, b) => a.a - b.a);
  }

  /* ---------------- 🖼 a still frame (only where the browser lets us read the picture) ---------------- */
  function grab(v) {
    if (!v || !v.videoWidth || v.readyState < 2) return '';
    const w = 192, h = Math.round(w * v.videoHeight / v.videoWidth) || 108;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    try { c.getContext('2d').drawImage(v, 0, 0, w, h); return c.toDataURL('image/jpeg', 0.72); } catch (e) { return ''; } // tainted: someone else's picture
  }
  async function stills(src, times) {
    if (!src || !times.length) return [];
    const v = document.createElement('video'); v.muted = true; v.preload = 'auto'; v.playsInline = true; v.src = src;
    const out = [];
    try {
      await new Promise((res, rej) => { v.addEventListener('loadeddata', res, { once: true }); v.addEventListener('error', rej, { once: true }); setTimeout(rej, 8000); });
      for (const t of times) {
        await new Promise(res => { const ok = () => { v.removeEventListener('seeked', ok); res(); }; v.addEventListener('seeked', ok); try { v.currentTime = t; } catch (e) { res(); } setTimeout(ok, 3000); });
        const d = grab(v); if (!d && out.length === 0) break; // tainted or no picture: stop at once
        out.push(d);
      }
    } catch (e) { /* no stills */ }
    v.removeAttribute('src'); try { v.load(); } catch (e) { /* ignore */ }
    return out;
  }

  /* ---------------- the player (the context js/subs.js gives) ---------------- */
  let ctx = null, tickT = 0, active = null, building = null, offerShown = new Set(), moment = null;
  const playerOn = key => !!(ctx && ctx.alive() && (!key || ctx.key === key));
  /** the material of the open player, as a plan needs it */
  function materialOf(c) {
    const S0 = c.stream || {}, file = !c.stream;
    const src = file ? 'file' : S0.kind === 'youtube' ? 'yt' : S0.kind === 'tg' ? 'tg' : S0.radio ? 'nrkr' : 'nrk';
    let open = null; try { open = (JSON.parse(localStorage.getItem('nk-cont-open') || '{}') || {})[c.key] || null; } catch (e) { open = null; }
    const o = { src, id: S0.id != null ? String(S0.id) : '', title: c.title, sub: c.channel || '', file: c.file ? c.file.name : '' };
    if (src === 'tg') o.tg = { video: S0.video || '', pcm: S0.pcm || '', poster: S0.poster || '', duration: +S0.duration || 0, link: String(S0.link || '').slice(0, 300), author: String(S0.author || '').slice(0, 80), date: S0.date || '', audio: !!S0.audio, mp3: S0.mp3 || '' };
    if (src === 'nrkr' && open && open.ro) o.ro = open.ro;
    const img = c.poster || (src === 'yt' ? `https://i.ytimg.com/vi/${encodeURIComponent(o.id)}/mqdefault.jpg` : (open && open.img) || '');
    return { open: o, img: /^https:\/\//.test(img) ? img.slice(0, 600) : '' };
  }
  function newPlan(c, kind, range) {
    const lines = c.lines(), dur = c.dur() || (lines.length ? lines[lines.length - 1].b + 2 : 0);
    const m = materialOf(c);
    const id = range ? `${c.key}#song@${Math.round(range.a)}` : c.key;
    const parts = range ? [{ a: Math.max(0, range.a - 1.5), b: range.b + 1.5 }] : split(lines, dur);
    if (!parts.length) return null;
    const p = { id, mkey: c.key, kind, title: String(range && range.title ? range.title : c.title || 'Без названия').slice(0, 140), sub: String(c.channel || '').slice(0, 100), img: m.img, open: m.open, dur,
      created: Date.now(), at: Date.now(), parts: parts.map(x => ({ a: x.a, b: x.b, st: {} })), cur: { part: 0, step: 1 }, yt: !!c.youtube };
    load().plans[id] = p; delete load().no[c.key]; save();
    return p;
  }
  /** the longest sung stretch of the open player → { a, b, title } */
  function songRange(c) {
    const L = c.lines().filter(l => l.song && !l.en && /\p{L}/u.test(l.t)).sort((x, y) => x.a - y.a);
    if (L.length < 3) return null;
    const groups = []; let g = null;
    L.forEach(l => { if (!g || l.a - g.b > 15) { g = { a: l.a, b: l.b, n: 0 }; groups.push(g); } g.b = Math.max(g.b, l.b); g.n++; });
    const best = groups.sort((x, y) => y.n - x.n)[0];
    return best && best.n >= 3 ? { a: best.a, b: best.b, title: `Песня из «${c.title}»` } : null;
  }

  /* ---- the bar in the player ---- */
  function barHtml() {
    if (!ctx) return '';
    if (building && building.key === ctx.key) return `<div class="lb-pbar is-busy" role="status"><span class="lb-pb-i" aria-hidden="true">🎓</span><span class="lb-pb-t"><b>Собираю колоду части ${building.part + 1}</b><small data-lb-prog>${esc(building.msg || 'слова и фразы…')}</small></span></div>`;
    if (active && active.key === ctx.key) {
      const p = planOf(active.plan); if (!p) return '';
      const s = steps(p.kind).find(x => x.n === active.step) || {};
      const pc = Math.round(cov(p, active.part, active.step) * 100);
      return `<div class="lb-pbar" data-lb-bar><span class="lb-pb-i" aria-hidden="true">🎓</span>
        <span class="lb-pb-t"><b>${esc(p.title)} · часть ${active.part + 1} · ${esc(s.short || '')}</b><small><span data-lb-pct>${pc}</span> % части · ${esc(s.sub || '')}</small></span>
        <button type="button" class="btn sm ghost" data-lb="plan" title="План: все части и шаги">План</button>
        <button type="button" class="icon-btn sm lb-pb-x" data-lb="leave" title="Выйти из шага — обычный просмотр" aria-label="Выйти из шага, обычный просмотр">✕</button></div>`;
    }
    return '';
  }
  function paintBar() {
    if (!playerOn()) return;
    const el = ctx.el; let bar = el.querySelector('[data-lb-host]');
    const html = barHtml() + offerHtml();
    if (!html) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement('div'); bar.dataset.lbHost = '1'; bar.className = 'lb-host';
      const after = el.querySelector('.subs-src') || el.querySelector('.subs-ctrl');
      if (after && after.parentNode) after.parentNode.insertBefore(bar, after.nextSibling); else { const b = el.querySelector('.modal-body'); if (b) b.prepend(bar); }
    }
    if (bar._h !== html) { bar.innerHTML = html; bar._h = html; }
  }
  /* ---- the gentle offer (once per material) ---- */
  let offerNow = null;
  function offerHtml() {
    if (!offerNow || !ctx || offerNow.key !== ctx.key) return '';
    const n = offerNow.n;
    return `<div class="lb-offer" role="region" aria-label="Предложение: колода из этого материала"><span class="lb-pb-i" aria-hidden="true">🎓</span>
      <span class="lb-pb-t"><b>Сделать колоду из ${ctx.kind === 'audio' ? 'этой передачи' : 'этого видео'}?</b><small>${n ? `≈ ${n} ${pl(n, ['нужное слово и фраза', 'нужных слова и фразы', 'нужных слов и фраз'])} для вашего уровня — ` : ''}по частям, с голосом ${ctx.kind === 'audio' ? 'ведущих' : 'героев'}</small></span>
      <span class="lb-offer-acts"><button type="button" class="btn sm primary" data-lb="offer-yes">Сделать</button><button type="button" class="btn sm ghost" data-lb="offer-later">Позже</button><button type="button" class="btn sm ghost" data-lb="offer-no">Не предлагать для этого</button></span></div>`;
  }
  async function estimate(c) {
    const K = await kelly(); if (!K) return 0;
    const lines = c.lines(), parts = split(lines, c.dur());
    let n = 0;
    parts.forEach(pt => { const ls = lines.filter(l => l.a >= pt.a && l.a < pt.b); n += pickWords(K, ls, 25).length + Math.min(10, ls.filter(l => l.ru && (String(l.t).match(/\p{L}+/gu) || []).length >= 3).length); });
    return n;
  }
  function maybeOffer(c, sec) {
    const s = load();
    if (offerNow || offerShown.has(c.key) || s.no[c.key] || plansFor(c.key).length || +s.later[c.key] > Date.now()) return;
    if (sec < OFFER_SEC || c.lines().length < 20) return;
    offerShown.add(c.key);
    estimate(c).then(n => { if (!playerOn(c.key)) return; offerNow = { key: c.key, n }; paintBar(); }).catch(() => {});
  }

  /* ---- the 1-second watch ---- */
  function tick() {
    if (!ctx || !ctx.alive()) { stop(); return; }
    const v = ctx.media(); if (!v) return;
    const t = +v.currentTime || 0, playing = !v.paused && !v.ended;
    const s = load();
    if (playing) { s.seen[ctx.key] = (+s.seen[ctx.key] || 0) + 1; if (s.seen[ctx.key] % 15 === 0) save(); maybeOffer(ctx, s.seen[ctx.key]); }
    // ▶ «посмотреть момент»: stop at its end
    if (moment && moment.key === ctx.key && (t >= moment.b || t < moment.a - 2)) { if (t >= moment.b) { try { v.pause(); } catch (e) { /* ignore */ } } moment = null; }
    if (!active || active.key !== ctx.key) return;
    const p = planOf(active.plan); if (!p) { active = null; paintBar(); return; }
    const w = ctx.step();
    if (!w) { active = null; paintBar(); return; } // the person left the step (✕) or the mode was changed
    // the first seconds: to the part's place (the player opened at its own place)
    if (active.seekTo != null) {
      if (v.readyState >= 1 || ctx.youtube) {
        if (Math.abs(t - active.seekTo) > 3) { try { v.currentTime = active.seekTo; } catch (e) { /* not yet */ } active.seekTries = (active.seekTries || 0) + 1; if (active.seekTries > 8) active.seekTo = null; }
        else active.seekTo = null;
      }
      return;
    }
    const part = p.parts[active.part]; if (!part) return;
    part.st = part.st || {};
    const x = part.st[active.step] = part.st[active.step] || {};
    const nb = Math.max(1, Math.ceil((part.b - part.a) / BUCKET));
    if (!x.c || x.c.length !== nb) x.c = '0'.repeat(nb);
    if (playing && t >= part.a && t < part.b) {
      const k = clamp(Math.floor((t - part.a) / BUCKET), 0, nb - 1);
      if (x.c[k] !== '1') x.c = x.c.slice(0, k) + '1' + x.c.slice(k + 1);
      p.pos = t; p.cur = { part: active.part, step: active.step }; p.at = Date.now();
      if (Date.now() - (active.savedAt || 0) > 3000) { active.savedAt = Date.now(); save(); }
      const pc = ctx.el.querySelector('[data-lb-pct]'); if (pc) pc.textContent = Math.round(cov(p, active.part, active.step) * 100);
      thumbNow(p, active.part, v, t);
    }
    if (!x.done && cov(p, active.part, active.step) >= DONE) { mark(p, active.part, active.step); save(true); stepDoneToast(p, active.part, active.step); }
    if (t >= part.b - 0.3 && !active.endShown && playing) {
      active.endShown = true;
      try { v.pause(); } catch (e) { /* ignore */ }
      partEnd(p, active.part, active.step);
    }
  }
  function stop() { clearInterval(tickT); tickT = 0; if (ctx && !ctx.alive()) { ctx = null; active = null; offerNow = null; moment = null; } }
  /** a still of a phrase from the playing picture (NRK allows it; YouTube does not) */
  async function thumbNow(p, i, v, t) {
    if (p.yt || p.noFrames || ctx.kind !== 'video' || !p.parts[i].deckId || thumbNow.busy) return;
    const d = await iget('deck', p.id + '|' + i); if (!d || !d.phrases) return;
    const ph = d.phrases.find(x => !x.img && t >= x.a + 0.2 && t <= x.b);
    if (!ph) return;
    thumbNow.busy = true;
    try {
      const img = grab(v);
      if (!img) { p.noFrames = 1; return; }
      ph.img = img; await iput('deck', p.id + '|' + i, d).catch(() => {});
      if (ph.card && window.Store && Store.card(ph.card) && !Store.card(ph.card).image) Store.updateCard(ph.card, { image: img });
    } finally { thumbNow.busy = false; }
  }
  function stepDoneToast(p, i, n) {
    const nx = nextStep(p, i), S1 = steps(p.kind);
    const lbl = nx ? (S1.find(s => s.n === nx) || {}).t : i + 1 < p.parts.length ? `часть ${i + 2}` : '';
    const done = `✓ Часть ${i + 1}: «${(S1.find(s => s.n === n) || {}).short}» — готово`;
    if (lbl && window.UI && UI.toastAction) UI.toastAction(`${done}. Дальше — ${low(lbl)}`, 'Дальше', () => go(p.id, nx ? i : i + 1, nx || 1), 9000, '🎓');
    else toast(done + (p.parts.every((x, k) => !nextStep(p, k)) ? '. Весь материал пройден — попробуйте «Проверку на слух»' : ''), 'good', 6000);
    paintBar();
  }
  function partEnd(p, i, n) {
    if (!playerOn()) return;
    const host = ctx.el.querySelector('[data-lb-host]'); if (!host) return;
    const done = stepDone(p, i, n), nx = nextStep(p, i);
    const S1 = steps(p.kind);
    const el = document.createElement('div'); el.className = 'lb-end'; el.setAttribute('role', 'status');
    el.innerHTML = `<span class="lb-pb-i" aria-hidden="true">${done ? '✅' : '⏸'}</span><span class="lb-pb-t"><b>Часть ${i + 1} закончилась</b><small>${done ? 'шаг засчитан' : `пройдено ${Math.round(cov(p, i, n) * 100)} % — для шага нужно 85 %, можно вернуться и досмотреть`}</small></span>
      <span class="lb-offer-acts">${nx ? `<button type="button" class="btn sm primary" data-lb="go" data-p="${i}" data-s="${nx}">${NUM[nx - 1]} ${esc(S1.find(s => s.n === nx).t)}</button>` : i + 1 < p.parts.length ? `<button type="button" class="btn sm primary" data-lb="go" data-p="${i + 1}" data-s="1">Часть ${i + 2} →</button>` : ''}
      <button type="button" class="btn sm ghost" data-lb="on">Смотреть дальше</button></span>`;
    host.appendChild(el);
  }

  /* ---------------- 🧱 the deck of a part ---------------- */
  async function build(p, i) {
    if (!playerOn(p.mkey)) throw Object.assign(new Error('player'), { user: 'Откройте этот материал в плеере — колода собирается из его строк' });
    if (building) throw Object.assign(new Error('busy'), { user: 'Уже собираю другую колоду — подождите немного' });
    const part = p.parts[i], c = ctx;
    building = { key: c.key, plan: p.id, part: i, msg: 'читаю строки этой части…' };
    const prog = m => { building.msg = m; const e = c.el.querySelector('[data-lb-prog]'); if (e) e.textContent = m; else paintBar(); const e2 = document.querySelector('[data-lb-build-msg]'); if (e2) e2.textContent = m; };
    paintBar();
    try {
      let lines = c.lines().filter(l => l.a >= part.a - 0.5 && l.a < part.b && /\p{L}/u.test(l.t) && !l.skip && !l.en);
      if (p.kind === 'song') lines = lines.filter(l => l.song);
      if (lines.length < 3) throw Object.assign(new Error('nolines'), { user: c.kind === 'audio' || !lines.length ? 'В этой части пока нет текста. Включите «🤖 Создать субтитры» и прослушайте её — колода соберётся из распознанных строк' : 'В этой части слишком мало строк для колоды' });
      const miss = lines.filter(l => l.ru === undefined).map(l => l.i);
      if (miss.length) { prog(`перевожу ${miss.length} ${pl(miss.length, ['строку', 'строки', 'строк'])}…`); try { await c.translate(miss); } catch (e) { /* what is there */ } }
      if (!c.alive()) throw Object.assign(new Error('closed'), { user: 'Плеер закрыли — колода не собрана' });
      lines = lines.map(l => Object.assign({}, l, { ru: c.tr(l.i) }));
      prog('выбираю слова для вашего уровня…');
      const K = await kelly();
      const want = clamp(Math.round(14 + lines.length / 12), 15, 25);
      let words = K ? pickWords(K, lines, want + 6) : [];
      if (words.length) { prog(`перевожу ${words.length} ${pl(words.length, ['слово', 'слова', 'слов'])}…`); words = (await wordRu(words)).slice(0, want); }
      const phrases = pickPhrases(lines, words, p.kind === 'song' ? 12 : 10, p.kind === 'song');
      if (!words.length && !phrases.length) throw Object.assign(new Error('empty'), { user: 'Здесь не нашлось новых слов для вашего уровня — все они уже есть в ваших карточках' });
      // 🎙 the actor's voice
      const voice = [];
      let quota = false, noVoice = c.youtube;
      for (let k = 0; k < phrases.length && !noVoice; k++) {
        prog(`вырезаю голос: фраза ${k + 1} из ${phrases.length}…`);
        const l = phrases[k];
        try {
          let f = await c.pcm(Math.max(0, l.a - 0.15), l.b + 0.3);
          if (!f) { noVoice = true; break; }
          f = polish(f.length > SR * 8 ? f.subarray(0, SR * 8) : f);
          if (!f) { voice[k] = null; continue; }
          try { await putClip(p.id, `${i}|${k}`, f); } catch (e) { if (isQuota(e)) quota = true; }
          voice[k] = await wavDataUrl(f);
        } catch (e) { voice[k] = null; if (e && /stopped/.test(e.message || '')) break; }
        if (!c.alive()) break;
      }
      // 🖼 stills (own file, Telegram video)
      let imgs = [];
      const fs = c.frameSrc ? c.frameSrc() : '';
      if (fs && !p.noFrames) { prog('делаю кадры к фразам…'); imgs = await stills(fs, phrases.map(l => (l.a + l.b) / 2)); if (!imgs.length) p.noFrames = 1; }
      // 🗂 the deck
      prog('кладу карточки в колоду…');
      const K1 = KIND[p.kind] || KIND.video;
      const name = `🎓 ${p.title.length > 50 ? p.title.slice(0, 49) + '…' : p.title}${p.parts.length > 1 ? ` · часть ${i + 1}` : ''}`;
      let d = part.deckId && Store.deck(part.deckId);
      if (!d) { d = Store.addDeck(name, `${K1.name}: «${p.title}»${p.sub ? ' · ' + p.sub : ''}${p.parts.length > 1 ? ` · часть ${i + 1} из ${p.parts.length} (${mss(part.a)}–${mss(part.b)})` : ''} — слова для вашего уровня и целые фразы`); Store.updateDeck(d.id, { learnBy: p.id }); }
      const have = new Set(Store.cards(d.id).map(x => low(String(x.no).split('\n')[0])));
      const where = t => `из «${p.title}»${p.parts.length > 1 ? `, часть ${i + 1}` : ''}, ${mss(t)}`;
      const prov = note => (window.Prov ? [Prov.entry('import', 'create', null, note)] : []);
      const wOut = [], pOut = [];
      words.forEach(x => {
        const no = kQ(x);
        const item = { no, ru: x.ru, level: x.level, a: x.line ? x.line.a : 0, ex: x.line ? x.line.t : '', exRu: x.line ? x.line.ru || '' : '' };
        if (!have.has(low(no))) {
          const cd = Store.addCard(d.id, { no, ru: x.ru, example: item.ex, exampleRu: item.exRu, description: where(item.a), tags: ['learnby', 'word', x.level],
            history: prov(`«Учить по материалам»: слово уровня ${x.level} ${where(item.a)}`), mtWarn: window.Translators && Translators.mtFlag ? Translators.mtFlag([String(x.by || '').replace(/^tr:/, '')]) : null });
          item.card = cd && cd.id; have.add(low(no));
        }
        wOut.push(item);
      });
      phrases.forEach((l, k) => {
        const item = { no: l.t, ru: l.ru || '', a: l.a, b: l.b, v: voice[k] ? 1 : 0, img: imgs[k] || '', song: !!l.song };
        if (!have.has(low(l.t)) && l.ru) {
          const data = { no: l.t, ru: l.ru, description: where(l.a), tags: ['learnby', 'phrase'].concat(l.auto ? ['проверить'] : []), history: prov(`«Учить по материалам»: фраза ${where(l.a)}${voice[k] ? ' — с голосом из записи' : ''}`) };
          if (voice[k]) { data.audio = voice[k]; data.audioText = l.t; data.audioSrc = { file: p.title, start: +l.a.toFixed(2), end: +l.b.toFixed(2) }; }
          if (imgs[k]) data.image = imgs[k];
          const cd = Store.addCard(d.id, data);
          item.card = cd && cd.id; have.add(low(l.t));
        }
        pOut.push(item);
      });
      try { await iput('deck', `${p.id}|${i}`, { words: wOut, phrases: pOut, at: Date.now() }); } catch (e) { if (isQuota(e)) quota = true; }
      part.deckId = d.id; part.nw = wOut.length; part.np = pOut.length; part.voice = pOut.filter(x => x.v).length;
      p.at = Date.now(); save(true);
      if (quota) toast('На устройстве заканчивается место — голос актёра сохранён не для всех фраз. Карточки готовы, недостающие фразы прочитает голос приложения', 'warn', 8000);
      return { deck: d, words: wOut.length, phrases: pOut.length, voice: part.voice, noVoice };
    } finally { building = null; paintBar(); }
  }
  async function buildAndTell(p, i, then) {
    try {
      const r = await build(p, i);
      const msg = `Колода части ${i + 1} готова: ${r.words} ${pl(r.words, ['слово', 'слова', 'слов'])} и ${r.phrases} ${pl(r.phrases, ['фраза', 'фразы', 'фраз'])}${r.voice ? ` (${r.voice} — голосом из записи)` : r.noVoice && p.yt ? ' (у YouTube голос взять нельзя — фразы озвучит приложение, а момент можно посмотреть)' : ''}`;
      if (then) then(r);
      if (window.UI && UI.toastAction) UI.toastAction(msg, 'Учить', () => studyPart(p.id, i), 12000, '🎓'); else toast(msg, 'good', 6000);
      return r;
    } catch (e) {
      toast(e.user || 'Колоду собрать не удалось — попробуйте ещё раз', 'warn', 7000);
      if (!e.user) console.warn('learnby build', e);
      return null;
    }
  }

  /* ---------------- going to a step ---------------- */
  function closeModals() { document.querySelectorAll('#modal-root .lb-modal').forEach(m => { const bd = m.closest('.modal-backdrop'); if (bd && bd._m) bd._m.close(); }); }
  function studyPart(id, i) {
    const p = planOf(id); if (!p) return;
    const part = p.parts[i];
    if (!part || !part.deckId || !Store.deck(part.deckId)) { go(id, i, 2); return; }
    p.cur = { part: i, step: 2 }; p.at = Date.now(); save(true);
    closeModals();
    if (window.Subs && Subs.isOpen && Subs.isOpen()) Subs.close();
    setTimeout(() => { if (window.Study && Study.start) Study.start({ deckId: part.deckId, filter: 'all' }); else App.go('deck', { id: part.deckId }); }, 60);
  }
  /** open a material's player (the same openers as «▶ Продолжить») */
  function openMaterial(p, at) {
    const o = p.open || {}, title = p.title, sub = p.sub;
    // the player's own «Продолжить?» answers by itself with the part's place (a saved place is never forgotten here)
    try { if (window.Resume && Resume.prefer) Resume.prefer('media', p.mkey, +at || 0); } catch (e) { /* ignore */ }
    if (o.src === 'yt' && window.YouTube) return YouTube.watch(o.id, title, sub === 'YouTube' ? '' : sub);
    if (o.src === 'nrk' && window.NrkTV) return NrkTV.watch(o.id, title, sub && sub !== 'NRK TV' ? sub : '');
    if (o.src === 'nrkr' && window.NrkRadio) { if (o.ro) return NrkRadio.play(o.ro); NrkRadio.open(); toast(`Найдите «${title}» — откроется ${mss(at)}`, '', 7000); return null; }
    if (o.src === 'tg' && o.tg && window.Subs) {
      const t = o.tg;
      return Subs.openStream({ kind: 'tg', id: o.id, title, channel: sub, author: t.author, date: t.date, link: t.link, at: t.link ? x => `${t.link}?t=${Math.floor(x)}` : null,
        video: t.audio ? '' : t.video, mp3: t.mp3 || undefined, audio: t.audio || undefined, pcm: t.pcm, poster: t.poster, duration: t.duration, cues: [], autoAsr: true, subName: 'субтитры, созданные приложением',
        note: '<b>В Telegram нет субтитров — приложение создаст их само</b> и переведёт каждую строку.' });
    }
    if (window.Subs) { Subs.open(); toast(`Выберите тот же файл «${o.file || title}» — откроется ${mss(at)}`, '', 8000); }
    return null;
  }
  /** a step: a viewing (the player in its mode, at its place), the deck (a study session), or the deck is built first */
  function go(id, i, n, opt = {}) {
    const p = planOf(id); if (!p) return;
    const part = p.parts[i]; if (!part) return;
    if (p.kind === 'book') return bookStep(p, i, n);
    if (n === 2) {
      if (part.deckId && Store.deck(part.deckId)) return studyPart(id, i);
      // the deck is made from the player's lines: open there (from the part's start) and build
      closeModals();
      if (playerOn(p.mkey)) { buildAndTell(p, i, opt.then); return; }
      pendingBuild = { plan: id, part: i, key: p.mkey };
      go(id, i, 1, { quiet: true, keepCur: true });
      toast('Открываю материал — колода соберётся из его строк, это займёт немного времени', '', 6000);
      return;
    }
    const s = steps(p.kind).find(x => x.n === n); if (!s || !s.mode) return;
    const resume = p.cur && p.cur.part === i && p.cur.step === n && p.pos > part.a + 5 && p.pos < part.b - 5 ? p.pos : null;
    const at = resume != null ? resume : part.a;
    if (!opt.keepCur) { p.cur = { part: i, step: n }; p.at = Date.now(); save(true); }
    closeModals();
    active = { key: p.mkey, plan: id, part: i, step: n, seekTo: at, endShown: false };
    offerNow = null;
    if (window.Subs && Subs.openStep({ key: p.mkey }, { a: part.a, b: part.b, at }, s.mode)) { active.seekTo = null; paintBar(); return; } // already moved to its place
    openMaterial(p, at);
  }
  let pendingBuild = null;

  /* ---------------- the player's hook ---------------- */
  function attach(c) {
    if (!c) return;
    const fresh = !ctx || ctx.key !== c.key || !ctx.alive();
    ctx = c;
    if (fresh && active && active.key !== c.key) active = null;
    if (fresh && offerNow && offerNow.key !== c.key) offerNow = null;
    // the player kept a step for this place (Subs.openStep before it opened) → it is active here
    const w = c.step();
    if (w && (!active || active.key !== c.key)) {
      const p = plans().find(x => x.mkey === c.key && x.parts.some(pt => Math.abs(pt.a - w.a) < 1 && Math.abs(pt.b - w.b) < 1));
      if (p) { const i = p.parts.findIndex(pt => Math.abs(pt.a - w.a) < 1); const st1 = steps(p.kind).find(s => s.mode === (w.mode === 'hide' && p.cur && p.cur.step === 5 ? 'off' : w.mode)); active = { key: c.key, plan: p.id, part: i, step: (p.cur && p.cur.part === i && p.cur.step) || (st1 ? st1.n : 1), seekTo: w.at || w.a }; }
    }
    plansFor(c.key).forEach(sync);
    if (!tickT) tickT = setInterval(tick, 1000);
    paintBar();
    if (pendingBuild && pendingBuild.key === c.key) {
      const pb = pendingBuild; pendingBuild = null;
      const p = planOf(pb.plan);
      if (p) setTimeout(() => { if (playerOn(c.key)) buildAndTell(p, pb.part); }, 1500);
    }
    // a moment to watch (YouTube: «▶ посмотреть момент»)
    if (moment && moment.key === c.key && moment.pending) { moment.pending = false; setTimeout(() => playMoment(), 800); }
  }
  function playMoment() {
    if (!moment || !playerOn(moment.key)) return;
    const v = ctx.media(); if (!v) return;
    try { v.currentTime = Math.max(0, moment.a - 0.3); const r = v.play(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* not ready */ }
  }
  function watchMoment(id, a, b) {
    const p = planOf(id); if (!p) return;
    moment = { key: p.mkey, a, b, pending: true };
    if (playerOn(p.mkey)) { moment.pending = false; closeModals(); playMoment(); return; }
    closeModals();
    openMaterial(p, a);
  }

  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-lb]');
    if (!b || !b.closest('.subs-modal')) return;
    e.preventDefault(); e.stopPropagation();
    const k = b.dataset.lb;
    if (k === 'player') return fromPlayer();
    if (!ctx) return;
    if (k === 'plan') { const p = active && planOf(active.plan); if (p) open(p.id); return; }
    if (k === 'leave') { ctx.clearStep(); if (window.Subs && ctx.setTr) ctx.setTr(localStorage.getItem('nk-subs-tr') || 'show', true); active = null; paintBar(); toast('Обычный просмотр — шаг плана подождёт', '', 3000); return; }
    if (k === 'on') { const el = b.closest('.lb-end'); if (el) el.remove(); const v = ctx.media(); if (v) { const r = v.play(); if (r && r.catch) r.catch(() => {}); } return; }
    if (k === 'go') { const el = b.closest('.lb-end'); if (el) el.remove(); const p = active && planOf(active.plan); if (p) go(p.id, +b.dataset.p, +b.dataset.s); return; }
    if (k === 'offer-yes') { offerNow = null; paintBar(); fromPlayer(true); return; }
    if (k === 'offer-later') { load().later[ctx.key] = Date.now() + 3 * 864e5; offerNow = null; save(); paintBar(); toast('Хорошо, предложу в другой раз', '', 2500); return; }
    if (k === 'offer-no') { load().no[ctx.key] = Date.now(); offerNow = null; save(); paintBar(); toast('Для этого материала больше не предложу. Сделать колоду можно кнопкой «🎓 Учить…»', '', 5000); }
  }, true);

  /** «🎓 Учить по этому видео» in the player: the plan of this material (made now if there is none) */
  function fromPlayer(fromOffer) {
    if (!ctx || !ctx.alive()) return;
    const c = ctx;
    let p = plansFor(c.key).find(x => x.kind !== 'song');
    if (!p) {
      if (c.lines().length < 3) { toast(c.kind === 'audio' ? 'Сначала нужны субтитры: нажмите «🤖 Создать субтитры и перевод» и послушайте немного' : 'У этого видео пока нет субтитров — колоду не из чего собрать', 'warn', 6000); return; }
      p = newPlan(c, c.kind === 'audio' ? 'audio' : 'video');
      if (!p) { toast('Не получилось разбить материал на части — попробуйте, когда он загрузится', 'warn'); return; }
      toast(p.parts.length > 1 ? `План готов: ${p.parts.length} ${pl(p.parts.length, ['часть', 'части', 'частей'])} по 10–15 минут` : 'План готов — одна часть', 'good', 4000);
    }
    open(p.id, { fromPlayer: true, offer: !!fromOffer });
  }
  const btnHtml = src => {
    const K = src && (src.audio || src.radio) ? KIND.audio : KIND.video;
    const what = src && src.kind === 'nrk' && !src.audio ? 'по этой передаче' : K.btn;
    return `<button type="button" class="btn sm lb-pbtn" data-lb="player" title="Части по 10–15 минут, колода с голосом из записи, пять шагов от перевода до «на слух»">🎓 <span>Учить ${what}</span></button>`;
  };

  /* ---------------- the plan window ---------------- */
  function partHtml(p, i, cur) {
    const part = p.parts[i], S1 = steps(p.kind), nx = nextStep(p, i), isCur = cur && cur.part === i;
    const allDone = !nx;
    const chip = s => {
      const done = stepDone(p, i, s.n), open1 = unlocked(p, i, s.n), pc = s.mode ? Math.round(cov(p, i, s.n) * 100) : 0;
      const lbl = s.n === 2 && part.deckId ? `${s.t} · ${part.nw || 0} ${pl(part.nw || 0, ['слово', 'слова', 'слов'])} и ${part.np || 0} ${pl(part.np || 0, ['фраза', 'фразы', 'фраз'])}` : s.t;
      return `<button type="button" class="lb-step${done ? ' is-done' : ''}${nx === s.n ? ' is-next' : ''}" data-lbm="go" data-p="${i}" data-s="${s.n}" ${open1 ? '' : 'disabled aria-disabled="true"'}
        title="${esc(open1 ? s.sub : `Откроется после шага ${NUM[s.n - 2]}`)}"><span class="lb-n" aria-hidden="true">${done ? '✓' : s.n}</span><span class="lb-st"><b>${esc(lbl)}</b><small>${esc(done ? 'готово' : !open1 ? `откроется после шага ${NUM[s.n - 2]}` : pc ? `пройдено ${pc} %` : s.sub)}</small></span></button>`;
    };
    const len = Math.max(1, Math.round((part.b - part.a) / 60));
    return `<section class="lb-part${isCur ? ' is-cur' : ''}${allDone ? ' is-done' : ''}" data-lb-part="${i}">
      <header class="lb-ph"><b>${p.kind === 'book' ? (p.parts.length > 1 ? `Колода ${i + 1}` : 'Прочитанные страницы') : p.parts.length > 1 ? `Часть ${i + 1}` : p.kind === 'song' ? 'Песня' : 'Весь материал'}</b><span class="muted small">${p.kind === 'book' ? esc(part.label || '') : `${mss(part.a)}–${mss(part.b)} · ${len} мин`}${allDone ? ' · пройдена ✓' : ''}</span>
        ${part.deckId ? `<button type="button" class="linklike small" data-lbm="items" data-p="${i}" aria-expanded="false">слова и фразы</button>` : ''}</header>
      <div class="lb-steps">${S1.map(chip).join('')}</div>
      <div class="lb-items" data-lb-items="${i}" hidden></div>
    </section>`;
  }
  const SRC = { yt: '▶️ YouTube', nrk: '📺 NRK TV', nrkr: '📻 NRK Радио', tg: '✈️ Telegram', file: '🎬 Своё видео' };
  const srcName = p => (p.kind === 'book' ? '📖 Книга' : p.kind === 'song' ? '🎵 Песня' : (p.open && p.open.src === 'file' && p.kind === 'audio' ? '🎧 Своя запись' : SRC[(p.open || {}).src] || (KIND[p.kind] || KIND.video).name));
  function planHtml(p) {
    sync(p);
    const cur = cursor(p), pc = Math.round(planPct(p) * 100), K = KIND[p.kind] || KIND.video;
    const S1 = steps(p.kind), nxS = cur && S1.find(s => s.n === cur.step);
    const voices = p.parts.some(x => x.np);
    return `<div class="lb-plan" data-lb-plan="${esc(p.id)}">
      <div class="lb-top">${p.img ? `<img class="lb-img" src="${esc(p.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : `<span class="lb-img lb-img-i" aria-hidden="true">${K.ico}</span>`}
        <div class="lb-top-t"><span class="lb-kick">${esc(srcName(p))}${p.sub && p.sub !== srcName(p) ? ' · ' + esc(p.sub) : ''}</span><b class="lb-title">${esc(p.title)}</b>
          <span class="lb-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pc}" aria-label="Пройдено ${pc} %"><i style="width:${Math.max(2, pc)}%"></i></span>
          <small class="muted">пройдено ${pc} % · ${p.kind === 'song' ? `${Math.max(1, Math.round((p.parts[0].b - p.parts[0].a) / 60))} мин` : p.kind === 'book' ? `${p.parts.length} ${pl(p.parts.length, ['колода', 'колоды', 'колод'])}` : `${p.parts.length} ${pl(p.parts.length, ['часть', 'части', 'частей'])}${p.parts.length > 1 ? ' по 10–15 минут' : ''}`}</small></div></div>
      ${cur && nxS ? `<button type="button" class="btn primary lb-next" data-lbm="go" data-p="${cur.part}" data-s="${cur.step}">▶ ${p.parts.length > 1 ? `Часть ${cur.part + 1}: ` : ''}${esc(nxS.t)}${p.cur && p.cur.part === cur.part && p.cur.step === cur.step && p.pos > 5 && nxS.mode ? ` · с ${mss(p.pos)}` : ''}</button>` : '<p class="lb-alldone">🎉 Все части пройдены. Осталась проверка на слух — и можно браться за новый материал.</p>'}
      <p class="lb-how">${p.kind === 'book' ? 'Три шага на каждую колоду' : p.parts.length > 1 ? 'Пять шагов на каждую часть' : 'Пять шагов'}: ${S1.map(s => `<span>${NUM[s.n - 1]} ${esc(low(s.short))}</span>`).join(' ')}.${p.kind === 'book' ? ' Следующие страницы — новая колода: приложение предложит её, когда вы прочитаете ещё три страницы.' : ` Шаг засчитывается, когда пройдено 85 % ${p.parts.length > 1 ? 'части' : p.kind === 'song' ? 'песни' : 'материала'}.`}</p>
      <div class="lb-parts">${p.parts.map((x, i) => partHtml(p, i, cur)).join('')}</div>
      <div class="lb-check"><span class="lb-pb-i" aria-hidden="true">🎧</span><span class="lb-pb-t"><b>Проверка на слух</b><small>${p.quiz ? `последний раз: ${p.quiz.score} из ${p.quiz.of}` : `10 фраз ${p.kind === 'book' ? 'из книги — их прочитает голос приложения' : p.yt ? 'из видео — голосом приложения (звук YouTube взять нельзя)' : 'голосом из записи'} — выберите или напишите перевод`}</small></span>
        <button type="button" class="btn ${cur ? 'ghost' : 'primary'}" data-lbm="quiz" ${voices ? '' : 'disabled title="Сначала соберите колоду хотя бы одной части"'}>Начать</button></div>
      ${p.kind !== 'book' && p.kind !== 'song' && ctx && ctx.alive() && ctx.key === p.mkey && songRange(ctx) ? '<button type="button" class="btn ghost lb-song" data-lbm="song">🎵 Здесь звучит песня — учить по песне отдельно</button>' : ''}
      <p class="lb-foot"><button type="button" class="linklike small" data-lbm="del">Удалить план</button> <span class="muted small">колоды и карточки останутся</span></p>
    </div>`;
  }
  async function itemsHtml(p, i) {
    const d = await iget('deck', `${p.id}|${i}`);
    if (!d) return '<p class="muted small">Список слов появится здесь после того, как колода соберётся.</p>';
    const w = (d.words || []).map(x => `<li><b lang="nb">${esc(x.no)}</b> — ${esc(x.ru)} <span class="lb-lv">${esc(x.level || '')}</span></li>`).join('');
    const ph = (d.phrases || []).map((x, k) => `<li class="lb-phr">${x.img ? `<img src="${esc(x.img)}" alt="" class="lb-still">` : ''}<span class="lb-phr-t"><b lang="nb">${esc(x.no)}</b><small>${esc(x.ru)}</small><small class="muted">из «${esc(p.title)}»${p.parts.length > 1 ? `, часть ${i + 1}` : ''}, ${mss(x.a)}</small></span>
      <span class="lb-phr-acts">${x.v ? `<button type="button" class="btn sm ghost" data-lbm="voice" data-p="${i}" data-k="${k}" title="Фраза голосом из записи">🔊</button>` : ''}${p.kind !== 'book' && (!x.v || p.yt) ? `<button type="button" class="btn sm ghost" data-lbm="moment" data-a="${x.a}" data-b="${x.b}" title="Посмотреть этот момент в плеере">▶ посмотреть момент</button>` : ''}</span></li>`).join('');
    return `${w ? `<h4>Слова</h4><ul class="lb-words">${w}</ul>` : ''}${ph ? `<h4>Фразы</h4><ul class="lb-phrases">${ph}</ul>` : ''}`;
  }
  let audioEl = null;
  async function playVoice(p, i, k, text) {
    try {
      const u = await clipUrl(p.id, `${i}|${k}`);
      if (!u) { if (window.TTS && text) TTS.speak(text, 'no'); return; }
      if (!audioEl) audioEl = new Audio();
      audioEl.src = u; const r = audioEl.play(); if (r && r.catch) r.catch(() => {});
    } catch (e) { if (window.TTS && text) TTS.speak(text, 'no'); }
  }
  let planM = null;
  function open(key, o = {}) {
    let p = planOf(key) || plansFor(key)[0];
    if (!p) { if (window.App) App.goAsk ? App.goAsk('learn') : App.go('learn'); return null; }
    if (planM) { try { planM.close(); } catch (e) { /* ignore */ } }
    loadCss();
    const m = planM = UI.modal({ title: `${(KIND[p.kind] || KIND.video).ico} ${esc((KIND[p.kind] || KIND.video).name)}`, cls: 'lb-modal', body: planHtml(p), onClose: () => { if (planM === m) planM = null; } });
    m.el.addEventListener('click', async e => {
      const b = e.target.closest('[data-lbm]'); if (!b || b.disabled) return;
      e.stopPropagation();
      p = planOf(p.id); if (!p) { m.close(); return; }
      const k = b.dataset.lbm, i = +b.dataset.p;
      if (k === 'go') {
        const n = +b.dataset.s;
        if (n === 2 && !(p.parts[i].deckId && Store.deck(p.parts[i].deckId)) && playerOn(p.mkey)) {
          b.disabled = true; b.querySelector('small').innerHTML = '<span data-lb-build-msg>собираю…</span>';
          const r = await buildAndTell(p, i);
          if (m.el.isConnected) { const body = m.el.querySelector('.modal-body'); body.innerHTML = planHtml(planOf(p.id) || p); }
          if (r) { /* the toast offers «Учить» */ }
          return;
        }
        go(p.id, i, n);
        return;
      }
      if (k === 'items') {
        const box = m.el.querySelector(`[data-lb-items="${i}"]`); if (!box) return;
        const show = box.hidden; box.hidden = !show; b.setAttribute('aria-expanded', String(show));
        if (show) box.innerHTML = await itemsHtml(p, i);
        return;
      }
      if (k === 'voice') { const d = await iget('deck', `${p.id}|${i}`); const ph = d && d.phrases && d.phrases[+b.dataset.k]; playVoice(p, i, +b.dataset.k, ph && ph.no); return; }
      if (k === 'moment') { watchMoment(p.id, +b.dataset.a, +b.dataset.b); return; }
      if (k === 'quiz') { quiz(p.id); return; }
      if (k === 'song') { const r = ctx && songRange(ctx); if (!r) return; const sp = planOf(`${ctx.key}#song@${Math.round(r.a)}`) || newPlan(ctx, 'song', r); if (sp) { m.close(); setTimeout(() => open(sp.id), 220); } return; }
      if (k === 'del') {
        const ok = await UI.confirm(`<b>«${esc(p.title)}»</b><br>План и отметки шагов сотрутся. Колоды и карточки останутся — их можно учить как обычно.`, { title: 'Удалить план?', ok: 'Удалить', cancel: 'Оставить', danger: true });
        if (!ok) return;
        const raw = JSON.parse(JSON.stringify(p));
        delete load().plans[p.id]; save(true); m.close();
        if (active && active.plan === p.id) { active = null; if (ctx && ctx.alive()) ctx.clearStep(); paintBar(); }
        if (UI.toastAction) UI.toastAction('План удалён', 'Вернуть', () => { load().plans[raw.id] = raw; save(true); }, 8000, '🗑');
        redrawPage();
      }
    });
    if (o.offer) setTimeout(() => { const b = m.el.querySelector('[data-lbm="go"][data-s="2"]'); if (b && !b.disabled) b.focus(); }, 80);
    return m;
  }

  /* ---------------- 🎧 «Проверка на слух» ---------------- */
  const norm = s => low(s).replace(/ё/g, 'е').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
  function closeEnough(a, b) {
    const A = norm(a).split(' ').filter(w => w.length > 2), B = new Set(norm(b).split(' ').filter(w => w.length > 2).map(w => w.slice(0, 5)));
    if (!A.length) return norm(a) === norm(b);
    return A.filter(w => B.has(w.slice(0, 5))).length / Math.max(A.length, B.size) >= 0.5;
  }
  async function quiz(id) {
    const p = planOf(id); if (!p) return;
    const all = [];
    for (let i = 0; i < p.parts.length; i++) { const d = await iget('deck', `${p.id}|${i}`); (d && d.phrases || []).forEach((x, k) => { if (x.ru) all.push(Object.assign({ part: i, k }, x)); }); }
    if (all.length < 2) { toast('Для проверки нужны фразы — соберите колоду хотя бы одной части', 'warn'); return; }
    const pick = all.slice().sort(() => Math.random() - 0.5).sort((a, b) => b.v - a.v).slice(0, 10).sort(() => Math.random() - 0.5);
    let q = 0, score = 0, typed = false, answered = false;
    const opts = x => { const o = all.filter(y => y.ru !== x.ru).sort(() => Math.random() - 0.5).slice(0, 3).map(y => y.ru); o.push(x.ru); return o.sort(() => Math.random() - 0.5); };
    const m = UI.modal({ title: '🎧 Проверка на слух', cls: 'lb-modal lb-quiz-m', body: '<div data-lbq></div>' });
    const box = m.el.querySelector('[data-lbq]');
    const say = x => (x.v ? playVoice(p, x.part, x.k, x.no) : window.TTS ? TTS.speak(x.no, 'no') : null);
    function draw() {
      answered = false;
      if (q >= pick.length) {
        p.quiz = { score, of: pick.length, at: Date.now() }; p.at = Date.now(); save(true);
        const good = score / pick.length;
        box.innerHTML = `<div class="lb-q-end"><p class="lb-q-big" aria-hidden="true">${good >= 0.8 ? '🏆' : good >= 0.5 ? '👍' : '🌱'}</p><p><b>${score} из ${pick.length}</b></p>
          <p class="muted">${good >= 0.8 ? 'Отлично — вы понимаете этот материал на слух.' : good >= 0.5 ? 'Хорошо! Фразы, где были ошибки, стоит повторить в колоде.' : 'Начало положено. Повторите колоды частей и попробуйте ещё раз.'}</p>
          <p class="lb-q-acts"><button type="button" class="btn primary" data-q="again">Ещё раз</button><button type="button" class="btn ghost" data-q="close">Готово</button></p></div>`;
        return;
      }
      const x = pick[q];
      box.innerHTML = `<p class="lb-q-n">Фраза ${q + 1} из ${pick.length} · верно ${score}</p>
        <div class="lb-q-play"><button type="button" class="btn primary lb-q-say" data-q="say" aria-label="Послушать фразу">🔊 Послушать</button>${x.v ? '<small class="muted">голос из записи</small>' : '<small class="muted">голос приложения — у этого источника нет записи звука</small>'}</div>
        ${typed ? `<label class="lb-q-type"><span>Ваш перевод</span><input type="text" data-q-in autocomplete="off" placeholder="Что сказали — по-русски"></label><button type="button" class="btn primary" data-q="check">Проверить</button>`
          : `<div class="lb-q-opts" role="group" aria-label="Варианты перевода">${opts(x).map(o => `<button type="button" class="lb-q-opt" data-q="opt" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`}
        <p class="lb-q-res" data-q-res aria-live="polite"></p>
        <p class="lb-q-acts"><button type="button" class="linklike small" data-q="mode">${typed ? 'Выбирать из вариантов' : 'Написать перевод самому'}</button><button type="button" class="btn ghost" data-q="next" hidden>Дальше →</button></p>`;
      setTimeout(() => say(x), 250);
      const inp = box.querySelector('[data-q-in]'); if (inp) { inp.focus(); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); box.querySelector('[data-q="check"]').click(); } }); }
    }
    function result(ok, x) {
      answered = true; if (ok) score++;
      const r = box.querySelector('[data-q-res]');
      r.className = 'lb-q-res ' + (ok ? 'ok' : 'bad');
      r.innerHTML = `${ok ? '✓ Верно' : '✕ Не совсем'} — <b lang="nb">${esc(x.no)}</b><br>${esc(x.ru)}`;
      const nx = box.querySelector('[data-q="next"]'); nx.hidden = false; nx.focus();
    }
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-q]'); if (!b) return;
      const k = b.dataset.q, x = pick[q];
      if (k === 'say') say(x);
      else if (k === 'opt' && !answered) { const ok = b.dataset.v === x.ru; box.querySelectorAll('.lb-q-opt').forEach(o => { o.disabled = true; if (o.dataset.v === x.ru) o.classList.add('ok'); }); if (!ok) b.classList.add('bad'); result(ok, x); }
      else if (k === 'check' && !answered) { const v = (box.querySelector('[data-q-in]') || {}).value || ''; if (!v.trim()) return; result(closeEnough(x.ru, v), x); }
      else if (k === 'mode') { typed = !typed; draw(); }
      else if (k === 'next') { q++; draw(); }
      else if (k === 'again') { q = 0; score = 0; pick.sort(() => Math.random() - 0.5); draw(); }
      else if (k === 'close') m.close();
    });
    draw();
  }

  /* ---------------- 📖 books (and other text): LearnBy.offer ---------------- */
  const bookText = new Map(); // key → [{ page, text }] read in this visit
  async function offer(mat) {
    try {
      if (!mat || !mat.key) return;
      const key = 'book:' + String(mat.key).slice(0, 200), s = load();
      let t = typeof mat.text === 'function' ? mat.text() : mat.text;
      if (t && typeof t.then === 'function') t = await t.catch(() => '');
      const arr = bookText.get(key) || []; bookText.set(key, arr);
      const page = mat.page != null ? String(mat.page) : String(arr.length + 1);
      if (t && !arr.some(x => x.page === page)) { arr.push({ page, text: String(t).slice(0, 20000) }); if (arr.length > 8) arr.shift(); }
      const pg = s.pages[key] = s.pages[key] || {}; pg[page] = 1; save();
      bookMats.set(key, mat);
      if (Object.keys(pg).length < OFFER_PAGES || arr.length < OFFER_PAGES || s.no[key] || +s.later[key] > Date.now() || offerShown.has(key) || !window.UI) return;
      const p = planOf(key);
      if (p && p.parts.some(x => !x.deckId)) return;
      offerShown.add(key);
      const words = arr.map(x => x.text).join(' ').split(/\s+/).length;
      showBookOffer(key, mat, words);
    } catch (e) { /* a convenience — never an error */ }
  }
  const bookMats = new Map();
  function showBookOffer(key, mat, words) {
    document.querySelectorAll('.lb-boffer').forEach(x => x.remove());
    const el = document.createElement('div'); el.className = 'lb-boffer'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Колода из прочитанного');
    const n = Math.min(35, Math.round(words / 25));
    el.innerHTML = `<span class="lb-pb-i" aria-hidden="true">🎓</span><span class="lb-pb-t"><b>Сделать колоду из прочитанного?</b><small>${planOf(key) ? 'Следующие страницы' : `«${esc(String(mat.title || 'Книга').slice(0, 60))}»`}${n > 5 ? ` · ≈ ${n} ${pl(n, ['нужное слово и фраза', 'нужных слова и фразы', 'нужных слов и фраз'])}` : ''}</small></span>
      <span class="lb-offer-acts"><button type="button" class="btn sm primary" data-bo="yes">Сделать</button><button type="button" class="btn sm ghost" data-bo="later">Позже</button><button type="button" class="btn sm ghost" data-bo="no">Не предлагать для этого</button></span>`;
    (document.querySelector('#modal-root .modal-backdrop:last-child .modal') || document.body).appendChild(el);
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-bo]'); if (!b) return;
      e.stopPropagation(); el.remove();
      const s = load();
      if (b.dataset.bo === 'later') { s.later[key] = Date.now() + 3 * 864e5; save(); return; }
      if (b.dataset.bo === 'no') { s.no[key] = Date.now(); save(); toast('Для этой книги больше не предложу', '', 3000); return; }
      makeBookPart(key, mat);
    });
  }
  async function makeBookPart(key, mat) {
    const arr = bookText.get(key) || [];
    const text = arr.map(x => x.text).join('\n');
    if (text.split(/\s+/).length < 40) { toast('Здесь пока слишком мало текста для колоды — почитайте ещё немного', 'warn'); return; }
    let p = planOf(key);
    if (!p) { p = { id: key, mkey: key, kind: 'book', title: String(mat.title || 'Книга').slice(0, 140), sub: String(mat.sub || '').slice(0, 100), img: /^https:\/\//.test(mat.img || '') ? String(mat.img).slice(0, 600) : '', created: Date.now(), at: Date.now(), parts: [], book: 1 }; load().plans[key] = p; }
    if (mat.src) p.open = { src: String(mat.src), id: String(mat.id == null ? '' : mat.id).slice(0, 600) }; // to open the book again after a reload
    const pages = arr.map(x => x.page);
    const i = p.parts.length;
    p.parts.push({ a: 0, b: 0, label: pages.length > 1 ? `стр. ${pages[0]}–${pages[pages.length - 1]}` : `стр. ${pages[0]}`, st: { 1: { done: 1, at: Date.now() } } });
    save(true);
    const busy = UI.busy ? UI.busy('Собираю колоду из прочитанного…') : null;
    try {
      const sents = (text.replace(/\s+/g, ' ').match(/[^.!?…]+[.!?…]+/g) || []).map(x => x.trim()).filter(x => { const n = (x.match(/\p{L}+/gu) || []).length; return n >= 4 && n <= 14; });
      const uniq = [...new Set(sents)].slice(0, 60);
      let ru = [];
      if (uniq.length && window.Translators) { try { const r = await Translators.translateMany(uniq, 'no', 'ru', { quiet: true }); ru = r.out || []; } catch (e) { ru = []; } }
      const lines = uniq.map((t, k) => ({ i: k, a: k * 30, b: k * 30 + 2, t, ru: String(ru[k] || '').trim() || undefined })); // 30 s apart: phrases are spread like in a film
      const K = await kelly();
      let words = K ? pickWords(K, lines.concat([{ t: text.slice(0, 20000), a: 0, b: 0 }]), 26) : [];
      words = (await wordRu(words)).slice(0, 20);
      const phrases = pickPhrases(lines, words, 10, false).map(l => Object.assign({}, l, { a: 0, b: 0 }));
      const d = Store.addDeck(`🎓 ${p.title.slice(0, 50)} · ${p.parts[i].label}`, `Учить по книге: «${p.title}», ${p.parts[i].label} — слова для вашего уровня и фразы из текста`);
      Store.updateDeck(d.id, { learnBy: p.id });
      const prov = note => (window.Prov ? [Prov.entry('import', 'create', null, note)] : []);
      const where = `из «${p.title}», ${p.parts[i].label}`;
      const wOut = words.map(x => { const no = kQ(x); const cd = Store.addCard(d.id, { no, ru: x.ru, example: x.line && x.line.ru ? x.line.t : '', exampleRu: x.line && x.line.ru ? x.line.ru : '', description: where, tags: ['learnby', 'word', x.level], history: prov(`«Учить по книге»: слово уровня ${x.level} ${where}`) }); return { no, ru: x.ru, level: x.level, card: cd && cd.id }; });
      const pOut = phrases.map(l => { const cd = Store.addCard(d.id, { no: l.t, ru: l.ru, description: where, tags: ['learnby', 'phrase'], history: prov(`«Учить по книге»: фраза ${where}`) }); return { no: l.t, ru: l.ru, a: 0, b: 0, v: 0, card: cd && cd.id }; });
      try { await iput('deck', `${p.id}|${i}`, { words: wOut, phrases: pOut, at: Date.now() }); } catch (e) { if (isQuota(e)) toast('На устройстве мало места — список фраз для проверки не сохранён, колода готова', 'warn', 6000); }
      Object.assign(p.parts[i], { deckId: d.id, nw: wOut.length, np: pOut.length });
      p.at = Date.now(); save(true);
      bookText.set(key, []); offerShown.delete(key); load().pages[key] = {}; save();
      if (UI.toastAction) UI.toastAction(`Колода готова: ${wOut.length} ${pl(wOut.length, ['слово', 'слова', 'слов'])} и ${pOut.length} ${pl(pOut.length, ['фраза', 'фразы', 'фраз'])}`, 'Учить', () => studyPart(p.id, i), 12000, '🎓');
    } catch (e) { console.warn('learnby book', e); toast('Колоду собрать не удалось — попробуйте ещё раз', 'warn'); }
    finally { if (busy && busy.close) busy.close(); else if (busy && typeof busy === 'function') busy(); }
  }
  function bookStep(p, i, n) {
    if (n === 2) return studyPart(p.id, i);
    if (n === 3) return quiz(p.id);
    const mat = bookMats.get(p.id), o = p.open || {};
    closeModals();
    if (mat && typeof mat.open === 'function') { mat.open(); return; }
    if (o.src === 'reader' && window.Reader && Reader.openBook) return Reader.openBook(o.id);
    if (o.src === 'textbook' && window.Textbook) return Textbook.open(o.id);
    if (o.src === 'news' && window.News) return News.open();
    if (o.src === 'books' && window.Books) { Books.open(); toast(`Найдите «${p.title}» в списке книг`, '', 5000); return; }
    toast('Откройте книгу — она в «📖 Читать»', '', 4000);
  }

  /* ---------------- «▶ Продолжить» and «📈 Мой прогресс» ---------------- */
  function itemOf(p) {
    sync(p);
    const cur = cursor(p), K = KIND[p.kind] || KIND.video, pc = planPct(p);
    const s = cur && steps(p.kind).find(x => x.n === cur.step);
    const pos = cur && s && s.mode && p.cur && p.cur.part === cur.part && p.cur.step === cur.step && p.pos > p.parts[cur.part].a + 5 ? p.pos : null; // «· 4:12» only once the step has begun
    const PW = p.kind === 'book' ? 'колода' : 'часть';
    const title = `${p.title}${cur && p.parts.length > 1 ? ` · ${PW} ${cur.part + 1}` : ''}${s ? ` · ${s.short}` : ''}${pos != null ? ` · ${mss(pos)}` : ''}`;
    const line = cur ? `Шаг ${cur.step} из ${steps(p.kind).length}${p.parts.length > 1 ? ` · ${PW} ${cur.part + 1} из ${p.parts.length}` : ''}` : 'Все части пройдены — осталась проверка на слух';
    return { key: 'learn:' + p.id, at: p.at || p.created, first: p.created, title, kind: K.name, ico: '🎓', img: p.img, grp: 'learn', word: 'пройдено', pct: pc,
      done: !cur, line, where: line, verb: 'Продолжить учить', res: null, mkey: p.mkey,
      go: () => (cur ? go(p.id, cur.part, cur.step) : open(p.id)), restart: () => open(p.id) };
  }
  const continueItems = () => plans().map(itemOf).filter(x => !x.done);
  const progressList = () => plans().map(itemOf);

  /* ---------------- 🎓 the section page (#/learn) ---------------- */
  function loadCss() {
    if (document.querySelector('link[href*="css/learnby.css"]')) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/learnby.css'; document.head.appendChild(l);
  }
  const ENTRY = [
    ['video', '🎬', 'Учить по видео', 'NRK TV — передачи, фильмы, сериалы · YouTube · своё видео · видео из Telegram'],
    ['radio', '📻', 'Учить по радио', 'NRK Радио, подкасты, аудио из Telegram — субтитры создаст приложение'],
    ['book', '📖', 'Учить по книге', 'книги, читалка, учебник, новости — колода из прочитанных страниц'],
    ['song', '🎵', 'Учить по песне', 'песня в передаче или клипе — слова, которые узнал плеер'],
  ];
  function recos() {
    const L = userLevel(), li = LV.indexOf(L), out = [];
    // started but no plan yet: the app knows them
    try {
      const have = new Set(plans().map(p => p.mkey));
      (window.Continue && Continue.all ? Continue.all() : []).filter(x => (x.grp === 'video' || x.grp === 'audio') && x.res && !have.has(x.res.id) && !x.live).slice(0, 4).forEach(x => out.push({ ico: x.grp === 'audio' ? '📻' : '🎬', t: x.title, sub: `вы начали ${x.grp === 'audio' ? 'слушать' : 'смотреть'} — откройте и нажмите «🎓 Учить…»`, act: 'cont', key: x.key, img: x.img }));
    } catch (e) { /* none */ }
    // YouTube channels whose own description names your level
    try {
      const fits = f => { const m = String(f).match(/([ABC][12])\s*[–-]\s*([ABC][12])\+?|([ABC][12])\+?/); if (!m) return false; const a = LV.indexOf(m[1] || m[3]), b = m[2] ? LV.indexOf(m[2]) : /\+/.test(m[0]) ? 5 : a; return li >= a && li <= b; };
      (window.YouTube && YouTube.CHANNELS || []).filter(c => c[2] === 'no' && fits(c[3])).slice(0, 4).forEach(c => out.push({ ico: window.YouTube && YouTube.YT_SVG ? YouTube.YT_SVG(22) : '▶️', t: c[1], sub: `YouTube · ${c[3]}`, act: 'yt', h: c[0], n: c[1] }));
    } catch (e) { /* none */ }
    if (li <= 1) out.push({ ico: '📰', t: 'Klar Tale и Supernytt', sub: 'новости простым языком — для «Учить по книге»', act: 'news' });
    out.push({ ico: '📺', t: li <= 1 ? 'NRK Super и короткие передачи' : 'Сериалы NRK TV', sub: li <= 1 ? 'медленная речь, короткие серии — удобно делить на части' : 'серия = 2–4 части по 10–15 минут', act: 'nrk' });
    return { L, list: out.slice(0, 8) };
  }
  function pageHtml() {
    const ps = plans().map(p => sync(p)).sort((a, b) => (b.at || 0) - (a.at || 0));
    const R = recos();
    const tile = ([k, ico, t, sub]) => `<button type="button" class="lb-entry lb-e-${k}" data-lbp="entry" data-k="${k}"><span class="lb-e-i" aria-hidden="true">${ico}</span><span class="lb-e-t"><b>${t}</b><small>${sub}</small></span><span class="lb-chev" aria-hidden="true">›</span></button>`;
    const mine = p => {
      const x = itemOf(p), pc = Math.round(x.pct * 100), K = KIND[p.kind] || KIND.video;
      return `<article class="lb-mine"><button type="button" class="lb-mine-hit" data-lbp="plan" data-id="${esc(p.id)}" title="План: части и шаги">
        ${p.img ? `<img class="lb-img" src="${esc(p.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : `<span class="lb-img lb-img-i" aria-hidden="true">${K.ico}</span>`}
        <span class="lb-mine-t"><span class="lb-kick">${K.ico} ${esc(K.name)}</span><b>${esc(p.title)}</b>
          <span class="lb-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pc}" aria-label="Пройдено ${pc} %"><i style="width:${Math.max(2, pc)}%"></i></span>
          <small class="muted">${pc} % · ${esc(x.line)}</small></span></button>
        ${x.done ? `<button type="button" class="btn ghost" data-lbp="plan" data-id="${esc(p.id)}">Проверка на слух</button>` : `<button type="button" class="btn primary" data-lbp="go" data-id="${esc(p.id)}">▶ Продолжить</button>`}</article>`;
    };
    return `<div class="learnby" data-learnby>
      <div class="lb-head"><button type="button" class="btn ghost lb-back" data-lbp="back" title="Назад" aria-label="Назад">←</button>
        <div><h1>🎓 Учить по материалам</h1><p class="lb-lead">Фильм, передача, песня или книга превращается в курс: части по 10–15 минут, колода с голосом героев и пять шагов — от перевода под строкой до «на слух».</p></div></div>
      <div class="lb-entries">${ENTRY.map(tile).join('')}</div>
      ${ps.length ? `<section class="lb-sec"><h2>Мои материалы <span class="lb-cnt">${ps.length}</span></h2><div class="lb-mines">${ps.map(mine).join('')}</div></section>` : ''}
      <section class="lb-sec"><h2>Рекомендуем для вашего уровня <span class="lb-lvl">${esc(R.L)}</span></h2>
        <div class="lb-recos">${R.list.map((x, k) => `<button type="button" class="lb-reco" data-lbp="reco" data-i="${k}">${x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : `<span class="lb-reco-i" aria-hidden="true">${x.ico}</span>`}<span><b>${esc(x.t)}</b><small>${esc(x.sub)}</small></span></button>`).join('')}</div>
        <p class="muted small lb-note">Уровень — из «🪜 Уровни A1–C2» (${esc(R.L)}). Слова для колод выбираются под него: вашего уровня и следующего, без тех, что уже есть в ваших карточках.</p></section>
      ${ps.length ? '' : `<section class="lb-sec lb-howto"><h2>Как это работает</h2><ol>
        <li>Откройте видео, передачу или подкаст — и нажмите <b>«🎓 Учить по этому видео»</b> в плеере.</li>
        <li>Приложение разделит его на части по 10–15 минут — по естественным паузам.</li>
        <li>Для каждой части: ① смотрите с переводом, ② учите колоду — слова и целые фразы голосом героев, ③ пересматриваете с размытым переводом, ④ только с норвежскими субтитрами, ⑤ без субтитров.</li>
        <li>В конце — проверка на слух: 10 фраз из материала.</li></ol></section>`}
    </div>`;
  }
  let recoCache = [];
  function render(root) {
    loadCss();
    root = root || document.getElementById('view'); if (!root) return;
    root.innerHTML = pageHtml();
    recoCache = recos().list;
    root.onclick = e => {
      const b = e.target.closest('[data-lbp]'); if (!b) return;
      const k = b.dataset.lbp;
      if (k === 'back') { if (App.back) App.back(); else App.go('home'); return; }
      if (k === 'plan') { open(b.dataset.id); return; }
      if (k === 'go') { const p = planOf(b.dataset.id); if (p) { const x = itemOf(p); x.go(); } return; }
      if (k === 'entry') { entry(b.dataset.k); return; }
      if (k === 'reco') {
        const x = recoCache[+b.dataset.i]; if (!x) return;
        if (x.act === 'cont' && window.Continue) Continue.run(x.key, 'go');
        else if (x.act === 'yt' && window.YouTube) { YouTube.open(null); setTimeout(() => { const box = document.querySelector('.yt-modal [data-yt]'); if (box && YouTube.channel) YouTube.channel(box, x.h, x.n); }, 120); }
        else if (x.act === 'news' && window.News) News.open();
        else if (x.act === 'nrk' && window.NrkTV) NrkTV.open();
      }
    };
  }
  function redrawPage() { if (window.App && App.view && App.view.name === 'learn') render(document.getElementById('view')); }
  function entry(k) {
    const V = window.Views;
    const row = (a, ico, t, sub) => (V && V.sxRow ? V.sxRow(a, ico, t, sub) : '');
    const note = t => `<p class="m-note">${t}</p>`;
    if (!(V && V.sxSheet)) return;
    if (k === 'video') V.sxSheet('🎬 Учить по видео', V.sxGroup('', [
      row('nrk', '📺', 'NRK TV', 'передачи, фильмы и сериалы — с субтитрами'), row('youtube', window.YouTube ? YouTube.YT_SVG(22) : '▶️', 'YouTube', 'каналы учителей и любое видео'),
      row('subs', '🎬', 'Своё видео', 'файл + субтитры .srt'), row('telegram', '✈️', 'Видео из Telegram', 'субтитры создаст приложение'),
    ]) + note('Откройте видео и нажмите <b>«🎓 Учить по этому видео»</b> под ним — появится план по частям.'));
    else if (k === 'radio') V.sxSheet('📻 Учить по радио', V.sxGroup('', [
      row('nrkradio', '📻', 'NRK Радио и подкасты', 'выпуски передач и подкасты NRK'), row('telegram', '✈️', 'Аудио из Telegram', 'голосовые и аудио каналов'),
    ]) + note('Включите выпуск, нажмите <b>«🤖 Создать субтитры и перевод»</b>, а затем <b>«🎓 Учить по этой передаче»</b>.'));
    else if (k === 'book') V.sxSheet('📖 Учить по книге', V.sxGroup('', [
      row('books', '📚', 'Книги', 'читать и слушать'), row('bookshelf', '🗂', 'Библиотека', 'ваши книги: PDF, EPUB, тексты'),
      row('textbook', '📘', 'Мой учебник', 'свой текст или страница учебника'), row('news', '📰', 'Новости', 'Klar Tale, NRK, Supernytt'),
    ]) + note('Прочитайте три страницы — приложение предложит сделать колоду из прочитанного: слова для вашего уровня и фразы из текста.'));
    else if (k === 'song') {
      const songs = plans().filter(p => p.kind === 'song');
      V.sxSheet('🎵 Учить по песне', (songs.length ? V.sxGroup('Мои песни', songs.map(p => `<button type="button" class="m-row sx-row" data-sx="lb-open" data-id="${esc(p.id)}"><span class="m-place-i sx-i" aria-hidden="true">🎵</span><span class="m-row-t"><b>${esc(p.title)}</b><small>пройдено ${Math.round(planPct(p) * 100)} %</small></span></button>`)) : '')
        + V.sxGroup('Где найти песню', [row('nrkradio', '📻', 'NRK Радио', 'P1, P3, NRK mP3 — песни в эфире и выпусках'), row('youtube', window.YouTube ? YouTube.YT_SVG(22) : '▶️', 'YouTube', 'клипы норвежских исполнителей')])
        + note('Когда в плеере звучит песня, приложение само распознаёт её слова (🎵). Нажмите под видео <b>«🎓 Учить…»</b>, а в плане — <b>«🎵 Здесь звучит песня»</b>: получится колода из строк песни с голосом исполнителя.'),
      { run: (a, data) => { if (a === 'lb-open') open(data.id); else V.go(a); } });
    }
  }

  /* ---------------- wiring ---------------- */
  if (window.Views) Views.learn = function (root) { render(root); };
  document.addEventListener('learnby-changed', () => { if (window.App && App.view && App.view.name === 'learn' && !document.querySelector('#modal-root .modal-backdrop')) redrawPage(); });

  window.LearnBy = {
    attach, btnHtml, offer, open, go, continueItems, progressList, entry,
    plans: () => plans().map(p => JSON.parse(JSON.stringify(p))),
    /** ☁️ js/cloudsync.js: write the pending change now (before the cloud reads localStorage) · re-read after the cloud wrote it */
    _sync: { flush() { if (saveT) save(true); }, reload() { clearTimeout(saveT); saveT = 0; S = null; emit(); } },
    /** the study page of a part (its deck) */
    study: studyPart,
    _t: { split, pickWords, pickPhrases, mulaw, unmulaw, build, newPlan, get ctx() { return ctx; }, get active() { return active; }, load, save, quiz, clipUrl, estimate, cov, planPct, itemOf, songRange, makeBookPart, bookText },
  };
})();
