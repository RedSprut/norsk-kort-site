/* ============ Storage (IndexedDB + localStorage fallback) ============ */
(function () {
  const DB_NAME = 'norsk-kort';
  const STORE = 'kv';
  const KEY = 'state';
  const LS_KEY = 'norsk-kort-state';

  const DEFAULT_SETTINGS = {
    // Claude AI
    userName: '',              // shown in the top bar: "👤 Alex · Claude Max"
    aiProvider: 'auto',
    aiFallback: true,
    // translators shown as icons on cards / in the editor (order matters)
    translators: ['deepl', 'google', 'microsoft', 'ai', 'mymemory', 'ordbok', 'tatoeba', 'grammatikk', 'telegram', 'glosbe', 'lexin', 'naob', 'forvo'], // yandex: optional (not available everywhere)
    goalOn: true, goal: 20,    // daily goal (cards per day)
    restDays: [], vacation: null, // schedule: rest weekdays (0 = Sunday) and vacation {from, to}
    azureKey: '', azureRegion: '', gcloudKey: '', geminiKey: '', elevenKey: '', // better voices (Settings → Озвучка)
    cloudVoices: {},           // { azure: { no: 'nb-NO-FinnNeural', ru: … }, … } — chosen voice per engine
    ytKey: '',                // YouTube Data API key (free) — videos about the card's word right inside the app
    dictTranslator: 'auto',   // who translates dictionary articles: auto (DeepL if key, else Google) | ai | deepl | google | microsoft | mymemory
    deeplKey: '',            // DeepL API Free key (…:fx) — used through the Mac bridge (DeepL blocks browsers)
    msKey: '', msRegion: '',   // Microsoft Translator (Azure) free F0 key          // limit / error -> automatically ask the next connected AI        // which AI checks cards: auto | claude | anthropic | openai | deepseek | gemini | groq | ...
    aiMode: 'auto',            // auto | bridge (Claude Code subscription) | api (API key)
    bridgeModel: '',           // '' = default of the subscription, or sonnet | opus | haiku
    plan: 'Max',
    claudeKey: '',
    claudeModel: 'claude-sonnet-4-5',
    aiArticles: true,          // nouns with en/ei/et, verbs with å
    aiAutoImport: false,       // check imported cards automatically
    aiAutoSave: false,         // check every newly created card on save
    // study
    direction: 'nr',           // nr = NO→RU, rn = RU→NO, mix
    transLang: 'ru',           // translation language shown/asked: ru | uk (🇺🇦, falls back to ru when a card has none) | both
    mode: 'flip',              // flip | type | quiz | listen
    filter: 'smart',           // smart | all | new | debt | learning | learned | leech
    sessionSize: 20,
    shuffle: true,
    requeue: true,             // re-show "don't know" cards in the same session
    learnedStreak: 3,          // correct in a row => learned
    retention: 0.9,
    fsrsW: null,               // 🧠 the owner's own FSRS-6 weights (21 numbers), fitted automatically — null = the average weights
    fsrsOpt: null,             // when / on how many answers they were fitted and how much better they predict (js/fsrs-opt.js)
    fourButtons: false,
    newPerDay: 20,
    leechLapses: 6,
    fuzz: true,
    imageSide: 'back',         // front | back | both | none
    studyLayout: 'auto',
    hints: true,               // front-side hints (picture, word class, icons); off = only the word
    // gestures (phones, tablets, mouse, MacBook trackpad)
    swipeMode: 'lr',           // lr | lr-rev | ud | four | flip-first | off
    swipeStyle: 'tinder',      // tinder | slide | flick3d | fade | stack | bounce
    swipeSensitivity: 'medium',// low | medium | high
    longPressAction: 'speak',  // speak | flip | edit | explain | none
    doubleTapAction: 'none',   // none | know | speak | edit
    trackpadSwipe: true,       // where the study buttons go: auto | sides | left | right | bottom
    typeTolerance: true,
    // speech
    ttsEngine: 'auto',         // before «🔊 Голоса» (one engine for all languages): read once to fill `voices`
    voices: null,              // { no|uk|ru: { pick: 'engine:voice' | '' (Авто), chain: 'auto' | [ids] }, _v: 1 } — js/voices.js
    voicesBy: {},              // 📍 a voice per place: { reader: { no: 'piper:…', ru: 'edge:…' }, video: {…} } — no entry = «как везде»
    voiceNo: '',
    voiceRu: '',
    voiceUk: '',
    ttsRate: 0.9,              // "normal" speed
    ttsSpeed: 'normal',        // slow | normal | fast (quick switch in the study screen)
    autoSpeak: true,
    readMode: 'all',           // read button: all | no (only Norwegian) | ru (only Russian)
    // images
    imageProvider: 'pollinations', // pollinations (AI → photo → emoji) | wikimedia (photo → emoji) | emoji | off
    pollinationsToken: '',     // free token from enter.pollinations.ai removes the 1-image-per-45s limit
    imageStyle: 'illustration',
    imageTemplate: 'https://image.pollinations.ai/prompt/{prompt}?width=640&height=480&seed={seed}&model=flux&nologo=true&enhance=true',
    autoImages: true,
    // ui
    theme: 'dark',
    highlightRu: true,         // Russian text in light blue, Norwegian in white
    // 🎨 «Художественный вид» (js/artcards.js): Pinterest-like art cards — gallery of a deck + study in art style
    artMode: false,            // global default for decks without their own choice (deck.art: 'on' | 'off')
    art: null,                 // look: { theme, font, weight, italic, size, track, width, text, accent, fx, grade } — null = defaults (Safe.art)
    artMotion: 'auto',         // auto = follow the device's «reduce motion»; on = animate in the art mode anyway
    artMotionNote: false,      // the one-time «Анимация отключена в настройках вашего устройства» notice was shown
    artSeasonHints: true,      // gently suggest a seasonal template when its date approaches
    artSeasonSeen: {},         // { 'jul-2026': 1 } — hints dismissed / taken (one time per season)
    deckSort: 'recent',        // 🕘 deck lists (sidebar, home): recent = the deck in work first · created = as made · abc (📌 pinned always on top)
  };

  /* ---------- 🛡 nothing harmful gets in: every card / deck from ANY source (shared deck, file, Anki, backup, cloud)
   * passes here — HTML and scripts are cut out of the text, only real pictures / sounds are kept (no SVG, no
   * javascript: links), sizes are limited. A shared deck can carry words, never code. ---------- */
  const TXT_MAX = 20000;
  const Safe = {
    text(s, max = TXT_MAX) {
      if (s == null) return '';
      if (typeof s !== 'string') s = String(s);
      return s
        .replace(/<\s*(script|style|iframe|object|embed|svg|math|template|noscript|form|link|meta|base)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
        .replace(/<\/?[a-z][^>]*>/gi, '')                        // any other tag: its text stays, the tag goes
        .replace(/\bjavascript\s*:/gi, '').replace(/\bvbscript\s*:/gi, '').replace(/\bdata\s*:\s*text\/html/gi, '')
        // onerror= / onclick= leftovers — only real event names (plain text like « one = two» stays)
        .replace(/\son(error|load|click|dblclick|mouse\w*|pointer\w*|touch\w*|key\w*|focus\w*|blur|submit|change|input|animation\w*|transition\w*|begin|end|toggle|wheel|scroll|drag\w*|drop|copy|paste|play\w*|pause|message)\s*=/gi, ' ')
        .slice(0, max);
    },
    /** a picture: a real image file (no SVG — it can hide a script) or an https link */
    image(u) {
      u = String(u || '').trim();
      if (!u) return '';
      if (/^data:image\/(png|jpe?g|gif|webp|avif|bmp);base64,[a-z0-9+/=\s]+$/i.test(u)) return u.length < 8e6 ? u : '';
      if (/^https:\/\/[^\s"'<>]+$/i.test(u) && !/\.svg(\?|#|$)/i.test(u)) return u.slice(0, 2000);
      if (/^blob:/i.test(u)) return '';
      return '';
    },
    audio(u) { u = String(u || '').trim(); return /^data:audio\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(u) && u.length < 6e6 ? u : ''; },
    /** FSRS weights from a backup / the cloud: exactly 21 numbers inside the FSRS bounds, else null (→ the average weights) */
    weights(w) {
      if (!Array.isArray(w) || w.length !== 21) return null;
      const out = w.map(Number);
      return window.FSRS && FSRS.valid(out) ? out : null;
    },
    /** the answer log from a backup: {ts, c, d, g, n} only (time, card id, direction, grade 1–4, first answer), the newest 50 000 */
    log(arr) {
      return (Array.isArray(arr) ? arr : []).filter(l => l && typeof l === 'object' && typeof l.ts === 'number' && Number.isFinite(l.ts)
        && [1, 2, 3, 4].includes(l.g)).slice(-50000)
        .map(l => { const e = { ts: l.ts, c: String(l.c == null ? '' : l.c).slice(0, 80), d: String(l.d == null ? '' : l.d).slice(0, 8), g: l.g }; if (l.n) e.n = 1; return e; });
    },
    /** the optimiser's notes: only plain numbers / short words survive */
    fsrsMeta(m) {
      if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
      const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
      const met = x => (x && typeof x === 'object' ? { ll: num(x.ll), rmse: num(x.rmse), n: num(x.n) } : undefined);
      const out = {};
      ['at', 'n', 'held', 'adoptedAt', 'adoptN', 'resetAt', 'errAt', 'prev'].forEach(k => { if (num(m[k]) !== undefined) out[k] = num(m[k]); });
      ['def', 'cand', 'cur', 'base'].forEach(k => { if (met(m[k])) out[k] = met(m[k]); });
      if (/^(adopt|kept|revert|reset)$/.test(m.status)) out.status = m.status;
      if (m.err) out.err = Safe.text(m.err, 200);
      return out;
    },
    /** 🎨 art-mode look: only known keys, numbers in range, colours as #rrggbb, names from a short list — never code */
    art(a) {
      a = a && typeof a === 'object' && !Array.isArray(a) ? a : {};
      const id = (v, d) => (typeof v === 'string' && /^[a-z0-9_-]{1,24}$/.test(v) ? v : d);
      const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d; };
      const col = v => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : '');
      return {
        theme: id(a.theme, 'fjord'), font: id(a.font, 'theme'), weight: num(a.weight, 300, 900, 800), italic: a.italic === true,
        size: num(a.size, 70, 150, 100), track: num(a.track, -6, 24, 0), width: num(a.width, 80, 120, 100),
        text: col(a.text), accent: col(a.accent), fx: /^(none|shadow|outline|glow)$/.test(a.fx) ? a.fx : 'shadow', grade: a.grade !== false,
      };
    },
    /**
     * 🎨 per-card design from the art-card editor (card.artDesign). Every value has a default: only the changed ones
     * are kept (a compact object, or null when nothing differs). Whitelisted keys, clamped numbers, #rrggbb colours,
     * short ids — never code. x / y / tx / ty: position in % of the card; rot: degrees; size: % (0 = as in the look).
     */
    artDesignDefaults: {
      theme: '', font: '', text: '', accent: '', fx: '', size: 0,
      pos: false, x: 0, y: 100, rot: 0, trSep: false, tx: 50, ty: 10, bd: '',
      blur: 0, bright: 100, contrast: 100, sat: 100, vig: 0, grain: 0, sepia: 0, gray: 0,
      zoom: 100, ox: 50, oy: 50,
    },
    artDesign(a) {
      if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
      const D = Safe.artDesignDefaults;
      const id = v => (typeof v === 'string' && /^[a-z0-9_-]{1,24}$/.test(v) ? v : '');
      const num = (v, lo, hi, d, dec = 0) => { v = Number(v); if (!Number.isFinite(v)) return d; const k = Math.pow(10, dec); return Math.min(hi, Math.max(lo, Math.round(v * k) / k)); };
      const col = v => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : '');
      const size = num(a.size, 0, 220, 0);
      const o = {
        theme: id(a.theme), font: id(a.font), text: col(a.text), accent: col(a.accent), fx: /^(none|shadow|outline|glow)$/.test(a.fx) ? a.fx : '',
        size: size && size < 50 ? 50 : size,
        pos: a.pos === true, x: num(a.x, 0, 100, D.x, 1), y: num(a.y, 0, 100, D.y, 1), rot: num(a.rot, -30, 30, 0),
        trSep: a.trSep === true, tx: num(a.tx, 0, 100, D.tx, 1), ty: num(a.ty, 0, 100, D.ty, 1),
        bd: /^(none|ribbon|plaque|shadow)$/.test(a.bd) ? a.bd : '',
        blur: num(a.blur, 0, 20, 0), bright: num(a.bright, 40, 160, 100), contrast: num(a.contrast, 50, 160, 100), sat: num(a.sat, 0, 200, 100),
        vig: num(a.vig, 0, 100, 0), grain: num(a.grain, 0, 100, 0), sepia: num(a.sepia, 0, 100, 0), gray: num(a.gray, 0, 100, 0),
        zoom: num(a.zoom, 100, 300, 100), ox: num(a.ox, 0, 100, 50, 1), oy: num(a.oy, 0, 100, 50, 1),
      };
      if (!o.pos) { o.trSep = false; o.x = D.x; o.y = D.y; }
      if (!o.trSep) { o.tx = D.tx; o.ty = D.ty; }
      const out = {};
      Object.keys(o).forEach(k => { if (o[k] !== D[k]) out[k] = o[k]; });
      return Object.keys(out).length ? Object.assign({ v: 1 }, out) : null;
    },
    /** 🎨 one-time hints: { 'jul-2026': 1 } with short keys only */
    flags(o) {
      const out = {};
      if (o && typeof o === 'object' && !Array.isArray(o)) Object.keys(o).slice(0, 60).forEach(k => { if (/^[a-z0-9_-]{1,32}$/i.test(k)) out[k] = 1; });
      return out;
    },
    list(arr, fields) {
      return (Array.isArray(arr) ? arr : []).slice(0, 300).filter(x => x && typeof x === 'object').map(x => {
        const o = {}; fields.forEach(f => { if (x[f] != null) o[f] = Safe.text(x[f], 2000); }); return o;
      });
    },
    /** ✓ «проверено нейросетью» marks of a card (js/aihub.js): { by, front: ts, back: ts, byFront, byBack, fixed: { field: { o, n } } } — or null
     *  (byFront / byBack: the AI that checked that side; older cards have only `by` = the last AI; fixed with an empty o = «добавлено») */
    aiCheck(x) {
      if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
      const id = v => String(v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
      const by = id(x.by);
      const ts = v => (typeof v === 'number' && Number.isFinite(v) && v > 1e12 && v < 4e12 ? Math.round(v) : 0);
      const front = ts(x.front), back = ts(x.back);
      if (!by || (!front && !back)) return null;
      const out = { by };
      if (front) { out.front = front; if (id(x.byFront)) out.byFront = id(x.byFront); }
      if (back) { out.back = back; if (id(x.byBack)) out.byBack = id(x.byBack); }
      if (x.fixed && typeof x.fixed === 'object' && !Array.isArray(x.fixed)) {
        const fx = {};
        AI_FACE.front.concat(AI_FACE.back).forEach(k => { const v = x.fixed[k]; if (v && typeof v === 'object') fx[k] = { o: Safe.text(v.o, 300), n: Safe.text(v.n, 300) }; });
        if (Object.keys(fx).length) out.fixed = fx;
      }
      return out;
    },
  };
  /** which card fields make each side of the «проверено нейросетью» mark: editing one of them takes that side's mark away */
  const AI_FACE = { front: ['no', 'example'], back: ['ru', 'uk', 'exampleRu', 'description'] };
  /** a side's text as it is stored (Safe.text, line breaks of any system, no edge spaces): what «changed» is compared on */
  const faceText = v => Safe.text(v == null ? '' : v).replace(/\r\n?/g, '\n').trim();

  /* ---------- 🔐 the keys (translators, neural networks, YouTube, voices…) are stored ENCRYPTED ----------
   * AES-GCM 256 with a key the browser makes NON-EXTRACTABLE (it can encrypt / decrypt here, but nobody — not even the
   * app — can read or copy the key itself). It lives only in this browser on this device. A copy of the saved data
   * (disk, sync, a backup, another program reading the browser's storage) holds only unreadable ciphertext. */
  const b64 = u8 => { let s = ''; u8.forEach(b => { s += String.fromCharCode(b); }); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), ch => ch.charCodeAt(0));
  const Vault = {
    key: null, memo: new Map(),
    ok() { return !!(window.crypto && crypto.subtle && window.isSecureContext); },
    /** one key creation at a time: two saves at once (pagehide + visibilitychange) must not make two different keys */
    getKey() {
      if (this.key) return Promise.resolve(this.key);
      return this._kp || (this._kp = this._getKey().finally(() => { this._kp = null; }));
    },
    async _getKey() {
      if (!this.ok()) return null;
      let k = null;
      try { k = await Store.idbGet('vault-key'); } catch (e) { /* no IndexedDB */ }
      if (!k) {
        k = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        try { await Store.idbSet('vault-key', k); } catch (e) { return null; } // nowhere to keep it → keys stay as they are
      }
      return (this.key = k);
    },
    async seal(s) {
      if (!s || typeof s !== 'string') return s;
      if (this.memo.has(s)) return this.memo.get(s);
      const k = await this.getKey(); if (!k) return s;
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(s)));
      const box = { __enc: 1, iv: b64(iv), ct: b64(ct) };
      this.memo.set(s, box);
      return box;
    },
    async open(v) {
      if (!v || typeof v !== 'object' || !v.__enc) return v;
      const k = await this.getKey(); if (!k) return '';
      try { const s = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(v.iv) }, k, unb64(v.ct))); this.memo.set(s, v); return s; }
      catch (e) { return ''; } // another browser / the key was cleared: the key has to be entered again
    },
  };

  const Store = {
    state: null,
    _db: null,
    DEFAULT_SETTINGS,
    Safe, AI_FACE, faceText,
    Vault,
    /** settings as saved: every secret sealed */
    async sealSettings(s) {
      const out = Object.assign({}, s);
      for (const k of this.SECRET_KEYS) if (out[k]) out[k] = await Vault.seal(out[k]);
      if (out.aiCfg && typeof out.aiCfg === 'object') {
        const cfg = {};
        for (const [id, c] of Object.entries(out.aiCfg)) cfg[id] = c && c.key ? Object.assign({}, c, { key: await Vault.seal(c.key) }) : c;
        out.aiCfg = cfg;
      }
      return out;
    },
    async openSettings(s) {
      if (!s) return s;
      for (const k of this.SECRET_KEYS) if (s[k] && typeof s[k] === 'object') s[k] = await Vault.open(s[k]);
      for (const c of Object.values(s.aiCfg || {})) if (c && c.key && typeof c.key === 'object') c.key = await Vault.open(c.key);
      return s;
    },
    /** clean a card in place (text without HTML / scripts, only safe pictures and sounds) */
    sanitizeCard(c) {
      ['no', 'ru', 'uk', 'en', 'description', 'example', 'exampleRu', 'wordClass', 'imagePrompt', 'audioText', 'imageCredit', 'imageSrc', 'imageNone'].forEach(k => { if (c[k] != null) c[k] = Safe.text(c[k]); });
      if (c.imageCreditUrl != null) c.imageCreditUrl = /^https:\/\//i.test(String(c.imageCreditUrl)) ? Safe.text(c.imageCreditUrl, 500) : '';
      if (c.image) c.image = Safe.image(c.image);
      if (c.audio) c.audio = Safe.audio(c.audio);
      // 🎨 the art-card editor's design of this card (js/artcards.js): only safe values, nothing when all default
      if (c.artDesign !== undefined) { const z = Safe.artDesign(c.artDesign); if (z) c.artDesign = z; else delete c.artDesign; }
      // ✓ the AI's «проверено» marks (front = Norwegian side, back = translation side)
      if (c.aiCheck !== undefined) { const z = Safe.aiCheck(c.aiCheck); if (z) c.aiCheck = z; else delete c.aiCheck; }
      c.forms = Safe.list(c.forms, ['label', 'tag', 'note', 'no', 'ru', 'uk', 'trBy', 'trByUk', 'name']); // tag: AI.FORM_TAGS key (presens, preteritum…)
      c.examples = Safe.list(c.examples, ['label', 'no', 'ru', 'note', 'name']);
      c.synonyms = Safe.list(c.synonyms, ['no', 'ru', 'note']);
      if (Array.isArray(c.tags)) c.tags = c.tags.slice(0, 40).map(t => Safe.text(t, 60)).filter(Boolean);
      if (Array.isArray(c.history)) c.history = c.history.slice(-200).filter(h => h && typeof h === 'object').map(h => Object.assign({}, h, { by: Safe.text(h.by, 60), a: Safe.text(h.a, 30), n: h.n != null ? Safe.text(h.n, 400) : undefined }));
      Object.keys(c).forEach(k => { if (typeof c[k] === 'function') delete c[k]; });
      return c;
    },
    /** 🔊 voices from any source (backup, cloud, old version) → only safe values; 📍 voicesBy: known places, voice ids only */
    sanitizeVoices(s) {
      if (!s) return s;
      const PLACES = ['cards', 'reader', 'listen', 'dialogs', 'video', 'news', 'interpreter', 'speech', 'telegram'];
      const ALIAS = { study: 'cards', books: 'reader', dialogues: 'dialogs', subs: 'video', youtube: 'video', radio: 'news', translator: 'interpreter', pronunciation: 'speech', tg: 'telegram' };
      const ok = v => typeof v === 'string' && v.length <= 300 && /^(sys|native|piper|edge|azure|gcloud|eleven|gtr|gemini):[^<>"`]*$/.test(v);
      const src = s.voicesBy && typeof s.voicesBy === 'object' && !Array.isArray(s.voicesBy) ? s.voicesBy : {};
      const out = {};
      Object.keys(src).forEach(k => {
        const place = PLACES.includes(k) ? k : ALIAS[k];
        const e = src[k];
        if (!place || !e || typeof e !== 'object' || Array.isArray(e)) return;
        ['no', 'uk', 'ru'].forEach(l => {
          let v = e[l];
          if (v && typeof v === 'object') v = v.pick; // { pick } as in `voices`
          if (ok(v) && !(out[place] && out[place][l])) (out[place] = out[place] || {})[l] = v;
        });
      });
      s.voicesBy = out;
      if (s.voices != null && (typeof s.voices !== 'object' || Array.isArray(s.voices))) s.voices = null; // migrated again from the old settings
      return s;
    },
    /** 🎨 art-mode settings from any source (backup, cloud, old version) → only safe values */
    sanitizeArt(s) {
      if (!s) return s;
      s.artMode = s.artMode === true;
      s.art = Safe.art(s.art);
      s.artMotion = s.artMotion === 'on' ? 'on' : 'auto';
      s.artMotionNote = s.artMotionNote === true;
      s.artSeasonHints = s.artSeasonHints !== false;
      s.artSeasonSeen = Safe.flags(s.artSeasonSeen);
      return s;
    },
    sanitizeDeck(d) {
      if (!d || typeof d !== 'object') return d;
      d.name = Safe.text(d.name, 200) || 'Колода';
      if (d.description != null) d.description = Safe.text(d.description, 4000);
      ['cover', 'image'].forEach(k => { if (d[k]) d[k] = Safe.image(d[k]); });
      if (d.art != null && d.art !== 'on' && d.art !== 'off') delete d.art; // 🎨 art view of this deck: on | off | (global default)
      // 🕘 lastUsed: when the deck was last in work · 📌 pinned: when it was pinned on top — both ms timestamps (never in the far future)
      ['lastUsed', 'pinned'].forEach(k => { if (d[k] == null) return; const n = Number(d[k]); if (Number.isFinite(n) && n > 0) d[k] = Math.min(Math.round(n), Date.now() + 864e5); else delete d[k]; });
      // 🏷 autoName: the user gave no name — the app names the deck from its cards (v224); gone the moment the user renames it
      if (d.autoName !== true) delete d.autoName;
      if (d.autoNameWas != null) { d.autoNameWas = Safe.text(d.autoNameWas, 200); if (!d.autoNameWas) delete d.autoNameWas; }
      // 🧺 sample: the starter deck of a fresh install (☁️ js/cloudsync.js does not bring an untouched one to the other devices)
      if (d.sample !== true) delete d.sample;
      ['created', 'updated'].forEach(k => { if (d[k] != null && !Number.isFinite(Number(d[k]))) delete d[k]; });
      return d;
    },

    /* ---------- 🏷 decks without a name are named from their content (v224) ----------
     * «Новая колода» + autoName while empty; when its cards arrive: the source's own title (a file name that is not
     * IMG_1234, a Telegram chat, a book, an AI topic), else the first card's Norwegian text. A taken name gets the next
     * card's word («Håper, ønske»), else « · 2». Old names «Из файла · 18.11.2026» / «Импорт 18 нояб. 2026 г.» are renamed once. */
    AUTO_DECK: 'Новая колода',
    /** a name the app made (not the user): the placeholder or the old «<source> · dd.mm.yyyy» / «Импорт <date>» */
    isAutoName(name) {
      name = String(name || '').trim();
      if (!name || name === this.AUTO_DECK) return true;
      if (/^Импорт\s+(\d{1,2}\.\d{1,2}\.\d{4}|\d{1,2}\s+\S+\s+\d{4}(\s*г\.?)?)$/.test(name)) return true;
      const m = /^(.+) · \d{1,2}\.\d{1,2}\.\d{4}$/.exec(name);
      return !!(m && (this.OLD_SOURCE_TITLES.includes(m[1]) || (window.Create && Create.SOURCES.some(s => s.t === m[1]))));
    },
    /** source titles of earlier versions («Файл · 18.11.2026» — v184…v209) */
    OLD_SOURCE_TITLES: ['Файл', 'Фото / скан', 'Вставить текст', 'Telegram', 'Субтитры', 'Лестница уровней', 'По родам', 'Частые слова A1–B2', 'Нейросеть по теме'],
    /** the first line of a card side, plain: no markup, no edge punctuation, ≤ 40 characters on a word boundary, a capital first letter */
    cleanDeckName(s, max = 40, cap = true) {
      const edge = /^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu;
      s = String(s || '').split(/\r?\n/).map(x => x.trim()).find(Boolean) || '';
      s = s.replace(/<[^>]*>/g, ' ').replace(/[*_`~#|]+/g, '').replace(/\s+/g, ' ').replace(edge, '');
      if (s.length > max) {
        const cut = s.slice(0, max + 1), i = cut.lastIndexOf(' ');
        s = (i >= max / 3 ? cut.slice(0, i) : s.slice(0, max)).replace(edge, '') + '…';
      }
      return s && cap ? s[0].toLocaleUpperCase('nb') + s.slice(1) : s;
    },
    /** a source title worth a deck name: not a camera / scanner / screenshot name, not a bare date or number */
    deckTitleHint(h) {
      h = String(h || '').trim().replace(/\.(pdf|epub|docx?|odt|xlsx?|csv|tsv|txt|md|json|apkg|colpkg|rtf|html?|jpe?g|png|webp|heic|gif|bmp|tiff?)$/i, '');
      const JUNK = new Set(['img', 'image', 'dsc', 'dscn', 'dscf', 'pxl', 'mvimg', 'vid', 'mov', 'photo', 'foto', 'bilde', 'scan', 'scanned', 'screenshot', 'screen', 'shot', 'at',
        'скриншот', 'снимок', 'экрана', 'фото', 'изображение', 'whatsapp', 'telegram', 'file', 'файл', 'document', 'документ', 'doc', 'untitled', 'без', 'названия',
        'new', 'новый', 'новая', 'колода', 'export', 'import', 'импорт', 'backup', 'copy', 'копия', 'norsk', 'kort', 'cards', 'deck', 'am', 'pm']);
      const words = h.toLowerCase().split(/[^\p{L}]+/u).filter(w => w.length > 1 && !JUNK.has(w));
      return words.length && !/^[0-9a-f-]{16,}$/i.test(h) ? this.cleanDeckName(h, 60) : '';
    },
    /** the name for a deck from its content (see above) — '' when it has no cards with text */
    deckNameFromContent(id, hint) {
      const raw = this.cards(id).map(c => this.cleanDeckName(c.no, 1000, false) || this.cleanDeckName(c.ru, 1000, false)).filter(Boolean);
      const title = this.deckTitleHint(hint);
      if (!title && !raw.length) return '';
      const base = title || this.cleanDeckName(raw[0]), extra = title ? raw[0] : raw[1];
      const key = s => String(s).trim().toLocaleLowerCase('nb');
      const taken = new Set(this.state.decks.filter(d => d.id !== id).map(d => key(d.name)));
      if (!taken.has(key(base))) return base;
      if (extra) { const two = `${base}, ${this.cleanDeckName(extra, 24, false)}`; if (!taken.has(key(two))) return two; }
      for (let n = 2; ; n++) if (!taken.has(key(`${base} · ${n}`))) return `${base} · ${n}`;
    },
    /** name an autoName deck now (after a batch of cards, or the one-time migration) — returns the new name or null */
    autoNameDeck(id, hint) {
      clearTimeout((this._anT || {})[id]);
      const d = this.deck(id);
      if (!d || !d.autoName || !this.isAutoName(d.name)) return null;
      const name = this.deckNameFromContent(id, hint);
      if (!name) return null;
      if (d.name !== this.AUTO_DECK) d.autoNameWas = d.name; // ↩ the old automatic name is kept on the deck
      d.name = name; d.updated = Date.now();
      this.sanitizeDeck(d); this.save();
      return name;
    },
    /** one-time: decks still called «Из файла · 18.11.2026» / «Импорт 18 нояб. 2026 г.» — never renamed by the user */
    migrateAutoNames(st) {
      if (st.autoNameV1) return;
      const n = { renamed: 0 };
      st.decks.forEach(d => {
        if (d.name === this.AUTO_DECK || !this.isAutoName(d.name)) return;
        d.autoName = true;
        if (this.autoNameDeck(d.id)) n.renamed++;
      });
      st.autoNameV1 = true;
      return n;
    },

    async openDB() {
      if (this._db) return this._db;
      this._db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return this._db;
    },
    async idbGet(key) {
      const db = await this.openDB();
      return new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readonly');
        const r = tx.objectStore(STORE).get(key);
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
    },
    async idbSet(key, val) {
      const db = await this.openDB();
      return new Promise((res, rej) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(val, key);
        tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
      });
    },

    async load() {
      let st = null, ls = null;
      try { st = await this.idbGet(KEY); } catch (e) { console.warn('IndexedDB недоступна', e); }
      try { ls = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) { /* ignore */ }
      // the localStorage copy exists only when saving to IndexedDB failed — if it is newer, it holds the latest changes
      if (!st || (ls && (ls.savedAt || 0) > (st.savedAt || 0))) st = ls || st;
      if (!st) st = { version: 2, decks: [], cards: [], log: [], settings: {}, created: Date.now() };
      try { await this.openSettings(st.settings); } catch (e) { /* unreadable secrets → empty, the user enters them again */ }
      st.settings = Object.assign({}, DEFAULT_SETTINGS, st.settings || {});
      st.settings.fsrsW = Safe.weights(st.settings.fsrsW); st.settings.fsrsOpt = Safe.fsrsMeta(st.settings.fsrsOpt); this.sanitizeArt(st.settings); this.sanitizeVoices(st.settings);
      // upgrade the old image generator template (flux + prompt enhancement draw the meaning much better)
      if (/pollinations\.ai\/prompt\/\{prompt\}\?width=512&height=512&seed=\{seed\}&nologo=true$/.test(st.settings.imageTemplate || '')) {
        st.settings.imageTemplate = DEFAULT_SETTINGS.imageTemplate;
      }
      st.decks = st.decks || []; st.cards = st.cards || []; st.log = st.log || [];
      st.decks.forEach(d => this.sanitizeDeck(d));
      st.cards.forEach(c => this.migrateCard(c));
      st.trash = st.trash || [];
      // one-time fix: auto pictures from the old photo search (e.g. "car" -> Carina nebula) are redrawn
      // with the new method (Wikipedia article photo / emoji). Pictures you uploaded yourself are kept.
      // new open sources (Tatoeba examples, LEXIN, Forvo) appear for people who already saved their translator list
      if (!st.srcV2 && Array.isArray(st.settings.translators)) {
        ['tatoeba', 'lexin', 'forvo'].forEach(id => { if (!st.settings.translators.includes(id)) st.settings.translators.push(id); });
        st.srcV2 = true;
      }
      // Telegram source (posts, videos, picture-cards) appears for people who already saved their list
      if (!st.srcV3 && Array.isArray(st.settings.translators)) {
        if (!st.settings.translators.includes('telegram')) st.settings.translators.push('telegram');
        st.srcV3 = true;
      }
      // 📐 grammar (grammatikk.com) appears for people who already saved their list
      if (!st.srcV4 && Array.isArray(st.settings.translators)) {
        if (!st.settings.translators.includes('grammatikk')) st.settings.translators.splice(Math.max(0, st.settings.translators.indexOf('tatoeba') + 1), 0, 'grammatikk');
        st.srcV4 = true;
      }
      // cards from older versions had no origin record — the badge on the card was missing.
      // They came from imports (files, other apps, backups): mark them so their origin is visible.
      if (!st.provV1) {
        const deckDesc = {};
        st.decks.forEach(d => { deckDesc[d.id] = d; });
        st.cards.forEach(c => {
          if (Array.isArray(c.history) && c.history.length) return;
          const d = deckDesc[c.deckId];
          const m = d && /Импорт из (.+)/.exec(d.description || '');
          c.history = [{ t: c.created || Date.now(), by: 'import', a: 'import',
            n: `${m ? 'файл «' + m[1].trim() + '»' : 'колода «' + (d ? d.name : '—') + '»'} · загружено в старой версии приложения — подробности импорта тогда не записывались` }];
        });
        st.provV1 = true;
      }
      if (!st.imgFixV2) {
        st.cards.forEach(c => { if (c.imageAuto || /wikimedia\.org|pollinations\.ai/.test(c.image || '')) { c.image = ''; c.imageAuto = false; } });
        st.imgFixV2 = true;
      }
      this.state = st;
      this.purgeTrash();
      try { this.migrateAutoNames(st); } catch (e) { console.warn('autoName', e); }
      return st;
    },
    migrateCard(c) {
      c.tags = Array.isArray(c.tags) ? c.tags : (c.tags ? String(c.tags).split(/[\s,]+/).filter(Boolean) : []);
      c.srs = c.srs || {};
      c.forms = Array.isArray(c.forms) ? c.forms : [];       // [{label, no, ru}] — grammatical forms
      c.examples = Array.isArray(c.examples) ? c.examples : []; // [{label, no, ru, note}] — examples per form/tense
      c.synonyms = Array.isArray(c.synonyms) ? c.synonyms : []; // [{no, ru, note}] — synonyms with translation + difference
      ['no', 'ru', 'uk', 'en', 'description', 'example', 'exampleRu', 'wordClass', 'image', 'imagePrompt'].forEach(k => { if (c[k] == null) c[k] = ''; });
      return this.sanitizeCard(c);
    },
    async saveNow() {
      clearTimeout(this._t);
      const st = this.state;
      if (st.log.length > 60000) st.log = st.log.slice(-50000);
      st.savedAt = Date.now();
      // what goes to the disk: the same state, the keys sealed (in memory they stay usable)
      let disk = st;
      try { disk = Object.assign({}, st, { settings: await this.sealSettings(st.settings) }); } catch (e) { /* no WebCrypto: as before */ }
      try {
        await this.idbSet(KEY, disk);
        // saved properly: an older emergency copy must not win on the next start
        try { if (localStorage.getItem(LS_KEY) != null) localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ }
      } catch (e) {
        console.warn('IndexedDB save failed, fallback to localStorage', e);
        try { localStorage.setItem(LS_KEY, JSON.stringify(disk)); }
        catch (e2) { window.UI && UI.toast('Не удалось сохранить: хранилище переполнено', 'bad'); }
      }
    },
    save() {
      clearTimeout(this._t);
      this._t = setTimeout(() => this.saveNow(), 250);
    },

    get settings() { return this.state.settings; },
    setSetting(k, v) { this.state.settings[k] = v; this.save(); },

    /* ---------- decks ---------- */
    decks() { return this.state.decks; },
    deck(id) { return this.state.decks.find(d => d.id === id); },
    addDeck(name, description = '', extra) {
      const d = this.sanitizeDeck(Object.assign({ id: U.uid(), name: name || this.AUTO_DECK, description, created: Date.now(), updated: Date.now() }, extra || {}));
      this.state.decks.push(d); this.save(); return d;
    },
    updateDeck(id, patch) { const d = this.deck(id); if (d) { Object.assign(d, patch, { updated: Date.now() }); this.sanitizeDeck(d); this.save(); } return d; },
    /* ---------- 🕘 decks in work first (v222) ---------- */
    /** the deck is «in work» (studied, opened, cards edited / added, AI check): it goes up in the deck lists.
     * Memory at once; written to disk at most once a minute (answers / edits save the state anyway). */
    touchDeck(id) {
      const d = id && this.deck(id); if (!d) return;
      const now = Date.now(); d.lastUsed = now;
      if (now - (this._touchSaved || 0) > 60000) { this._touchSaved = now; this.save(); }
    },
    /** a card session starts: a deck session (id) marks its deck at every answer; «all decks» (null) marks nothing; undefined = no session */
    studyDeck(id) { this._studyDeck = id === undefined ? undefined : id || null; if (id) this.touchDeck(id); },
    /** 📌 pin on top / unpin */
    pinDeck(id, on) { const d = this.deck(id); if (!d) return; if (on) d.pinned = Date.now(); else delete d.pinned; d.updated = Date.now(); this.save(); },
    /** the time of the last answer per deck, from the answer log (decks made before v222 have no lastUsed) — cached */
    deckLastAnswers() {
      const log = this.state.log || [], cards = this.state.cards || [];
      const k = log.length + ':' + cards.length + ':' + (log.length ? (log[log.length - 1] || {}).ts : 0);
      if (this._dla && this._dla.k === k) return this._dla.v;
      const deckOf = new Map(cards.map(c => [c.id, c.deckId])), v = {};
      log.forEach(e => { const id = e && deckOf.get(e.c); if (id && (e.ts || 0) > (v[id] || 0)) v[id] = e.ts; });
      this._dla = { k, v };
      return v;
    },
    /** when the deck was last in work: lastUsed, else its last answer, else when it was made */
    deckUsedAt(d, last) { return d.lastUsed || (last || this.deckLastAnswers())[d.id] || d.created || 0; },
    /** 🕘 the one order of every deck list (sidebar, home): 📌 pinned first (in pin order), then Settings → «Порядок колод»:
     * recent (default) — the deck in work first · created — as made · abc — by name */
    decksByUse(list) {
      const all = this.state.decks, decks = (list || all).slice();
      const mode = this.state.settings.deckSort || 'recent';
      const idx = new Map(all.map((d, i) => [d.id, i]));
      const last = mode === 'recent' ? this.deckLastAnswers() : null;
      const coll = mode === 'abc' && window.Intl && Intl.Collator ? new Intl.Collator(['ru', 'nb'], { numeric: true, sensitivity: 'base' }) : null;
      const rest = mode === 'abc' ? (a, b) => (coll ? coll.compare(String(a.name), String(b.name)) : String(a.name).localeCompare(String(b.name)))
        : mode === 'recent' ? (a, b) => this.deckUsedAt(b, last) - this.deckUsedAt(a, last)
        : () => 0;
      return decks.sort((a, b) => (!!b.pinned - !!a.pinned) || (a.pinned && b.pinned ? a.pinned - b.pinned : 0) || rest(a, b) || (idx.get(a.id) - idx.get(b.id)));
    },
    /** deleting a deck moves it (with its cards) to the trash — can be restored for 30 days */
    deleteDeck(id) {
      const deck = this.deck(id);
      if (!deck) return null;
      const cards = this.state.cards.filter(c => c.deckId === id);
      const entry = { id: U.uid(), type: 'deck', t: Date.now(), deck, cards };
      this.trash().push(entry);
      this.state.decks = this.state.decks.filter(d => d.id !== id);
      this.state.cards = this.state.cards.filter(c => c.deckId !== id);
      this.save();
      return entry;
    },

    /* ---------- trash (undo / restore) ---------- */
    TRASH_DAYS: 30,
    trash() { this.state.trash = this.state.trash || []; return this.state.trash; },
    purgeTrash() {
      const limit = Date.now() - this.TRASH_DAYS * U.DAY;
      this.state.trash = this.trash().filter(e => e.t > limit);
    },
    /** put an entry back (deck with its cards, or cards into their deck) */
    restoreTrash(entryId) {
      const tr = this.trash();
      const i = tr.findIndex(e => e.id === entryId);
      if (i < 0) return 0;
      const e = tr[i];
      tr.splice(i, 1);
      const now = Date.now();
      if (e.type === 'deck') {
        if (!this.deck(e.deck.id)) { e.deck.updated = now; this.state.decks.push(e.deck); }
        const have = new Set(this.state.cards.map(c => c.id));
        e.cards.forEach(c => { if (!have.has(c.id)) { c.updated = now; this.state.cards.push(c); } });
        this.save();
        return e.cards.length;
      }
      let n = 0;
      e.cards.forEach(c => {
        if (this.card(c.id)) return;
        if (!this.deck(c.deckId)) {
          // the deck itself was deleted meanwhile — bring the card into "Восстановленные"
          let d = this.state.decks.find(x => x.name === 'Восстановленные');
          if (!d) d = this.addDeck('Восстановленные', 'Карточки из корзины');
          c.deckId = d.id;
        }
        c.updated = now;
        this.state.cards.push(c); n++;
      });
      this.save();
      return n;
    },
    deleteTrashForever(entryId) {
      this.state.trash = this.trash().filter(e => e.id !== entryId);
      this.save();
    },
    trashCount() { return this.trash().reduce((n, e) => n + (e.type === 'deck' ? 1 : e.cards.length), 0); },

    /* ---------- cards ---------- */
    cards(deckId) { return deckId ? this.state.cards.filter(c => c.deckId === deckId) : this.state.cards; },
    card(id) { return this.state.cards.find(c => c.id === id); },
    addCard(deckId, data) {
      const c = this.migrateCard(Object.assign({
        id: U.uid(), deckId, no: '', ru: '', uk: '', en: '', description: '', example: '', exampleRu: '', wordClass: '',
        tags: [], image: '', imagePrompt: '', created: Date.now(), updated: Date.now(), srs: {},
      }, data, { id: (data && data.keepId && data.id) || U.uid(), deckId }));
      delete c.keepId;
      this.state.cards.push(c);
      this.save();
      // 🏷 a deck still without a name: named once the batch is in (the sources name it right away; this catches the rest)
      const dk = this.deck(deckId);
      if (dk && dk.autoName && this.isAutoName(dk.name)) {
        this._anT = this._anT || {};
        clearTimeout(this._anT[deckId]);
        this._anT[deckId] = setTimeout(() => { if (this.autoNameDeck(deckId) && window.App && App.render) App.render(); }, 900);
      }
      return c;
    },
    updateCard(id, patch) {
      const c = this.card(id);
      if (c) {
        // ✓ a side the person (or anything but a new AI check) changed is no longer «проверено нейросетью»
        const mark = c.aiCheck ? JSON.stringify(c.aiCheck) : '', was = {};
        if (mark) AI_FACE.front.concat(AI_FACE.back).forEach(k => { was[k] = c[k]; });
        Object.assign(c, patch, { updated: Date.now() });
        const fresh = patch && Object.prototype.hasOwnProperty.call(patch, 'aiCheck') && JSON.stringify(patch.aiCheck == null ? null : patch.aiCheck) !== mark;
        if (mark && !fresh && c.aiCheck) this.aiCheckEdited(c, was);
        this.sanitizeCard(c); this.save();
      }
      return c;
    },
    /** the text of a side changed → its mark goes (and the «исправлено» notes of that side) */
    aiCheckEdited(c, was) {
      // the same cleaning as the stored text (a save of the editor without a real change — \r\n of an import, a tag — is no edit)
      const changed = k => faceText(was[k]) !== faceText(c[k]);
      const a = JSON.parse(JSON.stringify(c.aiCheck));
      ['front', 'back'].forEach(side => {
        if (!AI_FACE[side].some(changed)) return;
        delete a[side]; delete a[side === 'front' ? 'byFront' : 'byBack'];
        if (a.fixed) AI_FACE[side].forEach(k => { delete a.fixed[k]; });
      });
      if (a.front || a.back) c.aiCheck = a; else delete c.aiCheck;
    },
    /** deleted cards go to the trash (restorable for 30 days); returns the trash entry */
    deleteCards(ids) {
      const set = new Set(ids);
      const cards = this.state.cards.filter(c => set.has(c.id));
      if (!cards.length) return null;
      const entry = { id: U.uid(), type: 'cards', t: Date.now(), cards };
      this.trash().push(entry);
      this.state.cards = this.state.cards.filter(c => !set.has(c.id));
      this.save();
      return entry;
    },
    moveCards(ids, deckId) {
      const set = new Set(ids);
      const now = Date.now();
      this.state.cards.forEach(c => { if (set.has(c.id)) { c.deckId = deckId; c.updated = now; } });
      this.save();
    },
    resetProgress(ids) {
      const set = new Set(ids);
      const now = Date.now();
      this.state.cards.forEach(c => { if (set.has(c.id)) { c.srs = {}; c.tags = c.tags.filter(t => t !== 'leech'); c.updated = now; } });
      if (window.FSRS) FSRS.Load.invalidate();
      this.save();
    },

    /**
     * 📌 honest «I know it»: the memory of the card holds for 3+ weeks (FSRS stability ≥ 21 days) and the last answer
     * was not «не знаю» — not just «3 right answers in a row on the same day»
     */
    firmlyKnown(c) {
      return ['nr', 'rn'].some(d => { const s = c.srs && c.srs[d]; return s && s.reps && (s.stability || 0) >= 21 && s.lastGrade !== 1; });
    },
    firmCount(cards) { return (cards || this.state.cards).filter(c => this.firmlyKnown(c)).length; },
    /* ---------- status ---------- */
    dirStatus(c, dir) {
      const s = c.srs && c.srs[dir];
      if (!s || !s.reps) return 'new';
      if (s.lastGrade === 1) return 'debt';
      if ((s.streak || 0) >= this.settings.learnedStreak) return 'learned';
      return 'learning';
    },
    /** combined status over directions that were studied */
    status(c, dir) {
      if (dir === 'nr' || dir === 'rn') return this.dirStatus(c, dir);
      const st = ['nr', 'rn'].filter(d => c.srs && c.srs[d] && c.srs[d].reps).map(d => this.dirStatus(c, d));
      if (!st.length) return 'new';
      if (st.includes('debt')) return 'debt';
      if (st.includes('learning')) return 'learning';
      return 'learned';
    },
    isDue(c, dir, now = Date.now()) {
      const dirs = dir === 'nr' || dir === 'rn' ? [dir] : ['nr', 'rn'];
      return dirs.some(d => { const s = c.srs && c.srs[d]; return s && s.reps && s.due <= now; });
    },
    isLeech(c) { return c.tags.includes('leech'); },
    deckStats(deckId, dir) {
      const cards = this.cards(deckId);
      const r = { total: cards.length, new: 0, learning: 0, debt: 0, learned: 0, due: 0, leech: 0, aiChecked: 0 };
      const now = Date.now();
      for (const c of cards) {
        r[this.status(c, dir)]++;
        if (this.isDue(c, dir, now)) r.due++;
        if (this.isLeech(c)) r.leech++;
        if (c.aiChecked) r.aiChecked++;
      }
      r.learnedPct = r.total ? Math.round(r.learned / r.total * 100) : 0;
      return r;
    },

    /* ---------- review log ---------- */
    logReview(cardId, dir, g, isNew) {
      const e = { ts: Date.now(), c: cardId, d: dir, g };
      if (isNew) e.n = 1;
      // 🕘 an answer in a deck session keeps that deck on top (saved with the answer below)
      if (this._studyDeck) { const c = this.card(cardId); if (c && c.deckId === this._studyDeck) { const dk = this.deck(c.deckId); if (dk) dk.lastUsed = e.ts; } }
      this.state.log.push(e);
      this.save();
      return e;
    },
    unlog(entry) {
      const i = this.state.log.lastIndexOf(entry);
      if (i >= 0) this.state.log.splice(i, 1);
      this.save();
    },
    newStudiedToday() {
      const start = U.startOfDay();
      let n = 0;
      for (let i = this.state.log.length - 1; i >= 0; i--) {
        const l = this.state.log[i];
        if (l.ts < start) break;
        if (l.n) n++;
      }
      return n;
    },
    /** vacation mode: the streak is frozen between these days */
    onVacation(t) {
      const v = this.settings.vacation;
      if (!v) return false;
      const d = U.startOfDay(t);
      return d >= v.from && d <= v.to;
    },
    /** days in a row with answers; rest days (settings.restDays, JS weekday numbers) and vacation days don't break it */
    streakDays() {
      const days = new Set(this.state.log.map(l => U.dayKey(l.ts)));
      const rest = new Set(this.settings.restDays || []);
      const free = t => rest.has(new Date(t).getDay()) || this.onVacation(t);
      let n = 0; let t = Date.now();
      if (!days.has(U.dayKey(t))) t -= U.DAY; // streak still alive if studied yesterday
      for (let guard = 0; guard < 3660; guard++) {
        if (days.has(U.dayKey(t))) n++;
        else if (!free(t)) break;
        t -= U.DAY;
      }
      return n;
    },

    /* ---------- 🔒 personal course decks: cards from the owner's bought textbooks never leave this device ----------
     * A deck is personal when MyCourse marked it (personal / gin1Deck / courseDeck); a card when it is marked itself
     * (personal / gin1Key / courseKey), lies in such a deck, or carries a course tag. Sharing, export to other formats,
     * public / cloud copies skip them (PERSONAL_NOTE says so gently); a backup file on this device keeps them, marked. */
    PERSONAL_TAGS: ['godinorsk1', 'paavei', 'norskpluss', 'samtale', 'verbs-personal', 'renhold', '360verb', '613', 'arve613'], // 'arve613' — the real tag of «613 слов» in MyCourse.BOOKS
    PERSONAL_NOTE: 'Личные колоды из учебника не отправляются — они только для вас',
    isPersonalDeck(d) {
      if (typeof d === 'string') d = this.deck(d);
      return !!(d && (d.personal === true || d.gin1Deck || d.courseDeck));
    },
    isPersonalCard(c) {
      if (!c) return false;
      if (c.personal === true || c.gin1Key || c.courseKey) return true;
      if (c.deckId && this.isPersonalDeck(this.deck(c.deckId))) return true;
      const tags = Array.isArray(c.tags) ? c.tags : [];
      // («samtale» is also the tag of your own conversations from the interpreter — those are yours to share)
      return tags.some(t => t === 'godinorsk1' || t === 'paavei' || t === 'norskpluss' || /^(gin1|paavei|norskpluss|samtale)-/.test(t))
        || (tags.includes('samtale') && !/^🗣 Из разговора/.test(String(c.description || '')));
    },
    /** cards without the personal ones → { cards, skipped } */
    shareableCards(cards) {
      const out = [], list = cards || this.state.cards; let skipped = 0;
      list.forEach(c => { if (this.isPersonalCard(c)) skipped++; else out.push(c); });
      return { cards: out, skipped };
    },

    /* ---------- backup ---------- */
    /** API keys / tokens never leave this browser: not in backups, and a restore keeps the keys you have here */
    SECRET_KEYS: ['claudeKey', 'deeplKey', 'msKey', 'pollinationsToken', 'ytKey', 'azureKey', 'gcloudKey', 'geminiKey', 'elevenKey', 'vkToken', 'plusToken', 'cloudAnon', 'cloudUrl'],
    secrets(settings) {
      const out = {};
      this.SECRET_KEYS.forEach(k => { out[k] = settings[k] || ''; });
      out.aiCfg = {};
      Object.entries(settings.aiCfg || {}).forEach(([id, c]) => { if (c && c.key) out.aiCfg[id] = c.key; });
      return out;
    },
    /**
     * o.shareable (a copy that leaves this device: cloud sync, a public copy) → without the personal course decks and
     * cards (and their trash entries / answers). Without it (a backup file the owner downloads here) they stay — marked
     * «personal», with a note in the file.
     */
    exportBackup(o = {}) {
      const st = JSON.parse(JSON.stringify(this.state));
      this.SECRET_KEYS.forEach(k => { st.settings[k] = ''; });
      Object.values(st.settings.aiCfg || {}).forEach(c => { if (c && c.key) c.key = ''; });
      const pDecks = new Set((st.decks || []).filter(d => this.isPersonalDeck(d)).map(d => d.id));
      const pCard = c => this.isPersonalCard(c) || pDecks.has(c.deckId);
      const pCards = (st.cards || []).filter(pCard);
      if (o.shareable) {
        const gone = new Set(pCards.map(c => c.id));
        st.decks = (st.decks || []).filter(d => !pDecks.has(d.id));
        st.cards = (st.cards || []).filter(c => !gone.has(c.id));
        if (Array.isArray(st.log)) st.log = st.log.filter(l => !gone.has(l && l.c));
        if (Array.isArray(st.trash)) st.trash = st.trash.filter(e => !(e && ((e.deck && pDecks.has(e.deck.id)) || (Array.isArray(e.cards) && e.cards.some(pCard)))));
        const meta = { app: 'norsk-kort', version: 2, exported: new Date().toISOString(), ...st };
        if (pDecks.size || pCards.length) meta.personalSkipped = { decks: pDecks.size, cards: pCards.length, note: this.PERSONAL_NOTE };
        return meta;
      }
      // a file on this device: everything, the personal decks / cards clearly marked
      st.decks.forEach(d => { if (pDecks.has(d.id)) d.personal = true; });
      pCards.forEach(c => { c.personal = true; });
      const out = { app: 'norsk-kort', version: 2, exported: new Date().toISOString(), ...st };
      if (pDecks.size || pCards.length) out.personal = { decks: pDecks.size, cards: pCards.length, note: '🔒 В копии есть личные колоды из учебника — только для вас: не отправляйте этот файл другим людям и не выкладывайте его.' };
      return out;
    },
    async replaceAll(st) {
      const keep = this.secrets(this.state.settings);
      st.settings = Object.assign({}, DEFAULT_SETTINGS, st.settings || {});
      st.settings.fsrsW = Safe.weights(st.settings.fsrsW); st.settings.fsrsOpt = Safe.fsrsMeta(st.settings.fsrsOpt); this.sanitizeArt(st.settings); this.sanitizeVoices(st.settings);
      this.SECRET_KEYS.forEach(k => { st.settings[k] = keep[k]; });
      st.settings.aiCfg = st.settings.aiCfg || {};
      Object.entries(keep.aiCfg).forEach(([id, key]) => { st.settings.aiCfg[id] = Object.assign({}, st.settings.aiCfg[id] || {}, { key }); });
      st.decks = (st.decks || []).filter(d => d && typeof d === 'object').map(d => this.sanitizeDeck(d));
      st.cards = (st.cards || []).filter(c => c && typeof c === 'object').map(c => this.migrateCard(c)); st.log = Safe.log(st.log);
      // restored backup: cards without an origin record show "Импорт" too
      st.cards.forEach(c => { if (!Array.isArray(c.history) || !c.history.length) c.history = [{ t: c.created || Date.now(), by: 'import', a: 'import', n: 'восстановлено из резервной копии — подробности импорта не записывались' }]; });
      st.provV1 = true;
      this.state = st;
      try { this.migrateAutoNames(st); } catch (e) { console.warn('autoName', e); }
      if (window.FSRS) FSRS.Load.invalidate();
      await this.saveNow();
    },
    /** "delete everything": decks and cards go to the trash (restorable 30 days); answer statistics are cleared */
    async clearAll() {
      this.state.decks.slice().forEach(d => this.deleteDeck(d.id));
      const rest = this.state.cards.map(c => c.id);
      if (rest.length) this.deleteCards(rest);
      this.state.log = [];
      await this.saveNow();
    },
  };

  document.addEventListener('visibilitychange', () => { if (document.hidden && Store.state) Store.saveNow(); });
  window.addEventListener('pagehide', () => { if (Store.state) Store.saveNow(); });

  window.Store = Store;
})();
