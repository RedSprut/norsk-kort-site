/* ============ 🔎 «Лента фото» — a Pinterest-like photo feed inside the app ============
 * Loaded on first use by Views.gallery(opts) (js/views.js) together with css/gallery.css — index.html is not touched.
 * «Всё под рукой»: press a button, get beautiful photos right here, no other website.
 *
 * Sources — free, legal, no key needed:
 *  - Openverse (api.openverse.org): the main feed — Creative Commons and public-domain photos from Flickr, Wikimedia
 *    and museums. Anonymous use: 20 results a page, 20 requests a minute, 200 a day → every page is kept in memory,
 *    and a «429 — too many» gives the feed a calm minute of rest (Wikimedia carries on meanwhile).
 *  - Wikimedia Commons (through Photos.commons, js/photos.js): merged into the feed, and the fallback.
 *  - Optional: the person's own free Unsplash / Pexels keys (⚙ in the feed, or Settings → 🖼 Картинки). Kept only on
 *    this device (localStorage, not Store.settings) — never in an export, a backup or the cloud.
 * Every picture keeps its author, licence and source page (the card shows them). Unsplash pictures stay hot-linked
 * and their download is reported, as Unsplash's API rules ask; Pexels photos credit the photographer and Pexels.
 * Pinterest has no public search API (and scraping it is not allowed): its paste-back flow stays as the 📌 tab.
 *
 * Gallery.open({ word, hint, en, query, title, applyLabel, max, onPick({ image, src, credit, page }), onPinterest, onOther, otherLabel })
 * Gallery.keys() — the small «own keys» window (Settings → 🖼 Картинки).
 */
(function () {
  'use strict';
  const enc = encodeURIComponent;
  const esc = s => (window.U && U.esc ? U.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
  const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------------- Norwegian themes along the top ---------------- */
  // [label shown, what is searched] — English / place names find far more free photos than Norwegian words
  // the first one, «Norge», is on when the gallery opens: the card's word is searched together with Norway
  const BASE_CHIPS = [
    ['🇳🇴 Norge', 'norway'], ['🏔 fjorder', 'norway fjord'], ['🏡 hytte', 'norwegian cabin'], ['🌌 nordlys', 'aurora borealis norway'], ['🎣 Lofoten', 'lofoten'],
    ['🥾 fjell og tur', 'norway mountain hiking'], ['🌈 Bergen Bryggen', 'bryggen bergen'], ['⛪ stavkirke', 'stave church'],
    ['🧌 troll', 'troll norway'], ['⚔️ vikinger', 'viking ship'], ['🍽 norsk mat', 'norwegian food'], ['🧇 vafler', 'waffles'],
    ['🧀 brunost', 'brunost'], ['☕ kaffe', 'coffee cup'], ['⛷ vinter og ski', 'norway ski winter'], ['🇳🇴 17. mai og bunad', 'bunad'],
    ['🫎 elg', 'moose'], ['🕯 koselig', 'cozy candles'], ['⛵ sjø og båt', 'norway boat sea'], ['🏙 Oslo', 'oslo'],
  ];
  // 🎨 the card template chosen in «Оформление карточек» (js/artcards.js, artcards-no.js) → its photos come first
  const THEME_Q = {
    viking: ['⚔️ vikinger', 'viking ship'], troll: ['🧌 troll', 'troll norway'], stavkirke: ['⛪ stavkirke', 'stave church'], lofoten: ['🎣 Lofoten', 'lofoten'],
    skog: ['🍄 skog og sopp', 'norwegian forest mushrooms'], fjellhytte: ['🏡 hytte', 'norwegian cabin snow'], elg: ['🫎 elg', 'moose'],
    midnattsol: ['🌞 midnattssol', 'midnight sun norway'], polarnatt: ['🌌 mørketid', 'polar night aurora'], frokost: ['🧇 frokost', 'norwegian breakfast'],
    kongelig: ['👑 kongelig', 'royal palace oslo'], gammel: ['📷 gamle Norge', 'old norway photograph'], aurora: ['🌌 nordlys', 'aurora borealis norway'],
    rosemaling: ['🌷 rosemaling', 'rosemaling'], hytte: ['🕯 koselig', 'cozy candles'], jul: ['🎄 jul', 'norwegian christmas'], halloween: ['🎃 halloween', 'halloween pumpkin'],
    paske: ['🐣 påske', 'easter norway'], sankthans: ['🔥 sankthans', 'midsummer bonfire'], vinter: ['❄️ vinter', 'norway winter snow'], host: ['🍂 høst', 'norway autumn'],
  };

  /* ---------------- own keys + preferences: this device only ---------------- */
  const LS_KEYS = 'nk-gallery-keys', LS_PREFS = 'nk-gallery-prefs';
  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode: for this visit only */ } };
  const keys = () => { const k = lsGet(LS_KEYS); return { unsplash: String(k.unsplash || '').trim(), pexels: String(k.pexels || '').trim() }; };
  // mix (the card's word + the theme) is on unless the person switched it off
  const prefs = () => Object.assign({ open: false, mix: true }, lsGet(LS_PREFS));

  /* ---------------- licences ---------------- */
  const LIC = { by: 'CC BY', 'by-sa': 'CC BY-SA', 'by-nc': 'CC BY-NC', 'by-nd': 'CC BY-ND', 'by-nc-sa': 'CC BY-NC-SA', 'by-nc-nd': 'CC BY-NC-ND', cc0: 'CC0', pdm: 'Public Domain' };
  const licName = (l, v) => { const n = LIC[String(l || '').toLowerCase()] || String(l || '').toUpperCase(); return n && v && /^CC BY/.test(n) ? `${n} ${v}` : n; };
  const https = u => (/^https:\/\//i.test(u || '') ? u : '');

  /* ---------------- fetching: a timeout, calm errors, a memory cache ---------------- */
  const cache = new Map(); // `${source}|${query}|${page}|${licence}` → { items, more } — recent searches open at once
  const remember = (k, v) => { cache.set(k, v); if (cache.size > 80) cache.delete(cache.keys().next().value); return v; };
  let ovRestUntil = 0; // Openverse said «too many» → it rests until then
  async function getJSON(url, headers) {
    const ctl = window.AbortController ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), 15000) : 0;
    try {
      const r = await fetch(url, { headers: headers || {}, signal: ctl ? ctl.signal : undefined, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      return await r.json();
    } finally { clearTimeout(t); }
  }

  /* each source: (query, page) → { items, more }; every item: { id, src, thumb, full, w, h, title, author, authorUrl, license, licenseUrl, page, via } */
  const SOURCES = {
    async openverse(q, page, o) {
      if (Date.now() < ovRestUntil) { const e = new Error('rest'); e.status = 429; throw e; }
      const lic = o.strict ? '&license_type=commercial,modification' : '';
      let j;
      try { j = await getJSON(`https://api.openverse.org/v1/images/?q=${enc(q)}&page=${page}&page_size=20&mature=false${lic}`); }
      catch (e) { if (e.status === 429) ovRestUntil = Date.now() + 65000; throw e; }
      const items = (j.results || []).map(x => ({
        id: 'ov:' + x.id, src: 'openverse', thumb: x.thumbnail || x.url, full: x.url, w: +x.width || 0, h: +x.height || 0,
        title: x.title || '', author: x.creator || '', authorUrl: https(x.creator_url), license: licName(x.license, x.license_version),
        licenseUrl: https(x.license_url), page: https(x.foreign_landing_url) || https(x.detail_url), via: x.source || x.provider || '',
      })).filter(x => x.thumb && x.full && !/\.svg(\?|$)/i.test(x.full) && !(x.w && x.w < 320) && !(x.h && x.h < 220));
      return { items, more: page < Math.min(12, j.page_count || 0) }; // anonymous: 240 results a search at most
    },
    async commons(q, page) {
      if (!(window.Photos && Photos.commons)) return { items: [], more: false };
      const r = await Photos.commons(q, (page - 1) * 36);
      const items = r.items.filter(x => !(x.w && x.w < 320)).map(x => ({
        id: 'wm:' + x.page, src: 'commons', thumb: x.thumb, full: x.full, w: x.w || 0, h: x.h || 0, title: x.title || '',
        author: x.author || 'Wikimedia Commons', authorUrl: '', license: x.license || '', licenseUrl: https(x.licenseUrl), page: https(x.page), via: 'Wikimedia Commons',
      }));
      return { items, more: r.next != null && page < 8 };
    },
    async unsplash(q, page, o) {
      const j = await getJSON(`https://api.unsplash.com/search/photos?query=${enc(q)}&page=${page}&per_page=20&content_filter=high`, { Authorization: 'Client-ID ' + o.key, 'Accept-Version': 'v1' });
      const utm = 'utm_source=norsk_kort&utm_medium=referral';
      const items = (j.results || []).map(x => ({
        id: 'us:' + x.id, src: 'unsplash', thumb: (x.urls || {}).small, full: (x.urls || {}).regular, w: +x.width || 0, h: +x.height || 0,
        title: x.alt_description || x.description || '', author: (x.user || {}).name || 'Unsplash',
        authorUrl: https(((x.user || {}).links || {}).html) ? ((x.user || {}).links || {}).html + '?' + utm : '',
        license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', page: https((x.links || {}).html) ? x.links.html + '?' + utm : '',
        via: 'Unsplash', raw: https((x.urls || {}).raw), dl: https((x.links || {}).download_location), key: o.key,
      })).filter(x => x.thumb && x.full);
      return { items, more: page < (j.total_pages || 0) };
    },
    async pexels(q, page, o) {
      const j = await getJSON(`https://api.pexels.com/v1/search?query=${enc(q)}&page=${page}&per_page=20`, { Authorization: o.key });
      const items = (j.photos || []).map(x => ({
        id: 'px:' + x.id, src: 'pexels', thumb: (x.src || {}).medium, full: (x.src || {}).large, w: +x.width || 0, h: +x.height || 0,
        title: x.alt || '', author: x.photographer || 'Pexels', authorUrl: https(x.photographer_url), license: 'Pexels License',
        licenseUrl: 'https://www.pexels.com/license/', page: https(x.url), via: 'Pexels',
      })).filter(x => x.thumb && x.full);
      return { items, more: !!j.next_page };
    },
  };
  async function fetchPage(name, q, page, o) {
    const k = [name, q.toLowerCase(), page, o.strict ? 's' : ''].join('|');
    if (cache.has(k)) return cache.get(k);
    return remember(k, await SOURCES[name](q, page, o));
  }
  /** the credit line kept on the card: «Author · licence» (Unsplash / Pexels: as their rules ask) */
  const creditOf = x => x.src === 'unsplash' ? `Фото: ${x.author} · Unsplash`
    : x.src === 'pexels' ? `Фото: ${x.author} · Pexels`
    : `${x.author || x.via || 'Автор не указан'}${x.license ? ' · ' + x.license : ''}`;

  /* ======================================================================= */
  function open(o = {}) {
    const word = String(o.word || '').trim();
    // o.artTheme (optional): the photos of the chosen card template lead the row of themes
    const tq = THEME_Q[o.artTheme] || null;
    const CHIPS = tq ? [tq].concat(BASE_CHIPS.filter(c => c[1] !== tq[1])) : BASE_CHIPS;
    const pf = prefs();
    let mix = !!pf.mix && !!word;
    const touch = !!(window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches);
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
    const tabs = [['feed', '🖼 Галерея']];
    if (o.onPinterest) tabs.push(['pin', '📌 Из Pinterest']);
    if (o.onOther) tabs.push(['other', o.otherLabel || '📁 С устройства']);
    const m = UI.modal({
      title: o.title || '🔎 Лента фото', cls: 'wide gal-modal',
      body: `<div class="gal">
        <div class="gal-top">
          ${tabs.length > 1 ? `<div class="gal-tabs" role="tablist" aria-label="Откуда взять фото">${tabs.map(([k, l], i) => `<button type="button" role="tab" class="gal-tab" data-tab="${k}" aria-selected="${i === 0}">${l}</button>`).join('')}</div>` : ''}
          <div class="gal-feed-top" data-panel="feed">
            <form class="gal-search" role="search" data-form>
              <input class="input gal-q" type="search" data-q value="${esc(o.query || word || (tq ? tq[0].replace(/^\S+\s/, '') : 'norge'))}" placeholder="Что ищем? fjord, hund, kaffe…" aria-label="Поиск фото" enterkeyhint="search" autocomplete="off" lang="no">
              <button type="submit" class="gal-btn primary" aria-label="Искать">🔎<span class="gal-btn-t"> Найти</span></button>
              <button type="button" class="gal-btn sq" data-set aria-expanded="false" aria-label="Настройки ленты: свои ключи Unsplash и Pexels" title="Настройки ленты">⚙</button>
            </form>
            ${word ? `<p class="gal-hint small muted"><b lang="no">${esc(word)}</b>${o.hint ? ` — ${esc(o.hint)}` : ''} · фото со свободной лицензией, автор сохранится</p>` : '<p class="gal-hint small muted">Фото со свободной лицензией — автор и источник сохранятся</p>'}
            <div class="gal-chips" role="group" aria-label="Норвежские темы">
              ${word ? `<button type="button" class="gal-chip gal-mix" data-mix aria-pressed="${mix}" title="Искать тему вместе со словом карточки">＋ <span lang="no">${esc(word.slice(0, 24))}</span></button>` : ''}
              ${CHIPS.map(([l, q], i) => `<button type="button" class="gal-chip${tq && !i ? ' gal-theme' : ''}" data-chip="${i}" title="${esc(tq && !i ? `${q} — под выбранный шаблон карточек` : q)}">${esc(l)}</button>`).join('')}
            </div>
            <div class="gal-set" data-setbox hidden></div>
          </div>
        </div>
        <div data-panel="feed" class="gal-feed">
          <p class="gal-note small" data-note role="status" aria-live="polite" hidden></p>
          <div class="gal-cols" data-cols></div>
          <div class="gal-end" data-end aria-hidden="true"></div>
        </div>
        ${o.onPinterest ? `<div data-panel="pin" class="gal-pin" hidden>
          <p class="gal-pin-lead">Pinterest не даёт искать из других приложений — но картинку оттуда легко поставить:</p>
          <ol class="gal-steps"><li>откройте поиск в Pinterest</li><li>${touch ? 'удерживайте картинку → «Скопировать изображение»' : 'правый клик по картинке → «Скопировать изображение»'}</li><li>вернитесь и вставьте ${touch ? 'в поле ссылки' : `<kbd>${isMac ? '⌘V' : 'Ctrl+V'}</kbd>`}</li></ol>
          <button type="button" class="gal-btn primary" data-pin-go>📌 Картинка из Pinterest</button>
          <p class="small muted">Красивые норвежские фото без лишних шагов — во вкладке «🖼 Галерея».</p></div>` : ''}
      </div>`,
      onClose: () => { closed = true; if (io) io.disconnect(); if (ro) ro.disconnect(); window.removeEventListener('online', onOnline); },
    });
    const body = m.$('.modal-body');
    const colsEl = m.$('[data-cols]'), note = m.$('[data-note]'), endEl = m.$('[data-end]'), qEl = m.$('[data-q]');
    let closed = false, io = null, ro = null;

    /* ---------- masonry: N columns, each new tile goes to the shortest one (no reshuffle while scrolling) ---------- */
    let nCols = 0, colH = [], tiles = []; // tiles: { el, ratio }
    const colCount = () => { const w = colsEl.clientWidth || body.clientWidth || 360; return w < 600 ? 2 : w < 820 ? 3 : w < 1060 ? 4 : 5; };
    const ratioOf = x => { const r = x.w && x.h ? x.h / x.w : 0.75; return Math.min(1.6, Math.max(0.56, r)); }; // varied, never a sliver
    function layout(force) {
      const n = colCount();
      if (!force && n === nCols) return;
      nCols = n; colH = new Array(n).fill(0);
      colsEl.style.setProperty('--gal-n', n);
      const cols = [...Array(n)].map(() => { const c = document.createElement('div'); c.className = 'gal-col'; return c; });
      tiles.forEach(t => { const i = shortest(); cols[i].appendChild(t.el); colH[i] += t.ratio + 0.06; });
      colsEl.replaceChildren(...cols);
    }
    const shortest = () => colH.indexOf(Math.min(...colH));
    function place(el, ratio) {
      if (!nCols) layout(true);
      const i = shortest();
      colsEl.children[i].appendChild(el); colH[i] += ratio + 0.06;
      tiles.push({ el, ratio });
    }
    const SK = [1.3, 0.8, 1.05, 0.7, 1.4, 0.9, 1.2, 0.75, 1.0, 1.35];
    function skeletons(n) {
      clearSk();
      if (!nCols) layout(true);
      for (let i = 0; i < n; i++) {
        const s = document.createElement('div'); s.className = 'gal-sk'; s.style.aspectRatio = `1 / ${SK[i % SK.length]}`; s.setAttribute('aria-hidden', 'true');
        const c = colH.indexOf(Math.min(...colH)); colsEl.children[c].appendChild(s); colH[c] += SK[i % SK.length] + 0.06;
      }
    }
    function clearSk() {
      const sk = m.$$('.gal-sk'); if (!sk.length) return;
      sk.forEach(s => s.remove());
      colH = new Array(nCols).fill(0); // recount from the real tiles
      tiles.forEach(t => { const i = [...colsEl.children].indexOf(t.el.parentElement); if (i >= 0) colH[i] += t.ratio + 0.06; });
    }
    if (window.ResizeObserver) { ro = new ResizeObserver(() => layout(false)); ro.observe(colsEl); }

    /* ---------- the feed: several sources, merged; the next pages come while scrolling ---------- */
    let found = [], seen = new Set(), run = null, gen = 0;
    function sourcesFor(q, extra) {
      const k = keys(), list = [];
      if (k.unsplash) list.push({ name: 'unsplash', q, key: k.unsplash });
      if (k.pexels) list.push({ name: 'pexels', q, key: k.pexels });
      list.push({ name: 'openverse', q });
      // fallbacks (the card's English word, the theme alone…): asked one by one, only while the feed is still thin
      [].concat(extra || []).filter((x, i, a) => x && x !== q && a.indexOf(x) === i).forEach(x => list.push({ name: 'openverse', q: x, late: true }));
      list.push({ name: 'commons', q });
      return list.map(s => Object.assign({ page: 0, more: true }, s));
    }
    function search(q, extra) {
      q = String(q || '').trim(); if (!q) return;
      const g = ++gen;
      run = { q, g, src: sourcesFor(q, extra), busy: false, failed: 0, err: null };
      found = []; seen = new Set(); tiles = []; nCols = 0; colsEl.replaceChildren(); layout(true);
      note.hidden = true; note.textContent = '';
      endEl.innerHTML = '';
      try { body.scrollTop = 0; } catch (e) { /* ignore */ }
      if (navigator.onLine === false) { offlineMsg(); return; }
      skeletons(touch ? 6 : 10);
      more();
    }
    const live = s => s.more && !s.late && !s.waiting;
    async function more(only) {
      const r = run; if (!r || r.busy || closed) return;
      const todo = only || r.src.filter(live);
      if (!todo.length) { finish(); return; }
      r.busy = true;
      if (found.length) { skeletons(nCols); }
      const strict = !!prefs().strict;
      const res = await Promise.allSettled(todo.map(s => fetchPage(s.name, s.q, s.page + 1, { strict, key: s.key })));
      if (closed || r !== run) return;
      clearSk();
      const lists = [];
      let rested = false;
      res.forEach((x, i) => {
        const s = todo[i];
        if (x.status === 'fulfilled') { s.page++; s.more = x.value.more; lists.push({ s, items: x.value.items.slice() }); return; } // a copy: the merge below empties it, the cache keeps the page
        const e = x.reason || {};
        if (e.status === 429) { rested = true; s.more = Date.now() < ovRestUntil; s.waiting = true; } // Openverse rests a minute — tried again later
        else if (e.status === 401 || e.status === 403) { s.more = false; if (s.key) keyNote(s.name); }
        else { s.more = false; r.err = e; }
      });
      // merge: Unsplash / Pexels, then two Openverse for each Wikimedia — a varied, Pinterest-like mix
      const fresh = [];
      const pull = l => { while (l.items.length) { const x = l.items.shift(); const id = x.full.replace(/^https?:\/\//, '').replace(/\?.*$/, ''); if (!seen.has(id) && !seen.has(x.id)) { seen.add(id); seen.add(x.id); return x; } } return null; };
      for (let guard = 0; guard < 200 && lists.some(l => l.items.length); guard++) {
        for (const l of lists) { const n = l.s.name === 'openverse' ? 2 : 1; for (let k = 0; k < n; k++) { const x = pull(l); if (x) fresh.push(x); } }
      }
      fresh.forEach(addTile);
      r.busy = false;
      // the card's word found little: add its English translation (once)
      const late = r.src.find(s => s.late);
      if (late && late.late && found.length < 12) { late.late = false; return more([late]); }
      if (rested) restNote();
      if (!found.length && !r.src.some(live)) {
        if (r.err || rested) failMsg(r.err || { status: 429 });
        else emptyMsg();
        return;
      }
      if (!r.src.some(live)) { finish(); return; }
      watch();
      // the page is not full yet (few results, a wide screen): fill it
      requestAnimationFrame(() => { if (!closed && r === run && body.scrollHeight <= body.clientHeight + 200) more(); });
    }
    function addTile(x) {
      const i = found.length; found.push(x);
      const ratio = ratioOf(x);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'gal-tile'; b.dataset.i = i;
      b.style.aspectRatio = `1 / ${ratio.toFixed(3)}`;
      b.setAttribute('aria-label', `${x.title ? x.title.slice(0, 80) + '. ' : ''}Автор: ${x.author || x.via}. Открыть`);
      b.innerHTML = `<img alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="gal-by" aria-hidden="true">${esc((x.author || x.via || '').slice(0, 40))}</span>`;
      const img = b.querySelector('img');
      img.onload = () => {
        // tiny or broken pictures go (a 1×1 «gone» picture, an icon)
        if (img.naturalWidth < 120 || img.naturalHeight < 90) { drop(b); return; }
        b.classList.add('ld');
      };
      img.onerror = () => drop(b);
      img.src = x.thumb;
      place(b, ratio);
    }
    function drop(b) {
      const t = tiles.findIndex(t => t.el === b); if (t < 0) return;
      const col = [...colsEl.children].indexOf(b.parentElement);
      if (col >= 0) colH[col] -= tiles[t].ratio + 0.06;
      tiles.splice(t, 1); b.remove();
    }
    function watch() {
      if (io) io.disconnect();
      if (!window.IntersectionObserver) { endEl.innerHTML = '<button type="button" class="gal-btn" data-more>⬇ Показать ещё</button>'; return; }
      io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) more(); }, { root: body, rootMargin: '700px 0px' });
      io.observe(endEl);
    }
    function finish() {
      if (io) io.disconnect();
      endEl.innerHTML = found.length ? '<p class="gal-fin small muted">Это все фото по запросу — попробуйте тему выше или другое слово</p>' : '';
    }
    const show = (html) => { clearSk(); endEl.innerHTML = `<div class="gal-msg">${html}</div>`; if (io) io.disconnect(); };
    function emptyMsg() { show(`<span class="gal-msg-i" aria-hidden="true">🌫</span><p>По запросу «${esc(run.q)}» фото не нашлось.</p><p class="small muted">Попробуйте норвежское или английское слово — или тему выше: fjorder, hytte, nordlys…</p>`); }
    function offlineMsg() { show(`<span class="gal-msg-i" aria-hidden="true">📡</span><p>${esc(U.niceErr({ name: 'TypeError', message: 'Failed to fetch' }))}</p><p class="small muted">Лента обновится сама, когда связь вернётся.</p><button type="button" class="gal-btn" data-retry>🔄 Ещё раз</button>`); }
    function failMsg(e) {
      if (navigator.onLine === false) { offlineMsg(); return; }
      const rest = e && e.status === 429 || Date.now() < ovRestUntil;
      if (e && !rest) { try { console.warn('[gallery]', e); } catch (_) { /* ignore */ } }
      show(`<span class="gal-msg-i" aria-hidden="true">${rest ? '☕' : '🌫'}</span><p>${rest ? 'Галерея на минутку отдыхает — слишком много поисков подряд.' : 'Фотосервисы сейчас не ответили.'}</p><p class="small muted">${rest ? 'Через минуту можно искать снова.' : 'Попробуйте ещё раз через минуту.'}</p><button type="button" class="gal-btn" data-retry>🔄 Ещё раз</button>`);
    }
    function restNote() {
      note.hidden = false;
      note.textContent = '☕ Openverse на минутку отдыхает (много поисков подряд) — пока показываю фото из Wikimedia.';
      clearTimeout(restNote.t);
      restNote.t = setTimeout(() => { if (closed || !run) return; note.hidden = true; run.src.forEach(s => { if (s.waiting) { s.waiting = false; s.more = true; } }); watch(); }, Math.max(5000, ovRestUntil - Date.now()));
    }
    function keyNote(name) {
      note.hidden = false;
      note.textContent = `🔑 Ключ ${name === 'unsplash' ? 'Unsplash' : 'Pexels'} не подошёл — проверьте его в ⚙. Остальные фото — ниже.`;
    }
    // phones and low windows: the top tucks away while scrolling down the feed and comes back on the way up (like Pinterest)
    const top = m.$('.gal-top');
    const small = window.matchMedia ? matchMedia('(max-width: 720px), (max-height: 760px)') : { matches: false };
    let lastY = 0;
    body.addEventListener('scroll', () => {
      const y = body.scrollTop;
      if (!small.matches || !setBox.hidden || document.activeElement === qEl) { top.classList.remove('gal-tuck'); lastY = y; return; }
      if (y > lastY + 8 && y > top.offsetHeight + 40) top.classList.add('gal-tuck');
      else if (y < lastY - 8 || y < 60) top.classList.remove('gal-tuck');
      if (Math.abs(y - lastY) > 8) lastY = y;
    }, { passive: true });
    const onOnline = () => { if (!closed && run && !found.length) search(run.q); };
    window.addEventListener('online', onOnline);

    /* ---------- a tile → a large preview with author, licence and source ---------- */
    function preview(x) {
      const pm = UI.modal({
        title: '🖼 Фото', cls: 'gal-pv-modal',
        body: `<figure class="gal-pv"><div class="gal-pv-img" style="aspect-ratio:${x.w && x.h ? `${x.w} / ${x.h}` : '4 / 3'}"><img src="${esc(x.thumb)}" alt="${esc(x.title || 'Фото')}" referrerpolicy="no-referrer"></div>
          <figcaption class="gal-pv-cap">
            ${x.title ? `<b class="gal-pv-title">${esc(x.title.slice(0, 140))}</b>` : ''}
            <dl class="gal-pv-meta">
              <div><dt>Автор</dt><dd>${x.authorUrl ? `<a href="${esc(x.authorUrl)}" target="_blank" rel="noopener noreferrer">${esc(x.author)}</a>` : esc(x.author || x.via || '—')}</dd></div>
              <div><dt>Лицензия</dt><dd>${x.licenseUrl ? `<a href="${esc(x.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(x.license || '—')}</a>` : esc(x.license || '—')}</dd></div>
              <div><dt>Источник</dt><dd>${x.page ? `<a href="${esc(x.page)}" target="_blank" rel="noopener noreferrer">${esc(x.via || x.src)} ↗</a>` : esc(x.via || x.src)}${x.src === 'openverse' ? ' · через Openverse' : ''}</dd></div>
            </dl>
            ${x.src === 'unsplash' ? `<p class="tiny muted">Photo by ${x.authorUrl ? `<a href="${esc(x.authorUrl)}" target="_blank" rel="noopener noreferrer">${esc(x.author)}</a>` : esc(x.author)} on <a href="https://unsplash.com/?utm_source=norsk_kort&utm_medium=referral" target="_blank" rel="noopener noreferrer">Unsplash</a></p>` : ''}
            ${x.src === 'pexels' ? `<p class="tiny muted">Photo by ${esc(x.author)} on <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></p>` : ''}
          </figcaption></figure>`,
        foot: `<button type="button" class="gal-btn ghost" data-back>← К ленте</button><button type="button" class="gal-btn primary" data-apply>${esc(o.applyLabel || '✓ Поставить на карточку')}</button>`,
      });
      const big = pm.$('.gal-pv-img img');
      // the large picture replaces the thumbnail once it has arrived (the thumbnail shows at once)
      if (x.full && x.full !== x.thumb) { const im = new Image(); im.referrerPolicy = 'no-referrer'; im.onload = () => { if (big.isConnected) big.src = x.full; }; im.src = x.full; }
      pm.$('[data-back]').onclick = () => pm.close();
      const btn = pm.$('[data-apply]');
      btn.onclick = async () => {
        if (btn.disabled) return;
        btn.disabled = true; const label = btn.innerHTML; btn.innerHTML = '<span class="spinner sm"></span> Сохраняю…';
        try {
          const res = await take(x);
          pm.close(); m.close();
          if (o.onPick) o.onPick(res);
        } catch (e) {
          btn.disabled = false; btn.innerHTML = label;
          UI.toast(navigator.onLine === false ? U.niceErr({ name: 'TypeError', message: 'Failed to fetch' }) : 'Это фото не получилось сохранить — выберите другое', 'warn', 5000);
        }
      };
      setTimeout(() => { try { btn.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 60);
    }
    /** the chosen photo → stored like the other sources: compressed inside the app, author / licence / page kept */
    async function take(x) {
      const max = o.max || 900;
      const credit = creditOf(x), page = x.page || x.authorUrl || '';
      let image = '';
      if (x.src === 'unsplash') {
        // Unsplash asks for hot-linked pictures and a «download» ping when a photo is used
        image = x.raw ? x.raw + (/\?/.test(x.raw) ? '&' : '?') + `w=${max}&q=80&fm=jpg&fit=max` : x.full;
        if (x.dl) fetch(x.dl, { headers: { Authorization: 'Client-ID ' + x.key }, credentials: 'omit' }).catch(() => {});
      } else {
        try { image = await U.compressImage(x.full, max, 0.86); }
        catch (e) { try { image = await U.compressImage(x.thumb, max, 0.86); } catch (e2) { image = ''; } }
        if (!image && window.Images && Images.preload) { await Images.preload(x.full, 15000); image = x.full; } // a site that forbids copying: the link
      }
      const safe = window.Store && Store.Safe ? Store.Safe.image(image) : image;
      if (!safe) throw new Error('no image');
      return { image: safe, src: x.src, credit, page, author: x.author, license: x.license };
    }

    /* ---------- ⚙: strict licences + own keys ---------- */
    const setBox = m.$('[data-setbox]'), setBtn = m.$('[data-set]');
    function toggleSet(on) {
      on = on == null ? setBox.hidden : on;
      setBox.hidden = !on; setBtn.setAttribute('aria-expanded', String(on)); setBtn.classList.toggle('on', on);
      if (on) { setBox.innerHTML = settingsHtml(); }
    }
    setBox.addEventListener('submit', e => {
      e.preventDefault();
      saveSettings(setBox);
      toggleSet(false);
      UI.toast('Настройки ленты сохранены — только на этом устройстве', 'good', 2600);
      search(qEl.value);
    });

    /* ---------- events ---------- */
    m.$('[data-form]').addEventListener('submit', e => { e.preventDefault(); qEl.blur(); search(qEl.value); });
    m.el.addEventListener('click', e => {
      const t = e.target.closest('[data-tab]');
      if (t) { switchTab(t.dataset.tab); return; }
      if (e.target.closest('[data-set]')) { toggleSet(); return; }
      if (e.target.closest('[data-set-cancel]')) { toggleSet(false); return; }
      const mx = e.target.closest('[data-mix]');
      if (mx) { mix = !mix; mx.setAttribute('aria-pressed', String(mix)); const p = prefs(); p.mix = mix; lsSet(LS_PREFS, p); const on = m.$('.gal-chip.on'); if (on) on.click(); return; }
      const c = e.target.closest('[data-chip]');
      if (c) {
        const [label, q] = CHIPS[+c.dataset.chip];
        m.$$('.gal-chip.on').forEach(x => x.classList.remove('on')); c.classList.add('on');
        const qq = mix && word ? `${word} ${q}` : q;
        qEl.value = mix && word ? `${word} ${label.replace(/^\S+\s/, '')}` : label.replace(/^\S+\s/, '');
        search(qq, mix && word ? q : '');
        return;
      }
      if (e.target.closest('[data-retry]')) { search(run ? run.q : qEl.value); return; }
      if (e.target.closest('[data-more]')) { more(); return; }
      if (e.target.closest('[data-pin-go]')) { m.close(); o.onPinterest(); return; }
      const tile = e.target.closest('.gal-tile');
      if (tile) { const x = found[+tile.dataset.i]; if (x) preview(x); }
    });
    qEl.addEventListener('input', () => m.$$('.gal-chip.on').forEach(x => x.classList.remove('on')));
    function switchTab(k) {
      if (k === 'other') { m.close(); o.onOther(); return; }
      m.$$('[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === k)));
      m.$$('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== k; });
    }
    // ←/→ between the tabs (a tab list), as screen readers expect
    m.el.addEventListener('keydown', e => {
      const t = e.target.closest && e.target.closest('[role="tab"]'); if (!t || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
      const all = m.$$('[role="tab"]'); const n = all[(all.indexOf(t) + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length];
      n.focus(); if (n.dataset.tab !== 'other') switchTab(n.dataset.tab);
    });

    // results at once. A card: its word together with Norway («🇳🇴 Norge» lit) — if that finds little, its English word
    // with Norway, the English word alone, then Norwegian landscapes, so the wall is never empty.
    const en = String(o.en || '').split(/[\n,;/]/)[0].replace(/^(a|an|the|to)\s+/i, '').trim();
    const en2 = word && en && en.toLowerCase() !== word.toLowerCase() ? en : '';
    if (word && mix && !o.query) {
      const c0 = m.$(`[data-chip="${CHIPS.findIndex(c => c[1] === 'norway')}"]`); if (c0) c0.classList.add('on');
      qEl.value = `${word} Norge`;
      search(`${word} norway`, [en2 && `${en2} norway`, en2 || word, 'norway landscape']);
    } else if (tq && !word && !o.query) { const t0 = m.$('[data-chip="0"]'); if (t0) t0.classList.add('on'); search(tq[1], ''); }
    else search(qEl.value, en2);
    return m;
  }

  /* ---------------- ⚙ the settings form (in the feed and as its own window) ---------------- */
  function settingsHtml() {
    const k = keys(), p = prefs();
    return `<form class="gal-set-form" data-set-form>
      <label class="gal-check"><input type="checkbox" name="strict" ${p.strict ? 'checked' : ''}> <span>Только фото, которые можно менять и использовать где угодно <small class="muted">(без «NC» и «ND»)</small></span></label>
      <p class="small muted gal-set-lead">Необязательно: бесплатные ключи добавят в ленту фото из Unsplash и Pexels. Ключи хранятся только на этом устройстве — не попадают в экспорт, резервные копии и облако.</p>
      <label class="field"><span>🔑 Unsplash — Access Key · <a href="https://unsplash.com/developers" target="_blank" rel="noopener noreferrer">получить бесплатно ↗</a></span>
        <input class="input" type="password" name="unsplash" value="${esc(k.unsplash)}" placeholder="необязательно" autocomplete="off" spellcheck="false"></label>
      <label class="field"><span>🔑 Pexels — API key · <a href="https://www.pexels.com/api/" target="_blank" rel="noopener noreferrer">получить бесплатно ↗</a></span>
        <input class="input" type="password" name="pexels" value="${esc(k.pexels)}" placeholder="необязательно" autocomplete="off" spellcheck="false"></label>
      <div class="gal-set-row"><button type="button" class="gal-btn ghost" data-set-cancel>Отмена</button><button type="submit" class="gal-btn primary">✓ Сохранить</button></div>
    </form>`;
  }
  function saveSettings(root) {
    const f = root.querySelector('[data-set-form]'); if (!f) return;
    const v = n => String((f.elements[n] || {}).value || '').trim().slice(0, 200);
    lsSet(LS_KEYS, { unsplash: v('unsplash'), pexels: v('pexels') });
    const p = prefs(); p.strict = !!(f.elements.strict && f.elements.strict.checked); lsSet(LS_PREFS, p);
    cache.clear();
  }
  /** Settings → 🖼 Картинки: the same form as its own small window */
  function keysWindow() {
    const m = UI.modal({ title: '📌 Галерея картинок — настройки', cls: 'narrow gal-keys-modal', body: `<div class="gal-set">${settingsHtml()}</div>` });
    m.el.addEventListener('submit', e => { e.preventDefault(); saveSettings(m.el); m.close(); UI.toast('Сохранено — только на этом устройстве', 'good', 2600); });
    m.el.addEventListener('click', e => { if (e.target.closest('[data-set-cancel]')) m.close(); });
    return m;
  }
  /** a short line for Settings: which extra sources are on */
  function summary() { const k = keys(); const on = [k.unsplash && 'Unsplash', k.pexels && 'Pexels'].filter(Boolean); return on.length ? 'Плюс ' + on.join(' и ') : 'Openverse и Wikimedia — без ключей'; }

  window.Gallery = { open, keys: keysWindow, summary, CHIPS: BASE_CHIPS, THEME_Q };
})();
