/* ============ 🔎 «Найти слова в кадре» — the words burned into a video frame → cards ============
 * The subtitle player (js/subs.js) calls FrameOcr.open({ video, at, label, url, key, deck, deckId, onDone, onClose })
 * on a paused video (a Telegram author's video through the Mac bridge, the user's own file, NRK TV — a picture the page
 * may read: drawImage → canvas is not «tainted»; a frame from another site without CORS is refused politely).
 *  - Tesseract.js (cdn.jsdelivr.net, loaded only when asked; the CSP allows jsdelivr, blob: workers and WebAssembly)
 *    with the Norwegian + English models «nor», «eng» — asked once with its size (≈ 7 МБ, then from the browser's cache);
 *  - 📝 FrameOcr.auto — the same engine for «Надписи в кадре» (js/subs.js reads the picture by itself while it plays);
 *  - the frame is enlarged for small captions; lines → phrases, words → chips with their boxes on the frame;
 *  - ticked words / phrases go to CardMaker (⚡ automatically or ✍️ by hand): a word in a sentence is translated
 *    MEANING FIRST (the sentence is translated, the word takes its meaning from it — Study.translateUnits/glossInfo);
 *  - every card says where it came from: «🔎 текст в кадре · ✈️ Telegram · канал · автор · видео от … , 0:01:23 · t.me/…».
 * The frame never leaves the device.
 */
(function () {
  const OK_KEY = 'nk-frameocr-ok';
  // Tesseract.js core (≈ 1,5 МБ) + the Norwegian (≈ 2,5 МБ) and English (≈ 3 МБ) models — measured, compressed
  const SIZE = '≈ 7 МБ';
  const esc = s => U.esc(s == null ? '' : String(s));
  const mss = t => { t = Math.max(0, Math.floor(t || 0)); const h = Math.floor(t / 3600); return h ? `${h}:${String(Math.floor(t % 3600 / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  const bare = w => String(w || '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  // a Norwegian word: Latin letters (æøå é…), maybe a hyphen inside; no digits-only, no Cyrillic
  const NOR_WORD = /^[A-Za-zÆØÅæøåÉéÈèÊêÓóÒòÔôÜüÄäÖö]+(?:[-'][A-Za-zÆØÅæøåÉéÈèÊêÓóÒòÔôÜüÄäÖö]+)*$/;
  let workerP = null;

  /** one Tesseract worker (its own Web Worker) for Norwegian + English — the shared 4-language one from the photo
   *  import is used if it is already there. onLog: the download / reading progress (undefined — the listener stays) */
  let workerOk = false;
  function worker(onLog) {
    if (onLog !== undefined) FrameOcr._onLog = onLog || null;
    if (U.lib._ocr) return Promise.resolve(U.lib._ocr);
    if (!workerP) {
      workerP = (async () => {
        await U.loadScript(U.LIBS.tesseract);
        const w = await window.Tesseract.createWorker(['nor', 'eng'], 1, { logger: m => { if (FrameOcr._onLog) FrameOcr._onLog(m); } });
        workerOk = true;
        return w;
      })();
      workerP.catch(() => { workerP = null; });
    }
    return workerP;
  }

  /** the paused frame → canvas (enlarged for small captions). Throws when the browser does not let the page read it. */
  function grab(video) {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) throw Object.assign(new Error('Кадр ещё не загрузился — подождите секунду и нажмите снова'), { user: true });
    const k = w < 1400 ? Math.min(2.2, 1800 / w) : 1;
    const c = document.createElement('canvas');
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(video, 0, 0, c.width, c.height);
    const view = c.toDataURL('image/jpeg', 0.85); // the colour frame for the window
    let d;
    try { d = g.getImageData(0, 0, c.width, c.height); } catch (e) {
      throw Object.assign(new Error('Этот кадр браузер не даёт прочитать (видео с другого сайта)'), { user: true, tainted: true });
    }
    // grey: Tesseract reads captions over pictures much better without colour (tested: «bøker», «dag», «du?»)
    const a = d.data;
    for (let i = 0; i < a.length; i += 4) { const y = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2]; a[i] = a[i + 1] = a[i + 2] = y; }
    g.putImageData(d, 0, 0);
    return { canvas: c, k, view };
  }
  /** the same frame with light and dark swapped (white captions on a dark picture read better as dark on light) */
  function inverted(src) {
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(src, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
    for (let i = 0; i < a.length; i += 4) { a[i] = 255 - a[i]; a[i + 1] = 255 - a[i + 1]; a[i + 2] = 255 - a[i + 2]; }
    g.putImageData(d, 0, 0);
    return c;
  }
  /** how good a reading is: the confident Norwegian words it found */
  const score = lines => lines.reduce((n, l) => n + l.words.reduce((k, w) => k + w.conf, 0), 0);

  /** Tesseract's answer → lines [{ text, conf, box, words: [{ text, conf, box }] }] (v4 and v5+ shapes) */
  function linesOf(data) {
    let lines = [];
    if (data && Array.isArray(data.blocks) && data.blocks.length) {
      data.blocks.forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => lines.push(l))));
    } else if (data && Array.isArray(data.lines)) lines = data.lines;
    const out = [];
    lines.forEach(l => {
      const words = (l.words || []).map(w => ({ text: String(w.text || '').trim(), conf: +w.confidence || 0, box: w.bbox }))
        .filter(w => w.text && /\p{L}/u.test(w.text) && w.conf >= 45);
      if (!words.length) return;
      const good = words.filter(w => NOR_WORD.test(bare(w.text)) && bare(w.text).length >= 2 && w.conf >= 55);
      if (!good.length) return;
      const text = words.map(w => w.text).join(' ').replace(/\s+([,.!?;:])/g, '$1').trim();
      const conf = words.reduce((n, w) => n + w.conf, 0) / words.length;
      if (conf < 55) return;
      out.push({ text, conf, box: l.bbox, words: good });
    });
    return out;
  }

  /** lines → chips: phrases (lines of 2+ words) and single words (unique, the ones you already have marked) */
  function chipsOf(lines) {
    const known = knownSet();
    const chips = [], seen = new Set();
    lines.forEach((l, li) => {
      const n = l.words.length;
      if (n >= 2) {
        const t = l.text.replace(/^[^\p{L}\p{N}«"(]+|[^\p{L}\p{N}.!?»")]+$/gu, '');
        const key = 'p:' + U.norm(t);
        if (t && !seen.has(key)) { seen.add(key); chips.push({ kind: /\s\S+\s/.test(t) || /[.!?]$/.test(t) ? 'sent' : 'phrase', text: t, line: li, box: l.box, known: known.has(U.norm(t)) }); }
      }
      l.words.forEach(w => {
        const t = bare(w.text);
        const key = 'w:' + t.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        // a capitalised word inside a line is kept as written (names); the first word of a line is lower-cased
        const low = /^\p{Lu}\p{Ll}/u.test(t) && l.words[0] === w ? t.toLowerCase() : t;
        chips.push({ kind: 'word', text: low, line: li, box: w.box, conf: w.conf, known: known.has(t.toLowerCase()) });
      });
    });
    return chips;
  }
  function knownSet() {
    const s = new Set();
    try { Store.decks().forEach(d => Store.cards(d.id).forEach(c => { const n = String(c.no || '').split('\n')[0]; s.add(U.norm(n)); s.add(bare(n).toLowerCase().replace(/^(en|ei|et|å)\s+/, '')); })); } catch (e) { /* no cards */ }
    return s;
  }

  /** the first time: what will be downloaded, how big, that the frame stays here */
  async function consent() {
    try { if (localStorage.getItem(OK_KEY) || localStorage.getItem(AUTO_KEY) === 'yes' || U.lib._ocr || workerOk) return true; } catch (e) { /* private mode */ }
    const ok = await UI.confirm(`<div class="fo-consent">
        <p><b>Приложение прочитает надписи, впечатанные в этот кадр</b> — титры, слова на доске, подписи — и покажет найденные слова и фразы: отметьте нужные, и они станут карточками.</p>
        <p>Для этого <b>один раз</b> скачивается модуль распознавания текста с норвежским и английским — <b>${SIZE}</b> (с cdn.jsdelivr.net). Потом он берётся из памяти браузера.</p>
        <p class="small muted">🔒 Кадр обрабатывается прямо на этом устройстве и никуда не отправляется. На телефоне чтение кадра занимает несколько секунд.</p></div>`,
    { ok: `⬇ Скачать (${SIZE}) и найти слова`, cancel: 'Не сейчас', title: '🔎 Найти слова в кадре' });
    if (ok) { try { localStorage.setItem(OK_KEY, '1'); } catch (e) { /* private mode */ } }
    return ok;
  }

  const FrameOcr = {
    _lines: linesOf, _chips: chipsOf,
    /** o = { video, at, label (where it came from), url, key, deck, deckId, onDone(cards), onClose() } */
    async open(o) {
      let shot;
      try { shot = grab(o.video); } catch (e) { UI.toast(e.user ? e.message : 'Не удалось взять кадр — попробуйте ещё раз', 'warn', 5000); if (o.onClose) o.onClose(); return null; }
      if (!(await consent())) { if (o.onClose) o.onClose(); return null; }
      const url = shot.view;
      let chips = [], lines = [], closed = false;
      const m = UI.modal({
        title: '🔎 Слова в кадре', cls: 'wide fo-modal',
        body: `<div class="fo-wrap">
            <div class="fo-shot" data-fo-shot><img src="${url}" alt="Кадр видео на ${mss(o.at)}"><svg class="fo-boxes" data-fo-boxes viewBox="0 0 ${shot.canvas.width} ${shot.canvas.height}" preserveAspectRatio="none" aria-hidden="true"></svg>
              <span class="fo-time">⏱ ${mss(o.at)}</span></div>
            <div class="fo-res" data-fo-res><div class="fo-prog"><span class="spinner sm"></span> <span data-fo-st>Готовлю распознавание…</span><div class="fo-bar"><i data-fo-bar></i></div></div></div>
          </div>
          <div class="fo-src small muted">📍 ${esc(o.label || '')}</div>`,
        foot: `<button type="button" class="btn ghost" data-fo="close">Закрыть</button><button type="button" class="btn primary" data-fo="cards" disabled>➕ В карточки</button>`,
        onClose: () => { closed = true; if (o.onClose) o.onClose(); },
        // words the user ticked are not lost by an accidental ✕ / Esc / tap outside; nothing ticked — closes at once
        beforeClose: UI.guard(() => !chips.some(c => c.on) ? null : { title: 'Закрыть без сохранения?', line: 'Отмеченные слова не добавлены в карточки.',
          actions: [{ label: 'Закрыть', value: 'close', cls: 'bad' }] }),
      });
      const st = (t, p) => { const a = m.$('[data-fo-st]'); if (a) a.textContent = t; const b = m.$('[data-fo-bar]'); if (b && p != null) b.style.width = Math.round(p * 100) + '%'; };
      const count = () => { const n = chips.filter(c => c.on).length; const b = m.$('[data-fo="cards"]'); b.disabled = !n; b.textContent = n ? `➕ В карточки (${n})` : '➕ В карточки'; };
      const boxes = () => {
        const svg = m.$('[data-fo-boxes]'); if (!svg) return;
        svg.innerHTML = chips.map((c, i) => c.box ? `<rect data-fo-box="${i}" class="${c.on ? 'on' : ''}${c.kind !== 'word' ? ' ph' : ''}" x="${c.box.x0}" y="${c.box.y0}" width="${c.box.x1 - c.box.x0}" height="${c.box.y1 - c.box.y0}" rx="6"/>` : '').join('');
      };
      const draw = () => {
        const res = m.$('[data-fo-res]');
        if (!chips.length) {
          res.innerHTML = `<div class="fo-empty"><b>В этом кадре не нашлось норвежского текста.</b><p class="small muted">Поставьте паузу, когда надпись на экране крупная и чёткая, — и нажмите «🔎 Найти слова в кадре» ещё раз.</p></div>`;
          return;
        }
        const ph = chips.map((c, i) => [c, i]).filter(([c]) => c.kind !== 'word'), ws = chips.map((c, i) => [c, i]).filter(([c]) => c.kind === 'word');
        const chip = ([c, i]) => `<button type="button" class="fo-chip ${c.on ? 'on' : ''} ${c.known ? 'known' : ''}" data-fo-chip="${i}" aria-pressed="${!!c.on}" lang="nb" title="${c.known ? 'Уже есть в ваших карточках' : 'Отметить для карточки'}">${esc(c.text)}${c.known ? ' <small>✓ есть</small>' : ''}</button>`;
        res.innerHTML = `<p class="fo-lead">Найдено в кадре — отметьте, из чего сделать карточки:</p>
          ${ph.length ? `<h4 class="fo-h">💬 Фразы</h4><div class="fo-chips">${ph.map(chip).join('')}</div>` : ''}
          ${ws.length ? `<h4 class="fo-h">🔤 Слова</h4><div class="fo-chips">${ws.map(chip).join('')}</div>` : ''}
          <div class="fo-sel"><button type="button" class="btn sm ghost" data-fo="new">☑ Все новые слова</button><button type="button" class="btn sm ghost" data-fo="none">Снять</button></div>
          <p class="tiny muted">Перевод подставится сам (слово — по смыслу фразы из кадра) — или впишите свой в следующем окне. Распознавание может ошибаться в буквах: текст можно поправить там же.</p>`;
        boxes(); count();
      };
      const toggle = i => { const c = chips[i]; if (!c) return; c.on = !c.on; draw(); };
      m.el.addEventListener('click', async e => {
        const ch = e.target.closest('[data-fo-chip]'); if (ch) { toggle(+ch.dataset.foChip); return; }
        const bx = e.target.closest('[data-fo-box]'); if (bx) { toggle(+bx.dataset.foBox); return; }
        const a = e.target.closest('[data-fo]'); if (!a) return;
        const act = a.dataset.fo;
        if (act === 'close') m.tryClose();
        if (act === 'new') { chips.forEach(c => { if (c.kind === 'word' && !c.known) c.on = true; }); draw(); }
        if (act === 'none') { chips.forEach(c => { c.on = false; }); draw(); }
        if (act === 'cards') { a.disabled = true; a.innerHTML = '<span class="spinner sm"></span> перевожу…'; try { await this.toCards(o, chips.filter(c => c.on), lines, m); } finally { if (a.isConnected) count(); } }
      });
      m.el.addEventListener('mouseover', e => { const ch = e.target.closest('[data-fo-chip]'); m.$$('[data-fo-box]').forEach(r => r.classList.toggle('hl', !!ch && r.dataset.foBox === ch.dataset.foChip)); });
      // recognize
      try {
        const w = await worker(x => {
          if (closed || !x || !x.status) return;
          const load = /load|init|download/i.test(x.status);
          st(load ? 'Загружаю словарь норвежского (один раз)…' : 'Читаю кадр…', typeof x.progress === 'number' ? x.progress : null);
        });
        if (closed) return m;
        st('Читаю кадр…', 0.05);
        const r = await w.recognize(shot.canvas, {}, { blocks: true, text: true });
        if (closed) return m;
        lines = linesOf(r && r.data);
        // few or unsure words: read the frame once more with light and dark swapped and keep the better reading
        const conf = lines.length ? lines.reduce((n, l) => n + l.conf, 0) / lines.length : 0;
        if (!lines.length || conf < 80) {
          st('Читаю кадр ещё раз…', 0.6);
          const r2 = await w.recognize(inverted(shot.canvas), {}, { blocks: true, text: true });
          if (closed) return m;
          const l2 = linesOf(r2 && r2.data);
          if (score(l2) > score(lines)) lines = l2;
        }
        chips = chipsOf(lines);
        chips.forEach(c => { c.on = false; }); // the user ticks what he wants («☑ Все новые слова» — all at once)
        this._last = { lines, chips };
        draw();
      } catch (e) {
        if (closed) return m;
        console.warn('frame ocr', e);
        m.$('[data-fo-res]').innerHTML = `<div class="fo-empty"><b>Не получилось прочитать кадр.</b><p class="small muted">Нужен интернет, чтобы один раз скачать модуль распознавания (${SIZE}). Проверьте подключение и попробуйте ещё раз.</p><button type="button" class="btn sm" data-fo="retry">🔄 Ещё раз</button></div>`;
        const rb = m.$('[data-fo="retry"]'); if (rb) rb.onclick = () => { m.close(); setTimeout(() => this.open(o), 250); };
      }
      return m;
    },

    /** ticked chips → CardMaker; words of a phrase in the frame get their meaning from that phrase (meaning first) */
    async toCards(o, sel, lines, m) {
      if (!sel.length) return;
      const lineText = i => (lines[i] ? lines[i].text : '');
      const sentOf = c => { const t = lineText(c.line); return t && t.split(/\s+/).filter(x => /\p{L}/u.test(x)).length >= 2 ? t : ''; };
      const sents = [...new Set(sel.filter(c => c.kind === 'word').map(sentOf).filter(Boolean))];
      if (sents.length && window.Study && Study.translateUnits) {
        try { await Promise.race([Study.translateUnits([], sents, { quiet: true }), U.sleep(20000)]); } catch (e) { /* CardMaker translates itself */ }
      }
      const mtBy = () => (window.Study && Study._exBy && Study._exBy.length ? Study._exBy.slice(-1) : ['google']);
      const options = sel.map((c, n) => {
        if (c.kind !== 'word') return { id: 'p' + n, kind: c.kind === 'sent' ? 'sent' : 'word', label: '💬 Фраза из кадра', no: c.text, ru: '', checked: true, tags: ['текст в кадре'], description: 'текст в кадре' };
        const s = sentOf(c);
        const opt = { id: 'w' + n, kind: 'word', label: '🔤 Слово из кадра', no: c.text, ru: '', checked: true, tags: ['текст в кадре'], description: s ? `в кадре: «${s}»` : 'текст в кадре' };
        if (s && window.Study && Study.glossInfo && Study.glossToks) {
          const toks = Study.glossToks(s);
          const k = toks.findIndex(t => bare(t).toLowerCase() === c.text.toLowerCase());
          const ru = Study.sentTr ? Study.sentTr(s) : '';
          if (k >= 0) {
            const g = Study.glossInfo(s, k, ru || undefined);
            if (g && g.g && ['user', 'ai', 'align', 'dict'].includes(g.how)) {
              opt.ru = g.g; opt.me = g.how === 'user';
              opt.by = g.how === 'ai' ? ['ai'] : g.how === 'align' ? mtBy() : [];
              opt.byNote = g.how === 'dict' ? 'словарик' : g.how === 'align' ? 'по смыслу фразы' : '';
            }
          }
          opt.example = s; if (ru) { opt.exampleRu = ru; opt.exBy = mtBy(); }
        }
        return opt;
      });
      CardMaker.open({
        key: o.key || 'frameocr', deck: o.deck || '🔎 Слова из кадров', deckId: o.deckId, tags: ['текст в кадре'], options,
        source: { by: 'import', label: `🔎 текст в кадре · ${o.label || 'видео'}`, url: '', name: 'текст в кадре' },
        onDone: cards => { if (o.onDone) o.onDone(cards); if (m && m.el && m.el.isConnected) m.close(); },
      });
    },
  };

  /* ============ 📝 «Надписи в кадре» — read by themselves while the video plays (js/subs.js drives it: when, how often,
   * stability, translation, the line on the video). Here: a small copy of the frame (≤ 960 px wide, grey; a dark picture
   * is turned light so white letters on black read as print), a cheap «are there letters at all» count of sharp strokes,
   * a fingerprint to notice an unchanged picture, and a strict reading: confident Norwegian / English words only, the
   * corners (channel logo, age mark, clock) ignored, spaced capitals «H Å P» joined into one word. ============ */
  const AUTO_KEY = 'nk-ink-dl'; // the answer to «Скачать распознавание надписей?»: 'yes' | 'no'
  const AUTO_W = 960;
  const ONE = /^(i|å|o|I|Å|O)$/; // one-letter words that are real words
  const FP_W = 32, FP_H = 18;
  function autoGrab(video) {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h || video.readyState < 2) return null;
    const k = Math.min(1, AUTO_W / w), W = Math.max(2, Math.round(w * k)), H = Math.max(2, Math.round(h * k));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(video, 0, 0, W, H);
    let d;
    try { d = g.getImageData(0, 0, W, H); } catch (e) { throw Object.assign(new Error('tainted'), { tainted: true }); }
    const a = d.data, n = W * H, grey = new Uint8ClampedArray(n);
    let sum = 0;
    for (let i = 0, j = 0; j < n; i += 4, j++) { const y = (a[i] * 77 + a[i + 1] * 150 + a[i + 2] * 29) >> 8; grey[j] = y; sum += y; }
    const mean = sum / n;
    // sharp steps of brightness along every other row — letters make many; the corners (logos) are not counted
    let edges = 0;
    const cx = W * 0.14, cy = H * 0.16;
    for (let y = 1; y < H; y += 2) {
      const row = y * W, band = y < cy || y > H - cy;
      for (let x = 1; x < W; x++) {
        if (band && (x < cx || x > W - cx)) continue;
        const dd = grey[row + x] - grey[row + x - 1];
        if (dd > 80 || dd < -80) edges++;
      }
    }
    // the fingerprint: the mean brightness of 32×18 cells (every pixel counts — a thin line of letters on black too)
    const fs = new Uint32Array(FP_W * FP_H), fc = new Uint32Array(FP_W * FP_H);
    for (let y = 0; y < H; y++) {
      const gy = Math.min(FP_H - 1, Math.floor(y * FP_H / H)) * FP_W, row = y * W;
      for (let x = 0; x < W; x++) { const c = gy + Math.min(FP_W - 1, Math.floor(x * FP_W / W)); fs[c] += grey[row + x]; fc[c]++; }
    }
    const fp = new Uint8Array(FP_W * FP_H);
    for (let c = 0; c < fp.length; c++) fp[c] = fc[c] ? Math.round(fs[c] / fc[c]) : 0;
    fp.edges = edges;
    const inv = mean < 110;
    for (let i = 0, j = 0; j < n; i += 4, j++) { const y = inv ? 255 - grey[j] : grey[j]; a[i] = a[i + 1] = a[i + 2] = y; a[i + 3] = 255; }
    g.putImageData(d, 0, 0);
    return { canvas: c, W, H, edges: Math.round(edges * AUTO_W / W), mean, fp, inv };
  }
  /** two fingerprints of practically the same picture (no cell changed noticeably, the same amount of sharp strokes) */
  function fpSame(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    let s = 0, mx = 0;
    for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); s += d; if (d > mx) mx = d; }
    const ea = a.edges || 0, eb = b.edges || 0;
    return s / a.length < 1.5 && mx < 6 && Math.abs(ea - eb) <= Math.max(30, Math.max(ea, eb) * 0.12);
  }
  const union = ws => ws.reduce((b, w) => (!w.box ? b : !b ? Object.assign({}, w.box) : { x0: Math.min(b.x0, w.box.x0), y0: Math.min(b.y0, w.box.y0), x1: Math.max(b.x1, w.box.x1), y1: Math.max(b.y1, w.box.y1) }), null);
  /** «H Å P» (a title with wide letter spacing: one letter per «word») → «HÅP» */
  function joinSpaced(ws) {
    const out = [];
    const one = w => w.text === bare(w.text) && /^\p{Lu}$/u.test(w.text);
    for (let i = 0; i < ws.length;) {
      let j = i; while (j < ws.length && one(ws[j])) j++;
      if (j - i >= 3) {
        const grp = ws.slice(i, j);
        out.push({ text: grp.map(w => w.text).join(''), conf: Math.min(...grp.map(w => w.conf)), box: union(grp), spaced: true });
        i = j;
      } else { out.push(ws[i]); i++; }
    }
    return out;
  }
  /** Tesseract's answer → the confident lines [{ text, conf, box, h (letter height / frame height), spaced }] top to bottom */
  function autoLines(data, W, H) {
    let lines = [];
    if (data && Array.isArray(data.blocks) && data.blocks.length) data.blocks.forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => lines.push(l))));
    else if (data && Array.isArray(data.lines)) lines = data.lines;
    const corner = b => { if (!b) return false; const x = (b.x0 + b.x1) / 2, y = (b.y0 + b.y1) / 2; return (x < W * 0.14 || x > W * 0.86) && (y < H * 0.16 || y > H * 0.84); };
    const out = [];
    lines.forEach(l => {
      let ws = (l.words || []).map(w => ({ text: String(w.text || '').trim(), conf: +w.confidence || 0, box: w.bbox })).filter(w => w.text && !corner(w.box));
      if (!ws.length) return;
      ws = joinSpaced(ws);
      const ok = w => { const b = bare(w.text); return NOR_WORD.test(b) && (b.length >= 2 || ONE.test(b)) && w.conf >= 60 && !/[^\p{L}\p{N}\s.,!?:;«»"'()\-–—…]/u.test(w.text); };
      const good = ws.filter(ok);
      if (!good.length || good.length < ws.length * 0.6) return; // more noise than words: a texture, a logo
      const conf = good.reduce((s, w) => s + w.conf, 0) / good.length;
      if (conf < 72) return;
      if (!good.some(w => bare(w.text).length >= 3)) return;
      const hs = good.map(w => (w.box ? w.box.y1 - w.box.y0 : 0)).sort((x, y) => x - y);
      const text = good.map(w => w.text).join(' ').replace(/\s+([,.!?;:])/g, '$1').replace(/^[^\p{L}\p{N}«"(]+|[^\p{L}\p{N}.!?…»")]+$/gu, '').trim();
      if (!text) return;
      // 🎬 credits: «Andrea Bræin Hovig — Anja», «Regi ........ Ole Hansen» — the parts of a line split at a dash / dots
      // or a wide gap (two columns), so the person and the role (or the character) are told apart
      const mh = hs[hs.length >> 1] || 0, cols = [];
      let cur = [], prevX = null;
      ws.forEach(w => {
        const sep = /^[—–\-…·.:|•_]+$/.test(w.text);
        const gap = w.box && prevX != null && mh ? w.box.x0 - prevX : 0;
        if ((sep || gap > mh * 1.6) && cur.length) { cols.push(cur); cur = []; }
        if (!sep && good.includes(w)) cur.push(w.text);
        if (w.box) prevX = w.box.x1;
      });
      if (cur.length) cols.push(cur);
      out.push({ text, conf, box: union(good), h: (hs[hs.length >> 1] || 0) / H, spaced: good.some(w => w.spaced), cols: cols.length > 1 ? cols.map(c => c.join(' ')) : null });
    });
    out.sort((a, b) => (a.box ? a.box.y0 : 0) - (b.box ? b.box.y0 : 0));
    return out;
  }
  FrameOcr.auto = {
    SIZE,
    /** the reading engine is on this device already (this session, or downloaded before and answered «yes») */
    ready() { return workerOk || !!U.lib._ocr; },
    answer() {
      try { return localStorage.getItem(AUTO_KEY) || (localStorage.getItem(OK_KEY) ? 'yes' : ''); } catch (e) { return ''; }
    },
    save(v) {
      try { if (v) localStorage.setItem(AUTO_KEY, v); else localStorage.removeItem(AUTO_KEY); if (v === 'yes') localStorage.setItem(OK_KEY, '1'); } catch (e) { /* private mode */ }
    },
    /** the engine (downloaded once): onLog({ status, progress }) while it loads */
    async load(onLog) {
      const w = await worker(onLog || null);
      if (U.lib._ocr) workerOk = true;
      return w;
    },
    grab: autoGrab, same: fpSame,
    /** shot (from grab) → the confident lines */
    async read(shot) {
      const w = await worker();
      const r = await w.recognize(shot.canvas, {}, { blocks: true, text: true });
      return autoLines(r && r.data, shot.W, shot.H);
    },
    _lines: autoLines, _join: joinSpaced,
  };

  window.FrameOcr = FrameOcr;
})();
