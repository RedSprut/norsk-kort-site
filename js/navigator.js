/* ============ 🧭 «Навигатор по приложению» (js/navigator.js) ============
 * One window instead of «Как пользоваться» + «Знакомство»: it opens from the sidebar (right under «Главная»), the
 * top-bar «?», the phone's «Меню» and the plaque at the bottom of home. Inside:
 *   👆 «Экскурсия по экрану»       — the coach marks of the screen you are on (CoachMarks.replay; home: js/coachmarks.js)
 *   ❓ «Помощь по разделам»         — the help centre (js/help.js)
 *   ✨ «Знакомство с приложением»  — the showcase (js/showcase.js)
 *   «Хочу…» — quick paths: учить слова, смотреть видео, слушать радио, читать, создать карточки…
 * Any element with [data-appnav] opens it.   window.AppNav = { open(), tourHere() }
 */
(function () {
  'use strict';
  const esc = s => U.esc(s == null ? '' : String(s));
  const NAMES = { home: 'Главная', deck: 'Колода', study: 'Занятие', settings: 'Настройки', stats: 'Статистика', levels: 'Уровни', account: 'Мой кабинет' };
  const places = () => (window.CoachMarks && CoachMarks.PLACES) || [];

  /** which screen's coach marks to show: a window open on top first, else the page */
  function here() {
    let id = null;
    try { const act = window.CoachMarks && CoachMarks.active ? CoachMarks.active() : []; if (act.length) id = act[0]; } catch (e) { id = null; }
    const v = (window.App && App.view && App.view.name) || 'home';
    if (!id && places().some(p => p.id === v)) id = v;
    const p = id && places().find(x => x.id === id);
    return { id, view: v, name: p ? p.name : (NAMES[v] || 'этот экран') };
  }
  function tourHere(h) {
    h = h || here();
    if (h.id && window.CoachMarks && CoachMarks.replay) return CoachMarks.replay(h.id);
    if (h.view === 'levels' && window.Help && Help.tour) return Help.tour('levels');
    if (window.Help && Help.open) return Help.open();
    return null;
  }

  function body(h) {
    const hand = window.Help && Help.handIcon ? Help.handIcon(26) : '👆';
    const big = (k, ico, t, sub, cls = '') => `<button type="button" class="nv-big ${cls}" data-sx="${k}"><span class="nv-big-i" aria-hidden="true">${ico}</span><span class="nv-big-t"><b>${t}</b><small>${sub}</small></span><span class="nv-chev" aria-hidden="true">›</span></button>`;
    const path = (k, ico, t, sub) => `<button type="button" class="nv-path" data-sx="${k}"><span class="nv-path-i" aria-hidden="true">${ico}</span><span class="nv-path-t"><b>${t}</b><small>${sub}</small></span></button>`;
    const S = (window.Views && Views.SEC_SVG) || {};
    return `<div class="nv-top">
        ${big('nv-tour', hand, 'Экскурсия по экрану', `Покажу прямо на экране «${esc(h.name)}», где что нажать и что произойдёт`, 'nv-tour')}
        ${window.Help ? big('nv-help', '❓', 'Помощь по разделам', 'Коротко и с анимацией: как учить, слушать, смотреть видео с субтитрами, Telegram…') : ''}
        ${window.Showcase ? big('nv-show', '✨', 'Знакомство с приложением', 'Короткий показ всех возможностей — минута, и всё понятно') : ''}
      </div>
      <div class="m-sec-t nv-h">Хочу…</div>
      <div class="nv-paths">
        ${path('nv-study', '🧠', 'Учить слова', 'карточки на сегодня')}
        ${path('nv-video', S.video ? S.video() : '▶️', 'Смотреть видео', 'YouTube, NRK TV, своё видео')}
        ${window.LearnBy ? path('nv-learn', '🎓', 'Учить по материалам', 'фильм, передача, песня или книга — по частям') : ''}
        ${path('nv-radio', '📻', 'Слушать радио', 'NRK в эфире и подкасты')}
        ${path('nv-read', '📖', 'Читать', 'книги, библиотека, новости')}
        ${path('nv-create', '➕', 'Создать карточки', 'тема, список слов, фото, файл')}
        ${path('nv-listen', '🎧', 'Слушать в наушниках', 'колоды, книги, новости')}
        ${path('nv-drills', '🏋️', 'Упражнения', 'грамматика, время, экзамены')}
        ${window.PhraseDay ? path('nv-phrase', '🌅', 'Фраза дня', 'послушать, разобрать, сказать самому') : ''}
        ${window.LevelTest ? path('nv-level', '🎯', 'Узнать свой уровень', 'короткий тест, от A1 до B2') : ''}
        ${path('nv-exam', '🎓', 'Подготовиться к экзамену', 'Norskprøven A1–B2: ответы, темы, маршрут')}
        ${window.ExamTrainer ? path('nv-examtr', '🧪', 'Тренировка Norskprøven', 'все четыре части — с таймером и баллами') : ''}
        ${window.Views && Views.progress ? path('nv-progress', '📈', 'Мой прогресс', 'всё начатое — продолжить с того же места') : ''}
        ${path('nv-looks', '🎨', 'Оформление', 'темы приложения и вид карточек')}
        ${window.About ? path('nv-about', 'ℹ️', 'О приложении', 'версия, что нового, обновления, лицензии') : ''}
      </div>`;
  }

  function study() {
    if (!Store.cards().length) { Create.open(); return; }
    const n = Math.max(5, (Store.settings.goal || 20) - (window.Progress ? Progress.todayCount() : 0));
    Study.start({ deckId: null, size: Store.settings.goalOn !== false ? n : undefined });
  }
  const RUN = {
    'nv-tour': h => setTimeout(() => tourHere(h), 260), // the window has slid away first
    'nv-help': () => Help.open(),
    'nv-show': () => Showcase.open(),
    'nv-study': study,
    'nv-video': () => Views.section('video'),
    'nv-radio': () => Views.go('nrkradio'),
    'nv-learn': () => Views.go('learn'),
    'nv-read': () => Views.section('read'),
    'nv-create': () => Create.open(),
    'nv-listen': () => (window.ListenUI ? ListenUI.chooser() : Listen.open('')),
    'nv-drills': () => Views.section('drills'),
    'nv-exam': () => Views.go('examprep'),
    'nv-phrase': () => Views.go('phraseday'),
    'nv-level': () => Views.go('leveltest'),
    'nv-examtr': () => Views.go('examtr'),
    'nv-progress': () => Views.go('progress'),
    'nv-looks': () => Views.looksSheet(App.view && App.view.name === 'deck' ? App.view.params.id : null),
    'nv-about': () => About.open(),
  };

  function open() {
    const h = here();
    // the soft reminder dot on «?» has done its job
    try { document.querySelectorAll('.hc-dot').forEach(b => b.classList.remove('hc-dot')); const s = JSON.parse(localStorage.getItem('nk-help') || '{}') || {}; if (!s.opened) { s.opened = Date.now(); localStorage.setItem('nk-help', JSON.stringify(s)); } } catch (e) { /* private mode */ }
    if (!(window.Views && Views.sxSheet)) { if (window.Help) Help.open(); return null; }
    return Views.sxSheet('🧭 Навигатор по приложению', body(h), { cls: 'nv-sheet', detent: 'large', run: k => {
      const f = RUN[k]; if (!f) return;
      try { f(h); } catch (e) { console.warn('navigator', k, e); UI.toast('Этот раздел сейчас не открылся — попробуйте ещё раз', 'warn'); }
    } });
  }

  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-appnav]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    // from inside another window: that one closes first (never a window on top of a window)
    const bd = b.closest('.modal-backdrop');
    if (bd && bd._m && bd._m.close) { bd._m.close(); setTimeout(open, 200); return; }
    open();
  }, true);

  window.AppNav = { open, tourHere, here };
})();
