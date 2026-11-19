/* ============ 📚 «Библиотека — читать и слушать»: one place for every book and every audio, like Apple Books ============
 * Tabs:
 *  - «Читаю сейчас»  the book opened last (big cover, «▶ Продолжить» → the saved place, «🎧 Слушать»), a few recent ones,
 *                    the audio course in progress
 *  - «Мои книги»     the reader's own shelf as a cover grid (js/reader.js does the work: import, open, delete — no copies here)
 *  - «Мои учебники»  private/reader/index.json (this Mac only — MyCourse.available()); read at every visit, so new entries show up
 *  - «Слушать»       «аудиокнига» (a reader book in the listening mode: big buttons, speed, 🌙 sleep timer) + audio courses
 *  - «Найти книгу»   the free catalogue (js/books.js) and «📘 Мой учебник» (js/textbook.js) as «Загрузить учебник с переводом»
 * window.Bookshelf = { open(tab?), TABS }; anywhere: <button data-bookshelf-open="listen"> opens it (on that tab).
 * The old windows stay as they were and are opened from here (Reader.open, Books.open, AudioCourse.open, Textbook.open).
 */
(function () {
  const esc = s => (window.U && U.esc ? U.esc(s == null ? '' : String(s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
  const plural = (n, f) => (window.U && U.plural ? U.plural(n, f) : f[2]);
  const toast = (m, t, ms) => { try { UI.toast(m, t, ms); } catch (e) { /* no UI */ } };
  const mineOk = () => { try { return !!(window.Reader && Reader.mineAvailable && Reader.mineAvailable()); } catch (e) { return false; } };
  const mss = t => { t = Math.max(0, Math.floor(+t || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

  const TABS = [
    ['now', '📖', 'Читаю сейчас'],
    ['mine', '📚', 'Мои книги'],
    ['tb', '📘', 'Мои учебники'],
    ['listen', '🎧', 'Слушать'],
    ['find', '🔎', 'Найти книгу'],
  ];
  const tabsHere = () => TABS.filter(t => t[0] !== 'tb' || mineOk());

  let M = null, tab = 'now', drawT = 0, drawN = 0;

  /* ---------------- the window ---------------- */
  function open(t) {
    if (M && document.body.contains(M.el)) { go(t || tab); return M; }
    tab = tabsHere().some(x => x[0] === t) ? t : 'now';
    M = UI.modal({
      title: '📚 Библиотека', cls: 'wide bs-modal',
      body: `<nav class="bs-tabs" role="tablist" aria-label="Разделы библиотеки">${tabsHere().map(([id, ico, label]) =>
        `<button type="button" class="bs-tab" role="tab" id="bs-tab-${id}" data-bs-tab="${id}" aria-controls="bs-pane" aria-selected="${id === tab}" title="${esc(label)}"><span aria-hidden="true">${ico}</span><span class="bs-tab-l">${esc(label)}</span></button>`).join('')}</nav>
        <div class="bs-pane" id="bs-pane" role="tabpanel" data-bs-pane tabindex="-1"></div>
        <input type="file" multiple hidden data-bs-file accept="${esc((window.Reader && Reader.ACCEPT) || '')}">`,
      onClose: () => { M = null; document.removeEventListener('reader-shelf', onShelf); clearTimeout(drawT); },
    });
    const el = M.el;
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKey);
    el.addEventListener('change', e => {
      if (!e.target.matches('[data-bs-file]')) return;
      const fs = [...e.target.files]; e.target.value = '';
      if (fs.length) addFiles(fs);
    });
    // a book dropped anywhere on the library → onto the shelf
    el.addEventListener('dragover', e => { if ([...((e.dataTransfer && e.dataTransfer.types) || [])].includes('Files')) { e.preventDefault(); el.classList.add('bs-drag'); } });
    el.addEventListener('dragleave', e => { if (e.target === el || !el.contains(e.relatedTarget)) el.classList.remove('bs-drag'); });
    el.addEventListener('drop', e => { if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); e.stopPropagation(); el.classList.remove('bs-drag'); addFiles([...e.dataTransfer.files]); });
    document.addEventListener('reader-shelf', onShelf);
    draw();
    return M;
  }
  function go(t) {
    if (!tabsHere().some(x => x[0] === t)) t = 'now';
    tab = t;
    if (!M) return;
    M.$$('[data-bs-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.bsTab === t)));
    draw();
  }
  /** the shelf changed (a book added, deleted, read): the open tab follows — quietly, a moment later */
  function onShelf() {
    if (!M || tab === 'find') return;
    clearTimeout(drawT);
    drawT = setTimeout(() => { if (M) draw(true); }, 150);
  }
  async function draw(quiet) {
    if (!M) return;
    const pane = M.$('[data-bs-pane]');
    if (!pane) return;
    const n = ++drawN;
    pane.setAttribute('aria-labelledby', `bs-tab-${tab}`);
    if (!quiet) pane.innerHTML = '<div class="rd-wait"><span class="spinner sm"></span> открываю…</div>';
    let html = '';
    try { html = await ({ now: paneNow, mine: paneMine, tb: paneTb, listen: paneListen, find: paneFind }[tab] || paneNow)(); }
    catch (e) { console.warn('bookshelf', e); html = '<div class="rd-note">Эту часть библиотеки сейчас не получилось показать. Закройте окно и откройте его снова.</div>'; }
    if (!M || n !== drawN) return; // a newer drawing is on its way
    const keep = pane.scrollTop;
    pane.innerHTML = html;
    if (quiet) pane.scrollTop = keep;
    if (tab === 'tb') { const box = pane.querySelector('[data-bs-mine]'); if (box && window.Reader) Reader.drawMine(box); }
  }

  /* ---------------- the data ---------------- */
  async function books() { try { return window.Reader && Reader.list ? await Reader.list() : []; } catch (e) { return []; } }
  const recentOf = id => { try { return (Reader.recent() || []).find(x => x.id === id) || null; } catch (e) { return null; } };
  function where(b) {
    const r = recentOf(b.id);
    const pages = (r && r.pages) || b.pages || 1;
    const page = r && r.page ? r.page : Math.max(1, Math.round((b.pct || 0) * pages));
    return { page, pages, pct: Math.round((b.pct || 0) * 100) };
  }
  const cover = b => (window.Reader && Reader.coverHtml ? Reader.coverHtml(b) : '');
  const agoTxt = ts => (window.Reader && Reader.ago ? Reader.ago(ts) : '');

  /* ---------------- 📖 Читаю сейчас ---------------- */
  async function paneNow() {
    const all = await books();
    const opened = all.filter(b => b.opened).sort((a, b) => b.opened - a.opened);
    const ac = window.AudioCourse && AudioCourse.inProgress ? AudioCourse.inProgress() : null;
    if (!opened.length) {
      return `<div class="bs-empty"><span class="bs-empty-ico" aria-hidden="true">📖</span>
          <b>Здесь будет книга, которую вы читаете</b>
          <span>Добавьте свою книгу (PDF, EPUB, TXT, Word) или попробуйте короткую сказку с переводом. Читалка запомнит страницу — и отсюда можно будет продолжить одним нажатием.</span>
          <div class="bs-btns">
            <button type="button" class="btn primary" data-bs="add" title="Выбрать файл книги на этом устройстве">📥 Добавить свою книгу</button>
            <button type="button" class="btn" data-rd="sample" title="Короткая норвежская сказка с русским переводом в скобках">✨ Сказка-пример</button>
            ${mineOk() ? '<button type="button" class="btn" data-bs-tab="tb" title="Тексты глав ваших учебников">📘 Мои учебники</button>' : ''}
            <button type="button" class="btn ghost" data-bs-tab="find" title="Бесплатные книги и загрузка учебника">🔎 Найти книгу</button>
          </div></div>${ac ? acCard(ac) : ''}`;
    }
    const b = opened[0], w = where(b);
    const rest = opened.slice(1, 6);
    return `<section class="bs-hero" aria-label="Читаю сейчас">
        <button type="button" class="rd-cover bs-hero-cover" data-bs="cont" data-id="${esc(b.id)}" title="Продолжить «${esc(b.title)}» со стр. ${w.page}" aria-label="Продолжить «${esc(b.title)}» со страницы ${w.page}">${cover(b)}${w.pct ? `<span class="rd-cover-pct" aria-hidden="true">${w.pct}%</span>` : ''}</button>
        <div class="bs-hero-info">
          <span class="bs-kicker">Читаю сейчас</span>
          <h3 class="bs-hero-t">${esc(b.title)}</h3>
          ${b.author ? `<span class="bs-hero-a">${esc(b.author)}</span>` : ''}
          <div class="rd-bar" role="progressbar" aria-label="Прочитано" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${w.pct}"><i style="width:${w.pct}%"></i></div>
          <span class="bs-hero-m">стр. ${w.page} из ${w.pages} · прочитано ${w.pct}% · ${esc(agoTxt(b.opened))}</span>
          <div class="bs-btns">
            <button type="button" class="btn primary bs-big" data-bs="cont" data-id="${esc(b.id)}" title="Открыть книгу на странице, где вы остановились">▶ Продолжить · стр. ${w.page}</button>
            <button type="button" class="btn bs-big" data-bs="listen-book" data-id="${esc(b.id)}" title="Слушать с этого места: крупные кнопки, скорость и таймер сна">🎧 Слушать</button>
          </div>
        </div>
      </section>
      ${ac ? acCard(ac) : ''}
      ${rest.length ? `<div class="bs-h"><h3>Недавно открывали</h3><button type="button" class="btn sm ghost" data-bs-tab="mine" title="Все книги на этом устройстве">Все книги ›</button></div>
        <div class="bs-row">${rest.map(x => { const q = where(x); return `<button type="button" class="bs-mini" data-bs="cont" data-id="${esc(x.id)}" title="Продолжить «${esc(x.title)}» со стр. ${q.page}">
          <span class="rd-cover bs-mini-cover" aria-hidden="true">${cover(x)}</span><span class="bs-mini-t">${esc(x.title)}</span><span class="bs-mini-m">стр. ${q.page} из ${q.pages}</span></button>`; }).join('')}</div>`
        : `<div class="bs-h"><span class="bs-tiny">Все ваши книги — в «Мои книги».</span><button type="button" class="btn sm ghost" data-bs-tab="mine" title="Все книги на этом устройстве">Мои книги ›</button></div>`}`;
  }
  function acCard(ac) {
    return `<section class="bs-ac" aria-label="Аудиокурс">
      <span class="bs-ac-ico" aria-hidden="true">🎧</span>
      <div class="bs-ac-info"><b>${esc(ac.title)}</b><span>урок ${ac.n} из ${ac.of}${ac.sec ? ` · ${mss(ac.sec)}` : ''} — ${esc(ac.lesson)}</span></div>
      <button type="button" class="btn primary" data-bs="ac-play" data-cid="${esc(ac.cid)}" title="Слушать с места, где остановились">▶ Продолжить</button>
    </section>`;
  }

  /* ---------------- 📚 Мои книги ---------------- */
  async function paneMine() {
    const all = await books();
    return `<div class="bs-h"><p class="bs-tiny">Ваши книги — только на этом устройстве. Нажмите на обложку — книга откроется там, где вы остановились.</p></div>
      <button type="button" class="rd-drop bs-drop" data-bs="add" title="Выбрать файл книги или перетащить его сюда">
        <span class="rd-drop-ico" aria-hidden="true">📥</span><b>Добавить книгу</b>
        <span class="rd-drop-sub">Выберите файл или перетащите его сюда · PDF · EPUB · TXT · DOCX · FB2 · HTML</span></button>
      ${all.length ? `<div class="rd-grid">${all.map(b => Reader.bookCardHtml(b)).join('')}</div>`
        : '<div class="rd-empty"><span aria-hidden="true">📚</span><b>Полка пока пустая</b><span>Добавьте свою книгу — или попробуйте на примере короткой сказки.</span></div>'}
      <div class="rd-shelf-foot">
        <button type="button" class="btn ghost rd-sample" data-rd="sample" title="Короткая норвежская сказка с русским переводом в скобках">✨ Добавить пример: сказка «Лисёнок и луна»</button>
        <span class="rd-tiny">Сканы без текста (картинки страниц) лучше загружать во «🔎 Найти книгу» → «Загрузить учебник с переводом» — там текст распознаётся.</span>
      </div>`;
  }

  /* ---------------- 📘 Мои учебники (this Mac only) ---------------- */
  async function paneTb() {
    if (!mineOk()) return '<div class="rd-note">Ваши учебники доступны только на вашем Mac.</div>';
    return '<section class="rd-mine bs-mine" data-bs-mine aria-label="Мои учебники"><div class="rd-wait"><span class="spinner sm"></span> ищу ваши учебники…</div></section>';
  }

  /* ---------------- 🎧 Слушать ---------------- */
  async function paneListen() {
    const all = await books();
    const L = window.AudioCourse && AudioCourse.list ? AudioCourse.list() : [];
    const ac = window.AudioCourse && AudioCourse.inProgress ? AudioCourse.inProgress() : null;
    const bookRows = all.slice(0, 12).map(b => { const w = where(b); return `<li class="bs-li">
        <span class="rd-cover bs-li-cover" aria-hidden="true">${cover(b)}</span>
        <span class="bs-li-t"><b>${esc(b.title)}</b><small>${b.opened ? `стр. ${w.page} из ${w.pages} · ${w.pct}%` : `${w.pages} ${plural(w.pages, ['страница', 'страницы', 'страниц'])} · ещё не открывали`}</small></span>
        <button type="button" class="btn primary bs-li-btn" data-bs="listen-book" data-id="${esc(b.id)}" title="Слушать «${esc(b.title)}»: крупные кнопки, скорость и таймер сна">🎧 Слушать</button></li>`; }).join('');
    const courseRows = L.map(c => {
      const n = AudioCourse.storedCount ? AudioCourse.storedCount(c.id) : 0;
      const st = AudioCourse.statusLabel ? AudioCourse.statusLabel(c.id) : '';
      return `<li class="bs-li">
        <span class="bs-li-ico" aria-hidden="true">${esc(c.flag || '🎧')}</span>
        <span class="bs-li-t"><b>${esc(c.title || c.short)}</b><small>${st ? esc(st) : 'ещё не загружен в приложение'}${ac && ac.cid === c.id ? ` · остановились на уроке ${ac.n}` : ''}</small></span>
        ${n ? `<button type="button" class="btn primary bs-li-btn" data-bs="ac-play" data-cid="${esc(c.id)}" title="Слушать с места, где остановились">▶ Слушать</button>` : ''}
        <button type="button" class="btn bs-li-btn" data-bs="ac-open" data-cid="${esc(c.id)}" title="${n ? 'Список уроков, повтор, A–B, где слушать' : 'Загрузить уроки внутрь приложения или добавить уже скачанные'}">${n ? 'Уроки' : '⬇ Загрузить'}</button></li>`;
    }).join('');
    return `<section class="bs-sec">
        <div class="bs-h"><h3>📖 Аудиокнига — ваши книги вслух</h3></div>
        <p class="bs-tiny">Норвежский текст читает норвежский голос, перевод — русский. Крупные кнопки, скорость и <b>🌙 таймер сна</b>: 10–60 минут или до конца главы — чтение затихнет само, место сохранится.</p>
        ${bookRows ? `<ul class="bs-list">${bookRows}</ul>` : `<div class="bs-empty sm"><span>На полке пока нет книг.</span><div class="bs-btns"><button type="button" class="btn primary" data-bs="add" title="Выбрать файл книги">📥 Добавить книгу</button><button type="button" class="btn" data-rd="sample" title="Короткая сказка с переводом">✨ Сказка-пример</button></div></div>`}
        ${all.length > 12 ? '<button type="button" class="btn sm ghost" data-bs-tab="mine" title="Все книги">Все книги ›</button>' : ''}
      </section>
      ${L.length ? `<section class="bs-sec"><div class="bs-h"><h3>🎧 Аудиокурсы</h3><button type="button" class="btn sm ghost" data-bs="ac-all" title="Все аудиокурсы, загрузка и настройки">Все курсы ›</button></div>
        <p class="bs-tiny">50languages: 100 уроков с озвучкой. Курс хранится в приложении и играет без интернета — в наушниках, через динамик или на колонке.</p>
        <ul class="bs-list">${courseRows}</ul></section>` : ''}
      ${window.ListenUI && ListenUI.chooser ? `<section class="bs-sec"><button type="button" class="btn ghost bs-wide" data-bs="listen-more" title="Слушать колоды, новости, радио и подкасты">🎧 Ещё послушать: колоды, новости, радио</button></section>` : ''}`;
  }

  /* ---------------- 🔎 Найти книгу ---------------- */
  async function paneFind() {
    const card = (act, ico, title, text, btn, hint) => `<article class="bs-card">
        <span class="bs-card-ico" aria-hidden="true">${ico}</span>
        <div class="bs-card-info"><b>${title}</b><span>${text}</span></div>
        <button type="button" class="btn primary" data-bs="${act}" title="${esc(hint)}">${btn}</button></article>`;
    return `<div class="bs-cards">
      ${window.Books ? card('books', '📚', 'Бесплатные книги', 'Книжки с картинками RU–NO и UK–NO, учебники NTNU, разговорники, сказки и романы на норвежском — всё бесплатно и легально. Можно читать здесь, слушать вслух и делать карточки.', 'Открыть каталог', 'Каталог бесплатных книг') : ''}
      ${window.Textbook ? card('textbook', '📘', 'Загрузить учебник с переводом', 'Свой учебник: PDF, EPUB, Word, фото и сканы страниц. Перевод абзацев, предложений и слов, озвучка, новые слова — в карточки, проверка себя.', 'Загрузить учебник', 'Мой учебник — читать с переводом и карточками') : ''}
      ${window.Reader ? card('add', '📥', 'Добавить свою книгу в читалку', 'Норвежская или двуязычная книга, сказки с переводом в скобках: читайте страницами и слушайте двумя голосами.', 'Выбрать файл', 'Выбрать файл книги на этом устройстве') : ''}
    </div>`;
  }

  /* ---------------- actions ---------------- */
  function addFiles(files) {
    if (!window.Reader) return;
    Reader.importFiles(files, {}, { noShelf: true }).then(id => { if (id && files.length > 1 && M && tab !== 'mine') go('mine'); }).catch(() => toast('Книгу не получилось добавить — попробуйте другой файл', 'warn'));
  }
  function onKey(e) {
    const t = e.target.closest && e.target.closest('[data-bs-tab].bs-tab');
    if (!t || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    const all = M.$$('.bs-tab'); let i = all.indexOf(t);
    i = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length;
    e.preventDefault(); all[i].focus(); go(all[i].dataset.bsTab);
  }
  function onClick(e) {
    const tb = e.target.closest('[data-bs-tab]');
    if (tb) { go(tb.dataset.bsTab); return; }
    const rd = e.target.closest('[data-rd]');
    if (rd && window.Reader) { Reader.shelfClick(e); return; }
    const b = e.target.closest('[data-bs]');
    if (!b) return;
    const id = b.dataset.id, cid = b.dataset.cid;
    switch (b.dataset.bs) {
      case 'cont': if (window.Reader) Reader.openBook(id, { cont: true }); break;
      case 'listen-book': if (window.Reader) Reader.openBook(id, { cont: true, listen: true }); break;
      case 'add': { const f = M && M.$('[data-bs-file]'); if (f) f.click(); break; }
      case 'ac-play': if (window.AudioCourse) AudioCourse.play(cid); break;
      case 'ac-open': if (window.AudioCourse) AudioCourse.openCourse(cid); break;
      case 'ac-all': if (window.AudioCourse) AudioCourse.open(); break;
      case 'listen-more': if (window.ListenUI) ListenUI.chooser(); break;
      case 'books': if (window.Books) Books.open(); break;
      case 'textbook': if (window.Textbook) Textbook.open(); break;
    }
  }

  /* ---------------- ❓ help ---------------- */
  function registerHelp() {
    if (!window.Help || !Array.isArray(Help.TOPICS) || Help.TOPICS.some(t => t.id === 'library')) return;
    const topic = { id: 'library', icon: '📚', hue: 32, title: 'Библиотека — читать и слушать',
      desc: 'Все книги и аудио в одном месте: продолжить с той же страницы, свои книги, учебники, аудиокурсы, бесплатные книги.',
      keys: 'библиотека книги книга читать слушать читалка продолжить аудиокнига аудиокурс учебник таймер сна полка обложка',
      steps: [['📚', 'На главной нажмите <b>«Библиотека — читать и слушать»</b>.'],
        ['▶', '<b>«Читаю сейчас»</b> — последняя книга: <b>«▶ Продолжить»</b> откроет её на той же странице. Ещё быстрее — полоска <b>«📖 Продолжить чтение»</b> вверху главной.'],
        ['📥', '<b>«Мои книги»</b> — ваши PDF, EPUB, TXT, Word: добавить, открыть, удалить.'],
        ['🎧', '<b>«Слушать»</b> — книга вслух крупными кнопками и <b>🌙 таймер сна</b> (10–60 минут или до конца главы), а ещё аудиокурсы 50languages.'],
        ['🔎', '<b>«Найти книгу»</b> — бесплатные книги и <b>«Загрузить учебник с переводом»</b>.']],
      expect: 'Не нужно искать, где была книга: одна кнопка — и вы там, где остановились.',
      limits: 'Книги хранятся только на этом устройстве. Таймер сна останавливает чтение после фразы — место сохраняется. «Мои учебники» видны только на вашем Mac.',
      open: ['📚 Открыть библиотеку', () => open()] };
    const at = Help.TOPICS.findIndex(t => t.id === 'reader');
    if (at >= 0) Help.TOPICS.splice(at, 0, topic); else Help.TOPICS.push(topic);
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('[data-bookshelf-open]'); if (!b) return;
      e.preventDefault();
      open(b.dataset.bookshelfOpen || undefined);
    });
    // after prove.js / audiocourse.js have registered theirs (so «Библиотека» stands right before «Читалка»)
    const boot = () => setTimeout(() => { try { registerHelp(); } catch (e) { /* help is optional */ } }, 0);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }

  window.Bookshelf = { TABS, open, go: t => go(t), isOpen: () => !!(M && document.body.contains(M.el)) };
})();
