/* ============ ☁️ Вход — optional sign-in sheet (the app works fully without an account) ============
 * SignIn.open()  — a full-screen sheet: a dimmed, slowly drifting collage of the app's OWN pictures (the loading-screen
 *   word cards, art-card templates drawn by js/artcards.js, «Фраза дня» scenes drawn by js/phraseday.js — no stock
 *   people), the logo + the promise, and the sign-in buttons. Never opened by itself: only from «👤 Мой кабинет».
 * Backend: js/account.js (Supabase: the app's built-in project from js/config.js, or Settings → ☁️ Облако as an override,
 *   or the local dev API — localhost + ?nkdev=1 only, e-mail code stand-in).
 * SignIn.open({ reason: 'pro', feature, onClose(signedIn) }) — js/pro.js opens it before the paywall: the headline says why,
 *   and onClose tells whether the person is now signed in (the paywall / the blocked action then continue).
 *   Only providers the project really has switched on are shown — GET <url>/auth/v1/settings (public, anon key) says
 *   which ones; a provider that is off is hidden, never shown as a broken button. No cloud → the sheet says plainly
 *   «Аккаунт не нужен», offers the backup file, and shows the sign-in row as not available yet.
 * E-mail: a one-time code (and the link in the same letter) — Account.sendCode / verifyCode; a password stays possible.
 * Google / Apple buttons follow their brand rules (official logos as inline SVG, white buttons on a dark background).
 * Motion: the collage drifts with the CSS `translate` property; prefers-reduced-motion → still.
 * CSS: css/signin.css.
 */
(function () {
  'use strict';
  const esc = s => U.esc(s);
  const ACC = () => window.Account;

  /* ---------- official marks (inline SVG, unmodified shapes and colours) ---------- */
  const G_LOGO = '<svg class="si-g" viewBox="0 0 48 48" width="20" height="20" aria-hidden="true" focusable="false">'
    + '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>'
    + '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>'
    + '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>'
    + '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>'
    + '</svg>';
  const APPLE_LOGO = '<svg class="si-apple" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>';
  /* UI chrome: drawn icons of the top-bar family (js/app.js NavIcons.icon) — never an emoji (v229); the brand marks above stay as they are */
  const IC = (n, sz) => (window.NavIcons && NavIcons.icon ? NavIcons.icon(n, sz) : '');
  /* the other providers account.js knows — shown only when the project has them on, as plain text buttons */
  const OTHER = [['facebook', 'Facebook'], ['twitter', 'X'], ['github', 'GitHub']];

  /* ---------- the collage: the app's own pictures ---------- */
  const PHOTOS = [['stavkirke', 'kirke', 'церковь'], ['fjord', 'fjord', 'фьорд'], ['hytte', 'hytte', 'домик'], ['preikestolen', 'fjell', 'гора'],
    ['lofoten', 'velkommen', 'добро пожаловать'], ['nordlys', 'nordlys', 'северное сияние'], ['bryggen', 'takk', 'спасибо'], ['snohytte', 'snø', 'снег'], ['vinterskog', 'skog', 'лес']];
  const ARTS = [['aurora', 'et nordlys', 'северное сияние'], ['rosemaling', 'ei rose', 'роза'], ['retro', 'en reise', 'путешествие'], ['akvarell', 'en sommer', 'лето'],
    ['night', 'ei natt', 'ночь'], ['skattekart', 'et kart', 'карта'], ['fjord', 'en båt', 'лодка'], ['minimal', 'et hjem', 'дом']];
  const SCENES = [['cafe', ['cashier', 'friend'], 'En kaffe, takk!'], ['park', ['friend', 'friend'], 'Så fint vær!'], ['shop', ['seller', 'friend'], 'Hva koster det?'],
    ['school', ['teacher', 'student'], 'Hei, alle sammen!'], ['street', ['friend', 'friend'], 'Hvor er stasjonen?'], ['mountain', ['friend', 'friend'], 'For en utsikt!']];

  function tiles() {
    const out = [];
    PHOTOS.forEach(([f, no, ru]) => out.push(`<figure class="si-tile si-ph"><img src="icons/preloader/${f}.webp" alt="" decoding="async" draggable="false"><figcaption><b lang="nb">${esc(no)}</b><i>${esc(ru)}</i></figcaption></figure>`));
    if (window.ArtCards && ArtCards.faceHtml) {
      try { ArtCards.ensureFonts(); } catch (e) { /* fonts are optional */ }
      ARTS.forEach(([th, no, ru], i) => {
        if (!ArtCards.THEMES[th]) return;
        try {
          const look = Object.assign({}, ArtCards.DEFAULT_LOOK, { theme: th });
          out.push(`<div class="si-tile si-art">${ArtCards.faceHtml({ id: 'si-art-' + i, no, ru }, 'front', 'no', { base: look, image: false })}</div>`);
        } catch (e) { /* a template that cannot draw here is simply left out */ }
      });
    }
    if (window.PhraseDay && PhraseDay._t && PhraseDay._t.sceneSvg) {
      SCENES.forEach(([setting, roles, no], i) => {
        try {
          const svg = PhraseDay._t.sceneSvg({ id: 'si-sc-' + i, no, words: [], scene: { setting, people: roles.map(role => ({ role })) } });
          out.push(`<div class="si-tile si-sc">${svg}<span class="si-bub" lang="nb">${esc(no)}</span></div>`);
        } catch (e) { /* skip */ }
      });
    }
    return out;
  }
  // a fixed mix (photo · art · scene …), a different start in every column
  function collageHtml() {
    const all = tiles();
    const w = window.innerWidth || 1024;
    const cols = w < 600 ? 3 : Math.min(9, Math.max(4, Math.ceil(w / 230) + 1));
    const per = Math.min(all.length, w < 600 ? 7 : 6);
    const order = [];
    const by = [all.filter(t => t.includes('si-ph')), all.filter(t => t.includes('si-art')), all.filter(t => t.includes('si-sc'))];
    for (let i = 0; order.length < all.length; i++) by.forEach(l => { if (l[i]) order.push(l[i]); });
    let html = '';
    for (let c = 0; c < cols; c++) {
      const list = [];
      for (let k = 0; k < per; k++) list.push(order[(c * 5 + k * 3) % order.length]);
      const set = list.join('');
      // two copies → the column loops without a seam; odd columns drift the other way
      html += `<div class="si-col${c % 2 ? ' rev' : ''}" style="--si-dur:${86 + (c * 17) % 40}s;--si-delay:-${(c * 23) % 60}s"><div class="si-track">${set}${set}</div></div>`;
    }
    return html;
  }

  /* ---------- which ways in the cloud project really offers ---------- */
  let provCache = null;
  async function providers() {
    const A = ACC();
    const P = window.NKConfig ? NKConfig.project() : null;
    if (!A || !A.cloudReady() || !P) return null;
    if (P.devAuth) return { email: true, google: false, apple: false, other: [], signup: true, dev: true }; // the local dev API: e-mail code only
    const url = P.url, key = P.key;
    if (provCache && provCache.url === url && Date.now() - provCache.t < 10 * 60e3) return provCache.v;
    const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 7000);
    let v;
    try {
      const r = await fetch(url + '/auth/v1/settings', { headers: { apikey: key }, signal: ac.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(), x = j.external || {};
      v = { email: x.email !== false, google: !!x.google, apple: !!x.apple, other: OTHER.filter(([id]) => !!x[id]), signup: !j.disable_signup };
    } catch (e) {
      // offline / blocked: e-mail is the one way every Supabase project has; the others stay hidden rather than broken
      v = { email: true, google: false, apple: false, other: [], signup: true, unsure: true };
    } finally { clearTimeout(to); }
    provCache = { url, t: Date.now(), v };
    return v;
  }

  /* ---------- the sheet ---------- */
  let cur = null;
  function open(o = {}) {
    if (cur) { if (o.onClose) (cur.waiters = cur.waiters || []).push(o.onClose); return cur; }
    const A = ACC();
    const ready = !!(A && A.cloudReady());
    const forPro = o.reason === 'pro' && ready;
    const opener = document.activeElement;
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop si-bd';
    bd.innerHTML = `
      <div class="si-collage" aria-hidden="true" inert><div class="si-cols">${collageHtml()}</div></div>
      <div class="si-shade" aria-hidden="true"></div>
      <button type="button" class="si-x" data-si="close" aria-label="Закрыть">${IC('close', 20)}</button>
      <section class="si-panel" role="dialog" aria-modal="true" aria-labelledby="si-h" aria-describedby="si-sub">
        <div class="si-brand"><img src="icons/icon.svg" alt="" width="44" height="44"><span>Norsk <b>Kort</b></span></div>
        <h2 id="si-h">${forPro ? 'Войдите, чтобы подключить Pro' : ready ? 'Ваши карточки — на&nbsp;всех устройствах' : 'Аккаунт не&nbsp;нужен'}</h2>
        <p id="si-sub" class="si-sub">${forPro ? `Norsk Kort Pro привязывается к аккаунту — так он работает на всех ваших устройствах${o.feature ? `, а «${esc(o.feature)}» продолжится сразу после входа` : ''}. Колоды и прогресс тоже будут в облаке.` : ready ? 'Войдите — и колоды, карточки, прогресс и настройки появятся на всех ваших устройствах. Вход — по желанию: без него всё работает на этом устройстве.' : 'Всё хранится на этом устройстве — колоды, прогресс и настройки. Работает без регистрации и без интернета.'}</p>
        <div class="si-body" data-si-body aria-live="polite"></div>
        <button type="button" class="si-later" data-si="close">Не сейчас</button>
      </section>`;
    (document.getElementById('modal-root') || document.body).appendChild(bd);
    document.documentElement.classList.add('si-open');
    const $ = s => bd.querySelector(s);
    const body = $('[data-si-body]');
    let closed = false, cool = null, email = '';

    const close = () => {
      if (closed) return; closed = true;
      clearInterval(cool);
      bd.classList.add('closing');
      document.removeEventListener('keydown', onKey, true);
      setTimeout(() => { bd.remove(); document.documentElement.classList.remove('si-open'); }, 200);
      const waiters = [o.onClose].concat((cur && cur.waiters) || []).filter(f => typeof f === 'function');
      cur = null;
      try { if (opener && opener.isConnected) opener.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      const inNow = !!(A && A.user);
      waiters.forEach(f => { try { f(inNow); } catch (e) { console.warn('signin onClose', e); } });
    };
    const focusFirst = () => { const f = body.querySelector('input, button:not([disabled])') || $('.si-later'); if (f) f.focus({ preventScroll: true }); };
    // Escape closes; Tab stays inside the sheet
    const onKey = e => {
      const top = [...document.getElementById('modal-root').children].filter(x => !x.classList.contains('closing')).pop();
      if (top !== bd) return;
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const f = [...bd.querySelectorAll('button:not([disabled]), input, a[href]')].filter(x => x.offsetParent !== null);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    };
    document.addEventListener('keydown', onKey, true);

    const P = window.NKConfig ? NKConfig.project() : null;
    const own = P && P.source === 'own';
    const C = window.NK_CONFIG || {};
    const links = !own && (C.termsUrl || C.privacyUrl) ? ` <a href="${esc(C.termsUrl || '')}" target="_blank" rel="noopener">Условия</a> · <a href="${esc(C.privacyUrl || '')}" target="_blank" rel="noopener">Конфиденциальность</a>` : '';
    const legal = `<p class="si-legal">${own ? 'Данные синхронизируются через ваш собственный облачный проект' : 'Данные синхронизируются через облако Norsk Kort'}: колоды, карточки, прогресс и настройки. Ключи API и токены никогда не покидают устройство. Выйти можно в любой момент — данные на устройстве останутся.${links}</p>`;

    /* steps */
    function stepStart(pv) {
      if (!ready) {
        body.innerHTML = `
          <div class="si-acts">
            <button type="button" class="si-btn si-mail" data-si="backup">${IC('download', 20)}<span>Скачать резервную копию</span></button>
            <button type="button" class="si-btn si-ghost" data-si="restore">${IC('upload', 20)}<span>Восстановить из файла</span></button>
          </div>
          <div class="si-soon" role="group" aria-label="Вход для облачной синхронизации — пока не подключён">
            <span class="si-soon-i">${IC('cloud', 22)}</span>
            <span class="si-soon-t"><b>Скоро: вход для облачной синхронизации</b><small>Почта, Google или Apple — когда владелец подключит облако</small></span>
            <button type="button" class="si-soon-b" disabled aria-disabled="true">Войти</button>
          </div>
          <p class="si-legal">Копия — обычный файл: храните его у себя, на другом устройстве откройте «Восстановить из файла».</p>`;
        return;
      }
      if (!pv) { body.innerHTML = '<div class="si-wait" role="status"><span class="si-spin" aria-hidden="true"></span>Проверяем способы входа…</div>'; return; }
      const btns = [];
      if (pv.email) btns.push(`<button type="button" class="si-btn si-mail" data-si="email">${IC('mail', 20)}<span>Продолжить с почтой</span></button>`);
      if (pv.email && (pv.google || pv.apple)) btns.push('<div class="si-or" role="separator"><span>или</span></div>');
      if (pv.google) btns.push(`<button type="button" class="si-btn si-google" data-oauth="google">${G_LOGO}<span>Войти через Google</span></button>`);
      if (pv.apple) btns.push(`<button type="button" class="si-btn si-applebtn" data-oauth="apple">${APPLE_LOGO}<span>Вход с Apple</span></button>`);
      if (pv.other.length) btns.push(`<div class="si-more">${pv.other.map(([id, n]) => `<button type="button" class="si-txt" data-oauth="${id}">${esc(n)}</button>`).join('<span aria-hidden="true">·</span>')}</div>`);
      if (!btns.length) btns.push('<p class="si-note">В облачном проекте пока не включён ни один способ входа (Supabase → Authentication → Providers).</p>');
      body.innerHTML = `<div class="si-acts">${btns.join('')}</div>${pv.unsure ? '<p class="si-note">Нет связи с облаком — показан только вход по почте.</p>' : ''}${legal}`;
    }
    function stepEmail(withPass) {
      body.innerHTML = `
        <form class="si-form" data-si-form novalidate>
          <label class="si-lab" for="si-mail">Почта</label>
          <input id="si-mail" class="si-in" type="email" inputmode="email" autocomplete="email" placeholder="navn@eksempel.no" value="${esc(email)}" required>
          ${withPass ? `<label class="si-lab" for="si-pass">Пароль</label><input id="si-pass" class="si-in" type="password" autocomplete="current-password" required>` : ''}
          <button type="submit" class="si-btn si-mail" data-si-go>${withPass ? 'Войти' : 'Получить код'}</button>
          <div class="si-row">
            <button type="button" class="si-txt" data-si="back">← Другие способы</button>
            ${withPass ? '<button type="button" class="si-txt" data-si="forgot">Забыли пароль?</button><button type="button" class="si-txt" data-si="email">Без пароля</button>' : '<button type="button" class="si-txt" data-si="pass">У меня есть пароль</button>'}
          </div>
        </form>
        <p class="si-legal">${withPass ? 'Нет аккаунта с этой почтой — предложим зарегистрироваться.' : 'Пришлём письмо с кодом и ссылкой для входа. Пароль не нужен.'}</p>`;
      body.querySelector('[data-si-form]').onsubmit = async e => {
        e.preventDefault();
        const m = body.querySelector('#si-mail'); email = m.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { m.setAttribute('aria-invalid', 'true'); m.focus(); UI.toast('Введите почту', 'warn'); return; }
        const go = body.querySelector('[data-si-go]'); go.disabled = true;
        try {
          if (withPass) { await A.signInEmail(email, body.querySelector('#si-pass').value); if (A.user) { close(); if (!forPro) UI.toast('Вы вошли', 'good'); } }
          else {
            const r = await A.sendCode(email);
            if (r && r.error) { UI.toast(r.error, 'bad', 6000); } else { stepCode(); return; }
          }
        } finally { if (go.isConnected) go.disabled = false; }
      };
      focusFirst();
    }
    function stepCode() {
      body.innerHTML = `
        <form class="si-form" data-si-form novalidate>
          <p class="si-sent">${IC('mail', 18)} Письмо отправлено на <b>${esc(email)}</b>. Введите код из письма — или просто откройте ссылку в нём на этом устройстве.</p>
          <label class="si-lab" for="si-code">Код из письма</label>
          <input id="si-code" class="si-in si-code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="10" placeholder="••••••" required>
          <button type="submit" class="si-btn si-mail" data-si-go>Войти</button>
          <div class="si-row"><button type="button" class="si-txt" data-si="email">← Другая почта</button><button type="button" class="si-txt" data-si="resend" disabled>Отправить ещё раз</button></div>
        </form>`;
      const rs = body.querySelector('[data-si="resend"]');
      let left = 60; rs.textContent = `Отправить ещё раз · ${left}`;
      clearInterval(cool);
      cool = setInterval(() => { left--; if (!rs.isConnected) { clearInterval(cool); return; } if (left <= 0) { clearInterval(cool); rs.disabled = false; rs.textContent = 'Отправить ещё раз'; } else rs.textContent = `Отправить ещё раз · ${left}`; }, 1000);
      body.querySelector('[data-si-form]').onsubmit = async e => {
        e.preventDefault();
        const c = body.querySelector('#si-code'), code = c.value.replace(/\D/g, '');
        if (code.length < 6) { c.setAttribute('aria-invalid', 'true'); c.focus(); UI.toast('Код — 6 цифр из письма', 'warn'); return; }
        const go = body.querySelector('[data-si-go]'); go.disabled = true;
        const r = await A.verifyCode(email, code);
        if (r && r.error) { if (go.isConnected) go.disabled = false; c.setAttribute('aria-invalid', 'true'); UI.toast(r.error, 'bad', 6000); return; }
        close(); if (!forPro) UI.toast('Вы вошли', 'good');
      };
      focusFirst();
    }

    bd.addEventListener('input', e => { if (e.target.matches('.si-in')) e.target.removeAttribute('aria-invalid'); });
    bd.addEventListener('click', async e => {
      const ob = e.target.closest('[data-oauth]');
      if (ob) {
        ob.disabled = true;
        // the page leaves for the provider and comes back: js/pro.js reopens the paywall after the return
        if (forPro) { try { sessionStorage.setItem('nk-pro-pending', JSON.stringify({ feature: o.feature || '', t: Date.now() })); } catch (x) { /* ignore */ } }
        try { await A.signInOAuth(ob.dataset.oauth); } finally { ob.disabled = false; }
        return;
      }
      const b = e.target.closest('[data-si]'); if (!b || b.disabled) return;
      switch (b.dataset.si) {
        case 'close': close(); break;
        case 'email': stepEmail(false); break;
        case 'pass': { const m = body.querySelector('#si-mail'); if (m) email = m.value.trim(); stepEmail(true); break; }
        case 'back': stepStart(await providers()); focusFirst(); break;
        case 'forgot': { const m = body.querySelector('#si-mail'); email = m ? m.value.trim() : email; if (/.+@.+\..+/.test(email)) A.resetPassword(email); else UI.toast('Сначала введите почту', 'warn'); break; }
        case 'resend': b.disabled = true; { const r = await A.sendCode(email); UI.toast(r && r.error ? r.error : 'Письмо отправлено ещё раз', r && r.error ? 'bad' : 'good'); } stepCode(); break;
        case 'backup': try { Exporter.backup(); } catch (err) { UI.toast('Не удалось сохранить файл', 'bad'); } break;
        case 'restore': close(); App.pickFiles(); break;
      }
    });

    cur = { el: bd, close, tryClose: async () => { close(); return true; }, dismissable: true, waiters: [] };
    bd._m = cur; // «🏠 на главный» closes every window through it
    stepStart(null);
    focusFirst();
    if (ready) providers().then(pv => { if (!closed) { stepStart(pv); focusFirst(); } });
    return cur;
  }

  window.SignIn = { open, providers, _t: { tiles, collageHtml, reset: () => { provCache = null; } } };
})();
