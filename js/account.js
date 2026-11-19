/* ============ 👤 My account: profile photo, name, stats, sign-in (cloud) ============
 * Works right away on this device (photo, name). Sign-in & sync need the cloud (Supabase):
 * Settings → ☁️ Облако → Project URL + anon key. Sign-in: e-mail (link or password), Google, Apple, Facebook, X, GitHub.
 * Instagram no longer offers sign-in for other apps — Facebook is the same Meta account.
 */
(function () {
  const st = () => Store.settings;
  const SB_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
  const PROVIDERS = [['google', 'Google', 'google.com'], ['apple', 'Apple', 'apple.com'], ['facebook', 'Facebook', 'facebook.com'], ['twitter', 'X', 'x.com'], ['github', 'GitHub', 'github.com']];
  const fav = (d, s = 20) => `<img src="https://www.google.com/s2/favicons?domain=${d}&sz=64" width="${s}" height="${s}" alt="">`;
  // whole characters (an emoji is two code units): "Ivan Petrov" -> "IP", no name -> 🙂
  const initials = n => { const s = String(n || '').trim(); return s ? s.split(/\s+/).map(w => Array.from(w)[0]).slice(0, 2).join('').toUpperCase() : '🙂'; };
  const back = () => location.href.split('#')[0];

  const Account = {
    sb: null, user: null,
    avatarHtml(size = 34) {
      // only a picture (data:image / https) — a crafted backup must not inject anything into the page
      const raw = String(st().avatar || '');
      const a = /^(data:image\/[a-z+.-]+;base64,[A-Za-z0-9+/=]+|https:\/\/[^\s'"()<>]+)$/i.test(raw) ? raw : '';
      return a ? `<span class="avatar" style="width:${size}px;height:${size}px;background-image:url('${a}')"></span>`
        : `<span class="avatar empty" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px">${U.esc(initials(st().userName))}</span>`;
    },
    paintTop() { const b = document.getElementById('account-btn'); if (b) b.innerHTML = this.avatarHtml(32); },

    /* photo: choose (device / camera / web / paste) -> crop -> save; change or remove any time */
    async choosePhoto() {
      Photos.pick({ title: '📷 Фото профиля', query: '', noSearch: true, max: 1600, onPick: async data => {
        const out = await Avatar.crop(data);
        if (!out) return;
        Store.setSetting('avatar', out);
        this.paintTop();
        UI.toast('Фото профиля сохранено ✓', 'good');
        if (this.user) this.pushAvatar(out);
        if (App.view.name === 'account') App.render();
      } });
    },
    async editPhoto() { if (st().avatar) { const out = await Avatar.crop(st().avatar, '✂️ Изменить кадр'); if (out) { Store.setSetting('avatar', out); this.paintTop(); App.render(); } } },
    async removePhoto() {
      if (!(await UI.confirm('Убрать фото профиля?', { ok: 'Убрать', danger: true }))) return;
      Store.setSetting('avatar', ''); this.paintTop(); App.render();
    },

    /* cloud */
    cloudReady() { return !!((st().cloudUrl || '').trim() && (st().cloudAnon || '').trim()); },
    async client() {
      if (this.sb || !this.cloudReady()) return this.sb;
      await U.loadScript(SB_LIB);
      this.sb = window.supabase.createClient(st().cloudUrl.trim(), st().cloudAnon.trim(), { auth: { persistSession: true, detectSessionInUrl: true } });
      const { data } = await this.sb.auth.getSession();
      this.user = data && data.session ? data.session.user : null;
      this.sb.auth.onAuthStateChange((_e, s) => { this.user = s ? s.user : null; this.afterAuth(); });
      this.afterAuth();
      return this.sb;
    },
    afterAuth() {
      const u = this.user;
      if (u) {
        const md = u.user_metadata || {};
        if (!st().userName && (md.full_name || md.name)) Store.setSetting('userName', md.full_name || md.name);
        const pic = md.avatar_url || md.picture;
        if (!st().avatar && pic) U.compressImage(pic, 512).then(d => { Store.setSetting('avatar', d); this.paintTop(); }).catch(() => {});
      }
      this.paintTop();
      if (window.App && App.view && App.view.name === 'account') App.render();
    },
    /** ☁️ what a cloud copy may contain: everything except the personal course decks (they stay on this device) */
    syncPayload() { return Store.exportBackup({ shareable: true }); },
    async pushAvatar(data) { try { const sb = await this.client(); if (sb && this.user) await sb.auth.updateUser({ data: { avatar_url: data.length < 200000 ? data : undefined } }); } catch (e) { /* optional */ } },
    async signInOAuth(provider) {
      const sb = await this.client(); if (!sb) return;
      const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: back() } });
      if (error) UI.toast(`${provider}: ${error.message}. Включите этот способ в Supabase → Authentication → Providers`, 'bad', 8000);
    },
    async signInEmail(email, password) {
      const sb = await this.client(); if (!sb) return;
      if (!password) {
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: back() } });
        UI.toast(error ? error.message : `📧 Ссылка для входа отправлена на ${email}`, error ? 'bad' : 'good', 7000);
        return;
      }
      let r = await sb.auth.signInWithPassword({ email, password });
      if (r.error && /invalid login/i.test(r.error.message)) {
        if (!(await UI.confirm('Аккаунта с этой почтой ещё нет. Зарегистрироваться?', { ok: 'Зарегистрироваться' }))) return;
        r = await sb.auth.signUp({ email, password, options: { emailRedirectTo: back() } });
        if (!r.error) UI.toast('📧 Подтвердите почту — письмо уже отправлено', 'good', 7000);
      }
      if (r.error) UI.toast(r.error.message, 'bad', 6000);
    },
    async resetPassword(email) {
      const sb = await this.client(); if (!sb) return;
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: back() });
      UI.toast(error ? error.message : '📧 Письмо для смены пароля отправлено', error ? 'bad' : 'good', 6000);
    },
    async signOut() {
      if (!(await UI.confirm('Выйти из аккаунта?<br><span class="small muted">Колоды и карточки на этом устройстве останутся.</span>', { ok: 'Выйти' }))) return;
      const sb = await this.client(); if (sb) await sb.auth.signOut(); this.user = null; App.render(); },
  };

  /* ---------- page «👤 Мой кабинет» ---------- */
  Views.account = function (root) {
    const s = st(), all = Store.deckStats(null), streak = Store.streakDays(), u = Account.user;
    root.innerHTML = `
      <div class="acc-head panel">
        <button class="acc-photo" data-act="${s.avatar ? 'photo-edit' : 'photo'}" title="${s.avatar ? 'Изменить кадр' : 'Добавить фото'}">${Account.avatarHtml(120)}<span class="acc-photo-edit">📷</span></button>
        <div class="grow col" style="gap:8px;min-width:220px">
          <input class="input acc-name" data-acc-name value="${U.esc(s.userName || '')}" placeholder="Ваше имя" maxlength="40">
          <div class="small muted">${u ? `✅ ${U.esc(u.email || '')} · вход через ${U.esc((u.app_metadata || {}).provider || 'почту')}` : Account.cloudReady() ? 'Вы не вошли — данные хранятся только на этом устройстве' : 'Профиль на этом устройстве · облако не подключено'}</div>
          <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm primary" data-act="photo">📷 ${s.avatar ? 'Выбрать другое фото' : 'Добавить фото'}</button>
            ${s.avatar ? '<button class="btn sm" data-act="photo-edit">✂️ Изменить кадр</button><button class="btn sm ghost" data-act="photo-rm">🗑 Убрать фото</button>' : ''}</div>
        </div>
      </div>
      <div class="stat-grid" style="margin-top:14px">
        <div class="stat"><b>🧠 ${Progress.knowledgeNow()}%</b><span>знание</span></div>
        <div class="stat"><b>🔥 ${streak}</b><span>${U.plural(streak, ['день', 'дня', 'дней'])} подряд</span></div>
        <div class="stat"><b>${all.total}</b><span>карточек · ${Store.decks().length} колод</span></div>
        <div class="stat"><b>${Store.state.log.length}</b><span>ответов всего</span></div>
      </div>
      <div class="panel" style="margin-top:14px">
        <h3>🔐 Вход и синхронизация</h3>
        ${u ? `<div class="row" style="gap:8px;flex-wrap:wrap"><span>Вы вошли как <b>${U.esc(u.email || u.id)}</b></span><button class="btn sm ghost" data-act="signout">Выйти</button></div>`
          : `${Account.cloudReady() ? '' : `<div class="mt-warn" style="margin-bottom:10px">☁️ <span><b>Вход заработает после подключения облака</b> (бесплатный Supabase — 5 минут, один раз для всего приложения). <button class="btn sm" data-act="to-cloud">Подключить облако</button></span></div>`}
            <div class="acc-providers ${Account.cloudReady() ? '' : 'off'}">${PROVIDERS.map(([id, n, d]) => `<button class="btn acc-prov" data-oauth="${id}">${fav(d)} ${n}</button>`).join('')}</div>
            <div class="acc-or">или по почте</div>
            <div class="row" style="gap:6px;flex-wrap:wrap"><input class="input" type="email" data-mail placeholder="почта@пример.no" style="max-width:260px" autocomplete="email"><input class="input" type="password" data-pass placeholder="пароль (можно без него)" style="max-width:220px" autocomplete="current-password">
              <button class="btn primary" data-act="mail">Войти / зарегистрироваться</button><button class="btn sm ghost" data-act="forgot">Забыли пароль?</button></div>
            <div class="tiny muted">Без пароля на почту придёт ссылка для входа. Instagram вход для сторонних приложений не даёт — используйте Facebook (тот же аккаунт Meta).</div>`}
        ${Store.decks().some(d => Store.isPersonalDeck && Store.isPersonalDeck(d)) ? `<div class="tiny muted" style="margin-top:8px">🔒 ${U.esc(Store.PERSONAL_NOTE)}: в облако они не попадут.</div>` : ''}
      </div>
      ${UI.keysNoteHtml()}`;
    root.onclick = async e => {
      const needCloud = () => { UI.toast('Сначала подключите облако: Настройки → «☁️ Облако» (Project URL и anon key Supabase)', 'warn', 6000); };
      const p = e.target.closest('[data-oauth]'); if (p) { if (!Account.cloudReady()) { needCloud(); return; } Account.signInOAuth(p.dataset.oauth); return; }
      const a = e.target.closest('[data-act]'); if (!a) return;
      if ((a.dataset.act === 'mail' || a.dataset.act === 'forgot') && !Account.cloudReady()) { needCloud(); return; }
      const mail = () => (root.querySelector('[data-mail]') || {}).value || '';
      switch (a.dataset.act) {
        case 'photo': Account.choosePhoto(); break;
        case 'photo-edit': Account.editPhoto(); break;
        case 'photo-rm': Account.removePhoto(); break;
        case 'to-cloud': App.go('settings'); setTimeout(() => { const el = document.querySelector('[data-text="cloudUrl"]'); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } }, 250); break;
        case 'signout': Account.signOut(); break;
        case 'forgot': if (/.+@.+\..+/.test(mail())) Account.resetPassword(mail().trim()); else UI.toast('Сначала введите почту', 'warn'); break;
        case 'mail': if (!/.+@.+\..+/.test(mail())) { UI.toast('Введите почту', 'warn'); return; } Account.signInEmail(mail().trim(), root.querySelector('[data-pass]').value); break;
        case 'keys-note-ok': Store.setSetting('keysNoteSeen', true); a.closest('details').open = false; break;
      }
    };
    root.oninput = e => { if (e.target.matches('[data-acc-name]')) { Store.setSetting('userName', e.target.value.trim()); Account.paintTop(); } };
  };

  window.Account = Account;
  // started by App.init after the data is loaded (Store.state exists only then)
  Account.init = function () { this.paintTop(); if (this.cloudReady()) this.client().catch(() => {}); };
})();
