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

  async function api(action, params = {}) {
    let r;
    try { r = await fetch(`/api/tg/${action}?` + new URLSearchParams(params)); } catch (e) { throw new Error('Мост на Mac не отвечает — запустите его и попробуйте снова'); }
    const ct = r.headers.get('Content-Type') || '';
    if (!/json/.test(ct)) throw new Error('Мост на Mac старой версии — перезапустите его (в Терминале Ctrl+C, затем снова python3 …/bridge/server.py)');
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 && /unknown action/.test(j.error || '')) throw new Error('Мост на Mac старой версии — перезапустите его (в Терминале Ctrl+C, затем снова python3 …/bridge/server.py)');
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
      if (!up) {
        el.innerHTML = `<div class="tgv-gate">${TG(40)}<b>Видео авторов открываются через приложение на Mac</b>
          <p>Telegram показывает видео каналов только вашему аккаунту. Его читает «мост» — маленькая программа на вашем Mac: запустите её и откройте приложение по адресу <b>http://localhost:8787</b>.</p>
          <p class="small muted">В Терминале: <code style="user-select:all">python3 "/Users/sprut/Norsk - Russisk/bridge/server.py"</code></p></div>`;
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
      try { list = (await api('dialogs')).dialogs || []; } catch (e) { el.querySelector('[data-tgv-authors]').innerHTML = `<div class="mt-warn">⚠️ <span>${esc(e.message)}</span></div>`; return; }
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
          if (!S.videos.length) $('[data-tgv-grid]').innerHTML = `<div class="mt-warn">⚠️ <span>${esc(e.message)}</span></div>`;
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
