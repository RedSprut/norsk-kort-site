/* ============ Norsk Kort — app themes + holiday dress-up (window.AppThemes) ============
 * Own code, no libraries. Load it early in <head> (right after css/apptheme.css / js/preloader.js): it only sets a
 * few attributes on <html> and a <style> with the colours at once (no flash of the old colours); everything that
 * needs <body> waits for DOMContentLoaded.
 *
 *  • Manual themes the user picks anytime («🎨 Тема приложения»: ⋯ menu, Settings → Внешний вид, right-click /
 *    long-press on 🌞). Every theme has its own light AND dark palette (text ≥ WCAG AA, checked by a test).
 *  • Holiday dress-up by the calendar (Norway): during a holiday window the whole app recolours + gets light
 *    decorations, then returns to the user's own theme. First open in the window → one kind banner:
 *    «Оставить» · «Вернуть обычный вид» (this holiday only) · «Не менять автоматически» (auto off).
 *  • Decorations: own CSS/SVG, pointer-events: none, behind the content (a tiny garland sits in the top bar's
 *    padding), paused while the tab is hidden, no moving parts under prefers-reduced-motion (unless the app's own
 *    Store.settings.artMotion === 'on'), «Без украшений» switch.
 *  • Reusable: AppThemes.today(), AppThemes.holidays(year), AppThemes.palette(id, mode) — e.g. for the art cards.
 *
 * Settings live in localStorage 'nk-apptheme' (read at once in <head>: no flash of the old colours):
 *   { v: 1, theme: 'default', hol: 'auto', auto: true, deco: true, seen: { 'jul-2026': 1 }, off: { 'jul-2026': 1 } }
 *   hol — «🎉 Праздничное оформление»: 'auto' (by the calendar) | 'off' (never) | a holiday id (that holiday ALWAYS,
 *   e.g. 'halloween' — until the person changes it). auto mirrors hol === 'auto' (older code read it).
 * The choice itself (theme, hol, deco) is ALSO kept in Store.settings.appTheme — so it is in backups / the cloud copy
 * like every other setting; a restored or synced value wins over this device's copy (fromStore / toStore).
 */
(function () {
  'use strict';
  var W = window, D = document, H = D.documentElement;
  var KEY = 'nk-apptheme';

  /* ---------------------------------------------------------------- palettes
   * bg / bg2 page · panel (glass) · solid (windows, cards) · border · text · muted · accent (buttons, white text on
   * it) · end (2nd colour of the primary-button gradient, white text on it) · accent2 (links in dark, highlights) ·
   * ru (Russian text) · f / b (card front / back gradient) · blobs (3 soft background lights, '' = none) · fx (3
   * decoration colours) · good/warn/bad (optional: status colours when the defaults are too weak on this background)
   */
  var THEMES = [
    { id: 'default', name: 'Обычная', emoji: '✨', kind: 'base', desc: 'Как всегда: ночное небо, фиолетовый и голубой' },
    { id: 'fjord', name: 'Фьорд', emoji: '🏔', kind: 'style', desc: 'Глубокая синяя вода, ледник и бирюза', pattern: 'fjord',
      dark: { bg: '#0b1a26', bg2: '#0f2232', panel: 'rgba(160,220,255,.06)', solid: '#12283a', border: 'rgba(160,220,255,.15)', text: '#e8f4fb', muted: '#95b6c8', accent: '#2a78ad', end: '#16807c', accent2: '#5fd4d0', ru: '#7fd8ff', f: ['#163449', '#0f2536'], b: ['#123c46', '#0d2a33'], blobs: ['#1f6fa8', '#2fb8b0', '#6aa9d8'], fx: ['#bfe6ff', '#5fd4d0', '#ffffff'] },
      light: { bg: '#eef5f8', bg2: '#e1edf2', panel: 'rgba(255,255,255,.8)', solid: '#ffffff', border: 'rgba(10,50,80,.13)', text: '#0d2433', muted: '#486474', accent: '#1d6797', end: '#0e6f6b', accent2: '#0e6f6b', ru: '#0a65a3', f: ['#ffffff', '#eaf4f9'], b: ['#effaf9', '#e2f0f6'], blobs: ['#5aa7dc', '#56cfc6', '#9cc6e8'], fx: ['#6aa9d8', '#2fb8b0', '#9cc6e8'] } },
    { id: 'aurora', name: 'Северное сияние', emoji: '🌌', kind: 'style', desc: 'Зелёные и фиолетовые огни над полярной ночью', fx: 'aurora',
      dark: { bg: '#070d1c', bg2: '#0b1528', panel: 'rgba(150,255,210,.05)', solid: '#101b30', border: 'rgba(140,255,200,.14)', text: '#ecfff7', muted: '#9dbab6', accent: '#0d7f62', end: '#6a45c8', accent2: '#b597ff', ru: '#7cf0c8', f: ['#14223d', '#0e1a30'], b: ['#10283a', '#0b1d2b'], blobs: ['#19d39a', '#7b5cff', '#2fb3ff'], fx: ['#2ff5b0', '#8f6bff', '#36c6ff'] },
      light: { bg: '#eef6f5', bg2: '#e2efee', panel: 'rgba(255,255,255,.78)', solid: '#ffffff', border: 'rgba(10,60,60,.13)', text: '#0b2229', muted: '#476260', accent: '#0b7a5e', end: '#6b46c1', accent2: '#6b46c1', ru: '#0a6a8c', f: ['#ffffff', '#ecf7f5'], b: ['#f1f0ff', '#e6f3f8'], blobs: ['#5fe0b5', '#a690ff', '#79cdf7'], fx: ['#3fd6a0', '#9a7cff', '#58c2f0'] } },
    { id: 'minimal', name: 'Скандинавский минимализм', emoji: '🤍', kind: 'style', desc: 'Спокойные тёплые оттенки, берёза и шалфей, без фона', noBlobs: true,
      dark: { bg: '#17191b', bg2: '#1e2124', panel: 'rgba(255,255,255,.04)', solid: '#222528', border: 'rgba(255,255,255,.11)', text: '#f2f0ec', muted: '#aaa69d', accent: '#5c7a65', end: '#6d5a44', accent2: '#cdbb9f', ru: '#9fc9da', f: ['#25292c', '#212427'], b: ['#232a2b', '#1e2325'], blobs: ['', '', ''], fx: ['#cdbb9f', '#8fa898', '#ffffff'] },
      light: { bg: '#f6f4ef', bg2: '#eeebe4', panel: 'rgba(255,255,255,.88)', solid: '#ffffff', border: 'rgba(40,36,30,.13)', text: '#22201c', muted: '#635e56', accent: '#4b6858', end: '#7a5d3d', accent2: '#7a5d3d', ru: '#2c6683', f: ['#ffffff', '#f7f5f0'], b: ['#f4f7f3', '#eef1ec'], blobs: ['', '', ''], fx: ['#cdbb9f', '#8fa898', '#e0d6c6'] } },
    { id: 'rosemaling', name: 'Розмалинг', emoji: '🌺', kind: 'style', desc: 'Норвежская народная роспись: завитки, красный, охра', pattern: 'rosemaling', corner: 'rosemaling', serif: true,
      dark: { bg: '#10212b', bg2: '#132834', panel: 'rgba(255,236,200,.05)', solid: '#142a36', border: 'rgba(255,226,180,.15)', text: '#fbf3e4', muted: '#c6b79e', accent: '#cf4034', end: '#2a6878', accent2: '#ecb84f', ru: '#8fd3e8', f: ['#1c3a48', '#15303c'], b: ['#2a2b35', '#1e2630'], blobs: ['#b3362c', '#e9b44c', '#2e6f7e'], fx: ['#e05a47', '#ecb84f', '#f6ead2'], bad: '#ff6b81' },
      light: { bg: '#f7efe0', bg2: '#efe3cc', panel: 'rgba(255,250,240,.78)', solid: '#fffaf0', border: 'rgba(90,50,20,.16)', text: '#2b1d14', muted: '#6b5644', accent: '#a32d24', end: '#1f5f6e', accent2: '#1f5f6e', ru: '#1b5c84', f: ['#fffaf0', '#f8efde'], b: ['#f2f6f2', '#e9efe9'], blobs: ['#e07a5f', '#f2c76e', '#6fa7b5'], fx: ['#c0392b', '#d99a2b', '#1f5f6e'], good: '#166534', warn: '#92400e' } },
    { id: 'parchment', name: 'Пергамент', emoji: '📜', kind: 'style', desc: 'Старая бумага, чернила и свеча — как в библиотеке', pattern: 'parchment', serif: true, noBlobs: true,
      dark: { bg: '#1d1710', bg2: '#241c13', panel: 'rgba(255,230,190,.05)', solid: '#2a2117', border: 'rgba(255,220,170,.15)', text: '#f3e7d0', muted: '#bda98c', accent: '#b25c27', end: '#6b5a1e', accent2: '#ddaa62', ru: '#9cc8da', f: ['#30261a', '#271f15'], b: ['#2c2a1e', '#232117'], blobs: ['', '', ''], fx: ['#ddaa62', '#f3e7d0', '#8f4a1f'] },
      light: { bg: '#f1e6cc', bg2: '#e8dab9', panel: 'rgba(255,250,235,.62)', solid: '#fbf4e2', border: 'rgba(90,60,20,.2)', text: '#2e2213', muted: '#65502f', accent: '#8a3f12', end: '#5a5a1c', accent2: '#5a5a1c', ru: '#1c5674', f: ['#fdf7e8', '#f5ead0'], b: ['#f6f0dc', '#ece4c8'], blobs: ['', '', ''], fx: ['#8a3f12', '#5a5a1c', '#c9a46a'], good: '#166534', warn: '#92400e', bad: '#9f1239' } },
    { id: 'treasure', name: 'Карта сокровищ', emoji: '🗺', kind: 'style', desc: 'Старинная карта: сетка, пунктир маршрута и компас', pattern: 'treasure', corner: 'compass', serif: true, noBlobs: true,
      dark: { bg: '#0e1b22', bg2: '#13242c', panel: 'rgba(240,220,170,.05)', solid: '#172a33', border: 'rgba(240,215,160,.17)', text: '#f4ead2', muted: '#bcae8f', accent: '#d13e27', end: '#28606c', accent2: '#e6b955', ru: '#8fd0e0', f: ['#1a3038', '#14262e'], b: ['#22302c', '#1a2724'], blobs: ['', '', ''], fx: ['#e6b955', '#d0553f', '#f4ead2'] },
      light: { bg: '#efe0bb', bg2: '#e6d3a8', panel: 'rgba(255,248,225,.62)', solid: '#faf0d6', border: 'rgba(100,70,20,.22)', text: '#2f2010', muted: '#614c2a', accent: '#9e2a17', end: '#2a5a66', accent2: '#2a5a66', ru: '#1b5574', f: ['#fbf3dc', '#f2e4c0'], b: ['#f3ecd3', '#e9dfbf'], blobs: ['', '', ''], fx: ['#9e2a17', '#2a5a66', '#a5793a'], good: '#166534', warn: '#8a3b0b', bad: '#9f1239' } },
    { id: 'barbie', name: 'Барби', emoji: '💖', kind: 'style', desc: 'Ярко-розовая, блестящая и весёлая', pattern: 'sparkle',
      dark: { bg: '#1f0a1a', bg2: '#2a0d23', panel: 'rgba(255,150,210,.07)', solid: '#33112b', border: 'rgba(255,150,210,.2)', text: '#fff0f8', muted: '#e1abc9', accent: '#c90f72', end: '#8a2fc9', accent2: '#ff8cc6', ru: '#8fe3ff', f: ['#3d1434', '#2e0f27'], b: ['#341a3d', '#28122f'], blobs: ['#ff3ea5', '#c45cff', '#ff9ad2'], fx: ['#ff8cc6', '#ffffff', '#ffd1ea'] },
      light: { bg: '#fff0f7', bg2: '#ffe2f0', panel: 'rgba(255,255,255,.8)', solid: '#ffffff', border: 'rgba(200,20,120,.17)', text: '#3a0a26', muted: '#843a62', accent: '#c2116e', end: '#7a3cc8', accent2: '#7a3cc8', ru: '#0b66a0', f: ['#ffffff', '#fff1f8'], b: ['#fbf1ff', '#f6e8ff'], blobs: ['#ff7cc2', '#d79bff', '#ffb3db'], fx: ['#ff5fae', '#c45cff', '#ffb3db'] } },
    { id: 'vampire', name: 'Вампирская ночь', emoji: '🦇', kind: 'style', desc: 'Чёрный бархат, бордо и луна — готично, но читаемо', fx: 'bats', corner: 'moon',
      dark: { bg: '#0b0709', bg2: '#140a0e', panel: 'rgba(255,60,80,.05)', solid: '#1a0d12', border: 'rgba(255,90,110,.16)', text: '#f5e9ec', muted: '#b59ca3', accent: '#e11b3c', end: '#5b2380', accent2: '#ec6f8c', ru: '#a8d4ff', f: ['#22101a', '#190b12'], b: ['#1d1024', '#150b1a'], blobs: ['#8a0f24', '#4b1a6b', '#3a0a14'], fx: ['#6a4252', '#e3d4c4', '#a4142c'] },
      light: { bg: '#f4eeee', bg2: '#ebe2e3', panel: 'rgba(255,255,255,.75)', solid: '#fffafa', border: 'rgba(80,10,25,.15)', text: '#1d0d12', muted: '#684851', accent: '#8e1027', end: '#4b2a6b', accent2: '#4b2a6b', ru: '#1b5788', f: ['#fffafa', '#f6eded'], b: ['#f6f0f8', '#eee6f2'], blobs: ['#c46a7c', '#9b7ab8', '#e0b5bd'], fx: ['#3a1520', '#b8a99a', '#8e1027'], good: '#166534', warn: '#92400e' } },
    { id: 'neon', name: 'Неон', emoji: '🌃', kind: 'style', desc: 'Синтвейв: розовый и бирюзовый свет, сетка горизонта', pattern: 'neon',
      dark: { bg: '#0a0618', bg2: '#120a26', panel: 'rgba(255,0,200,.05)', solid: '#170d30', border: 'rgba(0,255,240,.22)', text: '#f4f0ff', muted: '#ab9fd2', accent: '#b8108f', end: '#5b2bd6', accent2: '#3ee8f2', ru: '#ffd36b', f: ['#1d1040', '#150b30'], b: ['#0e1d3a', '#0a142c'], blobs: ['#ff2fb9', '#00e5ff', '#7b2bff'], fx: ['#ff4fd1', '#3ee8f2', '#ffd36b'] },
      light: { bg: '#f5f2ff', bg2: '#ebe5ff', panel: 'rgba(255,255,255,.8)', solid: '#ffffff', border: 'rgba(90,20,160,.16)', text: '#1a0f33', muted: '#5b4c83', accent: '#ad0f87', end: '#4b23b8', accent2: '#0a6f86', ru: '#0a63a0', f: ['#ffffff', '#f6f1ff'], b: ['#eefbff', '#e6f5ff'], blobs: ['#ff7ad6', '#5ff0ff', '#a98bff'], fx: ['#e62fb0', '#13b9cc', '#7b2bff'] } },
    { id: 'watercolor', name: 'Акварель', emoji: '🎨', kind: 'style', desc: 'Мягкие размытые пятна краски на бумаге', pattern: 'paper', blobBoost: true,
      dark: { bg: '#141a24', bg2: '#18202c', panel: 'rgba(255,255,255,.06)', solid: '#1d2532', border: 'rgba(255,255,255,.12)', text: '#f1f3f8', muted: '#a9b2c5', accent: '#4b72ba', end: '#a3405f', accent2: '#f0a3b5', ru: '#8fd3f5', f: ['#222c3c', '#1b2331'], b: ['#28243a', '#1f1d2e'], blobs: ['#e98fa8', '#7fb3e6', '#f3c77a'], fx: ['#e98fa8', '#7fb3e6', '#f3c77a'] },
      light: { bg: '#fbf8f3', bg2: '#f3eee6', panel: 'rgba(255,255,255,.72)', solid: '#ffffff', border: 'rgba(40,40,60,.12)', text: '#23262e', muted: '#5c6270', accent: '#3d5fa3', end: '#a63f63', accent2: '#a63f63', ru: '#1d64a0', f: ['#ffffff', '#fbf6f0'], b: ['#f7f4fb', '#f0f4fa'], blobs: ['#f2a7bb', '#9cc5ee', '#f6d38f'], fx: ['#f2a7bb', '#9cc5ee', '#f6d38f'] } },
    { id: 'mocha', name: 'Мокко', emoji: '☕', kind: 'style', desc: 'Тёплый кофейный «Mocha Mousse» — цвет года Pantone 2025',
      dark: { bg: '#1a1310', bg2: '#211915', panel: 'rgba(255,225,200,.05)', solid: '#271d18', border: 'rgba(255,220,190,.14)', text: '#f6ece4', muted: '#bea898', accent: '#9e6644', end: '#5e6e4e', accent2: '#ddae88', ru: '#a5d3e6', f: ['#2f231d', '#261c17'], b: ['#2a2520', '#221e1a'], blobs: ['#a47864', '#d9a77f', '#6b4a3a'], fx: ['#ddae88', '#a47864', '#f6ece4'] },
      light: { bg: '#f5ede6', bg2: '#ecdfd4', panel: 'rgba(255,250,246,.8)', solid: '#fffaf6', border: 'rgba(70,40,20,.14)', text: '#2c1d15', muted: '#695243', accent: '#7c4e34', end: '#4a6a5c', accent2: '#4a6a5c', ru: '#1d5f84', f: ['#fffaf6', '#f7eee6'], b: ['#f4f3ee', '#ecebe4'], blobs: ['#c9a08a', '#e6c3a3', '#a47864'], fx: ['#a47864', '#c9a08a', '#e6c3a3'], good: '#166534', warn: '#92400e' } },
    { id: 'hytte', name: 'Хюгге', emoji: '🕯', kind: 'style', desc: 'Хижина в лесу: хвоя, дерево и свет свечи', pattern: 'forest',
      dark: { bg: '#0f1a14', bg2: '#13211a', panel: 'rgba(255,220,160,.05)', solid: '#17271e', border: 'rgba(220,200,150,.14)', text: '#f1efe2', muted: '#abb59d', accent: '#388157', end: '#8a5320', accent2: '#e8ad5c', ru: '#9fd6e6', f: ['#1c2f24', '#16261d'], b: ['#262619', '#1e1f15'], blobs: ['#2f6b48', '#e3a857', '#1d4a33'], fx: ['#e8ad5c', '#ffd89a', '#2f6b48'] },
      light: { bg: '#f3f1e7', bg2: '#e9e6d8', panel: 'rgba(255,253,245,.8)', solid: '#fffdf5', border: 'rgba(40,50,30,.15)', text: '#1c271f', muted: '#535d4c', accent: '#2a6142', end: '#8a4f17', accent2: '#8a4f17', ru: '#1c5f84', f: ['#fffdf5', '#f6f3e6'], b: ['#f6f2e4', '#efeadb'], blobs: ['#7fb08f', '#efc58a', '#b9cfa8'], fx: ['#c98a3c', '#efc58a', '#2a6142'], good: '#166534', warn: '#92400e' } },
    { id: 'contrast', name: 'Высокий контраст', emoji: '🔲', kind: 'style', desc: 'Максимально чётко: для яркого солнца и уставших глаз', noBlobs: true, flat: true,
      dark: { bg: '#000000', bg2: '#0a0a0a', panel: '#0d0d0d', solid: '#111111', border: 'rgba(255,255,255,.55)', text: '#ffffff', muted: '#d9d9d9', accent: '#1f5fd6', end: '#1f5fd6', accent2: '#ffd400', ru: '#7fdcff', f: ['#141414', '#0d0d0d'], b: ['#101820', '#0b1118'], blobs: ['', '', ''], fx: ['#ffffff', '#ffd400', '#7fdcff'] },
      light: { bg: '#ffffff', bg2: '#f2f2f2', panel: '#ffffff', solid: '#ffffff', border: 'rgba(0,0,0,.6)', text: '#000000', muted: '#333333', accent: '#0b4fc4', end: '#0b4fc4', accent2: '#0047b3', ru: '#00508f', f: ['#ffffff', '#ffffff'], b: ['#f3f8ff', '#f3f8ff'], blobs: ['', '', ''], fx: ['#000000', '#0b4fc4', '#333333'] } },

    /* ---------- 🇳🇴 Norway (kind 'norway': own group in the picker; the same looks exist as art-card templates in
       js/artcards-no.js). Decorations are our own drawings (see ART below): pattern = a landscape strip / texture behind
       everything, corner = one picture, head = the font of the headings (OFL fonts from fonts/, see css/apptheme.css) */
    { id: 'troll', name: 'Тролли', no: 'Troll', emoji: '🧌', kind: 'norway', desc: 'Замшелые камни, тролли в горах и тёплый закат — как в старой норвежской сказке', pattern: 'troll', corner: 'stones', serif: true, head: 'lora',
      dark: { bg: '#131910', bg2: '#182014', panel: 'rgba(255,220,160,.05)', solid: '#1d2618', border: 'rgba(230,210,160,.15)', text: '#f6efdc', muted: '#b9b096', accent: '#bd531b', end: '#4a6427', accent2: '#f0b35a', ru: '#a9d8e8', f: ['#22301d', '#1b2617'], b: ['#2e2418', '#241c13'], blobs: ['#e0843a', '#5f7f3a', '#c9a35a'], fx: ['#f0a04a', '#7f9f52', '#c98a4a'] },
      light: { bg: '#f4efe1', bg2: '#ebe3cf', panel: 'rgba(255,252,242,.8)', solid: '#fffcf2', border: 'rgba(60,50,20,.16)', text: '#221d12', muted: '#5b5340', accent: '#984113', end: '#43602a', accent2: '#8a4510', ru: '#1c5a7a', f: ['#fffcf2', '#f6f0e0'], b: ['#f2f3e4', '#e9ecd8'], blobs: ['#f0b070', '#a8c27a', '#e6cf9a'], fx: ['#d0782e', '#5f7f3a', '#8a6a3a'], good: '#166534', warn: '#92400e' } },
    { id: 'skog', name: 'Лес и грибы', no: 'Skog og sopp', emoji: '🍄', kind: 'norway', desc: 'Тёмные ели, мох, лисички и мухоморы в утреннем тумане', pattern: 'skog', corner: 'mushrooms', fx: 'mist', head: 'lora',
      dark: { bg: '#0b1611', bg2: '#0f1f18', panel: 'rgba(200,255,220,.045)', solid: '#12231b', border: 'rgba(190,230,200,.14)', text: '#eef6ee', muted: '#a3b8a8', accent: '#d33b2e', end: '#2c663b', accent2: '#f2b43c', ru: '#9fd6e6', f: ['#172f23', '#12251c'], b: ['#2a2416', '#211c12'], blobs: ['#2f7a4a', '#f2b43c', '#b8d8c8'], fx: ['#dfe9e2', '#5f9a6a', '#e0a63a'] },
      light: { bg: '#eef3ec', bg2: '#e2eadf', panel: 'rgba(255,255,255,.8)', solid: '#fbfdf9', border: 'rgba(20,50,30,.14)', text: '#13241a', muted: '#4a5d50', accent: '#a52e1e', end: '#2a5f38', accent2: '#2a5f38', ru: '#1b5c80', f: ['#ffffff', '#f1f6ef'], b: ['#fbf6e8', '#f4ecd8'], blobs: ['#8fc4a0', '#f5cf7a', '#c9ddd0'], fx: ['#ffffff', '#3f7a4c', '#d99a1e'], good: '#166534', warn: '#92400e' } },
    { id: 'viking', name: 'Викинги', no: 'Vikinger', emoji: '⛵', kind: 'norway', desc: 'Руны, драккар с головой дракона, кованые узоры, тёмное дерево и железо', pattern: 'viking', corner: 'shield', garland: 'runes', head: 'oswald',
      dark: { bg: '#12100e', bg2: '#191613', panel: 'rgba(255,230,200,.045)', solid: '#1f1b17', border: 'rgba(220,200,170,.16)', text: '#f2ece2', muted: '#b7ab9a', accent: '#c64a32', end: '#3c535e', accent2: '#d9a659', ru: '#9cc9dc', f: ['#2a231c', '#211b16'], b: ['#1f2629', '#191f22'], blobs: ['#8a3324', '#3e5560', '#d9a659'], fx: ['#c9a36a', '#8a989e', '#b04a32'] },
      light: { bg: '#f1ece4', bg2: '#e6dfd3', panel: 'rgba(255,252,246,.8)', solid: '#fcf9f3', border: 'rgba(50,35,20,.18)', text: '#211a12', muted: '#5b4f42', accent: '#7d2c1f', end: '#34505c', accent2: '#7a4f12', ru: '#1b5574', f: ['#fcf9f3', '#f3ede2'], b: ['#eef1f1', '#e3e8e9'], blobs: ['#d9a659', '#8aa0aa', '#c98a6a'], fx: ['#8a5a1e', '#4a5d66', '#7d2c1f'], good: '#166534', warn: '#92400e', bad: '#9f1239' } },
    { id: 'stavkirke', name: 'Ставкирка', no: 'Stavkirke', emoji: '⛪', kind: 'norway', desc: 'Просмолённое дерево, резные драконы на ярусных крышах', pattern: 'stavkirke', corner: 'dragon', serif: true, noBlobs: true, head: 'playfair',
      dark: { bg: '#120d0a', bg2: '#18110d', panel: 'rgba(255,200,150,.045)', solid: '#1d1510', border: 'rgba(230,180,130,.16)', text: '#f5ebdf', muted: '#bea996', accent: '#b75825', end: '#5a3d22', accent2: '#e0a86a', ru: '#a3cfe0', f: ['#271c15', '#1f1611'], b: ['#1d1f1a', '#171914'], blobs: ['', '', ''], fx: ['#d39a5c', '#8a6a4a', '#e8c49a'] },
      light: { bg: '#f3ebe0', bg2: '#e9dece', panel: 'rgba(255,250,244,.8)', solid: '#fdf8f1', border: 'rgba(70,40,15,.18)', text: '#24170e', muted: '#634d3a', accent: '#8a3d17', end: '#4d3520', accent2: '#3e5a2e', ru: '#1b5674', f: ['#fdf8f1', '#f4eadc'], b: ['#f2efe6', '#e8e3d6'], blobs: ['', '', ''], fx: ['#9a5a26', '#4d3520', '#b08a5a'], good: '#166534', warn: '#92400e', bad: '#9f1239' } },
    { id: 'fjellhytte', name: 'Хютте', no: 'Hytte på fjellet', emoji: '🏡', kind: 'norway', desc: 'Красный домик в горах, свеча в окне, плед и снег — koselig', pattern: 'hytte', corner: 'cabin', fx: 'snow', garland: 'plaid', head: 'lora',
      dark: { bg: '#11141f', bg2: '#161a28', panel: 'rgba(255,220,190,.05)', solid: '#1b1f2f', border: 'rgba(255,210,180,.15)', text: '#fbf3ea', muted: '#b8b0b4', accent: '#d8332d', end: '#2f5a3e', accent2: '#ffc76a', ru: '#9fd6f0', f: ['#2a1c20', '#21171b'], b: ['#1e2a26', '#18221f'], blobs: ['#a8241f', '#ffc76a', '#5f7fa8'], fx: ['#ffffff', '#ffc76a', '#dfe8f5'] },
      light: { bg: '#f7f1ea', bg2: '#efe5da', panel: 'rgba(255,252,248,.82)', solid: '#fffcf8', border: 'rgba(90,20,15,.15)', text: '#261513', muted: '#66504a', accent: '#9e1f1b', end: '#2b5539', accent2: '#2b5539', ru: '#1b5a80', f: ['#fffcf8', '#f8efe7'], b: ['#f1f5f1', '#e7eee8'], blobs: ['#e98a80', '#f6cf86', '#a9bdd6'], fx: ['#9fb6d2', '#d9952a', '#8aa6c4'], good: '#166534', warn: '#92400e' } },
    { id: 'elg', name: 'Лось', no: 'Elg', emoji: '🫎', kind: 'norway', desc: 'Лось в лесу и жёлтый дорожный знак «Elg»', pattern: 'elg', corner: 'elgsign', head: 'montserrat',
      dark: { bg: '#11130e', bg2: '#171a13', panel: 'rgba(255,230,120,.045)', solid: '#1c2017', border: 'rgba(240,220,140,.15)', text: '#f4f1e4', muted: '#b4b09a', accent: '#da3025', end: '#4b5a29', accent2: '#f5c518', ru: '#9fd2e6', f: ['#23271c', '#1c2017'], b: ['#2b2414', '#221c10'], blobs: ['#f5c518', '#4f5d2c', '#7a5a3a'], fx: ['#a89a6a', '#f5c518', '#8a7250'] },
      light: { bg: '#f6f3e6', bg2: '#ece7d3', panel: 'rgba(255,253,244,.82)', solid: '#fffdf4', border: 'rgba(50,45,15,.16)', text: '#1f1d12', muted: '#57533c', accent: '#a32019', end: '#45522a', accent2: '#6e4a1a', ru: '#1c5878', f: ['#fffdf4', '#f7f3e2'], b: ['#fdf7dc', '#f7efc8'], blobs: ['#f5d43a', '#9fb07a', '#c9a77a'], fx: ['#5a4a32', '#d9a800', '#6b5236'], good: '#166534', warn: '#92400e' } },
    { id: 'polar', name: 'Полуночное солнце · Полярная ночь', no: 'Midnattssol · Mørketid', emoji: '🌗', kind: 'norway', desc: 'Следует за временем года: светлое полугодие — золото полуночного солнца, тёмное — синяя полярная ночь со звёздами', seasonal: true },
    { id: 'midnattsol', name: 'Полуночное солнце', no: 'Midnattssol', emoji: '🌞', kind: 'variant', parent: 'polar', desc: 'Летнее золото в полночь: солнце не садится', pattern: 'midnattsol', head: 'montserrat',
      dark: { bg: '#191324', bg2: '#21192e', panel: 'rgba(255,210,140,.05)', solid: '#251c33', border: 'rgba(255,210,150,.16)', text: '#fff5e8', muted: '#c8b6b8', accent: '#b8580e', end: '#6d3fa0', accent2: '#ffc35a', ru: '#9fdcff', f: ['#2e2140', '#251b35'], b: ['#33231f', '#291c19'], blobs: ['#ffb347', '#ff7a5c', '#7a5ac8'], fx: ['#ffc35a', '#ff8a5c', '#ffe2b0'] },
      light: { bg: '#fff7ea', bg2: '#fdecd2', panel: 'rgba(255,255,255,.8)', solid: '#ffffff', border: 'rgba(140,80,10,.16)', text: '#2a1a08', muted: '#6b5030', accent: '#a3470a', end: '#6a3c9c', accent2: '#8a4a00', ru: '#0b5f99', f: ['#ffffff', '#fff6e8'], b: ['#fbf3ff', '#f4e9fb'], blobs: ['#ffc870', '#ff9a7a', '#c9a8f0'], fx: ['#f0a020', '#e8663a', '#ffcf70'], good: '#166534', warn: '#8a3b0b' } },
    { id: 'polarnatt', name: 'Полярная ночь', no: 'Mørketid', emoji: '🌌', kind: 'variant', parent: 'polar', desc: 'Глубокая синяя зима со звёздами и луной', pattern: 'polarnatt', corner: 'moon', fx: 'twinkle', head: 'montserrat',
      dark: { bg: '#060b1c', bg2: '#0a1127', panel: 'rgba(160,190,255,.05)', solid: '#0f1830', border: 'rgba(170,200,255,.15)', text: '#eef3ff', muted: '#a2aed0', accent: '#3d71ce', end: '#4a3a9a', accent2: '#9cc4ff', ru: '#7fe0d8', f: ['#131d3a', '#0f1830'], b: ['#101f33', '#0c1828'], blobs: ['#1b3a8a', '#3fb0c0', '#5a4ab0'], fx: ['#ffffff', '#bcd4ff', '#7fe8d0'] },
      light: { bg: '#eef2fb', bg2: '#e2e8f6', panel: 'rgba(255,255,255,.8)', solid: '#ffffff', border: 'rgba(15,35,90,.14)', text: '#0d1630', muted: '#4a5676', accent: '#23509e', end: '#43358f', accent2: '#23509e', ru: '#0a5a8c', f: ['#ffffff', '#f2f5fc'], b: ['#eef6fb', '#e3eef7'], blobs: ['#8aa8e8', '#7fd0d8', '#a99ae0'], fx: ['#4a64a8', '#23509e', '#7f9ad8'], good: '#166534', warn: '#92400e' } },
    { id: 'lofoten', name: 'Лофотены', no: 'Lofoten', emoji: '🐟', kind: 'norway', desc: 'Красные рорбу на сваях, вешала с треской, море и острые пики', pattern: 'lofoten', corner: 'rorbu', fx: 'gulls', head: 'montserrat',
      dark: { bg: '#0b1720', bg2: '#0f1e29', panel: 'rgba(180,220,255,.05)', solid: '#13232f', border: 'rgba(180,215,240,.15)', text: '#eef6fb', muted: '#9fb4c2', accent: '#db2f26', end: '#1f6474', accent2: '#f0c070', ru: '#8fd8ff', f: ['#172a38', '#13232f'], b: ['#2a1d1f', '#21171a'], blobs: ['#1f6474', '#b3261e', '#7fb8d8'], fx: ['#dce8f0', '#7f9fb4', '#e8c98a'] },
      light: { bg: '#eef4f7', bg2: '#e1ebf0', panel: 'rgba(255,255,255,.82)', solid: '#ffffff', border: 'rgba(10,45,65,.14)', text: '#0e1f2a', muted: '#485f6c', accent: '#a3221b', end: '#1a5866', accent2: '#1a5866', ru: '#0b5d96', f: ['#ffffff', '#f0f6f9'], b: ['#fdf3f1', '#f8e7e4'], blobs: ['#8fc0d4', '#e88a80', '#b8d4e4'], fx: ['#4a6474', '#5f7f94', '#b08a4a'] } },
    { id: 'frokost', name: 'Норвежский завтрак', no: 'Frokost', emoji: '🧇', kind: 'norway', desc: 'Брюност, вафли-сердечки и кофе — тепло и весело', pattern: 'frokost', corner: 'breakfast', head: 'comfortaa',
      dark: { bg: '#1a120c', bg2: '#22170f', panel: 'rgba(255,220,170,.05)', solid: '#281b12', border: 'rgba(255,210,160,.16)', text: '#fbf0e2', muted: '#c4ab92', accent: '#a5581b', end: '#8a2f3a', accent2: '#f2b65a', ru: '#a5d6ea', f: ['#33231a', '#2a1d15'], b: ['#2e1d21', '#26171b'], blobs: ['#c27a35', '#e8a94a', '#8a2f3a'], fx: ['#f2b65a', '#c27a35', '#e0606a'] },
      light: { bg: '#fdf5e8', bg2: '#f8e9d2', panel: 'rgba(255,255,255,.8)', solid: '#fffaf2', border: 'rgba(110,60,20,.17)', text: '#2b1a0c', muted: '#6a4f36', accent: '#93491a', end: '#8a2a35', accent2: '#8a2a35', ru: '#1a5b85', f: ['#fffaf2', '#fbf0de'], b: ['#fdf1ef', '#f8e5e3'], blobs: ['#f0b860', '#e8a07a', '#e88a94'], fx: ['#e0a040', '#a85a1c', '#c0303f'], good: '#166534', warn: '#8a3b0b' } },
    { id: 'kongelig', name: 'Королевская Норвегия', no: 'Kongelig', emoji: '👑', kind: 'norway', desc: 'Флаг, корона, золото на синем и красный бархат, парадные рамки', pattern: 'kongelig', corner: 'crown', garland: 'flags', serif: true, head: 'playfair',
      dark: { bg: '#0a1230', bg2: '#0e1840', panel: 'rgba(255,215,120,.05)', solid: '#121d4a', border: 'rgba(230,195,110,.2)', text: '#f7f3e6', muted: '#b9b8d0', accent: '#e3163f', end: '#7a1430', accent2: '#e6c36a', ru: '#a9d4ff', f: ['#16224f', '#121d44'], b: ['#2a1230', '#210e27'], blobs: ['#ba0c2f', '#1b3a9a', '#e6c36a'], fx: ['#e6c36a', '#ba0c2f', '#f7f3e6'], bad: '#ff7a8f' },
      light: { bg: '#f6f4ee', bg2: '#ece8dc', panel: 'rgba(255,255,255,.82)', solid: '#fffdf7', border: 'rgba(0,32,91,.16)', text: '#0d1838', muted: '#4b5272', accent: '#ba0c2f', end: '#00205b', accent2: '#00205b', ru: '#0a54a5', f: ['#fffdf7', '#f8f4e8'], b: ['#fbf1f2', '#f5e5e8'], blobs: ['#f0a0ae', '#8aa0e0', '#f0d890'], fx: ['#b8902e', '#ba0c2f', '#00205b'], good: '#166534', warn: '#8a3b0b', bad: '#9f1239' } },
    { id: 'gammel', name: 'Старая Норвегия', no: 'Gamle Norge', emoji: '📷', kind: 'norway', desc: 'Как фотоальбом начала 1900-х: сепия, зерно, потёртости и старинный шрифт', pattern: 'gammel', corner: 'album', fx: 'dust', serif: true, noBlobs: true, head: 'oldstd',
      dark: { bg: '#16130f', bg2: '#1c1813', panel: 'rgba(255,240,215,.045)', solid: '#211c16', border: 'rgba(235,220,190,.16)', text: '#f1e9da', muted: '#b8ab95', accent: '#87683f', end: '#4f4a44', accent2: '#d8c19a', ru: '#b9cfd8', f: ['#28221b', '#211c16'], b: ['#24221f', '#1d1b18'], blobs: ['', '', ''], fx: ['#e8dcc4', '#8a7a64', '#d8c19a'] },
      light: { bg: '#efe7d6', bg2: '#e5dbc6', panel: 'rgba(255,251,240,.66)', solid: '#faf4e6', border: 'rgba(60,45,25,.2)', text: '#231c13', muted: '#56493a', accent: '#6b4f2e', end: '#4a4540', accent2: '#5a4630', ru: '#2a4f63', f: ['#faf4e6', '#f1e8d4'], b: ['#efebe2', '#e6e0d4'], blobs: ['', '', ''], fx: ['#5a4a36', '#8a7a64', '#3a332a'], good: '#166534', warn: '#8a3b0b', bad: '#9f1239' } },

    /* ---------- holidays (also pickable by hand) ---------- */
    { id: 'nyttar', name: 'Новый год', no: 'Nyttår', emoji: '🎆', kind: 'holiday', desc: 'Полночь, золото и салют', fx: 'fireworks', garland: 'stars',
      dark: { bg: '#0a0d1f', bg2: '#0f1430', panel: 'rgba(240,200,120,.05)', solid: '#141a36', border: 'rgba(240,200,120,.17)', text: '#f5f3ff', muted: '#aaacd2', accent: '#7962cc', end: '#8a5a00', accent2: '#f0c04a', ru: '#8fdcff', f: ['#1b2142', '#141a36'], b: ['#24213e', '#1b1931'], blobs: ['#f0c04a', '#5a3fc0', '#2fb3ff'], fx: ['#f0c04a', '#ff6fa8', '#7fdcff'] },
      light: { bg: '#f6f3ff', bg2: '#ece7ff', panel: 'rgba(255,255,255,.8)', solid: '#ffffff', border: 'rgba(60,40,140,.15)', text: '#18143a', muted: '#555180', accent: '#5132b8', end: '#875800', accent2: '#875800', ru: '#0a62a0', f: ['#ffffff', '#f7f3ff'], b: ['#fffaf0', '#fbf3e0'], blobs: ['#f5cf6b', '#9a85f0', '#7fcaf7'], fx: ['#d99a00', '#d63f86', '#2f8fd6'] } },
    { id: 'samefolket', name: 'День саамского народа', no: 'Samefolkets dag', emoji: '☀️', kind: 'holiday', desc: 'Цвета саамского флага: красный, синий, зелёный, жёлтый', garland: 'sami', corner: 'samisun',
      dark: { bg: '#0d1424', bg2: '#111a2e', panel: 'rgba(255,255,255,.05)', solid: '#16203a', border: 'rgba(255,255,255,.13)', text: '#f2f5ff', muted: '#a5b0cd', accent: '#e41234', end: '#0035ad', accent2: '#ffce00', ru: '#7fd6ff', f: ['#1c2745', '#16203a'], b: ['#162d2a', '#112420'], blobs: ['#c8102e', '#0035ad', '#007229'], fx: ['#c8102e', '#0035ad', '#ffce00'] },
      light: { bg: '#f5f6fb', bg2: '#eaedf6', panel: 'rgba(255,255,255,.8)', solid: '#ffffff', border: 'rgba(10,30,90,.14)', text: '#121a33', muted: '#4d5673', accent: '#b30d27', end: '#00309c', accent2: '#00602a', ru: '#0a4fa8', f: ['#ffffff', '#f4f6fc'], b: ['#f2fbf5', '#e9f6ee'], blobs: ['#e86478', '#5f86e0', '#5fb57f'], fx: ['#c8102e', '#0035ad', '#e0b400'] } },
    { id: 'valentin', name: 'День святого Валентина', no: 'Valentinsdagen', emoji: '💕', kind: 'holiday', desc: 'Розовые сердечки и тепло', fx: 'hearts', garland: 'hearts',
      dark: { bg: '#1a0b12', bg2: '#22101a', panel: 'rgba(255,140,180,.06)', solid: '#2a1220', border: 'rgba(255,140,180,.18)', text: '#fff0f4', muted: '#d9a9b8', accent: '#dd1b68', end: '#8e2a8a', accent2: '#ff8fb0', ru: '#8fd8ff', f: ['#341628', '#2a1220'], b: ['#2f1630', '#251226'], blobs: ['#ff4f86', '#c2185b', '#ff9ec0'], fx: ['#ff5f8f', '#ff9ec0', '#ffd1df'] },
      light: { bg: '#fff3f6', bg2: '#ffe6ee', panel: 'rgba(255,255,255,.8)', solid: '#ffffff', border: 'rgba(170,20,70,.15)', text: '#3a0c1c', muted: '#834357', accent: '#b0174f', end: '#842a7e', accent2: '#842a7e', ru: '#0b65a0', f: ['#ffffff', '#fff2f6'], b: ['#fdf2fb', '#f9e8f6'], blobs: ['#ff8fb0', '#f2668f', '#ffc2d4'], fx: ['#e83a6f', '#ff8fb0', '#f9b2c8'] } },
    { id: 'fastelavn', name: 'Фастелавн', no: 'Fastelavn', emoji: '🪶', kind: 'holiday', desc: 'Цветные пёрышки на берёзовых веточках и булочки со сливками', fx: 'feathers', corner: 'ris',
      dark: { bg: '#141223', bg2: '#19162b', panel: 'rgba(255,255,255,.05)', solid: '#1f1b33', border: 'rgba(255,200,240,.15)', text: '#f6f2ff', muted: '#b2abcd', accent: '#aa45cd', end: '#b0480e', accent2: '#ffb347', ru: '#8fe0ff', f: ['#262041', '#1f1b33'], b: ['#2a2032', '#211a29'], blobs: ['#ff6fb5', '#ffb347', '#6fd3ff'], fx: ['#ff6fb5', '#ffd23f', '#5fd38a'] },
      light: { bg: '#fbf6ff', bg2: '#f3eaff', panel: 'rgba(255,255,255,.8)', solid: '#ffffff', border: 'rgba(100,40,140,.14)', text: '#221a33', muted: '#5c5277', accent: '#7e27a0', end: '#a8430c', accent2: '#a8430c', ru: '#0a62a0', f: ['#ffffff', '#faf4ff'], b: ['#fff7ee', '#fdf0e0'], blobs: ['#ff9fd0', '#ffcf80', '#9fdcff'], fx: ['#ef4f9f', '#f0b400', '#3fb56d'] } },
    { id: 'paske', name: 'Пасха', no: 'Påske', emoji: '🐣', kind: 'holiday', desc: 'Пасхальный жёлтый, цыплята и крашеные яйца', garland: 'eggs', corner: 'chick',
      dark: { bg: '#17150a', bg2: '#1d1a0d', panel: 'rgba(255,230,120,.05)', solid: '#24200f', border: 'rgba(255,220,100,.17)', text: '#fffbe6', muted: '#cbc195', accent: '#2f7a32', end: '#8a5d00', accent2: '#ffd23f', ru: '#8fd8ff', f: ['#2c2712', '#24200f'], b: ['#1f2a14', '#19220f'], blobs: ['#ffd23f', '#7ccf6a', '#ffb3c7'], fx: ['#ffd23f', '#9be08a', '#ffb3c7'] },
      light: { bg: '#fffbe8', bg2: '#fff3c4', panel: 'rgba(255,255,255,.78)', solid: '#ffffff', border: 'rgba(120,90,0,.18)', text: '#2b2405', muted: '#655a26', accent: '#2c6c2f', end: '#8a5d00', accent2: '#8a5d00', ru: '#0b609c', f: ['#ffffff', '#fffbea'], b: ['#f6fcef', '#eef8e4'], blobs: ['#ffe066', '#a8e39a', '#ffc2d1'], fx: ['#f2c200', '#6cc35a', '#f59ab4'] } },
    { id: 'mai17', name: '17 мая', no: '17. mai', emoji: '🇳🇴', kind: 'holiday', desc: 'День Конституции: флажки, красный-белый-синий, вышивка бунада', garland: 'flags', fx: 'confetti', corner: 'flag', pattern: 'bunad',
      dark: { bg: '#0b1430', bg2: '#0f1a3a', panel: 'rgba(255,255,255,.06)', solid: '#15214a', border: 'rgba(255,255,255,.15)', text: '#f5f7ff', muted: '#acb5d8', accent: '#e40f3a', end: '#1b3c8f', accent2: '#8fb2ff', ru: '#8fdcff', f: ['#1a2a5a', '#15214a'], b: ['#2a1a3a', '#211630'], blobs: ['#ba0c2f', '#1b4fd8', '#ffffff'], fx: ['#e8203f', '#ffffff', '#3b6dff'] },
      light: { bg: '#f6f8ff', bg2: '#eaefff', panel: 'rgba(255,255,255,.82)', solid: '#ffffff', border: 'rgba(0,32,91,.15)', text: '#0c1838', muted: '#4b5676', accent: '#ba0c2f', end: '#00205b', accent2: '#00205b', ru: '#0a54a5', f: ['#ffffff', '#f5f7ff'], b: ['#fff5f6', '#fdebee'], blobs: ['#f06a83', '#6c8fe8', '#c9d6ff'], fx: ['#ba0c2f', '#c9d2e6', '#00205b'] } },
    { id: 'sankthans', name: 'Санктханс', no: 'Sankthans', emoji: '🔥', kind: 'holiday', desc: 'Белая ночь середины лета и костёр у воды', fx: 'sparks', corner: 'bonfire',
      dark: { bg: '#120c16', bg2: '#181020', panel: 'rgba(255,190,120,.05)', solid: '#1f1525', border: 'rgba(255,180,110,.16)', text: '#fff4ea', muted: '#cbad9e', accent: '#b8400d', end: '#7a2fa0', accent2: '#ffb347', ru: '#8fd3ff', f: ['#2a1b2c', '#1f1525'], b: ['#2b1c1a', '#211513'], blobs: ['#ff7a2f', '#7a2fa0', '#ffb347'], fx: ['#ffb347', '#ff7a2f', '#ffe08a'] },
      light: { bg: '#fff6ee', bg2: '#ffecdc', panel: 'rgba(255,255,255,.8)', solid: '#ffffff', border: 'rgba(130,60,10,.16)', text: '#2a160c', muted: '#6b4a38', accent: '#b23a0b', end: '#2a6849', accent2: '#2a6849', ru: '#0b609c', f: ['#ffffff', '#fff6ee'], b: ['#f4faf3', '#ebf5ea'], blobs: ['#ffb07a', '#c9a0e6', '#ffd59a'], fx: ['#f08a24', '#e0541b', '#f5b942'] } },
    { id: 'halloween', name: 'Хэллоуин', no: 'Halloween', emoji: '🎃', kind: 'holiday', desc: 'Тыквы, летучие мыши и оранжевый свет', fx: 'bats', garland: 'bunting', corner: 'pumpkin',
      dark: { bg: '#120d0a', bg2: '#19120d', panel: 'rgba(255,150,60,.05)', solid: '#1f1712', border: 'rgba(255,150,60,.17)', text: '#fff2e6', muted: '#c6ad98', accent: '#bf400c', end: '#6b3fa0', accent2: '#ff9a3d', ru: '#a8d4ff', f: ['#2a1d14', '#1f1712'], b: ['#241a2e', '#1b1424'], blobs: ['#ff7a1a', '#6b3fa0', '#3a8a2a'], fx: ['#6b5478', '#ff9a3d', '#9b6bd6'] },
      light: { bg: '#fff5ea', bg2: '#ffead2', panel: 'rgba(255,255,255,.8)', solid: '#ffffff', border: 'rgba(130,60,10,.16)', text: '#2a1607', muted: '#6a4830', accent: '#b33a0a', end: '#5f3594', accent2: '#5f3594', ru: '#0b609c', f: ['#ffffff', '#fff5ea'], b: ['#f7f1fd', '#efe6fa'], blobs: ['#ffae66', '#b896e0', '#ffd09a'], fx: ['#2a1a22', '#f07a1a', '#7d4fc0'] } },
    { id: 'lucia', name: 'День святой Люсии', no: 'Luciadagen', emoji: '🕯', kind: 'holiday', desc: 'Свечи в тёмное утро, белые платья и шафрановые булочки', corner: 'candles', fx: 'glow',
      dark: { bg: '#0d1020', bg2: '#11152a', panel: 'rgba(255,220,150,.05)', solid: '#171c33', border: 'rgba(255,220,150,.16)', text: '#fbf7ec', muted: '#b8b2ca', accent: '#d73340', end: '#8a5600', accent2: '#ffc94d', ru: '#8fd8ff', f: ['#1d2340', '#171c33'], b: ['#262236', '#1d1a2b'], blobs: ['#ffc94d', '#a3202a', '#5f6fd8'], fx: ['#ffc94d', '#ffe9a8', '#ff8a3d'] },
      light: { bg: '#fffaf0', bg2: '#fbf1dc', panel: 'rgba(255,255,255,.8)', solid: '#ffffff', border: 'rgba(120,80,10,.16)', text: '#2a1f10', muted: '#69583a', accent: '#a11d27', end: '#875300', accent2: '#875300', ru: '#0b609c', f: ['#ffffff', '#fffaf0'], b: ['#fff6ea', '#fbefdc'], blobs: ['#ffd77a', '#f08a8a', '#c7cff5'], fx: ['#e8a400', '#f6c94d', '#e0541b'] } },
    { id: 'jul', name: 'Рождество', no: 'Jul', emoji: '🎄', kind: 'holiday', desc: 'Снег, огоньки гирлянды, ниссе и ель', fx: 'snow', garland: 'lights', corner: 'nisse',
      dark: { bg: '#0b1712', bg2: '#0f1f18', panel: 'rgba(255,255,255,.05)', solid: '#13271e', border: 'rgba(220,255,230,.14)', text: '#f4fbf6', muted: '#a9c0b2', accent: '#e3173a', end: '#1b6e45', accent2: '#f2c14e', ru: '#8fdcff', f: ['#173126', '#13271e'], b: ['#2a1a1e', '#211518'], blobs: ['#b3122e', '#1f7a4d', '#f2c14e'], fx: ['#ffffff', '#f2c14e', '#e8f4ff'] },
      light: { bg: '#f7f6f1', bg2: '#ecebe2', panel: 'rgba(255,255,255,.8)', solid: '#ffffff', border: 'rgba(20,60,40,.14)', text: '#13241b', muted: '#4d6255', accent: '#b3122e', end: '#1b6e45', accent2: '#1b6e45', ru: '#0b609c', f: ['#ffffff', '#f7f6f1'], b: ['#fff6f6', '#fbecec'], blobs: ['#e86478', '#6fbf8f', '#f5d27a'], fx: ['#a9c3d8', '#d8a62a', '#8fb3cf'] } },
  ];
  var BY = {};
  THEMES.forEach(function (t) { BY[t.id] = t; });
  /* names other parts of the app (e.g. the art cards) might use for the same thing */
  var ALIAS = { normal: 'default', 'default': 'default', christmas: 'jul', xmas: 'jul', advent: 'jul', newyear: 'nyttar', nyttaar: 'nyttar', 'nyttår': 'nyttar', easter: 'paske', 'påske': 'paske',
    may17: 'mai17', '17mai': 'mai17', grunnlovsdagen: 'mai17', midsummer: 'sankthans', valentine: 'valentin', valentines: 'valentin', sami: 'samefolket', saami: 'samefolket', northernlights: 'aurora', nordlys: 'aurora',
    trolls: 'troll', forest: 'skog', mushrooms: 'skog', vikings: 'viking', stave: 'stavkirke', stavechurch: 'stavkirke', cabin: 'fjellhytte', moose: 'elg', midnattssol: 'midnattsol', midnightsun: 'midnattsol',
    morketid: 'polarnatt', 'mørketid': 'polarnatt', polarnight: 'polarnatt', breakfast: 'frokost', royal: 'kongelig', oldnorway: 'gammel', sepia: 'gammel' };
  function norm(id) { id = String(id || '').toLowerCase(); return BY[id] ? id : (ALIAS[id] && BY[ALIAS[id]] ? ALIAS[id] : null); }
  /**
   * «Полуночное солнце · Полярная ночь» (id 'polar') follows the season: the light half of the year (spring equinox
   * 20 March … autumn equinox 22 September) → 'midnattsol', the dark half → 'polarnatt'. Both variants can also be
   * pinned by hand (AppThemes.set('midnattsol' | 'polarnatt')); they are kind 'variant' and not shown as own tiles.
   */
  function polarVariant(date) {
    var d = date ? new Date(date) : new Date(); if (isNaN(d)) d = new Date();
    var md = (d.getMonth() + 1) * 100 + d.getDate();
    return md >= 320 && md <= 922 ? 'midnattsol' : 'polarnatt';
  }
  /** a theme id → the theme that really carries the colours (only 'polar' differs) */
  function resolve(id) { return id === 'polar' ? polarVariant() : id; }

  /* ---------------------------------------------------------------- calendar */
  var MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  function now() { return new Date(); }
  function mk(y, m, d) { return new Date(y, m - 1, d, 12, 0, 0, 0); } // local noon: no DST edge
  function add(dt, n) { return mk(dt.getFullYear(), dt.getMonth() + 1, dt.getDate() + n); }
  function dayNo(dt) { return Math.round(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) / 864e5); }
  function ymd(dt) { var m = dt.getMonth() + 1, d = dt.getDate(); return dt.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d; }
  function ru(dt) { return dt.getDate() + ' ' + MON[dt.getMonth()]; }
  /** «5–7 февраля», «29 марта – 6 апреля», «13 декабря» */
  function range(a, b) { if (dayNo(a) === dayNo(b)) return ru(a); return a.getMonth() === b.getMonth() ? a.getDate() + '–' + ru(b) : ru(a) + ' – ' + ru(b); }
  /** Easter Sunday (Gregorian, «Anonymous» algorithm) */
  function easter(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    return mk(y, mo, da);
  }
  /* what the holiday is — said in Russian, with a Norwegian greeting to learn */
  var INFO = {
    nyttar: { say: 'Godt nytt år!', sayRu: 'С Новым годом!', what: 'Новый год', flag: '🎆' },
    samefolket: { say: 'Gratulerer med samefolkets dag!', sayRu: 'С Днём саамского народа!', what: 'День саамского народа (Samefolkets dag)', flag: '☀️' },
    valentin: { say: 'Jeg er glad i deg!', sayRu: 'Я тебя люблю (тепло, по-дружески тоже)', what: 'День святого Валентина', flag: '💕' },
    fastelavn: { say: 'God fastelavn!', sayRu: 'Хорошего Фастелавна!', what: 'Фастелавн — воскресенье булочек fastelavnsboller', flag: '🪶' },
    paske: { say: 'God påske!', sayRu: 'Хорошей Пасхи!', what: 'Пасха (Påske)', flag: '🐣' },
    mai17: { say: 'Gratulerer med dagen!', sayRu: 'Поздравляю с праздником!', what: 'День Конституции Норвегии (Grunnlovsdagen)', flag: '🇳🇴' },
    sankthans: { say: 'God sankthans!', sayRu: 'Хорошего Санктханса!', what: 'Sankthansaften — костры в самую светлую ночь', flag: '🔥' },
    halloween: { say: 'Knask eller knep!', sayRu: 'Сладость или гадость!', what: 'Хэллоуин', flag: '🎃' },
    lucia: { say: 'Luciadagen', sayRu: 'День святой Люсии', what: 'День святой Люсии — свечи и шафрановые булочки lussekatter', flag: '🕯' },
    jul: { say: 'God jul!', sayRu: 'Счастливого Рождества!', what: 'Рождество (Jul)', flag: '🎄' },
  };
  /**
   * every holiday window that STARTS in this year (Nyttår of this year's December runs into the next January),
   * sorted by start. { id, theme, key ('jul-2026' — the year of the main day), name, no, emoji, start, end, day
   * ('YYYY-MM-DD'), startDate/endDate/dayDate (Date, local noon), prio }
   */
  function holidays(year) {
    year = Number(year) || now().getFullYear();
    var E = easter(year), out = [];
    function h(id, s, e, day, prio) {
      var t = BY[id];
      out.push({ id: id, theme: id, key: id + '-' + day.getFullYear(), name: t.name, no: t.no, emoji: t.emoji, prio: prio,
        start: ymd(s), end: ymd(e), day: ymd(day), startDate: s, endDate: e, dayDate: day, say: INFO[id].say, sayRu: INFO[id].sayRu, what: INFO[id].what });
    }
    h('samefolket', mk(year, 2, 5), mk(year, 2, 6), mk(year, 2, 6), 8);
    h('valentin', mk(year, 2, 12), mk(year, 2, 14), mk(year, 2, 14), 6);
    h('fastelavn', add(E, -51), add(E, -49), add(E, -49), 5);       // Fri–Sun, Fastelavnssøndag = Easter − 49
    h('paske', add(E, -7), add(E, 1), E, 7);                         // Palmesøndag … 2. påskedag
    h('mai17', mk(year, 5, 16), mk(year, 5, 18), mk(year, 5, 17), 9);
    h('sankthans', mk(year, 6, 22), mk(year, 6, 24), mk(year, 6, 23), 6);
    h('halloween', mk(year, 10, 25), mk(year, 10, 31), mk(year, 10, 31), 6);
    h('jul', mk(year, 12, 1), mk(year, 12, 26), mk(year, 12, 24), 4);
    h('lucia', mk(year, 12, 13), mk(year, 12, 13), mk(year, 12, 13), 10);
    h('nyttar', mk(year, 12, 27), mk(year + 1, 1, 2), mk(year + 1, 1, 1), 6);
    out.sort(function (a, b) { return dayNo(a.startDate) - dayNo(b.startDate) || b.prio - a.prio; });
    return out.map(function (o) { return Object.assign({}, o); });
  }
  /** the holiday window today is in (the most specific one when two overlap), or null. Extra: offset (days from the main day) */
  function today(date) {
    var dt = date ? new Date(date) : now();
    if (isNaN(dt)) dt = now();
    var n = dayNo(dt), y = dt.getFullYear(), best = null;
    holidays(y - 1).concat(holidays(y)).forEach(function (o) {
      if (n < dayNo(o.startDate) || n > dayNo(o.endDate)) return;
      if (!best || o.prio > best.prio) best = o;
    });
    if (!best) return null;
    best.offset = n - dayNo(best.dayDate);
    best.isDay = best.offset === 0 || (best.id === 'nyttar' && best.offset === -1); // nyttårsaften counts too
    return best;
  }
  /** the next holiday windows from today on (for the picker's little calendar) */
  function upcoming(count, date) {
    var dt = date ? new Date(date) : now(), n = dayNo(dt), y = dt.getFullYear();
    return holidays(y - 1).concat(holidays(y), holidays(y + 1)).filter(function (o) { return dayNo(o.endDate) >= n; })
      .filter(function (o, i, a) { return a.findIndex(function (x) { return x.key === o.key; }) === i; }).slice(0, count || 4);
  }

  /* ---------------------------------------------------------------- settings */
  var S = { v: 1, theme: 'default', hol: 'auto', auto: true, deco: true, seen: {}, off: {}, lm: '' };
  /** «↺ Вернуть как было»: what a new user gets (lm — light / dark: 'auto' = «🖥 Как в системе») */
  var DEF = { theme: 'default', hol: 'auto', deco: true, lm: 'auto' };
  function normLm(v) { return v === 'auto' || v === 'dark' || v === 'light' ? v : ''; }
  function isHol(id) { return !!(BY[id] && BY[id].kind === 'holiday'); }
  /** 'auto' | 'off' | a holiday id; anything else → fallback */
  function normHol(v, fallback) { if (v === 'auto' || v === 'off') return v; var n = norm(v); return n && isHol(n) ? n : (fallback || 'auto'); }
  /** theme + holiday mode from any source: an old «manual» holiday theme becomes «this holiday always» */
  function fixPair(theme, hol) {
    var th = norm(theme) || 'default';
    if (isHol(th)) { if (hol !== 'off' && !isHol(hol)) hol = th; th = 'default'; }
    return { theme: th, hol: hol };
  }
  function load() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && typeof o === 'object') {
        var fp = fixPair(o.theme, normHol(o.hol, o.auto === false ? 'off' : 'auto'));
        S.theme = fp.theme; S.hol = fp.hol; S.auto = S.hol === 'auto';
        S.deco = o.deco !== false;
        var flags = function (x) { var r = {}; if (x && typeof x === 'object') Object.keys(x).slice(0, 80).forEach(function (k) { if (/^[a-z0-9]{2,16}-\d{4}$/.test(k)) r[k] = 1; }); return r; };
        S.seen = flags(o.seen); S.off = flags(o.off);
        S.lm = normLm(o.lm);
      }
    } catch (e) { /* private mode / broken JSON → defaults */ }
  }
  function save() {
    // keep only this and last year's one-time flags
    var y = now().getFullYear(), keep = function (o) { var r = {}; Object.keys(o).forEach(function (k) { if (+k.slice(-4) >= y - 1) r[k] = 1; }); return r; };
    S.seen = keep(S.seen); S.off = keep(S.off);
    S.auto = S.hol === 'auto';
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full / blocked: works for this visit */ }
    toStore();
  }
  load();

  /* the same choice in Store.settings.appTheme (backups, the cloud copy, another device) */
  var SK = 'appTheme';
  function storeSettings() { try { return W.Store && W.Store.state && W.Store.state.settings ? W.Store.state.settings : null; } catch (e) { return null; } }
  function toStore() {
    var st = storeSettings(); if (!st) return; // not loaded yet (this file runs in <head>): fromStore() writes it later
    var o = st[SK], p = { theme: S.theme, holiday: S.hol, deco: S.deco };
    if (o && o.theme === p.theme && o.holiday === p.holiday && o.deco === p.deco) return;
    try { W.Store.setSetting(SK, p); } catch (e) { /* storage full: this device still has it */ }
  }
  /** Store.settings → S when they differ (a restored backup / the cloud copy); → true when something changed */
  function fromStore() {
    var st = storeSettings(); if (!st) return false;
    var o = st[SK];
    if (!o || typeof o !== 'object' || Array.isArray(o)) { toStore(); return false; } // first start with this version: this device's choice goes in
    var fp = fixPair(o.theme, normHol(o.holiday, 'auto')), deco = o.deco !== false;
    if (fp.theme === S.theme && fp.hol === S.hol && deco === S.deco) return false;
    S.theme = fp.theme; S.hol = fp.hol; S.deco = deco; S.auto = S.hol === 'auto';
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* blocked */ }
    toStore(); // a value that needed fixing is written back clean
    return true;
  }

  /* ---------------------------------------------------------------- resolve + apply */
  function mode() { return H.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }

  /* ---------------------------------------------------------------- light / dark: 🖥 Как в системе · 🌙 · ☀️
   * The choice lives in Store.settings.theme: 'auto' | 'dark' | 'light' (App.applyTheme in js/app.js already reads
   * 'auto' as prefers-color-scheme and re-applies on its 'change'). 'auto' is the default for NEW users: start() below
   * switches Store.DEFAULT_SETTINGS.theme 'dark' → 'auto' before Store.load() (our DOMContentLoaded listener is
   * registered in <head>, before App.init's), so a saved choice of an existing user stays exactly as it was.
   * S.lm keeps a copy on this device, so the right mode is painted before Store has loaded (no dark flash on a light system).
   */
  function sysDark() { try { return W.matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return true; } }
  /** 'auto' | 'dark' | 'light' — what the person chose (not what is on screen: see mode()) */
  function lightDark() { var st = storeSettings(), v = st ? normLm(st.theme) : ''; return v || S.lm || mode(); }
  function keepLm(v) { v = normLm(v); if (!v || v === S.lm) return; S.lm = v; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* blocked */ } }
  /** paint data-theme ourselves (no App yet / no Store yet) */
  function paintMode(v) { var want = v === 'auto' ? (sysDark() ? 'dark' : 'light') : v === 'light' ? 'light' : 'dark'; if (H.getAttribute('data-theme') !== want) H.setAttribute('data-theme', want); }
  /** set light / dark without redrawing the window (setMode / resetDefaults redraw once) */
  function applyMode(v) {
    v = normLm(v) || DEF.lm;
    keepLm(v);
    if (W.Store && Store.setSetting && storeSettings()) {
      if (Store.settings.theme !== v) Store.setSetting('theme', v);
      if (W.App && App.applyTheme) App.applyTheme(); else paintMode(v);
      if (W.App && App.view && App.view.name === 'settings' && App.render) App.render(); // its «Тема» select shows the same
    } else paintMode(v);
  }
  /** a brand-new user: «Как в системе» instead of the old «always dark» (Store.load() merges these defaults) */
  function newUserDefault() { try { var d = W.Store && W.Store.DEFAULT_SETTINGS; if (d && !W.Store.state && d.theme === 'dark') d.theme = DEF.lm; } catch (e) { /* ignore */ } }
  if (S.lm) paintMode(S.lm); // before the first paint (index.html starts as data-theme="dark")
  /** which theme is on now and why: { id, source: 'always' | 'holiday' | 'manual' | 'default', holiday } */
  function current() {
    var hol = today();
    if (isHol(S.hol)) return { id: S.hol, source: 'always', holiday: hol }; // «всегда Хэллоуин»: whatever the calendar says
    if (hol && S.hol === 'auto' && !S.off[hol.key]) return { id: hol.theme, source: 'holiday', holiday: hol };
    return { id: S.theme, source: S.theme === 'default' ? 'default' : 'manual', holiday: hol };
  }
  function motionOK() {
    var reduce = false;
    try { reduce = W.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* old browser */ }
    var force = false;
    try { force = !!(W.Store && W.Store.settings && W.Store.settings.artMotion === 'on'); } catch (e) { /* no Store yet */ }
    return !reduce || force;
  }
  /** full colour set of a theme in a mode (for art cards etc.); default → the app's own colours */
  var BASE = {
    dark: { bg: '#0f1222', bg2: '#161a30', panel: 'rgba(255,255,255,.06)', solid: '#1b2040', border: 'rgba(255,255,255,.10)', text: '#eef0ff', muted: '#9aa1c7', accent: '#e3173a', end: '#5b8cff', accent2: '#29c7ff', ru: '#5fd0ff', f: ['#262c55', '#1d2246'], b: ['#1e3a4f', '#19263f'], blobs: ['#7c6cff', '#29c7ff', '#ff5fa2'], fx: ['#ffffff', '#29c7ff', '#7c6cff'] },
    light: { bg: '#f3f4fb', bg2: '#e8eaf7', panel: 'rgba(255,255,255,.75)', solid: '#ffffff', border: 'rgba(20,24,60,.10)', text: '#171a33', muted: '#5d6390', accent: '#7c6cff', end: '#5b8cff', accent2: '#29c7ff', ru: '#0a7fc2', f: ['#ffffff', '#eef0ff'], b: ['#f0fbff', '#e6f0ff'], blobs: ['#7c6cff', '#29c7ff', '#ff5fa2'], fx: ['#7c6cff', '#29c7ff', '#ff5fa2'] },
  };
  function palette(id, m) {
    var t = BY[resolve(norm(id) || 'default')];
    m = m === 'light' ? 'light' : m === 'dark' ? 'dark' : mode();
    var p = (t[m] || BASE[m]);
    return JSON.parse(JSON.stringify(p));
  }

  /* own SVG patterns / ornaments (data URIs; drawn here, no images) */
  function svg(s) { return 'url("data:image/svg+xml,' + encodeURIComponent(s).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29') + '")'; }
  /* ---------------------------------------------------------------- 🇳🇴 Norway: our own drawings
   * Hand-drawn here as SVG (no images, nothing copied — in the spirit of old Norwegian fairy-tale illustration, but
   * our own shapes). ART[name] = { vb: [w, h], g: function (c) → SVG fragment } — c overrides the colours; c.flat → a
   * one-colour silhouette (c.f). Fragments have no ids (they may appear many times on one page). Used by the app
   * (background strips, corner pictures, picker previews) and by the art-card templates (js/artcards-no.js via
   * AppThemes.art). The royal theme draws a generic crown only — never the royal / state coat of arms or a monogram.
   */
  function f1(v) { return String(Math.round(v * 10) / 10); }
  /** a spruce: x = middle, b = ground, h = height */
  function spruce(x, b, h, fill, op) {
    var T = [[0.27, 0.12], [0.5, 0.2], [0.74, 0.29], [0.94, 0.38]], r = [];
    T.forEach(function (t, i) { var y = b - h + t[0] * h; r.push([x + t[1] * h, y]); if (i < T.length - 1) r.push([x + t[1] * h * 0.45, y + h * 0.02]); });
    var tw = Math.max(0.8, h * 0.035), R = r.map(function (q) { return f1(q[0]) + ' ' + f1(q[1]); }), L = r.slice().reverse().map(function (q) { return f1(2 * x - q[0]) + ' ' + f1(q[1]); });
    return '<path d="M' + f1(x) + ' ' + f1(b - h) + 'L' + R.join('L') + 'L' + f1(x + tw) + ' ' + f1(b - h * 0.06) + 'L' + f1(x + tw) + ' ' + f1(b) + 'L' + f1(x - tw) + ' ' + f1(b) + 'L' + f1(x - tw) + ' ' + f1(b - h * 0.06) + 'L' + L.join('L') + 'Z" fill="' + fill + '"' + (op != null ? ' opacity="' + op + '"' : '') + '/>';
  }
  function at(x, y, s, inner, flip) { return '<g transform="translate(' + f1(x) + ' ' + f1(y) + ') scale(' + (flip ? -s : s) + ' ' + s + ')">' + inner + '</g>'; }
  var MOOSE = 'M86 24C89 30 89 40 85 45L85 70H81L79 49H74L73 70H69L67 48C60 50 52 50 46 48L45 70H41L40 48L37 47L36 70H32L31 45C29 41 27 38 25 36L22 43L19 37L9 38C5 38 3 33 6 31L17 24L23 22C29 16 38 12 46 14C58 16 74 18 86 24Z'
    + 'M24 21C20 14 22 6 30 4L31 8L34 3L35 8L39 4L39 9L43 6C40 13 32 17 26 22Z M21 22C17 14 12 8 6 7L8 11L3 11L7 14L3 16L9 17C13 19 17 21 20 23Z M86 25l4 7-3 1z';
  var ART = {
    /* a troll's head in profile with spruces growing on it (faces right) */
    troll: { vb: [200, 170], g: function (c) {
      var f = c.f || '#4a5634', e = c.eye || '#ffcf6a', t = c.tree || (c.flat ? f : '#2f3d24'), l = c.line || 'rgba(20,16,8,.45)';
      return '<path d="M14 170C10 128 22 82 58 58C92 36 136 40 152 72C156 80 158 86 160 92C178 92 198 100 199 114C200 126 186 132 170 128C170 138 172 148 160 152L158 170Z" fill="' + f + '"/>'
        + spruce(66, 61, 30, t) + spruce(88, 52, 40, t) + spruce(114, 48, 32, t) + spruce(136, 60, 22, t)
        + (c.flat ? '' : '<path d="M64 104c-12-6-18 8-6 16M152 134c-6 5-14 5-20 1M118 90c6-4 14-4 20 0" fill="none" stroke="' + l + '" stroke-width="3" stroke-linecap="round"/><path d="M40 150c6-10 18-14 28-10M90 140c4-8 14-10 20-6" fill="none" stroke="' + (c.moss || '#7f9f52') + '" stroke-width="6" stroke-linecap="round" opacity=".7"/>')
        + '<circle cx="139" cy="100" r="5.5" fill="' + e + '"/>' + (c.flat ? '' : '<circle cx="140.6" cy="98.4" r="1.7" fill="#fff" opacity=".85"/>');
    } },
    /* mossy round stones */
    stones: { vb: [300, 100], g: function (c) {
      var s = c.f || '#6f6a5c', s2 = c.f2 || (c.flat ? s : '#5c584c'), m = c.moss || (c.flat ? s : '#6f9a45');
      return '<ellipse cx="72" cy="74" rx="68" ry="30" fill="' + s + '"/><ellipse cx="184" cy="80" rx="50" ry="22" fill="' + s2 + '"/><ellipse cx="262" cy="86" rx="38" ry="15" fill="' + s + '"/>'
        + (c.flat ? '' : '<g fill="none" stroke="' + m + '" stroke-linecap="round"><path d="M12 66C34 40 108 36 134 62" stroke-width="10"/><path d="M140 74C154 58 204 54 228 72" stroke-width="8"/><path d="M228 82c12-10 52-12 68 0" stroke-width="6"/></g><g fill="' + m + '"><circle cx="40" cy="70" r="4"/><circle cx="96" cy="66" r="3"/><circle cx="170" cy="76" r="3"/><circle cx="200" cy="72" r="2.5"/></g><path d="M30 86c20 6 60 8 86 2" stroke="rgba(0,0,0,.18)" stroke-width="3" fill="none" stroke-linecap="round"/>');
    } },
    /* fly agarics, chanterelles, a moss mound */
    mushrooms: { vb: [140, 120], g: function (c) {
      var red = c.red || '#d6332a', gold = c.gold || '#f2b43c', moss = c.moss || '#3f6b35', stem = c.stem || '#f3ecdc';
      var cap = function (x, y, s) { return at(x, y, s, '<path d="M-6 46C-4 30-4 16-6 4h14c-2 12-2 26 0 42z" fill="' + stem + '"/><path d="M-8 18c6 4 14 4 18 0" stroke="#d9cdb4" stroke-width="3" fill="none"/><path d="M-28 6C-28-16-12-30 1-30S30-16 30 6C16 10-14 10-28 6z" fill="' + red + '"/><g fill="#fff"><circle cx="-14" cy="-12" r="3.4"/><circle cx="2" cy="-20" r="3"/><circle cx="16" cy="-8" r="3.6"/><circle cx="-2" cy="-4" r="2.4"/><circle cx="-20" cy="2" r="2"/><circle cx="22" cy="2" r="2"/></g>'); };
      var ch = function (x, y, s) { return at(x, y, s, '<path d="M-4 22c0-10 2-16 3-20-9-2-15-8-15-12 6 2 14 1 16 1s10 1 16-1c0 4-6 10-15 12 1 4 3 10 3 20z" fill="' + gold + '"/><path d="M-10-6c4 4 8 6 10 6s7-2 11-6" stroke="#c98a1a" stroke-width="1.4" fill="none"/>'); };
      return '<path d="M0 120c4-24 28-34 58-30s58-12 82 6v24z" fill="' + moss + '"/>' + cap(48, 74, 1) + cap(104, 92, 0.58) + ch(86, 92, 1) + ch(20, 100, 0.8) + ch(124, 104, 0.6)
        + '<g stroke="#5f8f45" stroke-width="2" stroke-linecap="round"><path d="M10 118l-4-12M70 116l2-12M116 118l4-10"/></g>';
    } },
    /* a longship: dragon head, striped sail, shields */
    longship: { vb: [180, 120], g: function (c) {
      var h = c.f || '#6b4528', sail = c.sail || '#efe4cc', st = c.stripe || '#b0302a', w = c.wave || '#4f8fb0', fl = c.flat;
      var shields = ''; for (var i = 0; i < 8; i++) shields += '<circle cx="' + (44 + i * 14) + '" cy="74" r="6" fill="' + (fl ? h : (i % 2 ? '#d9a640' : st)) + '"' + (fl ? '' : ' stroke="#3a2412" stroke-width="1.2"') + '/>' + (fl ? '' : '<circle cx="' + (44 + i * 14) + '" cy="74" r="1.6" fill="#3a2412"/>');
      return (fl ? '' : '<path d="M0 108q15-8 30 0t30 0 30 0 30 0 30 0 30 0" fill="none" stroke="' + w + '" stroke-width="3" stroke-linecap="round"/>')
        + '<path d="M92 76V12M56 16h72" stroke="' + (fl ? h : '#4a3020') + '" stroke-width="3" stroke-linecap="round"/>'
        + '<path d="M58 18H126L122 66H62Z" fill="' + (fl ? h : sail) + '"' + (fl ? ' opacity=".7"' : '') + '/>' + (fl ? '' : '<path d="M68 18h9l-1 48h-8zM87 18h10v48H87zM107 18h9l-2 48h-8z" fill="' + st + '"/>')
        + '<path d="M22 76H158C164 74 168 70 170 62C172 54 168 48 162 48C166 54 164 60 158 62L156 68C148 90 120 98 90 98S32 92 22 78Z" fill="' + h + '"/>'
        + '<path d="M22 80C14 70 10 54 14 40C17 31 22 26 30 26L35 24L33 30C29 31 26 35 26 41C26 53 30 64 35 76Z" fill="' + h + '"/>'
        + '<path d="M31 25C26 21 18 20 10 24L16 28L9 31C17 34 25 33 33 31Z" fill="' + h + '"/>' + (fl ? '' : '<circle cx="25" cy="26" r="1.6" fill="#f2d28a"/><path d="M33 22c2-6 8-8 12-4M30 86c20 4 100 4 122-6" stroke="#3a2412" stroke-width="1.6" fill="none" stroke-linecap="round"/>')
        + shields + (fl ? '' : '<g stroke="#4a3020" stroke-width="2" stroke-linecap="round"><path d="M50 84l-8 16M78 86l-6 16M106 86l-4 16M134 84l-2 16"/></g>');
    } },
    /* a round shield with a triquetra knot */
    shield: { vb: [120, 120], g: function (c) {
      var wood = c.f || '#3a2a1c', iron = c.iron || '#8a989e', k = c.knot || '#d9a659', d = c.dark || '#1a120c';
      var lobe = 'M60 22C80 46 82 70 60 84C38 70 40 46 60 22Z', lobes = [0, 120, 240].map(function (r) { return '<path d="' + lobe + '" transform="rotate(' + r + ' 60 64)"/>'; }).join('');
      return '<circle cx="60" cy="60" r="54" fill="' + wood + '" stroke="' + iron + '" stroke-width="6"/>' + [0, 60, 120, 180, 240, 300].map(function (r) { return '<circle cx="60" cy="10" r="2.4" fill="' + iron + '" transform="rotate(' + r + ' 60 60)"/>'; }).join('')
        + '<g fill="none" stroke-linecap="round"><g stroke="' + d + '" stroke-width="9">' + lobes + '<circle cx="60" cy="64" r="19"/></g><g stroke="' + k + '" stroke-width="5">' + lobes + '<circle cx="60" cy="64" r="19"/></g></g>';
    } },
    /* a stave church: tarred tiers, dragon heads on the gables */
    church: { vb: [140, 170], g: function (c) {
      var r = c.f || '#2b1d14', w = c.wall || (c.flat ? r : '#4a3322'), d = c.dragon || (c.flat ? r : '#d39a5c'), fl = c.flat;
      var drag = function (x, y, s) { return '<path d="M' + x + ' ' + y + 'c' + (-6 * s) + '-4 ' + (-10 * s) + '-12 ' + (-6 * s) + '-18 ' + (2 * s) + ' 4 ' + (6 * s) + ' 6 ' + (10 * s) + ' 4" fill="none" stroke="' + d + '" stroke-width="3" stroke-linecap="round"/>'; };
      var shingles = fl ? '' : '<g stroke="rgba(255,220,180,.16)" stroke-width="1" fill="none"><path d="M28 120h84M40 110h60M42 84h56M52 74h36M58 52h24"/></g>';
      return '<path d="M64 40L70 6L76 40Z" fill="' + r + '"/><path d="M70 0v9M66.5 3.5h7" stroke="' + d + '" stroke-width="2"/>'
        + '<rect x="58" y="50" width="24" height="12" fill="' + w + '"/><path d="M46 58L70 34L94 58Z" fill="' + r + '"/>'
        + '<rect x="44" y="84" width="52" height="24" fill="' + w + '"/><path d="M30 90L70 56L110 90Z" fill="' + r + '"/>'
        + '<rect x="34" y="120" width="72" height="46" fill="' + w + '"/><path d="M14 128L40 104H100L126 128Z" fill="' + r + '"/>'
        + shingles + (fl ? '' : '<g stroke="rgba(0,0,0,.3)" stroke-width="1"><path d="M42 124v42M50 124v42M58 124v42M82 124v42M90 124v42M98 124v42M52 88v18M88 88v18"/></g><path d="M64 166v-18a6 6 0 0 1 12 0v18z" fill="#1a110b"/>')
        + drag(46, 58, 1) + drag(94, 58, -1) + drag(30, 90, 1) + drag(110, 90, -1);
    } },
    /* a carved dragon head on a curling neck (gable ornament) */
    dragon: { vb: [140, 140], g: function (c) {
      var wood = c.f || '#b07a3e', dk = c.dark || '#5a3a1e', t = c.tongue || '#c8402a';
      return '<path d="M132 138C132 102 98 96 86 76C76 58 84 42 66 30" fill="none" stroke="' + dk + '" stroke-width="18" stroke-linecap="round"/><path d="M132 138C132 102 98 96 86 76C76 58 84 42 66 30" fill="none" stroke="' + wood + '" stroke-width="11" stroke-linecap="round"/>'
        + '<path d="M120 120c-6-4-8-12-2-16M104 98c-8-2-12-10-6-16M90 72c-6 0-10-6-6-12" fill="none" stroke="' + dk + '" stroke-width="2.4" stroke-linecap="round"/>'
        + '<path d="M72 22C58 12 34 14 16 22L30 29L14 35C30 41 52 44 70 38Z" fill="' + wood + '" stroke="' + dk + '" stroke-width="3" stroke-linejoin="round"/>'
        + '<path d="M70 22c4-12 16-16 22-8-6 0-10 4-10 10M66 38c8 6 10 16 4 22" fill="none" stroke="' + dk + '" stroke-width="3" stroke-linecap="round"/>'
        + '<circle cx="56" cy="27" r="3.4" fill="' + dk + '"/><path d="M20 30c-9 1-14 8-9 13" fill="none" stroke="' + t + '" stroke-width="2.6" stroke-linecap="round"/><path d="M24 24l2 4 2-4 2 4 2-4" fill="none" stroke="#f3e6cc" stroke-width="1.4"/>';
    } },
    /* a red cabin with snow on the roof and a candle in the window */
    cabin: { vb: [150, 130], g: function (c) {
      var red = c.f || '#a8241f', snow = c.snow || '#f4f7fb', glow = c.glow || '#ffc76a', fl = c.flat;
      return (fl ? '' : '<path d="M104 54c-4-8 6-12 2-20s6-12 2-18" fill="none" stroke="#dfe6ef" stroke-width="3" stroke-linecap="round" opacity=".55"/>') + '<rect x="98" y="34" width="10" height="22" fill="' + (fl ? red : '#3a2a22') + '"/>'
        + '<rect x="28" y="66" width="92" height="50" fill="' + red + '"/>' + (fl ? '' : '<g stroke="rgba(60,0,0,.45)" stroke-width="1.2"><path d="M36 68v46M44 68v46M84 68v46M112 68v46"/></g>')
        + '<path d="M18 70L74 30L130 70Z" fill="' + (fl ? red : '#3a2a22') + '"/><path d="M14 72L74 27L134 72C126 74 120 70 114 72C104 75 98 69 90 71L74 38L58 71C50 69 42 75 34 72C28 70 22 74 14 72Z" fill="' + snow + '"/>'
        + '<rect x="48" y="80" width="26" height="22" fill="' + glow + '"' + (fl ? '' : ' stroke="#fff" stroke-width="3"') + '/>' + (fl ? '' : '<path d="M61 80v22M48 91h26" stroke="#fff" stroke-width="2"/><rect x="66" y="92" width="3" height="8" fill="#fff8e6"/><path class="at-flame" d="M67.5 86c2 2.4 2 4.4 0 5.4-2-1-2-3 0-5.4z" fill="#ff9a2a"/>')
        + '<rect x="88" y="84" width="18" height="32" fill="' + (fl ? red : '#5a1410') + '"' + (fl ? '' : ' stroke="#fff" stroke-width="2"') + '/>'
        + '<path d="M0 130C20 112 60 110 90 116S136 112 150 118V130Z" fill="' + snow + '"/>' + spruce(140, 120, 58, fl ? red : '#1f4a33') + (fl ? '' : '<path d="M132 84c4 2 10 2 16 0M128 98c6 2 18 2 24 0" stroke="' + snow + '" stroke-width="3" stroke-linecap="round"/>');
    } },
    /* a moose (faces left) */
    moose: { vb: [100, 72], g: function (c) { return '<path d="' + MOOSE + '" fill="' + (c.f || '#2a2216') + '"/>'; } },
    /* the yellow «Elg» warning sign on a post */
    elgsign: { vb: [120, 150], g: function (c) {
      return '<rect x="56" y="96" width="8" height="54" rx="2" fill="' + (c.post || '#9aa3ad') + '"/><path d="M60 8L114 100H6Z" fill="' + (c.yellow || '#ffd200') + '" stroke="' + (c.red || '#c8102e') + '" stroke-width="10" stroke-linejoin="round"/>'
        + at(30, 46, 0.62, '<path d="' + MOOSE + '" fill="' + (c.f || '#141414') + '"/>');
    } },
    /* the sun on the horizon at midnight */
    sun: { vb: [140, 100], g: function (c) {
      var s = c.f || '#ffc35a', sea = c.sea || '#2a2a5a', rays = '';
      for (var i = 0; i <= 8; i++) { var a = Math.PI + i * Math.PI / 8; rays += 'M' + f1(70 + Math.cos(a) * 36) + ' ' + f1(70 + Math.sin(a) * 36) + 'L' + f1(70 + Math.cos(a) * 54) + ' ' + f1(70 + Math.sin(a) * 54); }
      return '<path d="' + rays + '" stroke="' + s + '" stroke-width="3" stroke-linecap="round" opacity=".8"/><path d="M42 70a28 28 0 0 1 56 0z" fill="' + s + '"/>' + (c.sea ? '<rect y="70" width="140" height="30" fill="' + sea + '"/>' : '')
        + '<g fill="' + s + '"><rect x="44" y="74" width="52" height="3" rx="1.5"/><rect x="52" y="81" width="36" height="2.6" rx="1.3" opacity=".8"/><rect x="58" y="88" width="24" height="2.2" rx="1.1" opacity=".6"/><rect x="63" y="94" width="14" height="2" rx="1" opacity=".45"/></g>';
    } },
    /* a red rorbu on stilts under a sharp peak */
    rorbu: { vb: [150, 130], g: function (c) {
      var red = c.f || '#b3261e', sea = c.sea || '#2f6f8a', peak = c.peak || '#5a6f80', fl = c.flat;
      return (fl ? '' : '<path d="M0 104L30 40L46 60L70 8L96 70L112 50L150 104Z" fill="' + peak + '" opacity=".55"/><path d="M60 26l10-18 8 22-8-6z" fill="#fff" opacity=".7"/>')
        + '<rect y="104" width="150" height="26" fill="' + (fl ? red : sea) + '"' + (fl ? ' opacity=".4"' : '') + '/>' + '<g fill="' + (fl ? red : '#3a2a22') + '"><rect x="34" y="86" width="5" height="30"/><rect x="58" y="86" width="5" height="30"/><rect x="96" y="86" width="5" height="30"/><rect x="118" y="86" width="5" height="30"/><rect x="26" y="84" width="104" height="5"/></g>'
        + '<rect x="32" y="50" width="92" height="36" fill="' + red + '"/><path d="M24 54L78 22L132 54Z" fill="' + (fl ? red : '#2b2a2e') + '"/>'
        + (fl ? '' : '<path d="M26 54L78 24L130 54" fill="none" stroke="#f4f1ea" stroke-width="3"/><g fill="#f4f1ea"><rect x="44" y="60" width="14" height="12"/><rect x="98" y="60" width="14" height="12"/></g><g fill="#7fb0c8"><rect x="46" y="62" width="10" height="8"/><rect x="100" y="62" width="10" height="8"/></g><rect x="70" y="62" width="14" height="24" fill="#5a1410" stroke="#f4f1ea" stroke-width="2"/><path d="M8 116h20M60 122h30M110 114h24" stroke="#fff" stroke-width="2" opacity=".5" stroke-linecap="round"/>');
    } },
    /* a drying rack (hjell) with stockfish */
    hjell: { vb: [120, 90], g: function (c) {
      var p = c.f || '#5a4632', fish = c.fish || (c.flat ? p : '#c9a66a'), out = '<path d="M10 90L24 10L38 90M82 90L96 10L110 90M18 22H104" stroke="' + p + '" stroke-width="4" fill="none" stroke-linecap="round"/>';
      for (var i = 0; i < 9; i++) { var x = 26 + i * 8.6; out += '<path d="M' + f1(x) + ' 22c2.4 0 3.4 6 3.4 14 0 8-1.4 14-3.4 16-2-2-3.4-8-3.4-16 0-8 1-14 3.4-14z" fill="' + fish + '"/>'; }
      return out;
    } },
    /* a Norwegian heart waffle (five hearts in a ring), centre 50 50 */
    waffle: { vb: [100, 100], g: function (c) {
      var wf = c.waffle || '#e8a94a', wl = c.wline || '#b8742a', jam = c.jam || '#c0303f';
      var heart = 'M0 0C-10-8-22-14-22-26C-22-34-14-38-8-36C-4-35-1-32 0-29C1-32 4-35 8-36C14-38 22-34 22-26C22-14 10-8 0 0Z';
      return at(50, 50, 1.16, [0, 72, 144, 216, 288].map(function (r) { return '<g transform="rotate(' + r + ')"><path d="' + heart + '" fill="' + wf + '" stroke="' + wl + '" stroke-width="2"/><path d="M-10-24h20M-12-16h24M0-34v28M-8-30v20M8-30v20" stroke="' + wl + '" stroke-width="1" opacity=".55"/></g>'; }).join('')) + '<circle cx="50" cy="50" r="6" fill="' + jam + '"/>';
    } },
    /* a cup of coffee on a saucer with a little heart and steam */
    coffee: { vb: [80, 80], g: function (c) {
      var cup = c.cup || '#f6f1e8', jam = c.jam || '#c0303f', rim = c.rim || '#c9bba8';
      return '<ellipse cx="36" cy="72" rx="30" ry="6" fill="' + cup + '" stroke="' + rim + '" stroke-width="1.5"/><path d="M14 30h44v22c0 14-10 20-22 20s-22-6-22-20z" fill="' + cup + '" stroke="' + rim + '" stroke-width="1.5"/>'
        + '<path d="M58 38c12 0 12 18 0 18" fill="none" stroke="' + rim + '" stroke-width="4"/><ellipse cx="36" cy="30" rx="22" ry="4.5" fill="#5a3418"/><path d="M36 54c-3-3-8-5-8-9 0-3 4-4 8-1 4-3 8-2 8 1 0 4-5 6-8 9z" fill="' + jam + '"/>'
        + '<g class="at-steam" fill="none" stroke="#cbb7a0" stroke-width="2.6" stroke-linecap="round" opacity=".75"><path d="M28 22c-6-8 6-12 0-20"/><path d="M42 20c-6-8 6-12 0-20"/></g>';
    } },
    /* breakfast: the waffle, coffee, brunost with a cheese slicer (ostehøvel) */
    breakfast: { vb: [160, 120], g: function (c) {
      var bru = c.brunost || '#a65a24';
      return '<ellipse cx="80" cy="112" rx="76" ry="6" fill="rgba(0,0,0,.12)"/>' + at(4, 30, 0.88, ART.waffle.g(c)) + at(88, 32, 1, ART.coffee.g(c))
        + '<path d="M84 112l4-22h26l-4 22z" fill="' + bru + '"/><path d="M88 90l4-6h26l-4 6z" fill="#c27a3c"/><path d="M96 84c8-6 18-4 24 0" fill="none" stroke="#d99a5a" stroke-width="3" stroke-linecap="round"/>'
        + '<path d="M96 80l20-4 2 6-20 4z" fill="#c9cdd2"/><path d="M118 79l26-16" stroke="#8a8f96" stroke-width="3.4" stroke-linecap="round"/>';
    } },
    /* a generic crown (velvet cap, arches, jewels, orb and a little cross) — not any real coat of arms */
    crown: { vb: [140, 120], g: function (c) {
      var g = c.f || '#e6c36a', gd = c.dark || '#a8842a', v = c.velvet || '#7a1430', fl = c.flat, pearls = '';
      [[30, 92], [36, 66], [48, 50], [62, 44], [78, 44], [92, 50], [104, 66], [110, 92]].forEach(function (q) { pearls += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="3.2" fill="' + (fl ? g : '#fffaf0') + '"/>'; });
      return (fl ? '' : '<path d="M32 92C34 50 106 50 108 92Z" fill="' + v + '"/>') + '<path d="M30 92C30 42 110 42 110 92M70 46V92" fill="none" stroke="' + g + '" stroke-width="7" stroke-linecap="round"/>' + pearls
        + '<circle cx="70" cy="36" r="8" fill="' + g + '"' + (fl ? '' : ' stroke="' + gd + '" stroke-width="1.5"') + '/><path d="M70 14v16M63 21h14" stroke="' + g + '" stroke-width="4" stroke-linecap="round"/>'
        + '<rect x="22" y="90" width="96" height="20" rx="4" fill="' + g + '"' + (fl ? '' : ' stroke="' + gd + '" stroke-width="2"') + '/>'
        + (fl ? '' : '<g><ellipse cx="44" cy="100" rx="5" ry="6" fill="#ba0c2f"/><rect x="64" y="94" width="12" height="12" rx="2" fill="#1b3a9a" transform="rotate(45 70 100)"/><ellipse cx="96" cy="100" rx="5" ry="6" fill="#ba0c2f"/><circle cx="30" cy="100" r="2" fill="#fffaf0"/><circle cx="56" cy="100" r="2" fill="#fffaf0"/><circle cx="84" cy="100" r="2" fill="#fffaf0"/><circle cx="110" cy="100" r="2" fill="#fffaf0"/></g>');
    } },
    /* an old photo with album corners */
    album: { vb: [130, 120], g: function (c) {
      var paper = c.paper || '#f4ecd8', sky = c.sky || '#c9b896', mt = c.f || '#5e5040', k = c.corner || '#2a2420';
      return '<g transform="rotate(-6 65 60)"><rect x="12" y="16" width="106" height="84" fill="' + paper + '" stroke="rgba(0,0,0,.18)"/><rect x="20" y="24" width="90" height="60" fill="' + sky + '"/>'
        + '<path d="M20 70L42 44L54 56L72 34L96 62L110 52V84H20Z" fill="' + mt + '"/><path d="M68 40l4-6 5 7-4-2z" fill="#efe6d2" opacity=".8"/><rect x="20" y="74" width="90" height="10" fill="#a8977a"/><path d="M30 78h18M60 80h26" stroke="#efe6d2" stroke-width="1.2" opacity=".6"/>'
        + '<path d="M26 92h40" stroke="#8a7a62" stroke-width="1.6" stroke-linecap="round"/>'
        + '<g fill="' + k + '"><path d="M12 16h18L12 34z"/><path d="M118 16h-18l18 18z"/><path d="M12 100h18L12 82z"/><path d="M118 100h-18l18-18z"/></g></g>';
    } },
    /* a gull gliding */
    gull: { vb: [40, 16], g: function (c) { return '<path d="M0 10C8 2 14 2 20 9C26 2 32 2 40 10C32 6 26 7 20 12C14 7 8 6 0 10Z" fill="' + (c.f || 'currentColor') + '"/>'; } },
  };
  /** an ART picture as an <svg> string (vb = its own box); extra goes after it (inside) */
  function artSvg(name, c, attrs) {
    var a = ART[name]; if (!a) return '';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + a.vb[0] + ' ' + a.vb[1] + '"' + (attrs || '') + '>' + a.g(c || {}) + '</svg>';
  }
  function draw(name, c) { var a = ART[name]; return a ? a.g(c || {}) : ''; }

  /* 🇳🇴 background layers: a landscape strip along the bottom (xMidYMax slice: the middle stays on phones) or a texture */
  var STRIPS = { troll: 1, skog: 1, viking: 1, stavkirke: 1, hytte: 1, elg: 1, midnattsol: 1, polarnatt: 1, lofoten: 1 };
  function noPattern(name, p, m) {
    var a = p.fx[0], b = p.fx[1], c = p.fx[2], L = m === 'light';
    var strip = function (inner) {
      return { img: svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 260" preserveAspectRatio="xMidYMax slice">' + inner + '</svg>'), size: '100% clamp(150px, 30vh, 320px)', pos: 'center bottom', rep: 'no-repeat', op: 1,
        sw: { size: '100% 80%', pos: 'center bottom', rep: 'no-repeat' } };
    };
    var trees = function (list, fill, op) { return list.map(function (q) { return spruce(q[0], q[1], q[2], fill, op); }).join(''); };
    switch (name) {
      case 'troll': return strip('<defs><radialGradient id="g" cx=".5" cy="1" r=".75"><stop offset="0" stop-color="' + a + '" stop-opacity="' + (L ? 0.34 : 0.3) + '"/><stop offset="1" stop-color="' + a + '" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="260" fill="url(#g)"/>'
        + '<path d="M0 260V170L70 140L130 156L210 112L270 134L330 118L400 150L800 150L860 120L930 140L1000 104L1080 138L1140 124L1200 140V260Z" fill="' + b + '" opacity=".1"/>'
        + at(470, 92, 1, draw('troll', { flat: 1, f: b, eye: a }), false).replace('<g ', '<g opacity="' + (L ? 0.24 : 0.2) + '" ') + at(1110, 150, 0.6, draw('troll', { flat: 1, f: b, eye: a }), true).replace('<g ', '<g opacity=".16" ')
        + at(220, 176, 0.45, draw('troll', { flat: 1, f: b, eye: a }), false).replace('<g ', '<g opacity=".14" ')
        + '<g fill="' + a + '"><circle cx="609" cy="192" r="5.5" opacity=".9"/><circle cx="1026.6" cy="210" r="3.4" opacity=".75"/><circle cx="282.6" cy="221" r="2.6" opacity=".7"/></g>'
        + '<path d="M0 260V238C120 228 240 232 360 238S600 242 700 234 900 230 1200 240V260Z" fill="' + b + '" opacity=".22"/>' + at(330, 198, 0.9, draw('stones', { flat: 1, f: b }), false).replace('<g ', '<g opacity=".24" ') + at(760, 214, 0.7, draw('stones', { flat: 1, f: b }), false).replace('<g ', '<g opacity=".2" '));
      case 'skog': return strip(trees([[40, 260, 150], [110, 260, 200], [190, 260, 130], [270, 260, 230], [350, 260, 160], [430, 260, 210], [520, 260, 140], [600, 260, 240], [690, 260, 170], [770, 260, 215], [850, 260, 150], [930, 260, 235], [1010, 260, 165], [1090, 260, 210], [1170, 260, 150]], b, L ? 0.15 : 0.14)
        + trees([[80, 260, 100], [230, 260, 120], [400, 260, 90], [560, 260, 110], [740, 260, 95], [900, 260, 120], [1060, 260, 100]], b, L ? 0.22 : 0.2)
        + '<path d="M0 260V244C200 236 400 240 600 246S1000 238 1200 244V260Z" fill="' + b + '" opacity=".28"/>'
        + at(500, 238, 0.32, draw('mushrooms', {}), false).replace('<g ', '<g opacity="' + (L ? 0.5 : 0.42) + '" ') + at(820, 242, 0.24, draw('mushrooms', {}), false).replace('<g ', '<g opacity="' + (L ? 0.45 : 0.36) + '" '));
      case 'viking': return strip('<path d="M0 260V226q25-16 50 0t50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0V260Z" fill="' + b + '" opacity=".12"/>'
        + '<path d="M0 214q25-14 50 0t50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0 50 0" fill="none" stroke="' + a + '" stroke-opacity=".22" stroke-width="2"/>'
        + at(480, 70, 1.35, draw('longship', { flat: 1, f: b }), false).replace('<g ', '<g opacity="' + (L ? 0.22 : 0.2) + '" '));
      case 'stavkirke': return strip(trees([[60, 260, 160], [150, 260, 210], [250, 260, 150], [330, 260, 190], [870, 260, 190], [950, 260, 150], [1040, 260, 210], [1130, 260, 160]], b, L ? 0.14 : 0.17)
        + at(512, 46, 1.3, draw('church', { flat: 1, f: b }), false).replace('<g ', '<g opacity="' + (L ? 0.24 : 0.34) + '" ')
        + '<path d="M0 260V244C300 236 900 236 1200 244V260Z" fill="' + b + '" opacity=".24"/>');
      case 'hytte': return strip('<path d="M0 260V196C150 168 300 176 420 192S700 218 820 198 1050 172 1200 192V260Z" fill="' + c + '" opacity="' + (L ? 0.28 : 0.12) + '"/>'
        + trees([[90, 214, 120], [160, 204, 90], [980, 196, 130], [1060, 200, 100], [1140, 206, 120]], c, L ? 0.3 : 0.14)
        + trees([[560, 222, 90], [610, 226, 70], [700, 230, 60]], c, L ? 0.26 : 0.12)
        + '<path d="M0 260V232C200 220 420 226 600 236S1000 226 1200 234V260Z" fill="' + c + '" opacity="' + (L ? 0.3 : 0.16) + '"/>');
      case 'elg': return strip(trees([[50, 260, 170], [130, 260, 220], [220, 260, 150], [300, 260, 200], [380, 260, 140], [820, 260, 150], [900, 260, 210], [990, 260, 160], [1070, 260, 220], [1150, 260, 170]], a, L ? 0.14 : 0.12)
        + at(540, 132, 1.6, draw('moose', { f: a }), false).replace('<g ', '<g opacity="' + (L ? 0.26 : 0.22) + '" ')
        + '<path d="M0 260V246C300 238 900 238 1200 246V260Z" fill="' + a + '" opacity=".2"/>');
      case 'midnattsol': return strip('<defs><radialGradient id="g" cx=".5" cy=".78" r=".6"><stop offset="0" stop-color="' + a + '" stop-opacity="' + (L ? 0.4 : 0.32) + '"/><stop offset="1" stop-color="' + a + '" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="260" fill="url(#g)"/>'
        + '<circle cx="600" cy="204" r="54" fill="' + a + '" opacity="' + (L ? 0.32 : 0.28) + '"/>'
        + '<path d="M0 214L90 150L150 176L230 120L300 166L360 150L440 214ZM760 214L840 160L900 180L980 116L1060 170L1120 150L1200 190V214Z" fill="' + b + '" opacity=".16"/>'
        + '<rect y="214" width="1200" height="46" fill="' + b + '" opacity=".1"/><g fill="' + a + '" opacity=".45"><rect x="540" y="220" width="120" height="3" rx="1.5"/><rect x="560" y="230" width="80" height="3" rx="1.5"/><rect x="576" y="240" width="48" height="2.6" rx="1.3"/><rect x="588" y="250" width="24" height="2.4" rx="1.2"/></g>');
      case 'polarnatt': { var st = ''; for (var i = 0, r = rnd(7); i < 40; i++) st += '<circle cx="' + f1(r() * 1200) + '" cy="' + f1(r() * 140) + '" r="' + f1(0.8 + r() * 1.6) + '"/>';
        return strip('<g fill="' + a + '" opacity="' + (L ? 0.4 : 0.5) + '">' + st + '</g><path d="M-40 120C200 40 420 140 620 80S1000 30 1240 90" fill="none" stroke="' + c + '" stroke-width="40" stroke-linecap="round" opacity="' + (L ? 0.12 : 0.1) + '"/>'
          + '<path d="M0 260V200L80 150L130 170L220 100L300 160L380 130L470 190L560 140L640 176L720 120L800 168L880 110L970 160L1050 136L1130 170L1200 150V260Z" fill="' + b + '" opacity="' + (L ? 0.16 : 0.12) + '"/>'
          + '<path d="M220 100l-24 22 14-4 10 10 10-12 14 2zM720 120l-20 18 12-2 8 8 10-10 10 0zM880 110l-22 20 12-2 10 8 10-10 12 0z" fill="' + a + '" opacity=".3"/>'); }
      case 'lofoten': return strip('<path d="M0 214L50 150L80 170L140 70L170 120L200 96L260 180L320 140L360 160L410 214ZM760 214L820 150L860 170L920 60L950 110L990 80L1050 170L1110 130L1200 180V214Z" fill="' + b + '" opacity=".16"/>'
        + '<rect y="214" width="1200" height="46" fill="' + b + '" opacity=".1"/><path d="M420 228h80M640 236h60M880 230h90" stroke="' + a + '" stroke-width="2" opacity=".35" stroke-linecap="round"/>'
        + at(460, 120, 0.9, draw('rorbu', { flat: 1, f: b }), false).replace('<g ', '<g opacity=".2" ') + at(600, 130, 0.8, draw('rorbu', { flat: 1, f: b }), false).replace('<g ', '<g opacity=".17" ')
        + at(720, 138, 0.9, draw('hjell', { flat: 1, f: b }), false).replace('<g ', '<g opacity=".24" '));
      case 'frokost': {
        var hz = [0, 72, 144, 216, 288].map(function (r) { return '<path d="M0 0C-10-8-22-14-22-26C-22-34-14-38-8-36C-4-35-1-32 0-29C1-32 4-35 8-36C14-38 22-34 22-26C22-14 10-8 0 0Z" transform="rotate(' + r + ')"/>'; }).join('');
        return { img: svg('<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260" viewBox="0 0 260 260"><g fill="' + a + '" opacity=".5">' + at(60, 70, 0.55, hz) + at(190, 190, 0.42, hz) + '</g><g fill="' + b + '" opacity=".45"><ellipse cx="190" cy="56" rx="7" ry="10" transform="rotate(30 190 56)"/><ellipse cx="54" cy="196" rx="6" ry="9" transform="rotate(-20 54 196)"/><ellipse cx="120" cy="130" rx="5" ry="7.5" transform="rotate(60 120 130)"/></g><g stroke="' + (L ? '#fff6e6' : '#1a120c') + '" stroke-width="1.6" stroke-linecap="round"><path d="M186 50c3 4 5 8 8 12M51 190c2 4 4 8 6 12M117 126c2 3 4 6 6 8"/></g><path d="M222 112c-3-3-8-5-8-9 0-3 4-4 8-1 4-3 8-2 8 1 0 4-5 6-8 9z" fill="' + c + '" opacity=".45"/></svg>'),
          size: '260px 260px', pos: '0 0', rep: 'repeat', op: L ? 0.4 : 0.3, sw: { size: '80px 80px', pos: '0 0', rep: 'repeat' } }; }
      case 'kongelig': {
        var frame = svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><g fill="none" stroke="' + a + '" vector-effect="non-scaling-stroke"><rect x="1.2" y="1.2" width="97.6" height="97.6" stroke-width="2" stroke-opacity=".45" vector-effect="non-scaling-stroke"/><rect x="2.2" y="2.2" width="95.6" height="95.6" stroke-width="1" stroke-opacity=".35" vector-effect="non-scaling-stroke"/></g></svg>');
        var dam = svg('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><g opacity="' + (L ? 0.42 : 0.3) + '">' + at(20, 20, 0.36, draw('crown', { flat: 1, f: a })) + '</g><g fill="' + a + '" opacity="' + (L ? 0.4 : 0.3) + '"><path d="M135 125l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><circle cx="135" cy="45" r="2"/><circle cx="45" cy="135" r="2"/></g></svg>');
        var vel = 'radial-gradient(120% 90% at 50% 40%, transparent 60%, ' + (L ? 'rgba(122,20,48,.10)' : 'rgba(122,20,48,.22)') + ' 100%)';
        return { img: frame + ', ' + dam + ', ' + vel, size: '100% 100%, 180px 180px, 100% 100%', pos: 'center, 0 0, center', rep: 'no-repeat, repeat, no-repeat', op: L ? 0.7 : 0.6, sw: { size: '100% 100%, 60px 60px, 100% 100%', pos: 'center, 0 0, center', rep: 'no-repeat, repeat, no-repeat' } }; }
      case 'gammel': {
        var grain = svg('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="' + (L ? '0 0 0 0 .22 0 0 0 0 .17 0 0 0 0 .1 0 0 0 .5 0' : '0 0 0 0 .95 0 0 0 0 .9 0 0 0 0 .8 0 0 0 .32 0') + '"/></filter><rect width="200" height="200" filter="url(#n)"/></svg>');
        var scratch = svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><g stroke="' + (L ? '#5a4a36' : '#e8dcc4') + '" stroke-opacity=".16" vector-effect="non-scaling-stroke" fill="none"><path d="M18 0v100" vector-effect="non-scaling-stroke"/><path d="M71 0l-1 100" vector-effect="non-scaling-stroke"/><path d="M86 30l3 22" vector-effect="non-scaling-stroke"/><path d="M8 60c6-3 12-2 16 1" vector-effect="non-scaling-stroke"/></g></svg>');
        var vig = 'radial-gradient(125% 95% at 50% 42%, transparent 55%, ' + (L ? 'rgba(90,60,25,.24)' : 'rgba(0,0,0,.5)') + ' 100%)';
        return { img: vig + ', ' + scratch + ', ' + grain, size: '100% 100%, 100% 100%, 200px 200px', pos: 'center, center, 0 0', rep: 'no-repeat, no-repeat, repeat', op: L ? 0.85 : 0.75, sw: { size: '100% 100%, 100% 100%, 90px 90px', pos: 'center, center, 0 0', rep: 'no-repeat, no-repeat, repeat' } }; }
    }
    return null;
  }

  function pattern(name, p, m) {
    var a = p.fx[0], b = p.fx[1], c = p.fx[2], op = m === 'light' ? 0.5 : 0.42;
    var no = noPattern(name, p, m); if (no) return no;
    switch (name) {
      case 'fjord': // layered mountains + water line along the bottom
        return { img: svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 240" preserveAspectRatio="none"><path d="M0 240V150l120-70 90 50 140-110 120 90 80-40 150 110 110-70 130 60 140-90 120 80v180z" fill="' + c + '" opacity=".10"/><path d="M0 240V190l160-60 120 40 170-80 140 70 110-30 160 70 140-50 200 60v80z" fill="' + b + '" opacity=".13"/><path d="M0 214h1200" stroke="' + a + '" stroke-opacity=".25" stroke-width="2" stroke-dasharray="40 26"/></svg>'), size: '100% clamp(120px, 24vh, 260px)', pos: 'center bottom', rep: 'no-repeat', op: 1 };
      case 'rosemaling': // little C-scroll flowers, very faint, scattered
        return { img: svg('<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220" viewBox="0 0 220 220"><g fill="none" stroke-linecap="round" opacity=".55"><path d="M40 70c10-26 44-28 50-4 4 16-12 26-22 18" stroke="' + b + '" stroke-width="3"/><path d="M90 66c18 6 26 26 14 40" stroke="' + a + '" stroke-width="3"/><circle cx="68" cy="84" r="7" fill="' + a + '" stroke="none"/><circle cx="68" cy="84" r="3" fill="' + b + '" stroke="none"/><path d="M150 160c-12-22 6-44 28-36 14 6 10 24-2 26" stroke="' + a + '" stroke-width="3"/><path d="M152 158c-6 18-26 26-40 16" stroke="' + b + '" stroke-width="3"/><path d="M128 150c4-8 12-10 16-4" stroke="' + c + '" stroke-width="2.5"/><circle cx="176" cy="146" r="5" fill="' + b + '" stroke="none"/></g></svg>'), size: '220px 220px', pos: '0 0', rep: 'repeat', op: m === 'light' ? 0.32 : 0.22 };
      case 'parchment': // stains + darker edges (vignette)
        return { img: 'radial-gradient(120% 90% at 50% 40%, transparent 55%, ' + (m === 'light' ? 'rgba(120,80,30,.22)' : 'rgba(0,0,0,.45)') + ' 100%), radial-gradient(30% 22% at 18% 28%, ' + (m === 'light' ? 'rgba(150,100,40,.08)' : 'rgba(255,200,120,.04)') + ', transparent 70%), radial-gradient(26% 20% at 78% 68%, ' + (m === 'light' ? 'rgba(150,100,40,.07)' : 'rgba(255,200,120,.035)') + ', transparent 70%)', size: '100% 100%', pos: 'center', rep: 'no-repeat', op: 1 };
      case 'treasure': // map grid + a dashed route with an X
        return { img: svg('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480"><g stroke="' + c + '" stroke-opacity=".16" stroke-width="1"><path d="M0 .5h480M0 120.5h480M0 240.5h480M0 360.5h480M.5 0v480M120.5 0v480M240.5 0v480M360.5 0v480"/></g><path d="M40 420c60-40 40-120 120-130s90 60 150 20 40-130 120-150" fill="none" stroke="' + b + '" stroke-opacity=".35" stroke-width="3" stroke-dasharray="10 9" stroke-linecap="round"/><path d="M420 150l18 18m0-18-18 18" stroke="' + b + '" stroke-opacity=".5" stroke-width="4" stroke-linecap="round" transform="translate(-14 -14)"/></svg>'), size: '480px 480px', pos: '0 0', rep: 'repeat', op: m === 'light' ? 0.8 : 0.6 };
      case 'sparkle':
        return { img: svg('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><g fill="' + a + '"><path d="M40 30l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" opacity=".5"/><path d="M130 110l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" opacity=".45"/><circle cx="150" cy="40" r="2" opacity=".5"/><circle cx="70" cy="150" r="1.6" opacity=".5"/></g></svg>'), size: '180px 180px', pos: '0 0', rep: 'repeat', op: m === 'light' ? 0.7 : 0.55 };
      case 'neon': // perspective grid on the horizon
        return { img: 'linear-gradient(to top, ' + (m === 'light' ? 'rgba(230,47,176,.10)' : 'rgba(255,47,185,.14)') + ', transparent 34%), repeating-linear-gradient(to right, transparent 0 58px, ' + (m === 'light' ? 'rgba(19,185,204,.18)' : 'rgba(62,232,242,.13)') + ' 58px 60px), repeating-linear-gradient(to top, transparent 0 34px, ' + (m === 'light' ? 'rgba(230,47,176,.16)' : 'rgba(255,79,209,.13)') + ' 34px 36px)', size: '100% 100%', pos: 'center bottom', rep: 'no-repeat', op: 1, mask: 'linear-gradient(to top, #000 0, rgba(0,0,0,.55) 18vh, transparent 34vh)' };
      case 'paper':
        return { img: 'radial-gradient(60% 45% at 15% 20%, ' + p.blobs[0] + '22, transparent 70%), radial-gradient(55% 40% at 85% 80%, ' + p.blobs[1] + '22, transparent 70%), radial-gradient(40% 30% at 70% 15%, ' + p.blobs[2] + '1c, transparent 70%)', size: '100% 100%', pos: 'center', rep: 'no-repeat', op: 1 };
      case 'forest': // pine silhouettes along the bottom
        return { img: svg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 120" preserveAspectRatio="none"><g fill="' + c + '" opacity=".16"><path d="M30 120l24-60h-10l20-36 20 36h-10l24 60z"/><path d="M120 120l18-46h-8l16-30 16 30h-8l18 46z"/><path d="M230 120l28-70h-12l24-42 24 42h-12l28 70z"/><path d="M360 120l18-44h-8l16-30 16 30h-8l18 44z"/><path d="M470 120l26-64h-11l22-40 22 40h-11l26 64z"/></g></svg>'), size: '600px clamp(80px, 14vh, 140px)', pos: 'left bottom', rep: 'repeat-x', op: 1 };
      case 'bunad': // a thin embroidered band (red / white / blue cross-stitch) at the very bottom
        return { img: svg('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="24" viewBox="0 0 48 24"><path d="M0 12l6-6 6 6-6 6zM24 12l6-6 6 6-6 6z" fill="' + a + '" opacity=".6"/><path d="M12 12l6-6 6 6-6 6zM36 12l6-6 6 6-6 6z" fill="' + c + '" opacity=".55"/><circle cx="6" cy="12" r="1.6" fill="' + b + '"/><circle cx="30" cy="12" r="1.6" fill="' + b + '"/></svg>'), size: '48px 24px', pos: 'left bottom', rep: 'repeat-x', op: m === 'light' ? 0.55 : 0.45, band: true };
    }
    return null;
  }
  /* a few warm, small garlands (inside the top bar's top padding) */
  function garland(name, m) {
    var line = m === 'light' ? '#8c8f9a' : '#c9ccd6';
    var tile = function (w, inner) { return svg('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="12" viewBox="0 0 ' + w + ' 12"><path d="M0 1Q' + (w / 2) + ' 5 ' + w + ' 1" fill="none" stroke="' + line + '" stroke-width="1"/>' + inner + '</svg>'); };
    switch (name) {
      case 'flags': // Norwegian flags + white pennants
        return { img: tile(56, '<g transform="translate(9 2.4)"><rect width="13" height="8.6" fill="#ba0c2f"/><rect x="3.4" width="3" height="8.6" fill="#fff"/><rect y="2.8" width="13" height="3" fill="#fff"/><rect x="4.15" width="1.5" height="8.6" fill="#00205b"/><rect y="3.55" width="13" height="1.5" fill="#00205b"/></g><path d="M34 3.6h11l-5.5 7.6z" fill="#00205b"/>'), w: 56 };
      case 'lights':
        return { img: tile(64, '<g><circle cx="8" cy="5.4" r="2.8" fill="#ff4d5e"/><circle cx="24" cy="6.8" r="2.8" fill="#ffd24d"/><circle cx="40" cy="6.8" r="2.8" fill="#4dd88a"/><circle cx="56" cy="5.4" r="2.8" fill="#5fb8ff"/></g>'), w: 64, glow: true };
      case 'eggs':
        return { img: tile(48, '<ellipse cx="12" cy="7" rx="3.2" ry="4.2" fill="#ffd23f"/><ellipse cx="36" cy="7" rx="3.2" ry="4.2" fill="#ff9ec0"/><path d="M9 7h6M33 6h6" stroke="#fff" stroke-width="1"/>'), w: 48 };
      case 'hearts':
        return { img: tile(44, '<path d="M14 9.6 10.2 6a2.3 2.3 0 0 1 3.8-2.6A2.3 2.3 0 0 1 17.8 6z" fill="#ff4f86"/><path d="M33 8.6 30 5.8a1.8 1.8 0 0 1 3-2 1.8 1.8 0 0 1 3 2z" fill="#ff9ec0"/>'), w: 44 };
      case 'stars':
        return { img: tile(44, '<path d="M12 2.6l1.2 2.6 2.8.3-2.1 1.9.6 2.8-2.5-1.4-2.5 1.4.6-2.8-2.1-1.9 2.8-.3z" fill="#f0c04a"/><circle cx="32" cy="6" r="1.6" fill="#ffffff"/>'), w: 44, glow: true };
      case 'bunting':
        return { img: tile(40, '<path d="M6 2.4h11l-5.5 8.4z" fill="#f07a1a"/><path d="M24 2.8h11l-5.5 8.4z" fill="#6b3fa0"/>'), w: 40 };
      case 'sami': // a ribbon in the four colours of the Sami flag
        return { img: 'linear-gradient(90deg, #c8102e 0 25%, #0035ad 25% 50%, #ffce00 50% 75%, #007229 75% 100%)', w: 96, ribbon: true };
      case 'runes': { // «ᚾᛟᚱᛋᚲ : ᚲᛟᚱᛏ :» — NORSK KORT in the elder futhark, carved in bronze
        var R = { n: 'M3 1v9M1 4l4 2.4', o: 'M3.5 1L6 4.2L1 10M3.5 1L1 4.2L6 10', r: 'M1.6 1v9M1.6 1l4 2.5-4 2.5 4 4', s: 'M5 1L1.6 4.6 5 6.6 1.6 10', k: 'M5 1.6L1.6 4.6 5 7.6', t: 'M3.5 1v9M3.5 1L.8 4M3.5 1l2.7 3' };
        var word = 'norsk:kort:', x = 2, g = '';
        for (var i = 0; i < word.length; i++) { var ch = word[i]; if (ch === ':') { g += '<circle cx="' + (x + 1.2) + '" cy="3.6" r=".9"/><circle cx="' + (x + 1.2) + '" cy="7.4" r=".9"/>'; x += 6; } else { g += '<path transform="translate(' + x + ' 0)" d="' + R[ch] + '"/>'; x += 8; } }
        var col = m === 'light' ? '#7a4f12' : '#d9a659';
        return { img: svg('<svg xmlns="http://www.w3.org/2000/svg" width="' + x + '" height="11" viewBox="0 0 ' + x + ' 11"><g fill="' + col + '" stroke="none">' + g.replace(/<path[^>]*>/g, '') + '</g><g fill="none" stroke="' + col + '" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' + g.replace(/<circle[^>]*>/g, '') + '</g></svg>'), w: x };
      }
      case 'plaid': // a red / green woollen plaid ribbon (koselig)
        return { img: 'repeating-linear-gradient(90deg, rgba(255,240,220,.5) 0 2px, transparent 2px 12px), linear-gradient(180deg, #a8241f 0 35%, #2f5a3e 35% 65%, #a8241f 65% 100%)', w: 24, ribbon: true };
    }
    return null;
  }

  /* colour maths for a readable accent TEXT colour: dark themes lift the button accent toward white until it
     reaches 4.5 : 1 on the page and on the windows (light themes darken it if ever needed) */
  function rgbOf(h) { h = String(h).replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function hexOf(c) { return '#' + c.map(function (v) { v = Math.round(Math.max(0, Math.min(255, v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function lumOf(c) { var a = c.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; }
  function ratio(a, b) { var x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function readable(fg, bgs, m) {
    var c = rgbOf(fg), to = m === 'dark' ? [255, 255, 255] : [0, 0, 0];
    for (var k = 0; k <= 20; k++) {
      var t = k / 20, x = [0, 1, 2].map(function (i) { return c[i] + (to[i] - c[i]) * t; });
      if (bgs.every(function (b) { return ratio(x, rgbOf(b)) >= 4.6; })) return hexOf(x);
    }
    return m === 'dark' ? '#ffffff' : '#000000';
  }

  /** the CSS variables of one palette in one mode (the app: html[data-apptheme…]; the preview «Примерка»: its own box) */
  function varsOf(p, m, pat) {
    var v = ['--bg:' + p.bg, '--bg2:' + p.bg2, '--panel:' + p.panel, '--panel-solid:' + p.solid, '--panel-border:' + p.border, '--text:' + p.text, '--muted:' + p.muted,
      '--accent:' + p.accent, '--accent2:' + p.accent2, '--ru:' + p.ru, '--at-end:' + p.end,
      '--card-front:linear-gradient(145deg,' + p.f[0] + ' 0%,' + p.f[1] + ' 100%)', '--card-back:linear-gradient(145deg,' + p.b[0] + ' 0%,' + p.b[1] + ' 100%)',
      '--at-blob1:' + (p.blobs[0] || 'transparent'), '--at-blob2:' + (p.blobs[1] || 'transparent'), '--at-blob3:' + (p.blobs[2] || 'transparent'),
      '--at-fx1:' + p.fx[0], '--at-fx2:' + p.fx[1], '--at-fx3:' + p.fx[2], '--at-acc-text:' + readable(p.accent, [p.bg, p.solid, p.f[0]], m)];
    if (m === 'light' && !p.bad) v.push('--bad:#be123c'); // the app's light --bad (#f43f5e) is too pale on cream / tinted pages
    if (m === 'dark') { if (!p.bad) v.push('--bad:#ff6b81'); v.push('--new:#bba6ff'); } // ≥ 4.5 : 1 on the tinted dark cards too
    if (p.good) v.push('--good:' + p.good, '--done:' + p.good);
    if (p.warn) v.push('--warn:' + p.warn);
    if (p.bad) v.push('--bad:' + p.bad, '--debt:' + p.bad);
    if (pat) {
      v.push('--at-pat:' + pat.img, '--at-pat-size:' + pat.size, '--at-pat-pos:' + pat.pos, '--at-pat-rep:' + pat.rep, '--at-pat-op:' + pat.op);
      v.push('--at-pat-mask:' + (pat.mask || 'none'));
    }
    return v;
  }

  var styleEl = null;
  function css() {
    // one rule per theme × mode, from the registry (a single source of truth for colours)
    var out = [];
    THEMES.forEach(function (t) {
      if (!t.dark) return;
      ['dark', 'light'].forEach(function (m) {
        var p = t[m], pat = t.pattern ? pattern(t.pattern, p, m) : null;
        out.push('html[data-apptheme="' + t.id + '"][data-theme="' + m + '"]{' + varsOf(p, m, pat).join(';') + '}');
      });
    });
    // garlands: one variable per mode
    ['flags', 'lights', 'eggs', 'hearts', 'stars', 'bunting', 'sami', 'runes', 'plaid'].forEach(function (g) {
      ['dark', 'light'].forEach(function (m) {
        var G = garland(g, m);
        out.push('html[data-at-garland="' + g + '"][data-theme="' + m + '"]{--at-gar:' + G.img + ';--at-gar-w:' + G.w + 'px}');
      });
    });
    return out.join('\n');
  }
  function ensureStyle() {
    if (styleEl && styleEl.isConnected) return;
    styleEl = D.createElement('style');
    styleEl.id = 'at-vars';
    styleEl.textContent = css();
    (D.head || H).appendChild(styleEl);
  }

  var last = '';
  /** «👀 Примерка»: a theme worn for a while, NOT saved (a reload brings the saved one back) — { id } or null */
  var trial = null;
  /** put the current theme on <html> (+ decorations when <body> exists) */
  function apply(why) {
    ensureStyle();
    if (why !== 'boot') { fromStore(); var st0 = storeSettings(); if (st0) keepLm(st0.theme); } // Store.settings is loaded by now (App.init → apply('app')), or a backup was restored
    var c = trial ? { id: trial.id, source: 'trial', holiday: today() } : current(), t = BY[resolve(c.id)] || BY['default'];
    if (t.id === 'default') H.removeAttribute('data-apptheme'); else H.setAttribute('data-apptheme', t.id);
    var deco = S.deco && t.id !== 'default';
    var set = function (k, v) { if (v) H.setAttribute(k, v); else H.removeAttribute(k); };
    set('data-at-garland', deco && t.garland ? t.garland : '');
    set('data-at-corner', deco && t.corner ? t.corner : '');
    set('data-at-fx', deco && t.fx && motionOK() ? t.fx : '');
    set('data-at-serif', t.serif ? '1' : '');
    set('data-at-flat', t.flat ? '1' : '');
    set('data-at-noblobs', t.noBlobs ? '1' : '');
    set('data-at-blobboost', t.blobBoost ? '1' : '');
    set('data-at-pattern', t.pattern ? t.pattern : '');
    set('data-at-band', t.pattern === 'bunad' && deco ? '1' : '');
    set('data-at-head', t.head || ''); // 🇳🇴 themes: the headings in the theme's own (OFL) font, css/apptheme.css
    set('data-at-kind', t.kind === 'norway' || t.kind === 'variant' ? 'norway' : '');
    set('data-at-strip', STRIPS[t.pattern] ? '1' : '');
    set('data-at-motion', motionOK() ? '' : 'off');
    // the browser bar / installed app's title bar in the theme's colour
    try { var meta = D.querySelector('meta[name="theme-color"]'); if (meta) meta.content = palette(t.id, mode()).bg; } catch (e) { /* ignore */ }
    var sig = t.id + '|' + mode() + '|' + H.getAttribute('data-at-fx') + '|' + H.getAttribute('data-at-corner') + '|' + H.getAttribute('data-at-garland');
    if (D.body) buildDeco();
    if (sig !== last) {
      last = sig;
      try { D.dispatchEvent(new CustomEvent('apptheme-change', { detail: { theme: t.id, mode: mode(), source: c.source, holiday: c.holiday || null, why: why || '' } })); } catch (e) { /* old browser */ }
    }
    // the loading screen gets the season's light (css/preloader.css)
    var nkp = D.getElementById('nkp');
    if (nkp) { if ((c.source === 'holiday' || c.source === 'always') && deco) nkp.setAttribute('data-season', t.id); else nkp.removeAttribute('data-season'); }
    return c;
  }

  /* ---------------------------------------------------------------- decorations (built on demand) */
  var decoSig = '';
  function rnd(seed) { var s = seed; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  var SHAPES = {
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 4.4 13.6A4.8 4.8 0 0 1 12 6.4a4.8 4.8 0 0 1 7.6 7.2z" fill="currentColor"/></svg>',
    bat: '<svg viewBox="0 0 48 20" aria-hidden="true"><path d="M24 7c1-3 2-4 2-4l1 3c2-1 4-1 6 1 3-3 8-4 13-3-4 2-5 5-5 8-3-2-6-1-8 2-2-2-5-2-7 0-1-1-1-1-2-1s-1 0-2 1c-2-2-5-2-7 0-2-3-5-4-8-2 0-3-1-6-5-8 5-1 10 0 13 3 2-2 4-2 6-1l1-3s1 1 2 4z" fill="currentColor"/></svg>',
    feather: '<svg viewBox="0 0 16 32" aria-hidden="true"><path d="M8 1C2 8 2 20 7 29l1 2 1-2c5-9 5-21-1-28z" fill="currentColor"/><path d="M8 4v26" stroke="rgba(0,0,0,.25)" stroke-width="1"/></svg>',
    flake: '<svg viewBox="0 0 24 24" aria-hidden="true"><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2"/></g></svg>',
    gull: '<svg viewBox="0 0 40 16" aria-hidden="true"><path d="M0 10C8 2 14 2 20 9C26 2 32 2 40 10C32 6 26 7 20 12C14 7 8 6 0 10Z" fill="currentColor"/></svg>',
  };
  var FX = { // count on phones / desktop, shape
    snow: [18, 34], hearts: [8, 14], sparks: [12, 22], bats: [3, 5], fireworks: [3, 5], feathers: [8, 14], confetti: [10, 18], aurora: [3, 3], glow: [0, 0],
    mist: [3, 3], twinkle: [12, 24], gulls: [2, 3], dust: [8, 14], // 🇳🇴
  };
  function buildDeco() {
    var fx = H.getAttribute('data-at-fx') || '', corner = H.getAttribute('data-at-corner') || '', gar = H.getAttribute('data-at-garland') || '';
    var narrow = (W.innerWidth || 1024) < 720;
    var sig = fx + '|' + corner + '|' + gar + '|' + (narrow ? 'n' : 'w');
    var layer = D.getElementById('at-fx');
    if (!layer) {
      layer = D.createElement('div'); layer.id = 'at-fx'; layer.className = 'at-fx'; layer.setAttribute('aria-hidden', 'true');
      var blobs = D.querySelector('.bg-blobs');
      if (blobs && blobs.parentNode) blobs.parentNode.insertBefore(layer, blobs.nextSibling); else D.body.insertBefore(layer, D.body.firstChild);
      var pat = D.createElement('div'); pat.id = 'at-pat'; pat.className = 'at-pat'; pat.setAttribute('aria-hidden', 'true');
      layer.parentNode.insertBefore(pat, layer);
      var g = D.createElement('div'); g.id = 'at-garland'; g.className = 'at-garland'; g.setAttribute('aria-hidden', 'true');
      D.body.appendChild(g);
    }
    if (sig === decoSig) return;
    decoSig = sig;
    var html = '';
    if (corner) html += '<div class="at-corner at-c-' + corner + '">' + cornerSvg(corner) + '</div>';
    if (fx && FX[fx]) {
      var n = FX[fx][narrow ? 0 : 1], r = rnd(fx.length * 97 + 13);
      for (var i = 0; i < n; i++) {
        var st = '--x:' + (r() * 100).toFixed(1) + 'vw;--y:' + (r() * 70 + 5).toFixed(1) + 'vh;--s:' + (0.6 + r() * 0.8).toFixed(2) + ';--d:' + (fxDur(fx) * (0.75 + r() * 0.6)).toFixed(1) + 's;--dl:-' + (r() * fxDur(fx)).toFixed(1) + 's;--dx:' + ((r() - 0.5) * 18).toFixed(1) + 'vw;--r:' + Math.round(r() * 360) + 'deg;--c:var(--at-fx' + (1 + (i % 3)) + ')';
        var inner = fx === 'hearts' ? SHAPES.heart : fx === 'bats' ? SHAPES.bat : fx === 'gulls' ? SHAPES.gull : fx === 'feathers' ? SHAPES.feather : (fx === 'snow' && i % 4 === 0) ? SHAPES.flake : '';
        html += '<i class="at-p at-' + fx + (fx === 'snow' && i % 4 === 0 ? ' at-flake' : '') + '" style="' + st + '">' + inner + '</i>';
      }
    }
    layer.innerHTML = html;
  }
  function fxDur(fx) { return { snow: 16, hearts: 14, sparks: 7, bats: 26, fireworks: 6, feathers: 15, confetti: 12, aurora: 18, mist: 46, twinkle: 6, gulls: 38, dust: 24 }[fx] || 12; }
  function cornerSvg(k) {
    switch (k) {
      case 'pumpkin': return '<svg viewBox="0 0 120 100" aria-hidden="true"><defs><radialGradient id="atpg" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#ffd27a"/><stop offset=".6" stop-color="#ff8a1f"/><stop offset="1" stop-color="#c2410c"/></radialGradient></defs><path d="M60 22c-4-10 2-16 8-18" stroke="#3f6b2a" stroke-width="5" fill="none" stroke-linecap="round"/><ellipse cx="40" cy="60" rx="26" ry="32" fill="url(#atpg)"/><ellipse cx="80" cy="60" rx="26" ry="32" fill="url(#atpg)"/><ellipse cx="60" cy="60" rx="24" ry="35" fill="url(#atpg)"/><path d="M42 50l8 8H36zM78 50l6 8H70zM40 72q20 14 40 0l-6 2-4 5-4-5-6 6-6-6-4 5-4-5z" fill="#5a1a00"/></svg>';
      case 'bonfire': return '<svg viewBox="0 0 160 120" aria-hidden="true"><defs><radialGradient id="atbf" cx=".5" cy=".8" r=".6"><stop offset="0" stop-color="#fff2b0"/><stop offset=".45" stop-color="#ffb347"/><stop offset="1" stop-color="#ff5a1f" stop-opacity="0"/></radialGradient></defs><ellipse cx="80" cy="96" rx="78" ry="30" fill="url(#atbf)" opacity=".6"/><path class="at-flame" d="M80 20c14 22 30 34 22 58-4 12-14 18-22 18s-18-6-22-18c-6-20 10-30 10-46 6 8 8 14 6 22 8-8 10-20 6-34z" fill="#ff8a2a"/><path class="at-flame" d="M80 52c8 12 14 18 10 30-2 6-6 9-10 9s-8-3-10-9c-3-10 5-14 6-22 3 4 4 8 3 12 4-4 4-12 1-20z" fill="#ffd25a"/><path d="M40 108l80-16M40 92l80 16" stroke="#5a3a22" stroke-width="8" stroke-linecap="round"/></svg>';
      case 'candles': return '<svg viewBox="0 0 120 120" aria-hidden="true"><defs><radialGradient id="atcg" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".9"/><stop offset="1" stop-color="#ffc94d" stop-opacity="0"/></radialGradient></defs>' + [26, 60, 94].map(function (x, i) { var h = [52, 64, 48][i]; return '<circle class="at-flame" cx="' + x + '" cy="' + (112 - h - 12) + '" r="16" fill="url(#atcg)"/><rect x="' + (x - 7) + '" y="' + (112 - h) + '" width="14" height="' + h + '" rx="3" fill="#f6efe0"/><path class="at-flame" d="M' + x + ' ' + (112 - h - 18) + 'c5 6 5 11 0 14-5-3-5-8 0-14z" fill="#ffb02e"/>'; }).join('') + '</svg>';
      case 'nisse': return '<svg viewBox="0 0 100 120" aria-hidden="true"><path d="M50 8 22 62h56z" fill="#c8102e"/><path d="M50 8c10 4 22 16 26 30" stroke="#c8102e" stroke-width="0" fill="none"/><circle cx="50" cy="8" r="7" fill="#fff"/><rect x="18" y="58" width="64" height="12" rx="6" fill="#fff"/><circle cx="50" cy="78" r="16" fill="#f3c9a8"/><path d="M26 76c0 28 12 40 24 40s24-12 24-40c-6 8-14 10-24 10s-18-2-24-10z" fill="#f5f5f5"/><circle cx="50" cy="82" r="5" fill="#e88a8a"/><circle cx="43" cy="74" r="2" fill="#2a1a12"/><circle cx="57" cy="74" r="2" fill="#2a1a12"/></svg>';
      case 'flag': return '<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M20 10v106" stroke="#c9ccd6" stroke-width="3" stroke-linecap="round"/><g class="at-wave"><path d="M22 14h80v52H22z" fill="#ba0c2f"/><path d="M44 14h14v52H44zM22 33h80v14H22z" fill="#fff"/><path d="M48 14h6v52h-6zM22 37h80v6H22z" fill="#00205b"/></g></svg>';
      case 'chick': return '<svg viewBox="0 0 120 100" aria-hidden="true"><ellipse cx="88" cy="80" rx="13" ry="17" fill="#ff9ec0"/><ellipse cx="104" cy="84" rx="11" ry="14" fill="#9fd8ff"/><circle cx="46" cy="62" r="30" fill="#ffd23f"/><circle cx="46" cy="34" r="20" fill="#ffd23f"/><circle cx="52" cy="30" r="3" fill="#2a2405"/><path d="M64 34l10 4-10 4z" fill="#ff8a1f"/><path d="M30 60q12 10 26 0" stroke="#e6b400" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M40 14c2-6 8-8 10-4" stroke="#e6b400" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
      case 'samisun': return '<svg viewBox="0 0 120 120" aria-hidden="true"><path d="M60 14a46 46 0 0 0 0 92" fill="none" stroke="#c8102e" stroke-width="10"/><path d="M60 14a46 46 0 0 1 0 92" fill="none" stroke="#0035ad" stroke-width="10"/></svg>';
      case 'ris': return '<svg viewBox="0 0 120 140" aria-hidden="true"><g stroke="#6b4a2a" stroke-width="2.4" stroke-linecap="round" fill="none"><path d="M60 138 40 20M60 138 60 10M60 138 82 22M60 138 22 40M60 138 98 44"/></g><g><path d="M40 20c-8-10-4-18 0-18s8 8 0 18z" fill="#ff6fb5"/><path d="M60 10c-8-10-4-18 0-18s8 8 0 18z" fill="#ffd23f" transform="translate(0 8)"/><path d="M82 22c-8-10-4-18 0-18s8 8 0 18z" fill="#5fd38a"/><path d="M22 40c-8-10-4-18 0-18s8 8 0 18z" fill="#6fd3ff"/><path d="M98 44c-8-10-4-18 0-18s8 8 0 18z" fill="#b38bff"/></g></svg>';
      case 'compass': return '<svg viewBox="0 0 120 120" aria-hidden="true"><g fill="none" stroke="currentColor"><circle cx="60" cy="60" r="44" stroke-width="2"/><circle cx="60" cy="60" r="36" stroke-width="1" stroke-dasharray="3 5"/></g><path d="M60 8l8 52-8 52-8-52z" fill="currentColor" opacity=".8"/><path d="M8 60l52-8 52 8-52 8z" fill="currentColor" opacity=".45"/><path d="M60 8l8 52H52z" fill="var(--accent)"/><text x="60" y="6" font-size="10" text-anchor="middle" fill="currentColor" font-family="Georgia,serif" dy="-1">N</text></svg>';
      case 'rosemaling': return '<svg viewBox="0 0 160 160" aria-hidden="true"><g fill="none" stroke-linecap="round"><path d="M10 150c0-60 30-100 90-110" stroke="var(--at-fx2)" stroke-width="5"/><path d="M40 120c10-30 40-40 60-30 14 8 8 26-6 24" stroke="var(--at-fx1)" stroke-width="5"/><path d="M70 60c20-20 50-16 56 4 4 14-12 22-20 12" stroke="var(--at-fx1)" stroke-width="4"/></g><circle cx="98" cy="88" r="12" fill="var(--at-fx1)"/><circle cx="98" cy="88" r="5" fill="var(--at-fx2)"/><path d="M118 50c8-4 16 0 16 8" stroke="var(--at-fx3)" stroke-width="3" fill="none"/><ellipse cx="30" cy="100" rx="10" ry="5" fill="var(--at-fx2)" transform="rotate(-40 30 100)"/><ellipse cx="60" cy="40" rx="10" ry="5" fill="var(--at-fx2)" transform="rotate(30 60 40)"/></svg>';
      /* 🇳🇴 our own pictures (ART above) */
      case 'stones': return '<svg viewBox="0 0 160 130" aria-hidden="true">' + at(16, 0, 0.62, draw('troll', {})) + at(0, 52, 0.53, draw('stones', {})) + '</svg>';
      case 'mushrooms': case 'shield': case 'dragon': case 'cabin': case 'elgsign': case 'rorbu': case 'breakfast': case 'album':
        return artSvg(k, {}, ' aria-hidden="true"');
      case 'sun': return artSvg('sun', { f: 'var(--at-fx1)' }, ' aria-hidden="true"');
      case 'crown': return artSvg('crown', {}, ' aria-hidden="true"');
      case 'moon': return '<svg viewBox="0 0 120 120" aria-hidden="true"><defs><radialGradient id="atmg" cx=".4" cy=".4" r=".7"><stop offset="0" stop-color="#fff8ea"/><stop offset="1" stop-color="#d9cbb4"/></radialGradient></defs><circle cx="60" cy="60" r="40" fill="url(#atmg)"/><circle cx="46" cy="50" r="6" fill="#cbbca4" opacity=".6"/><circle cx="70" cy="74" r="9" fill="#cbbca4" opacity=".5"/></svg>';
    }
    return '';
  }

  /* ---------------------------------------------------------------- UI: picker, settings block, banner */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function tileHtml(t, cur, m) {
    var r = BY[resolve(t.id)] || t, p = r.dark ? r[m] : BASE[m];
    var on = t.id === cur || (BY[cur] && BY[cur].parent === t.id);
    // 🇳🇴 mini preview: the theme's own background layer + its picture
    var pat = t.kind === 'norway' && r.pattern ? noPattern(r.pattern, p, m) : null;
    var mini = (pat ? '<span class="at-sw-pat" style="background-image:' + esc(pat.img) + ';background-size:' + esc(pat.sw.size) + ';background-position:' + esc(pat.sw.pos) + ';background-repeat:' + esc(pat.sw.rep) + '"></span>' : '')
      + (t.kind === 'norway' && r.corner ? '<span class="at-sw-pic" aria-hidden="true">' + cornerSvg(r.corner) + '</span>' : '');
    var holi = t.kind === 'holiday' ? (function () { var u = upcoming(12).filter(function (o) { return o.id === t.id; })[0]; return u ? range(u.startDate, u.endDate) : ''; })() : '';
    return '<button type="button" class="at-tile' + (on ? ' on' : '') + '" data-at-pick="' + t.id + '" aria-pressed="' + on + '" aria-haspopup="dialog" title="' + esc(t.desc) + ' — нажмите, чтобы посмотреть">'
      + '<span class="at-sw" style="--sw-bg:' + p.bg + ';--sw-solid:' + p.solid + ';--sw-text:' + p.text + ';--sw-muted:' + p.muted + ';--sw-acc:' + p.accent + ';--sw-end:' + p.end + ';--sw-acc2:' + p.accent2 + ';--sw-b1:' + (p.blobs[0] || 'transparent') + ';--sw-b2:' + (p.blobs[1] || 'transparent') + ';--at-fx1:' + p.fx[0] + ';--at-fx2:' + p.fx[1] + ';--at-fx3:' + p.fx[2] + ';--bg:' + p.bg + ';--accent:' + p.accent + '">'
      + mini + '<span class="at-sw-card"><b>Hei!</b><i>Привет!</i></span><span class="at-sw-btn"></span>' + (mini.indexOf('at-sw-pic') > -1 ? '' : '<span class="at-sw-emo" aria-hidden="true">' + t.emoji + '</span>') + '</span>'
      + '<span class="at-tile-name">' + esc(t.name) + (t.no ? ' <small lang="nb">' + esc(t.no) + '</small>' : '') + '</span>'
      + (holi ? '<span class="at-tile-when">' + esc(holi) + '</span>' : '') + (t.seasonal ? '<span class="at-tile-when">сейчас: ' + esc(r.name.toLowerCase()) + '</span>' : '')
      + (on ? '<span class="at-tile-ok" aria-hidden="true">✓</span>' : '') + '</button>';
  }
  function statusLine() {
    if (trial) return '👀 Сейчас вы примеряете <b>' + esc(BY[trial.id].name) + '</b> — она ещё не сохранена. Ваша тема: «' + esc(BY[current().id].name) + '».';
    var c = current(), t = BY[c.id], v = t.seasonal ? ' (сейчас ' + esc(BY[resolve(t.id)].name.toLowerCase()) + ')' : '';
    if (c.source === 'always') return t.emoji + ' Сейчас всегда: <b>' + esc(t.name) + '</b> — останется, пока вы не выберете другое оформление.';
    if (c.source === 'holiday') return t.emoji + ' Сейчас праздничный наряд: <b>' + esc(t.name) + '</b> — до ' + esc(ru(c.holiday.endDate)) + '. Потом вернётся ваша тема «' + esc(BY[S.theme].name) + '».';
    return t.emoji + ' Сейчас: <b>' + esc(t.name) + '</b>' + v + (S.hol === 'auto' ? '. В праздники приложение само наденет праздничный наряд.' : '. Праздничное оформление выключено.');
  }
  function switchHtml(opt, on, label, desc) {
    return '<label class="at-switch"><input type="checkbox" data-at-opt="' + opt + '"' + (on ? ' checked' : '') + '><span class="at-track" aria-hidden="true"></span><span class="at-sw-txt"><span>' + label + '</span>' + (desc ? '<small>' + desc + '</small>' : '') + '</span></label>';
  }
  /** «🎉 Праздничное оформление»: by the calendar · never · one holiday always (radio buttons, ≥ 44 px each) */
  function holHtml() {
    var n = 0, nm = 'at-hol-' + (++holSeq);
    var radio = function (v, emo, label, desc, cls) {
      var on = S.hol === v, id = nm + '-' + (n++);
      return '<label class="at-hol-o' + (cls ? ' ' + cls : '') + (on ? ' on' : '') + '" for="' + id + '"><input type="radio" id="' + id + '" name="' + nm + '" value="' + v + '" data-at-hol' + (on ? ' checked' : '') + '>'
        + '<span class="at-hol-dot" aria-hidden="true"></span><span class="at-hol-emo" aria-hidden="true">' + emo + '</span><span class="at-hol-t"><span>' + label + '</span>' + (desc ? '<small>' + desc + '</small>' : '') + '</span></label>';
    };
    var hols = THEMES.filter(function (t) { return t.kind === 'holiday'; });
    return '<fieldset class="at-hol" role="radiogroup" aria-labelledby="' + nm + '-h"><legend class="at-hol-h" id="' + nm + '-h">🎉 Праздничное оформление</legend>'
      + '<div class="at-hol-main">' + radio('auto', '🗓', 'Автоматически по праздникам', 'Рождество, 17 мая, Пасха, Хэллоуин… — по календарю, потом обратно')
      + radio('off', '🚫', 'Без праздничного оформления', 'Всегда ваша обычная тема') + '</div>'
      + '<p class="at-hol-sub">Или один праздник — <b>всегда</b>, пока не смените:</p>'
      + '<div class="at-hol-grid">' + hols.map(function (t) { return radio(t.id, t.emoji, 'Всегда: ' + esc(t.name), '', 'chip'); }).join('') + '</div></fieldset>';
  }
  var holSeq = 0;
  function optionsHtml() {
    return holHtml()
      + switchHtml('deco', S.deco, '❄️ Украшения', 'Снег, флажки, сердечки — лёгкие и за текстом. Выключите — останутся только цвета')
      + (motionOK() ? '' : '<p class="at-note">🌿 На этом устройстве включено «Уменьшить движение» — украшения стоят на месте.</p>');
  }
  function pickerBody() {
    var cur = S.theme, m = mode(), act = current();
    var grp = function (kind, title) {
      return '<h3 class="at-h">' + title + '</h3><div class="at-grid">' + THEMES.filter(function (t) { return t.kind === kind || (kind === 'style' && t.kind === 'base'); })
        .map(function (t) { return tileHtml(t, act.source === 'holiday' || act.source === 'always' ? act.id : cur, m); }).join('') + '</div>';
    };
    var up = upcoming(5).map(function (o) { return '<li><span aria-hidden="true">' + o.emoji + '</span> <b>' + esc(o.name) + '</b> <span lang="nb">' + esc(o.say) + '</span> <span class="at-when">' + esc(range(o.startDate, o.endDate)) + '</span></li>'; }).join('');
    var first = !tipSeen(), hand = first && W.Help && Help.handIcon ? '<span class="at-tip-hand" aria-hidden="true">' + Help.handIcon(26) + '</span>' : '<span aria-hidden="true">👆</span>';
    var lm = lightDark();
    var mb = function (v, label, tip) { var on = lm === v; return '<button type="button" class="btn sm' + (on ? ' primary' : '') + '" data-at-mode="' + v + '" aria-pressed="' + on + '" title="' + tip + '">' + label + '</button>'; };
    return (isDefault() ? '' : '<div class="at-reset-row"><button type="button" class="btn sm at-reset" data-at-reset title="Обычная тема, праздники по календарю, с украшениями, светлая или тёмная — как в системе">'
        + '<span aria-hidden="true">↺</span> Вернуть как было</button><span class="at-note">Всё оформление — как при первом запуске</span></div>')
      + '<p class="at-status" data-at-status>' + statusLine() + '</p>'
      + '<p class="at-tip' + (first ? ' first' : '') + '">' + hand + '<span>Нажмите на тему — покажу, как она выглядит, ничего не меняя</span></p>'
      + '<div class="at-modes" role="group" aria-label="Светлая или тёмная">'
      + mb('auto', '🖥 Как в системе', 'Днём светлая, вечером тёмная — как настроено на телефоне или компьютере')
      + mb('dark', '🌙 Тёмная', 'Всегда тёмная') + mb('light', '☀️ Светлая', 'Всегда светлая')
      + '<span class="at-note">' + (lm === 'auto' ? 'Сейчас ' + (m === 'dark' ? 'тёмная' : 'светлая') + ' — как в системе. ' : '') + 'Каждая тема — и светлая, и тёмная</span></div>'
      + grp('style', '🎨 Темы') + grp('norway', '🇳🇴 Норвегия') + grp('holiday', '🎉 Праздничные')
      + '<div class="at-opts">' + optionsHtml() + '</div>'
      + '<h3 class="at-h">🗓 Ближайшие праздники</h3><ul class="at-cal">' + up + '</ul>';
  }
  var picker = null;
  function openPicker() {
    if (!(W.UI && UI.modal)) return;
    if (picker) { try { picker.close(); } catch (e) { /* ignore */ } }
    picker = UI.modal({ title: '🎨 Тема приложения', body: pickerBody(), cls: 'at-modal', onClose: function () { picker = null; } });
  }
  function refreshUI() {
    if (picker && picker.el && picker.el.isConnected) {
      var body = picker.el.querySelector('.modal-body'), y = body ? body.scrollTop : 0;
      if (body) { body.innerHTML = pickerBody(); body.scrollTop = y; }
    }
    D.querySelectorAll('[data-apptheme-settings]').forEach(function (el) { el.outerHTML = settingsHtml(); });
  }
  /** the block for Settings → «🎨 Внешний вид» (views.js can print it; afterRender() adds it when it is missing) */
  function settingsHtml() {
    var c = current(), t = BY[c.id];
    return '<div class="at-set" data-apptheme-settings>'
      + '<div class="setting"><div><div>Тема приложения</div><div class="desc">' + statusLine() + '</div></div><div class="ctl"><button type="button" class="btn sm primary" data-at-open><span aria-hidden="true">' + t.emoji + '</span> ' + esc(t.name) + ' · выбрать</button></div></div>'
      + '<div class="at-opts">' + optionsHtml() + '</div></div>';
  }
  function afterRender(view, root) {
    if (fromStore()) { apply('store'); refreshUI(); } // a restored backup / the cloud copy brought another choice
    if (view !== 'settings' || !root || root.querySelector('[data-apptheme-settings]')) return;
    var h = [].slice.call(root.querySelectorAll('.panel h3')).filter(function (x) { return /Внешний вид/.test(x.textContent); })[0];
    if (!h) return;
    h.parentNode.insertAdjacentHTML('beforeend', settingsHtml());
  }

  function setTheme(id) {
    id = norm(id); if (!id) return;
    // a holiday theme picked by hand: «this holiday always» (it stays until the person changes it)
    if (isHol(id)) { setHol(id); return; }
    if (isHol(S.hol)) S.hol = 'auto'; // a usual theme after «always Halloween»: the holidays come by the calendar again
    var hol = today();
    // a manual pick during a holiday window: the user decided — the holiday stops dressing up the app this time
    if (hol && S.hol === 'auto' && id !== hol.theme) S.off[hol.key] = 1;
    S.theme = id; save(); apply('pick'); refreshUI();
  }
  /** «🎉 Праздничное оформление»: 'auto' | 'off' | a holiday id (always) */
  function setHol(v) {
    v = normHol(v, S.hol);
    S.hol = v;
    var hol = today();
    if (v === 'auto' && hol) delete S.off[hol.key]; // «by the calendar» again: today's holiday shows at once
    save(); apply('holiday'); refreshUI();
  }
  function setOpt(k, v) {
    if (k === 'auto') { setHol(v ? 'auto' : 'off'); return; }
    if (k === 'deco') S.deco = !!v;
    save(); apply('opt'); refreshUI();
  }
  /** 🖥 'auto' (as the system) | 🌙 'dark' | ☀️ 'light' */
  function setMode(m) { applyMode(m); refreshUI(); }

  /* ---------------------------------------------------------------- ↺ «Вернуть как было»: everything as for a new user */
  /** this holiday's «Вернуть обычный вид» (S.off) counts too: by default today's holiday dresses the app up */
  function holOffNow() { var h = today(); return !!(h && S.off[h.key]); }
  function isDefault() { return S.theme === DEF.theme && S.hol === DEF.hol && S.deco === DEF.deco && lightDark() === DEF.lm && !holOffNow(); }
  function snapshot() { var h = today(); return { theme: S.theme, hol: S.hol, deco: S.deco, lm: lightDark(), hkey: h ? h.key : '', hoff: !!(h && S.off[h.key]) }; }
  function restore(p) {
    if (trial) { trial = null; hideTryBar(); }
    S.theme = p.theme; S.hol = p.hol; S.deco = p.deco; S.auto = S.hol === 'auto';
    if (p.hkey) { if (p.hoff) S.off[p.hkey] = 1; else delete S.off[p.hkey]; }
    save(); applyMode(p.lm); apply('undo'); refreshUI();
  }
  /**
   * Theme «Обычная», holidays by the calendar (today's one shows again), decorations on, light / dark as the system.
   * opts.silent — no toast (e.g. a global «Вернуть настройки по умолчанию» in Settings that says it itself).
   * → { changed: bool, before: {theme, hol, deco, lm}, undo() }
   */
  function resetDefaults(opts) {
    opts = opts || {};
    var prev = snapshot(), changed = !isDefault();
    if (trial) { trial = null; hideTryBar(); }
    S.theme = DEF.theme; S.hol = DEF.hol; S.deco = DEF.deco; S.auto = true;
    if (prev.hkey) delete S.off[prev.hkey];
    save(); applyMode(DEF.lm); apply('reset'); refreshUI();
    var undo = function () { restore(prev); };
    if (!opts.silent) {
      if (!changed) toast('Оформление и так как по умолчанию');
      else if (W.UI && UI.toastAction) UI.toastAction('Оформление как было по умолчанию', 'Отменить', function () { undo(); toast('↩ Вернул ваше оформление'); }, 10000, '↺');
      else toast('Оформление как было по умолчанию');
    }
    return { changed: changed, before: { theme: prev.theme, hol: prev.hol, deco: prev.deco, lm: prev.lm }, undo: undo };
  }

  /* the one-time kind banner on the first open inside a holiday window */
  function bannerText(h) {
    var dayRu = ru(h.dayDate), n = -h.offset, when;
    if (h.isDay) when = h.id === 'nyttar' && h.offset === -1 ? 'Сегодня Nyttårsaften — канун Нового года' : 'Сегодня ' + dayRu + ' — ' + h.what;
    else if (h.offset < 0) when = (n === 1 ? 'Завтра' : 'Через ' + n + ' ' + (n % 10 === 1 && n % 100 !== 11 ? 'день' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'дня' : 'дней')) + ', ' + dayRu + ', — ' + h.what;
    else when = h.what + ' — праздник продолжается';
    return when + '. Приложение в праздничном наряде.';
  }
  function showBanner(h) {
    if (D.getElementById('at-banner')) return;
    var b = D.createElement('div');
    b.id = 'at-banner'; b.className = 'at-banner'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-labelledby', 'at-banner-t'); b.setAttribute('aria-describedby', 'at-banner-d');
    b.innerHTML = '<span class="at-b-emo" aria-hidden="true">' + h.emoji + '</span><div class="at-b-txt"><b id="at-banner-t"><span lang="nb">' + esc(h.say) + '</span></b>'
      + (h.say !== h.sayRu ? '<small class="at-b-tr">' + esc(h.sayRu) + '</small>' : '') + '<p id="at-banner-d">' + esc(bannerText(h)) + '</p>'
      + '<div class="at-b-act"><button type="button" class="btn sm primary" data-at-b="keep">💛 Оставить</button><button type="button" class="btn sm" data-at-b="normal">Вернуть обычный вид</button><button type="button" class="btn sm ghost" data-at-b="never">Не менять автоматически</button></div></div>'
      + '<button type="button" class="at-b-x" data-at-b="keep" aria-label="Закрыть" title="Закрыть">✕</button>';
    D.body.appendChild(b);
    requestAnimationFrame(function () { b.classList.add('in'); });
    var close = function () { b.classList.remove('in'); b.classList.add('out'); D.removeEventListener('keydown', onKey, true); setTimeout(function () { b.remove(); }, 320); };
    var onKey = function (e) { if (e.key === 'Escape' && !D.querySelector('#modal-root .modal-backdrop')) { close(); } };
    D.addEventListener('keydown', onKey, true);
    b.addEventListener('click', function (e) {
      var a = e.target.closest('[data-at-b]'); if (!a) return;
      var k = a.getAttribute('data-at-b');
      if (k === 'normal') { S.off[h.key] = 1; save(); apply('banner'); refreshUI(); toast('Вернул вашу обычную тему. Праздничную можно включить в «🎨 Тема приложения»'); }
      if (k === 'never') { setHol('off'); toast('Хорошо — праздничный наряд больше не включится сам. Включить: ⚙️ Настройки → Внешний вид'); }
      close();
    });
    try { var f = b.querySelector('[data-at-b="keep"]'); if (f && !('ontouchstart' in W)) f.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function toast(msg) { try { if (W.UI && UI.toast) UI.toast(msg, '', 4200); } catch (e) { /* ignore */ } }
  function maybeBanner() {
    var c = current();
    if (c.source !== 'holiday' || S.seen[c.holiday.key]) return;
    var tries = 0;
    var wait = function () {
      tries++;
      var busy = (W.NKPreloader && W.NKPreloader.active) || !D.querySelector('#view > *') || D.body.getAttribute('data-view') === 'study' || D.querySelector('#modal-root .modal-backdrop');
      if (busy && tries < 240) { setTimeout(wait, 500); return; }
      if (busy) return; // never in the way: try again next time the app opens
      var h = today();
      if (!h || h.key !== c.holiday.key || S.hol !== 'auto' || S.off[h.key] || S.seen[h.key]) return;
      S.seen[h.key] = 1; save();
      showBanner(h);
    };
    setTimeout(wait, 600);
  }

  /* ---------------------------------------------------------------- 👀 «Примерка»: see a theme before choosing it
   * A tap on a tile opens a big preview over the picker: a little app screen in that theme (top bar, decks, a flashcard
   * that flips, the four answer buttons) with the theme's background, picture, garland and decorations. The theme's
   * colours live only on that box (inline CSS variables from varsOf) — the app itself does not change.
   * ‹ › · ← → · swipe step through the themes; 🌙 / ☀️ switch the preview only.
   * «✓ Выбрать эту тему» saves (setTheme, the holiday logic included). «👀 Примерить на всём приложении» wears the theme
   * without saving it (trial): a floating bar «✓ Оставить» / «↩ Вернуть как было»; Esc or ✕ on the bar asks. Nothing is
   * written to 'nk-apptheme' while trying, so a reload brings the saved theme back.
   */
  var DEFP = { dark: Object.assign({}, BASE.dark, { accent: '#7c6cff', end: '#5b8cff' }), light: BASE.light }; // «Обычная»: the app's own colours
  /* a word for the preview card: [Norwegian, Russian, example, its translation] */
  var WORDS = {
    'default': ['velkommen', 'добро пожаловать', 'Velkommen til Norge!', 'Добро пожаловать в Норвегию!'],
    fjord: ['en fjord', 'фьорд', 'Fjorden er dyp og blå.', 'Фьорд глубокий и синий.'],
    aurora: ['et nordlys', 'северное сияние', 'Nordlyset danser på himmelen.', 'Северное сияние танцует в небе.'],
    minimal: ['et hjem', 'дом', 'Hjemme er best.', 'Дома лучше всего.'],
    rosemaling: ['en blomst', 'цветок', 'Blomsten er rød og gul.', 'Цветок красный и жёлтый.'],
    parchment: ['ei bok', 'книга', 'Boka er veldig gammel.', 'Книга очень старая.'],
    treasure: ['et kart', 'карта', 'Kartet viser veien til skatten.', 'Карта показывает путь к сокровищу.'],
    barbie: ['rosa', 'розовый', 'Kjolen er rosa.', 'Платье розовое.'],
    vampire: ['ei flaggermus', 'летучая мышь', 'Flaggermusa flyr om natta.', 'Летучая мышь летает ночью.'],
    neon: ['en by', 'город', 'Byen lyser om natta.', 'Город светится ночью.'],
    watercolor: ['en farge', 'цвет', 'Hvilken farge liker du?', 'Какой цвет тебе нравится?'],
    mocha: ['en kaffe', 'кофе', 'Jeg drikker kaffe hver morgen.', 'Я пью кофе каждое утро.'],
    hytte: ['et lys', 'свеча', 'Lyset brenner i vinduet.', 'Свеча горит в окне.'],
    contrast: ['tydelig', 'чёткий, ясный', 'Teksten er stor og tydelig.', 'Текст крупный и чёткий.'],
    troll: ['et troll', 'тролль', 'Trollet bor i fjellet.', 'Тролль живёт в горах.'],
    skog: ['en sopp', 'гриб', 'Vi plukker sopp i skogen.', 'Мы собираем грибы в лесу.'],
    viking: ['et skip', 'корабль', 'Vikingene seilte over havet.', 'Викинги плыли через море.'],
    stavkirke: ['ei kirke', 'церковь', 'Kirka er bygd av tre.', 'Церковь построена из дерева.'],
    fjellhytte: ['ei hytte', 'домик', 'Vi har ei hytte på fjellet.', 'У нас домик в горах.'],
    elg: ['en elg', 'лось', 'Elgen står i skogen.', 'Лось стоит в лесу.'],
    midnattsol: ['ei sol', 'солнце', 'Sola går ikke ned om sommeren.', 'Летом солнце не заходит.'],
    polarnatt: ['ei stjerne', 'звезда', 'Stjernene lyser i mørketida.', 'Звёзды светят в полярную ночь.'],
    lofoten: ['en fisk', 'рыба', 'Fisken tørker på hjellen.', 'Рыба сушится на вешалах.'],
    frokost: ['en vaffel', 'вафля', 'Vafler med brunost er best.', 'Вафли с брюностом — лучше всего.'],
    kongelig: ['en konge', 'король', 'Kongen vinker til folket.', 'Король машет народу.'],
    gammel: ['et bilde', 'фотография', 'Bildet er hundre år gammelt.', 'Этой фотографии сто лет.'],
    nyttar: ['et fyrverkeri', 'фейерверк', 'Fyrverkeriet lyser opp himmelen.', 'Фейерверк освещает небо.'],
    samefolket: ['et flagg', 'флаг', 'Det samiske flagget har fire farger.', 'У саамского флага четыре цвета.'],
    valentin: ['et hjerte', 'сердце', 'Hjertet mitt banker fort.', 'Моё сердце бьётся быстро.'],
    fastelavn: ['en bolle', 'булочка', 'Bollene er fylt med krem.', 'Булочки — со взбитыми сливками.'],
    paske: ['et egg', 'яйцо', 'Vi maler egg til påske.', 'Мы красим яйца к Пасхе.'],
    mai17: ['et flagg', 'флаг', 'Barna vifter med flagg.', 'Дети машут флажками.'],
    sankthans: ['et bål', 'костёр', 'Vi tenner bål ved sjøen.', 'Мы зажигаем костёр у моря.'],
    halloween: ['et gresskar', 'тыква', 'Gresskaret lyser i mørket.', 'Тыква светится в темноте.'],
    lucia: ['et lys', 'свеча', 'Lyset brenner i det mørke rommet.', 'Свеча горит в тёмной комнате.'],
    jul: ['en gave', 'подарок', 'Jeg fikk en gave til jul.', 'Мне подарили подарок на Рождество.'],
  };
  /** the themes in the picker's order (the seasonal variants live inside «Полуночное солнце · Полярная ночь») */
  function browseIds() {
    var grp = function (t) { return t.kind === 'base' || t.kind === 'style' ? 0 : t.kind === 'norway' ? 1 : t.kind === 'holiday' ? 2 : -1; };
    return [0, 1, 2].reduce(function (a, n) { return a.concat(THEMES.filter(function (t) { return grp(t) === n; }).map(function (t) { return t.id; })); }, []);
  }
  /* decorations inside the little screen: fewer pieces, sizes in % / container units (css/apptheme.css .atp-fx) */
  var PFX = { snow: 16, hearts: 7, sparks: 12, bats: 3, fireworks: 3, feathers: 8, confetti: 12, aurora: 3, mist: 2, twinkle: 14, gulls: 2, dust: 9 };
  function fxPreview(fx) {
    var n = PFX[fx] || 0, r = rnd(fx.length * 131 + 7), html = '';
    for (var i = 0; i < n; i++) {
      var flake = fx === 'snow' && i % 4 === 0;
      var st = '--x:' + (r() * 100).toFixed(1) + '%;--y:' + (r() * 70 + 5).toFixed(1) + '%;--s:' + (0.6 + r() * 0.8).toFixed(2) + ';--d:' + (fxDur(fx) * (0.75 + r() * 0.6) * 0.62).toFixed(1) + 's;--dl:-' + (r() * fxDur(fx)).toFixed(1)
        + 's;--dx:' + ((r() - 0.5) * 18).toFixed(1) + 'cqw;--r:' + Math.round(r() * 360) + 'deg;--c:var(--at-fx' + (1 + (i % 3)) + ')';
      var inner = fx === 'hearts' ? SHAPES.heart : fx === 'bats' ? SHAPES.bat : fx === 'gulls' ? SHAPES.gull : fx === 'feathers' ? SHAPES.feather : flake ? SHAPES.flake : '';
      html += '<i class="at-p at-' + fx + (flake ? ' at-flake' : '') + '" style="' + st + '">' + inner + '</i>';
    }
    return html;
  }
  function deckRow(emo, name, n, due) {
    return '<span class="atp-deck"><span class="atp-dico">' + emo + '</span><span class="atp-dt"><b>' + name + '</b><small>' + n + ' · <i>' + due + '</i></small></span><span class="atp-dgo">Учить</span></span>';
  }
  /** the little app screen of a theme in a mode (light / dark) */
  function screenHtml(id, m) {
    var t = BY[id], r = BY[resolve(id)] || t, p = r.dark ? r[m] : DEFP[m], w = WORDS[r.id] || WORDS[id] || WORDS['default'];
    var still = !motionOK();
    var pat = r.pattern ? pattern(r.pattern, p, m) : null, gar = r.garland ? garland(r.garland, m) : null;
    var vars = varsOf(p, m, null).concat(['--shadow:' + (m === 'light' ? '0 20px 50px -24px rgba(30,30,80,.35)' : '0 20px 50px -20px rgba(0,0,0,.6)'), 'color-scheme:' + m]);
    if (gar) vars.push('--at-gar:' + gar.img, '--at-gar-w:' + gar.w + 'px');
    var strip = pat && STRIPS[r.pattern];
    var patStyle = pat ? 'background-image:' + pat.img + ';background-size:' + (strip ? '100% 58%' : pat.size) + ';background-position:' + (strip ? 'center bottom' : pat.pos)
      + ';background-repeat:' + (strip ? 'no-repeat' : pat.rep) + ';opacity:' + pat.op + (pat.mask ? ';-webkit-mask-image:' + pat.mask + ';mask-image:' + pat.mask : '') : '';
    var attrs = ' data-m="' + m + '"' + (r.head ? ' data-head="' + r.head + '"' : '') + (r.serif ? ' data-serif="1"' : '') + (r.flat ? ' data-flat="1"' : '') + (r.noBlobs ? ' data-noblobs="1"' : '')
      + (r.blobBoost ? ' data-blobboost="1"' : '') + (r.garland ? ' data-gar="' + r.garland + '"' : '') + (still ? ' data-still="1"' : '');
    var grades = [['bad', 'Снова', '1 мин'], ['warn', 'Трудно', '8 мин'], ['good', 'Хорошо', '1 дн'], ['primary', 'Легко', '4 дн']];
    return '<div class="atp-screen" data-atp-screen' + attrs + ' style="' + esc(vars.join(';')) + '">'
      + '<div class="atp-blobs" aria-hidden="true"><i></i><i></i><i></i></div>'
      + (pat ? '<div class="atp-pat" aria-hidden="true" style="' + esc(patStyle) + '"></div>' : '')
      + (r.fx && !still && PFX[r.fx] ? '<div class="atp-fx" aria-hidden="true">' + fxPreview(r.fx) + '</div>' : '')
      + (r.corner ? '<div class="atp-corner at-c-' + r.corner + '" aria-hidden="true">' + cornerSvg(r.corner) + '</div>' : '')
      + (gar ? '<div class="atp-gar" aria-hidden="true"></div>' : '')
      + '<div class="atp-top" aria-hidden="true"><span class="atp-logo"><span>🇳🇴</span><span class="atp-arr">⇄</span><span>🇺🇦</span><span>🇷🇺</span><span class="atp-lt">Norsk <b>Kort</b></span></span><span class="atp-sp"></span>'
      + '<span class="atp-pill">🔥 7</span><span class="atp-ib">' + (m === 'light' ? '☀️' : '🌙') + '</span></div>'
      + '<div class="atp-main"><div class="atp-decks" aria-hidden="true"><h4 class="atp-h">Мои колоды</h4>' + deckRow('🧌', 'Сказки и тролли', '24 слова', '5 на сегодня') + deckRow('🏔', 'Природа Норвегии', '40 слов', '12 на сегодня')
        + '<span class="atp-goal"><span class="atp-goal-t"><b>🎯 Цель на сегодня</b><small>12 из 20</small></span><span class="atp-goal-bar"><i></i></span></span></div>'
      + '<div class="atp-study"><button type="button" class="atp-card" data-atp-flip aria-pressed="false" aria-label="Карточка «' + esc(w[0]) + '» — нажмите, чтобы перевернуть">'
      + '<span class="atp-face atp-front"><span class="atp-tag">🇳🇴 по-норвежски</span><b class="atp-word" lang="nb">' + esc(w[0]) + '</b><span class="atp-tap">нажмите — перевернётся</span></span>'
      + '<span class="atp-face atp-back"><span class="atp-small" lang="nb">' + esc(w[0]) + '</span><b class="atp-tr">' + esc(w[1]) + '</b><span class="atp-ex"><span lang="nb">' + esc(w[2]) + '</span><i>' + esc(w[3]) + '</i></span></span></button>'
      + '<div class="atp-grades" role="group" aria-label="Кнопки ответа — для примера">' + grades.map(function (g) { return '<button type="button" class="btn ' + g[0] + '" data-atp-grade>' + g[1] + ' <span class="kbd">' + g[2] + '</span></button>'; }).join('') + '</div>'
      + '</div></div></div>';
  }
  /* the open preview window: { id, mode, m (UI.modal), flipped, hold, auto } */
  var prev = null;
  var TIPK = 'nk-apptheme-tip';
  function tipSeen() { try { return !!localStorage.getItem(TIPK); } catch (e) { return true; } }
  function markTip() { try { localStorage.setItem(TIPK, '1'); } catch (e) { /* private mode */ } }
  function drawPreview(P, focus) {
    var host = P.m.el.querySelector('[data-atp]'); if (!host) return;
    var t = BY[P.id], r = BY[resolve(P.id)] || t, ids = browseIds(), k = ids.indexOf(P.id);
    var holi = t.kind === 'holiday' ? upcoming(12).filter(function (o) { return o.id === t.id; })[0] : null;
    var c = current(), mine = !trial && c.id === P.id, trying = trial && trial.id === P.id;
    var note = holi ? '<p class="atp-when">🗓 Сам наденется ' + esc(range(holi.startDate, holi.endDate)) + ' — если выбрано «Автоматически по праздникам». Нажмите «✓ Выбрать» — и он останется <b>всегда</b>, пока не смените.</p>' : '';
    if (t.seasonal) note = '<p class="atp-when">🌗 Меняется по сезону: весной и летом — полуночное солнце, осенью и зимой — полярная ночь. Сейчас: ' + esc(r.name.toLowerCase()) + '.</p>';
    var state = mine ? '<p class="atp-state">✓ Эта тема у вас сейчас' + (c.source === 'holiday' ? ' (праздничный наряд)' : c.source === 'always' ? ' — всегда' : '') + '</p>' : trying ? '<p class="atp-state">👀 Сейчас вы её примеряете — она ещё не сохранена</p>' : '';
    host.innerHTML = '<div class="atp-nav"><button type="button" class="btn atp-go" data-atp-go="-1" aria-label="Предыдущая тема" title="Предыдущая тема (←)">‹</button>'
      + '<div class="atp-name"><b><span aria-hidden="true">' + t.emoji + '</span> ' + esc(t.name) + '</b>' + (t.no ? '<small lang="nb">' + esc(t.no) + '</small>' : '') + '<span class="atp-count">' + (k + 1) + ' из ' + ids.length + '</span></div>'
      + '<button type="button" class="btn atp-go" data-atp-go="1" aria-label="Следующая тема" title="Следующая тема (→)">›</button></div>'
      + '<div class="atp-stage">' + screenHtml(P.id, P.mode) + '</div>'
      + '<div class="atp-info"><p class="atp-desc">' + esc(t.desc) + '</p>' + note + state
      + '<div class="atp-modes" role="group" aria-label="Светлая или тёмная — только в этом окне"><button type="button" class="btn sm' + (P.mode === 'dark' ? ' primary' : '') + '" data-atp-mode="dark" aria-pressed="' + (P.mode === 'dark') + '">🌙 Тёмная</button>'
      + '<button type="button" class="btn sm' + (P.mode === 'light' ? ' primary' : '') + '" data-atp-mode="light" aria-pressed="' + (P.mode === 'light') + '">☀️ Светлая</button></div>'
      + '<p class="at-note">Это только просмотр — приложение пока не меняется. Нажмите на карточку — она перевернётся.</p></div>';
    var ch = P.m.el.querySelector('[data-atp-choose]');
    if (ch) { ch.disabled = mine && c.source !== 'holiday'; ch.innerHTML = mine && c.source !== 'holiday' ? '<span>✓ Уже выбрана</span>' : t.kind === 'holiday' ? '<span>✓ Выбрать<span class="atp-long"> — всегда</span></span>' : '<span>✓ Выбрать<span class="atp-long"> эту тему</span></span>'; }
    P.flipped = false; P.hold = Math.max(P.hold, Date.now() + 2600); // a new theme: its front first, then it turns over by itself
    if (focus) { var f = P.m.el.querySelector(focus); if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  function flipCard(P, to) {
    var card = P.m.el.querySelector('[data-atp-flip]'); if (!card) return;
    P.flipped = to == null ? !P.flipped : !!to;
    card.classList.toggle('flipped', P.flipped); card.setAttribute('aria-pressed', String(P.flipped));
  }
  function stepPreview(P, d) {
    var ids = browseIds(), k = ids.indexOf(P.id);
    P.id = ids[(k + d + ids.length) % ids.length];
    drawPreview(P, '[data-atp-go="' + (d > 0 ? 1 : -1) + '"]');
  }
  function openPreview(id) {
    id = norm(id);
    if (!id || !(W.UI && UI.modal)) return;
    if (BY[id].kind === 'variant') id = BY[id].parent;
    if (prev) { try { prev.m.close(); } catch (e) { /* ignore */ } }
    markTip();
    var P = { id: id, mode: mode(), flipped: false, hold: 0, auto: 0, sx: 0, sy: 0, sw: false, swiped: 0 };
    P.key = function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var open = [].slice.call(D.querySelectorAll('#modal-root > .modal-backdrop:not(.closing)'));
      if (!P.m || open[open.length - 1] !== P.m.el.parentNode) return; // a window above us
      var tg = e.target; if (tg && tg.matches && tg.matches('input, textarea, select')) return;
      e.preventDefault(); stepPreview(P, e.key === 'ArrowRight' ? 1 : -1);
    };
    P.m = UI.modal({
      title: '👀 Как выглядит тема', cls: 'wide atp-modal', body: '<div class="atp" data-atp></div>',
      foot: '<button type="button" class="btn" data-atp-try title="Надеть тему на всё приложение, не сохраняя — потом решите"><span>👀 Примерить<span class="atp-long"> на всём приложении</span></span></button>'
        + '<button type="button" class="btn primary" data-atp-choose><span>✓ Выбрать<span class="atp-long"> эту тему</span></span></button>',
      onClose: function () { clearInterval(P.auto); D.removeEventListener('keydown', P.key, true); if (prev === P) prev = null; },
    });
    prev = P;
    D.addEventListener('keydown', P.key, true);
    drawPreview(P);
    // the card turns over by itself every few seconds (motion allowed); a tap holds it a little
    if (motionOK()) P.auto = setInterval(function () { if (!D.hidden && Date.now() > P.hold) flipCard(P); }, 3200);
    var root = P.m.el.parentNode;
    root.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button'); if (!b || !root.contains(b)) return;
      if (b.hasAttribute('data-atp-go')) { stepPreview(P, +b.getAttribute('data-atp-go')); return; }
      if (b.hasAttribute('data-atp-mode')) { P.mode = b.getAttribute('data-atp-mode'); drawPreview(P, '[data-atp-mode="' + P.mode + '"]'); return; }
      if (b.hasAttribute('data-atp-flip')) { if (Date.now() - P.swiped < 400) return; P.hold = Date.now() + 9000; flipCard(P); return; }
      if (b.hasAttribute('data-atp-grade')) { // an answer: the next card comes (the same word turns to its front)
        P.hold = Date.now() + 9000; var card = P.m.el.querySelector('[data-atp-flip]');
        flipCard(P, false); if (card && motionOK()) { card.classList.remove('next'); void card.offsetWidth; card.classList.add('next'); }
        return;
      }
      if (b.hasAttribute('data-atp-choose')) { chooseTheme(P.id); P.m.close(); return; }
      if (b.hasAttribute('data-atp-try')) { startTrial(P.id); return; }
    });
    // swipe ← → on the little screen
    root.addEventListener('pointerdown', function (e) { P.sw = e.pointerType !== 'mouse' && !!(e.target.closest && e.target.closest('[data-atp-screen]')); P.sx = e.clientX; P.sy = e.clientY; });
    root.addEventListener('pointerup', function (e) {
      if (!P.sw) return; P.sw = false;
      var dx = e.clientX - P.sx, dy = e.clientY - P.sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) { P.swiped = Date.now(); stepPreview(P, dx < 0 ? 1 : -1); }
    });
    root.addEventListener('pointercancel', function () { P.sw = false; });
  }
  /** the window was redrawn (innerHTML): keep the keyboard focus on the same control, not lost on <body> */
  function refocus(sel) {
    setTimeout(function () { var f = D.querySelector('.at-modal ' + sel); if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 0);
  }
  function chooseTheme(id) {
    var t = BY[id]; if (!t) return;
    if (trial) { trial = null; hideTryBar(); }
    setTheme(id);
    toast(t.kind === 'holiday' ? '✓ ' + t.emoji + ' «' + t.name + '» теперь всегда. Вернуть праздники по календарю: 🎨 Тема → «Праздничное оформление»' : '✓ Тема «' + t.name + '» выбрана');
  }

  /* the try-on: worn, not saved */
  function startTrial(id) {
    id = norm(id); if (!id) return;
    trial = { id: id };
    apply('trial'); refreshUI(); showTryBar();
    // the preview and the picker close: the person looks at the real app now
    [].slice.call(D.querySelectorAll('#modal-root > .modal-backdrop:not(.closing)')).reverse().forEach(function (bd) {
      if (bd._m && bd.querySelector('.atp-modal, .at-modal')) { try { bd._m.close(); } catch (e) { /* ignore */ } }
    });
  }
  function showTryBar() {
    if (!trial || !D.body) return;
    var t = BY[trial.id], b = D.getElementById('at-try'), fresh = !b;
    if (fresh) { b = D.createElement('div'); b.id = 'at-try'; b.className = 'at-try'; b.setAttribute('role', 'region'); b.setAttribute('aria-label', 'Примерка темы'); D.body.appendChild(b); }
    b.classList.remove('out');
    b.innerHTML = '<span class="at-try-emo" aria-hidden="true">' + t.emoji + '</span><div class="at-try-t"><b>Примерка: ' + esc(t.name) + '</b><small>Тема ещё не сохранена</small></div>'
      + '<div class="at-try-act"><button type="button" class="btn sm primary" data-at-try="keep">✓ Оставить</button><button type="button" class="btn sm" data-at-try="back">↩ Вернуть как было</button></div>'
      + '<button type="button" class="at-try-x" data-at-try="ask" aria-label="Закончить примерку" title="Закончить примерку">✕</button>';
    if (fresh) requestAnimationFrame(function () { b.classList.add('in'); }); else b.classList.add('in');
  }
  function hideTryBar() {
    var b = D.getElementById('at-try'); if (!b) return;
    b.classList.remove('in'); b.classList.add('out');
    setTimeout(function () { if (!trial) b.remove(); }, motionOK() ? 320 : 0);
  }
  function keepTrial() {
    if (!trial) return;
    var id = trial.id; trial = null; hideTryBar();
    setTheme(id);
    toast('✓ Тема «' + BY[id].name + '» сохранена');
  }
  function undoTrial() {
    if (!trial) return;
    trial = null; hideTryBar(); apply('trial-off'); refreshUI();
    toast('↩ Вернул, как было: «' + BY[current().id].name + '»');
  }
  var askingTrial = false;
  /** Esc / ✕ while trying: never lose the choice silently */
  function askTrial() {
    if (!trial || askingTrial) return;
    if (!(W.UI && UI.askClose)) return;
    askingTrial = true;
    var t = BY[trial.id];
    UI.askClose({ title: 'Оставить тему «' + esc(t.name) + '»?', line: 'Вы её примеряете — она ещё не сохранена.',
      actions: [{ label: '✓ Оставить', value: 'keep', cls: 'primary' }, { label: '↩ Вернуть как было', value: 'back' }], cancel: 'Ещё посмотрю' })
      .then(function (r) { askingTrial = false; if (r === 'keep') keepTrial(); else if (r === 'back') undoTrial(); }, function () { askingTrial = false; });
  }

  /* ---------------------------------------------------------------- events */
  function bind() {
    D.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var p = t.closest('[data-at-pick]'); if (p) { openPreview(p.getAttribute('data-at-pick')); return; }
      var tr = t.closest('[data-at-try]');
      if (tr) { var a = tr.getAttribute('data-at-try'); if (a === 'keep') keepTrial(); else if (a === 'back') undoTrial(); else askTrial(); return; }
      var o = t.closest('[data-at-open]'); if (o) { openPicker(); return; }
      var m = t.closest('[data-at-mode]'); if (m) { var mv = m.getAttribute('data-at-mode'), inWin = !!m.closest('.at-modal'); setMode(mv); if (inWin) refocus('[data-at-mode="' + mv + '"]'); return; }
      if (t.closest('[data-at-reset]')) { resetDefaults(); refocus('[data-at-mode="auto"]'); return; }
    });
    D.addEventListener('change', function (e) {
      var t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-at-opt')) setOpt(t.getAttribute('data-at-opt'), t.checked);
      if (t && t.hasAttribute && t.hasAttribute('data-at-hol') && t.checked) {
        var v = t.value; setHol(v);
        var hb = BY[v];
        toast(v === 'auto' ? '🗓 Праздничное оформление — по календарю' : v === 'off' ? 'Праздничное оформление выключено — всегда ваша тема' : '✓ ' + hb.emoji + ' «' + hb.name + '» — теперь всегда, пока не смените');
        // focus stays on the same choice after the block is redrawn
        setTimeout(function () { var f = D.querySelector('.at-modal input[data-at-hol][value="' + v + '"]') || D.querySelector('[data-apptheme-settings] input[data-at-hol][value="' + v + '"]'); if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 0);
      }
    });
    // 👀 trying a theme on: Esc (no window open, not during a card session) asks «Оставить тему?»
    D.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !trial || e.defaultPrevented) return;
      if (D.querySelector('#modal-root > .modal-backdrop:not(.closing)') || D.getElementById('at-banner') || D.body.getAttribute('data-view') === 'study') return;
      var tg = e.target; if (tg && tg.matches && tg.matches('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault(); askTrial();
    });
    // 🌞 on the top bar: right-click / long-press opens all themes (a tap still flips light / dark)
    var tb = D.getElementById('theme-btn');
    if (tb) {
      tb.title = 'Светлая / тёмная тема · правый клик или долгое нажатие — все темы приложения';
      tb.addEventListener('contextmenu', function (e) { e.preventDefault(); openPicker(); });
      var lp = 0;
      tb.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse') return; lp = setTimeout(function () { lp = -1; openPicker(); }, 550); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { tb.addEventListener(ev, function () { if (lp > 0) clearTimeout(lp); }); });
      tb.addEventListener('click', function (e) { if (lp === -1) { lp = 0; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    }
    // the app flips light / dark (App.applyTheme): re-tint the browser bar + decorations
    try { new MutationObserver(function () { apply('mode'); refreshUI(); }).observe(H, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) { /* old browser */ }
    // 🖥 «Как в системе»: the system switches light / dark while the app is open (sunset, Control Centre…)
    try {
      W.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        if (lightDark() !== 'auto') return;
        if (W.App && App.applyTheme && storeSettings()) App.applyTheme(); else paintMode('auto'); // App's own listener does the same: harmless twice
        refreshUI();
      });
    } catch (e) { /* old Safari: addListener only — App.applyTheme still follows on the next start */ }
    // motion preference may change while the app is open
    try { W.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', function () { apply('motion'); }); } catch (e) { /* old Safari */ }
    // pause the animations while the tab is hidden
    var vis = function () { if (D.hidden) H.setAttribute('data-at-paused', '1'); else H.removeAttribute('data-at-paused'); };
    D.addEventListener('visibilitychange', vis); vis();
    // a new day while the app stays open (e.g. the evening before 17. mai): check every 10 minutes
    var day = ymd(now());
    setInterval(function () { var d = ymd(now()); if (d !== day) { day = d; apply('day'); maybeBanner(); } }, 600000);
    var rt = 0;
    W.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { buildDeco(); }, 300); });
    // Store.settings.artMotion may be switched in Settings
    D.addEventListener('change', function () { setTimeout(function () { var was = H.getAttribute('data-at-motion'); var c = motionOK() ? '' : 'off'; if ((was || '') !== c) apply('motion'); }, 0); });
  }

  /* ---------------------------------------------------------------- public API */
  var API = {
    /** every theme: [{ id, name, no, emoji, kind: 'base'|'style'|'holiday', desc, fx, garland, corner }] */
    list: function () { return THEMES.map(function (t) { return { id: t.id, name: t.name, no: t.no || '', emoji: t.emoji, kind: t.kind, desc: t.desc, fx: t.fx || '', garland: t.garland || '', corner: t.corner || '', parent: t.parent || '', seasonal: !!t.seasonal }; }); },
    /** 'polar' → 'midnattsol' | 'polarnatt' (by the season); any other id → itself */
    resolve: function (id) { var n = norm(id); return n ? resolve(n) : null; },
    polarVariant: polarVariant,
    /** 🇳🇴 our own drawings (also used by js/artcards-no.js): names(), svg(name, colours, attrs), draw(name, colours) → fragment, vb(name), spruce(x, ground, h, fill, op), pattern(name, mode) */
    art: {
      names: function () { return Object.keys(ART); },
      svg: artSvg, draw: draw, spruce: spruce, at: at,
      vb: function (n) { return ART[n] ? ART[n].vb.slice() : null; },
      pattern: function (id, m) { var t = BY[resolve(norm(id) || '')]; m = m === 'light' ? 'light' : 'dark'; return t && t.pattern && t.dark ? pattern(t.pattern, t[m], m) : null; },
    },
    get: function (id) { var t = BY[norm(id)]; return t ? API.list().filter(function (x) { return x.id === t.id; })[0] : null; },
    norm: norm,
    palette: palette,
    holidays: holidays,
    today: today,
    upcoming: upcoming,
    easter: function (y) { return ymd(easter(Number(y) || now().getFullYear())); },
    current: current,
    settings: function () { return JSON.parse(JSON.stringify(S)); },
    set: setTheme,
    setAuto: function (v) { setOpt('auto', v); },
    /** «🎉 Праздничное оформление»: 'auto' (by the calendar) | 'off' | a holiday id ('halloween', 'jul', 'mai17'…) — always */
    setHoliday: setHol,
    holiday: function () { return S.hol; },
    setDeco: function (v) { setOpt('deco', v); },
    /** light / dark: 'auto' («🖥 Как в системе», follows prefers-color-scheme live) | 'dark' | 'light' — stored in Store.settings.theme */
    setMode: setMode,
    lightDark: lightDark,
    /** true when nothing differs from a new user's look (theme «Обычная», holidays by the calendar, decorations, light / dark as the system) */
    isDefault: isDefault,
    /** ↺ everything back to the defaults, at once; a toast «Оформление как было по умолчанию» + «Отменить» (opts.silent: no toast) → { changed, before, undo() } */
    resetDefaults: resetDefaults,
    apply: apply,
    open: openPicker,
    /** 👀 the big preview of one theme (nothing changes until «✓ Выбрать» / «👀 Примерить») */
    preview: openPreview,
    /** wear a theme without saving it (+ the floating bar); keepTrial() saves it, undoTrial() goes back; trying() → id | '' */
    tryOn: startTrial, keepTrial: keepTrial, undoTrial: undoTrial,
    trying: function () { return trial ? trial.id : ''; },
    settingsHtml: settingsHtml,
    afterRender: afterRender,
    motionOK: motionOK,
    /** the season id shown by the loading screen (or '') */
    season: function () { var c = current(); return (c.source === 'holiday' || c.source === 'always') && S.deco ? c.id : ''; },
    _banner: function () { var h = today(); if (h) showBanner(h); }, // for tests / a «показать снова»
  };
  W.AppThemes = API;
  if (!W.AppTheme) W.AppTheme = API; // the same object under the singular name too

  apply('boot'); // <html> attributes + colours right now (before the first paint when loaded in <head>)
  var start = function () { newUserDefault(); apply('dom'); bind(); maybeBanner(); };
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', start); else start();
})();
