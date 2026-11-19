/* ============ Norsk Kort — loading screen (preloader) ============
 * Own code (no libraries). Loaded early in <head>; builds the scene inside <div id="nkp"> (top of <body>)
 * the moment the parser reaches it, before the first paint.
 *
 *  every app load — first visit, reload, re-open (≈3.3 s):
 *    photo flashcards (fjords, Lofoten, hytte, nordlys, Bryggen…) + the app's feature badges swirl in from every side
 *    → a mini «video» plays a Norwegian subtitle line, karaoke-highlighted, with the Russian word under each word
 *    → everything is pulled into one deck → the deck fans out like a hand of cards → a graduation cap drops on it
 *    → «Norsk Kort» 🇳🇴⇄🇷🇺 → fade + zoom into the app.
 *  No «seen» flag / short mode: the full show plays on every load (owner's request).
 *  prefers-reduced-motion: a calm static composition, then a fade.
 *
 * Never blocks the app: it leaves when the window has loaded AND <main id="view"> has content AND the sequence has
 * played. «Played» is measured on the animations' own clock (Animation.currentTime), which starts at the first
 * rendered frame — so a slow first paint (cold cache, heavy scripts) never makes it jump to the end or cut it short.
 * A tap / click / any key skips at once; hard limit 6.5 s after start; css/preloader.css hides it at 5.5 s
 * even if this script never runs. Only transform and opacity are animated (Web Animations → compositor).
 */
(function () {
  'use strict';
  var D = document, W = window;
  var IMG = 'icons/preloader/';
  try { sessionStorage.removeItem('nkp-seen'); } catch (e) { /* flag of an older build — no longer used */ }
  var reduce = false;
  try { reduce = W.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* old browser */ }
  var canAnim = typeof D.documentElement.animate === 'function';
  if (!canAnim) reduce = true;

  /* cards in fan order, left → right (the centre one gets the cap) */
  var CARDS = [
    ['stavkirke', 'kirke', 'церковь'],
    ['fjord', 'fjord', 'фьорд'],
    ['hytte', 'hytte', 'домик'],
    ['preikestolen', 'fjell', 'гора'],
    ['lofoten', 'velkommen', 'добро пожаловать'],
    ['nordlys', 'nordlys', 'северное сияние'],
    ['bryggen', 'takk', 'спасибо'],
    ['snohytte', 'snø', 'снег'],
    ['vinterskog', 'skog', 'лес']
  ];
  var VIDEO_IMG = 'video-reine'; // Reine, Lofoten — a wider frame for the «video»
  var SUB = [['Jeg', 'я'], ['bor', 'живу'], ['i', 'в'], ['Norge', 'Норвегии']];
  var SUB_RU = 'Я живу в Норвегии.';

  /* the app's own icons (YouTube.YT_SVG, Telegram.TG_SVG) + own stylised glyphs */
  var YT = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="4.5" width="21" height="15" rx="4.5" fill="#ff0033"/><path d="M10 8.8v6.4l5.6-3.2z" fill="#fff"/></svg>';
  var TG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#29a9eb"/><path d="M5.4 11.6 17 7.1c.6-.2 1 .1.9.9l-2 9.3c-.1.6-.6.8-1.1.5l-3-2.2-1.4 1.4c-.2.2-.3.3-.6.3l.2-3.1 5.6-5.1c.2-.2 0-.4-.4-.2l-6.9 4.4-3-.9c-.6-.2-.6-.6.1-.9z" fill="#fff"/></svg>';
  var AI = '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="nkp-ai" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c3b5ff"/><stop offset="1" stop-color="#29c7ff"/></linearGradient></defs><path d="M10.5 2.5c.7 5 3.1 7.4 8.1 8.1-5 .7-7.4 3.1-8.1 8.1-.7-5-3.1-7.4-8.1-8.1 5-.7 7.4-3.1 8.1-8.1z" fill="url(#nkp-ai)"/><path d="M18.6 14.6c.3 2.2 1.2 3.1 3.4 3.4-2.2.3-3.1 1.2-3.4 3.4-.3-2.2-1.2-3.1-3.4-3.4 2.2-.3 3.1-1.2 3.4-3.4z" fill="#ffd75e"/></svg>';
  var IG = '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="nkp-ig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ffb347"/><stop offset=".55" stop-color="#ff3d77"/><stop offset="1" stop-color="#8f5bff"/></linearGradient></defs><rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.4" fill="none" stroke="url(#nkp-ig)" stroke-width="2.2"/><circle cx="12" cy="12" r="3.9" fill="none" stroke="url(#nkp-ig)" stroke-width="2.2"/><circle cx="17.1" cy="6.9" r="1.25" fill="#ff7a59"/></svg>';
  var ICONS = [
    ['📚', 'Книги'], ['📖', 'Читалка'], ['🎧', 'Аудиокурсы'], ['<span class="t">NRK<small>TV</small></span>', 'NRK TV'],
    [YT, 'YouTube'], ['📰', 'Новости'], ['🎬', 'Субтитры'], ['🗣', 'Произношение'],
    ['<span class="t">NRK<small>радио</small></span>', 'NRK Радио'], [TG, 'Telegram'], ['📷', 'Фото → карточки'], ['✨', 'Создать карточки'],
    ['📝', 'Тесты'], ['🕐', 'Klokka'], [AI, 'ИИ-помощники'], [IG, 'Instagram']
  ];
  /* graduation cap (mortarboard) with a gold tassel — own drawing, viewBox 120×94 */
  var HAT = '<svg viewBox="0 0 120 94" aria-hidden="true"><defs>' +
    '<linearGradient id="nkp-hb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3f78"/><stop offset=".55" stop-color="#20244a"/><stop offset="1" stop-color="#13152e"/></linearGradient>' +
    '<linearGradient id="nkp-hs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#262a55"/><stop offset="1" stop-color="#0f1127"/></linearGradient>' +
    '<linearGradient id="nkp-hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a3"/><stop offset="1" stop-color="#d99a1e"/></linearGradient></defs>' +
    '<path d="M30 38 31 64Q60 80 89 64L90 38Q60 52 30 38Z" fill="url(#nkp-hs)"/>' +
    '<path d="M31 62Q60 76 89 62" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="1.5"/>' +
    '<path d="M60 10 117 32 60 54 3 32Z" fill="#0a0c1d"/>' +
    '<path d="M60 6 117 28 60 50 3 28Z" fill="url(#nkp-hb)"/>' +
    '<path d="M3 28 60 6 117 28" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<path d="M60 28Q84 29 103 33" fill="none" stroke="url(#nkp-hg)" stroke-width="2.2" stroke-linecap="round"/>' +
    '<g class="nkp-tsl"><path d="M103 33V59" stroke="url(#nkp-hg)" stroke-width="2.2" stroke-linecap="round"/>' +
    '<circle cx="103" cy="60" r="3.4" fill="url(#nkp-hg)"/><path d="M99.2 62h7.6l2.6 19.5q-6.4 2.4-12.8 0z" fill="url(#nkp-hg)"/>' +
    '<path d="M101 66v15M103 66v16M105 66v15" stroke="rgba(120,70,0,.45)" stroke-width=".8"/></g>' +
    '<ellipse cx="60" cy="28" rx="4.4" ry="2.6" fill="url(#nkp-hg)"/></svg>';

  /* warm the photos right away (the script runs in <head>) */
  var all = CARDS.map(function (c) { return c[0]; }).concat(VIDEO_IMG);
  all.forEach(function (n) { var im = new Image(); im.decoding = 'async'; try { im.fetchPriority = 'high'; } catch (e) { /* old browser */ } im.src = IMG + n + '.webp'; });

  var root, stage, built = false, done = false, T0 = 0, MIN = 0, HARD = 6500, timer = 0, clock = null;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rad(d) { return d * Math.PI / 180; }
  function el(cls, html) { var e = D.createElement('div'); e.className = 'nkp-el ' + cls; if (html) e.innerHTML = html; stage.appendChild(e); return e; }
  function tf(x, y, r, s) { return 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + (r || 0).toFixed(2) + 'deg) scale(' + (s == null ? 1 : s).toFixed(3) + ')'; }
  /* frames: [{t, x, y, r, s, o, e}] in ms → one Web Animation with offsets */
  function play(node, frames, total) {
    var kf = frames.map(function (f) {
      var k = { offset: clamp(f.t / total, 0, 1), transform: tf(f.x, f.y, f.r, f.s), opacity: f.o };
      if (f.e) k.easing = f.e;
      return k;
    });
    for (var i = 1; i < kf.length; i++) if (kf[i].offset < kf[i - 1].offset) kf[i].offset = kf[i - 1].offset;
    kf[0].offset = 0; kf[kf.length - 1].offset = 1;
    return node.animate(kf, { duration: total, fill: 'both' });
  }
  function fade(node, from, to, t, d, total, extra) {
    var a = [{ offset: 0, opacity: from }, { offset: t / total, opacity: from }, { offset: Math.min(1, (t + d) / total), opacity: to }, { offset: 1, opacity: to }];
    if (extra) a.forEach(function (k, i) { k.transform = extra[i < 2 ? 0 : 1]; });
    return node.animate(a, { duration: total, fill: 'both', easing: 'linear' });
  }
  function place(node, x, y, r, s, o) { node.style.transform = tf(x, y, r, s); node.style.opacity = o == null ? 1 : o; }
  var easeOut = function (k) { return 1 - Math.pow(1 - k, 3); };

  /* ---------- geometry for this screen ---------- */
  function geo() {
    var vw = W.innerWidth || D.documentElement.clientWidth || 375;
    var vh = W.innerHeight || D.documentElement.clientHeight || 700;
    var m = Math.min(vw, vh), portrait = vh >= vw;
    var side = !portrait && vw / vh > 1.5 && vh < 560; // phone in landscape: deck left, logo right
    var G = { vw: vw, vh: vh, portrait: portrait, side: side, wide: vw >= 720 && vh >= 560 };
    G.cw = Math.round(side ? clamp(vh * 0.24, 64, 160) : clamp(m * (portrait ? 0.25 : 0.18), 74, 440));
    G.ch = Math.round(G.cw * 4 / 3);
    G.iw = Math.round(side ? clamp(vh * 0.1, 32, 50) : clamp(m * (portrait ? 0.11 : 0.066), 34, 120));
    G.hw = Math.round(G.cw * 1.28); G.hh = G.hw * 0.783;
    G.bf = Math.round(side ? clamp(vh * 0.05, 14, 24) : portrait ? clamp(vw * 0.058, 17, 34) : clamp(vh * 0.032, 18, 72));
    G.R = G.ch * 1.55;
    var half = side ? vw * 0.3 : vw / 2 - 10, sp = 36;
    for (; sp > 12; sp -= 2) { var a = rad(sp); if (G.R * Math.sin(a) + G.cw / 2 * Math.cos(a) + G.ch / 2 * Math.sin(a) <= half) break; }
    G.spread = sp;
    // vertical composition: cap above the deck, the fan's droop and the logo below
    var a2 = rad(sp);
    G.fanDown = G.R * (1 - Math.cos(a2)) + G.ch / 2 * Math.cos(a2) + G.cw / 2 * Math.sin(a2);
    G.brandH = G.bf * 5.4;
    var up = G.ch / 2 + G.hh * 0.62, gap = Math.max(14, G.bf * 0.9);
    if (side) {
      G.dx = vw * 0.31; G.dy = clamp(vh / 2 + up * 0.25, up + 8, vh - G.fanDown - 8);
      G.bx = vw * 0.72; G.by = vh / 2 - G.brandH / 2;
    } else {
      var total = up + G.fanDown + gap + G.brandH;
      G.dx = vw / 2; G.dy = Math.max(up + 8, (vh - total) / 2 + up - (portrait ? vh * 0.02 : 0));
      G.bx = vw / 2; G.by = G.dy + G.fanDown + gap;
    }
    // orbit around the screen centre
    G.cx = vw / 2; G.cy = vh / 2;
    G.rx = portrait ? vw / 2 - G.cw / 2 - 6 : side ? vw * 0.36 : Math.min(vw * 0.31, vw / 2 - G.cw);
    G.ry = Math.min(vh / 2 - G.ch / 2 - 10, vh * (portrait ? 0.36 : 0.33));
    G.irx = portrait ? vw / 2 - G.iw / 2 - 4 : side ? vw * 0.45 : vw * 0.43;
    G.iry = Math.min(vh / 2 - G.iw / 2 - (G.wide ? 26 : 30), vh * 0.42);
    G.far = Math.sqrt(vw * vw + vh * vh) / 2 + G.ch;
    // the «video»
    G.vW = Math.round(portrait ? Math.min(vw * 0.88, 560) : Math.min(vw * (side ? 0.5 : 0.42), vh * 0.56 * 1.66, Math.max(640, vw * 0.3)));
    G.vH = Math.round(G.vW * 0.6);
    G.sf = Math.round(clamp(G.vW * 0.066, 14, 40));
    return G;
  }

  function stars(G) {
    var s = [], n = G.wide ? 46 : 30, seed = 7;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var i = 0; i < n; i++) {
      var a = rnd() < 0.2 ? '255,215,140' : '210,220,255';
      s.push(Math.round(rnd() * G.vw) + 'px ' + Math.round(rnd() * G.vh) + 'px 0 ' + (rnd() < 0.25 ? '1px' : '0') + ' rgba(' + a + ',' + (0.35 + rnd() * 0.5).toFixed(2) + ')');
    }
    var st = root.querySelector('.nkp-stars');
    if (st) st.style.boxShadow = s.join(',');
  }

  function cardHTML(c) {
    var k = Math.min(0.165, 1.3 / c[1].length); // long words (velkommen) get a smaller size
    return '<img src="' + IMG + c[0] + '.webp" alt="" decoding="async" draggable="false"><div class="nkp-cap-txt"><b style="font-size:calc(var(--cw) * ' + k.toFixed(3) + ')">' + c[1] + '</b><i>' + c[2] + '</i></div>';
  }
  /* in the fan the centre card lies on top, its neighbours under it (like a hand of cards) */
  function cardEl(c, i) { var e = el('nkp-card', cardHTML(c)); e.style.zIndex = 10 - Math.abs(i - (CARDS.length - 1) / 2); return e; }
  /* in the fan only the centre card keeps its caption (the others would peek out as cut-off letters) */
  function dimCaption(e, i, t) {
    if (i === (CARDS.length - 1) / 2) return;
    var c = e.querySelector('.nkp-cap-txt');
    if (!c) return;
    if (t < 0) { c.style.opacity = 0; return; }
    c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, delay: t, fill: 'both' });
  }
  function fanPos(G, i) {
    var n = CARDS.length, step = G.spread * 2 / (n - 1), a = -G.spread + i * step, ar = rad(a);
    return { x: G.dx + G.R * Math.sin(ar), y: G.dy + G.R * (1 - Math.cos(ar)), r: a };
  }
  function hatPos(G) {
    var top = G.dy - G.ch / 2;
    return { x: G.dx + G.cw * 0.05, y: top + G.ch * 0.1 - G.hh * 0.255, ringY: top + G.ch * 0.05 };
  }

  /* ---------- build ---------- */
  function build() {
    if (built) return;
    root = D.getElementById('nkp');
    if (!root) return;
    built = true;
    root.classList.add('nkp-js');
    stage = root.querySelector('.nkp-stage');
    if (!stage) { stage = D.createElement('div'); stage.className = 'nkp-stage'; root.appendChild(stage); }
    stage.setAttribute('aria-hidden', 'true');
    var G = geo();
    if (G.wide) root.classList.add('nkp-wide');
    var rs = root.style;
    rs.setProperty('--cw', G.cw + 'px'); rs.setProperty('--ch', G.ch + 'px'); rs.setProperty('--iw', G.iw + 'px');
    rs.setProperty('--hw', G.hw + 'px'); rs.setProperty('--vw', G.vW + 'px'); rs.setProperty('--vh', G.vH + 'px');
    rs.setProperty('--sf', G.sf + 'px'); rs.setProperty('--bf', G.bf + 'px');
    stars(G);
    T0 = performance.now();

    if (reduce) still(G); else clock = full(G);
    MIN = reduce ? 900 : 3250; // the cap settles at 3.26 s
    if (!reduce) {
      var hint = D.createElement('div'); hint.className = 'nkp-skip'; hint.textContent = 'Нажмите, чтобы пропустить';
      root.appendChild(hint);
      setTimeout(function () { if (!done) hint.classList.add('on'); }, 700);
    }
    root.addEventListener('pointerdown', skip);
    W.addEventListener('keydown', skip, true);
    timer = setInterval(check, 100);
  }

  function brand(G) {
    var b = D.createElement('div');
    b.className = 'nkp-brand';
    b.innerHTML = '<div><div class="nkp-flags">🇳🇴<span>⇄</span>🇷🇺</div><div class="nkp-title">Norsk <b>Kort</b></div>' +
      '<div class="nkp-tag">Норвежский — карточка за карточкой</div><div class="nkp-bar"></div></div>';
    stage.appendChild(b);
    return b;
  }

  function hat(G) {
    var h = el('nkp-hat', HAT);
    var ts = h.querySelector('.nkp-tsl');
    if (ts) { ts.style.transformOrigin = '103px 33px'; ts.style.transformBox = 'view-box'; }
    return h;
  }
  function dropHat(G, h, ring, t0, dur, total) {
    var p = hatPos(G), y0 = -G.hh - G.vh * 0.15;
    var anim = play(h, [
      { t: 0, x: p.x, y: y0, r: -28, s: 1.15, o: 0 },
      { t: t0, x: p.x - G.cw * 0.3, y: y0, r: -28, s: 1.15, o: 0, e: 'cubic-bezier(.45,0,.9,.55)' },
      { t: t0 + dur * 0.14, x: p.x - G.cw * 0.24, y: y0 + (p.y - y0) * 0.2, r: -22, s: 1.12, o: 1, e: 'cubic-bezier(.45,0,.9,.55)' },
      { t: t0 + dur * 0.58, x: p.x, y: p.y, r: -5, s: 1, o: 1, e: 'cubic-bezier(.2,.7,.4,1)' },
      { t: t0 + dur * 0.76, x: p.x, y: p.y - G.ch * 0.1, r: -9, s: 1, o: 1, e: 'cubic-bezier(.6,0,.8,.5)' },
      { t: t0 + dur * 0.9, x: p.x, y: p.y, r: -6, s: 1, o: 1, e: 'cubic-bezier(.2,.7,.4,1)' },
      { t: t0 + dur * 0.96, x: p.x, y: p.y - G.ch * 0.025, r: -7.5, s: 1, o: 1 },
      { t: t0 + dur, x: p.x, y: p.y, r: -7, s: 1, o: 1 }
    ], total);
    var ts = h.querySelector('.nkp-tsl'), land = t0 + dur * 0.58;
    if (ts) ts.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(22deg)' }, { transform: 'rotate(-12deg)' }, { transform: 'rotate(6deg)' }, { transform: 'rotate(-2deg)' }, { transform: 'rotate(0deg)' }],
      { duration: 1000, delay: land, easing: 'ease-out', fill: 'both' });
    if (ring) play(ring, [
      { t: 0, x: p.x, y: p.ringY, r: 0, s: 0.3, o: 0 },
      { t: land - 1, x: p.x, y: p.ringY, r: 0, s: 0.3, o: 0 },
      { t: land, x: p.x, y: p.ringY, r: 0, s: 0.3, o: 0.95, e: 'cubic-bezier(.2,.8,.3,1)' },
      { t: land + 520, x: p.x, y: p.ringY, r: 0, s: 1.9, o: 0 }
    ], land + 520);
    return anim;
  }
  function showBrand(G, b, t, d) {
    b.animate([
      { transform: 'translate(' + G.bx + 'px,' + (G.by + G.bf * 0.8) + 'px) scale(.94)', opacity: 0 },
      { transform: 'translate(' + G.bx + 'px,' + G.by + 'px) scale(1)', opacity: 1 }
    ], { duration: d, delay: t, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' });
  }

  /* ---------- first launch: the whole show ---------- */
  function full(G) {
    var n = CARDS.length, TOT = 2950;
    // 1) badges (behind the cards)
    ICONS.forEach(function (ic, k) {
      var e = el('nkp-ico', '<div class="g">' + ic[0] + '</div><div class="lb">' + ic[1] + '</div>');
      var th = k * (360 / ICONS.length) - 84, a0 = th - 160, d0 = 140 + k * 42, dur = 980, fr = [];
      fr.push({ t: 0, x: 0, y: 0, r: 0, s: 0.5, o: 0 });
      for (var j = 0; j <= 7; j++) {
        var s = easeOut(j / 7), a = rad(a0 + 160 * s), f = Math.pow(1 - s, 1.4);
        fr.push({ t: d0 + dur * j / 7, x: G.cx + Math.cos(a) * (G.irx + (G.far - G.irx) * f), y: G.cy + Math.sin(a) * (G.iry + (G.far - G.iry) * f), r: -200 * f, s: 0.55 + 0.45 * s, o: Math.min(1, s * 2.5) });
      }
      fr[0].x = fr[1].x; fr[0].y = fr[1].y; fr[0].r = fr[1].r;
      var g0 = 2000 + k * 14;
      var aD = rad(th + 16);
      fr.push({ t: g0, x: G.cx + Math.cos(aD) * G.irx, y: G.cy + Math.sin(aD) * G.iry, r: 0, s: 1, o: 1, e: 'cubic-bezier(.5,0,.8,.4)' });
      fr.push({ t: g0 + 380, x: G.dx, y: G.dy, r: 120, s: 0.2, o: 0 });
      play(e, fr, TOT);
    });
    // 2) photo cards
    CARDS.forEach(function (c, i) {
      var e = cardEl(c, i);
      var order = (i * 4) % n; // scatter the entry order so neighbours in the fan come from different sides
      var th = order * (360 / n) - 70, a0 = th - 150, d0 = order * 55, dur = 1050, fr = [];
      fr.push({ t: 0, x: 0, y: 0, r: 0, s: 0.5, o: 0 });
      for (var j = 0; j <= 8; j++) {
        var s = easeOut(j / 8), a = rad(a0 + 150 * s), f = Math.pow(1 - s, 1.5);
        fr.push({ t: d0 + dur * j / 8, x: G.cx + Math.cos(a) * (G.rx + (G.far - G.rx) * f), y: G.cy + Math.sin(a) * (G.ry + (G.far - G.ry) * f), r: 10 * Math.cos(a) - 240 * f, s: 0.6 + 0.4 * s, o: Math.min(1, s * 3) });
      }
      fr[0].x = fr[1].x; fr[0].y = fr[1].y; fr[0].r = fr[1].r;
      var tEnd = d0 + dur, G0 = 2080 + i * 22;
      [0.5, 1].forEach(function (q) {
        var a = rad(th + 24 * q);
        fr.push({ t: tEnd + (G0 - tEnd) * q, x: G.cx + Math.cos(a) * G.rx, y: G.cy + Math.sin(a) * G.ry, r: 10 * Math.cos(a), s: 1, o: 1, e: q === 1 ? 'cubic-bezier(.6,0,.3,1)' : null });
      });
      var stack = { t: G0 + 360, x: G.dx + (i - 4) * 1.2, y: G.dy - (i - 4) * 0.8, r: (i - 4) * 1.4, s: 1, o: 1 };
      fr.push(stack);
      var p = fanPos(G, i);
      fr.push({ t: 2500, x: stack.x, y: stack.y, r: stack.r, s: 1, o: 1, e: 'cubic-bezier(.25,1,.35,1.18)' });
      fr.push({ t: 2880, x: p.x, y: p.y, r: p.r, s: 1, o: 1 });
      play(e, fr, TOT);
      dimCaption(e, i, 2420);
      return e;
    });
    // 3) the «video» with karaoke subtitles
    var words = SUB.map(function (w) {
      return '<span class="nkp-w"><span class="no"><span class="pill"></span><span class="t">' + w[0] + '</span><span class="gold">' + w[0] + '</span></span><span class="gl">' + w[1] + '</span></span>';
    }).join('');
    var v = el('nkp-video', '<img src="' + IMG + VIDEO_IMG + '.webp" alt="" draggable="false"><div class="nkp-vchip"><span class="live">NRK TV</span><span>🎬 Субтитры</span></div><div class="nkp-vcc">CC</div>' +
      '<div class="nkp-subs">' + words + '</div><div class="nkp-ru">' + SUB_RU + '</div><div class="nkp-prog"></div>');
    var VT = 2620;
    play(v, [
      { t: 0, x: G.cx, y: G.cy, r: -4, s: 0.72, o: 0 },
      { t: 640, x: G.cx, y: G.cy, r: -4, s: 0.72, o: 0, e: 'cubic-bezier(.2,.9,.3,1.12)' },
      { t: 980, x: G.cx, y: G.cy, r: 0, s: 1, o: 1 },
      { t: 2260, x: G.cx, y: G.cy, r: 0, s: 1, o: 1, e: 'cubic-bezier(.6,0,.4,1)' },
      { t: VT, x: G.dx, y: G.dy, r: 6, s: 0.2, o: 0 }
    ], VT);
    var vimg = v.querySelector('img');
    vimg.animate([{ transform: 'scale(1.16) translateX(2%)' }, { transform: 'scale(1.02) translateX(-1%)' }], { duration: 1900, delay: 640, easing: 'ease-out', fill: 'both' });
    v.querySelector('.nkp-prog').animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 1300, delay: 980, easing: 'linear', fill: 'both' });
    var W0 = 1020, STEP = 235, last = SUB.length - 1;
    [].forEach.call(v.querySelectorAll('.nkp-w'), function (w, j) {
      var t = W0 + j * STEP;
      var pill = w.querySelector('.pill'), gold = w.querySelector('.gold'), gl = w.querySelector('.gl');
      var off = j === last ? 2300 : t + STEP;
      pill.animate([{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 110, delay: t, easing: 'ease-out', fill: 'both' });
      if (j !== last) {
        pill.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, delay: off, fill: 'forwards' });
        gold.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, delay: off, fill: 'both' });
      }
      gl.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 240, delay: t + 50, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' });
    });
    v.querySelector('.nkp-ru').animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 260, delay: W0 + SUB.length * STEP - 60, easing: 'ease-out', fill: 'both' });
    // 4) finale: cap, ring, logo
    var ring = el('nkp-ring'), h = hat(G), b = brand(G);
    var hatAnim = dropHat(G, h, ring, 2700, 560, 3260);
    showBrand(G, b, 2620, 520);
    return hatAnim; // the longest animation = the sequence clock
  }

  /* ---------- reduced motion: calm, still composition ---------- */
  function still(G) {
    ICONS.forEach(function (ic, k) {
      var e = el('nkp-ico', '<div class="g">' + ic[0] + '</div>');
      var a = rad(k * (360 / ICONS.length) - 84);
      place(e, G.cx + Math.cos(a) * G.irx, G.cy + Math.sin(a) * G.iry, 0, 0.9, 0.35);
    });
    CARDS.forEach(function (c, i) { var e = cardEl(c, i), p = fanPos(G, i); place(e, p.x, p.y, p.r, 1, 1); dimCaption(e, i, -1); });
    var h = hat(G), p = hatPos(G), b = brand(G);
    place(h, p.x, p.y, -7, 1, 1);
    b.style.transform = 'translate(' + G.bx + 'px,' + G.by + 'px)'; b.style.opacity = 1;
  }

  /* ---------- leave ---------- */
  function appReady() {
    var v = D.getElementById('view');
    return D.readyState === 'complete' && !!v && v.childElementCount > 0;
  }
  /* how far the sequence has got, on the animations' own timeline (pending before the first frame → 0) */
  function seqTime() {
    if (!clock) return performance.now() - T0;
    if (clock.playState === 'finished') return Infinity;
    return clock.currentTime || 0;
  }
  function check() {
    if (done || !built) return;
    if (performance.now() - T0 >= HARD || (seqTime() >= MIN && appReady())) hide(false);
  }
  function skip() { if (built && !done) hide(true); }
  function hide(fast) {
    if (done) return;
    done = true;
    clearInterval(timer);
    root.removeEventListener('pointerdown', skip);
    W.removeEventListener('keydown', skip, true);
    var d = fast ? 240 : reduce ? 320 : 460;
    var gone = function () { if (root && root.parentNode) root.parentNode.removeChild(root); root = stage = null; };
    if (canAnim) {
      root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: d, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      if (!reduce) stage.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.07)' }], { duration: d, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    } else { root.style.transition = 'opacity ' + d + 'ms'; root.style.opacity = '0'; }
    setTimeout(gone, d + 40);
  }

  /* ---------- start as soon as <div id="nkp"> exists ---------- */
  W.NKPreloader = { skip: skip, seqTime: function () { return built ? seqTime() : 0; }, hide: function () { hide(true); }, get active() { return built && !done; } };
  var ready = function () { return !!D.querySelector('#nkp .nkp-stage'); }; // the stage is the markup's last child
  if (ready()) { build(); return; }
  var mo = null;
  try {
    mo = new MutationObserver(function () { if (ready()) { mo.disconnect(); build(); } });
    mo.observe(D.documentElement, { childList: true, subtree: true });
  } catch (e) { /* ignore */ }
  D.addEventListener('DOMContentLoaded', function () { if (mo) mo.disconnect(); build(); });
})();
