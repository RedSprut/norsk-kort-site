/* ============ 📄 RdDjvu: a DjVu book in the reader — pages as pictures, the hidden text layer for search, selection, words ============
 * Opened by js/reader.js (openDjvu) for a shelf book with fmt 'djvu'. Decoding: js/djvu.js → our own decoder in a Web Worker.
 *  - pages: drawn only near the screen (canvas, sharp on retina), far ones give their memory back; the page sizes are known
 *    from the import, so nothing jumps while pages come;
 *  - zoom: − / + / «по ширине», ctrl + wheel / trackpad pinch, two fingers on a phone; remembered on this device;
 *  - the hidden text layer (TXTz / TXTa): invisible words over the picture — select text, tap a word for its translation
 *    (the reader's own word bubble: 🔊, «в карточки»), 🔎 search in the whole book (page by page, in the background);
 *    no text layer → a calm note: pages and zoom work, search and words do not;
 *  - 🔖 bookmarks per page, highlights (five colours) + notes on the text layer, the same «Закладки и заметки» list,
 *    Markdown, «в карточки»; the book's own outline (NAVM) as the table of contents; the page is the place that syncs.
 *  - e-ink: page by page (no smooth scrolling), big tap zones; reduced motion respected.
 * Public: window.RdDjvu = { open(o) } — o from js/reader.js (meta, text, blob, page, key, P, ICON, esc, toast, skins, onPage, onClose, onDelete, wordPop).
 */
(function () {
  'use strict';
  const ZSTEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2, 2.5, 3];
  const KEEP = 8; // pages kept drawn
  const HL = [['yellow', 'Жёлтый'], ['green', 'Зелёный'], ['blue', 'Голубой'], ['pink', 'Розовый'], ['violet', 'Сиреневый']];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const RS = () => window.RdSync || null;
  const plural = (n, f) => (window.U && U.plural ? U.plural(n, f) : f[2]);
  const RM = P => P.skin === 'eink' || (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

  function open(o) {
    const { meta, text, P, ICON, esc, toast } = o;
    const D = text.djvu;
    const N = D.pages;
    const sizes = D.sizes || [];
    const st = { o, doc: null, page: clamp(o.page || 0, 0, N - 1), zoom: clamp(+P.djZoom || 1, 0.5, 3), fitW: 600, pages: [], drawn: new Map(), texts: new Map(), find: null, sel: null, closed: false };
    const m = UI.modal({
      title: esc(meta.title), cls: 'rd-modal rd-dj-modal',
      body: `<div class="rd rd-dj" data-dj-root tabindex="-1" data-mode="page">
          <div class="rd-stage dj-stage" data-stage>
            <button class="rd-side rd-side-prev" data-a="prev" aria-label="Предыдущая страница">${ICON.left}</button>
            <div class="dj-view" data-view tabindex="0" aria-label="Страницы книги"><div class="dj-pages" data-pages></div></div>
            <button class="rd-side rd-side-next" data-a="next" aria-label="Следующая страница">${ICON.right}</button>
          </div>
          <div class="rd-bottom">
            <div class="rd-progress">
              <button class="rd-ctl" data-a="prev" aria-label="Предыдущая страница">${ICON.left}</button>
              <div class="rd-prog-mid"><span class="rd-pg" data-pg aria-live="polite"></span>
                <input type="range" class="rd-range" data-range min="1" max="${N}" value="1" aria-label="Страница книги"></div>
              <button class="rd-ctl" data-a="next" aria-label="Следующая страница">${ICON.right}</button>
            </div>
            <div class="rd-player dj-zoom" role="group" aria-label="Масштаб">
              <button class="rd-ctl" data-a="zout" aria-label="Мельче">${ICON.zout}</button>
              <button class="btn sm ghost dj-fit" data-a="fit" aria-label="По ширине экрана">По ширине</button>
              <span class="dj-z" data-z aria-live="polite"></span>
              <button class="rd-ctl" data-a="zin" aria-label="Крупнее">${ICON.zin}</button>
            </div>
          </div>
        </div>`,
      onClose: () => close(),
    });
    st.m = m;
    const bd = m.el.parentElement; if (bd) bd.classList.add('rd-backdrop');
    st.root = m.$('[data-dj-root]'); st.view = m.$('[data-view]'); st.box = m.$('[data-pages]'); st.stage = m.$('[data-stage]');
    const h2 = m.el.querySelector('.modal-head h2');
    if (h2) {
      h2.classList.add('rd-h2');
      h2.insertAdjacentHTML('afterend', `<div class="rd-head-btns">
        <button class="rd-hb" data-a="toc" aria-label="Содержание" title="Содержание">${ICON.toc}</button>
        <button class="rd-hb" data-a="find" aria-label="Поиск по книге" title="Поиск по книге">${ICON.search}</button>
        <button class="rd-hb" data-a="bm" aria-label="Закладка на этой странице" aria-pressed="false" title="Закладка на этой странице">${ICON.bookmark}</button>
        <button class="rd-hb" data-a="marks" aria-label="Закладки и заметки" title="Закладки и заметки">${ICON.notes}</button>
        <button class="rd-hb rd-aa" data-a="look" aria-label="Тема и масштаб" aria-expanded="false" title="Тема и масштаб">Aa</button>
        <button class="rd-hb" data-a="menu" aria-label="Меню книги" aria-expanded="false" title="Меню книги">${ICON.more}</button></div>`);
    }
    look();
    if (!D.hasText) note('В этом DjVu нет текстового слоя (это просто сканы страниц). Листать и увеличивать можно, а поиск, выделение и перевод слов — нет.');
    // the pages as placeholders of their real size (no layout jumps while they are drawn)
    st.box.innerHTML = Array.from({ length: N }, (_, i) => `<div class="dj-page" data-p="${i}" role="img" aria-label="Страница ${i + 1}"><div class="dj-marks" aria-hidden="true"></div><div class="dj-text" lang="nb"></div><span class="dj-num" aria-hidden="true">${i + 1}</span></div>`).join('');
    st.pages = [...st.box.children];
    layout();
    // events
    m.el.addEventListener('click', onClick);
    m.el.addEventListener('change', e => { if (e.target.matches('[data-range]')) { goPage(+e.target.value - 1, false); e.target.blur(); } });
    m.el.addEventListener('input', e => { if (e.target.matches('[data-range]')) { const pg = m.$('[data-pg]'); if (pg) pg.textContent = `стр. ${e.target.value} из ${N}`; } });
    m.el.addEventListener('keydown', onKey);
    st.view.addEventListener('scroll', onScroll, { passive: true });
    st.view.addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(st.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), e); } }, { passive: false });
    let pinch = null;
    st.view.addEventListener('touchstart', e => { if (e.touches.length === 2) pinch = { d: dist(e), z: st.zoom }; }, { passive: true });
    st.view.addEventListener('touchmove', e => { if (pinch && e.touches.length === 2) { e.preventDefault(); setZoom(pinch.z * dist(e) / pinch.d, null, true); } }, { passive: false });
    st.view.addEventListener('touchend', () => { if (pinch) { pinch = null; setZoom(st.zoom); } }, { passive: true });
    st.onSel = () => { clearTimeout(st.selT); st.selT = setTimeout(selUi, 260); };
    document.addEventListener('selectionchange', st.onSel);
    st.esc = e => {
      if (e.key !== 'Escape' || st.closed) return;
      const top = [...document.querySelectorAll('#modal-root > .modal-backdrop:not(.closing)')].pop();
      if (top && !top.contains(m.el)) return;
      if (st.selEl) { e.stopPropagation(); e.preventDefault(); selHide(); return; }
      if (st.panel) { e.stopPropagation(); e.preventDefault(); panelClose(); return; }
      if (st.findEl) { e.stopPropagation(); e.preventDefault(); findClose(); }
    };
    window.addEventListener('keydown', st.esc, true);
    st.offSync = RS() ? RS().on((what, key) => { if ((what === 'marks' || what === 'remote') && (!key || key === meta.key)) { drawMarksAll(); bmUi(); } }) : null;
    let rt = 0;
    st.ro = window.ResizeObserver ? new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (!st.closed) { const p = st.page; layout(); goPage(p, false); } }, 140); }) : null;
    if (st.ro) st.ro.observe(st.stage);
    // the document itself
    (async () => {
      try {
        st.doc = await DjVuDoc.open(await o.blob.arrayBuffer());
        if (st.closed) { st.doc.close(); return; }
        st.io = new IntersectionObserver(ents => ents.forEach(en => { if (en.isIntersecting) want(+en.target.dataset.p); }), { root: st.view, rootMargin: '120% 0px' });
        st.pages.forEach(el => st.io.observe(el));
        goPage(st.page, false);
      } catch (e) {
        note('Этот DjVu не получилось открыть — возможно, файл повреждён. Попробуйте загрузить его снова.');
      }
    })();
    setTimeout(() => { try { st.view.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 80);

    /* ---------- layout, pages, zoom ---------- */
    function dist(e) { return Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }
    function look() {
      m.el.dataset.skin = P.skin || 'app';
      st.root.toggleAttribute('data-eink', P.skin === 'eink');
    }
    function layout() {
      const w = st.stage.clientWidth - (window.innerWidth >= 700 ? 2 * 64 : 2 * 10);
      st.fitW = Math.max(240, Math.min(w, 1100));
      const W = Math.round(st.fitW * st.zoom);
      st.pages.forEach((el, i) => {
        const s = sizes[i] || sizes[0] || [1000, 1400];
        el.style.width = W + 'px';
        el.style.height = Math.round(W * s[1] / s[0]) + 'px';
      });
      const z = m.$('[data-z]'); if (z) z.textContent = Math.round(st.zoom * 100) + '%';
      // drawn pages are drawn again at the new size (sharp), lazily
      st.drawn.forEach((v, i) => { v.stale = true; });
      st.pages.forEach((el, i) => { if (near(i)) want(i); });
      drawMarksAll();
    }
    function near(i) { return Math.abs(i - st.page) <= 2; }
    function setZoom(z, ev, live) {
      const old = st.zoom;
      z = clamp(Math.round(z * 100) / 100, 0.5, 3);
      if (z === old && !live) return;
      const v = st.view, vr = v.getBoundingClientRect();
      const cx = ev ? ev.clientX - vr.left : v.clientWidth / 2, cy = ev ? ev.clientY - vr.top : v.clientHeight / 2;
      const fx = (v.scrollLeft + cx) / Math.max(1, v.scrollWidth), fy = (v.scrollTop + cy) / Math.max(1, v.scrollHeight);
      st.zoom = z;
      layout();
      v.scrollLeft = fx * v.scrollWidth - cx; v.scrollTop = fy * v.scrollHeight - cy; // the spot under the fingers stays put
      if (!live) { P.djZoom = z; o.savePrefs && o.savePrefs(); }
    }
    function zoomStep(d) {
      let k = ZSTEPS.findIndex(x => x >= st.zoom - 0.001);
      if (k < 0) k = ZSTEPS.length - 1;
      k = clamp(d > 0 ? (ZSTEPS[k] > st.zoom + 0.001 ? k : k + 1) : k - 1, 0, ZSTEPS.length - 1);
      setZoom(ZSTEPS[k]);
    }
    async function want(i) {
      if (!st.doc || st.closed || i < 0 || i >= N) return;
      const cur = st.drawn.get(i);
      if (cur && (!cur.stale || cur.busy)) return;
      const el = st.pages[i];
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.min(2400, Math.round(el.clientWidth * dpr));
      const rec = cur || {};
      rec.busy = true; rec.stale = false;
      st.drawn.set(i, rec);
      try {
        const pg = await st.doc.render(i, { width });
        if (st.closed) return;
        let cv = el.querySelector('canvas');
        if (!cv) { cv = document.createElement('canvas'); cv.className = 'dj-cv'; cv.setAttribute('aria-hidden', 'true'); el.insertBefore(cv, el.firstChild); }
        cv.width = pg.width; cv.height = pg.height;
        const cx = cv.getContext('2d');
        if (typeof ImageData !== 'undefined' && pg.bitmap instanceof ImageData) cx.putImageData(pg.bitmap, 0, 0);
        else if (pg.bitmap && pg.bitmap.data && !pg.bitmap.close) cx.putImageData(new ImageData(new Uint8ClampedArray(pg.bitmap.data), pg.width, pg.height), 0, 0);
        else { cx.drawImage(pg.bitmap, 0, 0); try { pg.bitmap.close(); } catch (e) { /* not a bitmap */ } }
        el.classList.add('drawn');
        if (D.hasText) await textLayer(i);
      } catch (e) {
        el.classList.add('dj-err');
      } finally { rec.busy = false; }
      // memory: pages far away give their canvas back
      if (st.drawn.size > KEEP) {
        [...st.drawn.keys()].sort((a, b) => Math.abs(b - st.page) - Math.abs(a - st.page)).slice(0, st.drawn.size - KEEP).forEach(k => {
          if (near(k)) return;
          const c = st.pages[k].querySelector('canvas'); if (c) { c.width = 0; c.height = 0; c.remove(); }
          st.pages[k].classList.remove('drawn');
          st.drawn.delete(k);
        });
      }
    }
    async function pageText(i) {
      if (st.texts.has(i)) return st.texts.get(i);
      let t = null;
      try { t = st.doc ? await st.doc.text(i) : null; } catch (e) { t = null; }
      st.texts.set(i, t);
      return t;
    }
    /** invisible words over the picture: selectable, tappable */
    async function textLayer(i) {
      const el = st.pages[i], tl = el.querySelector('.dj-text');
      if (tl.dataset.done) return;
      const t = await pageText(i);
      if (!t || !t.words || !t.words.length || st.closed) return;
      const s = sizes[i] || [1000, 1400], W = s[0], H = s[1];
      tl.innerHTML = t.words.map((w, k) => {
        const word = t.text.slice(w.s, w.e);
        const nxt = t.words[k + 1];
        const gap = nxt ? t.text.slice(w.e, nxt.s) : '';
        const tail = /\n/.test(gap) ? '\n' : gap ? ' ' : '';
        return `<span data-w="${k}" style="left:${(w.x / W * 100).toFixed(3)}%;top:${(w.y / H * 100).toFixed(3)}%;width:${(w.w / W * 100).toFixed(3)}%;height:${(w.h / H * 100).toFixed(3)}%;--fh:${(w.h / H).toFixed(5)}">${esc(word)}${tail}</span>`;
      }).join('');
      tl.dataset.done = '1';
      fitText(i);
      drawMarks(i);
    }
    /** the invisible words take the width of the real ones (so a selection covers what you see) */
    function fitText(i) {
      const el = st.pages[i], tl = el.querySelector('.dj-text');
      const H = el.clientHeight;
      tl.style.setProperty('--ph', H + 'px');
    }

    /* ---------- navigation ---------- */
    function pageTop(i) { return st.pages[i] ? st.pages[i].offsetTop - 8 : 0; }
    function goPage(i, smooth) {
      i = clamp(i, 0, N - 1);
      st.page = i;
      st.view.scrollTo({ top: pageTop(i), behavior: smooth && !RM(P) ? 'smooth' : 'auto' });
      for (let k = i - 1; k <= i + 2; k++) want(k);
      progress();
    }
    function onScroll() {
      clearTimeout(st.scT);
      st.scT = setTimeout(() => {
        if (st.closed) return;
        const mid = st.view.scrollTop + st.view.clientHeight * 0.35;
        let i = st.page;
        for (let k = 0; k < N; k++) { if (st.pages[k].offsetTop <= mid) i = k; else break; }
        if (i !== st.page) { st.page = i; progress(); }
      }, 120);
    }
    function progress() {
      const pg = m.$('[data-pg]'), rg = m.$('[data-range]');
      if (pg) pg.textContent = `стр. ${st.page + 1} из ${N} · ${N > 1 ? Math.round(st.page / (N - 1) * 100) : 100}%`;
      if (rg && document.activeElement !== rg) rg.value = st.page + 1;
      m.$$('[data-a="prev"]').forEach(b => { b.disabled = st.page <= 0; });
      m.$$('[data-a="next"]').forEach(b => { b.disabled = st.page >= N - 1; });
      bmUi();
      o.onPage(st.page, N);
    }
    function onKey(e) {
      const t = e.target;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); findOpen(); return; }
      if (t.closest && t.closest('input, textarea, .rd-panel, .rd-find')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); goPage(st.page + 1, true); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); goPage(st.page - 1, true); }
      else if (e.key === '+' || e.key === '=') zoomStep(1);
      else if (e.key === '-') zoomStep(-1);
    }
    function onClick(e) {
      const a = e.target.closest('[data-a]');
      if (a && !a.disabled) {
        const k = a.dataset.a;
        if (st.panel && st.panel.dataset.kind === 'menu' && st.panel.contains(a)) panelClose(); // a menu item: the menu goes
        if (k === 'prev') goPage(st.page - 1, true);
        else if (k === 'next') goPage(st.page + 1, true);
        else if (k === 'zin') zoomStep(1);
        else if (k === 'zout') zoomStep(-1);
        else if (k === 'fit') setZoom(1);
        else if (k === 'toc') toc();
        else if (k === 'find') findOpen();
        else if (k === 'bm') toggleBm();
        else if (k === 'marks') marksPanel();
        else if (k === 'look') panelToggle(a, 'look');
        else if (k === 'menu') panelToggle(a, 'menu');
        return;
      }
      const sk = e.target.closest('[data-skin-v]');
      if (sk) { P.skin = sk.dataset.skinV; o.savePrefs && o.savePrefs(); look(); panelDraw(); return; }
      const del = e.target.closest('[data-dj-del]');
      if (del) { (async () => { panelClose(); if (await o.onDelete()) { st.forceClose = true; m.close(); } })(); return; }
      if (st.panel && !e.target.closest('.rd-panel')) panelClose();
      const w = e.target.closest('.dj-text span[data-w]');
      const sel = window.getSelection && getSelection();
      if (w && !(sel && !sel.isCollapsed && String(sel).trim())) { wordTap(w, e); return; }
      // e-ink: the outer fifths turn the page
      if (P.skin === 'eink' && st.view.contains(e.target)) { const vr = st.view.getBoundingClientRect(), x = (e.clientX - vr.left) / vr.width; if (x < 0.2) goPage(st.page - 1); else if (x > 0.8) goPage(st.page + 1); }
    }
    function wordTap(span, e) {
      const i = +span.closest('.dj-page').dataset.p, t = st.texts.get(i);
      if (!t) return;
      const k = +span.dataset.w, w = t.words[k];
      const raw = t.text.slice(w.s, w.e);
      const word = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      if (!word || !/\p{L}/u.test(word)) return;
      const line = (t.lines || []).find(l => l.s <= w.s && l.e >= w.e);
      const sentence = sentenceAround(t.text, w.s).slice(0, 400) || (line ? t.text.slice(line.s, line.e) : '');
      const hl = hlAtWord(i, w);
      o.wordPop(word, span.getBoundingClientRect(), sentence, null, i + 1, hl);
    }
    function sentenceAround(txt, at) {
      const flat = txt.replace(/-\n(?=\p{Ll})/gu, '').replace(/\s+/g, ' ');
      const pre = txt.slice(0, at).replace(/-\n(?=\p{Ll})/gu, '').replace(/\s+/g, ' ').length;
      let a = pre, z = pre;
      while (a > 0 && !/[.!?…]\s$/.test(flat.slice(Math.max(0, a - 2), a))) a--;
      while (z < flat.length && !/[.!?…]/.test(flat[z])) z++;
      return flat.slice(a, Math.min(flat.length, z + 1)).trim();
    }

    /* ---------- notes, panels ---------- */
    function note(t) {
      const el = document.createElement('div');
      el.className = 'rd-note dj-note';
      el.innerHTML = `<span>${esc(t)}</span><button type="button" class="rd-ib" aria-label="Понятно">${ICON.close || '✕'}</button>`;
      el.querySelector('button').onclick = () => el.remove();
      st.stage.appendChild(el);
    }
    function panelToggle(btn, kind) {
      kind = kind || 'look';
      const was = st.panel && st.panel.dataset.kind;
      panelClose();
      if (was === kind) return;
      st.panel = document.createElement('div');
      st.panel.dataset.kind = kind;
      st.panel.className = kind === 'menu' ? 'rd-panel rd-panel-menu' : 'rd-panel rd-panel-look';
      st.panel.setAttribute('role', 'dialog');
      st.panel.setAttribute('aria-label', kind === 'menu' ? 'Меню книги' : 'Тема и масштаб');
      st.stage.appendChild(st.panel);
      btn.setAttribute('aria-expanded', 'true');
      panelDraw();
    }
    function panelDraw() {
      if (!st.panel) return;
      if (st.panel.dataset.kind === 'menu') {
        // the same list as the header buttons (narrow phones hide some of them)
        st.panel.innerHTML = `<div class="rd-menu" role="menu">
          <button type="button" role="menuitem" data-a="toc">${ICON.toc} Содержание</button>
          <button type="button" role="menuitem" data-a="find">${ICON.search} Поиск по книге</button>
          <button type="button" role="menuitem" data-a="bm">${ICON.bookmark} Закладка на этой странице</button>
          <button type="button" role="menuitem" data-a="marks">${ICON.notes} Закладки и заметки</button>
          <button type="button" role="menuitem" class="rd-danger" data-dj-del>${ICON.trash2 || ''} Удалить книгу с устройства</button></div>`;
        return;
      }
      st.panel.innerHTML = `<div class="rd-pt">Тема и масштаб</div>
        <div class="rd-row"><span class="rd-lbl">Тема</span><div class="rd-seg rd-seg-skins" role="group">${o.skins.map(([v, l]) => `<button type="button" data-skin-v="${v}" aria-pressed="${P.skin === v}" class="${P.skin === v ? 'on' : ''}">${l}</button>`).join('')}</div>
          <span class="rd-tiny">Тема запоминается на этом устройстве. На фоне «Сепия» и «E-ink» страницы остаются как в книге.</span></div>
        <div class="rd-row"><span class="rd-lbl">Масштаб</span><div class="rd-step"><button type="button" data-a="zout" aria-label="Мельче">−</button><span>${Math.round(st.zoom * 100)}%</span><button type="button" data-a="zin" aria-label="Крупнее">+</button></div>
          <button type="button" class="btn ghost rd-wide" data-a="fit">По ширине экрана</button></div>
        <button type="button" class="btn ghost rd-wide rd-danger-btn" data-dj-del>${ICON.trash2 || ''} Удалить книгу с устройства</button>`;
    }
    function panelClose() { if (st.panel) { st.panel.remove(); st.panel = null; m.$$('[data-a="look"], [data-a="menu"]').forEach(b => b.setAttribute('aria-expanded', 'false')); } }
    function toc() {
      const list = [];
      const walk = (a, lv) => (a || []).forEach(e => { if (e.page >= 0) list.push({ t: e.title, p: e.page, lv }); walk(e.children, lv + 1); });
      walk(D.outline, 0);
      let items = list;
      if (!items.length) items = Array.from({ length: Math.min(N, 400) }, (_, i) => ({ t: `Страница ${i + 1}`, p: i, lv: 0 })).filter((x, i) => i % Math.max(1, Math.ceil(N / 60)) === 0);
      let cur = 0; items.forEach((x, k) => { if (x.p <= st.page) cur = k; });
      const tm = UI.modal({ title: `<span class="ui-t">${ICON.toc}<span>Содержание</span></span>`, cls: 'narrow rd-toc-modal',
        body: `${list.length ? '<div class="rd-tiny rd-toc-src">Оглавление самой книги</div>' : '<div class="rd-tiny rd-toc-src">В этой книге нет оглавления — вот страницы</div>'}<div class="rd-toc">${items.map((x, k) => `<button type="button" class="rd-toc-i${k === cur ? ' on' : ''}" data-pp="${x.p}" style="--lv:${clamp(x.lv, 0, 5)}"${k === cur ? ' aria-current="true"' : ''}><span>${esc(x.t)}</span><small>${k === cur ? 'вы здесь · ' : ''}стр. ${x.p + 1}</small></button>`).join('')}</div>` });
      tm.el.addEventListener('click', e => { const b = e.target.closest('[data-pp]'); if (!b) return; tm.close(); goPage(+b.dataset.pp); });
      setTimeout(() => { const on = tm.el.querySelector('.rd-toc-i.on'); if (on) on.scrollIntoView({ block: 'center' }); }, 60);
    }

    /* ---------- 🔖 marks on the text layer ---------- */
    function wordsIn(i, s, e) { const t = st.texts.get(i); return t ? t.words.filter(w => w.e > s && w.s < e) : []; }
    function boxesOf(i, s, e) {
      const sz = sizes[i] || [1000, 1400], W = sz[0], H = sz[1], out = [];
      wordsIn(i, s, e).forEach(w0 => {
        // a part of a word (a search hit inside «Arbeiderens»): its share of the word's width
        const L = Math.max(1, w0.e - w0.s), a = Math.max(0, s - w0.s), z = Math.min(L, e - w0.s);
        const w = { x: w0.x + w0.w * a / L, y: w0.y, w: w0.w * (z - a) / L, h: w0.h };
        const last = out[out.length - 1];
        if (last && Math.abs(last.y - w.y) < w.h * 0.6 && w.x >= last.x) { last.w = Math.max(last.w, w.x + w.w - last.x); last.h = Math.max(last.h, w.h); }
        else out.push(w);
      });
      return out.map(b => `left:${(b.x / W * 100).toFixed(3)}%;top:${(b.y / H * 100).toFixed(3)}%;width:${(b.w / W * 100).toFixed(3)}%;height:${(b.h / H * 100).toFixed(3)}%`);
    }
    function drawMarks(i) {
      const el = st.pages[i]; if (!el) return;
      const layer = el.querySelector('.dj-marks');
      let h = '';
      if (meta.key && RS()) RS().marks(meta.key, 'hl').filter(x => x.b === i).forEach(x => { boxesOf(i, x.s, x.e).forEach(b => { h += `<i class="dj-hl rd-hl-${esc(x.c)}${x.note ? ' rd-hl-n' : ''}" style="${b}"></i>`; }); });
      if (st.find && st.find.hits.length) st.find.hits.forEach((x, k) => { if (x[0] === i) boxesOf(i, x[1], x[2]).forEach(b => { h += `<i class="dj-sr${k === st.find.cur ? ' cur' : ''}" style="${b}"></i>`; }); });
      layer.innerHTML = h;
      el.classList.toggle('dj-bm', !!bmOf(i));
    }
    function drawMarksAll() { st.pages.forEach((el, i) => { if (st.texts.has(i) || el.classList.contains('dj-bm') || (meta.key && RS() && RS().marks(meta.key).some(x => x.b === i))) drawMarks(i); }); }
    function hlAtWord(i, w) { return meta.key && RS() ? RS().marks(meta.key, 'hl').find(x => x.b === i && x.s < w.e && x.e > w.s) || null : null; }
    function bmOf(i) { return meta.key && RS() ? RS().marks(meta.key, 'bm').find(x => x.b === i) || null : null; }
    function bmUi() {
      const on = !!bmOf(st.page);
      m.$$('[data-a="bm"]').forEach(b => { b.setAttribute('aria-pressed', String(on)); b.classList.toggle('on', on); b.title = on ? 'Убрать закладку с этой страницы' : 'Закладка на этой странице'; b.setAttribute('aria-label', b.title); });
    }
    async function toggleBm() {
      if (!meta.key || !RS()) return;
      const have = bmOf(st.page);
      if (have) { RS().delMark(meta.key, have.id); toast('Закладка снята', '', 1500); }
      else {
        const t = D.hasText ? await pageText(st.page) : null;
        RS().addMark(meta.key, { k: 'bm', b: st.page, s: 0, pg: st.page + 1, text: t && t.text ? t.text.replace(/\s+/g, ' ').trim().slice(0, 140) : `Страница ${st.page + 1}` });
        toast(`Закладка на стр. ${st.page + 1}`, 'good', 1500);
      }
      drawMarks(st.page); bmUi();
    }
    /** a selection on one page's text layer → [page, s, e] in that page's text */
    function selRange() {
      const sel = window.getSelection && getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
      const r = sel.getRangeAt(0);
      if (!st.box.contains(r.commonAncestorContainer)) return null;
      const spanOf = (n) => { const el = n.nodeType === 3 ? n.parentElement : n; return el && el.closest ? el.closest('.dj-text span[data-w]') : null; };
      let a = spanOf(r.startContainer), z = spanOf(r.endContainer);
      if (!a || !z) return null;
      const pa = a.closest('.dj-page'), pz = z.closest('.dj-page');
      const i = +pa.dataset.p, t = st.texts.get(i);
      if (!t) return null;
      if (pz !== pa) { const sp = pa.querySelectorAll('.dj-text span[data-w]'); z = sp[sp.length - 1]; }
      const wa = t.words[+a.dataset.w], wz = t.words[+z.dataset.w];
      const offA = r.startContainer.nodeType === 3 && spanOf(r.startContainer) === a ? Math.min(r.startOffset, wa.e - wa.s) : 0;
      const offZ = pz === pa && r.endContainer.nodeType === 3 && spanOf(r.endContainer) === z ? Math.min(r.endOffset, wz.e - wz.s) : wz.e - wz.s;
      const s = wa.s + offA, e = wz.s + offZ;
      if (e <= s) return null;
      return { i, s, e, text: t.text.slice(s, e).replace(/-\n(?=\p{Ll})/gu, '').replace(/\s+/g, ' ').trim().slice(0, 1200), rect: r.getBoundingClientRect() };
    }
    function selHide() { if (st.selEl) { st.selEl.remove(); st.selEl = null; } }
    function selUi() {
      if (st.closed) return;
      const S = selRange();
      if (!S || !meta.key || !RS()) { selHide(); return; }
      st.sel = S;
      if (!st.selEl) {
        const el = document.createElement('div');
        el.className = 'rd-selbar'; el.dataset.skin = P.skin; el.setAttribute('role', 'toolbar'); el.setAttribute('aria-label', 'Выделить цветом или добавить заметку');
        el.innerHTML = HL.map(([c, l]) => `<button type="button" class="rd-hlsw rd-hl-${c}" data-hlc="${c}" aria-label="Выделить: ${l}" title="Выделить: ${l}"></button>`).join('') + `<button type="button" class="rd-ib" data-hlc="note" aria-label="Выделить и добавить заметку" title="Заметка">${ICON.notes}</button>`;
        el.addEventListener('pointerdown', e => e.preventDefault());
        el.addEventListener('click', e => { const b = e.target.closest('[data-hlc]'); if (b) { e.stopPropagation(); makeHl(b.dataset.hlc); } });
        document.body.appendChild(el); st.selEl = el;
      }
      const el = st.selEl, rc = S.rect, w = el.offsetWidth || 300, h = el.offsetHeight || 52;
      let top = rc.bottom + 12; if (top + h > window.innerHeight - 8) top = Math.max(8, rc.top - h - 12);
      el.style.left = clamp(rc.left + rc.width / 2 - w / 2, 8, window.innerWidth - w - 8) + 'px'; el.style.top = top + 'px';
      setTimeout(() => { const sp = document.querySelector('.sel-pop'); if (!sp || !st.selEl) return; const a = sp.getBoundingClientRect(), b = st.selEl.getBoundingClientRect(); if (a.bottom > b.top && a.top < b.bottom) st.selEl.style.top = (a.top > b.top ? Math.max(8, a.top - b.height - 8) : a.bottom + 8) + 'px'; }, 380);
    }
    async function makeHl(c) {
      const S = st.sel || selRange(); selHide();
      if (!S) return;
      let noteT = '';
      if (c === 'note') { noteT = await UI.prompt('Заметка к выделенному', '', 'Ваша мысль, перевод, вопрос…', true); if (noteT == null) return; c = 'yellow'; }
      try { getSelection().removeAllRanges(); } catch (e) { /* ignore */ }
      RS().addMark(meta.key, { k: 'hl', b: S.i, s: S.s, b2: S.i, e: S.e, c, text: S.text, pg: S.i + 1, note: noteT || undefined });
      toast(noteT ? 'Выделение с заметкой сохранено' : 'Выделено', 'good', 1500);
    }
    function marksPanel() {
      if (!meta.key || !RS()) return;
      let filter = 'all';
      const COLN = Object.fromEntries(HL);
      const mm = UI.modal({ title: `<span class="ui-t">${ICON.notes}<span>Закладки и заметки</span></span>`, cls: 'rd-marks-modal', body: '<div class="rd-marks" data-marks></div>' });
      const box = mm.$('[data-marks]');
      const draw = () => {
        const all = RS().marks(meta.key);
        const list = all.filter(x => filter === 'all' || (filter === 'bm' && x.k === 'bm') || (filter === 'hl' && x.k === 'hl') || (filter === 'note' && x.note));
        const n = { all: all.length, bm: all.filter(x => x.k === 'bm').length, hl: all.filter(x => x.k === 'hl').length, note: all.filter(x => x.note).length };
        box.innerHTML = `<div class="rd-seg rd-marks-f" role="group" aria-label="Что показать">${[['all', 'Все'], ['bm', 'Закладки'], ['hl', 'Выделения'], ['note', 'Заметки']].map(([v, l]) => `<button type="button" data-f="${v}" aria-pressed="${filter === v}" class="${filter === v ? 'on' : ''}">${l} <small>${n[v]}</small></button>`).join('')}</div>
          <div class="rd-marks-acts"><button type="button" class="btn sm ghost" data-ma="md" ${all.length ? '' : 'disabled'}>${ICON.md}<span>Экспорт в Markdown</span></button>
            <button type="button" class="btn sm ghost" data-ma="cards" ${n.hl ? '' : 'disabled'}>${ICON.cards}<span>Выделения в карточки</span></button></div>
          ${list.length ? `<ul class="rd-marks-list">${list.map(x => `<li class="rd-mk" data-id="${esc(x.id)}"><button type="button" class="rd-mk-go" data-ma="go" aria-label="Перейти: стр. ${x.pg || x.b + 1}">
              <span class="rd-mk-ico ${x.k === 'hl' ? 'rd-hl-' + esc(x.c) : 'rd-mk-bm'}" aria-hidden="true">${x.k === 'bm' ? ICON.bookmark : ''}</span>
              <span class="rd-mk-t"><span class="rd-mk-q">${esc((x.text || '').slice(0, 260))}</span>${x.note ? `<span class="rd-mk-n">${ICON.notes}<span>${esc(x.note)}</span></span>` : ''}
              <small class="rd-mk-m">${x.k === 'bm' ? 'Закладка' : 'Выделение · ' + esc((COLN[x.c] || '').toLowerCase())} · стр. ${x.b + 1}</small></span></button>
              <div class="rd-mk-btns"><button type="button" class="rd-ib" data-ma="note" aria-label="${x.note ? 'Изменить заметку' : 'Добавить заметку'}">${ICON.notes}</button><button type="button" class="rd-ib rd-ib-bad" data-ma="del" aria-label="Удалить">${ICON.trash2}</button></div></li>`).join('')}</ul>`
            : `<div class="rd-empty"><b>Пока пусто</b><span>${D.hasText ? 'Выделите текст на странице — появятся цвета и заметка. ' : ''}Закладка — кнопка с ленточкой вверху.</span></div>`}`;
      };
      draw();
      const off = RS().on((what, key) => { if ((what === 'marks' || what === 'remote') && (!key || key === meta.key) && box.isConnected) draw(); });
      const obs = new MutationObserver(() => { if (!box.isConnected) { off(); obs.disconnect(); } });
      obs.observe(document.getElementById('modal-root') || document.body, { childList: true });
      box.addEventListener('click', async e => {
        const f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; draw(); return; }
        const b = e.target.closest('[data-ma]'); if (!b) return;
        const li = b.closest('[data-id]'), x = li && RS().marks(meta.key).find(q => q.id === li.dataset.id), act = b.dataset.ma;
        if (act === 'go' && x) { mm.close(); goPage(x.b); }
        else if (act === 'note' && x) { const v = await UI.prompt(x.k === 'bm' ? 'Заметка к закладке' : 'Заметка к выделению', x.note || '', 'Ваша мысль, перевод, вопрос…', true); if (v != null) RS().updMark(meta.key, x.id, { note: v }); }
        else if (act === 'del' && x) { const ok = await UI.confirm(`Удалить ${x.k === 'bm' ? 'закладку' : 'выделение'}?${x.text ? `<br><span class="small muted">«${esc(x.text.slice(0, 140))}»</span>` : ''}`, { danger: true, ok: 'Да, удалить', title: 'Удалить?' }); if (ok) RS().delMark(meta.key, x.id); }
        else if (act === 'md') { try { U.download((U.safeFileName ? U.safeFileName(meta.title) : 'kniga') + ' — заметки.md', RS().toMarkdown({ title: meta.title, author: meta.author }, RS().marks(meta.key)), 'text/markdown;charset=utf-8'); toast('Файл с заметками сохранён', 'good', 2000); } catch (err) { toast('Сохранить файл не получилось', 'warn'); } }
        else if (act === 'cards') toCards(b);
      });
    }
    async function toCards(btn) {
      const hls = RS().marks(meta.key, 'hl');
      const items = [];
      for (const x of hls) { const t = await pageText(x.b); const s = t ? sentenceAround(t.text, x.s) : x.text; const no = (s || x.text || '').slice(0, 600); if (no && !items.some(y => y.no === no) && !/[Ѐ-ӿ]{3}/.test(no)) items.push({ no, x }); }
      if (!items.length) { toast('В выделениях нет норвежских предложений для карточек', 'warn'); return; }
      const ok = await UI.confirm(`Сделать ${items.length} ${plural(items.length, ['карточку', 'карточки', 'карточек'])} из выделенных предложений?`, { ok: 'Сделать карточки', title: 'В карточки' });
      if (!ok) return;
      btn.disabled = true;
      let tr = [], by = [];
      try { if (window.Translators && Translators.translateMany) { const r = await Translators.translateMany(items.map(y => y.no), 'no', 'ru', { quiet: true }); tr = (r && r.out) || []; by = (r && r.by) || []; } } catch (e) { tr = []; }
      const name = `📖 ${meta.title.slice(0, 60)}`;
      let deck = Store.decks().find(d => d.name === name); if (!deck) deck = Store.addDeck(name, `Слова из книги «${meta.title}» (Читалка)`);
      const norm = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      const have = new Set(Store.cards(deck.id).map(c => norm(String(c.no).split('\n')[0])));
      let made = 0;
      items.forEach((y, k) => {
        const ru = String(tr[k] || '').trim(); if (!ru || have.has(norm(y.no))) return;
        const label = `📖 «${meta.title}», стр. ${y.x.b + 1}`;
        const card = { no: y.no, ru, example: '', exampleRu: '', description: label, tags: ['reader', 'highlight'] };
        try { if (window.Prov && Prov.entry) card.history = [Prov.entry('import', 'create', null, label)]; if (window.Translators && Translators.mtFlag) card.mtWarn = Translators.mtFlag(by); } catch (e) { /* plain */ }
        Store.addCard(deck.id, card); have.add(norm(y.no)); made++;
      });
      try { if (Store.saveNow) await Store.saveNow(); } catch (e) { /* later */ }
      btn.disabled = false;
      toast(made ? `➕ ${made} ${plural(made, ['карточка', 'карточки', 'карточек'])} → ${deck.name}` : 'Новых карточек нет (нет перевода или они уже есть)', made ? 'good' : 'warn', 3600);
    }

    /* ---------- 🔎 search in the text layer, page by page in the background ---------- */
    function findOpen() {
      if (!D.hasText) { toast('В этом DjVu нет текстового слоя — искать не в чем', 'warn', 3200); return; }
      if (st.findEl) { st.findEl.querySelector('input').focus(); return; }
      const el = document.createElement('div');
      el.className = 'rd-find'; el.setAttribute('role', 'search');
      el.innerHTML = `<div class="rd-find-bar"><span class="rd-find-ico" aria-hidden="true">${ICON.search}</span>
        <input type="search" class="rd-find-in" placeholder="Найти в книге…" aria-label="Найти в книге" enterkeyhint="search" autocomplete="off" spellcheck="false">
        <span class="rd-find-n" data-fn aria-live="polite"></span>
        <button type="button" class="rd-ib" data-fa="prev" aria-label="Предыдущее совпадение" disabled>${ICON.left}</button>
        <button type="button" class="rd-ib" data-fa="next" aria-label="Следующее совпадение" disabled>${ICON.right}</button>
        <button type="button" class="rd-ib" data-fa="list" aria-label="Список совпадений" aria-expanded="false" disabled>${ICON.toc}</button>
        <button type="button" class="rd-ib" data-fa="x" aria-label="Закрыть поиск">${ICON.close || '✕'}</button></div><div class="rd-find-res" data-fres hidden></div>`;
      st.stage.appendChild(el); st.findEl = el; st.root.setAttribute('data-finding', '');
      const inp = el.querySelector('input');
      let t = 0;
      inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => runFind(inp.value), 300); });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (st.find && st.find.q === inp.value.trim() && st.find.hits.length) findGo(st.find.cur + (e.shiftKey ? -1 : 1)); else runFind(inp.value); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); findClose(); } });
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-fa]');
        if (b) { e.stopPropagation(); const a = b.dataset.fa; if (a === 'x') findClose(); else if (a === 'next') findGo(st.find.cur + 1); else if (a === 'prev') findGo(st.find.cur - 1); else if (a === 'list') findList(); return; }
        const h = e.target.closest('[data-hit]'); if (h) { e.stopPropagation(); findGo(+h.dataset.hit); findList(false); }
      });
      setTimeout(() => inp.focus(), 30);
    }
    function findClose() { st.find = null; if (st.findEl) { st.findEl.remove(); st.findEl = null; } st.root.removeAttribute('data-finding'); drawMarksAll(); }
    const fold = s => s.toLowerCase().replace(/ё/g, 'е');
    async function runFind(q) {
      q = String(q || '').replace(/\s+/g, ' ').trim();
      const nEl = st.findEl && st.findEl.querySelector('[data-fn]');
      const btns = st.findEl ? [...st.findEl.querySelectorAll('[data-fa="prev"],[data-fa="next"],[data-fa="list"]')] : [];
      if (q.length < 2) { st.find = null; if (nEl) nEl.textContent = ''; btns.forEach(b => { b.disabled = true; }); drawMarksAll(); return; }
      const F = st.find = { q, hits: [], cur: -1 };
      const qq = fold(q);
      // a line break inside the word / phrase in the scan («hyphen-\nated», «two\nwords»): matched on a flattened copy
      for (let i = 0; i < N; i++) {
        if (st.find !== F || st.closed) return;
        if (nEl) nEl.textContent = `ищу… ${Math.round(i / N * 100)}%`;
        const t = await pageText(i);
        if (!t || !t.text) continue;
        const map = []; let flat = '';
        for (let k = 0; k < t.text.length; k++) {
          const ch = t.text[k];
          if (ch === '-' && t.text[k + 1] === '\n') { k++; continue; }
          if (/\s/.test(ch)) { if (flat.endsWith(' ')) continue; flat += ' '; map.push(k); continue; }
          flat += ch; map.push(k);
        }
        const lf = fold(flat);
        let from = 0, k;
        while ((k = lf.indexOf(qq, from)) >= 0 && F.hits.length < 2000) { F.hits.push([i, map[k], (map[k + qq.length - 1] || map[k]) + 1]); from = k + qq.length; }
        if (F.hits.length >= 2000) break;
        if (i % 4 === 3) await new Promise(r => setTimeout(r, 0)); // the page stays alive
        if (F.hits.length && F.cur < 0) { F.cur = 0; btns.forEach(b => { b.disabled = false; }); findGo(0); }
      }
      if (st.find !== F) return;
      btns.forEach(b => { b.disabled = !F.hits.length; });
      if (!F.hits.length) { if (nEl) nEl.textContent = 'не найдено'; drawMarksAll(); return; }
      if (nEl) nEl.textContent = `${F.cur + 1} из ${F.hits.length}`;
    }
    function findGo(k) {
      const F = st.find; if (!F || !F.hits.length) return;
      F.cur = (k + F.hits.length) % F.hits.length;
      const [i, s] = F.hits[F.cur];
      const nEl = st.findEl && st.findEl.querySelector('[data-fn]'); if (nEl) nEl.textContent = `${F.cur + 1} из ${F.hits.length}`;
      goPage(i, false);
      drawMarksAll();
      // the hit itself in view (zoomed pages are tall)
      const w = (st.texts.get(i) || { words: [] }).words.find(x => x.e > s);
      if (w) { const sz = sizes[i] || [1000, 1400]; st.view.scrollTop = st.pages[i].offsetTop + st.pages[i].clientHeight * (w.y / sz[1]) - st.view.clientHeight * 0.35; }
    }
    function findList(show) {
      const box = st.findEl && st.findEl.querySelector('[data-fres]'), btn = st.findEl && st.findEl.querySelector('[data-fa="list"]');
      if (!box) return;
      if (show == null) show = box.hidden;
      const F = st.find;
      if (!show || !F || !F.hits.length) { box.hidden = true; if (btn) btn.setAttribute('aria-expanded', 'false'); return; }
      box.innerHTML = `<div class="rd-tiny rd-find-sum">Найдено: ${F.hits.length}</div>` + F.hits.slice(0, 300).map(([i, s, e], k) => {
        const t = st.texts.get(i).text, a = Math.max(0, s - 50), z = Math.min(t.length, e + 60);
        const cl = x => esc(x.replace(/\s+/g, ' '));
        return `<button type="button" class="rd-hit${k === F.cur ? ' on' : ''}" data-hit="${k}"><span>${a > 0 ? '…' : ''}${cl(t.slice(a, s))}<mark>${cl(t.slice(s, e))}</mark>${cl(t.slice(e, z))}…</span><small>стр. ${i + 1}</small></button>`;
      }).join('');
      box.hidden = false; if (btn) btn.setAttribute('aria-expanded', 'true');
    }

    function close() {
      if (st.closed) return;
      st.closed = true;
      selHide(); panelClose();
      clearTimeout(st.selT);
      document.removeEventListener('selectionchange', st.onSel);
      window.removeEventListener('keydown', st.esc, true);
      if (st.offSync) st.offSync();
      if (st.io) st.io.disconnect();
      if (st.ro) st.ro.disconnect();
      st.pages.forEach(el => { const c = el.querySelector('canvas'); if (c) { c.width = 0; c.height = 0; } });
      try { if (st.doc) st.doc.close(); } catch (e) { /* closed */ }
      o.onClose();
    }
    return st;
  }

  window.RdDjvu = { open };
})();
