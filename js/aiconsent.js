/* ============ 🛡 AIConsent — one clear «may we send this text to the AI?» before the first Pro request ============
 * Apple 5.1.2(i) (docs/store/compliance.md §0 item 1): before the FIRST request to the Norsk Kort server's AI, translation
 * or voices, the person is told what leaves the device and to whom (Anthropic — the AI; Google Cloud — the voices) and
 * answers «Разрешить» / «Не сейчас». Own keys (straight from the device to the person's own service) are not asked about.
 *   AIConsent.VERSION   the text version ('2026-11.1'). Bump it when this sheet's text or the provider list changes
 *                       (e.g. the owner switches on the Mistral fallback, docs/api-contract.md `health.ai_fallback`) —
 *                       everyone is then asked again.
 *   AIConsent.granted() the current version was allowed (on this device, or on another device of the same account)
 *   AIConsent.ensure({ feature, force }) → Promise<boolean>   allowed → true at once; else the sheet. Declined → false, and
 *                       it is not asked again by itself in this visit (force = a button the person pressed: ask again)
 *   AIConsent.allow() / withdraw()   the answer, from the sheet or from settings; stored locally AND through `POST consent`
 *                       (signed in; otherwise it is sent after the next sign-in)
 *   AIConsent.fromServer(me.ai_consent)   js/pro.js hands over the server's last answer: the newer one wins
 *   AIConsent.panelHtml() / onAct(act)    the «Нейросеть Pro и ваши данные» row (account page; Settings — W7 hook)
 * Storage: localStorage 'nk-ai-consent' = { granted, version, at, sent } — per device, never synced as a setting.
 * Used by js/net.js: Net.callFn('ai' | 'translate' | 'tts') asks first (NetError code 'consent' when declined).
 */
(function () {
  'use strict';
  const VERSION = '2026-11.1';
  const LS = 'nk-ai-consent';
  const IC = (n, s) => (window.NavIcons && NavIcons.icon ? NavIcons.icon(n, s) : '');
  const PI = (n, s) => (window.Paywall && Paywall.icon ? Paywall.icon(n, s) : IC(n, s));
  const esc = s => (window.U && U.esc ? U.esc(s) : String(s == null ? '' : s));
  const signedIn = () => !!(window.Account && Account.user);
  const canSend = () => !!(window.NKConfig && NKConfig.ready() && signedIn() && window.Net);

  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { s = null; }
    return s && typeof s === 'object' ? s : null;
  }
  function save(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) { /* private mode: this visit only */ } mem = s; }
  let mem = load();
  let declinedNow = false, sheet = null, sending = null;

  /** the local answer → the server (once; again after a failure) */
  function send() {
    const s = mem;
    if (!s || s.sent || !canSend()) return Promise.resolve(false);
    if (sending) return sending;
    sending = Net.callFn('consent', { kind: 'ai', version: s.version, granted: !!s.granted }, { retries: 1, timeout: 15000, noConsent: true })
      .then(r => {
        if (mem !== s) return false; // answered again meanwhile
        const at = r && r.ai_consent && r.ai_consent.at;
        save(Object.assign({}, s, { sent: true }, at ? { at: Date.parse(at) || s.at } : {}));
        return true;
      })
      .catch(e => { console.warn('[AIConsent] not sent yet:', e && (e.code || e.message)); return false; })
      .finally(() => { sending = null; });
    return sending;
  }
  function answer(granted) {
    save({ granted: !!granted, version: VERSION, at: Date.now(), sent: false });
    if (granted) declinedNow = false;
    send();
    try { window.dispatchEvent(new CustomEvent('nk-ai-consent', { detail: { granted: !!granted } })); } catch (e) { /* old browser */ }
  }

  function openSheet(o = {}) {
    if (sheet) return sheet.promise;
    let resolve; const promise = new Promise(r => { resolve = r; });
    let result = false;
    const what = o.feature && o.feature !== 'Norsk Kort Pro' ? `«${esc(o.feature)}» и другие функции Pro отправляют` : 'Функции Pro отправляют';
    const m = UI.modal({
      title: `<span class="ui-t">${PI('shield', 22)}<span>Нейросеть и ваши данные</span></span>`,
      cls: 'narrow aic-modal',
      body: `<p class="aic-lead">${what} текст задания на сервер Norsk Kort, а оттуда — поставщикам:</p>
        <ul class="aic-list">
          <li><span class="aic-i" aria-hidden="true">${PI('cardcheck', 22)}</span><span><b>Anthropic</b> — нейросеть Claude: проверка карточек, объяснения, перевод</span></li>
          <li><span class="aic-i" aria-hidden="true">${PI('voice', 22)}</span><span><b>Google</b> (Google Cloud) — чтение вслух естественными голосами</span></li>
        </ul>
        <p class="aic-p">Уходит только текст задания — слово, предложение, строки субтитров — и язык. Имя и почта не передаются. Поставщики не обучают на этих текстах свои модели.</p>
        <p class="aic-p muted">Без разрешения всё остальное работает как обычно, а нейросеть можно подключить своим ключом — тогда текст идёт прямо с устройства в ваш сервис. Отозвать разрешение можно в любой момент в «Мой кабинет».${(window.NK_CONFIG && NK_CONFIG.privacyUrl) ? ` <a href="${esc(NK_CONFIG.privacyUrl)}" target="_blank" rel="noopener">Конфиденциальность</a>` : ''}</p>`,
      foot: '<button type="button" class="btn ghost" data-aic-no>Не сейчас</button><button type="button" class="btn primary" data-aic-yes>Разрешить</button>',
      onClose: () => { sheet = null; if (!result) declinedNow = true; resolve(result); },
    });
    m.$('[data-aic-yes]').onclick = () => { result = true; answer(true); m.close(); };
    m.$('[data-aic-no]').onclick = () => m.close();
    setTimeout(() => { const b = m.$('[data-aic-yes]'); if (b) b.focus({ preventScroll: true }); }, 60);
    sheet = { promise, m };
    return promise;
  }

  const AIConsent = {
    VERSION,
    state() { return mem ? Object.assign({}, mem) : null; },
    granted() { return !!(mem && mem.granted && mem.version === VERSION); },
    /** the person said «Не сейчас» / withdrew (for the current text) */
    refused() { return !!(mem && !mem.granted && mem.version === VERSION) || declinedNow; },
    ensure(o = {}) {
      if (this.granted()) return Promise.resolve(true);
      if (!o.force && declinedNow) return Promise.resolve(false);
      if (!window.UI || !UI.modal) return Promise.resolve(false);
      return openSheet(o);
    },
    allow() { answer(true); },
    withdraw() { answer(false); declinedNow = true; },
    /** `me` → ai_consent { granted, version, at } | null: the newer answer wins; ours goes up when it is newer */
    fromServer(c) {
      const at = c && Date.parse(c.at || '');
      if (c && Number.isFinite(at) && (!mem || at > (+mem.at || 0) + 1000)) {
        save({ granted: !!c.granted, version: String(c.version || ''), at, sent: true });
        return;
      }
      if (mem && !mem.sent) send();
      else if (mem && !c) { mem.sent = false; send(); } // the server has nothing (a new project / account): tell it
    },
    sync: send,

    /* ---------- «Мой кабинет» (and Settings — W7) ---------- */
    panelHtml() {
      if (!(window.Pro && Pro.offered())) return '';
      const on = this.granted();
      const when = on && mem && mem.at ? (() => { try { return new Date(mem.at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } })() : '';
      return `<div class="aic-row">
          <span class="aic-row-t">${PI('shield', 20)}<span><b>Нейросеть Pro и ваши данные</b><small class="muted">${on ? `Разрешено${when ? ` ${esc(when)}` : ''}: текст задания уходит в Anthropic (нейросеть) и Google (голоса).` : 'Не разрешено: нейросеть и голоса Pro спросят разрешения перед первым запросом.'}</small></span></span>
          <button type="button" class="btn sm ghost" data-act="${on ? 'aic-withdraw' : 'aic-allow'}">${on ? 'Отозвать разрешение' : 'Разрешить'}</button>
        </div>`;
    },
    async onAct(act) {
      if (act === 'aic-withdraw') {
        this.withdraw();
        UI.toast('Разрешение отозвано — нейросеть и голоса Pro больше ничего не отправляют', '', 4500);
      } else if (act === 'aic-allow') {
        const ok = await this.ensure({ force: true });
        if (ok) UI.toast('Разрешено', 'good', 2500);
      } else return false;
      if (window.App && App.view && App.view.name === 'account') { try { App.render(); } catch (e) { /* ignore */ } }
      return true;
    },
  };

  /* signed in later (or the network came back): the local answer goes up */
  window.addEventListener('online', () => { send(); });

  window.AIConsent = AIConsent;
})();
