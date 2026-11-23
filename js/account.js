/* ============ 👤 My account: profile photo, name, stats, sign-in (cloud) ============
 * Works right away on this device (photo, name). Sign-in & sync need the cloud (Supabase): the app's own project from
 * js/config.js (NKConfig — built in), or Settings → ☁️ Облако → Project URL + anon key (an override for an own project), or the
 * local dev API (localhost only, ?nkdev=1 — a stand-in sign-in, `Bearer dev:<id>`). The account is OPTIONAL: everything works
 * without it. Account.accessToken() gives js/net.js the session for the Norsk Kort server; «Norsk Kort Pro» (js/pro.js) and
 * «Удалить аккаунт» (account-delete) are on this page.
 * Sync of decks, cards, progress and settings between the user's devices: js/cloudsync.js (CloudSync) — starts on sign-in.
 * Sign-in UI: js/signin.js (SignIn.open — e-mail code/link or password, Google, Apple; Facebook / X / GitHub only when
 * the Supabase project has them switched on). Instagram offers no sign-in for other apps.
 */
(function () {
  const st = () => Store.settings;
  const SB_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.js'; // pinned (supply chain)
  const P = () => (window.NKConfig ? NKConfig.project() : null);
  const DEV_SESSION = 'nk-dev-session';
  // whole characters (an emoji is two code units): "Ivan Petrov" -> "IP", no name -> 🙂
  const initials = n => { const s = String(n || '').trim(); return s ? s.split(/\s+/).map(w => Array.from(w)[0]).slice(0, 2).join('').toUpperCase() : '🙂'; };
  const back = () => location.href.split('#')[0];
  /** a drawn icon of the top-bar family (js/app.js NavIcons.icon) — the sync panel has no emoji chrome (v229) */
  const IC = (n, s) => (window.NavIcons && NavIcons.icon ? NavIcons.icon(n, s) : '');
  const H = (n, t, s) => `<span class="ui-t">${IC(n, s || 20)}<span>${t}</span></span>`;

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
        UI.toast('Фото профиля сохранено', 'good');
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
    /** a project is set: built in (js/config.js), Settings → Облако, or the local dev API */
    cloudReady() { return !!P(); },
    /** the local dev API's stand-in sign-in (localhost + ?nkdev=1 only — js/config.js) */
    devAuth() { const p = P(); return !!(p && p.devAuth); },
    async client() {
      const p = P();
      if (!p) return this.sb;
      if (p.devAuth) { // no supabase-js: the dev API knows users only by `Bearer dev:<id>`
        if (!this._devUp) { this._devUp = true; let s = null; try { s = JSON.parse(localStorage.getItem(DEV_SESSION) || 'null'); } catch (e) { s = null; } this.user = s && s.user && s.user.id ? s.user : null; this.afterAuth(); }
        return null;
      }
      if (this.sb && this._sbUrl === p.url) return this.sb;
      await U.loadScript(SB_LIB);
      this.sb = window.supabase.createClient(p.url, p.key, { auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true } });
      this._sbUrl = p.url;
      const { data } = await this.sb.auth.getSession();
      this.user = data && data.session ? data.session.user : null;
      this.sb.auth.onAuthStateChange((_e, s) => { const was = this.user && this.user.id; this.user = s ? s.user : null; if (was !== (this.user && this.user.id) || _e === 'SIGNED_IN' || _e === 'SIGNED_OUT') this.afterAuth(); });
      this.afterAuth();
      return this.sb;
    },
    /** the session's access token for the Norsk Kort server (js/net.js); force → refreshed now. '' when signed out */
    async accessToken(force) {
      if (!this.user) { await this.client().catch(() => null); if (!this.user) return ''; }
      if (this.devAuth()) return 'dev:' + this.user.id;
      const sb = await this.client(); if (!sb) return '';
      if (force) { try { const r = await sb.auth.refreshSession(); if (r && r.data && r.data.session) return r.data.session.access_token || ''; } catch (e) { /* offline */ } }
      const { data } = await sb.auth.getSession();
      return (data && data.session && data.session.access_token) || '';
    },
    /** dev API only: a stable stand-in user id from the e-mail */
    _devUser(email) {
      let h1 = 0x811c9dc5, h2 = 0x01000193; const s = String(email || '').toLowerCase();
      for (let i = 0; i < s.length; i++) { h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619); h2 = Math.imul(h2 + s.charCodeAt(i), 2246822519); }
      const hex = [h1, h2, h1 ^ h2, Math.imul(h1, 31) ^ h2].map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
      const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
      return { id, email, app_metadata: { provider: 'email' }, user_metadata: {} };
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
      if (window.CloudSync) CloudSync.onAuth(u);
      if (window.Pro && Pro.onAuth) { try { Pro.onAuth(u); } catch (e) { console.warn('pro', e); } }
      if (window.App && App.view && App.view.name === 'account') App.render();
    },
    /** ☁️ what a whole-state cloud copy may contain: everything except the personal course decks (they stay on this device).
     *  The real sync is per record — js/cloudsync.js (same rules: no keys, no personal decks). */
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
        UI.toast(error ? error.message : `Ссылка для входа отправлена на ${email}`, error ? 'bad' : 'good', 7000);
        return;
      }
      let r = await sb.auth.signInWithPassword({ email, password });
      if (r.error && /invalid login/i.test(r.error.message)) {
        if (!(await UI.confirm('Аккаунта с этой почтой ещё нет. Зарегистрироваться?', { ok: 'Зарегистрироваться' }))) return;
        r = await sb.auth.signUp({ email, password, options: { emailRedirectTo: back() } });
        if (!r.error) UI.toast('Подтвердите почту — письмо уже отправлено', 'good', 7000);
      }
      if (r.error) UI.toast(r.error.message, 'bad', 6000);
    },
    /** ☁️ e-mail sign-in without a password: one letter with a one-time code AND a link (js/signin.js) → { error } */
    async sendCode(email) {
      if (this.devAuth()) return { error: '' }; // dev API: any 6 digits sign in
      try {
        const sb = await this.client(); if (!sb) return { error: 'Облако не подключено' };
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: back(), shouldCreateUser: true } });
        return { error: error ? error.message : '' };
      } catch (e) { return { error: e.message || 'Нет связи с облаком' }; }
    },
    async verifyCode(email, token) {
      if (this.devAuth()) {
        if (!/^\d{6,10}$/.test(String(token || ''))) return { error: 'Код не подошёл или устарел — запросите новый' };
        this.user = this._devUser(email);
        try { localStorage.setItem(DEV_SESSION, JSON.stringify({ user: this.user })); } catch (e) { /* this visit only */ }
        this.afterAuth();
        return { error: '' };
      }
      try {
        const sb = await this.client(); if (!sb) return { error: 'Облако не подключено' };
        const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
        if (error) return { error: /expired|invalid/i.test(error.message) ? 'Код не подошёл или устарел — запросите новый' : error.message };
        if (data && data.user) { this.user = data.user; this.afterAuth(); }
        return { error: '' };
      } catch (e) { return { error: e.message || 'Нет связи с облаком' }; }
    },
    async resetPassword(email) {
      const sb = await this.client(); if (!sb) return;
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: back() });
      UI.toast(error ? error.message : 'Письмо для смены пароля отправлено', error ? 'bad' : 'good', 6000);
    },
    /** sign out: the data stays on this device unless the user asks to remove it (it is in the cloud anyway) */
    async signOut() {
      const r = await UI.askClose({ title: 'Выйти из аккаунта?',
        text: 'Колоды, карточки и прогресс на этом устройстве останутся — работать можно и без входа. Можно и убрать их отсюда: копия есть в облаке, после входа всё вернётся.',
        actions: [{ label: `${IC('signout')}<span>Выйти</span>`, value: 'keep', cls: 'primary', attr: 'data-out="keep"' }, { label: `${IC('trash')}<span>Выйти и убрать данные с устройства</span>`, value: 'wipe', cls: 'bad', attr: 'data-out="wipe"' }],
        cancel: 'Отмена' });
      if (!r) return;
      const CS = window.CloudSync;
      if (CS && this.user) {
        // the last changes go up first
        const ok = await CS.sync();
        if (r === 'wipe' && (!ok || CS.pending())) {
          if (!(await UI.confirm('Не все изменения успели попасть в облако (нет сети?). Если убрать данные сейчас, эти изменения пропадут. Всё равно убрать?', { ok: 'Убрать', danger: true }))) return;
        }
        if (r === 'wipe') await CS.wipeLocal();
      }
      await this.endSession();
      UI.toast(r === 'wipe' ? 'Вы вышли · данные убраны с этого устройства' : 'Вы вышли · данные остались на этом устройстве', 'good', 3500);
      App.render();
    },
    /** the session ends on this device (sign-out, a deleted account); the data on the device stays */
    async endSession() {
      if (this.devAuth()) { try { localStorage.removeItem(DEV_SESSION); } catch (e) { /* ignore */ } }
      else { try { const sb = await this.client(); if (sb) await sb.auth.signOut(); } catch (e) { /* offline: the local session ends anyway */ } }
      this.user = null;
      if (window.CloudSync) CloudSync.onAuth(null);
      if (window.Pro && Pro.onAuth) { try { Pro.onAuth(null); } catch (e) { /* ignore */ } }
      this.paintTop();
    },
    /** 🗑 «Удалить аккаунт» (App Store 5.1.1(v)): the server deletes the cloud copy, files, usage, devices, the subscription
     *  record and the user (account-delete); the decks on THIS device stay. Asks first, clearly. → true when deleted */
    async deleteAccount() {
      const u = this.user;
      if (!u) return false;
      const store = window.Pro && Pro.state && Pro.state.active && (Pro.state.source === 'store');
      const r = await UI.askClose({ title: 'Удалить аккаунт навсегда?',
        text: `Будут удалены аккаунт <b>${U.esc(u.email || '')}</b>, облачная копия колод и карточек, картинки и звуки в облаке, история и Pro этого аккаунта. Вернуть это нельзя.`,
        line: `Колоды на этом устройстве останутся — работать можно и без аккаунта.${store ? ' Подписку в App Store или Google Play отмените там же — удаление аккаунта её не отменяет.' : ''}`,
        actions: [{ label: `${IC('trash')}<span>Удалить навсегда</span>`, value: 'delete', cls: 'bad', attr: 'data-acc-del-yes' }], cancel: 'Отмена' });
      if (r !== 'delete') return false;
      const busy = UI.busy ? UI.busy('Удаляем аккаунт…') : null;
      try {
        await Net.callFn('account-delete', {}, { retries: 0, timeout: 45000 });
      } catch (e) {
        if (busy && busy.close) busy.close();
        UI.toast(e && e.nk ? e.message : U.niceErr(e, 'Удаление аккаунта'), 'bad', 7000);
        return false;
      }
      if (busy && busy.close) busy.close();
      await this.endSession();
      // the cloud copy is gone: the decks on this device are the only ones left — ask, and offer a file first
      const wiped = await this.askWipeAfterDelete();
      UI.toast(wiped ? 'Аккаунт удалён · данные убраны с этого устройства' : 'Аккаунт удалён. Колоды на этом устройстве остались', 'good', 6000);
      if (window.App) App.render();
      return true;
    },
    /** after «Удалить аккаунт»: «Удалить и данные на этом устройстве?» → true when they were removed */
    async askWipeAfterDelete() {
      if (!(window.CloudSync && CloudSync.wipeLocal)) return false;
      const pers = Store.decks().some(d => Store.isPersonalDeck && Store.isPersonalDeck(d));
      for (;;) {
        const r = await UI.askClose({ title: 'Удалить и данные на этом устройстве?',
          text: 'Аккаунт удалён. На этом устройстве остались колоды, карточки и прогресс — облачной копии больше нет, поэтому если убрать их отсюда, вернуть их будет нельзя.',
          line: `Можно сначала скачать копию файлом.${pers ? ' Личные колоды из учебника останутся на устройстве в любом случае.' : ''}`,
          actions: [{ label: `${IC('check')}<span>Оставить на устройстве</span>`, value: 'keep', cls: 'primary', attr: 'data-acc-wipe="keep"' },
            { label: `${IC('download')}<span>Скачать копию</span>`, value: 'backup', attr: 'data-acc-wipe="backup"' },
            { label: `${IC('trash')}<span>Удалить с устройства</span>`, value: 'wipe', cls: 'bad', attr: 'data-acc-wipe="wipe"' }],
          cancel: 'Оставить' });
        if (r === 'backup') { try { Exporter.backup(); } catch (e) { /* the download failed: ask again */ } continue; }
        if (r !== 'wipe') return false;
        try { await CloudSync.wipeLocal(); return true; } catch (e) { UI.toast(U.niceErr(e, 'Удаление данных'), 'bad', 6000); return false; }
      }
    },
  };

  /* ---------- what syncs / what never leaves this device ---------- */
  function syncWhatHtml() {
    const pers = Store.decks().some(d => Store.isPersonalDeck && Store.isPersonalDeck(d));
    return `<div class="acc-sync-what">
      <div class="acc-sw acc-sw-yes"><b class="ui-t">${IC('cloud-check')}<span>Синхронизируется</span></b><ul>
        <li>Колоды и карточки — с повторениями, проверками нейросети, формами, примерами и историей</li>
        <li>Журнал ответов, очки и дни подряд, «Фраза дня», «Учить по материалам», тест уровня</li>
        <li>Ваши исправления переводов и подсказок к словам</li>
        <li>Картинки и звук карточек, обложки колод, фото профиля</li>
        <li>Настройки: вид, голоса для языков, занятия</li></ul></div>
      <div class="acc-sw acc-sw-no"><b class="ui-t">${IC('lock')}<span>Никогда не покидает это устройство</span></b><ul>
        <li>Ключи и токены — нейросети, DeepL, голоса, YouTube… и ключ самого облака</li>
        <li>Мост на Mac и Telegram</li>
        <li>Установленные на устройстве голоса, разрешение звука, размеры окон</li>
        <li>Личные колоды из учебника${pers ? ' — они есть на этом устройстве и останутся только здесь' : ''}</li></ul></div>
    </div>`;
  }

  /* ---------- page «👤 Мой кабинет» ---------- */
  Views.account = function (root) {
    const s = st(), all = Store.deckStats(null), streak = Store.streakDays(), u = Account.user;
    root.innerHTML = `
      <div class="acc-head panel">
        <button class="acc-photo" data-act="${s.avatar ? 'photo-edit' : 'photo'}" title="${s.avatar ? 'Изменить кадр' : 'Добавить фото'}" aria-label="${s.avatar ? 'Изменить кадр' : 'Добавить фото'}">${Account.avatarHtml(120)}<span class="acc-photo-edit" aria-hidden="true">${IC('camera', 18)}</span></button>
        <div class="grow col" style="gap:8px;min-width:220px">
          <input class="input acc-name" data-acc-name value="${U.esc(s.userName || '')}" placeholder="Ваше имя" maxlength="40">
          <div class="small muted">${u ? `<span class="ui-t acc-in">${IC('cloud-check', 18)}<span>${U.esc(u.email || '')} · вход через ${U.esc((u.app_metadata || {}).provider || 'почту')}</span></span>` : Account.cloudReady() ? 'Вы не вошли — данные хранятся только на этом устройстве' : 'Профиль на этом устройстве · облако не подключено'}</div>
          <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm primary" data-act="photo">${IC('camera')}<span>${s.avatar ? 'Выбрать другое фото' : 'Добавить фото'}</span></button>
            ${s.avatar ? `<button class="btn sm" data-act="photo-edit">${IC('crop')}<span>Изменить кадр</span></button><button class="btn sm ghost" data-act="photo-rm">${IC('trash')}<span>Убрать фото</span></button>` : ''}</div>
        </div>
      </div>
      <div class="stat-grid" style="margin-top:14px">
        <div class="stat"><b>🧠 ${Progress.knowledgeNow()}%</b><span>знание</span></div>
        <div class="stat"><b>🔥 ${streak}</b><span>${U.plural(streak, ['день', 'дня', 'дней'])} подряд</span></div>
        <div class="stat"><b>${all.total}</b><span>карточек · ${Store.decks().length} колод</span></div>
        <div class="stat"><b>${Store.state.log.length}</b><span>ответов всего</span></div>
      </div>
      ${window.Pro && Pro.panelHtml ? Pro.panelHtml() : ''}
      <div class="panel acc-cloud" style="margin-top:14px">
        <h3>${H('cloud', u ? 'Синхронизация между устройствами' : 'Аккаунт — по желанию', 22)}</h3>
        ${u ? `<div class="row acc-who"><span>Вы вошли как <b>${U.esc(u.email || u.id)}</b></span><button class="btn sm ghost" data-act="signout">${IC('signout')}<span>Выйти</span></button></div>
            <div class="acc-sync-row">${window.CloudSync ? CloudSync.statusHtml() : ''}<button class="btn sm primary" data-act="sync-now" data-sync-now>${IC('sync')}<span>Синхронизировать сейчас</span></button></div>
            ${syncWhatHtml()}
            <div class="acc-danger"><button class="btn sm ghost acc-del" data-act="acc-delete">${IC('trash')}<span>Удалить аккаунт</span></button><span class="tiny muted">Облачная копия и аккаунт удаляются навсегда; данные на этом устройстве остаются.</span></div>`
          : Account.cloudReady() ? `<p class="acc-free"><b>Войдите — и колоды, карточки, прогресс и настройки будут на всех ваших устройствах.</b> <span class="muted">Без входа всё работает на этом устройстве.</span></p>
            ${window.CloudSync ? `<div class="acc-sync-row">${CloudSync.statusHtml()}</div>` : ''}
            <div class="row acc-cloud-acts">
              <button class="btn primary" data-act="signin">${IC('cloud')}<span>Войти</span></button>
              <button class="btn" data-act="backup">${IC('download')}<span>Скачать копию</span></button>
              <button class="btn ghost" data-act="restore">${IC('upload')}<span>Восстановить из файла</span></button>
            </div>`
          : `<p class="acc-free"><b>Аккаунт не нужен — всё хранится на этом устройстве.</b> <span class="muted">Вход понадобится только для облачной копии и других ваших устройств.</span></p>
            <div class="row acc-cloud-acts">
              <button class="btn primary" data-act="signin">${IC('cloud')}<span>${Account.cloudReady() ? 'Войти для облачной копии' : 'Вход и облако'}</span></button>
              <button class="btn" data-act="backup">${IC('download')}<span>Скачать копию</span></button>
              <button class="btn ghost" data-act="restore">${IC('upload')}<span>Восстановить из файла</span></button>
            </div>
            ${Account.cloudReady() ? '' : '<div class="tiny muted" style="margin-top:8px">Облако не подключено: <button class="btn sm ghost" data-act="to-cloud">Настройки → Облако</button></div>'}`}
        ${!u && Store.decks().some(d => Store.isPersonalDeck && Store.isPersonalDeck(d)) ? `<div class="tiny muted acc-pers" style="margin-top:8px">${IC('lock', 16)}<span>${U.esc(Store.PERSONAL_NOTE)}: в облако они не попадут.</span></div>` : ''}
      </div>
      ${UI.keysNoteHtml()}`;
    root.onclick = async e => {
      const a = e.target.closest('[data-act]'); if (!a) return;
      switch (a.dataset.act) {
        case 'signin': SignIn.open(); break;
        case 'backup': Exporter.backup(); break;
        case 'restore': App.pickFiles(); break;
        case 'photo': Account.choosePhoto(); break;
        case 'photo-edit': Account.editPhoto(); break;
        case 'photo-rm': Account.removePhoto(); break;
        case 'to-cloud': App.go('settings'); setTimeout(() => { const el = document.querySelector('[data-text="cloudUrl"]'); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } }, 250); break;
        case 'signout': Account.signOut(); break;
        case 'sync-now': if (window.CloudSync) { a.disabled = true; CloudSync.syncNow().finally(() => { a.disabled = false; }); } break;
        case 'keys-note-ok': Store.setSetting('keysNoteSeen', true); a.closest('details').open = false; break;
        case 'acc-delete': Account.deleteAccount(); break;
        default: if (window.Pro && Pro.onPanelAct) Pro.onPanelAct(a.dataset.act, a);
      }
    };
    root.oninput = e => { if (e.target.matches('[data-acc-name]')) { Store.setSetting('userName', e.target.value.trim()); Account.paintTop(); } };
  };

  window.Account = Account;
  // started by App.init after the data is loaded (Store.state exists only then)
  Account.init = function () { this.paintTop(); if (this.cloudReady()) this.client().catch(() => {}); };
})();
