/* ============ ▶ YouTube: videos about the word / expression on the current card ============
 * - search links (whole YouTube, pronunciation, subtitles via Filmot) — no key needed
 * - every Norwegian teacher channel opens ITS OWN search for this word (handles verified 2026-11)
 * - with a free YouTube Data API key (Settings): results right in the app with a built-in player
 */
(function () {
  const CHANNELS = [
    // [handle, name, language, focus, subscribers, has idiom series, recommended (shown first, 🏅)]
    ['ArveHansen', 'Арве Хансен — норвежец, учит по-русски', 'ru', 'с нуля: 618 нужных слов, 100 фраз, 75 глаголов, произношение всех звуков, være/bli, артикли · есть видео по-украински', '48K', false, true],
    ['NorsklrerKarense', 'Norsklærer Karense', 'no', 'грамматика, слова, подготовка к Norskprøve; серия «faste uttrykk»', '132K', true],
    ['norskfordeg', 'Norsk For Deg!', 'no', 'A1–C1, слова и выражения дня', '8K', true],
    ['SimpleNorwegian', 'Simple Norwegian', 'no', 'простые уроки', '102K'],
    ['LearnNorwegianNaturally', 'Learn Norwegian Naturally', 'no', 'аудирование с текстом', '48K'],
    ['norwegianwithilys', 'Norwegian with Ilys', 'no', 'понятный инпут, метод', '55K'],
    ['prebensnorwegiancommunity', "Preben's Norwegian community", 'no', 'Norskprøve, продвинутые фразы', '30K'],
    ['LærNorskNå', 'Lær norsk nå! (Marius)', 'no', 'B1–B2, диалекты, подкаст', '14K'],
    ['TheNorwegianSchool', 'The Norwegian School', 'no', 'уроки по учебнику', '11K'],
    ['NorskMedAria', 'Norsk med Aria', 'no', 'понятный инпут', '9K'],
    ['Norskkurset', 'Norskkurset', 'no', 'B1+', '3K'],
    ['nrknyinorge6669', 'NRK Ny i Norge', 'no', 'новости простым языком каждый день, с переводом (в т.ч. на украинский)', '13K', false, true],
    ['LæreNorsk', 'NTN Skole (Norsk Tolk)', 'no', 'подготовка к Norskprøve (устная A2–B2), диалоги, «Norske uttrykk forklart»', '36K', true],
    ['CoursesNorwegian', 'Courses Norwegian', 'no', 'аудирование A2–B2+, пробный Norskprøve', '21K'],
    ['Norskdrypp', 'Norskdrypp', 'no', 'грамматика и лексика B1–B2, квизы, устный Norskprøve', '16K'],
    ['bildeglimt', 'Ett Lite Bildeglimt', 'no', 'аудирование по картинкам A1–B1, идиомы (578 видео)', '8.6K', true],
    ['olanorwegian4052', 'Ola Norwegian', 'no', 'аудирование с норвежскими субтитрами, фразовые глаголы', '8K', true],
    ['Way2Norway-qk7ec', 'Erlend — Way 2 Norway', 'no', 'аудирование B1–B2: общество и культура Норвегии', '7.2K'],
    ['NorwegianConnect', 'Norwegian Connect', 'no', 'диалоги A1–B1 по темам', '6.4K'],
    ['learn-norwegian-truong', 'Lær norsk Truong', 'no', 'грамматика к Norskprøven A1–B1', '5.2K'],
    ['SlowNorwegian', 'Relax With Slow Norwegian (Lene)', 'no', 'медленные истории, идиомы', '2.9K', true],
    ['ToUnderstandNorwegian', 'To Understand Norwegian', 'no', 'понятный ввод A2–B1, диалекты (Ставангер)', '2.7K'],
    ['norwegianstudio123', 'Norwegian Studio', 'no', 'грамматика, разговорные программы B1–B2', '2.5K'],
    ['norskmedAnita', 'Comprehensible Norwegian (Anita)', 'no', 'понятный ввод A1–A2 с картинками и квизами', '2.2K'],
    ['TeacherTomNorway', 'Teacher Tom', 'no', 'грамматика A2–B2 (ingen/ikke noe, og/å, ja/jo)', '2K'],
    ['NorwegianwithMathias', 'Norwegian with Mathias', 'no', 'медленное аудирование A1–A2 по темам', '1.9K'],
    ['MikaelsNorwegianLessons', "Mikael's Norwegian Lessons", 'no', 'понятный ввод A2–B1, народные сказки', '0.9K'],
    ['nrksuper', 'NRK Super', 'no', 'детские передачи — лёгкое аудирование', '106K'],
    ['PeppaGrisNorskOffisiell', 'Peppa Gris — på norsk', 'no', 'мультфильм на норвежском, ввод A1', '107K'],
    ['ndla', 'NDLA', 'no', 'школьные предметы на норвежском (B2+)', '23K'],
    ['NorwegianTeacher', 'Norwegian Teacher — Karin', 'en', 'учебник «God i norsk» по главам, «уникальные норвежские слова», жизнь в Норвегии', '101K', true, true],
    ['NorwegianClass101', 'NorwegianClass101', 'en', 'начальный уровень, фразы', '126K'],
    ['NorwegianLanguageSchool', 'Learn Norwegian (Norwegian Language School)', 'en', 'трудные пары слов (synes/tro, hvis/om), грамматика', '9.9K'],
    ['norskmedsilje', 'Silje Moss (Norsk med Silje)', 'en', 'разговорные фразы и вежливость A1–B1', '6.4K', true],
    ['SpeakNorsk', 'Speak Norsk', 'en', 'разговор, бытовые фразы', '68K'],
    ['Norwegianschoolonline', 'Norwegian School Online', 'en', 'грамматика A1–C2', '34K', true],
    ['norwegianwithtor', 'Norwegian With Tor', 'en', 'бытовые фразы, короткие видео', '11K', true],
    ['Say-Norwegian', 'Say Norwegian', 'en', 'речь для приезжих', '10K'],
    ['LinguNorge', 'Lingu', 'en', 'общий курс', '3K'],
    ['easylanguages', 'Easy Languages (Easy Norwegian)', 'en', 'уличные интервью с субтитрами', '1.5M'],
    ['Svetlana_List_norsk', 'Норвежский со Светланой Лист', 'ru', 'грамматика', '7.7K'],
    ['purelanguageschool', 'Учим норвежский с Daria Pure', 'ru', 'начальный уровень, грамматика', '7K'],
    ['DeterNorsk', 'Det er Norsk — для начинающих', 'ru', 'начальный уровень, фразы', '6.4K'],
    ['lizzet05', 'Норвежский с Лизой', 'ru', 'общий курс', '4.5K'],
    ['listen-norway', 'Норвежский на слух', 'ru', 'аудирование', '3.6K'],
    ['norskmedluba', 'Norsk Med Luba', 'ru', 'грамматика', '2.5K'],
    ['SpraklyLanguages', 'Норвежский для жизни', 'ru', 'быт и работа · есть уроки A1 по-украински', '2.2K'],
    ['SkamlseNorwegianschool', 'Skamløse: Norwegian school', 'ru', 'бесплатные уроки каждую неделю: грамматика (få, ikke, da/når/før/siden), магазин, врач', '16K'],
    ['Norsk365', 'Norsk365 — норвежский каждый день', 'ru', 'средний уровень: тонкости грамматики (står/ligger/sitter), small talk, фразы', '2.1K', true],
    ['NorskLett', 'Норвежский? Легко!', 'ru', 'вебинары для живущих в Норвегии (RU и UA версии): работа, свой бизнес', '6.2K'],
    ['norskenkelt', 'Норвежский? Просто!', 'ru', 'грамматика A1–B1 (предлоги, времена), чтение', '1.6K'],
    ['norsk.enkelt', 'Катя о норвежском и Норвегии', 'ru', 'подготовка к Norskprøve, грамматика', '0.4K'],
    ['Pavlo_Sabitov_nynorsk', 'Pavlo Sabitov | NYNORSK', 'ru', 'нюнорск на слух: частые глаголы, рабочие темы', '1K'],
    ['prosprak', 'ProSpråk', 'uk', 'норвезька для українців', '6.2K'],
    ['Easy_Norsk', 'Норвезька мова від 0 до B2', 'uk', 'з нуля до B2', '0.3K'],
    ['snakkemakker_ua_no', 'Snakkemakker — норвезька мова', 'uk', 'новий канал', 'new'],
    ['nicknorway', 'Nick i Norge (Микола)', 'uk', 'A2–B1: слова, пари дієслів, теорія на права, питання Samfunnskunnskapsprøven', '9.6K'],
    ['magic_norway', 'Magic Norway', 'uk', 'родина з України: влоги + серія «Норвезька мова з нуля» (діалоги)', '7.3K'],
    ['NorskLett', 'Норвежский? Легко! (українською)', 'uk', 'вебінари українською для тих, хто живе в Норвегії', '6.2K'],
  ];
  const LANG = { no: ['🇳🇴', 'Учителя на норвежском'], en: ['🇬🇧', 'Объясняют по-английски'], ru: ['🇷🇺', 'Объясняют по-русски'], uk: ['🇺🇦', 'Пояснюють українською'] };
  const YT_SVG = (s = 18) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="4.5" width="21" height="15" rx="4.5" fill="#ff0033"/><path d="M10 8.8v6.4l5.6-3.2z" fill="#fff"/></svg>`;
  const enc = encodeURIComponent;
  /* results are remembered for 30 days (localStorage): every word costs at most ONE search of the daily quota */
  const CACHE_KEY = 'nk-yt-cache', CACHE_DAYS = 30, CACHE_MAX = 400;
  const cache = {
    all() { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch (e) { return {}; } },
    get(q) {
      const e = this.all()[q.toLowerCase()];
      return e && Date.now() - e.t < CACHE_DAYS * 864e5 ? e.items : null;
    },
    set(q, items) {
      const all = this.all();
      all[q.toLowerCase()] = { t: Date.now(), items: items.map(x => ({ id: { videoId: x.id.videoId }, snippet: { title: x.snippet.title, channelTitle: x.snippet.channelTitle, thumbnails: { medium: { url: ((x.snippet.thumbnails || {}).medium || {}).url } } } })) };
      const keys = Object.keys(all).sort((a, b) => all[b].t - all[a].t);
      keys.slice(CACHE_MAX).forEach(k => delete all[k]);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(all)); } catch (e) { /* storage full — just don't remember */ }
    },
  };
  /** the daily quota resets at midnight Pacific time; until then — no more API calls, links work */
  const quotaOut = () => Date.now() < +(localStorage.getItem('nk-yt-quota-until') || 0);
  const markQuotaOut = () => {
    const now = new Date();
    const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const msToMidnight = (24 * 3600 - (pt.getHours() * 3600 + pt.getMinutes() * 60 + pt.getSeconds())) * 1000;
    localStorage.setItem('nk-yt-quota-until', String(Date.now() + msToMidnight + 60000));
  };

  const YouTube = {
    CHANNELS, YT_SVG,
    /** what to search for: the expression itself, or the bare word ("å snakke" -> "snakke", "en bil" -> "bil") */
    query(card) {
      const no = String(card.no || '').split('\n')[0].replace(/\([^)]*\)/g, ' ').replace(/[*_`#]/g, '').replace(/\s+/g, ' ').trim();
      const bare = no.replace(/^(å|en|ei|et)\s+/i, '').replace(/[.!?…]+$/, '').trim();
      return bare.split(/\s+/).length > 6 ? bare.split(/\s+/).slice(0, 6).join(' ') : bare;
    },
    channelUrl(h, q) { return q ? `https://www.youtube.com/@${enc(h)}/search?query=${enc(q)}` : `https://www.youtube.com/@${enc(h)}/videos`; },

    /** card → search that word; no card (left menu «▶ YouTube») → the catalogue of channels + search any word */
    open(card) {
      const q0 = card ? this.query(card) : '';
      this._playing = null;
      const ru = card ? String(card.ru || '').split(/[\n,;(]/)[0].trim() : '';
      const m = UI.modal({ title: q0 ? `${YT_SVG(24)} YouTube: «${U.esc(q0)}»` : `${YT_SVG(24)} YouTube — норвежский: каналы и поиск`, cls: 'wide yt-modal', body: '<div data-yt></div>' });
      const box = m.$('[data-yt]');
      const render = q => {
        box._q = q || '';
        if (!q) {
          // the catalogue: every teacher channel (opens its videos) and a search field for any word or topic
          box.innerHTML = `
            <div class="row" style="gap:8px"><input class="input grow" data-q value="" placeholder="Слово, фраза или тема: «å ha lyst til», «uttale», «Norskprøve B1»…"><button class="btn primary" data-act="yt-go">🔎 Искать</button></div>
            <div class="small muted">Нажмите на канал — его видео откроются здесь, с норвежскими субтитрами и переводом (↗ — открыть в YouTube). Впишите слово — найдём его на YouTube и у учителей. Или вставьте ссылку на видео — оно откроется здесь.</div>
            ${Object.entries(LANG).map(([lg, [flag, title]]) => `<div class="yt-group"><div class="yt-group-head">${flag} ${title}</div><div class="yt-grid">
              ${CHANNELS.filter(c => c[2] === lg).sort((a, b) => (b[6] ? 1 : 0) - (a[6] ? 1 : 0)).map(([h, n, , focus, subs, idioms, top]) => `<a class="yt-ch ${top ? 'top' : ''}" href="${U.esc(this.channelUrl(h, ''))}" target="_blank" rel="noopener" data-ch="${U.esc(h)}" data-n="${U.esc(n)}" title="${U.esc(n)} — видео канала здесь, с субтитрами и переводом">
                <span class="yt-ch-ico">${YT_SVG(20)}</span><span class="grow"><b>${top ? '🏅 ' : ''}${U.esc(n)}${idioms ? ' ⭐' : ''}</b><small>${U.esc(focus)} · ${U.esc(subs)}</small></span><span class="yt-go" data-out title="Открыть канал в приложении или на сайте YouTube">↗</span></a>`).join('')}
              </div></div>`).join('')}
            <div class="tiny muted">⭐ — есть серия про устойчивые выражения · 🏅 — особенно рекомендуем.</div>`;
          setTimeout(() => { const i = box.querySelector('[data-q]'); if (i && !('ontouchstart' in window)) i.focus(); }, 80);
          return;
        }
        const key = (Store.settings.ytKey || '').trim();
        const links = [
          [`«${q}» — везде на YouTube`, `https://www.youtube.com/results?search_query=${enc('"' + q + '" norsk')}`],
          ['Что значит (hva betyr)', `https://www.youtube.com/results?search_query=${enc('hva betyr ' + q)}`],
          ['Произношение (uttale)', `https://www.youtube.com/results?search_query=${enc(q + ' uttale')}`],
          ...(ru ? [[`«${ru}» по-норвежски`, `https://www.youtube.com/results?search_query=${enc(ru + ' по-норвежски')}`]] : []),
          ['🎬 В субтитрах видео (Filmot)', `https://filmot.com/search/${enc(q)}/1?lang=no`],
        ];
        box.innerHTML = `
          <div class="row yt-qrow" style="gap:8px"><input class="input grow" data-q value="${U.esc(q)}" title="Можно изменить, что искать"><button class="btn primary" data-act="yt-go">🔎 Искать</button>
            ${card ? '' : CardMaker.btn('➕ Создать карточку', 'btn', 'data-act="yt-card"')}</div>
          <div class="yt-links">${links.map(([l, u]) => `<a class="chip" href="${U.esc(u)}" target="_blank" rel="noopener">${YT_SVG(14)} ${U.esc(l)} ↗</a>`).join('')}</div>
          <div data-yt-results>${key ? '<div class="small muted"><span class="spinner sm"></span> ищу видео…</div>' : `<div class="mt-warn ok" style="margin:6px 0">💡 <span><b>Видео прямо здесь, со встроенным плеером:</b> добавьте бесплатный ключ YouTube Data API (≈100 поисков в день) — <a href="#" data-act="yt-key">Настройки → YouTube</a>. Без ключа поиск открывается на сайте YouTube.</span></div>`}</div>
          <h3 style="margin:14px 0 4px">👩‍🏫 Учителя норвежского — поиск «${U.esc(q)}» на их каналах</h3>
          <div class="small muted" style="margin-bottom:6px">Нажмите на канал — откроется поиск этого слова среди его видео. ⭐ — есть серия про устойчивые выражения. 🏅 — особенно рекомендуем.</div>
          ${Object.entries(LANG).map(([lg, [flag, title]]) => `<div class="yt-group"><div class="yt-group-head">${flag} ${title}</div><div class="yt-grid">
            ${CHANNELS.filter(c => c[2] === lg).sort((a, b) => (b[6] ? 1 : 0) - (a[6] ? 1 : 0)).map(([h, n, , focus, subs, idioms, top]) => `<a class="yt-ch ${top ? 'top' : ''}" href="${U.esc(this.channelUrl(h, q))}" target="_blank" rel="noopener" data-ch="${U.esc(h)}" data-n="${U.esc(n)}" data-q="${U.esc(q)}" title="${U.esc(n)} — видео канала здесь (с «${U.esc(q)}» в названии — первыми)">
              <span class="yt-ch-ico">${YT_SVG(20)}</span><span class="grow"><b>${top ? '🏅 ' : ''}${U.esc(n)}${idioms ? ' ⭐' : ''}</b><small>${U.esc(focus)} · ${U.esc(subs)}</small></span><span class="yt-go" data-out title="Искать «${U.esc(q)}» на канале — в приложении или на сайте YouTube">↗</span></a>`).join('')}
            </div></div>`).join('')}
          <div class="tiny muted">На русских и украинских каналах поиск находит слово, только если оно есть в названии или описании видео.</div>`;
        if (key) this.results(box.querySelector('[data-yt-results]'), q, key);
      };
      render(q0);
      // a pasted link to a video plays it right here; otherwise — search
      const go = nq => {
        const vid = this.videoId(nq);
        if (vid) { this.watch(vid); return; }
        m.$('.modal-head h2').innerHTML = `${YT_SVG(24)} YouTube: «${U.esc(nq)}»`; render(nq);
      };
      box.addEventListener('click', e => {
        // a channel tile: its videos here (the ↗ on it, or Cmd/Ctrl+click — on YouTube itself)
        const ch = e.target.closest('a.yt-ch[data-ch]');
        if (ch && !e.target.closest('[data-out]') && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.button) { e.preventDefault(); this.channel(box, ch.dataset.ch, ch.dataset.n, ch.dataset.q || ''); return; }
        const a = e.target.closest('[data-act]'); if (!a) return;
        if (a.dataset.act === 'yt-back') { e.preventDefault(); render(box._back || ''); return; }
        if (a.dataset.act === 'yt-watch') { e.preventDefault(); this.watch(a.dataset.id, a.dataset.title, a.dataset.ch); return; }
        if (a.dataset.act === 'yt-go') { e.preventDefault(); const nq = box.querySelector('[data-q]').value.trim() || q0; if (nq) go(nq); }
        if (a.dataset.act === 'yt-key') { e.preventDefault(); m.close(); App.go('settings'); setTimeout(() => { const el = document.querySelector('[data-text="ytKey"]'); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } }, 250); }
        if (a.dataset.act === 'yt-card') {
          // the searched word / phrase → a card; the video being watched (if any) is where it came from
          e.preventDefault();
          const nq = (box.querySelector('[data-q]').value || '').trim(); if (!nq) return;
          const v = this._playing;
          const phrase = /\s/.test(nq);
          CardMaker.open({
            key: 'youtube', deck: '▶ Слова из YouTube', deckDesc: 'Слова и фразы, найденные в видео на YouTube', tags: ['youtube'],
            source: v ? { by: 'import', label: `YouTube · «${v.title}»${v.channel ? ' · ' + v.channel : ''}`, url: 'https://www.youtube.com/watch?v=' + v.id, name: 'YouTube' }
              : { by: 'import', label: `YouTube · поиск «${nq}»`, url: 'https://www.youtube.com/results?search_query=' + enc(nq + ' norsk'), name: 'YouTube' },
            options: [{ id: 'q', kind: phrase && /[.!?…]$/.test(nq) ? 'sent' : 'word', label: phrase ? '💬 Фраза' : '🔤 Слово', no: nq, ru: '' }],
          });
          return;
        }
        if (a.dataset.act === 'yt-play') {
          // a found video: plays in the subtitle player (Norwegian line + translation, tap a word → card)
          e.preventDefault();
          const t = a.querySelector('.yt-vid-t'), ch = a.querySelector('small');
          this._playing = { id: a.dataset.id, title: (t ? t.textContent : '').trim(), channel: (ch ? ch.textContent : '').trim() };
          this.watch(a.dataset.id, this._playing.title, this._playing.channel);
        }
      });
      box.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-q]')) { e.preventDefault(); const nq = e.target.value.trim() || q0; if (nq) go(nq); } });
    },

    /** the video id from a YouTube link (watch?v=, youtu.be/, shorts/, embed/, live/) or '' */
    videoId(s) {
      const m = String(s || '').match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})(?![\w-])/);
      return m ? m[1] : '';
    },

    /** ▶ a channel's latest videos right in the app (the bridge reads the channel's public feed — no key needed) */
    async channel(box, handle, name, q) {
      box._back = box._q || '';
      const tile = v => `<div class="nrk-tile">
          <button class="nrk-tile-main" data-act="yt-watch" data-id="${U.esc(v.id)}" data-title="${U.esc(v.title)}" data-ch="${U.esc(name)}" title="Смотреть здесь — с субтитрами и переводом">
            <span class="nrk-img"><img src="https://i.ytimg.com/vi/${enc(v.id)}/mqdefault.jpg" alt="" loading="lazy"></span>
            <span class="nrk-t"><b>${U.esc(v.title)}</b>${v.published ? `<small class="muted">${U.esc(new Date(v.published).toLocaleDateString('ru-RU'))}</small>` : ''}</span>
          </button>
          <a class="nrk-ext" href="https://www.youtube.com/watch?v=${enc(v.id)}" target="_blank" rel="noopener" title="Открыть в приложении или на сайте YouTube">↗</a>
        </div>`;
      box.innerHTML = `<div class="yt-chan-head"><button class="btn sm ghost" data-act="yt-back">← Все каналы</button>
          <b class="grow">${YT_SVG(18)} ${U.esc(name)}</b>
          <a class="btn sm ghost" href="${U.esc(this.channelUrl(handle, q))}" target="_blank" rel="noopener" title="Открыть канал в приложении или на сайте YouTube">↗ YouTube</a></div>
        <div data-ytv><div class="nrk-empty"><span class="spinner sm"></span> загружаю видео канала…</div></div>`;
      const out = box.querySelector('[data-ytv]');
      try {
        const r = await Subs.api('yt-channel', { ch: handle });
        if (!out.isConnected) return;
        let vids = r.videos || [];
        let note = '';
        if (q) {
          const k = U.norm(q);
          const hit = vids.filter(v => U.norm(v.title + ' ' + (v.desc || '')).includes(k));
          note = hit.length ? `Видео с «${U.esc(q)}» — первыми.` : `Среди последних видео канала «${U.esc(q)}» не нашлось — ниже все последние; поиск по всему каналу — <a href="${U.esc(this.channelUrl(handle, q))}" target="_blank" rel="noopener">на YouTube ↗</a>.`;
          vids = hit.concat(vids.filter(v => !hit.includes(v)));
        }
        out.innerHTML = vids.length ? `${note ? `<div class="small muted" style="margin:4px 0 8px">${note}</div>` : ''}<div class="nrk-grid">${vids.map(tile).join('')}</div>
            <div class="tiny muted nrk-foot">Последние ${vids.length} видео канала. Нажмите на видео — оно откроется здесь с норвежскими субтитрами и переводом. Более старые — <a href="${U.esc(this.channelUrl(handle, ''))}" target="_blank" rel="noopener">на YouTube ↗</a>.</div>`
          : '<div class="nrk-empty muted">У канала пока нет видео.</div>';
      } catch (err) {
        if (!out.isConnected) return;
        out.innerHTML = `<div class="mt-warn"><span>⚠️</span><span><b>Видео канала не загрузились: ${U.esc(err.message)}.</b> Канал можно открыть <a href="${U.esc(this.channelUrl(handle, q))}" target="_blank" rel="noopener">на YouTube ↗</a>. Если скопировать оттуда ссылку на видео и вставить в поиск выше — оно откроется здесь с субтитрами.</span></div>`;
      }
    },

    /**
     * ▶ watch a video in the app's subtitle player: Norwegian subtitles (the bridge; manual ones first, then
     * YouTube's automatic ones — marked as such), the Russian line from the translator, tap a word → card.
     */
    async watch(id, title = '', channel = '') {
      const link = 'https://www.youtube.com/watch?v=' + enc(id);
      let cues = [], note = '', subName = 'без субтитров';
      const busy = UI.busy ? UI.busy('Загружаю субтитры видео…') : null;
      try {
        const c = await Subs.api('yt-captions', { v: id });
        title = title || c.title || ''; channel = channel || c.channel || '';
        cues = c.cues || [];
        if (!cues.length) note = `${U.esc(c.note || 'У этого видео нет норвежских субтитров')} — видео играет без них. Создать субтитры самому приложение здесь не может: YouTube не даёт приложению звук видео (у передач NRK — может). Попробуйте другое видео этого канала.`;
        else if (c.auto) { subName = 'автоматические субтитры YouTube'; note = '<b>Это автоматические субтитры YouTube</b> — их распознала машина, в словах бывают ошибки. Прежде чем учить слово, проверьте его: 🔊, перевод и «✍️ Выбрать…» → редактор со словарями.'; }
        else subName = 'субтитры YouTube (от автора)';
      } catch (err) {
        note = `Субтитры не загрузились: ${U.esc(err.message)}. Видео играет без них.`;
      } finally { if (busy) busy.close(); }
      Subs.openStream({ kind: 'youtube', id, title: title || 'Видео YouTube', channel, link, at: t => `${link}&t=${Math.floor(t)}s`, cues, subName, note });
    },

    /** in-app results (YouTube Data API v3; browser-friendly CORS; cached per query to save the daily quota) */
    async results(el, q, key) {
      try {
        let items = cache.get(q);
        if (!items && quotaOut()) {
          el.innerHTML = '<div class="mt-warn ok">⏳ <span>Бесплатный лимит поисков YouTube на сегодня исчерпан — он обновится завтра сам. Уже найденные слова показываются из памяти; для этого слова — ссылки выше и каналы учителей ниже.</span></div>';
          return;
        }
        if (!items) {
          const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=12&relevanceLanguage=no&safeSearch=moderate&q=${enc(q + ' norsk')}&key=${enc(key)}`;
          const r = await fetch(url);
          const j = await r.json();
          if (!r.ok) {
            const reason = ((((j.error || {}).errors || [])[0]) || {}).reason || '';
            if (r.status === 403 && /quota|rateLimit/i.test(reason + ' ' + ((j.error || {}).message || ''))) {
              markQuotaOut();
              el.innerHTML = '<div class="mt-warn ok">⏳ <span>Бесплатный лимит поисков YouTube на сегодня исчерпан — обновится завтра сам, ничего делать не нужно. Пока работают ссылки выше и каналы учителей ниже; уже найденные слова показываются из памяти.</span></div>';
              return;
            }
            throw new Error((j.error && j.error.message) || 'ошибка ' + r.status);
          }
          items = (j.items || []).filter(x => x.id && x.id.videoId);
          cache.set(q, items);
        }
        if (!items.length) { el.innerHTML = '<div class="small muted">Видео не найдено — попробуйте ссылки выше или каналы учителей.</div>'; return; }
        el.innerHTML = `<div data-yt-player class="yt-player"></div><div class="yt-results">${items.map(x => {
          const s = x.snippet || {};
          const th = ((s.thumbnails || {}).medium || (s.thumbnails || {}).default || {}).url || '';
          return `<a href="https://www.youtube.com/watch?v=${enc(x.id.videoId)}" class="yt-vid" data-act="yt-play" data-id="${U.esc(x.id.videoId)}" title="${U.esc(U.decodeHtml ? U.decodeHtml(s.title) : s.title)}">
            <img src="${U.esc(th)}" alt="" loading="lazy"><span class="yt-vid-t">${s.title || ''}</span><small>${U.esc(s.channelTitle || '')}</small></a>`;
        }).join('')}</div>`;
      } catch (e) {
        el.innerHTML = `<div class="mt-warn">⚠️ <span>YouTube: ${U.esc(e.message)}. Проверьте ключ в Настройках (и что в Google Cloud включён «YouTube Data API v3»). Ссылки выше работают и без ключа.</span></div>`;
      }
    },
  };

  window.YouTube = YouTube;
})();
