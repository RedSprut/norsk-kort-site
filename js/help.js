/* ============ ❓ «Как пользоваться» — the help centre + «▶ Показать по шагам на экране» spotlight tours ============
 *  - Help.open(topic?)   the window with every topic (searchable); a topic opens its short explanation:
 *                        steps with icons (a step with a place on screen is clickable → the tour from that step),
 *                        what you get, honest limits, «▶ Показать по шагам на экране», «Открыть…»
 *  - Help.tour(id, {start}) darkens everything except one element, the pointing hand and a bubble «Дальше / Назад / Понятно».
 *                        A step can open a screen first, waits for its element, and is skipped quietly when it is missing.
 *  - Help.hand(el, opts) our own soft 3D pointing hand (never a pointing-finger emoji): glides to the element, presses, a ripple
 *                        from the fingertip, a beacon ring on the element; optional arrow and label. Tours and hints use it.
 *  - Help.welcome()      «Добро пожаловать в Norsk Kort!» on the first start: every topic as cards, a topic opens inside;
 *                        on closing the window flies into the «?» (phones: ⋯) and the hand shows where it lives now.
 *  - anywhere: <button data-help="listen"> opens that topic; data-help="" — the whole help centre (one capture listener).
 *  - small «?» buttons are added to the sections by themselves (a watcher on the page) — no edits in those modules.
 *  - a soft reminder: a dot on the top-bar «?» until the help centre has been opened once (+ one bubble, not on day one).
 */
(function () {
  const KEY = 'nk-help';
  const state = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const patch = o => { const s = Object.assign(state(), o); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode */ } return s; };
  const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => U.esc(s);
  const modalOpen = () => !!document.querySelector('#modal-root > .modal-backdrop:not(.closing)');
  const topModal = () => [...document.querySelectorAll('#modal-root > .modal-backdrop:not(.closing)')].pop() || null;
  const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[«»"“”„.,!?:;()]/g, ' ').replace(/\s+/g, ' ').trim();
  const TG = s => (window.Telegram && Telegram.TG_SVG ? Telegram.TG_SVG(s) : '✈️');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------------- 🖐 our own pointing hand: the BACK of a RIGHT hand (nail on the index finger, knuckles, the thumb tucked on the left),
     the index finger relaxed and a little bent — never a palm, never a mirrored left hand: it only ever ROTATES ---------------- */
  // gradients live once in the page (an invisible <svg>), every hand refers to them (the skin gradient is in the hand's own 64×84 units)
  const HAND_DEFS = `<svg class="nk-hand-defs" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden;pointer-events:none"><defs>
      <linearGradient id="nkkS" gradientUnits="userSpaceOnUse" x1="14" y1="6" x2="58" y2="74"><stop offset="0" stop-color="#ffe895"/><stop offset=".5" stop-color="#ffd04f"/><stop offset="1" stop-color="#f0a234"/></linearGradient>
      <linearGradient id="nkkE" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d27a14" stop-opacity="0"/><stop offset="1" stop-color="#d27a14" stop-opacity=".32"/></linearGradient>
      <linearGradient id="nkkN" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff8e4"/><stop offset="1" stop-color="#ffdca6"/></linearGradient>
      <linearGradient id="nkkC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd6ff"/><stop offset="1" stop-color="#5a9ff0"/></linearGradient>
      <radialGradient id="nkkH" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <radialGradient id="nkkD" cx=".9" cy=".8" r=".8"><stop offset="0" stop-color="#c46a10" stop-opacity=".38"/><stop offset="1" stop-color="#c46a10" stop-opacity="0"/></radialGradient>
    </defs></svg>`;
  const FIST = 'M29.6 42C30.2 38.8 32.8 37.2 35.8 37.2C38.8 37.2 41.2 38.6 41.9 40.8C43 38.9 45 38.1 47.2 38.4C49.8 38.8 51.4 40.6 51.6 43C53.2 42.2 55.6 42.4 56.9 44C58.4 45.8 58.9 49 58.6 52.4C58.3 60 55.5 66.5 50.5 70C47 72.4 43 73.2 38.5 73.2H31C24 73.2 18.6 69.6 16.2 63.6C14.4 59.2 14.6 52.4 16.8 47.6Z';
  // the index finger: nearly straight up to the middle knuckle, then the top joints lean gently forward (a relaxed, natural bend)
  const FINGER = 'C16.9 43 17.2 36.4 17.8 30.2C18.3 25.6 19.6 18.8 21.5 12.6C22.7 7.6 24.9 3.9 28.2 3.8C31.4 3.8 33.5 6.6 33 10.6C32.6 14.6 31.6 19.6 31 23.6';
  const HAND_SHAPES = `<g stroke="#bf7618" stroke-width="1.15" stroke-linejoin="round" stroke-linecap="round">
      <path d="M17.4 67.5C12.8 65 10.4 59.4 11.1 54C11.7 49.3 14.6 46.2 18 46.4C21.1 46.6 22.8 49.2 22.5 52.4L21.8 63.5Z" fill="url(#nkkS)"/>
      <path d="M11.9 51.6C12.6 48.8 14.6 47.3 16.6 47.4C16.6 49.6 15 51.9 12.4 53.3Z" fill="url(#nkkN)" stroke="#d49238" stroke-width=".8"/>
      <path d="${FIST}" fill="url(#nkkS)"/></g>
    <path d="${FIST}" fill="url(#nkkD)"/>
    <g fill="none" stroke-linecap="round"><path d="M41.9 40.8c.3 2 .1 3.6-.5 5M51.6 43c.2 1.7 0 3.1-.6 4.3" stroke="#c98424" stroke-width=".95" opacity=".75"/>
      <path d="M34 66C34.6 59 35.2 53 36 47.5M41.6 66C42.8 59.5 44.2 54 46.2 48.5M47.6 64.5C49.4 59.5 51.2 55.5 53.6 51" stroke="#fff" stroke-width="1.4" opacity=".2"/>
      <path d="M34.3 42q1.5.7 3 0M45.7 42.6q1.2.6 2.4 0M53.9 47q.9.5 1.8 0" stroke="#c98424" stroke-width=".8" opacity=".55"/></g>
    <ellipse cx="35.6" cy="39.4" rx="3.6" ry="1.6" fill="url(#nkkH)"/><ellipse cx="46.8" cy="40.5" rx="2.9" ry="1.4" fill="url(#nkkH)"/><ellipse cx="54.8" cy="45.2" rx="2" ry="1.2" fill="url(#nkkH)"/>
    <path d="M16.8 50${FINGER}C30.5 28.5 29.9 38 30 50Z" fill="url(#nkkS)"/>
    <path d="M31 23.6C30.5 28.5 29.9 38 30 47L26.6 46C26.8 38 27.2 31 27.9 25.2C28.9 19 30.5 13.4 31 9.8C32.5 10.8 33.1 11.8 33.1 12.8C32.8 16.4 31.8 20.4 31 23.6Z" fill="url(#nkkE)"/>
    <path d="M16.8 47.6${FINGER}C30.5 28.5 29.9 37 29.8 45.4" fill="none" stroke="#bf7618" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>
    <g transform="translate(.6 .1) rotate(13 27 10.5)"><path d="M22.9 12.4C22.7 8.5 24.4 6 27.1 6C29.8 6 31.4 8.4 31.2 12.4C31.1 13.9 29.7 14.7 27.1 14.7C24.5 14.7 23 13.9 22.9 12.4Z" fill="url(#nkkN)" stroke="#d49238" stroke-width=".9"/>
      <path d="M24.8 9c.5-1.1 1.2-1.6 2.2-1.7" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".95"/></g>
    <g fill="none" stroke="#c98424" stroke-width=".9" stroke-linecap="round" opacity=".7"><path d="M22.9 18.9q3.2 1.5 6.4.6M23.5 20.8q2.5 1 4.9.4" transform="rotate(11 26 20)"/><path d="M20.2 30.6q4.4 1.7 8.7 .4M20.9 32.8q3.7 1.3 7.1.3" transform="rotate(3 24.5 31.8)"/></g>
    <ellipse cx="19.4" cy="38.5" rx="1.2" ry="6.6" transform="rotate(3 19.4 38.5)" fill="url(#nkkH)" opacity=".7"/><ellipse cx="22" cy="20.4" rx="1.2" ry="6.4" transform="rotate(16 22 20.4)" fill="url(#nkkH)" opacity=".75"/>
    <rect x="20.5" y="70.4" width="31" height="11.6" rx="4.4" fill="url(#nkkC)" stroke="#3f86d6" stroke-width="1"/><path d="M23.5 73.8h25" stroke="#fff" stroke-opacity=".6" stroke-width="1.4" stroke-linecap="round"/>`;
  const handDefs = () => { if (!document.querySelector('.nk-hand-defs') && document.body) document.body.insertAdjacentHTML('afterbegin', HAND_DEFS); };
  /** the whole hand as an <svg> (cls — extra classes); the fingertip is at TIP_X, TIP_Y of its box */
  const HAND_SVG = (cls = '', w = '', h = '') => { handDefs(); return `<svg class="${cls}" ${w ? `width="${w}" height="${h}"` : ''} viewBox="0 0 64 84" aria-hidden="true" focusable="false">${HAND_SHAPES}</svg>`; };
  /** a small hand for buttons and step icons */
  const HAND_I = (s = 20) => HAND_SVG('ico nk-hand-ico', Math.round(s * 64 / 84), s);
  const HAND_W = 54, HAND_H = 71, TIP_X = 28.2 / 64, TIP_Y = 3.8 / 84; // the drawn size; the fingertip inside it
  const BASE_ROT = { up: 0, down: 180, left: -90, right: 90 };
  /** the corners of the hand box turned by `deg` around the fingertip at (x, y) */
  const handBox = (x, y, deg, k) => {
    const w = HAND_W * k, h = HAND_H * k, tx = TIP_X * w, ty = TIP_Y * h, a = deg * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
    const pts = [[0, 0], [w, 0], [0, h], [w, h]].map(([px, py]) => [x + (px - tx) * c - (py - ty) * sn, y + (px - tx) * sn + (py - ty) * c]);
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
  };
  /** the part of an element really visible: inside the screen and inside every scrolling box around it */
  const visibleRect = el => {
    const r = el.getBoundingClientRect();
    let l = r.left, t = r.top, rt = r.right, b = r.bottom;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (!/(auto|scroll|hidden|clip)/.test(cs.overflowY + cs.overflowX)) continue;
      const q = p.getBoundingClientRect();
      l = Math.max(l, q.left); t = Math.max(t, q.top); rt = Math.min(rt, q.right); b = Math.min(b, q.bottom);
    }
    const vw = document.documentElement.clientWidth || innerWidth;
    l = Math.max(l, 0); t = Math.max(t, 0); rt = Math.min(rt, vw); b = Math.min(b, innerHeight);
    return { left: l, top: t, right: rt, bottom: b, width: Math.max(0, rt - l), height: Math.max(0, b - t), full: r };
  };
  /**
   * The pointing hand. el — what to point at; o: { dir: 'auto'|'up'|'down'|'left'|'right' (where the finger points),
   * arrow: 'tap' (→ toward the element) | 'up' | 'down' (scroll), label, beacon (a pulsing ring on the element, default on),
   * timeout (ms, then it goes), dismiss (any tap / key removes it), size (1 = 54×71), host, cls, manual (the tour moves it) }.
   * → { node, move(el, o), point(x, y, dir), box(), remove() }
   */
  function makeHand(el, o = {}) {
    handDefs();
    const still = reduce();
    const k = o.size || 1;
    const node = document.createElement('div');
    node.className = `nk-hand ${o.cls || ''} ${still ? 'still' : ''}`;
    node.setAttribute('aria-hidden', 'true');
    node.style.setProperty('--hw', HAND_W * k + 'px'); node.style.setProperty('--hh', HAND_H * k + 'px');
    node.style.setProperty('--tx', TIP_X * HAND_W * k + 'px'); node.style.setProperty('--ty', TIP_Y * HAND_H * k + 'px');
    node.innerHTML = `<div class="nk-hand-rot"><span class="nk-hand-ripple"></span><div class="nk-hand-press">${HAND_SVG('nk-hand-svg')}</div>
        <span class="nk-hand-arrow tap" hidden><svg viewBox="0 0 16 16" width="14" height="14"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>`;
    // the label and the scroll arrow stand upright beside the hand (the hand itself turns), so they are its neighbours
    const lab = document.createElement('span'); lab.className = `nk-hand-label ${o.cls ? o.cls + '-label' : ''} ${still ? 'still' : ''}`; lab.hidden = true; lab.setAttribute('aria-hidden', 'true');
    const aScroll = document.createElement('span'); aScroll.className = `nk-hand-arrow scroll ${still ? 'still' : ''}`; aScroll.hidden = true; aScroll.setAttribute('aria-hidden', 'true');
    aScroll.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const host = o.host || document.body;
    host.appendChild(node); host.appendChild(lab); host.appendChild(aScroll);
    let beacon = null;
    const H = { node, el: null, o: {}, alive: true, last: '', placed: false, gone: 0 };
    const aTap = node.querySelector('.nk-hand-arrow.tap');
    node.style.transformOrigin = `${TIP_X * HAND_W * k}px ${TIP_Y * HAND_H * k}px`; // it turns around the fingertip
    const vis = v => { node.style.opacity = v; lab.style.opacity = v; aScroll.style.opacity = v; };
    /** the fingertip at (x, y), the finger pointing `dir` */
    H.point = (x, y, dir = 'up', show = true) => {
      const vw = document.documentElement.clientWidth || innerWidth, vh = innerHeight;
      const base = BASE_ROT[dir] != null ? BASE_ROT[dir] : 0;
      // a little tilt, to the side where the whole hand stays on the screen
      const fits = d => { const b = handBox(x, y, d, k); return b.left >= 2 && b.right <= vw - 2 && b.top >= 2 && b.bottom <= vh - 2; };
      let deg = base - 12;
      if (!fits(deg) && fits(base + 12)) deg = base + 12;
      else if (!fits(deg) && fits(base)) deg = base;
      const tx = TIP_X * HAND_W * k, ty = TIP_Y * HAND_H * k;
      const tf = (px, py, d) => `translate(${Math.round(px - tx)}px, ${Math.round(py - ty)}px) rotate(${Math.round(d * 10) / 10}deg)`;
      // where the fingertip is right now (also in the middle of a glide)
      let from = H.placed ? { x: H.x, y: H.y, d: H.deg } : null;
      if (H.anim && H.anim.playState === 'running') {
        const mt = getComputedStyle(node).transform, mm = /matrix\(([^)]+)\)/.exec(mt || '');
        if (mm) { const v = mm[1].split(',').map(parseFloat); from = { x: v[4] + tx, y: v[5] + ty, d: Math.atan2(v[1], v[0]) * 180 / Math.PI }; }
      }
      H.deg = deg; H.x = x; H.y = y; H.dir = dir;
      const glide = !H.placed && !still && !o.manual;
      if (!H.placed && !still && o.flyIn && node.animate) { // the first time: flies in from the corner of the screen along a soft curve
        from = { x: vw + 30, y: vh + 60, d: deg + 25 };
      }
      if (glide) { // start a little further away and glide in
        const a = deg * Math.PI / 180, dist = 46;
        node.style.transition = 'none';
        node.style.transform = `translate(${Math.round(x - tx - Math.sin(a) * dist)}px, ${Math.round(y - ty + Math.cos(a) * dist)}px) rotate(${deg}deg)`;
        node.style.opacity = '0';
        void node.offsetWidth;
        node.style.transition = '';
      }
      H.placed = true;
      const far = from && Math.hypot(x - from.x, y - from.y);
      if (!glide && !still && from && node.animate && (far > 60 || (H.anim && H.anim.playState === 'running' && far > 2))) {
        // a long way: along a soft arc (a quadratic curve that bends upward), the hand turning on the way
        if (H.anim) H.anim.cancel();
        const mx = (from.x + x) / 2, my = (from.y + y) / 2, len = far || 1;
        let nx = -(y - from.y) / len, ny = (x - from.x) / len;
        if (ny > 0) { nx = -nx; ny = -ny; }
        const bend = Math.min(90, len * 0.22), cx0 = mx + nx * bend, cy0 = my + ny * bend;
        let dd = deg - from.d; dd = ((dd + 540) % 360) - 180;
        const frames = [];
        for (let i = 0; i <= 12; i++) {
          const t = i / 12, u = 1 - t;
          frames.push({ transform: tf(u * u * from.x + 2 * u * t * cx0 + t * t * x, u * u * from.y + 2 * u * t * cy0 + t * t * y, from.d + dd * t) });
        }
        node.style.transition = 'none';
        node.style.transform = tf(x, y, deg);
        H.anim = node.animate(frames, { duration: clamp(380 + len * 0.8, 420, 950), easing: 'cubic-bezier(.45, .05, .2, 1)' });
        const a0 = H.anim;
        a0.onfinish = () => { if (H.anim === a0) { H.anim = null; node.style.transition = ''; } };
      } else node.style.transform = tf(x, y, deg);
      vis(show ? '' : '0');
      node.dataset.dir = dir;
      // the label beside the hand
      if (H.o.label) {
        const b = handBox(x, y, deg, k), lw = lab.offsetWidth, lh = lab.offsetHeight;
        let lx = b.right + 8, ly = (dir === 'down' ? b.top : b.bottom) - lh - (dir === 'down' ? -6 : 6);
        if (lx + lw > vw - 8) lx = b.left - 8 - lw;
        if (lx < 8) { lx = clamp(x - lw / 2, 8, vw - 8 - lw); ly = dir === 'down' ? b.top - lh - 6 : b.bottom + 6; }
        ly = clamp(ly, 8, vh - lh - 8);
        lab.style.transform = `translate(${Math.round(lx)}px, ${Math.round(ly)}px)`;
      }
      if (H.o.arrow === 'up' || H.o.arrow === 'down') {
        const b = handBox(x, y, deg, k);
        const ax = b.right + 6 + 18 > vw - 4 ? b.left - 24 : b.right + 6;
        aScroll.style.transform = `translate(${Math.round(ax)}px, ${Math.round((b.top + b.bottom) / 2 - 9)}px)`;
      }
    };
    H.box = () => (H.placed ? handBox(H.x, H.y, H.deg, k) : null);
    /** follow the element: the fingertip on it, the hand where there is room */
    H.place = force => {
      if (!H.alive || !H.el) return;
      const el2 = H.el;
      if (!el2.isConnected) { if (!H.gone) H.gone = Date.now(); vis('0'); if (beacon) beacon.style.opacity = '0'; if (Date.now() - H.gone > 1500) H.remove(); return; }
      H.gone = 0;
      const v = visibleRect(el2), r = v.full;
      const key = [v.left, v.top, v.width, v.height, innerWidth, innerHeight].map(Math.round).join(',');
      if (!force && key === H.last) return;
      H.last = key;
      const ok = v.width * v.height >= Math.min(r.width * r.height * 0.4, 400) && v.width > 4 && v.height > 4;
      if (beacon) {
        const rad = Math.min(22, (parseFloat(getComputedStyle(el2).borderTopLeftRadius) || 10) + 4);
        Object.assign(beacon.style, { left: r.left - 4 + 'px', top: r.top - 4 + 'px', width: r.width + 8 + 'px', height: r.height + 8 + 'px', borderRadius: rad + 'px', opacity: ok ? '' : '0' });
        beacon.style.clipPath = `inset(${Math.max(0, v.top - r.top - 30)}px ${Math.max(0, r.right - v.right - 30)}px ${Math.max(0, r.bottom - v.bottom - 30)}px ${Math.max(0, v.left - r.left - 30)}px)`;
      }
      if (!ok) { vis('0'); return; }
      const vw = document.documentElement.clientWidth || innerWidth, vh = innerHeight, hh = HAND_H * k;
      let dir = H.o.dir && H.o.dir !== 'auto' ? H.o.dir : null;
      if (!dir) dir = vh - v.bottom >= hh - 8 ? 'up' : v.top >= hh - 8 ? 'down' : vw - v.right >= hh ? 'left' : v.left >= hh ? 'right' : 'up';
      const cx = clamp((v.left + v.right) / 2, 14, vw - 14), cy = (v.top + v.bottom) / 2;
      const ix = Math.min(12, v.width * 0.3), iy = Math.min(12, v.height * 0.35);
      const at = { up: [cx, v.bottom - iy], down: [cx, v.top + iy], left: [v.right - ix, cy], right: [v.left + ix, cy] }[dir];
      H.point(at[0], at[1], dir);
    };
    let raf = 0;
    const loop = () => { if (!H.alive) return; H.place(); raf = requestAnimationFrame(loop); };
    H.move = (el2, o2 = {}) => {
      H.el = el2; H.o = Object.assign({ beacon: true }, o, o2); H.last = '';
      lab.hidden = !H.o.label; lab.textContent = H.o.label || '';
      aTap.hidden = H.o.arrow !== 'tap';
      aScroll.hidden = !(H.o.arrow === 'up' || H.o.arrow === 'down');
      aScroll.classList.toggle('down', H.o.arrow === 'down');
      if (H.o.beacon && !o.manual && !beacon) {
        beacon = document.createElement('div'); beacon.className = `nk-beacon ${still ? 'still' : ''} ${o.cls ? o.cls + '-beacon' : ''}`; beacon.setAttribute('aria-hidden', 'true');
        host.appendChild(beacon);
      }
      if (!H.o.beacon && beacon) { beacon.remove(); beacon = null; }
      if (!o.manual && !raf) raf = requestAnimationFrame(loop);
      H.place(true);
      return H;
    };
    const onAny = e => { if (e.type === 'keydown' && /^(Shift|Control|Alt|Meta|Tab)$/.test(e.key)) return; H.remove(); };
    H.remove = () => {
      if (!H.alive) return;
      H.alive = false; cancelAnimationFrame(raf); clearTimeout(H.tmr);
      window.removeEventListener('pointerdown', onAny, true); window.removeEventListener('keydown', onAny, true);
      [node, lab, aScroll].forEach(n => n.classList.add('out')); if (beacon) beacon.classList.add('out');
      const b = beacon;
      setTimeout(() => { node.remove(); lab.remove(); aScroll.remove(); if (b) b.remove(); }, still ? 0 : 260);
      if (o.onRemove) o.onRemove();
    };
    if (o.timeout) H.tmr = setTimeout(() => H.remove(), o.timeout);
    if (o.dismiss) setTimeout(() => { if (H.alive) { window.addEventListener('pointerdown', onAny, true); window.addEventListener('keydown', onAny, true); } }, 350);
    if (el) H.move(el, o); else { H.o = Object.assign({}, o); aTap.hidden = o.arrow !== 'tap'; }
    return H;
  }

  /* ---------------- helpers for tour steps ---------------- */
  const shown = el => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05;
  };
  /** first visible element: a selector, a list of selectors, or a function returning an element */
  const find = sel => {
    for (const s of [].concat(sel || [])) {
      const els = typeof s === 'function' ? [].concat(s() || []) : [...document.querySelectorAll(s)];
      const el = els.find(shown);
      if (el) return el;
    }
    return null;
  };
  const waitFor = (sel, ms = 3500) => new Promise(res => {
    const t0 = Date.now();
    const tick = () => { const el = find(sel); if (el) res(el); else if (Date.now() - t0 > ms || !T) res(null); else setTimeout(tick, 120); };
    tick();
  });
  /** close every window (top first; a window with unsaved changes may ask — then the tour stops) */
  async function closeAll() {
    for (const bd of [...document.querySelectorAll('#modal-root > .modal-backdrop:not(.closing)')].reverse()) {
      if (bd._m) { if (!(await bd._m.tryClose())) return false; } else bd.remove();
    }
    document.querySelectorAll('.dropdown-menu').forEach(m => m.remove());
    await sleep(230);
    return true;
  }
  async function toView(name) {
    if (!(await closeAll())) return false;
    if (App.view.name !== name) { App.go(name); await sleep(350); }
    return true;
  }
  const home = () => toView('home');
  /** a window of this kind on top, else open it */
  async function ensure(sel, open) {
    const t = topModal();
    if (t && t.querySelector(sel)) return true;
    if (document.querySelector(`#modal-root ${sel}`)) { /* under another window: close the ones above it */
      for (const bd of [...document.querySelectorAll('#modal-root > .modal-backdrop:not(.closing)')].reverse()) {
        if (bd.querySelector(sel)) break;
        if (bd._m) { if (!(await bd._m.tryClose())) return false; } else bd.remove();
      }
      await sleep(230); return true;
    }
    try { await open(); } catch (e) { console.warn('help: open', e); }
    await sleep(320);
    return true;
  }
  /** the study screen with a card on it */
  async function studyScreen() {
    if (App.view.name === 'study' && document.querySelector('.study .flashcard')) { await closeAll(); return true; }
    if (!(await closeAll())) return false;
    try { Study.start({ deckId: null }); } catch (e) { console.warn('help: study', e); }
    await sleep(450);
    return true;
  }
  /** a card turned to its answer (the ✎ and «Редактировать» live there) */
  async function flipped() {
    await studyScreen();
    const c = document.querySelector('.study .flashcard');
    if (c && !c.classList.contains('flipped') && window.Study && Study.flip) { try { Study.flip(true); } catch (e) { /* ignore */ } await sleep(350); }
  }

  /* ---------------- a small example for the subtitle player (no network needed) ---------------- */
  const SRT_NO = '1\n00:00:00,000 --> 00:00:00,900\nHei! Hvordan har du det?\n\n2\n00:00:00,900 --> 00:00:01,700\nJeg har det bra, takk.\n\n3\n00:00:01,700 --> 00:00:02,600\nSkal vi ta en kaffe sammen?\n';
  const SRT_RU = '1\n00:00:00,000 --> 00:00:00,900\nПривет! Как дела?\n\n2\n00:00:00,900 --> 00:00:01,700\nУ меня всё хорошо, спасибо.\n\n3\n00:00:01,700 --> 00:00:02,600\nВыпьем вместе кофе?\n';
  /** a 2-second picture of a fjord, recorded from a canvas (when the browser can) — else a short silent sound */
  async function demoMedia() {
    try {
      const c = document.createElement('canvas'); c.width = 320; c.height = 180;
      const types = ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
      const type = window.MediaRecorder && c.captureStream && types.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
      if (type) {
        const g = c.getContext('2d');
        const rec = new MediaRecorder(c.captureStream(12), { mimeType: type });
        const chunks = [];
        rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
        const done = new Promise(r => { rec.onstop = r; });
        const t0 = performance.now();
        let alive = true;
        const draw = () => {
          const t = (performance.now() - t0) / 1000;
          const sky = g.createLinearGradient(0, 0, 0, 180); sky.addColorStop(0, '#6c63ff'); sky.addColorStop(1, '#29c7ff');
          g.fillStyle = sky; g.fillRect(0, 0, 320, 180);
          g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(250, 40 + Math.sin(t * 2) * 4, 16, 0, 7); g.fill();
          g.fillStyle = '#2b2f63'; g.beginPath(); g.moveTo(0, 130); g.lineTo(70, 60); g.lineTo(130, 120); g.lineTo(190, 70); g.lineTo(320, 135); g.lineTo(320, 180); g.lineTo(0, 180); g.fill();
          g.fillStyle = '#1b6fa8'; g.fillRect(0, 138, 320, 42);
          g.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 6; i++) g.fillRect(((i * 60 + t * 40) % 360) - 30, 150 + (i % 2) * 12, 26, 2);
          g.fillStyle = '#fff'; g.font = 'bold 18px system-ui, sans-serif'; g.fillText('Eksempel', 14, 28);
          if (alive) requestAnimationFrame(draw);
        };
        draw();
        rec.start(250);
        await sleep(2600);
        alive = false; rec.stop(); await done;
        const blob = new Blob(chunks, { type: type.split(';')[0] });
        if (blob.size > 800) return new File([blob], 'eksempel.' + (type.includes('mp4') ? 'mp4' : 'webm'), { type: blob.type });
      }
    } catch (e) { /* fall back to a sound */ }
    // 2.6 s of silence as a WAV file — the player still shows the lines, the words and the translation modes
    const rate = 8000, n = Math.round(rate * 2.6), buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    const w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
    new Uint8Array(buf, 44).fill(128);
    return new File([buf], 'eksempel.wav', { type: 'audio/wav' });
  }
  /** the subtitle player open (the one already on screen, or a small example) */
  async function subsPlayer() {
    if (document.querySelector('#modal-root .subs-modal .subs-wrap')) return ensure('.subs-modal', () => {});
    if (!(await closeAll())) return false;
    bubbleBusy('Готовлю пример с субтитрами…');
    const media = await demoMedia();
    if (!T) return false;
    try {
      Subs.open([media, new File([SRT_NO], 'eksempel.no.srt', { type: 'text/plain' }), new File([SRT_RU], 'eksempel.ru.srt', { type: 'text/plain' })]);
    } catch (e) { console.warn('help: subs demo', e); }
    await waitFor('.subs-modal .subs-wrap', 4000);
    await sleep(300);
    return true;
  }

  /* ---------------- the tours ---------------- */
  const SUBS_STEPS = [
    { go: subsPlayer, target: ['.subs-modal .subs-list .sw', '.subs-modal .subs-now .sw', '.subs-modal .subs-list'], title: `${HAND_I(18)} Нажмите на слово`, text: 'Видео встанет на паузу, появится перевод слова и кнопка «В карточку». Выделите несколько слов — переведётся всё выделенное.' },
    { target: '.subs-modal [data-trm]', title: '🙈 Перевод: виден, размыт или скрыт', text: '«Виден» — читайте спокойно. «Слово (перевод)» — перевод у каждого слова. «Размыт» и «скрыт» — проверьте себя: поняли без подсказки?' },
    { target: '.subs-modal .subs-view [data-k="ovwin"]', title: '💬 Субтитры на видео', text: 'Строка с переводом — прямо на картинке, как в YouTube. Нажмите ещё раз — уберёте.' },
    { target: ['.subs-modal .subs-view .sv-btn', '.subs-modal .sv-btn'], title: 'Aa Вид субтитров', text: 'Крупнее или мельче, другие цвета, размер перевода слов. Настройки работают и на экране, и на телевизоре.' },
    { target: ['.subs-modal .subs-view .tv-btn', '.subs-modal .tv-btn'], title: '📺 На телевизор', text: 'Видео — на большом экране, субтитры с переводом — тоже. Телевизор и компьютер должны быть в одной сети Wi‑Fi.' },
    { target: '.subs-modal .sl-add', title: '➕ Строка — в карточку', text: 'Целая фраза станет карточкой — с настоящим звуком из видео.' },
  ];
  const TOURS = {
    listen: { from: () => (document.querySelector('#modal-root .np-modal') ? 3 : document.querySelector('#modal-root .lc-modal') ? 1 : 0), steps: [
      { go: home, target: '#listen-btn', title: '🎧 Кнопка «Слушать»', text: 'Она всегда вверху экрана. Нажмите её — и выберите, что слушать.' },
      { go: () => ensure('.lc-modal', () => ListenUI.chooser()), target: ['.lc-modal .lc-decks', '.lc-modal .modal-body'], title: '🗂 Что послушать', text: 'Колоды, книги, новости, радио и подкасты NRK. Одно нажатие — и звук пошёл.' },
      { go: () => ensure('.lc-modal', () => ListenUI.chooser()), target: '.lc-modal .lc-deck:not(:disabled)', title: '▶ Нажмите на колоду', text: 'Она сразу зазвучит, и откроется плеер «Сейчас играет». Нажмите «Дальше» — включу для примера.', act: el => el.click(), wait: 700 },
      { go: () => (window.Listen && Listen.p ? ensure('.np-modal', () => ListenUI.nowPlaying()) : null), target: '.np-modal [data-np="toggle"]', title: '⏯ Пауза и продолжить', text: 'Большая кнопка в центре. Стрелки рядом — к предыдущей и следующей карточке.' },
      { target: '.np-modal [data-np-speed]', title: '🐢 Скорость', text: 'Медленно, обычно или быстро — меняется сразу, с того же места.' },
      { target: '.np-modal [data-np-dir]', title: '🔀 Что звучит', text: 'Норвежское → русское, наоборот, или «🧠 Вспомни сам»: сначала перевод, вы говорите по-норвежски, потом ответ.' },
      { target: '.np-modal [data-lx="where"]', title: '🔈 Где слушать', text: 'В наушниках или вслух через динамик — выберите, как удобно.' },
      { target: '.np-modal [data-np="dark"]', title: '🌑 Тёмный экран', text: 'Чёрный экран, который не реагирует на случайные касания, — телефон можно положить в карман. Звук продолжится.' },
    ] },
    study: { steps: [
      { go: home, target: ['.tabbar .tab-study', '#view .qa-main[data-act="study-all"]', '#view [data-act="study-all"]'], title: '▶ Начать', text: el => (el.closest('.tabbar') ? 'Кнопка «Учить» внизу экрана — и пойдут карточки на сегодня.' : '«Повторить всё» на главной — и пойдут карточки на сегодня. У каждой колоды есть ещё своя кнопка «▶ Учить».') },
      { go: studyScreen, target: '.study .flashcard', title: '🃏 Это карточка', text: 'Посмотрите на слово и попробуйте вспомнить перевод. Не спешите.' },
      { target: '.study .answer-row [data-act="flip"]', title: '↻ Перевернуть', text: 'Нажмите на карточку или на эту кнопку — появится ответ. Нажмите «Дальше» — переверну для примера.', act: () => { if (window.Study && Study.flip) Study.flip(true); }, wait: 400 },
      { target: '.study .answer-row [data-g="3"], .study .answer-row.four [data-g="3"]', title: '✓ Знаю', text: 'Вспомнили? Нажмите «Знаю» (или стрелку →). Это слово вернётся нескоро.' },
      { target: '.study .answer-row [data-g="1"]', title: '✗ Не знаю', text: 'Не вспомнили — ничего страшного. Нажмите «Не знаю» (или ←), и слово скоро покажется снова.' },
      { target: '.study .progress', title: '📈 Сколько осталось', text: 'Полоска показывает, сколько карточек пройдено. Выйти можно в любой момент — всё сохраняется.' },
    ] },
    telegram: { from: () => (document.querySelector('#modal-root .tg-modal') ? 1 : 0), steps: [
      { go: home, target: ['.sidebar [data-sb="telegram"]', '#view [data-act="telegram"]'], title: `${TG(18)} Раздел Telegram`, text: 'Здесь — норвежские каналы и карточки из их постов.' },
      { go: () => ensure('.tg-modal', () => Telegram.open(null, 'channels')), target: '.tg-modal [data-tgtab="channels"]', title: '📢 Норвежские каналы', text: 'Список открытых каналов, где учат норвежский: уроки, слова, видео, новости.', act: el => el.click(), wait: 350 },
      { go: () => ensure('.tg-modal', () => Telegram.open(null, 'channels')), target: ['.tg-modal .tgc-list', '.tg-modal .tgc-empty'], title: '👀 Откройте или добавьте', text: '«Открыть в Телеграме» — посмотреть канал. «Добавить в приложение» — его посты станут источником карточек.' },
      { target: '.tg-modal .tgc-add', title: '➕ Свой канал', text: 'Нашли канал сами? Вставьте его ссылку или @имя — он появится в списке.' },
      { target: '.tg-modal [data-tgtab="setup"]', title: '🔐 Подключить Telegram', text: 'Один раз — и приложение сможет читать ваши группы, книги и аудио. Ключи хранятся только на вашем устройстве.', act: el => el.click(), wait: 400 },
      { target: ['.tg-modal [data-tglogin]', '.tg-modal [data-tglogout]', '.tg-modal .mt-warn'], title: '👉 Вот здесь', text: 'Пошаговый мастер: QR-код из Telegram на телефоне — и готово.' },
    ] },
    subs: { steps: SUBS_STEPS },
    subview: { steps: [SUBS_STEPS[0], SUBS_STEPS[3], SUBS_STEPS[2], SUBS_STEPS[4], SUBS_STEPS[1]].map((s, i) => (i ? Object.assign({}, s, { go: null }) : s)) },
    video: { from: () => (document.querySelector('#modal-root .subs-modal .subs-wrap') ? 2 : 0), steps: [
      { go: home, target: '#view [data-act="nrk"]', title: '📺 NRK TV', text: 'Передачи и сериалы NRK — с норвежскими субтитрами и переводом.' },
      { go: home, target: '#view [data-act="youtube"]', title: '▶ YouTube', text: 'Видео учителей норвежского — так же, с субтитрами и переводом.' },
      ...SUBS_STEPS.map((s, i) => (i === 0 ? Object.assign({}, s, { title: '👀 Так выглядит просмотр', text: 'Это пример. Под видео — норвежские субтитры, под строкой — перевод. Нажмите на любое слово — пауза, перевод и «В карточку».' }) : s)),
    ] },
    radio: { from: () => (document.querySelector('#modal-root .nrkr-modal') ? 1 : 0), steps: [
      { go: home, target: '#view [data-act="nrkradio"]', title: '📻 NRK Радио и подкасты', text: 'Прямой эфир и подкасты — с субтитрами и переводом. Ещё их можно найти в «🎧 Слушать».' },
      { go: () => ensure('.nrkr-modal', () => NrkRadio.open()), target: '.nrkr-modal .nrk-search', title: '🔎 Поиск', text: 'Найдите подкаст или программу по названию.' },
      { target: '.nrkr-modal .nrk-quick', title: '⭐ Популярное', text: 'Готовые подборки — одно нажатие.' },
      { target: '.nrkr-modal .nrk-tile', title: '🎙 Выберите станцию или выпуск', text: 'Откроется плеер. Нажмите «Создать субтитры и перевод» — приложение само запишет, что говорят.', timeout: 6000 },
    ] },
    second: { from: () => (document.querySelector('#modal-root .nrk-modal:not(.nrkr-modal)') ? 1 : 0), steps: [
      { go: home, target: '#view [data-act="nrk"]', title: '📺 Откройте NRK TV', text: 'Второй экран — для прямого эфира, который идёт на телевизоре.' },
      { go: () => ensure('.nrk-modal:not(.nrkr-modal)', () => NrkTV.open()), target: ['.nrk-modal .nrk-live', '.nrk-modal .nrk-body'], title: '📡 Прямой эфир', text: 'Здесь каналы, которые идут сейчас.', timeout: 6000 },
      { target: '.nrk-modal .nrk-2nd', title: '📱 Субтитры с переводом', text: 'Эфир идёт на телевизоре, а на телефоне — его субтитры с переводом. Нажмите на слово — перевод и карточка.', timeout: 6000 },
    ] },
    radioPlayer: { steps: [
      { go: () => ensure('.subs-modal', () => {}), target: ['.subs-modal [data-asr-go]', '.subs-modal .subs-radio'], title: '🤖 Субтитры для эфира', text: 'Нажмите — приложение само запишет, что говорят, и переведёт. В первый раз нужно подождать, пока скачается распознавание речи.' },
      { target: '.subs-modal .subs-list', title: '📜 Строки с переводом', text: 'Здесь появятся строки эфира. Нажмите на слово — перевод и «В карточку».' },
      { target: '.subs-modal [data-trm]', title: '🙈 Перевод: виден или скрыт', text: 'Скройте перевод, чтобы проверить себя.' },
    ] },
    interp: { steps: [
      { go: home, target: ['#interp-btn', '#more-btn'], title: '🗣 Переводчик', text: el => (el.id === 'more-btn' ? 'На телефоне он в меню ⋯ → «Переводчик в наушниках».' : 'Наденьте наушники и нажмите эту кнопку. Разрешите микрофон — и всё.') },
    ] },
    ai: { steps: [
      { go: home, target: '#claude-badge', title: '🤖 Нейросеть', text: 'Робот показывает, подключена ли нейросеть: глаза светятся и рядом её значок — работает; робот спит и кнопка жёлтая — ещё не подключена (Gemini и Groq — бесплатно). Наведите мышь — увидите все нейросети приложения; нажмите — выберите или подключите новую.' },
      { go: () => toView('settings'), target: () => [...document.querySelectorAll('#view .panel h3')].filter(h => /Нейросет/i.test(h.textContent)), title: '🔑 Подключить бесплатно', text: 'Google Gemini или Groq — бесплатно. Получите ключ, вставьте сюда и нажмите «Проверить».' },
    ] },
    create: { from: () => (document.querySelector('#modal-root .create-modal') ? 1 : 0), steps: [
      { go: home, target: '#view [data-act="create"]', title: '💬 Что вы хотите выучить?', text: 'Одна кнопка для всего: тема, список слов, фото, PDF или книга.' },
      { go: () => ensure('.create-modal', () => Create.open()), target: '.create-modal [data-q]', title: '✍️ Напишите тему или вставьте слова', text: '«У врача», «на складе» — или список «слово – перевод».' },
      { target: () => [...document.querySelectorAll('.create-modal [data-photo], .create-modal [data-file]')].map(i => i.closest('label')), title: '📷 Фото или файл', text: 'Фото страницы учебника, PDF, EPUB, Word — приложение найдёт слова и перевод.' },
      { target: '.create-modal .create-tips', title: '💡 Готовые темы', text: 'Нажмите на тему — и она подставится.' },
      { target: '.create-modal .tgc-mini', title: `${TG(18)} Норвежские каналы`, text: 'Ещё один источник: посты норвежских каналов в Телеграме.' },
    ] },
    levels: { from: () => (App.view && App.view.name === 'levels' ? 1 : 0), steps: [
      { go: home, target: ['#view [data-lv-open]', '#view [data-lv-home]'], title: '🪜 Лестница уровней', text: 'Здесь — колоды по уровням A1 → C2 и ваш прогресс на каждой ступеньке.' },
      { go: () => toView('levels'), target: '#view [data-lv-act="placement"]', title: '🎯 Где я сейчас?', text: '30 слов, 3–4 минуты: «знаю / не уверен / не знаю» — и совет, с какого уровня начать.' },
      { go: () => toView('levels'), target: ['#view .lv-row.cur', '#view .lv-ladder'], title: '📶 Ступенька', text: 'Прогресс уровня, «Начать» и «➕ Ещё слова»: карточки готовятся в фоне — перевод, род, формы, пример, картинка.' },
      { go: () => toView('levels'), target: '#view .lv-row[data-l="C1"]', title: '🏔 C1 и C2', text: 'Самые редкие слова того же частотного списка — словарь продвинутого уровня. Дальше — живой язык: новости, NRK, книги.' },
      { go: () => toView('levels'), target: '#view .lv-opts', title: '🎬 Слова уровня в субтитрах', text: 'Включите — и в плеере субтитров подсветятся слова вашего уровня, которых нет в карточках.' },
    ] },
    klokka: { from: () => (document.querySelector('#modal-root .klokka-modal .kl-hub') ? 1 : 0), steps: [
      { go: home, target: ['.sidebar [data-sb="klokka"]', '#view [data-klokka-open]'], title: '🕐 Время по-норвежски', text: 'Раздел Klokka: урок с часами и игры на очки.' },
      { go: () => ensure('.klokka-modal .kl-hub', () => (window.Klokka ? Klokka.open() : null)), target: '.klokka-modal [data-go-lesson]', title: '📖 Как говорят время', text: '7 коротких шагов: целые часы, kvart, halv, 5 минут, på halv / over halv, 24 часа, части дня. У каждой фразы есть звук.' },
      { target: '.klokka-modal .kl-levels', title: '🎚 Уровни', text: 'От целых часов до «ti på halv fire» и «fjorten tretti». Звёзды — за лучший результат.' },
      { target: '.klokka-modal .kl-speed', title: '⚡ На скорость', text: 'Включите — и сколько успеете за 60 секунд. Рекорд сохраняется.' },
      { target: '.klokka-modal .kl-modes', title: '🎮 Игры', text: '«Покажи время» — тяните стрелки. «Который час?» — выберите фразу. «На слух» — только звук. «Скажи сам» — вслух.' },
    ] },
    fix: { steps: [
      { go: flipped, target: '.study [data-act="edit"]', title: '✏️ Редактировать', text: 'Исправьте слово, перевод или пример — сохраняется сразу.' },
      { target: '.study [data-act="ai-check"]', title: '🤖 Проверить карту', text: 'Нейросеть проверит перевод и подскажет, что исправить.' },
      { target: '.study [data-trfix]', title: '✎ Неверный перевод?', text: 'Нажмите карандаш рядом с переводом — исправьте или подтвердите «✓ Верно».' },
      { target: '.study .flashcard.flipped .face.back .prov-b', title: '🕘 Кто переводил', text: 'Значки показывают, откуда перевод: словарь, переводчик, нейросеть или вы. Нажмите — увидите историю.' },
    ] },
    backup: { steps: [
      { go: () => toView('settings'), target: '#view [data-act="backup"]', title: '💾 Резервная копия', text: 'Скачается один файл со всеми колодами, картинками и прогрессом.' },
      { target: '#view [data-act="restore"]', title: '♻️ Восстановить', text: 'На новом телефоне или компьютере: выберите этот файл — и всё на месте.' },
    ] },
  };

  /* ---------------- topics of the help centre ---------------- */
  const TOPICS = [
    { id: 'study', icon: '🃏', hue: 262, title: 'Учить карточки и интервальные повторения', desc: 'Вспомнили — «Знаю», нет — «Не знаю». Когда повторить, приложение решит само.',
      keys: 'учить карточки повторять повторение флеш колода знаю не знаю перевернуть', tour: 'study', at: [0, 1, 2, 3, null],
      steps: [['▶', 'Нажмите <b>«Учить»</b> внизу экрана (на компьютере — <b>«Повторить всё»</b> на главной) или <b>«▶ Учить»</b> у колоды.'],
        ['👀', 'Посмотрите на слово и попробуйте вспомнить перевод.'],
        ['tap', 'Нажмите на карточку — она перевернётся и покажет ответ.'],
        ['✓', '<b>«Знаю»</b> — если вспомнили, <b>«Не знаю»</b> — если нет. На клавиатуре: → и ←.'],
        ['📅', 'Всё. Слово вернётся как раз тогда, когда вы начнёте его забывать.']],
      expect: 'Каждый день — немного повторений. Знакомые слова появляются всё реже, трудные — чаще. Так запоминается надолго, без зубрёжки.',
      limits: 'Пропустили несколько дней — накопятся повторения. Это нормально: новые слова встанут на паузу, пока вы не догоните.',
      open: ['▶ Начать учить', () => Study.start({ deckId: null })] },
    { id: 'listen', icon: '🎧', hue: 248, title: 'Слушать в наушниках или через динамик', desc: 'Карточки, книги, новости и радио — вслух, даже с выключенным экраном.',
      keys: 'слушать наушники динамик аудио звук прослушивание плеер экран карман', tour: 'listen', at: [0, 1, 2, 4, 7],
      art: () => (window.ListenUI && ListenUI.art ? ListenUI.art('in-help') : ''),
      steps: [['🎧', 'Нажмите <b>«Слушать»</b> вверху экрана.'], ['🗂', 'Выберите: колоду, книгу, новости, радио или подкаст.'],
        ['▶', 'Звук начнётся сразу, откроется плеер <b>«Сейчас играет»</b>.'], ['🐢', 'В плеере — скорость, «что звучит» и паузы перед переводом.'],
        ['🌑', '<b>«Тёмный экран»</b> — и телефон можно положить в карман.']],
      expect: 'Норвежское слово — пауза — перевод. Или «🧠 Вспомни сам»: сначала перевод, вы говорите по-норвежски, потом ответ.',
      limits: 'Если включить другое приложение со звуком, прослушивание может остановиться. Нажмите ▶ ещё раз — продолжится с того же места.',
      open: ['🎧 Что послушать', () => ListenUI.chooser()] },
    { id: 'interp', icon: '🗣', hue: 200, title: 'Переводчик для живого разговора', desc: 'Слушает людей вокруг и переводит вам в наушники.',
      keys: 'переводчик разговор говорить микрофон магазин врач перевод речи нейросеть подсказка ответ', tour: 'interp', at: [null, 0, null, null, null],
      steps: [['🎧', 'Наденьте наушники.'], ['🗣', 'Нажмите <b>«Переводчик»</b> вверху (на телефоне — в меню ⋯).'], ['🎙', 'Разрешите приложению микрофон.'],
        ['🇳🇴', 'Вам говорят по-норвежски — вы слышите перевод в наушниках.'], ['🇷🇺', 'Скажите по-русски — услышите, как это сказать по-норвежски.']],
      extra: () => {
        const on = window.AI && AI.available();
        return { cls: 'ai', title: on ? `🤖 Нейросеть подключена: ${esc(AI.PROVIDERS[AI.current()].name)}` : '🤖 С нейросетью переводчик умнее',
          html: `Когда подключена нейросеть, переводчик понимает <b>смысл всей фразы</b>, а не переводит слово за словом, и <b>подсказывает 2 коротких ответа</b> по-норвежски — их можно сразу повторить вслух.
            ${on ? ' Всё уже работает.' : ' Подключить бесплатно: выберите нейросеть, получите ключ на её сайте и вставьте — приложение проверит, это пара минут.'}
            <br><span class="hc-muted">Без нейросети работает бесплатный переводчик — он проще: переводит дословнее, чаще ошибается, а подсказок ответа нет.</span>`,
          btn: [on ? '🤖 Сменить нейросеть' : '🤖 Подключить нейросеть', () => (window.TrNotice ? TrNotice.open() : UI.goTo('settings'))] };
      },
      expect: 'Помощь в магазине, у врача, на работе: перевод — и, с нейросетью, готовые короткие ответы.',
      limits: 'В шуме микрофон слышит хуже. Перевод делает машина — в важном разговоре переспросите. Если браузер не умеет распознавать речь, понадобится нейросеть — приложение подскажет. Разговор никуда не записывается.',
      open: ['🗣 Включить переводчик', () => Interp.toggle()] },
    { id: 'video', icon: '📺', hue: 350, title: 'Видео NRK и YouTube с субтитрами и переводом', desc: 'Смотрите передачи — нажмите на слово, и оно станет карточкой.',
      keys: 'видео nrk tv youtube ютуб субтитры передача сериал смотреть фильм', tour: 'video', at: [0, null, 2, 2, 7],
      steps: [['📺', 'Откройте <b>«NRK TV»</b> или <b>«YouTube»</b> на главной.'], ['🔎', 'Найдите передачу или видео.'],
        ['💬', 'Под видео — норвежские субтитры, под строкой — перевод.'], ['tap', 'Нажмите на слово — видео встанет на паузу, появится перевод и «В карточку».'],
        ['➕', 'Строку целиком можно сделать карточкой — с настоящим звуком.']],
      expect: 'Живой норвежский: как говорят на самом деле — и сразу карточки из того, что вы услышали.',
      limits: 'Не у всех передач есть субтитры — тогда приложение может создать их само, это дольше и с ошибками. Некоторые передачи NRK показывает только в Норвегии.',
      open: ['📺 Открыть NRK TV', () => NrkTV.open()] },
    { id: 'subview', icon: 'Aa', hue: 30, title: 'Вид субтитров и телевизор', desc: 'Размер и цвет текста, перевод на видео, показ на телевизоре.',
      keys: 'вид субтитров размер шрифт цвет телевизор тв chromecast перевод скрыть размыть aa', tour: 'subview', at: [1, 2, 4, 3],
      steps: [['Aa', '<b>«Вид субтитров»</b> — крупнее, мельче, другие цвета.'], ['💬', '<b>«Субтитры на видео»</b> — строка с переводом прямо на картинке.'],
        ['🙈', 'Перевод: <b>виден / слово / размыт / скрыт</b> — проверьте себя.'], ['📺', '<b>«На телевизор»</b> — видео на большом экране, субтитры и перевод тоже.']],
      expect: 'Удобно глазам: читается и с дивана, и с телефона.',
      limits: 'Телевизор и компьютер должны быть в одной сети Wi‑Fi. Если телевизор не находится, приложение подскажет, что сделать.',
      open: null },
    { id: 'radio', icon: '📻', hue: 160, title: 'Радио и подкасты', desc: 'Прямой эфир NRK и подкасты — с субтитрами и переводом.',
      keys: 'радио подкаст эфир nrk p1 p2 p3 слушать новости', at: { radio: [0, 3, null, null], radioPlayer: [null, null, 0, 1] }, tour: () => (document.querySelector('#modal-root .subs-modal .subs-radio') ? 'radioPlayer' : 'radio'),
      steps: [['📻', 'Откройте <b>«NRK Радио»</b> на главной или в «🎧 Слушать».'], ['🎙', 'Выберите станцию или выпуск подкаста.'],
        ['🤖', 'Нажмите <b>«Создать субтитры и перевод»</b> — приложение само запишет, что говорят.'], ['tap', 'Нажмите на слово — перевод и карточка.']],
      expect: 'Норвежская речь каждый день — и текст под ней, чтобы понимать.',
      limits: 'Субтитры для радио создаёт ваше устройство. В первый раз оно скачивает около 180 МБ — это несколько минут. В словах бывают ошибки.',
      open: ['📻 Открыть радио', () => NrkRadio.open()] },
    { id: 'second', icon: '📱', hue: 190, title: 'Второй экран для прямого эфира', desc: 'Эфир — на телевизоре, субтитры с переводом — на телефоне.',
      keys: 'второй экран прямой эфир телевизор телефон субтитры nrk', tour: 'second', at: [null, 1, 2, null],
      steps: [['📺', 'Включите прямой эфир NRK на телевизоре.'], ['📱', 'В приложении: <b>NRK TV → Прямой эфир → «Субтитры с переводом»</b> у того же канала.'],
        ['💬', 'Субтитры эфира с переводом идут на телефоне вместе с телевизором.'], ['⏱', 'Спешат или отстают — сдвиньте кнопками <b>«−»</b> и <b>«+»</b>.']],
      expect: 'Смотрите новости и спорт по-норвежски — и понимайте каждую фразу.',
      limits: 'Работает только у эфиров с субтитрами NRK. Звук и картинку приложение не показывает — только текст.',
      open: ['📺 Открыть NRK TV', () => NrkTV.open()] },
    { id: 'telegram', icon: 'tg', hue: 200, title: 'Telegram-каналы', desc: 'Норвежские каналы: слова, фразы и картинки — в карточки.',
      keys: 'telegram телеграм канал группа чат посты norsk норвегия', tour: 'telegram', at: [null, 1, 4, null, null],
      steps: [['🔎', 'Найдите каналы: в поиске Telegram напишите <b>«norsk»</b> или <b>«Норвегия язык»</b>.'], ['📢', 'Или откройте список <b>«Норвежские каналы»</b> в разделе Telegram.'],
        ['🔐', 'Подключите свой Telegram — один раз.'], ['🗂', '<b>«Создать карточки из чата»</b> — приложение соберёт пары «слово — перевод».'],
        ['🛡', 'Каждая пара сверяется с переводчиком — ошибки авторов отсеиваются.']],
      expect: 'Готовые карточки из уроков и словариков, которые пишут преподаватели.',
      limits: 'Читать каналы прямо в приложении можно на компьютере Mac с подключённым Telegram. На телефоне каналы открываются в самом Telegram. Приложение только читает — ничего не пишет от вашего имени.',
      open: ['📢 Норвежские каналы', () => Telegram.open(null, 'channels')] },
    { id: 'ai', icon: '🤖', hue: 20, title: 'Нейросеть и качество перевода', desc: 'Бесплатная нейросеть проверяет карточки и переводит точнее.',
      keys: 'нейросеть ии ai gemini groq claude ключ перевод качество ошибки проверить', tour: 'ai', at: [0, 1, 1, null],
      steps: [['🤖', 'Нажмите на значок нейросети вверху.'], ['🔑', 'Выберите бесплатную — <b>Google Gemini</b> или <b>Groq</b> — и получите ключ (2 минуты).'],
        ['📋', 'Вставьте ключ: <b>Настройки → Нейросети</b> → «Проверить».'], ['✨', 'Готово: проверка карточек, объяснения, формы слов, примеры, точный перевод субтитров.']],
      expect: 'Перевод по смыслу всей фразы, а не слово за словом: «ønska — хотел», а не «желание».',
      limits: 'Без нейросети работают словари и бесплатные переводчики — смысл они передают, но ошибаются в идиомах. У бесплатных нейросетей есть дневной лимит. Ключ хранится только на этом устройстве, в зашифрованном виде.',
      open: ['⚙️ Открыть настройки', () => UI.goTo('settings')] },
    { id: 'create', icon: '✨', hue: 290, title: 'Карточки из любого источника', desc: 'Тема, список слов, фото страницы, PDF, книга, видео — всё становится карточками.',
      keys: 'создать карточки колода фото pdf epub файл список слов тема импорт', tour: 'create', at: [0, 1, 2, null],
      steps: [['💬', 'На главной нажмите <b>«Что вы хотите выучить?»</b>.'], ['✍️', 'Напишите тему («у врача», «на складе») или вставьте список «слово – перевод».'],
        ['📷', 'Или добавьте фото страницы, PDF, EPUB, Word.'], ['👀', 'Проверьте пары и нажмите <b>«Сохранить»</b>.']],
      expect: 'Своя колода за минуту — из того, что вы учите прямо сейчас.',
      limits: 'Колода по теме — с нейросетью. Список слов, фото и файлы работают и без неё. Плохое фото распознаётся с ошибками — снимайте ровно и при хорошем свете.',
      open: ['💬 Что вы хотите выучить?', () => Create.open()] },
    { id: 'levels', icon: '🪜', hue: 140, title: 'Учить по уровням A1–C2', desc: 'Колоды A1 → C2, «город тем», тест «Где я сейчас?» и прогресс по ступенькам.',
      keys: 'уровни уровень колода a1 a2 b1 b2 c1 c2 cefr лестница тест где я сейчас темы город тем частые слова kelly прогресс пройден',
      tour: 'levels', at: [0, 1, 2, null, null],
      steps: [['🪜', 'На главной — <b>«Лестница уровней»</b> (в «Учить» или под статистикой).'], ['🎯', 'Пройдите тест <b>«Где я сейчас?»</b> — он подскажет, с какого уровня начать.'],
        ['➕', '<b>«Начать A1»</b> — «Колода A1» создастся, слова добавятся порциями, карточки готовятся в фоне.'],
        ['🏙', 'На странице колоды — <b>«город тем»</b>: плитки «Еда», «Числа и время»… с кольцом прогресса. Нажмите плитку — <b>«▶ Учить»</b> или <b>«🎧 Слушать»</b> только эту тему.'],
        ['🎉', 'Выучено ~80% уровня — поздравление и «Открыть следующий». Уровни не закрыты.']],
      expect: 'Понятный путь от первых слов до C2: что учить сейчас и сколько уже пройдено.',
      limits: 'Уровни — приблизительные, по частотности слов (список Kelly), а не официальная оценка CEFR. C1 и C2 — самые редкие слова того же списка, а не полный словарь этих уровней. Без нейросети темы определяются по встроенному словарю — примерно, а перевод — машинный.',
      open: ['🪜 Открыть лестницу', () => Levels.open()] },
    { id: 'klokka', icon: '🕐', hue: 45, title: 'Время по-норвежски', desc: 'Klokka: «halv fire» — это 3:30. Урок с часами и игры на очки.',
      keys: 'время часы klokka который час halv kvart over på половина четверть урок игра', tour: 'klokka', at: [0, 1, 2, 4, 3],
      steps: [['🕐', 'Откройте <b>«Время по-норвежски»</b>: на главной в «Учить», в «🏋️ Упражнениях» или в боковом меню.'], ['📖', '<b>«Как говорят время»</b> — 7 шагов с часами, цветными зонами и звуком.'],
        ['🎚', 'Выберите уровень: от целых часов до «ti på halv fire» и 24 часов.'], ['🎮', 'Игра: тяните стрелки, выбирайте фразу, слушайте или говорите вслух.'],
        ['⚡', '<b>«На скорость»</b> — 60 секунд. Ошибки собираются — <b>«Повторить ошибки»</b>.']],
      expect: 'Вы будете сразу понимать «fem over halv fire» и называть время сами. Главное: halv fire = 3:30 — «половина четвёртого».',
      limits: 'Голос — системный норвежский (или выбранный в Настройках). «Скажи сам» есть, только если браузер умеет распознавать речь. Очки и рекорды хранятся на этом устройстве.',
      open: ['🕐 Открыть Klokka', () => (window.Klokka ? Klokka.open() : null)] },
    { id: 'fix', icon: '🛠', hue: 130, title: 'Проверить и исправить перевод', desc: 'Нашли ошибку? Исправьте сами или попросите нейросеть.',
      keys: 'исправить ошибка неверный перевод редактировать проверить карточку история', tour: 'fix', at: [0, 2, 1, 3],
      steps: [['✏️', 'На обороте карточки — <b>«Редактировать»</b>: поправьте слово, перевод или пример.'], ['✎', 'Карандаш рядом с переводом — <b>«Неверный перевод?»</b>: исправьте или подтвердите «✓ Верно».'],
        ['🤖', '<b>«Проверить карту»</b> — нейросеть проверит и предложит исправление.'], ['🕘', 'Значки на карточке показывают, кто переводил. Нажмите — увидите историю.']],
      expect: 'Ваш перевод запоминается и больше не заменяется машинным.',
      limits: 'Машинный перевод бывает неточным — особенно отдельные слова и идиомы. Если сомневаетесь, загляните в словарь 📚 на карточке.',
      open: null },
    { id: 'backup', icon: '💾', hue: 220, title: 'Резервная копия и перенос', desc: 'Сохраните всё в файл и перенесите на другой телефон или компьютер.',
      keys: 'резервная копия бэкап перенос сохранить восстановить телефон компьютер файл', tour: 'backup', at: [null, 0, null, 1],
      steps: [['⚙️', 'Откройте <b>Настройки</b>.'], ['💾', '<b>«Скачать бэкап»</b> — сохранится файл со всеми колодами и прогрессом.'],
        ['📤', 'Перешлите файл себе: почтой, в Telegram или в облако.'], ['♻️', 'На новом устройстве: <b>Настройки → «Восстановить из файла»</b>.']],
      expect: 'Все колоды, картинки, прогресс и настройки — на новом устройстве.',
      limits: 'Ключи нейросетей в копию не попадают — их нужно вставить заново. Всё хранится в браузере: если очистить данные сайта, они пропадут. Делайте копию раз в неделю.',
      open: ['⚙️ Открыть настройки', () => UI.goTo('settings')] },
  ];
  const topic = id => TOPICS.find(t => t.id === id);
  // «?» of the subtitle player → the video topic (its tour then starts right in the open player)
  const alias = id => (id === 'subs' ? 'video' : topic(id) ? id : null);
  const ticon = t => (t.icon === 'tg' ? TG(26) : esc(t.icon));
  const sicon = i => (i === 'tap' || i === '👆' || i === '👉' ? HAND_I(24) : esc(i));
  /** a gentle CSS animation for the topic's icon in the grid (sound waves, subtitle flicker, a robot that blinks…) */
  const ANIM = { listen: 'waves', audiocourse: 'waves', radio: 'radio', video: 'tv', subview: 'tv', second: 'tv', ai: 'robot', study: 'flip', interp: 'talk', telegram: 'fly', klokka: 'tick', levels: 'climb', create: 'spark', backup: 'save', fix: 'tilt', library: 'book', reader: 'book', dialogs: 'talk', prove: 'tilt', gramref: 'book', gram: 'book', ordtr: 'tilt' };
  const animOf = t => ANIM[t.id] || ({ '🎧': 'waves', '📺': 'tv', '🤖': 'robot', '📻': 'radio', '📖': 'book', '📚': 'book' })[t.icon] || 'bob';
  const tourOf = t => (t && t.tour ? (typeof t.tour === 'function' ? t.tour() : t.tour) : null);
  /** step row k of a topic → the step of its tour that shows it on screen (null: nothing to show) */
  const stepAt = (t, tid, k) => { const a = Array.isArray(t.at) ? t.at : (t.at && t.at[tid]) || []; const v = a[k]; return v == null || !TOURS[tid] || !TOURS[tid].steps[v] ? null : v; };

  /* ---------------- 🎬 the animated «mini screen» demos live in js/helpanim.js + css/helpanim.css (loaded on first use) ---------------- */
  const ME = (document.currentScript && document.currentScript.src) || '';
  let animP = null;
  function loadAnim() {
    if (window.HelpAnim) return Promise.resolve(window.HelpAnim);
    if (animP) return animP;
    const url = (file, dir) => (ME && /help\.js(?=[?#]|$)/.test(ME) ? ME.replace(/js\/help\.js(?=[?#]|$)/, dir + '/' + file) : dir + '/' + file);
    const css = new Promise(res => {
      if (document.querySelector('link[href*="helpanim.css"]')) { res(); return; }
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = url('helpanim.css', 'css');
      l.onload = l.onerror = () => res(); document.head.appendChild(l); setTimeout(res, 2500);
    });
    const js = new Promise(res => {
      if (document.querySelector('script[src*="helpanim.js"]')) { let n = 0; const t = setInterval(() => { if (window.HelpAnim || ++n > 60) { clearInterval(t); res(); } }, 50); return; }
      const sc = document.createElement('script'); sc.src = url('helpanim.js', 'js');
      sc.onload = sc.onerror = () => res(); document.head.appendChild(sc);
    });
    animP = Promise.all([css, js]).then(() => window.HelpAnim || null);
    return animP;
  }

  /** the help centre's own picture: a glowing «?» bubble with the app's places orbiting around it */
  const HERO_SVG = `<svg class="hc-svg" viewBox="0 0 220 150" aria-hidden="true">
      <defs>
        <linearGradient id="hcG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b80ff"/><stop offset="1" stop-color="#29c7ff"/></linearGradient>
        <radialGradient id="hcS" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>
      </defs>
      <ellipse class="hc-shadow" cx="110" cy="136" rx="34" ry="6"/>
      <g class="hc-bob">
        <path d="M110 22c-29 0-52 20-52 46 0 15 8 28 20 36l-4 18 19-11c5 1.5 11 2.4 17 2.4 29 0 52-20 52-45.4S139 22 110 22z" fill="url(#hcG)"/>
        <path d="M110 22c-29 0-52 20-52 46 0 15 8 28 20 36l-4 18 19-11c5 1.5 11 2.4 17 2.4 29 0 52-20 52-45.4S139 22 110 22z" fill="url(#hcS)"/>
        <path d="M98 55c0-7 5.4-12 12.4-12S123 47.6 123 54c0 9-12 9.6-12 19" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
        <circle cx="111" cy="86" r="4.6" fill="#fff"/>
      </g>
    </svg>`;

  /* ---------------- the help centre window (and the same list + topics inside the welcome) ---------------- */
  const SHOW_BTN = '<button type="button" class="btn primary hc-show" data-hc-tour><span class="hc-play" aria-hidden="true"><svg viewBox="0 0 16 16" width="12" height="12"><path d="M4.5 2.6v10.8L13.4 8z" fill="currentColor"/></svg></span><span class="hc-show-t"><b>Показать по шагам на экране</b><small>Покажу кнопки по очереди: куда нажать и что произойдёт</small></span></button>';
  /** o: { welcome } — draws the topic list and the topics into the window m; → { showList, showTopic, drop() } */
  function centre(m, o = {}) {
    const box = m.$('[data-hc]'), foot = m.$('[data-hcfoot]');
    const head = m.$('.modal-head h2');
    let q = '', cur = null, hint = null, demo = null;
    const dropDemo = () => { if (demo) { try { demo.destroy(); } catch (e) { /* ignore */ } demo = null; } };
    const dropHint = () => { if (hint) { hint.remove(); hint = null; } };
    const card = (t, i) => `<button type="button" class="hc-card" data-hc-topic="${t.id}" style="--h:${t.hue};--i:${Math.min(i, 14)}">
        <span class="hc-ico" data-anim="${animOf(t)}" aria-hidden="true"><span class="hc-ico-in">${ticon(t)}</span></span>
        <span class="hc-txt"><b>${esc(t.title)}</b><small>${esc(t.desc)}</small></span>
        <span class="hc-go" aria-hidden="true">›</span></button>`;
    const match = t => { if (!q) return true; const hay = norm(`${t.title} ${t.desc} ${t.keys}`); return norm(q).split(' ').every(w => hay.includes(w)); };
    const drawGrid = () => {
      const list = TOPICS.filter(match);
      const g = box.querySelector('[data-hcgrid]');
      g.innerHTML = list.length ? list.map((t, i) => card(t, i)).join('')
        : `<div class="hc-empty"><span aria-hidden="true">🤔</span><b>Ничего не нашлось</b><small>Попробуйте другое слово — например:</small>
            <span class="hc-sugg">${['слушать', 'перевод', 'Telegram', 'карточки', 'телевизор', 'копия'].map(w => `<button type="button" class="chip" data-hc-q="${w}">${w}</button>`).join('')}</span></div>`;
      const n = box.querySelector('[data-hcn]'); if (n) n.textContent = q ? `Найдено: ${list.length} из ${TOPICS.length}` : '';
    };
    /** the first time: the hand shows what to do here (once) */
    const firstHint = (flag, el, opts) => {
      if (!el || state()[flag]) return;
      patch({ [flag]: Date.now() });
      setTimeout(() => { if (el.isConnected && !T) { dropHint(); hint = makeHand(el, Object.assign({ dismiss: true, timeout: 6500, arrow: 'tap', cls: 'nk-hint' }, opts)); } }, 450);
    };
    const showList = () => {
      dropHint(); dropDemo(); cur = null;
      const name = (window.Store && Store.settings && Store.settings.userName || '').trim();
      head.innerHTML = o.welcome ? '<span class="hc-title">👋 Добро пожаловать в Norsk Kort!</span>' : '<span class="hc-title">❓ Как пользоваться</span>';
      box.innerHTML = `<div class="hc-hero ${reduce() ? 'still' : ''} ${o.welcome ? 'welcome' : ''}">
          <div class="hc-stage" aria-hidden="true"><span class="hc-ring r1"></span><span class="hc-ring r2"></span>${HERO_SVG}
            <span class="hc-orb o1">🃏</span><span class="hc-orb o2">🎧</span><span class="hc-orb o3">📺</span><span class="hc-orb o4">${TG(20)}</span></div>
          ${o.welcome
            ? `<div class="hc-hero-txt"><h2>${name ? `Привет, ${esc(name)}! ` : ''}Рады, что вы здесь 💙</h2><p>Norsk Kort помогает учить норвежский: слова — карточками, а ещё видео, радио, книги и Telegram <b>с переводом на русский</b>.</p></div>`
            : '<div class="hc-hero-txt"><h2>Всё просто — покажу</h2><p>Выберите, что хотите сделать. Расскажу в двух словах и <b>покажу прямо на экране</b>.</p></div>'}
        </div>
        ${o.welcome ? '<div class="hc-label hc-wlabel">Как пользоваться — нажмите на тему, расскажу и покажу</div>' : `<label class="hc-search"><span aria-hidden="true">🔎</span><input type="search" data-hcq placeholder="Найти среди тем: слушать, перевод, телевизор…" aria-label="Найти среди тем — список ниже сократится до подходящих" value="${esc(q)}" enterkeyhint="search"><span class="hc-n" data-hcn></span></label>`}
        <div class="hc-grid" data-hcgrid></div>`;
      foot.innerHTML = o.welcome
        ? `<span class="hc-foot-note">Это окно всегда можно открыть снова: кнопка <span class="help-q demo" aria-hidden="true">?</span> «Как пользоваться».</span>
          <button type="button" class="btn ghost hc-wclose" data-hc-wclose>✕ Закрыть</button><button type="button" class="btn primary lg hc-start" data-hc-start>🚀 Начать учиться</button>`
        : `<span class="hc-foot-note">💡 Маленькая кнопка <span class="help-q demo" aria-hidden="true">?</span> в разделах сразу открывает нужную подсказку.</span>
          <button type="button" class="btn ghost" data-hc-reset title="Снова показывать подсказки и приветственные окна">💡 Показать подсказки снова</button>`;
      drawGrid();
      const inp = box.querySelector('[data-hcq]');
      if (inp) {
        inp.addEventListener('input', () => { q = inp.value.trim(); drawGrid(); dropHint(); });
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = box.querySelector('.hc-card'); if (f) f.click(); } });
        if (matchMedia('(hover: hover) and (pointer: fine)').matches) setTimeout(() => inp.focus({ preventScroll: true }), 120);
      }
      m.$('.modal-body').scrollTop = 0;
      firstHint('hintList', box.querySelector('.hc-card'), { label: 'Выберите, что хотите сделать' });
    };
    const showTopic = t => {
      dropHint(); dropDemo();
      const tid = tourOf(t);
      head.innerHTML = `<button type="button" class="hc-back" data-hc-back aria-label="${o.welcome ? 'Назад к списку' : 'Все темы'}">${o.welcome ? '← <span>Назад к списку</span>' : '‹ <span>Все темы</span>'}</button>`;
      const ex = t.extra ? t.extra() : null;
      const steps = Array.isArray(t.steps) ? t.steps : [];
      const anyAt = tid && steps.some((x, k) => stepAt(t, tid, k) != null);
      box.innerHTML = `<div class="hc-topic ${steps.length ? 'has-demo' : ''}" data-hc-id="${esc(t.id)}" style="--h:${t.hue}">
          <div class="hc-thead"><span class="hc-tico ${reduce() ? 'still' : ''}" aria-hidden="true">${ticon(t)}</span><div><h2>${esc(t.title)}</h2><p>${esc(t.desc)}</p></div></div>
          <div class="hc-tmain">
            ${steps.length ? `<div class="hc-demo" data-hc-demo>${t.art ? `<div class="hc-demo-art">${t.art()}</div>` : '<div class="hc-demo-wait"><span class="spinner sm"></span></div>'}</div>` : (t.art ? t.art() : '')}
            <div class="hc-tsteps">
              <div class="hc-label">Как это сделать <span class="hc-label-tip">· нажмите на шаг — покажу его в анимации${anyAt ? ', «на экране ▶» — прямо в приложении' : ''}</span></div>
              <ol class="hc-steps">${steps.map(([i, x], k) => {
                const at = tid ? stepAt(t, tid, k) : null;
                return `<li class="hc-st ${at == null ? '' : 'go'}" style="--d:${k * 60}ms" data-hd-k="${k}">
                  <button type="button" class="hc-sj" data-hd-jump="${k}"><span class="hc-sico" aria-hidden="true">${sicon(i)}</span><span class="hc-stxt">${x}</span></button>
                  ${at == null ? '' : `<button type="button" class="hc-sgo" data-hc-step="${at}" title="Показать этот шаг прямо в приложении" aria-label="Показать на экране, в самом приложении: шаг ${k + 1}">на экране <span aria-hidden="true">▶</span></button>`}</li>`;
              }).join('')}</ol>
            </div>
          </div>
          ${ex ? `<div class="hc-box ${ex.cls || ''}"><b>${ex.title}</b><div>${ex.html}</div>${ex.btn ? `<button type="button" class="btn sm hc-extra" data-hc-extra>${esc(ex.btn[0])}</button>` : ''}</div>` : ''}
          <div class="hc-box ok"><b>✨ Что вы получите</b><div>${t.expect}</div></div>
          <div class="hc-box honest"><b>🤝 Честно о границах</b><div>${t.limits}</div></div>
        </div>`;
      foot.innerHTML = o.welcome
        ? `<button type="button" class="btn ghost" data-hc-back>← Назад к списку</button>${tid ? SHOW_BTN : ''}`
        : `${t.open ? `<button type="button" class="btn" data-hc-open>${esc(t.open[0])}</button>` : ''}${tid ? SHOW_BTN : ''}`;
      m.$('.modal-body').scrollTop = 0;
      const b = foot.querySelector('[data-hc-tour]') || foot.querySelector('button'); if (b) setTimeout(() => b.focus({ preventScroll: true }), 80);
      cur = t; cur._ex = ex;
      // the animated mini screen: the topic's steps played by our hand (js/helpanim.js)
      const host = box.querySelector('[data-hc-demo]');
      if (host) {
        loadAnim().then(HA => {
          if (!HA || cur !== t || !host.isConnected) { if (host.isConnected && !t.art) host.remove(); return; }
          try { demo = HA.mount(host, t, { list: box.querySelector('.hc-steps'), hand: HAND_SVG('hd-hand-svg'), tip: [TIP_X, TIP_Y], ratio: HAND_H / HAND_W }); }
          catch (e) { console.warn('help demo', e); if (!t.art) host.remove(); }
        });
      }
      firstHint('hintTour', foot.querySelector('[data-hc-tour]'), {});
    };
    /** a tour from this topic (k — from that step); the welcome closes without asking */
    const startTour = (k, intro) => {
      const t = cur; if (!t) return;
      const tid = tourOf(t); if (!tid) return;
      dropHint(); dropDemo();
      if (o.onTour) o.onTour();
      m.close();
      setTimeout(() => Help.tour(tid, { start: k, intro: !!intro, onEnd: o.welcome ? () => setTimeout(() => pointAtHelp(), 350) : undefined }), 230);
    };
    m.el.addEventListener('click', e => {
      const c = e.target.closest('[data-hc-topic]'); if (c) { showTopic(topic(c.dataset.hcTopic)); return; }
      if (e.target.closest('[data-hc-back]')) { showList(); return; }
      const s = e.target.closest('[data-hc-q]'); if (s) { q = s.dataset.hcQ; showList(); return; }
      if (e.target.closest('[data-hc-reset]')) { Help.resetHints(); return; }
      const st = e.target.closest('[data-hc-step]'); if (st && cur) { startTour(+st.dataset.hcStep, false); return; }
      const sj = e.target.closest('[data-hd-jump]');
      if (sj && cur) {
        if (demo) demo.jump(+sj.dataset.hdJump);
        else { const g = sj.closest('li') && sj.closest('li').querySelector('[data-hc-step]'); if (g) startTour(+g.dataset.hcStep, false); }
        return;
      }
      if (e.target.closest('[data-hc-tour]') && cur) { startTour(0, true); return; }
      if (e.target.closest('[data-hc-extra]') && cur && cur._ex && cur._ex.btn) { const f = cur._ex.btn[1]; if (o.onTour) o.onTour(); m.close(); setTimeout(() => { try { f(); } catch (err) { console.warn('help extra', err); } }, 230); return; }
      if (e.target.closest('[data-hc-open]') && cur && cur.open) { const t = cur; m.close(); try { t.open[1](); } catch (err) { console.warn('help open', err); } }
    });
    return { showList, showTopic, drop: () => { dropHint(); dropDemo(); }, cur: () => cur, demo: () => demo };
  }

  /* ---------------- 👋 the welcome on the first start ---------------- */
  /** where «Как пользоваться» lives on this screen: the top «?», else ⋯ (phones / narrow tablets), else the sidebar */
  const helpTarget = () => [document.getElementById('help-btn'), document.getElementById('more-btn'), document.querySelector('.sidebar [data-sb="help"]')].find(b => b && shown(b)) || null;
  const rectOf = r => ({ left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) });
  /** the window shrinks and flies into the button (scale + translate onto its rect), then closes */
  function flyInto(m, target) {
    return new Promise(res => {
      const bd = m.el.closest('.modal-backdrop');
      if (!target || reduce() || !m.el.animate) { m.close(); res(); return; }
      const a = m.el.getBoundingClientRect(), b = target.getBoundingClientRect();
      const dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2);
      const sx = b.width / a.width, sy = b.height / a.height;
      m.el.style.animation = 'none';
      m.el.style.transformOrigin = '50% 50%';
      m.el.style.pointerEvents = 'none';
      const anim = m.el.animate([
        { transform: 'translate(0px, 0px) scale(1, 1)', opacity: 1, borderRadius: getComputedStyle(m.el).borderTopLeftRadius },
        { offset: 0.3, transform: `translate(${dx * 0.08}px, ${dy * 0.08}px) scale(0.9, 0.82)`, opacity: 1 },
        { offset: 0.75, transform: `translate(${dx * 0.86}px, ${dy * 0.86}px) scale(${Math.max(sx, 0.1)}, ${Math.max(sy, 0.08)})`, opacity: 0.9 },
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.25, borderRadius: '50%' },
      ], { duration: 760, easing: 'cubic-bezier(.5, 0, .3, 1)', fill: 'forwards' });
      if (bd) { bd.style.backdropFilter = 'none'; bd.style.webkitBackdropFilter = 'none'; bd.animate([{ backgroundColor: getComputedStyle(bd).backgroundColor }, { backgroundColor: 'rgba(0, 0, 0, 0)' }], { duration: 700, fill: 'forwards' }); }
      let done = false;
      const fin = () => {
        if (done) return; done = true;
        Help._lastFly = { from: rectOf(a), end: rectOf(m.el.getBoundingClientRect()), btn: rectOf(target.getBoundingClientRect()), id: target.id || target.dataset.sb || '' };
        m.close(); res();
      };
      anim.onfinish = fin;
      setTimeout(fin, 1400); // a background tab may not finish animations
    });
  }
  /** after the welcome: the hand + a beacon on the help button and a bubble «всегда здесь» */
  function pointAtHelp(target) {
    target = target && shown(target) ? target : helpTarget();
    if (!target || T) return;
    document.querySelectorAll('.hc-here').forEach(x => x.remove());
    if (Help._here) Help._here.remove();
    const where = target.id === 'more-btn' ? 'more' : target.id === 'help-btn' ? 'top' : 'side';
    const hand = makeHand(target, { arrow: 'tap', cls: 'nk-here' });
    Help._here = hand;
    const tip = document.createElement('div');
    tip.className = 'hc-hint hc-here'; tip.setAttribute('role', 'status');
    tip.innerHTML = `<span class="hc-hint-txt"><span class="help-q demo" aria-hidden="true">?</span><span><b>Знакомство и подсказки — всегда здесь</b><small>${where === 'more' ? 'Меню ⋯ → «❓ Как пользоваться»' : where === 'top' ? 'Кнопка «?» — «Как пользоваться»' : '«Как пользоваться» в меню слева'}</small></span></span>
      <span class="hc-hint-act"><button type="button" class="btn sm primary" data-hch="ok">Понятно</button></span>`;
    document.body.appendChild(tip);
    const place2 = () => {
      if (!tip.isConnected) return;
      const r = target.getBoundingClientRect(), vw = document.documentElement.clientWidth || innerWidth;
      const hb = hand.box() || { left: r.left, right: r.right, top: r.bottom, bottom: r.bottom + 70 };
      const w = tip.offsetWidth, h = tip.offsetHeight;
      let left, top, side = false;
      if (hb.left - 14 - w >= 10 && vw > 720) { side = true; left = hb.left - 14 - w; top = clamp((hb.top + hb.bottom) / 2 - h / 2, r.bottom + 8, innerHeight - h - 10); }
      else { left = clamp(r.left + r.width / 2 - w / 2, 10, vw - w - 10); top = Math.min(hb.bottom + 10, innerHeight - h - 10); }
      tip.classList.toggle('side', side);
      tip.style.left = left + 'px'; tip.style.top = top + 'px';
      tip.style.setProperty('--arrow', clamp(r.left + r.width / 2 - left, 16, w - 16) + 'px');
      tip.style.setProperty('--arrowY', clamp((hb.top + hb.bottom) / 2 - top, 14, h - 14) + 'px');
    };
    place2(); requestAnimationFrame(place2); setTimeout(place2, 700);
    window.addEventListener('resize', place2);
    const onKey = e => { if (e.key === 'Escape') gone(); };
    window.addEventListener('keydown', onKey, true);
    let tmr = 0;
    function gone() {
      clearTimeout(tmr); window.removeEventListener('resize', place2); window.removeEventListener('keydown', onKey, true);
      hand.remove(); if (Help._here === hand) Help._here = null;
      tip.classList.add('out'); setTimeout(() => tip.remove(), 300);
    }
    tip.addEventListener('click', e => { if (e.target.closest('[data-hch]')) gone(); });
    target.addEventListener('click', gone, { once: true });
    tmr = setTimeout(() => { if (tip.isConnected) gone(); }, 25000);
    setTimeout(() => { const b = tip.querySelector('[data-hch]'); if (b && tip.isConnected) b.focus({ preventScroll: true }); }, 900);
  }
  /** the listening intro is part of the welcome (its topic, with the earbuds) — no second window on the same start */
  const foldListenIntro = () => {
    try {
      const k = 'nk-listen-ui', s = JSON.parse(localStorage.getItem(k) || '{}') || {};
      if (!s.intro) localStorage.setItem(k, JSON.stringify(Object.assign(s, { intro: Date.now(), last: Date.now(), viaWelcome: 1 })));
    } catch (e) { /* private mode */ }
  };
  let wTimer = 0;
  /** the first start: wait for a calm main screen (after «Как вас зовут?» and other first windows), then the welcome */
  function welcomeLater() {
    if (state().welcomed || wTimer) return;
    foldListenIntro();
    let tries = 0, calm = 0;
    wTimer = setInterval(() => {
      tries++;
      if (state().welcomed) { clearInterval(wTimer); wTimer = 0; return; }
      // the app has started and asked «Как вас зовут?» (or knows the name) — the welcome never lands under that window
      const started = window.Store && Store.state && Store.settings && (Store.settings.userName || Store.state.askedName);
      const ok = started && window.App && App.view && App.view.name === 'home' && !modalOpen() && !T && !document.querySelector('.dark-screen, .dropdown-menu')
        && !(window.Listen && Listen.p) && !(window.Interp && Interp.on);
      calm = ok ? calm + 1 : 0;
      if (calm >= 2) { clearInterval(wTimer); wTimer = 0; Help.welcome(); }
      else if (tries > 600) { clearInterval(wTimer); wTimer = 0; } // 4 minutes: next start
    }, 400);
  }

  const Help = {
    TOURS, TOPICS,
    touring: false,
    open(id) {
      id = id ? alias(id) : null;
      patch({ opened: state().opened || Date.now() });
      document.querySelectorAll('.hc-dot').forEach(b => b.classList.remove('hc-dot'));
      document.querySelectorAll('.hc-hint:not(.hc-here)').forEach(x => x.remove());
      const old = document.querySelector('#modal-root .hc-modal');
      if (old) { const bd = old.closest('.modal-backdrop'); if (bd && bd._m) bd._m.close(); }
      const m = UI.modal({ title: '', cls: 'hc-modal', body: '<div data-hc></div>', foot: '<div class="hc-foot" data-hcfoot></div>', onClose: () => c.drop() });
      m.el.classList.add('hc-wide');
      const c = centre(m, {});
      if (id && topic(id)) c.showTopic(topic(id)); else c.showList();
      return m;
    },
    /** 👋 «Добро пожаловать в Norsk Kort!» — the topics as cards, a topic opens inside; closing flies into «?» */
    welcome() {
      patch({ welcomed: Date.now(), opened: state().opened || Date.now() });
      foldListenIntro();
      document.querySelectorAll('.hc-dot').forEach(b => b.classList.remove('hc-dot'));
      let finished = false;
      const finish = async () => {
        if (finished) return; finished = true;
        c.drop();
        const target = helpTarget();
        await flyInto(m, target);
        setTimeout(() => pointAtHelp(target), reduce() ? 0 : 60);
      };
      const m = UI.modal({
        title: '', cls: 'hc-modal hc-welcome', body: '<div data-hc></div>', foot: '<div class="hc-foot" data-hcfoot></div>',
        beforeClose: async () => {
          if (finished) return true;
          const ok = (await UI.askClose({ title: 'Закрыть знакомство?', line: 'Его всегда можно открыть снова — кнопка «?» «Как пользоваться».',
            actions: [{ label: 'Закрыть', value: 'close', cls: 'primary' }], cancel: 'Остаться' })) === 'close';
          if (ok) finish();
          return false;
        },
        onClose: () => { finished = true; c.drop(); },
      });
      m.el.classList.add('hc-wide');
      const c = centre(m, { welcome: true, onTour: () => { finished = true; } });
      c.showList();
      m.el.addEventListener('click', e => {
        if (e.target.closest('[data-hc-start]')) finish();
        else if (e.target.closest('[data-hc-wclose]')) m.tryClose();
      });
      Help._welcome = m;
      return m;
    },
    /** for checks and the settings: where the help lives now, with the hand */
    pointAtHelp(t) { pointAtHelp(t); },
    hand(el, o) { return makeHand(el, o); },
    handIcon(s) { return HAND_I(s); },
    /** «Показать подсказки снова»: every guide, intro and reminder of the app comes back */
    resetHints() {
      if (window.Guides) Guides.resetAll(); else { localStorage.removeItem(KEY); welcomeLater(); }
      UI.toast('Подсказки и приветственные окна снова будут показываться', 'good', 3500);
    },

    /* ---------------- the spotlight tour ---------------- */
    /** opts: { start: k — begin at step k (the screens of the steps before it are opened on the way), onEnd } */
    async tour(id, opts = {}) {
      const def = opts.def || TOURS[id]; if (!def || !def.steps || !def.steps.length) return;
      if (T) end();
      if (Help._here) Help._here.remove();
      document.querySelectorAll('.hc-here').forEach(x => x.remove());
      buildOverlay();
      let steps = def.steps;
      const start = Math.max(0, Math.min(steps.length - 1, opts.start | 0));
      const k = !start && def.from ? def.from() : 0;
      if (k > 0) steps = steps.slice(k);
      T.id = id || 'coach'; T.steps = steps; T.i = -1; T.onEnd = opts.onEnd; T.onShown = opts.onShown; T.coach = !!opts.coach;
      T.root.classList.toggle('coach', T.coach);
      this.touring = true;
      // an inviting start: «Покажу прямо на экране» with our hand, then the first step (or «Не сейчас»)
      if (opts.intro && !start && !reduce()) { if (!(await intro(steps.length))) { end('skip'); return; } }
      if (start > 0) {
        // a step from the middle: open what the steps before it open (and do what they do), without stopping there
        T.busy = true;
        for (let j = 0; j < start && T; j++) {
          const s = steps[j];
          bubbleBusy(`Открываю шаг ${start + 1}…`);
          try {
            if (s.go) { const ok = await s.go(); if (ok === false) { if (T) T.busy = false; end(); return; } }
            if (s.act && T) { const el = await waitFor(s.target, Math.min(s.timeout || 2500, 2500)); if (el && T) { s.act(el); await sleep(s.wait || 300); } }
          } catch (e) { console.warn('help: jump', e); }
        }
        if (!T) return;
        T.busy = false; T.i = start - 1; T.jump = true;
      }
      await go(1);
    },
    end() { end(); },
    /** for checks: where the tour is now */
    now() { return T ? { id: T.id, i: T.i, n: T.steps.length, busy: !!T.busy, el: T.el, title: (T.step && T.step.title) || '', coach: !!T.coach, intro: !!T.introOn } : null; },

    /**
     * 👆 Coach marks for any screen (first visits): the hand flies in and points at each element, with a bubble «Дальше / Понятно / Пропустить».
     *   Help.coach([{ target: '#listen-btn', title: '🎧 Слушать', text: 'Нажмите — …' }, …], { id: 'home', once: true, onEnd(how) {} })
     *   target — a selector, a list of selectors or a function → element (a missing one is skipped quietly; extra per step: go(), act(el), timeout).
     *   once — shown only once per device (remembered by id; Help.coachReset() or «Показать подсказки снова» brings it back).
     *   → Promise<boolean>: true when at least one mark was shown (how it ended: onEnd('done' | 'skip')).
     *   Nothing starts while a tour / another coach is running; then it resolves false (try again later).
     */
    coach(steps, o = {}) {
      const id = o.id ? String(o.id) : '';
      if (!Array.isArray(steps) || !steps.length) return Promise.resolve(false);
      if (o.once && id && this.coachSeen(id)) return Promise.resolve(false);
      if (T) return Promise.resolve(false);
      return new Promise(res => {
        let shown = false;
        const def = { steps: steps.filter(x => x && x.target).map(x => ({ target: x.target, title: x.title ? esc(x.title) : '', text: x.text ? esc(x.text) : '', go: x.go || null, act: x.act || null, wait: x.wait, timeout: x.timeout || 1500 })) };
        if (!def.steps.length) { res(false); return; }
        this.tour(null, { def, coach: true, intro: false,
          onShown: () => { shown = true; if (o.once && id) patch({ coach: Object.assign({}, state().coach, { [id]: Date.now() }) }); },
          onEnd: how => { res(shown); if (o.onEnd) { try { o.onEnd(how); } catch (e) { /* ignore */ } } } });
      });
    },
    /** has this coach (id) been shown already */
    coachSeen(id) { return !!(state().coach || {})[id]; },
    /** every coach shows again (id — only that one) */
    coachReset(id) { const c = Object.assign({}, state().coach); if (id) delete c[id]; patch({ coach: id ? c : {} }); if (!id || id === 'home') setTimeout(homeCoachLater, 300); },
  };

  /* ---------------- tour engine ---------------- */
  let T = null; // { root, hole, finger, bubble, steps, i, el, step, raf, last }
  const safe = () => {
    let p = document.getElementById('hl-safe');
    if (!p) { p = document.createElement('div'); p.id = 'hl-safe'; document.body.appendChild(p); }
    const cs = getComputedStyle(p);
    return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  };
  function buildOverlay() {
    const root = document.createElement('div');
    root.className = 'hl' + (reduce() ? ' still' : '');
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Подсказка на экране');
    root.innerHTML = `<div class="hl-hole"></div>
      <div class="hl-bubble" tabindex="-1" aria-live="polite">
        <div class="hl-top"><span class="hl-dots" data-hldots></span><button type="button" class="hl-x" data-hl="end" aria-label="Закрыть подсказку" title="Закрыть (Esc)">✕</button></div>
        <b class="hl-title" data-hltitle></b><div class="hl-text" data-hltext></div>
        <div class="hl-btns"><button type="button" class="btn sm ghost hl-skip" data-hl="end">Пропустить</button><button type="button" class="btn sm ghost hl-prev" data-hl="prev" aria-label="Назад">‹ <span>Назад</span></button><span class="grow"></span><button type="button" class="btn sm primary" data-hl="next">Дальше ›</button></div>
      </div>`;
    document.body.appendChild(root);
    const hand = makeHand(null, { manual: true, host: root, cls: 'hl-finger', size: 0.86, arrow: 'tap', flyIn: true });
    root.insertBefore(hand.node, root.querySelector('.hl-bubble'));
    T = { root, hole: root.querySelector('.hl-hole'), hand, finger: hand.node, bubble: root.querySelector('.hl-bubble'), prevFocus: document.activeElement, busy: false };
    root.addEventListener('click', onClick);
    window.addEventListener('keydown', onKey, true);
    const loop = () => { if (!T) return; place(); T.raf = requestAnimationFrame(loop); };
    T.raf = requestAnimationFrame(loop);
  }
  function end(how = 'skip') {
    if (!T) return;
    const t = T; T = null;
    clearTimeout(t.introT);
    if (t.introRes) t.introRes(false);
    Help.touring = false;
    cancelAnimationFrame(t.raf);
    window.removeEventListener('keydown', onKey, true);
    t.root.classList.add('out');
    setTimeout(() => t.root.remove(), reduce() ? 0 : 220);
    try { if (t.prevFocus && t.prevFocus.isConnected) t.prevFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    if (t.onEnd) t.onEnd(how);
  }
  function bubbleBusy(text) {
    if (!T) return;
    T.el = null;
    T.root.classList.add('searching');
    T.bubble.querySelector('[data-hltitle]').innerHTML = '<span class="spinner sm"></span> Секунду…';
    T.bubble.querySelector('[data-hltext]').textContent = text || 'Открываю нужный экран';
  }
  /** «Покажу прямо на экране»: our hand taps a «Дальше» button; starts by itself in a few seconds (any touch stops the countdown) */
  function intro(n) {
    return new Promise(res => {
      if (!T) { res(false); return; }
      const mins = n <= 4 ? 'меньше минуты' : 'около минуты';
      const card = document.createElement('div');
      card.className = 'hl-intro';
      card.innerHTML = `<div class="hl-intro-art" aria-hidden="true">
          <span class="hli-glow"></span><span class="hli-spark s1">✦</span><span class="hli-spark s2">✦</span><span class="hli-spark s3">✦</span>
          <span class="hli-btn">Дальше ›</span><span class="hli-ripple"></span>
          <span class="hli-hand">${HAND_SVG('hli-hand-svg')}</span></div>
        <b class="hl-intro-t">Покажу прямо на экране</b>
        <p class="hl-intro-p">${n} ${n % 10 === 1 && n % 100 !== 11 ? 'шаг' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'шага' : 'шагов'} · ${mins}. Подсвечу нужную кнопку, а рука покажет, куда нажать.</p>
        <div class="hl-intro-tips"><span>Нажимайте <b>«Дальше»</b> или на подсвеченное место</span><span class="kbd-only">Клавиши ← → и Esc</span></div>
        <div class="hl-intro-btns"><button type="button" class="btn ghost" data-hli="no">Не сейчас</button><button type="button" class="btn primary hl-go" data-hli="go"><span class="hl-go-fill" aria-hidden="true"></span><span class="hl-go-t">▶ Поехали</span></button></div>`;
      T.root.appendChild(card);
      T.root.classList.add('intro', 'searching');
      T.introOn = true;
      const stop = () => { clearTimeout(T && T.introT); card.classList.add('held'); };
      card.addEventListener('pointerdown', e => { if (!e.target.closest('[data-hli]')) stop(); });
      card.addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') stop(); });
      T.introRes = ok => {
        if (!T) { res(false); return; }
        clearTimeout(T.introT); T.introRes = null; T.introOn = false;
        T.root.classList.remove('intro');
        card.classList.add('out'); setTimeout(() => card.remove(), 260);
        res(ok);
      };
      T.introT = setTimeout(() => { if (T && T.introRes) T.introRes(true); }, 4200);
      setTimeout(() => { const g = card.querySelector('.hl-go'); if (g && T) g.focus({ preventScroll: true }); }, 60);
    });
  }
  /** move by d (+1 / −1): opens what the step needs, waits for its element; a missing element → the next step */
  async function go(d) {
    if (!T || T.busy) return;
    T.busy = true;
    const steps = T.steps, keepEl = T.el, keepStep = T.step;
    let i = T.i + d, skipped = 0;
    while (T && i >= 0 && i < steps.length) {
      const s = steps[i];
      bubbleBusy();
      try {
        // going back re-opens the step's screen; going forward too (it may have been closed meanwhile)
        let g = s.go;
        if (!g && d < 0) { for (let k = i - 1; k >= 0 && !g; k--) g = steps[k].go; }
        if (T.jump) T.jump = false; // a jump has opened everything already
        if (g) { const ok = await g(); if (ok === false) { if (T) T.busy = false; end(); return; } }
      } catch (e) { console.warn('help: step', e); }
      if (!T) return;
      const el = await waitFor(s.target, s.timeout || 3500);
      if (!T) return;
      if (el) { T.i = i; T.step = s; T.el = el; T.sel = s.target; show(el, s); T.busy = false; return; }
      skipped++;
      i += d;
    }
    if (!T) return;
    T.busy = false;
    if (T.i < 0) { const quiet = T.coach; end(); if (!quiet) UI.toast('Сейчас этого нет на экране — откройте раздел и нажмите «?» ещё раз', 'warn', 4500); return; }
    if (d > 0) end('done'); // past the last step
    else if (keepEl && keepEl.isConnected) { T.el = keepEl; T.step = keepStep; show(keepEl, keepStep); }
    else end();
    void skipped;
  }
  function show(el, s) {
    T.root.classList.remove('searching');
    const steps = T.steps, i = T.i;
    const last = !steps.slice(i + 1).length;
    T.bubble.querySelector('[data-hltitle]').innerHTML = s.title; // titles are ours (no user text)
    T.bubble.querySelector('[data-hltext]').innerHTML = typeof s.text === 'function' ? s.text(el) : s.text;
    T.bubble.querySelector('[data-hldots]').innerHTML = steps.map((x, k) => `<i class="${k === i ? 'on' : k < i ? 'done' : ''}"></i>`).join('') + `<span class="hl-n">${i + 1} из ${steps.length}</span>`;
    if (T.onShown && !T.shownOnce) { T.shownOnce = true; try { T.onShown(); } catch (e) { /* ignore */ } }
    T.bubble.querySelector('[data-hl="prev"]').disabled = i === 0;
    T.bubble.querySelector('[data-hl="prev"]').style.visibility = i === 0 ? 'hidden' : '';
    const nb = T.bubble.querySelector('[data-hl="next"]');
    nb.innerHTML = last ? 'Понятно ✓' : 'Дальше ›';
    T.bubble.querySelector('.hl-skip').hidden = !T.coach || last;
    T.bubble.classList.remove('pop'); void T.bubble.offsetWidth; T.bubble.classList.add('pop');
    T.finger.classList.remove('tap'); void T.finger.offsetWidth; T.finger.classList.add('tap'); // the press starts again
    // into view (inside scrolling windows too); the bubble needs room — so the middle of the screen
    const r = el.getBoundingClientRect(), sa = safe();
    if (r.top < sa.t + 60 || r.bottom > innerHeight - sa.b - 60 || r.left < 0 || r.right > innerWidth) {
      try { el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reduce() ? 'auto' : 'smooth' }); } catch (e) { el.scrollIntoView(); }
    }
    T.last = null;
    place();
    setTimeout(() => { if (T) nb.focus({ preventScroll: true }); }, 60);
    // a screen that has just opened may still be scrolling itself (to the top): bring the element back into view
    [650, 1300].forEach(ms => setTimeout(() => {
      if (!T || T.el !== el || !el.isConnected) return;
      const q = el.getBoundingClientRect();
      if (q.bottom < 40 || q.top > innerHeight - 40) { try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) { /* ignore */ } }
    }, ms));
  }
  /** hole over the element, finger pointing at it, bubble beside it — all inside the screen and the safe area */
  function place() {
    if (!T || !T.el) return;
    let el = T.el;
    if (!el.isConnected || !shown(el)) { const again = find(T.sel); if (!again) return; T.el = el = again; }
    const vw = document.documentElement.clientWidth || innerWidth, vh = innerHeight, sa = safe();
    const r = el.getBoundingClientRect();
    const key = [r.left, r.top, r.width, r.height, vw, vh, T.bubble.offsetHeight].map(Math.round).join(',');
    if (key === T.last) return;
    T.last = key;
    const pad = 6, top0 = sa.t + 4, bot0 = vh - sa.b - 4;
    const hole = { l: clamp(r.left - pad, sa.l + 2, vw - sa.r - 6), t: clamp(r.top - pad, top0, bot0 - 4), r: clamp(r.right + pad, sa.l + 6, vw - sa.r - 2), b: clamp(r.bottom + pad, top0 + 4, bot0) };
    const rad = Math.min(24, (parseFloat(getComputedStyle(el).borderTopLeftRadius) || 10) + pad);
    Object.assign(T.hole.style, { left: hole.l + 'px', top: hole.t + 'px', width: Math.max(8, hole.r - hole.l) + 'px', height: Math.max(8, hole.b - hole.t) + 'px', borderRadius: rad + 'px' });
    const cx = clamp((hole.l + hole.r) / 2, sa.l + 24, vw - sa.r - 24);
    // the hand: under the element pointing up; no room under it — above, pointing down (it never covers the bubble)
    const FH = Math.round(HAND_H * 0.86) - 4, roomB = bot0 - hole.b, roomT = hole.t - top0;
    const fBelow = roomB >= FH + 6 || roomB >= roomT;
    T.finger.classList.toggle('down', !fBelow);
    const tipY = fBelow ? Math.min(hole.b - 12, bot0 - FH) : Math.max(hole.t + 12, top0 + FH);
    T.hand.point(cx, tipY, fBelow ? 'up' : 'down');
    // the bubble: below / above / beside — never over the element when there is any room; always on screen
    const B = T.bubble;
    B.style.maxHeight = '';
    const bw = B.offsetWidth, gap = 12;
    let bh = B.offsetHeight;
    const fyB = fBelow ? FH - 10 : 0, fyA = fBelow ? 0 : FH - 10;
    const below = bot0 - (hole.b + fyB + gap), above = (hole.t - fyA - gap) - top0;
    const sideR = vw - sa.r - 8 - hole.r - gap, sideL = hole.l - gap - sa.l - 8;
    let x, y, arrow = '';
    const xMid = clamp(cx - bw / 2, sa.l + 8, vw - sa.r - 8 - bw);
    if (below >= bh) { x = xMid; y = hole.b + fyB + gap; arrow = 'up'; }
    else if (above >= bh) { x = xMid; y = hole.t - fyA - gap - bh; arrow = 'down'; }
    else if (sideR >= bw) { x = hole.r + gap; y = clamp((hole.t + hole.b) / 2 - bh / 2, top0 + 4, bot0 - bh - 4); }
    else if (sideL >= bw) { x = hole.l - gap - bw; y = clamp((hole.t + hole.b) / 2 - bh / 2, top0 + 4, bot0 - bh - 4); }
    else {
      // a very tall element (a whole card on a phone): the bigger side, the bubble scrolls inside if needed
      const useBelow = below >= above, room = Math.max(below, above);
      if (room >= 120) { B.style.maxHeight = room + 'px'; bh = Math.min(bh, room); y = useBelow ? hole.b + fyB + gap : hole.t - fyA - gap - bh; arrow = useBelow ? 'up' : 'down'; }
      else { bh = Math.min(bh, vh * 0.42); B.style.maxHeight = bh + 'px'; y = useBelow ? bot0 - bh - 4 : top0 + 4; }
      x = xMid;
    }
    y = clamp(y, top0 + 2, Math.max(top0 + 2, bot0 - bh - 2));
    x = clamp(x, sa.l + 8, Math.max(sa.l + 8, vw - sa.r - 8 - bw));
    B.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    B.dataset.arrow = arrow;
    B.style.setProperty('--ax', clamp(cx - x, 18, bw - 18) + 'px');
  }
  async function next() {
    if (!T || T.busy) return;
    const s = T.step, el = T.el;
    if (s && s.act && el) { try { s.act(el); } catch (e) { console.warn('help: act', e); } if (s.wait) { bubbleBusy(); await sleep(s.wait); } }
    if (!T) return;
    if (!T.steps.slice(T.i + 1).length) { end('done'); return; }
    go(1);
  }
  function onClick(e) {
    if (T && T.introRes) { const g = e.target.closest('[data-hli]'); if (g) { e.stopPropagation(); T.introRes(g.dataset.hli === 'go'); } return; }
    const b = e.target.closest('[data-hl]');
    if (b) { e.stopPropagation(); const a = b.dataset.hl; if (a === 'end') end(); else if (a === 'prev') go(-1); else next(); return; }
    if (e.target.closest('.hl-bubble')) return;
    // a tap on the lit element = «Дальше» (and does what the step says); elsewhere — the bubble waves
    const h = T && T.hole.getBoundingClientRect();
    if (h && e.clientX >= h.left && e.clientX <= h.right && e.clientY >= h.top && e.clientY <= h.bottom) { next(); return; }
    if (T) { T.bubble.classList.remove('wave'); void T.bubble.offsetWidth; T.bubble.classList.add('wave'); }
  }
  function onKey(e) {
    if (!T) return;
    const k = e.key;
    const inBubble = e.target && e.target.closest && e.target.closest('.hl-bubble');
    if (k === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); end(); return; }
    if (T.introRes) { // the intro card: Enter / → — let's go
      if (k === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); const bs = [...T.root.querySelectorAll('.hl-intro button')]; const at = bs.indexOf(document.activeElement); if (bs.length) bs[(at + (e.shiftKey ? -1 : 1) + bs.length) % bs.length].focus(); return; }
      e.stopImmediatePropagation();
      if (k === 'ArrowRight' || ((k === 'Enter' || k === ' ') && !(e.target.closest && e.target.closest('.hl-intro button')))) { e.preventDefault(); T.introRes(true); }
      return;
    }
    if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); e.stopImmediatePropagation(); next(); return; }
    if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); e.stopImmediatePropagation(); if (T.i > 0) go(-1); return; }
    if (k === 'Tab') { // focus stays in the bubble
      const bs = [...T.bubble.querySelectorAll('button:not(:disabled)')].filter(shown);
      if (!bs.length) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const at = bs.indexOf(document.activeElement);
      bs[(at + (e.shiftKey ? -1 : 1) + bs.length) % bs.length].focus();
      return;
    }
    if ((k === 'Enter' || k === ' ') && inBubble) { e.stopImmediatePropagation(); return; } // the focused button clicks itself
    // nothing else reaches the screen under the tour (Space would flip the card, keys would move the player)
    e.stopImmediatePropagation();
    if (k === 'Enter' || k === ' ') { e.preventDefault(); next(); }
  }

  /* ---------------- «?» everywhere: data-help clicks + small buttons added to the sections ---------------- */
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-help]');
    if (!b || b.closest('.hl')) return;
    e.preventDefault(); e.stopPropagation();
    Help.open(b.dataset.help || null);
  }, true);
  const qBtn = (t, extra = '') => {
    const tp = topic(alias(t));
    return `<button type="button" class="help-q ${extra}" data-help="${t}" aria-label="Как пользоваться: ${esc(tp ? tp.title : '')}" data-tip="Как это работает?">?</button>`;
  };
  /** [container selector, topic (or a function of the container), where] — «before» = before the window's ✕ */
  const SPOTS = [
    ['.modal.subs-modal > .modal-head', c => (c.closest('.modal').querySelector('.subs-radio') ? 'radio' : /второй экран/.test(c.textContent) ? 'second' : 'subs')],
    ['.modal.sv-modal > .modal-head', 'subview'], ['.modal.tv-modal > .modal-head', 'subview'],
    ['.modal.nrkr-modal > .modal-head', 'radio'], ['.modal.nrk-modal:not(.nrkr-modal) > .modal-head', 'video'], ['.modal.yt-modal > .modal-head', 'video'],
    ['.modal.tg-modal > .modal-head', 'telegram'], ['.modal.tgl-modal > .modal-head', 'telegram'],
    ['.modal.np-modal > .modal-head', 'listen'], ['.modal.lc-modal > .modal-head', 'listen'], ['.modal.listen-modal > .modal-head', 'listen'],
    ['.modal.tn-modal > .modal-head', 'ai'], ['.modal.create-modal > .modal-head', 'create'], ['.modal.klokka-modal > .modal-head', 'klokka'], ['.modal.fix-modal > .modal-head', 'fix'],
    ['.ip-panel > .ip-head', 'interp'], ['.study > .study-top', 'study', 'end'], ['#view > .deck-head', 'study', 'end'],
  ];
  function addButtons() {
    SPOTS.forEach(([sel, tp, where]) => {
      document.querySelectorAll(sel).forEach(c => {
        if (c.querySelector(':scope > .help-q')) return;
        const id = typeof tp === 'function' ? tp(c) : tp;
        const ref = where === 'end' ? null : c.querySelector(':scope > .modal-home, :scope > [data-close], :scope > [data-ip="min"]');
        const tmp = document.createElement('div'); tmp.innerHTML = qBtn(id, where === 'end' ? 'in-bar' : '');
        c.insertBefore(tmp.firstElementChild, ref);
      });
    });
  }
  let addT = 0;
  const watch = new MutationObserver(() => { if (!addT) addT = requestAnimationFrame(() => { addT = 0; addButtons(); }); });


  /* ---------------- the soft reminder: a dot on «?» until the help centre has been opened once ---------------- */
  function remind() {
    const s = state();
    if (!s.first) patch({ first: Date.now() });
    if (s.opened || (window.Guides && Guides.off('help-remind'))) return;
    const btn = () => (shown(document.getElementById('help-btn')) ? document.getElementById('help-btn') : document.getElementById('more-btn'));
    const b0 = btn(); if (b0) b0.classList.add('hc-dot');
    const now = Date.now();
    if (!s.first || now - s.first < 20 * 3600e3 || (s.shown || 0) >= 2 || (s.last && now - s.last < 20 * 3600e3)) return;
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > 90) { clearInterval(t); return; }
      if (!(App.view && App.view.name === 'home') || modalOpen() || T || document.querySelector('.lt-hint, .tgr-hint, .hc-hint')) return;
      const b = btn(); if (!b || !shown(b)) return;
      clearInterval(t);
      patch({ shown: (state().shown || 0) + 1, last: Date.now() });
      const tip = document.createElement('div');
      tip.className = 'hc-hint'; tip.setAttribute('role', 'status');
      tip.innerHTML = `<span class="hc-hint-txt"><span class="help-q demo" aria-hidden="true">?</span><span>Не знаете, где что? Здесь коротко обо всём — и я <b>покажу на экране</b>.</span></span>
        <span class="hc-hint-act"><button type="button" class="btn sm primary" data-hch="go">Открыть</button><button type="button" class="btn sm ghost" data-hch="no">Не сейчас</button></span>`;
      document.body.appendChild(tip);
      const place2 = () => {
        if (!tip.isConnected) return;
        const r = b.getBoundingClientRect(), w = tip.offsetWidth;
        const left = clamp(r.left + r.width / 2 - w / 2, 10, innerWidth - w - 10);
        tip.style.left = left + 'px'; tip.style.top = (r.bottom + 12) + 'px';
        tip.style.setProperty('--arrow', clamp(r.left + r.width / 2 - left, 16, w - 16) + 'px');
      };
      place2(); requestAnimationFrame(place2);
      window.addEventListener('resize', place2);
      const gone = () => { window.removeEventListener('resize', place2); tip.classList.add('out'); setTimeout(() => tip.remove(), 300); };
      tip.addEventListener('click', e => {
        const x = e.target.closest('[data-hch]'); if (!x) return;
        gone();
        if (x.dataset.hch === 'go') Help.open();
        else if (window.Guides) Guides.setOff('help-remind');
      });
      setTimeout(() => { if (tip.isConnected) gone(); }, 14000);
    }, 1000);
  }

  /* ---------------- 👆 the main screen's coach marks (the first visit) — an example of Help.coach ---------------- */
  const HOME_COACH = [
    { target: '#listen-btn', title: '🎧 Слушать', text: 'Карточки, книги, новости и радио — в наушниках или вслух. Можно с выключенным экраном.' },
    { target: ['#view [data-act="create"]'], title: '💬 Свои карточки', text: 'Напишите тему, вставьте список слов или сфотографируйте страницу — получится колода.' },
    { target: ['.tabbar .tab-study', '#view .qa-main[data-act="study-all"]', '#view [data-act="study-all"]'], title: '▶ Учить', text: 'Карточки на сегодня. Вспомнили — «Знаю», нет — «Не знаю». Когда повторить, приложение решит само.' },
    { target: () => helpTarget(), title: '❓ Как пользоваться', text: 'Здесь — все подсказки: короткие анимации к каждой теме и «Показать по шагам на экране».' },
  ];
  let hcT = 0;
  function homeCoachLater() {
    if (hcT || Help.coachSeen('home')) return;
    let tries = 0, calm = 0;
    hcT = setInterval(() => {
      tries++;
      if (Help.coachSeen('home') || tries > 900) { clearInterval(hcT); hcT = 0; return; } // ~10 minutes: next start
      const ok = state().welcomed && window.App && App.view && App.view.name === 'home' && !modalOpen() && !T && !Help._here && document.visibilityState === 'visible'
        && !document.querySelector('.dark-screen, .dropdown-menu, .hc-hint, .lt-hint, .tgr-hint, .nk-hint, .nk-here') && !(window.Listen && Listen.p) && !(window.Interp && Interp.on);
      calm = ok ? calm + 1 : 0;
      if (calm >= 4) { clearInterval(hcT); hcT = 0; Help.coach(HOME_COACH, { id: 'home', once: true }); }
    }, 700);
  }

  const boot = () => {
    handDefs();
    addButtons();
    watch.observe(document.body, { childList: true, subtree: true });
    if (!state().welcomed) foldListenIntro(); // before the listening intro looks (1.5 s): the welcome comes first
    setTimeout(() => { try { welcomeLater(); } catch (e) { console.warn('help welcome', e); } }, 600);
    setTimeout(() => { try { remind(); } catch (e) { console.warn('help remind', e); } }, 4000);
    setTimeout(() => { try { homeCoachLater(); } catch (e) { /* ignore */ } }, 1500);
  };
  // «Показать подсказки снова» (settings or the help centre): the welcome comes back on the next calm main screen
  document.addEventListener('hints-reset', () => setTimeout(() => { try { welcomeLater(); homeCoachLater(); } catch (e) { /* ignore */ } }, 300));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.Help = Help;
})();
