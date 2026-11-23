/* ============ UI helpers ============ */
(function () {
  const UI = {
    /* ---------- rich text: keeps text exactly as is, adds light formatting ---------- */
    rich(s) {
      // markdown backslash escapes (\( \) \- \*) are shown the way the original app renders them
      let h = U.esc((s == null ? '' : String(s)).replace(/\\([\\`*_{}\[\]()#+\-.!|>~])/g, '$1'));
      h = h.replace(/^#{1,6}\s+(.+)$/gm, '<b class="rt-h">$1</b>');
      h = h.replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>');
      h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
      h = h.replace(/(^|[\s(>])\*([^*\n]+?)\*(?=[\s.,!?:;)<]|$)/gm, '$1<i>$2</i>');
      h = h.replace(/(^|[\s(«„>]|&quot;)_([^_\n]+?)_(?=[\s.,!?:;)»<]|&quot;|$)/gm, '$1<i>$2</i>');
      // Russian gloss in parentheses: brackets stay, text gets a soft color
      // ONLY Russian text is light blue; Norwegian always stays white — also inside brackets
      if (!window.Store || !Store.state || Store.settings.highlightRu !== false) {
        // "(Она)" — brackets with purely Russian content: the brackets are blue too
        h = h.replace(/\(([^()<>]*)\)/g, (m, inner) =>
          /[Ѐ-ӿ]/.test(inner) && !/[A-Za-zÀ-ÿæøåÆØÅ]/.test(inner.replace(/&[a-z#0-9]+;/gi, ''))
            ? `<span class="gloss">(${inner})</span>` : m);
        // every other run of Russian words, e.g. "(можно en bok)" -> only "можно" is blue
        h = h.split(/(<[^>]+>)/).map(part => part.startsWith('<') ? part
          : part.replace(/[Ѐ-ӿ][Ѐ-ӿ0-9 \t.,!?:;«»—–\-…%\/]*/g, m => {
            const core = m.replace(/[\s—–\-]+$/, '');
            return `<span class="ru-text">${core}</span>${m.slice(core.length)}`;
          })).join('');
      }
      return h;
    },
    isLong(s) { s = String(s || ''); return s.length > 60 || s.includes('\n'); },

    /** 🙂 any error → a calm Russian sentence (no «Failed to fetch»); the technical detail goes to console.warn only.
     *  UI.friendlyError(e, 'Перевод') → «Перевод: нет интернета — попробуйте, когда связь появится» */
    friendlyError(e, context) { return U.niceErr(e, context); },

    /* ---------- toasts ---------- */
    toast(msg, type = '', ms = 3200) {
      msg = U.calm(msg); // never «Failed to fetch» / «NetworkError…» on screen (js/util.js)
      const el = document.createElement('div');
      el.className = 'toast ' + type;
      el.innerHTML = `<span>${type === 'good' ? '✅' : type === 'bad' ? '⛔' : type === 'warn' ? '⚠️' : 'ℹ️'}</span><span>${U.esc(msg)}</span>`;
      document.getElementById('toast-root').appendChild(el);
      const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 300); };
      if (ms) setTimeout(close, ms);
      el.onclick = close;
      return { el, close };
    },
    /** toast with an action button, e.g. "Удалено · ↶ Вернуть" */
    toastAction(msg, label, fn, ms = 10000, icon = '🗑') {
      msg = U.calm(msg);
      const el = document.createElement('div');
      el.className = 'toast warn toast-action';
      el.innerHTML = `<span>${icon}</span><span>${U.esc(msg)}</span><button class="btn sm primary">${label}</button><span class="toast-timer"></span>`;
      document.getElementById('toast-root').appendChild(el);
      el.querySelector('.toast-timer').style.animationDuration = ms + 'ms';
      let done = false;
      const close = () => { if (done) return; done = true; el.classList.add('out'); setTimeout(() => el.remove(), 300); };
      el.querySelector('button').onclick = e => { e.stopPropagation(); close(); fn(); };
      setTimeout(close, ms);
      return { close };
    },
    progressToast(msg) {
      const el = document.createElement('div');
      el.className = 'toast';
      el.innerHTML = `<span class="spinner sm"></span><span class="pt-msg">${U.esc(msg)}</span><div class="progress"><div class="fill"></div></div>`;
      document.getElementById('toast-root').appendChild(el);
      return {
        set(done, total, m) {
          if (m) el.querySelector('.pt-msg').textContent = U.calm(m);
          el.querySelector('.fill').style.width = (total ? Math.round(done / total * 100) : 0) + '%';
        },
        close(finalMsg, type) {
          el.classList.add('out'); setTimeout(() => el.remove(), 300);
          if (finalMsg) UI.toast(finalMsg, type || 'good');
        },
      };
    },

    /* ---------- modal ---------- */
    /** beforeClose: async () => true/false — asked when the USER closes (✕, Esc, tap outside); e.g. «unsaved changes?» */
    modal({ title = '', body = '', foot = '', cls = '', onMount, onClose, beforeClose, dismissable = true } = {}) {
      const bd = document.createElement('div');
      bd.className = 'modal-backdrop';
      bd.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">
        <div class="modal-head"><h2>${title}</h2>${/\bnarrow\b/.test(cls) || !dismissable ? '' : UI.homeBtn('sm modal-home')}<button class="icon-btn sm" data-close title="Закрыть">✕</button></div>
        <div class="modal-body">${body}</div>
        ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
      </div>`;
      document.getElementById('modal-root').appendChild(bd);
      let closed = false;
      const close = (result) => {
        if (closed) return; closed = true;
        bd.classList.add('closing');
        document.removeEventListener('keydown', onKey, true);
        setTimeout(() => bd.remove(), 200);
        onClose && onClose(result);
      };
      let asking = false;
      /** → true when the window is closed (false: the user chose to stay, e.g. unsaved changes) */
      const tryClose = async () => {
        if (closed) return true;
        if (asking) return false;
        if (beforeClose) { asking = true; let ok = false; try { ok = await beforeClose(); } finally { asking = false; } if (!ok) return false; }
        close();
        return true;
      };
      // Escape closes only the window on top (a confirm over the card editor must not close both)
      const onKey = e => {
        if (e.key !== 'Escape' || !dismissable) return;
        const open = [...document.getElementById('modal-root').children].filter(x => !x.classList.contains('closing'));
        if (open[open.length - 1] !== bd) return;
        e.stopPropagation(); tryClose();
      };
      document.addEventListener('keydown', onKey, true);
      bd.addEventListener('mousedown', e => { if (e.target === bd && dismissable) tryClose(); });
      bd.querySelector('[data-close]').onclick = () => tryClose();
      const m = { el: bd.querySelector('.modal'), close, tryClose, dismissable, $: s => bd.querySelector(s), $$: s => [...bd.querySelectorAll(s)] };
      bd._m = m; // 🏠 «на главный экран» closes every window through it (asking about unsaved changes)
      onMount && onMount(m);
      UI.fitBody(m);
      return m;
    },

    /**
     * A scroll bar only where it is really needed: a window whose content is just a little taller than the screen
     * (a few lines) gets slightly tighter spacing instead of a bar that hardly moves; a 1–8 px rest is not scrolled.
     * Real long content keeps its normal scrolling. Re-checked when the screen size or the content changes.
     */
    fitBody(m) {
      const body = m && m.el && m.el.querySelector('.modal-body'); if (!body) return;
      let busy = false;
      const fit = () => {
        if (busy || !body.isConnected) return;
        busy = true;
        body.classList.remove('mb-tight', 'mb-fit');
        let over = body.scrollHeight - body.clientHeight;
        // really long content (a player, a list): normal scrolling, and no more watching it (it changes all the time)
        if (over > 400 || body.querySelector('video, audio, iframe')) { mo.disconnect(); window.removeEventListener('resize', soon); busy = false; return; }
        if (over > 0 && over <= 80) { body.classList.add('mb-tight'); over = body.scrollHeight - body.clientHeight; }
        if (over > 0 && over <= 8) body.classList.add('mb-fit');
        requestAnimationFrame(() => { busy = false; });
      };
      let t = 0; const soon = () => { clearTimeout(t); t = setTimeout(fit, 60); };
      requestAnimationFrame(fit); setTimeout(fit, 400); // after fonts / pictures
      window.addEventListener('resize', soon);
      const mo = new MutationObserver(soon); mo.observe(body, { childList: true, subtree: true });
      const stop = () => { if (body.isConnected) return; window.removeEventListener('resize', soon); mo.disconnect(); clearInterval(gc); };
      const gc = setInterval(stop, 5000);
    },

    /* ---------- 🏠 home: one tap from anywhere back to the main screen ---------- */
    HOME_SVG: (s = 20) => `<svg class="ico home-ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.2 10.8 12 3.6l8.8 7.2"/><path d="M5.6 9.2v10.1c0 .8.6 1.4 1.4 1.4h10c.8 0 1.4-.6 1.4-1.4V9.2"/><path class="home-door" d="M10 20.7v-4.9c0-.5.4-.9.9-.9h2.2c.5 0 .9.4.9.9v4.9"/></svg>`,
    /** 📺 «to the TV» — a screen with cast waves (Apple / Google style line icon; the waves come alive on hover) */
    TV_SVG: (s = 18) => `<svg class="ico tv-ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 14.6V6.9C3 5.85 3.85 5 4.9 5h14.2c1.05 0 1.9.85 1.9 1.9v9.2c0 1.05-.85 1.9-1.9 1.9H13.6"/><path class="tv-w2" d="M3 14.9a6.1 6.1 0 0 1 6.1 6.1"/><path class="tv-w1" d="M3 18.1a2.9 2.9 0 0 1 2.9 2.9"/><circle cx="3.6" cy="20.4" r="1" fill="currentColor" stroke="none"/></svg>`,
    homeBtn(cls = '') {
      return `<button type="button" class="icon-btn home-btn ${cls}" data-home aria-label="На главный экран" data-tip="На главный экран">${UI.HOME_SVG(cls.includes('sm') ? 18 : 20)}</button>`;
    },
    /** close every open window (top first; unsaved changes may ask and stop it), then open a screen — e.g. a deck */
    async goTo(view, params) {
      const open = [...document.querySelectorAll('#modal-root > .modal-backdrop:not(.closing)')].reverse();
      for (const bd of open) {
        if (bd._m) { if (!(await bd._m.tryClose())) return false; }
        else bd.remove();
      }
      if (window.SelPop) SelPop.hide();
      if (window.App && App.view && App.view.name === 'study' && view !== 'study' && window.Study && Study.leaveAsk && !(await Study.leaveAsk('home'))) return false;
      if (window.App) App.go(view, params);
      window.scrollTo({ top: 0 });
      return true;
    },
    /** close every open window (top first; a window with unsaved changes may ask and stop it) → the main screen */
    async goHome() {
      if (UI._goingHome) return;
      UI._goingHome = true;
      try {
        const open = [...document.querySelectorAll('#modal-root > .modal-backdrop:not(.closing)')].reverse();
        for (const bd of open) {
          if (bd._m) { if (!(await bd._m.tryClose())) return false; }
          else bd.remove();
        }
        if (window.SelPop) SelPop.hide();
        // a card session in progress: «Закончить занятие?» (answers are saved as you go — nothing else is lost)
        if (window.App && App.view && App.view.name === 'study' && window.Study && Study.leaveAsk && !(await Study.leaveAsk('home'))) return false;
        if (window.App && App.view && App.view.name === 'study' && window.TTS) { try { TTS.stop(); } catch (e) { /* ignore */ } }
        if (window.App) App.go('home');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return true;
      } finally { UI._goingHome = false; }
    },
    confirm(text, { ok = 'Да', cancel = 'Отмена', danger = false, title = 'Подтверждение' } = {}) {
      return new Promise(resolve => {
        const m = UI.modal({
          title, cls: 'narrow', body: `<p>${text}</p>`,
          foot: `<button class="btn ghost" data-no>${cancel}</button><button class="btn ${danger ? 'bad' : 'primary'}" data-yes>${ok}</button>`,
          onClose: r => resolve(r === true),
        });
        m.$('[data-yes]').onclick = () => m.close(true);
        m.$('[data-no]').onclick = () => m.close(false);
        setTimeout(() => m.$('[data-yes]').focus(), 50);
      });
    },
    /**
     * ❓ «Закрыть …?» — one look for every question asked when closing would STOP or LOSE something
     * (a player, a download, a session, unsaved changes). Simple windows never ask — they close at once.
     * { title: 'Закрыть эфир?', line: 'what is kept / lost — one short line', actions: [{ label, value, cls, attr }], cancel, cancelAttr }
     * → the chosen action's value, or null (Отмена / ✕ / Esc / tap outside). Focus is on «Отмена» (the safe button);
     * ← → move between the buttons, Enter presses the focused one.
     */
    askClose({ title = 'Закрыть?', line = '', text = '', actions, cancel = 'Отмена', cancelAttr = '' } = {}) {
      const acts = actions && actions.length ? actions : [{ label: 'Закрыть', value: 'close', cls: 'bad' }];
      return new Promise(resolve => {
        let result = null;
        const m = UI.modal({
          title, cls: 'narrow ask-close',
          body: `${text ? `<p class="ask-text">${text}</p>` : ''}${line ? `<p class="ask-line">${line}</p>` : ''}`,
          foot: `<button type="button" class="btn ghost" data-no data-ask-cancel ${cancelAttr}>${cancel}</button>`
            + acts.map((a, i) => `<button type="button" class="btn ${a.cls || ''}" data-ask="${i}" ${i === 0 ? 'data-yes' : ''} ${a.attr || ''}>${a.label}</button>`).join(''),
          onClose: () => resolve(result),
        });
        const foot = m.el.querySelector('.modal-foot');
        foot.addEventListener('click', e => {
          const b = e.target.closest('button'); if (!b) return;
          if (b.dataset.ask != null) result = acts[+b.dataset.ask].value;
          m.close();
        });
        m.el.addEventListener('keydown', e => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          const bs = [...foot.querySelectorAll('button')], k = bs.indexOf(document.activeElement);
          e.preventDefault();
          bs[(k + (e.key === 'ArrowRight' ? 1 : -1) + bs.length) % bs.length].focus();
        });
        setTimeout(() => { const c = m.$('[data-ask-cancel]'); if (c) c.focus(); }, 50);
      });
    },
    /**
     * beforeClose for UI.modal from a question: ask() → null (nothing to lose: close at once) or the askClose options;
     * an option's act(value) may do the work (stop, collapse…) and return false to keep the window open.
     */
    guard(ask) {
      return async () => {
        const q = await ask();
        if (!q) return true;
        const r = await UI.askClose(q);
        if (r == null) return false;
        if (q.act) return (await q.act(r)) !== false;
        return true;
      };
    },
    /** several buttons -> resolves with the chosen value (null if closed) */
    choose(title, html, options) {
      return new Promise(resolve => {
        let result = null;
        const m = UI.modal({
          title, cls: 'narrow', body: html,
          foot: options.map((o, i) => `<button class="btn ${o.cls || ''}" data-i="${i}">${o.label}</button>`).join(''),
          onClose: () => resolve(result),
        });
        m.el.querySelector('.modal-foot').onclick = e => {
          const b = e.target.closest('[data-i]'); if (!b) return;
          result = options[+b.dataset.i].value; m.close();
        };
      });
    },
    prompt(title, value = '', placeholder = '', multiline = false) {
      return new Promise(resolve => {
        let result = null;
        const m = UI.modal({
          title, cls: 'narrow',
          body: multiline ? `<textarea class="input" rows="4" placeholder="${U.esc(placeholder)}">${U.esc(value)}</textarea>`
            : `<input class="input" value="${U.esc(value)}" placeholder="${U.esc(placeholder)}">`,
          foot: `<button class="btn ghost" data-close2>Отмена</button><button class="btn primary" data-ok>OK</button>`,
          onClose: () => resolve(result),
        });
        const inp = m.$('.input');
        const ok = () => { result = inp.value.trim(); m.close(); };
        m.$('[data-ok]').onclick = ok;
        m.$('[data-close2]').onclick = () => m.close();
        inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !multiline) ok(); });
        setTimeout(() => { inp.focus(); inp.select && inp.select(); }, 60);
      });
    },

    /* ---------- crisp vector icons (Lucide-style, stroke = currentColor) ---------- */
    icon(name, size = 18) {
      const P = {
        close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
        layout: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8.5 3v18"/><path d="M15.5 3v18"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" fill="currentColor" stroke="none"/>',
        pause: '<rect x="6" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1.2" fill="currentColor" stroke="none"/>',
        stop: '<rect x="5.5" y="5.5" width="13" height="13" rx="2.5" fill="currentColor" stroke="none"/>',
        restart: '<path d="M18.5 19.5 9 12l9.5-7.5z" fill="currentColor" stroke="none"/><path d="M5.5 5v14"/>',
        bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
        bulbOff: '<path d="M16.8 11.2c.8-.9 1.2-2 1.2-3.2a6 6 0 0 0-9.3-5"/><path d="m2 2 20 20"/><path d="M6.3 6.3a4.67 4.67 0 0 0 1.2 5.2c.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
        sparkles: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
        retry: '<path d="M20 11.5a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>',
      };
      return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
    },

    /* ---------- popover anchored to a button (stays inside the screen) ---------- */
    popover(anchor, html, cls = '') {
      document.querySelectorAll('.popover').forEach(p => p.remove());
      const pop = document.createElement('div');
      pop.className = 'popover ' + cls;
      pop.innerHTML = html;
      document.body.appendChild(pop);
      const r = anchor.getBoundingClientRect();
      const w = pop.offsetWidth, h = pop.offsetHeight;
      let left = Math.min(window.innerWidth - w - 12, Math.max(12, r.right - w));
      let top = r.bottom + 12;
      if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 12);
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
      pop.style.setProperty('--arrow-x', Math.min(w - 18, Math.max(18, r.left + r.width / 2 - left)) + 'px');
      const close = () => { pop.classList.add('out'); setTimeout(() => pop.remove(), 180); document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', esc, true); };
      const outside = e => { if (!pop.contains(e.target) && !anchor.contains(e.target)) close(); };
      const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
      setTimeout(() => { document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', esc, true); }, 0);
      pop._close = close; // Back / Esc (js/nav.js) close the bubble the same way
      return { el: pop, close };
    },

    /**
     * ⏳ «please wait» card for long work (translation, OCR, AI): a turning hourglass, what is going on and how far.
     * Appears after 350 ms (quick cached work does not flash), disappears when the work is done. Several at once: the
     * newest is shown. Returns { set(sub, done, total), close() }.
     */
    busy(text) {
      this._busy = this._busy || [];
      const item = { text, sub: '', pct: null, shown: false };
      this._busy.push(item);
      const draw = () => {
        let el = document.getElementById('busy-card');
        const top = this._busy.filter(x => x.shown).pop();
        if (!top) { if (el) { el.classList.add('out'); setTimeout(() => { if (el.classList.contains('out')) el.remove(); }, 260); } return; }
        if (!el) {
          el = document.createElement('div'); el.id = 'busy-card'; el.className = 'busy-card';
          el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
          document.body.appendChild(el);
        }
        el.classList.remove('out');
        // 🌀 while an AI or a translator works, its living logo takes the hourglass's place (js/aihub.js paints it)
        el.innerHTML = `<span class="hourglass" data-aiw-live="tr,ai" data-aiw-idle="hg" data-aiw-size="34" aria-hidden="true">⏳</span><div class="busy-txt"><b>${U.esc(top.text)}</b>${top.sub ? `<small>${U.esc(top.sub)}</small>` : ''}
          ${top.pct != null ? `<div class="busy-bar"><i style="width:${top.pct}%"></i></div>` : '<div class="busy-bar indet"><i></i></div>'}</div>`;
        if (window.AIHub && AIHub.paintWork) AIHub.paintWork();
      };
      const timer = setTimeout(() => { item.shown = true; draw(); }, 350);
      return {
        set: (sub, done, total) => { item.sub = sub || ''; item.pct = total ? Math.min(100, Math.round(done / total * 100)) : null; if (item.shown) draw(); },
        close: () => { clearTimeout(timer); const k = this._busy.indexOf(item); if (k >= 0) this._busy.splice(k, 1); draw(); },
      };
    },

    /** 🗑 trash can — the same clear icon everywhere a deck can be deleted */
    TRASH_SVG(s = 16) {
      return `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V4.5h6V7"/><path d="M6.5 7l1 12.5h9l1-12.5"/><path d="M10 11v5M14 11v5"/></svg>`;
    },

    /* ---------- dropdown menu ---------- */
    menu(anchor, items) {
      document.querySelectorAll('.dropdown-menu').forEach(m => m.remove());
      const menu = document.createElement('div');
      menu.className = 'dropdown-menu';
      items.forEach(it => {
        const b = document.createElement('button');
        if (it.html) b.innerHTML = it.html; else b.textContent = it.label;
        if (it.danger) b.className = 'danger';
        b.onclick = e => { e.stopPropagation(); menu.remove(); it.action(); };
        menu.appendChild(b);
      });
      const r = anchor.getBoundingClientRect();
      menu.style.position = 'fixed';
      menu.style.top = (r.bottom + 6) + 'px';
      menu.style.right = 'auto';
      menu.style.maxWidth = (window.innerWidth - 16) + 'px';
      document.body.appendChild(menu);
      // keep the whole menu on screen (phones: min-width 240px)
      const w = menu.offsetWidth || 220;
      menu.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
      // long menus: open upwards when there is more room above, and scroll inside — the last item is always reachable
      const h = menu.scrollHeight, below = window.innerHeight - r.bottom - 14, above = r.top - 14;
      menu.style.overflowY = 'auto';
      if (h > below && above > below) {
        const mh = Math.min(h, above);
        menu.style.maxHeight = mh + 'px';
        menu.style.top = Math.max(8, r.top - 6 - mh) + 'px';
      } else menu.style.maxHeight = Math.max(160, below) + 'px';
      setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 0);
    },

    /* ---------- ripple ---------- */
    ripple(e) {
      const btn = e.target.closest('.btn');
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const s = document.createElement('span');
      const d = Math.max(r.width, r.height);
      s.className = 'ripple';
      s.style.width = s.style.height = d + 'px';
      s.style.left = (e.clientX - r.left - d / 2) + 'px';
      s.style.top = (e.clientY - r.top - d / 2) + 'px';
      btn.appendChild(s);
      setTimeout(() => s.remove(), 600);
    },

    /* ---------- confetti ---------- */
    confetti(n = 160) {
      const c = document.getElementById('confetti');
      const ctx = c.getContext('2d');
      c.width = innerWidth; c.height = innerHeight;
      const colors = ['#7c6cff', '#29c7ff', '#22c55e', '#f59e0b', '#f43f5e', '#ffffff', '#ba0c2f', '#00205b'];
      const parts = Array.from({ length: n }, () => ({
        x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight / 2.5,
        vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 16 - 4,
        w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
      }));
      let frame = 0;
      const tick = () => {
        ctx.clearRect(0, 0, c.width, c.height);
        parts.forEach(p => {
          p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
          ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, 1 - frame / 160);
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
        });
        if (++frame < 170) requestAnimationFrame(tick); else ctx.clearRect(0, 0, c.width, c.height);
      };
      tick();
    },

    statusLabel(s) {
      return ({ new: 'Новая', learning: 'Изучаю', debt: 'Долг', learned: 'Выучено' })[s] || s;
    },
    statusChip(s) { return `<span class="chip ${s}"><span class="dot"></span>${UI.statusLabel(s)}</span>`; },
    stacked(st) {
      const t = st.total || 1;
      const w = n => (n / t * 100).toFixed(2) + '%';
      return `<div class="stacked" title="Выучено ${st.learned} · Изучаю ${st.learning} · Долг ${st.debt} · Новые ${st.new}">
        <div class="s-learned" style="width:${w(st.learned)}"></div><div class="s-learning" style="width:${w(st.learning)}"></div>
        <div class="s-debt" style="width:${w(st.debt)}"></div><div class="s-new" style="width:${w(st.new)}"></div></div>`;
    },
    seg(name, options, current) {
      return `<div class="seg" data-seg="${name}">${options.map(([v, l]) => `<button data-v="${v}" class="${String(v) === String(current) ? 'active' : ''}">${l}</button>`).join('')}</div>`;
    },
    /** 🔒 explanation for the user: API keys never leave their device */
    keysNoteHtml() {
      return `<details class="keys-note" ${Store.settings.keysNoteSeen ? '' : 'open'}>
        <summary>${window.NavIcons ? NavIcons.icon('lock', 18) : ''} <b>Ваши ключи — только у вас.</b> <span class="small muted">Подробнее</span></summary>
        <ul>
          <li>Все ключи, которые вы вводите (нейросети, DeepL, Microsoft, голоса, YouTube, ВКонтакте…), <b>хранятся только на этом устройстве</b> — в памяти этого браузера (в приложении для телефона — в защищённом хранилище iPhone / Android).</li>
          <li>Разработчики приложения <b>не имеют к ним доступа</b>: ключи не отправляются на наш сервер, не попадают в облачную синхронизацию, на GitHub и в резервные копии (файл бэкапа сохраняется без ключей).</li>
          <li>Ключ уходит только напрямую в тот сервис, которому он принадлежит (например, ключ Groq — только в Groq), когда вы им пользуетесь.</li>
          <li>На другом телефоне или компьютере ключ нужно ввести заново. Удалить ключ — очистите его поле (ключи не стираются вместе с карточками и не попадают в резервные копии).</li>
        </ul>
        <button class="btn sm ghost" data-act="keys-note-ok">Понятно</button></details>`;
    },
    switchHtml(key, checked, label = '') {
      return `<label class="switch"><input type="checkbox" data-key="${key}" ${checked ? 'checked' : ''}><span class="track"></span>${label ? `<span>${label}</span>` : ''}</label>`;
    },
    imgThumb(c) {
      if (c.image && window.Images && Images.isRemoteAI(c.image)) return '🎨';
      return c.image ? `<img src="${U.esc(c.image)}" loading="lazy" alt="" onerror="this.replaceWith(document.createTextNode('🖼'))">` : (c.no ? '🇳🇴' : '🃏');
    },
  };

  window.UI = UI;
  // 🏠 any home button (top bar, every window's head) — before the window's own click handlers
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-home]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    UI.goHome();
  }, true);
})();
