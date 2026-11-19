/* ============ 🌐 «Кто переводит» — before watching NRK / YouTube ============
 * Without a connected neural network the subtitles are translated by a free machine translator (Google and spares):
 * the general meaning is fine, but it can be wrong (idioms, a word in brackets without its sentence).
 * This window says so honestly and lets the user connect a neural network right here: pick one, get a key on its
 * site (step by step), paste it, the app checks it — done. The key stays only on this device, encrypted.
 * Shown before a program when no neural network is connected (until «больше не показывать»); a small badge in the
 * player opens it any time.
 */
(function () {
  const OFF_KEY = 'nk-trnotice-off';
  const SEEN_KEY = 'nk-trnotice-seen'; // once per browser session at most
  // order: free first (no card needed), then cheap, then paid; programs on the Mac / own servers only in Settings
  const ORDER = ['gemini', 'groq', 'mistral', 'openrouter', 'cohere', 'deepseek', 'openai', 'anthropic', 'xai', 'nvidia', 'zai'];

  const esc = s => U.esc(String(s == null ? '' : s));
  const usable = id => {
    const p = AI.PROVIDERS[id]; if (!p) return false;
    if (p.proxyOnly && !(AI.bridge && AI.bridge.up)) return false; // the browser cannot reach these without the Mac bridge
    return true;
  };

  const TrNotice = {
    /** who translates now (for the badge and the window) */
    who() {
      // the network that really answered last (when the chosen one ran out of its limit, the next one translates)
      if (AI.available()) { const id = AI.lastProvider && AI.configured(AI.lastProvider) ? AI.lastProvider : AI.current(); return { ai: true, name: AI.PROVIDERS[id].name }; }
      return { ai: false, name: Translators.dictMain() === 'google' ? 'Google Переводчик' : ((Translators.LIST[Translators.dictMain()] || {}).name || 'бесплатный переводчик') };
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
    /** the small line in the player: «🌐 Перевод: Google (бесплатно, может ошибаться) · ⚡ точнее с нейросетью» */
    badge() {
      const host = document.querySelector('.subs-modal .subs-src'); if (!host) return;
      let b = host.parentElement.querySelector('[data-trwho]');
      if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'tr-who'; b.dataset.trwho = ''; host.after(b); b.onclick = () => this.open({}); }
      const w = this.who();
      b.classList.toggle('ai', w.ai);
      b.innerHTML = w.ai
        ? `<span>🤖</span><span>Переводит нейросеть <b>${esc(w.name)}</b> — по смыслу предложения</span><span class="tr-who-go">сменить</span>`
        : `<span>🌐</span><span>Переводит <b>${esc(w.name)}</b> — бесплатно, может ошибаться</span><span class="tr-who-go">⚡ Точнее с нейросетью</span>`;
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
            <span class="tn-ico">${AI.icon(id, 24) || '🤖'}</span>
            <span class="tn-name"><b>${esc(p.name)}</b> ${kind(p)}${ok ? ' <span class="tn-chip free">✓ ключ есть</span>' : ''}<small>${esc(p.limits || (p.cheap ? 'несколько центов за час субтитров' : 'оплата у самой компании, по использованию'))}</small></span>
            <span class="tn-go" aria-hidden="true">›</span></button>
          <div class="tn-body" hidden></div></div>`;
      };
      let off = false; try { off = !!localStorage.getItem(OFF_KEY); } catch (e) { /* ok */ }
      const m = UI.modal({
        title: '🌐 Кто переводит субтитры', cls: 'tn-modal',
        body: `${w.ai ? `<div class="mt-warn ok"><span>🤖</span><span>Сейчас переводит нейросеть <b>${esc(w.name)}</b>: целую фразу по смыслу, а потом раскладывает этот смысл по словам. Можно выбрать другую ниже.</span></div>`
          : `<div class="mt-warn"><span>🌐</span><span>Сейчас субтитры переводит <b>${esc(w.name)}</b> — бесплатный машинный переводчик. Общий смысл он передаёт хорошо, но <b>может ошибаться</b>: в идиомах и в переводе отдельных слов в скобках.</span></div>
          <p class="tn-lead"><b>Для точного перевода подключите нейросеть.</b> Она переводит фразу целиком по смыслу и раскладывает этот смысл по словам — «ønska (хотел)», а не «ønska (желание)».</p>`}
          <div class="tn-safe">🔐 Ключ хранится <b>только на этом устройстве, в зашифрованном виде</b>, и уходит только в выбранную нейросеть. Мы его не видим. Платите вы самой компании — и только если выбрали платную; у бесплатных есть дневной лимит.</div>
          <div class="tn-title">Выберите нейросеть</div>
          <div class="tn-list">${ids.map(row).join('')}</div>
          ${AI.bridge && AI.bridge.up ? '<p class="tiny muted">Есть подписка Claude? Она подключается через мост на Mac — Настройки → «Нейросети».</p>' : ''}`,
        foot: `<label class="tn-off"><input type="checkbox" data-off ${off ? 'checked' : ''}> больше не показывать перед передачами</label>
          <button class="btn ${w.ai ? 'primary' : 'ghost'}" data-later>${w.ai ? 'Готово' : 'Продолжить с бесплатным переводом'}</button>`,
      });
      m.$('[data-later]').onclick = () => m.close();
      m.$('[data-off]').onchange = e => { try { if (e.target.checked) localStorage.setItem(OFF_KEY, '1'); else localStorage.removeItem(OFF_KEY); } catch (_) { /* ok */ } };
      m.el.addEventListener('click', async e => {
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
        UI.toast(`🤖 Подключено: ${AI.PROVIDERS[id].name}. Новые строки переводятся по смыслу.`, 'good', 4500);
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
