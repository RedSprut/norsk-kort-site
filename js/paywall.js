/* ============ ⭐ Paywall — «Norsk Kort Pro» sheet (css/paywall.css) ============
 * Opened ONLY through Pro.require(feature) (js/pro.js) — never by itself. Paywall.open({ feature, reason, soon }) →
 * Promise<boolean>: true = Pro is active now (the caller continues the action that needed it).
 * What it shows: Pro €7.99 / month, €49.99 / year (the store's own price strings when it answers), «выгода 48 %», what Pro
 * includes, NO trial, the auto-renew terms under the button (per platform), «Восстановить покупки», Terms / Privacy
 * (NK_CONFIG.termsUrl / privacyUrl — placeholders until docs/legal is published), ✕.
 * After a purchase: «Подтверждаем покупку…» — `me` is asked about once a second (up to 60 s) until the server says Pro,
 * then «Готово» and the sheet closes by itself. Closing while a purchase is being confirmed asks first (nothing is lost:
 * Pro switches on by itself when the payment lands, a toast says so).
 * No store configured (no RevenueCat key) or no server yet → a polite «скоро» sheet, never an error.
 * Icons: drawn line icons in the NavIcons family (24 box, 1.9 line, currentColor) — Paywall.icon(name, size).
 * Paywall.restore({ standalone }) — «Восстановить покупки» also from «👤 Мой кабинет».
 */
(function () {
  'use strict';
  const CSS = 'css/paywall.css?v=1';
  (function css() {
    if (document.querySelector('link[data-pw-css]')) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CSS; l.setAttribute('data-pw-css', '');
    document.head.appendChild(l);
  })();

  const esc = s => (window.U && U.esc ? U.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
  /* drawn icons of the NavIcons family (js/app.js UI_ICO): a 1.9 line, round ends, `f` lightly filled, `dot` solid */
  const OWN = {
    crown: '<path class="f" d="M4.2 8.4l3.8 3.4L12 5.8l4 6 3.8-3.4-1.5 9.1c-.12.72-.74 1.25-1.47 1.25H7.17c-.73 0-1.35-.53-1.47-1.25z"/><circle class="dot" cx="12" cy="4.6" r="1.1"/><circle class="dot" cx="3.9" cy="7.6" r="1"/><circle class="dot" cx="20.1" cy="7.6" r="1"/>',
    cardcheck: '<rect class="f" x="4" y="4.4" width="16" height="15.2" rx="2.6"/><path d="M8.3 12.3l2.6 2.6 4.9-5.1"/>',
    gloss: '<path d="M4.4 7h8.4M4.4 12h5.6M4.4 17h8.4"/><path class="f" d="M17.6 8.6c.38 2.3 1.5 3.42 3.4 3.75-1.9.36-3.02 1.48-3.4 3.75-.37-2.27-1.5-3.39-3.4-3.75 1.9-.33 3.03-1.45 3.4-3.75z"/>',
    translate: '<path class="f" d="M4.6 4.4h8.2c.9 0 1.6.7 1.6 1.6v5.5c0 .9-.7 1.6-1.6 1.6H9.3l-3 2.4v-2.4H4.6c-.9 0-1.6-.7-1.6-1.6V6c0-.9.7-1.6 1.6-1.6z"/><path d="M14.4 9.5h5c.9 0 1.6.7 1.6 1.6v5.4c0 .9-.7 1.6-1.6 1.6H18v2.3l-2.9-2.3h-3.4c-.9 0-1.6-.7-1.6-1.6v-1.8"/>',
    voice: '<path class="f" d="M4.6 9.5h2.9l4.2-3.5c.52-.43 1.3-.06 1.3.6v10.8c0 .66-.78 1.03-1.3.6l-4.2-3.5H4.6c-.6 0-1.1-.5-1.1-1.1v-2.8c0-.6.5-1.1 1.1-1.1z"/><path d="M16.2 9.2a4 4 0 0 1 0 5.6M18.8 6.6a7.7 7.7 0 0 1 0 10.8"/>',
    gift: '<rect class="f" x="4" y="9.6" width="16" height="10.4" rx="2"/><path d="M3.4 9.6h17.2M12 9.6V20"/><path d="M12 9.4C10.6 6.2 7.4 5.5 7.4 7.6c0 1.4 2.4 1.9 4.6 1.8zM12 9.4c1.4-3.2 4.6-3.9 4.6-1.8 0 1.4-2.4 1.9-4.6 1.8z"/>',
    key: '<circle class="f" cx="8.4" cy="12" r="4.1"/><path d="M12.5 12h8.1M17.6 12v3.1M20.6 12v2.3"/>',
    restore: '<path d="M4.4 12a7.6 7.6 0 1 1 2.2 5.4"/><path d="M4.4 19.2v-4.6H9"/><path d="M12 8.2V12l2.6 1.6"/>',
    shield: '<path class="f" d="M12 3.8l7 2.7v5.1c0 4.3-2.9 7.6-7 8.8-4.1-1.2-7-4.5-7-8.8V6.5z"/><path d="M8.9 12.2l2.2 2.2 4-4.1"/>',
  };
  const paint = s => s.replace(/class="f"/g, 'class="f" fill="currentColor" fill-opacity=".22"').replace(/class="dot"/g, 'class="dot" fill="currentColor" stroke="none"');
  function icon(name, size) {
    const s = size || 18;
    if (OWN[name]) return `<svg class="ico ui-ico ui-ico-${name}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paint(OWN[name])}</svg>`;
    return window.NavIcons && NavIcons.icon ? NavIcons.icon(name, s) : '';
  }

  const SUB = {
    ai: 'Нейросеть сделает это за вас — без своих ключей и настроек.',
    account: 'Нейросеть и естественные голоса — без своих ключей и настроек.',
    translate: 'Переводы нейросетью — без своих ключей и настроек.',
    voice: 'Естественные голоса для норвежского, русского и украинского.',
  };
  const INCLUDES = [
    ['cardcheck', 'Проверка карточек нейросетью', 'перевод, все формы слова, примеры по временам'],
    ['gloss', 'Подписи к словам', 'точный перевод каждого слова в тексте и субтитрах'],
    ['translate', 'Перевод нейросетью', 'субтитры, книги, предложения — без своих ключей'],
    ['voice', 'Голоса на сервере', 'естественное произношение для no, ru и uk'],
  ];

  function termsText(plat, plan) {
    const per = plan && plan.id === 'monthly' ? 'месяц' : 'год';
    const head = `Без пробного периода. Подписка на ${per} продлевается автоматически по той же цене, пока вы её не отмените`;
    if (plat === 'ios') return `${head} — не позже чем за 24 часа до конца периода. Оплата — через ваш Apple ID при подтверждении покупки. Отменить можно в любой момент в настройках App Store.`;
    if (plat === 'android') return `${head}. Оплата — через Google Play при подтверждении покупки. Отменить можно в любой момент в Google Play → Подписки.`;
    return `${head}. Отменить можно в любой момент — ссылка придёт в письме об оплате; Pro работает до конца оплаченного периода.`;
  }

  let cur = null;

  function open(o = {}) {
    if (cur) return cur.promise;
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    const C = window.NK_CONFIG || {};
    const B = window.Billing;
    const soon = !!o.soon || !(B && B.available());
    const reason = o.reason || 'ai';
    const opener = document.activeElement;
    const bd = document.createElement('div');
    bd.className = 'pw-bd';
    bd.innerHTML = `<section class="pw" role="dialog" aria-modal="true" aria-labelledby="pw-h" aria-describedby="pw-sub">
        <button type="button" class="pw-x" data-pw="close" aria-label="Закрыть">${icon('close', 22)}</button>
        <div class="pw-scroll" data-pw-body></div>
      </section>`;
    (document.getElementById('modal-root') || document.body).appendChild(bd);
    document.documentElement.classList.add('pw-open');
    const body = bd.querySelector('[data-pw-body]');
    let phase = soon ? 'soon' : 'loading', closed = false, data = null, sel = 'yearly', pollCtl = null, busyMsg = '';

    /* ---------- closing ---------- */
    const finish = ok => {
      if (closed) return; closed = true;
      if (pollCtl) pollCtl.abort();
      document.removeEventListener('keydown', onKey, true);
      bd.classList.add('closing');
      setTimeout(() => { bd.remove(); if (!document.querySelector('.pw-bd')) document.documentElement.classList.remove('pw-open'); }, 200);
      cur = null;
      try { if (opener && opener.isConnected) opener.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      resolve(!!ok);
      // «👤 Мой кабинет» under the sheet shows the new state (js/pro.js does not redraw it while the sheet is open)
      if (window.App && App.view && App.view.name === 'account') setTimeout(() => { try { App.render(); } catch (e) { /* ignore */ } }, 220);
    };
    /** ✕ / Esc / Back: during a purchase or its confirmation — ask first */
    const tryClose = async () => {
      if (closed) return true;
      if (phase === 'buying' || phase === 'confirming') {
        const r = await UI.askClose({ title: 'Закрыть окно?',
          line: phase === 'buying' ? 'Покупка ещё не закончена. Если вы уже оплатили, Pro включится сам — закрыть можно спокойно.' : 'Мы ещё подтверждаем покупку. Pro включится сам, как только оплата пройдёт, — закрыть можно спокойно.',
          actions: [{ label: 'Закрыть', value: 'close', cls: 'primary', attr: 'data-pw-close-yes' }], cancel: 'Подождать' });
        if (r !== 'close') return false;
        watchLater();
      }
      finish(false);
      return true;
    };
    /** the purchase may still land: tell the person when it does */
    function watchLater() {
      if (!window.Pro) return;
      Pro.pollUntilActive({ timeout: 5 * 60e3 }).then(ok => { if (ok) UI.toast('Norsk Kort Pro подключён — спасибо!', 'good', 5000); }).catch(() => {});
    }
    const onKey = e => {
      const top = [...document.getElementById('modal-root').children].filter(x => !x.classList.contains('closing')).pop();
      if (top !== bd) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); tryClose(); return; }
      if (e.key !== 'Tab') return;
      const f = [...bd.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]')].filter(x => x.offsetParent !== null);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    bd.addEventListener('mousedown', e => { if (e.target === bd) tryClose(); });

    /* ---------- drawing ---------- */
    const plan = () => (data && data.plans.find(p => p.id === sel)) || (data && data.plans[0]) || null;
    const head = (title, sub) => `<div class="pw-hero" aria-hidden="true"><span class="pw-badge">${icon('crown', 30)}</span></div>
      <div class="pw-brand">Norsk Kort <b>Pro</b></div>
      <h2 id="pw-h">${title}</h2>
      ${sub ? `<p id="pw-sub" class="pw-sub">${sub}</p>` : '<p id="pw-sub" class="pw-sub" hidden></p>'}`;
    const list = () => `<ul class="pw-list">${INCLUDES.map(([ic, t, d]) => `<li><span class="pw-li-i">${icon(ic, 22)}</span><span><b>${t}</b><small>${d}</small></span></li>`).join('')}</ul>`;
    const links = () => {
      const t = C.termsUrl, p = C.privacyUrl;
      return `${soon ? '' : `<div class="pw-links"><button type="button" class="pw-link" data-pw="restore">${icon('restore', 18)}<span>Восстановить покупки</span></button></div>`}
        ${t || p ? `<div class="pw-links pw-legal">${t ? `<a class="pw-link" href="${esc(t)}" target="_blank" rel="noopener">Условия</a>` : ''}${t && p ? '<span aria-hidden="true">·</span>' : ''}${p ? `<a class="pw-link" href="${esc(p)}" target="_blank" rel="noopener">Конфиденциальность</a>` : ''}</div>` : ''}`;
    };
    const alt = () => (reason === 'ai' || reason === 'translate' ? `<button type="button" class="pw-alt" data-pw="own-key">${icon('key', 18)}<span>Или подключить свою нейросеть бесплатно</span></button>` : '');

    function draw() {
      if (closed) return;
      const featureLine = o.feature && o.feature !== 'Norsk Kort Pro' ? `«${esc(o.feature)}» — это в Pro. ` : '';
      if (phase === 'soon') {
        body.innerHTML = `${head('Pro скоро появится', `${featureLine}Подписка Norsk Kort Pro ещё не открыта. Всё остальное в приложении работает бесплатно${reason === 'ai' || reason === 'translate' ? ', а нейросеть можно подключить своим бесплатным ключом' : ''}.`)}
          ${list()}
          <div class="pw-acts">${reason === 'ai' || reason === 'translate' ? `<button type="button" class="pw-cta" data-pw="own-key">${icon('key', 20)}<span>Подключить свою нейросеть</span></button>` : ''}
            <button type="button" class="pw-ghost" data-pw="close">Понятно</button></div>`;
        return focusFirst();
      }
      if (phase === 'loading') {
        body.innerHTML = `${head('Учите быстрее с Pro', featureLine + (SUB[reason] || SUB.account))}${list()}
          <div class="pw-plans pw-skel" aria-busy="true" aria-label="Загружаем цены"><span></span><span></span></div>
          <button type="button" class="pw-cta" disabled><span class="pw-spin" aria-hidden="true"></span><span>Загружаем цены…</span></button>`;
        return;
      }
      if (phase === 'confirming' || phase === 'done' || phase === 'late') {
        const t = phase === 'done' ? 'Готово! Pro подключён' : phase === 'late' ? 'Подтверждение задерживается' : 'Подтверждаем покупку…';
        const s = phase === 'done' ? (o.feature && o.feature !== 'Norsk Kort Pro' ? `Продолжаем: «${esc(o.feature)}».` : 'Спасибо! Всё уже работает.')
          : phase === 'late' ? 'Оплата прошла, но магазин ещё не сообщил нам о ней. Обычно это занимает до нескольких минут — Pro включится сам, окно можно закрыть.'
          : busyMsg || 'Магазин сообщает нам об оплате — это несколько секунд.';
        body.innerHTML = `<div class="pw-state pw-${phase}" role="status" aria-live="polite">
            <span class="pw-state-i">${phase === 'done' ? icon('check', 40) : phase === 'late' ? icon('restore', 36) : '<span class="pw-ring" aria-hidden="true"></span>'}</span>
            <h2 id="pw-h">${t}</h2><p id="pw-sub" class="pw-sub">${s}</p>
            ${phase === 'late' ? `<div class="pw-acts"><button type="button" class="pw-cta" data-pw="recheck">${icon('refresh', 20)}<span>Проверить ещё раз</span></button><button type="button" class="pw-ghost" data-pw="close-late">Закрыть</button></div>` : ''}
          </div>`;
        if (phase === 'late') focusFirst();
        return;
      }
      // plans / buying / error
      const pl = plan(), saving = (data && data.saving) || 48;
      const P = (C.prices || {});
      const row = p => {
        const y = p.id === 'yearly', on = p.id === sel;
        return `<button type="button" class="pw-plan${on ? ' on' : ''}" role="radio" aria-checked="${on}" data-plan="${p.id}" ${phase === 'buying' ? 'disabled' : ''}>
          <span class="pw-dot" aria-hidden="true"></span>
          <span class="pw-plan-t"><b>${y ? 'Год' : 'Месяц'}</b><small>${y ? `${esc(p.perMonth || P.yearlyPerMonth || '')} в месяц` : 'отменить можно в любой момент'}</small></span>
          <span class="pw-plan-p"><b>${esc(p.price)}</b>${y && saving > 0 ? `<em class="pw-save">выгода ${saving} %</em>` : ''}</span>
        </button>`;
      };
      const ctaTxt = pl ? `Оформить за ${esc(pl.price)} в ${pl.id === 'yearly' ? 'год' : 'месяц'}` : 'Оформить Pro';
      body.innerHTML = `${head('Учите быстрее с Pro', featureLine + (SUB[reason] || SUB.account))}
        ${list()}
        <div class="pw-plans" role="radiogroup" aria-label="Срок подписки">${(data ? data.plans : []).map(row).join('')}</div>
        ${phase === 'error' ? `<p class="pw-err" role="alert">${icon('alert', 18)}<span>${esc(busyMsg)}</span></p>` : ''}
        <div class="pw-buy"><button type="button" class="pw-cta" data-pw="buy" ${phase === 'buying' ? 'disabled aria-busy="true"' : ''}>${phase === 'buying' ? `<span class="pw-spin" aria-hidden="true"></span><span>${B && B.kind() === 'mock' ? 'Тестовая покупка…' : 'Открываем оплату…'}</span>` : `${icon('crown', 20)}<span>${ctaTxt}</span>`}</button></div>
        <p class="pw-terms">${esc(termsText(B ? B.platform() : 'web', pl))}</p>
        ${links()}
        ${alt()}`;
      if (phase !== 'buying') focusFirst(true);
    }
    let focusedOnce = false;
    function focusFirst(cta) {
      if (focusedOnce && cta) return;
      focusedOnce = true;
      const f = (cta && body.querySelector('[data-pw="buy"]')) || body.querySelector('.pw-cta:not([disabled]), button:not([disabled])') || bd.querySelector('.pw-x');
      try { if (f) f.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }

    /* ---------- actions ---------- */
    async function confirm(pending) {
      phase = 'confirming'; busyMsg = pending ? 'Оплата ещё обрабатывается — как только она пройдёт, Pro включится.' : ''; draw();
      pollCtl = new AbortController();
      const ok = await Pro.pollUntilActive({ timeout: pending ? 120000 : 60000, signal: pollCtl.signal });
      if (closed) return;
      if (ok) { phase = 'done'; draw(); setTimeout(() => finish(true), 1400); }
      else { phase = 'late'; draw(); }
    }
    async function buy() {
      const pl = plan(); if (!pl) return;
      phase = 'buying'; busyMsg = ''; draw();
      let r;
      try { r = await B.purchase(pl); } catch (e) {
        if (closed) return;
        phase = 'error'; busyMsg = e && e.calm ? e.message : (window.U ? U.niceErr(e, 'Покупка') : 'Покупка не прошла'); draw(); return;
      }
      if (closed) { if (r && (r.ok || r.pending)) watchLater(); return; }
      if (r && r.cancelled) { phase = 'plans'; draw(); return; }
      confirm(!!(r && r.pending));
    }
    async function restore() {
      const btn = body.querySelector('[data-pw="restore"]'); if (btn) btn.disabled = true;
      try {
        const r = await doRestore();
        if (closed) return;
        if (r === 'active') { phase = 'done'; draw(); setTimeout(() => finish(true), 1400); }
        else if (r === 'store') confirm(false);
        else UI.toast('Покупок для этого аккаунта не найдено', '', 4000);
      } catch (e) { UI.toast(e && (e.calm || e.nk) ? e.message : U.niceErr(e, 'Восстановление'), 'warn', 5000); }
      finally { if (btn && btn.isConnected) btn.disabled = false; }
    }

    bd.addEventListener('click', e => {
      const p = e.target.closest('[data-plan]');
      if (p && !p.disabled) { sel = p.dataset.plan; if (phase === 'error') phase = 'plans'; draw(); const b = body.querySelector(`[data-plan="${sel}"]`); if (b) b.focus({ preventScroll: true }); return; }
      const b = e.target.closest('[data-pw]'); if (!b || b.disabled) return;
      switch (b.dataset.pw) {
        case 'close': tryClose(); break;
        case 'close-late': watchLater(); finish(false); break;
        case 'buy': buy(); break;
        case 'restore': restore(); break;
        case 'recheck': confirm(false); break;
        case 'own-key': finish(false); setTimeout(() => { if (window.Guides && Guides.needAI) Guides.needAI(o.feature && o.feature !== 'Norsk Kort Pro' ? o.feature : 'Нейросеть'); else if (window.App) App.go('settings'); }, 220); break;
      }
    });
    // ← → move between the two plans (a radio group)
    bd.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) || !e.target.closest('[data-plan]') || !data) return;
      e.preventDefault();
      const ids = data.plans.map(x => x.id), k = ids.indexOf(sel);
      sel = ids[(k + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + ids.length) % ids.length];
      draw(); const b = body.querySelector(`[data-plan="${sel}"]`); if (b) b.focus({ preventScroll: true });
    });

    cur = { promise, el: bd, close: () => finish(false), tryClose, dismissable: true };
    bd._m = cur; // «🏠 на главный» and the app's Back close it through tryClose
    draw();
    if (!soon) {
      B.offerings().then(d => { data = d; if (!d.plans.find(x => x.id === sel)) sel = d.plans[0] ? d.plans[0].id : sel; if (phase === 'loading') { phase = 'plans'; draw(); } })
        .catch(e => { data = B.configPlans(); if (phase === 'loading') { phase = 'error'; busyMsg = e && e.calm ? e.message : 'Не удалось загрузить цены — проверьте интернет'; draw(); } });
    } else focusFirst();
    return promise;
  }

  /** the store's restore + the server's answer → 'active' (the server says Pro) | 'store' (the store has it, the server
   *  not yet — confirm) | 'none' */
  async function doRestore() {
    const B = window.Billing;
    let store = { active: false };
    if (B && B.available()) store = await B.restore();
    try { await Pro.refresh({ force: true }); } catch (e) { if (!store.active) throw e; }
    if (Pro.isActive()) return 'active';
    return store.active ? 'store' : 'none';
  }
  /** «Восстановить покупки» outside the sheet («👤 Мой кабинет») */
  async function restore() {
    const t = UI.progressToast ? UI.progressToast('Проверяем покупки…') : null;
    try {
      const r = await doRestore();
      if (r === 'store') { const ok = await Pro.pollUntilActive({ timeout: 60000 }); if (t) t.close(ok ? 'Pro восстановлен' : 'Покупка найдена — Pro включится через несколько минут', ok ? 'good' : ''); return ok; }
      if (t) t.close(r === 'active' ? 'Pro восстановлен' : 'Покупок для этого аккаунта не найдено', r === 'active' ? 'good' : '');
      return r === 'active';
    } catch (e) { if (t) t.close(); UI.toast(e && (e.calm || e.nk) ? e.message : U.niceErr(e, 'Восстановление'), 'warn', 5000); return false; }
  }

  window.Paywall = { open, restore, icon, isOpen: () => !!cur, _t: { termsText, OWN } };
})();
