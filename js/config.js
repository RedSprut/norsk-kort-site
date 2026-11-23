/* ============ ⚙️ Norsk Kort — public configuration (ONE place) ============
 * What the app itself needs to know to reach the Norsk Kort server and the stores. Everything here is PUBLIC by design:
 *   supabaseUrl   https://<project-ref>.supabase.co — the owner's project (docs/owner-setup-server.md, step 1)
 *   supabaseKey   the project's publishable / anon key (Supabase → Project Settings → API keys). Public: it only names the
 *                 project; the server checks every user's session itself. NEVER the service_role / secret key here.
 *   rcWebKey      RevenueCat public Web Billing key (rcb_…) — the site sells Pro through RevenueCat (Paddle / Stripe)
 *   rcIosKey      RevenueCat public Apple key (appl_…) — the iPhone app (Capacitor)
 *   rcAndroidKey  RevenueCat public Google key (goog_…) — the Android app (Capacitor)
 *   castAppId     Google Cast receiver application id (receiver.html), '' = Google's default receiver
 *   termsUrl / privacyUrl  the legal pages (docs/legal → published next to index.html; placeholders until they exist)
 * Empty values = «not set up yet»: the app works exactly as before (sign-in only with Settings → ☁️ Облако, no Pro).
 * Secret keys (Anthropic, Google, RevenueCat secret, webhook password) live ONLY in Supabase function secrets — never here.
 *
 * NKConfig — the one reader every module uses (js/account.js, js/net.js, js/pro.js, js/purchases.js, js/signin.js):
 *   NKConfig.project()   → { url, key, source: 'dev' | 'own' | 'builtin', devAuth } or null — the project in use:
 *       1. 'dev'     a local dev API (supabase/scripts/dev.mjs on 127.0.0.1:54321) — ONLY when the app itself runs on this
 *                    computer (localhost / 127.0.0.1) AND the developer switched it on: open the app with ?nkdev=1 (or
 *                    ?nkdev=http://127.0.0.1:54321); ?nkdev=0 switches it off. Sign-in is then a stand-in (Bearer dev:<id>).
 *       2. 'own'     Settings → ☁️ Облако (Project URL + anon key): an advanced override, kept for people with their own project
 *       3. 'builtin' the values above
 *   NKConfig.ready() · NKConfig.functionsUrl() · NKConfig.get(name) · NKConfig.isLocalHost()
 * Also on window.NK_CONFIG (read-only, docs/release-architecture.md §3.1):
 *   publicBuild  false only when the app runs on the Mac itself (file / localhost, not the store apps) — the gate for the
 *                Mac-only sources (T1 / T4 / S4, Filmot, 'gtr' voices)
 *   functions    <built-in supabaseUrl>/functions/v1 ('' until it is set); the project in use: NKConfig.functionsUrl()
 */
(function () {
  'use strict';
  const NK_CONFIG = {
    supabaseUrl: '',          // e.g. 'https://abcdefghijklmnopqrst.supabase.co'  (owner: docs/owner-setup-server.md)
    supabaseKey: '',          // e.g. 'sb_publishable_…' or the legacy anon 'eyJ…'   — publishable / anon ONLY
    rcWebKey: '',             // RevenueCat → Project → API keys → Web Billing public key (rcb_…)
    rcIosKey: '',             // RevenueCat → Apple App Store public key (appl_…)
    rcAndroidKey: '',         // RevenueCat → Google Play public key (goog_…)
    rcEntitlement: 'pro',     // RevenueCat entitlement id (the server checks the same id)
    rcOffering: '',           // '' = RevenueCat's «current» offering (default: monthly + annual)
    castAppId: '',
    termsUrl: 'terms.html',   // placeholder paths: the legal workstream publishes them next to index.html
    privacyUrl: 'privacy.html',
    supportEmail: '',
    // shown on the paywall until the store answers with its own price strings (EUR, docs/release-architecture.md §4.2)
    prices: { monthly: '€7.99', yearly: '€49.99', yearlyPerMonth: '€4.17', saving: 48 },
  };
  /* a service_role / secret key must never ship: refuse it loudly in the console, use nothing */
  const looksSecret = k => /^sb_secret_/i.test(k) || (() => { try { const p = JSON.parse(atob(String(k).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); return p && p.role === 'service_role'; } catch (e) { return false; } })();

  const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/;
  const native = () => { try { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); } catch (e) { return false; } };
  /** the app runs on this computer (not the site, not the store apps) */
  const isLocalHost = () => !native() && (location.protocol === 'file:' || LOCAL.test(location.hostname));
  const DEV_KEY = 'nk-dev-api';
  const DEV_DEFAULT = 'http://127.0.0.1:54321';

  /* ?nkdev=1 | ?nkdev=<http://127.0.0.1:port> | ?nkdev=0 — remembered on this computer only; ignored anywhere else */
  (function devSwitch() {
    try {
      const p = new URLSearchParams(location.search);
      if (!p.has('nkdev')) return;
      if (!isLocalHost()) return;
      const v = (p.get('nkdev') || '').trim();
      if (v === '0' || v === 'off') localStorage.removeItem(DEV_KEY);
      else localStorage.setItem(DEV_KEY, /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/.test(v) ? v : DEV_DEFAULT);
    } catch (e) { /* private mode: no dev API */ }
  })();

  function devUrl() {
    if (!isLocalHost()) return '';
    let v = '';
    try { v = localStorage.getItem(DEV_KEY) || ''; } catch (e) { return ''; }
    // only a dev API on this same computer, never 8787/8788/8790 (the Mac bridge)
    const m = /^http:\/\/(127\.0\.0\.1|localhost):(\d{2,5})$/.exec(v);
    return m && ![8787, 8788, 8790].includes(+m[2]) ? v : '';
  }

  const clean = u => String(u || '').trim().replace(/\/+$/, '');
  const okUrl = u => /^https:\/\/[^\s/]+$/i.test(u) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(u);

  const NKConfig = {
    /** raw value of NK_CONFIG (read-only use) */
    get(name) { return NK_CONFIG[name]; },
    isLocalHost,
    /** the Supabase project in use, or null (nothing set up yet) */
    project() {
      const dev = devUrl();
      if (dev) return { url: dev, key: 'dev', source: 'dev', devAuth: true };
      let st = null;
      try { st = window.Store && Store.state && Store.settings; } catch (e) { st = null; }
      const ou = clean(st && st.cloudUrl), ok = String((st && st.cloudAnon) || '').trim();
      if (ou && ok && okUrl(ou) && !looksSecret(ok)) return { url: ou, key: ok, source: 'own', devAuth: false };
      const bu = clean(NK_CONFIG.supabaseUrl), bk = String(NK_CONFIG.supabaseKey || '').trim();
      if (bu && bk && okUrl(bu)) {
        if (looksSecret(bk)) { console.error('NK_CONFIG.supabaseKey is a SECRET key — it must never ship in the app. Use the publishable / anon key.'); return null; }
        return { url: bu, key: bk, source: 'builtin', devAuth: false };
      }
      return null;
    },
    ready() { return !!this.project(); },
    /** the built-in project is set (the Pro server lives there) */
    builtin() { const p = this.project(); return !!p && p.source !== 'own'; },
    functionsUrl() { const p = this.project(); return p ? p.url + '/functions/v1' : ''; },
    /** the dev API (localhost only) is on */
    dev() { return !!devUrl(); },
  };

  window.NK_CONFIG = Object.freeze(Object.assign({}, NK_CONFIG, {
    prices: Object.freeze(Object.assign({}, NK_CONFIG.prices)),
    publicBuild: !isLocalHost(),
    functions: clean(NK_CONFIG.supabaseUrl) ? clean(NK_CONFIG.supabaseUrl) + '/functions/v1' : '',
  }));
  window.NKConfig = NKConfig;
})();
