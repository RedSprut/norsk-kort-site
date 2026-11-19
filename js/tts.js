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

  const TTS = {
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
    pickVoice(lang) {
      const st = Store.settings;
      const pref = lang === 'no' ? st.voiceNo : lang === 'uk' ? st.voiceUk : st.voiceRu;
      const list = this.voicesFor(lang);
      if (pref) { const v = list.find(v => v.name === pref); if (v) return v; }
      // prefer high-quality voices; of equal ones the voice on the device (no network, no 15-s cut-off, works in background)
      const loc = a => a.slice().sort((x, y) => (y.localService ? 1 : 0) - (x.localService ? 1 : 0));
      return loc(list.filter(v => /natural|neural|premium|enhanced|online/i.test(v.name)))[0] || loc(list.filter(v => /nb/i.test(v.lang)))[0] || loc(list)[0] || null;
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
      UI.toastAction(msg, 'Как добавить', () => UI.modal({ title: '🇺🇦 Украинский голос', body: this.ukHelpHtml() + '<div class="small muted" style="margin-top:8px">После установки перезапустите браузер, затем выберите голос: Настройки → 🔊 Озвучка → 💻 Системные голоса.</div>' }), 12000, '🇺🇦');
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
      clean.split(/\n+/).forEach(raw => {
        const line = raw.replace(/^\s*(\d{1,3}[.)]|[-–—])\s+/, '').trim();
        if (!line) return;
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

    /** read a whole text: each piece with its own voice (Norwegian / Russian) */
    async speakText(text, mode = 'all', opts = {}) {
      const segs = this.segments(text, mode);
      // one voice at a time: the 🎧 player pauses (it can be continued from its bar)
      if (window.Listen && Listen.p && Listen.p.playing) Listen.pause();
      this.stop();
      if (!segs.length) { UI.toast(mode === 'ru' ? 'Здесь нет перевода' : mode === 'no' ? 'Здесь нет норвежского текста' : 'Нечего читать', '', 1800); return; }
      this.last = { text, mode, opts };
      const p = this.player = { segs, i: 0, paused: false, opts, mode, pausedTotal: 0 };
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
        await this._utter(s.text, s.lang, p.opts, p);
        if (p !== this.player) return;
        if (p.restart) continue;      // resume fallback: say the same piece again
        if (p.paused) return;         // resume() will call _run again
        p.i++;
        this.emit();
      }
      if (p === this.player) { this.player = null; this.keepAlive(false); this.msRelease(); this.emit(); }
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

    /** one-off: speak a short text (used for auto-pronunciation); stops the player */
    speak(text, lang, opts = {}) {
      if (!opts.keep) this.stop();
      return this._utter(text, lang, opts, null);
    },

    /** speak one piece; resolves when finished (pause-aware safety timer) */
    _utter(text, lang, opts = {}, p) {
      text = this.clean(text);
      if (!text) return Promise.resolve();
      // a Ukrainian text is never said by a Russian voice (and the other way round), whoever asked
      if (!LANG[lang]) lang = /[Ѐ-ӿ]/.test(text) ? cyrLang(text, 'ru') : 'no';
      else if (lang === 'ru' || lang === 'uk') lang = cyrLang(text, lang);
      // 🐢 slow = word by word: a short pause after every Norwegian word (clearly different from "normal")
      if (!opts.rate && Store.settings.ttsSpeed === 'slow' && lang === 'no' && text.split(/\s+/).length <= 14) {
        text = text.replace(/([^\s,.!?;:])\s+/g, '$1, ').replace(/(^|\s)(å|en|ei|et), /gi, '$1$2 '); // "å spise", "en bil" stay together
      }
      const st = Store.settings;
      const rate = opts.rate || this.currentRate();
      const voice = this.pickVoice(lang);
      const eng = opts.local ? 'auto' : (st.ttsEngine || 'auto');
      const useBrowser = (opts.forceBrowser && hasSynth()) || eng === 'browser' || (eng === 'auto' && voice);
      if (p) p.utterPending = true;
      const done = () => { if (p) p.utterPending = false; };
      // better voices (Edge neural via the bridge, Azure, Google Cloud, ElevenLabs); on any problem -> system voice
      if (window.Voices && Voices.isCloud(eng)) {
        return Voices.play(eng, text, lang, rate, p).then(done, e => {
          Voices.warn(eng, e);
          if (p && p !== this.player) { done(); return; }
          return this._utter(text, lang, Object.assign({}, opts, { local: true }), p);
        });
      }
      // 🇺🇦 no Ukrainian voice on the device: the online Google voice (never a Russian one) + a one-time hint
      if (lang === 'uk' && !voice) {
        const online = !opts.forceBrowser && navigator.onLine !== false;
        this.ukHint(online);
        if (!online) { done(); return Promise.resolve(); }
        return this.speakGoogle(text, lang, rate).then(done, done);
      }
      if (useBrowser && hasSynth()) {
        const gen = this._gen;
        const alive = () => gen === this._gen && (!p || (p === this.player && !p.restart));
        const say = part => new Promise(resolve => {
          const u = new SpeechSynthesisUtterance(part);
          u.lang = LANG[lang];
          if (voice) u.voice = voice;
          u.rate = rate;
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
          for (const part of split(text)) { if (!alive()) break; await say(part); }
          done();
        })();
      }
      return this.speakGoogle(text, lang, rate).then(done, done);
    },
    speakGoogle(text, lang, rate) {
      return new Promise(resolve => {
        const url = 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=' + GOOGLE_TL[lang] +
          '&ttsspeed=' + (rate < 0.8 ? '0.24' : '1') + '&q=' + encodeURIComponent(text.slice(0, 200));
        const a = new Audio(url);
        a.playbackRate = Math.max(0.5, Math.min(1.5, rate / 0.9));
        this._audio = a;
        let tick = null;
        const end = () => { clearInterval(tick); if (this._audio === a) this._audio = null; resolve(); };
        a.onended = end;
        // Safari never fires 'ended' for this stream (duration = Infinity): finished when the time stops moving
        a.onstalled = () => { if (a.currentTime > 0.3 && !isFinite(a.duration)) end(); };
        let lastT = -1, same = 0;
        tick = setInterval(() => {
          if (this._audio !== a) { clearInterval(tick); return; }
          if (a.paused) { same = 0; return; }
          if (a.currentTime > 0.3 && Math.abs(a.currentTime - lastT) < 0.01) { if ((same += 300) >= 1200) end(); } else { same = 0; lastT = a.currentTime; }
        }, 300);
        let failed = false;
        a.onerror = () => {
          if (failed) return; failed = true;
          // last resort: browser voice with only lang set (Ukrainian: only a real Ukrainian voice — never the Russian one)
          const v = lang === 'uk' ? this.pickVoice('uk') : null;
          if (hasSynth() && (lang !== 'uk' || v)) {
            if (this._audio === a) this._audio = null;
            const u = new SpeechSynthesisUtterance(text); u.lang = LANG[lang] || LANG.ru; if (v) u.voice = v; u.rate = rate; u.onend = resolve; u.onerror = resolve;
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
