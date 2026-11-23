/* ============ ⬅ One Back for the whole app (js/nav.js) ============
 * The browser's Back (phone and desktop), the Android back button (Capacitor) and Esc do the same thing:
 *  1. close what is on top — a tour / coach marks, a menu or a bubble, a sheet or a window (its own «unsaved changes?»
 *     question is asked: bd._m.tryClose), the full-screen card, a hint;
 *  2. then leave the screen to the one before it (a card session asks «Закончить занятие?» as its ✕ does);
 *  3. on the main screen nothing happens (the app: a second Back within 2 s closes it — «Нажмите ещё раз, чтобы выйти»).
 *
 * History: every screen change (App.go) is an entry of its own — #/deck/<id>, #/stats, #/settings… — so a reload or a
 * shared link opens the same screen; a session (#/study) reloads as its deck. Going to a screen that is already right
 * below (the deck from its session, the main screen from anywhere) goes back instead of adding an entry, so there are
 * no duplicates. While something is open on top — or on the first screen — one extra «guard» entry with the same
 * address sits on top: the browser's Back lands on it, and nothing leaves the app by surprise.
 * Guards are added only after the person has used the page (browsers skip entries made without a tap).
 */
(function () {
  'use strict';
  if (!window.App || !window.UI) return;

  const html = document.documentElement;
  const HOME = { name: 'home', params: {} };
  const SCREENS = new Set(['home', 'deck', 'stats', 'settings', 'account', 'levels', 'study', 'progress', 'learn']); // progress: «📈 Мой прогресс» (js/mypath.js); learn: «🎓 Учить по материалам» (js/learnby.js)
  const SS = 'nk-nav';
  const isCap = () => { try { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); } catch (e) { return false; } };
  const activated = () => { try { return !navigator.userActivation || navigator.userActivation.hasBeenActive; } catch (e) { return true; } };
  const $ = s => document.querySelector(s);
  const last = s => { const a = document.querySelectorAll(s); return a.length ? a[a.length - 1] : null; };
  const openBackdrops = () => [...document.querySelectorAll('#modal-root > .modal-backdrop:not(.closing)')];
  const tourOn = () => { try { return !!(window.Help && Help.now && Help.now()); } catch (e) { return false; } };
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) { /* ignore */ }

  /* ---------------- views ⇄ addresses ---------------- */
  const sameView = (a, b) => !!a && !!b && a.name === b.name
    && (a.name === 'study' || JSON.stringify(a.params || {}) === JSON.stringify(b.params || {}));
  const viewOf = v => {
    const o = { name: v.name, params: Object.assign({}, v.params || {}) };
    if (v.name === 'study') { const s = window.Study && Study.session; const d = (s && s.deckId) || v.deck; if (d) o.deck = d; }
    return o;
  };
  function hashFor(v) {
    if (!v || v.name === 'home') return '';
    if (v.name === 'deck') return '#/deck/' + encodeURIComponent((v.params && v.params.id) || '');
    if (v.name === 'study') return '#/study' + (v.deck ? '/' + encodeURIComponent(v.deck) : '');
    return '#/' + v.name;
  }
  const urlFor = v => location.pathname + location.search + hashFor(v);
  function parse(hash) {
    const m = /^#\/([a-z]+)(?:\/([^/?#]*))?$/.exec(hash || '');
    if (!m || !SCREENS.has(m[1])) return null;
    let arg = ''; try { arg = decodeURIComponent(m[2] || ''); } catch (e) { arg = ''; }
    if (m[1] === 'deck') return arg ? { name: 'deck', params: { id: arg } } : null;
    if (m[1] === 'study') return { name: 'study', params: {}, deck: arg || undefined };
    return { name: m[1], params: {} };
  }
  /** #/exam (and #/exam/tracks …): «🎓 Подготовка к экзамену» is a window over the main screen, not a screen —
   *  the address opens it on top of home (a reload or a shared link, the calendar events of a route) */
  function examLink(hash) {
    const m = /^#\/exam(?:\/([a-z-]+))?\/?$/.exec(hash || '');
    if (!m) return false;
    const view = m[1] || 'hub';
    setTimeout(() => { try { if (window.Views && Views.go) Views.go('examprep', { xp: view }); } catch (e) { console.warn('nav exam', e); } }, 450);
    return true;
  }
  /** a screen that can really be shown now (a deleted deck → the main screen; a session cannot be reopened → its deck) */
  function valid(v) {
    const deckOk = id => !!(id && window.Store && Store.deck && Store.deck(id));
    if (!v || !SCREENS.has(v.name) || v.name === 'home') return HOME;
    if (v.name === 'deck') return deckOk(v.params && v.params.id) ? { name: 'deck', params: { id: v.params.id } } : HOME;
    if (v.name === 'study') return deckOk(v.deck) ? { name: 'deck', params: { id: v.deck } } : HOME;
    return window.Views && typeof Views[v.name] === 'function' ? { name: v.name, params: v.params || {} } : HOME;
  }

  /* ---------------- our entries: { nk: 1, d: depth, g: 1 for a guard, v: view } ---------------- */
  const ours = s => (s && s.nk === 1 && s.v && typeof s.d === 'number' ? s : null);
  const mk = (d, g, v) => ({ nk: 1, d: Math.max(0, d), g: g ? 1 : 0, v: viewOf(v) });
  const sd = s => (s ? (s.g ? s.d - 1 : s.d) : 0); // the depth of the screen an entry belongs to
  let cur = null; // the entry we are on
  let stack = []; // the screens by depth (what Back returns to)
  const save = () => { try { sessionStorage.setItem(SS, JSON.stringify(stack.slice(0, 60))); } catch (e) { /* private mode */ } };
  const load = () => { try { const a = JSON.parse(sessionStorage.getItem(SS) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  function put(s, truncate) { const k = sd(s); stack[k] = s.v; if (truncate) stack.length = k + 1; save(); }
  function push(s) { try { history.pushState(s, '', urlFor(s.v)); } catch (e) { return; } cur = s; put(s, true); }
  function replace(s) { try { history.replaceState(s, '', urlFor(s.v)); } catch (e) { return; } cur = s; put(s, true); }

  /* ---------------- moves made by the app itself (their popstate is not a Back press) ---------------- */
  let pending = null;
  const queue = [];
  function hgo(n, after) {
    if (!n) { if (after) after(cur); return; }
    const p = { after };
    p.t = setTimeout(() => { if (pending === p) { pending = null; cur = ours(history.state) || cur; flush(); } }, 1500);
    pending = p;
    try { history.go(n); } catch (e) { clearTimeout(p.t); pending = null; }
  }
  const settle = fn => { if (pending) queue.push(fn); else fn(); };
  function flush() { while (!pending && queue.length) { try { queue.shift()(); } catch (e) { console.warn('nav', e); } } if (!pending) sync(); }

  /* ---------------- App.go / App.back / App.render ---------------- */
  let booted = false, popping = false;
  const oGo = App.go, oRender = App.render;
  App.go = function (name, params = {}) {
    if (popping || !booted) return oGo.call(this, name, params);
    const before = this.view;
    const r = oGo.call(this, name, params);
    if (this.view !== before) record(this.view);
    return r;
  };
  /** ‹ / Back / the session's end: the screen below in the history (never a finished session), else the main screen */
  App.back = function () {
    for (let k = sd(cur) - 1; k >= 0; k--) {
      const b = stack[k]; if (!b) break;
      if (b.name === 'study') continue;
      return this.go(b.name, b.params || {});
    }
    const p = this.prev && this.prev.name !== 'study' && !sameView(this.prev, this.view) ? this.prev : HOME;
    return this.go(p.name, p.params || {});
  };
  App.render = function () {
    if (!booted) { booted = true; try { boot(); } catch (e) { console.warn('nav boot', e); } }
    const r = oRender.apply(this, arguments);
    sync();
    return r;
  };

  /** the first draw: the screen of the address (reload, a shared link) */
  function boot() {
    stack = load();
    const st = ours(history.state);
    const want = st ? st.v : (examLink(location.hash) ? HOME : parse(location.hash) || HOME);
    const v = valid(want);
    App.view = { name: v.name, params: v.params || {} };
    if (st) {
      cur = st;
      if (sameView(v, st.v)) { stack[sd(st)] = st.v; save(); return; }
      // a session's entry after a reload: its deck — the one right below when it is there (no duplicate)
      const k = sd(st) - 1;
      if (want.name === 'study' && k >= 0 && sameView(stack[k], v)) { hgo(k - st.d); return; }
      replace(mk(sd(st), 0, v));
      return;
    }
    const s = mk(0, 0, v);
    stack = [];
    if (!location.hash || /^#\//.test(location.hash)) replace(s);
    else { try { history.replaceState(s, ''); } catch (e) { /* ignore */ } cur = s; put(s, true); } // #open=… is read by the main screen itself
  }

  /** a screen change made by the app → one history entry (or a step back to the same screen below) */
  function record(view) {
    if (!booted) return;
    const v = viewOf(view);
    settle(() => {
      const c = cur || mk(0, 0, v);
      const s = sd(c);
      if (sameView(v, c.v)) { // the same screen again (a new session, a redraw): no new entry
        if (c.g) { stack[s] = v; save(); } else replace(mk(c.d, 0, v));
        return;
      }
      if (v.name === 'home') { // the main screen is the first one: back to it
        if (c.d === 0) { replace(mk(0, 0, v)); return; }
        hgo(-c.d, landed => { if (!landed || !sameView(landed.v, v) || landed.g) replace(mk(0, 0, v)); });
        return;
      }
      for (let k = s - 1; k >= 0; k--) { // the screen right below (finished sessions skipped) — go back to it
        const b = stack[k]; if (!b) break;
        if (b.name === 'study') continue;
        if (sameView(b, v)) { hgo(k - c.d, landed => { if (!landed || !sameView(landed.v, v) || landed.g) replace(mk(k, 0, v)); }); return; }
        break;
      }
      if (c.g) replace(mk(c.d, 0, v)); // the guard of a closed window becomes the new screen's entry
      else push(mk(c.d + 1, 0, v));
    });
  }
  /** show the screen of an entry the browser moved to (no new entry) */
  function show(v) {
    const ok = valid(v.name === 'study' ? { name: 'home' } : v);
    popping = true;
    try { App.go(ok.name, ok.params || {}); } finally { popping = false; }
    if (!sameView(ok, v) && cur) replace(mk(sd(cur), 0, ok));
  }

  /* ---------------- the guard on top ---------------- */
  const layered = () => openBackdrops().length > 0 || !!$('.dropdown-menu, .popover:not(.out)') || html.classList.contains('m-immersive') || tourOn();
  let syncT = 0;
  function sync() { clearTimeout(syncT); syncT = setTimeout(syncNow, 0); }
  function syncNow() {
    if (!booted || pending || isCap() || !cur || cur.g) return;
    if (!(layered() || sd(cur) === 0)) return;
    if (!activated()) return;
    try { const g = mk(cur.d + 1, 1, cur.v); history.pushState(g, '', urlFor(g.v)); cur = g; } catch (e) { /* sandboxed */ }
  }
  const watch = () => {
    const mo = new MutationObserver(sync);
    const mr = document.getElementById('modal-root'); if (mr) mo.observe(mr, { childList: true });
    mo.observe(document.body, { childList: true });
    new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ['class'] });
    // the first tap: now the guard may be added (browsers skip entries added before any tap)
    const first = () => { sync(); if (activated()) { document.removeEventListener('click', first, true); document.removeEventListener('keyup', first, true); } };
    document.addEventListener('click', first, true); document.addEventListener('keyup', first, true);
  };

  /* ---------------- the browser's Back / Forward ---------------- */
  window.addEventListener('popstate', e => {
    const st = ours(e.state);
    if (pending) {
      const p = pending; pending = null; clearTimeout(p.t);
      if (st) { cur = st; put(st, false); }
      try { if (p.after) p.after(st); } catch (err) { console.warn('nav', err); }
      flush();
      return;
    }
    onPop(st).catch(err => console.warn('nav', err));
  });
  async function onPop(st) {
    const from = cur;
    if (!booted) { cur = st || cur; return; }
    if (!st) { // a link to «#…» or an address typed by hand
      if (examLink(location.hash)) { try { history.replaceState(from || mk(0, 0, App.view), '', urlFor((from && from.v) || viewOf(App.view))); } catch (err) { /* ignore */ } return; }
      const v = parse(location.hash);
      const d = from ? from.d + 1 : 0;
      if (v && !sameView(valid(v), App.view)) { const ok = valid(v); replace(mk(d, 0, ok)); show(ok); }
      else if (from) { try { const g = mk(d, 1, from.v); history.replaceState(g, '', urlFor(g.v)); cur = g; } catch (err) { /* ignore */ } }
      return;
    }
    cur = st; put(st, false);
    if (!from) return;
    const v = App.view;
    const studyOn = v.name === 'study' && window.Study && Study.session && !Study.session.finished;
    if (st.d >= from.d) { // Forward
      if (sameView(st.v, v)) return; // onto our own guard
      if (st.v.name === 'study' || studyOn) { hgo(from.d - st.d); return; } // a session is not reopened / not left this way
      show(st.v);
      if (App.view === v) hgo(from.d - st.d); // the screen asked to stay
      return;
    }
    // Back
    if (sameView(st.v, v) && !(st.v.name === 'study' && v.name !== 'study')) { await back('pop'); sync(); return; }
    if (st.v.name === 'study') { // a finished session below: step over it
      hgo(-1, landed => { if (landed && !sameView(landed.v, App.view)) show(landed.v); });
      return;
    }
    if (layered() || studyOn) { push(mk(st.d + 1, 0, from.g ? mk(0, 0, v).v : from.v)); await back('pop'); sync(); return; }
    show(st.v);
    if (App.view === v) push(mk(st.d + 1, 0, from.v)); // the screen asked first (it goes on by itself when allowed)
    sync();
  }

  /* ---------------- one step of «back» ---------------- */
  const leaveGuards = [];
  let lastHomeBack = 0;
  /** a hint goes the way its own «Понятно / Не сейчас / ✕» would take it (never its «Открыть / Показать») */
  function closeHint(h) {
    if (h.classList.contains('m-hint')) { h.dispatchEvent(new Event('m-gone')); return; }
    const b = h.querySelector('[data-hch="ok"], [data-hch="no"], .at-b-x');
    if (b) { b.click(); return; }
    h.classList.add('out'); setTimeout(() => h.remove(), 300);
  }
  async function back(src) {
    if (tourOn()) { try { Help.end(); } catch (e) { const t = $('body > .hl [data-hl="end"]'); if (t) t.click(); } return true; }
    const menu = last('.dropdown-menu');
    if (menu) { menu.remove(); return true; }
    const pop = last('.popover:not(.out)');
    if (pop) { if (pop._close) pop._close(); else pop.remove(); return true; }
    if ($('.sel-pop') && window.SelPop && SelPop.hide) { SelPop.hide(); return true; }
    const bds = openBackdrops(), top = bds[bds.length - 1];
    if (top) {
      if (top._m && top._m.dismissable === false) return true; // a window that has to be answered
      if (top._m && top._m.tryClose) await top._m.tryClose(); else top.remove();
      return true;
    }
    if (html.classList.contains('m-immersive') && window.Mobile && Mobile.immersive) { Mobile.immersive(false); return true; }
    const hint = last('.m-hint:not(.out), .hc-hint:not(.out), .lt-hint:not(.out), #at-banner:not(.out)');
    if (hint) { closeHint(hint); return true; }
    return leaveScreen(src);
  }
  async function leaveScreen(src) {
    const v = App.view || HOME;
    if (v.name === 'study') {
      const s = window.Study && Study.session;
      if (s && !s.finished) { await Study.exitAsk(); return true; } // «Закончить занятие?» → the results
      App.back(); return true;
    }
    if (v.name === 'home') return atHome(src);
    for (const g of leaveGuards) { // a screen with unsaved work asks first (UI.askClose options, or null)
      let q = null; try { q = await g(v); } catch (e) { q = null; }
      if (!q) continue;
      const r = await UI.askClose(q);
      if (r == null) return true;
      if (q.act && (await q.act(r)) === false) return true;
    }
    App.back();
    return true;
  }
  function atHome(src) {
    if (src !== 'cap') return src !== 'esc'; // the browser: stay
    const now = Date.now();
    if (now - lastHomeBack < 2000) {
      lastHomeBack = 0;
      try { const P = Capacitor.Plugins.App; if (P.exitApp) P.exitApp(); else if (P.minimizeApp) P.minimizeApp(); } catch (e) { /* ignore */ }
      return false;
    }
    lastHomeBack = now;
    UI.toast('Нажмите ещё раз, чтобы выйти', '', 2000);
    return true;
  }

  /* ---------------- Esc = Back ---------------- */
  let escBusy = false; // something on screen had the key already (a hint, a bubble, a window…)
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    escBusy = layered() || !!$('.m-hint, .hc-hint, .lt-hint, .nk-hint, #at-banner, .sel-pop, .dark-screen, #nkp') || !!(window.News && News._pop);
    // a menu has no Esc of its own; a bubble over a window would close the window too
    const menu = last('.dropdown-menu');
    if (menu) { menu.remove(); e.preventDefault(); e.stopImmediatePropagation(); return; }
    const pop = last('.popover:not(.out)');
    if (pop && pop._close) { pop._close(); e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || e.defaultPrevented || escBusy || e.repeat) return;
    if (!booted || !App.view) return;
    if (App.view.name === 'study' && window.Study && Study.session && !Study.session.finished) return; // its own Esc: «Закончить занятие?»
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    e.preventDefault();
    back('esc').catch(() => {});
  });
  // «#» links are buttons here: they must not add history entries
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href="#"]'); if (a) e.preventDefault(); }, true);

  /* ---------------- the Android back button (only inside the Capacitor app) ---------------- */
  function capInit() {
    try {
      const P = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App;
      if (!P || !P.addListener) return;
      P.addListener('backButton', () => { back('cap').catch(() => {}); });
    } catch (e) { /* not the app */ }
  }

  window.Nav = {
    /** Back / Esc / ‹ / the Android button → true when something was done */
    back: (src = 'button') => back(src),
    sync,
    /** a screen with unsaved work: fn(view) → null or UI.askClose options ({ title, line, actions, act }) */
    onLeave(fn) { if (typeof fn === 'function') leaveGuards.push(fn); },
    get state() { return { cur, stack: stack.slice(), pending: !!pending }; },
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { watch(); capInit(); });
  else { watch(); capInit(); }
})();
