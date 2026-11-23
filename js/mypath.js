/* ============ 📈 «Мой прогресс» — everything started, in one place (js/mypath.js, #/progress) ============
 * The home card «▶ Продолжить» shows one thing; its ✕ only hides it from home. Here is ALL of it:
 *   video (NRK TV, YouTube, own video, Telegram), radio & podcasts, audio courses, books (Книги, the reader: PDF / EPUB…),
 *   listening queues, role dialogues — js/continue.js Continue.all() (the places of js/resume.js and the players' own),
 *   decks with progress (learned %, due now — js/store.js) and exam-prep tracks when window.ExamPrep tells its progress.
 * Per item: picture / icon, title, a bar («прослушано 63 %»), a human line («остановились на 12:40», «осталось 7 страниц»,
 * «к повторению 14»), the last time, and
 *   «▶ Продолжить»  opens exactly there (the same openers as the home card);
 *   «Потом»         7 days off the home card (Continue.snooze) — listed here under «Отложено»;
 *   «Забыть»        after a question: the place is removed (Continue.forget); the toast's «Отменить» puts it back.
 * Finished (≥ 95 %) → «Закончено» with «Пройти снова». Filters «Всё / Незаконченное / Закончено»; a summary on top
 * (начато, закончено, minutes listened / read this week — Resume.minutes).
 * Entry points: the home card «Всё незаконченное →», the sidebar «📈 Мой прогресс», a plaque in «Статистика»; the screen is
 * Views.progress (App.go('progress'), the address #/progress — js/nav.js), Back leaves it. CSS: css/mypath.css (lazy).
 * ExamPrep (optional, guarded): ExamPrep.progressList() → [{ id, title, pct (0..1 or 0..100), at, line?, done?, ico?, open?() }]
 */
(function () {
  'use strict';
  if (!window.Views) return;
  const DAY = 864e5, CSS_HREF = 'css/mypath.css?v=1';
  const esc = s => (window.U && U.esc ? U.esc(s == null ? '' : String(s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
  const pl = (n, f) => (window.U && U.plural ? U.plural(n, f) : f[2]);
  const lc1 = s => String(s || '').replace(/^\S/, c => (/^[А-ЯЁA-Z][а-яёa-z]/.test(String(s)) ? c.toLowerCase() : c));
  const safeImg = u => { u = String(u || ''); return /^https:\/\/[^\s"'<>]+$/i.test(u) || /^\/api\/[^\s"'<>]+$/.test(u) ? u.slice(0, 1000) : ''; };
  const safeCover = u => { u = String(u || ''); return /^(https:\/\/|data:image\/|blob:|\/|[\w-]+\/)[^"'<>\s]*$/i.test(u) && u.length < 400000 ? u : ''; };
  const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };

  function loadCss() {
    if (document.querySelector('link[data-mypath-css]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = CSS_HREF; l.dataset.mypathCss = '1';
    document.head.appendChild(l);
  }

  /* ---------------- words ---------------- */
  function dateWord(at) {
    if (!(at > 0)) return '';
    const d = Date.now() - at;
    if (d >= 0 && d < 3600e3) return 'только что';
    const t = new Date(); t.setHours(0, 0, 0, 0);
    if (at >= +t) return 'сегодня';
    if (at >= +t - DAY) return 'вчера';
    try { return new Date(at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: new Date(at).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }); } catch (e) { return ''; }
  }
  const dayMonth = at => { try { return new Date(at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); } catch (e) { return ''; } };
  function minWord(m) {
    m = Math.max(0, Math.round(m || 0));
    if (m < 60) return { n: String(m), u: 'мин' };
    const h = Math.floor(m / 60), r = m % 60;
    return { n: r ? `${h} ч ${r}` : String(h), u: r ? 'мин' : 'ч' };
  }
  const GROUPS = [
    ['learn', '🎓', 'Учить по материалам'],
    ['video', '🎬', 'Видео'],
    ['audio', '📻', 'Радио и подкасты'],
    ['course', '🎧', 'Аудиокурсы'],
    ['book', '📚', 'Книги'],
    ['listen', '🔊', 'Слушаю'],
    ['dialog', '🎭', 'Диалоги по ролям'],
    ['deck', '🗂', 'Колоды'],
    ['exam', '🎓', 'Подготовка к экзамену'],
  ];

  /* ---------------- decks ---------------- */
  function deckItems() {
    const out = [];
    if (!window.Store || !Store.decks) return out;
    let firstOf = null;
    const firsts = () => {
      if (firstOf) return firstOf;
      firstOf = new Map();
      try {
        const deckOf = new Map(Store.cards().map(c => [c.id, c.deckId]));
        (Store.state.log || []).forEach(l => { const d = deckOf.get(l.cardId); if (d && !(firstOf.get(d) <= l.ts)) firstOf.set(d, l.ts); });
      } catch (e) { /* no log */ }
      return firstOf;
    };
    Store.decks().forEach(d => {
      try {
        const cards = Store.cards(d.id);
        if (!cards.length) return;
        let last = 0, started = false;
        cards.forEach(c => ['nr', 'rn'].forEach(k => { const s = c.srs && c.srs[k]; if (s && s.reps) { started = true; last = Math.max(last, +s.lastReview || 0); } }));
        if (!started) return;
        const st = Store.deckStats(d.id);
        const pct = st.total ? st.learned / st.total : 0;
        const line = st.due ? `к повторению ${st.due}` : st.new ? `ещё ${st.new} ${pl(st.new, ['новая карточка', 'новые карточки', 'новых карточек'])}` : 'на сегодня всё повторено';
        const done = st.learnedPct >= 95 && !st.due;
        const study = (o = {}) => { if (window.Study && Study.start) Study.start(Object.assign({ deckId: d.id }, o)); else App.go('deck', { id: d.id }); };
        out.push({ key: 'deck:' + d.id, grp: 'deck', at: last, first: firsts().get(d.id) || 0, title: d.name || 'Колода', kind: `Колода · ${st.total} ${pl(st.total, ['карточка', 'карточки', 'карточек'])}`,
          ico: '🗂', cover: safeCover(d.cover), pct, done, word: 'выучено', line, due: st.due, verb: st.due ? 'Повторить' : 'Продолжить',
          go: () => (st.due || st.new ? study() : App.go('deck', { id: d.id })),
          restart: () => study({ filter: 'all' }) });
      } catch (e) { /* a broken deck — skip it */ }
    });
    return out;
  }

  /* ---------------- exam preparation (another module; only if it tells its progress) ---------------- */
  function examItems() {
    const E = window.ExamPrep;
    if (!E) return [];
    let list = null;
    try { list = typeof E.progressList === 'function' ? E.progressList() : typeof E.progress === 'function' ? E.progress() : null; } catch (e) { list = null; }
    if (!Array.isArray(list)) return [];
    const out = [];
    list.forEach(t => {
      try {
        if (!t || t.id == null) return;
        let p = +t.pct; if (!isFinite(p)) p = null; else if (p > 1) p /= 100;
        if (!(p > 0) && !t.done) return;
        out.push({ key: 'exam:' + t.id, grp: 'exam', at: +t.at || 0, first: +t.first || 0, title: String(t.title || 'Подготовка к экзамену'), kind: String(t.kind || 'Экзамен'),
          ico: t.ico || '🎓', pct: p, done: !!t.done || (p != null && p >= 0.95), word: 'пройдено', line: String(t.line || ''), verb: 'Продолжить',
          go: () => { if (typeof t.open === 'function') t.open(); else if (typeof E.open === 'function') E.open(t.id); },
          restart: () => { if (typeof t.restart === 'function') t.restart(); else if (typeof t.open === 'function') t.open(); else if (typeof E.open === 'function') E.open(t.id); } });
      } catch (e) { /* skip */ }
    });
    return out;
  }

  /* ---------------- everything ---------------- */
  let map = new Map();
  function collect() {
    let list = [];
    try { if (window.Continue && Continue.all) list = Continue.all(); } catch (e) { console.warn('mypath', e); }
    let forgot = {};
    try { forgot = JSON.parse(localStorage.getItem('nk-cont-forgot') || '{}') || {}; } catch (e) { forgot = {}; }
    let later = {};
    try { later = JSON.parse(localStorage.getItem('nk-cont-later') || '{}') || {}; } catch (e) { later = {}; }
    const now = Date.now();
    [deckItems(), examItems()].forEach(extra => extra.forEach(x => {
      if (+forgot[x.key] >= x.at) return;
      x.laterUntil = +later[x.key] > now ? +later[x.key] : 0;
      list.push(x);
    }));
    list.forEach(x => { if (!x.grp) x.grp = 'video'; if (x.pct != null && x.pct >= 0.95) x.done = true; });
    list.sort((a, b) => (b.at || 0) - (a.at || 0));
    map = new Map(list.map(x => [x.key, x]));
    return list;
  }

  /* ---------------- drawing ---------------- */
  let filter = '';
  const SVG = {
    play: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/></svg>',
    again: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
  };
  function thumb(x) {
    const img = safeImg(x.img);
    const cover = !img && x.cover ? x.cover : '';
    return `<span class="mp-thumb${img || cover ? ' has-img' : ''}" aria-hidden="true"${cover ? ` style="background-image:url('${esc(cover).replace(/'/g, '%27')}')"` : ''}><span class="mp-ico">${x.ico || '▶️'}</span>${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>`;
  }
  function itemHtml(x) {
    const p = x.pct == null ? null : Math.max(0, Math.min(100, Math.round(x.pct * 100)));
    const bar = p == null ? '' : `<span class="mp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-label="${esc(x.word || 'пройдено')} ${p} %"><i style="width:${Math.max(p ? 2 : 0, p)}%"></i></span>`;
    const pctTxt = p == null || x.done ? '' : `<b class="mp-pct">${esc(x.word || 'пройдено')} ${p}&nbsp;%</b>`;
    const line = x.line ? (pctTxt ? ' · ' + esc(lc1(x.line)) : esc(x.line)) : '';
    const when = dateWord(x.at);
    const meta = [when ? `последний раз: ${when}` : '', x.first && dayMonth(x.first) && dateWord(x.first) !== when && x.at - x.first > DAY ? `начато ${dayMonth(x.first)}` : '',
      x.laterUntil ? `отложено до ${dayMonth(x.laterUntil)}` : '', x.hiddenHome && !x.laterUntil && !x.done ? 'убрано с главной' : ''].filter(Boolean).join(' · ');
    const go = x.done
      ? `<button type="button" class="btn primary mp-go" data-mp="again" data-key="${esc(x.key)}" title="${esc(`Пройти снова: ${x.title}`)}">${SVG.again}<span>Пройти снова</span></button>`
      : `<button type="button" class="btn primary mp-go" data-mp="go" data-key="${esc(x.key)}" title="${esc(`${x.verb || 'Продолжить'}: ${x.title}`)}">${SVG.play}<span>${esc(x.grp === 'deck' && x.due ? 'Повторить' : 'Продолжить')}</span></button>`;
    const later = x.done ? '' : x.laterUntil
      ? `<button type="button" class="btn ghost mp-later" data-mp="now" data-key="${esc(x.key)}" title="Снова показывать на главной уже сейчас">Вернуть</button>`
      : x.grp === 'deck' || x.grp === 'exam' ? `<button type="button" class="btn ghost mp-later" data-mp="later" data-key="${esc(x.key)}" title="Убрать в «Отложено» на неделю">Потом</button>`
        : `<button type="button" class="btn ghost mp-later" data-mp="later" data-key="${esc(x.key)}" title="Не показывать на главной неделю — останется здесь, в «Отложено»">Потом</button>`;
    return `<article class="mp-item${x.done ? ' is-done' : ''}${x.laterUntil ? ' is-later' : ''}" data-mp-item="${esc(x.key)}">
      <button type="button" class="mp-hit" data-mp="${x.done ? 'again' : 'go'}" data-key="${esc(x.key)}" title="${esc(x.done ? `Пройти снова: ${x.title}` : `${x.verb || 'Продолжить'}: ${x.title}`)}">${thumb(x)}
        <span class="mp-main"><span class="mp-kick">${esc(x.kind || '')}${x.sub && x.sub !== x.kind ? ` · ${esc(x.sub)}` : ''}</span>
          <b class="mp-title">${esc(x.title || 'Без названия')}</b>
          ${bar}
          <span class="mp-line">${pctTxt}${line}</span>
          ${meta ? `<span class="mp-meta">${esc(meta)}</span>` : ''}</span></button>
      <span class="mp-acts">${go}${later}<button type="button" class="btn ghost mp-forget" data-mp="forget" data-key="${esc(x.key)}" title="Убрать из списка и забыть место">Забыть</button></span>
    </article>`;
  }
  function groupsHtml(list) {
    return GROUPS.map(([g, ico, name]) => {
      const a = list.filter(x => x.grp === g);
      if (!a.length) return '';
      return `<section class="mp-group" aria-label="${esc(name)}"><h2 class="mp-gh"><span aria-hidden="true">${ico}</span> ${esc(name)} <span class="mp-n">${a.length}</span></h2>
        <div class="mp-list">${a.map(itemHtml).join('')}</div></section>`;
    }).join('');
  }
  function summaryHtml(list) {
    const started = list.length, done = list.filter(x => x.done).length;
    const m = window.Resume && Resume.minutes ? Resume.minutes(7) : { listen: 0, read: 0, other: 0 };
    const L = minWord(m.listen), R = minWord(m.read);
    const tile = (n, u, label, cls = '') => `<div class="mp-tile ${cls}"><b>${esc(n)}${u ? ` <small>${esc(u)}</small>` : ''}</b><span>${esc(label)}</span></div>`;
    return `<div class="mp-sum" role="group" aria-label="Коротко">
      ${tile(started, '', 'начато')}
      ${tile(done, '', 'закончено', 'is-good')}
      ${tile(L.n, L.u, 'слушали и смотрели за неделю')}
      ${tile(R.n, R.u, 'читали за неделю')}
    </div>`;
  }
  function render(root) {
    loadCss();
    root = root || document.getElementById('view');
    if (!root) return;
    const list = collect();
    const later = list.filter(x => x.laterUntil && !x.done);
    const open = list.filter(x => !x.done && !x.laterUntil);
    const fin = list.filter(x => x.done);
    if (!filter) filter = open.length || later.length ? 'open' : 'all';
    const tab = (k, label, n) => `<button type="button" class="mp-tab" data-mp-filter="${k}" aria-pressed="${filter === k}">${esc(label)} <span class="mp-n">${n}</span></button>`;
    let body;
    if (!list.length) {
      body = `<div class="mp-empty"><p class="mp-empty-big" aria-hidden="true">🌱</p><p><b>Пока ничего не начато.</b></p><p class="muted">Включите видео, откройте книгу или позанимайтесь с колодой — всё, что вы начнёте, появится здесь, и сюда всегда можно вернуться.</p>
        <p class="mp-empty-acts"><button type="button" class="btn primary" data-mp-sec="video">🎬 Смотреть видео</button><button type="button" class="btn ghost" data-mp-sec="read">📖 Читать</button><button type="button" class="btn ghost" data-mp-sec="decks">🗂 Колоды</button></p></div>`;
    } else {
      const shown = filter === 'done' ? fin : filter === 'open' ? open : list.filter(x => !x.laterUntil || x.done);
      const empty = filter === 'done' ? 'Законченного пока нет — всё впереди.' : filter === 'open' ? (later.length ? 'Всё незаконченное отложено — оно ниже, в «Отложено».' : 'Всё, что вы начали, закончено. Так держать!') : '';
      body = `<div class="mp-tabs" role="group" aria-label="Что показать">${tab('all', 'Всё', list.length)}${tab('open', 'Незаконченное', open.length + later.length)}${tab('done', 'Закончено', fin.length)}</div>
        ${shown.length ? groupsHtml(shown) : empty ? `<p class="mp-none">${esc(empty)}</p>` : ''}
        ${filter !== 'done' && later.length ? `<section class="mp-group mp-later-group" aria-label="Отложено"><h2 class="mp-gh"><span aria-hidden="true">⏸</span> Отложено <span class="mp-n">${later.length}</span></h2>
          <p class="mp-note">Не показывается на главной до указанного дня — потом вернётся само.</p><div class="mp-list">${later.map(itemHtml).join('')}</div></section>` : ''}`;
    }
    const y = window.scrollY;
    const keepScroll = root.querySelector('[data-mypath]') && App.view && App.view.name === 'progress';
    root.innerHTML = `<div class="mypath" data-mypath>
      <div class="mp-head"><button type="button" class="btn ghost mp-back" data-mp="back" title="Назад" aria-label="Назад">←</button>
        <div class="mp-head-t"><h1>📈 Мой прогресс</h1><p class="mp-lead">Всё, что вы начали: видео, радио, книги, курсы, диалоги и колоды. «Продолжить» откроет ровно там, где вы остановились.</p></div>
        ${window.PrintX ? '<button type="button" class="btn mp-print" data-mp="print" aria-haspopup="dialog" title="Распечатать прогресс и статистику или сохранить в Word">🖨 Печать</button>' : ''}</div>
      ${list.length ? summaryHtml(list) : ''}
      ${body}
    </div>`;
    if (keepScroll) window.scrollTo(0, y);
    root.onclick = onClick;
  }

  /* ---------------- ⏳ «В процессе» on home (the switch «Мои колоды | В процессе», js/views.js) ---------------- */
  const INLINE_MAX = 8;
  /** how many started things are not finished and not put off — the number on the switch */
  function openCount() {
    try { return collect().filter(x => !x.done && !x.laterUntil).length; } catch (e) { return 0; }
  }
  function mountInline(el) {
    if (!el) return;
    loadCss();
    const list = collect();
    const open = list.filter(x => !x.done && !x.laterUntil);
    const later = list.filter(x => x.laterUntil && !x.done).length;
    const more = `<button type="button" class="btn ghost mp-inline-all" data-mp="all">📈 Всё в «Мой прогресс»${later ? ` · отложено ${later}` : ''} →</button>`;
    el.innerHTML = open.length
      ? `<div class="mypath mp-inline"><div class="mp-list">${open.slice(0, INLINE_MAX).map(itemHtml).join('')}</div>
          <p class="mp-inline-foot">${open.length > INLINE_MAX ? `<span class="muted">Ещё ${open.length - INLINE_MAX} — в полном списке.</span> ` : ''}${more}</p></div>`
      : `<div class="mypath mp-inline"><div class="mp-empty mp-inline-empty"><p class="mp-empty-big" aria-hidden="true">🌱</p>
          <p><b>${list.length ? 'Всё начатое закончено или отложено.' : 'Пока ничего не начато.'}</b></p>
          <p class="muted">Включите видео, откройте книгу или позанимайтесь с колодой — всё незаконченное появится здесь, с процентами и кнопкой «Продолжить».</p>
          <p class="mp-empty-acts">${list.length ? more : '<button type="button" class="btn primary" data-mp-sec="video">🎬 Смотреть видео</button><button type="button" class="btn ghost" data-mp-sec="read">📖 Читать</button>'}</p></div></div>`;
    el.onclick = e => {
      const sec = e.target.closest('[data-mp-sec]');
      if (sec) { e.stopPropagation(); if (Views.section) Views.section(sec.dataset.mpSec); return; }
      const b = e.target.closest('[data-mp]');
      if (b && b.dataset.mp === 'all') { e.stopPropagation(); if (App.goAsk) App.goAsk('progress'); else App.go('progress'); return; }
      if (b) { e.stopPropagation(); onClick(e); }
    };
  }

  /* ---------------- actions ---------------- */
  function goTo(x, how) {
    if (!x) return;
    if (window.Listen && Listen.prime) { try { Listen.prime(); } catch (e) { /* ignore */ } } // inside the tap (iPhone / Safari)
    setTimeout(() => {
      try { if (how === 'again' && x.restart) x.restart(); else x.go(); } catch (e) { console.warn('mypath', e); UI.toast('Не получилось открыть — попробуйте ещё раз', 'warn'); }
    }, 30);
  }
  function redraw() {
    if (window.App && App.view && App.view.name === 'progress') render(document.getElementById('view'));
    const host = document.querySelector('#view [data-mp-inline]');
    if (host) { mountInline(host); const n = document.querySelector('#view .hl-tab[data-list="progress"] .chip'); if (n) n.textContent = openCount(); }
  }
  function gone(key, then) {
    const el = document.querySelector(`[data-mp-item="${window.CSS && CSS.escape ? CSS.escape(key) : String(key).replace(/["\\]/g, '\\$&')}"]`);
    if (el && !reduce()) { el.classList.add('gone'); setTimeout(then, 220); } else then();
  }
  async function onClick(e) {
    const f = e.target.closest('[data-mp-filter]');
    if (f) { filter = f.dataset.mpFilter; render(); return; }
    const s = e.target.closest('[data-mp-sec]');
    if (s) { if (Views.section) Views.section(s.dataset.mpSec); return; }
    const b = e.target.closest('[data-mp]'); if (!b) return;
    const act = b.dataset.mp, key = b.dataset.key, x = key ? map.get(key) : null;
    if (act === 'back') { if (App.back) App.back(); else App.go('home'); return; }
    if (act === 'print') { if (window.PrintX) PrintX.progress(); return; }
    if (!x) { redraw(); return; }
    if (act === 'go' || act === 'again') { goTo(x, act); return; }
    if (act === 'later') {
      if (window.Continue && Continue.snooze) Continue.snooze(key, 7); else return;
      const until = Date.now() + 7 * DAY;
      gone(key, redraw);
      UI.toastAction ? UI.toastAction(`Отложено до ${dayMonth(until)} — на главной не появится`, 'Отменить', () => { Continue.unsnooze(key); setTimeout(redraw, 20); }, 7000, '⏸') : UI.toast('Отложено на неделю');
      return;
    }
    if (act === 'now') { if (window.Continue && Continue.unsnooze) Continue.unsnooze(key); if (Continue.unhide) Continue.unhide(key); setTimeout(redraw, 20); UI.toast('Снова на главной', '', 2500); return; }
    if (act === 'forget') {
      const what = x.grp === 'deck'
        ? 'Колода и все её карточки останутся, прогресс тоже — она просто пропадёт из этого списка до следующего занятия.'
        : x.grp === 'exam' ? 'Подготовка останется как есть — она просто пропадёт из этого списка, пока вы снова её не откроете.'
          : 'Место, где вы остановились, сотрётся, и в следующий раз всё начнётся сначала. Само видео, книга или курс никуда не денутся.';
      const ok = await UI.confirm(`<b>«${esc(x.title)}»</b><br>${esc(what)}`, { title: 'Забыть?', ok: 'Забыть', cancel: 'Оставить', danger: true });
      if (!ok) return;
      const undo = window.Continue && Continue.forget ? Continue.forget(x) : () => {};
      gone(key, redraw);
      UI.toastAction ? UI.toastAction(`Забыто: «${String(x.title).slice(0, 60)}»`, 'Отменить', () => { undo(); setTimeout(redraw, 30); }, 8000, '🗑') : UI.toast('Забыто');
    }
  }

  /* ---------------- the screen, the plaque in «Статистика», live updates ---------------- */
  Views.progress = function (root) { render(root); };
  const origStats = Views.stats;
  if (typeof origStats === 'function' && !origStats._mypath) {
    Views.stats = function (root) {
      const r = origStats.apply(this, arguments);
      try {
        loadCss();
        const list = collect();
        const open = list.filter(x => !x.done).length, done = list.length - open;
        const h1 = root && root.querySelector('h1');
        if (h1 && !root.querySelector('[data-mp-plaque]')) {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'mp-plaque'; b.dataset.mpPlaque = '1';
          b.innerHTML = `<span class="mp-plaque-i" aria-hidden="true">📈</span><span class="mp-plaque-t"><b>Мой прогресс</b><span>${list.length ? `не закончено ${open} · закончено ${done}` : 'всё, что вы начнёте, будет здесь'}</span></span><span class="mp-plaque-go" aria-hidden="true">→</span>`;
          b.title = 'Всё, что вы начали: видео, книги, курсы, колоды';
          b.addEventListener('click', ev => { ev.stopPropagation(); App.goAsk ? App.goAsk('progress') : App.go('progress'); });
          h1.insertAdjacentElement('afterend', b);
        }
      } catch (e) { console.warn('mypath plaque', e); }
      return r;
    };
    Views.stats._mypath = true;
  }
  let t = 0;
  const soon = () => { clearTimeout(t); t = setTimeout(() => { if (!(window.App && App.view && (App.view.name === 'progress' || (App.view.name === 'home' && document.querySelector('#view [data-mp-inline]'))))) return; if (document.querySelector('#modal-root .modal-backdrop:not(.closing)')) soon(); else redraw(); }, 900); };
  ['resume-changed', 'resume-cleared', 'reader-shelf', 'listen-state', 'audiocourse-state'].forEach(n => document.addEventListener(n, soon));
  window.addEventListener('pageshow', soon);
  // the CSS is small; fetched when the browser is idle so the first open does not flash
  const idle = window.requestIdleCallback || (f => setTimeout(f, 2500));
  idle(loadCss, { timeout: 5000 });

  window.MyPath = { render, collect, mountInline, openCount, open: () => (App.goAsk ? App.goAsk('progress') : App.go('progress')) };
})();
