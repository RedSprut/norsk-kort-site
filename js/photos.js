/* ============ 🖼 Photo picker: deck covers (and any picture) from anywhere ============
 * - search the web: Wikimedia Commons + Wikipedia article photos (free licences, no key, browser-friendly)
 * - your device: file / gallery / camera (phone), drag & drop
 * - Pinterest or any site: copy the picture and paste here (⌘V), or paste a link (a pin link works through the Mac bridge)
 * The chosen picture is stored inside the app (compressed), so it works offline.
 */
(function () {
  const enc = encodeURIComponent;
  const SUGGEST = ['norge', 'fjord', 'Lofoten', 'Bergen Bryggen', 'Oslo', 'Tromsø nordlys', 'Geiranger', 'Trondheim', 'Reine', 'Preikestolen', 'norsk hytte', 'Hurtigruten'];

  /** one page of results; returns { items, next } — next = offset of the following page (null = the end) */
  async function commons(q, off = 0) {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=36&gsroffset=${off}&gsrsearch=${enc(q + ' filetype:bitmap')}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800`;
    const j = await (await fetch(url)).json();
    const items = Object.values((j.query || {}).pages || {}).sort((a, b) => a.index - b.index).map(p => {
      const ii = (p.imageinfo || [])[0] || {};
      const md = ii.extmetadata || {};
      const author = U.stripHtml((md.Artist || {}).value || '').trim() || 'Wikimedia Commons', license = ((md.LicenseShortName || {}).value) || '';
      // w / h: the thumbnail's size (the «🔎 Лента фото» lays out its columns before the pictures arrive)
      return { thumb: ii.thumburl || ii.url, full: ii.thumburl || ii.url, credit: `${author} · ${license}`, page: ii.descriptionurl,
        author, license, licenseUrl: ((md.LicenseUrl || {}).value) || '', title: String(p.title || '').replace(/^File:|\.[a-z0-9]+$/gi, ''), w: ii.thumbwidth || ii.width || 0, h: ii.thumbheight || ii.height || 0 };
    }).filter(x => x.thumb && !/\.(svg|tif)/i.test(x.thumb));
    return { items, next: j.continue && j.continue.gsroffset != null ? j.continue.gsroffset : null };
  }
  /** second source: photos used in Wikipedia articles (no key; Openverse — the «🔎 Лента фото», js/gallery.js) */
  async function wikipedia(q, off = 0) {
    const res = []; let more = false;
    for (const lang of ['no', 'en']) {
      const j = await (await fetch(`https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${enc(q)}&gsrlimit=25&gsroffset=${off}&prop=pageimages&piprop=thumbnail|name&pithumbsize=900`)).json();
      if (j.continue) more = true;
      Object.values((j.query || {}).pages || {}).sort((a, b) => a.index - b.index).forEach(p => {
        if (p.thumbnail && p.thumbnail.width > p.thumbnail.height) res.push({ thumb: p.thumbnail.source, full: p.thumbnail.source, credit: `Wikipedia · ${p.title}`, page: `https://${lang}.wikipedia.org/wiki/${enc(p.title)}` });
      });
    }
    return { items: res, next: more ? off + 25 : null };
  }
  /** a Pinterest pin / any page link -> its main picture (og:image), through the bridge */
  async function pageImage(url) {
    if (/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url) || /pinimg\.com/.test(url)) return url;
    if (!(window.AI && AI.bridge.up)) throw new Error('Чтобы взять картинку по ссылке на страницу, нужен мост на Mac. Или скопируйте саму картинку и вставьте её (⌘V)');
    const r = await fetch('/api/proxy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, method: 'GET' }) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'страница не открылась'); }
    const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    const og = doc.querySelector('meta[property="og:image"], meta[name="og:image"], meta[name="twitter:image"]');
    if (!og || !og.content) throw new Error('на странице не нашлось картинки');
    return og.content;
  }
  /** any source -> data URL (compressed); remote pictures that forbid copying stay as a link */
  async function toData(src, max) {
    try { return await U.compressImage(src, max, 0.82); } catch (e) {
      if (typeof src === 'string') return src;
      throw e;
    }
  }

  /* default covers: Norway — red fishing cabins, Bryggen, fjords, the flag (Wikimedia Commons, free licences) */
  const THEMES = ['Hamnøy Lofoten rorbuer', 'Reine Lofoten', 'Bryggen Bergen', 'Geirangerfjord', 'Nærøyfjord', 'Norwegian flag boat fjord',
    'Bakklandet Trondheim', 'Ålesund Art Nouveau', 'Henningsvær', 'Nusfjord', 'Svolvær harbour', 'Lysefjord Preikestolen',
    'Tromsø aurora', 'Sakrisøy yellow houses', 'Flåm fjord village', 'Stavanger old town Gamle Stavanger'];
  const hash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
  async function landscape(q, seed) {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch=${enc(q + ' filetype:bitmap')}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1100`;
    const j = await (await fetch(url)).json();
    const list = Object.values((j.query || {}).pages || {}).map(p => (p.imageinfo || [])[0]).filter(ii => ii && ii.thumburl && ii.width > ii.height * 1.2 && ii.width >= 1200);
    if (!list.length) return null;
    const ii = list[seed % Math.min(list.length, 8)];
    const md = ii.extmetadata || {};
    return { src: ii.thumburl, credit: `${U.stripHtml((md.Artist || {}).value || '').trim() || 'Wikimedia Commons'} · ${((md.LicenseShortName || {}).value) || ''}` };
  }
  const busy = new Set();

  const Photos = {
    /** one page of Wikimedia Commons photos: { items: [{ thumb, full, credit, page, author, license, w, h }], next } (js/gallery.js uses it) */
    commons,
    /** decks without a picture get a Norwegian photo (once; the user can change it with ✏️) */
    async fillCovers(decks, onDone) {
      const todo = decks.filter(d => !d.cover && !d.coverTried && !busy.has(d.id));
      if (!todo.length || !navigator.onLine) return;
      const used = new Set(Store.decks().map(d => d.coverTheme).filter(Boolean));
      let changed = false;
      for (const d of todo.slice(0, 6)) {
        busy.add(d.id);
        try {
          const h = hash(d.id + d.name);
          let theme = THEMES[h % THEMES.length];
          for (let k = 0; used.has(theme) && k < THEMES.length; k++) theme = THEMES[(h + k + 1) % THEMES.length];
          used.add(theme);
          const pic = await landscape(theme, h);
          if (pic) {
            const data = await U.compressImage(pic.src, 1100, 0.82).catch(() => pic.src);
            Store.updateDeck(d.id, { cover: data, coverCredit: pic.credit, coverTheme: theme, coverAuto: true, coverTried: true });
            changed = true;
          } else Store.updateDeck(d.id, { coverTried: true });
        } catch (e) { /* offline — try again next time */ }
        busy.delete(d.id);
      }
      if (changed && onDone) onDone();
    },
    /**
     * open the picker. opts: { title, query, max (px), onPick(dataUrl, credit, page) } — page: the photo's source page (author, licence)
     */
    pick(opts = {}) {
      const max = opts.max || 1000;
      const m = UI.modal({
        title: opts.title || '🖼 Выберите изображение', cls: 'wide photo-modal',
        body: `<div class="photo-src">
            <label class="btn primary">📱 С устройства<input type="file" accept="image/*" data-file hidden></label>
            <label class="btn camera-only">📸 Камера<input type="file" accept="image/*" capture="${/фото профиля/i.test(opts.title || '') ? 'user' : 'environment'}" data-cam hidden></label>
            <button class="btn" data-paste>📋 Вставить скопированное</button>
            <a class="btn" data-pin href="https://www.pinterest.com/search/pins/?q=${enc(opts.query || 'norge')}" target="_blank" rel="noopener">📌 Искать в Pinterest ↗</a>
            <span class="small muted">или перетащите картинку сюда</span></div>
          <div class="row" style="gap:8px"><input class="input grow" data-q value="${U.esc(opts.query || 'norge fjord')}" placeholder="поиск фото: fjord, Bergen, nordlys… или ссылка на картинку / пин">
            <select class="input" data-engine style="max-width:190px"><option value="commons">Wikimedia Commons</option><option value="wikipedia">Википедия</option></select>
            <button class="btn primary" data-go>🔎 Найти</button></div>
          <div class="photo-suggest">${SUGGEST.map(s => `<button class="chip" data-s="${U.esc(s)}">${U.esc(s)}</button>`).join('')}</div>
          <div class="photo-grid" data-grid></div>
          <div class="tiny muted">Pinterest: найдите картинку → правый клик (или долгое нажатие) → «Скопировать изображение» → вернитесь сюда и нажмите ⌘V / «Вставить скопированное». Можно вставить и ссылку на пин. Фото из Wikimedia Commons и Википедии — со свободными лицензиями.</div>`,
      });
      const grid = m.$('[data-grid]');
      let found = [];
      const done = async (src, credit, page) => {
        grid.insertAdjacentHTML('afterbegin', '<div class="small muted" data-wait><span class="spinner sm"></span> сохраняю…</div>');
        try { const data = await toData(src, max); m.close(); opts.onPick && opts.onPick(data, credit || '', page || ''); }
        catch (e) { const w = grid.querySelector('[data-wait]'); if (w) w.remove(); UI.toast('Не удалось взять картинку: ' + e.message, 'bad', 5000); }
      };
      const search = async () => {
        const q = m.$('[data-q]').value.trim();
        if (!q) return;
        if (/^https?:\/\//i.test(q)) { try { done(await pageImage(q), q); } catch (e) { UI.toast(e.message, 'warn', 6000); } return; }
        m.$('[data-pin]').href = `https://www.pinterest.com/search/pins/?q=${enc(q)}`;
        grid.innerHTML = '<div class="small muted"><span class="spinner sm"></span> ищу…</div>';
        try {
          const eng = m.$('[data-engine]').value;
          const run = (e2, qq, off) => (e2 === 'wikipedia' ? wikipedia(qq, off) : commons(qq, off));
          let res = await run(eng, q, 0), usedEng = eng, usedQ = q;
          // nothing for "My deck norge"? try the other source, then a shorter query (without telling the dropdown)
          if (!res.items.length) { usedEng = eng === 'wikipedia' ? 'commons' : 'wikipedia'; res = await run(usedEng, q, 0); }
          if (!res.items.length && q.split(/\s+/).length > 1) { usedEng = 'commons'; usedQ = q.split(/\s+/).slice(-1)[0] === 'norge' ? 'norge fjord' : q.split(/\s+/)[0]; res = await run('commons', usedQ, 0); }
          found = res.items;
          page = { eng: usedEng, q: usedQ, next: res.next, run };
          grid.innerHTML = found.length ? tiles(found, 0) + moreBtn() : '<div class="small muted photo-msg">Ничего не нашлось — попробуйте по-английски или по-норвежски (fjord, mountains, hytte).</div>';
          watchMore();
        } catch (e) { grid.innerHTML = `<div class="small muted photo-msg">Поиск не ответил (${U.esc(U.niceErr(e, '', true))}). Попробуйте другой источник или вставьте картинку.</div>`; }
      };
      /* «Показать ещё» + endless scrolling, like Google Images: the next page is appended until the photos run out */
      let page = null, loadingMore = false, io = null;
      const tiles = (list, from) => list.map((x, i) => `<button class="photo-item" data-i="${from + i}" title="${U.esc(x.credit)}"><img src="${U.esc(x.thumb)}" alt="" loading="lazy"><span>${U.esc(x.credit.slice(0, 60))}</span></button>`).join('');
      const moreBtn = () => page && page.next != null ? '<button class="btn photo-more" data-more>⬇ Показать ещё</button>' : (found.length ? '<div class="small muted photo-msg">Больше фото по этому запросу нет — попробуйте другое слово (fjord, hytte, Bergen…)</div>' : '');
      const loadMore = async () => {
        if (!page || page.next == null || loadingMore) return;
        loadingMore = true;
        const btn = grid.querySelector('[data-more]'); if (btn) btn.innerHTML = '<span class="spinner sm"></span> загружаю…';
        try {
          const res = await page.run(page.eng, page.q, page.next);
          const seen = new Set(found.map(x => x.thumb));
          const fresh = res.items.filter(x => !seen.has(x.thumb));
          const from = found.length;
          found = found.concat(fresh);
          page.next = res.next;
          if (btn) btn.remove();
          grid.insertAdjacentHTML('beforeend', tiles(fresh, from) + moreBtn());
          if (!fresh.length && page.next != null) { loadingMore = false; return loadMore(); } // a page of SVG/duplicates — take the next one
        } catch (e) { if (btn) btn.textContent = '⬇ Показать ещё (повторить)'; }
        loadingMore = false;
        watchMore();
      };
      const watchMore = () => {
        if (io) io.disconnect();
        const b = grid.querySelector('[data-more]'); if (!b || !window.IntersectionObserver) return;
        io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) loadMore(); }, { root: m.$('.modal-body') || m.el, rootMargin: '400px' }); // the window's content is what scrolls
        io.observe(b);
      };
      m.$('[data-go]').onclick = search;
      m.$('[data-q]').addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
      m.$('[data-engine]').onchange = search;
      m.el.addEventListener('click', e => {
        const s = e.target.closest('[data-s]'); if (s) { m.$('[data-q]').value = s.dataset.s; search(); return; }
        if (e.target.closest('[data-more]')) { loadMore(); return; }
        const it = e.target.closest('.photo-item'); if (it) { const x = found[+it.dataset.i]; done(x.full, x.credit, x.page); }
      });
      m.$('[data-file]').onchange = e => { const f = e.target.files[0]; if (f) done(f, 'моё фото'); };
      m.$('[data-cam]').onchange = e => { const f = e.target.files[0]; if (f) done(f, 'моё фото'); };
      // ⌘V anywhere in the window: a picture or a link
      const onPaste = e => {
        const items = [...((e.clipboardData || {}).items || [])];
        const img = items.find(x => x.type.startsWith('image/'));
        if (img) { e.preventDefault(); done(img.getAsFile(), 'вставлено'); return; }
        const t = (e.clipboardData && e.clipboardData.getData('text')) || '';
        if (/^https?:\/\//i.test(t.trim()) && document.activeElement !== m.$('[data-q]')) { e.preventDefault(); m.$('[data-q]').value = t.trim(); search(); }
      };
      document.addEventListener('paste', onPaste);
      const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { document.removeEventListener('paste', onPaste); obs.disconnect(); } });
      obs.observe(document.getElementById('modal-root'), { childList: true });
      m.$('[data-paste]').onclick = async () => {
        try {
          const list = await navigator.clipboard.read();
          for (const it of list) {
            const type = it.types.find(t => t.startsWith('image/'));
            if (type) { done(await it.getType(type), 'вставлено'); return; }
          }
          const t = await navigator.clipboard.readText();
          if (/^https?:\/\//i.test(t.trim())) { m.$('[data-q]').value = t.trim(); search(); return; }
          UI.toast('В буфере нет картинки — скопируйте изображение и нажмите ещё раз (или ⌘V)', 'warn', 5000);
        } catch (e) { UI.toast('Нажмите ⌘V (Ctrl+V) прямо в этом окне — браузер не дал прочитать буфер кнопкой', 'warn', 5000); }
      };
      // drag & drop: a file or a picture dragged from another tab
      m.el.addEventListener('dragover', e => { e.preventDefault(); m.el.classList.add('dropping'); });
      m.el.addEventListener('dragleave', () => m.el.classList.remove('dropping'));
      m.el.addEventListener('drop', e => {
        e.preventDefault(); e.stopPropagation(); m.el.classList.remove('dropping');
        const f = [...(e.dataTransfer.files || [])].find(x => x.type.startsWith('image/'));
        if (f) { done(f, 'моё фото'); return; }
        const u = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
        if (u) { m.$('[data-q]').value = u.trim(); search(); }
      });
      if (!opts.noSearch) search();
      else grid.innerHTML = '<div class="small muted photo-msg">Выберите фото с устройства, сделайте снимок камерой или вставьте скопированное (⌘V). Можно и найти в интернете — введите запрос выше.</div>';
      return m;
    },
  };

  window.Photos = Photos;
})();
