/* ============ 🎵 «Аудио» из Telegram — audio files and voice notes of YOUR channels and groups ============
 * Read-only, through your Telegram account on the Mac bridge (bridge/tg.py — only your own channels / groups):
 *  - a channel → its audio: mp3, m4a, aac, ogg / opus, flac, wav (also sent «as a file») and voice notes, with the
 *    title / performer / file name, caption, length, date, size; newest / oldest / longest first, «Показать ещё»;
 *  - ▶ plays in the subtitle player in audio mode (Subs.openStream({ kind: 'tg', audio: true })): the bridge streams
 *    the file with HTTP Range; Telegram has no subtitles — NB-Whisper makes them from the bridge's PCM (ffmpeg), with
 *    the language tags, translation, word glosses, speed and cards. A card's provenance: channel, author / performer,
 *    file name, the moment, and the t.me link for public channels; its sound is cut from the file itself;
 *  - Safari / iPhone can't play Ogg / Opus voice notes: the bridge makes an .m4a (AAC) copy with ffmpeg in the
 *    background (cached in ~/.cache/norsk-kort-tg). Without ffmpeg a polite explanation — Chrome plays them as they are;
 *  - 🎧 «Слушать подряд» / «🎧 Отсюда»: the listening queue of the videos (Listen.startMedia — the lock screen, the
 *    sleep timer, the place remembered, ⏮ ⏭ of the lock screen and headphones);
 *  - ⬇ «Сохранить себе»: the file (or its .m4a copy where the browser needs one) goes into Cache Storage
 *    («norsk-kort-audio» — the same store as the decks' offline voice, js/listenx.js; sw.js never touches it): size and
 *    progress, the device's free space is checked, 🗑 deletes. Saved audio plays without the network and is listed in
 *    «💾 Мои аудио» (here, in the Telegram window and in «Что послушать?»), with where it came from.
 * Everything from Telegram is shown as text (U.esc).
 */
(function () {
  const enc = encodeURIComponent;
  const esc = s => U.esc(s == null ? '' : String(s));
  const ORDER_KEY = 'nk-tga-order', KIND_KEY = 'nk-tga-kind', RECENT_KEY = 'nk-tgv-recent', SAVED_KEY = 'nk-tga-saved';
  const STORE = 'norsk-kort-audio'; // = ListenX.cache.NAME
  const ls = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const mss = t => { t = Math.max(0, Math.floor(t || 0)); const h = Math.floor(t / 3600); return h ? `${h}:${String(Math.floor(t % 3600 / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  const dateRu = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }); };
  const mb = n => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} МБ` : `${Math.max(1, Math.round((n || 0) / 1e3))} КБ`);
  const hue = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 11);
  const initial = t => (String(t || '').replace(/[^\p{L}\p{N}]/gu, '')[0] || '✈').toUpperCase();
  const numRu = n => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' млн' : n >= 1e3 ? Math.round(n / 1e3) + ' тыс.' : String(n));
  const TG = s => (window.Telegram && Telegram.TG_SVG ? Telegram.TG_SVG(s) : '✈️');
  const HP = (s, on) => (window.Listen && Listen.HEADPHONES ? Listen.HEADPHONES(s, on) : '🎧');
  const friendly = msg => Object.assign(new Error(msg), { friendly: true });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // the site (no bridge there): never «запустите мост» to a visitor
  const NOBR = () => (window.Telegram && Telegram.home && !Telegram.home() ? 'Эта запись сейчас недоступна здесь — откройте канал в Телеграме' : 'Мост на Mac не отвечает — запустите его и попробуйте снова');
  const OLD = 'Мост на Mac старой версии — перезапустите его (в Терминале Ctrl+C, затем снова python3 …/bridge/server.py)';

  const streamUrl = (chat, msg) => `/api/tg/stream?chat=${enc(chat)}&msg=${enc(msg)}`;
  const m4aUrl = (chat, msg) => `/api/tg/audio?chat=${enc(chat)}&msg=${enc(msg)}`;
  const thumbUrl = (chat, msg) => `/api/tg/media?chat=${enc(chat)}&msg=${enc(msg)}&thumb=1`;
  const pcmUrl = (chat, msg) => `/api/tg/pcm?chat=${enc(chat)}&msg=${enc(msg)}`;
  const keyOf = r => `${r.chat}_${r.msg}`;
  const cacheKey = k => new URL(`__nk_audio/tg/${enc(k)}`, location.href).href;

  async function api(action, params = {}, signal) {
    let r;
    try { r = await fetch(`/api/tg/${action}?` + new URLSearchParams(params), { signal }); } catch (e) { if (e && e.name === 'AbortError') throw e; throw friendly(NOBR()); }
    const ct = r.headers.get('Content-Type') || '';
    if (!/json/.test(ct)) throw friendly(OLD);
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 && /unknown action/.test(j.error || '')) throw friendly(OLD);
    if (!r.ok) throw friendly(j.error || 'Telegram не ответил — попробуйте ещё раз');
    return j;
  }

  /* ---------------- one audio: what it is called, where it came from ---------------- */
  const baseName = n => String(n || '').replace(/\.[^.]+$/, '').replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
  function capLine(c) { return String(c || '').split('\n').map(s => s.trim()).find(s => /\p{L}/u.test(s)) || ''; }
  /** a list item from the bridge + its chat → the record used everywhere (and kept with a saved file) */
  function rec(info, a) {
    const link = info && info.public && info.username ? `https://t.me/${info.username}/${a.id}` : '';
    return {
      chat: String(info.id), msg: a.id, channel: info.title || '', username: info.public ? info.username || '' : '', link,
      title: a.title || '', performer: a.performer || '', name: a.name || '', caption: String(a.caption || '').slice(0, 600), date: a.date || '',
      duration: a.duration || 0, size: a.size || 0, mime: a.mime || 'audio/mpeg', voice: !!a.voice, thumb: !!a.thumb, author: a.author || '',
    };
  }
  function titleOf(r) {
    const t = r.title || capLine(r.caption) || baseName(r.name) || (r.voice ? `Голосовое от ${dateRu(r.date)}` : `Аудио от ${dateRu(r.date)}`);
    return t.length > 90 ? t.slice(0, 88) + '…' : t;
  }
  const whoOf = r => r.performer || r.author || '';
  const kindIco = r => (r.voice ? '🎤' : '🎵');

  /* ---------------- can this browser play it? (Safari / iPhone: no Ogg / Opus) ---------------- */
  const SAFARI = /^((?!chrome|chromium|crios|fxios|edg|android).)*safari/i.test(navigator.userAgent) || (window.TTS && TTS.IOS);
  const probe = (() => { let a = null; return t => { try { a = a || document.createElement('audio'); return a.canPlayType(t); } catch (e) { return ''; } }; })();
  function needsM4a(r) {
    const m = String(r.mime || '').toLowerCase();
    if (/ogg|opus|webm/.test(m)) return SAFARI || !probe('audio/ogg; codecs="opus"') || (!r.voice && !probe('audio/ogg; codecs="vorbis"'));
    if (/flac/.test(m)) return !probe('audio/flac');
    if (/wav/.test(m)) return !probe('audio/wav');
    if (/mpeg|mp3/.test(m)) return !probe('audio/mpeg');
    if (/mp4|aac|m4a/.test(m)) return false;
    return !probe(m);
  }
  const NOFF_HTML = `<p><b>Голосовые сообщения Telegram записаны в формате Ogg Opus</b> — Safari и iPhone его не воспроизводят.</p>
    <p>Мост на Mac умеет перекодировать их в M4A, понятный любому браузеру, — для этого ему нужна бесплатная программа <b>ffmpeg</b>. Установите её один раз и перезапустите мост:</p>
    <p class="small"><code style="user-select:all">brew install ffmpeg</code></p>
    <p class="small muted">В Chrome голосовые играют и без неё — откройте приложение в Chrome.</p>`;
  function explainNoFf() {
    const m = UI.modal({ title: '🎤 Голосовые в Safari', cls: 'narrow tga-noff', body: NOFF_HTML, foot: '<button class="btn primary" data-ok>Понятно</button>' });
    m.$('[data-ok]').onclick = () => m.close();
    return m;
  }

  /** the bridge's .m4a copy: start it and wait (onPct(0..99)); → its size. Friendly errors only. */
  async function prepM4a(r, onPct, signal) {
    const t0 = Date.now();
    let first = true;
    for (;;) {
      if (signal && signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      const j = await api('audio', { chat: r.chat, msg: r.msg, check: 1, prep: 1 }, signal);
      if (j.ready) return j.size || 0;
      if (j.ffmpeg === false) throw Object.assign(friendly('На Mac нет программы ffmpeg — без неё голосовые не перекодировать для Safari'), { noff: true });
      if (j.failed) throw friendly('Не удалось подготовить звук этой записи — попробуйте открыть её в Chrome');
      if (!j.pending && !j.busy && !first) throw friendly('Эта запись слишком большая для перекодирования — откройте её в Telegram');
      first = false;
      if (onPct) onPct(j.pct || 0);
      if (Date.now() - t0 > 15 * 60000) throw friendly('Подготовка звука заняла слишком долго — попробуйте позже');
      await sleep(j.busy ? 1500 : 700);
    }
  }

  /* ---------------- 💾 saved on this device (Cache Storage «norsk-kort-audio») ---------------- */
  const blobs = new Map(); // key -> blob: URL (kept while the page lives; revoked on delete)
  const DLS = new Map();   // key -> { phase: 'prep'|'dl', pct, got, total, ctrl } — downloads in progress
  const emit = () => document.dispatchEvent(new CustomEvent('tga-state'));
  const Saved = {
    ok() { return !!window.caches; },
    all() { return ls(SAVED_KEY, {}); },
    list() { return Object.values(this.all()).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)); },
    has(k) { return !!this.all()[k]; },
    bytes() { return this.list().reduce((n, x) => n + (x.bytes || 0), 0); },
    async blob(k) {
      if (!this.ok() || !this.has(k)) return null;
      try { const c = await caches.open(STORE); const r = await c.match(cacheKey(k)); return r ? await r.blob() : null; } catch (e) { return null; }
    },
    async url(k) {
      if (blobs.has(k)) return blobs.get(k);
      const b = await this.blob(k); if (!b) return null;
      const u = URL.createObjectURL(b); blobs.set(k, u); return u;
    },
    async save(r) {
      const k = keyOf(r);
      if (DLS.has(k) || this.has(k)) return;
      if (!this.ok()) throw friendly('Этот браузер не умеет сохранять файлы на устройство');
      const ctrl = new AbortController(), d = { phase: 'dl', pct: 0, got: 0, total: r.size || 0, ctrl };
      DLS.set(k, d); emit();
      try {
        let url = streamUrl(r.chat, r.msg), mime = r.mime, size = r.size || 0, m4a = false;
        if (needsM4a(r)) {
          // Safari / iPhone: the .m4a copy is what can play here — that is what is saved
          d.phase = 'prep'; emit();
          size = (await prepM4a(r, p => { d.pct = p; emit(); }, ctrl.signal)) || size;
          url = m4aUrl(r.chat, r.msg); mime = 'audio/mp4'; m4a = true;
          d.phase = 'dl'; d.pct = 0; d.total = size; emit();
        }
        // room on the device (the file + a margin)
        const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate().catch(() => null) : null;
        if (est && est.quota && size && est.quota - est.usage < size * 1.3 + 5e6) {
          throw friendly(`Не хватает места на устройстве: нужно ${mb(size)}, свободно ~${mb(Math.max(0, est.quota - est.usage))}. Удалите что-нибудь из «Мои аудио».`);
        }
        let res;
        try { res = await fetch(url, { signal: ctrl.signal }); } catch (e) { if (e.name === 'AbortError') throw e; throw friendly(NOBR()); }
        if (!res.ok || !res.body) throw friendly('Telegram не отдал этот файл — попробуйте ещё раз');
        const total = +res.headers.get('Content-Length') || size;
        d.total = total;
        const reader = res.body.getReader(), parts = [];
        let got = 0, last = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(value); got += value.length;
          d.got = got; d.pct = total ? Math.min(99, Math.floor(got * 100 / total)) : 0;
          if (Date.now() - last > 250) { last = Date.now(); emit(); }
        }
        const blob = new Blob(parts, { type: mime });
        if (blob.size < 200 || (total && blob.size < total)) throw friendly('Файл пришёл не целиком — попробуйте ещё раз');
        const c = await caches.open(STORE);
        try { await c.put(cacheKey(k), new Response(blob, { headers: { 'content-type': mime, 'x-size': String(blob.size) } })); }
        catch (e) { throw friendly(e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || '')) ? 'Закончилось место на устройстве — аудио не сохранено' : 'Браузер не дал сохранить файл — возможно, это приватное окно'); }
        const all = this.all();
        all[k] = Object.assign({}, r, { bytes: blob.size, smime: mime, m4a, savedAt: Date.now() });
        if (!lsSet(SAVED_KEY, all)) { try { await c.delete(cacheKey(k)); } catch (e) { /* ignore */ } throw friendly('Браузер не дал сохранить список — возможно, это приватное окно'); }
        try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* ignore */ }
        return all[k];
      } finally { DLS.delete(k); emit(); }
    },
    cancel(k) { const d = DLS.get(k); if (d) d.ctrl.abort(); },
    async remove(k) {
      try { const c = await caches.open(STORE); await c.delete(cacheKey(k)); } catch (e) { /* gone already */ }
      const all = this.all(); delete all[k]; lsSet(SAVED_KEY, all);
      const u = blobs.get(k); if (u) { blobs.delete(k); setTimeout(() => URL.revokeObjectURL(u), 1000); }
      emit();
    },
  };

  /** the address to play: saved → the file on the device; Safari + Ogg → the bridge's .m4a; else the bridge's stream */
  async function playUrl(r, onPct, signal) {
    const k = keyOf(r);
    const u = r.noSaved ? null : await Saved.url(k);
    if (u) return { url: u, saved: true };
    if (needsM4a(r)) { await prepM4a(r, onPct, signal); return { url: m4aUrl(r.chat, r.msg), m4a: true }; }
    return { url: streamUrl(r.chat, r.msg) };
  }

  /* ---------------- the save button / the saved list ---------------- */
  function saveBtn(r) {
    const k = keyOf(r), d = DLS.get(k), s = Saved.all()[k];
    if (d) return `<button type="button" class="btn sm tga-save busy" data-tga-cancel="${esc(k)}" title="Остановить сохранение">⏳ ${d.phase === 'prep' ? 'готовлю' : 'сохраняю'} ${d.pct || 0} %${d.total && d.phase === 'dl' ? ` <small>из ${mb(d.total)}</small>` : ''}</button>`;
    if (s) return `<span class="tga-saved" title="Сохранено на этом устройстве — играет без интернета">✓ сохранено · ${mb(s.bytes)}</span><button type="button" class="btn sm ghost tga-del" data-tga-del="${esc(k)}" title="Удалить с этого устройства" aria-label="Удалить с устройства">🗑</button>`;
    return `<button type="button" class="btn sm ghost tga-save" data-tga-save="${esc(k)}" title="Сохранить на это устройство — слушать без интернета${r.size ? ' (' + mb(r.size) + ')' : ''}">⬇ Сохранить себе</button>`;
  }
  const metaLine = (r, withSrc) => [withSrc ? r.channel : '', whoOf(r), r.name && r.name !== r.title ? r.name : '', dateRu(r.date), r.duration ? mss(r.duration) : '', r.size ? mb(r.size) : ''].filter(Boolean).map(esc).join(' · ');
  function row(r, i, o = {}) {
    const k = keyOf(r), cap = r.title && capLine(r.caption) && capLine(r.caption) !== r.title ? capLine(r.caption) : '';
    return `<article class="tga-row${r.voice ? ' voice' : ''}" data-tga-i="${i}" data-tga-k="${esc(k)}">
        <button type="button" class="tga-play" data-tga-play="${i}" aria-label="Слушать с субтитрами: ${esc(titleOf(r))}" style="--h:${hue(r.chat)}">
          ${r.thumb && !o.offline ? `<img src="${esc(thumbUrl(r.chat, r.msg))}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}<span class="tga-ico" aria-hidden="true">${kindIco(r)}</span><span class="tga-pl" aria-hidden="true">▶</span></button>
        <div class="tga-meta"><b class="tga-title" lang="nb">${esc(titleOf(r))}</b>
          <span class="tga-sub">${r.voice ? '<span class="tga-tag">голосовое</span> ' : ''}${metaLine(r, o.src)}</span>
          ${cap ? `<span class="tga-cap" lang="nb">${esc(cap.length > 140 ? cap.slice(0, 138) + '…' : cap)}</span>` : ''}</div>
        <div class="tga-acts"><button type="button" class="btn sm tga-watch" data-tga-play="${i}">▶ Слушать</button>
          <button type="button" class="btn sm ghost tga-from" data-tga-from="${i}" title="Слушать подряд, начиная с этой записи">🎧 Отсюда</button>
          <span class="tga-savebox" data-tga-sb="${esc(k)}">${saveBtn(r)}</span></div>
      </article>`;
  }

  const TgAudio = {
    saved: Saved, needsM4a, playUrl, titleOf, keyOf, streamUrl,
    /** 🎵 the standalone window («Что послушать?»): «Мои аудио» + your channels → a channel's audio */
    open(chat, o = {}) {
      const m = UI.modal({ title: `${TG(24)} Telegram · аудио`, cls: 'wide tga-modal', body: '<div class="tga" data-tga-root></div>' });
      this.render(m.$('[data-tga-root]'), Object.assign({ chat, m }, o));
      return m;
    },
    /** el: where to draw (the Telegram window's tab or the standalone window) */
    async render(el, o = {}) {
      el.classList.add('tga');
      el.innerHTML = '<div data-tga-mine></div><div data-tga-main><div class="tgv-wait"><span class="spinner sm"></span> загружаю…</div></div>';
      this.mine(el.querySelector('[data-tga-mine]'), { open: o.mine });
      const main = el.querySelector('[data-tga-main]');
      const ok = await this.gate(main);
      if (!ok) return;
      if (o.chat) this.chat(main, o.chat, o); else this.chats(main, o);
    },
    /** bridge + Telegram connected? Otherwise a clear explanation (saved audio still plays) */
    async gate(el) {
      const up = window.AI && AI.bridge && AI.bridge.up;
      const n = Saved.list().length;
      if (!up && !(window.Telegram && Telegram.home ? Telegram.home() : true)) {
        // the site: no bridge, no account — what plays here: the saved audio above and the posts of the channels
        el.innerHTML = `<div class="tgv-gate">${TG(40)}<b>Аудио из норвежских каналов</b>
          <p>${n ? '<b>Сохранённые аудио</b> (выше) играют прямо здесь — даже без интернета. ' : ''}Новые записи слушайте в постах: «📢 Норвежские каналы» → «📖 Читать здесь» — аудио и видео играют прямо в посте, без входа в Телеграм.</p>
          <button type="button" class="btn primary tgv-tochan" data-tga-chan>📢 Норвежские каналы</button></div>`;
        el.querySelector('[data-tga-chan]').onclick = () => {
          const tab = el.closest('.tg-modal') && el.closest('.tg-modal').querySelector('[data-tgtab="channels"]');
          if (tab) { tab.click(); return; }
          const mm = el.closest('.modal-backdrop'); if (mm && mm._m) mm._m.close();
          if (window.Telegram) Telegram.open(null, 'channels');
        };
        return false;
      }
      if (!up) {
        el.innerHTML = `<div class="tgv-gate">${TG(40)}<b>Аудио из каналов открываются через приложение на Mac</b>
          <p>Telegram показывает файлы каналов только вашему аккаунту. Его читает «мост» — маленькая программа на вашем Mac: запустите её и откройте приложение по адресу <b>http://localhost:8787</b>.</p>
          ${n ? '<p><b>Сохранённые аудио</b> (выше) играют и без моста — даже без интернета.</p>' : ''}
          <p class="small muted">В Терминале: <code style="user-select:all">python3 "/Users/sprut/Norsk - Russisk/bridge/server.py"</code></p></div>`;
        return false;
      }
      if (window.Telegram && (!Telegram.status || Telegram.status.authorized === undefined)) { try { await Telegram.accStatus(); } catch (e) { /* shown below */ } }
      const s = (window.Telegram && Telegram.status) || {};
      if (!s.authorized) {
        el.innerHTML = `<div class="tgv-gate">${TG(40)}<b>Подключите свой Telegram</b>
          <p>Тогда здесь появятся аудио и голосовые сообщения из ваших каналов и групп — слушать с субтитрами и переводом, подряд или сохранить себе. Подключение — один раз, около 3 минут, пошагово.</p>
          <button type="button" class="btn primary" data-tga-login>🔐 Подключить мой Telegram</button></div>`;
        el.querySelector('[data-tga-login]').onclick = () => { const mm = el.closest('.modal-backdrop'); if (mm && mm._m && !el.closest('.tg-modal')) mm._m.close(); Telegram.open(null, 'setup'); };
        return false;
      }
      return true;
    },

    /* ---------------- 💾 «Мои аудио» ---------------- */
    mine(box, o = {}) {
      if (!box) return;
      const paint = () => {
        if (!box.isConnected) { document.removeEventListener('tga-state', paint); return; }
        const list = Saved.list();
        if (!list.length) { box.innerHTML = ''; box.hidden = true; return; }
        box.hidden = false;
        const open = box.dataset.open === '1' || o.open || list.length <= 3;
        const shown = open ? list : list.slice(0, 3);
        box.innerHTML = `<section class="tga-mine"><div class="tga-mine-h"><h3 class="tgv-h">💾 Мои аудио</h3>
            <span class="small muted">${list.length} ${U.plural(list.length, ['запись', 'записи', 'записей'])} · ${mb(Saved.bytes())} на этом устройстве · играют без интернета</span>
            <button type="button" class="btn sm primary tga-listen" data-tga-mine-all>${HP(16, true)} Слушать все</button></div>
          <div class="tga-list">${shown.map((r, i) => row(r, i, { src: true, offline: !(window.AI && AI.bridge && AI.bridge.up) })).join('')}</div>
          ${shown.length < list.length ? `<button type="button" class="btn sm ghost tga-mine-more" data-tga-mine-open>Показать все (${list.length})</button>` : ''}</section>`;
      };
      paint();
      if (!box._tgaBound) {
        box._tgaBound = true;
        document.addEventListener('tga-state', paint);
        box.addEventListener('click', e => {
          const list = Saved.list();
          if (e.target.closest('[data-tga-mine-open]')) { box.dataset.open = '1'; paint(); return; }
          if (e.target.closest('[data-tga-mine-all]')) { this.listenList('Мои аудио', list, 0, 'tga:mine'); return; }
          if (this.rowClick(e, list, i => this.listenList('Мои аудио', list, i, 'tga:mine'))) return;
        });
      }
    },
    /** ▶ / 🎧 Отсюда / ⬇ / 🗑 / ⏳ in a row; → handled */
    rowClick(e, list, from) {
      const pl = e.target.closest('[data-tga-play]');
      if (pl) { const r = list[+pl.dataset.tgaPlay]; if (r) this.play(r, pl); return true; }
      const fr = e.target.closest('[data-tga-from]');
      if (fr) { from(+fr.dataset.tgaFrom); return true; }
      const sv = e.target.closest('[data-tga-save]');
      if (sv) {
        const r = list.find(x => keyOf(x) === sv.dataset.tgaSave);
        if (r) Saved.save(r).then(s => { if (s) UI.toast(`💾 Сохранено: «${titleOf(r)}» · ${mb(s.bytes)} — играет без интернета`, 'good', 4000); })
          .catch(err => { if (err && err.name === 'AbortError') { UI.toast('Сохранение остановлено', '', 2500); return; } if (err && err.noff) explainNoFf(); else UI.toast(err && err.friendly ? err.message : 'Не удалось сохранить — попробуйте ещё раз', 'warn', 6000); });
        return true;
      }
      const cn = e.target.closest('[data-tga-cancel]');
      if (cn) { Saved.cancel(cn.dataset.tgaCancel); return true; }
      const dl = e.target.closest('[data-tga-del]');
      if (dl) {
        const k = dl.dataset.tgaDel, s = Saved.all()[k];
        if (!s) return true;
        UI.confirm(`Удалить «${esc(titleOf(s))}» с этого устройства? Освободится ${mb(s.bytes)}. В Telegram запись останется — её можно сохранить снова.`, { ok: '🗑 Удалить', danger: true, title: 'Удалить сохранённое аудио?' })
          .then(yes => { if (yes) Saved.remove(k).then(() => UI.toast('🗑 Удалено с устройства', '', 2500)); });
        return true;
      }
      return false;
    },

    /* ---------------- your channels ---------------- */
    async chats(el, o = {}) {
      el.innerHTML = `<div class="tgv-top"><div><h3 class="tgv-h">🎵 Аудио из ваших каналов</h3><p class="tgv-sub">Подкасты, уроки и голосовые сообщения. Слушайте с субтитрами и переводом, подряд или сохраните себе — для прослушивания без интернета.</p></div>
          <input class="input tgv-find" data-tga-find type="search" placeholder="🔎 Найти канал" aria-label="Найти канал"></div>
        <div class="tgv-authors" data-tga-chats><div class="tgv-wait"><span class="spinner sm"></span> загружаю ваши каналы…</div></div>`;
      let list = [];
      try { list = (await api('dialogs')).dialogs || []; } catch (e) { el.querySelector('[data-tga-chats]').innerHTML = `<div class="mt-warn">⚠️ <span>${esc(e.friendly ? e.message : 'Telegram не ответил — попробуйте ещё раз')}</span></div>`; return; }
      const recent = ls(RECENT_KEY, []);
      const rank = d => (recent.indexOf(d.id) >= 0 ? recent.indexOf(d.id) : 99) * 4 + (d.match ? 0 : 2) + (d.kind === 'channel' ? 0 : 1);
      list.sort((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name), 'ru'));
      const item = d => `<button type="button" class="tgv-author" data-tga-chat="${esc(d.id)}" style="--h:${hue(d.id)}">
          <span class="tgv-ava" aria-hidden="true">${esc(initial(d.name))}</span>
          <span class="tgv-an"><b>${esc(d.name)}</b><small>${d.username ? '@' + esc(d.username) : 'закрытая группа'} · ${d.kind === 'channel' ? 'канал' : 'группа'}${d.count ? ' · 👥 ' + numRu(d.count) : ''}${d.match ? ' · 🇳🇴' : ''}</small></span>
          <span class="tgv-go" aria-hidden="true">›</span></button>`;
      const draw = q => {
        const k = String(q || '').trim().toLowerCase();
        const sel = list.filter(d => !k || String(d.name).toLowerCase().includes(k) || String(d.username || '').toLowerCase().includes(k));
        el.querySelector('[data-tga-chats]').innerHTML = sel.length ? sel.map(item).join('')
          : list.length ? '<div class="small muted">Такого канала нет среди ваших.</div>' : '<div class="tgv-gate small"><b>Пока нет ни одного канала</b><p>Подпишитесь в Telegram на норвежские каналы — они появятся здесь.</p></div>';
      };
      draw('');
      el.querySelector('[data-tga-find]').addEventListener('input', e => draw(e.target.value));
      el.querySelector('[data-tga-chats]').addEventListener('click', e => {
        const b = e.target.closest('[data-tga-chat]'); if (!b) return;
        this.chat(el, b.dataset.tgaChat, o);
      });
    },

    /* ---------------- one channel: its audio ---------------- */
    async chat(el, chat, o = {}) {
      const S = { chat: String(chat), info: null, items: [], next: 0, ffmpeg: false, order: ls(ORDER_KEY, 'new'), kind: ls(KIND_KEY, 'all'), busy: false };
      if (!['new', 'old', 'long'].includes(S.order)) S.order = 'new';
      if (!['all', 'voice', 'file'].includes(S.kind)) S.kind = 'all';
      el._tga = S;
      lsSet(RECENT_KEY, [Number(chat)].concat(ls(RECENT_KEY, []).filter(x => String(x) !== String(chat))).slice(0, 8));
      el.innerHTML = `<div class="tgv-head">
          <button type="button" class="btn sm ghost tgv-back" data-tga-back title="Все ваши каналы">‹ Все каналы</button>
          <span class="tgv-ava lg" data-tga-ava aria-hidden="true">✈</span>
          <div class="tgv-who"><b data-tga-title>…</b><small data-tga-at></small></div>
          <button type="button" class="btn primary tgv-listen tga-listen" data-tga-listen disabled title="Все записи одна за другой — как подкаст (можно с выключенным экраном)">${HP(18, true)} Слушать подряд</button>
        </div>
        <div class="tgv-bar tga-bar"><span class="small muted" data-tga-count></span>
          <span class="tga-ctl"><span class="seg-mini sm tga-kind" role="group" aria-label="Что показывать"><button type="button" data-tga-kind="all">Все</button><button type="button" data-tga-kind="voice">🎤 Голосовые</button><button type="button" data-tga-kind="file">🎵 Файлы</button></span>
          <span class="seg-mini sm tga-order" role="group" aria-label="Порядок"><button type="button" data-tga-order="new">Новые</button><button type="button" data-tga-order="old">Старые</button><button type="button" data-tga-order="long">Длинные</button></span></span></div>
        <div class="tga-list" data-tga-list><div class="tgv-wait"><span class="spinner sm"></span> загружаю аудио…</div></div>
        <div class="tgv-more-row"><button type="button" class="btn tgv-more" data-tga-more hidden>Показать ещё</button></div>
        <p class="tiny muted tgv-note">▶ — слушать здесь с субтитрами (их создаст приложение) и переводом · 🎧 — подряд с этой записи · ⬇ — сохранить на это устройство и слушать без интернета. Файлы идут через мост на этом Mac.</p>`;
      const $ = s => el.querySelector(s);
      const sorted = () => {
        let l = S.items.filter(r => S.kind === 'all' || (S.kind === 'voice' ? r.voice : !r.voice));
        if (S.order === 'old') l = l.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.msg - b.msg);
        else if (S.order === 'long') l = l.slice().sort((a, b) => (b.duration || 0) - (a.duration || 0));
        return l;
      };
      const paint = () => {
        const list = sorted();
        $('[data-tga-list]').innerHTML = list.length ? list.map((r, i) => row(r, i)).join('')
          : S.items.length ? `<div class="tgv-gate small"><b>${S.kind === 'voice' ? 'Голосовых сообщений' : 'Аудиофайлов'} пока нет</b><p>${S.next ? 'Нажмите «Показать ещё» — они могут быть в более ранних сообщениях.' : 'Выберите «Все», чтобы увидеть остальные записи.'}</p></div>`
          : `<div class="tgv-gate small"><b>Здесь пока нет аудио</b><p>${S.next ? 'В последних сообщениях аудио не нашлось — нажмите «Показать ещё».' : 'Аудиофайлы и голосовые сообщения появятся здесь, как только их опубликуют.'}</p></div>`;
        $('[data-tga-count]').textContent = S.items.length ? `${list.length} ${U.plural(list.length, ['запись', 'записи', 'записей'])}${S.next ? ' (есть ещё)' : ''}` : '';
        const more = $('[data-tga-more]'); more.hidden = !S.next; more.textContent = S.order === 'old' ? '⤒ Показать более ранние' : 'Показать ещё';
        $('[data-tga-listen]').disabled = !list.length;
        el.querySelectorAll('[data-tga-order]').forEach(b => b.classList.toggle('active', b.dataset.tgaOrder === S.order));
        el.querySelectorAll('[data-tga-kind]').forEach(b => b.classList.toggle('active', b.dataset.tgaKind === S.kind));
      };
      const load = async (tries = 0) => {
        if (S.busy) return; S.busy = true;
        const mb_ = $('[data-tga-more]'); if (mb_ && !mb_.hidden) mb_.innerHTML = '<span class="spinner sm"></span> загружаю…';
        let added = 0;
        try {
          const r = await api('audios', { chat: S.chat, offset: S.next || 0, limit: 30 });
          S.info = r.chat; S.ffmpeg = !!r.ffmpeg; TgAudio._ff = S.ffmpeg; S.next = r.next || 0;
          const have = new Set(S.items.map(x => x.msg));
          (r.audios || []).forEach(a => { if (!have.has(a.id)) { S.items.push(rec(S.info, a)); added++; } });
          $('[data-tga-title]').textContent = S.info.title || 'Канал';
          $('[data-tga-at]').textContent = `${S.info.username ? '@' + S.info.username : 'закрытая группа'} · ${S.info.kind === 'channel' ? 'канал' : 'группа'}`;
          const ava = $('[data-tga-ava]'); ava.textContent = initial(S.info.title); ava.style.setProperty('--h', hue(S.chat));
        } catch (e) {
          const msg = e.friendly ? e.message : 'Telegram не ответил — попробуйте ещё раз';
          if (!S.items.length) { $('[data-tga-list]').innerHTML = `<div class="mt-warn">⚠️ <span>${esc(msg)}</span></div>`; S.busy = false; $('[data-tga-more]').hidden = true; return; }
          UI.toast(msg, 'warn', 5000);
        } finally { S.busy = false; }
        paint();
        // a page of messages without any audio (a channel of PDFs / photos): look a little further by itself
        if (!added && S.next && tries < 3 && el._tga === S) await load(tries + 1);
      };
      const onState = () => {
        if (!el.isConnected || el._tga !== S) { document.removeEventListener('tga-state', onState); return; }
        el.querySelectorAll('[data-tga-sb]').forEach(b => { const r = S.items.find(x => keyOf(x) === b.dataset.tgaSb); if (r) b.innerHTML = saveBtn(r); });
      };
      document.addEventListener('tga-state', onState);
      el.onclick = async e => {
        if (el._tga !== S) return;
        if (e.target.closest('[data-tga-back]')) { el._tga = null; el.onclick = null; this.chats(el, o); return; }
        const ord = e.target.closest('[data-tga-order]');
        if (ord) { S.order = ord.dataset.tgaOrder; lsSet(ORDER_KEY, S.order); paint(); return; }
        const kd = e.target.closest('[data-tga-kind]');
        if (kd) { S.kind = kd.dataset.tgaKind; lsSet(KIND_KEY, S.kind); paint(); return; }
        if (e.target.closest('[data-tga-more]')) { await load(); return; }
        if (e.target.closest('[data-tga-listen]')) { this.listen(S, null); return; }
        this.rowClick(e, sorted(), i => this.listen(S, i));
      };
      await load();
    },

    /** ▶ the subtitle player in audio mode: ASR lines, translation, glosses, speed, cards with provenance */
    async play(r, btn) {
      const k = keyOf(r);
      if (btn && btn._busy) return;
      let got;
      const old = btn ? btn.innerHTML : '';
      try {
        if (btn) btn._busy = true;
        const t = setTimeout(() => { if (btn) btn.innerHTML = '<span class="spinner sm"></span>'; }, 250);
        // a saved file: an address of its own (the player revokes it when it closes)
        const sb = await Saved.blob(k);
        got = sb ? { url: URL.createObjectURL(sb), saved: true, blob: sb }
          : await playUrl(Object.assign({}, r, { noSaved: true }), p => { if (btn && btn.classList.contains('tga-watch')) btn.textContent = `⏳ готовлю звук ${p} %`; });
        clearTimeout(t);
      } catch (e) {
        if (btn) { btn.innerHTML = old; btn._busy = false; }
        if (e && e.noff) { explainNoFf(); return; }
        UI.toast(e && e.friendly ? e.message : 'Не удалось открыть запись — попробуйте ещё раз', 'warn', 6000);
        return;
      }
      if (btn) { btn.innerHTML = old; btn._busy = false; }
      const up = !!(window.AI && AI.bridge && AI.bridge.up);
      const ff = up && this.ffmpegOk();
      const blob = got.blob || null;
      const who = whoOf(r);
      Subs.openStream({
        kind: 'tg', audio: true, id: `${String(r.chat).replace(/^-/, 'm')}_${r.msg}`, title: titleOf(r), channel: r.channel || 'Telegram',
        author: who, performer: !!r.performer, file: r.name || '', voice: r.voice, date: r.date,
        link: r.link, at: r.link ? t => `${r.link}?t=${Math.floor(t)}` : null,
        video: got.url, pcm: ff ? pcmUrl(r.chat, r.msg) : '', blob: !ff ? blob : null, poster: r.thumb && up ? thumbUrl(r.chat, r.msg) : '', duration: r.duration || 0,
        cues: [], autoAsr: true, subName: 'субтитры, созданные приложением',
        note: `<b>У ${r.voice ? 'голосовых сообщений' : 'аудио'} в Telegram нет субтитров — приложение создаст их само</b> и переведёт каждую строку.${got.saved ? ' Запись сохранена на этом устройстве.' : ''}`,
      });
    },
    /** ffmpeg on the Mac (the PCM for speech recognition and card sound): what the last list said; unknown → yes */
    ffmpegOk() { return this._ff !== false; },

    /** 🎧 a channel's audio one after another (from item `at`; null — where it stopped last time, or the first) */
    async listen(S, at) {
      if (window.Listen) Listen.prime(); // inside the tap (iPhone / Safari allow sound only there) — before anything is awaited
      const order = S.order;
      let list = S.items.filter(r => S.kind === 'all' || (S.kind === 'voice' ? r.voice : !r.voice));
      if (order === 'old') list = list.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.msg - b.msg);
      else if (order === 'long') list = list.slice().sort((a, b) => (b.duration || 0) - (a.duration || 0));
      this.listenList((S.info && S.info.title) || 'Telegram', list, at, `tga:${S.chat}:${order}:${S.kind}`);
    },
    listenList(title, list, at, key) {
      if (window.Listen) Listen.prime();
      if (!list.length) return;
      const up = !!(window.AI && AI.bridge && AI.bridge.up);
      const items = list.map(r => ({
        id: `tga:${r.chat}:${r.msg}`, no: titleOf(r), ru: [r.channel && key === 'tga:mine' ? r.channel : '', whoOf(r), dateRu(r.date), r.duration ? mss(r.duration) : ''].filter(Boolean).join(' · '),
        media: streamUrl(r.chat, r.msg), art: r.thumb && up ? thumbUrl(r.chat, r.msg) : '', sec: r.duration || 0, link: r.link || '',
        tg: { chat: r.chat, msg: r.msg, audio: 1, mime: r.mime, voice: r.voice ? 1 : 0 },
      }));
      const p = Listen.startMedia(title, items, { mediaKey: key, at: at == null ? null : at });
      if (!p) return;
      if (window.ListenUI) { ListenUI.markUsed(); ListenUI.nowPlaying(); }
    },
    /** Listen (js/listen.js queueFor): the address of a queued audio — saved file / .m4a for Safari / the stream */
    async resolveUrl(c) {
      const t = c && c.tg; if (!t) return c && c.media;
      const r = { chat: t.chat, msg: t.msg, mime: t.mime || 'audio/mpeg', voice: !!t.voice };
      try { return (await playUrl(r)).url; }
      catch (e) {
        if (e && e.noff && !this._noffToast) { this._noffToast = true; UI.toast('🎤 Голосовые не играют в Safari без программы ffmpeg на Mac — пропускаю их (в Chrome они играют)', 'warn', 7000); }
        return c.media;
      }
    },

    /* ---------------- «Что послушать?» (js/listenui.js) ---------------- */
    chooserHtml() {
      const list = Saved.list();
      return `${list.length ? `<div class="tga-lc" data-tga-lc-box><div class="tga-lc-h"><b>💾 Мои аудио</b><small>${list.length} ${U.plural(list.length, ['запись', 'записи', 'записей'])} · играют без интернета</small>
            <button type="button" class="btn sm primary" data-tga-lc="all">${HP(16, true)} Слушать все</button></div>
          ${list.slice(0, 4).map((r, i) => `<button type="button" class="tga-lc-row" data-tga-lc="${i}" title="Слушать с этой записи"><span class="tga-lc-ic" aria-hidden="true">${kindIco(r)}</span>
            <span class="tga-lc-t"><b lang="nb">${esc(titleOf(r))}</b><small>${esc([r.channel, whoOf(r), r.duration ? mss(r.duration) : ''].filter(Boolean).join(' · '))}</small></span><span class="tga-lc-go" aria-hidden="true">▶</span></button>`).join('')}
          ${list.length > 4 ? `<button type="button" class="btn sm ghost" data-tga-lc="open">Все сохранённые (${list.length}) ›</button>` : ''}</div>` : ''}`;
    },
    chooserBind(m) {
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-tga-lc]'); if (!b) return;
        const v = b.dataset.tgaLc, list = Saved.list();
        if (window.Listen) Listen.prime();
        m.close();
        if (v === 'open') { this.open(null, { mine: true }); return; }
        this.listenList('Мои аудио', list, v === 'all' ? 0 : +v, 'tga:mine');
      });
    },
  };

  // the Telegram window: the tab «🎵 Аудио» (js/telegram.js shows it when this is loaded)
  if (window.Telegram) Telegram.tab_audio = function (el) { TgAudio.render(el, {}); };
  window.TgAudio = TgAudio;
})();
