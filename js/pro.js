/* ============ ⭐ Pro — «Norsk Kort Pro»: who has it, and the one door to it ============
 * The SERVER decides Pro (GET me — docs/api-contract.md); this module only remembers its last answer to draw the UI.
 *   Pro.state         { userId, active, source: 'store'|'web'|'grant'|null, grant_kind, product_id, expires_at, will_renew,
 *                       usage: { ai_pct, tts_pct, resets_at }, checkedAt }  — localStorage 'nk-pro' (per account + device,
 *                       never synced: js/cloudsync.js NEVER_SET)
 *   Pro.isActive()    the signed-in person has Pro (store / web subscription, or a grant — the owner's own grant shows Pro too)
 *   Pro.ready()       Pro can answer now: a project + signed in + active (js/ai.js uses it for the 'pro' provider)
 *   Pro.offered()     the Norsk Kort server is set up (js/config.js) — only then is Pro offered anywhere
 *   Pro.refresh({force}) → state   (GET me; on sign-in, on start, on focus after 10 min, after a purchase)
 *   Pro.require(feature, { reason }) → Promise<boolean>   THE door: Pro already → true at once; not signed in → the sign-in
 *       sheet first (SignIn.open reason 'pro'); for reason 'ai' | 'translate' | 'voice' the one-time AI consent next
 *       (js/aiconsent.js — declined → false, nothing is sold that would not be used); signed in → `me` again (a grant needs
 *       no purchase); else the paywall (js/paywall.js). true = Pro is active now → the caller continues the action it was
 *       asked for (nothing is lost).
 *       One at a time: a second call while the first is open gets the same answer.
 *   Pro.pollUntilActive({ timeout, onTick }) → boolean   (after a purchase: `me` ≈ 1/s up to 60 s)
 *   Pro.panelHtml() / Pro.onPanelAct(act)   the «Norsk Kort Pro» block of «👤 Мой кабинет» (js/account.js)
 *   Pro.label() · Pro.usageNote()   short texts for other screens (Settings «Norsk Kort Pro» block — W7)
 *   Events: window 'nk-pro' (detail: Pro.state) whenever the state changes.
 */
(function () {
  'use strict';
  const LS = 'nk-pro';
  const FRESH = 6 * 3600e3, FOCUS = 10 * 60e3;
  const IC = (n, s) => (window.NavIcons && NavIcons.icon ? NavIcons.icon(n, s) : '');
  const esc = s => (window.U && U.esc ? U.esc(s) : String(s == null ? '' : s));
  const empty = () => ({ userId: '', active: false, source: null, grant_kind: null, product_id: null, expires_at: null, will_renew: null, usage: null, checkedAt: 0 });
  const uid = () => (window.Account && Account.user ? Account.user.id : '');
  const fmtDate = iso => { const t = Date.parse(iso || ''); if (!Number.isFinite(t)) return ''; try { return new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } };

  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { s = null; }
    return Object.assign(empty(), s && typeof s === 'object' ? s : {});
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify(Pro.state)); } catch (e) { /* private mode */ } }
  function emit() {
    try { window.dispatchEvent(new CustomEvent('nk-pro', { detail: Object.assign({}, Pro.state) })); } catch (e) { /* old browser */ }
    if (window.App && App.updateBadge) { try { App.updateBadge(); } catch (e) { /* not drawn yet */ } }
    if (window.App && App.view && App.view.name === 'account' && !document.querySelector('.pw-bd')) { try { App.render(); } catch (e) { /* ignore */ } }
  }
  let refreshing = null, requiring = null;

  const Pro = {
    state: load(),
    offered() { return !!(window.NKConfig && NKConfig.ready()); },
    isActive() { const u = uid(); return !!(u && this.state.userId === u && this.state.active); },
    ready() { return this.offered() && this.isActive(); },
    /** GET me → the state (shared while one is on its way). Throws the NetError when it fails and force is set */
    refresh(o = {}) {
      const u = uid();
      if (!u || !this.offered()) return Promise.resolve(this.state);
      if (!o.force && this.state.userId === u && Date.now() - this.state.checkedAt < (o.maxAge || FRESH)) return Promise.resolve(this.state);
      if (refreshing) return refreshing;
      refreshing = (async () => {
        try {
          const r = await Net.callFn('me', null, { method: 'GET', timeout: 15000 });
          if (uid() !== u) return this.state; // signed out / switched meanwhile
          this.set(r, u);
          return this.state;
        } catch (e) {
          if (e && e.code === 'unauthenticated') { /* the session ended: shown as signed out by js/account.js */ }
          if (o.force) throw e;
          return this.state;
        } finally { refreshing = null; }
      })();
      return refreshing;
    },
    /** a `me` answer → the state */
    set(r, u) {
      const p = (r && r.pro) || {};
      const was = JSON.stringify([this.state.userId, this.state.active, this.state.source, this.state.grant_kind, this.state.expires_at, this.state.usage]);
      this.state = { userId: u || uid(), active: !!p.active, source: p.source || null, grant_kind: p.grant_kind || null, product_id: p.product_id || null,
        expires_at: p.expires_at || null, will_renew: p.will_renew == null ? null : !!p.will_renew, usage: r && r.usage ? r.usage : null, checkedAt: Date.now() };
      save();
      if (r && 'ai_consent' in r && window.AIConsent) { try { AIConsent.fromServer(r.ai_consent); } catch (e) { console.warn('consent', e); } }
      if (was !== JSON.stringify([this.state.userId, this.state.active, this.state.source, this.state.grant_kind, this.state.expires_at, this.state.usage])) emit();
    },
    /** the server said 402 (js/ai.js): what we remembered is out of date */
    markInactive() { if (this.state.active) { this.state.active = false; this.state.checkedAt = 0; save(); emit(); } this.refresh({ force: true }).catch(() => {}); },
    /** js/account.js: signed in / out */
    onAuth(user) {
      if (!user) {
        if (this.state.userId || this.state.active) { this.state = empty(); save(); emit(); }
        if (window.Billing && Billing.logOut) Billing.logOut().catch(() => {});
        return;
      }
      if (this.state.userId && this.state.userId !== user.id) { this.state = empty(); save(); emit(); }
      if (window.Billing && Billing.logIn) Billing.logIn(user.id).catch(() => {});
      this.refresh().then(() => {
        // came back from Google / Apple sign-in that was started for Pro: the paywall opens again
        let pend = null;
        try { pend = JSON.parse(sessionStorage.getItem('nk-pro-pending') || 'null'); sessionStorage.removeItem('nk-pro-pending'); } catch (e) { pend = null; }
        if (pend && Date.now() - (+pend.t || 0) < 30 * 60e3 && !this.isActive()) setTimeout(() => this.require(pend.feature || 'pro'), 600);
      }).catch(() => {});
    },
    /** after a purchase: ask `me` about once a second until Pro is active (the RevenueCat webhook has landed) */
    async pollUntilActive(o = {}) {
      const until = Date.now() + (o.timeout || 60000);
      let n = 0;
      while (Date.now() < until) {
        if (o.signal && o.signal.aborted) return false;
        try { await this.refresh({ force: true }); } catch (e) { if (e && e.code === 'offline') { /* wait for the network */ } }
        if (this.isActive()) return true;
        n++;
        if (o.onTick) { try { o.onTick(n); } catch (e) { /* ignore */ } }
        await new Promise(r => setTimeout(r, n < 5 ? 1000 : 2000));
      }
      return this.isActive();
    },
    /**
     * THE door to a Pro feature. feature: what the person asked for, in Russian words («Проверить карточку») — shown in the
     * sign-in sheet and the paywall. → true when Pro is active (the caller then does the action), false otherwise.
     */
    require(feature, o = {}) {
      const aiReason = ['ai', 'translate', 'voice'].includes(o.reason || 'ai');
      if (this.isActive() && this.offered()) {
        // Pro already: only the one-time AI consent may still be missing (a button pressed again asks again)
        return aiReason && window.AIConsent && !AIConsent.granted() ? AIConsent.ensure({ feature, force: true }) : Promise.resolve(true);
      }
      if (requiring) return requiring;
      requiring = (async () => {
        try {
          if (!this.offered()) { if (window.Paywall) await Paywall.open({ feature, reason: o.reason, soon: true }); return false; }
          if (!uid()) {
            const signedIn = await new Promise(res => { if (window.SignIn) SignIn.open({ reason: 'pro', feature, onClose: res }); else res(false); });
            if (!signedIn || !uid()) return false;
          }
          try { await this.refresh({ force: true }); } catch (e) { /* the paywall says what is wrong when it matters */ }
          // Apple 5.1.2(i): the person agrees to the AI providers before the first Pro request (and before paying for it)
          if (aiReason && window.AIConsent &&!(await AIConsent.ensure({ feature, force: true }))) return false;
          if (this.isActive()) { UI.toast(this.state.source === 'grant' ? 'Pro уже подключён к вашему аккаунту' : 'У вас уже есть Norsk Kort Pro', 'good', 3500); return true; }
          if (!window.Paywall) return false;
          return !!(await Paywall.open({ feature, reason: o.reason }));
        } finally { requiring = null; }
      })();
      return requiring;
    },

    /* ---------- texts ---------- */
    label() {
      if (!this.isActive()) return '';
      const s = this.state;
      if (s.source === 'grant') return s.grant_kind === 'owner' ? 'Pro · владелец' : s.grant_kind === 'review' ? 'Pro · проверка' : 'Pro · подарок';
      return 'Norsk Kort Pro';
    },
    sourceText() {
      const s = this.state;
      if (s.source === 'grant') return s.grant_kind === 'owner' ? 'Pro владельца — без покупки и без срока' : s.expires_at ? `Pro подарен до ${fmtDate(s.expires_at)}` : 'Pro подарен вашему аккаунту';
      const plan = /year|annual|yearly/i.test(s.product_id || '') ? 'на год' : /month/i.test(s.product_id || '') ? 'на месяц' : '';
      const where = s.source === 'store' ? 'через App Store / Google Play' : s.source === 'web' ? 'на сайте' : '';
      const until = s.expires_at ? (s.will_renew === false ? `закончится ${fmtDate(s.expires_at)}` : `продлится ${fmtDate(s.expires_at)}`) : '';
      return ['Подписка', plan, where].filter(Boolean).join(' ') + (until ? ` · ${until}` : '');
    },
    /** the calm 80 % note (or '') */
    usageNote() {
      const u = this.isActive() && this.state.usage;
      if (!u) return '';
      const when = fmtDate(u.resets_at);
      if (u.ai_pct >= 100 || u.tts_pct >= 100) return `Месячный запас Pro израсходован — он обновится ${when || 'в начале месяца'}.`;
      if (u.ai_pct >= 80 || u.tts_pct >= 80) return `Израсходовано больше 80 % месячного запаса Pro — он обновится ${when || 'в начале месяца'}.`;
      return '';
    },

    /* ---------- «👤 Мой кабинет» → «Norsk Kort Pro» ---------- */
    panelHtml() {
      if (!this.offered()) return '';
      const P = window.Paywall, star = P && P.icon ? P.icon('crown', 22) : IC('sparkle', 22);
      const C = window.NK_CONFIG || {}, pr = C.prices || {};
      const signed = !!uid(), on = this.isActive(), s = this.state;
      const bar = (lbl, pct) => `<div class="pro-use"><span>${lbl}</span><span class="pro-use-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, +pct || 0)}" aria-label="${esc(lbl)}"><i style="width:${Math.min(100, +pct || 0)}%"></i></span><b>${Math.min(100, Math.round(+pct || 0))} %</b></div>`;
      let body;
      if (on) {
        const u = s.usage || {}, note = this.usageNote();
        const manage = s.source === 'store' || s.source === 'web';
        body = `<p class="pro-p"><span class="pro-on">${IC('check', 18)}<span>${esc(this.label())}</span></span> <span class="muted">${esc(this.sourceText())}</span></p>
          ${s.usage ? `<div class="pro-uses">${bar('Нейросеть', u.ai_pct)}${bar('Голоса', u.tts_pct)}</div>` : ''}
          ${note ? `<p class="pro-note">${esc(note)}</p>` : ''}
          <div class="row pro-acts">${manage ? `<button class="btn sm" data-act="pro-manage">${IC('licence')}<span>Управлять подпиской</span></button>` : ''}
            <button class="btn sm ghost" data-act="pro-refresh">${IC('refresh')}<span>Обновить статус</span></button></div>`;
      } else {
        body = `<p class="pro-p">Нейросеть проверяет карточки и подписывает слова, переводит субтитры и книги, читает естественными голосами — <b>без своих ключей</b>.
            <span class="muted">${esc(pr.monthly || '€7.99')} в месяц или ${esc(pr.yearly || '€49.99')} в год. Всё остальное в приложении бесплатно.</span></p>
          <div class="row pro-acts"><button class="btn sm primary" data-act="pro-open">${star}<span>${signed ? 'Подключить Pro' : 'Подробнее о Pro'}</span></button>
            ${signed ? `<button class="btn sm ghost" data-act="pro-restore">${IC('refresh')}<span>Восстановить покупки</span></button>` : ''}</div>`;
      }
      const consent = signed && window.AIConsent ? AIConsent.panelHtml() : '';
      return `<div class="panel acc-pro" style="margin-top:14px"><h3><span class="ui-t">${star}<span>Norsk Kort Pro</span></span></h3>${body}${consent}</div>`;
    },
    async onPanelAct(act, btn) {
      switch (act) {
        case 'pro-open': this.require('Norsk Kort Pro', { reason: 'account' }); break;
        case 'pro-refresh': {
          if (btn) btn.disabled = true;
          try { await this.refresh({ force: true }); UI.toast(this.isActive() ? 'Pro активен' : 'Pro не подключён', this.isActive() ? 'good' : '', 2500); }
          catch (e) { UI.toast(e && e.nk ? e.message : U.niceErr(e), 'warn', 5000); }
          finally { if (btn && btn.isConnected) btn.disabled = false; }
          break;
        }
        case 'pro-restore': if (window.Paywall) Paywall.restore({ standalone: true }); break;
        case 'aic-withdraw': case 'aic-allow': if (window.AIConsent) AIConsent.onAct(act); break;
        case 'pro-manage': {
          const url = window.Billing && Billing.manageUrl ? await Billing.manageUrl() : '';
          if (url) window.open(url, '_blank', 'noopener');
          else UI.toast(this.state.source === 'store' ? 'Подписка управляется в настройках App Store или Google Play на вашем телефоне' : 'Ссылка на управление подпиской пришла в письме об оплате', '', 6000);
          break;
        }
      }
    },
  };

  /* on start (after js/account.js knows the user) and when the app comes back to the screen */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !uid() || !Pro.offered()) return;
    Pro.refresh({ maxAge: FOCUS }).catch(() => {});
  });
  window.addEventListener('online', () => { if (uid() && Pro.offered()) Pro.refresh({ maxAge: FOCUS }).catch(() => {}); });

  window.Pro = Pro;
})();
