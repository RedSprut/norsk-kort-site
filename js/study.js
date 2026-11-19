/* ============ Study session ============ */
(function () {
  let S = null; // current session

  const Study = {
    get session() { return S; },

    /** build list of {id, dir} */
    buildQueue({ deckId, filter, dir, size, shuffle, cardIds, dryRun }) {
      const st = Store.settings;
      filter = filter || st.filter; dir = dir || st.direction;
      size = size == null ? st.sessionSize : size;
      shuffle = shuffle == null ? st.shuffle : shuffle;
      let cards = cardIds ? cardIds.map(id => Store.card(id)).filter(Boolean) : Store.cards(deckId);
      const now = Date.now();
      const dirs = dir === 'mix' ? ['nr', 'rn'] : [dir];
      const pickDir = c => {
        if (dir !== 'mix') return dir;
        const due = dirs.filter(d => c.srs[d] && c.srs[d].reps && c.srs[d].due <= now);
        if (due.length) return due[Math.floor(Math.random() * due.length)];
        return Math.random() < 0.5 ? 'nr' : 'rn';
      };
      let items = [];
      const sdir = dir === 'mix' ? null : dir;
      if (filter === 'smart' && !cardIds) {
        const due = cards.filter(c => Store.isDue(c, sdir, now))
          .map(c => ({ c, due: Math.min(...dirs.map(d => (c.srs[d] && c.srs[d].reps) ? c.srs[d].due : Infinity)) }))
          .sort((a, b) => a.due - b.due).map(x => x.c);
        // 🛟 backlog guard: when overdue reviews pile up, new words wait until you catch up (otherwise the pile only grows)
        const paused = Study.backlogPaused(due.length);
        const newLimit = paused ? 0 : Math.max(0, st.newPerDay - Store.newStudiedToday());
        const fresh = cards.filter(c => dirs.every(d => !(c.srs[d] && c.srs[d].reps))).slice(0, newLimit);
        items = (shuffle ? U.shuffle(due) : due).concat(shuffle ? U.shuffle(fresh) : fresh);
      } else {
        if (filter === 'leech') items = cards.filter(c => Store.isLeech(c));
        else if (filter && filter !== 'all' && filter !== 'smart') items = cards.filter(c => Store.status(c, sdir) === filter);
        else items = cards.slice();
        if (shuffle) items = U.shuffle(items);
      }
      if (size) items = items.slice(0, size);
      if (dryRun) return items;
      return items.map(c => ({ id: c.id, dir: pickDir(c) }));
    },

    /** how many overdue reviews mean «stop adding new words for now» (setting backlogGuard, default on) */
    backlogLimit() { const st = Store.settings; return Math.max(50, (st.newPerDay || 20) * 5); },
    backlogPaused(dueCount) { return Store.settings.backlogGuard !== false && dueCount > this.backlogLimit(); },

    start(opts = {}) {
      const st = Store.settings;
      const o = Object.assign({ mode: st.mode, dir: st.direction, filter: st.filter, size: st.sessionSize, shuffle: st.shuffle }, opts);
      let queue = this.buildQueue(o);
      if (!queue.length && o.filter === 'smart') {
        queue = this.buildQueue(Object.assign({}, o, { filter: 'all' }));
        if (queue.length) UI.toast('На сегодня всё повторено 🎉 Запускаю повторение всех карт.', 'good', 4000);
      }
      if (!queue.length) { UI.toast('Нет карточек для изучения', 'warn'); return; }
      if (o.mode === 'listen') queue.forEach(q => { q.dir = 'nr'; });
      S = {
        opts: o, mode: o.mode, deckId: o.deckId, queue, total: queue.length, done: 0, known: 0, unknown: 0,
        allIds: [...new Set(queue.map(q => q.id))], // every card of this session (for «🗂 Все карты»)
        first: new Map(), unknownIds: new Set(), history: [], startedAt: Date.now(), flipped: false, locked: false,
      };
      App.go('study');
    },

    render(root) {
      if (!S) { App.go('home'); return; }
      root.innerHTML = `<div class="study" data-layout="${Store.settings.studyLayout || 'auto'}">
        <div class="study-top">
          <button class="top-btn" data-act="exit" title="Завершить сессию (Esc)">${UI.icon('close', 18)}</button>
          <button class="top-btn home-btn study-home" data-home aria-label="На главный экран" data-tip="На главный экран">${UI.HOME_SVG(18)}</button>
          <div class="progress lg"><div class="fill" data-progress></div><div class="label" data-plabel></div></div>
          ${S.mode === 'listen' ? '' : `<div class="dir-switch" title="Направление: что на лицевой стороне">
            ${[['nr', `🇳🇴→${this.trFlag()}`, 'Норвежское слово → вспомнить перевод'], ['rn', `${this.trFlag()}→🇳🇴`, 'Перевод → вспомнить норвежское слово'], ['mix', '🔀', 'Вперемешку']].map(([v, l, t]) =>
              `<button class="${(S.opts.dir || 'nr') === v ? 'active' : ''}" data-act="dir" data-dir="${v}" title="${t}">${l}</button>`).join('')}</div>`}
          <button class="top-btn hints-btn ${Store.settings.hints === false ? 'off' : ''}" data-act="hints" title="Подсказки на лицевой стороне (картинка, часть речи, значки)">${UI.icon(Store.settings.hints === false ? 'bulbOff' : 'bulb', 18)}<span>Подсказки</span></button>
          <button class="top-btn layout-btn" data-act="layout" title="Расположение кнопок">${UI.icon('layout', 18)}<span>Раскладка</span></button>
          <button class="top-btn" data-act="undo" title="Отменить последний ответ (Z)">${UI.icon('undo', 18)}<span>Отменить</span></button>
        </div>
        <div class="session-tools">
          <button class="btn sm" data-act="all-cards" title="Быстро посмотреть все карты этой сессии и перейти к любой">🗂 Все карты · ${S.allIds.length}</button>
          <button class="btn sm" data-act="reshuffle" title="Перемешать оставшиеся карты">🔀 Перемешать</button>
          ${S.mode === 'listen' ? '' : this.trSegHtml('study-trseg')}
        </div>
        <div class="counters"><span class="k" data-k>✓ 0</span><span class="u" data-u>✗ 0</span><span class="r" data-r></span></div>
        <div data-area></div>
      </div>`;
      root.onclick = e => this.onClick(e);
      this.next(true);
    },

    updateTop() {
      const root = document.getElementById('view');
      const pct = S.total ? Math.round(S.done / S.total * 100) : 0;
      const f = root.querySelector('[data-progress]'); if (!f) return;
      f.style.width = pct + '%';
      root.querySelector('[data-plabel]').textContent = `${S.done} / ${S.total} · ${pct}%`;
      const k = root.querySelector('[data-k]'), u = root.querySelector('[data-u]');
      const bump = (el, txt) => { if (el.textContent === txt) return; el.textContent = txt; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
      bump(k, `✓ ${S.known} знаю`);
      bump(u, `✗ ${S.unknown} не знаю`);
      root.querySelector('[data-r]').textContent = `осталось ${S.queue.length}`;
    },

    current() { return S && S.queue[0] ? { item: S.queue[0], card: Store.card(S.queue[0].id) } : null; },
    /** show this card now (from «🗂 Все карты»); an already answered card comes back once more */
    jumpTo(cardId) {
      if (!S) return;
      const k = S.queue.findIndex(q => q.id === cardId);
      if (k === 0) return;
      if (k > 0) S.queue.unshift(S.queue.splice(k, 1)[0]);
      else { const d = S.opts.dir === 'rn' ? 'rn' : 'nr'; S.queue.unshift({ id: cardId, dir: d }); S.total++; }
      S.flipped = false; S.locked = false; S.answeredType = null; S.quizDone = false;
      this.updateTop();
      this.renderCard(true);
    },

    next(first) {
      // skip deleted cards
      while (S.queue.length && !Store.card(S.queue[0].id)) { S.queue.shift(); S.done++; }
      this.updateTop();
      if (!S.queue.length) return this.finish();
      S.flipped = false; S.locked = false; S.answeredType = null; S.quizDone = false;
      this.renderCard(true);
    },

    /* ---------- card rendering ---------- */
    faceText(card, side) { return side === 'no' ? card.no : this.tr(card); },
    wordHtml(text, lang) {
      const len = String(text || '').length;
      // one sentence (a subtitle line, an example) stays centred and big; only real multi-line texts are laid out as text
      const cls = this.isText(text) ? 'long' : len > 60 ? 'sentence' : len > 26 ? 'medium' : '';
      return `<div class="word ${cls}"${lang ? ` lang="${lang}"` : ''}>${UI.rich(text)}</div>`;
    },

    /* ---------- 🇷🇺 / 🇺🇦 the translation language (Settings → «Язык перевода» · Store.settings.transLang: ru | uk | both) ---------- */
    trFlag(l) { l = l || this.trLang(); return l === 'uk' ? '🇺🇦' : l === 'both' ? '🇷🇺🇺🇦' : '🇷🇺'; },
    /** «по-русски» / «по-украински» / «по-русски или по-украински» — for hints and placeholders */
    trWords(l) { l = l || this.trLang(); return l === 'uk' ? 'по-украински' : l === 'both' ? 'по-русски или по-украински' : 'по-русски'; },
    ukOf(card) { return String((card && card.uk) || '').trim(); },
    /** the card's translation as plain text in the chosen language; 🇺🇦 without a Ukrainian translation → the Russian one */
    tr(card, lang) {
      const l = lang || this.trLang(), ru = String((card && card.ru) || ''), uk = this.ukOf(card);
      if (l === 'uk') return uk || ru;
      if (l === 'both' && uk && uk !== ru.trim()) return ru.includes('\n') || uk.includes('\n') ? `${ru}\n\n${uk}` : `${ru} / ${uk}`;
      return ru;
    },
    /** 🇺🇦 is chosen, but this card has only the Russian translation (it is shown with a small 🇷🇺 mark) */
    trRuOnly(card) { return this.trLang() === 'uk' && !this.ukOf(card) && !!String(card.ru || '').trim(); },
    /** every accepted translation: the chosen language first (typed answers are accepted in Russian AND Ukrainian) */
    trAnswers(card) { const ru = String(card.ru || ''), uk = this.ukOf(card); return (this.trLang() === 'uk' ? [uk, ru] : [ru, uk]).filter(Boolean); },
    trFbHtml() { return '<div class="tr-fb" title="У этой карточки пока нет украинского перевода — показан русский. Добавить: ✏️ Редактировать → 🇺🇦 Українською">🇷🇺 <span>по-русски — украинского перевода пока нет</span></div>'; },
    /** the translation side of the card: big text in the chosen language (both: Russian + 🇺🇦 Ukrainian under it) */
    trHtml(card) {
      const l = this.trLang(), ru = String(card.ru || ''), uk = this.ukOf(card);
      if (l === 'uk') return uk ? this.wordHtml(uk, 'uk') : this.wordHtml(ru, 'ru') + (ru.trim() ? this.trFbHtml() : '');
      if (l === 'both' && uk && uk !== ru.trim()) return `${this.wordHtml(ru, 'ru')}<div class="tr-second" lang="uk"><span class="tr-flag" aria-label="Українською">🇺🇦</span> ${UI.rich(uk)}</div>`;
      return this.wordHtml(ru, 'ru');
    },
    /** the language tag of the translation side: «🇷🇺 РУССКИЙ» · «🇺🇦 УКРАЇНСЬКА» · both */
    trTag(card) {
      const l = this.trLang();
      if (l === 'uk' && !this.trRuOnly(card)) return '🇺🇦 УКРАЇНСЬКА';
      if (l === 'both' && this.ukOf(card)) return '<span class="lt-both">🇷🇺<span class="lt-w"> РУССКИЙ</span> + 🇺🇦<span class="lt-w"> УКРАЇНСЬКА</span></span>';
      return '🇷🇺 РУССКИЙ';
    },
    /** the small 🇷🇺 · 🇺🇦 · 🇷🇺+🇺🇦 switch (study session, launcher) */
    trSegHtml(cls = '') {
      const cur = this.trLang();
      return `<div class="seg-mini tr-seg ${cls}" role="group" aria-label="Язык перевода">${[['ru', '🇷🇺 Русский', 'Перевод на русский'], ['uk', '🇺🇦 Українська', 'Перевод на украинский (если у карточки его нет — показан русский с пометкой 🇷🇺)'], ['both', '🇷🇺+🇺🇦 Оба', 'Оба перевода: русский и украинский']].map(([v, l, t]) =>
        `<button type="button" class="${cur === v ? 'active' : ''}" data-act="trlang" data-v="${v}" aria-pressed="${cur === v}" title="${t}">${l}</button>`).join('')}</div>`;
    },
    /** a text (several lines, or longer than a couple of sentences) — not a single word / phrase / sentence */
    isText(text) { const s = String(text || ''); return s.includes('\n') || s.length > 200; },
    imgHtml(card, show) {
      if (!show) return '';
      if (card.image && !Images.isRemoteAI(card.image)) return `<img class="card-img" src="${U.esc(card.image)}" alt="" onerror="this.style.display='none'">` +
        (card.imageCredit ? `<div class="tiny muted img-credit">${/^https:\/\//i.test(card.imageCreditUrl || '') ? `<a href="${U.esc(card.imageCreditUrl)}" target="_blank" rel="noopener">${U.esc(card.imageCredit)}</a>` : U.esc(card.imageCredit)}</div>` : '');
      if (Images.skip && Images.skip(card)) return '';
      if (Store.settings.autoImages && Store.settings.imageProvider !== 'off' && !UI.isLong(card.no)) return '<div class="img-skel" data-img-wait>🎨 рисую…</div>';
      return '';
    },
    renderCard(animate) {
      const { item, card } = this.current();
      const st = Store.settings;
      const area = document.querySelector('[data-area]');
      const promptSide = item.dir === 'nr' ? 'no' : 'ru';
      const answerSide = promptSide === 'no' ? 'ru' : 'no';
      const flag = s => s === 'no' ? '🇳🇴 NORSK' : this.trTag(card);
      const hints = st.hints !== false; // off -> the front shows ONLY the word: no picture, word class or icons
      const imgFront = hints && ['front', 'both'].includes(st.imageSide);
      const imgBack = ['back', 'both'].includes(st.imageSide);
      const status = Store.status(card, item.dir);
      const listen = S.mode === 'listen';
      const front = listen
        ? `<div class="word" style="font-size:64px">🎧</div><div class="hint">Послушайте и вспомните слово и перевод</div>
           <button class="btn" data-act="speak-front">🔊 Ещё раз</button>`
        : `${this.imgHtml(card, imgFront)}${promptSide === 'no' ? this.wordHtml(card.no) : this.trHtml(card)}
           ${hints && promptSide === 'ru' && card.wordClass ? `<div class="hint">${window.Gram ? Gram.pos(card.wordClass) : U.esc(card.wordClass)}</div>` : ''}`;
      const ans = this.faceText(card, answerSide);
      const back = `
        <div class="back-main">
          ${listen ? `${this.wordHtml(card.no)}${this.trHtml(card)}` : `<div data-main-box data-prompt="${promptSide}">${this.mainInner(card, promptSide)}</div>`}
          ${this.imgHtml(card, imgBack || imgFront || listen)}
          ${this.viewBarHtml(card)}
          ${window.Gram && !listen ? Gram.badges(card) : ''}
          ${card.description ? `<div class="desc ${UI.isLong(card.description) ? 'longtext' : ''}" data-desc-box>${this.descHtml(card)}</div>` : ''}
          ${this.formsHtml(card)}
          ${this.synonymsHtml(card)}
          ${this.examplesHtml(card)}
          ${card.example ? `<div class="example">${UI.rich(card.example)} <button class="icon-btn sm" data-act="speak-ex" title="Прослушать пример">🔊</button>${card.exampleRu ? `<span class="tr">${UI.rich(card.exampleRu)}</span>` : ''}</div>` : ''}
        </div>`;
      const longFront = !listen && this.isText(this.faceText(card, promptSide));
      const longBack = UI.isLong(ans) || String(card.description || '').length > 200 || (card.forms || []).length > 0 || (card.examples || []).length > 0 || (card.synonyms || []).length > 0;
      const fb = st.fourButtons;
      const prev = FSRS.preview(card.srs[item.dir], st.retention);
      const lbl = g => `<span class="kbd">${U.fmtInterval(prev[g])}</span>`;
      let controls = '';
      if (S.mode === 'type') {
        controls = `<div class="type-box"><input class="input" data-type placeholder="Введите ${answerSide === 'no' ? 'по-норвежски' : this.trWords() + (this.trLang() === 'uk' ? ' (можно и по-русски)' : '')} и нажмите Enter" autocomplete="off" autocapitalize="off" spellcheck="false">
          <button class="btn primary" data-act="check">Проверить</button></div>
          ${answerSide === 'no' ? '<div class="row" style="justify-content:center;gap:6px;margin-top:8px">' + ['æ', 'ø', 'å', 'Æ', 'Ø', 'Å'].map(ch => `<button class="btn sm" data-act="ins" data-ch="${ch}">${ch}</button>`).join('') + '</div>' : ''}
          <div class="type-result" data-result></div>`;
      } else if (S.mode === 'quiz') {
        controls = `<div class="quiz-opts" data-quiz>${this.quizOptions(card, answerSide).map((o, i) => `<button class="quiz-opt" data-act="quiz" data-ok="${o.ok ? 1 : 0}" style="animation-delay:${i * 50}ms"><span class="n">${i + 1}</span><span>${U.esc(o.text)}</span></button>`).join('')}</div>
          <div class="center" style="margin-top:10px"><button class="btn hidden" data-act="quiz-next">Дальше →</button></div>`;
      } else {
        controls = fb
          ? `<div class="answer-row four">
              <button class="btn bad" data-act="grade" data-g="1">Снова ${lbl(1)}</button>
              <button class="btn warn" data-act="grade" data-g="2">Трудно ${lbl(2)}</button>
              <button class="btn good" data-act="grade" data-g="3">Хорошо ${lbl(3)}</button>
              <button class="btn primary" data-act="grade" data-g="4">Легко ${lbl(4)}</button></div>`
          : `<div class="answer-row">
              <button class="btn bad" data-act="grade" data-g="1">✗ Не знаю <span class="kbd">←</span></button>
              <button class="btn" data-act="flip">↻ Перевернуть</button>
              <button class="btn good" data-act="grade" data-g="3">✓ Знаю <span class="kbd">→</span></button></div>`;
      }
      area.innerHTML = `<div class="study-grid">
        <div class="center-col">
        <div class="stage">
          ${S.queue.length > 2 ? '<div class="stack-shadow s2"></div>' : ''}${S.queue.length > 1 ? '<div class="stack-shadow"></div>' : ''}
          <div class="flashcard ${animate ? 'enter' : ''}" data-card>
            <div class="inner">
              <div class="face front ${longFront ? 'long' : ''} ${hints && Object.keys(Translators.activity(card)).length ? 'has-rail' : ''}">
                <div class="lang-tag">${listen ? '🎧 АУДИРОВАНИЕ' : flag(promptSide)} ${UI.statusChip(status)}${hints ? Prov.badges(card, 17, ['manual', 'import'], true) : ''}</div>
                ${hints ? Translators.activeRailsHtml(card) : ''}
                <div class="corner">${window.Subs && promptSide === 'no' ? Subs.audioBtnHtml(card) : ''}<button class="icon-btn sm" data-act="speak-front" title="Прослушать (S)">🔊</button></div>
                ${front}
                ${(S.mode === 'flip' || listen) && hints ? `<div class="tap-hint">${this.hintText()}</div>` : ''}
              </div>
              <div class="face back has-rail ${longBack ? 'long' : ''}">
                <div class="lang-tag">${flag(answerSide)}${Prov.badges(card, 17, ['manual', 'import'], true)}</div>
                <div class="corner">${window.Subs ? Subs.audioBtnHtml(card) : ''}<button class="icon-btn sm" data-act="grammar" title="📐 Грамматика к этому слову (grammatikk.com)">📐</button><button class="icon-btn sm" data-act="youtube" title="Видео про это слово на YouTube">${YouTube.YT_SVG(16)}</button><button class="icon-btn sm" data-act="copy-card" title="Скопировать весь текст карточки">📋</button><button class="icon-btn sm" data-act="speak-back" title="Прочитать эту сторону (S)">🔊</button></div>
                ${Translators.aiRailHtml('vertical card-rail left', card)}
                ${Translators.railHtml('vertical card-rail right', card)}
                ${back}
              </div>
            </div>
          </div>
        </div>
        ${controls}
        <div data-explain></div>
        <div class="kbd-help"><kbd>Пробел</kbd> перевернуть · <kbd>→</kbd>/<kbd>2</kbd> знаю · <kbd>←</kbd>/<kbd>1</kbd> не знаю · <kbd>S</kbd> озвучить · <kbd>P</kbd> пауза · <kbd>E</kbd> редактировать · <kbd>Z</kbd> отменить · <kbd>Esc</kbd> выход</div>
        </div>
        <aside class="study-tools tools-read" data-read-tools>
          <div class="tools-title">🔊 Озвучка</div>
          ${[['all', '🔊 Читать всё'], ['no', '🇳🇴 Только норвежский'], ['ru', '🇷🇺 Только русский']].map(([m, l]) =>
            `<button class="btn sm ${st.readMode === m ? 'primary' : ''}" data-act="read" data-mode="${m}" title="Прочитать видимую сторону карточки">${l}</button>`).join('')}
          <button class="btn sm listen-btn listen-cta" data-act="listen-deck" data-listen-btn data-label="Слушать колоду" title="🎧 Слушать всю колоду вслух — через динамик или в наушниках"></button>
          <button class="btn sm" data-speech-pron="${U.esc(String(card.no).split('\n')[0].slice(0, 300))}" data-ru="${U.esc(String(card.ru).split('\n')[0].slice(0, 300))}" title="Скажите это вслух — приложение распознает речь прямо на устройстве и покажет, какие слова прозвучали верно">🗣 Произношение</button>
          <button class="btn sm" data-act="native" title="Слово голосом настоящего носителя языка (запись Lingua Libre, если она есть), а дальше — вся карточка синтезированным голосом. Пауза / стоп / сначала — кнопками ниже">🎙 Живой голос</button>
          <div class="speed-seg" data-speed-seg title="Скорость озвучки">
            ${[['slow', '🐢', 'Медленно'], ['normal', '🚶', 'Обычно'], ['fast', '🐇', 'Быстро']].map(([v, ic, l]) =>
              `<button class="${(st.ttsSpeed || 'normal') === v ? 'active' : ''}" data-act="speed" data-speed="${v}" title="${l}"><span class="sp-ic">${ic}</span><span class="sp-l">${l}</span></button>`).join('')}
          </div>
          <span class="tts-ctl media-row" data-tts-ctl>
            <button class="media-btn main" data-act="tts-toggle" title="Читать / пауза / продолжить (P)">${UI.icon('play', 22)}</button>
            <button class="media-btn" data-act="tts-stop" title="Стоп — остановить полностью" disabled>${UI.icon('stop', 18)}</button>
            <button class="media-btn" data-act="tts-restart" title="Сначала — прочитать заново" ${TTS.last ? '' : 'disabled'}>${UI.icon('restart', 18)}</button>
          </span>
        </aside>
        <aside class="study-tools tools-card">
          <div class="tools-title">🛠 Карточка</div>
          <button class="btn sm" data-act="edit">✏️ Редактировать</button>
          <button class="btn sm" data-act="copy-card" title="Скопировать весь текст карточки: слово, перевод, описание, формы, примеры">📋 Копировать текст</button>
          <button class="btn sm gk-btn" data-act="grammar" title="Грамматика к этому слову / фразе: темы grammatikk.com с переводом на русский — нужное можно добавить в карточку">📐 Грамматика</button>
          <button class="btn sm" data-act="telegram" title="Посты, видео, карточки-картинки и файлы из Telegram-каналов по этому слову">${Telegram.TG_SVG(18)} Telegram</button>
          <button class="btn sm" data-act="social" title="Подкасты с расшифровкой, ВКонтакте, TikTok, Instagram, Pinterest, Reddit — по этому слову">🌐 Ещё источники</button>
          <button class="btn sm yt-btn" data-act="youtube" title="Видео про это слово / выражение: поиск на YouTube и на каналах учителей норвежского">${YouTube.YT_SVG(18)} YouTube</button>
          <button class="btn sm lib-btn" data-act="library" title="Библиотека устойчивых выражений — создать колоду выражений из открытых источников">${Library.CARDS_SVG(18)} Выражения</button>
          <button class="btn sm" data-act="redraw" title="Нарисовать новую картинку по смыслу">🎨 Перерисовать</button>
          <button class="btn sm ai" data-act="enrich" data-kind="forms" title="Все формы слова, у каждой — свой перевод">📚 Формы слова</button>
          <button class="btn sm ai" data-act="enrich" data-kind="examples" title="Примеры на каждую форму/время с переводом и подсказкой, когда так говорят">💬 Примеры по формам</button>
          <button class="btn sm ai" data-act="enrich" data-kind="synonyms" title="Синонимы с переводом и объяснением разницы (без нейросети — из словаря Ordbøkene)">🔁 Синонимы</button>
          <button class="btn sm ai" data-act="add-explain" title="Нейросеть допишет в карточку формы, примеры и выражения — перевод в скобках">➕ Добавить объяснение</button>
          <button class="btn sm ai" data-act="explain">${AI.icon(AI.current(), 14) || '🤖'} Объяснить</button>
          <button class="btn sm ai" data-act="ai-check">${AI.icon(AI.current(), 14) || '🤖'} Проверить карту (${U.esc(AI.name())})</button>
          <button class="btn sm" data-act="ordbok">📖 Ordbøkene</button>
        </aside>
      </div>`;
      this.bindSwipe(area.querySelector('[data-card]'));
      setTimeout(() => TTS.emit(), 0); // sync pause/stop buttons with the player
      this.fillExamples(card); // sentence / word translations for the chosen view of the examples
      const inp = area.querySelector('[data-type]');
      if (inp) { setTimeout(() => inp.focus(), 60); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); S.answeredType ? this.typeNext() : this.checkTyped(); } }); }
      // audio
      if (listen) setTimeout(() => TTS.speak(card.no, 'no'), 250);
      else if (st.autoSpeak && promptSide === 'no' && String(card.no).length < 200) setTimeout(() => { if (this.current() && this.current().card.id === card.id) TTS.speak(card.no, 'no'); }, 300);
      // lazy image
      if (area.querySelector('[data-img-wait]')) {
        Images.ensure(card).then(url => {
          const cur = this.current();
          if (!url || !cur || cur.card.id !== card.id) return;
          area.querySelectorAll('[data-img-wait]').forEach(el => { el.outerHTML = `<img class="card-img" src="${U.esc(url)}" alt="">`; });
        }).catch(() => area.querySelectorAll('[data-img-wait]').forEach(el => el.remove()));
      }
    },

    /** who made the forms/examples (last history entry of that kind) */
    madeBy(card, action) {
      const h = (card.history || []).filter(x => x.a === action).pop();
      return h ? `<button class="prov-b" data-prov="${U.esc(h.by)}" data-card="${card.id}" title="${U.esc(Prov.name(h.by))}">${Prov.icon(h.by, 14)}</button>` : '';
    },
    /** the Norwegian part of a description line (no bullets / numbering / Russian in brackets), or '' */
    sayPart(line) {
      if (this.isSrcLine(line)) return ''; // «where it came from» is not Norwegian text to read, translate or gloss
      const t = String(line).replace(/\([^)]*[а-яё][^)]*\)/gi, ' ').replace(/^\s*(?:[•·\-–*]|\d+[.)])\s*/, '').replace(/^[^\p{L}]+/u, '')
        .replace(/^(📖\s*)?Ordbøkene\s*·.*$/u, '').replace(/^(📐\s*)?Grammatikk\.com\s*·.*$/u, '').replace(/^(Uttrykk|Выражения)[^:]*:\s*$/iu, '').replace(/\s+/g, ' ').trim();
      if (!/\p{L}{2}/u.test(t) || U.cyrRatio(t) > 0.3) return '';
      return t.replace(/[:;,]\s*$/, '');
    },
    /**
     * a source / note line of the description: «Источник: …», «▶ YouTube «…», 00:12 · https://…», «📺 NRK TV …»,
     * «🎬 file, 0:00:16», «📰 …», a link, «⚠️ / 🤖 …» notes — shown small, never translated word by word
     */
    isSrcLine(line) {
      const s = String(line || '').trim();
      return /^(Источник:|📍|▶\s*YouTube|📺\s*NRK|🎬\s|📰\s|🤖\s|⚠️|✍️\s*Пропущенное|в тексте:|в предложении:|форма в упражнении:)/u.test(s)
        || /^https?:\/\/\S+$/.test(s) || (/https?:\/\/\S+/.test(s) && /\d:\d\d/.test(s));
    },
    /** description: every line that has Norwegian text gets its own 🔊 */
    descHtml(card) {
      const desc = String(card.description || '');
      const lines = desc.split('\n');
      const warn = this.mtWarnOf(card);
      const DICT = /^\s*(📖 Ordbøkene ·|📗 )/u;
      let placed = false;
      const note = () => { placed = true; return this.mtNoteHtml(warn); };
      if (lines.length > 500) return (warn ? note() : '') + UI.rich(desc);
      // the same view as the examples: as is / sentence (translation) / word (translation)
      const v = Store.settings.exView || 'asis';
      const c = this.exCache();
      const html = lines.map(l => {
        if (this.isSrcLine(l)) return `<div class="desc-line desc-src">${UI.rich(l)}</div>`;
        const no = this.sayPart(l);
        const pre = warn && !placed && DICT.test(l) ? note() : '';
        const say = no ? ` <button class="icon-btn sm say-line" data-act="say" data-say="${U.esc(no)}" title="Произнести">🔊</button>` : '';
        const own = this.ruPart(l), mine = no ? this.userSent(no) : undefined;
        const ru = mine || own || (v === 'word' && no ? this.sentTr(no) || '' : '');
        if (no && v === 'word') {
          return `${pre}<div class="desc-line wbw-line">${U.esc(this.leadPart(l))}${this.glossHtml(no, mine || own || undefined)}${say}${ru ? `<div class="ex-ru">${UI.rich(ru)} ${this.sayRu(ru)}${this.trFixHtml(no)}</div>` : ''}</div>`;
        }
        if (no && v === 'sent' && (!own || mine)) {
          const tr = this.sentTr(no);
          return `${pre}<div class="desc-line">${UI.rich(own ? l.replace(/\(([^()]*[а-яё][^()]*)\)[\s.:;,]*$/i, '') : l)} <span class="ex-ru-in">(${tr ? U.esc(tr) : tr === '' ? '—' : '…'})</span>${say}${tr ? this.sayRu(tr) + this.trFixHtml(no) : ''}</div>`;
        }
        return `${pre}<div class="desc-line">${l.trim() ? UI.rich(l) : '&nbsp;'}${say}${no && ru && v !== 'asis' ? this.sayRu(ru) : ''}</div>`;
      }).join('');
      return warn && !placed ? note() + html : html;
    },
    /** «   • Han sier at… (Он говорит…)» → «Он говорит…» */
    ruPart(l) { const m = String(l).match(/\(([^()]*[а-яё][^()]*)\)[\s.:;,]*$/i); return m ? m[1].trim() : ''; },
    /** the bullet / numbering in front of a line */
    leadPart(l) { return (String(l).match(/^\s*(?:[•·▸\-–*]|\d+[.)])?\s*/) || [''])[0]; },
    sayRu(t) { return t ? `<button class="icon-btn sm ex-say" data-act="say" data-say="${U.esc(t)}" data-lang="ru" title="Произнести только русский">🔊<small>RU</small></button>` : ''; },
    /** Norwegian words, each followed by its (translation) in blue; names stay as they are.
     *  ru: the sentence translation the reader sees (the words follow it); a tap on a (translation) corrects it */
    glossHtml(s, ru) {
      let k = -1;
      if (ru === undefined) ru = this.sentTr(s);
      (this._ruOf || (this._ruOf = new Map())).set(this.sentKey(s), ru || '');
      if (this._ruOf.size > 2000) this._ruOf.clear();
      const body = String(s).split(/(\s+)/).map(w => {
        if (!/\p{L}/u.test(w)) return U.esc(w);
        k++;
        const r = this.glossInfo(s, k, ru);
        if (r.how === 'skip' || (r.g === '' && this.isName(w, k))) return `<span class="wbw"><span>${U.esc(w)}</span></span>`;
        return `<span class="wbw"><span>${U.esc(w)}</span>${this.glossSpan(r, k, w)}</span>`;
      }).join('');
      return `<span class="wbw-s" data-gs="${U.esc(this.sentKey(s))}">${body}</span>`;
    },
    GUESS_TIP: 'перевод слова без контекста — может не совпадать по смыслу',
    /** «(хотел)» · «(желание?)» uncertain · «(хотел ✓)» yours */
    glossSpan(r, k, w) {
      const short = w ? this.glossShow(w, r.g) : this.shortGloss(r.g);
      const t = short ? U.esc(short) : r.g === '' ? '—' : '…';
      const cls = r.how === 'guess' ? ' unsure' : r.how === 'user' ? ' mine' : '';
      const tip = { guess: this.GUESS_TIP, user: 'ваш перевод ✓', ai: 'нейросеть — по смыслу предложения', align: 'из перевода всего предложения', dict: 'встроенный словарик' }[r.how] || '';
      const full = r.g && short !== r.g ? r.g + ' · ' : ''; // the whole note («быть (вспомогательный глагол)») stays in the tooltip
      return `<span class="wbw-ru${cls}" data-glfix data-gk="${k}" title="${U.esc(full)}${tip ? tip + ' · ' : ''}нажмите, чтобы исправить">(${t}${r.how === 'guess' ? '?' : ''}${r.how === 'user' ? ' ✓' : ''})</span>`;
    },
    /** in a line of words a gloss is short: «быть (вспомогательный глагол)» → «быть» (the note goes to the tooltip) */
    shortGloss(g) {
      if (!g) return g;
      const s = String(g).replace(/\s*\((?:[^()]|\([^()]*\))*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
      return s || String(g);
    },
    /** how a gloss is shown after the word in a line: short, without «som — » (the word repeated), small letter
     *  when the word itself is written small («over (над)», not «over (Над)») */
    glossShow(w, g) {
      if (!g) return g;
      const bare = String(w || '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      let t = this.shortGloss(g);
      if (bare) t = t.replace(new RegExp('^' + bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[—–-]\\s*', 'i'), '');
      // a note that is all in brackets («(артикль)») would show as «((артикль))»: the brackets go
      t = t.replace(/^\(\s*([^()]*?)\s*\)$/, '$1');
      if (/^\p{Ll}/u.test(bare) && /^\p{Lu}\p{Ll}/u.test(t)) t = t.charAt(0).toLowerCase() + t.slice(1);
      return t || this.shortGloss(g);
    },
    /** ✎ next to a sentence translation: «неверный перевод — исправить»; ✓ when the translation is yours */
    trFixHtml(no) {
      if (!no) return '';
      const mine = !!this.userSent(no);
      return `${mine ? '<span class="tr-mine" title="Ваш перевод — проверен">✓</span>' : ''}<button type="button" class="icon-btn sm tr-fix" data-trfix data-s="${U.esc(this.sentKey(no))}" title="${mine ? 'Ваш перевод — изменить' : 'Неверный перевод? Исправьте или подтвердите'}" aria-label="Исправить перевод">✎</button>`;
    },
    /**
     * the card itself in the chosen view (for EVERY card whose Norwegian side is a phrase / sentence):
     *   asis — as written: the question small, the answer big;
     *   sent — sentence by sentence: each Norwegian sentence with its own translation under it;
     *   word — every Norwegian word followed by its Russian in brackets, the card's translation under it.
     */
    mainNo(card) { const s = String(card.no || '').trim(); return !s.includes('\n') && s.replace(/^(en|ei|et|å)\s+/i, '').split(/\s+/).length >= 2 && s.length <= 400 ? s : ''; }, // «en bil», «å kjøre» = one word
    mainInner(card, promptSide) {
      const answerSide = promptSide === 'no' ? 'ru' : 'no';
      const q = String(this.faceText(card, promptSide)).split('\n')[0].slice(0, 120);
      const plain = `<div class="hint">${U.esc(q)}</div>${answerSide === 'no' ? this.wordHtml(card.no) : this.trHtml(card)}`;
      const v = Store.settings.exView || 'asis', no = this.mainNo(card);
      if (v === 'asis' || !no) return plain + this.checkedHtml(card);
      const say = t => ` <button class="icon-btn sm say-line" data-act="say" data-say="${U.esc(t)}" title="Произнести">🔊</button>`;
      const sents = this.splitSent(no).filter(s => /\p{L}/u.test(s));
      if (v === 'sent') {
        if (sents.length < 2) return plain + this.checkedHtml(card); // one sentence: «as is» is already sentence by sentence
        return `<div class="mv mv-sent">${sents.map(s => { const tr = this.sentTr(s); return `<div class="mv-pair"><div class="mv-no">${U.esc(s)}${say(s)}</div>
          <div class="mv-ru">${tr ? U.esc(tr) + this.trFixHtml(s) : tr === '' ? '—' : '<span class="spinner sm"></span>'}</div></div>`; }).join('')}
          <div class="mv-full small muted">Перевод карточки: ${UI.rich(this.tr(card) || '')}</div></div>${this.checkedHtml(card)}`;
      }
      // word by word
      return `${promptSide === 'ru' ? `<div class="hint">${U.esc(q)}</div>` : ''}
        <div class="mv mv-word">${sents.map(s => `<div class="mv-line wbw-line">${this.glossHtml(s, this.mainRu(card, s, sents.length))}${say(s)}</div>`).join('')}</div>
        ${promptSide === 'no' ? this.trHtml(card) : ''}${this.checkedHtml(card)}`;
    },
    /** the translation one sentence of the card's own text is glossed against: yours ✓, the card's (one sentence), the machine one */
    mainRu(card, s, n) { return this.userSent(s) || (n === 1 && card.ru ? String(card.ru) : undefined); },
    /** «✓ Перевод проверен»: a card that was translated by a machine and later checked by a neural network or by the user */
    checkedHtml(card) {
      const h = card.history || [];
      const w = this.mtWarnOf(card);
      // no description: the warning is about the card's own translation — shown here (there is no description box for it);
      // a later AI check of the card (Проверить карту) settles it
      const aiLater = w && !card.description && h.some(x => /^ai:/.test(x.by) && ['verify', 'check'].includes(x.a) && (x.t || 0) >= (w.t || 0));
      if (w && !aiLater) return card.description ? '' : this.mtNoteHtml(w, 'ai-check'); // still unchecked: the ⚠️ note says so
      // made from a line / word whose translation you corrected or confirmed yourself (✓ in the player or on a card)
      if (h.some(x => x.by === 'manual' && x.a === 'verify' && x.f && (x.f.ru || x.f.exampleRu))) return '<div class="mt-ok-note">✓ Перевод проверен вами</div>';
      const machine = h.some(x => x.a === 'translate' && /^tr:(google|mozhi|mymemory|microsoft|deepl)$/.test(x.by));
      if (!machine) return '';
      const ai = [...h].reverse().find(x => /^ai:/.test(x.by) && ['verify', 'check', 'fill', 'translate', 'edit'].includes(x.a));
      const me = card.mtWarn === false || h.some(x => x.by === 'manual' && x.f && x.f.ru);
      if (!ai && !me) return '';
      return `<div class="mt-ok-note">✓ Перевод проверен${ai ? ` нейросетью (${U.esc(Prov.name(ai.by))})` : ' вами'} — исправлен и точный</div>`;
    },
    /* ---------- ✎ «Неверный перевод»: correct (or confirm) a word gloss / a sentence translation ---------- */
    /** the window for word k of sentence s; onDone(saved) after saving */
    fixGloss(s, k, onDone, ruShown) {
      s = this.sentKey(s);
      const toks = this.glossToks(s), w = toks[k];
      if (w === undefined) return;
      const ru = ruShown !== undefined ? ruShown : (this._ruOf && this._ruOf.has(s) ? this._ruOf.get(s) : this.sentTr(s)) || '';
      const r = this.glossInfo(s, k, ru || undefined);
      const how = { user: '✓ ваш перевод', ai: '🤖 нейросеть — по смыслу предложения', align: 'взято из перевода всего предложения', dict: 'встроенный словарик', guess: '⚠️ ' + this.GUESS_TIP }[r.how] || '';
      let n = -1;
      const sentHtml = s.split(/(\s+)/).map(x => { if (!/\p{L}/u.test(x)) return U.esc(x); n++; return n === k ? `<mark>${U.esc(x)}</mark>` : U.esc(x); }).join('');
      const m = UI.modal({
        title: `✎ Перевод слова «${U.esc(this.bareLow(w) && k > 0 ? w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') : this.bareLow(w))}»`, cls: 'narrow fix-modal',
        body: `<div class="fix-no" lang="nb">${sentHtml}</div>
          ${ru ? `<div class="fix-ru">${U.esc(ru)}</div>` : ''}
          <label class="fix-lbl" for="fix-in">Что значит это слово <b>в этом предложении</b>:</label>
          <input class="input" id="fix-in" data-fix-in maxlength="80" autocomplete="off" spellcheck="false" value="${U.esc(r.g || '')}" placeholder="например: хотел">
          ${how ? `<div class="tiny muted fix-how">Сейчас: ${U.esc(how)}</div>` : ''}
          <div class="tiny muted">Ваш перевод отмечается ✓ и заменяет машинный везде, где встречается это предложение.</div>`,
        foot: `${r.how === 'user' ? '<button class="btn ghost" data-fix="reset" title="Убрать ваш перевод — снова автоматический">↺ Автоматический</button>' : ''}
          <span class="grow"></span>
          ${r.g && r.how !== 'user' ? '<button class="btn" data-fix="ok" title="Перевод верный — отметить как проверенный">✓ Верно</button>' : ''}
          <button class="btn primary" data-fix="save">Сохранить</button>`,
        beforeClose: UI.guard(() => inp.value.trim() === String(r.g || '').trim() ? null : { title: 'Закрыть без сохранения?', line: 'Ваш перевод слова не сохранён.',
          actions: [{ label: 'Закрыть', value: 'close', cls: 'bad' }] }),
      });
      const inp = m.$('[data-fix-in]');
      const done = g => { this.setUserGloss(s, k, g); m.close(); UI.toast(g ? `✓ «${this.bareLow(w)}» — ${g}` : 'Вернулся автоматический перевод', 'good', 2200); this.afterFix(); if (onDone) onDone(!!g); };
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-fix]'); if (!b) return;
        if (b.dataset.fix === 'reset') done('');
        else if (b.dataset.fix === 'ok') done(r.g);
        else done(inp.value.trim() || (r.how === 'user' ? '' : null) || '');
      });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); done(inp.value.trim()); } });
      setTimeout(() => { try { inp.focus({ preventScroll: true }); inp.select(); } catch (e) { /* ignore */ } }, 60);
      return m;
    },
    /** the window for a sentence translation (Norwegian sentence s) */
    fixSent(s, onDone) {
      s = this.sentKey(s);
      const cur = this.sentTr(s) || '';
      const mine = !!this.userSent(s);
      const m = UI.modal({
        title: '✎ Перевод предложения', cls: 'narrow fix-modal',
        body: `<div class="fix-no" lang="nb">${U.esc(s)}</div>
          <label class="fix-lbl" for="fix-ta">Перевод${mine ? ' (ваш ✓)' : ' — исправьте, если он неверный'}:</label>
          <textarea class="input" id="fix-ta" data-fix-in rows="3" maxlength="2000" spellcheck="true" lang="ru">${U.esc(cur)}</textarea>
          <div class="tiny muted">Ваш перевод отмечается ✓ и заменяет машинный везде, где встречается это предложение; слова в «Слово (перевод)» потом следуют ему.</div>`,
        foot: `${mine ? '<button class="btn ghost" data-fix="reset" title="Убрать ваш перевод — снова машинный">↺ Машинный</button>' : ''}
          <span class="grow"></span>
          ${cur && !mine ? '<button class="btn" data-fix="ok" title="Перевод верный — отметить как проверенный">✓ Верно</button>' : ''}
          <button class="btn primary" data-fix="save">Сохранить</button>`,
        beforeClose: UI.guard(() => ta.value.trim() === cur.trim() ? null : { title: 'Закрыть без сохранения?', line: 'Ваш перевод предложения не сохранён.',
          actions: [{ label: 'Закрыть', value: 'close', cls: 'bad' }] }),
      });
      const ta = m.$('[data-fix-in]');
      const done = t => { this.setUserSent(s, t); m.close(); UI.toast(t ? '✓ Перевод сохранён — он теперь ваш' : 'Вернулся машинный перевод', 'good', 2200); this.afterFix(s); if (onDone) onDone(!!t); };
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-fix]'); if (!b) return;
        if (b.dataset.fix === 'reset') done('');
        else if (b.dataset.fix === 'ok') done(cur);
        else done(ta.value.trim());
      });
      setTimeout(() => { try { ta.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 60);
      return m;
    },
    /** after a correction: everything on screen shows it at once (card back, card viewer; others listen to the event) */
    afterFix(sent) {
      this._glVer = (this._glVer || 0) + 1;
      const cur = S && this.current();
      if (cur) { const card = Store.card(cur.card.id) || cur.card; this.redrawIn(document.querySelector('[data-area]'), card); if (sent && Store.settings.exView === 'word') this.fillExamples(card); }
      document.querySelectorAll('[data-cv][data-cid]').forEach(el => { const c = Store.card(el.dataset.cid); if (c) this.redrawIn(el, c); });
      try { window.dispatchEvent(new CustomEvent('nk-userfix', { detail: { sent: sent || null } })); } catch (e) { /* old browser */ }
    },
    /** Norwegian parts of the description (for translating them in the chosen view) */
    descUnits(card) {
      const lines = String(card.description || '').split('\n');
      if (lines.length > 500) return [];
      return lines.map(l => ({ no: this.sayPart(l), ru: this.ruPart(l) })).filter(u => u.no);
    },
    /** one switch for the whole card back: description + examples */
    viewBarHtml(card) {
      const has = (card.examples || []).length || this.descUnits(card).length || this.mainNo(card);
      if (!has) return '';
      const v = Store.settings.exView || 'asis';
      return `<div class="view-bar"><span class="small muted">Перевод:</span><span class="seg-mini ex-view sm">${this.EXV.map(([id, l, t]) => `<button class="${v === id ? 'active' : ''}" data-act="ex-view" data-v="${id}" title="${t}">${l}</button>`).join('')}</span></div>`;
    },
    /**
     * is the dictionary text on this card a machine translation nobody has checked?
     * card.mtWarn: object = yes; null = checked by AI; false = the user checked it. Older cards: worked out from the history.
     */
    mtWarnOf(card) {
      if (card.mtWarn !== undefined) return card.mtWarn || null;
      if (!/📖 Ordbøkene ·|📗 /u.test(card.description || '')) return null;
      const h = card.history || [];
      const i = h.map(x => x.by).lastIndexOf('tr:ordbok');
      if (i < 0) return null;
      if (h.slice(i).some(x => String(x.by).startsWith('ai:'))) return null;
      const m = String(h[i].n || h[i].note || '').match(/перевод(?:ом)?\s*\(?([^)]*)\)?/);
      const names = m && m[1] && !/без перевода/.test(m[1]) ? m[1] : 'Google';
      const by = Object.entries(Translators.LIST).filter(([, t]) => names.includes(t.name)).map(([id]) => id);
      return { by: by.length ? by : ['google'], t: h[i].t };
    },
    /** collapsed warning (2 lines) — click opens the full explanation and what to do */
    mtNoteHtml(w, act = 'mt-recheck') {
      const names = Translators.provNames(w.by || ['google']);
      return `<div class="mt-note" data-act="mt-toggle" role="button" tabindex="0" title="Нажмите, чтобы прочитать полностью">
        <div class="mt-note-body">⚠️ <b>Перевод сделан машинным переводчиком (${U.esc(names)}) — он может быть неточным.</b>
          Обычные фразы такие переводчики переводят в основном верно, а устойчивые выражения и идиомы — часто дословно и неправильно.
          Перепроверьте перевод: ${AI.available() ? `нейросеть (${U.esc(AI.name())}) проверит каждую строку — кнопка ниже` : 'подключите нейросеть (бесплатно: Gemini или Groq в Настройках) — она проверит каждую строку'},
          или сверьтесь с более точными источниками — DeepL, словари NAOB, LEXIN, Glosbe (значок 📚 справа).</div>
        <div class="mt-note-actions">
          <button class="btn sm ${AI.available() ? 'ai' : ''}" data-act="${act}">${AI.available() ? `${AI.icon(AI.current(), 14)} Перепроверить нейросетью` : act === 'ai-check' ? '🤖 Проверить нейросетью' : '📖 Открыть статью заново'}</button>
          <button class="btn sm" data-act="mt-ok" title="Вы сверили перевод сами — предупреждение исчезнет">✓ Я проверил — скрыть</button>
        </div>
        <span class="mt-more">подробнее ▾</span></div>`;
    },
    /** plain text of the whole card — for copying */
    cardText(card) {
      const out = [card.no, card.ru, this.ukOf(card) ? `🇺🇦 ${this.ukOf(card)}` : ''].filter(Boolean);
      if (card.description) out.push('', card.description);
      if ((card.forms || []).length) out.push('', 'Формы слова:', ...card.forms.map(f => { const tr = this.trLangs().map(l => (l === 'uk' ? this.formMeta(card, f).uk : f.ru)).filter(Boolean).join(' / '); return `${f.label}: ${f.no}${tr ? ` (${tr})` : ''}`; }));
      if ((card.synonyms || []).length) out.push('', 'Синонимы:', ...card.synonyms.map(s => `${s.no}${s.ru ? ` (${s.ru})` : ''}${s.note ? ' — ' + s.note : ''}`));
      if ((card.examples || []).length) out.push('', 'Примеры:', ...card.examples.map(x => `${x.label ? x.label + ': ' : ''}${x.no}${x.ru ? ` (${x.ru})` : ''}`));
      if (card.example) out.push('', card.example + (card.exampleRu ? ` (${card.exampleRu})` : ''));
      return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    },
    async copyText(text, what) {
      try { await navigator.clipboard.writeText(text); }
      catch (e) {
        const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (_) { /* ignore */ } ta.remove();
      }
      UI.toast(`📋 ${what}`, 'good', 1800);
    },
    formsHtml(card) {
      const f = card.forms || [];
      if (!f.length) return '';
      const busy = !!(this._ffBusy && this._ffBusy.has(card.id));
      const html = `<div class="forms-box" data-forms-box data-cid="${U.esc(card.id)}"><div class="fb-title">📚 Формы слова ${this.madeBy(card, 'forms')}</div>
        ${f.map((x, i) => `<div class="fg-row" data-fi="${i}"><span class="fg-label">${window.Gram ? Gram.label(x.label) : U.esc(x.label)}</span><span class="fg-no">${UI.rich(x.no)}</span>${this.formTrCell(card, x, i, busy)}
          <span class="fg-btns"><button class="icon-btn sm" data-act="say" data-say="${U.esc(x.no)}" title="Произнести">🔊</button><button class="icon-btn sm fg-edit" data-ffix="${i}" title="Исправить перевод этой формы" aria-label="Исправить перевод формы ${U.esc(x.no)}">✎</button></span></div>`).join('')}</div>`;
      // translations that are still missing are made once, when the table is really in front of the user
      if (!busy && this.formsNeed(card).length && !(this._ffTried && this._ffTried.has(card.id + '|' + this.trLang()))) this.formsSoon(card.id);
      return html;
    },

    /* ---------- 📚 every form with ITS OWN translation (å komme — приходить · kom — пришёл, приехал (прошедшее)) ----------
     * card.forms[i] = { label, no, ru, uk?, trBy?, trByUk? }  trBy: 'rule' | 'ai:<id>' | 'tr:<id>' | 'user' (none = came with the card).
     * A copy of the extra fields lives in card.formsTr['f:' + no] = { ru, by, uk, byUk } (kept even where the form list
     * is cleaned to label / no / ru). Missing translations are made ONCE, when the table is shown: rules from the card's
     * own translation (nouns, adjectives, the infinitive), else one AI request per card, else a machine translator
     * on short pronoun phrases («jeg kom» → «я пришёл» → «пришёл»). Saved into the card; ✎ / a tap corrects it. */
    trLang() { const v = window.Store && Store.settings && Store.settings.transLang; return v === 'uk' || v === 'both' ? v : 'ru'; },
    trLangs() { const l = this.trLang(); return l === 'both' ? ['ru', 'uk'] : [l]; },
    formMeta(card, f) {
      const all = card && card.formsTr && typeof card.formsTr === 'object' ? card.formsTr : null;
      const raw = all && Object.prototype.hasOwnProperty.call(all, 'f:' + f.no) ? all['f:' + f.no] : null;
      const m = raw && typeof raw === 'object' ? raw : {};
      const s = v => (typeof v === 'string' ? v : '');
      const uk = s(f.uk) || s(m.uk);
      return {
        by: s(f.trBy) || (f.ru && s(m.ru) === f.ru ? s(m.by) : ''), uk, byUk: s(f.trByUk) || (uk && s(m.uk) === uk ? s(m.byUk) : ''),
        // the user emptied it on purpose: not filled again
        clearedRu: !f.ru && m.by === 'user', clearedUk: !uk && m.byUk === 'user',
      };
    },
    autoTitle(by) {
      const who = by === 'rule' ? 'по правилу, из перевода карточки' : /^(ai|tr):/.test(by) ? Prov.name(by) : '';
      return `перевод формы сделан автоматически${who ? ` (${who})` : ''} — проверьте`;
    },
    formTrCell(card, f, i, busy) {
      const langs = this.trLangs(), m = this.formMeta(card, f);
      const parts = langs.map(l => {
        const t = l === 'uk' ? m.uk : f.ru, by = l === 'uk' ? m.byUk : m.by;
        if (!t) return '';
        const auto = by && by !== 'user';
        const tag = auto ? `<span class="fg-auto" title="${U.esc(this.autoTitle(by))}" aria-label="${U.esc(this.autoTitle(by))}">${by.startsWith('ai:') ? '🤖' : '⚙︎'}</span>` : '';
        return `<span class="fg-t" lang="${l}">${langs.length > 1 ? `<small class="fg-lang">${l.toUpperCase()}</small>` : ''}${UI.rich(t)}${tag}</span>`;
      }).filter(Boolean);
      if (parts.length) return `<button type="button" class="fg-ru fg-tr" data-ffix="${i}" title="Нажмите, чтобы исправить перевод">${parts.join('')}</button>`;
      if (busy) return '<span class="fg-ru fg-wait" aria-live="polite"><span class="spinner sm"></span> <small>перевожу…</small></span>';
      return `<span class="fg-ru"><button type="button" class="fg-do" data-fftr="${i}" title="Перевести форму (правило из перевода карточки, нейросеть или переводчик)">перевести</button></span>`;
    },
    /** which form slot this row is: inf / pres / pret / perf / … / ue / be / uf / bf / adjmf / adjn / adjpl / komp / sup … */
    formSlot(f) {
      const t = window.Gram && Gram.term ? Gram.term(f.label) : null;
      const MAP = { infinitiv: 'inf', presens: 'pres', preteritum: 'pret', perfektum: 'perf', perfpart: 'perfpart', prespart: 'prespart', futurum: 'fut', pluskv: 'pluskv', imperativ: 'imp', passiv: 'passiv',
        ue: 'ue', be: 'be', uf: 'uf', bf: 'bf', entall: 'ue', flertall: 'uf', komparativ: 'komp', superlativ: 'sup', adjmf: 'adjmf', adjn: 'adjn', adjpl: 'adjpl', positiv: 'positiv' };
      const l = String(f.label || '').toLowerCase(), no = String(f.no || '').trim().toLowerCase();
      let s = (t && MAP[t.key]) || '';
      if (!s && /опр\.?\s*форма|bestemt form|pos def/.test(l)) s = 'adjdef';
      if (s === 'sup' && /опр|bestemt|def/.test(l)) s = 'supdef';
      if (s === 'perfpart' && /^(jeg\s+)?har\s/.test(no)) s = 'perf';
      if (!s && /^å\s/.test(no)) s = 'inf';
      if (!s && /^(jeg\s+)?har\s/.test(no)) s = 'perf';
      return s;
    },
    formPos(card) {
      const k = window.Gram && Gram.cardPos ? Gram.cardPos(card) : '';
      if (k) return k;
      const slots = (card.forms || []).map(f => this.formSlot(f));
      if (slots.some(s => ['pres', 'pret', 'perf', 'inf', 'imp'].includes(s))) return 'verb';
      if (slots.some(s => ['ue', 'be', 'uf', 'bf'].includes(s))) return 'substantiv';
      if (slots.some(s => ['adjmf', 'adjn', 'adjpl', 'komp', 'sup'].includes(s))) return 'adjektiv';
      return '';
    },
    /** forms that still lack a translation in the language(s) shown: [{ i, f, slot, langs }] */
    formsNeed(card) {
      const langs = this.trLangs();
      return (card.forms || []).map((f, i) => {
        if (!f || !f.no) return null;
        const m = this.formMeta(card, f);
        const need = langs.filter(l => (l === 'uk' ? !m.uk && !m.clearedUk : !f.ru && !m.clearedRu));
        return need.length ? { i, f, slot: this.formSlot(f), langs: need } : null;
      }).filter(Boolean);
    },
    /** the card's own translation, short (first line, without notes in brackets) — or '' when it is not usable */
    formMain(card, lang) {
      let s = String((lang === 'uk' ? card.uk : card.ru) || '').split('\n')[0];
      s = s.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').split(';')[0].replace(/\s+/g, ' ').trim().replace(/[.!…]+$/, '');
      if (!s || s.length > 60 || /[a-zæøå]/i.test(s) || !/\p{L}/u.test(s)) return '';
      return /^\p{Lu}\p{Ll}/u.test(s) && /^\p{Ll}/u.test(String(card.no || '').replace(/^(å|en|ei|et)\s+/i, '')) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
    },
    /** a translation made by rule from the card's own translation: { t, sure } or null */
    ruleFormTr(card, slot, pos, lang) {
      const main = this.formMain(card, lang);
      if (!main) return null;
      const one = main.split(/\s*[,/]\s*/)[0].trim(), single = /^[\p{L}-]+$/u.test(one);
      const ru = lang !== 'uk', low = one.toLowerCase().replace(/ё/g, 'е');
      if (pos === 'verb') {
        return slot === 'inf' && (ru ? /(ть|ться|ти|тись|чь|чься)$/ : /(ти|тися|ть|тись)$/).test(one) ? { t: main, sure: true } : null;
      }
      if (pos === 'substantiv') {
        // Russian / Ukrainian gender by the ending (for «эта / этот / это»); unknown → a neutral note
        const g = /мя$/.test(low) ? 'n' : /[ая]$/.test(low) ? 'f' : /[оеё]$/.test(low) ? 'n' : /[бвгджзклмнпрстфхцчшщй]$/.test(low) ? 'm' : '';
        const DEF = ru ? { f: 'эта, определённая', m: 'этот, определённый', n: 'это, определённое', '': 'определённая форма' } : { f: 'ця, означена', m: 'цей, означений', n: 'це, означене', '': 'означена форма' };
        const DEFPL = ru ? 'эти, определённые' : 'ці, означені';
        if (slot === 'ue') return { t: main, sure: true };
        if (slot === 'be') return { t: `${one} (${DEF[single ? g : '']})`, sure: true };
        if ((slot === 'uf' || slot === 'bf') && ru && single) {
          const pl = this.ruPlural(low), t = pl.t;
          if (!t) return null;
          return { t: slot === 'bf' ? `${t} (${DEFPL})` : t, sure: pl.sure };
        }
        return null;
      }
      if (pos === 'adjektiv' && single) {
        const a = ru ? this.ruAdj(low) : this.ukAdj(low);
        if (!a) return null;
        const t = { adjmf: one, positiv: one, adjn: `${a.n} (${ru ? 'ср. род' : 'сер. рід'})`, adjpl: `${a.pl} (${ru ? 'мн. ч. / опр. форма' : 'мн. / означена форма'})`, adjdef: `${one} (${ru ? 'опр. форма' : 'означена форма'})`,
          komp: a.cmp, sup: a.sup, supdef: `${a.sup} (${ru ? 'опр. форма' : 'означена форма'})` }[slot];
        return t ? { t, sure: true } : null;
      }
      return null;
    },
    /** Russian nominative plural: { t, sure } (sure only for the known irregular words) */
    ruPlural(w) {
      const IRR = { человек: 'люди', ребенок: 'дети', друг: 'друзья', брат: 'братья', стул: 'стулья', дерево: 'деревья', лист: 'листья', сын: 'сыновья', муж: 'мужья', дом: 'дома', город: 'города', глаз: 'глаза', лес: 'леса',
        поезд: 'поезда', учитель: 'учителя', мать: 'матери', дочь: 'дочери', имя: 'имена', время: 'времена', день: 'дни', ухо: 'уши', яблоко: 'яблоки', цвет: 'цвета', номер: 'номера', адрес: 'адреса', вечер: 'вечера',
        берег: 'берега', остров: 'острова', паспорт: 'паспорта', доктор: 'доктора', профессор: 'профессора', директор: 'директора', сосед: 'соседи', цветок: 'цветы', отец: 'отцы', конец: 'концы', котенок: 'котята',
        дно: 'днища', небо: 'небеса', чудо: 'чудеса', колено: 'колени', плечо: 'плечи', курица: 'куры', хозяин: 'хозяева', господин: 'господа', щенок: 'щенки', рынок: 'рынки', подарок: 'подарки', звонок: 'звонки',
        кусок: 'куски', потолок: 'потолки', кошелек: 'кошельки', платок: 'платки', замок: 'замки', ветер: 'ветры', огонь: 'огни', угол: 'углы', рот: 'рты', сон: 'сны', лев: 'львы', церковь: 'церкви', любовь: 'любви' };
      if (IRR[w]) return { t: IRR[w], sure: true };
      const soft = /[гкхжшчщ]$/;
      let t = '';
      if (/ия$/.test(w)) t = w.slice(0, -1) + 'и';
      else if (/ие$/.test(w)) t = w.slice(0, -1) + 'я';
      else if (/а$/.test(w)) t = w.slice(0, -1) + (soft.test(w.slice(0, -1)) ? 'и' : 'ы');
      else if (/[яйь]$/.test(w)) t = w.slice(0, -1) + 'и';
      else if (/о$/.test(w)) t = w.slice(0, -1) + (/к$/.test(w.slice(0, -1)) ? 'и' : 'а');
      else if (/е$/.test(w)) t = w.slice(0, -1) + 'я';
      else if (/[бвгджзклмнпрстфхцчшщ]$/.test(w)) t = w + (soft.test(w) ? 'и' : 'ы');
      return { t, sure: false };
    },
    /** Russian adjective (-ый / -ий / -ой): neuter, plural, comparative, superlative — or null */
    ruAdj(w) {
      const m = w.match(/^(.+?)(ый|ий|ой)$/);
      if (!m) return null;
      const [, st, e] = m, hard = /[гкх]$/.test(st), hush = /[жшчщ]$/.test(st);
      const n = st + (e === 'ий' && !hard ? 'ее' : 'ое'); // новое · синее, хорошее · маленькое · большое
      const pl = st + (e === 'ый' ? 'ые' : e === 'ий' ? 'ие' : hard || hush ? 'ие' : 'ые');
      const CMP = { хороший: 'лучше', плохой: 'хуже', большой: 'больше', маленький: 'меньше', высокий: 'выше', низкий: 'ниже', дорогой: 'дороже', дешевый: 'дешевле', молодой: 'моложе', старый: 'старше',
        далекий: 'дальше', близкий: 'ближе', короткий: 'короче', длинный: 'длиннее', легкий: 'легче', тяжелый: 'тяжелее', широкий: 'шире', узкий: 'уже', громкий: 'громче', тихий: 'тише', богатый: 'богаче',
        простой: 'проще', частый: 'чаще', ранний: 'раньше', поздний: 'позже', сладкий: 'слаще', крепкий: 'крепче', жаркий: 'жарче', яркий: 'ярче', мягкий: 'мягче', твердый: 'твёрже', глубокий: 'глубже',
        толстый: 'толще', чистый: 'чище', крутой: 'круче', быстрый: 'быстрее', новый: 'новее', теплый: 'теплее', холодный: 'холоднее', сильный: 'сильнее', умный: 'умнее', интересный: 'интереснее',
        красивый: 'красивее', важный: 'важнее', трудный: 'труднее', сложный: 'сложнее', светлый: 'светлее', темный: 'темнее', бедный: 'беднее', слабый: 'слабее', веселый: 'веселее', грустный: 'грустнее' };
      const SUP = { хороший: 'самый лучший', плохой: 'самый плохой (худший)' };
      return { n, pl, cmp: CMP[w] || `более ${w}`, sup: SUP[w] || `самый ${w}` };
    },
    /** Ukrainian adjective (-ий / -ій) — or null */
    ukAdj(w) {
      const m = w.match(/^(.+?)(ий|ій)$/);
      if (!m) return null;
      const [, st, e] = m;
      const CMP = { великий: 'більший', малий: 'менший', маленький: 'менший', добрий: 'кращий', гарний: 'кращий', поганий: 'гірший', високий: 'вищий', низький: 'нижчий', дорогий: 'дорожчий', дешевий: 'дешевший', молодий: 'молодший', старий: 'старший', довгий: 'довший', короткий: 'коротший', широкий: 'ширший', вузький: 'вужчий' };
      const c = CMP[w];
      return { n: st + (e === 'ій' ? 'є' : 'е'), pl: st + 'і', cmp: c || `більш ${w}`, sup: c ? 'най' + c : `найбільш ${w}` };
    },
    /** what a machine translator gets: a verb form with a pronoun (kom → «jeg kom» → «я пришёл»), others as they are */
    formQuery(f, slot, pos) {
      const no = String(f.no || '').split(/\s+\/\s+/)[0].trim();
      if (pos !== 'verb' && !['pres', 'pret', 'perf', 'perfpart', 'pluskv', 'fut', 'imp'].includes(slot)) return no;
      const pron = /^(jeg|du|han|hun|vi|dere|de|man)\s/i.test(no);
      if (slot === 'inf') return /^å\s/i.test(no) ? no : 'å ' + no;
      if (slot === 'imp') return /!$/.test(no) ? no : no + '!';
      if (pron) return no;
      if (slot === 'perf' || slot === 'perfpart') return /^har\s/i.test(no) ? 'jeg ' + no : 'jeg har ' + no;
      if (slot === 'pluskv') return /^hadde\s/i.test(no) ? 'jeg ' + no : 'jeg hadde ' + no;
      if (['pres', 'pret', 'fut'].includes(slot)) return 'jeg ' + no;
      return no;
    },
    FORM_HINT: {
      ru: { pres: 'настоящее', pret: 'прошедшее', perf: 'перфект: результат важен сейчас', perfpart: 'перфект: результат важен сейчас', pluskv: 'предпрошедшее', fut: 'будущее', imp: 'повелительное' },
      uk: { pres: 'теперішній час', pret: 'минулий час', perf: 'перфект: результат важливий зараз', perfpart: 'перфект: результат важливий зараз', pluskv: 'давноминулий', fut: 'майбутній час', imp: 'наказовий спосіб' },
    },
    /** a translation of a pronoun phrase → the form alone, lower-case, with the tense hint */
    tidyFormTr(t, q, slot, lang) {
      let s = String(t || '').replace(/\s+/g, ' ').trim();
      if (/^(jeg|å)\s/i.test(q)) s = s.replace(/^я\s+/i, '');
      if (slot !== 'imp') s = s.replace(/[.!]+$/, '');
      if (/^\p{Lu}\p{Ll}/u.test(s)) s = s.charAt(0).toLowerCase() + s.slice(1);
      const h = (this.FORM_HINT[lang] || {})[slot];
      return s && h && !s.includes('(') ? `${s} (${h})` : s;
    },
    clean: (t, max = 160) => String(t == null ? '' : t).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max),
    /** make the missing translations: [{ i, no, lang, t, by }] (never throws) */
    async makeFormTr(card, need) {
      const out = new Map(), pos = this.formPos(card), key = (i, l) => i + '|' + l;
      const put = (n, l, t, by) => { t = this.clean(t); if (t && U.norm(t) !== U.norm(n.f.no) && !out.has(key(n.i, l))) out.set(key(n.i, l), { i: n.i, no: n.f.no, lang: l, t, by }); };
      const left = () => need.flatMap(n => n.langs.filter(l => !out.has(key(n.i, l))).map(l => ({ n, l })));
      // 1) rules that are safe (from the card's own translation)
      need.forEach(n => n.langs.forEach(l => { const r = this.ruleFormTr(card, n.slot, pos, l); if (r && r.sure) put(n, l, r.t, 'rule'); }));
      // 2) one AI request for the whole card
      if (left().length && window.AI && AI.available()) {
        const ask = [...new Set(left().map(x => x.n))];
        const user = `Norwegian Bokmål word «${String(card.no).split('\n')[0].slice(0, 120)}»${pos ? ` (${pos})` : ''}; Russian meaning: «${String(card.ru || '').split('\n')[0].slice(0, 120)}»${card.uk ? `; Ukrainian: «${String(card.uk).split('\n')[0].slice(0, 120)}»` : ''}.
Translate EACH grammatical form below into Russian ("ru") and Ukrainian ("uk"): short and natural, the way a learner's dictionary shows it, keeping person, tense, number and definiteness of THAT form, in the meaning of the card.
Verbs: add a very short tense hint in brackets, e.g. kommer → "прихожу / приходит (настоящее)", kom → "пришёл, приехал (прошедшее)", har kommet → "пришёл, приехал (перфект: результат важен сейчас)".
Nouns: bil → "машина", bilen → "машина (эта, определённая)", biler → "машины", bilene → "машины (эти, определённые)". Adjectives: stort → "большое (ср. род)", større → "больше", størst → "самый большой".
Return ONLY JSON: {"forms":[{"no":"...","ru":"...","uk":"..."}]} — the same forms, the same order.
Forms: ${JSON.stringify(ask.map(n => ({ label: (window.Gram && Gram.labelText ? Gram.labelText(n.f.label) : n.f.label) || '', no: n.f.no })))}`;
        try {
          const r = AI.parseJSON(await AI.call({ system: 'You are an expert Norwegian–Russian–Ukrainian lexicographer. Answer with JSON only.', user, maxTokens: 200 + ask.length * 90, temperature: 0.1, quiet: true }));
          const arr = Array.isArray(r && r.forms) ? r.forms : Array.isArray(r) ? r : [];
          const by = 'ai:' + (AI.lastProvider || AI.current());
          ask.forEach((n, k) => {
            const hit = arr.find(x => x && U.norm(x.no || '') === U.norm(n.f.no)) || (arr[k] && (!arr[k].no || arr.length === ask.length) ? arr[k] : null);
            if (!hit) return;
            n.langs.forEach(l => put(n, l, hit[l], by));
            // the other language comes free with the same answer (kept for when the setting asks for it)
            ['ru', 'uk'].filter(l => !n.langs.includes(l) && (l === 'ru' ? !n.f.ru : !this.formMeta(card, n.f).uk)).forEach(l => put(n, l, hit[l], by));
          });
        } catch (e) { console.warn('forms: AI', e && e.message); }
      }
      // 3) rules that may be wrong (Russian plural of an unknown noun) — marked ⚙︎ like every automatic one
      left().forEach(({ n, l }) => { const r = this.ruleFormTr(card, n.slot, pos, l); if (r && r.t) put(n, l, r.t, 'rule'); });
      // 4) machine translator, per language, on short phrases
      for (const l of ['ru', 'uk']) {
        const items = left().filter(x => x.l === l);
        if (!items.length || !window.Translators || !Translators.translateMany) continue;
        const qs = items.map(x => this.formQuery(x.n.f, x.n.slot, pos));
        try {
          const res = await Translators.translateMany(qs, 'no', l, { quiet: true, noAI: true });
          const by = 'tr:' + ((res && res.by && res.by[0]) || 'google');
          items.forEach((x, k) => { const t = res && res.out && res.out[k]; if (t) put(x.n, l, this.tidyFormTr(t, qs[k], x.n.slot, l), by); });
        } catch (e) { console.warn('forms: translator', e && e.message); }
      }
      return [...out.values()];
    },
    /** write made translations into the card (only where still empty) */
    saveFormTr(cardId, res) {
      const c = Store.card(cardId);
      if (!c || !res.length) return false;
      const forms = (c.forms || []).map(f => Object.assign({}, f));
      const mirror = Object.assign({}, c.formsTr && typeof c.formsTr === 'object' ? c.formsTr : {});
      const bys = new Set();
      let n = 0;
      res.forEach(r => {
        const f = forms[r.i];
        if (!f || f.no !== r.no) return; // the forms changed meanwhile
        const m = Object.assign({}, mirror['f:' + f.no]);
        if (r.lang === 'uk') { if (this.formMeta(c, f).uk) return; f.uk = r.t; f.trByUk = r.by; m.uk = r.t; m.byUk = r.by; }
        else { if (f.ru) return; f.ru = r.t; f.trBy = r.by; m.ru = r.t; m.by = r.by; }
        mirror['f:' + f.no] = m; n++;
        if (r.by !== 'rule') bys.add(r.by);
      });
      if (!n) return false;
      const patch = { forms, formsTr: mirror };
      if (bys.size) patch.history = Prov.add(c, ...[...bys].map(by => Prov.entry(by, 'translate', null, 'перевод форм слова (автоматически)')));
      Store.updateCard(cardId, patch);
      return true;
    },
    formsSoon(cardId) {
      this._ffTimers = this._ffTimers || {};
      clearTimeout(this._ffTimers[cardId]);
      this._ffTimers[cardId] = setTimeout(() => {
        delete this._ffTimers[cardId];
        const boxes = [...document.querySelectorAll('[data-forms-box]')].filter(b => b.dataset.cid === cardId);
        // the back of a study card is not turned yet: flip() starts it
        if (!boxes.length || boxes.every(b => { const fc = b.closest('[data-card]'); return fc && !fc.classList.contains('flipped'); })) return;
        this.fillForms(cardId);
      }, 80);
    },
    async fillForms(cardId, force) {
      this._ffBusy = this._ffBusy || new Set(); this._ffTried = this._ffTried || new Set();
      const tk = cardId + '|' + this.trLang();
      if (this._ffBusy.has(cardId) || (!force && this._ffTried.has(tk))) return;
      const card = Store.card(cardId);
      const need = card ? this.formsNeed(card) : [];
      if (!need.length) return;
      this._ffBusy.add(cardId); this._ffTried.add(tk);
      this.redrawForms(cardId);
      let ok = false;
      try { ok = this.saveFormTr(cardId, await this.makeFormTr(card, need)); }
      catch (e) { console.warn('forms', e && e.message); }
      finally { this._ffBusy.delete(cardId); this.redrawForms(cardId); }
      if (force && !ok) UI.toast('Не удалось перевести форму — попробуйте позже или впишите перевод сами (✎)', '', 4000);
    },
    redrawForms(cardId) {
      const card = Store.card(cardId); if (!card) return;
      document.querySelectorAll('[data-forms-box]').forEach(b => { if (b.dataset.cid === cardId && !b.querySelector('.fg-editing')) b.outerHTML = this.formsHtml(card); });
    },
    /** ✎ inline editor of one form's translation (RU / UK by the setting) */
    editFormTr(btn) {
      const box = btn.closest('[data-forms-box]'), row = btn.closest('[data-fi]');
      const card = box && Store.card(box.dataset.cid), i = row ? +row.dataset.fi : -1, f = card && (card.forms || [])[i];
      if (!f) return;
      const open = box.querySelector('.fg-editing');
      if (open) { // one editor at a time: close the other one, then open this one in the redrawn table
        open.classList.remove('fg-editing'); this.redrawForms(card.id);
        const nb = [...document.querySelectorAll('[data-forms-box]')].find(b => b.dataset.cid === card.id);
        const again = nb && nb.querySelector(`[data-fi="${i}"] [data-ffix]`);
        if (again) this.editFormTr(again);
        return;
      }
      const cell = row.querySelector('.fg-ru'); if (!cell) return;
      const m = this.formMeta(card, f), langs = this.trLangs();
      const autos = langs.map(l => (l === 'uk' ? m.byUk : m.by)).filter(by => by && by !== 'user');
      const ed = document.createElement('span');
      ed.className = 'fg-ru fg-editing';
      ed.innerHTML = `${autos.length ? `<small class="fg-note">${autos[0].startsWith('ai:') ? '🤖' : '⚙︎'} ${U.esc(this.autoTitle(autos[0]))}</small>` : ''}
        ${langs.map(l => `<input class="input fg-in" data-l="${l}" lang="${l}" value="${U.esc(l === 'uk' ? m.uk : f.ru || '')}" placeholder="${l === 'uk' ? 'переклад українською' : 'перевод на русский'}" aria-label="Перевод формы ${U.esc(f.no)} (${l.toUpperCase()})" autocomplete="off">`).join('')}
        <span class="fg-ed-act"><button type="button" class="btn sm primary" data-ffsave>✓ Сохранить</button><button type="button" class="btn sm" data-ffcancel>Отмена</button></span>`;
      cell.replaceWith(ed);
      const cancel = () => { ed.classList.remove('fg-editing'); this.redrawForms(card.id); };
      ed.querySelectorAll('input').forEach(inp => inp.addEventListener('keydown', e => {
        e.stopPropagation(); // Enter / Space / Esc must not flip the card or close the session
        if (e.key === 'Enter') { e.preventDefault(); this.saveFormEdit(ed, card.id, i); } // Esc: the window listener below
      }));
      ed.querySelector('[data-ffsave]').addEventListener('click', e => { e.stopPropagation(); this.saveFormEdit(ed, card.id, i); });
      ed.querySelector('[data-ffcancel]').addEventListener('click', e => { e.stopPropagation(); cancel(); });
      const first = ed.querySelector('input');
      setTimeout(() => { try { first.focus({ preventScroll: true }); first.select(); } catch (e) { /* ignore */ } }, 30);
    },
    saveFormEdit(ed, cardId, i) {
      const c = Store.card(cardId), f0 = c && (c.forms || [])[i];
      if (!f0) return;
      const forms = (c.forms || []).map(f => Object.assign({}, f)), f = forms[i];
      const mirror = Object.assign({}, c.formsTr && typeof c.formsTr === 'object' ? c.formsTr : {});
      const m = Object.assign({}, mirror['f:' + f.no]);
      const before = Prov.listText(c.forms);
      ed.querySelectorAll('input[data-l]').forEach(inp => {
        const v = this.clean(inp.value, 200);
        if (inp.dataset.l === 'uk') { f.uk = v; f.trByUk = 'user'; m.uk = v; m.byUk = 'user'; }
        else { f.ru = v; f.trBy = 'user'; m.ru = v; m.by = 'user'; }
      });
      mirror['f:' + f.no] = m;
      ed.classList.remove('fg-editing');
      Store.updateCard(cardId, { forms, formsTr: mirror, history: Prov.add(c, Prov.entry('manual', 'edit', { forms: { old: before, new: Prov.listText(forms) } }, 'перевод формы исправлен')) });
      this.redrawForms(cardId);
      UI.toast('Перевод формы сохранён ✓', 'good', 1600);
    },
    synonymsHtml(card) {
      const s = card.synonyms || [];
      if (!s.length) return '';
      return `<div class="forms-box syn-box"><div class="fb-title">🔁 Синонимы ${this.madeBy(card, 'synonyms')}</div>
        <div class="syn-list">${s.map(x => `<div class="syn-item">
          <div class="syn-head"><span class="syn-no">${UI.rich(x.no)}</span>${x.ru ? `<span class="syn-ru">${UI.rich('(' + x.ru + ')')}</span>` : ''}
            <button class="icon-btn sm" data-act="say" data-say="${U.esc(x.no)}" title="Произнести">🔊</button></div>
          ${x.note ? `<div class="ex-note">💡 ${UI.rich(x.note)}</div>` : ''}</div>`).join('')}</div></div>`;
    },
    /* ---------- 💬 examples: as is / sentence + (translation) / word (translation) ---------- */
    EXV: [['asis', 'Как есть', 'Норвежский текст, под ним — русский'], ['sent', 'По предложениям', 'Предложение по-норвежски, сразу за ним (перевод) синим'], ['word', 'Слово (перевод)', 'Перевод в скобках после каждого слова']],
    /** split into sentences (keeps quotes / dashes with their sentence) */
    splitSent(s) {
      return String(s || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?…])["»”]?\s+(?=[«"„“(—–-]?\s*[A-ZÆØÅÄÖÜÉА-ЯЁ0-9])/u).map(x => x.trim()).filter(Boolean);
    },
    /** translations made for this view (sentences / single words) — kept on the device, reused everywhere */
    exCache() {
      if (!this._exc) {
        try { this._exc = JSON.parse(localStorage.getItem('nk-extr') || '{}'); } catch (e) { this._exc = {}; }
        Object.keys(this._exc).forEach(k => { if (k.startsWith('w:')) delete this._exc[k]; }); // old single-word garbage
        // failed translations used to be saved as empty for good — they are tried again
        if (!localStorage.getItem('nk-extr-v2')) { Object.keys(this._exc).forEach(k => { if (this._exc[k] === '') delete this._exc[k]; }); try { localStorage.setItem('nk-extr-v2', '1'); } catch (e) { /* full */ } }
      }
      return this._exc;
    },
    exSave() {
      const c = this.exCache(), k = Object.keys(c);
      // sentences and AI glosses make the cache big: the oldest of them go first; single words (w2: / a: / r2:) are
      // small and stay (asking for them again would only mean more requests to Google)
      const big = k.filter(x => x.startsWith('s:') || x.startsWith('g:'));
      if (big.length > 4000) big.slice(0, big.length - 3000).forEach(x => delete c[x]);
      const small = k.filter(x => !x.startsWith('s:') && !x.startsWith('g:'));
      if (small.length > 30000) small.slice(0, small.length - 25000).forEach(x => delete c[x]);
      try { localStorage.setItem('nk-extr', JSON.stringify(c)); } catch (e) {
        big.slice(0, Math.ceil(big.length / 2)).forEach(x => delete c[x]); // full: half of the old sentences out, once more
        try { localStorage.setItem('nk-extr', JSON.stringify(c)); } catch (e2) { /* still full */ }
      }
      this._glVer = (this._glVer || 0) + 1;
    },
    // 'w2:' — the old 'w:' cache held word-by-word Google results with garbage (Хан, Var, &apos;…), it is not used any more
    wordKey: w => 'w2:' + String(w).toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''),
    bareLow: w => String(w).toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''),
    /** word tokens of one sentence (what gets a gloss) */
    glossToks(s) { return String(s).split(/\s+/).filter(w => /\p{L}/u.test(w)); },
    /** a capitalised word in the middle of a sentence = a name (Gwo, Impa, Ganon) — not translated */
    isName(w, k) { const b = String(w).replace(/^[^\p{L}]+/u, ''); return k > 0 && /^\p{Lu}/u.test(b) && !NoGloss.has(b) && !/^\p{Lu}[\p{Lu}\d]*-\p{Ll}/u.test(b); }, // «FM-båndet», «DAB-radio» are words

    /* ---------- ✓ your own corrections: they win over every machine / AI translation, everywhere ----------
     * Store.state.userTr = { s: { 'Norwegian sentence': 'your translation' }, g: { 'Norwegian sentence': { k: 'gloss' } } }
     * (part of the saved state and of backups; text only — sanitized when read, escaped when shown) */
    userTr() {
      const st = Store.state;
      if (!st) return { s: {}, g: {} };
      if (!st.userTr || typeof st.userTr !== 'object') st.userTr = { s: {}, g: {} };
      const u = st.userTr;
      if (this._utrOk !== u) { // once per state object (a restored backup brings its own): only short plain text stays
        const S = Store.Safe;
        const s = {}, g = {};
        Object.entries(u.s && typeof u.s === 'object' ? u.s : {}).slice(-5000).forEach(([k, v]) => { const t = S.text(v, 2000).trim(); if (t && typeof k === 'string') s[S.text(k, 2000)] = t; });
        Object.entries(u.g && typeof u.g === 'object' ? u.g : {}).slice(-5000).forEach(([k, m]) => {
          if (!m || typeof m !== 'object') return;
          const o = {}; Object.entries(m).forEach(([i, v]) => { if (/^\d{1,3}$/.test(i)) { const t = S.text(v, 80).trim(); if (t) o[i] = t; } });
          if (Object.keys(o).length) g[S.text(k, 2000)] = o;
        });
        u.s = s; u.g = g; this._utrOk = u;
      }
      return u;
    },
    sentKey: s => String(s || '').replace(/\s+/g, ' ').trim(),
    /** your translation of this Norwegian sentence (✓), or undefined */
    userSent(s) { const v = this.userTr().s[this.sentKey(s)]; return typeof v === 'string' && v ? v : undefined; },
    /** your gloss of word k of this sentence (✓), or undefined */
    userGloss(s, k) { const m = this.userTr().g[this.sentKey(s)]; const v = m && m[k]; return typeof v === 'string' && v ? v : undefined; },
    setUserSent(s, ru) {
      const u = this.userTr(), key = this.sentKey(s);
      ru = Store.Safe.text(String(ru || ''), 2000).replace(/\s+/g, ' ').trim();
      if (ru) u.s[key] = ru; else delete u.s[key];
      Store.save(); this._glVer = (this._glVer || 0) + 1;
    },
    setUserGloss(s, k, g) {
      const u = this.userTr(), key = this.sentKey(s);
      g = Store.Safe.text(String(g || ''), 80).replace(/\s+/g, ' ').trim();
      const m = u.g[key] || (u.g[key] = {});
      if (g) m[k] = g; else delete m[k];
      if (!Object.keys(m).length) delete u.g[key];
      Store.save(); this._glVer = (this._glVer || 0) + 1;
    },

    /** translation of a sentence: yours ✓ > saved > just arrived from the translation that is still running */
    sentTr(s) { const u = this.userSent(s); if (u) return u; const v = this.exCache()['s:' + s]; return v !== undefined ? v : Translators.cached(s); },
    /** a short fingerprint of a sentence translation: AI glosses made for another translation are not used */
    ruHash(ru) { let h = 5381; const t = String(ru || '').replace(/\s+/g, ' ').trim(); for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return h.toString(36) + t.length.toString(36); },
    /** machine output for a single word: drop garbage (latin only, HTML entities, «& …», very long) */
    cleanGloss(src, out) {
      let t = String(out || '').replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/^[&%#\s\d]+/, '').trim();
      if (!/[а-яё]/i.test(t) || t.length > String(src).length * 3 + 16) return '';
      if (/^\p{Ll}/u.test(src)) t = t.charAt(0).toLowerCase() + t.slice(1);
      return t;
    },
    /** dictionary forms of a word (Norsk ordbank, when it is loaded): «ønska» → ['ønske'] */
    lemmasOf(w) {
      const p = window.Lexicon && Lexicon.peek(w);
      return p ? [...new Set(p.slice(0, 2).map(x => String(x.lemma).toLowerCase()))] : [];
    },
    /** your own one-word cards: «hus» → ['дом'] — the first place to look for a word's meaning */
    cardDict() {
      const cards = (Store.state && Store.state.cards) || [];
      const sig = cards.length + ':' + (Store.state && Store.state.savedAt || 0);
      if (this._cdSig === sig && this._cd) return this._cd;
      if (this._cd && Date.now() - (this._cdT || 0) < 20000 && this._cdSig && this._cdSig.split(':')[0] === String(cards.length)) return this._cd;
      const m = new Map();
      cards.forEach(c => {
        const no = String(c.no || '').split('\n')[0].trim().toLowerCase().replace(/^(en|ei|et|å)\s+/, '');
        if (!no || /\s/.test(no) || !c.ru) return;
        const ru = Align.split(String(c.ru).split('\n')[0]).slice(0, 4);
        if (ru.length) m.set(no, [...(m.get(no) || []), ...ru].slice(0, 6));
      });
      this._cd = m; this._cdSig = sig; this._cdT = Date.now(); this._glVer = (this._glVer || 0) + 1;
      return m;
    },
    /** lookups for the meaning-first alignment — all synchronous, from what is already saved */
    glLook() {
      const c = this.exCache(), cd = this.cardDict();
      return {
        cards: w => cd.get(w) || [],
        dict: w => NoGloss.get(w),
        mt: w => { const v = c['w2:' + w]; if (v !== undefined) return v; const t = Translators.cached(w); return t !== undefined ? this.cleanGloss(w, t) : undefined; },
        alts: w => c['a:' + w],
        lemmas: w => this.lemmasOf(w),
      };
    },
    /** every word of the sentence matched against its translation (Align, no network) — remembered until something changes */
    alignOf(sent, ru) {
      const L = this.glLook(); // (may bump the version when your cards changed)
      const ver = this._glVer || 0;
      if (!this._alm || this._almVer !== ver) { this._alm = new Map(); this._almVer = ver; }
      const key = sent + '\u0001' + (ru || '');
      let r = this._alm.get(key);
      if (r) return r;
      const toks = this.glossToks(sent), c = this.exCache();
      r = Align.align(toks, ru || '', k => Align.candidates(toks[k], L), {
        skip: k => this.isName(toks[k], k) || !/\p{L}/u.test(toks[k]) || /^\P{L}*\d[\d\P{L}]*$/u.test(toks[k]),
        rev: w => c['r2:' + w],
        same: (no, k) => Align.sameNo(no, toks[k], w => this.lemmasOf(w)),
        isFunc: w => NoGloss.has(w),
        wait: k => { const f = this.bareLow(toks[k]); return !NoGloss.has(f) && L.mt(f) === undefined; },
      });
      if (this._alm.size > 4000) this._alm.clear();
      this._alm.set(key, r);
      return r;
    },
    /**
     * gloss of word k of a sentence and where it comes from (how):
     *   user  — yours ✓ (wins over everything)
     *   ai    — the neural network, made from THIS sentence translation (a changed translation = not used any more)
     *   align — the meaning found in the sentence translation, in the form the translation uses
     *   dict  — the hand-made list (one meaning)
     *   guess — a single-word translation not found in the sentence translation: shown as uncertain «?»
     *   skip / none / wait — a name or number / nothing / still coming
     * ru: the sentence translation the reader sees (default: yours ✓ or the saved one)
     */
    glossInfo(sent, k, ru) {
      if (ru === undefined) ru = this.sentTr(sent);
      const u = this.userGloss(sent, k); if (u !== undefined) return { g: u, how: 'user' };
      const toks = this.glossToks(sent), w = toks[k];
      if (w === undefined) return { g: undefined, how: 'wait' };
      if (this.isName(w, k) || !/\p{L}/u.test(w)) return { g: '', how: 'skip' };
      const ai = this.exCache()['g:' + sent];
      if (ai && !Array.isArray(ai) && ru && ai.h === this.ruHash(ru) && Array.isArray(ai.g) && ai.g[k]) return { g: ai.g[k], how: 'ai' };
      const r = this.alignOf(sent, ru)[k] || { g: undefined, how: 'wait' };
      // glosses an older version made with AI (without the translation): better than a bare guess
      if (r.how !== 'align' && r.how !== 'dict' && Array.isArray(ai) && ai[k] && !Align.echoes(w, ai[k])) return { g: ai[k], how: 'ai' };
      return r;
    },
    /** gloss text only (older callers): '' = name / nothing, undefined = still coming */
    glossOf(sent, w, k, ru) { return this.glossInfo(sent, k, ru).g; },
    /** sentence pairs: the human translation when the sentences match one to one, otherwise each sentence translated;
     *  your own ✓ translation of a sentence wins */
    exPairs(x) {
      const ns = this.splitSent(x.no), rs = this.splitSent(x.ru);
      const mine = this.userSent(x.no);
      let out;
      if (mine && ns.length === 1) out = [{ no: ns[0], ru: mine }];
      else if (x.ru && ns.length === rs.length) out = ns.map((no, i) => ({ no, ru: rs[i] }));
      else if (x.ru && ns.length === 1) out = [{ no: ns[0], ru: x.ru }];
      else out = ns.map(no => ({ no, ru: this.sentTr(no), mt: true }));
      return out.map(p => { const u = this.userSent(p.no); return u ? { no: p.no, ru: u, mine: true } : p; });
    },
    /** the translation a sentence of an example is glossed against (the same one the reader sees under it) */
    exWordRu(x, p) { return p.ru || this.userSent(x.no) || x.ru || undefined; },
    examplesHtml(card) {
      const e = card.examples || [];
      if (!e.length) return '';
      const v = Store.settings.exView || 'asis';
      const say = (t, lang) => t ? `<button class="icon-btn sm ex-say" data-act="say" data-say="${U.esc(t)}" data-lang="${lang}" title="${lang === 'ru' ? 'Произнести только русский' : 'Произнести по-норвежски'}">🔊${lang === 'ru' ? '<small>RU</small>' : ''}</button>` : '';
      const c = this.exCache();
      let mt = false;
      const body = x => {
        if (v === 'sent') {
          const pairs = this.exPairs(x);
          if (pairs.some(p => p.mt)) mt = true;
          return pairs.map(p => `<div class="ex-sent"><span class="ex-no">${UI.rich(p.no)}</span> <span class="ex-ru-in">(${p.ru ? UI.rich(p.ru) : p.ru === '' ? '—' : '…'})</span> ${say(p.no, 'no')}${say(p.ru, 'ru')}${p.ru ? this.trFixHtml(p.no) : ''}</div>`).join('');
        }
        if (v === 'word') {
          mt = true;
          const pairs = this.exPairs(x);
          const words = pairs.map(p => this.glossHtml(p.no, this.exWordRu(x, p))).join(' ');
          const xr = this.userSent(x.no) || x.ru;
          // no translation of its own: the sentence translation(s) the words follow are shown under them (with ✎)
          const mtRu = !xr ? pairs.filter(p => p.ru).map(p => `${U.esc(p.ru)}${this.trFixHtml(p.no)}`).join(' ') : '';
          return `<div class="ex-no wbw-line">${words} ${say(x.no, 'no')}</div>${xr ? `<div class="ex-ru">${UI.rich(xr)} ${say(xr, 'ru')}${this.trFixHtml(x.no)}</div>` : mtRu ? `<div class="ex-ru">${mtRu}</div>` : ''}`;
        }
        const xr = this.userSent(x.no) || x.ru;
        return `<div class="ex-no">${UI.rich(x.no)} ${say(x.no, 'no')}</div>${xr ? `<div class="ex-ru">${UI.rich(xr)} ${say(xr, 'ru')}${this.trFixHtml(x.no)}</div>` : ''}`;
      };
      const rows = e.map((x, i) => `<div class="ex-row"><span class="fg-label">${window.Gram ? Gram.label(x.label) : U.esc(x.label)}</span><div class="ex-body">${body(x)}
          <div class="ex-tools"><span class="seg-mini ex-view sm" title="Как показывать перевод (для всех примеров)">${this.EXV.map(([id, l, t]) => `<button class="${v === id ? 'active' : ''}" data-act="ex-view" data-v="${id}" title="${t}">${l}</button>`).join('')}</span>
            <button class="btn sm ghost" data-act="ex-read" data-i="${i}" title="Читать вслух: предложение по-норвежски → его перевод, и так до конца">🔁 Слушать: норвежский → русский</button></div>
          ${x.note ? `<div class="ex-note">💡 ${U.esc(x.note)}</div>` : ''}</div></div>`).join('');
      const by = this._exBy && this._exBy.length ? this._exBy.map(id => id === 'ai' ? AI.name(Translators.lastAI) : (Translators.LIST[id] || {}).name || id).join(' + ') : '';
      return `<div class="forms-box ex-box"><div class="fb-title">💬 Примеры по формам ${this.madeBy(card, 'examples')}</div>
        ${rows}
        ${mt ? `<div class="tiny muted ex-mt">⚠️ ${v === 'word'
          ? `Перевод слов — по смыслу: ${(this._exBy || []).includes('ai') ? `${U.esc(AI.name(Translators.lastAI))} разложил перевод предложения по словам` : `слово берётся из перевода всего предложения${by ? ' (' + U.esc(by) + ')' : ''}; слово с «?» в переводе не нашлось — это перевод без контекста, он может не совпадать по смыслу. Подключите нейросеть — она разложит смысл предложения по каждому слову`}. Нажмите на перевод слова, чтобы исправить его.`
          : `Перевод предложений — машинный${by ? ' (' + U.esc(by) + ')' : ''}, перепроверяйте.`}</div>` : ''}</div>`;
    },
    /** 🔁 read one example aloud: Norwegian sentence → its translation → next (sentences translated first if needed) */
    async exRead(card, i, a) {
      const x = (card.examples || [])[i]; if (!x) return;
      let pairs = this.exPairs(x);
      const miss = pairs.filter(p => !p.ru).map(p => p.no);
      if (miss.length) {
        // sentences of the human translation don't match one to one — translate each Norwegian sentence first
        const label = a && a.innerHTML;
        if (a) { a.disabled = true; a.innerHTML = '<span class="spinner sm"></span> перевожу по предложениям…'; }
        try {
          const res = await Translators.translateMany(miss, 'no', 'ru');
          const c = this.exCache();
          miss.forEach((s, k) => { c['s:' + s] = res.out[k] ? String(res.out[k]).trim() : ''; });
          this._exBy = [...new Set([...(this._exBy || []), ...res.by])];
          this.exSave();
        } catch (err) { UI.toast('Перевод: ' + err.message, 'warn'); }
        if (a && a.isConnected) { a.disabled = false; a.innerHTML = label; }
        pairs = this.exPairs(x);
      }
      // the reader picks the voice by the alphabet: Norwegian / Russian
      TTS.speakText(pairs.map(p => p.ru ? `${p.no}\n${p.ru}` : p.no).join('\n'), 'all');
    },
    /** translate what the chosen view needs (sentences / words), then redraw the examples box (or call onDone) */
    async fillExamples(card, onDone) {
      const v = Store.settings.exView || 'asis';
      const units = card ? this.descUnits(card) : [];
      const main = card ? this.mainNo(card) : '';
      if (v === 'asis' || !card || (!(card.examples || []).length && !units.length && !main) || this._exBusy) return;
      const sentNeed = [], wordSents = [];
      // the card's own Norwegian text: its sentences (sentence view) or its words (word view)
      if (main) {
        const ss = this.splitSent(main).filter(s => /\p{L}/u.test(s));
        if (v === 'sent' && ss.length > 1) ss.forEach(s => { if (this.sentTr(s) === undefined) sentNeed.push(s); });
        // meaning first: each sentence with the translation its words must follow (the same one shown on the card)
        if (v === 'word') wordSents.push(...ss.map(s => ({ s, ru: this.mainRu(card, s, ss.length) })));
      }
      (card.examples || []).forEach(x => {
        if (v === 'sent') this.exPairs(x).forEach(p => { if (p.mt && p.ru === undefined) sentNeed.push(p.no); });
        else this.exPairs(x).forEach(p => wordSents.push({ s: p.no, ru: this.exWordRu(x, p) }));
      });
      // description lines (grammar, Ordbøkene, explanations): a line without its own translation also gets the whole
      // sentence translated (shown under the words); in the word view every line is glossed
      units.forEach(u => { if (!u.ru) sentNeed.push(u.no); if (v === 'word') wordSents.push({ s: u.no, ru: this.userSent(u.no) || u.ru || undefined }); });
      this._exBusy = true;
      // lines appear one by one while the translation runs
      let t = null;
      Translators.onPut = () => { if (t) return; t = setTimeout(() => { t = null; if (onDone) onDone(); else this.redrawExamples(card.id); }, 500); };
      try { await this.translateUnits(sentNeed, wordSents); } finally { Translators.onPut = null; clearTimeout(t); }
      this._exBusy = false;
      if (onDone) onDone(); else this.redrawExamples(card.id);
      if (this._lastFail) this.failModal(() => this.fillExamples(Store.card(card.id) || card, onDone));
    },
    /**
     * shared by cards, the card viewer and the textbook reader: translate these sentences (cache 's:') and gloss every
     * word of those sentences (AI in context → cache 'g:'; otherwise hand-made list + single words → cache 'w2:')
     */
    /**
     * the translator refused (limit, no internet…): a window in the middle of the screen says why,
     * with a big «🔄 Повторить перевод» button — nothing to look for
     */
    failModal(retry) {
      const f = this._lastFail; if (!f || document.querySelector('.tr-fail-modal')) return;
      const S = Store.settings;
      const googleDown = /google/i.test(f.error || '');
      const cur = Translators.dictMain();
      // every translator and every neural network: can it translate right now, and if not — what it needs
      const TR = [
        ['google', 'Google Переводчик', googleDown ? '⛔ сейчас отказывает вам' : '✓ бесплатно, без ключа', !googleDown],
        ['mozhi', 'Mozhi (Google через открытый сервер)', '✓ бесплатно, без ключа — переводит со своего сервера, ограничение вашего адреса на него не действует', true],
        ['mymemory', 'MyMemory', '✓ бесплатно, без ключа · до ≈5000 символов в день', true],
        ['deepl', 'DeepL', (S.deeplKey || '').trim() ? '✓ ключ есть' : '🔑 нужен бесплатный ключ (500 000 символов в месяц) и мост на Mac', !!(S.deeplKey || '').trim()],
        ['microsoft', 'Microsoft Translator', (S.msKey || '').trim() ? '✓ ключ есть' : '🔑 нужен ключ Azure (2 млн символов в месяц бесплатно)', !!(S.msKey || '').trim()],
      ];
      const AIs = Object.entries(AI.PROVIDERS).filter(([id]) => id !== 'custom').map(([id, p]) => {
        // a program on the Mac (Ollama) needs no key, so «configured» is always true — it counts only once it was chosen
        const ok = AI.configured(id) && (!p.noKey || AI.current() === id);
        const why = ok ? '✓ подключена — переводит по смыслу, без ограничений Google'
          : id === 'claude' ? (AI.bridge && AI.bridge.up ? '🔐 войдите в Claude Code (в Терминале: claude → /login)' : '🖥 нужен мост на Mac и подписка Claude')
          : p.noKey ? '🖥 установите программу на Mac' : `🔑 нужен ключ${p.free ? ' — бесплатный' : ''}${p.limits ? ' · ' + p.limits : ''}${p.proxyOnly ? '' : ''}`;
        return [id, p.name, why, ok];
      }).sort((a, b) => b[3] - a[3]);
      const item = (kind, [id, name, why, ok]) => `<button class="tr-pick ${ok ? 'ok' : 'need'} ${(kind === 'tr' && id === cur) || (kind === 'ai' && cur === 'ai' && id === AI.current()) ? 'cur' : ''}" data-pick="${kind}:${id}">
          <span class="tr-pick-ico">${kind === 'tr' ? Translators.icon(id, 22) : (AI.icon(id, 22) || '🤖')}</span>
          <span class="tr-pick-txt"><b>${U.esc(name)}</b><small>${U.esc(why)}</small></span>
          <span class="tr-pick-go">${ok ? 'Выбрать' : kind === 'tr' && id === 'google' ? 'Повторить' : 'Подключить'}</span></button>`;
      const m = UI.modal({
        title: googleDown ? '⛔ Google Переводчик сейчас не работает' : '⚠️ Перевод не пришёл', cls: 'tr-fail-modal',
        body: `${googleDown ? `<div class="mt-warn"><span>⛔</span><span><b>Google временно перестал переводить для вашего адреса</b> — слишком много переводов за короткое время. Это ограничение самого Google (не книги и не приложения); обычно снимается через 5–15 минут. <b>Выберите другой переводчик или нейросеть ниже</b> — перевод сразу продолжится.</span></div>` : ''}
          <div class="fail-hero">
            <button class="media-btn main fail-retry" data-retry title="Повторить перевод" aria-label="Повторить перевод">${UI.icon('retry', 30)}</button>
            <b>Повторить перевод</b>
            <span class="small muted">Не переведено: ${f.missing} ${U.plural(f.missing, ['строка', 'строки', 'строк'])}${googleDown ? '' : ` · причина: ${U.esc(f.error)}`}</span>
          </div>
          <div class="tr-pick-title">🔁 Переводчики</div>
          <div class="tr-pick-list">${TR.map(x => item('tr', x)).join('')}</div>
          <div class="tr-pick-title">🤖 Нейросети — точнее всего (переводят по смыслу предложения)</div>
          <div class="tr-pick-list">${AIs.map(x => item('ai', x)).join('')}</div>
          <p class="tiny muted">Выбор сохраняется (Настройки → «Переводчик для статей словарей»). Если выбранный не ответит — приложение само попробует следующий.</p>`,
        foot: '<button class="btn ghost" data-x>Закрыть</button>',
      });
      const toSettings = msg => { document.querySelectorAll('.modal-backdrop [data-close]').forEach(b => b.click()); App.go('settings'); if (msg) UI.toast(msg, '', 7000); };
      m.$('[data-retry]').onclick = () => { m.close(); retry(); };
      m.$('[data-x]').onclick = () => m.close();
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-pick]'); if (!b) return;
        const [kind, id] = b.dataset.pick.split(':');
        if (kind === 'tr') {
          // Google needs no key: when it refuses, its button just tries it again
          if (!b.classList.contains('ok') && id !== 'google') { toSettings(`${Translators.LIST[id].name}: впишите ключ в Настройках → «Переводчики»`); return; }
          Store.setSetting('dictTranslator', id);
          UI.toast(`Теперь переводит: ${Translators.LIST[id].name}`, 'good');
        } else {
          if (!b.classList.contains('ok')) { toSettings(id === 'claude' ? 'Claude: запустите мост и войдите в Claude Code (claude → /login), затем выберите его вверху' : AI.PROVIDERS[id].noKey ? `${AI.PROVIDERS[id].short}: установите программу на Mac, затем выберите её в Настройках → «Нейросети»` : `${AI.PROVIDERS[id].name}: впишите ключ в Настройках → «Нейросети»`); return; }
          Store.setSetting('aiProvider', id); Store.setSetting('dictTranslator', 'ai'); App.updateBadge();
          UI.toast(`Теперь переводит нейросеть: ${AI.PROVIDERS[id].name}`, 'good');
        }
        m.close(); retry();
      });
      // no scrolling to it: on a phone the explanation and the big retry button must stay in view
      setTimeout(() => { const b = m.$(googleDown ? '[data-pick="tr:mozhi"]' : '[data-retry]'); if (b) b.focus({ preventScroll: true }); }, 80);
    },
    /**
     * translate what a view needs. sentNeed: sentences (cache 's:'). wordSents: sentences of the word view — strings or
     * { s, ru } with the translation the reader sees. MEANING FIRST: a sentence is translated as a whole before its
     * words; then a connected neural network distributes that translation over the words (cache 'g:', tied to the
     * translation), otherwise every word is looked up in the translation (Align: dictionary, your cards, single-word
     * translations, back-translation — cached for good).
     * opts.quiet: in the background (subtitles, TV) — no «please wait» window, no toasts; opts.onProgress(done, total, phase);
     * opts.cancel() → true stops between batches.
     */
    async translateUnits(sentNeed = [], wordSents = [], opts = {}) {
      this._lastFail = null;
      const c = this.exCache();
      const quiet = !!opts.quiet;
      const items = [], seen = new Set();
      (wordSents || []).forEach(x => {
        const s = typeof x === 'string' ? x : x && x.s;
        if (!s || seen.has(s) || !/\p{L}/u.test(s)) return;
        seen.add(s);
        items.push({ s, ru: x && typeof x === 'object' && x.ru ? String(x.ru) : undefined });
      });
      const sNeed = [...new Set([...(sentNeed || []), ...items.filter(it => it.ru === undefined).map(it => it.s)])].filter(s => s && this.sentTr(s) === undefined);
      try {
        if (sNeed.length) {
          if (opts.onProgress) opts.onProgress(0, sNeed.length, 'sent');
          const res = await Translators.translateMany(sNeed, 'no', 'ru', { quiet });
          // no answer = not saved (it is tried again next time)
          sNeed.forEach((s, i) => { if (res.out[i]) c['s:' + s] = String(res.out[i]).trim(); });
          this._exBy = [...new Set([...(this._exBy || []), ...res.by])];
          this._lastFail = res.missing ? { missing: res.missing, error: res.error } : null;
          this.exSave();
        }
        if (!items.length || (opts.cancel && opts.cancel())) return;
        items.forEach(it => { if (it.ru === undefined) it.ru = this.sentTr(it.s) || ''; });
        // dictionary forms (ønska → ønske) help to find the meaning; the word list is loaded once (offline afterwards)
        if (window.Lexicon && !Lexicon.loaded()) { try { await Lexicon.ready(); this._glVer = (this._glVer || 0) + 1; } catch (e) { /* forms only */ } }
        if (AI.available()) await this.aiGloss(items, opts);
        const left = items.filter(it => !this.aiDone(it));
        if (left.length && !(opts.cancel && opts.cancel())) await this.wordCands(left, opts);
        this.exSave();
      } catch (e) { if (!quiet) UI.toast('Перевод: ' + e.message, 'warn'); }
    },
    /** this sentence has AI glosses made from its current translation (or all its words are yours) */
    aiDone(it) {
      const g = this.exCache()['g:' + it.s];
      if (g && !Array.isArray(g) && it.ru && g.h === this.ruHash(it.ru)) return true;
      const toks = this.glossToks(it.s);
      return toks.length > 0 && toks.every((w, k) => this.userGloss(it.s, k) !== undefined || this.isName(w, k));
    },
    /** the AI answer for one sentence → clean glosses (1:1 with the words), or null when it does not fit */
    aiValid(it, arr) {
      const toks = this.glossToks(it.s);
      if (!Array.isArray(arr) || arr.length !== toks.length) return null;
      let filled = 0, want = 0;
      const g = arr.map((x, k) => {
        let t = Store.Safe.text(typeof x === 'string' ? x : x == null ? '' : String(x), 80).replace(/\s+/g, ' ').trim();
        const name = this.isName(toks[k], k);
        if (!name) want++;
        if (!t || name) return name ? '' : t;
        if (!/[а-яё]/i.test(t) || Align.echoes(toks[k], t)) return ''; // Latin garbage, «Han» → «Хан»
        filled++;
        return t;
      });
      return want && filled >= Math.ceil(want / 2) ? g : null;
    },
    /** 🤖 the neural network distributes each sentence's translation over its words — all sentences, in batches */
    async aiGloss(items, opts = {}) {
      const c = this.exCache();
      const todo = items.filter(it => it.ru && !this.aiDone(it));
      if (!todo.length) return;
      const quiet = !!opts.quiet;
      const busy = quiet ? null : UI.busy(`Подождите — ${AI.name()} переводит каждое слово по смыслу…`);
      const total = todo.length;
      let done = 0;
      const prog = () => { if (busy) busy.set(`${done} из ${total} предложений`, done, total); if (opts.onProgress) opts.onProgress(done, total, 'ai'); };
      prog();
      const parts = []; for (let i = 0; i < todo.length; i += 8) parts.push(todo.slice(i, i + 8));
      const system = 'You are a Norwegian–Russian teacher making interlinear glosses for learners. You answer with JSON only.';
      const prompt = part => `Each item has a Norwegian sentence ("no"), its Russian translation ("ru") and the list of its words ("words").
First understand the whole sentence by its meaning. Then for EVERY word write the Russian word(s) that express THIS word's meaning in THIS Russian translation, copied in the same form the translation uses (e.g. "ønska" → "хотел" when the translation says "хотел"; "skurringa" → "треск" when it says "треск").
A word that has no separate counterpart in the translation (article, «seg», «å», auxiliary verb, particle): its meaning in this sentence in 1–3 Russian words, or a short note in brackets such as "(артикль)" or "(вспом. глагол)".
Never transliterate a Norwegian word into Cyrillic letters. Names of people and places: "".
Return ONLY a JSON array with one array of strings per item, in the same order, each with exactly as many strings as the item has words.
${JSON.stringify(part.map(p => ({ no: p.s, ru: p.ru, words: this.glossToks(p.s) })))}`;
      let k = 0, fails = 0, stop = false;
      const one = async part => {
        for (let attempt = 0; attempt < 3 && !stop; attempt++) {
          try {
            const arr = AI.parseJSON(await AI.call({ system, user: prompt(part), maxTokens: 300 + part.reduce((n, p) => n + this.glossToks(p.s).length, 0) * 16, temperature: 0, quiet: true }));
            let ok = 0;
            part.forEach((p, j) => { const g = this.aiValid(p, Array.isArray(arr) ? arr[j] : null); if (g) { c['g:' + p.s] = { h: this.ruHash(p.ru), g }; ok++; } });
            if (!ok) throw new Error('ответ не подошёл');
            this._exBy = [...new Set([...(this._exBy || []), 'ai'])]; Translators.lastAI = AI.lastProvider;
            this._glVer = (this._glVer || 0) + 1;
            fails = 0;
            return;
          } catch (e) {
            // a limit / a bad answer: wait a little longer each time; four in a row — the rest goes word by word
            if (++fails >= 4) { stop = true; return; }
            await U.sleep(1200 * (attempt + 1) * fails);
          }
        }
      };
      const worker = async () => {
        while (!stop && k < parts.length) {
          if (opts.cancel && opts.cancel()) { stop = true; break; }
          const p = parts[k++];
          await one(p);
          done += p.length; prog();
          if (opts.onBatch) { try { opts.onBatch(p.map(x => x.s)); } catch (e) { /* drawing is not our business */ } }
        }
      };
      try { await Promise.all([worker(), worker()]); } finally { if (busy) busy.close(); this.exSave(); }
    },
    /**
     * no neural network (or it gave up): what is needed to find each word in its sentence translation —
     * single words (the form + the dictionary form) and the Russian words translated back to Norwegian, a few big
     * requests (never one per word), cached for good; then Google's alternative meanings for a few words that are
     * still not found — only while Google is not resting after a refusal.
     */
    async wordCands(items, opts = {}) {
      const c = this.exCache(), quiet = !!opts.quiet;
      const need = new Set();
      items.forEach(it => this.glossToks(it.s).forEach((w, k) => {
        if (this.userGloss(it.s, k) !== undefined || this.isName(w, k)) return;
        const f = this.bareLow(w);
        if (!f || !/\p{L}/u.test(f) || NoGloss.has(f)) return;
        if (c['w2:' + f] === undefined) need.add(f);
        this.lemmasOf(f).forEach(x => { if (x !== f && !NoGloss.has(x) && c['w2:' + x] === undefined) need.add(x); });
      }));
      // in the background only the translators that take many lines per request (no flood of single requests)
      // «FM-båndet»: the word after the hyphen is looked up too
      items.forEach(it => this.glossToks(it.s).forEach(w => { const f = this.bareLow(w); const t = /-/.test(f) ? f.split('-').pop() : ''; if (t.length > 2 && !NoGloss.has(t) && c['w2:' + t] === undefined) need.add(t); }));
      const only = quiet ? ['deepl', 'google', 'mozhi'] : null;
      if (need.size) {
        if (opts.onProgress) opts.onProgress(0, need.size, 'words');
        const list = [...need].slice(0, 600);
        const res = await Translators.translateMany(list, 'no', 'ru', { quiet, only, noAI: true });
        // no answer = not saved (asked again next time); garbage for a single word = '' («—»)
        list.forEach((w, i) => { if (res.out[i]) c['w2:' + w] = this.cleanGloss(w, res.out[i]); });
        // the translator answered the others but had nothing for these: no meaning (not «…» for ever); all failed → asked again later
        if (res.missing < list.length) list.forEach((w, i) => { if (!res.out[i] && c['w2:' + w] === undefined) c['w2:' + w] = ''; });
        this._exBy = [...new Set([...(this._exBy || []), ...res.by])];
        // a few words without an answer are normal (a name, a rare form) — the «translator refused» window only when none came
        if (res.missing && res.missing === list.length && !this._lastFail) this._lastFail = { missing: res.missing, error: res.error };
        this.exSave();
      }
      if (opts.cancel && opts.cancel()) return;
      // the other way round: «хотел» → «ville / ønsket» finds the Norwegian word a Russian word stands for
      const rw = new Set();
      items.forEach(it => Align.ruWords(it.ru).forEach(x => { if (/[а-я]/.test(x.lw) && x.lw.length > 1 && c['r2:' + x.lw] === undefined) rw.add(x.lw); }));
      if (rw.size) {
        const list = [...rw].slice(0, 800);
        try {
          const res = await Translators.translateMany(list, 'ru', 'no', { quiet: true, only: ['deepl', 'google', 'mozhi'], noAI: true });
          list.forEach((w, i) => { if (res.out[i]) c['r2:' + w] = Store.Safe.text(String(res.out[i]), 60).toLowerCase().trim(); });
          this.exSave();
        } catch (e) { /* only fewer words are found */ }
      }
      if (opts.cancel && opts.cancel()) return;
      // still not in the translation: Google's other meanings of the dictionary form — a handful, one by one, slowly
      const miss = [];
      items.forEach(it => {
        const toks = this.glossToks(it.s);
        this.alignOf(it.s, it.ru).forEach((o, k) => {
          if (o.how !== 'guess' || o.src === 'dict' || o.src === 'card') return;
          const f = this.bareLow(toks[k]), w = this.lemmasOf(f)[0] || f;
          if (c['a:' + w] === undefined && !miss.includes(w)) miss.push(w);
        });
      });
      let asked = 0;
      for (const w of miss) {
        if (asked >= (quiet ? 12 : 6) || Translators.gCooling() || (opts.cancel && opts.cancel())) break;
        asked++;
        try { c['a:' + w] = await Translators.alts(w); } catch (e) { break; }
        await U.sleep(400);
      }
      if (asked) this.exSave();
    },
    redrawExamples(cardId) {
      const cur = this.current(); if (!cur || cur.card.id !== cardId) return;
      const card = Store.card(cardId) || cur.card;
      this.redrawIn(document.querySelector('[data-area]'), card);
    },
    /** redraw the translated parts (view switch, description, examples) inside a container: the card back or the viewer */
    redrawIn(root, card) {
      if (!root || !card) return;
      const box = root.querySelector('.ex-box'); if (box) box.outerHTML = this.examplesHtml(card);
      const d = root.querySelector('[data-desc-box]'); if (d) d.innerHTML = this.descHtml(card);
      const fb = root.querySelector('[data-forms-box]'); if (fb && !fb.querySelector('.fg-editing')) fb.outerHTML = this.formsHtml(card);
      const mb = root.querySelector('[data-main-box]'); if (mb) mb.innerHTML = this.mainInner(card, mb.dataset.prompt || 'no');
      const bar = this.viewBarHtml(card);
      root.querySelectorAll('.view-bar').forEach(b => { b.outerHTML = bar; });
    },

    /** full text of one side of the current card (what the user sees) */
    sideText(cur, back) {
      const { item, card } = cur;
      if (!back) return S.mode === 'listen' ? card.no : (item.dir === 'nr' ? card.no : card.ru);
      const answer = S.mode === 'listen' ? card.no + '\n' + card.ru : (item.dir === 'nr' ? card.ru : card.no);
      return [answer, Prov.listText(card.forms), (card.synonyms || []).map(s => `${s.no}\n${s.ru || ''}`).join('\n'), card.description,
        // examples: Norwegian sentence → its translation → next sentence (when the pairs are known)
        (card.examples || []).map(x => { const p = this.exPairs(x); return p.length && p.every(s => s.ru) ? p.map(s => `${s.no}\n${s.ru}`).join('\n') : `${x.no}\n${x.ru || ''}`; }).join('\n'),
        card.example, card.exampleRu].filter(Boolean).join('\n');
    },
    /** read the visible side: all / only Norwegian / only Russian (each with its own voice) */
    readVisible(opts = {}) {
      const cur = this.current();
      if (!cur) return;
      const back = S.flipped;
      const mode = !back && S.mode === 'listen' ? 'no' : (Store.settings.readMode || 'all');
      TTS.speakText(this.sideText(cur, back), mode, opts);
    },

    quizOptions(card, side) {
      const first = t => String(t || '').split('\n')[0].trim().slice(0, 90);
      const correct = first(this.faceText(card, side));
      let pool = Store.cards(card.deckId).filter(c => c.id !== card.id);
      if (pool.length < 3) pool = Store.cards().filter(c => c.id !== card.id);
      if (side !== 'no' && this.trLang() !== 'ru' && this.ukOf(card)) { const withUk = pool.filter(c => this.ukOf(c)); if (withUk.length >= 3) pool = withUk; }
      const seen = new Set([U.norm(correct)]);
      const opts = [];
      for (const c of U.shuffle(pool)) {
        const t = first(this.faceText(c, side));
        if (!t || seen.has(U.norm(t))) continue;
        seen.add(U.norm(t)); opts.push({ text: t, ok: false });
        if (opts.length >= 3) break;
      }
      opts.push({ text: correct, ok: true });
      return U.shuffle(opts);
    },

    flip(force) {
      const el = document.querySelector('[data-card]');
      if (!el) return;
      S.flipped = force != null ? force : !S.flipped;
      el.classList.toggle('flipped', S.flipped);
      const { item, card } = this.current();
      if (S.flipped && Store.settings.autoSpeak && item.dir === 'rn' && String(card.no).length < 200) TTS.speak(card.no, 'no');
      if (S.flipped && (card.forms || []).length) this.formsSoon(card.id); // 📚 missing form translations: now that they are seen
    },

    /* ---------- answering ---------- */
    grade(g) {
      if (!S || S.locked) return;
      const cur = this.current(); if (!cur) return;
      S.locked = true;
      try { if (navigator.vibrate) navigator.vibrate(g > 1 ? 12 : [18, 40, 18]); } catch (e) { /* ignore */ }
      const { item, card } = cur;
      const st = Store.settings;
      const snapshot = Object.assign({ item, queue: S.queue.slice(), done: S.done, known: S.known, unknown: S.unknown, first: new Map(S.first), unknownIds: new Set(S.unknownIds) }, this.gradeCard(card, item.dir, g));
      S.history.push(snapshot);
      if (!S.first.has(card.id + item.dir)) {
        S.first.set(card.id + item.dir, g > 1);
        if (g > 1) S.known++; else { S.unknown++; }
      }
      if (g === 1) S.unknownIds.add(card.id);
      S.queue.shift();
      if (g === 1 && st.requeue) {
        const pos = Math.min(S.queue.length, 3 + Math.floor(Math.random() * 3));
        S.queue.splice(pos, 0, item);
      } else S.done++;
      TTS.stop();
      const el = document.querySelector('[data-card]');
      const dir = this._swipeDir || (g > 1 ? 'right' : 'left');
      this._swipeDir = null;
      if (el && S.mode !== 'type' && S.mode !== 'quiz') this.flyOut(el, dir, () => this.next(true));
      else this.next(true);
    },

    /**
     * one answer for one card and direction — FSRS (personal weights when fitted, fuzz + load balancing), leech mark,
     * the review log (stats and the optimiser read it). Used by the study session AND by 🎧 listening («знаю / не знаю»).
     * Returns the snapshot that ungradeCard() takes back.
     */
    gradeCard(card, dir, g) {
      const st = Store.settings;
      const prev = card.srs[dir] ? JSON.parse(JSON.stringify(card.srs[dir])) : null;
      const isNew = !prev || !prev.reps;
      const snap = { cardId: card.id, dir, prev, prevTags: card.tags.slice() };
      // fuzz + load balancing: inside the small fuzz range the day with fewer cards due wins (and not the other direction's day)
      const other = card.srs[dir === 'nr' ? 'rn' : 'nr'];
      const next = FSRS.review(prev, g, { retention: st.retention, fuzz: st.fuzz, balance: st.fuzz, avoidDay: other && other.reps && other.due > Date.now() ? other.due : null });
      FSRS.Load.move(prev && prev.reps ? prev.due : null, next.due);
      const srs = Object.assign({}, card.srs, { [dir]: next });
      let tags = card.tags;
      if (g === 1 && (next.lapses || 0) >= st.leechLapses && !tags.includes('leech')) {
        tags = tags.concat('leech');
        UI.toast('🐛 Эта карта даётся тяжело — помечена как «трудная». Попробуйте 🤖 «Объяснить» или добавьте картинку/пример.', 'warn', 6000);
      }
      Store.updateCard(card.id, { srs, tags });
      snap.next = next;
      snap.log = Store.logReview(card.id, dir, g, isNew);
      return snap;
    },
    /** take one gradeCard() answer back (the card's memory state, its tags and the log entry) */
    ungradeCard(h) {
      const card = Store.card(h.cardId);
      if (card) {
        const srs = Object.assign({}, card.srs);
        if (h.prev) srs[h.dir] = h.prev; else delete srs[h.dir];
        Store.updateCard(card.id, { srs, tags: h.prevTags });
        FSRS.Load.invalidate();
      }
      Store.unlog(h.log);
    },

    undo() {
      if (!S || !S.history.length) { UI.toast('Нечего отменять'); return; }
      const h = S.history.pop();
      this.ungradeCard(h);
      Object.assign(S, { queue: h.queue, done: h.done, known: h.known, unknown: h.unknown, first: h.first, unknownIds: h.unknownIds });
      this.updateTop();
      S.flipped = false; S.locked = false; S.answeredType = null; S.quizDone = false;
      this.renderCard(true);
      UI.toast('↶ Ответ отменён', '', 1500);
    },

    /* ---------- typing mode ---------- */
    checkTyped() {
      const inp = document.querySelector('[data-type]');
      if (!inp) return;
      const typed = inp.value.trim();
      const { item, card } = this.current();
      // the translation: Russian AND Ukrainian are both accepted (the chosen language is compared first)
      const targets = item.dir === 'nr' ? this.trAnswers(card) : [card.no];
      const tol = Store.settings.typeTolerance;
      const nopt = { stripArticles: true, foldNordic: tol };
      const apos = x => String(x || '').replace(/[’ʼ`´]/g, "'");
      const alts = targets.flatMap(x => { const firstLine = apos(String(x).split('\n')[0]); return [firstLine, ...U.alternatives(firstLine)]; }).filter(Boolean);
      if (!alts.length) alts.push('');
      const t = U.norm(apos(typed), nopt);
      let best = alts[0], bestD = Infinity;
      alts.forEach(a => { const d = U.levenshtein(t, U.norm(a, nopt)); if (d < bestD) { bestD = d; best = a; } });
      const len = U.norm(best, nopt).length;
      const exact = bestD === 0 && t.length > 0;
      const almost = !exact && tol && t.length > 2 && bestD <= Math.max(1, Math.floor(len * 0.15));
      const res = document.querySelector('[data-result]');
      const cardEl = document.querySelector('[data-card]');
      S.answeredType = exact || almost ? 3 : 1;
      if (exact) { res.innerHTML = '<span class="ok">✓ Верно!</span>'; cardEl.classList.add('glow-good'); }
      else if (almost) res.innerHTML = `<span class="ok">≈ Почти верно</span> — ${U.diffHtml(typed, best)}`;
      else res.innerHTML = `<span class="err">✗ Неверно</span>${typed ? ' — ' + U.diffHtml(typed, best) : ''}<br><button class="btn sm" data-act="override" style="margin-top:8px">Я был прав</button>`;
      if (!exact && !almost) { cardEl.classList.remove('shake'); void cardEl.offsetWidth; cardEl.classList.add('shake'); }
      res.insertAdjacentHTML('beforeend', ' <span class="muted small">— Enter: дальше</span>');
      inp.readOnly = true;
      this.flip(true);
      if (item.dir === 'nr') TTS.speak(card.no, 'no');
    },
    typeNext() { const g = S.answeredType || 1; S.answeredType = null; this.grade(g); },

    /* ---------- quiz mode ---------- */
    quizAnswer(btn) {
      if (S.locked || S.quizDone) return;
      S.quizDone = true;
      const ok = btn.dataset.ok === '1';
      document.querySelectorAll('.quiz-opt').forEach(b => { b.disabled = true; if (b.dataset.ok === '1') b.classList.add('correct'); });
      if (!ok) btn.classList.add('wrong');
      this.flip(true);
      S.quizGrade = ok ? 3 : 1;
      const { card } = this.current();
      TTS.speak(card.no, 'no');
      if (ok) setTimeout(() => { if (S && S.quizDone) this.quizNext(); }, 1100);
      else document.querySelector('[data-act="quiz-next"]').classList.remove('hidden');
    },
    quizNext() { if (!S.quizDone) return; S.quizDone = false; this.grade(S.quizGrade || 1); },

    /* ---------- swipe ---------- */
    bindSwipe(el) {
      if (!el) return;
      // entrance animation uses fill-mode "both" which would override the drag transform
      el.addEventListener('animationend', e => { if (e.target === el) el.classList.remove('enter', 'shake', 'glow-good'); });
      const st = Store.settings;
      const mode = st.swipeMode || 'lr';
      const style = st.swipeStyle || 'tinder';
      const thr = { low: 160, medium: 110, high: 70 }[st.swipeSensitivity || 'medium'] || 110;
      const allowX = mode !== 'ud' && mode !== 'off';
      const allowY = mode === 'ud' || mode === 'four';
      const stage = el.parentElement;
      // vertical swipes need the page not to scroll under the finger (long cards keep scrolling)
      stage.style.touchAction = allowY && !el.querySelector('.face.long') ? 'none' : 'pan-y';
      const hint = document.createElement('div');
      hint.className = 'swipe-hint';
      el.appendChild(hint);

      let sx = 0, sy = 0, dx = 0, dy = 0, axis = null, dragging = false, down = false, moved = false;
      let pts = [], lpTimer = null, lastTap = 0, tapTimer = null;
      const busy = () => S.mode === 'type' || S.mode === 'quiz';
      const dirOf = () => axis === 'x' ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      const showHint = () => {
        const a = this.actionFor(dirOf());
        const p = Math.min(1, Math.abs(axis === 'x' ? dx : dy) / thr);
        if (!a) { hint.style.opacity = 0; return; }
        hint.textContent = a.label;
        hint.dataset.g = a.flip ? 'flip' : a.g;
        hint.style.opacity = p;
        if (p >= 1 && !hint._buzz) { hint._buzz = true; hint.classList.add('ready'); try { navigator.vibrate && navigator.vibrate(8); } catch (_) { /* ignore */ } }
        if (p < 1 && hint._buzz) { hint._buzz = false; hint.classList.remove('ready'); }
      };
      const reset = () => { el.style.transform = ''; el.style.opacity = ''; hint.style.opacity = 0; hint.classList.remove('ready'); hint._buzz = false; };
      const fire = dir => {
        const a = this.actionFor(dir);
        if (!a) { reset(); return; }
        hint.style.opacity = 0;
        if (a.flip) { reset(); this.flip(); return; }
        this._swipeDir = dir;
        this.grade(a.g);
      };

      // a press on a scrollbar is not a tap / long press (it used to start the speech and flip the card)
      const onScrollbar = e => {
        const t = e.target;
        if (!(t instanceof Element)) return false;
        const vbar = t.scrollHeight > t.clientHeight && e.offsetX >= t.clientWidth;
        const hbar = t.scrollWidth > t.clientWidth && e.offsetY >= t.clientHeight;
        return vbar || hbar;
      };
      // scrolling the card while pressing cancels the tap and the long press
      el.querySelectorAll('.face').forEach(f => f.addEventListener('scroll', () => { if (down) { moved = true; clearTimeout(lpTimer); } }, { passive: true }));
      el.addEventListener('pointerdown', e => {
        if (e.target.closest('button, a, input, textarea, .mt-note, [data-glfix], .gt-badge, .fg-label .gt')) return; // a tap on a (translation) corrects it; on a grammar label — explains it
        if (onScrollbar(e)) { down = false; clearTimeout(lpTimer); return; }
        // a click that only clears an existing selection must not flip the card
        if (window.getSelection && String(window.getSelection())) { down = false; clearTimeout(lpTimer); return; }
        down = true; moved = false; dragging = false; axis = null;
        sx = e.clientX; sy = e.clientY; dx = 0; dy = 0;
        pts = [{ x: sx, y: sy, t: e.timeStamp }];
        clearTimeout(lpTimer);
        if (st.longPressAction !== 'none') lpTimer = setTimeout(() => { if (down && !moved) { down = false; this.gesture(st.longPressAction || 'speak'); } }, 550);
      });
      el.addEventListener('pointermove', e => {
        if (!down) return;
        dx = e.clientX - sx; dy = e.clientY - sy;
        pts.push({ x: e.clientX, y: e.clientY, t: e.timeStamp }); if (pts.length > 8) pts.shift();
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) { moved = true; clearTimeout(lpTimer); }
        // mouse drag that started on text selects it — then it is not a swipe
        if (!dragging && e.pointerType === 'mouse' && window.getSelection && String(window.getSelection())) { down = false; clearTimeout(lpTimer); return; }
        if (!dragging && !busy() && Math.hypot(dx, dy) > 12) {
          const ax = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : Math.abs(dy) > Math.abs(dx) * 1.2 ? 'y' : null;
          if ((ax === 'x' && allowX) || (ax === 'y' && allowY)) {
            dragging = true; axis = ax; el.classList.add('dragging');
            try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
          }
        }
        if (dragging) {
          const ddx = axis === 'x' ? dx : 0, ddy = axis === 'y' ? dy : 0;
          el.style.transform = this.dragTransform(style, ddx, ddy, axis);
          if (style === 'fade') el.style.opacity = 1 - Math.min(0.55, Math.hypot(ddx, ddy) / 500);
          showHint();
        }
      });
      const end = () => {
        clearTimeout(lpTimer);
        if (!down) return;
        down = false;
        if (dragging) {
          dragging = false; el.classList.remove('dragging');
          const dist = Math.abs(axis === 'x' ? dx : dy);
          // a quick flick counts even if it is short
          const last = pts[pts.length - 1], first = pts.find(p => last.t - p.t < 110) || pts[0];
          const v = (axis === 'x' ? last.x - first.x : last.y - first.y) / Math.max(1, last.t - first.t);
          if (dist > thr || (Math.abs(v) > 0.6 && dist > 40)) fire(dirOf());
          else reset();
          return;
        }
        if (!moved && (S.mode === 'flip' || S.mode === 'listen')) {
          if (window.getSelection && String(window.getSelection())) return;
          const dbl = st.doubleTapAction && st.doubleTapAction !== 'none';
          if (!dbl) { this.flip(); return; }
          const now = Date.now();
          if (now - lastTap < 300) { clearTimeout(tapTimer); lastTap = 0; this.gesture(st.doubleTapAction); return; }
          lastTap = now; tapTimer = setTimeout(() => this.flip(), 260);
        }
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', () => { clearTimeout(lpTimer); down = false; dragging = false; el.classList.remove('dragging'); reset(); });

      // MacBook trackpad: two-finger horizontal swipe
      if (st.trackpadSwipe !== false && allowX) {
        let acc = 0, lock = 0, resetT = null;
        stage.addEventListener('wheel', e => {
          if (busy() || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
          e.preventDefault(); // also stops Safari's "back" swipe here
          if (Date.now() < lock) return;
          acc -= e.deltaX;
          clearTimeout(resetT);
          resetT = setTimeout(() => { acc = 0; reset(); }, 220);
          axis = 'x'; dx = acc; dy = 0;
          el.style.transform = this.dragTransform(style, acc * 0.7, 0, 'x');
          showHint();
          if (Math.abs(acc) > 170) { lock = Date.now() + 900; const dir = acc > 0 ? 'right' : 'left'; acc = 0; fire(dir); }
        }, { passive: false });
      }
    },

    hintText() {
      const m = Store.settings.swipeMode || 'lr';
      const t = { lr: 'свайп → знаю · ← не знаю', 'lr-rev': 'свайп ← знаю · → не знаю', ud: 'свайп ↑ знаю · ↓ не знаю',
        four: '→ хорошо · ← снова · ↑ легко · ↓ трудно', 'flip-first': 'свайп — перевернуть, затем → знаю · ← не знаю', off: 'кнопки внизу' }[m] || '';
      return `нажмите или пробел — перевернуть · ${t}`;
    },
    /** what a swipe direction does in the chosen scheme -> { g, label } | { flip, label } | null */
    actionFor(dir, fromKeyboard) {
      let mode = Store.settings.swipeMode || 'lr';
      if (mode === 'off') { if (!fromKeyboard) return null; mode = 'lr'; }
      if (mode === 'flip-first') {
        if (!S.flipped) return { flip: true, label: '↻ ПЕРЕВЕРНУТЬ' };
        mode = 'lr';
      }
      const four = Store.settings.fourButtons;
      const M = {
        lr: { right: { g: 3, label: 'ЗНАЮ ✓' }, left: { g: 1, label: '✗ НЕ ЗНАЮ' }, up: four ? { g: 4, label: 'ЛЕГКО ⚡' } : null, down: four ? { g: 2, label: 'ТРУДНО' } : null },
        'lr-rev': { left: { g: 3, label: 'ЗНАЮ ✓' }, right: { g: 1, label: '✗ НЕ ЗНАЮ' } },
        ud: { up: { g: 3, label: 'ЗНАЮ ✓' }, down: { g: 1, label: '✗ НЕ ЗНАЮ' } },
        four: { right: { g: 3, label: 'ХОРОШО ✓' }, left: { g: 1, label: '✗ СНОВА' }, up: { g: 4, label: 'ЛЕГКО ⚡' }, down: { g: 2, label: 'ТРУДНО' } },
      };
      return (M[mode] || M.lr)[dir] || null;
    },
    /** run a gesture action (long press / double tap) */
    gesture(action) {
      switch (action) {
        case 'speak': this.readVisible(); break;
        case 'flip': this.flip(); break;
        case 'know': this._swipeDir = 'right'; this.grade(3); break;
        case 'dontknow': this._swipeDir = 'left'; this.grade(1); break;
        case 'edit': { const b = document.querySelector('[data-act="edit"]'); b && b.click(); break; }
        case 'explain': { const b = document.querySelector('[data-act="explain"]'); b && b.click(); break; }
      }
    },
    /** card transform while dragging, per animation style */
    dragTransform(style, dx, dy, axis) {
      const d = Math.hypot(dx, dy);
      switch (style) {
        case 'slide': return `translate(${dx}px, ${dy}px)`;
        case 'flick3d': return axis === 'y' ? `translateY(${dy * 0.6}px) rotateX(${-dy / 5}deg)` : `translateX(${dx * 0.6}px) rotateY(${dx / 5}deg)`;
        case 'fade': return `translate(${dx * 0.5}px, ${dy * 0.5}px) scale(${1 - Math.min(0.25, d / 1600)})`;
        case 'stack': return `translate(${dx}px, ${dy}px) scale(${1 - Math.min(0.08, d / 3000)})`;
        case 'bounce': return `translate(${dx}px, ${dy}px) rotate(${dx / 30}deg) scale(${1 + Math.min(0.04, d / 6000)})`;
        default: return `translate(${dx}px, ${dy}px) rotate(${dx / 18 + dy / 60}deg)`;
      }
    },
    /** fly the card away after an answer (per animation style + direction) */
    flyOut(el, dir, cb) {
      const style = Store.settings.swipeStyle || 'tinder';
      const v = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] }[dir] || [1, 0];
      const [x, y] = v;
      const F = {
        tinder: [`translate(${x * 140}%, ${y * 130}%) rotate(${x * 24 + y * 6}deg)`, 420, 'cubic-bezier(.5,0,.75,0)'],
        slide: [`translate(${x * 120}%, ${y * 120}%)`, 320, 'cubic-bezier(.4,0,.2,1)'],
        flick3d: [y ? `translateY(${y * 70}%) rotateX(${-y * 90}deg)` : `translateX(${x * 70}%) rotateY(${x * 90}deg)`, 480, 'cubic-bezier(.5,0,.7,.4)'],
        fade: [`translate(${x * 20}%, ${y * 20}%) scale(.55)`, 360, 'ease-out'],
        stack: [`translate(${x * 18}%, 60px) scale(.8) rotate(${x * 4}deg)`, 420, 'cubic-bezier(.3,.7,.4,1)'],
        bounce: [`translate(${x * 160}%, ${y * 150}%) rotate(${x * 14}deg)`, 560, 'cubic-bezier(.6,-0.45,.7,1)'],
      };
      const [tf, dur, ease] = F[style] || F.tinder;
      el.classList.remove('enter', 'dragging');
      el.style.transition = `transform ${dur}ms ${ease}, opacity ${dur}ms ease`;
      requestAnimationFrame(() => { el.style.transform = tf; el.style.opacity = '0'; if (style === 'stack') el.style.zIndex = '-1'; });
      setTimeout(cb, dur - 40);
    },

    /* ---------- clicks & keys ---------- */
    /** translator icon on the card: verify the card's translation, optionally add the variant */
    /** an icon on the card was pressed: kind 'tr' (translator) or 'ai' (neural network) */
    async verifyWith(kind, id, btn) {
      const cur = this.current(); if (!cur) return;
      const card = cur.card;
      const text = Translators.prepare(card.no, 'no');
      if (kind === 'ai' && id === 'add') { App.go('settings'); return; }
      if (kind === 'tr' && id === 'telegram') { Telegram.open(Store.card(card.id) || card); return; }
      if (kind === 'tr' && id === 'grammatikk') { Grammar.open(Store.card(card.id) || card); return; }
      if (kind === 'tr' && id === 'ordbok') { this.ordbokBubble(card, btn); return; }
      if (kind === 'tr' && id === 'tatoeba') { this.tatoebaBubble(card, btn); return; }
      if (kind === 'tr' && id === 'more') {
        Translators.moreMenu(btn, text, 'no', 'ru',
          wid => { Prov.log(card.id, Prov.entry('tr:' + wid, 'verify', null, 'открыт словарь на сайте')); this.refreshBadges(); },
          wid => Views.pasteFromDict(wid, Store.card(card.id) || card, { onDone: () => { const c2 = this.current(); if (c2 && c2.card.id === card.id) { this.renderCard(false); this.flip(true); } } }));
        return;
      }
      if (id === 'compare') { Translators.compareDialog(text, 'no', 'ru', (res, tid) => this.addVariant(card, tid === 'ai' ? 'ai:' + (Translators.lastAI || AI.current()) : 'tr:' + tid, res)); return; }
      if (kind === 'tr' && !Translators.inline(id)) {
        const t = Translators.LIST[id];
        const go = () => Translators.open(id, text, 'no', 'ru');
        if (t.key) Guides.needKey(id, go); else go(); // explain how to make it work 100% inside the card
        return;
      }
      if (btn) btn.classList.add('busy');
      const by = kind + ':' + id;
      const name = kind === 'ai' ? AI.PROVIDERS[id].short : Translators.LIST[id].name;
      try {
        const tid = kind === 'ai' ? 'ai' : id;
        const topts = kind === 'ai' ? { provider: id } : {};
        const d = await Translators.detail(tid, text, 'no', 'ru', topts);
        const res = d.main;
        const agree = Translators.agrees(res, card.ru) || d.alts.some(a => Translators.agrees(a, card.ru));
        Prov.log(card.id, Prov.entry(by, 'verify', null, `NO→RU: «${res}»${d.alts.length ? ' (также: ' + d.alts.slice(0, 5).join(', ') + ')' : ''} — ${agree ? 'совпадает с карточкой' : 'отличается от карточки'}`));
        const hasForms = !!Translators.parseForms(card);
        if (this.current() && this.current().card.id === card.id) {
          this.showBubble({ by, name, res, agree, alts: d.alts, formsLoading: hasForms, text, icon: kind === 'ai' ? AI.icon(id, 24) : Translators.icon(id, 24) });
          this.refreshBadges();
          document.querySelectorAll('.card-rail:not(.front-rail)').forEach(r => Translators.light(r, Store.card(card.id), [], by));
        }
        // every form of the word, translated by the same service ("jeg spiste" -> "я ел")
        if (hasForms) {
          const f = await Translators.translateForms(tid, card, topts);
          if (this._bubble && this._bubble.by === by && this.current() && this.current().card.id === card.id) this.bubbleForms(f);
        }
      } catch (err) {
        // never jump to the website on its own: the other translators try, the result is shown right on the card
        await this.trFallback(card, kind, id, name, text, err);
      }
      if (btn) btn.classList.remove('busy');
    },
    /**
     * the chosen translator did not answer: the others try (Google → Mozhi → MyMemory → AI…, as in Settings);
     * the result is shown on the card with who actually translated. Nothing worked: say why, ⟳ retry, pick another.
     */
    async trFallback(card, kind, id, name, text, err) {
      let res = null;
      try { res = await Translators.translateMany([text], 'no', 'ru'); } catch (e) { /* nothing more to try */ }
      if (!this.current() || this.current().card.id !== card.id) return;
      const got = res && String(res.out[0] || '').trim();
      if (got) {
        const used = res.by.find(b => b !== id) || res.by[0] || 'google';
        const by = used === 'ai' ? 'ai:' + (Translators.lastAI || AI.current()) : 'tr:' + used;
        const uname = Translators.provNames([used]);
        const agree = Translators.agrees(got, card.ru);
        Prov.log(card.id, Prov.entry(by, 'verify', null, `NO→RU: «${got}» — ${agree ? 'совпадает с карточкой' : 'отличается от карточки'}`));
        this.showBubble({ by, name: uname, res: got, agree, alts: [], text, note: used !== (kind === 'ai' ? 'ai' : id) ? `${name} не ответил (${err.message}) — перевёл ${uname}` : '',
          icon: used === 'ai' ? (AI.icon(Translators.lastAI || AI.current(), 24) || '🤖') : Translators.icon(used, 24) });
        this.refreshBadges();
        document.querySelectorAll('.card-rail:not(.front-rail)').forEach(r => Translators.light(r, Store.card(card.id), [], by));
        return;
      }
      this._lastFail = { missing: 1, error: (res && res.error) || err.message };
      this.errBubble({ icon: kind === 'ai' ? AI.icon(id, 22) : Translators.icon(id, 22), name, msg: `${name} не ответил: ${err.message}. Другие переводчики тоже сейчас не ответили.`,
        retry: `data-act="tr-retry" data-kind="${kind}" data-id="${U.esc(id)}"`, url: kind === 'tr' ? Translators.webUrl(id, text, 'no', 'ru') : '', pick: true });
    },
    /** a source failed: the reason right on the card, ⟳ retry, other translators, the website only on request */
    errBubble(o) {
      const stage = document.querySelector('.stage'); if (!stage) return;
      stage.querySelectorAll('.tr-bubble').forEach(b => b.remove());
      stage.insertAdjacentHTML('beforeend', `<div class="tr-bubble ob-bubble err">
        <button class="tr-bubble-x" data-act="bubble-close" title="Закрыть">✕</button>
        <div class="tr-bubble-head">${o.icon || ''} <b>${U.esc(o.name)}</b></div>
        <div class="mt-warn">⚠️ <span>${U.esc(o.msg)}</span></div>
        <div class="row" style="gap:8px;margin-top:8px;align-items:center">
          ${o.retry ? `<button class="media-btn sm main" ${o.retry} title="Повторить" aria-label="Повторить">${UI.icon('retry', 18)}</button>` : ''}
          ${o.pick ? '<button class="btn sm" data-act="tr-pick">🔁 Другой переводчик или нейросеть</button>' : ''}
          ${o.url ? `<a class="btn sm ghost" href="${U.esc(o.url)}" target="_blank" rel="noopener">↗ Открыть на сайте</a>` : ''}</div></div>`);
    },
    /** result bubble shown right over the card */
    showBubble(o) {
      const stage = document.querySelector('.stage'); if (!stage) return;
      stage.querySelectorAll('.tr-bubble').forEach(b => b.remove());
      this._bubble = o;
      const [bk, bid] = String(o.by || '').split(':');
      const site = bk === 'tr' && o.text ? Translators.webUrl(bid, o.text, 'no', 'ru') : '';
      stage.insertAdjacentHTML('beforeend', `<div class="tr-bubble ${o.agree ? 'ok' : 'diff'}">
        <button class="tr-bubble-x" data-act="bubble-close" title="Закрыть">✕</button>
        <div class="tr-bubble-head">${o.icon} <b>${U.esc(o.name)}</b>
          <span class="chip ${o.agree ? 'learned' : 'due'}">${o.agree ? '✓ совпадает с карточкой' : '≠ другой вариант'}</span>
          ${site ? `<a class="small" href="${U.esc(site)}" target="_blank" rel="noopener" title="Открыть на сайте" style="margin-left:auto">↗ на сайте</a>` : ''}</div>
        ${o.note ? `<div class="small muted" style="margin:2px 0 4px">ℹ️ ${U.esc(o.note)}</div>` : ''}
        <div class="tr-bubble-res">${UI.rich(o.res)}</div>
        ${(o.alts || []).length ? `<div class="tr-alts"><span class="small muted">Другие значения:</span>${o.alts.map(a => `<span class="tr-alt">${UI.rich(a)}</span>`).join('')}</div>` : ''}
        <div class="tr-forms" data-bforms>${o.formsLoading ? '<div class="small muted"><span class="spinner sm"></span> перевожу каждую форму слова…</div>' : ''}</div>
        <div class="row" style="gap:8px" data-bactions>${o.agree ? '' : '<button class="btn sm primary" data-act="tr-add">➕ Добавить вариант в карточку</button>'}</div>
      </div>`);
    },
    /** 📖 Ordbøkene article -> bubble with Norwegian + (Russian), then into the card */
    async ordbokBubble(card, btn) {
      if (btn) btn.classList.add('busy');
      const stage = document.querySelector('.stage');
      stage.querySelectorAll('.tr-bubble').forEach(b => b.remove());
      stage.insertAdjacentHTML('beforeend', `<div class="tr-bubble ok"><div class="small muted"><span class="spinner sm"></span> Ordbøkene: загружаю статью и перевожу на русский…</div></div>`);
      try {
        const r = await Ordbok.build(card);
        Prov.log(card.id, Prov.entry('tr:ordbok', 'verify', null, `статья «${r.lemma}»: ${r.definitions.length} значений, ${r.expressions.length} выражений`),
          // the translator that translated the article lights up on the card too
          ...Translators.provKeys(r.translatedBy).map(k => Prov.entry(k, 'translate', null, `перевёл статью Ordbøkene «${r.lemma}» на русский`)));
        if (!this.current() || this.current().card.id !== card.id) return;
        this._bubble = { by: 'tr:ordbok', ordbok: r, forms: r.forms.filter(f => f.ru) };
        this.ordbokShow(card, r);
        // machine translators get idioms wrong — a connected AI checks the whole article right away
        if (AI.available() && !(r.translatedBy || []).includes('ai')) this.ordbokRefine(card, document.querySelector('.ob-bubble [data-act="ob-ai"]'), true);
      } catch (e) {
        // never jump to the website on its own: say what happened right here, offer «повторить»; the site only on request
        stage.querySelectorAll('.tr-bubble').forEach(b => b.remove());
        if (!this.current() || this.current().card.id !== card.id) return;
        const notFound = /не найдено/.test(e.message);
        stage.insertAdjacentHTML('beforeend', `<div class="tr-bubble ob-bubble err">
          <button class="tr-bubble-x" data-act="bubble-close" title="Закрыть">✕</button>
          <div class="tr-bubble-head">${Translators.icon('ordbok', 22)} <b>Ordbøkene</b></div>
          <div class="mt-warn">⚠️ <span>${notFound ? U.esc(e.message) + '.' :`Статья не загрузилась: ${U.esc(Ordbok.errText(e))}`}</span></div>
          <div class="row" style="gap:8px;margin-top:8px">${notFound ? '' : `<button class="media-btn sm main" data-act="ob-retry" title="Повторить" aria-label="Повторить">${UI.icon('retry', 18)}</button>`}
            <a class="btn sm ghost" href="${U.esc(Ordbok.siteUrl(card))}" target="_blank" rel="noopener">Открыть на сайте ordbokene.no ↗</a></div></div>`);
      } finally { if (btn) btn.classList.remove('busy'); }
    },
    /** 🤖 AI checks the translation of every line of the Ordbøkene article (idioms especially) */
    async ordbokRefine(card, btn, auto) {
      const b = this._bubble;
      if (!card || !b || !b.ordbok) return;
      if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner sm"></span> ${U.esc(AI.name())} проверяет перевод…`; }
      try {
        const n = await Ordbok.refineAI(b.ordbok);
        Prov.log(card.id, Prov.entry('ai:' + (AI.lastProvider || AI.current()), 'verify', null, `перевод статьи Ordbøkene проверен: исправлено строк — ${n}`));
        if (this._bubble === b && this.current() && this.current().card.id === card.id) this.ordbokShow(card, b.ordbok);
        UI.toast(n ? `${AI.name(AI.lastProvider)}: исправлено строк — ${n}. «Добавить статью» сохранит их в карточку` : `${AI.name(AI.lastProvider)}: перевод верный ✓`, 'good', 4500);
      } catch (e) {
        if (!auto) UI.toast(e.message, 'warn', 5000);
        if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = '🤖 Уточнить перевод'; }
      }
    },
    /** warning under machine translations: they must be double-checked */
    machineWarn(by) { return Translators.machineWarnHtml(by); },
    ordbokShow(card, r) {
        const stage = document.querySelector('.stage'); if (!stage) return;
        // the same three views as everywhere: as is (Russian under the line) / sentence (перевод) / word (перевод)
        const v = Store.settings.exView || 'asis';
        const p = (no, ru) => v === 'word' ? `${this.glossHtml(no, ru || undefined)}${ru ? `<div class="ex-ru">${UI.rich(ru)} ${this.sayRu(ru)}</div>` : ''}`
          : v === 'sent' ? `${UI.rich(no)}${ru ? ` <span class="ex-ru-in">(${U.esc(ru)})</span>` : ''}`
          : `${UI.rich(no)}${ru ? `<div class="ex-ru">${UI.rich(ru)} ${this.sayRu(ru)}</div>` : ''}`;
        const say = no => `<button class="icon-btn sm" data-act="say" data-say="${U.esc(no)}" title="Произнести">🔊</button>`;
        const bar = `<div class="view-bar"><span class="small muted">Перевод:</span><span class="seg-mini ex-view sm">${this.EXV.map(([id, l, t]) => `<button class="${v === id ? 'active' : ''}" data-act="ob-view" data-v="${id}" title="${t}">${l}</button>`).join('')}</span></div>`;
        const trNames = (r.translatedBy || []).map(id => id === 'ai' ? AI.name(Translators.lastAI) : (Translators.LIST[id] || {}).name || id).join(' + ');
        const aiOn = AI.available() && !(r.translatedBy || []).includes('ai');
        stage.querySelectorAll('.tr-bubble').forEach(b => b.remove());
        stage.insertAdjacentHTML('beforeend', `<div class="tr-bubble ok ob-bubble">
          <button class="tr-bubble-x" data-act="bubble-close" title="Закрыть">✕</button>
          <div class="tr-bubble-head">${Translators.icon('ordbok', 24)} <b>${U.esc(Ordbok.title(r))}</b>${trNames ? `<span class="chip">перевод: ${U.esc(trNames)}</span>` : ''}</div>
          ${r.missing ? `<div class="ob-miss">⚠️ Не удалось перевести ${r.missing} ${r.missing === 1 ? 'фразу' : r.missing < 5 ? 'фразы' : 'фраз'} — переводчики сейчас не отвечают.
            <button class="btn sm" data-act="ob-retry">🔄 Перевести ещё раз</button></div>` : ''}
          ${bar}
          <ol class="ob-defs">${r.definitions.map(d => `<li>${d.no ? `<div class="ob-def">${p(d.no, d.ru)} ${say(d.no)}</div>` : ''}
            ${d.examples.map(x => `<div class="ob-ex">• ${p(x.no, x.ru)} ${say(x.no)}</div>`).join('')}</li>`).join('')}</ol>
          ${r.expressions.length ? `<div class="small muted">Выражения (uttrykk):</div>${r.expressions.map(x => `<div class="ob-ex">• ${p(x.no, x.ru)} ${say(x.no)}</div>`).join('')}` : ''}
          ${this._bubble.forms.length ? `<div class="tr-forms"><div class="small muted" style="margin:6px 0 4px">📚 Формы слова:</div>${this._bubble.forms.map(f => `<div class="fg-row"><span class="fg-label">${U.esc(f.label)}</span><span class="fg-no">${UI.rich(f.no)}</span><span class="fg-ru">${UI.rich(f.ru)}</span>
            <button class="icon-btn sm" data-act="say" data-say="${U.esc(f.no)}">🔊</button></div>`).join('')}</div>` : ''}
          <div class="row" style="gap:8px">
            <button class="btn sm primary" data-act="ob-add">➕ Добавить статью в карточку</button>
            ${this._bubble.forms.length ? '<button class="btn sm ai" data-act="tr-save-forms">📚 Формы → в карточку</button>' : ''}
            ${aiOn ? `<button class="btn sm ai" data-act="ob-ai" title="Нейросеть проверит перевод каждой строки, особенно выражений — машинные переводчики переводят их дословно">${AI.icon(AI.current(), 14) || '🤖'} Уточнить перевод (${U.esc(AI.name())})</button>` : ''}
            <button class="btn sm" data-act="ob-copy">📋 Копировать</button>
            ${Listen.hereBtn('.ob-bubble', 'Ordbøkene · ' + r.lemma, 'Слушать статью')}
            <button class="btn sm" data-act="ob-open">↗ Открыть на сайте</button>
          </div>
          ${this.machineWarn(r.translatedBy)}</div>`);
        this.refreshBadges();
        const keys = ['tr:ordbok', ...Translators.provKeys(r.translatedBy)];
        document.querySelectorAll('.card-rail:not(.front-rail)').forEach(rl => keys.forEach(k => Translators.light(rl, Store.card(card.id), [], k)));
    },

    /** 💬 Tatoeba: real sentences NO→RU translated by people */
    async tatoebaBubble(card, btn) {
      if (btn) btn.classList.add('busy');
      const stage = document.querySelector('.stage');
      stage.querySelectorAll('.tr-bubble').forEach(b => b.remove());
      try {
        const ex = await Sources.tatoeba(card);
        Prov.log(card.id, Prov.entry('tr:tatoeba', 'verify', null, `найдено живых примеров: ${ex.length}`));
        if (!this.current() || this.current().card.id !== card.id) return;
        this._bubble = { by: 'tr:tatoeba', examples: ex };
        stage.insertAdjacentHTML('beforeend', `<div class="tr-bubble ok ob-bubble">
          <button class="tr-bubble-x" data-act="bubble-close" title="Закрыть">✕</button>
          <div class="tr-bubble-head">${Translators.icon('tatoeba', 24)} <b>Tatoeba — живые примеры</b><span class="chip">переведены людьми</span></div>
          <div class="ob-defs" style="padding-left:0">${ex.map(x => `<div class="ob-ex">• ${UI.rich(`${x.no} (${x.ru})`)} <button class="icon-btn sm" data-act="say" data-say="${U.esc(x.no)}">🔊</button></div>`).join('')}</div>
          <div class="row" style="gap:8px">
            <button class="btn sm primary" data-act="tt-add">➕ Добавить в примеры карточки</button>
            ${Listen.hereBtn('.ob-bubble', 'Tatoeba — примеры', 'Слушать')}
            <a class="btn sm" href="${Sources.tatoebaUrl(card)}" target="_blank" rel="noopener">↗ Ещё на tatoeba.org</a>
          </div>
          <div class="tiny muted">Предложения: tatoeba.org · лицензия CC BY 2.0 FR</div></div>`);
        this.refreshBadges();
        document.querySelectorAll('.card-rail:not(.front-rail)').forEach(rl => Translators.light(rl, Store.card(card.id), [], 'tr:tatoeba'));
      } catch (e) {
        if (!this.current() || this.current().card.id !== card.id) return;
        this.errBubble({ icon: Translators.icon('tatoeba', 22), name: 'Tatoeba', msg: Ordbok.errText(e), retry: 'data-act="tt-retry"', url: Sources.tatoebaUrl(card) });
      }
      finally { if (btn) btn.classList.remove('busy'); }
    },

    /** forms table inside the bubble: form | translation, + save to card */
    bubbleForms(f) {
      const box = document.querySelector('[data-bforms]'); if (!box) return;
      if (!f || !f.items.length) { box.innerHTML = ''; return; }
      this._bubble.forms = f.items;
      box.innerHTML = `<div class="small muted" style="margin-bottom:4px">📚 Формы слова с переводом:</div>
        ${f.items.map(x => `<div class="fg-row"><span class="fg-label">${window.Gram ? Gram.label(x.label) : U.esc(x.label)}</span><span class="fg-no">${UI.rich(x.no)}</span><span class="fg-ru">${UI.rich(x.ru)}</span>
          <button class="icon-btn sm" data-act="say" data-say="${U.esc(x.no)}" title="Произнести">🔊</button></div>`).join('')}`;
      document.querySelector('[data-bactions]').insertAdjacentHTML('beforeend', '<button class="btn sm ai" data-act="tr-save-forms">📚 Сохранить формы в карточку</button>');
    },
    addVariant(card, by, res) {
      if (!res) return;
      const fresh = Store.card(card.id); if (!fresh) return;
      const ru = `${String(fresh.ru).replace(/[,\s]+$/, '')}, ${res}`;
      Store.updateCard(card.id, { ru, history: Prov.add(fresh, Prov.entry(by, 'translate', { ru: { old: fresh.ru, new: ru } })) });
      UI.toast('Вариант перевода добавлен в карточку', 'good');
      const cur = this.current();
      if (cur && cur.card.id === card.id) { this.renderCard(false); this.flip(true); }
    },
    /** re-draw the glowing "who worked on it" icons on the front side */
    refreshBadges() {
      const cur = this.current(); if (!cur) return;
      const card = Store.card(cur.card.id);
      const front = document.querySelector('.face.front'); if (!front) return;
      front.querySelectorAll('.front-rail').forEach(r => r.remove());
      front.insertAdjacentHTML('beforeend', Translators.activeRailsHtml(card));
      front.classList.toggle('has-rail', Object.keys(Translators.activity(card)).length > 0);
    },

    async onClick(e) {
      const rb = e.target.closest('.card-rail [data-tr], .card-rail [data-ai]');
      if (rb && S) { e.stopPropagation(); this.verifyWith(rb.dataset.ai ? 'ai' : 'tr', rb.dataset.ai || rb.dataset.tr, rb); return; }
      const a = e.target.closest('[data-act]');
      if (!a || !S) return;
      const cur = this.current();
      const card = cur && cur.card;
      switch (a.dataset.act) {
        case 'exit': this.exitAsk(); break;
        case 'undo': this.undo(); break;
        case 'flip': this.flip(); break;
        case 'grade': this.grade(+a.dataset.g); break;
        case 'check': S.answeredType ? this.typeNext() : this.checkTyped(); break;
        case 'override': S.answeredType = 3; this.typeNext(); break;
        case 'ins': { const i = document.querySelector('[data-type]'); if (i && !i.readOnly) { i.setRangeText(a.dataset.ch, i.selectionStart, i.selectionEnd, 'end'); i.focus(); } break; }
        case 'quiz': this.quizAnswer(a); break;
        case 'quiz-next': this.quizNext(); break;
        case 'speak-front': if (card) TTS.speakText(this.sideText(cur, false), S.mode === 'listen' ? 'no' : Store.settings.readMode); break;
        case 'speak-back': if (card) TTS.speakText(this.sideText(cur, true), Store.settings.readMode); break;
        case 'speak-no': if (card) TTS.speakText(card.no, 'no'); break;
        case 'speak-ex': if (card) TTS.speakText(card.example + '\n' + (Store.settings.readMode === 'no' ? '' : card.exampleRu || ''), Store.settings.readMode); break;
        case 'read':
          Store.setSetting('readMode', a.dataset.mode);
          document.querySelectorAll('[data-act="read"]').forEach(b => b.classList.toggle('primary', b === a));
          if (card) this.readVisible();
          break;
        case 'slow': if (card) this.readVisible({ rate: 0.55 }); break;
        case 'speed': {
          const sp = a.dataset.speed;
          document.querySelectorAll('[data-act="speed"]').forEach(b => b.classList.toggle('active', b === a));
          const wasReading = TTS.state() === 'playing';
          TTS.setSpeed(sp);
          if (!wasReading && card) this.readVisible(); // let the user hear the new speed right away
          UI.toast(`Скорость: ${sp === 'slow' ? '🐢 медленно (×0.5, по словам)' : sp === 'fast' ? '🐇 быстро (×1.4)' : `🚶 обычно (×${TTS.currentRate()})`}`, 'good', 1800);
          break;
        }
        case 'stop-tts': case 'tts-stop': TTS.stop(); break;
        case 'tts-toggle': if (TTS.state() === 'idle') this.readVisible(); else TTS.toggle(); break;
        case 'tts-restart': TTS.restart(); break;
        case 'redraw': {
          if (!card) return;
          a.disabled = true; a.innerHTML = '<span class="spinner sm"></span> Рисую…';
          document.querySelectorAll('.card-img').forEach(img => { img.style.opacity = '.35'; });
          try {
            // every press = another variant: 1st the article photo, then photos of related articles (another car…)
            S.redrawN = S.redrawn === card.id ? (S.redrawN || 0) + 1 : 1;
            const url = await Images.redraw(card, { variant: S.redrawN, newScene: S.redrawN > 3 });
            if (!S) return; // the session was closed while the picture was being drawn
            S.redrawn = card.id;
            if (Images.lastSource !== 'ai' && Images.limited()) {
              Guides.images();
            }
            const cur2 = this.current();
            if (cur2 && cur2.card.id === card.id) {
              const imgs = document.querySelectorAll('.card-img, [data-img-wait]');
              if (imgs.length) imgs.forEach(el => { el.outerHTML = `<img class="card-img" src="${U.esc(url)}" alt="">`; });
              else this.renderCard(false);
              if (!S.flipped && !['front', 'both'].includes(Store.settings.imageSide)) this.flip(true);
            }
          } catch (err) { UI.toast(err.message, 'bad'); document.querySelectorAll('.card-img').forEach(img => { img.style.opacity = ''; }); }
          a.disabled = false; a.innerHTML = '🎨 Перерисовать';
          break;
        }
        case 'ordbok': if (card) this.ordbokBubble(card, a); break;
        case 'tt-add': {
          const b = this._bubble;
          if (!card || !b || !b.examples) return;
          const fresh = Store.card(card.id);
          const seen = new Set((fresh.examples || []).map(x => U.norm(x.no)));
          const examples = (fresh.examples || []).concat(b.examples.filter(x => !seen.has(U.norm(x.no))));
          Store.updateCard(card.id, { examples, history: Prov.add(fresh, Prov.entry('tr:tatoeba', 'examples', { examples: { old: Prov.listText(fresh.examples, true), new: Prov.listText(examples, true) } }, 'живые примеры Tatoeba')) });
          UI.toast('Живые примеры добавлены в карточку ✓', 'good');
          this.renderCard(false); this.flip(true);
          break;
        }
        case 'native': {
          if (!card) return;
          a.classList.add('busy');
          // a real speaker's recording exists only for single words (Lingua Libre) — so: the word by a native speaker,
          // then the WHOLE card is read on (pause / stop / restart work as usual)
          const readRest = () => { const c2 = this.current(); if (c2 && c2.card.id === card.id) TTS.speakText(this.sideText(c2, true), Store.settings.readMode || 'all'); };
          try {
            const r = await Sources.playNative(card);
            const au = TTS._audio;
            UI.toast(`🎙 Голос носителя${r.speaker ? ': ' + r.speaker : ''} · Lingua Libre — дальше читаю всю карточку`, 'good', 3000);
            a.classList.remove('busy');
            if (au) {
              await new Promise(res => ['ended', 'error', 'pause'].forEach(ev => au.addEventListener(ev, res, { once: true })));
              if (TTS._audio !== au) break; // stopped by the user
              TTS._audio = null;
            }
            readRest();
          } catch (err) {
            a.classList.remove('busy');
            if (/записи носителя/.test(err.message)) Guides.noNative(Ordbok.bare(card.no)); else UI.toast(err.message, 'warn', 4000);
            readRest();
          }
          break;
        }
        case 'ob-open': if (card) window.open(Ordbok.siteUrl(card), '_blank', 'noopener'); break;
        case 'ob-retry': if (card) this.ordbokBubble(card, a); break;
        case 'tt-retry': if (card) this.tatoebaBubble(card, a); break;
        case 'ob-view': {
          // switch the view of the Ordbøkene article; «word» glosses every word (translated in context, step by step)
          Store.setSetting('exView', a.dataset.v);
          const b = this._bubble;
          if (!card || !b || !b.ordbok) break;
          const draw = () => { if (this._bubble === b && this.current() && this.current().card.id === card.id && document.querySelector('.ob-bubble')) this.ordbokShow(card, b.ordbok); };
          draw();
          if (a.dataset.v === 'word') {
            const r = b.ordbok;
            const lines = [...r.definitions.flatMap(d => [d, ...d.examples]), ...r.expressions].filter(x => x && x.no).map(x => ({ s: x.no, ru: x.ru || undefined }));
            let t = null;
            Translators.onPut = () => { clearTimeout(t); t = setTimeout(draw, 150); };
            try { await this.translateUnits([], lines); } catch (e) { /* glosses stay «…» */ } finally { Translators.onPut = null; clearTimeout(t); }
            draw();
            if (this._lastFail) this.failModal(() => { const w = document.querySelector('.ob-bubble [data-act="ob-view"][data-v="word"]'); if (w) w.click(); });
          }
          break;
        }
        case 'tr-retry': if (card) this.verifyWith(a.dataset.kind, a.dataset.id, a); break;
        case 'tr-pick': if (card) { const rk = a.closest('.tr-bubble'); this.failModal(() => { if (rk) rk.remove(); const c2 = this.current(); if (c2) this.verifyWith('tr', Translators.dictMain() === 'ai' ? 'ai' : Translators.dictMain(), null); }); } break;
        case 'mt-toggle': a.classList.toggle('open'); break;
        case 'mt-recheck': if (card) this.ordbokBubble(card, a); break;
        case 'mt-ok': {
          if (!card) return;
          const fresh = Store.card(card.id);
          Store.updateCard(card.id, { mtWarn: false, history: Prov.add(fresh, Prov.entry('manual', 'verify', null, 'перевод статьи проверен вручную — предупреждение скрыто')) });
          UI.toast('Предупреждение скрыто ✓', 'good', 1800);
          this.renderCard(false); this.flip(true);
          break;
        }
        case 'ob-ai': if (card) this.ordbokRefine(card, a); break;
        case 'youtube': if (card) YouTube.open(Store.card(card.id) || card); break;
        case 'telegram': if (card) Telegram.open(Store.card(card.id) || card); break;
        case 'grammar': if (card) Grammar.open(Store.card(card.id) || card); break;
        case 'card-audio': if (card && window.Subs) Subs.playAudio(Store.card(card.id) || card); break; // 🎬 the real voice from the video
        case 'social': if (card) Social.open(Store.card(card.id) || card); break;
        case 'listen-deck': if (Listen.p) Listen.toggle(); else Listen.open(card && card.deckId); break;
        case 'library': Library.open(card && card.deckId); break;
        case 'copy-card': if (card) this.copyText(this.cardText(Store.card(card.id) || card), 'Текст карточки скопирован'); break;
        case 'ob-copy': if (this._bubble && this._bubble.ordbok) this.copyText(Ordbok.toText(this._bubble.ordbok), 'Статья скопирована'); break;
        case 'ob-add': {
          const b = this._bubble;
          if (!card || !b || !b.ordbok) return;
          const fresh = Store.card(card.id);
          const block = Ordbok.toText(b.ordbok);
          const desc = Ordbok.merge(fresh.description, block);
          const via = (b.ordbok.translatedBy || []).map(id => id === 'ai' ? AI.name(Translators.lastAI) : (Translators.LIST[id] || {}).name || id).join(' + ') || 'без перевода';
          Store.updateCard(card.id, { description: desc, mtWarn: Translators.mtFlag(b.ordbok.translatedBy), history: Prov.add(fresh, Prov.entry('tr:ordbok', 'explain', { description: { old: '', new: block } }, `статья из Ordbøkene с переводом (${via})`)) });
          UI.toast('Статья Ordbøkene добавлена в карточку ✓', 'good');
          this.renderCard(false); this.flip(true);
          break;
        }
        case 'edit': if (card) Views.editCard(card.id, card.deckId, saved => { if (!saved) { S.queue.shift(); S.done++; this.next(true); } else this.renderCard(false); }); break;
        case 'ai-check': if (card) Views.runAiCheck([card], { onDone: () => this.renderCard(false) }); break;
        case 'explain': {
          if (!card) return;
          const box = document.querySelector('[data-explain]');
          if (!AI.available()) { Guides.needAI('Объяснить'); return; }
          box.innerHTML = `<div class="panel explain-box"><span class="spinner sm"></span> ${U.esc(AI.name())} объясняет…</div>`;
          try {
            const txt = await AI.explain(card);
            if (this.current() && this.current().card.id === card.id) {
              box.innerHTML = `<div class="panel explain-box"><div class="row"><h3>${AI.icon(AI.lastProvider, 18)} Объяснение · ${U.esc(AI.name(AI.lastProvider))}</h3><span class="grow"></span>${Listen.hereBtn('.explain-box', 'Объяснение', 'Слушать')}
                <button class="btn sm primary" data-act="explain-save">➕ Добавить в карточку</button></div><div class="content">${UI.rich(txt)}</div></div>`;
              box.dataset.text = txt;
            }
          } catch (err) { box.innerHTML = ''; UI.toast(err.message, 'bad', 6000); }
          break;
        }
        case 'tr-add': {
          if (card && this._bubble) { this.addVariant(card, this._bubble.by, this._bubble.res); this._bubble = null; }
          document.querySelectorAll('.tr-bubble').forEach(b => b.remove());
          break;
        }
        case 'say': TTS.speak(a.dataset.say, a.dataset.lang || 'no'); break;
        case 'ex-view': {
          Store.setSetting('exView', a.dataset.v);
          if (card) { this.redrawExamples(card.id); this.fillExamples(Store.card(card.id) || card); }
          break;
        }
        case 'ex-read': {
          if (card) await this.exRead(Store.card(card.id) || card, +a.dataset.i, a);
          break;
        }
        case 'dir': {
          // switch direction on the fly: front RU -> back NO (with everything), or back again
          const v = a.dataset.dir;
          S.opts.dir = v;
          S.queue.forEach(q => { q.dir = v === 'mix' ? (Math.random() < 0.5 ? 'nr' : 'rn') : v; });
          Store.setSetting('direction', v);
          document.querySelectorAll('.dir-switch button').forEach(b => b.classList.toggle('active', b === a));
          S.flipped = false; TTS.stop();
          this.renderCard(true);
          UI.toast(v === 'rn' ? `${this.trFlag()} → 🇳🇴: вспоминайте норвежское слово` : v === 'nr' ? `🇳🇴 → ${this.trFlag()}: вспоминайте перевод` : '🔀 Вперемешку', 'good', 1800);
          break;
        }
        case 'trlang': {
          // 🇷🇺 / 🇺🇦 / both — right in the session: the card is drawn again in the chosen language
          const v = ['ru', 'uk', 'both'].includes(a.dataset.v) ? a.dataset.v : 'ru';
          Store.setSetting('transLang', v);
          document.querySelectorAll('.tr-seg button').forEach(b => { const on = b.dataset.v === v; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); });
          document.querySelectorAll('.dir-switch button').forEach(b => { const d = b.dataset.dir; if (d === 'nr') b.textContent = `🇳🇴→${this.trFlag()}`; else if (d === 'rn') b.textContent = `${this.trFlag()}→🇳🇴`; });
          S.flipped = false; S.answeredType = null; S.quizDone = false; TTS.stop();
          this.renderCard(false);
          break;
        }
        case 'all-cards': {
          // every card of the session: look through them, «▶ Перейти к этой карте» puts it next
          const ids = (S.allIds || []).filter(x => Store.card(x));
          Views.viewCard(card ? card.id : ids[0], ids, { inSession: true, onJump: cid => this.jumpTo(cid) });
          break;
        }
        case 'reshuffle': {
          if (S.queue.length < 3) { UI.toast('Осталось слишком мало карт, чтобы перемешивать', ''); break; }
          // the card on screen stays; the rest is shuffled
          S.queue = [S.queue[0], ...U.shuffle(S.queue.slice(1))];
          UI.toast('🔀 Оставшиеся карты перемешаны', 'good', 1800);
          break;
        }
        case 'hints': {
          const on = Store.settings.hints === false;
          Store.setSetting('hints', on);
          a.classList.toggle('off', !on);
          a.innerHTML = `${UI.icon(on ? 'bulb' : 'bulbOff', 18)}<span>Подсказки</span>`;
          this.renderCard(false); if (S.flipped) this.flip(true);
          UI.toast(on ? '💡 Подсказки включены' : 'Подсказки выключены — на лицевой стороне только слово', 'good', 2200);
          break;
        }
        case 'layout': {
          const cur3 = Store.settings.studyLayout || 'auto';
          const opts = [
            ['auto', 'Авто', 'по бокам на широком экране, снизу на телефоне'],
            ['sides', 'По бокам', 'озвучка слева · карточка справа'],
            ['left', 'Слева', 'все кнопки в левой колонке'],
            ['right', 'Справа', 'все кнопки в правой колонке'],
            ['bottom', 'Снизу', 'под карточкой, как раньше'],
          ];
          const pop = UI.popover(a, `<div class="pop-title">${UI.icon('layout', 16)} Расположение кнопок</div>
            <div class="lt-grid">${opts.map(([v, t, d]) => `<button class="lt-tile ${cur3 === v ? 'active' : ''}" data-lt="${v}">
              <span class="lt-thumb lt-${v}"><i class="a"></i><i class="c"></i><i class="b"></i></span>
              <span class="lt-text"><b>${t}${cur3 === v ? ' ' + UI.icon('check', 14) : ''}</b><small>${d}</small></span></button>`).join('')}</div>`, 'layout-pop');
          pop.el.onclick = ev => {
            const tile = ev.target.closest('[data-lt]'); if (!tile) return;
            Store.setSetting('studyLayout', tile.dataset.lt);
            const el = document.querySelector('.study'); if (el) el.dataset.layout = tile.dataset.lt;
            pop.close();
            UI.toast('Расположение кнопок сохранено', 'good', 1500);
          };
          break;
        }
        case 'enrich': {
          if (!card) return;
          const ok = await Views.enrichCard(card, a.dataset.kind, a);
          const cur2 = this.current();
          if (ok && cur2 && cur2.card.id === card.id) { this.renderCard(false); this.flip(true); }
          break;
        }
        case 'tr-save-forms': {
          const b = this._bubble;
          if (!card || !b || !(b.forms || []).length) return;
          const fresh = Store.card(card.id);
          if (fresh.forms.length && !(await UI.confirm('В карточке уже есть формы. Заменить их этими?', { ok: '🔄 Заменить' }))) return;
          Store.updateCard(card.id, { forms: b.forms, history: Prov.add(fresh, Prov.entry(b.by, 'forms', { forms: { old: Prov.listText(fresh.forms), new: Prov.listText(b.forms) } })) });
          UI.toast('Формы с переводом сохранены в карточке ✓', 'good');
          this.renderCard(false); this.flip(true);
          break;
        }
        case 'bubble-close': document.querySelectorAll('.tr-bubble').forEach(b => b.remove()); break;
        case 'add-explain': {
          if (!card) return;
          const ok = await Views.addExplanation(card, a);
          const cur2 = this.current();
          if (ok && cur2 && cur2.card.id === card.id) { this.renderCard(false); this.flip(true); }
          break;
        }
        case 'explain-save': {
          const box = document.querySelector('[data-explain]');
          if (card && box.dataset.text) {
            Store.updateCard(card.id, { description: (card.description ? card.description + '\n\n' : '') + box.dataset.text });
            UI.toast('Добавлено в описание', 'good'); box.innerHTML = ''; this.renderCard(false); this.flip(true);
          }
          break;
        }
        case 'again': this.start(Object.assign({}, S.opts, { cardIds: [...S.unknownIds], filter: 'all', size: 0 })); break;
        case 'more': this.start(Object.assign({}, S.opts, { cardIds: null })); break;
        case 'to-deck': S.deckId ? App.go('deck', { id: S.deckId }) : App.go('home'); break;
      }
    },
    onKey(e) {
      if (!S || App.view.name !== 'study' || document.querySelector('.modal-backdrop')) return;
      const inInput = e.target.matches('input, textarea, select');
      if (S.finished) return;
      const k = e.key;
      if (k === 'Escape') { this.exitAsk(); return; }
      if (inInput) return;
      if (S.mode === 'quiz') {
        if (/^[1-4]$/.test(k)) { const b = document.querySelectorAll('.quiz-opt')[+k - 1]; if (b) this.quizAnswer(b); return; }
        if (k === 'Enter' || k === ' ') { e.preventDefault(); this.quizNext(); return; }
      }
      if (k === ' ' || k === 'Enter') { e.preventDefault(); if (S.mode !== 'type') this.flip(); return; }
      if (S.mode === 'flip' || S.mode === 'listen') {
        if (Store.settings.fourButtons && /^[1-4]$/.test(k)) { this.grade(+k); return; }
        // arrows follow the chosen swipe scheme (→/←, ↑/↓, 4 directions…)
        const adir = { ArrowRight: 'right', ArrowLeft: 'left', ArrowUp: 'up', ArrowDown: 'down' }[k];
        if (adir) {
          const a = this.actionFor(adir, true);
          if (a) { e.preventDefault(); if (a.flip) this.flip(); else { this._swipeDir = adir; this.grade(a.g); } }
          return;
        }
        if (k === '2' || k === 'k') { this.grade(3); return; }
        if (k === '1' || k === 'j') { this.grade(1); return; }
      }
      if (k === 's' || k === 'S' || k === 'ы') { if (this.current()) this.readVisible(); }
      if (k === 'p' || k === 'P' || k === 'з') { e.preventDefault(); TTS.toggle(); }
      if (k === 'e' || k === 'E' || k === 'у') { const b = document.querySelector('[data-act="edit"]'); b && b.click(); }
      if (k === 'z' || k === 'Z' || k === 'я' || k === 'Backspace') { e.preventDefault(); this.undo(); }
    },

    /** a session with answers and cards still to go: leaving asks first (an accidental ✕ / Esc / 🏠 must not end it) */
    inProgress() { return !!(S && !S.finished && S.known + S.unknown > 0 && S.queue.length > 0); },
    /** → true when it is fine to leave the session (nothing to lose, or the user said «Закончить» / «Выйти») */
    async leaveAsk(where) {
      if (!this.inProgress()) return true;
      if (this._asking) return false;
      this._asking = true;
      try {
        const r = await UI.askClose({
          title: 'Закончить занятие?', line: 'Ответы уже сохранены.',
          actions: [{ label: where === 'home' ? 'Выйти' : 'Закончить', value: 'end', cls: 'primary' }],
          cancel: 'Продолжить',
        });
        return r === 'end';
      } finally { this._asking = false; }
    },
    /** ✕ / Esc on the study screen: asks while the session is in progress, then shows the results */
    async exitAsk() {
      if (!S) return;
      if (!(await this.leaveAsk('exit'))) return;
      if (S && !S.finished) this.finish(true);
    },

    /* ---------- results ---------- */
    finish(early) {
      if (!S) return;
      TTS.stop();
      const answered = S.known + S.unknown;
      if (early && !answered) { S = null; App.back(); return; }
      S.finished = true;
      const pct = answered ? Math.round(S.known / answered * 100) : 0;
      const area = document.querySelector('[data-area]');
      document.querySelector('.study-top [data-act="undo"]').classList.add('hidden');
      // the session is over: «🗂 Все карты → Перейти» would bring a card back into a finished session (keys/undo off)
      const tools = document.querySelector('.session-tools'); if (tools) tools.classList.add('hidden');
      this.updateTop();
      const unknown = [...S.unknownIds].map(id => Store.card(id)).filter(Boolean);
      area.innerHTML = `<div class="panel results">
        <h2>${pct >= 90 ? 'Fantastisk! 🏆' : pct >= 70 ? 'Bra jobba! 💪' : pct >= 40 ? 'Godt forsøk! 🙂' : 'Øvelse gjør mester! 📚'}</h2>
        <div class="big-ring" style="--p:${pct}"><b>${pct}%</b></div>
        <div class="row" style="justify-content:center;gap:10px">
          <span class="chip learned">✓ Знаю: ${S.known}</span><span class="chip debt">✗ Не знаю: ${S.unknown}</span>
          <span class="chip">⏱ ${U.fmtDuration(Date.now() - S.startedAt)}</span>${early ? '<span class="chip due">сессия прервана</span>' : ''}
        </div>
        ${unknown.length ? `<div class="result-list">${unknown.map(c => `<div class="item"><b>${UI.rich(String(c.no).split('\n')[0].slice(0, 80))}</b><span>${UI.rich(String(this.tr(c)).split('\n')[0].slice(0, 80))}</span></div>`).join('')}</div>` : ''}
        <div class="row" style="justify-content:center;margin-top:18px">
          ${unknown.length ? `<button class="btn bad" data-act="again">🔁 Повторить незнакомые (${unknown.length})</button>` : ''}
          <button class="btn primary" data-act="more">▶ Ещё сессия</button>
          <button class="btn" data-act="to-deck">← ${S.deckId ? 'К колоде' : 'На главную'}</button>
        </div></div>`;
      if (pct >= 80 && answered >= 3) UI.confetti();
    },
    end() { S = null; if (window.FSRSOpt && FSRSOpt.schedule) FSRSOpt.schedule(3000); },
  };

  window.Study = Study;
  // ✎ a tap on a word's (translation) or on the ✎ of a sentence translation — on cards, in the viewer, the textbook…
  // (capture: the card under it must not flip / play)
  document.addEventListener('click', e => {
    const g = e.target.closest && e.target.closest('[data-glfix]');
    if (g) {
      const box = g.closest('[data-gs]'); if (!box) return;
      e.preventDefault(); e.stopPropagation();
      Study.fixGloss(box.dataset.gs, +g.dataset.gk);
      return;
    }
    const t = e.target.closest && e.target.closest('[data-trfix]');
    if (t) { e.preventDefault(); e.stopPropagation(); Study.fixSent(t.dataset.s); return; }
    // 📚 forms table: ✎ / a tap on a form's translation corrects it · «перевести» makes a missing one
    const ff = e.target.closest && e.target.closest('[data-forms-box] [data-ffix], [data-forms-box] [data-fftr]');
    if (ff) {
      e.preventDefault(); e.stopPropagation();
      if (ff.hasAttribute('data-fftr')) { const b = ff.closest('[data-forms-box]'); if (b) Study.fillForms(b.dataset.cid, true); }
      else Study.editFormTr(ff);
    }
  }, true);
  // Esc in a form-translation editor closes only the editor (windows close on Esc in the capture phase of document)
  window.addEventListener('keydown', e => {
    const ed = e.key === 'Escape' && e.target && e.target.closest && e.target.closest('.fg-editing');
    if (!ed) return;
    e.preventDefault(); e.stopPropagation();
    const b = ed.querySelector('[data-ffcancel]'); if (b) b.click();
  }, true);
})();
