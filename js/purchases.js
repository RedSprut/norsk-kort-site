/* ============ 💳 Billing — buying «Norsk Kort Pro», one interface for every platform ============
 * The store only takes the money; the SERVER decides Pro (RevenueCat → webhook rc-webhook → `me`, js/pro.js). The
 * RevenueCat app user id is the Supabase user id (Billing.logIn before any purchase), entitlement NK_CONFIG.rcEntitlement.
 *   native  the iPhone / Android apps (Capacitor): window.Capacitor.Plugins.Purchases (@revenuecat/purchases-capacitor,
 *           registered by the native shell — a later workstream), keys NK_CONFIG.rcIosKey / rcAndroidKey
 *   web     the site: RevenueCat Web SDK (@revenuecat/purchases-js 1.74.0, MIT, vendored in vendor/revenuecat/ — loaded only
 *           when the paywall opens and NK_CONFIG.rcWebKey is set); its checkout (Paddle / Stripe) opens over the page
 *   mock    developers only: ?purchasesMock=1 (or =fail) on localhost / 127.0.0.1 — a pretend store, no money, nothing sent
 *   none    no key configured → Billing.available() = false; the paywall says politely that subscriptions come soon
 * API (all async, never technical text — a thrown error's .message is one calm Russian sentence):
 *   Billing.kind() → 'native'|'web'|'mock'|'none' · Billing.available() · Billing.platform() → 'ios'|'android'|'web'
 *   Billing.offerings() → { plans: [{ id: 'yearly'|'monthly', price, amount, currency, perMonth, pkg }], saving, fromStore }
 *   Billing.purchase(plan) → { ok: true } | { cancelled: true } | { pending: true }
 *   Billing.restore() → { active } (the store's view; the server is asked afterwards anyway)
 *   Billing.logIn(userId) · Billing.logOut() · Billing.manageUrl() → '' or a link to manage / cancel the subscription
 */
(function () {
  'use strict';
  const RC_WEB_SDK = 'vendor/revenuecat/purchases-js-1.74.0.umd.js';
  const C = () => window.NK_CONFIG || {};
  const ENT = () => C().rcEntitlement || 'pro';
  const MOCK_KEY = 'nk-purchases-mock';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const capNative = () => { try { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); } catch (e) { return false; } };
  const capPlatform = () => { try { return String(Capacitor.getPlatform()).toLowerCase(); } catch (e) { return ''; } };
  const plugin = () => { try { return (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Purchases) || null; } catch (e) { return null; } };
  const nativeKey = () => (capPlatform() === 'ios' ? C().rcIosKey : capPlatform() === 'android' ? C().rcAndroidKey : '') || '';
  const isLocal = () => !!(window.NKConfig && NKConfig.isLocalHost && NKConfig.isLocalHost());

  /* ?purchasesMock=1 | fail — remembered for this tab; only on this computer (never on the site or in the apps) */
  (function mockSwitch() {
    try {
      const p = new URLSearchParams(location.search);
      if (!p.has('purchasesMock')) return;
      const v = p.get('purchasesMock');
      if (!isLocal() || v === '0') sessionStorage.removeItem(MOCK_KEY);
      else sessionStorage.setItem(MOCK_KEY, v === 'fail' ? 'fail' : '1');
    } catch (e) { /* private mode */ }
  })();
  const mockMode = () => { if (!isLocal() || capNative()) return ''; try { return sessionStorage.getItem(MOCK_KEY) || ''; } catch (e) { return ''; } };

  function kind() {
    if (capNative()) return plugin() && nativeKey() ? 'native' : 'none';
    if (mockMode()) return 'mock';
    if (String(C().rcWebKey || '').trim()) return 'web';
    return 'none';
  }
  const platform = () => (capNative() ? (capPlatform() === 'ios' ? 'ios' : capPlatform() === 'android' ? 'android' : 'web') : 'web');

  /** a calm error the paywall shows as it is */
  const calm = (msg, extra) => Object.assign(new Error(msg), { calm: true }, extra || {});
  const RC = { cancelled: 1, store: 2, notAllowed: 3, invalid: 4, unavailable: 5, already: 6, network: 10, pending: 20, config: 23 };
  function storeError(e) {
    const code = e && (e.errorCode != null ? +e.errorCode : e.code != null ? +e.code : NaN);
    const raw = String((e && (e.message || e.underlyingErrorMessage)) || '');
    if (e && e.userCancelled) return { cancelled: true };
    if (code === RC.cancelled || /cancel/i.test(raw)) return { cancelled: true };
    if (code === RC.pending) return { pending: true };
    const off = (() => { try { return navigator.onLine === false; } catch (x) { return false; } })();
    let m;
    if (off || code === RC.network) m = 'Нет связи с магазином — проверьте интернет и попробуйте ещё раз';
    else if (code === RC.already) m = 'Эта подписка уже оформлена — нажмите «Восстановить покупки»';
    else if (code === RC.notAllowed) m = 'Покупки на этом устройстве запрещены — проверьте ограничения в настройках магазина';
    else if (code === RC.store || code === RC.unavailable || code === RC.invalid) m = 'Магазин сейчас не может оформить подписку — попробуйте чуть позже';
    else if (code === RC.config) m = 'Подписка пока недоступна — мы уже чиним';
    else m = 'Покупка не прошла. Если деньги всё же списались, нажмите «Восстановить покупки»';
    console.warn('[Billing]', code, raw);
    return { error: calm(m) };
  }

  /* ---------- number formatting ---------- */
  function money(amount, currency, fallback) {
    if (!Number.isFinite(amount) || !currency) return fallback || '';
    try { return new Intl.NumberFormat('ru-RU', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount); } catch (e) { return fallback || ''; }
  }
  function finish(monthly, yearly, fromStore) {
    const P = C().prices || {};
    const plans = [];
    if (yearly) plans.push(Object.assign({ id: 'yearly' }, yearly));
    if (monthly) plans.push(Object.assign({ id: 'monthly' }, monthly));
    let saving = P.saving || 48;
    if (monthly && yearly && Number.isFinite(monthly.amount) && Number.isFinite(yearly.amount) && monthly.amount > 0 && monthly.currency === yearly.currency) {
      saving = Math.max(0, Math.round((1 - yearly.amount / (12 * monthly.amount)) * 100));
    }
    if (yearly && !yearly.perMonth) yearly.perMonth = Number.isFinite(yearly.amount) ? money(Math.floor(yearly.amount / 12 * 100) / 100, yearly.currency, P.yearlyPerMonth) : (P.yearlyPerMonth || '');
    return { plans, saving, fromStore: !!fromStore };
  }
  /** the prices of NK_CONFIG (the paywall can always draw itself) */
  function configPlans() {
    const P = C().prices || {};
    return finish({ price: P.monthly || '€7.99', amount: 7.99, currency: 'EUR' }, { price: P.yearly || '€49.99', amount: 49.99, currency: 'EUR', perMonth: P.yearlyPerMonth || '€4.17' }, false);
  }

  /* ---------- 📱 native (Capacitor plugin) ---------- */
  let natUser = '';
  const Native = {
    async ensure(userId) {
      const P = plugin();
      if (!natUser) { await P.configure({ apiKey: nativeKey(), appUserID: userId }); natUser = userId; }
      else if (natUser !== userId) { await P.logIn({ appUserID: userId }); natUser = userId; }
      return P;
    },
    async offerings(userId) {
      const P = await this.ensure(userId);
      const o = await P.getOfferings();
      const off = (C().rcOffering && o && o.all && o.all[C().rcOffering]) || (o && o.current);
      if (!off) return null;
      const pk = t => off[t === 'MONTHLY' ? 'monthly' : 'annual'] || (off.availablePackages || []).find(p => p.packageType === t) || null;
      const one = p => (p && p.product ? { price: p.product.priceString, amount: +p.product.price, currency: p.product.currencyCode, pkg: p } : null);
      return finish(one(pk('MONTHLY')), one(pk('ANNUAL')), true);
    },
    async purchase(plan, userId) {
      const P = await this.ensure(userId);
      try { await P.purchasePackage({ aPackage: plan.pkg }); return { ok: true }; } catch (e) { const r = storeError(e); if (r.error) throw r.error; return r; }
    },
    async restore(userId) {
      const P = await this.ensure(userId);
      const r = await P.restorePurchases();
      const ci = r && (r.customerInfo || r);
      return { active: !!(ci && ci.entitlements && ci.entitlements.active && ci.entitlements.active[ENT()]) };
    },
    async logIn(userId) { if (natUser && natUser !== userId) { await plugin().logIn({ appUserID: userId }); natUser = userId; } },
    async logOut() { if (natUser) { try { await plugin().logOut(); } catch (e) { /* anonymous already */ } natUser = '(anonymous)'; } },
    async manageUrl() { return capPlatform() === 'ios' ? 'https://apps.apple.com/account/subscriptions' : capPlatform() === 'android' ? 'https://play.google.com/store/account/subscriptions' : ''; },
  };

  /* ---------- 🌐 web (RevenueCat Web SDK, vendored) ---------- */
  let webInst = null;
  const Web = {
    async sdk() {
      if (!window.Purchases || !window.Purchases.Purchases) {
        try { await U.loadScript(RC_WEB_SDK); } catch (e) { throw calm('Не удалось открыть оплату — проверьте интернет и попробуйте ещё раз'); }
      }
      if (!window.Purchases || !window.Purchases.Purchases) throw calm('Не удалось открыть оплату — попробуйте позже');
      return window.Purchases;
    },
    async ensure(userId) {
      const NS = await this.sdk(), K = NS.Purchases;
      if (!K.isConfigured()) webInst = K.configure({ apiKey: String(C().rcWebKey).trim(), appUserId: userId });
      else {
        webInst = K.getSharedInstance();
        if (webInst.getAppUserId && webInst.getAppUserId() !== userId) await webInst.changeUser(userId);
      }
      return webInst;
    },
    async offerings(userId) {
      const inst = await this.ensure(userId);
      const o = await inst.getOfferings();
      const off = (C().rcOffering && o && o.all && o.all[C().rcOffering]) || (o && o.current);
      if (!off) return null;
      const one = p => {
        const pr = p && (p.webBillingProduct || p.rcBillingProduct);
        return pr && pr.currentPrice ? { price: pr.currentPrice.formattedPrice, amount: pr.currentPrice.amountMicros / 1e6, currency: pr.currentPrice.currency, pkg: p } : null;
      };
      return finish(one(off.monthly), one(off.annual), true);
    },
    async purchase(plan, userId) {
      const inst = await this.ensure(userId);
      const email = window.Account && Account.user && Account.user.email ? Account.user.email : undefined;
      try { await inst.purchase({ rcPackage: plan.pkg, customerEmail: email, selectedLocale: 'ru' }); return { ok: true }; } catch (e) { const r = storeError(e); if (r.error) throw r.error; return r; }
    },
    async restore(userId) {
      const inst = await this.ensure(userId);
      const ci = await inst.getCustomerInfo();
      return { active: !!(ci && ci.entitlements && ci.entitlements.active && ci.entitlements.active[ENT()]), manage: ci && ci.managementURL };
    },
    async logIn(userId) { if (webInst && webInst.getAppUserId && webInst.getAppUserId() !== userId) { try { await webInst.changeUser(userId); } catch (e) { /* next ensure() */ } } },
    async logOut() { /* the next ensure() switches to the next user */ },
    async manageUrl(userId) { try { const r = await this.restore(userId); return r.manage || ''; } catch (e) { return ''; } },
  };

  /* ---------- 🧪 mock (localhost + ?purchasesMock=1) ---------- */
  const MOCK_BOUGHT = 'nk-purchases-mock-bought';
  const Mock = {
    async offerings() { await sleep(250); return configPlans(); },
    purchase(plan) {
      if (mockMode() === 'fail') return sleep(500).then(() => { throw storeError({ errorCode: RC.store }).error; });
      return new Promise(resolve => {
        let res = { cancelled: true };
        const m = UI.modal({ title: 'Тестовая покупка', cls: 'narrow pw-mock',
          body: `<p>Проверка на компьютере разработчика — настоящих денег нет, ничего никуда не отправляется.</p><p><b>Norsk Kort Pro · ${U.esc(plan.id === 'yearly' ? 'год' : 'месяц')} · ${U.esc(plan.price)}</b></p>`,
          foot: '<button class="btn ghost" data-mock-cancel>Отмена</button><button class="btn primary" data-mock-buy>Купить (тест)</button>',
          onClose: () => resolve(res) });
        m.$('[data-mock-buy]').onclick = () => { res = { ok: true }; try { sessionStorage.setItem(MOCK_BOUGHT, plan.id); } catch (e) { /* ignore */ } m.close(); };
        m.$('[data-mock-cancel]').onclick = () => m.close();
      });
    },
    async restore() { await sleep(400); let b = ''; try { b = sessionStorage.getItem(MOCK_BOUGHT) || ''; } catch (e) { /* ignore */ } return { active: !!b }; },
    async logIn() {}, async logOut() {},
    async manageUrl() { return ''; },
  };

  const impl = () => ({ native: Native, web: Web, mock: Mock })[kind()] || null;
  const needUser = () => { const u = window.Account && Account.user; if (!u) throw calm('Сначала войдите в аккаунт'); return u.id; };

  const Billing = {
    kind, platform,
    available() { return kind() !== 'none'; },
    configPlans,
    async offerings() {
      const I = impl(); if (!I) return configPlans();
      const r = await I.offerings(I === Mock ? '' : needUser());
      return r && r.plans.length ? r : configPlans();
    },
    async purchase(plan) {
      const I = impl(); if (!I) throw calm('Подписка пока недоступна');
      if (!plan || (I !== Mock && !plan.pkg)) throw calm('Цены ещё не загрузились — попробуйте через минуту');
      return I.purchase(plan, I === Mock ? '' : needUser());
    },
    async restore() {
      const I = impl(); if (!I) return { active: false };
      try { return await I.restore(I === Mock ? '' : needUser()); } catch (e) { if (e && e.calm) throw e; const r = storeError(e); throw r.error || calm('Не получилось связаться с магазином — попробуйте позже'); }
    },
    async logIn(userId) { const I = impl(); if (I && userId) { try { await I.logIn(userId); } catch (e) { /* next purchase configures */ } } },
    async logOut() { const I = impl(); if (I) { try { await I.logOut(); } catch (e) { /* ignore */ } } },
    async manageUrl() { const I = impl(); if (!I) return ''; try { return await I.manageUrl(window.Account && Account.user ? Account.user.id : ''); } catch (e) { return ''; } },
    _t: { storeError, finish, money, mockMode, RC_WEB_SDK },
  };
  window.Billing = Billing;
})();
