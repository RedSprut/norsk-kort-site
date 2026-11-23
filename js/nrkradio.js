/* ============ 📻 NRK Radio and podcasts inside the app — listen with Norwegian subtitles + Russian translation ============
 * The catalogue comes from NRK's public API (psapi.nrk.no) through the Mac bridge (bridge/media.py), like 📺 NRK TV:
 *  - 📡 live radio: P1, P2, P3, mP3, NRK Nyheter, Klassisk, Super… with «сейчас / далее» from the programme guide (epg);
 *  - 🎧 podcasts: NRK's popular ones / categories, search, a podcast's episodes; radio series and programs on demand.
 * Everything plays in the app's subtitle player (Subs.openStream, sound only): live radio and programs are HLS (AAC),
 * podcasts are one MP3 file. NRK has no subtitles / transcripts for radio and podcasts, so the app makes them itself
 * (NB-Whisper on this device — the same «субтитры создаёт приложение» as for NRK TV programs without subtitles);
 * then translation, «слово (перевод)», speed, cards — as usual. Every item also has «↗» to radio.nrk.no.
 * W6 — everywhere except the Mac (the site, the store apps): NRK's catalogue (psapi) is Mac-only (decision O-6), so the
 * window shows what works without it, and nothing that would not:
 *  - live radio: NRK's own public direct streams (lyd.nrk.no, the links NRK publishes for radio players) in a small
 *    player here, with the lock-screen controls (Media Session; ⏮ ⏭ = the neighbouring channel). No subtitles on air here
 *    (those streams can't be read for speech recognition) — said plainly;
 *  - podcasts: NRK's public RSS feeds (the server's fetch-public «rss» allow-list on the site — today Supernytt; every feed
 *    below in the store apps, through native HTTP); an episode plays from NRK's own file in the subtitle player, the app
 *    makes the subtitles on this device (NRK serves the files with CORS + Range), translation, cards — as on the Mac;
 *  - whatever can't load becomes a calm link to NRK Radio. Never a geo-block workaround, never another host.
 */
(function () {
  const esc = s => U.esc(s == null ? '' : String(s));
  const RADIO = 'https://radio.nrk.no';
  const api = (path, params) => Subs.api('nrk', Object.assign({ path }, params || {}));
  // the national channels (the 15 regional P1 channels are left out — P1 is there)
  const MAIN = ['p1', 'p2', 'p3', 'mp3', 'alltid_nyheter', 'klassisk', 'radio_super', 'p1pluss', 'p3musikk', 'jazz', 'folkemusikk', 'sport', 'sapmi'];
  const QUICK = ['Abels tårn', 'Dagsnytt 18', 'Norgeshistorie', 'Kjapt oppdatert', 'Lørdagsrådet', 'Radioresepsjonen'];
  const pick = (arr, want) => NrkTV.pickImg(arr, want);
  /** «PT57M8S» → seconds */
  const secs = d => { const m = String(d || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };
  const durTxt = d => { const s = secs(d); if (!s) return ''; const h = Math.floor(s / 3600), m = Math.round(s % 3600 / 60); return h ? `${h} ч ${m} мин` : `${Math.max(1, m)} мин`; };
  const dateTxt = d => { const t = Date.parse(d || ''); return t ? new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; };
  const last = (href, k = 1) => String(href || '').split('/').filter(Boolean).slice(-k)[0] || '';
  const link = o => o.kind === 'channel' ? `${RADIO}/direkte/${encodeURIComponent(o.id)}`
    : o.kind === 'pep' ? `${RADIO}/podkast/${encodeURIComponent(o.pid || '')}/${encodeURIComponent(o.id)}`
    : o.kind === 'podcast' ? `${RADIO}/podkast/${encodeURIComponent(o.id)}`
    : o.kind === 'series' ? `${RADIO}/serie/${encodeURIComponent(o.id)}`
    : o.series ? `${RADIO}/serie/${encodeURIComponent(o.series)}/${encodeURIComponent(o.id)}` : `${RADIO}/program/${encodeURIComponent(o.id)}`;
  /** every object with an episodeId somewhere inside (series / seasons / podcast answers nest them differently) */
  function findEps(data, depth = 0, out = [], seen = new Set()) {
    if (!data || typeof data !== 'object' || depth > 8) return out;
    if (Array.isArray(data)) { data.forEach(x => findEps(x, depth + 1, out, seen)); return out; }
    if (data.episodeId && data.titles && !seen.has(data.episodeId)) { seen.add(data.episodeId); out.push(data); return out; }
    Object.keys(data).forEach(k => { if (k !== '_links') findEps(data[k], depth + 1, out, seen); });
    return out;
  }
  const NOTE = live => `<b>У ${live ? 'радиоэфира' : 'радио и подкастов'} NRK нет субтитров — приложение создаёт их само.</b> Оно слушает звук и распознаёт норвежскую речь
    (модель NB-Whisper Национальной библиотеки Норвегии, прямо на этом устройстве — звук никуда не отправляется), а потом переводит строки.
    ${live ? 'Строки появляются через несколько секунд после того, как прозвучали.' : 'Строки появляются чуть впереди звука — слушать для этого не обязательно.'}
    Такие строки помечены 🤖: в словах возможны ошибки, а карточки из них получат пометку «проверить».`;

  /* ---------- W6: the window without the Mac bridge ---------- */
  const IC = (n, sz) => (window.MediaIcons ? MediaIcons.icon(n, sz || 18) : '');
  const LYD = 'https://lyd.nrk.no/';
  // NRK's public live streams (MP3, the addresses NRK publishes for radio players) — id: radio.nrk.no/direkte/<id>
  const LIVE = [
    ['p1', 'NRK P1', 'nrk_radio_p1_ostlandssendingen_mp3_h', 'разговоры, новости, музыка'],
    ['p2', 'NRK P2', 'nrk_radio_p2_mp3_h', 'культура и общество'],
    ['p3', 'NRK P3', 'nrk_radio_p3_mp3_h', 'молодёжное радио'],
    ['alltid_nyheter', 'NRK Nyheter', 'nrk_radio_alltid_nyheter_mp3_h', 'новости весь день'],
    ['mp3', 'NRK mP3', 'nrk_radio_mp3_mp3_h', 'поп-музыка'],
    ['klassisk', 'NRK Klassisk', 'nrk_radio_klassisk_mp3_h', 'классическая музыка'],
    ['radio_super', 'NRK Super', 'nrk_radio_super_mp3_h', 'для детей — простая речь'],
    ['p1pluss', 'NRK P1+', 'nrk_radio_p1pluss_mp3_h', 'хиты прошлых лет'],
    ['jazz', 'NRK Jazz', 'nrk_radio_jazz_mp3_h', 'джаз'],
    ['folkemusikk', 'NRK Folkemusikk', 'nrk_radio_folkemusikk_mp3_h', 'народная музыка'],
    ['sport', 'NRK Sport', 'nrk_radio_sport_mp3_h', 'спорт в прямом эфире'],
  ];
  // NRK podcasts by their public RSS (podkast.nrk.no). srv = the id on the server's fetch-public allow-list (the site)
  const PODS = [
    { id: 'supernytt', title: 'Supernytt', sub: 'новости простым языком — для детей и для учеников', srv: 'supernytt' },
    { id: 'kjapt_oppdatert', title: 'Kjapt oppdatert', sub: 'главные новости за несколько минут' },
    { id: 'abels_taarn', title: 'Abels tårn', sub: 'вопросы слушателей о науке' },
    { id: 'ukeslutt', title: 'Ukeslutt', sub: 'итоги недели' },
    { id: 'loerdagsraadet', title: 'Lørdagsrådet', sub: 'юмор и разговоры' },
    { id: 'radioresepsjonen', title: 'Radioresepsjonen', sub: 'юмор' },
  ];
  const feedUrl = id => `https://podkast.nrk.no/program/${encodeURIComponent(id)}.rss`;
  /** an episode file from NRK itself (podkast.nrk.no / *.nrk.no over https) — nothing else is played */
  const nrkFile = u => /^https:\/\/([a-z0-9-]+\.)*nrk\.no\//i.test(String(u || ''));
  const bridgeOk = () => !!(window.Subs && Subs.macBridge && Subs.macBridge());
  const onMacHere = () => (window.Net && Net.onMac ? Net.onMac() : /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:');
  const itunesDur = d => { const p = String(d || '').split(':').map(Number); if (p.some(isNaN)) return 0; return p.reduce((a, x) => a * 60 + x, 0); };
  const minTxt = s => (s ? (s >= 3600 ? `${Math.floor(s / 3600)} ч ${Math.round(s % 3600 / 60)} мин` : `${Math.max(1, Math.round(s / 60))} мин`) : '');
  /** RSS text → { title, img, eps: [{ id, title, date, dur, url, img, link }] } (only NRK's own audio files) */
  function parseFeed(xml, f) {
    const doc = new DOMParser().parseFromString(String(xml || ''), 'text/xml');
    if (!doc || doc.querySelector('parsererror')) return null;
    const ch = doc.querySelector('channel'); if (!ch) return null;
    const kid = (el, tag) => [...el.children].find(c => c.tagName === tag) || null;
    const txt = (el, tag) => { const c = kid(el, tag); return c ? String(c.textContent || '').trim() : ''; };
    const img = (el) => { const it = el.getElementsByTagName('itunes:image')[0]; const u = (it && it.getAttribute('href')) || (el.querySelector(':scope > image > url') || {}).textContent || ''; return /^https:\/\//.test(u) ? u.trim() : ''; };
    const chImg = img(ch);
    const eps = [...ch.getElementsByTagName('item')].map(it => {
      const enc = it.getElementsByTagName('enclosure')[0], url = enc ? enc.getAttribute('url') || '' : '';
      if (!nrkFile(url) || !/audio|mpeg|mp3/i.test((enc.getAttribute('type') || '') + url)) return null;
      const durEl = it.getElementsByTagName('itunes:duration')[0];
      return { id: txt(it, 'guid') || url, title: txt(it, 'title') || 'Выпуск', date: Date.parse(txt(it, 'pubDate')) || 0, dur: durEl ? itunesDur(durEl.textContent) : 0, url, img: img(it) || chImg };
    }).filter(Boolean);
    return { title: txt(ch, 'title') || f.title, img: chImg, eps };
  }

  const NrkRadio = {
    open() {
      // not on the Mac (the site, the store apps): what works without NRK's catalogue — never a dead tile
      if (!onMacHere()) return this.openPublic();
      const m = this._m = UI.modal({
        title: '📻 NRK Радио и подкасты — слушать с субтитрами и переводом', cls: 'wide nrk-modal nrkr-modal',
        body: `<div class="nrk-top">
            <div class="nrk-search"><input class="input" data-rq type="search" placeholder="Подкаст или программа: Abels tårn, Dagsnytt 18…" enterkeyhint="search"><button class="btn primary" data-ract="search">🔎 Найти</button></div>
            <a class="btn ghost nrk-out" href="${RADIO}" target="_blank" rel="noopener" title="Открыть NRK Radio в приложении или на сайте">↗ NRK Radio</a>
          </div>
          <div class="nrk-quick">${QUICK.map(q => `<button class="chip" data-rquick="${esc(q)}">${esc(q)}</button>`).join('')}</div>
          <div class="nrk-nav" data-rnav></div>
          <div data-rbody class="nrk-body"></div>`,
      });
      this._stack = []; this._last = ['front'];
      m.el.addEventListener('click', e => this.onClick(e));
      m.$('[data-rq]').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.value.trim()) { e.preventDefault(); this.go(['search', e.target.value.trim()]); } });
      this.front();
      return m;
    },
    body() { return this._m && this._m.$('[data-rbody]'); },
    alive() { return this._m && this._m.el.isConnected; },
    busy(msg) { const b = this.body(); if (b) b.innerHTML = `<div class="nrk-empty"><span class="spinner sm"></span> ${esc(msg)}</div>`; },
    fail(err) {
      const b = this.body(); if (!b) return;
      b.innerHTML = `<div class="mt-warn"><span>⚠️</span><span><b>${esc(NrkTV.friendly(err))}.</b>
        ${err.noBridge || err.oldBridge ? '' : '<button class="btn sm" data-ract="retry">🔄 Ещё раз</button>'} Слушать можно и на сайте или в приложении: <a href="${RADIO}" target="_blank" rel="noopener">↗ NRK Radio</a></span></div>`;
    },
    nav(html) { const n = this._m && this._m.$('[data-rnav]'); if (n) n.innerHTML = html; },
    back(label) { return `<button class="btn sm ghost" data-ract="back">← ${esc(label || 'Назад')}</button>`; },
    /** open a view and remember the way back */
    go(v, noStep) {
      if (!noStep) { this._stack.push(this._last); this._last = v; }
      const [k, a, b, c] = v;
      if (k === 'search') this.search(a);
      else if (k === 'page') this.page(a, b);
      else if (k === 'podcast') this.podcast(a, b, c);
      else if (k === 'series') this.series(a, b, c);
      else this.front();
    },

    /* ---------- tiles ---------- */
    tile(o) {
      // o: { kind: 'channel'|'podcast'|'series'|'pep'|'prog', id, pid, series, title, sub, img, date, dur, now, next, soon }
      const play = o.kind === 'channel' || o.kind === 'pep' || o.kind === 'prog';
      const tag = o.kind === 'channel' ? '● эфир' : o.kind === 'podcast' ? 'подкаст · выпуски' : o.kind === 'series' ? 'серия · выпуски' : o.dur || '';
      return `<div class="nrk-tile ${o.soon ? 'soon' : ''} ${o.kind === 'channel' ? 'nrk-ltile' : ''}">
          <button class="nrk-tile-main" data-r="${o.kind}" data-id="${esc(o.id)}" data-pid="${esc(o.pid || '')}" data-series="${esc(o.series || '')}" data-title="${esc(o.title)}" data-sub="${esc(o.kind === 'channel' && o.now ? o.now.title : o.sub || '')}" data-img="${esc(o.img || '')}"
            ${o.soon ? 'disabled aria-disabled="true"' : ''} title="${o.soon ? esc(o.soon) : play ? 'Слушать здесь — субтитры создаст приложение, с переводом' : 'Открыть выпуски'}">
            <span class="nrk-img nrkr-img">${o.img ? `<img src="${esc(o.img)}" alt="" loading="lazy">` : `<span class="nrk-noimg">${o.kind === 'channel' ? '📻' : '🎧'}</span>`}
              ${tag ? `<span class="${o.kind === 'channel' ? 'nrk-live-badge' : 'nrk-tag'}">${esc(tag)}</span>` : ''}
              ${o.soon ? `<span class="nrk-block"><span>⏳</span><b>Ещё не вышло</b><small>${esc(o.soon)}</small></span>` : ''}</span>
            <span class="nrk-t"><b>${esc(o.title)}</b>
              ${o.kind === 'channel' ? (o.now ? `<small>сейчас: ${esc(o.now.title)}${o.now.to ? ` · до ${NrkTV.hm(o.now.to)}` : ''}</small>` : '') + (o.next ? `<small class="muted">далее: ${esc(o.next.title)} · ${NrkTV.hm(o.next.from)}</small>` : '')
                : `${o.sub ? `<small>${esc(o.sub)}</small>` : ''}${o.date ? `<small class="muted">${esc(o.date)}</small>` : ''}`}</span>
          </button>
          <a class="nrk-ext" href="${esc(link(o))}" target="_blank" rel="noopener" title="Открыть в приложении или на сайте NRK Radio">↗</a>
        </div>`;
    },
    /** a plug of an NRK Radio page → a tile ('' for kinds the app does not show) */
    plugTile(p) {
      const L = p._links || {}, t = p.type;
      const ttl = x => (x && x.titles) || {};
      if (t === 'channel') return this.tile({ kind: 'channel', id: last(L.channel), title: ttl(p.channel).title || last(L.channel), img: pick((p.channel.image || {}).webImages || []) });
      if (t === 'podcast') return this.tile({ kind: 'podcast', id: last(L.podcast), title: ttl(p.podcast).title || last(L.podcast), sub: p.podcast.numberOfEpisodes ? `${p.podcast.numberOfEpisodes} ${U.plural(p.podcast.numberOfEpisodes, ['выпуск', 'выпуска', 'выпусков'])}` : '', img: p.podcast.imageUrl });
      if (t === 'podcastEpisode') {
        const e = p.podcastEpisode || {};
        return this.tile({ kind: 'pep', id: last(L.podcastEpisode), pid: last(L.podcast), title: ttl(e).title || '', sub: ttl(e.podcast).title || ttl(e).subtitle || '', img: e.imageUrl, dur: durTxt(e.duration) });
      }
      if (t === 'series') {
        const x = p.series || {}, slug = last(L.series), tt = ttl(x);
        return this.tile({ kind: 'series', id: slug, title: tt.title || slug.replace(/[-_]+/g, ' ').replace(/^./, c => c.toUpperCase()), sub: tt.title ? tt.subtitle : '', img: pick((x.image || {}).webImages || []) });
      }
      if (t === 'episode' || t === 'standaloneProgram') {
        const x = p.episode || p.program || {}, id = last(L.episode || L.program), tt = ttl(x);
        return this.tile({ kind: 'prog', id, series: L.series ? last(L.series) : '', title: tt.title || tt.subtitle || id, sub: tt.title ? tt.subtitle : '', img: pick((x.image || {}).webImages || []) });
      }
      return '';
    },
    sectionsHtml(page, max = 14) {
      return (page.sections || []).map(s => {
        const inc = s.included || {};
        const tiles = (inc.plugs || []).map(p => this.plugTile(p)).filter(Boolean).slice(0, max);
        if (!tiles.length) return '';
        const title = /^HERO/i.test(inc.title || '') ? '' : inc.title;
        return `<section class="nrk-sec">${title ? `<h3>${esc(title)}</h3>` : ''}<div class="nrk-grid">${tiles.join('')}</div></section>`;
      }).join('');
    },

    /* ---------- the front: categories, 📡 live channels, popular podcasts ---------- */
    async front() {
      this.nav('');
      this.busy('загружаю NRK Radio…');
      try {
        const [pages, pod] = await Promise.all([this._pages ? Promise.resolve(this._pages) : api('radio/pages').catch(() => null), api('radio/pages/podcast')]);
        if (!this.alive()) return;
        this._pages = pages;
        const cats = ((pages && pages.pages) || []).filter(p => p.id && p.title && p.id !== 'alt-innhold');
        this.body().innerHTML = `${cats.length ? `<div class="nrk-cats">${cats.map(p => `<button class="chip" data-rpage="${esc(p.id)}" data-title="${esc(p.title)}">${esc(p.title)}</button>`).join('')}</div>` : ''}
          <section class="nrk-sec nrk-live"><h3>📡 Прямой эфир</h3><div class="nrk-grid nrk-live-grid" data-rlive><div class="nrk-empty"><span class="spinner sm"></span> загружаю каналы…</div></div></section>
          <h3 class="nrkr-h">🎧 Подкасты NRK</h3>
          ${this.sectionsHtml(pod) || '<div class="nrk-empty muted">Подкасты не загрузились — попробуйте поиск.</div>'}
          <div class="tiny muted nrk-foot">NRK Radio — для прослушивания; в карточки попадают только отдельные слова и фразы со ссылкой на выпуск. Субтитров у радио и подкастов NRK нет — их создаёт приложение (🤖).</div>`;
        this.liveChannels();
      } catch (err) { this.fail(err); }
    },
    async liveChannels() {
      const grid = () => this._m && this._m.$('[data-rlive]');
      try {
        const [list, epg] = await Promise.all([api('radio/live'), api('epg/' + MAIN.join(',')).catch(() => null)]);
        const g = grid(); if (!g || !this.alive()) return;
        const nn = NrkTV.nowNext(epg);
        const chans = MAIN.map(id => (Array.isArray(list) ? list : []).find(c => c.id === id)).filter(Boolean);
        g.innerHTML = chans.map(c => {
          const pb = (c._embedded || {}).playback || {}, poster = ((pb.posters || [])[0] || {}).image || {};
          return this.tile(Object.assign({ kind: 'channel', id: c.id, title: pb.title || c.id, img: pick(poster.items || []) }, nn[c.id] || {}));
        }).join('') || '<div class="nrk-empty muted">Каналы сейчас недоступны.</div>';
      } catch (err) {
        const g = grid(); if (g) g.innerHTML = `<div class="mt-warn nrk-live-err"><span>📡</span><span>Каналы не загрузились: ${esc(NrkTV.friendly(err))}. <button class="btn sm" data-ract="live-retry">🔄 Ещё раз</button></span></div>`;
      }
    },

    /* ---------- a category page (Nyheter, Barn, Dokumentar, Podkast…) ---------- */
    async page(id, title) {
      this.nav(this.back('Главная'));
      this.busy(`загружаю «${title || id}»…`);
      try {
        const pg = await api('radio/pages/' + id);
        if (!this.alive()) return;
        this.body().innerHTML = `<h3 class="nrkr-h">${esc(pg.title || title || id)}</h3>${this.sectionsHtml(pg, 18) || '<div class="nrk-empty muted">Здесь пока пусто — попробуйте поиск.</div>'}`;
      } catch (err) { this.fail(err); }
    },

    /* ---------- search: podcasts / series first, then single episodes ---------- */
    async search(q) {
      q = String(q || '').trim(); if (!q) return;
      const inp = this._m.$('[data-rq]'); if (inp && inp.value !== q) inp.value = q;
      this.nav(this.back('Главная'));
      this.busy(`ищу «${q}»…`);
      try {
        const r = await api('radio/search/search', { q });
        if (!this.alive()) return;
        const R = r.results || {};
        const ser = ((R.series || {}).results || []).map(h => {
          const img = pick(h.images_1_1 || h.images || []);
          if (h.type === 'podcast') return this.tile({ kind: 'podcast', id: h.seriesId, title: h.title, sub: h.description, img });
          if (h.type === 'customSeason') return this.tile({ kind: 'podcast', id: h.seriesId, season: h.seasonId, title: h.title, sub: h.description, img }).replace('data-r="podcast"', `data-r="podcast" data-season="${esc(h.seasonId)}"`);
          return this.tile({ kind: 'series', id: h.seriesId, title: h.title, sub: h.description, img });
        });
        const eps = ((R.episodes || {}).results || []).map(h => this.tile({
          kind: h.type === 'podcastEpisode' ? 'pep' : 'prog', id: h.episodeId, pid: h.seriesId, series: h.seriesId, title: h.title, sub: h.seriesTitle, img: pick(h.images_1_1 || h.images || []), date: dateTxt(h.date),
        }));
        this.body().innerHTML = ser.length || eps.length
          ? `${ser.length ? `<section class="nrk-sec"><h3>Подкасты и программы</h3><div class="nrk-grid">${ser.join('')}</div></section>` : ''}
             ${eps.length ? `<section class="nrk-sec"><h3>Выпуски</h3><div class="nrk-grid">${eps.join('')}</div></section>` : ''}`
          : `<div class="nrk-empty muted">По запросу «${esc(q)}» ничего не нашлось.</div>`;
      } catch (err) { this.fail(err); }
    },

    /* ---------- a podcast (or one of its seasons): the newest episodes first ---------- */
    async podcast(id, title, opts) {
      opts = opts || {};
      this.nav(this.back('Назад'));
      this.busy(`загружаю «${title || id}»…`);
      try {
        const d = await api(opts.season ? `radio/catalog/podcast/${id}/seasons/${opts.season}` : `radio/catalog/podcast/${id}/episodes`, { pageSize: 50, page: opts.page || 1 });
        if (!this.alive()) return;
        const eps = findEps(d);
        this.listHtml({ kind: 'podcast', id, title: title || id, img: opts.img, eps, more: !opts.season && eps.length >= 50 ? (opts.page || 1) + 1 : 0, page: opts.page || 1, season: opts.season });
      } catch (err) { this.fail(err); }
    },
    /* ---------- a radio series: its episodes (by season / month) ---------- */
    async series(slug, title, opts) {
      opts = opts || {};
      this.nav(this.back('Назад'));
      this.busy(`загружаю «${title || slug}»…`);
      try {
        const d = await api('radio/catalog/series/' + slug);
        if (!this.alive()) return;
        const seasons = ((d._links || {}).seasons || []).map(s => ({ id: s.name || last(s.href), title: s.title || s.name })).filter(s => s.id);
        let eps = findEps(d);
        if (!eps.length && seasons.length) eps = findEps(await api(`radio/catalog/series/${slug}/seasons/${seasons[0].id}`));
        const info = (d.series || {}).titles || {};
        this.listHtml({ kind: 'series', id: slug, title: info.title || title || slug, sub: info.subtitle, img: opts.img || pick(((d.series || {}).image || {}).webImages || []), eps, seasons });
      } catch (err) { this.fail(err); }
    },
    epTile(ep, o) {
      const av = ep.availability || {};
      const soon = av.status && av.status !== 'available' ? (av.label || 'пока недоступно') : '';
      const share = ((ep._links || {}).share || {}).href || '';
      return this.tile({
        kind: o.kind === 'podcast' ? 'pep' : 'prog', id: ep.episodeId, pid: o.id, series: o.kind === 'series' ? o.id : '',
        title: (ep.titles || {}).title || ep.episodeId, sub: (ep.titles || {}).subtitle || '', img: pick((ep.image || ep.squareImage || [])) || o.img,
        date: [dateTxt(ep.date), durTxt(ep.duration)].filter(Boolean).join(' · '), soon,
      }).replace(/href="[^"]*" target="_blank" rel="noopener" title="Открыть в приложении/, m => share && /^https:\/\/radio\.nrk\.no\//.test(share) ? `href="${esc(share)}" target="_blank" rel="noopener" title="Открыть в приложении` : m);
    },
    listHtml(o) {
      const ok = o.eps.filter(ep => !((ep.availability || {}).status && ep.availability.status !== 'available'));
      const start = ok[0];
      const pic = o.img ? `<img src="${esc(o.img)}" alt="">` : '<span class="nrk-noimg">🎧</span>';
      const sTitle = start ? ((start.titles || {}).title || start.episodeId) : '';
      this.body().innerHTML = `<div class="nrk-series-head nrkr-head">${start
          ? `<button class="nrk-head-play" data-r="${o.kind === 'podcast' ? 'pep' : 'prog'}" data-id="${esc(start.episodeId)}" data-pid="${esc(o.id)}" data-series="${o.kind === 'series' ? esc(o.id) : ''}" data-title="${esc(sTitle)}" data-sub="${esc(o.title)}" data-img="${esc(o.img || '')}" title="Слушать здесь — с субтитрами и переводом">${pic}<span class="nrk-head-btn">▶ Слушать: ${esc(sTitle)}</span></button>`
          : pic}
          <div><h3>${esc(o.title)}</h3>${o.sub ? `<div class="small muted">${esc(o.sub)}</div>` : ''}
          <a class="btn sm ghost" href="${esc(link({ kind: o.kind, id: o.id }))}" target="_blank" rel="noopener">↗ NRK Radio</a></div></div>
        ${o.seasons && o.seasons.length > 1 ? `<label class="field nrk-season"><span>Сезон / месяц</span><select class="input" data-rseason>${o.seasons.map((s, i) => `<option value="${esc(s.id)}" ${i === 0 ? 'selected' : ''}>${esc(s.title || s.id)}</option>`).join('')}</select></label>` : ''}
        <div class="nrk-grid" data-reps>${o.eps.length ? o.eps.slice(0, 60).map(ep => this.epTile(ep, o)).join('') : '<div class="nrk-empty muted">Выпусков нет — откройте его на сайте NRK Radio.</div>'}</div>
        ${o.more ? `<div class="nrkr-more"><button class="btn" data-ract="more" data-page="${o.more}">Показать ещё выпуски</button></div>` : ''}`;
      this._list = o;
      const sel = this.body().querySelector('[data-rseason]');
      if (sel) sel.onchange = async () => {
        const box = this.body().querySelector('[data-reps]');
        box.innerHTML = '<div class="nrk-empty"><span class="spinner sm"></span></div>';
        try { const eps = findEps(await api(`radio/catalog/series/${o.id}/seasons/${sel.value}`)); box.innerHTML = eps.length ? eps.slice(0, 60).map(ep => this.epTile(ep, o)).join('') : '<div class="nrk-empty muted">Выпусков нет.</div>'; }
        catch (err) { box.innerHTML = `<div class="mt-warn"><span>⚠️</span><span>${esc(NrkTV.friendly(err))}</span></div>`; }
      };
    },
    async more(btn) {
      const o = this._list; if (!o) return;
      btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> загружаю…';
      try {
        const d = await api(`radio/catalog/podcast/${o.id}/episodes`, { pageSize: 50, page: +btn.dataset.page });
        const eps = findEps(d);
        const box = this.body().querySelector('[data-reps]');
        if (box) box.insertAdjacentHTML('beforeend', eps.map(ep => this.epTile(ep, o)).join(''));
        if (eps.length >= 50) { btn.dataset.page = +btn.dataset.page + 1; btn.disabled = false; btn.textContent = 'Показать ещё выпуски'; }
        else btn.parentNode.remove();
      } catch (err) { btn.disabled = false; btn.textContent = 'Не загрузилось — ещё раз'; }
    },

    /* ---------- play: a live channel, a podcast episode, a radio program → the subtitle player (sound only) ---------- */
    async play(o) {
      if (o && o.kind === 'pubpod') {
        // W6: an episode of NRK's public feed — NRK's own file, no catalogue needed
        if (!nrkFile(o.mp3)) return;
        Subs.openStream({
          kind: 'nrk', radio: true, audio: true, live: false, id: o.id, title: o.title || 'Выпуск', channel: o.sub || 'NRK Radio',
          link: o.link || RADIO, at: () => o.link || RADIO, hls: '', mp3: o.mp3, duration: o.dur || 0, cues: [], autoAsr: true, poster: o.img || '',
          subName: 'субтитры, созданные приложением (распознавание речи)', note: NOTE(false),
        });
        return;
      }
      if (!bridgeOk() && !onMacHere()) {
        // a programme / channel remembered from the Mac: here it opens in NRK Radio
        const url = link(o);
        if (UI.toastAction) UI.toastAction('Эта программа откроется в NRK Radio', 'Открыть', () => window.open(url, '_blank', 'noopener'), 8000);
        else window.open(url, '_blank', 'noopener');
        return;
      }
      const kind = o.kind === 'channel' ? 'channel' : o.kind === 'pep' ? 'podcast' : 'program';
      const url = link(o);
      const busy = UI.busy ? UI.busy(kind === 'channel' ? 'Открываю прямой эфир…' : 'Открываю выпуск…') : null;
      const asset = man => {
        const pl = man.playable || {}, av = man.availability || {};
        if (man.playability !== 'playable' || !(pl.assets || []).length) {
          const np = man.nonPlayable || {};
          throw Object.assign(new Error(np.endUserMessage || (av.isGeoBlocked ? 'это доступно только в Норвегии' : 'это сейчас нельзя послушать')), { lock: av.isGeoBlocked ? '🌍' : '⛔' });
        }
        const a = pl.assets.find(x => !x.encrypted && /hls|mp3/i.test((x.format || '') + ' ' + (x.mimeType || '')));
        if (!a) throw Object.assign(new Error('NRK защищает эту запись — слушайте её в приложении NRK Radio'), { lock: '🔒' });
        return { url: a.url, mp3: /mp3|audio\/mpeg/i.test((a.format || '') + ' ' + (a.mimeType || '')), dur: secs(pl.duration) };
      };
      try {
        const man = await api(`playback/manifest/${kind}/${o.id}`);
        const a = asset(man);
        if (busy) busy.close();
        const live = kind === 'channel';
        Subs.openStream({
          kind: 'nrk', radio: true, audio: true, live, id: o.id, title: o.title || o.id,
          channel: live ? (o.sub ? 'сейчас: ' + o.sub : 'NRK Radio · прямой эфир') : (o.sub || 'NRK Radio'),
          link: url, at: () => url, hls: a.mp3 ? '' : a.url, mp3: a.mp3 ? a.url : '', duration: a.dur, cues: [], autoAsr: true, poster: o.img || '',
          // after a long pause the stream address may have expired → the player asks NRK for a fresh one
          fresh: a.mp3 ? null : async () => { try { const b = asset(await api(`playback/manifest/${kind}/${o.id}`)); return b.mp3 ? '' : b.url; } catch (e) { return ''; } },
          subName: 'субтитры, созданные приложением (распознавание речи)', note: NOTE(live),
        });
      } catch (err) {
        if (busy) busy.close();
        const msg = err.lock ? err.message : NrkTV.friendly(err);
        UI.toastAction ? UI.toastAction(`${err.lock || '⚠️'} ${msg}`, '↗ Открыть в NRK', () => window.open(url, '_blank', 'noopener'), 9000, err.lock || '⚠️') : UI.toast(msg, 'warn');
      }
    },

    /* ================= W6: without the Mac bridge ================= */
    openPublic() {
      this.stopLive();
      const m = this._m = UI.modal({
        title: `${IC('radio', 24)} NRK Радио и подкасты`, cls: 'wide nrk-modal nrkr-modal nrkp-modal',
        body: `<section class="nrk-sec nrkp-live-sec">
            <h3 class="nrkp-h">${IC('live', 20)} Прямой эфир NRK</h3>
            <p class="small muted nrkp-lead">Официальные потоки NRK играют прямо здесь. Субтитров у прямого эфира здесь нет — с субтитрами и переводом слушайте подкасты ниже.</p>
            <div class="nrkp-bar" data-pbar hidden></div>
            <div class="nrkp-live" role="list">${LIVE.map(([id, name, , sub]) => `<div class="nrkp-ch" role="listitem">
                <button type="button" class="nrkp-chb" data-plive="${id}" aria-pressed="false" title="Слушать ${U.esc(name)} — прямой эфир">
                  <span class="nrkp-ci" aria-hidden="true">${IC('play', 20)}</span><span class="nrkp-ct"><b>${U.esc(name)}</b><small>${U.esc(sub)}</small></span></button>
                <a class="nrkp-out" href="${RADIO}/direkte/${encodeURIComponent(id)}" target="_blank" rel="noopener" title="Открыть ${U.esc(name)} в приложении или на сайте NRK Radio" aria-label="Открыть ${U.esc(name)} в NRK Radio">${IC('external', 18)}</a>
              </div>`).join('')}</div>
          </section>
          <h3 class="nrkr-h nrkp-h">${IC('podcast', 20)} Подкасты NRK — с субтитрами и переводом</h3>
          <div data-pods class="nrkp-pods"><div class="nrk-empty"><span class="spinner sm"></span> загружаю подкасты…</div></div>
          <div class="tiny muted nrk-foot">Звук идёт с серверов NRK. Все программы и подкасты NRK — в приложении или на сайте <a href="${RADIO}" target="_blank" rel="noopener">NRK Radio</a>.</div>`,
        onClose: () => { this.stopLive(); },
      });
      m.el.addEventListener('click', e => this.onPublicClick(e));
      this.pods();
      return m;
    },
    /* ---- live: one <audio>, the lock screen knows what plays ---- */
    liveAudio() {
      if (this._a) return this._a;
      const a = this._a = new Audio();
      a.preload = 'none';
      const sync = () => this.liveBar();
      ['play', 'playing', 'pause', 'waiting', 'stalled'].forEach(ev => a.addEventListener(ev, sync));
      a.addEventListener('error', () => {
        const c = this._live; if (!c || !a.getAttribute('src')) return;
        this.liveBar('err');
        const url = `${RADIO}/direkte/${encodeURIComponent(c[0])}`;
        if (UI.toastAction) UI.toastAction(`${c[1]} сейчас не играет здесь`, 'Открыть в NRK Radio', () => window.open(url, '_blank', 'noopener'), 8000);
        else UI.toast(`${c[1]} сейчас не играет здесь — откройте его в NRK Radio`, 'warn', 6000);
      });
      return a;
    },
    playLive(id) {
      const c = LIVE.find(x => x[0] === id); if (!c) return;
      const a = this.liveAudio();
      if (this._live && this._live[0] === id && a.getAttribute('src')) { if (a.paused) { const p = a.play(); if (p && p.catch) p.catch(() => {}); } else a.pause(); return; }
      if (window.TTS && TTS.stop) { try { TTS.stop(); } catch (e) { /* nothing spoken */ } }
      if (window.Listen && Listen.p && Listen.stop) { try { Listen.stop(); } catch (e) { /* not playing */ } }
      this._live = c;
      a.src = LYD + c[2];
      const p = a.play(); if (p && p.catch) p.catch(() => {});
      this.liveSession(c);
      this.liveBar();
    },
    liveSession(c) {
      if (!('mediaSession' in navigator) || typeof window.MediaMetadata !== 'function') return;
      const ms = navigator.mediaSession, a = this._a;
      try { ms.metadata = new MediaMetadata({ title: c[1], artist: 'Прямой эфир · NRK Radio', album: 'Norsk Kort' }); } catch (e) { /* old browser */ }
      const h = (k, f) => { try { ms.setActionHandler(k, f); } catch (e) { /* not here */ } };
      const nb = d => { const i = LIVE.findIndex(x => x[0] === (this._live || [])[0]); this.playLive(LIVE[(i + d + LIVE.length) % LIVE.length][0]); };
      h('play', () => { const p = a.play(); if (p && p.catch) p.catch(() => {}); });
      h('pause', () => a.pause());
      h('stop', () => this.stopLive());
      h('previoustrack', () => nb(-1));
      h('nexttrack', () => nb(1));
      h('seekbackward', null); h('seekforward', null);
      this._ms = true;
    },
    stopLive() {
      const a = this._a;
      if (a) { a.pause(); a.removeAttribute('src'); try { a.load(); } catch (e) { /* ignore */ } }
      this._live = null;
      if (this._ms && 'mediaSession' in navigator) {
        this._ms = false;
        const ms = navigator.mediaSession;
        try { ms.metadata = null; ms.playbackState = 'none'; } catch (e) { /* ignore */ }
        ['play', 'pause', 'stop', 'previoustrack', 'nexttrack'].forEach(k => { try { ms.setActionHandler(k, null); } catch (e) { /* ignore */ } });
      }
      this.liveBar();
    },
    liveBar(state) {
      const m = this._m; if (!m || !m.el.isConnected) return;
      const a = this._a, c = this._live, bar = m.$('[data-pbar]');
      const on = !!(c && a && a.getAttribute('src')), playing = on && !a.paused;
      const wait = on && !a.paused && a.readyState < 3;
      if (bar) {
        bar.hidden = !on;
        if (on) bar.innerHTML = `<span class="nrkp-eq${playing && !wait ? ' on' : ''}" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="nrkp-now"><b>${U.esc(c[1])}</b><small>${state === 'err' ? 'не играет — попробуйте позже' : wait ? 'подключаюсь…' : playing ? 'в прямом эфире' : 'на паузе'}</small></span>
          <button type="button" class="btn sm primary nrkp-pp" data-plive="${c[0]}">${playing ? IC('pause', 18) + ' Пауза' : IC('play', 18) + ' Слушать'}</button>
          ${typeof a.webkitShowPlaybackTargetPicker === 'function' ? `<button type="button" class="btn sm ghost nrkp-air" data-pair title="AirPlay — на Apple TV или колонку">${IC('airplay', 18)} AirPlay</button>` : ''}
          <button type="button" class="btn sm ghost nrkp-stop" data-pstop title="Выключить радио" aria-label="Выключить радио">${IC('stop', 18)}</button>`;
      }
      if ('mediaSession' in navigator && this._ms) { try { navigator.mediaSession.playbackState = playing ? 'playing' : on ? 'paused' : 'none'; } catch (e) { /* ignore */ } }
      m.$$('[data-plive]').forEach(b => {
        if (b.closest('[data-pbar]')) return;
        const me = on && c[0] === b.dataset.plive;
        b.classList.toggle('on', me); b.setAttribute('aria-pressed', me && playing ? 'true' : 'false');
        const ic = b.querySelector('.nrkp-ci'); if (ic) ic.innerHTML = IC(me && playing ? 'pause' : 'play', 20);
      });
    },
    /* ---- podcasts: NRK's public RSS (the server's allow-list on the site, every feed in the store apps) ---- */
    async feed(f) {
      if (this._feeds && this._feeds[f.id]) return this._feeds[f.id];
      if (!window.Net || !Net.get) return null;
      const xml = await Net.get(feedUrl(f.id), { kind: 'rss', id: f.srv || undefined, as: 'text' });
      const r = parseFeed(xml, f);
      if (!r || !r.eps.length) return null;
      (this._feeds = this._feeds || {})[f.id] = r;
      return r;
    },
    async pods() {
      const box = () => this._m && this._m.el.isConnected && this._m.$('[data-pods]');
      // the site reaches only the feeds on the server's list; the store apps fetch any feed natively
      const native = !!(window.Net && Net.isNative && Net.isNative());
      const server = !!(window.NKConfig && NKConfig.ready());
      const list = PODS.filter(f => native || (server && f.srv));
      const got = await Promise.all(list.map(f => this.feed(f).then(r => (r ? { f, r } : null)).catch(() => null)));
      const ok = got.filter(Boolean);
      const b = box(); if (!b) return;
      if (!ok.length) {
        b.innerHTML = `<div class="nkm-card"><span class="nkm-ico">${IC('podcast', 34)}</span><div class="nkm-txt"><b>Подкасты NRK слушайте в NRK Radio</b>
            <p>Здесь подкасты сейчас не загрузились. В NRK Radio — все выпуски; а чтобы учить слова с субтитрами и переводом, откройте свой аудиофайл в разделе «Своё видео».</p>
            <div class="nkm-acts"><a class="btn primary" href="${RADIO}/podkast" target="_blank" rel="noopener">${IC('external')} Подкасты в NRK Radio</a>
            ${window.Subs ? `<button type="button" class="btn" data-pown>${IC('file')} Свой файл</button>` : ''}</div></div></div>`;
        return;
      }
      b.innerHTML = `<div class="nrk-grid">${ok.map(({ f, r }) => `<div class="nrk-tile">
          <button class="nrk-tile-main" data-ppod="${U.esc(f.id)}" title="Выпуски «${U.esc(r.title)}»">
            <span class="nrk-img nrkr-img">${r.img ? `<img src="${U.esc(r.img)}" alt="" loading="lazy">` : `<span class="nrk-noimg">${IC('podcast', 34)}</span>`}<span class="nrk-tag">подкаст · ${r.eps.length} ${U.plural(r.eps.length, ['выпуск', 'выпуска', 'выпусков'])}</span></span>
            <span class="nrk-t"><b>${U.esc(r.title)}</b><small>${U.esc(f.sub)}</small></span></button>
          <a class="nrk-ext" href="${RADIO}/podkast/${encodeURIComponent(f.id)}" target="_blank" rel="noopener" title="Открыть в приложении или на сайте NRK Radio" aria-label="Открыть в NRK Radio">${IC('external', 18)}</a>
        </div>`).join('')}</div>
        ${ok.length < PODS.length ? `<div class="small muted nrkp-more">Ещё подкасты NRK — <a href="${RADIO}/podkast" target="_blank" rel="noopener">в NRK Radio</a>.</div>` : ''}`;
    },
    podEps(id) {
      const f = PODS.find(x => x.id === id), r = f && this._feeds && this._feeds[id], b = this._m && this._m.$('[data-pods]');
      if (!f || !r || !b) return;
      b.innerHTML = `<div class="nrk-nav"><button class="btn sm ghost" data-pback>${IC('back')} Все подкасты</button></div>
        <div class="nrk-series-head nrkr-head">${r.img ? `<img src="${U.esc(r.img)}" alt="">` : `<span class="nrk-noimg">${IC('podcast', 34)}</span>`}
          <div><h3>${U.esc(r.title)}</h3><div class="small muted">${U.esc(f.sub)}</div>
          <a class="btn sm ghost" href="${RADIO}/podkast/${encodeURIComponent(id)}" target="_blank" rel="noopener">${IC('external')} NRK Radio</a></div></div>
        <div class="nrk-grid">${r.eps.slice(0, 40).map((ep, i) => `<div class="nrk-tile">
            <button class="nrk-tile-main" data-pep="${i}" data-pid="${U.esc(id)}" title="Слушать здесь — субтитры создаст приложение, с переводом">
              <span class="nrk-img nrkr-img">${ep.img ? `<img src="${U.esc(ep.img)}" alt="" loading="lazy">` : `<span class="nrk-noimg">${IC('podcast', 34)}</span>`}${ep.dur ? `<span class="nrk-tag">${minTxt(ep.dur)}</span>` : ''}<span class="nrk-tile-pl" aria-hidden="true">${IC('play', 22)}</span></span>
              <span class="nrk-t"><b>${U.esc(ep.title)}</b>${ep.date ? `<small class="muted">${U.esc(new Date(ep.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }))}</small>` : ''}</span></button>
          </div>`).join('')}</div>`;
      b.scrollIntoView({ block: 'start', behavior: 'smooth' });
    },
    /** a podcast episode from NRK's public feed → the subtitle player (sound only; the app makes the subtitles) */
    playPod(id, i) {
      const f = PODS.find(x => x.id === id), r = f && this._feeds && this._feeds[id], ep = r && r.eps[i];
      if (!ep || !nrkFile(ep.url)) return;
      this.stopLive();
      this.play({ kind: 'pubpod', id: 'pod:' + id + ':' + String(ep.id).replace(/[^\w-]+/g, '').slice(-40), title: ep.title, sub: r.title, img: ep.img, mp3: ep.url, dur: ep.dur, link: `${RADIO}/podkast/${encodeURIComponent(id)}` });
    },
    onPublicClick(e) {
      const t = e.target;
      const lv = t.closest('[data-plive]'); if (lv) { this.playLive(lv.dataset.plive); return; }
      if (t.closest('[data-pstop]')) { this.stopLive(); return; }
      if (t.closest('[data-pair]')) { try { this._a.webkitShowPlaybackTargetPicker(); } catch (err) { UI.toast('AirPlay сейчас недоступен — выберите колонку в Пункте управления', 'warn', 5000); } return; }
      const pd = t.closest('[data-ppod]'); if (pd) { this.podEps(pd.dataset.ppod); return; }
      const ep = t.closest('[data-pep]'); if (ep) { this.playPod(ep.dataset.pid, +ep.dataset.pep); return; }
      if (t.closest('[data-pback]')) { this.pods(); return; }
      if (t.closest('[data-pown]')) { if (this._m) this._m.close(); Subs.open(); }
    },

    onClick(e) {
      const t = e.target;
      const q = t.closest('[data-rquick]'); if (q) { this.go(['search', q.dataset.rquick]); return; }
      const pg = t.closest('[data-rpage]'); if (pg) { this.go(['page', pg.dataset.rpage, pg.dataset.title]); return; }
      const r = t.closest('[data-r]');
      if (r && !r.disabled) {
        const o = { kind: r.dataset.r, id: r.dataset.id, pid: r.dataset.pid, series: r.dataset.series, title: r.dataset.title, sub: r.dataset.sub, img: r.dataset.img };
        if (o.kind === 'podcast') this.go(['podcast', o.id, o.title, { img: o.img, season: r.dataset.season || '' }]);
        else if (o.kind === 'series') this.go(['series', o.id, o.title, { img: o.img }]);
        else this.play(o);
        return;
      }
      const a = t.closest('[data-ract]'); if (!a) return;
      const act = a.dataset.ract;
      if (act === 'search') { const v = this._m.$('[data-rq]').value.trim(); if (v) this.go(['search', v]); }
      else if (act === 'more') this.more(a);
      else if (act === 'live-retry') { const g = this._m.$('[data-rlive]'); if (g) g.innerHTML = '<div class="nrk-empty"><span class="spinner sm"></span> загружаю каналы…</div>'; this.liveChannels(); }
      else if (act === 'retry') this.go(this._last, true);
      else if (act === 'back') { this._last = this._stack.pop() || ['front']; this.go(this._last, true); }
    },
  };

  window.NrkRadio = NrkRadio;
})();
