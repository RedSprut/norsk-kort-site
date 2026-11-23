/* ============ 🇳🇴 Norway art-card templates for «Художественный вид» (js/artcards.js) ============
 * The same 11 Norwegian looks as the app themes (js/apptheme.js, group «🇳🇴 Норвегия»), as art-card templates:
 *   Тролли · Лес и грибы · Викинги · Ставкирка · Хютте · Лось · Полуночное солнце + Полярная ночь · Лофотены ·
 *   Норвежский завтрак · Королевская Норвегия · Старая Норвегия.
 * («Полуночное солнце · Полярная ночь» follows the season as an app theme; as a card template it is two templates,
 *  because a card you share as a picture should look exactly as you chose it.)
 *
 * Load right after js/artcards.js (+ css/artcards-no.css after css/artcards.css). Registers into the template
 * registry ArtCards.THEMES (the very object artcards.js reads — the studio, the gallery and study see them at once),
 * or through ArtCards.registerTemplate(id, def) when artcards.js offers it.
 *
 * Pictures: our own SVG drawings from AppThemes.art (js/apptheme.js) — no images, nothing copied. Without the small
 * hook in artcards.js (see the report) the picture of a card WITHOUT a photo is painted by CSS (a generated <style>),
 * the corner ornaments too; with the hook the share-picture (canvas) gets them as well. «Королевская Норвегия» draws
 * a generic crown only — never the royal / state coat of arms or the King's monogram (protected by Norwegian law).
 * «Старая Норвегия» turns a card's own photo black-and-white / sepia automatically (also when «цветокоррекция» is off).
 */
(function () {
  'use strict';
  var enc = encodeURIComponent;
  var url = function (s) { return s ? "url('data:image/svg+xml," + enc(s).replace(/'/g, '%27') + "')" : 'none'; };
  var ART = function () { return window.AppThemes && window.AppThemes.art; };
  var draw = function (n, c) { var a = ART(); return a ? a.draw(n, c || {}) : ''; };
  var at = function (x, y, s, inner, flip) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + (flip ? -s : s) + ' ' + s + ')">' + inner + '</g>'; };
  var spruce = function (x, b, h, f, op) { var a = ART(); return a ? a.spruce(x, b, h, f, op) : ''; };
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return (s % 100000) / 100000; }; }
  function stars(r, n, maxY, col, o) { var s = ''; for (var i = 0; i < n; i++) s += '<circle cx="' + (r() * 300).toFixed(1) + '" cy="' + (r() * maxY).toFixed(1) + '" r="' + (0.5 + r() * 1.3).toFixed(2) + '" fill="' + (col || '#fff') + '" opacity="' + ((o || 0.4) + r() * 0.5).toFixed(2) + '"/>'; return s; }
  function grad(id, stops) { return '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' + stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"/>'; }).join('') + '</linearGradient>'; }
  function glow(id, c, o) { return '<radialGradient id="' + id + '"><stop offset="0" stop-color="' + c + '" stop-opacity="' + (o || 0.7) + '"/><stop offset="1" stop-color="' + c + '" stop-opacity="0"/></radialGradient>'; }
  /** a whole picture: 300 × 400, sliced to any card shape. inline = drawn into the page (unique ids, class acno) */
  function wrap(p, inner, w, h, inline) {
    return '<svg xmlns="http://www.w3.org/2000/svg"' + (inline ? ' class="acno"' : '') + ' width="' + (w || 300) + '" height="' + (h || 400) + '" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + inner(p) + '</svg>';
  }

  /* ---------- the scenes (p = id prefix, r = random by card) ---------- */
  var SCENES = {
    troll: function (p, r) {
      return '<defs>' + grad(p + 's', [[0, '#3b2f4a'], [0.5, '#c8703a'], [0.78, '#f4c27a'], [1, '#f8d898']]) + glow(p + 'g', '#ffd98a', 0.75) + '</defs><rect width="300" height="400" fill="url(#' + p + 's)"/>'
        + '<circle cx="214" cy="246" r="120" fill="url(#' + p + 'g)"/><circle cx="214" cy="246" r="24" fill="#ffe3a3" opacity=".9"/>'
        + '<path d="M0 262L40 230L80 246L130 200L170 236L220 214L260 240L300 222V400H0Z" fill="#7a6170" opacity=".55"/>'
        + at(258, 206, 0.36, draw('troll', { flat: 1, f: '#6a5a5a', eye: '#ffcf6a' }), true)
        + '<path d="M0 300L50 268L100 290L150 262L210 296L260 270L300 286V400H0Z" fill="#5b6a4a"/>'
        + at(40, 84, 1.1, draw('troll', { f: '#4f5a36', tree: '#2f3d24', eye: '#ffcf6a', moss: '#8fae5a' }))
        + '<path d="M0 340C60 322 140 330 200 338S280 330 300 336V400H0Z" fill="#283222"/>' + at(-14, 296, 0.72, draw('stones', { f: '#5a5a4c', f2: '#4c4a40', moss: '#7a9a48' }));
    },
    skog: function (p) {
      var far = '', mid = '';
      for (var i = 0; i < 13; i++) far += spruce(i * 25, 214, 62 + (i * 37 % 30), '#9fb5a5');
      for (var j = 0; j < 8; j++) mid += spruce(j * 42 + 10, 282, 112 + (j * 53 % 40), '#56775f');
      return '<defs>' + grad(p + 's', [[0, '#e8eee6'], [0.45, '#aec3b3'], [1, '#3a5a46']]) + glow(p + 'g', '#fff8e0', 0.8) + '</defs><rect width="300" height="400" fill="url(#' + p + 's)"/><circle cx="80" cy="90" r="110" fill="url(#' + p + 'g)"/>'
        + far + '<ellipse cx="150" cy="210" rx="220" ry="22" fill="#fff" opacity=".42"/>' + mid + '<ellipse cx="150" cy="276" rx="230" ry="20" fill="#fff" opacity=".32"/>'
        + spruce(20, 380, 250, '#1f3a2a') + spruce(286, 380, 230, '#1f3a2a')
        + '<path d="M0 330C80 310 200 318 300 326V400H0Z" fill="#2f5a36"/>' + at(118, 228, 0.92, draw('mushrooms', {}));
    },
    viking: function (p, r) {
      return '<defs>' + grad(p + 's', [[0, '#0b1222'], [0.6, '#1f3346'], [1, '#3c5664']]) + glow(p + 'g', '#f6e7c0', 0.45) + '</defs><rect width="300" height="400" fill="url(#' + p + 's)"/>'
        + stars(r, 28, 160) + '<circle cx="232" cy="70" r="60" fill="url(#' + p + 'g)"/><circle cx="232" cy="70" r="17" fill="#f6eed8"/>'
        + '<path d="M0 270L40 236L90 252L140 222L190 250L250 228L300 246V280H0Z" fill="#1a2730"/><rect y="268" width="300" height="132" fill="#15303c"/>'
        + '<g stroke="#e8c98a" stroke-width="2" opacity=".35" stroke-linecap="round"><path d="M210 290h40M220 302h26M226 314h14"/></g>'
        + at(28, 166, 1.36, draw('longship', { wave: '#7fb0c8' })) + '<path d="M0 352q25-10 50 0t50 0 50 0 50 0 50 0 50 0V400H0Z" fill="#102530"/>';
    },
    stavkirke: function (p) {
      return '<defs>' + grad(p + 's', [[0, '#2a2036'], [0.55, '#8a4a3a'], [1, '#e8a868']]) + glow(p + 'g', '#ffcf8a', 0.6) + '</defs><rect width="300" height="400" fill="url(#' + p + 's)"/><circle cx="150" cy="250" r="140" fill="url(#' + p + 'g)"/>'
        + '<path d="M0 250C60 222 120 236 170 226S260 214 300 232V400H0Z" fill="#4a3040" opacity=".6"/>'
        + spruce(30, 290, 150, '#2a1f1a') + spruce(270, 290, 160, '#2a1f1a') + spruce(62, 290, 110, '#2a1f1a') + spruce(240, 290, 120, '#2a1f1a')
        + at(73, 84, 1.1, draw('church', {})) + '<path d="M0 270C80 262 220 262 300 270V400H0Z" fill="#1a120c"/>' + spruce(8, 400, 220, '#120c08') + spruce(296, 400, 200, '#120c08');
    },
    fjellhytte: function (p, r) {
      var snow = ''; for (var i = 0; i < 46; i++) snow += '<circle cx="' + (r() * 300).toFixed(1) + '" cy="' + (r() * 400).toFixed(1) + '" r="' + (0.8 + r() * 1.8).toFixed(2) + '" fill="#fff" opacity="' + (0.4 + r() * 0.5).toFixed(2) + '"/>';
      return '<defs>' + grad(p + 's', [[0, '#0f1630'], [0.55, '#2a3a66'], [1, '#6f84b0']]) + glow(p + 'g', '#ffc76a', 0.55) + '</defs><rect width="300" height="400" fill="url(#' + p + 's)"/>' + stars(r, 26, 150)
        + '<path d="M0 230L60 150L100 190L160 120L220 190L260 160L300 200V400H0Z" fill="#cfd9ea" opacity=".75"/><path d="M160 120L140 160L156 152L166 168L176 150L190 156Z" fill="#fff" opacity=".8"/>'
        + '<path d="M0 290C70 262 160 270 210 282S280 270 300 276V400H0Z" fill="#e8eef7"/>' + spruce(30, 300, 110, '#1f4a33') + spruce(54, 300, 80, '#1f4a33')
        + '<circle cx="128" cy="270" r="70" fill="url(#' + p + 'g)"/>' + at(66, 176, 1.12, draw('cabin', {})) + '<path d="M0 330C80 316 220 318 300 328V400H0Z" fill="#f4f7fb"/>' + snow;
    },
    elg: function (p) {
      var far = '', mid = '';
      for (var i = 0; i < 12; i++) far += spruce(i * 27, 236, 70 + (i * 41 % 34), '#a89a6a', 0.75);
      [[16, 170], [56, 130], [250, 150], [286, 180]].forEach(function (q) { mid += spruce(q[0], 330, q[1], '#3c4428'); });
      return '<defs>' + grad(p + 's', [[0, '#f3e6bf'], [0.55, '#d4b67a'], [1, '#7a7046']]) + glow(p + 'g', '#fff4cf', 0.8) + '</defs><rect width="300" height="400" fill="url(#' + p + 's)"/><circle cx="90" cy="110" r="120" fill="url(#' + p + 'g)"/>'
        + far + '<path d="M0 290C80 274 220 276 300 286V400H0Z" fill="#5a6440"/>' + at(78, 186, 1.62, draw('moose', { f: '#2a2216' })) + mid
        + '<path d="M0 330C90 318 210 320 300 330V400H0Z" fill="#3c4428"/><g stroke="#6b7a44" stroke-width="2" stroke-linecap="round"><path d="M70 330l-3-12M76 330l2-14M210 330l-2-12M216 330l3-10"/></g>';
    },
    midnattsol: function (p) {
      return '<defs>' + grad(p + 's', [[0, '#3a2a5a'], [0.35, '#a8507a'], [0.6, '#f08a4a'], [0.66, '#ffd27a'], [1, '#ffd27a']]) + glow(p + 'g', '#ffe2a0', 0.85) + '</defs><rect width="300" height="400" fill="url(#' + p + 's)"/>'
        + '<circle cx="150" cy="262" r="110" fill="url(#' + p + 'g)"/><circle cx="150" cy="262" r="32" fill="#ffe8b0"/>'
        + '<path d="M0 262L30 210L60 230L100 180L140 262ZM170 262L200 222L230 236L270 190L300 214V262Z" fill="#4a2a4a"/>'
        + '<rect y="262" width="300" height="138" fill="#3a2448"/><g fill="#ffd27a"><rect x="110" y="270" width="80" height="3" rx="1.5"/><rect x="120" y="282" width="60" height="3" rx="1.5" opacity=".85"/><rect x="130" y="294" width="40" height="2.6" rx="1.3" opacity=".7"/><rect x="138" y="306" width="24" height="2.4" rx="1.2" opacity=".55"/><rect x="143" y="318" width="14" height="2" rx="1" opacity=".4"/></g>';
    },
    polarnatt: function (p, r) {
      return '<defs>' + grad(p + 's', [[0, '#02050f'], [0.6, '#0b1838'], [1, '#1b3a6a']]) + '<linearGradient id="' + p + 'a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3dffb4" stop-opacity="0"/><stop offset=".5" stop-color="#3dffb4" stop-opacity=".55"/><stop offset="1" stop-color="#7a6bff" stop-opacity="0"/></linearGradient></defs>'
        + '<rect width="300" height="400" fill="url(#' + p + 's)"/>' + stars(r, 60, 240, '#fff', 0.3)
        + '<path d="M-20 120C60 70 140 150 220 100S300 70 320 90" fill="none" stroke="url(#' + p + 'a)" stroke-width="34" stroke-linecap="round" opacity=".7"/>'
        + '<circle cx="230" cy="64" r="16" fill="#f4f1e2"/><circle cx="238" cy="58" r="14" fill="#06091a"/>'
        + '<path d="M0 290L50 220L80 246L130 180L180 250L220 210L260 240L300 222V400H0Z" fill="#8fa4c8"/><path d="M130 180L112 214L126 208L136 222L146 206L160 214ZM50 220L38 244L50 238L58 248L66 236Z" fill="#eaf1fb"/>'
        + '<path d="M0 320C80 300 200 308 300 314V400H0Z" fill="#cfdcf0"/><rect x="214" y="292" width="26" height="18" fill="#1a2440"/><path d="M210 294l17-12 17 12z" fill="#eaf1fb"/><rect x="223" y="298" width="7" height="6" fill="#ffd27a"/>';
    },
    lofoten: function (p, r) {
      return '<defs>' + grad(p + 's', [[0, '#7fb2d4'], [0.55, '#cfe2ee'], [1, '#e8f0f4']]) + '</defs><rect width="300" height="400" fill="url(#' + p + 's)"/>'
        + '<path d="M0 270L30 190L50 214L90 90L120 170L150 130L190 230L220 170L250 120L300 230V270Z" fill="#6f7f8c"/><path d="M90 90L78 128L92 120L100 134L108 116L114 124ZM250 120L238 150L250 144L258 156L266 142Z" fill="#fff"/>'
        + '<path d="M0 270L40 236L80 256L120 230L170 262L220 240L300 262V280H0Z" fill="#56656f"/>' + '<rect y="270" width="300" height="130" fill="#2f6f8a"/>'
        + at(14, 186, 1.06, draw('rorbu', { peak: 'none', sea: '#2f6f8a' })) + at(178, 206, 0.9, draw('hjell', {}))
        + at(170, 60, 0.9, draw('gull', { f: '#f4f7fa' })) + at(214, 86, 0.6, draw('gull', { f: '#f4f7fa' }))
        + '<g stroke="#fff" stroke-width="2" opacity=".4" stroke-linecap="round"><path d="M20 344h40M150 356h50M240 340h30"/></g>';
    },
    frokost: function (p) {
      var g = ''; for (var i = 0; i < 10; i++) g += '<rect x="' + i * 30 + '" width="15" height="400" fill="#c8323a" opacity=".16"/><rect y="' + i * 40 + '" width="300" height="15" fill="#c8323a" opacity=".16"/>';
      return '<defs>' + glow(p + 'g', '#ffffff', 0.55) + '</defs><rect width="300" height="400" fill="#fbe9d6"/>' + g + '<circle cx="150" cy="170" r="190" fill="url(#' + p + 'g)"/>' + at(38, 108, 1.42, draw('breakfast', {}));
    },
    kongelig: function (p, r) {
      var spark = ''; for (var i = 0; i < 14; i++) { var x = (r() * 300).toFixed(0), y = (r() * 260).toFixed(0), s = (0.4 + r() * 0.8).toFixed(2); spark += '<path transform="translate(' + x + ' ' + y + ') scale(' + s + ')" d="M0-6L1.5-1.5 6 0 1.5 1.5 0 6-1.5 1.5-6 0-1.5-1.5z" fill="#f0cf74" opacity=".7"/>'; }
      var flag = function (x, y, rot) { return '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ')"><path d="M0 0v70" stroke="#c9a54a" stroke-width="3"/><rect x="1" y="0" width="44" height="32" fill="#ba0c2f"/><rect x="13" y="0" width="8" height="32" fill="#fff"/><rect x="1" y="12" width="44" height="8" fill="#fff"/><rect x="15" y="0" width="4" height="32" fill="#00205b"/><rect x="1" y="14" width="44" height="4" fill="#00205b"/></g>'; };
      return '<defs>' + grad(p + 's', [[0, '#0a1438'], [0.6, '#13235e'], [1, '#0a1238']]) + glow(p + 'g', '#f0cf74', 0.45) + '</defs><rect width="300" height="400" fill="url(#' + p + 's)"/>' + spark
        + '<path d="M0 0H74C64 80 44 170 0 236Z" fill="#7a1430"/><path d="M18 0C16 70 10 140 0 190M44 0C40 70 30 140 10 214" stroke="#5a0f24" stroke-width="3" fill="none"/>'
        + '<path d="M300 0H226C236 80 256 170 300 236Z" fill="#7a1430"/><path d="M282 0C284 70 290 140 300 190M256 0C260 70 270 140 290 214" stroke="#5a0f24" stroke-width="3" fill="none"/>'
        + '<circle cx="150" cy="176" r="96" fill="url(#' + p + 'g)"/>' + at(80, 104, 1.0, draw('crown', {})) + flag(96, 228, -16) + flag(204, 228, 16).replace('rotate(16)', 'rotate(16) scale(-1 1)');
    },
    gammel: function (p) {
      return '<defs>' + grad(p + 's', [[0, '#e2d8c2'], [0.6, '#c4b698'], [1, '#b0a184']]) + '<filter id="' + p + 'n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .2 0 0 0 0 .16 0 0 0 0 .1 0 0 0 .6 0"/></filter>'
        + '<radialGradient id="' + p + 'v" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#3a2e1e" stop-opacity="0"/><stop offset="1" stop-color="#3a2e1e" stop-opacity=".55"/></radialGradient></defs>'
        + '<rect width="300" height="400" fill="url(#' + p + 's)"/><path d="M0 250L50 170L80 196L140 120L190 200L230 160L300 230V260H0Z" fill="#a09278"/><path d="M140 120L126 148L138 142L146 156L156 140Z" fill="#efe6d2" opacity=".8"/>'
        + '<path d="M0 262L60 220L110 246L170 214L240 250L300 236V270H0Z" fill="#857760"/><rect y="262" width="300" height="138" fill="#b7aa90"/><g stroke="#e8dcc4" stroke-width="1.6" opacity=".6"><path d="M30 280h60M150 290h80M60 304h40"/></g>'
        + '<path d="M196 296c10 6 34 6 44 0l-4 8h-36z" fill="#4a4234"/><path d="M218 296l-14-22M206 274l18 4" stroke="#4a4234" stroke-width="2"/>'
        + '<rect x="40" y="236" width="22" height="16" fill="#5a4e3e"/><path d="M37 238l14-10 14 10z" fill="#3e3428"/>'
        + '<rect width="300" height="400" fill="url(#' + p + 'v)"/><rect width="300" height="400" filter="url(#' + p + 'n)" opacity=".5"/>';
    },
  };

  /* ---------- corner ornaments (100 × 100; top-left, mirrored on the right by artcards.css) ---------- */
  function bough(snow) {
    var s = '<path d="M-4-4C20 14 44 34 70 62" stroke="#5a3a22" stroke-width="3.4" fill="none" stroke-linecap="round"/><g stroke="#24503a" stroke-width="2.2" stroke-linecap="round">';
    for (var i = 1; i < 14; i++) { var t = i / 14, x = -4 + 74 * t, y = -4 + 66 * t * t * 0.4 + 66 * t * 0.6; s += '<path d="M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'l' + (8 - t * 3).toFixed(1) + ' ' + (-10 + t * 2).toFixed(1) + 'M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'l' + (-9 + t * 3).toFixed(1) + ' ' + (6 - t).toFixed(1) + '"/>'; }
    s += '</g><path d="M66 58c6 0 10 6 9 14-3 6-9 6-11 0-2-6-1-12 2-14z" fill="#7a5030"/><path d="M66 62h7M66 67h8" stroke="#5a3a22" stroke-width="1"/>';
    if (snow) s += '<g fill="#fff"><ellipse cx="14" cy="10" rx="9" ry="3.4" transform="rotate(30 14 10)"/><ellipse cx="34" cy="26" rx="10" ry="3.6" transform="rotate(36 34 26)"/><ellipse cx="54" cy="44" rx="8" ry="3" transform="rotate(42 54 44)"/></g>';
    return s;
  }
  var ORN = {
    troll: function () { // a lingonberry sprig (tyttebær)
      var s = '<path d="M-2 4C22 14 40 30 54 58" stroke="#5a3a22" stroke-width="2.6" fill="none" stroke-linecap="round"/><g fill="#3f6b35">';
      [[14, 10, 30], [26, 18, -20], [34, 30, 40], [44, 40, -10], [50, 52, 50]].forEach(function (q) { s += '<ellipse cx="' + q[0] + '" cy="' + q[1] + '" rx="7" ry="3.6" transform="rotate(' + q[2] + ' ' + q[0] + ' ' + q[1] + ')"/>'; });
      return s + '</g><g fill="#c8202a"><circle cx="20" cy="22" r="4.4"/><circle cx="28" cy="26" r="4"/><circle cx="40" cy="48" r="4.4"/><circle cx="58" cy="62" r="4.6"/><circle cx="50" cy="64" r="3.8"/></g><g fill="#fff" opacity=".7"><circle cx="19" cy="20.6" r="1.2"/><circle cx="39" cy="46.6" r="1.2"/><circle cx="57" cy="60.6" r="1.3"/></g>';
    },
    skog: function () { return bough(false); },
    viking: function () { return at(4, 4, 0.5, draw('shield', {})); },
    stavkirke: function () { return at(2, 2, 0.66, draw('dragon', {})); },
    fjellhytte: function () { return bough(true); },
    elg: function () { return at(6, 4, 0.56, draw('elgsign', {})); },
    midnattsol: function () { var s = ''; for (var i = 0; i <= 6; i++) { var a = i * Math.PI / 12; s += 'M' + (Math.cos(a) * 40).toFixed(1) + ' ' + (Math.sin(a) * 40).toFixed(1) + 'L' + (Math.cos(a) * 64).toFixed(1) + ' ' + (Math.sin(a) * 64).toFixed(1); } return '<path d="' + s + '" stroke="#ffd27a" stroke-width="3" stroke-linecap="round" opacity=".85"/><circle r="32" fill="#ffd27a"/><circle r="42" fill="#ffd27a" opacity=".25"/>'; },
    polarnatt: function () { return '<circle cx="26" cy="26" r="14" fill="#f4f1e2"/><circle cx="33" cy="21" r="12.5" fill="#0b1838"/>' + [[56, 16, 1.6], [44, 44, 1], [16, 56, 1.2], [70, 34, 0.8]].map(function (q) { return '<path transform="translate(' + q[0] + ' ' + q[1] + ') scale(' + q[2] + ')" d="M0-6L1.5-1.5 6 0 1.5 1.5 0 6-1.5 1.5-6 0-1.5-1.5z" fill="#cfe0ff"/>'; }).join(''); },
    lofoten: function () { return at(-8, -10, 0.78, draw('hjell', {})); },
    frokost: function () { return at(0, 0, 0.84, draw('waffle', {})); },
    kongelig: function () { return '<g fill="none" stroke="#f0cf74" stroke-linecap="round"><path d="M8 96V22Q8 8 22 8H96" stroke-width="3.4"/><path d="M16 96V28Q16 16 28 16H96" stroke-width="1.4"/><path d="M26 54c10-2 14-12 8-18-6-6-16 0-12 8M54 26c-2 10-12 14-18 8-6-6 0-16 8-12" stroke-width="2.2"/></g><circle cx="22" cy="22" r="4.4" fill="#ba0c2f" stroke="#f0cf74" stroke-width="1.6"/>'; },
    gammel: function () { return '<path d="M0 0H36L0 36Z" fill="#2a2420"/><path d="M0 36L36 0" stroke="#6a6058" stroke-width="1.2"/>'; },
  };
  var ORN2 = { // a different picture on the right corner (not mirrored)
    frokost: function () { return at(18, 6, 1.0, draw('coffee', {})); },
  };
  var ornSvg = function (id) { var o = ORN[id]; return o ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' + o() + '</svg>' : ''; };
  var orn2Svg = function (id) { var o = ORN2[id]; return o ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' + o() + '</svg>' : ''; };

  /* ---------- the templates (same fields as T() in js/artcards.js; extra: group, scene, ornament, forceGrade) ---------- */
  var DEF = { layout: 'scrim', scrim: '6,10,24', ink: '#ffffff', font: 'playfair', grade: 'none', tint: '#000000', orn: '' };
  var TPL = {
    troll: { name: 'Тролли', icon: '🧌', bg: ['#3b2f4a', '#c8703a', '#f4c27a'], mt: ['#5b6a4a', '#3f4c32', '#283222'], accent: '#ffc46b', ink: '#fff6e6', scrim: '24,20,10', font: 'lora', grade: 'sepia(.15) saturate(1.05) contrast(1.04)', tint: '#e08a3a', sun: true },
    skog: { name: 'Лес и грибы', icon: '🍄', bg: ['#d5dfd6', '#8fa898', '#2d4a38'], mt: ['#6f8f78', '#3f6048', '#1f3527'], accent: '#f6b73c', ink: '#ffffff', scrim: '10,26,18', font: 'lora', grade: 'saturate(1.05) contrast(1.03)', tint: '#2f6b3f' },
    viking: { name: 'Викинги', icon: '⛵', bg: ['#0d1420', '#1f3040', '#3a4a52'], mt: ['#2a3a44', '#1c2830', '#10181e'], accent: '#e8b56a', ink: '#f6eee2', scrim: '14,12,10', font: 'oswald', upper: true, grade: 'sepia(.2) contrast(1.1) saturate(.9)', tint: '#8a5a2a', water: true, stars: true, moon: true },
    stavkirke: { name: 'Ставкирка', icon: '⛪', bg: ['#2a2036', '#8a4a3a', '#e0a066'], mt: ['#3a2c22', '#271c15', '#160f0a'], accent: '#f0b070', ink: '#fff4e8', scrim: '20,12,8', font: 'playfair', frame: true, grade: 'sepia(.12) saturate(1.05) contrast(1.05)', tint: '#b0602a' },
    fjellhytte: { name: 'Хютте', icon: '🏡', bg: ['#141c36', '#2c3a66', '#8fa2c8'], mt: ['#dfe8f5', '#b9c8de', '#8fa2c0'], accent: '#ffcf70', ink: '#fffaf2', scrim: '18,16,30', font: 'comfortaa', grade: 'saturate(.95) sepia(.08) brightness(1.02)', tint: '#ffb050', snow: true, stars: true },
    elg: { name: 'Лось · Elg', icon: '🫎', bg: ['#e9d9a8', '#9a8a5a', '#3a3a22'], mt: ['#5a6440', '#3c4428', '#222816'], accent: '#ffd23a', ink: '#ffffff', scrim: '20,20,10', font: 'montserrat', grade: 'saturate(1.05) contrast(1.05)', tint: '#c9a040' },
    midnattsol: { name: 'Полуночное солнце', icon: '🌞', bg: ['#3a2a5a', '#d9704a', '#ffd27a'], mt: ['#5a3a5a', '#3a2440', '#22162a'], accent: '#ffd27a', ink: '#fffaf0', scrim: '36,16,30', font: 'montserrat', grade: 'saturate(1.1) sepia(.1) contrast(1.04)', tint: '#ff9a4a', sun: true, water: true },
    polarnatt: { name: 'Полярная ночь', icon: '🌌', bg: ['#030714', '#0b1838', '#1b3a6a'], mt: ['#cfdcf0', '#7f94bc', '#3a4f7a'], accent: '#9cc4ff', ink: '#f0f6ff', scrim: '3,8,22', font: 'montserrat', grade: 'saturate(.9) brightness(.92) hue-rotate(8deg) contrast(1.06)', tint: '#2a4a9a', stars: true, moon: true, aurora: true },
    lofoten: { name: 'Лофотены', icon: '🐟', bg: ['#8fbcd8', '#d8e8f0', '#5f8ea8'], mt: ['#7a8a98', '#5a6a78', '#2f5a70'], accent: '#ffd08a', ink: '#ffffff', scrim: '8,24,36', font: 'oswald', grade: 'saturate(1.08) contrast(1.04)', tint: '#3a8ab0', water: true },
    frokost: { name: 'Норвежский завтрак', icon: '🧇', layout: 'paper', paper: '#fff6e6', bg: ['#f8e2b8', '#f0c890', '#d89a5a'], mt: ['#e8b070', '#c98a4a', '#a8682e'], accent: '#8a3a1a', ink: '#3a2210', font: 'pacifico', grade: 'saturate(1.08) sepia(.1) brightness(1.03)', tint: '#f0a040' },
    kongelig: { name: 'Королевская Норвегия', icon: '👑', bg: ['#0a1438', '#13235e', '#5a0f24'], mt: ['#1b2a6a', '#14205a', '#0a1238'], accent: '#f0cf74', ink: '#fffaf0', scrim: '8,12,36', font: 'playfair', frame: true, grade: 'saturate(1.05) contrast(1.05)', tint: '#1b3a9a', stars: true },
    gammel: { name: 'Старая Норвегия', icon: '📷', layout: 'paper', paper: '#ece3cf', bg: ['#d8cdb6', '#b7a888', '#6e6250'], mt: ['#8a7c64', '#6a5e4a', '#4a4234'], accent: '#5a4630', ink: '#2a2118', font: 'oldstd', grade: 'grayscale(1) sepia(.55) contrast(1.12) brightness(.94)', tint: '#a08660', forceGrade: true },
  };
  var IDS = Object.keys(TPL);

  function build(id) {
    var t = Object.assign({}, DEF, TPL[id], { group: 'no', orn: 'no-' + id });
    // artcards.js hook (optional): a picture with this card's own variation + the same ornaments in the share-picture
    t.scene = function (seed, w, h) { // every other card mirrored: a gallery of the same template does not repeat itself
      return ART() && SCENES[id] ? wrap('acno' + (seed % 1e6) + id.slice(0, 2), function (p) { var inner = SCENES[id](p, rng(seed)); return seed % 2 ? '<g transform="translate(300 0) scale(-1 1)">' + inner + '</g>' : inner; }, w, h, true) : '';
    };
    t.ornament = function () { return ornSvg(id); };
    return t;
  }
  function register() {
    var AC = window.ArtCards;
    if (!AC || !AC.THEMES) return false;
    // a font id that this artcards.js does not know → its book serif
    var fonts = (AC.FONTS || []).map(function (f) { return f.id; });
    IDS.forEach(function (id) {
      var t = build(id);
      if (fonts.length && fonts.indexOf(t.font) < 0) t.font = fonts.indexOf('playfair') > -1 ? 'playfair' : fonts[2] || 'playfair';
      if (typeof AC.registerTemplate === 'function') AC.registerTemplate(id, t);
      else if (!AC.THEMES[id] || AC.THEMES[id].group === 'no') AC.THEMES[id] = t; // never overwrite a template of artcards.js itself
    });
    return true;
  }

  /* ---------- CSS generated from the drawings (works without any change in artcards.js) ---------- */
  function styles() {
    if (!ART() || document.getElementById('acno-vars')) return;
    var out = [];
    IDS.forEach(function (id) {
      var sc = wrap('n', function (p) { return SCENES[id](p, rng(id.length * 7919 + 17)); });
      var o = ornSvg(id), o2 = orn2Svg(id);
      out.push('.ac-th-' + id + '{--ac-orn:' + url(o) + ' !important' + (o2 ? ';--acno-orn2:' + url(o2) : '') + '}');
      out.push('.ac-th-' + id + ' .ac-fb{background:' + url(sc) + ' center/cover no-repeat,linear-gradient(160deg,' + TPL[id].bg.join(',') + ')}');
      out.push('.ac-th-' + id + ' .ac-fb>svg:not(.acno){visibility:hidden}');
      out.push('.ac-thb[data-v="' + id + '"]{background-image:' + url(sc).replace("')", "')") + ';background-size:cover;background-position:center 60%}');
    });
    var st = document.createElement('style');
    st.id = 'acno-vars';
    st.textContent = out.join('\n');
    (document.head || document.documentElement).appendChild(st);
  }

  var api = {
    ids: IDS.slice(),
    /** the template definition (a copy) */
    get: function (id) { return TPL[id] ? build(id) : null; },
    /** the picture of a template as an <svg> string (seed = card variation) */
    scene: function (id, seed, w, h) { return SCENES[id] && ART() ? wrap('acnx' + id.slice(0, 3), function (p) { return SCENES[id](p, rng(seed || 1)); }, w, h) : ''; },
    ornament: ornSvg,
    register: register,
  };
  window.ArtCardsNO = api;

  var go = function () { if (register()) styles(); };
  if (window.ArtCards) go();
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
  if (!window.ArtCards) window.addEventListener('load', function () { if (window.ArtCards && !window.ArtCards.THEMES.troll) go(); });
})();
