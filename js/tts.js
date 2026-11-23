/* ============ Text-to-speech: Norwegian + Russian + Ukrainian, with a player (pause / resume / stop / restart) ============ */
(function () {
  const LANG = { no: 'nb-NO', ru: 'ru-RU', uk: 'uk-UA' };
  const GOOGLE_TL = { no: 'no', ru: 'ru', uk: 'uk' };
  const LANG_RE = { no: /^(nb|no|nn)([-_]|$)/i, ru: /^ru([-_]|$)/i, uk: /^uk([-_]|$)/i };
  const LANG_NAME = { no: 'норвежского', ru: 'русского', uk: 'украинского' };
  /* Russian or Ukrainian? Letters only one of them has, then a few very common words only one of them uses */
  const C = 'Ѐ-ӿ', W = w => new RegExp(`(^|[^${C}'’ʼ])(${w})(?=$|[^${C}'’ʼ])`, 'giu');
  const UK_L = /[іїєґІЇЄҐ]/g, RU_L = /[ыэъёЫЭЪЁ]/g, UK_AP = /[Ѐ-ӿ]['’ʼ][Ѐ-ӿ]/g; // п'ять, м'ясо
  const S = e => new RegExp(`[${C}]{2,}(${e})(?=$|[^${C}])`, 'giu');
  const UK_S = S('ння|ття|ський|ська|ське|ськi'), RU_S = S('ое|ая|ее|ие|тся|ский|ская|ское');
  const UK_W = W('що|щоб|це|як|чи|або|але|вже|ще|дуже|добре|дякую|ти|ми|ви|мене|тобі|собі|його|йому|бути'), RU_W = W('и|что|чтобы|это|как|или|уже|еще|очень|хорошо|спасибо|пожалуйста|нет|да|ты|мы|вы|она|они|его|ему|меня|быть');
  const hits = (re, s) => (String(s).match(re) || []).length;
  function cyrLang(s, dflt = 'ru') {
    const uk = hits(UK_L, s) * 2 + hits(UK_AP, s) + hits(UK_W, s) + hits(UK_S, s), ru = hits(RU_L, s) * 2 + hits(RU_W, s) + hits(RU_S, s);
    return uk > ru ? 'uk' : ru > uk ? 'ru' : dflt;
  }
  /** the default for a Cyrillic piece that could be either: the chosen translation language */
  const trDefault = () => (window.Store && Store.settings && Store.settings.transLang === 'uk' ? 'uk' : 'ru');
  /* ---------- 🇺🇦 no Ukrainian voice on the device: say so once, with how to add one ---------- */
  const UK_HELP = [
    ['iPhone / iPad', 'Настройки → Универсальный доступ → Устный контент → Голоса → Украинский → скачайте голос «Lesya».'],
    ['Mac', 'Системные настройки → Универсальный доступ → Устный контент → Системный голос → Управлять голосами… → Украинский → «Lesya».'],
    ['Android', 'Настройки → Озвучивание текста (Text-to-speech) → Синтезатор речи Google → Установить голосовые данные → Українська.'],
    ['Windows', 'Параметры → Время и язык → Речь → Добавить голоса → Українська. Или откройте приложение в браузере Microsoft Edge — в нём есть украинские голоса Polina и Ostap.'],
  ];
  let ukHinted = false;
  const hasSynth = () => 'speechSynthesis' in window;
  const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const hasMS = () => 'mediaSession' in navigator;
  /** Chrome cuts an utterance after ~15 s: long pieces are said in parts (sentence / comma boundaries) */
  function split(text, max = 180) {
    if (text.length <= max) return [text];
    const out = [];
    let cur = '';
    text.split(/(?<=[.!?…;:])\s+/).forEach(sent => {
      const parts = sent.length > max ? sent.split(/(?<=[,–—])\s+/) : [sent];
      parts.forEach(w => {
        while (w.length > max) { const cut = w.lastIndexOf(' ', max) > 40 ? w.lastIndexOf(' ', max) : max; if (cur) { out.push(cur); cur = ''; } out.push(w.slice(0, cut)); w = w.slice(cut).trim(); }
        if (cur && (cur + ' ' + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
      });
    });
    if (cur) out.push(cur);
    return out.filter(x => x.trim());
  }
  /* silence as a real audio clip (8 kHz 8-bit WAV), cached by length */
  const silenceCache = {};
  function silence(ms) {
    ms = Math.max(100, Math.min(15000, Math.round(ms / 100) * 100));
    if (silenceCache[ms]) return silenceCache[ms];
    const rate = 8000, n = Math.round(rate * ms / 1000);
    const buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
    new Uint8Array(buf, 44).fill(128);
    return (silenceCache[ms] = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
  }

  /* ---------- 🎤 «Бегущая строка»: which word is being said now ----------
   * TTS.speak(text, lang, { onWord(index, charStart, charEnd, info) }) — index / offsets are the words of the text the
   * caller passed (TTS.wordsOf(text)); info = { total, src: 'boundary' | 'estimate' | 'audio' | 'end', done }.
   * At the natural end of the phrase it is called once more with index === total (all said); never after a stop.
   *  · the system voice: the browser's own word boundaries (Safari on Mac / iPhone, Chrome with the device's voices);
   *    when a voice sends none — an estimate: syllables + punctuation pauses × the speaking rate measured on the
   *    previous phrases of the same voice (corrected at the end of every phrase);
   *  · audio voices (Edge / Azure / Google Cloud / ElevenLabs / Piper / Google Translate): the same word weights spread
   *    over audio.currentTime / duration (pause, speed and seeking come with the audio itself).
   * Timers live only while the phrase is said: stop / cancel / a newer phrase end them. */
  const WORD_RE = "[\\p{L}\\p{N}][\\p{L}\\p{M}\\p{N}]*(?:['’ʼ\\-][\\p{L}\\p{N}][\\p{L}\\p{M}\\p{N}]*)*";
  function wordsOf(s) {
    const out = [], re = new RegExp(WORD_RE, 'gu');
    s = String(s == null ? '' : s);
    let m;
    while ((m = re.exec(s))) out.push({ w: m[0], s: m.index, e: m.index + m[0].length });
    return out;
  }
  const VOW = /[aeiouyæøåéèêëóòôöüúùûáàâäíìîïаеёиоуыэюяіїє]+/giu;
  /** the start of every word in «units» (≈ syllables; pauses after punctuation) and the length of the whole */
  function timeline(text, ws) {
    const st = [];
    let t = 0;
    ws.forEach((w, k) => {
      st.push(t);
      const core = w.w.toLowerCase(), digits = core.replace(/\D/g, '').length;
      const syl = digits ? Math.max(1, digits * 1.3) : (core.match(VOW) || []).length || 1;
      t += syl + 0.3 + 0.03 * core.length;
      const gap = k + 1 < ws.length ? text.slice(w.e, ws[k + 1].s) : '';
      if (/[.!?…]/.test(gap)) t += 2.2; else if (/[,;:—–]/.test(gap)) t += 1.1;
    });
    return { st, total: Math.max(t, 0.001) };
  }
  /** spoken words (after clean-up) → the caller's words: the same list, or matched word by word */
  function alignWords(sw, ow) {
    if (sw.length === ow.length) return sw.map((x, k) => k);
    const map = [];
    let j = 0;
    sw.forEach((w, k) => {
      const lw = w.w.toLowerCase();
      let f = -1;
      for (let q = j; q < Math.min(ow.length, j + 6); q++) if (ow[q].w.toLowerCase() === lw) { f = q; break; }
      if (f < 0) f = Math.max(j, Math.min(ow.length - 1, Math.round(k * ow.length / Math.max(1, sw.length))));
      map.push(Math.min(ow.length - 1, f));
      j = Math.min(ow.length - 1, f + 1);
    });
    return map;
  }
  const KBASE = 190;           // ms per unit at rate 1 before anything is measured
  const kcal = {};             // measured ms per unit at rate 1, per voice
  const bvoices = new Set();   // voices that sent word boundaries
  function WordClock(orig, cb) {
    this.cb = cb; this.ow = wordsOf(orig); this.n = this.ow.length;
    this.last = null; this.drv = null; this.part = null; this.sw = []; this.tl = { st: [], total: 1 };
  }
  WordClock.prototype = {
    /** the text really said (after clean-up, «slow» commas…) */
    spoken(text) { this.sw = wordsOf(text); this.tl = timeline(text, this.sw); this.map = alignWords(this.sw, this.ow); this.last = null; },
    emit(k, src) {
      const n = this.n;
      if (!n || !this.sw.length) return;
      const oi = k >= this.sw.length ? n : Math.max(0, Math.min(n - 1, this.map[k]));
      if (oi === this.last) return;
      this.last = oi;
      const w = oi < n ? this.ow[oi] : { s: this.ow[n - 1].e, e: this.ow[n - 1].e };
      try { this.cb(oi, w.s, w.e, { total: n, src, done: oi >= n }); } catch (e) { /* the caller's problem, never the voice's */ }
    },
    /** the last word whose start (units from the start of word k0) is reached; never past k1 before the end */
    at(units, k0, k1) {
      const st = this.tl.st, target = st[k0] + units;
      let lo = k0, hi = k1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (st[mid] <= target + 1e-6) lo = mid; else hi = mid - 1; }
      return lo;
    },
    halt() { if (this.drv) { const d = this.drv; this.drv = null; d(); } },
    /** the system voice: one utterance (a part of the text that starts at spoken word kb) */
    speech(u, part, kb, rate, vkey, isPaused, alive) {
      this.halt();
      const pws = wordsOf(part), k0 = kb, k1 = Math.min(this.sw.length, kb + pws.length) - 1;
      if (k1 < k0) return;
      const st = this.tl.st, units = (k1 + 1 < st.length ? st[k1 + 1] : this.tl.total) - st[k0];
      const known = bvoices.has(vkey);
      let t0 = Date.now(), paused = 0, pAt = 0, gotB = false;
      u.onstart = () => { if (!gotB) { t0 = Date.now(); paused = 0; pAt = 0; } };
      u.onboundary = e => {
        if (e && e.name && e.name !== 'word') return;
        const ci = (e && e.charIndex) | 0;
        let j = 0;
        while (j + 1 < pws.length && pws[j + 1].s <= ci + 1) j++;
        if (!gotB) { gotB = true; bvoices.add(vkey); }
        this.emit(k0 + j, 'boundary');
      };
      const tick = setInterval(() => {
        if (!alive()) { this.halt(); return; }
        const now = Date.now();
        if (isPaused()) { if (!pAt) pAt = now; return; }
        if (pAt) { paused += now - pAt; pAt = 0; }
        if (gotB) return;
        const el = now - t0 - paused;
        if (known && el < 900) return; // this voice tells its words itself — give it a moment
        this.emit(this.at(el * rate / (kcal[vkey] || KBASE), k0, k1), 'estimate');
      }, 60);
      this.drv = () => clearInterval(tick);
      this.part = { t0: () => t0, paused: () => paused, gotB: () => gotB, units, vkey, rate, words: pws.length };
    },
    /** a part was said to the end: measure the voice's real speed (no boundaries) for the next phrases */
    partEnd(natural) {
      const pt = this.part;
      this.part = null; this.halt();
      if (!natural || !pt || pt.gotB() || pt.words < 3) return;
      const ms = Date.now() - pt.t0() - pt.paused();
      if (ms < 400) return;
      const b = ms * pt.rate / pt.units, old = kcal[pt.vkey] || KBASE;
      kcal[pt.vkey] = Math.max(110, Math.min(450, old * 0.6 + b * 0.4));
    },
    /** an audio voice: the words follow the clip's own clock.
     *  o.marks = [{ t: seconds, c: char offset in the spoken text }] — real word times (Edge, ElevenLabs): exact;
     *  without them an estimate over currentTime / duration. o.k0 / o.k1: the clip says only these spoken words
     *  (Google Translate reads a long text in several clips). */
    audio(a, rate, ekey, o) {
      this.halt();
      o = o || {};
      const n = this.sw.length;
      if (!n || !a) return;
      const k0 = Math.max(0, Math.min(n - 1, o.k0 | 0)), k1 = o.k1 != null ? Math.max(k0, Math.min(n - 1, o.k1)) : n - 1;
      const st = this.tl.st, span = (k1 + 1 < st.length ? st[k1 + 1] : this.tl.total) - st[k0], key = 'audio:' + (ekey || '');
      // marks -> the spoken word each one starts (by character offset)
      const mk = Array.isArray(o.marks) && o.marks.length ? o.marks.map(m => {
        let k = k0;
        while (k + 1 <= k1 && this.sw[k + 1].s <= (m.c | 0)) k++;
        return { t: +m.t || 0, k };
      }).sort((x, y) => x.t - y.t) : null;
      const tick = setInterval(() => {
        if (TTS._audio !== a && (a.paused || a.ended)) { this.halt(); return; }
        if (a.paused) return;
        const d = a.duration, t = a.currentTime || 0;
        if (mk) {
          let k = -1;
          for (const m of mk) { if (m.t <= t + 0.03) k = m.k; else break; }
          if (k >= 0) this.emit(k, 'marks');
          return;
        }
        let u;
        if (isFinite(d) && d > 0.3) {
          const lead = Math.min(0.12, d * 0.04), tail = Math.min(0.3, d * 0.08);
          u = Math.max(0, Math.min(1, (t - lead) / Math.max(0.2, d - lead - tail))) * span;
        } else u = t * 1000 * (rate || 1) / (kcal[key] || KBASE); // a stream without a length (Google in Safari)
        this.emit(this.at(u, k0, k1), 'audio');
      }, 60);
      this.drv = () => clearInterval(tick);
    },
    /** the phrase is over: all words said (natural end) or just quiet (stopped) */
    end(natural) { this.partEnd(false); this.halt(); if (natural) this.emit(Infinity, 'end'); },
  };

  /** animate? the device's «reduce motion» — unless the app's own setting says otherwise (as js/subs.js) */
  function motionOk() {
    try {
      const s = window.Store && Store.state && Store.settings;
      const f = s && (s.forceMotion != null ? s.forceMotion : s.motion);
      if (f === true || f === 'on' || f === 'always') return true;
      if (f === false || f === 'off' || f === 'never') return false;
    } catch (e) { /* settings not loaded */ }
    return !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  /**
   * The painter (reader, dialogues): the word being said lights up, the words already said get calmer, and a soft mark
   * glides under the word. CSS Custom Highlight API where the browser has it (`::highlight(<name>-say)`,
   * `::highlight(<name>-done)` — the text itself is not touched), otherwise the element's text is cut into
   * <span class="<name>-w-done|-w-say"> for the time it is read (only when the element holds plain text; a running
   * selection is never broken). new Karaoke({ name, cls: class of the mark, host(el): positioned element for the mark })
   * show([{ el, cur: [start, end] | null, done: offset }]) · clear()
   */
  function firstRect(x) {
    try {
      const rs = x.getClientRects();
      for (const r of rs) if (r.width > 0 && r.height > 0) return r;
      return rs[0] || null;
    } catch (e) { return null; }
  }
  function selIn(el) {
    try { const s = window.getSelection && getSelection(); return !!(s && !s.isCollapsed && s.rangeCount && el.contains(s.getRangeAt(0).commonAncestorContainer)); } catch (e) { return false; }
  }
  function Karaoke(o) {
    this.o = Object.assign({ name: 'kar', cls: 'nk-kmark', host: null }, o || {});
    this.hl = !!(window.CSS && CSS.highlights && typeof window.Highlight === 'function');
    this.wrapped = new Set(); this.marks = new Map();
    if (this.hl) {
      try {
        this.hSay = new Highlight(); this.hDone = new Highlight();
        CSS.highlights.set(this.o.name + '-say', this.hSay); CSS.highlights.set(this.o.name + '-done', this.hDone);
      } catch (e) { this.hl = false; }
    }
  }
  Karaoke.prototype = {
    show(list) {
      const o = this.o, still = !motionOk(), keepWrap = new Set(), keepMark = new Set();
      if (this.hl) { this.hSay.clear(); this.hDone.clear(); }
      (list || []).forEach(it => {
        const el = it && it.el;
        if (!el || !el.isConnected) return;
        const text = el.textContent, len = text.length;
        const cur = it.cur && it.cur[0] >= 0 && it.cur[1] <= len && it.cur[0] < it.cur[1] ? it.cur : null;
        const done = Math.max(0, Math.min(len, (cur ? Math.min(it.done | 0, cur[0]) : it.done) | 0));
        let rect = null;
        if (this.hl) {
          if (el.childNodes.length !== 1 || el.firstChild.nodeType !== 3) return;
          const node = el.firstChild;
          const rg = (a, b) => { const r = document.createRange(); r.setStart(node, a); r.setEnd(node, b); return r; };
          if (done > 0) this.hDone.add(rg(0, done));
          if (cur) { const r = rg(cur[0], cur[1]); this.hSay.add(r); rect = firstRect(r); }
        } else {
          if (!this.wrapped.has(el) && [...el.childNodes].some(n => n.nodeType !== 3)) return; // not plain text: leave it alone
          keepWrap.add(el);
          if (!selIn(el)) {
            const pieces = [];
            const add = (a, b, cls) => { if (b > a) pieces.push([text.slice(a, b), cls]); };
            if (cur) { add(0, done, 'done'); add(done, cur[0]); add(cur[0], cur[1], 'say'); add(cur[1], len); } else { add(0, done, 'done'); add(done, len); }
            el.textContent = '';
            pieces.forEach(([t, cls]) => {
              if (!cls) { el.appendChild(document.createTextNode(t)); return; }
              const sp = document.createElement('span');
              sp.className = `${o.name}-w-${cls}`; sp.textContent = t;
              el.appendChild(sp);
            });
            this.wrapped.add(el);
          }
          const sayEl = el.querySelector(`.${o.name}-w-say`);
          rect = sayEl ? firstRect(sayEl) : null;
        }
        const host = o.host && o.host(el);
        if (host) { keepMark.add(host); this.mark(host, rect, still); }
      });
      this.wrapped.forEach(el => { if (!keepWrap.has(el)) this.unwrap(el); });
      this.marks.forEach((m, host) => { if (!keepMark.has(host)) this.mark(host, null); });
    },
    unwrap(el) {
      this.wrapped.delete(el);
      try { if (el.childNodes.length !== 1 || el.firstChild.nodeType !== 3) { const t = el.textContent; el.textContent = t; } } catch (e) { /* ignore */ }
    },
    mark(host, rect, still) {
      let m = this.marks.get(host);
      if (!rect) { if (m) { if (m.isConnected) m.classList.add('off'); else this.marks.delete(host); } return; }
      if (!m || !m.isConnected || m.parentNode !== host) {
        m = document.createElement('i');
        m.className = this.o.cls + ' off';
        m.setAttribute('aria-hidden', 'true');
        host.insertBefore(m, host.firstChild);
        this.marks.set(host, m);
      }
      const hr = host.getBoundingClientRect();
      // a host drawn a little bigger (a bubble's «scale(1.01)»): back to its own pixels
      const sx = host.offsetWidth ? hr.width / host.offsetWidth || 1 : 1, sy = host.offsetHeight ? hr.height / host.offsetHeight || 1 : 1;
      const x = (rect.left - hr.left) / sx + host.scrollLeft - host.clientLeft, y = (rect.top - hr.top) / sy + host.scrollTop - host.clientTop, h = rect.height / sy;
      // the first word, a new line, reduced motion: it appears in place; along the line it glides
      const jump = still || m.classList.contains('off') || Math.abs(y - (m._y || 0)) > h * 0.5;
      m.classList.toggle('still', !!still);
      if (jump) m.classList.add('jump');
      m.style.width = Math.max(4, rect.width / sx).toFixed(1) + 'px';
      m.style.height = h.toFixed(1) + 'px';
      m.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      m._y = y;
      if (jump) { void m.offsetWidth; m.classList.remove('jump'); }
      m.classList.remove('off');
    },
    clear() {
      if (this.hl) { try { this.hSay.clear(); this.hDone.clear(); } catch (e) { /* ignore */ } }
      [...this.wrapped].forEach(el => this.unwrap(el));
      this.marks.forEach(m => { try { m.remove(); } catch (e) { /* ignore */ } });
      this.marks.clear();
    },
  };

  const TTS = {
    wordsOf, Karaoke, motionOk, WordClock, split,
    voices: [],
    _audio: null,
    _keep: null,       // looping silent clip while the system voice reads (the tab keeps «Now Playing» on macOS)
    msOwner: '',       // who drives the Media Session now: 'tts' (speakText) or 'listen' (Listen player)
    IOS, silence,
    player: null,      // { segs, i, paused, mode, opts, text }
    last: null,        // last text read with speakText (for "restart")
    init() {
      if (!hasSynth()) return;
      const load = () => { this.voices = speechSynthesis.getVoices() || []; };
      load();
      speechSynthesis.onvoiceschanged = () => { load(); document.dispatchEvent(new Event('voices-changed')); };
    },
    voicesFor(lang) {
      const re = LANG_RE[lang] || LANG_RE.ru;
      return this.voices.filter(v => re.test(v.lang));
    },
    /**
     * How good a system voice sounds: 5 «как живой» … 2 «как робот». Safari gives the quality in voiceURI
     * (com.apple.voice.compact|enhanced|premium.ru-RU.Milena); Chrome on a Mac gives only the name, localised to the
     * system language («Милена (улучшенный)», «… (высшего качества)») — so the words are checked in several languages.
     */
    voiceQuality(v) {
      if (!v) return 0;
      const uri = String(v.voiceURI || ''), name = String(v.name || '');
      // Apple's premium neural voices: com.apple.ttsbundle.gryphon-neural_Yelena_ru-RU_premium («Голос 2») — the best Russian voice on a Mac
      if (/\.premium\.|_premium\b|gryphon|neural_/i.test(uri)) return 4;
      if (/\.enhanced\./i.test(uri)) return 3;
      if (/super-compact|\.compact\./i.test(uri)) return 2;
      const s = name + ' ' + uri;
      if (/premium|высш\S* качеств|преміум|найвищ/i.test(s)) return 4;
      if (/natural|neural|online|нейро/i.test(s)) return v.localService === false ? 5 : 4; // Edge «Online (Natural)»
      if (/enhanced|улучшенн|покращ|forbedret|förbättrad/i.test(s)) return 3;
      if (/^google\b/i.test(name)) return 3;
      return 2;
    },
    pickVoice(lang, name) {
      const st = Store.settings;
      const pref = name || (lang === 'no' ? st.voiceNo : lang === 'uk' ? st.voiceUk : st.voiceRu);
      const list = this.voicesFor(lang);
      if (pref) { const v = list.find(v => v.name === pref || v.voiceURI === pref); if (v) return v; }
      // the best-sounding voice; of equal ones the voice on the device (no network, no 15-s cut-off, works in background),
      // and for Norwegian bokmål before nynorsk
      const rank = v => this.voiceQuality(v) * 4 + (v.localService ? 2 : 0) + (/^nb/i.test(v.lang) ? 1 : 0);
      return list.slice().sort((x, y) => rank(y) - rank(x))[0] || null;
    },
    /** 'ru' | 'uk' for a Cyrillic text; dflt when it could be either («мама», «вода») */
    cyrLang,
    LANG_NAME,
    hasUkrainianVoice() { return this.voicesFor('uk').length > 0; },
    /** how to add a Ukrainian voice on each system (Settings → Озвучка, the one-time hint) */
    ukHelpHtml() {
      return `<div class="small voice-steps"><b>Как добавить украинский голос:</b><br>${UK_HELP.map(([os, how]) => `<b>${os}:</b> ${U.esc(how)}`).join('<br>')}<br>
        Пока голоса нет, украинский текст читает онлайн-голос Google (нужен интернет) или выбранный облачный голос (Edge, Azure, Google Cloud, ElevenLabs) — русским голосом украинский не читается.</div>`;
    },
    /** one-time friendly hint: no Ukrainian voice on this device */
    ukHint(online = true) {
      if (ukHinted) return;
      ukHinted = true;
      try { if (localStorage.getItem('nk-uk-voice-hint')) return; localStorage.setItem('nk-uk-voice-hint', '1'); } catch (e) { /* private mode: once per session */ }
      if (!window.UI || !UI.toastAction) return;
      const msg = 'Украинского голоса на устройстве нет — ' + (online ? 'читаю украинский онлайн-голосом Google. ' : 'украинский текст пропускаю. ') + 'Голос можно добавить в настройках системы.';
      UI.toastAction(msg, 'Как добавить', () => UI.modal({ title: '🇺🇦 Украинский голос', body: this.ukHelpHtml() + '<div class="small muted" style="margin-top:8px">После установки перезапустите браузер, затем выберите голос: Настройки → 🔊 Озвучка → «💻 Системный украинский голос 🇺🇦».</div>' }), 12000, '🇺🇦');
    },
    clean(text) {
      // links first (their «/» must not turn into pauses), then «a/b» = a pause, then the common symbol rule
      return this.symbols(this.noLinks(U.stripHtml(text)).replace(/([.!?…])\s*\\[nr]/g, '$1 ').replace(/\\[nr]/g, '. ').replace(/\([^)]*\)/g, ' ').replace(/[\/|;]/g, ', ')).replace(/\s+/g, ' ').trim();
    },
    noLinks(s) {
      return String(s || '').replace(/https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/g, ' ').replace(/(^|\s)#[\p{L}\p{N}_]+/gu, ' ');
    },
    /**
     * ONE rule for everything that is read aloud: only words are spoken.
     * Removed: backslashes (also «\n» written as text by other apps), markdown/code signs, links, e-mails, hashtags,
     * bullets, arrows, check marks, emoji; «...» becomes a short pause. Letters, digits and normal punctuation stay.
     */
    symbols(s) {
      return this.noLinks(String(s || '').replace(/\\[nrt]/g, ' '))   // «\n» typed as text; links, e-mails, hashtags
        .replace(/=/g, ', ')                                    // «a = b»: a pause, not a lost word boundary
        .replace(/[\\*_#`{}[\]<>~^@•·▸▹►▶◀→←↑↓⇄⇒✓✔✗✘☑☐§¶†‡|]/g, ' ')
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{20E3}]/gu, ' ')
        .replace(/\.{2,}|…/g, '. ')
        .replace(/\s+[–—-](?=\s|$)/g, ',')                     // a lone dash = a pause, not «минус»
        .replace(/([.!?]["»”]?)\s*,/g, '$1')                    // no comma right after the end of a sentence (also after a quote)
        .replace(/\s+([,.!?;:])/g, '$1').replace(/([,.!?;:])\1+/g, '$1')
        .replace(/\s+/g, ' ').replace(/^[\s,.;:]+|[\s,;:]+$/g, '').trim();
    },

    /**
     * Split mixed text into language segments, line by line.
     * "Hun (Она) er (есть) snill" -> [no:"Hun", ru:"Она", no:"er", ru:"есть", no:"snill"]
     */
    segments(text, mode = 'all') {
      const clean = this.noLinks(U.stripHtml(text))              // links / hashtags before «#» and «/» are touched
        .replace(/\\[nr]/g, '\n')                               // «\n» typed as text = a new line
        .replace(/\\([\\`*_{}\[\]()#+\-.!|>~])/g, '$1')
        .replace(/\\/g, ' ')                                     // no backslash is ever read aloud
        .replace(/[*_#`>|•·▸▹]+/g, ' ');
      const lines = [];
      const raws = clean.split(/\n+/);
      // 🎭 a dialogue: who says each line (js/voices.js) — every piece of a speaker's line carries «who»
      let roles = null;
      try { roles = window.Voices && Voices.dialogRoles ? Voices.dialogRoles(raws) : null; } catch (e) { roles = null; }
      raws.forEach((raw, ri) => {
        const line = raw.replace(/^\s*(\d{1,3}[.)]|[-–—])\s+/, '').trim();
        if (!line) return;
        const who = roles ? roles[ri] : null;
        const segs = [];
        const push = (lang, s) => {
          s = TTS.symbols(s.replace(/[()\[\]{}"«»“”„]/g, ' '));
          if (s && /[\p{L}\p{N}]/u.test(s)) segs.push({ lang, text: s }); // words or numbers («2024», «1, 2, 3»)
        };
        const re = /[Ѐ-ӿ][Ѐ-ӿ0-9 \t.,!?:;'’ʼ—–\-…%]*/g;
        // Russian or Ukrainian: by the piece itself; a piece that could be either gets the chosen translation language —
        // with 🇷🇺+🇺🇦 «перевод / переклад» (Study.tr) the piece after «/» a Russian one is the Ukrainian one, and the other way round
        const pieces = [];
        let last = 0, m;
        while ((m = re.exec(line))) {
          if (m.index > last) pieces.push({ lang: 'no', text: line.slice(last, m.index) });
          pieces.push({ cyr: true, lang: cyrLang(m[0], ''), text: m[0] });
          last = re.lastIndex;
        }
        if (last < line.length) pieces.push({ lang: 'no', text: line.slice(last) });
        const both = window.Store && Store.settings && Store.settings.transLang === 'both';
        const slash = (a, b) => /^[\s\/]*\/[\s\/]*$/.test(pieces.slice(a + 1, b).map(x => x.text).join('') || ' ');
        pieces.forEach((x, k) => {
          if (!x.cyr || x.lang) return;
          const prev = k >= 1 && pieces[k - 1].cyr ? k - 1 : k >= 2 && pieces[k - 2].cyr && slash(k - 2, k) ? k - 2 : -1;
          const next = pieces[k + 1] && pieces[k + 1].cyr ? k + 1 : pieces[k + 2] && pieces[k + 2].cyr && slash(k, k + 2) ? k + 2 : -1;
          if (both && prev >= 0 && slash(prev, k) && pieces[prev].lang === 'ru') x.lang = 'uk';
          else if (both && next >= 0 && slash(k, next) && pieces[next].lang === 'uk') x.lang = 'ru';
          else if (both && prev < 0 && next >= 0 && slash(k, next) && !pieces[next].lang) x.lang = 'ru';
          else x.lang = trDefault();
        });
        pieces.forEach(x => push(x.lang, x.text));
        // keep only the wanted language («ru» = the translation: Russian and Ukrainian), then merge neighbours of the same language
        const merged = [];
        segs.filter(s => mode === 'all' || s.lang === mode || (mode === 'ru' && s.lang === 'uk')).forEach(s => {
          const p = merged[merged.length - 1];
          if (p && p.lang === s.lang) p.text += (/[.!?:;,]$/.test(p.text) ? ' ' : ', ') + s.text;
          else merged.push(Object.assign({}, s));
        });
        if (who != null) merged.forEach(x => { x.who = who; });
        lines.push(...merged);
      });
      return lines;
    },

    /* ---------- speed: slow / normal / fast ---------- */
    // 0.6 vs 0.9 was hardly audible with Safari voices — the steps are wider now
    SPEEDS: { slow: 0.5, normal: null, fast: 1.4 }, // normal = the rate from settings (default 0.9)
    currentRate() {
      const st = Store.settings;
      const v = this.SPEEDS[st.ttsSpeed || 'normal'];
      return v || st.ttsRate || 0.9;
    },
    /** change speed; if reading — say the current sentence again at the new speed */
    setSpeed(speed) {
      Store.setSetting('ttsSpeed', speed);
      const p = this.player;
      if (p && !p.paused && p.utterPending && 'speechSynthesis' in window) { p.restart = true; speechSynthesis.cancel(); }
      document.dispatchEvent(new CustomEvent('tts-speed', { detail: speed }));
    },

    /* ---------- player state ---------- */
    state() { return !this.player ? 'idle' : this.player.paused ? 'paused' : 'playing'; },
    emit() {
      if (this.msOwner === 'tts' && hasMS()) try { navigator.mediaSession.playbackState = this.state() === 'idle' ? 'none' : this.state(); } catch (e) { /* ignore */ }
      document.dispatchEvent(new CustomEvent('tts-state', { detail: { state: this.state(), player: this.player } }));
    },

    /* ---------- Media Session for the reader: lock screen, macOS media keys / Control Center ---------- */
    msClaim(text) {
      if (!hasMS()) return;
      const ms = navigator.mediaSession;
      const set = (a, f) => { try { ms.setActionHandler(a, f); } catch (e) { /* not supported */ } };
      this.msOwner = 'tts';
      set('play', () => this.resume()); set('pause', () => this.pause()); set('stop', () => this.stop());
      set('previoustrack', () => this.restart());
      ['nexttrack', 'seekto', 'seekbackward', 'seekforward'].forEach(a => set(a, null));
      try {
        ms.metadata = new MediaMetadata({ title: String(text || '').replace(/\s+/g, ' ').trim().slice(0, 90) || 'Чтение', artist: 'Norsk Kort · чтение вслух',
          artwork: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
      } catch (e) { /* old browser */ }
    },
    msRelease() {
      if (this.msOwner !== 'tts') return;
      this.msOwner = '';
      if (hasMS()) {
        const ms = navigator.mediaSession;
        ['play', 'pause', 'stop', 'previoustrack', 'nexttrack', 'seekto', 'seekbackward', 'seekforward'].forEach(a => { try { ms.setActionHandler(a, null); } catch (e) { /* ignore */ } });
        try { ms.metadata = null; ms.playbackState = 'none'; } catch (e) { /* ignore */ }
      }
      // the 🎧 player was paused for this reading: its buttons come back to the lock screen
      if (window.Listen && Listen.p) Listen.claimSession();
    },
    /** a looping silent clip while speechSynthesis talks: speech alone does not make the tab a media player on macOS */
    keepAlive(on) {
      if (IOS) return; // iPhone: one audio at a time — a second element could interrupt the voice; the lock screen is Listen's job
      try {
        if (!on) { if (this._keep) { this._keep.pause(); this._keep.removeAttribute('src'); this._keep = null; } return; }
        const a = this._keep || (this._keep = new Audio());
        a.loop = true; a.setAttribute('playsinline', '');
        if (!a.getAttribute('src')) a.src = silence(10000); // ≥ 5 s: shorter media get no media controls in Chrome
        a.play().catch(() => {});
      } catch (e) { /* ignore */ }
    },

    /** 📍 where it is said: opts.place (alias opts.ctx) as given, else read from the screen now (the tap's window) —
     *  each place may have its own voice (🔊 Голоса → «Где какой голос»); place '' = the voice «как везде» */
    placed(opts) {
      opts = opts || {};
      if (opts.place != null || opts.voiceId || !window.Voices || !Voices.place) return opts;
      if (opts.ctx != null) return Object.assign({}, opts, { place: opts.ctx });
      let place = '';
      try { place = Voices.place(); } catch (e) { place = ''; }
      return Object.assign({}, opts, { place }); // fixed now: a long text keeps the voice of where it began
    },

    /** read a whole text: each piece with its own voice (Norwegian / Russian); opts.place: see placed() */
    async speakText(text, mode = 'all', opts = {}) {
      opts = this.placed(opts);
      const segs = this.segments(text, mode);
      // one voice at a time: the 🎧 player pauses (it can be continued from its bar)
      if (window.Listen && Listen.p && Listen.p.playing) Listen.pause();
      this.stop();
      if (!segs.length) { UI.toast(mode === 'ru' ? 'Здесь нет перевода' : mode === 'no' ? 'Здесь нет норвежского текста' : 'Нечего читать', '', 1800); return; }
      this.last = { text, mode, opts };
      // 🎭 a dialogue: every speaker with a voice of their own (opts.roleWho / roleRoster: a reading continued from the
      // middle keeps the speakers of the whole text)
      if (Array.isArray(opts.roleWho) && opts.roleWho.length === segs.length) segs.forEach((s, k) => { if (opts.roleWho[k] != null) s.who = opts.roleWho[k]; else delete s.who; });
      const roster = Array.isArray(opts.roleRoster) ? opts.roleRoster.slice() : [];
      segs.forEach(s => { if (s.who != null && !roster.includes(s.who)) roster.push(s.who); });
      const p = this.player = { segs, i: 0, paused: false, opts, mode, pausedTotal: 0, roster };
      this.msClaim(segs[0].text);
      this.keepAlive(true);
      this.emit();
      await this._run(p);
    },
    async _run(p) {
      while (p.i < p.segs.length) {
        if (p !== this.player || p.paused) return;
        const s = p.segs[p.i];
        p.restart = false;
        await this._utter(s.text, s.lang, this.roleOpts(p, s), p);
        if (p !== this.player) return;
        if (p.restart) continue;      // resume fallback: say the same piece again
        if (p.paused) return;         // resume() will call _run again
        p.i++;
        this.emit();
      }
      if (p === this.player) { this.player = null; this.keepAlive(false); this.msRelease(); this.emit(); }
    },
    /** the options of one piece: a dialogue speaker's own voice (js/voices.js Voices.roleOpts), else the reading's */
    roleOpts(p, s) {
      if (!s || s.who == null || !window.Voices || !Voices.speakerOpts) return p.opts;
      try {
        const r = Voices.speakerOpts(s.lang, s.who, p.roster || (p.roster = []), p.opts.place);
        return r.voiceId || r.pitch ? Object.assign({}, p.opts, r) : p.opts;
      } catch (e) { return p.opts; }
    },
    /** ⏸ pause — keeps the exact position */
    pause() {
      const p = this.player;
      if (!p) { if (hasSynth() && speechSynthesis.speaking) speechSynthesis.pause(); return; }
      if (p.paused) return;
      p.paused = true;
      p.pausedAt = Date.now();
      if (this._keep) this._keep.pause();
      if (this._audio) this._audio.pause();
      else if (hasSynth()) speechSynthesis.pause();
      this.emit();
    },
    /** ▶ continue from the same place */
    resume() {
      const p = this.player;
      if (!p) { if (hasSynth() && speechSynthesis.paused) speechSynthesis.resume(); return; }
      if (!p.paused) return;
      p.paused = false;
      p.pausedTotal += Date.now() - (p.pausedAt || Date.now());
      if (window.Listen && Listen.p && Listen.p.playing) Listen.pause();
      if (this.msOwner !== 'tts') this.msClaim((p.segs[p.i] || p.segs[0]).text);
      this.keepAlive(true);
      if (p.utterPending) {
        if (this._audio) this._audio.play().catch(() => {});
        else if (hasSynth()) {
          speechSynthesis.resume();
          // some browsers (Chrome/Android) do not really resume — then repeat the current sentence
          setTimeout(() => {
            if (p === this.player && !p.paused && p.utterPending && (!speechSynthesis.speaking || speechSynthesis.paused)) {
              p.restart = true; speechSynthesis.cancel();
            }
          }, 450);
        }
      } else this._run(p);
      this.emit();
    },
    toggle() { if (this.state() === 'playing') this.pause(); else if (this.state() === 'paused') this.resume(); else this.restart(); },
    /** ⏮ read again from the beginning */
    restart() {
      if (!this.last) return;
      const { text, mode, opts } = this.last;
      this.speakText(text, mode, opts);
    },
    /** ⏹ stop completely */
    stop() {
      const had = !!this.player;
      this.player = null;
      this._gen = (this._gen || 0) + 1; // a long piece said in parts stops after the current part
      this.keepAlive(false);
      this.msRelease();
      try { if (hasSynth()) { speechSynthesis.cancel(); if (speechSynthesis.paused) speechSynthesis.resume(); } } catch (e) { /* ignore */ }
      if (this._audio) { this._audio.pause(); this._audio = null; }
      if (had) this.emit();
    },

    /** one-off: speak a short text (used for auto-pronunciation); stops the player. opts.place: see placed() */
    speak(text, lang, opts = {}) {
      opts = this.placed(opts);
      if (!opts.keep) this.stop();
      return this._utter(text, lang, opts, null);
    },

    /** speak one piece; resolves when finished (pause-aware safety timer) */
    _utter(text, lang, opts = {}, p) {
      // 🎤 word timing for the caller (opts.onWord); a fallback inside keeps the same clock (opts._wc)
      let wc = opts._wc || null;
      if (!wc && typeof opts.onWord === 'function') { try { wc = new WordClock(text, opts.onWord); } catch (e) { wc = null; } }
      const g0 = this._gen;
      const natural = () => g0 === this._gen && (!p || (p === this.player && !p.restart));
      const pr = this._utter1(text, lang, opts, p, wc);
      if (!wc || opts._wc) return pr; // the outer call ends the clock
      return pr.then(v => { wc.end(natural()); return v; }, e => { wc.end(false); throw e; });
    },
    /** the text and language really said (clean-up, Russian / Ukrainian told apart, 🐢 word by word) — the same for
     *  speaking and for making the clip ahead of time (prefetch), so a clip made early is found by the voice */
    prep(text, lang, opts = {}) {
      text = this.clean(text);
      if (!text) return { text: '', lang };
      // a Ukrainian text is never said by a Russian voice (and the other way round), whoever asked
      if (!LANG[lang]) lang = /[Ѐ-ӿ]/.test(text) ? cyrLang(text, 'ru') : 'no';
      else if (lang === 'ru' || lang === 'uk') lang = cyrLang(text, lang);
      // 🐢 slow = word by word: a short pause after every Norwegian word (clearly different from "normal")
      if (!opts.rate && Store.settings.ttsSpeed === 'slow' && lang === 'no' && text.split(/\s+/).length <= 14) {
        text = text.replace(/([^\s,.!?;:])\s+/g, '$1, ').replace(/(^|\s)(å|en|ei|et), /gi, '$1$2 '); // "å spise", "en bil" stay together
      }
      return { text, lang };
    },
    /**
     * ⏩ make the NEXT phrase's audio while this one is said (cloud voices: Edge / Azure / Google Cloud / ElevenLabs /
     * Piper): when its turn comes the clip is already there — no wait between phrases. The voice that will say it
     * (the place's first voice) makes it; system voices need nothing (they queue at once). Never throws, never plays.
     */
    prefetch(text, lang, opts = {}) {
      try {
        opts = this.placed(opts);
        if (opts.local || opts.forceBrowser || !window.Voices || !Voices.chain || !Voices.clip) return;
        const r = this.prep(text, lang, opts);
        if (!r.text) return;
        const place = opts.voiceId ? '' : opts.place != null ? opts.place : opts.ctx != null ? opts.ctx : '';
        const id = (Voices.chain(r.lang, opts.voiceId || '', place) || [])[0];
        if (!id) return;
        const { engine, key, spk } = Voices.parse(id);
        if (!/^(piper|edge|azure|gcloud|eleven)$/.test(engine)) return; // the device / Google / Gemini: nothing to make ahead
        Voices.clip(engine, r.text, r.lang, opts.rate || this.currentRate(), key + (spk ? '#' + spk : '')).catch(() => {});
      } catch (e) { /* a hint only */ }
    },
    _utter1(text, lang, opts, p, wc) {
      ({ text, lang } = this.prep(text, lang, opts));
      if (!text) return Promise.resolve();
      if (wc) wc.spoken(text);
      const rate = opts.rate || this.currentRate();
      if (p) p.utterPending = true;
      const done = () => { if (p) p.utterPending = false; };
      // 🔊 the voice chosen for this language («Голоса»: Edge, Azure, Google Cloud, ElevenLabs, Piper, Google, the
      // device), then its fallback chain — a voice that fails or is silent for ~4 s is quietly replaced by the next one
      if (!opts.local && !opts.forceBrowser && window.Voices && Voices.speak) {
        let pr = Voices.speak(text, lang, rate, opts, p, wc);
        // a voice asked for by id (🎭 a dialogue's second speaker…) that cannot speak now: the place's own voice says it
        // instead — opts.strict (the voice chooser's ▶) wants the failure itself
        if (opts.voiceId && !opts.strict) {
          const g0 = this._gen;
          pr = pr.catch(e => {
            if (g0 !== this._gen || (p && p !== this.player) || (e && (e.name === 'AbortError' || e.name === 'NotAllowedError'))) throw e;
            try { if (Voices.roleFailed) Voices.roleFailed(opts.voiceId); } catch (x) { /* ignore */ }
            return Voices.speak(text, lang, rate, Object.assign({}, opts, { voiceId: undefined }), p, wc);
          });
        }
        return pr.then(done, e => { done(); throw e; });
      }
      const voice = this.pickVoice(lang, opts.sysVoice);
      const useBrowser = !opts.gtr && ((opts.forceBrowser && hasSynth()) || !!voice);
      // 🇺🇦 no Ukrainian voice on the device: the online Google voice (never a Russian one) + a one-time hint
      if (lang === 'uk' && !voice && !opts.gtr) {
        const online = !opts.forceBrowser && navigator.onLine !== false;
        this.ukHint(online);
        if (!online) { done(); return Promise.resolve(); }
        return this.speakGoogle(text, lang, rate, wc).then(done, done);
      }
      if (useBrowser && hasSynth()) {
        const gen = this._gen;
        const alive = () => gen === this._gen && (!p || (p === this.player && !p.restart));
        const vkey = voice ? voice.voiceURI || voice.name : 'sys:' + lang;
        const isPaused = () => !!((p && p.paused) || speechSynthesis.paused);
        const say = (part, kb) => new Promise(resolve => {
          const u = new SpeechSynthesisUtterance(part);
          u.lang = LANG[lang];
          if (voice) u.voice = voice;
          u.rate = rate;
          if (opts.pitch > 0) u.pitch = Math.max(0.5, Math.min(1.6, opts.pitch)); // 🎭 another speaker with the same voice
          if (wc) try { wc.speech(u, part, kb, rate, vkey, isPaused, alive); } catch (e) { /* no word timing: the sentence highlight stays */ }
          /* safety net (some browsers never fire onend): REAL elapsed time without pauses — a background tab
             runs timers once a second or even once a minute, so counting timer ticks would take minutes */
          const limit = 4000 + part.length * 140 / rate, t0 = Date.now(), paused0 = p ? p.pausedTotal || 0 : 0;
          let finished = false;
          const elapsed = () => Date.now() - t0 - (p ? (p.pausedTotal || 0) - paused0 + (p.paused ? Date.now() - (p.pausedAt || Date.now()) : 0) : 0);
          const tick = setInterval(() => {
            if (p && p.paused) return;
            const el = elapsed();
            // Chrome sometimes loses onend although the voice is already quiet
            if (el > limit || (el > 2500 && !speechSynthesis.speaking && !speechSynthesis.pending)) finish();
          }, 500);
          const finish = () => { if (finished) return; finished = true; clearInterval(tick); resolve(); };
          u.onend = u.onerror = finish;
          speechSynthesis.speak(u);
        });
        return (async () => {
          let kb = 0;
          for (const part of split(text)) {
            if (!alive()) break;
            await say(part, kb);
            if (wc) wc.partEnd(alive());
            kb += wordsOf(part).length;
          }
          done();
        })();
      }
      return this.speakGoogle(text, lang, rate, wc).then(done, done);
    },
    /** the free Google Translate voice: it takes ≤200 characters per request, so a longer text is read in several
     *  clips one after another (before, everything after the 200th character was silently lost) */
    async speakGoogle(text, lang, rate, wc) {
      const parts = split(text, 190), g0 = this._gen, a0 = this._audio;
      if (wc) try { wc.spoken(text); } catch (e) { /* no word timing */ }
      let kb = 0;
      for (let i = 0; i < parts.length; i++) {
        if (i && (g0 !== this._gen || (this._audio && this._audio !== a0))) break; // stopped, or something newer plays
        const n = wordsOf(parts[i]).length;
        const ok = await this._google1(parts[i], lang, rate, wc, kb, kb + n - 1, parts.slice(i).join(' '));
        kb += n;
        if (!ok) break;
      }
    },
    /** one ≤200-char clip; resolves true when it was heard (false: it failed and another voice took over) */
    _google1(text, lang, rate, wc, k0, k1, whole) {
      return new Promise(resolveP => {
        let heard = true;
        const resolve = () => resolveP(heard);
        const url = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=' + GOOGLE_TL[lang] +
          '&ttsspeed=' + (rate < 0.8 ? '0.24' : '1') + '&q=' + encodeURIComponent(text.slice(0, 200));
        const a = new Audio(url);
        a.playbackRate = Math.max(0.5, Math.min(1.5, rate / 0.9));
        this._audio = a;
        if (wc) try { wc.audio(a, rate, 'google', { k0, k1 }); } catch (e) { /* no word timing */ }
        let tick = null;
        const end = () => { clearInterval(tick); if (this._audio === a) this._audio = null; resolve(); };
        a.onended = end;
        // Safari never fires 'ended' for this stream (duration = Infinity): finished when the time stops moving
        a.onstalled = () => { if (a.currentTime > 0.3 && !isFinite(a.duration)) end(); };
        let lastT = -1, same = 0;
        tick = setInterval(() => {
          if (this._audio !== a) { clearInterval(tick); if (!failed) resolve(); return; } // stopped or replaced
          if (a.paused) { same = 0; return; }
          if (a.currentTime > 0.3 && Math.abs(a.currentTime - lastT) < 0.01) { if ((same += 300) >= 1200) end(); } else { same = 0; lastT = a.currentTime; }
        }, 300);
        let failed = false;
        a.onerror = () => {
          if (failed) return; failed = true;
          heard = false;
          clearInterval(tick);
          // last resort: browser voice with only lang set (Ukrainian: only a real Ukrainian voice — never the Russian one)
          const v = lang === 'uk' ? this.pickVoice('uk') : null;
          if (hasSynth() && (lang !== 'uk' || v)) {
            if (this._audio === a) this._audio = null;
            const say = whole || text; // this clip and the ones after it are said by this voice
            const u = new SpeechSynthesisUtterance(say); u.lang = LANG[lang] || LANG.ru; if (v) u.voice = v; u.rate = rate; u.onend = resolve; u.onerror = resolve;
            if (wc) { const g = this._gen; try { wc.speech(u, say, k0, rate, v ? v.voiceURI || v.name : 'sys:' + lang, () => speechSynthesis.paused, () => g === this._gen); } catch (e) { /* no word timing */ } }
            speechSynthesis.speak(u);
          } else { if (lang !== 'uk') UI.toast('Озвучка недоступна: нет голоса для ' + (LANG_NAME[lang] || 'русского') + ' языка', 'warn'); end(); } // 🇺🇦: the one-time hint already said why
        };
        a.play().catch(() => a.onerror());
      });
    },
    hasNorwegianVoice() { return this.voicesFor('no').length > 0; },
  };

  window.TTS = TTS;
})();
