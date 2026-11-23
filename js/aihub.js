/* ============ 🤖 Центр нейросети (js/aihub.js + css/aihub.css → window.AIHub) ============
 * After connecting a neural network people did not know what to do next. This file is the answer:
 *  - AIHub.open()            «🤖 Центр нейросети»: what the AI does here, in plain words, each with a big button
 *                            (check all decks / one deck / how to check one card / exact translation / explanations /
 *                            auto-check of new cards), which AI works now, checked / not checked, honest limits.
 *                            Opens by itself ONCE right after the first AI is connected (AIHub.onBadge / onConnected).
 *  - AIHub.checkDecks(ids)   a resumable queue: deck by deck, batches of 12 through AI.checkCards; pause / continue /
 *                            stop; survives a reload (localStorage 'nk-aihub-run'); a limit / no key / no network stops
 *                            it gently and keeps everything; a floating pill shows it while the person keeps learning.
 *                            Fixes: «Применять сразу» (default, Store.settings.aiFixMode) or «Сначала спрашивать»
 *                            (every change keeps the old value → «↩ Откатить»; provenance via AI.stamp). What is checked:
 *                            «только слово и перевод» or «всю карточку» (Store.settings.aiCheckDepth) — the teacher's check
 *                            in js/ai.js (verdict, all forms of the word, …). The same check for one card: AIHub.checkOne
 *                            (the study card's AI tile, «↶ Вернуть» puts the whole card back) and Views.runAiCheck (wrapped).
 *  - AIHub.report(id)        «📊 Отчёт нейросети»: big numbers first, details per deck → per card (the AI's words,
 *                            old struck / new green), accept / reject / undo, filters by field and a search.
 *                            The last few reports stay ('nk-aihub-reports') — «📜 Прошлые отчёты» in the hub.
 *  - two ways to watch: «⚡ Быстро, в фоне» (the pill) or «👀 Смотреть, как работает» — the live view on the deck page:
 *    the card being read glows in the AI's colours, a reading line goes over it, it flips, fixes are typed in, ✓ marks appear.
 *  - ✓ marks on the cards (card.aiCheck, both sides; tap → what was checked / fixed), living logos of every AI and translator
 *    (also for the subtitle translation in js/subs.js and the top robot).
 *  - a help topic «🤖 Нейросеть: как с ней работать» (pushed into Help.TOPICS, animated demo scenes for js/helpanim.js)
 *    and coach-mark places for the hub, the deck's «🤖 Проверить всё» and the report (pushed into CoachMarks.PLACES).
 * Nothing technical is ever shown: errors become one of a few friendly messages (WHY below).
 */
(function () {
  'use strict';
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  const LS_HUB = 'nk-aihub', LS_RUN = 'nk-aihub-run', LS_REP = 'nk-aihub-reports';
  const BATCH = 12, MAX_REPORTS = 6, GAP = 700;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  /** «Отчёт» buttons: the drawn bars of «Статистика» in the top bar (js/app.js NavIcons) instead of the 📊 emoji */
  const repIco = () => `<i class="nav-ico rep-ico" aria-hidden="true">${window.NavIcons ? NavIcons.html('stats') : '📊'}</i>`;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const now = () => Date.now();
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { /* private mode */ } };
  const hub = () => lsGet(LS_HUB, {}) || {};
  const hubPatch = p => lsSet(LS_HUB, Object.assign(hub(), p));
  const cardsN = n => (window.U && U.cards ? U.cards(n) : n + ' карт');
  const plural = (n, f) => (window.U && U.plural ? U.plural(n, f) : f[2]);
  const pct = (a, b) => (b ? Math.min(100, Math.round(a / b * 100)) : 0);
  const first = s => String(s || '').split('\n')[0].trim();

  /* ---------- card fields, in the order people read them ---------- */
  const ORDER = ['no', 'ru', 'uk', 'wordClass', 'forms', 'description', 'example', 'exampleRu', 'examples', 'synonyms', 'en', 'imagePrompt'];
  const FNAME = { no: '🇳🇴 Норвежский', ru: '🇷🇺 Перевод', uk: '🇺🇦 Перевод на украинский', description: '📝 Объяснение', example: '💬 Пример', exampleRu: '💬 Перевод примера',
    wordClass: '🏷 Часть речи', forms: '📚 Формы слова', examples: '💬 Примеры по формам', synonyms: '🔁 Синонимы', en: '🇬🇧 English (для картинки)', imagePrompt: '🎨 Подсказка для картинки' };
  /** list fields (the forms, examples, synonyms): stored as arrays, shown as text in the report */
  const ARR = f => f === 'forms' || f === 'examples' || f === 'synonyms';
  // lists compared by their content: the card store keeps a form's keys in its own order (label, tag, note, no, ru),
  // so «↩ Откатить» must not take the same forms for «changed by hand»
  const canon = a => JSON.stringify((a || []).map(x => (x && typeof x === 'object' ? Object.keys(x).sort().filter(k => x[k] != null && x[k] !== '').map(k => [k, String(x[k])]) : x)));
  const same = (a, b) => canon(a) === canon(b);
  /** a change that only ADDS to a right card (all forms, examples per tense, the part of speech, a first example, a second variant) — not a fix */
  const ADDS = (f, x) => !!x && (x.kind === 'add' || x.kind === 'alt' || (!x.old && ['forms', 'examples', 'wordClass', 'example', 'exampleRu'].includes(f)));
  /* ---------- the owner's choices (Store.settings): fixes at once with «↶ Вернуть» or ask first; the word or the whole card ---------- */
  const fixMode = () => (window.Store && Store.settings && Store.settings.aiFixMode === 'ask' ? 'ask' : 'auto');
  const depthOf = () => (window.Store && Store.settings && Store.settings.aiCheckDepth === 'word' ? 'word' : 'card');
  /** «📚 Добавлять все формы и примеры по временам» (on unless switched off): every checked card gets all forms of the word
   *  (also a ✓ card), the whole-card check — short examples per tense too; off — only the verdict and the translation */
  const fullOf = () => !(window.Store && Store.settings && Store.settings.aiCheckFull === false);
  const setOpt = (k, v) => { if (window.Store && Store.setSetting) Store.setSetting(k, v); };
  const runFull = () => (RUN && RUN.full != null ? !!RUN.full : fullOf());
  /** cards per request: the teacher's check writes all forms (and examples) — 6, the whole card with forms and examples — 4 (js/ai.js) */
  const perReq = (depth, full) => (window.AI && AI.reviewBatch ? AI.reviewBatch(depth, full) : 6);
  // «По одной карточке» — one card per request (slower, fully live)
  const bsz = () => (RUN && RUN.one ? 1 : RUN && RUN.depth ? perReq(RUN.depth, runFull()) : BATCH);
  /* ---------- honest time: what one request really takes here (learned from the last checks), what showing a card takes ---------- */
  // first guesses, until the first answers come («+»: with all forms and examples per tense — a longer answer, sometimes a follow-up)
  const TM0 = { 'b|card': 45000, 'b|word': 30000, 'o|card': 15000, 'o|word': 11000, 'b|card+': 50000, 'b|word+': 38000, 'o|card+': 21000, 'o|word+': 14000 };
  const SHOW_MS = 6500; // the live view shows one checked card (read, flip, fix, ✓) in about this long
  const tmKey = (one, depth, full) => `${one ? 'o' : 'b'}|${depth === 'word' ? 'word' : 'card'}${full ? '+' : ''}`;
  const tmGet = (one, depth, full) => { const t = (hub().tm || {})[tmKey(one, depth, full)]; return t > 2000 && t < 300000 ? t : TM0[tmKey(one, depth, full)]; };
  function tmLearn(one, depth, full, ms) {
    if (!(ms > 1500 && ms < 300000)) return;
    const tm = Object.assign({}, hub().tm || {}), k = tmKey(one, depth, full);
    tm[k] = tm[k] ? Math.round(tm[k] * 0.6 + ms * 0.4) : Math.round(ms);
    hubPatch({ tm });
  }
  /** ms for n cards: requests go one after another; in the live view the next request is already out while a card is shown */
  function estMs(n, o) {
    if (!n) return 0;
    const size = o.one ? 1 : o.depth ? perReq(o.depth, o.full) : BATCH, k = Math.ceil(n / size);
    const req = o.req || tmGet(o.one, o.depth, o.full), show = (o.show || SHOW_MS) * Math.min(size, n);
    return o.view === 'live' ? req + (k - 1) * Math.max(req, show) + show : k * (req + GAP);
  }
  function minText(ms) {
    const min = Math.round(ms / 60000);
    if (min < 1) return 'меньше минуты';
    if (min < 60) return `≈ ${min} мин`;
    return `≈ ${Math.floor(min / 60)} ч ${min % 60 ? `${min % 60} мин` : ''}`.trim();
  }
  /** helper fields: never changed automatically, unticked in the report (the old review did the same) */
  const SIDE = f => f === 'en' || f === 'imagePrompt';
  const ART = s => { const m = /^\s*(en|ei|et)\s/i.exec(String(s || '')); return m ? m[1].toLowerCase() : ''; };
  /** report filters: what the person may want to look at */
  const FILTERS = [
    ['all', 'Всё'], ['pending', '⏳ Ждут решения'], ['ru', '🇷🇺 Переводы'], ['no', '🇳🇴 Написание'], ['gender', '🌳 Род и артикль'],
    ['description', '📝 Объяснения'], ['example', '💬 Примеры'], ['wordClass', '📚 Формы и часть речи'], ['side', '🎨 Картинка'], ['issues', '⚠️ Только ошибки'],
  ];
  const FILTER_FIELDS = { ru: ['ru', 'uk'], no: ['no'], description: ['description', 'synonyms'], example: ['example', 'exampleRu', 'examples'], wordClass: ['wordClass', 'forms'], side: ['en', 'imagePrompt'] };

  /* ---------- friendly reasons instead of technical errors ---------- */
  function why(e) {
    const m = String((e && e.message) || e || '');
    // Claude on this Mac asks to log in again (js/ai.js marks it): its own calm panel with the exact commands
    if ((e && e.auth) || /войти в Claude Code|вход в Claude Code/i.test(m)) return 'auth';
    if (e && e.down) return 'down'; // Ollama on this Mac is not running / has no such model
    if (/подключите нейросеть/i.test(m)) return 'none';
    if ((window.AI && AI.isLimit && AI.isLimit(e)) || /usage|limit|лимит|quota|exhaust|rate|429|overload|перегруж|too many|слишком много|недоступ|503/i.test(m)) return 'limit';
    if (/ключ|api key|401|403|доступ|auth|вход|login|истёк|expired|не настроено|недостаточно средств|нет средств|402/i.test(m)) return 'key';
    if (/связ|интернет|network|fetch|failed|load failed|не отвечает|мост|offline|timeout|timed out/i.test(m)) return 'net';
    return 'odd';
  }
  const WHY = {
    limit: () => ({ icon: '⏳', title: 'Лимит нейросети закончился — продолжим позже', text: 'Всё, что уже проверено, сохранено. Проверка продолжится сама, когда лимит восстановится, — или подключите ещё одну бесплатную нейросеть (Gemini, Groq), тогда она пойдёт дальше сразу.' }),
    down: () => ({ icon: '🔌', title: 'Нейросеть на этом Mac не отвечает', text: 'Похоже, программа Ollama не запущена или в ней нет нужной модели. Откройте её — проверка продолжится сама. Или выберите другую нейросеть.' }),
    key: () => ({ icon: '🔑', title: 'Ключ нейросети не подошёл', text: 'Похоже, ключ устарел или его отозвали. Откройте ⚙️ Настройки → 🤖 Нейросети, вставьте новый ключ и нажмите «🔌 Проверить». Всё проверенное сохранено.' }),
    auth: () => ({ icon: '🔑', title: 'Claude просит войти ещё раз', text: 'Вход Claude Code на этом Mac устарел. Ниже — что сделать, это пара минут. Всё проверенное сохранено.' }),
    net: () => ({ icon: '📡', title: 'Нет связи с нейросетью', text: `Проверьте интернет${window.AI && AI.onMac && AI.onMac() ? ' (и запущен ли мост на Mac)' : ''} и нажмите «▶ Продолжить». Всё проверенное сохранено.` }),
    none: () => ({ icon: '🤖', title: 'Нейросеть не подключена', text: 'Подключите её в ⚙️ Настройках (Gemini и Groq — бесплатно) и нажмите «▶ Продолжить». Всё проверенное сохранено.' }),
    odd: () => ({ icon: '🤔', title: 'Нейросеть ответила непонятно', text: 'Так иногда бывает. Всё проверенное сохранено — нажмите «▶ Продолжить», попробуем ещё раз.' }),
  };

  /* ---------- small helpers about the AI ---------- */
  const aiOn = () => !!(window.AI && AI.available());
  /** who works now: the AI being asked at this moment during a check (AI.call → onTry), else the one that will answer next.
   *  Never the chosen-but-silent one: if Ollama does not answer and Gemini does the work, everything says «Gemini» */
  const aiId = () => (RUN && live && RUN.asking && window.AI && AI.PROVIDERS[RUN.asking] ? RUN.asking : window.AI ? AI.current() : null);
  const aiName = id => (window.AI ? AI.name(id) : 'ИИ');
  const logo = (id, size = 26) => {
    if (!id) return `<span class="aih-logo-e" aria-hidden="true">${bot(false)}</span>`;
    if (window.App && App.aiLogo) return App.aiLogo(id, ' aih-logo').replace('style="--c:', `style="--s:${size}px;--c:`);
    return window.AI ? AI.icon(id, size) : BOT(size);
  };
  // the brand robot; its gradients get ids of their own (a copy in a hidden top bar would leave this one without colours)
  let botN = 0;
  const bot = on => {
    if (!(window.App && App.aiBot)) return '<span class="aih-bot" aria-hidden="true"></span>';
    const n = ++botN;
    return `<span class="aih-bot" aria-hidden="true">${App.aiBot(on).replace(/id="(aib\w+)"/g, `id="$1-h${n}"`).replace(/url\(#(aib\w+)\)/g, `url(#$1-h${n})`)}</span>`;
  };
  /** honest words about the limits of the AI that works now */
  function limitsHtml() {
    const id = aiId(), P = window.AI ? AI.PROVIDERS : {};
    const p = id && P[id];
    const lines = [];
    if (id === 'claude') lines.push('<b>Claude по подписке</b> тратит тот же лимит, что и ваш Claude Code: большая проверка может съесть его на несколько часов.');
    else if (id === 'chatgpt') lines.push('<b>ChatGPT по подписке</b> тратит лимит вашей подписки ChatGPT (он считается за 5 часов и за неделю): большая проверка может его исчерпать — тогда продолжит другая подключённая нейросеть.');
    else if (id === 'gemini-cli') lines.push('<b>Gemini через аккаунт Google</b> — бесплатно, но с лимитом Google; на бесплатном плане Google может использовать запросы для улучшения своих продуктов.');
    else if (id === 'anthropic' || id === 'openai' || id === 'xai') lines.push(`<b>${esc(p.short)}</b> работает по ключу с оплатой: проверка 1000 карточек стоит немного, но не бесплатно.`);
    else if (p && p.free) lines.push(`<b>${esc(p.short)}</b> — бесплатно${p.limits ? `: ${esc(p.limits)}` : ''}. Одна порция — 12 карточек.`);
    lines.push('Нейросеть иногда ошибается — поэтому по умолчанию она <b>сначала показывает</b>, что хочет исправить. Всё, что исправлено, можно <b>↩ откатить</b>.');
    lines.push('Закончился лимит — продолжит следующая подключённая нейросеть (порядок — в «Если нейросеть не отвечает…»). Отдыхают все — проверка подождёт и продолжится сама с того же места. Ничего не теряется.');
    const tip = id === 'claude'
      ? '💡 Для больших проверок (сотни карточек) лучше подключить бесплатный <b>Gemini</b> или <b>Groq</b> — лимит Claude останется для работы.'
      : '💡 Для больших проверок удобно подключить <b>две</b> бесплатные нейросети (Gemini и Groq): кончится лимит у одной — продолжит другая.';
    return `<ul class="aih-honest">${lines.map(l => `<li>${l}</li>`).join('')}</ul><div class="aih-tip">${tip}</div>`;
  }

  /* =====================================================================
   * 🔑 «Claude просит войти ещё раз»: one calm panel (the check area, the progress window or its own window) —
   * what happened in plain words, the exact commands for THIS Mac (from the bridge's /api/status), a long token
   * that does not expire for about a year (tools/claude-token.sh), «Я вошёл — проверить снова», another AI.
   * ===================================================================== */
  const ROOT_FALLBACK = '/Users/sprut/Norsk - Russisk';
  function authCmds() {
    const b = (window.AI && AI.bridge) || {};
    const token = b.tokenCmd || `bash "${ROOT_FALLBACK}/tools/claude-token.sh"`;
    const root = (/^bash "(.*)\/tools\/claude-token\.sh"$/.exec(token) || [])[1] || ROOT_FALLBACK;
    return { login: b.loginCmd || (b.path ? `"${b.path}" auth login` : 'claude auth login'), token, restart: `python3 "${root}/bridge/server.py"`, src: b.authSource || 'login' };
  }
  /** connected AIs that can check instead of Claude right now (free ones first) */
  function otherAIs() {
    if (!window.AI) return [];
    return Object.keys(AI.PROVIDERS).filter(id => id !== 'claude' && !AI.PROVIDERS[id].noKey && AI.configured(id) && !(AI.resting && AI.resting(id)))
      .sort((a, b) => (AI.PROVIDERS[b].free ? 1 : 0) - (AI.PROVIDERS[a].free ? 1 : 0)).slice(0, 2);
  }
  const cmdBox = cmd => `<div class="aih-cmd"><code translate="no">${esc(cmd)}</code><button type="button" class="btn sm" data-copy="${esc(cmd)}">📋 Скопировать команду</button></div>`;
  function authPanelHtml() {
    const c = authCmds(), others = otherAIs(), tokenOld = c.src === 'token';
    const saved = !RUN ? 'Ничего не потерялось.' : runDone() ? `Проверено ${runDone()} из ${runTotal()} — всё сохранено, проверка продолжится с того же места.`
      : 'Проверка пойдёт с первой карточки, как только Claude снова пустит.';
    return `<div class="aih-auth" role="region" aria-label="Claude просит войти ещё раз">
      <div class="aih-auth-h">${workLogo('claude', { size: 40 })}<div><b>Claude просит войти ещё раз</b>
        <p>${tokenOld ? 'Долгий ключ Claude для моста закончился (он действует около года) — нужен новый.'
          : 'Вход Claude Code на этом Mac устарел. Так бывает: приложение Claude обновляет вход по-своему, а мост остаётся со старым. В самом приложении Claude всё работает — у него свой вход.'} ${saved}</p></div></div>
      <ol class="aih-auth-steps">
        <li class="aih-auth-step rec"><b>${tokenOld ? 'Получите новый ключ — один раз, примерно на год' : 'Лучше всего — один раз, примерно на год'}</b>
          <span>Откройте <b>Терминал</b>, вставьте команду и нажмите Enter. Откроется браузер: войдите в свой аккаунт Claude и нажмите «Authorize». Ключ сохранится только на этом Mac — и вход больше не будет «истекать».</span>
          ${cmdBox(c.token)}</li>
        ${tokenOld ? '' : `<li class="aih-auth-step"><b>Или просто войти снова — минута</b>
          <span>Та же программа, что работает в мосте. Откроется браузер — войдите. Такой вход может снова устареть через несколько часов.</span>
          ${cmdBox(c.login)}</li>`}
      </ol>
      <div class="aih-auth-act">
        <button type="button" class="btn primary" data-auth="recheck">✅ Я вошёл — проверить снова</button>
        ${others.length ? others.map(id => `<button type="button" class="btn" data-auth-use="${id}">🔁 Проверить другой нейросетью — ${logo(id, 18)} ${esc(AI.PROVIDERS[id].short)}</button>`).join('')
          : '<button type="button" class="btn" data-auth="connect" title="Gemini и Groq — бесплатно, нужен только ключ">🔁 Проверить другой нейросетью</button>'}
      </div>
      <p class="aih-auth-msg" data-auth-msg role="status" aria-live="polite"></p>
      <details class="aih-auth-more"><summary>Если не помогает ▾</summary>
        <p>Перезапустите мост: в окне Терминала, где он работает, нажмите <b>Ctrl+C</b>, затем выполните:</p>${cmdBox(c.restart)}</details>
    </div>`;
  }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) { /* older Safari / no permission */ }
    const ta = document.createElement('textarea');
    ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* no */ }
    ta.remove(); return ok;
  }
  let authBusy = false;
  /** clicks inside any auth panel (stage, progress window, its own window) */
  document.addEventListener('click', async e => {
    const box = e.target.closest && e.target.closest('.aih-auth');
    if (!box) return;
    const cp = e.target.closest('[data-copy]');
    if (cp) {
      const ok = await copyText(cp.dataset.copy);
      const was = cp.textContent; cp.textContent = ok ? '✓ Скопировано' : 'Выделите и скопируйте вручную';
      if (!ok) { const code = cp.parentElement.querySelector('code'); if (code) { const r = document.createRange(); r.selectNodeContents(code); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } }
      setTimeout(() => { cp.textContent = was; }, 2200);
      return;
    }
    const use = e.target.closest('[data-auth-use]');
    if (use) {
      Store.setSetting('aiProvider', use.dataset.authUse); if (AI.unrest) AI.unrest(use.dataset.authUse);
      if (window.App && App.updateBadge) App.updateBadge();
      closeAuthModal(box);
      if (RUN) resume(); else UI.toast(`Теперь работает ${AI.PROVIDERS[use.dataset.authUse].short}`, 'good', 3000);
      return;
    }
    const b = e.target.closest('[data-auth]');
    if (!b) return;
    if (b.dataset.auth === 'connect') { closeAuthModal(box); if (window.App) App.go('settings'); UI.toast('Подключите бесплатную нейросеть: Gemini или Groq — нужен только ключ', '', 5000); return; }
    if (b.dataset.auth !== 'recheck' || authBusy) return;
    const msg = box.querySelector('[data-auth-msg]');
    authBusy = true; b.disabled = true; const label = b.textContent; b.textContent = '⏳ Проверяю…';
    if (msg) { msg.className = 'aih-auth-msg'; msg.textContent = 'Спрашиваю Claude одним маленьким запросом…'; }
    let ok = false;
    try { ok = await AI.recheckClaude(); } catch (x) { ok = false; }
    authBusy = false;
    if (!box.isConnected) return;
    b.disabled = false; b.textContent = label;
    if (ok) {
      if (msg) { msg.className = 'aih-auth-msg good'; msg.textContent = '✓ Claude снова на связи' + (RUN ? ' — продолжаю проверку' : ''); }
      if (Store.settings.aiProvider && Store.settings.aiProvider !== 'auto' && Store.settings.aiProvider !== 'claude' && RUN) { /* the person chose another AI on purpose: keep it */ }
      setTimeout(() => { closeAuthModal(box); if (RUN && !live) resume(); else if (!RUN) UI.toast('✓ Claude снова на связи', 'good', 3000); }, 700);
      return;
    }
    const B = AI.bridge || {};
    if (msg) {
      msg.className = 'aih-auth-msg bad';
      msg.textContent = !B.up ? 'Мост на Mac не отвечает. Запустите его снова (ниже, «Если не помогает») и нажмите ещё раз.'
        : !B.newBridge ? 'Claude пока не пускает. Если вы уже вошли или сохранили ключ — перезапустите мост (ниже, «Если не помогает»), он обновился.'
        : 'Claude пока не пускает. Дождитесь в браузере «Login successful» (или в Терминале «Ключ сохранён») и нажмите ещё раз.';
    }
    if (!B.up || !B.newBridge) { const d = box.querySelector('.aih-auth-more'); if (d) d.open = true; }
  });
  function closeAuthModal(box) { const bd = box.closest('.modal-backdrop'); if (bd && bd._m && box.closest('.aih-auth-modal')) bd._m.close(); }
  /** its own window (Claude asked to log in again while the person used any 🤖 button) */
  function authHelp() {
    const old = document.querySelector('.aih-auth-modal'); if (old) return;
    UI.modal({ title: '🔑 Claude просит войти ещё раз', cls: 'aih-auth-modal', body: authPanelHtml(),
      foot: '<button type="button" class="btn ghost" data-close-auth>Позже</button>' }).el.addEventListener('click', e => {
      if (e.target.closest('[data-close-auth]')) { const bd = e.target.closest('.modal-backdrop'); if (bd && bd._m) bd._m.close(); }
    });
  }
  let authToastAt = 0;
  /** js/ai.js → Claude said «log in again»: a check in progress shows its panel itself; otherwise one calm note */
  function authNotice() {
    if (live || document.querySelector('.aih-auth') || now() - authToastAt < 120000) return;
    authToastAt = now();
    UI.toastAction('Claude просит снова войти на этом Mac — это пара минут', 'Как это сделать', () => authHelp(), 12000, '🔑');
  }

  /* ---------- change bus: panels redraw when the queue moves ---------- */
  const subs = new Set();
  const emit = () => { subs.forEach(fn => { try { fn(); } catch (e) { console.warn('aihub', e); } }); pill(); };

  /* =====================================================================
   * Reports (localStorage, newest first)
   * ===================================================================== */
  const reports = () => { const r = lsGet(LS_REP, []); return Array.isArray(r) ? r : []; };
  function saveReports(list) {
    list = list.slice(0, MAX_REPORTS);
    while (list.length) {
      if (lsSet(LS_REP, list)) return true;
      if (list.length > 1) { list.pop(); continue; } // drop the oldest first
      // one huge report: shorten long texts of the decided changes (the pending ones keep everything)
      const r = list[0]; let cut = false;
      r.decks.forEach(d => d.items.forEach(it => Object.values(it.f || {}).forEach(x => {
        if (x.st !== 'pending') ['old', 'new', 'orig'].forEach(k => { if (x[k] && x[k].length > 400) { x[k] = x[k].slice(0, 400); cut = true; } });
      })));
      if (!cut || !lsSet(LS_REP, list)) return false;
      return true;
    }
    return false;
  }
  const getReport = id => reports().find(r => r.id === id) || null;
  function putReport(rep) {
    const list = reports().filter(r => r.id !== rep.id);
    list.unshift(rep);
    saveReports(list);
  }
  /** numbers of a report (computed — they stay right after accept / undo) */
  function sums(rep) {
    // fixed: cards with a real fix; added: right cards that only got more (all forms, examples per tense…)
    const s = { checked: 0, ok: 0, skipped: 0, items: 0, fixed: 0, added: 0, pending: 0, pendingCards: 0, applied: 0, issues: 0 };
    rep.decks.forEach(d => {
      s.checked += d.checked || 0; s.ok += d.ok || 0; s.skipped += d.skipped || 0;
      d.items.forEach(it => {
        s.items++;
        const fs = Object.values(it.f || {});
        const done = Object.entries(it.f || {}).filter(([, x]) => x.st === 'applied' || x.st === 'accepted');
        if (done.length) { if (done.every(([f, x]) => ADDS(f, x))) s.added++; else s.fixed++; }
        const p = fs.filter(x => x.st === 'pending').length;
        if (p) { s.pending += p; s.pendingCards++; }
        s.applied += fs.filter(x => x.st === 'applied' || x.st === 'accepted').length;
        if (!it.ok) s.issues++;
      });
    });
    return s;
  }
  function deckSums(d) { return sums({ decks: [d] }); }

  /* =====================================================================
   * Applying / rejecting / undoing changes on the real cards
   * ===================================================================== */
  /** fields → card (st: 'applied' when done by the auto mode, 'accepted' when the person agreed) */
  function applyFields(item, fields, st, note) {
    const card = Store.card(item.id);
    if (!card) { item.gone = true; return 0; }
    const patch = {}, acc = {};
    fields.forEach(f => {
      const x = item.f && item.f[f];
      if (!x || x.st === 'applied' || x.st === 'accepted') return;
      if (ARR(f)) { x.origArr = (card[f] || []).slice(); patch[f] = x.arr || []; acc[f] = { old: x.old, new: x.new }; x.st = st; return; }
      x.orig = card[f] == null ? '' : String(card[f]);
      patch[f] = x.new; acc[f] = { old: x.orig, new: x.new }; x.st = st;
    });
    const n = Object.keys(patch).length;
    if (!n) return 0;
    // ✓ a side with another proposal still waiting for the person keeps its earlier mark (js/ai.js → stamp)
    Object.assign(patch, AI.stamp(card, item.by, { action: 'check', fields: acc, note, pend: stillPending(item) }));
    Store.updateCard(item.id, patch);
    // the text changed → the word glosses of this card are made again the next time it is shown (word view)
    if (Object.keys(acc).some(f => GLOSS_F.includes(f))) glossStale(item.id);
    return n;
  }
  const GLOSS_F = ['no', 'ru', 'examples', 'description', 'example', 'exampleRu'];
  const glossStale = id => { try { if (window.Study && Study.glossStale) Study.glossStale(id); } catch (e) { console.warn('glosses', e); } };
  const stillPending = item => ORDER.filter(f => item.f && item.f[f] && item.f[f].st === 'pending' && !SIDE(f));
  /** «Оставить как было» / «Отклонить»: the card stays — the AI did check it, so its sides get the ✓ (a side with
   *  another proposal still waiting keeps what it had) */
  function rejectFields(item, fields, note) {
    let n = 0;
    fields.forEach(f => { const x = item.f && item.f[f]; if (x && x.st === 'pending') { x.st = 'rejected'; n++; } });
    const card = n && Store.card(item.id);
    if (card) Store.updateCard(item.id, AI.stamp(card, item.by, { action: 'check', pend: stillPending(item), note: note || 'предложение нейросети отклонено вами — оставлено как было' }));
    return n;
  }
  /** back to how it was; a field the person changed again since then is left alone → { n, kept } */
  function undoFields(item, fields) {
    const card = Store.card(item.id);
    if (!card) { item.gone = true; return { n: 0, kept: 0 }; }
    const patch = {}, back = {}; let kept = 0;
    fields.forEach(f => {
      const x = item.f && item.f[f];
      if (!x || !(x.st === 'applied' || x.st === 'accepted')) return;
      if (ARR(f)) {
        if (!same(card[f], x.arr)) { kept++; return; }
        patch[f] = (x.origArr || x.oldArr || []).slice(); back[f] = { old: x.new, new: x.old }; x.st = 'undone'; return;
      }
      if (String(card[f] == null ? '' : card[f]).trim() !== String(x.new).trim()) { kept++; return; }
      const old = x.orig != null ? x.orig : x.old;
      patch[f] = old; back[f] = { old: x.new, new: old }; x.st = 'undone';
    });
    const n = Object.keys(patch).length;
    if (n) {
      if (window.Prov) patch.history = Prov.add(card, Prov.entry('manual', 'edit', back, '↩ отменено исправление нейросети'));
      Store.updateCard(item.id, patch);
    }
    return { n, kept };
  }

  /* =====================================================================
   * The queue
   * ===================================================================== */
  let RUN = lsGet(LS_RUN, null);
  if (RUN && (!RUN.decks || !RUN.rid)) RUN = null;
  if (RUN && RUN.status === 'running') RUN.status = 'paused'; // the page was closed while it worked: it waits for «▶ Продолжить»
  let live = false, pauseReq = false, stopReq = false, finished = null, gen = 0; // finished: report id of a run that just ended (the pill offers it)
  let note = null; // the last «limit / continue?» toast — closed as soon as the check goes on
  const dropNote = () => { if (note) { try { note.close(); } catch (e) { /* gone */ } note = null; } };
  const saveRun = () => { if (RUN) lsSet(LS_RUN, RUN); else lsDel(LS_RUN); };
  const runDone = () => (RUN ? RUN.decks.reduce((n, d) => n + Math.min(d.pos, d.ids.length), 0) : 0);
  const runTotal = () => (RUN ? RUN.decks.reduce((n, d) => n + d.ids.length, 0) : 0);
  function eta() {
    if (!RUN) return '';
    const left = runTotal() - runDone();
    if (left <= 0) return '';
    // this run's own answers when there are some (the pace switch starts the count again), else what the last checks took
    const req = RUN.batches ? RUN.ms / RUN.batches : 0, show = RUN.pn ? RUN.pms / RUN.pn : 0;
    return minText(estMs(left, { one: RUN.one, depth: RUN.depth, full: runFull(), view: RUN.view, req, show }));
  }
  const unchecked = deckId => Store.cards(deckId).filter(c => !c.aiChecked);
  const sIco = n => (window.NavIcons && NavIcons.icon ? NavIcons.icon(n, 16) : '');
  const decksWithCards = () => Store.decks().filter(d => Store.cards(d.id).length);

  /** the plan of a check: which cards of which decks */
  function plan(deckIds, scope) {
    return deckIds.map(id => Store.deck(id)).filter(Boolean)
      .map(d => ({ id: d.id, name: d.name, ids: Store.cards(d.id).filter(c => scope === 'all' || !c.aiChecked).map(c => c.id) }))
      .filter(d => d.ids.length);
  }

  /** «✅ Проверить» — the start window: how to apply, which cards, honest note; → starts the queue */
  async function checkDecks(deckIds, o = {}) {
    if (!aiOn()) { if (window.AI && AI.bridge && AI.bridge.auth === 'bad') authHelp(); else if (window.Guides) Guides.needAI('Проверить колоды'); return false; }
    deckIds = (deckIds && deckIds.length ? deckIds : decksWithCards().map(d => d.id)).filter(id => Store.deck(id));
    if (live) {
      if (stageUp()) { LV.el.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' }); return false; }
      UI.toast('Проверка уже идёт — покажу, где она', '', 3000); showRun(); return false;
    }
    if (RUN) {
      const r = await UI.choose(`${bot(true)} Есть незаконченная проверка`, `<p>Нейросеть уже проверила <b>${runDone()} из ${runTotal()}</b> карточек в прошлый раз. Продолжить её — или начать новую?</p>
        <p class="small muted">Всё, что уже проверено, сохранено в отчёте в любом случае.</p>`,
      [{ label: 'Отмена', value: null, cls: 'ghost' }, { label: '🆕 Начать новую', value: 'new' }, { label: '▶ Продолжить прошлую', value: 'go', cls: 'primary' }]);
      if (!r) return false;
      if (r === 'go') { resume(); if (!watching()) showRun(); return true; }
      finishRun('stopped', true);
    }
    const opts = await startDialog(deckIds, o);
    if (!opts) return false;
    const decks = plan(deckIds, opts.scope);
    const total = decks.reduce((n, d) => n + d.ids.length, 0);
    if (!total) { UI.toast('В колоде нет карточек — нечего проверять', 'warn'); return false; }
    const rep = { id: 'r' + now().toString(36), at: now(), end: 0, mode: opts.mode, scope: opts.scope, depth: opts.depth, full: opts.full, by: [], status: 'running', total,
      decks: decks.map(d => ({ id: d.id, name: d.name, total: d.ids.length, checked: 0, ok: 0, skipped: 0, items: [] })) };
    putReport(rep);
    RUN = { rid: rep.id, mode: opts.mode, scope: opts.scope, depth: opts.depth, full: opts.full, view: opts.view, one: !!opts.one, status: 'running', t0: now(), ms: 0, batches: 0, pms: 0, pn: 0, di: 0, why: '',
      decks: decks.map(d => ({ id: d.id, ids: d.ids, pos: 0 })) };
    saveRun();
    finished = null;
    if (o.from && o.from.close) o.from.close();
    if (opts.view === 'live') { LV.done = null; LV.snaps = []; LV.state = {}; LV.line = ''; lvEnsure(decks[0].id); } else showRun();
    loop();
    return true;
  }

  /** the choice sheet before a deck check: 👀 watch live (default) / ⚡ fast in the background, what to check, how to fix.
   *  The last choice is remembered (the view: localStorage 'nk-aihub'; fixes and scope: Store.settings — the same as in ⚙️ Настройки) */
  function startDialog(deckIds, o) {
    return new Promise(resolve => {
      // which cards: «Только непроверенные (N)» / «Все карточки заново (M)» — always visible at the top. Nothing left
      // unchecked (N = 0) → «Все заново» is chosen at once: a check can be repeated any time, as often as the person likes
      const allN = plan(deckIds, 'all').reduce((n, d) => n + d.ids.length, 0);
      const newN = plan(deckIds, 'unchecked').reduce((n, d) => n + d.ids.length, 0);
      let result = null, scope = o.scope === 'all' || !newN ? 'all' : 'unchecked', mode = fixMode() === 'ask' ? 'review' : 'auto', depth = depthOf(), full = fullOf();
      let view = hub().view === 'fast' ? 'fast' : 'live', one = hub().pace === 'one';
      const count = () => plan(deckIds, scope).reduce((n, d) => n + d.ids.length, 0);
      const names = deckIds.map(x => Store.deck(x)).filter(Boolean);
      const where = b => names.length === 1 ? `в колоде ${b ? '<b>' : ''}«${esc(names[0].name)}»${b ? '</b>' : ''}` : `в ${names.length} ${plural(names.length, ['колоде', 'колодах', 'колодах'])}`;
      const opt = (v, icon, title, sub) => `<button type="button" class="aih-opt" role="radio" data-aiview="${v}"><span class="aih-opt-i" aria-hidden="true">${icon}</span><span><b>${title}</b><small>${sub}</small></span></button>`;
      const m = UI.modal({
        title: `${bot(true)} Проверка нейросетью`, cls: 'aih-start-modal',
        body: `<div class="aih-label aih-scope-h">Какие карточки проверить</div>
          <div class="aih-seg aih-scope" role="radiogroup" aria-label="Какие карточки проверить">
            <button type="button" role="radio" data-scope="unchecked" ${newN ? '' : 'disabled aria-disabled="true"'}><b>Только непроверенные (${newN})</b><small>${newN ? 'те, что нейросеть ещё не проверяла' : 'таких нет — все уже проверены'}</small></button>
            <button type="button" role="radio" data-scope="all" ${allN ? '' : 'disabled aria-disabled="true"'}><b>Все карточки заново (${allN})</b><small>и уже проверенные — ещё раз, когда захотите</small></button>
          </div>
          <div class="aih-scope-note" data-scope-note role="status"></div>
          <div class="aih-start-sum" data-sum></div>
          <div class="aih-opts aih-views" role="radiogroup" aria-label="Как смотреть">
            ${opt('live', '👀', 'Смотреть вживую', 'Карточки переворачиваются, нейросеть читает, сравнивает, исправляет и ставит ✓. Есть «Пауза», скорость показа и «Досмотреть в фоне».')}
            ${opt('fast', '⚡', 'Быстро, в фоне', 'Можно учить дальше. В конце — список изменений, любое можно вернуть.')}
          </div>
          <div class="aih-label">Как отправлять нейросети</div>
          <div class="aih-seg aih-pace" role="radiogroup" aria-label="Как отправлять нейросети">
            <button type="button" role="radio" data-pace="batch"><b>Порциями (быстрее)</b><small data-pace-t="batch"></small></button>
            <button type="button" role="radio" data-pace="one"><b>По одной карточке</b><small data-pace-t="one"></small></button>
          </div>
          <div class="aih-pc" data-pc></div>
          ${choiceRows()}
          ${strategyRows()}
          <div class="aih-who" data-who></div>
          <details class="aih-more"><summary>🤝 Честно о границах</summary>${limitsHtml()}</details>`,
        foot: '<button type="button" class="btn ghost" data-no>Отмена</button><button type="button" class="btn primary lg" data-go>▶ Начать проверку</button>',
        onClose: () => resolve(result),
      });
      const draw = () => {
        const n = count();
        const est = o1 => minText(estMs(n, { one: o1, depth, full, view }));
        const per = perReq(depth, full);
        m.$$('[data-scope]').forEach(b => { const on = b.dataset.scope === scope; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
        // why «Все заново» is chosen / why there is nothing to start
        m.$('[data-scope-note]').innerHTML = !allN ? `${sIco('info')}<span>${where()} пока нет карточек — добавьте карточки, и нейросеть их проверит.</span>`
          : !newN ? `${sIco('check')}<span>Все карточки уже проверены — проверим заново: <b>${allN} ${plural(allN, ['карточка', 'карточки', 'карточек'])}</b>.</span>` : '';
        m.$('[data-sum]').innerHTML = `<div class="aih-sum-big"><b>${n}</b><span>${plural(n, ['карточка', 'карточки', 'карточек'])}</span></div>
          <div class="aih-sum-txt">${where(true)}
          ${scope === 'all' ? '— все, и проверенные раньше' : '— только те, что нейросеть ещё не проверяла'}<br><span class="muted">${n ? `Займёт ${est(one)}${view === 'live' ? ', вместе с показом каждой карточки' : ''}` : 'Пока нечего проверять'}</span></div>`;
        // the whole card with all forms and examples per tense: a long answer — smaller portions, and it is said
        m.$('[data-pace-t="batch"]').textContent = `по ${per} ${plural(per, ['карточке', 'карточки', 'карточек'])} за раз${depth === 'card' && full ? ' (с формами и примерами ответ длиннее)' : ''} · ${est(false)}`;
        m.$('[data-pace-t="one"]').textContent = `медленнее, полностью вживую · ${est(true)}`;
        m.$$('[data-pace]').forEach(b => { const on = (b.dataset.pace === 'one') === one; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
        markChoice(m.el, { mode: mode === 'review' ? 'ask' : 'auto', depth, full });
        m.$$('[data-aiview]').forEach(b => { const on = b.dataset.aiview === view; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
        // never a start «for nothing»: disabled only when there are no cards at all (the note above says why)
        m.$('[data-go]').disabled = !n;
        m.$('[data-go]').title = n ? '' : 'В колоде нет карточек';
        m.$('[data-go]').textContent = `${view === 'live' ? '👀 Начать и смотреть' : '⚡ Начать в фоне'}${n ? ` · ${n}` : ''}`;
        // ⚖️ «Порциями» or «По одной»: honest pros and cons with the tokens of exactly these cards
        const cards = plan(deckIds, scope).reduce((a, d) => a.concat(d.ids), []).map(x => Store.card(x)).filter(Boolean);
        m.$('[data-pc]').innerHTML = prosCons(cards, depth, full, one);
        markStrategy(m.el);
        const id = aiId(), P = (window.AI && AI.PROVIDERS[id]) || {};
        m.$('[data-who]').innerHTML = `${workLogo(id, { size: 30 })}<span class="aih-who-t">Начнёт <b>${esc(P.short || aiName(id))}</b> (${esc(kindTag(id))})${whoNext()}. Проверку можно поставить на паузу и продолжить потом — ничего не потеряется.</span>`;
      };
      m.el.addEventListener('click', e => {
        if (strategyClick(e, m.el)) { draw(); return; }
        const b = e.target.closest('[data-fixmode]'); if (b) { mode = b.dataset.fixmode === 'ask' ? 'review' : 'auto'; draw(); return; }
        const v = e.target.closest('[data-aiview]'); if (v) { view = v.dataset.aiview; draw(); return; }
        const sb = e.target.closest('[data-scope]'); if (sb) { if (!sb.disabled) { scope = sb.dataset.scope; draw(); } return; }
        const dp = e.target.closest('[data-depth]'); if (dp) { depth = dp.dataset.depth; draw(); return; }
        const pc = e.target.closest('[data-pace]'); if (pc) { one = pc.dataset.pace === 'one'; draw(); return; }
        if (e.target.closest('[data-no]')) m.close();
        if (e.target.closest('[data-go]')) {
          hubPatch({ view, pace: one ? 'one' : 'batch' }); setOpt('aiFixMode', mode === 'review' ? 'ask' : 'auto'); setOpt('aiCheckDepth', depth); setOpt('aiCheckFull', full);
          result = { mode, scope, view, depth, full, one }; m.close();
        }
      });
      const fl = m.$('[data-full]'); if (fl) fl.onchange = () => { full = fl.checked; draw(); };
      draw();
      // 🖥 Ollama chosen: one quick look — not running → the sheet says at once who really starts
      if (AI.checkLocal) AI.checkLocal().then(err => { if (err && m.el.isConnected) { draw(); const w = m.$('[data-who] .aih-who-t'); if (w) w.insertAdjacentHTML('beforeend', `<small class="aih-who-why">${esc(err.message)}</small>`); } }).catch(() => {});
      setTimeout(() => { const g = m.$('[data-go]'); if (g) g.focus({ preventScroll: true }); }, 60);
    });
  }
  /** «Проверять: только слово / всю карточку» + «Исправления: сразу / сначала спрашивать» — the same rows in the sheet and in ⚙️ Настройки */
  function choiceRows() {
    return `<div class="aih-label">Проверять</div>
      <div class="aih-seg" role="radiogroup" aria-label="Что проверять">
        <button type="button" role="radio" data-depth="word"><b>Только слово и перевод</b><small data-depth-t="word"></small></button>
        <button type="button" role="radio" data-depth="card"><b>Всю карточку</b><small data-depth-t="card"></small></button>
      </div>
      <label class="switch aih-full"><input type="checkbox" data-full><span class="track"></span><span><b>📚 Добавлять все формы и примеры по временам</b><small data-full-t></small></span></label>
      <div class="aih-label">Исправления нейросети</div>
      <div class="aih-seg" role="radiogroup" aria-label="Исправления нейросети">
        <button type="button" role="radio" data-fixmode="auto"><b>Применять сразу</b><small>с кнопкой «↶ Вернуть»</small></button>
        <button type="button" role="radio" data-fixmode="ask"><b>Сначала спрашивать</b><small>вы решаете сами</small></button>
      </div>`;
  }
  function markChoice(root, v) {
    const full = v.full == null ? fullOf() : !!v.full;
    root.querySelectorAll('[data-fixmode]').forEach(b => { const on = b.dataset.fixmode === v.mode; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    root.querySelectorAll('[data-depth]').forEach(b => { const on = b.dataset.depth === v.depth; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    const t = { word: full ? 'и все формы слова' : 'только вердикт и перевод', card: full ? 'перевод, все формы, примеры по временам, объяснение, синонимы' : 'перевод, объяснение, примеры, синонимы — без новых форм' };
    root.querySelectorAll('[data-depth-t]').forEach(x => { x.textContent = t[x.dataset.depthT]; });
    root.querySelectorAll('[data-full]').forEach(x => { x.checked = full; });
    root.querySelectorAll('[data-full-t]').forEach(x => {
      x.textContent = !full ? 'Выключено: нейросеть только проверяет перевод и исправляет ошибки, новые формы и примеры не дописывает.'
        : v.depth === 'word' ? 'Даже у верной карточки появятся все формы слова с переводом: учить слово нужно во всех временах.'
          : 'Даже у верной карточки появятся все формы слова и короткие примеры: настоящее, прошедшее, перфект, будущее.';
    });
  }

  /* ---------- 🔁 which AIs work, in which order (AI.strategy: the sheet and ⚙️ Настройки → 🤖 Нейросети, remembered) ---------- */
  const hhmm = t => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  /** «в 09:00», «завтра в 09:00», «22 ноября в 09:00» */
  const atText = t => {
    const d = new Date(t), today = new Date(), tm = new Date(now() + 864e5);
    const same = (a, b) => a.toDateString() === b.toDateString();
    return same(d, today) ? `в ${hhmm(t)}` : same(d, tm) ? `завтра в ${hhmm(t)}` : `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} в ${hhmm(t)}`;
  };
  /** «через 1 ч 12 мин», «через 45 с» */
  const leftText = t => {
    const s = Math.max(0, Math.round((t - now()) / 1000));
    if (s < 60) return `через ${s} с`;
    const m = Math.ceil(s / 60), h = Math.floor(m / 60);
    return h ? `через ${h} ч${m % 60 ? ` ${m % 60} мин` : ''}` : `через ${m} мин`;
  };
  const KIND = { free: 'бесплатно', local: 'бесплатно, на этом Mac', sub: 'по подписке', paid: 'платно, по ключу' };
  const kindTag = id => (window.AI && AI.costKind ? KIND[AI.costKind(id)] : '');
  /** connected AIs for «Мой порядок» (Ollama only when it is the chosen one or already in the order) */
  function connectedAIs() {
    if (!window.AI) return [];
    const sel = AI.selected(), saved = Store.settings.aiOrder || [];
    return Object.keys(AI.PROVIDERS).filter(id => AI.configured(id) && (!AI.PROVIDERS[id].noKey || id === sel || saved.includes(id)));
  }
  function myOrder() {
    const conn = connectedAIs(), saved = (Store.settings.aiOrder || []).filter(id => conn.includes(id));
    const sel = AI.selected(), rest = conn.filter(id => !saved.includes(id)).sort((a, b) => (a === sel ? -1 : b === sel ? 1 : 0));
    return [...saved, ...rest];
  }
  function strategyRows() {
    const r = (v, t, sub) => `<button type="button" role="radio" data-strat="${v}"><b${v === 'one' ? ' data-strat-one' : ''}>${t}</b><small>${sub}</small></button>`;
    return `<div class="aih-label">Если нейросеть не отвечает или кончился лимит</div>
      <div class="aih-seg aih-strat" role="radiogroup" aria-label="Какие нейросети работают по очереди">
        ${r('one', 'Только одна', 'другие не подключаются — проверка подождёт, пока она отдохнёт')}
        ${r('free', 'Все бесплатные по очереди', 'одна заменяет другую, когда кончается лимит')}
        ${r('all', 'Все подключённые', 'сначала бесплатные, потом платные')}
        ${r('mine', 'Мой порядок', 'расставьте стрелками ↑ ↓')}
      </div>
      <ol class="aih-order" data-order hidden aria-label="Мой порядок нейросетей"></ol>`;
  }
  function markStrategy(root) {
    if (!window.AI || !AI.strategy) return;
    const st = AI.strategy(), sel = AI.selected();
    root.querySelectorAll('[data-strat]').forEach(b => { const on = b.dataset.strat === st; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    root.querySelectorAll('[data-strat-one]').forEach(x => { x.textContent = `Только одна: ${sel && AI.PROVIDERS[sel] ? AI.PROVIDERS[sel].short : 'выбранная'}`; });
    root.querySelectorAll('[data-order]').forEach(ol => {
      ol.hidden = st !== 'mine';
      if (st !== 'mine') { ol.innerHTML = ''; return; }
      const ord = myOrder();
      ol.innerHTML = ord.length ? ord.map((id, i) => { const u = AI.restUntil(id); return `<li class="aih-ord" data-oid="${esc(id)}"><span class="aih-ord-n">${i + 1}</span>${logo(id, 24)}
        <span class="aih-ord-t"><b>${esc(AI.PROVIDERS[id].name)}</b><small>${esc(kindTag(id))}${u ? ` · отдыхает до ${hhmm(u)}` : ''}</small></span>
        <button type="button" class="btn sm" data-omove="-1" ${i ? '' : 'disabled'} aria-label="${esc(AI.PROVIDERS[id].short)} — выше">↑</button>
        <button type="button" class="btn sm" data-omove="1" ${i < ord.length - 1 ? '' : 'disabled'} aria-label="${esc(AI.PROVIDERS[id].short)} — ниже">↓</button></li>`; }).join('')
        : '<li class="aih-ord-empty">Подключите хотя бы одну нейросеть в ⚙️ Настройках.</li>';
    });
  }
  /** a click in the strategy rows (the sheet or Settings) → saved at once; true when it was one */
  function strategyClick(e, root) {
    const b = e.target.closest('[data-strat]');
    if (b) {
      setOpt('aiStrategy', b.dataset.strat);
      if (b.dataset.strat === 'mine') setOpt('aiOrder', myOrder());
      markStrategy(root); if (AI.badge) AI.badge(); emit();
      return 'strat';
    }
    const mv = e.target.closest('[data-omove]');
    if (mv) {
      const id = mv.closest('[data-oid]').dataset.oid, ord = myOrder(), i = ord.indexOf(id), j = i + +mv.dataset.omove;
      if (i >= 0 && j >= 0 && j < ord.length) {
        [ord[i], ord[j]] = [ord[j], ord[i]];
        setOpt('aiOrder', ord);
        markStrategy(root); if (AI.badge) AI.badge(); emit();
        const again = root.querySelector(`[data-oid="${CSS.escape(id)}"] [data-omove="${mv.dataset.omove}"]:not([disabled])`) || root.querySelector(`[data-oid="${CSS.escape(id)}"] [data-omove]:not([disabled])`);
        if (again) again.focus({ preventScroll: true });
      }
      return 'move';
    }
    return false;
  }
  /** «, потом Groq и Gemini» — who takes over (the chosen order) */
  function whoNext() {
    if (!window.AI || !AI.chain) return '';
    const cur = aiId(), next = AI.chain().filter(id => id !== cur && !AI.resting(id)).slice(0, 3);
    if (AI.strategy() === 'one') return ' — только она, другие не подключаются';
    return next.length ? `; не ответит или кончится лимит — продолжит ${next.map(id => esc(AI.PROVIDERS[id].short)).join(', затем ')}` : '';
  }

  /* ---------- 🔢 tokens: how many, and what it costs ---------- */
  const fmtN = n => Math.round(n || 0).toLocaleString('ru-RU');
  const tokW = n => plural(Math.round(n), ['токен', 'токена', 'токенов']);
  const usdText = v => (v < 0.01 ? 'меньше 1 цента' : '$' + v.toFixed(2).replace('.', ','));
  /** what one AI's tokens cost in words: free tier / this Mac / subscription / ≈ dollars */
  function costOne(id, u) {
    const k = window.AI && AI.costKind ? AI.costKind(id) : 'free';
    if (k === 'free') return 'бесплатно (в пределах лимита)';
    if (k === 'local') return 'бесплатно — работает на вашем Mac';
    if (k === 'sub') return 'входит в подписку (тратит её лимит)';
    const usd = u && u.usd != null ? u.usd : AI.costOf(id, u);
    return usd == null ? 'платно — точную сумму покажет сервис' : usd < 0.01 ? 'меньше 1 цента (примерно)' : `≈ ${usdText(usd)} (примерно)`;
  }
  /** tokens of a run / a report: { in, out, est, by: { id: { in, out, usd } } } → «бесплатно (в пределах лимита)» or per AI */
  function costLine(tok) {
    const ids = Object.keys((tok && tok.by) || {});
    if (!ids.length) return '';
    if (ids.length === 1) return costOne(ids[0], tok.by[ids[0]]);
    return ids.map(id => `${AI.PROVIDERS[id] ? AI.PROVIDERS[id].short : id}: ${costOne(id, tok.by[id])}`).join(' · ');
  }
  /** a portion's meter (AI.call pushes { p, in, out, usd?, est? } per request) → added to a total */
  function addTok(t, meter) {
    (meter || []).forEach(u => {
      t.in = (t.in || 0) + (u.in || 0); t.out = (t.out || 0) + (u.out || 0); t.req = (t.req || 0) + 1;
      if (u.est) t.est = true;
      t.by = t.by || {};
      const b = t.by[u.p] || (t.by[u.p] = { in: 0, out: 0 });
      b.in += u.in || 0; b.out += u.out || 0;
      if (u.usd != null) b.usd = (b.usd || 0) + u.usd;
    });
    return t;
  }
  const tokTotal = t => (t ? (t.in || 0) + (t.out || 0) : 0);
  /** ≈ answer tokens per card (learned from real answers; a first guess before that) */
  const OUT0 = { 'word': 160, 'word+': 380, 'card': 420, 'card+': 950 };
  const outKey = (depth, full) => (depth === 'word' ? 'word' : 'card') + (full ? '+' : '');
  const outPer = (depth, full) => { const v = (hub().tokOut || {})[outKey(depth, full)]; return v > 20 && v < 8000 ? v : OUT0[outKey(depth, full)]; };
  function outLearn(depth, full, out, n) {
    if (!(out > 0) || !n) return;
    const tk = Object.assign({}, hub().tokOut || {}), k = outKey(depth, full), v = out / n;
    tk[k] = tk[k] ? Math.round(tk[k] * 0.7 + v * 0.3) : Math.round(v);
    hubPatch({ tokOut: tk });
  }
  /** ≈ tokens to check these cards: in portions of `per` or one by one (the instruction then goes with every card) */
  function estCards(cards, depth, full, one) {
    if (!cards.length || !window.AI || !AI.estimateCheck) return 0;
    const sample = cards.slice(0, 24), per = one ? 1 : perReq(depth, full);
    let t = 0;
    for (let i = 0; i < sample.length; i += per) t += AI.estimateCheck(sample.slice(i, i + per), depth, full);
    return (t + outPer(depth, full) * sample.length) * cards.length / sample.length;
  }
  /** ⚖️ the sheet: «Порциями» vs «По одной» — honest pros and cons with the numbers of these cards */
  function prosCons(cards, depth, full, one) {
    const n = cards.length;
    if (!n) return '';
    const b = estCards(cards, depth, full, false), o = estCards(cards, depth, full, true), id = aiId();
    const ratio = b ? o / b : 1.6;
    const cost = u => { const k = AI.costKind(id); return k === 'paid' ? costOne(id, { in: u * 0.75, out: u * 0.25 }) : costOne(id); };
    const rt = ratio.toFixed(1).replace(/\.0$/, '').replace('.', ',');
    return `<div class="aih-pc-h">⚖️ За и против</div>
      <div class="aih-pc-cols">
        <div class="aih-pc-c${one ? '' : ' on'}"><b>Порциями</b><ul>
          <li class="pro">дешевле: общая инструкция отправляется один раз на ${perReq(depth, full)} ${plural(perReq(depth, full), ['карточку', 'карточки', 'карточек'])}</li>
          <li class="pro">быстрее</li>
          <li class="con">карточки показываются, когда готов ответ на всю порцию</li></ul>
          <small>≈ ${fmtN(b)} ${tokW(b)} · ${esc(cost(b))}</small></div>
        <div class="aih-pc-c${one ? ' on' : ''}"><b>По одной карточке</b><ul>
          <li class="pro">полностью вживую, внимание к каждой карточке</li>
          <li class="con">дороже ≈ в ${rt} раза: инструкция идёт с каждой карточкой</li>
          <li class="con">медленнее</li></ul>
          <small>≈ ${fmtN(o)} ${tokW(o)} · ${esc(cost(o))}</small></div>
      </div>
      <p class="aih-pc-note">🎬 Сам живой показ токенов не тратит — анимацию рисует приложение. Числа примерные: точные покажу во время проверки и в отчёте.</p>`;
  }

  /** the next portion from a place in the queue (di, pos): { di, pos, ids, cards } — null when nothing is left */
  function sliceAt(di, pos) {
    while (RUN && di < RUN.decks.length) {
      const d = RUN.decks[di];
      if (pos >= d.ids.length) { di++; pos = di < RUN.decks.length ? RUN.decks[di].pos : 0; continue; }
      const ids = d.ids.slice(pos, pos + bsz());
      const cards = ids.map(id => Store.card(id)).filter(Boolean);
      if (cards.length) return { di, pos, ids, cards };
      pos += ids.length; // deleted cards: nothing to ask
    }
    return null;
  }
  /** one portion goes to the AI now; the answer (or the error) waits in job.p — it never throws */
  function ask(sl) {
    const job = { sl, t0: now(), done: false, ms: 0, depth: RUN.depth, one: RUN.one, full: runFull(), meter: [], asking: null };
    try { job.estIn = AI.estimateCheck ? AI.estimateCheck(sl.cards, RUN.depth || 'card', job.full) : 0; } catch (e) { job.estIn = 0; }
    const g0 = gen;
    // who is asked right now (AI.call walks the chosen order): the title, the logo, the list marks and the 🤖 button follow it
    const onTry = id => {
      job.asking = id;
      if (!RUN || g0 !== gen || RUN.asking === id) return;
      RUN.asking = id;
      if (window.AI && AI.badge) AI.badge();
      emit();
      if (LV.phase === 'read' && LV.readN) lvState(readLine(LV.readN, aiName(id)));
    };
    // «Ollama не ответила — проверяет Gemini»: said once, short, where the check is shown
    const onSwitch = (from, to, e) => {
      if (!RUN || g0 !== gen) return;
      const lim = why(e) === 'limit';
      switchNote(`${aiName(from)} ${lim ? 'исчерпала лимит' : 'не ответила'} — проверяет ${aiName(to)}`);
    };
    const o = Object.assign(RUN.depth ? { depth: RUN.depth, full: job.full } : {}, { meter: job.meter, onTry, onSwitch });
    job.p = AI.checkCards(sl.cards, null, o)
      .then(r => ({ ok: true, r: r || [] }), e => ({ ok: false, e }))
      .then(x => { job.done = true; job.ms = now() - job.t0; return x; });
    return job;
  }
  /** a portion's tokens → the run and the report (and the «≈ per card» guess learns from the real answer) */
  function countTok(job, rep) {
    if (!job || job.counted || !job.meter.length) return;
    job.counted = true;
    RUN.tok = addTok(RUN.tok || {}, job.meter);
    if (rep) rep.tok = addTok(rep.tok || {}, job.meter);
    const out = job.meter.reduce((n, u) => n + (u.out || 0), 0);
    if (!job.meter.some(u => u.est)) outLearn(job.depth, job.full, out, job.sl.cards.length);
  }
  /** «Ollama не ответила — проверяет Gemini»: a short caption under the stage title (a toast when the stage is not on the screen) */
  function switchNote(t) {
    LV.sw = { t, at: now() };
    const c = lq('[data-lv-sw]');
    if (c && stageUp()) { c.textContent = t; c.hidden = false; c.classList.remove('aiv-sw-in'); void c.offsetWidth; c.classList.add('aiv-sw-in'); clearTimeout(LV.swT); LV.swT = setTimeout(() => { if (c.isConnected) c.hidden = true; }, 7000); }
    else if (now() - (LV.swToast || 0) > 30000) { LV.swToast = now(); UI.toast(t, '', 4000); }
  }
  /** the worker: portion after portion until done, paused, stopped or stopped by a limit.
   *  👀 live: the next portion is asked for as soon as an answer comes, so it is being read while the cards are shown.
   *  ⏸ / ⏹ make this worker stale at once (gen): its late answer is ignored, everything recorded before stays. */
  async function loop() {
    if (live || !RUN) return;
    const g = ++gen;
    const alive = () => g === gen && !!RUN;
    live = true; pauseReq = false; stopReq = false;
    dropNote();
    clearInterval(wakeT); wakeT = 0;
    RUN.status = 'running'; RUN.why = ''; RUN.wake = null; RUN.asking = null; saveRun();
    const rep = getReport(RUN.rid);
    if (!rep) { live = false; RUN = null; saveRun(); emit(); return; }
    emit();
    let fails = 0, skipsInRow = 0, okBatches = 0, job = null;
    try {
      while (alive()) {
        if (!job) {
          const cur = RUN.decks[RUN.di];
          const sl = cur ? sliceAt(RUN.di, cur.pos) : null;
          if (!sl) { finishRun('done'); return; }
          if (!aiOn()) { stopWith(rep, window.AI && AI.bridge && AI.bridge.auth === 'bad' ? 'auth' : 'none'); return; }
          job = ask(sl);
        }
        const sl = job.sl, d = RUN.decks[sl.di];
        // the portion may start a new deck: the skipped ends of the decks before it are done
        for (let i = RUN.di; i < sl.di; i++) RUN.decks[i].pos = RUN.decks[i].ids.length;
        RUN.di = sl.di; d.pos = Math.max(d.pos, sl.pos);
        const rd = rep.decks.find(x => x.id === d.id);
        emit();
        // 👀 while the answer is not here: the reading pass over exactly these cards (a ready answer is shown at once)
        if (!job.done && watching()) lvReading(d.id, sl.cards, job);
        const res = await job.p;
        if (!alive()) return;
        countTok(job, rep);
        if (!res.ok) {
          const k = why(res.e);
          console.warn('aihub: batch', k, res.e && res.e.message);
          lvIdle();
          if (k === 'odd' && ++fails < 2) { await sleep(1200); if (!alive()) return; job = ask(sl); continue; } // one more try
          if (k === 'odd' && okBatches && !skipsInRow) { // the same portion failed twice (others worked): skip it, go on
            fails = 0; skipsInRow++; RUN.batches++; RUN.ms += job.ms; job = null;
            rd.skipped += sl.cards.length; d.pos = sl.pos + sl.ids.length;
            putReport(rep); saveRun(); emit();
            continue;
          }
          job = null;
          stopWith(rep, k); return;
        }
        const results = res.r;
        fails = 0; skipsInRow = 0; okBatches++;
        // Claude asked to log in again, but another connected AI answered instead: the check goes on — say it once, calmly
        if (window.AI && AI.bridge && AI.bridge.auth === 'bad' && !RUN.authNoted && results.some(r => r && r.by && r.by !== 'claude')) {
          RUN.authNoted = true; authToastAt = now();
          UI.toastAction(`Claude просит снова войти на этом Mac — пока проверяет ${aiName((results.find(r => r && r.by) || {}).by)}`, 'Как войти', () => authHelp(), 12000, '🔑');
        }
        if (job.one === !!RUN.one && job.depth === RUN.depth) { RUN.ms += job.ms; RUN.batches++; }
        tmLearn(job.one, job.depth, job.full, job.ms);
        const snaps = sl.cards.map(snap); // how the cards looked before (the auto mode changes them in record)
        record(rep, rd, sl.cards, results, RUN.mode === 'auto');
        d.pos = sl.pos + sl.ids.length;
        putReport(rep); saveRun(); emit();
        // 👀 the next portion goes to the AI right now — it is read while these cards are shown one by one
        const show = watching() && stageUp();
        job = null;
        if (show && aiOn()) { const nx = sliceAt(RUN.di, d.pos); if (nx) job = ask(nx); }
        if (show) { await lvReveal(snaps, results, rep, rd, g); if (!alive()) return; putReport(rep); emit(); }
        else { lvIdle(); lvQuiet(snaps, results, rd); await sleep(GAP); }
      }
    } finally {
      if (g === gen) { live = false; pauseReq = false; stopReq = false; emit(); }
    }
  }
  function stopWith(rep, k) {
    RUN.status = 'limit'; RUN.why = k; RUN.asking = null;
    RUN.wake = wakeFor(k);
    if (RUN.wake) RUN.wake.set = now();
    saveRun();
    rep.status = 'paused'; putReport(rep);
    emit();
    armWake();
    if (RUN.wake && !RUN.wake.net && watching() && stageUp()) { LV.userAt = 0; followAt = 0; follow(lq('.aiv-head')); return; } // the stage says when it goes on by itself
    if (k === 'auth' && watching() && stageUp()) { LV.el.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' }); return; } // the panel is on the stage
    if (!document.querySelector('.aih-run-modal')) {
      const w = WHY[k]();
      dropNote(); note = UI.toastAction(`${RUN.wake ? wakeTitle() : w.title}. Проверенное сохранено.`, 'Подробнее', () => showRun(), 12000, w.icon);
    }
  }
  /* ---------- ⏳ everyone rests: the check goes on by itself when the first AI is back (no «▶ Продолжить» to press) ----------
   * RUN.wake = { at, id } is saved with the run: a timer, the tab coming back, the network coming back and a reload all
   * lead to the same place — at that time the check simply continues. */
  function wakeFor(k) {
    if (!window.AI || !AI.allResting) return null;
    const a = AI.allResting();
    if (a) return { at: a.at, id: a.id, all: true };
    if (k === 'net') return { at: now() + 2 * 60e3, id: '', net: true }; // no connection: try again in 2 minutes (or as soon as it is back)
    if (k === 'limit' || k === 'down') return { at: now() + 60e3, id: '' };
    return null;
  }
  /** «Все выбранные нейросети отдыхают — продолжу сам примерно в 09:00 (Gemini)» */
  function wakeTitle() {
    const w = RUN && RUN.wake;
    if (!w) return '';
    if (w.net) return `Нет связи с нейросетью — попробую снова сам ${atText(w.at)}`;
    const nm = w.id && AI.PROVIDERS[w.id] ? ` (${AI.PROVIDERS[w.id].short})` : '';
    const one = AI.chain().length === 1;
    const rest = w.id && AI.restMap()[w.id] && AI.restMap()[w.id].why === 'down';
    if (rest) return `${aiName(w.id)} на этом Mac не отвечает — попробую снова сам ${atText(w.at)}`;
    return `${one ? 'Нейросеть отдыхает' : 'Все выбранные нейросети отдыхают'} — продолжу сам примерно ${atText(w.at)}${nm}`;
  }
  let wakeT = 0;
  function armWake() {
    clearInterval(wakeT); wakeT = 0;
    if (!RUN || RUN.status !== 'limit' || !RUN.wake || live) return;
    wakeT = setInterval(tickWake, 1000);
    tickWake();
  }
  function tickWake() {
    if (!RUN || RUN.status !== 'limit' || !RUN.wake || live) { clearInterval(wakeT); wakeT = 0; return; }
    if (!window.Store || !Store.state || !window.AI) return; // the app is still loading: the next tick looks again
    const w = RUN.wake;
    // somebody of the chosen order is free again (a limit ended early, another AI was connected): no need to wait
    const free = window.AI && AI.chain && AI.chain().some(id => !AI.resting(id));
    if (now() >= w.at || (free && w.all && now() - (w.set || 0) > 3000)) { clearInterval(wakeT); wakeT = 0; autoResume(); return; }
    document.querySelectorAll('[data-wake-left]').forEach(x => { x.textContent = leftText(w.at); });
    if (LV.el && LV.el.isConnected) drawHead();
  }
  function autoResume() {
    if (!RUN || live) return;
    RUN.wake = null; RUN.why = '';
    // the stage is not on the screen (another page, a reload): the check goes on in the background — nobody is taken anywhere
    if (RUN.view === 'live' && !stageUp()) RUN.view = 'fast';
    saveRun();
    if (!aiOn()) { emit(); return; }
    resume();
  }
  /** one AI answer → a report item: per field { old, new, st } (+ arr / oldArr for the lists, kind 'alt' for a second variant) */
  function itemOf(card, r, keys) {
    const item = { id: card.id, no: first(card.no).slice(0, 120), ru: first(card.ru).slice(0, 120), ok: !!r.ok, issues: (r.issues || []).map(String).slice(0, 6), by: r.by, f: {} };
    if (r.verdict) { item.verdict = r.verdict; item.reason = r.reason || ''; if (r.verdict === 'alternative' && !r.changes.no) item.ok = true; } // another variant is not a mistake
    keys.forEach(f => {
      const c = r.changes[f];
      const x = item.f[f] = { old: String(c.old || ''), new: String(c.new || ''), st: 'pending' };
      if (ARR(f)) { x.arr = c.arr || []; x.oldArr = c.oldArr || []; }
      if (c.kind) x.kind = c.kind;
    });
    return item;
  }
  /** results of one batch → the report (+ the cards: stamps, and fixes in the auto mode) */
  function record(rep, rd, cards, results, auto) {
    cards.forEach(card => {
      const r = results.find(x => x && x.id === card.id);
      if (!r) { rd.skipped++; return; }
      rd.checked++;
      if (r.by && !rep.by.includes(r.by)) rep.by.push(r.by);
      const keys = ORDER.filter(f => r.changes && r.changes[f]);
      if (r.ok && !keys.length) {
        rd.ok++;
        Store.updateCard(card.id, AI.stamp(card, r.by, { action: 'check', note: 'без замечаний ✓ · проверка колод' }));
        return;
      }
      const item = itemOf(card, r, keys);
      const issues = item.issues.join('; ');
      const main = keys.filter(f => !SIDE(f));
      let n = 0;
      if (auto && main.length) n = applyFields(item, main, 'applied', [issues, 'исправлено сразу при проверке колод — можно откатить в отчёте'].filter(Boolean).join(' · '));
      if (!n) Store.updateCard(card.id, AI.stamp(card, r.by, { action: 'check', pend: main, note: [issues, keys.length ? 'предложения ждут вашего решения в отчёте' : ''].filter(Boolean).join(' · ') }));
      rd.items.push(item);
    });
  }
  function finishRun(status, quiet) {
    const rep = RUN && getReport(RUN.rid);
    // 👀 the live view stays on the deck page with «Готово» and the report button
    if (RUN && RUN.view === 'live' && LV.el && !quiet) { LV.done = { rid: RUN.rid, status }; lvIdle(); LV.cur = null; }
    else if (quiet) { LV.done = null; }
    if (rep) { rep.status = status; rep.end = now(); putReport(rep); }
    const rid = RUN && RUN.rid;
    RUN = null; saveRun();
    if (!quiet && rid) {
      finished = rid;
      const s = rep ? sums(rep) : null;
      if (s && !document.querySelector('.aih-run-modal') && !(LV.done && stageUp())) {
        const msg = status === 'done' ? `Нейросеть проверила ${cardsN(s.checked)}` : `Проверка остановлена: проверено ${cardsN(s.checked)}`;
        UI.toastAction(`${msg}${s.pending ? ` · ждут решения: ${s.pending}` : ''}`, `${repIco()}Отчёт`, () => report(rid), 14000, status === 'done' ? '✅' : '⏹');
      }
      if (status === 'done' && window.UI && UI.confetti && s && s.checked > 24) try { UI.confetti(90); } catch (e) { /* decoration */ }
    }
    if (window.App && App.view && (App.view.name === 'deck' || App.view.name === 'home')) try { App.render(); } catch (e) { /* ignore */ }
    emit();
  }
  function resume() {
    if (!RUN || live) return;
    if (!aiOn()) {
      if (window.AI && AI.bridge && AI.bridge.auth === 'bad') { // Claude still asks to log in: show the panel again (no retry loop)
        RUN.status = 'limit'; RUN.why = 'auth'; saveRun(); emit();
        if (watching()) { const d = RUN.decks[Math.min(RUN.di, RUN.decks.length - 1)]; if (d && lvEnsure(d.id)) return; }
        showRun(); return;
      }
      if (window.Guides) Guides.needAI('Продолжить проверку'); return;
    }
    finished = null;
    if (watching()) { const d = RUN.decks[Math.min(RUN.di, RUN.decks.length - 1)]; if (d) lvEnsure(d.id); }
    loop();
  }
  /** ⏸ / ⏹ take effect at once: the worker becomes stale (an answer on its way is ignored), the card being shown gets its marks */
  function halt() {
    gen++; live = false; pauseReq = false; stopReq = false;
    lskip(); clearInterval(LV.cyc); clearTimeout(LV.readT); think(0);
    const pr = LV.presenting;
    if (pr) { pr.snaps.forEach(s => { if (!pr.shown.has(s.id)) { LV.state[s.id] = stOf(pr.results.find(x => x && x.id === s.id), pr.rd, s.id); refreshRow(s.id); } }); LV.presenting = null; }
    LV.phase = 'idle'; LV.cur = null;
    if (LV.el) { LV.el.classList.remove('reading'); LV.el.querySelectorAll('.aiv-chip.peek').forEach(c => c.classList.remove('peek')); const ex = lq('[data-lv-extra]'); if (ex) ex.innerHTML = ''; }
    rowGlow(null);
  }
  function pause() {
    if (!live || !RUN) return;
    halt();
    RUN.status = 'paused'; RUN.why = ''; saveRun();
    LV._ph = null;
    emit();
  }
  /** «Порциями» ⇄ «По одной карточке» during the check: remembered; the time left is counted anew */
  function setPace(one) {
    one = !!one;
    hubPatch({ pace: one ? 'one' : 'batch' });
    if (!RUN || !!RUN.one === one) { emit(); return; }
    RUN.one = one; RUN.ms = 0; RUN.batches = 0; saveRun();
    if (LV.el && LV.phase === 'read' && one) UI.toast('Со следующей карточки — по одной', '', 2500);
    emit();
  }
  /** ⏹ «Стоп»: right now — what is checked stays saved (and in the report); the rest can be checked later */
  function stop() {
    if (!RUN) return;
    if (live) halt();
    finishRun('stopped');
  }

  /* =====================================================================
   * The floating pill (the person keeps using the app)
   * ===================================================================== */
  function pill() {
    if (!window.Store || !Store.state) return; // the app is still loading (onBadge draws it then)
    let el = document.getElementById('aih-pill');
    const show = RUN || finished;
    // 👀 the check is on the screen right now (the deck page): no pill on top of it
    if (!show || (stageUp() && ((RUN && RUN.view === 'live') || LV.done))) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'aih-pill'; el.className = 'aih-pill';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-pill]');
        const a = b ? b.dataset.pill : 'open';
        e.stopPropagation();
        if (a === 'pause') pause();
        else if (a === 'go') resume();
        else if (a === 'x') { finished = null; pill(); }
        else if (a === 'report') { const id = finished; finished = null; pill(); report(id); }
        else showRun();
      });
    }
    if (!RUN && finished) {
      const rep = getReport(finished), s = rep ? sums(rep) : null;
      el.className = 'aih-pill done';
      el.innerHTML = `<button type="button" class="aih-pill-main" data-pill="report" aria-label="Открыть отчёт нейросети"><span class="aih-pill-ico" aria-hidden="true">✅</span>
        <span class="aih-pill-t"><b>Проверка готова</b><small>${s ? `${s.checked} проверено${s.pending ? ` · ${s.pending} ждут решения` : s.fixed ? ` · ${s.fixed} исправлено` : s.added ? ` · ${s.added} дополнено` : ''}` : 'откройте отчёт'}</small></span></button>
        <button type="button" class="aih-pill-b" data-pill="report" aria-label="Отчёт" data-tip="Отчёт">${repIco()}</button>
        <button type="button" class="aih-pill-b" data-pill="x" aria-label="Скрыть" data-tip="Скрыть">✕</button>`;
      return;
    }
    const p = pct(runDone(), runTotal());
    const st = live ? (pauseReq ? 'pausing' : 'run') : RUN.status === 'limit' ? 'limit' : 'paused';
    const d = RUN.decks[Math.min(RUN.di, RUN.decks.length - 1)];
    const dn = d && Store.deck(d.id) ? Store.deck(d.id).name : '';
    el.className = 'aih-pill ' + st;
    el.style.setProperty('--p', p);
    const wk = st === 'limit' && RUN.wake;
    const label = st === 'run' ? `Проверяю: ${p}%` : st === 'pausing' ? 'Ставлю на паузу…' : wk ? `⏳ Продолжу сам ${atText(RUN.wake.at)}` : st === 'limit' ? `${WHY[RUN.why || 'limit']().icon} Пауза: ${RUN.why === 'limit' ? 'лимит' : RUN.why === 'auth' ? 'нужен вход в Claude' : 'ждёт вас'}` : `⏸ На паузе: ${p}%`;
    el.innerHTML = `<button type="button" class="aih-pill-main" data-pill="open" aria-label="Проверка нейросетью: ${p}% — открыть">
        <span class="aih-pill-ring" aria-hidden="true"><span class="aih-pill-bot">${workLogo(aiId(), { size: 30, on: st === 'run' || st === 'pausing' })}</span></span>
        <span class="aih-pill-t"><b>${esc(label)}</b><small>${esc(dn ? `«${dn}» · ` : '')}${runDone()} из ${runTotal()}</small></span></button>
      ${st === 'run' ? '<button type="button" class="aih-pill-b" data-pill="pause" aria-label="Пауза" data-tip="Пауза">⏸</button>'
        : st === 'pausing' || wk ? '' : '<button type="button" class="aih-pill-b go" data-pill="go" aria-label="Продолжить" data-tip="Продолжить">▶</button>'}
      <span class="aih-pill-bar" aria-hidden="true"><i></i></span>`;
  }

  /* =====================================================================
   * The progress window
   * ===================================================================== */
  /** «Выбрать другую нейросеть»: it becomes the chosen one (first in «Мой порядок» too) and the check goes on with it */
  function useAI(id) {
    if (!window.AI || !AI.PROVIDERS[id]) return;
    Store.setSetting('aiProvider', id);
    if (AI.strategy && AI.strategy() === 'mine') setOpt('aiOrder', [id, ...myOrder().filter(x => x !== id)]);
    if (AI.unrest) AI.unrest(id);
    if (AI.badge) AI.badge();
    if (RUN && !live) { RUN.wake = null; RUN.asking = null; saveRun(); resume(); } else emit();
  }
  function pickOther() {
    if (!window.AI) return;
    const sel = AI.selected();
    const ids = Object.keys(AI.PROVIDERS).filter(id => AI.configured(id) && (!AI.PROVIDERS[id].noKey || id === sel || (AI.onMac && AI.onMac())));
    const row = id => { const u = AI.restUntil(id); return `<button type="button" class="aih-pick${u ? ' rest' : ''}" data-pick="${esc(id)}">${logo(id, 28)}
      <span><b>${esc(AI.PROVIDERS[id].name)}</b><small>${esc(kindTag(id))}${u ? ` · отдыхает до ${hhmm(u)}` : id === sel ? ' · выбрана сейчас' : ''}</small></span></button>`; };
    const m = UI.modal({ title: 'Какой нейросетью продолжить?', cls: 'aih-pick-modal',
      body: `<div class="aih-picks">${ids.map(row).join('') || '<p>Пока подключена только одна нейросеть.</p>'}</div>
        <p class="small muted">Выбранная станет главной, проверка сразу пойдёт дальше. Кто кого заменяет — в ⚙️ Настройках → 🤖 Нейросети.</p>`,
      foot: '<button type="button" class="btn ghost" data-no>Отмена</button><button type="button" class="btn" data-add>➕ Подключить ещё одну</button>' });
    m.el.addEventListener('click', e => {
      const b = e.target.closest('[data-pick]');
      if (b) { m.close(); useAI(b.dataset.pick); return; }
      if (e.target.closest('[data-add]')) { m.close(); App.go('settings'); return; }
      if (e.target.closest('[data-no]')) m.close();
    });
  }
  function showRun() {
    if (!RUN) { if (finished) { const id = finished; finished = null; pill(); report(id); } return; }
    const old = document.querySelector('.aih-run-modal'); if (old) return;
    dropNote();
    const m = UI.modal({ title: `${bot(true)} Проверка нейросетью`, cls: 'aih-run-modal', body: '<div data-run></div>', foot: '<div class="aih-run-foot" data-runfoot></div>',
      onClose: () => subs.delete(draw) });
    const draw = () => {
      if (!m.el.isConnected) { subs.delete(draw); return; }
      if (!RUN) {
        // the run ended while the window was open: its report takes its place
        const id = finished; subs.delete(draw); m.close();
        if (id) { finished = null; pill(); setTimeout(() => report(id), 220); }
        return;
      }
      const rep = getReport(RUN.rid), s = rep ? sums(rep) : { checked: 0, ok: 0, fixed: 0, pending: 0, pendingCards: 0 };
      const done = runDone(), total = runTotal(), p = pct(done, total);
      const d = RUN.decks[Math.min(RUN.di, RUN.decks.length - 1)];
      const deck = d && Store.deck(d.id);
      const st = live ? (pauseReq ? 'pausing' : 'run') : RUN.status === 'limit' ? 'limit' : 'paused';
      const w = st === 'limit' ? WHY[RUN.why || 'limit']() : null;
      const others = RUN.why === 'limit' || RUN.why === 'down' ? Object.keys(AI.PROVIDERS).filter(id => id !== aiId() && AI.configured(id) && !(AI.resting && AI.resting(id))) : [];
      m.$('[data-run]').innerHTML = `
        <div class="aih-run-top ${st}">
          <div class="aih-ring" style="--p:${p}" aria-hidden="true"><b>${p}%</b></div>
          <div class="aih-run-info">
            <div class="aih-run-state">${st === 'run' ? `${workLogo(aiId(), { size: 30, on: true })} ${esc(aiName(aiId()))} проверяет…` : st === 'pausing' ? `${workLogo(aiId(), { size: 30, on: true })} Ставлю на паузу — дождусь ответа на текущую порцию…` : st === 'limit' && RUN.wake ? `⏳ ${esc(wakeTitle())} · <span data-wake-left>${leftText(RUN.wake.at)}</span>` : st === 'limit' ? `${w.icon} ${esc(w.title)}` : '⏸ На паузе'}</div>
            <div class="aih-run-line">🗂 Колода: <b>${esc(deck ? deck.name : '—')}</b> <span class="muted">(${Math.min(RUN.di + 1, RUN.decks.length)} из ${RUN.decks.length})</span></div>
            <div class="aih-run-line">🃏 Карточек: <b>${done}</b> из <b>${total}</b>${d ? ` <span class="muted">· в этой колоде ${Math.min(d.pos, d.ids.length)} из ${d.ids.length}</span>` : ''}</div>
            <div class="aih-run-line">⏱ Осталось: <b>${st === 'run' || st === 'pausing' ? (eta() || 'считаю…') : eta() ? eta() + ' (на паузе)' : '—'}</b></div>
          </div>
        </div>
        <div class="aih-bar" style="--p:${p}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-label="Проверено ${p}%"><i></i></div>
        ${w && RUN.why === 'auth' ? authPanelHtml() : w ? `<div class="aih-why"><b>${w.icon} ${esc(w.title)}</b><p>${esc(w.text)}</p>
          ${others.length ? `<p class="small">Подключены ещё: ${others.map(id => `<button type="button" class="btn sm" data-use="${id}">${logo(id, 18)} ${esc(AI.PROVIDERS[id].short)}</button>`).join(' ')} — нажмите, и проверка продолжится с ней.</p>` : ''}</div>` : ''}
        <div class="aih-run-nums">
          <span class="aih-num"><b>${s.checked}</b><small>проверено</small></span>
          <span class="aih-num good"><b>${s.ok}</b><small>без замечаний</small></span>
          ${RUN.mode === 'auto' ? `<span class="aih-num fix"><b>${s.fixed}</b><small>исправлено</small></span>${s.added ? `<span class="aih-num fix"><b>${s.added}</b><small>дополнено</small></span>` : ''}` : `<span class="aih-num fix"><b>${s.pendingCards}</b><small>с предложениями</small></span>`}
        </div>
        <p class="small muted aih-run-note">${RUN.mode === 'auto' ? '✍️ Ошибки исправляются сразу — каждое изменение можно откатить в отчёте.' : '🙋 Нейросеть только предлагает — вы решите в отчёте, что принять.'} Окно можно закрыть: проверка продолжится, а внизу экрана будет видно, сколько осталось.</p>`;
      m.$('[data-runfoot]').innerHTML = `
        ${st === 'run' ? '<button type="button" class="btn" data-r="pause">⏸ Пауза</button>' : st === 'pausing' ? '<button type="button" class="btn" disabled>⏸ Пауза…</button>' : st === 'limit' && RUN.wake ? '<button type="button" class="btn primary" data-r="pick">Выбрать другую нейросеть</button>' : '<button type="button" class="btn primary" data-r="go">▶ Продолжить</button>'}
        <button type="button" class="btn ghost" data-r="stop">⏹ Остановить</button>
        ${RUN.view !== 'live' ? '<button type="button" class="btn" data-r="watch">👀 Смотреть, как работает</button>' : ''}
        ${s.checked ? `<button type="button" class="btn" data-r="report">${repIco()}Отчёт (что уже готово)</button>` : ''}
        ${w && RUN.why !== 'limit' && RUN.why !== 'odd' && RUN.why !== 'auth' ? '<button type="button" class="btn" data-r="settings">⚙️ Настройки нейросети</button>' : ''}
        ${w && RUN.why === 'limit' && !others.length ? '<button type="button" class="btn" data-r="settings">➕ Подключить ещё одну</button>' : ''}
        <button type="button" class="btn ghost" data-r="hide">Свернуть — учить дальше</button>`;
    };
    subs.add(draw);
    m.el.addEventListener('click', e => {
      const u = e.target.closest('[data-use]');
      if (u) { useAI(u.dataset.use); return; }
      const b = e.target.closest('[data-r]'); if (!b) return;
      const a = b.dataset.r;
      if (a === 'pause') pause();
      if (a === 'go') resume();
      if (a === 'pick') pickOther();
      if (a === 'stop') stop();
      if (a === 'report' && RUN) report(RUN.rid);
      if (a === 'watch') { m.close(); setTimeout(toLive, 200); }
      if (a === 'settings') { m.close(); App.go('settings'); }
      if (a === 'hide') m.close();
    });
    draw();
  }

  /* =====================================================================
   * «📊 Отчёт нейросети»
   * ===================================================================== */
  function report(rid, o = {}) {
    let rep = rid ? getReport(rid) : reports()[0];
    if (!rep) { UI.toast('Отчётов пока нет — запустите проверку в Центре нейросети', 'warn', 4000); return null; }
    rid = rep.id;
    const old = document.querySelector('.aihr-modal');
    if (old && old.closest('.modal-backdrop') && old.closest('.modal-backdrop')._m) old.closest('.modal-backdrop')._m.close();
    let detail = !!o.detail, filter = 'all', q = '';
    const opened = new Set(o.deck ? [o.deck] : []), more = {}, sel = {};
    const key = (id, f) => id + '|' + f;
    const m = UI.modal({ title: `${repIco()}Отчёт нейросети`, cls: 'wide aihr-modal', body: '<div data-rep></div>', foot: '<div class="aihr-foot" data-repfoot></div>',
      onClose: () => subs.delete(sync) });
    const fresh = () => { rep = getReport(rid) || rep; return rep; };
    const save = () => { putReport(rep); emit(); };
    const isRunning = () => RUN && RUN.rid === rid;

    /* which items / fields the filter keeps */
    const fieldsOf = it => {
      let fs = ORDER.filter(f => it.f && it.f[f]);
      if (FILTER_FIELDS[filter]) fs = fs.filter(f => FILTER_FIELDS[filter].includes(f));
      if (filter === 'gender') fs = fs.filter(f => f === 'no');
      if (filter === 'pending') fs = fs.filter(f => it.f[f].st === 'pending');
      return fs;
    };
    const keep = it => {
      if (q) { const hay = `${it.no} ${it.ru} ${Object.values(it.f || {}).map(x => x.new).join(' ')}`.toLowerCase(); if (!hay.includes(q)) return false; }
      if (filter === 'all') return true;
      if (filter === 'issues') return !it.ok && (it.issues || []).length;
      if (filter === 'gender') return (it.f.no && ART(it.f.no.old) !== ART(it.f.no.new)) || (it.issues || []).some(x => /род|артикл|\b(en|ei|et)\b/i.test(x));
      return fieldsOf(it).length > 0;
    };

    const stChip = (st, added) => ({ pending: '<span class="aihr-st pend">⏳ ждёт решения</span>', applied: `<span class="aihr-st ok">✓ ${added ? 'добавлено' : 'исправлено'}</span>`, accepted: '<span class="aihr-st ok">✓ принято</span>',
      rejected: '<span class="aihr-st no">✕ отклонено</span>', undone: '<span class="aihr-st back">↩ откачено</span>' })[st] || '';
    const fieldRow = (it, f) => {
      const x = it.f[f];
      const k = key(it.id, f);
      const checked = sel[k] != null ? sel[k] : !SIDE(f);
      const ctl = x.st === 'pending'
        ? `<label class="aihr-check" data-tip="Отметить — принять это изменение"><input type="checkbox" data-sel="${esc(k)}" ${checked ? 'checked' : ''} aria-label="Принять: ${esc(FNAME[f] || f)}"><span aria-hidden="true"></span></label>`
        : '<span class="aihr-check-sp" aria-hidden="true"></span>';
      const act = x.st === 'applied' || x.st === 'accepted' ? `<button type="button" class="btn sm" data-a="undo-f" data-f="${f}">↩ Откатить</button>`
        : x.st === 'undone' ? `<button type="button" class="btn sm" data-a="redo-f" data-f="${f}">↻ Исправить снова</button>`
        : x.st === 'rejected' ? `<button type="button" class="btn sm" data-a="redo-f" data-f="${f}">✓ Всё-таки принять</button>` : '';
      return `<div class="aihr-f st-${x.st}" data-f="${f}">
          ${ctl}
          <div class="aihr-fbody"><div class="aihr-fn">${esc(FNAME[f] || f)} ${stChip(x.st, !x.old || x.kind === 'alt')}</div>
            <div class="aihr-vals">${x.old ? `<s class="aihr-old" title="Как было">${esc(x.old)}</s>` : '<span class="aihr-empty">было пусто</span>'}<span class="aihr-arrow" aria-hidden="true">→</span><span class="aihr-new" title="Как предлагает нейросеть">${esc(x.new)}</span></div></div>
          ${act ? `<div class="aihr-fact">${act}</div>` : ''}
        </div>`;
    };
    const itemHtml = (it, d) => {
      const fs = fieldsOf(it);
      const all = ORDER.filter(f => it.f && it.f[f]);
      const pend = all.filter(f => it.f[f].st === 'pending').length;
      const appl = all.filter(f => it.f[f].st === 'applied' || it.f[f].st === 'accepted').length;
      return `<div class="aihr-item ${it.ok ? '' : 'bad'} ${it.gone ? 'gone' : ''}" data-card="${esc(it.id)}" data-deck="${esc(d.id)}">
          <div class="aihr-ihead"><span class="aihr-word"><b>${esc(it.no)}</b><span class="muted"> — </span><span class="aihr-ru">${esc(it.ru)}</span></span>
            ${it.gone ? '<span class="aihr-st no">карточка удалена</span>' : `<button type="button" class="btn sm ghost" data-a="open" title="Открыть карточку в редакторе">✏️ Открыть</button>`}</div>
          ${(it.issues || []).length ? `<div class="aihr-issues"><span class="aihr-ilabel">${it.ok ? '💬 Нейросеть заметила' : '⚠️ Что не так'}:</span><ul>${it.issues.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
          ${fs.map(f => fieldRow(it, f)).join('')}
          ${!all.length ? '<div class="small muted">Исправлений нет — только замечание.</div>' : ''}
          ${it.gone || (!pend && !appl) ? '' : `<div class="aihr-iact">
            ${pend ? `<button type="button" class="btn sm good" data-a="acc-card">✓ Принять${pend > 1 ? ' отмеченное' : ''}</button><button type="button" class="btn sm" data-a="rej-card">✕ Отклонить</button>` : ''}
            ${appl ? '<button type="button" class="btn sm" data-a="undo-card">↩ Откатить карточку</button>' : ''}</div>`}
        </div>`;
    };
    const deckHtml = d => {
      const s = deckSums(d);
      const items = d.items.filter(keep);
      const isOpen = opened.has(d.id);
      const lim = more[d.id] || 40;
      if (filter !== 'all' || q) { if (!items.length) return ''; }
      return `<details class="aihr-deck" data-deck="${esc(d.id)}" ${isOpen ? 'open' : ''}>
          <summary><span class="aihr-dname">🗂 ${esc(d.name)}</span>
            <span class="aihr-dnums"><span>✓ ${d.checked}</span>${s.fixed ? `<span class="good">✎ ${s.fixed}</span>` : ''}${s.added ? `<span class="good" title="дополнено: формы и примеры">＋ ${s.added}</span>` : ''}${s.pending ? `<span class="pend">⏳ ${s.pending}</span>` : ''}${filter !== 'all' || q ? `<span class="muted">найдено: ${items.length}</span>` : ''}</span><span class="aihr-chev" aria-hidden="true">›</span></summary>
          ${isOpen ? `<div class="aihr-dbody">
            ${s.pending || s.applied ? `<div class="aihr-dact">
              ${s.pending ? `<button type="button" class="btn sm good" data-a="acc-deck">✓ Принять всё в колоде (${s.pending})</button><button type="button" class="btn sm" data-a="acc-sel" title="Отмеченное — принять, неотмеченное — отклонить">✓ Принять выбранное</button><button type="button" class="btn sm" data-a="rej-deck">✕ Отклонить</button>` : ''}
              ${s.applied ? `<button type="button" class="btn sm" data-a="undo-deck">↩ Откатить всё в колоде</button>` : ''}</div>` : ''}
            ${items.length ? items.slice(0, lim).map(it => itemHtml(it, d)).join('') : `<p class="small muted">${d.checked ? 'В этой колоде нейросеть ничего не нашла — всё в порядке ✓' : 'Эту колоду нейросеть ещё не проверила.'}</p>`}
            ${items.length > lim ? `<button type="button" class="btn" data-a="more">Показать ещё (${items.length - lim})</button>` : ''}
          </div>` : ''}
        </details>`;
    };
    const draw = () => {
      fresh();
      const s = sums(rep);
      const by = (rep.by || []).map(id => `${logo(id, 18)} ${esc(aiName(id))}`).join(', ');
      const when = window.U && U.fmtDate ? U.fmtDate(rep.at) : new Date(rep.at).toLocaleString('ru');
      const run = isRunning();
      const minimal = `<div class="aihr-decks-min">${rep.decks.map(d => { const ds = deckSums(d); return `<button type="button" class="aihr-drow" data-a="deck-open" data-deck="${esc(d.id)}">
          <span class="aihr-dname">🗂 ${esc(d.name)}</span><span class="aihr-dbar" style="--p:${pct(d.checked + d.skipped, d.total)}"><i></i></span>
          <span class="aihr-dnums"><span>✓ ${d.checked}${d.total > d.checked ? `<small> из ${d.total}</small>` : ''}</span>${ds.fixed ? `<span class="good">✎ ${ds.fixed}</span>` : ''}${ds.added ? `<span class="good" title="дополнено: формы и примеры">＋ ${ds.added}</span>` : ''}${ds.pending ? `<span class="pend">⏳ ${ds.pending}</span>` : ''}</span><span class="aihr-chev" aria-hidden="true">›</span></button>`; }).join('')}</div>`;
      m.$('[data-rep]').innerHTML = `
        <div class="aihr-meta">${esc(when)}${by ? ` · ${by}` : ''} · ${rep.mode === 'auto' ? '✍️ исправлялось сразу' : '🙋 сначала показать'}${run ? ` · <b class="aihr-live">${workLogo(aiId(), { size: 20, on: live })} проверка ещё идёт</b>` : rep.status === 'stopped' ? ' · остановлена' : rep.status === 'paused' ? ' · на паузе' : ''}</div>
        <div class="aihr-big">
          <div class="aihr-n"><b>${s.checked}</b><small>проверено</small></div>
          <div class="aihr-n fix"><b>${rep.mode === 'auto' || s.fixed ? s.fixed : s.pendingCards}</b><small>${rep.mode === 'auto' || s.fixed ? 'исправлено' : 'с предложениями'}</small></div>
          ${s.added ? `<div class="aihr-n fix"><b>${s.added}</b><small>верно, дополнено формами${rep.depth === 'card' ? ' и примерами' : ''}</small></div>` : ''}
          <div class="aihr-n good"><b>${s.ok}</b><small>без замечаний</small></div>
          ${s.skipped ? `<div class="aihr-n skip"><b>${s.skipped}</b><small>не ответила — проверим потом</small></div>` : ''}
        </div>
        ${tokTotal(rep.tok) ? `<div class="aihr-tok">🔢 Токены: ${rep.tok.est ? '≈ ' : ''}<b>${fmtN(tokTotal(rep.tok))}</b> (запрос — ${fmtN(rep.tok.in)}, ответ — ${fmtN(rep.tok.out)}${rep.tok.req ? `, ${rep.tok.req} ${plural(rep.tok.req, ['запрос', 'запроса', 'запросов'])}` : ''}${s.checked ? `, ≈ ${fmtN(tokTotal(rep.tok) / s.checked)} на карточку` : ''}) · ${esc(costLine(rep.tok))}
          <small>${rep.tok.est ? 'Часть сервисов не сообщает число токенов — там посчитано примерно (≈ 4 знака на токен). ' : ''}Живой показ токенов не тратит — анимацию рисует приложение.</small></div>` : ''}
        ${s.pending ? `<div class="aihr-pending">⏳ <span>Ждут вашего решения: <b>${s.pending}</b> ${plural(s.pending, ['исправление', 'исправления', 'исправлений'])} в ${s.pendingCards} ${plural(s.pendingCards, ['карточке', 'карточках', 'карточках'])}. Зачёркнуто — как было, <span class="aihr-new">зелёным</span> — как предлагает нейросеть.</span></div>` : ''}
        ${!detail ? `<div class="aihr-label">По колодам</div>${minimal}
          <button type="button" class="btn lg aihr-more-btn" data-a="detail">🔎 Показать подробности${s.items ? ` · ${s.items} ${plural(s.items, ['карточка', 'карточки', 'карточек'])} с замечаниями` : ''}</button>`
        : `<div class="aihr-tools">
            <label class="aihr-search"><span aria-hidden="true">🔎</span><input type="search" data-q placeholder="Найти слово…" value="${esc(q)}" aria-label="Найти слово в отчёте"></label>
            <div class="aihr-filters" role="tablist" aria-label="Что показать">${FILTERS.map(([k, l]) => `<button type="button" class="aihr-chip ${filter === k ? 'on' : ''}" data-filter="${k}" role="tab" aria-selected="${filter === k}">${l}</button>`).join('')}</div>
          </div>
          <div class="aihr-decks">${rep.decks.map(deckHtml).join('') || '<p class="muted center">По этому фильтру ничего нет.</p>'}</div>
          <button type="button" class="btn ghost" data-a="minimal">↑ Коротко</button>`}`;
      m.$('[data-repfoot]').innerHTML = `
        ${s.pending ? `<button type="button" class="btn good" data-a="acc-all">✓ Принять всё (${s.pending})</button>` : ''}
        ${s.applied ? '<button type="button" class="btn" data-a="undo-all">↩ Откатить всё</button>' : ''}
        ${run ? '<button type="button" class="btn" data-a="run">⏳ К проверке</button>' : ''}
        <button type="button" class="btn ghost" data-a="close">Закрыть</button>`;
      const inp = m.$('[data-q]');
      if (inp) inp.oninput = U.debounce ? U.debounce(() => { q = inp.value.trim().toLowerCase(); const pos = inp.selectionStart; draw(); const n = m.$('[data-q]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } } }, 250) : null;
    };
    const sync = () => { if (!m.el.isConnected) { subs.delete(sync); return; } if (isRunning() || !RUN) { const a = document.activeElement; if (a && a.matches && a.matches('[data-q]')) return; const sc = m.$('.modal-body').scrollTop; draw(); m.$('.modal-body').scrollTop = sc; } };
    subs.add(sync);

    /** every (item, field) of a scope */
    const pick = (deckId, cardId) => {
      const out = [];
      rep.decks.forEach(d => { if (deckId && d.id !== deckId) return; d.items.forEach(it => { if (cardId && it.id !== cardId) return; out.push([d, it]); }); });
      return out;
    };
    const fieldsSt = (it, sts) => ORDER.filter(f => it.f && it.f[f] && sts.includes(it.f[f].st));
    const accept = (pairs, onlySel) => {
      let n = 0, r = 0;
      pairs.forEach(([, it]) => {
        const pend = fieldsSt(it, ['pending']);
        const yes = onlySel ? pend.filter(f => { const k = key(it.id, f); return sel[k] != null ? sel[k] : !SIDE(f); }) : pend;
        n += applyFields(it, yes, 'accepted', [(it.issues || []).join('; '), 'принято вами в отчёте'].filter(Boolean).join(' · '));
        if (onlySel) r += rejectFields(it, pend.filter(f => !yes.includes(f)));
      });
      save(); draw();
      UI.toast(n ? `Принято: ${n} ${plural(n, ['исправление', 'исправления', 'исправлений'])}${r ? ` · отклонено: ${r}` : ''} ✓` : r ? `Отклонено: ${r}` : 'Нечего принимать', n || r ? 'good' : '', 3000);
    };
    const reject = pairs => { let r = 0; pairs.forEach(([, it]) => { r += rejectFields(it, fieldsSt(it, ['pending'])); }); save(); draw(); UI.toast(r ? `Отклонено: ${r} — карточки остались как были` : 'Нечего отклонять', '', 3000); };
    const undo = async (pairs, ask) => {
      const n0 = pairs.reduce((n, [, it]) => n + fieldsSt(it, ['applied', 'accepted']).length, 0);
      if (!n0) return;
      if (ask && !(await UI.confirm(`Вернуть, как было, ${n0} ${plural(n0, ['исправление', 'исправления', 'исправлений'])}? Их можно будет снова применить кнопкой «↻ Исправить снова».`, { ok: '↩ Откатить', title: 'Откатить исправления?' }))) return;
      let n = 0, kept = 0;
      pairs.forEach(([, it]) => { const r = undoFields(it, fieldsSt(it, ['applied', 'accepted'])); n += r.n; kept += r.kept; });
      save(); draw();
      UI.toast(`↩ Откачено: ${n}${kept ? ` · ${kept} вы уже изменили сами — их не трогаю` : ''}`, n ? 'good' : 'warn', 4000);
    };

    m.el.addEventListener('change', e => { const c = e.target.closest('[data-sel]'); if (c) sel[c.dataset.sel] = c.checked; });
    m.el.addEventListener('toggle', e => {
      const dt = e.target.closest && e.target.closest('details.aihr-deck'); if (!dt) return;
      const id = dt.dataset.deck;
      if (dt.open && !opened.has(id)) { opened.add(id); const sc = m.$('.modal-body').scrollTop; draw(); m.$('.modal-body').scrollTop = sc; }
      else if (!dt.open && opened.has(id)) opened.delete(id);
    }, true);
    m.el.addEventListener('click', async e => {
      const fb = e.target.closest('[data-filter]'); if (fb) { filter = fb.dataset.filter; rep.decks.forEach(d => { if (d.items.some(keep)) opened.add(d.id); }); draw(); return; }
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a;
      const itEl = b.closest('[data-card]'), dEl = b.closest('[data-deck]');
      const deckId = dEl && dEl.dataset.deck, cardId = itEl && itEl.dataset.card;
      const one = cardId ? pick(deckId, cardId) : [];
      const sc = m.$('.modal-body').scrollTop;
      switch (a) {
        case 'detail': detail = true; draw(); break;
        case 'minimal': detail = false; draw(); break;
        case 'deck-open': detail = true; opened.add(deckId); draw(); setTimeout(() => { const el = m.$(`details.aihr-deck[data-deck="${CSS.escape(deckId)}"]`); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 30); return;
        case 'more': more[deckId] = (more[deckId] || 40) + 80; draw(); break;
        case 'close': m.close(); return;
        case 'run': m.close(); showRun(); return;
        case 'open': if (window.Views && Views.editCard && Store.card(cardId)) Views.editCard(cardId, Store.card(cardId).deckId, () => { if (window.App) App.render(); }); return;
        case 'acc-card': accept(one, true); break;
        case 'rej-card': reject(one); break;
        case 'undo-card': await undo(one, false); break;
        case 'undo-f': { const [[, it]] = one; const r = undoFields(it, [b.dataset.f]); save(); draw(); UI.toast(r.n ? '↩ Вернула, как было' : 'Это поле вы уже изменили сами — не трогаю', r.n ? 'good' : 'warn', 2500); break; }
        case 'redo-f': { const [[, it]] = one; const x = it.f[b.dataset.f]; if (x) x.st = 'pending'; applyFields(it, [b.dataset.f], 'accepted', 'принято вами в отчёте'); save(); draw(); UI.toast('Исправлено ✓', 'good', 2000); break; }
        case 'acc-deck': accept(pick(deckId), false); break;
        case 'acc-sel': accept(pick(deckId), true); break;
        case 'rej-deck': reject(pick(deckId)); break;
        case 'undo-deck': await undo(pick(deckId), true); break;
        case 'acc-all': accept(pick(), false); break;
        case 'undo-all': await undo(pick(), true); break;
        default: return;
      }
      const body = m.$('.modal-body'); if (body) body.scrollTop = sc;
    });
    draw();
    return m;
  }

  /* =====================================================================
   * «🤖 Центр нейросети»
   * ===================================================================== */
  function open(o = {}) {
    const ex = document.querySelector('.aih-modal');
    if (ex) { const bd = ex.closest('.modal-backdrop'); if (bd && bd._m) bd._m.close(); }
    hubPatch({ seen: now() });
    let screen = o.screen || 'main';
    const m = UI.modal({ title: `<span class="aih-title">${bot(aiOn())}<span>Центр нейросети</span></span>`, cls: 'wide aih-modal', body: '<div data-hub></div>', foot: '<div class="aih-foot" data-hubfoot></div>',
      onClose: () => subs.delete(sync) });
    const head = m.$('.modal-head h2');
    const headHtml = head.innerHTML;
    const go = s => { screen = s; draw(); const b = m.$('.modal-body'); if (b) b.scrollTop = 0; };
    const back = t => { head.innerHTML = `<button type="button" class="aih-back" data-h="main" aria-label="Назад — Центр нейросети">‹ <span>${esc(t)}</span></button>`; };

    const statusHtml = () => {
      const on = aiOn(), id = aiId(), P = window.AI ? AI.PROVIDERS : {};
      const st = Store.deckStats(null);
      const p = pct(st.aiChecked, st.total);
      return `<div class="aih-status ${on ? 'on' : 'off'}">
          <div class="aih-who-big">${on ? logo(id, 40) : '<span class="aih-logo-e big" aria-hidden="true">😴</span>'}
            <div><small>${on ? 'Сейчас работает' : 'Нейросеть'}</small><b>${on ? esc((P[id] || {}).name || aiName(id)) : 'ещё не подключена'}</b>
            ${on ? '<button type="button" class="aih-link" data-h="switch">сменить</button>' : ''}</div></div>
          <div class="aih-progress">
            <div class="aih-plabel"><span>Проверено нейросетью: <b>${st.aiChecked}</b> из <b>${st.total}</b></span><span class="muted">${st.total - st.aiChecked ? `не проверено: ${st.total - st.aiChecked}` : 'всё проверено ✓'}</span></div>
            <div class="aih-bar" style="--p:${p}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-label="Проверено нейросетью ${p}%"><i></i></div>
          </div>
        </div>`;
    };
    const tile = (k, icon, title, text, btn, cls = '') => `<div class="aih-tile ${cls}" data-aih="${k}">
        <div class="aih-tile-h"><span class="aih-tile-i" aria-hidden="true">${icon}</span><b>${title}</b></div>
        <p>${text}</p>${btn}</div>`;
    const main = () => {
      const on = aiOn();
      const st = Store.deckStats(null);
      const left = st.total - st.aiChecked;
      const set = Store.settings;
      const exact = set.dictTranslator === 'ai';
      const reps = reports();
      const runCard = RUN ? `<button type="button" class="aih-runcard" data-h="run"><span class="aih-pill-ring" style="--p:${pct(runDone(), runTotal())}" aria-hidden="true"><span class="aih-pill-bot">${bot(live)}</span></span>
          <span><b>${live ? `Идёт проверка: ${pct(runDone(), runTotal())}%` : RUN.status === 'limit' ? `${WHY[RUN.why || 'limit']().icon} Проверка ждёт: ${pct(runDone(), runTotal())}%` : `⏸ Проверка на паузе: ${pct(runDone(), runTotal())}%`}</b>
          <small>${runDone()} из ${runTotal()} · нажмите, чтобы ${live ? 'посмотреть' : 'продолжить'}</small></span><span class="aih-go" aria-hidden="true">›</span></button>` : '';
      return `${o.welcome && on ? `<div class="aih-welcome"><span class="aih-party" aria-hidden="true">🎉</span><div><b>Готово! ${esc(aiName(aiId()))} подключена.</b><span>Вот что она умеет в приложении. Начните с первой кнопки — «Проверить все колоды».</span></div></div>` : ''}
        ${statusHtml()}
        ${runCard}
        ${!on ? `<div class="aih-connect"><p>Нейросеть проверяет перевод, исправляет ошибки и пишет объяснения. Подключить её можно <b>бесплатно за 2 минуты</b> — Google Gemini или Groq.</p>
          <button type="button" class="btn primary lg" data-h="connect">🔑 Подключить бесплатно</button></div>` : ''}
        <div class="aih-label">Что умеет нейросеть — нажмите, с чего начать</div>
        <div class="aih-actions ${on ? '' : 'off'}">
          ${tile('all', '✅', 'Проверить все колоды', `Пройдёт по всем карточкам и найдёт ошибки: неверный перевод, род, артикль, опечатки. ${left ? `Ещё не проверено: <b>${left}</b>.` : 'Всё уже проверено ✓ — можно перепроверить.'}`,
            `<button type="button" class="btn primary lg aih-cta" data-h="all">✅ Проверить все колоды${left ? ` · ${left}` : ''}</button>`, 'main')}
          ${tile('deck', '🗂', 'Проверить одну колоду', 'Выберите колоду — увидите, сколько в ней ещё не проверено.', '<button type="button" class="btn lg aih-cta" data-h="decks">🗂 Выбрать колоду</button>')}
          ${tile('card', '🃏', 'Проверить одну карточку', 'Покажу, где кнопка: в карточке, во время учёбы и в редакторе.', '<button type="button" class="btn lg aih-cta" data-h="card">🃏 Как проверить одну</button>')}
          ${tile('exact', '🌐', 'Точный перевод', `Статьи словарей и тексты переводит нейросеть — по смыслу, а не слово за словом. ${exact ? '<b class="good">Включено ✓</b>' : 'Сейчас переводит обычный переводчик.'}`,
            `<label class="switch aih-sw"><input type="checkbox" data-sw="exact" ${exact ? 'checked' : ''} ${on ? '' : 'disabled'}><span class="track"></span><span>${exact ? 'Переводит нейросеть' : 'Включить точный перевод'}</span></label>`)}
          ${tile('explain', '💡', 'Объяснения к словам', 'Формы слова, примеры и выражения — с переводом в скобках. Только там, где объяснения ещё нет.', '<button type="button" class="btn lg aih-cta" data-h="explain">💡 Добавить объяснения</button>')}
          ${tile('auto', '⚙️', 'Автопроверка новых карточек', 'Новые карточки нейросеть проверит сама — сразу после сохранения или импорта.',
            `<label class="switch aih-sw"><input type="checkbox" data-sw="aiAutoSave" ${set.aiAutoSave ? 'checked' : ''}><span class="track"></span><span>Новые карточки</span></label>
             <label class="switch aih-sw"><input type="checkbox" data-sw="aiAutoImport" ${set.aiAutoImport ? 'checked' : ''}><span class="track"></span><span>После импорта</span></label>`)}
        </div>
        <details class="aih-more"><summary>🤝 Честно о границах и лимитах</summary>${limitsHtml()}</details>
        ${reps.length ? '' : '<p class="small muted aih-nore">После первой проверки здесь появится «📜 Прошлые отчёты».</p>'}`;
    };
    const deckList = kind => {
      const decks = decksWithCards();
      if (!decks.length) return '<p class="muted">Колод с карточками пока нет.</p>';
      return `<p class="small muted">${kind === 'check' ? 'Рядом с колодой — сколько карточек нейросеть ещё не проверяла.' : 'Рядом с колодой — у скольких карточек ещё нет объяснения. Нейросеть допишет его в карточку (формы, примеры, выражения).'}</p>
        <div class="aih-decks">${decks.map(d => {
          const all = Store.cards(d.id);
          const n = kind === 'check' ? all.filter(c => !c.aiChecked).length : all.filter(c => String(c.description || '').length < 120 && !UI.isLong(c.no)).length;
          const p = pct(all.length - n, all.length);
          return `<div class="aih-drow" data-deck="${esc(d.id)}"><div class="aih-dinfo"><b>${esc(d.name)}</b>
              <span class="aih-dbar" style="--p:${p}"><i></i></span>
              <small>${kind === 'check' ? (n ? `не проверено: <b>${n}</b> из ${all.length}` : `все ${all.length} проверены ✓`) : (n ? `без объяснений: <b>${n}</b> из ${all.length}` : 'у всех есть объяснения ✓')}</small></div>
            ${kind === 'check'
              ? (n ? `<button type="button" class="btn primary" data-h="check-deck" title="Только непроверенные карточки (${n}); в окне можно выбрать «Все заново»">✅ Проверить · ${n}</button>` : `<button type="button" class="btn" data-h="recheck-deck" title="Все карточки колоды ещё раз">${sIco('refresh')} Проверить заново · ${all.length}</button>`)
              : (n ? `<button type="button" class="btn primary" data-h="explain-deck">💡 Добавить · ${n}</button>` : '<span class="aih-ok">✓</span>')}</div>`;
        }).join('')}</div>`;
    };
    const cardHow = () => {
      const nm = esc(aiName(aiId()));
      return `<p>Проверить одну карточку можно в трёх местах — кнопка везде одна и та же, с <b>робот-значком</b>:</p>
        <ol class="aih-how">
          <li><span class="aih-how-i" aria-hidden="true">▶</span><div><b>Во время учёбы</b><span>Переверните карточку — внизу кнопка <span class="aih-fake ai">${BOT()} Проверить карту</span>.</span></div></li>
          <li><span class="aih-how-i" aria-hidden="true">🗂</span><div><b>В колоде</b><span>Нажмите на карточку — откроется просмотр, там <span class="aih-fake ai">${BOT()} ${nm}: проверить</span>.</span></div></li>
          <li><span class="aih-how-i" aria-hidden="true">✏️</span><div><b>В редакторе карточки</b><span>Кнопка <span class="aih-fake ai">${BOT()} Проверить</span> рядом с полями: нейросеть заполнит пустое и поправит ошибки.</span></div></li>
        </ol>
        <p class="small muted">Нейросеть сначала покажет, что хочет исправить: зачёркнуто — как было, зелёным — как станет. Вы решаете сами.</p>
        <button type="button" class="btn primary lg" data-h="show-card">👆 Показать на экране</button>`;
    };
    const pastReports = () => {
      const list = reports();
      if (!list.length) return '<p class="muted">Отчётов пока нет. Запустите проверку — отчёт появится здесь.</p>';
      return `<p class="small muted">Здесь хранятся ${MAX_REPORTS} последних отчётов. В каждом можно принять, отклонить или откатить исправления.</p>
        <div class="aih-reps">${list.map(r => { const s = sums(r); const when = window.U && U.fmtDate ? U.fmtDate(r.at) : new Date(r.at).toLocaleString('ru');
          return `<button type="button" class="aih-rep" data-rep="${esc(r.id)}"><span class="aih-rep-i" aria-hidden="true">${r.status === 'done' ? repIco() : RUN && RUN.rid === r.id ? '⏳' : '⏸'}</span>
            <span class="aih-rep-t"><b>${esc(when)} · ${r.decks.length === 1 ? `«${esc(r.decks[0].name)}»` : `${r.decks.length} ${plural(r.decks.length, ['колода', 'колоды', 'колод'])}`}</b>
            <small>проверено ${s.checked}${s.fixed ? ` · исправлено ${s.fixed}` : ''}${s.added ? ` · дополнено ${s.added}` : ''}${s.pending ? ` · <b class="pend">ждут решения ${s.pending}</b>` : ''}${s.ok ? ` · без замечаний ${s.ok}` : ''}${r.status !== 'done' ? (RUN && RUN.rid === r.id ? ' · ещё идёт' : ' · не закончена') : ''}</small></span><span class="aih-go" aria-hidden="true">›</span></button>`; }).join('')}</div>`;
    };
    const draw = () => {
      if (!m.el.isConnected) return;
      const body = m.$('[data-hub]'), foot = m.$('[data-hubfoot]');
      if (screen === 'main') head.innerHTML = headHtml;
      if (screen === 'main') body.innerHTML = main();
      if (screen === 'decks') { back('Проверить одну колоду'); body.innerHTML = deckList('check'); }
      if (screen === 'explain') { back('Объяснения к словам'); body.innerHTML = deckList('explain'); }
      if (screen === 'card') { back('Проверить одну карточку'); body.innerHTML = cardHow(); }
      if (screen === 'reports') { back('Прошлые отчёты'); body.innerHTML = pastReports(); }
      const n = reports().length;
      foot.innerHTML = `${screen !== 'main' ? '<button type="button" class="btn ghost" data-h="main">‹ Назад</button>' : ''}
        ${n && screen !== 'reports' ? `<button type="button" class="btn" data-h="reports" data-aih="reports">📜 Прошлые отчёты (${n})</button>` : ''}
        ${window.Help ? '<button type="button" class="btn" data-h="help">❓ Как с ней работать</button>' : ''}
        <button type="button" class="btn ghost" data-h="close">Закрыть</button>`;
    };
    const sync = () => { if (!m.el.isConnected) { subs.delete(sync); return; } if (screen === 'main' || screen === 'reports') { const b = m.$('.modal-body'), sc = b.scrollTop; draw(); b.scrollTop = sc; } };
    subs.add(sync);
    m.el.addEventListener('change', e => {
      const sw = e.target.closest('[data-sw]'); if (!sw) return;
      const k = sw.dataset.sw;
      if (k === 'exact') {
        Store.setSetting('dictTranslator', sw.checked ? 'ai' : 'auto');
        UI.toast(sw.checked ? `🌐 Теперь словари и тексты переводит ${aiName(aiId())} — по смыслу` : 'Переводит обычный переводчик (Google / DeepL)', 'good', 3500);
      } else {
        Store.setSetting(k, sw.checked);
        UI.toast(sw.checked ? (k === 'aiAutoSave' ? '✓ Новые карточки нейросеть проверит сама' : '✓ Импортированные карточки нейросеть проверит сама') : 'Автопроверка выключена', 'good', 3000);
      }
      draw();
    });
    m.el.addEventListener('click', e => {
      const r = e.target.closest('[data-rep]'); if (r) { report(r.dataset.rep); return; }
      const b = e.target.closest('[data-h]');
      if (!b) {
        // a tap on a tile (not on its button / switch) does what its button does
        const t = e.target.closest('.aih-tile'); if (!t || e.target.closest('label, button, a')) return;
        const btn = t.querySelector('button[data-h]'); if (btn) btn.click();
        return;
      }
      const a = b.dataset.h;
      const dk = b.closest('[data-deck]'), deckId = dk && dk.dataset.deck;
      const need = () => { if (aiOn()) return true; m.close(); if (window.Guides) Guides.needAI('Центр нейросети'); else App.go('settings'); return false; };
      switch (a) {
        case 'main': go('main'); break;
        case 'close': m.close(); break;
        case 'connect': m.close(); if (window.Guides) Guides.needAI('Центр нейросети'); else App.go('settings'); break;
        case 'switch': { const ids = Object.keys(AI.PROVIDERS).filter(id => AI.configured(id));
          const items = ids.map(id => ({ html: `${logo(id, 18)} ${esc(AI.PROVIDERS[id].name)}${aiId() === id ? ' <b style="color:var(--good)">✓</b>' : ''}`, action: () => { Store.setSetting('aiProvider', id); if (App.updateBadge) App.updateBadge(); draw(); UI.toast('Теперь работает: ' + AI.PROVIDERS[id].name, 'good'); } }));
          items.push({ label: '⚙️ Подключить другие нейросети…', action: () => { m.close(); App.go('settings'); } });
          UI.menu(b, items); e.stopPropagation(); break; }
        case 'run': showRun(); break;
        case 'all': if (need()) checkDecks(decksWithCards().map(d => d.id), { from: m }); break;
        case 'decks': if (need()) go('decks'); break;
        case 'check-deck': if (need()) { Store.touchDeck(deckId); checkDecks([deckId], { from: m }); } break; // 🕘 the deck is in work
        case 'recheck-deck': if (need()) { Store.touchDeck(deckId); checkDecks([deckId], { from: m, scope: 'all' }); } break;
        case 'card': go('card'); break;
        case 'show-card': {
          m.close();
          if (!Store.cards().length) { UI.toast('Сначала добавьте хотя бы одну карточку', 'warn'); break; }
          setTimeout(() => { if (window.Help && Help.tour) Help.tour('fix', { intro: false }); }, 260); break; }
        case 'explain': if (need()) go('explain'); break;
        case 'explain-deck': if (need()) { m.close(); setTimeout(() => Views.addExplanations(Store.cards(deckId), true), 220); } break;
        case 'reports': go('reports'); break;
        case 'help': m.close(); setTimeout(() => Help.open('aihub'), 220); break;
        default:
      }
    });
    draw();
    return m;
  }

  /* =====================================================================
   * Connecting: open the hub once, right after the first AI is connected
   * ===================================================================== */
  let was, conT = 0, lastFail = 0, lastKey = 0;
  window.addEventListener('keydown', () => { lastKey = now(); }, true);
  window.addEventListener('input', () => { lastKey = now(); }, true);
  const typing = () => { const a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.type !== 'checkbox') || now() - lastKey < 2500; };
  const blocked = () => !!(document.getElementById('nkp') || (window.Help && Help.now && Help.now())
    || [...document.querySelectorAll('#modal-root > .modal-backdrop:not(.closing)')].some(bd => !bd.querySelector('.aih-modal')));
  function connected(sure) {
    if (hub().auto) return;
    clearTimeout(conT);
    let tries = 0;
    const tryOpen = () => {
      conT = 0;
      if (hub().auto || !aiOn()) return;
      if (!sure && now() - lastFail < 20000) return; // the key was tested and did not work: not now
      if ((!sure && typing()) || blocked()) { if (++tries < 90) conT = setTimeout(tryOpen, 1000); return; }
      hubPatch({ auto: now() });
      open({ welcome: true });
    };
    conT = setTimeout(tryOpen, sure ? 1300 : 3000);
  }
  /** first start with an AI already connected but the hub never seen: our hand points at the robot once */
  function badgeHint() {
    if (hub().seen || hub().badgeHint) return;
    let tries = 0;
    const t = setInterval(() => {
      if (hub().seen || hub().badgeHint || ++tries > 60) { clearInterval(t); return; }
      if (!aiOn() || blocked() || typing() || !window.Help || !Help.coach || (Help.coachSeen && !Help.coachSeen('home'))) return;
      const b = document.getElementById('claude-badge'); if (!b || !b.offsetWidth) return;
      clearInterval(t);
      Help.coach([{ target: '#claude-badge', title: '🤖 Что умеет нейросеть', text: 'Нажмите на робота → «Что умеет нейросеть»: проверка всех колод, точный перевод, объяснения — всё в одном месте.' }], { id: 'aihub-badge', once: true })
        .then(ok => { if (ok) hubPatch({ badgeHint: now() }); });
    }, 3000);
  }
  /** a queue left from the last visit: offer to go on (friendly, never in the way) */
  function offerResume() {
    if (!RUN || live) return;
    pill();
    let tries = 0;
    const t = setInterval(() => {
      if (!RUN || live || ++tries > 40) { clearInterval(t); return; }
      if (document.getElementById('nkp')) return;
      clearInterval(t);
      const p = pct(runDone(), runTotal());
      dropNote(); note = UI.toastAction(`Проверка нейросетью остановилась на ${p}% (${runDone()} из ${runTotal()}). Продолжим?`, '▶ Продолжить', () => resume(), 15000, '🤖');
    }, 1500);
  }
  let booted = false;
  function onBadge(on) {
    if (!booted) { booted = true; was = on; if (RUN) offerResume(); if (on) badgeHint(); return; }
    if (on && !was) connected(false);
    was = on;
  }

  /* =====================================================================
   * Help: topic with an animated demo + coach-mark places
   * ===================================================================== */
  const DEMO = (() => {
    const top = (title, icon) => `<div class="hd-top"><span class="hd-back" aria-hidden="true">‹</span><b>${title}</b><span class="hd-ti">${icon}</span></div>`;
    const sk = (w = 70) => `<i class="hd-sk" style="--w:${w}%"></i>`;
    const row = (icon, a = 64, b = 40) => `<div class="hd-row"><span class="hd-ri">${icon}</span><span class="hd-rt">${sk(a)}${sk(b)}</span></div>`;
    return [
      { s: 0, html: `<div class="hd-appbar"><span class="hd-logo">N</span><b>Norsk Kort</b><span class="grow"></span><span class="hd-pill aihd-bot">${BOT()} Gemini</span></div>
          <div class="hd-body">${row('🃏', 60, 34)}${row('📖', 50, 30)}<div class="aihd-menu"><span class="aihd-mi aihd-hub">${BOT()} <b>Что умеет нейросеть</b></span><span class="aihd-mi">✓ Gemini</span><span class="aihd-mi">⚙️ Подключить другие…</span></div></div>`,
        run: async A => { await A.wait(350); await A.tap('.aihd-bot'); A.add('.aihd-menu', 'on'); await A.wait(500); await A.tap('.aihd-hub'); A.add('.aihd-hub', 'done'); await A.wait(700); } },
      { s: 1, html: top('Центр нейросети', BOT()) + `<div class="hd-body"><div class="aihd-stat"><span>Проверено <b>40</b> из <b>120</b></span><span class="aihd-bar"><i style="--p:33%"></i></span></div>
          <div class="hd-tiles"><span class="hd-tile hd-t"><span class="hd-te">✅</span><b>Все колоды</b></span><span class="hd-tile dim"><span class="hd-te">🗂</span><b>Одна колода</b></span><span class="hd-tile dim"><span class="hd-te">🌐</span><b>Точный перевод</b></span><span class="hd-tile dim"><span class="hd-te">💡</span><b>Объяснения</b></span></div></div>`,
        run: async A => { await A.wait(450); await A.tap('.hd-t'); A.add('.hd-t', 'done'); await A.wait(700); } },
      { s: 2, html: top('Как исправлять?', '🙋') + `<div class="hd-body"><span class="aihd-opt aihd-o1"><b>🙋 Показать мне</b><small>перед исправлением</small></span><span class="aihd-opt aihd-o2"><b>⚡ Исправлять сразу</b><small>всё можно откатить</small></span><span class="hd-btn aihd-go">▶ Начать проверку</span></div>`,
        run: async A => { await A.wait(350); await A.tap('.aihd-o1'); A.add('.aihd-o1', 'on'); await A.wait(450); await A.tap('.aihd-go'); A.add('.aihd-go', 'done'); await A.wait(600); } },
      { s: 3, html: top('Проверка нейросетью', '⏳') + `<div class="hd-body"><div class="aihd-run"><span class="aihd-ring"><b class="aihd-pc">35%</b></span><span class="aihd-lines"><b>🗂 «Еда»</b><small>42 из 120 · ≈ 3 мин</small></span></div>
          <span class="aihd-bar big"><i></i></span><div class="hd-ans"><span class="hd-btn ghost aihd-pause">⏸ Пауза</span><span class="hd-btn ghost">Свернуть</span></div></div>`,
        run: async A => { await A.wait(300); A.add('.aihd-bar', 'go'); for (const v of ['48%', '61%', '74%']) { await A.wait(520); A.text('.aihd-pc', v); } await A.tap('.aihd-pause'); A.text('.aihd-pause', '▶ Продолжить'); A.add('.aihd-run', 'paused'); await A.wait(900); } },
      { s: 4, html: top('Отчёт нейросети', '📊') + `<div class="hd-body"><div class="aihd-nums"><span><b>120</b><small>проверено</small></span><span class="fix"><b>9</b><small>исправлений</small></span><span class="ok"><b>111</b><small>без замечаний</small></span></div>
          <div class="aihd-ch"><small>⚠️ ei jente — это «девочка»</small><span><s>мальчик</s> → <b>девочка</b></span><div class="hd-ans"><span class="hd-btn good aihd-acc">✓ Принять</span><span class="hd-btn ghost">✕ Отклонить</span></div></div>
          <span class="hd-toast good">Принято ✓ · можно откатить</span></div>`,
        run: async A => { await A.wait(500); await A.point('.aihd-ch s', { dy: .7 }); await A.wait(500); await A.tap('.aihd-acc'); A.add('.aihd-ch', 'done'); A.add('.hd-toast', 'on'); await A.wait(1500); } },
    ];
  })();
  const TOPIC = {
    id: 'aihub', icon: '🤖', hue: 24, title: 'Нейросеть: как с ней работать', desc: 'Проверить все колоды, принять исправления или откатить — по шагам.',
    keys: 'нейросеть ии ai центр проверить все колоды отчёт исправления принять откатить лимит пауза продолжить gemini groq claude',
    steps: [['🤖', 'Нажмите на <b>робота</b> вверху → <b>«Что умеет нейросеть»</b>.'],
      ['✅', 'В Центре нейросети нажмите <b>«Проверить все колоды»</b> — или одну колоду.'],
      ['🙋', 'Выберите <b>«Показать мне перед исправлением»</b> — или «Исправлять сразу», если доверяете. <b>«👀 Смотреть, как работает»</b> — и вы увидите каждую карточку, которую проверяет нейросеть.'],
      ['⏸', 'Пока идёт проверка, можно учить дальше. <b>«Пауза»</b> и <b>«Продолжить»</b> — в любой момент, даже завтра.'],
      ['📊', 'В <b>«Отчёте»</b>: зачёркнуто — как было, зелёным — как стало. <b>«Принять»</b> или <b>«↩ Откатить»</b>.']],
    expect: 'Все колоды проверены: перевод точный, род и артикли на месте, опечатки исправлены. Вы видите каждое изменение и решаете сами.',
    limits: 'Нейросеть тоже ошибается — поэтому сначала она показывает, что хочет исправить. У бесплатных нейросетей есть дневной лимит, а Claude по подписке тратит общий лимит Claude Code: кончился лимит — проверка встанет на паузу и продолжится с того же места. Отчёты хранятся на этом устройстве (последние 6).',
    open: ['🤖 Открыть Центр нейросети', () => open()],
    demo: DEMO,
  };
  function addTopic() {
    const H = window.Help;
    if (!H || !Array.isArray(H.TOPICS) || H.TOPICS.some(t => t.id === 'aihub')) return;
    const at = H.TOPICS.findIndex(t => t.id === 'ai');
    if (at >= 0) H.TOPICS.splice(at + 1, 0, TOPIC); else H.TOPICS.push(TOPIC);
  }
  const PLACES = [
    { id: 'aihub', q: false, name: 'Центр нейросети', ctx: 'modal', modal: '.aih-modal', topic: 'aihub', when: '.aih-actions:not(.off)',
      open: () => open(),
      steps: [
        { t: '.aih-status', h: '🤖 Какая нейросеть работает', x: 'Здесь видно, кто проверяет карточки сейчас и сколько уже проверено. «сменить» — выбрать другую подключённую.' },
        { t: '[data-aih="all"] .aih-cta', h: '✅ Проверить все колоды', x: 'Главная кнопка: нейросеть пройдёт по всем колодам. Можно ставить на паузу и продолжать завтра.' },
        { t: '[data-aih="deck"] .aih-cta', h: '🗂 Одна колода', x: 'Не хотите всё сразу — выберите одну колоду.' },
        { t: '.aih-more', h: '🤝 Честно о лимитах', x: 'Сколько можно проверить бесплатно и что будет, если лимит закончится.' },
      ] },
    { id: 'aihub-deck', name: 'Проверка колоды нейросетью', ctx: 'view', view: 'deck', topic: 'aihub',
      when: () => (aiOn() ? [...document.querySelectorAll('#view .toolbar [data-act="ai-check"], #view .toolbar [data-act="deck-more"]')] : []),
      steps: [
        { t: ['.toolbar [data-act="ai-check"]', '.toolbar [data-act="deck-more"]'], h: '🤖 Проверить всё', x: 'В «⋯ Ещё» → «Проверить все карточки»: нейросеть проверит перевод, род и написание этой колоды — и покажет, что хочет исправить.' },
        { t: '[data-act="filter"][data-f="noai"]', h: '🤖 Не проверены', x: 'Покажет карточки, которые нейросеть ещё не смотрела. Проверенные получают значок нейросети.' },
      ] },
    { id: 'aihub-report', name: 'Отчёт нейросети', ctx: 'modal', modal: '.aihr-modal', topic: 'aihub', when: '.aihr-big',
      open: () => report(),
      steps: [
        { t: '.aihr-big', h: '📊 Коротко', x: 'Сколько проверено, сколько исправлено и сколько карточек в порядке.' },
        { t: ['.aihr-drow', '.aihr-deck summary'], h: '🗂 По колодам', x: 'Нажмите на колоду — увидите каждую карточку: что было, что стало и почему.' },
        { t: ['.aihr-more-btn', '.aihr-filters'], h: '🔎 Подробности', x: 'Можно показать только переводы, только род или найти слово.' },
        { t: ['[data-a="acc-all"]', '[data-a="undo-all"]'], h: '✓ Принять или ↩ откатить', x: 'Принимайте всё сразу или по одной. Любое исправление можно вернуть, как было.' },
      ] },
  ];
  function addPlaces() {
    const C = window.CoachMarks;
    if (!C || !Array.isArray(C.PLACES)) return;
    PLACES.forEach(p => { if (!C.PLACES.some(x => x.id === p.id)) C.PLACES.push(p); });
  }

  /* =====================================================================
   * 🌀 Living logos: every AI and translator has its own «working» animation, in its own colours.
   *    workLogo(key, { size, on }) — key: an AI id ('claude', 'gemini'…), a translator ('google', 'deepl'…) or 'ai:<id>'.
   *    Claude: its real filled spark, slowly turning and gently pulsing with a warm glow; the others: their coin
   *    (App.aiLogo) with a motion of its own and a flowing halo in the brand colours. Reduced motion → a calm still glow.
   * ===================================================================== */
  const BRAND = {
    claude: ['#d97757', '#f2a27e', '#b9583a'], openai: ['#d6d8e2', '#ffffff', '#3a3a42'], gemini: ['#4b8dff', '#8e6cf0', '#d26fd0'],
    deepseek: ['#4d6bfe', '#93a4ff', '#2f4fe0'], groq: ['#f55036', '#ff9c6e', '#d0371f'], openrouter: ['#6467f2', '#a0a2ff', '#4447c9'],
    mistral: ['#ffb000', '#fa520f', '#e10500'], cohere: ['#ff9f84', '#c9b8ff', '#39594d'], nvidia: ['#76b900', '#b0e45a', '#4f8000'],
    zai: ['#6b74ff', '#a9adff', '#3a3f8f'], xai: ['#a2aabd', '#eceff6', '#5d6577'], pollinations: ['#d9ee5a', '#4bbf73', '#1f5b3a'],
    ollama: ['#c9ccd6', '#ffffff', '#8a8f9e'], custom: ['#8b80ff', '#29c7ff', '#b4acff'],
    google: ['#4285f4', '#34a853', '#fbbc05'], deepl: ['#2f8cff', '#7fb8ff', '#0f2b46'], microsoft: ['#00a4ef', '#7fba00', '#f25022'],
    mymemory: ['#ef7d22', '#ffb36b', '#c25a0c'], mozhi: ['#2f9e8f', '#7fd6c9', '#1d6b61'],
  };
  BRAND.anthropic = BRAND.claude;
  BRAND.chatgpt = BRAND.openai; BRAND['gemini-cli'] = BRAND.gemini; // the same company's subscription entries (js/ai.js)
  /** translators: a plain letter on their colour (own simple drawings, no downloaded artwork) */
  const TR_COIN = { google: ['#4285f4', 'G'], deepl: ['#0f2b46', 'D'], microsoft: ['#0078d4', 'M'], mymemory: ['#e8742a', 'M'], mozhi: ['#2f8f83', '文'] };
  const wkey = p => {
    p = String(p || '');
    if (p === 'ai' || p === 'ai:') return (window.AI && AI.current()) || 'custom';
    if (p.startsWith('ai:')) return p.slice(3) || 'custom';
    if (p.startsWith('tr:')) return p.slice(3);
    return p || 'custom';
  };
  const isAIKey = k => !!(window.AI && AI.PROVIDERS && AI.PROVIDERS[k]);
  const wname = p => {
    const k = wkey(p);
    if (isAIKey(k)) return AI.PROVIDERS[k].short;
    const t = window.Translators && Translators.LIST && Translators.LIST[k];
    return t ? t.name : 'Переводчик';
  };
  const brandVars = p => { const b = BRAND[wkey(p)] || BRAND.custom; return `--g1:${b[0]};--g2:${b[1]};--g3:${b[2]}`; };
  /** Claude: the real filled spark (path: Simple Icons «claude», CC0) — the same drawing as App.aiLogo('claude').
   *  <g class="aiw-spark"> turns and <g class="aiw-spark-p"> pulses (CSS, around the coin's centre); the path inside is sized for the coin. */
  const SPARK = `<g class="aiw-spark"><g class="aiw-spark-p"><path transform="translate(12 12) scale(.68) translate(-12 -12)" fill="#fff" stroke="#fff" stroke-width=".4" stroke-linejoin="round" d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/></g></g>`;
  function workLogo(p, o = {}) {
    const k = wkey(p), s = o.size || 26;
    let core;
    if (k === 'claude' || k === 'anthropic') {
      core = `<span class="aib-i aiw-coin" style="--c:#d97757"><svg viewBox="0 0 24 24" aria-hidden="true">${SPARK}</svg></span>`;
    } else if (isAIKey(k) && window.App && App.aiLogo) {
      core = App.aiLogo(k, ' aiw-coin');
    } else {
      const t = TR_COIN[k] || ['#5b6bff', '文A'];
      core = `<span class="aib-i aiw-coin" style="--c:${t[0]}"><svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="${t[1].length > 1 ? 15.6 : 16.4}" text-anchor="middle" font-size="${t[1].length > 1 ? 9.5 : 12.5}" font-weight="800" font-family="system-ui, -apple-system, Segoe UI, sans-serif" fill="#fff">${esc(t[1])}</text></svg></span>`;
    }
    return `<span class="aiw aiw-p-${esc(k)}${o.on ? ' on' : ''}${o.cls ? ' ' + o.cls : ''}" style="--s:${s}px;${brandVars(k)}" aria-hidden="true"><span class="aiw-halo"></span>${core}</span>`;
  }

  /** 📺 the same coin for OUR TV page (receiver.html draws it itself): { k, n, bg, svg, g } — plain data, no markup around it.
   *  bg: the coin's colour (or gradient), svg: what is inside the coin's <svg viewBox="0 0 24 24">, g: the halo's colours. */
  function tvCoin(p) {
    const k = wkey(p), b = BRAND[k] || BRAND.custom;
    let bg = '#5b6bff', svg = '';
    if (k === 'claude' || k === 'anthropic') {
      bg = '#d97757'; svg = SPARK;
    } else if (isAIKey(k) && window.App && App.aiLogo) {
      const t = document.createElement('template'); t.innerHTML = App.aiLogo(k);
      const c = t.content.firstElementChild, s = c && c.querySelector('svg');
      bg = (c && c.style.getPropertyValue('--c').trim()) || bg; svg = s ? s.innerHTML : '';
    } else {
      const t = TR_COIN[k] || ['#5b6bff', '文A'];
      bg = t[0];
      svg = `<text x="12" y="${t[1].length > 1 ? 15.6 : 16.4}" text-anchor="middle" font-size="${t[1].length > 1 ? 9.5 : 12.5}" font-weight="800" font-family="system-ui, -apple-system, Segoe UI, sans-serif" fill="#fff">${esc(t[1])}</text>`;
    }
    return { k: k === 'anthropic' ? 'claude' : k, n: wname(p), bg, svg, g: b.slice(0, 3) };
  }

  /* ---------- who is working right now (AI calls, translators) → the living logos everywhere ---------- */
  const Work = (() => {
    const jobs = new Map(), lastBy = {}, fns = new Set();
    let seq = 0, raf = 0;
    const fire = () => {
      if (raf) return;
      const run = () => { raf = 0; fns.forEach(f => { try { f(); } catch (e) { console.warn('aihub work', e); } }); };
      raf = window.requestAnimationFrame ? requestAnimationFrame(run) : setTimeout(run, 16);
    };
    const match = (j, kinds) => !kinds || kinds.split(',').includes(j.kind);
    return {
      begin(p, kind) { const id = ++seq; jobs.set(id, { p: p || '', kind }); if (p) lastBy[kind] = p; fire(); return id; },
      set(id, p) { const j = jobs.get(id); if (j && p && j.p !== p) { j.p = p; lastBy[j.kind] = p; fire(); } },
      end(id) { if (jobs.delete(id)) fire(); },
      cur(kinds) { let out = null; jobs.forEach(j => { if (match(j, kinds) && j.p) out = j; }); return out; },
      last(kinds) { return (kinds || '').split(',').map(k => lastBy[k]).filter(Boolean)[0] || null; },
      on(fn) { fns.add(fn); },
      fire,
    };
  })();
  function hookWork() {
    if (window.AI && AI.call && !AI._aiwHook) {
      AI._aiwHook = true;
      const call = AI.call;
      AI.call = async function (...a) {
        const id = Work.begin(this.current ? this.current() : '', 'ai');
        try { return await call.apply(this, a); } finally { Work.set(id, this.lastProvider); Work.end(id); }
      };
    }
    if (window.Translators && Translators._translateMany && !Translators._aiwHook) {
      Translators._aiwHook = true;
      const tm = Translators._translateMany;
      Translators._translateMany = function (src, from, to, out, by, todo, put, opts) {
        const id = Work.begin(this.dictMain ? this.dictMain() : 'google', 'tr');
        const put2 = (i, t, who) => { Work.set(id, who === 'ai' ? 'ai:' + ((window.AI && (AI.lastProvider || AI.current())) || '') : who); return put(i, t, who); };
        return Promise.resolve(tm.call(this, src, from, to, out, by, todo, put2, opts)).finally(() => Work.end(id));
      };
    }
    if (window.Study && Study.aiGloss && !Study._aiwHook) {
      Study._aiwHook = true;
      const g = Study.aiGloss;
      Study.aiGloss = function (...a) {
        const id = Work.begin('ai:' + ((window.AI && AI.current()) || ''), 'tr');
        return Promise.resolve(g.apply(this, a)).finally(() => Work.end(id));
      };
    }
  }
  /** every [data-aiw-live="tr"] on the screen shows who translates now (living logo) — or, idle: the last one (still) or a calm TV */
  function paintWork() {
    document.querySelectorAll('[data-aiw-live]').forEach(el => {
      const kinds = el.dataset.aiwLive, idle = el.dataset.aiwIdle || '';
      const j = Work.cur(kinds);
      const p = j ? j.p : idle === 'last' ? Work.last(kinds) : null;
      const key = (j ? 'on:' : 'off:') + (p || idle);
      if (el._aiwKey === key) return;
      el._aiwKey = key;
      const lab = el.dataset.aiwLabel != null;
      el.classList.toggle('aiw-host', !!p);
      if (!p) {
        el.classList.remove('on');
        if (idle === 'hg') { el.hidden = false; el.textContent = '⏳'; return; }
        if (idle === 'tv') { el.hidden = false; el.innerHTML = `<span class="aiw-tv">${window.UI && UI.TV_SVG ? UI.TV_SVG(26) : '📺'}</span>`; } else { el.hidden = true; el.innerHTML = ''; }
        return;
      }
      el.hidden = false;
      el.classList.toggle('on', !!j);
      el.style.cssText = brandVars(p);
      const nm = wname(p);
      el.innerHTML = workLogo(p, { size: +(el.dataset.aiwSize || 22), on: !!j })
        + (lab ? `<span class="aiw-lab">${j ? `${esc(nm)} переводит…` : `Переводит ${esc(nm)}`}</span>` : '');
      el.title = j ? `Сейчас переводит ${nm}` : `Субтитры переводит ${nm}`;
    });
    paintBadge();
  }
  Work.on(paintWork);
  /** the robot in the top bar: a glowing ring in the colours of whoever works, eyes that read */
  function paintBadge() {
    const b = document.getElementById('claude-badge');
    if (!b) return;
    const j = Work.cur();
    const busy = live || !!j;
    b.classList.toggle('aiw-busy', busy);
    if (busy) { const v = brandVars(live ? aiId() : j.p).split(';'); v.forEach(x => { const [k, val] = x.split(':'); b.style.setProperty(k, val); }); }
  }

  /* =====================================================================
   * ✓ «Проверено нейросетью» marks on the cards: the logo of the AI + a small green ✓, one per side
   *   (card.aiCheck = { by, front, back, byFront, byBack, fixed } — js/store.js keeps it clean and takes a side away when its text is edited;
   *   each side names the AI that checked it, `by` = the last one, for cards checked before v223)
   * ===================================================================== */
  const FACE = () => (window.Store && Store.AI_FACE) || { front: ['no', 'example'], back: ['ru', 'uk', 'exampleRu', 'description'] };
  const FSHORT = { no: 'слово', example: 'пример', ru: 'перевод', uk: 'перевод на украинский', exampleRu: 'перевод примера', description: 'объяснение' };
  const fixedOf = (a, side) => FACE()[side === 'no' ? 'front' : 'back'].filter(f => a.fixed && a.fixed[f]).map(f => [f, a.fixed[f]]);
  // «было пусто» is no fix: the AI ADDED that field (an example, its translation…)
  const fixesOf = (a, side) => fixedOf(a, side).filter(([, v]) => String(v.o || '').trim());
  const addsOf = (a, side) => fixedOf(a, side).filter(([, v]) => !String(v.o || '').trim());
  /** the AI that checked this side (cards checked before v223 know only the last one: `by`) */
  const whoOf = (a, side) => (side === 'no' ? a.byFront : a.byBack) || a.by;
  const fmtDay = ts => {
    const d = new Date(ts), y = d.getFullYear() !== new Date().getFullYear();
    try { return d.toLocaleDateString('ru-RU', y ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long' }); } catch (e) { return d.toLocaleDateString(); }
  };
  function markHtml(card, side, o = {}) {
    const a = card && card.aiCheck;
    if (!a) return '';
    const ts = side === 'no' ? a.front : a.back;
    if (!ts) return '';
    const who = whoOf(a, side), fx = fixesOf(a, side).length, add = addsOf(a, side).length;
    const label = `Проверено нейросетью ${wname(who)}${fx ? ' и исправлено' : add ? ' и дополнено' : ''}. Нажмите — расскажу подробнее`;
    return `<button type="button" class="aim${o.cls ? ' ' + o.cls : ''}${fx ? ' fixed' : ''}" data-aimark="${side}" data-card="${esc(card.id)}" title="${esc(label)}" aria-label="${esc(label)}">`
      + `${workLogo(who, { cls: 'aim-coin' })}<span class="aim-ok" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M2.5 6.3 5 8.7l4.5-5.2"/></svg></span></button>`;
  }
  /** a gallery tile shows both sides at once: one mark for the card (a tap tells about both sides) */
  function marksPair(card, cls) {
    const m = markHtml(card, 'no', { cls }) || markHtml(card, 'tr', { cls });
    return m ? `<span class="aim-pair">${m}</span>` : '';
  }
  /** a tap on a mark: what was checked, when, by which AI, and what was fixed / added — in plain words */
  function explainMark(id, side) {
    const c = Store.card(id);
    if (!c || !c.aiCheck) return;
    const a = c.aiCheck;
    const what = sd => (sd === 'no' ? 'написание верное' : 'перевод верный');
    const line = sd => {
      const ts = sd === 'no' ? a.front : a.back;
      if (!ts) return '';
      const fx = fixesOf(a, sd), add = addsOf(a, sd);
      const said = [fx.length ? `исправлено — ${fx.map(([f, v]) => `${FSHORT[f]}: было «${v.o}», стало «${v.n}»`).join('; ')}` : what(sd),
        add.length ? `добавлено — ${add.map(([f, v]) => `${FSHORT[f]}: «${v.n}»`).join('; ')}` : ''].filter(Boolean).join('; ');
      return `Проверено нейросетью ${wname(whoOf(a, sd))} ${fmtDay(ts)}: ${said}`;
    };
    const row = sd => {
      const ts = sd === 'no' ? a.front : a.back;
      const head = sd === 'no' ? '🇳🇴 Норвежская сторона' : '🇷🇺 Сторона с переводом';
      if (!ts) return `<div class="aim-row off"><b>${head}</b><span>Пока без отметки: её текст изменили после проверки — эту правку нейросеть ещё не видела.</span></div>`;
      const fx = fixesOf(a, sd), add = addsOf(a, sd), when = `${fmtDay(ts)} · ${esc(wname(whoOf(a, sd)))}`;
      return `<div class="aim-row${fx.length ? ' fx' : ''}"><b>${head}</b><span>${fx.length ? `${when} — исправлено:` : `${when} — ${what(sd)} ✓${add.length ? ', добавлено:' : ''}`}</span>
        ${fx.map(([f, v]) => `<span class="aim-fx"><small>${esc(FSHORT[f])}:</small> было <s>${esc(v.o)}</s> → стало <b>${esc(v.n)}</b></span>`).join('')}
        ${add.map(([f, v]) => `<span class="aim-fx"><small>${esc(FSHORT[f])}:</small> ${fx.length ? 'добавлено ' : ''}<b>${esc(v.n)}</b></span>`).join('')}</div>`;
    };
    const other = side === 'no' ? 'tr' : 'no';
    const m = UI.modal({
      title: '✓ Проверено нейросетью', cls: 'narrow aim-modal',
      body: `<div class="aim-who">${workLogo(whoOf(a, line(side) ? side : other), { size: 46 })}<p>${esc(line(side) || line(other))}.</p></div>
        <div class="aim-word"><b>${esc(first(c.no))}</b> — <span>${esc(first(c.ru))}</span></div>
        ${row(side)}${row(other)}
        <p class="small muted aim-note">Если изменить текст карточки, отметка на этой стороне исчезнет: эту правку нейросеть ещё не видела.</p>`,
      foot: '<button type="button" class="btn primary" data-aim-ok>Понятно</button>',
    });
    m.$('[data-aim-ok]').onclick = () => m.close();
  }
  window.addEventListener('click', e => {
    const b = e.target && e.target.closest && e.target.closest('[data-aimark]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    explainMark(b.dataset.card, b.dataset.aimark);
  }, true);
  // a tap on a mark must not also flip / swipe the card under it
  ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup'].forEach(t => window.addEventListener(t, e => {
    if (e.target && e.target.closest && e.target.closest('[data-aimark]')) e.stopPropagation();
  }, true));

  /* =====================================================================
   * 👀 «Смотреть, как работает»: the check before the person's eyes, on the deck page.
   *  - while a real portion (12 cards) is with the AI: a reading pass over exactly those cards (that is what happens);
   *  - when the answer comes: card by card — the glowing frame, the reading line, the flip, the fix typed in, the ✓ mark;
   *  - review mode: a fix waits on the card for «Принять / Оставить как было» (or goes on and waits in the report).
   * ===================================================================== */
  const reduceMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const T = ms => Math.round(ms * (reduceMotion() ? 0.6 : 1) * (LV.speed || 1));
  /** «Скорость показа»: only the animation of the stage — the AI works the same (remembered) */
  const SPEEDS = { calm: 1.6, norm: 1, fast: 0.45 };
  const speedKey = () => (SPEEDS[hub().show] ? hub().show : 'norm');
  const LV = { speed: 1, el: null, deck: null, snaps: [], state: {}, cyc: 0, readT: 0, phase: 'idle', skip: false, wakers: new Set(), bypass: false, done: null, cur: null, line: '', presenting: null };
  const watching = () => !!(RUN && RUN.view === 'live');
  const stageUp = () => !!(LV.el && LV.el.isConnected && document.visibilityState !== 'hidden');
  const lwait = ms => new Promise(res => {
    const g = gen;
    if (LV.skip || !ms) { res(); return; }
    let t = 0;
    const done = () => { clearTimeout(t); LV.wakers.delete(done); if (g === gen) res(); }; // ⏸ / ⏹: the old show stops right here
    t = setTimeout(done, ms); LV.wakers.add(done);
  });
  function lskip() { LV.skip = true; [...LV.wakers].forEach(f => f()); }
  const snap = c => ({ id: c.id, no: String(c.no || ''), example: String(c.example || ''), ru: String(c.ru || ''), exampleRu: String(c.exampleRu || ''), description: String(c.description || '') });
  const clip = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s; };
  const LV_FIELDS = { no: v => first(v), example: v => clip(first(v), 140), ru: v => first(v), exampleRu: v => clip(first(v), 140), description: v => clip(String(v).replace(/\s+/g, ' ').trim(), 170) };

  function stageEl() {
    const el = document.createElement('section');
    el.className = 'aiv';
    el.setAttribute('aria-label', 'Нейросеть проверяет колоду');
    el.innerHTML = `
      <svg class="aiv-traces" data-lv-traces aria-hidden="true" focusable="false"></svg>
      <div class="aiv-head">
        <span class="aiv-logo" data-lv-logo></span>
        <div class="aiv-title"><b data-lv-title></b><small data-lv-state role="status" aria-live="polite"></small><span class="aiv-sw" data-lv-sw hidden></span></div>
        <div class="aiv-ctl" data-lv-ctl></div>
      </div>
      <div class="aiv-prog"><span class="aiv-bar" aria-hidden="true"><i data-lv-bar></i></span><small data-lv-count></small></div>
      <div class="aiv-tok" data-lv-tok hidden></div>
      <div class="aiv-pace" data-lv-pace role="radiogroup" aria-label="Как отправлять нейросети" hidden>
        <button type="button" role="radio" data-lv-one="0" title="Нейросеть получает сразу несколько карточек — так быстрее и дешевле">Порциями <small>быстрее, дешевле</small></button>
        <button type="button" role="radio" data-lv-one="1" title="Каждая карточка — отдельный запрос: медленнее и дороже, зато всё видно сразу">По одной карточке <small>полностью вживую</small></button>
      </div>
      <div class="aiv-speed" data-lv-speed role="radiogroup" aria-label="Скорость показа — меняет только анимацию" hidden>
        <span class="aiv-speed-l">Скорость показа</span>
        <span class="aiv-speed-b"><button type="button" role="radio" data-lv-sp="calm">спокойно</button><button type="button" role="radio" data-lv-sp="norm">обычно</button><button type="button" role="radio" data-lv-sp="fast">быстро</button></span>
        <small>только анимация — нейросеть работает так же</small>
      </div>
      <div class="aiv-help" data-lv-help hidden></div>
      <div class="aiv-main" data-lv-main>
        <div class="aiv-left">
          <div class="aiv-cardwrap">
            <span class="aiv-blur" aria-hidden="true"></span><span class="aiv-ring" aria-hidden="true"></span>
            <div class="aiv-card" data-lv-card>
              <div class="aiv-face front"><span class="aiv-tag">🇳🇴 Норвежский</span>
                <div class="aiv-f big" data-lf="no" lang="no"></div><div class="aiv-f small" data-lf="example" lang="no"></div>
                <span class="aiv-scan" aria-hidden="true"></span><span class="aiv-stamp" data-lv-stamp="no"></span></div>
              <div class="aiv-face back"><span class="aiv-tag">🇷🇺 Перевод</span>
                <div class="aiv-f big" data-lf="ru"></div><div class="aiv-f small" data-lf="exampleRu"></div><div class="aiv-f desc" data-lf="description"></div><div class="aiv-forms" data-lv-forms hidden></div>
                <span class="aiv-scan" aria-hidden="true"></span><span class="aiv-stamp" data-lv-stamp="tr"></span></div>
            </div>
          </div>
          <div class="aiv-think" data-lv-think hidden role="status"><span class="aiv-think-logo" data-lv-think-logo></span><span class="aiv-think-t"><b data-lv-think-t></b><small data-lv-think-s></small></span><span class="aiv-dots" aria-hidden="true"><i></i><i></i><i></i></span></div>
          <div class="aiv-extra" data-lv-extra></div>
        </div>
        <div class="aiv-side"><div class="aiv-side-h">Эта порция</div><div class="aiv-strip" data-lv-strip role="list" aria-label="Карточки этой порции"></div></div>
      </div>`;
    LV.speed = SPEEDS[speedKey()];
    // the traces follow the card as it grows (forms, examples) and the queue as it scrolls
    let trF = 0;
    const trSoon = () => { if (!trF) trF = requestAnimationFrame(() => { trF = 0; traces(); }); };
    const strip = el.querySelector('[data-lv-strip]');
    if (strip) strip.addEventListener('scroll', trSoon, { passive: true });
    if (window.ResizeObserver) { if (LV.ro) LV.ro.disconnect(); const ro = LV.ro = new ResizeObserver(trSoon); ro.observe(el); const cw = el.querySelector('.aiv-cardwrap'); if (cw) ro.observe(cw); }
    // the person scrolls by hand: the stage stops following the writing for 4 seconds
    if (!LV.userHook) {
      LV.userHook = true;
      const mark = () => { LV.userAt = now(); };
      window.addEventListener('wheel', mark, { passive: true });
      window.addEventListener('touchmove', mark, { passive: true });
      window.addEventListener('keydown', e => { if (/^(PageUp|PageDown|ArrowUp|ArrowDown|Home|End| )$/.test(e.key) && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) mark(); });
      window.addEventListener('resize', () => traces());
    }
    el.addEventListener('click', e => {
      const p = e.target.closest('[data-lv-one]');
      if (p) { setPace(p.dataset.lvOne === '1'); return; }
      const sp = e.target.closest('[data-lv-sp]');
      if (sp) { hubPatch({ show: sp.dataset.lvSp }); LV.speed = SPEEDS[speedKey()]; drawHead(); return; }
      const b = e.target.closest('[data-lv]');
      if (!b) return;
      const a = b.dataset.lv;
      if (a === 'pause') pause();
      else if (a === 'go') resume();
      else if (a === 'fast') toFast(false);
      else if (a === 'pick') pickOther();
      else if (a === 'stop') stop();
      else if (a === 'report') report(LV.done ? LV.done.rid : RUN && RUN.rid);
      else if (a === 'later') { LV.done = null; if (LV.el) LV.el.remove(); LV.el = null; rowGlow(null); pill(); UI.toast('В следующий раз нейросеть начнёт с непроверенных карточек', '', 4000); }
      else if (a === 'close') { LV.done = null; if (LV.el) LV.el.remove(); LV.el = null; rowGlow(null); pill(); }
    });
    return el;
  }
  const lq = s => (LV.el ? LV.el.querySelector(s) : null);
  function lvState(t) { LV.line = t; const s = lq('[data-lv-state]'); if (s && LV.el.dataset.st === 'run') s.textContent = t; }
  /** the top of the stage: who, which deck, progress, the buttons (redrawn when the queue moves) */
  function drawHead() {
    if (!LV.el) return;
    let st, title, line, p = 0, cnt = '', by = aiId();
    if (RUN) {
      st = live ? (pauseReq ? 'pausing' : 'run') : RUN.status === 'limit' ? 'limit' : 'paused';
      const d = RUN.decks[Math.min(RUN.di, RUN.decks.length - 1)], deck = d && Store.deck(d.id);
      title = `${aiName(by)} проверяет ${deck ? `«${deck.name}»` : 'колоду'}`;
      if (st === 'limit' && RUN.why === 'auth') { by = 'claude'; title = `Проверка ${deck ? `«${deck.name}»` : 'колоды'} ждёт входа в Claude`; }
      else if (st === 'limit' && RUN.wake) { if (RUN.wake.id) by = RUN.wake.id; title = wakeTitle(); }
      else if (st === 'paused') title = `Проверка ${deck ? `«${deck.name}»` : 'колоды'} на паузе`;
      p = pct(runDone(), runTotal());
      cnt = `${runDone()} из ${runTotal()}${st === 'run' && eta() ? ` · осталось ${eta()}` : ''}${RUN.decks.length > 1 ? ` · колода ${Math.min(RUN.di + 1, RUN.decks.length)} из ${RUN.decks.length}` : ''}`;
      line = st === 'pausing' ? 'Ставлю на паузу — дождусь ответа на эту порцию…'
        : st === 'limit' && RUN.why === 'auth' ? 'Это пара минут — ниже по шагам. Всё проверенное сохранено.'
        : st === 'limit' && RUN.wake ? `Продолжу ${leftText(RUN.wake.at)} — нажимать ничего не нужно. Всё проверенное сохранено.`
        : st === 'limit' ? `${WHY[RUN.why || 'limit']().title}. Всё проверенное сохранено.`
        : st === 'paused' ? 'На паузе. Всё проверенное сохранено — нажмите «▶ Продолжить».' : LV.line || 'Начинаю…';
    } else if (LV.done) {
      st = 'done';
      const rep = getReport(LV.done.rid), s = rep ? sums(rep) : null;
      if (rep && rep.by && rep.by[0]) by = rep.by[0];
      title = LV.done.status === 'done' ? 'Готово — колода проверена ✓' : 'Проверка остановлена';
      line = s ? `Проверено ${LV.done.status === 'done' ? cardsN(s.checked) : `${s.checked} из ${rep.total}`}${s.fixed ? ` · исправлено ${s.fixed}` : ''}${s.added ? ` · дополнено формами ${s.added}` : ''}${s.pending ? ` · ждут вашего решения ${s.pending}` : ''}${s.ok ? ` · без замечаний ${s.ok}` : ''}` : '';
      p = rep ? pct(s.checked + s.skipped, rep.total) : 100;
      cnt = s ? `${s.checked} из ${rep.total}` : '';
    } else return;
    LV.el.dataset.st = st;
    LV.el.style.cssText = brandVars(by);
    const lg = lq('[data-lv-logo]'), lk = by + '|' + (st === 'run' || st === 'pausing');
    if (lg._k !== lk) { lg._k = lk; lg.innerHTML = workLogo(by, { size: 46, on: st === 'run' || st === 'pausing' }); }
    lq('[data-lv-title]').textContent = title;
    lq('[data-lv-state]').textContent = line;
    lq('[data-lv-bar]').style.width = p + '%';
    lq('[data-lv-count]').textContent = cnt;
    const wk = !!(RUN && st === 'limit' && RUN.wake);
    const ctl = lq('[data-lv-ctl]'), stopped = st === 'done' && LV.done.status !== 'done', ck = st + '|' + (RUN && RUN.view) + '|' + stopped + '|' + wk;
    if (ctl._k !== ck) {
      ctl._k = ck;
      ctl.innerHTML = st === 'done'
        ? stopped ? `<button type="button" class="btn" data-lv="later" title="Закрыть — в следующий раз нейросеть начнёт с непроверенных карточек">Продолжить позже</button><button type="button" class="btn primary" data-lv="report">${repIco()}Отчёт</button>`
          : `<button type="button" class="btn primary" data-lv="report">${repIco()}Отчёт</button><button type="button" class="btn ghost" data-lv="close">✕ Закрыть</button>`
        : `${st === 'run' ? '<button type="button" class="btn" data-lv="pause">⏸ Пауза</button>' : st === 'pausing' ? '<button type="button" class="btn" disabled>⏸ Пауза…</button>' : wk ? '<button type="button" class="btn primary" data-lv="pick">Выбрать другую нейросеть</button>' : '<button type="button" class="btn primary" data-lv="go">▶ Продолжить</button>'}
          <button type="button" class="btn" data-lv="fast" title="Проверка пойдёт дальше сама, а вы можете учить">⚡ Досмотреть в фоне</button>
          <button type="button" class="btn ghost" data-lv="stop" title="Остановить сразу — проверенное сохранится">⏹ Стоп</button>`;
    }
    // 🔢 tokens so far: the services' own counts (≈ when a service does not say) and what it costs
    const tk = lq('[data-lv-tok]');
    if (tk) {
      const t = RUN ? RUN.tok : LV.done && getReport(LV.done.rid) ? getReport(LV.done.rid).tok : null, n = tokTotal(t);
      tk.hidden = !n;
      if (n) tk.textContent = `🔢 ${RUN ? 'Пока потрачено' : 'Потрачено'} ${t.est ? '≈ ' : ''}${fmtN(n)} ${tokW(n)}${t.req ? ` за ${t.req} ${plural(t.req, ['запрос', 'запроса', 'запросов'])}` : ''} · ${costLine(t)}`;
    }
    // «Скорость показа»: only while the check runs on the screen
    const spd = lq('[data-lv-speed]');
    if (spd) {
      spd.hidden = !RUN;
      if (RUN) spd.querySelectorAll('[data-lv-sp]').forEach(b => { const on = b.dataset.lvSp === speedKey(); b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    }
    LV.el.classList.toggle('waking', wk);
    traces();
    // «Порциями» / «По одной карточке»: can be switched while the check goes (the next request goes the new way)
    const pace = lq('[data-lv-pace]');
    if (pace) {
      pace.hidden = !RUN;
      if (RUN) pace.querySelectorAll('[data-lv-one]').forEach(b => { const on = (b.dataset.lvOne === '1') === !!RUN.one; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    }
    if (st !== 'run' && st !== 'done') LV.el.classList.remove('reading');
    if (st === 'done' && LV._doneCard !== LV.done.rid) doneCard(by, line);
    // 🔑 Claude asks to log in again: the calm panel takes the card's place (until it works again)
    const authUp = !!(RUN && st === 'limit' && RUN.why === 'auth');
    const help = lq('[data-lv-help]'), main = lq('[data-lv-main]');
    if (help && main) {
      const hk = authUp ? 'auth|' + otherAIs().join(',') + '|' + ((window.AI && AI.bridge.authSource) || '') : '';
      if (help._k !== hk) { help._k = hk; help.innerHTML = authUp ? authPanelHtml() : ''; }
      help.hidden = !authUp; main.hidden = authUp;
    }
    // ⏸ waiting for «▶ Продолжить» (a pause, a limit, the page was reloaded): the card says where the check goes on
    if (RUN && (st === 'paused' || (st === 'limit' && !authUp)) && LV.phase === 'idle' && !LV.cur) lvPlaceholder();
  }
  /** «Нажмите «▶ Продолжить» — Claude продолжит с карточки N»: never an empty card */
  function lvPlaceholder() {
    const d = RUN.decks[Math.min(RUN.di, RUN.decks.length - 1)];
    if (!d) return;
    const pos = Math.min(d.pos, d.ids.length - 1), next = Store.card(d.ids[pos]);
    const who = aiName(RUN.wake && RUN.wake.id ? RUN.wake.id : aiId()) || 'Нейросеть';
    const k = [RUN.rid, d.id, d.pos, who, RUN.wake ? RUN.wake.at : 0].join('|');
    if (LV._ph === k) return;
    LV._ph = k;
    LV.snaps = d.ids.slice(d.pos, d.pos + bsz()).map(id => Store.card(id)).filter(Boolean).map(snap);
    LV.state = {}; LV.snaps.forEach(x => { LV.state[x.id] = 'next'; });
    drawStrip();
    const card = lq('[data-lv-card]'); if (!card) return;
    card.classList.remove('flipped', 'scan');
    const set = (f, t) => { const b = lq(`[data-lf="${f}"]`); if (b) { b.className = b.className.replace(/\s*\b(changed|offer|kept)\b/g, ''); b.textContent = t; b.hidden = !t; } };
    ['ru', 'exampleRu', 'description'].forEach(f => set(f, ''));
    set('no', RUN.wake ? `Продолжу сам ${atText(RUN.wake.at)}` : 'Нажмите «▶ Продолжить»');
    set('example', `${who} продолжит с карточки ${pos + 1} из ${d.ids.length}${next ? ` — «${clip(first(next.no), 40)}»` : ''}`);
    const tag = lq('.aiv-face.front .aiv-tag'); if (tag) tag.textContent = RUN.wake ? '⏳ Нейросеть отдыхает' : '⏸ Проверка ждёт вас';
    LV.el.querySelectorAll('[data-lv-stamp]').forEach(x => { x.innerHTML = ''; }); { const fb = lq('[data-lv-forms]'); if (fb) { fb.hidden = true; fb.innerHTML = ''; } }
    const ex = lq('[data-lv-extra]'); if (ex) ex.innerHTML = '';
    LV.el.classList.add('placeholder');
  }
  /** the end: the card turns into a calm summary with the AI's ✓ */
  function doneCard(by, line) {
    LV._doneCard = LV.done.rid;
    const card = lq('[data-lv-card]'); if (!card) return;
    card.classList.remove('flipped', 'scan');
    const set = (f, t) => { const b = lq(`[data-lf="${f}"]`); if (b) { b.className = b.className.replace(/\s*\b(changed|offer|kept)\b/g, ''); b.textContent = t; b.hidden = !t; } };
    set('no', LV.done.status === 'done' ? 'Готово ✓' : 'Остановлено'); set('example', line);
    { const fb = lq('[data-lv-forms]'); if (fb) { fb.hidden = true; fb.innerHTML = ''; } }
    const tag = lq('.aiv-face.front .aiv-tag'); if (tag) tag.textContent = '✨ Итог проверки';
    const stp = lq('[data-lv-stamp="no"]');
    if (stp) stp.innerHTML = `<span class="aim aim-stage aim-pop" aria-hidden="true">${workLogo(by, { cls: 'aim-coin' })}<span class="aim-ok"><svg viewBox="0 0 12 12"><path d="M2.5 6.3 5 8.7l4.5-5.2"/></svg></span></span>`;
    lq('[data-lv-extra]').innerHTML = '';
  }
  const CHIP = { next: ['⏸', 'ждёт проверки'], read: ['📖', 'читает'], now: ['👀', 'проверяет'], ok: ['✓', 'всё верно'], add: ['✓＋', 'верно, добавлены формы слова'], alt: ['≈', 'добавлен второй вариант'], fix: ['✎', 'исправлено'], wait: ['🙋', 'ждёт решения'], skip: ['…', 'проверим потом'], kept: ['✓', 'оставлено как было'] };
  function drawStrip() {
    const box = lq('[data-lv-strip]');
    if (!box) return;
    box.innerHTML = LV.snaps.map(s => {
      const st = LV.state[s.id] || 'read', [ic, w] = CHIP[st] || CHIP.read;
      return `<div class="aiv-chip st-${st}" role="listitem" data-lc="${esc(s.id)}" title="${esc(first(s.no))} — ${w}"><span class="aiv-chip-t">${esc(first(s.no))}</span><span class="aiv-chip-s" aria-label="${w}">${ic}</span></div>`;
    }).join('');
    const now = box.querySelector('.st-now');
    if (now && box.scrollWidth > box.clientWidth + 4) { try { box.scrollTo({ left: now.offsetLeft - box.clientWidth / 2 + now.offsetWidth / 2, behavior: reduceMotion() ? 'auto' : 'smooth' }); } catch (e) { /* old browser */ } }
    else if (now && box.scrollHeight > box.clientHeight + 4) { // a long queue: the row being checked stays in the list's view (the traces go into it)
      const t = now.offsetTop - box.offsetTop, b = t + now.offsetHeight;
      if (t < box.scrollTop || b > box.scrollTop + box.clientHeight) { try { box.scrollTo({ top: t - box.clientHeight / 2 + now.offsetHeight / 2, behavior: reduceMotion() ? 'auto' : 'smooth' }); } catch (e) { /* old browser */ } }
    }
    traces(); setTimeout(traces, 320); // again once the row has slid into place
  }
  function showCard(s, flipped) {
    if (!LV.el) return;
    LV._ph = null; LV.el.classList.remove('placeholder');
    const tag = lq('.aiv-face.front .aiv-tag'); if (tag) tag.textContent = '🇳🇴 Норвежский';
    Object.keys(LV_FIELDS).forEach(f => {
      const b = lq(`[data-lf="${f}"]`); if (!b) return;
      const t = LV_FIELDS[f](s[f] || '');
      b.textContent = t; b.hidden = !t.trim(); b.className = b.className.replace(/\s*\b(changed|offer|kept)\b/g, '');
    });
    const card = lq('[data-lv-card]');
    turn(card, !!flipped);
    LV.el.querySelectorAll('[data-lv-stamp]').forEach(x => { x.innerHTML = ''; }); { const fb = lq('[data-lv-forms]'); if (fb) { fb.hidden = true; fb.innerHTML = ''; } }
    scan();
  }
  function scan() { const card = lq('[data-lv-card]'); if (!card) return; card.classList.remove('scan'); void card.offsetWidth; card.classList.add('scan'); }
  function flip(on) { const card = lq('[data-lv-card]'); if (card) turn(card, on); }
  /** turn the card: a short dip in size while it turns, so its near edge never grows past the frame */
  function turn(card, on) {
    if (card.classList.contains('flipped') === !!on) return;
    card.classList.remove('turning'); void card.offsetWidth; card.classList.add('turning');
    clearTimeout(card._tt); card._tt = setTimeout(() => card.classList.remove('turning'), 760);
    card.classList.toggle('flipped', !!on);
  }
  /** the card being checked glows in the list under the stage as well */
  function rowGlow(id, kind) {
    document.querySelectorAll('#view .aiv-row-now, #view .aiv-row-read').forEach(r => r.classList.remove('aiv-row-now', 'aiv-row-read'));
    if (!id) return;
    const ids = Array.isArray(id) ? id : [id];
    ids.forEach(x => document.querySelectorAll(`#view .mini-card[data-id="${CSS.escape(x)}"], #view .ac-tile[data-ac-id="${CSS.escape(x)}"]`)
      .forEach(r => { r.classList.add(kind === 'read' ? 'aiv-row-read' : 'aiv-row-now'); r.style.cssText += ';' + brandVars(aiId()); }));
  }
  /** a checked card: its row in the list gets the new text and its ✓ marks without redrawing the page */
  function refreshRow(id) {
    const c = Store.card(id); if (!c) return;
    document.querySelectorAll(`#view .mini-card[data-id="${CSS.escape(id)}"]`).forEach(row => {
      [['.no', 'no'], ['.ru', 'tr']].forEach(([sel, side]) => {
        const box = row.querySelector(sel); if (!box) return;
        const t = box.querySelector('.mc-t');
        if (t && window.UI && UI.rich) t.innerHTML = UI.rich(first(side === 'no' ? c.no : (window.Study && Study.tr ? Study.tr(c) : c.ru)));
        const old = box.querySelector('.aim'); if (old) old.remove();
        const mk = markHtml(c, side, { cls: 'aim-list aim-pop' });
        if (mk) box.insertAdjacentHTML('beforeend', mk);
        box.classList.toggle('has-aim', !!mk);
      });
    });
    document.querySelectorAll(`#view .ac-tile[data-ac-id="${CSS.escape(id)}"]`).forEach(tile => {
      const old = tile.querySelector('.aim-pair'); if (old) old.remove();
      const mk = marksPair(c, 'aim-art aim-tile aim-pop');
      if (mk) { const i = tile.querySelector('.ac-i'); if (i) i.insertAdjacentHTML('beforebegin', mk); else tile.insertAdjacentHTML('beforeend', mk); }
    });
  }
  /** the stage goes where the check is: the deck page of the deck being checked (only when nothing else is in the way) */
  function lvEnsure(deckId) {
    if (!watching() || !window.App) return false;
    if (App.view && App.view.name === 'deck' && App.view.params.id === deckId && stageUp()) return true;
    if (App.view && App.view.name === 'study') return false;
    const runM = document.querySelector('.aih-run-modal');
    if (runM) { const bd = runM.closest('.modal-backdrop'); if (bd && bd._m) bd._m.close(); }
    if ([...document.querySelectorAll('#modal-root > .modal-backdrop:not(.closing)')].some(bd => !bd.querySelector('.aih-run-modal'))) return false;
    LV.bypass = true;
    try { App.go('deck', { id: deckId }); } finally { LV.bypass = false; }
    if (stageUp()) { setTimeout(() => { if (stageUp()) LV.el.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' }); }, 120); return true; }
    return false;
  }
  /** Views.deck draws the page → the stage takes its place under the deck title (and the «Проверить» button shows the work) */
  function afterDeck(root, params) {
    try {
      // the brand robot (the one in the top bar that tilts its head) instead of the 🤖 emoji on «Проверить нейросетью»
      root.querySelectorAll('.dk-ai-i').forEach(i => { if (/🤖/.test(i.textContent)) { i.innerHTML = bot(true); i.classList.add('aif-bot'); } });
      deckBtn(root, params.id);
      const cur = RUN && RUN.decks[Math.min(RUN.di, RUN.decks.length - 1)];
      const show = (watching() && cur && cur.id === params.id) || (LV.done && LV.deck === params.id && LV.el);
      if (!show) return;
      if (!LV.el) LV.el = stageEl();
      LV.deck = params.id;
      const head = root.querySelector('.deck-head');
      if (head) head.after(LV.el); else root.prepend(LV.el);
      drawHead(); drawStrip();
      if (LV.cur) rowGlow(LV.cur, 'now'); else if (LV.phase === 'read') rowGlow(LV.snaps.map(s => s.id), 'read');
      pill();
    } catch (e) { console.warn('aihub live', e); }
  }
  /** the deck's «🤖 Проверить всё» button while this deck is being checked: the living logo and the progress */
  function deckBtn(root, deckId) {
    // the deck page's own «Проверка нейросетью · N% · идёт — открыть» button follows the check too
    const rb = (root || document).querySelector('#view [data-act="ai-run"]');
    if (rb && RUN && RUN.decks.some(d => d.id === deckId)) {
      const t = rb.querySelector('.dk-ai-t b'), sm = rb.querySelector('.dk-ai-t small');
      if (t) t.textContent = `Проверка нейросетью · ${pct(runDone(), runTotal())}%`;
      if (sm) sm.textContent = live ? 'идёт — открыть' : RUN.status === 'limit' && RUN.wake ? `продолжу сам ${atText(RUN.wake.at)}` : 'на паузе — открыть';
    }
    const b = (root || document).querySelector('#view .toolbar [data-act="ai-check"], .toolbar [data-act="ai-check"]');
    if (!b || !RUN || !RUN.decks.some(d => d.id === deckId) || (window.Views && Views.sel && Views.sel.size)) return;
    const st = live ? 'run' : 'paused', p = pct(runDone(), runTotal());
    const k = `${aiId()}|${st}|${p}|${RUN.wake ? RUN.wake.at : 0}`;
    if (b._aiwK === k) return;
    b._aiwK = k;
    b.classList.add('aiw-btn');
    const wk = !live && RUN.status === 'limit' && RUN.wake;
    b.innerHTML = `${workLogo(aiId(), { size: 22, on: st === 'run' })}<span>${st === 'run' ? `Проверяю… ${p}%` : wk ? `Продолжу сам ${atText(RUN.wake.at)}: ${p}%` : `На паузе: ${p}%`}</span>`;
    b.title = st === 'run' ? 'Нейросеть проверяет эту колоду — нажмите, чтобы посмотреть' : wk ? 'Нейросеть отдыхает — проверка продолжится сама' : 'Проверка на паузе — нажмите, чтобы продолжить';
  }
  /** «По одной карточке»: the list keeps the last checked cards with their marks, the new one joins at the end */
  function stripWith(snaps) {
    if (RUN && RUN.one) {
      const ids = new Set(snaps.map(s => s.id));
      const keep = LV.snaps.filter(s => !ids.has(s.id) && LV.state[s.id] && !['read', 'now', 'next'].includes(LV.state[s.id])).slice(-7);
      const st = {}; keep.forEach(s => { st[s.id] = LV.state[s.id]; });
      LV.snaps = keep.concat(snaps); LV.state = st;
    } else { LV.snaps = snaps.slice(); LV.state = {}; }
    snaps.forEach(s => { LV.state[s.id] = 'read'; });
    const h = lq('.aiv-side-h'); if (h) h.textContent = RUN && RUN.one ? 'Карточки по очереди' : 'Эта порция';
  }
  /** a real portion is with the AI: card by card — the front, the flip, the translation, the next one (round and round until the answer comes) */
  function lvReading(deckId, cards, job) {
    if (!watching() || !lvEnsure(deckId)) return;
    LV.skip = false; LV.phase = 'read'; LV.done = null; LV.cur = null;
    stripWith(cards.map(snap));
    const mine = cards.map(c => c.id);
    LV.el.classList.add('reading');
    lq('[data-lv-extra]').innerHTML = '';
    drawStrip();
    const n = mine.length;
    LV.readN = n;
    lvState(readLine(n, aiName(aiId())));
    drawHead();
    home(); // the AI reads the next card: the stage comes back up if the last answer pulled the page down
    clearInterval(LV.cyc); clearTimeout(LV.readT);
    const rm = reduceMotion();
    let i = 0;
    const g = gen;
    const still = () => LV.el && LV.phase === 'read' && g === gen;
    const step = () => {
      if (!still()) return;
      const k = i++ % n, s = LV.snaps.find(x => x.id === mine[k]);
      if (!s) return;
      LV.reading = { k: k + 1, n, id: s.id, no: first(s.no) };
      showCard(s, false);
      LV.el.querySelectorAll('.aiv-chip').forEach(c => c.classList.toggle('peek', c.dataset.lc === s.id));
      const chip = LV.el.querySelector(`.aiv-chip[data-lc="${CSS.escape(s.id)}"]`);
      const box = lq('[data-lv-strip]');
      if (chip && box) { try { if (box.scrollWidth > box.clientWidth + 4) box.scrollTo({ left: chip.offsetLeft - box.clientWidth / 2 + chip.offsetWidth / 2, behavior: rm ? 'auto' : 'smooth' }); else if (box.scrollHeight > box.clientHeight + 4) box.scrollTo({ top: chip.offsetTop - box.clientHeight / 2, behavior: rm ? 'auto' : 'smooth' }); } catch (e) { /* old browser */ } }
      rowGlow(s.id, 'read');
      think(n, job);
      // the front for a moment, then the card turns over: the translation is read too
      LV.readT = setTimeout(() => {
        if (!still()) return;
        flip(true); scan();
        LV.readT = setTimeout(step, rm ? 1700 : 1600);
      }, rm ? 1500 : 1300);
    };
    step();
  }
  const readLine = (n, who) => (n > 1 ? `${who} читает ${n} ${plural(n, ['карточку', 'карточки', 'карточек'])} — когда ответит, покажу каждую по очереди` : `${who} читает карточку`);
  /* ---------- 📜 follow the writing: what the AI writes under the card stays on the screen ----------
   * The stage grows downwards (forms, examples per tense, the verdict): the page scrolls smoothly so that the line being
   * written is visible — the card stays in view while there is room. A person who scrolls by hand is left alone for 4 s.
   * Reduced motion: instant jumps. */
  let followT = 0, followAt = 0, followEl = null;
  function follow(el) {
    if (!el || !stageUp() || !el.isConnected) return;
    followEl = el;
    const wait = 140 - (now() - followAt);
    if (wait > 0) { if (!followT) followT = setTimeout(() => { followT = 0; follow(followEl); }, wait); return; }
    followAt = now();
    if (now() - (LV.userAt || 0) < 4000) return;
    const { top, bottom } = edges();
    const r = el.getBoundingClientRect();
    let dy = 0;
    if (r.bottom > bottom) dy = Math.min(r.bottom - bottom, r.top - top); // down — but never past the top of what is written
    else if (r.top < top) dy = r.top - top; // above the screen (a new card after a long one): back up to it
    if (Math.abs(dy) < 4) return;
    window.scrollBy({ top: dy, behavior: reduceMotion() ? 'auto' : 'smooth' });
  }
  /** the visible band of the page: under the top bar, above a phone's bottom bar */
  function edges() {
    const cs = getComputedStyle(document.documentElement);
    const topH = parseFloat(cs.getPropertyValue('--topbar-h')) || (document.querySelector('.topbar') ? document.querySelector('.topbar').getBoundingClientRect().bottom : 64);
    const nav = document.querySelector('.bottom-nav, .tabbar, nav.mobile-nav');
    return { top: Math.max(0, topH) + 8, bottom: window.innerHeight - (nav && nav.offsetParent ? nav.getBoundingClientRect().height : 0) - 28 };
  }
  /* ---------- 🏠 back to the start: the stage's head (which AI works, the buttons) and the card in view ----------
   * Following the writing scrolls the page down; when a card is done and the next one starts, the stage comes back by
   * itself so the AI's logo and name are never left above the screen. On a short screen where the head and the card
   * do not fit together, the card wins (it is what is being checked). A hand scroll is left alone for 4 s. */
  function home() {
    if (!LV.el || !stageUp() || !LV.el.isConnected) return;
    if (now() - (LV.userAt || 0) < 4000) return;
    clearTimeout(followT); followT = 0; followAt = now();
    const { top, bottom } = edges();
    const R = LV.el.getBoundingClientRect(), cw = lq('.aiv-cardwrap'), C = cw ? cw.getBoundingClientRect() : R;
    let dy = R.top - top; // the stage's top edge right under the top bar
    if (C.top - dy > bottom - 140) dy = Math.min(C.bottom - bottom, C.top - top); // the card would be pushed off: show the card
    else if (dy > 0 && C.bottom <= bottom) return; // all of it is already on the screen
    if (Math.abs(dy) < 4) return;
    window.scrollBy({ top: dy, behavior: reduceMotion() ? 'auto' : 'smooth' });
  }
  /* ---------- ⚡ «circuit board»: thin glowing traces from the AI's logo to the card along the stage's edge ----------
   * Drawn in the stage's own SVG (positions measured); a pulse runs along them while the AI thinks (.aiv.reading);
   * reduced motion: static. Colours: the AI's own (--g1/--g2). */
  function traces() {
    const svg = lq('[data-lv-traces]'), lg = lq('[data-lv-logo]'), cw = lq('.aiv-cardwrap');
    if (!svg || !lg || !cw || !LV.el.isConnected) return;
    const R = LV.el.getBoundingClientRect(), L = lg.getBoundingClientRect(), C = cw.getBoundingClientRect();
    if (!R.width || !C.width || !C.height || cw.offsetParent === null) { svg.innerHTML = ''; svg._k = ''; return; }
    // user units = CSS pixels from the stage's padding box (no viewBox: the stage may grow, the traces never stretch)
    const S = { left: R.left + LV.el.clientLeft, top: R.top + LV.el.clientTop, width: R.width, height: R.height };
    const lx = L.left - S.left + L.width / 2, ly = L.bottom - S.top - 4, cx = C.left - S.left - 4, cy = C.top - S.top, ch = C.height;
    const room = Math.max(6, C.left - S.left - 6); // the stage's left padding: the three traces share it
    // ➡ and from the card's right edge into the row of «Карточки по очереди» being checked (👀) — only when the list is beside the card
    let rt = null;
    const strip = lq('[data-lv-strip]'), chip = lq('.aiv-chip.st-now') || lq('.aiv-chip.peek');
    if (strip && chip && chip.offsetParent !== null) {
      const Sd = strip.getBoundingClientRect(), K = chip.getBoundingClientRect();
      const x0 = C.right - S.left + 2, x1 = K.left - S.left - 1, gap = x1 - x0;
      if (gap >= 8 && K.height && Sd.height) {
        // a row scrolled out of the list: the traces go to the list's edge
        const ky = Math.min(Math.max(K.top + K.height / 2, Sd.top + 10), Sd.bottom - 10) - S.top;
        rt = { x0, x1, gap, ky };
      }
    }
    const k = [S.width, lx, ly, cx, cy, ch, room].concat(rt ? [rt.x0, rt.x1, rt.ky] : []).map(Math.round).join(',');
    if (svg._k === k) return;
    svg._k = k;
    let right = '';
    if (rt) {
      const { x0, x1, gap, ky } = rt, mid = cy + ch / 2;
      const level = ky > cy + ch * 0.2 && ky < cy + ch * 0.8; // the row is beside the card: three straight traces
      const ends = [-7, 0, 7].map(o => ky + o);
      const starts = level ? ends : [0.3, 0.5, 0.7].map(f => cy + ch * f);
      const up = ky < mid;
      // horizontal → a rounded turn → vertical → into the row; the turns are nested so the traces never cross
      const pcb = (y0, x, y1) => {
        const dy = y1 - y0, s = dy < 0 ? -1 : 1, r = Math.min(4, Math.abs(dy) / 2, gap / 6);
        if (Math.abs(dy) < 1.5) return `M ${x0} ${y0} H ${x1}`;
        return `M ${x0} ${y0} H ${x - r} Q ${x} ${y0} ${x} ${y0 + s * r} V ${y1 - s * r} Q ${x} ${y1} ${x + r} ${y1} H ${x1}`;
      };
      const rl = starts.map((y0, i) => pcb(y0, x0 + gap * (up ? i + 1 : 3 - i) / 4, ends[i]));
      right = `${rl.map(d => `<path class="aiv-tr aiv-tr-r" d="${d}"/>`).join('')}
        ${rl.map((d, i) => `<path class="aiv-tr-p aiv-tr-pr" pathLength="100" style="--d:${(i * 0.45).toFixed(2)}s" d="${d}"/>`).join('')}
        ${starts.map(y => `<circle class="aiv-tr-pad" cx="${x0}" cy="${y}" r="2.2"/>`).join('')}${ends.map(y => `<circle class="aiv-tr-pad aiv-tr-end" cx="${x1}" cy="${y}" r="2"/>`).join('')}`;
    }
    const lines = [0.26, 0.5, 0.74].map((f, i) => {
      const x = 3 + (2 - i) * (room - 3) / 2, y = cy + ch * f, j = ly + 6 + (2 - i) * 5; // nested: they never cross
      // down from the logo, along the left edge, then a right-angle turn into the card (rounded corners like a PCB)
      return `M ${lx - i * 6} ${ly} V ${j} H ${x + 4} Q ${x} ${j} ${x} ${j + 4} V ${y - 4} Q ${x} ${y} ${x + 4} ${y} H ${cx}`;
    });
    const pads = [0.26, 0.5, 0.74].map(f => `<circle class="aiv-tr-pad" cx="${cx}" cy="${cy + ch * f}" r="2.6"/>`).join('');
    svg.innerHTML = `${lines.map(d => `<path class="aiv-tr" d="${d}"/>`).join('')}
      ${lines.map((d, i) => `<path class="aiv-tr-p" pathLength="100" style="--d:${(i * 0.45).toFixed(2)}s" d="${d}"/>`).join('')}
      ${pads}<circle class="aiv-tr-pad" cx="${lx}" cy="${ly}" r="2.2"/>${right}`;
  }
  function lvIdle() { clearInterval(LV.cyc); clearTimeout(LV.readT); think(0); LV.phase = 'idle'; LV.reading = null; if (LV.el) { LV.el.classList.remove('reading'); LV.el.querySelectorAll('.aiv-chip.peek').forEach(c => c.classList.remove('peek')); } rowGlow(null); }
  /** «Claude читает…» under the card: the living logo, which card, how long the answer is awaited — n=0 hides it */
  function think(n, job) {
    clearInterval(LV.thinkT);
    const box = lq('[data-lv-think]');
    if (!box) return;
    if (!n) { box.hidden = true; return; }
    const t0 = job ? job.t0 : now();
    const lg = lq('[data-lv-think-logo]');
    const typ = Math.round(tmGet(job ? job.one : RUN && RUN.one, job ? job.depth : RUN && RUN.depth, job ? job.full : runFull()) / 1000);
    // ≈ tokens of this request per card: the instruction + the cards (counted before sending) + the usual answer
    const nc = job && job.sl ? job.sl.cards.length : 1;
    const per = job && job.estIn ? (job.estIn + outPer(job.depth || 'card', job.full) * nc) / nc : 0;
    const tick = () => {
      if (!LV.el || LV.phase !== 'read') { clearInterval(LV.thinkT); box.hidden = true; return; }
      const id = (job && job.asking) || aiId(); // the one asked right now (Ollama silent → Gemini)
      if (lg._k !== id) { lg._k = id; lg.innerHTML = workLogo(id, { size: 30, on: true }); }
      const sec = Math.round((now() - t0) / 1000), r = LV.reading;
      lq('[data-lv-think-t]').textContent = `${aiName(id)} читает…`;
      lq('[data-lv-think-s]').textContent = `${r ? `«${clip(r.no, 40)}»${r.n > 1 ? ` · ${r.k} из ${r.n}` : ''} · ` : ''}ответ ждём ${sec} с${typ > 3 ? ` (обычно около ${typ} с)` : ''}${per ? ` · ≈ ${fmtN(Math.round(per / 10) * 10)} ${tokW(per)} на эту карточку` : ''}`;
    };
    box.hidden = false; tick();
    LV.thinkT = setInterval(tick, 1000);
  }
  /** one field: the old text lights up, then the new one appears letter by letter (auto) or as an offer (review) */
  async function typeFix(f, ch, how) {
    const box = lq(`[data-lf="${f}"]`);
    if (!box) return;
    const old = LV_FIELDS[f] ? LV_FIELDS[f](ch.old || '') : String(ch.old || ''), nv = LV_FIELDS[f] ? LV_FIELDS[f](ch.new || '') : String(ch.new || '');
    box.hidden = false;
    box.classList.add('changed');
    box.classList.toggle('offer', how === 'offer');
    const who = aiName(LV.by || aiId());
    follow(box);
    if (!old) { // nothing to cross out: the AI simply writes what was missing
      box.innerHTML = '<span class="aiv-new"></span>';
      lvState(`${who} ${how === 'offer' ? 'предлагает дописать' : 'дописывает'}: ${FSHORT[f] || 'поле'}`);
    } else {
      box.innerHTML = `<span class="aiv-old">${esc(old)}</span><span class="aiv-new"></span>`;
      lvState(`${who} ${how === 'offer' ? 'предлагает исправить' : 'исправляет'}: ${FSHORT[f] || 'поле'}`);
      const o = box.firstChild;
      await lwait(T(120));
      o.classList.add('hl');
      await lwait(T(650));
      o.classList.add('gone');
    }
    const n = box.lastChild;
    if (reduceMotion() || LV.skip) { n.textContent = nv; await lwait(T(500)); return; }
    n.classList.add('typing');
    const chars = Array.from(nv);
    const step = Math.max(12, Math.min(50, 1000 / Math.max(1, chars.length)));
    for (let i = 0; i < chars.length && !LV.skip; i++) { n.textContent += chars[i]; if (i % 12 === 11) follow(box); await lwait(T(step)); }
    n.textContent = nv;
    n.classList.remove('typing');
    follow(box);
    await lwait(T(380));
  }
  /** 📚 the forms of the word are written on the back, row by row (the stage shows at most 6; all of them go into the card) */
  async function typeForms(arr, how) {
    const box = lq('[data-lv-forms]');
    if (!box || !arr.length) return;
    box.hidden = false;
    box.classList.toggle('offer', how === 'offer');
    box.innerHTML = '<div class="aiv-forms-h">📚 Формы слова</div>';
    lvState(`${aiName(LV.by || aiId())} ${how === 'offer' ? 'предлагает' : 'пишет'} формы слова`);
    const show = arr.slice(0, 6);
    for (const f of show) {
      const row = document.createElement('div');
      row.className = 'aiv-form';
      // «presens · настоящее время» from the one table in js/ai.js (AI.FORM_TAGS); an unknown label as it is
      const lab = window.AI && AI.formLabelHtml ? AI.formLabelHtml(f, Store.settings.transLang === 'uk' ? 'uk' : 'ru') : esc(String(f.label || '').replace(/\s*\(.*\)$/, ''));
      row.innerHTML = `<small>${lab}</small><b lang="nb">${esc(f.no)}</b><span>${esc(f.ru)}</span>`;
      box.appendChild(row);
      follow(lq('.aiv-cardwrap')); // the forms are written on the card itself
      await lwait(T(LV.skip ? 0 : 260));
    }
    if (arr.length > show.length) box.insertAdjacentHTML('beforeend', `<div class="aiv-form more">и ещё ${arr.length - show.length}</div>`);
    await lwait(T(500));
  }
  /** 💬 examples per tense: under the card, sentence by sentence — «Прошедшее (preteritum)», the Norwegian typed in, the translation */
  async function typeExamples(arr, how) {
    const ex = lq('[data-lv-extra]');
    if (!ex || !arr.length) return;
    const box = document.createElement('div');
    box.className = 'aiv-exs' + (how === 'offer' ? ' offer' : '');
    box.innerHTML = `<div class="aiv-forms-h">💬 Примеры по временам${how === 'offer' ? ' <em>(предложение)</em>' : ''}</div>`;
    ex.appendChild(box);
    lvState(`${aiName(LV.by || aiId())} ${how === 'offer' ? 'предлагает' : 'пишет'} примеры по временам`);
    for (const x of arr.slice(0, 5)) {
      const row = document.createElement('div');
      row.className = 'aiv-ex';
      row.innerHTML = `${x.label ? `<small>${esc(x.label)}</small>` : ''}<b lang="nb"></b><span></span>`;
      box.appendChild(row);
      follow(row);
      const b = row.querySelector('b'), t = String(x.no || '');
      if (reduceMotion() || LV.skip) b.textContent = t;
      else {
        const chars = Array.from(t), step = Math.max(8, Math.min(28, 700 / Math.max(1, chars.length)));
        for (let i = 0; i < chars.length && !LV.skip; i++) { b.textContent += chars[i]; if (i % 16 === 15) follow(row); await lwait(T(step)); }
        b.textContent = t;
      }
      row.querySelector('span').textContent = x.ru || '';
      follow(row);
      await lwait(T(LV.skip ? 0 : 320));
    }
    await lwait(T(400));
  }
  /** review mode: the fix waits on the card — «Принять» / «Оставить как было» / «Решу потом» (and goes on by itself) */
  function decide(addOnly) {
    return new Promise(res => {
      const ex = lq('[data-lv-extra]');
      if (!ex || LV.skip) { res('later'); return; }
      const secs = 20;
      const box = document.createElement('div');
      box.className = 'aiv-decide';
      box.innerHTML = `<p><b>${addOnly ? 'Нейросеть предлагает дополнить карточку.' : 'Нейросеть предлагает исправить.'}</b> Как поступить?</p>
        <div class="aiv-dbtns"><button type="button" class="btn good" data-lvd="yes">✓ Принять</button><button type="button" class="btn" data-lvd="no">↩ Оставить как было</button><button type="button" class="btn ghost" data-lvd="later">⏭ Решу потом</button></div>
        <span class="aiv-count" style="--t:${secs}s" aria-hidden="true"><i></i></span>
        <small class="muted">Если не выбрать, через ${secs} секунд проверка пойдёт дальше, а предложение подождёт вас в отчёте.</small>`;
      ex.appendChild(box);
      // the buttons must be on the screen (a phone: under the card)
      const r = box.getBoundingClientRect(), nav = document.querySelector('.bottom-nav, .tabbar, nav.mobile-nav');
      const bottom = window.innerHeight - (nav && nav.offsetParent ? nav.getBoundingClientRect().height : 0);
      if (r.bottom > bottom) window.scrollBy({ top: Math.min(r.bottom - bottom + 12, Math.max(0, r.top - 70)), behavior: reduceMotion() ? 'auto' : 'smooth' });
      let t = 0;
      const wake = () => done('later');
      const g = gen;
      function done(v) { clearTimeout(t); LV.wakers.delete(wake); box.remove(); if (g === gen) res(v); }
      LV.wakers.add(wake);
      box.addEventListener('click', e => { const b = e.target.closest('[data-lvd]'); if (b) done(b.dataset.lvd); });
      t = setTimeout(() => done('later'), secs * 1000);
    });
  }
  function stamps(c, pop) {
    if (!LV.el) return;
    LV.el.querySelectorAll('[data-lv-stamp]').forEach(x => { x.innerHTML = markHtml(c, x.dataset.lvStamp, { cls: 'aim-stage' + (pop ? ' aim-pop' : '') }); });
  }
  /** the final mark of one card in the list: ✓ right · ≈ a second variant added · ✎ fixed · 🙋 waits · ✓ kept · … not answered */
  function stOf(r, rd, id) {
    if (!r) return 'skip';
    const item = rd ? [...rd.items].reverse().find(it => it.id === id) : null;
    const fs = item ? Object.entries(item.f || {}).filter(([f]) => !SIDE(f)).map(([, x]) => x) : [];
    if (fs.some(x => x.st === 'pending')) return 'wait';
    const done = fs.filter(x => x.st === 'applied' || x.st === 'accepted');
    if (done.length) {
      // added, not fixed: all forms, examples per tense, the part of speech, a first example, a second variant of the translation
      const f = item.f, real = done.filter(x => !ADDS(Object.keys(f).find(k => f[k] === x), x));
      if (real.length) return 'fix';
      if (f.ru && f.ru.kind === 'alt' && done.includes(f.ru)) return 'alt';
      return done.includes(f.forms) || done.includes(f.examples) ? 'add' : 'ok';
    }
    if (fs.some(x => x.st === 'rejected')) return 'kept';
    return 'ok';
  }
  /** the answer came: card by card — the front, the flip, the old text crossed out and the new one typed, the forms, the mark, the next card */
  async function lvReveal(snaps, results, rep, rd, g) {
    clearInterval(LV.cyc); clearTimeout(LV.readT); think(0);
    if (!LV.el) return;
    LV.phase = 'reveal'; LV.skip = false; LV.reading = null;
    LV.el.classList.remove('reading');
    if (!snaps.every(x => LV.snaps.some(y => y.id === x.id))) stripWith(snaps);
    LV.el.querySelectorAll('.aiv-chip.peek').forEach(c => c.classList.remove('peek'));
    const pr = LV.presenting = { snaps, results, rd, shown: new Set() };
    const auto = RUN && RUN.mode === 'auto', F = FACE();
    for (const s of snaps) {
      if (g !== gen) return;
      const r = results.find(x => x && x.id === s.id);
      const item = r ? [...rd.items].reverse().find(it => it.id === s.id) : null;
      if (!r || LV.skip || !stageUp()) { LV.state[s.id] = stOf(r, rd, s.id); pr.shown.add(s.id); refreshRow(s.id); continue; }
      const t0 = now();
      LV.by = r.by || null; // the AI that really answered for this card writes on it
      LV.cur = s.id; LV.state[s.id] = 'now';
      drawStrip(); rowGlow(s.id, 'now');
      showCard(s, false);
      lq('[data-lv-extra]').innerHTML = '';
      home(); // a new card: back to the start — the AI's head and the card in view
      lvState(`Смотрим ответ: «${clip(first(s.no), 60)}»`);
      await lwait(T(900));
      const keys = ORDER.filter(f => r.changes && r.changes[f]);
      const how = auto ? 'fix' : 'offer';
      for (const f of keys.filter(k => F.front.includes(k))) await typeFix(f, r.changes[f], auto && !SIDE(f) ? how : 'offer');
      lvState('Переворачивает карточку — перевод');
      flip(true);
      await lwait(T(reduceMotion() ? 300 : 750));
      scan();
      await lwait(T(700));
      for (const f of keys.filter(k => F.back.includes(k))) await typeFix(f, r.changes[f], how);
      if (keys.includes('forms')) await typeForms(r.changes.forms.arr || [], how);
      // new examples per tense are typed in under the card; a corrected list is shown as «было → стало» with the rest
      const newEx = keys.includes('examples') && !r.changes.examples.old && (r.changes.examples.arr || []).length;
      const other = keys.filter(k => !F.front.includes(k) && !F.back.includes(k) && k !== 'forms' && !(k === 'examples' && newEx));
      const ex = lq('[data-lv-extra]');
      if (ex && (other.length || (r.issues || []).length)) {
        ex.insertAdjacentHTML('beforeend', `${(r.issues || []).length ? `<div class="aiv-issue">💬 ${esc(r.issues.slice(0, 2).join(' · '))}</div>` : ''}
          ${other.map(f => `<div class="aiv-oth"><small>${esc(FNAME[f] || f)}</small> <s>${esc(clip(r.changes[f].old, 60)) || 'пусто'}</s> → <b>${esc(clip(r.changes[f].new, 80))}</b>${SIDE(f) || !auto ? ' <em>(предложение)</em>' : ''}</div>`).join('')}`);
        follow(ex.lastElementChild);
        await lwait(T(900));
      }
      if (newEx) await typeExamples(r.changes.examples.arr, how);
      const pend = item ? ORDER.filter(f => item.f[f] && item.f[f].st === 'pending' && !SIDE(f)) : [];
      if (pend.length && !LV.skip && stageUp()) {
        LV.state[s.id] = 'wait'; drawStrip();
        lvState('Ждёт вашего решения');
        const d = await decide(pend.every(f => ADDS(f, item.f[f])));
        if (d === 'yes') { applyFields(item, pend, 'accepted', [(item.issues || []).join('; '), 'принято вами во время проверки'].filter(Boolean).join(' · ')); putReport(rep); }
        else if (d === 'no') {
          rejectFields(item, pend); putReport(rep);
          LV.el.querySelectorAll('.aiv-f.changed').forEach(b => { b.classList.add('kept'); });
        }
        if (d === 'yes') LV.el.querySelectorAll('.aiv-f.offer').forEach(b => b.classList.remove('offer'));
        emit();
      }
      if (g !== gen) return;
      const fresh = Store.card(s.id);
      if (fresh) stamps(fresh, true);
      LV.state[s.id] = stOf(r, rd, s.id); pr.shown.add(s.id);
      drawStrip(); refreshRow(s.id);
      const st = LV.state[s.id];
      const addT = item && item.f && item.f.examples && (item.f.examples.st === 'applied' || item.f.examples.st === 'accepted') ? 'добавлены формы слова и примеры по временам' : 'добавлены все формы слова';
      lvState(st === 'ok' ? 'Всё верно ✓' : st === 'add' ? `Верно ✓ — ${item && item.f && item.f.forms ? addT : 'добавлены примеры по временам'}` : st === 'alt' ? 'Верно ✓ — добавлен второй вариант перевода' : st === 'fix' ? 'Исправлено ✓' : st === 'wait' ? 'Исправление ждёт вас в отчёте' : 'Оставлено как было ✓');
      const ex2 = lq('[data-lv-extra]');
      if (ex2 && !LV.skip) { ex2.insertAdjacentHTML('beforeend', verdictHtml(item, keys)); follow(ex2.lastElementChild); }
      await lwait(T(keys.length ? 900 : 650));
      if (!LV.skip && stageUp()) { home(); flip(false); await lwait(T(reduceMotion() ? 800 : 1200)); } // the ✓ on the Norwegian side too
      if (RUN && !LV.skip && LV.speed === 1) { RUN.pms = (RUN.pms || 0) + now() - t0; RUN.pn = (RUN.pn || 0) + 1; }
    }
    LV.presenting = null;
    LV.cur = null; LV.by = null; rowGlow(null);
    LV.phase = 'idle';
  }
  /** under the card: both sides at a glance — «🇳🇴 написание верно ✓ · 🇷🇺 перевод исправлен ✓» */
  function verdictHtml(item, keys) {
    const F = FACE();
    const side = (fs, okText, nm) => {
      const mine = keys.filter(f => fs.includes(f)).map(f => item && item.f[f]).filter(Boolean);
      if (mine.some(x => x.st === 'pending')) return ['wait', `⏳ ${nm}: ждёт вашего решения`];
      if (mine.some(x => x.st === 'applied' || x.st === 'accepted')) return ['fix', `✎ ${nm}: исправлено ✓`];
      if (mine.some(x => x.st === 'rejected')) return ['ok', `✓ ${nm}: оставлено как было`];
      return ['ok', `✓ ${okText}`];
    };
    const a = side(F.front, 'Норвежская сторона верна', 'норвежская сторона'), b = side(F.back, 'Перевод верный', 'перевод');
    const ru = item && item.f && item.f.ru;
    if (ru && ru.kind === 'alt' && (ru.st === 'applied' || ru.st === 'accepted')) b[1] = '＋ добавлен второй вариант перевода';
    const fm = item && item.f && item.f.forms, xs = item && item.f && item.f.examples;
    if (fm && (fm.st === 'applied' || fm.st === 'accepted')) b[1] += ` · 📚 ${fm.kind === 'fix' ? 'формы исправлены' : 'формы слова'}: ${(fm.arr || []).length}`;
    if (xs && !xs.old && (xs.st === 'applied' || xs.st === 'accepted')) b[1] += ` · 💬 примеры: ${(xs.arr || []).length}`;
    return `<div class="aiv-verdict" role="status"><span class="aiv-vd ${a[0]}">🇳🇴 ${esc(a[1])}</span><span class="aiv-vd ${b[0]}">🇷🇺 ${esc(b[1])}</span></div>`;
  }
  /** the stage is hidden (or the check runs in the background): the rows still get their marks */
  function lvQuiet(snaps, results, rd) {
    snaps.forEach(s => { LV.state[s.id] = stOf(results.find(x => x && x.id === s.id), rd, s.id); refreshRow(s.id); });
    if (LV.el && LV.el.isConnected) drawStrip();
  }
  function toFast(quiet) {
    if (RUN) { RUN.view = 'fast'; saveRun(); }
    lskip(); lvIdle();
    if (LV.el) LV.el.remove();
    LV.el = null; LV.done = null; LV.cur = null;
    pill(); emit();
    if (!quiet) UI.toast('Проверка идёт в фоне — внизу экрана видно, сколько осталось', '', 3500);
  }
  function toLive() {
    if (!RUN) return;
    RUN.view = 'live'; saveRun();
    const d = RUN.decks[Math.min(RUN.di, RUN.decks.length - 1)];
    if (d && !lvEnsure(d.id)) UI.toast('Откройте колоду — проверка будет видна там', '', 3500);
    if (!live && RUN.status !== 'limit') resume();
    emit();
  }
  /** App.go → leaving the deck while the AI works before the person's eyes: ask first (the check is never lost) */
  function leaving(name, params) {
    if (LV.bypass || !LV.el || !LV.el.isConnected) return false;
    if (name === 'deck' && params && params.id === LV.deck) return false;
    if (!(RUN && RUN.view === 'live' && live)) { if (LV.done) { LV.done = null; LV.el = null; } return false; }
    UI.askClose({
      title: 'Проверка идёт. Что сделать?',
      line: `Проверено ${runDone()} из ${runTotal()}, всё проверенное уже сохранено.`,
      actions: [{ label: '⚡ Продолжить в фоне', value: 'bg', cls: 'primary' }, { label: '⏸ Поставить на паузу', value: 'pause' }],
      cancel: 'Остаться',
    }).then(r => {
      if (!r) return;
      if (r === 'pause') pause(); else toFast(true);
      LV.bypass = true;
      try { App.go(name, params); } finally { LV.bypass = false; }
    });
    return true;
  }
  subs.add(() => { if (LV.el && LV.el.isConnected) drawHead(); if (window.App && App.view && App.view.name === 'deck') deckBtn(null, App.view.params.id); paintBadge(); });

  /** Views.deck is wrapped once: the stage and the deck button follow every redraw of the deck page */
  function hookDeck() {
    if (!window.Views || !Views.deck || Views.deck._aiw) return;
    const orig = Views.deck;
    Views.deck = function (root, params) { const r = orig.apply(this, arguments); afterDeck(root, params || {}); return r; };
    Views.deck._aiw = true;
  }

  /* =====================================================================
   * ✅ One card / a few cards: the teacher's check with fixes at once (or «сначала спрашивать»)
   *  - checkOne(card)  → the AI's verdict (верно / другой вариант / ошибка), the fix, all forms of the word on the back;
   *                      every change keeps the card as it was → «↶ Вернуть» puts back the whole card (and says so in the history).
   *  - checkList(cards) replaces Views.runAiCheck (selection, new cards, import): the same, with a short report of every change.
   * ===================================================================== */
  const SNAP = ['no', 'ru', 'uk', 'wordClass', 'description', 'example', 'exampleRu', 'forms', 'examples', 'synonyms', 'aiCheck', 'aiChecked', 'aiBy', 'aiChecks', 'history'];
  const cardSnap = c => { const o = {}; SNAP.forEach(k => { o[k] = c[k] === undefined ? null : JSON.parse(JSON.stringify(c[k])); }); return o; };
  const shortName = id => (window.AI && AI.PROVIDERS[id] ? AI.PROVIDERS[id].short || AI.PROVIDERS[id].name : aiName(id));
  const XNAME = { no: 'написание слова', uk: 'украинский перевод', description: 'объяснение', examples: 'примеры', synonyms: 'синонимы', exampleRu: 'перевод примера', example: 'пример' };
  function fixLine(res) {
    const it = res.item, nm = shortName(res.by), f = it.f || {};
    const ask = res.mode === 'ask' && res.main.length && !res.applied;
    const formsN = f.forms && f.forms.arr ? f.forms.arr.length : 0;
    const extra = [];
    if (formsN) extra.push(f.forms.kind === 'fix' ? `исправлены формы слова (${formsN})` : `+ все формы слова (${formsN})`);
    if (f.examples && !f.examples.old) extra.push(`+ примеры по временам (${(f.examples.arr || []).length})`);
    if (f.example && !f.example.old) extra.push('+ пример');
    const other = Object.keys(f).filter(k => XNAME[k] && !(k === 'example' && !f.example.old) && !(k === 'exampleRu' && f.example && !f.example.old) && !(k === 'examples' && !f.examples.old) && !(k === 'no' && !f.ru));
    if (other.length) extra.push(`${ask ? 'предлагает исправить' : 'исправлено'}: ${other.map(k => XNAME[k]).join(', ')}`);
    const reason = it.reason || (it.issues || [])[0] || '';
    let head;
    if (f.ru && f.ru.kind === 'alt') head = `${nm} ${ask ? 'предлагает добавить вариант' : 'добавил вариант'}: ${res.r.alt || first(f.ru.new)}`;
    else if (f.ru) head = `${nm} ${ask ? 'предлагает исправить' : 'исправил'}: ${first(f.ru.old)} → ${first(f.ru.new)}`;
    else if (f.no) head = `${nm} ${ask ? 'предлагает исправить' : 'исправил'}: ${first(f.no.old)} → ${first(f.no.new)}`;
    else if (res.r.verdict === 'correct' || res.r.ok) head = `${nm}: перевод верный ✓`;
    else head = `${nm}: есть замечание`;
    return [head, f.ru || f.no || !res.r.ok ? reason : '', ...extra].filter(Boolean).join(' · ');
  }
  /** the AI checks one card; o: { provider, depth, mode } → { r, item, keys, main, by, mode, depth, snap, applied } */
  async function checkOne(card, o = {}) {
    const before = Store.card(card.id) || card;
    const depth = o.depth || depthOf(), mode = o.mode || fixMode();
    const snapB = cardSnap(before);
    const res = await AI.checkCards([before], null, { depth, provider: o.provider });
    const r = (res || []).find(x => x && x.id === before.id);
    if (!r) throw Object.assign(new Error('Нейросеть ответила непонятно — попробуйте ещё раз'), { calm: true });
    const fresh = Store.card(before.id) || before;
    const keys = ORDER.filter(f => r.changes && r.changes[f]);
    const item = itemOf(fresh, r, keys);
    const main = keys.filter(f => !SIDE(f));
    const out = { r, item, keys, main, by: r.by, mode, depth, snap: snapB, applied: 0, cardId: before.id };
    const note = [(item.issues || []).join('; '), depth === 'card' ? 'проверка всей карточки' : 'проверка слова и перевода'].filter(Boolean).join(' · ');
    if (mode === 'auto' && main.length) out.applied = applyFields(item, main, 'applied', note + ' · исправлено сразу, можно вернуть');
    if (!out.applied) Store.updateCard(before.id, AI.stamp(fresh, r.by, { action: 'check', pend: mode === 'ask' ? main : [], note: note + (main.length && mode === 'ask' ? ' · предложения ждут вашего решения' : r.ok ? ' · без замечаний ✓' : '') }));
    // one card checked (study card, viewer, editor): its word glosses are made again with the checked text — at once
    // when the card is on the screen in the word view (it is redrawn after the check), else the next time it is shown
    glossStale(before.id);
    return out;
  }
  /** «✓ Исправить» in the ask mode */
  function acceptOne(res, fields) {
    const n = applyFields(res.item, fields || res.main, 'accepted', [(res.item.issues || []).join('; '), 'принято вами'].filter(Boolean).join(' · '));
    res.applied += n;
    return n;
  }
  /** «Оставить как было» in the ask mode: the card stays, both sides get the ✓ of the check */
  function rejectOne(res) {
    if (rejectFields(res.item, res.main)) return; // rejectFields gave the ✓
    const c = Store.card(res.cardId);
    if (c) Store.updateCard(res.cardId, AI.stamp(c, res.by, { action: 'check', pend: stillPending(res.item), note: 'предложение нейросети отклонено вами — оставлено как было' }));
  }
  /** «↶ Вернуть»: the whole card as it was before the check (a field changed since then by hand stays) */
  function undoOne(res) {
    const cur = Store.card(res.cardId);
    if (!cur) return false;
    const patch = {}, back = {};
    SNAP.forEach(k => {
      if (k === 'history') return;
      const was = res.snap[k], x = res.item.f[k];
      // a field the person changed again after the fix is left alone
      if (x && (x.st === 'applied' || x.st === 'accepted')) {
        const now0 = cur[k];
        if (ARR(k) ? !same(now0, x.arr) : String(now0 == null ? '' : now0).trim() !== String(x.new).trim()) return;
        back[k] = { old: x.new, new: ARR(k) ? x.old : (was == null ? '' : String(was)) };
        x.st = 'undone';
      }
      patch[k] = was == null ? (ARR(k) ? [] : k === 'aiCheck' ? null : k === 'aiChecks' ? [] : k === 'aiChecked' ? 0 : '') : JSON.parse(JSON.stringify(was));
    });
    patch.history = (window.Prov ? Prov.add({ history: res.snap.history || [] }, Prov.entry('manual', 'edit', back, `↶ возвращено, как было до проверки ${aiName(res.by)}`)) : res.snap.history) || [];
    Store.updateCard(res.cardId, patch);
    return true;
  }
  /** the toast after a single check: what changed and «↶ Вернуть» (good colours, the AI's own logo) */
  function fixToast(res, onUndo) {
    const msg = fixLine(res);
    if (!res.applied) { UI.toast(msg, res.r.ok ? 'good' : '', res.r.ok ? 3500 : 6000); return null; }
    const t = UI.toastAction(msg, '↶ Вернуть', () => { if (undoOne(res)) { UI.toast('Вернула карточку, как была ✓', 'good', 2500); if (onUndo) onUndo(); } }, 16000, `<span class="aif-tlogo">${workLogo(res.by, { size: 26 })}</span>`);
    const el = [...document.querySelectorAll('#toast-root .toast-action')].pop();
    if (el) { el.classList.remove('warn'); el.classList.add('good', 'aif-toast'); }
    return t;
  }

  /** Views.runAiCheck → the same check for a few cards (selection, a new card, import): fixes at once + a report to undo any of them */
  async function checkList(cards, opts = {}) {
    cards = (cards || []).filter(Boolean);
    if (!cards.length) { UI.toast('Нет карточек для проверки', 'warn'); return; }
    if (!aiOn()) { if (window.AI && AI.bridge && AI.bridge.auth === 'bad') authHelp(); else if (window.Guides) Guides.needAI('Проверить карточки'); return; }
    if (cards.length === 1) {
      try {
        const res = await checkOne(cards[0]);
        const redraw = () => { opts.onDone && opts.onDone(); if (window.App && !opts.onDone) try { App.render(); } catch (e) { /* not drawn */ } };
        if (res.mode === 'ask' && res.main.length) askOne(res, redraw);
        else if (!(opts.quietIfOk && res.r.ok && !res.keys.length)) fixToast(res, redraw);
      } catch (e) { UI.toast(U.niceErr ? U.niceErr(e, 'Проверка нейросетью') : 'Нейросеть сейчас не ответила — попробуйте ещё раз', 'warn', 6000); return; }
      opts.onDone && opts.onDone();
      if (window.App && !opts.onDone) try { App.render(); } catch (e) { /* not drawn */ }
      return;
    }
    const nm = aiName(aiId());
    if (cards.length > 60 && !opts.noConfirm && !(await UI.confirm(`Проверить ${cardsN(cards.length)} через ${esc(nm)}? Это займёт время.`, { ok: 'Проверить' }))) return;
    const depth = depthOf(), auto = fixMode() === 'auto';
    const pt = UI.progressToast(`${nm} проверяет ${cardsN(cards.length)}…`);
    let results;
    try { results = await AI.checkCards(cards, (d, t) => pt.set(d, t, `${nm} проверяет… ${d} из ${t}`), { depth }); }
    catch (e) { pt.close(); UI.toast(U.niceErr ? U.niceErr(e, 'Проверка нейросетью') : 'Нейросеть сейчас не ответила', 'warn', 7000); return; }
    pt.close();
    const byDeck = {};
    cards.forEach(c => { (byDeck[c.deckId] = byDeck[c.deckId] || []).push(c); });
    const rep = { id: 'r' + now().toString(36), at: now(), end: now(), mode: auto ? 'auto' : 'review', scope: 'list', depth, by: [], status: 'done', total: cards.length,
      decks: Object.keys(byDeck).map(id => ({ id, name: (Store.deck(id) || {}).name || 'Карточки', total: byDeck[id].length, checked: 0, ok: 0, skipped: 0, items: [] })) };
    rep.decks.forEach(rd => record(rep, rd, byDeck[rd.id].map(c => Store.card(c.id) || c), results || [], auto));
    putReport(rep);
    const s = sums(rep);
    if (opts.quietIfOk && !s.items) { opts.onDone && opts.onDone(); return; }
    const msg = s.items ? `${aiName(rep.by[0] || aiId())} проверил ${cardsN(s.checked)}: ${auto ? `исправлено ${s.fixed}${s.added ? ` · дополнено ${s.added}` : ''}` : `с предложениями ${s.pendingCards}`}${s.ok ? ` · всё верно в ${s.ok}` : ''}` : `${aiName(rep.by[0] || aiId())}: все ${cardsN(s.checked)} в порядке ✓`;
    if (s.items) { const t = UI.toastAction(msg, auto ? '📋 Что изменилось' : '🙋 Решить', () => report(rep.id, { detail: true, deck: rep.decks[0] && rep.decks[0].id }), 16000, `<span class="aif-tlogo">${workLogo(rep.by[0] || aiId(), { size: 26 })}</span>`); const el = [...document.querySelectorAll('#toast-root .toast-action')].pop(); if (el && auto) { el.classList.remove('warn'); el.classList.add('good', 'aif-toast'); } void t; }
    else UI.toast(msg, 'good', 3500);
    if (!auto && s.pending && !opts.quietIfOk) report(rep.id, { detail: true, deck: rep.decks[0] && rep.decks[0].id });
    opts.onDone && opts.onDone();
    if (window.App && !opts.onDone) try { App.render(); } catch (e) { /* not drawn */ }
  }
  /** «сначала спрашивать» for one card outside the study card: a small window with the fix */
  function askOne(res, onDone) {
    const it = res.item;
    const rows = res.main.map(f => `<div class="aihr-f"><div class="aihr-fbody"><div class="aihr-fn">${esc(FNAME[f] || f)}</div>
      <div class="aihr-vals">${it.f[f].old ? `<s class="aihr-old">${esc(it.f[f].old)}</s>` : '<span class="aihr-empty">было пусто</span>'}<span class="aihr-arrow" aria-hidden="true">→</span><span class="aihr-new">${esc(it.f[f].new)}</span></div></div></div>`).join('');
    const m = UI.modal({
      title: `${workLogo(res.by, { size: 26 })} ${esc(shortName(res.by))} предлагает`, cls: 'aif-ask-modal',
      body: `<div class="aihr-word"><b>${esc(it.no)}</b> — ${esc(it.ru)}</div>${it.reason ? `<p class="aif-reason">${esc(it.reason)}</p>` : ''}${rows}`,
      foot: '<button type="button" class="btn ghost" data-a="no">Оставить как было</button><button type="button" class="btn primary" data-a="yes">✓ Исправить</button>',
    });
    m.el.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'yes') { acceptOne(res); fixToast(Object.assign({}, res, { mode: 'auto' }), onDone); }
      else rejectFields(it, res.main);
      m.close(); onDone && onDone();
    });
  }

  /* ---------- ⚙️ Настройки → 🤖 Нейросети: the same two choices (Views.settings is wrapped once) ---------- */
  function afterSettings(root) {
    const h = [...root.querySelectorAll('.panel h3')].find(x => /Нейросети/.test(x.textContent));
    if (!h || h.parentElement.querySelector('.aif-set')) return;
    const box = document.createElement('div');
    box.className = 'aif-set';
    box.innerHTML = `<div class="aif-set-h">${bot(true)}<div><b>Проверка карточек нейросетью</b><small>Так нейросеть работает и на карточке, и при проверке всей колоды.</small></div></div>${choiceRows()}${strategyRows()}`;
    h.parentElement.appendChild(box);
    markChoice(box, { mode: fixMode(), depth: depthOf(), full: fullOf() });
    markStrategy(box);
    box.addEventListener('click', e => {
      const sc = strategyClick(e, box);
      if (sc) { if (sc === 'strat') UI.toast('Сохранено', 'good', 1400); return; }
      const b = e.target.closest('[data-fixmode], [data-depth]'); if (!b) return;
      if (b.dataset.fixmode) setOpt('aiFixMode', b.dataset.fixmode); else setOpt('aiCheckDepth', b.dataset.depth);
      markChoice(box, { mode: fixMode(), depth: depthOf(), full: fullOf() });
      UI.toast('Сохранено', 'good', 1400);
    });
    const fl = box.querySelector('[data-full]');
    if (fl) fl.addEventListener('change', () => { setOpt('aiCheckFull', fl.checked); markChoice(box, { mode: fixMode(), depth: depthOf(), full: fullOf() }); UI.toast('Сохранено', 'good', 1400); });
  }
  function hookSettings() {
    if (!window.Views || !Views.settings || Views.settings._aif) return;
    const orig = Views.settings;
    Views.settings = function (root) { const r = orig.apply(this, arguments); try { afterSettings(root); } catch (e) { console.warn('aihub settings', e); } return r; };
    Views.settings._aif = true;
  }
  function hookCheck() {
    if (!window.Views || !Views.runAiCheck || Views.runAiCheck._aif) return;
    Views.runAiCheck = function (cards, opts) { return checkList(cards, opts || {}); };
    Views.runAiCheck._aif = true;
  }

  /* =====================================================================
   * 🧪 A hidden test bench (not in the interface): the SAME cards checked «порциями» and «по одной» by the same AI.
   *   await AIHub.benchModes(deckIdOrCards, { n: 8, depth: 'card', full: true, provider: 'gemini' })
   * Nothing on the cards changes (only AI.checkCards is asked). Returns tokens, time, requests of both ways and where the
   * two verdicts differ. It sends real requests — run it only on purpose (the owner's consent), never in tests.
   * ===================================================================== */
  async function benchModes(cards, o = {}) {
    if (!window.AI) throw new Error('Нет модуля нейросети');
    let list = typeof cards === 'string' ? Store.cards(cards) : (cards || []).map(c => (typeof c === 'string' ? Store.card(c) : c)).filter(Boolean);
    list = list.slice(0, Math.max(1, Math.min(40, o.n || 8)));
    if (!list.length) throw new Error('Нет карточек для проверки');
    const depth = o.depth === 'word' ? 'word' : 'card', full = o.full == null ? fullOf() : !!o.full;
    const provider = o.provider || AI.current();
    if (!provider || !AI.configured(provider)) throw new Error('Нейросеть не подключена: ' + provider);
    const sum = meter => meter.reduce((t, u) => ({ in: t.in + (u.in || 0), out: t.out + (u.out || 0), usd: t.usd + (u.usd || 0), est: t.est || !!u.est }), { in: 0, out: 0, usd: 0, est: false });
    const run = async one => {
      const meter = [], t0 = now();
      let res = [];
      if (one) { for (const c of list) res = res.concat(await AI.checkCards([c], null, { depth, full, provider, meter })); }
      else res = await AI.checkCards(list, null, { depth, full, provider, meter });
      const t = sum(meter);
      return { ms: now() - t0, requests: meter.length, in: t.in, out: t.out, total: t.in + t.out, usd: AI.costKind(provider) === 'paid' ? +t.usd.toFixed(5) : 0, estimated: t.est, res };
    };
    const brief = r => (r ? { verdict: r.verdict || (r.ok ? 'correct' : 'wrong'), fields: Object.keys(r.changes || {}).sort(), forms: r.changes && r.changes.forms ? (r.changes.forms.arr || []).length : 0, examples: r.changes && r.changes.examples ? (r.changes.examples.arr || []).length : 0, issues: r.issues || [] } : null);
    const batch = await run(false);
    const one = await run(true);
    const rows = list.map(c => {
      const a = brief(batch.res.find(r => r.id === c.id)), b = brief(one.res.find(r => r.id === c.id));
      const same = !!(a && b && a.verdict === b.verdict && a.fields.join() === b.fields.join());
      return { id: c.id, no: first(c.no), ru: first(c.ru), same, batch: a, one: b };
    });
    const strip = x => { const y = Object.assign({}, x); delete y.res; return y; };
    const out = {
      provider, model: AI.model(provider), cards: list.length, depth, full,
      batch: strip(batch), one: strip(one),
      ratio: { tokens: batch.total ? +(one.total / batch.total).toFixed(2) : null, time: batch.ms ? +(one.ms / batch.ms).toFixed(2) : null },
      sameVerdict: rows.filter(r => r.batch && r.one && r.batch.verdict === r.one.verdict).length,
      sameFields: rows.filter(r => r.same).length,
      answered: { batch: rows.filter(r => r.batch).length, one: rows.filter(r => r.one).length },
      diffs: rows.filter(r => !r.same),
    };
    const x = v => String(v).replace('.', ',');
    out.summary = `${AI.name(provider)}, ${list.length} ${plural(list.length, ['карточка', 'карточки', 'карточек'])}: по одной — ${x(out.ratio.tokens)}× токенов и ${x(out.ratio.time)}× времени; одинаковый вердикт у ${out.sameVerdict} из ${list.length}, совпали и правки у ${out.sameFields}.`;
    return out;
  }

  const AIHub = {
    open, report, checkDecks, showRun, pause, resume, stop,
    reports, onBadge,
    /** a provider passed «🔌 Проверить» in the settings (js/ai.js → AI.test) */
    onConnected() { connected(true); },
    onTestFail() { lastFail = now(); clearTimeout(conT); conT = 0; },
    /** for checks */
    state: () => ({ run: RUN ? JSON.parse(JSON.stringify(RUN)) : null, live, finished, done: runDone(), total: runTotal(),
      stage: { shown: stageUp(), phase: LV.phase, cur: LV.cur, deck: LV.deck, done: LV.done, chips: Object.assign({}, LV.state) } }),
    /** 🌀 living logos, ✓ marks on cards (js/views.js, js/study.js, js/artcards.js), 👀 the live view */
    workLogo, markHtml, marksPair, explainMark, paintWork, leaving, toFast, toLive,
    /** ✅ one card from the study card (js/study.js): check, fix at once or ask, «↶ Вернуть»; the owner's choices */
    checkOne, acceptOne, rejectOne, undoOne, fixToast, fixLine, checkList, fixMode, depthOf, choiceRows, markChoice,
    setFixMode: v => setOpt('aiFixMode', v === 'ask' ? 'ask' : 'auto'), setDepth: v => setOpt('aiCheckDepth', v === 'word' ? 'word' : 'card'),
    bot, FNAME,
    /** 🔑 Claude on this Mac asks to log in again (js/ai.js): a calm note / the panel with the exact commands */
    authNotice, authHelp,
    work: { begin: (p, kind) => Work.begin(p, kind || 'tr'), set: (id, p) => Work.set(id, p), end: id => Work.end(id), cur: k => Work.cur(k),
      last: k => Work.last(k), on: fn => Work.on(fn) },
    tvCoin,
    _why: why,
    benchModes,
  };
  window.AIHub = AIHub;
  addTopic();
  hookWork(); hookDeck(); hookSettings(); hookCheck();
  const boot = () => { addTopic(); addPlaces(); hookWork(); hookDeck(); hookSettings(); hookCheck(); paintWork(); armWake(); };
  // ⏳ a check waiting for a rested AI: the tab coming back / the network coming back look at the clock at once
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tickWake(); });
  window.addEventListener('online', () => { if (RUN && RUN.wake && RUN.wake.net) { RUN.wake.at = now(); tickWake(); } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
