/* ============ Study session ============ */
(function () {
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  let S = null; // current session
  /** W7: drawn line icons on the card buttons (js/app.js NavIcons) — never emoji as icons */
  const NI = (n, sz, cls) => (window.NavIcons ? NavIcons.icon(n, sz || 18, cls) : '');
  const SPK = () => NI('speaker', 18, 'say-ico');

  /* =====================================================================
   * 🎚 PHOTO SETTINGS of a card picture (card.imageFx) — like a camera: frame, rotation, mirror, light, colour, styles.
   * Non-destructive: the picture stays as it is, the look is drawn with CSS (filter + transform + two overlays) on the
   * study card and on the art cards. The settings belong to ONE picture (imageFx.src = a short fingerprint of it):
   * a new picture starts clean, «↶ Вернуть» of the old one brings its settings back.
   * The editor itself is js/photofx.js + css/photofx.css, loaded on first use (PhotoFxCore.open).
   * imageFx: { v, src, iw, ih, zoom 100–300, ox, oy 0–100, rot 0|90|180|270, fine −15…15°, flip, preset,
   *            bright, contrast, sat, warmth, tint −100…100, fade, vignette 0–100 }
   * ===================================================================== */
  const PhotoFxCore = (() => {
    // a style = the sliders it sets + its own touch (a filter, a colour wash in soft light)
    const PRESETS = {
      orig: { n: 'Оригинал', v: {} },
      fjord: { n: 'Фьорд', v: { warmth: -32, contrast: 18, sat: 12, bright: 4 } },
      retro: { n: 'Ретро', v: { warmth: 30, contrast: -12, sat: -30, fade: 42, vignette: 28 }, f: [['sepia', 0.2]] },
      bw: { n: 'Чёрно-белое', v: { contrast: 20, bright: 2 }, f: [['gray', 1]] },
      sepia: { n: 'Сепия', v: { contrast: 6, fade: 12, vignette: 24 }, f: [['sepia', 0.9]] },
      aurora: { n: 'Северное сияние', v: { sat: 20, contrast: 12, bright: -4 }, ov: ['rgba(0,255,190,.95)', 'rgba(230,30,220,.9)', 165] },
      evening: { n: 'Тёплый вечер', v: { warmth: 42, sat: 14, bright: 2, vignette: 22 }, ov: ['rgba(255,190,80,.55)', 'rgba(255,80,70,.5)', 180] },
      film: { n: 'Плёнка', v: { fade: 30, contrast: 10, sat: -14, warmth: 10, tint: 12, vignette: 14 } },
    };
    const COLOR = ['bright', 'contrast', 'sat', 'warmth', 'tint', 'fade', 'vignette'];
    const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v * 10) / 10)) : d; };
    /** only known keys and numbers in range — imageFx may come from a shared deck or an old backup */
    function clean(fx) {
      if (!fx || typeof fx !== 'object' || Array.isArray(fx)) return null;
      const o = {
        v: 1, src: typeof fx.src === 'string' ? fx.src.slice(0, 40) : '', iw: num(fx.iw, 0, 30000, 0), ih: num(fx.ih, 0, 30000, 0),
        zoom: num(fx.zoom, 100, 300, 100), ox: num(fx.ox, 0, 100, 50), oy: num(fx.oy, 0, 100, 50),
        rot: [0, 90, 180, 270].includes(+fx.rot) ? +fx.rot : 0, fine: num(fx.fine, -15, 15, 0), flip: fx.flip === true,
        preset: typeof fx.preset === 'string' && Object.prototype.hasOwnProperty.call(PRESETS, fx.preset) ? fx.preset : 'orig',
      };
      COLOR.forEach(k => { o[k] = num(fx[k], k === 'fade' || k === 'vignette' ? 0 : -100, 100, 0); });
      return o;
    }
    const plainColor = o => o.preset === 'orig' && COLOR.every(k => !o[k]);
    const plainGeo = o => !o.rot && !o.fine && !o.flip;
    const plain = o => plainColor(o) && plainGeo(o) && o.zoom === 100;
    /** a short fingerprint of the picture (a data: URL may be megabytes: every n-th character + the length) */
    let memoS = null, memoK = '';
    function key(s) {
      s = String(s || ''); if (s === memoS) return memoK;
      let h = 2166136261; const n = s.length, step = Math.max(1, Math.floor(n / 4096));
      for (let i = 0; i < n; i += step) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      for (let i = Math.max(0, n - 64); i < n; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      memoS = s; memoK = n.toString(36) + '.' + (h >>> 0).toString(36);
      return memoK;
    }
    /** the card's settings when they belong to its current picture and change something; else null */
    function of(card) {
      if (!card || !card.imageFx || !card.image) return null;
      const o = clean(card.imageFx);
      return o && o.src === key(card.image) && !plain(o) ? o : null;
    }
    /** the colour steps in order (the same list draws the CSS filter and the saved picture) */
    function ops(o) {
      const p = PRESETS[o.preset] || PRESETS.orig, out = (p.f || []).slice();
      if (o.bright) out.push(['bright', 1 + o.bright / 200]);
      if (o.contrast) out.push(['contrast', 1 + o.contrast / (o.contrast > 0 ? 150 : 200)]);
      if (o.fade) out.push(['contrast', 1 - o.fade / 100 * 0.38], ['bright', 1 + o.fade / 100 * 0.1]);
      if (o.sat || o.fade) out.push(['sat', Math.max(0, 1 + o.sat / 100 - o.fade / 100 * 0.15)]);
      return out;
    }
    const FN = { bright: 'brightness', contrast: 'contrast', sat: 'saturate', gray: 'grayscale', sepia: 'sepia' };
    const filter = o => ops(o).map(([k, v]) => `${FN[k]}(${+v.toFixed(3)})`).join(' ');
    /** colour washes laid over the photo in «soft light»: [c1, c2, angle] */
    function casts(o) {
      const out = [], a = v => (Math.abs(v) / 100 * 0.7).toFixed(3);
      if (o.warmth > 0) out.push([`rgba(255,150,40,${a(o.warmth)})`, `rgba(255,150,40,${a(o.warmth)})`, 180]);
      if (o.warmth < 0) out.push([`rgba(40,135,255,${a(o.warmth)})`, `rgba(40,135,255,${a(o.warmth)})`, 180]);
      if (o.tint > 0) out.push([`rgba(235,60,200,${a(o.tint)})`, `rgba(235,60,200,${a(o.tint)})`, 180]);
      if (o.tint < 0) out.push([`rgba(60,210,90,${a(o.tint)})`, `rgba(60,210,90,${a(o.tint)})`, 180]);
      const p = PRESETS[o.preset]; if (p && p.ov) out.push(p.ov);
      return out;
    }
    const castCss = o => casts(o).map(([c1, c2, ang]) => `linear-gradient(${ang}deg,${c1},${c2})`).join(',');
    const vigA = o => +(o.vignette / 100 * 0.82).toFixed(3);
    /** the two overlays (colour wash, dark edges) — absolutely over the photo, inside its frame */
    function overlays(o, { compare } = {}) {
      const c = castCss(o), v = vigA(o), hide = compare ? 'opacity:0;' : '';
      return (c ? `<i class="pfx-cast" aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;mix-blend-mode:soft-light;${hide}background:${c}"></i>` : '')
        + (v ? `<i class="pfx-vig" aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;${hide}background:radial-gradient(ellipse at center,rgba(0,0,0,0) 45%,rgba(0,0,0,${v}) 100%)"></i>` : '');
    }
    /**
     * the rotated layer: it covers the frame W×H at any angle (its size = the frame's bounding box turned back).
     * unit: 'cq' (the frame is a size container) or the frame's aspect W/H (sizes in % of the frame).
     */
    function geo(o, ar) {
      const phi = (o.rot + o.fine) * Math.PI / 180, c = Math.abs(Math.cos(phi)), s = Math.abs(Math.sin(phi)), f = x => +x.toFixed(4);
      const wh = ar === 'cq' ? [`calc(100cqw * ${f(c)} + 100cqh * ${f(s)})`, `calc(100cqw * ${f(s)} + 100cqh * ${f(c)})`]
        : [`${f((c + s / ar) * 100)}%`, `${f((s * ar + c) * 100)}%`];
      return `position:absolute;left:50%;top:50%;width:${wh[0]};height:${wh[1]};transform:translate(-50%,-50%) rotate(${f(o.rot + o.fine)}deg)${o.flip ? ' scaleX(-1)' : ''}`;
    }
    const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const still = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
    /** the study card picture with settings: a transparent stand-in keeps the card's own size rules (max-height…) */
    function studyInner(card, o) {
      const swap = o.rot % 180 === 90, has = o.iw > 0 && o.ih > 0;
      const W = has ? (swap ? o.ih : o.iw) : 0, H = has ? (swap ? o.iw : o.ih) : 0;
      const sizer = has ? `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${Math.round(W)}' height='${Math.round(H)}' viewBox='0 0 ${Math.round(W)} ${Math.round(H)}'/%3E` : esc(card.image);
      const z = o.zoom / 100, f = filter(o);
      const img = `position:absolute;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;border-radius:0;box-shadow:none;object-fit:cover;object-position:${o.ox}% ${o.oy}%;transform-origin:${o.ox}% ${o.oy}%${z !== 1 ? `;scale:${z}` : ''}${f ? `;filter:${f}` : ''}`;
      return `<img class="card-img pfx-sizer" src="${sizer}" alt="" aria-hidden="true" style="visibility:hidden">`
        + `<span class="pfx-r" style="${geo(o, has ? W / H : 1.5)};pointer-events:none"><img class="pfx-img" src="${esc(card.image)}" alt="" draggable="false" style="${img}" onerror="var w=this.closest('.card-img-wrap');if(w){w.classList.add('img-broken');w.querySelectorAll('.pfx-r,.pfx-sizer,.pfx-cast,.pfx-vig').forEach(function(x){x.style.display='none'})}"></span>`
        + overlays(o);
    }
    const wrapStyle = () => `overflow:hidden;border-radius:16px;isolation:isolate;box-shadow:0 10px 30px -15px rgba(0,0,0,.6)${still() ? '' : ';animation:imgIn .5s ease both'}`;
    /** art cards: the filter goes into --ac-pf (before the card's own effects); rotation / mirror = a layer around .ac-img */
    const artFilter = o => filter(o);
    const artGeo = o => (plainGeo(o) ? '' : geo(o, 'cq'));
    /* 🎚 the editor: js/photofx.js + css/photofx.css on first use (like «🔎 Лента фото») */
    let loading = null;
    function load() {
      if (window.PhotoFx) return Promise.resolve(window.PhotoFx);
      if (loading) return loading;
      const v = (document.querySelector('script[src*="js/study.js"]') || {}).src || '';
      const q = (v.match(/\?v=[^&]+/) || [''])[0];
      if (!document.querySelector('link[data-photofx]')) {
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = 'css/photofx.css' + q; l.setAttribute('data-photofx', '');
        document.head.appendChild(l);
      }
      loading = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'js/photofx.js' + q; s.async = true;
        s.onload = () => (window.PhotoFx ? res(window.PhotoFx) : rej(new Error('no photofx')));
        s.onerror = () => rej(new Error('no photofx'));
        document.head.appendChild(s);
      });
      loading.catch(() => { loading = null; });
      return loading;
    }
    /** open the editor: PhotoFxCore.open(cardId, { art, ar, onSaved }) or ({ draft: { image, fx, frame }, onApply }) */
    async function open(id, opts) {
      try { const P = await load(); return P.open(id, opts || {}); }
      catch (e) { UI.toast('Настройки фото не открылись — проверьте интернет и попробуйте ещё раз', 'warn'); return null; }
    }
    return { PRESETS, COLOR, clean, plain, plainColor, plainGeo, key, of, ops, filter, casts, castCss, vigA, overlays, geo, studyInner, wrapStyle, artFilter, artGeo, load, open, esc };
  })();
  window.PhotoFxCore = PhotoFxCore;

  const Study = {
    get session() { return S; },

    /** build list of {id, dir} */
    buildQueue({ deckId, filter, dir, size, shuffle, cardIds, dryRun }) {
      const st = Store.settings;
      filter = filter || st.filter; dir = dir || st.direction;
      size = size == null ? st.sessionSize : size;
      shuffle = shuffle == null ? st.shuffle : shuffle;
      let cards = cardIds ? cardIds.map(id => Store.card(id)).filter(Boolean) : Store.cards(deckId);
      const now = Date.now();
      const dirs = dir === 'mix' ? ['nr', 'rn'] : [dir];
      const pickDir = c => {
        if (dir !== 'mix') return dir;
        const due = dirs.filter(d => c.srs[d] && c.srs[d].reps && c.srs[d].due <= now);
        if (due.length) return due[Math.floor(Math.random() * due.length)];
        return Math.random() < 0.5 ? 'nr' : 'rn';
      };
      let items = [];
      const sdir = dir === 'mix' ? null : dir;
      if (filter === 'smart' && !cardIds) {
        const due = cards.filter(c => Store.isDue(c, sdir, now))
          .map(c => ({ c, due: Math.min(...dirs.map(d => (c.srs[d] && c.srs[d].reps) ? c.srs[d].due : Infinity)) }))
          .sort((a, b) => a.due - b.due).map(x => x.c);
        // 🛟 backlog guard: when overdue reviews pile up, new words wait until you catch up (otherwise the pile only grows)
        const paused = Study.backlogPaused(due.length);
        const newLimit = paused ? 0 : Math.max(0, st.newPerDay - Store.newStudiedToday());
        const fresh = cards.filter(c => dirs.every(d => !(c.srs[d] && c.srs[d].reps))).slice(0, newLimit);
        items = (shuffle ? U.shuffle(due) : due).concat(shuffle ? U.shuffle(fresh) : fresh);
      } else {
        if (filter === 'leech') items = cards.filter(c => Store.isLeech(c));
        else if (filter && filter !== 'all' && filter !== 'smart') items = cards.filter(c => Store.status(c, sdir) === filter);
        else items = cards.slice();
        if (shuffle) items = U.shuffle(items);
      }
      if (size) items = items.slice(0, size);
      if (dryRun) return items;
      return items.map(c => ({ id: c.id, dir: pickDir(c) }));
    },

    /** how many overdue reviews mean «stop adding new words for now» (setting backlogGuard, default on) */
    backlogLimit() { const st = Store.settings; return Math.max(50, (st.newPerDay || 20) * 5); },
    backlogPaused(dueCount) { return Store.settings.backlogGuard !== false && dueCount > this.backlogLimit(); },

    start(opts = {}) {
      const st = Store.settings;
      const o = Object.assign({ mode: st.mode, dir: st.direction, filter: st.filter, size: st.sessionSize, shuffle: st.shuffle }, opts);
      let queue = this.buildQueue(o);
      if (!queue.length && o.filter === 'smart') {
        queue = this.buildQueue(Object.assign({}, o, { filter: 'all' }));
        if (queue.length) UI.toast('На сегодня всё повторено 🎉 Запускаю повторение всех карт.', 'good', 4000);
      }
      if (!queue.length) { UI.toast('Нет карточек для изучения', 'warn'); return; }
      if (o.mode === 'listen') queue.forEach(q => { q.dir = 'nr'; });
      S = {
        opts: o, mode: o.mode, deckId: o.deckId, queue, total: queue.length, done: 0, known: 0, unknown: 0,
        allIds: [...new Set(queue.map(q => q.id))], // every card of this session (for «🗂 Все карты»)
        first: new Map(), unknownIds: new Set(), history: [], startedAt: Date.now(), flipped: false, locked: false,
      };
      App.go('study');
    },

    render(root) {
      if (!S) { App.go('home'); return; }
      root.innerHTML = `<div class="study" data-layout="${Store.settings.studyLayout || 'auto'}">
        <div class="study-top">
          <button class="top-btn" data-act="exit" title="Завершить сессию (Esc)">${UI.icon('close', 18)}</button>
          <button class="top-btn home-btn study-home" data-home aria-label="На главный экран" data-tip="На главный экран">${UI.HOME_SVG(18)}</button>
          <div class="progress lg"><div class="fill" data-progress></div><div class="label" data-plabel></div></div>
          ${S.mode === 'listen' ? '' : `<div class="dir-switch" title="Направление: что на лицевой стороне">
            ${[['nr', this.dirMark('nr'), 'Норвежское слово → вспомнить перевод'], ['rn', this.dirMark('rn'), 'Перевод → вспомнить норвежское слово'], ['mix', NI('sort'), 'Вперемешку']].map(([v, l, t]) =>
              `<button class="${(S.opts.dir || 'nr') === v ? 'active' : ''}" data-act="dir" data-dir="${v}" title="${t}">${l}</button>`).join('')}</div>`}
          <button class="top-btn hints-btn ${Store.settings.hints === false ? 'off' : ''}" data-act="hints" title="Подсказки на лицевой стороне (картинка, часть речи, значки)">${UI.icon(Store.settings.hints === false ? 'bulbOff' : 'bulb', 18)}<span>Подсказки</span></button>
          <button class="top-btn layout-btn" data-act="layout" title="Расположение кнопок">${UI.icon('layout', 18)}<span>Раскладка</span></button>
          <button class="top-btn" data-act="undo" title="Отменить последний ответ (Z)">${UI.icon('undo', 18)}<span>Отменить</span></button>
        </div>
        <div class="session-tools">
          <button class="btn sm" data-act="all-cards" title="Быстро посмотреть все карты этой сессии и перейти к любой">${NI('cards')}<span>Все карты · ${S.allIds.length}</span></button>
          <button class="btn sm" data-act="reshuffle" title="Перемешать оставшиеся карты">${NI('sort')}<span>Перемешать</span></button>
          ${S.mode === 'listen' ? '' : this.trSegHtml('study-trseg')}
          ${window.ArtCards ? ArtCards.studyToggleHtml(S) : ''}
        </div>
        <div class="counters"><span class="k" data-k>✓ 0</span><span class="u" data-u>✗ 0</span><span class="r" data-r></span></div>
        <div data-area></div>
      </div>`;
      root.onclick = e => this.onClick(e);
      this.next(true);
    },

    updateTop() {
      const root = document.getElementById('view');
      const pct = S.total ? Math.round(S.done / S.total * 100) : 0;
      const f = root.querySelector('[data-progress]'); if (!f) return;
      f.style.width = pct + '%';
      root.querySelector('[data-plabel]').textContent = `${S.done} / ${S.total} · ${pct}%`;
      const k = root.querySelector('[data-k]'), u = root.querySelector('[data-u]');
      const bump = (el, txt) => { if (el.textContent === txt) return; el.textContent = txt; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
      bump(k, `✓ ${S.known} знаю`);
      bump(u, `✗ ${S.unknown} не знаю`);
      root.querySelector('[data-r]').textContent = `осталось ${S.queue.length}`;
    },

    current() { return S && S.queue[0] ? { item: S.queue[0], card: Store.card(S.queue[0].id) } : null; },
    /** show this card now (from «🗂 Все карты»); an already answered card comes back once more */
    jumpTo(cardId) {
      if (!S) return;
      const k = S.queue.findIndex(q => q.id === cardId);
      if (k === 0) return;
      if (k > 0) S.queue.unshift(S.queue.splice(k, 1)[0]);
      else { const d = S.opts.dir === 'rn' ? 'rn' : 'nr'; S.queue.unshift({ id: cardId, dir: d }); S.total++; }
      S.flipped = false; S.locked = false; S.answeredType = null; S.quizDone = false;
      this.updateTop();
      this.renderCard(true);
    },

    next(first) {
      // skip deleted cards
      while (S.queue.length && !Store.card(S.queue[0].id)) { S.queue.shift(); S.done++; }
      this.updateTop();
      if (!S.queue.length) return this.finish();
      S.flipped = false; S.locked = false; S.answeredType = null; S.quizDone = false;
      this.renderCard(true);
    },

    /* ---------- card rendering ---------- */
    faceText(card, side) { return side === 'no' ? card.no : this.tr(card); },
    wordHtml(text, lang) {
      const len = String(text || '').length;
      // one sentence (a subtitle line, an example) stays centred and big; only real multi-line texts are laid out as text
      const cls = this.isText(text) ? 'long' : len > 60 ? 'sentence' : len > 26 ? 'medium' : '';
      return `<div class="word ${cls}"${lang ? ` lang="${lang}"` : ''}>${UI.rich(text)}</div>`;
    },

    /* ---------- 🇷🇺 / 🇺🇦 the translation language (Settings → «Язык перевода» · Store.settings.transLang: ru | uk | both) ---------- */
    trFlag(l) { l = l || this.trLang(); return l === 'uk' ? '🇺🇦' : l === 'both' ? '🇷🇺🇺🇦' : '🇷🇺'; },
    /** «по-русски» / «по-украински» / «по-русски или по-украински» — for hints and placeholders */
    trWords(l) { l = l || this.trLang(); return l === 'uk' ? 'по-украински' : l === 'both' ? 'по-русски или по-украински' : 'по-русски'; },
    ukOf(card) { return String((card && card.uk) || '').trim(); },
    /** the card's translation as plain text in the chosen language; 🇺🇦 without a Ukrainian translation → the Russian one */
    tr(card, lang) {
      const l = lang || this.trLang(), ru = String((card && card.ru) || ''), uk = this.ukOf(card);
      if (l === 'uk') return uk || ru;
      if (l === 'both' && uk && uk !== ru.trim()) return ru.includes('\n') || uk.includes('\n') ? `${ru}\n\n${uk}` : `${ru} / ${uk}`;
      return ru;
    },
    /** 🇺🇦 is chosen, but this card has only the Russian translation (it is shown with a small 🇷🇺 mark) */
    trRuOnly(card) { return this.trLang() === 'uk' && !this.ukOf(card) && !!String(card.ru || '').trim(); },
    /** every accepted translation: the chosen language first (typed answers are accepted in Russian AND Ukrainian) */
    trAnswers(card) { const ru = String(card.ru || ''), uk = this.ukOf(card); return (this.trLang() === 'uk' ? [uk, ru] : [ru, uk]).filter(Boolean); },
    trFbHtml() { return '<div class="tr-fb" title="У этой карточки пока нет украинского перевода — показан русский. Добавить: ✏️ Редактировать → 🇺🇦 Українською">🇷🇺 <span>по-русски — украинского перевода пока нет</span></div>'; },
    /** the translation side of the card: big text in the chosen language (both: Russian + 🇺🇦 Ukrainian under it) */
    trHtml(card) {
      const l = this.trLang(), ru = String(card.ru || ''), uk = this.ukOf(card);
      if (l === 'uk') return uk ? this.wordHtml(uk, 'uk') : this.wordHtml(ru, 'ru') + (ru.trim() ? this.trFbHtml() : '');
      if (l === 'both' && uk && uk !== ru.trim()) return `${this.wordHtml(ru, 'ru')}<div class="tr-second" lang="uk"><span class="tr-flag" aria-label="Українською">🇺🇦</span> ${UI.rich(uk)}</div>`;
      return this.wordHtml(ru, 'ru');
    },
    /** the language tag of the translation side: «🇷🇺 РУССКИЙ» · «🇺🇦 УКРАЇНСЬКА» · both */
    trTag(card) {
      const l = this.trLang();
      if (l === 'uk' && !this.trRuOnly(card)) return '🇺🇦 УКРАЇНСЬКА';
      if (l === 'both' && this.ukOf(card)) return '<span class="lt-both">🇷🇺<span class="lt-w"> РУССКИЙ</span> + 🇺🇦<span class="lt-w"> УКРАЇНСЬКА</span></span>';
      return '🇷🇺 РУССКИЙ';
    },
    /** W7: «NO → RU» with drawn language marks (the direction switch of the session) */
    dirMark(d) {
      const LM = l => (window.Voices && Voices.langMark ? Voices.langMark(l) : l.toUpperCase());
      const tr = this.trLang() === 'uk' ? LM('uk') : this.trLang() === 'both' ? LM('ru') + LM('uk') : LM('ru');
      return d === 'rn' ? `${tr}<span aria-hidden="true">→</span>${LM('no')}` : `${LM('no')}<span aria-hidden="true">→</span>${tr}`;
    },
    /** the small 🇷🇺 · 🇺🇦 · 🇷🇺+🇺🇦 switch (study session, launcher) */
    trSegHtml(cls = '') {
      const cur = this.trLang();
      const LM = l => (window.Voices && Voices.langMark ? Voices.langMark(l) : l.toUpperCase()); // W7: drawn language marks, no flags
      if (window.Voices && Voices.ensureCss) { try { Voices.ensureCss(); } catch (e) { /* plain letters */ } }
      return `<div class="seg-mini tr-seg ${cls}" role="group" aria-label="Язык перевода">${[['ru', `${LM('ru')} Русский`, 'Перевод на русский'], ['uk', `${LM('uk')} Українська`, 'Перевод на украинский (если у карточки его нет — показан русский с пометкой RU)'], ['both', `${LM('ru')}${LM('uk')} Оба`, 'Оба перевода: русский и украинский']].map(([v, l, t]) =>
        `<button type="button" class="${cur === v ? 'active' : ''}" data-act="trlang" data-v="${v}" aria-pressed="${cur === v}" title="${t}">${l}</button>`).join('')}</div>`;
    },
    /** a text (several lines, or longer than a couple of sentences) — not a single word / phrase / sentence */
    isText(text) { const s = String(text || ''); return s.includes('\n') || s.length > 200; },

    /* =====================================================================
     * 📄 TEXT CARDS: four views of a long text (Store.settings.textView: word | sent | para | full) and
     * ⏯ the reading controls right on the card (⏮ ⏪ ⏯ ⏩ ⏹ — shown while the card is read aloud).
     * The card itself is never changed: «По словам» shows «Jeg (Я) går (иду) …» exactly as before; the other views use
     * the text without the (glosses) and the card's own translation when it is a whole text that matches sentence by
     * sentence / paragraph by paragraph — otherwise the translator chain (cache 's:', so it is done once).
     * The word being read lights up (CSS Custom Highlight `tv-say`), the sentence / paragraph gets a soft frame.
     * Styles: css/studyx.css, loaded on first use with the same ?v= as this file.
     * ===================================================================== */
    TVM: [['word', 'По словам', 'Слова', 'Каждое норвежское слово — и сразу его перевод'],
      ['sent', 'По предложениям', 'Предложения', 'Норвежское предложение, под ним — перевод'],
      ['para', 'По абзацам', 'Абзацы', 'Норвежский абзац, под ним — перевод'],
      ['full', 'Полностью', 'Целиком', 'Весь норвежский текст, потом весь перевод']],
    tvMode() { const v = Store.settings.textView; return ['word', 'sent', 'para', 'full'].includes(v) ? v : 'word'; },
    tvCss() {
      if (this._tvCss) return;
      this._tvCss = true;
      if (document.querySelector('link[data-studyx]')) return;
      const v = (document.querySelector('script[src*="js/study.js"]') || {}).src || '';
      const q = (v.match(/\?v=[^&]+/) || [''])[0];
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.href = 'css/studyx.css' + q; l.setAttribute('data-studyx', '');
      document.head.appendChild(l);
    },
    /** «Jeg (Я) går (иду) til (к) badet (ванной).» → «Jeg går til badet.» (only brackets with Cyrillic in them go) */
    tvClean(s) {
      return String(s || '').replace(/\s*\([^()]*[Ѐ-ӿ][^()]*\)/g, '').replace(/\*\*|__/g, '').replace(/[ \t ]+/g, ' ')
        .replace(/ ([,.!?;:…»”)])/g, '$1').replace(/([«„“(]) /g, '$1').trim();
    },
    /** paragraphs: blank lines between them; a text without blank lines — every line is one */
    tvParas(s) {
      const t = String(s || '').replace(/\r/g, '').trim();
      let ps = t.split(/\n[ \t]*\n+/);
      if (ps.length < 2 && t.includes('\n')) ps = t.split(/\n+/);
      return ps.map(x => x.replace(/\s*\n\s*/g, ' ').trim()).filter(x => /\p{L}/u.test(x) && !this.isSrcLine(x));
    },
    /** the card's text in pieces: paragraphs → sentences (clean Norwegian) + the card's own translation, when it fits */
    tvData(card) {
      const tl = this.trLang(), uk = this.ukOf(card), ru = String(card.ru || '');
      const key = [card.no, ru, uk, tl].join('\u0001');
      const m = this._tvd || (this._tvd = new Map());
      if (m.has(key)) return m.get(key);
      const paras = this.tvParas(card.no).map(p => { const no = this.tvClean(p); return { no, sents: this.splitSent(no).filter(s => /\p{L}/u.test(s)) }; }).filter(p => p.sents.length);
      const nSent = paras.reduce((n, p) => n + p.sents.length, 0), noLen = paras.reduce((n, p) => n + p.no.length, 0);
      const own = (tl === 'uk' ? uk || ru : ru).trim();
      // the card's own translation counts only when it is a whole text (not a title or a word)
      const full = !!own && own.length >= noLen * 0.35 && U.cyrRatio(own) > 0.5 && this.splitSent(own).length >= Math.min(2, nSent);
      const ownParas = full ? this.tvParas(own) : [];
      let rParas = full ? ownParas.slice() : null, sentRu = null;
      if (full) {
        const per = rParas.length === paras.length ? rParas.map(r => this.splitSent(r)) : null;
        if (per && per.every((rs, i) => rs.length === paras[i].sents.length)) sentRu = [].concat(...per);
        else { const all = this.splitSent(rParas.join(' ')); if (all.length === nSent) sentRu = all; }
        if (rParas.length !== paras.length) {
          let k = 0;
          rParas = sentRu ? paras.map(p => { const r = sentRu.slice(k, k + p.sents.length).join(' '); k += p.sents.length; return r; }) : null;
        }
      }
      const d = { paras, nSent, noLen, glossed: /\([^()]*[Ѐ-ӿ][^()]*\)/.test(String(card.no || '')), full, ownParas, rParas, sentRu,
        lang: full ? (tl === 'uk' && uk ? 'uk' : 'ru') : (tl === 'uk' ? 'uk' : 'ru') };
      if (m.size > 40) m.clear();
      m.set(key, d);
      return d;
    },
    /** a text card: a long text of two sentences or more (an imported text with word glosses, a story, a dialogue) */
    tvOn(card) {
      if (!card || !this.isText(card.no)) return false;
      const d = this.tvData(card);
      return d.nSent >= 2 && (d.glossed || d.noLen >= 120);
    },
    /** this face of the study card shows the views: the back always, the front when it is the Norwegian side
     *  (the art view, listening, typing and the quiz stay exactly as they are) */
    tvFaceOn(card, back, item) {
      if (!S || S.mode === 'listen' || !this.tvOn(card) || (window.ArtCards && ArtCards.studyOn && ArtCards.studyOn(S))) return false;
      return back || ((item || {}).dir === 'nr' && S.mode === 'flip');
    },
    /** machine translation of one sentence into the view's language: text · undefined = not (yet) there */
    tvMt(s, lang) {
      if (lang === 'uk') { const v = this.exCache()['s:uk:' + s]; return v !== undefined ? v : Translators.cached(s, 'no', 'uk'); }
      return this.sentTr(s);
    },
    /** this sentence was already sent to the translator (into this language) in this session */
    tvTried(s, lang) { return !!(this._tvTried && this._tvTried.has(lang + '|' + s)); },
    tvSentRu(d, j, s) { return d.sentRu ? d.sentRu[j] : this.tvMt(s, d.lang); },
    tvParaRu(d, i) {
      if (d.rParas) return d.rParas[i];
      let k = 0;
      for (let q = 0; q < i; q++) k += d.paras[q].sents.length;
      const parts = d.paras[i].sents.map((s, x) => this.tvSentRu(d, k + x, s));
      if (parts.some((t, x) => t === undefined && !this.tvTried(d.paras[i].sents[x], d.lang))) return undefined;
      return parts.filter(Boolean).join(' ');
    },
    /** sentences this view still needs from the translator */
    tvNeed(card, v) {
      const d = this.tvData(card);
      if (v === 'word' || d.sentRu || (v === 'full' && d.full) || (v === 'para' && d.rParas)) return [];
      const out = [];
      d.paras.forEach(p => p.sents.forEach(s => { if (this.tvMt(s, d.lang) === undefined) out.push(s); }));
      return out;
    },
    /** the view uses the translator (→ the «кто переводит» badge next to the switch) */
    tvUsesMt(card, v) { const d = this.tvData(card); return v !== 'word' && !d.sentRu && !(v === 'full' && d.full) && !(v === 'para' && d.rParas); },
    tvHtml(card, face) {
      const v = this.tvMode(), d = this.tvData(card), esc = U.esc;
      const flag = d.lang === 'uk' ? '🇺🇦 Українська' : '🇷🇺 Русский';
      let miss = false;
      const ruBox = (t, sents, lines, cls = 'tv-ru', attrs = '') => {
        if (t) return `<div class="${cls}" lang="${d.lang}" ${attrs}>${esc(t)}</div>`;
        if (t === '' || sents.every(s => this.tvTried(s, d.lang))) { miss = true; return `<div class="${cls} tv-miss">перевод не пришёл</div>`; }
        return `<div class="${cls} tv-wait" role="status" aria-label="Перевожу…">${'<span class="tv-shim"></span>'.repeat(lines)}</div>`;
      };
      let body = '', j = 0;
      if (v === 'word') {
        const tr = this.tr(card).trim();
        const wf = this.trLang() === 'uk' && !this.trRuOnly(card) ? '🇺🇦 Українська' : this.trLang() === 'both' && this.ukOf(card) ? '🇷🇺 Русский · 🇺🇦 Українська' : '🇷🇺 Русский';
        body = this.wordHtml(card.no) + (face === 'back' && tr ? `<div class="tv-h">${wf}</div>${this.trHtml(card)}` : '');
      } else if (v === 'sent') {
        body = d.paras.map(p => `<div class="tv-para">${p.sents.map(s => { const k = j++; return `<div class="tv-pair" data-tvb><div class="tv-no" lang="nb">${esc(s)}</div>${ruBox(this.tvSentRu(d, k, s), [s], 1)}</div>`; }).join('')}</div>`).join('');
      } else if (v === 'para') {
        body = d.paras.map((p, i) => `<div class="tv-pair tv-pp" data-tvb><div class="tv-no" lang="nb">${esc(p.no)}</div>${ruBox(this.tvParaRu(d, i), p.sents, Math.min(4, p.sents.length))}</div>`).join('');
      } else {
        const ru = d.full ? d.ownParas.map(t => `<div class="tv-p tv-ru" lang="${d.lang}" data-tvb>${esc(t)}</div>`).join('')
          : d.paras.map((p, i) => ruBox(this.tvParaRu(d, i), p.sents, Math.min(4, p.sents.length), 'tv-p tv-ru', 'data-tvb')).join('');
        body = `<div class="tv-h">🇳🇴 Norsk</div><div class="tv-blk">${d.paras.map(p => `<div class="tv-p tv-no" lang="nb" data-tvb>${esc(p.no)}</div>`).join('')}</div>
          <div class="tv-h">${flag}</div><div class="tv-blk">${ru}</div>`;
      }
      const bar = `<div class="tv-top"><div class="seg-mini tv-bar" role="group" aria-label="Как показать текст">${this.TVM.map(([id, l, sh, t]) =>
        `<button type="button" class="${v === id ? 'active' : ''}" data-act="tv" data-v="${id}" aria-pressed="${v === id}" aria-label="${l}" title="${t}"><span class="tv-l">${l}</span><span class="tv-s" aria-hidden="true">${sh}</span></button>`).join('')}</div>`
        + `${miss ? '<button type="button" class="btn sm tv-retry" data-act="tv-retry" title="Перевод не пришёл — попробовать ещё раз">🔄 Перевести ещё раз</button>' : ''}<span class="tv-trb" data-tv-trb></span></div>`;
      return `<div class="tv tv-${v}" data-tv="${face}" data-cid="${esc(card.id)}">${bar}<div class="tv-body">${body}</div></div>`;
    },
    /** what is read aloud from a face in the chosen view (sentences on lines of their own: ⏪ / ⏩ step by sentence) */
    tvReadText(card, face) {
      const v = this.tvMode(), d = this.tvData(card);
      if (v === 'word') return face === 'front' ? String(card.no || '') : [card.no, this.tr(card)].filter(Boolean).join('\n');
      const lines = [], ruS = t => this.splitSent(t);
      let j = 0;
      if (v === 'sent') d.paras.forEach(p => p.sents.forEach(s => { const r = this.tvSentRu(d, j++, s); lines.push(s); if (r) lines.push(r); }));
      else if (v === 'para') d.paras.forEach((p, i) => { lines.push(...p.sents); const r = this.tvParaRu(d, i); if (r) lines.push(...ruS(r)); });
      else {
        d.paras.forEach(p => lines.push(...p.sents));
        (d.full ? d.ownParas : d.paras.map((p, i) => this.tvParaRu(d, i) || '')).forEach(t => { if (t) lines.push(...ruS(t)); });
      }
      return lines.join('\n');
    },
    /** after the card is drawn: the translation the view needs (once), the «кто переводит» badge, the reading controls */
    tvAfter(card) {
      const area = document.querySelector('[data-area]');
      if (!area || !card) return;
      this.tvpPlace();
      if (!area.querySelector('[data-tv]')) return;
      const v = this.tvMode();
      this.tvBadge(card);
      area.querySelectorAll('.face').forEach(f => {
        if (f._tvUser) return;
        f._tvUser = 1;
        const mark = () => { f._tvUser = Date.now(); };
        f.addEventListener('wheel', mark, { passive: true }); f.addEventListener('touchmove', mark, { passive: true });
      });
      const lang = this.tvData(card).lang;
      const fresh = this.tvNeed(card, v).filter(s => !this.tvTried(s, lang));
      if (fresh.length) this.tvFill(card, fresh);
    },
    tvBadge(card) {
      if (!window.TrBadge) return;
      (this._tvHosts || []).forEach(h => { if (!h.isConnected) try { TrBadge.unmount(h); } catch (e) { /* gone */ } });
      this._tvHosts = (this._tvHosts || []).filter(h => h.isConnected);
      if (!this.tvUsesMt(card, this.tvMode())) return;
      document.querySelectorAll('[data-area] [data-tv-trb]').forEach(el => {
        try { TrBadge.mount(el, { place: 'study' }); if (!this._tvHosts.includes(el)) this._tvHosts.push(el); } catch (e) { /* the badge is extra */ }
      });
    },
    /** translate the sentences of the view (shimmer meanwhile; lines appear as they come) */
    async tvFill(card, sents) {
      if (this._tvBusy) { this._tvAgain = true; return; }
      this._tvBusy = true;
      const d = this.tvData(card), id = card.id;
      let t = null;
      const own = !Translators.onPut;
      if (own) Translators.onPut = () => { if (t) return; t = setTimeout(() => { t = null; this.tvRedraw(id); }, 450); };
      try {
        if (d.lang === 'uk') {
          const res = await Translators.translateMany(sents, 'no', 'uk', { quiet: true });
          const c = this.exCache();
          sents.forEach((s, i) => { if (res && res.out && res.out[i]) c['s:uk:' + s] = String(res.out[i]).trim(); });
          this.exSave();
        } else await this.translateUnits(sents, [], { quiet: true });
      } catch (e) { console.warn('text view: translation', e); }
      finally {
        if (own) Translators.onPut = null;
        clearTimeout(t);
        this._tvBusy = false;
      }
      const T = this._tvTried || (this._tvTried = new Set());
      sents.forEach(s => T.add(d.lang + '|' + s));
      this.tvRedraw(id);
      if (this._tvAgain) {
        this._tvAgain = false;
        const cur = this.current(), c2 = cur && (Store.card(cur.card.id) || cur.card);
        if (c2 && document.querySelector('[data-area] [data-tv]')) { const l2 = this.tvData(c2).lang, more = this.tvNeed(c2, this.tvMode()).filter(s => !this.tvTried(s, l2)); if (more.length) this.tvFill(c2, more); }
      }
    },
    /** the views on the card drawn again (a translation came, another view) — the scroll place stays */
    tvRedraw(cardId) {
      const cur = S && this.current();
      if (!cur || cur.card.id !== cardId) return;
      const card = Store.card(cardId) || cur.card;
      document.querySelectorAll('[data-area] [data-tv]').forEach(el => {
        const f = el.closest('.face'), top = f ? f.scrollTop : 0;
        const tmp = document.createElement('div');
        tmp.innerHTML = this.tvHtml(card, el.dataset.tv);
        el.replaceWith(tmp.firstElementChild);
        if (f) f.scrollTop = top;
      });
      this.tvBadge(card);
      if (TTS.state() !== 'idle') this.tvPaint(this._tvWi);
    },

    /* ---------- ⏯ reading: which piece is said now, the word lit up, ⏪ / ⏩ by sentence ---------- */
    /** read one face of the current card (karaoke on a text view; frac: start at about this part of the text) */
    readSide(back, mode, opts = {}, frac = 0) {
      const cur = this.current();
      if (!cur) return;
      const text = this.sideText(cur, back);
      const tv = this.tvFaceOn(cur.card, back, cur.item);
      const who = tv ? { face: back ? 'back' : 'front', cid: cur.card.id, view: this.tvMode() } : null;
      if (tv) opts = Object.assign({}, opts, { onWord: (i, a, b, info) => this.tvWord(i, info) });
      if (!frac) { this._tvNext = who; TTS.speakText(text, mode, opts); if (this._tvNext === who) this._tvNext = null; return; }
      opts = TTS.placed(opts);
      const segs = TTS.segments(text, mode);
      if (!segs.length) return;
      const F = Object.assign({ segs, last: { text, mode, opts } }, who || { face: '', cid: '', view: '' });
      const want = Math.min(segs.length - 1, Math.floor(frac * segs.length));
      const st = this.tvStarts(F);
      this.tvPlayFrom(F, [...st].reverse().find(k => k <= want) || 0);
    },
    /** index of the piece being read in the whole reading (⏪ / ⏩ restart the voice at a later piece) */
    tvG() { const p = TTS.player; return p ? (this._tvSeek && this._tvSeek.p === p ? this._tvSeek.off : 0) + p.i : -1; },
    tvRoot(F) { return F && F.face ? document.querySelector(`[data-area] [data-tv="${F.face}"][data-cid="${CSS.escape(F.cid)}"]`) : null; },
    /** the words of every piece found in the text on the face (in order) → [start, end] in the face's flat text */
    tvMap(root, F) {
      const c = this._tvm;
      if (c && c.root === root && c.F === F) return c;
      const parts = [];
      let flat = '', blk = null;
      const skip = '.tv-top, .tv-h, .tv-miss, .tv-wait, button';
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement && n.parentElement.closest(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const b = n.parentElement.closest('[data-tvb], .tv-no, .tv-ru, .word') || root;
        if (b !== blk) { flat += '\n'; blk = b; }
        parts.push({ n, a: flat.length });
        flat += n.data;
      }
      const low = flat.toLowerCase(), isW = ch => !!ch && /[\p{L}\p{N}]/u.test(ch);
      let cur = 0;
      const segs = F.segs.map(s => {
        const ws = TTS.wordsOf(s.text), win = cur + Math.max(240, s.text.length * 2 + 80), words = [];
        let c0, hit;
        const find = (lim, need) => {
          c0 = cur; hit = 0; words.length = 0;
          ws.forEach(x => {
            const q = x.w.toLowerCase();
            let i = low.indexOf(q, c0);
            while (i >= 0 && i < lim && (isW(low[i - 1]) || isW(low[i + q.length]))) i = low.indexOf(q, i + 1);
            if (i >= 0 && i < lim) { words.push([i, i + q.length]); c0 = i + q.length; hit++; } else words.push(null);
          });
          return ws.length && hit >= Math.max(1, ws.length * need);
        };
        // near the last piece first; then further on (only the translation is read: the Norwegian block is skipped)
        if (!find(win, 0.5) && !(ws.length >= 2 && find(Infinity, 0.8))) return null;
        cur = c0;
        const f = words.find(Boolean), l = [...words].reverse().find(Boolean);
        return { s: f[0], e: l[1], words };
      });
      return (this._tvm = { root, F, parts, flat, segs });
    },
    tvPos(map, x) {
      const ps = map.parts;
      let lo = 0, hi = ps.length - 1;
      while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ps[m].a <= x) lo = m; else hi = m - 1; }
      const p = ps[lo];
      return p ? [p.n, Math.max(0, Math.min(p.n.data.length, x - p.a))] : null;
    },
    /** where a sentence begins (⏪ / ⏩): after . ! ? … — in «По словам» found in the text itself (the glosses hide the dots) */
    tvStarts(F) {
      if (!F) return [];
      const root = this.tvRoot(F), map = root ? this.tvMap(root, F) : null;
      if (F._st && F._stRoot === root) return F._st;
      const out = [];
      F.segs.forEach((s, k) => {
        // «По предложениям»: a sentence and its translation are one step
        if (k && F.view === 'sent' && s.lang !== 'no' && F.segs[k - 1].lang === 'no') return;
        if (!k || /[.!?…:]["»”)]?\s*$/.test(F.segs[k - 1].text)) { out.push(k); return; }
        const a = map && map.segs[k - 1], b = map && map.segs[k];
        if (!a || !b || /[.!?…\n]/.test(map.flat.slice(a.e, b.s))) out.push(k);
      });
      F._st = out; F._stRoot = root;
      return out;
    },
    tvHl() {
      if (this._tvHl !== undefined) return this._tvHl;
      try { if (window.CSS && CSS.highlights && typeof window.Highlight === 'function') { const h = new Highlight(); CSS.highlights.set('tv-say', h); return (this._tvHl = h); } } catch (e) { /* old browser: the frame only */ }
      return (this._tvHl = null);
    },
    tvKarClear() {
      const h = this.tvHl();
      if (h) try { h.clear(); } catch (e) { /* ignore */ }
      document.querySelectorAll('[data-area] .tv-now').forEach(x => x.classList.remove('tv-now'));
    },
    tvWord(i, info) {
      if (info && info.done) { this.tvPaint(-1); return; }
      this._tvWi = i;
      this.tvPaint(i);
    },
    /** light the piece being read (frame) and word i of it; the face follows the voice unless you scroll it yourself */
    tvPaint(i) {
      const F = this._tvFull, root = F && TTS.player && this.tvRoot(F);
      if (!root) { this.tvKarClear(); return; }
      const map = this.tvMap(root, F), m = map.segs[this.tvG()];
      const at = m && this.tvPos(map, m.s);
      const u = at && at[0].parentElement && at[0].parentElement.closest('[data-tvb]');
      root.querySelectorAll('.tv-now').forEach(x => { if (x !== u) x.classList.remove('tv-now'); });
      if (u) u.classList.add('tv-now');
      const h = this.tvHl();
      if (h) try { h.clear(); } catch (e) { /* ignore */ }
      const w = m && i != null && i >= 0 ? m.words[i] : null;
      let rect = null;
      if (w && h) {
        const a = this.tvPos(map, w[0]), b = this.tvPos(map, w[1]);
        try { const r = document.createRange(); r.setStart(a[0], a[1]); r.setEnd(b[0], b[1]); h.add(r); rect = r.getBoundingClientRect(); } catch (e) { rect = null; }
      }
      if (!rect && u) rect = u.getBoundingClientRect();
      const face = root.closest('.face');
      if (!rect || !face || !rect.height || Date.now() - (face._tvUser || 0) < 4000) return;
      const fr = face.getBoundingClientRect();
      if (rect.top >= fr.top + 36 && rect.bottom <= fr.bottom - 80) return;
      const top = Math.max(0, face.scrollTop + rect.top - fr.top - fr.height * 0.3);
      try { face.scrollTo({ top, behavior: TTS.motionOk && TTS.motionOk() ? 'smooth' : 'auto' }); } catch (e) { face.scrollTop = top; }
    },
    /** ⏪ (dir −1) / ⏩ (dir 1): the start of this / the previous / the next sentence */
    tvJump(dir) {
      const F = this._tvFull;
      if (!F || !TTS.player) return;
      const g = this.tvG(), st = this.tvStarts(F);
      let t;
      if (dir > 0) t = st.find(k => k > g);
      else {
        const here = [...st].reverse().find(k => k <= g);
        t = here === undefined ? 0 : g === here && (this._tvWi || 0) < 2 ? [...st].reverse().find(k => k < here) : here;
        if (t === undefined) t = 0;
      }
      if (t === undefined) return;
      this.tvPlayFrom(F, t);
    },
    /** say the reading from piece t on (⏮ «Сначала» still starts at the very beginning) */
    tvPlayFrom(F, t) {
      t = Math.max(0, Math.min(F.segs.length - 1, t | 0));
      this._tvSeeking = true;
      // 🎭 a dialogue keeps its speakers (and their voices) when the reading goes on from the middle
      const rest = F.segs.slice(t), roster = [];
      F.segs.forEach(s => { if (s.who != null && !roster.includes(s.who)) roster.push(s.who); });
      const ro = roster.length ? Object.assign({}, F.last.opts, { roleWho: rest.map(s => (s.who != null ? s.who : null)), roleRoster: roster }) : F.last.opts;
      try { TTS.speakText(rest.map(s => s.text).join('\n'), 'all', ro); } finally { this._tvSeeking = false; }
      if (!TTS.player) { this.tvState(); return; }
      TTS.last = F.last;
      this._tvFull = F; this._tvSeek = { p: TTS.player, off: t }; this._tvP = TTS.player; this._tvWi = 0; this._tvG0 = -1;
      this.tvState();
    },
    /** the player changed (tts-state): a new reading, the next piece, pause, the end */
    tvState() {
      if (this._tvSeeking) return;
      const p = TTS.player, st = TTS.state();
      if (p && p !== this._tvP) {
        this._tvP = p;
        if (!(this._tvSeek && this._tvSeek.p === p)) {
          const nx = this._tvNext, prev = this._tvFull;
          this._tvNext = null;
          const again = !nx && prev && TTS.last && prev.last && TTS.last.text === prev.last.text; // ⏮ «Сначала»
          const from = nx || (again ? prev : { face: '', cid: '', view: '' });
          this._tvFull = { segs: p.segs, last: TTS.last, face: from.face, cid: from.cid, view: from.view };
          this._tvSeek = null; this._tvG0 = -1;
        }
      }
      const box = document.querySelector('[data-area] [data-tvp]');
      const on = st !== 'idle' && !!p;
      if (box) {
        const was = box.classList.contains('on');
        box.classList.toggle('on', on);
        const t = box.querySelector('[data-act="tts-toggle"]');
        if (t) t.setAttribute('aria-label', st === 'paused' ? 'Продолжить' : 'Пауза');
        const g = this.tvG(), sts = on ? this.tvStarts(this._tvFull) : [];
        const pv = box.querySelector('[data-act="tv-prev"]'), nx = box.querySelector('[data-act="tv-next"]');
        if (pv) pv.disabled = !on;
        if (nx) nx.disabled = !on || !sts.some(k => k > g);
        if (was !== on || on) this.tvpPlace();
      }
      if (!on) { this.tvKarClear(); this._tvP = null; return; }
      const g = this.tvG();
      if (g !== this._tvG0) { this._tvG0 = g; this._tvWi = 0; this.tvPaint(-1); }
    },
    /** ⏮ ⏪ ⏯ ⏩ ⏹ inside the card (not inside a face: it never scrolls away and never turns over with the card) */
    tvpHtml() {
      const b = (act, ic, label, cls = '') => `<button type="button" class="media-btn ${cls}" data-act="${act}" aria-label="${label}" title="${label}">${ic}</button>`;
      const svg = d => `<svg class="ico" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`;
      return `<div class="tvp" data-tvp data-tts-ctl role="group" aria-label="Чтение вслух">
        ${b('tts-restart', UI.icon('restart', 18), 'Сначала')}
        ${b('tv-prev', svg('M11.5 18.5 3.5 12l8-6.5zM20.5 18.5 12.5 12l8-6.5z'), 'Предыдущее предложение')}
        ${b('tts-toggle', UI.icon('pause', 22), 'Пауза', 'main')}
        ${b('tv-next', svg('M12.5 18.5 20.5 12l-8-6.5zM3.5 18.5 11.5 12l-8-6.5z'), 'Следующее предложение')}
        ${b('tts-stop', UI.icon('stop', 16), 'Стоп')}
      </div>`;
    },
    /** the controls sit in the empty left strip of the card, under the AI tiles; no room under them → a row along the
     *  bottom, after the tiles (the face gets room at the bottom); on a phone — a small pill at the card's bottom */
    tvpPlace() {
      const fc = document.querySelector('[data-area] .flashcard'), box = fc && fc.querySelector('[data-tvp]');
      if (!box) return;
      const on = box.classList.contains('on');
      const phone = document.documentElement.classList.contains('m-phone') && !!fc.closest('.study.m-focus');
      box.classList.remove('row'); box.style.left = '';
      fc.classList.remove('tvp-gut', 'tvp-row', 'tvp-ph', 'tvp-art');
      if (!on) return;
      if (phone) { fc.classList.add('tvp-ph'); return; }
      if (fc.closest('.ac-stage')) { fc.classList.add('tvp-art'); return; } // 🎨 the art card stays as it is: the controls stand beside it
      const face = fc.querySelector(S && S.flipped ? '.face.back' : '.face.front');
      const rail = face && [...face.querySelectorAll('.card-rail.left')].find(r => r.offsetHeight);
      // the tiles themselves (the rail's box may reach the card's bottom although it holds one tile)
      // (offsets, not screen boxes: the card may still be turning)
      const tiles = rail ? [...rail.children].filter(c => c.offsetWidth) : [];
      const railB = tiles.length ? rail.offsetTop + Math.max(...tiles.map(c => c.offsetTop + c.offsetHeight)) : 0;
      const railR = tiles.length ? rail.offsetLeft + Math.max(...tiles.map(c => c.offsetLeft + c.offsetWidth)) : 0;
      if (tiles.length && railB + 8 > fc.clientHeight - 10 - box.offsetHeight) {
        box.classList.add('row');
        box.style.left = Math.round(railR + 8) + 'px';
        fc.classList.add('tvp-row');
      } else fc.classList.add('tvp-gut');
    },
    /** 🖼 the picture control on the card: «Заменить фото» over a picture, «Добавить фото» where a picture could be */
    // 📌 «Галерея» (the in-app Pinterest-like wall, Norway by default) comes first, always; 🖼 = every other source
    picBtn(has) {
      const l = has ? 'Заменить фото' : 'Добавить фото';
      return `<div class="pic-btns ${has ? 'on-img' : ''}">`
        + `<button type="button" class="pic-btn pic-pin ${has ? 'on-img' : ''}" data-act="pin" aria-label="Галерея картинок, как в Pinterest" title="Галерея картинок, как в Pinterest: фото по слову и норвежским темам — прямо здесь"><span aria-hidden="true">${NI('pin')}</span><span class="pic-l">Галерея</span></button>`
        + `<button type="button" class="pic-btn ${has ? 'on-img' : 'pic-add'}" data-act="pic" aria-label="${l}" title="${l}: галерея, Wikimedia, нейросеть, исторические фото, с устройства…"><span aria-hidden="true">${NI('image')}</span><span class="pic-l">${l}</span></button>`
        // 🎚 «Настроить фото» — only over a picture (js/photofx.js, loaded on first use)
        + (has ? `<button type="button" class="pic-btn on-img pic-fx" data-act="fx" style="width:44px;padding:0" aria-label="Настроить фото" title="Настроить фото: кадр, поворот, яркость, цвет, готовые стили"><span aria-hidden="true">${NI('sliders')}</span></button>` : '')
        + '</div>';
    },
    /** 🗣 the voice of this side right on the card (js/voices.js opens the chooser on any [data-voices-open]; the card doesn't flip) */
    voiceBtn(side) {
      if (!(window.Voices && Voices.openChooser)) return '';
      const l = side === 'no' ? 'no' : (this.trLang() === 'uk' ? 'uk' : 'ru');
      return `<button type="button" class="icon-btn sm card-voice" data-voices-open="${l}" data-voices-place="cards" aria-label="Голос для карточек — выбрать" title="Голос для карточек: ${l === 'no' ? 'норвежский' : l === 'uk' ? 'украинский' : 'русский'} — выбрать">${NI('user')}</button>`;
    },
    /** ✏️ the editor right on the card (the same as «✏️ Редактировать» in the side panel and the E key) */
    editBtn() { return `<button type="button" class="icon-btn sm card-edit" data-act="edit" aria-label="Редактировать карточку" title="Редактировать карточку (E)">${NI('edit')}</button>`; },
    imgHtml(card, show) {
      if (!show) return '';
      // 🎚 the photo settings (PhotoFxCore above) — without them the picture is drawn exactly as always
      const fx = card.image && card.imageFx ? PhotoFxCore.of(card) : null;
      if (fx && !Images.isRemoteAI(card.image)) return `<div class="card-img-wrap pfx-pic" style="${PhotoFxCore.wrapStyle()}">${PhotoFxCore.studyInner(card, fx)}${this.picBtn(true)}</div>` +
        (card.imageCredit ? `<div class="tiny muted img-credit">${/^https:\/\//i.test(card.imageCreditUrl || '') ? `<a href="${U.esc(card.imageCreditUrl)}" target="_blank" rel="noopener">${U.esc(card.imageCredit)}</a>` : U.esc(card.imageCredit)}</div>` : '');
      if (card.image && !Images.isRemoteAI(card.image)) return `<div class="card-img-wrap"><img class="card-img" src="${U.esc(card.image)}" alt="" onerror="this.style.display='none';this.parentNode.classList.add('img-broken')">${this.picBtn(true)}</div>` +
        (card.imageCredit ? `<div class="tiny muted img-credit">${/^https:\/\//i.test(card.imageCreditUrl || '') ? `<a href="${U.esc(card.imageCreditUrl)}" target="_blank" rel="noopener">${U.esc(card.imageCredit)}</a>` : U.esc(card.imageCredit)}</div>` : '');
      if (Images.skip && Images.skip(card)) return this.picBtn(false);
      if (Store.settings.autoImages && Store.settings.imageProvider !== 'off' && !UI.isLong(card.no)) return '<div class="card-img-wrap"><div class="img-skel" data-img-wait>🎨 рисую…</div></div>';
      return this.picBtn(false);
    },
    /** the same card drawn again after a change (picture, edit) — the side that was showing stays */
    redrawCard() {
      if (!S || !this.current()) return;
      const f = S.flipped;
      this.renderCard(false);
      if (f) this.flip(true);
    },
    /** a new picture was stored on the card: the card (normal or art view) and the gallery tiles show it at once */
    picChanged(id) {
      if (window.ArtCards && ArtCards.afterEdit) ArtCards.afterEdit(id);
      else { const cur = this.current(); if (cur && cur.card.id === id) this.redrawCard(); }
    },
    renderCard(animate) {
      const { item, card } = this.current();
      const st = Store.settings;
      this.tvCss();
      const area = document.querySelector('[data-area]');
      const promptSide = item.dir === 'nr' ? 'no' : 'ru';
      const answerSide = promptSide === 'no' ? 'ru' : 'no';
      const flag = s => s === 'no' ? '🇳🇴 NORSK' : this.trTag(card);
      const hints = st.hints !== false; // off -> the front shows ONLY the word: no picture, word class or icons
      const imgFront = hints && ['front', 'both'].includes(st.imageSide);
      const imgBack = ['back', 'both'].includes(st.imageSide);
      const status = Store.status(card, item.dir);
      const listen = S.mode === 'listen';
      const tvF = this.tvFaceOn(card, false, item), tvB = this.tvFaceOn(card, true, item); // 📄 a text card: the 4 views
      const front = listen
        ? `<div class="word" style="font-size:64px">🎧</div><div class="hint">Послушайте и вспомните слово и перевод</div>
           <button class="btn" data-act="speak-front">🔊 Ещё раз</button>`
        : `${this.imgHtml(card, imgFront)}${promptSide === 'no' ? (tvF ? this.tvHtml(card, 'front') : this.wordHtml(card.no)) : this.trHtml(card)}
           ${hints && promptSide === 'ru' && card.wordClass ? `<div class="hint">${window.Gram ? Gram.pos(card.wordClass) : U.esc(card.wordClass)}</div>` : ''}`;
      const ans = this.faceText(card, answerSide);
      const back = `
        <div class="back-main">
          ${listen ? `${this.wordHtml(card.no)}${this.trHtml(card)}` : `<div data-main-box data-prompt="${promptSide}">${this.mainInner(card, promptSide)}</div>`}
          ${this.imgHtml(card, imgBack || imgFront || listen)}
          ${this.viewBarHtml(card)}
          ${window.Gram && !listen ? Gram.badges(card) : ''}
          ${this.extrasHtml(card)}
          ${card.example ? `<div class="example">${UI.rich(card.example)} <button class="icon-btn sm" data-act="speak-ex" title="Прослушать пример">${SPK()}</button>${card.exampleRu ? `<span class="tr">${UI.rich(card.exampleRu)}</span>` : ''}</div>` : ''}
        </div>`;
      const longFront = !listen && this.isText(this.faceText(card, promptSide));
      const longBack = tvB || UI.isLong(ans) || String(card.description || '').length > 200 || (card.forms || []).length > 0 || (card.examples || []).length > 0 || (card.synonyms || []).length > 0;
      const fb = st.fourButtons;
      const prev = FSRS.preview(card.srs[item.dir], st.retention);
      const lbl = g => `<span class="kbd">${U.fmtInterval(prev[g])}</span>`;
      let controls = '';
      if (S.mode === 'type') {
        controls = `<div class="type-box"><input class="input" data-type placeholder="Введите ${answerSide === 'no' ? 'по-норвежски' : this.trWords() + (this.trLang() === 'uk' ? ' (можно и по-русски)' : '')} и нажмите Enter" autocomplete="off" autocapitalize="off" spellcheck="false">
          <button class="btn primary" data-act="check">Проверить</button></div>
          ${answerSide === 'no' ? '<div class="row" style="justify-content:center;gap:6px;margin-top:8px">' + ['æ', 'ø', 'å', 'Æ', 'Ø', 'Å'].map(ch => `<button class="btn sm" data-act="ins" data-ch="${ch}">${ch}</button>`).join('') + '</div>' : ''}
          <div class="type-result" data-result></div>`;
      } else if (S.mode === 'quiz') {
        controls = `<div class="quiz-opts" data-quiz>${this.quizOptions(card, answerSide).map((o, i) => `<button class="quiz-opt" data-act="quiz" data-ok="${o.ok ? 1 : 0}" style="animation-delay:${i * 50}ms"><span class="n">${i + 1}</span><span>${U.esc(o.text)}</span></button>`).join('')}</div>
          <div class="center" style="margin-top:10px"><button class="btn hidden" data-act="quiz-next">Дальше →</button></div>`;
      } else {
        controls = fb
          ? `<div class="answer-row four">
              <button class="btn bad" data-act="grade" data-g="1">Снова ${lbl(1)}</button>
              <button class="btn warn" data-act="grade" data-g="2">Трудно ${lbl(2)}</button>
              <button class="btn good" data-act="grade" data-g="3">Хорошо ${lbl(3)}</button>
              <button class="btn primary" data-act="grade" data-g="4">Легко ${lbl(4)}</button></div>`
          : `<div class="answer-row">
              <button class="btn bad" data-act="grade" data-g="1">✗ Не знаю <span class="kbd">←</span></button>
              <button class="btn" data-act="flip">↻ Перевернуть</button>
              <button class="btn good" data-act="grade" data-g="3">✓ Знаю <span class="kbd">→</span></button></div>`;
      }
      area.innerHTML = `<div class="study-grid">
        <div class="center-col">
        <div class="stage">
          ${S.queue.length > 2 ? '<div class="stack-shadow s2"></div>' : ''}${S.queue.length > 1 ? '<div class="stack-shadow"></div>' : ''}
          <div class="flashcard ${animate ? 'enter' : ''}" data-card>
            <div class="inner">
              <div class="face front ${longFront ? 'long' : ''}${tvF ? ' tv-face' : ''} ${hints && Object.keys(Translators.activity(card)).length ? 'has-rail' : ''}">
                <div class="lang-tag">${listen ? '🎧 АУДИРОВАНИЕ' : flag(promptSide)} ${UI.statusChip(status)}${hints ? Prov.badges(card, 17, ['manual', 'import'], true) : ''}${!listen && window.AIHub ? AIHub.markHtml(card, promptSide === 'no' ? 'no' : 'tr', { cls: 'aim-study' }) : ''}</div>
                ${hints ? Translators.activeRailsHtml(card) : ''}
                <div class="corner">${listen ? '' : this.editBtn()}${window.Subs && promptSide === 'no' ? Subs.audioBtnHtml(card) : ''}${this.voiceBtn(promptSide)}<button class="icon-btn sm" data-act="speak-front" title="Прослушать (S)">${SPK()}</button></div>
                ${front}
                ${(S.mode === 'flip' || listen) && hints ? `<div class="tap-hint">${this.hintText()}</div>` : ''}
              </div>
              <div class="face back has-rail ${longBack ? 'long' : ''}${tvB ? ' tv-face' : ''}">
                <div class="lang-tag">${flag(answerSide)}${Prov.badges(card, 17, ['manual', 'import'], true)}${window.AIHub ? AIHub.markHtml(card, answerSide === 'no' ? 'no' : 'tr', { cls: 'aim-study' }) : ''}</div>
                <div class="corner">${this.editBtn()}${window.Subs ? Subs.audioBtnHtml(card) : ''}<button class="icon-btn sm" data-act="grammar" title="Грамматика к этому слову (grammatikk.com)" aria-label="Грамматика к этому слову">${NI('book')}</button><button class="icon-btn sm" data-act="youtube" title="Видео про это слово на YouTube">${YouTube.YT_SVG(16)}</button><button class="icon-btn sm" data-act="copy-card" title="Скопировать весь текст карточки" aria-label="Скопировать весь текст карточки">${NI('copy')}</button>${this.voiceBtn(answerSide)}<button class="icon-btn sm" data-act="speak-back" title="Прочитать эту сторону (S)">${SPK()}</button></div>
                ${Translators.aiRailHtml('vertical card-rail left', card)}
                ${Translators.railHtml('vertical card-rail right', card)}
                ${back}
              </div>
            </div>
            ${listen ? '' : this.tvpHtml()}
          </div>
        </div>
        ${controls}
        <div data-explain></div>
        <div class="kbd-help"><kbd>Пробел</kbd> перевернуть · <kbd>→</kbd>/<kbd>2</kbd> знаю · <kbd>←</kbd>/<kbd>1</kbd> не знаю · <kbd>S</kbd> озвучить · <kbd>P</kbd> пауза · <kbd>E</kbd> редактировать · <kbd>Z</kbd> отменить · <kbd>Esc</kbd> выход</div>
        </div>
        <aside class="study-tools tools-read" data-read-tools>
          <div class="tools-title ui-t">${NI('speaker')}<span>Озвучка</span></div>
          ${[['all', `${NI('speaker')}<span>Читать всё</span>`], ['no', `${NI('speaker')}<span>Только норвежский</span>`], ['ru', `${NI('speaker')}<span>Только русский</span>`]].map(([m, l]) =>
            `<button class="btn sm ${st.readMode === m ? 'primary' : ''}" data-act="read" data-mode="${m}" title="Прочитать видимую сторону карточки">${l}</button>`).join('')}
          <button class="btn sm listen-btn listen-cta" data-act="listen-deck" data-listen-btn data-label="Слушать колоду" title="🎧 Слушать всю колоду вслух — через динамик или в наушниках"></button>
          ${window.Voices && Voices.langButtons ? Voices.langButtons('cards') : ''}
          <button class="btn sm" data-speech-pron="${U.esc(String(card.no).split('\n')[0].slice(0, 300))}" data-ru="${U.esc(String(card.ru).split('\n')[0].slice(0, 300))}" title="Скажите это вслух — приложение распознает речь прямо на устройстве и покажет, какие слова прозвучали верно">${NI('mic')}<span>Произношение</span></button>
          <button class="btn sm" data-act="native" title="Слово голосом настоящего носителя языка (запись Lingua Libre, если она есть), а дальше — вся карточка синтезированным голосом. Пауза / стоп / сначала — кнопками ниже">${NI('user')}<span>Живой голос</span></button>
          <div class="speed-seg" data-speed-seg title="Скорость озвучки">
            ${[['slow', '', 'Медленно'], ['normal', '', 'Обычно'], ['fast', '', 'Быстро']].map(([v, ic, l]) =>
              `<button class="${(st.ttsSpeed || 'normal') === v ? 'active' : ''}" data-act="speed" data-speed="${v}" title="${l}"><span class="sp-ic">${ic}</span><span class="sp-l">${l}</span></button>`).join('')}
          </div>
          <span class="tts-ctl media-row" data-tts-ctl>
            <button class="media-btn main" data-act="tts-toggle" title="Читать / пауза / продолжить (P)">${UI.icon('play', 22)}</button>
            <button class="media-btn" data-act="tts-stop" title="Стоп — остановить полностью" disabled>${UI.icon('stop', 18)}</button>
            <button class="media-btn" data-act="tts-restart" title="Сначала — прочитать заново" ${TTS.last ? '' : 'disabled'}>${UI.icon('restart', 18)}</button>
          </span>
        </aside>
        <aside class="study-tools tools-card">
          <div class="tools-title ui-t">${NI('cards')}<span>Карточка</span></div>
          <button class="btn sm" data-act="edit">${NI('edit')}<span>Редактировать</span></button>
          <button class="btn sm" data-act="copy-card" title="Скопировать весь текст карточки: слово, перевод, описание, формы, примеры">${NI('copy')}<span>Копировать текст</span></button>
          <button class="btn sm gk-btn" data-act="grammar" title="Грамматика к этому слову / фразе: темы grammatikk.com с переводом на русский — нужное можно добавить в карточку">${NI('book')}<span>Грамматика</span></button>
          <button class="btn sm" data-act="telegram" title="Посты, видео, карточки-картинки и файлы из Telegram-каналов по этому слову">${Telegram.TG_SVG(18)} Telegram</button>
          <button class="btn sm" data-act="social" title="Подкасты с расшифровкой, ВКонтакте, TikTok, Instagram, Pinterest, Reddit — по этому слову">${NI('globe')}<span>Ещё источники</span></button>
          <button class="btn sm yt-btn" data-act="youtube" title="Видео про это слово / выражение: поиск на YouTube и на каналах учителей норвежского">${YouTube.YT_SVG(18)} YouTube</button>
          <button class="btn sm lib-btn" data-act="library" title="Библиотека устойчивых выражений — создать колоду выражений из открытых источников">${Library.CARDS_SVG(18)} Выражения</button>
          <button class="btn sm" data-act="pic" title="Все источники картинки: поиск фото, Pinterest, нейросеть, исторические фото, с устройства, без фото">${NI('image')}<span>${card.image ? 'Заменить фото' : 'Добавить фото'}</span></button>
          <button class="btn sm pin-btn" data-act="pin" title="Галерея картинок, как в Pinterest, — прямо здесь: фото по слову и норвежским темам">${NI('pin')}<span>Галерея картинок</span></button>
          <button class="btn sm" data-act="redraw" title="Нарисовать новую картинку по смыслу">${NI('palette')}<span>Перерисовать</span></button>
          <button class="btn sm ai" data-act="enrich" data-kind="forms" title="Все формы слова, у каждой — свой перевод">${NI('book')}<span>Формы слова</span></button>
          <button class="btn sm ai" data-act="enrich" data-kind="examples" title="Примеры на каждую форму/время с переводом и подсказкой, когда так говорят">${NI('dialogue')}<span>Примеры по формам</span></button>
          <button class="btn sm ai" data-act="enrich" data-kind="synonyms" title="Синонимы с переводом и объяснением разницы (без нейросети — из словаря Ordbøkene)">${NI('fallback')}<span>Синонимы</span></button>
          <button class="btn sm ai" data-act="add-explain" title="Нейросеть допишет в карточку формы, примеры и выражения — перевод в скобках">${NI('plus')}<span>Добавить объяснение</span></button>
          <button class="btn sm ai" data-act="explain">${AI.icon(AI.current(), 14) || BOT(14)} Объяснить</button>
          <button class="btn sm ai" data-act="ai-check">${AI.icon(AI.current(), 14) || (window.AIHub ? AIHub.bot(true) : '')} Проверить карту (${U.esc(AI.name())})</button>
          <button class="btn sm" data-act="ordbok">${NI('book')}<span>Ordbøkene</span></button>
        </aside>
      </div>`;
      // 🎨 art style (js/artcards.js): the same card, flip and buttons — only the faces become art cards
      if (window.ArtCards && ArtCards.studyOn(S)) { try { ArtCards.decorateStudy(area, card, item, S); } catch (e) { console.warn('art card', e); } }
      this.bindSwipe(area.querySelector('[data-card]'));
      this.markSources(area); // «Подробнее» blocks: the source numbers on their tiles
      if (Translators.fitRails) Translators.fitRails(area); // service tiles: the edge column full to the card's bottom, the rest beside it
      setTimeout(() => TTS.emit(), 0); // sync pause/stop buttons with the player
      this.tvAfter(card); // 📄 the text views: translation once, the «кто переводит» badge · ⏯ on the card
      this.fillExamples(card); // sentence / word translations for the chosen view of the examples
      const inp = area.querySelector('[data-type]');
      if (inp) { setTimeout(() => inp.focus(), 60); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); S.answeredType ? this.typeNext() : this.checkTyped(); } }); }
      // audio
      if (listen) setTimeout(() => TTS.speak(card.no, 'no'), 250);
      else if (st.autoSpeak && promptSide === 'no' && String(card.no).length < 200) setTimeout(() => { if (this.current() && this.current().card.id === card.id) TTS.speak(card.no, 'no'); }, 300);
      // lazy image
      if (area.querySelector('[data-img-wait]')) {
        Images.ensure(card).then(url => {
          const cur = this.current();
          if (!url || !cur || cur.card.id !== card.id) return;
          area.querySelectorAll('[data-img-wait]').forEach(el => { el.outerHTML = `<img class="card-img" src="${U.esc(url)}" alt="">${this.picBtn(true)}`; });
        }).catch(() => area.querySelectorAll('[data-img-wait]').forEach(el => { const w = el.closest('.card-img-wrap'); (w || el).outerHTML = this.picBtn(false); }));
      }
    },

    /** who made the forms/examples (last history entry of that kind) */
    madeBy(card, action) {
      const h = (card.history || []).filter(x => x.a === action || (x.f && x.f[action] && String(x.f[action].new || '').trim())).pop();
      return h ? `<button class="prov-b" data-prov="${U.esc(h.by)}" data-card="${card.id}" title="${U.esc(Prov.name(h.by))}">${Prov.icon(h.by, 14)}</button>` : '';
    },
    /** the Norwegian part of a description line (no bullets / numbering / Russian in brackets), or '' */
    sayPart(line) {
      if (this.isSrcLine(line)) return ''; // «where it came from» is not Norwegian text to read, translate or gloss
      const t = String(line).replace(/\([^)]*[а-яё][^)]*\)/gi, ' ').replace(/^\s*(?:[•·\-–*]|\d+[.)])\s*/, '').replace(/^[^\p{L}]+/u, '')
        .replace(/^(📖\s*)?Ordbøkene\s*·.*$/u, '').replace(/^(📐\s*)?Grammatikk\.com\s*·.*$/u, '').replace(/^(Uttrykk|Выражения)[^:]*:\s*$/iu, '').replace(/\s+/g, ' ').trim();
      if (!/\p{L}{2}/u.test(t) || U.cyrRatio(t) > 0.3) return '';
      return t.replace(/[:;,]\s*$/, '');
    },
    /**
     * a source / note line of the description: «Источник: …», «▶ YouTube «…», 00:12 · https://…», «📺 NRK TV …»,
     * «🎬 file, 0:00:16», «📰 …», a link, «⚠️ / 🤖 …» notes — shown small, never translated word by word
     */
    isSrcLine(line) {
      const s = String(line || '').trim();
      return /^(Источник:|📍|▶\s*YouTube|📺\s*NRK|🎬\s|📰\s|🤖\s|⚠️|✍️\s*Пропущенное|в тексте:|в предложении:|форма в упражнении:)/u.test(s)
        || /^https?:\/\/\S+$/.test(s) || (/https?:\/\/\S+/.test(s) && /\d:\d\d/.test(s));
    },
    /** description: every line that has Norwegian text gets its own 🔊 */
    descHtml(card) {
      const desc = String(card.description || '');
      const lines = desc.split('\n');
      const warn = this.mtWarnOf(card);
      const DICT = /^\s*(📖 Ordbøkene ·|📗 )/u;
      let placed = false;
      const note = () => { placed = true; return this.mtNoteHtml(warn); };
      if (lines.length > 500) return (warn ? note() : '') + UI.rich(desc);
      // the same view as the examples: as is / sentence (translation) / word (translation)
      const v = Store.settings.exView || 'asis';
      const c = this.exCache();
      const html = lines.map(l => {
        if (this.isSrcLine(l)) return `<div class="desc-line desc-src">${UI.rich(l)}</div>`;
        const no = this.sayPart(l);
        const pre = warn && !placed && DICT.test(l) ? note() : '';
        const say = no ? ` <button class="icon-btn sm say-line" data-act="say" data-say="${U.esc(no)}" title="Произнести">${SPK()}</button>` : '';
        const own = this.ruPart(l), mine = no ? this.userSent(no) : undefined;
        const ru = mine || own || (v === 'word' && no ? this.sentTr(no) || '' : '');
        if (no && v === 'word') {
          return `${pre}<div class="desc-line wbw-line">${U.esc(this.leadPart(l))}${this.glossHtml(no, mine || own || undefined)}${say}${ru ? `<div class="ex-ru">${UI.rich(ru)} ${this.sayRu(ru)}${this.trFixHtml(no)}</div>` : ''}${this.litHtml([[no, mine || own || undefined]])}</div>`;
        }
        if (no && v === 'sent' && (!own || mine)) {
          const tr = this.sentTr(no);
          return `${pre}<div class="desc-line">${UI.rich(own ? l.replace(/\(([^()]*[а-яё][^()]*)\)[\s.:;,]*$/i, '') : l)} <span class="ex-ru-in">(${tr ? U.esc(tr) : tr === '' ? '—' : '…'})</span>${say}${tr ? this.sayRu(tr) + this.trFixHtml(no) : ''}</div>`;
        }
        return `${pre}<div class="desc-line">${l.trim() ? UI.rich(l) : '&nbsp;'}${say}${no && ru && v !== 'asis' ? this.sayRu(ru) : ''}</div>`;
      }).join('') + (this.reglossWhere(card) === 'desc' ? this.reglossHtml(card) : '');
      return warn && !placed ? note() + html : html;
    },
    /** «   • Han sier at… (Он говорит…)» → «Он говорит…» */
    ruPart(l) { const m = String(l).match(/\(([^()]*[а-яё][^()]*)\)[\s.:;,]*$/i); return m ? m[1].trim() : ''; },
    /** the bullet / numbering in front of a line */
    leadPart(l) { return (String(l).match(/^\s*(?:[•·▸\-–*]|\d+[.)])?\s*/) || [''])[0]; },
    sayRu(t) { return t ? `<button class="icon-btn sm ex-say" data-act="say" data-say="${U.esc(t)}" data-lang="ru" title="Произнести только русский">${SPK()}<small>RU</small></button>` : ''; },
    /** Norwegian words, each followed by its (translation) in blue; names stay as they are.
     *  ru: the sentence translation the reader sees (the words follow it); a tap on a (translation) corrects it */
    glossHtml(s, ru) {
      let k = -1;
      if (ru === undefined) ru = this.sentTr(s);
      (this._ruOf || (this._ruOf = new Map())).set(this.sentKey(s), ru || '');
      if (this._ruOf.size > 2000) this._ruOf.clear();
      const body = String(s).split(/(\s+)/).map(w => {
        if (!/\p{L}/u.test(w)) return U.esc(w);
        k++;
        const r = this.glossInfo(s, k, ru);
        if (r.how === 'skip' || (r.g === '' && this.isName(w, k))) return `<span class="wbw"><span>${U.esc(w)}</span></span>`;
        return `<span class="wbw"><span>${U.esc(w)}</span>${this.glossSpan(r, k, w)}</span>`;
      }).join('');
      return `<span class="wbw-s" data-gs="${U.esc(this.sentKey(s))}">${body}</span>`;
    },
    GUESS_TIP: 'перевод слова без контекста — может не совпадать по смыслу',
    /** «(хотел)» · «(желание?)» uncertain · «(хотел ✓)» yours */
    glossSpan(r, k, w) {
      const short = w ? this.glossShow(w, r.g) : this.shortGloss(r.g);
      const t = short ? U.esc(short) : r.g === '' ? '—' : '…';
      const cls = r.how === 'guess' ? ' unsure' : r.how === 'user' ? ' mine' : '';
      const tip = { guess: this.GUESS_TIP, user: 'ваш перевод ✓', ai: 'нейросеть — по смыслу предложения', align: 'из перевода всего предложения', dict: 'встроенный словарик' }[r.how] || '';
      const full = r.g && short !== r.g ? r.g + ' · ' : ''; // the whole note («быть (вспомогательный глагол)») stays in the tooltip
      return `<span class="wbw-ru${cls}" data-glfix data-gk="${k}" title="${U.esc(full)}${tip ? tip + ' · ' : ''}нажмите, чтобы исправить">(${t}${r.how === 'guess' ? '?' : ''}${r.how === 'user' ? ' ✓' : ''})</span>`;
    },
    /** in a line of words a gloss is short: «быть (вспомогательный глагол)» → «быть» (the note goes to the tooltip) */
    shortGloss(g) {
      if (!g) return g;
      // balanced notes «(…)» go, and so does a note left unclosed («быть (вспомогательный глагол» — a cut-off dictionary line)
      // …but an ending glued to the word stays: «был(а)», «рад(а)» (v231)
      const s = String(g).replace(/(\p{L}?)(\s*)\((?:[^()]|\([^()]*\))*\)\s*/gu, (m, a, sp) => a && !sp && /^\(\p{Ll}{1,3}\)/u.test(m.slice(1).trim()) ? m : (a ? a + ' ' : ' ')).replace(/\s*\([^()]*$/, '').replace(/\s+/g, ' ').trim();
      return s || String(g);
    },
    /** how a gloss is shown after the word in a line: short, without «som — » (the word repeated), small letter
     *  when the word itself is written small («over (над)», not «over (Над)») */
    glossShow(w, g) {
      if (!g) return g;
      const bare = String(w || '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      let t = this.shortGloss(g);
      if (bare) t = t.replace(new RegExp('^' + bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[—–-]\\s*', 'i'), '');
      // a note that is all in brackets («(артикль)») would show as «((артикль))»: the brackets go
      t = t.replace(/^\(\s*([^()]*?)\s*\)$/, '$1');
      if (/^\p{Ll}/u.test(bare) && /^\p{Lu}\p{Ll}/u.test(t)) t = t.charAt(0).toLowerCase() + t.slice(1);
      return t || this.shortGloss(g);
    },
    /** ✎ next to a sentence translation: «неверный перевод — исправить»; ✓ when the translation is yours */
    trFixHtml(no) {
      if (!no) return '';
      const mine = !!this.userSent(no);
      return `${mine ? '<span class="tr-mine" title="Ваш перевод — проверен">✓</span>' : ''}<button type="button" class="icon-btn sm tr-fix" data-trfix data-s="${U.esc(this.sentKey(no))}" title="${mine ? 'Ваш перевод — изменить' : 'Неверный перевод? Исправьте или подтвердите'}" aria-label="Исправить перевод">✎</button>`;
    },
    /**
     * the card itself in the chosen view (for EVERY card whose Norwegian side is a phrase / sentence):
     *   asis — as written: the question small, the answer big;
     *   sent — sentence by sentence: each Norwegian sentence with its own translation under it;
     *   word — every Norwegian word followed by its Russian in brackets, the card's translation under it.
     */
    mainNo(card) { if (S && this.tvFaceOn(card, true)) return ''; const s = String(card.no || '').trim(); return !s.includes('\n') && s.replace(/^(en|ei|et|å)\s+/i, '').split(/\s+/).length >= 2 && s.length <= 400 ? s : ''; }, // «en bil», «å kjøre» = one word
    mainInner(card, promptSide) {
      if (this.tvFaceOn(card, true)) return this.tvHtml(card, 'back') + this.checkedHtml(card); // 📄 a text card: the 4 views
      const answerSide = promptSide === 'no' ? 'ru' : 'no';
      const q = String(this.faceText(card, promptSide)).split('\n')[0].slice(0, 120);
      const plain = `<div class="hint">${U.esc(q)}</div>${answerSide === 'no' ? this.wordHtml(card.no) : this.trHtml(card)}`;
      const v = Store.settings.exView || 'asis', no = this.mainNo(card);
      if (v === 'asis' || !no) return plain + this.checkedHtml(card);
      const say = t => ` <button class="icon-btn sm say-line" data-act="say" data-say="${U.esc(t)}" title="Произнести">${SPK()}</button>`;
      const sents = this.splitSent(no).filter(s => /\p{L}/u.test(s));
      if (v === 'sent') {
        if (sents.length < 2) return plain + this.checkedHtml(card); // one sentence: «as is» is already sentence by sentence
        return `<div class="mv mv-sent">${sents.map(s => { const tr = this.sentTr(s); return `<div class="mv-pair"><div class="mv-no">${U.esc(s)}${say(s)}</div>
          <div class="mv-ru">${tr ? U.esc(tr) + this.trFixHtml(s) : tr === '' ? '—' : '<span class="spinner sm"></span>'}</div></div>`; }).join('')}
          <div class="mv-full small muted">Перевод карточки: ${UI.rich(this.tr(card) || '')}</div></div>${this.checkedHtml(card)}`;
      }
      // word by word; «Дословно: …» (the literal translation, when it differs) under the meaning translation
      const lit = this.litHtml(sents.map(s => [s, this.mainRu(card, s, sents.length)]));
      return `${promptSide === 'ru' ? `<div class="hint">${U.esc(q)}</div>` : ''}
        <div class="mv mv-word">${sents.map(s => `<div class="mv-line wbw-line">${this.glossHtml(s, this.mainRu(card, s, sents.length))}${say(s)}</div>`).join('')}</div>
        ${promptSide === 'no' ? this.trHtml(card) : ''}${lit}${this.reglossWhere(card) === 'main' ? this.reglossHtml(card) : ''}${this.checkedHtml(card)}`;
    },
    /**
     * 🔄 «Подписать заново» (word view): the neural network glosses every sentence of THIS card again, whatever is cached
     * (an old answer like var «(вспом. глагол)» → «была»). One small button per card: under its own sentence, else under
     * the examples, else under the explanation. The old glosses stay on the screen until the new ones come.
     */
    reglossWhere(card) {
      if (!card || (Store.settings.exView || 'asis') !== 'word') return '';
      if (this.mainNo(card)) return 'main';
      if ((card.examples || []).length) return 'ex';
      return this.descUnits(card).length ? 'desc' : '';
    },
    reglossHtml(card) {
      const ico = window.NavIcons && NavIcons.icon ? NavIcons.icon('refresh', 15) : '';
      return `<div class="gl-redo-row"><button type="button" class="btn sm ghost gl-redo" data-regloss data-cid="${U.esc(card.id)}" title="Нейросеть заново подпишет перевод под каждым словом этой карточки — по смыслу предложения (прежние подписи не используются)">${ico}<span>Подписать заново</span></button>${this.glossReportBtn(card)}</div>`;
    },
    /** ⚑ W7: the card's AI glosses and «Дословно» lines can be reported (only when a neural network made some) */
    glossReportBtn(card) {
      if (!(window.Views && Views.reportBtn) || !Views.canReport || !Views.canReport()) return '';
      const c = this.exCache(), lines = [];
      this.glossSents(card).forEach(({ s }) => {
        const g = c['g:' + s];
        if (!g || Array.isArray(g)) return;
        const rest = Object.assign({}, g); ['h', 'pv', 't', 'at', 'by'].forEach(k => delete rest[k]);
        lines.push(`${s} → ${JSON.stringify(rest).slice(0, 400)}`);
      });
      if (!lines.length) return '';
      return Views.reportBtn({ answer: lines.join('\n').slice(0, 3500), question: String(card.no || '').slice(0, 600), task: 'gloss', compact: true });
    },
    /** every sentence of the card's word view: [{ s, ru }] (the same list fillExamples glosses) */
    glossSents(card) {
      const out = [];
      if (!card) return out;
      const main = this.mainNo(card);
      if (main) { const ss = this.splitSent(main).filter(s => /\p{L}/u.test(s)); ss.forEach(s => out.push({ s, ru: this.mainRu(card, s, ss.length) })); }
      (card.examples || []).forEach(x => this.exPairs(x).forEach(p => out.push({ s: p.no, ru: this.exWordRu(x, p) })));
      this.descUnits(card).forEach(u => out.push({ s: u.no, ru: this.userSent(u.no) || u.ru || undefined }));
      return out;
    },
    /** the card's AI glosses are out of date (its text was checked / changed, or «Подписать заново»): they stay on the
     *  screen, but every sentence is glossed again the next time the card is shown in the word view → the number of them */
    glossStale(cardId) {
      const card = Store.card(cardId); if (!card) return 0;
      const c = this.exCache();
      let n = 0;
      this.glossSents(card).forEach(({ s }) => { const g = c['g:' + s]; if (g && !Array.isArray(g) && g.pv !== 0) { c['g:' + s] = Object.assign({}, g, { pv: 0 }); n++; } });
      if (n) this.exSave();
      return n;
    },
    /** the button: mark stale → gloss now (the quiet note says who works); a viewer window is redrawn in place */
    async regloss(cardId, btn) {
      const card = Store.card(cardId); if (!card) return;
      if (!(window.AI && AI.available())) {
        if (window.Guides && Guides.needAI) Guides.needAI('Подписать заново'); else UI.toast('Подключите нейросеть — она подпишет каждое слово по смыслу', '', 5000);
        return;
      }
      if (btn && btn.classList.contains('busy')) return;
      this.glossStale(cardId);
      // asked by hand: the session's limit of tries (3 per sentence, v231) starts again for this card
      if (this._glTry) this.glossSents(card).forEach(({ s }) => this._glTry.delete(s));
      // a run for this card that started before the click does not hold the new one back
      if (this._exBusy && this._exBusy.id === cardId) this._exBusy = false;
      const root = btn && btn.closest('[data-cv], [data-sheet]');
      const onStudy = !root && window.App && App.view && App.view.name === 'study' && this.current() && this.current().card.id === cardId;
      if (btn) { btn.classList.add('busy'); btn.disabled = true; }
      try {
        if (onStudy) await this.fillExamples(card);
        else await this.fillExamples(card, () => { const x = Store.card(cardId); if (x && root && root.isConnected) this.redrawIn(root, x); });
      } finally { if (btn && btn.isConnected) { btn.classList.remove('busy'); btn.disabled = false; } }
      const c = this.exCache();
      const still = this.glossSents(Store.card(cardId) || card).filter(it => { const g = c['g:' + it.s]; return g && !Array.isArray(g) && g.pv === 0; });
      if (still.length) UI.toast(`${AI.name()} сейчас не ответила — подписи остались прежними. Попробуйте ещё раз чуть позже`, 'warn', 5000);
    },
    /** the translation one sentence of the card's own text is glossed against: yours ✓, the card's (one sentence), the machine one */
    mainRu(card, s, n) { return this.userSent(s) || (n === 1 && card.ru ? String(card.ru) : undefined); },
    /** «✓ Перевод проверен»: a card that was translated by a machine and later checked by a neural network or by the user */
    checkedHtml(card) {
      const h = card.history || [];
      const w = this.mtWarnOf(card);
      // no description: the warning is about the card's own translation — shown here (there is no description box for it);
      // a later AI check of the card (Проверить карту) settles it
      const aiLater = w && !card.description && h.some(x => /^ai:/.test(x.by) && ['verify', 'check'].includes(x.a) && (x.t || 0) >= (w.t || 0));
      if (w && !aiLater) return card.description ? '' : this.mtNoteHtml(w, 'ai-check'); // still unchecked: the ⚠️ note says so
      // made from a line / word whose translation you corrected or confirmed yourself (✓ in the player or on a card)
      if (h.some(x => x.by === 'manual' && x.a === 'verify' && x.f && (x.f.ru || x.f.exampleRu))) return '<div class="mt-ok-note">✓ Перевод проверен вами</div>';
      const machine = h.some(x => x.a === 'translate' && /^tr:(google|mozhi|mymemory|microsoft|deepl)$/.test(x.by));
      if (!machine) return '';
      const ai = [...h].reverse().find(x => /^ai:/.test(x.by) && ['verify', 'check', 'fill', 'translate', 'edit'].includes(x.a));
      const me = card.mtWarn === false || h.some(x => x.by === 'manual' && x.f && x.f.ru);
      if (!ai && !me) return '';
      return `<div class="mt-ok-note">✓ Перевод проверен${ai ? ` нейросетью (${U.esc(Prov.name(ai.by))})` : ' вами'} — исправлен и точный</div>`;
    },
    /* ---------- ✎ «Неверный перевод»: correct (or confirm) a word gloss / a sentence translation ---------- */
    /** the window for word k of sentence s; onDone(saved) after saving */
    fixGloss(s, k, onDone, ruShown) {
      s = this.sentKey(s);
      const toks = this.glossToks(s), w = toks[k];
      if (w === undefined) return;
      const ru = ruShown !== undefined ? ruShown : (this._ruOf && this._ruOf.has(s) ? this._ruOf.get(s) : this.sentTr(s)) || '';
      const r = this.glossInfo(s, k, ru || undefined);
      const how = { user: '✓ ваш перевод', ai: '🤖 нейросеть — по смыслу предложения', align: 'взято из перевода всего предложения', dict: 'встроенный словарик', guess: '⚠️ ' + this.GUESS_TIP }[r.how] || '';
      let n = -1;
      const sentHtml = s.split(/(\s+)/).map(x => { if (!/\p{L}/u.test(x)) return U.esc(x); n++; return n === k ? `<mark>${U.esc(x)}</mark>` : U.esc(x); }).join('');
      const m = UI.modal({
        title: `✎ Перевод слова «${U.esc(this.bareLow(w) && k > 0 ? w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') : this.bareLow(w))}»`, cls: 'narrow fix-modal',
        body: `<div class="fix-no" lang="nb">${sentHtml}</div>
          ${ru ? `<div class="fix-ru">${U.esc(ru)}</div>` : ''}
          <label class="fix-lbl" for="fix-in">Что значит это слово <b>в этом предложении</b>:</label>
          <input class="input" id="fix-in" data-fix-in maxlength="80" autocomplete="off" spellcheck="false" value="${U.esc(r.g || '')}" placeholder="например: хотел">
          ${how ? `<div class="tiny muted fix-how">Сейчас: ${U.esc(how)}</div>` : ''}
          <div class="tiny muted">Ваш перевод отмечается ✓ и заменяет машинный везде, где встречается это предложение.</div>`,
        foot: `${r.how === 'user' ? '<button class="btn ghost" data-fix="reset" title="Убрать ваш перевод — снова автоматический">↺ Автоматический</button>' : ''}
          <span class="grow"></span>
          ${r.g && r.how !== 'user' ? '<button class="btn" data-fix="ok" title="Перевод верный — отметить как проверенный">✓ Верно</button>' : ''}
          <button class="btn primary" data-fix="save">Сохранить</button>`,
        beforeClose: UI.guard(() => inp.value.trim() === String(r.g || '').trim() ? null : { title: 'Закрыть без сохранения?', line: 'Ваш перевод слова не сохранён.',
          actions: [{ label: 'Закрыть', value: 'close', cls: 'bad' }] }),
      });
      const inp = m.$('[data-fix-in]');
      const done = g => { this.setUserGloss(s, k, g); m.close(); UI.toast(g ? `✓ «${this.bareLow(w)}» — ${g}` : 'Вернулся автоматический перевод', 'good', 2200); this.afterFix(); if (onDone) onDone(!!g); };
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-fix]'); if (!b) return;
        if (b.dataset.fix === 'reset') done('');
        else if (b.dataset.fix === 'ok') done(r.g);
        else done(inp.value.trim() || (r.how === 'user' ? '' : null) || '');
      });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); done(inp.value.trim()); } });
      setTimeout(() => { try { inp.focus({ preventScroll: true }); inp.select(); } catch (e) { /* ignore */ } }, 60);
      return m;
    },
    /** the window for a sentence translation (Norwegian sentence s) */
    fixSent(s, onDone) {
      s = this.sentKey(s);
      const cur = this.sentTr(s) || '';
      const mine = !!this.userSent(s);
      const m = UI.modal({
        title: '✎ Перевод предложения', cls: 'narrow fix-modal',
        body: `<div class="fix-no" lang="nb">${U.esc(s)}</div>
          <label class="fix-lbl" for="fix-ta">Перевод${mine ? ' (ваш ✓)' : ' — исправьте, если он неверный'}:</label>
          <textarea class="input" id="fix-ta" data-fix-in rows="3" maxlength="2000" spellcheck="true" lang="ru">${U.esc(cur)}</textarea>
          <div class="tiny muted">Ваш перевод отмечается ✓ и заменяет машинный везде, где встречается это предложение; слова в «Слово (перевод)» потом следуют ему.</div>`,
        foot: `${mine ? '<button class="btn ghost" data-fix="reset" title="Убрать ваш перевод — снова машинный">↺ Машинный</button>' : ''}
          <span class="grow"></span>
          ${cur && !mine ? '<button class="btn" data-fix="ok" title="Перевод верный — отметить как проверенный">✓ Верно</button>' : ''}
          <button class="btn primary" data-fix="save">Сохранить</button>`,
        beforeClose: UI.guard(() => ta.value.trim() === cur.trim() ? null : { title: 'Закрыть без сохранения?', line: 'Ваш перевод предложения не сохранён.',
          actions: [{ label: 'Закрыть', value: 'close', cls: 'bad' }] }),
      });
      const ta = m.$('[data-fix-in]');
      const done = t => { this.setUserSent(s, t); m.close(); UI.toast(t ? '✓ Перевод сохранён — он теперь ваш' : 'Вернулся машинный перевод', 'good', 2200); this.afterFix(s); if (onDone) onDone(!!t); };
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-fix]'); if (!b) return;
        if (b.dataset.fix === 'reset') done('');
        else if (b.dataset.fix === 'ok') done(cur);
        else done(ta.value.trim());
      });
      setTimeout(() => { try { ta.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 60);
      return m;
    },
    /** after a correction: everything on screen shows it at once (card back, card viewer; others listen to the event) */
    afterFix(sent) {
      this._glVer = (this._glVer || 0) + 1;
      const cur = S && this.current();
      if (cur) { const card = Store.card(cur.card.id) || cur.card; this.redrawIn(document.querySelector('[data-area]'), card); if (sent && Store.settings.exView === 'word') this.fillExamples(card); }
      document.querySelectorAll('[data-cv][data-cid]').forEach(el => { const c = Store.card(el.dataset.cid); if (c) this.redrawIn(el, c); });
      try { window.dispatchEvent(new CustomEvent('nk-userfix', { detail: { sent: sent || null } })); } catch (e) { /* old browser */ }
    },
    /** Norwegian parts of the description (for translating them in the chosen view) */
    descUnits(card) {
      const lines = String(card.description || '').split('\n');
      if (lines.length > 500) return [];
      return lines.map(l => ({ no: this.sayPart(l), ru: this.ruPart(l) })).filter(u => u.no);
    },
    /** one switch for the whole card back: description + examples */
    viewBarHtml(card) {
      const has = (card.examples || []).length || this.descUnits(card).length || this.mainNo(card);
      if (!has) return '';
      const v = Store.settings.exView || 'asis';
      return `<div class="view-bar"><span class="small muted">Перевод:</span><span class="seg-mini ex-view sm">${this.EXV.map(([id, l, t]) => `<button class="${v === id ? 'active' : ''}" data-act="ex-view" data-v="${id}" title="${t}">${l}</button>`).join('')}</span></div>`;
    },
    /**
     * is the dictionary text on this card a machine translation nobody has checked?
     * card.mtWarn: object = yes; null = checked by AI; false = the user checked it. Older cards: worked out from the history.
     */
    mtWarnOf(card) {
      if (card.mtWarn !== undefined) return card.mtWarn || null;
      if (!/📖 Ordbøkene ·|📗 /u.test(card.description || '')) return null;
      const h = card.history || [];
      const i = h.map(x => x.by).lastIndexOf('tr:ordbok');
      if (i < 0) return null;
      if (h.slice(i).some(x => String(x.by).startsWith('ai:'))) return null;
      const m = String(h[i].n || h[i].note || '').match(/перевод(?:ом)?\s*\(?([^)]*)\)?/);
      const names = m && m[1] && !/без перевода/.test(m[1]) ? m[1] : 'Google';
      const by = Object.entries(Translators.LIST).filter(([, t]) => names.includes(t.name)).map(([id]) => id);
      return { by: by.length ? by : ['google'], t: h[i].t };
    },
    /** collapsed warning (2 lines) — click opens the full explanation and what to do */
    mtNoteHtml(w, act = 'mt-recheck') {
      const names = Translators.provNames(w.by || ['google']);
      return `<div class="mt-note" data-act="mt-toggle" role="button" tabindex="0" title="Нажмите, чтобы прочитать полностью">
        <div class="mt-note-body">⚠️ <b>Перевод сделан машинным переводчиком (${U.esc(names)}) — он может быть неточным.</b>
          Обычные фразы такие переводчики переводят в основном верно, а устойчивые выражения и идиомы — часто дословно и неправильно.
          Перепроверьте перевод: ${AI.available() ? `нейросеть (${U.esc(AI.name())}) проверит каждую строку — кнопка ниже` : 'подключите нейросеть (бесплатно: Gemini или Groq в Настройках) — она проверит каждую строку'},
          или сверьтесь с более точными источниками — DeepL, словари NAOB, LEXIN, Glosbe (значок 📚 справа).</div>
        <div class="mt-note-actions">
          <button class="btn sm ${AI.available() ? 'ai' : ''}" data-act="${act}">${AI.available() ? `${AI.icon(AI.current(), 14)} Перепроверить нейросетью` : act === 'ai-check' ? `${window.AIHub ? AIHub.bot(true) : ''} Проверить нейросетью` : '📖 Открыть статью заново'}</button>
          <button class="btn sm" data-act="mt-ok" title="Вы сверили перевод сами — предупреждение исчезнет">✓ Я проверил — скрыть</button>
        </div>
        <span class="mt-more">подробнее ▾</span></div>`;
    },
    /** plain text of the whole card — for copying */
    cardText(card) {
      const out = [card.no, card.ru, this.ukOf(card) ? `🇺🇦 ${this.ukOf(card)}` : ''].filter(Boolean);
      if (card.description) out.push('', card.description);
      if ((card.forms || []).length) out.push('', 'Формы слова:', ...card.forms.map(f => { const tr = this.trLangs().map(l => (l === 'uk' ? this.formMeta(card, f).uk : f.ru)).filter(Boolean).join(' / '); return `${this.formLabelText(f)} — ${f.no}${tr ? ` — ${tr}` : ''}`; }));
      if ((card.synonyms || []).length) out.push('', 'Синонимы:', ...card.synonyms.map(s => `${s.no}${s.ru ? ` (${s.ru})` : ''}${s.note ? ' — ' + s.note : ''}`));
      if ((card.examples || []).length) out.push('', 'Примеры:', ...card.examples.map(x => `${x.label ? x.label + ': ' : ''}${x.no}${x.ru ? ` (${x.ru})` : ''}`));
      if (card.example) out.push('', card.example + (card.exampleRu ? ` (${card.exampleRu})` : ''));
      return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    },
    async copyText(text, what) {
      try { await navigator.clipboard.writeText(text); }
      catch (e) {
        const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (_) { /* ignore */ } ta.remove();
      }
      UI.toast(`📋 ${what}`, 'good', 1800);
    },
    formsHtml(card) {
      const f = card.forms || [];
      if (!f.length) return '';
      const busy = !!(this._ffBusy && this._ffBusy.has(card.id));
      this.tvCss(); // the forms layout lives in css/studyx.css
      const html = `<div class="forms-box fg-v2" data-forms-box data-cid="${U.esc(card.id)}"><div class="fb-title">📚 Формы слова ${this.madeBy(card, 'forms')}</div>${this.formGenderHtml(card)}
        ${f.map((x, i) => `<div class="fg-row" data-fi="${i}"><span class="fg-label">${this.formLabelHtml(x)}</span><span class="fg-no" lang="nb">${UI.rich(x.no)}</span><span class="fg-dash" aria-hidden="true">—</span>${this.formTrCell(card, x, i, busy)}
          <span class="fg-btns"><button class="icon-btn sm" data-act="say" data-say="${U.esc(x.no)}" title="Произнести">${SPK()}</button><button class="icon-btn sm fg-edit" data-ffix="${i}" title="Исправить перевод этой формы" aria-label="Исправить перевод формы ${U.esc(x.no)}">✎</button></span></div>`).join('')}</div>`;
      // translations that are still missing are made once, when the table is really in front of the user
      if (!busy && this.formsNeed(card).length && !(this._ffTried && this._ffTried.has(card.id + '|' + this.trLang()))) this.formsSoon(card.id);
      return html;
    },

    /** «presens · настоящее время» (Ukrainian names when the translation language is uk) — the one table is AI.FORM_TAGS */
    formLabelHtml(f) {
      if (window.AI && AI.formLabelHtml) return AI.formLabelHtml(f, this.trLang() === 'uk' ? 'uk' : 'ru');
      return window.Gram ? Gram.label(f.label) : U.esc(f.label || '');
    },
    formLabelText(f) { return window.AI && AI.formLabelText ? AI.formLabelText(f, this.trLang() === 'uk' ? 'uk' : 'ru') : String(f.label || ''); },
    /** a noun's kjønn above its forms: «kjønn: hankjønn (en) · мужской род» */
    formGenderHtml(card) {
      if (!window.AI || !AI.genderInfo || this.formPos(card) !== 'substantiv') return '';
      const g = AI.genderInfo(card, this.trLang() === 'uk' ? 'uk' : 'ru');
      if (!g) return '';
      return `<div class="fg-gender fg-g-${g.key}"><span class="fl-no" lang="nb">kjønn: ${U.esc(g.no)} (${U.esc(g.art)})</span><span class="fl-dot" aria-hidden="true"> · </span><span class="fl-ru">${U.esc(g.name)}</span></div>`;
    },
    /* ---------- 📚 every form with ITS OWN translation (å komme — приходить · kom — пришёл, приехал (прошедшее)) ----------
     * card.forms[i] = { label, no, ru, uk?, trBy?, trByUk? }  trBy: 'rule' | 'ai:<id>' | 'tr:<id>' | 'user' (none = came with the card).
     * A copy of the extra fields lives in card.formsTr['f:' + no] = { ru, by, uk, byUk } (kept even where the form list
     * is cleaned to label / no / ru). Missing translations are made ONCE, when the table is shown: rules from the card's
     * own translation (nouns, adjectives, the infinitive), else one AI request per card, else a machine translator
     * on short pronoun phrases («jeg kom» → «я пришёл» → «пришёл»). Saved into the card; ✎ / a tap corrects it. */
    trLang() { const v = window.Store && Store.settings && Store.settings.transLang; return v === 'uk' || v === 'both' ? v : 'ru'; },
    trLangs() { const l = this.trLang(); return l === 'both' ? ['ru', 'uk'] : [l]; },
    formMeta(card, f) {
      const all = card && card.formsTr && typeof card.formsTr === 'object' ? card.formsTr : null;
      const raw = all && Object.prototype.hasOwnProperty.call(all, 'f:' + f.no) ? all['f:' + f.no] : null;
      const m = raw && typeof raw === 'object' ? raw : {};
      const s = v => (typeof v === 'string' ? v : '');
      const uk = s(f.uk) || s(m.uk);
      return {
        by: s(f.trBy) || (f.ru && s(m.ru) === f.ru ? s(m.by) : ''), uk, byUk: s(f.trByUk) || (uk && s(m.uk) === uk ? s(m.byUk) : ''),
        // the user emptied it on purpose: not filled again
        clearedRu: !f.ru && m.by === 'user', clearedUk: !uk && m.byUk === 'user',
      };
    },
    autoTitle(by) {
      const who = by === 'rule' ? 'по правилу, из перевода карточки' : /^(ai|tr):/.test(by) ? Prov.name(by) : '';
      return `перевод формы сделан автоматически${who ? ` (${who})` : ''} — проверьте`;
    },
    formTrCell(card, f, i, busy) {
      const langs = this.trLangs(), m = this.formMeta(card, f);
      const parts = langs.map(l => {
        const t = l === 'uk' ? m.uk : f.ru, by = l === 'uk' ? m.byUk : m.by;
        if (!t) return '';
        const auto = by && by !== 'user';
        const tag = auto ? `<span class="fg-auto" title="${U.esc(this.autoTitle(by))}" aria-label="${U.esc(this.autoTitle(by))}">${by.startsWith('ai:') ? BOT() : '⚙︎'}</span>` : '';
        return `<span class="fg-t" lang="${l}">${langs.length > 1 ? `<small class="fg-lang">${l.toUpperCase()}</small>` : ''}${UI.rich(t)}${tag}</span>`;
      }).filter(Boolean);
      if (parts.length) return `<button type="button" class="fg-ru fg-tr" data-ffix="${i}" title="Нажмите, чтобы исправить перевод">${parts.join('')}</button>`;
      if (busy) return '<span class="fg-ru fg-wait" aria-live="polite"><span class="spinner sm"></span> <small>перевожу…</small></span>';
      return `<span class="fg-ru"><button type="button" class="fg-do" data-fftr="${i}" title="Перевести форму (правило из перевода карточки, нейросеть или переводчик)">перевести</button></span>`;
    },
    /** which form slot this row is: inf / pres / pret / perf / … / ue / be / uf / bf / adjmf / adjn / adjpl / komp / sup … */
    formSlot(f) {
      if (window.AI && AI.formTag) return AI.formTag(f);
      const t = window.Gram && Gram.term ? Gram.term(f.label) : null;
      const MAP = { infinitiv: 'inf', presens: 'pres', preteritum: 'pret', perfektum: 'perf', perfpart: 'perfpart', prespart: 'prespart', futurum: 'fut', pluskv: 'pluskv', imperativ: 'imp', passiv: 'passiv',
        ue: 'ue', be: 'be', uf: 'uf', bf: 'bf', entall: 'ue', flertall: 'uf', komparativ: 'komp', superlativ: 'sup', adjmf: 'adjmf', adjn: 'adjn', adjpl: 'adjpl', positiv: 'positiv' };
      const l = String(f.label || '').toLowerCase(), no = String(f.no || '').trim().toLowerCase();
      let s = (t && MAP[t.key]) || '';
      if (!s && /опр\.?\s*форма|bestemt form|pos def/.test(l)) s = 'adjdef';
      if (s === 'sup' && /опр|bestemt|def/.test(l)) s = 'supdef';
      if (s === 'perfpart' && /^(jeg\s+)?har\s/.test(no)) s = 'perf';
      if (!s && /^å\s/.test(no)) s = 'inf';
      if (!s && /^(jeg\s+)?har\s/.test(no)) s = 'perf';
      return s;
    },
    formPos(card) {
      const k = window.Gram && Gram.cardPos ? Gram.cardPos(card) : '';
      if (k) return k;
      const slots = (card.forms || []).map(f => this.formSlot(f));
      if (slots.some(s => ['pres', 'pret', 'perf', 'inf', 'imp'].includes(s))) return 'verb';
      if (slots.some(s => ['ue', 'be', 'uf', 'bf'].includes(s))) return 'substantiv';
      if (slots.some(s => ['adjmf', 'adjn', 'adjpl', 'komp', 'sup'].includes(s))) return 'adjektiv';
      return '';
    },
    /** forms that still lack a translation in the language(s) shown: [{ i, f, slot, langs }] */
    formsNeed(card) {
      const langs = this.trLangs();
      return (card.forms || []).map((f, i) => {
        if (!f || !f.no) return null;
        const m = this.formMeta(card, f);
        const need = langs.filter(l => (l === 'uk' ? !m.uk && !m.clearedUk : !f.ru && !m.clearedRu));
        return need.length ? { i, f, slot: this.formSlot(f), langs: need } : null;
      }).filter(Boolean);
    },
    /** the card's own translation, short (first line, without notes in brackets) — or '' when it is not usable */
    formMain(card, lang) {
      let s = String((lang === 'uk' ? card.uk : card.ru) || '').split('\n')[0];
      s = s.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').split(';')[0].replace(/\s+/g, ' ').trim().replace(/[.!…]+$/, '');
      if (!s || s.length > 60 || /[a-zæøå]/i.test(s) || !/\p{L}/u.test(s)) return '';
      return /^\p{Lu}\p{Ll}/u.test(s) && /^\p{Ll}/u.test(String(card.no || '').replace(/^(å|en|ei|et)\s+/i, '')) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
    },
    /** a translation made by rule from the card's own translation: { t, sure } or null */
    ruleFormTr(card, slot, pos, lang) {
      const main = this.formMain(card, lang);
      if (!main) return null;
      const one = main.split(/\s*[,/]\s*/)[0].trim(), single = /^[\p{L}-]+$/u.test(one);
      const ru = lang !== 'uk', low = one.toLowerCase().replace(/ё/g, 'е');
      if (pos === 'verb') {
        return slot === 'inf' && (ru ? /(ть|ться|ти|тись|чь|чься)$/ : /(ти|тися|ть|тись)$/).test(one) ? { t: main, sure: true } : null;
      }
      if (pos === 'substantiv') {
        // Russian / Ukrainian gender by the ending (for «эта / этот / это»); unknown → a neutral note
        const g = /мя$/.test(low) ? 'n' : /[ая]$/.test(low) ? 'f' : /[оеё]$/.test(low) ? 'n' : /[бвгджзклмнпрстфхцчшщй]$/.test(low) ? 'm' : '';
        // the form's name («bestemt entall · ед. ч., определённая») is shown next to it: here only «(эта) машина»
        const DEF = ru ? { f: 'эта', m: 'этот', n: 'это', '': '' } : { f: 'ця', m: 'цей', n: 'це', '': '' };
        const DEFPL = ru ? 'эти' : 'ці';
        if (slot === 'ue') return { t: main, sure: true };
        if (slot === 'be') { const d = DEF[single ? g : '']; return { t: d ? `(${d}) ${one}` : one, sure: true }; }
        if ((slot === 'uf' || slot === 'bf') && ru && single) {
          const pl = this.ruPlural(low), t = pl.t;
          if (!t) return null;
          return { t: slot === 'bf' ? `(${DEFPL}) ${t}` : t, sure: pl.sure };
        }
        return null;
      }
      if (pos === 'adjektiv' && single) {
        const a = ru ? this.ruAdj(low) : this.ukAdj(low);
        if (!a) return null;
        const t = { adjmf: one, positiv: one, adjn: a.n, adjpl: a.pl, adjdef: one, komp: a.cmp, sup: a.sup, supdef: a.sup }[slot];
        return t ? { t, sure: true } : null;
      }
      return null;
    },
    /** Russian nominative plural: { t, sure } (sure only for the known irregular words) */
    ruPlural(w) {
      const IRR = { человек: 'люди', ребенок: 'дети', друг: 'друзья', брат: 'братья', стул: 'стулья', дерево: 'деревья', лист: 'листья', сын: 'сыновья', муж: 'мужья', дом: 'дома', город: 'города', глаз: 'глаза', лес: 'леса',
        поезд: 'поезда', учитель: 'учителя', мать: 'матери', дочь: 'дочери', имя: 'имена', время: 'времена', день: 'дни', ухо: 'уши', яблоко: 'яблоки', цвет: 'цвета', номер: 'номера', адрес: 'адреса', вечер: 'вечера',
        берег: 'берега', остров: 'острова', паспорт: 'паспорта', доктор: 'доктора', профессор: 'профессора', директор: 'директора', сосед: 'соседи', цветок: 'цветы', отец: 'отцы', конец: 'концы', котенок: 'котята',
        дно: 'днища', небо: 'небеса', чудо: 'чудеса', колено: 'колени', плечо: 'плечи', курица: 'куры', хозяин: 'хозяева', господин: 'господа', щенок: 'щенки', рынок: 'рынки', подарок: 'подарки', звонок: 'звонки',
        кусок: 'куски', потолок: 'потолки', кошелек: 'кошельки', платок: 'платки', замок: 'замки', ветер: 'ветры', огонь: 'огни', угол: 'углы', рот: 'рты', сон: 'сны', лев: 'львы', церковь: 'церкви', любовь: 'любви' };
      if (IRR[w]) return { t: IRR[w], sure: true };
      const soft = /[гкхжшчщ]$/;
      let t = '';
      if (/ия$/.test(w)) t = w.slice(0, -1) + 'и';
      else if (/ие$/.test(w)) t = w.slice(0, -1) + 'я';
      else if (/а$/.test(w)) t = w.slice(0, -1) + (soft.test(w.slice(0, -1)) ? 'и' : 'ы');
      else if (/[яйь]$/.test(w)) t = w.slice(0, -1) + 'и';
      else if (/о$/.test(w)) t = w.slice(0, -1) + (/к$/.test(w.slice(0, -1)) ? 'и' : 'а');
      else if (/е$/.test(w)) t = w.slice(0, -1) + 'я';
      else if (/[бвгджзклмнпрстфхцчшщ]$/.test(w)) t = w + (soft.test(w) ? 'и' : 'ы');
      return { t, sure: false };
    },
    /** Russian adjective (-ый / -ий / -ой): neuter, plural, comparative, superlative — or null */
    ruAdj(w) {
      const m = w.match(/^(.+?)(ый|ий|ой)$/);
      if (!m) return null;
      const [, st, e] = m, hard = /[гкх]$/.test(st), hush = /[жшчщ]$/.test(st);
      const n = st + (e === 'ий' && !hard ? 'ее' : 'ое'); // новое · синее, хорошее · маленькое · большое
      const pl = st + (e === 'ый' ? 'ые' : e === 'ий' ? 'ие' : hard || hush ? 'ие' : 'ые');
      const CMP = { хороший: 'лучше', плохой: 'хуже', большой: 'больше', маленький: 'меньше', высокий: 'выше', низкий: 'ниже', дорогой: 'дороже', дешевый: 'дешевле', молодой: 'моложе', старый: 'старше',
        далекий: 'дальше', близкий: 'ближе', короткий: 'короче', длинный: 'длиннее', легкий: 'легче', тяжелый: 'тяжелее', широкий: 'шире', узкий: 'уже', громкий: 'громче', тихий: 'тише', богатый: 'богаче',
        простой: 'проще', частый: 'чаще', ранний: 'раньше', поздний: 'позже', сладкий: 'слаще', крепкий: 'крепче', жаркий: 'жарче', яркий: 'ярче', мягкий: 'мягче', твердый: 'твёрже', глубокий: 'глубже',
        толстый: 'толще', чистый: 'чище', крутой: 'круче', быстрый: 'быстрее', новый: 'новее', теплый: 'теплее', холодный: 'холоднее', сильный: 'сильнее', умный: 'умнее', интересный: 'интереснее',
        красивый: 'красивее', важный: 'важнее', трудный: 'труднее', сложный: 'сложнее', светлый: 'светлее', темный: 'темнее', бедный: 'беднее', слабый: 'слабее', веселый: 'веселее', грустный: 'грустнее' };
      const SUP = { хороший: 'самый лучший', плохой: 'самый плохой (худший)' };
      return { n, pl, cmp: CMP[w] || `более ${w}`, sup: SUP[w] || `самый ${w}` };
    },
    /** Ukrainian adjective (-ий / -ій) — or null */
    ukAdj(w) {
      const m = w.match(/^(.+?)(ий|ій)$/);
      if (!m) return null;
      const [, st, e] = m;
      const CMP = { великий: 'більший', малий: 'менший', маленький: 'менший', добрий: 'кращий', гарний: 'кращий', поганий: 'гірший', високий: 'вищий', низький: 'нижчий', дорогий: 'дорожчий', дешевий: 'дешевший', молодий: 'молодший', старий: 'старший', довгий: 'довший', короткий: 'коротший', широкий: 'ширший', вузький: 'вужчий' };
      const c = CMP[w];
      return { n: st + (e === 'ій' ? 'є' : 'е'), pl: st + 'і', cmp: c || `більш ${w}`, sup: c ? 'най' + c : `найбільш ${w}` };
    },
    /** what a machine translator gets: a verb form with a pronoun (kom → «jeg kom» → «я пришёл»), others as they are */
    formQuery(f, slot, pos) {
      const no = String(f.no || '').split(/\s+\/\s+/)[0].trim();
      if (pos !== 'verb' && !['pres', 'pret', 'perf', 'perfpart', 'pluskv', 'fut', 'imp'].includes(slot)) return no;
      const pron = /^(jeg|du|han|hun|vi|dere|de|man)\s/i.test(no);
      if (slot === 'inf') return /^å\s/i.test(no) ? no : 'å ' + no;
      if (slot === 'imp') return /!$/.test(no) ? no : no + '!';
      if (pron) return no;
      if (slot === 'perf' || slot === 'perfpart') return /^har\s/i.test(no) ? 'jeg ' + no : 'jeg har ' + no;
      if (slot === 'pluskv') return /^hadde\s/i.test(no) ? 'jeg ' + no : 'jeg hadde ' + no;
      if (['pres', 'pret', 'fut'].includes(slot)) return 'jeg ' + no;
      return no;
    },
    // the form's name is shown next to it («perfektum · перфект («уже»)»): only the little «уже» stays in the translation
    FORM_HINT: { ru: { perf: 'уже', pluskv: 'уже' }, uk: { perf: 'вже', pluskv: 'вже' } },
    /** a translation of a pronoun phrase → the form alone, lower-case, with the tense hint */
    tidyFormTr(t, q, slot, lang) {
      let s = String(t || '').replace(/\s+/g, ' ').trim();
      if (/^(jeg|å)\s/i.test(q)) s = s.replace(/^я\s+/i, '');
      if (slot !== 'imp') s = s.replace(/[.!]+$/, '');
      if (/^\p{Lu}\p{Ll}/u.test(s)) s = s.charAt(0).toLowerCase() + s.slice(1);
      const h = (this.FORM_HINT[lang] || {})[slot];
      return s && h && !s.includes('(') ? `${s} (${h})` : s;
    },
    clean: (t, max = 160) => String(t == null ? '' : t).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max),
    /** make the missing translations: [{ i, no, lang, t, by }] (never throws) */
    async makeFormTr(card, need) {
      const out = new Map(), pos = this.formPos(card), key = (i, l) => i + '|' + l;
      const put = (n, l, t, by) => { t = this.clean(t); if (t && U.norm(t) !== U.norm(n.f.no) && !out.has(key(n.i, l))) out.set(key(n.i, l), { i: n.i, no: n.f.no, lang: l, t, by }); };
      const left = () => need.flatMap(n => n.langs.filter(l => !out.has(key(n.i, l))).map(l => ({ n, l })));
      // 1) rules that are safe (from the card's own translation)
      need.forEach(n => n.langs.forEach(l => { const r = this.ruleFormTr(card, n.slot, pos, l); if (r && r.sure) put(n, l, r.t, 'rule'); }));
      // 2) one AI request for the whole card
      if (left().length && window.AI && AI.available()) {
        const ask = [...new Set(left().map(x => x.n))];
        const user = `Norwegian Bokmål word «${String(card.no).split('\n')[0].slice(0, 120)}»${pos ? ` (${pos})` : ''}; Russian meaning: «${String(card.ru || '').split('\n')[0].slice(0, 120)}»${card.uk ? `; Ukrainian: «${String(card.uk).split('\n')[0].slice(0, 120)}»` : ''}.
Translate EACH grammatical form below into Russian ("ru") and Ukrainian ("uk"): short and natural, the way a learner's dictionary shows it, keeping person, tense, number and definiteness of THAT form, in the meaning of the card.
The form's grammatical name is shown next to it, so do NOT add grammar names in brackets. Natural Russian, never a word-for-word calque.
Verbs: håper → "надеюсь / надеешься / надеется", håpet → "надеялся", har håpet → "надеялся (уже)", skal håpe → "буду надеяться", håp! → "надейся!".
Nouns: bil → "машина", bilen → "(эта) машина", biler → "машины", bilene → "(эти) машины". Adjectives: stort → "большое", større → "больше", størst → "самый большой".
Return ONLY JSON: {"forms":[{"no":"...","ru":"...","uk":"..."}]} — the same forms, the same order.
Forms: ${JSON.stringify(ask.map(n => ({ label: (window.AI && AI.formLabelText ? AI.formLabelText(n.f, 'ru') : n.f.label) || '', no: n.f.no })))}`;
        try {
          const r = AI.parseJSON(await AI.call({ system: 'You are an expert Norwegian–Russian–Ukrainian lexicographer. Answer with JSON only.', user, maxTokens: 200 + ask.length * 90, temperature: 0.1, quiet: true }));
          const arr = Array.isArray(r && r.forms) ? r.forms : Array.isArray(r) ? r : [];
          const by = 'ai:' + (AI.lastProvider || AI.current());
          ask.forEach((n, k) => {
            const hit = arr.find(x => x && U.norm(x.no || '') === U.norm(n.f.no)) || (arr[k] && (!arr[k].no || arr.length === ask.length) ? arr[k] : null);
            if (!hit) return;
            n.langs.forEach(l => put(n, l, hit[l], by));
            // the other language comes free with the same answer (kept for when the setting asks for it)
            ['ru', 'uk'].filter(l => !n.langs.includes(l) && (l === 'ru' ? !n.f.ru : !this.formMeta(card, n.f).uk)).forEach(l => put(n, l, hit[l], by));
          });
        } catch (e) { console.warn('forms: AI', e && e.message); }
      }
      // 3) rules that may be wrong (Russian plural of an unknown noun) — marked ⚙︎ like every automatic one
      left().forEach(({ n, l }) => { const r = this.ruleFormTr(card, n.slot, pos, l); if (r && r.t) put(n, l, r.t, 'rule'); });
      // 4) machine translator, per language, on short phrases
      for (const l of ['ru', 'uk']) {
        const items = left().filter(x => x.l === l);
        if (!items.length || !window.Translators || !Translators.translateMany) continue;
        const qs = items.map(x => this.formQuery(x.n.f, x.n.slot, pos));
        try {
          const res = await Translators.translateMany(qs, 'no', l, { quiet: true, noAI: true });
          const by = 'tr:' + ((res && res.by && res.by[0]) || 'google');
          items.forEach((x, k) => { const t = res && res.out && res.out[k]; if (t) put(x.n, l, this.tidyFormTr(t, qs[k], x.n.slot, l), by); });
        } catch (e) { console.warn('forms: translator', e && e.message); }
      }
      return [...out.values()];
    },
    /** write made translations into the card (only where still empty) */
    saveFormTr(cardId, res) {
      const c = Store.card(cardId);
      if (!c || !res.length) return false;
      const forms = (c.forms || []).map(f => Object.assign({}, f));
      const mirror = Object.assign({}, c.formsTr && typeof c.formsTr === 'object' ? c.formsTr : {});
      const bys = new Set();
      let n = 0;
      res.forEach(r => {
        const f = forms[r.i];
        if (!f || f.no !== r.no) return; // the forms changed meanwhile
        const m = Object.assign({}, mirror['f:' + f.no]);
        if (r.lang === 'uk') { if (this.formMeta(c, f).uk) return; f.uk = r.t; f.trByUk = r.by; m.uk = r.t; m.byUk = r.by; }
        else { if (f.ru) return; f.ru = r.t; f.trBy = r.by; m.ru = r.t; m.by = r.by; }
        mirror['f:' + f.no] = m; n++;
        if (r.by !== 'rule') bys.add(r.by);
      });
      if (!n) return false;
      const patch = { forms, formsTr: mirror };
      if (bys.size) patch.history = Prov.add(c, ...[...bys].map(by => Prov.entry(by, 'translate', null, 'перевод форм слова (автоматически)')));
      Store.updateCard(cardId, patch);
      return true;
    },
    formsSoon(cardId) {
      this._ffTimers = this._ffTimers || {};
      clearTimeout(this._ffTimers[cardId]);
      this._ffTimers[cardId] = setTimeout(() => {
        delete this._ffTimers[cardId];
        const boxes = [...document.querySelectorAll('[data-forms-box]')].filter(b => b.dataset.cid === cardId);
        // the back of a study card is not turned yet: flip() starts it
        if (!boxes.length || boxes.every(b => { const fc = b.closest('[data-card]'); return fc && !fc.classList.contains('flipped'); })) return;
        this.fillForms(cardId);
      }, 80);
    },
    async fillForms(cardId, force) {
      this._ffBusy = this._ffBusy || new Set(); this._ffTried = this._ffTried || new Set();
      const tk = cardId + '|' + this.trLang();
      if (this._ffBusy.has(cardId) || (!force && this._ffTried.has(tk))) return;
      const card = Store.card(cardId);
      const need = card ? this.formsNeed(card) : [];
      if (!need.length) return;
      this._ffBusy.add(cardId); this._ffTried.add(tk);
      this.redrawForms(cardId);
      let ok = false;
      try { ok = this.saveFormTr(cardId, await this.makeFormTr(card, need)); }
      catch (e) { console.warn('forms', e && e.message); }
      finally { this._ffBusy.delete(cardId); this.redrawForms(cardId); }
      if (force && !ok) UI.toast('Не удалось перевести форму — попробуйте позже или впишите перевод сами (✎)', '', 4000);
    },
    redrawForms(cardId) {
      const card = Store.card(cardId); if (!card) return;
      document.querySelectorAll('[data-forms-box]').forEach(b => { if (b.dataset.cid === cardId && !b.querySelector('.fg-editing')) b.outerHTML = this.formsHtml(card); });
    },
    /** ✎ inline editor of one form's translation (RU / UK by the setting) */
    editFormTr(btn) {
      const box = btn.closest('[data-forms-box]'), row = btn.closest('[data-fi]');
      const card = box && Store.card(box.dataset.cid), i = row ? +row.dataset.fi : -1, f = card && (card.forms || [])[i];
      if (!f) return;
      const open = box.querySelector('.fg-editing');
      if (open) { // one editor at a time: close the other one, then open this one in the redrawn table
        open.classList.remove('fg-editing'); this.redrawForms(card.id);
        const nb = [...document.querySelectorAll('[data-forms-box]')].find(b => b.dataset.cid === card.id);
        const again = nb && nb.querySelector(`[data-fi="${i}"] [data-ffix]`);
        if (again) this.editFormTr(again);
        return;
      }
      const cell = row.querySelector('.fg-ru'); if (!cell) return;
      const m = this.formMeta(card, f), langs = this.trLangs();
      const autos = langs.map(l => (l === 'uk' ? m.byUk : m.by)).filter(by => by && by !== 'user');
      const ed = document.createElement('span');
      ed.className = 'fg-ru fg-editing';
      ed.innerHTML = `${autos.length ? `<small class="fg-note">${autos[0].startsWith('ai:') ? BOT() : '⚙︎'} ${U.esc(this.autoTitle(autos[0]))}</small>` : ''}
        ${langs.map(l => `<input class="input fg-in" data-l="${l}" lang="${l}" value="${U.esc(l === 'uk' ? m.uk : f.ru || '')}" placeholder="${l === 'uk' ? 'переклад українською' : 'перевод на русский'}" aria-label="Перевод формы ${U.esc(f.no)} (${l.toUpperCase()})" autocomplete="off">`).join('')}
        <span class="fg-ed-act"><button type="button" class="btn sm primary" data-ffsave>✓ Сохранить</button><button type="button" class="btn sm" data-ffcancel>Отмена</button></span>`;
      cell.replaceWith(ed);
      const cancel = () => { ed.classList.remove('fg-editing'); this.redrawForms(card.id); };
      ed.querySelectorAll('input').forEach(inp => inp.addEventListener('keydown', e => {
        e.stopPropagation(); // Enter / Space / Esc must not flip the card or close the session
        if (e.key === 'Enter') { e.preventDefault(); this.saveFormEdit(ed, card.id, i); } // Esc: the window listener below
      }));
      ed.querySelector('[data-ffsave]').addEventListener('click', e => { e.stopPropagation(); this.saveFormEdit(ed, card.id, i); });
      ed.querySelector('[data-ffcancel]').addEventListener('click', e => { e.stopPropagation(); cancel(); });
      const first = ed.querySelector('input');
      setTimeout(() => { try { first.focus({ preventScroll: true }); first.select(); } catch (e) { /* ignore */ } }, 30);
    },
    saveFormEdit(ed, cardId, i) {
      const c = Store.card(cardId), f0 = c && (c.forms || [])[i];
      if (!f0) return;
      const forms = (c.forms || []).map(f => Object.assign({}, f)), f = forms[i];
      const mirror = Object.assign({}, c.formsTr && typeof c.formsTr === 'object' ? c.formsTr : {});
      const m = Object.assign({}, mirror['f:' + f.no]);
      const before = Prov.listText(c.forms);
      ed.querySelectorAll('input[data-l]').forEach(inp => {
        const v = this.clean(inp.value, 200);
        if (inp.dataset.l === 'uk') { f.uk = v; f.trByUk = 'user'; m.uk = v; m.byUk = 'user'; }
        else { f.ru = v; f.trBy = 'user'; m.ru = v; m.by = 'user'; }
      });
      mirror['f:' + f.no] = m;
      ed.classList.remove('fg-editing');
      Store.updateCard(cardId, { forms, formsTr: mirror, history: Prov.add(c, Prov.entry('manual', 'edit', { forms: { old: before, new: Prov.listText(forms) } }, 'перевод формы исправлен')) });
      this.redrawForms(cardId);
      UI.toast('Перевод формы сохранён ✓', 'good', 1600);
    },
    synonymsHtml(card) {
      const s = card.synonyms || [];
      if (!s.length) return '';
      return `<div class="forms-box syn-box"><div class="fb-title">🔁 Синонимы ${this.madeBy(card, 'synonyms')}</div>
        <div class="syn-list">${s.map(x => `<div class="syn-item">
          <div class="syn-head"><span class="syn-no">${UI.rich(x.no)}</span>${x.ru ? `<span class="syn-ru">${UI.rich('(' + x.ru + ')')}</span>` : ''}
            <button class="icon-btn sm" data-act="say" data-say="${U.esc(x.no)}" title="Произнести">${SPK()}</button></div>
          ${x.note ? `<div class="ex-note">💡 ${UI.rich(x.note)}</div>` : ''}</div>`).join('')}</div></div>`;
    },
    /* ---------- 💬 examples: as is / sentence + (translation) / word (translation) ---------- */
    EXV: [['asis', 'Как есть', 'Норвежский текст, под ним — русский'], ['sent', 'По предложениям', 'Предложение по-норвежски, сразу за ним (перевод) синим'], ['word', 'Слово (перевод)', 'Перевод в скобках после каждого слова']],
    /** split into sentences (keeps quotes / dashes with their sentence) */
    splitSent(s) {
      return String(s || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?…])["»”]?\s+(?=[«"„“(—–-]?\s*[A-ZÆØÅÄÖÜÉА-ЯЁ0-9])/u).map(x => x.trim()).filter(Boolean);
    },
    /** translations made for this view (sentences / single words) — kept on the device, reused everywhere */
    exCache() {
      if (!this._exc) {
        try { this._exc = JSON.parse(localStorage.getItem('nk-extr') || '{}'); } catch (e) { this._exc = {}; }
        Object.keys(this._exc).forEach(k => { if (k.startsWith('w:')) delete this._exc[k]; }); // old single-word garbage
        // failed translations used to be saved as empty for good — they are tried again
        if (!localStorage.getItem('nk-extr-v2')) { Object.keys(this._exc).forEach(k => { if (this._exc[k] === '') delete this._exc[k]; }); try { localStorage.setItem('nk-extr-v2', '1'); } catch (e) { /* full */ } }
        if (!localStorage.getItem('nk-extr-gg1') && window.GlossGuard) { try { this.glMigrate(this._exc); localStorage.setItem('nk-extr-gg1', '1'); } catch (e) { console.warn('gloss migrate', e); } }
      }
      return this._exc;
    },
    /** v231, once: grammar labels that are not true («var (вспом. глагол)», «som (относит. слово)») go out of every stored
     *  gloss; such a sentence gets pv 0 — glossed again the next time it is on the screen */
    glMigrate(c) {
      let n = 0;
      Object.keys(c).forEach(key => {
        if (!key.startsWith('g:')) return;
        const e = c[key], s = key.slice(2);
        const arr = Array.isArray(e) ? e : e && Array.isArray(e.g) ? e.g : null;
        if (!arr) return;
        const r = this.glGuard(s, arr);
        if (!r) return;
        if (r.blanked.length || r.stripped.length) {
          n++;
          if (Array.isArray(e)) c[key] = r.g; else { e.g = r.g; e.pv = 0; e.gv = this.GUARD_V; }
        } else if (!Array.isArray(e)) e.gv = this.GUARD_V;
      });
      if (n) { try { localStorage.setItem('nk-extr', JSON.stringify(c)); } catch (e) { /* full: the display filter still hides them */ } }
      return n;
    },
    /** the guard (js/glossguard.js) over the glosses of one sentence → { g, blanked, stripped, bad, content } or null */
    glGuard(s, arr) {
      if (!window.GlossGuard || !Array.isArray(arr)) return null;
      const lex = window.Lexicon && Lexicon.peek ? w => { try { return Lexicon.peek(w); } catch (e) { return null; } } : null;
      return GlossGuard.check(this.glossToks(s), arr, { isName: (w, k) => this.isName(w, k), lex });
    },
    /** v231: the version of the guard an AI answer went through when it was saved (gv); older ones are filtered when shown */
    GUARD_V: 1,
    /** the glosses of a stored AI answer as they may be shown: an answer saved before the guard is filtered on the fly
     *  (a stale «(вспом. глагол)» never shows, even when the new answer never comes) */
    glShown(s, e) {
      const arr = Array.isArray(e) ? e : e && e.g;
      if (!Array.isArray(arr)) return [];
      if (!Array.isArray(e) && (e.gv || 0) >= this.GUARD_V) return arr;
      const m = this._glShownM || (this._glShownM = new WeakMap()), ver = this._glVer || 0;
      const hit = m.get(e);
      if (hit && hit.v === ver) return hit.g;
      const r = this.glGuard(s, arr), g = r ? r.g : arr;
      m.set(e, { v: ver, g });
      return g;
    },
    exSave() {
      const c = this.exCache(), k = Object.keys(c);
      // sentences and AI glosses make the cache big: the oldest of them go first; single words (w2: / a: / r2:) are
      // small and stay (asking for them again would only mean more requests to Google)
      const big = k.filter(x => x.startsWith('s:') || x.startsWith('g:'));
      if (big.length > 4000) big.slice(0, big.length - 3000).forEach(x => delete c[x]);
      const small = k.filter(x => !x.startsWith('s:') && !x.startsWith('g:'));
      if (small.length > 30000) small.slice(0, small.length - 25000).forEach(x => delete c[x]);
      try { localStorage.setItem('nk-extr', JSON.stringify(c)); } catch (e) {
        big.slice(0, Math.ceil(big.length / 2)).forEach(x => delete c[x]); // full: half of the old sentences out, once more
        try { localStorage.setItem('nk-extr', JSON.stringify(c)); } catch (e2) { /* still full */ }
      }
      this._glVer = (this._glVer || 0) + 1;
    },
    // 'w2:' — the old 'w:' cache held word-by-word Google results with garbage (Хан, Var, &apos;…), it is not used any more
    wordKey: w => 'w2:' + String(w).toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''),
    bareLow: w => String(w).toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''),
    /** word tokens of one sentence (what gets a gloss) */
    glossToks(s) { return String(s).split(/\s+/).filter(w => /\p{L}/u.test(w)); },
    /** a capitalised word in the middle of a sentence = a name (Gwo, Impa, Ganon) — not translated */
    isName(w, k) { const b = String(w).replace(/^[^\p{L}]+/u, ''); return k > 0 && /^\p{Lu}/u.test(b) && !NoGloss.has(b) && !/^\p{Lu}[\p{Lu}\d]*-\p{Ll}/u.test(b); }, // «FM-båndet», «DAB-radio» are words

    /* ---------- ✓ your own corrections: they win over every machine / AI translation, everywhere ----------
     * Store.state.userTr = { s: { 'Norwegian sentence': 'your translation' }, g: { 'Norwegian sentence': { k: 'gloss' } } }
     * (part of the saved state and of backups; text only — sanitized when read, escaped when shown) */
    userTr() {
      const st = Store.state;
      if (!st) return { s: {}, g: {} };
      if (!st.userTr || typeof st.userTr !== 'object') st.userTr = { s: {}, g: {} };
      const u = st.userTr;
      if (this._utrOk !== u) { // once per state object (a restored backup brings its own): only short plain text stays
        const S = Store.Safe;
        const s = {}, g = {};
        Object.entries(u.s && typeof u.s === 'object' ? u.s : {}).slice(-5000).forEach(([k, v]) => { const t = S.text(v, 2000).trim(); if (t && typeof k === 'string') s[S.text(k, 2000)] = t; });
        Object.entries(u.g && typeof u.g === 'object' ? u.g : {}).slice(-5000).forEach(([k, m]) => {
          if (!m || typeof m !== 'object') return;
          const o = {}; Object.entries(m).forEach(([i, v]) => { if (/^\d{1,3}$/.test(i)) { const t = S.text(v, 80).trim(); if (t) o[i] = t; } });
          if (Object.keys(o).length) g[S.text(k, 2000)] = o;
        });
        u.s = s; u.g = g; this._utrOk = u;
      }
      return u;
    },
    sentKey: s => String(s || '').replace(/\s+/g, ' ').trim(),
    /** your translation of this Norwegian sentence (✓), or undefined */
    userSent(s) { const v = this.userTr().s[this.sentKey(s)]; return typeof v === 'string' && v ? v : undefined; },
    /** your gloss of word k of this sentence (✓), or undefined */
    userGloss(s, k) { const m = this.userTr().g[this.sentKey(s)]; const v = m && m[k]; return typeof v === 'string' && v ? v : undefined; },
    setUserSent(s, ru) {
      const u = this.userTr(), key = this.sentKey(s);
      ru = Store.Safe.text(String(ru || ''), 2000).replace(/\s+/g, ' ').trim();
      if (ru) u.s[key] = ru; else delete u.s[key];
      Store.save(); this._glVer = (this._glVer || 0) + 1;
    },
    setUserGloss(s, k, g) {
      const u = this.userTr(), key = this.sentKey(s);
      g = Store.Safe.text(String(g || ''), 80).replace(/\s+/g, ' ').trim();
      const m = u.g[key] || (u.g[key] = {});
      if (g) m[k] = g; else delete m[k];
      if (!Object.keys(m).length) delete u.g[key];
      Store.save(); this._glVer = (this._glVer || 0) + 1;
    },

    /** translation of a sentence: yours ✓ > saved > just arrived from the translation that is still running */
    sentTr(s) { const u = this.userSent(s); if (u) return u; const v = this.exCache()['s:' + s]; return v !== undefined ? v : Translators.cached(s); },
    /** a short fingerprint of a sentence translation: AI glosses made for another translation are not used */
    ruHash(ru) { let h = 5381; const t = String(ru || '').replace(/\s+/g, ' ').trim(); for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0; return h.toString(36) + t.length.toString(36); },
    /** machine output for a single word: drop garbage (latin only, HTML entities, «& …», very long) */
    cleanGloss(src, out) {
      let t = String(out || '').replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/^[&%#\s\d]+/, '').trim();
      if (!/[а-яё]/i.test(t) || t.length > String(src).length * 3 + 16) return '';
      if (/^\p{Ll}/u.test(src)) t = t.charAt(0).toLowerCase() + t.slice(1);
      return t;
    },
    /** dictionary forms of a word (Norsk ordbank, when it is loaded): «ønska» → ['ønske'] */
    lemmasOf(w) {
      const p = window.Lexicon && Lexicon.peek(w);
      return p ? [...new Set(p.slice(0, 2).map(x => String(x.lemma).toLowerCase()))] : [];
    },
    /** your own one-word cards: «hus» → ['дом'] — the first place to look for a word's meaning */
    cardDict() {
      const cards = (Store.state && Store.state.cards) || [];
      const sig = cards.length + ':' + (Store.state && Store.state.savedAt || 0);
      if (this._cdSig === sig && this._cd) return this._cd;
      if (this._cd && Date.now() - (this._cdT || 0) < 20000 && this._cdSig && this._cdSig.split(':')[0] === String(cards.length)) return this._cd;
      const m = new Map();
      cards.forEach(c => {
        const no = String(c.no || '').split('\n')[0].trim().toLowerCase().replace(/^(en|ei|et|å)\s+/, '');
        if (!no || /\s/.test(no) || !c.ru) return;
        const ru = Align.split(String(c.ru).split('\n')[0]).slice(0, 4);
        if (ru.length) m.set(no, [...(m.get(no) || []), ...ru].slice(0, 6));
      });
      this._cd = m; this._cdSig = sig; this._cdT = Date.now(); this._glVer = (this._glVer || 0) + 1;
      return m;
    },
    /** lookups for the meaning-first alignment — all synchronous, from what is already saved */
    glLook() {
      const c = this.exCache(), cd = this.cardDict();
      return {
        cards: w => cd.get(w) || [],
        dict: w => NoGloss.get(w),
        mt: w => { const v = c['w2:' + w]; if (v !== undefined) return v; const t = Translators.cached(w); return t !== undefined ? this.cleanGloss(w, t) : undefined; },
        alts: w => c['a:' + w],
        lemmas: w => this.lemmasOf(w),
      };
    },
    /** every word of the sentence matched against its translation (Align, no network) — remembered until something changes */
    alignOf(sent, ru) {
      const L = this.glLook(); // (may bump the version when your cards changed)
      const ver = this._glVer || 0;
      if (!this._alm || this._almVer !== ver) { this._alm = new Map(); this._almVer = ver; }
      const key = sent + '\u0001' + (ru || '');
      let r = this._alm.get(key);
      if (r) return r;
      const toks = this.glossToks(sent), c = this.exCache();
      r = Align.align(toks, ru || '', k => Align.candidates(toks[k], L), {
        skip: k => this.isName(toks[k], k) || !/\p{L}/u.test(toks[k]) || /^\P{L}*\d[\d\P{L}]*$/u.test(toks[k]),
        rev: w => c['r2:' + w],
        same: (no, k) => Align.sameNo(no, toks[k], w => this.lemmasOf(w)),
        isFunc: w => NoGloss.has(w),
        wait: k => { const f = this.bareLow(toks[k]); return !NoGloss.has(f) && L.mt(f) === undefined; },
      });
      if (this._alm.size > 4000) this._alm.clear();
      this._alm.set(key, r);
      return r;
    },
    /**
     * gloss of word k of a sentence and where it comes from (how):
     *   user  — yours ✓ (wins over everything)
     *   ai    — the neural network, made from THIS sentence translation (a changed translation = not used any more)
     *   align — the meaning found in the sentence translation, in the form the translation uses
     *   dict  — the hand-made list (one meaning)
     *   guess — a single-word translation not found in the sentence translation: shown as uncertain «?»
     *   skip / none / wait — a name or number / nothing / still coming
     * ru: the sentence translation the reader sees (default: yours ✓ or the saved one)
     */
    glossInfo(sent, k, ru) {
      if (ru === undefined) ru = this.sentTr(sent);
      const u = this.userGloss(sent, k); if (u !== undefined) return { g: u, how: 'user' };
      const toks = this.glossToks(sent), w = toks[k];
      if (w === undefined) return { g: undefined, how: 'wait' };
      if (this.isName(w, k) || !/\p{L}/u.test(w)) return { g: '', how: 'skip' };
      const ai = this.exCache()['g:' + sent];
      if (ai && !Array.isArray(ai) && ru && ai.h === this.ruHash(ru) && Array.isArray(ai.g) && ai.g[k]) { const gk = this.glShown(sent, ai)[k]; if (gk) return { g: gk, how: 'ai' }; }
      const r = this.alignOf(sent, ru)[k] || { g: undefined, how: 'wait' };
      // glosses an older version made with AI (without the translation): better than a bare guess
      if (r.how !== 'align' && r.how !== 'dict' && Array.isArray(ai) && ai[k]) { const gk = this.glShown(sent, ai)[k]; if (gk && !Align.echoes(w, gk)) return { g: gk, how: 'ai' }; }
      return r;
    },
    /** gloss text only (older callers): '' = name / nothing, undefined = still coming */
    glossOf(sent, w, k, ru) { return this.glossInfo(sent, k, ru).g; },
    /** sentence pairs: the human translation when the sentences match one to one, otherwise each sentence translated;
     *  your own ✓ translation of a sentence wins */
    exPairs(x) {
      const ns = this.splitSent(x.no), rs = this.splitSent(x.ru);
      const mine = this.userSent(x.no);
      let out;
      if (mine && ns.length === 1) out = [{ no: ns[0], ru: mine }];
      else if (x.ru && ns.length === rs.length) out = ns.map((no, i) => ({ no, ru: rs[i] }));
      else if (x.ru && ns.length === 1) out = [{ no: ns[0], ru: x.ru }];
      else out = ns.map(no => ({ no, ru: this.sentTr(no), mt: true }));
      return out.map(p => { const u = this.userSent(p.no); return u ? { no: p.no, ru: u, mine: true } : p; });
    },
    /** the translation a sentence of an example is glossed against (the same one the reader sees under it) */
    exWordRu(x, p) { return p.ru || this.userSent(x.no) || x.ru || undefined; },
    examplesHtml(card) {
      const e = card.examples || [];
      if (!e.length) return '';
      const v = Store.settings.exView || 'asis';
      const say = (t, lang) => t ? `<button class="icon-btn sm ex-say" data-act="say" data-say="${U.esc(t)}" data-lang="${lang}" title="${lang === 'ru' ? 'Произнести только русский' : 'Произнести по-норвежски'}">${SPK()}${lang === 'ru' ? '<small>RU</small>' : ''}</button>` : '';
      const c = this.exCache();
      let mt = false;
      const body = x => {
        if (v === 'sent') {
          const pairs = this.exPairs(x);
          if (pairs.some(p => p.mt)) mt = true;
          return pairs.map(p => `<div class="ex-sent"><span class="ex-no">${UI.rich(p.no)}</span> <span class="ex-ru-in">(${p.ru ? UI.rich(p.ru) : p.ru === '' ? '—' : '…'})</span> ${say(p.no, 'no')}${say(p.ru, 'ru')}${p.ru ? this.trFixHtml(p.no) : ''}</div>`).join('');
        }
        if (v === 'word') {
          mt = true;
          const pairs = this.exPairs(x);
          const words = pairs.map(p => this.glossHtml(p.no, this.exWordRu(x, p))).join(' ');
          const xr = this.userSent(x.no) || x.ru;
          // no translation of its own: the sentence translation(s) the words follow are shown under them (with ✎)
          const mtRu = !xr ? pairs.filter(p => p.ru).map(p => `${U.esc(p.ru)}${this.trFixHtml(p.no)}`).join(' ') : '';
          return `<div class="ex-no wbw-line">${words} ${say(x.no, 'no')}</div>${xr ? `<div class="ex-ru">${UI.rich(xr)} ${say(xr, 'ru')}${this.trFixHtml(x.no)}</div>` : mtRu ? `<div class="ex-ru">${mtRu}</div>` : ''}${this.litHtml(pairs.map(p => [p.no, this.exWordRu(x, p)]))}`;
        }
        const xr = this.userSent(x.no) || x.ru;
        return `<div class="ex-no">${UI.rich(x.no)} ${say(x.no, 'no')}</div>${xr ? `<div class="ex-ru">${UI.rich(xr)} ${say(xr, 'ru')}${this.trFixHtml(x.no)}</div>` : ''}`;
      };
      const rows = e.map((x, i) => `<div class="ex-row"><span class="fg-label">${window.Gram ? Gram.label(x.label) : U.esc(x.label)}</span><div class="ex-body">${body(x)}
          <div class="ex-tools"><span class="seg-mini ex-view sm" title="Как показывать перевод (для всех примеров)">${this.EXV.map(([id, l, t]) => `<button class="${v === id ? 'active' : ''}" data-act="ex-view" data-v="${id}" title="${t}">${l}</button>`).join('')}</span>
            <button class="btn sm ghost" data-act="ex-read" data-i="${i}" title="Читать вслух: предложение по-норвежски → его перевод, и так до конца">🔁 Слушать: норвежский → русский</button></div>
          ${x.note ? `<div class="ex-note">💡 ${U.esc(x.note)}</div>` : ''}</div></div>`).join('');
      const by = this._exBy && this._exBy.length ? this._exBy.map(id => id === 'ai' ? AI.name(Translators.lastAI) : (Translators.LIST[id] || {}).name || id).join(' + ') : '';
      return `<div class="forms-box ex-box"><div class="fb-title">💬 Примеры по формам ${this.madeBy(card, 'examples')}</div>
        ${rows}${this.reglossWhere(card) === 'ex' ? this.reglossHtml(card) : ''}
        ${mt ? `<div class="tiny muted ex-mt">⚠️ ${v === 'word'
          ? `Перевод слов — по смыслу: ${(this._exBy || []).includes('ai') ? `${U.esc(AI.name(Translators.lastAI))} разложил перевод предложения по словам` : `слово берётся из перевода всего предложения${by ? ' (' + U.esc(by) + ')' : ''}; слово с «?» в переводе не нашлось — это перевод без контекста, он может не совпадать по смыслу. Подключите нейросеть — она разложит смысл предложения по каждому слову`}. Нажмите на перевод слова, чтобы исправить его.`
          : `Перевод предложений — машинный${by ? ' (' + U.esc(by) + ')' : ''}, перепроверяйте.`}</div>` : ''}</div>`;
    },
    /** 🔁 read one example aloud: Norwegian sentence → its translation → next (sentences translated first if needed) */
    async exRead(card, i, a) {
      const x = (card.examples || [])[i]; if (!x) return;
      let pairs = this.exPairs(x);
      const miss = pairs.filter(p => !p.ru).map(p => p.no);
      if (miss.length) {
        // sentences of the human translation don't match one to one — translate each Norwegian sentence first
        const label = a && a.innerHTML;
        if (a) { a.disabled = true; a.innerHTML = '<span class="spinner sm"></span> перевожу по предложениям…'; }
        try {
          const res = await Translators.translateMany(miss, 'no', 'ru');
          const c = this.exCache();
          miss.forEach((s, k) => { c['s:' + s] = res.out[k] ? String(res.out[k]).trim() : ''; });
          this._exBy = [...new Set([...(this._exBy || []), ...res.by])];
          this.exSave();
        } catch (err) { UI.toast('Перевод: ' + err.message, 'warn'); }
        if (a && a.isConnected) { a.disabled = false; a.innerHTML = label; }
        pairs = this.exPairs(x);
      }
      // the reader picks the voice by the alphabet: Norwegian / Russian
      TTS.speakText(pairs.map(p => p.ru ? `${p.no}\n${p.ru}` : p.no).join('\n'), 'all');
    },
    /** translate what the chosen view needs (sentences / words), then redraw the examples box (or call onDone) */
    async fillExamples(card, onDone) {
      const v = Store.settings.exView || 'asis';
      const units = card ? this.descUnits(card) : [];
      const main = card ? this.mainNo(card) : '';
      if (v === 'asis' || !card || (!(card.examples || []).length && !units.length && !main) || (this._exBusy && this._exBusy.id === card.id && this._exBusy.v === v)) return;
      const sentNeed = [], wordSents = [];
      // the card's own Norwegian text: its sentences (sentence view) or its words (word view)
      if (main) {
        const ss = this.splitSent(main).filter(s => /\p{L}/u.test(s));
        if (v === 'sent' && ss.length > 1) ss.forEach(s => { if (this.sentTr(s) === undefined) sentNeed.push(s); });
        // meaning first: each sentence with the translation its words must follow (the same one shown on the card)
        if (v === 'word') wordSents.push(...ss.map(s => ({ s, ru: this.mainRu(card, s, ss.length) })));
      }
      (card.examples || []).forEach(x => {
        if (v === 'sent') this.exPairs(x).forEach(p => { if (p.mt && p.ru === undefined) sentNeed.push(p.no); });
        else this.exPairs(x).forEach(p => wordSents.push({ s: p.no, ru: this.exWordRu(x, p) }));
      });
      // description lines (grammar, Ordbøkene, explanations): a line without its own translation also gets the whole
      // sentence translated (shown under the words); in the word view every line is glossed
      units.forEach(u => { if (!u.ru) sentNeed.push(u.no); if (v === 'word') wordSents.push({ s: u.no, ru: this.userSent(u.no) || u.ru || undefined }); });
      const run = this._exBusy = { id: card.id, v }; // the next card may start its own run while an old answer is still awaited
      // lines appear one by one while the translation runs
      let t = null;
      const put = Translators.onPut = () => { if (t) return; t = setTimeout(() => { t = null; if (gone()) return; if (onDone) onDone(); else this.redrawExamples(card.id); }, 500); };
      // the person left this card (another card, the home screen…): the rest is not asked for — and the note goes away
      let left = false; // once left, this run stays stopped (the card may come again later: it then starts its own run)
      const gone = () => { if (onDone) return false; if (left) return true; const cur = this.current(); return (left = !(window.App && App.view && App.view.name === 'study') || !cur || !cur.card || cur.card.id !== card.id); };
      // in the background: no «Подождите» window over the card — a small note at the bottom says who signs the words;
      // the card can be studied meanwhile, the glosses appear as they come (and are kept: each sentence only once)
      const note = this.glNote(!!onDone); // a viewer window (onDone) → the pill above it
      const watch = setInterval(() => { if (gone()) { note.close(); if (this._exBusy === run) this._exBusy = false; } }, 400);
      const failAt = (this._glFail && this._glFail.at) || 0;
      let failed = false;
      try {
        await this.translateUnits(sentNeed, wordSents, { quiet: true, cancel: gone, onProgress: (d, n, ph) => { if (!gone()) note.set(d, n, ph); } });
        failed = !!(this._glFail && this._glFail.at > failAt) && !gone();
      } finally {
        if (Translators.onPut === put) Translators.onPut = null; clearTimeout(t); clearInterval(watch);
        // v231: never a technical error here — a short, calm line in the same chip, then it goes
        if (failed) note.flash('не удалось подписать — попробую ещё раз'); else note.close();
        // a stuck run must never hold the next one (_exBusy is always released)
        if (this._exBusy === run) this._exBusy = false;
      }
      if (gone()) return; // the glosses are kept in the cache: they show when this card comes again
      if (onDone) onDone(); else this.redrawExamples(card.id);
      // the failed sentences are asked again while the card is still on the screen (20 s, 1 min, 3 min; 3 tries a session)
      if (failed && !onDone) {
        const wait = this.glRetryIn(wordSents.map(x => x.s));
        if (wait >= 0) { clearTimeout(this._glRetryT); this._glRetryT = setTimeout(() => { const cur = this.current(); if (cur && cur.card && cur.card.id === card.id && window.App && App.view && App.view.name === 'study') this.fillExamples(Store.card(card.id) || card); }, wait + 300); }
      }
      if (this._lastFail) this.failModal(() => this.fillExamples(Store.card(card.id) || card, onDone));
    },
    /** the quiet note while the words of a card are being signed: «🤖 Gemini подписывает слова · 1 из 4 — учить можно уже сейчас» */
    glNote(float) {
      let el = null, last = null, tick = 0;
      // where it goes — never over the card (art cards, «Картинкой» and «Текстом» fill the whole frame down to the buttons):
      // the study screen → a chip in the counters line above the card («✓ знаю · ✗ не знаю · осталось»);
      // the phone (focus mode hides that line) → a small line under the progress bar in the top bar;
      // elsewhere (viewer windows) → the small pill at the bottom of the screen
      const hostOf = () => {
        if (float) return null;
        if (document.documentElement.classList.contains('m-phone')) return document.querySelector('#view .study > .m-study-head .m-prog');
        const hc = document.querySelector('#view .counters'); return hc && hc.offsetParent !== null ? hc : null;
      };
      const close = () => { clearInterval(tick); tick = 0; last = null; if (el) { const e = el; el = null; e.classList.add('out'); setTimeout(() => e.remove(), 300); } };
      const draw = () => {
        if (!last) return;
        const { d, n, ph } = last, host = hostOf();
        const cls = host ? (host.classList.contains('m-prog') ? 'gl-note gl-inline gl-head' : 'gl-note gl-inline') : 'gl-note';
        if (!el || el.parentNode !== (host || document.body)) {
          document.querySelectorAll('.gl-note').forEach(x => { if (x !== el) x.remove(); });
          if (!el) { el = document.createElement('span'); el.setAttribute('role', 'status'); el.innerHTML = '<span class="gl-note-i" aria-hidden="true"></span><span class="gl-note-t"></span>'; }
          (host || document.body).appendChild(el);
        }
        el.className = cls;
        const ai = ph === 'ai', who = ai && window.AI ? AI.name() : 'Переводчик';
        if (ai && window.App && App.aiLogo && window.AI) { const i = el.querySelector('.gl-note-i'); if (i._k !== AI.current()) { i._k = AI.current(); try { i.innerHTML = App.aiLogo(AI.current()); } catch (e) { i.textContent = '🤖'; } } }
        const what = ai ? 'подписывает перевод под каждым словом' : ph === 'words' ? 'ищет значения слов' : 'переводит предложения';
        // the count moves only when a whole request comes back (up to 8 sentences each): while the first one is still
        // awaited «0 из 4» would look stuck — «…» says «working»; afterwards the honest «8 из 20»
        const cnt = d > 0 ? ` · ${d} из ${n}` : '…';
        const full = `${who} ${what}${cnt} — учить можно уже сейчас`;
        el.title = d > 0 ? full : `${who} ${what} (${n}) — учить можно уже сейчас`;
        el.querySelector('.gl-note-t').textContent = host ? `${who} ${ai ? 'подписывает слова' : ph === 'words' ? 'ищет значения' : 'переводит'}${cnt}` : full;
      };
      const set = (d, n, ph) => {
        if (!n) return;
        last = { d, n, ph };
        // the phone's top bar is built right after the study screen is drawn: a moment later, not the pill in between
        if (!el && !hostOf() && document.documentElement.classList.contains('m-phone') && document.querySelector('#view .study')) setTimeout(draw, 0); else draw();
        // the place may change meanwhile (phone turned, the top bar redrawn): follow it
        if (!tick) tick = setInterval(() => { if (el && el.parentNode !== (hostOf() || document.body)) draw(); }, 400);
      };
      /** a short calm line in the same place («не удалось подписать — попробую ещё раз»), then the note goes */
      const flash = text => {
        if (!last) last = { d: 0, n: 1, ph: 'ai' };
        draw();
        if (!el) return;
        clearInterval(tick); tick = 0;
        const tt = el.querySelector('.gl-note-t'); if (tt) tt.textContent = text;
        el.title = text; el.classList.add('gl-fail');
        const me = el; setTimeout(() => { if (el === me) close(); }, 3500);
      };
      return { set, close, flash };
    },
    /**
     * shared by cards, the card viewer and the textbook reader: translate these sentences (cache 's:') and gloss every
     * word of those sentences (AI in context → cache 'g:'; otherwise hand-made list + single words → cache 'w2:')
     */
    /**
     * the translator refused (limit, no internet…): a window in the middle of the screen says why,
     * with a big «🔄 Повторить перевод» button — nothing to look for
     */
    failModal(retry) {
      const f = this._lastFail; if (!f || document.querySelector('.tr-fail-modal')) return;
      const S = Store.settings;
      const googleDown = /google/i.test(f.error || '');
      const cur = Translators.dictMain();
      // every translator and every neural network: can it translate right now, and if not — what it needs
      const mac = window.Net && Net.onMac ? Net.onMac() : AI.onMac();
      const here = id => { const t = Translators.LIST[id]; return !!t && !t.hidden && (mac || (!t.web && id !== 'deepl')); };
      const TR = [
        ['google', 'Google Переводчик', googleDown ? 'сейчас отказывает вам' : '✓ бесплатно, без ключа', !googleDown],
        ['mozhi', 'Mozhi (Google через открытый сервер)', '✓ бесплатно, без ключа — переводит со своего сервера, ограничение вашего адреса на него не действует', true],
        ['mymemory', 'MyMemory', '✓ бесплатно, без ключа · до ≈5000 символов в день', true],
        ['deepl', 'DeepL', (S.deeplKey || '').trim() ? '✓ ключ есть' : 'нужен бесплатный ключ (500 000 символов в месяц) и мост на Mac', !!(S.deeplKey || '').trim()],
        ['microsoft', 'Microsoft Translator', (S.msKey || '').trim() ? '✓ ключ есть' : 'нужен ключ Azure (2 млн символов в месяц бесплатно)', !!(S.msKey || '').trim()],
      ].filter(([id]) => here(id));
      const AIs = Object.entries(AI.PROVIDERS).filter(([id]) => id !== 'custom' && (mac || !AI.usableHere || AI.usableHere(id))).map(([id, p]) => {
        // a program on the Mac (Ollama) needs no key, so «configured» is always true — it counts only once it was chosen
        const ok = AI.configured(id) && (!p.noKey || AI.current() === id);
        const why = ok ? '✓ подключена — переводит по смыслу, без ограничений Google'
          : id === 'claude' ? (AI.bridge && AI.bridge.up ? 'войдите в Claude Code (в Терминале: claude → /login)' : (mac ? 'нужен мост на Mac и подписка Claude' : 'работает только в версии для Mac'))
          : p.noKey ? 'установите программу на Mac' : `нужен ключ${p.free ? ' — бесплатный' : ''}${p.limits ? ' · ' + p.limits : ''}`;
        return [id, p.name, why, ok];
      }).sort((a, b) => b[3] - a[3]);
      const item = (kind, [id, name, why, ok]) => `<button class="tr-pick ${ok ? 'ok' : 'need'} ${(kind === 'tr' && id === cur) || (kind === 'ai' && cur === 'ai' && id === AI.current()) ? 'cur' : ''}" data-pick="${kind}:${id}">
          <span class="tr-pick-ico">${kind === 'tr' ? Translators.icon(id, 22) : (AI.icon(id, 22) || BOT(22))}</span>
          <span class="tr-pick-txt"><b>${U.esc(name)}</b><small>${U.esc(why)}</small></span>
          <span class="tr-pick-go">${ok ? 'Выбрать' : kind === 'tr' && id === 'google' ? 'Повторить' : 'Подключить'}</span></button>`;
      const m = UI.modal({
        title: googleDown ? 'Google Переводчик сейчас не работает' : 'Перевод не пришёл', cls: 'tr-fail-modal',
        body: `${googleDown ? `<div class="mt-warn">${NI('alert', 18)}<span><b>Google временно перестал переводить для вашего адреса</b> — слишком много переводов за короткое время. Это ограничение самого Google (не книги и не приложения); обычно снимается через 5–15 минут. <b>Выберите другой переводчик или нейросеть ниже</b> — перевод сразу продолжится.</span></div>` : ''}
          <div class="fail-hero">
            <button class="media-btn main fail-retry" data-retry title="Повторить перевод" aria-label="Повторить перевод">${UI.icon('retry', 30)}</button>
            <b>Повторить перевод</b>
            <span class="small muted">Не переведено: ${f.missing} ${U.plural(f.missing, ['строка', 'строки', 'строк'])}${googleDown ? '' : ` · причина: ${U.esc(f.error)}`}</span>
          </div>
          ${TR.length ? `<div class="tr-pick-title ui-t">${NI('translate')}<span>Переводчики</span></div>
          <div class="tr-pick-list">${TR.map(x => item('tr', x)).join('')}</div>` : ''}
          <div class="tr-pick-title">${BOT()} Нейросети — точнее всего (переводят по смыслу предложения)</div>
          <div class="tr-pick-list">${AIs.map(x => item('ai', x)).join('')}</div>
          <p class="tiny muted">Выбор сохраняется (Настройки → «Переводчик для статей словарей»). Если выбранный не ответит — приложение само попробует следующий.</p>`,
        foot: '<button class="btn ghost" data-x>Закрыть</button>',
      });
      const toSettings = msg => { document.querySelectorAll('.modal-backdrop [data-close]').forEach(b => b.click()); App.go('settings'); if (msg) UI.toast(msg, '', 7000); };
      m.$('[data-retry]').onclick = () => { m.close(); retry(); };
      m.$('[data-x]').onclick = () => m.close();
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-pick]'); if (!b) return;
        const [kind, id] = b.dataset.pick.split(':');
        if (kind === 'tr') {
          // Google needs no key: when it refuses, its button just tries it again
          if (!b.classList.contains('ok') && id !== 'google') { toSettings(`${Translators.LIST[id].name}: впишите ключ в Настройках → «Переводчики»`); return; }
          Store.setSetting('dictTranslator', id);
          UI.toast(`Теперь переводит: ${Translators.LIST[id].name}`, 'good');
        } else {
          if (!b.classList.contains('ok')) { toSettings(id === 'claude' ? (mac ? 'Claude: запустите мост и войдите в Claude Code (claude → /login), затем выберите его вверху' : 'Claude по подписке работает только в приложении на Mac — выберите другую нейросеть (Gemini или Groq — бесплатно)') : AI.PROVIDERS[id].noKey ? `${AI.PROVIDERS[id].short}: установите программу на Mac, затем выберите её в Настройках → «Нейросети»` : `${AI.PROVIDERS[id].name}: впишите ключ в Настройках → «Нейросети»`); return; }
          Store.setSetting('aiProvider', id); Store.setSetting('dictTranslator', 'ai'); App.updateBadge();
          UI.toast(`Теперь переводит нейросеть: ${AI.PROVIDERS[id].name}`, 'good');
        }
        m.close(); retry();
      });
      // no scrolling to it: on a phone the explanation and the big retry button must stay in view
      setTimeout(() => { const b = m.$(googleDown ? '[data-pick="tr:mozhi"]' : '[data-retry]'); if (b) b.focus({ preventScroll: true }); }, 80);
    },
    /**
     * translate what a view needs. sentNeed: sentences (cache 's:'). wordSents: sentences of the word view — strings or
     * { s, ru } with the translation the reader sees. MEANING FIRST: a sentence is translated as a whole before its
     * words; then a connected neural network distributes that translation over the words (cache 'g:', tied to the
     * translation), otherwise every word is looked up in the translation (Align: dictionary, your cards, single-word
     * translations, back-translation — cached for good).
     * opts.quiet: in the background (subtitles, TV) — no «please wait» window, no toasts; opts.onProgress(done, total, phase);
     * opts.cancel() → true stops between batches.
     */
    async translateUnits(sentNeed = [], wordSents = [], opts = {}) {
      this._lastFail = null;
      const c = this.exCache();
      const quiet = !!opts.quiet;
      const items = [], seen = new Set();
      (wordSents || []).forEach(x => {
        const s = typeof x === 'string' ? x : x && x.s;
        if (!s || seen.has(s) || !/\p{L}/u.test(s)) return;
        seen.add(s);
        items.push({ s, ru: x && typeof x === 'object' && x.ru ? String(x.ru) : undefined });
      });
      const sNeed = [...new Set([...(sentNeed || []), ...items.filter(it => it.ru === undefined).map(it => it.s)])].filter(s => s && this.sentTr(s) === undefined);
      try {
        if (sNeed.length) {
          if (opts.onProgress) opts.onProgress(0, sNeed.length, 'sent');
          const res = await Translators.translateMany(sNeed, 'no', 'ru', { quiet });
          // no answer = not saved (it is tried again next time)
          sNeed.forEach((s, i) => { if (res.out[i]) c['s:' + s] = String(res.out[i]).trim(); });
          this._exBy = [...new Set([...(this._exBy || []), ...res.by])];
          this._lastFail = res.missing ? { missing: res.missing, error: res.error } : null;
          this.exSave();
        }
        if (!items.length || (opts.cancel && opts.cancel())) return;
        items.forEach(it => { if (it.ru === undefined) it.ru = this.sentTr(it.s) || ''; });
        // dictionary forms (ønska → ønske) help to find the meaning; the word list is loaded once (offline afterwards)
        if (window.Lexicon && !Lexicon.loaded()) { try { await Lexicon.ready(); this._glVer = (this._glVer || 0) + 1; } catch (e) { /* forms only */ } }
        if (AI.available()) await this.aiGloss(items, opts);
        // the word fallback (dictionary + single words + the sentence translation) for every sentence the AI did not settle:
        // no answer, an old / failed («stale») one, or one whose wrong labels the guard blanked (v231 — before, an old
        // answer counted as done and «var» stayed without any meaning)
        const left = items.filter(it => !this.aiDone(it, true) || this.glHoles(it));
        if (left.length && !(opts.cancel && opts.cancel())) await this.wordCands(left, opts);
        this.exSave();
      } catch (e) { if (!quiet) UI.toast('Перевод: ' + e.message, 'warn'); }
    },
    /** the version of the gloss prompt: an AI answer made with an older prompt (no «pv», or a smaller one) is still shown,
     *  but the sentence is glossed again the next time it is on the screen (v226: honest glosses + «Дословно») */
    GLOSS_PV: 2,
    /** this sentence has AI glosses made from its current translation (or all its words are yours).
     *  strict: and made with the current prompt (older answers stay on the screen until the new one comes) */
    aiDone(it, strict) {
      const g = this.exCache()['g:' + it.s];
      if (g && !Array.isArray(g) && it.ru && g.h === this.ruHash(it.ru) && (!strict || ((g.pv == null ? 1 : g.pv) >= this.GLOSS_PV && !g.stale))) return true;
      const toks = this.glossToks(it.s);
      return toks.length > 0 && toks.every((w, k) => this.userGloss(it.s, k) !== undefined || this.isName(w, k));
    },
    /** the AI answer of this sentence has words without a meaning (blanked by the guard): they need the word fallback */
    glHoles(it) {
      const e = this.exCache()['g:' + it.s];
      if (!e) return false;
      const g = this.glShown(it.s, e), toks = this.glossToks(it.s);
      return toks.some((w, k) => !g[k] && !this.isName(w, k) && this.userGloss(it.s, k) === undefined && /\p{L}/u.test(w));
    },
    /** the AI answer for one sentence → clean glosses (1:1 with the words), or null when it does not fit.
     *  v231: the guard (js/glossguard.js) blanks grammar labels that are not true; more than 30 % of the content words
     *  blanked → the whole answer is rejected (it._rej: the next AI is asked once) */
    aiValid(it, arr) {
      const toks = this.glossToks(it.s);
      if (!Array.isArray(arr) || arr.length !== toks.length) return null;
      let filled = 0, want = 0;
      const g = arr.map((x, k) => {
        let t = Store.Safe.text(typeof x === 'string' ? x : x == null ? '' : String(x), 80).replace(/\s+/g, ' ').trim();
        const name = this.isName(toks[k], k);
        if (!name) want++;
        if (!t || name) return name ? '' : t;
        if (!/[а-яё]/i.test(t) || Align.echoes(toks[k], t)) return ''; // Latin garbage, «Han» → «Хан»
        filled++;
        return t;
      });
      if (!(want && filled >= Math.ceil(want / 2))) return null;
      const r = this.glGuard(it.s, g);
      if (!r) return g;
      if (window.GlossGuard && GlossGuard.reject(r)) { it._rej = true; return null; }
      const left = r.g.filter((x, k) => x && !this.isName(toks[k], k)).length;
      return left >= Math.ceil(want / 2) ? r.g : (it._rej = true, null);
    },
    /** a broken AI answer (cut off at max_tokens): the complete items before the cut, or [] */
    aiSalvage(text) {
      const t = String(text || ''), out = [];
      const a = t.indexOf('[');
      if (a < 0) return out;
      let depth = 0, str = false, esc = false, from = -1;
      for (let i = a + 1; i < t.length; i++) {
        const ch = t[i];
        if (str) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') str = false; continue; }
        if (ch === '"') { str = true; continue; }
        if (ch === '{' || ch === '[') { if (depth === 0) from = i; depth++; }
        else if (ch === '}' || ch === ']') {
          if (depth === 0) break; // the end of the outer list
          depth--;
          if (depth === 0 && from >= 0) { try { out.push(JSON.parse(t.slice(from, i + 1))); } catch (e) { return out; } from = -1; }
        }
      }
      return out;
    },
    /** the AI answer → its JSON; a cut-off list keeps its complete items */
    aiParse(text) {
      try { return AI.parseJSON(text); } catch (e) { const s = this.aiSalvage(text); if (s.length) return s; throw e; }
    },
    /** tokens for one gloss request: ≈ 600 + 24 per word + 2 per character of every sentence (the glosses AND «Дословно»
     *  come back; Gemini's thinking is counted inside max_tokens too) — v226 asked for half of that and the answer was cut */
    glossBudget(part) {
      const n = part.reduce((a, p) => a + 24 * this.glossToks(p.s).length + 2 * String(p.s).length + 2 * String(p.ru || '').length, 0);
      return Math.min(8192, 600 + n);
    },
    /* ---------- a gloss request that failed: kept on the screen, asked again later (v231) ----------
     * per session: at most 3 tries per sentence, the next one after 20 s, 1 min, 3 min */
    GL_BACKOFF: [20e3, 60e3, 180e3],
    glMayTry(s) { const r = (this._glTry || (this._glTry = new Map())).get(s); return !r || (r.n < 3 && Date.now() >= r.next); },
    glFailed(s, provider, reason) {
      const m = this._glTry || (this._glTry = new Map()), r = m.get(s) || { n: 0, next: 0 };
      r.n++; r.next = Date.now() + this.GL_BACKOFF[Math.min(r.n, this.GL_BACKOFF.length) - 1];
      m.set(s, r);
      const e = this.exCache()['g:' + s];
      if (e && !Array.isArray(e)) e.stale = Date.now(); // the old answer stays on the screen (filtered) but is not «done»
      this._glFail = { at: Date.now(), provider, reason };
    },
    /** when the next failed sentence of these may be asked again (ms from now), or -1: none left to try this session */
    glRetryIn(sents) {
      const m = this._glTry; if (!m) return -1;
      let best = -1;
      sents.forEach(s => { const r = m.get(s); if (r && r.n < 3) { const d = Math.max(0, r.next - Date.now()); if (best < 0 || d < best) best = d; } });
      return best;
    },
    /** one item of the AI answer: { gloss: [...], literal: '…' } (v226) or the plain list of glosses (older prompt) */
    aiItem(x) {
      if (Array.isArray(x)) return { gloss: x, literal: '' };
      if (x && typeof x === 'object') {
        const gl = Array.isArray(x.gloss) ? x.gloss : Array.isArray(x.glosses) ? x.glosses : Array.isArray(x.words) ? x.words : null;
        return { gloss: gl, literal: typeof x.literal === 'string' ? x.literal : typeof x.lit === 'string' ? x.lit : '' };
      }
      return { gloss: null, literal: '' };
    },
    /** the whole AI answer → the list of items (a bare array, or { items: [...] } from a network that only answers objects) */
    aiItems(ans) {
      if (Array.isArray(ans)) return ans;
      if (ans && typeof ans === 'object') { const k = ['items', 'sentences', 'result', 'results', 'glosses'].find(n => Array.isArray(ans[n])); if (k) return ans[k]; }
      return [];
    },
    /** «Дословно»: the literal rendering, only when it really differs from the free translation the reader sees */
    litClean(lit, ru) {
      const t = Store.Safe.text(typeof lit === 'string' ? lit : '', 300).replace(/\s+/g, ' ').trim();
      if (!t || !/[а-яё]/i.test(t)) return '';
      const norm = x => String(x || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      return norm(t) === norm(ru) ? '' : t;
    },
    /** the literal translation of a sentence (made by the AI together with its glosses, from THIS translation), or '' */
    litOf(s, ru) {
      if (ru === undefined) ru = this.sentTr(s);
      const ai = this.exCache()['g:' + s];
      if (!ai || Array.isArray(ai) || !ru || ai.h !== this.ruHash(ru) || !ai.lit) return '';
      return this.litClean(ai.lit, ru);
    },
    /** «Дословно: …» — a small muted line under the meaning translation (word view); '' when there is none.
     *  pairs: [[sentence, translation], …] (one line for all of them); tag: 'div' or 'span' (inside a sentence span) */
    litHtml(pairs, tag = 'div') {
      const t = (pairs || []).map(([s, ru]) => this.litOf(s, ru)).filter(Boolean).join(' ');
      if (!t) return '';
      return `<${tag} class="gl-lit" title="Дословный перевод: слово за словом, в порядке норвежского предложения">Дословно: <span class="gl-lit-t">${U.esc(t)}</span> ${this.sayRu(t)}</${tag}>`;
    },
    /**
     * the gloss prompt (v226). Before it, a word whose counterpart the free translation had «moved away» got a grammar
     * label: «Og det var min mormor som har brodert den» → var «(вспом. глагол)», som «(относит. слово)» — wrong, «var»
     * is the main verb there («была»). Now every content word gets its real meaning; brackets only for pure function words;
     * the same answer also brings the literal translation («Дословно»). items: [{ no, ru, words }]
     */
    glossPrompt(items) {
      return `Each item has a Norwegian sentence ("no"), its free Russian translation ("ru") and the list of its words ("words").
First understand the whole sentence: its grammar (V2 word order, cleft and presentative constructions, particle verbs, compound tenses, passive) and its meaning.

1) "gloss" — for EVERY word, in order, the Russian word(s) that give its real meaning in THIS sentence.
- Every CONTENT word ALWAYS gets Russian words, never a grammar label: verbs (also være/ha/bli/få when they are the main verb of their clause), nouns, adjectives, adverbs, pronouns, numerals, prepositions and conjunctions that carry meaning, relative «som».
- Take the Russian word(s) from the free translation, in the same form it uses, when it has a counterpart ("ønska" → "хотел" when the translation says "хотел"; "skurringa" → "треск").
- When the free translation was restructured and has no counterpart for the word, give the word's literal meaning in this context, agreeing with the subject when it is clear (var → "была" / "был" / "было").
- A short note in brackets ONLY for a pure function word without lexical meaning in this sentence:
  • an article → "(артикль)";
  • the infinitive marker «å» → "(частица инфинитива)";
  • «seg» when Russian has no separate word for it → "(-ся)";
  • ha / være / bli / få / skulle / ville / kunne / måtte ONLY when they form a compound tense, the passive or a modal construction together with another verb of the same clause → "(вспом. глагол)" (e.g. "har brodert": har → "(вспом. глагол)", brodert → "вышила"); when the translation does have a word for it, that word with the note ("ble skrevet" → «была написана»: ble → "была (вспом. глагол)", skrevet → "написана");
  • «det» as an empty formal subject ("Det regner": det → "(формальное подлежащее)", regner → "идёт дождь").
  A verb that is the only verb of its clause is NEVER "(вспом. глагол)".
- Constructions:
  • cleft «det er/var X som …» (it is/was X who …): det → "это", er → "есть", var → "был" / "была" / "было" (the main verb, agreeing with X), som → "кто" / "который" / "которая" / "что". "Og det var min mormor som har brodert den": og "а", det "это", var "была", min "моя", mormor "бабушка", som "которая", har "(вспом. глагол)", brodert "вышила", den "его".
  • presentative «det er / det var / det står / det ligger …» (there is): det → "(формальное подлежащее)", the verb → its meaning ("есть", "был", "стоит", "лежит").
  • particle (phrasal) verbs — ta på seg, gi opp, komme fram, legge seg: the verb gets the meaning of the whole unit in this sentence, the particle a note naming the unit ("Hun tok på seg jakka": tok "надела", på "(часть «ta på seg»)", seg "на себя", jakka "куртку").
  • V2 inversion (the verb before the subject): every word keeps its own meaning ("Så har jeg en kyse": så "вот", har "есть", jeg "у меня").
- Never transliterate a Norwegian word into Cyrillic letters. Names of people and places: "".

2) "literal" — a literal Russian translation of the whole sentence that follows the Norwegian word order and structure word by word, as readable as possible ("И это была моя бабушка, которая вышила его."). Return "" when it would be practically the same as the free translation.

Return ONLY a JSON array with one object per item, in the same order: {"gloss": [exactly as many strings as the item has words], "literal": "..."}.
${JSON.stringify(items)}`;
    },
    /** 🤖 the neural network distributes each sentence's translation over its words — all sentences, in batches */
    async aiGloss(items, opts = {}) {
      const c = this.exCache();
      const todo = items.filter(it => it.ru && !this.aiDone(it, true) && this.glMayTry(it.s));
      if (!todo.length) return;
      const quiet = !!opts.quiet;
      const busy = quiet ? null : UI.busy(`Подождите — ${AI.name()} переводит каждое слово по смыслу…`);
      const total = todo.length;
      let done = 0;
      const prog = () => { if (busy) busy.set(`${done} из ${total} предложений`, done, total); if (opts.onProgress) opts.onProgress(done, total, 'ai'); };
      prog();
      const parts = []; for (let i = 0; i < todo.length; i += 8) parts.push(todo.slice(i, i + 8));
      const system = 'You are a Norwegian–Russian teacher making interlinear glosses for learners. You answer with JSON only.';
      const prompt = part => this.glossPrompt(part.map(p => ({ no: p.s, ru: p.ru, words: this.glossToks(p.s) })));
      let k = 0, fails = 0, stop = false;
      // one request for a part of the sentences. forced: the AI to ask (the next one after an answer the guard rejected).
      // Never silent (v231): every failure is logged (console.warn('gloss', provider, reason)); a sentence that got no
      // usable answer keeps its old glosses on the screen (filtered), is marked «stale» and asked again later
      const one = async (part, forced) => {
        let lastWho = forced || AI.current(), lastWhy = '', tried = false;
        for (let attempt = 0; attempt < (forced ? 1 : 3) && !stop; attempt++) {
          const args = { system, user: prompt(part), maxTokens: this.glossBudget(part), temperature: 0, quiet: true, think: 'low' };
          if (forced) args.provider = forced;
          tried = true;
          try {
            // an AI that never answers must not hold the words (or a «Подождите» window) forever: 60 s, then the next try
            let to = 0;
            const ans = await Promise.race([
              AI.call(args),
              new Promise((_, rej) => { to = setTimeout(() => rej(new Error('нейросеть не ответила за 60 с')), 60000); }),
            ]).finally(() => clearTimeout(to));
            const by = args.answeredBy || AI.lastProvider || lastWho;
            lastWho = by;
            // an answer that came after the person left is still kept (cache): the card shows it when it comes again
            let parsed;
            try { parsed = this.aiParse(ans); } catch (e) { throw Object.assign(new Error(args.cut ? 'answer cut at max_tokens (' + args.maxTokens + ')' : 'bad JSON: ' + String(ans || '').slice(0, 80)), { parse: true }); }
            const arr = this.aiItems(parsed);
            let ok = 0;
            const rej = [], miss = [];
            part.forEach((p, j) => {
              p._rej = false;
              const x = this.aiItem(arr[j]), g = this.aiValid(p, x.gloss);
              // a valid answer replaces the older one (made with an older prompt); a bad one leaves it on the screen
              if (g) { c['g:' + p.s] = { h: this.ruHash(p.ru), g, lit: this.litClean(x.literal, p.ru), pv: this.GLOSS_PV, gv: this.GUARD_V, by }; ok++; if (this._glTry) this._glTry.delete(p.s); }
              else if (p._rej) rej.push(p); else miss.push(p);
            });
            if (ok) {
              this._exBy = [...new Set([...(this._exBy || []), 'ai'])]; Translators.lastAI = by;
              this._glVer = (this._glVer || 0) + 1;
              fails = 0;
            }
            // the answer repeated grammar labels instead of meanings (>30 % of the words): the next AI once
            if (rej.length) {
              console.warn('gloss', by, `rejected by the guard: ${rej.length} of ${part.length} sentences`);
              const ch = AI.chain(), next = forced ? null : ch[ch.indexOf(by) + 1];
              if (next) await one(rej, next); else rej.forEach(p => this.glFailed(p.s, by, 'labels instead of meanings'));
            }
            if (!ok && !rej.length) throw Object.assign(new Error(args.cut ? 'answer cut at max_tokens (' + args.maxTokens + ')' : 'answer does not fit the words'), { parse: true });
            if (miss.length) { console.warn('gloss', by, `no usable glosses for ${miss.length} of ${part.length} sentences${args.cut ? ' (cut at max_tokens)' : ''}`); miss.forEach(p => this.glFailed(p.s, by, 'incomplete answer')); }
            return;
          } catch (e) {
            lastWho = args.answeredBy || lastWho; lastWhy = (e && e.message) || String(e);
            console.warn('gloss', lastWho, lastWhy);
            if (opts.cancel && opts.cancel()) { stop = true; break; }
            // a cut / broken answer: the same request would be cut again — several sentences are asked in two halves
            // (smaller answers), a single one is left for later (stale, asked again with a backoff)
            if (e && e.parse) {
              if (part.length > 1) { const h = Math.ceil(part.length / 2); await one(part.slice(0, h), forced); if (!stop) await one(part.slice(h), forced); return; }
              if (++fails >= 4) stop = true;
              break;
            }
            // a limit / no answer: wait a little longer each time; four in a row — the rest goes word by word
            if (forced || ++fails >= 4 || (opts.cancel && opts.cancel())) { stop = stop || !forced; break; }
            await U.sleep(1200 * (attempt + 1) * fails);
            if (opts.cancel && opts.cancel()) { stop = true; break; }
          }
        }
        // no usable answer for this part: the old glosses stay (filtered), the sentence is tried again later
        // (not when the person left the card meanwhile: that is no failure, the card asks again when it comes back)
        if (tried && !(opts.cancel && opts.cancel())) part.forEach(p => this.glFailed(p.s, lastWho, lastWhy || 'no answer'));
      };
      const worker = async () => {
        while (!stop && k < parts.length) {
          if (opts.cancel && opts.cancel()) { stop = true; break; }
          const p = parts[k++];
          await one(p);
          done += p.length; prog();
          if (opts.onBatch) { try { opts.onBatch(p.map(x => x.s)); } catch (e) { /* drawing is not our business */ } }
        }
      };
      try { await Promise.all([worker(), worker()]); } finally { if (busy) busy.close(); this.exSave(); }
    },
    /**
     * no neural network (or it gave up): what is needed to find each word in its sentence translation —
     * single words (the form + the dictionary form) and the Russian words translated back to Norwegian, a few big
     * requests (never one per word), cached for good; then Google's alternative meanings for a few words that are
     * still not found — only while Google is not resting after a refusal.
     */
    async wordCands(items, opts = {}) {
      const c = this.exCache(), quiet = !!opts.quiet;
      const need = new Set();
      items.forEach(it => this.glossToks(it.s).forEach((w, k) => {
        if (this.userGloss(it.s, k) !== undefined || this.isName(w, k)) return;
        const f = this.bareLow(w);
        if (!f || !/\p{L}/u.test(f) || NoGloss.has(f)) return;
        if (c['w2:' + f] === undefined) need.add(f);
        this.lemmasOf(f).forEach(x => { if (x !== f && !NoGloss.has(x) && c['w2:' + x] === undefined) need.add(x); });
      }));
      // in the background only the translators that take many lines per request (no flood of single requests)
      // «FM-båndet»: the word after the hyphen is looked up too
      items.forEach(it => this.glossToks(it.s).forEach(w => { const f = this.bareLow(w); const t = /-/.test(f) ? f.split('-').pop() : ''; if (t.length > 2 && !NoGloss.has(t) && c['w2:' + t] === undefined) need.add(t); }));
      const only = quiet ? ['deepl', 'google', 'mozhi'] : null;
      if (need.size) {
        if (opts.onProgress) opts.onProgress(0, need.size, 'words');
        const list = [...need].slice(0, 600);
        const res = await Translators.translateMany(list, 'no', 'ru', { quiet, only, noAI: true });
        // no answer = not saved (asked again next time); garbage for a single word = '' («—»)
        list.forEach((w, i) => { if (res.out[i]) c['w2:' + w] = this.cleanGloss(w, res.out[i]); });
        // the translator answered the others but had nothing for these: no meaning (not «…» for ever); all failed → asked again later
        if (res.missing < list.length) list.forEach((w, i) => { if (!res.out[i] && c['w2:' + w] === undefined) c['w2:' + w] = ''; });
        this._exBy = [...new Set([...(this._exBy || []), ...res.by])];
        // a few words without an answer are normal (a name, a rare form) — the «translator refused» window only when none came
        if (res.missing && res.missing === list.length && !this._lastFail) this._lastFail = { missing: res.missing, error: res.error };
        this.exSave();
      }
      if (opts.cancel && opts.cancel()) return;
      // the other way round: «хотел» → «ville / ønsket» finds the Norwegian word a Russian word stands for
      const rw = new Set();
      items.forEach(it => Align.ruWords(it.ru).forEach(x => { if (/[а-я]/.test(x.lw) && x.lw.length > 1 && c['r2:' + x.lw] === undefined) rw.add(x.lw); }));
      if (rw.size) {
        const list = [...rw].slice(0, 800);
        try {
          const res = await Translators.translateMany(list, 'ru', 'no', { quiet: true, only: ['deepl', 'google', 'mozhi'], noAI: true });
          list.forEach((w, i) => { if (res.out[i]) c['r2:' + w] = Store.Safe.text(String(res.out[i]), 60).toLowerCase().trim(); });
          this.exSave();
        } catch (e) { /* only fewer words are found */ }
      }
      if (opts.cancel && opts.cancel()) return;
      // still not in the translation: Google's other meanings of the dictionary form — a handful, one by one, slowly
      const miss = [];
      items.forEach(it => {
        const toks = this.glossToks(it.s);
        this.alignOf(it.s, it.ru).forEach((o, k) => {
          if (o.how !== 'guess' || o.src === 'dict' || o.src === 'card') return;
          const f = this.bareLow(toks[k]), w = this.lemmasOf(f)[0] || f;
          if (c['a:' + w] === undefined && !miss.includes(w)) miss.push(w);
        });
      });
      let asked = 0;
      for (const w of miss) {
        if (asked >= (quiet ? 12 : 6) || Translators.gCooling() || (opts.cancel && opts.cancel())) break;
        asked++;
        try { c['a:' + w] = await Translators.alts(w); } catch (e) { break; }
        await U.sleep(400);
      }
      if (asked) this.exSave();
    },
    redrawExamples(cardId) {
      const cur = this.current(); if (!cur || cur.card.id !== cardId) return;
      const card = Store.card(cardId) || cur.card;
      this.redrawIn(document.querySelector('[data-area]'), card);
    },
    /** redraw the translated parts (view switch, description, examples) inside a container: the card back or the viewer */
    redrawIn(root, card) {
      if (!root || !card) return;
      const box = root.querySelector('.ex-box'); if (box) box.outerHTML = this.examplesHtml(card);
      const d = root.querySelector('[data-desc-box]'); if (d) d.innerHTML = this.descHtml(card);
      const fb = root.querySelector('[data-forms-box]'); if (fb && !fb.querySelector('.fg-editing')) fb.outerHTML = this.formsHtml(card);
      const mb = root.querySelector('[data-main-box]'); if (mb) mb.innerHTML = this.mainInner(card, mb.dataset.prompt || 'no');
      const bar = this.viewBarHtml(card);
      root.querySelectorAll('.view-bar').forEach(b => { b.outerHTML = bar; });
    },

    /** full text of one side of the current card (what the user sees) */
    sideText(cur, back) {
      const { item, card } = cur;
      const tv = this.tvFaceOn(card, back, item); // 📄 a text card: read in the chosen view
      if (!back) return tv ? this.tvReadText(card, 'front') : S.mode === 'listen' ? card.no : (item.dir === 'nr' ? card.no : card.ru);
      const answer = tv ? this.tvReadText(card, 'back') : S.mode === 'listen' ? card.no + '\n' + card.ru : (item.dir === 'nr' ? card.ru : card.no);
      return [answer, Prov.listText(card.forms), (card.synonyms || []).map(s => `${s.no}\n${s.ru || ''}`).join('\n'), card.description,
        // examples: Norwegian sentence → its translation → next sentence (when the pairs are known)
        (card.examples || []).map(x => { const p = this.exPairs(x); return p.length && p.every(s => s.ru) ? p.map(s => `${s.no}\n${s.ru}`).join('\n') : `${x.no}\n${x.ru || ''}`; }).join('\n'),
        card.example, card.exampleRu].filter(Boolean).join('\n');
    },
    /** read the visible side: all / only Norwegian / only Russian (each with its own voice) */
    readVisible(opts = {}) {
      const cur = this.current();
      if (!cur) return;
      const back = S.flipped;
      const mode = !back && S.mode === 'listen' ? 'no' : (Store.settings.readMode || 'all');
      this.readSide(back, mode, opts);
    },

    quizOptions(card, side) {
      const first = t => String(t || '').split('\n')[0].trim().slice(0, 90);
      const correct = first(this.faceText(card, side));
      let pool = Store.cards(card.deckId).filter(c => c.id !== card.id);
      if (pool.length < 3) pool = Store.cards().filter(c => c.id !== card.id);
      if (side !== 'no' && this.trLang() !== 'ru' && this.ukOf(card)) { const withUk = pool.filter(c => this.ukOf(c)); if (withUk.length >= 3) pool = withUk; }
      const seen = new Set([U.norm(correct)]);
      const opts = [];
      for (const c of U.shuffle(pool)) {
        const t = first(this.faceText(c, side));
        if (!t || seen.has(U.norm(t))) continue;
        seen.add(U.norm(t)); opts.push({ text: t, ok: false });
        if (opts.length >= 3) break;
      }
      opts.push({ text: correct, ok: true });
      return U.shuffle(opts);
    },

    flip(force) {
      const el = document.querySelector('[data-card]');
      if (!el) return;
      S.flipped = force != null ? force : !S.flipped;
      el.classList.toggle('flipped', S.flipped);
      const { item, card } = this.current();
      if (S.flipped && Store.settings.autoSpeak && item.dir === 'rn' && String(card.no).length < 200) TTS.speak(card.no, 'no');
      if (S.flipped && (card.forms || []).length) this.formsSoon(card.id); // 📚 missing form translations: now that they are seen
      this.tvpPlace(); // ⏯ on the card: under the AI tiles of the side now in front
    },

    /* ---------- answering ---------- */
    grade(g) {
      if (!S || S.locked) return;
      const cur = this.current(); if (!cur) return;
      S.locked = true;
      try { if (navigator.vibrate) navigator.vibrate(g > 1 ? 12 : [18, 40, 18]); } catch (e) { /* ignore */ }
      const { item, card } = cur;
      const st = Store.settings;
      const snapshot = Object.assign({ item, queue: S.queue.slice(), done: S.done, known: S.known, unknown: S.unknown, first: new Map(S.first), unknownIds: new Set(S.unknownIds) }, this.gradeCard(card, item.dir, g));
      S.history.push(snapshot);
      if (!S.first.has(card.id + item.dir)) {
        S.first.set(card.id + item.dir, g > 1);
        if (g > 1) S.known++; else { S.unknown++; }
      }
      if (g === 1) S.unknownIds.add(card.id);
      S.queue.shift();
      if (g === 1 && st.requeue) {
        const pos = Math.min(S.queue.length, 3 + Math.floor(Math.random() * 3));
        S.queue.splice(pos, 0, item);
      } else S.done++;
      TTS.stop();
      const el = document.querySelector('[data-card]');
      const dir = this._swipeDir || (g > 1 ? 'right' : 'left');
      this._swipeDir = null;
      if (el && S.mode !== 'type' && S.mode !== 'quiz') this.flyOut(el, dir, () => this.next(true));
      else this.next(true);
    },

    /**
     * one answer for one card and direction — FSRS (personal weights when fitted, fuzz + load balancing), leech mark,
     * the review log (stats and the optimiser read it). Used by the study session AND by 🎧 listening («знаю / не знаю»).
     * Returns the snapshot that ungradeCard() takes back.
     */
    gradeCard(card, dir, g) {
      const st = Store.settings;
      const prev = card.srs[dir] ? JSON.parse(JSON.stringify(card.srs[dir])) : null;
      const isNew = !prev || !prev.reps;
      const snap = { cardId: card.id, dir, prev, prevTags: card.tags.slice() };
      // fuzz + load balancing: inside the small fuzz range the day with fewer cards due wins (and not the other direction's day)
      const other = card.srs[dir === 'nr' ? 'rn' : 'nr'];
      const next = FSRS.review(prev, g, { retention: st.retention, fuzz: st.fuzz, balance: st.fuzz, avoidDay: other && other.reps && other.due > Date.now() ? other.due : null });
      FSRS.Load.move(prev && prev.reps ? prev.due : null, next.due);
      const srs = Object.assign({}, card.srs, { [dir]: next });
      let tags = card.tags;
      if (g === 1 && (next.lapses || 0) >= st.leechLapses && !tags.includes('leech')) {
        tags = tags.concat('leech');
        UI.toast('🐛 Эта карта даётся тяжело — помечена как «трудная». Попробуйте 🤖 «Объяснить» или добавьте картинку/пример.', 'warn', 6000);
      }
      Store.updateCard(card.id, { srs, tags });
      snap.next = next;
      snap.log = Store.logReview(card.id, dir, g, isNew);
      return snap;
    },
    /** take one gradeCard() answer back (the card's memory state, its tags and the log entry) */
    ungradeCard(h) {
      const card = Store.card(h.cardId);
      if (card) {
        const srs = Object.assign({}, card.srs);
        if (h.prev) srs[h.dir] = h.prev; else delete srs[h.dir];
        Store.updateCard(card.id, { srs, tags: h.prevTags });
        FSRS.Load.invalidate();
      }
      Store.unlog(h.log);
    },

    undo() {
      if (!S || !S.history.length) { UI.toast('Нечего отменять'); return; }
      const h = S.history.pop();
      this.ungradeCard(h);
      Object.assign(S, { queue: h.queue, done: h.done, known: h.known, unknown: h.unknown, first: h.first, unknownIds: h.unknownIds });
      this.updateTop();
      S.flipped = false; S.locked = false; S.answeredType = null; S.quizDone = false;
      this.renderCard(true);
      UI.toast('↶ Ответ отменён', '', 1500);
    },

    /* ---------- typing mode ---------- */
    checkTyped() {
      const inp = document.querySelector('[data-type]');
      if (!inp) return;
      const typed = inp.value.trim();
      const { item, card } = this.current();
      // the translation: Russian AND Ukrainian are both accepted (the chosen language is compared first)
      const targets = item.dir === 'nr' ? this.trAnswers(card) : [card.no];
      const tol = Store.settings.typeTolerance;
      const nopt = { stripArticles: true, foldNordic: tol };
      const apos = x => String(x || '').replace(/[’ʼ`´]/g, "'");
      const alts = targets.flatMap(x => { const firstLine = apos(String(x).split('\n')[0]); return [firstLine, ...U.alternatives(firstLine)]; }).filter(Boolean);
      if (!alts.length) alts.push('');
      const t = U.norm(apos(typed), nopt);
      let best = alts[0], bestD = Infinity;
      alts.forEach(a => { const d = U.levenshtein(t, U.norm(a, nopt)); if (d < bestD) { bestD = d; best = a; } });
      const len = U.norm(best, nopt).length;
      const exact = bestD === 0 && t.length > 0;
      const almost = !exact && tol && t.length > 2 && bestD <= Math.max(1, Math.floor(len * 0.15));
      const res = document.querySelector('[data-result]');
      const cardEl = document.querySelector('[data-card]');
      S.answeredType = exact || almost ? 3 : 1;
      if (exact) { res.innerHTML = '<span class="ok">✓ Верно!</span>'; cardEl.classList.add('glow-good'); }
      else if (almost) res.innerHTML = `<span class="ok">≈ Почти верно</span> — ${U.diffHtml(typed, best)}`;
      else res.innerHTML = `<span class="err">✗ Неверно</span>${typed ? ' — ' + U.diffHtml(typed, best) : ''}<br><button class="btn sm" data-act="override" style="margin-top:8px">Я был прав</button>`;
      if (!exact && !almost) { cardEl.classList.remove('shake'); void cardEl.offsetWidth; cardEl.classList.add('shake'); }
      res.insertAdjacentHTML('beforeend', ' <span class="muted small">— Enter: дальше</span>');
      inp.readOnly = true;
      this.flip(true);
      if (item.dir === 'nr') TTS.speak(card.no, 'no');
    },
    typeNext() { const g = S.answeredType || 1; S.answeredType = null; this.grade(g); },

    /* ---------- quiz mode ---------- */
    quizAnswer(btn) {
      if (S.locked || S.quizDone) return;
      S.quizDone = true;
      const ok = btn.dataset.ok === '1';
      document.querySelectorAll('.quiz-opt').forEach(b => { b.disabled = true; if (b.dataset.ok === '1') b.classList.add('correct'); });
      if (!ok) btn.classList.add('wrong');
      this.flip(true);
      S.quizGrade = ok ? 3 : 1;
      const { card } = this.current();
      TTS.speak(card.no, 'no');
      if (ok) setTimeout(() => { if (S && S.quizDone) this.quizNext(); }, 1100);
      else document.querySelector('[data-act="quiz-next"]').classList.remove('hidden');
    },
    quizNext() { if (!S.quizDone) return; S.quizDone = false; this.grade(S.quizGrade || 1); },

    /* ---------- swipe ---------- */
    bindSwipe(el) {
      if (!el) return;
      // entrance animation uses fill-mode "both" which would override the drag transform
      el.addEventListener('animationend', e => { if (e.target === el) el.classList.remove('enter', 'shake', 'glow-good'); });
      const st = Store.settings;
      const mode = st.swipeMode || 'lr';
      const style = st.swipeStyle || 'tinder';
      const thr = { low: 160, medium: 110, high: 70 }[st.swipeSensitivity || 'medium'] || 110;
      const allowX = mode !== 'ud' && mode !== 'off';
      const allowY = mode === 'ud' || mode === 'four';
      const stage = el.parentElement;
      // vertical swipes need the page not to scroll under the finger (long cards keep scrolling)
      stage.style.touchAction = allowY && !el.querySelector('.face.long') ? 'none' : 'pan-y';
      const hint = document.createElement('div');
      hint.className = 'swipe-hint';
      el.appendChild(hint);

      let sx = 0, sy = 0, dx = 0, dy = 0, axis = null, dragging = false, down = false, moved = false;
      let pts = [], lpTimer = null, lastTap = 0, tapTimer = null;
      const busy = () => S.mode === 'type' || S.mode === 'quiz';
      const dirOf = () => axis === 'x' ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      const showHint = () => {
        const a = this.actionFor(dirOf());
        const p = Math.min(1, Math.abs(axis === 'x' ? dx : dy) / thr);
        if (!a) { hint.style.opacity = 0; return; }
        hint.textContent = a.label;
        hint.dataset.g = a.flip ? 'flip' : a.g;
        hint.style.opacity = p;
        if (p >= 1 && !hint._buzz) { hint._buzz = true; hint.classList.add('ready'); try { navigator.vibrate && navigator.vibrate(8); } catch (_) { /* ignore */ } }
        if (p < 1 && hint._buzz) { hint._buzz = false; hint.classList.remove('ready'); }
      };
      const reset = () => { el.style.transform = ''; el.style.opacity = ''; hint.style.opacity = 0; hint.classList.remove('ready'); hint._buzz = false; };
      const fire = dir => {
        const a = this.actionFor(dir);
        if (!a) { reset(); return; }
        hint.style.opacity = 0;
        if (a.flip) { reset(); this.flip(); return; }
        this._swipeDir = dir;
        this.grade(a.g);
      };

      // a press on a scrollbar is not a tap / long press (it used to start the speech and flip the card)
      const onScrollbar = e => {
        const t = e.target;
        if (!(t instanceof Element)) return false;
        const vbar = t.scrollHeight > t.clientHeight && e.offsetX >= t.clientWidth;
        const hbar = t.scrollWidth > t.clientWidth && e.offsetY >= t.clientHeight;
        return vbar || hbar;
      };
      // scrolling the card while pressing cancels the tap and the long press
      el.querySelectorAll('.face').forEach(f => f.addEventListener('scroll', () => { if (down) { moved = true; clearTimeout(lpTimer); } }, { passive: true }));
      el.addEventListener('pointerdown', e => {
        if (e.target.closest('button, a, input, textarea, summary, .mt-note, [data-glfix], .gt-badge, .fg-label .gt, .tvp, .tv-top')) return; // a tap on a (translation) corrects it; on a grammar label — explains it
        if (onScrollbar(e)) { down = false; clearTimeout(lpTimer); return; }
        // a click that only clears an existing selection must not flip the card
        if (window.getSelection && String(window.getSelection())) { down = false; clearTimeout(lpTimer); return; }
        down = true; moved = false; dragging = false; axis = null;
        sx = e.clientX; sy = e.clientY; dx = 0; dy = 0;
        pts = [{ x: sx, y: sy, t: e.timeStamp }];
        clearTimeout(lpTimer);
        if (st.longPressAction !== 'none') lpTimer = setTimeout(() => { if (down && !moved) { down = false; this.gesture(st.longPressAction || 'speak'); } }, 550);
      });
      el.addEventListener('pointermove', e => {
        if (!down) return;
        dx = e.clientX - sx; dy = e.clientY - sy;
        pts.push({ x: e.clientX, y: e.clientY, t: e.timeStamp }); if (pts.length > 8) pts.shift();
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) { moved = true; clearTimeout(lpTimer); }
        // mouse drag that started on text selects it — then it is not a swipe
        if (!dragging && e.pointerType === 'mouse' && window.getSelection && String(window.getSelection())) { down = false; clearTimeout(lpTimer); return; }
        if (!dragging && !busy() && Math.hypot(dx, dy) > 12) {
          const ax = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : Math.abs(dy) > Math.abs(dx) * 1.2 ? 'y' : null;
          if ((ax === 'x' && allowX) || (ax === 'y' && allowY)) {
            dragging = true; axis = ax; el.classList.add('dragging');
            try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
          }
        }
        if (dragging) {
          const ddx = axis === 'x' ? dx : 0, ddy = axis === 'y' ? dy : 0;
          el.style.transform = this.dragTransform(style, ddx, ddy, axis);
          if (style === 'fade') el.style.opacity = 1 - Math.min(0.55, Math.hypot(ddx, ddy) / 500);
          showHint();
        }
      });
      const end = () => {
        clearTimeout(lpTimer);
        if (!down) return;
        down = false;
        if (dragging) {
          dragging = false; el.classList.remove('dragging');
          const dist = Math.abs(axis === 'x' ? dx : dy);
          // a quick flick counts even if it is short
          const last = pts[pts.length - 1], first = pts.find(p => last.t - p.t < 110) || pts[0];
          const v = (axis === 'x' ? last.x - first.x : last.y - first.y) / Math.max(1, last.t - first.t);
          if (dist > thr || (Math.abs(v) > 0.6 && dist > 40)) fire(dirOf());
          else reset();
          return;
        }
        if (!moved && (S.mode === 'flip' || S.mode === 'listen')) {
          if (window.getSelection && String(window.getSelection())) return;
          const dbl = st.doubleTapAction && st.doubleTapAction !== 'none';
          if (!dbl) { this.flip(); return; }
          const now = Date.now();
          if (now - lastTap < 300) { clearTimeout(tapTimer); lastTap = 0; this.gesture(st.doubleTapAction); return; }
          lastTap = now; tapTimer = setTimeout(() => this.flip(), 260);
        }
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', () => { clearTimeout(lpTimer); down = false; dragging = false; el.classList.remove('dragging'); reset(); });

      // MacBook trackpad: two-finger horizontal swipe
      if (st.trackpadSwipe !== false && allowX) {
        let acc = 0, lock = 0, resetT = null;
        stage.addEventListener('wheel', e => {
          if (busy() || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
          e.preventDefault(); // also stops Safari's "back" swipe here
          if (Date.now() < lock) return;
          acc -= e.deltaX;
          clearTimeout(resetT);
          resetT = setTimeout(() => { acc = 0; reset(); }, 220);
          axis = 'x'; dx = acc; dy = 0;
          el.style.transform = this.dragTransform(style, acc * 0.7, 0, 'x');
          showHint();
          if (Math.abs(acc) > 170) { lock = Date.now() + 900; const dir = acc > 0 ? 'right' : 'left'; acc = 0; fire(dir); }
        }, { passive: false });
      }
    },

    hintText() {
      const m = Store.settings.swipeMode || 'lr';
      const t = { lr: 'свайп → знаю · ← не знаю', 'lr-rev': 'свайп ← знаю · → не знаю', ud: 'свайп ↑ знаю · ↓ не знаю',
        four: '→ хорошо · ← снова · ↑ легко · ↓ трудно', 'flip-first': 'свайп — перевернуть, затем → знаю · ← не знаю', off: 'кнопки внизу' }[m] || '';
      return `нажмите или пробел — перевернуть · ${t}`;
    },
    /** what a swipe direction does in the chosen scheme -> { g, label } | { flip, label } | null */
    actionFor(dir, fromKeyboard) {
      let mode = Store.settings.swipeMode || 'lr';
      if (mode === 'off') { if (!fromKeyboard) return null; mode = 'lr'; }
      if (mode === 'flip-first') {
        if (!S.flipped) return { flip: true, label: '↻ ПЕРЕВЕРНУТЬ' };
        mode = 'lr';
      }
      const four = Store.settings.fourButtons;
      const M = {
        lr: { right: { g: 3, label: 'ЗНАЮ ✓' }, left: { g: 1, label: '✗ НЕ ЗНАЮ' }, up: four ? { g: 4, label: 'ЛЕГКО ⚡' } : null, down: four ? { g: 2, label: 'ТРУДНО' } : null },
        'lr-rev': { left: { g: 3, label: 'ЗНАЮ ✓' }, right: { g: 1, label: '✗ НЕ ЗНАЮ' } },
        ud: { up: { g: 3, label: 'ЗНАЮ ✓' }, down: { g: 1, label: '✗ НЕ ЗНАЮ' } },
        four: { right: { g: 3, label: 'ХОРОШО ✓' }, left: { g: 1, label: '✗ СНОВА' }, up: { g: 4, label: 'ЛЕГКО ⚡' }, down: { g: 2, label: 'ТРУДНО' } },
      };
      return (M[mode] || M.lr)[dir] || null;
    },
    /** run a gesture action (long press / double tap) */
    gesture(action) {
      switch (action) {
        case 'speak': this.readVisible(); break;
        case 'flip': this.flip(); break;
        case 'know': this._swipeDir = 'right'; this.grade(3); break;
        case 'dontknow': this._swipeDir = 'left'; this.grade(1); break;
        case 'edit': { const b = document.querySelector('[data-act="edit"]'); b && b.click(); break; }
        case 'explain': { const b = document.querySelector('[data-act="explain"]'); b && b.click(); break; }
      }
    },
    /** card transform while dragging, per animation style */
    dragTransform(style, dx, dy, axis) {
      const d = Math.hypot(dx, dy);
      switch (style) {
        case 'slide': return `translate(${dx}px, ${dy}px)`;
        case 'flick3d': return axis === 'y' ? `translateY(${dy * 0.6}px) rotateX(${-dy / 5}deg)` : `translateX(${dx * 0.6}px) rotateY(${dx / 5}deg)`;
        case 'fade': return `translate(${dx * 0.5}px, ${dy * 0.5}px) scale(${1 - Math.min(0.25, d / 1600)})`;
        case 'stack': return `translate(${dx}px, ${dy}px) scale(${1 - Math.min(0.08, d / 3000)})`;
        case 'bounce': return `translate(${dx}px, ${dy}px) rotate(${dx / 30}deg) scale(${1 + Math.min(0.04, d / 6000)})`;
        default: return `translate(${dx}px, ${dy}px) rotate(${dx / 18 + dy / 60}deg)`;
      }
    },
    /** fly the card away after an answer (per animation style + direction) */
    flyOut(el, dir, cb) {
      const style = Store.settings.swipeStyle || 'tinder';
      const v = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] }[dir] || [1, 0];
      const [x, y] = v;
      const F = {
        tinder: [`translate(${x * 140}%, ${y * 130}%) rotate(${x * 24 + y * 6}deg)`, 420, 'cubic-bezier(.5,0,.75,0)'],
        slide: [`translate(${x * 120}%, ${y * 120}%)`, 320, 'cubic-bezier(.4,0,.2,1)'],
        flick3d: [y ? `translateY(${y * 70}%) rotateX(${-y * 90}deg)` : `translateX(${x * 70}%) rotateY(${x * 90}deg)`, 480, 'cubic-bezier(.5,0,.7,.4)'],
        fade: [`translate(${x * 20}%, ${y * 20}%) scale(.55)`, 360, 'ease-out'],
        stack: [`translate(${x * 18}%, 60px) scale(.8) rotate(${x * 4}deg)`, 420, 'cubic-bezier(.3,.7,.4,1)'],
        bounce: [`translate(${x * 160}%, ${y * 150}%) rotate(${x * 14}deg)`, 560, 'cubic-bezier(.6,-0.45,.7,1)'],
      };
      const [tf, dur, ease] = F[style] || F.tinder;
      el.classList.remove('enter', 'dragging');
      el.style.transition = `transform ${dur}ms ${ease}, opacity ${dur}ms ease`;
      requestAnimationFrame(() => { el.style.transform = tf; el.style.opacity = '0'; if (style === 'stack') el.style.zIndex = '-1'; });
      setTimeout(cb, dur - 40);
    },

    /* ---------- clicks & keys ---------- */
    /** translator icon on the card: verify the card's translation, optionally add the variant */
    /** an icon on the card was pressed: kind 'tr' (translator) or 'ai' (neural network) */
    async verifyWith(kind, id, btn) {
      const cur = this.current(); if (!cur) return;
      const card = cur.card;
      const text = Translators.prepare(card.no, 'no');
      if (kind === 'ai' && id === 'add') { App.goAsk('settings'); return; } // a session in progress asks «Закончить занятие?» first
      if (kind === 'tr' && id === 'telegram') { Telegram.open(Store.card(card.id) || card); return; }
      if (kind === 'tr' && id === 'grammatikk') { Grammar.open(Store.card(card.id) || card); return; }
      if (kind === 'tr' && id === 'ordbok') { this.ordbokBubble(card, btn); return; }
      if (kind === 'tr' && id === 'tatoeba') { this.tatoebaBubble(card, btn); return; }
      if (kind === 'tr' && id === 'more') {
        Translators.moreMenu(btn, text, 'no', 'ru',
          wid => { Prov.log(card.id, Prov.entry('tr:' + wid, 'verify', null, 'открыт словарь на сайте')); this.refreshBadges(); },
          wid => Views.pasteFromDict(wid, Store.card(card.id) || card, { onDone: () => { const c2 = this.current(); if (c2 && c2.card.id === card.id) { this.renderCard(false); this.flip(true); } } }));
        return;
      }
      // 🤖 an AI tile: the teacher's check — fixes at once (or asks), all forms of the word, «↶ Вернуть» (js/aihub.js)
      if (kind === 'ai' && id !== 'compare' && window.AIHub && AIHub.checkOne) { this.aiCheckCard(id, btn); return; }
      if (id === 'compare') { Translators.compareDialog(text, 'no', 'ru', (res, tid) => this.addVariant(card, tid === 'ai' ? 'ai:' + (Translators.lastAI || AI.current()) : 'tr:' + tid, res)); return; }
      if (kind === 'tr' && !Translators.inline(id)) {
        const t = Translators.LIST[id];
        const go = () => Translators.open(id, text, 'no', 'ru');
        if (t.key) Guides.needKey(id, go); else go(); // explain how to make it work 100% inside the card
        return;
      }
      if (btn) btn.classList.add('busy');
      const by = kind + ':' + id;
      const name = kind === 'ai' ? AI.PROVIDERS[id].short : Translators.LIST[id].name;
      try {
        const tid = kind === 'ai' ? 'ai' : id;
        const topts = kind === 'ai' ? { provider: id } : {};
        const d = await Translators.detail(tid, text, 'no', 'ru', topts);
        const res = d.main;
        const agree = Translators.agrees(res, card.ru) || d.alts.some(a => Translators.agrees(a, card.ru));
        Prov.log(card.id, Prov.entry(by, 'verify', null, `NO→RU: «${res}»${d.alts.length ? ' (также: ' + d.alts.slice(0, 5).join(', ') + ')' : ''} — ${agree ? 'совпадает с карточкой' : 'отличается от карточки'}`));
        const hasForms = !!Translators.parseForms(card);
        if (this.current() && this.current().card.id === card.id) {
          this.showBubble({ by, name, res, agree, alts: d.alts, formsLoading: hasForms, text, icon: kind === 'ai' ? AI.icon(id, 24) : Translators.icon(id, 24) });
          this.refreshBadges();
          document.querySelectorAll('.card-rail:not(.front-rail)').forEach(r => Translators.light(r, Store.card(card.id), [], by));
        }
        // every form of the word, translated by the same service ("jeg spiste" -> "я ел")
        if (hasForms) {
          const f = await Translators.translateForms(tid, card, topts);
          if (this._bubble && this._bubble.by === by && this.current() && this.current().card.id === card.id) this.bubbleForms(f);
        }
      } catch (err) {
        // never jump to the website on its own: the other translators try, the result is shown right on the card
        await this.trFallback(card, kind, id, name, text, err);
      }
      if (btn) btn.classList.remove('busy');
    },
    /**
     * the chosen translator did not answer: the others try (Google → Mozhi → MyMemory → AI…, as in Settings);
     * the result is shown on the card with who actually translated. Nothing worked: say why, ⟳ retry, pick another.
     */
    async trFallback(card, kind, id, name, text, err) {
      let res = null;
      try { res = await Translators.translateMany([text], 'no', 'ru'); } catch (e) { /* nothing more to try */ }
      if (!this.current() || this.current().card.id !== card.id) return;
      const got = res && String(res.out[0] || '').trim();
      if (got) {
        const used = res.by.find(b => b !== id) || res.by[0] || 'google';
        const by = used === 'ai' ? 'ai:' + (Translators.lastAI || AI.current()) : 'tr:' + used;
        const uname = Translators.provNames([used]);
        const agree = Translators.agrees(got, card.ru);
        Prov.log(card.id, Prov.entry(by, 'verify', null, `NO→RU: «${got}» — ${agree ? 'совпадает с карточкой' : 'отличается от карточки'}`));
        this.showBubble({ by, name: uname, res: got, agree, alts: [], text, note: used !== (kind === 'ai' ? 'ai' : id) ? `${name} не ответил (${U.niceErr(err, '', true)}) — перевёл ${uname}` : '',
          icon: used === 'ai' ? (AI.icon(Translators.lastAI || AI.current(), 24) || BOT(24)) : Translators.icon(used, 24) });
        this.refreshBadges();
        document.querySelectorAll('.card-rail:not(.front-rail)').forEach(r => Translators.light(r, Store.card(card.id), [], by));
        return;
      }
      this._lastFail = { missing: 1, error: (res && res.error) || U.niceErr(err) };
      this.errBubble({ icon: kind === 'ai' ? AI.icon(id, 22) : Translators.icon(id, 22), name, msg: `${name} не ответил: ${U.niceErr(err, '', true)}. Другие переводчики тоже сейчас не ответили.`,
        retry: `data-act="tr-retry" data-kind="${kind}" data-id="${U.esc(id)}"`, url: kind === 'tr' ? Translators.webUrl(id, text, 'no', 'ru') : '', pick: true });
    },
    /** a source failed: the reason right on the card, ⟳ retry, other translators, the website only on request */
    errBubble(o) {
      const stage = document.querySelector('.stage'); if (!stage) return;
      stage.querySelectorAll('.tr-bubble').forEach(b => b.remove());
      stage.insertAdjacentHTML('beforeend', `<div class="tr-bubble ob-bubble err">
        <button class="tr-bubble-x" data-act="bubble-close" title="Закрыть">✕</button>
        <div class="tr-bubble-head">${o.icon || ''} <b>${U.esc(o.name)}</b></div>
        <div class="mt-warn">⚠️ <span>${U.esc(o.msg)}</span></div>
        <div class="row" style="gap:8px;margin-top:8px;align-items:center">
          ${o.retry ? `<button class="media-btn sm main" ${o.retry} title="Повторить" aria-label="Повторить">${UI.icon('retry', 18)}</button>` : ''}
          ${o.pick ? '<button class="btn sm" data-act="tr-pick">🔁 Другой переводчик или нейросеть</button>' : ''}
          ${o.url ? `<a class="btn sm ghost" href="${U.esc(o.url)}" target="_blank" rel="noopener">↗ Открыть на сайте</a>` : ''}</div></div>`);
    },
    /** result bubble shown right over the card */
    showBubble(o) {
      const stage = document.querySelector('.stage'); if (!stage) return;
      stage.querySelectorAll('.tr-bubble').forEach(b => b.remove());
      this._bubble = o;
      const [bk, bid] = String(o.by || '').split(':');
      const site = bk === 'tr' && o.text ? Translators.webUrl(bid, o.text, 'no', 'ru') : '';
      stage.insertAdjacentHTML('beforeend', `<div class="tr-bubble ${o.agree ? 'ok' : 'diff'}">
        <button class="tr-bubble-x" data-act="bubble-close" title="Закрыть">✕</button>
        <div class="tr-bubble-head">${o.icon} <b>${U.esc(o.name)}</b>
          <span class="chip ${o.agree ? 'learned' : 'due'}">${o.agree ? '✓ совпадает с карточкой' : '≠ другой вариант'}</span>
          ${site ? `<a class="small" href="${U.esc(site)}" target="_blank" rel="noopener" title="Открыть на сайте" style="margin-left:auto">↗ на сайте</a>` : ''}</div>
        ${o.note ? `<div class="small muted" style="margin:2px 0 4px">ℹ️ ${U.esc(o.note)}</div>` : ''}
        <div class="tr-bubble-res">${UI.rich(o.res)}</div>
        ${(o.alts || []).length ? `<div class="tr-alts"><span class="small muted">Другие значения:</span>${o.alts.map(a => `<span class="tr-alt">${UI.rich(a)}</span>`).join('')}</div>` : ''}
        <div class="tr-forms" data-bforms>${o.formsLoading ? '<div class="small muted"><span class="spinner sm"></span> перевожу каждую форму слова…</div>' : ''}</div>
        <div class="row" style="gap:8px" data-bactions>${o.agree ? '' : '<button class="btn sm primary" data-act="tr-add">➕ Добавить вариант в карточку</button>'}</div>
      </div>`);
    },
    /** 📖 Ordbøkene article -> bubble with Norwegian + (Russian), then into the card */
    async ordbokBubble(card, btn) {
      if (btn) btn.classList.add('busy');
      const stage = document.querySelector('.stage');
      stage.querySelectorAll('.tr-bubble').forEach(b => b.remove());
      stage.insertAdjacentHTML('beforeend', `<div class="tr-bubble ok"><div class="small muted"><span class="spinner sm"></span> Ordbøkene: загружаю статью и перевожу на русский…</div></div>`);
      try {
        const r = await Ordbok.build(card);
        Prov.log(card.id, Prov.entry('tr:ordbok', 'verify', null, `статья «${r.lemma}»: ${r.definitions.length} значений, ${r.expressions.length} выражений`),
          // the translator that translated the article lights up on the card too
          ...Translators.provKeys(r.translatedBy).map(k => Prov.entry(k, 'translate', null, `перевёл статью Ordbøkene «${r.lemma}» на русский`)));
        if (!this.current() || this.current().card.id !== card.id) return;
        this._bubble = { by: 'tr:ordbok', ordbok: r, forms: r.forms.filter(f => f.ru) };
        this.ordbokShow(card, r);
        // machine translators get idioms wrong — a connected AI checks the whole article right away
        if (AI.available() && !(r.translatedBy || []).includes('ai')) this.ordbokRefine(card, document.querySelector('.ob-bubble [data-act="ob-ai"]'), true);
      } catch (e) {
        // never jump to the website on its own: say what happened right here, offer «повторить»; the site only on request
        stage.querySelectorAll('.tr-bubble').forEach(b => b.remove());
        if (!this.current() || this.current().card.id !== card.id) return;
        const notFound = /не найдено/.test(e.message);
        stage.insertAdjacentHTML('beforeend', `<div class="tr-bubble ob-bubble err">
          <button class="tr-bubble-x" data-act="bubble-close" title="Закрыть">✕</button>
          <div class="tr-bubble-head">${Translators.icon('ordbok', 22)} <b>Ordbøkene</b></div>
          <div class="mt-warn">⚠️ <span>${notFound ? U.esc(e.message) + '.' :`Статья не загрузилась: ${U.esc(Ordbok.errText(e))}`}</span></div>
          <div class="row" style="gap:8px;margin-top:8px">${notFound ? '' : `<button class="media-btn sm main" data-act="ob-retry" title="Повторить" aria-label="Повторить">${UI.icon('retry', 18)}</button>`}
            <a class="btn sm ghost" href="${U.esc(Ordbok.siteUrl(card))}" target="_blank" rel="noopener">Открыть на сайте ordbokene.no ↗</a></div></div>`);
      } finally { if (btn) btn.classList.remove('busy'); }
    },
    /** 🤖 AI checks the translation of every line of the Ordbøkene article (idioms especially) */
    async ordbokRefine(card, btn, auto) {
      const b = this._bubble;
      if (!card || !b || !b.ordbok) return;
      if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spinner sm"></span> ${U.esc(AI.name())} проверяет перевод…`; }
      try {
        const n = await Ordbok.refineAI(b.ordbok);
        Prov.log(card.id, Prov.entry('ai:' + (AI.lastProvider || AI.current()), 'verify', null, `перевод статьи Ordbøkene проверен: исправлено строк — ${n}`));
        if (this._bubble === b && this.current() && this.current().card.id === card.id) this.ordbokShow(card, b.ordbok);
        UI.toast(n ? `${AI.name(AI.lastProvider)}: исправлено строк — ${n}. «Добавить статью» сохранит их в карточку` : `${AI.name(AI.lastProvider)}: перевод верный ✓`, 'good', 4500);
      } catch (e) {
        if (!auto) UI.toast(e.message, 'warn', 5000);
        if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = `${AI.icon(AI.current(), 14) || BOT(14)} Уточнить перевод`; }
      }
    },
    /** warning under machine translations: they must be double-checked */
    machineWarn(by) { return Translators.machineWarnHtml(by); },
    ordbokShow(card, r) {
        const stage = document.querySelector('.stage'); if (!stage) return;
        // the same three views as everywhere: as is (Russian under the line) / sentence (перевод) / word (перевод)
        const v = Store.settings.exView || 'asis';
        const p = (no, ru) => v === 'word' ? `${this.glossHtml(no, ru || undefined)}${ru ? `<div class="ex-ru">${UI.rich(ru)} ${this.sayRu(ru)}</div>` : ''}${this.litHtml([[no, ru || undefined]])}`
          : v === 'sent' ? `${UI.rich(no)}${ru ? ` <span class="ex-ru-in">(${U.esc(ru)})</span>` : ''}`
          : `${UI.rich(no)}${ru ? `<div class="ex-ru">${UI.rich(ru)} ${this.sayRu(ru)}</div>` : ''}`;
        const say = no => `<button class="icon-btn sm" data-act="say" data-say="${U.esc(no)}" title="Произнести">${SPK()}</button>`;
        const bar = `<div class="view-bar"><span class="small muted">Перевод:</span><span class="seg-mini ex-view sm">${this.EXV.map(([id, l, t]) => `<button class="${v === id ? 'active' : ''}" data-act="ob-view" data-v="${id}" title="${t}">${l}</button>`).join('')}</span></div>`;
        const trNames = (r.translatedBy || []).map(id => id === 'ai' ? AI.name(Translators.lastAI) : (Translators.LIST[id] || {}).name || id).join(' + ');
        const aiOn = AI.available() && !(r.translatedBy || []).includes('ai');
        stage.querySelectorAll('.tr-bubble').forEach(b => b.remove());
        stage.insertAdjacentHTML('beforeend', `<div class="tr-bubble ok ob-bubble">
          <button class="tr-bubble-x" data-act="bubble-close" title="Закрыть">✕</button>
          <div class="tr-bubble-head">${Translators.icon('ordbok', 24)} <b>${U.esc(Ordbok.title(r))}</b>${trNames ? `<span class="chip">перевод: ${U.esc(trNames)}</span>` : ''}</div>
          ${r.missing ? `<div class="ob-miss">⚠️ Не удалось перевести ${r.missing} ${r.missing === 1 ? 'фразу' : r.missing < 5 ? 'фразы' : 'фраз'} — переводчики сейчас не отвечают.
            <button class="btn sm" data-act="ob-retry">🔄 Перевести ещё раз</button></div>` : ''}
          ${bar}
          <ol class="ob-defs">${r.definitions.map(d => `<li>${d.no ? `<div class="ob-def">${p(d.no, d.ru)} ${say(d.no)}</div>` : ''}
            ${d.examples.map(x => `<div class="ob-ex">• ${p(x.no, x.ru)} ${say(x.no)}</div>`).join('')}</li>`).join('')}</ol>
          ${r.expressions.length ? `<div class="small muted">Выражения (uttrykk):</div>${r.expressions.map(x => `<div class="ob-ex">• ${p(x.no, x.ru)} ${say(x.no)}</div>`).join('')}` : ''}
          ${this._bubble.forms.length ? `<div class="tr-forms"><div class="small muted" style="margin:6px 0 4px">📚 Формы слова:</div>${this._bubble.forms.map(f => `<div class="fg-row fg-v2r"><span class="fg-label">${this.formLabelHtml(f)}</span><span class="fg-no" lang="nb">${UI.rich(f.no)}</span><span class="fg-dash" aria-hidden="true">—</span><span class="fg-ru">${UI.rich(f.ru)}</span>
            <button class="icon-btn sm" data-act="say" data-say="${U.esc(f.no)}">${SPK()}</button></div>`).join('')}</div>` : ''}
          <div class="row" style="gap:8px">
            <button class="btn sm primary" data-act="ob-add">➕ Добавить статью в карточку</button>
            ${this._bubble.forms.length ? '<button class="btn sm ai" data-act="tr-save-forms">📚 Формы → в карточку</button>' : ''}
            ${aiOn ? `<button class="btn sm ai" data-act="ob-ai" title="Нейросеть проверит перевод каждой строки, особенно выражений — машинные переводчики переводят их дословно">${AI.icon(AI.current(), 14) || BOT(14)} Уточнить перевод (${U.esc(AI.name())})</button>` : ''}
            <button class="btn sm" data-act="ob-copy">📋 Копировать</button>
            ${Listen.hereBtn('.ob-bubble', 'Ordbøkene · ' + r.lemma, 'Слушать статью')}
            <button class="btn sm" data-act="ob-open">↗ Открыть на сайте</button>
          </div>
          ${this.machineWarn(r.translatedBy)}</div>`);
        this.refreshBadges();
        const keys = ['tr:ordbok', ...Translators.provKeys(r.translatedBy)];
        document.querySelectorAll('.card-rail:not(.front-rail)').forEach(rl => keys.forEach(k => Translators.light(rl, Store.card(card.id), [], k)));
    },

    /** 💬 Tatoeba: real sentences NO→RU translated by people */
    async tatoebaBubble(card, btn) {
      if (btn) btn.classList.add('busy');
      const stage = document.querySelector('.stage');
      stage.querySelectorAll('.tr-bubble').forEach(b => b.remove());
      try {
        const ex = await Sources.tatoeba(card);
        Prov.log(card.id, Prov.entry('tr:tatoeba', 'verify', null, `найдено живых примеров: ${ex.length}`));
        if (!this.current() || this.current().card.id !== card.id) return;
        this._bubble = { by: 'tr:tatoeba', examples: ex };
        stage.insertAdjacentHTML('beforeend', `<div class="tr-bubble ok ob-bubble">
          <button class="tr-bubble-x" data-act="bubble-close" title="Закрыть">✕</button>
          <div class="tr-bubble-head">${Translators.icon('tatoeba', 24)} <b>Tatoeba — живые примеры</b><span class="chip">переведены людьми</span></div>
          <div class="ob-defs" style="padding-left:0">${ex.map(x => `<div class="ob-ex">• ${UI.rich(`${x.no} (${x.ru})`)} <button class="icon-btn sm" data-act="say" data-say="${U.esc(x.no)}">${SPK()}</button></div>`).join('')}</div>
          <div class="row" style="gap:8px">
            <button class="btn sm primary" data-act="tt-add">➕ Добавить в примеры карточки</button>
            ${Listen.hereBtn('.ob-bubble', 'Tatoeba — примеры', 'Слушать')}
            <a class="btn sm" href="${Sources.tatoebaUrl(card)}" target="_blank" rel="noopener">↗ Ещё на tatoeba.org</a>
          </div>
          <div class="tiny muted">Предложения: tatoeba.org · лицензия CC BY 2.0 FR</div></div>`);
        this.refreshBadges();
        document.querySelectorAll('.card-rail:not(.front-rail)').forEach(rl => Translators.light(rl, Store.card(card.id), [], 'tr:tatoeba'));
      } catch (e) {
        if (!this.current() || this.current().card.id !== card.id) return;
        this.errBubble({ icon: Translators.icon('tatoeba', 22), name: 'Tatoeba', msg: Ordbok.errText(e), retry: 'data-act="tt-retry"', url: Sources.tatoebaUrl(card) });
      }
      finally { if (btn) btn.classList.remove('busy'); }
    },

    /** forms table inside the bubble: form | translation, + save to card */
    bubbleForms(f) {
      const box = document.querySelector('[data-bforms]'); if (!box) return;
      if (!f || !f.items.length) { box.innerHTML = ''; return; }
      this._bubble.forms = f.items;
      this.tvCss();
      box.innerHTML = `<div class="small muted" style="margin-bottom:4px">📚 Формы слова с переводом:</div>
        ${f.items.map(x => `<div class="fg-row fg-v2r"><span class="fg-label">${this.formLabelHtml(x)}</span><span class="fg-no" lang="nb">${UI.rich(x.no)}</span><span class="fg-dash" aria-hidden="true">—</span><span class="fg-ru">${UI.rich(x.ru)}</span>
          <button class="icon-btn sm" data-act="say" data-say="${U.esc(x.no)}" title="Произнести">${SPK()}</button></div>`).join('')}`;
      document.querySelector('[data-bactions]').insertAdjacentHTML('beforeend', '<button class="btn sm ai" data-act="tr-save-forms">📚 Сохранить формы в карточку</button>');
    },
    addVariant(card, by, res) {
      if (!res) return;
      const fresh = Store.card(card.id); if (!fresh) return;
      const ru = `${String(fresh.ru).replace(/[,\s]+$/, '')}, ${res}`;
      Store.updateCard(card.id, { ru, history: Prov.add(fresh, Prov.entry(by, 'translate', { ru: { old: fresh.ru, new: ru } })) });
      UI.toast('Вариант перевода добавлен в карточку', 'good');
      const cur = this.current();
      if (cur && cur.card.id === card.id) { this.renderCard(false); this.flip(true); }
    },
    /* ---------- ✅ the AI tile / «Проверить карту»: the teacher's check right on the card (js/aihub.js does the work) ----------
     * The AI's verdict: ✓ верно (green) · ≠ другой вариант (added as a second variant) · ✎ ошибка (replaced at once).
     * All forms of the word go to the back; «↶ Вернуть» puts the whole card back. «Исправления: сначала спрашивать»
     * (⚙️ Настройки) → the popup asks first. 👀 «Проверить эту карточку вживую»: the card flips, the AI reads,
     * the old translation is struck out, the new one and the forms are written in. */
    aiLiveOn() { try { return localStorage.getItem('nk-study-ailive') === '1'; } catch (e) { return false; } },
    aiLiveSet(on) { try { localStorage.setItem('nk-study-ailive', on ? '1' : '0'); } catch (e) { /* private mode */ } },
    async aiCheckCard(pid, btn, o = {}) {
      const cur = this.current(); if (!cur) return;
      if (!window.AIHub || !AIHub.checkOne) { Views.runAiCheck([cur.card], { onDone: () => this.renderCard(false) }); return; }
      if (!AI.available()) { if (AI.bridge && AI.bridge.auth === 'bad' && AIHub.authHelp) AIHub.authHelp(); else Guides.needAI('Проверить карточку'); return; }
      const card = Store.card(cur.card.id) || cur.card;
      if (this._aiRun && this._aiRun.id === card.id) { if (o.live && !this._aiRun.live) { this._aiRun.live = true; this.aiLiveStart(this._aiRun); } return; }
      const prov = pid && AI.PROVIDERS[pid] && AI.configured(pid) ? pid : undefined;
      const run = { id: card.id, pid: prov || AI.current(), live: o.live != null ? !!o.live : this.aiLiveOn(), res: null, t0: Date.now() };
      this._aiRun = run;
      if (btn) btn.classList.add('busy');
      if (run.live) this.aiLiveStart(run); else this.aiBubble(run);
      try {
        try { run.res = await AIHub.checkOne(card, { provider: prov }); }
        catch (e) {
          // the chosen AI did not answer: another connected one checks (the popup says who)
          if (!prov || AI.chain().filter(x => x !== prov).length === 0) throw e;
          run.note = `${AI.name(prov)} не ответил (${U.niceErr(e, '', true)}) — проверил другой`;
          run.res = await AIHub.checkOne(Store.card(card.id) || card, {});
        }
      } catch (e) { run.err = e; } finally { if (btn) btn.classList.remove('busy'); if (this._aiRun === run) this._aiRun = null; }
      const here = !!(this.current() && this.current().card.id === card.id);
      if (run.err) {
        this.aiLiveStop();
        if (here) this.errBubble({ icon: AIHub.workLogo(run.pid, { size: 22 }), name: AI.name(run.pid), msg: U.niceErr(run.err, 'Проверка нейросетью'), retry: `data-act="aif-retry" data-id="${U.esc(run.pid)}"`, pick: false });
        else UI.toast(U.niceErr(run.err, 'Проверка нейросетью'), 'warn', 6000);
        return;
      }
      this._aiRes = run.res;
      const onUndo = () => this.aiUndone(run.res);
      if (!here) { if (run.res.applied) AIHub.fixToast(run.res, onUndo); return; } // moved on: the toast says what changed (with «↶ Вернуть»)
      if (run.live) await this.aiLiveShow(run.res, run);
      else { this.aiRedraw(run.res); this.aiResultBubble(run.res, run.note); }
      if (run.res.applied && !run.live) AIHub.fixToast(run.res, onUndo);
    },
    /** the card shows the new text (on the back, where the forms are) */
    aiRedraw(res) {
      const cur = this.current();
      if (!cur || cur.card.id !== res.cardId) return;
      this.renderCard(false); this.flip(true);
      this.refreshBadges();
    },
    aiUndone(res) {
      const cur = this.current();
      if (cur && cur.card.id === res.cardId) { this.renderCard(false); this.flip(true); }
      document.querySelectorAll('.aif-bubble, .aif-cap').forEach(b => b.remove());
    },
    aiHead(pid, chip) {
      return `<div class="tr-bubble-head">${AIHub.workLogo(pid, { size: 24, on: !chip })} <b>${U.esc(AI.name(pid))}</b>${chip || ''}</div>`;
    },
    /** the popup while the AI works: «👀 Проверить эту карточку вживую» switches this very check to the live view */
    aiBubble(run) {
      const stage = document.querySelector('.stage'); if (!stage) return;
      stage.querySelectorAll('.tr-bubble').forEach(b => b.remove());
      const deep = AIHub.depthOf() === 'card';
      stage.insertAdjacentHTML('beforeend', `<div class="tr-bubble aif-bubble" role="status">
        <button class="tr-bubble-x" data-act="bubble-close" title="Закрыть" aria-label="Закрыть">✕</button>
        ${this.aiHead(run.pid, '<span class="chip">проверяет…</span>')}
        <div class="aif-load"><span class="spinner sm"></span> Сверяет перевод${deep ? ' и всю карточку' : ''}, пишет все формы слова</div>
        <div class="row aif-acts"><button class="btn sm" data-act="aif-live">👀 Проверить эту карточку вживую</button></div></div>`);
    },
    /** the popup with the verdict: ✓ / ≠ / ✎, the reason, what was added; «↶ Вернуть», «👀 Показать вживую» (or ✓ / ＋ / «Оставить» when asking) */
    aiResultBubble(res, note) {
      const stage = document.querySelector('.stage'); if (!stage) return;
      stage.querySelectorAll('.tr-bubble').forEach(b => b.remove());
      const it = res.item, f = it.f || {}, ru = f.ru, ask = res.mode === 'ask' && !res.applied && res.main.length;
      const ok = !ru && !f.no && (res.r.ok || res.r.verdict === 'correct');
      const alt = ru && ru.kind === 'alt';
      const chip = ok ? '<span class="chip learned">✓ перевод верный</span>'
        : alt ? `<span class="chip due">≠ другой вариант${ask ? '' : ' · добавлен'}</span>`
        : `<span class="chip due aif-chip-fix">${ask ? '✎ нашла ошибку' : '✎ исправлено'}</span>`;
      const first = s => String(s || '').split('\n')[0];
      const main = alt ? `<div class="tr-bubble-res">${UI.rich(res.r.alt || '')}</div>`
        : ru ? `<div class="aif-swap"><s>${UI.rich(first(ru.old))}</s><span aria-hidden="true">→</span><b>${UI.rich(first(ru.new))}</b></div>`
        : f.no ? `<div class="aif-swap"><s>${U.esc(first(f.no.old))}</s><span aria-hidden="true">→</span><b>${U.esc(first(f.no.new))}</b></div>`
        : `<div class="tr-bubble-res">${UI.rich(first(Store.card(res.cardId) ? Store.card(res.cardId).ru : it.ru))}</div>`;
      const reason = it.reason || (!res.r.ok && (it.issues || [])[0]) || '';
      const extra = [];
      if (f.forms) extra.push(`📚 ${f.forms.oldArr && f.forms.oldArr.length ? 'Формы слова исправлены' : 'Формы слова'}: ${(f.forms.arr || []).length}${ask ? '' : ' — на обороте'}`);
      if (f.example && !f.example.old) extra.push('💬 Пример с переводом');
      Object.keys(f).filter(k => ['uk', 'description', 'examples', 'synonyms'].includes(k) || (k === 'wordClass' && f.wordClass.old) || ((k === 'example' || k === 'exampleRu') && f.example && f.example.old) || (k === 'exampleRu' && !f.example)).forEach(k => {
        // was the field empty? Then the AI added it (examples per form, synonyms, Ukrainian…) — «исправлено» only for a real change
        const x = f[k] || {}, added = !String(x.old || '').trim() && !(x.oldArr || []).length;
        extra.push(`${AIHub.FNAME[k] || k}: ${ask ? (added ? 'предлагает добавить' : 'предлагает исправить') : added ? 'добавлено' : 'исправлено'}`);
      });
      const done = !!res.applied;
      stage.insertAdjacentHTML('beforeend', `<div class="tr-bubble aif-bubble ${ok ? 'ok' : 'diff'}">
        <button class="tr-bubble-x" data-act="bubble-close" title="Закрыть" aria-label="Закрыть">✕</button>
        ${this.aiHead(res.by, chip)}
        ${note ? `<div class="small muted" style="margin:2px 0 4px">ℹ️ ${U.esc(note)}</div>` : ''}
        ${main}
        ${reason ? `<div class="aif-reason">${U.esc(reason)}</div>` : ''}
        ${extra.length ? `<ul class="aif-list">${extra.map(x => `<li>${U.esc(x)}</li>`).join('')}</ul>` : ''}
        <div class="row aif-acts">
          ${ask ? `<button class="btn sm primary" data-act="aif-accept">${alt ? '＋ Добавить вариант в карточку' : '✓ Исправить'}</button><button class="btn sm" data-act="aif-keep">Оставить как было</button>` : ''}
          ${done ? '<button class="btn sm" data-act="aif-undo">↶ Вернуть</button>' : ''}
          ${done ? '<button class="btn sm" data-act="aif-replay">👀 Показать вживую</button>' : ''}
        </div></div>`);
    },
    /* ---------- 👀 live on the study card ---------- */
    aiWait(ms) { return new Promise(r => { if (this._aifSkip || !ms) { r(); return; } const t = setTimeout(r, ms); this._aifWake = () => { clearTimeout(t); r(); }; }); },
    aiReduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } },
    /** the caption under the card: who, what it does now, ⏩ / ⚡ / the result with «↶ Вернуть» */
    aiCap(html, acts) {
      const stage = document.querySelector('.stage'); if (!stage) return;
      let cap = document.querySelector('.aif-cap');
      if (!cap) { cap = document.createElement('div'); cap.className = 'aif-cap'; cap.setAttribute('role', 'status'); cap.setAttribute('aria-live', 'polite'); stage.after(cap); }
      cap.innerHTML = `<span class="aif-cap-t">${html}</span><span class="aif-cap-a">${acts || ''}</span>`;
    },
    aiLiveStart(run) {
      const fc = document.querySelector('[data-card]'); if (!fc) return;
      this._aifSkip = false;
      document.querySelectorAll('.stage .tr-bubble').forEach(b => b.remove());
      fc.classList.add('aif-live', 'aif-reading');
      this.aiSee();
      const card = Store.card(run.id) || {};
      const word = U.esc(String(card.no || '').split('\n')[0].slice(0, 60));
      const nm = U.esc(AI.name(run.pid));
      const acts = '<button class="btn sm ghost" data-act="aif-fast" title="Без анимации — сразу результат">⚡ Быстро</button>';
      this.aiCap(`${AIHub.workLogo(run.pid, { size: 26, on: true })}<span><b>${nm}</b> читает «${word}»…</span>`, acts);
      clearTimeout(this._aifT);
      // it reads the Norwegian side, then turns the card over to compare the translation (only while the answer is on its way)
      if (S.flipped) this.flip(false);
      this._aifT = setTimeout(() => {
        if (!fc.isConnected || !fc.classList.contains('aif-reading')) return;
        this.flip(true);
        this.aiCap(`${AIHub.workLogo(run.pid, { size: 26, on: true })}<span><b>${nm}</b> сравнивает перевод${AIHub.depthOf() === 'card' ? ', проверяет всю карточку' : ''} и пишет формы слова…</span>`, acts);
      }, this.aiReduced() ? 400 : 1500);
    },
    /** the card (and the caption under it) in view */
    aiSee() {
      const st = document.querySelector('.stage'); if (!st) return;
      const r = st.getBoundingClientRect();
      if (r.top < 60 || r.top > innerHeight * 0.4) { try { window.scrollBy({ top: r.top - 70, behavior: this.aiReduced() ? 'auto' : 'smooth' }); } catch (e) { /* old browser */ } }
    },
    aiLiveStop() {
      clearTimeout(this._aifT);
      document.querySelectorAll('[data-card].aif-live').forEach(fc => fc.classList.remove('aif-live', 'aif-reading'));
      document.querySelectorAll('.aif-cap').forEach(c => c.remove());
    },
    /** the answer came (or «👀 Показать вживую» again): the old text is struck out, the new one and the forms are written in */
    async aiLiveShow(res, run) {
      clearTimeout(this._aifT);
      this._aifSkip = false;
      const cur = this.current(); if (!cur || cur.card.id !== res.cardId) return;
      document.querySelectorAll('.stage .tr-bubble').forEach(b => b.remove());
      const f = res.item.f || {}, ask = res.mode === 'ask' && !res.applied && res.main.length;
      const nm = U.esc(AI.name(res.by));
      const logo = AIHub.workLogo(res.by, { size: 26, on: true });
      const skip = '<button class="btn sm ghost" data-act="aif-skip" title="Сразу показать результат">⏩ Быстрее</button>';
      this.aiCap(`${logo}<span><b>${nm}</b> ${res.r.ok && !res.keys.length ? 'проверила: всё верно' : ask ? 'нашла, что поправить' : 'исправляет карточку'}</span>`, skip);
      // the card with its new text, flipped before the person's eyes
      this.renderCard(false);
      this.aiCap(`${logo}<span><b>${nm}</b> ${res.r.ok && !res.keys.length ? 'проверила: всё верно' : ask ? 'нашла, что поправить' : 'исправляет карточку'}</span>`, skip);
      const fc = document.querySelector('[data-card]'); if (!fc) return;
      fc.classList.add('aif-live');
      if (f.forms) fc.querySelectorAll('.face.back [data-forms-box] .fg-row').forEach(r => r.classList.add('aif-pre')); // written in below, row by row
      this.aiSee();
      await this.aiWait(this.aiReduced() ? 150 : 350);
      this.flip(true);
      await this.aiWait(this.aiReduced() ? 200 : 700);
      const back = fc.querySelector('.face.back') || fc;
      // 1) the translation: the old one lights up and is struck out, the new one is typed in
      const ru = f.ru && (res.applied ? f.ru.st === 'applied' || f.ru.st === 'accepted' : true) ? f.ru : null;
      if (ru) {
        const el = [...fc.querySelectorAll('.word[lang="ru"]')].find(x => x.closest('.face.back')) || fc.querySelector('.word[lang="ru"]');
        if (el) {
          const keep = el.innerHTML, first = s => String(s || '').split('\n')[0];
          const oldT = first(ru.old), newT = first(ru.new);
          const alt = ru.kind === 'alt', add = alt && newT.startsWith(oldT) ? newT.slice(oldT.length) : newT;
          el.classList.add('aif-typing-host');
          el.innerHTML = `<span class="aif-old">${U.esc(oldT)}</span>${alt ? '' : ' '}<span class="aif-new"></span>`;
          this.aiCap(`${logo}<span><b>${nm}</b> ${alt ? 'добавляет второй вариант перевода' : ask ? 'предлагает перевод' : 'исправляет перевод'}${res.item.reason ? ` — ${U.esc(res.item.reason)}` : ''}</span>`, skip);
          await this.aiWait(this.aiReduced() ? 200 : 700);
          if (!alt) el.querySelector('.aif-old').classList.add('gone');
          const nb = el.querySelector('.aif-new');
          if (this.aiReduced() || this._aifSkip) nb.textContent = add;
          else { const ch = Array.from(add), step = Math.max(28, Math.min(80, 1100 / Math.max(1, ch.length))); for (let i = 0; i < ch.length && !this._aifSkip; i++) { nb.textContent += ch[i]; await this.aiWait(step); } nb.textContent = add; }
          await this.aiWait(this.aiReduced() ? 300 : 900);
          if (!ask) { el.innerHTML = keep; el.classList.remove('aif-typing-host'); el.classList.add('aif-flash'); }
        }
      }
      // 2) the forms (and the new example), row by row on the back
      const fb = back.querySelector('[data-forms-box]');
      if (f.forms && fb) {
        const dt = fb.closest('details'); if (dt) dt.open = true;
        const rows = [...fb.querySelectorAll('.fg-row')];
        rows.forEach(r => r.classList.add('aif-pre'));
        // the long back scrolls inside the card: bring the forms up there (not the whole page)
        const face = fb.closest('.face');
        if (face && face.scrollHeight > face.clientHeight) { try { face.scrollTo({ top: Math.max(0, fb.offsetTop - 60), behavior: this.aiReduced() ? 'auto' : 'smooth' }); } catch (e) { face.scrollTop = Math.max(0, fb.offsetTop - 60); } }
        this.aiCap(`${logo}<span><b>${nm}</b> пишет формы слова на обороте…</span>`, skip);
        for (const r of rows) { r.classList.remove('aif-pre'); r.classList.add('aif-in'); await this.aiWait(this.aiReduced() ? 0 : 240); }
      }
      if (f.example && !f.example.old) { const ex = back.querySelector('.example'); if (ex) { ex.classList.add('aif-in'); await this.aiWait(this.aiReduced() ? 0 : 500); } }
      // 3) the ✓ mark of the AI on both sides
      fc.querySelectorAll('.aim').forEach(m => m.classList.add('aim-pop'));
      fc.classList.remove('aif-live', 'aif-reading');
      this._aifSkip = false;
      this.aiCap(`${AIHub.workLogo(res.by, { size: 26 })}<span>${U.esc(AIHub.fixLine(res))}</span>`,
        `${ask ? '<button class="btn sm primary" data-act="aif-accept">✓ Исправить</button><button class="btn sm" data-act="aif-keep">Оставить как было</button>' : ''}${res.applied ? '<button class="btn sm" data-act="aif-undo">↶ Вернуть</button>' : ''}<button class="icon-btn sm" data-act="aif-cap-x" title="Закрыть" aria-label="Закрыть">✕</button>`);
    },
    /* ---------- «Подробнее»: the extra info on the back (explanation, forms, synonyms, examples) in blocks that open and close,
     * each with where it came from (Claude / ChatGPT / Gemini…, Ordbøkene, Tatoeba, «добавлено вами») and when.
     * A short card (no forms / synonyms / examples, a short explanation) is drawn exactly as before — no new chrome.
     * Every outside source gets a number; the same number shows on its tile on the card (Translators.markUsed). ---------- */
    MORE: { desc: ['📝 Объяснение', true], forms: ['📚 Формы слова', true], synonyms: ['🔁 Синонимы', false], examples: ['💬 Примеры', false] },
    moreOpen(kind) {
      let m = null;
      try { m = JSON.parse(localStorage.getItem('nk-more-open') || 'null'); } catch (e) { /* private mode */ }
      return m && typeof m[kind] === 'boolean' ? m[kind] : this.MORE[kind][1];
    },
    moreRemember(kind, open) {
      try { const m = JSON.parse(localStorage.getItem('nk-more-open') || '{}') || {}; m[kind] = !!open; localStorage.setItem('nk-more-open', JSON.stringify(m)); } catch (e) { /* private mode */ }
    },
    extrasHtml(card) {
      const desc = card.description ? `<div class="desc ${UI.isLong(card.description) ? 'longtext' : ''}" data-desc-box>${this.descHtml(card)}</div>` : '';
      const forms = this.formsHtml(card), syn = this.synonymsHtml(card), ex = this.examplesHtml(card);
      const rich = (card.forms || []).length || (card.synonyms || []).length || (card.examples || []).length || String(card.description || '').length > 200;
      this._srcNums = {};
      if (!rich) return desc + forms + syn + ex; // a short card: exactly as before
      return this.moreBlock(card, 'desc', desc) + this.moreBlock(card, 'forms', forms) + this.moreBlock(card, 'synonyms', syn) + this.moreBlock(card, 'examples', ex);
    },
    /** who added this part of the card, and when: the last history entry about it; else the import / you */
    srcOf(card, kind) {
      const field = kind === 'desc' ? 'description' : kind;
      const acts = { desc: ['explain'], forms: ['forms'], synonyms: ['synonyms'], examples: ['examples'] }[kind] || [];
      const h = [...(card.history || [])].reverse().find(x => acts.includes(x.a) || (x.f && x.f[field] && String(x.f[field].new || '').trim()));
      if (h) return { by: h.by, t: h.t };
      const imp = (card.history || []).find(x => x.by === 'import');
      return imp ? { by: 'import', t: imp.t } : { by: 'manual', t: card.created || 0 };
    },
    srcName(by) {
      if (by === 'manual') return 'добавлено вами';
      if (by === 'import') return 'из импорта';
      const [k, id] = String(by).split(':');
      if (k === 'ai' && AI.PROVIDERS[id]) return AI.PROVIDERS[id].short || AI.PROVIDERS[id].name;
      if (k === 'tr' && Translators.LIST[id]) return Translators.LIST[id].name;
      return Prov.name(by);
    },
    moreBlock(card, kind, html) {
      if (!html) return '';
      const [title] = this.MORE[kind];
      const s = this.srcOf(card, kind);
      const ext = /^(ai|tr):/.test(s.by);
      let n = 0;
      if (ext) { n = this._srcNums[s.by] || (Object.keys(this._srcNums).length + 1); this._srcNums[s.by] = n; }
      let day = '';
      try { day = s.t ? new Date(s.t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : ''; } catch (e) { /* old browser */ }
      const name = this.srcName(s.by);
      const tip = `Откуда: ${name}${day ? ', ' + day : ''} — нажмите, чтобы увидеть историю карточки`;
      return `<details class="sx-more" data-more="${kind}" ${this.moreOpen(kind) ? 'open' : ''}>
        <summary><span class="sxm-t">${title}</span>
          <span class="sxm-src" data-prov="${U.esc(s.by)}" data-card="${U.esc(card.id)}" title="${U.esc(tip)}" aria-label="${U.esc(tip)}">${n ? `<sup class="sxm-n">${n}</sup>` : ''}${ext ? (/^ai:/.test(s.by) && window.AIHub ? AIHub.workLogo(s.by.slice(3), { size: 16 }) : Prov.icon(s.by, 14)) : ''}<span>${U.esc(name)}${day ? ' · ' + U.esc(day) : ''}</span></span>
          <span class="sxm-more" aria-hidden="true"><span class="sxm-o">Подробнее</span><span class="sxm-c">Свернуть</span><svg viewBox="0 0 12 12" width="12" height="12"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span></summary>
        ${html}</details>`;
    },
    /** the numbers of the sources on their tiles (back rails by data-rk, front tiles by data-prov) */
    markSources(root) {
      const nums = this._srcNums || {};
      root.querySelectorAll('.card-rail').forEach(r => {
        r.querySelectorAll('.tool-btn[data-used]').forEach(b => { delete b.dataset.used; const s = b.querySelector('.tool-badge'); if (s) s.textContent = ''; });
        Object.entries(nums).forEach(([k, n]) => {
          Translators.markUsed(r, k, n);
          r.querySelectorAll(`.tool-btn[data-prov="${k}"]`).forEach(b => { const s = b.querySelector('.tool-badge'); if (s) { b.dataset.used = n; s.textContent = n; } });
        });
      });
      root.querySelectorAll('details.sx-more').forEach(d => { if (!d._sxm) { d._sxm = true; d.addEventListener('toggle', () => this.moreRemember(d.dataset.more, d.open)); } });
    },
    /** re-draw the glowing "who worked on it" icons on the front side */
    refreshBadges() {
      const cur = this.current(); if (!cur) return;
      const card = Store.card(cur.card.id);
      const front = document.querySelector('.face.front'); if (!front) return;
      front.querySelectorAll('.front-rail').forEach(r => r.remove());
      front.insertAdjacentHTML('beforeend', Translators.activeRailsHtml(card));
      if (Translators.fitRails) Translators.fitRails(front.parentElement || front);
      front.classList.toggle('has-rail', Object.keys(Translators.activity(card)).length > 0);
    },

    async onClick(e) {
      const rb = e.target.closest('.card-rail [data-tr], .card-rail [data-ai]');
      if (rb && S) { e.stopPropagation(); this.verifyWith(rb.dataset.ai ? 'ai' : 'tr', rb.dataset.ai || rb.dataset.tr, rb); return; }
      const a = e.target.closest('[data-act]');
      if (!a || !S) return;
      const cur = this.current();
      const card = cur && cur.card;
      switch (a.dataset.act) {
        case 'exit': this.exitAsk(); break;
        case 'undo': this.undo(); break;
        case 'flip': this.flip(); break;
        case 'grade': this.grade(+a.dataset.g); break;
        case 'check': S.answeredType ? this.typeNext() : this.checkTyped(); break;
        case 'override': S.answeredType = 3; this.typeNext(); break;
        case 'ins': { const i = document.querySelector('[data-type]'); if (i && !i.readOnly) { i.setRangeText(a.dataset.ch, i.selectionStart, i.selectionEnd, 'end'); i.focus(); } break; }
        case 'quiz': this.quizAnswer(a); break;
        case 'quiz-next': this.quizNext(); break;
        case 'speak-front': if (card) this.readSide(false, S.mode === 'listen' ? 'no' : Store.settings.readMode); break;
        case 'speak-back': if (card) this.readSide(true, Store.settings.readMode); break;
        case 'speak-no': if (card) TTS.speakText(card.no, 'no'); break;
        case 'speak-ex': if (card) TTS.speakText(card.example + '\n' + (Store.settings.readMode === 'no' ? '' : card.exampleRu || ''), Store.settings.readMode); break;
        case 'read':
          Store.setSetting('readMode', a.dataset.mode);
          document.querySelectorAll('[data-act="read"]').forEach(b => b.classList.toggle('primary', b === a));
          if (card) this.readVisible();
          break;
        case 'slow': if (card) this.readVisible({ rate: 0.55 }); break;
        case 'speed': {
          const sp = a.dataset.speed;
          document.querySelectorAll('[data-act="speed"]').forEach(b => b.classList.toggle('active', b === a));
          const wasReading = TTS.state() === 'playing';
          TTS.setSpeed(sp);
          if (!wasReading && card) this.readVisible(); // let the user hear the new speed right away
          UI.toast(`Скорость: ${sp === 'slow' ? '🐢 медленно (×0.5, по словам)' : sp === 'fast' ? '🐇 быстро (×1.4)' : `🚶 обычно (×${TTS.currentRate()})`}`, 'good', 1800);
          break;
        }
        case 'stop-tts': case 'tts-stop': TTS.stop(); break;
        case 'tts-toggle': if (TTS.state() === 'idle') this.readVisible(); else TTS.toggle(); break;
        case 'tts-restart': TTS.restart(); break;
        case 'tv-prev': this.tvJump(-1); break;
        case 'tv-next': this.tvJump(1); break;
        case 'tv-retry': if (card) { const T = this._tvTried, l = this.tvData(card).lang; if (T) this.tvNeed(card, this.tvMode()).forEach(s => T.delete(l + '|' + s)); this.tvRedraw(card.id); this.tvAfter(Store.card(card.id) || card); } break;
        case 'tv': {
          // 📄 another view of the text (remembered for every text card); a reading goes on at about the same place
          const v = a.dataset.v;
          if (!card || v === this.tvMode()) break;
          const F = this._tvFull, reading = TTS.state() !== 'idle' && F && F.face && F.cid === card.id;
          const playing = reading && TTS.state() === 'playing', frac = reading ? Math.max(0, this.tvG()) / Math.max(1, F.segs.length) : 0;
          Store.setSetting('textView', v);
          this.tvRedraw(card.id);
          this.tvAfter(Store.card(card.id) || card);
          if (playing) this.readSide(F.face === 'back', F.last.mode, {}, frac || 0.0001);
          else if (reading) TTS.stop();
          const nb = document.querySelector(`[data-area] [data-tv] [data-act="tv"][data-v="${v}"]`); if (nb) try { nb.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
          break;
        }
        case 'redraw': {
          if (!card) return;
          a.disabled = true; a.innerHTML = '<span class="spinner sm"></span> Рисую…';
          document.querySelectorAll('.card-img, .pfx-img').forEach(img => { img.style.opacity = '.35'; });
          try {
            // every press = another variant: 1st the article photo, then photos of related articles (another car…)
            S.redrawN = S.redrawn === card.id ? (S.redrawN || 0) + 1 : 1;
            const url = await Images.redraw(card, { variant: S.redrawN, newScene: S.redrawN > 3 });
            if (!S) return; // the session was closed while the picture was being drawn
            S.redrawn = card.id;
            if (Images.lastSource !== 'ai' && Images.limited()) {
              Guides.images();
            }
            const cur2 = this.current();
            if (cur2 && cur2.card.id === card.id) {
              const imgs = document.querySelectorAll('.card-img, [data-img-wait]');
              document.querySelectorAll('.card-img-wrap.pfx-pic').forEach(w => { w.classList.remove('pfx-pic'); w.removeAttribute('style'); w.querySelectorAll('.pfx-r, .pfx-cast, .pfx-vig').forEach(x => x.remove()); }); // 🎚 a new picture starts clean
              if (imgs.length) imgs.forEach(el => { const w = el.closest('.card-img-wrap'); el.outerHTML = `<img class="card-img" src="${U.esc(url)}" alt="">`; if (w) { w.classList.remove('img-broken'); if (!w.querySelector('.pic-btn')) w.insertAdjacentHTML('beforeend', this.picBtn(true)); } });
              else this.redrawCard();
              if (!S.flipped && !['front', 'both'].includes(Store.settings.imageSide)) this.flip(true);
            }
          } catch (err) { UI.toast(err.message, 'bad'); document.querySelectorAll('.card-img, .pfx-img').forEach(img => { img.style.opacity = ''; }); }
          a.disabled = false; a.innerHTML = '🎨 Перерисовать';
          break;
        }
        case 'ordbok': if (card) this.ordbokBubble(card, a); break;
        case 'tt-add': {
          const b = this._bubble;
          if (!card || !b || !b.examples) return;
          const fresh = Store.card(card.id);
          const seen = new Set((fresh.examples || []).map(x => U.norm(x.no)));
          const examples = (fresh.examples || []).concat(b.examples.filter(x => !seen.has(U.norm(x.no))));
          Store.updateCard(card.id, { examples, history: Prov.add(fresh, Prov.entry('tr:tatoeba', 'examples', { examples: { old: Prov.listText(fresh.examples, true), new: Prov.listText(examples, true) } }, 'живые примеры Tatoeba')) });
          UI.toast('Живые примеры добавлены в карточку ✓', 'good');
          this.renderCard(false); this.flip(true);
          break;
        }
        case 'native': {
          if (!card) return;
          a.classList.add('busy');
          // a real speaker's recording exists only for single words (Lingua Libre) — so: the word by a native speaker,
          // then the WHOLE card is read on (pause / stop / restart work as usual)
          const readRest = () => { const c2 = this.current(); if (c2 && c2.card.id === card.id) TTS.speakText(this.sideText(c2, true), Store.settings.readMode || 'all'); };
          try {
            const r = await Sources.playNative(card);
            const au = TTS._audio;
            UI.toast(`🎙 Голос носителя${r.speaker ? ': ' + r.speaker : ''} · Lingua Libre — дальше читаю всю карточку`, 'good', 3000);
            a.classList.remove('busy');
            if (au) {
              await new Promise(res => ['ended', 'error', 'pause'].forEach(ev => au.addEventListener(ev, res, { once: true })));
              if (TTS._audio !== au) break; // stopped by the user
              TTS._audio = null;
            }
            readRest();
          } catch (err) {
            a.classList.remove('busy');
            if (/записи носителя/.test(err.message)) Guides.noNative(Ordbok.bare(card.no)); else UI.toast(err.message, 'warn', 4000);
            readRest();
          }
          break;
        }
        case 'ob-open': if (card) window.open(Ordbok.siteUrl(card), '_blank', 'noopener'); break;
        case 'ob-retry': if (card) this.ordbokBubble(card, a); break;
        case 'tt-retry': if (card) this.tatoebaBubble(card, a); break;
        case 'ob-view': {
          // switch the view of the Ordbøkene article; «word» glosses every word (translated in context, step by step)
          Store.setSetting('exView', a.dataset.v);
          const b = this._bubble;
          if (!card || !b || !b.ordbok) break;
          const draw = () => { if (this._bubble === b && this.current() && this.current().card.id === card.id && document.querySelector('.ob-bubble')) this.ordbokShow(card, b.ordbok); };
          draw();
          if (a.dataset.v === 'word') {
            const r = b.ordbok;
            const lines = [...r.definitions.flatMap(d => [d, ...d.examples]), ...r.expressions].filter(x => x && x.no).map(x => ({ s: x.no, ru: x.ru || undefined }));
            let t = null;
            Translators.onPut = () => { clearTimeout(t); t = setTimeout(draw, 150); };
            try { await this.translateUnits([], lines); } catch (e) { /* glosses stay «…» */ } finally { Translators.onPut = null; clearTimeout(t); }
            draw();
            if (this._lastFail) this.failModal(() => { const w = document.querySelector('.ob-bubble [data-act="ob-view"][data-v="word"]'); if (w) w.click(); });
          }
          break;
        }
        case 'tr-retry': if (card) this.verifyWith(a.dataset.kind, a.dataset.id, a); break;
        case 'tr-pick': if (card) { const rk = a.closest('.tr-bubble'); this.failModal(() => { if (rk) rk.remove(); const c2 = this.current(); if (c2) this.verifyWith('tr', Translators.dictMain() === 'ai' ? 'ai' : Translators.dictMain(), null); }); } break;
        case 'mt-toggle': a.classList.toggle('open'); break;
        case 'mt-recheck': if (card) this.ordbokBubble(card, a); break;
        case 'mt-ok': {
          if (!card) return;
          const fresh = Store.card(card.id);
          Store.updateCard(card.id, { mtWarn: false, history: Prov.add(fresh, Prov.entry('manual', 'verify', null, 'перевод статьи проверен вручную — предупреждение скрыто')) });
          UI.toast('Предупреждение скрыто ✓', 'good', 1800);
          this.renderCard(false); this.flip(true);
          break;
        }
        case 'ob-ai': if (card) this.ordbokRefine(card, a); break;
        case 'youtube': if (card) YouTube.open(Store.card(card.id) || card); break;
        case 'telegram': if (card) Telegram.open(Store.card(card.id) || card); break;
        case 'grammar': if (card) Grammar.open(Store.card(card.id) || card); break;
        case 'card-audio': if (card && window.Subs) Subs.playAudio(Store.card(card.id) || card); break; // 🎬 the real voice from the video
        case 'social': if (card) Social.open(Store.card(card.id) || card); break;
        case 'listen-deck': if (Listen.p) Listen.toggle(); else Listen.open(card && card.deckId); break;
        case 'library': Library.open(card && card.deckId); break;
        case 'copy-card': if (card) this.copyText(this.cardText(Store.card(card.id) || card), 'Текст карточки скопирован'); break;
        case 'ob-copy': if (this._bubble && this._bubble.ordbok) this.copyText(Ordbok.toText(this._bubble.ordbok), 'Статья скопирована'); break;
        case 'ob-add': {
          const b = this._bubble;
          if (!card || !b || !b.ordbok) return;
          const fresh = Store.card(card.id);
          const block = Ordbok.toText(b.ordbok);
          const desc = Ordbok.merge(fresh.description, block);
          const via = (b.ordbok.translatedBy || []).map(id => id === 'ai' ? AI.name(Translators.lastAI) : (Translators.LIST[id] || {}).name || id).join(' + ') || 'без перевода';
          Store.updateCard(card.id, { description: desc, mtWarn: Translators.mtFlag(b.ordbok.translatedBy), history: Prov.add(fresh, Prov.entry('tr:ordbok', 'explain', { description: { old: '', new: block } }, `статья из Ordbøkene с переводом (${via})`)) });
          UI.toast('Статья Ordbøkene добавлена в карточку ✓', 'good');
          this.renderCard(false); this.flip(true);
          break;
        }
        case 'edit': if (card) Views.editCard(card.id, card.deckId, saved => { if (!S) return; if (!saved) { S.queue.shift(); S.done++; this.next(true); } else { const cur2 = this.current(); if (cur2 && cur2.card.id === card.id) this.redrawCard(); } }); break;
        // 🖼 every picture source (js/views.js) — the card changes in place, the session goes on
        case 'pic': if (card) Views.pickCardImage(Store.card(card.id) || card, () => this.picChanged(card.id)); break;
        // 🎚 the photo settings: frame, rotation, light, colour, styles (on an art card — its frame, the art editor's one)
        case 'fx': {
          if (!card) return;
          const media = a.closest('.ac-card') && a.closest('.ac-card').querySelector('.ac-media'), r = media && media.getBoundingClientRect();
          PhotoFxCore.open(card.id, { art: !!media, ar: r && r.width && r.height ? r.width / r.height : 0, onSaved: () => this.picChanged(card.id) });
          break;
        }
        case 'pin': {
          if (!card) return;
          const id = card.id;
          // 📌 the in-app gallery (Pinterest-like, Norwegian themes on top); real Pinterest is its second tab
          Views.picSource('feed', Store.card(id) || card, { onPick: patch => {
            Views.picApply(id, patch, patch.imageSrc === 'pinterest' ? '📌 Картинка из Pinterest на карточке' : '📌 Фото из галереи на карточке', () => this.picChanged(id));
            this.picChanged(id);
          } });
          break;
        }
        case 'ai-check': if (card) { if (window.AIHub && AIHub.checkOne) this.aiCheckCard(AI.current(), a); else Views.runAiCheck([card], { onDone: () => this.renderCard(false) }); } break;
        case 'explain': {
          if (!card) return;
          const box = document.querySelector('[data-explain]');
          if (!AI.available()) { Guides.needAI('Объяснить'); return; }
          box.innerHTML = `<div class="panel explain-box"><span class="spinner sm"></span> ${U.esc(AI.name())} объясняет…</div>`;
          try {
            const txt = await AI.explain(card);
            if (this.current() && this.current().card.id === card.id) {
              box.innerHTML = `<div class="panel explain-box"><div class="row"><h3>${AI.icon(AI.lastProvider, 18)} Объяснение · ${U.esc(AI.name(AI.lastProvider))}</h3><span class="grow"></span>${Listen.hereBtn('.explain-box', 'Объяснение', 'Слушать')}
                <button class="btn sm primary" data-act="explain-save">${NI('plus')}<span>Добавить в карточку</span></button></div><div class="content">${UI.rich(txt)}</div>
                ${window.Views && Views.aiNote ? Views.aiNote({ answer: txt, question: `${String(card.no || '').slice(0, 300)} — ${String(card.ru || '').slice(0, 300)}`, task: 'explain', provider: AI.name(AI.lastProvider) }) : ''}</div>`;
              box.dataset.text = txt;
            }
          } catch (err) { box.innerHTML = ''; UI.toast(err.message, 'bad', 6000); }
          break;
        }
        case 'tr-add': {
          if (card && this._bubble) { this.addVariant(card, this._bubble.by, this._bubble.res); this._bubble = null; }
          document.querySelectorAll('.tr-bubble').forEach(b => b.remove());
          break;
        }
        case 'say': TTS.speak(a.dataset.say, a.dataset.lang || 'no'); break;
        case 'ex-view': {
          Store.setSetting('exView', a.dataset.v);
          if (card) { this.redrawExamples(card.id); this.fillExamples(Store.card(card.id) || card); }
          break;
        }
        case 'ex-read': {
          if (card) await this.exRead(Store.card(card.id) || card, +a.dataset.i, a);
          break;
        }
        case 'dir': {
          // switch direction on the fly: front RU -> back NO (with everything), or back again
          const v = a.dataset.dir;
          S.opts.dir = v;
          S.queue.forEach(q => { q.dir = v === 'mix' ? (Math.random() < 0.5 ? 'nr' : 'rn') : v; });
          Store.setSetting('direction', v);
          document.querySelectorAll('.dir-switch button').forEach(b => b.classList.toggle('active', b === a));
          S.flipped = false; TTS.stop();
          this.renderCard(true);
          UI.toast(v === 'rn' ? `${this.trFlag()} → 🇳🇴: вспоминайте норвежское слово` : v === 'nr' ? `🇳🇴 → ${this.trFlag()}: вспоминайте перевод` : '🔀 Вперемешку', 'good', 1800);
          break;
        }
        case 'trlang': {
          // 🇷🇺 / 🇺🇦 / both — right in the session: the card is drawn again in the chosen language
          const v = ['ru', 'uk', 'both'].includes(a.dataset.v) ? a.dataset.v : 'ru';
          Store.setSetting('transLang', v);
          document.querySelectorAll('.tr-seg button').forEach(b => { const on = b.dataset.v === v; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); });
          document.querySelectorAll('.dir-switch button').forEach(b => { const d = b.dataset.dir; if (d === 'nr' || d === 'rn') b.innerHTML = this.dirMark(d); });
          S.flipped = false; S.answeredType = null; S.quizDone = false; TTS.stop();
          this.renderCard(false);
          break;
        }
        case 'all-cards': {
          // every card of the session: look through them, «▶ Перейти к этой карте» puts it next
          const ids = (S.allIds || []).filter(x => Store.card(x));
          Views.viewCard(card ? card.id : ids[0], ids, { inSession: true, onJump: cid => this.jumpTo(cid) });
          break;
        }
        case 'reshuffle': {
          if (S.queue.length < 3) { UI.toast('Осталось слишком мало карт, чтобы перемешивать', ''); break; }
          // the card on screen stays; the rest is shuffled
          S.queue = [S.queue[0], ...U.shuffle(S.queue.slice(1))];
          UI.toast('🔀 Оставшиеся карты перемешаны', 'good', 1800);
          break;
        }
        case 'hints': {
          const on = Store.settings.hints === false;
          Store.setSetting('hints', on);
          a.classList.toggle('off', !on);
          a.innerHTML = `${UI.icon(on ? 'bulb' : 'bulbOff', 18)}<span>Подсказки</span>`;
          this.renderCard(false); if (S.flipped) this.flip(true);
          UI.toast(on ? '💡 Подсказки включены' : 'Подсказки выключены — на лицевой стороне только слово', 'good', 2200);
          break;
        }
        case 'layout': {
          const cur3 = Store.settings.studyLayout || 'auto';
          const opts = [
            ['auto', 'Авто', 'по бокам на широком экране, снизу на телефоне'],
            ['sides', 'По бокам', 'озвучка слева · карточка справа'],
            ['left', 'Слева', 'все кнопки в левой колонке'],
            ['right', 'Справа', 'все кнопки в правой колонке'],
            ['bottom', 'Снизу', 'под карточкой, как раньше'],
          ];
          const pop = UI.popover(a, `<div class="pop-title">${UI.icon('layout', 16)} Расположение кнопок</div>
            <div class="lt-grid">${opts.map(([v, t, d]) => `<button class="lt-tile ${cur3 === v ? 'active' : ''}" data-lt="${v}">
              <span class="lt-thumb lt-${v}"><i class="a"></i><i class="c"></i><i class="b"></i></span>
              <span class="lt-text"><b>${t}${cur3 === v ? ' ' + UI.icon('check', 14) : ''}</b><small>${d}</small></span></button>`).join('')}</div>`, 'layout-pop');
          pop.el.onclick = ev => {
            const tile = ev.target.closest('[data-lt]'); if (!tile) return;
            Store.setSetting('studyLayout', tile.dataset.lt);
            const el = document.querySelector('.study'); if (el) el.dataset.layout = tile.dataset.lt;
            pop.close();
            UI.toast('Расположение кнопок сохранено', 'good', 1500);
          };
          break;
        }
        case 'enrich': {
          if (!card) return;
          const ok = await Views.enrichCard(card, a.dataset.kind, a);
          const cur2 = this.current();
          if (ok && cur2 && cur2.card.id === card.id) { this.renderCard(false); this.flip(true); }
          break;
        }
        case 'tr-save-forms': {
          const b = this._bubble;
          if (!card || !b || !(b.forms || []).length) return;
          const fresh = Store.card(card.id);
          if (fresh.forms.length && !(await UI.confirm('В карточке уже есть формы. Заменить их этими?', { ok: '🔄 Заменить' }))) return;
          Store.updateCard(card.id, { forms: b.forms, history: Prov.add(fresh, Prov.entry(b.by, 'forms', { forms: { old: Prov.listText(fresh.forms), new: Prov.listText(b.forms) } })) });
          UI.toast('Формы с переводом сохранены в карточке ✓', 'good');
          this.renderCard(false); this.flip(true);
          break;
        }
        case 'bubble-close': document.querySelectorAll('.tr-bubble').forEach(b => b.remove()); break;
        /* ✅ the AI check on the card (aiCheckCard) */
        case 'aif-live':
          this.aiLiveSet(true);
          if (this._aiRun && card && this._aiRun.id === card.id) { this._aiRun.live = true; this.aiLiveStart(this._aiRun); }
          else if (this._aiRes && card && this._aiRes.cardId === card.id) this.aiLiveShow(this._aiRes);
          else if (card) this.aiCheckCard(AI.current(), null, { live: true });
          break;
        case 'aif-replay': if (this._aiRes && card && this._aiRes.cardId === card.id) this.aiLiveShow(this._aiRes); break;
        case 'aif-fast': this.aiLiveSet(false); if (this._aiRun) { this._aiRun.live = false; this.aiLiveStop(); this.aiBubble(this._aiRun); } break;
        case 'aif-skip': this._aifSkip = true; if (this._aifWake) this._aifWake(); break;
        case 'aif-undo': if (this._aiRes && AIHub.undoOne(this._aiRes)) { UI.toast('Вернула карточку, как была ✓', 'good', 2500); this.aiUndone(this._aiRes); } break;
        case 'aif-accept': if (this._aiRes && !this._aiRes.applied) { const r = this._aiRes; AIHub.acceptOne(r); this.aiRedraw(r); this.aiResultBubble(r); AIHub.fixToast(r, () => this.aiUndone(r)); document.querySelectorAll('.aif-cap').forEach(c => c.remove()); } break;
        case 'aif-keep': if (this._aiRes) { AIHub.rejectOne(this._aiRes); document.querySelectorAll('.tr-bubble, .aif-cap').forEach(b => b.remove()); this.renderCard(false); this.flip(true); UI.toast('Оставлено как было', '', 2000); } break;
        case 'aif-cap-x': document.querySelectorAll('.aif-cap').forEach(c => c.remove()); break;
        case 'aif-retry': if (card) { document.querySelectorAll('.tr-bubble').forEach(b => b.remove()); this.aiCheckCard(a.dataset.id, null); } break;
        case 'add-explain': {
          if (!card) return;
          const ok = await Views.addExplanation(card, a);
          const cur2 = this.current();
          if (ok && cur2 && cur2.card.id === card.id) { this.renderCard(false); this.flip(true); }
          break;
        }
        case 'explain-save': {
          const box = document.querySelector('[data-explain]');
          if (card && box.dataset.text) {
            Store.updateCard(card.id, { description: (card.description ? card.description + '\n\n' : '') + box.dataset.text });
            UI.toast('Добавлено в описание', 'good'); box.innerHTML = ''; this.renderCard(false); this.flip(true);
          }
          break;
        }
        case 'again': this.start(Object.assign({}, S.opts, { cardIds: [...S.unknownIds], filter: 'all', size: 0 })); break;
        case 'more': this.start(Object.assign({}, S.opts, { cardIds: null })); break;
        case 'to-deck': S.deckId ? App.go('deck', { id: S.deckId }) : App.go('home'); break;
      }
    },
    onKey(e) {
      if (!S || App.view.name !== 'study' || document.querySelector('.modal-backdrop')) return;
      const inInput = e.target.matches('input, textarea, select');
      if (S.finished) return;
      const k = e.key;
      if (k === 'Escape') { this.exitAsk(); return; }
      if (inInput) return;
      if (S.mode === 'quiz') {
        if (/^[1-4]$/.test(k)) { const b = document.querySelectorAll('.quiz-opt')[+k - 1]; if (b) this.quizAnswer(b); return; }
        if (k === 'Enter' || k === ' ') { e.preventDefault(); this.quizNext(); return; }
      }
      if (k === ' ' || k === 'Enter') { e.preventDefault(); if (S.mode !== 'type') this.flip(); return; }
      if (S.mode === 'flip' || S.mode === 'listen') {
        if (Store.settings.fourButtons && /^[1-4]$/.test(k)) { this.grade(+k); return; }
        // arrows follow the chosen swipe scheme (→/←, ↑/↓, 4 directions…)
        const adir = { ArrowRight: 'right', ArrowLeft: 'left', ArrowUp: 'up', ArrowDown: 'down' }[k];
        if (adir) {
          const a = this.actionFor(adir, true);
          if (a) { e.preventDefault(); if (a.flip) this.flip(); else { this._swipeDir = adir; this.grade(a.g); } }
          return;
        }
        if (k === '2' || k === 'k') { this.grade(3); return; }
        if (k === '1' || k === 'j') { this.grade(1); return; }
      }
      if (k === 's' || k === 'S' || k === 'ы') { if (this.current()) this.readVisible(); }
      if (k === 'p' || k === 'P' || k === 'з') { e.preventDefault(); TTS.toggle(); }
      if (k === 'e' || k === 'E' || k === 'у') { const b = document.querySelector('[data-act="edit"]'); b && b.click(); }
      if (k === 'z' || k === 'Z' || k === 'я' || k === 'Backspace') { e.preventDefault(); this.undo(); }
    },

    /** a session with answers and cards still to go: leaving asks first (an accidental ✕ / Esc / 🏠 must not end it) */
    inProgress() { return !!(S && !S.finished && S.known + S.unknown > 0 && S.queue.length > 0); },
    /** → true when it is fine to leave the session (nothing to lose, or the user said «Закончить» / «Выйти») */
    async leaveAsk(where) {
      if (!this.inProgress()) return true;
      if (this._asking) return false;
      this._asking = true;
      try {
        const r = await UI.askClose({
          title: 'Закончить занятие?', line: 'Ответы уже сохранены.',
          actions: [{ label: where === 'home' ? 'Выйти' : 'Закончить', value: 'end', cls: 'primary' }],
          cancel: 'Продолжить',
        });
        return r === 'end';
      } finally { this._asking = false; }
    },
    /** ✕ / Esc on the study screen: asks while the session is in progress, then shows the results */
    async exitAsk() {
      if (!S) return;
      if (!(await this.leaveAsk('exit'))) return;
      if (S && !S.finished) this.finish(true);
    },

    /* ---------- results ---------- */
    finish(early) {
      if (!S) return;
      TTS.stop();
      const answered = S.known + S.unknown;
      if (early && !answered) { S = null; App.back(); return; }
      S.finished = true;
      const pct = answered ? Math.round(S.known / answered * 100) : 0;
      const area = document.querySelector('[data-area]');
      document.querySelector('.study-top [data-act="undo"]').classList.add('hidden');
      // the session is over: «🗂 Все карты → Перейти» would bring a card back into a finished session (keys/undo off)
      const tools = document.querySelector('.session-tools'); if (tools) tools.classList.add('hidden');
      this.updateTop();
      const unknown = [...S.unknownIds].map(id => Store.card(id)).filter(Boolean);
      area.innerHTML = `<div class="panel results">
        <h2>${pct >= 90 ? 'Fantastisk! 🏆' : pct >= 70 ? 'Bra jobba! 💪' : pct >= 40 ? 'Godt forsøk! 🙂' : 'Øvelse gjør mester! 📚'}</h2>
        <div class="big-ring" style="--p:${pct}"><b>${pct}%</b></div>
        <div class="row" style="justify-content:center;gap:10px">
          <span class="chip learned">✓ Знаю: ${S.known}</span><span class="chip debt">✗ Не знаю: ${S.unknown}</span>
          <span class="chip">⏱ ${U.fmtDuration(Date.now() - S.startedAt)}</span>${early ? '<span class="chip due">сессия прервана</span>' : ''}
        </div>
        ${unknown.length ? `<div class="result-list">${unknown.map(c => `<div class="item"><b>${UI.rich(String(c.no).split('\n')[0].slice(0, 80))}</b><span>${UI.rich(String(this.tr(c)).split('\n')[0].slice(0, 80))}</span></div>`).join('')}</div>` : ''}
        <div class="row" style="justify-content:center;margin-top:18px">
          ${unknown.length ? `<button class="btn bad" data-act="again">🔁 Повторить незнакомые (${unknown.length})</button>` : ''}
          <button class="btn primary" data-act="more">▶ Ещё сессия</button>
          <button class="btn" data-act="to-deck">← ${S.deckId ? 'К колоде' : 'На главную'}</button>
        </div></div>`;
      if (pct >= 80 && answered >= 3) UI.confetti();
    },
    end() { S = null; if (window.FSRSOpt && FSRSOpt.schedule) FSRSOpt.schedule(3000); },
  };

  window.Study = Study;
  // ✎ a tap on a word's (translation) or on the ✎ of a sentence translation — on cards, in the viewer, the textbook…
  // (capture: the card under it must not flip / play)
  document.addEventListener('click', e => {
    const g = e.target.closest && e.target.closest('[data-glfix]');
    if (g) {
      const box = g.closest('[data-gs]'); if (!box) return;
      e.preventDefault(); e.stopPropagation();
      Study.fixGloss(box.dataset.gs, +g.dataset.gk);
      return;
    }
    const t = e.target.closest && e.target.closest('[data-trfix]');
    if (t) { e.preventDefault(); e.stopPropagation(); Study.fixSent(t.dataset.s); return; }
    // 🔄 «Подписать заново» (word view)
    const rg = e.target.closest && e.target.closest('[data-regloss]');
    if (rg) { e.preventDefault(); e.stopPropagation(); Study.regloss(rg.dataset.cid, rg); return; }
    // 📚 forms table: ✎ / a tap on a form's translation corrects it · «перевести» makes a missing one
    const ff = e.target.closest && e.target.closest('[data-forms-box] [data-ffix], [data-forms-box] [data-fftr]');
    if (ff) {
      e.preventDefault(); e.stopPropagation();
      if (ff.hasAttribute('data-fftr')) { const b = ff.closest('[data-forms-box]'); if (b) Study.fillForms(b.dataset.cid, true); }
      else Study.editFormTr(ff);
    }
  }, true);
  // ⏯ the reading controls on the study card + the word being read (📄 text views) follow the player
  document.addEventListener('tts-state', () => { try { if (window.Study && Study.tvState) Study.tvState(); } catch (e) { console.warn('study: reading controls', e); } });
  window.addEventListener('resize', () => { if (window.Study && Study.tvpPlace) Study.tvpPlace(); });
  // Esc in a form-translation editor closes only the editor (windows close on Esc in the capture phase of document)
  window.addEventListener('keydown', e => {
    const ed = e.key === 'Escape' && e.target && e.target.closest && e.target.closest('.fg-editing');
    if (!ed) return;
    e.preventDefault(); e.stopPropagation();
    const b = ed.querySelector('[data-ffcancel]'); if (b) b.click();
  }, true);
})();
