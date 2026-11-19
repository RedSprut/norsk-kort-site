/* ============ 🕐 Klokka — время по-норвежски: урок, часы со стрелками, игры с очками и уровнями ============
 *  - Klokka.open(view?)   the window: hub (now, lesson, levels, games), 'lesson', or a game { mode, level, timed }
 *  - Klokka.Clock(el, o)  the SVG analogue clock (glossy face, tick ring, colour zones, draggable hands snapping to
 *                         5 minutes, keyboard arrows, digital readout, idle sweeping second hand, reduced motion)
 *  - Klokka.T             the phrase rules (pure functions; tested for every 5-minute time in Node):
 *                         colloq(t) «ti på halv fire», withPart(t) «… om ettermiddagen», formal(t) «fjorten tretti»,
 *                         parse(text) → { t12, t24, part, kind }, ru(t) «без десяти четыре», distractors, explain
 *  - anywhere: <button data-klokka-open> opens it (capture listener); the sidebar item data-sb="klokka" too.
 *  - progress (points, best scores, stars, mistakes, lesson steps) lives on this device: localStorage 'nk-klokka'.
 * Rules checked against NTNU LearnNoW (ch. 4 «Hva er klokka?»), Life in Norway, Omniglot, NLS Norwegian.
 */
(function (root) {
  'use strict';

  /* ======================================================================
   * 1. Phrases — pure (no DOM), t = minutes since midnight (0…1439), 5-minute steps
   * ====================================================================== */
  const mod = (a, n) => ((a % n) + n) % n;
  const H12 = ['tolv', 'ett', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti', 'elleve'];
  const H24 = ['null', 'ett', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti', 'elleve', 'tolv', 'tretten', 'fjorten',
    'femten', 'seksten', 'sytten', 'atten', 'nitten', 'tjue', 'tjueen', 'tjueto', 'tjuetre'];
  const UNITS = ['null', 'ett', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti', 'elleve', 'tolv', 'tretten', 'fjorten',
    'femten', 'seksten', 'sytten', 'atten', 'nitten'];
  const TENS = { tjue: 20, tretti: 30, førti: 40, femti: 50 };
  /** formal minutes: 05 → «null fem», 30 → «tretti» */
  const minWord = m => (m === 0 ? 'null null' : m < 10 ? 'null ' + UNITS[m] : m < 20 ? UNITS[m] : Object.keys(TENS)[Math.floor(m / 10) - 2] + (m % 10 ? UNITS[m % 10] : ''));
  /** parts of the day (whole hours, start inclusive) — every range lies inside one half of the day, so a 12-hour phrase + part is unique */
  const PARTS = [
    { id: 'natt', from: 0, to: 6, no: 'om natta', ru: 'ночи', ico: '🌙', name: 'ночь' },
    { id: 'morgen', from: 6, to: 9, no: 'om morgenen', ru: 'утра', ico: '🌅', name: 'утро' },
    { id: 'formiddag', from: 9, to: 12, no: 'om formiddagen', ru: 'утра (до полудня)', ico: '☀️', name: 'до полудня' },
    { id: 'ettermiddag', from: 12, to: 18, no: 'om ettermiddagen', ru: 'дня', ico: '🌤', name: 'день' },
    { id: 'kveld', from: 18, to: 24, no: 'om kvelden', ru: 'вечера', ico: '🌆', name: 'вечер' },
  ];
  const hw = h => H12[mod(h, 12)];
  const snap5 = t => mod(Math.round(t / 5) * 5, 1440);
  const pad = n => String(n).padStart(2, '0');

  /** colloquial 12-hour phrase: 15:20 → «ti på halv fire» */
  function colloq(t) {
    t = snap5(t);
    const h = Math.floor(t / 60), m = t % 60, cur = hw(h), nx = hw(h + 1);
    switch (m) {
      case 0: return cur;
      case 5: return 'fem over ' + cur;
      case 10: return 'ti over ' + cur;
      case 15: return 'kvart over ' + cur;
      case 20: return 'ti på halv ' + nx;
      case 25: return 'fem på halv ' + nx;
      case 30: return 'halv ' + nx;
      case 35: return 'fem over halv ' + nx;
      case 40: return 'ti over halv ' + nx;
      case 45: return 'kvart på ' + nx;
      case 50: return 'ti på ' + nx;
      default: return 'fem på ' + nx;
    }
  }
  const partOf = t => { const h = Math.floor(mod(t, 1440) / 60); return PARTS.find(p => h >= p.from && h < p.to); };
  const withPart = t => colloq(t) + ' ' + partOf(t).no;
  /** formal 24-hour reading: 14:30 → «fjorten tretti», 09:05 → «ni null fem», 21:00 → «tjueen», 00:00 → «null null» */
  function formal(t) {
    t = snap5(t);
    const h = Math.floor(t / 60), m = t % 60;
    if (m === 0) return h === 0 ? 'null null' : H24[h];
    return H24[h] + ' ' + minWord(m);
  }
  const digits = (t, h24 = true) => { t = mod(Math.round(t), 1440); const h = Math.floor(t / 60); return `${h24 ? pad(h) : (h % 12 || 12)}:${pad(t % 60)}`; };
  const written = t => { t = mod(t, 1440); return `kl. ${pad(Math.floor(t / 60))}.${pad(t % 60)}`; };
  const hm12 = t => digits(mod(t, 720), false);

  /* --- parsing (also what speech recognition heard) --- */
  const HOUR_RE = '(tolv|ett|en|to|tre|fire|fem|seks|sju|åtte|ni|ti|elleve)';
  const OFF = { fem: 5, ti: 10, kvart: 15, tjue: 20 };
  /** a number word 0…59 → value (ett/en, tjuefem, førtifem, «null fem» handled by the caller) */
  function numWord(w) {
    if (w === 'en' || w === 'eitt' || w === 'én') w = 'ett';
    let k = UNITS.indexOf(w); if (k >= 0) return k;
    for (const [tw, v] of Object.entries(TENS)) {
      if (w === tw) return v;
      if (w.startsWith(tw)) { const u = numWord(w.slice(tw.length)); if (u != null && u > 0 && u < 10) return v + u; }
    }
    return null;
  }
  /** lower case, no punctuation / «klokka er» / fillers; dialect and old number words → the standard ones (space-separated tokens) */
  function norm(s) {
    let x = String(s == null ? '' : s).toLowerCase().normalize('NFC');
    x = x.replace(/[«»"“”„!?,;()]/g, ' ').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
    x = ' ' + x.replace(/\.$/, '') + ' ';
    x = x.replace(/ (hva|hvor mye) er (klokka|klokken) /g, ' ');
    x = x.replace(/ kl\. ?(?=\d)/g, ' ').replace(/ kl\.? /g, ' ');
    x = x.replace(/ (klokka|klokken)( er)? /g, ' ').replace(/^ (ja|nå|eh|øh|hm) /, ' ').replace(/^ (den|hun|det) er /, ' ').replace(/^ er /, ' ');
    x = x.replace(/ (cirka|ca\.?|omtrent|presis|nøyaktig|akkurat)(?= )/g, ' ');
    x = x.replace(/(tjue|tretti|førti|femti)[- ](en|ett|én|to|tre|fire|fem|seks|sju|syv|åtte|ni)(?= )/g, '$1$2');
    const MAP = { syv: 'sju', tredve: 'tretti', fyrti: 'førti', tjueén: 'tjueen', tjueett: 'tjueen', femogtjue: 'tjuefem', femogtretti: 'trettifem',
      femogførti: 'førtifem', femogfemti: 'femtifem', eitt: 'ett', 'én': 'ett', tjuesyv: 'tjuesju' };
    return x.trim().split(' ').map(w => MAP[w] || w.replace(/^(\p{L}+)-(\p{L}+)$/u, '$1$2')).join(' ').replace(/\s+/g, ' ').trim();
  }
  /**
   * text → { t12 (0…719), t24 (0…1439 | null), part (id | null), kind: 'colloq'|'formal'|'digital' } or null.
   * 12-hour phrases: «halv fire», «ti på halv fire», «kvart over tre», «tjue over tre» (a variant some speakers use), «tre»;
   * + a part of the day («om kvelden») resolves the 24-hour time; formal «fjorten tretti», «ni null fem»; digits «14.30», «3:30».
   */
  function parse(text) {
    let x = norm(text);
    if (!x) return null;
    let part = null;
    const PM = [[/\bom (natta|natten)$|\bpå (natta|natten)$|\bi natt$/, 'natt'], [/\bom morgenen$|\bi dag tidlig$/, 'morgen'], [/\bom formiddagen$/, 'formiddag'],
      [/\bom ettermiddagen$/, 'ettermiddag'], [/\bmidt på dagen$/, 'midday'], [/\bom kvelden$|\bi kveld$/, 'kveld']];
    for (const [re, id] of PM) if (re.test(x)) { part = id; x = x.replace(re, '').trim(); break; }
    const res = (t12, t24, kind) => {
      t12 = mod(t12, 720);
      if (t24 == null && part) {
        if (part === 'midday') t24 = [t12, t12 + 720].find(c => c >= 600 && c < 840);
        else { const p = PARTS.find(q => q.id === part); t24 = [t12, t12 + 720].find(c => c >= p.from * 60 && c < p.to * 60); }
        if (t24 == null) return null; // «halv ett om morgenen» — no such time
      }
      return { t12, t24: t24 == null ? null : mod(t24, 1440), part: part === 'midday' ? 'ettermiddag' : part, kind };
    };
    let m = x.match(/^(\d{1,2})\s*[:.]\s*(\d{2})$/);
    if (m) { const h = +m[1], mi = +m[2]; if (h > 23 || mi > 59) return null; return res(h * 60 + mi, part ? null : h * 60 + mi, 'digital'); }
    // digits said as figures («halv 4», «5 over halv 4»)
    x = x.replace(/\b(\d{1,2})\b/g, (a, n) => { n = +n; return n <= 23 ? H24[n] : n <= 59 ? minWord(n) : a; });
    const hi = w => H12.indexOf(w === 'en' ? 'ett' : w);
    if ((m = x.match(new RegExp(`^(fem|ti|kvart|tjue) (over|på) halv ${HOUR_RE}$`)))) return res((hi(m[3]) - 1) * 60 + 30 + (m[2] === 'over' ? 1 : -1) * OFF[m[1]], null, 'colloq');
    if ((m = x.match(new RegExp(`^halv ${HOUR_RE}$`)))) return res((hi(m[1]) - 1) * 60 + 30, null, 'colloq');
    if ((m = x.match(new RegExp(`^(fem|ti|kvart|tjue|tjuefem) (over|på) ${HOUR_RE}$`)))) return res(hi(m[3]) * 60 + (m[2] === 'over' ? 1 : -1) * (m[1] === 'tjuefem' ? 25 : OFF[m[1]]), null, 'colloq');
    if ((m = x.match(new RegExp(`^${HOUR_RE}$`)))) return res(hi(m[1]) * 60, null, 'colloq');
    // formal: «fjorten tretti», «ni null fem», «tjueen», «null null»
    const w = x.split(' ');
    const h24 = s => { const k = H24.indexOf(s === 'en' ? 'ett' : s); return k; };
    if (w.length === 1 && h24(w[0]) >= 13) return res(h24(w[0]) * 60, h24(w[0]) * 60, 'formal');
    if (w.length >= 2 && h24(w[0]) >= 0) {
      const h = h24(w[0]); let mi = null;
      if (w.length === 3 && w[1] === 'null') { mi = w[2] === 'null' ? 0 : numWord(w[2]); if (mi != null && mi > 9) mi = null; }
      else if (w.length === 2 && w[1] !== 'null') { mi = numWord(w[1]); if (mi != null && mi < 10) mi = null; }
      else if (w.length === 2 && w[1] === 'null' && h === 0) mi = 0;
      if (mi != null && mi < 60) return res(h * 60 + mi, part ? null : h * 60 + mi, 'formal');
    }
    return null;
  }
  /** the 24-hour time with t12 that is closest to t */
  const near = (t12, t) => [t12 - 1440, t12 - 720, t12, t12 + 720, t12 + 1440].reduce((a, c) => (Math.abs(c - t) < Math.abs(a - t) ? c : a));

  /* --- Russian --- */
  const RU_WHOLE = ['двенадцать часов', 'час', 'два часа', 'три часа', 'четыре часа', 'пять часов', 'шесть часов', 'семь часов', 'восемь часов', 'девять часов', 'десять часов', 'одиннадцать часов'];
  const RU_NOM = ['двенадцать', 'час', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять', 'одиннадцать'];
  const RU_ORD = ['двенадцатого', 'первого', 'второго', 'третьего', 'четвёртого', 'пятого', 'шестого', 'седьмого', 'восьмого', 'девятого', 'десятого', 'одиннадцатого'];
  const RU_GEN = ['двенадцати', 'часа', 'двух', 'трёх', 'четырёх', 'пяти', 'шести', 'семи', 'восьми', 'девяти', 'десяти', 'одиннадцати'];
  /** how a Russian says it: 15:20 → «двадцать минут четвёртого», 15:50 → «без десяти четыре» */
  function ru(t) {
    t = snap5(t);
    const h = mod(Math.floor(t / 60), 12), m = t % 60, nx = mod(h + 1, 12);
    if (m === 0) return RU_WHOLE[h];
    if (m === 15) return 'четверть ' + RU_ORD[nx];
    if (m === 30) return 'половина ' + RU_ORD[nx];
    if (m < 30) return ({ 5: 'пять минут ', 10: 'десять минут ', 20: 'двадцать минут ', 25: 'двадцать пять минут ' })[m] + RU_ORD[nx];
    return ({ 35: 'без двадцати пяти ', 40: 'без двадцати ', 45: 'без четверти ', 50: 'без десяти ', 55: 'без пяти ' })[m] + RU_NOM[nx];
  }
  /** word for word: «ti på halv fire» → «десять до половины четвёртого» */
  function literal(t) {
    t = snap5(t);
    const h = mod(Math.floor(t / 60), 12), m = t % 60, nx = mod(h + 1, 12);
    const n = { 5: 'пять', 10: 'десять', 15: 'четверть', 20: 'десять', 25: 'пять', 35: 'пять', 40: 'десять', 45: 'четверть', 50: 'десять', 55: 'пять' }[m];
    if (m === 0) return RU_NOM[h] === 'час' ? 'час' : RU_NOM[h];
    if (m === 30) return 'половина ' + RU_ORD[nx];
    if (m < 20) return `${n} после ${RU_GEN[h]}`;
    if (m < 30) return `${n} до половины ${RU_ORD[nx]}`;
    if (m < 45 && m > 30) return `${n} после половины ${RU_ORD[nx]}`;
    return `${n} до ${RU_GEN[nx]}`;
  }
  /** which zone a minute is in: over 0–19, påhalv 20–29, halv 30, overhalv 31–40, på 41–59 */
  const zoneOf = m => (m === 0 ? 'hel' : m < 20 ? 'over' : m < 30 ? 'pahalv' : m === 30 ? 'halv' : m <= 40 ? 'overhalv' : 'pa');

  /* --- questions and wrong answers --- */
  const LEVELS = [
    { n: 1, name: 'Целые часы', no: 'tre · sju', mins: [0] },
    { n: 2, name: 'Половины', no: 'halv fire', mins: [0, 30, 30] },
    { n: 3, name: 'Четверти', no: 'kvart over · kvart på', mins: [15, 45, 30, 15, 45, 0] },
    { n: 4, name: 'Каждые 5 минут', no: 'fem over · ti på', mins: [5, 10, 50, 55, 5, 10, 50, 55, 15, 45, 30] },
    { n: 5, name: 'På halv · over halv', no: 'ti på halv fire', mins: [20, 25, 35, 40, 20, 25, 35, 40, 30] },
    { n: 6, name: 'Всё + 24 часа', no: 'fjorten tretti', mins: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] },
  ];
  /** q = { t (0…1439), kind: 'colloq' | 'part' | 'formal' } */
  const qText = q => (q.kind === 'formal' ? formal(q.t) : q.kind === 'part' ? withPart(q.t) : colloq(q.t));
  const qSpeak = q => 'Klokka er ' + qText(q) + '.';
  const textOf = (kind, t) => qText({ kind, t });
  /** is the answer time right? (the clock face is 12-hour; a formal / part question is set on the same face) */
  const sameFace = (q, t12) => mod(q.t, 720) === mod(t12, 720);
  function makeQ(level, rnd = Math.random) {
    const L = LEVELS[Math.max(0, Math.min(5, level - 1))];
    const m = L.mins[Math.floor(rnd() * L.mins.length)];
    if (L.n < 6) {
      const h = 1 + Math.floor(rnd() * 12);
      return { t: mod(h * 60 + m, 720), kind: 'colloq' };
    }
    const t = Math.floor(rnd() * 24) * 60 + m, r = rnd();
    return { t, kind: r < 0.35 ? 'formal' : r < 0.65 ? 'part' : 'colloq' };
  }
  /** a round of n different questions */
  function makeRound(level, n, rnd = Math.random) {
    const out = [], seen = new Set();
    for (let i = 0; out.length < n && i < n * 40; i++) {
      const q = makeQ(level, rnd), k = q.kind + q.t;
      if (seen.has(k) && i < n * 30) continue;
      seen.add(k); out.push(q);
    }
    return out;
  }
  // phrases are space-separated words; «på» ends in a non-ASCII letter, so no \b around it
  const swapOverPa = s => s.replace(/(^| )(over|på)(?= |$)/, (a, sp, w) => sp + (w === 'over' ? 'på' : 'over'));
  const toggleHalv = s => (/(^| )halv( |$)/.test(s) ? (/ (over|på) halv /.test(' ' + s + ' ') ? s.replace(' halv', '') : null)
    : (/(^| )(over|på) /.test(s) && !/^kvart/.test(s) ? s.replace(/(^| )(over|på) /, '$1$2 halv ') : null));
  /** the classic confusions for this time, most instructive first: 24-hour times */
  function wrongTimes(q) {
    const t = q.t, c = colloq(t), out = [];
    const add = x => { if (x != null) out.push(mod(x, 1440)); };
    if (q.kind === 'formal') {
      add(t + 720); add(t - 60); add(t + 60);
      const m = t % 60; if (m >= 10 && m <= 50) add(t - m + (m % 10 === 0 ? m + 5 : m - 5)); add(t + 10); add(t - 10);
      return out;
    }
    if (/\bhalv\b/.test(c)) add(t - 60);                  // «halv fire» read as 4:30 ↔ «halv tre»
    const sw = parse(swapOverPa(c)); if (sw && swapOverPa(c) !== c) add(near(sw.t12, t)); // over ↔ på
    const th = toggleHalv(c); if (th) { const p = parse(th); if (p) add(near(p.t12, t)); } // på halv ↔ på
    if (q.kind === 'part') add(t + 720);                  // morning ↔ evening
    add(t + 60);
    const m = t % 60;
    if (m === 0) { add(t - 60); add(t + 120); add(t - 120); add(t + 30); }
    else if (m % 15 === 0) { add(t + 15); add(t - 15); }
    else { add(t + 5); add(t - 5); add(t + 10); }
    add(t - 60); add(t + 120);
    return out;
  }
  /** 3 wrong phrases, smart first; shuffled together with the right one → { options: [text], correct: index, times: [t] } */
  function options(q, rnd = Math.random) {
    const right = qText(q), picked = [], texts = new Set([right]);
    for (const x of wrongTimes(q)) {
      if (picked.length >= 6) break;
      const tx = textOf(q.kind, x);
      if (texts.has(tx)) continue;
      const p = parse(tx);
      if (!p || (q.kind === 'colloq' ? sameFace(q, p.t12) : p.t24 === q.t)) continue;
      texts.add(tx); picked.push({ text: tx, t: x });
    }
    // two most instructive + one of the rest
    const rest = picked.slice(2);
    const three = picked.slice(0, 2).concat(rest.length ? [rest[Math.floor(rnd() * rest.length)]] : []);
    const all = [{ text: right, t: q.t }].concat(three);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    return { options: all.map(o => o.text), times: all.map(o => o.t), correct: all.findIndex(o => o.text === right) };
  }

  /**
   * why the given answer is wrong — Russian, short. o.face: given is a time set on the 12-hour face (or a colloquial answer);
   * otherwise a 24-hour time. o.verb: 'поставили' (clock) | 'выбрали' (a phrase) | 'сказали' (speech).
   */
  function explain(q, given, o = {}) {
    const t = q.t, c = colloq(t), face = !!o.face || q.kind === 'colloq', verb = o.verb || (face ? 'поставили' : 'выбрали');
    const g = face ? near(mod(given, 720), t) : mod(given, 1440);
    const gc = colloq(g), tgt = q.kind === 'colloq' ? hm12(t) : digits(t);
    let d = mod(g - t, 720); if (d > 360) d -= 720;
    const L = [];
    const h = Math.floor(t / 60), mm = t % 60, nx = hw(h + 1), nxI = mod(h + 1, 12);
    const isSwap = () => { const s2 = swapOverPa(c); if (s2 === c) return false; const p = parse(s2); return !!p && mod(p.t12 - g, 720) === 0; };
    const isHalvToggle = () => { const s2 = toggleHalv(c); if (!s2) return false; const p = parse(s2); return !!p && mod(p.t12 - g, 720) === 0; };
    if (q.kind === 'formal') {
      if (!face && mod(g - t, 1440) === 720) L.push(`«${formal(t)}» — это 24-часовое время: <b>${digits(t)}</b>, а не ${digits(g)}. После 12 часы считают дальше: 13 — tretten, 14 — fjorten…`);
      else L.push(`«${formal(t)}» = <b>${written(t).replace('kl. ', '')}</b>: сначала час (${H24[h]}), потом минуты (${minWord(mm)}). На циферблате — <b>${hm12(t)}</b>${h > 12 ? ` (${h} − 12 = ${h - 12})` : ''}.`);
    } else if (q.kind === 'part' && !face && mod(g - t, 1440) === 720) {
      L.push(`Время верно, а часть дня — нет: <b>${partOf(t).no}</b> — ${partOf(t).ru}, это ${digits(t)}.`);
    } else if (/^halv /.test(c) && Math.abs(d) === 60) {
      L.push(`<b>«${c}» — это ${hm12(t)}</b>: половина <b>ДО</b> ${RU_GEN[nxI]} — как русское «${ru(t)}». Не «${RU_NOM[nxI]} с половиной»!`);
    } else if (/\bhalv\b/.test(c) && Math.abs(d) === 60) {
      L.push(`«halv ${nx}» — это ${hm12(t - mm + 30)}, половина <b>до</b> ${RU_GEN[nxI]}. Минуты считают от неё: «${c}» = <b>${hm12(t)}</b>.`);
    } else if (isSwap()) {
      L.push(`<b>over</b> = «после», <b>på</b> = «до». «${c}» = <b>${hm12(t)}</b> (дословно: ${literal(t)}), а ${hm12(g)} — это «${gc}».`);
    } else if (isHalvToggle()) {
      L.push(/\bhalv\b/.test(c)
        ? `С «halv» минуты считают <b>от половины</b>: «${c}» — ${literal(t)} = <b>${hm12(t)}</b>. Без «halv» («${gc}») было бы ${hm12(g)}.`
        : `Здесь нет «halv» — минуты считают от целого часа: «${c}» = <b>${hm12(t)}</b>. А «${gc}» (с halv) — это ${hm12(g)}.`);
    } else if (d % 60 === 0) {
      L.push(`Минуты верно, а час — нет. ${mm < 20 ? `В «${c}» назван <b>этот</b> час` : `В «${c}» назван <b>следующий</b> час (${nx}) — как в русском «${ru(t)}»`}.${face ? ` Часовая стрелка стоит ${mm ? 'между цифрами' : 'точно на цифре'}.` : ''}`);
    } else {
      L.push(`«${c}» — дословно «${literal(t)}» = <b>${hm12(t)}</b>.`);
    }
    const mine = verb === 'выбрали' ? `«${textOf(q.kind, g)}» — это ${q.kind === 'colloq' ? hm12(g) : digits(g)}` : `${face ? hm12(g) : digits(g)}${face ? ` — это «${gc}»` : ''}`;
    L.push(`Правильно: <b>${tgt}</b> — «${qText(q)}». Вы ${verb} ${mine}.`);
    return L;
  }

  const T = { mod, colloq, withPart, formal, digits, written, hm12, parse, norm, ru, literal, partOf, zoneOf, PARTS, LEVELS, H12, H24, minWord,
    makeQ, makeRound, options, wrongTimes, explain, qText, qSpeak, sameFace, swapOverPa, toggleHalv, near };
  if (typeof module === 'object' && module.exports) module.exports = T;
  if (typeof document === 'undefined') return; // Node: the rules only

  /* ======================================================================
   * 2. The clock
   * ====================================================================== */
  const reduce = () => !!(root.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const esc = s => (root.U && U.esc ? U.esc(s) : String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
  let uid = 0;
  const PT = (r, a) => [+(100 + r * Math.sin(a * Math.PI / 180)).toFixed(2), +(100 - r * Math.cos(a * Math.PI / 180)).toFixed(2)];
  function sector(r1, r2, a1, a2) {
    const [x1, y1] = PT(r2, a1), [x2, y2] = PT(r2, a2), [x3, y3] = PT(r1, a2), [x4, y4] = PT(r1, a1), L = a2 - a1 > 180 ? 1 : 0;
    return `M${x1} ${y1}A${r2} ${r2} 0 ${L} 1 ${x2} ${y2}L${x3} ${y3}A${r1} ${r1} 0 ${L} 0 ${x4} ${y4}Z`;
  }
  const ZONES = [
    { id: 'over', a1: 0, a2: 120, label: 'over', ru: 'после часа' },
    { id: 'pahalv', a1: 120, a2: 180, label: 'på halv', ru: 'до половины' },
    { id: 'overhalv', a1: 180, a2: 240, label: 'over halv', ru: 'после половины' },
    { id: 'pa', a1: 240, a2: 360, label: 'på', ru: 'до часа' },
  ];
  const legendHtml = () => `<div class="kl-legend">${ZONES.map(z => `<span class="kl-lg kl-z-${z.id}"><i></i><b lang="nb">${z.label}</b><small>${z.ru}</small></span>`).join('')}</div>`;

  /**
   * Clock(host, { interactive, zones, digital, h24, label, onChange(t12), onInput(t12) })
   * value: minutes on the face (0…719). Drag a hand (mouse, touch, pen) — snaps to 5 minutes; the hour hand follows the minutes.
   */
  function Clock(host, o = {}) {
    const id = 'klc' + (++uid);
    let T12 = 0, shown = 0, interactive = !!o.interactive, drag = null, raf = 0, idleT = 0, idleOn = false, anim = 0, ghostT = null;
    host.classList.add('kl-clock');
    const nums = H12.map((_, i) => { const [x, y] = PT(71, i * 30); return `<text x="${x}" y="${y}" class="kl-num">${i || 12}</text>`; }).join('');
    const ticks = Array.from({ length: 60 }, (_, i) => { const big = i % 5 === 0, [x1, y1] = PT(big ? 81 : 85, i * 6), [x2, y2] = PT(89.5, i * 6); return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${big ? 'kl-tk5' : 'kl-tk'}"/>`; }).join('');
    const hands = cls => `<g class="kl-hand kl-hour ${cls}"><rect x="96.4" y="49" width="7.2" height="63" rx="3.6"/></g>
      <g class="kl-hand kl-min ${cls}"><rect x="97.9" y="19" width="4.2" height="93" rx="2.1"/></g>`;
    host.innerHTML = `<div class="kl-face-wrap"><svg class="kl-svg" viewBox="0 0 200 200" role="group" aria-label="${esc(o.label || 'Часы')}">
      <defs>
        <radialGradient id="${id}f" cx="50%" cy="36%" r="72%"><stop offset="0" class="kl-f1"/><stop offset=".72" class="kl-f2"/><stop offset="1" class="kl-f3"/></radialGradient>
        <linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="kl-r1"/><stop offset=".5" class="kl-r2"/><stop offset="1" class="kl-r3"/></linearGradient>
        <linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      </defs>
      <circle cx="100" cy="100" r="99" fill="url(#${id}r)" class="kl-rim"/>
      <circle cx="100" cy="100" r="93" fill="url(#${id}f)" class="kl-dial"/>
      <g class="kl-zones">${ZONES.map(z => `<path class="kl-zone kl-z-${z.id}" d="${sector(57, 92.5, z.a1, z.a2)}"/>`).join('')}
        <line x1="100" y1="100" x2="100" y2="8" class="kl-zline"/><line x1="100" y1="100" x2="100" y2="192" class="kl-zline kl-zhalf"/>
        ${ZONES.map(z => { const [x, y] = PT(48, (z.a1 + z.a2) / 2); return `<text x="${x}" y="${y}" class="kl-zlab kl-z-${z.id}">${z.label}</text>`; }).join('')}</g>
      <g class="kl-ticks">${ticks}</g>
      <g class="kl-nums">${nums}</g>
      <g class="kl-dig" aria-hidden="true"><rect x="72" y="50" width="56" height="20" rx="6"/><text x="100" y="64.5" data-dig>12:00</text></g>
      <g class="kl-ghost" hidden>${hands('')}</g>
      <g class="kl-real">${hands('')}</g>
      <g class="kl-hand kl-sec"><line x1="100" y1="120" x2="100" y2="16"/><circle cx="100" cy="30" r="3.4"/></g>
      <circle cx="100" cy="100" r="5.2" class="kl-cap"/><circle cx="100" cy="100" r="1.8" class="kl-cap2"/>
      <ellipse cx="100" cy="55" rx="70" ry="40" fill="url(#${id}g)" class="kl-gloss"/>
      <line x1="100" y1="100" x2="100" y2="46" class="kl-hit" data-hand="hour" tabindex="-1" role="slider" aria-label="Часовая стрелка"/>
      <line x1="100" y1="100" x2="100" y2="14" class="kl-hit" data-hand="min" tabindex="-1" role="slider" aria-label="Минутная стрелка"/>
    </svg></div>`;
    const svg = host.querySelector('svg');
    const $ = s => svg.querySelector(s);
    const hourEl = $('.kl-real .kl-hour'), minEl = $('.kl-real .kl-min'), secEl = $('.kl-sec');
    const hits = [...svg.querySelectorAll('.kl-hit')];
    const rot = (el, a) => el.setAttribute('transform', `rotate(${(+a).toFixed(2)} 100 100)`);
    const draw = (v, sec) => {
      shown = v;
      const mn = mod(v, 60), hr = mod(v, 720);
      rot(hourEl, hr * 0.5); rot(minEl, mn * 6);
      rot(hits[0], hr * 0.5); rot(hits[1], mn * 6);
      if (sec != null) rot(secEl, sec * 6);
      if (!idleOn) { $('[data-dig]').textContent = o.h24 && o.h24Value != null ? digits(o.h24Value) : hm12(v); }
      hits.forEach(h => {
        const isH = h.dataset.hand === 'hour';
        h.setAttribute('aria-valuemin', '0'); h.setAttribute('aria-valuemax', isH ? '11' : '55');
        h.setAttribute('aria-valuenow', String(isH ? Math.floor(mod(T12, 720) / 60) : mod(T12, 60)));
        h.setAttribute('aria-valuetext', hm12(T12) + ' — ' + colloq(T12));
      });
    };
    const setInteractive = on => {
      interactive = !!on;
      host.classList.toggle('kl-interactive', interactive);
      hits.forEach(h => h.setAttribute('tabindex', interactive ? '0' : '-1'));
      svg.setAttribute('aria-label', interactive ? (o.label || 'Часы') + ': потяните стрелки или нажимайте стрелки на клавиатуре' : (o.label || 'Часы'));
    };
    const emit = (fn) => { if (fn) try { fn(T12); } catch (e) { console.warn(e); } };
    /* ---- dragging ---- */
    const polar = e => {
      const r = svg.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * 200 - 100, y = (e.clientY - r.top) / r.height * 200 - 100;
      return { a: mod(Math.atan2(x, -y) * 180 / Math.PI, 360), d: Math.hypot(x, y) };
    };
    const angDiff = (a, b) => { const d = mod(a - b, 360); return Math.min(d, 360 - d); };
    const moveTo = (which, a) => {
      if (which === 'min') {
        const nm = mod(Math.round(a / 30) * 5, 60);
        let d = nm - mod(T12, 60); if (d > 30) d -= 60; if (d < -30) d += 60;
        T12 = mod(T12 + d, 720);
      } else T12 = mod(Math.round(a * 2 / 5) * 5, 720);
      draw(T12);
      emit(o.onInput);
    };
    svg.addEventListener('pointerdown', e => {
      if (!interactive || (e.button != null && e.button > 0)) return;
      const p = polar(e); if (p.d > 99) return;
      stopAnim();
      // which hand: the minute hand is longer; near the centre the one whose direction is closer
      const dh = angDiff(p.a, mod(T12, 720) * 0.5), dm = angDiff(p.a, mod(T12, 60) * 6);
      const which = p.d > 60 ? 'min' : dh < 28 && dh <= dm ? 'hour' : dm < 28 ? 'min' : p.d < 42 ? 'hour' : 'min';
      drag = { which, id: e.pointerId };
      host.classList.add('kl-dragging', 'kl-drag-' + which);
      try { svg.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      e.preventDefault();
      moveTo(which, p.a);
    });
    svg.addEventListener('pointermove', e => { if (drag && e.pointerId === drag.id) { e.preventDefault(); moveTo(drag.which, polar(e).a); } });
    const end = e => {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      host.classList.remove('kl-dragging', 'kl-drag-hour', 'kl-drag-min');
      drag = null; emit(o.onChange);
    };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end); svg.addEventListener('lostpointercapture', end);
    /* ---- keyboard: ← → ↑ ↓ ±5 min (minute hand) or ±1 hour (hour hand); PageUp/PageDown ±1 hour ---- */
    svg.addEventListener('keydown', e => {
      if (!interactive) return;
      const h = e.target.closest && e.target.closest('[data-hand]'); const isH = h && h.dataset.hand === 'hour';
      let d = 0;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') d = isH ? 60 : 5;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') d = isH ? -60 : -5;
      else if (e.key === 'PageUp') d = 60; else if (e.key === 'PageDown') d = -60;
      if (!d) return;
      e.preventDefault(); e.stopPropagation();
      stopAnim(); T12 = mod(T12 + d, 720); draw(T12); emit(o.onInput); emit(o.onChange);
    });
    /* ---- animation ---- */
    function stopAnim() { if (anim) { const a = anim; anim = 0; cancelAnimationFrame(a.raf); clearTimeout(a.to); a.done(); } }
    function animateTo(t, ms = 750) {
      stopAnim();
      t = mod(t, 720);
      if (reduce() || !ms || !host.isConnected) { T12 = t; draw(T12); return Promise.resolve(); }
      const from = shown; let d = mod(t - from, 720); if (d > 360) d -= 720;
      T12 = t;
      return new Promise(res => {
        const t0 = performance.now(), a = { raf: 0, to: 0, done: () => { draw(T12); res(); } };
        const fin = () => { if (anim !== a) return; anim = 0; cancelAnimationFrame(a.raf); clearTimeout(a.to); a.done(); };
        const step = now => {
          if (anim !== a) return;
          const k = Math.min(1, (now - t0) / ms), ez = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          draw(from + d * ez);
          if (k < 1) a.raf = requestAnimationFrame(step); else fin();
        };
        anim = a; a.raf = requestAnimationFrame(step); a.to = setTimeout(fin, ms + 400); // a hidden tab gets no frames
      });
    }
    /* ---- idle: the real time with a sweeping second hand ---- */
    function idle(on) {
      idleOn = !!on;
      host.classList.toggle('kl-idle', idleOn);
      cancelAnimationFrame(raf); clearInterval(idleT);
      if (!idleOn) { rot(secEl, 0); draw(T12); return; }
      const tick = () => {
        if (!host.isConnected) { cancelAnimationFrame(raf); clearInterval(idleT); return; }
        const n = new Date(), s = n.getSeconds() + (reduce() ? 0 : n.getMilliseconds() / 1000);
        T12 = mod(n.getHours() * 60 + n.getMinutes(), 720);
        draw(mod(n.getHours() * 60 + n.getMinutes() + s / 60, 720), s);
        $('[data-dig]').textContent = digits(n.getHours() * 60 + n.getMinutes());
      };
      tick();
      if (reduce()) idleT = setInterval(tick, 1000);
      else { const loop = () => { tick(); if (idleOn && host.isConnected) raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); idleT = setInterval(() => { if (document.hidden) tick(); }, 1000); }
    }
    const api = {
      el: host, svg,
      get value() { return T12; },
      set(t, opt = {}) { if (opt.animate) return animateTo(t, opt.ms); stopAnim(); T12 = mod(t, 720); draw(T12); return Promise.resolve(); },
      animateTo, idle, setInteractive,
      zones(on) { host.classList.toggle('kl-zones-on', !!on); return api; },
      digital(on) { host.classList.toggle('kl-dig-on', !!on); return api; },
      h24(v) { o.h24 = v != null; o.h24Value = v; draw(shown); return api; },
      ghost(t) { ghostT = t; const g = $('.kl-ghost'); if (t == null) { g.setAttribute('hidden', ''); return api; } g.removeAttribute('hidden'); rot(g.querySelector('.kl-hour'), mod(t, 720) * 0.5); rot(g.querySelector('.kl-min'), mod(t, 60) * 6); return api; },
      flash(kind) { host.classList.remove('kl-ok', 'kl-bad'); void host.offsetWidth; if (kind) host.classList.add('kl-' + kind); return api; },
      focus() { const h = hits[1]; if (h && h.focus) try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } },
      destroy() { idle(false); stopAnim(); },
      get ghostValue() { return ghostT; },
    };
    setInteractive(interactive);
    if (o.zones) api.zones(true);
    if (o.digital) api.digital(true);
    draw(T12);
    return api;
  }

  /* ======================================================================
   * 3. Progress (this device)
   * ====================================================================== */
  const KEY = 'nk-klokka';
  const defaults = () => ({ v: 1, level: 1, timed: false, digital: false, total: 0, best: {}, stars: {}, mistakes: [], lesson: [], played: 0 });
  let S = null;
  const st = () => {
    if (S) return S;
    try { S = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}') || {}); } catch (e) { S = defaults(); }
    if (!Array.isArray(S.mistakes)) S.mistakes = [];
    if (!Array.isArray(S.lesson)) S.lesson = [];
    return S;
  };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode: kept for this visit */ } };
  const bestKey = (mode, level, timed) => `${mode}:${level}:${timed ? 't' : 'n'}`;
  const starsFor = (ok, n) => (!n ? 0 : ok === n ? 3 : ok / n >= 0.8 ? 2 : ok / n >= 0.6 ? 1 : 0);
  const starsHtml = n => `<span class="kl-stars" aria-label="${n} из 3 звёзд">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}">★</i>`).join('')}</span>`;
  const qKey = q => q.kind + ':' + q.t;
  function addMistake(q, mode) {
    const s = st(), k = qKey(q);
    s.mistakes = s.mistakes.filter(x => qKey(x) !== k);
    s.mistakes.unshift({ t: q.t, kind: q.kind, mode, at: Date.now() });
    s.mistakes = s.mistakes.slice(0, 40);
  }
  const dropMistake = q => { const s = st(), k = qKey(q); s.mistakes = s.mistakes.filter(x => qKey(x) !== k); };

  /* ======================================================================
   * 4. The window
   * ====================================================================== */
  const say = (text, opts) => { try { if (root.TTS) return TTS.speak(text, 'no', opts || {}); } catch (e) { /* no voice */ } return Promise.resolve(); };
  const SPK = '<svg class="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  const sayBtn = (text, cls = '', label = '') => `<button type="button" class="kl-say ${cls}" data-say="${esc(text)}" aria-label="Послушать: ${esc(text)}" title="Послушать">${SPK}${label ? `<span>${label}</span>` : ''}</button>`;
  const MODES = {
    show: { ico: '🎯', name: 'Покажи время', desc: 'Норвежская фраза — поставьте стрелки' },
    which: { ico: '🤔', name: 'Который час?', desc: 'Часы показывают время — выберите фразу из четырёх' },
    listen: { ico: '🎧', name: 'На слух', desc: 'Только звук — поставьте стрелки' },
    say: { ico: '🗣', name: 'Скажи сам', desc: 'Назовите время вслух по-норвежски' },
  };
  const canSay = () => !!(root.Speech && Speech.recorder) && !!(root.SpeechRecognition || root.webkitSpeechRecognition || (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof WebAssembly === 'object'));
  const ROUND = 10, TIMED_MS = 60000;
  const mult = streak => Math.min(4, 1 + Math.floor(streak / 3));
  const basePts = level => 10 + 2 * (level - 1);

  /* ---------- lesson content ---------- */
  const EX = (t, kind = 'colloq') => ({ t, kind });
  const LESSON = [
    { id: 'hel', title: 'Целые часы', zones: false, ex: [EX(180), EX(420), EX(60), EX(720 - 720)],
      html: `<p>Спросить время: <b lang="nb">Hva er klokka?</b> ${sayBtn('Hva er klokka?')} или <b lang="nb">Hvor mye er klokka?</b> ${sayBtn('Hvor mye er klokka?')}</p>
        <p>Ответ: <b lang="nb">Klokka er tre.</b> — просто число, слово «час» не нужно. Час дня — <b lang="nb">ett</b> (не «en»): <i lang="nb">klokka er ett</i>.</p>`,
      check: { type: 'pick', t: 480, kind: 'colloq', ask: 'Сколько на часах? Выберите фразу.' } },
    { id: 'kvart', title: 'Четверть: kvart over / kvart på', zones: ['over', 'pa'], ex: [EX(195), EX(225), EX(495), EX(525)],
      html: `<p><b lang="nb">over</b> — «после»: минуты <b>после</b> часа. <b lang="nb">på</b> — «до»: минуты <b>до</b> следующего часа.</p>
        <p><b lang="nb">kvart over tre</b> = 3:15 — «четверть четвёртого». <b lang="nb">kvart på fire</b> = 3:45 — «без четверти четыре»: как и по-русски, называем <b>следующий</b> час.</p>
        <p class="small muted">Четверть часа — <b lang="nb">et kvarter</b>: <i lang="nb">om et kvarter</i> — через 15 минут.</p>`,
      check: { type: 'set', t: 345, kind: 'colloq', ask: 'Поставьте стрелки:' } },
    { id: 'halv', title: 'halv — главная ловушка', zones: ['pahalv', 'overhalv'], ex: [EX(210), EX(390), EX(30), EX(570)],
      html: `<div class="kl-trap"><b>halv fire = 3:30</b>, а не 4:30!</div>
        <p><b lang="nb">halv</b> — это половина <b>до</b> следующего часа. Русский говорит точно так же: <b>halv fire</b> = «<b>половина четвёртого</b>», а не «четыре с половиной».</p>
        <p>Осторожно с английским: британское «half four» — это 4:30, ровно наоборот. Думайте по-русски — «половина четвёртого».</p>`,
      check: { type: 'set', t: 510, kind: 'colloq', ask: 'Поставьте стрелки:' } },
    { id: 'fem', title: '5 и 10 минут: over / på', zones: ['over', 'pa'], ex: [EX(185), EX(190), EX(230), EX(235)],
      html: `<p><b lang="nb">fem over tre</b> = 3:05, <b lang="nb">ti over tre</b> = 3:10, <b lang="nb">ti på fire</b> = 3:50, <b lang="nb">fem på fire</b> = 3:55.</p>
        <p>Как по-русски: «пять минут четвёртого», «без десяти четыре». Зелёная зона — <b lang="nb">over</b> (после часа), голубая — <b lang="nb">på</b> (до часа).</p>
        <p class="small muted">«tjue over tre» (3:20) и «tjue på fire» (3:40) тоже иногда говорят — вас поймут, но чаще считают от половины (следующий шаг).</p>`,
      check: { type: 'pick', t: 590, kind: 'colloq', ask: 'Сколько на часах? Выберите фразу.' } },
    { id: 'pahalv', title: 'på halv / over halv', zones: true, ex: [EX(200), EX(205), EX(210), EX(215), EX(220)],
      html: `<p>С 20 до 40 минут норвежцы считают <b>от половины</b> часа:</p>
        <ul class="kl-ul"><li><b lang="nb">ti på halv fire</b> = 3:20 — «десять до половины четвёртого»</li><li><b lang="nb">fem på halv fire</b> = 3:25</li>
        <li><b lang="nb">halv fire</b> = 3:30</li><li><b lang="nb">fem over halv fire</b> = 3:35 — «пять после половины четвёртого»</li><li><b lang="nb">ti over halv fire</b> = 3:40</li></ul>
        <p>Жёлтая зона — <b lang="nb">på halv</b>, сиреневая — <b lang="nb">over halv</b>. Час всегда <b>следующий</b> (fire), как в «половина четвёртого».</p>`,
      check: { type: 'set', t: 455, kind: 'colloq', ask: 'Поставьте стрелки:' } },
    { id: 'formal', title: 'Официально: 24 часа', zones: false, ex: [EX(870, 'formal'), EX(545, 'formal'), EX(1125, 'formal'), EX(1260, 'formal')],
      html: `<p>Расписания, врач, NAV, работа, радио — время по 24 часам, цифрами: <b lang="nb">kl. 14.30</b> → <b lang="nb">klokka fjorten tretti</b>.</p>
        <p>Пишут с точкой: <b>kl. 09.05</b> (читается <i lang="nb">ni null fem</i>). Целый час — просто число: <b>kl. 21.00</b> — <i lang="nb">klokka tjueen</i>.</p>`,
      check: { type: 'pick', t: 1125, kind: 'formal', ask: 'Как прочитать «kl. 18.45»?' } },
    { id: 'deler', title: 'Части дня и предлоги', zones: false, ex: [EX(450, 'part'), EX(630, 'part'), EX(900, 'part'), EX(1230, 'part'), EX(150, 'part')],
      phrases: [['Vi møtes klokka tre.', 'Встречаемся в три (без «i» и «på»: просто klokka + время).'], ['Bussen går halv fire.', 'Автобус в 3:30 («i halv fire» так не говорят).'],
        ['Jeg kommer om en halvtime.', 'Я приду через полчаса.'], ['Filmen begynner om et kvarter.', 'Фильм начнётся через 15 минут.'],
        ['Han ringte for ti minutter siden.', 'Он звонил 10 минут назад.'], ['før klokka fem · etter klokka fem', 'до пяти · после пяти'],
        ['Butikken er åpen fra ni til fire.', 'Магазин открыт с девяти до четырёх.'], ['Vi ses ved firetiden.', 'Увидимся около четырёх.'], ['Klokka er nesten tre · litt over tre', 'почти три · начало четвёртого']],
      html: `<p>В разговоре — 12 часов и часть дня: <b lang="nb">om morgenen</b> (утром, 6–9), <b lang="nb">om formiddagen</b> (до полудня, 9–12), <b lang="nb">om ettermiddagen</b> (днём, 12–18), <b lang="nb">om kvelden</b> (вечером, 18–24), <b lang="nb">om natta</b> (ночью, 0–6).</p>`,
      check: { type: 'phrase', ask: '«Через полчаса» по-норвежски:', options: ['om en halvtime', 'i en halvtime', 'for en halvtime siden'], correct: 0,
        why: '«om» + время = «через»; «i en halvtime» — «в течение получаса», «for … siden» — «… назад».' } },
  ];

  /* ---------- the modal ---------- */
  let cur = null; // the open window's context
  function open(view, opts) {
    if (cur && cur.alive()) { cur.go(view || 'hub', opts || {}); return cur; }
    const ctx = { view: '', game: null, keys: null, clocks: [], cardsAdded: 0 };
    let closed = false;
    const m = UI.modal({
      title: '🕐 Klokka — время по-норвежски', cls: 'wide klokka-modal', body: '<div class="kl-root" data-kl></div>',
      beforeClose: UI.guard(() => (ctx.game && ctx.game.running() ? { title: 'Закончить игру?', line: 'Очки сохранятся.',
        actions: [{ label: 'Закончить', value: 'end', cls: 'primary' }], cancel: 'Продолжить',
        act: () => { if (ctx.game) ctx.game.stop(true); return true; } } : null)),
      onClose: () => {
        closed = true; cur = null;
        if (ctx.game) ctx.game.stop(true);
        ctx.clocks.forEach(c => c.destroy());
        document.removeEventListener('keydown', onKey, true);
        try { TTS.stop(); } catch (e) { /* ignore */ }
        if (ctx.cardsAdded && root.App && App.view && App.view.name !== 'study') { try { App.render(); } catch (e) { /* ignore */ } }
      },
    });
    ctx.m = m; ctx.body = m.$('[data-kl]');
    ctx.alive = () => !closed && m.el.isConnected; // a window removed from the page without closing is dead too
    ctx.title = h => { const el = m.$('.modal-head h2'); if (el) el.innerHTML = h; };
    ctx.clock = (el, o) => { const c = Clock(el, o); ctx.clocks.push(c); return c; };
    ctx.go = (view, o = {}) => {
      if (closed) return;
      if (ctx.game) { ctx.game.stop(false); ctx.game = null; }
      ctx.clocks.forEach(c => c.destroy()); ctx.clocks = [];
      ctx.keys = null; ctx.view = view; ctx.token = {};
      try { TTS.stop(); } catch (e) { /* ignore */ }
      const mb = m.$('.modal-body'); if (mb) mb.scrollTop = 0;
      ctx.body.onclick = null;
      try { (VIEWS[view] || VIEWS.hub)(ctx, o); } catch (err) { console.error(err); UI.toast('Не удалось открыть: попробуйте ещё раз', 'warn'); if (view !== 'hub') VIEWS.hub(ctx, {}); }
    };
    // one listener for the whole window: «🔊» buttons
    m.el.addEventListener('click', e => { const b = e.target.closest('[data-say]'); if (b) { e.preventDefault(); say(b.dataset.say); } });
    const onKey = e => {
      if (closed || !ctx.keys) return;
      const backs = [...document.querySelectorAll('#modal-root > .modal-backdrop:not(.closing)')];
      if (backs[backs.length - 1] !== m.el.parentElement) return;
      ctx.keys(e);
    };
    document.addEventListener('keydown', onKey, true);
    cur = ctx;
    ctx.go(view || 'hub', opts || {});
    return ctx;
  }

  const VIEWS = {};
  /* ---------- hub ---------- */
  VIEWS.hub = ctx => {
    ctx.title('🕐 Klokka — время по-норвежски');
    const s = st(), lvl = Math.max(1, Math.min(6, s.level || 1));
    const done = s.lesson.length;
    const modes = Object.keys(MODES).filter(k => k !== 'say' || canSay());
    const best = k => { const v = [1, 2, 3, 4, 5, 6].map(l => Math.max(s.best[bestKey(k, l, false)] || 0, s.best[bestKey(k, l, true)] || 0)); return Math.max(...v); };
    ctx.body.innerHTML = `<div class="kl-hub">
      <section class="kl-hero">
        <div class="kl-hero-clock" data-hero-clock></div>
        <div class="kl-hero-txt">
          <div class="kl-eyebrow">Сейчас <span data-now-dig></span></div>
          <div class="kl-now" lang="nb"><b data-now-no></b><button type="button" class="kl-say lg" data-say-now aria-label="Послушать, который час">${SPK}</button></div>
          <div class="kl-now-ru" data-now-ru></div>
          <p class="kl-lead">Главная ловушка: <b lang="nb">halv fire</b> — это <b>3:30</b> («половина четвёртого»), а не 4:30.</p>
          <button type="button" class="kl-lesson-btn" data-go-lesson><span class="kl-lb-ico" aria-hidden="true">📖</span><span><b>Как говорят время</b><small>${LESSON.length} коротких шагов с часами и звуком${done ? ` · пройдено ${done} из ${LESSON.length}` : ''}</small></span><span class="kl-go" aria-hidden="true">›</span></button>
        </div>
      </section>
      <section class="kl-setup">
        <div class="kl-sec-title">Уровень</div>
        <div class="kl-levels" role="radiogroup" aria-label="Уровень">${LEVELS.map(L => `<button type="button" role="radio" class="kl-level ${L.n === lvl ? 'active' : ''}" aria-checked="${L.n === lvl}" data-level="${L.n}">
          <span class="kl-ln">${L.n}</span><span class="kl-lt"><b>${L.name}</b><small lang="nb">${L.no}</small></span>${starsHtml(s.stars[L.n] || 0)}</button>`).join('')}</div>
        <label class="switch kl-speed"><input type="checkbox" data-timed ${s.timed ? 'checked' : ''}><span class="track"></span><span>⚡ <b>На скорость</b> — сколько успеете за 60 секунд</span></label>
      </section>
      <section>
        <div class="kl-sec-title">Игры <small class="muted">— нажмите, чтобы начать</small></div>
        <div class="kl-modes">${modes.map(k => { const M = MODES[k], b = best(k); return `<button type="button" class="kl-mode" data-mode="${k}"><span class="kl-mode-ico" aria-hidden="true">${M.ico}</span>
          <span class="kl-mode-txt"><b>${M.name}</b><span>${M.desc}</span><small>${b ? `рекорд: ${b}` : 'ещё не играли'}</small></span><span class="kl-go" aria-hidden="true">▶</span></button>`; }).join('')}</div>
      </section>
      <div class="kl-hub-foot">
        <span class="kl-total">⭐ Всего очков: <b>${s.total}</b></span>
        <span class="grow"></span>
        ${s.mistakes.length ? `<button type="button" class="btn sm" data-replay>🔁 Повторить ошибки (${s.mistakes.length})</button>
        <button type="button" class="btn sm ghost" data-cards title="Сделать карточки из фраз, в которых были ошибки — в колоду «🕐 Klokka»">📇 Ошибки → карточки</button>` : '<span class="small muted">Ошибки будут собираться здесь — их можно повторить</span>'}
      </div>
    </div>`;
    const hc = ctx.clock(ctx.body.querySelector('[data-hero-clock]'), { label: 'Сейчас' });
    hc.digital(false).idle(true);
    let lastNow = '';
    const tok = ctx.token;
    const now = () => {
      if (!ctx.alive() || ctx.token !== tok) return clearInterval(nt);
      const n = new Date(), real = n.getHours() * 60 + n.getMinutes(), t = snap5(real);
      const lead = real === t ? 'Klokka er ' : real < t || (t === 0 && real > 1435) ? 'Klokka er nesten ' : 'Klokka er litt over ';
      const no = lead + colloq(t);
      const a = ctx.body.querySelector('[data-now-no]'); if (!a) return;
      ctx.body.querySelector('[data-now-dig]').textContent = digits(real);
      if (no === lastNow) return; lastNow = no;
      a.textContent = no;
      ctx.body.querySelector('[data-now-ru]').textContent = `${real === t ? '' : '≈ '}${ru(t)}${real === t ? '' : ` (${hm12(t)})`} ${partOf(t).ru}`;
    };
    const nt = setInterval(now, 5000); now();
    ctx.body.onclick = e => {
      const b = e.target.closest('button, input'); if (!b) return;
      if (b.hasAttribute('data-say-now')) { say(ctx.body.querySelector('[data-now-no]').textContent + '.'); return; }
      if (b.hasAttribute('data-go-lesson')) { const f = LESSON.findIndex(x => !s.lesson.includes(x.id)); ctx.go('lesson', { step: f < 0 ? 0 : f }); return; }
      if (b.dataset.level) {
        s.level = +b.dataset.level; save();
        ctx.body.querySelectorAll('[data-level]').forEach(x => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-checked', String(on)); });
        return;
      }
      if (b.dataset.mode) { ctx.go('game', { mode: b.dataset.mode, level: s.level || 1, timed: !!s.timed }); return; }
      if (b.hasAttribute('data-replay')) { ctx.go('game', { mode: 'show', level: s.level || 1, timed: false, replay: true }); return; }
      if (b.hasAttribute('data-cards')) { mistakesToCards(ctx); return; }
    };
    ctx.body.querySelector('[data-timed]').onchange = e => { s.timed = e.target.checked; save(); };
  };

  /* ---------- lesson ---------- */
  VIEWS.lesson = (ctx, o) => {
    ctx.title('📖 Как говорят время');
    let k = Math.max(0, Math.min(LESSON.length - 1, o.step || 0)), demo = 0;
    ctx.body.innerHTML = `<div class="kl-lesson">
      <div class="kl-ltop"><button type="button" class="btn sm ghost kl-back" data-back>‹ Klokka</button>
        <div class="kl-dots" role="tablist" aria-label="Шаги урока">${LESSON.map((x, i) => `<button type="button" role="tab" class="kl-dot" data-step="${i}" aria-label="Шаг ${i + 1}: ${esc(x.title)}"></button>`).join('')}</div></div>
      <div class="kl-lbody">
        <div class="kl-lclock"><div data-clock></div><div data-legend></div></div>
        <div class="kl-step" data-stepbox aria-live="polite"></div>
      </div>
      <div class="kl-lnav"><button type="button" class="btn" data-prev>‹ Назад</button><span class="grow"></span><button type="button" class="btn primary" data-next>Дальше ›</button></div>
    </div>`;
    const clock = ctx.clock(ctx.body.querySelector('[data-clock]'), { label: 'Часы урока' });
    const box = ctx.body.querySelector('[data-stepbox]');
    const legend = ctx.body.querySelector('[data-legend]');
    let check = null;
    const markDone = id => { const s = st(); if (!s.lesson.includes(id)) { s.lesson.push(id); save(); } drawDots(); };
    const drawDots = () => ctx.body.querySelectorAll('.kl-dot').forEach((d, i) => { d.classList.toggle('active', i === k); d.classList.toggle('done', st().lesson.includes(LESSON[i].id)); d.setAttribute('aria-selected', String(i === k)); });
    const setZones = z => {
      clock.zones(!!z);
      clock.el.classList.remove('kl-zsel'); ZONES.forEach(x => clock.el.classList.remove('kl-zshow-' + x.id));
      if (Array.isArray(z)) { clock.el.classList.add('kl-zsel'); z.forEach(x => clock.el.classList.add('kl-zshow-' + x)); }
      legend.innerHTML = z ? legendHtml() : '';
      if (Array.isArray(z)) legend.querySelectorAll('.kl-lg').forEach(l => { if (!z.some(x => l.classList.contains('kl-z-' + x))) l.classList.add('dim'); });
    };
    const exHtml = (q, i) => {
      const txt = qText(q), shownT = q.kind === 'colloq' ? hm12(q.t) : q.kind === 'formal' ? written(q.t) : digits(q.t);
      return `<button type="button" class="kl-ex" data-ex="${i}"><span class="kl-ex-t">${shownT}</span><b lang="nb">${esc(txt)}</b>${q.kind === 'colloq' ? `<small>${esc(ru(q.t))}</small>` : q.kind === 'part' ? `<small>${esc(ru(q.t))} ${partOf(q.t).ru}</small>` : ''}<span class="kl-ex-say" aria-hidden="true">${SPK}</span></button>`;
    };
    const showEx = (q, speak) => {
      ctx.body.querySelectorAll('.kl-ex').forEach(b => b.classList.toggle('on', +b.dataset.ex === step().ex.indexOf(q)));
      clock.h24(q.kind === 'colloq' ? null : q.t);
      clock.animateTo(q.t);
      if (speak) say(qSpeak(q));
    };
    const step = () => LESSON[k];
    function draw() {
      clearTimeout(demo); check = null;
      const L = step();
      drawDots();
      setZones(L.zones);
      clock.setInteractive(false); clock.ghost(null); clock.flash(null);
      clock.digital(L.id === 'formal' || L.id === 'deler');
      box.innerHTML = `<div class="kl-step-in ${reduce() ? '' : 'anim'}">
        <div class="kl-step-n">Шаг ${k + 1} из ${LESSON.length}</div>
        <h3>${esc(L.title)}</h3>
        ${L.html}
        <div class="kl-exs">${L.ex.map(exHtml).join('')}</div>
        ${L.phrases ? `<div class="kl-phr">${L.phrases.map(([no, r]) => `<div class="kl-ph"><button type="button" class="kl-say" data-say="${esc(no.replace(/ · /g, '. '))}" aria-label="Послушать">${SPK}</button><span><b lang="nb">${esc(no)}</b><small>${esc(r)}</small></span></div>`).join('')}</div>` : ''}
        <div class="kl-check" data-check></div>
      </div>`;
      drawCheck();
      ctx.body.querySelector('[data-prev]').disabled = k === 0;
      ctx.body.querySelector('[data-next]').innerHTML = k === LESSON.length - 1 ? '🎮 К играм' : 'Дальше ›';
      // a short demo: the clock walks through the examples (no sound — sound on tap)
      let i = 0;
      const tok = ctx.token;
      const walk = () => { if (!ctx.alive() || ctx.token !== tok || (check && check.busy)) return; const q = L.ex[i % L.ex.length]; showEx(q, false); i++; if (i < L.ex.length) demo = setTimeout(walk, reduce() ? 1600 : 1900); };
      walk();
    }
    function drawCheck() {
      const L = step(), c = L.check, el = box.querySelector('[data-check]');
      if (!c) { el.innerHTML = ''; return; }
      const doneMark = st().lesson.includes(L.id) ? '<span class="kl-ok-mark">✓ пройдено</span>' : '';
      if (c.type === 'set') {
        const q = { t: c.t, kind: c.kind };
        el.innerHTML = `<div class="kl-check-h">✏️ Мини-проверка ${doneMark}</div><p>${c.ask} <b lang="nb">${esc(qText(q))}</b> ${sayBtn(qSpeak(q))}</p>
          <div class="row"><button type="button" class="btn primary" data-c-try>🕐 Поставить стрелки</button></div><div class="kl-c-fb" data-c-fb></div>`;
        el.querySelector('[data-c-try]').onclick = e => {
          clearTimeout(demo); check = { busy: true, q };
          clock.ghost(null); clock.flash(null); clock.h24(null);
          clock.set(0, { animate: true, ms: 400 });
          clock.setInteractive(true); clock.focus();
          e.target.outerHTML = '<button type="button" class="btn primary" data-c-check>✓ Проверить</button>';
          el.querySelector('.kl-c-fb').innerHTML = '<span class="small muted">Потяните стрелки (или стрелками на клавиатуре) и нажмите «Проверить».</span>';
          el.querySelector('[data-c-check]').onclick = () => verifySet(q, el);
        };
      } else if (c.type === 'pick') {
        const q = { t: c.t, kind: c.kind };
        el.innerHTML = `<div class="kl-check-h">✏️ Мини-проверка ${doneMark}</div><p>${c.ask}</p>
          <div class="row"><button type="button" class="btn primary" data-c-try>✏️ Проверить себя</button></div><div class="kl-c-fb" data-c-fb></div>`;
        el.querySelector('[data-c-try]').onclick = e => {
          const op = options(q);
          clearTimeout(demo); check = { busy: true, q };
          clock.ghost(null); clock.flash(null);
          clock.h24(q.kind === 'colloq' ? null : q.t); clock.animateTo(q.t);
          ctx.body.querySelectorAll('.kl-ex').forEach(x => x.classList.remove('on'));
          e.target.closest('.row').outerHTML = `<div class="kl-opts">${op.options.map((t, i) => `<button type="button" class="kl-opt" data-c-opt="${i}" lang="nb">${esc(t)}</button>`).join('')}</div>`;
          el.querySelectorAll('[data-c-opt]').forEach(b => b.onclick = () => {
            const i = +b.dataset.cOpt, okk = i === op.correct;
            el.querySelectorAll('[data-c-opt]').forEach((x, j) => { x.disabled = true; x.classList.toggle('ok', j === op.correct); x.classList.toggle('bad', j === i && !okk); });
            const fb = el.querySelector('[data-c-fb]');
            check = null;
            if (okk) { fb.innerHTML = `<div class="kl-fb-ok">✓ Верно! <b lang="nb">${esc(qText(q))}</b> ${sayBtn(qSpeak(q))}</div>`; markDone(L.id); clock.flash('ok'); }
            else { fb.innerHTML = `<div class="kl-fb-bad">✗ ${explain(q, op.times[i], { verb: 'выбрали' }).join(' ')}</div><button type="button" class="btn sm" data-c-again>🔁 Ещё раз</button>`; fb.querySelector('[data-c-again]').onclick = drawCheck; clock.flash('bad'); }
            say(qSpeak(q));
          });
        };
      } else {
        el.innerHTML = `<div class="kl-check-h">✏️ Мини-проверка ${doneMark}</div><p>${c.ask}</p><div class="kl-opts">${c.options.map((t, i) => `<button type="button" class="kl-opt" data-c-opt="${i}" lang="nb">${esc(t)}</button>`).join('')}</div><div class="kl-c-fb" data-c-fb></div>`;
        el.querySelectorAll('[data-c-opt]').forEach(b => b.onclick = () => {
          const i = +b.dataset.cOpt, okk = i === c.correct;
          el.querySelectorAll('[data-c-opt]').forEach((x, j) => { x.disabled = true; x.classList.toggle('ok', j === c.correct); x.classList.toggle('bad', j === i && !okk); });
          el.querySelector('[data-c-fb]').innerHTML = `<div class="${okk ? 'kl-fb-ok' : 'kl-fb-bad'}">${okk ? '✓ Верно!' : '✗ Не совсем.'} ${c.why}</div>${okk ? '' : '<button type="button" class="btn sm" data-c-again>🔁 Ещё раз</button>'}`;
          const a = el.querySelector('[data-c-again]'); if (a) a.onclick = drawCheck;
          if (okk) markDone(L.id);
          say(c.options[c.correct]);
        });
      }
    }
    function verifySet(q, el) {
      const v = clock.value, okk = sameFace(q, v), fb = el.querySelector('[data-c-fb]');
      clock.setInteractive(false);
      if (okk) { fb.innerHTML = `<div class="kl-fb-ok">✓ Верно! ${hm12(q.t)} — <b lang="nb">${esc(qText(q))}</b> ${sayBtn(qSpeak(q))}</div>`; clock.flash('ok'); markDone(step().id); }
      else {
        clock.ghost(v); clock.flash('bad'); clock.animateTo(q.t, 900);
        fb.innerHTML = `<div class="kl-fb-bad">✗ ${explain(q, v, { face: true }).join(' ')}</div><button type="button" class="btn sm" data-c-again>🔁 Ещё раз</button>`;
        fb.querySelector('[data-c-again]').onclick = () => { check = null; drawCheck(); };
      }
      check = null;
      const btn = el.querySelector('[data-c-check]'); if (btn) btn.remove();
      say(qSpeak(q));
    }
    ctx.body.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-back')) { ctx.go('hub'); return; }
      if (b.dataset.step != null) { k = +b.dataset.step; draw(); return; }
      if (b.hasAttribute('data-prev')) { if (k > 0) { k--; draw(); } return; }
      if (b.hasAttribute('data-next')) { if (!step().check) markDone(step().id); if (k < LESSON.length - 1) { k++; draw(); } else ctx.go('hub'); return; }
      if (b.dataset.ex != null) { clearTimeout(demo); if (check && check.busy) return; showEx(step().ex[+b.dataset.ex], true); }
    };
    ctx.keys = e => {
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA/.test(tag) || (e.target.closest && e.target.closest('.kl-svg'))) return;
      if (e.key === 'ArrowRight' && k < LESSON.length - 1) { e.preventDefault(); k++; draw(); }
      else if (e.key === 'ArrowLeft' && k > 0) { e.preventDefault(); k--; draw(); }
    };
    draw();
  };

  /* ---------- game ---------- */
  VIEWS.game = (ctx, o) => {
    const s = st();
    const mode = MODES[o.mode] && (o.mode !== 'say' || canSay()) ? o.mode : 'show';
    const level = Math.max(1, Math.min(6, +o.level || 1));
    const replay = !!o.replay, timed = !!o.timed && !replay;
    const M = MODES[mode];
    ctx.title(`${M.ico} ${M.name}`);
    const queue = replay ? st().mistakes.slice(0, ROUND).map(x => ({ t: x.t, kind: x.kind })) : timed ? [] : makeRound(level, ROUND);
    if (replay && !queue.length) { ctx.go('hub'); return; }
    const G = { i: -1, q: null, score: 0, streak: 0, bestStreak: 0, ok: 0, n: 0, wrong: [], answered: false, over: false, deadline: 0, timer: 0, next: 0, opts: null, rec: null };
    const total = queue.length;
    ctx.body.innerHTML = `<div class="kl-game" data-gmode="${mode}">
      <div class="kl-gbar">
        <button type="button" class="btn sm ghost kl-back" data-back>‹ Игры</button>
        <span class="kl-gtag">${replay ? '🔁 Ошибки' : `Уровень ${level} · ${esc(LEVELS[level - 1].name)}`}</span>
        <span class="grow"></span>
        <span class="kl-streak" data-streak title="Серия верных ответов: каждые 3 подряд — множитель очков больше">🔥 <b>0</b> <i>×1</i></span>
        <span class="kl-score" data-score aria-live="polite">0</span>
        ${timed ? '<span class="kl-timer" data-timer role="timer" aria-label="Осталось секунд"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.5" class="kl-tr-bg"/><circle cx="18" cy="18" r="15.5" class="kl-tr" data-tr/></svg><b data-tsec>60</b></span>' : `<span class="kl-prog" data-prog>1/${total}</span>`}
      </div>
      ${timed ? '' : `<div class="kl-pbar"><i data-pbar></i></div>`}
      <div class="kl-play">
        <div class="kl-cbox"><div data-clock></div>
          <div class="kl-ctools"><button type="button" class="kl-tool" data-digital aria-pressed="${!!s.digital}" title="Показать время цифрами">🔢 Цифры</button><button type="button" class="kl-tool" data-zones aria-pressed="false" title="Цветные зоны: over · på halv · over halv · på">🎨 Зоны</button></div>
          <div data-legend></div>
        </div>
        <div class="kl-tbox"><div class="kl-task" data-task></div><div class="kl-ans" data-ans></div><div class="kl-fb" data-fb aria-live="polite"></div></div>
      </div>
    </div>`;
    const $ = sel => ctx.body.querySelector(sel);
    const clock = ctx.clock($('[data-clock]'), { label: mode === 'show' || mode === 'listen' ? 'Поставьте время' : 'Часы' });
    clock.digital(!!s.digital);
    const running = () => G.i >= 0 && !G.over;
    const game = ctx.game = {
      running,
      /** stop: save=true — the points of an unfinished game are kept (window closed / back) */
      stop(saveIt) {
        if (G.over) return;
        G.over = true; clearInterval(G.timer); clearTimeout(G.next);
        if (G.rec && G.rec.stop) try { G.rec.stop(); } catch (e) { /* ignore */ }
        if (saveIt && G.n) record();
      },
      G,
    };
    function record() {
      const k = bestKey(mode, level, timed), was = s.best[k] || 0;
      s.total += G.score; s.played = (s.played || 0) + 1;
      const rec = !replay && G.score > was;
      if (rec) s.best[k] = G.score;
      let stars = 0;
      if (!replay && !timed && G.n === total) { stars = starsFor(G.ok, G.n); if (stars > (s.stars[level] || 0)) s.stars[level] = stars; }
      if (!replay && timed) { stars = G.ok >= 15 ? 3 : G.ok >= 10 ? 2 : G.ok >= 6 ? 1 : 0; if (stars > (s.stars[level] || 0)) s.stars[level] = stars; }
      save();
      return { rec, was, stars };
    }
    const hud = () => {
      $('[data-score]').textContent = G.score;
      const st2 = $('[data-streak]'); st2.querySelector('b').textContent = G.streak; st2.querySelector('i').textContent = '×' + mult(G.streak);
      st2.classList.toggle('hot', G.streak >= 3);
      if (!timed) { $('[data-prog]').textContent = `${Math.min(G.i + 1, total)}/${total}`; $('[data-pbar]').style.width = (G.n / total * 100) + '%'; }
    };
    const legend = $('[data-legend]');
    const setZones = on => { clock.zones(on); legend.innerHTML = on ? legendHtml() : ''; $('[data-zones]').setAttribute('aria-pressed', String(on)); };
    function next() {
      clearTimeout(G.next);
      if (G.over) return;
      if (!timed && G.i + 1 >= total) return finish();
      G.i++; G.q = timed ? makeQ(level) : queue[G.i];
      if (timed && G.prev && qKey(G.prev) === qKey(G.q)) G.q = makeQ(level);
      G.prev = G.q; G.answered = false;
      hud();
      clock.ghost(null); clock.flash(null);
      $('[data-fb]').innerHTML = '';
      const q = G.q, txt = qText(q);
      const badge = q.kind === 'part' ? `<span class="kl-part">${partOf(q.t).ico} ${partOf(q.t).name}</span>` : q.kind === 'formal' ? `<span class="kl-sign" lang="nb">${written(q.t)}</span>` : '';
      if (mode === 'show' || mode === 'listen') {
        clock.h24(null);
        clock.set(mod(q.t, 720) === 0 ? 360 : 0, { animate: G.i > 0, ms: 350 });
        clock.setInteractive(true);
        $('[data-task]').innerHTML = mode === 'show'
          ? `<div class="kl-ask">Поставьте стрелки:</div><div class="kl-phrase" lang="nb">Klokka er <b>${esc(txt)}</b></div><div class="row kl-say-row">${sayBtn(qSpeak(q), 'lg', 'Послушать')}</div>`
          : `<div class="kl-ask">Послушайте и поставьте стрелки:</div><div class="kl-listen"><button type="button" class="kl-big-say" data-replay-say aria-label="Послушать ещё раз">${SPK}</button><button type="button" class="btn sm ghost" data-slow>🐢 Медленнее</button></div>`;
        $('[data-ans]').innerHTML = `<button type="button" class="btn primary lg kl-check-btn" data-check>✓ Проверить</button><div class="tiny muted kl-hint">Тяните стрелки пальцем или мышью · клавиатура: ← → минуты, PageUp/PageDown — часы · Enter — проверить</div>`;
        say(qSpeak(q));
        setTimeout(() => { if (G.q === q && !G.answered) clock.focus(); }, 60);
      } else if (mode === 'which') {
        clock.setInteractive(false);
        clock.h24(q.kind === 'formal' ? q.t : null);
        clock.animateTo(q.t, G.i ? 600 : 0);
        G.opts = options(q);
        $('[data-task]').innerHTML = `<div class="kl-ask">${q.kind === 'formal' ? 'Как это прочитать официально?' : 'Который час? Выберите фразу.'}</div>${badge}`;
        $('[data-ans]').innerHTML = `<div class="kl-opts">${G.opts.options.map((t, i) => `<button type="button" class="kl-opt" data-opt="${i}" lang="nb"><kbd>${i + 1}</kbd>${esc(t)}</button>`).join('')}</div>`;
      } else { // say
        clock.setInteractive(false);
        clock.h24(q.kind === 'formal' ? q.t : null);
        clock.animateTo(q.t, G.i ? 600 : 0);
        $('[data-task]').innerHTML = `<div class="kl-ask">${q.kind === 'formal' ? 'Прочитайте официально, по 24 часам:' : 'Скажите по-норвежски, который час:'}</div>${badge}`;
        $('[data-ans]').innerHTML = `<div data-rec></div><div class="kl-heard" data-heard></div><div class="row kl-say-skip"><button type="button" class="btn sm ghost" data-skip>Не знаю — показать ответ</button></div>`;
        G.rec = Speech.recorder($('[data-rec]'), { maxMs: 6000, onText: text => { if (G.q === q && !G.answered) judgeSaid(text); } });
      }
    }
    function judgeSaid(text) {
      const p = parse(text), q = G.q;
      $('[data-heard]').innerHTML = `Услышано: «<b lang="nb">${esc(text || '…')}</b>»${p ? ` → ${p.t24 != null && q.kind !== 'colloq' ? digits(p.t24) : hm12(p.t12)}` : ''}`;
      if (!p) { $('[data-heard]').innerHTML += '<br><span class="small muted">Не похоже на время — попробуйте ещё раз, например: «Klokka er halv fire».</span>'; return; }
      const right = sameFace(q, p.t12) && (q.kind === 'colloq' || p.t24 == null || p.t24 === q.t);
      answer(right, q.kind === 'colloq' ? p.t12 : (p.t24 != null ? p.t24 : near(p.t12, q.t)));
    }
    function answer(right, given, optIndex) {
      if (G.answered || G.over) return;
      G.answered = true; G.n++;
      const q = G.q;
      clock.setInteractive(false);
      let gain = 0;
      if (right) {
        G.streak++; G.bestStreak = Math.max(G.bestStreak, G.streak); G.ok++;
        gain = basePts(level) * mult(G.streak); G.score += gain;
        if (replay) dropMistake(q);
        clock.flash('ok');
      } else {
        G.streak = 0; G.wrong.push(q); addMistake(q, mode);
        clock.flash('bad');
        if (mode === 'show' || mode === 'listen') { clock.ghost(given); clock.animateTo(q.t, 900); }
      }
      save();
      hud();
      if (gain) popPoints(gain);
      if (mode === 'which') ctx.body.querySelectorAll('[data-opt]').forEach((b, j) => { b.disabled = true; b.classList.toggle('ok', j === G.opts.correct); b.classList.toggle('bad', j === optIndex && !right); });
      if (mode === 'listen') $('[data-task]').innerHTML += `<div class="kl-phrase reveal" lang="nb">Klokka er <b>${esc(qText(q))}</b></div>`;
      const ck = $('[data-check]'); if (ck) ck.remove();
      const sk = $('[data-skip]'); if (sk) sk.parentElement.remove();
      const shownT = q.kind === 'colloq' ? hm12(q.t) : digits(q.t);
      $('[data-fb]').innerHTML = right
        ? `<div class="kl-fb-ok"><b>✓ Верно!</b> +${gain}${mult(G.streak) > 1 ? ` <span class="kl-x">×${mult(G.streak)}</span>` : ''} · ${shownT} — <b lang="nb">${esc(qText(q))}</b> ${sayBtn(qSpeak(q))}</div>${timed ? '' : nextBtn()}`
        : `<div class="kl-fb-bad"><b>✗ Не так.</b> ${explain(q, given, { face: mode === 'show' || mode === 'listen', verb: mode === 'which' ? 'выбрали' : mode === 'say' ? 'сказали' : 'поставили' }).map(x => `<p>${x}</p>`).join('')} ${sayBtn(qSpeak(q), '', 'Послушать')}</div>${nextBtn()}`;
      if (mode !== 'show') say(qSpeak(q)); else if (!right) say(qSpeak(q));
      const nb = $('[data-next]'); if (nb) setTimeout(() => { if (nb.isConnected) nb.focus({ preventScroll: true }); }, 30);
      if (timed) G.next = setTimeout(next, right ? 650 : 2600);
    }
    const nextBtn = () => `<button type="button" class="btn primary kl-next" data-next>${!timed && G.i + 1 >= total ? 'Итоги ›' : 'Дальше ›'}</button>`;
    function popPoints(n) {
      if (reduce()) return;
      const el = document.createElement('span'); el.className = 'kl-pop'; el.textContent = '+' + n;
      $('[data-score]').appendChild(el); setTimeout(() => el.remove(), 900);
    }
    function finish() {
      if (G.over) return;
      game.stop(false);
      const r = G.n ? record() : { rec: false, was: 0, stars: 0 };
      ctx.game = null;
      const k = bestKey(mode, level, timed), best = s.best[k] || 0;
      const uniq = []; const seen = new Set(); G.wrong.forEach(q => { const kk = qKey(q); if (!seen.has(kk)) { seen.add(kk); uniq.push(q); } });
      ctx.body.innerHTML = `<div class="kl-results ${reduce() ? '' : 'anim'}">
        <div class="kl-res-ico" aria-hidden="true">${r.rec && G.score ? '🏆' : G.ok === G.n && G.n ? '🎉' : '🕐'}</div>
        <h3>${r.rec && G.score ? 'Новый рекорд!' : G.n ? 'Игра окончена' : 'Время вышло'}</h3>
        <div class="kl-res-score"><b data-final>${G.score}</b><span>очков</span></div>
        ${replay ? '' : starsHtml(r.stars)}
        <div class="kl-res-stats">
          <span>✓ <b>${G.ok}</b> из ${G.n}</span><span>🔥 лучшая серия <b>${G.bestStreak}</b></span>
          ${replay ? `<span>🔁 осталось ошибок: <b>${st().mistakes.length}</b></span>` : `<span>🏅 рекорд: <b>${best}</b></span>`}
        </div>
        ${uniq.length ? `<div class="kl-res-wrong"><div class="kl-sec-title">Ошибки — послушайте ещё раз</div>${uniq.map(q => `<div class="kl-ph">${sayBtn(qSpeak(q))}<span><b lang="nb">${esc(qText(q))}</b><small>${q.kind === 'colloq' ? hm12(q.t) + ' — ' + esc(ru(q.t)) : digits(q.t)}</small></span></div>`).join('')}</div>` : ''}
        <div class="kl-res-btns">
          <button type="button" class="btn primary" data-again>▶ Ещё раз</button>
          ${st().mistakes.length ? `<button type="button" class="btn" data-replay>🔁 Повторить ошибки (${st().mistakes.length})</button>` : ''}
          ${uniq.length ? '<button type="button" class="btn ghost" data-cards>📇 Ошибки → карточки</button>' : ''}
          <button type="button" class="btn ghost" data-back>‹ Игры</button>
        </div></div>`;
      if (r.rec && G.score && !reduce() && UI.confetti) { try { UI.confetti(120); } catch (e) { /* ignore */ } }
      ctx.keys = e => { if (e.key === 'Enter' && !(e.target && e.target.closest && e.target.closest('button'))) { e.preventDefault(); ctx.go('game', o); } };
      ctx.body.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.hasAttribute('data-again')) ctx.go('game', Object.assign({}, o, { replay: replay && st().mistakes.length > 0 }));
        else if (b.hasAttribute('data-replay')) ctx.go('game', { mode, level, timed: false, replay: true });
        else if (b.hasAttribute('data-cards')) mistakesToCards(ctx, uniq);
        else if (b.hasAttribute('data-back')) ctx.go('hub');
      };
    }
    const check = () => { if (G.answered || G.over || (mode !== 'show' && mode !== 'listen')) return; answer(sameFace(G.q, clock.value), clock.value); };
    ctx.body.onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-back')) {
        if (running() && G.n) {
          const r = await UI.askClose({ title: 'Закончить игру?', line: 'Очки сохранятся.', actions: [{ label: 'Закончить', value: 'end', cls: 'primary' }], cancel: 'Продолжить' });
          if (r !== 'end') return;
          game.stop(true);
        }
        ctx.go('hub'); return;
      }
      if (b.hasAttribute('data-check')) return check();
      if (b.hasAttribute('data-next')) return next();
      if (b.dataset.opt != null) return answer(+b.dataset.opt === G.opts.correct, G.opts.times[+b.dataset.opt], +b.dataset.opt);
      if (b.hasAttribute('data-replay-say')) return say(qSpeak(G.q));
      if (b.hasAttribute('data-slow')) return say(qSpeak(G.q), { rate: 0.6 });
      if (b.hasAttribute('data-skip')) return answer(false, G.q.kind === 'colloq' ? mod(G.q.t + 360, 720) : mod(G.q.t + 720, 1440));
      if (b.hasAttribute('data-digital')) { s.digital = !s.digital; save(); clock.digital(s.digital); b.setAttribute('aria-pressed', String(s.digital)); return; }
      if (b.hasAttribute('data-zones')) { setZones(b.getAttribute('aria-pressed') !== 'true'); }
    };
    ctx.keys = e => {
      if (G.over) return;
      const inClock = e.target && e.target.closest && e.target.closest('.kl-svg');
      if (e.key === 'Enter') {
        if (e.target && e.target.closest && e.target.closest('button') && !inClock) return; // the focused button does it
        e.preventDefault();
        if (G.answered) next(); else check();
      } else if (mode === 'which' && !G.answered && /^[1-4]$/.test(e.key)) {
        e.preventDefault(); const i = +e.key - 1; if (G.opts && i < G.opts.options.length) answer(i === G.opts.correct, G.opts.times[i], i);
      }
    };
    if (timed) {
      G.deadline = Date.now() + TIMED_MS;
      const ring = $('[data-tr]'), C = 2 * Math.PI * 15.5;
      ring.style.strokeDasharray = C;
      const tick = () => {
        if (G.over) return clearInterval(G.timer);
        const left = Math.max(0, G.deadline - Date.now());
        $('[data-tsec]').textContent = Math.ceil(left / 1000);
        ring.style.strokeDashoffset = C * (1 - left / TIMED_MS);
        $('[data-timer]').classList.toggle('low', left < 10000);
        if (left <= 0) { clearInterval(G.timer); finish(); }
      };
      G.timer = setInterval(tick, 200); tick();
    }
    next();
  };

  /* ---------- 📇 mistakes → cards ---------- */
  const DECK = '🕐 Klokka';
  function mistakesToCards(ctx, list) {
    const qs = (list && list.length ? list : st().mistakes).map(x => ({ t: x.t, kind: x.kind }));
    if (!qs.length || !root.Store) { UI.toast('Ошибок пока нет', 'warn'); return; }
    const deck = Store.decks().find(d => d.name === DECK) || Store.addDeck(DECK, 'Время по-норвежски: фразы, в которых были ошибки (раздел 🕐 Klokka)');
    const have = new Set(Store.cards(deck.id).map(c => String(c.no).trim().toLowerCase()));
    let made = 0;
    qs.forEach(q => {
      const no = qText(q); if (have.has(no.toLowerCase())) return; have.add(no.toLowerCase());
      const ruTxt = q.kind === 'colloq' ? `${hm12(q.t)} — ${ru(q.t)}` : q.kind === 'part' ? `${digits(q.t)} — ${ru(q.t)} ${partOf(q.t).ru}` : `${digits(q.t)} (официально, 24 часа)`;
      Store.addCard(deck.id, { no, ru: ruTxt, example: `Klokka er ${no}.`, exampleRu: `Сейчас ${q.kind === 'formal' ? digits(q.t) : ru(q.t)}.`,
        description: q.kind === 'formal' ? 'Официальное время: сначала час (0–23), потом минуты.' : `Дословно: «${literal(q.t)}».${/\bhalv\b/.test(colloq(q.t)) ? ' halv + СЛЕДУЮЩИЙ час: halv fire = 3:30.' : ''}`,
        tags: ['klokka'] });
      made++;
    });
    if (ctx) ctx.cardsAdded = (ctx.cardsAdded || 0) + made;
    UI.toast(made ? `Добавлено ${root.U && U.cards ? U.cards(made) : made + ' карточек'} в колоду «${DECK}»` : `Эти фразы уже есть в колоде «${DECK}»`, made ? 'good' : '', 4500);
  }

  /* ---------- entry points: <… data-klokka-open>, the sidebar item ---------- */
  document.addEventListener('click', async e => {
    const b = e.target.closest && e.target.closest('[data-klokka-open], .sidebar [data-sb="klokka"]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    // opened from another window (Упражнения, «Что вы хотите выучить?»): that one closes first
    const bd = b.closest('.modal-backdrop');
    if (bd && bd._m && !bd.querySelector('.klokka-modal')) { if (!(await bd._m.tryClose())) return; }
    Klokka.open();
  }, true);

  const Klokka = { open, Clock, T, LESSON, MODES, LEVELS, legendHtml, state: st, canSay, _reset() { S = null; } };
  root.Klokka = Klokka;
})(typeof window !== 'undefined' ? window : globalThis);
