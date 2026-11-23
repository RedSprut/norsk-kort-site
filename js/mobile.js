/* ============ 📱 Phone layout: js/mobile.js + css/mobile.css ============
 * One module that rearranges the EXISTING markup on phones (≤ 760 px, and phones held sideways). Nothing is rewritten:
 *  - html.m-phone (+ m-land sideways, m-cap inside the Capacitor app) switches every rule in css/mobile.css on;
 *    the desktop never gets the class, so it stays exactly as it was.
 *  - Mobile.sheet(): a bottom sheet in #modal-root that follows UI.modal's contract (bd._m = { close, tryClose }, the
 *    «closing» class) — drag to close, two heights, focus trap, Esc, Back, reduced motion, safe areas.
 *  - The top bar: back / logo, the screen's title, 🎧, ⋯ («Меню» sheet: profile, AI, translator, library, themes,
 *    every section of the side menu, help).
 *  - Study «focus mode»: a slim header (✕ · progress · ↶ · ⤢ · ⋯), the card fills the screen, the answer buttons stay in
 *    the thumb zone. ⋯ opens one sheet with the tabs Карточка / Озвучка / Занятие that BORROWS the real buttons
 *    (moved in, put back on close) — so every click still reaches Study.onClick and nothing is duplicated.
 *  - ⤢ full-screen card (tap flips, swipe grades — the existing gestures of js/study.js); phones held sideways get the
 *    card on the left and the answer buttons in a column on the right.
 *  - Every window (UI.modal) is a bottom sheet here too: grabber, pull down to close (modalSheet).
 *  - Back: one for everything — js/nav.js (menu → sheet / window → full screen → study → previous screen).
 */
(function () {
  'use strict';
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  if (!window.App || !window.Study || !window.UI) return;

  const html = document.documentElement;
  const mqPhone = matchMedia('(max-width: 760px), (max-height: 500px) and (orientation: landscape) and (pointer: coarse)');
  const mqLand = matchMedia('(max-height: 500px) and (orientation: landscape)');
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const reduce = () => mqReduce.matches;
  const isCap = () => { try { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); } catch (e) { return false; } };
  const esc = s => (window.U && U.esc ? U.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const modalRoot = () => document.getElementById('modal-root');
  const openBackdrops = () => [...(modalRoot() ? modalRoot().children : [])].filter(b => b.classList.contains('modal-backdrop') && !b.classList.contains('closing'));
  const S = () => Study.session;
  const inStudy = () => App.view && App.view.name === 'study';

  const svg = (d, s = 22, extra = '') => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;
  const ICO = {
    close: s => svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', s),
    undo: s => svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>', s),
    more: s => svg('<circle cx="5" cy="12" r="1.9" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.9" fill="currentColor" stroke="none"/>', s),
    expand: s => svg('<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>', s),
    shrink: s => svg('<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/>', s),
    back: s => svg('<path d="m15 18-6-6 6-6"/>', s, ' stroke-width="2.4"'),
    chev: s => svg('<path d="m9 18 6-6-6-6"/>', s),
    down: s => svg('<path d="m6 9 6 6 6-6"/>', s),
  };

  /* ---------------- borrowing: move a real node into a sheet, put it back later ---------------- */
  const borrowed = []; // { node, parent, next, group }
  function borrow(node, into, group) {
    if (!node || !into) return null;
    borrowed.push({ node, parent: node.parentNode, next: node.nextSibling, group });
    into.appendChild(node);
    return node;
  }
  function unborrow(group) {
    for (let i = borrowed.length - 1; i >= 0; i--) {
      const r = borrowed[i];
      if (group && r.group !== group) continue;
      borrowed.splice(i, 1);
      try {
        if (r.parent && r.parent.isConnected) r.parent.insertBefore(r.node, r.next && r.next.parentNode === r.parent ? r.next : null);
        else r.node.remove(); // the place was redrawn meanwhile (a new card): the old copy is not needed
      } catch (e) { r.node.remove(); }
    }
  }

  /* =====================================================================
   * 🧾 BOTTOM SHEET
   * ===================================================================== */
  let sheetSeq = 0, curSheet = null, kbdUsed = false;
  document.addEventListener('keydown', e => { if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') kbdUsed = true; }, true);
  document.addEventListener('pointerdown', () => { kbdUsed = false; }, true);
  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const INERT = ['#view', '.topbar', '.tabbar', '#sidebar'];

  /**
   * sheet({ title, head (html instead of the title), body (html | Node), cls, detent: 'medium' | 'large', label,
   *         onMount(sh), onClose(), onClick(e, sh) }) → { el, bd, body, close, tryClose, setDetent }
   */
  function sheet(o = {}) {
    if (curSheet) curSheet.close(true);
    const id = 'msh' + (++sheetSeq);
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop m-sheet-bd' + (reduce() ? ' m-still' : '');
    bd.dataset.detent = o.detent || 'medium';
    bd.innerHTML = `<section class="m-sheet ${o.cls || ''}" role="dialog" aria-modal="true" aria-labelledby="${id}-t">
      <button type="button" class="m-grab" aria-label="Изменить высоту окна" title="Потяните вниз — закрыть"><i></i></button>
      <header class="m-sheet-head">${o.head ? `<h2 id="${id}-t" class="m-vh">${esc(o.label || o.title || 'Меню')}</h2>${o.head}` : `<h2 id="${id}-t" tabindex="-1">${o.title || ''}</h2>`}
        <button type="button" class="m-x" data-m-close aria-label="Закрыть" title="Закрыть">${ICO.close(20)}</button></header>
      <div class="m-sheet-body"></div>
    </section>`;
    const sh = bd.firstElementChild, body = sh.querySelector('.m-sheet-body'), grab = sh.querySelector('.m-grab');
    if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.appendChild(o.body);
    const opener = document.activeElement;
    modalRoot().appendChild(bd);
    const inerted = INERT.map(s => $(s)).filter(el => el && !el.inert);
    inerted.forEach(el => { el.inert = true; });

    let closed = false;
    const api = { el: sh, bd, body, id };
    const close = (instant) => {
      if (closed) return; closed = true;
      if (curSheet === api) curSheet = null;
      bd.classList.add('closing');
      document.removeEventListener('keydown', onKey, true);
      inerted.forEach(el => { el.inert = false; });
      try { o.onClose && o.onClose(); } catch (e) { console.warn('sheet close', e); }
      if (instant || reduce()) { setTimeout(() => bd.remove(), instant ? 0 : 140); }
      else {
        sh.style.transition = 'transform .26s cubic-bezier(.4,0,1,1)';
        sh.style.transform = 'translateY(105%)';
        setTimeout(() => bd.remove(), 270);
      }
      if (opener && opener.isConnected && opener.focus && !instant && opener !== document.body) { try { opener.focus({ preventScroll: true, focusVisible: kbdUsed }); } catch (e) { /* ignore */ } }
      setTimeout(Back.arm, 60);
    };
    api.close = close;
    api.tryClose = async () => { close(); return true; };
    api.setDetent = d => { bd.dataset.detent = d; };
    bd._m = { el: sh, close, tryClose: api.tryClose, $: s => sh.querySelector(s), $$: s => [...sh.querySelectorAll(s)] };

    // Esc (only the window on top) + Tab stays inside
    const onKey = e => {
      const open = openBackdrops();
      if (open[open.length - 1] !== bd) return;
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); return; }
      if (e.key === 'Tab') {
        const f = [...sh.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null || x === document.activeElement);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || !sh.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (document.activeElement === last || !sh.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    bd.addEventListener('click', e => { if (e.target === bd) close(); });
    sh.addEventListener('click', e => {
      if (e.target.closest('[data-m-close]')) { close(); return; }
      if (o.onClick) o.onClick(e, api);
    });

    /* drag: the grabber and the header always; the content only when it is scrolled to the top and pulled down */
    let drag = null, lastDrag = 0;
    const H = () => sh.getBoundingClientRect().height || 1;
    const dStart = (y, t) => { drag = { y0: y, dy: 0, raw: 0, pts: [{ y, t }], h: H(), moved: false }; sh.style.transition = 'none'; };
    const dMove = (y, t) => {
      if (!drag) return;
      const raw = y - drag.y0;
      if (Math.abs(raw) > 6) drag.moved = true;
      drag.raw = raw; drag.dy = raw < 0 ? raw * 0.22 : raw;
      drag.pts.push({ y, t }); if (drag.pts.length > 8) drag.pts.shift();
      sh.style.transform = `translateY(${drag.dy}px)`;
      bd.style.setProperty('--m-bd', String(1 - Math.min(1, Math.max(0, drag.dy / drag.h))));
    };
    const dEnd = () => {
      if (!drag) return;
      const d = drag; drag = null;
      if (d.moved) lastDrag = Date.now();
      const last = d.pts[d.pts.length - 1], first = d.pts.find(p => last.t - p.t < 120) || d.pts[0];
      const v = (last.y - first.y) / Math.max(1, last.t - first.t); // px / ms, + = down
      sh.style.transition = ''; bd.style.removeProperty('--m-bd');
      if (d.raw > d.h * 0.25 || (v > 0.45 && d.raw > 24)) {
        if (bd.dataset.detent === 'large' && d.raw < d.h * 0.45 && v < 1.1 && !o.noMedium) { sh.style.transform = ''; api.setDetent('medium'); return; }
        close(); return;
      }
      if ((d.raw < -40 || v < -0.4) && !o.noLarge) api.setDetent('large');
      sh.style.transform = '';
    };
    const pDown = e => {
      if (e.button > 0 || (!Mobile.on && e.pointerType === 'mouse')) return; // a computer: a centred window, closed by ✕ / Esc / outside
      if (e.target.closest('button:not(.m-grab), a, input, select, textarea, [role="tab"]')) return;
      dStart(e.clientY, e.timeStamp);
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    };
    [grab, sh.querySelector('.m-sheet-head')].forEach(el => {
      el.addEventListener('pointerdown', pDown);
      el.addEventListener('pointermove', e => { if (drag) dMove(e.clientY, e.timeStamp); });
      el.addEventListener('pointerup', dEnd);
      el.addEventListener('pointercancel', dEnd);
    });
    grab.addEventListener('click', () => { if (Date.now() - lastDrag < 300) return; api.setDetent(bd.dataset.detent === 'large' ? 'medium' : 'large'); });
    let ty = null, tx = 0, tScroll = false;
    body.addEventListener('touchstart', e => { ty = e.touches.length === 1 ? e.touches[0].clientY : null; tx = ty == null ? 0 : e.touches[0].clientX; tScroll = body.scrollTop > 0; }, { passive: true });
    body.addEventListener('touchmove', e => {
      if (ty == null) return;
      const y = e.touches[0].clientY, dx = e.touches[0].clientX - tx;
      if (!drag) {
        if (Math.abs(dx) > Math.abs(y - ty)) { if (Math.abs(dx) > 10) ty = null; return; } // sideways (a list that scrolls sideways): not ours
        if (tScroll || body.scrollTop > 0 || y - ty <= 0) { if (y - ty < -4) ty = null; return; }
        if (e.cancelable) e.preventDefault(); // ours from the first move down (no overscroll of the page)
        if (y - ty < 8) return;
        dStart(ty, e.timeStamp);
      }
      if (e.cancelable) e.preventDefault();
      dMove(y, e.timeStamp);
    }, { passive: false });
    body.addEventListener('touchend', () => { ty = null; dEnd(); });
    body.addEventListener('touchcancel', () => { ty = null; dEnd(); });

    curSheet = api;
    try { o.onMount && o.onMount(api); } catch (e) { console.warn('sheet mount', e); }
    // focus: the title (screen readers hear what opened), keyboard users continue with Tab
    requestAnimationFrame(() => { const t = sh.querySelector('[data-m-autofocus]') || sh.querySelector('h2[tabindex]') || sh; try { (t === sh ? (sh.setAttribute('tabindex', '-1'), sh) : t).focus({ preventScroll: true }); } catch (e) { /* ignore */ } });
    Back.arm();
    return api;
  }
  /** close the sheet first, then do it — a window never opens on top of a sheet */
  function thenDo(fn) {
    if (curSheet) curSheet.close();
    requestAnimationFrame(() => setTimeout(() => { try { fn(); } catch (e) { console.warn('mobile action', e); } }, 30));
  }

  /* =====================================================================
   * ☰ «МЕНЮ» (the ⋯ of the top bar on phones)
   * ===================================================================== */
  const SB_SKIP = new Set(['home', 'decks', 'stats', 'settings', 'help', 'showcase', 'looks', 'nav', 'bookshelf', 'new', 'deck', 'deck-del']);
  function moreSheet() {
    const st = Store.settings || {};
    const dark = html.dataset.theme === 'dark';
    const on = AI.available && AI.available();
    const aiName = on && AI.PROVIDERS && AI.PROVIDERS[AI.current()] ? AI.PROVIDERS[AI.current()].name : '';
    const name = String(st.userName || '').trim();
    const sb = document.getElementById('sidebar');
    const places = sb ? $$(':scope > .sb-item[data-sb]', sb).filter(b => !SB_SKIP.has(b.dataset.sb)) : [];
    const tile = (k, ico, label, sub = '', attrs = '') => `<button type="button" class="m-tile" data-m-go="${k}" ${attrs}><span class="m-tile-i" aria-hidden="true">${ico}</span><span class="m-tile-l">${label}</span>${sub ? `<small>${sub}</small>` : ''}</button>`;
    const body = `
      <button type="button" class="m-row m-profile" data-m-go="account">
        <span class="m-ava">${window.Account && Account.avatarHtml ? Account.avatarHtml(44) : '🙂'}</span>
        <span class="m-row-t"><b>${name ? esc(name) : 'Мой профиль'}</b><small>${window.CloudSync && window.Account && Account.user && CloudSync.text() ? `${NavIcons.icon('cloud', 14)} ${esc(CloudSync.text())}` : 'Мой кабинет · фото, имя, облако'}</small></span>${ICO.chev(18)}</button>
      <button type="button" class="m-row m-ai ${on ? 'on' : 'off'}" data-action="ai-menu" aria-haspopup="dialog" aria-label="Нейросеть: ${on ? esc(aiName) : 'не подключена'}">
        <span class="m-ai-i" aria-hidden="true">${App.aiBot ? App.aiBot(on) : '🤖'}</span>
        <span class="m-row-t"><b>${on ? `Нейросеть: ${esc(aiName)}` : 'Нейросеть не подключена'}</b><small>${on ? 'Проверяет карточки и переводит · сменить' : 'Подключить — Gemini и Groq бесплатно'}</small></span>${ICO.chev(18)}</button>
      <div class="m-tiles">
        ${window.Interp ? tile('interp', '🗣', 'Переводчик', 'в наушниках') : ''}
        ${window.Views && Views.openLibrary ? tile('library', '📚', 'Библиотека', 'читать, слушать') : ''}
        ${window.ShareApp ? tile('share', '🔗', 'Поделиться', 'приложением') : ''}
        ${window.AppThemes ? tile('apptheme', '🎨', 'Оформление', 'темы и карточки') : ''}
        ${tile('theme', dark ? '🌞' : '🌙', dark ? 'Светлая тема' : 'Тёмная тема', 'вид экрана')}
        ${window.AppNav ? tile('appnav', '🧭', 'Навигатор', 'помощь и пути') : window.Help ? tile('help', '❓', 'Как пользоваться', 'подсказки') : ''}
      </div>
      ${places.length ? `<div class="m-sec-t">Разделы</div><div class="m-list">${places.map(b => {
        const ico = b.innerHTML.replace(/<span>[\s\S]*?<\/span>\s*$/, '');
        const lbl = (b.querySelector('span:last-of-type') || b).textContent.trim();
        return `<button type="button" class="m-row m-place" data-m-sb="${esc(b.dataset.sb)}"><span class="m-place-i" aria-hidden="true">${ico}</span><span class="m-row-t"><b>${esc(lbl)}</b></span>${ICO.chev(16)}</button>`;
      }).join('')}</div>` : ''}
      ${!window.AppNav && window.Showcase ? `<div class="m-list m-list-end"><button type="button" class="m-row m-place" data-m-go="showcase"><span class="m-place-i" aria-hidden="true">✨</span><span class="m-row-t"><b>Знакомство с приложением</b><small>короткий показ всех возможностей</small></span>${ICO.chev(16)}</button></div>` : ''}`;
    sheet({
      title: 'Меню', body, cls: 'm-menu-sheet', detent: 'medium',
      onClick(e) {
        const go = e.target.closest('[data-m-go]'), sbBtn = e.target.closest('[data-m-sb]');
        if (go) {
          const k = go.dataset.mGo;
          if (k === 'theme') { // instant: the sheet stays, so the change is seen behind it
            Store.setSetting('theme', html.dataset.theme === 'dark' ? 'light' : 'dark'); App.applyTheme(); if (App.view.name === 'settings') App.render();
            const d = html.dataset.theme === 'dark';
            go.querySelector('.m-tile-i').textContent = d ? '🌞' : '🌙'; go.querySelector('.m-tile-l').textContent = d ? 'Светлая тема' : 'Тёмная тема';
            return;
          }
          const run = {
            account: () => App.goAsk('account'), interp: () => Interp.toggle(), library: () => Views.openLibrary(), share: () => ShareApp.open(),
            apptheme: () => Views.looksSheet(App.view.name === 'deck' ? App.view.params.id : null), help: () => Help.open(), showcase: () => Showcase.open(),
            appnav: () => AppNav.open(),
          }[k];
          if (run) thenDo(run);
          return;
        }
        if (sbBtn) { const k = sbBtn.dataset.mSb; thenDo(() => { const b = document.querySelector(`#sidebar [data-sb="${CSS.escape(k)}"]`); if (b) b.click(); }); }
        // data-action="ai-menu" goes on to js/app.js → js/aichooser.js: the «Нейросети» sheet takes this one's place
      },
    });
  }
  // a menu opened from a sheet (🤖 AI, translator «ещё»): picking an item closes the sheet too
  document.addEventListener('click', e => {
    if (!curSheet || !e.target.closest || !e.target.closest('.dropdown-menu button, .popover button, .popover a[href]')) return;
    const s = curSheet; setTimeout(() => { if (curSheet === s) s.close(); }, 0);
  }, true);

  /* =====================================================================
   * 🃏 STUDY: focus mode
   * ===================================================================== */
  const STAY = new Set(['dir', 'trlang', 'hints', 'read', 'speed', 'tts-toggle', 'tts-stop', 'stop-tts', 'tts-restart', 'native', 'slow', 'tr:more']);
  let studyTab = (() => { try { return sessionStorage.getItem('m-study-tab') || 'card'; } catch (e) { return 'card'; } })();
  let studySh = null, explainSh = null;

  function head() { return $('#view .study > .m-study-head'); }
  function afterStudyRender() {
    const st = $('#view .study'); if (!st) return;
    let h = head();
    if (!h) {
      h = document.createElement('div');
      h.className = 'm-study-head';
      h.innerHTML = `<button type="button" class="m-hbtn m-exit" data-act="exit" aria-label="Закончить занятие" title="Закончить занятие (Esc)">${ICO.close(22)}</button>
        <div class="m-prog"></div>
        <button type="button" class="m-hbtn m-undo" data-act="undo" aria-label="Отменить последний ответ" title="Отменить последний ответ (Z)" hidden>${ICO.undo(21)}</button>
        <button type="button" class="m-hbtn m-full" data-m="full" aria-label="Карточка во весь экран" title="Во весь экран (F)">${ICO.expand(20)}</button>
        <button type="button" class="m-hbtn m-more" data-m="study-more" aria-label="Все настройки занятия" title="Все настройки: озвучка, карточка, занятие" aria-haspopup="dialog">${ICO.more(22)}</button>`;
      st.prepend(h);
    }
    unborrow('study-shell'); // a redrawn session: the old progress bar is gone with it
    const prog = $('.study-top .progress', st);
    if (prog) borrow(prog, $('.m-prog', h), 'study-shell');
    if (studySh) fillStudyTab(studySh, studyTab);
    st.classList.add('m-focus');
    st.dataset.mMode = (S() && S().mode) || 'flip';
    syncHead();
    scheduleHint();
  }
  function syncHead() {
    const h = head(), s = S(); if (!h || !s) return;
    const u = $('.m-undo', h); if (u) u.hidden = !(s.history && s.history.length) || !!s.finished;
    const f = $('.m-full', h);
    if (f) {
      const imm = html.classList.contains('m-immersive');
      f.hidden = !!s.finished || s.mode === 'type' || s.mode === 'quiz';
      f.innerHTML = imm ? ICO.shrink(20) : ICO.expand(20);
      f.setAttribute('aria-label', imm ? 'Выйти из полноэкранного режима' : 'Карточка во весь экран');
      f.title = imm ? 'Обычный вид (Esc)' : 'Во весь экран (F)';
      f.setAttribute('aria-pressed', imm ? 'true' : 'false');
    }
    const m = $('.m-more', h); if (m) m.hidden = !!s.finished;
    if (s.finished) {
      const x = $('.m-exit', h);
      if (x) { x.dataset.act = 'to-deck'; const l = s.deckId ? 'К колоде' : 'На главную'; x.setAttribute('aria-label', l); x.title = l; }
    }
  }
  function afterCard() {
    syncHead();
    const st = $('#view .study'); if (!st) return;
    st.dataset.mMode = (S() && S().mode) || 'flip';
    // the ⋯ sheet is open while the card was redrawn (direction, language, hints, art…): take the fresh buttons
    if (studySh && (studyTab === 'card' || studyTab === 'read')) fillStudyTab(studySh, studyTab);
    else if (studySh && studyTab === 'session') syncArtSeg(studySh.el);
    watchExplain();
    const back = $('#view [data-card] .face.back');
    if (back) back.querySelectorAll('img').forEach(img => { if (!img.complete) img.addEventListener('load', () => { if (S() && S().flipped) fitBack(); }, { once: true }); });
    if (S() && S().flipped) requestAnimationFrame(fitBack);
  }

  /* back side: fit without inner scrolling where possible; the rest behind «Подробнее» */
  function fitBack() {
    if (!Mobile.on) return;
    const face = $('#view [data-card] .face.back');
    if (!face || face.classList.contains('ac-face')) return;
    if (face.classList.contains('m-fit-open')) return;
    face.classList.remove('m-fit-1', 'm-fit-2');
    face.querySelectorAll('.m-detail').forEach(b => b.remove());
    const over = () => face.scrollHeight > face.clientHeight + 4;
    if (!over()) return;
    face.classList.add('m-fit-1');
    if (!over()) return;
    face.classList.add('m-fit-2');
    face.scrollTop = 0;
    face.insertAdjacentHTML('beforeend', `<button type="button" class="m-detail" data-m="detail" aria-label="Показать всю карточку">Подробнее ${ICO.down(16)}</button>`);
  }

  /* 🤖 «Объяснить»: the answer would land under the answer buttons — show it in a sheet instead */
  let exObs = null;
  function watchExplain() {
    if (exObs) { exObs.disconnect(); exObs = null; }
    const box = $('#view [data-explain]'); if (!box) return;
    exObs = new MutationObserver(() => {
      if (!Mobile.on) return;
      const full = !!box.firstElementChild;
      if (full && !explainSh) {
        explainSh = sheet({
          title: `${BOT(22)} Объяснение`, cls: 'm-explain-sheet', detent: 'large',
          onMount: sh => borrow(box, sh.body, 'explain'),
          onClose: () => { explainSh = null; unborrow('explain'); },
          onClick: e => { if (inStudy() && S()) Study.onClick(e); },
        });
      } else if (!full && explainSh && explainSh.body.contains(box)) explainSh.close();
    });
    exObs.observe(box, { childList: true });
  }

  /* ---------- the ⋯ sheet of the study: Карточка / Озвучка / Занятие ---------- */
  const TABS = [['card', 'Карточка'], ['read', 'Озвучка'], ['session', 'Занятие']];
  function studySheet(tab) {
    const s = S(); if (!s || s.finished) return;
    if (tab) studyTab = tab;
    if (!TABS.some(t => t[0] === studyTab)) studyTab = 'card';
    const headHtml = `<div class="m-tabs" role="tablist" aria-label="Разделы">${TABS.map(([k, l]) => `<button type="button" role="tab" id="m-tab-${k}" data-m-tab="${k}" aria-controls="m-tabpanel" aria-selected="${k === studyTab}" tabindex="${k === studyTab ? 0 : -1}">${l}</button>`).join('')}</div>`;
    markHintSeen('study-more');
    studySh = sheet({
      head: headHtml, label: 'Все настройки занятия', cls: 'm-study-sheet', detent: 'medium',
      onMount: sh => { sh.body.id = 'm-tabpanel'; sh.body.setAttribute('role', 'tabpanel'); fillStudyTab(sh, studyTab); },
      onClose: () => { studySh = null; unborrow('tab'); },
      onClick: onStudySheetClick,
    });
    // ← → between the tabs (WAI-ARIA tabs)
    studySh.el.querySelector('.m-tabs').addEventListener('keydown', e => {
      const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (!k) return;
      e.preventDefault();
      const i = TABS.findIndex(t => t[0] === studyTab), n = TABS[(i + k + TABS.length) % TABS.length][0];
      fillStudyTab(studySh, n); const b = studySh.el.querySelector(`[data-m-tab="${n}"]`); if (b) b.focus();
    });
  }
  function fillStudyTab(sh, tab) {
    const s = S(); if (!s) return;
    unborrow('tab');
    studyTab = tab; try { sessionStorage.setItem('m-study-tab', tab); } catch (e) { /* ignore */ }
    sh.el.querySelectorAll('[data-m-tab]').forEach(b => { const on = b.dataset.mTab === tab; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    sh.body.setAttribute('aria-labelledby', 'm-tab-' + tab);
    const v = $('#view');
    const sec = (t, slot, note = '') => `<section class="m-sec"><div class="m-sec-t">${t}</div><div class="m-slot" data-slot="${slot}"></div>${note ? `<p class="m-note">${note}</p>` : ''}</section>`;
    if (tab === 'card') {
      sh.body.innerHTML = sec('Эта карточка', 'tools') + sec('Проверить перевод', 'rails', 'Сравнить перевод карточки с переводчиками и словарями.');
      borrow($('.tools-card', v), $('[data-slot="tools"]', sh.body), 'tab');
      const rails = $('[data-slot="rails"]', sh.body);
      $$('[data-card] .face.back .card-rail', v).forEach(r => borrow(r, rails, 'tab'));
      if (!rails.children.length) rails.closest('.m-sec').remove();
    } else if (tab === 'read') {
      sh.body.innerHTML = sec('Озвучка', 'read');
      borrow($('.tools-read', v), $('[data-slot="read"]', sh.body), 'tab');
      // 🔊 the cards' own voice (🔊 Голоса → «Где какой голос») — unless the study screen already has the button
      if (window.Voices && Voices.openChooser && !$('[data-slot="read"] [data-voices-place]', sh.body)) {
        sh.body.insertAdjacentHTML('beforeend', `<div class="m-list m-list-end">${Voices.LANGS.map(l => `<button type="button" class="m-row" data-voices-open="${l}" data-voices-place="cards"><span class="m-place-i" aria-hidden="true">${Voices.FLAG[l]}</span><span class="m-row-t"><b>${Voices.LANG_NAME[l]} голос</b><small>${U.esc(Voices.label(l, '', 'cards'))}</small></span></button>`).join('')}</div>`);
      }
    } else {
      const art = window.ArtCards && $('.ac-study-toggle', v);
      sh.body.innerHTML = `${art ? `<section class="m-sec"><div class="m-sec-t">Вид карточки</div><div class="m-seg" role="radiogroup" aria-label="Вид карточки">
          <button type="button" role="radio" data-m-art="off"><span aria-hidden="true">🔤</span> Текстом</button>
          <button type="button" role="radio" data-m-art="on"><span aria-hidden="true">🖼</span> Картинкой</button></div></section>` : ''}
        ${$('.dir-switch', v) ? sec('Направление', 'dir', 'Что показывать на лицевой стороне.') : ''}
        ${$('.study-top .tr-seg, .session-tools .tr-seg', v) ? sec('Язык перевода', 'tr') : ''}
        ${sec('Подсказки', 'hints', 'Картинка, часть речи и значки на лицевой стороне. Без них проверка строже.')}
        ${sec('Занятие', 'session')}
        <div class="m-list m-list-end">
          <button type="button" class="m-row" data-m="full"><span class="m-place-i" aria-hidden="true">${ICO.expand(20)}</span><span class="m-row-t"><b>Карточка во весь экран</b><small>Нажатие — перевернуть, свайп → знаю, ← не знаю</small></span></button>
          ${window.Help ? `<button type="button" class="m-row" data-m="help"><span class="m-place-i" aria-hidden="true">❓</span><span class="m-row-t"><b>Как учить</b><small>Подсказки к этому экрану</small></span></button>` : ''}
        </div>`;
      borrow($('.dir-switch', v), $('[data-slot="dir"]', sh.body), 'tab');
      borrow($('.session-tools .tr-seg', v), $('[data-slot="tr"]', sh.body), 'tab');
      const hb = $('.study-top [data-act="hints"]', v); if (hb) borrow(hb, $('[data-slot="hints"]', sh.body), 'tab');
      const ses = $('[data-slot="session"]', sh.body);
      ['all-cards', 'reshuffle'].forEach(a => borrow($(`.session-tools [data-act="${a}"]`, v), ses, 'tab'));
      syncArtSeg(sh.el);
    }
  }
  function syncArtSeg(root) {
    const s = S(); if (!s || !window.ArtCards) return;
    const on = ArtCards.studyOn(s);
    root.querySelectorAll('[data-m-art]').forEach(b => { const a = (b.dataset.mArt === 'on') === on; b.setAttribute('aria-checked', a); b.classList.toggle('active', a); });
  }
  function onStudySheetClick(e, sh) {
    if (!inStudy() || !S()) return;
    const tabBtn = e.target.closest('[data-m-tab]');
    if (tabBtn) { fillStudyTab(sh, tabBtn.dataset.mTab); return; }
    const art = e.target.closest('[data-m-art]');
    if (art) {
      const want = art.dataset.mArt === 'on';
      if (want !== ArtCards.studyOn(S())) { const t = $('#view .ac-study-toggle'); if (t) t.click(); }
      syncArtSeg(sh.el);
      return;
    }
    // everything else from the borrowed buttons: instant toggles go straight to Study (the sheet stays)
    Study.onClick(e);
  }
  // capture (before the app's own document listeners): actions that open a window / change the screen close the sheet first
  window.addEventListener('click', e => {
    if (!studySh || !e.target.closest || !studySh.el.contains(e.target)) return;
    const a = e.target.closest('[data-act], [data-tr], [data-ai], [data-speech-pron], [data-m]');
    if (!a || !studySh.el.contains(a)) return;
    if (a.dataset.m) { e.stopPropagation(); e.preventDefault(); const k = a.dataset.m; thenDo(() => runM(k)); return; }
    const key = a.dataset.act || (a.dataset.tr ? 'tr:' + a.dataset.tr : a.dataset.ai ? 'ai' : 'speech');
    if (STAY.has(key)) return;
    e.stopPropagation(); e.preventDefault();
    thenDo(() => { if (a.isConnected) a.click(); }); // the real button is back in its place: a real click → Study.onClick
  }, true);

  function runM(k, el) {
    if (k === 'study-more') studySheet();
    else if (k === 'full') immersive(!html.classList.contains('m-immersive'));
    else if (k === 'help') { if (window.Help) Help.open('study'); }
    else if (k === 'detail') {
      const face = el && el.closest('.face.back');
      if (face) { face.classList.remove('m-fit-2'); face.classList.add('m-fit-open'); el.remove(); }
    }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-m]');
    if (!b || !Mobile.on || (curSheet && curSheet.el.contains(b))) return;
    e.stopPropagation();
    runM(b.dataset.m, b);
  });

  /* ---------- ⤢ full-screen card ---------- */
  function immersive(on) {
    const s = S();
    if (on && (!s || s.finished || s.mode === 'type' || s.mode === 'quiz')) on = false;
    if (on && Store.settings.swipeMode === 'off') {
      UI.toast('Свайпы выключены — кнопки ответа остаются внизу. Включить: Настройки → «Жесты и свайпы»', '', 4200);
    }
    html.classList.toggle('m-immersive', !!on);
    html.classList.toggle('m-imm-btns', !!on && Store.settings.swipeMode === 'off');
    syncHead();
    if (on) { markHintSeen('study-full'); Back.arm(); }
    requestAnimationFrame(() => { if (S() && S().flipped) fitBack(); });
  }

  /* ---------- 👋 first-time hint: «Все настройки — здесь» ---------- */
  const TKEY = 'nk-m-tips';
  const tips = () => { try { return JSON.parse(localStorage.getItem(TKEY) || '{}') || {}; } catch (e) { return {}; } };
  function markHintSeen(k) { try { const t = tips(); if (!t[k]) { t[k] = Date.now(); localStorage.setItem(TKEY, JSON.stringify(t)); } } catch (e) { /* private mode */ } $$('.m-hint').forEach(x => x.dispatchEvent(new Event('m-gone'))); }
  let hintT = 0, hintStart = 0;
  function scheduleHint() {
    if (tips()['study-more']) return;
    clearTimeout(hintT); hintStart = Date.now();
    const tryShow = () => {
      hintT = 0;
      if (!Mobile.on || !inStudy() || !S() || S().finished || tips()['study-more']) return;
      const busy = document.querySelector('#nkp, body > .hl, .hc-here, .nk-hint, .hc-hint, .lt-hint, .dropdown-menu, .popover') || openBackdrops().length || (window.Help && Help.now && Help.now());
      if (busy) { if (Date.now() - hintStart < 60000) hintT = setTimeout(tryShow, 1500); return; }
      const b = $('#view .m-study-head .m-more'); if (!b || b.offsetParent === null) return;
      // the first-visit coach of this screen (js/coachmarks.js) shows ⋯ itself: let it come first, then no second explanation
      let c = 0; try { c = (JSON.parse(localStorage.getItem('nk-help') || '{}').coach || {})['cm-study'] || 0; } catch (e) { /* ignore */ }
      if (c && c >= hintStart - 1000) { markHintSeen('study-more'); return; }
      if (!c && window.CoachMarks && Date.now() - hintStart < 9000) { hintT = setTimeout(tryShow, 1500); return; }
      showHint(b, 'Все настройки — здесь', 'Озвучка, направление, подсказки, «Редактировать», проверка перевода — нажмите ⋯', 'study-more');
    };
    hintT = setTimeout(tryShow, 1600);
  }
  function showHint(target, title, text, key) {
    const tip = document.createElement('div');
    tip.className = 'nk-hint m-hint' + (reduce() ? ' m-still' : '');
    tip.setAttribute('role', 'status');
    tip.innerHTML = `<b>${esc(title)}</b><span>${esc(text)}</span><button type="button" class="m-hint-x" aria-label="Понятно, закрыть подсказку">Понятно</button>`;
    // the hint never blocks what is under it (e.g. the card's ✏️ pencil): taps go through it and close it; only «Понятно» is a button
    tip.style.pointerEvents = 'none';
    tip.querySelector('.m-hint-x').style.pointerEvents = 'auto';
    document.body.appendChild(tip);
    target.classList.add('m-pulse');
    const place = () => {
      if (!tip.isConnected) return;
      const r = target.getBoundingClientRect(), w = tip.offsetWidth, vw = document.documentElement.clientWidth;
      const left = Math.max(10, Math.min(vw - w - 10, r.left + r.width / 2 - w / 2));
      tip.style.left = left + 'px'; tip.style.top = (r.bottom + 12) + 'px';
      tip.style.setProperty('--arrow', Math.max(18, Math.min(w - 18, r.left + r.width / 2 - left)) + 'px');
    };
    place(); requestAnimationFrame(place);
    window.addEventListener('resize', place);
    let gone = false;
    const bye = () => {
      if (gone) return; gone = true;
      markHintSeen(key);
      target.classList.remove('m-pulse');
      window.removeEventListener('resize', place); document.removeEventListener('pointerdown', outside, true);
      tip.classList.add('out'); setTimeout(() => tip.remove(), reduce() ? 0 : 250);
    };
    const outside = e => { if (!tip.contains(e.target)) bye(); };
    tip.addEventListener('m-gone', bye);
    tip.querySelector('.m-hint-x').addEventListener('click', bye);
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 400);
    setTimeout(bye, 9000);
  }

  /* =====================================================================
   * 🧭 SHELL: title, back, aria-current, deck launcher
   * ===================================================================== */
  const ROOTS = new Set(['home', 'stats', 'settings']);
  const TITLES = { home: 'Колоды', stats: 'Статистика', settings: 'Настройки', account: 'Мой кабинет', klokka: 'Время · Klokka' };
  let titleIO = null;
  function shell() {
    const tb = $('.topbar'); if (!tb) return;
    let back = $('.m-back', tb), title = $('.m-title', tb);
    if (!back) {
      back = document.createElement('button');
      back.type = 'button'; back.className = 'icon-btn m-back'; back.setAttribute('aria-label', 'Назад'); back.title = 'Назад';
      back.innerHTML = ICO.back(22);
      back.addEventListener('click', () => Mobile.back());
      tb.prepend(back);
    }
    if (!title) {
      title = document.createElement('h1'); title.className = 'm-title';
      const right = $('.topbar-right', tb); tb.insertBefore(title, right);
    }
    const v = App.view || { name: 'home', params: {} };
    let t = TITLES[v.name] || '';
    if (v.name === 'deck') { const d = Store.deck && Store.deck(v.params.id); t = d ? d.name : 'Колода'; }
    title.textContent = t;
    title.classList.remove('m-title-off');
    if (titleIO) { titleIO.disconnect(); titleIO = null; }
    const big = v.name === 'deck' && $('#view .deck-cover.big h1, #view .deck-head h1, #view .ac-hero-h');
    if (big && window.IntersectionObserver) {
      // the deck page shows its name big already: the bar takes it over only once it has scrolled away
      title.classList.add('m-title-off');
      titleIO = new IntersectionObserver(([en]) => title.classList.toggle('m-title-off', en.isIntersecting || en.boundingClientRect.top > 0), { rootMargin: `-${Math.round(tb.getBoundingClientRect().height)}px 0px 0px 0px` });
      titleIO.observe(big);
    }
    tb.classList.toggle('m-inner', !ROOTS.has(v.name));
    $$('.tabbar [data-nav]').forEach(b => { if (b.classList.contains('active')) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const more = document.getElementById('more-btn');
    if (more) { more.setAttribute('aria-label', 'Меню: разделы, профиль, тема, помощь'); more.setAttribute('aria-haspopup', 'dialog'); }
  }
  function unshell() {
    if (titleIO) { titleIO.disconnect(); titleIO = null; }
    $$('.topbar .m-back, .topbar .m-title').forEach(x => x.remove());
    const tb = $('.topbar'); if (tb) tb.classList.remove('m-inner');
    const more = document.getElementById('more-btn');
    if (more) { more.setAttribute('aria-label', 'Ещё'); more.removeAttribute('aria-haspopup'); }
  }
  /* the deck page (v210): the summary line «Карточки · 🇳🇴→🇷🇺 · … ✎ Изменить» is the same on every screen now (js/views.js
     Views.sessionSheet) — the old phone-only «⚙ Настроить занятие» fold is gone; undeck() only tidies an old page */
  function undeck() { $$('#view .m-launch-sum').forEach(x => x.remove()); $$('#view .launcher.m-launch').forEach(l => l.classList.remove('m-launch', 'm-open')); }

  /* =====================================================================
   * ⬅ ONE BACK — js/nav.js (the browser's Back, Esc, the Android button and ‹ all go through Nav.back)
   * ===================================================================== */
  const Back = { arm() { if (window.Nav) Nav.sync(); } };

  /* =====================================================================
   * ⬇ EVERY WINDOW (UI.modal) on phones: a bottom sheet — pull it down to close
   *  - the header / grabber always drags; the content only when it is scrolled to the top and pulled down
   *    (inner scrolling, sideways lists, sliders, drawing, drag-and-drop keep their own gestures);
   *  - past ¼ of its height or a quick flick → closes through bd._m.tryClose (a window with unsaved work asks first,
   *    and stays when the person says so); otherwise it springs back; upwards it only stretches a little (rubber band);
   *  - reduced motion: no slide or spring, it still closes.
   * ===================================================================== */
  const NO_DRAG = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], canvas, video, iframe, audio, [draggable="true"], [data-no-drag]';
  const ownGesture = (t, stop) => {
    for (let el = t; el && el !== stop && el.nodeType === 1; el = el.parentElement) {
      if (el.matches(NO_DRAG)) return true;
      const ta = getComputedStyle(el).touchAction;
      if (ta && ta !== 'auto' && ta !== 'manipulation' && !/pan-y|pan-down/.test(ta)) return true; // a clock hand, a slider, a puzzle…
    }
    return false;
  };
  const scrolledInside = (t, stop) => {
    for (let el = t; el && el.nodeType === 1; el = el.parentElement) {
      if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight + 1) return true;
      if (el === stop) break;
    }
    return false;
  };
  const rubber = (x, d) => (x * d * 0.55) / (d + 0.55 * x);
  function modalSheet(bd) {
    if (!bd || bd._mDrag || !bd.classList || !bd.classList.contains('modal-backdrop') || bd.classList.contains('m-sheet-bd')) return;
    const m = bd.querySelector(':scope > .modal');
    if (!m || m.matches('.tr-fail-modal, .rd-modal')) return; // a small centred notice; the full-screen reader (its own gestures)
    bd._mDrag = true;
    m.classList.add('m-msheet');
    const head = m.querySelector(':scope > .modal-head');
    const canClose = () => !(bd._m && bd._m.dismissable === false);
    let drag = null;
    const start = (y, t, pid) => {
      try { m.getAnimations().forEach(a => a.finish()); } catch (e) { /* old engine */ }
      drag = { y0: y, raw: 0, pts: [{ y, t }], h: m.getBoundingClientRect().height || 1, pid };
      m.style.transition = 'none';
      m.classList.add('m-dragging');
    };
    const move = (y, t) => {
      const raw = y - drag.y0;
      drag.raw = raw;
      const dy = raw < 0 ? -rubber(-raw, 70) : canClose() ? raw : rubber(raw, 110);
      drag.pts.push({ y, t }); if (drag.pts.length > 8) drag.pts.shift();
      m.style.transform = `translate3d(0, ${dy.toFixed(1)}px, 0)`;
      bd.style.setProperty('--m-bd', String(Math.max(0, 1 - Math.max(0, dy) / drag.h)));
    };
    const snap = () => {
      bd.style.removeProperty('--m-bd');
      if (reduce()) { m.style.transition = 'none'; m.style.transform = ''; return; }
      m.style.transition = 'transform .34s var(--m-ease, cubic-bezier(.32,.72,0,1))';
      m.style.transform = '';
      setTimeout(() => { if (!drag) m.style.transition = ''; }, 380);
    };
    const end = () => {
      const d = drag; if (!d) return;
      drag = null;
      m.classList.remove('m-dragging');
      const lastP = d.pts[d.pts.length - 1], firstP = d.pts.find(p => lastP.t - p.t < 120) || d.pts[0];
      const v = (lastP.y - firstP.y) / Math.max(1, lastP.t - firstP.t); // px/ms, + = down
      if (canClose() && d.raw > 0 && (d.raw > d.h * 0.25 || (v > 0.5 && d.raw > 30))) {
        if (bd._m && bd._m.tryClose) { const p = bd._m.tryClose(); if (p && p.catch) p.catch(() => {}); } else bd.remove();
        if (bd.classList.contains('closing') || !bd.isConnected) {
          if (reduce()) { m.style.transform = 'translate3d(0, 110%, 0)'; m.style.opacity = '0'; } // gone at once
          else m.style.transition = ''; // the closing slide goes on from here
          return;
        }
      }
      snap(); // not far enough — or the window asks first («Закрыть без сохранения?») and stays meanwhile
    };
    if (head) {
      head.addEventListener('pointerdown', e => {
        if (!Mobile.on || drag || e.button > 0) return;
        if (e.target.closest('button, a, input, select, textarea, label, [role="tab"], [contenteditable]')) return;
        start(e.clientY, e.timeStamp, e.pointerId);
        try { head.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      });
      head.addEventListener('pointermove', e => { if (drag && drag.pid === e.pointerId) move(e.clientY, e.timeStamp); });
      head.addEventListener('pointerup', e => { if (drag && drag.pid === e.pointerId) end(); });
      head.addEventListener('pointercancel', e => { if (drag && drag.pid === e.pointerId) end(); });
    }
    // the content: touch events (they can stop the page from scrolling; pointer events cannot once it pans)
    let ty = null, tx = 0, blocked = false;
    m.addEventListener('touchstart', e => {
      ty = null;
      if (!Mobile.on || drag || e.touches.length !== 1 || (head && head.contains(e.target))) return;
      ty = e.touches[0].clientY; tx = e.touches[0].clientX;
      blocked = ownGesture(e.target, m) || scrolledInside(e.target, m);
    }, { passive: true });
    m.addEventListener('touchmove', e => {
      if (ty == null) return;
      const t = e.touches[0], dy = t.clientY - ty, dx = t.clientX - tx;
      if (!drag) {
        if (blocked || scrolledInside(e.target, m)) { ty = null; return; }
        if (Math.abs(dx) > Math.abs(dy)) { if (Math.abs(dx) > 10) ty = null; return; } // sideways: not ours
        if (dy <= 0) { if (dy < -4) ty = null; return; } // upwards: the content scrolls
        if (!e.cancelable) { ty = null; return; } // the page already scrolls
        e.preventDefault(); // a pull down at the top is ours from its first move (else the page starts an overscroll)
        if (dy < 8) return;
        start(ty, e.timeStamp, 'touch');
      }
      if (drag.pid !== 'touch') return;
      if (e.cancelable) e.preventDefault();
      move(t.clientY, e.timeStamp);
    }, { passive: false });
    const tEnd = () => { ty = null; if (drag && drag.pid === 'touch') end(); };
    m.addEventListener('touchend', tEnd);
    m.addEventListener('touchcancel', tEnd);
  }
  const scanModals = () => { const mr = modalRoot(); if (mr && Mobile.on) [...mr.children].forEach(modalSheet); };

  /* =====================================================================
   * ⌨ the on-screen keyboard (type mode, search): the screen follows the visible part
   * ===================================================================== */
  const vv = window.visualViewport;
  function onVV() {
    if (!vv) return;
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    const ae = document.activeElement;
    const typing = !!(ae && ae.matches && ae.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, [contenteditable="true"]'));
    const open = Mobile.on && kb > 120 && typing;
    html.classList.toggle('m-kb', open);
    if (open) { html.style.setProperty('--m-vvh', vv.height + 'px'); html.style.setProperty('--m-vvt', vv.offsetTop + 'px'); }
    else { html.style.removeProperty('--m-vvh'); html.style.removeProperty('--m-vvt'); }
  }
  if (vv) { vv.addEventListener('resize', onVV); vv.addEventListener('scroll', onVV); }
  document.addEventListener('focusout', () => setTimeout(onVV, 120));

  /* =====================================================================
   * on / off
   * ===================================================================== */
  function apply() {
    const on = mqPhone.matches;
    const was = Mobile.on;
    Mobile.on = on;
    html.classList.toggle('m-phone', on);
    html.classList.toggle('m-land', on && mqLand.matches);
    html.classList.toggle('m-cap', isCap());
    if (on === was) { if (on && inStudy()) requestAnimationFrame(() => { if (S() && S().flipped) fitBack(); }); return; }
    if (!on) {
      if (curSheet) curSheet.close(true);
      unborrow();
      $$('#view .m-study-head').forEach(x => x.remove());
      $$('#view .study.m-focus').forEach(x => x.classList.remove('m-focus'));
      $$('#view .face.back').forEach(f => { f.classList.remove('m-fit-1', 'm-fit-2', 'm-fit-open'); f.querySelectorAll('.m-detail').forEach(b => b.remove()); });
      html.classList.remove('m-immersive', 'm-imm-btns', 'm-kb');
      unshell(); undeck();
    } else if (App.view) {
      shell();
      if (inStudy() && S()) { afterStudyRender(); afterCard(); }
    }
    if (on) scanModals();
  }

  const Mobile = {
    on: false,
    sheet, borrow, unborrow, immersive, fitBack,
    moreSheet, studySheet,
    get open() { return curSheet; },
    /** ‹ of the top bar: the same Back as the browser's, Esc and the Android button (js/nav.js) */
    back() { return window.Nav ? Nav.back('button') : Promise.resolve(false); },
  };
  window.Mobile = Mobile;

  /* ---------------- hooks (no behaviour change while Mobile.on is false) ---------------- */
  const wrap = (obj, name, after) => {
    const orig = obj[name];
    if (typeof orig !== 'function') return;
    obj[name] = function () { const r = orig.apply(this, arguments); if (Mobile.on) { try { after.apply(this, arguments); } catch (e) { console.warn('mobile', name, e); } } return r; };
  };
  wrap(App, 'render', () => {
    if (!inStudy()) {
      if (studySh) studySh.close(true);
      if (explainSh) explainSh.close(true);
      unborrow('study-shell');
      html.classList.remove('m-immersive', 'm-imm-btns');
    }
    shell();
    Back.arm();
  });
  wrap(Study, 'render', () => { afterStudyRender(); });
  wrap(Study, 'renderCard', () => { afterCard(); });
  wrap(Study, 'flip', () => { requestAnimationFrame(fitBack); });
  wrap(Study, 'finish', () => {
    const s = S(); if (!s || !s.finished) return;
    if (studySh) studySh.close(true);
    html.classList.remove('m-immersive', 'm-imm-btns');
    const st = $('#view .study'); if (st) st.classList.add('m-finished');
    syncHead();
  });
  wrap(Study, 'updateTop', () => { syncHead(); });

  // ⋯ in the top bar opens the «Меню» sheet on phones (capture: before js/app.js opens its dropdown)
  document.addEventListener('click', e => {
    if (!Mobile.on) return;
    const b = e.target.closest && e.target.closest('#more-btn');
    if (!b) return;
    e.stopPropagation(); e.preventDefault();
    moreSheet();
  }, true);
  // keys: F — full screen, Esc leaves the full screen first
  document.addEventListener('keydown', e => {
    if (!Mobile.on || !inStudy() || openBackdrops().length) return;
    if (e.target.matches && e.target.matches('input, textarea, select, [contenteditable="true"]')) return;
    if (e.key === 'Escape' && html.classList.contains('m-immersive')) { e.stopPropagation(); e.preventDefault(); immersive(false); return; }
    if ((e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); immersive(!html.classList.contains('m-immersive')); }
  }, true);
  // every window (UI.modal) becomes a sheet you can pull down (on phones)
  const watchRoot = () => { const mr = modalRoot(); if (mr) new MutationObserver(scanModals).observe(mr, { childList: true }); scanModals(); };

  const listen = (mq, fn) => { try { mq.addEventListener('change', fn); } catch (e) { mq.addListener(fn); } };
  listen(mqPhone, apply); listen(mqLand, apply);
  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchRoot);
  else watchRoot();
})();
