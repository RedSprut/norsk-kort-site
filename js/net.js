/* ============ 🌐 Net — the ONE way to the Norsk Kort server (Supabase Edge Functions) ============
 * Contract: docs/api-contract.md. Config: js/config.js (NKConfig). Session: js/account.js (Account.accessToken()).
 *
 *   Net.callFn(name, body?, opts?) → the JSON answer, or throws a NetError (never technical text):
 *       err.message  one calm Russian sentence for the person (from the server's message_key, or our own words)
 *       err.code     'unauthenticated' | 'no_entitlement' | 'cap_reached' | 'rate_limited' | 'device_limit' |
 *                    'provider_unavailable' | 'bad_input' | 'internal'  (server)  ·  'offline' | 'timeout' | 'network' |
 *                    'not_configured' | 'signed_out'  (ours)
 *       err.key      the server's message_key (err.capReached …) or ours (net.offline …)
 *       err.status, err.retryAfter (s), err.details, err.resetsAt (ISO, cap_reached), err.nk = true
 *     opts: { method: 'GET'|'POST' (GET for me/health/tg-public/yt-feed), auth: true|false|'optional' (default: true, public
 *       functions false), query: {…} (GET), timeout: ms (default 20 s; ai/translate 90 s), retries: n (transient errors),
 *       signal, raw: true (→ the Response, for fetch-public bodies) }
 *     Every call carries: apikey, authorization (the session), x-nk-client (web|ios|android|mac), x-nk-version (build),
 *     x-nk-device (a stable id registered once per account through device-register; re-registered on err.deviceRegister).
 *     Retries with back-off only for transient trouble (no answer, 502/504, a short rate limit) — a paid call that reached
 *     the server is never sent twice. 401 → the session is refreshed once and the call repeated.
 *     Net.server(name, body, opts) = the same (the name used in docs/release-architecture.md §3.1).
 *     Paid functions (ai, translate, tts) first ask the one-time AI consent (js/aiconsent.js); declined → err.code 'consent'.
 *     tg-public outside the curated list → err.code 'not_curated', err.link = 'https://t.me/<channel>' → Net.linkOut(err).
 *   Net.text(keyOrErr, details?) → the friendly sentence for a message_key / NetError
 *   Net.get(url, { kind, as, signal, id, range, headers }) — another site's page/file without the bridge (see below)
 *   Net.native(url, init) → a Response through Capacitor's native HTTP (store apps only; null elsewhere) — no CORS there.
 *     Called with no arguments it answers whether this is a store app (old form; prefer Net.isNative()).
 *   Net.where() → 'mac' | 'ios' | 'android' | 'web'   ·   Net.isNative() → the store apps (Capacitor)   ·   Net.onMac() → the app
 *     runs on this computer (file / localhost, not the store apps)   ·   Net.isMacBridge() → onMac() AND the Mac bridge
 *     (bridge/server.py) answered — the ONLY case in which /api/* bridge paths may be used   ·   Net.online() · Net.deviceId()
 *   Net.reportAiAnswer({ answer, question, provider, task }) → «Пожаловаться на ответ»: a small sheet (what is wrong + an
 *     optional comment) → POST feedback {kind:'content'} (Google Play AI-content rule). The button itself: W7. Also
 *     window.reportAiAnswer.
 * Hooks for other workstreams: docs/release-architecture.md «W2 hooks».
 */
(function () {
  'use strict';
  const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/;
  const PUBLIC_FNS = new Set(['health', 'tg-public', 'fetch-public', 'yt-feed', 'feedback']);
  const GET_FNS = new Set(['me', 'health', 'tg-public', 'yt-feed']);
  const SLOW_FNS = new Set(['ai', 'translate', 'tts']);
  const CONSENT_FNS = new Set(['ai', 'translate', 'tts']); // text goes on to Anthropic / Google: js/aiconsent.js asks first
  const DEVICE_KEY = 'nk-srv-device';

  /* ---------- where are we ---------- */
  const native = () => { try { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); } catch (e) { return false; } };
  const nativePlatform = () => { try { return String(Capacitor.getPlatform ? Capacitor.getPlatform() : '').toLowerCase(); } catch (e) { return ''; } };
  /** the app runs on the Mac itself (a file or localhost) — never in the store apps (their localhost is not the Mac) */
  const onMac = () => !native() && (location.protocol === 'file:' || LOCAL.test(location.hostname));
  function where() {
    if (native()) { const p = nativePlatform(); return p === 'ios' ? 'ios' : p === 'android' ? 'android' : 'web'; }
    return onMac() ? 'mac' : 'web';
  }
  const online = () => { try { return navigator.onLine !== false; } catch (e) { return true; } };

  /* ---------- friendly words for every server message_key (ru; uk / nb come with the UI-language workstream) ---------- */
  const fmtDate = iso => { const t = Date.parse(iso); if (!Number.isFinite(t)) return ''; try { return new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); } catch (e) { return ''; } };
  const TEXT = {
    'err.signIn': 'Вход устарел — войдите снова, и всё продолжит работать',
    'err.noEntitlement': 'Это входит в Norsk Kort Pro',
    'err.capReached': d => {
      const when = fmtDate(d && d.resets_at);
      const what = d && d.cap === 'tts' ? 'голосов Pro' : d && d.cap === 'tts_premium' ? 'премиум-голосов Pro' : 'нейросети Pro';
      return `Месячный запас ${what} закончился${when ? ` — он обновится ${when}` : ' — он обновится в начале месяца'}. Пока можно пользоваться своими ключами и голосами устройства`;
    },
    'err.capReachedToday': 'Дневной запас перевода закончился — завтра можно снова. Пока переводят другие переводчики',
    'err.tooMany': 'Слишком много запросов подряд — подождите немного',
    'err.deviceLimit': 'Pro уже работает на пяти устройствах. Место освобождается, когда устройством не пользуются 30 дней',
    'err.deviceRegister': 'Не удалось узнать это устройство — попробуйте ещё раз',
    'err.providerUnavailable': 'Сервер нейросети сейчас недоступен — попробуйте чуть позже',
    'err.aiDeclined': 'Нейросеть не стала отвечать на этот запрос — попробуйте сформулировать иначе',
    'err.badInput': 'Запрос не получился — попробуйте ещё раз',
    'err.badLanguage': 'Этот язык здесь пока не поддерживается',
    'err.badVoice': 'Этот голос недоступен — выберите другой',
    'err.tooLarge': 'Слишком длинный текст — разделите его на части',
    'err.updateRequired': 'Эта версия приложения устарела — обновите его, и всё заработает',
    'err.notAllowed': 'Этот источник в приложении недоступен — откройте его на сайте',
    'err.tgChannel': 'Такого канала Telegram нет — проверьте название',
    'err.tgNotPublic': 'У этого канала нет открытого просмотра',
    'err.ytChannel': 'Канал YouTube не найден — проверьте ссылку',
    'err.tgNotCurated': 'Этот канал открывается в Telegram',
    'err.generic': 'Что-то пошло не так — попробуйте позже',
    'net.offline': 'Нет интернета — попробуйте, когда связь появится',
    'net.timeout': 'Сервер Norsk Kort долго не отвечает — попробуйте ещё раз',
    'net.network': 'Нет связи с сервером Norsk Kort — попробуйте чуть позже',
    'net.notConfigured': 'Сервер Norsk Kort ещё не подключён',
    'net.signedOut': 'Сначала войдите в аккаунт',
    'net.consent': 'Без вашего разрешения нейросеть Pro ничего не отправляет — разрешить можно в «Мой кабинет»',
  };
  const CODE_KEY = { unauthenticated: 'err.signIn', no_entitlement: 'err.noEntitlement', cap_reached: 'err.capReached', rate_limited: 'err.tooMany',
    device_limit: 'err.deviceLimit', provider_unavailable: 'err.providerUnavailable', bad_input: 'err.badInput', not_curated: 'err.tgNotCurated', internal: 'err.generic' };
  function text(k, details) {
    if (k && typeof k === 'object' && k.nk) return k.message;
    const t = TEXT[k] || TEXT['err.generic'];
    return typeof t === 'function' ? t(details || {}) : t;
  }
  class NetError extends Error {
    constructor(code, key, o = {}) {
      super(text(key, o.details));
      this.name = 'NetError'; this.nk = true; this.code = code; this.key = key;
      this.status = o.status || 0; this.retryAfter = o.retryAfter; this.details = o.details || null; this.fn = o.fn || '';
      if (code === 'cap_reached' && o.details && o.details.resets_at) this.resetsAt = o.details.resets_at;
      // not_curated: only a plain t.me channel link is kept (opened outside the app, never shown inside)
      if (o.details && /^https:\/\/t\.me\/[A-Za-z][A-Za-z0-9_]{3,31}$/.test(String(o.details.link || ''))) this.link = String(o.details.link);
    }
  }

  /* ---------- 📱 this device (x-nk-device) ---------- */
  const uuid = () => {
    try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* older browser */ }
    const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  /** { id, reg: { <project|user>: true } } — local, never synced (not a setting) */
  function devState() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(DEVICE_KEY) || 'null'); } catch (e) { s = null; }
    if (!s || !UUID.test(s.id || '')) s = { id: uuid(), reg: {} };
    if (!s.reg || typeof s.reg !== 'object') s.reg = {};
    return s;
  }
  function saveDev(s) { try { localStorage.setItem(DEVICE_KEY, JSON.stringify(s)); } catch (e) { /* private mode: this visit only */ } }
  let devMem = null;
  const dev = () => devMem || (devMem = (() => { const s = devState(); saveDev(s); return s; })());
  const regKey = uid => { const p = window.NKConfig && NKConfig.project(); return `${p ? p.url : ''}|${uid}`; };
  let regBusy = null;
  /** device-register once per account (and again when the server asks) → true when this device is known to the server */
  async function ensureDevice(uid, force) {
    const s = dev();
    if (!force && s.reg[regKey(uid)]) return true;
    if (regBusy) return regBusy;
    regBusy = (async () => {
      try {
        const r = await call('device-register', { platform: where(), device_id: s.id, attest_kind: 'none' }, { noDevice: true, retries: 1 });
        if (r && UUID.test(r.device_id || '')) { s.id = String(r.device_id).toLowerCase(); s.reg[regKey(uid)] = true; saveDev(s); return true; }
        return false;
      } catch (e) {
        if (e && e.code === 'device_limit') throw e;
        return false; // the call still goes, without the header (the server does not require it unless the owner says so)
      } finally { regBusy = null; }
    })();
    return regBusy;
  }

  /* ---------- the call ---------- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const backoff = n => Math.min(8000, 600 * 2 ** n) + Math.floor(Math.random() * 250);
  const build = () => { try { return String((window.APP && APP.build) || ''); } catch (e) { return ''; } };
  async function token(force) {
    const A = window.Account;
    if (!A || !A.accessToken) return '';
    try { return (await A.accessToken(force)) || ''; } catch (e) { return ''; }
  }
  const userId = () => (window.Account && Account.user ? Account.user.id : '');

  /** one request, with the retries for transient trouble; opts as described at the top */
  async function call(name, body, opts = {}) {
    const P = window.NKConfig && NKConfig.project();
    if (!P) throw new NetError('not_configured', 'net.notConfigured', { fn: name });
    if (!online()) throw new NetError('offline', 'net.offline', { fn: name });
    const method = opts.method || (GET_FNS.has(name) ? 'GET' : 'POST');
    const authMode = opts.auth != null ? opts.auth : (PUBLIC_FNS.has(name) ? 'optional' : true);
    let tok = authMode ? await token(false) : '';
    if (authMode === true && !tok) throw new NetError('signed_out', 'net.signedOut', { fn: name, status: 401 });
    if (CONSENT_FNS.has(name) && !opts.noConsent && window.AIConsent && !AIConsent.granted()) {
      if (!(await AIConsent.ensure({ feature: opts.feature }))) throw new NetError('consent', 'net.consent', { fn: name });
    }
    const uid = userId();
    let useDevice = !!(tok && uid && !opts.noDevice && authMode);
    if (useDevice) { try { useDevice = await ensureDevice(uid); } catch (e) { if (e && e.nk) throw e; useDevice = false; } }
    const timeout = opts.timeout || (SLOW_FNS.has(name) ? 90000 : 20000);
    const maxRetries = opts.retries != null ? opts.retries : (method === 'GET' ? 2 : 1);
    let url = `${P.url}/functions/v1/${name}`;
    if (opts.query) { const q = new URLSearchParams(); Object.keys(opts.query).forEach(k => { if (opts.query[k] != null && opts.query[k] !== '') q.set(k, String(opts.query[k])); }); const s = q.toString(); if (s) url += '?' + s; }
    let refreshed = false, reRegistered = false, rateWaited = false;
    for (let attempt = 0; ; attempt++) {
      const headers = { apikey: P.key, 'x-nk-client': where(), 'x-nk-version': build() || '0' };
      if (tok) headers.authorization = 'Bearer ' + tok;
      if (method !== 'GET') headers['content-type'] = 'application/json';
      if (useDevice) headers['x-nk-device'] = dev().id;
      const ctl = new AbortController();
      const onAbort = () => ctl.abort();
      if (opts.signal) { if (opts.signal.aborted) ctl.abort(); else opts.signal.addEventListener('abort', onAbort, { once: true }); }
      let timedOut = false;
      const tm = setTimeout(() => { timedOut = true; ctl.abort(); }, timeout);
      let res;
      try {
        res = await fetch(url, { method, headers, body: method === 'GET' ? undefined : JSON.stringify(body == null ? {} : body), signal: ctl.signal, cache: 'no-store', credentials: 'omit' });
      } catch (e) {
        clearTimeout(tm);
        if (opts.signal && opts.signal.aborted) throw Object.assign(new NetError('aborted', 'net.network', { fn: name }), { aborted: true });
        // no answer at all: nothing reached the server (or we will never know) — a GET may be asked again; a POST only
        // when the connection itself failed, never after a timeout (the server may be working on it — a paid call)
        if (!online()) throw new NetError('offline', 'net.offline', { fn: name });
        if (attempt < maxRetries && (method === 'GET' || !timedOut)) { await sleep(backoff(attempt)); continue; }
        throw new NetError(timedOut ? 'timeout' : 'network', timedOut ? 'net.timeout' : 'net.network', { fn: name });
      } finally { clearTimeout(tm); if (opts.signal) opts.signal.removeEventListener('abort', onAbort); }
      if (res.ok) {
        if (opts.raw) return res;
        const j = await res.json().catch(() => null);
        if (j == null) throw new NetError('internal', 'err.generic', { fn: name, status: res.status });
        return j;
      }
      const j = await res.json().catch(() => null);
      const e = j && j.error && typeof j.error === 'object' ? j.error : null;
      if (!e) {
        // a gateway in between (502/504, Supabase waking up), not our function: transient
        if ([502, 503, 504].includes(res.status) && attempt < maxRetries) { await sleep(backoff(attempt)); continue; }
        if (res.status === 404) throw new NetError('not_configured', 'net.notConfigured', { fn: name, status: 404 });
        throw new NetError(res.status >= 500 ? 'internal' : 'bad_input', res.status >= 500 ? 'net.network' : 'err.generic', { fn: name, status: res.status });
      }
      const code = String(e.code || 'internal'), key = String(e.message_key || CODE_KEY[code] || 'err.generic');
      const retryAfter = Number.isFinite(+e.retry_after) ? +e.retry_after : (Number.isFinite(+res.headers.get('retry-after')) ? +res.headers.get('retry-after') : undefined);
      // 401: the access token expired a moment ago → a fresh one, once
      if (code === 'unauthenticated' && tok && !refreshed) { refreshed = true; const t2 = await token(true); if (t2 && t2 !== tok) { tok = t2; continue; } }
      // the server does not know this device (old / revoked / required): register again, once
      if (key === 'err.deviceRegister' && uid && !reRegistered) { reRegistered = true; try { useDevice = await ensureDevice(uid, true); } catch (x) { if (x && x.nk) throw x; useDevice = false; } continue; }
      // a short rate limit: wait it out once (never a loop)
      if (code === 'rate_limited' && !rateWaited && retryAfter != null && retryAfter <= 5) { rateWaited = true; await sleep(retryAfter * 1000 + 200); continue; }
      throw new NetError(code, key, { fn: name, status: res.status, retryAfter, details: e.details });
    }
  }

  /* ---------- 🌍 another site's page / file (replaces the bridge's /api/proxy off the Mac) ----------
   * Net.get(url, { kind, as: 'text'|'json'|'blob', signal, id }) tries in order: a direct fetch (CORS) → native HTTP in the
   * store apps (Net.native) → the Mac bridge's /api/proxy (only Net.isMacBridge()) → the server's fetch-public for the
   * allow-listed kinds (rss | pd-book | gdoc-txt | tatoeba — docs/api-contract.md) → a NetError with a calm «откройте на
   * сайте» (err.notAllowed) — never an open proxy, never a technical message. */
  const SERVER_KINDS = new Set(['rss', 'pd-book', 'gdoc-txt', 'tatoeba']);
  const readAs = (r, as) => (as === 'json' ? r.json() : as === 'blob' ? r.blob() : r.text());
  /** Capacitor native HTTP, called explicitly (global fetch patching stays OFF — it breaks Range / streams here).
   *  init: { method, headers, body (string), as: 'text'|'blob' (how to fetch the body; default text), signal }
   *  → a real Response (status, headers, .text() / .json() / .blob()), or null outside the store apps */
  async function nativeFetch(url, init = {}) {
    const H = native() && window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.CapacitorHttp;
    if (!H) return null;
    if (init.signal && init.signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    const bin = init.as === 'blob';
    let data = init.body;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { /* plain text body */ } }
    const r = await H.request({ url, method: init.method || 'GET', headers: init.headers || {}, data, responseType: bin ? 'blob' : 'text' });
    if (!r) return null;
    const hd = r.headers || {};
    const type = hd['Content-Type'] || hd['content-type'] || (bin ? 'application/octet-stream' : 'text/plain');
    let body;
    if (bin) { const b = atob(String(r.data || '')); const u8 = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i); body = new Blob([u8], { type }); }
    else body = typeof r.data === 'string' ? r.data : JSON.stringify(r.data == null ? '' : r.data);
    const status = r.status >= 200 && r.status <= 599 ? r.status : 200;
    return new Response([101, 204, 205, 304].includes(status) ? null : body, { status, headers: Object.assign({ 'content-type': type }, hd) });
  }
  /** Net.native(url, init) → Response | null; Net.native() → whether this is a store app (the older form) */
  function nativeEntry(url, init) { return url == null ? native() : nativeFetch(url, init); }
  async function get(url, o = {}) {
    const as = o.as || 'text';
    if (!online()) throw new NetError('offline', 'net.offline', { fn: 'get' });
    const headers = Object.assign({}, o.headers || {}, o.range ? { range: o.range } : {});
    const okRes = r => r && (r.ok || r.status === 206);
    try { const r = await fetch(url, { signal: o.signal, cache: o.cache || 'default', credentials: 'omit', headers }); if (okRes(r)) return await readAs(r, as); } catch (e) { if (o.signal && o.signal.aborted) throw e; }
    try { const r = await nativeFetch(url, { headers, as: as === 'blob' ? 'blob' : 'text', signal: o.signal }); if (okRes(r)) return await readAs(r, as); } catch (e) { if (o.signal && o.signal.aborted) throw e; }
    if (Net.isMacBridge()) {
      try { const r = await fetch('/api/proxy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, method: 'GET', headers }), signal: o.signal }); if (okRes(r)) return await readAs(r, as); } catch (e) { if (o.signal && o.signal.aborted) throw e; }
    }
    if (o.kind && SERVER_KINDS.has(o.kind) && window.NKConfig && NKConfig.ready()) {
      const r = await call('fetch-public', o.id ? { kind: o.kind, id: o.id } : { kind: o.kind, url }, { raw: true, auth: 'optional', signal: o.signal, timeout: o.kind === 'pd-book' ? 90000 : 20000 });
      return readAs(r, as);
    }
    throw new NetError('bad_input', 'err.notAllowed', { fn: 'get' });
  }

  /* ---------- ⚑ «Пожаловаться на ответ» (Google Play: AI-generated content must be reportable in the app) ---------- */
  const REASONS = [['wrong', 'Ошибка в ответе'], ['harmful', 'Оскорбительный или опасный'], ['other', 'Другое']];
  /** o: { answer, question, provider, task } → Promise<boolean> (true = sent). The sheet says what is sent. */
  function reportAiAnswer(o = {}) {
    if (!window.UI || !UI.modal) return Promise.resolve(false);
    if (!(window.NKConfig && NKConfig.ready())) { UI.toast('Жалобы заработают, когда подключат сервер Norsk Kort', '', 4500); return Promise.resolve(false); }
    const esc = s => (window.U && U.esc ? U.esc(s) : String(s == null ? '' : s));
    return new Promise(resolve => {
      let sent = false;
      const m = UI.modal({
        title: 'Пожаловаться на ответ', cls: 'narrow nk-report',
        body: `<p class="muted">Ответы создаёт нейросеть, и она может ошибаться. Мы прочитаем жалобу и поправим то, что можем.</p>
          <div class="nk-rep-reasons" role="radiogroup" aria-label="Что не так">${REASONS.map(([v, t], i) => `<label class="nk-rep-r"><input type="radio" name="nk-rep" value="${v}" ${i === 0 ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
          <label class="nk-rep-c"><span>Комментарий (по желанию)</span><textarea rows="3" maxlength="600" data-rep-c placeholder="Что именно не так"></textarea></label>
          <p class="tiny muted">Вместе с жалобой уйдёт текст ответа${o.question ? ' и вопроса' : ''} — больше ничего.</p>`,
        foot: '<button type="button" class="btn ghost" data-rep-no>Отмена</button><button type="button" class="btn primary" data-rep-go>Отправить</button>',
        onClose: () => resolve(sent),
      });
      m.$('[data-rep-no]').onclick = () => m.close();
      m.$('[data-rep-go]').onclick = async () => {
        const go = m.$('[data-rep-go]'); go.disabled = true;
        const why = (m.$('input[name="nk-rep"]:checked') || {}).value || 'other';
        const c = String(m.$('[data-rep-c]').value || '').trim();
        const cut = (s, n) => { s = String(s || '').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };
        const msg = [`[ai-answer] ${why}`, o.provider ? `AI: ${cut(o.provider, 40)}` : '', o.task ? `Task: ${cut(o.task, 40)}` : '',
          c ? `Comment: ${cut(c, 600)}` : '', o.question ? `Q: ${cut(o.question, 300)}` : '', `A: ${cut(o.answer, 900)}`].filter(Boolean).join('\n').slice(0, 2000);
        let lang = 'ru';
        try { lang = ['ru', 'uk', 'nb', 'en'].includes(Store.settings.uiLang) ? Store.settings.uiLang : ((Store.settings.transLang || Store.settings.trLang) === 'uk' ? 'uk' : 'ru'); } catch (e) { /* default */ }
        try {
          await call('feedback', { kind: 'content', message: msg, lang }, { auth: 'optional', retries: 1, timeout: 15000 });
          sent = true; m.close(); UI.toast('Спасибо — жалоба отправлена', 'good', 3500);
        } catch (e) {
          if (go.isConnected) go.disabled = false;
          UI.toast(e && e.nk ? e.message : 'Не получилось отправить — попробуйте позже', 'warn', 5000);
        }
      };
      setTimeout(() => { const b = m.$('[data-rep-go]'); if (b) b.focus({ preventScroll: true }); }, 60);
    });
  }
  /** not_curated (tg-public): open the channel in Telegram / the browser, outside the app → true when there was a link */
  function linkOut(err) {
    const u = err && err.link;
    if (!u) return false;
    try { window.open(u, '_blank', 'noopener'); } catch (e) { location.href = u; }
    return true;
  }

  const Net = {
    NetError,
    callFn: call,
    server: call,
    get,
    native: nativeEntry,
    nativeRequest: nativeFetch,
    reportAiAnswer,
    linkOut,
    text,
    TEXT,
    where,
    onMac,
    isNative: native,
    online,
    /** the Mac bridge (bridge/server.py on 127.0.0.1:8787) answered and the app runs on that Mac — the only case for /api/* */
    isMacBridge() { return onMac() && !!(window.AI && AI.bridge && AI.bridge.up); },
    deviceId() { return dev().id; },
    /** the session's user may call user functions (signed in + a project) */
    canCall() { return !!(window.NKConfig && NKConfig.ready() && userId()); },
    _t: { ensureDevice, devState, regKey },
  };
  window.Net = Net;
  window.reportAiAnswer = reportAiAnswer;
})();
