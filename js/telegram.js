/* ============ ✈️ Telegram: posts, videos, picture-cards and files about the card's word -> inside the app -> cards ============
 * Three ways in (all read-only):
 *  1) on the owner's Mac: public channels — web preview t.me/s/<channel>?q=<word> (no login), fetched through the Mac bridge
 *  2) on the owner's Mac: YOUR account (closed groups, forum topics like «Словарный запас», PDF / MP3 files) — bridge/tg.py
 *     (Telethon), one-time login. Never anywhere else.
 *  3) everywhere else (the site, the store apps, phones): the Norsk Kort server's tg-public (docs/api-contract.md) — ONLY the
 *     curated channels of data/tg-channels.json (posts as JSON: safe HTML, link, picture), «Google Docs» word lists through
 *     fetch-public kind gdoc-txt. Any other channel (not_curated) is never shown inside the app: «Открыть в Телеграме».
 *     No server set up yet → Telegram's own links and widgets (js/tgchan.js), as before.
 * Everything taken from Telegram keeps its source: channel, post link, the Telegram icon on the card (provenance 'tr:telegram').
 * Translations written by teachers in the channels are human translations — no machine-translation warning.
 */
(function () {
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  const TG_SVG = (s = 18) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#29a9eb"/><path d="M5.4 11.6 17 7.1c.6-.2 1 .1.9.9l-2 9.3c-.1.6-.6.8-1.1.5l-3-2.2-1.4 1.4c-.2.2-.3.3-.6.3l.2-3.1 5.6-5.1c.2-.2 0-.4-.4-.2l-6.9 4.4-3-.9c-.6-.2-.6-.6.1-.9z" fill="#fff"/></svg>`;
  // public channels about Norwegian (checked 2026-11); the user can add more in the window
  const CHANNELS = [
    ['norsk24', 'Норвежский язык. Norsk24', '🇷🇺'], ['nordweg', 'Норвежский язык norsk @nordweg', '🇷🇺'],
    ['svetlana_list_norsk', 'Норвежский со Светланой Лист', '🇷🇺'], ['norsk_med_natali', 'Norsk med Natali', '🇷🇺'],
    ['sjenja_norsk', 'Sjenja_norsklærer', '🇷🇺'], ['laernorsknl', 'Lær Norsk - NL', '🇷🇺'], ['norgerussisk', 'Голос норвежских фьордов', '🇷🇺'],
    ['norskonline', 'Уроки норвежского', '🇷🇺'], ['norsk_idiomer', 'Норвежские идиомы', '🇷🇺'],
    ['norskua', 'Норвежский для украинцев', '🇺🇦'], ['ABCnorsk', 'ABC norsk — норвезька для українців', '🇺🇦'],
    ['norwaylovesyou', 'Норвезька мова. Норвегія', '🇺🇦'], ['no_for_ua', 'Вивчення норвезької мови', '🇺🇦'], ['norsk_for_ukrainere', 'Norsk for ukrainere', '🇺🇦'],
    ['snakk_norsk', 'Snakk norsk!', '🇳🇴'], ['norsk_for_alle', 'Norsk for alle', '🇳🇴'],
  ];
  const enc = encodeURIComponent;
  const st = () => Store.settings;
  /** the owner's own machine (localhost, *.localhost, the app opened as a file — never the store apps): only there the Mac
   *  bridge is mentioned. On the site and in the apps visitors never see «запустите мост» — they get what works without it. */
  const native = () => !!(window.Net && Net.isNative && Net.isNative());
  const home = () => !native() && (location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\]|::1)$|\.localhost$/i.test(location.hostname));
  /** the Mac bridge answered (js/net.js) — the ONLY case for /api/proxy and /api/tg/* */
  const macBridge = () => (window.Net && Net.isMacBridge ? Net.isMacBridge() : !!(window.AI && AI.bridge && AI.bridge.up));
  /** the Norsk Kort server is set up (js/config.js) — tg-public works */
  const serverOn = () => !!(window.Net && Net.callFn && window.NKConfig && NKConfig.ready());
  /** off the Mac with the server: the curated channels come through tg-public */
  const pubMode = () => !macBridge() && !home() && serverOn();
  const IC = (n, sz) => (window.NavIcons && NavIcons.icon ? NavIcons.icon(n, sz) : '');
  /** «📢 Норвежские каналы» of the Telegram window (js/tgchan.js), from another tab */
  const toChannels = el => { const t = el && el.closest('.tg-modal') && el.closest('.tg-modal').querySelector('[data-tgtab="channels"]'); if (t) t.click(); else Telegram.open(null, 'channels'); };
  const myChannels = () => {
    const extra = (st().tgExtra || []).map(u => [u, '@' + u, '➕']);
    const off = new Set(st().tgOff || []);
    return CHANNELS.concat(extra).filter(([u]) => !off.has(u));
  };

  /* ---------------- bridge helpers ---------------- */
  async function getVia(url) {
    const r = await fetch('/api/proxy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, method: 'GET' }) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'мост: ' + r.status); }
    return r.text();
  }
  async function acc(action, params = {}) {
    const r = await fetch(`/api/tg/${action}?` + new URLSearchParams(params));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'ошибка ' + r.status);
    return j;
  }
  const mediaUrl = (chat, msg, extra = '') => `/api/tg/media?chat=${enc(chat)}&msg=${enc(msg)}${extra}`;

  /* ---------------- 🌐 off the Mac: the Norsk Kort server's tg-public (curated channels only) ---------------- */
  let curP = null;
  /** the curated channels of data/tg-channels.json (the same list the server allows): [{ username, title }] */
  function curatedList() {
    if (!curP) {
      curP = fetch('data/tg-channels.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : [])).catch(() => [])
        .then(a => (Array.isArray(a) ? a : []).map(c => ({ username: String((c && c.username) || ''), title: String((c && c.title) || '') }))
          .filter(c => /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(c.username)).slice(0, 100));
    }
    return curP;
  }
  async function isCurated(u) { const k = String(u || '').toLowerCase(); return (await curatedList()).some(c => c.username.toLowerCase() === k); }
  const okHttps = u => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? String(u) : '');
  /** GET tg-public → { channel: {title, about, photo}, posts: [the shape of parsePreview + html (safe, from the server)], next }.
   *  Throws a NetError with a calm .message; not_curated → err.link (https://t.me/<channel>) — open it with Net.linkOut(err). */
  async function tgPublic(u, o = {}) {
    const j = await Net.callFn('tg-public', null, { query: { u, q: o.q || '', before: o.before || '' }, signal: o.signal });
    const ch = j && j.channel ? j.channel : {};
    const title = String(ch.title || '') || '@' + u;
    const posts = (j && Array.isArray(j.posts) ? j.posts : []).filter(p => p && +p.id > 0).map(p => {
      const m = p.media && typeof p.media === 'object' ? p.media : {};
      const thumb = okHttps(m.thumb);
      return {
        src: 'public', ch: u, chatTitle: title, id: +p.id, post: `${u}/${+p.id}`, date: String(p.date || ''),
        link: /^https:\/\/t\.me\/[A-Za-z0-9_]+\/\d+$/.test(String(p.link || '')) ? String(p.link) : `https://t.me/${u}/${+p.id}`,
        text: String(p.text || ''), html: String(p.html_safe || ''), // html_safe: b strong i em u s code pre br + https links only (server)
        photos: m.kind === 'photo' && thumb ? [thumb] : [],
        video: m.kind === 'video' ? { thumb, url: '' } : null,
        file: m.kind === 'document' || m.kind === 'audio' ? { name: m.kind === 'audio' ? 'Аудио' : 'Файл', audio: m.kind === 'audio' } : null,
      };
    });
    return { channel: { title, about: String(ch.about || ''), photo: okHttps(ch.photo) }, posts, next: +(j && j.next) || 0 };
  }
  /** the curated channels searched for a word through tg-public — gently: two at a time, ~2 requests a second */
  async function searchCurated(q, onPart, stop) {
    const list = await curatedList();
    let k = 0, halt = false;
    await Promise.all([0, 1].map(async () => {
      while (k < list.length && !halt && !(stop && stop())) {
        const { username: u } = list[k++];
        try { onPart((await tgPublic(u, { q })).posts, u); }
        catch (e) { if (e && (e.code === 'rate_limited' || e.code === 'offline' || e.code === 'not_configured')) halt = e; onPart([], u, e); }
        await new Promise(r => setTimeout(r, 450));
      }
    }));
    if (halt) throw halt;
  }

  /* ---------------- public channel web preview -> posts ---------------- */
  /** 🏷 the title a nameless deck may take: a chat's name; for own photos / texts / books only the name inside «…» (not «мой текст», «3 фото») */
  const nameHint = p => (p.src === 'local' ? ((/«(.+)»/.exec(p.chatTitle || '') || [])[1] || '') : p.chatTitle || '');
  function textOf(el) {
    if (!el) return '';
    const c = el.cloneNode(true);
    c.querySelectorAll('br').forEach(b => b.replaceWith('\n'));
    c.querySelectorAll('tg-emoji, .emoji').forEach(e => e.replaceWith(e.textContent));
    return c.textContent.replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').trim();
  }
  const bgUrl = el => ((el && el.getAttribute('style') || '').match(/background-image:\s*url\(['"]?([^'")]+)/) || [])[1] || '';
  function parsePreview(html, ch) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const title = (doc.querySelector('meta[property="og:title"]') || {}).content || ch;
    return [...doc.querySelectorAll('.tgme_widget_message[data-post]')].map(el => {
      const post = el.getAttribute('data-post');
      const photos = [...el.querySelectorAll('.tgme_widget_message_photo_wrap')].map(bgUrl).filter(Boolean);
      const vid = el.querySelector('.tgme_widget_message_video_player, .tgme_widget_message_video, .tgme_widget_message_roundvideo_player');
      const vsrc = (el.querySelector('video[src]') || {}).src || ''; // small videos are playable directly from Telegram's CDN
      const doc1 = el.querySelector('.tgme_widget_message_document_title');
      const audio = el.querySelector('.tgme_widget_message_voice, audio, .tgme_widget_message_document_icon.audio');
      const time = el.querySelector('.tgme_widget_message_date time');
      return {
        src: 'public', ch, chatTitle: title, id: +post.split('/')[1], link: 'https://t.me/' + post, post,
        // polls (quizzes) have their text in the question and the options
        text: textOf(el.querySelector('.tgme_widget_message_text')) || [textOf(el.querySelector('.tgme_widget_message_poll_question')),
          ...[...el.querySelectorAll('.tgme_widget_message_poll_option_text')].map(o => '• ' + textOf(o))].filter(t => t && t !== '• ').join('\n'),
        photos, video: vid ? { thumb: bgUrl(el.querySelector('.tgme_widget_message_video_thumb')), url: vsrc } : null,
        file: doc1 ? { name: doc1.textContent.trim(), audio: !!audio } : null,
        date: time ? time.getAttribute('datetime') : '',
      };
    });
  }
  async function searchPublic(q, onPart, stop) {
    const list = myChannels();
    let k = 0;
    await Promise.all([0, 1].map(async () => {
      while (k < list.length && !(stop && stop())) {
        const [u] = list[k++];
        try { onPart(parsePreview(await getVia(`https://t.me/s/${enc(u)}?q=${enc(q)}`), u)); } catch (e) { onPart([], u, e); }
        await new Promise(r => setTimeout(r, 450)); // gentle: about 2 requests per second
      }
    }));
  }
  /** account messages -> the same shape as public posts */
  function fromAccount(m) {
    return {
      src: 'account', chat: m.chat, chatTitle: m.chatTitle, id: m.id, link: m.link, text: m.text || '', date: m.date,
      photos: m.kind === 'photo' ? [mediaUrl(m.chat, m.id)] : [],
      video: m.kind === 'video' ? { thumb: mediaUrl(m.chat, m.id, '&thumb=1'), url: mediaUrl(m.chat, m.id), duration: m.duration } : null,
      file: m.kind === 'doc' || m.kind === 'audio' ? { name: m.name, audio: m.kind === 'audio' || /audio/.test(m.mime), mime: m.mime, size: m.size, url: mediaUrl(m.chat, m.id) } : null,
    };
  }
  const kindOf = p => p.video ? 'video' : p.photos.length ? 'photo' : p.file ? 'file' : 'text';

  /* ---------------- text -> pairs (norsk – русский) ---------------- */
  function pairs(text) {
    // "1️⃣ Jeg er sulten." / "🍪 Я голоден." — emoji and keycap numbers at the start of a line are decoration
    const clean = String(text || '').replace(/[*_]{2,}/g, '').split('\n')
      .map(l => l.replace(/^\s*(?:[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}️‍⃣]|[0-9#*]️?⃣)+\s*/u, '').trim()).join('\n');
    const items = Library.Load.paste(clean);
    // picture-cards "Vann / Вода / Water": an English line right after a pair is the English meaning —
    // but ONLY when the whole text repeats that pattern (every pair followed by such a line). Otherwise a short
    // Norwegian line without translation («bil») would silently vanish into the English field.
    const enLike = (x, prev) => prev && !x.ru && !x.en && prev.ru && /^[A-Za-z][A-Za-z '\-]{1,40}$/.test(x.no) && !/[æøåÆØÅ]/.test(x.no) && x.no.split(/\s+/).length <= 4;
    const withRu = items.filter(x => x.ru).length;
    const cands = items.filter((x, i) => enLike(x, items[i - 1])).length;
    const triplets = cands >= 2 && cands === withRu;
    const out = [];
    items.forEach(x => {
      const prev = out[out.length - 1];
      if (triplets && enLike(x, prev) && !prev.en) { prev.en = x.no; return; }
      out.push(x);
    });
    // junk lines never become pairs: numbers, hashtags, links, Russian/English text on the Norwegian side (PairGuard)
    return out.filter(x => x.no && x.no.length < 200 && !(window.PairGuard && PairGuard.badNo(x.no)));
  }
  /** OCR of a picture (Tesseract.js, runs in the browser) -> text */
  async function ocr(url, log, withConf) {
    log && log('Распознаю текст на картинке… (первый раз загружаются словари ≈8 МБ)');
    const worker = await U.lib.ocr();
    const blob = await (await fetch(url)).blob();
    const r = await worker.recognize(blob);
    const text = ((r && r.data && r.data.text) || '').split('\n').map(s => s.trim()).filter(s => s.length > 1 && /\p{L}{2}/u.test(s)).join('\n');
    // withConf: also how sure Tesseract is (0–100) — to warn about a poorly readable photo
    return withConf ? { text, conf: r && r.data && typeof r.data.confidence === 'number' ? r.data.confidence : 100 } : text;
  }
  /** "25 полезных фраз со словом «Tørst»" -> tørst */
  function keyword(text, card) {
    const m = String(text || '').match(/[«"“]([^»"”]{2,40})[»"”]/);
    if (m && !/[а-яё]/i.test(m[1])) return m[1].trim().toLowerCase();
    return card ? Ordbok.bare(card.no) : '';
  }

  /* ---------------- UI ---------------- */
  const Telegram = {
    TG_SVG, CHANNELS, parsePreview, pairs, home, macBridge, pubMode, tgPublic, curatedList, isCurated,
    status: null,
    async accStatus() {
      if (!macBridge()) return (this.status = { bridge: false });
      try { this.status = Object.assign({ bridge: true }, await acc('status')); } catch (e) { this.status = { bridge: true, error: U.niceErr(e) }; }
      return this.status;
    },

    async open(card, tab = 'search', opts = {}) {
      this._deckId = opts.deckId || null; // «Новая колода» -> Telegram: cards go into that deck
      const q0 = card ? Ordbok.bare(card.no) : '';
      const m = UI.modal({ title: `${TG_SVG(24)} Telegram${q0 ? `: «${U.esc(q0)}»` : ''}`, cls: 'wide tg-modal', body: '<div data-tg></div>', onClose: () => { this._deckId = null; if (opts.onClose) setTimeout(opts.onClose, 300); } });
      if (window.TrBadge) TrBadge.mount(m.$('.modal-head'), { place: 'telegram' }); // 🌐 who translates now
      const box = m.$('[data-tg]');
      await this.accStatus();
      const s = this.status;
      const tabs = [['search', '🔎 Найти по слову'], ['vocab', '🗂 Создать карточки из чата'], ['files', '📎 Книги и аудио'], ['setup', '⚙️ Каналы и аккаунт']];
      if (this.tab_channels) tabs.unshift(['channels', '📢 Норвежские каналы']); // js/tgchan.js — works without the bridge too
      if (this.tab_authors) tabs.splice(2, 0, ['authors', '🎬 Видео авторов']); // js/tgvideo.js — an author's videos: watch with subtitles / listen
      if (this.tab_audio) { const ai = tabs.findIndex(t => t[0] === 'authors'); tabs.splice(ai >= 0 ? ai + 1 : 2, 0, ['audio', '🎵 Аудио']); } // js/tgaudio.js — audio files and voice notes; «Мои аудио» play offline
      // the site without the bridge: only what works there — the channels (read through Telegram's own widget), the search
      // links, and «Мои аудио» if something was saved on this device
      const site = !s.bridge && !home();
      if (site) {
        const saved = !!(window.TgAudio && TgAudio.saved && TgAudio.saved.list().length);
        // 🌐 the Norsk Kort server: words from the curated channels into cards («Создать карточки из чата») work here too
        const keep = ['channels', 'search'].concat(serverOn() ? ['vocab'] : [], saved ? ['audio'] : []);
        for (let i = tabs.length - 1; i >= 0; i--) if (!keep.includes(tabs[i][0])) tabs.splice(i, 1);
      }
      const shell = cur => `<div class="tg-tabs">${tabs.map(([k, l]) => `<button class="chip ${k === cur ? 'active' : ''}" data-tgtab="${k}">${l}</button>`).join('')}
          <span class="grow"></span><span class="small muted">${s.bridge ? (s.authorized ? `✓ аккаунт: ${U.esc(s.me || 'подключён')}` : 'публичные каналы') : site ? `<span class="tg-state">${IC('check', 15)} без входа в Телеграм</span>` : `<span class="tg-state">${IC('alert', 15)} мост на Mac не запущен</span>`}</span></div><div data-tgbody></div>`;
      const go = t => { box.innerHTML = shell(t); this['tab_' + t](box.querySelector('[data-tgbody]'), card, m); };
      box.addEventListener('click', e => { const t = e.target.closest('[data-tgtab]'); if (t) go(t.dataset.tgtab); });
      const ok = tabs.some(t => t[0] === tab) ? tab : tabs[0][0];
      // 🎵 saved audio plays without the bridge; on the site a word from a card opens the search links, the rest — the channels
      go(s.bridge ? ok : site ? (tab === 'search' && card ? 'search' : ok === 'audio' || (ok === 'vocab' && tab === 'vocab') ? ok : (tabs.find(t => t[0] === 'channels') || tabs[0])[0]) : tab !== 'channels' && tab !== 'audio' ? 'setup' : tab);
    },

    noBridge(el, q) {
      if (!home()) { this.siteSearch(el, q); return; }
      el.innerHTML = `<div class="mt-warn">${IC('info', 18)} <span><b>Нужен мост на Mac.</b> Telegram не даёт сайтам читать каналы напрямую, поэтому окно работает через мост: в Терминале, в папке приложения,
        <code style="user-select:all">python3 bridge/server.py</code> и откройте приложение по адресу http://localhost:8787.</span></div>
        ${q ? `<div class="small muted" style="margin:8px 0 4px">Пока можно открыть поиск в самих каналах (откроется сайт Telegram):</div><div class="yt-links">${myChannels().map(([u, n, f]) => `<a class="chip" target="_blank" rel="noopener" href="https://t.me/s/${enc(u)}?q=${enc(q)}">${f} ${U.esc(n)} ↗</a>`).join('')}</div>` : ''}`;
    },

    /** the site (no bridge): the word is searched by Telegram itself — one link per channel; reading — in «Норвежские каналы» */
    siteSearch(el, q) {
      const list = myChannels();
      el.innerHTML = `<div class="tg-site">
          <p class="tg-site-lead">🔎 Напишите норвежское слово — Телеграм покажет посты с ним в каждом канале (откроется сайт Телеграма, входить не нужно).</p>
          <form class="row tg-site-form" data-tgsq autocomplete="off" style="gap:8px"><input class="input grow" data-tgq value="${U.esc(q || '')}" placeholder="слово или выражение, например: snakke" lang="nb" aria-label="Слово для поиска" spellcheck="false"><button type="submit" class="btn primary">🔎 Показать каналы</button></form>
          <div class="tg-site-links" data-tglinks></div>
          <div class="tg-site-alt"><span aria-hidden="true">📖</span><span>Хотите просто читать посты и брать из них слова в карточки? Откройте <b>«📢 Норвежские каналы»</b> и нажмите «Читать здесь».</span>
            <button type="button" class="btn" data-tgtochan>📢 Норвежские каналы</button></div>
        </div>`;
      const draw = () => {
        const w = el.querySelector('[data-tgq]').value.trim();
        el.querySelector('[data-tglinks]').innerHTML = w
          ? `<div class="small muted" style="margin:4px 0">Посты со словом «${U.esc(w)}» — нажмите на канал:</div><div class="yt-links">${list.map(([u, n, f]) => `<a class="chip tg-site-link" target="_blank" rel="noopener noreferrer" href="https://t.me/s/${enc(u)}?q=${enc(w)}">${f} ${U.esc(n)} ↗</a>`).join('')}</div>`
          : '';
      };
      el.querySelector('[data-tgsq]').addEventListener('submit', e => { e.preventDefault(); draw(); });
      el.querySelector('[data-tgtochan]').onclick = () => toChannels(el);
      draw();
    },

    /* ---- 🔎 search by the card's word: videos / texts / pictures / files, the user picks what to open ---- */
    tab_search(el, card, m) {
      const q0 = card ? Ordbok.bare(card.no) : '';
      const pub = pubMode(); // 🌐 off the Mac: the curated channels through the Norsk Kort server
      if (!macBridge() && !pub) { this.noBridge(el, q0); return; }
      const s = pub ? {} : this.status;
      el.innerHTML = `<div class="row" style="gap:8px"><input class="input grow" data-tgq value="${U.esc(q0)}" placeholder="слово или выражение" lang="nb" aria-label="Слово для поиска"><button class="btn primary" data-tggo>🔎 Искать</button></div>
        <div class="small muted" style="margin:4px 0">${pub ? 'Поиск в проверенных каналах о норвежском — прямо здесь, без входа в Телеграм.' : `Поиск в ${myChannels().length} публичных каналах${s.authorized ? ' и в ваших чатах/группах (аккаунт)' : ''}.`} Telegram ищет по целым словам (snakke, snakker…). Картинки без подписи так не находятся — их можно взять во вкладке «Создать карточки из чата».</div>
        <div class="tg-kinds" data-kinds></div><div data-res class="tg-res"></div>${pub ? '<div class="tg-more-links" data-tgother></div>' : ''}`;
      let all = [], filter = 'all', stop = false;
      const render = () => {
        const count = k => all.filter(p => k === 'all' || kindOf(p) === k).length;
        el.querySelector('[data-kinds]').innerHTML = [['all', 'Все'], ['video', '🎬 Видео'], ['text', '📝 Тексты'], ['photo', '🖼 Картинки'], ['file', '📎 Файлы']]
          .map(([k, l]) => `<button class="chip ${filter === k ? 'active' : ''}" data-kind="${k}">${l} ${count(k)}</button>`).join('')
          + (all.some(p => p.text) ? `<button class="chip listen-chip" data-tglisten>${Listen.HEADPHONES(16, true)} Слушать все тексты подряд</button>` : '')
          + (all.some(p => p.video) ? '<button class="chip" data-tgvideos>🎬 Все видео подряд</button>' : '');
        const list = all.filter(p => filter === 'all' || kindOf(p) === filter);
        el.querySelector('[data-res]').innerHTML = list.length ? list.map((p, i) => this.postHtml(p, all.indexOf(p), el.querySelector('[data-tgq]').value)).join('') : '<div class="small muted">Пока ничего…</div>';
      };
      const run = async () => {
        const q = el.querySelector('[data-tgq]').value.trim();
        if (!q) return;
        all = []; stop = false; render();
        const res = el.querySelector('[data-res]');
        res.insertAdjacentHTML('afterbegin', '<div class="small muted" data-prog><span class="spinner sm"></span> ищу…</div>');
        const seen = new Set();
        const add = posts => { posts.forEach(p => { const k = p.link; if (!seen.has(k)) { seen.add(k); all.push(p); } }); all.sort((a, b) => String(b.date).localeCompare(String(a.date))); render(); };
        let halted = null;
        const jobs = [pub ? searchCurated(q, posts => add(posts), () => stop).catch(e => { halted = e; }) : searchPublic(q, (posts) => add(posts), () => stop)];
        if (pub) this.otherLinks(el.querySelector('[data-tgother]'), q);
        if (s.authorized) {
          jobs.push((async () => {
            try {
              const ids = (st().tgChats && st().tgChats.length ? st().tgChats : (await acc('dialogs')).dialogs.filter(d => d.match).map(d => d.id)).slice(0, 30);
              if (ids.length) add((await acc('search', { chats: ids.join(','), q, limit: 15 })).messages.filter(x => !x.error).map(fromAccount));
            } catch (e) { UI.toast('Telegram (аккаунт): ' + e.message, 'warn', 5000); }
          })());
        }
        await Promise.all(jobs);
        render();
        if (!all.length) el.querySelector('[data-res]').innerHTML = halted && halted.nk ? `<div class="small muted">${U.esc(halted.message)}</div>`
          : `<div class="small muted">По «${U.esc(q)}» ничего не нашлось. Попробуйте другую форму слова или русский перевод.</div>`;
      };
      el.addEventListener('click', e => {
        const k = e.target.closest('[data-kind]'); if (k) { filter = k.dataset.kind; render(); return; }
        if (e.target.closest('[data-tglisten]')) { Listen.prime(); Listen.startText('Telegram: ' + el.querySelector('[data-tgq]').value, all.filter(p => p.text).map(p => ({ title: p.chatTitle, text: p.text }))); return; }
        if (e.target.closest('[data-tgvideos]')) { this.videoPlaylist(all.filter(p => p.video)); return; }
        if (e.target.closest('[data-tggo]')) { run(); return; }
        const a = e.target.closest('[data-tgact]'); if (!a) return;
        const p = all[+a.dataset.i];
        if (a.dataset.tgact === 'more') a.closest('.tg-post').classList.toggle('open');
        if (a.dataset.tgact === 'watch') this.watch(a.closest('.tg-post'), p);
        if (a.dataset.tgact === 'photo') this.viewPhoto(a.dataset.url);
        if (a.dataset.tgact === 'card') this.toCards(p, card, m);
      });
      el.querySelector('[data-tgq]').addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
      m.el && m.el.addEventListener && 0;
      if (q0) run();
    },

    postHtml(p, i, q) {
      const hl = t => { const r = UI.rich(t); return q ? r.replace(new RegExp(`(${U.escapeRegExp(q)}\\p{L}*)`, 'giu'), '<mark>$1</mark>') : r; };
      const k = kindOf(p);
      const icon = { video: '🎬', photo: '🖼', file: '📎', text: '📝' }[k];
      return `<div class="tg-post" data-i="${i}">
        <div class="tg-post-head">${TG_SVG(16)} <b>${U.esc(p.chatTitle || p.ch || '')}</b><span class="small muted">${p.date ? new Date(p.date).toLocaleDateString('ru-RU') : ''}</span><span class="chip">${icon}</span><span class="grow"></span>
          <a class="small" href="${U.esc(p.link)}" target="_blank" rel="noopener" title="Открыть в Telegram">↗</a></div>
        ${p.text ? `<div class="tg-text" data-tgact="more" data-i="${i}">${hl(p.text)}</div>` : ''}
        ${p.photos.length ? `<div class="tg-photos">${p.photos.slice(0, 6).map(u => `<img src="${U.esc(u)}" alt="" loading="lazy" data-tgact="photo" data-url="${U.esc(u)}" data-i="${i}">`).join('')}</div>` : ''}
        ${p.video ? `<div class="tg-video" data-player>${p.video.thumb ? `<img src="${U.esc(p.video.thumb)}" alt="" loading="lazy">` : ''}<button class="btn sm primary" data-tgact="watch" data-i="${i}">▶ Смотреть здесь</button></div>` : ''}
        ${p.file ? `<div class="tg-file">${p.file.audio ? '🎧' : '📄'} ${U.esc(p.file.name || 'файл')}${p.file.url ? ` · <a href="${U.esc(p.file.url)}" target="_blank">открыть</a> · <a href="${U.esc(p.file.url)}&dl=1">скачать</a>` : home() ? ' · откройте в Telegram ↗ (файлы — через аккаунт)' : ` · <a href="${U.esc(p.link)}" target="_blank" rel="noopener noreferrer">открыть в Телеграме ↗</a>`}
          ${p.file.audio && p.file.url ? `<audio controls preload="none" src="${U.esc(p.file.url)}"></audio>` : ''}</div>` : ''}
        <div class="row" style="gap:6px;margin-top:6px"><button class="btn sm ai" data-tgact="card" data-i="${i}">➕ В карточку</button>${p.text ? Listen.hereBtn('.tg-post', 'Telegram · ' + (p.chatTitle || ''), 'Слушать') : ''}${p.text && p.text.length > 260 ? `<button class="btn sm ghost" data-tgact="more" data-i="${i}">развернуть</button>` : ''}</div>
      </div>`;
    },
    /** video inside the app: public post -> Telegram's own embed; account -> streamed through the bridge */
    watch(postEl, p) {
      const box = postEl.querySelector('[data-player]');
      box.innerHTML = p.video.url
        ? `<video controls autoplay playsinline src="${U.esc(p.video.url)}" style="width:100%;max-height:70vh;border-radius:12px;background:#000"></video>`
        : `<iframe class="tg-embed" referrerpolicy="strict-origin-when-cross-origin" src="https://t.me/${U.esc(p.post)}?embed=1&mode=tme" title="Telegram" allow="autoplay; fullscreen" loading="lazy"></iframe>`;
    },
    /** 🎬 all found videos one after another inside the app; 🔁 loop on/off */
    videoPlaylist(list) {
      const playable = list.filter(p => p.video && p.video.url);
      const embeds = list.filter(p => p.video && !p.video.url);
      if (!playable.length) {
        UI.toast('Эти видео Telegram показывает только встроенным плеером — открываю по одному (большие видео — через ваш аккаунт)', 'warn', 6000);
        if (embeds[0]) this.watch(document.querySelector(`.tg-post[data-i]`) || document.body, embeds[0]);
        return;
      }
      let i = 0, loop = true;
      const m = UI.modal({
        title: '🎬 Видео подряд', cls: 'wide',
        // a video playing: «Закрыть просмотр?» (like the subtitle player); paused at the start — closes at once
        beforeClose: UI.guard(() => { const vv = m.$('[data-v]'); return !vv || vv.paused || vv.currentTime <= 3 ? null : { title: 'Закрыть просмотр?', line: 'Видео остановится.', actions: [{ label: 'Закрыть', value: 'close', cls: 'bad' }], cancel: 'Смотреть дальше' }; }),
        onClose: () => { const vv = m.$('[data-v]'); if (vv) { vv.pause(); vv.removeAttribute('src'); } },
        body: `<video data-v controls autoplay playsinline style="width:100%;max-height:68vh;border-radius:14px;background:#000"></video>
          <div class="row" style="gap:8px;align-items:center;margin-top:6px"><b data-vt class="grow"></b><button class="btn sm" data-vp>⏮</button><button class="btn sm" data-vn>⏭</button>${UI.switchHtml('v-loop', true, '🔁 По кругу')}</div>
          <div class="small muted">${playable.length} видео${embeds.length ? ` · ещё ${embeds.length} — только по ссылке (большие файлы)` : ''}. Когда видео закончится — включится следующее.</div>`,
      });
      const v = m.$('[data-v]');
      const play = () => { const p = playable[i]; v.src = p.video.url; m.$('[data-vt]').textContent = `${i + 1}/${playable.length} · ${p.chatTitle || ''}`; v.play().catch(() => {}); };
      v.addEventListener('ended', () => { if (i + 1 < playable.length) { i++; play(); } else if (m.$('[data-key="v-loop"]').checked) { i = 0; play(); } });
      m.$('[data-vn]').onclick = () => { i = (i + 1) % playable.length; play(); };
      m.$('[data-vp]').onclick = () => { i = (i - 1 + playable.length) % playable.length; play(); };
      if ('mediaSession' in navigator) {
        try { navigator.mediaSession.setActionHandler('nexttrack', () => m.$('[data-vn]').click()); navigator.mediaSession.setActionHandler('previoustrack', () => m.$('[data-vp]').click()); } catch (e) { /* ignore */ }
      }
      void loop;
      play();
    },
    viewPhoto(url) {
      UI.modal({ title: '🖼 Картинка из Telegram', cls: 'wide', body: `<img src="${U.esc(url)}" alt="" style="width:100%;border-radius:14px">` });
    },

    /* ---- ➕ post (text / picture / video) -> editable pairs -> card(s) ---- */
    async toCards(p, card, parent, opts = {}) {
      const local = p.src === 'local';
      const m = UI.modal({ title: local ? `🃏 В карточки: ${U.esc(p.chatTitle || '')}` : `${TG_SVG(22)} Из Telegram в карточку`, cls: 'wide', body: '<div data-x><div class="small muted"><span class="spinner sm"></span> разбираю…</div></div>',
        // a deck made for this by «Новая колода» and left empty (closed without saving / saved elsewhere) is removed
        onClose: () => { if (opts.onCancel) opts.onCancel(); },
        // found pairs from the user's own photo / file / pasted list, or a translation / recognition still running: asked first
        // (a Telegram post opens again with one tap — nothing to lose there)
        beforeClose: UI.guard(() => !busyNow && !(local && rows.some(r => String(r.no || '').trim())) ? null
          : { title: 'Закрыть без сохранения?', line: `${busyNow ? 'Перевод и распознавание остановятся. ' : ''}Найденные строки ещё не сохранены в карточки.`,
            actions: [{ label: 'Закрыть', value: 'close', cls: 'bad' }] }) });
      const box = m.$('[data-x]');
      const log = t => { const s = box.querySelector('[data-log]'); if (s) s.textContent = t; };
      // r.src: the translation came with the text / picture (a person wrote it); r.by + r.ruAuto: translated here by a machine or AI
      let rows = pairs(p.text).map(r => Object.assign(r, { src: !!r.ru, ruSrc: r.ru || '' }));
      const pics = p.photos.length ? p.photos : (p.video && p.video.thumb ? [p.video.thumb] : []);
      const lang = 'ru'; // 🇺🇦 Ukrainian comes later — the choice is already in the window
      let busyNow = false, autoTried = false, poor = '';
      const sync = () => rows.forEach((r, i) => {
        const on = box.querySelector(`[data-on="${i}"]`); if (!on) return;
        r.on = on.checked; r.no = box.querySelector(`[data-no="${i}"]`).value.trim(); r.ru = box.querySelector(`[data-ru="${i}"]`).value.trim();
      });
      // who translated this line: badge next to it
      const whoHtml = r => {
        if (!r.ru) return '<span class="tg-who none">нет перевода</span>';
        if (r.by && r.ru === r.ruAuto) {
          const ai = r.by.includes('ai');
          return `<span class="tg-who ${ai ? 'ai' : 'mt'}" title="${ai ? 'Перевела нейросеть — по смыслу, но тоже может ошибаться' : 'Машинный перевод — неточный, перепроверьте'}">${ai ? BOT() : '⚠️'} ${U.esc(Translators.provNames(r.by))}${ai ? '' : ' · неточно'}</span>`;
        }
        if (r.src && r.ru === r.ruSrc) {
          // 🛡 the source's translation is compared with a machine one (PairGuard): the neighbour line may not be a translation at all
          const who = local ? 'из источника' : 'от автора поста', g = r.pg;
          const mtTip = g && g.mt && !String(g.why || '').includes(g.mt) ? ` · машинный перевод: «${g.mt}»` : '';
          if (g && g.st === 'ok') return `<span class="tg-who src" title="Перевод из самого текста — сверен с машинным, совпадает">✓ ${who} · сверено</span>`;
          if (g && g.st === 'unsure') return `<span class="tg-who mt" title="${U.esc(g.why + mtTip)}">? ${who} · не подтверждён</span>`;
          if (g && g.st === 'bad') return `<span class="tg-who none" title="${U.esc(g.why + mtTip)}">✗ ${U.esc(g.why)}</span>`;
          return `<span class="tg-who src" title="Перевод был в самом тексте / на фото — сверяю с машинным">✓ ${who}${g ? '' : ' · сверяю…'}</span>`;
        }
        return '<span class="tg-who me" title="Вы вписали или поправили перевод сами">✍️ вы</span>';
      };
      /** 🛡 PairGuard on the pairs that came with a translation: «✗ не перевод» is unticked, «?» too (except your own photos) */
      const check = async () => {
        const todo = rows.filter(r => r.src && r.ru && r.ru === r.ruSrc && !r.pg);
        if (!todo.length) return;
        todo.forEach(r => { r.pg = { st: '' }; const why = PairGuard.badNo(r.no) || PairGuard.badRu(r.ru, r.no); if (why) r.pg = { st: 'bad', why }; });
        const rest = todo.filter(r => !r.pg.st);
        const tmp = rest.map(r => ({ no: r.no, ru: r.ru }));
        await PairGuard.verify(tmp);
        rest.forEach((r, i) => { r.pg = { st: tmp[i].st, why: tmp[i].why, mt: tmp[i].mt, by: tmp[i].mtBy }; });
        if (!box.isConnected) return;
        sync();
        todo.forEach(r => { if (r.pg.st === 'bad' || (r.pg.st === 'unsure' && !local)) r.on = false; });
        if (!busyNow) redraw();
        const bad = todo.filter(r => r.pg.st === 'bad').length, uns = todo.filter(r => r.pg.st === 'unsure').length;
        if (bad || uns) UI.toast(`🛡 Сверка переводов: ${bad ? `${bad} — не перевод (сняты)` : ''}${bad && uns ? ', ' : ''}${uns ? `${uns} — не подтверждено${local ? '' : ' (сняты)'}` : ''}. Наведите на значок — увидите причину.`, 'warn', 6000);
      };
      const draw = () => {
        const busy = busyNow;
        const kw = keyword(p.text, card);
        const need = rows.filter(r => r.no && !r.ru).length;
        const machine = [...new Set(rows.filter(r => r.by && r.ru && r.ru === r.ruAuto).flatMap(r => r.by))];
        box.innerHTML = `${local ? '' : `<div class="tg-post-head">${TG_SVG(16)} <b>${U.esc(p.chatTitle || '')}</b> <a class="small" href="${U.esc(p.link)}" target="_blank" rel="noopener">${U.esc(p.link)} ↗</a></div>`}
          ${pics.length ? `<div class="tg-photos">${pics.slice(0, 6).map(u => `<img src="${U.esc(u)}" alt="">`).join('')}</div>
            <div class="row" style="gap:6px"><button class="btn sm" data-ocr ${busy ? 'disabled' : ''}>🔤 ${opts.autoOcr ? 'Распознать ещё раз' : `Распознать слова на картинке${pics.length > 1 ? 'х' : ''}`}</button><span class="small muted" data-log>${busy ? '' : 'Текст с картинки станет обычным редактируемым текстом карточки'}</span></div>` : ''}
          ${poor ? `<div class="mt-warn">⚠️ <span>${poor}</span></div>` : ''}
          <div class="row tg-lang" style="gap:6px;margin-top:8px"><span class="small muted">Перевод на:</span>
            <button class="chip active" data-lang="ru" title="Русский">🇷🇺 Русский</button>
            <button class="chip" data-lang="uk" disabled title="Украинский — скоро">🇺🇦 Українська · скоро</button></div>
          <div class="small muted" style="margin-top:8px">Найдено строк: <b>${rows.length}</b>${need ? ` · без перевода: <b>${need}</b>` : ''}. Проверьте и поправьте — снимите галочку, чтобы пропустить строку.</div>
          <div class="tg-pairs">${rows.map((r, i) => `<div class="tg-pair"><input type="checkbox" data-on="${i}" ${r.on === false ? '' : 'checked'}><input class="input" data-no="${i}" value="${U.esc(r.no)}"><div class="tg-ru"><input class="input" data-ru="${i}" value="${U.esc(r.ru || '')}" placeholder="перевод">${whoHtml(r)}</div></div>`).join('') || '<div class="small muted">Пар не найдено — добавьте строку вручную ниже или распознайте картинку.</div>'}</div>
          <div class="row" style="gap:6px"><button class="btn sm ghost" data-addrow>＋ строка</button>${need ? `<button class="btn sm" data-tr ${busy ? 'disabled' : ''}>🌐 Перевести строки без перевода (${need})</button>` : ''}
            <span class="small muted">Переводит: <b>${U.esc(Translators.provNames(Translators.dictOrder().slice(0, 1)))}</b> — сменить можно в Настройках</span></div>
          ${machine.length ? Translators.machineWarnHtml(machine, false) : ''}
          <div class="field" style="margin-top:8px"><span>Как сделать карточки</span>
            <label class="radio"><input type="radio" name="tgmode" value="each" checked> Каждая пара — отдельная карточка (норвежский спереди, перевод на обороте)</label>
            <label class="radio"><input type="radio" name="tgmode" value="one"> Одна карточка: ключевое слово сверху <input class="input" data-kw value="${U.esc(kw)}" style="width:160px;display:inline-block;margin:0 6px">, на обороте — все фразы с переводом</label>
            ${card ? `<label class="radio"><input type="radio" name="tgmode" value="into"> Добавить в текущую карточку «${U.esc(card.no)}» (в примеры)</label>` : ''}
          </div>
          ${Library.deckPicker((card && card.deckId) || opts.deckId || (parent ? this._deckId : null),(p.chatTitle || 'Telegram').slice(0, 40))}
          ${pics.length ? UI.switchHtml('tg-img', !opts.autoOcr, local ? 'Само фото — на первую карточку' : 'Картинку из поста — на карточку') : ''}
          <div class="row" style="gap:8px;margin-top:8px"><button class="btn primary" data-save ${busy ? 'disabled' : ''}>➕ Сохранить</button><span class="small muted">${local ? `Источник сохранится: ${U.esc(p.chatTitle || '')} · у каждой карточки — кто переводил` : `Источник сохранится: ${TG_SVG(14)} ${U.esc(p.chatTitle || 'Telegram')}${p.protected && p.ch ? ` · из канала @${U.esc(p.ch)} (личное обучение)` : ''} · ссылка на пост`}</span></div>`;
      };
      // redraw without losing what the user already chose below the list (mode, deck, keyword, picture switch)
      const redraw = () => {
        const q = s => box.querySelector(s);
        const keep = { mode: (q('input[name="tgmode"]:checked') || {}).value, deck: q('[data-o="deck"]') && q('[data-o="deck"]').value, kw: q('[data-kw]') && q('[data-kw]').value, img: q('[data-key="tg-img"]') && q('[data-key="tg-img"]').checked };
        draw();
        if (keep.mode) { const r = q(`input[name="tgmode"][value="${keep.mode}"]`); if (r) r.checked = true; }
        if (keep.deck != null && q('[data-o="deck"]')) q('[data-o="deck"]').value = keep.deck;
        if (keep.kw != null && q('[data-kw]')) q('[data-kw]').value = keep.kw;
        if (keep.img != null && q('[data-key="tg-img"]')) q('[data-key="tg-img"]').checked = keep.img;
      };
      const read = () => { sync(); return rows.filter(r => r.on !== false && r.no); };
      /** 🌐 lines without a translation -> the user's translator (Google / DeepL / AI… as in Settings); each line remembers who translated it */
      const translate = async () => {
        sync();
        const need = rows.filter(r => r.no && !r.ru);
        if (!need.length || busyNow) return;
        busyNow = true; redraw();
        let res;
        try { res = await Translators.translateMany(need.map(r => r.no), 'no', lang); } catch (err) { res = { out: [], by: [], missing: need.length, error: U.niceErr(err) }; }
        need.forEach((r, i) => {
          const t = String(res.out[i] || '').trim(); if (!t) return;
          const c = Translators._trCache && Translators._trCache.get(`no|${lang}|${r.no.replace(/\s*\n\s*/g, ' ').trim()}`);
          r.ru = t; r.ruAuto = t; r.by = [c ? c.id : (res.by[0] || 'google')];
        });
        busyNow = false; redraw();
        if (res.missing) {
          Study._lastFail = { missing: res.missing, error: res.error || 'переводчик не ответил' };
          Study.failModal(() => translate());
        } else if (need.length) UI.toast(`Переведено строк: ${need.length} — ${Translators.provNames(res.by)}`, 'good', 3500);
      };
      const recognize = async () => {
        sync(); busyNow = true; redraw();
        try {
          let text = '', conf = [];
          for (const [k, u] of pics.slice(0, 12).entries()) {
            log(`Распознаю фото ${k + 1} из ${Math.min(pics.length, 12)}…`);
            const r = await ocr(u, k ? null : log, true);
            text += '\n' + r.text; conf.push(r.conf);
          }
          const got = pairs(text).map(g => Object.assign(g, { src: !!g.ru, ruSrc: g.ru || '' }));
          const fresh = got.filter(g => !rows.some(r => U.norm(r.no) === U.norm(g.no)));
          rows = rows.filter(r => r.no.trim()).concat(fresh);
          // poorly readable photo: say so plainly — retake it or fix the lines by hand
          const avg = conf.length ? conf.reduce((a, b) => a + b, 0) / conf.length : 100;
          const junk = got.filter(g => /[^\p{L}\p{N}\s.,!?'’"«»:;()\-–—/]/u.test(g.no) || g.no.replace(/[^\p{L}]/gu, '').length < 2).length;
          poor = !got.length ? 'На фото не нашлось текста. Переснимите ровно, при хорошем свете, чтобы текст был крупным и резким — или впишите строки вручную.'
            : avg < 60 || junk > got.length / 3 ? `Текст на фото читается плохо (распознано примерно на ${Math.round(avg)}%) — в строках могут быть ошибки. Проверьте их, или переснимите ровнее и ближе, при хорошем свете.` : '';
          busyNow = false; redraw();
          UI.toast(got.length ? `С фото: ${fresh.length} строк — проверьте` : 'Текст на фото не распознан — впишите вручную', got.length ? 'good' : 'warn', 4000);
          check();
          if (rows.some(r => r.no && !r.ru)) { autoTried = true; await translate(); }
        } catch (err) { busyNow = false; redraw(); UI.toast('Распознавание: ' + err.message, 'bad', 5000); }
      };
      draw();
      check();
      box.addEventListener('input', e => { const i = e.target.dataset && e.target.dataset.ru; if (i != null) { sync(); const w = e.target.parentElement.querySelector('.tg-who'); if (w) w.outerHTML = whoHtml(rows[+i]); } });
      box.addEventListener('click', async e => {
        if (e.target.closest('[data-addrow]')) { sync(); rows.push({ no: '', ru: '' }); redraw(); const ins = box.querySelectorAll('[data-no]'); if (ins.length) ins[ins.length - 1].focus(); return; }
        if (e.target.closest('[data-ocr]')) { await recognize(); return; }
        if (e.target.closest('[data-tr]')) { await translate(); return; }
        if (e.target.closest('[data-save]')) await this.save(read(), p, card, box, m, pics);
      });
      // photo: recognize right away; text without translations: translate right away
      if (opts.autoOcr && pics.length) recognize();
      else if (rows.some(r => r.no && !r.ru) && !autoTried) { autoTried = true; translate(); }
    },

    async save(list, p, card, box, m, pics) {
      if (!list.length) { UI.toast('Нет ни одной строки', 'warn'); return; }
      const mode = (box.querySelector('input[name="tgmode"]:checked') || {}).value || 'each';
      const local = p.src === 'local'; // a photo / file of your own (window «Что вы хотите выучить?»)
      // a protected channel (the author forbade copying): read in the app for personal study — the source says so
      const own = !local && p.protected && p.ch ? ` · из канала @${p.ch} (личное обучение)` : '';
      const src = local ? `Источник: ${p.chatTitle || 'моё фото'}` : `Источник: Telegram · ${p.chatTitle || ''}${own} · ${p.link}`;
      const prov = note => local ? Prov.entry('import', 'create', null, `${p.chatTitle || 'фото'}${note ? ' · ' + note : ''}`) : Prov.entry('tr:telegram', 'create', null, `${p.chatTitle || 'Telegram'}${own} · ${p.link}${note ? ' · ' + note : ''}`);
      let image = '';
      const imgOn = box.querySelector('[data-key="tg-img"]');
      if (pics.length && imgOn && imgOn.checked && mode !== 'into') {
        try { image = await U.compressImage(await (await fetch(pics[0])).blob(), 720); } catch (e) { /* no picture */ }
      }
      const extra = [p.video ? `🎬 Видео: ${p.link}` : '', src].filter(Boolean).join('\n');
      // who translated each line: machine / AI (translated here and not changed), the source itself, or the user
      const trBy = r => (r.by && r.ru && r.ru === r.ruAuto ? r.by : []);
      const trHist = r => {
        const by = trBy(r);
        if (by.length) return Translators.provKeys(by).map(k => Prov.entry(k, 'translate', null, local ? 'перевод строки (не было перевода в источнике)' : 'перевод строки из поста'));
        if (r.ru && !(r.src && r.ru === r.ruSrc)) return [Prov.entry('manual', 'translate', null, 'перевод вписан вручную')];
        return [];
      };
      if (mode === 'into' && card) {
        const fresh = Store.card(card.id);
        const examples = (fresh.examples || []).concat(list.map(r => ({ label: 'Telegram', no: r.no, ru: r.ru, note: p.chatTitle || '' })));
        Store.updateCard(card.id, { examples, history: Prov.add(fresh, Prov.entry('tr:telegram', 'examples', { examples: { old: Prov.listText(fresh.examples, true), new: Prov.listText(examples, true) } }, `${p.chatTitle}${own} · ${p.link}`)) });
        UI.toast(`Добавлено в карточку: ${list.length} ✓`, 'good');
        m.close();
        if (window.Study && Study.current && Study.current()) { Study.renderCard(false); Study.flip(true); }
        return;
      }
      const deckSel = box.querySelector('[data-o="deck"]').value;
      const deck = deckSel ? Store.deck(deckSel) : Store.addDeck((p.chatTitle || 'Telegram').slice(0, 60), local ? `Мои карточки: ${p.chatTitle || 'фото'}` : 'Карточки из Telegram');
      if (mode === 'one') {
        const kw = box.querySelector('[data-kw]').value.trim() || list[0].no;
        const tr = list.find(r => U.norm(r.no) === U.norm(kw));
        Store.addCard(deck.id, {
          no: kw, ru: tr ? tr.ru : (list[0].ru || ''), image, imageAuto: false,
          description: list.map(r => `• ${r.no}${r.ru ? ` (${r.ru})` : ''}`).join('\n') + '\n\n' + extra,
          tags: [local ? 'моё' : 'telegram'], history: [prov(`${list.length} фраз`), ...list.flatMap(trHist).filter((h, i, a) => a.findIndex(x => x.by === h.by) === i)],
          mtWarn: Translators.mtFlag([...new Set(list.flatMap(trBy))]),
        });
        Store.autoNameDeck(deck.id, nameHint(p));
        UI.toast('Карточка создана ✓', 'good');
      } else {
        // 🛡 the source's translation that the check did not confirm (the user kept it): marked «проверить»
        const unconf = r => r.src && r.ru === r.ruSrc && r.pg && (r.pg.st === 'unsure' || r.pg.st === 'bad');
        const okSrc = r => r.src && r.ru === r.ruSrc && r.pg && r.pg.st === 'ok';
        list.forEach((r, i) => Store.addCard(deck.id, {
          no: r.no, ru: r.ru, en: r.en || '', image: i === 0 || list.length === 1 ? image : '', imageAuto: false,
          description: extra + (unconf(r) ? `\n⚠️ Перевод из источника не подтверждён сверкой${r.pg.mt ? ` (машинный: «${r.pg.mt}»)` : ''} — проверьте` : ''),
          tags: [local ? 'моё' : 'telegram', ...(unconf(r) ? ['проверить'] : [])],
          history: [prov(), ...trHist(r), ...(okSrc(r) ? [Prov.entry(Translators.provKeys(r.pg.by && r.pg.by.length ? r.pg.by : ['google'])[0], 'verify', null, 'перевод источника сверен с машинным: совпадает')] : [])],
          mtWarn: Translators.mtFlag(trBy(r)),
        }));
        const mt = list.filter(r => Translators.mtFlag(trBy(r))).length;
        Store.autoNameDeck(deck.id, nameHint(p)); // 🏷 a deck without a name: the chat / book / photo title or its first card
        UI.toast(`Создано ${U.cards(list.length)} в «${deck.name}» ✓${mt ? ` · ⚠️ ${mt} — машинный перевод, перепроверьте` : ''}`, 'good', mt ? 6000 : 3500);
      }
      await Store.saveNow();
      m.close();
      // own photo / text: show the deck with the new cards (not during a study session)
      if (local && window.App && App.view && App.view.name !== 'study') App.go('deck', { id: deck.id });
    },

    /* ---- 🗂 whole chat / forum topic («Словарный запас») -> all pairs -> deck ---- */
    async tab_vocab(el, card) {
      const pub = pubMode(); // 🌐 off the Mac: the curated channels through the Norsk Kort server (tg-public + gdoc-txt)
      if (!macBridge() && !pub) { if (home()) this.noBridge(el); else this.siteAlt(el, 'vocab'); return; }
      const s = pub ? {} : this.status;
      const srcList = pub ? (await curatedList()).map(c => [c.username, c.title || '@' + c.username, '']) : myChannels();
      el.innerHTML = `<div class="small">Соберу все пары «норвежский — перевод» из канала или темы группы (например, «Норвежский? Легко!» → «Словарный запас») — и ссылки на Google-документы со списками слов.</div>
        <div class="field-row">
          <label class="field"><span>Откуда</span><select class="input" data-src><option value="">— выберите —</option>
            <optgroup label="${pub ? 'Проверенные каналы о норвежском' : 'Публичные каналы'}">${srcList.map(([u, n, f]) => `<option value="pub:${U.esc(u)}">${f ? f + ' ' : ''}${U.esc(n)}</option>`).join('')}</optgroup>
            ${s.authorized ? '<optgroup label="Мои чаты и группы (аккаунт)" data-acc><option disabled>загружаю…</option></optgroup>' : ''}</select></label>
          <label class="field" data-topic-wrap hidden><span>Тема</span><select class="input" data-topic></select></label>
          <label class="field"><span>Сколько последних сообщений</span><input class="input" type="number" data-lim value="300" min="20" max="3000"></label></div>
        ${s.authorized ? '' : pub ? '<div class="small muted">Посты читает сервер Norsk Kort — только из проверенных каналов, без входа в Телеграм.</div>' : '<div class="small muted">Закрытые группы и темы форумов — после входа в аккаунт (вкладка «Каналы и аккаунт»).</div>'}
        ${UI.switchHtml('tg-docs', true, 'Открывать ссылки на Google Документы со списками слов')}
        ${UI.switchHtml('tg-pics', false, 'Распознавать текст на картинках (дольше)')}
        <div class="row" style="gap:8px"><button class="btn primary" data-collect>🗂 Собрать слова</button><span class="small muted" data-log></span></div>
        <div data-out></div>`;
      const log = t => { el.querySelector('[data-log]').innerHTML = t ? `<span class="spinner sm"></span> ${U.esc(t)}` : ''; };
      if (s.authorized) {
        try {
          const ds = (await acc('dialogs')).dialogs;
          el.querySelector('[data-acc]').innerHTML = ds.map(d => `<option value="acc:${d.id}" data-forum="${d.forum ? 1 : 0}">${d.match ? '⭐ ' : ''}${d.forum ? '🗂 ' : d.group ? '👥 ' : '📢 '}${U.esc(d.name)}</option>`).join('');
        } catch (e) { el.querySelector('[data-acc]').innerHTML = `<option disabled>${U.esc(U.niceErr(e))}</option>`; }
      }
      el.querySelector('[data-src]').onchange = async ev => {
        const opt = ev.target.selectedOptions[0];
        const wrap = el.querySelector('[data-topic-wrap]');
        wrap.hidden = !(opt && opt.dataset.forum === '1');
        if (!wrap.hidden) {
          const sel = el.querySelector('[data-topic]');
          sel.innerHTML = '<option>загружаю темы…</option>';
          try { sel.innerHTML = '<option value="">Все темы</option>' + (await acc('topics', { chat: ev.target.value.slice(4) })).topics.map(t => `<option value="${t.id}">${U.esc(t.title)}</option>`).join(''); }
          catch (e) { sel.innerHTML = `<option value="">${U.esc(U.niceErr(e))}</option>`; }
        }
      };
      el.querySelector('[data-collect]').onclick = async () => {
        const v = el.querySelector('[data-src]').value;
        if (!v) { UI.toast('Выберите канал или чат', 'warn'); return; }
        const lim = U.clamp(+el.querySelector('[data-lim]').value || 300, 20, 3000);
        const on = k => el.querySelector(`[data-key="${k}"]`).checked;
        let posts = [], title = '';
        try {
          if (v.startsWith('pub:')) {
            const u = v.slice(4);
            let before = '';
            while (posts.length < lim) {
              log(`читаю @${u}: ${posts.length}…`);
              let part;
              if (pub) {
                const r = await tgPublic(u, { before });
                part = r.posts; title = r.channel.title;
                posts = posts.concat(part);
                if (!part.length || !r.next || r.next === before) break;
                before = r.next;
              } else {
                const html = await getVia(`https://t.me/s/${enc(u)}${before ? '?before=' + before : ''}`);
                part = parsePreview(html, u);
                if (!part.length) break;
                posts = posts.concat(part);
                title = part[0].chatTitle;
                before = Math.min(...part.map(x => x.id));
              }
              await new Promise(r => setTimeout(r, 500));
            }
          } else {
            const topic = el.querySelector('[data-topic]') && !el.querySelector('[data-topic-wrap]').hidden ? el.querySelector('[data-topic]').value : '';
            log('читаю сообщения…');
            const ms = (await acc('messages', { chat: v.slice(4), topic, limit: lim })).messages;
            posts = ms.map(fromAccount);
            title = (ms[0] && ms[0].chatTitle) || '';
            const tsel = el.querySelector('[data-topic]');
            if (topic && tsel) title += ' · ' + tsel.selectedOptions[0].textContent;
          }
          let rows = [];
          posts.forEach(p => pairs(p.text).forEach(r => rows.push(Object.assign(r, { link: p.link }))));
          if (on('tg-docs')) {
            const docs = [...new Set(posts.flatMap(p => (p.text.match(/https:\/\/docs\.google\.com\/document\/d\/[\w-]+/g) || [])))].slice(0, 15);
            for (const d of docs) {
              log(`Google Документ ${docs.indexOf(d) + 1}/${docs.length}…`);
              // off the Mac: the server's fetch-public kind gdoc-txt (only documents seen in a curated channel's post)
              const txt = () => (pub ? Net.get(d + '/export?format=txt', { kind: 'gdoc-txt', id: d.split('/d/')[1], as: 'text' }) : getVia(d + '/export?format=txt'));
              try { pairs(await txt()).forEach(r => rows.push(Object.assign(r, { link: d }))); } catch (e) { /* closed document */ }
            }
          }
          if (on('tg-pics')) {
            const pics = posts.filter(p => p.photos.length).slice(0, 40);
            for (const p of pics) {
              log(`картинки ${pics.indexOf(p) + 1}/${pics.length}…`);
              try { pairs(await ocr(p.photos[0])).forEach(r => rows.push(Object.assign(r, { link: p.link, pic: p.photos[0] }))); } catch (e) { /* skip */ }
            }
          }
          const seen = new Set(Store.cards().map(c => U.norm(c.no)));
          const fresh = [];
          rows.forEach(r => { const k = U.norm(r.no); if (r.ru && !seen.has(k)) { seen.add(k); fresh.push(r); } });
          log('');
          this.vocabPreview(el.querySelector('[data-out]'), fresh, title || 'Telegram', rows.length);
        } catch (e) { log(''); UI.toast(e && e.nk ? e.message : U.niceErr(e), 'warn', 6000); }
      };
    },
    /**
     * found pairs → 🛡 PairGuard: junk is set aside at once, every remaining pair is compared with a machine
     * translation. Only confirmed pairs are ticked; «? проверьте» ones wait for the user; «✗» ones are listed apart.
     */
    vocabPreview(outer, found, title, total) {
      // a fresh box each time «Собрать слова» is pressed (old listeners and the old check go away with it)
      outer.innerHTML = '';
      const out = document.createElement('div');
      outer.appendChild(out);
      const { keep, rejected } = PairGuard.clean(found);
      const rows = keep.map(r => Object.assign(r, { st: '', on: false, origRu: r.ru }));
      const rej = rejected;
      let verifying = true;
      const row = (r, i) => `<div class="tg-pair pg-row pg-${r.st || 'wait'}" data-row="${i}">
          <input type="checkbox" data-on="${i}" ${r.on ? 'checked' : ''} aria-label="Добавить эту пару">
          <input class="input" data-no="${i}" value="${U.esc(r.no)}" lang="nb" aria-label="Норвежский">
          <input class="input" data-ru="${i}" value="${U.esc(r.ru)}" aria-label="Перевод">
          <div class="pg-meta" data-meta="${i}">${meta(r, i)}</div>
        </div>`;
      const meta = (r, i) => `${PairGuard.badge(r)}
        ${r.st === 'unsure' ? `<span class="pg-why">${U.esc(r.why || '')}</span>` : ''}
        ${(r.st === 'unsure' || r.st === 'bad') && r.mt && r.ru !== r.mt ? `<button type="button" class="btn sm ghost" data-usemt="${i}" title="Вставить машинный перевод (будет помечен «перепроверьте»)">⚠️ взять машинный</button>` : ''}
        ${r.link ? `<a class="pg-link" href="${U.esc(r.link)}" target="_blank" rel="noopener" title="Открыть сообщение в Telegram">↗ пост</a>` : ''}`;
      const all = () => rows.concat(rej);
      const counts = () => { const c = { ok: 0, unsure: 0, bad: rej.length, on: 0 }; rows.forEach(r => { if (r.st === 'ok' || r.st === 'ai' || r.st === 'aifix') c.ok++; else if (r.st === 'unsure') c.unsure++; }); all().forEach(r => { if (r.on) c.on++; }); return c; };
      const sum = () => {
        const c = counts();
        return `<span>Найдено пар: <b>${total}</b>, новых для вас: <b>${found.length}</b>.</span>
          ${verifying ? `<span class="pg-b"><span class="spinner sm"></span> сверяю переводы: <b data-pgp>0</b> / ${rows.length}</span>` : ''}
          <span class="pg-b ok">✓ подтверждено: ${c.ok}</span> <span class="pg-b unsure">? проверьте: ${c.unsure}</span> <span class="pg-b bad">✗ отброшено: ${c.bad}</span>`;
      };
      out.innerHTML = `<div class="small pg-sum" data-sum style="margin:8px 0">${sum()}</div>
        <div class="mt-warn ok pg-how"><span>🛡</span><span>Каждая пара сверяется с машинным переводом. <b>Отмечены только подтверждённые.</b> «? проверьте» — перевод автора похож лишь частично (или это слово с другими синонимами): решите сами. Мусор и «не перевод» (хэштеги, ссылки, номера, фразы вроде «пишите в комментариях») — отдельно внизу.</span></div>
        <div class="pg-tools">
          <button class="btn sm" data-pgsel="ok">☑ Только подтверждённые</button>
          <button class="btn sm ghost" data-pgsel="none">Снять всё</button>
          ${AI.available() ? `<button class="btn sm ai" data-pgai title="Нейросеть проверит пары «? проверьте» и исправит неверный перевод">${BOT()} Проверить сомнительные (${U.esc(AI.name())})</button>` : `<span class="small muted">${BOT()} С нейросетью сомнительные пары можно проверить автоматически — подключите её в Настройках.</span>`}
        </div>
        <div class="tg-pairs pg-list" data-list>${rows.map(row).join('')}</div>
        <details class="pg-rej" ${rows.length ? '' : 'open'}><summary>✗ Отброшено — не перевод или мусор (<span data-rejn>${rej.length}</span>)</summary>
          <div class="tg-pairs pg-list" data-rej>${rej.map((r, k) => row(r, 'r' + k)).join('')}</div></details>
        ${Library.deckPicker(this._deckId || null, ('Словарь · ' + title).slice(0, 60))}
        <button class="btn primary" data-mk disabled>➕ Создать карточки</button>`;
      const get = i => String(i).startsWith('r') ? rej[+String(i).slice(1)] : rows[+i];
      const syncMk = () => {
        const n = counts().on;
        const b = out.querySelector('[data-mk]'); b.disabled = !n; b.textContent = n ? `➕ Создать ${U.cards(n)}` : '➕ Отметьте пары';
        out.querySelector('[data-sum]').innerHTML = sum();
      };
      const redraw = i => {
        const r = get(i), el = out.querySelector(`[data-row="${i}"]`); if (!el) return;
        el.className = `tg-pair pg-row pg-${r.st || 'wait'}`;
        el.querySelector('[data-on]').checked = !!r.on;
        el.querySelector(`[data-meta="${i}"]`).innerHTML = meta(r, i);
      };
      syncMk();
      // the translation check, in the background (batches of 40)
      (async () => {
        await PairGuard.verify(rows, done => { const p = out.querySelector('[data-pgp]'); if (p) p.textContent = done; }, () => !out.isConnected);
        verifying = false;
        if (!out.isConnected) return;
        // a box the user ticked / unticked during the check keeps the user's choice
        rows.forEach((r, i) => { if (!r.edited && !r.touched) r.on = r.st === 'ok'; redraw(i); });
        syncMk();
      })();
      out.addEventListener('change', e => {
        const t = e.target;
        if (t.matches('[data-on]')) { const r = get(t.dataset.on); r.on = t.checked; r.touched = true; syncMk(); }
      });
      out.addEventListener('input', e => {
        const t = e.target, k = t.dataset.ru != null ? t.dataset.ru : t.dataset.no;
        if (k == null) return;
        const r = get(k);
        if (t.dataset.ru != null) { r.ru = t.value.trim(); r.edited = true; r.byMe = r.ru !== r.origRu; }
        else r.no = t.value.trim();
        if (!r.on) { r.on = true; t.closest('.pg-row').querySelector('[data-on]').checked = true; syncMk(); }
      });
      out.addEventListener('click', async e => {
        const um = e.target.closest('[data-usemt]');
        if (um) {
          const i = um.dataset.usemt, r = get(i);
          r.ru = r.mt; r.useMt = true; r.edited = true; r.on = true;
          out.querySelector(`[data-ru="${i}"]`).value = r.mt;
          redraw(i); syncMk(); return;
        }
        const s = e.target.closest('[data-pgsel]');
        if (s) {
          all().forEach(r => { r.on = s.dataset.pgsel === 'ok' ? (r.st === 'ok' || r.st === 'ai' || r.st === 'aifix') : false; });
          rows.forEach((r, i) => redraw(i)); rej.forEach((r, k) => redraw('r' + k)); syncMk(); return;
        }
        const ai = e.target.closest('[data-pgai]');
        if (ai) {
          const list = rows.map((r, i) => ({ r, i })).filter(x => x.r.st === 'unsure');
          if (!list.length) { UI.toast(verifying ? 'Подождите — ещё сверяю переводы' : 'Сомнительных пар нет', '', 2500); return; }
          ai.disabled = true; ai.innerHTML = `<span class="spinner sm"></span> нейросеть проверяет ${list.length}…`;
          try {
            const res = await PairGuard.aiCheck(list.map(x => x.r));
            let okN = 0, fixN = 0;
            list.forEach((x, k) => {
              const v = res[k]; if (!v) return;
              if (v.ok) { x.r.st = 'ai'; x.r.on = true; okN++; }
              else if (v.ru) { x.r.st = 'aifix'; x.r.aiRu = v.ru; x.r.authorRu = x.r.ru; x.r.ru = v.ru; x.r.on = true; fixN++; out.querySelector(`[data-ru="${x.i}"]`).value = v.ru; }
              redraw(x.i);
            });
            syncMk();
            UI.toast(`🤖 Проверено: верно ${okN}, исправлено ${fixN}${list.length - okN - fixN ? `, без ответа ${list.length - okN - fixN}` : ''}`, 'good', 5000);
          } catch (err) { UI.toast('Нейросеть: ' + err.message, 'bad', 6000); }
          ai.disabled = false; ai.innerHTML = `${BOT()} Проверить сомнительные (${U.esc(AI.name())})`;
        }
      });
      out.querySelector('[data-mk]').onclick = async () => {
        const list = all().filter(r => r.on && r.no && r.ru);
        if (!list.length) return;
        const sel = out.querySelector('[data-o="deck"]').value;
        const deck = sel ? Store.deck(sel) : Store.addDeck(('Словарь · ' + title).slice(0, 60), 'Слова из Telegram — перевод от преподавателей, сверенный с машинным переводом');
        const aiKey = 'ai:' + (Translators.lastAI || AI.current());
        list.forEach(r => {
          const h = [Prov.entry('tr:telegram', 'import', null, `${title} · ${r.link || ''}`)];
          const mtKey = Translators.provKeys(r.mtBy && r.mtBy.length ? r.mtBy : ['google'])[0];
          let mtWarn = null, note = '';
          if (r.useMt) { h.push(Prov.entry(mtKey, 'translate', null, 'перевод автора не подошёл — взят машинный')); mtWarn = Translators.mtFlag(r.mtBy && r.mtBy.length ? r.mtBy : ['google']); }
          else if (r.st === 'aifix') { h.push(Prov.entry(aiKey, 'translate', null, `нейросеть исправила перевод автора «${r.authorRu}»`)); note = `\nПеревод автора: ${r.authorRu} (исправлен нейросетью)`; }
          else if (r.st === 'ai') h.push(Prov.entry(aiKey, 'verify', null, 'нейросеть подтвердила перевод автора'));
          else if (r.st === 'ok' && !r.byMe) h.push(Prov.entry(mtKey, 'verify', null, 'сверено с машинным переводом: совпадает'));
          if (r.byMe) h.push(Prov.entry('manual', 'edit', null, 'перевод поправлен вручную'));
          const unchecked = (r.st === 'unsure' || r.st === 'bad') && !r.byMe && !r.useMt;
          if (unchecked) note += `\n⚠️ Перевод автора не подтверждён сверкой${r.mt ? ` (машинный: «${r.mt}»)` : ''} — проверьте`;
          Store.addCard(deck.id, {
            no: r.no, ru: r.ru, en: r.en || '', description: `Источник: Telegram · ${title}${r.link ? ' · ' + r.link : ''}${note}`,
            tags: unchecked ? ['telegram', 'проверить'] : ['telegram'], history: h, mtWarn,
          });
        });
        Store.autoNameDeck(deck.id, title); // 🏷 a deck without a name: the chat's title
        await Store.saveNow();
        const unc = list.filter(r => (r.st === 'unsure' || r.st === 'bad') && !r.byMe && !r.useMt).length;
        UI.toast(`Создано ${U.cards(list.length)} в «${deck.name}» ✓${unc ? ` · ${unc} с пометкой «проверить»` : ''}`, unc ? 'warn' : 'good', 6000);
        UI.goTo('deck', { id: deck.id }); // closes the Telegram window properly (its onClose runs) and shows the deck
      };
    },

    /* ---- 📎 books (PDF) and audio (MP3) of a chat — account only ---- */
    async tab_files(el) {
      if (!macBridge()) { if (home()) this.noBridge(el); else this.siteAlt(el, 'files'); return; }
      if (!this.status.authorized) {
        el.innerHTML = `<div class="mt-warn">ℹ️ <span>Файлы (книги PDF, аудио MP3, голосовые) Telegram отдаёт только вашему аккаунту — веб-версия каналов их не показывает. Подключите аккаунт во вкладке «⚙️ Каналы и аккаунт» (один раз, 2 минуты).</span></div>`;
        return;
      }
      el.innerHTML = `<div class="field-row"><label class="field"><span>Чат / канал</span><select class="input" data-fchat><option>загружаю…</option></select></label>
        <label class="field"><span>Что показать</span><select class="input" data-fkind><option value="doc">📄 Книги и документы</option><option value="music">🎵 Аудио (MP3)</option><option value="voice">🎙 Голосовые</option><option value="video">🎬 Видео</option></select></label></div>
        <button class="btn primary" data-fgo>Показать</button><div data-flist class="tg-files"></div>`;
      try { el.querySelector('[data-fchat]').innerHTML = (await acc('dialogs')).dialogs.map(d => `<option value="${d.id}">${d.match ? '⭐ ' : ''}${U.esc(d.name)}</option>`).join(''); } catch (e) { UI.toast(e.message, 'bad'); }
      el.querySelector('[data-fgo]').onclick = async () => {
        const list = el.querySelector('[data-flist]');
        list.innerHTML = '<span class="spinner sm"></span>';
        try {
          const ms = (await acc('messages', { chat: el.querySelector('[data-fchat]').value, kind: el.querySelector('[data-fkind]').value, limit: 100 })).messages;
          const size = b => b > 1e6 ? (b / 1e6).toFixed(1) + ' МБ' : Math.round(b / 1e3) + ' КБ';
          list.innerHTML = ms.length ? ms.map(x => {
            const url = mediaUrl(x.chat, x.id);
            const isPdf = /pdf/.test(x.mime);
            const isAudio = /audio|ogg/.test(x.mime) || x.kind === 'audio';
            const isVideo = x.kind === 'video';
            return `<div class="tg-post"><div class="tg-post-head">${isPdf ? '📕' : isAudio ? '🎧' : isVideo ? '🎬' : '📄'} <b>${U.esc(x.name || (x.text || '').slice(0, 60) || 'файл')}</b><span class="small muted">${size(x.size)} · ${new Date(x.date).toLocaleDateString('ru-RU')}</span><span class="grow"></span><a class="small" href="${U.esc(x.link)}" target="_blank" rel="noopener">↗</a></div>
              ${x.text ? `<div class="small muted">${U.esc(x.text.slice(0, 200))}</div>` : ''}
              ${isAudio ? `<audio controls preload="none" src="${url}"></audio>` : ''}
              <div class="row" style="gap:6px">${isPdf ? `<button class="btn sm primary" data-read="${url}">📖 Читать здесь</button><button class="btn sm listen-btn" data-tlisten="${url}" data-name="${U.esc(x.name || 'Книга')}">${Listen.HEADPHONES(16, true)} Слушать вслух</button>` : ''}${isVideo ? `<button class="btn sm primary" data-play="${url}">▶ Смотреть</button>` : ''}<a class="btn sm" href="${url}&dl=1">⬇ Скачать</a></div></div>`;
          }).join('') : '<div class="small muted">Файлов такого типа нет.</div>';
        } catch (e) { list.innerHTML = `<div class="mt-warn">⚠️ <span>${U.esc(U.niceErr(e))}</span></div>`; }
      };
      el.addEventListener('click', e => {
        const r = e.target.closest('[data-read]');
        if (r) UI.modal({ title: '📖 Книга из Telegram', cls: 'wide', body: `<iframe src="${r.dataset.read}" style="width:100%;height:78vh;border:0;border-radius:12px;background:#fff"></iframe>` });
        const tl = e.target.closest('[data-tlisten]');
        if (tl) {
          Listen.prime();
          (async () => {
            tl.disabled = true; tl.innerHTML = '<span class="spinner sm"></span> готовлю…';
            try {
              const pdf = await (await U.lib.pdf()).getDocument({ data: await (await fetch(tl.dataset.tlisten)).arrayBuffer() }).promise;
              const pages = [];
              for (let n = 1; n <= Math.min(pdf.numPages, 200); n++) {
                const tc = await (await pdf.getPage(n)).getTextContent();
                const text = tc.items.map(z => z.str + (z.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ').trim();
                if (text.length > 20) pages.push({ title: `${tl.dataset.name} · стр. ${n}`, text });
              }
              if (pages.length) Listen.startText(tl.dataset.name, pages, { loop: false });
              else UI.toast('В этой книге текст — картинкой, вслух не прочитать', 'warn', 5000);
            } catch (err) { UI.toast(err.message, 'bad', 5000); }
            tl.disabled = false; tl.innerHTML = `${Listen.HEADPHONES(16, true)} Слушать вслух`;
          })();
          return;
        }
        const v = e.target.closest('[data-play]');
        if (v) v.closest('.tg-post').insertAdjacentHTML('beforeend', `<video controls autoplay playsinline src="${v.dataset.play}" style="width:100%;border-radius:12px;margin-top:6px"></video>`);
      });
    },

    /** 🌐 off the Mac: the user's own (not curated) channels are never read inside the app — Telegram's own search, one link each */
    async otherLinks(box, q) {
      if (!box) return;
      const cur = new Set((await curatedList()).map(c => c.username.toLowerCase()));
      const other = myChannels().filter(([u]) => !cur.has(String(u).toLowerCase()));
      box.innerHTML = q && other.length ? `<details class="tg-other"><summary>Ещё ${other.length} ${U.plural(other.length, ['канал', 'канала', 'каналов'])} из вашего списка — поиск откроется в Телеграме</summary>
          <div class="yt-links">${other.map(([u, n, f]) => `<a class="chip tg-site-link" target="_blank" rel="noopener noreferrer" href="https://t.me/s/${enc(u)}?q=${enc(q)}">${f} ${U.esc(n)} ↗</a>`).join('')}</div></details>` : '';
    },
    /** the site (no bridge): what to do instead — kind, friendly, no technical words */
    siteAlt(el, what) {
      const t = {
        vocab: ['🗂 Слова из канала — в карточки', 'Откройте канал в «📢 Норвежские каналы» → «📖 Читать здесь». Под каждым постом есть кнопка «➕ В карточки»: скопируйте слова из поста — приложение сделает карточки и проверит перевод.'],
        files: ['📎 Книги и аудио из каналов', 'Файлы каналов Телеграм отдаёт только своему приложению. Откройте канал в Телеграме — там книги и аудио можно скачать, а потом добавить в приложение через «Что вы хотите выучить?».'],
        setup: ['📢 Каналы без входа', 'Открытые норвежские каналы читаются прямо здесь, без входа в Телеграм. Свой канал можно добавить во вкладке «📢 Норвежские каналы».'],
      }[what] || ['📢 Норвежские каналы', 'Открытые каналы читаются прямо здесь, без входа в Телеграм.'];
      el.innerHTML = `<div class="tgv-gate">${TG_SVG(40)}<b>${t[0]}</b><p>${t[1]}</p><button type="button" class="btn primary" data-tgtochan>📢 Норвежские каналы</button></div>`;
      el.querySelector('[data-tgtochan]').onclick = () => toChannels(el);
    },

    /* ---- ⚙️ channels on/off, add your own, account login guide ---- */
    tab_setup(el) {
      const s = this.status;
      if (!s.bridge && !home()) { this.siteAlt(el, 'setup'); return; }
      const off = new Set(st().tgOff || []);
      el.innerHTML = `
        ${s.bridge ? '' : `<div class="mt-warn">${IC('info', 18)} <span><b>Мост на Mac не запущен.</b> В Терминале, в папке приложения: <code style="user-select:all">python3 bridge/server.py</code> — и откройте http://localhost:8787. На телефоне свой Telegram не подключается — там открытые каналы читаются без входа.</span></div>`}
        <h3 style="margin:10px 0 4px">📢 Публичные каналы (без входа)</h3>
        <div class="tg-chlist">${CHANNELS.concat((st().tgExtra || []).map(u => [u, '@' + u, '➕'])).map(([u, n, f]) => `<label class="switch"><input type="checkbox" data-ch="${U.esc(u)}" ${off.has(u) ? '' : 'checked'}><span class="track"></span><span>${f} ${U.esc(n)} <a class="small" href="https://t.me/${U.esc(u)}" target="_blank" rel="noopener">@${U.esc(u)}</a></span></label>`).join('')}</div>
        <div class="row" style="gap:6px;margin-top:6px"><input class="input" data-newch placeholder="добавить канал: @username или ссылка t.me/…" style="max-width:340px"><button class="btn sm" data-addch>＋ Добавить</button></div>
        <h3 style="margin:16px 0 4px">👤 Мой аккаунт — закрытые группы, темы, книги и аудио</h3>
        ${s.authorized ? `<div class="row" style="gap:8px;align-items:center"><span class="small" style="color:var(--good)">✓ Подключён: ${U.esc(s.me || '')}. Поиск идёт и по вашим чатам с «norsk / норвеж» в названии.</span>
            <button class="btn sm ghost" data-tglogout>Выйти из аккаунта</button></div>`
          : `<div class="small" style="margin:4px 0 8px">Закрытые группы, темы форумов («Словарный запас»), книги PDF и аудио Telegram отдаёт только вашему аккаунту. Подключение — один раз, около 3 минут, всё здесь, пошагово.</div>
            <button class="btn primary" data-tglogin>🔐 Подключить мой Telegram — пошагово</button>
            ${s.error ? `<div class="small" style="color:var(--warn);margin-top:6px">${U.esc(s.error)}</div>` : ''}`}`;
      const lb = el.querySelector('[data-tglogin]');
      if (lb) lb.onclick = () => this.loginWizard(() => { this.accStatus().then(() => this.tab_setup(el)); });
      const lo = el.querySelector('[data-tglogout]');
      if (lo) lo.onclick = async () => {
        if (!(await UI.confirm('Выйти из Telegram в этом приложении?<br><span class="small muted">Вход и ключи будут удалены с этого устройства. Ваш аккаунт Telegram не пострадает.</span>', { ok: 'Выйти', danger: true }))) return;
        try { await tgLogin('logout'); UI.toast('Вы вышли из Telegram в приложении', 'good'); } catch (e) { UI.toast(e.message, 'bad'); }
        this.accStatus().then(() => this.tab_setup(el));
      };
      el.addEventListener('change', e => {
        const c = e.target.closest('[data-ch]'); if (!c) return;
        const set = new Set(st().tgOff || []);
        if (c.checked) set.delete(c.dataset.ch); else set.add(c.dataset.ch);
        Store.setSetting('tgOff', [...set]);
      });
      el.querySelector('[data-addch]').onclick = () => {
        const v = el.querySelector('[data-newch]').value.trim().replace(/^https?:\/\/t\.me\/(s\/)?/, '').replace(/^@/, '').split(/[/?]/)[0];
        if (!/^[A-Za-z0-9_]{4,40}$/.test(v)) { UI.toast('Введите @username канала', 'warn'); return; }
        Store.setSetting('tgExtra', [...new Set([...(st().tgExtra || []), v])]);
        this.tab_setup(el);
        UI.toast(`Канал @${v} добавлен`, 'good');
      };
    },
  };

  /* ---------------- 🔐 connect YOUR Telegram — a guided window (no Terminal) ----------------
   * 1 the module (one click) · 2 your keys from my.telegram.org (with a guide) · 3 log in: QR code (recommended) or
   * phone + code · 4 the cloud password, if you have one. The keys and the login stay ONLY on this device (the Mac
   * bridge keeps them in ~/.config/norsk-kort, readable only by your macOS user); the code and the password go
   * straight to Telegram. Read-only: the app never writes or sends anything in your name. */
  async function tgLogin(step, body) {
    let r;
    try { r = await fetch('/api/tg/login/' + step, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); }
    catch (e) { throw new Error('мост на Mac не отвечает'); }
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 && /not found/.test(j.error || '')) throw Object.assign(new Error('мост на Mac старой версии — перезапустите его (Ctrl+C и снова python3 …/bridge/server.py)'), { old: true });
    if (!r.ok) throw Object.assign(new Error(j.error || 'ошибка ' + r.status), { install: !!j.install });
    return j;
  }
  let qrLib = null;
  const loadQr = () => qrLib || (qrLib = new Promise((res, rej) => { if (window.qrcode) { res(window.qrcode); return; } const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'; s.onload = () => res(window.qrcode); s.onerror = () => { qrLib = null; rej(new Error('QR не загрузился')); }; document.head.appendChild(s); }));

  Telegram.loginWizard = async function (onDone) {
    let step = 'keys', timer = 0, closed = false, mid = false; // mid: the QR code waits / the code was sent / the cloud password is asked
    const m = UI.modal({
      title: `${TG_SVG(24)} Подключить мой Telegram`, cls: 'tgl-modal',
      beforeClose: UI.guard(() => !mid ? null : { title: 'Прервать вход в Telegram?', line: 'Вход не завершён — в следующий раз начнёте этот шаг заново. Ключи уже сохранены.',
        actions: [{ label: 'Выйти', value: 'close', cls: 'bad' }], cancel: 'Продолжить вход' }),
      body: `<div class="tgl-steps" data-steps></div><div data-box></div>
        <div class="tgl-safe"><span>🔒</span><span><b>Безопасно.</b> Ключи и вход хранятся <b>только на этом устройстве</b> (на вашем Mac, в папке, которую может читать только ваша учётная запись) и никуда не отправляются, кроме самого Telegram. Приложение <b>только читает</b>: ничего не пишет и не отправляет от вашего имени. Отключить можно в любой момент: кнопка «Выйти» здесь или Telegram → Настройки → Устройства.</span></div>`,
      onClose: () => { closed = true; clearTimeout(timer); },
    });
    const box = m.$('[data-box]');
    const steps = [['keys', '1 · Ключи'], ['login', '2 · Вход'], ['done', '3 · Готово']];
    // a new step starts at the top (on a phone the «Save» button sits far down — the next step would open mid-way)
    const drawSteps = () => { const sc = m.$('.modal-body'); if (sc) sc.scrollTop = 0; m.$('[data-steps]').innerHTML = steps.map(([k, t]) => `<span class="tgl-step ${k === step ? 'on' : steps.findIndex(x => x[0] === step) > steps.findIndex(x => x[0] === k) ? 'ok' : ''}">${t}</span>`).join(''); };
    const err = (e) => { const x = box.querySelector('[data-err]'); if (x) x.innerHTML = `⚠️ ${U.esc(U.niceErr(e))}`; };
    const busy = (b, on, txt) => { if (!b) return; b.disabled = on; if (on) { b.dataset.l = b.innerHTML; b.innerHTML = `<span class="spinner sm"></span> ${txt || ''}`; } else if (b.dataset.l) b.innerHTML = b.dataset.l; };

    const showInstall = () => {
      box.innerHTML = `<div class="tgl-card"><b>Сначала — модуль Telegram для приложения</b><p class="small">Устанавливается один раз, около минуты, автоматически.</p>
        <button class="btn primary" data-install>⬇ Установить модуль Telegram</button><div class="small tgl-err" data-err></div></div>`;
      box.querySelector('[data-install]').onclick = async e => {
        const b = e.currentTarget; busy(b, true, 'Устанавливаю…');
        try { await tgLogin('install'); UI.toast('Модуль Telegram установлен', 'good'); showKeys(); } catch (x) { busy(b, false); err(x); }
      };
    };
    const showKeys = () => {
      step = 'keys'; mid = false; drawSteps();
      box.innerHTML = `<div class="tgl-card">
        <b>Шаг 1. Ваши личные ключи Telegram</b>
        <p class="small muted">Telegram даёт каждому человеку свои ключи для программ — бесплатно. Они нужны, чтобы приложение могло читать ваши чаты.</p>
        <ol class="tgl-howto">
          <li>Откройте <a href="https://my.telegram.org/apps" target="_blank" rel="noopener"><b>my.telegram.org</b> ↗</a> и войдите своим номером телефона. <span class="muted">Код придёт <b>в приложение Telegram</b> (не по SMS).</span></li>
          <li>Нажмите <b>«API development tools»</b>.</li>
          <li>Заполните форму (если её нет — приложение уже создано, переходите к шагу 4):
            <div class="tgl-form"><span>App title:</span><code>Norsk Kort</code><span>Short name:</span><code>norskkort</code><span>URL:</span><i class="muted">можно оставить пустым</i><span>Platform:</span><code>Desktop</code><span>Description:</span><i class="muted">любое, например «изучаю норвежский»</i></div>
            и нажмите <b>«Create application»</b>.</li>
          <li>Скопируйте два значения и вставьте ниже: <b>App api_id</b> (число) и <b>App api_hash</b> (32 знака).</li>
        </ol>
        <div class="tgl-inputs">
          <label class="field"><span>App api_id</span><input class="input" data-id inputmode="numeric" autocomplete="off" placeholder="например 1234567"></label>
          <label class="field"><span>App api_hash</span><span class="tgl-pw"><input class="input" data-hash type="password" autocomplete="off" spellcheck="false" placeholder="32 знака: буквы a–f и цифры"><button type="button" class="btn sm ghost" data-show title="Показать / скрыть">👁</button></span></label>
        </div>
        <div class="small tgl-err" data-err></div>
        <button class="btn primary" data-save>Сохранить ключи и продолжить →</button></div>`;
      box.querySelector('[data-show]').onclick = () => { const i = box.querySelector('[data-hash]'); i.type = i.type === 'password' ? 'text' : 'password'; };
      box.querySelector('[data-save]').onclick = async e => {
        const b = e.currentTarget;
        const id = box.querySelector('[data-id]').value.trim(), hash = box.querySelector('[data-hash]').value.trim();
        if (!/^\d{3,12}$/.test(id) || !/^[0-9a-f]{32}$/i.test(hash)) { err(new Error('Проверьте: api_id — только цифры, api_hash — ровно 32 знака (буквы a–f и цифры)')); return; }
        busy(b, true, 'Сохраняю…');
        try { const r = await tgLogin('creds', { api_id: id, api_hash: hash }); if (r.authorized) showDone((await Telegram.accStatus()).me); else showLogin(); }
        catch (x) { busy(b, false); if (x.install) showInstall(); else err(x); }
      };
    };
    const showLogin = (how = 'qr') => {
      step = 'login'; mid = true; drawSteps(); clearTimeout(timer);
      box.innerHTML = `<div class="tgl-card"><b>Шаг 2. Вход в ваш Telegram</b>
        <div class="seg-mini tgl-how"><button data-how="qr" class="${how === 'qr' ? 'active' : ''}">📷 QR-код (проще)</button><button data-how="phone" class="${how === 'phone' ? 'active' : ''}">📱 Номер телефона</button></div>
        <div data-way></div><div class="small tgl-err" data-err></div></div>`;
      box.querySelectorAll('[data-how]').forEach(b => { b.onclick = () => showLogin(b.dataset.how); });
      const way = box.querySelector('[data-way]');
      if (how === 'qr') {
        way.innerHTML = `<div class="mt-warn ok tgl-why"><span>💡</span><span><b>QR-код — если номер телефона не работает</b> (старая SIM-карта, нет SMS) или вы не уверены в нём. Нужен только телефон, где Telegram уже открыт. <b>Сканируйте внутри приложения Telegram</b>, а не обычной камерой телефона — обычная камера войти не сможет.</span></div>
          <div class="tgl-qr-wrap"><div class="tgl-qr" data-qr><span class="spinner"></span></div>
          <div class="tgl-os">
            <div class="tgl-osbox"><b>📱 iPhone</b><ol class="tgl-howto small">
              <li>Откройте приложение <b>Telegram</b>.</li>
              <li>Внизу справа — вкладка <b>«Настройки»</b> (⚙️).</li>
              <li><b>«Устройства»</b> → синяя кнопка <b>«Подключить устройство»</b>.</li>
              <li>Откроется сканер Telegram — наведите его на этот QR-код.</li></ol></div>
            <div class="tgl-osbox"><b>🤖 Android</b><ol class="tgl-howto small">
              <li>Откройте приложение <b>Telegram</b>.</li>
              <li>Слева вверху — меню <b>☰</b> (три полоски) → <b>«Настройки»</b>.</li>
              <li><b>«Устройства»</b> → <b>«Подключить устройство»</b> (Link Desktop Device).</li>
              <li>Откроется сканер Telegram — наведите его на этот QR-код.</li></ol></div>
          </div></div>
          <p class="tiny muted">Telegram на компьютере или в браузере сканировать не умеет — нужен телефон. Код обновляется сам каждые ~30 секунд; вход появится здесь автоматически. Если Telegram попросит подтвердить вход — нажмите «Да / Принять».</p>`;
        const draw = async url => { try { const q = (await loadQr())(0, 'M'); q.addData(url); q.make(); const el = way.querySelector('[data-qr]'); if (el) el.innerHTML = q.createSvgTag(5, 0); } catch (x) { err(x); } };
        const poll = async () => {
          if (closed || step !== 'login' || !way.isConnected) return;
          try {
            const r = await tgLogin('qrwait');
            if (r.authorized) { showDone(r.me); return; }
            if (r.password) { showPassword(); return; }
            if (r.url) draw(r.url);
          } catch (x) { err(x); }
          timer = setTimeout(poll, 2500);
        };
        tgLogin('qr').then(r => { if (r.authorized) showDone(r.me); else { draw(r.url); timer = setTimeout(poll, 2500); } }).catch(err);
      } else {
        way.innerHTML = `<div class="small muted" style="margin-bottom:6px">Код придёт <b>в приложение Telegram</b> (сообщение от «Telegram») на устройстве, где вы уже вошли, — не по SMS. Если номер не работает и Telegram нигде не открыт — используйте <a href="#" data-to-qr>QR-код</a>.</div>
          <label class="field"><span>Номер телефона (с кодом страны)</span><input class="input" data-phone type="tel" autocomplete="tel" placeholder="+47 …"></label>
          <button class="btn primary" data-send>Получить код</button>
          <div data-codebox hidden><label class="field"><span>Код — пришёл <b>в приложение Telegram</b> (сообщение от «Telegram»)</span><input class="input" data-code inputmode="numeric" autocomplete="one-time-code" placeholder="5 цифр"></label>
            <button class="btn primary" data-sign>Войти</button></div>`;
        way.querySelector('[data-to-qr]').onclick = e => { e.preventDefault(); showLogin('qr'); };
        way.querySelector('[data-send]').onclick = async e => {
          const b = e.currentTarget; busy(b, true, 'Отправляю…');
          try { await tgLogin('phone', { phone: way.querySelector('[data-phone]').value }); way.querySelector('[data-codebox]').hidden = false; way.querySelector('[data-code]').focus(); busy(b, false); b.textContent = 'Отправить код ещё раз'; }
          catch (x) { busy(b, false); err(x); }
        };
        way.querySelector('[data-sign]').onclick = async e => {
          const b = e.currentTarget; busy(b, true, 'Вхожу…');
          try { const r = await tgLogin('code', { code: way.querySelector('[data-code]').value }); if (r.password) showPassword(); else showDone(r.me); }
          catch (x) { busy(b, false); err(x); }
        };
      }
    };
    const showPassword = () => {
      clearTimeout(timer); mid = true;
      box.innerHTML = `<div class="tgl-card"><b>Облачный пароль</b>
        <p class="small muted">У вас включена двухэтапная проверка — введите её пароль (тот, что вы задали в Telegram → Конфиденциальность → Облачный пароль). Он уходит только в Telegram.</p>
        <label class="field"><span>Облачный пароль</span><input class="input" data-pw type="password" autocomplete="current-password"></label>
        <div class="small tgl-err" data-err></div><button class="btn primary" data-go>Войти</button></div>`;
      const go = async e => {
        const b = box.querySelector('[data-go]'); busy(b, true, 'Вхожу…');
        try { const r = await tgLogin('password', { password: box.querySelector('[data-pw]').value }); showDone(r.me); } catch (x) { busy(b, false); err(x); }
      };
      box.querySelector('[data-go]').onclick = go;
      box.querySelector('[data-pw]').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    };
    const showDone = me => {
      step = 'done'; mid = false; drawSteps(); clearTimeout(timer);
      box.innerHTML = `<div class="tgl-card tgl-done"><div class="tgl-big">✓</div><b>Telegram подключён${me ? `: ${U.esc(me)}` : ''}</b>
        <p class="small">Теперь доступны ваши группы и темы форумов («Словарный запас»), книги PDF и аудио — во вкладках «Создать карточки из чата» и «Книги и аудио».</p>
        <button class="btn primary" data-fin>Готово</button></div>`;
      box.querySelector('[data-fin]').onclick = () => m.close();
      if (onDone) onDone();
    };
    drawSteps();
    box.innerHTML = '<div class="tgl-card"><span class="spinner sm"></span> Проверяю…</div>';
    const s = await Telegram.accStatus();
    if (closed) return;
    if (!s.bridge && !home()) {
      // the site: nothing to connect — open channels are read without logging in
      m.$('[data-steps]').innerHTML = ''; const safe = m.$('.tgl-safe'); if (safe) safe.remove();
      box.innerHTML = `<div class="tgl-card tgl-done"><div class="tgl-big">🙌</div><b>Входить в Телеграм не нужно</b>
        <p class="small">Открытые норвежские каналы читаются прямо здесь — без входа и без регистрации. Свежие посты, картинки и видео — во вкладке «📢 Норвежские каналы».</p>
        <button class="btn primary" data-tgsite>📢 Норвежские каналы</button></div>`;
      box.querySelector('[data-tgsite]').onclick = () => { m.close(); Telegram.open(null, 'channels'); };
      return;
    }
    if (!s.bridge) { box.innerHTML = `<div class="tgl-card">${IC('info', 18)} Подключение работает через мост на Mac — запустите его (в папке приложения: python3 bridge/server.py) и откройте приложение через него (http://localhost:8787).</div>`; return; }
    if (s.authorized) showDone(s.me);
    else if (s.installed === false) showInstall();
    else if (s.configured) showLogin();
    else showKeys();
  };

  /* touch targets ≥ 44 px on phones and the state line (phone audit 2026-11-23). The window's main styles live in css/tgvideo.css
   * (another workstream's file) — these few rules are scoped to the Telegram / «Ещё источники» windows and added once. */
  (function style() {
    if (typeof document === 'undefined' || document.getElementById('nk-tg-touch')) return;
    const st = document.createElement('style');
    st.id = 'nk-tg-touch';
    st.textContent = `@media (pointer: coarse) {
  .tg-modal .tg-tabs .chip, .social-modal .tg-tabs .chip, .tg-modal .tg-kinds .chip, .tg-modal .btn.sm, .social-modal .btn.sm,
  .tg-modal .tcn-foot .btn, .tg-modal .tgc-acts .btn, .tg-modal .yt-links .chip, .tg-modal .tcn-more, .tg-modal .tcn-open { min-height: 44px; }
  .tg-modal .tg-tabs .chip, .social-modal .tg-tabs .chip, .tg-modal .yt-links .chip, .tg-modal .tcn-open { display: inline-flex; align-items: center; }
}
.tg-state { display: inline-flex; align-items: center; gap: 5px; }
.tg-state .ui-ico { flex: none; }
.tg-other { margin-top: 10px; }
.tg-other > summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; color: var(--muted); }
.tg-other > summary:hover { color: var(--text); }`;
    (document.head || document.documentElement).appendChild(st);
  })();

  window.Telegram = Telegram;
})();
