/* ============ 🌅 Фраза дня — one everyday Norwegian phrase a day, in a small drawn scene ============
 * PhraseDay.mount(el)   — the compact card for the home screen (scene + phrase + ▶ / 🐢 + «Разобрать фразу»).
 * PhraseDay.open(off)   — the window with the 4 steps (off = 0 today, -1 yesterday):
 *   1 Послушайте (▶ / 🐢, the word being said lights up in the bubble and the line — TTS.Karaoke)
 *   2 Разберитесь (tap / hover a word: translation, base form, note; «Почему так?» — compared with Russian / Ukrainian)
 *   3 Повторите вслух (js/speech.js: on-device pronunciation check through data-speech-pron)
 *   4 Скажите сами (own sentence from the pattern: AI feedback when a network is connected, else the model answer)
 *   + a mini dialogue, «＋ В карточки» (CardMaker with provenance), done days, yesterday's phrase.
 * Data: data/phrase-of-day.json + -a1 / -a2 / -b1c1 (1090 own phrases, merged, the same Norwegian line once). Pick:
 * deterministic by the date from the phrases of the learner's level (A1…C1: Levels.currentLevel() or set by hand in the
 * window) — a seeded shuffle walked day by day from the day the level was first shown, so no phrase repeats until the
 * whole level has been shown. The scene is our own SVG drawing from p.scene (place, people with roles, things); the
 * older phrases without it keep the drawing by the topic.
 * State (this device): localStorage 'nk-phraseday' { done: { 'YYYY-MM-DD': id }, steps: { day: {listen,parse,repeat,say} },
 *   lvl, lang, start: { A1: day number, … } }.
 * Voice: TTS place 'dialogs' (🔊 Голоса → «Диалоги»). CSS: css/practice.css (loaded lazily).
 */
(function () {
  'use strict';
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  // the phrases: the first 120 + the big sets by level (a missing file is skipped quietly)
  const DATA_URLS = ['data/phrase-of-day.json', 'data/phrase-of-day-a1.json', 'data/phrase-of-day-a2.json', 'data/phrase-of-day-b1c1.json'];
  const KEY = 'nk-phraseday';
  const PLACE = 'dialogs';
  const LV = ['A1', 'A2', 'B1', 'B2', 'C1'];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const dayNum = t => { const d = new Date(t); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const toast = (m, k, ms) => { if (window.UI && UI.toast) UI.toast(m, k || '', ms || 2600); };

  function loadCss() {
    if (document.querySelector('link[data-practice-css]')) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/practice.css?v=2'; l.setAttribute('data-practice-css', '');
    document.head.appendChild(l);
  }
  let DATA = null, LOADING = null;
  const normNo = t => String(t || '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
  /** all the phrases, merged; the same Norwegian line twice → once (the one with a drawn scene wins) */
  function load() {
    if (DATA) return Promise.resolve(DATA);
    if (LOADING) return LOADING;
    LOADING = Promise.all(DATA_URLS.map(u => fetch(u, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).catch(() => null))).then(parts => {
      const by = new Map();
      parts.forEach(j => {
        if (!j) return;
        (Array.isArray(j) ? j : j.phrases || []).forEach(p => {
          if (!p || !p.id || !p.no || !Array.isArray(p.words)) return;
          const k = normNo(p.no), was = by.get(k);
          if (!was || (!was.scene && p.scene)) by.set(k, p);
        });
      });
      const list = [...by.values()];
      if (!list.length) throw new Error('empty');
      list.sort((a, b) => (a.id < b.id ? -1 : 1));
      DATA = list;
      return DATA;
    }).finally(() => { LOADING = null; });
    return LOADING;
  }
  function st() {
    let o = null;
    try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { o = null; }
    if (!o || typeof o !== 'object' || Array.isArray(o)) o = {};
    if (!o.done || typeof o.done !== 'object') o.done = {};
    if (!o.steps || typeof o.steps !== 'object') o.steps = {};
    return o;
  }
  function save(o) {
    const old = dayKey(Date.now() - 60 * 864e5);
    Object.keys(o.steps).forEach(k => { if (k < old) delete o.steps[k]; });
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* private mode */ }
  }
  /** Ukrainian: the RU / UA switch of this window, else the app's translation language (Settings → «Язык перевода») */
  const uk = () => { const l = st().lang; if (l === 'uk' || l === 'ru') return l === 'uk'; try { return !!(window.Store && Store.settings && Store.settings.transLang === 'uk'); } catch (e) { return false; } };
  /** a speaker's name in the language of the translation */
  const whoName = (p, key) => { const d = (p.dialog || []).find(x => x.who === key) || {}; return uk() && d.who_uk ? d.who_uk : key; };
  const tr = (p, f) => (uk() && p[f + '_uk'] ? p[f + '_uk'] : p[f + '_ru'] || '');
  const trw = (x) => (uk() && x.uk ? x.uk : x.ru);

  /** the learner's level (set by hand in the window, else the app's level) */
  function myLevel() {
    const s = st();
    if (LV.includes(s.lvl)) return s.lvl;
    let L = 'A1';
    try { if (window.Levels && Levels.currentLevel) L = Levels.currentLevel() || 'A1'; } catch (e) { L = 'A1'; }
    return LV.includes(L) ? L : /^C/.test(L) ? 'C1' : 'A1';
  }
  /** the day a level was first shown on this device (its walk through the phrases starts there) */
  function startOf(L, today) {
    const s = st();
    if (!s.start || typeof s.start !== 'object') s.start = {};
    if (!Number.isFinite(s.start[L])) { s.start[L] = today; save(s); }
    return s.start[L];
  }
  const ORDERS = new Map();
  /** the level's phrases in a fixed shuffled order — one order per round (seeded: the same on every reload) */
  function orderOf(a, L, round) {
    const k = L + '|' + round + '|' + a.length + '|' + a[0].id;
    if (ORDERS.has(k)) return ORDERS.get(k);
    const r = rng(hashOf(k)), o = a.slice();
    for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = o[i]; o[i] = o[j]; o[j] = t; }
    // a new round never starts with the phrase the last one ended on
    if (round > 0 && o.length > 2 && o[0] === orderOf(a, L, round - 1)[o.length - 1]) { const t = o[0]; o[0] = o[1]; o[1] = t; }
    ORDERS.set(k, o);
    return o;
  }
  /** deterministic: the same phrase all day; day by day through the whole level in a shuffled order — no repeats until
   *  every phrase of the level has been shown, then a new round in another order */
  function pick(list, t, lvl) {
    const L = LV.includes(lvl) ? lvl : myLevel();
    let a = list.filter(p => p.level === L);
    if (!a.length) a = list;
    const k = dayNum(t) - startOf(L, dayNum(Date.now())), n = a.length;
    const round = k < 0 ? 0 : Math.floor(k / n);
    return orderOf(a, L, round)[((k % n) + n) % n];
  }
  async function phraseFor(off = 0) {
    const list = await load();
    const t = Date.now() + off * 864e5;
    // a day already done keeps its phrase (a level change later does not rewrite history)
    const doneId = st().done[dayKey(t)];
    return list.find(p => p.id === doneId) || pick(list, t);
  }

  /* ---------- 🎨 the scene: our own flat drawing — the place, the people of the dialogue with their roles, a few things ---------- */
  const R = (x, y, w, h, f, rx, ex) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"${rx ? ` rx="${rx}"` : ''} fill="${f}"${ex || ''}/>`;
  const C = (x, y, r, f, ex) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"${ex || ''}/>`;
  const P = (d, f, ex) => `<path d="${d}" fill="${f}"${ex || ''}/>`;
  const L = (d, s, w, ex) => `<path d="${d}" fill="none" stroke="${s}" stroke-width="${w}" stroke-linecap="round"${ex || ''}/>`;
  const T = (x, y, s, t, f) => `<text x="${x}" y="${y}" font-size="${s}" fill="${f}" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700">${t}</text>`;
  const G = (x, y, s, inner) => `<g transform="translate(${x} ${y})${s && s !== 1 ? ` scale(${s})` : ''}">${inner}</g>`;
  /** a small deterministic random generator — the same phrase always gets the same people */
  const hashOf = s => [...String(s)].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  const rng = seed => () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pickOf = (r, a) => a[Math.floor(r() * a.length)];

  /** the places: [icon, Russian, Ukrainian] */
  const SETTINGS = {
    shop: ['🛒', 'В магазине', 'У магазині'], pharmacy: ['💊', 'В аптеке', 'В аптеці'], doctor: ['🩺', 'У врача', 'У лікаря'],
    school: ['🏫', 'В школе', 'У школі'], kindergarten: ['🧸', 'В детском саду', 'У садочку'], office: ['💼', 'На работе', 'На роботі'],
    street: ['🏘', 'На улице', 'На вулиці'], bus: ['🚌', 'В автобусе', 'В автобусі'], train: ['🚆', 'В поезде', 'У поїзді'],
    home: ['🏠', 'Дома', 'Удома'], kitchen: ['🍳', 'На кухне', 'На кухні'], cafe: ['☕', 'В кафе', 'У кав’ярні'],
    restaurant: ['🍽', 'В ресторане', 'У ресторані'], park: ['🌳', 'В парке', 'У парку'], police: ['🚓', 'В полиции', 'У поліції'],
    car: ['🚗', 'В машине', 'В машині'], nav: ['🏢', 'В NAV', 'У NAV'], bank: ['🏦', 'В банке', 'У банку'],
    gym: ['🏋', 'В спортзале', 'У спортзалі'], hospital: ['🏥', 'В больнице', 'У лікарні'], beach: ['🏖', 'На пляже', 'На пляжі'],
    mountain: ['⛰', 'В горах', 'У горах'], phone: ['📞', 'Разговор по телефону', 'Розмова телефоном'],
  };
  const OUTDOOR = ['street', 'park', 'beach', 'mountain'];

  /* the backdrops: wall + floor + the furniture of the place; → { svg, sky: where weather shows (sky or a window), front: drawn over the people } */
  function backdrop(set, xs, ppl, r) {
    const wall = (c, f, fy = 150) => R(0, 0, 360, 200, c) + R(0, fy, 360, 200 - fy, f);
    const win = (x, y, w, h, sky) => R(x - 3, y - 3, w + 6, h + 6, '#fff', 4) + R(x, y, w, h, sky || '#bfe3f7', 2);
    // shelves with goods: one path per colour (keeps the drawing small)
    const shelf = (x, y, w, h, wood, items) => {
      let s = R(x, y, w, h, wood, 4);
      const by = {}, box = (c, bx, by0, bw, bh) => { by[c] = (by[c] || '') + `M${bx} ${by0}h${bw}v${bh}h-${bw}z`; };
      for (let row = 0; row < 3; row++) {
        const sy = Math.round(y + 8 + row * ((h - 12) / 3)), bh = Math.round((h - 12) / 3 - 6);
        s += R(x + 4, sy + bh, w - 8, 4, 'rgba(0,0,0,.25)');
        for (let cx = x + 8; cx < x + w - 16;) {
          const bw = items === 'box' ? 14 : 9 + Math.floor(r() * 7), hh = bh - Math.floor(r() * bh * 0.4);
          box(items === 'box' ? '#fdfdfd' : pickOf(r, ['#e85d5d', '#5da0e8', '#f2c14e', '#6cc070', '#e88a3d', '#9b6ce8']), cx, sy + bh - hh, bw, hh);
          if (items === 'box') box(pickOf(r, ['#3aa57a', '#5da0e8', '#e85d5d']), cx, sy + bh - Math.round(hh / 2), bw, 3);
          cx += bw + 4;
        }
      }
      return s + Object.keys(by).map(c => P(by[c], c)).join('');
    };
    const house = (x, w, h, c, roof) => R(x, 150 - h, w, h, c) + P(`M${x - 4} ${150 - h}l${w / 2 + 4} -${h * 0.45}l${w / 2 + 4} ${h * 0.45}z`, roof) + R(x + w * 0.18, 150 - h * 0.78, w * 0.24, h * 0.24, '#fff8dc') + R(x + w * 0.58, 150 - h * 0.78, w * 0.24, h * 0.24, '#fff8dc');
    const tree = (x, y, s) => R(x - 4 * s, y, 8 * s, 40 * s, '#7a5a3a') + C(x, y - 4 * s, 26 * s, '#5f9e4f') + C(x - 12 * s, y + 6 * s, 16 * s, '#6cae5a');
    const teacher = ppl.findIndex(q => q.role === 'teacher');
    switch (set) {
      case 'shop': return { svg: wall('#fbe8c8', '#e3cfae') + shelf(14, 26, 150, 120, '#c98b4e') + shelf(196, 26, 150, 120, '#c98b4e') };
      case 'pharmacy': return { svg: wall('#e4f3ef', '#cfe3de') + shelf(16, 34, 328, 112, '#e9eef0', 'box') };
      case 'doctor': return { svg: wall('#e3f0f7', '#c9dbe6') + R(24, 30, 48, 64, '#fff', 3) + T(48, 50, 14, 'E', '#333') + T(48, 66, 10, 'F P', '#333') + T(48, 80, 7, 'T O Z', '#333')
        + R(140, 28, 56, 40, '#f6efe0', 3, ' stroke="#b59b6b" stroke-width="3"') + L('M150 42h36M150 52h28', '#c9b88f', 2) + R(236, 116, 116, 14, '#9fd3e6', 6) + R(244, 130, 6, 20, '#78909c') + R(338, 130, 6, 20, '#78909c') + R(236, 104, 30, 14, '#fff', 6) };
      case 'school': {
        const bx = Math.max(16, Math.min(344 - 180, (teacher >= 0 ? xs[teacher] : 180) - 90));
        return { svg: wall('#eef5e4', '#d8c7a6') + R(bx - 6, 22, 192, 92, '#8a5a2b', 6) + R(bx, 28, 180, 80, '#2f5d46', 3) + T(bx + 90, 60, 22, pickOf(r, ['A B C', 'Hei!', '2 + 2 = 4', 'å være']), '#fff') + L(`M${bx + 30} 84h50M${bx + 30} 94h80`, 'rgba(255,255,255,.6)', 2) + R(bx, 108, 180, 5, '#a8865a') };
      }
      case 'kindergarten': {
        let s = wall('#fff1d6', '#b9d98c', 152) + L('M0 18q45 16 90 0t90 0t90 0t90 0', '#c98b4e', 1.5);
        ['#e85d5d', '#f2c14e', '#5da0e8', '#6cc070', '#9b6ce8', '#e88a3d', '#e85d5d', '#5da0e8'].forEach((c, i) => { const x = 14 + i * 44, y = 18 + (i % 2 ? 6 : 6); s += P(`M${x} ${y}h20l-10 16z`, c); });
        s += R(20, 120, 22, 22, '#e85d5d', 3) + R(44, 120, 22, 22, '#5da0e8', 3) + R(32, 98, 22, 22, '#f2c14e', 3) + T(31, 136, 13, 'A', '#fff') + T(55, 136, 13, 'B', '#fff') + T(43, 114, 13, 'C', '#fff')
          + R(206, 48, 50, 40, '#fff', 2) + C(222, 64, 8, '#f2c14e') + P('M208 86l18-14 12 8 16-12v18z', '#6cc070');
        return { svg: s };
      }
      case 'office': return { svg: wall('#ece8f6', '#cfc8de') + win(22, 26, 96, 80, '#c7e2f5') + P('M22 106v-30h14v-14h12v24h10v-34h16v40h12v-20h14v34z', '#9fb4c8') + R(150, 30, 84, 56, '#fff', 3) + L('M160 74l16-14 14 8 16-20 18 10', '#7c5cff', 3)
          + R(318, 120, 22, 30, '#c98b4e', 3) + C(329, 108, 16, '#5f9e4f') + C(320, 96, 10, '#6cae5a'), sky: { x: 22, y: 26, w: 96, h: 50 } };
      case 'street': return { svg: R(0, 0, 360, 200, '#cfe7fb') + house(8, 70, 80, '#c0473a', '#7a2b22') + house(96, 64, 70, '#f4efe6', '#5c6b7a') + house(184, 76, 86, '#e9c46a', '#8a5a2b') + house(284, 70, 74, '#6d9dc5', '#36506b')
          + R(0, 150, 360, 50, '#c9c9c9') + R(0, 148, 360, 4, '#9e9e9e') + R(176, 64, 4, 86, '#546e7a') + R(168, 56, 20, 10, '#546e7a', 4), sky: { x: 0, y: 0, w: 360, h: 60, out: true } };
      case 'bus': case 'train': {
        const tr = set === 'train';
        let s = wall(tr ? '#ebe6dc' : '#e3ecf3', tr ? '#8d8f9a' : '#7f8c99', 156);
        for (let i = 0; i < 3; i++) {
          const x = 14 + i * 116;
          s += win(x, 30, 100, 66, '#bfe3f7') + (tr ? P(`M${x} 96l26-30 18 14 24-28 32 30v14z`, '#7d9bb5') + P(`M${x + 50} 66l18-12 12 9z`, '#fff') + R(x, 84, 100, 12, '#8cc970')
            : R(x, 80, 100, 16, '#9e9e9e') + R(x + 10, 56, 26, 24, '#e0a96d') + R(x + 56, 62, 30, 18, '#c0473a'));
        }
        s += tr ? R(0, 14, 360, 5, '#9e9e9e') + [40, 150, 260].map(x => R(x, 122, 64, 34, '#b8413d', 10)).join('') : R(0, 16, 360, 3, '#b0bec5') + [60, 150, 240, 320].map(x => L(`M${x} 19v10`, '#b0bec5', 2) + C(x, 34, 5, 'none', ' stroke="#f2c14e" stroke-width="2.5"')).join('') + R(176, 18, 8, 182, '#f2c14e') + [20, 250].map(x => R(x, 124, 70, 32, '#3f6fb5', 8)).join('');
        return { svg: s, sky: { x: 14, y: 30, w: 100, h: 50 } };
      }
      case 'home': return { svg: wall('#f6e7df', '#c9a27e') + R(150, 26, 64, 44, '#8a5a2b', 3) + R(155, 31, 54, 34, '#bfe3f7') + P('M155 65l18-16 12 8 10-6 14 14z', '#6cae5a') + R(52, 104, 256, 46, '#7f9ccf', 14) + R(44, 116, 24, 34, '#6a87bb', 8) + R(292, 116, 24, 34, '#6a87bb', 8)
          + R(334, 40, 4, 110, '#8a7a6a') + P('M322 40h28l-6-20h-16z', '#f2c14e') + R(14, 124, 20, 26, '#c98b4e', 3) + C(24, 110, 15, '#5f9e4f') };
      case 'kitchen': {
        let s = wall('#e8f2ee', '#c9b49a', 152);
        for (let y = 60; y < 124; y += 16) s += L(`M0 ${y}h360`, 'rgba(0,0,0,.06)', 1);
        s += [0, 72, 144, 216].map(x => R(x + 4, 8, 64, 46, '#f4f1ea', 3) + R(x + 32, 44, 8, 3, '#9e9e9e')).join('') + R(0, 124, 300, 8, '#bcaaa4') + R(0, 132, 300, 20, '#f4f1ea') + R(306, 30, 50, 122, '#eceff1', 6) + R(312, 80, 3, 16, '#9e9e9e')
          + R(110, 108, 26, 16, '#78909c', 3) + R(106, 106, 34, 4, '#546e7a', 2);
        return { svg: s };
      }
      case 'cafe': return { svg: wall('#f2e2d0', '#b58a63') + R(128, 32, 104, 56, '#2f3b36', 4) + T(180, 54, 12, 'KAFFE 39,-', '#fff') + T(180, 72, 12, 'BOLLE 25,-', '#ffe7a8')
          + [56, 304].map(x => L(`M${x} 0v26`, '#555', 1.5) + P(`M${x - 14} 40a14 14 0 0 1 28 0z`, '#e0774f')).join('') + R(150, 156, 60, 6, '#8a5a2b', 3) + R(177, 160, 6, 40, '#8a5a2b') };
      case 'restaurant': return { svg: wall('#f1e0da', '#7a4a3a', 150) + R(0, 104, 360, 46, '#c98d7c') + P('M0 0h40q-6 60 0 150H0z', '#9c2f3f') + P('M360 0h-40q6 60 0 150h40z', '#9c2f3f')
          + [120, 240].map(x => R(x - 3, 40, 6, 14, '#f2c14e') + C(x, 38, 6, '#ffe08a', ' opacity=".8"')).join('') + R(140, 150, 80, 10, '#fff', 3) + R(176, 136, 8, 14, '#fff8e1') + C(180, 134, 3, '#ffb300') };
      case 'park': return { svg: R(0, 0, 360, 200, '#d4ecfb') + P('M0 120q90-40 180-10t180-14v104H0z', '#a8d5a2') + R(0, 140, 360, 60, '#8cc970') + tree(36, 90, 1.1) + tree(196, 84, .9) + tree(330, 92, 1.15)
          + R(140, 126, 80, 6, '#8a5a2b', 2) + R(146, 132, 4, 14, '#6d4524') + R(210, 132, 4, 14, '#6d4524') + R(140, 114, 80, 5, '#8a5a2b', 2), sky: { x: 0, y: 0, w: 360, h: 80, out: true } };
      case 'police': {
        let s = wall('#e1e7f0', '#b9c3d1') + R(110, 28, 140, 30, '#1f2a3a', 4) + T(180, 49, 17, 'POLITI', '#fff') + R(110, 58, 140, 7, '#fff');
        for (let i = 0; i < 14; i++) if (i % 2) s += R(110 + i * 10, 58, 10, 7, '#1f2a3a');
        return { svg: s + R(24, 66, 60, 64, '#d7c8a8', 3) + R(30, 72, 22, 16, '#fff') + R(56, 78, 22, 20, '#fff') + R(36, 96, 26, 20, '#fff') + R(296, 70, 44, 60, '#fff', 3, ' stroke="#9aa5b4" stroke-width="2"') };
      }
      case 'car': return { svg: R(0, 0, 360, 200, '#cfe7fb') + P('M0 110q90-26 180-8t180-6v104H0z', '#8cc970') + P('M150 200l26-98h8l26 98z', '#7d8790') + L('M180 112v10M180 134v14M180 162v20', '#fff', 3)
          + P('M0 0h360v16H0zM0 0h34l-20 130H0zM360 0h-34l20 130h14z', '#37474f') + R(160, 16, 40, 12, '#546e7a', 4), front: R(0, 172, 360, 28, '#455a64') + R(0, 168, 360, 6, '#37474f', 3), sky: { x: 40, y: 16, w: 280, h: 70, out: true } };
      case 'nav': return { svg: wall('#e6ecf7', '#c5cfdf') + R(150, 30, 60, 28, '#c8102e', 6) + T(180, 50, 16, 'NAV', '#fff') + R(30, 34, 70, 30, '#2f3b52', 4) + T(65, 55, 15, '№ 17', '#ffd34d') + R(270, 30, 60, 76, '#fff', 3) + L('M278 44h44M278 54h34M278 64h40M278 74h30', '#cbd7ee', 3) };
      case 'bank': return { svg: wall('#e8efe9', '#cdd8cf') + R(140, 30, 80, 28, '#2e5e4e', 6) + C(158, 44, 7, '#f2c14e') + T(190, 50, 14, 'BANK', '#fff') + R(300, 60, 46, 90, '#90a4ae', 4) + R(308, 70, 30, 22, '#263238') + R(310, 100, 26, 4, '#455a64') + R(22, 30, 70, 50, '#fff', 3) + L('M30 70l14-12 12 6 16-16 14 8', '#2e9e5b', 3) };
      case 'gym': {
        let s = wall('#e8edf3', '#9fb0c2', 148) + R(120, 20, 120, 96, '#d6e4ee', 3) + L('M140 30l24 70M190 28l20 60', 'rgba(255,255,255,.8)', 4) + R(14, 96, 80, 6, '#546e7a') + R(14, 130, 80, 6, '#546e7a') + R(20, 96, 4, 52, '#546e7a') + R(84, 96, 4, 52, '#546e7a');
        [28, 46, 64].forEach(x => { s += R(x, 88, 14, 8, '#263238', 3) + R(x, 122, 14, 8, '#263238', 3); });
        for (let y = 30; y < 150; y += 14) s += R(300, y, 50, 4, '#c98b4e');
        return { svg: s + R(298, 24, 5, 126, '#a0703c') + R(347, 24, 5, 126, '#a0703c') };
      }
      case 'hospital': return { svg: wall('#e6f2f2', '#c4dad9') + P('M0 0h70v150H0z', '#9fd3cf') + L('M18 10v140M40 10v140M60 10v140', '#86c0bb', 2) + R(240, 84, 12, 66, '#b0bec5') + R(240, 112, 112, 22, '#fff', 4) + R(270, 112, 82, 22, '#7fb3e0', 4) + R(250, 100, 28, 14, '#fff', 6)
          + R(140, 30, 54, 38, '#263238', 4) + L('M146 50h10l5-10 6 20 5-10h16', '#4caf50', 2.5) + R(108, 20, 3, 130, '#90a4ae') + R(100, 22, 18, 26, '#e3f2fd', 4, ' stroke="#90a4ae"') };
      case 'beach': return { svg: R(0, 0, 360, 200, '#bfe6fb') + R(0, 92, 360, 40, '#4fb3d9') + L('M20 106q10-6 20 0t20 0M220 116q10-6 20 0t20 0M120 122q10-6 20 0t20 0', '#fff', 2) + R(0, 130, 360, 70, '#f3dca6')
          + R(318, 70, 4, 80, '#8a5a2b') + P('M280 74q40-46 82 0z', '#e85d5d') + P('M302 74q18-46 40 0z', '#fff') + P('M60 100l14-24v24zM58 102h34l-6 6H62z', '#fff'), sky: { x: 0, y: 0, w: 360, h: 80, out: true } };
      case 'mountain': return { svg: R(0, 0, 360, 200, '#cde8fb') + P('M-10 140L80 40l60 60 50-70 90 110z', '#7d9bb5') + P('M80 40l-22 24 12 6 10-8 12 8 12-6zM190 30l-22 30 14 4 8-10 12 10 10-6z', '#fff') + P('M180 140l80-70 110 70z', '#93b0c8') + P('M260 70l-20 18 12 4 8-8 10 8 8-4z', '#fff')
          + R(0, 136, 360, 64, '#8fc27a') + R(300, 112, 40, 26, '#b03a2e') + P('M296 112l24-18 24 18z', '#4e342e') + R(314, 122, 10, 16, '#fff8dc') + C(40, 140, 6, '#9e9e9e') + C(48, 134, 5, '#bdbdbd') + C(42, 130, 4, '#9e9e9e'), sky: { x: 0, y: 0, w: 360, h: 40, out: true } };
      case 'phone': {
        const mid = ppl.length > 2 ? 140 : 180;
        return { svg: R(0, 0, mid, 200, '#dbeafe') + R(mid, 0, 360 - mid, 200, '#fde8d8') + win(18, 22, 60, 44) + R(mid + 40, 26, 40, 30, '#e88a3d', 3) + R(330, 120, 16, 30, '#c98b4e', 3) + C(338, 108, 12, '#5f9e4f')
          + L(`M${mid} 0v200`, '#fff', 4, ' stroke-dasharray="10 8"'), sky: { x: 18, y: 22, w: 60, h: 44 } };
      }
      default: return { svg: wall('#e9f5e9', '#c8e6c8') + R(150, 150, 60, 6, '#8a5a2b', 3), sky: null };
    }
  }

  /* the people: flat, friendly, waist-up — role by clothes, gender by hair, age by size / grey hair / glasses */
  const SKIN = ['#f6d2b8', '#eebf98', '#d9a27a', '#b97d56', '#8d5a3b', '#6b4430'];
  const HAIR = ['#2b1d16', '#4a2f22', '#7a4a2b', '#a0522d', '#c9a04a', '#e3c27a', '#1c1c1c', '#b5532f'];
  const GREY = ['#c9c9c9', '#a7a7a7', '#e2e2e2', '#8f8f8f'];
  const CLOTH = ['#4f7bd9', '#e0774f', '#3aa57a', '#9b6ce8', '#d9466a', '#2f8fa0', '#f2a93b', '#5c6bc0', '#8d6e63', '#26a69a', '#ef7f9b', '#607d8b'];
  const TORSO = 'M-31 0v-36c0-21 14-33 31-33s31 12 31 33v36z';
  const COUNTER = ['cashier', 'seller', 'pharmacist', 'receptionist'];
  const COUNTER_AT = ['shop', 'pharmacy', 'nav', 'bank', 'cafe', 'police', 'train'];
  const shade = (c, k) => { const n = parseInt(c.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return '#' + ((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0'); };

  function outfit(q, set, r, cl) {
    const role = q.role, dark = shade(cl, 0.75);
    const lanyard = (c) => L('M-11-67l11 26 11-26', c || '#c8102e', 2) + R(-6, -44, 12, 15, '#fff', 2, ' stroke="#90a4ae"');
    const shirtV = (c) => P('M-10-69l10 17 10-17z', c || '#fff');
    const coat = (inner, steth) => P(TORSO, '#f7f9fb', ' stroke="#cfd8dc" stroke-width="1.5"') + shirtV(inner) + L('M-10-69l6 24M10-69l-6 24M0-52v52', '#cfd8dc', 1.5) + R(14, -26, 11, 9, '#eceff1', 2)
      + (steth ? L('M-12-68c-5 22 3 32 12 32s17-10 12-32', '#546e7a', 2.5) + C(0, -36, 4, '#90a4ae') : '');
    const blazer = (c) => P(TORSO, c) + shirtV('#fff') + P('M-10-69l10 17-13 12-5-22zM10-69l-10 17 13 12 5-22z', shade(c, 0.8)) + P('M-2.5-60h5l2 20-4.5 5-4.5-5z', pickOf(r, ['#c62828', '#1565c0', '#6a1b9a', '#2e7d32'])) + C(0, -16, 2, shade(c, 0.6));
    const cap = (band, checker) => P('M-23-110h46l-2-10c-4-6-12-9-21-9s-17 3-21 9z', '#1f2a3a') + R(-23, -114, 46, 6, band) + (checker ? [-19, -11, -3, 5, 13].map(x => R(x, -114, 4, 6, '#1f2a3a')).join('') : '') + P('M-25-110q14 9 36 2l-2-3z', '#111') + C(0, -121, 3, '#f2c14e');
    switch (role) {
      case 'doctor': return { body: coat('#7fb3e0', true) };
      case 'nurse': return { body: coat('#4fb3a9', true) + R(-22, -40, 12, 6, '#4fb3a9', 2) };
      case 'pharmacist': return { body: coat('#3aa57a', false) + R(-22, -40, 12, 6, '#3aa57a', 2) };
      case 'police': return { body: P(TORSO, '#1f2a3a') + P('M-25 0v-44l9-24h32l9 24v44z', '#2c3a4f') + R(-25, -30, 50, 4, '#d7dde5') + R(-25, -16, 50, 4, '#d7dde5') + T(0, -36, 7, 'POLITI', '#fff'), hat: cap('#fff', true) };
      case 'conductor': return { body: P(TORSO, '#2d4a7a') + shirtV('#fff') + C(0, -30, 2, '#f2c14e') + C(0, -16, 2, '#f2c14e') + R(14, -34, 10, 6, '#f2c14e', 1), hat: cap('#c62828', false) };
      case 'waiter': return { body: P(TORSO, '#fafafa', ' stroke="#ddd"') + P('M-27 0v-46l17-22 10 16 10-16 17 22v46z', '#263238') + P('M-8-66l8 4 8-4v8l-8-4-8 4z', '#b71c1c') };
      case 'boss': case 'interviewer': return { body: blazer(pickOf(r, ['#37474f', '#263a5e', '#4a3b5c', '#3e4e3a'])) };
      case 'candidate': return { body: blazer(pickOf(r, ['#5c6b80', '#455a64', '#6d5b4b'])) };
      case 'cashier': return { body: P(TORSO, cl) + P('M-12-69l12 10 12-10z', dark) + R(8, -46, 14, 7, '#fff', 1.5) };
      case 'seller': case 'worker': if (role === 'worker' && !['shop', 'cafe', 'restaurant'].includes(set)) break;
        return { body: P(TORSO, cl) + P('M-19 0v-42h38v42z', pickOf(r, ['#2e7d32', '#c62828', '#37474f', '#6d4c41'])) + L('M-19-42l-3-24M19-42l3-24', '#455a64', 3) + R(6, -38, 10, 5, '#fff', 1) };
      case 'officer': case 'staff': case 'receptionist': return { body: P(TORSO, cl) + shirtV('#fff') + lanyard() };
      case 'teacher': return { body: P(TORSO, cl) + P('M-8-69h16l-2 69h-12z', '#fafafa') + C(0, -40, 1.8, dark) + C(0, -24, 1.8, dark) + C(0, -8, 1.8, dark) };
      case 'coach': return { body: P(TORSO, cl) + L('M-24-56v56M24-56v56', '#fff', 3) + L('M0-62v62', dark, 1.5) + L('M-10-68q10 24 20 0', '#333', 1.2) + R(-3, -46, 7, 5, '#c0c0c0', 1.5) };
      case 'student': return { body: P(TORSO, cl) + L('M-17-69q17 16 34 0', dark, 6) + L('M-5-60v14M5-60v14', '#fff', 1.5) };
      case 'pupil': case 'child': return { body: P(TORSO, cl) + P('M-8-69q8 8 16 0z', '#fff8') + (role === 'pupil' ? L('M-21-62v44M21-62v44', '#455a64', 4) : C(0, -34, 6, '#fff', ' opacity=".7"')) };
      case 'patient': if (set === 'hospital') return { body: P(TORSO, '#b3d4ec') + [-14, 2, 16, -6, 10].map((x, i) => C(x, -50 + i * 10, 1.8, '#7fa8c9')).join('') }; break;
      default: break;
    }
    // everyday clothes: a sweater, a V-neck, a zip jacket, a lusekofte, stripes
    const v = Math.floor(r() * 5);
    if (v === 1) return { body: P(TORSO, cl) + P('M-10-69l10 16 10-16z', '#fafafa') };
    if (v === 2) return { body: P(TORSO, cl) + L('M0-62v62', dark, 2) + P('M-12-69q12 9 24 0l-2-4q-10 7-20 0z', dark) };
    if (v === 3) return { body: P(TORSO, cl) + P('M-26-50q26 12 52 0l4-10q-30 14-60 0z', '#fafafa') + [-20, -10, 0, 10, 20].map(x => C(x, -50 + Math.abs(x) / 5, 2, cl)).join('') };
    if (v === 4) return { body: P(TORSO, cl) + R(-31, -40, 62, 5, '#fff8') + R(-31, -26, 62, 5, '#fff8') + R(-31, -12, 62, 5, '#fff8') + P('M-8-69q8 8 16 0z', dark) };
    return { body: P(TORSO, cl) + P('M-8-69q8 8 16 0z', dark) };
  }

  const isKid = q => q.age === 'child' || q.role === 'child' || q.role === 'pupil';
  const sizeOf = q => (isKid(q) ? 0.68 : 0.86); // waist-up; the heads stay below the bubble
  /** one person at (x, bottom); look: the eyes turn to the others → { svg, sk: the skin colour (for the hands) } */
  function personSvg(q, x, look, set, r) {
    const f = q.g === 'f' || (q.g !== 'm' && r() < 0.5), senior = q.age === 'senior', kid = isKid(q);
    const sk = pickOf(r, SKIN), hc = senior ? pickOf(r, GREY) : pickOf(r, HAIR), cl = pickOf(r, CLOTH), o = outfit(q, set, r, cl);
    const st = Math.floor(r() * 5), glasses = senior || r() < 0.14, beard = !f && !kid && r() < 0.25;
    let back = '', top = '';
    if (f) {
      if (kid) { back = st % 2 ? C(-24, -100, 8, hc) + C(24, -100, 8, hc) : P('M16-110c14 4 16 26 8 38-2-12-6-20-12-26z', hc); top = P('M-22-96c-2-17 9-27 22-27s24 10 22 27c-5-9-13-13-22-13s-17 4-22 13z', hc); }
      else if (senior && st < 3) { back = C(0, -124, 9, hc); top = P('M-22-95c-3-17 8-28 22-28s25 11 22 28c-4-8-12-13-22-13s-18 5-22 13z', hc) + C(-20, -94, 5, hc) + C(20, -94, 5, hc); }
      else if (st === 0) { back = P('M-23-100c-4 22-3 40 3 48h40c6-8 7-26 3-48z', hc); top = P('M-22-96c-2-17 9-27 22-27s24 10 22 27c-5-9-13-13-22-13s-17 4-22 13z', hc); }
      else if (st === 1) { back = P('M-24-100c-3 14-2 22 1 27h46c3-5 4-13 1-27z', hc); top = P('M-23-94c-2-19 9-29 23-29s25 10 23 29c-8-7-14-14-23-14s-15 7-23 14z', hc); }
      else if (st === 2) { back = C(0, -125, 10, hc); top = P('M-22-96c-2-17 9-27 22-27s24 10 22 27c-5-9-13-13-22-13s-17 4-22 13z', hc); }
      else if (st === 3) { back = P('M14-112c16 2 20 30 10 44-2-14-6-24-14-30z', hc); top = P('M-22-96c-2-17 9-27 22-27s24 10 22 27c-5-9-13-13-22-13s-17 4-22 13z', hc); }
      else { back = [[-22, -96, 9], [22, -96, 9], [-24, -82, 8], [24, -82, 8], [-20, -70, 7], [20, -70, 7]].map(a => C(a[0], a[1], a[2], hc)).join(''); top = [[-18, -110, 9], [-6, -120, 10], [8, -120, 10], [19, -110, 9]].map(a => C(a[0], a[1], a[2], hc)).join(''); }
    } else if (senior && st < 2) top = P('M-21-92c-1-8 2-14 6-16v15zM21-92c1-8-2-14-6-16v15z', hc);
    else if (st === 0 || kid) top = P('M-21-100c-1-15 9-23 21-23s22 8 21 23c-4-6-10-9-21-9s-17 3-21 9z', hc);
    else if (st === 1) top = P('M-21-99c0-16 10-25 23-24 12 1 20 10 19 23-8-8-20-12-35-6z', hc);
    else if (st === 2) top = [[-17, -108, 7], [-7, -116, 8], [6, -117, 8], [17, -108, 7], [-21, -98, 4], [21, -98, 4]].map(a => C(a[0], a[1], a[2], hc)).join('');
    else if (st === 3) top = P('M-20-103c2-12 10-18 20-18s18 6 20 18c-6-4-13-6-20-6s-14 2-20 6z', hc, ' opacity=".9"');
    else top = P('M-21-100c-1-15 9-23 21-23s22 8 21 23c-4-6-10-9-21-9s-17 3-21 9z', hc) + P('M-10-118c8-10 24-8 28 4-8-3-18-3-28-4z', hc);
    const e = look;
    const face = C(-7 + e, -98, 2.6, '#2b2b2b') + C(7 + e, -98, 2.6, '#2b2b2b') + C(-12 + e, -90, 3.5, '#f08a7a', ' opacity=".3"') + C(12 + e, -90, 3.5, '#f08a7a', ' opacity=".3"')
      + (beard ? P('M-19-94c1 18 9 26 19 26s18-8 19-26c-4 7-8 8-12 7-3-3-11-3-14 0-4 1-8 0-12-7z', hc) : '') + L(`M${-5 + e} -88q5 4 10 0`, beard ? '#f4e4d8' : '#7a3b2b', 2.2)
      + (glasses ? `<g fill="none" stroke="#3b3b3b" stroke-width="1.6">${C(-7 + e, -98, 5.5, 'none')}${C(7 + e, -98, 5.5, 'none')}${L(`M${-1.5 + e} -98h3`, '#3b3b3b', 1.6)}</g>` : '');
    return { svg: G(x, 200, sizeOf(q), R(-6, -82, 12, 14, sk) + o.body + back + C(0, -98, 21, sk) + top + face + (o.hat || '')), sk };
  }

  /* the things: drawn centred at 0,0, about 24 units */
  const THINGS = {
    phone: R(-6, -11, 12, 22, '#263238', 2.5) + R(-4.5, -8.5, 9, 15, '#7fd3ff'),
    cup: P('M-8-6h14v11a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z', '#fff', ' stroke="#8d6e63" stroke-width="1.5"') + L('M6-3a4 4 0 0 1 0 8', '#8d6e63', 2) + L('M-4-10q2-3 0-6M1-10q2-3 0-6', '#b0a49c', 1.2),
    bag: P('M-11-5h22l-2 18h-18z', '#e5a44b') + L('M-5-5v-4a5 5 0 0 1 10 0v4', '#8a5a2b', 2),
    book: R(-11, -8, 22, 16, '#d9466a', 1.5) + L('M0-8v16', '#fff', 1.5),
    prescription: R(-8, -11, 16, 22, '#fff', 1.5, ' stroke="#9aa"') + T(0, 0, 9, 'Rx', '#3aa57a') + L('M-5 4h10M-5 7h7', '#bcc', 1.2),
    ticket: R(-12, -6, 24, 12, '#ffd34d', 2) + L('M-4-6v12', '#c99a1a', 1.2, ' stroke-dasharray="2 2"'),
    laptop: R(-14, -12, 28, 18, '#37474f', 2) + R(-12, -10, 24, 14, '#9fd8ff') + P('M-17 6h34l-2 4h-30z', '#90a4ae'),
    cake: R(-14, 6, 28, 3, '#e0e0e0', 1.5) + R(-11, -4, 22, 11, '#f5c3d4', 2) + R(-11, -6, 22, 4, '#fff', 2) + L('M0-6v-6', '#ff9800', 2) + C(0, -14, 2, '#ffca28'),
    flowers: L('M0 10l-6-14M0 10l1-16M0 10l7-13', '#4caf50', 2) + C(-6, -6, 5, '#e85d7a') + C(1, -9, 5, '#f2c14e') + C(8, -5, 5, '#9b6ce8') + P('M-6 4h12l-3 9h-6z', '#a5d6a7'),
    key: C(-6, 0, 5, 'none', ' stroke="#f2b134" stroke-width="3"') + L('M-1 0h12v4M7 0v3', '#f2b134', 3),
    money: R(-13, -7, 26, 14, '#8fc98b', 2, ' stroke="#4f8a4b"') + C(0, 0, 3.5, 'none', ' stroke="#4f8a4b"') + C(12, 7, 5, '#f2c14e', ' stroke="#c99a1a"'),
    letter: R(-12, -8, 24, 16, '#fff', 1.5, ' stroke="#b0bec5"') + L('M-12-8l12 9 12-9', '#b0bec5', 1.5),
    ball: C(0, 0, 10, '#f44336') + L('M-10 0h20M0-10c5 5 5 15 0 20', '#fff', 2),
    umbrella: L('M0 30v-40', '#455a64', 2) + P('M-24-10a24 16 0 0 1 48 0q-6-4-12 0-6-4-12 0-6-4-12 0-6-4-12 0z', '#5c6bc0') + L('M0 30q0 5 4 5', '#455a64', 2),
  };
  const BIG = {
    car: R(-26, -8, 52, 14, '#e85d5d', 5) + P('M-14-8l6-10h18l8 10z', '#e85d5d') + R(-8, -16, 10, 7, '#bfe3f7') + R(4, -16, 8, 7, '#bfe3f7') + C(-14, 7, 6, '#263238') + C(14, 7, 6, '#263238'),
    bus: R(-34, -20, 68, 30, '#d93a3a', 6) + [-28, -12, 4].map(x => R(x, -15, 13, 11, '#bfe3f7', 2)).join('') + R(20, -15, 9, 20, '#bfe3f7', 2) + C(-20, 10, 6, '#263238') + C(20, 10, 6, '#263238'),
  };

  /** the weather / the clock: in the sky outdoors, in a window indoors (a small one is added when the place has none) */
  function weather(props, sky, r) {
    let s = '', box = sky;
    const w = props.filter(k => k === 'sun' || k === 'snow' || k === 'rain');
    if (w.length && !box) { box = { x: 286, y: 32, w: 60, h: 42 }; s += R(283, 29, 66, 48, '#fff', 4) + R(286, 32, 60, 42, w.includes('sun') ? '#bfe3f7' : '#c5d3df', 2); }
    if (!box) box = { x: 286, y: 32, w: 60, h: 42 };
    const rad = Math.min(16, box.h / 3);
    if (w.includes('sun')) s += G(box.x + box.w - rad - 10, Math.max(box.y + rad + 6, 46), 1, L([0, 45, 90, 135, 180, 225, 270, 315].map(a => { const c = Math.cos(a * Math.PI / 180), n = Math.sin(a * Math.PI / 180); return `M${(c * (rad + 3)).toFixed(1)} ${(n * (rad + 3)).toFixed(1)}L${(c * (rad + 8)).toFixed(1)} ${(n * (rad + 8)).toFixed(1)}`; }).join(''), '#ffc93c', 2.5) + C(0, 0, rad, '#ffd34d'));
    const big = box.out ? 1 : 0;
    // outdoors the snow / the rain fall over the whole picture (from y 30: the home card shows the drawing from there)
    const y0 = big ? 30 : box.y + 4, hgt = big ? 110 : box.h - 12;
    if (w.includes('snow')) { const k = big ? 18 : 7; for (let i = 0; i < k; i++) s += C(Math.round(box.x + 4 + r() * (box.w - 8)), Math.round(y0 + r() * hgt), big ? 2.8 : 1.8, '#fff', ' stroke="#9bb8d3" stroke-width=".7"'); }
    if (w.includes('rain')) { let d = ''; const k = big ? 18 : 8; for (let i = 0; i < k; i++) { const x = Math.round(box.x + 6 + r() * (box.w - 12)), y = Math.round(y0 + r() * hgt); d += `M${x} ${y}l-3 8`; } s += L(d, '#4a90d9', 2, ' opacity=".8"'); }
    if (props.includes('clock')) { const cx = w.length && !sky ? 252 : 322, cy = 50; s += C(cx, cy, 15, '#fff', ' stroke="#555" stroke-width="3"') + L(`M${cx} ${cy}v-9M${cx} ${cy}l7 4`, '#555', 2.5); }
    return s;
  }

  /** where the people stand */
  function placesOf(set, n) {
    if (set === 'phone') return n > 2 ? [70, 226, 306] : [90, 270];
    return n > 2 ? [72, 180, 288] : [105, 255];
  }

  /** the index of the person who says the phrase of the day (the dialogue line that holds it; else the first speaker) */
  const normT = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
  function rosterOf(p) { const ro = []; (Array.isArray(p.dialog) ? p.dialog : []).forEach(d => { if (d && d.who && !ro.includes(d.who)) ro.push(d.who); }); return ro; }
  function speakerOf(p) {
    const dlg = Array.isArray(p.dialog) ? p.dialog : [], want = normT(p.no), ro = rosterOf(p);
    const line = dlg.find(d => normT(d.no) === want) || dlg.find(d => normT(d.no).includes(want)) || dlg.find(d => want.includes(normT(d.no)) && normT(d.no).length > 6);
    return Math.max(0, line ? ro.indexOf(line.who) : 0);
  }

  /** the scene of a phrase → { svg, sx (the speaker's x in % of the width), place: [icon, name] } */
  function sceneOf(p) {
    const sc = p.scene;
    if (!sc || !Array.isArray(sc.people) || !sc.people.length) return topicScene(p);
    const set = SETTINGS[sc.setting] ? sc.setting : 'home';
    const ppl = sc.people.slice(0, 3).map(q => (q && typeof q === 'object' ? q : {}));
    if (ppl.length < 2) ppl.push({ role: 'friend' });
    const r = rng(hashOf(p.id));
    const xs = placesOf(set, ppl.length);
    const bd = backdrop(set, xs, ppl, rng(hashOf(p.id + '|bg')));
    const props = (Array.isArray(sc.props) ? sc.props : []).filter(k => THINGS[k] || BIG[k] || ['sun', 'snow', 'rain', 'clock'].includes(k)).slice(0, 3);
    // a counter in front of the cashier / the pharmacist …, a desk in front of the doctor / the boss, a wheel in front of the driver
    let wheelAt = ppl.findIndex(q => q.role === 'driver');
    if (wheelAt < 0 && set === 'car') wheelAt = ppl.findIndex(q => q.age !== 'child' && q.role !== 'child' && q.role !== 'police');
    let people = '', front = '';
    const hands = [];
    ppl.forEach((q, i) => {
      const x = xs[i], look = set === 'phone' ? 0 : x < 170 ? 2 : x > 190 ? -2 : (i ? 2 : -2);
      const pr = personSvg(q, x, look, set, rng(hashOf(p.id + '#' + i)));
      people += pr.svg;
      const kid = isKid(q), s = sizeOf(q);
      const counter = COUNTER.includes(q.role) || (['officer', 'staff', 'worker'].includes(q.role) && COUNTER_AT.includes(set));
      const desk = !counter && ((q.role === 'doctor' && set === 'doctor') || (['boss', 'interviewer'].includes(q.role) && set === 'office') || (q.role === 'officer' && set === 'office'));
      if (counter) {
        const c = { pharmacy: '#e9eef0', nav: '#8a97ad', bank: '#7d9a8c', cafe: '#8a5a2b', police: '#8a97ad', train: '#8a97ad' }[set] || '#a8774a';
        front += R(x - 50, 164, 100, 36, c) + R(x - 54, 159, 108, 8, shade(c, 1.15), 3) + (['bank', 'police'].includes(set) ? R(x - 46, 124, 92, 36, '#e3f2fd', 2, ' opacity=".45" stroke="#90a4ae"') : '')
          + (set === 'pharmacy' ? R(x - 7, 170, 14, 26, '#3aa57a', 2) + R(x - 13, 176, 26, 14, '#3aa57a', 2) : '');
        hands.push({ x: x + (x < 180 ? 26 : -26), y: 151, on: 1, sk: pr.sk });
      } else if (desk) {
        front += R(x - 48, 172, 96, 28, '#b98a5e') + R(x - 52, 168, 104, 7, '#c99a6e', 3) + (props.includes('laptop') ? '' : R(x + 14, 162, 18, 7, '#fff', 1));
        hands.push({ x: x + (x < 180 ? 24 : -24), y: 160, on: 1, sk: pr.sk });
      } else hands.push({ x: x + (x < 180 ? 1 : -1) * 18 * s, y: 200 - 26 * s, on: 0, kid, sk: pr.sk });
      if (i === wheelAt) front += G(x, 176, 1, C(0, 0, 22, 'none', ' stroke="#263238" stroke-width="6"') + L('M-20 2h40M0 2v18', '#263238', 4) + C(0, 2, 5, '#455a64'));
      // on the phone: the phone at the ear
      if (set === 'phone' && i < 2) front += G(x + 23 * s, 200 - 92 * s, 0.9 * s, `<g transform="rotate(-12)">${THINGS.phone}</g>`);
    });
    // the things: the held ones in a hand (the speaker's first), the car / the bus behind the people, the weather and the clock on the wall / in the sky
    let behind = '', held = '';
    const order = ppl.map((q, i) => i).sort((a, b) => (a === speakerOf(p) ? -1 : b === speakerOf(p) ? 1 : a - b));
    let hk = 0;
    const nIn = ppl.map(() => 0);
    props.forEach(k => {
      if (BIG[k]) { if ((k === 'car' && set === 'car') || (k === 'bus' && set === 'bus')) return; behind += G(ppl.length > 2 ? 330 : 180, set === 'street' || OUTDOOR.includes(set) ? 152 : 140, 0.9, BIG[k]); return; }
      if (!THINGS[k] || (k === 'phone' && set === 'phone')) return;
      const i = order[hk % order.length]; hk++;
      // a second thing for the same person: in the other hand
      const h = nIn[i]++ ? Object.assign({}, hands[i], { x: 2 * xs[i] - hands[i].x }) : hands[i];
      if (k === 'umbrella') { held += G(h.x, h.y - 40, 1, THINGS.umbrella); return; }
      held += G(h.x, h.y, h.kid ? 0.8 : 0.92, THINGS[k]) + (h.on ? '' : C(h.x + (h.x < xs[i] ? 9 : -9), h.y + 6, 4.5, h.sk));
    });
    const sky = bd.sky || null;
    const svg = `<svg class="pd-svg" viewBox="0 0 360 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">${bd.svg}${behind}${people}${front}${bd.front || ''}${held}${weather(props, sky, rng(hashOf(p.id + '|w')))}</svg>`;
    const who = Math.min(speakerOf(p), xs.length - 1);
    const S = SETTINGS[set];
    return { svg, sx: +(xs[who] / 3.6).toFixed(1), place: [S[0], uk() ? S[2] : S[1]] };
  }

  /* ---------- the older phrases (no `scene`): the drawing by the topic ---------- */
  const PLACES = {
    butikk: { bg: ['#fde9c9', '#f6d29b'], ico: '🛒', name: 'В магазине', uk: 'У магазині' },
    lege: { bg: ['#e3f3ee', '#c5e6dc'], ico: '🩺', name: 'У врача', uk: 'У лікаря' },
    nav: { bg: ['#e6ecf7', '#cbd7ee'], ico: '🏢', name: 'В учреждении', uk: 'В установі' },
    skole: { bg: ['#eaf3df', '#cfe5b8'], ico: '🏫', name: 'Школа и садик', uk: 'Школа і садочок' },
    jobb: { bg: ['#efe8f6', '#d9cbec'], ico: '💼', name: 'На работе', uk: 'На роботі' },
    bolig: { bg: ['#f7e6e0', '#ecc9bd'], ico: '🏠', name: 'Дом и соседи', uk: 'Дім і сусіди' },
    transport: { bg: ['#e2f0f8', '#bfdced'], ico: '🚌', name: 'Транспорт', uk: 'Транспорт' },
    vaer: { bg: ['#dcecfb', '#a9cff2'], ico: '🌦', name: 'Погода', uk: 'Погода' },
    hoflighet: { bg: ['#fbeef0', '#f2d2d8'], ico: '🤝', name: 'Вежливость', uk: 'Ввічливість' },
    smalltalk: { bg: ['#e9f5e9', '#c8e6c8'], ico: '☕', name: 'Разговор', uk: 'Розмова' },
  };
  function props(topic) {
    switch (topic) {
      case 'butikk': return '<rect x="196" y="40" width="150" height="104" rx="6" fill="#c98b4e"/>' + [52, 84, 116].map(y => `<rect x="202" y="${y}" width="138" height="4" fill="#8a5a2b"/>`).join('')
        + [[208, 60, '#e85d5d'], [228, 64, '#5da0e8'], [250, 58, '#f2c14e'], [276, 62, '#6cc070'], [300, 60, '#e88a3d'], [214, 92, '#9b6ce8'], [244, 94, '#f2c14e'], [276, 90, '#5da0e8'], [312, 92, '#e85d5d']].map(([x, y, c]) => `<rect x="${x}" y="${y}" width="16" height="${84 - y + (y > 80 ? 28 : 0)}" rx="2" fill="${c}"/>`).join('')
        + '<rect x="150" y="150" width="120" height="40" rx="4" fill="#7a6a5a"/><rect x="150" y="146" width="120" height="8" rx="3" fill="#a8968a"/>';
      case 'lege': return '<rect x="250" y="34" width="56" height="56" rx="10" fill="#fff"/><rect x="272" y="42" width="12" height="40" fill="#3aa57a"/><rect x="258" y="56" width="40" height="12" fill="#3aa57a"/>'
        + '<rect x="40" y="44" width="70" height="50" rx="4" fill="#fff" stroke="#9cc" /><path d="M48 80l14-16 12 10 16-20 14 26" stroke="#3aa57a" stroke-width="3" fill="none"/><rect x="150" y="152" width="110" height="38" rx="4" fill="#d9e8e4"/>';
      case 'nav': return '<rect x="40" y="30" width="90" height="70" rx="4" fill="#fff"/><path d="M85 30v70M40 65h90" stroke="#cbd7ee" stroke-width="4"/><rect x="232" y="40" width="90" height="34" rx="6" fill="#36507a"/><text x="277" y="63" text-anchor="middle" font-size="16" font-weight="700" fill="#fff" font-family="sans-serif">№ 17</text>'
        + '<rect x="140" y="150" width="140" height="40" rx="4" fill="#8a97ad"/><rect x="190" y="118" width="40" height="30" rx="3" fill="#2f3b52"/><rect x="194" y="122" width="32" height="22" fill="#8fd0ff"/>';
      case 'skole': return '<rect x="96" y="26" width="170" height="86" rx="6" fill="#2f5d46" stroke="#8a5a2b" stroke-width="6"/><text x="181" y="78" text-anchor="middle" font-size="30" fill="#fff" font-family="Comic Sans MS, cursive, sans-serif">A B C</text>'
        + '<circle cx="320" cy="52" r="20" fill="#fff" stroke="#555" stroke-width="3"/><path d="M320 52V40M320 52l8 5" stroke="#555" stroke-width="3" stroke-linecap="round"/>';
      case 'jobb': return '<rect x="36" y="34" width="70" height="90" rx="4" fill="#fff"/><rect x="44" y="44" width="54" height="8" fill="#d9cbec"/><rect x="44" y="60" width="40" height="6" fill="#d9cbec"/><rect x="44" y="72" width="48" height="6" fill="#d9cbec"/>'
        + '<circle cx="300" cy="50" r="20" fill="#fff" stroke="#555" stroke-width="3"/><path d="M300 50V38M300 50l9-4" stroke="#555" stroke-width="3" stroke-linecap="round"/><rect x="140" y="150" width="140" height="40" rx="4" fill="#9a87b5"/><path d="M200 150c0-14 8-20 14-20s14 6 14 20" fill="#fff" opacity=".85"/>';
      case 'bolig': return '<rect x="230" y="40" width="110" height="150" fill="#d98c6c"/><rect x="262" y="104" width="44" height="86" rx="3" fill="#7a4a35"/><circle cx="298" cy="148" r="3" fill="#f2c14e"/>'
        + '<rect x="244" y="54" width="30" height="30" fill="#fff"/><rect x="298" y="54" width="30" height="30" fill="#fff"/><path d="M220 44l65-34 65 34z" fill="#8a3d2b"/><rect x="30" y="140" width="50" height="50" fill="#6c8f5a" rx="25"/>';
      case 'transport': return '<rect x="190" y="60" width="160" height="90" rx="14" fill="#d93a3a"/><rect x="202" y="72" width="40" height="34" rx="4" fill="#bfe6ff"/><rect x="250" y="72" width="40" height="34" rx="4" fill="#bfe6ff"/><rect x="298" y="72" width="40" height="34" rx="4" fill="#bfe6ff"/>'
        + '<circle cx="222" cy="152" r="12" fill="#333"/><circle cx="318" cy="152" r="12" fill="#333"/><rect x="40" y="40" width="6" height="140" fill="#666"/><rect x="22" y="30" width="42" height="28" rx="4" fill="#2f6fd0"/><text x="43" y="50" text-anchor="middle" font-size="14" fill="#fff" font-family="sans-serif" font-weight="700">BUSS</text>';
      case 'vaer': return '<circle cx="300" cy="46" r="24" fill="#ffd34d"/><g fill="#fff"><ellipse cx="250" cy="62" rx="40" ry="18"/><ellipse cx="276" cy="52" rx="26" ry="16"/><ellipse cx="90" cy="44" rx="44" ry="18"/><ellipse cx="62" cy="38" rx="24" ry="14"/></g>'
        + '<g stroke="#5da0e8" stroke-width="3" stroke-linecap="round"><path d="M70 72l-5 12M92 72l-5 12M114 72l-5 12"/></g><path d="M0 176c60-14 120-14 180 0s120 14 180 0v24H0z" fill="#7cbf6a"/>';
      case 'hoflighet': return '<rect x="140" y="148" width="140" height="10" rx="4" fill="#8a5a2b"/><rect x="204" y="158" width="12" height="34" fill="#8a5a2b"/><path d="M176 132h22v12a11 11 0 0 1-22 0z" fill="#fff"/><path d="M222 132h22v12a11 11 0 0 1-22 0z" fill="#fff"/><path d="M182 126q4-6 0-12M228 126q4-6 0-12" stroke="#bbb" stroke-width="2" fill="none"/>'
        + '<path d="M300 40c8-14 30-8 24 10-4 12-24 24-24 24s-20-12-24-24c-6-18 16-24 24-10z" fill="#e85d7a" opacity=".55"/>';
      default: return '<circle cx="300" cy="44" r="22" fill="#ffd34d"/><rect x="40" y="70" width="14" height="100" fill="#7a5a3a"/><circle cx="47" cy="66" r="34" fill="#5f9e4f"/><rect x="150" y="150" width="120" height="8" rx="3" fill="#8a5a2b"/><rect x="160" y="158" width="6" height="30" fill="#8a5a2b"/><rect x="254" y="158" width="6" height="30" fill="#8a5a2b"/>';
    }
  }
  /** a simple person: x = centre; c = clothes; h = hair; f = face */
  const person = (x, c, h, f, flip, long) => `<g transform="translate(${x} 0)${flip ? ' scale(-1 1)' : ''}">
      <path d="M-30 200v-34c0-22 14-38 30-38s30 16 30 38v34z" fill="${c}"/>
      <circle cx="0" cy="98" r="24" fill="${f}"/>
      <path d="M-25 96c-2-22 14-32 27-30 16 1 26 12 23 30-5-10-14-14-24-14s-20 4-26 14z" fill="${h}"/>
      ${long ? `<path d="M-25 94c-4 18-2 34 4 40l6-30zM25 94c4 18 2 34-4 40l-6-30z" fill="${h}"/>` : ''}
      <circle cx="8" cy="98" r="2.6" fill="#2b2b2b"/><circle cx="-6" cy="98" r="2.6" fill="#2b2b2b"/>
      <path d="M-4 109q5 4 10 0" stroke="#7a3b2b" stroke-width="2.2" fill="none" stroke-linecap="round"/></g>`;
  function topicScene(p) {
    const P0 = PLACES[p.topic] || PLACES.smalltalk;
    const sid = 'pd' + p.id.replace(/[^a-z0-9]/gi, '');
    // the people change a little with the phrase (deterministic) — not always the same pair
    const h = [...p.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const SK = ['#f3c9a8', '#e0ac85', '#c98e64', '#8d5a3b'], HR = ['#3b2a20', '#c9a04a', '#7a3b1f', '#1f1f1f', '#a7a7a7'], CL = ['#4f7bd9', '#e0774f', '#3aa57a', '#9b6ce8', '#d9466a', '#2f8fa0'];
    const a = person(110, CL[h % 6], HR[h % 5], SK[h % 4], false, h % 2 === 0);
    const b = person(262, CL[(h >> 3) % 6 === h % 6 ? (h % 6 + 2) % 6 : (h >> 3) % 6], HR[(h >> 5) % 5], SK[(h >> 7) % 4], true, (h >> 2) % 2 === 1);
    const svg = `<svg class="pd-svg" viewBox="0 0 360 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs><linearGradient id="${sid}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P0.bg[0]}"/><stop offset="1" stop-color="${P0.bg[1]}"/></linearGradient></defs>
      <rect width="360" height="200" fill="url(#${sid}g)"/>${props(p.topic)}<rect y="190" width="360" height="10" fill="rgba(0,0,0,.08)"/><g transform="translate(18 28) scale(.9)">${a}${b}</g></svg>`;
    return { svg, sx: speakerOf(p) ? 70.6 : 32.5, place: [P0.ico, uk() ? P0.uk : P0.name] };
  }
  const sceneSvg = p => sceneOf(p).svg;
  /** the scene with the comic bubble pointing at the person who says the phrase (the bubble's text is plain — the karaoke paints it) */
  function sceneHtml(p, big) {
    const S = sceneOf(p), ro = rosterOf(p).map(k => whoName(p, k));
    const right = S.sx > 52, n = String(p.no).length;
    // --k: how far the bubble may reach back from its speaker (a longer line → a wider bubble, more to the middle)
    return `<div class="pd-scene pt${right ? ' r' : ''}${big ? ' big' : ''}" style="--sx:${S.sx};--k:${n < 22 ? '46px' : n < 45 ? '16cqw' : '26cqw'}" role="img" aria-label="${esc(S.place[1])}${ro.length ? ': ' + esc(ro.join(', ')) : ''}. Реплика: ${esc(p.no)}">
      ${S.svg}<div class="pd-bubble${String(p.no).length > 60 ? ' long' : ''}"><span class="pd-bubble-t" lang="nb" data-pd-line>${esc(p.no)}</span></div>
      <span class="pd-place">${S.place[0]} ${esc(S.place[1])} · ${esc(p.level)}</span></div>`;
  }

  /* ---------- 🔊 voice + karaoke ---------- */
  let KAR = null, tok = 0;
  const kar = () => {
    if (KAR || !window.TTS || !TTS.Karaoke) return KAR;
    try { KAR = new TTS.Karaoke({ name: 'pd', cls: 'pd-kmark', host: el => el.closest('.pd-bubble, .pd-line, .pd-dlg-l') || el.parentElement }); } catch (e) { KAR = null; }
    return KAR;
  };
  const karClear = () => { if (KAR) try { KAR.clear(); } catch (e) { /* ignore */ } };
  function stop() { tok++; karClear(); try { if (window.TTS && TTS.stop) TTS.stop(); } catch (e) { /* ignore */ } }
  /** say a Norwegian text; els = elements showing exactly this text (the word being said lights up there); role: a
   *  dialogue speaker's own voice ({ voiceId } / { pitch } — js/voices.js Voices.speakerOpts) */
  async function say(text, els, slow, role) {
    stop();
    if (!window.TTS || !TTS.speak) { toast('Голос недоступен на этом устройстве', 'warn'); return; }
    const my = ++tok;
    const o = Object.assign({ place: PLACE }, role || {});
    const voiceId = o.voiceId;
    if (slow) { let r = 0.9; try { r = TTS.currentRate ? TTS.currentRate() : 0.9; } catch (e) { r = 0.9; } o.rate = Math.max(0.45, r * 0.68); }
    const targets = (els || []).filter(el => el && el.textContent === String(text));
    const K = targets.length && TTS.wordsOf ? kar() : null;
    if (K) {
      o.onWord = (i, a, b, info) => {
        if (my !== tok) return;
        const done = info && info.done;
        try { K.show(targets.filter(el => el.isConnected).map(el => ({ el, cur: done ? null : [a, b], done: done ? b : a }))); } catch (e) { karClear(); }
      };
    }
    let failed = false;
    const once = () => Promise.race([Promise.resolve().then(() => TTS.speak(text, 'no', o)).catch(() => { failed = true; }), new Promise(r => setTimeout(r, 6000 + String(text).length * 160))]);
    await once();
    // the second speaker's voice failed (offline / no key): say it with the place's usual voice instead of silence
    if (failed && voiceId && my === tok) { try { if (window.Voices && Voices.roleFailed) Voices.roleFailed(); } catch (e) { /* ignore */ } delete o.voiceId; failed = false; await once(); }
    if (my === tok) setTimeout(() => { if (my === tok) karClear(); }, 700);
  }

  /** the speakers' TTS options [roster index → { place, voiceId? , pitch? }]: distinct voices from Voices.roleVoices,
   *  matched to the scene's people by gender ('f' / 'm') when the voice's gender is known; no scene → the helper's order */
  function castVoices(roster, people) {
    const V = window.Voices;
    if (!V || !V.speakerOpts) return roster.map(() => null);
    const plain = () => roster.map(k => { try { return V.speakerOpts('no', k, roster.slice(), PLACE); } catch (e) { return null; } });
    let on = true;
    try { on = !V.rolesOn || V.rolesOn(); } catch (e) { on = true; }
    const want = roster.map((k, i) => ((Array.isArray(people) && people[i]) || {}).g || '');
    if (!on || roster.length < 2 || !want.some(Boolean) || !V.roleVoices || !V.entry) return plain();
    let ids = [];
    try { ids = V.roleVoices('no', Math.min(6, roster.length + 3), PLACE) || []; } catch (e) { return plain(); }
    const sex = id => { try { const g = (V.entry(id, 'no') || {}).g; return g === '♀' ? 'f' : g === '♂' ? 'm' : ''; } catch (e) { return ''; } };
    const free = ids.map((id, k) => ({ id, k, g: id ? sex(id) : '' })).filter(c => c.id);
    const PITCH = [1, 0.8, 1.2];
    return roster.map((key, i) => {
      const g = want[i];
      let at = g ? free.findIndex(c => c.g === g) : -1;
      if (at < 0) at = free.findIndex(c => !c.g);
      if (at < 0) at = free.length ? 0 : -1;
      if (at < 0) return i ? { place: PLACE, pitch: PITCH[i % 3] } : { place: PLACE }; // no distinct voice left: the same one a little lower / higher
      const c = free.splice(at, 1)[0];
      return c.k === 0 ? { place: PLACE } : { place: PLACE, voiceId: c.id };
    });
  }

  /* ---------- step progress ---------- */
  function markStep(day, step) {
    const s = st();
    const o = s.steps[day] = Object.assign({}, s.steps[day] || {});
    if (o[step]) return false;
    o[step] = 1; save(s);
    return true;
  }
  function stepsOf(day) { return st().steps[day] || {}; }
  function finish(day, p) {
    const s = st();
    if (!s.done[day]) { s.done[day] = p.id; save(s); }
    if (window.XP) XP.add('phrase', 10, { key: 'phrase:' + day, label: 'Фраза дня' });
  }
  const doneCount = () => Object.keys(st().done).length;
  const statsHtml = () => `Пройдено дней: ${doneCount()}${window.XP ? ' · ' + XP.badgeHtml() : ''}`;

  /* ---------- 🏠 the home card ---------- */
  let homeEl = null;
  async function mount(el) {
    if (!el) return;
    homeEl = el;
    loadCss();
    el.classList.add('pd-home-host');
    let p;
    try { p = await phraseFor(0); } catch (e) { el.innerHTML = ''; return; }
    const day = dayKey(Date.now()), done = !!st().done[day];
    el.innerHTML = `<section class="pd-home panel" aria-label="Фраза дня">
        <div class="pd-home-head"><h3>🌅 Фраза дня</h3>${done ? '<span class="pd-done-badge">✓ пройдена</span>' : ''}</div>
        ${sceneHtml(p)}
        <div class="pd-line"><span lang="nb" class="pd-line-t" data-pd-line>${esc(p.no)}</span></div>
        <div class="pd-tr">${esc(uk() ? p.uk : p.ru)}</div>
        <div class="pd-acts"><button type="button" class="btn sm" data-pd="play">▶ Послушать</button><button type="button" class="btn sm" data-pd="slow">🐢 Медленно</button><button type="button" class="btn sm primary" data-pd="open">${done ? 'Открыть ещё раз' : 'Разобрать фразу'} ›</button></div>
      </section>`;
    const lines = () => [...el.querySelectorAll('[data-pd-line]')];
    el.onclick = e => {
      const b = e.target.closest('[data-pd]'); if (!b) return;
      const a = b.dataset.pd;
      if (a === 'play' || a === 'slow') { say(p.no, lines(), a === 'slow'); markStep(day, 'listen'); }
      else if (a === 'open') { stop(); open(0); }
    };
  }

  /* ---------- 🪟 the window with the 4 steps ---------- */
  async function open(off = 0) {
    loadCss();
    if (!window.UI || !UI.modal) return;
    let p;
    try { p = await phraseFor(off); } catch (e) { toast('Не получилось загрузить фразу дня — проверьте интернет', 'warn', 3500); return; }
    const t = Date.now() + off * 864e5, day = dayKey(t);
    let selW = -1, aiBusy = false;
    // js/speech.js catches clicks on [data-speech-pron] on the document (capture) and stops them — see them earlier, on window
    const onSpeech = e => { const b = e.target.closest && e.target.closest('[data-pd="repeat"]'); if (b && box.contains(b)) { stop(); markRepeat(); } };
    window.addEventListener('click', onSpeech, true);
    const m = UI.modal({ title: off ? '🌅 Вчерашняя фраза' : '🌅 Фраза дня', cls: 'wide pd-modal', body: '<div class="pd-wrap"></div>', onClose: () => { stop(); window.removeEventListener('click', onSpeech, true); } });
    const box = m.$('.pd-wrap');
    const markRepeat = () => setTimeout(() => step('repeat'), 0);
    const S = () => stepsOf(day);
    const chk = k => (S()[k] ? '<span class="pd-ok" aria-label="сделано">✓</span>' : '');
    const lines = () => [...box.querySelectorAll('.pd-head [data-pd-line]')];
    const wordInfo = i => {
      const x = p.words[i]; if (!x) return '<p class="small muted">Наведите курсор или нажмите на слово — покажу перевод и начальную форму.</p>';
      return `<div class="pd-winfo"><div><b lang="nb">${esc(x.w)}</b>${x.base && x.base.toLowerCase() !== x.w.toLowerCase() ? ` <span class="muted">← <span lang="nb">${esc(x.base)}</span></span>` : ''} — ${esc(trw(x))}
        <button type="button" class="icon-btn sm" data-pd-say-w="${i}" title="Послушать слово" aria-label="Послушать слово ${esc(x.w)}">🔊</button></div>
        ${x.note ? `<div class="small pd-wnote">💡 ${esc(x.note)}</div>` : ''}</div>`;
    };
    const dlg = Array.isArray(p.dialog) ? p.dialog : [];
    const roster = rosterOf(p);
    const draw = () => {
      const done = !!st().done[day], s = S();
      box.innerHTML = `
        <div class="pd-head">
          ${sceneHtml(p, true)}
          <div class="pd-line big"><span lang="nb" class="pd-line-t" data-pd-line>${esc(p.no)}</span></div>
          <div class="pd-tr">${esc(uk() ? p.uk : p.ru)}</div>
          <div class="pd-acts"><button type="button" class="btn primary" data-pd="play">▶ Послушать</button><button type="button" class="btn" data-pd="slow">🐢 Медленно</button>
            <button type="button" class="btn ghost" data-pd="card" title="Сделать карточку: фраза, перевод, разбор и пример">＋ В карточки</button>
            ${window.PrintX ? '<button type="button" class="btn ghost" data-pd="print" aria-haspopup="dialog" title="Распечатать фразу с разбором и диалогом или сохранить в Word">🖨 Печать</button>' : ''}</div>
          <div class="pd-meta small muted"><span>Уровень ${esc(p.level)} · образец: <b lang="nb">${esc(p.pattern || '')}</b></span>
            <span class="pd-lang" role="group" aria-label="Язык перевода"><button type="button" class="pd-chip ${uk() ? '' : 'on'}" data-pd-lang="ru" aria-pressed="${!uk()}">RU</button><button type="button" class="pd-chip ${uk() ? 'on' : ''}" data-pd-lang="uk" aria-pressed="${uk()}">UA</button></span></div>
        </div>
        <ol class="pd-steps">
          <li class="pd-step ${s.listen ? 'ok' : ''}"><h4>1. Послушайте ${chk('listen')}</h4>
            <p class="small">Сначала в обычном темпе, потом медленно. Следите за подсвеченным словом.</p>
            <div class="pd-acts"><button type="button" class="btn sm" data-pd="play">▶ Обычно</button><button type="button" class="btn sm" data-pd="slow">🐢 Медленно</button></div></li>
          <li class="pd-step ${s.parse ? 'ok' : ''}"><h4>2. Разберитесь ${chk('parse')}</h4>
            <div class="pd-words" role="list">${p.words.map((x, i) => `<button type="button" role="listitem" class="pd-w ${i === selW ? 'on' : ''}" data-pd-w="${i}" lang="nb" aria-expanded="${i === selW}">${esc(x.w)}</button>`).join('')}</div>
            <div class="pd-wbox" aria-live="polite">${wordInfo(selW)}</div>
            <details class="pd-why" data-pd-why><summary>🤔 Почему так?</summary><p>${esc(tr(p, 'grammar'))}</p></details></li>
          <li class="pd-step ${s.repeat ? 'ok' : ''}"><h4>3. Повторите вслух ${chk('repeat')}</h4>
            <p class="small">Скажите фразу в микрофон — приложение распознает речь прямо на устройстве и покажет, какие слова прозвучали верно.</p>
            <div class="pd-acts">${window.Speech ? `<button type="button" class="btn sm" data-pd="repeat" data-speech-pron="${esc(p.no)}" data-ru="${esc(p.ru)}">🗣 Проверить произношение</button>` : ''}
              <button type="button" class="btn sm ghost" data-pd="repeat-self">✓ Я повторил(а) вслух</button></div></li>
          <li class="pd-step ${s.say ? 'ok' : ''}"><h4>4. Скажите сами ${chk('say')}</h4>
            <p class="small"><b>Задание:</b> ${esc(uk() ? p.task_uk || p.task_ru : p.task_ru)}</p>
            <p class="small muted">Образец: <span lang="nb">${esc(p.pattern || '')}</span></p>
            <label class="pd-own"><span class="sr-only">Ваше предложение по-норвежски</span><textarea class="input" rows="2" lang="nb" data-pd-own placeholder="Напишите своё предложение по-норвежски…" spellcheck="false"></textarea></label>
            <div class="pd-acts"><button type="button" class="btn sm primary" data-pd="check">Проверить</button><button type="button" class="btn sm ghost" data-pd="model">Показать образец</button></div>
            <div class="pd-out" aria-live="polite"></div></li>
        </ol>
        ${dlg.length ? `<section class="pd-dlg"><h4>💬 Мини-диалог</h4>${dlg.map((d, i) => `<div class="pd-dlg-l pd-s${roster.indexOf(d.who)} ${/^(Вы|Ви)$/.test(d.who) ? 'me' : ''}">
            <button type="button" class="icon-btn sm" data-pd-dl="${i}" aria-label="Послушать реплику: ${esc(whoName(p, d.who))}">▶</button>
            <div><small class="pd-who">${esc(whoName(p, d.who))}</small><div lang="nb" class="pd-dlg-no">${esc(d.no)}</div><div class="small muted">${esc(uk() && d.uk ? d.uk : d.ru)}</div></div></div>`).join('')}
            <button type="button" class="btn sm" data-pd="dlg-all">▶ Весь диалог</button></section>` : ''}
        <div class="pd-foot">
          ${done ? '<div class="pd-done">✓ Фраза дня пройдена. Завтра будет новая!</div>' : '<button type="button" class="btn primary" data-pd="done">✓ Готово — фраза пройдена</button>'}
          <div class="small muted" data-pd-stats>${statsHtml()}</div>
          <div class="pd-acts">${off ? '<button type="button" class="btn sm ghost" data-pd="today">🌅 Сегодняшняя фраза</button>' : '<button type="button" class="btn sm ghost" data-pd="yday">↶ Вчерашняя фраза</button>'}
            <label class="small pd-lvl">Уровень фраз: <select data-pd-lvl>${['', ...LV].map(L => `<option value="${L}" ${(st().lvl || '') === L ? 'selected' : ''}>${L || 'как в приложении (' + myLevel() + ')'}</option>`).join('')}</select></label></div>
          <p class="tiny muted">Фразы, диалоги и рисунок — собственный материал Norsk Kort.</p>
        </div>`;
    };
    draw();
    const own = () => box.querySelector('[data-pd-own]');
    const out = () => box.querySelector('.pd-out');
    const step = k => { if (markStep(day, k)) { const li = box.querySelectorAll('.pd-step')[['listen', 'parse', 'repeat', 'say'].indexOf(k)]; if (li) { li.classList.add('ok'); const h = li.querySelector('h4'); if (h && !h.querySelector('.pd-ok')) h.insertAdjacentHTML('beforeend', ' <span class="pd-ok" aria-label="сделано">✓</span>'); } } maybeAll(); };
    const maybeAll = () => { const s = S(); if (s.listen && s.parse && s.repeat && s.say && !st().done[day]) { finish(day, p); const f = box.querySelector('[data-pd="done"]'); if (f) f.outerHTML = '<div class="pd-done">✓ Все четыре шага сделаны — фраза дня пройдена!</div>'; const sx = box.querySelector('[data-pd-stats]'); if (sx) sx.innerHTML = statsHtml(); } };
    const showWord = i => { selW = i; box.querySelectorAll('.pd-w').forEach((b, j) => { b.classList.toggle('on', j === i); b.setAttribute('aria-expanded', String(j === i)); }); box.querySelector('.pd-wbox').innerHTML = wordInfo(i); if (box.querySelectorAll('.pd-w.on').length) step('parse'); };
    const hover = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);
    if (hover) box.addEventListener('mouseover', e => { const w = e.target.closest('[data-pd-w]'); if (w && +w.dataset.pdW !== selW) showWord(+w.dataset.pdW); });
    box.addEventListener('toggle', e => { if (e.target.matches && e.target.matches('[data-pd-why]') && e.target.open) step('parse'); }, true);

    // 🎭 roles (js/voices.js): every speaker a voice of their own (up to 3), a woman of the scene a female voice and a man
    // a male one when such a voice can speak now; «Разные голоса в диалогах» off → one voice
    let cast = null;
    const voiceOf = d => { if (!cast) cast = castVoices(roster, (p.scene || {}).people); return cast[roster.indexOf(d.who)] || null; };
    let dlgRun = 0;
    async function playDialog() {
      const run = ++dlgRun;
      for (let i = 0; i < dlg.length; i++) {
        if (!m.el.isConnected || run !== dlgRun) return;
        const el = box.querySelectorAll('.pd-dlg-no')[i];
        box.querySelectorAll('.pd-dlg-l').forEach((x, j) => x.classList.toggle('now', j === i));
        await say(dlg[i].no, [el], false, voiceOf(dlg[i]));
        // say() moves the shared token itself — so «stopped?» is judged by our own run number (another button press = new run)
        if (run !== dlgRun || !m.el.isConnected) return;
        await new Promise(r => setTimeout(r, 450));
      }
      if (run === dlgRun) box.querySelectorAll('.pd-dlg-l').forEach(x => x.classList.remove('now'));
    }
    async function checkOwn() {
      const txt = (own().value || '').trim();
      if (!txt) { out().innerHTML = '<p class="small">Сначала напишите предложение — хотя бы три-четыре слова.</p>'; own().focus(); return; }
      if (/[Ѐ-ӿ]/.test(txt)) { out().innerHTML = '<p class="small">Похоже, это не по-норвежски 🙂 Напишите предложение норвежскими буквами.</p>'; return; }
      step('say');
      const n = s => String(s).toLowerCase().replace(/[.,!?;:«»"]/g, '').replace(/\s+/g, ' ').trim();
      const model = `<div class="pd-model"><b>Образец:</b> <span lang="nb">${esc(p.model)}</span> <button type="button" class="icon-btn sm" data-pd="say-model" aria-label="Послушать образец">🔊</button><div class="small muted">${esc(uk() ? p.model_uk || p.model_ru : p.model_ru)}</div></div>`;
      if (n(txt) === n(p.model)) { out().innerHTML = `<p class="pd-good">🎉 Точно как в образце!</p>`; return; }
      const ai = (() => { try { return !!(window.AI && AI.chain && AI.call && AI.chain().length); } catch (e) { return false; } })();
      if (!ai) {
        const keys = String(p.pattern || '').replace(/…/g, ' ').split(/\s+/).map(n).filter(w => w.length > 1);
        const have = keys.filter(k => n(txt).split(' ').includes(k));
        const tips = [];
        if (keys.length && have.length < keys.length) tips.push(`Возьмите образец целиком: <b lang="nb">${esc(p.pattern)}</b> — не хватает: ${keys.filter(k => !have.includes(k)).map(k => `<span lang="nb">${esc(k)}</span>`).join(', ')}.`);
        if (!/^[A-ZÆØÅ]/.test(txt)) tips.push('Начните с заглавной буквы.');
        if (!/[.!?]$/.test(txt)) tips.push('Поставьте в конце точку или вопросительный знак.');
        out().innerHTML = `${tips.length ? `<ul class="small">${tips.map(x => `<li>${x}</li>`).join('')}</ul>` : '<p class="small pd-good">Образец использован 👍 Сравните с примером:</p>'}${model}
          <p class="tiny muted">Подключите нейросеть в Настройках — она подробно проверит ваше предложение.</p>`;
        return;
      }
      if (aiBusy) return; aiBusy = true;
      out().innerHTML = '<p class="small" role="status"><span class="spinner sm"></span> Нейросеть читает ваше предложение…</p>';
      const lang = uk() ? 'українською' : 'по-русски';
      try {
        const raw = await Promise.race([AI.call({
          system: `Ты доброжелательный преподаватель норвежского (букмол) для ${uk() ? 'украинцев' : 'русскоязычных'}. Отвечай ${lang}, коротко (до 70 слов), без вступлений.`,
          user: `Задание ученика: ${p.task_ru}\nОбразец конструкции: ${p.pattern}\nПример правильного ответа: ${p.model}\nОтвет ученика: ${txt}\n\nОцени ответ: 1) правильно ли по-норвежски (грамматика, порядок слов, род); 2) если есть ошибки — дай исправленный вариант целиком в строке, начинающейся с «✔»; 3) одна короткая подсказка. Если всё верно — похвали одной фразой.`,
          maxTokens: 400, temperature: 0.2, quiet: true,
        }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 45000))]);
        const text = String(raw || '').trim();
        out().innerHTML = `<div class="pd-ai"><div class="small muted">${BOT()} ${esc(window.AI && AI.name ? AI.name(AI.lastProvider) : 'ИИ')}:</div>${esc(text).replace(/\n+/g, '<br>')}</div>${model}`;
      } catch (e) {
        out().innerHTML = `<p class="small">Нейросеть сейчас не ответила — сравните с образцом:</p>${model}`;
      } finally { aiBusy = false; }
    }
    function toCards() {
      if (!window.CardMaker) { toast('Создание карточек недоступно', 'warn'); return; }
      const opt = [{ id: 'sent', kind: 'sent', no: p.no, ru: p.ru, by: [], example: p.model, exampleRu: p.model_ru, exBy: [], wordClass: 'frase',
        description: `💡 ${p.grammar_ru}`, tags: ['frase-dagen'], checked: true }];
      p.words.filter(x => x.base && x.w.length > 2 && !/^(jeg|du|han|hun|vi|de|det|den|en|ei|et|og|i|på|til|er|har)$/i.test(x.w)).forEach((x, i) => {
        opt.push({ id: 'w' + i, kind: 'word', group: 'other', no: x.base, ru: x.ru, by: [], example: p.no, exampleRu: p.ru, exBy: [], description: x.note ? '💡 ' + x.note : '' });
      });
      try {
        CardMaker.open({ key: 'phraseday', deck: '🌅 Фраза дня', deckDesc: 'Фразы дня из Norsk Kort: живые фразы для жизни в Норвегии, с разбором и примером.',
          source: { by: 'import', label: 'Фраза дня — Norsk Kort (собственный материал)', name: 'Norsk Kort' }, options: opt, pick: 'sent', groups: { other: 'Слова из фразы…' } });
      } catch (e) { toast('Не получилось открыть создание карточки', 'warn'); }
    }
    box.addEventListener('click', e => {
      const w = e.target.closest('[data-pd-w]'); if (w) { showWord(+w.dataset.pdW); return; }
      const sw = e.target.closest('[data-pd-say-w]'); if (sw) { const x = p.words[+sw.dataset.pdSayW]; if (x) say(x.w, []); return; }
      if (!e.target.closest('[data-pd="dlg-all"]') && e.target.closest('button')) { dlgRun++; box.querySelectorAll('.pd-dlg-l.now').forEach(x => x.classList.remove('now')); } // any other sound stops the dialogue
      const dl = e.target.closest('[data-pd-dl]'); if (dl) { const i = +dl.dataset.pdDl; say(dlg[i].no, [box.querySelectorAll('.pd-dlg-no')[i]], false, voiceOf(dlg[i])); return; }
      const lg = e.target.closest('[data-pd-lang]'); if (lg) { const s = st(); s.lang = lg.dataset.pdLang; save(s); const v = own() ? own().value : ''; draw(); if (own()) own().value = v; return; }
      const b = e.target.closest('[data-pd]'); if (!b) return;
      const a = b.dataset.pd;
      if (a === 'play' || a === 'slow') { say(p.no, lines(), a === 'slow'); step('listen'); }
      else if (a === 'repeat') { stop(); step('repeat'); /* js/speech.js opens its window by the data-speech-pron attribute */ }
      else if (a === 'repeat-self') step('repeat');
      else if (a === 'check') checkOwn();
      else if (a === 'model') { out().innerHTML = `<div class="pd-model"><b>Образец:</b> <span lang="nb">${esc(p.model)}</span> <button type="button" class="icon-btn sm" data-pd="say-model" aria-label="Послушать образец">🔊</button><div class="small muted">${esc(uk() ? p.model_uk || p.model_ru : p.model_ru)}</div></div>`; }
      else if (a === 'say-model') say(p.model, []);
      else if (a === 'dlg-all') playDialog();
      else if (a === 'card') toCards();
      else if (a === 'print') { stop(); if (window.PrintX) PrintX.phrases([p]); }
      else if (a === 'done') { finish(day, p); draw(); }
      else if (a === 'yday') { stop(); m.close(); open(-1); }
      else if (a === 'today') { stop(); m.close(); open(0); }
    });
    box.addEventListener('change', e => {
      const s = e.target.closest('[data-pd-lvl]'); if (!s) return;
      const o = st(); o.lvl = s.value || undefined; if (!o.lvl) delete o.lvl; save(o);
      const keep = !!st().done[day]; // a day already done keeps its phrase
      toast(s.value ? `Фразы дня — уровень ${s.value}${keep ? ' (с завтрашнего дня)' : ''}` : 'Уровень фраз — как в приложении', 'good');
      if (!keep) { stop(); m.close(); open(off); if (homeEl && homeEl.isConnected) mount(homeEl); }
    });
    if (!reduced()) { const sc = box.querySelector('.pd-scene'); if (sc) sc.classList.add('pd-in'); }
  }

  const PhraseDay = {
    open, mount, load, phraseFor,
    /** the phrase of a day (for other screens): → Promise<phrase> */
    today: () => phraseFor(0),
    isDone: (off = 0) => !!st().done[dayKey(Date.now() + off * 864e5)],
    _t: { pick, dayKey, dayNum, sceneSvg, sceneHtml, sceneOf, speakerOf, castVoices, myLevel, st, LV },
  };
  window.PhraseDay = PhraseDay;
})();
