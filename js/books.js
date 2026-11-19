/* ============ 📚 Books: free & legal books for learning Norwegian (Russian / Ukrainian / English / Norwegian) ============
 * Only what authors / publishers / the Norwegian state give away for free (checked 2026-11). Nothing is re-hosted:
 * every book opens from its official address. Reading inside the app:
 *  - most PDFs can be shown in a frame directly;
 *  - Wikimedia PDFs are fetched (CORS) and shown from memory;
 *  - the rest open in a new tab, or come through the Mac bridge.
 * "🃏 Слова в карточки" sends the PDF to the card importer (pairs "norsk – русский" become cards).
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
      : 'этот сайт не даёт приложению загрузить книгу напрямую. Чтобы слушать её вслух или сделать карточки — запустите мост на Mac (в облачной версии это будет работать само). Читать глазами можно и так.');
  }

  const Books = {
    SHELF,
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
        const pdf = await (await U.lib.pdf()).getDocument({ data: await (await fetchBlob(b[4])).arrayBuffer() }).promise;
        const pages = [];
        for (let n = Math.max(1, fromPage); n <= Math.min(pdf.numPages, fromPage + 199); n++) {
          const tc = await (await pdf.getPage(n)).getTextContent();
          const text = tc.items.map(x => x.str + (x.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ').trim();
          if (text.length > 20) pages.push({ title: `${b[0]} · стр. ${n}`, text, page: n });
        }
        if (!pages.length) { UI.toast('В этой книге текст нарисован картинкой — прочитать вслух не получится', 'warn', 6000); return false; }
        this.pagesCache[b[4]] = pdf.numPages;
        Listen.startText(b[0], pages, { loop: false, totalPages: pdf.numPages, bookUrl: b[4], book: b });
        return true;
      } catch (err) { UI.toast(err.message, 'warn', 6000); return false; }
    },
    pagesCache: {},
    async read(b) {
      const [t, , , , url, , how] = b;
      const pdf = /\.pdf|\/pdf\//i.test(url);
      const m = UI.modal({ title: `📖 ${U.esc(t)}`, cls: 'wide book-reader', body: '<div data-reader class="book-frame"><span class="spinner sm"></span> открываю…</div>' });
      const box = m.$('[data-reader]');
      try {
        let src = url;
        if (how === 'blob') src = URL.createObjectURL(await fetchBlob(url));
        box.innerHTML = `${pdf ? `<div class="book-toolbar">
            <button class="btn primary listen-btn listen-cta" data-rlisten>${Listen.HEADPHONES(18, true)} Читать вслух</button>
            <div class="book-nav"><button class="icon-btn sm" data-pg="-1" title="Предыдущая страница">‹</button>
              <span>Страница <input class="input" type="number" min="1" value="1" data-rpage> из <b data-ptotal>…</b></span>
              <button class="icon-btn sm" data-pg="1" title="Следующая страница">›</button><button class="btn sm" data-pggo>Перейти</button></div>
            <span class="small muted">через динамик или наушники</span></div>
            <div data-mini hidden></div>` : ''}
          <div class="mt-warn ok tb-hint"><span>📘</span><span><b>Не понимаете слова?</b> Откройте книгу в режиме учебника: перевод каждого абзаца, предложения или слова, озвучка, <b>новые слова → карточки</b> в колоду «📘 ${U.esc(t)}».</span>
            <button class="btn sm primary" data-astb>📘 Читать с переводом и карточками</button></div>
          <div data-frame-wrap><iframe src="${U.esc(src)}" title="${U.esc(t)}"></iframe></div>
          <div class="row" style="gap:6px;margin-top:6px"><a class="btn sm" href="${U.esc(url)}" target="_blank" rel="noopener">↗ Открыть отдельно</a><span class="small muted">Если книга не показалась — откройте её отдельно.</span></div>`;
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
        const lb = box.querySelector('[data-rlisten]');
        Listen.miniPlayer(box.querySelector('[data-mini]'));
        if (pdf) {
          const inp = box.querySelector('[data-rpage]'), tot = box.querySelector('[data-ptotal]');
          let shown = 1;
          const total = () => +(this.pagesCache[url] || 0);
          // total number of pages (from the PDF itself; '—' if the site does not let us read it)
          if (this.pagesCache[url]) tot.textContent = this.pagesCache[url];
          else fetchBlob(url).then(async bl => { const d = await (await U.lib.pdf()).getDocument({ data: await bl.arrayBuffer() }).promise; this.pagesCache[url] = d.numPages; tot.textContent = d.numPages; inp.max = d.numPages; }).catch(() => { tot.textContent = '—'; });
          // show page n: a new frame with #page=n (works in Safari / Chrome / Firefox PDF viewers)
          const showPage = n => {
            n = Math.max(1, total() ? Math.min(total(), n) : n);
            shown = n; inp.value = n;
            box.querySelector('[data-frame-wrap]').innerHTML = `<iframe src="${U.esc(src)}#page=${n}" title="${U.esc(t)}"></iframe>`;
            if (window.Resume) Resume.save('book', url, n, { unit: 'page', total: total(), title: t }); // 📍 the page is remembered
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
          box.querySelectorAll('[data-pg]').forEach(x => { x.onclick = () => go(shown + +x.dataset.pg); });
          // the book follows the voice: the page being read is shown
          const follow = () => { const p = Listen.p; if (!p || p.o.bookUrl !== url || !document.body.contains(box)) return; const c = p.cards[p.i]; if (c && c.page && c.page !== shown) showPage(c.page); };
          document.addEventListener('listen-state', follow);
          // 📍 «Продолжить с места, где остановились (стр. N)?»
          if (window.Resume) Resume.ask({ kind: 'book', id: url, title: t, owner: box }).then(n => { if (n && document.body.contains(box)) showPage(n); }).catch(() => {});
        }
        if (lb) lb.onclick = async () => {
          Listen.prime(); lb.disabled = true; lb.innerHTML = '<span class="spinner sm"></span> готовлю текст…';
          await this.listen(b, +box.querySelector('[data-rpage]').value || 1);
          lb.disabled = false; lb.innerHTML = `${Listen.HEADPHONES(18, true)} Читать вслух`;
        };
      } catch (e) {
        box.innerHTML = `<div class="mt-warn">⚠️ <span>${U.esc(e.message)}</span></div><a class="btn sm" href="${U.esc(url)}" target="_blank" rel="noopener">↗ Открыть на сайте</a>`;
      }
    },
  };

  window.Books = Books;
})();
