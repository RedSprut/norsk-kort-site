/* ============ App bootstrap & routing ============ */
(function () {
  /* 🤖 the AI button (updateBadge): own little logos of the AI services — a glyph on the service's colour,
     drawn here so they are crisp, offline and never grey (no network favicons). [background, glyph in a 24×24 box] */
  const aibRays = (n, lens, w) => `<path d="${Array.from({ length: n }, (_, i) => {
    const a = i * Math.PI * 2 / n - Math.PI / 2, r = lens[i % lens.length], c = Math.cos(a), s = Math.sin(a);
    return `M${(12 + 2.1 * c).toFixed(2)} ${(12 + 2.1 * s).toFixed(2)}L${(12 + r * c).toFixed(2)} ${(12 + r * s).toFixed(2)}`;
  }).join('')}" stroke="#fff" stroke-width="${w}" stroke-linecap="round"/>`;
  const AIB_W = 'fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round"';
  const AIB_LOGO = {
    claude: ['#d97757', aibRays(10, [7.4, 6.2, 7, 5.8, 7.2], 2)],
    openai: ['#10a37f', `<g ${AIB_W} stroke-width="1.55"><ellipse cx="12" cy="12" rx="6.6" ry="3.1"/><ellipse cx="12" cy="12" rx="6.6" ry="3.1" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="6.6" ry="3.1" transform="rotate(-60 12 12)"/></g>`],
    gemini: ['linear-gradient(135deg, #4b8dff, #8e6cf0 60%, #c86fd6)', '<path d="M12 3.6c.55 4.5 3.9 7.85 8.4 8.4-4.5.55-7.85 3.9-8.4 8.4-.55-4.5-3.9-7.85-8.4-8.4 4.5-.55 7.85-3.9 8.4-8.4z" fill="#fff"/>'],
    deepseek: ['#4d6bfe', '<path d="M3.9 13.1c0-3.3 3.1-5.5 6.9-5.5 2.6 0 4.7 1.1 5.8 2.9.7-1.4 2-2.4 3.6-2.7-.5 1.5-.5 2.9.2 4.1-1.1.3-2.1.1-3-.4-.6 3.3-3.6 5.6-7.5 5.6-3.5 0-6-1.6-6-4z" fill="#fff"/><circle cx="8.3" cy="11.7" r="1" fill="#4d6bfe"/><path d="M6.6 14.6c1.6.9 3.8 1.1 5.6.4" stroke="#4d6bfe" stroke-width="1" stroke-linecap="round" fill="none"/>'],
    groq: ['#f55036', `<g ${AIB_W} stroke-width="2.2"><circle cx="12" cy="10.4" r="3.7"/><path d="M15.7 10.4v4.1a3.7 3.7 0 0 1-6.6 2.3"/></g>`],
    openrouter: ['#6467f2', `<g ${AIB_W} stroke-width="1.8"><path d="M4.2 12h3.4c2.6 0 3-4.6 5.6-4.6h5.2M7.6 12c2.6 0 3 4.6 5.6 4.6h5.2M16.3 5.2l2.2 2.2-2.2 2.2M16.3 14.4l2.2 2.2-2.2 2.2"/></g>`],
    mistral: ['linear-gradient(160deg, #ffb000, #fa520f 55%, #e10500)', '<path fill="#fff" d="M5.5 5.5h2.6v2.6h-2.6zM15.9 5.5h2.6v2.6h-2.6zM5.5 8.1h2.6v2.6h-2.6zM8.1 8.1h2.6v2.6h-2.6zM13.3 8.1h2.6v2.6h-2.6zM15.9 8.1h2.6v2.6h-2.6zM5.5 10.7h2.6v2.6h-2.6zM8.1 10.7h2.6v2.6h-2.6zM10.7 10.7h2.6v2.6h-2.6zM13.3 10.7h2.6v2.6h-2.6zM15.9 10.7h2.6v2.6h-2.6zM5.5 13.3h2.6v2.6h-2.6zM10.7 13.3h2.6v2.6h-2.6zM15.9 13.3h2.6v2.6h-2.6zM5.5 15.9h2.6v2.6h-2.6zM15.9 15.9h2.6v2.6h-2.6z"/>'],
    cohere: ['#39594d', '<path d="M9.4 12.6c2.3 0 6.6-.2 7.9-3 1.1-2.4-.9-4.1-3.4-4.1-3.2 0-8.3 1.6-8.3 4.6 0 1.6 1.4 2.5 3.8 2.5z" fill="#ff9f84"/><circle cx="8.4" cy="16.6" r="2.6" fill="#fff"/><path d="M13.1 18.6c0-2.3 1.7-4 4.2-4.6" stroke="#d6c8ff" stroke-width="2.1" stroke-linecap="round" fill="none"/>'],
    nvidia: ['#76b900', `<g ${AIB_W} stroke-width="1.7"><path d="M3.6 12.2c2.4-3.7 5.2-5.4 8.4-5.4s6 1.7 8.4 5.4c-2.4 3.6-5.2 5.3-8.4 5.3s-6-1.7-8.4-5.3z"/><path d="M12 9.3a2.9 2.9 0 1 1-2.9 2.9"/></g>`],
    zai: ['#26283a', `<path d="M7.2 7.2h9.6L7.2 16.8h9.6" ${AIB_W} stroke-width="2.3"/>`],
    xai: ['#0b0b0f', `<g ${AIB_W} stroke-width="1.9"><path d="M17.9 5.2 6.1 18.8"/><path d="M15.9 9.4a5.3 5.3 0 0 1-7 7M8.1 14.6a5.3 5.3 0 0 1 6.1-8.4"/></g>`],
    pollinations: ['#1f5b3a', `<g fill="#e9f86a">${[0, 1, 2, 3, 4, 5].map(i => `<circle cx="${(12 + 4.6 * Math.cos(i * Math.PI / 3)).toFixed(2)}" cy="${(12 + 4.6 * Math.sin(i * Math.PI / 3)).toFixed(2)}" r="2.1"/>`).join('')}</g><circle cx="12" cy="12" r="2" fill="#fff"/>`],
    ollama: ['#fff', '<g fill="none" stroke="#1c1c22" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.2 10.4V6.6c0-1.3.6-2.2 1.4-2.2s1.4.9 1.4 2.2v2.1h2V6.6c0-1.3.6-2.2 1.4-2.2s1.4.9 1.4 2.2v3.8c1.2.9 1.9 2.3 1.9 3.9v.9c0 2.6-2.1 4.5-4.8 4.5h-2.6c-2.7 0-4.8-1.9-4.8-4.5v-.9c0-1.6.7-3 1.7-3.9z"/><ellipse cx="12" cy="15.3" rx="2.1" ry="1.5"/></g><circle cx="9.6" cy="12.6" r=".85" fill="#1c1c22"/><circle cx="14.4" cy="12.6" r=".85" fill="#1c1c22"/>'],
    custom: ['linear-gradient(135deg, #8b80ff, #29c7ff)', '<path d="M10.5 5.2c.4 3 2.6 5.2 5.6 5.6-3 .4-5.2 2.6-5.6 5.6-.4-3-2.6-5.2-5.6-5.6 3-.4 5.2-2.6 5.6-5.6zM17.2 13.6c.2 1.5 1.3 2.6 2.8 2.8-1.5.2-2.6 1.3-2.8 2.8-.2-1.5-1.3-2.6-2.8-2.8 1.5-.2 2.6-1.3 2.8-2.8z" fill="#fff"/>'],
  };
  AIB_LOGO.anthropic = AIB_LOGO.claude;
  /** a round logo coin of an AI service: <span class="aib-i …"> */
  const aibLogo = (k, cls = '', attrs = '') => {
    const [bg, g] = AIB_LOGO[k] || AIB_LOGO.custom;
    return `<span class="aib-i${cls}" style="--c:${bg}"${attrs}><svg viewBox="0 0 24 24" aria-hidden="true">${g}</svg></span>`;
  };
  /** the mascot: a friendly round robot — glowing eyes when an AI is connected, asleep (and an amber antenna) when not */
  const aibBot = on => `<svg class="aib-g" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><defs>`
    + `<linearGradient id="aibHead" x1="4" y1="4" x2="20" y2="22" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#a99dff"/><stop offset=".5" stop-color="#7d86ff"/><stop offset="1" stop-color="#2fc4ff"/></linearGradient>`
    + `<linearGradient id="aibEye" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8fdff"/><stop offset="1" stop-color="#3fd2ff"/></linearGradient>`
    + `<radialGradient id="aibVisor" cx=".35" cy=".25" r="1"><stop offset="0" stop-color="#2a2d63"/><stop offset="1" stop-color="#0f1130"/></radialGradient>`
    + `<filter id="aibGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation=".7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
    + `<path d="M12 6.4V4.3" stroke="url(#aibHead)" stroke-width="1.7" stroke-linecap="round"/>`
    + `<circle class="aib-tip" cx="12" cy="3.1" r="1.9" filter="url(#aibGlow)"/>`
    + `<rect x="1.3" y="11.4" width="3" height="5.4" rx="1.5" fill="url(#aibHead)"/><rect x="19.7" y="11.4" width="3" height="5.4" rx="1.5" fill="url(#aibHead)"/>`
    + `<rect x="3.1" y="5.9" width="17.8" height="16.2" rx="6.8" fill="url(#aibHead)"/>`
    + `<path d="M6.3 9.1c1.1-1.3 2.8-1.95 4.7-1.95" stroke="#fff" stroke-opacity=".6" stroke-width="1.25" stroke-linecap="round" fill="none"/>`
    + `<rect x="5.3" y="9.9" width="13.4" height="9.3" rx="4.65" fill="url(#aibVisor)"/>`
    + (on
      ? `<g class="aib-eyes" filter="url(#aibGlow)"><ellipse cx="9.55" cy="14" rx="1.5" ry="1.95" fill="url(#aibEye)"/><ellipse cx="14.45" cy="14" rx="1.5" ry="1.95" fill="url(#aibEye)"/></g>`
        + `<path d="M10.8 17q1.2.75 2.4 0" stroke="#7fe9ff" stroke-width=".9" stroke-linecap="round" fill="none"/>`
      : `<path class="aib-zz" d="M8.2 14.2q1.35 1.15 2.7 0M13.1 14.2q1.35 1.15 2.7 0" stroke="#a9b2ec" stroke-width="1.3" stroke-linecap="round" fill="none"/>`)
    + `</svg>`;

  const App = {
    view: { name: 'home', params: {} },
    prev: null,
    _pickDeck: null,

    /**
     * «Поделиться → Norsk Kort» (installed app on Android / Chrome): text or a link shared from another app opens as a
     * text in «📘 Мой учебник» — translation views, select → card, new words → cards, page → cards, listening.
     * Also works with a link like ./?share-target=1&text=…
     */
    sharedIn() {
      const p = new URLSearchParams(location.search);
      if (!p.has('share-target')) return;
      const title = (p.get('title') || '').trim(), text = (p.get('text') || '').trim(), url = (p.get('url') || '').trim();
      history.replaceState(null, '', location.pathname); // a reload does not open it again
      const body = [title, text, url && !text.includes(url) ? url : ''].filter(Boolean).join('\n\n');
      if (!/\p{L}{2}/u.test(body)) { UI.toast('Получена пустая ссылка — откройте её и поделитесь текстом', 'warn'); return; }
      const name = (title || text.split(/\s+/).slice(0, 6).join(' ') || 'Текст').replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80);
      setTimeout(() => Textbook.openWith(new File([body], `${name}.txt`, { type: 'text/plain' }), `📤 ${name}`), 300);
    },
    async init() {
      await Store.load();
      try { Progress.checkVacation(); } catch (e) { /* ignore */ }
      try { if (window.Genders && Genders.migrateNames()) Store.save(); } catch (e) { /* ignore */ } // ⚪🔵🔴 → 🌳👦👧
      // cards made from subtitles before v131 kept the subtitle dashes («…mange år, -», «- men…»): tidy them once
      try {
        const dash = s => String(s || '').replace(/^\s*[-–—]\s+/, '').replace(/\s+[-–—]\s*$/, '').trim();
        let n = 0;
        Store.cards().forEach(c => {
          if (!(c.tags || []).includes('subtitles')) return;
          const no = dash(c.no), ru = dash(c.ru), ex = dash(c.example), exRu = dash(c.exampleRu);
          if (no !== c.no || ru !== c.ru || ex !== (c.example || '') || exRu !== (c.exampleRu || '')) { c.no = no; c.ru = ru; if (c.example) c.example = ex; if (c.exampleRu) c.exampleRu = exRu; n++; }
        });
        if (n) Store.save();
      } catch (e) { /* ignore */ }
      this.applyTheme();
      TTS.init();
      await AI.detectBridge();
      if (!Store.decks().length && !Store.state.sampleAdded) {
        this.addSampleDeck();
        Store.state.sampleAdded = true; Store.save();
      }
      this.updateBadge();
      this.bindGlobal();
      this.render();
      try { Account.init(); } catch (e) { console.warn('account', e); }
      this.setupPWA();
      this.sharedIn();
      // 🧠 personalise FSRS in the background when there are enough answers (checks only; runs rarely, in a Web Worker)
      try { FSRSOpt.schedule(10000); } catch (e) { console.warn('fsrs-opt', e); }
      if (!Store.settings.userName && !Store.state.askedName) {
        Store.state.askedName = true; Store.save();
        const n = await UI.prompt('👋 Как вас зовут?', '', 'Alex');
        if (n) { Store.setSetting('userName', n); this.updateBadge(); this.render(); Account.paintTop(); }
      }
    },

    /** ✕ of the reading pill: a long text read half-way asks first (the place is not kept); a short one stops at once */
    async ttsStopAsk() {
      const p = TTS.player;
      if (!p || !p.segs || p.segs.length < 4 || p.i < 1) { TTS.stop(); return; }
      if (this._ttsAsking) return;
      this._ttsAsking = true;
      try {
        const r = await UI.askClose({ title: 'Остановить чтение?', line: `Прочитано ${Math.min(p.i + 1, p.segs.length)} из ${p.segs.length} — в следующий раз чтение начнётся сначала.`,
          actions: [{ label: '⏹ Остановить', value: 'stop', cls: 'bad' }], cancel: 'Читать дальше' });
        if (r === 'stop' && TTS.player === p) TTS.stop();
      } finally { this._ttsAsking = false; }
    },
    /** a tap on the navigation: a card session in progress asks «Закончить занятие?» first */
    goAsk(name, params = {}) {
      if (this.view.name === 'study' && name !== 'study' && window.Study && Study.inProgress && Study.inProgress()) {
        Study.leaveAsk('home').then(ok => { if (ok) this.go(name, params); });
        return;
      }
      this.go(name, params);
    },
    go(name, params = {}) {
      if (this.view.name === 'study' && name !== 'study') { Study.end(); TTS.stop(); }
      if (name !== 'deck' || (params.id !== this.view.params.id)) { Views.sel.clear(); Views.selecting = false; Views.deckFilter = 'all'; Views.deckSearch = ''; Views.deckLimit = 120; }
      if (this.view.name !== 'study') this.prev = this.view;
      this.view = { name, params };
      this.render(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    /** wide screens (MacBook): a sidebar with the main places and ALL decks, like Space */
    renderSidebar() {
      let sb = document.getElementById('sidebar');
      if (!sb) {
        sb = document.createElement('aside'); sb.id = 'sidebar'; sb.className = 'sidebar';
        document.body.appendChild(sb);
        window.addEventListener('resize', () => { const t = document.querySelector('.topbar'); if (t) document.documentElement.style.setProperty('--topbar-h', Math.round(t.getBoundingClientRect().bottom) + 'px'); });
        sb.addEventListener('click', e => {
          const a = e.target.closest('[data-sb]'); if (!a) return;
          const v = a.dataset.sb;
          if (v === 'deck-del') { e.stopPropagation(); Views.deleteDeck(a.dataset.id); return; }
          if (v === 'deck') this.goAsk('deck', { id: a.dataset.id });
          else if (v === 'create') Create.open();
          else if (v === 'library') Library.open();
          else if (v === 'bookshelf') { if (Views.openLibrary) Views.openLibrary(); else Books.open(); }
          else if (v === 'books') Books.open();
          else if (v === 'textbook') Textbook.open();
          else if (v === 'youtube') YouTube.open();
          else if (v === 'telegram') Telegram.open(null, 'vocab');
          else if (v === 'nrk') NrkTV.open();
          else if (v === 'nrkradio') NrkRadio.open();
          else if (v === 'exams') Exams.open();
          else if (v === 'news') News.open();
          else if (v === 'subs') Subs.open();
          else if (v === 'drills') Drills.open();
          else if (v === 'help') Help.open();
          else if (v === 'speech') Speech.open();
          else if (v === 'new') Views.deckEditor(null, d => this.go('deck', { id: d.id }));
          else this.goAsk(v);
        });
      }
      // the sidebar starts right under the top bar, whatever its height
      const tb = document.querySelector('.topbar');
      if (tb) document.documentElement.style.setProperty('--topbar-h', Math.round(tb.getBoundingClientRect().bottom) + 'px');
      const v = this.view;
      const item = (key, icon, label, active) => `<button class="sb-item ${active ? 'active' : ''}" data-sb="${key}">${icon}<span>${label}</span></button>`;
      sb.innerHTML = `${item('home', '🏠', 'Главная', v.name === 'home')}${item('create', '💬', 'Что выучить?')}${item('library', '🃏', 'Выражения')}${item('bookshelf', '📚', 'Библиотека')}${item('drills', '🏋️', 'Упражнения')}${item('klokka', '🕐', 'Время · Klokka')}${item('speech', '🗣', 'Произношение')}${item('news', '📰', 'Новости')}${item('subs', '🎬', 'Субтитры')}${item('youtube', YouTube.YT_SVG(20), 'YouTube')}${item('nrk', '📺', 'NRK TV')}${item('nrkradio', '📻', 'NRK Радио')}${item('telegram', Telegram.TG_SVG(20), 'Telegram')}${item('exams', '🎓', 'Экзамены')}
        ${item('stats', '📊', 'Статистика', v.name === 'stats')}${item('settings', '⚙️', 'Настройки', v.name === 'settings')}${window.Help ? item('help', '<span class="sb-help" aria-hidden="true">?</span>', 'Как пользоваться') : ''}
        <div class="sb-title">Все колоды <button class="sb-add" data-sb="new" title="Новая колода">＋</button></div>
        <div class="sb-decks">${Store.decks().map(d => `<div class="sb-row"><button class="sb-item sb-deck ${v.name === 'deck' && v.params.id === d.id ? 'active' : ''}" data-sb="deck" data-id="${d.id}">
          ${d.cover ? `<i class="sb-thumb" style="background-image:url('${U.esc(d.cover)}')"></i>` : '<i class="sb-thumb">🗂</i>'}<span>${U.esc(d.name)}</span></button>
          <button class="sb-del" data-sb="deck-del" data-id="${d.id}" title="Удалить колоду «${U.esc(d.name)}» (с подтверждением)" aria-label="Удалить колоду">${UI.TRASH_SVG(15)}</button></div>`).join('')}</div>`;
    },
    back() {
      const p = this.prev && this.prev.name !== 'study' ? this.prev : { name: 'home', params: {} };
      this.go(p.name, p.params);
    },
    render(animate) {
      const root = document.getElementById('view');
      root.onclick = null; root.onchange = null; root.oninput = null;
      if (animate) { root.style.animation = 'none'; void root.offsetWidth; root.style.animation = ''; }
      document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === this.view.name || (b.dataset.nav === 'home' && this.view.name === 'deck')));
      const v = this.view;
      document.body.dataset.view = v.name;
      try {
        if (v.name === 'study') Study.render(root);
        else if (Views[v.name]) Views[v.name](root, v.params);
        else Views.home(root);
        TTS.emit();
        this.renderSidebar();
        // every deck without a picture gets a Norwegian photo — wherever it was created (library, Telegram, import…)
        // a cover that arrives later is put in place — the screen is NOT redrawn (typing, search and focus are kept)
        try {
          Photos.fillCovers(Store.decks(), () => {
            this.renderSidebar();
            Store.decks().forEach(d => {
              if (!d.cover) return;
              document.querySelectorAll(`.deck-cover[data-id="${d.id}"]`).forEach(el => {
                if (!el.classList.contains('empty')) return;
                el.style.backgroundImage = `url('${String(d.cover).replace(/'/g, '%27')}')`;
                el.classList.remove('empty');
                const hint = el.querySelector('.deck-cover-hint'); if (hint) hint.remove();
              });
            });
          });
        } catch (e) { /* offline */ }
      } catch (e) {
        console.error(e);
        root.innerHTML = `<div class="panel empty"><div class="big">😵</div><p>Ошибка интерфейса: ${U.esc(e.message)}</p><button class="btn" onclick="App.go('home')">На главную</button></div>`;
      }
    },

    applyTheme() {
      const t = Store.settings.theme;
      const dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      const tb = document.getElementById('theme-btn');
      if (tb) { tb.textContent = dark ? '🌞' : '🌓'; tb.title = dark ? 'Включить светлую тему' : 'Включить тёмную тему'; }
      document.documentElement.dataset.ru = Store.settings.highlightRu === false ? 'off' : 'on';
      document.querySelector('meta[name="theme-color"]').content = dark ? '#0f1222' : '#f3f4fb';
    },
    /** 🤖 «Нейросети» in the top bar: the robot mascot (aibBot) + the logo and name of the current AI (or «Подключить ИИ»);
     *  hover / keyboard focus fans out every service the app supports; a tap opens the AI menu (data-action="ai-menu").
     *  Its size is picked to fit the free room in the bar (data-fit: l → m → s → xs) — it never pushes the other buttons. */
    updateBadge() {
      const b = document.getElementById('claude-badge');
      if (!b) return;
      const P = AI.PROVIDERS, on = AI.available(), id = AI.current();
      const cur = on && P[id] ? id : null;
      const conf = k => AI.configured(k) || (k === 'claude' && AI.configured('anthropic'));
      // one icon per service (the Claude subscription and Claude API share a logo); the current one first, then the connected ones
      const seen = new Set(), all = [];
      [cur, ...Object.keys(P).filter(conf), ...Object.keys(P)].forEach(k => {
        const p = P[k]; if (!k || !p || seen.has(k) || (!p.domain && k !== cur)) return;
        if (p.domain && seen.has(p.domain)) return;
        seen.add(k); if (p.domain) seen.add(p.domain); all.push(k);
      });
      const label = k => (k === 'claude' ? `Claude ${Store.settings.plan || ''}`.trim() : k === 'anthropic' ? 'Claude API' : P[k].short);
      b.classList.toggle('on', on);
      b.classList.toggle('aib-off', !on);
      b.innerHTML = `<span class="aib-glyph">${aibBot(on)}${cur ? aibLogo(cur, ' aib-corner') : ''}</span>`
        + (cur ? `<span class="aib-stack">${aibLogo(cur, ' cur')}</span>` : '') // collapsed: just the current one — the rest are in the fan / menu
        + `<span class="aib-txt"><small>${on ? 'Нейросеть' : 'Нейросети'}</small><b>${on ? U.esc(label(cur)) : 'Подключить ИИ'}</b></span>`
        + `<span class="aib-cap">ИИ</span>`
        // the fan (desktop hover / keyboard focus); title="" keeps the button tooltip off it
        + `<span class="aib-fan" title="" aria-hidden="true"><span class="aib-fan-h">Нейросети в приложении · ${all.length}</span>`
        + `<span class="aib-fan-row">${all.map((k, i) => aibLogo(k, (k === cur ? ' cur' : '') + (conf(k) ? ' ok' : ' no'),
          ` data-n="${U.esc(P[k].name)}${k === cur ? ' — сейчас' : conf(k) ? ' — подключена' : ''}"`).replace('style="', `style="--i:${i};`)).join('')}</span>`
        + `<span class="aib-fan-f">${on ? `Сейчас работает <b>${U.esc(label(cur))}</b> · нажмите, чтобы сменить` : 'Ни одна не подключена · нажмите — <b>Gemini и Groq бесплатно</b>'}</span></span>`;
      b.setAttribute('aria-label', on ? `Нейросети: подключено — ${P[cur].short}` : 'Нейросети: не подключено — нажмите, чтобы подключить');
      b.title = on ? `🤖 Нейросеть: ${P[cur].name}${cur === 'claude' ? ' (ваша подписка через Claude Code)' : ''} — проверяет карточки и переводит. Нажмите, чтобы сменить`
        : '🤖 Нейросеть не подключена — нажмите, чтобы выбрать (Gemini и Groq — бесплатно)';
      this.fitBadge();
      if (!this._badgeRO && window.ResizeObserver) {
        // refit when the window or a neighbour button changes size (fonts loaded, «Слушать» relabelled…)
        let raf = 0;
        const again = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => this.fitBadge()); };
        this._badgeRO = new ResizeObserver(again);
        const tb = b.closest('.topbar');
        if (tb) [tb, ...tb.children, ...b.parentElement.children].forEach(el => { if (el !== b && el !== b.parentElement) this._badgeRO.observe(el); });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);
      }
    },
    /** the biggest look of the AI button that fits the free room in the top bar */
    fitBadge() {
      const b = document.getElementById('claude-badge'), right = b && b.parentElement, tb = b && b.closest('.topbar');
      if (!tb || !b.offsetParent) return;
      const cs = getComputedStyle(tb), gap = parseFloat(cs.columnGap) || 0;
      const edge = tb.getBoundingClientRect().right - parseFloat(cs.paddingRight);
      b.dataset.fit = 'xs';
      const w0 = b.offsetWidth, r = right.getBoundingClientRect();
      const leftEnd = Math.max(tb.getBoundingClientRect().left, ...[...tb.children].filter(e => e !== right && e.offsetParent).map(e => e.getBoundingClientRect().right));
      const room = (r.right > edge + .5 ? edge - r.right : r.left - leftEnd - gap) - 2; // < 0: the bar is already too full
      for (const t of ['l', 'm', 's']) {
        b.dataset.fit = t;
        if (b.offsetWidth - w0 <= room) return;
      }
      b.dataset.fit = 'xs';
    },

    /** offline cache (service worker) + ask the browser to keep our data (Safari wipes idle sites after 7 days) */
    setupPWA() {
      const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
      if ('serviceWorker' in navigator && secure) {
        const hadController = !!navigator.serviceWorker.controller;
        // GitHub Pages caches every file for 10 min — bypass the HTTP cache for sw.js so updates arrive at once
        navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).catch(e => console.warn('SW', e));
        let reloaded = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!hadController || reloaded || this.view.name === 'study') return; // never interrupt a study session
          reloaded = true; location.reload();
        });
      }
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    },

    pickFiles(deckId) {
      this._pickDeck = deckId || null;
      const inp = document.getElementById('file-input');
      inp.value = '';
      inp.click();
    },

    addSampleDeck() {
      const sd = window.SAMPLE_DECK;
      const d = Store.addDeck(sd.name, sd.description);
      sd.cards.forEach(([no, ru, en, description, example, exampleRu]) => {
        Store.addCard(d.id, { no, ru, en, description, example, exampleRu, wordClass: (description.match(/^(substantiv|verb|adjektiv|adverb|interjeksjon)/) || [])[1] || '',
          history: [{ t: Date.now(), by: 'import', a: 'import', n: 'стартовая колода Norsk Kort' }] });
      });
      return d;
    },

    bindGlobal() {
      document.addEventListener('click', e => {
        UI.ripple(e);
        const a = e.target.closest('[data-action]');
        if (!a) return;
        if (a.dataset.action === 'nav') this.goAsk(a.dataset.view);
        if (a.dataset.action === 'study-all') {
          if (this.view.name === 'deck' && this.view.params.id) Study.start({ deckId: this.view.params.id });
          else Study.start({ deckId: null });
        }
        if (a.dataset.action === 'ai-menu') {
          e.stopPropagation();
          const items = Object.entries(AI.PROVIDERS).filter(([id]) => AI.configured(id)).map(([id, p]) => ({
            label: `${AI.current() === id ? '★ ' : ''}${p.name}`,
            html: `${aibLogo(id, ' aib-m')} ${U.esc(p.name)}${AI.current() === id ? ' <b style="color:var(--good)">✓</b>' : ''}`, // the same logos as on the 🤖 button
            action: () => { Store.setSetting('aiProvider', id); this.updateBadge(); this.render(); UI.toast('Теперь карточки проверяет: ' + p.name, 'good'); },
          }));
          items.push({ label: '⚙️ Подключить другие нейросети…', action: () => this.go('settings') });
          UI.menu(a, items);
        }
        if (a.dataset.action === 'more-menu') {
          // phones: the buttons that don't fit in the top bar
          e.stopPropagation();
          const dark = document.documentElement.dataset.theme === 'dark';
          UI.menu(a, [
            { label: '🎧 Слушать — колоды, книги, новости', action: () => (window.ListenUI ? ListenUI.chooser() : Listen.open('')) },
            ...(window.Views && Views.openLibrary ? [{ label: '📚 Библиотека — читать и слушать', action: () => Views.openLibrary() }] : []),
            { label: '🗣 Переводчик в наушниках', action: () => Interp.toggle() },
            { label: '🔗 Поделиться приложением', action: () => ShareApp.open() },
            ...(window.Help ? [{ label: '❓ Как пользоваться — подсказки', action: () => Help.open() }] : []),
            { label: '🤖 Нейросеть: ' + (AI.available() ? AI.PROVIDERS[AI.current()].name : 'не подключена'), action: () => this.go('settings') },
            { label: dark ? '🌞 Светлая тема' : '🌙 Тёмная тема', action: () => { Store.setSetting('theme', dark ? 'light' : 'dark'); this.applyTheme(); if (this.view.name === 'settings') this.render(); } },
          ]);
        }
        if (a.dataset.action === 'interp') Interp.toggle();
        if (a.dataset.action === 'share-app') ShareApp.open();
        if (a.dataset.action === 'account') this.go('account');
        if (a.dataset.action === 'listen') {
          // 🎧 playing → the «Сейчас играет» player; in a deck / study → that deck; elsewhere → «Что послушать?»
          if (window.ListenUI) ListenUI.top();
          else if (Listen.p) Listen.toggle();
          else Listen.open(this.view.name === 'deck' ? this.view.params.id : (this.view.name === 'study' && Study.current() ? Study.current().card.deckId : ''));
        }
        if (a.dataset.action === 'toggle-theme') {
          const cur = document.documentElement.dataset.theme;
          Store.setSetting('theme', cur === 'dark' ? 'light' : 'dark');
          this.applyTheme();
          if (this.view.name === 'settings') this.render();
        }
      });
      document.getElementById('file-input').addEventListener('change', e => {
        const files = [...e.target.files];
        if (files.length) Views.importFiles(files, this._pickDeck || (this.view.name === 'deck' ? this.view.params.id : null));
      });
      document.addEventListener('keydown', e => Study.onKey(e));
      // provenance badges (✍️ 📥 DeepL Claude…) — open the card's history; capture phase so the card itself doesn't open/flip
      document.addEventListener('click', e => {
        const b = e.target.closest('[data-prov]');
        if (!b) return;
        e.stopPropagation(); e.preventDefault();
        Prov.historyDialog(b.dataset.card, b.dataset.prov);
      }, true);

      // reading player: inline controls (study) + floating pill (all other screens, modals)
      const pill = document.getElementById('tts-player');
      pill.addEventListener('click', e => {
        const b = e.target.closest('[data-tts]'); if (!b) return;
        ({ toggle: () => TTS.toggle(), restart: () => TTS.restart(), stop: () => this.ttsStopAsk() })[b.dataset.tts]();
      });
      document.addEventListener('tts-state', e => {
        const st = e.detail.state;
        const p = e.detail.player;
        document.querySelectorAll('[data-tts-ctl]').forEach(box => {
          const t = box.querySelector('[data-act="tts-toggle"]');
          if (t) {
            t.innerHTML = UI.icon(st === 'playing' ? 'pause' : 'play', 22);
            t.title = st === 'playing' ? 'Пауза (P)' : st === 'paused' ? 'Продолжить с того же места (P)' : 'Читать (P)';
            t.classList.toggle('playing', st === 'playing'); t.classList.toggle('paused', st === 'paused');
          }
          const s = box.querySelector('[data-act="tts-stop"]'); if (s) s.disabled = st === 'idle';
          const r = box.querySelector('[data-act="tts-restart"]'); if (r) r.disabled = !TTS.last;
        });
        const showPill = st !== 'idle' && (this.view.name !== 'study' || document.querySelector('.modal-backdrop'));
        pill.hidden = !showPill;
        pill.classList.toggle('paused', st === 'paused');
        pill.querySelector('[data-tts="toggle"]').innerHTML = UI.icon(st === 'paused' ? 'play' : 'pause', 18);
        pill.querySelector('.tts-label').textContent = st === 'paused' ? 'Пауза' : p ? `Читаю ${Math.min(p.i + 1, p.segs.length)}/${p.segs.length}` : 'Читаю…';
        placePill();
      });
      // in study the pill sits just above the grade buttons (not over them, not over the top bar)
      const placePill = () => {
        const ar = !pill.hidden && document.body.dataset.view === 'study' && !document.querySelector('#modal-root .modal-backdrop') && document.querySelector('.answer-row');
        if (ar) { pill.style.top = Math.max(8, ar.getBoundingClientRect().top - pill.offsetHeight - 8) + 'px'; pill.style.bottom = 'auto'; }
        else { pill.style.top = ''; pill.style.bottom = ''; }
      };
      window.addEventListener('resize', placePill);
      // a window opened / closed while reading: show or hide the pill now, not at the next sentence
      new MutationObserver(() => {
        if (TTS.state() === 'idle') return;
        pill.hidden = !(this.view.name !== 'study' || document.querySelector('#modal-root .modal-backdrop:not(.closing)'));
        placePill();
      }).observe(document.getElementById('modal-root'), { childList: true });
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.applyTheme());

      // drag & drop files anywhere
      const ov = document.getElementById('drop-overlay');
      let depth = 0;
      // the photo picker takes dropped pictures itself — no "import cards" overlay over it
      // windows with their own drop zone (photo picker, 📘 textbook) take the files themselves
      const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files') && !document.querySelector('.photo-modal, .tb-modal, .subs-modal, .ac-modal');
      window.addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); depth++; ov.classList.add('show'); });
      window.addEventListener('dragleave', e => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) ov.classList.remove('show'); });
      window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
      window.addEventListener('drop', e => {
        if (!hasFiles(e)) return;
        e.preventDefault(); depth = 0; ov.classList.remove('show');
        const files = [...e.dataTransfer.files];
        if (files.length) Views.importFiles(files, this.view.name === 'deck' ? this.view.params.id : null);
      });
      window.addEventListener('beforeunload', () => Store.saveNow());
    },
  };

  window.App = App;
  window.addEventListener('DOMContentLoaded', () => App.init().catch(e => {
    console.error(e);
    document.getElementById('view').innerHTML = `<div class="panel empty"><div class="big">😵</div><p>Не удалось запустить: ${U.esc(e.message)}</p></div>`;
  }));
})();
