/* ============ 🎧 «Слушать» — easy to find, everywhere ============
 * On top of Listen (js/listen.js, the one <audio> player that keeps going with the screen locked):
 *  - ListenUI.deck(id)      one tap on a deck card / deck page: the deck starts at once and «Сейчас играет» opens;
 *  - ListenUI.chooser()     «Что послушать?» — every deck, books, textbook, news, expressions (+ what comes next);
 *  - ListenUI.nowPlaying()  the big centred player (a full-screen sheet on phones): what is playing, seekable progress,
 *                           ⏮ ⏪ ⏯ ⏩ ⏭ ⏹, speed, what is spoken, pauses, 🌑, speaker / headphones; Space · ← → · Esc;
 *  - ListenUI.intro()       the first-visit window with our own animated earbuds; afterwards a soft reminder
 *                           (a dot on the top-bar «Слушать» + a small bubble at most once a day, up to 5 times)
 *                           until listening has really been started once.
 */
(function () {
  /** a drawn icon (js/app.js NavIcons) · the app runs on this Mac (file / localhost — js/net.js) */
  const NI = (n, sz) => (window.NavIcons && NavIcons.icon ? NavIcons.icon(n, sz || 20) : '');
  const onMacNow = () => (window.Net && Net.onMac ? Net.onMac() : !!(window.AI && AI.onMac && AI.onMac()));
  const KEY = 'nk-listen-ui';
  const state = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } };
  const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* full / private mode */ } };
  const patch = o => { const s = Object.assign(state(), o); save(s); return s; };
  const HP = (s, on = true) => Listen.HEADPHONES(s, on);
  const modalOpen = () => !!document.querySelector('#modal-root > .modal-backdrop:not(.closing)');
  const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ICON = {
    prev: '<path d="M6 5v14" stroke-width="2.4"/><path d="M19 5.5v13L8.5 12z" fill="currentColor" stroke="none"/>',
    next: '<path d="M18 5v14" stroke-width="2.4"/><path d="M5 5.5v13L15.5 12z" fill="currentColor" stroke="none"/>',
    back: '<path d="M11.5 6v12L3.5 12zM20.5 6v12l-8-6z" fill="currentColor" stroke="none"/>',
    fwd: '<path d="M12.5 6v12l8-6zM3.5 6v12l8-6z" fill="currentColor" stroke="none"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" stroke="none"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    loop: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
  };
  const ico = (n, s = 22) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
  /**
   * our own earbuds (no pictures of anyone's product): a pearl-white pebble with a stadium-shaped touch plate and a blue
   * rim, a dark speaker mesh, a soft ear tip, and a short angled tab with a blue cap and a tiny «L» / «R».
   * Gradients + specular highlights + soft shadows; a slight tilt; both float. Equalizer bars on both sides behind them.
   */
  const EARBUD = side => {
    const L = side === 'l';
    return `<g class="lp-eb lp-eb-${side}"><g transform="rotate(${L ? -10 : 10}) ${L ? '' : 'scale(-1 1)'}">
      <g transform="rotate(34 0 14)">
        <rect x="-9" y="8" width="18" height="46" rx="8" fill="url(#lpStem)" stroke="#aeb9cc" stroke-width=".8"/>
        <path d="M-9 41h18v5a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8z" fill="url(#lpCap)"/>
        <rect x="-5.5" y="14" width="3.4" height="24" rx="1.7" fill="#fff" opacity=".85"/>
        <text class="lp-lr" x="${L ? 2.5 : -2.5}" y="35" text-anchor="middle" ${L ? '' : 'transform="scale(-1 1)"'}>${L ? 'L' : 'R'}</text>
      </g>
      <path d="M-44-8c-1-10 6-16 15-15l5 1v28l-5 1c-9 1-14-5-15-15z" fill="url(#lpTip)"/>
      <ellipse cx="-42.5" cy="-1.5" rx="3.2" ry="7" fill="#2b3650"/>
      <g transform="rotate(-12)">
        <rect x="-30" y="-27" width="66" height="50" rx="25" fill="url(#lpBody)" stroke="#b7c1d3" stroke-width=".8"/>
        <rect x="-14" y="-19" width="44" height="34" rx="17" fill="url(#lpFace)" stroke="url(#lpRim)" stroke-width="2.2"/>
        <rect x="-3" y="-12" width="22" height="6" rx="3" fill="url(#lpMesh)"/>
        <rect x="-3" y="-12" width="22" height="6" rx="3" fill="url(#lpDots)"/>
        <circle cx="8" cy="5" r="2.2" fill="#9fb2d0"/>
        <ellipse cx="-12" cy="-20" rx="14" ry="3.6" fill="#fff" opacity=".9"/>
        <ellipse cx="14" cy="17" rx="14" ry="2.6" fill="#fff" opacity=".35"/>
      </g>
    </g></g>`;
  };
  const EQ = (x0, dir) => [10, 22, 34, 18, 28, 14].map((h, i) => `<rect class="lp-bar" style="--i:${i}" x="${x0 + dir * i * 9}" y="${95 - h}" width="5" height="${h * 2}" rx="2.5" fill="url(#lpEq)"/>`).join('');
  const BUDS_SVG = `<svg class="lp-buds" viewBox="0 0 320 190" aria-hidden="true">
      <defs>
        <radialGradient id="lpBody" cx=".34" cy=".26" r=".9"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#eef2f8"/><stop offset=".85" stop-color="#c9d1df"/><stop offset="1" stop-color="#aeb8ca"/></radialGradient>
        <radialGradient id="lpFace" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#e9eef6"/><stop offset="1" stop-color="#cfd7e4"/></radialGradient>
        <linearGradient id="lpRim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fd8ff"/><stop offset="1" stop-color="#4f8fe6"/></linearGradient>
        <linearGradient id="lpStem" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#eef2f8"/><stop offset="1" stop-color="#bcc6d7"/></linearGradient>
        <linearGradient id="lpCap" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fd0ff"/><stop offset="1" stop-color="#3f7fdc"/></linearGradient>
        <radialGradient id="lpTip" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#e3ecf8"/><stop offset=".7" stop-color="#a9b9d2"/><stop offset="1" stop-color="#7f93b3"/></radialGradient>
        <linearGradient id="lpMesh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2233"/><stop offset="1" stop-color="#3a4258"/></linearGradient>
        <pattern id="lpDots" width="2.4" height="2.4" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r=".55" fill="#6c7895"/></pattern>
        <linearGradient id="lpEq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd3ff"/><stop offset="1" stop-color="#5b6cff"/></linearGradient>
      </defs>
      <g class="lp-eqs">${EQ(4, 1)}${EQ(311, -1)}</g>
      <ellipse class="lp-sh" cx="98" cy="174" rx="34" ry="6.5"/><ellipse class="lp-sh lp-sh-r" cx="222" cy="174" rx="34" ry="6.5"/>
      <g transform="translate(106 78) scale(1.22)">${EARBUD('l')}</g>
      <g transform="translate(214 78) scale(1.22)">${EARBUD('r')}</g>
    </svg>`;
  const WAVE_ICO = '<svg class="lp-wv" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M2 6.5v3M5 4v8M8 2v12M11 4.5v7M14 6.5v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  /** the whole picture: glow rings, the earbuds, «Hei!» / «Привет!» sound bubbles (the intro and the help topic) */
  const ART = (cls = '') => `<div class="lp-stage ${cls} ${reduce() ? 'still' : ''}" aria-hidden="true">
      <span class="lp-ring r1"></span><span class="lp-ring r2"></span><span class="lp-ring r3"></span>
      ${BUDS_SVG}
      <span class="lp-chip lp-no">${WAVE_ICO}<span>🇳🇴 Hei!</span></span><span class="lp-chip lp-ru">${WAVE_ICO}<span>${window.Listen && Listen.trLang && Listen.trLang() === 'uk' ? '🇺🇦 Привіт!' : '🇷🇺 Привет!'}</span></span>
    </div>`;

  const ListenUI = {
    /* ---------- start ---------- */
    /** the cards of a list from position `at` (rendered files when possible — the pocket-safe way) */
    startAt(cards, o, at = 0) {
      if (!o.noRender && Listen.canRender(o)) Listen.startRendered(cards, o, at);
      else Listen.startClips(cards, o, at);
      this.markUsed();
    },
    /** one tap on «🎧 Слушать» of a deck (or '' = all decks): call it right inside the click (iPhone allows sound only there) */
    deck(deckId, { open = true } = {}) {
      const p = Listen.p;
      if (p && !p.o.noRender && (p.o.deckId || '') === (deckId || '') && !p.list) { if (!p.playing) Listen.resume(); if (open) this.nowPlaying(); return; }
      Listen.prime();
      const o = Object.assign(Listen.opts(), { deckId: deckId || '', limit: 0, noRender: false });
      let cards = Listen.cards(o);
      // the saved filter («только новые») gives nothing here: the whole deck instead of «нечего слушать»
      if (!cards.length && o.filter !== 'all') { o.filter = 'all'; cards = Listen.cards(o); }
      if (!cards.length) { UI.toast('В этой колоде пока нет карточек со словом и переводом', 'warn'); return; }
      Listen.saveOpts(Object.assign({}, o));
      Listen.start(cards, o);
      this.markUsed();
      if (open) this.nowPlaying();
    },
    /** any list of cards (a deck's filtered list, the card viewer) from card `at` */
    cards(ids, at = 0, title = 'Карточки') {
      Listen.prime();
      const cards = ids.map(id => Store.card(id)).filter(c => Listen.hasTr(c));
      if (!cards.length) { UI.toast('Здесь нет карточек со словом и переводом', 'warn'); return; }
      const deckIds = new Set(cards.map(c => c.deckId));
      const o = Object.assign(Listen.opts(), { deckId: deckIds.size === 1 ? [...deckIds][0] : '', filter: 'all', order: 'seq', limit: 0, dark: false });
      const k = Math.max(0, Math.min(cards.length - 1, cards.indexOf(Store.card(ids[at]))));
      this.startAt(cards, o, k);
      Listen.p.list = true;
      Listen.p.deck = { name: title };
      Listen.updateMeta(true);
      this.nowPlaying();
    },
    /** the top-bar «🎧 Слушать»: playing → the player; in a deck / study → that deck; elsewhere → «Что послушать?» */
    top() {
      if (Listen.p) { this.nowPlaying(); return; }
      const v = window.App && App.view ? App.view : {};
      const deckId = v.name === 'deck' ? v.params.id : v.name === 'study' && window.Study && Study.current() ? Study.current().card.deckId : '';
      if (deckId && Store.deck(deckId)) { this.deck(deckId); return; }
      this.chooser();
    },
    markUsed() {
      const s = state();
      if (!s.used) patch({ used: Date.now() });
      document.querySelectorAll('.lt-new').forEach(b => b.classList.remove('lt-new'));
      document.querySelectorAll('.lt-hint').forEach(x => x.remove());
    },
    /** ✕ / ⏹ stop — always asks (an accidental tap must not end the session): stop (the place is remembered), collapse to the bar, or cancel */
    async stopAsk() {
      const p = Listen.p; if (!p || this._asking) return;
      this._asking = true;
      let r = null;
      try {
        r = await UI.askClose({ title: 'Остановить прослушивание?', line: 'Место запомнится — можно продолжить потом.',
          actions: [{ label: '⏹ Остановить', value: 'stop', cls: 'bad' }, { label: 'Свернуть', value: 'min' }] });
      } finally { this._asking = false; }
      if (Listen.p !== p) return;
      if (r === 'stop') {
        try { if (window.ListenX) ListenX.savePos(p, true); } catch (e) { console.warn('listen pos', e); }
        Listen.stop();
      } else if (r === 'min') this.collapse();
    },
    /** the big player goes down into the bar at the bottom — the sound goes on */
    collapse() {
      document.querySelectorAll('#modal-root .np-modal').forEach(el => { const bd = el.closest('.modal-backdrop'); if (bd && bd._m) bd._m.close(); });
    },

    /* ---------- «Что послушать?» ---------- */
    chooser() {
      const decks = Store.decks().map(d => [d, Store.cards(d.id).filter(c => Listen.hasTr(c)).length]);
      const total = decks.reduce((n, [, k]) => n + k, 0);
      const p = Listen.p;
      const X = window.ListenX;
      const off = d => !!(X && d && X.cache.status(d.id).state === 'done');
      const tile = (d, n) => `<button class="lc-deck" data-lc-deck="${d ? d.id : ''}" ${n ? '' : 'disabled'} title="${n ? 'Слушать — сразу, одной кнопкой' : 'В колоде пока нет карточек'}">
          <span class="lc-thumb" ${d && d.cover ? `style="background-image:url('${U.esc(d.cover)}')"` : ''}>${d && d.cover ? '' : d ? '🗂' : '🃏'}</span>
          <span class="lc-name"><b>${d ? U.esc(d.name) : 'Все колоды подряд'}</b><small>${U.cards(n)}${off(d) ? ' · <span class="lc-off">✓ офлайн</span>' : ''}</small></span>
          <span class="lc-go" aria-hidden="true">${HP(20, true)}</span></button>`;
      const cont = X && X.lastResume();
      const src = (k, icon, t, sub) => `<button class="lc-src" data-lc-src="${k}"><span class="lc-ic">${NI(icon, 22) || icon}</span><span><b>${t}</b><small>${sub}</small></span></button>`;
      const hd = (icon, t) => `<h3 class="lc-h">${NI(icon, 20) ? `<span class="ui-t">${NI(icon, 20)}<span>${t}</span></span>` : t}</h3>`;
      // what the sheet promises depends on where the app runs: on this Mac (the bridge) — NRK's whole catalogue and your own
      // Telegram; on the site / in the store apps — Supernytt (the server's RSS allow-list) and our curated public channels
      const mac = onMacNow();
      const m = UI.modal({
        title: `${HP(26, true)} Что послушать?`, cls: 'wide lc-modal',
        body: `<p class="lc-lead">Звучит <b>в наушниках</b>, если они подключены, или <b>вслух через динамик</b> — на телефоне и на компьютере. Экран можно затемнить или заблокировать.</p>
          ${cont ? `<button class="lc-now lc-cont" data-lc="cont"><span class="lc-cont-ic" aria-hidden="true">${UI.icon('play', 18)}</span><span><b>Продолжить: ${U.esc(cont.title)}</b><small>${cont.kind === 'book' ? `со стр. ${cont.page}${cont.pages ? ` из ${cont.pages}` : ''}` : cont.kind === 'media' ? `с ${cont.i + 1}-${/^ac:/.test((cont.mo && cont.mo.mediaKey) || '') ? 'го урока' : /^tga:/.test((cont.mo && cont.mo.mediaKey) || '') ? 'й записи' : 'го видео'} из ${cont.n}` : `с ${cont.i + 1}-й ${cont.kind === 'deck' ? 'карточки' : 'части'} из ${cont.n}`}</small></span><span class="lc-open">▶ Слушать ›</span></button>` : ''}
          ${p ? `<button class="lc-now" data-lc="now"><span class="lc-eq" aria-hidden="true"><i></i><i></i><i></i></span><span><b>Сейчас играет</b><small>${U.esc(p.deck ? p.deck.name : 'Все колоды')} · ${U.esc(Listen.progressText())}</small></span><span class="lc-open">Открыть плеер ›</span></button>` : ''}
          ${hd('cards', 'Карточки и колоды')}
          <div class="lc-decks">${decks.length > 1 ? tile(null, total) : ''}${decks.map(([d, n]) => tile(d, n)).join('')}</div>
          ${hd('book', 'Тексты — читаются вслух по-норвежски с переводом')}
          <div class="lc-srcs">
            ${src('books', 'book', 'Книги', 'бесплатные книги и PDF — страница за страницей')}
            ${window.AudioCourse ? src('audiocourse', 'headphones', 'Аудиокурсы', '50languages: 100 уроков с озвучкой — внутри приложения, без интернета') : ''}
            ${src('textbook', 'note', 'Мой учебник', 'ваш PDF, EPUB, фото страниц')}
            ${src('news', 'news', 'Новости', 'Klar Tale и NRK — простым языком')}
            ${src('expr', 'dialogue', 'Выражения', 'устойчивые выражения и фразы')}
          </div>
          ${hd('radio', 'Радио и подкасты NRK — с субтитрами и переводом')}
          <div class="lc-srcs">
            ${src('radio', 'radio', 'Радио NRK', 'прямой эфир: P1, P2, P3, Nyheter, Klassisk…')}
            ${src('podcast', 'mic', 'Подкасты NRK', mac ? 'Abels tårn, Dagsnytt 18, Norgeshistorie…' : 'Supernytt — новости простым языком, каждый день')}
          </div>
          ${hd('send', mac ? 'Telegram-авторы — их видео и аудио подряд, как подкаст' : 'Telegram — открытые каналы о норвежском, подряд, как подкаст')}
          <div class="lc-srcs">
            ${src('tgvideo', 'tv', 'Telegram-авторы', mac ? 'видео из ваших каналов: слушать подряд или смотреть с субтитрами' : 'видео избранных открытых каналов: слушать подряд или смотреть с субтитрами')}
            ${window.TgAudio ? src('tgaudio', 'headphones', 'Telegram-аудио', mac ? 'подкасты и голосовые из ваших каналов — с субтитрами и переводом' : 'подкасты и голосовые избранных открытых каналов — с субтитрами и переводом') : ''}
          </div>
          ${window.TgAudio ? TgAudio.chooserHtml() : ''}`,
        foot: `<button class="btn ghost" data-lc="help">❔ Как слушать</button><button class="btn ghost" data-lx="where" title="В наушниках или через динамик">${X ? X.outLabel() : '🔈 Где слушать'}</button><button class="btn" data-lc="opts" title="Что звучит, паузы, порядок, какие карточки">⚙️ Настройки прослушивания</button>`,
      });
      m.el.addEventListener('click', e => {
        const d = e.target.closest('[data-lc-deck]');
        if (d && !d.disabled) { m.close(); this.deck(d.dataset.lcDeck); return; }
        const s = e.target.closest('[data-lc-src]');
        if (s) { m.close(); this.openSource(s.dataset.lcSrc); return; }
        const a = e.target.closest('[data-lc]'); if (!a) return;
        m.close();
        if (a.dataset.lc === 'now') this.nowPlaying();
        if (a.dataset.lc === 'cont' && cont) X.continueEntry(cont);
        if (a.dataset.lc === 'help') this.intro();
        if (a.dataset.lc === 'opts') Listen.open(p && p.o.deckId ? p.o.deckId : '');
      });
      if (window.TgAudio) TgAudio.chooserBind(m); // 💾 «Мои аудио» (saved Telegram audio) — play without the network
      return m;
    },
    openSource(k) {
      const go = { books: () => Books.open(), textbook: () => Textbook.open(), news: () => News.open(), expr: () => this.expressions(), radio: () => NrkRadio.open(), podcast: () => this.podcasts(), tgvideo: () => TgVideo.open(), tgaudio: () => TgAudio.open(), audiocourse: () => AudioCourse.open() }[k];
      try { if (go) go(); } catch (e) { console.warn('listen source', e); UI.toast('Не удалось открыть этот раздел', 'warn'); }
    },
    /** 🎙 NRK podcasts: the NRK Radio window, scrolled to its podcasts once they are loaded */
    podcasts() {
      const m = NrkRadio.open();
      let n = 0;
      const t = setInterval(() => {
        const h = m && m.el.isConnected && m.$('.nrkr-h');
        if (h) { clearInterval(t); h.scrollIntoView({ block: 'start', behavior: reduce() ? 'auto' : 'smooth' }); }
        else if (++n > 40 || !(m && m.el.isConnected)) clearInterval(t);
      }, 250);
    },
    /** 💬 the expression decks (from «Выражения»): one → it starts; several → choose; none → the library to make one */
    expressions() {
      const ds = Store.decks().filter(d => /выражени|фраз|uttrykk|idiom/i.test(d.name + ' ' + (d.description || '')) && Store.cards(d.id).length);
      if (ds.length === 1) { this.deck(ds[0].id); return; }
      if (ds.length > 1) {
        UI.choose('💬 Какие выражения слушать?', '<p class="small muted">Выберите колоду — она сразу зазвучит.</p>',
          ds.map(d => ({ label: `${HP(16, true)} ${U.esc(d.name)} · ${Store.cards(d.id).length}`, value: d.id, cls: 'listen-cta' }))).then(id => { if (id) this.deck(id); });
        return;
      }
      UI.toast('Сначала создайте колоду выражений — потом её можно слушать', '', 4000);
      Library.open();
    },

    /* ---------- «Сейчас играет» ---------- */
    nowPlaying() {
      if (!Listen.p) { this.chooser(); return; }
      const open = document.querySelector('.np-modal');
      if (open) return;
      const speeds = [['slow', '🐢', 'Медленно'], ['normal', '🚶', 'Обычно'], ['fast', '🐇', 'Быстро']];
      const X = window.ListenX;
      const m = UI.modal({
        title: `<span class="np-title">${HP(22, true)} Сейчас играет</span>`, cls: 'np-modal',
        body: `<div class="np">
          <div class="np-resume" data-np-resume hidden></div>
          <div class="np-art" data-np-art><span class="np-art-ico">${HP(64, true)}</span><span class="np-eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></div>
          <div class="np-src" data-np-src></div>
          <div class="np-text"><div class="np-no" data-np-no lang="nb"></div><div class="np-ru" data-np-ru lang="ru"></div></div>
          <div class="np-prog">
            <input type="range" class="np-seek" data-np-seek min="1" max="1" step="1" value="1" aria-label="Перейти к карточке">
            <div class="np-pos"><span data-np-pos></span><span data-np-left></span></div>
          </div>
          <div class="np-ctl">
            <button class="np-b" data-np="prev" title="Предыдущая (←)" aria-label="Предыдущая">${ico('prev', 24)}</button>
            <button class="np-b" data-np="back" title="На 10 назад" aria-label="На 10 назад">${ico('back', 26)}</button>
            <button class="np-b main" data-np="toggle" title="Пауза / продолжить (пробел)" aria-label="Пауза или продолжить"></button>
            <button class="np-b" data-np="fwd" title="На 10 вперёд" aria-label="На 10 вперёд">${ico('fwd', 26)}</button>
            <button class="np-b" data-np="next" title="Следующая (→)" aria-label="Следующая">${ico('next', 24)}</button>
          </div>
          ${X ? X.gradeHtml('np') : ''}
          ${X ? `<div class="np-vol">${X.volumeHtml()}</div>` : ''}
          <div class="np-row">
            <button class="np-pill" data-np="stop" title="Остановить">${ico('stop', 16)} Стоп</button>
            <button class="np-pill" data-np="loop" title="Когда закончится — заново">${ico('loop', 16)} По кругу</button>
            <button class="np-pill np-darkpill" data-np="dark" title="Чёрный экран, заблокированный от касаний — для кармана">🌑 Тёмный экран</button>
            <button class="np-pill" data-lx="where" title="Где слушать: в наушниках или через динамик">🔈 Где слушать?</button>
            ${window.Voices && Voices.openChooser ? Voices.LANGS.map(l => `<button class="np-pill" data-voices-open="${l}" data-voices-place="listen" title="${Voices.LANG_NAME[l]} голос для «Слушать» — свой или как везде">${Voices.FLAG[l]} ${Voices.LANG_NAME[l]} голос</button>`).join('') : ''}
            ${X ? '<button class="np-pill" data-lx="voice" title="Команды голосом: тише, громче, пауза, дальше, знаю…">🎙 Голос</button>' : ''}
          </div>
          <div class="np-opts">
            <div class="np-opt"><span class="lbl">Скорость</span><div class="seg-mini" data-np-speed>${speeds.map(([v, i, l]) => `<button data-v="${v}">${i} ${l}</button>`).join('')}</div></div>
            <div class="np-opt"><span class="lbl">Что звучит</span><div class="seg-mini" data-np-dir></div></div>
            <div class="np-opt" data-np-pause-row><span class="lbl">Пауза перед переводом</span><div class="seg-mini" data-np-pause>${[1, 2, 3, 5].map(v => `<button data-v="${v}">${v} с</button>`).join('')}</div></div>
            <div class="np-opt" data-np-recall-row><span class="lbl">🧠 Пауза, чтобы сказать по-норвежски</span><div class="seg-mini" data-np-rpause>${[[2, '2 с'], [4, '4 с'], [6, '6 с'], ['auto', 'Авто']].map(([v, l]) => `<button data-v="${v}">${l}</button>`).join('')}</div></div>
            <div class="np-opt" data-np-recall-row><span class="lbl">🧠 Повторить ответ ещё раз</span><div class="seg-mini" data-np-rrep><button data-v="1">Да</button><button data-v="0">Нет</button></div></div>
            ${X ? `<div class="np-opt np-sleep">${X.sleepHtml()}</div>` : ''}
          </div>
          <div class="np-foot">
            <button class="np-link" data-np="settings">⚙️ Все настройки</button>
            <button class="np-link" data-np="choose">${HP(15, true)} Слушать другое</button>
            ${X ? '<button class="np-link" data-lx="dl" data-np-dl>⬇ Скачать озвучку колоды</button>' : ''}
            <button class="np-link" data-np="help">❔ Как слушать</button>
            <span class="np-keys">Пробел — пауза · ← → — карточки · Esc — свернуть</span>
          </div></div>`,
        onClose: () => { document.removeEventListener('listen-state', paint); document.removeEventListener('lx-state', paint); document.removeEventListener('keydown', onKey, true); },
      });
      // «свернуть» instead of «закрыть»: playback goes on in the bar at the bottom
      const x = m.$('[data-close]'); x.innerHTML = ico('down', 20); x.title = 'Свернуть — звук продолжит играть'; x.setAttribute('aria-label', 'Свернуть — звук продолжит играть');
      // ✕ — stop and close (asks first; the place is remembered)
      const xx = document.createElement('button');
      xx.type = 'button'; xx.className = 'icon-btn sm np-x'; xx.dataset.npClose = ''; xx.title = 'Закрыть'; xx.setAttribute('aria-label', 'Закрыть');
      xx.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
      x.after(xx);
      xx.onclick = () => this.stopAsk();
      const home = m.$('.modal-home'); if (home) home.remove();
      const seek = m.$('[data-np-seek]');
      let dragging = false;
      const paint = () => {
        if (this._restarting) return;
        const p = Listen.p;
        if (!p) { m.close(); return; }
        const c = p.cards[p.i] || {};
        const raw = !!c.raw, media = !!p.o.media; // 🎬 a queue of videos (Telegram authors)
        const no = raw ? String(c.raw).split('\n')[0] : String(c.no || '').split('\n')[0];
        const ru = raw ? String(c.raw).split('\n').slice(1).join(' ').slice(0, 220) : media ? String(c.ru || '').split('\n')[0] : Listen.trLine(c); // 🇷🇺 / 🇺🇦 / both — Settings → «Язык перевода»
        m.$('[data-np-src]').textContent = (p.deck ? p.deck.name : 'Все колоды') + (media ? ` · ${p.o.mediaAudio ? 'запись' : 'видео'} ${p.i + 1} из ${p.cards.length}` : raw && c.no ? ` · ${String(c.no).slice(0, 60)}` : '');
        m.$('[data-np-no]').innerHTML = UI.rich(no.slice(0, 300)) || '…';
        m.$('[data-np-ru]').textContent = ru;
        m.$('[data-np-ru]').lang = !raw && !media && Listen.trLang() === 'uk' && String(c.uk || '').trim() ? 'uk' : 'ru';
        const art = m.$('[data-np-art]');
        const cover = media ? c.art || '' : p.deck && p.deck.cover;
        art.style.backgroundImage = cover ? `url('${String(cover).replace(/'/g, '%27')}')` : '';
        art.classList.toggle('has-cover', !!cover);
        art.classList.toggle('playing', !!p.playing);
        m.el.classList.toggle('paused', !p.playing);
        const t = m.$('[data-np="toggle"]');
        t.innerHTML = UI.icon(p.playing ? 'pause' : 'play', 34);
        t.title = p.playing ? 'Пауза (пробел)' : 'Продолжить (пробел)';
        const total = p.cards.length;
        if (!dragging) { seek.max = String(Math.max(1, total)); seek.value = String(p.i + 1); }
        seek.disabled = total < 2;
        seek.style.setProperty('--fill', total > 1 ? `${(p.i / (total - 1)) * 100}%` : '100%');
        m.$('[data-np-pos]').textContent = Listen.progressText();
        const per = raw || media ? 0 : Listen.perCard(p.o);
        const left = media ? Math.round((p.cards.slice(p.i).reduce((n, x) => n + (+x.sec || 0), 0) - (p.audio.currentTime || 0)) / 60) : Math.round((total - p.i - 1) * per / 60);
        m.$('[data-np-left]').textContent = per || media ? (left >= 1 ? `осталось ~${left} мин` : 'почти конец') : '';
        m.$('[data-np="back"]').title = media ? 'На 15 секунд назад' : 'На 10 назад';
        m.$('[data-np="fwd"]').title = media ? 'На 15 секунд вперёд' : 'На 10 вперёд';
        m.$('[data-np="loop"]').classList.toggle('on', !!p.o.loop);
        const mr = Listen.mediaRate ? Listen.mediaRate() : 1, mv = mr < 0.95 ? 'slow' : mr > 1.05 ? 'fast' : 'normal';
        m.$$('[data-np-speed] button').forEach(b => b.classList.toggle('active', b.dataset.v === (media ? mv : Store.settings.ttsSpeed || 'normal')));
        const TF = window.Study && Study.trFlag ? Study.trFlag() : '🇷🇺';
        const dirs = raw ? [['all', '🇳🇴 + 🇷🇺'], ['no', 'Только 🇳🇴']] : [['nr', `🇳🇴 → ${TF}`], ['rn', `${TF} → 🇳🇴`], ['recall', '🧠 Вспомни сам'], ['no', 'Только 🇳🇴']];
        const curDir = raw ? (p.o.dir === 'no' ? 'no' : 'all') : p.o.dir;
        const dirBox = m.$('[data-np-dir]');
        const html = dirs.map(([v, l]) => `<button data-v="${v}" class="${v === curDir ? 'active' : ''}">${l}</button>`).join('');
        if (dirBox.innerHTML !== html) dirBox.innerHTML = html;
        dirBox.closest('.np-opt').hidden = media;
        m.$('[data-np-pause-row]').hidden = raw || media || p.o.dir === 'no' || p.o.dir === 'recall';
        m.$$('[data-np-pause] button').forEach(b => b.classList.toggle('active', +b.dataset.v === +p.o.pause));
        m.$$('[data-np-recall-row]').forEach(r => { r.hidden = raw || media || p.o.dir !== 'recall'; });
        m.$$('[data-np-rpause] button').forEach(b => b.classList.toggle('active', String(b.dataset.v) === String(p.o.recallPause || 'auto')));
        m.$$('[data-np-rrep] button').forEach(b => b.classList.toggle('active', (b.dataset.v === '1') === (p.o.recallRepeat !== false)));
        m.$('[data-np="settings"]').hidden = !!(raw || media || p.list);
        const dl = m.$('[data-np-dl]'); if (dl) dl.hidden = !!(raw || p.list || !p.o.deckId);
        if (X) {
          const out = X.prefs().out;
          m.el.classList.toggle('np-speaker', out === 'speaker');
          m.el.classList.toggle('np-pocket', out === 'headphones');
        }
        // ▶ where it was left last time: «Продолжить с N-й» / «Сначала»
        const rb = m.$('[data-np-resume]'), r = p.resumed;
        const showR = !!(r && !r.done && X);
        if (showR) {
          const w = X.resumeWhere(r);
          const html = `<span class="np-res-txt">⏯ Вы остановились ${r.page ? `на стр. ${r.page}` : media ? `на ${r.at + 1}-${p.o.mediaAudio ? 'й записи' : 'м видео'} из ${p.cards.length}` : `на ${r.at + 1}-й карточке из ${p.cards.length}`}</span>
            <span class="np-res-act"><button class="np-pill on" data-np="resume-keep" title="${U.esc(w)}">▶ Продолжить с места, где остановились</button><button class="np-pill" data-np="resume-start">Начать сначала</button></span>`;
          if (rb.dataset.k !== w) { rb.innerHTML = html; rb.dataset.k = w; }
        }
        rb.hidden = !showR;
      };
      seek.addEventListener('input', () => {
        dragging = true;
        const p = Listen.p; if (!p) return;
        m.$('[data-np-pos]').textContent = `→ ${seek.value} / ${p.cards.length}`;
        seek.style.setProperty('--fill', `${((seek.value - 1) / Math.max(1, p.cards.length - 1)) * 100}%`);
      });
      seek.addEventListener('change', () => { dragging = false; if (Listen.p) { Listen.prime(); Listen.goTo(+seek.value - 1); } });
      const step = d => { const p = Listen.p; if (p) Listen.goTo(Math.max(0, Math.min(p.cards.length - 1, p.i + d))); };
      m.el.addEventListener('click', e => {
        const seg = e.target.closest('[data-np-speed] button, [data-np-dir] button, [data-np-pause] button, [data-np-rpause] button, [data-np-rrep] button');
        if (seg) {
          const box = seg.parentElement, v = seg.dataset.v;
          if (box.matches('[data-np-speed]') && Listen.p && Listen.p.o.media) Listen.setMediaRate({ slow: 0.8, normal: 1, fast: 1.2 }[v] || 1); // 🎬 the video's own speed
          else if (box.matches('[data-np-speed]')) { if ((Store.settings.ttsSpeed || 'normal') !== v) { TTS.setSpeed(v); this.restart(); } }
          else if (box.matches('[data-np-dir]')) { if (Listen.p && Listen.p.o.dir !== (v === 'all' ? 'nr' : v)) this.setOpt({ dir: v === 'all' ? 'nr' : v }); }
          else if (box.matches('[data-np-rpause]')) this.setOpt({ recallPause: v === 'auto' ? 'auto' : +v });
          else if (box.matches('[data-np-rrep]')) this.setOpt({ recallRepeat: v === '1' });
          else this.setOpt({ pause: +v });
          paint(); return;
        }
        const a = e.target.closest('[data-np]'); if (!a) return;
        const act = a.dataset.np;
        if (act === 'toggle') { Listen.prime(); Listen.toggle(); }
        if (act === 'prev') Listen.jump(-1);
        if (act === 'next') Listen.jump(1);
        if (act === 'back') { if (Listen.p && Listen.p.o.media) Listen.seekBy(-15); else step(-10); }
        if (act === 'fwd') { if (Listen.p && Listen.p.o.media) Listen.seekBy(15); else step(10); }
        if (act === 'stop') this.stopAsk();
        if (act === 'loop') { const p = Listen.p; if (p) { p.o.loop = !p.o.loop; if (!p.o.noRender) Listen.saveOpts(Object.assign(Listen.opts(), { loop: p.o.loop })); UI.toast(p.o.loop ? '🔁 По кругу: когда закончится — начнётся заново' : 'Один раз до конца', '', 2200); paint(); } }
        if (act === 'dark') Listen.dark(true);
        if (act === 'out') Listen.chooseOutput();
        if (act === 'resume-keep' || act === 'resume-start') {
          const p = Listen.p;
          if (p && p.resumed) p.resumed.done = true;
          if (act === 'resume-start' && p) { Listen.prime(); Listen.goTo(0); }
          paint();
        }
        if (act === 'settings') { const p = Listen.p; m.close(); Listen.open(p ? p.o.deckId : ''); }
        if (act === 'choose') { m.close(); this.chooser(); }
        if (act === 'help') this.intro();
      });
      const onKey = e => {
        if (!document.body.contains(m.el) || e.metaKey || e.ctrlKey || e.altKey) return;
        // only when the player is the window on top
        const top = [...document.querySelectorAll('#modal-root > .modal-backdrop:not(.closing)')].pop();
        if (!top || !top.contains(m.el)) return;
        if (e.target.matches && e.target.matches('input:not([type=range]), textarea, select')) return;
        const k = e.key;
        if (k === ' ' || k === 'Spacebar' || k === 'k') { e.preventDefault(); e.stopPropagation(); Listen.prime(); Listen.toggle(); }
        else if (k === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); Listen.jump(-1); }
        else if (k === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); Listen.jump(1); }
      };
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('listen-state', paint);
      document.addEventListener('lx-state', paint);
      paint();
      if (X) X.paintAll();
      setTimeout(() => { const t = m.$('[data-np="toggle"]'); if (t) t.focus({ preventScroll: true }); }, 80);
      return m;
    },
    /** an option changed in the player: the same cards from the same place, with the new option */
    setOpt(o) {
      const p = Listen.p; if (!p) return;
      Object.assign(p.o, o);
      if (!p.o.noRender && !p.list) Listen.saveOpts(Object.assign(Listen.opts(), o));
      this.restart();
    },
    restart() {
      const p = Listen.p; if (!p) return;
      const keep = { deck: p.deck, _src: p._src, list: p.list, graded: p.graded }, was = p.playing, at = p.i;
      Listen.prime();
      this._restarting = true;
      try {
        const o = Object.assign({}, p.o, { dark: false });
        if (p.rendered) Listen.startRendered(p.cards, o, at); else Listen.startClips(p.cards, o, at);
      } finally { this._restarting = false; }
      Object.assign(Listen.p, keep);
      if (!was) Listen.pause();
      Listen.updateMeta(true);
    },

    /* ---------- the intro window: animated earbuds ---------- */
    /** the earbuds picture (also in «Как пользоваться» → listening) */
    art(cls) { return ART(cls); },
    intro() {
      patch({ intro: state().intro || Date.now() });
      const m = UI.modal({
        title: '', cls: 'narrow lp-intro',
        body: `${ART()}
          <h2 class="lp-h">Слушайте всё — в наушниках или через динамик</h2>
          <p class="lp-p">На телефоне и на компьютере. Подключены наушники — звук пойдёт в них, нет — вслух через динамик.</p>
          <ul class="lp-list">
            <li><span>✅</span><span><b>Уже сейчас:</b> карточки и колоды, книги, PDF и мой учебник, новости, выражения.</span></li>
            <li><span>📻</span><span><b>Радио и подкасты NRK</b> — с субтитрами и переводом.</span></li>
            <li><span>🧠</span><span><b>«Вспомни сам»:</b> звучит перевод — вы говорите по-норвежски — потом ответ. «Знаю / не знаю» — прямо во время прослушивания.</span></li>
            <li><span>🌑</span><span>Экран можно затемнить или заблокировать — на iPhone карточки звучат и с заблокированным экраном.</span></li>
            <li><span>🗣</span><span><b>«Переводчик»</b> — это другое: он слушает людей вокруг и переводит их слова вам в наушники.</span></li>
          </ul>`,
        foot: `<button class="btn ghost" data-lp="ok">Понятно</button><button class="btn primary lg listen-cta" data-lp="go">${HP(20, false)} Начать слушать</button>`,
      });
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-lp]'); if (!b) return;
        m.close();
        if (b.dataset.lp === 'go') { if (Listen.p) this.nowPlaying(); else this.chooser(); }
      });
      return m;
    },
    /** first visit of the main screen: the intro — after the other first-run windows, never on top of one */
    firstRun() {
      let s = state();
      // the very first start of this version: somebody who has already listened (saved options) needs no reminders
      if (!Object.keys(s).length && Store.settings && Store.settings.listen) s = patch({ used: Date.now() });
      if (s.intro) { this.remind(); return; }
      let tries = 0, calm = 0;
      const t = setInterval(() => {
        tries++;
        const ok = window.App && App.view && App.view.name === 'home' && !modalOpen() && !Listen.p && !(window.Interp && Interp.on) && !document.querySelector('.dark-screen');
        calm = ok ? calm + 1 : 0;
        if (calm >= 2) { clearInterval(t); if (!state().intro) this.intro(); }
        else if (tries > 240) clearInterval(t); // 4 minutes: next visit
      }, 1000);
    },
    /** a soft reminder until listening has been started once: a dot on «Слушать», a bubble ≤ once a day, ≤ 5 times */
    remind() {
      const s = state();
      if (s.used || s.never) return;
      const btn = document.getElementById('listen-btn'); if (!btn) return;
      btn.classList.add('lt-new');
      const now = Date.now(), day = 20 * 3600e3;
      if ((s.shown || 0) >= 5 || (s.last && now - s.last < day)) return;
      let tries = 0;
      const t = setInterval(() => {
        if (++tries > 60) { clearInterval(t); return; }
        if (!(window.App && App.view && App.view.name === 'home') || modalOpen() || Listen.p || document.querySelector('.lt-hint')) return;
        const r = btn.getBoundingClientRect(); if (!r.width) return;
        clearInterval(t);
        patch({ shown: (state().shown || 0) + 1, last: Date.now() });
        const tip = document.createElement('div');
        tip.className = 'lt-hint'; tip.setAttribute('role', 'status');
        tip.innerHTML = `<span class="lt-hint-txt">${HP(18, true)} <span>Карточки, книги и новости можно <b>слушать в наушниках</b> или через динамик — даже с выключенным экраном.</span></span>
          <span class="lt-hint-act"><button type="button" class="btn sm primary" data-lth="go">Показать</button><button type="button" class="btn sm ghost" data-lth="never">Больше не напоминать</button></span>`;
        document.body.appendChild(tip);
        const place = () => {
          if (!tip.isConnected) return;
          const b = btn.getBoundingClientRect(), w = tip.offsetWidth;
          const left = Math.max(10, Math.min(innerWidth - w - 10, b.left + b.width / 2 - w / 2));
          tip.style.left = left + 'px'; tip.style.top = (b.bottom + 12) + 'px';
          tip.style.setProperty('--arrow', Math.max(16, Math.min(w - 16, b.left + b.width / 2 - left)) + 'px');
        };
        place(); requestAnimationFrame(place);
        window.addEventListener('resize', place);
        const gone = () => { window.removeEventListener('resize', place); tip.classList.add('out'); setTimeout(() => tip.remove(), 350); };
        tip.addEventListener('click', e => {
          const b = e.target.closest('[data-lth]'); if (!b) return;
          if (b.dataset.lth === 'go') this.chooser();
          else { patch({ never: Date.now() }); btn.classList.remove('lt-new'); UI.toast('Хорошо. Кнопка «🎧 Слушать» — всегда наверху', '', 3500); }
          gone();
        });
        setTimeout(() => { if (tip.isConnected) gone(); }, 12000);
      }, 1000);
    },
  };

  /* buttons anywhere: data-listen-choose (the chooser), data-listen-intro (the intro), data-listen-deck="id" */
  document.addEventListener('click', e => {
    const c = e.target.closest('[data-listen-choose]');
    if (c) { e.preventDefault(); if (c.dataset.listenChoose === 'expr') ListenUI.expressions(); else ListenUI.chooser(); return; }
    const i = e.target.closest('[data-listen-intro]');
    if (i) { e.preventDefault(); ListenUI.intro(); return; }
  });
  // listening has started (from anywhere) → the reminder has done its job
  document.addEventListener('listen-state', () => { if (Listen.p && !state().used) ListenUI.markUsed(); });
  const boot = () => setTimeout(() => { try { ListenUI.firstRun(); } catch (e) { console.warn('listen intro', e); } }, 1500);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.ListenUI = ListenUI;
})();
