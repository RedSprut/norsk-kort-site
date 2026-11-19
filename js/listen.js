/* ============ 🎧 Headphones mode: listen to a deck with the screen off (phone in the pocket) ============
 * Works in the web version (GitHub Pages, iPhone Safari / home-screen app, Android Chrome) without the Mac bridge:
 *  - speech is played through ONE <audio> element that is never left idle (iPhone keeps an audio element playing when
 *    the screen is locked; the browser voice (speechSynthesis) stops there and stalls in a background tab — so it is
 *    only the last resort on a visible Mac/PC page when the audio clips keep failing);
 *  - voice: your cloud voice if set up (Azure / Google Cloud / ElevenLabs / Edge), otherwise the free Google voice;
 *  - pauses are short silent audio clips made right here, so the playlist never "breaks" in the pocket;
 *  - lock screen & headphone buttons: play / pause / next / previous (Media Session);
 *  - 🌑 dark screen: black, touch-locked screen that stays awake (for when the phone must stay on).
 */
(function () {
  const st = () => Store.settings;
  const HEADPHONES = (s = 22, on = false) => `<svg class="ico hp-ico ${on ? 'on' : ''}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <defs><linearGradient id="hpg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b80ff"/><stop offset="1" stop-color="#29c7ff"/></linearGradient></defs>
    <path d="M4 14v-2a8 8 0 0 1 16 0v2" stroke="${on ? 'url(#hpg)' : 'currentColor'}" stroke-width="2" stroke-linecap="round"/>
    <rect x="2.6" y="13" width="5.2" height="8" rx="2.4" fill="${on ? 'url(#hpg)' : 'none'}" stroke="${on ? 'url(#hpg)' : 'currentColor'}" stroke-width="1.8"/>
    <rect x="16.2" y="13" width="5.2" height="8" rx="2.4" fill="${on ? 'url(#hpg)' : 'none'}" stroke="${on ? 'url(#hpg)' : 'currentColor'}" stroke-width="1.8"/></svg>`;

  /* ---------- silence as a real audio clip (WAV), cached by length (made in tts.js) ---------- */
  const silence = ms => TTS.silence(ms);
  const hidden = () => document.visibilityState === 'hidden';
  /** 1:05 · 1:02:03 (the time inside a video) */
  const mss = t => { t = Math.max(0, Math.floor(t || 0)); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), x = String(t % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
  const CLIP_MS = 8000; // one voice clip that takes longer is skipped
  /** iPhone: ask for the "playback" audio session (Safari 17+) — sound goes on with the silent switch and the screen off */
  const audioSession = () => { try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ } };
  /** a promise that gives up after ms (and aborts its request) */
  const timeout = (pr, ms, ctl) => new Promise((res, rej) => {
    const t = setTimeout(() => { try { if (ctl) ctl.abort(); } catch (e) { /* ignore */ } rej(new Error(`голос не ответил за ${ms / 1000} с`)); }, ms);
    pr.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); });
  });
  /** run async jobs, n at a time; a failed job gives null */
  async function pool(n, jobs) {
    const out = new Array(jobs.length);
    let next = 0;
    const run = async () => { while (next < jobs.length) { const k = next++; try { out[k] = await jobs[k](); } catch (e) { out[k] = null; } } };
    await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, run));
    return out;
  }
  /** the free Google voice: ≤200 chars per piece */
  function googleUrls(text, lang, rate) {
    const parts = [];
    let cur = '';
    String(text).split(/(?<=[.!?;,])\s+|\s+(?=\()/).forEach(w => { if ((cur + ' ' + w).trim().length > 190) { if (cur) parts.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
    if (cur) parts.push(cur);
    const tl = lang === 'no' ? 'no' : lang === 'uk' ? 'uk' : 'ru';
    return parts.map(p => `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}&ttsspeed=${rate < 0.8 ? '0.24' : '1'}&q=${encodeURIComponent(p)}`);
  }
  /** text -> audio URL(s): a clip downloaded for offline first (⬇ «Скачать озвучку колоды»), then the cloud voice blob
   *  if set up, otherwise the free Google voice */
  async function speechUrls(text, lang, rate) {
    if (window.ListenX) { try { const u = await ListenX.cache.url(text, lang, rate); if (u) return [u]; } catch (e) { /* not cached */ } }
    const eng = st().ttsEngine;
    if (window.Voices && Voices.isCloud(eng) && Voices.ready(eng)) {
      try { return [await Voices.synth(eng, text, lang, rate)]; } catch (e) { Voices.warn(eng, e); }
    }
    return googleUrls(text, lang, rate);
  }
  /** only words are read: no links, hashtags, code symbols ( \ / | * # _ { } [ ] < > = ~ ^ ` @ ), arrows, bullets, emoji, "...";
   *  punctuation stays only as pauses */
  const clean = s => TTS.clean(String(s || ''))
    .replace(/https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/g, ' ')
    .replace(/#[\p{L}\p{N}_]+/gu, ' ')
    .replace(/[\\/|*#_{}[\]<>=~^`@•·→←↑↓⇄⇒►▶◀✓✔✗✘☑☐§¶†‡%&+$€£]/g, ' ')
    .replace(/[\u{1F000}-\u{1FAFF}☀-➿\u{FE0F}\u{200D}\u{20E3}]/gu, ' ')
    .replace(/\.{2,}|…/g, '. ').replace(/([,.!?;:])\1+/g, '$1').replace(/\s+([,.!?;:])/g, '$1')
    .replace(/\s+/g, ' ').replace(/^[\s–—\-:;,.]+|[\s–—\-:;,]+$/g, '').trim();
  const MORE = (s = 18) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2.1" fill="currentColor"/><circle cx="12" cy="12" r="2.1" fill="currentColor"/><circle cx="19" cy="12" r="2.1" fill="currentColor"/></svg>`;
  const SKIP = (s = 18, back = false) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true" style="${back ? 'transform:scaleX(-1)' : ''}"><path d="M4 5.5v13l8.5-6.5zM12.5 5.5v13l8.5-6.5z" fill="currentColor"/></svg>`;

  const Listen = {
    HEADPHONES,
    p: null, // player state
    opts() {
      return Object.assign({ deckId: '', dir: 'nr', content: 'word', pause: 2, gap: 3, repeat: 1, order: 'seq', loop: true, filter: 'all', dark: false, limit: 0, recallPause: 'auto', recallRepeat: true }, st().listen || {});
    },
    saveOpts(o) { Store.setSetting('listen', o); },

    /** about how many seconds one card takes (the «осталось ~N мин» estimates) */
    perCard(o) {
      if (o.content === 'full') return 14 * Math.max(1, o.repeat || 1);
      if (o.dir === 'recall') return 3.5 + (o.recallPause === 'auto' ? 4 : +o.recallPause || 4) + (o.recallRepeat ? 2.5 : 0) + (+o.gap || 0);
      return (4 + (+o.pause || 0) + (+o.gap || 0)) * Math.max(1, o.repeat || 1);
    },
    /** «🧠 Вспомни сам»: seconds of silence for the learner to say the Norwegian ('auto' — by the answer's length) */
    recallWait(no, o) {
      if (o.recallPause !== 'auto' && +o.recallPause > 0) return +o.recallPause;
      const words = String(no || '').split(/\s+/).filter(Boolean).length;
      return Math.round(Math.min(8, Math.max(2.5, 1.6 + String(no || '').length * 0.1 + words * 0.5)) * 2) / 2;
    },
    /** the card's direction for FSRS when it is graded while listening: Russian first → «rn», otherwise «nr» */
    gradeDir(o) { return o.dir === 'rn' || o.dir === 'recall' ? 'rn' : 'nr'; },
    /* ---------- 🇷🇺 / 🇺🇦 the translation (Settings → «Язык перевода», Store.settings.transLang) ---------- */
    trLang() { return window.Study && Study.trLang ? Study.trLang() : (v => (v === 'uk' || v === 'both' ? v : 'ru'))(st().transLang); },
    /** a card that can be listened to: Norwegian + a translation (Russian or Ukrainian) */
    hasTr(c) { return !!(c && c.no && (String(c.ru || '').trim() || String(c.uk || '').trim())); },
    /** the translation(s) of one thing ({ru, uk}) to say, each with its own voice: 🇷🇺 · 🇺🇦 (no Ukrainian one → the Russian one) ·
     *  🇷🇺+🇺🇦 (Russian, then Ukrainian). first: only the first line of each */
    trPieces(x, first = true) {
      const one = v => { v = String(v || ''); return (first ? v.split('\n')[0] : v).trim(); };
      const ru = one(x && x.ru), uk = one(x && x.uk), l = this.trLang();
      if (l === 'uk') return uk ? [['uk', uk]] : ru ? [['ru', ru]] : [];
      if (l === 'both') return [ru && ['ru', ru], uk && uk !== ru && ['uk', uk]].filter(Boolean);
      return ru ? [['ru', ru]] : uk ? [['uk', uk]] : [];
    },
    /** the translation as one line to show («Сейчас играет», the lock screen): «перевод» · «переклад» · «перевод / переклад» */
    trLine(c) { return this.trPieces(c).map(([, t]) => t).join(' / '); },
    /** playlist items for one card: [{lang, text, after?}] according to the options (after = seconds of silence after it) */
    cardItems(c, o) {
      // a piece of any text (Telegram post, book page): read as it is, each language with its own voice
      if (c.raw) return TTS.segments(c.raw, o.dir === 'no' ? 'no' : 'all').slice(0, 80).map(s => ({ lang: s.lang, text: clean(s.text) })).filter(s => s.text);
      const no = clean(String(c.no).split('\n')[0]);
      const trs = this.trPieces(c).map(([lang, t]) => ({ lang, text: clean(t) })).filter(x => x.text);
      let items = [];
      if (o.dir === 'recall') {
        // 🇷🇺/🇺🇦 the meaning → silence: say the Norwegian yourself → 🇳🇴 the answer (→ once more)
        trs.forEach((x, k) => items.push(k === trs.length - 1 ? Object.assign({}, x, { after: this.recallWait(no, o) }) : Object.assign({}, x)));
        if (no) items.push({ lang: 'no', text: no, after: o.recallRepeat ? 1.2 : 0.8 });
        if (no && o.recallRepeat) items.push({ lang: 'no', text: no });
      } else {
        const N = no ? [{ lang: 'no', text: no }] : [];
        const one = o.dir === 'rn' ? trs.concat(N) : o.dir === 'no' ? N : N.concat(trs);
        for (let r = 0; r < Math.max(1, o.repeat); r++) items = items.concat(one.map(x => Object.assign({}, x)));
      }
      if (o.content === 'full') {
        // the whole back side: forms, examples, description — every piece with its own voice; translations in the chosen language(s)
        const parts = [];
        const add = (lang, t) => { t = clean(t); if (t) parts.push({ lang, text: t }); };
        (c.forms || []).forEach(f => { add('no', `${f.label ? f.label + ': ' : ''}${f.no}`); this.trPieces({ ru: f.ru, uk: f.uk || (((c.formsTr || {})['f:' + f.no] || {}).uk) }).forEach(([l, t]) => add(l, t)); });
        (c.examples || []).forEach(x => { add('no', x.no); this.trPieces(x).forEach(([l, t]) => add(l, t)); });
        // description / example: mixed texts — each piece gets its language (Russian / Ukrainian told apart in tts.js)
        TTS.segments([c.description, c.example, this.trLang() === 'uk' && c.exampleUk ? c.exampleUk : c.exampleRu, this.trLang() === 'both' ? c.exampleUk : ''].filter(Boolean).join('\n'), 'all')
          .forEach(s => add(s.lang, s.text));
        items = items.concat(parts.slice(0, 40));
      }
      return items;
    },
    cards(o) {
      let cards = Store.cards(o.deckId || null).filter(c => this.hasTr(c));
      const now = Date.now();
      if (o.filter === 'due') cards = cards.filter(c => Store.isDue(c, null, now));
      if (o.filter === 'new') cards = cards.filter(c => Store.status(c) === 'new');
      if (o.filter === 'hard') cards = cards.filter(c => Store.status(c) === 'debt' || Store.isLeech(c));
      if (o.order === 'shuffle') cards = cards.sort(() => Math.random() - 0.5);
      if (o.limit) cards = cards.slice(0, o.limit);
      return cards;
    },

    /* ---------- window ---------- */
    open(deckId) {
      const o = this.opts();
      if (deckId) o.deckId = deckId;
      const decks = Store.decks();
      const eng = st().ttsEngine;
      const cloud = window.Voices && Voices.isCloud(eng) && Voices.ready(eng);
      const seg = (k, opts) => `<div class="seg-mini" data-lk="${k}">${opts.map(([v, l]) => `<button class="${String(o[k]) === String(v) ? 'active' : ''}" data-v="${v}">${l}</button>`).join('')}</div>`;
      const m = UI.modal({
        title: `${HEADPHONES(26, true)} Слушать вслух`, cls: 'wide listen-modal',
        body: `<div class="lib-intro">${HEADPHONES(22, true)} <span>Выберите колоду и нажмите <b>▶ Слушать</b>. Звучит <b>через динамик</b> (слушайте вместе с друзьями — в автобусе, в парке) <b>или в наушниках</b>, если они подключены. В наушниках можно <b>выключить экран и убрать телефон в карман</b> — слова звучат по кругу; кнопки на наушниках и на экране блокировки: пауза, следующая, предыдущая.</span></div>
          <div class="field-row"><label class="field"><span>Колода</span><select class="input" data-lo="deckId"><option value="">Все колоды</option>${decks.map(d => `<option value="${d.id}" ${d.id === o.deckId ? 'selected' : ''}>${U.esc(d.name)} (${Store.cards(d.id).length})</option>`).join('')}</select></label>
            <label class="field"><span>Какие карточки</span><select class="input" data-lo="filter">${[['all', 'Все'], ['due', 'К повторению'], ['new', 'Новые'], ['hard', 'Трудные и долговые']].map(([v, l]) => `<option value="${v}" ${o.filter === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
          <div class="listen-grid">
            <div><div class="lbl">Что звучит</div>${seg('dir', [['nr', '🇳🇴 → 🇷🇺'], ['rn', '🇷🇺 → 🇳🇴'], ['recall', '🧠 Вспомни сам'], ['no', 'Только 🇳🇴']])}</div>
            <div data-lrecall><div class="lbl">🧠 Пауза, чтобы сказать по-норвежски</div>${seg('recallPause', [[2, '2 с'], [4, '4 с'], [6, '6 с'], ['auto', 'Авто']])}
              <div class="tiny muted" style="margin-top:4px">Сначала звучит перевод — вы вслух говорите норвежское слово — потом правильный ответ. «Авто» — дольше для длинных слов.</div></div>
            <div><div class="lbl">Содержание</div>${seg('content', [['word', 'Слово и перевод'], ['full', 'Вся карточка с пояснениями']])}</div>
            <div><div class="lbl">Пауза перед переводом</div>${seg('pause', [[1, '1 с'], [2, '2 с'], [3, '3 с'], [5, '5 с']])}</div>
            <div><div class="lbl">Пауза между карточками</div>${seg('gap', [[1, '1 с'], [3, '3 с'], [5, '5 с'], [8, '8 с']])}</div>
            <div><div class="lbl">Повторить каждое слово</div>${seg('repeat', [[1, '1×'], [2, '2×'], [3, '3×']])}</div>
            <div><div class="lbl">Порядок</div>${seg('order', [['seq', 'По порядку'], ['shuffle', 'Вперемешку']])}</div>
          </div>
          <div class="row" style="gap:18px;flex-wrap:wrap;margin-top:6px">${UI.switchHtml('l-loop', o.loop, '🔁 По кругу (когда закончится — заново)')}<span data-lrecall>${UI.switchHtml('l-rrep', o.recallRepeat, '🧠 Повторить ответ ещё раз')}</span>${UI.switchHtml('l-dark', o.dark, '🌑 Тёмный экран (экран не гаснет, но чёрный и заблокирован от касаний)')}</div>
          <div class="small muted" style="margin-top:6px">Голос: ${cloud ? `<b>${U.esc(Voices.ENGINES[eng].name)}</b>` : '<b>Google</b> (бесплатно, нужен интернет)'} · скорость — как в панели озвучки · <a href="#" data-lvoices>выбрать голос ›</a>
            <br>${this.canRender() ? '✅ Колода собирается в аудиофайлы: первые 10 карточек звучат через несколько секунд, остальное готовится, пока вы слушаете — надёжно и с выключенным экраном.'
              : '💡 Системный голос телефона замолкает при выключенном экране, поэтому звучит голос Google. На iPhone для кармана откройте приложение <b>во вкладке Safari</b> (в приложении на экране «Домой» iOS может ставить паузу) — или подключите облачный голос (Azure бесплатно 500 000 символов в месяц): тогда колода собирается в аудиофайлы и работает надёжнее.'}</div>
          <details class="small listen-tips"><summary>📱 Чтобы звук не прерывался с выключенным экраном</summary>
            <b>iPhone:</b> откройте приложение во <b>вкладке Safari</b> (или Chrome) — не с иконки на экране «Домой»: там iOS может ставить паузу (если колода собирается в аудиофайлы — работает и там). Нажмите ▶ при включённом экране, затем заблокируйте. Если звук останавливается — выключите режим энергосбережения. Все браузеры на iPhone в Норвегии работают на движке Safari, поэтому другой браузер не поможет.<br>
            <b>Android:</b> используйте <b>Chrome</b>. Настройки → Приложения → Chrome → Батарея → «Без ограничений». На Samsung ещё уберите Chrome из «Спящих приложений» и выключите «Переводить неиспользуемые приложения в сон».</details>
          <div class="row" style="gap:8px;margin-top:10px"><button class="btn primary lg" data-lgo>▶ Слушать</button><span class="small muted" data-lcount></span></div>`,
      });
      const read = () => {
        m.$$('[data-lk]').forEach(g => { const b = g.querySelector('.active'); if (b) o[g.dataset.lk] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; });
        o.deckId = m.$('[data-lo="deckId"]').value; o.filter = m.$('[data-lo="filter"]').value;
        o.loop = m.$('[data-key="l-loop"]').checked; o.dark = m.$('[data-key="l-dark"]').checked; o.recallRepeat = m.$('[data-key="l-rrep"]').checked;
        m.$$('[data-lrecall]').forEach(x => { x.hidden = o.dir !== 'recall'; });
        return o;
      };
      const count = () => { const n = this.cards(read()).length; m.$('[data-lcount]').textContent = `${U.cards(n)} · примерно ${Math.max(1, Math.round(n * this.perCard(o) / 60))} мин на круг`; };
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-lk] button');
        if (b) { b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b)); count(); return; }
        if (e.target.closest('[data-lvoices]')) { e.preventDefault(); m.close(); App.go('settings'); }
      });
      m.el.addEventListener('change', count);
      count();
      m.$('[data-lgo]').onclick = () => {
        this.prime();
        const opt = read();
        this.saveOpts(opt);
        const cards = this.cards(opt);
        if (!cards.length) { UI.toast('В этой колоде нет карточек для прослушивания', 'warn'); return; }
        m.close();
        this.start(cards, opt);
      };
    },

    /**
     * listen to ANY texts (Telegram posts, a book…): pieces = [{ title, text }]. Same player: screen off, loop, headphone buttons.
     */
    startText(title, pieces, extra = {}) {
      const list = pieces.filter(x => x && String(x.text || '').trim()).map((x, i) => ({ id: 'raw' + i, no: (x.title || String(x.text).slice(0, 60)), ru: '', raw: String(x.text).slice(0, 4000), page: x.page || 0 }));
      if (!list.length) { UI.toast('Здесь нечего читать', 'warn'); return; }
      const o = Object.assign({}, this.opts(), { deckId: '', content: 'word', pause: 1, gap: 2, repeat: 1, order: 'seq', loop: true, noRender: true }, extra, { srcTitle: title });
      if (o.dir === 'recall' || o.dir === 'rn') o.dir = 'nr'; // a text is read as it is
      this.start(list, o);
      this.p.deck = { name: title };
      this.updateMeta(true);
      UI.toast(`🎧 ${title}: ${list.length} ${U.plural(list.length, ['часть', 'части', 'частей'])} — можно слушать через динамик или в наушниках`, 'good', 3500);
    },
    /**
     * 🎬 a queue of media files (an author's Telegram videos…) played one after another through the same <audio>
     * element: items = [{ id, no: caption, ru: date · length, media: url, art: picture url, sec }]. Now Playing, the
     * bar, the dark screen, the sleep timer, ⏮ ⏭ of the lock screen / headphones work as for decks; the place inside
     * a video is remembered (ListenX.savePos). extra: { mediaKey (where it is remembered), at (start here), loop }.
     */
    startMedia(title, items, extra = {}) {
      const list = (items || []).filter(x => x && x.media).map(x => Object.assign({}, x, { no: String(x.no || '🎬'), ru: String(x.ru || '') }));
      if (!list.length) { UI.toast('Здесь нечего слушать', 'warn'); return null; }
      const o = Object.assign({}, this.opts(), { deckId: '', filter: 'all', content: 'word', dir: 'nr', order: 'seq', loop: false, noRender: true, dark: false, limit: 0 },
        extra, { media: true, srcTitle: title, mediaRate: extra.mediaRate || this.mediaRate() });
      o.mediaAudio = /^(tga|ac):/.test(o.mediaKey || ''); // 🎵 Telegram audio (js/tgaudio.js), 🎧 audio courses (js/audiocourse.js): «записи», not «видео»
      delete o.at;
      this.start(list, o, extra.at != null ? extra.at : null);
      if (!this.p) return null;
      this.p.deck = { name: title };
      this.updateMeta(true);
      return this.p;
    },
    /** 🎬 speed of the media queue (kept on this device) */
    mediaRate() { const r = +(st().listenMediaRate || 1); return r >= 0.5 && r <= 2 ? r : 1; },
    setMediaRate(r) {
      Store.setSetting('listenMediaRate', r);
      const p = this.p; if (!p || !p.o.media) return;
      p.o.mediaRate = r;
      try { p.audio.defaultPlaybackRate = r; p.audio.playbackRate = r; if ('preservesPitch' in p.audio) p.audio.preservesPitch = true; } catch (e) { /* ignore */ }
      this.position(); this.bar();
    },
    /** 🎬 ±sec inside the video that plays now */
    seekBy(sec) {
      const p = this.p; if (!p || !p.o.media || !p.cur || !p.cur.media) return;
      const a = p.audio, d = isFinite(a.duration) ? a.duration : Infinity;
      try { a.currentTime = Math.max(0, Math.min(d - 0.5, (a.currentTime || 0) + sec)); } catch (e) { /* not loaded yet */ }
      this.position();
      document.dispatchEvent(new CustomEvent('listen-state'));
    },

    /* ---------- the deck as audio FILES made right here (most reliable with the screen locked on iPhone) ----------
     * Changing the audio track while locked fails in iPhone home-screen apps (WebKit bug 261858) and every network clip
     * is a chance to stall, so words + pauses are rendered into WAV files (16 kHz mono) — progressively: the first
     * 10 cards are ready in seconds and play at once, the next part is made while the current one plays (parts grow
     * 10 → 20 → 40 cards, so with the screen off the track changes only every few minutes). Any deck size, loops.
     * Needs speech as audio data: a cloud voice (Azure / Google Cloud / ElevenLabs / Edge) or the Mac bridge (Google voice). */
    canRender(o) {
      const eng = st().ttsEngine;
      // a deck whose voice is downloaded (⬇ offline) is made from the saved clips — no network, no cloud voice needed
      if (o && window.ListenX && ListenX.cache.complete(o.deckId)) return true;
      // Piper speaks only Norwegian: the Russian parts need the Google voice through the bridge — without it, no single file
      return !!(window.Voices && Voices.isCloud(eng) && Voices.ready(eng) && (eng !== 'piper' || (window.AI && AI.bridge.up))) || !!(window.AI && AI.bridge.up);
    },
    audioCtx() {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      try { return new Ctx({ sampleRate: 16000 }); } catch (e) { return new Ctx(); }
    },
    /** one phrase as PCM samples (cloud voice, otherwise the Google voice through the bridge); every request ≤ 8 s */
    async clipPcm(p, it, rate) {
      const eng = st().ttsEngine;
      const dec = async ab => (await timeout(p.ctx.decodeAudioData(ab), CLIP_MS)).getChannelData(0);
      // ⬇ downloaded for offline: no request at all
      if (window.ListenX) { const b = await ListenX.cache.get(it.text, it.lang, rate).catch(() => null); if (b) return dec(await b.arrayBuffer()); }
      if (window.Voices && Voices.isCloud(eng) && Voices.ready(eng)) {
        try { return await dec(await (await fetch(await timeout(Voices.synth(eng, it.text, it.lang, rate), CLIP_MS))).arrayBuffer()); } catch (e) { /* the Google voice below */ }
      }
      if (!(window.AI && AI.bridge.up)) throw new Error('голос не ответил');
      const out = [];
      for (const url of googleUrls(it.text, it.lang, rate)) {
        const ctl = window.AbortController ? new AbortController() : null;
        const ab = await timeout(fetch('/api/proxy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, method: 'GET' }), signal: ctl ? ctl.signal : undefined })
          .then(r => { if (!r.ok) throw new Error('голос не ответил'); return r.arrayBuffer(); }), CLIP_MS, ctl);
        out.push(await dec(ab));
      }
      if (out.length === 1) return out[0];
      const all = new Float32Array(out.reduce((n, a) => n + a.length, 0));
      out.reduce((o, a) => (all.set(a, o), o + a.length), 0);
      return all;
    },
    /** render cards [part.start, part.end) into one WAV: 4 requests at a time */
    async renderPart(p, part) {
      const o = p.o, ctx = p.ctx || (p.ctx = this.audioCtx()), sr = ctx.sampleRate, rate = TTS.currentRate();
      const plan = p.cards.slice(part.start, part.end).map(c => this.cardItems(c, o));
      const flat = [].concat(...plan);
      let ok = 0, bad = 0, done = 0;
      const pcm = await pool(4, flat.map(it => async () => {
        // the voice does not answer at all -> stop early (do not build a file of pure silence)
        if (p.dead || (!ok && bad >= 3)) throw new Error('стоп');
        try { const a = await this.clipPcm(p, it, rate); ok++; return a; } catch (e) { bad++; throw e; } finally { done++; if (part.progress) part.progress(done, flat.length); }
      }));
      if (p.dead) throw new Error('отменено');
      if (flat.length && !ok) throw new Error('голос не отвечает');
      const pieces = [], cues = [];
      let len = 0, j = 0;
      const sil = sec => { const n = Math.round(sr * sec); pieces.push(n); len += n; }; // a number = that many samples of silence
      plan.forEach((items, k) => {
        cues.push({ t: len / sr, i: part.start + k });
        items.forEach((it, n) => {
          const a = pcm[j++];
          if (a) { pieces.push(a); len += a.length; }
          sil(it.after != null ? it.after : items[n + 1] && items[n + 1].lang !== it.lang ? o.pause : 0.8);
        });
        sil(o.gap);
      });
      // the master: 16-bit samples at the voice's own loudness (silence = the zeros the array already has);
      // the WAV that plays is made from it with the volume baked in (encodePart) — the iPhone ignores audio.volume
      const pcm16 = new Int16Array(len), voiced = [];
      let off = 0;
      for (const c of pieces) {
        if (typeof c === 'number') { off += c; continue; }
        voiced.push([off / sr, (off + c.length) / sr]);
        for (let k = 0; k < c.length; k++) pcm16[off++] = Math.max(-1, Math.min(1, c[k])) * 0x7fff;
      }
      part.cues = cues; part.seconds = len / sr; part.pcm = pcm16; part.sr = sr; part.voiced = voiced;
      this.encodePart(part, window.ListenX ? ListenX.bakeGain() : 1);
    },
    /** the master samples → a WAV blob with the gain g baked in (soft limiter above 1, so «громче» never crackles) */
    encodePart(part, g) {
      const len = part.pcm.length, sr = part.sr;
      const buf = new ArrayBuffer(44 + len * 2), v = new DataView(buf);
      const w = (off, s) => { for (let k = 0; k < s.length; k++) v.setUint8(off + k, s.charCodeAt(k)); };
      w(0, 'RIFF'); v.setUint32(4, 36 + len * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, len * 2, true);
      const out = new Int16Array(buf, 44, len);
      if (Math.abs(g - 1) < 0.001) out.set(part.pcm);
      else for (let k = 0; k < len; k++) out[k] = Listen.soft(part.pcm[k] / 0x7fff * g) * 0x7fff;
      const old = part.url;
      part.gain = g;
      part.blob = new Blob([buf], { type: 'audio/wav' });
      part.url = URL.createObjectURL(part.blob);
      if (old) URL.revokeObjectURL(old);
    },
    /** gain with a soft knee: unchanged up to 0.8, then rounded off below 1 (no hard clipping) */
    soft(y) { const a = Math.abs(y); return a <= 0.8 ? y : Math.sign(y) * (0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2)); },
    /** the volume changed: the rendered audio that plays now is made again from its master and continues at the same
     *  place (the screen is on: the slider, a voice command or the dark-screen menu); the other parts on their turn */
    rebake() {
      const p = this.p; if (!p || !p.rendered || !window.ListenX) return;
      const g = ListenX.bakeGain(), a = p.audio;
      const part = p.loaded >= 0 && p.parts[p.loaded];
      p.parts.forEach(x => { if (x && x !== part && x.pcm && x.gain !== g) this.encodePart(x, g); });
      if (!part || !part.pcm || part.gain === g) return;
      const t = a.currentTime || 0;
      this.encodePart(part, g);
      this.self(p);
      p.seekTo = t;
      a.src = part.url;
      a.addEventListener('loadedmetadata', () => { if (p.seekTo != null) { try { a.currentTime = p.seekTo; } catch (e) { /* ignore */ } } p.seekTo = null; this.position(); }, { once: true });
      try { a.currentTime = t; } catch (e) { /* on loadedmetadata */ }
      if (p.playing) a.play().catch(() => {});
    },
    /** is our own voice speaking right now? (voice commands ignore what they hear meanwhile — the speaker's echo) */
    speaking() {
      const p = this.p;
      const sys = !!(window.speechSynthesis && speechSynthesis.speaking) || (window.TTS && TTS.state() === 'playing');
      if (!p || !p.playing || p.audio.paused) return sys;
      if (p.voice) return sys;
      if (p.rendered) {
        const part = p.loaded >= 0 && p.parts[p.loaded];
        if (!part || !part.voiced) return false;
        const t = p.audio.currentTime;
        return part.voiced.some(([x, y]) => t >= x - 0.1 && t <= y + 0.35);
      }
      return !!(p.cur && !p.cur.silent);
    },
    /** part ci of the session (starts rendering it the first time it is asked for) */
    part(p, ci) {
      let part = p.parts[ci];
      if (part) return part;
      part = p.parts[ci] = { ci, start: p.bounds[ci].start, end: p.bounds[ci].end };
      if (!p.played) part.progress = (n, all) => { const t = document.querySelector('#listen-bar [data-ln]'); if (t && this.p === p && p.loaded < 0) t.textContent = `Готовлю аудио… ${n}/${all} — экран уже можно выключить`; };
      part.promise = this.renderPart(p, part).catch(e => { part.err = e; });
      return part;
    },
    partOf(p, g) { const k = p.bounds.findIndex(b => g >= b.start && g < b.end); return k < 0 ? 0 : k; },
    /** long decks: keep only the parts around the current one (and the first, for the loop) */
    trim(p) {
      const c = p.want.ci, keep = [c - 1, c, c + 1, 0];
      p.parts.forEach((x, k) => { if (x && x.url && !keep.includes(k) && k !== p.loaded) { URL.revokeObjectURL(x.url); delete p.parts[k]; } });
    },
    startRendered(cards, o, at = 0) {
      this.stop(true); TTS.stop();
      const audio = this.takeAudio();
      audio.loop = false;
      const deck = o.deckId ? Store.deck(o.deckId) : null;
      const bounds = [];
      for (let s = 0, k = 0; s < cards.length; k++) { const n = k === 0 ? 10 : k === 1 ? 20 : 40; bounds.push({ start: s, end: Math.min(cards.length, s + n) }); s += n; }
      const p = this.p = { cards, o, i: at, audio, playing: true, userPaused: false, deck, rendered: true, bounds, parts: [], loaded: -1, want: null, selfUntil: 0 };
      this.mediaSession();
      this.wire(p);
      audio.addEventListener('timeupdate', () => {
        if (this.p !== p || p.loaded < 0 || p.seekTo != null) return;
        const part = p.parts[p.loaded]; if (!part || !part.cues) return;
        let k = 0; for (let j = 0; j < part.cues.length; j++) if (part.cues[j].t <= audio.currentTime + 0.05) k = j;
        const g = part.cues[k].i;
        if (g !== p.i) { p.i = g; p.want = { ci: p.loaded, card: g }; this.updateMeta(); this.position(); }
      });
      audio.addEventListener('ended', () => {
        if (this.p !== p) return;
        if (p.loaded < 0) return this.seat(p); // a waiting silence ended: is the part ready now?
        let ci = p.loaded + 1;
        if (ci >= p.bounds.length) {
          if (!o.loop) { p.finished = true; this.stop(); UI.toast('🎧 Колода прослушана', 'good'); return; }
          ci = 0;
        }
        p.want = { ci, card: p.bounds[ci].start };
        this.seat(p);
      });
      // a rendered file that does not load (WebKit, rarely): load it once more from a fresh URL, then phrase by phrase
      audio.addEventListener('error', () => {
        const part = p.loaded >= 0 && p.parts[p.loaded];
        if (this.p !== p || !part || audio.src !== part.url || !audio.error || audio.error.code === 1) return;
        if ((part.reloads = (part.reloads || 0) + 1) > 2) return this.renderFailed(p, { err: new Error('файл не воспроизводится') });
        const t = audio.currentTime || 0;
        URL.revokeObjectURL(part.url); part.url = URL.createObjectURL(part.blob);
        p.loaded = -2; p.want = { ci: part.ci, card: p.i }; this.seat(p);
        if (t > 0.5) { p.seekTo = t; try { audio.currentTime = t; } catch (e) { /* on loadedmetadata */ } }
      });
      this.bar();
      if (o.dark) this.dark(true);
      this.seekCard(p, at);
      this.started(p);
    },
    seekCard(p, g) { p.want = { ci: this.partOf(p, g), card: g }; this.seat(p); },
    /** put p.want (part + card) into the audio element; while the part is not ready, silence keeps the session alive */
    seat(p) {
      if (this.p !== p || !p.want) return;
      const { ci, card } = p.want, a = p.audio;
      const part = this.part(p, ci);
      p.i = card;
      this.self(p);
      if (!part.url) {
        if (part.err) {
          // one more try for a later part (a network blip); the first one falls back to clips at once
          if (p.played && !part.retried) { delete p.parts[ci]; this.part(p, ci).retried = true; return this.seat(p); }
          return this.renderFailed(p, part);
        }
        p.loaded = -1;
        a.src = silence(1000);
        if (p.playing) a.play().catch(() => {});
        if (!part.wait) { part.wait = true; part.promise.then(() => { part.wait = false; if (this.p === p && p.loaded < 0 && p.want.ci === ci) this.seat(p); }); }
        this.bar();
        return;
      }
      const cue = part.cues.find(c => c.i === card) || part.cues[0] || { t: 0 };
      if (p.loaded !== ci && part.pcm && window.ListenX && part.gain !== ListenX.bakeGain()) this.encodePart(part, ListenX.bakeGain());
      if (p.loaded !== ci) {
        a.src = part.url; p.loaded = ci; p.seekTo = cue.t;
        a.addEventListener('loadedmetadata', () => { if (p.seekTo != null) { try { a.currentTime = p.seekTo; } catch (e) { /* ignore */ } } p.seekTo = null; this.position(); }, { once: true });
      }
      try { a.currentTime = cue.t; } catch (e) { /* before metadata: done on loadedmetadata */ }
      if (p.playing) {
        p.played = true;
        a.play().catch(e => { if (this.p === p && e && e.name === 'NotAllowedError') { p.playing = false; this.bar(); } });
      }
      // make the next part while this one plays
      const nx = ci + 1 < p.bounds.length ? ci + 1 : p.o.loop ? 0 : -1;
      if (nx >= 0) this.part(p, nx);
      this.trim(p);
      this.bar();
      this.position();
    },
    renderFailed(p, part) {
      if (this.p !== p) return;
      const paused = !p.playing;
      UI.toast('Не удалось собрать аудио (' + ((part.err && part.err.message) || 'ошибка') + ') — играю по одному слову', 'warn', 5000);
      this.startClips(p.cards, p.o, p.want ? p.want.card : 0);
      if (paused) this.pause();
    },

    /** Safari / iPhone allow sound only right inside a tap: call this FIRST in a click handler (before any await) */
    prime() {
      audioSession();
      try {
        const a = this._primed || new Audio();
        a.setAttribute('playsinline', '');
        a.src = silence(200);
        a.play().catch(() => {});
        this._primed = a;
      } catch (e) { /* ignore */ }
    },
    takeAudio() {
      const a = this._primed || new Audio(); this._primed = null; a.setAttribute('playsinline', '');
      // the chosen output device (Chrome / Edge on computers) and the volume where the browser honours audio.volume
      if (window.ListenX) ListenX.prepAudio(a);
      return a;
    },
    /** our own src change / pause: the 'pause' event that follows is not the system's */
    self(p) { p.selfUntil = Date.now() + 1000; },
    /** paused / resumed by the system (headphones taken out, a call, Siri, another app) — follow it */
    wire(p) {
      const a = p.audio;
      a.addEventListener('pause', () => {
        if (this.p === p && p.playing && !a.ended && Date.now() >= p.selfUntil) { this.pause(); document.dispatchEvent(new CustomEvent('listen-syspause')); }
      });
      a.addEventListener('play', () => { if (this.p === p && !p.playing && Date.now() >= p.selfUntil) this.resume(); });
      /* a system pause that came within a second of our own clip change was taken for ours: while the page is visible,
         an element that stays paused although the player plays is followed (the UI must show the truth). With the
         screen locked nothing changes here — the lock-screen path keeps working exactly as before. */
      p.syncT = setInterval(() => {
        if (this.p !== p) { clearInterval(p.syncT); return; }
        if (!hidden() && p.playing && !p.voice && a.paused && !a.ended && a.getAttribute('src') && Date.now() >= p.selfUntil + 300) {
          if (!p.pausedSince) p.pausedSince = Date.now();
          else if (Date.now() - p.pausedSince > 1200) { p.pausedSince = 0; this.pause(); document.dispatchEvent(new CustomEvent('listen-syspause')); }
        } else p.pausedSince = 0;
      }, 400);
    },

    /* ---------- player ---------- */
    start(cards, o, at) {
      audioSession();
      // ▶ where this source was stopped last time (the player offers «Сначала»)
      let resumed = null;
      if (at == null && window.ListenX) { resumed = ListenX.resumeFor(cards, o); at = resumed ? resumed.at : 0; }
      at = Math.max(0, Math.min(cards.length - 1, at || 0));
      // 🎬 a media queue continues inside the video where it stopped
      if (o.media) o._seek = resumed && resumed.sec > 3 ? { i: at, t: resumed.sec } : null;
      // decks: rendered files (pocket-safe); texts and books start at once, phrase by phrase
      if (!o.noRender && this.canRender(o)) this.startRendered(cards, o, at);
      else this.startClips(cards, o, at);
      if (resumed && this.p) { this.p.resumed = resumed; if (window.ListenX) ListenX.offerResume(this.p); }
      return this.p;
    },
    startClips(cards, o, at = 0) {
      this.stop(true);
      TTS.stop();
      const audio = this.takeAudio();
      audio.preload = 'auto';
      audio.loop = false;
      const deck = o.deckId ? Store.deck(o.deckId) : null;
      const p = this.p = { cards, o, i: Math.min(at, cards.length - 1), k: 0, queue: [], pre: {}, audio, playing: true, userPaused: false, deck, rate: TTS.currentRate(), heard: 0, streak: 0, token: 0, selfUntil: 0 };
      this.mediaSession();
      this.wire(p);
      // only the end of OUR current clip moves on (not the primed silence, not a clip replaced a moment ago)
      audio.addEventListener('ended', () => {
        if (this.p !== p || !p.started || p.voice || !p.cur || audio.src !== p.curSrc) return;
        if (!p.cur.silent) p.streak = 0;
        this.step();
      });
      /* Safari (WebKit) never fires 'ended' for the Google voice stream (no length, duration = Infinity):
         the clip plays to its end and just "stalls". So a clip also counts as finished when its time stops moving. */
      const finishClip = () => { if (this.p === p && p.playing && !p.voice && Date.now() - (p.advAt || 0) > 300) { p.advAt = Date.now(); this.step(); } };
      audio.addEventListener('stalled', () => { if (audio.currentTime > 0.3 && !isFinite(audio.duration)) finishClip(); });
      let lastT = -1, sameFor = 0;
      p.ticker = setInterval(() => {
        if (this.p !== p) { clearInterval(p.ticker); return; }
        if (!p.playing || p.voice || audio.paused || (p.cur && p.cur.media)) { sameFor = 0; lastT = -1; return; } // a video may buffer: never «finished» by a still clock
        const t = audio.currentTime;
        if (t > 0.3 && Math.abs(t - lastT) < 0.01) { sameFor += 300; if (sameFor >= 1200) { sameFor = 0; lastT = -1; finishClip(); } }
        else { sameFor = 0; lastT = t; }
      }, 300);
      audio.addEventListener('playing', () => { if (this.p === p && p.cur && !p.cur.silent) p.streak = 0; });
      audio.addEventListener('error', () => {
        if (this.p !== p || p.voice || !p.cur || audio.src !== p.curSrc) return;
        if (p.cur.silent) this.step(); else this.clipFailed(p, p.cur.media ? (p.o.mediaAudio ? 'запись не воспроизводится' : 'видео не воспроизводится') : 'голос Google не отвечает', true);
      });
      if (o.media) {
        // 🎬 the time inside the video: Now Playing, the lock screen and the remembered place follow it
        let shown = 0, saved = 0;
        audio.addEventListener('timeupdate', () => {
          if (this.p !== p || !p.cur || !p.cur.media) return;
          const now = Date.now();
          if (now - shown > 900) { shown = now; this.position(); document.dispatchEvent(new CustomEvent('listen-state')); }
          if (now - saved > 10000 && window.ListenX) { saved = now; ListenX.savePos(p); }
        });
      }
      this.bar();
      if (o.dark) this.dark(true);
      this.step();
      this.started(p);
    },
    /** a session has started (new or remade with other options): offline clips, volume, the output device, the extras */
    started(p) {
      if (window.ListenX) { try { ListenX.onStart(p); } catch (e) { console.warn('listen extras', e); } }
    },
    /** the playlist of one card: [{url, label, lang} | {url: silence, silent}] (cloud voices: 4 requests at a time) */
    async buildQueue(p, c) {
      const items = this.cardItems(c, p.o);
      const urls = await pool(4, items.map(it => async () => {
        const us = await speechUrls(it.text, it.lang, p.rate);
        // iPhone: audio.volume is ignored — a clip of our own (cloud voice / downloaded) gets the volume baked in
        return window.ListenX ? Promise.all(us.map(u => ListenX.scaleUrl(u))) : us;
      }));
      const q = [];
      items.forEach((it, n) => {
        (urls[n] || []).forEach(u => q.push({ url: u, label: it.text, lang: it.lang }));
        const ms = (it.after != null ? it.after : items[n + 1] && items[n + 1].lang !== it.lang ? p.o.pause : 0.8) * 1000;
        q.push({ url: silence(ms), silent: true, ms });
      });
      q.push({ url: silence(p.o.gap * 1000), silent: true, ms: p.o.gap * 1000 });
      return q;
    },
    /** the playlist of card idx — made once (the next card is made while the current one plays) */
    queueFor(p, idx) {
      const c = p.cards[idx];
      let e = p.pre[idx];
      if (e && e.card === c && !(c && c.media && e.url !== c.media)) return e;
      if (c && c.media) {
        // 🎬 one file = the whole «card» (no voice to make)
        const one = url => [{ url, media: true, label: c.no, ms: (c.sec || 0) * 1000 }];
        e = p.pre[idx] = { card: c, url: c.media, q: null };
        // 🎵 a Telegram audio (js/tgaudio.js): the file saved on this device, or the .m4a Safari needs — found first
        if (c.tg && c.tg.audio && window.TgAudio) e.promise = TgAudio.resolveUrl(c).catch(() => c.media).then(u => (e.q = one(u || c.media)));
        // 🎧 a lesson of an audio course (js/audiocourse.js): the file kept inside the app (Cache Storage → blob: URL)
        else if (/\/__nk_audio\/course\//.test(c.media) && window.AudioCourse) e.promise = AudioCourse.resolveUrl(c).catch(() => c.media).then(u => (e.q = one(u || c.media)));
        else { e.q = one(c.media); e.promise = Promise.resolve(e.q); }
        return e;
      }
      e = p.pre[idx] = { card: c, q: null };
      e.promise = this.buildQueue(p, c).catch(() => [{ url: silence(p.o.gap * 1000), silent: true, ms: p.o.gap * 1000 }]).then(q => (e.q = q));
      const keep = [idx, p.i, (p.i + 1) % p.cards.length];
      Object.keys(p.pre).forEach(k => { if (!keep.includes(+k)) delete p.pre[k]; });
      return e;
    },
    /** a clip failed (error / no sound): skip it. The system voice only on a visible Mac/PC page after 3 failures in a row —
     *  it is silent on a locked iPhone and its pauses stall in a background tab */
    clipFailed(p, reason, pad) {
      if (this.p !== p || p.voice) return;
      p.streak = (p.streak || 0) + 1;
      clearTimeout(p.wd);
      if (p.o.media) {
        // 🎬 a video that does not play: the next one (never the system voice); three in a row — stop and say so
        if (p.streak >= 3) { this.pause(); UI.toast(`🎧 ${reason} — проверьте, что мост на Mac запущен`, 'warn', 6000); return; }
        if (!p.playing) return;
        UI.toast(`🎬 ${reason} — включаю следующее`, 'warn', 3500);
        p.queue = []; p.k = 0;
        p.i = (p.i + 1) % p.cards.length;
        if (p.i === 0 && !p.o.loop) { p.finished = true; this.stop(); return; }
        this.step();
        return;
      }
      if (p.streak >= 3 && !hidden() && !TTS.IOS) return this.toVoice(reason);
      if (!p.playing) return;
      // a short silence keeps the audio session alive, then the next clip
      if (pad) this.play(p, { url: silence(1500), silent: true, filler: true, ms: 1500 }, ++p.token);
      else this.step();
    },
    /** switch the running session to the browser/system voice (Safari etc. when the audio clips stay silent) */
    toVoice(reason) {
      const p = this.p; if (!p || p.voice || p.rendered) return;
      p.voice = true; p.vn = 0; p.streak = 0;
      clearTimeout(p.wd);
      // the element loops silence meanwhile: the tab stays the media player (macOS media keys, Control Center)
      const a = p.audio;
      this.self(p);
      a.loop = true; a.src = silence(5000); p.curSrc = a.src; p.cur = { silent: true, keep: true };
      if (p.playing) a.play().catch(() => {});
      if (!this._voiceToast) { this._voiceToast = true; UI.toast(`🔊 ${reason} — читаю голосом системы (экран не выключайте)`, 'warn', 5000); }
      if (p.playing) this.voiceStep();
      this.bar();
    },
    /** back from the system voice to audio clips (the tab went to the background: speech timers stall there) */
    toClips() {
      const p = this.p; if (!p || !p.voice) return;
      p.voice = false; p.vtoken = (p.vtoken || 0) + 1; p.streak = 0;
      TTS.stop();
      p.queue = []; p.k = 0; p.audio.loop = false;
      if (p.playing) this.step();
      this.bar();
    },
    async voiceStep() {
      const p = this.p; if (!p || !p.playing || !p.voice) return;
      const token = p.vtoken = (p.vtoken || 0) + 1;
      const live = () => this.p === p && p.playing && p.voice && p.vtoken === token;
      const items = this.cardItems(p.cards[p.i], p.o);
      this.updateMeta();
      for (let n = p.vn || 0; n < items.length; n++) {
        if (!live()) return;
        p.vn = n;
        await TTS.speak(items[n].text, items[n].lang, { local: true, forceBrowser: true });
        if (!live()) return;
        await new Promise(r => setTimeout(r, (items[n].after != null ? items[n].after : items[n + 1] && items[n + 1].lang !== items[n].lang ? p.o.pause : 0.6) * 1000));
      }
      if (!live()) return;
      await new Promise(r => setTimeout(r, p.o.gap * 1000));
      if (!live()) return;
      p.vn = 0; p.i++;
      if (p.i >= p.cards.length) {
        if (!p.o.loop) { p.finished = true; this.stop(); UI.toast('🎧 Прослушано до конца', 'good'); return; }
        p.i = 0;
      }
      this.voiceStep();
    },
    /** the next clip of the playlist (next card when this one is done) */
    step() {
      const p = this.p; if (!p || !p.playing) return;
      if (p.voice) return this.voiceStep();
      p.started = true;
      const token = ++p.token;
      clearTimeout(p.wd);
      if (p.queue.length && p.k >= p.queue.length) {
        p.heard++; p.queue = []; p.k = 0;
        if (++p.i >= p.cards.length) {
          if (!p.o.loop) { p.finished = true; this.stop(); UI.toast(p.o.media ? (p.o.mediaAudio ? '🎧 Все записи прослушаны' : '🎧 Все видео прослушаны') : '🎧 Колода прослушана', 'good'); return; }
          p.i = 0;
          if (p.o.order === 'shuffle') { p.cards.sort(() => Math.random() - 0.5); p.pre = {}; }
        }
      }
      if (!p.queue.length) {
        const e = this.queueFor(p, p.i);
        if (!e.q) {
          // the voice is still being made: silence keeps the audio element busy (an idle page stops on a locked iPhone)
          e.promise.then(() => { if (this.p === p && p.token === token && p.playing && !p.voice) this.step(); });
          return this.play(p, { url: silence(1000), silent: true, filler: true, ms: 1000 }, token);
        }
        p.queue = e.q; p.k = 0;
        this.updateMeta();
        if (p.cards.length > 1) this.queueFor(p, (p.i + 1) % p.cards.length); // make the next card while this one plays
      }
      return this.play(p, p.queue[p.k++], token);
    },
    play(p, it, token) {
      const a = p.audio;
      p.cur = it;
      this.self(p);
      a.loop = false;
      a.src = it.url;
      p.curSrc = a.src;
      if (!it.silent && st().ttsEngine === 'eleven') a.playbackRate = 1;
      if (it.media) {
        const r = p.o.mediaRate || 1;
        try { a.defaultPlaybackRate = r; a.playbackRate = r; if ('preservesPitch' in a) a.preservesPitch = true; } catch (e) { /* ignore */ }
        const sk = p.o._seek;
        if (sk && sk.i === p.i && sk.t > 0) {
          p.o._seek = null;
          const go = () => { if (this.p === p && p.cur === it) { try { a.currentTime = sk.t; } catch (e) { /* ignore */ } } };
          if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once: true });
        }
      }
      a.play().catch(e => {
        // only a real "not allowed" stops the session; a broken clip is skipped by the 'error' handler
        if (this.p === p && p.token === token && e && e.name === 'NotAllowedError') { p.playing = false; this.bar(); }
      });
      // watchdog: "playing" but no sound for 8 s (time does not move) -> skip it; a silence whose 'ended' got lost -> go on
      // (a video from the network may take a while to start: 45 s)
      if (!it.silent) p.wd = setTimeout(() => { if (this.p === p && p.playing && !p.voice && p.token === token && a.currentTime <= 0.05 && (!it.media || a.readyState < 3)) this.clipFailed(p, it.media ? (p.o.mediaAudio ? 'запись не загружается' : 'видео не загружается') : 'нет звука от голоса Google', false); }, it.media ? 45000 : CLIP_MS);
      else p.wd = setTimeout(() => { if (this.p === p && p.playing && !p.voice && p.token === token) this.step(); }, (it.ms || 5000) + 4000);
      this.bar();
    },
    toggle() { const p = this.p; if (!p) return; if (p.playing) this.pause(); else this.resume(); },
    pause() {
      const p = this.p; if (!p) return;
      p.playing = false; p.userPaused = true; clearTimeout(p.wd);
      this.self(p);
      if (p.voice) { p.vtoken = (p.vtoken || 0) + 1; TTS.stop(); }
      p.audio.pause();
      this.bar(); this.position();
      if ('mediaSession' in navigator && TTS.msOwner === 'listen') navigator.mediaSession.playbackState = 'paused';
    },
    resume() {
      const p = this.p; if (!p) return;
      if (TTS.player) TTS.stop(); // one voice at a time: the card reader stops
      if (TTS.msOwner !== 'listen') this.mediaSession();
      p.playing = true; p.userPaused = false;
      this.self(p);
      const a = p.audio;
      if (p.voice) { a.play().catch(() => {}); this.voiceStep(); }
      else if (p.rendered) { if (p.loaded >= 0) { p.played = true; a.play().catch(() => {}); } else this.seat(p); }
      else if (p.cur && a.getAttribute('src') && !a.ended) a.play().catch(() => {});
      else this.step();
      this.bar(); this.position();
      if ('mediaSession' in navigator && TTS.msOwner === 'listen') navigator.mediaSession.playbackState = 'playing';
    },
    /** go straight to piece n (0-based) — e.g. a book page */
    goTo(n) {
      const p = this.p; if (!p) return;
      n = U.clamp(n, 0, p.cards.length - 1);
      if (TTS.player) TTS.stop();
      p.playing = true; p.userPaused = false;
      if (p.rendered) { this.seekCard(p, n); return; }
      p.i = n; p.vn = 0; p.queue = []; p.k = 0; clearTimeout(p.wd);
      if (p.voice) { p.vtoken = (p.vtoken || 0) + 1; TTS.stop(); this.voiceStep(); this.bar(); return; }
      this.step();
    },
    jump(d) { const p = this.p; if (!p) return; return this.goTo((p.i + d + p.cards.length) % p.cards.length); },
    /** ⏮ from the very beginning */
    restart() { return this.goTo(0); },
    /** "стр. 12 из 66 · прочитано 11 · осталось 54" (books) or "3 / 21" */
    progressText() {
      const p = this.p; if (!p) return '';
      const c = p.cards[p.i] || {};
      if (c.page && p.o.totalPages) {
        const total = p.o.totalPages;
        return `стр. ${c.page} из ${total} · прочитано ${c.page - 1} · осталось ${total - c.page}`;
      }
      const total = p.cards.length;
      if (p.o.media) {
        const a = p.audio, on = p.cur && p.cur.media;
        const d = on && isFinite(a.duration) ? a.duration : c.sec || 0;
        return `${p.i + 1} / ${total}${on ? ` · ${mss(a.currentTime || 0)}${d ? ' из ' + mss(d) : ''}` : ''}`;
      }
      return total ? `${p.i + 1} / ${total}${p.rendered && p.loaded < 0 && !p.played ? ' · готовлю аудио…' : ''}` : '';
    },
    /** a player row inside any window (book, Telegram…): ⏮ ⏪ ▶/❚❚ ⏩ ⏹ + "1/21 · title" — follows the real state */
    miniPlayer(el) {
      if (!el) return;
      el.classList.add('mini-player');
      el.innerHTML = `<button class="media-btn" data-mp="restart" title="Сначала">${UI.icon('restart', 18)}</button><button class="media-btn" data-mp="prev" title="Назад">${SKIP(18, true)}</button>
        <button class="media-btn main" data-mp="toggle" title="Пауза / продолжить"></button><button class="media-btn" data-mp="next" title="Дальше">${SKIP(18)}</button>
        <button class="media-btn" data-mp="stop" title="Стоп">${UI.icon('stop', 18)}</button>
        <div class="mp-info"><span class="mp-label" data-mpl></span><div class="mp-bar"><i data-mpb></i></div></div>
        <button class="btn sm ghost mp-out" data-mp="out" title="Где слушать: в наушниках или через динамик">🔈 Динамик / 🎧 наушники</button>
        <button class="media-btn mp-more" data-mp="more" title="Громкость, таймер сна, «знаю / не знаю»" aria-label="Ещё: громкость, таймер сна">${MORE(18)}</button>`;
      const paint = () => {
        const p = this.p;
        el.hidden = !p;
        if (!p) return;
        const out = el.querySelector('[data-mp="out"]');
        if (out && window.ListenX) out.textContent = ListenX.outLabel();
        const b = el.querySelector('[data-mp="toggle"]');
        b.innerHTML = UI.icon(p.playing ? 'pause' : 'play', 22);
        b.classList.toggle('playing', !!p.playing);
        el.querySelector('[data-mpl]').textContent = this.progressText();
        const c = p.cards[p.i] || {}, total = p.o.totalPages || p.cards.length;
        const pos = c.page && p.o.totalPages ? c.page : p.i + 1;
        el.querySelector('[data-mpb]').style.width = total ? Math.round(pos / total * 100) + '%' : '0';
      };
      el.addEventListener('click', e => {
        const a = e.target.closest('[data-mp]'); if (!a) return;
        ({ restart: () => this.restart(), prev: () => this.jump(-1), next: () => this.jump(1), toggle: () => this.toggle(), stop: () => this.stop(), out: () => this.chooseOutput(), more: () => window.ListenX && ListenX.morePop(a) })[a.dataset.mp]();
      });
      document.addEventListener('listen-state', paint);
      paint();
    },
    /** speaker or headphones: «Где слушать?» (and the output device where the browser lets the page choose it) */
    async chooseOutput() {
      if (window.ListenX) return ListenX.where();
      const p = this.p;
      const el = p && p.audio;
      if (el && el.setSinkId && navigator.mediaDevices && navigator.mediaDevices.selectAudioOutput) {
        try { const d = await navigator.mediaDevices.selectAudioOutput(); await el.setSinkId(d.deviceId); UI.toast(`🔈 Звук: ${d.label}`, 'good'); return; } catch (e) { /* cancelled */ }
      }
      UI.modal({
        title: '🔈 Динамик или наушники', cls: 'narrow',
        body: `<p>Звук идёт туда, куда его выводит устройство: <b>если подключены наушники — в наушники, если нет — вслух через динамик</b>.</p>
          <p><b>Mac:</b> строка меню → значок звука 🔊 (или Пункт управления) → «Выход» → выберите «Динамики MacBook» или наушники.</p>
          <p><b>iPhone:</b> Пункт управления → в плеере значок AirPlay ◎ → «iPhone» (динамик) или AirPods / наушники.</p>
          <p><b>Android:</b> шторка уведомлений → в плеере кнопка устройства вывода → «Этот телефон» или наушники.</p>`,
      });
    },
    /** internal = the same listening goes on with a new player (other options, a fallback): the dark screen, the sleep
     *  timer and voice control stay; a real stop remembers the place for «▶ Продолжить» */
    stop(internal) {
      const p = this.p;
      if (p && window.ListenX) { try { ListenX.onStop(p, !!internal); } catch (e) { console.warn('listen extras', e); } }
      this.p = null;
      if (p) {
        p.dead = true; // cancels this session's rendering
        clearTimeout(p.wd); clearInterval(p.ticker); clearInterval(p.syncT); p.vtoken = (p.vtoken || 0) + 1;
        if (p.voice) TTS.stop();
        p.audio.loop = false; p.audio.pause(); p.audio.removeAttribute('src');
        try { p.audio.load(); } catch (e) { /* ignore */ }
        (p.parts || []).forEach(x => { if (x && x.url) URL.revokeObjectURL(x.url); });
        if (p.ctx) try { p.ctx.close(); } catch (e) { /* ignore */ }
      }
      if (!internal) { this.dark(false); this.releaseWake(); }
      const b = document.getElementById('listen-bar'); if (b) b.remove();
      // the lock screen / media keys must not keep driving a player that is gone
      if ('mediaSession' in navigator && TTS.msOwner === 'listen') {
        TTS.msOwner = '';
        const ms = navigator.mediaSession;
        ['play', 'pause', 'nexttrack', 'previoustrack', 'stop', 'seekto', 'seekbackward', 'seekforward'].forEach(a => { try { ms.setActionHandler(a, null); } catch (e) { /* ignore */ } });
        try { ms.metadata = null; ms.playbackState = 'none'; } catch (e) { /* ignore */ }
        try { if (ms.setPositionState) ms.setPositionState(); } catch (e) { /* ignore */ }
      }
      document.dispatchEvent(new CustomEvent('listen-state'));
    },
    updateMeta(force) {
      const p = this.p; if (!p) return;
      const c = p.cards[p.i] || {};
      const no = String(c.no || '').split('\n')[0], ru = c.raw ? '' : this.trLine(c);
      const both = ru ? `${no} — ${ru}` : no;
      if ('mediaSession' in navigator && TTS.msOwner === 'listen') {
        try {
          // a new MediaMetadata only when the card changes (not on every clip: the lock screen would flicker)
          if (force || p.metaI !== p.i || p.metaC !== c) {
            p.metaI = p.i; p.metaC = c;
            const cover = p.deck && p.deck.cover && p.deck.cover.startsWith('data:image/') ? p.deck.cover : '';
            if (p.o.media) {
              // 🎬 the lock screen: the video's caption, the author, «3 / 12», the video's own picture
              navigator.mediaSession.metadata = new MediaMetadata({
                title: no.slice(0, 120), artist: p.deck ? p.deck.name : 'Norsk Kort', album: `Norsk Kort · ${p.i + 1}/${p.cards.length}`,
                artwork: c.art ? [{ src: new URL(c.art, location.href).href, sizes: '320x180', type: 'image/jpeg' }, { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }]
                  : [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
              });
            } else
            navigator.mediaSession.metadata = new MediaMetadata({
              title: both.slice(0, 120), artist: `Norsk Kort · ${p.i + 1}/${p.cards.length}`, album: p.deck ? p.deck.name : 'Все колоды',
              artwork: cover ? [{ src: cover, type: cover.slice(5, cover.indexOf(';')) }]
                : [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
            });
          }
          navigator.mediaSession.playbackState = p.playing ? 'playing' : 'paused';
        } catch (e) { /* old browser */ }
      }
      const t = document.querySelector('#listen-bar [data-lt]');
      if (t) t.innerHTML = `${UI.rich(no)} <span class="ru-text">${U.esc(ru)}</span>`;
      const n = document.querySelector('#listen-bar [data-ln]'); if (n) n.textContent = this.progressText() + (p.voice ? ' · голос системы' : '');
      const d = document.querySelector('.dark-screen [data-dt]'); if (d) d.textContent = both;
      document.dispatchEvent(new CustomEvent('listen-state'));
    },
    /** rendered part: the lock screen / Control Center shows the position inside it */
    position() {
      const p = this.p, ms = navigator.mediaSession;
      if (p && p.o.media && ms && ms.setPositionState && TTS.msOwner === 'listen') {
        const a = p.audio;
        try { if (p.cur && p.cur.media && isFinite(a.duration) && a.duration > 0) ms.setPositionState({ duration: a.duration, position: Math.min(a.duration, Math.max(0, a.currentTime || 0)), playbackRate: a.playbackRate || 1 }); } catch (e) { /* ignore */ }
        return;
      }
      if (!p || !p.rendered || !ms || !ms.setPositionState || TTS.msOwner !== 'listen') return;
      const part = p.loaded >= 0 && p.parts[p.loaded];
      try { if (part && part.seconds) ms.setPositionState({ duration: part.seconds, position: Math.min(part.seconds, Math.max(0, p.audio.currentTime || 0)), playbackRate: 1 }); } catch (e) { /* ignore */ }
    },
    mediaSession() {
      if (!('mediaSession' in navigator)) return;
      const p = this.p, ms = navigator.mediaSession;
      const set = (a, f) => { try { ms.setActionHandler(a, f); } catch (e) { /* not supported */ } };
      TTS.msOwner = 'listen';
      set('play', () => this.resume());
      set('pause', () => this.pause());
      set('nexttrack', () => this.jump(1));
      set('previoustrack', () => this.jump(-1));
      set('stop', () => this.stop());
      // scrubbing works inside a rendered part; ±10 s jumps make no sense for words
      set('seekto', p && p.rendered ? d => { if (this.p === p && p.loaded >= 0) { p.audio.currentTime = Math.max(0, d.seekTime || 0); this.position(); } }
        : p && p.o.media ? d => { if (this.p === p && p.cur && p.cur.media) { p.audio.currentTime = Math.max(0, d.seekTime || 0); this.position(); } } : null);
      // 🎬 inside a video ±15 s make sense (for words they don't)
      set('seekbackward', p && p.o.media ? d => this.seekBy(-((d && d.seekOffset) || 15)) : null);
      set('seekforward', p && p.o.media ? d => this.seekBy((d && d.seekOffset) || 15) : null);
    },
    /** take the lock screen / media keys back (after the card reader has finished) */
    claimSession() { if (!this.p) return; this.mediaSession(); this.updateMeta(true); this.position(); },
    /** floating player bar (visible everywhere in the app) */
    bar() {
      const p = this.p;
      let b = document.getElementById('listen-bar');
      if (!p) { if (b) b.remove(); return; }
      if (!b) {
        b = document.createElement('div'); b.id = 'listen-bar'; b.className = 'listen-bar';
        b.innerHTML = `<button class="lb-open" data-lb="expand" title="Открыть плеер «Сейчас играет»" aria-label="Открыть плеер"><span class="lb-ico">${HEADPHONES(26, true)}</span><span class="lb-text"><b data-lt></b><small data-ln></small></span><svg class="ico lb-up" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg></button>
          <button class="media-btn sm" data-lb="restart" title="Сначала">${UI.icon('restart', 16)}</button><button class="media-btn sm" data-lb="prev" title="Предыдущая">${SKIP(16, true)}</button><button class="media-btn sm main" data-lb="toggle" title="Пауза / продолжить"></button>
          <button class="media-btn sm" data-lb="next" title="Следующая">${SKIP(16)}</button><button class="media-btn sm" data-lb="interp" title="🗣 Переводчик: если к вам обратятся по-норвежски — пауза и перевод в наушники">🗣</button><button class="media-btn sm" data-lb="dark" title="Тёмный экран — для кармана">🌑</button><button class="media-btn sm lb-more" data-lb="more" title="Громкость, таймер сна, «знаю / не знаю», где слушать" aria-label="Ещё: громкость и таймер сна">${MORE(16)}</button><button class="media-btn sm" data-lb="stop" title="Стоп">✕</button>`;
        b.addEventListener('click', e => {
          const a = e.target.closest('[data-lb]'); if (!a) return;
          ({ restart: () => this.restart(), prev: () => this.jump(-1), next: () => this.jump(1), toggle: () => this.toggle(), stop: () => (window.ListenUI ? ListenUI.stopAsk() : this.stop()), dark: () => this.dark(true), interp: () => Interp.toggle(),
            expand: () => { if (window.ListenUI) ListenUI.nowPlaying(); }, more: () => window.ListenX && ListenX.morePop(a) })[a.dataset.lb]();
        });
        document.body.appendChild(b);
      }
      b.querySelector('[data-lb="toggle"]').innerHTML = UI.icon(p.playing ? 'pause' : 'play', 18);
      b.classList.toggle('paused', !p.playing);
      const chip = window.ListenX && ListenX.sleepLeft();
      b.classList.toggle('sleeping', !!chip);
      b.querySelector('[data-lb="more"]').dataset.chip = chip || '';
      this.updateMeta();
      document.dispatchEvent(new CustomEvent('listen-state'));
    },
    /* ---------- 🌑 dark screen: black, touch-locked (pocket-safe), stays awake ----------
     * Ordinary touches do nothing (a phone in the pocket presses the screen all the time). The menu opens only on a
     * deliberate gesture: a DOUBLE TAP, or holding a finger ~1 s (a ring fills up). It hides itself after 5 s. */
    async dark(on) {
      let d = document.querySelector('.dark-screen');
      if (!on) { if (d) { clearTimeout(d._hide); d.remove(); } this.releaseWake(); document.dispatchEvent(new CustomEvent('listen-state')); return; }
      if (!d) {
        d = document.createElement('div'); d.className = 'dark-screen'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Тёмный экран: касания заблокированы');
        d.innerHTML = `<div class="ds-inner">${HEADPHONES(40, true)}<div class="ds-word" data-dt></div>
            <div class="ds-hint">Касания заблокированы — можно положить телефон в карман.<br>Меню: <b>двойное касание</b> или <b>удерживайте палец 1 секунду</b></div></div>
          <svg class="ds-ring" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" class="ds-ring-bg"/><circle cx="40" cy="40" r="34" class="ds-ring-fg" pathLength="100"/></svg>
          <div class="ds-menu" data-dsm hidden></div>`;
        this.darkWire(d);
        document.body.appendChild(d);
      }
      this.updateMeta();
      document.dispatchEvent(new CustomEvent('listen-state'));
      try { if ('wakeLock' in navigator && !this._wake) { this._wake = await navigator.wakeLock.request('screen'); this._wake.addEventListener && this._wake.addEventListener('release', () => { this._wake = null; }); } } catch (e) { /* not allowed */ }
    },
    darkWire(d) {
      const menu = d.querySelector('[data-dsm]'), ring = d.querySelector('.ds-ring');
      let hold = null, lastTap = 0, lastX = 0, lastY = 0, sx = 0, sy = 0;
      const inMenu = e => !menu.hidden && menu.contains(e.target);
      const cancelHold = () => { clearTimeout(hold); hold = null; d.classList.remove('holding'); };
      d.addEventListener('pointerdown', e => {
        if (inMenu(e)) { this.darkMenuKeep(d); return; }
        e.preventDefault();
        // a tap on the black while the menu is open just hides the menu
        if (!menu.hidden) { this.darkMenu(d, false); lastTap = 0; return; }
        const now = Date.now(), x = e.clientX, y = e.clientY;
        if (now - lastTap < 380 && Math.hypot(x - lastX, y - lastY) < 70) { lastTap = 0; cancelHold(); this.darkMenu(d, true); return; }
        lastTap = now; lastX = sx = x; lastY = sy = y;
        ring.style.left = x + 'px'; ring.style.top = y + 'px';
        d.classList.remove('holding'); void ring.getBoundingClientRect(); d.classList.add('holding');
        clearTimeout(hold);
        hold = setTimeout(() => { hold = null; d.classList.remove('holding'); lastTap = 0; this.darkMenu(d, true); }, 1000);
      });
      d.addEventListener('pointermove', e => { if (hold && Math.hypot(e.clientX - sx, e.clientY - sy) > 24) cancelHold(); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => d.addEventListener(t, e => { if (!inMenu(e)) cancelHold(); }));
      d.addEventListener('touchmove', e => { if (!inMenu(e)) e.preventDefault(); }, { passive: false });
      d.addEventListener('contextmenu', e => e.preventDefault());
      menu.addEventListener('input', () => this.darkMenuKeep(d));
      menu.addEventListener('click', e => {
        this.darkMenuKeep(d);
        const b = e.target.closest('[data-ds]'); if (!b) return;
        const act = b.dataset.ds, p = this.p;
        if (act === 'toggle') { this.prime(); this.toggle(); }
        if (act === 'prev') this.jump(-1);
        if (act === 'next') this.jump(1);
        if (act === 'restart') this.restart();
        if (act === 'exit') this.dark(false);
        if (act === 'stop') { menu.querySelector('[data-ds-ask]').hidden = false; b.hidden = true; }
        if (act === 'stop-no') { menu.querySelector('[data-ds-ask]').hidden = true; menu.querySelector('[data-ds="stop"]').hidden = false; }
        if (act === 'stop-yes') { this.stop(); }
        if (p && act !== 'stop' && act !== 'stop-no') this.darkPaint(d);
      });
      d._paint = () => this.darkPaint(d);
      document.addEventListener('listen-state', d._paint);
      const mo = new MutationObserver(() => { if (!d.isConnected) { document.removeEventListener('listen-state', d._paint); mo.disconnect(); } });
      mo.observe(document.body, { childList: true });
    },
    /** the dark-screen menu: ⏯ ⏪ ⏩, ⏮ from the start, ⏹ (asks), знаю / не знаю, volume, sleep timer, exit */
    darkMenu(d, open) {
      const menu = d.querySelector('[data-dsm]');
      clearTimeout(d._hide);
      if (!open) { menu.hidden = true; d.classList.remove('menu-open'); return; }
      const p = this.p, X = window.ListenX;
      const card = p && p.cards[p.i];
      menu.innerHTML = `<div class="ds-m-head"><span class="ds-m-word" data-dsw></span><span class="ds-m-pos" data-dsp></span></div>
        ${p ? `<div class="ds-m-ctl">
            <button class="ds-b" data-ds="prev" title="Предыдущая" aria-label="Предыдущая">${SKIP(26, true)}</button>
            <button class="ds-b main" data-ds="toggle" aria-label="Пауза или продолжить"></button>
            <button class="ds-b" data-ds="next" title="Следующая" aria-label="Следующая">${SKIP(26)}</button></div>
          <div class="ds-m-row"><button class="ds-pill" data-ds="restart">${UI.icon('restart', 16)} Из начала</button>
            <button class="ds-pill ds-stop" data-ds="stop">${UI.icon('stop', 15)} Остановить</button>
            <span class="ds-ask" data-ds-ask hidden>Остановить совсем? <button class="ds-pill ds-stop" data-ds="stop-yes">Да, стоп</button><button class="ds-pill" data-ds="stop-no">Нет</button></span></div>
          ${X && card && !card.raw ? X.gradeHtml('ds') : ''}
          ${X ? X.volumeHtml() : ''}
          ${X ? X.sleepHtml() : ''}` : ''}
        <div class="ds-m-note">🔋 Экран не гаснет — это тратит заряд. В наушниках можно просто заблокировать телефон: звук не прервётся.</div>
        <button class="ds-exit" data-ds="exit">☀️ Выйти из тёмного экрана</button>`;
      menu.hidden = false;
      d.classList.add('menu-open');
      this.darkPaint(d);
      if (X) X.paintAll();
      this.darkMenuKeep(d);
    },
    /** the menu hides itself 5 s after the last touch */
    darkMenuKeep(d) { clearTimeout(d._hide); d._hide = setTimeout(() => this.darkMenu(d, false), 5000); },
    darkPaint(d) {
      const p = this.p, menu = d.querySelector('[data-dsm]');
      if (!menu || menu.hidden) return;
      const t = menu.querySelector('[data-ds="toggle"]'); if (t && p) t.innerHTML = UI.icon(p.playing ? 'pause' : 'play', 34);
      const c = p && p.cards[p.i];
      const w = menu.querySelector('[data-dsw]'); if (w) w.textContent = c ? String(c.raw ? c.no : `${String(c.no).split('\n')[0]} — ${this.trLine(c)}`).slice(0, 90) : 'Ничего не играет';
      const n = menu.querySelector('[data-dsp]'); if (n) n.textContent = p ? this.progressText() + (p.playing ? '' : ' · пауза') : '';
    },
    releaseWake() { try { if (this._wake) this._wake.release(); } catch (e) { /* ignore */ } this._wake = null; },
  };
  /* ---------- 🎧 «Слушать вслух» for ANY block of text ----------
   * <button data-listen-here=".selector" data-title="…">  -> reads the closest .selector (or the element by #id)
   * paragraph by paragraph; buttons and elements marked .no-listen are skipped. */
  Listen.googleUrls = googleUrls;
  Listen.hereBtn = (selector, title = 'Слушать вслух', label = 'Слушать вслух') =>
    `<button class="btn sm listen-btn listen-cta listen-here" data-listen-here="${U.esc(selector)}" data-title="${U.esc(title)}" title="Прочитать вслух — в наушниках или через динамик; можно выключить экран">${HEADPHONES(16, true)} ${U.esc(label)}</button>`;
  Listen.textOf = el => {
    const c = el.cloneNode(true);
    c.querySelectorAll('button, .no-listen, input, select, textarea, script, style, .listen-here').forEach(x => x.remove());
    c.querySelectorAll('br').forEach(b => b.replaceWith('\n'));
    c.querySelectorAll('div, p, li, h1, h2, h3, h4, tr').forEach(x => x.append('\n'));
    return c.textContent.replace(/[ \t ]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim();
  };
  Listen.readBlock = (el, title) => {
    const text = Listen.textOf(el);
    const parts = text.split(/\n{2,}/).map(t => t.trim()).filter(t => t.length > 1);
    // long paragraphs are cut into ~600-character pieces so "next" jumps sensibly
    const pieces = [];
    parts.forEach(p => { while (p.length > 700) { const cut = p.lastIndexOf('.', 600) > 200 ? p.lastIndexOf('.', 600) + 1 : 600; pieces.push(p.slice(0, cut)); p = p.slice(cut).trim(); } if (p) pieces.push(p); });
    Listen.startText(title || 'Текст', pieces.map((t, i) => ({ title: `${title || 'Текст'} · ${i + 1}/${pieces.length}`, text: t })), { loop: false });
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-listen-here]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const sel = b.dataset.listenHere;
    const el = sel.startsWith('#') ? document.querySelector(sel) : b.closest(sel) || document.querySelector(sel);
    if (!el) { UI.toast('Нечего читать', 'warn'); return; }
    if (Listen.p && Listen.p._src === el) { Listen.toggle(); return; }
    Listen.prime();
    Listen.readBlock(el, b.dataset.title);
    if (Listen.p) Listen.p._src = el;
  }, true);

  /* the 🎧 buttons everywhere: muted when nothing plays, glowing while listening */
  const paint = () => {
    const all = !!(Listen.p && Listen.p.playing);
    document.querySelectorAll('#listen-btn, [data-listen-btn]').forEach(b => {
      // a deck's own button glows only while THAT deck plays
      const mine = !b.dataset.id || !Listen.p || (Listen.p.o.deckId === b.dataset.id && !Listen.p.list);
      const on = all && mine;
      b.classList.toggle('on', on);
      b.classList.toggle('paused', !!Listen.p && !Listen.p.playing && mine);
      const ico = b.querySelector('.hp-ico');
      if (!ico || ico.classList.contains('on') !== on) { const lbl = b.dataset.label ? `<span class="lbl-t">${b.dataset.label}</span>` : ''; b.innerHTML = HEADPHONES(b.id === 'listen-btn' ? 22 : b.classList.contains('listen-cta') ? 20 : 18, on) + lbl; }
    });
  };
  document.addEventListener('listen-state', paint);
  new MutationObserver(() => { if (document.querySelector('#listen-btn:empty, [data-listen-btn]:empty')) paint(); }).observe(document.documentElement, { childList: true, subtree: true });
  // the wake lock is dropped when the tab is hidden — take it again on return
  document.addEventListener('visibilitychange', () => {
    const p = Listen.p;
    // background tab: the system voice's pauses stall there (timers) — go back to audio clips
    if (document.visibilityState === 'hidden') { if (p && p.voice) Listen.toClips(); return; }
    if (document.querySelector('.dark-screen')) Listen.dark(true); // the wake lock again (the browser dropped it)
    // back in front and the clips kept failing in the background: now the system voice can help
    if (p && !p.voice && !p.rendered && p.streak >= 3 && !TTS.IOS) Listen.toVoice('голос Google не отвечает');
  });

  window.Listen = Listen;
})();
