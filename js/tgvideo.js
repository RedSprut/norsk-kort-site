/* ============ ✈️ «Telegram-авторы: видео» — an author's videos inside the app ============
 * Read-only, through YOUR Telegram account on the Mac bridge (bridge/tg.py — only your own channels / groups):
 *  - the authors: your channels and groups (Norwegian ones first) → an author's page: a grid of their videos
 *    (picture, caption, length, date), newest or oldest first, «Показать ещё» pages further back;
 *  - ▶ a video plays in the subtitle player (Subs.openStream({ kind: 'tg' })): the bridge streams it with HTTP Range
 *    (seeking works, nothing is downloaded whole first). Telegram has no subtitles — NB-Whisper makes them (the usual
 *    window explains and downloads the model once), with translation, glosses, «Aa», speed, cards (the line's sound is
 *    the author's own voice) and 🔎 «Найти слова в кадре». Card provenance: channel, author, the video's date, the
 *    moment, and the t.me/<channel>/<id> link for public channels;
 *  - 🎧 «Слушать автора»: the videos one after another, hands-free, in the listening player (Listen.startMedia —
 *    one <audio> element, Now Playing with the author / caption / «3 из 12», ⏮ ⏭ of the lock screen and headphones,
 *    the dark screen, the sleep timer, the place inside a video remembered). With ffmpeg on the Mac the next video is
 *    prepared as sound only (.m4a) while the current one plays.
 * Everything from Telegram is shown as text (U.esc).
 * W6: the personal Telegram session exists only on the Mac (bridge/tg.py). Everywhere else (the site, the store apps) the
 * tab is TgVideo.preview(): the curated public channels (data/tg-channels.json) through the server's tg-public, only their
 * posts with a video (or, for js/tgaudio.js, a sound); a post plays in Telegram's own embeddable widget, «Открыть в
 * Telegram» next to it. No server → the «Норвежские каналы» tab (Telegram's widgets work without it). A channel outside
 * the list is never shown here (not_curated → Net.linkOut). No «connect Telegram», no bridge words off the Mac.
 */
(function () {
  const enc = encodeURIComponent;
  const esc = s => U.esc(s == null ? '' : String(s));
  const ORDER_KEY = 'nk-tgv-order', RECENT_KEY = 'nk-tgv-recent';
  const ls = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* full / private mode */ } };
  const mss = t => { t = Math.max(0, Math.floor(t || 0)); const h = Math.floor(t / 3600); return h ? `${h}:${String(Math.floor(t % 3600 / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  const dateRu = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const hue = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 11);
  const initial = t => (String(t || '').replace(/[^\p{L}\p{N}]/gu, '')[0] || '✈').toUpperCase();
  const numRu = n => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' млн' : n >= 1e3 ? Math.round(n / 1e3) + ' тыс.' : String(n));
  const TG = s => (window.Telegram && Telegram.TG_SVG ? Telegram.TG_SVG(s) : '✈️');

  const streamUrl = (chat, msg) => `/api/tg/video?chat=${enc(chat)}&msg=${enc(msg)}`;
  const thumbUrl = (chat, msg) => `/api/tg/media?chat=${enc(chat)}&msg=${enc(msg)}&thumb=1`;
  const pcmUrl = (chat, msg) => `/api/tg/pcm?chat=${enc(chat)}&msg=${enc(msg)}`;
  /** the caption's first meaningful line → the video's title */
  function capTitle(v) {
    const line = String(v.caption || '').split('\n').map(s => s.trim()).find(s => /\p{L}/u.test(s)) || '';
    return line ? (line.length > 90 ? line.slice(0, 88) + '…' : line) : `Видео от ${dateRu(v.date)}`;
  }
  const linkOf = (info, v) => (info && info.public && info.username ? `https://t.me/${info.username}/${v.id}` : '');

  const home = () => !!(window.Telegram && Telegram.home ? Telegram.home() : (window.Net && Net.onMac && Net.onMac()));
  // the bridge's words only on the Mac itself (never «запустите мост» to a visitor of the site)
  const OLD = () => (home() ? 'Мост на Mac старой версии — перезапустите его (в Терминале Ctrl+C, затем снова python3 bridge/server.py)' : 'Это видео сейчас недоступно здесь — откройте канал в Telegram');
  async function api(action, params = {}) {
    let r;
    try { r = await fetch(`/api/tg/${action}?` + new URLSearchParams(params)); } catch (e) { throw new Error(!home() ? 'Это видео сейчас недоступно здесь — откройте канал в Telegram' : 'Мост на Mac не отвечает — запустите его и попробуйте снова'); }
    const ct = r.headers.get('Content-Type') || '';
    if (!/json/.test(ct)) throw new Error(OLD());
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 && /unknown action/.test(j.error || '')) throw new Error(OLD());
    if (!r.ok) throw new Error(j.error || 'Telegram не ответил — попробуйте ещё раз');
    return j;
  }

  const TgVideo = {
    streamUrl, thumbUrl, capTitle,
    /** ✈️ the standalone window («Что послушать?», a link): authors → an author's videos */
    open(chat) {
      const m = UI.modal({ title: `${TG(24)} Telegram-авторы · видео`, cls: 'wide tgv-modal', body: '<div class="tgv" data-tgv-root></div>' });
      this.render(m.$('[data-tgv-root]'), { chat, m });
      return m;
    },
    /** el: where to draw (the Telegram window's tab or the standalone window) */
    async render(el, o = {}) {
      el.classList.add('tgv');
      el.innerHTML = '<div class="tgv-wait"><span class="spinner sm"></span> загружаю…</div>';
      const ok = await this.gate(el);
      if (!ok) return;
      if (o.chat) this.author(el, o.chat, o); else this.authors(el, o);
    },
    /** bridge + Telegram connected? Otherwise a clear explanation (no technical errors) */
    async gate(el) {
      const up = window.AI && AI.bridge && AI.bridge.up;
      if (!up && !home()) {
        // the site / the store apps: no personal Telegram here — the curated public channels' videos (tg-public)
        TgVideo.preview(el, 'video');
        return false;
      }
      if (!up) {
        // the Mac itself, the bridge is off (only here: the bridge's words)
        el.innerHTML = `<div class="tgv-gate">${TG(40)}<b>Видео авторов открываются через приложение на Mac</b>
          <p>Telegram показывает видео каналов только вашему аккаунту. Его читает «мост» — маленькая программа на вашем Mac: запустите её и откройте приложение по адресу <b>http://localhost:8787</b>.</p>
          <p class="small muted">В Терминале, в папке приложения: <code style="user-select:all">python3 bridge/server.py</code></p></div>`;
        return false;
      }
      if (window.Telegram && (!Telegram.status || Telegram.status.authorized === undefined)) { try { await Telegram.accStatus(); } catch (e) { /* shown below */ } }
      const s = (window.Telegram && Telegram.status) || {};
      if (!s.authorized) {
        el.innerHTML = `<div class="tgv-gate">${TG(40)}<b>Подключите свой Telegram</b>
          <p>Тогда здесь появятся видео из ваших каналов и групп — смотреть с субтитрами и переводом или слушать подряд, как подкаст. Подключение — один раз, около 3 минут, пошагово.</p>
          <button type="button" class="btn primary" data-tgv-login>🔐 Подключить мой Telegram</button></div>`;
        el.querySelector('[data-tgv-login]').onclick = () => { const mm = el.closest('.modal-backdrop'); if (mm && mm._m && !el.closest('.tg-modal')) mm._m.close(); Telegram.open(null, 'setup'); };
        return false;
      }
      return true;
    },

    /* ---------------- the authors ---------------- */
    async authors(el, o = {}) {
      el.innerHTML = `<div class="tgv-top"><div><h3 class="tgv-h">🎬 Видео авторов</h3><p class="tgv-sub">Ваши каналы и группы. Выберите автора — его видео можно смотреть с субтитрами или слушать подряд.</p></div>
          <input class="input tgv-find" data-tgv-find type="search" placeholder="🔎 Найти канал" aria-label="Найти канал"></div>
        <div class="tgv-authors" data-tgv-authors><div class="tgv-wait"><span class="spinner sm"></span> загружаю ваши каналы…</div></div>`;
      let list = [];
      try { list = (await api('dialogs')).dialogs || []; } catch (e) { el.querySelector('[data-tgv-authors]').innerHTML = `<div class="mt-warn">⚠️ <span>${esc(U.niceErr(e))}</span></div>`; return; }
      const recent = ls(RECENT_KEY, []);
      const rank = d => (recent.indexOf(d.id) >= 0 ? recent.indexOf(d.id) : 99) * 4 + (d.match ? 0 : 2) + (d.kind === 'channel' ? 0 : 1);
      list.sort((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name), 'ru'));
      const row = d => `<button type="button" class="tgv-author" data-tgv-chat="${esc(d.id)}" style="--h:${hue(d.id)}">
          <span class="tgv-ava" aria-hidden="true">${esc(initial(d.name))}</span>
          <span class="tgv-an"><b>${esc(d.name)}</b><small>${d.username ? '@' + esc(d.username) : 'закрытая группа'} · ${d.kind === 'channel' ? 'канал' : 'группа'}${d.count ? ' · 👥 ' + numRu(d.count) : ''}${d.match ? ' · 🇳🇴' : ''}${recent.includes(d.id) ? ' · недавно' : ''}</small></span>
          <span class="tgv-go" aria-hidden="true">›</span></button>`;
      const draw = q => {
        const k = String(q || '').trim().toLowerCase();
        const sel = list.filter(d => !k || String(d.name).toLowerCase().includes(k) || String(d.username || '').toLowerCase().includes(k));
        el.querySelector('[data-tgv-authors]').innerHTML = sel.length ? sel.map(row).join('')
          : list.length ? '<div class="small muted">Такого канала нет среди ваших.</div>' : '<div class="tgv-gate small"><b>Пока нет ни одного канала</b><p>Подпишитесь в Telegram на норвежские каналы — они появятся здесь.</p></div>';
      };
      draw('');
      el.querySelector('[data-tgv-find]').addEventListener('input', e => draw(e.target.value));
      el.querySelector('[data-tgv-authors]').addEventListener('click', e => {
        const b = e.target.closest('[data-tgv-chat]'); if (!b) return;
        this.author(el, b.dataset.tgvChat, o);
      });
    },

    /* ---------------- one author: the video grid ---------------- */
    async author(el, chat, o = {}) {
      const S = { chat: String(chat), info: null, videos: [], next: 0, ffmpeg: false, order: ls(ORDER_KEY, 'new') === 'old' ? 'old' : 'new', busy: false };
      el._tgv = S;
      lsSet(RECENT_KEY, [Number(chat)].concat(ls(RECENT_KEY, []).filter(x => String(x) !== String(chat))).slice(0, 8));
      el.innerHTML = `<div class="tgv-head" data-tgv-head>
          <button type="button" class="btn sm ghost tgv-back" data-tgv-back title="Все ваши каналы">‹ Все авторы</button>
          <span class="tgv-ava lg" data-tgv-ava aria-hidden="true">✈</span>
          <div class="tgv-who"><b data-tgv-title>…</b><small data-tgv-at></small></div>
          <button type="button" class="btn primary tgv-listen" data-tgv-listen disabled title="Видео автора одно за другим — как подкаст (можно с выключенным экраном)">${Listen.HEADPHONES(18, true)} Слушать автора</button>
        </div>
        <div class="tgv-bar"><span class="small muted" data-tgv-count></span>
          <span class="seg-mini sm tgv-order" role="group" aria-label="Порядок"><button type="button" data-tgv-order="new">Сначала новые</button><button type="button" data-tgv-order="old">Сначала старые</button></span></div>
        <div class="tgv-grid" data-tgv-grid><div class="tgv-wait"><span class="spinner sm"></span> загружаю видео…</div></div>
        <div class="tgv-more-row"><button type="button" class="btn tgv-more" data-tgv-more hidden>Показать ещё</button></div>
        <p class="tiny muted tgv-note">▶ — смотреть здесь с субтитрами (их создаст приложение) и переводом · 🎧 — слушать автора с этого видео. Видео идёт через мост на этом Mac и не скачивается целиком.</p>`;
      const $ = s => el.querySelector(s);
      const sorted = () => (S.order === 'old' ? S.videos.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))) : S.videos);
      const card = (v, i) => `<article class="tgv-card" data-tgv-i="${i}">
          <button type="button" class="tgv-thumb" data-tgv-play="${i}" aria-label="Смотреть с субтитрами: ${esc(capTitle(v))}">
            <img src="${esc(thumbUrl(S.chat, v.id))}" alt="" loading="lazy" decoding="async" onerror="this.remove()"><span class="tgv-ph" aria-hidden="true">🎬</span>
            ${v.duration ? `<span class="tgv-dur">${mss(v.duration)}</span>` : ''}<span class="tgv-pl" aria-hidden="true">▶</span></button>
          <div class="tgv-meta"><b class="tgv-cap" lang="nb">${esc(capTitle(v))}</b>
            <span class="tgv-date">${esc(dateRu(v.date))}${v.author ? ' · ' + esc(v.author) : ''}</span></div>
          <div class="tgv-acts"><button type="button" class="btn sm tgv-watch" data-tgv-play="${i}">▶ Смотреть</button>
            <button type="button" class="btn sm ghost tgv-from" data-tgv-from="${i}" title="Слушать автора, начиная с этого видео">🎧 Отсюда</button></div>
        </article>`;
      const paint = () => {
        const list = sorted();
        $('[data-tgv-grid]').innerHTML = list.length ? list.map(card).join('') : `<div class="tgv-gate small"><b>У этого автора пока нет видео</b><p>Видео появятся здесь, как только он их опубликует.</p></div>`;
        $('[data-tgv-count]').textContent = list.length ? `${list.length} ${U.plural(list.length, ['видео', 'видео', 'видео'])}${S.next ? ' (есть ещё)' : ''}` : '';
        const more = $('[data-tgv-more]'); more.hidden = !S.next; more.textContent = S.order === 'old' ? '⤒ Показать более ранние' : 'Показать ещё';
        $('[data-tgv-listen]').disabled = !list.length;
        el.querySelectorAll('[data-tgv-order]').forEach(b => b.classList.toggle('active', b.dataset.tgvOrder === S.order));
      };
      const load = async () => {
        if (S.busy) return; S.busy = true;
        const mb = $('[data-tgv-more]'); if (mb && !mb.hidden) mb.innerHTML = '<span class="spinner sm"></span> загружаю…';
        try {
          const r = await api('videos', { chat: S.chat, offset: S.next || 0, limit: 24 });
          S.info = r.chat; S.ffmpeg = !!r.ffmpeg; S.next = r.next || 0;
          const have = new Set(S.videos.map(v => v.id));
          (r.videos || []).forEach(v => { if (!have.has(v.id)) S.videos.push(v); });
          $('[data-tgv-title]').textContent = S.info.title || 'Канал';
          $('[data-tgv-at]').textContent = `${S.info.username ? '@' + S.info.username : 'закрытая группа'} · ${S.info.kind === 'channel' ? 'канал' : 'группа'}`;
          const ava = $('[data-tgv-ava]'); ava.textContent = initial(S.info.title); ava.style.setProperty('--h', hue(S.chat));
          paint();
        } catch (e) {
          if (!S.videos.length) $('[data-tgv-grid]').innerHTML = `<div class="mt-warn">⚠️ <span>${esc(U.niceErr(e))}</span></div>`;
          else UI.toast(e.message, 'warn', 5000);
          paint();
        } finally { S.busy = false; }
      };
      el.onclick = async e => {
        if (el._tgv !== S) return;
        if (e.target.closest('[data-tgv-back]')) { el._tgv = null; el.onclick = null; this.authors(el, o); return; }
        const ord = e.target.closest('[data-tgv-order]');
        if (ord) { S.order = ord.dataset.tgvOrder; lsSet(ORDER_KEY, S.order); paint(); return; }
        if (e.target.closest('[data-tgv-more]')) { await load(); return; }
        const pl = e.target.closest('[data-tgv-play]');
        if (pl) { const v = sorted()[+pl.dataset.tgvPlay]; if (v) this.play(S, v); return; }
        const fr = e.target.closest('[data-tgv-from]');
        if (fr) { this.listen(S, sorted(), +fr.dataset.tgvFrom); return; }
        if (e.target.closest('[data-tgv-listen]')) this.listen(S, sorted(), null);
      };
      await load();
    },

    /** ▶ in the subtitle player: the bridge's stream, subtitles by NB-Whisper, cards with provenance */
    play(S, v) {
      const info = S.info || {}, link = linkOf(info, v);
      const title = capTitle(v);
      Subs.openStream({
        kind: 'tg', id: `${String(S.chat).replace(/^-/, 'm')}_${v.id}`, title, channel: info.title || '', author: v.author || '', date: v.date,
        link, at: link ? t => `${link}?t=${Math.floor(t)}` : null,
        video: streamUrl(S.chat, v.id), pcm: S.ffmpeg ? pcmUrl(S.chat, v.id) : '', poster: thumbUrl(S.chat, v.id), duration: v.duration || 0,
        cues: [], autoAsr: true, subName: 'субтитры, созданные приложением',
        note: '<b>У видео в Telegram нет субтитров — приложение создаст их само</b> и переведёт каждую строку.',
      });
    },

    /** 🎧 the author's videos one after another (from video `at`; null — where it stopped last time, or the first) */
    async listen(S, list, at) {
      Listen.prime(); // inside the tap (iPhone / Safari allow sound only there) — before anything is awaited
      if (!list.length) return;
      // a few more videos for the queue (still newest / oldest first as shown)
      if (S.next && S.videos.length < 48 && at == null) {
        try {
          const r = await api('videos', { chat: S.chat, offset: S.next, limit: 24 });
          const have = new Set(S.videos.map(v => v.id));
          (r.videos || []).forEach(v => { if (!have.has(v.id)) S.videos.push(v); });
          S.next = r.next || 0;
          list = S.order === 'old' ? S.videos.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))) : S.videos.slice();
        } catch (e) { /* the ones already loaded */ }
      }
      const info = S.info || {};
      const items = list.map(v => ({
        id: `tgv:${S.chat}:${v.id}`, no: capTitle(v), ru: [dateRu(v.date), v.duration ? mss(v.duration) : ''].filter(Boolean).join(' · '),
        media: streamUrl(S.chat, v.id), art: thumbUrl(S.chat, v.id), sec: v.duration || 0, link: linkOf(info, v), tg: { chat: S.chat, msg: v.id },
      }));
      const p = Listen.startMedia(info.title || 'Telegram', items, { mediaKey: `tg:${S.chat}:${S.order}`, at: at == null ? null : at, tgFf: S.ffmpeg });
      if (!p) return;
      if (window.ListenUI) { ListenUI.markUsed(); ListenUI.nowPlaying(); }
    },
  };

  /* ---------- W6: the curated public channels' media (no personal Telegram off the Mac) ---------- */
  const IC = (n, sz) => (window.MediaIcons ? MediaIcons.icon(n, sz || 18) : '');
  let curated = null;
  async function curatedList() {
    if (curated) return curated;
    try { const r = await fetch('data/tg-channels.json', { cache: 'force-cache' }); curated = r.ok ? (await r.json()).filter(c => c && /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(c.username || '')) : []; }
    catch (e) { curated = []; }
    return curated;
  }
  const KIND_TXT = { video: ['видео', 'Видео из норвежских каналов', 'video'], audio: ['аудио', 'Аудио из норвежских каналов', 'audio'] };
  /** Telegram's own embeddable post (sandboxed) in a small window, «Открыть в Telegram» under it */
  function postWindow(u, id, title) {
    const dark = document.documentElement.dataset.theme === 'dark';
    const link = `https://t.me/${encodeURIComponent(u)}/${encodeURIComponent(id)}`;
    const m = UI.modal({
      title: `${TG(22)} ${esc(title || '@' + u)}`, cls: 'tgp-post-modal',
      body: `<div class="tgp-frame-box"><iframe class="tgp-frame" src="${esc(link)}?embed=1${dark ? '&dark=1' : ''}" title="Пост из канала @${esc(u)}" loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
        <p class="tiny muted">Пост показывает сам Telegram — видео и звук играют в нём. Слова из поста можно выделить и скопировать в карточку.</p>`,
      foot: `<a class="btn primary" href="${esc(link)}" target="_blank" rel="noopener">${IC('send')} Открыть в Telegram</a>`,
    });
    // the widget tells its height (only from https://t.me, only a number)
    const f = m.$('iframe');
    const onMsg = e => {
      if (!f.isConnected) { window.removeEventListener('message', onMsg); return; }
      if (e.origin !== 'https://t.me' || e.source !== f.contentWindow) return;
      let d = null; try { d = typeof e.data === 'string' && e.data.length < 2000 ? JSON.parse(e.data) : null; } catch (x) { return; }
      const h = d && d.event === 'resize' ? Math.round(+d.height) : 0;
      if (h > 60 && h < 5000) f.style.height = h + 'px';
    };
    window.addEventListener('message', onMsg);
    return m;
  }
  /** the preview: channel chips → that channel's latest posts with a video / a sound → Telegram's widget */
  TgVideo.preview = async function (el, kind = 'video') {
    const K = KIND_TXT[kind] || KIND_TXT.video;
    const toChannels = () => {
      const tab = el.closest('.tg-modal') && el.closest('.tg-modal').querySelector('[data-tgtab="channels"]');
      if (tab) { tab.click(); return; }
      const mm = el.closest('.modal-backdrop'); if (mm && mm._m) mm._m.close();
      if (window.Telegram) Telegram.open(null, 'channels');
    };
    const chanBtn = `<button type="button" class="btn tgv-tochan" data-tgp-chan>${IC('grid')} Норвежские каналы</button>`;
    const list = await curatedList();
    const server = !!(window.NKConfig && NKConfig.ready() && window.Net && Net.callFn);
    if (!server || !list.length) {
      // no server: the channels tab (Telegram's widgets work without it)
      el.innerHTML = `<div class="tgv-gate">${TG(40)}<b>${K[1]}</b>
          <p>Откройте канал во вкладке «Норвежские каналы» и нажмите «Читать здесь» — ${K[0]} играют прямо в постах, без входа в Telegram.</p>${chanBtn.replace('class="btn ', 'class="btn primary ')}</div>`;
      el.querySelector('[data-tgp-chan]').onclick = toChannels;
      return;
    }
    const S = { u: list[0].username, posts: [], next: 0, busy: false };
    el.innerHTML = `<div class="tgp">
        <div class="tgv-top"><div><h3 class="tgv-h">${K[1]}</h3><p class="tgv-sub">Отобранные каналы для изучающих норвежский. Выберите канал — здесь появятся его посты с ${kind === 'audio' ? 'аудио' : 'видео'}.</p></div></div>
        <div class="tgp-chips" role="group" aria-label="Каналы">${list.map(c => `<button type="button" class="chip tgp-chip" data-tgp-u="${esc(c.username)}">${esc(c.title || '@' + c.username)}</button>`).join('')}</div>
        <div class="tgp-list" data-tgp-list></div>
        <div class="tgv-more-row"><button type="button" class="btn tgv-more" data-tgp-more hidden>Показать ещё</button></div>
        <p class="tiny muted tgv-note">Посты показывает сам Telegram. Свой аккаунт Telegram здесь не нужен.</p></div>`;
    const $ = q => el.querySelector(q);
    const card = p => {
      const line = String(p.text || '').split('\n').map(x => x.trim()).find(x => /\p{L}/u.test(x)) || (kind === 'audio' ? 'Аудио' : 'Видео');
      const th = p.media && /^https:\/\//.test(p.media.thumb || '') ? p.media.thumb : '';
      return `<article class="tgp-card">
          <button type="button" class="tgv-thumb tgp-thumb" data-tgp-post="${+p.id}" aria-label="Открыть пост: ${esc(line.slice(0, 80))}">
            ${th ? `<img src="${esc(th)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}<span class="tgv-ph" aria-hidden="true">${IC(kind === 'audio' ? 'music' : 'video', 30)}</span><span class="tgv-pl" aria-hidden="true">${IC('play', 22)}</span></button>
          <div class="tgv-meta"><b class="tgv-cap" lang="nb">${esc(line.length > 120 ? line.slice(0, 118) + '…' : line)}</b><span class="tgv-date">${esc(dateRu(p.date))}</span></div>
          <div class="tgv-acts"><button type="button" class="btn sm tgv-watch" data-tgp-post="${+p.id}">${IC('play', 16)} ${kind === 'audio' ? 'Слушать' : 'Смотреть'}</button>
            <a class="btn sm ghost" href="${esc(p.link || `https://t.me/${S.u}/${+p.id}`)}" target="_blank" rel="noopener">${IC('send', 16)} В Telegram</a></div>
        </article>`;
    };
    const paint = () => {
      const mine = S.posts.filter(p => p.media && p.media.kind === K[2]);
      const ch = list.find(c => c.username === S.u) || {};
      $('[data-tgp-list]').innerHTML = mine.length ? `<div class="tgv-grid">${mine.map(card).join('')}</div>`
        : S.busy ? '' : `<div class="tgv-gate small"><b>В последних постах «${esc(ch.title || S.u)}» ${kind === 'audio' ? 'аудио' : 'видео'} нет</b>
            <p>${S.next ? 'Нажмите «Показать ещё» — оно может быть в более ранних постах. ' : ''}Или откройте канал в Telegram.</p>
            <a class="btn sm" href="https://t.me/${esc(S.u)}" target="_blank" rel="noopener">${IC('send', 16)} Открыть @${esc(S.u)}</a></div>`;
      const more = $('[data-tgp-more]'); more.hidden = !S.next; more.textContent = 'Показать ещё';
      el.querySelectorAll('[data-tgp-u]').forEach(b => { b.classList.toggle('active', b.dataset.tgpU === S.u); b.setAttribute('aria-pressed', b.dataset.tgpU === S.u ? 'true' : 'false'); });
    };
    const load = async (more) => {
      if (more && S.busy) return;
      const seq = S.seq = (S.seq || 0) + 1, u = S.u;
      S.busy = true;
      if (!more) $('[data-tgp-list]').innerHTML = '<div class="tgv-wait"><span class="spinner sm"></span> загружаю посты…</div>';
      else $('[data-tgp-more]').innerHTML = '<span class="spinner sm"></span> загружаю…';
      let err = null, r = null;
      try { r = await Net.callFn('tg-public', null, { method: 'GET', auth: false, query: Object.assign({ u }, more && S.next ? { before: S.next } : {}), timeout: 20000 }); }
      catch (e) { err = e; }
      if (seq !== S.seq || !el.isConnected) return; // another channel was chosen meanwhile
      S.busy = false;
      if (err && err.code === 'not_curated') { Net.linkOut(err); S.posts = []; S.next = 0; }
      else if (err) {
        $('[data-tgp-more]').hidden = true;
        $('[data-tgp-list]').innerHTML = `<div class="tgv-gate small"><b>${esc(err.nk ? err.message : 'Посты сейчас не загрузились')}</b><p>Попробуйте ещё раз или откройте канал в Telegram.</p>
            <a class="btn sm" href="https://t.me/${esc(u)}" target="_blank" rel="noopener">${IC('send', 16)} Открыть @${esc(u)}</a></div>`;
        return;
      } else { S.posts = (more ? S.posts : []).concat((r && r.posts) || []); S.next = (r && r.next) || 0; }
      paint();
    };
    el.onclick = e => {
      const c = e.target.closest('[data-tgp-u]'); if (c) { if (c.dataset.tgpU !== S.u) { S.u = c.dataset.tgpU; S.posts = []; S.next = 0; paint(); load(false); } return; }
      if (e.target.closest('[data-tgp-more]')) { load(true); return; }
      const pb = e.target.closest('[data-tgp-post]');
      if (pb) { const ch = list.find(x => x.username === S.u) || {}; postWindow(S.u, pb.dataset.tgpPost, ch.title); return; }
      if (e.target.closest('[data-tgp-chan]')) toChannels();
    };
    await load(false);
  };

  /* ---------- 🎧 sound only for the NEXT video (the Mac has ffmpeg): the bridge makes an .m4a while this one plays ----------
   * The queue switches to it only for a video that has not started yet (the address of a playing video never changes). */
  const prepped = new Set();
  document.addEventListener('listen-state', () => {
    const p = window.Listen && Listen.p;
    if (!p || !p.o.media || !p.o.tgFf || p._tgPrepI === p.i) return;
    p._tgPrepI = p.i;
    const nx = p.cards[(p.i + 1) % p.cards.length];
    if (!nx || !nx.tg || nx === p.cards[p.i]) return;
    const key = nx.tg.chat + ':' + nx.tg.msg;
    api('audio', { chat: nx.tg.chat, msg: nx.tg.msg, check: 1, prep: prepped.has(key) ? 0 : 1 }).then(r => {
      prepped.add(key);
      if (r && r.ready && Listen.p === p && p.cards[p.i] !== nx) {
        nx.media = `/api/tg/audio?chat=${enc(nx.tg.chat)}&msg=${enc(nx.tg.msg)}`;
        if (p.pre) delete p.pre[p.cards.indexOf(nx)];
      }
    }).catch(() => { /* the video itself plays */ });
  });

  // the Telegram window: the tab «🎬 Видео авторов» (js/telegram.js shows it when this is loaded)
  if (window.Telegram) Telegram.tab_authors = function (el) { TgVideo.render(el, {}); };
  window.TgVideo = TgVideo;
})();
