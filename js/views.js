/* ============ Views: home, deck, editor, import/export, AI review, stats, settings ============ */
(function () {
  const $ = U.$;
  const DIRS = [['nr', '🇳🇴 → 🇷🇺'], ['rn', '🇷🇺 → 🇳🇴'], ['mix', '🔀 Вперемешку']];
  const MODES = [['flip', '🃏 Карточки'], ['type', '⌨️ Ввод'], ['quiz', '✅ Тест'], ['listen', '🎧 На слух']];
  const FILTERS = [['smart', '🧠 Умное повторение'], ['all', 'Все'], ['new', 'Новые'], ['debt', 'Долговые'], ['learning', 'Изучаю'], ['learned', 'Выученные'], ['leech', '🐛 Трудные']];
  const SIZES = [[10, '10'], [20, '20'], [50, '50'], [100, '100'], [0, 'Все']];
  /** 🇷🇺 / 🇺🇦 translation language (Store.settings.transLang) */
  const TRLANGS = [['ru', '🇷🇺 Русский'], ['uk', '🇺🇦 Українська'], ['both', '🇷🇺+🇺🇦 Оба']];
  const trFlag = () => (window.Study ? Study.trFlag() : '🇷🇺');
  /** the direction labels follow the translation language: 🇳🇴 → 🇺🇦 … */
  const dirsNow = () => [['nr', `🇳🇴 → ${trFlag()}`], ['rn', `${trFlag()} → 🇳🇴`], ['mix', '🔀 Вперемешку']];

  const Views = { DIRS, TRLANGS, MODES, FILTERS, SIZES, sel: new Set(), deckFilter: 'all', deckSearch: '', deckLimit: 120 };

  /** forms/examples <-> editable lines "label | no | ru (| note)" */
  function formsToLines(arr, withNote) {
    return (arr || []).map(x => [x.label || '', x.no || '', x.ru || ''].concat(withNote ? [x.note || ''] : []).join(' | ').replace(/( \| )+$/, '')).join('\n');
  }
  /** synonyms <-> lines "norsk | перевод | чем отличается" */
  function synToLines(arr) { return (arr || []).map(s => [s.no || '', s.ru || '', s.note || ''].join(' | ').replace(/( \| )+$/, '')).join('\n'); }
  function linesToSyn(text) {
    return String(text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const p = l.split('|').map(s => s.trim());
      return { no: p[0], ru: p[1] || '', note: p.slice(2).join(' | ') };
    }).filter(s => s.no);
  }
  function linesToForms(text) {
    return String(text || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const p = l.split('|').map(s => s.trim());
      if (p.length === 1) return { label: '', no: p[0], ru: '' };
      if (p.length === 2) return { label: '', no: p[0], ru: p[1] };
      const o = { label: p[0], no: p[1], ru: p[2] || '' };
      if (p[3]) o.note = p.slice(3).join(' | ');
      return o;
    }).filter(x => x.no);
  }

  /* =====================================================================
   * DELETE SAFETY: confirm before, "↶ Вернуть" right after, 🗑 trash for 30 days
   * ===================================================================== */
  Views.afterDelete = function (entry, what) {
    if (!entry) return;
    UI.toastAction(`${what} — в корзине 30 дней`, '↶ Вернуть', () => {
      const n = Store.restoreTrash(entry.id);
      UI.toast(entry.type === 'deck' ? `Колода «${entry.deck.name}» возвращена (${U.cards(n)})` : `Возвращено: ${U.cards(n)}`, 'good');
      App.render();
    });
  };
  Views.trashDialog = function () {
    const draw = () => {
      const items = Store.trash().slice().sort((a, b) => b.t - a.t);
      const daysLeft = t => Math.max(0, Math.ceil((t + Store.TRASH_DAYS * U.DAY - Date.now()) / U.DAY));
      return items.length ? items.map(e => `<div class="trash-item">
          <span style="font-size:22px">${e.type === 'deck' ? '🗂' : '🃏'}</span>
          <div class="info"><b>${e.type === 'deck' ? `Колода «${U.esc(e.deck.name)}» · ${U.cards(e.cards.length)}` : U.cards(e.cards.length)}</b>
            <div class="small muted">${U.esc(e.cards.slice(0, 4).map(c => String(c.no).split('\n')[0].slice(0, 30)).join(', '))}${e.cards.length > 4 ? '…' : ''}</div>
            <div class="tiny muted">удалено ${new Date(e.t).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · осталось ${daysLeft(e.t)} дн.</div></div>
          <button class="btn sm primary" data-restore="${e.id}">↶ Вернуть</button>
          <button class="btn sm ghost" data-forever="${e.id}">Удалить навсегда</button>
        </div>`).join('') : '<div class="empty"><div class="big">🗑</div><p>Корзина пуста</p></div>';
    };
    const m = UI.modal({
      title: '🗑 Корзина', cls: '',
      body: `<p class="small muted" style="margin:0">Удалённые карточки и колоды хранятся здесь ${Store.TRASH_DAYS} дней — их можно вернуть.</p><div class="col" data-list>${draw()}</div>`,
      foot: '<button class="btn ghost" data-close2>Закрыть</button>',
    });
    m.$('[data-close2]').onclick = () => m.close();
    m.el.addEventListener('click', async e => {
      const r = e.target.closest('[data-restore]');
      const f = e.target.closest('[data-forever]');
      if (r) { const n = Store.restoreTrash(r.dataset.restore); UI.toast(`Возвращено: ${U.cards(n)}`, 'good'); m.$('[data-list]').innerHTML = draw(); App.render(); }
      if (f && await UI.confirm('Удалить навсегда? Вернуть будет уже нельзя.', { danger: true, ok: 'Удалить навсегда' })) {
        Store.deleteTrashForever(f.dataset.forever); m.$('[data-list]').innerHTML = draw();
      }
    });
  };

  /* =====================================================================
   * 🧭 SECTIONS (v210, design/declutter.html): the big tiles on home, the side menu and the phone menu open the same
   * windows — Mobile.sheet: a centred window on a computer, a sheet on a phone (Back / Esc / pull down close it).
   * Nothing was removed: every former «Быстрое действие» has its row in one of these windows.
   * ===================================================================== */
  const SVG = (d, cls = 'sx-svg') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
  const SEC_SVG = {
    // the round play button in the app's purple→pink (gradient #nkg-play lives in index.html)
    video: () => SVG('<circle cx="12" cy="12" r="10.5" fill="url(#nkg-play)"/><path d="M10 8.2v7.6l6-3.8z" fill="#fff"/>', 'sx-svg sx-fill'),
    radio: () => SVG('<rect x="3" y="8.5" width="18" height="12" rx="3"/><path d="M7.5 8.5 17 3.8"/><circle cx="15.8" cy="14.5" r="2.9"/><path d="M6.8 12.8h3.6M6.8 16.2h3.6"/>'),
    read: () => SVG('<path d="M12 6.6C10 5 7.3 4.4 3.5 4.6v13.6c3.8-.2 6.5.4 8.5 2 2-1.6 4.7-2.2 8.5-2V4.6C16.7 4.4 14 5 12 6.6z"/><path d="M12 6.6v13.6"/>'),
    drills: () => SVG('<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>'),
    telegram: s => (window.Telegram && Telegram.TG_SVG ? Telegram.TG_SVG(s || 20) : '✈️'),
  };
  Views.SEC_SVG = SEC_SVG;
  /** 🤖 v212: the app's one brand robot (js/app.js App.robotSvg) wherever an AI / neural network is meant */
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖');
  Views.BOT = BOT;
  /** AI.icon (js/ai.js) draws a 🤖 emoji for the subscriptions without a site logo — here it is the brand robot too */
  const aiIco = (id, size) => { const h = window.AI && AI.icon ? AI.icon(id, size) : ''; return !h || />🤖</.test(h) ? BOT(size) : h; };
  const CHEV = '<svg class="ico sx-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  /** every place a row / tile / chip can open (a missing module is skipped quietly) */
  const GO = {
    youtube: () => YouTube.open(null), nrk: () => NrkTV.open(), subs: () => Subs.open(), nrkradio: () => NrkRadio.open(),
    books: () => Books.open(), bookshelf: () => Views.openLibrary(), news: () => News.open(), textbook: () => Textbook.open(),
    telegram: () => Telegram.open(null, 'channels'),
    drills: () => Drills.open(), phrases: () => Library.open(), create: () => Create.open(), ordtr: () => OrdTrainer.open('hub'),
    gramref: () => GramRef.open(''), speech: () => Speech.open(), klokka: () => Klokka.open(), dialogs: () => Dialogs.open(),
    exams: () => Exams.open(), levels: () => Levels.open(), prove: () => Prove.open(),
    examprep: a => Views.examPrep().then(X => X.open((a && a.xp) || 'hub')).catch(() => UI.toast('«Подготовка к экзамену» не загрузилась — проверьте интернет', 'warn')),
    'cont-book': a => Reader.openBook(a.id, { cont: true }), 'cont-ac': a => AudioCourse.play(a.cid),
    // v212: 🌅 фраза дня, 🎯 тест уровня, 🧪 тренировка Norskprøven, ⭐ очки, 📈 «Мой прогресс»
    phraseday: () => PhraseDay.open(), leveltest: () => LevelTest.open(), examtr: () => ExamTrainer.open(), xp: () => XP.open(),
    progress: () => (App.goAsk ? App.goAsk('progress') : App.go('progress')),
    // 🎓 «Учить по материалам» (js/learnby.js, #/learn)
    learn: () => (App.goAsk ? App.goAsk('learn') : App.go('learn')),
  };
  /** 🎓 js/examprep.js + css/examprep.css, the first time «Подготовка к экзамену» is opened (the same version as this file) */
  let xpP = null;
  Views.examPrep = function () {
    if (window.ExamPrep) return Promise.resolve(window.ExamPrep);
    if (xpP) return xpP;
    const q = (((document.querySelector('script[src*="js/views.js"]') || {}).src || '').match(/\?v=[^&#]+/) || [''])[0];
    if (!document.querySelector('link[href*="css/examprep.css"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/examprep.css' + q; document.head.appendChild(l); }
    xpP = new Promise((res, rej) => {
      const sc = document.createElement('script'); sc.src = 'js/examprep.js' + q; sc.async = true;
      sc.onload = () => (window.ExamPrep ? res(window.ExamPrep) : rej(new Error('no exam prep')));
      sc.onerror = () => rej(new Error('no exam prep'));
      document.head.appendChild(sc);
    });
    xpP.catch(() => { xpP = null; });
    return xpP;
  };
  Views.go = function (k, a = {}) {
    const f = GO[k]; if (!f) return;
    try { f(a); } catch (e) { console.warn('open', k, e); UI.toast('Этот раздел сейчас не открылся — попробуйте ещё раз', 'warn'); }
  };
  const sxRow = (k, ico, title, sub = '', extra = '') => `<button type="button" class="m-row sx-row" data-sx="${k}" ${extra}><span class="m-place-i sx-i" aria-hidden="true">${ico}</span><span class="m-row-t"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span>${CHEV}</button>`;
  const sxGroup = (title, rows, cls = '') => `${title ? `<div class="m-sec-t sx-gt">${title}</div>` : ''}<div class="m-list sx-list ${cls}">${rows.join('')}</div>`;
  /** a window of rows: a tap closes it, then opens the place (a window never opens on top of this one) */
  function sxSheet(title, body, o = {}) {
    if (!window.Mobile || !Mobile.sheet) { UI.modal({ title, body, cls: 'sx-modal' }); return null; }
    return Mobile.sheet(Object.assign({ title, body, cls: 'sx-sheet ' + (o.cls || ''), detent: o.detent || 'medium',
      onClick(e, sh) {
        const b = e.target.closest('[data-sx]'); if (!b || b.disabled) return;
        const k = b.dataset.sx, data = Object.assign({}, b.dataset);
        sh.close();
        setTimeout(() => { if (o.run) o.run(k, data, b); else Views.go(k, data); }, 40);
      } }, o.sheet || {}));
  }
  Views.sxSheet = sxSheet; Views.sxRow = sxRow; Views.sxGroup = sxGroup;

  /** «▶ Смотреть видео» · «📖 Читать» · «🏋️ Упражнения» windows; «📻 Радио» and «Telegram» open at once */
  Views.section = function (k) {
    if (k === 'radio') return Views.go('nrkradio');
    if (k === 'telegram') return Views.go('telegram');
    if (k === 'looks') return window.AppThemes || window.ArtCards ? Views.looksSheet(App.view && App.view.name === 'deck' ? App.view.params.id : null) : App.go('settings');
    if (k === 'decks') {
      const at = () => { const el = document.getElementById('my-decks'); if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); };
      if (App.view.name !== 'home') { App.goAsk('home'); setTimeout(at, 420); } else at();
      return null;
    }
    if (k === 'video') return sxSheet(`${SEC_SVG.video()} Смотреть видео`, sxGroup('', [
      sxRow('youtube', window.YouTube ? YouTube.YT_SVG(22) : '▶️', 'YouTube', 'каналы учителей норвежского, поиск по слову'),
      sxRow('nrk', '📺', 'NRK TV', 'сериалы, новости, детские передачи — с субтитрами и переводом'),
      sxRow('subs', '🎬', 'Своё видео с субтитрами', 'файл с компьютера или телефона + субтитры .srt — на двух языках'),
    ]) + '<p class="m-note">Нажмите на слово в субтитрах — пауза, перевод и «В карточку».</p>', { cls: 'sx-video' });
    if (k === 'read') {
      const cont = contItems();
      return sxSheet(`${SEC_SVG.read()} Читать`, (cont.length ? sxGroup('', cont.map(x => sxRow(x.act, x.ico, U.esc(x.title.replace(/^Продолжить [^:]+: /, 'Продолжить: ')), U.esc(x.sub), x.act === 'cont-book' ? `data-id="${U.esc(x.attr.match(/data-id="([^"]*)"/)[1])}"` : `data-cid="${U.esc(x.attr.match(/data-cid="([^"]*)"/)[1])}"`)), 'sx-cont') : '')
        + sxGroup(cont.length ? 'Что почитать' : '', [
          sxRow('books', '📚', 'Книги', 'читать и слушать: выделили слово — карточка'),
          sxRow('bookshelf', '🗂', 'Библиотека', 'всё, что вы добавили: книги, аудиокниги, аудиокурсы'),
          sxRow('news', '📰', 'Новости', 'Klar Tale, NRK и Supernytt — простым языком'),
          sxRow('textbook', '📘', 'Мой учебник', 'страница или новые слова → карточки'),
        ], 'sx-two'), { cls: 'sx-read' });
    }
    if (k === 'drills') return sxSheet(`${SEC_SVG.drills()} Упражнения`,
      sxGroup('Слова и грамматика', [
        sxRow('drills', '🏋️', 'Упражнения', 'вставьте слово, формы слов, следующие частые слова'),
        sxRow('phrases', '🃏', 'Выражения', 'устойчивые фразы и идиомы с переводом'),
        sxRow('create', '💬', 'Что выучить?', 'напишите тему — получите карточки'),
        sxRow('ordtr', '🧩', 'Порядок слов и вопросы', 'соберите предложение, «å или нет?»'),
        sxRow('gramref', '📗', 'Справочник грамматики', 'правило, таблица форм и примеры A1–B1'),
      ])
      + sxGroup('Говорить и понимать', [
        window.PhraseDay ? sxRow('phraseday', '🌅', 'Фраза дня', 'одна живая фраза в день: послушать, разобрать, сказать самому') : '',
        sxRow('speech', '🗣', 'Произношение и диктант', 'скажите вслух — приложение проверит'),
        sxRow('klokka', '🕐', 'Время · Klokka', '«halv fire» — это 3:30'),
        sxRow('dialogs', '🎭', 'Диалоги по ролям', 'магазин, врач, NAV — играйте свою роль'),
      ])
      + '<div class="sx-note"><span aria-hidden="true">💡</span><span><b>Почему «Произношение» здесь, а не в «Радио»?</b> Радио — это слушать. Произношение — тренировка, где говорите вы сами.</span></div>'
      + sxGroup('Проверить себя', [
        sxRow('examprep', '🎓', 'Подготовка к экзамену', 'конструктор ответа, темы, пробный устный экзамен, маршруты'),
        window.ExamTrainer ? sxRow('examtr', '🧪', 'Тренировка Norskprøven', 'чтение, аудирование, письмо и устная часть — с таймером и баллами') : '',
        window.LevelTest ? sxRow('leveltest', '🎯', 'Тест уровня', '10–20 вопросов — и вы знаете свой уровень, от A1 до B2') : '',
        sxRow('exams', '🏛', 'Экзамены: официально', 'Norskprøven и тест на гражданство — пробные задания на сайтах'),
        sxRow('levels', '🪜', 'Уровни A1–C2', 'колоды по темам для каждого уровня'),
        sxRow('prove', '📝', 'Тесты по главам', 'аудирование, грамматика и письмо — с баллами'),
      ]), { cls: 'sx-drills', detent: 'large' });
    return null;
  };

  /** the big tiles under «▶ Учить» */
  function sectionTilesHtml() {
    const chip = (attr, label) => `<button type="button" class="mchip" ${attr}>${label}</button>`;
    return `<section class="mgrid" aria-label="Разделы: видео, радио, чтение, Telegram, упражнения">
      <div class="mt video">
        <button type="button" class="mt-main" data-act="sec-video" aria-label="Смотреть видео: YouTube, NRK TV, своё видео с субтитрами" title="YouTube, NRK TV и своё видео с субтитрами"></button>
        <div class="playbig" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6.5 4.2v15.6L19.5 12z" fill="url(#nkg-play)" stroke="url(#nkg-play)" stroke-width="2" stroke-linejoin="round"/></svg></div>
        <h3>Смотреть видео</h3>
        <p>Норвежские передачи и ролики с двойными субтитрами — любое слово сразу в карточку</p>
        <div class="mchips">${chip('data-act="youtube" title="Видео учителей норвежского с субтитрами и переводом"', `${window.YouTube ? YouTube.YT_SVG(16) : ''} YouTube`)}${chip('data-act="nrk" title="Передачи NRK TV с субтитрами и переводом"', '📺 NRK TV')}${chip('data-act="subs" title="Ваше видео или аудио + файл субтитров"', '🎬 Своё видео')}</div>
      </div>
      ${Views.learn ? `<div class="mt learn">
        <button type="button" class="mt-main" data-act="learn" aria-label="Учить по материалам: видео, радио, книга, песня — по частям" title="Фильм, передача, песня или книга — по частям, с колодой и пятью шагами"></button>
        <span class="mt-deco" aria-hidden="true">🎓</span>
        <div class="tops"><span class="mi mi-learn" aria-hidden="true">🎓</span><div><h3>Учить по материалам</h3><p>фильм, передача, песня или книга — по частям: колода с голосом героев и пять шагов до «на слух»</p></div></div>
        <div class="mchips">${chip('data-act="learn-video" title="NRK TV, YouTube, своё видео, Telegram"', '🎬 По видео')}${chip('data-act="learn-radio" title="NRK Радио, подкасты, аудио из Telegram"', '📻 По радио')}${chip('data-act="learn-book" title="Книги, учебник, новости"', '📖 По книге')}${chip('data-act="learn-song" title="Песня, которую узнал плеер"', '🎵 По песне')}</div>
      </div>` : ''}
      <div class="mt radio">
        <button type="button" class="mt-main" data-act="nrkradio" aria-label="Радио: NRK в прямом эфире и подкасты" title="NRK Радио: прямой эфир и подкасты — субтитры создаст приложение"></button>
        <span class="mt-deco" aria-hidden="true">${SEC_SVG.radio()}</span>
        <div class="tops"><span class="mi" aria-hidden="true">${SEC_SVG.radio()}</span><div><h3>Радио</h3><p>NRK в прямом эфире и подкасты — с субтитрами</p></div></div>
      </div>
      <div class="mt read">
        <button type="button" class="mt-main" data-act="sec-read" aria-label="Читать: книги, библиотека, новости" title="Книги, аудиокниги и новости простым языком"></button>
        <span class="mt-deco" aria-hidden="true">${SEC_SVG.read()}</span>
        <div class="tops"><span class="mi" aria-hidden="true">${SEC_SVG.read()}</span><div><h3>Читать</h3><p>книги, аудиокниги и новости простым языком</p></div></div>
        <div class="mchips">${chip('data-act="books"', '📚 Книги')}${chip('data-act="bookshelf"', '🗂 Библиотека')}${chip('data-act="news"', '📰 Новости')}</div>
      </div>
      <div class="mt tg">
        <button type="button" class="mt-main" data-act="telegram" aria-label="Telegram: каналы о норвежском" title="Норвежские каналы в Телеграме — читать прямо здесь"></button>
        <span class="mt-deco" aria-hidden="true">${SEC_SVG.telegram(120)}</span>
        <div class="tops"><span class="mi mi-tg" aria-hidden="true">${SEC_SVG.telegram(30)}</span><div><h3>Telegram</h3><p>каналы о норвежском — читать прямо здесь</p></div></div>
      </div>
      <div class="mt drill">
        <button type="button" class="mt-main" data-act="sec-drills" aria-label="Упражнения: грамматика, время, произношение, экзамены" title="Грамматика, время, произношение, экзамены"></button>
        <span class="mt-deco" aria-hidden="true">${SEC_SVG.drills()}</span>
        <div class="tops"><span class="mi" aria-hidden="true">${SEC_SVG.drills()}</span><div><h3>Упражнения</h3><p>грамматика, время, произношение, экзамены</p></div></div>
        <div class="mchips">${chip('data-klokka-open title="Время по-норвежски: урок с часами и игры"', '🕐 Klokka')}${chip('data-speech-open title="Проверка произношения и диктант"', '🗣 Произношение')}${chip('data-act="examprep" title="Подготовка к экзамену Norskprøven: ответы, темы, пробный экзамен"', '🎓 Экзамен')}</div>
      </div>
    </section>
    `;
  }

  /** v211: the three wide plaques of the footer — the navigator, the look of the app, «Поделиться» (one height, one style).
   *  Own attributes (data-appnav / data-foot), so a screen's own click handler (the study screen's too) never sees them. */
  Views.plaquesHtml = function () {
    const p = (attrs, cls, ico, t, sub) => `<button type="button" class="hp-card ${cls}" ${attrs}><span class="hp-i" aria-hidden="true">${ico}</span><span class="hp-t"><b>${t}</b><small>${sub}</small></span><span class="hp-go" aria-hidden="true">›</span></button>`;
    return [
      window.AppNav ? p('data-appnav aria-haspopup="dialog" title="Экскурсия по экрану, помощь по разделам и быстрые пути"', 'hp-nav', '🧭', 'Навигатор по приложению', 'экскурсия по экрану, помощь и быстрые пути') : '',
      window.AppThemes || window.ArtCards ? p('data-foot="looks" aria-haspopup="dialog" title="Темы приложения и вид карточек"', 'hp-looks', '🎨', 'Оформление', 'викинги, тролли, праздники…') : '',
      window.ShareApp ? p('data-foot="share" aria-haspopup="dialog" title="Ссылка на приложение — другу, в группу, в соцсети"', 'hp-share', ShareApp.SHARE_SVG(22), 'Поделиться приложением', 'с друзьями учить веселее') : '',
    ].join('');
  };
  /** 🦶 one footer for every screen (home, deck, statistics, settings, account, levels, the study screen): the app shell
   *  (App.render) puts it under the screen's content; it follows the content (not fixed) and keeps the content's width */
  Views.footHtml = function () {
    const cards = Views.plaquesHtml();
    return cards ? `<footer class="app-foot hp" data-app-foot aria-label="Навигатор, оформление и «Поделиться»">
        <p class="hp-lead">Нравится Norsk Kort? Расскажите друзьям <span aria-hidden="true">💙</span></p>
        <div class="hp-grid" style="--hp-n:${(cards.match(/class="hp-card/g) || []).length}">${cards}</div>
        ${window.About && window.APP ? `<div class="ab-foot-row"><button type="button" class="ab-foot-link" data-about aria-haspopup="dialog" title="Версия, что нового, проверка обновлений, лицензии">${window.NavIcons ? NavIcons.icon('info', 18) : ''}<span>О приложении · <b>${U.esc(APP.name)} ${U.esc(APP.version)}</b> · сборка ${U.esc(APP.build)}</span></button></div>` : ''}
      </footer>` : '';
  };
  let footMo = null, footRo = null, footRoEl = null;
  Views.mountFoot = function (root, view) {
    root = root || document.getElementById('view'); if (!root) return;
    const put = () => {
      let f = root.querySelector(':scope > [data-app-foot]');
      if (f && f === root.lastElementChild) return f;
      if (!f) { const t = document.createElement('div'); t.innerHTML = Views.footHtml(); f = t.firstElementChild; if (!f) return null; }
      root.appendChild(f); // a screen that redraws itself (statistics, the study screen) — the footer stays last
      return f;
    };
    const f = put();
    if (!footMo) {
      footMo = new MutationObserver(() => { if (document.body.dataset.view && !root.querySelector(':scope > [data-app-foot]:last-child')) put(); syncW(); });
      footMo.observe(root, { childList: true });
    }
    // the study screen: the footer is as wide as the study grid (card + side panels), not wider
    function syncW() {
      const ft = root.querySelector(':scope > [data-app-foot]'); if (!ft) return;
      const st = document.body.dataset.view === 'study' ? root.querySelector(':scope > .study') : null;
      ft.style.maxWidth = st ? Math.round(st.getBoundingClientRect().width) + 'px' : '';
      if (st === footRoEl) return;
      footRoEl = st;
      if (!window.ResizeObserver) return;
      if (!footRo) footRo = new ResizeObserver(() => syncW());
      footRo.disconnect(); if (st) footRo.observe(st);
    }
    syncW();
    return f;
  };
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-foot]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const v = window.App && App.view ? App.view : { name: 'home', params: {} };
    if (b.dataset.foot === 'looks') Views.looksSheet(v.name === 'deck' ? v.params.id : null);
    else if (b.dataset.foot === 'share' && window.ShareApp) ShareApp.open();
  }, true);
  /** 🎨 «Оформление»: one window, two parts — the look of the cards (js/artcards.js) and the theme of the whole app (AppThemes) */
  Views.looksSheet = function (deckId) {
    const d = deckId && Store.deck(deckId);
    let art = '', theme = '';
    try { const th = window.ArtCards && ArtCards.THEMES[(Store.Safe && Store.Safe.art ? Store.Safe.art(Store.settings.art) : Store.settings.art || {}).theme || 'fjord']; if (th) art = `${th.icon} ${th.name}`; } catch (e) { /* default */ }
    try { const c = AppThemes.current(), t = AppThemes.get(c.id); if (t) theme = `${t.emoji} ${t.name}`; } catch (e) { /* no themes */ }
    const dark = document.documentElement.dataset.theme === 'dark';
    const appRows = window.AppThemes ? [
      sxRow('lk-app', '🎨', 'Темы приложения', `${theme ? `сейчас: ${U.esc(theme)} · ` : ''}викинги, тролли, Лофотены, праздники…`),
      sxRow('lk-mode', dark ? '🌞' : '🌙', dark ? 'Светлая тема' : 'Тёмная тема', 'переключить сразу, без лишних окон'),
    ] : [];
    const cardRows = window.ArtCards ? [
      sxRow('lk-studio', '🃏', 'Шаблоны карточек, шрифты и цвета', `${art ? `сейчас: ${U.esc(art)} · ` : ''}Викинги, Тролли, Ставкирка, праздники…`),
      ...(d ? [sxRow('lk-gallery', '🖼', ArtCards.deckOn(d) ? 'Колода уже в художественном виде' : 'Художественный вид колоды', 'картинка во всю карточку, крупное слово, цвет рода')] : []),
    ] : [];
    return sxSheet('🎨 Оформление', (cardRows.length ? sxGroup('Вид карточек', cardRows) : '') + (appRows.length ? sxGroup('Тема приложения', appRows) : '')
      + '<p class="m-note">Шаблон карточек меняет и карточки в занятии. Тема приложения — фон, цвета и праздничные украшения везде.</p>', { cls: 'sx-looks', run: k => {
      if (k === 'lk-app') return AppThemes.open();
      if (k === 'lk-mode') { if (AppThemes.setMode) AppThemes.setMode(dark ? 'light' : 'dark'); else { Store.setSetting('theme', dark ? 'light' : 'dark'); App.applyTheme(); } if (App.view.name === 'settings') App.render(); return; }
      if (k === 'lk-gallery' && d) { Store.updateDeck(d.id, { art: 'on' }); if (App.view.name === 'deck' && App.view.params.id === d.id) App.render(); else App.go('deck', { id: d.id }); return; }
      if (k === 'lk-studio') { const b = document.createElement('button'); b.type = 'button'; b.hidden = true; b.dataset.artAct = 'studio'; document.body.appendChild(b); b.click(); b.remove(); }
    } });
  };

  /** 🖨 «Печать и файлы» (js/printx.js): a deck, all decks (null) or only the chosen cards */
  Views.printDeck = function (id, ids) {
    if (!window.PrintX) { UI.toast('Печать ещё загружается — попробуйте через секунду'); return null; }
    try { return ids && ids.length ? PrintX.deck(id, { cardIds: ids, filter: 'selected' }) : PrintX.deck(id); }
    catch (e) { UI.toast(U.niceErr ? U.niceErr(e, 'Печать') : 'Печать: не получилось — попробуйте ещё раз', 'bad'); return null; }
  };

  /** ⋯ next to «Мои колоды»: everything about all decks at once */
  Views.decksMore = function () {
    const n = Store.decks().length, trash = Store.trashCount();
    return sxSheet('Мои колоды', sxGroup('', [
      sxRow('d-create', '➕', 'Создать карточки', 'тема, список слов, фото, файл, готовые колоды'),
      sxRow('d-new', '🗂', 'Новая колода', 'название и обложка'),
      sxRow('d-import', '📥', 'Импорт из файла', 'Excel, Anki, CSV, PDF… — или перетащите файл в окно'),
    ]) + sxGroup('Поделиться и сохранить', [
      sxRow('d-share', ShareApp.SHARE_SVG(18), 'Поделиться колодами', 'одной, несколькими или всеми', n ? '' : 'disabled'),
      ...(window.PrintX ? [sxRow('d-print', '🖨', 'Печать и файлы', 'все колоды: таблица, карточки для вырезания, Excel, Word', n ? '' : 'disabled')] : []),
      sxRow('d-export', '📤', 'Экспорт в файл', 'все карточки — для другого приложения или на память'),
    ]) + sxGroup('', [sxRow('d-looks', '🎨', 'Оформление', 'темы приложения и вид карточек'),
      sxRow('d-trash', '🗑', trash ? `Корзина (${trash})` : 'Корзина', `удалённое хранится ${Store.TRASH_DAYS} дней — можно вернуть`)]), {
      run: k => ({ 'd-create': () => Create.open(), 'd-new': () => Views.deckEditor(null, d => App.go('deck', { id: d.id })), 'd-import': () => App.pickFiles(),
        'd-share': () => Share.open(), 'd-export': () => Views.exportDialog(null), 'd-print': () => Views.printDeck(null), 'd-trash': () => Views.trashDialog(), 'd-looks': () => Views.looksSheet(null) })[k](),
    });
  };

  /* 👋 one small hint for people who knew the old screens: everything is still here, just sorted (dismissible, never blocks) */
  const HINT_KEY = 'nk-declutter-hint';
  const hintSeen = w => { try { return !!(JSON.parse(localStorage.getItem(HINT_KEY) || '{}') || {})[w]; } catch (e) { return true; } };
  const hintDone = w => { try { const o = JSON.parse(localStorage.getItem(HINT_KEY) || '{}') || {}; o[w] = Date.now(); localStorage.setItem(HINT_KEY, JSON.stringify(o)); } catch (e) { /* private mode */ } };
  function hintHtml(where) {
    if (hintSeen(where) || (window.Help && Help.touring)) return '';
    const txt = where === 'deck'
      ? 'Импорт, экспорт, «Поделиться», картинки, «Выбрать» и «Удалить колоду» — в <b>«⋯ Ещё»</b>. Режим, направление и сколько карт — в <b>«✎ Изменить»</b>.'
      : 'Видео, радио, книги, Telegram и упражнения — в больших плитках ниже. Новая колода, импорт и фото — в <b>«➕ Создать карточки»</b>, экспорт и корзина — в <b>«⋯»</b> у «Мои колоды».';
    // v211: the title on its own line, the text under it, the buttons in one row — and real spaces between them
    // (it read «…по разделамИмпорт…» where the styles did not apply)
    return `<div class="dc-hint" role="note" data-dc-hint="${where}"><span class="dc-hint-i" aria-hidden="true">🧭</span>
      <div class="dc-hint-t"><p class="dc-hint-h"><b>Всё на месте — просто разложено по разделам</b></p> <p class="dc-hint-p">${txt}</p></div>
      <div class="dc-hint-btns"><button type="button" class="btn dc-hint-ok" data-dc-hint-ok="${where}">Понятно</button>
      <button type="button" class="icon-btn dc-hint-x" data-dc-hint-ok="${where}" aria-label="Скрыть подсказку" title="Скрыть подсказку">✕</button></div></div>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-dc-hint-ok]'); if (!b) return;
    e.stopPropagation();
    hintDone(b.dataset.dcHintOk);
    const h = b.closest('.dc-hint'); if (!h) return;
    h.classList.add('gone'); setTimeout(() => h.remove(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260);
  }, true);

  /* =====================================================================
   * 📚 LIBRARY: one place for books and audio (js/bookshelf.js); the old windows open from there
   * ===================================================================== */
  Views.openLibrary = function (tab) {
    if (window.Bookshelf) return Bookshelf.open(tab);
    if (window.Reader) return Reader.open(); // the library file is not loaded yet: at least the reader's shelf
    if (window.Books) return Books.open();
  };

  /* «📖 Продолжить чтение: <книга>, стр. N» at the top of home — a reader book opened in the last 30 days
     (+ an audio course in progress). ✕ hides it for that book until the book is read again. */
  const CONT_KEY = 'nk-home-cont-hide', CONT_DAYS = 30;
  const contHidden = () => { try { const o = JSON.parse(localStorage.getItem(CONT_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
  function contItems() {
    const out = [], hid = contHidden(), fresh = at => at && Date.now() - at < CONT_DAYS * U.DAY;
    try {
      const r = window.Reader && Reader.recent ? Reader.recent().find(x => fresh(x.at) && !(+hid['b:' + x.id] >= x.at)) : null;
      if (r) out.push({ key: 'b:' + r.id, act: 'cont-book', attr: `data-id="${U.esc(r.id)}"`, ico: '📖',
        title: `Продолжить чтение: ${r.title}, стр. ${r.page}`, sub: [`стр. ${r.page} из ${r.pages}`, `прочитано ${Math.round((r.pct || 0) * 100)}%`, r.author].filter(Boolean).join(' · '),
        tip: `Открыть «${r.title}» на странице ${r.page} — там, где вы остановились` });
    } catch (e) { /* no reader */ }
    try {
      const c = window.AudioCourse && AudioCourse.inProgress ? AudioCourse.inProgress() : null;
      if (c && fresh(c.t) && !(+hid['a:' + c.cid] >= c.t)) {
        const t = Math.max(0, Math.floor(c.sec || 0));
        out.push({ key: 'a:' + c.cid, act: 'cont-ac', attr: `data-cid="${U.esc(c.cid)}"`, ico: '🎧',
          title: `Продолжить аудиокурс: ${c.title}, урок ${c.n}`, sub: [`урок ${c.n} из ${c.of}`, t ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : '', c.lesson].filter(Boolean).join(' · '),
          tip: `Слушать «${c.title}» с места, где остановились` });
      }
    } catch (e) { /* no audio course */ }
    return out;
  }
  function contStripHtml() {
    // v211: one «Продолжить» card for everything unfinished (js/continue.js); the old strip stays as a fallback
    if (window.Continue && Continue.html) { try { return Continue.html(); } catch (e) { console.warn('continue', e); } }
    return contItems().map(x => `<div class="home-cont-item" data-cont-key="${U.esc(x.key)}">
        <button type="button" class="home-cont-go" data-act="${x.act}" ${x.attr} title="${U.esc(x.tip)}">
          <span class="home-cont-ico" aria-hidden="true">${x.ico}</span>
          <span class="home-cont-txt"><b>${U.esc(x.title)}</b><small>${U.esc(x.sub)}</small></span>
          <span class="home-cont-play" aria-hidden="true">▶ Продолжить</span></button>
        <button type="button" class="home-cont-x" data-act="cont-hide" data-key="${U.esc(x.key)}" title="Скрыть эту подсказку" aria-label="Скрыть подсказку «${U.esc(x.title)}»">✕</button>
      </div>`).join('');
  }
  function contHide(btn) {
    const key = btn.dataset.key; if (!key) return;
    const o = contHidden(); o[key] = Date.now();
    // keep the list small: only the last 40 hidden
    const keys = Object.keys(o).sort((a, b) => o[b] - o[a]).slice(0, 40);
    try { localStorage.setItem(CONT_KEY, JSON.stringify(Object.fromEntries(keys.map(k => [k, o[k]])))); } catch (e) { /* private mode */ }
    Views.refreshContinue();
    UI.toast(key.startsWith('a:') ? 'Скрыто. Аудиокурсы — в «📚 Библиотеке» → «Слушать»' : 'Скрыто. Книга ждёт вас в «📚 Библиотеке»', '', 3200);
  }
  /** redraw only the strip (a book was read / closed while home is on screen) — nothing else on home moves */
  Views.refreshContinue = function () {
    const box = document.querySelector('#view [data-home-cont]');
    if (!box) return;
    const html = contStripHtml();
    box.innerHTML = html; box.hidden = !html;
  };
  // the deck page's «Голос» buttons follow a pick made in the chooser (it opens over the page, the page isn't redrawn)
  const deckVoiceSync = () => document.querySelectorAll('.deck-voice [data-dv-l]').forEach(s => { if (window.Voices) s.textContent = Voices.label(s.parentNode.dataset.voicesOpen, '', 'cards'); });
  document.addEventListener('voices-pick', deckVoiceSync);
  document.addEventListener('voices-changed', deckVoiceSync);
  // ⭐ the XP badge on home follows new points (js/xp.js fires 'nk-xp' on window)
  window.addEventListener('nk-xp', () => { if (window.XP) document.querySelectorAll('#view [data-xp-badge]').forEach(b => { b.innerHTML = XP.badgeHtml(); }); });
  document.addEventListener('reader-shelf', () => { if (window.App && App.view && App.view.name === 'home') setTimeout(() => Views.refreshContinue(), 50); });
  document.addEventListener('listen-state', () => {
    if (!(window.App && App.view && App.view.name === 'home')) return;
    clearTimeout(Views._contT); Views._contT = setTimeout(() => Views.refreshContinue(), 800);
  });

  /* 🔗 deep links (the installed app's shortcuts, manifest.webmanifest): ./?open=reader | library | tests | listen | books | textbook | audio
     (also #open=…). Read once, at the first home screen; the address is cleaned so a reload does not open it again. */
  let deepDone = false;
  function deepLink() {
    if (deepDone) return;
    deepDone = true;
    let v = '';
    try { v = new URLSearchParams(location.search).get('open') || ((location.hash || '').match(/^#open=([\w-]+)/) || [])[1] || ''; } catch (e) { v = ''; }
    v = String(v || '').toLowerCase();
    if (!v) return;
    try {
      const u = new URL(location.href); u.searchParams.delete('open'); if (/^#open=/.test(u.hash)) u.hash = '';
      history.replaceState(history.state, '', u.pathname + u.search + u.hash);
    } catch (e) { /* old browser */ }
    const acts = {
      // «Читалка»: the book read last (within 30 days) at its page; no book yet → the reader's shelf
      reader: () => { const r = window.Reader && Reader.recent ? Reader.recent().find(x => x.at && Date.now() - x.at < CONT_DAYS * U.DAY) : null; if (r) Reader.openBook(r.id, { cont: true }); else if (window.Reader) Reader.open(); else Views.openLibrary(); },
      library: () => Views.openLibrary(),
      listen: () => Views.openLibrary('listen'),
      books: () => Views.openLibrary('find'),
      textbook: () => (window.Textbook ? Textbook.open() : Views.openLibrary('find')),
      audio: () => (window.AudioCourse ? AudioCourse.open() : Views.openLibrary('listen')),
      tests: () => { if (window.Prove && Prove.open) Prove.open(); else UI.toast('Тесты сейчас недоступны — откройте их на главной', 'warn'); },
    };
    acts.prove = acts.tests;
    acts.exam = () => Views.go('examprep'); // 🎓 also from the calendar events of a route (?open=exam-track)
    acts['exam-track'] = () => Views.go('examprep', { xp: 'tracks' });
    const f = acts[v];
    if (!f) return;
    setTimeout(() => { try { f(); } catch (e) { console.warn('deep link', e); } }, 350);
  }

  /* =====================================================================
   * HOME
   * ===================================================================== */
  Views.home = function (root) {
    const decks = Store.decksByUse ? Store.decksByUse() : Store.decks(); // 🕘 📌 pinned, then the decks in work first (Settings → «Порядок колод»)
    const all = Store.deckStats(null);
    const streak = Store.streakDays();
    const contHtml = contStripHtml();
    // ▶ one big «Учить»: the day's goal (it was «Ещё 20 карточек» + «🧠 Повторить всё» — the same thing twice)
    const gs = Store.settings, goalOn = gs.goalOn !== false, goal = gs.goal || 20, done = Progress.todayCount(), left = Math.max(0, goal - done);
    let hTitle, hBtn, hAct = 'study-all', hPct = goalOn ? Math.min(100, Math.round(done / goal * 100)) : all.learnedPct;
    if (!all.total) { hTitle = 'Начнём с карточек'; hBtn = '➕ Создать карточки'; hAct = 'create'; }
    else if (goalOn && left) { hTitle = `Сегодня: ${done ? 'ещё ' : ''}${left} ${U.plural(left, ['карточка', 'карточки', 'карточек'])}`; hBtn = `▶ Учить · ${left} ${U.plural(left, ['карточка', 'карточки', 'карточек'])}`; hAct = 'goal-go'; }
    else if (goalOn) { hTitle = 'Цель на сегодня выполнена 🎉'; hBtn = all.due ? `▶ Повторить ещё · ${all.due}` : '▶ Учить ещё'; }
    else { hTitle = all.due ? `К повторению: ${all.due}` : 'Учить сегодня'; hBtn = '▶ Учить'; }
    const know = Progress.knowledgeNow();
    // v212: «📚 Мои колоды | ⏳ В процессе» — the list under the switch (remembered in Store.settings.homeList)
    const inProc = window.MyPath && MyPath.mountInline ? MyPath.openCount() : -1;
    const listMode = inProc >= 0 && gs.homeList === 'progress' ? 'progress' : 'decks';
    const tabBtn = (k, ico, label, n, tip) => `<button type="button" class="hl-tab" data-act="home-list" data-list="${k}" aria-pressed="${listMode === k}" title="${tip}"><span aria-hidden="true">${ico}</span><span class="hl-l">${label}</span><span class="chip">${n}</span></button>`;
    root.innerHTML = `
      <div class="home-cont" data-home-cont${contHtml ? '' : ' hidden'}>${contHtml}</div>
      <div class="home-top${window.PhraseDay ? ' has-pd' : ''}">
      <section class="home-hero ${goalOn && !left && all.total ? 'done' : ''}">
        <div class="hh-txt">
          <h1>${hTitle}</h1>
          <div class="hh-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${hPct}" aria-label="${goalOn ? `Цель дня: ${Math.min(done, goal)} из ${goal}` : 'Общий прогресс'}"><i style="width:${hPct}%"></i></div>
          <div class="hh-meta">${all.total ? `${window.XP ? `<button type="button" class="hh-xp" data-act="xp" data-xp-badge title="Очки и серия дней подряд: за что начислены и сколько за неделю">${XP.badgeHtml()}</button>` : `<span>🔥 серия ${streak} ${U.plural(streak, ['день', 'дня', 'дней'])}</span>`}<span>🧠 знание ${know}%</span><span>выучено ${all.learned} из ${all.total}</span>` : '<span>Напишите тему, вставьте список слов или возьмите готовую колоду</span>'}
            <button type="button" class="hh-link" data-act="nav-stats" title="Серия по дням, знание, ответы и прогноз повторений"><i class="nav-ico" aria-hidden="true">${window.NavIcons ? NavIcons.html('stats') : '📊'}</i>Статистика ›</button></div>
        </div>
        <button type="button" class="btn lg hh-go home-go" data-act="${hAct}"${hAct === 'goal-go' ? ` title="Цель на сегодня — ${goal} ${U.plural(goal, ['карточка', 'карточки', 'карточек'])}: повторения и немного новых"` : ''}>${hBtn}</button>
      </section>
      ${window.PhraseDay ? '<div class="home-pd" data-pd-home></div>' : ''}
      </div>
      ${Study.backlogPaused(all.due) ? `<div class="mt-warn backlog"><span>🛟</span><span><b>Накопилось ${all.due} ${U.plural(all.due, ['повторение', 'повторения', 'повторений'])}</b> — новые слова на паузе, пока не догоните (иначе завал только растёт). Повторяйте понемногу — каждый день. Пауза снимется сама, когда останется меньше ${Study.backlogLimit()}. <a href="#" data-act="study-all">Догнать сейчас ›</a></span></div>` : ''}
      ${hintHtml('home')}
      ${sectionTilesHtml()}
      <div class="home-xp" data-xp-home-mount><button type="button" class="home-xp-plaque" data-act="examprep" title="Конструктор ответа, темы, аудирование, письмо-жалоба, пробный устный экзамен, учебные маршруты"><span class="home-xp-i" aria-hidden="true">🎓</span><span class="home-xp-t"><b>Подготовка к экзамену</b><small>Norskprøven A1–B2: каркасы ответов, темы, пробный устный экзамен и маршруты на 6–8 недель</small></span><span class="home-xp-go" aria-hidden="true">›</span></button></div>
      <div class="section-title home-decks-h" id="my-decks">${inProc >= 0
        ? `<div class="home-list-sw" role="group" aria-label="Что показать: колоды или начатое">${tabBtn('decks', '📚', 'Мои колоды', decks.length, 'Все ваши колоды')}${tabBtn('progress', '⏳', 'В процессе', inProc, 'Всё начатое и незаконченное: видео, книги, курсы, колоды')}</div>`
        : `<h2>Мои колоды</h2><span class="chip">${decks.length}</span>`}<span class="grow"></span>
        <div class="home-search"><input class="input" type="search" data-home-search placeholder="🔍 Найти карточку…" aria-label="Поиск по всем карточкам — норвежский, русский, описание" autocomplete="off"></div>
        <button type="button" class="icon-btn hs-toggle" data-act="search-toggle" aria-label="Найти карточку" title="Найти карточку во всех колодах">🔍</button>
        <button type="button" class="btn hd-create" data-act="create" title="Тема, список слов, фото, файл, готовые колоды — всё здесь"><span aria-hidden="true">➕</span><span class="hd-l"> Создать карточки</span></button>
        <button type="button" class="icon-btn hd-looks" data-act="looks" aria-label="Оформление: темы приложения и вид карточек" title="🎨 Оформление: темы приложения и вид карточек">🎨</button>
        <button type="button" class="icon-btn hd-more" data-act="decks-more" aria-label="Ещё: поделиться колодами, экспорт, корзина" title="Поделиться колодами, экспорт, корзина">⋯</button>
      </div>
      <div class="home-search-res" data-search-res></div>
      ${listMode === 'progress' ? '<div class="home-inproc" data-mp-inline></div>' : decks.length ? `<div class="deck-grid home-decks">${decks.map((d, i) => deckCard(d, i)).join('')}</div>` : `
        <div class="panel empty"><div class="big">🗂️</div><h3>Пока нет колод</h3>
        <p>Создайте колоду, перетащите сюда файл с карточками или загрузите пример.</p>
        <div class="row" style="justify-content:center"><button class="btn primary" data-act="create">➕ Создать карточки</button>
        <button class="btn" data-act="import">📥 Импорт</button><button class="btn" data-act="sample">🎁 Пример колоды</button></div></div>`}
    `; // the footer (🧭 navigator · 🎨 оформление · поделиться) is added by the app shell under every screen: Views.mountFoot

    deepLink();
    // 🌅 фраза дня (js/phraseday.js) · ⏳ «В процессе» (js/mypath.js) — drawn into their places after the screen
    const pdEl = root.querySelector('[data-pd-home]');
    if (pdEl) PhraseDay.mount(pdEl).catch(e => console.warn('phrase of the day', e));
    const mpEl = root.querySelector('[data-mp-inline]');
    if (mpEl) { try { MyPath.mountInline(mpEl); } catch (e) { console.warn('mypath inline', e); } }
    // 🎓 a route is on: «Сегодня по маршруту» replaces the plaque (js/examprep.js is loaded only then)
    if (Store.settings.examPrep && Store.settings.examPrep.track) Views.examPrep().then(X => X.homeMount(root.querySelector('[data-xp-home-mount]'))).catch(() => {});
    // ↓ «Ещё N колод ниже»: a small bubble at the bottom centre while some decks are still below the screen.
    // N counts only the decks not seen yet (the first cards already on screen are not counted);
    // tap = scroll to the next unseen deck; the bubble goes away once every deck has been on screen.
    const decksAt = root.querySelector('#my-decks');
    if (decksAt && listMode === 'decks' && 'IntersectionObserver' in window) {
      const cards = [...root.querySelectorAll('.deck-grid .deck-card')];
      const targets = cards.length ? cards : [decksAt];
      const seen = new Set();
      const hint = document.createElement('button');
      hint.type = 'button'; hint.className = 'scroll-hint'; hint.hidden = true;
      hint.setAttribute('aria-label', 'Прокрутить к моим колодам');
      hint.innerHTML = `<span data-sh-txt></span>
        <svg class="sh-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></svg>`;
      root.appendChild(hint);
      const txt = hint.querySelector('[data-sh-txt]');
      let done = false;
      const finish = () => { if (done) return; done = true; io.disconnect(); hint.classList.add('gone'); setTimeout(() => hint.remove(), 350); };
      const update = () => {
        if (done) return;
        if (!root.contains(decksAt)) { done = true; io.disconnect(); hint.remove(); return; }
        const left = targets.filter(t => !seen.has(t));
        if (!left.length) { finish(); return; }
        // only while the unseen decks are below the screen (not when the page is scrolled past them)
        const below = left[0].getBoundingClientRect().top > innerHeight - 40;
        const n = left.length;
        txt.textContent = cards.length ? `Ещё ${n} ${U.plural(n, ['колода', 'колоды', 'колод'])} ниже — прокрутите` : 'Колоды — ниже, прокрутите';
        hint.setAttribute('aria-label', cards.length ? `Прокрутить к колодам: ещё ${n}` : 'Прокрутить к моим колодам');
        hint.hidden = !below;
      };
      // a deck counts as seen when a good part of it (or 80 px — its cover and name) has been on the screen
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => { if (en.isIntersecting && (en.intersectionRatio >= 0.4 || en.intersectionRect.height >= 80)) seen.add(en.target); });
        update();
      }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.6, 1] });
      targets.forEach(t => io.observe(t));
      hint.onclick = () => {
        const next = targets.find(t => !seen.has(t)) || decksAt;
        (next === targets[0] || !seen.size ? decksAt : next).scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    }
    // (decks without a picture get a Norwegian photo in App.render — on every screen)
    // 🔍 search across all cards (Norwegian, Russian, English, description, tags)
    const sIn = root.querySelector('[data-home-search]'), sOut = root.querySelector('[data-search-res]');
    let sT = null;
    sIn.addEventListener('input', () => {
      clearTimeout(sT);
      sT = setTimeout(() => {
        const q = U.norm(sIn.value);
        if (q.length < 2) { sOut.innerHTML = ''; return; }
        const deckName = id => (Store.deck(id) || {}).name || '';
        const hits = Store.cards().filter(c => U.norm(`${c.no} ${c.ru} ${c.uk || ''} ${c.en || ''} ${c.description || ''} ${(c.tags || []).join(' ')}`).includes(q)).slice(0, 40);
        sOut.innerHTML = hits.length ? hits.map(c => `<button class="hs-row" data-act="search-card" data-id="${c.id}"><b>${UI.rich(String(c.no).split('\n')[0].slice(0, 80))}</b><span>${UI.rich(String(Study.tr(c)).split('\n')[0].slice(0, 80))}</span><small>${U.esc(deckName(c.deckId))}</small></button>`).join('')
          + (hits.length === 40 ? '<div class="small muted">Показаны первые 40 — уточните запрос</div>' : '')
          : '<div class="small muted" style="padding:8px">Ничего не найдено</div>';
      }, 160);
    });
    root.onclick = async e => {
      const a = e.target.closest('[data-act]');
      if (!a) { const dc = e.target.closest('.deck-card'); if (dc) App.go('deck', { id: dc.dataset.id }); return; }
      e.stopPropagation();
      const id = a.dataset.id;
      switch (a.dataset.act) {
        case 'study-all': e.preventDefault(); Study.start({ deckId: null }); break;
        case 'new-deck': Views.deckEditor(null, d => App.go('deck', { id: d.id })); break;
        case 'deck-edit': Views.deckEditor(id); break;
        case 'import': App.pickFiles(); break;
        case 'export': Views.exportDialog(null); break;
        case 'gen-deck': Views.generateDeckDialog(); break;
        case 'library': Library.open(); break;
        case 'cont-hide': contHide(a); break;
        case 'photo-cards': Create.pickPhotos(null); break;
        case 'sec-video': Views.section('video'); break;
        case 'learn': Views.go('learn'); break;
        case 'learn-video': case 'learn-radio': case 'learn-book': case 'learn-song': if (window.LearnBy) LearnBy.entry(a.dataset.act.slice(6)); break;
        case 'sec-read': Views.section('read'); break;
        case 'sec-drills': Views.section('drills'); break;
        case 'looks': Views.section('looks'); break;
        case 'showcase': if (window.Showcase) Showcase.open(); break;
        case 'decks-more': Views.decksMore(); break;
        case 'search-toggle': {
          const box = root.querySelector('.home-search'); const on = !box.classList.contains('open');
          box.classList.toggle('open', on); a.setAttribute('aria-expanded', String(on));
          if (on) sIn.focus(); else { sIn.value = ''; sOut.innerHTML = ''; }
          break;
        }
        case 'listen': if (window.ListenUI) ListenUI.deck(id); else Listen.open(id); break;
        case 'share': Share.open(id || undefined); break;
        case 'share-app': ShareApp.open(); break;
        case 'genders': Genders.open(); break;
        case 'create': Create.open(); break;
        case 'nav-stats': App.go('stats'); break;
        case 'home-list': {
          const v = a.dataset.list === 'progress' ? 'progress' : 'decks';
          if (v === listMode) break;
          Store.setSetting('homeList', v);
          App.render();
          const sw = document.querySelector(`#view .hl-tab[data-list="${v}"]`); if (sw) sw.focus({ preventScroll: true });
          break;
        }
        case 'goal-go': {
          const n = Math.max(5, (Store.settings.goal || 20) - Progress.todayCount());
          Study.start({ deckId: null, size: n });
          break;
        }
        case 'search-card': { const c = Store.card(id); if (c) Views.viewCard(c.id, [...sOut.querySelectorAll('[data-act="search-card"]')].map(b => b.dataset.id), { deckId: c.deckId }); break; }
        case 'trash': Views.trashDialog(); break;
        case 'sample': App.addSampleDeck(); App.render(); break;
        case 'study': Study.start({ deckId: id }); break;
        case 'open': App.go('deck', { id }); break;
        case 'deck-menu': Views.deckMore(id); break;
        case 'deck-delete': Views.deleteDeck(id); break;
        default: if (GO[a.dataset.act]) Views.go(a.dataset.act, Object.assign({}, a.dataset));
      }
    };
  };
  /** cover banner of a deck (photo + name + count + %); empty decks get a gradient and an "add a cover" hint */
  /** the deck tile shows only a short line — sources, licences and long notes are for the deck page */
  Views.deckShortDesc = function (d) {
    let s = String((d && d.description) || '').split('\n').map(x => x.trim()).find(Boolean) || '';
    if (/^(источник|©|слова:|формы и род)/i.test(s)) return '';
    s = s.split(/\s+—\s+|\.\s|\s\(/)[0].replace(/[.:;,]$/, '').trim();
    return s.length > 60 ? s.slice(0, 57).replace(/\s+\S*$/, '') + '…' : s;
  };
  Views.deckCoverHtml = function (d, st, big) {
    const bg = d.cover ? `style="background-image:url('${U.esc(d.cover)}')"` : '';
    const sub = big ? [Views.deckShortDesc(d), U.cards(st.total), `выучено ${st.learnedPct}%`].filter(Boolean).join(' · ') : `⚡ ${st.total} · ${st.learnedPct}%`;
    return `<div class="deck-cover ${d.cover ? '' : 'empty'} ${big ? 'big' : ''}" ${bg} data-act="${big ? 'deck-edit' : 'open'}" data-id="${d.id}" title="${big ? 'Изменить название и обложку' : 'Открыть колоду'}">
      ${d.cover ? '' : `<span class="deck-cover-hint">🖼 ${big ? 'Нажмите, чтобы добавить обложку' : ''}</span>`}
      <div class="deck-cover-title">${big ? `<h1 data-act="rename" title="Переименовать">${U.esc(d.name)}</h1>` : `<b>${d.pinned ? '<span class="dc-pin" title="Закреплена наверху" aria-label="Закреплена наверху">📌</span> ' : ''}${U.esc(d.name)}</b>`}<span>${U.esc(sub)}</span></div>
      <div class="deck-cover-tools">
        <button class="icon-btn sm deck-cover-btn" data-act="deck-edit" data-id="${d.id}" title="Изменить название, описание и обложку" aria-label="Изменить название, описание и обложку"><svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg></button>
      </div>
    </div>`;
  };
  /** ✏️ deck editor: cover photo from anywhere, name, description (≤500) — also used to create a new deck */
  Views.deckEditor = function (id, onDone) {
    const d = id ? Store.deck(id) : null;
    let cover = d ? d.cover || '' : '', credit = d ? d.coverCredit || '' : '', removed = false, init = null;
    const snap = () => JSON.stringify([m.$('[data-name]').value.trim(), m.$('[data-desc]').value.trim(), cover, removed]);
    const m = UI.modal({
      title: d ? '✏️ Колода: название и обложка' : '➕ Новая колода', cls: 'deck-editor',
      // a typed name / description or a new cover is not lost by an accidental ✕ / Esc / tap outside / «Отмена»
      beforeClose: UI.guard(() => init === null || snap() === init ? null : { title: 'Закрыть без сохранения?', line: d ? 'Изменения колоды не сохранены.' : 'Новая колода не создана.',
        actions: [{ label: 'Закрыть', value: 'close', cls: 'bad' }] }),
      // a new deck: name, then right away «Из чего сделать карточки?» (visible without scrolling), cover and description below
      body: d ? `<div data-cv></div>
        <input class="input de-name" data-name value="${U.esc(d.name)}" placeholder="Без названия" maxlength="80">
        <textarea class="input de-desc" data-desc maxlength="500" rows="3" placeholder="Опишите вашу колоду">${U.esc(d.description || '')}</textarea>
        <div class="tiny muted" data-cnt style="text-align:right"></div>`
        : `<input class="input de-name" data-name value="" placeholder="Название колоды" maxlength="80">
        <div class="src-pick" data-srcs>${Create.sourcesHtml('manual')}</div>
        <div class="src-head small" style="margin-top:16px">Обложка и описание — по желанию:</div>
        <div data-cv class="de-cv-compact"></div>
        <textarea class="input de-desc" data-desc maxlength="500" rows="2" placeholder="Опишите вашу колоду"></textarea>
        <div class="tiny muted" data-cnt style="text-align:right"></div>`,
      foot: `${d ? '<button class="btn ghost danger-btn" data-del-deck style="margin-right:auto">🗑 Удалить колоду</button>' : ''}<button class="btn ghost" data-cancel>Отмена</button><button class="btn primary" data-save>✓ Сохранить</button>`,
    });
    init = snap();
    if (d) m.$('[data-del-deck]').onclick = () => Views.deleteDeck(d.id, () => m.close());
    // new deck: where the cards come from (photo, text, file, Telegram… — or a whole section like the textbook)
    let source = 'manual';
    if (!d) {
      const saveBtn = m.$('[data-save]');
      const label = () => { const s = Create.SOURCES.find(x => x.k === source); saveBtn.textContent = source === 'manual' ? '✓ Создать колоду' : `✓ Создать и добавить: ${s.t}`; };
      label();
      m.$('[data-srcs]').addEventListener('click', e => {
        const t = e.target.closest('[data-src]'); if (!t) return;
        const s = Create.SOURCES.find(x => x.k === t.dataset.src); if (!s) return;
        if (!s.into) { m.close(); Create.launch(s.k, null); return; } // the section makes / picks its own deck
        source = s.k;
        m.$$('[data-src]').forEach(b => b.classList.toggle('active', b === t));
        label();
      });
    }
    const drawCover = () => {
      m.$('[data-cv]').innerHTML = `<div class="de-cover ${cover ? '' : 'empty'}" ${cover ? `style="background-image:url('${U.esc(cover)}')"` : ''}>
        ${cover ? '' : '<div class="de-empty">🏔<br><span class="small">Обложка — фото по теме колоды: фьорды, Берген, северное сияние…</span></div>'}
        <div class="row de-cover-btns"><button class="btn sm" data-pick>✏️ ${cover ? 'Изменить' : 'Выбрать'} изображение</button>${cover ? '<button class="btn sm ghost" data-rm title="Убрать обложку">✕</button>' : ''}</div>
        ${credit && cover ? `<span class="de-credit">${U.esc(credit)}</span>` : ''}</div>`;
    };
    drawCover();
    const cnt = () => { m.$('[data-cnt]').textContent = `${m.$('[data-desc]').value.length}/500`; };
    cnt(); m.$('[data-desc]').addEventListener('input', cnt);
    m.$('[data-cv]').addEventListener('click', e => {
      if (e.target.closest('[data-rm]')) { cover = ''; credit = ''; removed = true; drawCover(); return; }
      if (e.target.closest('[data-pick]') || e.target.closest('.de-cover.empty')) {
        const name = m.$('[data-name]').value.trim();
        coverPick(name && !/[а-яё]/i.test(name) ? name + ' norge' : 'norway fjord', (data, cr) => { cover = data; credit = cr; drawCover(); });
      }
    });
    m.$('[data-cancel]').onclick = () => m.tryClose();
    m.$('[data-save]').onclick = () => {
      let name = m.$('[data-name]').value.trim(), auto = false;
      // a source was chosen but no name: «Новая колода» for now — named from its cards when they arrive (Store.autoNameDeck)
      if (!name && !d && source !== 'manual') { name = Store.AUTO_DECK; auto = true; }
      if (!name) { UI.toast('Введите название колоды', 'warn'); m.$('[data-name]').focus(); return; }
      // no AI connected: say how to connect it — and don't leave an empty deck behind
      if (!d && source === 'ai' && !AI.available()) { Guides.needAI('Колода по теме'); return; }
      // a removed picture stays removed (no automatic Norwegian photo again)
      const patch = { name, description: m.$('[data-desc]').value.trim().slice(0, 500), cover, coverCredit: credit, ...(removed ? { coverTried: true, coverAuto: false } : cover && d && cover !== d.cover ? { coverAuto: false } : {}) };
      // 🏷 the user named the deck himself: never renamed automatically again
      if (d && d.autoName && name !== d.name) patch.autoName = false;
      let deck;
      if (d) deck = Store.updateDeck(d.id, patch);
      else { deck = Store.addDeck(name, patch.description, auto ? { autoName: true } : null); Store.updateDeck(deck.id, { cover, coverCredit: credit }); }
      m.close();
      if (onDone) onDone(deck); else App.render();
      // right away, still inside the click: Safari opens the photo / file picker only on a direct tap
      if (!d && source !== 'manual') Create.launch(source, deck.id, true);
    };
    setTimeout(() => { if (!d) m.$('[data-name]').focus(); }, 60);
  };
  function deckCard(d, i) {
    const st = Store.deckStats(d.id), sd = Views.deckShortDesc(d);
    return `<div class="deck-card has-cover" data-id="${d.id}" style="animation-delay:${Math.min(i, 12) * 40}ms">
      ${Views.deckCoverHtml(d, st)}
      <div class="dc-info"><span class="small muted deck-card-sub">${U.cards(st.total)}${st.due ? ` · к повторению ${st.due}` : ''}${sd ? ' · ' + U.esc(sd) : ''}</span><b>${st.learnedPct}%</b></div>
      ${UI.stacked(st)}
      ${window.ListenX && ListenX.offlineChip(d.id) ? `<div class="row" style="gap:6px">${ListenX.offlineChip(d.id)}</div>` : ''}
      <div class="actions">
        <button class="btn primary grow" data-act="study" data-id="${d.id}" ${st.total ? '' : 'disabled'}>▶ Учить</button>
        <button class="btn listen-cta dc-listen" data-act="listen" data-id="${d.id}" data-listen-btn aria-label="Слушать колоду «${U.esc(d.name)}» — в наушниках или через динамик" title="🎧 Слушать колоду — сразу, в наушниках или через динамик; экран можно выключить" ${st.total ? '' : 'disabled'}></button>
        <button class="icon-btn dc-more" data-act="deck-menu" data-id="${d.id}" title="Ещё: поделиться, экспорт, проверить, удалить…" aria-label="Ещё — колода «${U.esc(d.name)}»">⋯</button>
      </div>
    </div>`;
  }
  /** «⋯ Ещё» of a deck — the same window on the deck page and on its tile at home (it was a menu of 16 lines and a row of 12 buttons) */
  Views.deckMore = function (id) {
    const d = Store.deck(id); if (!d) return null;
    const on = AI.available(), sel = App.view.name === 'deck' && App.view.params.id === id && Views.sel.size ? [...Views.sel] : null;
    const lx = window.ListenX, off = lx && lx.cache && lx.cache.status(id).state === 'done';
    const fill = (k, ico, t, sub) => sxRow(k, ico, t, sub);
    // 📌 first line: keep this deck on top of the deck lists (sidebar, «Мои колоды») — or let it go back into the order
    const body = sxGroup('', [d.pinned ? sxRow('unpin', '📌', 'Открепить', 'колода снова встанет в общий порядок списка') : sxRow('pin', '📌', 'Закрепить наверху', 'всегда первой — в боковом меню и в «Моих колодах»')], 'sx-pin')
      + sxGroup('Добавить карточки', [
      sxRow('import', '📥', 'Импорт из файла', 'Excel, Anki, CSV, PDF… — или перетащите файл в окно'),
      sxRow('gen', '✨', 'Новые карточки по теме', on ? `сделает нейросеть (${U.esc(AI.name())})` : 'нужна нейросеть — Gemini или Groq бесплатно'),
      sxRow('library', '🃏', 'Устойчивые выражения', 'идиомы и фразы с переводом'),
      sxRow('create', '➕', 'Другие способы…', 'фото, список, из видео — окно «Создать карточки»'),
    ]) + sxGroup('Поделиться и сохранить', [
      sxRow('share', ShareApp.SHARE_SVG(18), 'Поделиться колодой', 'со всеми картинками и пояснениями'),
      ...(window.PrintX ? [sxRow('print', '🖨', sel ? `Печать выбранных (${sel.length})` : 'Печать и файлы', 'таблица, карточки для вырезания, Excel, Word')] : []),
      sxRow('export', '📤', sel ? `Экспорт выбранных (${sel.length})` : 'Экспорт в файл', 'для другого приложения или на память'),
      ...(lx ? [sxRow('offline', off ? '🎧' : '⬇️', off ? 'Озвучка скачана ✓' : 'Скачать озвучку', off ? 'колоду можно слушать без интернета' : 'слушать без интернета')] : []),
    ]) + sxGroup('Проверить и дополнить', [
      sxRow('ai-check', BOT(24), 'Проверить все карточки', `нейросеть сверит переводы, род и написание${on ? ` · ${U.esc(AI.name())}` : ''}`),
      sxRow('images', '🖼', 'Картинки для всех', 'найдёт картинку там, где её нет'),
      sxRow('redraw', '🎨', 'Перерисовать картинки по смыслу', 'нейросеть нарисует заново'),
    ]) + `<details class="sx-more"><summary class="m-row sx-row"><span class="m-place-i sx-i" aria-hidden="true">📚</span><span class="m-row-t"><b>Дополнить карточки…</b><small>объяснения, формы, Ordbøkene, синонимы, примеры — где их нет</small></span>${CHEV}</summary>
        <div class="m-list sx-list">${[fill('explain', '📝', 'Объяснения', 'коротко, по-русски'), fill('forms', '📚', 'Формы слов', 'род, множественное число, времена'),
          fill('ordbok', '📖', 'Статьи Ordbøkene', 'с переводом'), fill('synonyms', '🔁', 'Синонимы', ''), fill('examples', '💬', 'Примеры по формам', '')].join('')}</div></details>`
      + sxGroup('Вид', [
        ...(window.ArtCards ? [sxRow('art-on', '🖼', 'Художественный вид', 'колода как галерея картинок — обратно одним нажатием'),
          sxRow('art-looks', '🎨', 'Оформление карточек', 'Викинги, Тролли, Ставкирка, Лофотены, праздники…')] : []),
      ])
      + sxGroup('Управление колодой', [
        sxRow('edit', '✏️', 'Название, описание, обложка', ''),
        sxRow('cover', '🏔', 'Сменить обложку', 'фото по теме колоды'),
        sxRow('select', '☑', 'Выбрать карточки', 'переместить, добавить тег, удалить несколько'),
        ...(lx && lx.hasPlace && lx.hasPlace(id) ? [sxRow('place', '📍', 'Сбросить место прослушивания', 'колода зазвучит с первой карточки')] : []),
        sxRow('reset', '♻️', 'Начать заново', 'сбросить прогресс изучения этой колоды'),
        `<button type="button" class="m-row sx-row sx-red" data-sx="delete"><span class="m-place-i sx-i" aria-hidden="true">${UI.TRASH_SVG(18)}</span><span class="m-row-t"><b>Удалить колоду</b><small>30 дней можно вернуть из корзины</small></span>${CHEV}</button>`,
      ]);
    const cards = () => (sel ? sel.map(x => Store.card(x)) : Store.cards(id)).filter(Boolean);
    return sxSheet(U.esc(d.name), body, { cls: 'sx-deck', detent: 'large', run: k => ({
      import: () => App.pickFiles(id), gen: () => Views.generateDeckDialog(id), library: () => Library.open(id), create: () => Create.open(id),
      share: () => Share.open(id), export: () => Views.exportDialog(id, sel), print: () => Views.printDeck(id, sel), offline: () => lx.download(id),
      'ai-check': () => { Store.touchDeck(id); return sel ? Views.runAiCheck(cards()) : window.AIHub ? AIHub.checkDecks([id]) : Views.runAiCheck(cards()); },
      pin: () => { Store.pinDeck(id, true); UI.toast('📌 Колода закреплена наверху', 'good', 2200); App.render(); },
      unpin: () => { Store.pinDeck(id, false); UI.toast('Колода откреплена', '', 2200); App.render(); },
      images: () => Views.batchImages(cards()), redraw: () => Views.redrawImages(cards()),
      explain: () => Views.addExplanations(cards(), true), forms: () => Views.enrichMany(cards(), 'forms', true), ordbok: () => Views.ordbokMany(cards()),
      synonyms: () => Views.enrichMany(cards(), 'synonyms', true), examples: () => Views.enrichMany(cards(), 'examples', true),
      'art-on': () => { Store.updateDeck(id, { art: 'on' }); if (App.view.name === 'deck' && App.view.params.id === id) App.render(); else App.go('deck', { id }); },
      'art-looks': () => Views.cardLooks(id),
      edit: () => Views.deckEditor(id),
      cover: () => coverPick(/[а-яё]/i.test(d.name) ? 'norway fjord' : d.name + ' norge', (data, cr) => { Store.updateDeck(id, { cover: data, coverCredit: cr, coverAuto: false }); App.render(); }),
      select: () => {
        if (!(App.view.name === 'deck' && App.view.params.id === id)) App.go('deck', { id });
        Views.selecting = true; App.render();
        UI.toast('Нажимайте на карточки, чтобы выбрать. Потом — «Действия» над списком.', '', 4000);
      },
      place: () => { lx.forgetDeck(id); UI.toast('Место забыто — колода зазвучит с первой карточки', 'good'); },
      reset: async () => { if (await UI.confirm('Сбросить прогресс изучения этой колоды? Карточки снова станут новыми.', { danger: true, ok: 'Сбросить' })) { Store.resetProgress(Store.cards(id).map(c => c.id)); App.render(); } },
      delete: () => Views.deleteDeck(id),
    })[k]() });
  };
  /** 🎨 «Оформление карточек»: the art-card templates (js/artcards.js studio) and the gallery view of this deck */
  Views.cardLooks = function (id) {
    if (!window.ArtCards) return null;
    let cur = '';
    try { const th = ArtCards.THEMES[(Store.Safe && Store.Safe.art ? Store.Safe.art(Store.settings.art) : Store.settings.art || {}).theme || 'fjord']; if (th) cur = `${th.icon} ${th.name}`; } catch (e) { /* default */ }
    const d = id && Store.deck(id);
    return sxSheet('🎨 Оформление карточек', sxGroup('', [
      sxRow('studio', '🎨', 'Шаблоны, шрифты и цвета', `сейчас: ${U.esc(cur || 'Фьорд')} · Викинги, Тролли, Ставкирка, Лофотены, праздники…`),
      ...(d ? [sxRow('gallery', '🖼', ArtCards.deckOn(d) ? 'Колода уже в художественном виде' : 'Художественный вид колоды', 'картинка во всю карточку, крупное слово, цвет рода')] : []),
    ]) + '<p class="m-note">Шаблон меняет и карточки в занятии. В «Галерее картинок» первыми будут фото под выбранный шаблон.</p>', { cls: 'sx-looks', run: k => {
      if (k === 'gallery' && d) { Store.updateDeck(d.id, { art: 'on' }); if (App.view.name === 'deck' && App.view.params.id === d.id) App.render(); else App.go('deck', { id: d.id }); return; }
      // the studio of js/artcards.js opens through its own button handler (it picks sample cards of this deck)
      const b = document.createElement('button'); b.type = 'button'; b.hidden = true; b.dataset.artAct = 'studio';
      document.body.appendChild(b); b.click(); b.remove();
    } });
  };
  /** 🗑 delete a deck — always asks first; the deck stays in the trash for 30 days, «↶ Вернуть» right after */
  Views.deleteDeck = async function (id, after) {
    const d = Store.deck(id); if (!d) return false;
    if (!(await UI.confirm(`Точно удалить колоду «${U.esc(d.name)}» и все её карточки (${Store.cards(id).length})?<br><span class="small muted">Её можно будет вернуть из 🗑 Корзины в течение 30 дней.</span>`, { danger: true, ok: 'Да, удалить' }))) return false;
    const e = Store.deleteDeck(id);
    if (after) after();
    App.go('home');
    Views.afterDelete(e, `Колода «${d.name}» удалена`);
    return true;
  };

  /* =====================================================================
   * DECK
   * ===================================================================== */
  Views.deck = function (root, params) {
    const deck = Store.deck(params.id);
    if (!deck) { App.go('home'); return; }
    // 🎨 «Художественный вид» of this deck (js/artcards.js): the gallery instead of the list — «▦ Обычный вид» there returns here
    if (window.ArtCards && ArtCards.deckOn(deck)) { ArtCards.gallery(root, deck); return; }
    const stats = Store.deckStats(deck.id);
    const f = Views.deckFilter;
    const q = Views.deckSearch.trim().toLowerCase();
    let cards = Store.cards(deck.id);
    // 🔀 shuffled order of this deck's list (until «По порядку» or leaving the app)
    const ord = Views.deckOrder && Views.deckOrder.deck === deck.id ? Views.deckOrder.pos : null;
    if (ord) cards = cards.slice().sort((a, b) => (ord[a.id] ?? 1e9) - (ord[b.id] ?? 1e9));
    const now = Date.now();
    cards = cards.filter(c => {
      if (f === 'due' && !Store.isDue(c, null, now)) return false;
      if (f === 'leech' && !Store.isLeech(c)) return false;
      if (f === 'noai' && c.aiChecked) return false;
      if (['new', 'learning', 'debt', 'learned'].includes(f) && Store.status(c) !== f) return false;
      if (q && !(c.no + ' ' + c.ru + ' ' + (c.uk || '') + ' ' + c.description + ' ' + (c.tags || []).join(' ')).toLowerCase().includes(q)) return false;
      return true;
    });
    const shown = cards.slice(0, Views.deckLimit);
    const studyCount = sessionCount(deck.id);
    // filters with nothing in them stay hidden (the chosen one and «Все» always show)
    const chip = (key, label, n, cls) => (n || f === key || key === 'all' ? `<button class="chip ${cls || ''} ${f === key ? 'active' : ''}" data-act="filter" data-f="${key}" aria-pressed="${f === key}">${label} ${n}</button>` : '');
    const running = !!(window.AIHub && AIHub.state && AIHub.state().run);
    const selN = Views.sel.size;
    root.innerHTML = `
      <div class="deck-head">
        <button class="icon-btn" data-act="back" title="Назад" aria-label="Назад">←</button>
        <div class="grow col dk-about">
          ${UI.stacked(stats)}
          ${deck.description && (deck.description.length > 140 || deck.description.includes('\n'))
            ? `<details class="deck-about muted"><summary>ℹ️ Об этой колоде и источники</summary><div style="white-space:pre-line;margin-top:6px">${U.esc(deck.description)}</div></details>`
            : deck.description && !Views.deckShortDesc(deck) ? `<div class="muted small">${U.esc(deck.description)}</div>` : ''}
        </div>
        <div class="ring" style="--p:${stats.learnedPct}" title="Выучено ${stats.learnedPct}%"><b>${stats.learnedPct}%</b></div>
      </div>
      ${Views.deckCoverHtml(deck, stats, true)}
      <div class="launcher dk-launch">
        <div class="dk-go">
          <button class="btn primary lg dk-start" data-act="start" ${studyCount ? '' : 'disabled'}>▶ Начать · ${U.cards(studyCount)}</button>
          ${deckAiBtn(deck, stats, running, selN)}
        </div>
        <div class="dk-sumrow">
          <button type="button" class="dk-sum" data-act="session" aria-haspopup="dialog" title="Настройки занятия: как учить, направление, какие карты, сколько, голоса">${sessionSumHtml()}</button>
          <button type="button" class="btn dk-edit" data-act="session" aria-haspopup="dialog" title="Изменить настройки занятия">✎ Изменить</button>
        </div>
        ${!studyCount && stats.total ? '<p class="muted small dk-none">По этим настройкам сейчас нет карт — нажмите «✎ Изменить» и выберите «Все» или другой набор.</p>' : ''}
        ${window.AIChooser && AIChooser.stripHtml ? AIChooser.stripHtml() : ''}
        <div class="toolbar dk-acts">
          <button class="btn" data-act="add">➕ Карточка</button>
          <button class="btn listen-cta deck-listen" data-act="listen" data-id="${deck.id}" data-listen-btn data-label="Слушать" aria-label="Слушать колоду — в наушниках или через динамик" title="🎧 Слушать колоду — сразу, в наушниках или через динамик; экран можно выключить" ${stats.total ? '' : 'disabled'}></button>
          ${window.ArtCards || window.AppThemes ? '<button class="btn dk-looks" data-act="looks" aria-haspopup="dialog" title="Вид карточек (Викинги, Тролли, Ставкирка, праздники) и тема всего приложения">🎨 Оформление</button>' : ''}
          ${window.PrintX ? `<button class="btn dk-print" data-act="print" aria-haspopup="dialog" title="Распечатать колоду (таблица, карточки для вырезания, «Проверь себя») или сохранить в Excel и Word${selN ? ` — только выбранные: ${selN}` : ''}">🖨 Печать и файлы</button>` : ''}
          <button class="btn dk-more" data-act="deck-more" aria-haspopup="dialog" title="Импорт, экспорт, поделиться, картинки, выбрать, удалить">⋯ Ещё</button>
        </div>
      </div>
      ${hintHtml('deck')}
      <div class="dk-listbar">
        <input class="input dk-search" type="search" placeholder="🔍 Поиск в колоде…" aria-label="Поиск в колоде" value="${U.esc(Views.deckSearch)}" data-act-input="search">
        <div class="dk-chips" role="group" aria-label="Какие карточки показать">
          ${chip('all', 'Все', stats.total)}${chip('new', 'Новые', stats.new, 'new')}${chip('learning', 'Изучаю', stats.learning, 'learning')}
          ${chip('debt', 'Долговые', stats.debt, 'debt')}${chip('learned', 'Выученные', stats.learned, 'learned')}${chip('due', '⏰ К повторению', stats.due, 'due')}
          ${chip('leech', '🐛 Трудные', stats.leech)}${chip('noai', `${BOT()} Не проверены`, stats.total - stats.aiChecked, 'ai')}
        </div>
        <span class="grow"></span>
        ${Views.selecting || selN ? `<button class="btn sm" data-act="select">✖ Снять выбор</button>` : ''}
        ${selN && window.PrintX ? `<button class="btn sm dk-print-sel" data-act="print-sel" aria-haspopup="dialog" title="Распечатать или сохранить в файл только выбранные карточки (${selN})">🖨 Печать выбранных</button>` : ''}
        ${selN ? `<button class="btn sm primary" data-act="bulk" aria-haspopup="menu">Действия (${selN}) ▾</button>` : ''}
        ${cards.length > 1 ? `<button class="btn sm ${ord ? 'primary' : ''}" data-act="order" aria-haspopup="menu" title="Перемешать список, учить или слушать в этом порядке">⇅ Порядок ▾</button>` : ''}
      </div>
      ${shown.length ? `<div class="card-grid" title="Нажмите на карту — откроется просмотр; оттуда можно начать учить с неё">${shown.map((c, i) => miniCard(c, i)).join('')}</div>` : `<div class="panel empty"><div class="big">🃏</div>
        <p>${stats.total ? 'Ничего не найдено' : 'В колоде пока нет карточек'}</p>
        <div class="row" style="justify-content:center"><button class="btn primary" data-act="add">➕ Добавить карточку</button><button class="btn" data-act="import">📥 Импорт</button>
        ${AI.available() ? `<button class="btn ai" data-act="gen">✨ Сгенерировать (${U.esc(AI.name())})</button>` : ''}<button class="btn" data-act="create-more">➕ Другие способы…</button></div></div>`}
      ${cards.length > shown.length ? `<div class="center" style="margin-top:14px"><button class="btn" data-act="more">Показать ещё (${cards.length - shown.length})</button></div>` : ''}
    `;

    const search = root.querySelector('[data-act-input="search"]');
    search.oninput = U.debounce(() => { Views.deckSearch = search.value; Views.deckLimit = 120; App.render(); setTimeout(() => { const s = root.querySelector('[data-act-input="search"]'); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 0); }, 250);
    root.onchange = null;
    root.onclick = async e => {
      const a = e.target.closest('[data-act]');
      const mc = e.target.closest('.mini-card');
      if (!a && mc) {
        if (Views.selecting) { toggleSel(mc.dataset.id); App.render(); }
        // a tap opens the card to look at it (✏️ is for editing); ▶ inside starts learning from it, in this order
        else Views.viewCard(mc.dataset.id, cards.map(c => c.id), { deckId: deck.id });
        return;
      }
      if (!a) return;
      const id = a.dataset.id;
      switch (a.dataset.act) {
        case 'back': App.go('home'); break;
        case 'rename': case 'deck-edit': Views.deckEditor(deck.id); break;
        case 'start': Study.start({ deckId: deck.id }); break;
        case 'session': Views.sessionSheet(deck.id); break;
        case 'deck-more': Views.deckMore(deck.id); break;
        case 'looks': Views.looksSheet(deck.id); break;
        case 'print': Views.printDeck(deck.id, Views.sel.size ? [...Views.sel] : null); break;
        case 'print-sel': Views.printDeck(deck.id, [...Views.sel]); break;
        case 'ai-run': if (window.AIHub && AIHub.showRun) AIHub.showRun(); break;
        case 'add': Views.editCard(null, deck.id, () => App.render()); break;
        case 'import': App.pickFiles(deck.id); break;
        case 'create-more': Create.open(deck.id); break;
        case 'ai-check': Store.touchDeck(deck.id); if (Views.sel.size) Views.runAiCheck([...Views.sel].map(id => Store.card(id)).filter(Boolean)); else if (window.AIHub) AIHub.checkDecks([deck.id]); else Views.runAiCheck(Store.cards(deck.id)); break;
        case 'listen': if (window.ListenUI) ListenUI.deck(deck.id); else Listen.open(deck.id); break;
        case 'gen': Views.generateDeckDialog(deck.id); break;
        case 'filter': Views.deckFilter = a.dataset.f; Views.deckLimit = 120; App.render(); break;
        case 'order': {
          UI.menu(a, [
            { label: ord ? '🔀 Перемешать ещё раз' : '🔀 Перемешать список', action: () => {
              const pos = {}; U.shuffle(Store.cards(deck.id).map(c => c.id)).forEach((cid, k) => { pos[cid] = k; });
              Views.deckOrder = { deck: deck.id, pos };
              App.render(); UI.toast('🔀 Карты перемешаны — «▶ Учить в этом порядке» пойдёт так же', 'good', 2500);
            } },
            ...(ord ? [{ label: '↕ Вернуть обычный порядок', action: () => { Views.deckOrder = null; App.render(); } }] : []),
            { label: `▶ Учить в этом порядке · ${U.cards(cards.length)}`, action: () => Study.start({ deckId: deck.id, cardIds: cards.map(c => c.id), filter: 'all', size: 0, shuffle: false }) },
            { label: '🎧 Слушать список по порядку', action: () => (window.ListenUI ? ListenUI.cards(cards.map(c => c.id), 0, `${deck.name} · список`) : Listen.open(deck.id)) },
          ]);
          break;
        }
        case 'more': Views.deckLimit += 300; App.render(); break;
        case 'select':
          if (Views.sel.size || Views.selecting) { Views.sel.clear(); Views.selecting = false; }
          else { Views.selecting = true; UI.toast('Нажимайте на карточки, чтобы выбрать. Shift+клик по «Выбрать» — все видимые.'); if (e.shiftKey) cards.forEach(c => Views.sel.add(c.id)); }
          App.render(); break;
        case 'bulk': bulkMenu(a, deck, cards); break;
        case 'speak': e.stopPropagation(); TTS.speakText(Store.card(id).no, 'no'); break;
        case 'edit': e.stopPropagation(); Views.editCard(id, deck.id, () => App.render()); break;
        case 'del': e.stopPropagation(); if (await UI.confirm('Точно удалить эту карточку?', { danger: true, ok: 'Да, удалить' })) { const en = Store.deleteCards([id]); App.render(); Views.afterDelete(en, 'Карточка удалена'); } break;
        case 'sel': e.stopPropagation(); toggleSel(id); App.render(); break;
      }
    };
  };
  /* ⚙ «Настройки занятия»: one summary line on the deck page, every choice in one window (phone and computer alike) */
  const SUM_F = { smart: 'умное повторение', all: 'все карты', new: 'только новые', debt: 'долговые', learning: 'изучаю', learned: 'выученные', leech: 'трудные' };
  const sessionCount = deckId => { const st = Store.settings; return Study.buildQueue({ deckId, filter: st.filter, dir: st.direction, size: st.sessionSize, dryRun: true }).length; };
  function sessionSumHtml() {
    const st = Store.settings, lab = (list, v) => ((list.find(x => String(x[0]) === String(v)) || [])[1] || '');
    const parts = [lab(MODES, st.mode), lab(dirsNow(), st.direction), SUM_F[st.filter] || lab(FILTERS, st.filter),
      +st.sessionSize ? U.cards(+st.sessionSize) : 'все карты', st.shuffle ? 'вперемешку' : 'по порядку'].filter(Boolean);
    // real spaces around «·» (copy, screen readers and every browser read «Карточки · 🇳🇴 → 🇷🇺 · …», never glued words)
    return `<span class="dk-sum-t">${parts.map((p, i) => `${i ? '<span class="dk-dot" aria-hidden="true"> · </span>' : ''}<span class="dk-part">${U.esc(p)}</span>`).join('')}</span>`;
  }
  /** 🤖 «Проверить нейросетью» right beside «▶ Начать» — the AI is the app's calling card, never hidden in a menu */
  function deckAiBtn(deck, stats, running, selN) {
    if (running) {
      let pct = 0; try { const st = AIHub.state(); pct = st.total ? Math.round(st.done / st.total * 100) : 0; } catch (e) { /* ignore */ }
      return `<button class="btn lg ai dk-ai" data-act="ai-run" title="Проверка нейросетью идёт — открыть"><span class="dk-ai-i" aria-hidden="true">⏳</span><span class="dk-ai-t"><b>Проверка нейросетью · ${pct}%</b><small>идёт — открыть</small></span></button>`;
    }
    const on = AI.available(), left = stats.total - stats.aiChecked;
    const sub = selN ? `выбранные карточки: ${selN}` : !stats.total ? 'сначала добавьте карточки' : on ? (left ? `${U.esc(AI.name())} · не проверено: ${left}` : `${U.esc(AI.name())} · все проверены ✓ · можно заново`) : 'подключить — Gemini и Groq бесплатно';
    const tip = selN ? `Нейросеть проверит выбранные карточки (${selN}): перевод, род, написание` : 'Нейросеть сверит переводы, род и написание всех карточек колоды и предложит исправления';
    return `<button class="btn lg ai dk-ai" data-act="ai-check" ${stats.total ? '' : 'disabled'} title="${tip}"><span class="dk-ai-i nk-bot-i" aria-hidden="true">${BOT(34)}</span><span class="dk-ai-t"><b>Проверить нейросетью${selN ? ` · ${selN}` : ''}</b><small>${sub}</small></span></button>`;
  }
  Views.sessionSheet = function (deckId) {
    const voices = () => (window.Voices && Voices.openChooser ? `<div class="ss-opt"><div class="ss-l">Голоса</div><div class="row deck-voices">${[['no', '🇳🇴', 'Норвежский'], ['uk', '🇺🇦', 'Украинский'], ['ru', '🇷🇺', 'Русский']].map(([l, fl, n]) =>
      `<button type="button" class="btn sm deck-voice" data-voices-open="${l}" data-voices-place="cards" aria-label="${n} голос для карточек — выбрать" title="${n} голос для карточек — выбрать (или как везде)">${fl} <b class="dv-lang">${n}:</b> <span data-dv-l>${U.esc(Voices.label(l, '', 'cards'))}</span> <span aria-hidden="true">›</span></button>`).join('')}</div></div>` : '');
    const body = () => {
      const st = Store.settings, n = sessionCount(deckId);
      return `<div class="ss-opt"><div class="ss-l">Как учить</div>${UI.seg('mode', MODES, st.mode)}</div>
        <div class="ss-opt"><div class="ss-l">Что показывать</div>${UI.seg('direction', dirsNow(), st.direction)}</div>
        <div class="ss-opt"><div class="ss-l">Язык перевода</div>${UI.seg('transLang', TRLANGS, Study.trLang())}</div>
        <div class="ss-opt"><div class="ss-l">Какие карты</div>${UI.seg('filter', FILTERS, st.filter)}</div>
        <div class="ss-opt"><div class="ss-l">Сколько</div><div class="row ss-size">${UI.seg('sessionSize', SIZES, st.sessionSize)}${UI.switchHtml('shuffle', st.shuffle, 'Перемешать')}</div></div>
        ${voices()}
        <div class="ss-foot"><span class="small muted">Выбор запоминается — потом просто «▶ Начать».</span>
          <button type="button" class="btn primary lg" data-ss="start" ${n ? '' : 'disabled'}>▶ Начать · ${U.cards(n)}</button></div>
        ${n ? '' : '<p class="small muted" style="margin:6px 4px 0">По этим настройкам сейчас нет карт — выберите «Все» или другой набор.</p>'}`;
    };
    if (!window.Mobile || !Mobile.sheet) return null;
    let sh = null;
    const redraw = focus => {
      sh.body.innerHTML = body();
      App.render(); // the summary line and «▶ Начать · N» on the page behind follow at once
      if (focus) { const b = sh.body.querySelector(focus); if (b) b.focus({ preventScroll: true }); }
    };
    sh = Mobile.sheet({ title: '⚙ Настройки занятия', body: body(), cls: 'sx-sheet ss-sheet', detent: 'large',
      onClick(e) {
        const sb = e.target.closest('[data-seg] button');
        if (sb) {
          const key = sb.parentElement.dataset.seg, v = sb.dataset.v;
          Store.setSetting(key, key === 'sessionSize' ? +v : v);
          redraw(`[data-seg="${key}"] button[data-v="${CSS.escape(v)}"]`); return;
        }
        if (e.target.closest('[data-ss="start"]')) { sh.close(); Study.start({ deckId }); }
      } });
    sh.body.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.key; if (k) { Store.setSetting(k, e.target.checked); redraw(`[data-key="${k}"]`); } });
    return sh;
  };
  function toggleSel(id) { if (Views.sel.has(id)) Views.sel.delete(id); else Views.sel.add(id); Views.selecting = true; }
  function bulkMenu(anchor, deck, visible) {
    const ids = [...Views.sel];
    UI.menu(anchor, [
      { label: '☑ Выбрать все видимые', action: () => { visible.forEach(c => Views.sel.add(c.id)); App.render(); } },
      { label: '▶ Учить выбранные', action: () => Study.start({ deckId: deck.id, cardIds: ids, filter: 'all' }) },
      { html: `${BOT()} Проверить выбранные (${U.esc(AI.name())})`, action: () => Views.runAiCheck(ids.map(id => Store.card(id)).filter(Boolean)) },
      { label: '🖼 Картинки для выбранных', action: () => Views.batchImages(ids.map(id => Store.card(id)).filter(Boolean)) },
      { label: '📤 Экспорт выбранных', action: () => Views.exportDialog(deck.id, ids) },
      ...(window.PrintX ? [{ label: `🖨 Печать выбранных (${ids.length})`, action: () => Views.printDeck(deck.id, ids) }] : []),
      { label: '📦 Переместить в колоду…', action: () => moveDialog(ids) },
      { label: '🏷 Добавить тег…', action: async () => { const t = await UI.prompt('Тег', '', 'например: глаголы'); if (t) { ids.forEach(id => { const c = Store.card(id); if (c && !c.tags.includes(t)) Store.updateCard(id, { tags: c.tags.concat(t) }); }); App.render(); } } },
      { label: '⇄ Поменять стороны NO/RU', action: () => { ids.forEach(id => { const c = Store.card(id); if (c) Store.updateCard(id, { no: c.ru, ru: c.no }); }); App.render(); } },
      { label: '🎨 Перерисовать картинки', action: () => Views.redrawImages(ids.map(id => Store.card(id))) },
      { label: '➕ Добавить объяснения (ИИ)', action: () => Views.addExplanations(ids.map(id => Store.card(id)), false) },
      { label: '📚 Заполнить формы слов (ИИ)', action: () => Views.enrichMany(ids.map(id => Store.card(id)), 'forms', false) },
      { label: '💬 Примеры по формам (ИИ)', action: () => Views.enrichMany(ids.map(id => Store.card(id)), 'examples', false) },
      { label: '🔁 Синонимы', action: () => Views.enrichMany(ids.map(id => Store.card(id)), 'synonyms', false) },
      { label: '♻️ Сбросить прогресс', action: async () => { if (await UI.confirm(`Сбросить прогресс изучения у ${U.cards(ids.length)}? Они снова станут новыми.`, { danger: true, ok: 'Сбросить' })) { Store.resetProgress(ids); App.render(); } } },
      { label: '🗑 Удалить выбранные', danger: true, action: async () => { if (await UI.confirm(`Точно удалить ${U.cards(ids.length)}?<br><span class="small muted">Их можно будет вернуть из 🗑 Корзины в течение 30 дней.</span>`, { danger: true, ok: 'Да, удалить' })) { const en = Store.deleteCards(ids); Views.sel.clear(); App.render(); Views.afterDelete(en, `Удалено: ${U.cards(ids.length)}`); } } },
    ]);
  }
  function moveDialog(ids) {
    const decks = Store.decksByUse ? Store.decksByUse() : Store.decks();
    const m = UI.modal({
      title: 'Переместить карточки', cls: 'narrow',
      body: `<select class="input">${decks.map(d => `<option value="${d.id}">${U.esc(d.name)}</option>`).join('')}<option value="__new">➕ Новая колода…</option></select>`,
      foot: '<button class="btn primary" data-ok>Переместить</button>',
    });
    m.$('[data-ok]').onclick = async () => {
      let id = m.$('select').value;
      if (id === '__new') { const n = await UI.prompt('Новая колода'); if (!n) return; id = Store.addDeck(n).id; }
      Store.moveCards(ids, id); Views.sel.clear(); m.close(); App.render();
    };
  }
  /* =====================================================================
   * 🃏 card viewer: look at a card (both sides, forms, examples…), ‹ › through the list,
   * ▶ learn from this card on (in the list's order), ✏️ edit, 📐 grammar. Opened by a tap on a card.
   * opts.deckId: learning starts in this deck; opts.inSession: called from the study screen (jump to the card)
   * ===================================================================== */
  Views.viewCard = function (id, list, opts = {}) {
    const ids = (list && list.length ? list : [id]).filter(x => Store.card(x));
    let i = Math.max(0, ids.indexOf(id));
    let hide = !!Store.settings.viewHide;
    const m = UI.modal({
      title: '🃏 Карточка', cls: 'wide card-view',
      body: '<div data-cv></div>',
      foot: `<button class="btn" data-cv="prev" title="Предыдущая (←)">‹</button><span class="small muted cv-pos" data-cv-pos></span><button class="btn" data-cv="next" title="Следующая (→)">›</button>
        <span class="grow"></span>
        <button class="btn" data-cv="edit">✏️ Редактировать</button>
        <button class="btn primary" data-cv="study">${opts.inSession ? '▶ Перейти к этой карте' : '▶ Учить с этой карты'}</button>`,
      onClose: () => document.removeEventListener('keydown', onKey, true),
    });
    const say = (t, lang) => t ? `<button class="icon-btn sm ex-say" data-act="say" data-say="${U.esc(t)}" data-lang="${lang}" title="${lang === 'ru' ? 'Произнести по-русски' : 'Произнести по-норвежски'}">🔊${lang === 'ru' ? '<small>RU</small>' : ''}</button>` : '';
    /** the translation in the chosen language (🔊 only for Russian: there is no Ukrainian voice) */
    const trBox = c => {
      const l = Study.trLang(), uk = Study.ukOf(c), ru = String(c.ru || '');
      const ruLine = `<div class="cv-ru" lang="ru">${UI.rich(ru)} ${say(ru.split('\n')[0], 'ru')}</div>`;
      const ukLine = `<div class="cv-ru cv-uk" lang="uk"><span class="tr-flag" aria-label="Українською">🇺🇦</span> ${UI.rich(uk)}</div>`;
      if (l === 'uk') return uk ? ukLine : ruLine + (ru.trim() ? Study.trFbHtml() : '');
      if (l === 'both' && uk && uk !== ru.trim()) return ruLine + ukLine;
      return ruLine;
    };
    const draw = () => {
      const c = Store.card(ids[i]);
      if (!c) { m.close(); return; }
      m.$('[data-cv]').dataset.cid = c.id; // a ✎ correction redraws the card shown here
      const img = c.image && !Images.isRemoteAI(c.image) ? `<img class="cv-img" src="${U.esc(c.image)}" alt="" onerror="this.remove()">` : '';
      m.$('[data-cv]').innerHTML = `
        <div class="cv-front">
          ${img}
          <div class="cv-word"><span>${UI.rich(c.no)}</span> ${say(String(c.no).split('\n')[0], 'no')}${aim(c, 'no', 'aim-view')}</div>
          <div class="cv-meta">${UI.statusChip(Store.status(c))}${c.wordClass ? `<span class="chip gt-chip">${window.Gram ? Gram.pos(c.wordClass) : U.esc(c.wordClass)}</span>` : ''}${window.Gram && Gram.cardGender(c) ? `<span class="chip gt-chip">${Gram.gender(Gram.cardGender(c))}</span>` : ''}${Prov.badges(c, 16)}</div>
        </div>
        <div class="cv-back ${hide ? 'veiled' : ''}" data-cv="reveal" title="${hide ? 'Нажмите, чтобы увидеть перевод' : ''}">
          ${hide ? '<div class="cv-veil">🙈 Вспомните перевод — и нажмите, чтобы проверить</div>' : ''}
          ${aim(c, 'tr', 'aim-view aim-float')}${trBox(c)}
          ${Study.viewBarHtml(c)}
          ${c.description ? `<div class="desc cv-desc" data-desc-box>${Study.descHtml(c)}</div>` : ''}
          ${Study.formsHtml(c)}${Study.synonymsHtml(c)}${Study.examplesHtml(c)}
          ${c.example ? `<div class="example">${UI.rich(c.example)} ${say(c.example, 'no')}${c.exampleRu ? `<span class="tr">${UI.rich(c.exampleRu)}</span>` : ''}</div>` : ''}
        </div>
        <div class="row cv-tools">
          <button class="btn sm" data-cv="read" title="Прочитать всю карточку вслух">🔊 Читать всё</button>
          ${ids.length > 1 ? `<button class="btn sm listen-cta" data-cv="listen" title="Слушать карточки подряд, начиная с этой — в наушниках или через динамик">${Listen.HEADPHONES(16, true)} Слушать подряд</button>` : ''}
          <button class="btn sm ${hide ? 'primary' : ''}" data-cv="hide" title="Прятать перевод, пока не нажмёте — чтобы проверять себя (пробел)">🙈 ${hide ? 'Перевод скрыт' : 'Скрывать перевод'}</button>
          <button class="btn sm" data-cv="grammar">📐 Грамматика</button>
          <button class="btn sm" data-cv="copy">📋 Копировать</button>
        </div>`;
      m.$('[data-cv-pos]').textContent = `${i + 1} из ${ids.length}`;
      m.$('[data-cv="prev"]').disabled = i === 0;
      m.$('[data-cv="next"]').disabled = i >= ids.length - 1;
      // sentence / word translations for the chosen view of the examples
      Study.fillExamples(c, () => { const cur = Store.card(ids[i]); if (cur && cur.id === c.id) Study.redrawIn(m.$('[data-cv]'), cur); });
    };
    const go = d => { const n = i + d; if (n < 0 || n >= ids.length) return; i = n; TTS.stop(); draw(); m.$('.modal-body').scrollTop = 0; };
    const onKey = e => {
      if (!document.body.contains(m.el) || /input|textarea|select/i.test((e.target.tagName || ''))) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(-1); }
      if (e.key === ' ' && hide) { e.preventDefault(); e.stopPropagation(); const b = m.$('.cv-back'); if (b) b.classList.remove('veiled'); }
    };
    document.addEventListener('keydown', onKey, true);
    // swipe left / right on phones
    let sx = null;
    m.el.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    m.el.addEventListener('touchend', e => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 70) go(dx < 0 ? 1 : -1); }, { passive: true });
    m.el.addEventListener('click', async e => {
      const b = e.target.closest('[data-cv]');
      const a = e.target.closest('[data-act]');
      const c = Store.card(ids[i]);
      if (a) {
        const act = a.dataset.act;
        if (act === 'say') TTS.speak(a.dataset.say, a.dataset.lang || 'no');
        else if (act === 'ex-view') { Store.setSetting('exView', a.dataset.v); draw(); }
        else if (act === 'ex-read' && c) await Study.exRead(c, +a.dataset.i, a);
        else if (act === 'mt-toggle') a.classList.toggle('open');
        return;
      }
      if (!b || !c) return;
      switch (b.dataset.cv) {
        case 'prev': go(-1); break;
        case 'next': go(1); break;
        case 'reveal': b.classList.remove('veiled'); break;
        case 'hide': hide = !hide; Store.setSetting('viewHide', hide); draw(); break;
        case 'read': TTS.speakText(Study.cardText(c), 'all'); break;
        case 'listen': m.close(); ListenUI.cards(ids, i, opts.deckId && Store.deck(opts.deckId) ? Store.deck(opts.deckId).name : 'Карточки'); break;
        case 'grammar': Grammar.open(c); break;
        case 'copy': Study.copyText(Study.cardText(c), 'Текст карточки скопирован'); break;
        case 'edit': m.close(); Views.editCard(c.id, c.deckId, () => App.render()); break;
        case 'study': {
          m.close();
          if (opts.inSession && opts.onJump) { opts.onJump(c.id); break; }
          // from this card to the end of the list, then the cards before it
          const order = ids.slice(i).concat(ids.slice(0, i));
          Study.start({ deckId: opts.deckId || c.deckId, cardIds: order, filter: 'all', size: 0, shuffle: false });
          break;
        }
      }
    });
    draw();
    return m;
  };
  /** ✓ «проверено нейросетью» mark of one side (js/aihub.js): 'no' = the Norwegian side, 'tr' = the translation */
  const aim = (c, side, cls) => (window.AIHub && AIHub.markHtml ? AIHub.markHtml(c, side, { cls: cls || 'aim-list' }) : '');
  function miniCard(c, i) {
    const s = Store.status(c);
    const sel = Views.sel.has(c.id);
    const first = t => String(t || '').split('\n')[0];
    return `<div class="mini-card ${sel ? 'selected' : ''}" data-id="${c.id}" style="animation-delay:${Math.min(i, 20) * 15}ms">
      ${Views.selecting || Views.sel.size ? `<input type="checkbox" class="sel" data-act="sel" data-id="${c.id}" ${sel ? 'checked' : ''}>` : ''}
      <div class="thumb">${UI.imgThumb(c)}</div>
      <div class="txt">
        <div class="no${aim(c, 'no') ? ' has-aim' : ''}" title="${U.esc(c.no)}"><span class="mc-t">${UI.rich(first(c.no))}</span>${aim(c, 'no')}</div>
        <div class="ru${aim(c, 'tr') ? ' has-aim' : ''}" title="${U.esc(Study.tr(c))}"><span class="mc-t">${Study.trRuOnly(c) ? '<span class="tr-fb-mini" title="Украинского перевода пока нет — показан русский">🇷🇺</span> ' : ''}${UI.rich(first(Study.tr(c)))}</span>${aim(c, 'tr')}</div>
        <div class="meta">${UI.statusChip(s)}${Prov.badges(c, 14)}${Store.isLeech(c) ? '<span class="chip debt">🐛</span>' : ''}</div>
      </div>
      <div class="tools">
        <button class="icon-btn sm" data-act="speak" data-id="${c.id}" title="Прослушать">🔊</button>
        <button class="icon-btn sm" data-act="edit" data-id="${c.id}" title="Редактировать">✏️</button>
        <button class="icon-btn sm" data-act="del" data-id="${c.id}" title="Удалить">🗑</button>
      </div>
    </div>`;
  }

  /* =====================================================================
   * 🖼 THE PICTURE OF A CARD — every source in one place.
   * The card editor (its picture buttons) and the study card («🖼 Заменить фото», «📌 Картинка из Pinterest»)
   * use the same code: Views.picSource(kind, card, hooks) runs one source, Views.pickCardImage(card, onDone) is
   * the chooser with all of them. A picked picture is a patch with its credit / licence:
   * { image, imageAuto, imageSrc, imageCredit, imageCreditUrl, imageNone }.
   * ===================================================================== */
  const PIC_SOURCES = [
    // 📌 the gallery = «Pinterest inside the app»: a photo wall with Norwegian themes; real Pinterest (copy → paste) is its second tab
    { k: 'feed', ic: '📌', l: 'Галерея картинок', t: 'Как в Pinterest — фото по слову и норвежским темам, прямо здесь' },
    { k: 'search', ic: '📷', l: 'Wikimedia и Википедия', t: 'Свободные фото, свои и вставленные — автор сохранится' },
    { k: 'photo', ic: '🌍', l: 'Реальное фото', t: 'Подберётся само по смыслу слова' },
    { k: 'gen', ic: '✨', l: 'Нарисовать', t: 'Новая картинка по смыслу слова' },
    { k: 'emoji', ic: '😀', l: 'Из эмодзи', t: 'Мгновенно, без интернета' },
    { k: 'hist', ic: '🏛', l: 'Исторические фото', t: 'Старая Норвегия, с автором', ok: () => !!(window.ArtCards && ArtCards.historicPick) },
    { k: 'url', ic: '🔗', l: 'По ссылке', t: 'Адрес картинки https://…' },
    { k: 'file', ic: '📁', l: 'С устройства', t: 'Файл, галерея или камера' },
  ];
  const picWord = card => String((card && card.no) || '').split('\n')[0].replace(/^(en|ei|et|å)\s+/i, '').trim().slice(0, 60);
  /** a calm Russian sentence instead of a technical error */
  const picErr = e => (U.niceErr ? U.niceErr(e) : (/[а-яё]/i.test((e && e.message) || '') ? e.message : 'Картинка не получилась — попробуйте другой источник'));
  /** the stored picture fields: a new picture always replaces the old credit (no wrong author under a new photo) */
  const picPatch = (image, extra) => Object.assign({ image: image || '', imageAuto: false, imageSrc: '', imageCredit: '', imageCreditUrl: '', imageNone: '' }, extra || {});
  /**
   * run one picture source for a card. hooks: { onPick(patch), busy(on) — a spinner while drawing / loading,
   * variant (another picture each time), again (a new AI variant, not the cached one) }.
   * Sources with their own window (search, Pinterest, history, link) call onPick only when a picture was chosen.
   */
  Views.picSource = function (kind, card, h = {}) {
    const pick = p => { if (p && h.onPick) h.onPick(p); };
    const run = async fn => {
      if (h.busy) h.busy(true);
      try { pick(await fn()); } catch (err) { UI.toast(picErr(err), err && err.noFit ? 'warn' : 'bad', 5000); }
      finally { if (h.busy) h.busy(false); }
    };
    // drawn / found automatically: where it came from and the photo's author go with it (like Images.ensure)
    const auto = img => {
      if (Images.lastSource !== 'ai' && Images.limited()) Guides.images();
      return picPatch(img, { imageAuto: true, imageSrc: Images.lastSource || '', imageCredit: Images.lastCredit || '', imageCreditUrl: Images.lastCreditUrl || '' });
    };
    const variant = h.variant || 0;
    const prov = Store.settings.imageProvider === 'off' ? 'pollinations' : Store.settings.imageProvider;
    switch (kind) {
      // 🔎 «Лента фото» (js/gallery.js): Openverse + Wikimedia (+ own Unsplash / Pexels keys); 📌 Pinterest is its second tab
      case 'feed': return Views.gallery({
        title: '📌 Галерея картинок', word: picWord(card), en: card.en || '', max: 900,
        hint: String((window.Study && Study.tr ? Study.tr(card) : card.ru) || '').split('\n')[0].slice(0, 60),
        onPick: r => pick(picPatch(r.image, { imageSrc: r.src || 'photo', imageCredit: r.credit || '', imageCreditUrl: /^https:\/\//i.test(r.page || '') ? r.page : '' })),
        onPinterest: window.ArtCards && ArtCards.pinterestPick ? () => Views.picSource('pin', card, h) : null,
      });
      case 'gen': return run(async () => auto(await Images.generate(card, h.again
        ? { provider: prov === 'emoji' || prov === 'wikimedia' ? 'pollinations' : prov, seed: Math.floor(Math.random() * 1e6), variant, newScene: variant > 3 }
        : { provider: prov })));
      case 'photo': return run(async () => auto(await Images.generate(card, { provider: 'wikimedia', variant })));
      case 'emoji': return run(async () => auto(await Images.generate(card, { provider: 'emoji', variant })));
      case 'search': return Photos.pick({
        title: '🔎 Фото для карточки', query: card.en || picWord(card) || 'norge', max: 900,
        onPick: (data, credit, page) => {
          const mine = /^(моё фото|вставлено)$/.test(credit || '');
          pick(picPatch(data, mine ? {} : { imageSrc: 'photo', imageCredit: credit || '', imageCreditUrl: /^https:\/\//i.test(page || '') ? page : '' }));
        },
      });
      case 'pin': return ArtCards.pinterestPick({ word: card.no, onPick: src => {
        const s = Store.Safe.image(src);
        if (s) pick(picPatch(s, { imageSrc: 'pinterest' }));
        else UI.toast('Эта картинка не подходит — выберите JPG, PNG или WebP', 'warn');
      } });
      // 🏛 a free licence: the author, the licence and the source page stay with the picture
      case 'hist': return ArtCards.historicPick({ word: card.no, onPick: r => pick(picPatch(r.image, { imageSrc: r.src, imageCredit: r.credit, imageCreditUrl: r.page })) });
      case 'url': return (async () => {
        const u = String((await UI.prompt('Ссылка на картинку', '', 'https://…')) || '').trim();
        if (!u) return;
        const s = Store.Safe.image(u);
        if (!s) { UI.toast('Нужна ссылка на саму картинку: https://… (JPG, PNG, WebP или GIF)', 'warn', 5000); return; }
        run(async () => {
          try { await Images.preload(s, 20000); } catch (e) { throw new Error('По этой ссылке картинка не открылась — скопируйте саму картинку и вставьте её через «🔎 Найти фото»'); }
          let data = ''; try { data = await U.compressImage(s, 900, 0.86); } catch (e) { data = ''; } // a copy inside the app when the site allows it
          return picPatch(Store.Safe.image(data) || s, { imageCreditUrl: s });
        });
      })();
      case 'file': {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = () => {
          const f = inp.files && inp.files[0]; if (!f) return;
          if (!/^image\//.test(f.type) || /svg/i.test(f.type)) { UI.toast('Подойдут JPG, PNG, WebP или GIF', 'warn'); return; }
          run(async () => { try { return picPatch(await U.compressImage(f, 900, 0.86)); } catch (e) { throw new Error('Эту картинку не получилось открыть — попробуйте другую'); } });
        };
        inp.click(); return;
      }
      // ✕ no picture — and none is drawn again by itself (remembered like «nothing fits»)
      case 'none': return pick(picPatch('', { imageNone: Images.noneKey ? Images.noneKey(card) : '' }));
    }
  };
  /* 🔎 «Лента фото» — js/gallery.js + css/gallery.css, loaded on first use (like «🔊 Голоса») */
  let galUi = null;
  Views.loadGallery = function () {
    if (galUi) return galUi;
    const v = (document.querySelector('script[src*="js/views.js"]') || {}).src || '';
    const q = (v.match(/\?v=[^&]+/) || [''])[0];
    if (!document.querySelector('link[data-gallery]')) {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = 'css/gallery.css' + q; l.setAttribute('data-gallery', '');
      document.head.appendChild(l);
    }
    galUi = window.Gallery ? Promise.resolve(window.Gallery) : new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'js/gallery.js' + q; s.async = true;
      s.onload = () => (window.Gallery ? res(window.Gallery) : rej(new Error('no gallery')));
      s.onerror = () => rej(new Error('no gallery'));
      document.head.appendChild(s);
    });
    galUi.catch(() => { galUi = null; });
    return galUi;
  };
  /** open the feed: { word, hint, en, query, title, applyLabel, max, onPick({ image, src, credit, page }), onPinterest, onOther } */
  Views.gallery = async function (o) {
    o = Object.assign({}, o || {});
    // 🎨 the chosen card template (Викинги, Тролли, Лофотены…) suggests its own photos first (js/gallery.js)
    if (o.artTheme === undefined) { try { o.artTheme = ((Store.Safe && Store.Safe.art ? Store.Safe.art(Store.settings.art) : Store.settings.art) || {}).theme || ''; } catch (e) { o.artTheme = ''; } }
    try { const G = await Views.loadGallery(); return G.open(o); }
    catch (e) { UI.toast('Ленту фото не получилось открыть — проверьте интернет и попробуйте ещё раз', 'warn'); return null; }
  };
  /** a deck's cover from the feed (📁 the device, ⌘V and Wikimedia stay one tab away) */
  const coverPick = (query, onPick) => Views.gallery({
    title: '🖼 Обложка колоды', query, max: 1100, applyLabel: '✓ Сделать обложкой',
    onPick: r => onPick(r.image, r.credit || ''),
    onOther: () => Photos.pick({ title: '🖼 Обложка колоды', query, max: 1100, onPick: (data, cr) => onPick(data, cr) }),
    otherLabel: '📁 С устройства и Wikimedia',
  });

  /** store a picked picture on a card + one «↶ Вернуть» toast (the previous one goes: no pile of toasts). onUndo(before) */
  let picToast = null;
  Views.picApply = function (id, patch, msg, onUndo) {
    const f = Store.card(id); if (!f) return;
    const before = picPatch(f.image, { imageAuto: !!f.imageAuto, imageSrc: f.imageSrc || '', imageCredit: f.imageCredit || '', imageCreditUrl: f.imageCreditUrl || '', imageNone: f.imageNone || '' });
    Store.updateCard(id, patch);
    if (picToast) picToast.close();
    const t = picToast = UI.toastAction(msg, '↶ Вернуть', () => {
      if (picToast === t) picToast = null;
      if (!Store.card(id)) return;
      Store.updateCard(id, before);
      if (onUndo) onUndo(before);
    }, 8000, '🖼');
  };
  /**
   * 🖼 the chooser: every picture source for this card, the current picture on top.
   * onDone(patch) gets the chosen picture; opts.save !== false → it is stored on the card right away (with ↶ undo).
   */
  Views.pickCardImage = function (card, onDone, opts = {}) {
    const cur = (card && card.id && Store.card(card.id)) || card;
    if (!cur) return null;
    const has = !!(cur.image && !(Images.isRemoteAI && Images.isRemoteAI(cur.image)));
    const credit = has && cur.imageCredit ? (/^https:\/\//i.test(cur.imageCreditUrl || '') ? `<a href="${U.esc(cur.imageCreditUrl)}" target="_blank" rel="noopener">${U.esc(cur.imageCredit)}</a>` : U.esc(cur.imageCredit)) : '';
    Views.loadGallery().catch(() => {}); // «🔎 Лента фото» opens at once (its styles also mark its tile)
    const tile = s => `<button type="button" class="pic-src ${s.k === 'feed' ? 'pic-src-feed' : ''}" data-pic="${s.k}"><span class="pic-src-i" aria-hidden="true">${s.ic}</span><span class="pic-src-t"><b>${s.l}</b><small>${s.t}</small></span></button>`;
    let variant = 0, busyOn = false;
    const m = UI.modal({
      title: has ? '🖼 Заменить фото' : '🖼 Добавить фото', cls: 'pic-modal',
      body: `<div class="pic-cur">${has ? `<img src="${U.esc(cur.image)}" alt="Сейчас на карточке">` : '<span class="pic-cur-none" aria-hidden="true">🖼</span>'}
          <div class="pic-cur-t"><b lang="no">${U.esc(String(cur.no || '').split('\n')[0].slice(0, 80))}</b><span class="small muted">${has ? (credit || 'Сейчас на карточке') : 'У карточки пока нет картинки'}</span></div></div>
        <div class="pic-grid" role="group" aria-label="Откуда взять картинку">${PIC_SOURCES.filter(s => !s.ok || s.ok()).map(tile).join('')}</div>
        ${has ? '<div class="pic-foot-row"><button type="button" class="btn ghost sm" data-pic="none">✕ Без фото</button></div>' : ''}`,
    });
    const busy = on => {
      busyOn = on;
      m.el.classList.toggle('pic-busy', on);
      m.$$('[data-pic]').forEach(b => { b.disabled = on; });
      const box = m.$('.pic-cur');
      if (on) box.insertAdjacentHTML('beforeend', '<span class="spinner pic-spin" role="status" aria-label="Подбираю картинку…"></span>');
      else { const s = box.querySelector('.pic-spin'); if (s) s.remove(); }
    };
    const apply = patch => {
      m.close(); // (a picture chosen after the chooser was closed is still wanted — it is applied all the same)
      if (opts.save !== false && cur.id && Store.card(cur.id)) Views.picApply(cur.id, patch, patch.image ? (has ? 'Фото заменено' : 'Фото добавлено') : 'Фото убрано с карточки', p => onDone && onDone(p, true));
      if (onDone) onDone(patch);
    };
    m.el.addEventListener('click', e => {
      const b = e.target.closest('[data-pic]'); if (!b || busyOn) return;
      const k = b.dataset.pic;
      Views.picSource(k, Store.card(cur.id) || cur, { onPick: apply, busy, variant: k === 'gen' || k === 'photo' || k === 'emoji' ? variant++ : 0, again: has || variant > 1 });
    });
    return m;
  };

  /* =====================================================================
   * CARD EDITOR
   * ===================================================================== */
  /** opts (new cards from a learning tool — CardMaker): { prefill: {no, ru, …}, fieldBy: {field: 'import'|'tr:google'|…},
   *  srcBy: who the source is (its history entry comes first; default fieldBy.no), note: where it came from, mtWarn, onCancel } */
  Views.editCard = function (cardId, deckId, onSaved, opts = {}) {
    const existing = cardId ? Store.card(cardId) : null;
    const c = existing ? JSON.parse(JSON.stringify(existing)) : Object.assign({ no: '', ru: '', uk: '', en: '', description: '', example: '', exampleRu: '', wordClass: '', tags: [], image: '', imagePrompt: '' }, opts.prefill || {});
    if (c.uk == null) c.uk = '';
    if (!existing && opts.mtWarn) c.mtWarn = opts.mtWarn;
    const srcBy = !existing && opts.fieldBy ? (opts.srcBy || opts.fieldBy.no) : null;
    let variants = c.image ? [c.image] : [];
    // 🔊 the voice of this side (the cards' own voice, or «как везде») — right at the field; after the textarea so the label still names it
    const voiceBtn = k => window.Voices && Voices.openChooser && ['no', 'ru', 'uk'].includes(k)
      ? `<button type="button" class="ed-voice" data-voices-open="${k}" data-voices-place="cards" title="Голос для карточек: ${k === 'no' ? 'норвежский' : k === 'uk' ? 'украинский' : 'русский'} — выбрать">🔊 Голос</button>` : '';
    const ta = (k, label, rows, ph = '') => `<label class="field ed-field"><span>${label}</span><textarea class="input" data-f="${k}" rows="${rows}" placeholder="${ph}">${U.esc(c[k])}</textarea>${voiceBtn(k)}</label>`;
    const rowsFor = s => Math.min(10, Math.max(1, String(s || '').split('\n').length + (String(s || '').length > 60 ? 1 : 0)));
    // unsaved changes are never lost silently: ✕ / Esc / tap outside / «Отмена» ask first
    let saving = false, initial = null;
    const m = UI.modal({
      title: existing ? '✏️ Редактирование карточки' : '➕ Новая карточка', cls: 'wide',
      onClose: () => { if (!saving && opts.onCancel) opts.onCancel(); },
      beforeClose: UI.guard(() => saving || initial === null || JSON.stringify(read()) === initial ? null
        : { title: 'Закрыть без сохранения?', line: 'Изменения в карточке не сохранены.', actions: [{ label: 'Закрыть', value: 'close', cls: 'bad' }], cancel: 'Вернуться к карточке' }),
      body: `
        ${!existing && opts.note ? `<div class="cm-src"><span class="cm-src-ico">📍</span><span class="cm-src-t"><b>Откуда:</b> ${U.esc(opts.note)}</span></div>` : ''}
        <div class="tr-fields">
          ${ta('no', '🇳🇴 Норвежский (лицевая сторона)', rowsFor(c.no), 'например: en bil')}
          ${Translators.railHtml('vertical', existing)}
          <div class="tr-col">
            ${ta('ru', '🇷🇺 Русский (обратная сторона)', rowsFor(c.ru), 'например: машина')}
            ${ta('uk', '🇺🇦 Українською <small class="muted">· перевод на украинский, необязательно</small>', rowsFor(c.uk), 'например: машина')}
          </div>
        </div>
        <div class="ed-ai-row"><span class="small muted">${BOT()} Нейросети:</span>${Translators.aiRailHtml('horizontal', existing)}</div>
        <div class="small muted tr-hint">🌐 Переводчики (между полями) и ${BOT()} нейросети: заполнена одна сторона — переведут во вторую; заполнены обе — сверят перевод. ⚖️ — сравнить все сразу.</div>
        <div data-tr-out></div>
        <div class="row" style="gap:8px">
          <button class="btn sm" data-act="speak-no">🔊 NO</button><button class="btn sm" data-act="speak-ru">🔊 RU</button>
          <button class="btn sm" data-act="swap">⇄ Поменять стороны</button>
          <span class="grow"></span>
          <button class="btn sm ai" data-act="ai-fill">${aiIco(AI.current(), 14)} ${U.esc(AI.name())}: заполнить</button>
          <button class="btn sm ai" data-act="ai-check">${aiIco(AI.current(), 14)} ${U.esc(AI.name())}: проверить</button>
          <button class="btn sm ai" data-act="ai-explain" title="Нейросеть допишет объяснение: формы, примеры, выражения — перевод в скобках">➕ Объяснение</button>
        </div>
        ${ta('description', '📝 Описание / грамматика / заметки', Math.max(3, rowsFor(c.description)), 'формы слова, нюансы, ваши заметки')}
        <details class="ed-forms" ${(c.forms || []).length || (c.examples || []).length ? 'open' : ''}>
          <summary>📚 Формы слова и 💬 примеры по формам ${(c.forms || []).length ? `<span class="chip">${c.forms.length} форм</span>` : ''}${(c.examples || []).length ? `<span class="chip">${c.examples.length} примеров</span>` : ''}</summary>
          <div class="row" style="gap:8px;margin:8px 0">
            <button class="btn sm ai" data-act="ai-forms">📚 Заполнить формы (${U.esc(AI.name())})</button>
            <button class="btn sm ai" data-act="ai-examples">💬 Примеры по формам (${U.esc(AI.name())})</button>
            <button class="btn sm ai" data-act="ai-synonyms">🔁 Синонимы (${U.esc(AI.available() ? AI.name() : 'Ordbøkene')})</button>
          </div>
          <label class="field"><span>📚 Формы — по строке: название | норвежский | перевод</span>
            <textarea class="input" data-f="forms" rows="${Math.max(3, Math.min(10, (c.forms || []).length + 1))}" placeholder="Прошедшее (preteritum) | drakk | пил">${U.esc(formsToLines(c.forms))}</textarea></label>
          <label class="field"><span>💬 Примеры — по строке: название | норвежский | русский | когда употребляется</span>
            <textarea class="input" data-f="examples" rows="${Math.max(3, Math.min(10, (c.examples || []).length + 1))}" placeholder="Прошедшее (preteritum) | Jeg drakk kaffe i går. | Я пил кофе вчера. | действие в прошлом">${U.esc(formsToLines(c.examples, true))}</textarea></label>
          <label class="field"><span>🔁 Синонимы — по строке: норвежский | перевод | чем отличается, когда употреблять</span>
            <textarea class="input" data-f="synonyms" rows="${Math.max(2, Math.min(8, (c.synonyms || []).length + 1))}" placeholder="å skjønne | понимать | разговорное, чаще в речи">${U.esc(synToLines(c.synonyms))}</textarea></label>
        </details>
        <div class="field-row">
          ${ta('example', '💬 Пример (NO)', 2, 'Jeg kjører bil.')}
          ${ta('exampleRu', '💬 Перевод примера (RU)', 2, 'Я веду машину.')}
        </div>
        <div class="field-row">
          <label class="field"><span>Часть речи <small class="muted">· ordklasse</small></span>${window.Gram ? Gram.posSelect(c.wordClass) : `<input class="input" data-f="wordClass" list="wc-list" value="${U.esc(c.wordClass)}">
            <datalist id="wc-list">${['substantiv', 'verb', 'adjektiv', 'adverb', 'preposisjon', 'pronomen', 'konjunksjon', 'tallord', 'interjeksjon', 'uttrykk'].map(x => `<option value="${x}">`).join('')}</datalist>`}</label>
          <label class="field"><span>🏷 Теги (через пробел)</span><input class="input" data-f="tags" value="${U.esc((c.tags || []).join(' '))}"></label>
        </div>
        <div class="img-editor">
          <div class="img-box" id="ed-img">${c.image ? `<img src="${U.esc(c.image)}" alt="">` : '<span class="muted small">нет картинки</span>'}</div>
          <div class="col">
            <label class="field"><span>🎨 Что нарисовать (EN, можно пусто — по смыслу слова)</span><input class="input" data-f="imagePrompt" value="${U.esc(c.imagePrompt)}" placeholder="a red car on a road"></label>
            <div class="row" style="gap:6px">
              <button class="btn sm primary" data-act="img-gen">✨ Сгенерировать</button>
              <button class="btn sm" data-act="img-again">🔄 Другой вариант</button>
              <button class="btn sm" data-act="img-photo">🌍 Реальное фото</button>
              <button class="btn sm" data-act="img-feed" title="Галерея картинок, как в Pinterest: фото по слову и норвежским темам — свободные лицензии, с автором">📌 Галерея</button>
              <button class="btn sm" data-act="img-search" title="Поиск фото: Wikimedia Commons и Википедия — свободные лицензии, с автором">📷 Wikimedia</button>
              <button class="btn sm" data-act="img-emoji" title="Картинка из эмодзи — мгновенно, без интернета">😀 Эмодзи</button>
              <button class="btn sm" data-act="img-upload">📁 Загрузить</button>
              <button class="btn sm" data-act="img-url">🔗 URL</button>
              ${window.ArtCards && ArtCards.historicPick ? '<button class="btn sm" data-act="img-hist" title="Исторические фото Норвегии — только свободные лицензии, с автором">🏛 История</button>' : ''}
              <button class="btn sm" data-act="img-del">✕ Убрать</button>
            </div>
            <div class="img-variants"></div>
          </div>
        </div>
        ${existing ? `<div class="small muted row" style="gap:6px">Статус: ${UI.statusLabel(Store.status(existing))} · NO→RU: ${srsInfo(existing.srs.nr)} · RU→NO: ${srsInfo(existing.srs.rn)}
          ${Prov.sources(existing).length ? `· Происхождение: ${Prov.badges(existing, 18)} <button class="btn sm" data-act="history">🧾 История</button>` : ''}</div>` : ''}
      `,
      foot: `${existing ? '<button class="btn bad" data-act="delete" style="margin-right:auto">🗑 Удалить</button>' : ''}
        <button class="btn ghost" data-act="cancel">Отмена</button>
        ${!existing && !opts.prefill ? '<button class="btn" data-act="save-more">Сохранить и ещё</button>' : ''}
        <button class="btn primary" data-act="save">💾 Сохранить <span class="kbd">Ctrl+Enter</span></button>`,
    });
    const read = () => {
      m.$$('[data-f]').forEach(el => {
        const f = el.dataset.f;
        c[f] = f === 'tags' ? el.value.split(/[\s,]+/).filter(Boolean) : f === 'synonyms' ? linesToSyn(el.value) : (f === 'forms' || f === 'examples') ? linesToForms(el.value) : el.value.trim();
      });
      return c;
    };
    // provenance: who filled each field during this edit (manual typing / translator / AI)
    const before = existing ? JSON.parse(JSON.stringify(existing)) : { no: '', ru: '', description: '', example: '', exampleRu: '', wordClass: '', tags: [] };
    const src = {};
    // prefilled from a learning tool: each field is credited to whoever filled it (the source, a translator…)
    if (!existing && opts.fieldBy) Object.entries(opts.fieldBy).forEach(([k, by]) => { const v = c[k]; if (by && v && (!Array.isArray(v) || v.length)) src[k] = by; });
    const pendingHist = [];
    let lastFocus = 'no';
    m.el.addEventListener('input', e => { const f = e.target.dataset && e.target.dataset.f; if (f) src[f] = 'manual'; });
    m.el.addEventListener('focusin', e => { const f = e.target.dataset && e.target.dataset.f; if (f === 'no' || f === 'ru') lastFocus = f; });
    const write = (obj, by) => {
      Object.entries(obj).forEach(([k, v]) => {
        const el = m.$(`[data-f="${k}"]`);
        if (!el || v == null) return;
        if (!(el.tagName === 'SELECT' && window.Gram && Gram.setSelect(el, v))) el.value = k === 'tags' ? [].concat(v).join(' ') : k === 'synonyms' ? synToLines(v) : (k === 'forms' || k === 'examples') ? formsToLines(v, k === 'examples') : v;
        if (k === 'forms' || k === 'examples' || k === 'synonyms') { el.rows = Math.max(3, Math.min(12, v.length + 1)); el.closest('details').open = true; }
        src[k] = by || 'manual';
        el.classList.add('glow-good'); setTimeout(() => el.classList.remove('glow-good'), 900);
      });
      read();
    };
    const historyOnSave = () => {
      const changed = Prov.diff(before, c, ['no', 'ru', 'uk', 'description', 'example', 'exampleRu', 'wordClass', 'tags', 'forms', 'examples', 'synonyms']);
      const groups = {};
      Object.entries(changed).forEach(([k, v]) => { const by = src[k] || 'manual'; (groups[by] = groups[by] || {})[k] = v; });
      const entries = Object.entries(groups).map(([by, fields]) => {
        const keys = Object.keys(fields);
        const special = by !== 'manual' && keys.length === 1 && ['forms', 'examples', 'synonyms'].includes(keys[0]) ? keys[0] : null;
        if (srcBy && by === srcBy) return Prov.entry(by, 'import', fields, opts.note || '');
        return Prov.entry(by, special || (by === 'manual' ? (existing ? 'edit' : 'create') : by.startsWith('tr:') ? 'translate' : existing ? 'edit' : 'fill'), fields);
      });
      if (srcBy) entries.sort((a, b) => (b.by === srcBy) - (a.by === srcBy)); // «where it came from» first
      // the machine-translation flag goes away when the person replaced the translation themselves
      if (!existing && c.mtWarn && src.ru === 'manual' && (!c.exampleRu || src.exampleRu === 'manual' || !opts.fieldBy || !/^tr:(google|mozhi|mymemory|microsoft|deepl)$/.test(opts.fieldBy.exampleRu || ''))) c.mtWarn = null;
      if (!existing && !groups.manual && !entries.length) entries.push(Prov.entry('manual', 'create'));
      return Prov.add(existing || c, ...pendingHist, ...entries);
    };

    /* ---------- translator rail ---------- */
    let curProv = null; // a specific neural network pressed in the 🤖 row
    const trBy = id => id === 'ai' ? 'ai:' + (curProv || Translators.lastAI || AI.current()) : 'tr:' + id;
    const lightRail = burst => {
      const key = burst && !String(burst).includes(':') ? trBy(burst) : burst;
      m.$$('[data-tr-rail], [data-ai-rail]').forEach(r => Translators.light(r, existing || c,
        [...pendingHist.map(h => h.by), ...Object.values(src).filter(b => b !== 'manual')], key));
    };
    const applyTr = (id, res, from, to, mode) => {
      if (!res) return;
      const field = to;
      const label = id === 'ai' && curProv ? AI.PROVIDERS[curProv].short : Translators.label(id);
      if (mode === 'fill') { write({ [field]: res }, trBy(id)); lightRail(id); UI.toast(`${label}: перевод вставлен`, 'good', 1800); m.$('[data-tr-out]').innerHTML = ''; return; }
      const agree = Translators.agrees(res, c[field]);
      pendingHist.push(Prov.entry(trBy(id), 'verify', null, `${from === 'no' ? 'NO→RU' : 'RU→NO'}: «${res}» — ${agree ? 'совпадает с карточкой' : 'отличается от карточки'}`));
      lightRail(id);
      m.$('[data-tr-out]').innerHTML = `<div class="tr-out ${agree ? 'ok' : 'diff'}">
        ${id === 'ai' && curProv ? aiIco(curProv, 20) : Translators.icon(id, 20)} <b>${U.esc(label)}:</b> <span>${UI.rich(res)}</span>
        <span class="chip ${agree ? 'learned' : 'due'}">${agree ? '✓ совпадает с карточкой' : '≠ отличается'}</span>
        <span class="grow"></span>
        ${agree ? '' : `<button class="btn sm" data-tr-apply="replace">Заменить</button><button class="btn sm" data-tr-apply="add">Добавить вариант</button>`}
      </div>`;
      m.$('[data-tr-out]').onclick = e => {
        const b = e.target.closest('[data-tr-apply]'); if (!b) return;
        write({ [field]: b.dataset.trApply === 'replace' ? res : `${c[field].replace(/[,\s]+$/, '')}, ${res}` }, trBy(id));
        m.$('[data-tr-out]').innerHTML = '';
      };
    };
    const trClick = async (id, btn, prov) => {
      curProv = prov || null;
      read();
      const hasNo = !!c.no.trim(), hasRu = !!c.ru.trim();
      if (!hasNo && !hasRu) { UI.toast('Напишите слово на норвежском или русском — переводчик заполнит вторую сторону', 'warn'); return; }
      let from, mode;
      if (hasNo !== hasRu) { from = hasNo ? 'no' : 'ru'; mode = 'fill'; }
      else { from = lastFocus; mode = 'verify'; }
      const to = from === 'no' ? 'ru' : 'no';
      const text = Translators.prepare(from === 'no' ? c.no : c.ru, from);
      if (id === 'compare') { Translators.compareDialog(text, from, to, (res, tid) => applyTr(tid, res, from, to, mode)); return; }
      if (id === 'more') {
        Translators.moreMenu(btn, text, from, to,
          wid => { pendingHist.push(Prov.entry('tr:' + wid, 'verify', null, 'открыт словарь на сайте')); lightRail('tr:' + wid); },
          wid => Views.pasteFromDict(wid, tmpCard(), {
            write: (block, marker) => {
              write({ description: Ordbok.mergeBlock(c.description, marker, block) }, 'tr:' + wid);
              const ta = m.$('[data-f="description"]'); ta.rows = Math.min(16, ta.value.split('\n').length + 1);
              lightRail('tr:' + wid);
            },
          }));
        return;
      }
      if (id === 'grammatikk') {
        if (!c.no.trim()) { UI.toast('Сначала введите норвежское слово', 'warn'); return; }
        // the editor is open: the topic goes into the form (saved with «Сохранить»), not straight into the stored card
        Grammar.open(existing ? Object.assign({}, existing, tmpCard()) : tmpCard(), {
          write: (block, marker, by) => {
            write({ description: Ordbok.mergeBlock(c.description, marker, block) }, 'tr:grammatikk');
            // machine-translated text → the same «перепроверьте» flag as when added from the study screen
            const warn = Translators.mtFlag(by); if (warn) c.mtWarn = warn;
            Translators.provKeys(by).forEach(k => { pendingHist.push(Prov.entry(k, 'translate', null, 'перевёл тему grammatikk.com')); lightRail(k); });
            const ta = m.$('[data-f="description"]'); ta.rows = Math.min(16, ta.value.split('\n').length + 1);
            lightRail('tr:grammatikk');
          },
        });
        return;
      }
      if (id === 'telegram') {
        if (!c.no.trim()) { UI.toast('Сначала введите норвежское слово', 'warn'); return; }
        Telegram.open(existing ? Object.assign({}, existing, tmpCard()) : tmpCard());
        return;
      }
      if (id === 'tatoeba') {
        if (!c.no.trim()) { UI.toast('Сначала введите норвежское слово', 'warn'); return; }
        btn.classList.add('busy');
        try {
          const ex = await Sources.tatoeba(tmpCard());
          const seen = new Set((c.examples || []).map(x => U.norm(x.no)));
          write({ examples: (c.examples || []).concat(ex.filter(x => !seen.has(U.norm(x.no)))) }, 'tr:tatoeba');
          lightRail('tatoeba');
          UI.toast(`Tatoeba: добавлено живых примеров — ${ex.length}`, 'good');
        } catch (err) { UI.toast(err.message, 'warn', 5000); }
        btn.classList.remove('busy');
        return;
      }
      if (id === 'ordbok') {
        // official dictionary article -> description (Norwegian + Russian in brackets), forms if empty
        if (!c.no.trim()) { UI.toast('Сначала введите норвежское слово', 'warn'); return; }
        btn.classList.add('busy');
        try {
          const r = await Ordbok.build(tmpCard());
          if (AI.available() && !(r.translatedBy || []).includes('ai')) { try { await Ordbok.refineAI(r); } catch (e) { /* keep the machine translation */ } }
          write({ description: Ordbok.merge(c.description, Ordbok.toText(r)) }, 'tr:ordbok');
          const ta = m.$('[data-f="description"]'); ta.rows = Math.min(16, ta.value.split('\n').length + 1);
          if (!(c.forms || []).length && r.forms.some(f => f.ru)) write({ forms: r.forms.filter(f => f.ru) }, 'tr:ordbok');
          // the translator(s) that translated the article light up as well
          Translators.provKeys(r.translatedBy).forEach(k => pendingHist.push(Prov.entry(k, 'translate', null, `перевёл статью Ordbøkene «${r.lemma}» на русский`)));
          c.mtWarn = Translators.mtFlag(r.translatedBy);
          lightRail('ordbok');
          const machine = (r.translatedBy || []).some(id => id !== 'ai') && !(r.translatedBy || []).includes('ai');
          UI.toast(`Ordbøkene: «${r.lemma}» — ${r.definitions.length} значений, перевод: ${Translators.provNames(r.translatedBy) || '—'}${machine ? '. ⚠️ Машинный перевод неточный — перепроверьте выражения' : ''}`, machine ? 'warn' : 'good', machine ? 6000 : 3500);
        } catch (err) { UI.toastAction(`Ordbøkene: ${Ordbok.errText(err)}`, '↗ Открыть на сайте', () => window.open(Ordbok.siteUrl(c), '_blank', 'noopener'), 9000, '⚠️'); }
        btn.classList.remove('busy');
        return;
      }
      if (id !== 'ai' && !Translators.inline(id)) {
        const go = () => Translators.open(id, text, from, to);
        if (Translators.LIST[id].key) Guides.needKey(id, go); else go();
        return;
      }
      btn.classList.add('busy');
      try { applyTr(id, await Translators.translate(id, text, from, to, prov ? { provider: prov } : {}), from, to, mode); }
      catch (err) {
        if (id === 'ai') UI.toast(err.message, 'bad', 6000);
        else {
          // the others try (as everywhere); the website only on request
          let r2 = null;
          try { r2 = await Translators.translateMany([text], from, to); } catch (e) { /* nothing more */ }
          const got = r2 && String(r2.out[0] || '').trim();
          if (got) {
            const used = r2.by.find(b => b !== id) || r2.by[0];
            UI.toast(`${Translators.LIST[id].name} не ответил — перевёл ${Translators.provNames([used])}`, 'warn', 5000);
            applyTr(used, got, from, to, mode);
          } else UI.toastAction(`${Translators.LIST[id].name}: ${err.message}`, '↗ Открыть на сайте', () => Translators.open(id, text, from, to), 9000, '⚠️');
        }
      }
      btn.classList.remove('busy');
    };
    m.$('[data-tr-rail]').addEventListener('click', e => {
      const b = e.target.closest('[data-tr]'); if (!b) return;
      e.stopPropagation(); trClick(b.dataset.tr, b);
    });
    m.$('[data-ai-rail]').addEventListener('click', e => {
      const b = e.target.closest('[data-ai]'); if (!b) return;
      e.stopPropagation();
      if (b.dataset.ai === 'add') { m.close(); App.go('settings'); return; }
      trClick('ai', b, b.dataset.ai);
    });
    const setImg = url => {
      c.image = url || '';
      const box = m.$('#ed-img');
      box.innerHTML = url ? `<img src="${U.esc(url)}" alt="">` : '<span class="muted small">нет картинки</span>';
      if (url && !variants.includes(url)) variants.unshift(url);
      variants = variants.slice(0, 8);
      m.$('.img-variants').innerHTML = variants.length > 1 ? variants.map(v => `<img src="${U.esc(v)}" data-v="${U.esc(v)}" title="Выбрать">`).join('') : '';
    };
    /* the picture buttons: one shared source each (js/views.js Views.picSource — the study card uses the same);
       the patch keeps where the picture came from and its author / licence */
    const imgFrom = (kind, again) => Views.picSource(kind, tmpCard(), {
      variant: variants.length, again,
      busy: on => { const box = m.$('#ed-img'); const sp = box.querySelector('.spinner'); if (on && !sp) box.insertAdjacentHTML('beforeend', '<span class="spinner"></span>'); else if (!on && sp) sp.remove(); },
      onPick: p => { setImg(p.image); Object.assign(c, p); },
    });
    const tmpCard = () => Object.assign({ id: existing ? existing.id : 'tmp' }, read());
    // ✓ the editor's own AI check marks the card «проверено нейросетью» (js/ai.js → stamp, js/aihub.js draws the marks):
    // the stored card gets them at once when it already holds the checked text, else they come with «Сохранить»;
    // a side edited after the check loses its mark there
    let edAi = null;
    const faceNow = () => { const o = {}; Store.AI_FACE.front.concat(Store.AI_FACE.back).forEach(k => { o[k] = Store.faceText(c[k]); }); return o; };
    const aiMark = (by, o) => {
      const stamp = AI.stamp(existing || c, by, Object.assign({ action: 'check' }, o));
      const ac = stamp.aiCheck; delete stamp.aiCheck;
      Object.assign(c, stamp);
      edAi = ac ? { ac, face: faceNow() } : null;
      if (existing) { const f = edAi && edAi.face; if (f && Object.keys(f).every(k => f[k] === Store.faceText(existing[k]))) stamp.aiCheck = ac; Store.updateCard(existing.id, stamp); }
    };
    const aiOnSave = () => {
      if (!edAi) return null;
      const now = faceNow(), a = JSON.parse(JSON.stringify(edAi.ac));
      ['front', 'back'].forEach(side => {
        if (Store.AI_FACE[side].every(k => now[k] === edAi.face[k])) return;
        delete a[side]; delete a[side === 'front' ? 'byFront' : 'byBack'];
        if (a.fixed) Store.AI_FACE[side].forEach(k => { delete a.fixed[k]; });
      });
      return a.front || a.back ? a : null;
    };
    const save = async (more) => {
      if (saving) return; // a second Ctrl+Enter / click while closing must not add the card twice
      read();
      if (!c.no && !c.ru) { UI.toast('Заполните хотя бы одну сторону', 'warn'); return; }
      saving = true;
      let saved;
      const history = historyOnSave();
      const aiS = aiOnSave();
      if (!existing && edAi) { if (aiS) c.aiCheck = aiS; else delete c.aiCheck; }
      if (existing) saved = Store.updateCard(existing.id, { ...(aiS ? { aiCheck: aiS } : {}), no: c.no, ru: c.ru, uk: c.uk || '', en: c.en, description: c.description, example: c.example, exampleRu: c.exampleRu, wordClass: c.wordClass, tags: c.tags, image: c.image, imagePrompt: c.imagePrompt, imageAuto: !!c.imageAuto, ...(c.imageSrc !== undefined ? { imageSrc: c.imageSrc, imageCredit: c.imageCredit || '', imageCreditUrl: c.imageCreditUrl || '', imageNone: c.imageNone || '' } : {}), forms: c.forms || [], examples: c.examples || [], synonyms: c.synonyms || [], history, ...(c.mtWarn !== undefined ? { mtWarn: c.mtWarn } : {}) });
      else saved = Store.addCard(deckId, Object.assign(c, { history }));
      if (saved) Store.touchDeck(saved.deckId); // 🕘 the deck is in work
      UI.toast(existing ? 'Сохранено' : 'Карточка добавлена', 'good', 1600);
      m.close();
      onSaved && onSaved(saved);
      if (!existing && Store.settings.autoImages && !saved.image && Store.settings.imageProvider !== 'off' && !UI.isLong(saved.no)) {
        Images.ensure(saved).then(() => onSaved && onSaved(saved)).catch(() => {});
      }
      if (!existing && Store.settings.aiAutoSave && AI.available()) Views.runAiCheck([saved], { quietIfOk: true });
      if (more) Views.editCard(null, deckId, onSaved);
    };
    setImg(c.image);
    initial = JSON.stringify(read());
    m.el.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(false); } });
    m.$('.img-variants').onclick = e => { const v = e.target.dataset.v; if (v) setImg(v); };
    m.el.onclick = async e => {
      const a = e.target.closest('[data-act]');
      if (!a) return;
      read();
      switch (a.dataset.act) {
        case 'save': save(false); break;
        case 'save-more': save(true); break;
        case 'cancel': m.tryClose(); break;
        case 'delete': if (await UI.confirm('Точно удалить эту карточку?<br><span class="small muted">Её можно будет вернуть из 🗑 Корзины в течение 30 дней.</span>', { danger: true, ok: 'Да, удалить' })) { saving = true; const en = Store.deleteCards([existing.id]); m.close(); onSaved && onSaved(null); Views.afterDelete(en, 'Карточка удалена'); } break;
        case 'speak-no': TTS.speakText([c.no, c.ru, c.description, c.example, c.exampleRu].filter(Boolean).join('\n'), 'no'); break;
        case 'speak-ru': TTS.speakText([c.no, c.ru, c.description, c.example, c.exampleRu].filter(Boolean).join('\n'), 'ru'); break;
        case 'swap': write({ no: c.ru, ru: c.no }); break;
        case 'ordbok': window.open('https://ordbokene.no/nob/bm/' + encodeURIComponent(c.no.replace(/^(en|ei|et|å)\s+/i, '').split(/[\n(,]/)[0].trim()), '_blank'); break;
        case 'translate': {
          a.disabled = true;
          try {
            if (c.no && !c.ru) write({ ru: await Images.translate(c.no, 'no|ru') });
            else if (c.ru && !c.no) write({ no: await Images.translate(c.ru, 'ru|no') });
            else UI.toast('Заполните одну сторону — вторая переведётся', 'warn');
          } catch (err) { UI.toast(err.message, 'bad'); }
          a.disabled = false; break;
        }
        case 'ai-fill': case 'ai-check': {
          if (!AI.available()) { Guides.needAI(a.dataset.act === 'ai-fill' ? 'Заполнить карточку' : 'Проверить карточку'); return; }
          if (!c.no && !c.ru) { UI.toast('Введите слово хотя бы на одном языке', 'warn'); return; }
          const label = a.innerHTML;
          a.innerHTML = `<span class="spinner sm"></span> ${U.esc(AI.name())} думает…`; a.disabled = true;
          try {
            if (a.dataset.act === 'ai-fill') {
              const r = await AI.fillCard(c);
              const patch = {};
              AI.FIELDS.forEach(k => { if (r[k] && (!c[k] || k === 'no' || k === 'ru')) patch[k] = r[k]; });
              if (r.en) c.en = r.en;
              write(patch, 'ai:' + AI.lastProvider); lightRail('ai');
            } else {
              const [res] = await AI.checkCards([tmpCard()]);
              if (!res || (!Object.keys(res.changes).length && res.ok)) UI.toast(`${AI.name(res && res.by)}: карточка в порядке ✓`, 'good');
              else Views.aiReview([res], { inline: (id, fields, by) => {
                const p = {}, old = {}; Object.entries(fields).forEach(([k, v]) => { if (k === 'en') c.en = v; else { p[k] = v; old[k] = c[k]; } });
                write(p, 'ai:' + by); lightRail('ai');
                const acc = {}; Object.keys(p).forEach(k => { acc[k] = { old: old[k], new: c[k] }; });
                aiMark(by, { history: false, fields: acc });
              }, cards: [tmpCard()] });
              if (res && !Object.keys(res.changes).length && res.ok) aiMark(res.by, { note: 'без замечаний ✓' });
            }
          } catch (err) { UI.toast(err.message, 'bad', 6000); }
          a.innerHTML = label; a.disabled = false; break;
        }
        case 'history': if (existing) Prov.historyDialog(existing.id); break;
        case 'ai-synonyms': {
          if (!c.no.trim()) { UI.toast('Сначала введите норвежское слово', 'warn'); return; }
          let mode = 'append';
          if ((c.synonyms || []).length) { mode = await askMode('synonyms', 1); if (!mode) return; }
          const viaAI = AI.available();
          const label = a.innerHTML;
          a.disabled = true; a.innerHTML = `<span class="spinner sm"></span> ${U.esc(viaAI ? AI.name() : 'Ordbøkene')} подбирает синонимы…`;
          try {
            let syn = viaAI ? await AI.synonyms(tmpCard()) : await Ordbok.synonyms(tmpCard());
            if (!syn.length) throw new Error('Синонимы не найдены');
            if (mode === 'append' && (c.synonyms || []).length) { const seen = new Set(c.synonyms.map(s => U.norm(s.no))); syn = c.synonyms.concat(syn.filter(s => !seen.has(U.norm(s.no)))); }
            write({ synonyms: syn }, viaAI ? 'ai:' + AI.lastProvider : 'tr:ordbok');
            lightRail(viaAI ? 'ai' : 'ordbok');
            UI.toast('Синонимы добавлены — проверьте и сохраните', 'good');
          } catch (err) { UI.toast(err.message, 'bad', 6000); }
          a.disabled = false; a.innerHTML = label; break;
        }
        case 'ai-forms': case 'ai-examples': {
          if (!AI.available()) { Guides.needAI(a.dataset.act === 'ai-forms' ? 'Формы слова' : 'Примеры по формам'); return; }
          if (!c.no && !c.ru) { UI.toast('Сначала введите слово', 'warn'); return; }
          const kind = a.dataset.act === 'ai-forms' ? 'forms' : 'examples';
          let mode = 'append';
          if ((c[kind] || []).length) { mode = await askMode(kind, 1); if (!mode) return; }
          const label = a.innerHTML;
          a.disabled = true; a.innerHTML = `<span class="spinner sm"></span> ${U.esc(AI.name())} ${kind === 'forms' ? 'заполняет формы' : 'пишет примеры'}…`;
          try {
            let arr;
            if (kind === 'forms') {
              const r = await AI.forms(tmpCard());
              arr = r.forms;
              if (!c.wordClass && r.wordClass) write({ wordClass: r.wordClass }, 'ai:' + AI.lastProvider);
            } else arr = await AI.examples(tmpCard());
            if (!arr.length) throw new Error(kind === 'forms' ? 'У этого слова нет изменяемых форм' : 'Примеры не получены');
            if (mode === 'append' && (c[kind] || []).length) {
              const seen = new Set(c[kind].map(x => U.norm(x.no)));
              arr = c[kind].concat(kind === 'forms' ? arr.filter(x => !seen.has(U.norm(x.no))) : arr);
            }
            write({ [kind]: arr }, 'ai:' + AI.lastProvider);
            lightRail('ai');
            UI.toast(`${AI.name(AI.lastProvider)}: ${kind === 'forms' ? 'формы заполнены' : 'примеры добавлены'} — проверьте и сохраните`, 'good');
          } catch (err) { UI.toast(err.message, 'bad', 6000); }
          a.disabled = false; a.innerHTML = label; break;
        }
        case 'ai-explain': {
          if (!AI.available()) { Guides.needAI('Добавить объяснение'); return; }
          if (!c.no && !c.ru) { UI.toast('Введите слово хотя бы на одном языке', 'warn'); return; }
          const label = a.innerHTML;
          a.disabled = true; a.innerHTML = `<span class="spinner sm"></span> ${U.esc(AI.name())} пишет…`;
          try {
            const text = await AI.explain(tmpCard());
            write({ description: c.description ? c.description.replace(/\s+$/, '') + '\n\n' + text : text }, 'ai:' + AI.lastProvider);
            const ta = m.$('[data-f="description"]');
            ta.rows = Math.min(16, ta.value.split('\n').length + 1);
            lightRail('ai');
            const stamp = AI.stamp(existing || c, AI.lastProvider, { history: false }); Object.assign(c, stamp);
            if (existing) Store.updateCard(existing.id, stamp);
          } catch (err) { UI.toast(err.message, 'bad', 6000); }
          a.disabled = false; a.innerHTML = label; break;
        }
        case 'img-gen': imgFrom('gen'); break;
        case 'img-again': imgFrom('gen', true); break;
        case 'img-photo': imgFrom('photo'); break;
        case 'img-feed': imgFrom('feed'); break;
        case 'img-search': imgFrom('search'); break;
        case 'img-emoji': imgFrom('emoji'); break;
        case 'img-del': imgFrom('none'); break;
        case 'img-pin': imgFrom('feed'); break;
        case 'img-hist': imgFrom('hist'); break;
        case 'img-url': imgFrom('url'); break;
        case 'img-upload': imgFrom('file'); break;
      }
      // keep english hint for images in sync
      if (existing && c.en !== existing.en && c.en) existing.en = c.en;
    };
    setTimeout(() => { const f = m.$('[data-f="no"]'); if (f && !existing) f.focus(); }, 80);
  };
  function srsInfo(s) {
    if (!s || !s.reps) return 'новая';
    return `${s.reps} повт., след. через ${U.fmtInterval(s.due - Date.now())}`;
  }

  /* =====================================================================
   * CLAUDE: check + review
   * ===================================================================== */
  Views.runAiCheck = async function (cards, opts = {}) {
    cards = (cards || []).filter(Boolean);
    if (!cards.length) { UI.toast('Нет карточек для проверки', 'warn'); return; }
    if (!AI.available()) {
      Guides.needAI('Проверить карточки');
      return;
    }
    const nm = AI.name();
    if (cards.length > 60 && !opts.noConfirm && !(await UI.confirm(`Проверить ${U.cards(cards.length)} через ${U.esc(nm)}? Это займёт время.`, { ok: 'Проверить' }))) return;
    const pt = UI.progressToast(`${nm} проверяет ${U.cards(cards.length)}…`);
    try {
      const results = await AI.checkCards(cards, (d, t) => pt.set(d, t, `${nm} проверяет… ${d}/${t}`));
      pt.close();
      const withChanges = results.filter(r => Object.keys(r.changes).length || !r.ok);
      // mark untouched OK cards as checked
      results.filter(r => !Object.keys(r.changes).length && r.ok).forEach(r => { const c = Store.card(r.id); if (c) Store.updateCard(r.id, AI.stamp(c, r.by, { action: 'check', note: 'без замечаний ✓' })); });
      if (!withChanges.length) { UI.toast(`${AI.name(results[0] && results[0].by)}: все ${U.cards(results.length)} в порядке ✓`, 'good'); App.render(); opts.onDone && opts.onDone(); return; }
      Views.aiReview(results, { onDone: opts.onDone });
    } catch (e) {
      pt.close(); UI.toast(e.message, 'bad', 7000);
    }
  };

  Views.aiReview = function (results, opts = {}) {
    const getCard = id => (opts.cards && opts.cards.find(c => c.id === id)) || Store.card(id);
    const items = results.filter(r => Object.keys(r.changes).length || !r.ok);
    const okCount = results.length - items.length;
    const fieldOrder = ['no', 'ru', 'description', 'example', 'exampleRu', 'wordClass', 'en', 'imagePrompt'];
    const short = s => { s = String(s || ''); return s.length > 400 ? s.slice(0, 400) + '…' : s; };
    const m = UI.modal({
      title: `${aiIco(results[0] && results[0].by, 22)} ${U.esc(AI.name(results[0] && results[0].by))}: предложения по улучшению`, cls: 'wide',
      body: `
        <div class="row small"><span class="chip learned">✓ без замечаний: ${okCount}</span><span class="chip due">✎ с предложениями: ${items.length}</span>
          <span class="grow"></span><button class="btn sm" data-act="all">Отметить всё</button><button class="btn sm" data-act="none">Снять всё</button>
          <button class="btn sm" data-act="main">Только NO/RU</button></div>
        <p class="small muted" style="margin:0">Отметьте изменения, которые хотите принять. Зачёркнуто — как было, зелёным — как предлагает ${U.esc(AI.name(results[0] && results[0].by))}. После принятия на карточке появится значок проверившей нейросети.</p>
        ${items.map(r => {
          const c = getCard(r.id) || {};
          return `<div class="review-item ${r.ok ? 'ok' : 'changed'}" data-id="${r.id}">
            <div class="title">${r.ok ? '✅' : '⚠️'} <span>${U.esc(String(c.no || '').split('\n')[0].slice(0, 80))}</span><span class="muted">—</span><span>${UI.rich(String(c.ru || '').split('\n')[0].slice(0, 80))}</span></div>
            ${r.issues.length ? `<ul class="issues">${r.issues.map(i => `<li>${U.esc(i)}</li>`).join('')}</ul>` : ''}
            ${fieldOrder.filter(f => r.changes[f]).map(f => `<label class="change">
              <input type="checkbox" data-field="${f}" ${f === 'imagePrompt' || f === 'en' ? '' : 'checked'}>
              <b>${AI.FIELD_NAMES[f]}</b>
              <span>${r.changes[f].old ? `<span class="old">${U.esc(short(r.changes[f].old))}</span><br>` : ''}<span class="new">${U.esc(short(r.changes[f].new))}</span></span>
            </label>`).join('')}
          </div>`;
        }).join('')}
        ${opts.inline ? '' : `<label class="switch">${'<input type="checkbox" data-opt="img">'}<span class="track"></span><span>Сгенерировать картинки для исправленных карт без картинки</span></label>`}
      `,
      foot: `<button class="btn ghost" data-act="cancel">Отмена</button><button class="btn primary" data-act="apply">✓ Применить выбранное</button>`,
      // the network's suggestions (paid for, slow to get again) are not lost by an accidental ✕ / Esc / tap outside
      beforeClose: UI.guard(() => !items.some(r => Object.keys(r.changes).length) ? null : { title: 'Закрыть без применения?', line: 'Предложения нейросети не применены — чтобы получить их снова, проверку придётся запустить заново.',
        actions: [{ label: 'Закрыть', value: 'close', cls: 'bad' }] }),
    });
    m.el.onclick = e => {
      const a = e.target.closest('[data-act]');
      if (!a) return;
      const boxes = m.$$('[data-field]');
      if (a.dataset.act === 'all') boxes.forEach(b => { b.checked = true; });
      if (a.dataset.act === 'none') boxes.forEach(b => { b.checked = false; });
      if (a.dataset.act === 'main') boxes.forEach(b => { b.checked = ['no', 'ru'].includes(b.dataset.field); });
      if (a.dataset.act === 'cancel') m.tryClose();
      if (a.dataset.act === 'apply') {
        let n = 0; const touched = [];
        m.$$('.review-item').forEach(item => {
          const id = item.dataset.id;
          const r = items.find(x => x.id === id);
          const patch = {};
          item.querySelectorAll('[data-field]').forEach(b => { if (b.checked) patch[b.dataset.field] = r.changes[b.dataset.field].new; });
          if (opts.inline) { opts.inline(id, patch, r.by); n += Object.keys(patch).length; return; }
          const card = Store.card(id);
          if (!card) return;
          n += Object.keys(patch).length;
          const accepted = {};
          Object.keys(patch).forEach(k => { if (r.changes[k]) accepted[k] = r.changes[k]; });
          const rejected = Object.keys(r.changes).filter(k => !accepted[k]);
          if (patch.imagePrompt && card.image && /pollinations/.test(card.image)) patch.image = '';
          Object.assign(patch, AI.stamp(card, r.by, { action: 'check', fields: accepted,
            note: [r.issues.join('; '), rejected.length ? 'отклонено вами: ' + rejected.map(k => AI.FIELD_NAMES[k] || k).join(', ') : ''].filter(Boolean).join(' · ') }));
          Store.updateCard(id, patch); touched.push(card);
        });
        m.close();
        UI.toast(`Применено изменений: ${n}`, 'good');
        const img = m.$('[data-opt="img"]');
        if (img && img.checked) Views.batchImages(touched.filter(c => !c.image));
        opts.onDone && opts.onDone();
        if (!opts.inline) App.render();
      }
    };
  };

  Views.batchImages = async function (cards) {
    cards = cards.filter(c => c && (!c.image || Images.isRemoteAI(c.image)) && !UI.isLong(c.no));
    if (!cards.length) { UI.toast('У всех подходящих карточек уже есть картинки', 'good'); return; }
    if (Store.settings.imageProvider === 'off') { UI.toast('Генерация картинок выключена в настройках', 'warn'); return; }
    const wait = await askAIWait(cards.length);
    const pt = UI.progressToast(`Создаю картинки: 0/${cards.length}`);
    const ok = await Images.batch(cards, (d, t) => { pt.set(d, t, `Создаю картинки: ${d}/${t}`); }, { wait });
    pt.close(`Картинок создано: ${ok} из ${cards.length}`, ok ? 'good' : 'warn');
    App.render();
  };
  /** without a Pollinations key: AI pictures 1 per 45 s — ask whether to wait for them */
  async function askAIWait(n) {
    // with a key there is no 45 s limit; without a key AI pictures are not available at all — nothing to wait for
    if (!Images.limited() || n < 2 || !(Store.settings.pollinationsToken || '').trim()) return false;
    const min = Math.ceil(n * 47 / 60);
    return UI.confirm(`Без ключа Pollinations бесплатные ИИ-рисунки создаются по одному в 45 секунд (≈${min} мин для ${U.cards(n)}).<br><br>
      <b>Ждать ИИ-рисунки</b> — медленно, но всё нарисует нейросеть (можно продолжать учить).<br>
      <b>Быстро</b> — сразу, где возможно ИИ, иначе фото или эмодзи-картинка.<br><br>
      Бесплатный ключ снимает лимит: ⚙️ Настройки → Картинки.`, { ok: '🎨 Ждать ИИ-рисунки', cancel: '⚡ Быстро', title: 'Как рисовать картинки?' });
  }

  /** redraw AI pictures (keeps pictures you uploaded yourself) */
  Views.redrawImages = async function (cards) {
    cards = cards.filter(c => c && !UI.isLong(c.no) && (!c.image || c.imageAuto || /pollinations|wikimedia|wikipedia/.test(c.image)));
    if (!cards.length) { UI.toast('Нет картинок для перерисовки', 'warn'); return; }
    if (!Images.limited() && cards.length > 30 && !(await UI.confirm(`Перерисовать ${U.cards(cards.length)}? Это займёт время.`, { ok: 'Перерисовать' }))) return;
    const wait = await askAIWait(cards.length);
    const pt = UI.progressToast(`Рисую по смыслу: 0/${cards.length}`);
    const ok = await Images.batch(cards, (d, t) => pt.set(d, t, `Рисую по смыслу: ${d}/${t}`), { wait, redraw: true });
    pt.close(`Перерисовано: ${ok} из ${cards.length}`, ok ? 'good' : 'warn');
    App.render();
  };

  /** AI writes an explanation straight into the card (Norwegian phrases + Russian in brackets) */
  async function appendExplanation(card, mode = 'append') {
    const fresh0 = Store.card(card.id) || card;
    const text = await AI.explain(mode === 'replace' ? Object.assign({}, fresh0, { description: '' }) : fresh0);
    const fresh = Store.card(card.id) || card;
    const had = !!String(fresh.description || '').trim();
    const desc = mode === 'replace' || !had ? text : fresh.description.replace(/\s+$/, '') + '\n\n' + text;
    Store.updateCard(card.id, Object.assign({ description: desc }, AI.stamp(fresh, AI.lastProvider, {
      action: 'explain', note: had ? (mode === 'replace' ? 'заменено заново' : 'дополнено ниже') : '',
      fields: { description: { old: mode === 'replace' ? fresh.description : '', new: text } } })));
    return text;
  }
  Views.addExplanation = async function (card, btn) {
    if (!card) return;
    if (!AI.available()) { Guides.needAI('Добавить объяснение'); return; }
    let mode = 'append';
    if (hasContent(Store.card(card.id) || card, 'explain')) { mode = await askMode('explain', 1); if (!mode) return false; }
    const label = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner sm"></span> ${U.esc(AI.name())} пишет…`; }
    try { await appendExplanation(card, mode); UI.toast('Объяснение добавлено в карточку ✓', 'good'); return true; }
    catch (e) { UI.toast(e.message, 'bad', 6000); return false; }
    finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = label; } }
  };
  /** card already has content -> replace it or add below? */
  const KIND_NAME = { forms: '📚 формы слова', examples: '💬 примеры по формам', explain: '📝 объяснение', synonyms: '🔁 синонимы' };
  function askMode(kind, count) {
    return UI.choose(`${KIND_NAME[kind][0] === '📚' ? '📚' : KIND_NAME[kind].slice(0, 2)} Уже есть содержимое`,
      `<p>${count > 1 ? `У части карточек (${count})` : 'В карточке'} уже есть ${KIND_NAME[kind].replace(/^\S+\s/, '')}${kind === 'explain' ? ' (например, из импорта или написанное вами)' : ''}. Что сделать?</p>
       <p class="small muted">🔄 <b>Заменить заново</b> — старое в этом разделе удалится, нейросеть напишет новое.<br>➕ <b>Дополнить ниже</b> — старое останется, новое добавится ниже.</p>`,
      [{ label: 'Отмена', value: null, cls: 'ghost' }, { label: '🔄 Заменить заново', value: 'replace', cls: 'warn' }, { label: '➕ Дополнить ниже', value: 'append', cls: 'primary' }]);
  }
  const hasContent = (c, kind) => kind === 'explain' ? !!String(c.description || '').trim() : (c[kind] || []).length > 0;

  /** 📚 forms / 💬 examples by the AI, written into the card + history */
  async function applyEnrich(card, kind, mode = 'append') {
    const fresh = Store.card(card.id) || card;
    const note = hasContent(fresh, kind) ? (mode === 'replace' ? 'заменено заново' : 'дополнено ниже') : '';
    if (kind === 'forms') {
      const r = await AI.forms(fresh);
      if (!r.forms.length) throw new Error('У этого слова нет изменяемых форм');
      let forms = r.forms;
      if (mode === 'append' && fresh.forms.length) {
        const seen = new Set(fresh.forms.map(f => U.norm(f.no)));
        forms = fresh.forms.concat(r.forms.filter(f => !seen.has(U.norm(f.no))));
      }
      const patch = { forms };
      if (!fresh.wordClass && r.wordClass) patch.wordClass = r.wordClass;
      Object.assign(patch, AI.stamp(fresh, AI.lastProvider, { action: 'forms', note, fields: { forms: { old: Prov.listText(fresh.forms), new: Prov.listText(forms) } } }));
      Store.updateCard(card.id, patch);
    } else if (kind === 'synonyms') {
      // neural network if connected, otherwise the Ordbøkene dictionary + Google translation
      const viaAI = AI.available();
      const syn = viaAI ? await AI.synonyms(fresh) : await Ordbok.synonyms(fresh);
      if (!syn.length) throw new Error('Синонимы не найдены');
      let list = syn;
      if (mode === 'append' && fresh.synonyms.length) {
        const seen = new Set(fresh.synonyms.map(s => U.norm(s.no)));
        list = fresh.synonyms.concat(syn.filter(s => !seen.has(U.norm(s.no))));
      }
      const fields = { synonyms: { old: Prov.listText(fresh.synonyms, true), new: Prov.listText(list, true) } };
      if (viaAI) Store.updateCard(card.id, Object.assign({ synonyms: list }, AI.stamp(fresh, AI.lastProvider, { action: 'synonyms', note, fields })));
      else Store.updateCard(card.id, { synonyms: list, history: Prov.add(fresh, Prov.entry('tr:ordbok', 'synonyms', fields, 'синонимы из Ordbøkene, перевод Google')) });
      applyEnrich.lastBy = viaAI ? AI.name(AI.lastProvider) : 'Ordbøkene';
    } else {
      const ex = await AI.examples(fresh);
      if (!ex.length) throw new Error('Примеры не получены');
      const examples = mode === 'append' ? (fresh.examples || []).concat(ex) : ex;
      Store.updateCard(card.id, Object.assign({ examples },
        AI.stamp(fresh, AI.lastProvider, { action: 'examples', note, fields: { examples: { old: Prov.listText(fresh.examples, true), new: Prov.listText(examples, true) } } })));
    }
  }
  const ENRICH = { forms: { busy: 'заполняет формы', done: 'Формы слова заполнены ✓' }, examples: { busy: 'пишет примеры', done: 'Примеры добавлены ✓' }, synonyms: { busy: 'подбирает синонимы', done: 'Синонимы добавлены ✓' } };
  Views.enrichCard = async function (card, kind, btn) {
    if (!card) return false;
    // no neural network connected: forms can still be translated one by one by Google (free)
    if (kind === 'forms' && !AI.available()) {
      const fresh = Store.card(card.id) || card;
      if (!Translators.parseForms(fresh)) {
        if (await UI.confirm('Форм слова на карточке нет. Чтобы нейросеть сама нашла все формы с переводом, подключите её (например, бесплатный Google Gemini). Открыть настройки?', { ok: 'Открыть' })) App.go('settings');
        return false;
      }
      const label = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Google переводит формы…'; }
      try {
        const f = await Translators.translateForms('google', fresh);
        if (!f || !f.items.length) throw new Error('Google не смог перевести формы');
        Store.updateCard(card.id, { forms: f.items, history: Prov.add(fresh, Prov.entry('tr:google', 'forms', { forms: { old: Prov.listText(fresh.forms), new: Prov.listText(f.items) } }, 'каждая форма переведена отдельно')) });
        UI.toast('Google: формы слова переведены ✓ (нейросеть даст ещё больше форм и точнее)', 'good', 4500);
        return true;
      } catch (e) { UI.toast(e.message, 'bad', 6000); return false; }
      finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = label; } }
    }
    if (!AI.available() && kind !== 'synonyms') { Guides.needAI(kind === 'forms' ? 'Формы слова' : 'Примеры по формам'); return false; }
    let mode = 'append';
    if (hasContent(Store.card(card.id) || card, kind)) { mode = await askMode(kind, 1); if (!mode) return false; }
    const who = AI.available() ? AI.name() : 'Ordbøkene';
    const label = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner sm"></span> ${U.esc(who)} ${ENRICH[kind].busy}…`; }
    try { await applyEnrich(card, kind, mode); UI.toast(`${kind === 'synonyms' ? applyEnrich.lastBy : AI.name(AI.lastProvider)}: ${ENRICH[kind].done}`, 'good'); return true; }
    catch (e) { UI.toast(e.message, 'bad', 6000); return false; }
    finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = label; } }
  };
  Views.enrichMany = async function (cards, kind, onlyEmpty) {
    cards = cards.filter(c => c && !UI.isLong(c.no));
    if (onlyEmpty) cards = cards.filter(c => !(c[kind] || []).length);
    if (!cards.length) { UI.toast(kind === 'forms' ? 'У всех карточек уже есть формы' : kind === 'synonyms' ? 'У всех карточек уже есть синонимы' : 'У всех карточек уже есть примеры', 'good'); return; }
    if (!AI.available() && kind !== 'synonyms') { Guides.needAI(kind === 'forms' ? 'Формы слова' : 'Примеры по формам'); return; }
    let mode = 'append';
    const filled = cards.filter(c => hasContent(c, kind)).length;
    if (filled) { mode = await askMode(kind, filled); if (!mode) return; }
    else if (cards.length > 10 && !(await UI.confirm(`${AI.name()} ${ENRICH[kind].busy} для ${U.cards(cards.length)}. Это займёт время. Начать?`, { ok: 'Начать' }))) return;
    const pt = UI.progressToast(`${AI.name()} ${ENRICH[kind].busy}: 0/${cards.length}`);
    let ok = 0;
    for (let i = 0; i < cards.length; i++) {
      try { await applyEnrich(cards[i], kind, mode); ok++; } catch (e) { console.warn(e); }
      pt.set(i + 1, cards.length, `${AI.name()} ${ENRICH[kind].busy}: ${i + 1}/${cards.length}`);
    }
    pt.close(`Готово: ${ok} из ${cards.length}`, ok ? 'good' : 'warn');
    App.render();
  };

  /**
   * 📋 Paste from ANY dictionary site (Glosbe, LEXIN, NAOB, Yandex…): these sites give apps no data access,
   * so the user copies the text there; here every Norwegian line gets its Russian translation in brackets,
   * the block is marked with the dictionary's name/icon and written into the card + history.
   * opts.write(block) — editor mode (writes into the open form instead of the stored card).
   */
  Views.pasteFromDict = async function (dictId, card, opts = {}) {
    const t = Translators.LIST[dictId] || { name: dictId };
    let clip = '';
    try { if (navigator.clipboard && navigator.clipboard.readText) clip = await navigator.clipboard.readText(); } catch (e) { /* permission denied — paste manually */ }
    const word = Ordbok.bare(card.no);
    const marker = `📗 ${t.name} ·`;
    let lines = [], lastVia = '', lastBy = [];
    const m = UI.modal({
      title: `${Translators.icon(dictId, 22)} ${U.esc(t.name)}: вставить в карточку`, cls: 'wide',
      body: `<p class="small muted" style="margin:0">Скопируйте на сайте ${U.esc(t.name)} нужный текст (⌘C) и вставьте сюда (⌘V). Каждая норвежская строка получит русский перевод в скобках, строки на русском останутся как есть.</p>
        <textarea class="input" data-paste rows="7" placeholder="Вставьте текст из словаря…">${U.esc(clip)}</textarea>
        <div class="row" style="gap:8px"><button class="btn sm primary" data-tr-go>🌐 Перевести и показать</button><span class="small muted" data-status></span></div>
        <div class="forms-box hidden" data-preview></div>`,
      foot: `<button class="btn ghost" data-cancel>Отмена</button><button class="btn primary" data-add disabled>➕ Добавить в карточку</button>`,
      beforeClose: UI.guard(() => !lines.length ? null : { title: 'Закрыть без добавления?', line: 'Переведённые строки не добавлены в карточку.',
        actions: [{ label: 'Закрыть', value: 'close', cls: 'bad' }] }),
    });
    m.$('[data-cancel]').onclick = () => m.tryClose();
    const run = async () => {
      const raw = m.$('[data-paste]').value.split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 60);
      if (!raw.length) { UI.toast('Вставьте текст из словаря', 'warn'); return; }
      m.$('[data-status]').innerHTML = '<span class="spinner sm"></span> перевожу…';
      // one batched translation (Google in a few requests, then DeepL / Microsoft / MyMemory / AI for gaps)
      const need = raw.map(l => !(U.cyrRatio(l) > 0.4 || !/\p{L}/u.test(l)));   // skip lines already in Russian / numbers
      const res = await Translators.translateMany(raw.map((l, k) => need[k] ? l : ''), 'no', 'ru');
      lastVia = Translators.provNames(res.by);
      lastBy = res.by;
      lines = raw.map((l, k) => { const ru = res.out[k]; return need[k] && ru && U.norm(ru) !== U.norm(l) ? `${l} (${ru})` : l; });
      m.$('[data-status]').textContent = `готово: ${lines.length} строк${lastVia ? ' · перевод: ' + lastVia : ''}${res.missing ? ` · не переведено: ${res.missing} — нажмите ещё раз` : ''}`;
      const pv = m.$('[data-preview]');
      pv.classList.remove('hidden');
      pv.innerHTML = `<div class="fb-title">${Translators.icon(dictId, 18)} ${U.esc(t.name)} · ${U.esc(word)}</div><div style="white-space:pre-wrap;line-height:1.55">${UI.rich(lines.join('\n'))}</div>
        <div style="margin-top:8px">${Translators.machineWarnHtml(res.by, false)}</div>`;
      m.$('[data-add]').disabled = false;
    };
    m.$('[data-tr-go]').onclick = run;
    if (clip.trim()) run();
    m.$('[data-add]').onclick = () => {
      if (!lines.length) return;
      const block = `${marker} ${word}\n${lines.join('\n')}`;
      if (opts.write) { opts.write(block, marker); }
      else {
        const fresh = Store.card(card.id); if (!fresh) return;
        Store.updateCard(card.id, {
          description: Ordbok.mergeBlock(fresh.description, marker, block),
          mtWarn: Translators.mtFlag(lastBy) || fresh.mtWarn || null,
          history: Prov.add(fresh, Prov.entry('tr:' + dictId, 'explain', { description: { old: '', new: block } }, `скопировано со словаря ${t.name}${lastVia ? ', перевод ' + lastVia : ''}`),
            ...Translators.provKeys(lastBy).map(k => Prov.entry(k, 'translate', null, `перевёл текст из ${t.name} на русский`))),
        });
      }
      UI.toast(`${t.name}: добавлено в карточку с переводом ✓`, 'good');
      m.close();
      opts.onDone && opts.onDone();
    };
  };

  /** 📖 Ordbøkene articles for many cards (free, no key) */
  Views.ordbokMany = async function (cards) {
    cards = cards.filter(c => c && !UI.isLong(c.no) && !/📖 Ordbøkene ·/.test(c.description || ''));
    if (!cards.length) { UI.toast('У всех карточек уже есть статьи Ordbøkene', 'good'); return; }
    if (cards.length > 10 && !(await UI.confirm(`Загрузить статьи Ordbøkene с переводом для ${U.cards(cards.length)}? Это займёт немного времени.`, { ok: 'Загрузить' }))) return;
    const pt = UI.progressToast(`Ordbøkene: 0/${cards.length}`);
    let ok = 0, done = 0, i = 0;
    const worker = async () => {
      while (i < cards.length) {
        const c = cards[i++];
        try {
          const r = await Ordbok.build(c);
          if (AI.available() && !(r.translatedBy || []).includes('ai')) { try { await Ordbok.refineAI(r); } catch (e) { /* keep the machine translation */ } }
          const fresh = Store.card(c.id);
          const block = Ordbok.toText(r);
          const patch = { description: Ordbok.merge(fresh.description, block), mtWarn: Translators.mtFlag(r.translatedBy) };
          const entries = [Prov.entry('tr:ordbok', 'explain', { description: { old: '', new: block } }, `статья из Ordbøkene с переводом (${Translators.provNames(r.translatedBy) || 'без перевода'})`),
            ...Translators.provKeys(r.translatedBy).map(k => Prov.entry(k, 'translate', null, `перевёл статью Ordbøkene «${r.lemma}» на русский`))];
          if (!fresh.forms.length && r.forms.some(f => f.ru)) { patch.forms = r.forms.filter(f => f.ru); entries.push(Prov.entry('tr:ordbok', 'forms', { forms: { old: '', new: Prov.listText(patch.forms) } })); }
          patch.history = Prov.add(fresh, ...entries);
          Store.updateCard(c.id, patch); ok++;
        } catch (e) { console.warn('ordbok', c.no, e.message); }
        pt.set(++done, cards.length, `Ordbøkene: ${done}/${cards.length}`);
      }
    };
    await Promise.all([worker(), worker()]);
    pt.close(`Статьи добавлены: ${ok} из ${cards.length}`, ok ? 'good' : 'warn');
    App.render();
  };

  Views.addExplanations = async function (cards, onlyEmpty) {
    cards = cards.filter(Boolean);
    if (onlyEmpty) cards = cards.filter(c => String(c.description || '').length < 120 && !UI.isLong(c.no));
    if (!cards.length) { UI.toast('Все карточки уже с объяснениями', 'good'); return; }
    if (!AI.available()) { Guides.needAI('Добавить объяснения'); return; }
    let mode = 'append';
    const filled = cards.filter(c => hasContent(c, 'explain')).length;
    if (filled) { mode = await askMode('explain', filled); if (!mode) return; }
    else if (cards.length > 10 && !(await UI.confirm(`${AI.name()} добавит объяснения в ${U.cards(cards.length)} (формы, примеры, выражения — перевод в скобках). Это займёт время. Начать?`, { ok: 'Начать' }))) return;
    const pt = UI.progressToast(`${AI.name()} пишет объяснения: 0/${cards.length}`);
    let ok = 0;
    for (let i = 0; i < cards.length; i++) {
      try { await appendExplanation(cards[i], mode); ok++; } catch (e) { console.warn(e); if (i === 0) { pt.close(); UI.toast(e.message, 'bad', 6000); return; } }
      pt.set(i + 1, cards.length, `${AI.name()} пишет объяснения: ${i + 1}/${cards.length}`);
    }
    pt.close(`Объяснения добавлены: ${ok} из ${cards.length}`, ok ? 'good' : 'warn');
    App.render();
  };

  Views.generateDeckDialog = function (deckId) {
    if (!AI.available()) { Guides.needAI('Новая колода по теме'); return; }
    const TOPICS = ['🍳 Кухня и еда', '🏥 У врача', '🧹 Работа: уборка (renhold)', '🛒 В магазине', '🏠 Дом и квартира', '🚌 Транспорт',
      '👨‍👩‍👧 Семья', '💼 Работа и собеседование', '🏛 NAV, налоги, документы', '🏫 Школа и барнехаге', '🌦 Погода и природа', '⏰ Время и дни',
      '😊 Чувства и характер', '💬 Разговорные фразы', '🔧 Инструменты и ремонт', '⚽ Спорт и отдых', '🧾 Банк и деньги', '📞 Телефон и сообщения'];
    const m = UI.modal({
      title: `${aiIco(AI.current(), 22)} ${U.esc(AI.name())}: новая колода по теме`, cls: 'wide',
      body: `<div class="small muted">Нейросеть подберёт самые нужные слова по теме, переведёт, добавит формы, примеры и выражения — норвежский с переводом в скобках.</div>
        <div class="row" style="gap:6px" data-topics>${TOPICS.map(t => `<button class="chip" data-topic="${U.esc(t)}">${U.esc(t)}</button>`).join('')}</div>
        <label class="field"><span>Тема (можно своя)</span><input class="input" data-f="topic" placeholder="например: на кухне, работа уборщиком, у врача"></label>
        <div class="field-row"><label class="field"><span>Количество карточек</span><input class="input" type="number" data-f="count" value="20" min="5" max="100"></label>
        <label class="field"><span>Уровень</span><select class="input" data-f="level">${[['A1', 'A1 — начинающий'], ['A2', 'A2 — базовый'], ['B1', 'B1 — средний (Norskprøve B1)'], ['B2', 'B2 — выше среднего'], ['C1', 'C1 — продвинутый']].map(([l, n]) => `<option value="${l}" ${l === 'A2' ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
        ${UI.switchHtml('explain', true, 'С объяснениями: формы, примеры и выражения (перевод в скобках)')}
        ${deckId ? '' : UI.switchHtml('images', !!Store.settings.autoImages, 'Сразу создать картинки')}`,
      foot: '<button class="btn ghost" data-close2>Отмена</button><button class="btn ai" data-ok>✨ Создать колоду</button>',
      // the neural network is writing: closing stops it and no deck is made — asked first
      beforeClose: UI.guard(() => !generating ? null : { title: 'Остановить создание колоды?', line: 'Нейросеть ещё пишет карточки — колода не будет создана.',
        actions: [{ label: 'Остановить', value: 'stop', cls: 'bad' }], cancel: 'Ждать' }),
      onClose: () => { gone = true; },
    });
    let generating = false, gone = false;
    m.$('[data-close2]').onclick = () => m.tryClose();
    m.$('[data-topics]').onclick = e => {
      const t = e.target.closest('[data-topic]'); if (!t) return;
      m.$('[data-f="topic"]').value = t.dataset.topic.replace(/^\S+\s/, '');
      m.$$('[data-topic]').forEach(x => x.classList.toggle('active', x === t));
    };
    m.$('[data-ok]').onclick = async () => {
      const topic = m.$('[data-f="topic"]').value.trim();
      const count = U.clamp(+m.$('[data-f="count"]').value || 20, 3, 100);
      const level = m.$('[data-f="level"]').value;
      const withExplain = m.$('[data-key="explain"]').checked;
      const imgs = m.$('[data-key="images"]') ? m.$('[data-key="images"]').checked : false;
      if (!topic) { UI.toast('Выберите или введите тему', 'warn'); return; }
      const b = m.$('[data-ok]'); b.disabled = true;
      const all = [];
      generating = true;
      try {
        // big decks are created in parts of 20 so every card stays detailed
        while (all.length < count) {
          const n = Math.min(20, count - all.length);
          b.innerHTML = `<span class="spinner sm"></span> ${U.esc(AI.name())} пишет карточки… ${all.length}/${count}`;
          const part = await AI.generateDeck(topic, n, level, withExplain, all.map(c => c.no));
          if (gone) return; // closed («Остановить»): no deck
          const seen = new Set(all.map(c => U.norm(c.no)));
          const fresh = part.filter(c => !seen.has(U.norm(c.no)));
          if (!fresh.length) break;
          all.push(...fresh);
        }
        const by = AI.lastProvider || AI.current();
        const deck = deckId ? Store.deck(deckId) : Store.addDeck(topic[0].toUpperCase() + topic.slice(1), `${AI.name(by)} · ${level}`);
        all.slice(0, count).forEach(c => Store.addCard(deck.id, Object.assign({}, c, AI.stamp(null, by, { action: 'generate', note: `тема: ${topic} · ${level}` }))));
        Store.touchDeck(deck.id); Store.autoNameDeck(deck.id, topic); // 🏷 a deck without a name: the topic
        m.close();
        UI.toast(`Создано ${U.cards(Math.min(all.length, count))}`, 'good');
        App.go('deck', { id: deck.id });
        if (imgs) Views.batchImages(Store.cards(deck.id));
      } catch (e) {
        if (!gone) { UI.toast(e.message, 'bad', 6000); b.disabled = false; b.textContent = '✨ Создать колоду'; }
      } finally { generating = false; }
    };
  };

  /* =====================================================================
   * IMPORT
   * ===================================================================== */
  Views.importFiles = async function (files, deckId) {
    for (const file of files) {
      // a deck shared by another user (.norskkort) — with covers, pictures, forms, examples
      if (await Share.isShareFile(file)) { await Share.importFile(file); continue; }
      const pt = UI.progressToast(`Читаю «${file.name}»…`);
      let res;
      try { res = await Importer.parse(file); }
      catch (e) { pt.close(); UI.toast(`«${file.name}»: ${e.message}`, 'bad', 7000); console.error(e); continue; }
      pt.close();
      if (res.native) await nativeImportDialog(res);
      else await importPreview(res, deckId);
    }
  };
  function nativeImportDialog(res) {
    return new Promise(resolve => {
      const d = res.native;
      const m = UI.modal({
        title: '📥 Резервная копия Norsk Kort', cls: 'narrow',
        body: `<p>В файле: <b>${(d.decks || []).length}</b> колод, <b>${U.cards((d.cards || []).length)}</b>, прогресс изучения сохранится.</p>`,
        foot: `<button class="btn bad" data-r>Заменить всё</button><button class="btn primary" data-a>Добавить к моим</button>`,
        onClose: resolve,
      });
      m.$('[data-a]').onclick = () => { const r = Importer.importNative(d); UI.toast(`Добавлено: ${r.decks} колод, ${U.cards(r.cards)}`, 'good'); m.close(); App.render(); };
      m.$('[data-r]').onclick = async () => {
        if (!(await UI.confirm('Заменить ВСЕ ваши данные содержимым файла?<br><span class="small muted">Перед заменой приложение скачает копию ваших текущих данных — их можно будет вернуть.</span>', { danger: true, ok: 'Заменить' }))) return;
        // a safety copy of what is replaced (the trash is replaced too — otherwise it would be gone for good)
        try { Exporter.backup(); } catch (e) { /* the download failed — the user already confirmed */ }
        await Importer.importNative(d, { replace: true }); UI.toast('Данные восстановлены', 'good'); m.close(); App.go('home');
      };
    });
  }
  function importPreview(res, deckId) {
    return new Promise(resolve => {
      let swap = false;
      const baseName = (res.deckName || res.name.replace(/\.[^.]+$/, '')).trim() || 'Импорт';
      const decks = Store.decks();
      const fieldOpts = Object.entries(Importer.FIELD_LABELS);
      const st = Store.settings;
      let importing = false;
      const m = UI.modal({
        title: `📥 Импорт: ${U.esc(res.name)}`, cls: 'wide', onClose: resolve,
        // a chosen file and its preview: closing by accident would mean choosing the file again
        beforeClose: UI.guard(() => importing ? null : { title: 'Закрыть импорт?', line: `Карточки из «${U.esc(res.name)}» не импортированы — файл придётся выбрать снова.`,
          actions: [{ label: 'Закрыть', value: 'close', cls: 'bad' }] }),
        body: `
          <div class="row small"><span class="chip">Формат: ${U.esc(res.format || '?')}</span><span class="chip" data-cnt></span><span class="chip debt hidden" data-dups></span></div>
          <div class="field-row">
            <label class="field"><span>В колоду</span><select class="input" data-deck>
              <option value="__new">➕ Новая колода «${U.esc(baseName)}»</option>
              ${decks.map(d => `<option value="${d.id}" ${d.id === deckId ? 'selected' : ''}>${U.esc(d.name)}</option>`).join('')}</select></label>
            ${res.rawText ? `<label class="field"><span>Разделитель</span><select class="input" data-delim><option value="auto">Авто (${U.esc(delimName(res.delimiter))})</option>
              ${Importer.DELIMS.map(([d, n]) => `<option value="${U.esc(d)}">${n}</option>`).join('')}<option value="pairs">Строки парами / блоками</option></select></label>` : '<span></span>'}
          </div>
          <div class="row" style="gap:16px">
            <button class="btn sm" data-act="swap">⇄ Поменять NO и RU</button>
            ${UI.switchHtml('dups', true, 'Пропускать дубликаты')}
            ${UI.switchHtml('split', false, 'Многострочный перевод: 1-я строка → перевод, остальное → описание')}
          </div>
          <div class="row" style="gap:16px">
            ${UI.switchHtml('ai', st.aiAutoImport && AI.available(), `${BOT()} Проверить нейросетью (${U.esc(AI.name())}) после импорта` + (AI.available() ? '' : ' — не подключена'))}
            ${UI.switchHtml('img', false, '🖼 Сгенерировать картинки')}
          </div>
          <div class="small muted">Колонки определены автоматически. Если что-то не так — выберите поле над колонкой. Текст переносится как есть: переносы строк, скобки (перевод), примеры.</div>
          <div class="table-wrap" data-table></div>`,
        foot: `<button class="btn ghost" data-act="cancel">Отмена</button><button class="btn primary" data-act="go">📥 Импортировать</button>`,
      });
      const existingKeys = () => {
        const id = m.$('[data-deck]').value;
        const set = new Set();
        if (id !== '__new') Store.cards(id).forEach(c => set.add(key(c.no, c.ru)));
        return set;
      };
      const key = (a, b) => U.norm(a) + '|' + U.norm(b);
      const colOf = f => res.map.indexOf(f);
      const draw = () => {
        const ncol = res.map.length;
        const ex = existingKeys(); const seen = new Set(); let dups = 0;
        const noI = colOf(swap ? 'ru' : 'no'), ruI = colOf(swap ? 'no' : 'ru');
        const isDup = res.rows.map(r => {
          const k = key(r[noI] || '', r[ruI] || '');
          const d = ex.has(k) || seen.has(k); seen.add(k); if (d) dups++; return d;
        });
        m.$('[data-cnt]').textContent = `Найдено: ${U.cards(res.rows.length)}`;
        const dEl = m.$('[data-dups]'); dEl.classList.toggle('hidden', !dups); dEl.textContent = `Дубликатов: ${dups}`;
        const heads = res.map.map((f, i) => `<th><select class="input" data-col="${i}" style="padding:5px;font-size:12px">${fieldOpts.map(([k, l]) => `<option value="${k}" ${k === f ? 'selected' : ''}>${l}</option>`).join('')}</select>
          ${res.headers && res.headers[i] ? `<div class="tiny muted">${U.esc(res.headers[i])}</div>` : ''}</th>`).join('');
        const body = res.rows.slice(0, 60).map((r, ri) => `<tr class="${isDup[ri] ? 'dup' : ''}">${Array.from({ length: ncol }, (_, i) => {
          const v = r[i] || '';
          if (res.map[i] === 'image' && /^(https?:|data:)/.test(v)) return `<td><img src="${U.esc(v)}"></td>`;
          return `<td title="${U.esc(v.slice(0, 1500))}" style="white-space:pre-wrap">${U.esc(v.length > 220 ? v.slice(0, 220) + '…' : v)}</td>`;
        }).join('')}${res.meta[ri] && res.meta[ri].image && !res.map.includes('image') ? `<td><img src="${U.esc(res.meta[ri].image)}"></td>` : ''}</tr>`).join('');
        m.$('[data-table]').innerHTML = `<table class="tbl"><thead><tr>${heads}</tr></thead><tbody>${body}</tbody></table>
          ${res.rows.length > 60 ? `<div class="small muted" style="padding:8px">…и ещё ${res.rows.length - 60}</div>` : ''}`;
        m.$('[data-act="go"]').textContent = `📥 Импортировать ${U.cards(res.rows.length - (m.$('[data-key="dups"]').checked ? dups : 0))}`;
      };
      draw();
      m.el.addEventListener('change', e => {
        if (e.target.dataset.col != null) { res.map[+e.target.dataset.col] = e.target.value; draw(); }
        if (e.target.matches('[data-deck]') || e.target.dataset.key === 'dups') draw();
        if (e.target.matches('[data-delim]')) {
          const v = e.target.value;
          const nr = Importer.reparseText(res, v === 'auto' ? null : v);
          Object.assign(res, { rows: nr.rows, headers: nr.headers, meta: nr.meta, map: nr.map });
          draw();
        }
      });
      m.el.onclick = async e => {
        const a = e.target.closest('[data-act]');
        if (!a) return;
        if (a.dataset.act === 'cancel') m.tryClose();
        if (a.dataset.act === 'swap') { swap = !swap; res.map = res.map.map(f => f === 'no' ? 'ru' : f === 'ru' ? 'no' : f); swap = false; draw(); }
        if (a.dataset.act === 'go') {
          if (!res.map.includes('no') && !res.map.includes('ru')) { UI.toast('Укажите хотя бы колонку норвежского или русского', 'warn'); return; }
          a.disabled = true; a.innerHTML = '<span class="spinner sm"></span> Импорт…'; importing = true;
          const opt = k => m.$(`[data-key="${k}"]`).checked;
          const built = await Importer.buildCards(res, res.map, { splitMultiline: opt('split') });
          let targetId = m.$('[data-deck]').value;
          if (targetId === '__new') targetId = Store.addDeck(baseName, `Импорт из ${res.name}`).id;
          const ex = existingKeys(); const added = [];
          let skipped = 0;
          built.forEach(c => {
            const k = key(c.no, c.ru);
            if (opt('dups') && ex.has(k)) { skipped++; return; }
            ex.add(k);
            c.history = [Prov.entry('import', 'import', null, `${res.format || 'файл'} · ${res.name}`)];
            added.push(Store.addCard(targetId, c));
          });
          if (added.length) { Store.touchDeck(targetId); Store.autoNameDeck(targetId, baseName); } // 🏷 a deck without a name: the file's title or its first card
          await Store.saveNow();
          m.close();
          UI.toast(`Импортировано: ${U.cards(added.length)}${skipped ? `, пропущено дубликатов: ${skipped}` : ''}`, 'good', 5000);
          App.go('deck', { id: targetId });
          if (opt('ai') && added.length) await Views.runAiCheck(added, { noConfirm: true });
          if (opt('img') && added.length) Views.batchImages(added);
        }
      };
    });
  }
  function delimName(d) {
    if (!d) return 'нет';
    if (d === 'pairs') return 'пары строк';
    const f = Importer.DELIMS.find(x => x[0] === d);
    return f ? f[1] : JSON.stringify(d);
  }

  /* =====================================================================
   * EXPORT
   * ===================================================================== */
  Views.exportDialog = function (deckId, cardIds) {
    let fmt = 'csv-app';
    const decks = Store.decks();
    const m = UI.modal({
      title: '📤 Экспорт карточек', cls: 'wide',
      body: `
        <div class="field-row">
          <label class="field"><span>Что экспортировать</span><select class="input" data-deck>
            ${cardIds ? `<option value="__sel">Выбранные карточки (${cardIds.length})</option>` : ''}
            <option value="__all" ${!deckId ? 'selected' : ''}>Все колоды (${U.cards(Store.cards().length)})</option>
            ${decks.map(d => `<option value="${d.id}" ${d.id === deckId && !cardIds ? 'selected' : ''}>${Store.isPersonalDeck && Store.isPersonalDeck(d) ? '🔒 ' : ''}${U.esc(d.name)} (${Store.cards(d.id).length})</option>`).join('')}</select></label>
          <label class="field"><span>Какие карты</span><select class="input" data-which>
            <option value="all">Все</option><option value="learned">Только выученные</option><option value="debt">Только долговые</option>
            <option value="learning">Только «изучаю»</option><option value="new">Только новые</option><option value="leech">Только трудные</option></select></label>
        </div>
        <div class="fmt-grid">${Exporter.FORMATS.map(f => `<button class="fmt ${f.id === fmt ? 'active' : ''}" data-fmt="${f.id}"><b>${f.name}</b><span>${f.desc}</span></button>`).join('')}</div>
        <div class="row small muted">💾 Полная резервная копия всех данных (с прогрессом и настройками, без API-ключа): <button class="btn sm" data-act="backup">Скачать бэкап</button></div>`,
      foot: `<button class="btn ghost" data-act="cancel">Отмена</button><button class="btn primary" data-act="go">📤 Экспортировать</button>`,
    });
    m.el.onclick = async e => {
      const f = e.target.closest('[data-fmt]');
      if (f) { fmt = f.dataset.fmt; m.$$('.fmt').forEach(b => b.classList.toggle('active', b === f)); return; }
      const a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'cancel') m.close();
      if (a.dataset.act === 'backup') Exporter.backup();
      if (a.dataset.act === 'go') {
        const sel = m.$('[data-deck]').value;
        const which = m.$('[data-which]').value;
        let cards = sel === '__sel' ? cardIds.map(id => Store.card(id)).filter(Boolean) : sel === '__all' ? Store.cards() : Store.cards(sel);
        if (which === 'leech') cards = cards.filter(c => Store.isLeech(c));
        else if (which !== 'all') cards = cards.filter(c => Store.status(c) === which);
        // 🔒 personal course decks stay on this device
        let skipped = 0;
        if (Store.shareableCards) { const sh = Store.shareableCards(cards); skipped = sh.skipped; cards = sh.cards; }
        if (!cards.length) { UI.toast(skipped ? `🔒 ${Store.PERSONAL_NOTE}.` : 'Нет карточек для экспорта', skipped ? '' : 'warn', skipped ? 6000 : 3200); return; }
        const title = sel === '__all' ? 'Norsk Kort — все колоды' : sel === '__sel' ? 'Выбранные карточки' : Store.deck(sel).name;
        a.disabled = true; a.innerHTML = '<span class="spinner sm"></span> Готовлю файл…';
        const pt = fmt === 'apkg' ? UI.progressToast('Собираю колоду Anki…') : null;
        try {
          await Exporter.run(fmt, title, cards, { onProgress: (d, t) => pt && pt.set(d, t, `Anki: ${d}/${t}`) });
          pt && pt.close();
          UI.toast(`Экспортировано: ${U.cards(cards.length)}${skipped ? ` · 🔒 ${Store.PERSONAL_NOTE}` : ''}`, 'good', skipped ? 7000 : 3200);
          m.close();
        } catch (err) { pt && pt.close(); UI.toast('Ошибка экспорта: ' + err.message, 'bad', 6000); a.disabled = false; a.textContent = '📤 Экспортировать'; }
      }
    };
  };

  /* =====================================================================
   * STATS
   * ===================================================================== */
  Views.stats = function (root) {
    const log = Store.state.log;
    const all = Store.deckStats(null);
    const days = 30;
    const start = U.startOfDay() - (days - 1) * U.DAY;
    const perDay = Array.from({ length: days }, (_, i) => ({ t: start + i * U.DAY, k: 0, u: 0 }));
    log.forEach(l => { if (l.ts >= start) { const i = Math.floor((l.ts - start) / U.DAY); if (perDay[i]) { if (l.g > 1) perDay[i].k++; else perDay[i].u++; } } });
    const max = Math.max(1, ...perDay.map(d => d.k + d.u));
    const total = log.length;
    const correct = log.filter(l => l.g > 1).length;
    const reviewLog = log.filter(l => !l.n);
    const retention = reviewLog.length ? Math.round(reviewLog.filter(l => l.g > 1).length / reviewLog.length * 100) : 0;
    // forecast next 7 days
    const fc = Array.from({ length: 7 }, () => 0);
    const today0 = U.startOfDay();
    Store.cards().forEach(c => ['nr', 'rn'].forEach(d => {
      const s = c.srs[d]; if (!s || !s.reps) return;
      const i = Math.max(0, Math.floor((s.due - today0) / U.DAY));
      if (i < 7) fc[i]++;
    }));
    const fmax = Math.max(1, ...fc);
    // heatmap 18 weeks
    const weeks = 18;
    const hmStart = U.startOfDay() - (weeks * 7 - 1) * U.DAY;
    const hm = {};
    log.forEach(l => { if (l.ts >= hmStart) { const k = U.dayKey(l.ts); hm[k] = (hm[k] || 0) + 1; } });
    const hmMax = Math.max(1, ...Object.values(hm));
    const cells = Array.from({ length: weeks * 7 }, (_, i) => {
      const t = hmStart + i * U.DAY; const n = hm[U.dayKey(t)] || 0;
      const a = n ? 0.25 + 0.75 * n / hmMax : 0;
      return `<div title="${U.fmtDate(t)}: ${n}" style="width:13px;height:13px;border-radius:3px;background:${n ? `color-mix(in srgb, var(--good) ${Math.round(a * 100)}%, transparent)` : 'var(--panel-border)'}"></div>`;
    }).join('');
    root.innerHTML = `
      <h1 class="st-h1"><i class="nav-ico" aria-hidden="true">${window.NavIcons ? NavIcons.html('stats') : '📊'}</i>Статистика</h1>
      <section class="home-widgets st-week" aria-label="Цель дня и серия">${Progress.goalTileHtml()}${Progress.streakTileHtml()}</section>
      <div class="pg-cards">${Progress.statsCardsHtml()}</div>
      <div class="stat-grid" style="margin-top:16px">
        <div class="stat"><b>${all.total}</b><span>карт</span></div>
        <div class="stat"><b style="color:var(--done)">${all.learned}</b><span>выучено (${all.learnedPct}%)</span></div>
        <div class="stat"><b style="color:var(--debt)">${all.debt}</b><span>долговые</span></div>
        <div class="stat"><b style="color:var(--learn)">${all.learning}</b><span>изучаю</span></div>
        <div class="stat"><b>${total}</b><span>всего ответов</span></div>
        <div class="stat"><b>${total ? Math.round(correct / total * 100) : 0}%</b><span>верных ответов</span></div>
        <div class="stat"><b>${retention}%</b><span>удержание (повторения)</span></div>
        <div class="stat"><b>🔥 ${Store.streakDays()}</b><span>дней подряд</span></div>
      </div>
      <div class="panel" style="margin-top:16px"><h3>Ответы за 30 дней <span class="small muted">— <span style="color:var(--good)">знаю</span> / <span style="color:var(--bad)">не знаю</span></span></h3>
        <div class="chart">${perDay.map((d, i) => `<div class="bar" style="height:${(d.k + d.u) / max * 100}%;animation-delay:${i * 15}ms" title="${U.fmtDate(d.t)}: ✓${d.k} ✗${d.u}">
          <div class="k" style="flex:${d.k}"></div><div class="u" style="flex:${d.u}"></div></div>`).join('')}</div>
        <div class="chart-labels">${perDay.map((d, i) => `<span>${i % 5 === 0 ? new Date(d.t).getDate() : ''}</span>`).join('')}</div></div>
      <div class="hero" style="margin-top:16px">
        <div class="panel"><h3>Активность (18 недель)</h3>
          <div style="display:grid;grid-template-rows:repeat(7,13px);grid-auto-flow:column;gap:3px;margin-top:12px;overflow-x:auto">${cells}</div></div>
        <div class="panel"><h3>Прогноз повторений на 7 дней</h3>
          <div class="chart" style="height:120px">${fc.map((n, i) => `<div class="bar" style="height:${n / fmax * 100}%;background:var(--warn);animation-delay:${i * 40}ms" title="${n}"></div>`).join('')}</div>
          <div class="chart-labels">${fc.map((n, i) => `<span>${i === 0 ? 'сег.' : i === 1 ? 'завтра' : '+' + i}<br><b>${n}</b></span>`).join('')}</div></div>
      </div>
      <div class="panel" style="margin-top:16px"><h3>По колодам</h3>
        <div class="table-wrap" style="margin-top:10px;max-height:none"><table class="tbl"><thead><tr><th>Колода</th><th>Карт</th><th>Новые</th><th>Изучаю</th><th>Долг</th><th>Выучено</th><th>⏰</th><th style="width:30%">Прогресс</th></tr></thead><tbody>
        ${Store.decks().map(d => { const s = Store.deckStats(d.id); return `<tr><td><a href="#" data-deck="${d.id}">${U.esc(d.name)}</a></td><td>${s.total}</td><td>${s.new}</td><td>${s.learning}</td><td>${s.debt}</td><td>${s.learned}</td><td>${s.due}</td><td>${UI.stacked(s)}</td></tr>`; }).join('')}
        </tbody></table></div></div>`;
    root.onclick = e => {
      if (e.target.closest('[data-act="pg-info"]')) { Progress.infoDialog(); return; }
      if (e.target.closest('[data-act="goal-go"]')) { Study.start({ deckId: null, size: Math.max(5, (Store.settings.goal || 20) - Progress.todayCount()) }); return; }
      const a = e.target.closest('[data-deck]'); if (a) { e.preventDefault(); App.go('deck', { id: a.dataset.deck }); }
    };
  };

  /* =====================================================================
   * SETTINGS
   * ===================================================================== */
  /* ↺ «Вернуть настройки по умолчанию»: preferences only — never decks, cards, progress, keys, accounts, Telegram or the bridge.
     Asks first (with the list of what stays), then a toast «Отменить» brings the old settings back at once. */
  const RESET_KEEP = new Set(['userName', 'aiProvider', 'aiMode', 'bridgeModel', 'plan', 'claudeModel', 'translators', 'restDays', 'vacation',
    'fsrsW', 'fsrsOpt', 'artSeasonSeen', 'artMotionNote', 'keysNoteSeen', 'avatar', 'imageTemplate']);
  const RESET_KEEP_RE = /key|token|secret|anon|cloud|url|region|^tg|^vk|bridge|account|^ai[A-Z]|^claude|^azure|^gcloud|^gemini|^eleven|^deepl|^ms[A-Z]|^yt/i;
  // a few preferences other parts of the app keep in Store.settings (not in the defaults list): back to «no choice»
  const RESET_EXTRA = ['exView', 'viewHide', 'listenMediaRate', 'dictMode', 'asrQuality', 'guidesOff', 'listen'];
  Views.resetSettings = async function () {
    const ok = await UI.confirm(`<p style="margin:0 0 8px"><b>Вернуть обычные значения настроек?</b></p>
      <p class="small" style="margin:0 0 6px">Станет как в новом приложении: как учить и направление, какие карты и сколько, подсказки, выбор голосов и скорость, жесты, картинки${window.AppThemes ? ', тема и оформление' : ''}.</p>
      <p class="small" style="margin:0 0 4px"><b>Останется как есть:</b></p>
      <ul class="small st-keep"><li>колоды и карточки</li><li>прогресс, серия и статистика</li><li>ключи нейросетей и переводчиков, вход в облако</li><li>Telegram и мост на Mac</li><li>имя, фото и расписание отдыха</li></ul>
      <p class="small muted" style="margin:6px 0 0">Передумаете — сразу после этого будет кнопка «Отменить».</p>`, { ok: '↺ Вернуть по умолчанию' });
    if (!ok) return;
    const st = Store.state.settings, D = Store.DEFAULT_SETTINGS || {};
    const before = JSON.parse(JSON.stringify(st));
    Object.keys(D).forEach(k => { if (RESET_KEEP.has(k) || RESET_KEEP_RE.test(k)) return; st[k] = D[k] && typeof D[k] === 'object' ? JSON.parse(JSON.stringify(D[k])) : D[k]; });
    RESET_EXTRA.forEach(k => { if (k in st) delete st[k]; });
    Store.save();
    let themes = null;
    try { if (window.AppThemes && typeof AppThemes.resetDefaults === 'function') themes = AppThemes.resetDefaults({ silent: true }); } catch (e) { console.warn('apptheme reset', e); }
    App.applyTheme(); App.updateBadge(); App.render();
    try { document.dispatchEvent(new CustomEvent('voices-changed')); } catch (e) { /* ignore */ }
    const undo = () => {
      Object.keys(Store.state.settings).forEach(k => { if (!(k in before)) delete Store.state.settings[k]; });
      Object.assign(Store.state.settings, before);
      Store.save();
      try { if (themes && themes.undo) themes.undo(); } catch (e) { /* ignore */ }
      App.applyTheme(); App.updateBadge(); App.render();
      try { document.dispatchEvent(new CustomEvent('voices-changed')); } catch (e) { /* ignore */ }
      UI.toast('↩ Ваши настройки вернулись', 'good', 3000);
    };
    if (UI.toastAction) UI.toastAction('Настройки как по умолчанию. Колоды и прогресс не тронуты', 'Отменить', undo, 12000, '↺');
    else UI.toast('Настройки как по умолчанию', 'good');
  };

  Views.settings = function (root) {
    const s = Store.settings;
    const voiceOpts = lang => {
      const list = TTS.voicesFor(lang);
      const cur = lang === 'no' ? s.voiceNo : lang === 'uk' ? s.voiceUk : s.voiceRu;
      return `<option value="">Авто${list.length ? '' : lang === 'uk' ? ' (нет голоса → онлайн-голос Google)' : ' (нет системного голоса → онлайн)'}</option>` + list.map(v => `<option ${v.name === cur ? 'selected' : ''}>${U.esc(v.name)}</option>`).join('');
    };
    const set = (label, desc, ctl) => `<div class="setting"><div><div>${label}</div>${desc ? `<div class="desc">${desc}</div>` : ''}</div><div class="ctl">${ctl}</div></div>`;
    const sw = k => UI.switchHtml(k, s[k]);
    const num = (k, min, max, step = 1) => `<input class="input" type="number" data-num="${k}" value="${s[k]}" min="${min}" max="${max}" step="${step}" style="width:90px">`;
    const sel = (k, opts) => `<select class="input" data-sel="${k}">${opts.map(([v, l]) => `<option value="${v}" ${String(s[k]) === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    const curId = AI.current();
    const provRow = id => {
      const p = AI.PROVIDERS[id]; const c = AI.cfg(id); const ok = AI.configured(id);
      const chips = `${p.free ? '<span class="chip learned">бесплатно</span>' : p.cheap ? '<span class="chip learning">дёшево</span>' : ''}${ok ? '<span class="chip learned">✓ подключено</span>' : ''}${curId === id ? '<span class="chip due">★ активна</span>' : ''}`;
      let body;
      if (p.type === 'bridge') {
        body = AI.bridge.ok
          ? `<div style="color:var(--good)">✓ Мост работает · Claude Code ${U.esc(AI.bridge.version)}</div>
             <label class="field"><span>Модель</span><select class="input" data-ai="claude.model">${[['', 'По умолчанию'], ['sonnet', 'Sonnet (быстро)'], ['opus', 'Opus (умнее)'], ['haiku', 'Haiku (очень быстро)']].map(([v, l]) => `<option value="${v}" ${(c.model || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`
          : AI.bridge.up && AI.bridge.auth === 'bad'
            // v212: the login expired — one button (js/claudelogin.js → bridge POST /api/claude/login opens the Terminal)
            ? `<div class="cl-card"><div class="cl-card-h"><span aria-hidden="true">🔑</span><div><b>Вход в Claude закончился — войдите ещё раз</b>
                 <small>Один раз примерно на год: откроется окно Терминала и страница Claude в браузере — войдите своим аккаунтом и нажмите «Authorize».</small></div></div>
               ${window.ClaudeLogin ? ClaudeLogin.buttonHtml() : `<div class="small muted">В Терминале: <code style="user-select:all">${U.esc(AI.bridge.tokenCmd || 'bash "tools/claude-token.sh"')}</code></div>`}</div>`
          : AI.bridge.up && !AI.bridge.path && /не найден/i.test(AI.bridge.error || '')
            ? `<div style="color:var(--warn)">Мост запущен, но Claude Code не найден на этом Mac.</div>
               <div class="small muted">Установите его в Терминале и войдите своим аккаунтом, затем перезапустите мост:<br>
               <code style="user-select:all">curl -fsSL https://claude.ai/install.sh | bash</code><br>потом <code>claude</code> → <code>/login</code></div>`
          : AI.bridge.up
            ? `<div class="small muted">Мост работает, Claude Code найден${AI.bridge.version ? ` (${U.esc(AI.bridge.version)})` : ''}. ${AI.bridge.checking ? 'Проверяю вход — это несколько секунд…' : 'Claude пока не ответил — нажмите «🔌 Проверить».'}</div>`
            : AI.onMac()
              ? `<div style="color:var(--warn)">Мост не запущен.</div>
               <div class="small muted">В Терминале: <code style="user-select:all">python3 "/Users/sprut/Norsk - Russisk/bridge/server.py"</code> — откроется http://localhost:8787</div>`
              : `<div class="small muted">ℹ️ Claude по подписке работает только в приложении на Mac — в версии на сайте это пока недоступно. Подключите любую другую нейросеть ниже: <b>Gemini</b> и <b>Groq</b> — бесплатно, нужен только ключ.</div>`;
      } else {
        body = `${p.editableBase || id === 'ollama' ? `<label class="field"><span>Адрес API (OpenAI-совместимый)</span><input class="input" data-ai="${id}.base" value="${U.esc(c.base || p.base)}" placeholder="https://…/v1"></label>` : ''}
          ${p.noKey ? '<div class="small muted">Ключ не нужен.</div>' : `<label class="field"><span>API-ключ ${p.keyUrl ? `· <a href="${p.keyUrl}" target="_blank">получить ключ →</a>` : ''}</span>
            <input class="input" type="password" data-ai="${id}.key" value="${U.esc(c.key || '')}" autocomplete="off" placeholder="вставьте ключ"></label>`}
          <label class="field"><span>Модель</span><input class="input" data-ai="${id}.model" value="${U.esc(c.model || '')}" placeholder="${U.esc(p.model)}" list="ml-${id}">
            <datalist id="ml-${id}">${p.models.map(m => `<option value="${U.esc(m)}"${p.modelNames && p.modelNames[m] ? ` label="${U.esc(p.modelNames[m])}"` : ''}>`).join('')}</datalist></label>`;
      }
      return `<details class="prov" ${curId === id || (p.type === 'bridge' && id === 'claude' && AI.bridge.up && AI.bridge.auth === 'bad') ? 'open' : ''}><summary>${aiIco(id, 20)} <b>${U.esc(p.name)}</b> ${chips}</summary>
        <div class="col" style="padding:10px 2px 4px">${p.note ? `<div class="small muted">${U.esc(p.note)}</div>` : ''}${body}
          <div class="row"><button class="btn sm ai" data-act="test-prov" data-id="${id}">🔌 Проверить</button>
          <button class="btn sm" data-act="use-prov" data-id="${id}">★ Сделать активной</button><span class="small" data-prov-status="${id}"></span></div></div></details>`;
    };
    root.innerHTML = `
      <h1>⚙️ Настройки</h1>
      ${UI.keysNoteHtml()}
      <div class="settings-grid" style="margin-top:16px">
        <div class="panel" style="grid-column:1/-1">
          <h3 class="set-ai-h">${BOT(22)} Нейросети — проверка и улучшение карточек</h3>
          <div class="field-row" style="margin-top:10px">
            <label class="field"><span>👤 Ваше имя</span><input class="input" data-text="userName" value="${U.esc(s.userName)}" placeholder="Alex"></label>
            <label class="field"><span>Тариф Claude</span><input class="input" data-text="plan" value="${U.esc(s.plan)}" list="plans"><datalist id="plans"><option value="Max"><option value="Pro"><option value="Team"></datalist></label>
          </div>
          <label class="field" style="margin-top:10px"><span>Какая нейросеть проверяет карточки сейчас</span>
            <select class="input" data-sel="aiProvider">
              <option value="auto" ${(s.aiProvider || 'auto') === 'auto' ? 'selected' : ''}>Авто (Claude по подписке, иначе первая подключённая)</option>
              ${Object.entries(AI.PROVIDERS).map(([id, p]) => `<option value="${id}" ${s.aiProvider === id ? 'selected' : ''}>${AI.configured(id) ? '✓ ' : ''}${U.esc(p.name)}${p.free ? ' — бесплатно' : ''}</option>`).join('')}
            </select></label>
          <p class="small muted">На каждой проверенной карточке остаётся значок нейросети, которая её проверила (можно проверять несколькими — будут видны все значки). Ключи хранятся только в этом браузере и не попадают в экспорт.</p>
          <div class="prov-list">${Object.keys(AI.PROVIDERS).map(provRow).join('')}</div>
          ${set('🔁 Автопереключение нейросетей и переводчиков — всегда включено', 'Закончился лимит или ошибка — сразу отвечает следующая подключённая нейросеть (бесплатные в приоритете), а та, у которой кончился лимит, отдыхает и не тормозит перевод. Так же переключаются переводчики. На карточке — значок той, что реально ответила. Подключите несколько бесплатных — и перевод не остановится.', '<span class="chip learned">✓ всегда</span>')}
          ${set('Существительные с артиклем', 'Нейросеть добавляет en/ei/et и «å» у глаголов', sw('aiArticles'))}
          ${set('Проверять при импорте', 'Включать проверку нейросетью в окне импорта по умолчанию', sw('aiAutoImport'))}
          ${set('Проверять новые карточки', 'После сохранения новой карточки', sw('aiAutoSave'))}
        </div>
        <div class="panel" style="grid-column:1/-1">
          <h3>🌐 Переводчики — значки на карточке и в редакторе</h3>
          <p class="small muted">Заполнена одна сторона — значок переведёт во вторую; заполнены обе — сверит перевод (✓ совпадает / ≠ отличается). ⚖️ сравнивает все сразу. Кто переводил — видно по значкам на карточке и в истории.</p>
          <div class="dict-tr">
            ${set('Переводчик для статей словарей', `Чем переводить статьи Ordbøkene и текст, вставленный из словарей. Сейчас переводит: <b>${Translators.icon(Translators.dictMain(), 14)} ${U.esc(Translators.provNames([Translators.dictMain()]))}</b>${s.dictTranslator && s.dictTranslator !== 'auto' && Translators.dictMain() !== s.dictTranslator ? ' — выбранный переводчик недоступен (нет ключа / нейросети), поэтому используется следующий' : ''}. Если он не ответит — подхватит следующий.`,
              sel('dictTranslator', [['auto', 'Авто: DeepL, если есть ключ, иначе Google'], ['ai', 'Нейросеть — самый точный (нужна подключённая нейросеть)'], ['deepl', 'DeepL — точнее Google (нужен ключ и мост на Mac)'], ['google', 'Google — бесплатно, но неточно в выражениях'], ['mozhi', 'Mozhi — бесплатно, без ключа (когда Google ограничил переводы)'], ['microsoft', 'Microsoft (нужен ключ Azure)'], ['mymemory', 'MyMemory — бесплатно']]))}
            ${Translators.dictMain() !== 'ai' ? `<div class="mt-warn" style="margin-top:6px">⚠️ <span>Машинные переводчики (Google, MyMemory, Microsoft и даже DeepL) — <b>неточные</b>: устойчивые выражения часто переводят дословно и неправильно. Перепроверяйте перевод нейросетью или по словарям (NAOB, LEXIN, Glosbe).</span></div>` : ''}
          </div>
          <div class="prov-list">${Object.entries(Translators.LIST).map(([id, t]) => `
            <div class="prov">
              <label class="switch" style="width:100%"><input type="checkbox" data-trtoggle="${id}" ${(s.translators || []).includes(id) ? 'checked' : ''}><span class="track"></span>
                <span>${Translators.icon(id, 18)} <b>${U.esc(t.ai ? 'ИИ-перевод (' + AI.name() + ')' : t.name)}</b>${t.free ? ' <span class="chip learned">бесплатно</span>' : ''}${t.web ? ' <span class="chip">сайт</span>' : ''}<br><span class="small muted">${U.esc(t.note)}</span></span></label>
              ${id === 'deepl' ? `<label class="field" style="margin-top:8px"><span>Ключ DeepL API Free · <a href="${t.keyUrl}" target="_blank">получить →</a> · ${AI.onMac() ? 'работает через мост на Mac; без ключа/моста откроется deepl.com' : 'перевод в карточке — только в приложении на Mac; здесь откроется deepl.com с вашим словом'}</span>
                <input class="input" type="password" data-text="deeplKey" value="${U.esc(s.deeplKey || '')}" placeholder="xxxxxxxx-…:fx" autocomplete="off"></label>` : ''}
              ${id === 'microsoft' ? `<div class="field-row" style="margin-top:8px"><label class="field"><span>Ключ Azure Translator · <a href="${t.keyUrl}" target="_blank">как получить →</a></span>
                <input class="input" type="password" data-text="msKey" value="${U.esc(s.msKey || '')}" autocomplete="off"></label>
                <label class="field"><span>Регион (например westeurope)</span><input class="input" data-text="msRegion" value="${U.esc(s.msRegion || '')}"></label></div>` : ''}
            </div>`).join('')}</div>
        </div>
        <div class="panel" style="grid-column:1/-1">
          <h3>🖐 Жесты и свайпы — телефоны, планшеты, мышь, трекпад MacBook</h3>
          <div class="swipe-settings">
            <div>
              ${set('Схема свайпов', 'Что делает каждое направление', sel('swipeMode', [['lr', '→ знаю · ← не знаю (по умолчанию)'], ['lr-rev', '← знаю · → не знаю (для левшей)'], ['ud', '↑ знаю · ↓ не знаю'], ['four', '4 направления: → хорошо · ← снова · ↑ легко · ↓ трудно'], ['flip-first', 'Сначала свайп переворачивает, потом оценка'], ['off', 'Без свайпов — только кнопки']]))}
              ${set('Анимация улёта карточки', '', sel('swipeStyle', [['tinder', '🃏 Tinder — наклон и улёт'], ['slide', '➡️ Плавный сдвиг'], ['flick3d', '🔄 3D-поворот'], ['fade', '✨ Растворение'], ['stack', '📚 Под колоду'], ['bounce', '🎈 Пружина']]))}
              ${set('Чувствительность', 'Насколько далеко тянуть; быстрый взмах тоже засчитывается', sel('swipeSensitivity', [['low', 'Низкая — тянуть далеко'], ['medium', 'Средняя'], ['high', 'Высокая — короткий свайп']]))}
              ${set('Долгое нажатие на карточку', '', sel('longPressAction', [['speak', '🔊 Озвучить'], ['flip', '↻ Перевернуть'], ['edit', '✏️ Редактировать'], ['explain', '🤖 Объяснить'], ['none', 'Ничего']]))}
              ${set('Двойной тап', 'Если включён — одиночный тап переворачивает с крошечной задержкой', sel('doubleTapAction', [['none', 'Ничего'], ['know', '✓ Знаю'], ['speak', '🔊 Озвучить'], ['edit', '✏️ Редактировать']]))}
              ${set('Свайп двумя пальцами по трекпаду (MacBook)', 'Влево/вправо — как свайп на телефоне', sw('trackpadSwipe'))}
            </div>
            <div class="swipe-demo-wrap">
              <div class="swipe-demo-stage"><div class="swipe-demo" data-demo>
                <div class="sd-flag">🇳🇴</div><b>et eple</b><span class="ru-text">яблоко</span></div></div>
              <div class="row" style="justify-content:center;gap:6px">
                <button class="btn sm" data-demo-dir="left">← Пример</button>
                <button class="btn sm" data-demo-dir="up">↑</button><button class="btn sm" data-demo-dir="down">↓</button>
                <button class="btn sm primary" data-demo-dir="right">Пример →</button>
              </div>
              <div class="small muted center">Мышью карточку можно перетаскивать прямо здесь</div>
            </div>
          </div>
        </div>
        <div class="panel">
          <h3>🎯 Дневная цель</h3>
          ${Progress.goalSettingsHtml()}
        </div>
        <div class="panel">
          <h3>📅 Расписание</h3>
          ${Progress.scheduleHtml()}
        </div>
        <div class="panel">
          <h3>🧠 Изучение</h3>
          ${set('🌐 Язык перевода: 🇷🇺 Русский · 🇺🇦 Українська · 🇷🇺+🇺🇦 Оба', 'Какой перевод показывать на карточках и спрашивать при изучении. Если у карточки ещё нет украинского перевода — показан русский с пометкой 🇷🇺. В режиме «Ввод» ответ принимается и по-русски, и по-украински.', UI.seg('transLang', TRLANGS, Study.trLang()))}
          ${set('Повторять «не знаю» в той же сессии', 'Карта вернётся через несколько карт', sw('requeue'))}
          ${set('Выучено после N верных подряд', '', num('learnedStreak', 1, 20))}
          ${set('Новых карт в день', 'Для «умного повторения»', num('newPerDay', 0, 1000))}
          ${set('🛟 Защита от завала повторений', `Когда просроченных повторений больше ${Study.backlogLimit()}, новые слова ставятся на паузу, пока вы не догоните`, UI.switchHtml('backlogGuard', s.backlogGuard !== false, ''))}
          ${set('Целевое удержание FSRS', `Выше — чаще повторения<div class="fsrs-box" data-fsrs-box>${FSRSOpt.settingsHtml()}</div>`, num('retention', 0.7, 0.99, 0.01))}
          ${set('Трудная карта после N забываний', 'Помечается 🐛', num('leechLapses', 2, 50))}
          ${set('4 кнопки (Снова / Трудно / Хорошо / Легко)', 'Вместо «Знаю / Не знаю»', sw('fourButtons'))}
          ${set('Разброс интервалов (fuzz)', 'Чтобы карты не копились в один день: интервал чуть сдвигается на день, где повторений меньше', sw('fuzz'))}
          ${set('Режим ввода: допускать опечатки', 'и ae/o/aa вместо æ/ø/å', sw('typeTolerance'))}
          ${set('Картинка на карточке', '', sel('imageSide', [['back', 'На обороте'], ['front', 'На лицевой'], ['both', 'На обеих'], ['none', 'Не показывать']]))}
        </div>
        <div class="panel">
          <h3>🔊 Озвучка</h3>
          ${Voices.settingsHtml()}
          ${set('Скорость', '', `<input type="range" min="0.5" max="1.4" step="0.05" data-num="ttsRate" value="${s.ttsRate}">`)}
          ${set('Автоматически произносить норвежский', 'При показе норвежской стороны', sw('autoSpeak'))}
          <div class="row"><button class="btn" data-act="test-no">🇳🇴 Тест: «God morgen»</button><button class="btn" data-act="test-uk">🇺🇦 Тест: «Доброго ранку»</button><button class="btn" data-act="test-ru">🇷🇺 Тест: «Доброе утро»</button></div>
          <div class="row"><button class="btn listen-cta" data-listen-choose>${Listen.HEADPHONES(18, true)} Слушать в наушниках</button><button class="btn ghost" data-listen-intro>❔ Как слушать</button></div>
        </div>
        <div class="panel">
          <h3>🎙 Распознавание речи</h3>
          <p class="small muted">Модель NB-Whisper слушает норвежскую речь прямо на устройстве: проверка произношения, диктант и субтитры к передачам без субтитров.</p>
          ${set('Качество распознавания', 'Лёгкое — быстрее, для телефонов · Точное — меньше ошибок, для компьютера с видеокартой', '')}
          <div data-asr-quality></div>
        </div>
        <div class="panel">
          <h3>🖼 Картинки</h3>
          ${set('Источник', 'Картинка есть всегда: если ИИ недоступен — фото, иначе эмодзи-картинка', sel('imageProvider', [['pollinations', '🎨 ИИ-рисунок → фото → эмодзи'], ['wikimedia', '📷 Реальное фото → эмодзи'], ['emoji', '😀 Эмодзи-картинки (мгновенно, офлайн)'], ['off', 'Выключено']]))}
          <label class="field"><span>🔑 Ключ Pollinations — бесплатно, снимает лимит «1 ИИ-картинка в 45 сек» · <a href="https://enter.pollinations.ai" target="_blank">получить →</a></span>
            <input class="input" type="password" data-text="pollinationsToken" value="${U.esc(s.pollinationsToken || '')}" placeholder="необязательно" autocomplete="off"></label>
          <div class="row" style="gap:6px;align-items:center"><button class="btn sm" data-act="gallery-keys">📌 Галерея картинок: свои ключи Unsplash / Pexels</button><span class="small muted">необязательно — без ключей галерея ищет в Openverse и Wikimedia</span></div>
          ${set('Стиль', '', sel('imageStyle', Object.entries(Images.STYLE_NAMES)))}
          ${set('Автоматически создавать картинки', 'Для новых карт и при изучении', sw('autoImages'))}
          <label class="field"><span>Шаблон URL генератора ({prompt}, {seed})</span><input class="input" data-text="imageTemplate" value="${U.esc(s.imageTemplate)}"></label>
        </div>
        <div class="panel">
          <h3>☁️ Облако — вход и синхронизация</h3>
          <p class="small muted">Личный кабинет со входом по почте, через Google, Apple, Facebook, X и синхронизация колод между телефоном и компьютером. Нужен бесплатный проект Supabase: supabase.com → New project (регион Stockholm) → Settings → API → скопируйте <b>Project URL</b> и <b>anon public</b> ключ. Ключ <b>service_role</b> сюда не вставляйте никогда. Для синхронизации один раз выполните в Supabase → SQL Editor скрипт <b>supabase/norsk-kort-sync.sql</b> (пошагово — docs/cloud-sync-setup.md). Ключи API в облако не попадают никогда.</p>
          <label class="field"><span>Project URL</span><input class="input" data-text="cloudUrl" value="${U.esc(s.cloudUrl || '')}" placeholder="https://xxxx.supabase.co"></label>
          <label class="field"><span>anon public key (не секретный — так задумано Supabase)</span><input class="input" data-text="cloudAnon" value="${U.esc(s.cloudAnon || '')}" placeholder="eyJ…" autocomplete="off"></label>
          <label class="field"><span>Адрес приложения для «Поделиться» (например, https://имя.github.io/norsk-kort/)</span><input class="input" data-text="appUrl" value="${U.esc(s.appUrl || '')}" placeholder="определяется автоматически на GitHub"></label>
          <div class="row" style="gap:6px"><button class="btn sm" data-act="to-account">👤 Мой кабинет</button><button class="btn sm" data-act="share-app">${ShareApp.SHARE_SVG(16)} Поделиться приложением</button></div>
        </div>
        <div class="panel">
          <h3>🗣 Переводчик в наушниках</h3>
          ${Interp.settingsHtml()}
          <button class="btn sm primary" data-act="interp-try">${Interp.on ? '■ Выключить' : '🎙 Включить переводчик'}</button>
        </div>
        <div class="panel">
          <h3>${YouTube.YT_SVG(20)} YouTube</h3>
          <p class="small muted">Кнопка ▶ YouTube на карточке ищет видео про слово или выражение — везде на YouTube и на каналах ${YouTube.CHANNELS.length} учителей норвежского (на норвежском, английском, русском и украинском). Это работает без ключа.</p>
          <label class="field"><span>Ключ YouTube Data API — чтобы видео показывались прямо в приложении со встроенным плеером (необязательно) · <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank">получить бесплатно →</a></span>
            <input class="input" type="password" data-text="ytKey" value="${U.esc(s.ytKey || '')}" placeholder="AIza…" autocomplete="off"></label>
          <p class="tiny muted">Бесплатно: около 100 поисков в день — этого хватает надолго: каждое слово ищется один раз и запоминается на 30 дней, а если лимит всё же закончится, приложение само переключится на ссылки до завтра. Как получить: Google Cloud → создать проект → «Enable» YouTube Data API v3 → Credentials → Create API key. Лучше ограничить ключ: Application restrictions → Websites → адрес приложения. Ключ хранится только в этом браузере и не попадает в резервные копии.</p>
        </div>
        <div class="panel">
          <h3>🎨 Внешний вид</h3>
          <button type="button" class="st-looks" data-act="looks-open" aria-haspopup="dialog"><span class="st-looks-i" aria-hidden="true">🎨</span><span class="st-looks-t"><b>Оформление</b><small>темы приложения — викинги, тролли, праздники — и вид карточек</small></span><span class="st-looks-go" aria-hidden="true">›</span></button>
          ${set('Тема', '', sel('theme', [['dark', '🌙 Тёмная'], ['light', '☀️ Светлая'], ['auto', 'Как в системе']]))}
          ${set('🗂 Порядок колод', 'В боковом меню и в «Моих колодах». «Недавние сверху» — колода, которую вы учите или открывали, поднимается первой. 📌 Закреплённые (в «⋯» колоды) — всегда наверху', sel('deckSort', [['recent', 'Недавние сверху'], ['created', 'Как создавал'], ['abc', 'По алфавиту']]))}
          ${set('Русский текст — голубым', 'Норвежский белым, русский светло-голубым (и в скобках тоже)', sw('highlightRu'))}
        </div>
        ${window.ArtCards ? ArtCards.settingsHtml() : ''}
        <div class="panel" style="grid-column:1/-1">
          <h3>🧭 Что работает и на сколько</h3>
          <p class="small muted">Состояние всех сервисов с вашими текущими настройками и что сделать, чтобы каждый работал на 100%.</p>
          ${Guides.statusHtml()}
          <div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap"><button class="btn sm primary" data-help="" title="Все темы: как учить, слушать, смотреть с субтитрами, Telegram… — и показ на экране">❓ Как пользоваться</button><button class="btn sm" data-act="guides-reset" title="Снова показывать подсказки, приветственные окна и напоминания">💡 Показать подсказки снова</button></div>
        </div>
        <div class="panel" style="grid-column:1/-1">
          <h3>📚 Полезные ресурсы для норвежского</h3>
          <p class="small muted">Проверенные бесплатные источники. Словари со значком ✓ уже встроены в карточки.</p>
          <div class="res-grid">${[
            ['ordbokene.no', 'https://ordbokene.no', 'Ordbøkene ✓', 'Официальный словарь bokmål/nynorsk — встроен (📖)'],
            ['tatoeba.org', 'https://tatoeba.org/ru/sentences/search?from=nob&to=rus', 'Tatoeba ✓', 'Живые предложения NO→RU — встроено (💬)'],
            ['lexin.oslomet.no', 'https://lexin.oslomet.no/', 'LEXIN', 'Норвежско-русский словарь OsloMet для иммигрантов'],
            ['naob.no', 'https://naob.no', 'NAOB', 'Большой академический словарь норвежского'],
            ['ntnu.edu', 'https://www.ntnu.edu/now', 'NTNU «Now You\'re Talking»', 'Бесплатный университетский курс норвежского (A1–A2)'],
            ['grammatikk.com', 'https://grammatikk.com', 'grammatikk.com', 'Бесплатные упражнения по грамматике'],
            ['clozemaster.com', 'https://www.clozemaster.com', 'Clozemaster', 'Слова в контексте предложений (после начального уровня)'],
            ['tv.nrk.no', 'https://tv.nrk.no', 'NRK TV', 'Норвежское ТВ с субтитрами — практика на слух'],
            ['podcasts.apple.com', 'https://podcasts.apple.com/search?term=L%C3%A6r%20norsk%20n%C3%A5', '«Lær Norsk Nå» подкаст', 'Подкаст для изучающих норвежский'],
            ['forvo.com', 'https://forvo.com/languages/no/', 'Forvo', 'Произношение слов носителями'],
            ['commons.wikimedia.org', 'https://commons.wikimedia.org/wiki/Category:Lingua_Libre_pronunciation-nor', 'Lingua Libre ✓', 'Записи носителей — встроено (🎙 Живой голос)'],
            ['sprakradet.no', 'https://www.sprakradet.no', 'Språkrådet', 'Языковой совет Норвегии: правила и нормы'],
          ].map(([d, u, n, t]) => `<a class="res-item" href="${u}" target="_blank" rel="noopener">
              <img class="ai-ico" src="https://www.google.com/s2/favicons?domain=${d}&sz=64" width="22" height="22" alt="" onerror="this.replaceWith(document.createTextNode('🌐'))">
              <span><b>${U.esc(n)}</b><small>${U.esc(t)}</small></span></a>`).join('')}</div>
        </div>
        <div class="panel st-reset">
          <h3>↺ Настройки по умолчанию</h3>
          <p class="small muted">Вернёт обычные значения настроек: как учить, направление, какие карты и сколько, подсказки, голоса, жесты, картинки и оформление. Колоды, карточки, прогресс, ключи и аккаунты останутся как есть.</p>
          <button type="button" class="btn" data-act="settings-reset">↺ Вернуть настройки по умолчанию</button>
        </div>
        <div class="panel">
          <h3>💾 Данные</h3>
          <p class="small muted">Всё хранится локально в браузере (IndexedDB). Делайте резервные копии.</p>
          <div class="row"><button class="btn" data-act="backup">💾 Скачать бэкап</button><button class="btn" data-act="restore">♻️ Восстановить из файла</button>
          <button class="btn" data-act="sample">🎁 Добавить пример колоды</button><button class="btn" data-act="trash">🗑 Корзина (${Store.trashCount()})</button><button class="btn bad" data-act="wipe">Удалить всё</button></div>
          ${window.Resume ? `<div class="row" style="margin-top:8px;gap:8px;flex-wrap:wrap;align-items:center"><button class="btn" data-act="resume-forget" title="Видео, передачи, подкасты, книги и прослушивание колод снова начнутся сначала">📍 Забыть все места продолжения</button><span class="small muted">${(n => n ? `запомнено мест: ${n}` : 'пока ничего не запомнено')(Resume.count())}</span></div>` : ''}
        </div>
        ${window.About && window.APP ? `<div class="panel st-about" style="grid-column:1/-1"><img src="icons/icon.svg" width="48" height="48" alt="">
          <div class="st-about-t"><h3 class="ui-t">${window.NavIcons ? NavIcons.icon('info', 20) : ''}<span>О приложении</span></h3><span class="small muted">${U.esc(APP.name)} · версия ${U.esc(APP.version)} · сборка ${U.esc(APP.build)} — что нового, обновления, лицензии</span></div>
          <button type="button" class="btn" data-about aria-haspopup="dialog">${window.NavIcons ? NavIcons.icon('info', 18) : ''}<span>О приложении</span></button></div>` : ''}
      </div>`;
    root.oninput = e => {
      const t = e.target;
      if (t.dataset.ai) { const [id, f] = t.dataset.ai.split('.'); AI.cfg(id)[f] = t.value.trim(); Store.save(); App.updateBadge(); return; }
      if (t.dataset.text) { Store.setSetting(t.dataset.text, t.value.trim()); App.updateBadge(); }
      if (t.dataset.num && t.type === 'range') Store.setSetting(t.dataset.num, parseFloat(t.value));
    };
    root.onchange = e => {
      const t = e.target;
      if (t.dataset.key) { Store.setSetting(t.dataset.key, t.checked); if (t.dataset.key === 'highlightRu') App.applyTheme(); }
      if (t.dataset.num) { const v = parseFloat(t.value); if (!isNaN(v)) Store.setSetting(t.dataset.num, U.clamp(v, +t.min, +t.max)); if (t.dataset.num === 'goal') App.render(); }
      if (t.matches && t.matches('[data-vac-to]') && t.value) { Progress.startVacation(Date.now(), new Date(t.value + 'T12:00').getTime()); App.render(); return; }
      if (t.dataset.ai) { const [id, f] = t.dataset.ai.split('.'); AI.cfg(id)[f] = t.value.trim(); Store.save(); App.updateBadge(); if (f !== 'model') App.render(); return; }
      if (t.dataset.cvoice) {
        const [eng, lang] = t.dataset.cvoice.split('.');
        const cv = Object.assign({}, Store.settings.cloudVoices || {});
        cv[eng] = Object.assign({}, cv[eng] || {}, { [lang]: t.value });
        Store.setSetting('cloudVoices', cv);
        return;
      }
      if (t.dataset.trtoggle) {
        const on = new Set([...root.querySelectorAll('[data-trtoggle]')].filter(x => x.checked).map(x => x.dataset.trtoggle));
        Store.setSetting('translators', Object.keys(Translators.LIST).filter(id => on.has(id)));
        return;
      }
      if (t.dataset.sel) {
        Store.setSetting(t.dataset.sel, t.value);
        if (t.dataset.sel === 'theme') App.applyTheme();
        if (t.dataset.sel === 'deckSort') App.renderSidebar(); // 🕘 the sidebar list at once (home redraws when you go there)
        if (t.dataset.sel === 'aiProvider' || t.dataset.sel === 'dictTranslator' || t.dataset.sel === 'ttsEngine') { if (window.Voices) Voices.resetWarnings(); App.updateBadge(); App.render(); }
        if (t.dataset.sel === 'swipeStyle' && demo) demoFly('right'); // show the new animation right away
      }
    };
    if (window.Speech && Speech.mountQuality) Speech.mountQuality(root.querySelector('[data-asr-quality]'));
    // 🔒 under every key field: where the key lives
    root.querySelectorAll('input[type="password"]').forEach(inp => {
      const host = inp.closest('label') || inp;
      if (!host.nextElementSibling || !host.nextElementSibling.classList.contains('key-local')) host.insertAdjacentHTML('afterend', '<div class="key-local">🔒 Хранится только на этом устройстве — разработчики приложения его не видят</div>');
    });
    // live demo of the chosen swipe animation (buttons + drag with mouse/finger)
    const demo = root.querySelector('[data-demo]');
    const demoBack = () => setTimeout(() => {
      demo.style.transition = 'none'; demo.style.transform = 'translateY(30px) scale(.9)'; demo.style.opacity = '0'; demo.style.zIndex = '';
      requestAnimationFrame(() => { demo.style.transition = 'transform .45s cubic-bezier(.2,1.3,.4,1), opacity .3s'; demo.style.transform = ''; demo.style.opacity = '1'; });
    }, 250);
    const demoFly = dir => Study.flyOut(demo, dir, demoBack);
    if (demo) {
      let sx = 0, sy = 0, dx = 0, dy = 0, down = false, axis = null;
      demo.addEventListener('pointerdown', e => { down = true; axis = null; sx = e.clientX; sy = e.clientY; dx = dy = 0; demo.style.transition = 'none'; try { demo.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } });
      demo.addEventListener('pointermove', e => {
        if (!down) return;
        dx = e.clientX - sx; dy = e.clientY - sy;
        if (!axis && Math.hypot(dx, dy) > 8) axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
        if (axis) demo.style.transform = Study.dragTransform(Store.settings.swipeStyle, axis === 'x' ? dx : 0, axis === 'y' ? dy : 0, axis);
      });
      demo.addEventListener('pointerup', () => {
        if (!down) return; down = false;
        const d = axis === 'x' ? dx : dy;
        if (Math.abs(d) > 70) demoFly(axis === 'x' ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
        else { demo.style.transition = 'transform .3s'; demo.style.transform = ''; }
      });
    }
    root.onclick = async e => {
      const dd = e.target.closest('[data-demo-dir]');
      if (dd && demo) { demoFly(dd.dataset.demoDir); return; }
      const segBtn = e.target.closest('[data-seg] button');
      if (segBtn) {
        Store.setSetting(segBtn.parentElement.dataset.seg, segBtn.dataset.v);
        if (segBtn.parentElement.dataset.seg === 'aiMode') await AI.detectBridge();
        App.updateBadge(); App.render(); return;
      }
      const a = e.target.closest('[data-act]');
      if (!a) return;
      if (Progress.settingsClick(a, () => App.render())) return;
      switch (a.dataset.act) {
        case 'interp-try': await Interp.toggle(); App.render(); break;
        case 'to-account': App.go('account'); break;
        case 'gallery-keys': Views.loadGallery().then(G => G.keys()).catch(() => UI.toast('Не получилось открыть — проверьте интернет и попробуйте ещё раз', 'warn')); break;
        case 'share-app': ShareApp.open(); break;
        case 'keys-note-ok': Store.setSetting('keysNoteSeen', true); a.closest('details').open = false; break;
        case 'show-key': { const i = root.querySelector('[data-text="claudeKey"]'); i.type = i.type === 'password' ? 'text' : 'password'; break; }
        case 'test-prov': {
          const id = a.dataset.id;
          const status = root.querySelector(`[data-prov-status="${id}"]`);
          if (id === 'claude') await AI.detectBridge();
          status.innerHTML = '<span class="spinner sm"></span>';
          try { const r = await AI.test(id); status.innerHTML = `<span style="color:var(--good)">✓ Работает: «${U.esc(r)}»</span>`; App.updateBadge(); }
          catch (err) { status.innerHTML = `<span style="color:var(--bad)">${U.esc(U.niceErr(err))}</span>`; }
          break;
        }
        case 'use-prov':
          Store.setSetting('aiProvider', a.dataset.id);
          if (!AI.configured(a.dataset.id)) UI.toast('Сначала добавьте ключ (или запустите мост) — иначе проверка не сработает', 'warn', 5000);
          App.updateBadge(); App.render(); break;
        case 'voice-use': Store.setSetting('ttsEngine', a.dataset.id === 'system' ? 'browser' : a.dataset.id); Voices.resetWarnings(); App.render(); break;
        case 'voice-test': {
          const id = a.dataset.id, lang = a.dataset.lang;
          const text = lang === 'no' ? 'Hei! Jeg heter Nora. Hvordan går det med deg i dag?' : 'Привет! Как у тебя сегодня дела?';
          if (!Voices.isCloud(id)) {
            const prev = Store.settings.ttsEngine;
            Store.settings.ttsEngine = id === 'system' ? 'browser' : 'google';
            TTS.speak(text, lang); // the engine is chosen synchronously — the setting can be put back right away
            Store.settings.ttsEngine = prev;
            break;
          }
          a.disabled = true;
          try {
            TTS.stop();
            await Voices.play(id, text, lang, TTS.currentRate());
          } catch (err) { UI.toast(`${Voices.ENGINES[id].name}: ${err.message}`, 'bad', 6000); }
          a.disabled = false;
          break;
        }
        case 'voice-eleven': {
          try { const n = await Voices.loadElevenVoices(); UI.toast(`ElevenLabs: загружено голосов — ${n}`, 'good'); App.render(); }
          catch (err) { UI.toast('ElevenLabs: ' + err.message, 'bad', 5000); }
          break;
        }
        case 'test-no': TTS.speak('God morgen! Hvordan har du det?', 'no'); break;
        case 'test-ru': TTS.speak('Доброе утро! Как дела?', 'ru'); break;
        case 'test-uk': TTS.speak('Доброго ранку! Як справи?', 'uk'); break;
        case 'uk-voice-help': UI.modal({ title: '🇺🇦 Украинский голос', body: TTS.ukHelpHtml() + '<div class="small muted" style="margin-top:8px">После установки перезапустите браузер и выберите голос: Настройки → 🔊 Озвучка → «💻 Системный украинский голос».</div>' }); break;
        case 'backup': Exporter.backup(); break;
        case 'restore': App.pickFiles(); break;
        case 'looks-open': Views.looksSheet(null); break;
        case 'settings-reset': Views.resetSettings(); break;
        case 'resume-forget':
          if (window.Resume && await UI.confirm('Забыть, где вы остановились, во всех видео, передачах, подкастах, книгах и при прослушивании колод?<br><span class="small muted">Всё снова начнётся сначала. Карточки и прогресс изучения не изменятся. Книги в Читалке хранят свои страницы — их сбрасывают в меню книги.</span>', { ok: 'Забыть', title: '📍 Места продолжения' })) {
            Resume.clearAll(); UI.toast('Места продолжения забыты', 'good'); App.render();
          }
          break;
        case 'sample': App.addSampleDeck(); UI.toast('Пример колоды добавлен', 'good'); break;
        case 'wipe':
          // the biggest loss in the app: two steps (a question, then the word typed by hand) and a safety copy first
          if (await UI.confirm('Точно удалить ВСЕ колоды и карточки?<br><span class="small muted">Колоды попадут в 🗑 Корзину — их можно вернуть в течение 30 дней. А вот статистика ответов будет очищена навсегда. Перед удалением приложение само скачает резервную копию всех ваших данных.</span>', { danger: true, ok: 'Дальше', title: '⚠️ Удалить всё' })) {
            const w = await UI.prompt('Чтобы подтвердить, напишите слово УДАЛИТЬ', '', 'удалить');
            if (w == null) break;
            if (String(w).trim().toLowerCase() !== 'удалить') { UI.toast('Слово не совпало — ничего не удалено 💚', 'good'); break; }
            try { Exporter.backup(); } catch (e) { /* the download failed — the user confirmed twice */ }
            await Store.clearAll(); UI.toast('Все колоды перемещены в корзину. Резервная копия скачана в «Загрузки»', 'warn', 6000); App.go('home');
          }
          break;
        case 'trash': Views.trashDialog(); break;
        case 'guides-reset': Guides.resetAll(); UI.toast('Подсказки и приветственные окна снова будут показываться', 'good'); break;
        case 'fsrs-reset':
          if (await UI.confirm('Вернуть средние настройки повторений?<br><span class="small muted">Сроки уже назначенных повторений не изменятся. Через месяц приложение снова проверит, можно ли подстроить их под вашу память.</span>', { ok: 'Сбросить к средним' })) FSRSOpt.reset();
          break;
      }
    };
    document.addEventListener('voices-changed', function h() { document.removeEventListener('voices-changed', h); if (App.view.name === 'settings') App.render(); });
  };

  window.Views = Views;
})();
