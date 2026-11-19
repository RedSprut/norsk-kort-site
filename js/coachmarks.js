/* ============ 👆 Coach marks on the first visit of every place (js/coachmarks.js) ============
 * The first time a person opens a section where they might hesitate, our hand (Help.coach in js/help.js) flies in and
 * shows, step by step, the 2–5 controls that are not obvious, with a bubble «what happens if you tap here».
 *  - PLACES: a registry { id, name, ctx: 'view' | 'modal' | 'float', view / modal (where it lives), when (selector(s):
 *    the place is open when one of them is visible there), steps [{ t: selector(s) | fn, h: title, x: text }], topic
 *    (the help-centre topic of the place), open() (how to open it for a replay), tour (a Help tour as the replay fallback) }.
 *  - Nothing in the modules is edited: a MutationObserver on the page (windows of UI.modal, #view, the interpreter
 *    panel) + capture listeners on entry buttons ([data-act], [data-sb], [data-…-open]…) schedule a light check; the
 *    place must stay open ~1 s, the person must not be typing / tapping, and nothing else may be on top: no preloader
 *    (#nkp), no welcome, no tour or other coach, no hint bubble, no dark screen. Then Help.coach(steps, { once }).
 *  - Seen marks live with the other coaches: localStorage 'nk-help' → coach['cm-<id>'] (Help.coachSeen / coachReset);
 *    «Показать подсказки снова» (Guides.resetAll → 'hints-reset') brings every one back.
 *  - Replay: Help.replay(placeId | topicId) (also CoachMarks.replay). A «?» is added to windows that have none (it opens
 *    the place's help topic, or replays at once when there is no topic), and every help-centre topic page that belongs
 *    to a place gets «👆 Показать подсказку на экране» (its foot; via a watcher — no edits in js/help.js beyond data-hc-id).
 *  - Steps are only the elements visible right now (a missing control is skipped quietly); Esc / «Пропустить» end it.
 */
(function () {
  'use strict';
  const PFX = 'cm-';
  const HKEY = 'nk-help';
  const now = () => Date.now();
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const isShown = el => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05;
  };
  /** every element for a selector / list of selectors / function, inside root */
  const all = (sel, root) => {
    const out = [];
    for (const s of [].concat(sel || [])) {
      try { if (typeof s === 'function') out.push(...[].concat(s(root) || []).filter(Boolean)); else out.push(...$$(s, root || document)); } catch (e) { /* a bad selector: skip */ }
    }
    return out;
  };
  const first = (sel, root) => all(sel, root).find(isShown) || null;
  const backdrops = () => $$('#modal-root > .modal-backdrop:not(.closing)');
  const topBd = (skipHelp) => backdrops().filter(b => !(skipHelp && b.querySelector(':scope > .modal.hc-modal'))).pop() || null;
  const modalOf = bd => (bd ? bd.querySelector(':scope > .modal') : null);
  /** settings rows / headings found by their text */
  const byText = (sel, re) => root => $$(sel, root).filter(e => re.test(e.textContent || ''));
  const panelH3 = re => root => byText('.panel h3', re)(root);
  const narrow = () => (document.documentElement.clientWidth || innerWidth) < 720;

  /* ---------------- the places ---------------- */
  const PLACES = [
    /* 🗂 the deck page */
    { id: 'deck', name: 'Колода', ctx: 'view', view: 'deck', topic: 'study', when: '.launcher [data-act="start"]',
      open: () => { const d = window.Store && Store.decks()[0]; if (d) App.go('deck', { id: d.id }); },
      steps: [
        { t: '.launcher [data-seg="mode"]', h: '🎛 Как учить', x: '«Карточки» — переворачивать, «Ввод» — вписать слово, «Тест» — выбрать ответ, «На слух» — узнать по звуку. Режим можно менять перед каждым занятием.' },
        { t: '.launcher [data-seg="filter"]', h: '🧠 Какие карты', x: '«Умное повторение» само берёт то, что пора повторить, и немного новых. Можно выбрать только новые, трудные или выученные.' },
        { t: '.launcher [data-act="start"]', h: '▶ Учить', x: 'Начинает занятие с выбранными настройками. Выйти можно в любой момент — всё сохраняется.' },
        { t: ['.deck-head .deck-listen', '.toolbar [data-act="listen"]'], h: '🎧 Слушать колоду', x: 'Вся колода вслух — в наушниках или через динамик: слово, пауза, перевод. Экран можно выключить.' },
      ] },
    /* 🃏 the study screen */
    { id: 'study', name: 'Учёба', ctx: 'view', view: 'study', topic: 'study', when: '.study .flashcard',
      open: () => Study.start({ deckId: null }),
      steps: [
        { t: '.study .flashcard', h: '👆 Нажмите на карточку', x: 'Она перевернётся и покажет ответ. Ещё раз — вернётся. На клавиатуре то же делает пробел.' },
        { t: ['.study .answer-row', '.study .quiz-opts', '.study .type-box'], h: '✓ Знаю · ✗ Не знаю', x: 'Вспомнили — «Знаю» (→), нет — «Не знаю» (←). От ответа зависит, когда слово вернётся: трудное — скоро, лёгкое — нескоро.' },
        { t: '.study .study-top [data-act="hints"]', h: '💡 Подсказки', x: 'Включают и выключают подсказки на лицевой стороне: картинку, часть речи, значки. Без них проверка строже.' },
        { t: ['.study .tools-read .tools-title', '.study .tools-read'], h: '🔊 Озвучка', x: 'Прочитать карточку вслух: всё, только норвежский или только перевод — медленнее или быстрее. «Слушать колоду» — всю подряд.' },
        { t: ['.study .tools-card [data-kind="forms"]', '.study .tools-card .tools-title'], h: '🛠 Карточка и 📚 Формы слова', x: 'Здесь всё для этой карточки: «Формы слова» с переводом каждой, примеры, синонимы, «✏️ Редактировать» и проверка нейросетью.' },
      ] },
    /* 📚 the library */
    { id: 'library', q: true, name: 'Библиотека', ctx: 'modal', modal: '.bs-modal', topic: 'library', when: '.bs-tabs',
      open: () => Bookshelf.open('now'),
      steps: [
        { t: '.bs-tabs', h: '📑 Разделы', x: '«Читаю сейчас», «Мои книги», «Слушать», «Найти книгу» — все книги и аудио в одном окне.' },
        { t: ['[data-bs="cont"].bs-big', '[data-bs="cont"]'], h: '▶ Продолжить', x: 'Откроет книгу ровно на той странице, где вы остановились.' },
        { t: '[data-bs="add"]', h: '📥 Добавить книгу', x: 'Свой файл: PDF, EPUB, FB2, DOCX или TXT. Книга хранится только на этом устройстве.' },
        { t: '[data-bs-tab="listen"]', h: '🌙 Слушать и таймер сна', x: 'Книга вслух крупными кнопками. Таймер сна: 10–60 минут или до конца главы — чтение затихнет само, место сохранится.' },
      ] },
    /* 📖 the reader */
    { id: 'reader', q: true, name: 'Читалка', ctx: 'modal', modal: '.rd-modal', topic: 'reader', when: '.rd-flow .rd-s',
      steps: [
        { t: '.rd-flow .rd-s:not(.rd-cyr):not(.rd-tr)', h: '👆 Нажмите на слово', x: 'Появится перевод слова и кнопки «➕ В карточки» и «▶ Читать отсюда». Выделите несколько слов — переведётся фраза.' },
        { t: '[data-a="play"]', h: '▶ Читать вслух', x: 'Норвежский читает норвежский голос, перевод — русский. Предложение подсвечивается, страницы листаются сами.' },
        { t: '.rd-aa', h: 'Aa Вид текста', x: 'Размер и шрифт, межстрочный интервал, фон — светлый, сепия или тёмный. Страницами или одной лентой.' },
        { t: '[data-panel-btn="listen"]', h: '🌙 Голоса и таймер сна', x: 'Скорость, голоса и таймер сна: чтение затихнет само, место сохранится.' },
      ] },
    /* 📝 tests by chapter: the list, a test, writing, speaking */
    { id: 'prove', q: true, name: 'Тесты по главам', ctx: 'modal', modal: '.prove-modal', topic: 'prove', when: '.pv-card [data-start]',
      open: () => Prove.open(),
      steps: [
        { t: '.pv-card', h: '📝 Выберите тест', x: 'Каждая карточка — тест по главе или по уровню: сколько заданий, ваш лучший результат и начатые.' },
        { t: '.pv-card [data-start]', h: '▶ Пройти', x: 'Начатый тест продолжится с того же места. «🔁 Повторить ошибки» появится после первой попытки.' },
        { t: () => $$('.prove-modal .pv-group h3').filter(h => /Устная/.test(h.textContent)), h: '🗣 Устная часть', x: 'Как на Norskprøve: подготовка по таймеру, ответ голосом — и оценка.' },
      ] },
    { id: 'prove-test', q: true, name: 'Тест', ctx: 'modal', modal: '.prove-modal', topic: 'prove', when: '.pv-test .pv-steps',
      steps: [
        { t: '.pv-steps', h: '🧭 Задания теста', x: 'Здесь все части теста. Нажмите на любую — перейдёте к ней. Отмеченные уже проверены.' },
        { t: '.pv-hintbar [data-hints]', h: '💡 Подсказки', x: 'Включите — вместо ввода появятся слова-фишки: нажмите слово, потом пропуск (или перетащите).' },
        { t: '.pv-sec [data-check]', h: '✓ Проверить', x: 'Покажет ошибки и правильные ответы с коротким объяснением. Потом — дальше, к следующему заданию.' },
      ] },
    { id: 'prove-write', q: true, name: 'Письменное задание', ctx: 'modal', modal: '.prove-modal', topic: 'prove', when: '.pv-kit-btn',
      steps: [
        { t: '.pv-tr', h: '🇷🇺 Перевести задание', x: 'Задание — по-норвежски, как на экзамене. Не понятно — нажмите, покажу по-русски (отметится как подсказка).' },
        { t: '.pv-kit-btn', h: '🧰 Шаблон и фразы', x: 'План текста и готовые фразы. Нажмите на фразу — она встанет в текст там, где курсор. На оценку не влияет.' },
        { t: '[data-grade]', h: '📊 Оценить текст', x: 'Оценка 0–12 по пяти критериям и уровень A1–B1. С нейросетью — точнее, с отмеченными ошибками.' },
      ] },
    { id: 'prove-speak', q: true, name: 'Устное задание', ctx: 'modal', modal: '.prove-modal', topic: 'prove', when: '.pv-sp-micbtn',
      steps: [
        { t: '.pv-sp-go', h: '⏱ Таймер', x: 'Как на устном экзамене: сначала время на подготовку, потом — на ответ. Можно и без таймера.' },
        { t: '.pv-sp-micbtn', h: '🎙 Говорить', x: 'Нажмите и отвечайте по-норвежски — речь распознаётся прямо на устройстве. Нет микрофона — напишите ответ.' },
        { t: '.pv-tr', h: '🇷🇺 Перевести задание', x: 'Покажу задание по-русски, если что-то непонятно.' },
      ] },
    /* 🧩 word order trainer */
    { id: 'ordtr', name: 'Порядок слов', ctx: 'modal', modal: '.ot-modal', topic: 'ordtr', when: '.ot-hub-tile',
      open: () => OrdTrainer.open('hub'),
      steps: [
        { t: '.ot-hub-tile[data-ot-go="wo"]', h: '🧱 Собери предложение', x: 'Внутри — уровни: выберите, что тренировать (глагол на 2-м месте, инверсия, ikke…), и нажмите «Начать».' },
        { t: '.ot-hub-tile[data-ot-go="pos"]', h: '📊 Таблица позиций', x: 'Цветная таблица порядка слов. Там же «✍️ Напиши сам»: своё предложение по заданию — программа проверит порядок слов.' },
        { t: '.ot-hub-tile[data-ot-go="decks"]', h: '📚 Каталог таблиц', x: 'Глаголы, существительные, прилагательные, местоимения — любая таблица становится колодой в одно нажатие.' },
      ] },
    { id: 'ordtr-wo', name: 'Собери предложение', ctx: 'modal', modal: '.ot-modal', topic: 'ordtr', when: '.ot-levels [data-lv]',
      steps: [
        { t: '.ot-levels', h: '🎚 Уровни', x: 'Нажмите на темы, которые хотите тренировать, — можно несколько. Выбранные подсвечены.' },
        { t: '.ot-start [data-start]', h: '▶ Начать', x: 'Раунд из нескольких предложений: нажимайте или перетаскивайте слова по порядку, потом «Проверить».' },
      ] },
    { id: 'ordtr-pos', name: 'Таблица позиций', ctx: 'modal', modal: '.ot-modal', topic: 'ordtr', when: '[data-pos-mode="write"]',
      steps: [
        { t: '.pt-modes', h: '🎛 Как тренироваться', x: 'От простого к сложному: смотреть, разложить по столбцам, собрать, переделать.' },
        { t: '[data-pos-mode="write"]', h: '✍️ Напиши сам', x: 'Задание и пример — вы пишете своё предложение, программа проверит порядок слов (с нейросетью — и остальное).' },
      ] },
    /* 🎭 dialogues */
    { id: 'dialogs', q: true, name: 'Диалоги по ролям', ctx: 'modal', modal: '.dlg-modal', topic: 'dialogs', when: '.dlg-card [data-setup]',
      open: () => Dialogs.open(),
      steps: [
        { t: '.dlg-seg', h: '🌐 Перевод', x: 'Показывать перевод реплик на русский, на украинский — или скрыть его.' },
        { t: '.dlg-card [data-listen]', h: '🎧 Слушать', x: 'Сначала послушайте весь диалог: реплики звучат по очереди, текущая подсвечена.' },
        { t: '.dlg-card [data-setup]', h: '🎭 Играть роль', x: 'Вы говорите за одного героя, приложение — за другого.' },
      ] },
    { id: 'dialogs-setup', q: true, name: 'Выбор роли', ctx: 'modal', modal: '.dlg-modal', topic: 'dialogs', when: '.dlg-roles .dlg-role',
      steps: [
        { t: '.dlg-roles', h: '🎭 Кем вы будете?', x: 'Выберите героя — его реплики будете говорить вы.' },
        { t: '.dlg-modes', h: '🧠 Как показывать реплику', x: '«По памяти» — только перевод, «Пустые места» — часть слов скрыта, «С текстом» — просто прочитать вслух.' },
        { t: '.dlg-setup [data-start]', h: '▶ Начать', x: 'Собеседника озвучит приложение, а потом — ваша очередь.' },
      ] },
    { id: 'dialogs-turn', q: true, name: 'Ваша реплика', ctx: 'modal', modal: '.dlg-modal', topic: 'dialogs', when: '[data-mic]',
      steps: [
        { t: '[data-mic]', h: '🎙 Ответ голосом', x: 'Нажмите и скажите реплику по-норвежски. Без микрофона — напишите ответ в поле выше.' },
        { t: '[data-hint]', h: '💡 Подсказка', x: 'Забыли? Первое нажатие покажет реплику с пропусками, второе — всю реплику и произнесёт её.' },
        { t: '.dlg-answer [data-check]', h: '✓ Проверить', x: 'Сравню с образцом мягко: регистр, знаки и мелкие опечатки не в счёт.' },
      ] },
    /* 📗 grammar reference */
    { id: 'gramref', q: true, name: 'Справочник грамматики', ctx: 'modal', modal: '.gr-modal', topic: 'gramref', when: '.gr-search',
      open: () => GramRef.open(),
      steps: [
        { t: '.gr-search', h: '🔍 Поиск', x: 'Ищите по-русски или по-норвежски: «предлоги», «sin», «прошедшее».' },
        { t: '.gr-levels', h: '🎚 Уровень', x: 'Только темы A1, A2 или B1 — или все сразу.' },
        { t: '.gr-item', h: '📗 Тема', x: 'Правило, таблицы, примеры со звуком, типичная ошибка — и кнопки «к тренажёру».' },
      ] },
    { id: 'gramref-topic', q: true, name: 'Тема грамматики', ctx: 'modal', modal: '.gr-modal', topic: 'gramref', when: '.gr-topic',
      steps: [
        { t: '.gr-tables .gr-say', h: '🔊 Нажмите на форму', x: 'Норвежские формы в таблице читаются вслух.' },
        { t: '[data-gr-train]', h: '🏋️ К тренажёру', x: 'Сразу потренировать эту тему в упражнении.' },
        { t: '.gr-nav', h: '‹ › Соседние темы', x: 'Листайте темы по порядку — или вернитесь к списку.' },
      ] },
    /* 📺 NRK TV, YouTube and the subtitle player */
    { id: 'nrk', name: 'NRK TV', ctx: 'modal', modal: '.nrk-modal:not(.nrkr-modal)', topic: 'video', when: '.nrk-search',
      open: () => NrkTV.open(),
      steps: [
        { t: '.nrk-search', h: '🔎 Поиск передач', x: 'Передача или сериал по названию: Supernytt, Dagsrevyen, Skam…' },
        { t: '.nrk-quick', h: '⭐ Популярное', x: 'Готовые подборки — одно нажатие.' },
        { t: '.nrk-tile', h: '▶ Откройте передачу', x: 'Видео откроется с норвежскими субтитрами и переводом. Нажмите на слово — перевод и «В карточку».' },
      ] },
    { id: 'youtube', name: 'YouTube', ctx: 'modal', modal: '.yt-modal', topic: 'video', when: '[data-q]',
      open: () => YouTube.open(),
      steps: [
        { t: '[data-q]', h: '🔎 Поиск видео', x: 'Напишите тему или вставьте ссылку на видео YouTube.' },
        { t: '.yt-ch', h: '👩‍🏫 Каналы учителей', x: 'Каналы для изучающих норвежский. Видео откроется с субтитрами: нажмите на слово — перевод и «В карточку».' },
      ] },
    { id: 'subs', name: 'Субтитры', ctx: 'modal', modal: '.subs-modal', topic: 'video', tour: 'subs', when: ['.subs-list .sw', '.subs-now .sw'],
      steps: [
        { t: ['.subs-now .sw', '.subs-list .sw'], h: '👆 Нажмите на слово', x: 'Видео встанет на паузу, появится перевод и кнопка «В карточку» — слово станет карточкой со звуком из видео.' },
        { t: '[data-trm]', h: '🙈 Перевод строки', x: '«Виден» — читайте спокойно. «Слово (перевод)» — перевод у каждого слова. «Размыт» и «скрыт» — проверьте себя.' },
        { t: ['.subs-view .sv-btn', '.sv-btn'], h: 'Aa Вид субтитров', x: 'Размер и цвет текста, строка с переводом прямо на видео, показ на телевизоре.' },
        { t: '.sl-add', h: '➕ Строка — в карточку', x: 'Целая фраза станет карточкой — с настоящим звуком из видео.' },
      ] },
    /* ✈️ Telegram */
    { id: 'telegram', name: 'Telegram', ctx: 'modal', modal: '.tg-modal', topic: 'telegram', when: '[data-tgtab]',
      open: () => Telegram.open(null, 'channels'),
      steps: [
        { t: '[data-tgtab="search"]', h: '🔎 Найти по слову', x: 'Посты, видео и картинки норвежских каналов с нужным словом.' },
        { t: '[data-tgtab="vocab"]', h: '🗂 Карточки из чата', x: 'Приложение соберёт из канала пары «слово — перевод»; каждая сверяется с переводчиком.' },
        { t: '[data-tgtab="channels"]', h: '📢 Норвежские каналы', x: 'Готовый список каналов, где учат норвежский: открыть в Telegram или добавить как источник карточек.' },
        { t: '[data-tgtab="setup"]', h: '🔐 Каналы и аккаунт', x: 'Подключите свой Telegram один раз (QR-код) — и приложение сможет читать ваши группы. Ключи остаются на устройстве.' },
      ] },
    /* 🗣 the live interpreter (a floating panel) */
    { id: 'interp', name: 'Переводчик', ctx: 'float', topic: 'interp', when: '.ip-panel:not(.min) .ip-head',
      steps: [
        { t: '.ip-panel [data-ips]', h: '🎙 Переводчик слушает', x: 'Говорите как обычно: фраза переведётся и прозвучит в наушниках. Здесь видно, что он делает сейчас.' },
        { t: '.ip-panel [data-ipwho]', h: '🤖 Кто переводит', x: 'Нажмите — выберите нейросеть: она понимает смысл всей фразы и подсказывает короткие ответы.' },
        { t: '.ip-panel [data-ip="dark"]', h: '🌑 Тёмный экран', x: 'Экран гаснет, переводчик работает дальше — телефон можно убрать в карман.' },
        { t: '.ip-panel [data-ip="min"]', h: '▾ Свернуть', x: 'Панель уменьшится и не будет мешать. ✕ рядом — выключить переводчик.' },
      ] },
    /* 📥 new deck, import preview, photo / scan → cards */
    { id: 'newdeck', q: true, name: 'Новая колода', ctx: 'modal', modal: '.deck-editor', topic: 'create', tour: 'create', when: '.src-pick [data-src]',
      steps: [
        { t: '[data-src="photo"]', h: '📷 Фото / скан', x: 'Сфотографируйте страницу учебника или тетрадь — приложение распознает слова и переведёт недостающие.' },
        { t: '[data-src="paste"]', h: '📋 Вставить текст', x: 'Список «hus – дом» или просто норвежские слова — перевод приложение найдёт само.' },
        { t: '[data-src="file"]', h: '📄 Файл', x: 'PDF, Word, Excel, Anki, CSV или TXT — перед импортом покажу, что нашлось.' },
      ] },
    { id: 'import', q: true, name: 'Импорт', ctx: 'modal', modal: '.modal', topic: null, when: m => (m.querySelector('[data-act="swap"]') && m.querySelector('[data-deck]') ? $$('[data-table] .tbl', m) : []),
      steps: [
        { t: '[data-deck]', h: '🗂 В какую колоду', x: 'Выберите колоду, куда лягут карточки.' },
        { t: '[data-table] thead select', h: '🔤 Что в колонке', x: 'Колонки определены сами. Если ошибка — выберите над колонкой: норвежский, перевод, пример…' },
        { t: '[data-act="swap"]', h: '⇄ Поменять NO и RU', x: 'Норвежский и русский перепутались местами? Одно нажатие.' },
        { t: '[data-act="go"]', h: '📥 Импортировать', x: 'Карточки появятся в колоде. Дубликаты можно пропустить галочкой выше.' },
      ] },
    { id: 'scan', q: true, name: 'Карточки с фото', ctx: 'modal', modal: '.modal', topic: 'create', when: '.tg-pairs .tg-pair',
      steps: [
        { t: '.tg-pairs .tg-pair', h: '✅ Проверьте пары', x: 'Каждая строка — будущая карточка: норвежский и перевод. Поправьте текст или снимите галочку с лишнего.' },
        { t: '[data-tr]', h: '🌐 Перевести недостающее', x: 'Строки без перевода переведёт переводчик или нейросеть — с пометкой, кто переводил.' },
        { t: '[data-ocr]', h: '🔤 Распознать ещё раз', x: 'Слова прочитались плохо? Распознайте заново — или снимите ровнее и при хорошем свете.' },
        { t: '[data-save]', h: '➕ Сохранить', x: 'Отмеченные пары станут карточками в выбранной колоде.' },
      ] },
    /* ⚙️ settings */
    { id: 'settings', name: 'Настройки', ctx: 'view', view: 'settings', topic: 'ai', when: '.settings-grid',
      open: () => App.go('settings'),
      steps: [
        { t: byText('.setting', /Язык перевода/), h: '🌐 Язык перевода', x: 'Какой перевод показывать на карточках и спрашивать при изучении: русский, украинский или оба.' },
        { t: panelH3(/Озвучка/), h: '🔊 Голоса', x: 'Норвежский и русский голос, скорость, автоозвучка. Кнопки «Тест» — послушать сразу.' },
        { t: panelH3(/Нейросет/), h: '🤖 Нейросеть', x: 'Бесплатно — Gemini или Groq: вставьте ключ и нажмите «🔌 Проверить». Перевод точнее, проверка карточек, объяснения.' },
        { t: '[data-act="guides-reset"]', h: '💡 Показать подсказки снова', x: 'Все подсказки на экране, приветствие и напоминания покажутся заново.' },
      ] },
    /* 🎧 listening: the chooser and «Сейчас играет» */
    { id: 'listen', name: 'Что послушать', ctx: 'modal', modal: '.lc-modal', topic: 'listen', when: '.lc-decks',
      open: () => ListenUI.chooser(),
      steps: [
        { t: '.lc-deck:not(:disabled)', h: '▶ Колода — сразу звук', x: 'Нажмите на колоду — она зазвучит, а плеер «Сейчас играет» откроется сам.' },
        { t: '.lc-srcs', h: '📚 Книги, новости, радио', x: 'Ещё что послушать: книги, новости, NRK Радио и подкасты, аудиокурсы.' },
      ] },
    { id: 'np', name: 'Сейчас играет', ctx: 'modal', modal: '.np-modal', topic: 'listen', when: '[data-np="toggle"]',
      steps: [
        { t: '[data-np-speed]', h: '🐢 Скорость', x: 'Медленно, обычно или быстро — меняется сразу, с того же места.' },
        { t: '[data-np-dir]', h: '🔀 Что звучит', x: 'Норвежское → русское, наоборот, или «🧠 Вспомни сам»: сначала перевод, вы говорите, потом ответ.' },
        { t: '[data-lx="where"]', h: '🔈 Где слушать', x: 'В наушниках или вслух через динамик — как удобно.' },
        { t: '[data-np="dark"]', h: '🌑 Тёмный экран', x: 'Чёрный экран не реагирует на случайные касания — телефон можно положить в карман. Звук продолжится.' },
      ] },
    /* 🎧 audio courses */
    { id: 'audiocourse', q: true, name: 'Аудиокурсы', ctx: 'modal', modal: '.ac-modal', topic: 'audiocourse', when: '.ac-card',
      open: () => AudioCourse.open(),
      steps: [
        { t: '[data-ac-dl]', h: '⬇ Загрузить в приложение', x: '100 уроков 50languages — внутрь приложения, один раз. Потом слушаются без интернета.' },
        { t: '[data-ac-import]', h: '📂 У меня уже скачано', x: 'Есть папка, MP3 или архив .zip? Выберите их — уроки появятся здесь.' },
        { t: '[data-ac-play]', h: '▶ Слушать', x: 'Уроки один за другим — в наушниках или через динамик; место запоминается.' },
        { t: '[data-ac-view]', h: '📋 Уроки', x: 'Список уроков, повтор урока и повтор отрывка A–B.' },
      ] },
    /* 📘 decks of my textbooks (this Mac only) */
    { id: 'mycourse', q: true, name: 'Колоды моих учебников', ctx: 'modal', modal: '.mc-modal', topic: null, when: ['[data-mc-n]', '[data-mc-all]'],
      open: () => MyCourse.open(),
      steps: [
        { t: '.mc-book-head', h: '📘 Ваш учебник', x: 'Нажмите — откроются главы. Колоды по главам видны только на этом компьютере.' },
        { t: '[data-mc-n]', h: '➕ Добавить главу', x: 'Колода этой главы. Слова, что уже есть, не повторятся, а ваш прогресс сохранится.' },
        { t: '[data-mc-all]', h: '📚 Все главы', x: 'Все главы сразу — по колоде на главу.' },
      ] },
  ];
  const byId = id => PLACES.find(p => p.id === id) || null;

  /* ---------------- where am I ---------------- */
  /** the root element of the place when it is open and on top right now (bd — the top window, or null) */
  function rootOf(p, bd) {
    if (p.ctx === 'modal') {
      const m = modalOf(bd);
      if (!m || !m.matches(p.modal)) return null;
      return first(p.when, m) ? m : null;
    }
    if (bd) return null;
    if (document.querySelector('.dark-screen')) return null;
    if (p.ctx === 'view') {
      if (!document.body || document.body.dataset.view !== p.view) return null;
      const v = document.getElementById('view');
      return v && first(p.when, v) ? v : null;
    }
    return first(p.when, document) ? document.body : null;
  }
  const activeHere = bd => PLACES.filter(p => rootOf(p, bd));

  /* ---------------- seen marks (shared with Help.coach) ---------------- */
  const hstate = () => { try { return JSON.parse(localStorage.getItem(HKEY) || '{}') || {}; } catch (e) { return {}; } };
  const seen = id => (window.Help && Help.coachSeen ? Help.coachSeen(PFX + id) : !!(hstate().coach || {})[PFX + id]);
  function markSeen(id) {
    try { const s = hstate(); s.coach = Object.assign({}, s.coach, { [PFX + id]: now() }); localStorage.setItem(HKEY, JSON.stringify(s)); } catch (e) { /* private mode */ }
  }

  /* ---------------- start a coach ---------------- */
  let running = null, busyUntil = 0;
  function steps(p, root) {
    return p.steps.map(s => {
      const target = () => all(s.t, root);
      return { target, title: s.h, text: typeof s.x === 'function' ? s.x() : s.x, timeout: 700 };
    }).filter(s => s.target().some(isShown));
  }
  function start(p, replay) {
    if (!window.Help || !Help.coach || (Help.now && Help.now())) return Promise.resolve(false);
    const root = rootOf(p, topBd());
    if (!root) return Promise.resolve(false);
    const list = steps(p, root);
    if (!list.length) return Promise.resolve(false);
    running = p.id;
    return Help.coach(list, { id: PFX + p.id, once: !replay, onEnd: () => { running = null; busyUntil = now() + 2500; } })
      .then(ok => { if (ok || replay) markSeen(p.id); if (!ok) running = null; return ok; });
  }

  /* ---------------- the watcher: is it a calm moment on a new place? ---------------- */
  let cand = null, candAt = 0, lastInput = 0, tickT = 0;
  const BUSY_SEL = '#nkp, body > .hl, .hc-here, .nk-here, .nk-hint, .hc-hint, .lt-hint, .tgr-hint, .dark-screen, .dropdown-menu, .popover, .rd-pop';
  function calm() {
    if (!window.Help || !Help.coach || !window.App || !App.view || !window.Store || !Store.state) return false;
    if (document.visibilityState !== 'visible') return false;
    if (Help.now && Help.now()) return false;
    if (Help._here || running || now() < busyUntil) return false;
    if (document.querySelector(BUSY_SEL)) return false;
    const bd = topBd(), m = modalOf(bd);
    if (m && m.matches('.hc-modal, .guide-modal, .ask-close, .narrow:not(.sp-modal)')) return false; // the help centre, a question, a guide
    return true;
  }
  function tick() {
    tickT = 0;
    try {
      // a tour of the help centre is showing this place right now: it counts as seen (no second explanation after it)
      const cur = window.Help && Help.now && Help.now();
      if (cur && !cur.coach) { activeHere(topBd()).forEach(p => { if (!seen(p.id)) markSeen(p.id); }); cand = null; return; }
      if (!calm()) { cand = null; return; }
      const p = PLACES.find(x => !seen(x.id) && rootOf(x, topBd()));
      if (!p) { cand = null; return; }
      if (cand !== p) { cand = p; candAt = now(); later(1000); return; }
      if (now() - candAt < 900 || now() - lastInput < 700) { later(500); return; }
      cand = null;
      start(p, false);
    } catch (e) { console.warn('coachmarks', e); }
  }
  function later(ms = 350) { if (!tickT) tickT = setTimeout(tick, ms); }

  /* ---------------- «?» where a window has none, and «👆 Показать подсказку на экране» on topic pages ---------------- */
  const hasTopic = id => !!(id && window.Help && Array.isArray(Help.TOPICS) && Help.TOPICS.some(t => t.id === id));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function addQ() {
    const bd = topBd(), m = modalOf(bd);
    if (!m) { // ⚙️ the settings page: a «?» beside its title replays its marks
      const h1 = document.body.dataset.view === 'settings' && document.querySelector('#view > h1');
      if (h1 && !h1.querySelector('.help-q')) h1.insertAdjacentHTML('beforeend', ' <button type="button" class="help-q cm-q" data-cm-replay="settings" aria-label="Показать подсказку на экране: Настройки" data-tip="Показать подсказку на экране">?</button>');
      return;
    }
    if (m.matches('.hc-modal, .narrow')) return;
    const head = m.querySelector(':scope > .modal-head');
    if (!head || head.querySelector(':scope > .help-q')) return;
    const p = PLACES.find(x => x.q && rootOf(x, bd)); // only windows that have no «?» of their own (js/help.js adds the others)
    if (!p) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'help-q cm-q';
    if (hasTopic(p.topic)) { b.dataset.help = p.topic; b.setAttribute('aria-label', `Как пользоваться: ${p.name}`); b.dataset.tip = 'Как это работает?'; }
    else { b.dataset.cmReplay = p.id; b.setAttribute('aria-label', `Показать подсказку на экране: ${p.name}`); b.dataset.tip = 'Показать подсказку на экране'; }
    b.textContent = '?';
    head.insertBefore(b, head.querySelector(':scope > .modal-home, :scope > [data-close]'));
  }
  /** the places of a help topic (the open one first) */
  function placesOfTopic(tid, bd) {
    const list = PLACES.filter(p => p.topic === tid);
    return list.filter(p => rootOf(p, bd)).concat(list.filter(p => !rootOf(p, bd)));
  }
  function addReplay() {
    $$('#modal-root .hc-modal:not(.hc-welcome)').forEach(m => {
      const topicEl = m.querySelector('[data-hc] .hc-topic');
      const foot = m.querySelector('[data-hcfoot]');
      if (!topicEl || !foot || foot.querySelector('[data-cm-replay]')) return;
      let tid = topicEl.dataset.hcId;
      if (!tid && window.Help && Help.TOPICS) { const h = topicEl.querySelector('.hc-thead h2'); const t = h && Help.TOPICS.find(x => x.title === h.textContent.trim()); tid = t && t.id; }
      if (!tid) return;
      const under = topBd(true);
      const p = placesOfTopic(tid, under).find(x => rootOf(x, under) || x.open || x.tour);
      if (!p) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn cm-replay'; b.dataset.cmReplay = p.id;
      b.innerHTML = `${window.Help && Help.handIcon ? Help.handIcon(20) : '👆'}<span><b>Показать подсказку на экране</b><small>${esc(p.name)}: где нажать и что произойдёт</small></span>`;
      foot.insertBefore(b, foot.querySelector('[data-hc-tour]'));
    });
  }

  /* ---------------- replay ---------------- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function waitRoot(p, ms) {
    const t0 = now();
    while (now() - t0 < ms) { if (rootOf(p, topBd())) return true; await sleep(150); }
    return false;
  }
  /** show the coach marks of a place again (id — a place, or a help topic: its open place) */
  async function replay(id) {
    let p = byId(id);
    if (!p && id) p = placesOfTopic(id, topBd()).find(x => rootOf(x, topBd()) || x.open || x.tour) || null;
    if (!p) return false;
    if (window.Help && Help.now && Help.now()) Help.end();
    await sleep(60);
    if (!rootOf(p, topBd())) {
      if (p.open) { try { await p.open(); } catch (e) { console.warn('coachmarks open', e); } await waitRoot(p, 4500); }
      if (!rootOf(p, topBd())) {
        if (p.tour && window.Help && Help.tour) { Help.tour(p.tour, { intro: false }); return true; }
        try { UI.toast(`Откройте «${p.name}» — подсказка покажется там`, 'warn', 4000); } catch (e) { /* no UI */ }
        return false;
      }
    }
    await sleep(250);
    return start(p, true);
  }

  /* ---------------- wiring ---------------- */
  const ENTRY = '[data-act], [data-sb], [data-nav], [data-bookshelf-open], [data-prove-open], [data-dialogs-open], [data-gramref-open], [data-ordtr], [data-klokka-open], [data-lv-open], [data-listen-btn], [data-start], [data-setup], [data-ot-go], [data-pos-mode], [data-gr-topic], [data-bs], [data-tgtab]';
  function boot() {
    let raf = 0;
    const mo = new MutationObserver(() => {
      later(350);
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; try { addQ(); addReplay(); } catch (e) { /* ignore */ } });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    // entry buttons: a section is about to open — look a little later (the observer catches it too; this is the quick path)
    document.addEventListener('click', e => {
      const r = e.target.closest && e.target.closest('[data-cm-replay]');
      if (r) {
        e.preventDefault(); e.stopPropagation();
        const id = r.dataset.cmReplay, hc = r.closest('.modal-backdrop');
        if (hc && hc.querySelector(':scope > .modal.hc-modal') && hc._m) { hc._m.close(); setTimeout(() => replay(id), 280); } else replay(id);
        return;
      }
      if (e.target.closest && e.target.closest(ENTRY)) { setTimeout(() => later(50), 450); setTimeout(() => later(50), 1300); }
    }, true);
    ['pointerdown', 'keydown', 'input', 'wheel'].forEach(t => window.addEventListener(t, () => { lastInput = now(); }, { capture: true, passive: true }));
    document.addEventListener('visibilitychange', () => later(800));
    document.addEventListener('hints-reset', () => { cand = null; busyUntil = 0; later(1500); });
    setInterval(() => later(0), 1600);
    // the help centre: Help.replay(placeId | topicId)
    const hook = () => { if (window.Help && !Help.replay) Help.replay = replay; };
    hook(); setTimeout(hook, 0);
  }
  const CoachMarks = {
    PLACES,
    replay,
    /** for checks: which places are open on top right now */
    active: () => activeHere(topBd()).map(p => p.id),
    /** for checks: the place whose marks are on screen now (null — none) */
    running: () => running,
    seen,
    /** show a place's marks again on its next visit (no id — every place) */
    reset(id) { if (!window.Help || !Help.coachReset) return; if (id) Help.coachReset(PFX + id); else PLACES.forEach(p => Help.coachReset(PFX + p.id)); },
    check: () => later(0),
  };
  window.CoachMarks = CoachMarks;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
