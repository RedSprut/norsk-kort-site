/* =====================================================================
 * 🎚 PHOTO EDITOR of a card picture — «как у фотоаппарата»: frame (drag, zoom), rotation by 90° and a fine tilt,
 * mirror, light and colour sliders, ready-made styles with live thumbnails, «👁 Сравнить» (hold), reset of each slider
 * (double click / long press / the value button) and of everything, «💾 Сохранить как новую картинку» (canvas).
 * Non-destructive: the settings are card.imageFx (drawn with CSS by PhotoFxCore in js/study.js, everywhere the picture
 * is shown). Loaded on first use by PhotoFxCore.load(); styles: css/photofx.css.
 *
 * PhotoFx.open(cardId, { art, ar, onSaved })      — the study card (art: the frame of the art card → card.artDesign)
 * PhotoFx.open(cardId, { draft: { image, fx, frame: { ar, zoom, ox, oy }, base }, onApply(fx, frame) })
 *                                                 — the art editor (js/artcards.js): nothing is stored here
 * PhotoFx.bakeLook(img, fx) → a canvas: the photo with rotation, mirror, light and colour (shared PNG of an art card)
 * ===================================================================== */
(function () {
  const C = window.PhotoFxCore;
  if (!C) return;
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const r1 = v => Math.round(v * 10) / 10;

  const PRE_HINT = {
    orig: 'Как снято — без стиля',
    fjord: 'Холодный чистый свет и чёткие детали — как ясным днём у воды',
    retro: 'Тёплые выцветшие цвета, как на фото семидесятых',
    bw: 'Классическое чёрно-белое фото',
    sepia: 'Коричневатые тона старинной фотографии',
    aurora: 'Бирюзовые и малиновые отсветы, как под полярным сиянием',
    evening: 'Золотистый свет заката',
    film: 'Мягкие цвета плёночного фотоаппарата',
  };
  // key, label, min, max, left end, right end, hint
  const LIGHT = [
    ['bright', 'Яркость', -100, 100, 'темнее', 'светлее', 'Светлее или темнее всё фото'],
    ['contrast', 'Контраст', -100, 100, 'мягче', 'резче', 'Разница между светлым и тёмным'],
    ['sat', 'Насыщенность', -100, 100, 'бледнее', 'сочнее', 'Насколько яркие цвета; до упора влево — совсем без цвета'],
    ['warmth', 'Тепло', -100, 100, 'холоднее', 'теплее', 'Холоднее — голубоватый свет, теплее — золотистый, как на закате'],
    ['tint', 'Оттенок', -100, 100, 'зеленее', 'розовее', 'Убрать зеленоватый или розоватый отлив'],
    ['fade', 'Дымка', 0, 100, 'чисто', 'как старое фото', 'Мягкие, чуть выцветшие цвета'],
    ['vignette', 'Тёмные края', 0, 100, 'нет', 'сильнее', 'Края фото темнее — взгляд сам идёт к середине (виньетка)'],
  ];
  const FRAME = [
    ['zoom', 'Масштаб', 100, 300, 'целиком', 'ближе', 'Приблизить фото; затем перетащите его в рамке, чтобы выбрать кадр'],
    ['fine', 'Наклон', -15, 15, 'влево', 'вправо', 'Чуть повернуть фото — например, выровнять горизонт'],
  ];
  const DEF = { zoom: 100, fine: 0 };
  const TABS = [['look', '🎨 Стили', 'Готовые стили: одно нажатие — и у фото другое настроение'], ['frame', '✂️ Кадр', 'Масштаб, наклон и положение фото в рамке'], ['light', '☀️ Свет и цвет', 'Яркость, контраст, тепло и другие настройки']];
  const ROT_L = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>';
  const ROT_R = ROT_L.replace('<svg ', '<svg style="transform:scaleX(-1)" ');
  const FLIP = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v18" stroke-dasharray="2 2.5"/><path d="M9 7 4 17h5z"/><path d="m15 7 5 10h-5z" fill="currentColor" fill-opacity=".25"/></svg>';
  let uid = 0;

  /* ---------- drawing on a canvas: the same steps as the CSS (filter list, soft-light washes, dark edges) ---------- */
  function loadImg(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      if (!/^(data|blob):/i.test(src)) {
        try { if (new URL(src, location.href).origin !== location.origin) im.crossOrigin = 'anonymous'; } catch (e) { /* relative */ }
      }
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('img'));
      im.src = src;
    });
  }
  const MAT = {
    gray: a => { const k = 1 - a; return [0.2126 + 0.7874 * k, 0.7152 - 0.7152 * k, 0.0722 - 0.0722 * k, 0.2126 - 0.2126 * k, 0.7152 + 0.2848 * k, 0.0722 - 0.0722 * k, 0.2126 - 0.2126 * k, 0.7152 - 0.7152 * k, 0.0722 + 0.9278 * k]; },
    sepia: a => { const k = 1 - a; return [0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k, 0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k, 0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k]; },
    sat: s => [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
  };
  function colorPixels(ctx, W, H, o) {
    const list = C.ops(o); if (!list.length) return;
    const id = ctx.getImageData(0, 0, W, H), p = id.data; // throws on a picture from a site without CORS
    const steps = list.map(([k, v]) => (MAT[k] ? { m: MAT[k](v) } : { k, v }));
    for (let i = 0; i < p.length; i += 4) {
      let r = p[i] / 255, g = p[i + 1] / 255, b = p[i + 2] / 255;
      for (let j = 0; j < steps.length; j++) {
        const s = steps[j];
        if (s.m) { const m = s.m, nr = m[0] * r + m[1] * g + m[2] * b, ng = m[3] * r + m[4] * g + m[5] * b, nb = m[6] * r + m[7] * g + m[8] * b; r = nr; g = ng; b = nb; }
        else if (s.k === 'bright') { r *= s.v; g *= s.v; b *= s.v; }
        else { const c = s.v, t = 0.5 - 0.5 * c; r = r * c + t; g = g * c + t; b = b * c + t; }
        r = r < 0 ? 0 : r > 1 ? 1 : r; g = g < 0 ? 0 : g > 1 ? 1 : g; b = b < 0 ? 0 : b > 1 ? 1 : b;
      }
      p[i] = r * 255; p[i + 1] = g * 255; p[i + 2] = b * 255;
    }
    ctx.putImageData(id, 0, 0);
  }
  function washes(ctx, W, H, o, vignette) {
    const cs = C.casts(o);
    if (cs.length) {
      ctx.save(); ctx.globalCompositeOperation = 'soft-light';
      cs.forEach(([c1, c2, ang]) => {
        const t = ang * Math.PI / 180, dx = Math.sin(t), dy = -Math.cos(t), len = Math.abs(W * dx) + Math.abs(H * dy);
        const g = ctx.createLinearGradient(W / 2 - dx * len / 2, H / 2 - dy * len / 2, W / 2 + dx * len / 2, H / 2 + dy * len / 2);
        g.addColorStop(0, c1); g.addColorStop(1, c2);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      });
      ctx.restore();
    }
    const v = C.vigA(o);
    if (vignette && v) {
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(1, H / W);
      const R = W / 2 * Math.SQRT2, g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0.45, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${v})`);
      ctx.fillStyle = g; ctx.fillRect(-W / 2, -W / 2, W, W);
      ctx.restore();
    }
  }
  /** the photo in a W×H frame: rotated layer covering the frame, object-fit cover + focal point + zoom (as the CSS) */
  function drawFramed(im, o, fr, W, H, opts = {}) {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const phi = (o.rot + o.fine) * Math.PI / 180, c = Math.abs(Math.cos(phi)), s = Math.abs(Math.sin(phi));
    const a = W * c + H * s, b = W * s + H * c;
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
    const k = Math.max(a / iw, b / ih), dw = iw * k, dh = ih * k;
    const px = (a - dw) * fr.ox / 100, py = (b - dh) * fr.oy / 100, Z = fr.zoom / 100 * (opts.zoomMul || 1), ox0 = a * fr.ox / 100, oy0 = b * fr.oy / 100;
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(phi); if (o.flip) ctx.scale(-1, 1);
    ctx.drawImage(im, -a / 2 + ox0 + Z * (px - ox0), -b / 2 + oy0 + Z * (py - oy0), dw * Z, dh * Z);
    ctx.restore();
    colorPixels(ctx, W, H, o);
    washes(ctx, W, H, o, opts.vignette !== false);
    return cv;
  }
  const fitMax = (w, h, max) => { const k = Math.min(1, max / Math.max(w, h)); return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))]; };
  /** the shared PNG of an art card: the whole photo turned / mirrored / coloured (the art card frames it itself) */
  async function bakeLook(im, fx) {
    const o = C.clean(fx); if (!o) return null;
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, swap = o.rot % 180 === 90;
    const [W, H] = fitMax(swap ? ih : iw, swap ? iw : ih, 1600);
    try { return drawFramed(im, o, { zoom: 100, ox: 50, oy: 50 }, W, H, { vignette: false }); } catch (e) { return null; }
  }

  /* ---------- the editor window ---------- */
  function open(id, opts = {}) {
    const card = id ? Store.card(id) : null;
    const draft = opts.draft || null;
    const image = draft ? draft.image : card && card.image;
    if (!image) { UI.toast('У карточки пока нет фото — сначала добавьте его', 'warn'); return null; }
    const mode = draft ? 'draft' : opts.art ? 'art' : 'photo';
    const key = C.key(image), n = ++uid;
    const prev = C.clean(draft ? draft.fx : card.imageFx);
    const own = prev && prev.src === key ? prev : null;
    const st = Object.assign(C.clean({}), own || {}); // rot, fine, flip, preset, light + (photo) zoom / ox / oy
    let iw = own ? own.iw : 0, ih = own ? own.ih : 0;
    const artZ = mode === 'art' ? Object.assign({ zoom: 100, ox: 50, oy: 50 }, card.artDesign || {}) : null;
    const fr = mode === 'photo' ? { zoom: st.zoom, ox: st.ox, oy: st.oy }
      : mode === 'draft' ? { zoom: clamp(+draft.frame.zoom || 100, 100, 300), ox: clamp(+draft.frame.ox || 0, 0, 100), oy: clamp(+draft.frame.oy || 0, 0, 100) }
        : { zoom: clamp(+artZ.zoom || 100, 100, 300), ox: clamp(+artZ.ox, 0, 100), oy: clamp(+artZ.oy, 0, 100) };
    const keep = { zoom: st.zoom, ox: st.ox, oy: st.oy }; // the study card's own frame stays when the art card's one is edited
    const artAr = mode === 'photo' ? 0 : clamp(+(draft ? draft.frame.ar : opts.ar) || 0.75, 0.3, 3);
    const base = draft ? draft.base : mode === 'art' && window.ArtCards && ArtCards.fxBase ? ArtCards.fxBase(card) : null;
    const baseF = base && base.filter ? base.filter : '', zoomMul = base && base.zoomMul ? base.zoomMul : 1;
    const snap = () => JSON.stringify([C.COLOR.map(k => st[k]), st.rot, st.fine, st.flip, st.preset, fr.zoom, fr.ox, fr.oy]);
    const start = snap();
    let tab = 'look', compare = false, done = false, kt = 0;
    const cur = () => Object.assign({}, st, fr);
    const ar = () => (mode === 'photo' ? (iw && ih ? (st.rot % 180 === 90 ? ih / iw : iw / ih) : 1.5) : artAr);

    const m = UI.modal({
      title: '🎚 Настроить фото', cls: 'wide pfx-modal',
      body: `<div class="pfx-ed">
        <div class="pfx-prevcol">
          <div class="pfx-frame" data-frame tabindex="0" role="group" aria-roledescription="рамка фото" aria-label="Фото в рамке. Перетащите, чтобы сдвинуть кадр; колёсико мыши или два пальца — приблизить. С клавиатуры: стрелки — сдвиг, плюс и минус — масштаб, ноль — по центру." title="Перетащите фото, чтобы выбрать кадр · колёсико или два пальца — приблизить · двойной щелчок — по центру">
            <span class="pfx-r" data-r><img class="pfx-img" data-img alt="" draggable="false"></span><i class="pfx-cast" data-cast aria-hidden="true"></i><i class="pfx-vig" data-vig aria-hidden="true"></i><i class="pfx-thirds" aria-hidden="true"></i>
            <span class="pfx-wait" data-wait><span class="spinner sm"></span></span>
          </div>
          <div class="pfx-tools" role="group" aria-label="Повернуть, отразить, сравнить">
            <button type="button" class="pfx-tool" data-pfx="rotl" aria-label="Повернуть влево на 90°" title="Повернуть влево на 90°">${ROT_L}</button>
            <button type="button" class="pfx-tool" data-pfx="rotr" aria-label="Повернуть вправо на 90°" title="Повернуть вправо на 90°">${ROT_R}</button>
            <button type="button" class="pfx-tool" data-pfx="flip" aria-pressed="${st.flip}" aria-label="Отразить зеркально" title="Отразить зеркально — левое станет правым">${FLIP}</button>
            <button type="button" class="pfx-tool pfx-cmp" data-cmp aria-pressed="false" aria-label="Сравнить с исходным — нажмите и держите" title="Нажмите и держите — покажу фото без настроек цвета"><span aria-hidden="true">👁</span><span class="pfx-cmp-l"> Сравнить</span></button>
          </div>
          <p class="pfx-sr" aria-live="polite" data-live></p>
        </div>
        <div class="pfx-ctl">
          <div class="pfx-tabs" role="tablist" aria-label="Что настраиваем">${TABS.map(([k, l, t]) => `<button type="button" role="tab" id="pfx-t-${k}-${n}" aria-controls="pfx-p-${n}" data-tab="${k}" title="${t}" aria-selected="${tab === k}" tabindex="${tab === k ? 0 : -1}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
          <div class="pfx-pane" role="tabpanel" id="pfx-p-${n}" data-pane></div>
        </div>
      </div>`,
      foot: `<button type="button" class="btn ghost" data-pfx="reset" title="Вернуть фото как было: без стиля, поворота и кадрирования"><span aria-hidden="true">↺</span> Сбросить всё</button>
        ${mode === 'photo' ? '<button type="button" class="btn pfx-bake" data-pfx="bake" title="Сохранить фото с настройками как новую картинку карточки — так оно будет выглядеть везде, даже при отправке в другие приложения"><span aria-hidden="true">💾</span><span class="pfx-long"> Сохранить как новую картинку</span><span class="pfx-short"> Новой картинкой</span></button>' : ''}
        <span class="grow"></span>
        <button type="button" class="btn ghost" data-pfx="cancel" title="Закрыть без изменений">Отмена</button>
        <button type="button" class="btn primary" data-pfx="done" title="${mode === 'draft' ? 'Перенести настройки в дизайн карточки' : 'Сохранить настройки фото на карточке'}">✓ Готово</button>`,
      beforeClose: UI.guard(() => (done || snap() === start ? null : {
        title: 'Сохранить изменения?', line: 'Настройки фото ещё не сохранены.',
        actions: [{ label: '✓ Сохранить', value: 'save', cls: 'primary' }, { label: 'Не сохранять', value: 'drop', cls: 'bad' }], cancel: 'Вернуться к фото',
        act: v => { if (v === 'save') save(); return true; },
      })),
      onClose: () => { clearTimeout(kt); clearTimeout(lp); },
    });
    m.el.parentElement.classList.add('pfx-bd');
    const frame = m.$('[data-frame]'), rEl = m.$('[data-r]'), img = m.$('[data-img]'), castEl = m.$('[data-cast]'), vigEl = m.$('[data-vig]'), pane = m.$('[data-pane]'), live = m.$('[data-live]');
    const say = t => { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 40); };

    /* ---------- preview ---------- */
    function paint() {
      const o = cur();
      frame.style.setProperty('--ar', String(ar()));
      rEl.style.cssText = C.geo(o, 'cq');
      img.style.objectPosition = `${fr.ox}% ${fr.oy}%`;
      img.style.transformOrigin = `${fr.ox}% ${fr.oy}%`;
      img.style.scale = String(fr.zoom / 100 * zoomMul);
      const f = compare ? baseF : [C.filter(o), baseF].filter(Boolean).join(' ');
      img.style.filter = f || 'none';
      castEl.style.background = compare ? 'none' : (C.castCss(o) || 'none');
      const v = C.vigA(o);
      vigEl.style.background = compare || !v ? 'none' : `radial-gradient(ellipse at center,rgba(0,0,0,0) 45%,rgba(0,0,0,${v}) 100%)`;
      m.$$('[data-pre]').forEach(b => { const on = b.dataset.pre === st.preset; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      const fl = m.$('[data-pfx="flip"]'); if (fl) fl.setAttribute('aria-pressed', st.flip);
    }
    img.onload = () => {
      iw = img.naturalWidth; ih = img.naturalHeight;
      frame.classList.add('ready'); const w = m.$('[data-wait]'); if (w) w.remove();
      paint();
    };
    img.onerror = () => { const w = m.$('[data-wait]'); if (w) w.innerHTML = '<span class="pfx-err">Фото не загрузилось — проверьте интернет</span>'; };
    img.src = image;

    /* ---------- controls ---------- */
    const valOf = k => (k === 'zoom' ? fr.zoom : st[k]);
    const fmt = (k, v) => (k === 'zoom' ? Math.round(v) + '%' : k === 'fine' ? (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(r1(v)) + '°' : (v > 0 && k !== 'fade' && k !== 'vignette' ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v)));
    const spoken = (k, v, l, rr) => (k === 'zoom' ? `${Math.round(v)} процентов` : !v ? 'ноль, как было'
      : `${k === 'fade' || k === 'vignette' ? '' : v < 0 ? 'минус ' : 'плюс '}${Math.abs(r1(v))}${k === 'fine' ? ' градусов' : ''}, ${v < 0 ? l : rr}`);
    function fill(inp) {
      const lo = +inp.min, hi = +inp.max, v = +inp.value, p = (v - lo) / (hi - lo) * 100, z = lo < 0 ? 50 : 0;
      inp.style.setProperty('--a', Math.min(p, z) + '%'); inp.style.setProperty('--b', Math.max(p, z) + '%');
    }
    const slider = ([k, label, lo, hi, l, rr, hint]) => {
      const v = valOf(k), dv = DEF[k] || 0;
      return `<div class="pfx-sl ${v !== dv ? 'changed' : ''}" data-sl="${k}">
        <div class="pfx-sl-top"><label class="pfx-sl-l" for="pfx-${k}-${n}" data-lp="${k}" title="${esc(hint)} · двойной щелчок или долгое нажатие — вернуть как было">${label}</label>
          <button type="button" class="pfx-sl-v" data-reset="${k}" aria-label="${label}: ${esc(fmt(k, v))}. Вернуть как было" title="Вернуть «${label}» как было">${fmt(k, v)}</button></div>
        <input type="range" id="pfx-${k}-${n}" min="${lo}" max="${hi}" step="${k === 'fine' ? 0.5 : 1}" value="${v}" data-k="${k}" aria-valuetext="${esc(spoken(k, v, l, rr))}" title="${esc(hint)}" data-l="${esc(l)}" data-r="${esc(rr)}">
        <div class="pfx-sl-ends" aria-hidden="true"><span>${l}</span><span>${rr}</span></div>
      </div>`;
    };
    function presetFx(k) { const p = C.PRESETS[k]; return C.clean(Object.assign({ preset: k }, p.v)); }
    function paneLook() {
      return `<div class="pfx-presets" role="group" aria-label="Готовые стили">${Object.keys(C.PRESETS).map(k => {
        const o = presetFx(k), f = C.filter(o), c = C.castCss(o), v = C.vigA(o), on = st.preset === k;
        return `<button type="button" class="pfx-pre ${on ? 'on' : ''}" data-pre="${k}" data-f="p:${k}" aria-pressed="${on}" title="${esc(PRE_HINT[k] || '')}">
          <span class="pfx-thumb" aria-hidden="true"><img src="${esc(image)}" alt="" draggable="false" style="${f ? `filter:${f}` : ''}">${c ? `<i style="background:${c}"></i>` : ''}${v ? `<i class="v" style="background:radial-gradient(ellipse at center,rgba(0,0,0,0) 45%,rgba(0,0,0,${v}) 100%)"></i>` : ''}</span>
          <span class="pfx-pre-n">${C.PRESETS[k].n}</span></button>`;
      }).join('')}</div>
      <p class="pfx-note">Стиль можно потом подправить во вкладке «☀️ Свет и цвет».</p>`;
    }
    function paneFrame() {
      return FRAME.map(slider).join('')
        + `<div class="pfx-row"><button type="button" class="btn sm" data-pfx="center" data-f="b:center" title="Фото снова целиком и по центру">⊙ По центру</button></div>
        <p class="pfx-note">${mode === 'photo' ? 'Приблизьте фото и перетащите его в рамке — так выбирается кадр.' : 'Рамка — как на художественной карточке. Перетащите фото, чтобы выбрать кадр.'} Повернуть на 90° и отразить — кнопками под фото.</p>`;
    }
    const paneLight = () => LIGHT.map(slider).join('');
    function renderPane(focusKey) {
      const f = document.activeElement, k = focusKey || (f && pane.contains(f) ? (f.dataset.k ? 'r:' + f.dataset.k : f.dataset.f || '') : '');
      pane.innerHTML = tab === 'look' ? paneLook() : tab === 'frame' ? paneFrame() : paneLight();
      pane.setAttribute('aria-labelledby', `pfx-t-${tab}-${n}`);
      pane.querySelectorAll('input[type="range"]').forEach(fill);
      m.$$('[data-tab]').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
      if (k) {
        const el = k.startsWith('r:') ? pane.querySelector(`input[data-k="${k.slice(2)}"]`) : pane.querySelector(`[data-f="${k}"]`);
        if (el) el.focus({ preventScroll: true });
      }
    }
    /** a slider moved (or was reset): the value, its label, the preview — without redrawing the pane */
    function setVal(k, v) {
      if (k === 'zoom') fr.zoom = clamp(v, 100, 300); else st[k] = v;
      const row = pane.querySelector(`[data-sl="${k}"]`);
      if (row) {
        const inp = row.querySelector('input'), b = row.querySelector('[data-reset]'), val = valOf(k), def = LIGHT.concat(FRAME).find(x => x[0] === k);
        if (+inp.value !== val) inp.value = val;
        fill(inp);
        inp.setAttribute('aria-valuetext', spoken(k, val, def[4], def[5]));
        b.textContent = fmt(k, val); b.setAttribute('aria-label', `${def[1]}: ${fmt(k, val)}. Вернуть как было`);
        row.classList.toggle('changed', val !== (DEF[k] || 0));
      }
      paint();
    }
    function resetKey(k) { setVal(k, DEF[k] || 0); const def = LIGHT.concat(FRAME).find(x => x[0] === k); say(`${def[1]}: как было`); }

    /* ---------- actions ---------- */
    function rotate(dir) { st.rot = (st.rot + (dir > 0 ? 90 : 270)) % 360; paint(); say(`Повёрнуто ${dir > 0 ? 'вправо' : 'влево'}`); }
    function flip() {
      // the mirror is always left ↔ right on screen: the angle changes its sign with it
      st.flip = !st.flip; st.rot = (360 - st.rot) % 360; st.fine = -st.fine;
      paint(); if (tab === 'frame') renderPane(); say(st.flip ? 'Отражено зеркально' : 'Зеркало убрано');
    }
    function center() { fr.zoom = 100; fr.ox = 50; fr.oy = 50; paint(); if (tab === 'frame') renderPane(); say('Фото по центру'); }
    function applyPreset(k) {
      const p = presetFx(k);
      C.COLOR.forEach(x => { st[x] = p[x]; }); st.preset = k;
      paint(); say(`Стиль «${C.PRESETS[k].n}»`);
    }
    function resetAll() {
      Object.assign(st, C.clean({})); fr.zoom = 100; fr.ox = 50; fr.oy = 50;
      paint(); renderPane(); say('Всё сброшено — фото как было');
    }
    /** the settings to store: null when nothing is changed */
    function result() {
      const o = Object.assign({}, st, mode === 'photo' ? fr : keep, { src: key, iw: Math.round(iw), ih: Math.round(ih) });
      const c = C.clean(o);
      return c && !C.plain(c) ? c : null;
    }
    function save() {
      if (done) return; done = true;
      if (snap() === start) return;
      const fx = result();
      if (mode === 'draft') { if (opts.onApply) opts.onApply(fx, { zoom: fr.zoom, ox: r1(fr.ox), oy: r1(fr.oy) }); return; }
      const c = Store.card(id); if (!c) return;
      const before = { imageFx: c.imageFx ? JSON.parse(JSON.stringify(c.imageFx)) : null };
      const patch = { imageFx: fx };
      if (mode === 'art') {
        before.artDesign = c.artDesign ? JSON.parse(JSON.stringify(c.artDesign)) : null;
        const z = Object.assign({}, c.artDesign || {}, { zoom: fr.zoom, ox: r1(fr.ox), oy: r1(fr.oy) });
        patch.artDesign = Store.Safe && Store.Safe.artDesign ? Store.Safe.artDesign(z) : z;
      }
      Store.updateCard(id, patch);
      const after = () => { if (opts.onSaved) { try { opts.onSaved(); } catch (e) { /* the screen behind may be gone */ } } };
      after();
      UI.toastAction(fx ? 'Фото настроено' : 'Фото снова без настроек', '↶ Вернуть', () => {
        if (!Store.card(id)) return;
        Store.updateCard(id, before); after();
      }, 8000, '🎚');
    }
    async function bake() {
      if (!iw || !ih) return;
      const ok = await UI.confirm('Фото со всеми настройками станет новой картинкой карточки — так оно будет выглядеть везде. Исходное фото заменится (сразу после можно нажать «↶ Вернуть»).', { ok: '💾 Сохранить картинку', title: '💾 Новая картинка' });
      if (!ok) return;
      const btn = m.$('[data-pfx="bake"]'); if (btn) btn.disabled = true;
      try {
        const o = cur(), swap = o.rot % 180 === 90;
        const fw = swap ? ih : iw, fh = swap ? iw : ih;
        const [W, H] = fitMax(fw, fh, 1600);
        const src = /^(data|blob):/i.test(image) ? img : await loadImg(image);
        const cv = drawFramed(src, o, fr, W, H);
        const data = Store.Safe ? Store.Safe.image(cv.toDataURL('image/jpeg', 0.9)) : cv.toDataURL('image/jpeg', 0.9);
        if (!data) throw new Error('big');
        const c = Store.card(id); if (!c) return;
        const before = { image: c.image, imageFx: c.imageFx ? JSON.parse(JSON.stringify(c.imageFx)) : null, imageAuto: !!c.imageAuto };
        Store.updateCard(id, { image: data, imageFx: null, imageAuto: false });
        done = true; m.close();
        const after = () => { if (opts.onSaved) { try { opts.onSaved(); } catch (e) { /* ignore */ } } };
        after();
        UI.toastAction('Фото сохранено новой картинкой', '↶ Вернуть', () => { if (Store.card(id)) { Store.updateCard(id, before); after(); } }, 10000, '💾');
      } catch (e) {
        if (btn) btn.disabled = false;
        UI.toast('Это фото с другого сайта, и пересохранить его нельзя. Но настройки всё равно видны на карточке — нажмите «✓ Готово».', 'warn', 7000);
      }
    }

    m.el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !m.el.contains(b)) return;
      const ds = b.dataset;
      if (ds.tab) { tab = ds.tab; renderPane(); return; }
      if (ds.pre) { applyPreset(ds.pre); return; }
      if (ds.reset) { resetKey(ds.reset); return; }
      switch (ds.pfx) {
        case 'rotl': rotate(-1); break;
        case 'rotr': rotate(1); break;
        case 'flip': flip(); break;
        case 'center': center(); break;
        case 'reset': resetAll(); break;
        case 'bake': bake(); break;
        case 'cancel': m.tryClose(); break;
        case 'done': save(); m.close(); break;
      }
    });
    m.el.addEventListener('input', e => { const t = e.target; if (t.dataset && t.dataset.k && pane.contains(t)) setVal(t.dataset.k, +t.value); });
    // reset one slider: double click on it or its name, a long press on the name
    m.el.addEventListener('dblclick', e => {
      const t = e.target.closest('input[type="range"][data-k], [data-lp]'); if (!t || !pane.contains(t)) return;
      e.preventDefault(); resetKey(t.dataset.k || t.dataset.lp);
    });
    let lp = 0;
    pane.addEventListener('pointerdown', e => {
      const t = e.target.closest('[data-lp]'); if (!t) return;
      clearTimeout(lp); lp = setTimeout(() => { lp = 0; resetKey(t.dataset.lp); t.classList.add('pfx-flash'); setTimeout(() => t.classList.remove('pfx-flash'), 500); }, 600);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => pane.addEventListener(ev, () => { clearTimeout(lp); lp = 0; }));
    // the tabs: ← → like any tab list
    m.$('.pfx-tabs').addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const all = m.$$('[data-tab]'), i = all.indexOf(document.activeElement); if (i < 0) return;
      e.preventDefault();
      const nx = all[(i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length];
      tab = nx.dataset.tab; renderPane(); nx.focus();
    });
    // a range: Delete / Backspace = back to as it was
    pane.addEventListener('keydown', e => {
      const t = e.target; if (!(t.matches && t.matches('input[type="range"][data-k]'))) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); resetKey(t.dataset.k); }
    });

    /* ---------- 👁 compare: press and hold ---------- */
    const cmp = m.$('[data-cmp]');
    const setCmp = on => { if (compare === on) return; compare = on; cmp.setAttribute('aria-pressed', on); frame.classList.toggle('pfx-comparing', on); paint(); };
    cmp.addEventListener('pointerdown', e => { e.preventDefault(); setCmp(true); try { cmp.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => cmp.addEventListener(ev, () => setCmp(false)));
    cmp.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); setCmp(true); } });
    cmp.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') setCmp(false); });
    cmp.addEventListener('blur', () => setCmp(false));
    cmp.addEventListener('contextmenu', e => e.preventDefault());

    /* ---------- the frame: drag to move, wheel / two fingers to zoom, keys ---------- */
    const pointers = new Map();
    let drag = null;
    /** a move on screen → the focal point (the photo may be turned and mirrored) */
    function pan(dx, dy, ox0, oy0) {
      if (!iw || !ih) return;
      const r = frame.getBoundingClientRect(), W = r.width, H = r.height, o = cur();
      const phi = (o.rot + o.fine) * Math.PI / 180, c = Math.cos(phi), s = Math.sin(phi), ac = Math.abs(c), as = Math.abs(s);
      const a = W * ac + H * as, b = W * as + H * ac;
      let lx = dx * c + dy * s; const ly = -dx * s + dy * c;
      if (o.flip) lx = -lx;
      const k = Math.max(a / iw, b / ih) * fr.zoom / 100 * zoomMul, ow = iw * k - a, oh = ih * k - b;
      if (ow > 1) fr.ox = r1(clamp(ox0 - lx / ow * 100, 0, 100));
      if (oh > 1) fr.oy = r1(clamp(oy0 - ly / oh * 100, 0, 100));
      paint();
    }
    const zoomTo = (z, why) => { fr.zoom = Math.round(clamp(z, 100, 300)); const row = pane.querySelector('[data-sl="zoom"]'); if (row) setVal('zoom', fr.zoom); else paint(); if (why) say(`Масштаб ${fr.zoom}%`); };
    frame.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { frame.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault(); frame.focus({ preventScroll: true });
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; drag = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: fr.zoom }; return; }
      if (pointers.size > 2) return;
      drag = { type: 'pan', sx: e.clientX, sy: e.clientY, ox0: fr.ox, oy0: fr.oy };
      frame.classList.add('pfx-dragging');
    });
    frame.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!drag) return;
      if (drag.type === 'pinch') { const [a, b] = [...pointers.values()]; if (b) zoomTo(drag.z0 * Math.hypot(a.x - b.x, a.y - b.y) / drag.d0); return; }
      pan(e.clientX - drag.sx, e.clientY - drag.sy, drag.ox0, drag.oy0);
    });
    const endPtr = e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size === 1 && drag && drag.type === 'pinch') { const [p] = [...pointers.values()]; drag = { type: 'pan', sx: p.x, sy: p.y, ox0: fr.ox, oy0: fr.oy }; return; }
      if (!pointers.size) { drag = null; frame.classList.remove('pfx-dragging'); }
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => frame.addEventListener(ev, endPtr));
    frame.addEventListener('wheel', e => { e.preventDefault(); zoomTo(fr.zoom * Math.exp(-e.deltaY * 0.0015)); clearTimeout(kt); kt = setTimeout(() => say(`Масштаб ${fr.zoom}%`), 400); }, { passive: false });
    frame.addEventListener('dblclick', e => { e.preventDefault(); center(); });
    frame.addEventListener('keydown', e => {
      const k = e.key, step = e.shiftKey ? 40 : 10;
      if (/^Arrow/.test(k)) {
        e.preventDefault();
        const dx = k === 'ArrowLeft' ? step : k === 'ArrowRight' ? -step : 0, dy = k === 'ArrowUp' ? step : k === 'ArrowDown' ? -step : 0;
        if (fr.zoom <= 100 && mode === 'photo' && !st.fine) { say('Сначала приблизьте фото — плюсом или во вкладке «✂️ Кадр»'); return; }
        pan(-dx, -dy, fr.ox, fr.oy);
        clearTimeout(kt); kt = setTimeout(() => say(`Кадр: ${Math.round(fr.ox)}% слева, ${Math.round(fr.oy)}% сверху`), 350);
      } else if (k === '+' || k === '=') { e.preventDefault(); zoomTo(fr.zoom + 10, true); }
      else if (k === '-' || k === '_') { e.preventDefault(); zoomTo(fr.zoom - 10, true); }
      else if (k === '0') { e.preventDefault(); center(); }
    });

    renderPane();
    paint();
    setTimeout(() => { const t = m.$('[data-tab].on'); if (t) t.focus({ preventScroll: true }); }, 80);
    return m;
  }

  window.PhotoFx = { open, bakeLook };
})();
