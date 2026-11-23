/* ============ 📺 NRK TV inside the app — watch with Norwegian subtitles + Russian translation ============
 * The catalogue (front page, categories, search, series and their episodes) comes from NRK's public API
 * (psapi.nrk.no) through the Mac bridge (bridge/media.py — NRK lets only its own site read it from a browser).
 * A program plays in the app's subtitle player (Subs.openStream): NRK's own HLS stream (Safari / iPhone natively,
 * other browsers through hls.js) and NRK's Norwegian subtitles (WebVTT, «på all tale» when there is such a track),
 * the Russian line from the translator. Tap a word — the video pauses — «➕ В карточку» / «✍️ Выбрать…».
 * Every program also has «↗ NRK TV»: tv.nrk.no/se?v=… opens the NRK TV app on a phone (or the site).
 * Some programs are only for Norway (geo-blocked) — then NRK says so and the link remains.
 * 📡 Прямой эфир: NRK1, NRK2, NRK3, NRK Super, NRK Tegnspråk (+ live events from the page shown) with «сейчас / далее»
 * from NRK's programme guide (epg). A channel whose stream is encrypted (all NRK TV channels in 2026) or not available
 * here gets a clear lock and «↗ Открыть в NRK»; an open one plays in the same player in live mode — NRK's own live
 * subtitles if the stream has them, otherwise the app recognizes the speech (Subs.openStream({ live: true })).
 * 📱 A locked channel (or live event) whose stream carries NRK's live subtitles also gets «Субтитры с переводом — второй
 * экран»: the viewer watches it on the TV in NRK's app, this device shows those subtitles in sync, with the translation
 * (Subs.openStream({ companion: true }) — only the playlists' text and the subtitle pieces are read, never the picture).
 */
(function () {
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  const esc = s => U.esc(s == null ? '' : String(s));
  const TV = 'https://tv.nrk.no';
  const link = id => `${TV}/se?v=${encodeURIComponent(id)}`;
  const QUICK = ['Supernytt', 'Dagsrevyen', 'Nyheter', 'Newton', 'Norge rundt', 'Lindmo', 'Skam', 'Nytt på nytt', 'Fleksnes', 'Påsken'];

  /** images come in four shapes: {url,width} · {imageUrl,pixelWidth} · {uri,width} · {url,pixelWidth} */
  function pickImg(arr, want = 480) {
    arr = Array.isArray(arr) ? arr : (arr && (arr.webImages || arr.images)) || [];
    const list = arr.map(x => ({ u: x.url || x.imageUrl || x.uri, w: +(x.width || x.pixelWidth || 0) })).filter(x => x.u);
    if (!list.length) return '';
    list.sort((a, b) => a.w - b.w);
    return (list.find(x => x.w >= want) || list[list.length - 1]).u;
  }
  /** every object with a prfId somewhere inside (episodes are nested differently in news / series / season answers) */
  function findEpisodes(data, depth = 0, out = [], seen = new Set()) {
    if (!data || typeof data !== 'object' || depth > 7) return out;
    if (Array.isArray(data)) { data.forEach(x => findEpisodes(x, depth + 1, out, seen)); return out; }
    if (data.prfId && (data.titles || data.title) && !seen.has(data.prfId)) { seen.add(data.prfId); out.push(data); return out; }
    Object.keys(data).forEach(k => { if (k !== '_links') findEpisodes(data[k], depth + 1, out, seen); });
    return out;
  }
  const api = (path, params) => Subs.api('nrk', Object.assign({ path }, params || {}));
  const LIVE_TV = ['nrk1', 'nrk2', 'nrk3', 'nrksuper', 'nrk_tegnspraak'];
  const liveLink = id => `${TV}/direkte/${encodeURIComponent(id)}`;
  /** NRK's /Date(1794974400000+0100)/ or an ISO date → ms */
  const msOf = d => { const m = String(d || '').match(/\/Date\((-?\d+)/); return m ? +m[1] : Date.parse(d) || 0; };
  const hm = ms => new Date(ms).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  /** the programme guide of channels → { id: { now: {title, from, to}, next } } */
  function nowNext(epg, at = Date.now()) {
    const out = {};
    (Array.isArray(epg) ? epg : []).forEach(ch => {
      const id = (ch.channel || {}).id || String(ch.id || '').replace(/^epg_/, ''); if (!id) return;
      const es = (ch.entries || []).map(e => ({ title: e.title || e.seriesTitle || '', from: msOf(e.plannedStart || e.actualStart) })).filter(e => e.from).sort((a, b) => a.from - b.from);
      let k = -1; es.forEach((e, i) => { if (e.from <= at) k = i; });
      const now = k >= 0 ? es[k] : null, next = es[k + 1] || null;
      if (now && next) now.to = next.from;
      out[id] = { now, next };
    });
    return out;
  }
  /** a friendly line for the viewer (the bridge / NRK error text stays technical only when it is the bridge's own advice) */
  const friendly = err => (err && (err.noBridge || err.oldBridge) ? err.message : 'NRK сейчас не отвечает — проверьте интернет и попробуйте ещё раз');

  const NrkTV = {
    link, pickImg, findEpisodes, nowNext, msOf, hm, friendly, api,

    open() {
      const m = this._m = UI.modal({
        title: '📺 NRK TV — смотреть с субтитрами и переводом', cls: 'wide nrk-modal',
        body: `<div class="nrk-top">
            <div class="nrk-search"><input class="input" data-nq type="search" placeholder="Передача или сериал: Supernytt, Dagsrevyen, Skam…" enterkeyhint="search"><button class="btn primary" data-nact="search">🔎 Найти</button></div>
            <a class="btn ghost nrk-out" href="${TV}" target="_blank" rel="noopener" title="Открыть NRK TV в приложении или на сайте">↗ NRK TV</a>
          </div>
          <div class="nrk-quick">${QUICK.map(q => `<button class="chip" data-nquick="${esc(q)}">${esc(q)}</button>`).join('')}</div>
          <div class="nrk-nav" data-nnav></div>
          <div data-nbody class="nrk-body"></div>`,
      });
      this._stack = []; this._last = null; // «← Назад» goes through what was opened in THIS window
      m.el.addEventListener('click', e => this.onClick(e));
      m.$('[data-nq]').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.value.trim()) { e.preventDefault(); this.step(['search', e.target.value]); this.search(e.target.value); } });
      // whatever list is shown (front page, search, series, season) — its program tiles get checked as they come into view
      let pt = 0;
      new MutationObserver(() => { clearTimeout(pt); pt = setTimeout(() => this.probe(this.body()), 150); }).observe(m.$('[data-nbody]'), { childList: true, subtree: true });
      this.front();
      return m;
    },
    body() { return this._m && this._m.$('[data-nbody]'); },
    alive() { return this._m && this._m.el.isConnected; },
    busy(msg) { const b = this.body(); if (b) b.innerHTML = `<div class="nrk-empty"><span class="spinner sm"></span> ${esc(msg)}</div>`; },
    fail(err) {
      const b = this.body(); if (!b) return;
      b.innerHTML = `<div class="mt-warn"><span>⚠️</span><span><b>${esc(friendly(err))}.</b>
        ${err.noBridge || err.oldBridge ? '' : '<button class="btn sm" data-nact="retry">🔄 Ещё раз</button>'} Смотреть можно и на сайте или в приложении: <a href="${TV}" target="_blank" rel="noopener">↗ NRK TV</a></span></div>`;
    },
    nav(html) { const n = this._m && this._m.$('[data-nnav]'); if (n) n.innerHTML = html; },
    back(label) { return `<button class="btn sm ghost" data-nact="back">← ${esc(label || 'Назад')}</button>`; },

    /* ---------- tiles ---------- */
    tile(o) {
      // o: { kind: 'series'|'program', id, title, sub, img, date, dur, soon }
      // not out yet: a clear «⏳ ещё не вышло» over the picture (not just a paler tile); programs are checked lazily (see probe)
      // series too get checked (by one of their episodes) — «💬 субтитры» / «🤖 …» on every tile, and a ▶ to start at once
      return `<div class="nrk-tile ${o.soon ? 'soon' : ''}" ${o.soon ? '' : `data-probe="${o.kind === 'series' ? 's:' : ''}${esc(o.id)}"`}>
          ${o.kind === 'series' ? `<button class="nrk-play" data-nsplay="${esc(o.id)}" data-title="${esc(o.title)}" title="Смотреть сразу — первую серию (у новостей — свежий выпуск)" aria-label="Смотреть сразу">▶</button>` : ''}
          <button class="nrk-tile-main" data-n${o.kind === 'series' ? 'series' : 'play'}="${esc(o.id)}" data-title="${esc(o.title)}" data-sub="${esc(o.series || '')}" ${o.soon ? 'disabled aria-disabled="true"' : ''} title="${o.kind === 'series' ? 'Открыть выпуски' : o.soon ? `Пока нельзя посмотреть: ${esc(o.soon)}` : 'Смотреть здесь — с субтитрами и переводом'}">
            <span class="nrk-img">${o.img ? `<img src="${esc(o.img)}" alt="" loading="lazy">` : '<span class="nrk-noimg">📺</span>'}${o.kind === 'series' ? '<span class="nrk-tag">сериал · выпуски</span>' : o.dur ? `<span class="nrk-tag">${esc(o.dur)}</span>` : ''}
              ${o.soon ? `<span class="nrk-block"><span>⏳</span><b>Ещё не вышло</b><small>${esc(o.soon)}</small></span>` : '<span class="nrk-state" data-nstate></span>'}</span>
            <span class="nrk-t"><b>${esc(o.title)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}${o.date ? `<small class="muted">${esc(o.date)}</small>` : ''}${o.soon ? `<small class="muted">${esc(o.soon)}</small>` : ''}</span>
          </button>
          ${o.kind === 'series' ? '' : `<a class="nrk-ext" href="${esc(link(o.id))}" target="_blank" rel="noopener" title="Открыть в приложении или на сайте NRK TV">↗</a>`}
        </div>`;
    },

    /* ---------- front page / category ---------- */
    async front(pageId) {
      this.nav(pageId ? this.back('Главная') : '');
      this.busy('загружаю NRK TV…');
      try {
        const [page, pages] = await Promise.all([api(pageId ? 'tv/pages/' + pageId : 'tv/pages/frontpage'), this._pages ? Promise.resolve(this._pages) : api('tv/pages').catch(() => null)]);
        if (!this.alive()) return;
        this._pages = pages;
        const cats = ((pages && pages.pageListItems) || []).filter(p => p.id && p.title);
        const sections = (page.sections || []).filter(s => s.type === 'included' && s.included && (s.included.plugs || []).length);
        const plugTile = p => {
          const c = p.displayContractContent || {};
          const img = pickImg((c.displayContractImage || {}).webImages || c.displayContractImage);
          const t = p.targetType;
          if (t === 'series' && p.series) return this.tile({ kind: 'series', id: p.series.seriesId, title: c.contentTitle || p.series.seriesId, sub: c.description, img });
          const prog = t === 'episode' ? p.episode : t === 'standaloneProgram' ? p.standaloneProgram : null;
          if (prog && prog.programId) return this.tile({ kind: 'program', id: prog.programId, title: c.contentTitle || '', sub: c.description, img, series: prog.seriesId || '' });
          return '';
        };
        // 📡 live events on this page (news, sport): NRK marks them with a live badge
        const evs = [];
        (page.sections || []).forEach(s => ((s.included || {}).plugs || []).forEach(p => {
          const c = p.displayContractContent || {}, lc = p.liveChannelProgram, ch = p.channel;
          const id = (lc && lc.channelId) || (p.targetType === 'channel' && ch && ch.channelId);
          if (!id || evs.some(e => e.title === (c.contentTitle || id))) return;
          const lp = ((c.overlays || {}).liveProgress) || {}, from = Date.parse(lp.startTime || (lc || {}).plannedProgramStartTime || '') || 0, to = Date.parse(lp.endTime || (lc || {}).plannedProgramEndTime || '') || 0;
          if (to && to < Date.now()) return; // over
          evs.push({ id, title: c.contentTitle || id, sub: c.description || '', img: pickImg((c.displayContractImage || {}).webImages || c.displayContractImage || (c.backdropImage || {}).webImages), from, to });
        }));
        evs.sort((a, b) => (a.from || 0) - (b.from || 0));
        this.body().innerHTML = `${cats.length && !pageId ? `<div class="nrk-cats">${cats.map(p => `<button class="chip" data-npage="${esc(p.id)}">${esc(p.title)}</button>`).join('')}</div>` : ''}
          ${!pageId || evs.length ? `<section class="nrk-sec nrk-live" data-nlive><h3>📡 Прямой эфир</h3><div class="nrk-grid nrk-live-grid" data-nlive-grid>
              ${evs.slice(0, 8).map(e => this.liveTile({ id: e.id, title: e.title, sub: e.sub, img: e.img, from: e.from, to: e.to, event: true })).join('')}
              ${pageId ? '' : '<div class="nrk-empty" data-nlive-wait><span class="spinner sm"></span> загружаю каналы…</div>'}</div></section>` : ''}
          ${sections.map(s => { const tiles = s.included.plugs.map(plugTile).filter(Boolean).slice(0, 18); return tiles.length ? `<section class="nrk-sec">${s.included.title ? `<h3>${esc(s.included.title)}</h3>` : ''}<div class="nrk-grid">${tiles.join('')}</div></section>` : ''; }).join('')
            || '<div class="nrk-empty muted">Здесь пока пусто — попробуйте поиск.</div>'}
          <div class="tiny muted nrk-foot">Передачи NRK — для просмотра; в карточки попадают только отдельные слова и фразы со ссылкой на передачу. Некоторые передачи показываются только в Норвегии.</div>`;
        if (!pageId) this.liveChannels();
        this.liveProbe();
      } catch (err) { this.fail(err); }
    },

    /* ---------- 📡 live: channel cards with «сейчас / далее», a lock where NRK protects the stream ---------- */
    liveTile(o) {
      // o: { id, title, sub, img, now, next, from, to, event }
      const soon = o.event && o.from && o.from - 10 * 60000 > Date.now();
      const when = o.event && o.from ? (soon ? `начнётся в ${hm(o.from)}` : o.to ? `в эфире до ${hm(o.to)}` : 'в эфире') : '';
      return `<div class="nrk-tile nrk-ltile ${soon ? 'soon' : ''}" data-lprobe="${esc(o.id)}" data-ltitle="${esc(o.title)}" data-lsub="${esc(o.now ? o.now.title : o.sub || '')}" data-limg="${esc(o.img || '')}"${o.event ? ' data-levent="1"' : ''}>
          <button class="nrk-tile-main" data-nlive="${esc(o.id)}" data-title="${esc(o.title)}" data-sub="${esc(o.now ? o.now.title : o.sub || '')}" ${soon ? 'disabled aria-disabled="true"' : ''} title="${soon ? `Эфир ${esc(when)}` : 'Смотреть прямой эфир здесь — с субтитрами и переводом'}">
            <span class="nrk-img">${o.img ? `<img src="${esc(o.img)}" alt="" loading="lazy">` : '<span class="nrk-noimg">📡</span>'}<span class="nrk-live-badge">● ${soon ? 'скоро' : 'эфир'}</span>
              ${soon ? `<span class="nrk-block"><span>⏳</span><b>Ещё не началось</b><small>${esc(when)}</small></span>` : '<span class="nrk-state" data-nstate></span>'}</span>
            <span class="nrk-t"><b>${esc(o.title)}</b>
              ${o.now ? `<small>сейчас: ${esc(o.now.title)}${o.now.to ? ` · до ${hm(o.now.to)}` : ''}</small>` : o.sub ? `<small>${esc(o.sub)}</small>` : ''}
              ${o.next ? `<small class="muted">далее: ${esc(o.next.title)} · ${hm(o.next.from)}</small>` : when ? `<small class="muted">${esc(when)}</small>` : ''}</span>
          </button>
          <a class="nrk-ext" href="${esc(liveLink(o.id))}" target="_blank" rel="noopener" title="Открыть эфир в приложении или на сайте NRK TV">↗</a>
        </div>`;
    },
    /** NRK1 · NRK2 · NRK3 · NRK Super · NRK Tegnspråk with what is on now and next */
    async liveChannels() {
      const grid = () => this._m && this._m.$('[data-nlive-grid]');
      try {
        const [list, epg] = await Promise.all([api('tv/live'), api('epg/' + LIVE_TV.join(',')).catch(() => null)]);
        const g = grid(); if (!g || !this.alive()) return;
        const nn = nowNext(epg);
        const chans = LIVE_TV.map(id => (Array.isArray(list) ? list : []).find(c => c.id === id)).filter(Boolean);
        const w = g.querySelector('[data-nlive-wait]'); if (w) w.remove();
        g.insertAdjacentHTML('afterbegin', chans.map(c => {
          const pb = (c._embedded || {}).playback || {}, poster = ((pb.posters || [])[0] || {}).image || {};
          return this.liveTile(Object.assign({ id: c.id, title: pb.title || c.id, img: pickImg(poster.items || []) }, nn[c.id] || {}));
        }).join(''));
        this.liveProbe();
      } catch (err) {
        const g = grid(); if (!g) return;
        const w = g.querySelector('[data-nlive-wait]');
        const html = `<div class="mt-warn nrk-live-err"><span>📡</span><span>Каналы прямого эфира не загрузились: ${esc(friendly(err))}. <button class="btn sm" data-nact="live-retry">🔄 Ещё раз</button></span></div>`;
        if (w) w.outerHTML = html; else g.insertAdjacentHTML('beforeend', html);
      }
    },
    /** every live card asks NRK (through the bridge) whether its stream can play here: 🔒 encrypted / 🌍 Norway only */
    liveProbe() {
      const root = this.body(); if (!root) return;
      const cache = this._lprobe || (this._lprobe = new Map());
      root.querySelectorAll('[data-lprobe]').forEach(tile => {
        const id = tile.dataset.lprobe; tile.removeAttribute('data-lprobe');
        if (tile.classList.contains('soon')) return;
        const p = cache.get(id) || api('playback/manifest/channel/' + id).then(man => this.liveState(man));
        cache.set(id, p); p.catch(() => cache.delete(id));
        p.then(r => {
          this.liveMark(tile, id, r);
          // 📱 protected, but NRK's live subtitles are in its playlist → they can follow the TV on this device
          if (r.enc) (r.vtt || (r.vtt = Subs.liveVttUrl(r.enc).catch(() => ''))).then(v => { if (v) this.liveSecond(tile, id); });
        }).catch(() => { /* unknown — the card stays as it is */ });
      });
    },
    /** a channel manifest → { ok, url } or { lock: '🔒'|'🌍'|'⛔', why } */
    liveState(man) {
      const pl = man.playable || {}, av = man.availability || {};
      if (man.playability !== 'playable' || !(pl.assets || []).length) {
        const np = man.nonPlayable || {};
        return { lock: av.isGeoBlocked ? '🌍' : '⛔', label: av.isGeoBlocked ? 'Только в Норвегии' : 'Сейчас нет эфира', why: np.endUserMessage || (av.isGeoBlocked ? 'эфир показывают только в Норвегии' : 'канал сейчас не вещает') };
      }
      const a = pl.assets.find(x => /hls/i.test(x.format || '') && !x.encrypted);
      // protected: only its playlist address is kept — for the subtitle track in it (📱 second screen); the picture is never read
      if (!a) return { lock: '🔒', label: 'Только в приложении NRK', why: 'NRK защищает этот эфир — смотрите его в NRK TV', enc: (pl.assets.find(x => /hls/i.test(x.format || '')) || {}).url || '' };
      return { ok: true, url: a.url, audio: man.sourceMedium === 'audio' };
    },
    liveMark(tile, id, r) {
      if (!tile.isConnected || r.ok) return;
      // a locked channel: the whole card opens NRK (a link, not a button that leads nowhere)
      tile.classList.add('blocked');
      const b = tile.querySelector('.nrk-tile-main'); if (!b) return;
      const a = document.createElement('a');
      a.className = 'nrk-tile-main'; a.href = liveLink(id); a.target = '_blank'; a.rel = 'noopener';
      a.title = `${r.why} — откроется NRK TV`;
      a.innerHTML = b.innerHTML;
      const st = a.querySelector('[data-nstate]');
      if (st) st.outerHTML = `<span class="nrk-block"><span>${r.lock}</span><b>${esc(r.label)}</b><small>${esc(r.why)}</small><span class="nrk-open">↗ Открыть в NRK</span></span>`;
      b.replaceWith(a);
    },
    /** 📱 the button under a locked card: the TV shows the channel (NRK's app), this device its subtitles with translation */
    liveSecond(tile, id) {
      if (!tile.isConnected || tile.querySelector('[data-n2nd]')) return;
      tile.classList.add('has-2nd');
      tile.insertAdjacentHTML('beforeend', `<button type="button" class="nrk-2nd" data-n2nd="${esc(id)}" aria-label="Субтитры с переводом — второй экран"
          title="Смотрите эфир на телевизоре в приложении NRK — здесь его субтитры NRK с переводом, синхронно">
          <span class="n2-ico" aria-hidden="true">📱</span><span class="n2-txt"><b>Субтитры с переводом</b><small>второй экран к телевизору</small></span></button>`);
    },
    /** 📱 second screen: NRK's live subtitles of a protected channel in the player, following the TV by the clock */
    async watchSecond(id, o = {}) {
      const busy = UI.busy ? UI.busy('Открываю субтитры эфира NRK…') : null;
      try {
        const r = this.liveState(await api('playback/manifest/channel/' + id));
        const url = r.ok ? r.url : r.enc;
        if (!url) throw Object.assign(new Error(r.why || 'канал сейчас не вещает'), { lock: r.lock || '⛔' });
        // only the master playlist's text: which subtitle track it has (the picture and the sound stay untouched)
        const vtt = await Subs.liveVttUrl(url).catch(() => '');
        if (!vtt) throw Object.assign(new Error('у этого эфира сейчас нет субтитров NRK — смотрите его в NRK TV'), { lock: '💬' });
        if (busy) busy.close();
        Subs.openStream({
          kind: 'nrk', live: true, companion: true, id, title: o.title || id,
          channel: o.sub ? (o.event ? o.sub : 'сейчас: ' + o.sub) : 'NRK TV · прямой эфир', poster: o.img || '',
          link: liveLink(id), at: () => liveLink(id), hls: '', cues: [], liveVtt: vtt, autoAsr: false,
          freshVtt: async () => { const r2 = this.liveState(await api('playback/manifest/channel/' + id)); const u = r2.ok ? r2.url : r2.enc; return u ? Subs.liveVttUrl(u) : ''; },
          onAir: async () => { const n = nowNext(await api('epg/' + id))[id]; return n && n.now; },
          subName: 'субтитры NRK (прямой эфир)',
          note: '<b>Второй экран:</b> эфир идёт на телевизоре в приложении NRK, а здесь — его субтитры NRK с переводом: нажмите на слово — перевод, «➕» — строка в карточки. Видео NRK защищает вместе со звуком, поэтому приложение не показывает эфир и не может само распознать речь — здесь только субтитры NRK (у передач без субтитров строк не будет).',
        });
      } catch (err) {
        if (busy) busy.close();
        const msg = err.lock ? err.message : friendly(err);
        UI.toastAction ? UI.toastAction(`${err.lock || '⚠️'} ${msg}`, '↗ Открыть в NRK', () => window.open(liveLink(id), '_blank', 'noopener'), 9000, err.lock || '⚠️') : UI.toast(msg, 'warn');
      }
    },
    /** play a live channel here (an open stream) — or say clearly why not, with the way to NRK */
    async watchLive(id, title, sub) {
      const busy = UI.busy ? UI.busy('Открываю прямой эфир NRK…') : null;
      try {
        const r = this.liveState(await api('playback/manifest/channel/' + id));
        if (!r.ok) throw Object.assign(new Error(r.why), { lock: r.lock });
        // NRK's own live subtitles in the stream? Otherwise the app recognizes the speech
        let vtt = ''; try { vtt = await Subs.liveVttUrl(r.url); } catch (e) { /* none */ }
        if (busy) busy.close();
        Subs.openStream({
          kind: 'nrk', live: true, audio: r.audio, id, title: title || id, channel: sub ? 'сейчас: ' + sub : 'NRK TV · прямой эфир', link: liveLink(id), at: () => liveLink(id),
          hls: r.url, cues: [], liveVtt: vtt, autoAsr: !vtt, poster: '',
          fresh: async () => { const r2 = this.liveState(await api('playback/manifest/channel/' + id)); return r2.ok ? r2.url : ''; },
          subName: vtt ? 'субтитры NRK (прямой эфир)' : 'субтитры, созданные приложением (распознавание речи)',
          note: vtt ? 'Это <b>прямой эфир</b>: субтитры NRK приходят вместе с эфиром — строки появляются в списке по мере показа и сразу переводятся. Можно поставить на паузу и вернуться назад (до нескольких часов) — кнопка «⏭ К прямому эфиру» вернёт в эфир.'
            : `<b>У этого эфира нет субтитров — приложение создаст их само.</b> Оно слушает звук эфира и распознаёт речь (модель NB-Whisper Национальной библиотеки Норвегии, прямо на этом устройстве — звук никуда не отправляется), а потом переводит строки. Строки появляются через несколько секунд после того, как прозвучали; помечены ${BOT()} — в словах возможны ошибки.`,
        });
      } catch (err) {
        if (busy) busy.close();
        const msg = err.lock ? err.message : friendly(err);
        UI.toastAction ? UI.toastAction(`${err.lock || '⚠️'} ${msg}`, '↗ Открыть в NRK', () => window.open(liveLink(id), '_blank', 'noopener'), 9000, err.lock || '⚠️') : UI.toast(msg, 'warn');
      }
    },

    /* ---------- search ---------- */
    async search(q) {
      q = String(q || '').trim(); if (!q) return;
      const inp = this._m.$('[data-nq]'); if (inp && inp.value !== q) inp.value = q;
      this.nav(this.back('Главная'));
      this.busy(`ищу «${q}»…`);
      try {
        const r = await api('search', { q });
        if (!this.alive()) return;
        const hits = (r.hits || []).filter(h => h && h.hit);
        const tiles = hits.map(({ type, hit }) => {
          const img = pickImg((hit.image || {}).webImages || hit.image);
          if (type === 'serie') return this.tile({ kind: 'series', id: hit.id, title: hit.title, sub: hit.description, img });
          const soon = hit.usageRights && hit.usageRights.hasRightsNow === false ? 'сейчас недоступно' : '';
          return this.tile({ kind: 'program', id: hit.id, title: hit.title, sub: [hit.seriesTitle, hit.episodeTitle].filter(Boolean).join(' · ') || hit.description, img, soon, series: hit.seriesTitle || '' });
        });
        this.body().innerHTML = tiles.length ? `<div class="nrk-grid">${tiles.join('')}</div>` : `<div class="nrk-empty muted">По запросу «${esc(q)}» ничего не нашлось.</div>`;
      } catch (err) { this.fail(err); }
    },

    /* ---------- a series: latest episodes + seasons ---------- */
    async series(slug, title) {
      this.nav(this.back('Назад'));
      this.busy(`загружаю «${title || slug}»…`);
      try {
        const d = await api('tv/catalog/series/' + slug);
        if (!this.alive()) return;
        const info = d[d.seriesType] || d.sequential || d.standard || d.news || {};
        const name = ((info.titles || {}).title) || title || slug;
        const seasons = ((d._embedded || {}).seasons || []).map(s => ({ id: ((s._links || {}).self || {}).name || s.id, title: (s.titles || {}).title || '' }))
          .concat(((d._links || {}).seasons || []).map(s => ({ id: s.name || String(s.href || '').split('/').pop(), title: s.title || '' })))
          .filter((s, i, a) => s.id && a.findIndex(x => x.id === s.id) === i);
        this._series = { slug, name, img: pickImg(info.image || info.posterImage) };
        let eps = findEpisodes(d._embedded && d._embedded.instalments ? d._embedded.instalments : {});
        if (!eps.length) eps = findEpisodes(d._embedded || {});
        if (!eps.length && seasons.length) eps = findEpisodes(await api(`tv/catalog/series/${slug}/seasons/${seasons[0].id}`));
        // the big picture starts watching: the first episode (news: the newest) — the same as tapping it in the list
        const start = eps.find(ep => !(ep.availability && ep.availability.status && ep.availability.status !== 'available'));
        const startTitle = start ? ((start.titles || {}).title || start.prfId) : '';
        const pic = this._series.img ? `<img src="${esc(this._series.img)}" alt="">` : '<span class="nrk-noimg">📺</span>';
        this.body().innerHTML = `<div class="nrk-series-head">${start
            ? `<button class="nrk-head-play" data-nplay="${esc(start.prfId)}" data-title="${esc(startTitle)}" data-sub="${esc(name)}" title="Смотреть здесь — с субтитрами и переводом">${pic}<span class="nrk-head-btn">▶ Смотреть: ${esc(startTitle)}</span></button>`
            : pic}
            <div><h3>${esc(name)}</h3>${(info.titles || {}).subtitle ? `<div class="small muted">${esc(info.titles.subtitle)}</div>` : ''}
            <a class="btn sm ghost" href="${TV}/serie/${encodeURIComponent(slug)}" target="_blank" rel="noopener">↗ NRK TV</a></div></div>
          ${seasons.length > 1 ? `<label class="field nrk-season"><span>Сезон / месяц</span><select class="input" data-nseason>${seasons.map((s, i) => `<option value="${esc(s.id)}" ${i === 0 ? 'selected' : ''}>${esc(s.title || s.id)}</option>`).join('')}</select></label>` : ''}
          <div class="nrk-grid" data-neps>${this.episodesHtml(eps, name)}</div>`;
        const sel = this.body().querySelector('[data-nseason]');
        if (sel) sel.onchange = async () => {
          const box = this.body().querySelector('[data-neps]');
          box.innerHTML = '<div class="nrk-empty"><span class="spinner sm"></span></div>';
          try { box.innerHTML = this.episodesHtml(findEpisodes(await api(`tv/catalog/series/${slug}/seasons/${sel.value}`)), name); }
          catch (err) { box.innerHTML = `<div class="mt-warn"><span>⚠️</span><span>${esc(U.niceErr(err))}</span></div>`; }
        };
      } catch (err) { this.fail(err); }
    },
    /** the episode to start a series with: news — the newest; other series — the first; only ones that are out (cached) */
    async firstEpisode(slug) {
      const cache = this._first || (this._first = new Map());
      if (cache.has(slug)) return cache.get(slug);
      const p = (async () => {
        const d = await api('tv/catalog/series/' + slug);
        const info = d[d.seriesType] || d.sequential || d.standard || d.news || {};
        let eps = findEpisodes(d._embedded && d._embedded.instalments ? d._embedded.instalments : {});
        if (!eps.length) eps = findEpisodes(d._embedded || {});
        if (!eps.length) {
          const s = (((d._embedded || {}).seasons || [])[0] || {}), sid = ((s._links || {}).self || {}).name || s.id || (((d._links || {}).seasons || [])[0] || {}).name;
          if (sid) eps = findEpisodes(await api(`tv/catalog/series/${slug}/seasons/${sid}`));
        }
        const ok = eps.filter(ep => !(ep.availability && ep.availability.status && ep.availability.status !== 'available'));
        const ep = ok[0]; if (!ep) return null;
        return { prfId: ep.prfId, title: (ep.titles || {}).title || ep.prfId, series: (info.titles || {}).title || slug };
      })();
      cache.set(slug, p);
      p.catch(() => cache.delete(slug));
      return p;
    },
    episodesHtml(eps, seriesName) {
      if (!eps.length) return '<div class="nrk-empty muted">Выпусков нет — откройте передачу на сайте NRK TV.</div>';
      return eps.slice(0, 60).map(ep => {
        const av = ep.availability || {};
        const soon = av.status && av.status !== 'available' ? (av.label || 'пока недоступно') : '';
        return this.tile({
          kind: 'program', id: ep.prfId, title: (ep.titles || {}).title || ep.title || ep.prfId, sub: (ep.titles || {}).subtitle || '',
          img: pickImg(ep.image), date: ep.firstTransmissionDateDisplayValue || '', dur: ep.durationDisplayValue || '', soon, series: seriesName || '',
        });
      }).join('');
    },

    /**
     * every program tile that comes into view asks NRK (through the bridge, cached) whether it can be watched here:
     * 🔒 protected → only in the NRK app · ⛔ not playable (with NRK's reason) · 💬 has subtitles · 🤖 no subtitles —
     * the app will make them. So nobody has to tap a tile to find out.
     */
    probe(root) {
      if (!root || !('IntersectionObserver' in window)) return;
      const cache = this._probe || (this._probe = new Map());
      // ONE queue + observer per window: probe() runs after every change of the list (also after each mark) — a fresh
      // queue each time let 3 requests per call fly at once (12+ while scrolling) and kept asking for lists already gone
      if (!this._pq || this._pq.m !== this._m) { if (this._pq && this._pq.io) this._pq.io.disconnect(); this._pq = { m: this._m, queue: [], running: 0, io: null }; }
      const P = this._pq;
      const near = t => { const r = t.getBoundingClientRect(); return r.width > 0 && r.bottom > -200 && r.top < innerHeight + 200; };
      const mark = (tile, r) => {
        const st = tile.querySelector('[data-nstate]'); if (!st) return;
        if (r.block) {
          tile.classList.add('blocked');
          const b = tile.querySelector('.nrk-tile-main'); if (b) { b.title = r.why; b.dataset.blocked = r.why; }
          st.outerHTML = `<span class="nrk-block"><span>${r.icon}</span><b>${esc(r.label)}</b><small>${esc(r.why)}</small></span>`;
        } else if (r.chip) st.innerHTML = `<span class="nrk-chip" title="${esc(r.why || '')}">${esc(r.chip)}</span>`;
        else st.innerHTML = r.subs ? '<span class="nrk-chip ok" title="У передачи есть норвежские субтитры NRK">💬 субтитры</span>'
          : `<span class="nrk-chip asr" title="Субтитров нет — приложение само распознает речь и переведёт">${BOT()} субтитры создаст приложение</span>`;
      };
      const next = () => {
        while (P.running < 3 && P.queue.length) {
          const tile = P.queue.shift(), id = tile.dataset.probe;
          if (!id || !tile.isConnected) continue; // already asked / that list is gone
          if (!near(tile)) { P.io.observe(tile); continue; } // scrolled past meanwhile: ask when it is back in view
          tile.removeAttribute('data-probe');
          if (cache.has(id)) { mark(tile, cache.get(id)); continue; }
          P.running++;
          // a series: judged by its first (news: newest) episode; «🔒» there is only a chip — other episodes may play
          const isSeries = id.startsWith('s:');
          (isSeries ? this.firstEpisode(id.slice(2)).then(ep => { if (!ep) throw new Error('none'); return api('playback/manifest/program/' + ep.prfId); }) : api('playback/manifest/program/' + id)).then(man => {
            const pl = man.playable || {};
            let r;
            if (man.playability !== 'playable' || !(pl.assets || []).length) {
              const np = man.nonPlayable || {};
              r = { block: true, icon: (man.availability || {}).isGeoBlocked ? '🌍' : '⛔', label: 'Нельзя посмотреть', why: np.endUserMessage || np.reason || ((man.availability || {}).isGeoBlocked ? 'только в Норвегии' : 'сейчас недоступно') };
            } else if (!pl.assets.some(a => /hls/i.test(a.format || '') && !a.encrypted)) r = { block: true, icon: '🔒', label: 'Только в приложении NRK', why: 'передача защищена — нажмите ↗, чтобы смотреть в NRK TV' };
            else r = { subs: (pl.subtitles || []).some(s => s.webVtt) };
            if (isSeries && r.block) r = { chip: r.icon === '🔒' ? '🔒 только в приложении NRK' : '⛔ сейчас нельзя посмотреть', why: r.why };
            cache.set(id, r); mark(tile, r);
          }).catch(() => { /* unknown — the tile stays as it is */ }).finally(() => { P.running--; next(); });
        }
      };
      if (!P.io) P.io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { P.io.unobserve(e.target); P.queue.push(e.target); next(); } }), { rootMargin: '200px' });
      root.querySelectorAll('[data-probe]').forEach(t => P.io.observe(t));
    },

    /* ---------- watch: manifest → stream + subtitles → the subtitle player ---------- */
    async watch(id, title, series) {
      const busy = UI.busy ? UI.busy('Открываю передачу NRK…') : null;
      try {
        const man = await api('playback/manifest/program/' + id);
        const pl = man.playable || {};
        if (man.playability !== 'playable' || !(pl.assets || []).length) {
          const np = man.nonPlayable || {};
          throw new Error(np.endUserMessage || np.reason || ((man.availability || {}).isGeoBlocked ? 'передача доступна только в Норвегии' : 'эту передачу сейчас нельзя посмотреть'));
        }
        const asset = pl.assets.find(a => /hls/i.test(a.format || '') && !a.encrypted) || null;
        if (!asset) throw new Error('эта передача защищена — смотрите её в приложении NRK TV');
        // subtitles: «на всю речь» (nor) first, then the default one, then any Norwegian
        const subs = (pl.subtitles || []).filter(s => s.webVtt);
        // «Norsk – på all tale» (type ttv) is the whole speech; type «nor» is often only the translated bits (1 cue in IBOT25111626)
        // several tracks: the one with the most lines wins (the whole speech), «all tale» first when equal
        let sub = null, cues = [], note = '';
        const got = await Promise.all(subs.slice(0, 4).map(async s => {
          try { return { s, cues: Subs._parse(await (await fetch(s.webVtt)).text(), 'nrk.vtt').map(c => ({ start: c.start, end: c.end, text: c.text })) }; }
          catch (e) { return { s, cues: [] }; }
        }));
        got.sort((a, b) => b.cues.length - a.cues.length || (/all tale/i.test(b.s.label || '') ? 1 : 0) - (/all tale/i.test(a.s.label || '') ? 1 : 0));
        if (got.length && got[0].cues.length) { sub = got[0].s; cues = got[0].cues; }
        else if (subs.length) note = 'Субтитры NRK не загрузились — видео играет без них.';
        // NRK sometimes subtitles only foreign speech / signs («Vikingtida begynner nå!» — 3 lines in 22 minutes):
        // fewer than ~1.5 lines a minute = not real subtitles → the app recognizes the rest itself (NRK's lines stay)
        const dm = String(pl.duration || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
        const minutes = dm ? (+dm[1] || 0) * 60 + (+dm[2] || 0) + (+dm[3] || 0) / 60 : 0;
        const sparse = cues.length > 0 && minutes > 3 && cues.length / minutes < 1.5;
        if (sparse) note = `<b>У этой передачи NRK субтитры только к отдельным фразам (${cues.length} на ${Math.round(minutes)} мин) — остальную речь приложение распознает само.</b>
          Строки NRK останутся, распознанные встанут между ними (значок ${BOT()}, в словах возможны ошибки — карточки из них получат пометку «проверить»).`;
        const autoAsr = !cues.length || sparse;
        if (!cues.length) note = `<b>У этой передачи NRK нет субтитров — приложение создаст их само.</b> Оно слушает звук передачи и распознаёт речь
          (модель NB-Whisper Национальной библиотеки Норвегии, прямо на этом устройстве — звук никуда не отправляется), а потом переводит строки.
          Такие строки помечены ${BOT()}: в словах возможны ошибки, а карточки из них получат пометку «проверить».
          Если в самом видео видны норвежские субтитры — они впечатаны в картинку (так бывает в детских передачах NRK): прочитать их приложение не может, а строки ${BOT()} делятся на фразы по-своему.${note ? ' ' + note : ''}`;
        if (!title) { try { const md = await api('playback/metadata/program/' + id); title = ((md.preplay || {}).titles || {}).subtitle || ((md.preplay || {}).titles || {}).title || id; series = series || ((md.preplay || {}).titles || {}).title || ''; } catch (e) { title = id; } }
        if (busy) busy.close();
        Subs.openStream({
          kind: 'nrk', id, title, channel: series && series !== title ? series : 'NRK TV', link: link(id), at: () => link(id),
          hls: asset.url, cues, autoAsr,
          // after a long pause NRK's stream address may have expired → the player asks for a fresh one (same program)
          fresh: async () => { const m2 = await api('playback/manifest/program/' + id); const a2 = ((m2.playable || {}).assets || []).find(a => /hls/i.test(a.format || '') && !a.encrypted); return a2 ? a2.url : ''; }, nrkVtt: sub ? sub.webVtt : '', poster: '',
          subName: !cues.length ? 'субтитры, созданные приложением (распознавание речи)' : `субтитры NRK (${sub.label || sub.language || 'norsk'})${sparse ? ' + распознанная речь' : ''}`,
          note: note || (sub && sub.type === 'ttv' ? 'Это субтитры для слабослышащих (teksting) — иногда короче, чем сказано.' : ''),
        });
      } catch (err) {
        if (busy) busy.close();
        UI.toastAction ? UI.toastAction(`NRK: ${err.message}`, '↗ Открыть в NRK TV', () => window.open(link(id), '_blank', 'noopener'), 9000, '⚠️') : UI.toast(err.message, 'warn');
      }
    },

    /** remember where we were (for «← Назад») and what is shown now */
    step(now) { this._stack.push(this._last || ['front']); this._last = now; },
    onClick(e) {
      const t = e.target;
      const q = t.closest('[data-nquick]'); if (q) { this.step(['search', q.dataset.nquick]); this.search(q.dataset.nquick); return; }
      const pg = t.closest('[data-npage]'); if (pg) { this.step(['front', pg.dataset.npage]); this.front(pg.dataset.npage); return; }
      const s = t.closest('[data-nseries]'); if (s) { this.step(['series', s.dataset.nseries, s.dataset.title]); this.series(s.dataset.nseries, s.dataset.title); return; }
      const p = t.closest('[data-nplay]'); if (p) { this.watch(p.dataset.nplay, p.dataset.title, p.dataset.sub); return; }
      const s2 = t.closest('[data-n2nd]');
      if (s2) { const tl = s2.closest('.nrk-ltile') || s2; this.watchSecond(s2.dataset.n2nd, { title: tl.dataset.ltitle, sub: tl.dataset.lsub, img: tl.dataset.limg, event: !!tl.dataset.levent }); return; }
      const lv = t.closest('button[data-nlive]'); if (lv) { this.watchLive(lv.dataset.nlive, lv.dataset.title, lv.dataset.sub); return; }
      const sp = t.closest('[data-nsplay]');
      if (sp) {
        // ▶ on a series tile: straight to its first (news: newest) episode
        e.stopPropagation();
        sp.disabled = true; sp.innerHTML = '<span class="spinner sm"></span>';
        this.firstEpisode(sp.dataset.nsplay).then(ep => {
          if (ep) this.watch(ep.prfId, ep.title, ep.series);
          else UI.toast('У этого сериала сейчас нет доступных выпусков — откройте его, чтобы посмотреть список', 'warn', 5000);
        }).catch(err => UI.toast('NRK: ' + err.message, 'warn')).finally(() => { if (sp.isConnected) { sp.disabled = false; sp.innerHTML = '▶'; } });
        return;
      }
      const a = t.closest('[data-nact]');
      if (a && a.dataset.nact === 'search') { if (!this._m.$('[data-nq]').value.trim()) return; this.step(['search', this._m.$('[data-nq]').value]); this.search(this._m.$('[data-nq]').value); return; }
      if (a && a.dataset.nact === 'live-retry') { const w = a.closest('.nrk-live-err'); if (w) w.outerHTML = '<div class="nrk-empty" data-nlive-wait><span class="spinner sm"></span> загружаю каналы…</div>'; this.liveChannels(); return; }
      if (a && a.dataset.nact === 'retry') { const prev = this._last || ['front']; if (prev[0] === 'series') this.series(prev[1], prev[2]); else if (prev[0] === 'search') this.search(prev[1]); else this.front(prev[1]); return; }
      if (a && a.dataset.nact === 'back') {
        const prev = this._stack.pop() || ['front'];
        this._last = prev;
        if (prev[0] === 'series') this.series(prev[1], prev[2]);
        else if (prev[0] === 'search') this.search(prev[1]);
        else this.front(prev[1]);
      }
    },
  };

  window.NrkTV = NrkTV;
})();
