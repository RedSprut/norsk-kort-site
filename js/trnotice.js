/* ============ 🌐 «Кто переводит» — before watching NRK / YouTube ============
 * Without a connected neural network the subtitles are translated by a free machine translator (Google and spares):
 * the general meaning is fine, but it can be wrong (idioms, a word in brackets without its sentence).
 * This window says so honestly and lets the user connect a neural network right here: pick one, get a key on its
 * site (step by step), paste it, the app checks it — done. The key stays only on this device, encrypted.
 * Shown before a program when no neural network is connected (until «больше не показывать»); a small badge in the
 * player opens it any time.
 */
(function () {
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  const OFF_KEY = 'nk-trnotice-off';
  const SEEN_KEY = 'nk-trnotice-seen'; // once per browser session at most
  // order: free first (no card needed), then cheap, then paid; programs on the Mac / own servers only in Settings
  const ORDER = ['gemini', 'groq', 'mistral', 'openrouter', 'cohere', 'deepseek', 'openai', 'anthropic', 'xai', 'nvidia', 'zai'];

  const esc = s => U.esc(String(s == null ? '' : s));
  const usable = id => {
    const p = AI.PROVIDERS[id]; if (!p) return false;
    if (AI.usableHere && !AI.usableHere(id)) return false; // W7: off the Mac only what can work here
    if (p.proxyOnly && !(AI.bridge && AI.bridge.up) && !(window.Net && Net.isNative && Net.isNative())) return false; // the browser cannot reach these without the Mac bridge
    return true;
  };

  const TrNotice = {
    /** who translates now (for the badge and the window) — the one that REALLY translated the last lines
     *  (before: Google translated, yet a connected network made the strip say «Переводит нейросеть…») */
    who() {
      const now = Translators.nowWho && Translators.nowWho();
      if (now && now.none) return { ai: false, none: true, name: 'бесплатный переводчик', gMin: now.gMin };
      const main = now && now.id ? now.id : Translators.dictMain();
      if (main === 'ai' && AI.available()) { const id = Translators.lastAI && AI.configured(Translators.lastAI) ? Translators.lastAI : AI.current(); return { ai: true, name: AI.PROVIDERS[id].name }; }
      const name = main === 'google' ? 'Google Переводчик' : ((Translators.LIST[main] || {}).name || 'бесплатный переводчик');
      return { ai: false, name, spare: !!(now && now.id && now.id !== Translators.dictMain()), gMin: now ? now.gMin : 0 };
    },
    /** before a program: the window (if no neural network and not turned off) + the badge in the player */
    maybe(src) {
      try { this.badge(); } catch (e) { /* the player is not there */ }
      if (AI.available()) return;
      let off = false, seen = false;
      try { off = !!localStorage.getItem(OFF_KEY); seen = !!sessionStorage.getItem(SEEN_KEY); } catch (e) { /* private mode */ }
      if (off || seen) return;
      try { sessionStorage.setItem(SEEN_KEY, '1'); } catch (e) { /* ok */ }
      this.open({ src });
    },
    /** the player's «кто переводит»: now ONE badge at the top of the window (TrBadge below); the old strip under the
     *  video is gone — this only repaints the badges (called after a new key, a redraw of the player) */
    badge() {
      document.querySelectorAll('.subs-modal [data-trwho]').forEach(b => b.remove());
      if (window.TrBadge) TrBadge.refresh();
    },
    open() {
      const w = this.who();
      const ids = ORDER.filter(usable);
      const kind = p => p.free ? '<span class="tn-chip free">бесплатно</span>' : p.cheap ? '<span class="tn-chip cheap">дёшево</span>' : '<span class="tn-chip paid">платно</span>';
      const row = id => {
        const p = AI.PROVIDERS[id], ok = AI.configured(id);
        // data-tnprov, not data-prov: app.js catches every [data-prov] click (provenance badges) in the capture phase
        return `<div class="tn-prov ${ok ? 'ok' : ''}" data-tnprov="${id}">
          <button type="button" class="tn-head" data-open="${id}" aria-expanded="false">
            <span class="tn-ico">${((h) => (h && !/>🤖</.test(h) ? h : BOT(24)))(AI.icon(id, 24))}</span>
            <span class="tn-name"><b>${esc(p.name)}</b> ${kind(p)}${ok ? ' <span class="tn-chip free">✓ ключ есть</span>' : ''}<small>${esc(p.limits || (p.cheap ? 'несколько центов за час субтитров' : 'оплата у самой компании, по использованию'))}</small></span>
            <span class="tn-go" aria-hidden="true">›</span></button>
          <div class="tn-body" hidden></div></div>`;
      };
      let off = false; try { off = !!localStorage.getItem(OFF_KEY); } catch (e) { /* ok */ }
      const NI = (n, sz) => (window.NavIcons ? NavIcons.icon(n, sz || 18) : '');
      const setup = !!(Translators.needSetup && Translators.needSetup()); // W7: nothing translates here yet (public build)
      const pro = (() => { try { return !!(window.Pro && Pro.offered() && !Pro.isActive()); } catch (e) { return false; } })();
      const m = UI.modal({
        title: `${NI('translate', 22)} Кто переводит субтитры`, cls: 'tn-modal',
        body: `${w.ai ? `<div class="mt-warn ok"><span>${BOT(20)}</span><span>Сейчас переводит нейросеть <b>${esc(w.name)}</b>: целую фразу по смыслу, а потом раскладывает этот смысл по словам. Можно выбрать другую ниже.</span></div>`
          : setup ? `<div class="mt-warn">${NI('translate')}<span>Чтобы субтитры переводились прямо здесь, подключите <b>Norsk Kort Pro</b> или свою нейросеть — это пара минут.</span></div>`
          : `<div class="mt-warn">${NI('translate')}<span>Сейчас субтитры переводит <b>${esc(w.name)}</b> — бесплатный машинный переводчик. Общий смысл он передаёт хорошо, но <b>может ошибаться</b>: в идиомах и в переводе отдельных слов в скобках.</span></div>
          <p class="tn-lead"><b>Для точного перевода подключите нейросеть.</b> Она переводит фразу целиком по смыслу и раскладывает этот смысл по словам — «ønska (хотел)», а не «ønska (желание)».</p>`}
          ${pro ? `<button type="button" class="tn-pro" data-tn-pro>${NI('crown', 24)}<span><b>Norsk Kort Pro</b><small>нейросеть без своих ключей — всё уже настроено</small></span><span class="tn-go" aria-hidden="true">›</span></button>` : ''}
          <div class="tn-safe">${NI('lock', 16)} Ключ хранится <b>только на этом устройстве, в зашифрованном виде</b>, и уходит только в выбранную нейросеть. Мы его не видим. Платите вы самой компании — и только если выбрали платную; у бесплатных есть дневной лимит.</div>
          <div class="tn-title">Выберите нейросеть</div>
          <div class="tn-list">${ids.map(row).join('')}</div>
          ${AI.bridge && AI.bridge.up && window.Net && Net.onMac && Net.onMac() ? '<p class="tiny muted">Есть подписка Claude? Она подключается через мост на Mac — Настройки → «Нейросети».</p>' : ''}`,
        foot: `<label class="tn-off"><input type="checkbox" data-off ${off ? 'checked' : ''}> больше не показывать перед передачами</label>
          <button class="btn ${w.ai ? 'primary' : 'ghost'}" data-later>${w.ai ? 'Готово' : setup ? 'Позже' : 'Продолжить с бесплатным переводом'}</button>`,
      });
      m.$('[data-later]').onclick = () => m.close();
      m.$('[data-off]').onchange = e => { try { if (e.target.checked) localStorage.setItem(OFF_KEY, '1'); else localStorage.removeItem(OFF_KEY); } catch (_) { /* ok */ } };
      m.el.addEventListener('click', async e => {
        if (e.target.closest('[data-tn-pro]')) { m.close(); Pro.require('Перевод субтитров', { reason: 'translate' }); return; }
        const h = e.target.closest('[data-open]');
        if (h) { this.expand(m, h.dataset.open); return; }
        const go = e.target.closest('[data-connect]');
        if (go) { await this.connect(m, go.dataset.connect); }
      });
      m.el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-key]')) { e.preventDefault(); this.connect(m, e.target.dataset.key); } });
      return m;
    },
    /** one network opened: where to get the key, step by step, and the field for it */
    expand(m, id) {
      m.$$('.tn-prov').forEach(x => { const on = x.dataset.tnprov === id &&x.querySelector('.tn-body').hidden; x.classList.toggle('open', on); x.querySelector('.tn-body').hidden = !on; x.querySelector('.tn-head').setAttribute('aria-expanded', on ? 'true' : 'false'); });
      const box = m.$(`.tn-prov[data-tnprov="${id}"] .tn-body`); if (!box || box.hidden) return;
      const p = AI.PROVIDERS[id], c = AI.cfg(id);
      const host = (() => { try { return new URL(p.keyUrl).host; } catch (e) { return ''; } })();
      box.innerHTML = `<ol class="tn-steps">
          <li>Откройте сайт <b>${esc(host)}</b> и войдите (${p.free ? 'бесплатно, карта не нужна' : 'нужна оплата у компании'}):
            <a class="btn sm" href="${esc(p.keyUrl)}" target="_blank" rel="noopener">↗ Получить ключ</a></li>
          <li>Нажмите «Create key» / «Создать ключ» и <b>скопируйте</b> его.</li>
          <li>Вставьте ключ сюда и нажмите «Подключить» — приложение проверит, что он работает.</li></ol>
        <div class="tn-keyrow">
          <input class="input" type="password" data-key="${id}" value="${esc(c.key || '')}" placeholder="вставьте ключ" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Ключ ${esc(p.name)}">
          <button class="btn primary" data-connect="${id}">Подключить</button></div>
        <div class="tn-status small" data-st="${id}" role="status" aria-live="polite"></div>`;
      setTimeout(() => { const i = box.querySelector('[data-key]'); if (i && !i.value) i.focus({ preventScroll: true }); }, 60);
    },
    /** save the key (encrypted with the settings), make it the active network, check it with one tiny request */
    async connect(m, id) {
      const inp = m.$(`[data-key="${id}"]`), st = m.$(`[data-st="${id}"]`), btn = m.$(`[data-connect="${id}"]`);
      const key = (inp && inp.value || '').trim().replace(/^Bearer\s+/i, '');
      if (!key) { if (st) st.innerHTML = '<span class="warn-t">Сначала вставьте ключ.</span>'; return; }
      if (key.length < 12 || /\s/.test(key)) { if (st) st.innerHTML = '<span class="warn-t">Похоже, ключ скопирован не полностью — скопируйте его ещё раз целиком.</span>'; return; }
      const prev = { key: AI.cfg(id).key, provider: Store.settings.aiProvider };
      AI.cfg(id).key = key; Store.save();
      if (btn) btn.disabled = true;
      if (st) st.innerHTML = '<span class="spinner sm"></span> Проверяю ключ…';
      try {
        await AI.test(id);
        Store.setSetting('aiProvider', id);
        if (window.App && App.updateBadge) App.updateBadge();
        if (st) st.innerHTML = `<span class="good-t">✓ Подключено — теперь переводит ${esc(AI.PROVIDERS[id].short)}</span>`;
        UI.toast(`Подключено: ${AI.PROVIDERS[id].name}. Новые строки переводятся по смыслу.`, 'good', 4500);
        this.badge();
        setTimeout(() => m.close(), 900);
      } catch (e) {
        // the key did not work: the old setting comes back, a plain explanation (no technical text)
        AI.cfg(id).key = prev.key || ''; Store.save();
        const msg = String(e && e.message || '');
        // AI.errText speaks Russian («неверный ключ», «лимит запросов исчерпан», «Нет связи») — match both languages
        const why = /401|403|invalid|unauthor|incorrect|api key|неверный ключ|нет доступа/i.test(msg) ? 'Ключ не подошёл — проверьте, что скопировали его полностью, и что он от этой нейросети.'
          : /429|limit|quota|rate|лимит|нет средств/i.test(msg) ? 'Ключ верный, но лимит этой нейросети сейчас исчерпан — попробуйте позже или выберите другую.'
          : /fetch|network|failed|cors|нет связи/i.test(msg) ? 'Нет связи с сервисом — проверьте интернет (или блокировщик рекламы) и попробуйте ещё раз.'
          : 'Нейросеть не ответила — попробуйте ещё раз через минуту или выберите другую.';
        if (st) st.innerHTML = `<span class="warn-t">${why}</span>`;
      } finally { if (btn) btn.disabled = false; }
    },
  };
  window.TrNotice = TrNotice;
})();

/* ============ 🌐 TrBadge — ONE «Кто переводит» badge at the top of a window that translates by itself ============
 * TrBadge.mount(el, { place }) — el: the window's .modal-head (the badge goes right after the title) or any box;
 * place: where the translations belong ('subs:nrk', 'subs:youtube', 'reader', 'news', 'tgchan', 'dialogs', …).
 * Shows the brand tile of the translator that REALLY translates now + «Переводит Google». Driven by the 'tr-who' event
 * of js/translators.js: when the translator changes, the tile swaps (calmly; reduced motion → at once) and a short
 * caption says why for ~3 s («Google попросил паузу — теперь переводит MyMemory»). A tap opens the chain: who works,
 * who is next, who rests / is out of its limit and until when, who needs a key («подключить») — and lets the user pick
 * the translator asked first in THIS place (remembered per place). The last shown badge's place is also used for
 * translations started without opts.place (TrBadge.activePlace) — so a window only has to mount the badge.
 */
(function () {
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  const esc = s => U.esc(String(s == null ? '' : s));
  const list = []; // mounted badges, newest last
  let busyN = 0, onlineCapAt = 0;
  const T = () => window.Translators;
  /** animate? the device's «reduce motion» — unless the app's own setting says otherwise */
  function motion() {
    try {
      const s = window.Store && Store.settings, f = s && (s.forceMotion != null ? s.forceMotion : s.motion);
      if (f === true || f === 'on' || f === 'always') return true;
      if (f === false || f === 'off' || f === 'never') return false;
    } catch (e) { /* settings not loaded */ }
    return !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  const NI = (n, sz) => (window.NavIcons ? NavIcons.icon(n, sz || 18) : '');
  const tile = key => (key && T() && T().brand ? T().brand(key) : waitTile(NI('translate')));
  // a grey tile with a drawn icon (W7: never an emoji)
  const waitTile = ico => `<span class="tool-chip trb-wait" style="--chip-bg:linear-gradient(160deg, #9aa1ad, #6b7280);--gs:62%"><span class="tool-emoji">${ico}</span></span>`;
  /** W7: nothing that can translate here is set up (the public build without Pro / a key) — not «busy»: a calm hint */
  const needSetup = () => { try { return !!(T() && T().needSetup && T().needSetup()); } catch (e) { return false; } };
  const SETUP_FULL = 'Чтобы переводить прямо здесь, подключите Norsk Kort Pro или свою нейросеть (Gemini и Groq — бесплатно)';
  const hhmm = t => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  /** «до 14:20» / «завтра в 09:10» */
  const when = t => { const d = new Date(t), n = new Date(); return d.toDateString() === n.toDateString() ? `до ${hhmm(t)}` : `до завтра, ${hhmm(t)}`; };
  const limitWord = id => (id === 'deepl' || id === 'microsoft' ? 'месячный лимит' : id === 'mymemory' ? 'дневной лимит' : 'лимит');
  const kindOf = id => (id === 'ai' ? 'нейросеть' : '');

  /** what the badge shows now: { key, id, name } or { none, reason } */
  function stateOf(b) {
    const now = T().nowWho && T().nowWho();
    if (navigator.onLine === false) return { none: true, reason: 'offline' };
    if (needSetup()) return { none: true, reason: 'setup' };
    if (now && now.none) return { none: true, reason: now.reason || 'busy' };
    if (now && now.id) return { id: now.id, key: now.key, name: now.short };
    const c = T().chain(b.place).find(x => x.state === 'work');
    return c ? { id: c.id, key: c.key, name: c.name } : { none: true, reason: 'busy' };
  }
  const noneName = r => (r === 'offline' ? 'нет интернета' : r === 'setup' ? 'подключите переводчик' : 'переводчики заняты');
  const noneFull = r => (r === 'offline' ? 'Нет интернета — перевод продолжится, когда связь вернётся' : r === 'setup' ? SETUP_FULL : 'Переводчики ненадолго заняты — перевод продолжится сам');
  const noneIco = r => NI(r === 'offline' ? 'wifi-off' : r === 'setup' ? 'translate' : 'hourglass');
  /** the short caption of a switch, in plain words ('' — nothing to say) */
  function capText(d) {
    const to = d.name, from = d.prevName;
    if (d.none && needSetup()) return SETUP_FULL;
    if (d.none) return d.reason === 'offline' ? 'Нет интернета — перевод продолжится, когда связь вернётся'
      : `Переводчики ненадолго заняты — перевод продолжится сам${d.restUntil ? `, примерно в ${hhmm(d.restUntil)}` : ''}`;
    switch (d.reason) {
      case 'pause': return `${from} попросил паузу — теперь переводит ${to}`;
      case 'limit': return `У ${from} закончился ${limitWord(d.prev)} — ${d.who === 'ai' ? 'перевожу нейросетью' : `теперь переводит ${to}`}`;
      case 'busy': return from ? `${from} не отвечает — теперь переводит ${to}` : '';
      case 'ai-fail': return `Нейросеть не ответила — переключаюсь на ${to}`;
      case 'ai-next': return from ? `${from} не ответила — переводит ${to}` : '';
      case 'back': return d.wasOffline ? `Связь вернулась — переводит ${to}` : !d.prev ? `Перевод продолжается — переводит ${to}` : `${to} снова переводит`;
      case 'pick': return `Как вы выбрали: теперь переводит ${to}`;
      default: return '';
    }
  }

  function paint(b, s, animate) {
    const sig = s.none ? 'none:' + s.reason : s.key;
    const btn = b.el.querySelector('.trb');
    btn.classList.toggle('none', !!s.none);
    const lab = s.none ? (s.reason === 'setup' ? 'Перевод:' : 'Перевод ждёт:') : 'Переводит', name = s.none ? noneName(s.reason) : s.name;
    b.el.querySelector('.trb-lab').textContent = lab;
    b.el.querySelector('.trb-name').textContent = name;
    const full = s.none ? noneFull(s.reason)
      : `Переводит ${s.name}${kindOf(s.id) ? ' (' + kindOf(s.id) + ')' : ''}`;
    btn.title = `${full}. Нажмите — кто переводит по очереди и кого просить первым`;
    btn.setAttribute('aria-label', `${full}. Очередь переводчиков и выбор`);
    if (b.sig === sig) return;
    const html = s.none ? waitTile(noneIco(s.reason)) : tile(s.key);
    const [x, y] = b.el.querySelectorAll('.trb-t');
    const shown = x.classList.contains('out') ? y : x, next = shown === x ? y : x;
    if (!b.sig || !animate || !motion()) {
      shown.innerHTML = html; next.classList.add('out'); shown.classList.remove('out');
    } else {
      next.innerHTML = html;
      // the new tile comes in, the old one goes out (one frame later, so the transition runs)
      next.classList.add('pre'); next.classList.remove('out');
      requestAnimationFrame(() => { next.classList.remove('pre'); shown.classList.add('out'); });
      b.el.classList.remove('swap'); void b.el.offsetWidth; b.el.classList.add('swap');
    }
    b.sig = sig;
  }
  function caption(b, text) {
    if (!text) return;
    const c = b.el.querySelector('.trb-cap');
    c.hidden = false; // shown first, then the words: a screen reader announces them
    clearTimeout(b.capT); clearTimeout(b.capT2);
    up(b);
    requestAnimationFrame(() => { c.textContent = text; place(b, c); c.classList.add('on'); });
    b.capT = setTimeout(() => { c.classList.remove('on'); b.capT2 = setTimeout(() => { c.hidden = true; up(b); }, motion() ? 260 : 0); }, 3400);
  }
  /** while a bubble (caption / popover) is out, the badge's row is above the window's content (a sticky title row
   *  is a layer of its own: the video's buttons would cover the bubble) */
  function up(b) {
    const c = b.el.querySelector('.trb-cap'), on = b.el.classList.contains('open') || (c && !c.hidden);
    b.host.classList.toggle('trb-up', !!on); b.el.classList.toggle('trb-up', !!on);
  }
  /** a bubble under the badge stays inside the screen (16 px from its edges) */
  function place(b, el) {
    el.style.left = '0px';
    const r = b.el.getBoundingClientRect(), w = el.offsetWidth, vw = document.documentElement.clientWidth || innerWidth;
    const left = Math.min(Math.max(16, r.left), Math.max(16, vw - 16 - w));
    el.style.left = Math.round(left - r.left) + 'px';
  }

  /* ---------- the popover: the chain + «кого просить первым здесь» ---------- */
  function popHtml(b) {
    const Tr = T(), ch = Tr.chain(b.place), pref = Tr.prefFor(b.place);
    const work = ch.find(x => x.state === 'work');
    let firstNext = true;
    const stateTxt = x => {
      if (x.state === 'work') return 'переводит сейчас';
      if (x.state === 'next') { const t = firstNext && work ? `следующий — если ${work.name} не ответит` : 'в очереди'; firstNext = false; return t; }
      if (x.state === 'rest') return x.id === 'google' ? `попросил паузу — ${when(x.until)}` : `не отвечает — снова попробую ${when(x.until).replace(/^до /, 'около ')}`;
      if (x.state === 'limit') return `закончился ${limitWord(x.id)} — снова ${when(x.until).replace(/^до /, 'с ')}`;
      return x.id === 'ai' ? 'нужен ключ (Gemini и Groq — бесплатно)' : 'нужен ключ';
    };
    let n = 0;
    const rows = ch.map(x => `<li class="trb-row s-${x.state}">
        <span class="trb-n" aria-hidden="true">${x.state === 'key' ? '' : ++n}</span>
        <span class="trb-rt-ico" aria-hidden="true">${x.state === 'key' && x.id === 'ai' ? waitTile(BOT(20)) : tile(x.key)}</span>
        <span class="trb-rt"><b>${esc(x.name)}</b>${kindOf(x.id) && x.state !== 'key' ? ` <span class="trb-kind">нейросеть</span>` : ''}<small>${esc(stateTxt(x))}</small></span>
        ${x.state === 'key' ? `<button type="button" class="btn sm trb-key" data-trb-key="${x.id}" title="${x.id === 'ai' ? 'Подключить нейросеть — она переводит по смыслу предложения' : `Подключить ${esc(x.name)}: ключ вписывается в Настройках`}">подключить</button>` : ''}
      </li>`).join('');
    const can = ch.filter(x => x.state !== 'key');
    const pick = (id, label, t, ico) => `<button type="button" class="trb-pick${(pref || 'auto') === id ? ' on' : ''}" role="radio" aria-checked="${(pref || 'auto') === id}" data-trb-pick="${id}" title="${esc(t)}">${ico || ''}<span>${esc(label)}</span></button>`;
    return `<div class="trb-pop-h">Кто переводит здесь</div>
      <ol class="trb-chain">${rows}</ol>
      <div class="trb-pop-h2" id="trb-ph-${b.id}">Кого просить первым в этом окне</div>
      <div class="trb-picks" role="radiogroup" aria-labelledby="trb-ph-${b.id}">
        ${pick('auto', 'По порядку', 'Как в настройках: первым — тот, кто стоит первым; не ответит — следующий', '')}
        ${can.map(x => pick(x.id, x.name, `Просить первым ${x.name}${x.id === 'ai' ? ' (нейросеть)' : ''} — если не ответит, приложение само возьмёт следующего`, `<span class="trb-pick-ico" aria-hidden="true">${tile(x.key)}</span>`)).join('')}
      </div>
      <div class="trb-keynote" data-trb-keynote hidden></div>
      <p class="tiny muted trb-pop-foot">Выбор запоминается для этого окна. Если переводчик не ответит, приложение само переключится на следующего.</p>`;
  }
  function popOpen(b) {
    popClose();
    const pop = b.el.querySelector('.trb-pop');
    pop.innerHTML = popHtml(b);
    pop.hidden = false;
    b.el.querySelector('.trb').setAttribute('aria-expanded', 'true');
    b.el.classList.add('open'); up(b);
    place(b, pop);
    const first = pop.querySelector('.trb-pick.on') || pop.querySelector('button');
    if (first) first.focus({ preventScroll: true });
    const out = e => { if (!b.el.contains(e.target)) popClose(); };
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); popClose(); b.el.querySelector('.trb').focus({ preventScroll: true }); } };
    setTimeout(() => document.addEventListener('pointerdown', out, true), 0);
    document.addEventListener('keydown', key, true);
    b.popOff = () => { document.removeEventListener('pointerdown', out, true); document.removeEventListener('keydown', key, true); };
    TrBadge._open = b;
  }
  function popClose() {
    const b = TrBadge._open; if (!b) return;
    TrBadge._open = null;
    if (b.popOff) b.popOff();
    const pop = b.el.querySelector('.trb-pop'); if (pop) { pop.hidden = true; pop.innerHTML = ''; }
    b.el.classList.remove('open'); up(b);
    const btn = b.el.querySelector('.trb'); if (btn) btn.setAttribute('aria-expanded', 'false');
  }
  function onPopClick(b, e) {
    const p = e.target.closest('[data-trb-pick]');
    if (p) {
      const id = p.dataset.trbPick;
      T().setPref(b.place, id);
      // the first one that will be asked now (the chosen one — unless it rests): the badge shows it at once
      const ch = T().chain(b.place), want = id === 'auto' ? null : ch.find(x => x.id === id);
      const first = want && (want.state === 'rest' || want.state === 'limit') ? null : want || ch.find(x => x.state === 'work' || x.state === 'next');
      if (first) {
        const Tr = T(); Tr._now = { id: first.id, key: first.key, at: Date.now() }; Tr._who = { id: first.id, key: first.key, at: Date.now(), reason: 'pick' };
        list.forEach(x => { if (x.place === b.place && x.el.isConnected) paint(x, { id: first.id, key: first.key, name: first.name }, true); });
      }
      caption(b, !first ? `${want.name} сейчас отдыхает — начнёт переводить, как только сможет`
        : id === 'auto' ? `Снова по порядку — первым переводит ${first.name}` : `Как вы выбрали: теперь переводит ${first.name}`);
      const pop = b.el.querySelector('.trb-pop'); pop.innerHTML = popHtml(b); place(b, pop);
      const on = pop.querySelector('.trb-pick.on'); if (on) on.focus({ preventScroll: true });
      return;
    }
    const k = e.target.closest('[data-trb-key]');
    if (k) {
      const id = k.dataset.trbKey;
      if (id === 'ai') { popClose(); if (window.TrNotice) TrNotice.open(); return; }
      const note = b.el.querySelector('[data-trb-keynote]');
      const nm = (T().LIST[id] || {}).name || id;
      note.hidden = false;
      note.innerHTML = `${esc(nm)}: ключ вписывается в Настройках → «Переводчики». Настройки откроются вместо этого окна.
        <button type="button" class="btn sm" data-trb-settings title="Закрыть это окно и открыть Настройки">Открыть настройки</button>`;
      note.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.target.closest('[data-trb-settings]')) {
      popClose();
      document.querySelectorAll('.modal-backdrop [data-close]').forEach(x => x.click());
      if (window.App && App.go) App.go('settings');
      UI.toast('Впишите ключ в разделе «Переводчики»', '', 6000);
    }
  }

  let seq = 0;
  const TrBadge = {
    _open: null,
    /** put the badge into el (a .modal-head → right after the title); again on the same el → just repaints */
    mount(el, o = {}) {
      if (!el || !window.Translators) return null;
      let b = list.find(x => x.host === el && x.el.isConnected);
      if (b) { b.place = o.place || b.place; list.splice(list.indexOf(b), 1); list.push(b); this.update(b); return b; }
      const wrap = document.createElement('span');
      wrap.className = 'trb-wrap' + (motion() ? '' : ' trb-still');
      wrap.innerHTML = `<button type="button" class="trb" aria-haspopup="dialog" aria-expanded="false">
          <span class="trb-ico" aria-hidden="true"><span class="trb-t"></span><span class="trb-t out"></span><span class="trb-ring"></span></span>
          <span class="trb-txt"><span class="trb-lab">Переводит</span> <b class="trb-name"></b></span>
          <span class="trb-car" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span></button>
        <span class="trb-cap" role="status" aria-live="polite" hidden></span>
        <div class="trb-pop" role="dialog" aria-label="Кто переводит" hidden></div>`;
      const h2 = el.classList.contains('modal-head') ? el.querySelector('h2') : null;
      if (h2) { h2.after(wrap); el.classList.add('trb-head'); } else el.appendChild(wrap);
      b = { id: ++seq, el: wrap, host: el, place: o.place || '', sig: '' };
      wrap.querySelector('.trb').addEventListener('click', () => (TrBadge._open === b ? popClose() : popOpen(b)));
      wrap.querySelector('.trb-pop').addEventListener('click', e => onPopClick(b, e));
      wrap.classList.toggle('busy', busyN > 0);
      list.push(b);
      this.update(b);
      return b;
    },
    unmount(el) { list.slice().forEach(b => { if (!el || b.host === el || b.el === el) { if (TrBadge._open === b) popClose(); b.el.remove(); list.splice(list.indexOf(b), 1); } }); },
    update(b) { if (b && b.el.isConnected) { paint(b, stateOf(b), false); if (TrBadge._open === b) { const pop = b.el.querySelector('.trb-pop'); pop.innerHTML = popHtml(b); place(b, pop); } } },
    /** repaint every badge on the screen (a new key, another network chosen, the player redrawn) */
    refresh() { this.prune(); list.forEach(b => this.update(b)); },
    prune() { for (let i = list.length - 1; i >= 0; i--) if (!list[i].el.isConnected) list.splice(i, 1); },
    /** the place of the window whose badge is on the screen (the newest one) — '' when none */
    activePlace() { this.prune(); for (let i = list.length - 1; i >= 0; i--) if (list[i].el.offsetParent !== null || list[i].el.getClientRects().length) return list[i].place; return ''; },
    capText,
  };

  window.addEventListener('tr-who', e => {
    const d = e.detail || {};
    TrBadge.prune();
    // a switch caused by «Связь вернулась» has been said already (the 'online' caption a moment ago)
    const quiet = d.reason === 'back' && d.wasOffline && Date.now() - onlineCapAt < 20000;
    list.forEach(b => {
      if (d.place && b.place && d.place !== b.place) return;
      paint(b, d.none ? { none: true, reason: needSetup() ? 'setup' : d.reason } : { id: d.who, key: d.key, name: d.name }, true);
      if (!quiet) caption(b, capText(d));
      if (TrBadge._open === b) TrBadge.update(b);
    });
  });
  window.addEventListener('tr-busy', e => { busyN = (e.detail && e.detail.n) || 0; TrBadge.prune(); list.forEach(b => b.el.classList.toggle('busy', busyN > 0)); });
  window.addEventListener('offline', () => { try { if (window.Translators) Translators._whoNone({}); } catch (e) { /* ok */ } });
  window.addEventListener('online', () => {
    TrBadge.prune(); if (!list.length) return;
    onlineCapAt = Date.now();
    list.forEach(b => {
      const c = T().chain(b.place).find(x => x.state === 'work');
      if (T()._now && T()._now.none) T()._now = null; // the next lines will say who
      if (c) paint(b, { id: c.id, key: c.key, name: c.name }, true);
      caption(b, 'Связь вернулась — перевод продолжается');
    });
  });
  window.TrBadge = TrBadge;
})();
