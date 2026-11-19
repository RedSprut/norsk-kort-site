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
    azureKey: '', azureRegion: '', gcloudKey: '', elevenKey: '', // better voices (Settings → Озвучка)
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
    ttsEngine: 'auto',         // auto | browser | google
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
    list(arr, fields) {
      return (Array.isArray(arr) ? arr : []).slice(0, 300).filter(x => x && typeof x === 'object').map(x => {
        const o = {}; fields.forEach(f => { if (x[f] != null) o[f] = Safe.text(x[f], 2000); }); return o;
      });
    },
  };

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
    Safe,
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
      c.forms = Safe.list(c.forms, ['label', 'no', 'ru', 'uk', 'trBy', 'trByUk', 'name']);
      c.examples = Safe.list(c.examples, ['label', 'no', 'ru', 'note', 'name']);
      c.synonyms = Safe.list(c.synonyms, ['no', 'ru', 'note']);
      if (Array.isArray(c.tags)) c.tags = c.tags.slice(0, 40).map(t => Safe.text(t, 60)).filter(Boolean);
      if (Array.isArray(c.history)) c.history = c.history.slice(-200).filter(h => h && typeof h === 'object').map(h => Object.assign({}, h, { by: Safe.text(h.by, 60), a: Safe.text(h.a, 30), n: h.n != null ? Safe.text(h.n, 400) : undefined }));
      Object.keys(c).forEach(k => { if (typeof c[k] === 'function') delete c[k]; });
      return c;
    },
    sanitizeDeck(d) {
      if (!d || typeof d !== 'object') return d;
      d.name = Safe.text(d.name, 200) || 'Колода';
      if (d.description != null) d.description = Safe.text(d.description, 4000);
      ['cover', 'image'].forEach(k => { if (d[k]) d[k] = Safe.image(d[k]); });
      return d;
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
      st.settings.fsrsW = Safe.weights(st.settings.fsrsW); st.settings.fsrsOpt = Safe.fsrsMeta(st.settings.fsrsOpt);
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
    addDeck(name, description = '') {
      const d = this.sanitizeDeck({ id: U.uid(), name: name || 'Новая колода', description, created: Date.now(), updated: Date.now() });
      this.state.decks.push(d); this.save(); return d;
    },
    updateDeck(id, patch) { const d = this.deck(id); if (d) { Object.assign(d, patch, { updated: Date.now() }); this.sanitizeDeck(d); this.save(); } return d; },
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
      if (e.type === 'deck') {
        if (!this.deck(e.deck.id)) this.state.decks.push(e.deck);
        const have = new Set(this.state.cards.map(c => c.id));
        e.cards.forEach(c => { if (!have.has(c.id)) this.state.cards.push(c); });
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
      return c;
    },
    updateCard(id, patch) {
      const c = this.card(id);
      if (c) { Object.assign(c, patch, { updated: Date.now() }); this.sanitizeCard(c); this.save(); }
      return c;
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
      this.state.cards.forEach(c => { if (set.has(c.id)) c.deckId = deckId; });
      this.save();
    },
    resetProgress(ids) {
      const set = new Set(ids);
      this.state.cards.forEach(c => { if (set.has(c.id)) { c.srs = {}; c.tags = c.tags.filter(t => t !== 'leech'); } });
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
    PERSONAL_TAGS: ['godinorsk1', 'paavei', 'norskpluss', 'samtale', 'verbs-personal', 'renhold', '360verb', '613'],
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
    SECRET_KEYS: ['claudeKey', 'deeplKey', 'msKey', 'pollinationsToken', 'ytKey', 'azureKey', 'gcloudKey', 'elevenKey', 'vkToken', 'cloudAnon', 'cloudUrl'],
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
      st.settings.fsrsW = Safe.weights(st.settings.fsrsW); st.settings.fsrsOpt = Safe.fsrsMeta(st.settings.fsrsOpt);
      this.SECRET_KEYS.forEach(k => { st.settings[k] = keep[k]; });
      st.settings.aiCfg = st.settings.aiCfg || {};
      Object.entries(keep.aiCfg).forEach(([id, key]) => { st.settings.aiCfg[id] = Object.assign({}, st.settings.aiCfg[id] || {}, { key }); });
      st.decks = (st.decks || []).filter(d => d && typeof d === 'object').map(d => this.sanitizeDeck(d));
      st.cards = (st.cards || []).filter(c => c && typeof c === 'object').map(c => this.migrateCard(c)); st.log = Safe.log(st.log);
      // restored backup: cards without an origin record show "Импорт" too
      st.cards.forEach(c => { if (!Array.isArray(c.history) || !c.history.length) c.history = [{ t: c.created || Date.now(), by: 'import', a: 'import', n: 'восстановлено из резервной копии — подробности импорта не записывались' }]; });
      st.provV1 = true;
      this.state = st;
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
