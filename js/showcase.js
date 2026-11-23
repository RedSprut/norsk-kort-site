/* ============ Norsk Kort — ✨ «Знакомство с приложением» (the showcase) ============
 * Own code (no libraries). A full-screen, cinematic tour in the style of the loading screen (js/preloader.js):
 * Norwegian photos behind, cards that fly, flip and light up — seven short scenes that show what the app can do
 * and why it helps to learn Norwegian fast. Plain warm Russian text, one idea per scene.
 *
 *  the first start (js/app.js): plays once, before «Как вас зовут?» — its last scene asks the name itself
 *    and the translation language (🇺🇦 / 🇷🇺 / both — saved on «Начать учиться»);
 *    then the usual «Добро пожаловать / Как пользоваться» window (js/help.js) follows as before.
 *  any time later: menu ⋯ → «✨ Знакомство с приложением», and the banner on top of «Как пользоваться».
 *    Closed half-way (someone called, the phone rang)? The place is kept — the first scene offers
 *    «↪ Продолжить с …», and the dots jump to any scene. The last scene changes the language at once.
 *
 *  Every scene can be touched (mouse + touch, pointer events): cards tilt, turn, flip and zoom (pinch, wheel),
 *  karaoke words speak and fly into a deck, the orbit spins with a finger, the levels show their words.
 *  Objects you can touch carry [data-touch]: only the empty stage swipes between scenes.
 *  A gentle «Потрогайте» hint once per scene per device (localStorage nk-showcase → hints).
 *
 *  ← → keys, swipe, dots; Esc / «Пропустить» close at once (nothing is lost: the place is saved).
 *  🔊 «Послушать» reads the scene aloud (Russian voice); Norwegian words have their own 🔊.
 *  prefers-reduced-motion: the same scenes as calm still pictures; touching still works (no inertia, spins or flights).
 *  Lives in #modal-root as a .modal-backdrop, so the other first-run windows wait until it is closed.
 */
(function () {
  'use strict';
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  const KEY = 'nk-showcase';
  const IMG = 'icons/preloader/';
  const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const st = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const patch = o => { try { localStorage.setItem(KEY, JSON.stringify(Object.assign(st(), o))); } catch (e) { /* private mode */ } };
  const say = (t, lang) => { try { if (window.TTS) { const p = TTS.speak(t, lang || 'no'); if (p && p.catch) p.catch(() => {}); } } catch (e) { /* no voice */ } };
  const hush = () => { try { if (window.TTS) TTS.stop(); } catch (e) { /* ignore */ } };
  const hand = () => (window.Help && Help.handIcon ? Help.handIcon(48) : '<span class="sc-hand-emoji">👆</span>');
  const handS = () => (window.Help && Help.handIcon ? Help.handIcon(18) : '👆');
  const plain = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------------- 🇺🇦 🇷🇺 the translation language ---------------- */
  const LANGS = [['uk', '🇺🇦 Українська'], ['ru', '🇷🇺 Русский'], ['both', '🇺🇦+🇷🇺 Оба']];
  const trNow = () => {
    try { if (window.Study && Study.trLang) return Study.trLang(); } catch (e) { /* below */ }
    const v = window.Store && Store.settings && Store.settings.transLang;
    return v === 'uk' || v === 'both' ? v : 'ru';
  };
  /** a short gloss in the chosen language (both: Ukrainian over Russian) */
  const gloss = (uk, ru, l) => (l === 'uk' ? `<i lang="uk">${uk}</i>` : l === 'both' ? `<i lang="uk">${uk}</i><i lang="ru" class="sc-g2">${ru}</i>` : `<i lang="ru">${ru}</i>`);
  /** both translations with their flags */
  const both = (uk, ru, cls) => `<span class="sc-tr2 ${cls || ''}"><span><span class="sc-fl">🇺🇦</span> <b lang="uk">${uk}</b></span><span><span class="sc-fl">🇷🇺</span> <b lang="ru">${ru}</b></span></span>`;
  const FLAGS = '<span class="sc-fl3" aria-hidden="true">🇳🇴<span>⇄</span>🇺🇦 🇷🇺</span>';

  /* the app's own icons (the same as on the loading screen) */
  const TG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#29a9eb"/><path d="M5.4 11.6 17 7.1c.6-.2 1 .1.9.9l-2 9.3c-.1.6-.6.8-1.1.5l-3-2.2-1.4 1.4c-.2.2-.3.3-.6.3l.2-3.1 5.6-5.1c.2-.2 0-.4-.4-.2l-6.9 4.4-3-.9c-.6-.2-.6-.6.1-.9z" fill="#fff"/></svg>';
  const AI = '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="sc-ai-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c3b5ff"/><stop offset="1" stop-color="#29c7ff"/></linearGradient></defs><path d="M10.5 2.5c.7 5 3.1 7.4 8.1 8.1-5 .7-7.4 3.1-8.1 8.1-.7-5-3.1-7.4-8.1-8.1 5-.7 7.4-3.1 8.1-8.1z" fill="url(#sc-ai-g)"/><path d="M18.6 14.6c.3 2.2 1.2 3.1 3.4 3.4-2.2.3-3.1 1.2-3.4 3.4-.3-2.2-1.2-3.1-3.4-3.4 2.2-.3 3.1-1.2 3.4-3.4z" fill="#ffd75e"/></svg>';
  const TV = () => (window.UI && UI.TV_SVG ? UI.TV_SVG(22) : '📺');
  const SAY = (w, label) => `<button type="button" class="sc-say" data-say="${esc(w)}" aria-label="Послушать: ${esc(label || w)}" title="Послушать по-норвежски">🔊</button>`;

  /* ---------------- 🖐 touching: one helper for the mouse and fingers ---------------- */
  /**
   * Pointer gestures on el. One pointer drags, two pinch and turn; the pointer is captured only once it really moves
   * (a still press stays a click on the element under it). el gets [data-touch]: the scene swipe never starts on it.
   * h: { down(), move({dx, dy, x, y}), pinchStart(), pinch({s, a}), up({moved, vx, vy, dx, dy}), hover(e), leave() }
   * o: { inner: also start on buttons inside el }
   */
  function gest(el, h, o = {}) {
    el.setAttribute('data-touch', '');
    const P = new Map();
    let sx = 0, sy = 0, px = 0, py = 0, moved = false, g0 = null, vx = 0, vy = 0, lt = 0;
    const two = () => { const [a, b] = [...P.values()]; return { d: Math.hypot(b.x - a.x, b.y - a.y) || 1, a: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI }; };
    const cap = id => { try { el.setPointerCapture(id); } catch (e) { /* gone */ } };
    el.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      const ib = e.target.closest && e.target.closest('button, input, label, [data-say]');
      if (!o.inner && ib && ib !== el && el.contains(ib)) return;
      P.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (P.size === 1) { sx = px = e.clientX; sy = py = e.clientY; moved = false; vx = vy = 0; lt = performance.now(); if (h.down) h.down(e); }
      else if (P.size === 2) { moved = true; [...P.keys()].forEach(cap); g0 = two(); if (h.pinchStart) h.pinchStart(); }
    });
    el.addEventListener('pointermove', e => {
      const p = P.get(e.pointerId);
      if (!p) { if (e.pointerType === 'mouse' && !e.buttons && h.hover) h.hover(e); return; }
      p.x = e.clientX; p.y = e.clientY;
      if (P.size >= 2) { if (h.pinch && g0) { const g = two(); let a = g.a - g0.a; a = ((a + 540) % 360) - 180; h.pinch({ s: g.d / g0.d, a }); } return; }
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.hypot(dx, dy) > 6) { moved = true; cap(e.pointerId); }
      if (!moved) return;
      const t = performance.now(), dt = Math.max(8, t - lt);
      vx = vx * .4 + (e.clientX - px) / dt * .6; vy = vy * .4 + (e.clientY - py) / dt * .6; lt = t; px = e.clientX; py = e.clientY;
      if (h.move) h.move({ dx, dy, x: e.clientX, y: e.clientY });
    });
    const up = e => {
      if (!P.has(e.pointerId)) return;
      P.delete(e.pointerId);
      if (P.size === 1) { const [q] = P.values(); sx = px = q.x; sy = py = q.y; g0 = null; if (h.down) h.down(e, true); return; } // pinch → one finger goes on
      if (P.size) return;
      if (moved) el._nkDragAt = Date.now();
      if (performance.now() - lt > 90) { vx = 0; vy = 0; } // held still before letting go: no throw
      if (h.up) h.up({ moved, vx, vy, dx: e.clientX - sx, dy: e.clientY - sy, cancel: e.type === 'pointercancel' });
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', e => { if (!P.size && e.pointerType === 'mouse' && h.leave) h.leave(); });
  }
  const dragged = el => Date.now() - (el._nkDragAt || 0) < 350;
  /** a tap (not the end of a drag) or Enter / Space on el; inner 🔊 buttons keep their own click */
  function press(el, fn) {
    el.addEventListener('click', e => {
      const sv = e.target.closest('[data-say], .sc-lens-bar button');
      if (sv && sv !== el) return;
      if (dragged(el)) { e.preventDefault(); return; }
      fn(e);
    });
    if (el.tagName !== 'BUTTON') el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === el) { e.preventDefault(); fn(e); } });
  }

  /* ---------------- the scenes' words ---------------- */
  // [photo, Norwegian, Ukrainian, Russian, place in the fan, what is said aloud]
  const HELLO = [['fjord', 'fjord', 'фіорд', 'фьорд', -2], ['hytte', 'hytte', 'будиночок', 'домик', -1], ['lofoten', 'velkommen', 'ласкаво просимо', 'добро пожаловать', 0, 'Velkommen!'],
    ['nordlys', 'nordlys', 'північне сяйво', 'северное сияние', 1], ['bryggen', 'takk', 'дякую', 'спасибо', 2]];
  // 🃏 the demo deck: one after another after a grade
  const DECK = [
    { img: 'hytte', no: 'en hytte', uk: 'будиночок, дача', ru: 'домик, дача', ex: 'Vi har en hytte på fjellet.', exUk: 'У нас є будиночок у горах.', exRu: 'У нас домик в горах.' },
    { img: 'vinterskog', no: 'en skog', uk: 'ліс', ru: 'лес', ex: 'Vi går tur i skogen.', exUk: 'Ми гуляємо в лісі.', exRu: 'Мы гуляем в лесу.' },
    { img: 'stavkirke', no: 'en kirke', uk: 'церква', ru: 'церковь', ex: 'Kirken er veldig gammel.', exUk: 'Церква дуже стара.', exRu: 'Церковь очень старая.' },
    { img: 'snohytte', no: 'snø', uk: 'сніг', ru: 'снег', ex: 'Det ligger snø på taket.', exUk: 'На даху лежить сніг.', exRu: 'На крыше лежит снег.' },
  ];
  const GRADES = [['again', 'Снова', 'через 10 минут'], ['hard', 'Трудно', 'завтра'], ['good', 'Хорошо', 'через 4 дня'], ['easy', 'Легко', 'через 10 дней']];
  // 🎬 [Norwegian, Ukrainian, Russian]
  const KARA = [['Jeg', 'я', 'я'], ['lærer', 'вчу', 'учу'], ['norsk', 'норвезьку', 'норвежский'], ['hver', 'кожен', 'каждый'], ['dag', 'день', 'день']];
  const KARA_UK = 'Я вчу норвезьку щодня.', KARA_RU = 'Я учу норвежский каждый день.';
  // 🧭 [icon, name, one line]
  const ORB = [['📚', 'Книги', 'Книги и тексты: нажмите на слово — увидите перевод.'], [TG, 'Telegram', 'Норвежские каналы: слова, фразы и картинки — в карточки.'],
    ['📰', 'Новости', 'Новости Норвегии простым языком — с переводом.'], ['🗣', 'Произношение', 'Скажите слово вслух — приложение послушает и подскажет.'],
    ['📝', 'Экзамен', 'Тесты, как на экзамене Norskprøve.'], ['🕐', 'Время', 'Klokka: «halv fire» — это 3:30. Урок с часами и игры.'],
    ['📷', 'С фото', 'Сфотографируйте страницу учебника — слова станут карточками.'], ['📖', 'Грамматика', 'Правила простыми словами, с примерами.'],
    ['🎧', 'Аудиокурсы', 'Уроки в наушниках — даже с выключенным экраном.'], ['🎬', 'Видео', 'NRK и YouTube с субтитрами: слово — в карточку одним нажатием.']];
  /* 🎨 «Учиться красиво»: the app's own art — theme postcards (js/apptheme.js) and art cards (js/artcards.js + artcards-no.js) */
  // [theme, its big picture, light / dark postcard, picture colours]
  const POSTCARDS = [['troll', 'troll', 'light'], ['viking', 'longship', 'light'], ['stavkirke', 'church', 'light'], ['fjellhytte', 'cabin', 'dark'], ['elg', 'elgsign', 'light'],
    ['lofoten', 'rorbu', 'light'], ['kongelig', 'crown', 'dark'], ['skog', 'mushrooms', 'light'], ['gammel', 'album', 'light']];
  const ARTDEMO = [
    { id: 'sc-demo-troll', theme: 'troll', no: 'et troll', ru: 'тролль', example: 'Trollet bor i fjellet.', exampleRu: 'Тролль живёт в горах.' },
    { id: 'sc-demo-viking', theme: 'viking', no: 'et vikingskip', ru: 'корабль викингов', example: 'Vikingene seilte over havet.', exampleRu: 'Викинги плыли через море.' },
    { id: 'sc-demo-kongelig', theme: 'kongelig', no: 'en konge', ru: 'король', example: 'Kongen vinker til folket.', exampleRu: 'Король машет народу.' },
  ];
  /** one theme postcard: the theme's colours, its background layer and its big picture, the name and the Norwegian name */
  function postcard([id, pic, m]) {
    const A = window.AppThemes, t = A && A.get(id);
    if (!t) return '';
    const p = A.palette(id, m), pat = A.art.pattern(id, m);
    const layer = pat ? `background-image:${pat.img};background-size:${pat.sw ? pat.sw.size : pat.size};background-position:${pat.sw ? pat.sw.pos : pat.pos};background-repeat:${pat.sw ? pat.sw.rep : pat.rep};opacity:${pat.op}` : '';
    return `<span class="sc-pc" style="--pb:${p.bg};--pb2:${p.bg2};--pt:${p.text};--pm:${p.muted};--pa:${p.accent};--pg:${p.blobs[0] || p.fx[0]};--ps:${p.solid}">
        ${pat ? `<span class="sc-pc-pat" style="${esc(layer)}"></span>` : ''}<span class="sc-pc-pic">${A.art.svg(pic, {}, ' aria-hidden="true" focusable="false"')}</span>
        <span class="sc-pc-cap"><b>${esc(t.name)}</b><i lang="nb">${esc(t.no)}</i></span></span>`;
  }
  /** a read-only art card in a Norwegian template (the user's own look is not touched: the look is passed in) */
  function artCard(c) {
    const AC = window.ArtCards;
    try {
      if (AC && AC.faceHtml && AC.scope && AC.THEMES && AC.THEMES[c.theme]) {
        const lk = Object.assign({}, AC.DEFAULT_LOOK || { font: 'theme', weight: 800, italic: false, size: 100, track: 0, width: 100, text: '', accent: '', fx: 'shadow', grade: true }, { theme: c.theme, font: 'theme' });
        const s = AC.scope(lk);
        if (AC.ensureFonts) AC.ensureFonts();
        return `<span class="sc-artc ${s.cls}" style="${esc(s.style)}" inert>${AC.faceHtml(c, 'back', 'tr', { base: lk })}</span>`;
      }
    } catch (e) { /* drawn below instead */ }
    // without the art cards: the same template drawn with the theme's own picture
    const pc = POSTCARDS.find(x => x[0] === c.theme) || POSTCARDS[0];
    return `<span class="sc-artc sc-artc-fb" inert>${postcard([c.theme, pc[1], 'dark'])}<span class="sc-artc-w"><small>${esc(c.ru)}</small><b lang="nb">${esc(c.no)}</b></span></span>`;
  }
  const LEVELS = [['A1', 'первые слова'], ['A2', 'быт и общение'], ['B1', 'работа и жизнь'], ['B2', 'свободный разговор'], ['C1', 'тонкости языка'], ['C2', 'как родной']];
  // three words of each level: [Norwegian, Ukrainian, Russian]
  const LVW = [
    [['et hus', 'будинок', 'дом'], ['vann', 'вода', 'вода'], ['takk', 'дякую', 'спасибо']],
    [['en venn', 'друг', 'друг'], ['å handle', 'робити покупки', 'делать покупки'], ['billig', 'дешевий', 'дешёвый']],
    [['en søknad', 'заява', 'заявление'], ['erfaring', 'досвід', 'опыт'], ['likevel', 'все ж таки', 'всё же']],
    [['bærekraftig', 'сталий', 'устойчивый'], ['å påvirke', 'впливати', 'влиять'], ['en forutsetning', 'передумова', 'условие']],
    [['tvetydig', 'двозначний', 'двусмысленный'], ['å gjenspeile', 'відображати', 'отражать'], ['et forbehold', 'застереження', 'оговорка']],
    [['å tilsløre', 'приховувати', 'скрывать'], ['lunefull', 'примхливий', 'капризный'], ['en floskel', 'банальність', 'банальность']],
  ];
  // 🤖 why the two rows were fixed (one short sentence each)
  const WHY = {
    1: '«Быть» — это å være, а å bli значит «становиться» или «оставаться».',
    3: 'Å glede seg til — радоваться заранее: «Jeg gleder meg til sommeren» — жду лета с радостью.',
  };

  /* ---------------- 🔍 a card brought close: turn it, zoom it, flip it ---------------- */
  /**
   * The card comes out of its place to the middle of the picture (inside the picture's box). One finger / the mouse turns it
   * in 3D, two fingers zoom and turn it, the wheel (or a trackpad pinch) zooms, a tap flips it (when it has a back),
   * a double tap or ↺ puts it back as it was, a tap beside it / ✕ / Esc returns it to its place.
   * o: { front, back (html or ''), label, cls }
   */
  function lens(api, art, src, o) {
    const old = art.querySelector('.sc-lens'); if (old && old._close) old._close(true);
    const L = document.createElement('div');
    L.className = 'sc-lens ' + (o.cls || '');
    L.innerHTML = `<div class="sc-lens-bg"></div>
      <div class="sc-lens-card" tabindex="0" role="button" aria-label="${esc(o.label)}">
        <div class="sc-lens-in"><div class="sc-lf front">${o.front}</div>${o.back ? `<div class="sc-lf back" inert>${o.back}</div>` : ''}</div></div>
      <div class="sc-lens-bar"><button type="button" class="sc-lbtn" data-l="reset" title="Повернуть" aria-label="Повернуть">↻</button><button type="button" class="sc-lbtn" data-l="close" title="Вернуть на место" aria-label="Вернуть на место">✕</button></div>
      <span class="sc-lens-tip" aria-hidden="true">${o.back ? 'Нажмите — перевернётся · ' : ''}потяните — повернётся · ${matchMedia('(pointer: coarse)').matches ? 'двумя пальцами — ближе' : 'колёсико — ближе'}</span>`;
    art.appendChild(L);
    const card = L.querySelector('.sc-lens-card'), inn = L.querySelector('.sc-lens-in');
    const fr = L.querySelector('.sc-lf.front'), bk = L.querySelector('.sc-lf.back');
    const S = { s: 1, rx: 0, ry: 0, rz: 0, fl: 0 };
    let base = Object.assign({}, S), lastTap = 0, closing = false, watch = 0, isBack = null;
    const side = back => { if (back === isBack) return; isBack = back; bk.inert = !back; fr.inert = back; card.classList.toggle('on-back', back); };
    /** while the card turns by itself (a css transition — a flip, ↺, the arrow keys, flying home), watch the angle it is
     *  really drawn at, frame by frame, and switch the far side off at the very moment it is edge-on. A fixed delay cannot:
     *  a flip reversed half-way or ↺ from a dragged angle passes edge-on at other times (Safari then showed a blank card). */
    const follow = () => {
      cancelAnimationFrame(watch);
      const t0 = performance.now();
      const step = () => {
        let back = isBack;
        try { const tr = getComputedStyle(inn).transform; back = tr && tr !== 'none' ? new DOMMatrixReadOnly(tr).m33 < 0 : false; } catch (e) { /* keep the side */ }
        side(back);
        const busy = inn.getAnimations ? inn.getAnimations().length > 0 : performance.now() - t0 < 900;
        watch = busy || performance.now() - t0 < 120 ? requestAnimationFrame(step) : 0;
      };
      watch = requestAnimationFrame(step);
    };
    const apply = () => {
      card.style.transform = `translate(-50%, -50%) scale(${S.s.toFixed(3)}) rotate(${S.rz.toFixed(1)}deg)`;
      inn.style.transform = `rotateX(${S.rx.toFixed(1)}deg) rotateY(${(S.ry + S.fl * 180).toFixed(1)}deg)`;
      if (bk) { // the side you see takes the keyboard focus, the other is asleep (and hidden — see .on-back in the css)
        if (card.classList.contains('drag')) { cancelAnimationFrame(watch); watch = 0; const a = (S.ry + S.fl * 180) * Math.PI / 180, b = S.rx * Math.PI / 180; side(Math.cos(a) * Math.cos(b) < 0); }
        else follow(); // turning by itself (a transition): switch sides exactly when it passes edge-on
      }
      // the round button: «⟳ Повернуть» while the card is as it was, «↺ Как было» once it is turned / zoomed
      const rb = L.querySelector('[data-l="reset"]');
      if (rb) { const rest = atRest(); rb.textContent = rest ? '↻' : '↺'; rb.title = rest ? 'Повернуть' : 'Как было'; rb.setAttribute('aria-label', rb.title); }
    };
    const atRest = () => Math.abs(S.s - 1) < .01 && !S.rx && !(S.ry % 360) && !S.rz && !S.fl;
    const anim = on => card.classList.toggle('drag', !on);
    // fly out of the source card
    const sr = src.getBoundingClientRect(), ar = art.getBoundingClientRect();
    src.classList.add('sc-away');
    if (!api.rm) {
      const k = sr.width / (card.offsetWidth || 1), dx = sr.left + sr.width / 2 - (ar.left + ar.width / 2), dy = sr.top + sr.height / 2 - (ar.top + ar.height / 2);
      anim(false);
      card.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(${k.toFixed(3)})`;
      void card.offsetWidth;
      anim(true);
    }
    L.classList.add('in');
    apply();
    const flip = () => { if (!bk) { // no back: a little nod
        if (api.rm) return; card.classList.add('nod'); api.U(() => card.classList.remove('nod'), 450); return; }
      anim(true); S.fl = S.fl ? 0 : 1; apply(); };
    const reset = () => { anim(true); Object.assign(S, { s: 1, rx: 0, ry: 0, rz: 0, fl: 0 }); apply(); };
    /** ⟳: as it was → show it turning (to its back when it has one, else a full turn round); turned → back as it was */
    const turnBtn = () => {
      if (!atRest()) { reset(); return; }
      if (bk) { flip(); return; }
      if (api.rm) { flip(); return; } // reduced motion: just the little nod
      anim(true); S.ry = 360; apply();
      api.U(() => { if (S.ry === 360) { anim(false); S.ry = 0; apply(); void card.offsetWidth; anim(true); } }, 760);
    };
    const close = now => {
      if (closing) return; closing = true;
      api.onEsc(null);
      L.classList.remove('in'); L.classList.add('out');
      const done = () => { L.remove(); src.classList.remove('sc-away'); if (!now && src.focus) { try { src.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } };
      if (now || api.rm) { done(); }
      else {
        const r2 = src.getBoundingClientRect(), a2 = art.getBoundingClientRect();
        const k = r2.width / (card.offsetWidth || 1), dx = r2.left + r2.width / 2 - (a2.left + a2.width / 2), dy = r2.top + r2.height / 2 - (a2.top + a2.height / 2);
        anim(true);
        inn.style.transform = 'none';
        if (bk) follow(); // turning back to its front on the way home: the front shows again as it passes edge-on
        card.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(${k.toFixed(3)})`;
        setTimeout(done, 420);
      }
      if (o.onClose) o.onClose();
    };
    L._close = close;
    api.onEsc(() => { close(); return true; });
    gest(card, {
      down() { base = Object.assign({}, S); anim(false); },
      move(d) { S.ry = base.ry + d.dx * .45; S.rx = clamp(base.rx - d.dy * .45, -75, 75); apply(); },
      pinchStart() { base = Object.assign({}, S); anim(false); },
      pinch(g) { S.s = clamp(base.s * g.s, .6, 2.6); S.rz = base.rz + g.a; apply(); },
      up() { anim(true); },
    });
    press(card, () => {
      const now = Date.now();
      if (now - lastTap < 330) { lastTap = 0; reset(); return; }
      lastTap = now; flip();
    });
    card.addEventListener('keydown', e => {
      const k = e.key; let used = true;
      anim(true);
      if (k === 'ArrowLeft') S.ry -= 20; else if (k === 'ArrowRight') S.ry += 20;
      else if (k === 'ArrowUp') S.rx = clamp(S.rx + 15, -75, 75); else if (k === 'ArrowDown') S.rx = clamp(S.rx - 15, -75, 75);
      else if (k === '+' || k === '=') S.s = clamp(S.s * 1.15, .6, 2.6); else if (k === '-') S.s = clamp(S.s / 1.15, .6, 2.6);
      else if (k === '0') { reset(); } else used = false;
      if (used) { e.preventDefault(); e.stopPropagation(); apply(); }
    });
    card.addEventListener('wheel', e => {
      e.preventDefault();
      anim(false);
      S.s = clamp(S.s * Math.exp(-e.deltaY * (e.ctrlKey ? .012 : .0018)), .6, 2.6); apply();
      clearTimeout(card._wt); card._wt = setTimeout(() => anim(true), 160);
    }, { passive: false });
    L.querySelector('.sc-lens-bg').addEventListener('click', () => close());
    L.querySelector('.sc-lens-bg').setAttribute('data-touch', '');
    L.setAttribute('data-touch', '');
    L.querySelector('.sc-lens-bar').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (!b) return; if (b.dataset.l === 'reset') turnBtn(); else close(); });
    setTimeout(() => { try { card.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
    return { close, flip, reset, card };
  }

  /* ---------------- the scenes ---------------- */
  const SCENES = [
    {
      id: 'hello', bg: 'lofoten', emoji: '👋', label: 'Добро пожаловать',
      title: '<span lang="nb">Velkommen!</span> Добро пожаловать',
      text: 'Norsk Kort — ваш помощник в норвежском языке. Здесь всё устроено так, чтобы вы заговорили по-норвежски как можно быстрее — и с удовольствием. За одну минуту покажу самое главное.',
      points: ['⏱ Хватает 10–15 минут в день', '🇺🇦🇷🇺 Перевод на украинский или русский — на выбор', '📴 Работает и без интернета'],
      hint: ['.sc-c.mid', 'Потрогайте карточку'],
      art: c => `<div class="sc-fan">${HELLO.map(([img, no, uk, ru, k, sv], i) => `<div class="sc-c ${k === 0 ? 'mid' : ''}" data-i="${i}" role="button" tabindex="0" aria-label="${esc(no)} — ${esc(uk)}, ${esc(ru)}. Открыть карточку крупно" style="--x:${k * 17};--y:${Math.abs(k) * 3.4};--r:${k * 8}deg;--d:${120 + i * 110}ms;--z:${10 - Math.abs(k)}">
          <div class="sc-cc"><img src="${IMG}${img}.webp" alt="" draggable="false" decoding="async"><span class="sc-ccap"><b lang="nb">${no}</b>${gloss(uk, ru, c.gl)}</span>${k === 0 ? SAY(sv || no, no) : ''}</div></div>`).join('')}</div>
        <div class="sc-flags" aria-hidden="true">🇳🇴<span>⇄</span>🇺🇦<em>🇷🇺</em></div>`,
      wire(el, api) {
        const art = el.querySelector('.sc-art');
        el.querySelectorAll('.sc-c').forEach(c => {
          const cc = c.querySelector('.sc-cc'), d = HELLO[+c.dataset.i];
          const tilt = (x, y, spring) => { cc.classList.toggle('spring', !!spring); cc.style.transform = x || y ? `perspective(calc(var(--u) * 120)) rotateX(${y.toFixed(1)}deg) rotateY(${x.toFixed(1)}deg) scale(1.05)` : ''; };
          gest(c, {
            down() { c.classList.add('lift'); },
            move(m) { tilt(clamp(m.dx * .4, -45, 45), clamp(-m.dy * .4, -45, 45)); },
            up() { tilt(0, 0, true); setTimeout(() => c.classList.remove('lift'), 300); },
            hover(e) { const r = c.getBoundingClientRect(); c.classList.add('lift'); tilt(((e.clientX - r.left) / r.width - .5) * 26, -((e.clientY - r.top) / r.height - .5) * 26); },
            leave() { tilt(0, 0, true); c.classList.remove('lift'); },
          });
          press(c, () => {
            tilt(0, 0); c.classList.remove('lift');
            lens(api, art, c, {
              label: `Карточка ${d[1]}. Нажмите — перевернётся`,
              front: `<img src="${IMG}${d[0]}.webp" alt="" draggable="false"><span class="sc-ccap"><b lang="nb">${d[1]}</b>${gloss(d[2], d[3], api.gl)}</span>`,
              back: `<span class="sc-lb-no" lang="nb">${d[1]}</span>${SAY(d[5] || d[1], d[1])}${both(d[2], d[3])}<span class="sc-lb-tip">нажмите — перевернётся обратно</span>`,
            });
          });
        });
      },
    },
    {
      id: 'cards', bg: 'hytte', emoji: '🃏', label: 'Умные карточки',
      title: 'Умные карточки',
      text: 'Приложение само помнит, когда повторить каждое слово — как раз перед тем, как оно начнёт забываться. Поэтому короткие занятия каждый день дают больше, чем час зубрёжки.',
      points: ['📸 Фото, звук и пример к каждому слову', '🪜 Готовые колоды по уровням и темам', '✨ Карточки из любого текста, фото или видео'],
      hint: ['.sc-flip', 'Нажмите или потяните'],
      art: () => `<div class="sc-flip" role="button" tabindex="0" aria-label="Карточка — нажмите, чтобы перевернуть"><div class="sc-flip-in"><div class="sc-face front"></div><div class="sc-face back"></div></div></div>
        <div class="sc-grades" role="group" aria-label="Как вы вспомнили слово? Для примера">${GRADES.map(([c, t, w], i) => `<button type="button" class="g ${c}" data-g="${i}" title="Следующий повтор — ${w}">${t}<span class="sc-gchip" aria-hidden="true">${w}</span></button>`).join('')}<span class="sc-hand" aria-hidden="true">${hand()}</span></div>
        <div class="sc-plan" aria-live="polite"><span>Следующий повтор:</span>${GRADES.map(([c, t, w], i) => `<i class="${c}" data-r="${i}"><b>${t}</b> ${w}</i>`).join('')}</div>`,
      still: el => { el._sc.face(0); el.querySelector('.sc-flip').classList.add('flipped'); el.querySelector('.sc-grades').classList.add('aim', 'tap'); el._sc.light(2); },
      pause: el => { const g = el.querySelector('.sc-grades'); if (g) g.classList.remove('aim', 'tap'); },
      run(el, T) {
        const flip = el.querySelector('.sc-flip'), gr = el.querySelector('.sc-grades');
        const loop = () => {
          el._sc.face(); flip.classList.remove('flipped'); gr.classList.remove('aim', 'tap'); el._sc.light(-1);
          T(() => flip.classList.add('flipped'), 1500);
          T(() => gr.classList.add('aim'), 2500);
          T(() => { gr.classList.add('tap'); el._sc.grade(2, T); }, 3200);
          T(() => gr.classList.remove('aim', 'tap'), 4300);
          T(loop, 6400);
        };
        loop();
      },
      wire(el, api) {
        const flip = el.querySelector('.sc-flip'), inn = flip.querySelector('.sc-flip-in');
        const fF = flip.querySelector('.front'), fB = flip.querySelector('.back');
        const gb = [...el.querySelectorAll('.sc-grades .g')], rows = [...el.querySelectorAll('.sc-plan i')];
        let n = 0;
        const face = k => {
          if (k != null) n = k;
          const c = DECK[n % DECK.length], l = api.gl;
          fF.innerHTML = `<img src="${IMG}${c.img}.webp" alt="" draggable="false" decoding="async"><span class="sc-fword"><b lang="nb">${c.no}</b>${SAY(c.no)}</span>`;
          fB.innerHTML = `<span class="sc-back-no" lang="nb">${c.no}</span>${l === 'both' ? both(c.uk, c.ru, 'big') : `<b lang="${l}">${l === 'uk' ? c.uk : c.ru}</b>`}
            <span class="sc-ex"><span lang="nb">${c.ex}</span>${l === 'both' ? `<i lang="uk">🇺🇦 ${c.exUk}</i><i lang="ru">🇷🇺 ${c.exRu}</i>` : `<i lang="${l}">${l === 'uk' ? c.exUk : c.exRu}</i>`}</span>`;
          fB.classList.toggle('two', l === 'both');
          flip.setAttribute('aria-label', `Карточка ${c.no} — нажмите, чтобы перевернуть`);
          sync();
        };
        const sync = () => { const b = flip.classList.contains('flipped'); fF.inert = b; fB.inert = !b; flip.setAttribute('aria-pressed', String(b)); };
        const light = k => rows.forEach((r, j) => r.classList.toggle('in', j === k || k === 'all'));
        const turn = () => { flip.classList.toggle('flipped'); sync(); };
        let busy = 0;
        const grade = (k, TT) => {
          const tm = TT || api.U;
          gb.forEach((b, j) => b.classList.toggle('pop', j === k));
          light(k);
          tm(() => gb[k].classList.remove('pop'), 1500);
          if (!flip.classList.contains('flipped')) { flip.classList.add('flipped'); sync(); }
          clearTimeout(busy);
          busy = tm(() => { // this word is done — the next one comes
            if (api.rm) { flip.classList.remove('flipped'); face(n + 1); return; }
            flip.classList.add('gone');
            tm(() => { flip.classList.add('drag'); flip.classList.remove('flipped', 'gone'); face(n + 1); flip.classList.add('back-in'); void flip.offsetWidth; flip.classList.remove('drag', 'back-in'); }, 380);
          }, 900);
        };
        el._sc = { face, grade, light };
        face(0);
        // a tap flips, a drag tilts, a flick up flips
        gest(flip, {
          down() { api.poke(); flip.classList.add('drag'); },
          move(d) { inn.style.setProperty('--tx', clamp(-d.dy * .3, -35, 35).toFixed(1) + 'deg'); inn.style.setProperty('--ty', clamp(d.dx * .35, -40, 40).toFixed(1) + 'deg'); },
          up(i) { flip.classList.remove('drag'); inn.style.removeProperty('--tx'); inn.style.removeProperty('--ty'); if (i.moved && i.dy < -45 && Math.abs(i.dy) > Math.abs(i.dx)) turn(); },
        });
        press(flip, () => { api.poke(); turn(); });
        gb.forEach((b, k) => b.addEventListener('click', () => { api.poke(); grade(k); }));
      },
    },
    {
      id: 'listen', bg: 'video-reine', emoji: '🎬', label: 'Видео с бегущей строкой',
      title: 'Живой норвежский с бегущей строкой',
      text: 'Передачи NRK, YouTube и радио с субтитрами: слово загорается, когда его произносят, а под ним — перевод на украинский или русский. Нажмите на любое слово — и оно станет карточкой.',
      points: ['👆 Слово из фильма — в карточку одним нажатием', '📻 Радио NRK и YouTube — тоже с переводом', '📺 Можно смотреть на телевизоре'],
      hint: ['.sc-kw[data-k="1"]', 'Нажмите на слово'],
      art: c => `<div class="sc-video"><img class="sc-vimg" src="${IMG}video-reine.webp" alt="" draggable="false" decoding="async">
          <span class="sc-vchip"><button type="button" class="sc-vplay" aria-label="Пауза" title="Пауза"><span aria-hidden="true">⏸</span></button><b>NRK TV</b><span class="sc-vsub">🎬 Субтитры</span></span>
          <span class="sc-vdeck" aria-hidden="true">🃏<b>12</b></span>${SAY(KARA.map(w => w[0]).join(' ') + '.', 'вся фраза')}
          <button type="button" class="sc-vzoom" hidden aria-label="Обычный размер" title="Обычный размер">↺ 1×</button>
          <div class="sc-kara" lang="nb">${KARA.map(([no, uk, ru], i) => `<button type="button" class="sc-kw" data-k="${i}" aria-label="${no}: перевод и в карточки"><b>${no}</b>${gloss(uk, ru, c.gl)}</button>`).join('')}</div>
          <div class="sc-kpop" role="status" aria-live="polite"></div>
          <div class="sc-kru">${c.gl === 'both' ? `<span lang="uk">🇺🇦 ${KARA_UK}</span><span lang="ru">🇷🇺 ${KARA_RU}</span>` : c.gl === 'uk' ? `<span lang="uk">${KARA_UK}</span>` : `<span lang="ru">${KARA_RU}</span>`}</div><div class="sc-vprog"><i></i></div></div>
        <div class="sc-tv" aria-hidden="true">${TV()}<span>и на телевизоре</span></div>`,
      still: el => { el.querySelectorAll('.sc-kw').forEach((w, i) => w.classList.add(i < 2 ? 'sung' : i === 2 ? 'cur' : 'x')); el.querySelector('.sc-kru').classList.add('in'); el._sc.paused(true); },
      run(el, T) {
        const ws = [...el.querySelectorAll('.sc-kw')], ru = el.querySelector('.sc-kru'), pr = el.querySelector('.sc-vprog'), pi = pr.firstElementChild;
        el._sc.paused(false);
        const loop = () => {
          ws.forEach(w => w.classList.remove('cur', 'sung', 'x')); ru.classList.remove('in'); pr.classList.remove('go'); pi.style.transform = '';
          T(() => pr.classList.add('go'), 60);
          ws.forEach((w, i) => T(() => { if (i) ws[i - 1].classList.replace('cur', 'sung'); w.classList.add('cur'); }, 500 + i * 640));
          T(() => { ws[ws.length - 1].classList.replace('cur', 'sung'); ru.classList.add('in'); }, 500 + ws.length * 640);
          T(loop, 500 + ws.length * 640 + 2600);
        };
        loop();
      },
      wire(el, api) {
        const v = el.querySelector('.sc-video'), img = v.querySelector('.sc-vimg'), pop = v.querySelector('.sc-kpop'), deck = v.querySelector('.sc-vdeck');
        const play = v.querySelector('.sc-vplay'), zb = v.querySelector('.sc-vzoom'), pr = v.querySelector('.sc-vprog'), pi = pr.firstElementChild;
        let count = 12, popT = 0;
        const paused = p => { play.innerHTML = `<span aria-hidden="true">${p ? '▶' : '⏸'}</span>`; const t = p ? 'Запустить строку' : 'Пауза'; play.setAttribute('aria-label', t); play.title = t; v.classList.toggle('paused', p); };
        el._sc = { paused };
        if (api.rm) api.hold(true); // calm mode: the line waits for ▶
        const freeze = () => { const m = getComputedStyle(pi).transform; pr.classList.remove('go'); pi.style.transform = m && m !== 'none' ? m : ''; };
        play.addEventListener('click', () => {
          if (api.held()) { api.hold(false); api.restart(); }
          else { api.hold(true); freeze(); paused(true); }
        });
        // a word: it speaks, shows 🇺🇦 + 🇷🇺 and flies into the deck (only for the example: nothing is saved)
        v.querySelectorAll('.sc-kw').forEach(w => w.addEventListener('click', () => {
          const [no, uk, ru] = KARA[+w.dataset.k];
          api.poke(9000); freeze();
          if (api.rm) { api.hold(true); paused(true); }
          v.querySelectorAll('.sc-kw').forEach(x => x.classList.remove('cur', 'x'));
          w.classList.add('cur', 'sung');
          say(no, 'no');
          pop.innerHTML = `<b lang="nb">${no}</b>${both(uk, ru)}<em>＋ в карточки <small>(здесь — для примера)</small></em>`;
          pop.classList.add('on');
          const vr = v.getBoundingClientRect(), wr = w.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
          const cx = wr.left + wr.width / 2 - vr.left;
          pop.style.left = clamp(cx - pw / 2, 6, vr.width - pw - 6) + 'px';
          pop.style.top = Math.max(6, wr.top - vr.top - ph - 8) + 'px';
          clearTimeout(popT); popT = api.U(() => pop.classList.remove('on'), 4200);
          const bump = () => { count++; deck.querySelector('b').textContent = count; deck.classList.remove('bump'); void deck.offsetWidth; deck.classList.add('bump'); };
          if (api.rm || !document.body.animate) { bump(); return; }
          const dr = deck.getBoundingClientRect();
          const f = document.createElement('span'); f.className = 'sc-fly'; f.setAttribute('aria-hidden', 'true'); f.innerHTML = `<b lang="nb">${no}</b><i>${uk}</i>`;
          v.appendChild(f);
          const x0 = cx - f.offsetWidth / 2, y0 = wr.top - vr.top - f.offsetHeight / 2 + wr.height / 2;
          const x1 = dr.left + dr.width / 2 - vr.left - f.offsetWidth / 2, y1 = dr.top + dr.height / 2 - vr.top - f.offsetHeight / 2;
          const a = f.animate([{ transform: `translate(${x0}px, ${y0}px) scale(.6)`, opacity: 0 }, { transform: `translate(${x0}px, ${y0 - 26}px) scale(1) rotate(-6deg)`, opacity: 1, offset: .3 },
            { transform: `translate(${x1}px, ${y1}px) scale(.3) rotate(12deg)`, opacity: .4 }], { duration: 820, easing: 'cubic-bezier(.5, 0, .3, 1)' });
          a.onfinish = () => { f.remove(); bump(); };
        }));
        // the picture zooms (two fingers, the wheel) and moves while zoomed; a double tap or «↺ 1×» — back
        const Z = { s: 1, x: 0, y: 0 };
        let zb0 = Object.assign({}, Z), lastTap = 0;
        const zap = smooth => {
          const lim = (Z.s - 1) / 2; Z.x = clamp(Z.x, -v.offsetWidth * lim, v.offsetWidth * lim); Z.y = clamp(Z.y, -v.offsetHeight * lim, v.offsetHeight * lim);
          img.classList.toggle('smooth', !!smooth);
          img.style.transform = Z.s > 1.001 ? `translate(${Z.x.toFixed(1)}px, ${Z.y.toFixed(1)}px) scale(${Z.s.toFixed(3)})` : '';
          zb.hidden = Z.s <= 1.001; v.classList.toggle('zoomed', Z.s > 1.001);
        };
        const zreset = () => { Object.assign(Z, { s: 1, x: 0, y: 0 }); zap(true); };
        gest(v, {
          down() { zb0 = Object.assign({}, Z); },
          move(d) { if (Z.s > 1.001) { Z.x = zb0.x + d.dx; Z.y = zb0.y + d.dy; zap(); } },
          pinchStart() { zb0 = Object.assign({}, Z); },
          pinch(g) { Z.s = clamp(zb0.s * g.s, 1, 3); zap(); },
        });
        v.addEventListener('click', e => {
          if (e.target.closest('button') || dragged(v)) return;
          const now = Date.now(); if (now - lastTap < 330) { lastTap = 0; zreset(); } else lastTap = now;
        });
        v.addEventListener('wheel', e => {
          if (e.target.closest('.sc-kara, .sc-kpop')) return;
          if (Z.s <= 1.001 && e.deltaY > 0 && !e.ctrlKey) return; // not zoomed: scrolling down still scrolls
          e.preventDefault();
          Z.s = clamp(Z.s * Math.exp(-e.deltaY * (e.ctrlKey ? .012 : .0022)), 1, 3); zap();
        }, { passive: false });
        zb.addEventListener('click', zreset);
      },
    },
    {
      id: 'ai', bg: 'nordlys', emoji: '🤖', label: 'Нейросеть-помощник',
      title: 'Нейросеть-помощник',
      text: 'Нейросеть проверяет переводы во всех ваших колодах, объясняет грамматику и подбирает примеры — простыми словами, по-русски. Каждое исправление вы видите и сами решаете, принять его или нет.',
      points: ['🔎 «Проверить все колоды» — одной кнопкой', '📋 Отчёт: коротко или подробно', '🔌 Подключается в Настройках за пару минут'],
      art: () => `<div class="sc-ai"><div class="sc-ai-head"><span class="sc-ai-logo">${AI}</span><b>Проверка колоды</b><span class="sc-ai-n" data-n>0 из 4</span></div>
          <div class="sc-ai-bar"><i></i></div>
          <ul class="sc-ai-rows">
            <li class="ok"><div class="sc-ai-line"><b lang="nb">et hus</b><span class="ru">дом</span><span class="mk" aria-hidden="true">✓</span></div></li>
            <li class="fix" data-r="1"><button type="button" class="sc-ai-line" aria-expanded="false" disabled><b lang="nb">å bli</b><span class="ru"><s>быть</s><ins>становиться, оставаться</ins></span><span class="mk" aria-hidden="true">✎</span></button>
              <div class="sc-ai-why" hidden><p>${WHY[1]}</p><div class="sc-ai-ch" role="group" aria-label="Исправление «å bli» — для примера"><button type="button" data-v="new" aria-pressed="false">✓ Принять</button><button type="button" data-v="old" aria-pressed="false">↩ Оставить как было</button></div></div></li>
            <li class="ok"><div class="sc-ai-line"><b lang="nb">ei jente</b><span class="ru">девочка</span><span class="mk" aria-hidden="true">✓</span></div></li>
            <li class="fix" data-r="3"><button type="button" class="sc-ai-line" aria-expanded="false" disabled><b lang="nb">å glede seg</b><span class="ru"><s>радоваться</s><ins>ждать с радостью, предвкушать</ins></span><span class="mk" aria-hidden="true">✎</span></button>
              <div class="sc-ai-why" hidden><p>${WHY[3]}</p><div class="sc-ai-ch" role="group" aria-label="Исправление «å glede seg» — для примера"><button type="button" data-v="new" aria-pressed="false">✓ Принять</button><button type="button" data-v="old" aria-pressed="false">↩ Оставить как было</button></div></div></li>
          </ul>
          <div class="sc-ai-sum"><span data-sum>✓ Проверено 4 · уточнено 2 · <b>решаете вы</b></span><button type="button" class="sc-ai-again" title="Проверить ещё раз">↻ <span>Проверить ещё раз</span></button></div></div>`,
      still: el => el._sc.check(true),
      run: el => el._sc.check(false),
      wire(el, api) {
        const rows = [...el.querySelectorAll('.sc-ai-rows li')], bar = el.querySelector('.sc-ai-bar i'), n = el.querySelector('[data-n]'), sum = el.querySelector('.sc-ai-sum'), sumT = el.querySelector('[data-sum]');
        const fixes = rows.filter(r => r.classList.contains('fix'));
        const paint = () => {
          const acc = fixes.filter(r => r.dataset.v === 'new').length, kept = fixes.filter(r => r.dataset.v === 'old').length;
          sumT.innerHTML = `✓ Проверено 4 · уточнено 2 · ${acc || kept ? `принято ${acc}${kept ? `, оставлено ${kept}` : ''}` : '<b>решаете вы</b>'}`;
        };
        const open = (li, on) => {
          fixes.forEach(r => { const o = r === li && on; r.classList.toggle('open', o); r.querySelector('.sc-ai-line').setAttribute('aria-expanded', String(o)); r.querySelector('.sc-ai-why').hidden = !o; });
        };
        const ready = () => { fixes.forEach(r => { r.querySelector('.sc-ai-line').disabled = false; }); api.hint(fixes[0].querySelector('.sc-ai-line'), 'Нажмите на строку'); };
        const check = instant => {
          api.stopLoop();
          open(null); fixes.forEach(r => { delete r.dataset.v; r.classList.remove('old'); r.querySelectorAll('[data-v]').forEach(b => b.setAttribute('aria-pressed', 'false')); r.querySelector('.sc-ai-line').disabled = true; });
          paint();
          if (instant) {
            rows.forEach(li => li.classList.add('in', 'done')); bar.style.transform = 'scaleX(1)'; n.textContent = '4 из 4'; sum.classList.add('in'); ready(); return;
          }
          rows.forEach(r => r.classList.remove('in', 'done')); sum.classList.remove('in'); bar.style.transform = 'scaleX(0)'; n.textContent = '0 из 4';
          rows.forEach((r, i) => {
            api.T(() => r.classList.add('in'), 500 + i * 1050);
            api.T(() => { r.classList.add('done'); bar.style.transform = `scaleX(${(i + 1) / rows.length})`; n.textContent = `${i + 1} из ${rows.length}`; }, 1050 + i * 1050);
          });
          api.T(() => { sum.classList.add('in'); ready(); }, 1300 + rows.length * 1050);
        };
        el._sc = { check };
        fixes.forEach(li => {
          li.querySelector('.sc-ai-line').addEventListener('click', () => open(li, !li.classList.contains('open')));
          li.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => {
            li.dataset.v = b.dataset.v; li.classList.toggle('old', b.dataset.v === 'old');
            li.querySelectorAll('[data-v]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
            li.querySelector('.mk').textContent = b.dataset.v === 'old' ? '↩' : '✓';
            paint();
          }));
        });
        el.querySelector('.sc-ai-again').addEventListener('click', () => { fixes.forEach(r => { r.querySelector('.mk').textContent = '✎'; }); check(api.rm); });
      },
    },
    {
      id: 'world', bg: 'bryggen', emoji: '🧭', label: 'Всё в одном месте',
      title: 'Всё для норвежского — в одном месте',
      text: 'Книги и тексты с переводом, Telegram-каналы о норвежском, новости простым языком, грамматика, подготовка к экзамену. А на занятиях произношения приложение слушает вас и подсказывает.',
      points: ['📚 Книги и тексты с переводом по словам', '🗣 Произношение: приложение слушает вас', '📝 Тесты, как на экзамене Norskprøve'],
      hint: ['.sc-orbit', 'Покрутите круг'],
      art: () => `<div class="sc-orbit"><div class="sc-oval"><div class="sc-ring">${ORB.map((o, i) => `<span class="sc-ob" style="--a:${(i * 360 / ORB.length).toFixed(1)}deg"><button type="button" class="sc-obi" data-o="${i}" aria-label="${esc(o[1])}: что это"><span class="g" aria-hidden="true">${o[0]}</span><span class="lb${o[1].length > 10 ? ' long' : ''}">${o[1]}</span></button></span>`).join('')}</div></div>
          <div class="sc-core"><span class="f" aria-hidden="true">🇳🇴</span><b lang="nb">norsk</b><i>с переводом</i></div>
          <div class="sc-obub" role="status" aria-live="polite"></div></div>`,
      wire(el, api) {
        const orb = el.querySelector('.sc-orbit'), ring = el.querySelector('.sc-ring'), bub = el.querySelector('.sc-obub');
        const AUTO = 360 / 80000; // one turn in 80 s
        let rot = 0, vel = api.rm ? 0 : AUTO, drag = false, la = 0, lt = 0, bubT = 0;
        const ex = () => { const cs = getComputedStyle(el.querySelector('.sc-art')); return (parseFloat(cs.getPropertyValue('--ex')) || 1) * (parseFloat(cs.getPropertyValue('--rx')) || 1); }; // the oval's stretch
        const ang = (x, y) => { const r = orb.getBoundingClientRect(); return Math.atan2(y - (r.top + r.height / 2), (x - (r.left + r.width / 2)) / ex()) * 180 / Math.PI; };
        const put = () => ring.style.setProperty('--rot', (rot % 360).toFixed(2) + 'deg');
        put();
        api.raf(dt => {
          if (drag) return;
          if (api.rm) return;
          vel += (AUTO - vel) * (1 - Math.pow(.965, dt / 16)); // a throw slows down to the calm turning
          rot += vel * dt; put();
        });
        gest(orb, {
          down(e) { drag = true; la = ang(e.clientX, e.clientY); lt = performance.now(); vel = 0; },
          move(d) {
            const a = ang(d.x, d.y); let da = a - la; da = ((da + 540) % 360) - 180; la = a;
            const t = performance.now(), dt = Math.max(8, t - lt); lt = t;
            rot += da; put();
            vel = vel * .5 + (da / dt) * .5;
          },
          up(i) { drag = false; if (!i.moved || api.rm || performance.now() - lt > 90) vel = api.rm ? 0 : AUTO; else vel = clamp(vel, -.9, .9); },
        }, { inner: true });
        const tell = k => {
          const o = ORB[k];
          el.querySelectorAll('.sc-obi').forEach((b, j) => b.classList.toggle('on', j === k));
          bub.innerHTML = `<span class="g" aria-hidden="true">${o[0]}</span><b>${o[1]}</b><span>${o[2]}</span>`;
          bub.classList.add('on');
          clearTimeout(bubT); bubT = api.U(() => { bub.classList.remove('on'); el.querySelectorAll('.sc-obi.on').forEach(b => b.classList.remove('on')); }, 5200);
        };
        el.querySelectorAll('.sc-obi').forEach(b => {
          b.addEventListener('click', () => { if (dragged(orb)) return; tell(+b.dataset.o); });
          b.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); rot += e.key === 'ArrowLeft' ? -36 : 36; put(); } });
        });
        bub.addEventListener('click', () => bub.classList.remove('on'));
      },
    },
    {
      id: 'beauty', bg: 'stavkirke', emoji: '🎨', label: 'Учиться красиво',
      title: 'Учиться красиво',
      text: 'Художественные карточки и норвежские темы оформления: тролли, викинги, ставкирки, Лофотены, королевская Норвегия. Любую тему можно сначала примерить — посмотреть, как выглядят карточки, — и только потом выбрать. А на праздники приложение наряжается само.',
      points: ['🖋 Шрифты, цвета и рамки — на ваш вкус', '👀 Сначала примерить — потом выбрать', '📅 17 мая, Рождество — по календарю'],
      hint: ['.sc-ac.p0', 'Потяните или нажмите'],
      cta: o => `<button type="button" class="sc-btn sc-try" data-sc="themes" title="${o.askName ? 'Сначала познакомимся — темы откроются сразу после этого' : 'Открыть темы приложения — место в знакомстве сохранится'}"><span aria-hidden="true">🎨</span> Примерить темы</button>`,
      art: () => `<div class="sc-deck3">${ARTDEMO.map((c, i) => `<div class="sc-ac p${i}" data-c="${i}" role="button" tabindex="0" aria-label="Карточка «${esc(c.no)}» — ${esc(c.ru)}">${artCard(c)}</div>`).join('')}</div>
        <div class="sc-marq" aria-hidden="true"><div class="sc-marq-in">${POSTCARDS.map(postcard).join('')}<span class="sc-marq-dup">${POSTCARDS.map(postcard).join('')}</span></div></div>`,
      run(el, T) {
        const turn = () => { if (!el.querySelector('.sc-lens')) el._sc.turn(1); T(turn, 3000); }; // a card held big stays put
        T(turn, 3000);
      },
      wire(el, api) {
        const art = el.querySelector('.sc-art'), cards = [...el.querySelectorAll('.sc-ac')];
        let k = 0;
        const place = () => cards.forEach((c, i) => {
          const p = (i - k + 3) % 3;
          c.classList.remove('p0', 'p1', 'p2'); c.classList.add('p' + p);
          c.setAttribute('aria-label', `Карточка «${ARTDEMO[i].no}» — ${ARTDEMO[i].ru}. ${p === 0 ? 'Открыть крупно' : 'Показать её впереди'}`);
        });
        const turn = d => { k = (k + d + 3) % 3; place(); };
        el._sc = { turn };
        place();
        cards.forEach((c, i) => {
          gest(c, {
            down() { api.poke(); c.classList.add('drag'); },
            move(d) { if (!c.classList.contains('p0')) return; c.style.translate = `${(d.dx * .7).toFixed(1)}px ${(d.dy * .12).toFixed(1)}px`; c.style.rotate = `${(d.dx * .05).toFixed(1)}deg`; },
            up(u) { c.classList.remove('drag'); c.style.translate = ''; c.style.rotate = ''; if (u.moved && Math.abs(u.dx) > 40 && Math.abs(u.dx) > Math.abs(u.dy)) turn(u.dx < 0 ? 1 : -1); },
          });
          press(c, () => {
            api.poke();
            if (!c.classList.contains('p0')) { k = i; place(); return; }
            lens(api, art, c, { cls: 'sc-lens-art', label: `Карточка «${ARTDEMO[i].no}» крупно — потяните, чтобы повернуть`, front: c.innerHTML, back: '', onClose: () => api.poke() });
          });
          c.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); api.poke(); turn(e.key === 'ArrowRight' ? 1 : -1); cards[k].focus(); } });
        });
        // the ribbon of postcards glides by itself and can be pulled (a throw rolls on, then calms down)
        const mq = el.querySelector('.sc-marq'), inn = el.querySelector('.sc-marq-in');
        const half = () => (inn.scrollWidth / 2) || 1, SPEED = () => half() / 70000;
        let off = 0, vel = api.rm ? 0 : SPEED(), drag = false, o0 = 0;
        const put = () => { const h = half(); off = ((off % h) + h) % h; inn.style.transform = `translateX(${(-off).toFixed(1)}px)`; };
        api.raf(dt => { if (drag || api.rm) return; const s = SPEED(); vel += (s - vel) * (1 - Math.pow(.97, dt / 16)); off += vel * dt; put(); });
        gest(mq, {
          down() { drag = true; o0 = off; vel = 0; },
          move(d) { off = o0 - d.dx; put(); },
          up(u) { drag = false; vel = api.rm || !u.moved ? (api.rm ? 0 : SPEED()) : clamp(-u.vx, -3, 3); },
        });
      },
    },
    {
      id: 'start', bg: 'preikestolen', emoji: '🚀', label: 'Ваш путь',
      title: 'Ваш путь — от первых слов до свободной речи',
      text: 'Шаг за шагом, от уровня A1 до C2: приложение подберёт слова под ваш уровень и покажет, как вы растёте. А подсказки и кнопка «?» всегда рядом.',
      points: ['🪜 Слова — под ваш уровень', '📊 Видно, как вы растёте', '❓ Подсказки — в каждом разделе'],
      hint: ['.sc-step[data-lv="3"]', 'Нажмите на ступеньку'],
      art: () => `<div class="sc-ladder" style="--k:0">${LEVELS.map(([L, t], i) => `<button type="button" class="sc-step" data-lv="${i}" style="--i:${i}" aria-label="${L} — ${t}: примеры слов"><b>${L}</b><i>${t}</i></button>`).join('')}<span class="sc-climber" aria-hidden="true">🎓</span>
          <span class="sc-lcap" aria-hidden="true"><b>${LEVELS[0][0]}</b> ${LEVELS[0][1]}</span><div class="sc-lbub" role="status" aria-live="polite"></div></div>`,
      still: el => el._sc.go(1),
      run(el, T) {
        let k = 0;
        el.querySelector('.sc-lbub').classList.remove('on'); el.querySelector('.sc-ladder').classList.remove('bub');
        const go = () => {
          el._sc.go(k);
          if (k < LEVELS.length - 1) { k++; T(go, 900); } else { T(() => { k = 0; go(); }, 2600); }
        };
        go();
      },
      wire(el, api) {
        const l = el.querySelector('.sc-ladder'), steps = [...l.querySelectorAll('.sc-step')], bub = l.querySelector('.sc-lbub');
        const go = k => { l.style.setProperty('--k', k); steps.forEach((s, i) => s.classList.toggle('lit', i <= k)); ladCap(el, k); };
        el._sc = { go };
        steps.forEach((s, k) => s.addEventListener('click', () => {
          api.poke(14000); go(k);
          bub.innerHTML = `<span class="sc-lbh"><b>${LEVELS[k][0]}</b> ${LEVELS[k][1]}</span>${LVW[k].map(([no, uk, ru]) => `<span class="sc-lw"><b lang="nb">${no}</b><span><span class="sc-fl">🇺🇦</span> <i lang="uk">${uk}</i></span><span><span class="sc-fl">🇷🇺</span> <i lang="ru">${ru}</i></span></span>`).join('')}`;
          bub.classList.add('on'); l.classList.add('bub');
        }));
        bub.addEventListener('click', () => { bub.classList.remove('on'); l.classList.remove('bub'); });
      },
    },
  ];
  const LAST = SCENES.length - 1;
  /** a small picture (a phone) has no room for the words inside the steps — one caption tells the level */
  function ladCap(el, k) { const c = el.querySelector('.sc-lcap'); if (c) c.innerHTML = `<b>${LEVELS[k][0]}</b> ${esc(LEVELS[k][1])}`; }

  /* ---------------- the window ---------------- */
  let cur = null;

  /** the loading screen may still be playing on the first start — wait for it (at most 8 s) */
  const afterPreloader = () => new Promise(res => {
    const t0 = Date.now();
    const ok = () => !(window.NKPreloader && NKPreloader.active) || Date.now() - t0 > 8000;
    if (ok()) { res(); return; }
    const iv = setInterval(() => { if (ok()) { clearInterval(iv); setTimeout(res, 250); } }, 120);
  });

  /** «🎨 Примерить темы» pressed on the first start: the themes open once the name is asked and no window is open */
  function themesLater() {
    let tries = 0, calm = 0;
    const iv = setInterval(() => {
      tries++;
      const asked = window.Store && Store.state && (Store.state.askedName || (Store.settings && Store.settings.userName));
      const open = document.querySelector('#modal-root > .modal-backdrop:not(.closing)') || (window.Showcase && Showcase.active);
      calm = asked && !open ? calm + 1 : 0;
      if (calm >= 1) { clearInterval(iv); try { if (window.AppThemes && AppThemes.open) AppThemes.open(); } catch (e) { /* ignore */ } }
      else if (tries > 1800) clearInterval(iv); // 3 minutes: let it be
    }, 100);
  }

  function build(o) {
    const s0 = st();
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop nk-sc' + (reduce() ? ' still' : '');
    bd.setAttribute('role', 'dialog'); bd.setAttribute('aria-modal', 'true'); bd.setAttribute('aria-label', 'Знакомство с Norsk Kort');
    bd.innerHTML = `<div class="sc-bg" aria-hidden="true"><img class="sc-bgi" alt="" draggable="false"><img class="sc-bgi" alt="" draggable="false"><span class="sc-shade"></span><span class="sc-aur"></span><span class="sc-stars"></span></div>
      <div class="sc-wrap">
        <header class="sc-top">
          <div class="sc-brand">${FLAGS} Norsk <b>Kort</b></div>
          <span class="sc-sp"></span>
          <button type="button" class="sc-btn ghost sc-listen" data-sc="listen" title="Прочитать этот экран вслух"><span aria-hidden="true">🔊</span><span class="sc-bl">Послушать</span></button>
          <button type="button" class="sc-btn ghost sc-skip" data-sc="skip" title="${o.askName ? 'Пропустить знакомство' : 'Закрыть знакомство — место сохранится'}"><span class="sc-bl">${o.askName ? 'Пропустить' : 'Закрыть'}</span><span aria-hidden="true">✕</span></button>
        </header>
        <div class="sc-stage" data-stage></div>
        <footer class="sc-foot">
          <button type="button" class="sc-btn ghost sc-prev" data-sc="prev"><span aria-hidden="true">←</span><span class="sc-bl">Назад</span></button>
          <div class="sc-dots">${SCENES.map((s, i) => `<button type="button" class="sc-dot" data-sc-go="${i}" aria-label="${i + 1} из ${SCENES.length}: ${esc(s.label)}" title="${esc(s.label)}"><i></i></button>`).join('')}</div>
          <button type="button" class="sc-btn primary sc-next" data-sc="next"></button>
        </footer>
      </div>`;
    (document.getElementById('modal-root') || document.body).appendChild(bd);
    return { bd, resumeAt: !o.at && s0.at > 0 && s0.at <= LAST && !o.askName ? s0.at : 0 };
  }

  function open(o = {}) {
    if (cur) return cur.promise;
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    cur = { promise };
    // while the loading screen plays, a quiet placeholder already holds our place in #modal-root:
    // the other first-start windows (they wait until no window is open) do not slip in before the showcase
    const ph = document.createElement('div');
    ph.className = 'modal-backdrop nk-sc-wait'; ph.setAttribute('aria-hidden', 'true');
    let cancelled = false;
    const cancel = () => { if (cancelled) return; cancelled = true; ph.remove(); cur = null; resolve({ name: '', finished: false, at: 0 }); };
    ph._m = { el: ph, close: cancel, tryClose: async () => { cancel(); return true; }, $: () => null, $$: () => [] }; // «на главный экран» before it starts
    (document.getElementById('modal-root') || document.body).appendChild(ph);
    afterPreloader().then(() => { ph.remove(); if (!cancelled) start(o, resolve); })
      .catch(e => { console.warn('showcase', e); ph.remove(); if (!cancelled) { cancelled = true; cur = null; resolve({ name: '', finished: false, at: 0 }); } });
    return promise;
  }

  function start(o, resolve) {
    const back = document.activeElement;
    let { bd, resumeAt } = build(o);
    const stage = bd.querySelector('[data-stage]');
    const bgs = [...bd.querySelectorAll('.sc-bgi')];
    const next = bd.querySelector('.sc-next'), prev = bd.querySelector('.sc-prev');
    document.documentElement.classList.add('sc-lock');
    let i = -1, timers = [], uiTimers = [], ro = null, closed = false, name = '', bgk = 0, speaking = false;
    let wantThemes = false, lang0 = trNow(), lang = lang0, escFn = null, idleT = 0, held = false, curEl = null;
    const gl = o.askName ? 'both' : lang0; // a new user sees both translations in the pictures
    const T = (fn, ms) => { const id = setTimeout(() => { if (!closed) fn(); }, ms); timers.push(id); return id; };
    const U = (fn, ms) => { const id = setTimeout(() => { if (!closed) fn(); }, ms); uiTimers.push(id); return id; };
    const stopLoop = () => { timers.forEach(clearTimeout); timers = []; };
    const stopTimers = () => { stopLoop(); uiTimers.forEach(clearTimeout); uiTimers = []; clearTimeout(idleT); };
    // --u: 1/100 of the picture's smaller side; --ex: how much wider than tall it is (1…1.45, pictures may stretch sideways);
    // .sm: a phone-sized picture (words that cannot shrink below a readable size get a simpler layout)
    // a picture that grows with its content (.autoh) is measured by its least height (no loop between size and content)
    const setU = art => {
      const r = art.getBoundingClientRect(); if (!r.width || !r.height) return;
      const h = art.classList.contains('autoh') ? (parseFloat(getComputedStyle(art).minHeight) || r.height) : r.height;
      const u = Math.max(1.4, Math.min(r.width, h) / 100), ex = Math.max(1, Math.min(1.45, r.width / h));
      art.style.setProperty('--u', u.toFixed(2) + 'px'); art.style.setProperty('--ex', ex.toFixed(3));
      art.classList.toggle('sm', u < 3.6);
    };
    // a scene taller than the screen scrolls: a soft fade at the bottom says «there is more below»
    const setMore = sc => { if (sc) sc.classList.toggle('more', sc.scrollHeight - sc.clientHeight - sc.scrollTop > 6); };

    /** the gentle «Потрогайте» hint on the scene's main object — once per scene on this device */
    function hint(el, sid, target, text) {
      const seen = st().hints || {};
      if (seen[sid] || !target) return;
      U(() => {
        if (el !== curEl || el.dataset.touched || !target.isConnected) return;
        const art = el.querySelector('.sc-art'), ar = art.getBoundingClientRect(), tr = target.getBoundingClientRect();
        if (!tr.width) return;
        patch({ hints: Object.assign({}, st().hints, { [sid]: 1 }) });
        const ring = document.createElement('span'); ring.className = 'sc-pulse'; ring.setAttribute('aria-hidden', 'true');
        const small = Math.max(tr.width, tr.height) < ar.width * .6;
        if (small) Object.assign(ring.style, { left: tr.left - ar.left + tr.width / 2 + 'px', top: tr.top - ar.top + tr.height / 2 + 'px', width: tr.width + 10 + 'px', height: tr.height + 10 + 'px' });
        const chip = document.createElement('span'); chip.className = 'sc-hint'; chip.setAttribute('aria-hidden', 'true');
        chip.innerHTML = `<span class="sc-hint-h">${handS()}</span>${esc(text)}`;
        art.appendChild(chip); if (small) art.appendChild(ring);
        const cw = chip.offsetWidth, ch = chip.offsetHeight;
        chip.style.left = clamp(tr.left - ar.left + tr.width / 2 - cw / 2, 0, Math.max(0, ar.width - cw)) + 'px';
        // under a small object (or over its lower edge when there is no room); over the middle of a big one
        const below = tr.bottom - ar.top + 8, above = tr.top - ar.top - ch - 8;
        chip.style.top = clamp(!small ? tr.top - ar.top + tr.height * .82 - ch / 2 : below + ch <= ar.height ? below : above >= 0 ? above : tr.bottom - ar.top - ch - 6, 0, Math.max(0, ar.height - ch)) + 'px';
        const ev = ['pointerdown', 'click', 'keydown'];
        const gone = () => { chip.classList.add('bye'); ring.remove(); setTimeout(() => chip.remove(), 400); ev.forEach(t => el.removeEventListener(t, gone, true)); };
        ev.forEach(t => el.addEventListener(t, gone, true));
        U(gone, 6500);
      }, 1300);
    }

    function show(k, dir) {
      k = Math.max(0, Math.min(LAST, k));
      if (k === i) return;
      const old = stage.querySelector('.sc-scene:not(.out)');
      const inp = old && old.querySelector('[data-sc-name]'); if (inp) name = inp.value;
      dir = dir || (k > i ? 1 : -1);
      i = k; stopTimers(); hush(); speaking = false; bd.classList.remove('speaking'); escFn = null; held = false;
      if (ro) { ro.disconnect(); ro = null; }
      const s = SCENES[k];
      // the photo behind: cross-fade between the two layers
      const nb = bgs[bgk = 1 - bgk], ob = bgs[1 - bgk];
      nb.src = IMG + s.bg + '.webp'; nb.classList.add('on'); ob.classList.remove('on');
      if (k > 0) resumeAt = 0; // moved on: «↪ Продолжить с …» is no longer needed
      const resume = k === 0 && resumeAt ? `<button type="button" class="sc-btn sc-resume" data-sc-go="${resumeAt}"><span aria-hidden="true">↪</span> Продолжить с «${esc(SCENES[resumeAt].label)}»</button>` : '';
      const ask = k === LAST && o.askName ? `<label class="sc-name"><span>👋 Как вас зовут?</span><input type="text" data-sc-name maxlength="40" autocomplete="given-name" enterkeyhint="go" placeholder="Ваше имя" value="${esc(name)}"></label>` : '';
      const pick = k === LAST ? `<fieldset class="sc-lang"><legend>🌐 Перевод слов — на каком языке?</legend><div class="sc-lang-o">${LANGS.map(([v, t]) => `<label><input type="radio" name="sc-tl" value="${v}" ${v === lang ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
          <small>Если у слова ещё нет украинского перевода — покажем русский с пометкой 🇷🇺. Поменять можно в Настройках.</small></fieldset>` : '';
      const tnote = k === LAST && wantThemes ? '<p class="sc-tnote"><span aria-hidden="true">🎨</span> Темы откроются сразу после знакомства.</p>' : '';
      const el = document.createElement('section');
      el.className = `sc-scene sc-s-${s.id} ${dir > 0 ? 'from-r' : 'from-l'}`;
      el.setAttribute('aria-labelledby', 'sc-h-' + s.id);
      el.innerHTML = `<div class="sc-art">${s.art({ gl })}</div>
        <div class="sc-text"><span class="sc-kick"><span aria-hidden="true">${s.emoji === '🤖' ? BOT() : s.emoji}</span> ${k + 1} из ${SCENES.length} · ${esc(s.label)}</span>
          <h2 id="sc-h-${s.id}">${s.title}</h2>${resume}${tnote}${ask}${pick}<p>${s.text}</p>
          <ul class="sc-pts">${s.points.map((p, j) => `<li style="--j:${j}">${window.NavIcons ? NavIcons.swap(p) : p}</li>`).join('')}</ul>${s.cta ? s.cta(o) : ''}</div>`;
      stage.appendChild(el);
      curEl = el;
      if (old) { old.classList.add('out', dir > 0 ? 'to-l' : 'to-r'); setTimeout(() => old.remove(), reduce() ? 0 : 520); }
      const art = el.querySelector('.sc-art');
      if (s.id === 'ai') art.classList.add('autoh');
      setU(art);
      if (window.ResizeObserver) { ro = new ResizeObserver(() => { setU(art); setMore(el); }); ro.observe(art); ro.observe(el); }
      el.addEventListener('scroll', () => setMore(el), { passive: true });
      setTimeout(() => setMore(el), 60);
      el.addEventListener('pointerdown', e => { if (e.target.closest('[data-touch], button, input, label')) el.dataset.touched = '1'; }, true);
      // what a scene can use to be touched
      const rm = reduce(), alive = () => !closed && curEl === el;
      const api = {
        gl, rm, T, U, stopLoop,
        held: () => held,
        hold: v => { held = !!v; if (held) { stopLoop(); clearTimeout(idleT); } },
        /** the person plays: the demo loop waits, and goes on after a quiet while */
        poke: (ms = 8000) => { stopLoop(); clearTimeout(idleT); if (s.pause) s.pause(el); if (held || rm || !s.run || s.id === 'ai') return; idleT = U(() => { if (alive()) s.run(el, T); }, ms); },
        restart: () => { stopLoop(); clearTimeout(idleT); if (alive() && s.run) s.run(el, T); },
        onEsc: fn => { escFn = fn; },
        hint: (t, text) => hint(el, s.id, t, text),
        raf: fn => { let t0 = performance.now(); const f = t => { if (!alive()) return; fn(Math.min(64, t - t0)); t0 = t; requestAnimationFrame(f); }; requestAnimationFrame(f); },
      };
      if (s.wire) { try { s.wire(el, api); } catch (e) { console.warn('showcase wire', e); } }
      if (rm || !s.run) { if (s.still && rm) s.still(el); }
      else s.run(el, T);
      if (s.hint) api.hint(el.querySelector(s.hint[0]), s.hint[1]);
      // the language: on the first start it is saved with «Начать учиться»; later — at once
      el.querySelectorAll('input[name="sc-tl"]').forEach(r => r.addEventListener('change', () => {
        if (!r.checked) return;
        lang = r.value;
        if (!o.askName) { saveLang(); try { UI.toast(`Готово — перевод: ${LANGS.find(x => x[0] === lang)[1]}`, 'good', 2600); } catch (e) { /* ignore */ } }
      }));
      // the footer
      prev.classList.toggle('hide', k === 0); prev.disabled = k === 0;
      next.innerHTML = k === LAST ? '<span aria-hidden="true">🚀</span> Начать учиться' : '<span class="sc-bl">Дальше</span> <span aria-hidden="true">→</span>';
      bd.querySelectorAll('.sc-dot').forEach((d, j) => { d.classList.toggle('on', j === k); d.classList.toggle('seen', j < k); if (j === k) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current'); });
      if (k > 0) patch({ at: k }); // the place is kept (scene 0 keeps the old place for «↪ Продолжить с …»)
      const nm = el.querySelector('[data-sc-name]');
      if (nm && matchMedia('(hover: hover) and (pointer: fine)').matches) setTimeout(() => { if (!closed) nm.focus({ preventScroll: true }); }, 450);
    }

    function saveLang() {
      if (lang === trNow()) return;
      try {
        Store.setSetting('transLang', lang);
        if (window.App && App.render) App.render();
      } catch (e) { console.warn('showcase lang', e); }
    }

    function finish(kind) {
      if (closed) return;
      const inp = stage.querySelector('.sc-scene:not(.out) [data-sc-name]'); if (inp) name = inp.value;
      closed = true; stopTimers(); hush();
      if (ro) ro.disconnect();
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onResize);
      const done = kind === 'done';
      if (lang !== lang0) saveLang(); // a language picked here is never lost
      patch(done ? { seen: Date.now(), done: Date.now(), at: 0 } : { seen: Date.now(), at: i > 0 && i < LAST ? i : i === LAST ? 0 : (st().at || 0) });
      bd.classList.add('closing');
      setTimeout(() => { bd.remove(); document.documentElement.classList.remove('sc-lock'); }, reduce() ? 0 : 420);
      if (!done && kind !== 'themes' && i > 0 && i < LAST && !o.askName) {
        // the ⋯ menu exists on phones; on bigger screens the way is «Как пользоваться» (the «?» button / the side menu)
        const mb = document.getElementById('more-btn'), viaMore = !!(mb && mb.offsetParent !== null);
        const sb = document.querySelector('.sidebar [data-sb="showcase"]'), viaSide = !!(sb && sb.offsetParent !== null);
        const where = viaSide ? 'пункт «✨ Знакомство» в меню слева' : `${viaMore ? 'меню ⋯' : '«❓ Как пользоваться»'} → «✨ Знакомство с приложением»`;
        try { UI.toast(`Знакомство можно досмотреть в любой момент: ${where}`, 'good', 5000); } catch (e) { /* ignore */ }
      }
      if (back && back.focus && back.isConnected && !o.askName && kind !== 'themes') { try { back.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      cur = null;
      resolve({ name: String(name || '').trim().slice(0, 40), finished: done, at: i, lang, openThemes: wantThemes });
      // «🎨 Примерить темы»: the place is kept (like «Закрыть»), and the themes open
      if (kind === 'themes' && window.AppThemes && AppThemes.open) setTimeout(() => { try { AppThemes.open(); } catch (e) { /* ignore */ } }, reduce() ? 60 : 440);
      // pressed on the first start: after «Как вас зовут?» (the name and the language come first)
      else if (wantThemes) themesLater();
    }

    const go = d => { if (d > 0 && i === LAST) finish('done'); else show(i + d, d); };
    bd.addEventListener('click', e => {
      const sv = e.target.closest('[data-say]'); if (sv) { e.stopPropagation(); hush(); speaking = false; bd.classList.remove('speaking'); say(sv.dataset.say, 'no'); return; }
      const g = e.target.closest('[data-sc-go]'); if (g) { show(+g.dataset.scGo); return; }
      const b = e.target.closest('[data-sc]'); if (!b) return;
      const a = b.dataset.sc;
      if (a === 'next') go(1);
      else if (a === 'prev') go(-1);
      else if (a === 'skip') finish('skip');
      else if (a === 'themes') {
        // the first start: the name and the language first — the themes open right after (never on top of «Как вас зовут?»)
        if (o.askName) { wantThemes = true; show(LAST, 1); }
        else finish('themes');
      }
      else if (a === 'listen') {
        if (speaking) { hush(); speaking = false; bd.classList.remove('speaking'); return; }
        const s = SCENES[i];
        speaking = true; bd.classList.add('speaking');
        const my = i;
        try {
          const p = window.TTS && TTS.speak(`${plain(s.title)}. ${s.text} ${s.points.map(plain).map(x => x.replace(/^\S+\s/, '')).join('. ')}.`, 'ru');
          const end = () => { if (i === my) { speaking = false; bd.classList.remove('speaking'); } };
          if (p && p.then) p.then(end, end); else setTimeout(end, 4000);
        } catch (err) { speaking = false; bd.classList.remove('speaking'); }
      }
    });
    bd.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-sc-name]')) { e.preventDefault(); finish('done'); } });
    // swipe ← → — only on the empty stage: what can be touched ([data-touch]) keeps its own drag
    let sx = 0, sy = 0, sw = false;
    stage.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' || e.target.closest('input, button, label, [data-touch], [role="button"]')) { sw = false; return; } sw = true; sx = e.clientX; sy = e.clientY; });
    stage.addEventListener('pointerup', e => {
      if (!sw) return; sw = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
    });
    stage.addEventListener('pointercancel', () => { sw = false; });
    function onKey(e) {
      const top = [...document.querySelectorAll('#modal-root > .modal-backdrop:not(.closing)')].pop();
      if (top && top !== bd) return; // a window above us (a confirm) handles its own keys
      const t = e.target, ae = document.activeElement;
      const typing = t && t.matches && t.matches('input, textarea');
      // an object in the picture has the keyboard (or a card is open big): the arrows are its own
      const playing = !!stage.querySelector('.sc-scene:not(.out) .sc-lens') || (ae && stage.contains(ae) && ae.matches(':focus-visible') && ae.matches('[data-touch], [role="button"], .sc-scene button'));
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (escFn && escFn()) return; finish('skip'); }
      else if (!typing && !playing && (e.key === 'ArrowRight' || e.key === 'PageDown')) { e.preventDefault(); go(1); }
      else if (!typing && !playing && (e.key === 'ArrowLeft' || e.key === 'PageUp')) { e.preventDefault(); go(-1); }
      else if (e.key === 'Tab') { // keep the focus inside
        const f = [...bd.querySelectorAll('button:not([disabled]), input, [tabindex="0"]')].filter(x => x.offsetParent !== null && !x.closest('.sc-scene.out, [inert], [hidden]'));
        if (!f.length) return;
        const a = f.indexOf(document.activeElement);
        if (e.shiftKey && a <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && (a === -1 || a === f.length - 1)) { e.preventDefault(); f[0].focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    const onResize = () => { const sc = stage.querySelector('.sc-scene:not(.out)'), a = sc && sc.querySelector('.sc-art'); if (a) setU(a); setMore(sc); };
    window.addEventListener('resize', onResize);
    // «на главный экран» and other «close every window» paths go through bd._m
    bd._m = { el: bd, close: () => finish('skip'), tryClose: async () => { finish('skip'); return true; }, $: q => bd.querySelector(q), $$: q => [...bd.querySelectorAll(q)] };
    show(o.at > 0 ? o.at : 0, 1);
    setTimeout(() => { if (!closed && !(stage.querySelector('[data-sc-name]') && document.activeElement && document.activeElement.matches('[data-sc-name]'))) next.focus({ preventScroll: true }); }, 60);
  }

  window.Showcase = {
    SCENES,
    /** o: { askName (the first start: the last scene asks the name and the language), at (start from this scene) }
     *  → Promise<{ name, finished, at, lang, openThemes }> (openThemes: «🎨 Примерить темы» was pressed on the first start —
     *  the showcase itself opens the themes once the name is asked and no window is open) */
    open,
    /** the first start of a new user: play it once */
    shouldAuto: () => !st().seen,
    state: st,
    get active() { return !!cur; },
  };
})();
