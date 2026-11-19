/* ============ 💬 «Что вы хотите выучить?» — one window to create cards from anything ============
 * - a topic ("слова для работы на складе")       -> the AI writes a deck (or: expressions from the library without AI)
 * - pasted text with "norsk – русский" pairs      -> cards right away
 * - 📷 a photo (page of a textbook, picture-card) -> text recognized on the picture -> editable pairs -> cards
 * - 📄 PDF / Word / Excel / Anki / CSV            -> the importer;  📗 EPUB -> its text -> pairs -> cards
 */
(function () {
  async function epubText(file) {
    const JSZip = await U.lib.jszip();
    const zip = await JSZip.loadAsync(file);
    const names = Object.keys(zip.files).filter(n => /\.(x?html?)$/i.test(n)).sort();
    let out = '';
    for (const n of names.slice(0, 400)) {
      const html = await zip.files[n].async('string');
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('br, p, div, li, h1, h2, h3, h4, tr').forEach(el => el.insertAdjacentText('afterend', '\n'));
      out += '\n' + (doc.body ? doc.body.textContent : '');
    }
    return out.replace(/\n{3,}/g, '\n\n');
  }

  /* ---- every way to get cards — shown in «Новая колода» ----
   * into: true  -> the cards go straight into the deck being created
   * into: false -> a whole section opens (it makes its own deck or lets you pick one) */
  const SOURCES = [
    { k: 'manual', i: '✍️', t: 'Вручную', d: 'пустая колода — добавлю сам', into: true },
    { k: 'photo', i: '📷', t: 'Фото / скан', d: 'страница, тетрадь, карточки — с переводом или без', into: true },
    { k: 'paste', i: '📋', t: 'Вставить текст', d: 'список «norsk – русский» или просто норвежские слова', into: true },
    { k: 'file', i: '📄', t: 'Файл', d: 'PDF, Word, Excel, Anki, CSV, TXT', into: true },
    { k: 'telegram', i: () => Telegram.TG_SVG(22), t: 'Telegram', d: 'каналы и группы о норвежском', into: true },
    { k: 'library', i: '🃏', t: 'Устойчивые выражения', d: 'идиомы и фразы с переводом', into: true },
    { k: 'ai', i: '✨', t: 'Нейросеть по теме', d: '«у врача», «на складе»…', into: true },
    { k: 'textbook', i: '📘', t: 'Мой учебник', d: 'страница или новые слова → карточки', into: false },
    { k: 'books', i: '📚', t: 'Книги', d: 'читаете — выделили — карточка', into: false },
    { k: 'news', i: '📰', t: 'Новости', d: 'Klar Tale, NRK — слово → карточка', into: false },
    { k: 'subs', i: '🎬', t: 'Субтитры', d: 'видео + .srt → карточки со звуком', into: false },
    { k: 'youtube', i: () => YouTube.YT_SVG(22), t: 'YouTube', d: 'видео учителей с субтитрами → слово в карточку', into: false },
    { k: 'nrk', i: '📺', t: 'NRK TV', d: 'передачи с субтитрами → слово в карточку', into: false },
    { k: 'nrkradio', i: '📻', t: 'NRK Радио и подкасты', d: 'эфир и подкасты — субтитры создаст приложение', into: false },
    { k: 'social', i: '🌐', t: 'Подкасты, ВК, TikTok', d: 'ссылка → текст → карточки', into: false },
    { k: 'genders', i: '🌳👦👧', t: 'По родам', d: 'en · ei · et — с формами', into: false },
    { k: 'freq', i: '🏋️', t: 'Частые слова A1–B2', d: 'следующие 20 по частоте', into: false },
    { k: 'levels', i: '🪜', t: 'Лестница уровней', d: 'Колоды A1 → C2 по темам · тест «Где я сейчас?»', into: false },
  ];
  const icon = s => typeof s.i === 'function' ? s.i() : s.i;

  const Create = {
    SOURCES,
    /** tiles for the «Новая колода» window */
    sourcesHtml(sel) {
      const tile = s => `<button type="button" class="src-tile ${sel === s.k ? 'active' : ''}" data-src="${s.k}"><span class="src-ico">${icon(s)}</span><b>${U.esc(s.t)}</b><small>${U.esc(s.d)}</small></button>`;
      return `<div class="src-head">Из чего сделать карточки?</div>
        <div class="src-grid">${SOURCES.filter(s => s.into).map(tile).join('')}</div>
        <div class="src-head small">Или откройте раздел — там колода создастся сама (или выберете эту):</div>
        <div class="src-grid">${SOURCES.filter(s => !s.into).map(tile).join('')}</div>`;
    },
    /** a deck made a moment ago by «Новая колода» and still empty — removed when the user cancels the source (no empty decks left behind) */
    dropIfEmpty(deckId) {
      const d = deckId && Store.deck(deckId);
      if (!d || Store.cards(deckId).length) return;
      Store.state.decks = Store.state.decks.filter(x => x.id !== deckId);
      Store.save();
      if (App.view && App.view.name === 'deck' && App.view.params.id === deckId) App.go('home'); else App.render();
    },
    /** start a source; deckId — the deck the cards go into (null: the source decides); fresh — the deck was just created for it */
    launch(k, deckId, fresh) {
      const cancel = fresh ? () => this.dropIfEmpty(deckId) : null;
      const run = {
        manual: () => App.go('deck', { id: deckId }),
        photo: () => this.pickPhotos(deckId, cancel),
        paste: () => this.pasteText(deckId, cancel),
        file: () => this.pickFile(deckId, cancel),
        telegram: () => Telegram.open(null, 'vocab', { deckId, onClose: cancel }),
        library: () => Library.open(deckId),
        ai: () => (AI.available() ? Views.generateDeckDialog(deckId) : Guides.needAI('Колода по теме')),
        textbook: () => Textbook.open(), books: () => Books.open(), news: () => News.open(), subs: () => Subs.open(), nrk: () => NrkTV.open(), nrkradio: () => NrkRadio.open(),
        youtube: () => YouTube.open(), social: () => Social.open(null, 'link'), genders: () => Genders.open(), freq: () => Drills.next20(), levels: () => Levels.open(),
      }[k];
      if (run) run();
    },
    /** 📷 photos / scans -> recognized text -> pairs; missing translations are translated (marked who did it) */
    pickPhotos(deckId, onCancel) {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
      if (onCancel) inp.addEventListener('cancel', onCancel);
      inp.onchange = () => {
        const files = [...inp.files].filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|gif|bmp|tiff?)$/i.test(f.name));
        if (!files.length) { if (onCancel) onCancel(); return; }
        const title = files.length === 1 ? `фото «${files[0].name}»` : `${files.length} фото`;
        Telegram.toCards({ src: 'local', chatTitle: title, link: '', text: '', photos: files.map(f => URL.createObjectURL(f)), video: null }, null, null, { deckId, autoOcr: true, onCancel });
      };
      inp.click();
    },
    /** 📋 pasted text: pairs «norsk – русский», or Norwegian only (then translated) */
    pasteText(deckId, onCancel) {
      const m = UI.modal({
        title: '📋 Вставьте текст', cls: 'wide',
        body: `<textarea class="input" data-t rows="10" placeholder="hus – дом&#10;katt – кошка&#10;&#10;или просто норвежские слова и фразы, по одной в строке — переведу сам"></textarea>
          <div class="small muted" style="margin-top:6px">Подходит всё: «слово – перевод», «слово: перевод», норвежская строка и под ней русская, или только норвежский.</div>`,
        foot: '<button class="btn ghost" data-cancel>Отмена</button><button class="btn primary" data-ok>Дальше ›</button>',
        onClose: r => { if (r !== 'ok' && onCancel) onCancel(); },
        // a pasted list is not lost by an accidental ✕ / Esc / tap outside
        beforeClose: UI.guard(() => !m.$('[data-t]').value.trim() ? null : { title: 'Закрыть без сохранения?', line: 'Вставленный текст не сохранится.',
          actions: [{ label: 'Закрыть', value: 'close', cls: 'bad' }] }),
      });
      setTimeout(() => m.$('[data-t]').focus(), 60);
      m.$('[data-cancel]').onclick = () => m.tryClose();
      m.$('[data-ok]').onclick = () => {
        const text = m.$('[data-t]').value.trim();
        if (!text) { UI.toast('Вставьте текст', 'warn'); return; }
        m.close('ok');
        Telegram.toCards({ src: 'local', chatTitle: 'мой текст', link: '', text, photos: [], video: null }, null, null, { deckId, onCancel });
      };
    },
    pickFile(deckId, onCancel) {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.pdf,.epub,.docx,.doc,.odt,.xlsx,.xls,.csv,.tsv,.txt,.md,.json,.apkg,.colpkg,.rtf,.html,.htm';
      if (onCancel) inp.addEventListener('cancel', onCancel);
      inp.onchange = async () => {
        const f = inp.files[0]; if (!f) { if (onCancel) onCancel(); return; }
        if (/\.epub$/i.test(f.name)) {
          try {
            const text = await epubText(f);
            Telegram.toCards({ src: 'local', chatTitle: `книга «${f.name.replace(/\.epub$/i, '')}»`, link: '', text, photos: [], video: null }, null, null, { deckId, onCancel });
          } catch (err) { UI.toast('EPUB: ' + err.message, 'bad', 5000); if (onCancel) onCancel(); }
          return;
        }
        // the import window may be cancelled — the just-created deck must not stay empty (removed only if still empty)
        try { await Views.importFiles([f], deckId); } finally { if (onCancel) onCancel(); }
      };
      inp.click();
    },

    open(deckId) {
      const m = UI.modal({
        title: '💬 Что вы хотите выучить?', cls: 'wide create-modal',
        body: `<div class="create-hero"><div class="create-ico">🃏</div><h2>Назовите тему — я создам карточки</h2><p class="muted">Или вставьте список слов, добавьте фото страницы, PDF или EPUB.</p></div>
          <div class="create-box">
            <textarea class="input" data-q rows="3" placeholder="Например: «слова для работы на складе», «у врача», «фразы со словом tørst» — или вставьте список «norsk – русский»"></textarea>
            <div class="row create-actions">
              <label class="btn sm" title="Фото страницы учебника, карточки-картинки, скриншот">📷 Добавить фото<input type="file" accept="image/*" multiple data-photo hidden></label>
              <label class="btn sm" title="PDF, EPUB, Word, Excel, Anki, CSV, TXT">📄 PDF / EPUB / файл<input type="file" accept=".pdf,.epub,.docx,.doc,.xlsx,.xls,.csv,.tsv,.txt,.md,.json,.apkg,.colpkg" data-file hidden></label>
              <span class="grow"></span>
              <button class="btn primary create-send" data-go title="Создать">↑</button>
            </div>
          </div>
          <div class="create-tips">
            ${['🍳 Кухня и еда', '🏥 У врача', '🧹 Работа: уборка', '🏛 NAV и документы', '💬 Разговорные фразы', '🚌 Транспорт'].map(t => `<button class="chip" data-topic="${U.esc(t.replace(/^\S+\s/, ''))}">${U.esc(t)}</button>`).join('')}
          </div>
          <section class="tgc-mini" data-tgchan-mini aria-label="Норвежские каналы в Телеграме"></section>
          <div class="lib-intro" style="margin-top:6px">🧭 <span>Ещё источники: <a href="#" data-more="levels">🪜 колоды по уровням A1–C2</a> · <a href="#" data-more="library">🃏 устойчивые выражения</a> · <a href="#" data-more="genders">🌳👦👧 по родам</a> · <a href="#" data-klokka-open>🕐 время по-норвежски</a> · <a href="#" data-ordtr="decks" data-ordtr-close>📚 грамматика: готовые колоды</a> · <a href="#" data-more="books">📚 книги</a> · <a href="#" data-more="telegram">✈️ Telegram</a> · <a href="#" data-more="social">🌐 подкасты, ВК, TikTok, Instagram</a></span></div>
          ${AI.available() ? '' : '<div class="mt-warn">💡 <span>Чтобы создавать колоды по теме, подключите нейросеть (бесплатно: Gemini или Groq в Настройках). Списки слов, фото, PDF и EPUB работают и без неё.</span></div>'}`,
      });
      const q = m.$('[data-q]');
      setTimeout(() => q.focus(), 60);
      // 📢 Norwegian Telegram channels (js/tgchan.js): a few cards + «all channels» → the Telegram window
      if (window.TgChan) TgChan.mini(m.$('[data-tgchan-mini]'), () => { m.close(); Telegram.open(null, 'channels'); });
      else m.$('[data-tgchan-mini]').remove();
      m.el.addEventListener('click', e => {
        const t = e.target.closest('[data-topic]'); if (t) { q.value = t.dataset.topic; q.focus(); return; }
        const mo = e.target.closest('[data-more]');
        if (mo) {
          e.preventDefault(); m.close();
          ({ levels: () => Levels.open(), library: () => Library.open(deckId), genders: () => Genders.open(), books: () => Books.open(), telegram: () => Telegram.open(null, 'vocab'), social: () => Social.open(null, 'link') })[mo.dataset.more]();
        }
      });
      const go = async () => {
        const text = q.value.trim();
        if (!text) { UI.toast('Напишите тему или вставьте слова', 'warn'); return; }
        const pairs = Telegram.pairs(text).filter(p => p.ru || p.en);
        if (pairs.length >= 2 || (pairs.length === 1 && text.split('\n').length === 1 && /\s[–—-]\s|:/.test(text))) {
          m.close();
          Telegram.toCards({ src: 'local', chatTitle: 'мой список', link: '', text, photos: [], video: null }, null);
          return;
        }
        if (!AI.available()) {
          UI.toast('Для темы нужна нейросеть — открываю библиотеку выражений по слову', 'warn', 5000);
          m.close(); Library.open(deckId); return;
        }
        m.close();
        Views.generateDeckDialog(deckId);
        setTimeout(() => { const inp = document.querySelector('[data-f="topic"]'); if (inp) { inp.value = text; inp.focus(); } }, 80);
      };
      m.$('[data-go]').onclick = go;
      q.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !q.value.includes('\n')) { e.preventDefault(); go(); } });
      m.$('[data-photo]').onchange = e => {
        const files = [...e.target.files]; if (!files.length) return;
        m.close();
        const title = files.length === 1 ? `фото «${files[0].name}»` : `${files.length} фото`;
        Telegram.toCards({ src: 'local', chatTitle: title, link: '', text: '', photos: files.map(f => URL.createObjectURL(f)), video: null }, null, null, { deckId, autoOcr: true });
      };
      m.$('[data-file]').onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        if (/\.epub$/i.test(f.name)) {
          try {
            const text = await epubText(f);
            m.close();
            const pairs = Telegram.pairs(text);
            if (!pairs.filter(p => p.ru).length) { UI.toast('В книге не нашлось пар «норвежский – перевод». Можно выделить текст в книге и вставить сюда.', 'warn', 6000); return; }
            Telegram.toCards({ src: 'local', chatTitle: `книга «${f.name.replace(/\.epub$/i, '')}»`, link: '', text, photos: [], video: null }, null);
          } catch (err) { UI.toast('EPUB: ' + err.message, 'bad', 5000); }
          return;
        }
        m.close();
        Views.importFiles([f], deckId);
      };
    },
  };

  window.Create = Create;
})();
