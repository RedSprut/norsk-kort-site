/* ============ 🎨 «Художественный вид» — Pinterest-like art cards ============
 * Own code (no libraries, every picture / ornament is drawn here as SVG or CSS — no copyrighted images).
 *
 *  • Deck «Галерея»: masonry columns of art cards (picture full-bleed, the Norwegian word big, translation, en/ei/et chip),
 *    lazy pages + gentle appear-on-scroll, hover tilt / glow on desktop. A tap → the big card with a flip.
 *  • Study in art style (js/study.js calls ArtCards.decorateStudy): front = picture + word, flip → translation (ru / uk / both).
 *  • «i» on every card → a sheet with everything else: explanation, examples, word forms, who translated, history, ✎ editor.
 *  • Gender colours (Okabe–Ito based, colour-blind safe, always with the article written too): en · ei · et · plural.
 *  • Look: templates (Фьорд, Северное сияние, Минимализм, Ночь, Акварель, Ретро-плакат, Розмалинг + seasonal ones),
 *    fonts (self-hosted OFL woff2 in fonts/, loaded only when the art mode is shown), weight / italic / size / spacing /
 *    width, text + accent colour, outline / shadow, unified colour grading — with a live preview and «↺ Сбросить».
 *  • Share a card as a picture (canvas → PNG, stories 9:16 or square) through the phone's share sheet or a download.
 *  • 📌 Pinterest: search opens in a new tab (Pinterest has no open search API, and it is never scraped) — the picture
 *    comes back by paste / drop / link / file.
 *  • Reduced motion: respected (crossfade instead of 3D, no tilt), with a one-time kind notice and an in-app override.
 * Settings: Store.settings.artMode (global default) · deck.art ('on' | 'off') · Store.settings.art (look, see Store.Safe.art).
 */
(function () {
  'use strict';
  const esc = s => U.esc(s);
  const enc = encodeURIComponent;
  const FONT_CSS = 'fonts/art-fonts.css?v=2';
  const LIB_PIN = q => `https://www.pinterest.com/search/pins/?q=${enc(q)}`;

  /* ---------- fonts (SIL OFL 1.1, self-hosted: fonts/<name>/, licence in each folder) ---------- */
  const FONTS = [
    { id: 'theme', name: 'Как в шаблоне', note: '' },
    { id: 'system', name: 'Системный', note: 'как в приложении', css: 'var(--font)', canvas: 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif' },
    { id: 'playfair', name: 'Playfair Display', note: 'элегантный', css: "'Playfair Display', Georgia, serif", max: 900 },
    { id: 'lora', name: 'Lora', note: 'книжный', css: "'Lora', Georgia, serif", max: 700 },
    { id: 'montserrat', name: 'Montserrat', note: 'современный', css: "'Montserrat', system-ui, sans-serif", max: 900 },
    { id: 'nunito', name: 'Nunito', note: 'мягкий', css: "'Nunito', system-ui, sans-serif", max: 1000 },
    { id: 'comfortaa', name: 'Comfortaa', note: 'округлый', css: "'Comfortaa', system-ui, sans-serif", max: 700 },
    { id: 'oswald', name: 'Oswald', note: 'плакатный', css: "'Oswald', 'Arial Narrow', sans-serif", max: 700 },
    { id: 'unbounded', name: 'Unbounded', note: 'широкий', css: "'Unbounded', system-ui, sans-serif", max: 900 },
    { id: 'caveat', name: 'Caveat', note: 'рукописный', css: "'Caveat', 'Comic Sans MS', cursive", max: 700 },
    { id: 'pacifico', name: 'Pacifico', note: 'кисточка', css: "'Pacifico', cursive", max: 400 },
    { id: 'marck', name: 'Marck Script', note: 'гусиное перо', css: "'Marck Script', 'Segoe Script', cursive", max: 400 },
    { id: 'oldstd', name: 'Old Standard', note: 'старая газета', css: "'Old Standard TT', Georgia, 'Times New Roman', serif", max: 700 },
    { id: 'gotisk', name: 'Готический', note: 'Grenze Gotisch + Monomakh', css: "'NK Gotisk', 'Old English Text MT', Georgia, serif", max: 900 },
    { id: 'mplus', name: 'M PLUS Rounded', note: 'округлый, игривый', css: "'M PLUS Rounded 1c', 'Nunito', system-ui, sans-serif", max: 800 },
  ];
  const fontById = id => FONTS.find(f => f.id === id) || FONTS[2];

  /* ---------- gender colours: Okabe–Ito palette (safe for colour blindness), brightened for dark pictures ---------- */
  const GENDER = {
    m: { art: 'en', name: 'мужской род', color: '#56b4e9' },
    f: { art: 'ei', name: 'женский род', color: '#e58fc0' },
    n: { art: 'et', name: 'средний род', color: '#2bc48a' },
    mf: { art: 'en/ei', name: 'мужской или женский', color: '#a99cf0' },
    pl: { art: 'pl.', name: 'множественное число', color: '#f0a92e' },
  };

  /* ---------- templates ---------- */
  const T = (o) => Object.assign({ layout: 'scrim', scrim: '6,10,24', ink: '#ffffff', font: 'playfair', grade: 'none', tint: '#000000', orn: '' }, o);
  const THEMES = {
    fjord: T({ name: 'Фьорд', icon: '🏔', bg: ['#0b2a3f', '#14506b', '#0a1f33'], mt: ['#3a6f8c', '#1f4b66', '#0e2a40'], accent: '#7fdcff', scrim: '6,18,32', grade: 'saturate(1.08) contrast(1.04) brightness(.97)', tint: '#1d6fa3', water: true }),
    aurora: T({ name: 'Северное сияние', icon: '🌌', bg: ['#06101f', '#0f2a3a', '#1b1240'], mt: ['#22305a', '#151e3c', '#0a1026'], accent: '#3dffb4', ink: '#f2fffa', scrim: '4,10,24', font: 'montserrat', grade: 'saturate(1.15) contrast(1.06) brightness(.92) hue-rotate(-6deg)', tint: '#2affb0', aurora: true, stars: true }),
    minimal: T({ name: 'Скандинавский минимализм', icon: '🤍', layout: 'paper', paper: '#f7f4ef', bg: ['#ece7df', '#ddd6cb', '#cfc6b8'], mt: ['#d2cabe', '#bdb4a7', '#a79e91'], accent: '#c4553a', ink: '#1f2329', scrim: '20,20,20', font: 'nunito', grade: 'saturate(.85) contrast(.98) brightness(1.03)', tint: '#d8cfc2' }),
    night: T({ name: 'Ночь', icon: '🌙', bg: ['#05060f', '#121433', '#1f1a46'], mt: ['#20234a', '#13152e', '#080918'], accent: '#ffd75e', ink: '#f4f1ff', scrim: '3,4,14', font: 'lora', grade: 'saturate(.9) brightness(.84) contrast(1.08) hue-rotate(8deg)', tint: '#2a2a7a', stars: true, moon: true, orn: 'star' }),
    akvarell: T({ name: 'Акварель', icon: '🖌', layout: 'paper', paper: '#fbf8f2', bg: ['#cfe3f2', '#f3d9e4', '#fdf0d5'], mt: ['#bcd5e8', '#a3c3db', '#8aaecb'], accent: '#4f7fc4', ink: '#26324a', font: 'caveat', grade: 'saturate(.9) contrast(.95) brightness(1.05)', tint: '#f6d6e2', blobs: true }),
    retro: T({ name: 'Ретро-плакат', icon: '📯', layout: 'paper', paper: '#f1e4c8', bg: ['#f6b042', '#e8673c', '#2b3a67'], mt: ['#e8673c', '#c2452d', '#2b3a67'], accent: '#d6452f', ink: '#1f2a44', font: 'oswald', upper: true, grade: 'sepia(.25) saturate(1.1) contrast(1.08)', tint: '#f0a35b', orn: 'burst', burst: true }),
    rosemaling: T({ name: 'Розмалинг', icon: '🌷', bg: ['#1d3557', '#24406b', '#14243f'], mt: ['#2e4f7d', '#22406a', '#173052'], accent: '#e8b04b', ink: '#fff8ec', scrim: '16,24,44', grade: 'saturate(1.05) contrast(1.05) sepia(.08)', tint: '#c0392b', orn: 'rose', frame: true }),
    // story styles (design editor): own CSS / SVG decoration, fonts in fonts/ (OFL)
    pergament: T({ name: 'Старый пергамент', icon: '📜', layout: 'paper', paper: '#efe0bd', bg: ['#e8d3a4', '#cfae74', '#8c6a3c'], mt: ['#c2a571', '#a68655', '#7f6338'], accent: '#8a2f1c', ink: '#3a2412', scrim: '58,36,18', font: 'marck', grade: 'sepia(.5) saturate(.75) contrast(1.06) brightness(.97)', tint: '#c9a46a', orn: 'flourish', orn1: true, deco: 'parchment' }),
    avis: T({ name: 'Старая газета', icon: '📰', layout: 'paper', paper: '#ece3cb', bg: ['#e9e1cb', '#d6cbb0', '#b9ac8d'], mt: ['#a59a82', '#8a806b', '#6c6453'], accent: '#7a1f1f', ink: '#1c1a16', scrim: '28,26,22', font: 'oldstd', wmax: 700, grade: 'grayscale(1) contrast(1.2) brightness(1.03) sepia(.15)', tint: '#d9cca6', deco: 'news' }),
    skattekart: T({ name: 'Карта сокровищ', icon: '🗺', layout: 'paper', paper: '#ead2a0', bg: ['#e9d29f', '#d4b278', '#a9834a'], mt: ['#b99a63', '#9c7c48', '#7a5c30'], accent: '#b3261e', ink: '#3a2414', scrim: '60,38,16', font: 'oldstd', italic: true, wmax: 400, grade: 'sepia(.35) saturate(.85) contrast(1.04)', tint: '#d9b779', orn: 'compass', orn1: true, deco: 'map', water: true }),
    barbie: T({ name: 'Барби', icon: '💖', bg: ['#ff8cc6', '#ff4fa3', '#e0218a'], mt: ['#ffb3da', '#ff7ab8', '#e0218a'], accent: '#fff0f8', ink: '#ffffff', scrim: '196,18,112', font: 'mplus', grade: 'saturate(1.18) brightness(1.06) hue-rotate(-8deg) contrast(1.02)', tint: '#ff4fa3', orn: 'sparkle', stars: true }),
    vampyr: T({ name: 'Вампирский', icon: '🦇', bg: ['#07010a', '#2a0610', '#4a0a16'], mt: ['#2a0a14', '#18050c', '#0a0206'], accent: '#ff3b4e', ink: '#f5ece6', scrim: '16,2,6', font: 'gotisk', grade: 'saturate(.7) contrast(1.18) brightness(.82) hue-rotate(-10deg)', tint: '#8a0018', moon: true, stars: true, orn: 'moonbat', strip: 'drips' }),
    // seasonal
    halloween: T({ season: 1, name: 'Хэллоуин', icon: '🎃', when: '20 окт. – 1 нояб.', bg: ['#12071c', '#3a1450', '#e0641a'], mt: ['#2a1038', '#1c0a27', '#0d0514'], accent: '#ff8c1a', ink: '#fff4e6', scrim: '14,5,20', font: 'unbounded', grade: 'saturate(1.1) contrast(1.1) hue-rotate(-10deg) brightness(.9)', tint: '#ff6a00', moon: true, stars: true, orn: 'bat' }),
    jul: T({ season: 1, name: 'Jul · Новый год', icon: '🎄', when: '1 дек. – 6 янв.', bg: ['#0b2b22', '#0f3d2e', '#6e0f1d'], mt: ['#245a46', '#173f30', '#0b241c'], accent: '#ffd75e', ink: '#fffaf0', scrim: '8,20,14', font: 'lora', grade: 'saturate(1.05) contrast(1.05) brightness(.95)', tint: '#c81d2a', stars: true, snow: true, orn: 'flake' }),
    valentine: T({ season: 1, name: 'Valentinsdag', icon: '💗', when: '7 – 14 февр.', layout: 'paper', paper: '#fff0f3', bg: ['#ffc2d1', '#ff8fab', '#fb6f92'], mt: ['#ffb3c6', '#ff8fab', '#e5577b'], accent: '#d63462', ink: '#5c0f2a', font: 'pacifico', grade: 'saturate(1.05) brightness(1.03) hue-rotate(-6deg)', tint: '#ff8fab', orn: 'heart' }),
    paske: T({ season: 1, name: 'Påske · Пасха', icon: '🐣', when: 'за 12 дней до Пасхи', layout: 'paper', paper: '#fff7d1', bg: ['#ffe680', '#fff3b8', '#bfe3a8'], mt: ['#cfe6b8', '#a9d18e', '#86b86b'], accent: '#b07d00', ink: '#3b2f00', font: 'comfortaa', grade: 'saturate(1.08) brightness(1.04)', tint: '#ffd84d', orn: 'egg' }),
    mai17: T({ season: 1, name: '17. mai', icon: '🇳🇴', when: '8 – 17 мая', layout: 'paper', paper: '#ffffff', bg: ['#ba0c2f', '#ffffff', '#00205b'], mt: ['#3b5ba5', '#ba0c2f', '#00205b'], accent: '#ba0c2f', ink: '#00205b', font: 'montserrat', grade: 'saturate(1.12) contrast(1.05)', tint: '#ffffff', strip: 'bunting' }),
    sankthans: T({ season: 1, name: 'Sankthans · Иванов день', icon: '🔥', when: '16 – 24 июня', bg: ['#1b2a4a', '#d9653a', '#ffcf7a'], mt: ['#4a2f52', '#2a1e38', '#160f22'], accent: '#ffb347', ink: '#fff8ef', scrim: '26,14,24', grade: 'saturate(1.12) contrast(1.05) sepia(.12)', tint: '#ff8a3d', sun: true, orn: 'sun', water: true }),
    host: T({ season: 1, name: 'Осень · Høst', icon: '🍂', when: 'сентябрь – ноябрь', bg: ['#2a1a10', '#7a3b16', '#d98a2b'], mt: ['#6a3a1a', '#4a2a14', '#24150b'], accent: '#f4a340', ink: '#fff6ea', scrim: '28,14,6', font: 'lora', grade: 'saturate(1.1) sepia(.18) contrast(1.04)', tint: '#d9822b', orn: 'leaf' }),
    vinter: T({ season: 1, name: 'Зима · Vinter', icon: '❄️', when: 'январь – март', bg: ['#0d2440', '#3d6e99', '#bfe0f5'], mt: ['#e8f3fb', '#c9def0', '#9fbfdc'], accent: '#bfe6ff', ink: '#ffffff', scrim: '8,20,40', font: 'comfortaa', grade: 'saturate(.85) brightness(1.02) hue-rotate(6deg)', tint: '#9ccfff', snow: true, orn: 'flake' }),
  };
  const theme = id => THEMES[id] || THEMES.fjord;
  /** more templates from another file (e.g. js/artcards-no.js): never replaces a built-in one */
  function registerTemplate(id, def) {
    if (!/^[a-z0-9_-]{1,24}$/.test(String(id)) || !def || typeof def !== 'object' || (THEMES[id] && !THEMES[id].group)) return false;
    THEMES[id] = T(Object.assign({}, def));
    if (typeof scopeMemo !== 'undefined') scopeMemo.clear();
    return true;
  }
  const DEFAULT_LOOK = { theme: 'fjord', font: 'theme', weight: 800, italic: false, size: 100, track: 0, width: 100, text: '', accent: '', fx: 'shadow', grade: true };
  const PALETTE = ['#ffffff', '#fff3d6', '#1f2329', '#00205b', '#ba0c2f', '#7fdcff', '#3dffb4', '#ffd75e', '#ff8c1a', '#e58fc0', '#a99cf0', '#2bc48a'];

  /* ---------- seasons: suggested gently when the date approaches (a one-time hint per season and year) ---------- */
  function easter(y) { // anonymous Gregorian algorithm (Norway: western Easter)
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  }
  function seasonOf(date) {
    const d = date || new Date(), y = d.getFullYear(), md = (d.getMonth() + 1) * 100 + d.getDate();
    const inR = (a, b) => (a <= b ? md >= a && md <= b : md >= a || md <= b);
    const e = easter(y), day = 864e5, t = new Date(y, d.getMonth(), d.getDate()).getTime();
    if (inR(1020, 1101)) return 'halloween';
    if (inR(1201, 106)) return 'jul';
    if (inR(207, 214)) return 'valentine';
    if (t >= e.getTime() - 12 * day && t <= e.getTime() + day) return 'paske';
    if (inR(508, 517)) return 'mai17';
    if (inR(616, 624)) return 'sankthans';
    if (inR(901, 1130)) return 'host';
    if (inR(107, 310)) return 'vinter';
    return null;
  }

  /* ---------- small helpers ---------- */
  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return (s % 100000) / 100000; }; }
  const look = () => (Store.Safe && Store.Safe.art ? Store.Safe.art(Store.settings.art) : Object.assign({}, DEFAULT_LOOK, Store.settings.art || {}));
  const reduceSys = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const motionOk = () => !reduceSys() || Store.settings.artMotion === 'on';
  const goodImg = c => !!(c && c.image && !(window.Images && Images.isRemoteAI(c.image)));
  const firstLine = s => String(s || '').split('\n')[0].trim();
  function hexRgb(h) { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return [0, 0, 0]; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function lum(h) { return hexRgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0); }
  function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

  /** word parts: article chip + the bare word (en bil → «en» + «bil»), gender key for the colour */
  function parts(card) {
    const line = firstLine(card.no);
    let g = '';
    try { g = window.Gram ? Gram.cardGender(card) : ''; } catch (e) { g = ''; }
    const wc = String(card.wordClass || '') + ' ' + firstLine(card.description).slice(0, 60);
    if (!g && (/\b(flertall|plural|pl\.)\b|мн\.\s?ч|множеств/i.test(wc) || /^(pl|plural)$/i.test(String(card.gender || '')))) g = 'pl';
    let art = '', word = line;
    const m = /^(en|ei|et)(\s*\/\s*(en|ei|et))?\s+(.+)$/i.exec(line);
    if (m && (g || !/\s/.test(m[4]))) { art = m[1].toLowerCase() + (m[3] ? '/' + m[3].toLowerCase() : ''); word = m[4]; if (!g) g = { en: 'm', ei: 'f', et: 'n' }[m[1].toLowerCase()]; }
    else if (/^å\s+\S/i.test(line)) { art = 'å'; word = line.replace(/^å\s+/i, ''); }
    if (g === 'mf' && art === 'en') art = 'en/ei';
    if (g === 'pl' && !art) art = 'pl.';
    return { art, word, g, full: String(card.no || '') };
  }
  /** size class from the length of what is shown big */
  const lenCls = s => { const n = String(s || '').length; return n > 120 ? 'ac-len-xxl' : n > 48 ? 'ac-len-xl' : n > 22 ? 'ac-len-l' : n > 12 ? 'ac-len-m' : ''; };
  /** the translation in the chosen language (both → two lines; 🇺🇦 without Ukrainian → Russian with a small 🇷🇺) */
  function trParts(card) {
    const l = window.Study ? Study.trLang() : 'ru', ru = String(card.ru || '').trim(), uk = String(card.uk || '').trim();
    if (l === 'uk') return uk ? { main: uk, lang: 'uk' } : { main: ru, lang: 'ru', fb: !!ru };
    if (l === 'both' && uk && uk !== ru) return { main: ru, lang: 'ru', second: uk };
    return { main: ru, lang: 'ru' };
  }
  function trHtml(card, cls) {
    const t = trParts(card);
    return `<div class="${cls}" lang="${t.lang}">${t.fb ? '<span class="ac-fbflag" title="Украинского перевода пока нет — показан русский">🇷🇺</span> ' : ''}${esc(firstLine(t.main))}${t.second ? `<span class="ac-tr2" lang="uk"><span aria-label="Українською">🇺🇦</span> ${esc(firstLine(t.second))}</span>` : ''}</div>`;
  }
  const trText = card => { const t = trParts(card); return firstLine(t.main) + (t.second ? ' / ' + firstLine(t.second) : ''); };

  /* ---------- SVG: illustrated fallback scene (sky, aurora, stars, moon / sun, mountains, fjord) — never an empty card ---------- */
  function sceneSvg(seed, th, w = 300, h = 400) {
    // a template registered from outside (js/artcards-no.js) may bring its own picture
    if (typeof th.scene === 'function') { try { const own = th.scene(seed, w, h); if (own) return own; } catch (e) { /* our own picture below */ } }
    const r = rng(seed), id = 'acs' + (seed % 1e6);
    const bg = th.bg, mt = th.mt, out = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>`
      + `<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset=".55" stop-color="${bg[1]}"/><stop offset="1" stop-color="${bg[2]}"/></linearGradient>`
      + `<linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${th.accent}" stop-opacity="0"/><stop offset=".5" stop-color="${th.accent}" stop-opacity=".75"/><stop offset="1" stop-color="#a98bff" stop-opacity="0"/></linearGradient>`
      + `<radialGradient id="${id}g"><stop offset="0" stop-color="${th.accent}" stop-opacity=".55"/><stop offset="1" stop-color="${th.accent}" stop-opacity="0"/></radialGradient></defs>`
      + `<rect width="${w}" height="${h}" fill="url(#${id}s)"/>`);
    if (th.blobs) for (let i = 0; i < 4; i++) out.push(`<circle cx="${(r() * w).toFixed(0)}" cy="${(r() * h * 0.7).toFixed(0)}" r="${(60 + r() * 90).toFixed(0)}" fill="${[th.accent, '#f2a7c3', '#ffd59e', '#9fd8c8'][i]}" opacity=".22"/>`);
    if (th.burst) { const cx = w / 2, cy = h * 0.62; for (let i = 0; i < 18; i += 2) { const a1 = Math.PI + i * Math.PI / 18, a2 = Math.PI + (i + 1) * Math.PI / 18; out.push(`<path d="M${cx} ${cy}L${(cx + Math.cos(a1) * w).toFixed(1)} ${(cy + Math.sin(a1) * w).toFixed(1)}L${(cx + Math.cos(a2) * w).toFixed(1)} ${(cy + Math.sin(a2) * w).toFixed(1)}Z" fill="#fff" opacity=".16"/>`); } out.push(`<circle cx="${cx}" cy="${cy}" r="${w * 0.2}" fill="${bg[0]}"/>`); }
    if (th.stars) for (let i = 0; i < 34; i++) out.push(`<circle cx="${(r() * w).toFixed(1)}" cy="${(r() * h * 0.55).toFixed(1)}" r="${(0.4 + r() * 1.3).toFixed(2)}" fill="#fff" opacity="${(0.3 + r() * 0.6).toFixed(2)}"/>`);
    if (th.aurora) for (let i = 0; i < 2; i++) { const y = h * (0.16 + i * 0.12 + r() * 0.06); out.push(`<path d="M-20 ${y.toFixed(0)} C ${w * 0.25} ${(y - 40 - r() * 40).toFixed(0)}, ${w * 0.6} ${(y + 50).toFixed(0)}, ${w + 20} ${(y - 30).toFixed(0)}" fill="none" stroke="url(#${id}a)" stroke-width="${30 + i * 16}" stroke-linecap="round" opacity="${0.5 - i * 0.15}"/>`); }
    if (th.moon) { const cx = w * (0.68 + r() * 0.16), cy = h * 0.16; out.push(`<circle cx="${cx.toFixed(0)}" cy="${cy}" r="70" fill="url(#${id}g)"/><circle cx="${cx.toFixed(0)}" cy="${cy}" r="20" fill="#fff6d8"/><circle cx="${(cx + 8).toFixed(0)}" cy="${cy - 5}" r="17" fill="${bg[0]}" opacity=".9"/>`); }
    if (th.sun) out.push(`<circle cx="${w * 0.5}" cy="${h * 0.5}" r="120" fill="url(#${id}g)"/><circle cx="${w * 0.5}" cy="${h * 0.5}" r="34" fill="#ffe2a3" opacity=".95"/>`);
    // three mountain ridges, each a little different for every card
    for (let L = 0; L < 3; L++) {
      const base = h * (0.5 + L * 0.1), n = 3 + Math.floor(r() * 3), pts = [`0,${h}`, `0,${(base + 20).toFixed(0)}`];
      for (let i = 0; i <= n; i++) {
        const x = (i + 0.5) / (n + 1) * w + (r() - 0.5) * 30, peak = base - (40 + r() * (90 - L * 20));
        pts.push(`${(x - 24 - r() * 20).toFixed(0)},${(base - r() * 20).toFixed(0)}`, `${x.toFixed(0)},${peak.toFixed(0)}`);
      }
      pts.push(`${w},${(base + 10).toFixed(0)}`, `${w},${h}`);
      out.push(`<polygon points="${pts.join(' ')}" fill="${mt[L]}"/>`);
      if (L === 0 && (th.snow || th.id === 'vinter')) out.push(`<polygon points="${pts.join(' ')}" fill="#fff" opacity=".18"/>`);
    }
    if (th.water) { out.push(`<rect y="${(h * 0.8).toFixed(0)}" width="${w}" height="${(h * 0.2).toFixed(0)}" fill="${mt[2]}"/>`); for (let i = 0; i < 6; i++) out.push(`<rect x="${(r() * w * 0.8).toFixed(0)}" y="${(h * (0.83 + i * 0.025)).toFixed(0)}" width="${(20 + r() * 60).toFixed(0)}" height="1.6" rx=".8" fill="${th.accent}" opacity=".28"/>`); }
    if (th.snow) for (let i = 0; i < 40; i++) out.push(`<circle cx="${(r() * w).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${(0.8 + r() * 1.8).toFixed(2)}" fill="#fff" opacity="${(0.35 + r() * 0.5).toFixed(2)}"/>`);
    out.push('</svg>');
    return out.join('');
  }

  /* ---------- SVG ornaments (corner, mirrored by CSS on the right) ---------- */
  function flake(x, y, s, c) {
    let p = '';
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3, ex = x + Math.cos(a) * s, ey = y + Math.sin(a) * s; p += `M${x} ${y}L${ex.toFixed(1)} ${ey.toFixed(1)}`; const bx = x + Math.cos(a) * s * 0.6, by = y + Math.sin(a) * s * 0.6; [a + 0.6, a - 0.6].forEach(b => { p += `M${bx.toFixed(1)} ${by.toFixed(1)}L${(bx + Math.cos(b) * s * 0.3).toFixed(1)} ${(by + Math.sin(b) * s * 0.3).toFixed(1)}`; }); }
    return `<path d="${p}" stroke="${c}" stroke-width="1.6" stroke-linecap="round" fill="none"/>`;
  }
  function ornSvg(th, ac) {
    if (typeof th.ornament === 'function') { try { return th.ornament(ac) || ''; } catch (e) { return ''; } }
    const A = ac || th.accent;
    const wrap = (inner, vb = '0 0 100 100') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${inner}</svg>`;
    switch (th.orn) {
      case 'rose': return wrap(`<g fill="none" stroke="${A}" stroke-width="2.6" stroke-linecap="round"><path d="M5 70C5 34 34 5 70 5"/><path d="M14 62C9 44 20 28 35 31c10 2 9 15 0 15-6 0-7-6-2-7"/><path d="M62 14C44 9 28 20 31 35"/><path d="M12 84c4-6 10-8 16-6M84 12c-6 4-8 10-6 16"/></g>`
        + `<path d="M21 21c-5-10 4-15 8-8 4-7 13-2 8 8-3 6-13 6-16 0z" fill="#c8323a"/><path d="M27 22c0-4 2-6 4-7" stroke="#ffd98a" stroke-width="1.4" fill="none"/>`
        + `<path d="M38 40c8-7 19-5 24 3-9 5-18 3-24-3zM40 38c-7 8-5 19 3 24 5-9 3-18-3-24z" fill="#3f8a5a"/>`
        + `<g fill="${A}"><circle cx="47" cy="17" r="2.4"/><circle cx="54" cy="23" r="1.8"/><circle cx="17" cy="47" r="2.4"/><circle cx="23" cy="54" r="1.8"/><circle cx="60" cy="9" r="1.4"/><circle cx="9" cy="60" r="1.4"/></g>`);
      case 'flake': return wrap(flake(22, 22, 14, '#fff') + flake(54, 14, 7, '#fff') + flake(12, 56, 8, '#fff') + `<circle cx="40" cy="38" r="1.6" fill="#fff"/><circle cx="70" cy="28" r="1.2" fill="#fff"/><circle cx="30" cy="72" r="1.2" fill="#fff"/>`);
      case 'bat': { const bat = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 0c3-3 6-3 8 0 1-2 2-3 3-3s2 1 3 3c2-3 5-3 8 0-3 0-5 2-6 5-1-1-3-1-5 0-2-1-4-1-5 0-1-3-3-5-6-5z" fill="#1a0b24" stroke="${A}" stroke-width=".5"/>`; return wrap(`<circle cx="26" cy="26" r="15" fill="#ffe7b0" opacity=".9"/>` + bat(30, 20, 1.6) + bat(56, 12, 1.1) + bat(10, 50, 1.2)); }
      case 'heart': { const h = (x, y, s, c, o) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 8C-6 3-9-1-7-4c2-3 6-2 7 1 1-3 5-4 7-1 2 3-1 7-7 12z" fill="${c}" opacity="${o}"/>`; return wrap(h(22, 20, 2.2, A, 1) + h(50, 12, 1.2, '#ff8fab', 0.9) + h(14, 50, 1.3, '#ffb3c6', 0.9) + h(44, 40, 0.8, A, 0.7)); }
      case 'leaf': { const lf = (x, y, rot, c, s) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0-12C8-7 9 2 0 12-9 2-8-7 0-12z" fill="${c}"/><path d="M0-10V12" stroke="#5a2a0a" stroke-width=".8"/></g>`; return wrap(lf(20, 22, -30, '#e8672a', 1.5) + lf(46, 14, 40, '#f4a340', 1.05) + lf(14, 50, 80, '#c0392b', 1.1) + lf(40, 40, 10, '#d9a12b', 0.75)); }
      case 'egg': { const eg = (x, y, rot, c, s) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><ellipse rx="9" ry="12" fill="${c}"/><path d="M-9 0l3-3 3 3 3-3 3 3 3-3 3 3" stroke="#fff" stroke-width="1.6" fill="none"/><circle cy="-6" r="1.5" fill="#fff"/></g>`; return wrap(eg(22, 24, -15, '#f2b705', 1.4) + eg(48, 14, 20, '#8fcf6e', 0.95) + eg(14, 52, 10, '#f28fb1', 1)); }
      case 'sun': { let p = ''; for (let i = 0; i < 9; i++) { const a = i * Math.PI / 16; p += `<path d="M0 0L${(Math.cos(a) * 70).toFixed(1)} ${(Math.sin(a) * 70).toFixed(1)}" stroke="${A}" stroke-width="2.4" opacity=".7"/>`; } return wrap(p + `<circle r="22" fill="${A}"/><circle r="30" fill="${A}" opacity=".3"/>`); }
      case 'star': { const st = (x, y, s, o) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0-6L1.5-1.5 6 0 1.5 1.5 0 6-1.5 1.5-6 0-1.5-1.5z" fill="${A}" opacity="${o}"/>`; return wrap(st(20, 20, 2, 1) + st(46, 12, 1, 0.8) + st(12, 44, 1.1, 0.8) + st(36, 34, 0.6, 0.7) + st(64, 24, 0.5, 0.6)); }
      case 'burst': { let p = ''; for (let i = 0; i < 10; i += 2) { const a1 = i * Math.PI / 20, a2 = (i + 1) * Math.PI / 20; p += `<path d="M0 0L${(Math.cos(a1) * 140).toFixed(1)} ${(Math.sin(a1) * 140).toFixed(1)}L${(Math.cos(a2) * 140).toFixed(1)} ${(Math.sin(a2) * 140).toFixed(1)}Z" fill="${A}" opacity=".85"/>`; } return wrap(p + `<circle r="16" fill="#1f2a44"/>`); }
      // 📜 a calligraphic flourish, a quill and a red wax seal
      case 'flourish': return wrap(`<g fill="none" stroke="#3a2412" stroke-width="1.6" stroke-linecap="round" opacity=".85"><path d="M6 46C6 22 22 6 46 6"/><path d="M12 60c-9-12-6-30 8-36 11-5 22 3 19 12-2 7-12 7-12 0"/><path d="M60 12c-12-9-30-6-36 8"/><path d="M34 70c7 4 16 3 22-4M70 34c4 7 3 16-4 22" opacity=".6"/></g>`
        + `<g transform="translate(62 4) rotate(38)"><path d="M0 0C11 9 15 28 8 48L4 48C2 30-2 13 0 0z" fill="#f6ecd4" stroke="#6b4a2a" stroke-width="1"/><path d="M1 5C5 17 6 31 6 47" stroke="#6b4a2a" stroke-width=".8" fill="none"/><path d="M3 15l-5 3M4 23l-5 3M5 31l-5 3M6 39l-5 3M3 15l7 2M4 23l7 2M5 31l7 2" stroke="#b9a07a" stroke-width=".7"/><path d="M5.6 48l.9 9" stroke="#1d120a" stroke-width="1.8" stroke-linecap="round"/></g>`
        + `<circle cx="76" cy="76" r="3.2" fill="#1d120a" opacity=".7"/><circle cx="82" cy="71" r="1.5" fill="#1d120a" opacity=".55"/><circle cx="71" cy="83" r="1" fill="#1d120a" opacity=".5"/>`
        + `<g transform="translate(25 25)"><path d="M0-14c5 0 7 3 10 2 2 3 4 6 3 10 3 2 1 6-1 8 0 4-4 6-7 7-3 3-8 2-11 1-4 0-7-3-8-6-3-3-3-7-1-10-1-4 2-7 5-8 3-3 6-4 10-4z" fill="#a3221a"/><circle r="8.6" fill="none" stroke="#6e130d" stroke-width="1.3"/><path d="M-4.5-3.5L0 4.5 4.5-3.5" stroke="#f0c2a8" stroke-width="1.7" fill="none" stroke-linejoin="round"/></g>`);
      // 🗺 a compass rose
      case 'compass': {
        const ray = (a, l, c) => { const r = a * Math.PI / 180, x = Math.sin(r), y = -Math.cos(r), px = Math.cos(r) * 3.4, py = Math.sin(r) * 3.4; return `<path d="M${(x * l).toFixed(1)} ${(y * l).toFixed(1)}L${px.toFixed(1)} ${py.toFixed(1)}L0 0L${(-px).toFixed(1)} ${(-py).toFixed(1)}Z" fill="${c}"/>`; };
        return wrap(`<g transform="translate(31 33)"><circle r="25" fill="#f3e3bb" opacity=".9" stroke="#5a3a1a" stroke-width="1.1"/><circle r="20" fill="none" stroke="#5a3a1a" stroke-width=".6" stroke-dasharray="1.6 1.6"/>`
          + [45, 135, 225, 315].map(a => ray(a, 14, '#8a6a3c')).join('') + ray(0, 23, '#b3261e') + ray(90, 23, '#3a2414') + ray(180, 23, '#3a2414') + ray(270, 23, '#3a2414')
          + `<circle r="2.2" fill="#f3e3bb" stroke="#3a2414" stroke-width=".8"/><text y="-27.5" text-anchor="middle" font-size="7.5" font-weight="700" font-family="Georgia, serif" fill="#3a2414">N</text></g>`);
      }
      // 💖 sparkles and a heart
      case 'sparkle': {
        const sp = (x, y, s, c, o) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0-10C1-3 3-1 10 0 3 1 1 3 0 10-1 3-3 1-10 0-3-1-1-3 0-10z" fill="${c}" opacity="${o}"/>`;
        const ht = (x, y, s, c) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 8C-6 3-9-1-7-4c2-3 6-2 7 1 1-3 5-4 7-1 2 3-1 7-7 12z" fill="${c}"/>`;
        return wrap(sp(22, 22, 1.7, '#ffffff', 1) + sp(50, 12, 0.8, '#ffd1ec', 0.95) + sp(12, 50, 0.9, '#ffffff', 0.9) + sp(40, 40, 0.5, '#ffffff', 0.85) + sp(66, 30, 0.45, '#fff0a8', 0.9) + ht(30, 60, 0.9, '#ffffff'));
      }
      // 🦇 a full moon with a bat
      case 'moonbat': return wrap(`<circle cx="36" cy="32" r="31" fill="#f6e8d0" opacity=".12"/><circle cx="36" cy="32" r="21" fill="#f3e3c6"/><circle cx="29" cy="26" r="4" fill="#e0caa4"/><circle cx="42" cy="38" r="3" fill="#e0caa4"/><circle cx="41" cy="24" r="1.8" fill="#e0caa4"/>`
        + `<path transform="translate(38 30) scale(1.7)" d="M0 0c3-3 6-3 8 0 1-2 2-3 3-3s2 1 3 3c2-3 5-3 8 0-3 0-5 2-6 5-1-1-3-1-5 0-2-1-4-1-5 0-1-3-3-5-6-5z" fill="#0a0206"/>`
        + `<path transform="translate(14 56) scale(.9)" d="M0 0c3-3 6-3 8 0 1-2 2-3 3-3s2 1 3 3c2-3 5-3 8 0-3 0-5 2-6 5-1-1-3-1-5 0-2-1-4-1-5 0-1-3-3-5-6-5z" fill="#0a0206" opacity=".85"/>`);
      default: return '';
    }
  }
  /** a strip along the top edge: 17. mai flags or 🦇 dripping blood */
  function stripSvg(th) {
    if (th.strip === 'bunting') return buntingSvg();
    if (th.strip === 'drips') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 30"><path d="M0 0H100V5C97 5 96 8 96 12 96 16 93 18 91 15 89 12 91 7 85 6 79 6 77 9 77 19 77 25 72 26 71 20 70 13 67 6 59 6 52 6 51 9 50 13 49 16 46 16 45 13 45 8 41 5 33 6 27 7 27 10 26 18 25 24 20 24 19 18 19 11 15 6 9 5 5 5 3 7 0 5Z" fill="#8a0012"/><path d="M0 0H100V2.4C80 3 60 2 40 3 20 4 10 2 0 3Z" fill="#b3001c" opacity=".8"/><ellipse cx="72.6" cy="21" rx=".9" ry="1.8" fill="#ff6b78" opacity=".55"/><ellipse cx="21" cy="19" rx=".8" ry="1.6" fill="#ff6b78" opacity=".55"/></svg>`;
    return '';
  }
  /** paper texture behind the whole card (parchment, treasure map) or the newspaper masthead / columns */
  function decoSvg(th, part) {
    const S = (vb, inner, par = 'xMidYMid slice') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="${par}">${inner}</svg>`;
    const noise = (op, f = '.9') => `<filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${f}" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .32  0 0 0 0 .2  0 0 0 0 .08  0 0 0 ${op} 0"/></filter>`;
    switch (th.deco) {
      case 'parchment': return S('0 0 300 400', `<defs>${noise(0.55)}<radialGradient id="v" r=".75"><stop offset=".55" stop-color="#7a4a1a" stop-opacity="0"/><stop offset="1" stop-color="#5a3010" stop-opacity=".55"/></radialGradient></defs>`
        + `<radialGradient id="s"><stop offset="0" stop-color="#a8773a" stop-opacity=".22"/><stop offset=".7" stop-color="#a8773a" stop-opacity=".08"/><stop offset="1" stop-color="#a8773a" stop-opacity="0"/></radialGradient>`
        + `<rect width="300" height="400" filter="url(#n)" opacity=".5"/><ellipse cx="70" cy="330" rx="60" ry="44" fill="url(#s)"/><ellipse cx="240" cy="296" rx="38" ry="30" fill="url(#s)"/><ellipse cx="250" cy="90" rx="50" ry="40" fill="url(#s)" opacity=".7"/>`
        + `<path d="M0 0H300V400H0Z" fill="none" stroke="#6b3f14" stroke-width="7" opacity=".18" stroke-dasharray="2 9 1 5 3 7"/><rect width="300" height="400" fill="url(#v)"/>`, 'none');
      case 'map': return S('0 0 300 400', `<defs>${noise(0.4, '.75')}<radialGradient id="v" r=".78"><stop offset=".6" stop-color="#6b4214" stop-opacity="0"/><stop offset="1" stop-color="#4a2a08" stop-opacity=".5"/></radialGradient></defs>`
        + `<rect width="300" height="400" filter="url(#n)" opacity=".45"/><g stroke="#5a3a1a" stroke-width=".5" opacity=".22">${[50, 100, 150, 200, 250].map(x => `<path d="M${x} 0V400"/>`).join('')}${[50, 100, 150, 200, 250, 300, 350].map(y => `<path d="M0 ${y}H300"/>`).join('')}</g>`
        + `<path d="M-10 300C30 280 40 320 80 310S130 270 160 290 210 330 250 300 300 280 320 290V420H-10Z" fill="#9cc2c0" opacity=".28"/><path d="M-10 300C30 280 40 320 80 310S130 270 160 290 210 330 250 300 300 280 320 290" fill="none" stroke="#5a3a1a" stroke-width="1.2" opacity=".55"/>`
        + `<path d="M30 250C70 230 90 270 130 262S190 240 214 286 238 330 252 350" fill="none" stroke="#7a2a12" stroke-width="2.4" stroke-dasharray="1 7" stroke-linecap="round" opacity=".85"/>`
        + `<g transform="translate(262 356)" stroke="#b3261e" stroke-width="5" stroke-linecap="round"><path d="M-10-10L10 10M10-10L-10 10"/></g><rect width="300" height="400" fill="url(#v)"/>`, 'none');
      case 'news': {
        if (part === 'head') return S('0 0 300 30', `<rect width="300" height="30" fill="#ece3cb"/><text x="150" y="19" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="15" letter-spacing="1.5" fill="#1c1a16">NORSK KORT</text>`
          + `<path d="M8 23.5H292M8 26H292" stroke="#1c1a16" stroke-width=".9"/><text x="10" y="9" font-family="Georgia, serif" font-size="5.2" fill="#3a352c">Nr. 17 · 1905</text><text x="290" y="9" text-anchor="end" font-family="Georgia, serif" font-size="5.2" fill="#3a352c">Pris 5 øre</text>`, 'xMidYMid meet');
        let cols = '';
        [[10, 92], [104, 92], [198, 92]].forEach(([x, w]) => { for (let i = 0; i < 6; i++) cols += `<rect x="${x}" y="${6 + i * 7}" width="${i === 5 ? w * 0.55 : w}" height="2.6" rx="1" fill="#1c1a16" opacity=".16"/>`; });
        return S('0 0 300 50', `<path d="M8 1H292" stroke="#1c1a16" stroke-width=".7"/>${cols}<path d="M101 5V46M195 5V46" stroke="#1c1a16" stroke-width=".4" opacity=".4"/>`, 'xMidYMid meet');
      }
      default: return '';
    }
  }
  /** 17. mai: a garland of little Norwegian flags (repeats along the top) */
  function buntingSvg() {
    let p = '<path d="M0 6Q50 16 100 6" stroke="#00205b" stroke-width="1" fill="none"/>';
    [[8, 9], [34, 12.4], [60, 12.4], [86, 9]].forEach(([x, y], i) => {
      if (i % 2) p += `<path d="M${x - 7} ${y}L${x + 7} ${y}L${x} ${y + 15}Z" fill="${i === 1 ? '#ffffff' : '#00205b'}" stroke="#00205b" stroke-width=".5"/>`;
      else p += `<g transform="translate(${x - 8} ${y})"><rect width="16" height="11" fill="#ba0c2f"/><rect x="4.4" width="3.4" height="11" fill="#fff"/><rect y="3.8" width="16" height="3.4" fill="#fff"/><rect x="5.2" width="1.8" height="11" fill="#00205b"/><rect y="4.6" width="16" height="1.8" fill="#00205b"/></g>`;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 30">${p}</svg>`;
  }
  // single quotes: the value also goes into style="…" attributes (encodeURIComponent leaves no ' in it)
  const svgUrl = s => s ? `url('data:image/svg+xml,${enc(s).replace(/'/g, '%27')}')` : 'none';

  /* ---------- the look → CSS variables + classes on a scope element ---------- */
  const scopeMemo = new Map();
  function scope(lk) {
    lk = lk || look();
    const th = theme(lk.theme), themeFont = lk.font === 'theme', f = themeFont ? fontById(th.font) : fontById(lk.font);
    const ac = lk.accent || th.accent;
    const ink = lk.text || th.ink;
    const key = JSON.stringify(lk) + motionOk();
    if (scopeMemo.has(key)) return scopeMemo.get(key);
    const vars = {
      '--ac-on-accent': lum(ac) > 0.32 ? '#0b0d1d' : '#ffffff', '--ac-kicker': lum(ac) < 0.12 ? '#ffffff' : ac,
      '--ac-bg1': th.bg[0], '--ac-bg2': th.bg[1], '--ac-bg3': th.bg[2], '--ac-accent': ac, '--ac-ink': ink, '--ac-paper': th.paper || '#fff',
      '--ac-scrim': th.scrim, '--ac-font': f.css || 'var(--font)', '--ac-weight': Math.min(lk.weight, f.max || 900, themeFont && th.wmax ? th.wmax : 900),
      '--ac-style': lk.italic || (themeFont && th.italic) ? 'italic' : 'normal',
      '--ac-size': (lk.size / 100).toFixed(2), '--ac-track': (lk.track / 100).toFixed(2) + 'em', '--ac-sx': (lk.width / 100).toFixed(2),
      // never «none» here: the value is combined with other filters (none + blur() would be invalid)
      '--ac-grade': (lk.grade || th.forceGrade) && th.grade && th.grade !== 'none' ? th.grade : 'brightness(1)', '--ac-tint': lk.grade || th.forceGrade ? th.tint : 'transparent', '--ac-orn': svgUrl(ornSvg(th, ac)), '--ac-bunting': th.strip ? svgUrl(stripSvg(th)) : 'none',
      '--ac-deco': th.deco && th.deco !== 'news' ? svgUrl(decoSvg(th)) : 'none',
      '--ac-news-head': th.deco === 'news' ? svgUrl(decoSvg(th, 'head')) : 'none', '--ac-news-cols': th.deco === 'news' ? svgUrl(decoSvg(th, 'cols')) : 'none',
    };
    const style = Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';');
    const cls = `ac-scope ac-th-${lk.theme} ac-fx-${lk.fx} ac-lay-${th.layout}${th.upper ? ' ac-upper' : ''}${th.frame ? ' ac-framed' : ''}${th.orn ? ' ac-has-orn' : ''}${th.orn1 ? ' ac-orn1' : ''}${th.strip ? ' ac-has-strip' : ''}${th.deco && th.deco !== 'news' ? ' ac-has-deco' : ''}${th.deco ? ' ac-deco-' + th.deco : ''}${motionOk() ? '' : ' ac-still'}`;
    const out = { cls, style, vars, th, font: f, lk };
    if (scopeMemo.size > 60) scopeMemo.clear();
    scopeMemo.set(key, out);
    return out;
  }
  function applyScope(el, lk) {
    if (!el) return;
    const s = scope(lk);
    [...el.classList].filter(c => /^ac-(scope|th-|fx-|lay-|upper|framed|has-|still)/.test(c)).forEach(c => el.classList.remove(c));
    s.cls.split(' ').forEach(c => el.classList.add(c));
    Object.entries(s.vars).forEach(([k, v]) => el.style.setProperty(k, String(v)));
  }

  /* =====================================================================
   * 🎨 PER-CARD DESIGN (card.artDesign, sanitized by Store.Safe.artDesign): placement, rotation, size, backdrop,
   * photo effects and framing, and optionally its own template / font / colours on top of the common look.
   * Every rendered .ac-card carries its own look classes (ac-th-*, ac-lay-*, ac-fx-*…), so one card may differ
   * from the rest of the deck; the CSS variables are inherited from the surrounding scope unless the card overrides them.
   * ===================================================================== */
  const DZ0 = Object.freeze(Object.assign({ theme: '', font: '', text: '', accent: '', fx: '', size: 0, pos: false, x: 0, y: 100, rot: 0, trSep: false, tx: 50, ty: 10, bd: '',
    blur: 0, bright: 100, contrast: 100, sat: 100, vig: 0, grain: 0, sepia: 0, gray: 0, zoom: 100, ox: 50, oy: 50 }, (window.Store && Store.Safe && Store.Safe.artDesignDefaults) || {}));
  const STYLE_KEYS = ['theme', 'font', 'text', 'accent', 'fx', 'bd', 'blur', 'bright', 'contrast', 'sat', 'vig', 'grain', 'sepia', 'gray'];
  const PLACE_KEYS = ['pos', 'x', 'y', 'rot', 'size', 'trSep', 'tx', 'ty'];
  const dzSafe = z => (Store.Safe && Store.Safe.artDesign ? Store.Safe.artDesign(z) : (z || null));
  const dz = card => Object.assign({}, DZ0, (card && card.artDesign) || {});
  /** the look of one card: the common look + the card's own template / font / colours / outline / size */
  function cardLook(card, base) {
    base = base || look();
    const z = card && card.artDesign;
    if (!z) return base;
    const lk = Object.assign({}, base);
    if (z.theme && THEMES[z.theme] && z.theme !== base.theme) { lk.theme = z.theme; lk.font = 'theme'; lk.text = ''; lk.accent = ''; }
    if (z.font && (z.font === 'theme' || FONTS.some(f => f.id === z.font))) lk.font = z.font;
    if (z.text) lk.text = z.text;
    if (z.accent) lk.accent = z.accent;
    if (z.fx) lk.fx = z.fx;
    if (z.size) lk.size = z.size;
    return lk;
  }
  const zoomEff = z => z.zoom / 100 * (1 + z.blur * 0.012); // a blurred photo is enlarged a little: no soft see-through edges
  const alignOf = x => (x < 34 ? 0 : x > 66 ? 2 : 1);
  function dzVars(z) {
    const a = alignOf(z.x), a2 = alignOf(z.tx);
    const v = {
      '--ac-x': (z.x / 100).toFixed(3), '--ac-y': (z.y / 100).toFixed(3), '--ac-rot': z.rot + 'deg',
      '--ac-ta': ['left', 'center', 'right'][a], '--ac-ai': ['flex-start', 'center', 'flex-end'][a], '--ac-to': ['0 50%', '50% 50%', '100% 50%'][a],
      '--ac-x2': (z.tx / 100).toFixed(3), '--ac-y2': (z.ty / 100).toFixed(3), '--ac-ta2': ['left', 'center', 'right'][a2], '--ac-ai2': ['flex-start', 'center', 'flex-end'][a2],
      // blur in container units (cqi): the same look on a small tile and on the big card
      '--ac-pf': `blur(${(z.blur * 0.18).toFixed(2)}cqi) brightness(${z.bright / 100}) contrast(${z.contrast / 100}) saturate(${z.sat / 100}) sepia(${z.sepia / 100}) grayscale(${z.gray / 100})`,
      '--ac-zoom': zoomEff(z).toFixed(3), '--ac-ox': z.ox + '%', '--ac-oy': z.oy + '%', '--ac-vig': (z.vig / 100).toFixed(2), '--ac-grain': (z.grain / 100).toFixed(2),
    };
    if (z.size) v['--ac-size'] = (z.size / 100).toFixed(2);
    return v;
  }
  /** the backdrop under the text: the card's choice, or — when the word was moved onto the photo — a readable default */
  const bdOf = (z, th) => z.bd || (z.pos ? (th.layout === 'paper' ? 'plaque' : 'shadow') : '');
  /** classes + inline style for one .ac-card (base: the look around it — gallery, studio draft…) */
  function cardScope(card, base) {
    base = base || look();
    const z = card && card.artDesign ? dz(card) : null;
    const lk = cardLook(card, base), s = scope(lk);
    const cls = s.cls.split(' ').filter(c => c && c !== 'ac-scope' && c !== 'ac-still');
    let vars = {};
    if (z) {
      const own = (z.theme && z.theme !== base.theme) || z.font || z.text || z.accent || z.fx;
      if (own) vars = Object.assign({}, s.vars);
      Object.assign(vars, dzVars(z));
      cls.push('ac-dz');
      if (z.pos) cls.push('ac-free');
      if (z.pos && z.trSep) cls.push('ac-trsep');
      const bd = bdOf(z, s.th);
      if (bd) cls.push('ac-bd-' + bd);
    }
    // 🎚 the photo settings (card.imageFx, js/study.js PhotoFxCore): light and colour first, then the card's own effects
    const fx = card && card.imageFx && window.PhotoFxCore && goodImg(card) ? PhotoFxCore.of(card) : null, ff = fx ? PhotoFxCore.artFilter(fx) : '';
    if (ff) vars['--ac-pf'] = ff + ' ' + (z ? dzVars(z)['--ac-pf'] : '');
    return { cls: cls.join(' '), style: Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';'), vars, th: s.th, lk, z, s };
  }

  /* ---------- markup of one art card ---------- */
  function mediaHtml(card, th, opts = {}) {
    const z = card && card.artDesign;
    const ov = z && (opts.overlays || z.vig || z.grain) ? '<i class="ac-vig" aria-hidden="true"></i><i class="ac-grain" aria-hidden="true"></i>' : '';
    if (opts.image !== false && goodImg(card)) {
      // 🎚 the photo settings: rotation / mirror = a layer around the photo (it always covers the frame), colour washes on top
      const fx = card.imageFx && window.PhotoFxCore ? PhotoFxCore.of(card) : null, g = fx ? PhotoFxCore.artGeo(fx) : '';
      const img = `<img class="ac-img" src="${esc(card.image)}" alt="" ${opts.eager ? '' : 'loading="lazy"'} decoding="async" draggable="false">`;
      return `<div class="ac-media"${g ? ' style="container-type:size"' : ''}>${g ? `<span class="pfx-r" style="${g}">${img}</span>` : img}<i class="ac-tint"></i>${fx ? PhotoFxCore.overlays(fx) : ''}${ov}</div>`;
    }
    const p = parts(card);
    const letter = (Array.from(p.word.replace(/^[^\p{L}\p{N}]+/u, ''))[0] || '✦').toUpperCase();
    return `<div class="ac-media ac-fb">${sceneSvg(hash(card.id || card.no), Object.assign({ id: opts.themeId }, th))}<b class="ac-letter" aria-hidden="true">${esc(letter)}</b>${ov}</div>`;
  }
  function chipHtml(p) {
    if (!p.art && !p.g) return '';
    const g = GENDER[p.g];
    return `<span class="ac-chip" data-g="${p.g}" ${g ? `title="${esc(g.name)}"` : ''}>${esc(p.art || (g && g.art) || '')}</span>`;
  }
  /** a tile of the gallery: picture, word, translation */
  function tileHtml(card, i, ar, base, opts = {}) {
    const p = parts(card), cs = cardScope(card, base);
    const tr = trHtml(card, 'ac-tr'), sep = !!(cs.z && cs.z.pos && cs.z.trSep);
    return `<article class="ac-card ac-tile ac-pre ${cs.cls}" data-ac-id="${esc(card.id)}" data-g="${p.g}" tabindex="0" role="button" aria-label="${esc(firstLine(card.no))} — ${esc(trText(card))}. Открыть карточку" style="--ar:${ar};--d:${(i % 8) * 45}ms;${cs.style}">
      ${mediaHtml(card, cs.th, { themeId: cs.lk.theme, overlays: opts.overlays, eager: opts.eager })}
      <div class="ac-txt" data-dz="word">${chipHtml(p)}<div class="ac-word ${lenCls(p.word)}" lang="no">${esc(p.word)}</div>${sep ? '' : tr}</div>
      ${sep ? `<div class="ac-txt ac-txt2" data-dz="tr">${tr}</div>` : ''}
      ${window.AIHub && AIHub.marksPair ? AIHub.marksPair(card, 'aim-art aim-tile') : ''}
      <button class="ac-i" type="button" data-art-act="info" data-id="${esc(card.id)}" aria-label="Всё о карточке" title="Всё о карточке: объяснение, формы, примеры, кто переводил">i</button>
    </article>`;
  }
  /** 🖼 «Заменить фото» / «Добавить фото» on a study card (the chooser: Views.pickCardImage, via js/study.js data-act="pic") */
  function picBtnHtml(has) {
    const l = has ? 'Заменить фото' : 'Добавить фото';
    // 📌 «Галерея» (in-app, Pinterest-like, Norway by default) first; 🖼 = every other source
    return `<div class="ac-pics"><button class="ac-pic ac-pin" type="button" data-act="pin" aria-label="Галерея картинок, как в Pinterest" title="📌 Галерея картинок, как в Pinterest: фото по слову и норвежским темам — прямо здесь"><span aria-hidden="true">📌</span><span class="ac-pic-l">Галерея</span></button>`
      + `<button class="ac-pic" type="button" data-act="pic" aria-label="${l}" title="${l}: галерея, Wikimedia, нейросеть, исторические фото, с устройства…"><span aria-hidden="true">🖼</span><span class="ac-pic-l">${l}</span></button>`
      // 🎚 «Настроить фото» (js/photofx.js via js/study.js data-act="fx")
      + (has ? '<button class="ac-pic ac-fx" type="button" data-act="fx" style="width:44px;padding:0;justify-content:center" aria-label="Настроить фото" title="🎚 Настроить фото: кадр, поворот, яркость, цвет, готовые стили"><span aria-hidden="true">🎚</span></button>' : '')
      + '</div>';
  }
  /**
   * one face of a big / study card. side: front | back; prompt: 'no' (Norwegian on the front) | 'tr' (translation on the front).
   * opts: { image (false → the illustrated background), study, id }
   */
  function faceHtml(card, side, prompt, opts = {}) {
    const cs = cardScope(card, opts.base), lk = cs.lk, th = cs.th, p = parts(card);
    const showNo = (side === 'front') === (prompt === 'no');
    const ex = (card.examples || [])[0] || (card.example ? { no: card.example, ru: card.exampleRu } : null);
    const btn = (act, label, txt, attr = '') => `<button class="ac-btn" type="button" ${act} aria-label="${label}" title="${label}" ${attr}>${txt}</button>`;
    const speak = opts.study ? (side === 'front' ? 'data-act="speak-front"' : 'data-act="speak-back"') : `data-zact="speak" data-side="${side}"`;
    const flip = opts.study ? 'data-act="flip"' : 'data-zact="flip"';
    let txt;
    if (side === 'front') {
      txt = showNo ? `${chipHtml(p)}<div class="ac-word ${lenCls(p.word)}" lang="no">${esc(p.word)}</div>` : trHtml(card, 'ac-word ac-word-tr ' + lenCls(trText(card)));
    } else if (prompt === 'no') {
      txt = `<div class="ac-small" lang="no">${chipHtml(p)} ${esc(p.word)}</div>${trHtml(card, 'ac-word ac-word-tr ' + lenCls(trText(card)))}`;
    } else {
      txt = `<div class="ac-small">${esc(trText(card))}</div>${chipHtml(p)}<div class="ac-word ${lenCls(p.word)}" lang="no">${esc(p.word)}</div>`;
    }
    if (side === 'back' && ex && ex.no) txt += `<div class="ac-ex"><span lang="no">${esc(firstLine(ex.no)).slice(0, 220)}</span>${ex.ru ? `<i>${esc(firstLine(ex.ru)).slice(0, 220)}</i>` : ''}</div>`;
    return `<div class="ac-card ac-fill ${side === 'back' ? 'ac-back' : ''} ${cs.cls}" data-g="${p.g}" ${cs.style ? `style="${cs.style}"` : ''}>
      ${mediaHtml(card, th, { image: opts.image, eager: true, themeId: lk.theme, overlays: opts.overlays })}
      <div class="ac-txt" data-dz="word">${txt}</div>
      <div class="ac-tools">
        ${btn(speak, 'Прослушать', '🔊')}
        ${side === 'back' ? btn('data-art-act="share"', 'Поделиться картинкой', '📤', `data-id="${esc(card.id)}"`) : ''}
        ${btn(flip, 'Перевернуть карточку', '↻')}
        ${opts.study ? btn('data-act="edit"', 'Редактировать карточку', '<span class="ac-pen" aria-hidden="true">✏️</span>', 'data-ac-edit') : ''}
      </div>
      ${opts.study && opts.image !== false ? picBtnHtml(goodImg(card)) : ''}
      ${window.AIHub && AIHub.markHtml ? AIHub.markHtml(card, (side === 'front') === (prompt === 'no') ? 'no' : 'tr', { cls: 'aim-art' }) : ''}
      <button class="ac-i" type="button" data-art-act="info" data-id="${esc(card.id)}" aria-label="Всё о карточке" title="Всё о карточке: объяснение, формы, примеры, кто переводил">i</button>
    </div>`;
  }

  /* ---------- fonts load lazily, only when the art mode is shown ---------- */
  let fontsLinked = false;
  function ensureFonts() {
    if (fontsLinked) return;
    fontsLinked = true;
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = FONT_CSS; l.dataset.artFonts = '';
    document.head.appendChild(l);
  }
  async function fontReady(lk) {
    ensureFonts();
    const s = scope(lk);
    const fam = (s.font.css || '').split(',')[0].trim();
    if (!fam || fam.startsWith('var(') || !document.fonts) return;
    try {
      await new Promise(r => setTimeout(r, 30));
      await Promise.race([document.fonts.load(`${lk.italic ? 'italic ' : ''}${s.vars['--ac-weight']} 64px ${fam}`, 'Aåø Жж'), new Promise(r => setTimeout(r, 2500))]);
    } catch (e) { /* the fallback font is fine */ }
  }

  /* ---------- reduced motion: a kind one-time notice + in-app override ---------- */
  function motionClass() { document.documentElement.classList.toggle('ac-still-all', !motionOk()); document.querySelectorAll('.ac-scope').forEach(el => el.classList.toggle('ac-still', !motionOk())); }
  const MOTION_HELP = `<details class="ac-howto"><summary>Как включить анимацию в настройках устройства</summary><ul>
      <li><b>iPhone / iPad:</b> Настройки → Универсальный доступ → Движение → выключите «Уменьшение движения».</li>
      <li><b>Android:</b> Настройки → Спец. возможности → Цвет и движение (или «Текст и экран») → выключите «Убрать анимацию».</li>
      <li><b>Mac:</b> Системные настройки → Универсальный доступ → Дисплей → выключите «Уменьшить движение».</li>
      <li><b>Windows:</b> Параметры → Специальные возможности → Визуальные эффекты → включите «Эффекты анимации».</li></ul>
      <p class="small muted">Сайт не может сам открыть настройки устройства — поэтому проще одной кнопкой включить анимацию только здесь, в приложении.</p></details>`;
  function motionNotice() {
    if (!reduceSys() || Store.settings.artMotion === 'on' || Store.settings.artMotionNote) return;
    Store.setSetting('artMotionNote', true);
    setTimeout(() => {
      const m = UI.modal({
        title: '🌿 Анимация отключена в настройках вашего устройства', cls: 'narrow ac-motion-modal',
        body: `<p>Поэтому карточки переворачиваются мягким затуханием, без вращения и наклонов — всё работает кнопками <b>↻ Перевернуть</b> и с клавиатуры (пробел).</p>
          <p>Хотите красивые повороты и подсветку здесь, в приложении? Это можно включить одной кнопкой — на остальные приложения это не повлияет.</p>${MOTION_HELP}`,
        foot: '<button class="btn ghost" data-close-ok>Оставить так</button><button class="btn primary" data-motion-on>✨ Включить анимацию в приложении</button>',
      });
      m.$('[data-close-ok]').onclick = () => m.close();
      m.$('[data-motion-on]').onclick = () => { Store.setSetting('artMotion', 'on'); motionClass(); m.close(); UI.toast('✨ Анимация в художественном виде включена', 'good', 2200); };
    }, 600);
  }

  /* =====================================================================
   * GALLERY — the art view of a deck
   * ===================================================================== */
  const PAGE = 36;
  const G = { deckId: null, filter: 'all', q: '', shown: PAGE, io: null, appear: null, list: [] };
  const AR = [1.25, 1.4, 1, 1.5, 1.2, 1.33, 0.9, 1.45]; // height / width of the tiles — known before pictures load (no jumps)
  const arOf = c => AR[hash(c.id) % AR.length];

  function galleryCards(deck) {
    const now = Date.now(), q = G.q.trim().toLowerCase(), f = G.filter;
    return Store.cards(deck.id).filter(c => {
      if (f === 'due' && !Store.isDue(c, null, now)) return false;
      if (['new', 'learning', 'learned'].includes(f) && Store.status(c) !== f) return false;
      if (q && !(c.no + ' ' + c.ru + ' ' + (c.uk || '') + ' ' + (c.tags || []).join(' ')).toLowerCase().includes(q)) return false;
      return true;
    });
  }
  function seasonBanner() {
    const s = Store.settings, now = seasonOf(), lk = look();
    if (!s.artSeasonHints || !now || lk.theme === now) return '';
    const key = `${now}-${new Date().getFullYear()}`;
    if ((s.artSeasonSeen || {})[key]) return '';
    const th = THEMES[now];
    return `<div class="ac-season" data-season="${now}" data-key="${key}"><span class="ac-season-ico" aria-hidden="true">${th.icon}</span>
      <span class="ac-season-t">Наступает сезон «${esc(th.name)}» — примерить праздничный шаблон для карточек?</span>
      <button class="btn sm primary" data-art-act="season-try">Примерить</button><button class="btn sm ghost" data-art-act="season-no">Не сейчас</button></div>`;
  }
  function gallery(root, deck) {
    ensureFonts();
    if (G.deckId !== deck.id) Object.assign(G, { deckId: deck.id, filter: 'all', q: '', shown: PAGE });
    const stats = Store.deckStats(deck.id);
    const sc = scope();
    const list = galleryCards(deck);
    G.list = list.map(c => c.id);
    const studyCount = Study.buildQueue({ deckId: deck.id, dryRun: true }).length;
    const chip = (k, l, n) => `<button class="ac-fchip ${G.filter === k ? 'on' : ''}" data-gal="filter" data-f="${k}" aria-pressed="${G.filter === k}">${l}<b>${n}</b></button>`;
    root.innerHTML = `<div class="ac-gallery ${sc.cls}" style="${sc.style}">
      <header class="ac-hero">
        ${deck.cover ? `<div class="ac-hero-bg" style="background-image:url('${esc(String(deck.cover).replace(/'/g, '%27'))}')"></div>` : ''}
        <div class="ac-hero-row">
          <button class="ac-round" data-gal="back" aria-label="Назад к колодам" title="Назад">←</button>
          <div class="ac-hero-t">
            <div class="ac-kicker">🎨 Галерея · ${esc(theme(look().theme).name)}</div>
            <h1 class="ac-hero-h">${esc(deck.name)}</h1>
            <div class="ac-hero-sub">${U.cards(stats.total)} · выучено ${stats.learnedPct}%</div>
          </div>
        </div>
        <div class="ac-hero-btns">
          <button class="btn primary lg" data-gal="study" ${studyCount ? '' : 'disabled'}>▶ Учить · ${U.cards(studyCount)}</button>
          <button class="btn" data-art-act="studio">🎨 Оформление</button>
          <button class="btn" data-art-act="ideas">📌 Идеи</button>
          <button class="btn" data-art-act="deck-off" data-id="${esc(deck.id)}" title="Вернуться к обычному виду колоды (список, импорт, экспорт…)">🔤 Обычный вид</button>
        </div>
      </header>
      ${seasonBanner()}
      <div class="ac-tools-row">
        <div class="ac-fchips" role="group" aria-label="Какие карты показать">${chip('all', 'Все', stats.total)}${chip('new', 'Новые', stats.new)}${chip('learning', 'Изучаю', stats.learning)}${chip('learned', 'Выученные', stats.learned)}${chip('due', '⏰ Повторить', stats.due)}</div>
        <input class="input ac-search" type="search" placeholder="🔍 Найти слово…" value="${esc(G.q)}" data-gal-q aria-label="Поиск по колоде">
      </div>
      ${list.length ? '<div class="ac-masonry" data-masonry></div><div class="ac-sentinel" data-sentinel></div>' : `<div class="ac-empty">
        <div class="ac-empty-art">${sceneSvg(7, sc.th)}</div>
        <p>${stats.total ? 'Ничего не нашлось — попробуйте другой фильтр или слово.' : 'В колоде пока нет карточек — добавьте первую, и здесь появится красивая галерея.'}</p>
        ${stats.total ? '' : '<button class="btn primary" data-gal="add">➕ Добавить карточку</button>'}</div>`}
    </div>`;
    const gal = root.querySelector('.ac-gallery');
    layout(gal, list, true);
    // search keeps focus while typing
    const qi = gal.querySelector('[data-gal-q]');
    qi.oninput = U.debounce(() => { G.q = qi.value; G.shown = PAGE; App.render(); setTimeout(() => { const s = document.querySelector('[data-gal-q]'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 0); }, 250);
    root.onclick = e => {
      const b = e.target.closest('[data-gal]');
      if (b) {
        switch (b.dataset.gal) {
          case 'back': App.go('home'); break;
          case 'study': Study.start({ deckId: deck.id }); break;
          case 'add': Views.editCard(null, deck.id, () => App.render()); break;
          case 'filter': G.filter = b.dataset.f; G.shown = PAGE; App.render(); break;
        }
        return;
      }
      const t = e.target.closest('.ac-tile');
      if (t && !e.target.closest('button')) zoom(t.dataset.acId, G.list, deck.id);
    };
    gal.addEventListener('keydown', e => {
      const t = e.target.closest && e.target.closest('.ac-tile');
      if (t && (e.key === 'Enter' || e.key === ' ') && e.target === t) { e.preventDefault(); zoom(t.dataset.acId, G.list, deck.id); }
    });
    bindTilt(gal);
    motionNotice();
  }
  /** masonry: tiles go into N columns, each into the shortest one (left → right reading order, heights known in advance) */
  function layout(gal, list, fresh) {
    const box = gal.querySelector('[data-masonry]'); if (!box) return;
    const w = box.clientWidth || gal.clientWidth || window.innerWidth;
    const n = Math.max(2, Math.min(6, Math.floor((w + 14) / 224)));
    const lk = look();
    if (fresh || box.children.length !== n) { box.innerHTML = Array.from({ length: n }, () => '<div class="ac-col"></div>').join(''); box._h = new Array(n).fill(0); box._done = 0; }
    const cols = [...box.children];
    const upto = Math.min(G.shown, list.length);
    for (let i = box._done; i < upto; i++) {
      const c = list[i], ar = arOf(c), paper = theme(cardLook(c, lk).theme).layout === 'paper';
      let k = 0; box._h.forEach((h, j) => { if (h < box._h[k] - 0.01) k = j; });
      cols[k].insertAdjacentHTML('beforeend', tileHtml(c, i, ar, lk));
      box._h[k] += ar + (paper ? 0.42 : 0) + 0.06;
    }
    box._done = upto;
    appear(box);
    // fallback when a stored picture fails to load: the illustrated background instead of a broken image
    if (!box._err) {
      box._err = true;
      box.addEventListener('error', e => {
        const img = e.target; if (!(img instanceof HTMLImageElement) || !img.classList.contains('ac-img')) return;
        const tile = img.closest('[data-ac-id]'), card = tile && Store.card(tile.dataset.acId); if (!card) return;
        const cs = cardScope(card);
        img.closest('.ac-media').outerHTML = mediaHtml(Object.assign({}, card, { image: '' }), cs.th, { themeId: cs.lk.theme });
      }, true);
    }
    const sent = gal.querySelector('[data-sentinel]');
    if (G.io) G.io.disconnect();
    if (sent && upto < list.length && 'IntersectionObserver' in window) {
      G.io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { G.shown += PAGE; layout(gal, list, false); } }, { rootMargin: '900px 0px' });
      G.io.observe(sent);
    } else if (sent && upto < list.length) { G.shown = list.length; layout(gal, list, false); }
    // a different number of columns after a resize / rotation
    if (!gal._ro && 'ResizeObserver' in window) {
      let lastN = n;
      gal._ro = new ResizeObserver(U.debounce(() => {
        if (!gal.isConnected) { gal._ro.disconnect(); return; }
        const nw = box.clientWidth, nn = Math.max(2, Math.min(6, Math.floor((nw + 14) / 224)));
        if (nn !== lastN) { lastN = nn; layout(gal, list, true); }
      }, 150));
      gal._ro.observe(box);
    }
  }
  function appear(box) {
    const tiles = [...box.querySelectorAll('.ac-tile.ac-pre')];
    if (!motionOk() || !('IntersectionObserver' in window)) { tiles.forEach(t => t.classList.remove('ac-pre')); return; }
    if (!G.appear) G.appear = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.remove('ac-pre'); x.target.classList.add('ac-in'); G.appear.unobserve(x.target); } }), { rootMargin: '0px 0px -6% 0px' });
    tiles.forEach(t => G.appear.observe(t));
  }
  /** desktop: a soft 3D tilt toward the pointer + a glow that follows it */
  function bindTilt(gal) {
    if (!window.matchMedia || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let raf = 0;
    gal.addEventListener('pointermove', e => {
      const t = e.target.closest && e.target.closest('.ac-tile'); if (!t || !motionOk()) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        t.style.setProperty('--rx', ((0.5 - y) * 7).toFixed(2) + 'deg'); t.style.setProperty('--ry', ((x - 0.5) * 9).toFixed(2) + 'deg');
        t.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); t.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      });
    });
    gal.addEventListener('pointerout', e => { const t = e.target.closest && e.target.closest('.ac-tile'); if (t && !t.contains(e.relatedTarget)) { t.style.removeProperty('--rx'); t.style.removeProperty('--ry'); } });
  }
  function refreshTile(id) {
    const c = Store.card(id);
    document.querySelectorAll(`.ac-tile[data-ac-id="${CSS.escape(id)}"]`).forEach(t => {
      if (!c) { t.remove(); return; }
      const ar = t.style.getPropertyValue('--ar') || arOf(c);
      t.outerHTML = tileHtml(c, 0, ar).replace('ac-pre', '');
    });
  }

  /* =====================================================================
   * BIG CARD (tap in the gallery) — flip, ‹ ›, 🔊, i, ✎, share, study from here
   * ===================================================================== */
  function zoom(id, list, deckId) {
    ensureFonts();
    const ids = (list && list.length ? list : [id]).filter(x => Store.card(x));
    let i = Math.max(0, ids.indexOf(id)), flipped = false;
    const sc = scope();
    const m = UI.modal({
      title: '🎨 Карточка', cls: 'art-zoom',
      body: `<div class="ac-zoom ${sc.cls}" style="${sc.style}"><div class="ac-zstage" data-zstage></div></div>`,
      foot: `<button class="btn" data-zact="prev" aria-label="Предыдущая">‹</button><span class="small muted" data-zpos></span><button class="btn" data-zact="next" aria-label="Следующая">›</button>
        <span class="grow"></span>
        <button class="btn" data-zact="flip">↻ Перевернуть</button>
        <button class="btn" data-zact="design" title="Своё оформление этой карточки">🎨 Дизайн</button>
        <button class="btn" data-zact="edit">✎ Изменить</button>
        <button class="btn primary" data-zact="study">▶ Учить с этой</button>`,
      onClose: () => document.removeEventListener('keydown', onKey, true),
    });
    const draw = () => {
      const c = Store.card(ids[i]); if (!c) { m.close(); return; }
      flipped = false;
      m.$('[data-zstage]').innerHTML = `<div class="ac-flipper" data-zcard tabindex="0" role="button" aria-label="Карточка: нажмите, чтобы перевернуть">
        <div class="ac-side ac-front">${faceHtml(c, 'front', 'no')}</div><div class="ac-side ac-backside">${faceHtml(c, 'back', 'no')}</div></div>`;
      m.$('[data-zpos]').textContent = `${i + 1} из ${ids.length}`;
      m.$('[data-zact="prev"]').disabled = i === 0;
      m.$('[data-zact="next"]').disabled = i >= ids.length - 1;
    };
    const flip = () => { flipped = !flipped; const z = m.$('[data-zcard]'); if (z) { z.classList.toggle('flipped', flipped); z.setAttribute('aria-label', flipped ? 'Обратная сторона: перевод. Нажмите, чтобы перевернуть' : 'Карточка: нажмите, чтобы перевернуть'); } };
    const go = d => { const n = i + d; if (n < 0 || n >= ids.length) return; i = n; TTS.stop(); draw(); };
    const onKey = e => {
      if (!document.body.contains(m.el) || /input|textarea|select/i.test(e.target.tagName || '')) return;
      const open = [...document.getElementById('modal-root').children].filter(x => !x.classList.contains('closing'));
      if (open[open.length - 1] !== m.el.parentElement) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === ' ' || e.key === 'Enter' || e.key === 'f') { if (e.target.closest && e.target.closest('button:not([data-zcard])') && e.key !== 'f') return; e.preventDefault(); flip(); }
      else if (e.key === 'i' || e.key === 'ш') { e.preventDefault(); info(ids[i]); }
    };
    document.addEventListener('keydown', onKey, true);
    let sx = null;
    m.el.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    m.el.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 70) go(dx < 0 ? 1 : -1); }, { passive: true });
    m.el.addEventListener('click', e => {
      const b = e.target.closest('[data-zact]');
      const c = Store.card(ids[i]);
      if (!b) { if (e.target.closest('[data-zcard]') && !e.target.closest('button')) flip(); return; }
      switch (b.dataset.zact) {
        case 'prev': go(-1); break;
        case 'next': go(1); break;
        case 'flip': flip(); break;
        case 'speak': if (c) { if (b.dataset.side === 'back') TTS.speakText(trText(c), 'ru'); else TTS.speakText(firstLine(c.no), 'no'); } break;
        case 'edit': if (c) Views.editCard(c.id, c.deckId, () => { draw(); refreshTile(c.id); }); break;
        case 'design': if (c) designer(c.id); break;
        case 'study': {
          m.close();
          const order = ids.slice(i).concat(ids.slice(0, i));
          Study.start({ deckId: deckId || (c && c.deckId), cardIds: order, filter: 'all', size: 0, shuffle: false });
          break;
        }
      }
    });
    m.redraw = draw;
    draw();
    setTimeout(() => { const z = m.$('[data-zcard]'); if (z) z.focus({ preventScroll: true }); }, 80);
    motionNotice();
    return m;
  }

  /* =====================================================================
   * «i» — everything hidden: explanation, examples, forms, provenance, history, ✎
   * ===================================================================== */
  function srsLine(s) {
    if (!s || !s.reps) return 'ещё не изучали';
    const next = s.due - Date.now();
    return `${s.reps} ${U.plural(s.reps, ['повторение', 'повторения', 'повторений'])}${s.lapses ? ` · забывали ${s.lapses} ${U.plural(s.lapses, ['раз', 'раза', 'раз'])}` : ''} · ${next > 0 ? 'следующее через ' + U.fmtInterval(next) : 'пора повторить'}`;
  }
  /** 📷 who made the photo (free licences: the author and the licence travel with the picture) */
  function creditHtml(c, cls = 'ac-credit') {
    if (!c || !c.imageCredit || !goodImg(c)) return '';
    const t = esc(String(c.imageCredit).slice(0, 220));
    return `<p class="${cls}"><span aria-hidden="true">📷</span> ${/^https:\/\//i.test(c.imageCreditUrl || '') ? `<a href="${esc(c.imageCreditUrl)}" target="_blank" rel="noopener noreferrer">${t} <span aria-hidden="true">↗</span></a>` : t}</p>`;
  }
  function infoBody(c) {
    const sc = scope(cardLook(c)), cs = cardScope(c), p = parts(c);
    const sec = (ico, title, html) => html ? `<section class="ac-sec"><h4><span aria-hidden="true">${ico}</span> ${title}</h4>${html}</section>` : '';
    const ex = (c.examples || []).length || c.example;
    const srcs = Prov.sources(c);
    const examples = (Study.examplesHtml(c) || '') + (c.example ? `<div class="example">${UI.rich(c.example)} <button class="icon-btn sm ex-say" data-act="say" data-say="${esc(c.example)}" data-lang="no" title="Произнести по-норвежски">🔊</button>${c.exampleRu ? `<span class="tr">${UI.rich(c.exampleRu)}</span>` : ''}</div>` : '');
    const hist = (c.history || []).slice(-4).reverse().map(h => `<li>${Prov.icon(h.by, 15)} <span>${esc(Prov.name(h.by))}</span> <small class="muted">· ${esc(U.fmtDate ? U.fmtDate(h.t) : new Date(h.t).toLocaleDateString('ru-RU'))}</small></li>`).join('');
    const empty = !c.description && !(c.forms || []).length && !ex && !(c.synonyms || []).length;
    // light templates (paper, pastel): dark letters on the head — white ones would not be readable there
    return `<div class="ac-sheet-head ${sc.cls}${lum(sc.th.bg[1]) > 0.35 ? ' ac-sheet-light' : ''}" style="${sc.style}">
        <div class="ac-sheet-thumb" ${cs.z ? `style="${Object.entries(dzVars(cs.z)).map(([k, v]) => `${k}:${v}`).join(';')}"` : ''}>${mediaHtml(c, sc.th, { eager: true, themeId: sc.lk.theme })}</div>
        <div class="ac-sheet-t"><div class="ac-sheet-word" lang="no">${chipHtml(p)} ${esc(p.word)} <button class="icon-btn sm" data-act="say" data-say="${esc(firstLine(c.no))}" data-lang="no" aria-label="Прослушать">🔊</button></div>${trHtml(c, 'ac-sheet-tr')}
          <div class="ac-sheet-meta">${UI.statusChip(Store.status(c))}${c.wordClass ? `<span class="chip gt-chip">${window.Gram ? Gram.pos(c.wordClass) : esc(c.wordClass)}</span>` : ''}${p.g && GENDER[p.g] ? `<span class="chip ac-gchip" data-g="${p.g}">${esc(GENDER[p.g].art)} · ${esc(GENDER[p.g].name)}</span>` : ''}</div></div>
      </div>
      ${creditHtml(c)}
      <div class="ac-sheet-body" data-cv data-cid="${esc(c.id)}">
        ${empty ? '<p class="ac-sheet-empty">Пока здесь только слово и перевод. Добавьте объяснение, формы и примеры — нажмите <b>✎ Изменить карточку</b> (или попросите нейросеть в редакторе).</p>' : ''}
        ${c.description && !(c.examples || []).length ? Study.viewBarHtml(c) : ''}
        ${sec('📝', 'Объяснение', c.description ? `<div class="desc" data-desc-box>${Study.descHtml(c)}</div>` : '')}
        ${Study.formsHtml(c)}
        ${Study.synonymsHtml(c)}
        ${sec('💬', 'Примеры', examples.trim())}
        ${sec('✍️', 'Кто переводил и проверял', srcs.length ? `<div class="ac-prov">${Prov.badges(c, 20)}<span class="small muted">${srcs.map(by => esc(Prov.name(by))).join(' · ')}</span></div>${hist ? `<ul class="ac-hist">${hist}</ul>` : ''}<button class="btn sm" data-art-act="history" data-id="${esc(c.id)}">🧾 Вся история карточки</button>` : '<p class="small muted">Карточку добавили без отметки, кто переводил.</p>')}
        ${sec(window.NavIcons ? NavIcons.statsIco() : '📊', 'Как идёт изучение', `<div class="ac-srs"><div>🇳🇴 → ${Study.trFlag()} <span>${srsLine(c.srs && c.srs.nr)}</span></div><div>${Study.trFlag()} → 🇳🇴 <span>${srsLine(c.srs && c.srs.rn)}</span></div></div>`)}
      </div>`;
  }
  function info(id) {
    const c = Store.card(id); if (!c) return;
    const m = UI.modal({
      title: 'ℹ️ О карточке', cls: 'wide art-sheet',
      body: '<div data-sheet></div>',
      foot: `<button class="btn" data-sact="share">📤 Картинкой</button><button class="btn" data-sact="design" title="Своё оформление этой карточки: положение слова, поворот, эффекты фото, стиль">🎨 Дизайн</button><span class="grow"></span><button class="btn ghost" data-sact="close">Закрыть</button><button class="btn primary" data-sact="edit">✎ Изменить карточку</button>`,
    });
    m.el.parentElement.classList.add('ac-sheet-bd');
    const draw = () => {
      const cur = Store.card(id); if (!cur) { m.close(); return; }
      m.$('[data-sheet]').innerHTML = infoBody(cur);
      Study.fillExamples(cur, () => { const x = Store.card(id); if (x) Study.redrawIn(m.$('[data-sheet]'), x); });
    };
    m.el.addEventListener('click', async e => {
      const s = e.target.closest('[data-sact]');
      const a = e.target.closest('[data-act]');
      const c2 = Store.card(id);
      if (a && c2) {
        const act = a.dataset.act;
        if (act === 'say') TTS.speak(a.dataset.say, a.dataset.lang || 'no');
        else if (act === 'ex-view') { Store.setSetting('exView', a.dataset.v); draw(); }
        else if (act === 'ex-read') await Study.exRead(c2, +a.dataset.i, a);
        else if (act === 'mt-toggle') a.classList.toggle('open');
        return;
      }
      if (!s || !c2) return;
      if (s.dataset.sact === 'close') m.close();
      else if (s.dataset.sact === 'share') share(id);
      else if (s.dataset.sact === 'design') designer(id, { onSaved: draw });
      else if (s.dataset.sact === 'edit') Views.editCard(id, c2.deckId, () => { draw(); afterEdit(id); });
    });
    draw();
    return m;
  }
  /** a card changed in the editor: redraw it wherever it is shown in art style */
  function afterEdit(id) {
    refreshTile(id);
    document.querySelectorAll('.art-zoom').forEach(z => { const bd = z.parentElement; if (bd && bd._m && bd._m.redraw) bd._m.redraw(); });
    const S = window.Study && Study.session;
    if (S && App.view.name === 'study') {
      const cur = Study.current();
      if (cur && cur.card.id === id) { const f = S.flipped; Study.renderCard(false); if (f) Study.flip(true); }
    }
  }

  /* =====================================================================
   * STUDY in art style (called by js/study.js → renderCard, before the swipe handlers are bound)
   * ===================================================================== */
  function studyOn(S) {
    if (!S || S.mode === 'listen') return false;
    if (S.art != null) return !!S.art;
    const d = S.deckId && Store.deck(S.deckId);
    return d ? deckOn(d) : !!Store.settings.artMode;
  }
  function decorateStudy(area, card, item, S) {
    const fc = area && area.querySelector('[data-card]'); if (!fc) return;
    ensureFonts();
    const hints = Store.settings.hints !== false;
    const prompt = item.dir === 'nr' ? 'no' : 'tr';
    const stage = fc.closest('.stage');
    applyScope(stage);
    stage.classList.add('ac-stage');
    fc.classList.add('ac-study');
    const front = fc.querySelector('.face.front'), back = fc.querySelector('.face.back');
    if (!front || !back) return;
    front.className = 'face front ac-face'; back.className = 'face back ac-face';
    front.innerHTML = faceHtml(card, 'front', prompt, { study: true, image: hints });
    back.innerHTML = faceHtml(card, 'back', prompt, { study: true });
    const grid = area.querySelector('.study-grid'); if (grid) grid.classList.add('ac-grid');
    // no picture yet: the illustrated background now, the real one as soon as it is drawn (like the normal mode)
    const st = Store.settings;
    if (!goodImg(card) && window.Images && !(Images.skip && Images.skip(card)) && st.autoImages && st.imageProvider !== 'off' && !UI.isLong(card.no)) {
      Images.ensure(card).then(url => {
        const cur = Study.current();
        if (!url || !cur || cur.card.id !== card.id) return;
        const fresh = Store.card(card.id) || card, th = cardScope(fresh).th;
        fc.querySelectorAll('.ac-face .ac-media').forEach((el, k) => { if (k === 0 && !hints) return; el.outerHTML = mediaHtml(fresh, th, { eager: true }); });
        fc.querySelectorAll('.ac-face .ac-pics').forEach(b => { b.outerHTML = picBtnHtml(true); });
      }).catch(() => { /* the illustrated background stays */ });
    }
    motionNotice();
  }
  function studyToggleHtml(S) {
    if (!S || S.mode === 'listen') return '';
    // the button shows what it switches TO (🖼 «Картинкой» / 🔤 «Текстом») — the label and the screen reader say the same
    const on = studyOn(S);
    const label = on ? 'Текстом' : 'Картинкой';
    return `<button class="btn sm ac-study-toggle" data-art-act="study-toggle" data-art-on="${on}" aria-label="${on ? 'Показать карточки текстом (обычный вид)' : 'Показать карточки картинкой (художественный вид)'}" title="${on ? 'Обычный вид карточек: слово и перевод текстом' : 'Художественный вид: картинка во всю карточку, крупное слово'}"><span aria-hidden="true">${on ? '🔤' : '🖼'}</span><span class="ac-tl"> ${label}</span></button>`;
  }

  /* =====================================================================
   * 🎨 STUDIO — templates, fonts, colours, effects with a live preview
   * ===================================================================== */
  const DEMO = [
    { id: 'demo-fjord', no: 'en fjord', ru: 'фьорд', uk: 'фіорд', image: 'icons/preloader/fjord.webp', examples: [{ no: 'Vi seilte inn i fjorden.', ru: 'Мы вплыли во фьорд.' }] },
    { id: 'demo-hytte', no: 'ei hytte', ru: 'домик, хижина', uk: 'хатинка', image: '' },
  ];
  function studio(opts = {}) {
    ensureFonts();
    const saved = look();
    let d = Object.assign({}, saved);
    const sample = opts.sample && goodImg(opts.sample) ? opts.sample : DEMO[0];
    const sample2 = opts.sample2 || DEMO[1];
    const th0 = () => theme(d.theme);
    const sw = (key, list, cur) => list.map(c => `<button type="button" class="ac-sw ${cur === c ? 'on' : ''}" data-st="${key}" data-v="${c}" style="--c:${c}" aria-label="Цвет ${c}" aria-pressed="${cur === c}"></button>`).join('');
    const range = (key, label, min, max, step, unit) => `<label class="ac-range"><span>${label} <b data-rv="${key}">${d[key]}${unit}</b></span><input type="range" min="${min}" max="${max}" step="${step}" value="${d[key]}" data-st-range="${key}" data-unit="${unit}"></label>`;
    const themeBtn = id => { const t = THEMES[id]; return `<button type="button" class="ac-thb ${d.theme === id ? 'on' : ''}" data-st="theme" data-v="${id}" aria-pressed="${d.theme === id}" style="--b1:${t.bg[0]};--b2:${t.bg[1]};--b3:${t.bg[2]};--a:${t.accent};--p:${t.paper || 'transparent'}"><i aria-hidden="true">${t.icon}</i><span>${esc(t.name)}</span>${t.when ? `<small>${esc(t.when)}</small>` : ''}</button>`; };
    const fontBtn = f => { const css = f.id === 'theme' ? (fontById(th0().font).css) : f.css; return `<button type="button" class="ac-fb-btn ${d.font === f.id ? 'on' : ''}" data-st="font" data-v="${f.id}" aria-pressed="${d.font === f.id}" style="font-family:${esc(css || 'inherit')}"><span>${esc(f.name)}</span><small>Fjord · Фьорд${f.note ? ' · ' + esc(f.note) : ''}</small></button>`; };
    const body = () => {
      const sc = scope(d);
      const textBg = th0().layout === 'paper' ? (th0().paper || '#ffffff') : '#14161c';
      const cr = contrast(d.text || th0().ink, textBg);
      return `<div class="ac-studio">
        <div class="ac-st-prev"><div class="${sc.cls} ac-prev-scope" style="${sc.style}">
          <div class="ac-prev-pair">${tileHtml(sample, 0, 1.3, d).replace('ac-pre', '')}${tileHtml(sample2, 1, 1.3, d).replace('ac-pre', '')}</div>
          <div class="ac-legend">${legendHtml()}</div></div>
          ${cr < 3 ? `<div class="ac-warn">⚠️ Такой цвет текста может плохо читаться на этом шаблоне — попробуйте посветлее/потемнее или «Авто».</div>` : ''}
        </div>
        <div class="ac-st-ctl">
          <section><h4>Шаблон</h4><div class="ac-themes">${Object.keys(THEMES).filter(k => !THEMES[k].season && THEMES[k].group !== 'no').map(themeBtn).join('')}</div>
            ${Object.keys(THEMES).some(k => THEMES[k].group === 'no') ? `<h5>🇳🇴 Норвегия <small class="muted">— тролли, викинги, ставкирки, Лофотены…</small></h5><div class="ac-themes">${Object.keys(THEMES).filter(k => THEMES[k].group === 'no' && !THEMES[k].season).map(themeBtn).join('')}</div>` : ''}
            <h5>Праздники и сезоны <small class="muted">— сами предложатся, когда подойдёт дата</small></h5><div class="ac-themes">${Object.keys(THEMES).filter(k => THEMES[k].season).map(themeBtn).join('')}</div></section>
          <section><h4>Шрифт <small class="muted">— все с кириллицей и æ ø å</small></h4><div class="ac-fonts">${FONTS.map(fontBtn).join('')}</div></section>
          <section><h4>Начертание</h4>
            <div class="ac-bi"><button type="button" class="ac-tog ${d.weight >= 700 ? 'on' : ''}" data-st="bold" aria-pressed="${d.weight >= 700}" title="Жирный"><b>Ж</b></button><button type="button" class="ac-tog ${d.italic ? 'on' : ''}" data-st="italic" aria-pressed="${d.italic}" title="Курсив"><i>К</i></button></div>
            ${range('weight', 'Насыщенность', 300, 900, 100, '')}${range('size', 'Размер', 70, 150, 5, '%')}${range('track', 'Межбуквенный интервал', -6, 24, 1, '')}${range('width', 'Ширина букв', 80, 120, 2, '%')}</section>
          <section><h4>Цвет текста</h4><div class="ac-sws"><button type="button" class="ac-auto ${!d.text ? 'on' : ''}" data-st="text" data-v="">Авто</button>${sw('text', PALETTE, d.text)}<label class="ac-pick" title="Свой цвет"><input type="color" value="${d.text || th0().ink}" data-st-color="text"><span>🎨 Свой</span></label></div></section>
          <section><h4>Акцент <small class="muted">— рамка, свечение, значки</small></h4><div class="ac-sws"><button type="button" class="ac-auto ${!d.accent ? 'on' : ''}" data-st="accent" data-v="">Авто</button>${sw('accent', PALETTE, d.accent)}<label class="ac-pick" title="Свой цвет"><input type="color" value="${d.accent || th0().accent}" data-st-color="accent"><span>🎨 Свой</span></label></div></section>
          <section><h4>Обводка и тень</h4><div class="seg ac-fx">${[['none', 'Нет'], ['shadow', 'Мягкая тень'], ['outline', 'Контур'], ['glow', 'Свечение']].map(([v, l]) => `<button type="button" class="${d.fx === v ? 'active' : ''}" data-st="fx" data-v="${v}">${l}</button>`).join('')}</div></section>
          <section><label class="switch"><input type="checkbox" data-st-check="grade" ${d.grade ? 'checked' : ''}><span class="track"></span><span>Единая цветокоррекция фото под шаблон</span></label></section>
        </div></div>`;
    };
    const m = UI.modal({
      title: '🎨 Оформление карточек', cls: 'wide art-studio-modal',
      body: '<div data-studio></div>',
      foot: '<button class="btn ghost" data-st-act="reset" title="Вернуть оформление по умолчанию">↺ Сбросить</button><span class="grow"></span><button class="btn ghost" data-st-act="cancel">Отмена</button><button class="btn primary" data-st-act="save">💾 Сохранить</button>',
      beforeClose: UI.guard(() => JSON.stringify(d) === JSON.stringify(saved) ? null
        : { title: 'Закрыть без сохранения?', line: 'Новое оформление ещё не сохранено.', actions: [{ label: 'Закрыть', value: 'close', cls: 'bad' }], cancel: 'Вернуться' }),
    });
    const box = m.$('[data-studio]');
    const draw = () => { const st = box.querySelector('.ac-st-ctl'); const y = st ? st.scrollTop : 0; box.innerHTML = body(); const st2 = box.querySelector('.ac-st-ctl'); if (st2) st2.scrollTop = y; fontReady(d); };
    // live preview for sliders without redrawing the whole window (keeps the slider under the finger)
    const live = () => { const pv = box.querySelector('.ac-prev-scope'); if (pv) applyScope(pv, d); };
    box.addEventListener('input', e => {
      const r = e.target.dataset.stRange, col = e.target.dataset.stColor;
      if (r) { d[r] = +e.target.value; const lab = box.querySelector(`[data-rv="${r}"]`); if (lab) lab.textContent = e.target.value + (e.target.dataset.unit || ''); live(); }
      if (col) { d[col] = e.target.value.toLowerCase(); live(); }
    });
    box.addEventListener('change', e => {
      if (e.target.dataset.stColor) draw();
      if (e.target.dataset.stCheck) { d[e.target.dataset.stCheck] = e.target.checked; draw(); }
      if (e.target.dataset.stRange === 'weight') draw();
    });
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-st]'); if (!b) return;
      const k = b.dataset.st, v = b.dataset.v;
      if (k === 'bold') d.weight = d.weight >= 700 ? 400 : 800;
      else if (k === 'italic') d.italic = !d.italic;
      else d[k] = v;
      draw();
    });
    m.el.querySelector('.modal-foot').addEventListener('click', async e => {
      const b = e.target.closest('[data-st-act]'); if (!b) return;
      if (b.dataset.stAct === 'reset') { d = Object.assign({}, DEFAULT_LOOK); draw(); UI.toast('↺ Оформление по умолчанию — нажмите «Сохранить», чтобы оставить', '', 2600); }
      if (b.dataset.stAct === 'cancel') m.tryClose();
      if (b.dataset.stAct === 'save') { Store.setSetting('art', Store.Safe.art(d)); d = look(); Object.assign(saved, d); m.close(); restyle(); UI.toast('🎨 Оформление сохранено', 'good', 1800); }
    });
    draw();
    return m;
  }
  /** after the look changed: redraw what is on screen in art style */
  function restyle() {
    if (App.view.name === 'deck' || App.view.name === 'settings') App.render();
    else if (App.view.name === 'study' && window.Study && Study.session) { const f = Study.session.flipped; Study.renderCard(false); if (f) Study.flip(true); }
  }
  function legendHtml() {
    return `<div class="ac-glegend" role="list" aria-label="Цвета рода">${['m', 'f', 'n', 'pl'].map(k => `<span role="listitem" class="ac-gl" data-g="${k}"><i aria-hidden="true"></i><b>${esc(GENDER[k].art)}</b> ${esc(GENDER[k].name)}</span>`).join('')}</div>`;
  }

  /* =====================================================================
   * 📤 SHARE A CARD AS A PICTURE (canvas → PNG): stories 9:16 or square
   * ===================================================================== */
  function loadImg(src) {
    return new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = () => rej(new Error('img')); im.src = src; });
  }
  /** a picture that never taints the canvas: data: / own files as they are; https → fetched as a blob (CORS) or skipped */
  async function safeImg(src) {
    if (!src) return null;
    try {
      if (/^data:image\//i.test(src) || !/^https?:/i.test(src) || new URL(src, location.href).origin === location.origin) return await loadImg(src);
      const r = await fetch(src, { mode: 'cors', credentials: 'omit' });
      if (!r.ok) return null;
      const b = await r.blob();
      if (!/^image\//.test(b.type) || /svg/.test(b.type)) return null;
      const url = URL.createObjectURL(b);
      try { return await loadImg(url); } finally { setTimeout(() => URL.revokeObjectURL(url), 4000); }
    } catch (e) { return null; }
  }
  const svgImg = s => loadImg('data:image/svg+xml;charset=utf-8,' + enc(s)).catch(() => null);
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function cover(ctx, im, x, y, w, h) { const k = Math.max(w / im.width, h / im.height), iw = im.width * k, ih = im.height * k; ctx.drawImage(im, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); }
  function lines(ctx, text, maxW, max) {
    const words = String(text).split(/\s+/).filter(Boolean), out = [];
    let cur = '';
    words.forEach(wd => { const t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = wd; } else cur = t; });
    if (cur) out.push(cur);
    if (out.length > max) { out.length = max; out[max - 1] = out[max - 1].replace(/\s*\S*$/, '') + '…'; }
    return out;
  }
  function flagNO(ctx, x, y, w) {
    const h = w * 16 / 22;
    ctx.fillStyle = '#ba0c2f'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#fff'; ctx.fillRect(x + w * 6 / 22, y, w * 4 / 22, h); ctx.fillRect(x, y + h * 6 / 16, w, h * 4 / 16);
    ctx.fillStyle = '#00205b'; ctx.fillRect(x + w * 7 / 22, y, w * 2 / 22, h); ctx.fillRect(x, y + h * 7 / 16, w, h * 2 / 16);
  }
  /* ---------- the design on canvas: photo framing + effects (canvas filters, or by hand where they are missing), vignette, grain ---------- */
  let canFilterMemo = null;
  function canFilter() {
    if (canFilterMemo != null) return canFilterMemo;
    try { const c = document.createElement('canvas').getContext('2d'); c.filter = 'blur(2px)'; canFilterMemo = c.filter === 'blur(2px)'; } catch (e) { canFilterMemo = false; }
    return canFilterMemo;
  }
  /** px: one «cqi» (1 % of the card width) in canvas pixels — the blur looks the same as on the screen */
  function photoFilter(lk, th, z, px) {
    const f = [];
    if ((lk.grade || th.forceGrade) && th.grade && th.grade !== 'none') f.push(th.grade);
    if (z) {
      if (z.blur) f.push(`blur(${(z.blur * 0.18 * px).toFixed(1)}px)`);
      if (z.bright !== 100) f.push(`brightness(${z.bright / 100})`);
      if (z.contrast !== 100) f.push(`contrast(${z.contrast / 100})`);
      if (z.sat !== 100) f.push(`saturate(${z.sat / 100})`);
      if (z.sepia) f.push(`sepia(${z.sepia / 100})`);
      if (z.gray) f.push(`grayscale(${z.gray / 100})`);
    }
    return f.join(' ');
  }
  function pixelFx(ctx, x, y, w, h, z, px) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    if (z.blur) {
      const k = Math.max(2, z.blur * 0.18 * px / 2.2), t = document.createElement('canvas');
      t.width = Math.max(1, Math.round(w / k)); t.height = Math.max(1, Math.round(h / k));
      const tc = t.getContext('2d'); tc.imageSmoothingQuality = 'high'; tc.drawImage(ctx.canvas, x, y, w, h, 0, 0, t.width, t.height);
      ctx.save(); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(t, 0, 0, t.width, t.height, x, y, w, h); ctx.restore();
    }
    const b = z.bright / 100, c = z.contrast / 100, s = z.sat / 100, sp = z.sepia / 100, g = z.gray / 100;
    if (b === 1 && c === 1 && s === 1 && !sp && !g) return;
    let im; try { im = ctx.getImageData(x, y, w, h); } catch (e) { return; }
    const d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i] * b, gg = d[i + 1] * b, bb = d[i + 2] * b;
      r = (r - 128) * c + 128; gg = (gg - 128) * c + 128; bb = (bb - 128) * c + 128;
      let l = 0.2126 * r + 0.7152 * gg + 0.0722 * bb;
      r = l + (r - l) * s; gg = l + (gg - l) * s; bb = l + (bb - l) * s;
      if (sp) { const sr = r * 0.393 + gg * 0.769 + bb * 0.189, sg = r * 0.349 + gg * 0.686 + bb * 0.168, sb = r * 0.272 + gg * 0.534 + bb * 0.131; r += (sr - r) * sp; gg += (sg - gg) * sp; bb += (sb - bb) * sp; }
      if (g) { l = 0.2126 * r + 0.7152 * gg + 0.0722 * bb; r += (l - r) * g; gg += (l - gg) * g; bb += (l - bb) * g; }
      d[i] = r; d[i + 1] = gg; d[i + 2] = bb;
    }
    ctx.putImageData(im, x, y);
  }
  let grainCv = null;
  function grainTile() {
    if (grainCv) return grainCv;
    const c = document.createElement('canvas'); c.width = c.height = 160;
    const x = c.getContext('2d'), im = x.createImageData(160, 160);
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    x.putImageData(im, 0, 0);
    return (grainCv = c);
  }
  function overlaysOn(ctx, x, y, w, h, z) {
    if (z.vig) {
      const g = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.3, x + w / 2, y + h / 2, Math.hypot(w, h) / 2);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${(z.vig / 100 * 0.85).toFixed(3)})`);
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    }
    if (z.grain) { ctx.save(); ctx.globalAlpha = z.grain / 100 * 0.5; ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat'); ctx.fillRect(x, y, w, h); ctx.restore(); }
  }
  /** the photo in a box: cover + zoom around the focal point (the same maths as object-position + scale in CSS) */
  function drawPhoto(ctx, im, x, y, w, h, z, filter, px) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const k = Math.max(w / im.width, h / im.height) * zoomEff(z), dw = im.width * k, dh = im.height * k;
    const dx = x + z.ox / 100 * (w - dw), dy = y + z.oy / 100 * (h - dh);
    if (filter && canFilter()) ctx.filter = filter;
    ctx.drawImage(im, dx, dy, dw, dh);
    try { ctx.filter = 'none'; } catch (e) { /* ignore */ }
    ctx.restore();
    if (filter && !canFilter()) pixelFx(ctx, x, y, w, h, z, px);
  }
  const hexA = (h, a) => { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; };

  async function renderPng(card, fmt, withImage = true) {
    const lk = cardLook(card), sc = scope(lk), th = sc.th, p = parts(card);
    const hasZ = !!card.artDesign, z = dz(card);
    await fontReady(lk);
    const W = 1080, H = fmt === 'story' ? 1920 : 1080, story = fmt === 'story';
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const ac = lk.accent || th.accent, ink = lk.text || th.ink;
    // background
    let g = ctx.createLinearGradient(0, 0, W * 0.4, H);
    g.addColorStop(0, th.bg[0]); g.addColorStop(0.55, th.bg[1]); g.addColorStop(1, th.bg[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W * 0.8, H * 0.1, 10, W * 0.8, H * 0.1, W * 0.9);
    glow.addColorStop(0, ac + '55'); glow.addColorStop(1, ac + '00');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    // the card
    const cx = story ? 80 : 56, cy = story ? 250 : 56, cw = W - cx * 2, ch = story ? 1370 : H - 56 * 2 - 70;
    const paper = th.layout === 'paper', free = hasZ && z.pos, px = cw / 100, bd = hasZ ? bdOf(z, th) : '';
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24; rr(ctx, cx, cy, cw, ch, 56); ctx.fillStyle = th.paper || th.bg[1]; ctx.fill(); ctx.restore();
    ctx.save(); rr(ctx, cx, cy, cw, ch, 56); ctx.clip();
    if (paper && th.deco && th.deco !== 'news') { const d = await svgImg(decoSvg(th)); if (d) ctx.drawImage(d, cx, cy, cw, ch); }
    const headH = th.deco === 'news' ? Math.round(cw / 10) : 0;
    const my = cy + headH, mh = (paper && !free ? Math.round(ch * 0.64) : ch) - headH;
    let im = withImage && goodImg(card) ? await safeImg(card.image) : null;
    // 🎚 the photo settings: rotation, mirror, light and colour baked into the photo first (js/photofx.js)
    const pfx = im && card.imageFx && window.PhotoFxCore ? PhotoFxCore.of(card) : null;
    if (pfx) { try { const P = await PhotoFxCore.load(); im = (await P.bakeLook(im, pfx)) || im; } catch (e) { /* the photo as it is */ } }
    const filter = photoFilter(lk, th, hasZ ? z : null, px);
    if (im) {
      drawPhoto(ctx, im, cx, my, cw, mh, z, filter, px);
      if (lk.grade || th.forceGrade) { ctx.save(); ctx.globalAlpha = 0.18; ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = th.tint; ctx.fillRect(cx, my, cw, mh); ctx.restore(); }
    } else {
      const sImg = await svgImg(sceneSvg(hash(card.id || card.no), th, 600, Math.round(600 * mh / cw)));
      if (sImg) { ctx.save(); if (hasZ && filter && canFilter()) ctx.filter = filter; ctx.drawImage(sImg, cx, my, cw, mh); ctx.restore(); if (hasZ && filter && !canFilter()) pixelFx(ctx, cx, my, cw, mh, z, px); }
      const letter = (Array.from(p.word)[0] || '✦').toUpperCase();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `${sc.vars['--ac-style'] === 'italic' ? 'italic ' : ''}${sc.vars['--ac-weight']} ${Math.round(cw * 0.42)}px ${sc.font.canvas || sc.font.css || 'serif'}`;
      ctx.globalAlpha = 0.5; ctx.fillText(letter, cx + cw / 2, my + mh * 0.36); ctx.globalAlpha = 1;
    }
    if (hasZ) overlaysOn(ctx, cx, my, cw, mh, z);
    if (!paper && !bd) {
      const sg = ctx.createLinearGradient(0, cy + ch * 0.35, 0, cy + ch);
      sg.addColorStop(0, `rgba(${th.scrim},0)`); sg.addColorStop(0.45, `rgba(${th.scrim},.55)`); sg.addColorStop(1, `rgba(${th.scrim},.92)`);
      ctx.fillStyle = sg; ctx.fillRect(cx, cy, cw, ch);
    } else if (paper && !free && !(th.deco && th.deco !== 'news')) { ctx.fillStyle = th.paper; ctx.fillRect(cx, my + mh, cw, ch - mh - headH); }
    if (th.deco === 'news') {
      const hd = await svgImg(decoSvg(th, 'head')); if (hd) ctx.drawImage(hd, cx, cy, cw, headH);
      if (!free) { const co = await svgImg(decoSvg(th, 'cols')); if (co) ctx.drawImage(co, cx, cy + ch - cw / 6 - 14, cw, cw / 6); }
    }
    // ornaments: left corner (unless a strip is there), right corner mirrored (unless only one corner), the strip on top
    const orn = ornSvg(th, ac);
    if (orn) {
      const o = await svgImg(orn);
      if (o) { const s = cw * 0.24; if (!th.strip) ctx.drawImage(o, cx + 18, cy + 18 + headH, s, s); if (!th.orn1) { ctx.save(); ctx.translate(cx + cw - 18, cy + 18 + headH); ctx.scale(-1, 1); ctx.drawImage(o, 0, 0, s, s); ctx.restore(); } }
    }
    if (th.strip) { const o = await svgImg(stripSvg(th)); if (o) for (let x = cx; x < cx + cw; x += 300) ctx.drawImage(o, x, cy, 300, 90); }
    ctx.restore();
    // frame (rosemaling / accent)
    ctx.save(); rr(ctx, cx + (th.frame ? 14 : 0), cy + (th.frame ? 14 : 0), cw - (th.frame ? 28 : 0), ch - (th.frame ? 28 : 0), th.frame ? 44 : 56); ctx.lineWidth = th.frame ? 6 : 3; ctx.strokeStyle = th.frame ? ac : ac + '99'; ctx.stroke(); ctx.restore();

    // ---------- text: measured as a block, placed like on the screen (theme spot, or the card's own place + rotation) ----------
    const gk = GENDER[p.g];
    const fam = sc.font.canvas || sc.font.css || 'serif', wt = sc.vars['--ac-weight'], ital = sc.vars['--ac-style'] === 'italic' ? 'italic ' : '';
    const setF = (sz, w = wt, it = ital) => { ctx.font = `${it}${w} ${sz}px ${fam}`; };
    const track = sz => { try { ctx.letterSpacing = (lk.track / 100 * sz).toFixed(1) + 'px'; } catch (e) { /* old browser */ } };
    const noTrack = () => { try { ctx.letterSpacing = '0px'; } catch (e) { /* ignore */ } };
    const fx = fn => {
      ctx.save();
      if (lk.fx === 'shadow') { ctx.shadowColor = paper && !bd ? 'rgba(0,0,0,.18)' : 'rgba(0,0,0,.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4; }
      if (lk.fx === 'glow') { ctx.shadowColor = ac; ctx.shadowBlur = 34; }
      fn(); ctx.restore();
    };
    const sx = lk.width / 100, maxW = free ? cw * 0.82 : cw - 128;
    const word = th.upper ? p.word.toUpperCase() : p.word, tr = trText(card);
    const ex = (card.examples || [])[0] || (card.example ? { no: card.example } : null);
    const sep = free && z.trSep;
    const blockW = rs => Math.max(1, ...rs.map(r => r.w)), blockH = rs => rs.reduce((s, r) => s + r.h, 0);
    /** the text block at one size (the word, its chip, the translation, the example on stories) */
    const build = sz => {
      const rs = [];
      if (p.art) { ctx.font = `800 40px ${fam}`; noTrack(); rs.push({ k: 'chip', w: ctx.measureText(p.art).width + 44, h: 76 }); }
      setF(sz); track(sz);
      lines(ctx, word, maxW / sx, 3).forEach(l => rs.push({ k: 'word', l, w: ctx.measureText(l).width * sx, h: sz * 1.05 }));
      const ts = Math.max(40, Math.round(sz * 0.42));
      setF(ts, 600, ''); noTrack();
      const tRow = lines(ctx, tr, maxW, 2).slice(0, 1).map(l => ({ k: 'tr', l, w: ctx.measureText(l).width, h: ts * 1.7, ts }))[0];
      if (tRow && !sep) rs.push(tRow);
      if (story && ex && ex.no) { setF(38, 400, 'italic '); const el = lines(ctx, firstLine(ex.no), maxW, 2); rs.push({ k: 'ex', ls: el, w: Math.max(...el.map(l => ctx.measureText(l).width)), h: 70 + (el.length - 1) * 48 + 16 }); }
      return { rs, tRow, ts };
    };
    let size = Math.round(150 * lk.size / 100);
    setF(size); track(size);
    while (size > 44 && ctx.measureText(word).width * sx > maxW) { size -= 6; setF(size); track(size); }
    // the room the block has: the paper under the photo (minus the newspaper columns), or most of the card
    const room = free ? ch * 0.86 : paper ? (cy + ch) - (my + mh) - 60 - (th.deco === 'news' ? cw / 6 + 14 : 0) : ch * 0.6;
    let B = build(size);
    while (size > 44 && blockH(B.rs) > room) { size -= 6; B = build(size); }
    const rows = B.rs, trRow = B.tRow, trSize = B.ts;
    const bdc = a => (paper ? hexA(th.paper, a) : `rgba(${th.scrim},${a})`);
    const backdrop = (x, y, w, h) => {
      const pX = 34, pY = 24;
      if (bd === 'ribbon') { ctx.fillStyle = bdc(paper ? 0.84 : 0.62); ctx.fillRect(x - W * 2, y - pY, W * 4, h + pY * 2); }
      if (bd === 'plaque') {
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14; rr(ctx, x - pX, y - pY, w + pX * 2, h + pY * 2, 26); ctx.fillStyle = bdc(paper ? 0.93 : 0.8); ctx.fill(); ctx.restore();
        rr(ctx, x - pX, y - pY, w + pX * 2, h + pY * 2, 26); ctx.lineWidth = 3; ctx.strokeStyle = hexA(ac, 0.45); ctx.stroke();
      }
      if (bd === 'shadow') {
        ctx.save(); ctx.translate(x + w / 2, y + h / 2); const r = (h + 140) / 2; ctx.scale((w + 200) / (h + 140), 1);
        const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, r); rg.addColorStop(0, bdc(0.74)); rg.addColorStop(0.6, bdc(0.42)); rg.addColorStop(1, bdc(0));
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    };
    const drawRows = (rs, x0, y0, bw, al) => {
      let y = y0;
      rs.forEach(r => {
        const rx = al === 0 ? x0 : al === 1 ? x0 + (bw - r.w) / 2 : x0 + bw - r.w;
        if (r.k === 'chip') {
          ctx.save(); ctx.font = `800 40px ${fam}`; noTrack();
          rr(ctx, rx, y, r.w, 58, 29); ctx.fillStyle = gk ? gk.color : ac; ctx.fill();
          ctx.fillStyle = '#0b0d1d'; ctx.fillText(p.art, rx + 22, y + 42); ctx.restore();
        } else if (r.k === 'word') {
          const bl = y + size;
          setF(size); track(size); ctx.fillStyle = ink;
          fx(() => {
            ctx.save(); ctx.translate(rx, bl); ctx.scale(sx, 1);
            if (lk.fx === 'outline') { ctx.lineWidth = Math.max(3, size / 18); ctx.strokeStyle = paper ? '#ffffff' : 'rgba(0,0,0,.85)'; ctx.lineJoin = 'round'; ctx.strokeText(r.l, 0, 0); }
            ctx.fillText(r.l, 0, 0); ctx.restore();
          });
        } else if (r.k === 'tr') {
          setF(trSize, 600, ''); noTrack();
          fx(() => { ctx.fillStyle = ac; ctx.fillText(r.l, rx, y + trSize * 1.3); });
        } else if (r.k === 'ex') {
          setF(38, 400, 'italic '); noTrack(); ctx.fillStyle = paper ? ink : 'rgba(255,255,255,.9)'; ctx.globalAlpha = 0.9;
          r.ls.forEach((l, k) => { const lw = ctx.measureText(l).width, lx = al === 0 ? x0 : al === 1 ? x0 + (bw - lw) / 2 : x0 + bw - lw; ctx.fillText(l, lx, y + 60 + k * 48); });
          ctx.globalAlpha = 1;
        }
        y += r.h;
      });
    };
    const place = (rs, fx0, fy0, al, rot) => {
      const bw = blockW(rs), bh = blockH(rs);
      let x0, y0;
      if (free) { x0 = cx + 0.06 * cw + fx0 / 100 * (0.88 * cw - bw); y0 = cy + 0.06 * ch + fy0 / 100 * (0.88 * ch - bh); }
      else if (paper) { x0 = cx + 64; y0 = my + mh + 40; }
      else { x0 = cx + 64; y0 = cy + ch - 80 - bh; }
      ctx.save(); rr(ctx, cx, cy, cw, ch, 56); ctx.clip();
      if (rot) { const mx = x0 + bw / 2, mY = y0 + bh / 2; ctx.translate(mx, mY); ctx.rotate(rot * Math.PI / 180); ctx.translate(-mx, -mY); }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      if (bd) backdrop(x0, y0, bw, bh);
      drawRows(rs, x0, y0, bw, al);
      ctx.restore();
    };
    place(rows, z.x, z.y, free ? alignOf(z.x) : 0, hasZ ? z.rot : 0);
    if (sep && trRow) place([trRow], z.tx, z.ty, alignOf(z.tx), 0);
    // 📷 the photo's author and licence (CC BY / BY-SA ask for it wherever the picture goes)
    if (im && card.imageCredit) {
      ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; noTrack();
      ctx.font = `500 ${story ? 26 : 22}px system-ui, -apple-system, "Segoe UI", Arial, sans-serif`;
      const light = lum(th.bg[2]) > 0.35;
      ctx.fillStyle = light ? 'rgba(20,20,20,.72)' : 'rgba(255,255,255,.78)';
      let t = '📷 ' + String(card.imageCredit).slice(0, 220);
      if (ctx.measureText(t).width > cw - 20) { while (t.length > 8 && ctx.measureText(t + '…').width > cw - 20) t = t.slice(0, -1); t += '…'; }
      ctx.fillText(t, cx + 10, cy + ch + (story ? 44 : 30));
      ctx.restore();
    }
    // «Norsk Kort» mark
    const by = story ? H - 170 : H - 50;
    ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const brand = 'Norsk Kort'; ctx.font = `800 ${story ? 46 : 32}px system-ui, -apple-system, "Segoe UI", Arial, sans-serif`;
    const fw = story ? 52 : 36, bw = ctx.measureText(brand).width + fw + 18;
    const bx = story ? (W - bw) / 2 : W - 56 - bw;
    flagNO(ctx, bx, by - fw * 16 / 44, fw);
    ctx.fillStyle = '#ffffff'; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 10; ctx.fillText(brand, bx + fw + 18, by + 2);
    if (story) { ctx.font = '500 32px system-ui, -apple-system, "Segoe UI", Arial, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.textAlign = 'center'; ctx.fillText('норвежский ⇄ русский · флеш-карточки', W / 2, by + 62); }
    if (story) { ctx.font = `700 40px ${fam}`; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.textAlign = 'center'; ctx.fillText('Слово по-норвежски', W / 2, 150); }
    ctx.restore();
    // a canvas that a foreign picture has «tainted» can't be saved — then the same card without the photo
    try { return await new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('blob'))), 'image/png')); }
    catch (e) { if (withImage) return renderPng(card, fmt, false); throw e; }
  }
  const fileName = (card, fmt) => `norsk-kort-${firstLine(card.no).replace(/^(en|ei|et|å)\s+/i, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'kort'}-${fmt === 'story' ? '9x16' : '1x1'}.png`;
  function share(id) {
    const card = Store.card(id) || (DEMO.find(x => x.id === id));
    if (!card) return;
    let fmt = 'story', blob = null, url = '';
    const m = UI.modal({
      title: '📤 Поделиться карточкой', cls: 'art-share-modal',
      body: `<div class="seg ac-share-fmt" role="group" aria-label="Формат"><button class="active" data-fmt="story">📱 Сторис 9:16</button><button data-fmt="square">⬛ Квадрат</button></div>
        <div class="ac-share-prev" data-prev><span class="spinner"></span></div>
        <p class="small muted ac-share-note">На телефоне «Поделиться» откроет список приложений — Instagram, Telegram, Pinterest, WhatsApp… На компьютере картинка сохранится в «Загрузки».</p>`,
      foot: `<button class="btn" data-sh="pin" title="Pinterest">📌 В Pinterest</button><span class="grow"></span><button class="btn" data-sh="save">⬇️ Сохранить</button>${navigator.share ? '<button class="btn primary" data-sh="share">📤 Поделиться</button>' : ''}`,
      onClose: () => { if (url) URL.revokeObjectURL(url); },
    });
    const prev = m.$('[data-prev]');
    const make = async () => {
      prev.innerHTML = '<span class="spinner"></span><span class="small muted"> рисую…</span>';
      blob = null;
      try {
        blob = await renderPng(card, fmt);
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(blob);
        prev.innerHTML = `<img src="${url}" alt="Карточка «${esc(firstLine(card.no))}» картинкой" class="${fmt}">`;
      } catch (e) { prev.innerHTML = '<p class="small muted">Не получилось нарисовать картинку — попробуйте ещё раз чуть позже.</p>'; }
    };
    const save = () => { if (!blob) return; const a = document.createElement('a'); a.href = url; a.download = fileName(card, fmt); document.body.appendChild(a); a.click(); a.remove(); UI.toast('⬇️ Картинка сохранена', 'good', 1800); };
    const nativeShare = async () => {
      if (!blob) return false;
      const file = new File([blob], fileName(card, fmt), { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: firstLine(card.no), text: `${firstLine(card.no)} — ${trText(card)} · Norsk Kort` }); return true; }
        catch (e) { return e && e.name === 'AbortError'; }
      }
      return false;
    };
    m.el.addEventListener('click', async e => {
      const f = e.target.closest('[data-fmt]');
      if (f) { fmt = f.dataset.fmt; m.$$('[data-fmt]').forEach(b => b.classList.toggle('active', b === f)); make(); return; }
      const b = e.target.closest('[data-sh]'); if (!b) return;
      if (!blob) { UI.toast('Минутку — картинка ещё рисуется', '', 1500); return; }
      if (b.dataset.sh === 'save') save();
      if (b.dataset.sh === 'share') { if (!(await nativeShare())) save(); }
      if (b.dataset.sh === 'pin') {
        // phones: the share sheet has the Pinterest app; computers: save the picture + open Pinterest's «create a pin»
        if (await nativeShare()) return;
        save();
        window.open('https://www.pinterest.com/pin-builder/', '_blank', 'noopener');
        UI.toast('📌 Картинка сохранена — в открывшемся Pinterest нажмите «Загрузить» и выберите её', 'good', 6000);
      }
    });
    make();
    return m;
  }

  /* =====================================================================
   * 📌 PINTEREST — open the search, bring the picture back (paste / drop / link / file)
   * ===================================================================== */
  const IDEAS = [['🏔 Фьорды', 'norway fjord'], ['🌌 Северное сияние', 'nordlys'], ['🏡 Hytte', 'norsk hytte'], ['🌈 Bergen', 'Bergen Bryggen'], ['🇳🇴 17. mai', '17. mai bunad'], ['🎣 Lofoten', 'Lofoten'],
    ['🕯 Koselig', 'koselig hygge norsk'], ['🌷 Rosemaling', 'rosemaling'], ['❄️ Vinter', 'norsk vinter'], ['🥞 Норвежская еда', 'norsk mat'], ['⛪ Stavkirke', 'stavkirke'], ['🦌 Tromsø', 'Tromsø']];
  function ideasHtml() {
    return `<div class="ac-ideas">${IDEAS.map(([l, q]) => `<a class="ac-idea" href="${LIB_PIN(q)}" target="_blank" rel="noopener noreferrer">${esc(l)} <span aria-hidden="true">↗</span></a>`).join('')}</div>`;
  }
  function ideas() {
    UI.modal({ title: '📌 Норвежские идеи в Pinterest', cls: 'narrow ac-ideas-modal', body: `<p class="small muted">Вдохновение для карточек и колод — откроется в новой вкладке. Понравилась картинка? Её можно поставить на карточку: ✎ Изменить карточку → <b>📌 Pinterest</b>.</p>${ideasHtml()}` });
  }
  const pinQuery = word => { const w = firstLine(word).replace(/^(en|ei|et|å)\s+/i, '').slice(0, 60); return w ? `${w} norsk` : 'norge'; };
  function pinterestPick(opts = {}) {
    const q = pinQuery(opts.word || '');
    let chosen = null, opened = false;
    // the paste keys of this device: ⌘V on a Mac, Ctrl+V elsewhere; a phone pastes by a long press
    const touch = !!(window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches);
    const keys = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '') ? '⌘V' : 'Ctrl+V';
    const pasteHow = touch ? 'долгое нажатие на поле ссылки ниже → «Вставить»' : `<kbd>${keys}</kbd>`;
    const m = UI.modal({
      title: '📌 Картинка из Pinterest', cls: 'art-pin-modal',
      body: `<ol class="ac-steps">
          <li data-step="1"><a class="btn primary" href="${LIB_PIN(q)}" target="_blank" rel="noopener noreferrer" data-pin-open>📌 Открыть Pinterest: «${esc(q)}» ↗</a></li>
          <li data-step="2">${touch ? 'Удерживайте палец на понравившейся картинке' : 'Правый клик по понравившейся картинке'} → <b>«Скопировать изображение»</b> (или <b>«Скопировать адрес изображения»</b>).</li>
          <li data-step="3">Вернитесь сюда и вставьте: ${touch ? pasteHow + ' или кнопка «📋 Вставить из буфера»' : `${pasteHow} в этом окне, кнопка «📋 Вставить из буфера» или перетащите картинку в рамку`}.</li></ol>
        <div class="ac-drop" tabindex="0" data-drop aria-label="Сюда можно вставить или перетащить картинку" aria-live="polite">
          <div data-drop-in><span class="ac-drop-ico" aria-hidden="true">🖼</span><span>${touch ? 'Скопированная картинка появится здесь' : `Вставьте (${esc(keys)}) или перетащите картинку сюда`}</span></div></div>
        <div class="row ac-pin-row"><button class="btn" data-pin="paste">📋 Вставить из буфера</button><label class="btn">📁 Файл с устройства<input type="file" accept="image/*" data-pin-file hidden></label></div>
        <div class="row ac-pin-row"><input class="input grow" data-pin-url placeholder="или ссылка на картинку: https://i.pinimg.com/…" inputmode="url" autocomplete="off"><button class="btn" data-pin="url">Взять</button></div>
        <details class="ac-pin-ideas"><summary>🇳🇴 Норвежские идеи в Pinterest</summary>${ideasHtml()}</details>
        <p class="tiny muted">Pinterest не даёт приложениям искать картинки за вас — поэтому поиск открывается у них на сайте, а картинку вы приносите сами. Используйте картинки для личного обучения.</p>`,
      foot: '<button class="btn ghost" data-pin="cancel">Отмена</button><button class="btn primary" data-pin="ok" disabled>✓ Поставить на карточку</button>',
      onClose: () => { document.removeEventListener('paste', onPaste); window.removeEventListener('focus', onBack); document.removeEventListener('visibilitychange', onBack); },
    });
    const zone = m.$('[data-drop-in]'), ok = m.$('[data-pin="ok"]');
    // back from the Pinterest tab: step 3 lights up and the frame waits for the paste
    const onBack = () => {
      if (!opened || chosen || document.hidden || !document.body.contains(m.el)) return;
      m.$$('[data-step]').forEach(li => li.classList.toggle('ac-step-now', li.dataset.step === '3'));
      m.$('[data-drop]').classList.add('ac-drop-wait');
      zone.innerHTML = `<span class="ac-drop-ico" aria-hidden="true">📋</span><span><b>Теперь вставьте картинку:</b> ${pasteHow}</span>`;
      if (!touch) m.$('[data-drop]').focus({ preventScroll: true });
    };
    window.addEventListener('focus', onBack);
    document.addEventListener('visibilitychange', onBack);
    m.$('[data-pin-open]').addEventListener('click', () => { opened = true; m.$$('[data-step]').forEach(li => li.classList.toggle('ac-step-now', li.dataset.step === '2')); });
    const show = (src, note) => { chosen = src; m.$('[data-drop]').classList.remove('ac-drop-wait'); m.$$('[data-step]').forEach(li => li.classList.remove('ac-step-now')); zone.innerHTML = `<img src="${esc(src)}" alt="Выбранная картинка">${note ? `<span class="small muted">${note}</span>` : ''}`; ok.disabled = false; };
    const kind = msg => { zone.innerHTML = `<span class="ac-drop-ico" aria-hidden="true">💡</span><span>${msg}</span>`; ok.disabled = true; chosen = null; };
    const fromFile = async f => {
      if (!f || !/^image\//.test(f.type) || /svg/i.test(f.type)) { kind('Это не картинка — подойдут JPG, PNG, WebP или GIF.'); return; }
      zone.innerHTML = '<span class="spinner"></span>';
      try { show(await U.compressImage(f, 900, 0.86)); } catch (e) { kind('Эту картинку не получилось открыть — попробуйте другую.'); }
    };
    const fromUrl = async raw => {
      const u = String(raw || '').trim();
      if (!u) return;
      if (!/^https:\/\//i.test(u)) { kind('Нужна ссылка, которая начинается с https://'); return; }
      if (/pinterest\.[a-z.]+\/pin\/|pin\.it\//i.test(u)) { kind('Это ссылка на страницу пина, а не на саму картинку. Откройте пин, нажмите на картинку → «Скопировать изображение» (или «адрес изображения») — и вставьте сюда.'); return; }
      if (/\.svg(\?|#|$)/i.test(u)) { kind('Картинки SVG не подходят — выберите JPG, PNG или WebP.'); return; }
      zone.innerHTML = '<span class="spinner"></span>';
      try { await Images.preload(u, 20000); } catch (e) { kind('По этой ссылке картинка не открылась. Скопируйте саму картинку и вставьте её.'); return; }
      // stored inside the card when the site allows copying; otherwise the https link (Store.Safe.image keeps https)
      let data = '';
      try { data = await U.compressImage(u, 900, 0.86); } catch (e) { data = ''; }
      show(data || u, data ? '' : 'Картинка будет загружаться по ссылке (сайт не разрешает сохранить копию).');
    };
    const onPaste = e => {
      if (!document.body.contains(m.el)) return;
      const items = [...((e.clipboardData && e.clipboardData.items) || [])];
      const img = items.find(it => it.kind === 'file' && /^image\//.test(it.type));
      if (img) { e.preventDefault(); fromFile(img.getAsFile()); return; } // also into the link field (a phone pastes there)
      const t = e.target; if (t && t.matches && t.matches('[data-pin-url]')) { setTimeout(() => { const v = t.value.trim(); if (/^https:\/\//i.test(v)) fromUrl(v); }, 0); return; }
      const txt = e.clipboardData && e.clipboardData.getData('text/plain');
      if (txt) { e.preventDefault(); m.$('[data-pin-url]').value = txt.trim(); fromUrl(txt); }
    };
    document.addEventListener('paste', onPaste);
    const drop = m.$('[data-drop]');
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); drop.classList.add('over'); }));
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation(); drop.classList.remove('over');
      const f = e.dataTransfer && [...e.dataTransfer.files].find(x => /^image\//.test(x.type));
      if (f) { fromFile(f); return; }
      const u = e.dataTransfer && (e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain'));
      if (u) fromUrl(u.split('\n').find(s => s && !s.startsWith('#')));
    });
    m.$('[data-pin-file]').onchange = e => fromFile(e.target.files[0]);
    m.$('[data-pin-url]').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fromUrl(e.target.value); } });
    m.el.addEventListener('click', async e => {
      const b = e.target.closest('[data-pin]'); if (!b) return;
      switch (b.dataset.pin) {
        case 'cancel': m.close(); break;
        case 'url': fromUrl(m.$('[data-pin-url]').value); break;
        case 'paste': {
          try {
            if (navigator.clipboard && navigator.clipboard.read) {
              const items = await navigator.clipboard.read();
              for (const it of items) { const t = it.types.find(x => /^image\/(png|jpe?g|webp|gif)/.test(x)); if (t) { fromFile(new File([await it.getType(t)], 'pin.' + t.split('/')[1], { type: t })); return; } }
            }
            const txt = navigator.clipboard && navigator.clipboard.readText ? await navigator.clipboard.readText() : '';
            if (txt) { m.$('[data-pin-url]').value = txt.trim(); fromUrl(txt); } else kind('В буфере пока нет картинки. Скопируйте её в Pinterest и вернитесь.');
          } catch (err) { kind('Браузер не дал прочитать буфер — нажмите ⌘V / Ctrl+V (на телефоне: долгое нажатие на поле ссылки → «Вставить»).'); }
          break;
        }
        case 'ok': if (chosen) { const src = chosen; m.close(); opts.onPick && opts.onPick(src); } break;
      }
    });
    setTimeout(() => drop.focus({ preventScroll: true }), 80);
    return m;
  }

  /* =====================================================================
   * ✥ DESIGN EDITOR of one card — like a story / photo editor:
   *   drag the word anywhere (mouse / touch / pen; arrows on the keyboard), 9 quick places, rotation, size,
   *   backdrop under the text, photo effects (blur, brightness, contrast, saturation, vignette, grain, sepia, b/w),
   *   framing (drag the photo, zoom, focal point), the card's own template / font / colours;
   *   ↶ ↷ for every step (Ctrl/⌘+Z, Shift+Ctrl/⌘+Z), «↺ Сбросить», live preview, save, «Сохранить изменения?».
   * Translation: by default it follows the word (one block — the pair is always read together); «Отдельно» gives it
   * its own place, without rotation (a calm caption next to a tilted word reads best).
   * «📋 На всю колоду»: only the style, or the style + the word's place; the framing of each photo stays its own.
   * ===================================================================== */
  const QUICK = [
    ['read', '✨ Текст читаемый', { blur: 6, bright: 82, vig: 30 }],
    ['film', '🎞 Старая плёнка', { grain: 45, sepia: 30, contrast: 108, vig: 35, sat: 85 }],
    ['bw', '⚫ Чёрно-белое', { gray: 100, contrast: 118 }],
    ['warm', '🌅 Тёплый свет', { sepia: 22, sat: 118, bright: 104 }],
    ['none', '⟲ Без эффектов', {}],
  ];
  const FX_KEYS = ['blur', 'bright', 'contrast', 'sat', 'vig', 'grain', 'sepia', 'gray'];
  const POS9 = [[0, 0, '↖', 'Вверху слева'], [50, 0, '↑', 'Вверху по центру'], [100, 0, '↗', 'Вверху справа'], [0, 50, '←', 'Посередине слева'], [50, 50, '•', 'В центре'],
    [100, 50, '→', 'Посередине справа'], [0, 100, '↙', 'Внизу слева'], [50, 100, '↓', 'Внизу по центру'], [100, 100, '↘', 'Внизу справа']];
  const BDS = [['', 'Как в шаблоне'], ['none', 'Без подложки'], ['ribbon', 'Лента'], ['plaque', 'Табличка'], ['shadow', 'Мягкая тень']];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const UNDO_SVG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
  const posText = (x, y) => `${Math.round(x)}% слева, ${Math.round(y)}% сверху`;

  function designer(id, opts = {}) {
    const c0 = Store.card(id); if (!c0) return null;
    ensureFonts();
    const base = look(), bsc = scope(base);
    const PIC = ['image', 'imageCredit', 'imageCreditUrl', 'imageSrc'];
    const pic0 = {}; PIC.forEach(k => { pic0[k] = c0[k] || ''; });
    // fx: the photo settings (card.imageFx — js/photofx.js); a draft here, stored with «💾 Сохранить»
    let fx0 = c0.imageFx ? JSON.parse(JSON.stringify(c0.imageFx)) : null;
    let d = { z: dz(c0), pic: Object.assign({}, pic0), fx: fx0 };
    const snap = () => JSON.stringify({ z: dzSafe(d.z), pic: d.pic, fx: d.fx });
    let savedSnap = snap(), hist = [savedSnap], hi = 0, tab = opts.tab || 'word', side = 'tile', kt = 0, drag = null, snapV = false, snapH = false;
    const pointers = new Map();
    const cur = () => Store.card(id) || c0;
    const tmp = () => Object.assign({}, cur(), d.pic, { artDesign: Object.assign({}, d.z), imageFx: d.fx });
    const TABS = [['word', '✥ Слово'], ['photo', '🖼 Фото и эффекты'], ['style', '🎨 Стиль']];
    const m = UI.modal({
      title: '🎨 Дизайн карточки', cls: 'wide art-ed-modal',
      body: `<div class="ac-ed">
        <div class="ac-ed-prevcol">
          <div class="ac-ed-side" role="group" aria-label="Какую сторону показать"><button type="button" class="on" data-ed-side="tile" aria-pressed="true">Лицо с переводом</button><button type="button" data-ed-side="back" aria-pressed="false">Оборот</button></div>
          <div class="ac-ed-stage ${bsc.cls}" style="${bsc.style}" data-ed-stage></div>
          <p class="ac-ed-hint"><span aria-hidden="true">✋</span><span class="ac-ed-long"> Двигайте слово прямо на карточке — мышью, пальцем или пером. Фото тоже можно сдвинуть.</span><span class="ac-ed-short"> Двигайте слово и фото пальцем</span><span class="ac-ed-kbd"> С клавиатуры: Tab до слова, затем стрелки (с Shift — шагами побольше).</span></p>
          <p class="ac-sr" aria-live="polite" data-ed-live></p>
        </div>
        <div class="ac-ed-ctl">
          <div class="ac-ed-tabs" role="tablist" aria-label="Что настраиваем">${TABS.map(([k, l]) => `<button type="button" role="tab" data-ed-tab="${k}" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
          <div class="ac-ed-pane" role="tabpanel" data-ed-pane></div>
        </div></div>`,
      foot: `<button type="button" class="btn ac-ed-ur" data-ed="undo" aria-label="Отменить" title="Отменить · Ctrl+Z (⌘Z)">${UNDO_SVG}</button><button type="button" class="btn ac-ed-ur" data-ed="redo" aria-label="Повторить" title="Повторить · Ctrl+Shift+Z (⇧⌘Z)">${UNDO_SVG.replace('<svg ', '<svg style="transform:scaleX(-1)" ')}</button>
        <button type="button" class="btn ghost ac-ed-reset" data-ed="reset" aria-label="Сбросить оформление карточки" title="Убрать всё своё оформление этой карточки (фото останется)"><span aria-hidden="true">↺</span><span class="ac-ed-lbl"> Сбросить оформление карточки</span></button>
        <span class="grow"></span>
        <button type="button" class="btn ac-ed-deck" data-ed="deck" aria-label="Применить ко всей колоде" title="Скопировать этот дизайн на другие карточки колоды"><span aria-hidden="true">📋</span><span class="ac-ed-lbl"> На всю колоду…</span></button>
        <button type="button" class="btn ghost ac-ed-cancel" data-ed="cancel">Отмена</button>
        <button type="button" class="btn primary" data-ed="save">💾 Сохранить</button>`,
      beforeClose: UI.guard(() => (snap() === savedSnap ? null : {
        title: 'Сохранить изменения?', line: 'Оформление этой карточки ещё не сохранено.',
        actions: [{ label: '💾 Сохранить', value: 'save', cls: 'primary' }, { label: 'Не сохранять', value: 'drop', cls: 'bad' }], cancel: 'Отмена',
        act: v => { if (v === 'save') { doSave(); UI.toast('🎨 Дизайн карточки сохранён', 'good', 1800); } return true; },
      })),
      onClose: () => { document.removeEventListener('keydown', onKey, true); clearTimeout(kt); },
    });
    m.el.parentElement.classList.add('ac-ed-bd');
    const stage = m.$('[data-ed-stage]'), pane = m.$('[data-ed-pane]'), live = m.$('[data-ed-live]');
    const say = t => { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 40); };
    const cardEl = () => stage.querySelector('.ac-card');
    const baseCls = () => (side === 'tile' ? 'ac-card ac-edcard' : 'ac-card ac-fill ac-back ac-edcard');

    /* ---------- preview ---------- */
    function labelBlocks() {
      stage.querySelectorAll('[data-dz]').forEach(b => {
        const tr = b.dataset.dz === 'tr', x = tr ? d.z.tx : d.z.x, y = tr ? d.z.ty : d.z.y;
        b.setAttribute('aria-label', `${tr ? 'Перевод' : 'Слово'} на карточке. ${d.z.pos ? 'Место: ' + posText(x, y) : 'Место как в шаблоне'}. Стрелки — двигать, с Shift — быстрее.`);
      });
    }
    function renderStage() {
      const t = tmp();
      stage.innerHTML = side === 'tile' ? tileHtml(t, 0, 1.33, base, { overlays: true, eager: true }) : faceHtml(t, 'back', 'no', { base, overlays: true });
      const el = cardEl(); if (!el) return;
      ['role', 'tabindex', 'aria-label'].forEach(a => el.removeAttribute(a));
      el.querySelectorAll('.ac-i, .ac-tools').forEach(x => x.remove());
      el.insertAdjacentHTML('beforeend', '<i class="ac-guide ac-guide-v" aria-hidden="true"></i><i class="ac-guide ac-guide-h" aria-hidden="true"></i>');
      el.querySelectorAll('[data-dz]').forEach(b => { b.tabIndex = 0; b.setAttribute('role', 'button'); b.setAttribute('aria-roledescription', 'перемещаемый блок'); });
      paint();
      fontReady(cardLook(t, base));
    }
    /** quick redraw for sliders / dragging: only the classes and CSS variables of the card */
    function paint() {
      const el = cardEl(); if (!el) return;
      const cs = cardScope(tmp(), base);
      el.className = `${baseCls()} ${cs.cls}${drag ? ' ac-dragging' : ''}${snapV ? ' ac-snap-v' : ''}${snapH ? ' ac-snap-h' : ''}`;
      el.setAttribute('style', cs.style || '');
      labelBlocks();
    }

    /* ---------- the controls ---------- */
    const rng = (k, label, min, max, step, unit, val) => `<label class="ac-range ac-ed-range"><span>${label} <b data-edv="${k}">${val}${unit}</b></span><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-ed-range="${k}" data-unit="${unit}" data-k="r:${k}"></label>`;
    const seg = (k, list, curV, label) => `<div class="ac-ed-seg" role="group" aria-label="${label}">${list.map(([v, l]) => `<button type="button" data-ed-set="${k}" data-v="${v}" data-k="s:${k}:${v}" aria-pressed="${curV === v}" class="${curV === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    function paneWord() {
      const z = d.z, t = tmp(), eff = cardLook(t, base), th = theme(eff.theme);
      const on = (x, y) => z.pos && z.x === x && z.y === y;
      return `<section class="ac-ed-sec"><h4>Где слово</h4>
          <div class="ac-ed-pos"><div class="ac-ed-grid" role="group" aria-label="Быстрое место для слова">${POS9.map(([x, y, ic, l]) => `<button type="button" data-ed-pos="${x},${y}" data-k="p:${x},${y}" aria-label="${l}" title="${l}" aria-pressed="${on(x, y)}" class="${on(x, y) ? 'on' : ''}">${ic}</button>`).join('')}</div>
          <div class="ac-ed-posside"><button type="button" class="ac-ed-chip ${!z.pos ? 'on' : ''}" data-ed-pos="auto" data-k="p:auto" aria-pressed="${!z.pos}">✦ Как в шаблоне</button>
          <p class="small muted">Или перетащите слово прямо на карточке. По центру оно «прилипает» само.</p></div></div></section>
        <section class="ac-ed-sec">${rng('rot', 'Поворот', -30, 30, 1, '°', z.rot)}<div class="ac-ed-mini"><button type="button" class="ac-ed-chip" data-ed-nudge="rot:-5" data-k="n:rot-">↺ −5°</button><button type="button" class="ac-ed-chip" data-ed-def="rot" data-k="d:rot">0°</button><button type="button" class="ac-ed-chip" data-ed-nudge="rot:5" data-k="n:rot+">↻ +5°</button></div>
          ${rng('size', 'Размер слова', 50, 220, 5, '%', z.size || eff.size)}<div class="ac-ed-mini"><button type="button" class="ac-ed-chip ${!z.size ? 'on' : ''}" data-ed-def="size" data-k="d:size" aria-pressed="${!z.size}">Как в шаблоне</button></div></section>
        <section class="ac-ed-sec"><h4>Подложка под текстом</h4>${seg('bd', BDS, z.bd, 'Подложка под текстом')}
          <p class="small muted">${th.layout === 'paper' && !z.pos ? 'В этом шаблоне слово стоит на бумаге под фото — подложка нужна, когда слово окажется на самом фото.' : 'Лента и табличка делают текст читаемым на любом фото; «Как в шаблоне» — мягкое затемнение снизу.'}</p></section>
        <section class="ac-ed-sec"><h4>Перевод</h4>${seg('trSep', [['0', 'Вместе со словом'], ['1', 'Отдельно — двигается сам']], z.trSep ? '1' : '0', 'Перевод')}
          <p class="small muted">Вместе — перевод всегда под словом. Отдельно — его можно поставить куда угодно (без поворота, чтобы легко читался).</p></section>`;
    }
    function panePhoto() {
      const z = d.z, t = tmp(), img = goodImg(t);
      const fxSec = `<section class="ac-ed-sec"><h4>Кадр, поворот, свет и цвет</h4>${img ? `<div class="ac-ed-btns"><button type="button" class="btn primary" data-ed-fx="1" data-k="f:fx" title="Как в камере телефона: сдвиг и масштаб кадра, поворот, зеркало, яркость, контраст, тепло, готовые стили">🎚 Настроить фото</button><button type="button" class="ac-ed-chip" data-ed-def="frame" data-k="d:frame" title="Фото снова по центру, без приближения">⊙ Кадр по центру</button></div>
          <p class="small muted">Кадр можно двигать и прямо на карточке: перетащите фото; на телефоне раздвиньте двумя пальцами, чтобы приблизить.</p>` : '<p class="small muted">Настроить кадр и цвет можно, когда у карточки есть фото.</p>'}</section>`;
      return `<section class="ac-ed-sec"><h4>Фото</h4>
          <div class="ac-ed-photo">${img ? `<img src="${esc(t.image)}" alt="Фото карточки">` : '<span class="ac-ed-nophoto" aria-hidden="true">🏔</span>'}<div class="ac-ed-photo-t">${img ? (creditHtml(t, 'ac-credit') || '<p class="small muted">Своё фото</p>') : '<p class="small muted">Нет фото — на карточке рисунок шаблона.</p>'}</div></div>
          <div class="ac-ed-btns"><button type="button" class="btn" data-ed-pic="pin" data-k="f:pin" title="Галерея картинок, как в Pinterest: фото по слову и норвежским темам">📌 Галерея картинок</button><button type="button" class="btn" data-ed-pic="hist" data-k="f:hist">🏛 Исторические фото Норвегии</button><button type="button" class="btn" data-ed-pic="file" data-k="f:file">📁 С устройства</button>${img ? '<button type="button" class="btn ghost" data-ed-pic="none" data-k="f:none">✕ Без фото</button>' : ''}</div></section>
        ${fxSec}
        <section class="ac-ed-sec"><h4>Быстрые эффекты</h4><div class="ac-ed-btns">${QUICK.map(([k, l]) => `<button type="button" class="ac-ed-chip" data-ed-q="${k}" data-k="q:${k}">${l}</button>`).join('')}</div></section>
        <section class="ac-ed-sec"><h4>Эффекты для дизайна</h4><p class="small muted">Ложатся поверх настроек самого фото — например, размытие, чтобы надпись читалась.</p>
          ${rng('blur', 'Размытие — чтобы текст читался', 0, 20, 1, '', z.blur)}${rng('bright', 'Яркость (меньше — темнее)', 40, 160, 2, '%', z.bright)}${rng('contrast', 'Контраст', 50, 160, 2, '%', z.contrast)}
          ${rng('sat', 'Насыщенность', 0, 200, 5, '%', z.sat)}${rng('vig', 'Виньетка — тёмные края', 0, 100, 5, '%', z.vig)}${rng('grain', 'Зерно плёнки', 0, 100, 5, '%', z.grain)}
          ${rng('sepia', 'Сепия', 0, 100, 5, '%', z.sepia)}${rng('gray', 'Чёрно-белое', 0, 100, 5, '%', z.gray)}</section>`;
    }
    function paneStyle() {
      const z = d.z, bth = theme(base.theme);
      const thb = (v, t, label, small) => `<button type="button" class="ac-thb ${z.theme === v ? 'on' : ''}" data-ed-set="theme" data-v="${v}" data-k="s:theme:${v}" aria-pressed="${z.theme === v}" style="--b1:${t.bg[0]};--b2:${t.bg[1]};--b3:${t.bg[2]};--a:${t.accent}"><i aria-hidden="true">${t.icon}</i><span>${esc(label)}</span>${small ? `<small>${esc(small)}</small>` : ''}</button>`;
      const fb = (v, f, label) => `<button type="button" class="ac-fb-btn ${z.font === v ? 'on' : ''}" data-ed-set="font" data-v="${v}" data-k="s:font:${v}" aria-pressed="${z.font === v}" ${f && f.css ? `style="font-family:${esc(f.css)}"` : ''}><span>${esc(label)}</span><small>Fjord · Фьорд${f && f.note ? ' · ' + esc(f.note) : ''}</small></button>`;
      const sws = k => `<div class="ac-sws"><button type="button" class="ac-auto ${!z[k] ? 'on' : ''}" data-ed-set="${k}" data-v="" data-k="s:${k}:" aria-pressed="${!z[k]}">Как у всех</button>${PALETTE.map(c => `<button type="button" class="ac-sw ${z[k] === c ? 'on' : ''}" data-ed-set="${k}" data-v="${c}" data-k="s:${k}:${c}" style="--c:${c}" aria-label="Цвет ${c}" aria-pressed="${z[k] === c}"></button>`).join('')}<label class="ac-pick" title="Свой цвет"><input type="color" value="${z[k] || '#ffffff'}" data-ed-color="${k}" data-k="c:${k}"><span>🎨 Свой</span></label></div>`;
      return `<section class="ac-ed-sec"><h4>Шаблон этой карточки</h4><div class="ac-themes">${thb('', bth, 'Как у всех', bth.name)}${Object.keys(THEMES).map(k => thb(k, THEMES[k], THEMES[k].name, THEMES[k].when || '')).join('')}</div></section>
        <section class="ac-ed-sec"><h4>Шрифт <small class="muted">— все с кириллицей и æ ø å</small></h4><div class="ac-fonts">${fb('', null, 'Как у всех')}${FONTS.filter(f => f.id !== 'theme').map(f => fb(f.id, f, f.name)).join('')}</div></section>
        <section class="ac-ed-sec"><h4>Цвет слова</h4>${sws('text')}</section>
        <section class="ac-ed-sec"><h4>Акцент <small class="muted">— перевод, рамка, свечение</small></h4>${sws('accent')}</section>
        <section class="ac-ed-sec"><h4>Обводка и тень</h4>${seg('fx', [['', 'Как у всех'], ['none', 'Нет'], ['shadow', 'Мягкая тень'], ['outline', 'Контур'], ['glow', 'Свечение']], z.fx, 'Обводка и тень')}</section>`;
    }
    function renderPane() {
      const f = document.activeElement, key = f && pane.contains(f) ? f.dataset.k : '';
      pane.innerHTML = tab === 'photo' ? panePhoto() : tab === 'style' ? paneStyle() : paneWord();
      m.$$('[data-ed-tab]').forEach(b => { const on = b.dataset.edTab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
      if (key) { const n = pane.querySelector(`[data-k="${CSS.escape(key)}"]`); if (n) n.focus({ preventScroll: true }); }
    }

    /* ---------- history ---------- */
    function urBtns() { m.$('[data-ed="undo"]').disabled = hi <= 0; m.$('[data-ed="redo"]').disabled = hi >= hist.length - 1; }
    function commit() {
      const s = snap(); if (s === hist[hi]) return;
      hist = hist.slice(0, hi + 1); hist.push(s);
      if (hist.length > 150) hist.shift();
      hi = hist.length - 1; urBtns();
    }
    function restore(s) { const o = JSON.parse(s); d = { z: Object.assign({}, DZ0, o.z || {}), pic: Object.assign({}, o.pic), fx: o.fx || null }; renderStage(); renderPane(); urBtns(); }
    function undo() { if (hi <= 0) { say('Отменять больше нечего'); return; } hi--; restore(hist[hi]); say('↶ Отменено'); }
    function redo() { if (hi >= hist.length - 1) { say('Повторять нечего'); return; } hi++; restore(hist[hi]); say('↷ Повторено'); }
    const change = () => { renderStage(); renderPane(); commit(); };

    /* ---------- save · reset · the whole deck ---------- */
    function doSave() {
      const patch = { artDesign: dzSafe(d.z) };
      if (PIC.some(k => d.pic[k] !== pic0[k])) {
        Object.assign(patch, d.pic, { imageAuto: false, imageNone: d.pic.image ? '' : (window.Images && Images.noneKey ? Images.noneKey(cur()) : '') });
        Object.assign(pic0, d.pic);
      }
      if (JSON.stringify(d.fx) !== JSON.stringify(fx0)) { patch.imageFx = d.fx; fx0 = d.fx; }
      Store.updateCard(id, patch);
      savedSnap = snap();
      afterEdit(id);
      if (opts.onSaved) { try { opts.onSaved(); } catch (e) { /* the window behind may be gone */ } }
    }
    function applyDeck() {
      const me = cur(), deck = Store.deck(me.deckId), others = Store.cards(me.deckId).filter(c => c.id !== id);
      if (!others.length) { UI.toast('В этой колоде пока нет других карточек', 'warn', 2400); return; }
      const own = others.filter(c => c.artDesign).length;
      let mode = 'style', keep = false;
      const m2 = UI.modal({
        title: '📋 Дизайн на всю колоду', cls: 'narrow ac-apply-modal',
        body: `<p class="small muted">Оформление этой карточки встанет на другие карточки колоды${deck ? ` «${esc(deck.name)}»` : ''}.</p>
          <div class="ac-apply-opts" role="radiogroup" aria-label="Что применить">
            <label class="ac-apply-opt"><input type="radio" name="ac-apply" value="style" checked><span><b>🎨 Только стиль</b><small>Шаблон, шрифт, цвета, подложка и эффекты фото. Слово на каждой карточке остаётся на своём месте.</small></span></label>
            <label class="ac-apply-opt"><input type="radio" name="ac-apply" value="all"><span><b>🎨 Стиль + ✥ место слова</b><small>Ещё место, поворот и размер слова (и перевода) — все карточки будут свёрстаны одинаково.</small></span></label>
          </div>
          <label class="switch ac-apply-keep"><input type="checkbox" data-ap-keep><span class="track"></span><span>Не трогать карточки со своим дизайном ${own ? `<small class="muted">(${U.cards(own)})</small>` : '<small class="muted">(сейчас таких нет)</small>'}</span></label>
          <p class="small muted">Кадр фото (сдвиг и масштаб) у каждой карточки остаётся своим — фото ведь разные. Сразу после применения можно нажать «↶ Отменить».</p>
          <p class="ac-apply-count" data-ap-count aria-live="polite"></p>`,
        foot: '<button type="button" class="btn ghost" data-ap="cancel">Отмена</button><button type="button" class="btn primary" data-ap="ok"></button>',
      });
      const ok = m2.$('[data-ap="ok"]');
      const targets = () => others.filter(c => !(keep && c.artDesign));
      const upd = () => { const n = targets().length; m2.$('[data-ap-count]').textContent = n ? `Изменится: ${U.cards(n)} из ${others.length}` : 'Все остальные карточки уже со своим дизайном — менять нечего.'; ok.textContent = n ? `Применить · ${U.cards(n)}` : 'Нечего менять'; ok.disabled = !n; };
      m2.el.addEventListener('change', e => { if (e.target.name === 'ac-apply') mode = e.target.value; if (e.target.matches('[data-ap-keep]')) keep = e.target.checked; upd(); });
      m2.el.addEventListener('click', e => {
        const b = e.target.closest('[data-ap]'); if (!b) return;
        if (b.dataset.ap === 'cancel') { m2.close(); return; }
        const list = targets(); if (!list.length) return;
        doSave();
        const src = Object.assign({}, d.z), before = [];
        list.forEach(c => {
          before.push([c.id, c.artDesign ? JSON.parse(JSON.stringify(c.artDesign)) : null]);
          const nz = Object.assign({}, DZ0, c.artDesign || {});
          STYLE_KEYS.forEach(k => { nz[k] = src[k]; });
          if (mode === 'all') PLACE_KEYS.forEach(k => { nz[k] = src[k]; });
          Store.updateCard(c.id, { artDesign: dzSafe(nz) });
        });
        m2.close(); m.close();
        refreshArt();
        UI.toastAction(`Дизайн применён: ${U.cards(before.length)}`, '↶ Отменить', () => {
          before.forEach(([cid, z]) => { if (Store.card(cid)) Store.updateCard(cid, { artDesign: z }); });
          refreshArt();
          UI.toast('↶ Вернули прежний дизайн карточек', 'good', 2200);
        }, 12000, '🎨');
      });
      upd();
    }

    /* ---------- 🎚 the photo editor (js/photofx.js): the same frame as here (d.z zoom / ox / oy) + the photo's own settings ---------- */
    function openFx() {
      const t = tmp(); if (!goodImg(t) || !window.PhotoFxCore) return;
      const med = stage.querySelector('.ac-media'), r = med && med.getBoundingClientRect();
      PhotoFxCore.open(id, {
        draft: { image: t.image, fx: d.fx, frame: { ar: r && r.width && r.height ? r.width / r.height : 0.75, zoom: d.z.zoom, ox: d.z.ox, oy: d.z.oy },
          base: { filter: dzVars(d.z)['--ac-pf'], zoomMul: zoomEff(d.z) / (d.z.zoom / 100) } },
        onApply: (fx, fr) => { d.fx = fx; Object.assign(d.z, fr); change(); say('🎚 Фото настроено — не забудьте сохранить дизайн'); },
      });
    }

    /* ---------- clicks, sliders, colours ---------- */
    function pickPhoto(kind) {
      const setPic = p => { d.pic = Object.assign({ image: '', imageCredit: '', imageCreditUrl: '', imageSrc: '' }, p); Object.assign(d.z, { zoom: 100, ox: 50, oy: 50 }); d.fx = null; change(); };
      const word = cur().no;
      if (kind === 'hist') historicPick({ word, onPick: r => { setPic({ image: r.image, imageCredit: r.credit, imageCreditUrl: r.page, imageSrc: r.src }); UI.toast('🏛 Фото на карточке — автор и лицензия видны в «i»', 'good', 2800); } });
      else if (kind === 'pin') {
        // 📌 the in-app gallery (Pinterest-like, Norway by default); real Pinterest (copy → paste) is its second tab
        const paste = () => pinterestPick({ word, onPick: src => { const s = Store.Safe.image(src); if (s) setPic({ image: s, imageSrc: 'pinterest' }); else UI.toast('Эта картинка не подходит — выберите JPG, PNG или WebP', 'warn'); } });
        if (window.Views && Views.gallery) Views.gallery({
          title: '📌 Галерея картинок', word: String(word || '').split('\n')[0].replace(/^(en|ei|et|å)\s+/i, '').trim().slice(0, 60), en: cur().en || '', max: 900,
          onPick: r => setPic({ image: r.image, imageCredit: r.credit || '', imageCreditUrl: /^https:\/\//i.test(r.page || '') ? r.page : '', imageSrc: r.src || 'photo' }),
          onPinterest: paste,
        });
        else paste();
      }
      else if (kind === 'file') {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = async () => {
          const f = inp.files && inp.files[0]; if (!f) return;
          if (!/^image\//.test(f.type) || /svg/i.test(f.type)) { UI.toast('Подойдут JPG, PNG, WebP или GIF', 'warn'); return; }
          try { setPic({ image: await U.compressImage(f, 900, 0.86) }); } catch (e) { UI.toast('Эту картинку не получилось открыть — попробуйте другую', 'bad'); }
        };
        inp.click();
      } else if (kind === 'none') setPic({ image: '' });
    }
    m.el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !m.el.contains(b)) return;
      const ds = b.dataset;
      if (ds.edTab) { tab = ds.edTab; renderPane(); return; }
      if (ds.edSide) { side = ds.edSide; m.$$('[data-ed-side]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); renderStage(); return; }
      if (ds.edPos) {
        if (ds.edPos === 'auto') { d.z.pos = false; d.z.trSep = false; say('Слово на месте, как в шаблоне'); }
        else { const [x, y] = ds.edPos.split(',').map(Number); d.z.pos = true; d.z.x = x; d.z.y = y; say('Слово: ' + b.getAttribute('aria-label').toLowerCase()); }
        change(); return;
      }
      if (ds.edSet) {
        const k = ds.edSet, v = ds.v;
        if (k === 'trSep') { d.z.trSep = v === '1'; if (d.z.trSep && !d.z.pos) { d.z.pos = true; d.z.x = 0; d.z.y = 100; } if (d.z.trSep && side !== 'tile') { side = 'tile'; m.$$('[data-ed-side]').forEach(x => { const on = x.dataset.edSide === 'tile'; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); } }
        else d.z[k] = v;
        change(); return;
      }
      if (ds.edQ) { FX_KEYS.forEach(k => { d.z[k] = DZ0[k]; }); Object.assign(d.z, (QUICK.find(q => q[0] === ds.edQ) || [])[2] || {}); change(); return; }
      if (ds.edDef) { if (ds.edDef === 'frame') Object.assign(d.z, { zoom: 100, ox: 50, oy: 50 }); else d.z[ds.edDef] = DZ0[ds.edDef]; change(); return; }
      if (ds.edNudge) { const [k, n] = ds.edNudge.split(':'); d.z[k] = clamp(d.z[k] + Number(n), -30, 30); change(); return; }
      if (ds.edPic) { pickPhoto(ds.edPic); return; }
      if (ds.edFx) { openFx(); return; }
      switch (ds.ed) {
        case 'undo': undo(); break;
        case 'redo': redo(); break;
        case 'reset':
          if (!dzSafe(d.z)) { UI.toast('У этой карточки и так оформление как у всех', '', 2200); break; }
          d.z = Object.assign({}, DZ0); change();
          UI.toast('↺ Оформление карточки сброшено — «↶» вернёт его', '', 2600); break;
        case 'deck': applyDeck(); break;
        case 'cancel': m.tryClose(); break;
        case 'save': doSave(); m.close(); UI.toast('🎨 Дизайн карточки сохранён', 'good', 1800); break;
      }
    });
    m.el.addEventListener('input', e => {
      const t = e.target, k = t.dataset.edRange, col = t.dataset.edColor;
      if (k) { d.z[k] = +t.value; const lab = m.el.querySelector(`[data-edv="${k}"]`); if (lab) lab.textContent = t.value + (t.dataset.unit || ''); paint(); }
      if (col) { d.z[col] = String(t.value).toLowerCase(); paint(); }
    });
    m.el.addEventListener('change', e => {
      if (e.target.dataset.edRange) { commit(); if (e.target.dataset.edRange === 'size') renderPane(); }
      if (e.target.dataset.edColor) { commit(); renderPane(); }
    });

    /* ---------- keyboard: ↶ ↷ and moving the word with the arrows ---------- */
    function nudge(which, key, step) {
      if (!d.z.pos) { d.z.pos = true; d.z.x = 0; d.z.y = 100; }
      const kx = which === 'tr' ? 'tx' : 'x', ky = which === 'tr' ? 'ty' : 'y';
      if (key === 'ArrowLeft') d.z[kx] = clamp(d.z[kx] - step, 0, 100);
      if (key === 'ArrowRight') d.z[kx] = clamp(d.z[kx] + step, 0, 100);
      if (key === 'ArrowUp') d.z[ky] = clamp(d.z[ky] - step, 0, 100);
      if (key === 'ArrowDown') d.z[ky] = clamp(d.z[ky] + step, 0, 100);
      paint(); say(posText(d.z[kx], d.z[ky]));
      clearTimeout(kt); kt = setTimeout(() => { commit(); renderPane(); }, 450);
    }
    const onKey = e => {
      if (!document.body.contains(m.el)) return;
      const open = [...document.getElementById('modal-root').children].filter(x => !x.classList.contains('closing'));
      if (open[open.length - 1] !== m.el.parentElement) return;
      const mod = (e.ctrlKey || e.metaKey) && !e.altKey;
      const typing = e.target.matches && e.target.matches('input:not([type]), input[type="text"], input[type="search"], input[type="url"], textarea, [contenteditable="true"]');
      const isZ = e.code === 'KeyZ' || /^[zя]$/i.test(e.key || ''), isY = e.code === 'KeyY' || /^[yн]$/i.test(e.key || '');
      if (mod && (isZ || isY) && !typing) {
        e.preventDefault(); e.stopPropagation();
        clearTimeout(kt); commit();
        if (isZ && !e.shiftKey) undo(); else redo();
        return;
      }
      const tb = e.target.closest && e.target.closest('[data-ed-tab]');
      if (tb && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !mod) { // tabs: ← → like any tab list
        e.preventDefault();
        const all = m.$$('[data-ed-tab]'), n = all[(all.indexOf(tb) + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length];
        tab = n.dataset.edTab; renderPane(); n.focus(); return;
      }
      const blk = e.target.closest && e.target.closest('[data-dz]');
      if (blk && stage.contains(blk) && /^Arrow(Left|Right|Up|Down)$/.test(e.key) && !mod) { e.preventDefault(); e.stopPropagation(); nudge(blk.dataset.dz, e.key, e.shiftKey ? 10 : 2); }
    };
    document.addEventListener('keydown', onKey, true);

    /* ---------- dragging: the word (or the translation), the photo; two fingers zoom the photo ---------- */
    stage.addEventListener('pointerdown', e => {
      const el = cardEl(); if (!el || !el.contains(e.target) || (e.pointerType === 'mouse' && e.button !== 0)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        drag = el.querySelector('.ac-img') ? { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: d.z.zoom } : null;
        return;
      }
      if (pointers.size > 2) return;
      const blk = e.target.closest('[data-dz]'), r = el.getBoundingClientRect();
      if (blk) {
        const which = blk.dataset.dz;
        if (!d.z.pos) { d.z.pos = true; d.z.x = 0; d.z.y = 100; }
        drag = { type: 'text', which, sx: e.clientX, sy: e.clientY, moved: false };
        paint(); // free layout first, then measure
        Object.assign(drag, { x0: d.z[which === 'tr' ? 'tx' : 'x'], y0: d.z[which === 'tr' ? 'ty' : 'y'], W: r.width, H: r.height, bw: blk.offsetWidth, bh: blk.offsetHeight });
        blk.focus({ preventScroll: true });
      } else {
        const img = el.querySelector('.ac-img'), med = el.querySelector('.ac-media');
        if (!img || !img.naturalWidth || !med) return;
        const mr = med.getBoundingClientRect();
        drag = { type: 'pan', sx: e.clientX, sy: e.clientY, ox0: d.z.ox, oy0: d.z.oy, W: mr.width, H: mr.height, iw: img.naturalWidth, ih: img.naturalHeight, moved: false };
        paint();
      }
    });
    stage.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!drag) return;
      if (drag.type === 'pinch') {
        const [a, b] = [...pointers.values()]; if (!b) return;
        d.z.zoom = Math.round(clamp(drag.z0 * Math.hypot(a.x - b.x, a.y - b.y) / drag.d0, 100, 300));
        drag.moved = true; paint(); return;
      }
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 3) return;
      drag.moved = true;
      if (drag.type === 'text') {
        const kx = 0.88 * drag.W - drag.bw, ky = 0.88 * drag.H - drag.bh;
        let nx = Math.abs(kx) > 4 ? drag.x0 + dx / kx * 100 : drag.x0, ny = Math.abs(ky) > 4 ? drag.y0 + dy / ky * 100 : drag.y0;
        nx = clamp(nx, 0, 100); ny = clamp(ny, 0, 100);
        snapV = Math.abs(nx - 50) < 2.5; snapH = Math.abs(ny - 50) < 2.5;
        if (snapV) nx = 50; if (snapH) ny = 50;
        d.z[drag.which === 'tr' ? 'tx' : 'x'] = Math.round(nx * 10) / 10; d.z[drag.which === 'tr' ? 'ty' : 'y'] = Math.round(ny * 10) / 10;
      } else {
        const k = Math.max(drag.W / drag.iw, drag.H / drag.ih) * zoomEff(d.z), ow = drag.iw * k - drag.W, oh = drag.ih * k - drag.H;
        if (ow > 1) d.z.ox = Math.round(clamp(drag.ox0 - dx / ow * 100, 0, 100) * 10) / 10;
        if (oh > 1) d.z.oy = Math.round(clamp(drag.oy0 - dy / oh * 100, 0, 100) * 10) / 10;
      }
      paint();
    });
    const endPtr = e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size) { if (drag && drag.type === 'pinch') { drag = null; commit(); renderPane(); } return; }
      const was = drag; drag = null; snapV = snapH = false; paint();
      if (was && was.moved) {
        commit(); renderPane();
        if (was.type === 'text') say(posText(d.z[was.which === 'tr' ? 'tx' : 'x'], d.z[was.which === 'tr' ? 'ty' : 'y']));
      } else if (was) commit();
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => stage.addEventListener(ev, endPtr));

    renderStage(); renderPane(); urBtns();
    setTimeout(() => { const s = m.$('[data-ed-tab].on'); if (s) s.focus({ preventScroll: true }); }, 80);
    return m;
  }
  /** after many cards changed at once (the whole deck): redraw what is shown in art style */
  function refreshArt() {
    restyle();
    document.querySelectorAll('.art-zoom').forEach(z => { const bd = z.parentElement; if (bd && bd._m && bd._m.redraw) bd._m.redraw(); });
  }

  /* =====================================================================
   * 🏛 HISTORICAL PHOTOS OF NORWAY — Wikimedia Commons + Nasjonalbiblioteket (nb.no), free licences only
   * (public domain / CC0 / CC BY / CC BY-SA; anything else or unknown is skipped). The author, the licence and the
   * source page are kept on the card (imageCredit / imageCreditUrl) and shown in «i» and on shared pictures.
   * ===================================================================== */
  const HIST_IDEAS = [['👑 Kong Haakon VII', 'kong Haakon VII'], ['👑 Olav V', 'kong Olav V'], ['👨‍👩‍👧 Kongefamilien', 'kongefamilien'], ['🏙 Oslo 1900', 'Oslo 1900'],
    ['🎣 Fiskere i Lofoten', 'fiskere Lofoten'], ['⛪ Stavkirke', 'stavkirke'], ['👗 Bunad', 'bunad'], ['⛵ Bryggen i Bergen', 'Bryggen Bergen'], ['⛷ Skiløpere', 'skiløpere'],
    ['🧭 Fridtjof Nansen', 'Fridtjof Nansen'], ['🚂 Bergensbanen', 'Bergensbanen'], ['🇳🇴 17. mai', '17. mai'], ['🌾 Gårdsliv', 'gårdsbruk'], ['🚢 Hurtigruten', 'Hurtigruten']];
  const stripHtml = h => { try { return (new DOMParser().parseFromString(String(h || ''), 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim(); } catch (e) { return String(h || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); } };
  /** only the free licences — the exact Commons short name, or nothing */
  function freeLicence(s) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    if (!s || s.length > 40 || /\b(nc|nd)\b|non.?commercial|no.?deriv/i.test(s)) return '';
    if (/^(public domain|pd|pd[- ][a-z0-9.-]{1,30}|pdm( 1\.0)?|cc0( 1\.0)?|cc[- ]?zero)$/i.test(s)) return s;
    if (/^cc[- ]by(-sa)?( \d\.\d)?( [a-z]{2,3}(-[a-z]{2,3})?)?$/i.test(s)) return s;
    return '';
  }
  async function commonsHist(q) {
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=30'
      + '&gsrsearch=' + enc(q + ' filetype:bitmap') + '&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiurlwidth=500'
      + '&iiextmetadatafilter=Artist|LicenseShortName|ObjectName|DateTimeOriginal';
    const r = await fetch(url, { credentials: 'omit' });
    if (!r.ok) throw new Error('commons ' + r.status);
    const j = await r.json();
    return Object.values((j.query && j.query.pages) || {}).sort((a, b) => (a.index || 0) - (b.index || 0)).map(p => {
      const ii = p.imageinfo && p.imageinfo[0];
      if (!ii || !/^image\/(jpeg|png|webp|tiff)$/.test(ii.mime || '')) return null;
      const md = ii.extmetadata || {}, val = k => stripHtml(md[k] && md[k].value);
      const lic = freeLicence(val('LicenseShortName'));
      if (!lic) return null;
      const tiff = /tiff/.test(ii.mime), thumb = ii.thumburl || (tiff ? '' : ii.url);
      const src = ii.width > 960 && ii.thumburl ? ii.thumburl.replace(/\/\d+px-/, '/960px-') : (tiff ? ii.thumburl : ii.url);
      if (!thumb || !/^https:\/\//.test(src || '') || !/^https:\/\//.test(ii.descriptionurl || '')) return null;
      return { kind: 'commons', source: 'Wikimedia Commons', src, thumb, lic, page: ii.descriptionurl,
        author: (val('Artist') || 'автор неизвестен').slice(0, 80), title: (val('ObjectName') || String(p.title || '').replace(/^File:/, '').replace(/\.\w+$/, '')).slice(0, 120), date: val('DateTimeOriginal').slice(0, 30) };
    }).filter(Boolean);
  }
  async function nbHist(q) {
    const r = await fetch(`https://api.nb.no/catalog/v1/items?q=${enc(q)}&filter=mediatype:bilder&filter=contentClasses:public&size=30`, { credentials: 'omit' });
    if (!r.ok) throw new Error('nb ' + r.status);
    const j = await r.json();
    return ((j._embedded && j._embedded.items) || []).map(it => {
      const ai = it.accessInfo || {}, L = it._links || {}, md = it.metadata || {};
      if (ai.isPublicDomain !== true || !/^public ?domain$/i.test(ai.license || '')) return null;
      const tpl = L.thumbnail_custom && L.thumbnail_custom.href;
      if (!tpl || !/^https:\/\/www\.nb\.no\/services\/image\/resolver\/[^\s"'<>]+\{width\},\{height\}/.test(tpl) || !/^[a-z0-9]{8,64}$/i.test(it.id || '')) return null;
      return { kind: 'nb', source: 'Nasjonalbiblioteket', src: tpl.replace('{width},{height}', '960,0'), thumb: tpl.replace('{width},{height}', '400,0'), lic: 'Public domain',
        page: `https://www.nb.no/items/${it.id}`, author: ((md.creators || []).join(', ') || 'автор неизвестен').slice(0, 80), title: String(md.title || '').slice(0, 120), date: String((md.originInfo || {}).issued || '').slice(0, 30) };
    }).filter(Boolean);
  }
  function historicPick(opts = {}) {
    const q0 = firstLine(opts.word || '').replace(/^(en|ei|et|å)\s+/i, '').slice(0, 60);
    let results = [], chosen = -1, seq = 0;
    const m = UI.modal({
      title: '🏛 Исторические фото Норвегии', cls: 'wide art-hist-modal',
      body: `<p class="ac-hist-note"><span aria-hidden="true">🕊</span> Здесь только фото со <b>свободной лицензией</b> — общественное достояние, CC0, CC BY или CC BY-SA. Автор и лицензия сохранятся на карточке: их видно в «i» и на картинке, которой вы поделитесь.</p>
        <form class="ac-hist-form" data-hist-form role="search"><input class="input" type="search" data-hist-q value="${esc(q0)}" placeholder="Например: kong Haakon VII, Bergen 1900, fiskere…" aria-label="Что найти в архивах" enterkeyhint="search"><button class="btn primary" type="submit">🔍 Найти</button></form>
        <div class="ac-hist-chips" role="group" aria-label="Идеи для поиска">${HIST_IDEAS.map(([l, q]) => `<button type="button" class="ac-idea" data-hist-idea="${esc(q)}">${esc(l)}</button>`).join('')}</div>
        <p class="tiny muted ac-hist-src">Ищем сразу в двух архивах: Wikimedia Commons и Национальная библиотека Норвегии (nb.no). Лучше искать по-норвежски.</p>
        <div class="ac-hist-grid" data-hist-grid aria-live="polite"></div>`,
      foot: '<span class="ac-hist-pick small" data-hist-pick></span><span class="grow"></span><button type="button" class="btn ghost" data-hist="cancel">Отмена</button><button type="button" class="btn primary" data-hist="ok" disabled>✓ Поставить на карточку</button>',
    });
    const grid = m.$('[data-hist-grid]'), ok = m.$('[data-hist="ok"]'), pick = m.$('[data-hist-pick]'), qi = m.$('[data-hist-q]');
    const empty = html => { grid.innerHTML = `<div class="ac-hist-empty">${html}</div>`; };
    const search = async q => {
      q = String(q || '').trim().slice(0, 100);
      if (!q) { empty('Напишите, что найти, или нажмите на идею выше.'); return; }
      const my = ++seq; chosen = -1; ok.disabled = true; pick.textContent = '';
      empty('<span class="spinner"></span> Ищу в архивах…');
      const [a, b] = await Promise.allSettled([commonsHist(q), nbHist(q)]);
      if (my !== seq || !document.body.contains(m.el)) return;
      const A = a.status === 'fulfilled' ? a.value : [], B = b.status === 'fulfilled' ? b.value : [];
      results = [];
      for (let i = 0; i < Math.max(A.length, B.length); i++) { if (B[i]) results.push(B[i]); if (A[i]) results.push(A[i]); }
      if (!results.length) {
        empty(a.status === 'rejected' && b.status === 'rejected' ? '📡 Архивы сейчас не отвечают — проверьте интернет и попробуйте ещё раз.'
          : `Со свободной лицензией по запросу «${esc(q)}» ничего не нашлось. Попробуйте по-норвежски или проще: «Bergen 1900», «fiskere», «bunad».`);
        return;
      }
      grid.innerHTML = results.map((r, i) => `<button type="button" class="ac-hist-it" data-hist-i="${i}" aria-pressed="false">
          <span class="ac-hist-img"><img src="${esc(r.thumb)}" alt="${esc(r.title || 'Историческое фото')}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></span>
          <span class="ac-hist-cap"><b>${esc(r.title || 'Без названия')}</b><small>${esc(r.author)}${r.date ? ' · ' + esc(r.date) : ''}</small><small class="ac-hist-lic">${esc(r.lic)} · ${esc(r.source)}</small></span></button>`).join('');
    };
    grid.addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG') { const it = t.closest('.ac-hist-it'); if (it) it.hidden = true; } }, true);
    m.$('[data-hist-form]').addEventListener('submit', e => { e.preventDefault(); search(qi.value); });
    m.el.addEventListener('click', async e => {
      const idea = e.target.closest('[data-hist-idea]');
      if (idea) { qi.value = idea.dataset.histIdea; search(qi.value); return; }
      const it = e.target.closest('[data-hist-i]');
      if (it) {
        chosen = +it.dataset.histI;
        m.$$('[data-hist-i]').forEach(x => { const on = x === it; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
        const r = results[chosen];
        pick.textContent = `Выбрано: ${r.author} · ${r.lic}`;
        ok.disabled = false; return;
      }
      const b = e.target.closest('[data-hist]'); if (!b) return;
      if (b.dataset.hist === 'cancel') { m.close(); return; }
      const r = results[chosen]; if (!r) return;
      const label = ok.innerHTML;
      ok.disabled = true; ok.innerHTML = '<span class="spinner sm"></span> Сохраняю фото…';
      let image = '';
      try { image = await U.compressImage(r.src, 900, 0.86); } catch (err) { image = ''; }
      if (!image) image = Store.Safe.image(r.src);
      if (!document.body.contains(m.el)) return;
      if (!image) { ok.disabled = false; ok.innerHTML = label; UI.toast('Это фото не получилось сохранить — выберите другое', 'bad'); return; }
      const credit = [r.author, r.lic, r.source].filter(Boolean).join(' · ').slice(0, 220);
      m.close();
      if (opts.onPick) opts.onPick({ image, credit, page: r.page, src: r.kind, title: r.title });
    });
    if (q0) search(q0); else empty('Выберите идею выше или напишите, что найти: людей, места, ремёсла, праздники — всё, что было в Норвегии раньше.');
    setTimeout(() => qi.focus({ preventScroll: true }), 80);
    return m;
  }

  /* =====================================================================
   * deck / settings switches + global handlers
   * ===================================================================== */
  function deckOn(deck) {
    if (!deck) return false;
    if (deck.art === 'on') return true;
    if (deck.art === 'off') return false;
    return !!Store.settings.artMode;
  }
  function toggleBtnHtml(deck) {
    return `<button class="btn ac-deck-toggle" data-art-act="deck-on" data-id="${esc(deck.id)}" title="Красивая галерея карточек: картинки во всю карточку, крупные слова, цвет рода — одним нажатием обратно">🎨 Художественный вид</button>`;
  }
  function settingsHtml() {
    const s = Store.settings, lk = look(), th = theme(lk.theme);
    const sw = (k, on, label, desc) => `<div class="setting"><div><div>${label}</div>${desc ? `<div class="desc">${desc}</div>` : ''}</div><div class="ctl"><label class="switch"><input type="checkbox" data-art-set="${k}" ${on ? 'checked' : ''}><span class="track"></span></label></div></div>`;
    return `<div class="panel ac-settings" style="grid-column:1/-1">
      <h3>🎨 Художественный вид карточек</h3>
      <p class="small muted">Колода как красивая галерея в стиле Pinterest: картинка во всю карточку, крупное норвежское слово, цвет рода. Учить можно и в этом виде. В любой колоде одним нажатием: «🎨 Художественный вид» / «🔤 Обычный вид».</p>
      ${sw('artMode', s.artMode, 'Открывать колоды в художественном виде', 'Для колод, где вы ещё не выбирали вид сами')}
      <div class="setting"><div><div>Оформление: <b>${th.icon} ${esc(th.name)}</b> · ${esc((lk.font === 'theme' ? fontById(th.font) : fontById(lk.font)).name)}</div><div class="desc">Шаблоны, шрифты, цвета, обводка — с живым просмотром</div></div><div class="ctl"><button class="btn" data-art-act="studio">🎨 Настроить…</button></div></div>
      <div class="setting"><div><div>Цвет рода существительных</div><div class="desc">Рамка и значок карточки окрашены по артиклю — так род запоминается сам</div></div><div class="ctl">${legendHtml()}</div></div>
      ${sw('artMotion', s.artMotion === 'on', 'Анимация, даже если на устройстве она уменьшена', reduceSys() ? '🌿 Сейчас в настройках устройства анимация уменьшена — карточки переворачиваются затуханием' : 'Сейчас анимация на устройстве включена')}
      ${sw('artSeasonHints', s.artSeasonHints, 'Предлагать праздничные шаблоны', 'Хэллоуин, Jul, 17. mai, Påske, Sankthans… — одна ненавязчивая подсказка, когда подходит дата')}
      <div class="row" style="gap:8px;margin-top:8px"><button class="btn sm" data-art-act="ideas">📌 Норвежские идеи в Pinterest</button>${reduceSys() ? `<button class="btn sm ghost" data-art-act="motion-help">Как включить анимацию на устройстве</button>` : ''}</div>
    </div>`;
  }
  function onClick(e) {
    const b = e.target.closest && e.target.closest('[data-art-act]');
    if (!b) return;
    e.stopPropagation(); e.preventDefault();
    const id = b.dataset.id;
    switch (b.dataset.artAct) {
      case 'info': info(id); break;
      case 'share': share(id); break;
      case 'history': Prov.historyDialog(id); break;
      case 'studio': {
        const d = App.view.name === 'deck' && Store.deck(App.view.params.id);
        const withImg = d ? Store.cards(d.id).filter(goodImg) : [];
        const noImg = d ? Store.cards(d.id).filter(c => !goodImg(c)) : [];
        studio({ sample: withImg[0], sample2: noImg[0] });
        break;
      }
      case 'ideas': ideas(); break;
      case 'deck-on': Store.updateDeck(id, { art: 'on' }); App.render(); window.scrollTo({ top: 0 }); break;
      case 'deck-off': Store.updateDeck(id, { art: 'off' }); App.render(); window.scrollTo({ top: 0 }); break;
      case 'season-try': case 'season-no': {
        const bar = b.closest('[data-season]'); if (!bar) return;
        const seen = Object.assign({}, Store.settings.artSeasonSeen || {}); seen[bar.dataset.key] = 1;
        Store.setSetting('artSeasonSeen', seen);
        if (b.dataset.artAct === 'season-try') { Store.setSetting('art', Store.Safe.art(Object.assign(look(), { theme: bar.dataset.season, font: 'theme' }))); App.render(); UI.toast(`${THEMES[bar.dataset.season].icon} Шаблон «${THEMES[bar.dataset.season].name}» — вернуть прежний можно в «🎨 Оформление»`, 'good', 4200); }
        else bar.remove();
        break;
      }
      case 'study-toggle': {
        const S = Study.session; if (!S) return;
        S.art = !studyOn(S);
        S.flipped = false;
        const t = document.querySelector('.ac-study-toggle'); if (t) t.outerHTML = studyToggleHtml(S);
        Study.renderCard(false);
        break;
      }
      case 'motion-help': UI.modal({ title: '🌿 Анимация на устройстве', cls: 'narrow', body: MOTION_HELP.replace('<details class="ac-howto">', '<details class="ac-howto" open>') }); break;
    }
  }
  function onChange(e) {
    const t = e.target; const k = t && t.dataset && t.dataset.artSet; if (!k) return;
    e.stopPropagation();
    if (k === 'artMotion') { Store.setSetting('artMotion', t.checked ? 'on' : 'auto'); motionClass(); }
    else Store.setSetting(k, !!t.checked);
  }
  document.addEventListener('click', onClick, true);
  document.addEventListener('change', onChange, true);
  try { matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', motionClass); } catch (e) { /* old browser */ }

  const ArtCards = {
    THEMES, FONTS, GENDER, seasonOf, easter,
    deckOn, studyOn, toggleBtnHtml, studyToggleHtml, settingsHtml,
    gallery, zoom, info, studio, share, renderPng, pinterestPick, ideas,
    decorateStudy, faceHtml, parts, motionOk, afterEdit,
    /** 🎚 the card's own photo effects + zoom factor (js/photofx.js shows them in its preview of an art card) */
    fxBase: card => { if (!card || !card.artDesign) return null; const z = dz(card); return { filter: dzVars(z)['--ac-pf'], zoomMul: zoomEff(z) / (z.zoom / 100) }; },
    designer, historicPick, cardLook, freeLicence, commonsHist, nbHist, registerTemplate,
    /** a look → { cls, style, vars } for a wrapper around faceHtml(…, { base: look }) (e.g. a read-only showcase card); the fonts load lazily */
    scope, ensureFonts, DEFAULT_LOOK: Object.freeze(Object.assign({}, DEFAULT_LOOK)),
  };
  window.ArtCards = ArtCards;
})();
