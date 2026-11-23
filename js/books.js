/* ============ 📚 Books: free & legal books for learning Norwegian (Russian / Ukrainian / English / Norwegian) ============
 * Only what authors / publishers / the Norwegian state give away for free (checked 2026-11). Nothing is re-hosted:
 * every book opens from its official address. Reading inside the app:
 *  - most PDFs can be shown in a frame directly;
 *  - Wikimedia PDFs are fetched (CORS) and shown from memory;
 *  - the rest open in a new tab, or come through the Mac bridge.
 * "🃏 Слова в карточки" sends the PDF to the card importer (pairs "norsk – русский" become cards).
 * A PDF the app can read (CORS or the Mac bridge) is drawn by the app itself (js/bookview.js, loaded on first use):
 * the word being read aloud lights up on the page, «Aa» and «🔊 Голос» sit right in the player row; otherwise the
 * browser's own PDF viewer shows it as before.
 */
(function () {
  // [title, langs, level, kind, url, licence, how: 'frame' | 'blob' | 'tab', note]
  const BFN = 'https://bfn.berattelser.se';
  const SHELF = [
    ['🇷🇺 Русский ⇄ норвежский', [
      ['Barnebøker for Norge — 27 двуязычных книжек RU–NB', '🇷🇺🇳🇴', 'A1–A2', 'книжки с картинками', `${BFN}/utgave/bilingual/ru-nb/0001_h%C3%B8y-bilingual_ru-nb.pdf`, 'CC BY / BY-NC', 'frame', 'Global Storybooks: параллельный текст. Все 27 книг — на сайте barneboker.no (истории → русский).', 'https://barneboker.no'],
      ['«Apen og krokodillen» — русский и норвежский', '🇷🇺🇳🇴', 'A1', 'сказка', 'https://morsmal.no/wp-content/uploads/2021/04/apen_og_krokodillen_bok_russisk.pdf', 'CC BY-NC-SA 4.0', 'frame', 'Tema morsmål (NAFO, OsloMet). На сайте есть и аудио.', 'https://morsmal.no/ru/'],
      ['Норвежский разговорник (Викигид)', '🇷🇺🇳🇴', 'A1', 'разговорник', 'https://ru.wikivoyage.org/api/rest_v1/page/pdf/%D0%9D%D0%BE%D1%80%D0%B2%D0%B5%D0%B6%D1%81%D0%BA%D0%B8%D0%B9_%D1%80%D0%B0%D0%B7%D0%B3%D0%BE%D0%B2%D0%BE%D1%80%D0%BD%D0%B8%D0%BA', 'CC BY-SA', 'blob', 'Фразы для поездок и быта с произношением.'],
      ['Норвежские звуки в сравнении с русскими (NTNU)', '🇷🇺🇳🇴', 'A1', 'произношение', 'https://www.hf.ntnu.no/now/hardcopies/languages/Russian%20Norwegian.pdf', '© NTNU, бесплатно', 'frame', 'Какие звуки русскому уху трудны и как их ставить (4 стр.).'],
      ['50languages — 100 уроков RU–NO (MP3)', '🇷🇺🇳🇴', 'A1–A2', 'аудиокурс', 'https://www.book2.nl/book2/RU/RUNO/RUNO-all.zip', '© Goethe Verlag, бесплатно для себя', 'tab', 'Архив 73 МБ: 100 уроков разговорных фраз с озвучкой. Фразы можно сразу взять в карточки: Библиотека выражений → 50languages.'],
      ['UDI: термины «коллективная защита» NO–UK–RU', '🇳🇴🇺🇦🇷🇺', 'B1+', 'словарик', 'https://www.udi.no/globalassets/global/asylsprak/begreper-relatert-til-kollektiv-beskyttelse-ukr-rus.pdf', 'гос. издание', 'frame', 'Официальные слова UDI для документов и переводчиков.'],
      ['UDI: терминология «война в Украине» UK–RU–NB', '🇺🇦🇷🇺🇳🇴', 'B1+', 'словарик', 'https://www.udi.no/globalassets/om-udi/alfabetisk--terminologi-relatert-til-krigen-i-ukraina.pdf', 'гос. издание', 'frame', ''],
    ]],
    ['🇺🇦 Українська ⇄ норвезька', [
      ['Barnebøker for Norge — 40 двомовних книжок UK–NB', '🇺🇦🇳🇴', 'A1–A2', 'книжки з картинками', `${BFN}/utgave/bilingual/uk-nb/0001_h%C3%B8y-bilingual_uk-nb.pdf`, 'CC BY / BY-NC', 'frame', 'Паралельний текст; на сайті є українське аудіо. Усі 40 книжок — barneboker.no.', 'https://barneboker.no'],
      ['«Apen og krokodillen» — українською і норвезькою', '🇺🇦🇳🇴', 'A1', 'казка', 'https://morsmal.no/wp-content/uploads/2022/10/apen-og-krokodillen-bok-ukrainsk-og-norsk-1.pdf', 'CC BY-NC-SA 4.0', 'frame', 'Tema morsmål (NAFO).', 'https://morsmal.no/uk/'],
      ['50languages — 100 уроків UK–NO (MP3)', '🇺🇦🇳🇴', 'A1–A2', 'аудіокурс', 'https://www.linguafree.com/book2/UK/UKNO/UKNO-all.zip', '© Goethe Verlag, безкоштовно', 'tab', 'Архів з озвученими розмовними фразами.'],
      ['Norsk Folkehjelp: «Про Норвегію» (UK)', '🇺🇦', 'A2–B1', 'брошура', 'https://folkehjelp.no/media/files/NFH_OM-NORGE_UKRAINSK.pdf', 'безкоштовно', 'frame', 'Читайте разом з норвезькою версією нижче — паралельний текст.'],
      ['Norsk Folkehjelp: «Om Norge» (норвезькою)', '🇳🇴', 'A2–B1', 'брошура', 'https://folkehjelp.no/media/files/NFH_OM-NORGE_NORSK.pdf', 'безкоштовно', 'frame', ''],
      ['UDI: назви установ NO–UK', '🇳🇴🇺🇦', 'B1', 'словник', 'https://www.udi.no/globalassets/global/asylsprak/udis-terminologiliste-for-ukrainske-tolker---navn-pa-institusjoner-.pdf', 'держ. видання', 'frame', ''],
    ]],
    ['🇬🇧 Учебники (английский ⇄ норвежский)', [
      ['LearnNoW — учебник (NTNU)', '🇬🇧🇳🇴', 'A1–A2', 'учебник', 'https://www.hf.ntnu.no/now/learnnow/misc/LearnNoWTextbook.pdf', '© NTNU, бесплатно', 'frame', '139 страниц, курс для начинающих (есть украинская версия сайта learnnow-ua).'],
      ['LearnNoW — грамматика', '🇬🇧🇳🇴', 'A1–A2', 'грамматика', 'https://www.hf.ntnu.no/now/learnnow/misc/LearnNoWGrammar.pdf', '© NTNU, бесплатно', 'frame', ''],
      ['LearnNoW — словарь глав', '🇬🇧🇳🇴', 'A1–A2', 'словарь', 'https://www.hf.ntnu.no/now/learnnow/misc/LearnNoWVocabulary.pdf', '© NTNU, бесплатно', 'frame', 'Хорошо переводится в карточки кнопкой «🃏 Слова в карточки».'],
      ['Norwegian on the Web — весь курс', '🇬🇧🇳🇴', 'A1–A2', 'учебник', 'https://www.hf.ntnu.no/now/hardcopies/course_material.pdf', '© NTNU, бесплатно', 'frame', ''],
      ['Norwegian on the Web — краткая грамматика', '🇬🇧🇳🇴', 'A1–B1', 'грамматика', 'https://www.hf.ntnu.no/now/hardcopies/ShortGrammar.pdf', '© NTNU, бесплатно', 'frame', ''],
      ['Norwegian on the Web — устные упражнения', '🇬🇧🇳🇴', 'A1–A2', 'упражнения', 'https://www.hf.ntnu.no/now/hardcopies/OralExercises.pdf', '© NTNU, бесплатно', 'frame', ''],
      ['Lingu — «99 idioms» (идиомы)', '🇬🇧🇳🇴', 'B1–B2', 'идиомы', 'https://www.dropbox.com/s/v997q1c710h9m8p/99-norwegian-idioms.pdf?dl=1', '© Lingu, бесплатная книга', 'blob', '99 частых идиом и пословиц с объяснением.'],
      ['Norwegian phrasebook (Wikivoyage)', '🇬🇧🇳🇴', 'A1', 'разговорник', 'https://en.wikivoyage.org/api/rest_v1/page/pdf/Norwegian_phrasebook', 'CC BY-SA', 'blob', ''],
      ['Wikibooks: Norwegian', '🇬🇧🇳🇴', 'A1', 'учебник', 'https://en.wikibooks.org/api/rest_v1/page/pdf/Norwegian', 'CC BY-SA', 'blob', ''],
    ]],
    ['🇳🇴 На норвежском: чтение, экзамен', [
      ['Barnebøker for Norge — 40 книжек на bokmål (+ MP3)', '🇳🇴', 'A1–A2', 'чтение', `${BFN}/pdf/nb/nb-0001_h%C3%B8y.pdf`, 'CC BY / BY-NC', 'frame', 'Лёгкое чтение с аудио. Все книги: barneboker.no.', 'https://barneboker.no'],
      ['Norskprøven: образцы письменных ответов A1–B2 (HK-dir)', '🇳🇴', 'A1–B2', 'экзамен', 'https://cdn.sanity.io/files/dc7vqrwe/pk-production/626bfe0f98a4d4d0ab4b2308d68828b6e624634a.pdf', 'официально, бесплатно', 'frame', 'Как выглядят ответы на каждом уровне.'],
      ['Samfunnskunnskap — все тексты курса (bokmål)', '🇳🇴', 'A2–B1', 'обществознание', 'https://samfunnskunnskap.no/bin/Samfunnskunnskap-l%C3%A6rer-pdf-BM.pdf', '© Cappelen Damm / HK-dir, читать бесплатно', 'frame', 'Курс есть и на русском, и на украинском: samfunnskunnskap.no.', 'https://samfunnskunnskap.no'],
      ['Språkbanken: «Norske idiom» — 3 500 идиом', '🇳🇴', 'B1–C1', 'идиомы', 'https://www.nb.no/sbfil/norske_idiom/norske_idiom.pdf', 'CC0', 'tab', 'Список идиом Национальной библиотеки (карточки из него — Библиотека выражений).'],
      ['Asbjørnsen og Moe — Norske folkeeventyr', '🇳🇴', 'C1', 'сказки', 'https://www.bokselskap.no/wp-content/themes/bokselskap2/tekster/pdf/folkeeventyr.pdf', 'общественное достояние', 'frame', 'Старая орфография — для продвинутых. 480 книг бесплатно: bokselskap.no.', 'https://www.bokselskap.no'],
      ['Knut Hamsun — Sult', '🇳🇴', 'C1', 'роман', 'https://www.bokselskap.no/wp-content/themes/bokselskap2/tekster/pdf/sult.pdf', 'общественное достояние', 'frame', 'Старая орфография.'],
      ['Henrik Ibsen — Et dukkehjem', '🇳🇴', 'C1', 'пьеса', 'https://www.bokselskap.no/wp-content/themes/bokselskap2/tekster/pdf/dukkehjem.pdf', 'общественное достояние', 'frame', 'Старая орфография.'],
      ['Sigrid Undset — Jenny (Project Gutenberg)', '🇳🇴', 'C1', 'роман', 'https://www.gutenberg.org/cache/epub/32245/pg32245-images.html', 'общественное достояние', 'frame', ''],
    ]],
  ];

  async function fetchBlob(url) {
    try { const r = await fetch(url); if (r.ok) return await r.blob(); } catch (e) { /* no CORS — try the bridge */ }
    if (window.AI && AI.bridge.up) {
      const r = await fetch('/api/proxy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, method: 'GET' }) });
      if (r.ok) return r.blob();
    }
    throw new Error(window.AI && AI.bridge.up ? 'сайт не отдал книгу — откройте её на сайте ↗'
      : (window.AI && AI.onMac && AI.onMac()
        ? 'этот сайт не даёт приложению загрузить книгу напрямую. Чтобы слушать её вслух или сделать карточки — запустите мост на Mac (в облачной версии это будет работать само). Читать глазами можно и так.'
        : 'этот сайт не даёт приложению загрузить книгу напрямую — в версии на сайте это пока недоступно. Читать глазами можно и так: откройте книгу на сайте ↗.'));
  }

  /** one PDF document per book for this visit: the page view and «Читать вслух» share it (the last 2 books are kept) */
  const DOCS = new Map();
  function pdfDoc(url) {
    if (DOCS.has(url)) { const d = DOCS.get(url); DOCS.delete(url); DOCS.set(url, d); return d; }
    const d = (async () => (await U.lib.pdf()).getDocument({ data: new Uint8Array(await (await fetchBlob(url)).arrayBuffer()) }).promise)();
    DOCS.set(url, d);
    d.catch(() => { if (DOCS.get(url) === d) DOCS.delete(url); });
    while (DOCS.size > 2) { const [k, old] = DOCS.entries().next().value; DOCS.delete(k); old.then(x => { try { x.destroy(); } catch (e) { /* ignore */ } }, () => {}); }
    return d;
  }
  /** js/bookview.js + css/bookview.css, the first time a book is opened (the same version as this file) */
  let viewP = null;
  function loadView() {
    if (window.BookView) return Promise.resolve(window.BookView);
    if (viewP) return viewP;
    const q = (((document.querySelector('script[src*="js/books.js"]') || {}).src || '').match(/\?v=[^&#]+/) || [''])[0];
    if (!document.querySelector('link[href*="css/bookview.css"]')) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/bookview.css' + q; document.head.appendChild(l);
    }
    viewP = new Promise((res, rej) => {
      const sc = document.createElement('script'); sc.src = 'js/bookview.js' + q; sc.async = true;
      sc.onload = () => (window.BookView ? res(window.BookView) : rej(new Error('no view')));
      sc.onerror = () => rej(new Error('no view'));
      document.head.appendChild(sc);
    });
    viewP.catch(() => { viewP = null; });
    return viewP;
  }

  const Books = {
    SHELF,
    pdfDoc,
    open() {
      const m = UI.modal({
        title: '📚 Книги — бесплатно и легально', cls: 'wide books-modal',
        body: `<div class="lib-intro">📖 <span>Книги, учебники, разговорники и словарики, которые авторы, университеты и норвежское государство раздают бесплатно. Читайте прямо здесь или скачивайте. Кнопка <b>🃏 Слова в карточки</b> превращает пары «норвежский – перевод» из книги в карточки.</span></div>
          <div class="row" style="gap:8px;flex-wrap:wrap;margin:-4px 0 10px"><button type="button" class="btn sm primary" data-reader-open>📖 Читалка — мои книги</button><span class="tiny muted" style="align-self:center">свои PDF, EPUB, TXT, Word — вслух двумя голосами</span></div>
          <div class="row" style="gap:6px;flex-wrap:wrap" data-filter>${['все', '🇷🇺', '🇺🇦', '🇬🇧', '🇳🇴', 'A1', 'A2', 'B1', 'B2', 'C1'].map((f, i) => `<button class="chip ${i ? '' : 'active'}" data-f="${f}">${f === 'все' ? 'Все' : f}</button>`).join('')}</div>
          ${SHELF.map(([title, list], gi) => `<div class="lib-group"><div class="lib-group-head"><h3>${title}</h3></div><div class="lib-grid">
            ${list.map(([t, langs, level, kind, url, lic, how, note, site], i) => `<div class="lib-tile book-tile" data-langs="${langs}" data-level="${level}">
              <div class="lib-tile-head"><span class="book-ico">${/MP3|zip/i.test(url + t) ? '🎧' : '📘'}</span><div class="grow"><b>${U.esc(t)}</b><small>${langs} · ${U.esc(level)} · ${U.esc(kind)}</small></div></div>
              <div class="lib-chips"><span class="chip learned">${U.esc(lic)}</span></div>
              ${note ? `<p class="small muted">${U.esc(note)}</p>` : '<p></p>'}
              <div class="row" style="gap:6px">
                ${how !== 'tab' ? (() => { const rp = window.Resume && Resume.get('book', url); return `<button class="btn sm primary" data-read="${gi}.${i}"${rp ? ` title="Вы остановились на ${Resume.label(rp)}"` : ''}>📖 Читать здесь${rp ? ` · ${Resume.label(rp)}` : ''}</button>`; })() : ''}
                ${window.AudioCourse && AudioCourse.idForUrl(url) ? `<button type="button" class="btn sm primary listen-cta" data-acourse="${AudioCourse.idForUrl(url)}" title="Загрузить уроки внутрь приложения и слушать их здесь — в наушниках, через динамик, на колонке или телевизоре">🎧 В приложение${AudioCourse.statusLabel(AudioCourse.idForUrl(url)) ? ` · ${AudioCourse.statusLabel(AudioCourse.idForUrl(url))}` : ''}</button><a class="btn sm ghost" href="${U.esc(url)}" target="_blank" rel="noopener" title="Скачать архив .zip на компьютер (как обычный файл)">⬇ Скачать файл</a>`
                  : `<a class="btn sm" href="${U.esc(url)}" target="_blank" rel="noopener">${how === 'tab' ? '⬇ Скачать' : '↗ Открыть'}</a>`}
                ${/\.pdf|\/pdf\//i.test(url) ? `<button class="btn sm ai" data-cards="${gi}.${i}">🃏 Слова в карточки</button><button class="btn sm listen-cta" data-blisten="${gi}.${i}" title="Слушать книгу вслух — в наушниках или через динамик; экран можно выключить">${Listen.HEADPHONES(16, true)} Слушать</button>` : ''}
                ${site ? `<a class="btn sm ghost" href="${U.esc(site)}" target="_blank" rel="noopener">Все книги ↗</a>` : ''}
              </div></div>`).join('')}</div></div>`).join('')}
          <div class="tiny muted">Ещё бесплатно: Telegram → «📎 Книги и аудио» (файлы ваших каналов), Nasjonalbiblioteket nb.no (читать онлайн из Норвегии), StoryWeaver (книжки на норвежском, CC BY). Мы не размещаем чужие книги у себя — всё открывается с официальных сайтов.</div>`,
      });
      const book = k => { const [g, i] = k.split('.').map(Number); return SHELF[g][1][i]; };
      m.el.addEventListener('click', async e => {
        if (e.target.closest('[data-reader-open]')) { if (window.Reader) Reader.open(); return; }
        const ac = e.target.closest('[data-acourse]'); // 🎧 50languages MP3 → «Аудиокурсы» (js/audiocourse.js)
        if (ac) { if (window.AudioCourse) AudioCourse.openCourse(ac.dataset.acourse); return; }
        const f = e.target.closest('[data-f]');
        if (f) {
          m.$$('[data-f]').forEach(x => x.classList.toggle('active', x === f));
          const v = f.dataset.f;
          m.$$('.book-tile').forEach(t => { t.hidden = !(v === 'все' || t.dataset.langs.includes(v) || t.dataset.level.includes(v)); });
          return;
        }
        const r = e.target.closest('[data-read]');
        if (r) { this.read(book(r.dataset.read)); return; }
        const L = e.target.closest('[data-blisten]');
        if (L) {
          Listen.prime();
          L.disabled = true; L.innerHTML = '<span class="spinner sm"></span> готовлю…';
          const ok = await this.listen(book(L.dataset.blisten));
          if (ok) m.close(); else { L.disabled = false; L.innerHTML = `${Listen.HEADPHONES(16, true)} Слушать`; }
        }
        const c = e.target.closest('[data-cards]');
        if (c) {
          const b = book(c.dataset.cards);
          c.disabled = true; c.innerHTML = '<span class="spinner sm"></span> загружаю книгу…';
          try {
            const blob = await fetchBlob(b[4]);
            const file = new File([blob], b[0].replace(/[\\/:*?"<>|]/g, ' ').slice(0, 60) + '.pdf', { type: 'application/pdf' });
            m.close();
            await Views.importFiles([file]);
          } catch (err) { UI.toast(err.message, 'warn', 6000); c.disabled = false; c.textContent = '🃏 Слова в карточки'; }
        }
      });
    },
    /** 🎧 a PDF read aloud: its text page by page (Norwegian / Russian / Ukrainian / English voices), from any page */
    async listen(b, fromPage = 1) {
      try {
        const pdf = await pdfDoc(b[4]);
        const raw = [];
        for (let n = Math.max(1, fromPage); n <= Math.min(pdf.numPages, fromPage + 199); n++) {
          const pg = await pdf.getPage(n);
          const tc = await pg.getTextContent();
          // lines with their place on the page: page numbers / running headers live in the top and bottom margins
          let lines = window.PageText ? PageText.pdfLines(tc.items, pg.view) : tc.items.map(x => x.str + (x.hasEOL ? '\n' : ' ')).join('').split('\n');
          // a scanned page whose text was found on the page view (🔎 Распознать, js/bookview.js)
          const ocr = window.BookView && !lines.some(l => /\p{L}{2}/u.test(typeof l === 'string' ? l : l.s)) ? BookView.ocrText(b[4], n) : '';
          if (ocr) lines = ocr.split('\n');
          raw.push({ n, lines });
        }
        // 📄 no page numbers, running headers / footers, «. . .» separators; words cut at line ends glued back (util.js)
        const clean = window.PageText ? PageText.cleanPages(raw.map(r => r.lines), { join: true, pdf: true, nums: raw.map(r => r.n) }) : raw.map(r => r.lines);
        const pages = [];
        raw.forEach((r, k) => {
          const text = clean[k].map(l => (typeof l === 'string' ? l : l.s)).join('\n').replace(/[ \t]+/g, ' ').trim();
          if (text.length > 20) pages.push({ title: `${b[0]} · стр. ${r.n}`, text, page: r.n });
        });
        if (!pages.length) { UI.toast('В этой книге текст нарисован картинкой — прочитать вслух не получится', 'warn', 6000); return false; }
        this.pagesCache[b[4]] = pdf.numPages;
        Listen.startText(b[0], pages, { loop: false, totalPages: pdf.numPages, bookUrl: b[4], book: b });
        return true;
      } catch (err) { UI.toast(err.message, 'warn', 6000); return false; }
    },
    pagesCache: {},
    /** 🖨 «Печать и файлы» (js/printx.js): the PDF's text page by page (the same cleaning as for reading aloud) */
    async print(b, btn) {
      if (!window.PrintX) { UI.toast('Печать ещё загружается — попробуйте через секунду'); return; }
      const label = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> собираю текст…'; }
      try {
        const pdf = await pdfDoc(b[4]);
        const raw = [];
        for (let n = 1; n <= Math.min(pdf.numPages, 400); n++) {
          const pg = await pdf.getPage(n);
          const tc = await pg.getTextContent();
          raw.push({ n, lines: window.PageText ? PageText.pdfLines(tc.items, pg.view) : tc.items.map(x => x.str + (x.hasEOL ? '\n' : ' ')).join('').split('\n') });
        }
        const clean = window.PageText ? PageText.cleanPages(raw.map(r => r.lines), { join: true, pdf: true, nums: raw.map(r => r.n) }) : raw.map(r => r.lines);
        const blocks = [];
        raw.forEach((r, k) => clean[k].map(l => (typeof l === 'string' ? l : l.s)).join('\n').split(/\n+/)
          .map(x => x.replace(/[ \t]+/g, ' ').trim()).filter(x => /\p{L}{2}/u.test(x)).forEach(no => blocks.push({ no, page: r.n })));
        if (!blocks.length) { UI.toast('В этой книге текст нарисован картинкой — напечатать его текстом не получится. Откройте книгу отдельно и распечатайте из браузера', 'warn', 7000); return; }
        PrintX.text({ title: b[0], blocks, source: { id: 'book:' + b[4], name: b[0], kind: 'book', url: b[4], protected: false } });
      } catch (err) { UI.toast(U.niceErr ? U.niceErr(err, 'Печать книги') : 'Печать книги: не получилось — попробуйте ещё раз', 'warn', 6000); }
      finally { if (btn) { btn.disabled = false; btn.innerHTML = label; } }
    },
    async read(b) {
      const [t, langs, , , url, , how] = b;
      const pdf = /\.pdf|\/pdf\//i.test(url);
      const off = []; // what to undo when the window closes
      const m = UI.modal({ title: `📖 ${U.esc(t)}`, cls: 'wide book-reader', body: '<div data-reader class="book-frame"><span class="spinner sm"></span> открываю…</div>',
        onClose: () => { off.splice(0).forEach(f => { try { f(); } catch (e) { /* ignore */ } }); } });
      const box = m.$('[data-reader]');
      try {
        let src = url;
        if (how === 'blob') src = URL.createObjectURL(await fetchBlob(url));
        box.innerHTML = `${pdf ? `<div class="book-toolbar">
            <button class="btn primary listen-btn listen-cta" data-rlisten title="Читать книгу вслух с этой страницы — слово, которое звучит, подсвечивается на странице">${Listen.HEADPHONES(18, true)} Читать вслух</button>
            <div class="book-nav"><button class="icon-btn sm" data-pg="-1" title="Предыдущая страница" aria-label="Предыдущая страница">‹</button>
              <span><span class="bn-l">Страница</span> <input class="input" type="number" min="1" value="1" inputmode="numeric" data-rpage aria-label="Номер страницы" title="Номер страницы"> из <b data-ptotal>…</b></span>
              <button class="icon-btn sm" data-pg="1" title="Следующая страница" aria-label="Следующая страница">›</button><button class="btn sm" data-pggo title="Открыть страницу с этим номером">Перейти</button></div>
            <span class="small muted">через динамик или наушники</span></div>
            <div data-mini></div>` : ''}
          <div class="mt-warn ok tb-hint"><span>📘</span><span><b>Не понимаете слова?</b> Откройте книгу в режиме учебника: перевод каждого абзаца, предложения или слова, озвучка, <b>новые слова → карточки</b> в колоду «📘 ${U.esc(t)}».</span>
            <button class="btn sm primary" data-astb title="Перевод абзацев, предложений и слов, новые слова — в карточки">📘 Читать с переводом и карточками</button></div>
          <div data-frame-wrap>${pdf ? '<div class="bv-loading"><span class="spinner sm"></span> открываю книгу…</div>' : `<iframe src="${U.esc(src)}" title="${U.esc(t)}"></iframe>`}</div>
          <div class="row" style="gap:6px;margin-top:6px"><a class="btn sm" href="${U.esc(url)}" target="_blank" rel="noopener" title="Открыть книгу в отдельной вкладке браузера">↗ Открыть отдельно</a>${pdf && window.PrintX ? '<button type="button" class="btn sm" data-bprint aria-haspopup="dialog" title="Распечатать текст книги (все страницы или часть) или сохранить в Word">🖨 Печать и файлы</button>' : ''}<span class="small muted" data-fnote>Если книга не показалась — откройте её отдельно.</span></div>`;
        // the same book in «📘 My textbook»: translation views, new words → cards, page → cards, listening
        box.querySelector('[data-astb]').onclick = async ev => {
          const btn = ev.currentTarget; btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> загружаю книгу…';
          try {
            const blob = await fetchBlob(url);
            const type = blob.type || '';
            const ext = /pdf/.test(type) || pdf ? 'pdf' : /epub/.test(type) || /\.epub/i.test(url) ? 'epub' : /html/.test(type) || /\.html?|\.images/i.test(url) ? 'html' : 'txt';
            const file = new File([blob], `${t.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 120)}.${ext}`, { type: type || (ext === 'pdf' ? 'application/pdf' : 'text/plain') });
            m.close();
            Textbook.openWith(file, t);
          } catch (e) { UI.toast(e.message, 'bad', 7000); btn.disabled = false; btn.textContent = '📘 Читать с переводом и карточками'; }
        };
        if (!pdf) return;
        const pb = box.querySelector('[data-bprint]');
        if (pb) pb.onclick = () => this.print(b, pb);
        const inp = box.querySelector('[data-rpage]'), tot = box.querySelector('[data-ptotal]'), wrap = box.querySelector('[data-frame-wrap]');
        let shown = 1, view = null, saveT = 0;
        const total = () => +(this.pagesCache[url] || 0);
        const setTotal = n => { this.pagesCache[url] = n; tot.textContent = n; inp.max = n; };
        if (this.pagesCache[url]) setTotal(this.pagesCache[url]);
        const remember = n => { clearTimeout(saveT); saveT = setTimeout(() => {
          if (window.Resume) Resume.save('book', url, n, { unit: 'page', total: total(), title: t }); // 📍 the page is remembered
          // 🎓 «Учить по книге»: after three pages — «Сделать колоду из прочитанного?» (js/learnby.js)
          if (window.LearnBy && LearnBy.offer) LearnBy.offer({ key: 'books:' + url, title: t, page: n, src: 'books', id: url, open: () => this.read(b),
            text: async () => { const pg = await (await pdfDoc(url)).getPage(n); const tc = await pg.getTextContent(); return tc.items.map(x => x.str + (x.hasEOL ? ' ' : '')).join('').replace(/\s+/g, ' '); } });
        }, 600); };
        const startListen = async n => {
          const lb = box.querySelector('[data-rlisten]');
          lb.disabled = true; lb.innerHTML = '<span class="spinner sm"></span> готовлю текст…';
          await this.listen(b, n || shown);
          lb.disabled = false; lb.innerHTML = `${Listen.HEADPHONES(18, true)} Читать вслух`;
        };
        // the player row: works before reading starts too (▶ = read from this page); «Aa» and «🔊 Голос» right here
        const extra = `<button type="button" class="btn sm ghost bv-mp-b bv-aa" data-bv-aa aria-haspopup="dialog" aria-expanded="false" title="Вид: цвет подсветки, слово или вся строка, масштаб страницы" aria-label="Вид страницы и подсветки">Aa</button>
          <button type="button" class="btn sm ghost bv-mp-b" data-bv-voice aria-haspopup="dialog" aria-expanded="false" title="Каким голосом читать норвежский и перевод — можно сменить прямо во время чтения">🔊 Голос</button>`;
        off.push(Listen.miniPlayer(box.querySelector('[data-mini]'), {
          keep: true, extra,
          mine: p => !!(p && p.o && p.o.bookUrl === url),
          idleLabel: () => `▶ — читать вслух со стр. ${shown}${total() ? ' из ' + total() : ''}`,
          onIdle: () => { Listen.prime(); startListen(shown); },
        }));
        box.querySelector('[data-mini]').addEventListener('click', e => {
          const aa = e.target.closest('[data-bv-aa]'), vo = e.target.closest('[data-bv-voice]');
          if (!aa && !vo) return;
          loadView().then(V => { if (aa) V.lookPop(aa, view); else V.voicePop(vo, (window.BookView || V).langsOf(langs)); }).catch(() => UI.toast('Не получилось открыть настройки — попробуйте ещё раз', 'warn'));
        });
        off.push(() => { if (window.BookView) BookView.closePop(); });
        // show page n: our own page view, or a new frame with #page=n (Safari / Chrome / Firefox PDF viewers)
        const showPage = n => {
          n = Math.max(1, total() ? Math.min(total(), n) : n);
          shown = n; inp.value = n;
          if (view) view.goTo(n, true);
          else if (wrap.querySelector('iframe')) wrap.innerHTML = `<iframe src="${U.esc(src)}#page=${n}" title="${U.esc(t)}"></iframe>`;
          remember(n);
        };
        const go = n => {
          showPage(n);
          // reading aloud? continue from this page
          const p = Listen.p;
          if (p && p.o.bookUrl === url) {
            const k = p.cards.findIndex(c => c.page >= shown);
            if (k >= 0) Listen.goTo(k); else { Listen.prime(); this.listen(b, shown); }
          }
        };
        box.querySelector('[data-pggo]').onclick = () => go(+inp.value || 1);
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(+inp.value || 1); });
        inp.addEventListener('change', () => { if (+inp.value && +inp.value !== shown) go(+inp.value); }); // a phone's number pad has no Enter
        box.querySelectorAll('[data-pg]').forEach(x => { x.onclick = () => go(shown + +x.dataset.pg); });
        // the old way (the browser's viewer): the page being read is shown
        const follow = () => { const p = Listen.p; if (view || !p || p.o.bookUrl !== url || !document.body.contains(box)) return; const c = p.cards[p.i]; if (c && c.page && c.page !== shown) showPage(c.page); };
        document.addEventListener('listen-state', follow);
        off.push(() => document.removeEventListener('listen-state', follow));
        const lb = box.querySelector('[data-rlisten]');
        lb.onclick = () => { Listen.prime(); startListen(+inp.value || shown); };
        // 📍 «Продолжить с места, где остановились (стр. N)?»
        if (window.Resume) Resume.ask({ kind: 'book', id: url, title: t, owner: box }).then(n => { if (n && document.body.contains(box)) showPage(n); }).catch(() => {});
        // the pages themselves: drawn by the app (the word being read lights up), else the browser's viewer
        try {
          const [V, doc, lib] = await Promise.all([loadView(), pdfDoc(url), U.lib.pdf()]);
          if (!document.body.contains(box)) return;
          setTotal(doc.numPages);
          view = await V.mount(wrap, { doc, lib, url, title: t, page: shown, langs: V.langsOf(langs),
            onPage: n => { shown = n; if (document.activeElement !== inp) inp.value = n; remember(n); const mp = box.querySelector('[data-mini]'); if (mp && mp._mpPaint) mp._mpPaint(); } });
          off.push(() => view && view.destroy());
          { const mp = box.querySelector('[data-mini]'); if (mp && mp._mpPaint) mp._mpPaint(); }
          const fn = box.querySelector('[data-fnote]'); if (fn) fn.textContent = 'Масштаб — двумя пальцами или кнопками «− +». Слово, которое звучит, подсвечивается прямо на странице.';
          if (!document.body.contains(box)) view.destroy();
        } catch (e) {
          console.warn('book view', e);
          view = null;
          wrap.innerHTML = `<iframe src="${U.esc(src)}#page=${shown}" title="${U.esc(t)}"></iframe>`;
          pdfDoc(url).then(d => { if (document.body.contains(box)) setTotal(d.numPages); }).catch(() => { if (!total()) tot.textContent = '—'; });
        }
      } catch (e) {
        box.innerHTML = `<div class="mt-warn">⚠️ <span>${U.esc(U.niceErr(e))}</span></div><a class="btn sm" href="${U.esc(url)}" target="_blank" rel="noopener">↗ Открыть на сайте</a>`;
      }
    },
  };

  window.Books = Books;
})();
