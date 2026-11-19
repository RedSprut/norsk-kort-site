/* ============ 🏋️ Drills: ✍️ «Вставь слово» (cloze) · 🔤 «Формы слов» · 🎯 «Следующие 20 слов» ============
 * ✍️ Cloze (Clozemaster-style): a sentence with one word blanked, its Russian translation as the hint.
 *    Sentences: examples of your own cards, Tatoeba (nob → rus, translated by people), your «📘 Мой учебник» books
 *    (IndexedDB «norsk-kort-books», pages that were already read). Step 1: choose from 4; after 2 correct answers for
 *    a sentence → step 2: type the word (æ ø å buttons, «ae / o / aa» spellings accepted).
 * 🔤 Forms: strong verbs (built-in list, works offline), noun forms + en/ei/et, adjective agreement — from your cards'
 *    forms or the Ordbøkene paradigms (ord.uib.no, CC BY 4.0; cached on the device after the first lookup).
 * 🎯 Next words: the Norwegian KELLY list (data/kelly.json, CC BY-SA 4.0) — the most frequent words you don't have yet,
 *    with an APPROXIMATE CEFR level (by frequency rank only: 1–800 A1, 801–1800 A2, 1801–3500 B1, 3501+ B2).
 * Progress is kept separately from the FSRS schedule: Store.settings.drills (answers per sentence / word).
 */
(function () {
  const API = 'https://ord.uib.no';
  const KELLY_URL = 'data/kelly.json';
  const BOOKS_DB = 'norsk-kort-books';
  const DECK_NEXT = '🎯 Частые слова A1–B2';
  const DECK_SENT = '✍️ Предложения из упражнений';
  const DECK_WORDS = '🔤 Слова из упражнений';
  const LEVELS = ['A1', 'A2', 'B1', 'B2'];
  const LEVEL_RANKS = { A1: '1–800', A2: '801–1800', B1: '1801–3500', B2: '3501–6000' };
  const POS_RU = { n: 'сущ.', v: 'глаг.', adj: 'прил.', adv: 'нареч.', prep: 'предлог', pron: 'местоим.', conj: 'союз', subj: 'союз', det: 'определ.', num: 'числит.', interj: 'междом.' };
  const POS_LONG = { n: 'существительное', v: 'глагол', adj: 'прилагательное' };
  const WORD_CLASS = { n: 'substantiv', v: 'verb', adj: 'adjektiv', adv: 'adverb', prep: 'preposisjon', pron: 'pronomen', conj: 'konjunksjon', subj: 'konjunksjon', det: 'determinativ', num: 'tallord', interj: 'interjeksjon' };
  const esc = s => U.esc(s);
  const low = s => String(s == null ? '' : s).toLowerCase().normalize('NFC');
  const firstLine = s => String(s || '').split('\n')[0].replace(/\s+/g, ' ').trim().slice(0, 90);
  const WORD_RE = /^[a-zæøåéèêóòôüäöà-]+$/i;
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('сервер не ответил вовремя')), ms))]);
  const netMsg = e => /failed to fetch|networkerror|load failed|abort|network/i.test((e && e.message) || '') ? 'нет связи с интернетом' : ((e && e.message) || 'неизвестная ошибка');
  const offline = () => navigator.onLine === false;
  const SPK = (s = 18) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>`;

  /* ---------- built-in strong / irregular verbs (Bokmål): infinitiv | presens | preteritum | perfektum | русский | вид ---------- */
  const STRONG_SRC = `være|er|var|vært|быть|irr
ha|har|hadde|hatt|иметь|irr
bli|blir|ble|blitt|становиться
gå|går|gikk|gått|идти
komme|kommer|kom|kommet|приходить
se|ser|så|sett|видеть
si|sier|sa|sagt|сказать|irr
gjøre|gjør|gjorde|gjort|делать|irr
få|får|fikk|fått|получать
ta|tar|tok|tatt|брать
gi|gir|ga/gav|gitt|давать
stå|står|sto/stod|stått|стоять
ligge|ligger|lå|ligget|лежать
sitte|sitter|satt|sittet|сидеть
skrive|skriver|skrev/skreiv|skrevet|писать
drikke|drikker|drakk|drukket|пить
finne|finner|fant|funnet|находить
synge|synger|sang|sunget|петь
hjelpe|hjelper|hjalp|hjulpet|помогать
sove|sover|sov|sovet|спать
le|ler|lo|ledd|смеяться
dra|drar|dro/drog|dratt|уезжать; тянуть
fly|flyr|fløy|fløyet|летать
bære|bærer|bar|båret|нести
stjele|stjeler|stjal|stjålet|красть
sette|setter|satte|satt|ставить, сажать|irr
legge|legger|la|lagt|класть|irr
selge|selger|solgte|solgt|продавать|irr
spørre|spør|spurte|spurt|спрашивать|irr
vite|vet|visste|visst|знать|irr
velge|velger|valgte|valgt|выбирать|irr
fortelle|forteller|fortalte|fortalt|рассказывать|irr
bite|biter|bet/beit|bitt|кусать
gripe|griper|grep/greip|grepet|хватать
rive|river|rev/reiv|revet|рвать
bryte|bryter|brøt|brutt|ломать, нарушать
skyte|skyter|skjøt|skutt|стрелять
fryse|fryser|frøs|frosset|мёрзнуть
by|byr|bød|budt|предлагать
skjære|skjærer|skar|skåret|резать
treffe|treffer|traff|truffet|встречать; попадать
slippe|slipper|slapp|sluppet|отпускать
vinne|vinner|vant|vunnet|выигрывать
binde|binder|bandt|bundet|связывать
springe|springer|sprang|sprunget|бежать, прыгать
falle|faller|falt|falt|падать
holde|holder|holdt|holdt|держать
henge|henger|hang|hengt|висеть
slå|slår|slo|slått|бить
la|lar|lot|latt|позволять, оставлять
gråte|gråter|gråt|grått|плакать
hete|heter|het|hett|называться
løpe|løper|løp|løpt/løpet|бежать
be|ber|ba/bad|bedt|просить
ri|rir|red/rei|ridd|ездить верхом
skrike|skriker|skrek/skreik|skreket|кричать
stige|stiger|steg/steig|steget|подниматься
lyve|lyver|løy|løyet|лгать
krype|kryper|krøp|krøpet|ползать
synke|synker|sank|sunket|тонуть
trekke|trekker|trakk|trukket|тянуть
forsvinne|forsvinner|forsvant|forsvunnet|исчезать
forstå|forstår|forsto/forstod|forstått|понимать
tvinge|tvinger|tvang|tvunget|заставлять
brekke|brekker|brakk|brukket|ломать
drive|driver|drev/dreiv|drevet|заниматься; вести (дело)
kunne|kan|kunne|kunnet|мочь, уметь|modal
ville|vil|ville|villet|хотеть|modal
skulle|skal|skulle|skullet|собираться; быть должным|modal
måtte|må|måtte|måttet|быть вынужденным|modal
burde|bør|burde|burdet|следовало бы|modal`;
  const STRONG = STRONG_SRC.trim().split('\n').map(l => {
    const [inf, pres, past, perf, ru, kind] = l.split('|');
    const v = s => s.split('/');
    return { lemma: inf, pos: 'v', ru, kind: kind || 'strong', builtin: true, forms: { inf: [inf], pres: v(pres), past: v(past), perf: v(perf) } };
  });
  const STRONG_IDX = new Map(STRONG.map(e => [e.lemma, e]));

  /* ---------- progress (separate from FSRS): Store.settings.drills ---------- */
  function prog() {
    const s = Store.settings;
    if (!s.drills || typeof s.drills !== 'object') s.drills = {};
    const d = s.drills;
    d.cloze = d.cloze || {}; d.forms = d.forms || {}; d.stats = d.stats || {}; d.last = d.last || {};
    if (!Array.isArray(d.kellySkip)) d.kellySkip = [];
    return d;
  }
  function bump(kind, key, ok) {
    const d = prog(); const box = d[kind];
    const e = box[key] || (box[key] = { ok: 0, bad: 0 });
    if (ok) e.ok++; else e.bad++;
    e.t = Date.now();
    const keys = Object.keys(box);
    if (keys.length > 1500) keys.sort((a, b) => (box[a].t || 0) - (box[b].t || 0)).slice(0, keys.length - 1200).forEach(k => delete box[k]);
    const st = d.stats[kind] || (d.stats[kind] = { n: 0, ok: 0, sessions: 0 });
    st.n++; if (ok) st.ok++;
    Store.save();
  }

  /* ---------- answer checking: exact · æ/ø/å spelled ae/o/aa · one typo in a long word ---------- */
  const fold = s => low(s).replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/aa/g, 'a').replace(/oe/g, 'o').replace(/[éèê]/g, 'e').replace(/[óòô]/g, 'o');
  function judge(typed, answers) {
    const t = low(typed).trim().replace(/\s+/g, ' ');
    const list = (answers || []).filter(Boolean);
    if (!t) return { ok: false, how: 'empty', best: list[0] || '' };
    for (const a of list) if (low(a) === t) return { ok: true, how: 'exact', best: a };
    for (const a of list) if (fold(a) === fold(t)) return { ok: true, how: 'nordic', best: a };
    for (const a of list) if (a.length >= 6 && U.levenshtein(low(a), t) === 1) return { ok: true, how: 'typo', best: a };
    let best = list[0] || '', bd = Infinity;
    list.forEach(a => { const d = U.levenshtein(low(a), t); if (d < bd) { bd = d; best = a; } });
    return { ok: false, how: 'wrong', best };
  }

  /* ---------- 🎯 Kelly frequency list (same origin, works offline once cached) ---------- */
  let kelly = null;
  async function loadKelly() {
    if (kelly) return kelly;
    const r = await fetch(KELLY_URL);
    if (!r.ok) throw new Error('не удалось загрузить список частотности (' + r.status + ')');
    const j = await r.json();
    const words = (j.words || []).map(([w, rank, pos, level, en]) => ({ w: String(w), rank: +rank || 0, pos: String(pos || ''), level: LEVELS.includes(level) ? level : 'B2', en: String(en || '') }));
    kelly = { meta: j, words, idx: new Map(words.map(x => [low(x.w), x])) };
    return kelly;
  }
  const mainPos = p => String(p || '').split(',')[0].trim();
  const kellyPos = w => { if (!kelly) return ''; const k = kelly.idx.get(w); return k ? mainPos(k.pos) : ''; };

  /* ---------- words of the user's cards -> entries { lemma, pos, ru, forms:{slot:[variants]}, gender, card } ---------- */
  const SLOT_RX = [
    [/presens partisipp|<PresPart>/i, null], [/infinitiv/i, 'inf'], [/presens/i, 'pres'], [/preteritum/i, 'past'], [/perfektum|partisipp/i, 'perf'], [/imperativ/i, 'imp'],
    [/ubestemt entall/i, 'si'], [/ubestemt flertall/i, 'pi'], [/bestemt entall/i, 'sd'], [/bestemt flertall/i, 'pd'],
    [/komparativ/i, 'cmp'], [/превосходная опр/i, 'supd'], [/superlativ/i, 'sup'], [/ср\. род \(positiv\)|intetkjønn|nøytrum/i, 'an'], [/м\/ж род|hankjønn/i, 'am'], [/опр\. форма/i, 'adef'], [/мн\. число/i, 'apl'],
  ];
  const cleanForm = s => String(s || '').split('\n')[0].replace(/\([^)]*\)/g, ' ').replace(/[!.?]/g, ' ').trim()
    .replace(/^(å|jeg har|jeg|har|han|hun|vi|de|du)\s+/i, '').replace(/^(en|ei|et)\s+/i, '').split(/\s*[,;/]\s*/)[0].trim().toLowerCase();
  function parseCardForms(card) {
    const forms = {}; let gender = '';
    (card.forms || []).forEach(f => {
      if (!f || !f.label || !f.no) return;
      const hit = SLOT_RX.find(([rx]) => rx.test(f.label));
      if (!hit || !hit[1]) return;
      const slot = hit[1];
      if (slot === 'si') { const a = (String(f.no).trim().match(/^(en|ei|et)\s/i) || [])[1]; if (a) gender = artGender(a); }
      const w = cleanForm(f.no);
      if (!w || !WORD_RE.test(w)) return;
      (forms[slot] = forms[slot] || []).includes(w) || forms[slot].push(w);
    });
    return { forms, gender };
  }
  const artGender = a => ({ en: 'm', ei: 'f', et: 'n' })[low(a)] || '';
  function cardPos(c) {
    const no = String(c.no || '').trim();
    if (/^å\s/i.test(no)) return 'v';
    if (/^(en|ei|et)\s/i.test(no)) return 'n';
    const wc = low(c.wordClass);
    if (/^verb|глагол/.test(wc)) return 'v';
    if (/^subst|существ|noun/.test(wc)) return 'n';
    if (/^adj|прилаг/.test(wc)) return 'adj';
    if (/^adv|нареч/.test(wc)) return 'adv';
    return '';
  }
  function entriesFromCards() {
    const map = new Map();
    Store.cards().forEach(c => {
      const lemma = low(Ordbok.bare(c.no));
      if (!lemma || lemma.length < 2 || !WORD_RE.test(lemma)) return;
      const pf = parseCardForms(c);
      const art = (String(c.no).trim().match(/^(en|ei|et)\s/i) || [])[1];
      const old = map.get(lemma);
      if (old) {
        // the same word on several cards (another deck, the sample deck): one entry, all forms and examples
        old.cards.push(c);
        Object.entries(pf.forms).forEach(([k, arr]) => { old.forms[k] = [...new Set((old.forms[k] || []).concat(arr))]; });
        if (!old.pos) old.pos = cardPos(c);
        if (!old.gender) old.gender = pf.gender || (art ? artGender(art) : '');
        if (!old.ru) old.ru = firstLine(c.ru);
        return;
      }
      const strong = STRONG_IDX.get(lemma);
      const pos = cardPos(c) || (strong ? 'v' : kellyPos(lemma));
      const forms = {};
      [strong ? strong.forms : {}, pf.forms].forEach(src => Object.entries(src).forEach(([k, arr]) => { forms[k] = [...new Set((forms[k] || []).concat(arr))]; }));
      map.set(lemma, { lemma, pos, ru: firstLine(c.ru), card: c, cards: [c], forms, gender: pf.gender || (art ? artGender(art) : ''), kind: strong ? strong.kind : '' });
    });
    return [...map.values()].map(prepEntry);
  }
  function prepEntry(e) {
    e._all = new Set([e.lemma]);
    Object.values(e.forms || {}).forEach(a => a.forEach(x => e._all.add(low(x))));
    return e;
  }
  const slotOf = (e, w) => { w = low(w); return Object.keys(e.forms || {}).find(k => e.forms[k].includes(w)) || (w === e.lemma ? (e.pos === 'v' ? 'inf' : e.pos === 'n' ? 'si' : e.pos === 'adj' ? 'am' : '') : ''); };

  /* ---------- Ordbøkene paradigms (cached on the device) ---------- */
  const PAR_KEY = 'nk-drill-par';
  let parCache = null;
  const parStore = () => { if (!parCache) { try { parCache = JSON.parse(localStorage.getItem(PAR_KEY) || '{}') || {}; } catch (e) { parCache = {}; } } return parCache; };
  const parSave = () => { const k = Object.keys(parCache); if (k.length > 900) k.slice(0, k.length - 700).forEach(x => delete parCache[x]); try { localStorage.setItem(PAR_KEY, JSON.stringify(parCache)); } catch (e) { /* full */ } };
  const TAGMAP = {
    VERB: { 'Inf': 'inf', 'Pres': 'pres', 'Past': 'past', '<PerfPart>': 'perf', 'Imp': 'imp' },
    NOUN: { 'Sing Ind': 'si', 'Sing Def': 'sd', 'Plur Ind': 'pi', 'Plur Def': 'pd' },
    ADJ: { 'Pos Masc/Fem Ind Sing': 'am', 'Pos Neuter Ind Sing': 'an', 'Pos Def Sing': 'adef', 'Pos Plur': 'apl', 'Cmp': 'cmp', 'Sup Ind': 'sup', 'Sup Def': 'supd' },
  };
  const POS_OF = { VERB: 'v', NOUN: 'n', ADJ: 'adj' };
  async function fetchJSON(url, ms = 9000) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), ms);
    try {
      const r = await fetch(url, ctl ? { signal: ctl.signal } : undefined);
      if (!r.ok) throw new Error('Ordbøkene: ошибка ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }
  /** -et forms first (snakket before snakka), keeps the dictionary's order otherwise */
  const tidyVariants = arr => arr.slice().sort((a, b) => {
    const pa = /a$/.test(a) && arr.includes(a.slice(0, -1) + 'et') ? 1 : 0, pb = /a$/.test(b) && arr.includes(b.slice(0, -1) + 'et') ? 1 : 0;
    return pa - pb;
  });
  function readArticle(a, lemma) {
    const out = { pos: '', gender: '', forms: {} };
    const genders = new Set();
    (a.lemmas || []).filter(l => low(l.lemma) === lemma).forEach(l => (l.paradigm_info || []).forEach(p => {
      const t = p.tags || [];
      const pos = POS_OF[t[0]];
      if (!pos || (out.pos && out.pos !== pos)) return;
      out.pos = pos;
      if (t.includes('Neuter')) genders.add('n');
      if (t.includes('Masc')) genders.add('m');
      if (t.includes('Fem')) genders.add('f');
      (p.inflection || []).forEach(f => {
        const slot = TAGMAP[t[0]][(f.tags || []).join(' ')];
        if (!slot || !f.word_form) return;
        const w = low(f.word_form);
        const arr = out.forms[slot] || (out.forms[slot] = []);
        if (!arr.includes(w)) arr.push(w);
      });
    }));
    if (!out.pos) return null;
    Object.keys(out.forms).forEach(k => { out.forms[k] = tidyVariants(out.forms[k]); });
    out.gender = [...genders].sort().join('');
    return out;
  }
  /** lemma -> { pos, gender, forms } (Ordbøkene) or null. want: 'v' | 'n' | 'adj' | '' (any of these) */
  async function paradigm(lemma, want) {
    const key = lemma + '|' + (want || '');
    const c = parStore();
    if (c[key] !== undefined) return c[key];
    const s = await fetchJSON(`${API}/api/articles?w=${encodeURIComponent(lemma)}&dict=bm&scope=e`);
    const ids = ((s.articles || {}).bm || []).slice(0, 4);
    let best = null;
    for (const id of ids) {
      const res = readArticle(await fetchJSON(`${API}/bm/article/${id}.json`), lemma);
      if (!res) continue;
      if (!want || res.pos === want) { best = res; break; }
    }
    c[key] = best; parSave();
    return best;
  }
  const cachedParadigm = (lemma, want) => { const v = parStore()[lemma + '|' + (want || '')]; return v === undefined ? undefined : v; };
  function mergeParadigm(e, p) {
    if (!p) return e;
    if (!e.pos) e.pos = p.pos;
    if (p.pos !== e.pos) return e;
    const forms = {};
    [p.forms, e.forms || {}].forEach(src => Object.entries(src).forEach(([k, arr]) => { forms[k] = [...new Set((forms[k] || []).concat(arr))]; }));
    e.forms = forms;
    if (p.gender) e.gender = p.gender;
    e.ordbok = true;
    return prepEntry(e);
  }

  /* ---------- 📘 the user's textbooks (same IndexedDB as Textbook; only pages that were already read) ---------- */
  function openBooks() {
    return new Promise((res, rej) => {
      let r;
      try { r = indexedDB.open(BOOKS_DB); } catch (e) { rej(e); return; }
      // same layout as js/textbook.js — a fresh database gets the 'books' store it expects
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('books')) r.result.createObjectStore('books', { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error || new Error('хранилище книг недоступно'));
      r.onblocked = () => rej(new Error('хранилище книг занято — закройте учебник и попробуйте ещё раз'));
    });
  }
  async function books() {
    const d = await openBooks();
    try {
      if (!d.objectStoreNames.contains('books')) return [];
      return await new Promise((res, rej) => {
        const q = d.transaction('books', 'readonly').objectStore('books').getAll();
        q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error);
      });
    } finally { d.close(); }
  }
  const bookPages = rec => Object.entries(rec.text || {}).filter(([, t]) => t && String(t).trim().length > 20);

  /* ================= ✍️ CLOZE ================= */
  const TOK_RE = /\p{L}[\p{L}'’-]*/gu;
  function tokens(s) { const out = []; let m; TOK_RE.lastIndex = 0; while ((m = TOK_RE.exec(s))) out.push({ w: m[0], i: m.index }); return out; }
  const SUFFIXES = ['ene', 'ere', 'este', 'est', 'ete', 'er', 'en', 'et', 'te', 'de', 'es', 'ne', 'a', 'e', 'r', 't', 's'];
  const stemOf = e => e.lemma.length > 3 && /e$/.test(e.lemma) ? e.lemma.slice(0, -1) : e.lemma;
  function tokenMatches(tokW, e) {
    const t = low(tokW);
    if (e._all.has(t)) return 2;
    const stem = stemOf(e);
    if (stem.length >= 3 && t.startsWith(stem) && SUFFIXES.includes(t.slice(stem.length))) return 1;
    return 0;
  }
  function findTarget(sentence, e) {
    let hit = null, score = 0;
    tokens(sentence).forEach(x => { const s = tokenMatches(x.w, e); if (s > score) { score = s; hit = x; } });
    return hit ? { answer: hit.w, start: hit.i, end: hit.i + hit.w.length } : null;
  }
  const okSentence = s => {
    const words = String(s).trim().split(/\s+/).length;
    return words >= 3 && words <= 25 && s.length <= 220 && U.cyrRatio(s) < 0.15 && U.latRatio(s) > 0.8 && !/https?:|@|\d{4,}/.test(s);
  };
  function mkItem(no, ru, hit, e, src, label) {
    return { key: 'c' + hash(low(no).trim() + '|' + low(hit.answer)), no: String(no).trim(), ru: String(ru || '').trim(), answer: hit.answer, start: hit.start, end: hit.end, e, src, label, mt: false, by: [] };
  }
  function cardSentences(entries) {
    const out = [];
    entries.forEach(e => (e.cards || []).forEach(c => {
      const pairs = [];
      if (c.example) pairs.push({ no: c.example, ru: c.exampleRu || '' });
      (c.examples || []).forEach(x => { if (x && x.no) pairs.push({ no: x.no, ru: x.ru || '' }); });
      pairs.forEach(p => {
        const no = U.stripHtml(p.no), ru = U.stripHtml(p.ru);
        const ns = Study.splitSent(no), rs = Study.splitSent(ru);
        ns.forEach((s, i) => {
          if (!okSentence(s)) return;
          const hit = findTarget(s, e); if (!hit) return;
          const r = ns.length === rs.length ? rs[i] : (ns.length === 1 ? ru : '');
          // the label must not give the answer away: no word here
          out.push(mkItem(s, U.cyrRatio(r) > 0.3 ? r : '', hit, e, 'cards', `пример из карточки${c.deckId && Store.deck(c.deckId) ? ' · ' + String(Store.deck(c.deckId).name).slice(0, 30) : ''}`));
        });
      });
    }));
    const seen = new Set();
    return out.filter(it => !seen.has(it.key) && seen.add(it.key));
  }
  async function tatoebaSentences(entries, want) {
    const pick = U.shuffle(entries.filter(e => e.card)).slice(0, Math.min(14, Math.ceil(want / 2) + 5));
    const out = []; let i = 0, fails = 0, lastErr = null;
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (i < pick.length && out.length < want * 2) {
        const e = pick[i++];
        try {
          const list = await withTimeout(Sources.tatoeba({ no: e.lemma }, 6), 10000);
          let n = 0;
          list.forEach(x => {
            if (n >= 2 || !okSentence(x.no)) return;
            const hit = findTarget(x.no, e);
            if (hit) { out.push(mkItem(x.no, x.ru, hit, e, 'tatoeba', 'Tatoeba')); n++; }
          });
        } catch (err) { if (!/нет примеров/.test(err.message)) { fails++; lastErr = err; } }
      }
    }));
    return { items: out, fails, lastErr };
  }
  async function bookSentences(entries, want) {
    const recs = await books();
    if (!recs.length) throw new Error('Учебников пока нет — загрузите его: «📚 Библиотека» → «Найти книгу» → «Загрузить учебник с переводом». Или выберите другой источник');
    const sents = [];
    recs.forEach(rec => bookPages(rec).forEach(([page, text]) => {
      const flat = String(text).replace(/(\p{L})-\n(?=\p{Ll})/gu, '$1').replace(/\s*\n\s*/g, ' ');
      Study.splitSent(flat).forEach(s => { if (okSentence(s) && /[.!?]["»”]?$/.test(s)) sents.push({ s, label: `«${String(rec.title || 'учебник').slice(0, 40)}», стр. ${page}` }); });
    }));
    if (!sents.length) throw new Error('В учебнике пока нет прочитанных страниц с текстом — откройте учебник («📚 Библиотека» → «Найти книгу» → «Загрузить учебник с переводом») и пролистайте несколько страниц');
    // the words of your cards first; otherwise a frequent content word from the Kelly list
    const idx = new Map();
    entries.forEach(e => e._all.forEach(f => { if (!idx.has(f)) idx.set(f, e); }));
    const look = t => {
      if (idx.has(t)) return idx.get(t);
      for (const suf of SUFFIXES) {
        if (t.length - suf.length < 3 || !t.endsWith(suf)) continue;
        const base = t.slice(0, -suf.length);
        const e = idx.get(base) || idx.get(base + 'e');
        if (e) return e;
      }
      return null;
    };
    const out = [];
    const kellyEntries = new Map();
    for (const { s, label } of U.shuffle(sents).slice(0, 4000)) {
      if (out.length >= want * 3) break;
      const toks = tokens(s);
      let hit = null, e = null;
      for (const x of U.shuffle(toks)) { const m = look(low(x.w)); if (m) { hit = x; e = m; break; } }
      if (!hit && kelly) {
        const cands = toks.filter(x => { const k = kelly.idx.get(low(x.w)); return k && x.w.length >= 3 && k.rank >= 20 && ['n', 'v', 'adj'].includes(mainPos(k.pos)); });
        if (cands.length) {
          hit = cands[Math.floor(Math.random() * cands.length)];
          const w = low(hit.w), k = kelly.idx.get(w);
          e = kellyEntries.get(w) || prepEntry({ lemma: w, pos: mainPos(k.pos), ru: '', en: k.en, forms: {}, kelly: true });
          kellyEntries.set(w, e);
        }
      }
      if (hit) out.push(mkItem(s, '', { answer: hit.w, start: hit.i, end: hit.i + hit.w.length }, e, 'book', label));
    }
    return out;
  }

  /* distractors: other words of the same part of speech, put into the same form when possible */
  function inflectLike(answerLow, e, d) {
    const slot = slotOf(e, answerLow);
    if (slot && d.forms && d.forms[slot] && d.forms[slot][0]) return d.forms[slot][0];
    if (answerLow === e.lemma) return d.lemma;
    // a noun in the definite singular: the distractor gets ITS OWN ending (bilen / jenta / huset), never «jentet»
    if (e.pos === 'n' && d.pos === 'n' && (slot === 'sd' || /(en|et|a)$/.test(answerLow) && answerLow.startsWith(e.lemma.replace(/e$/, '')) && answerLow.length - e.lemma.length <= 2)) {
      const base = d.lemma.replace(/e$/, '');
      const g = d.gender || '';
      return g === 'n' ? base + 'et' : g === 'f' || (g.includes('f') && /a$/.test(answerLow)) ? base + 'a' : base + 'en';
    }
    const stemA = e.pos === 'v' && /e$/.test(e.lemma) ? e.lemma.slice(0, -1) : e.lemma;
    if (answerLow.startsWith(stemA)) {
      const suf = answerLow.slice(stemA.length);
      if (SUFFIXES.includes(suf)) {
        let stemD = d.lemma;
        if (d.pos === 'v' && /e$/.test(d.lemma)) stemD = d.lemma.slice(0, -1);
        else if (/e$/.test(d.lemma) && /^e/.test(suf)) stemD = d.lemma.slice(0, -1);
        return stemD + suf;
      }
    }
    return d.lemma;
  }
  function distractors(it, pool) {
    const ans = low(it.answer);
    const e = it.e;
    const same = pool.filter(d => d.lemma !== e.lemma && (!e.pos || d.pos === e.pos));
    const cands = same.map(d => inflectLike(ans, e, d));
    if (cands.length < 8 && kelly) {
      const p = e.pos || '';
      kelly.words.filter(k => k.rank > 30 && k.rank < 3000 && (!p || mainPos(k.pos) === p) && Math.abs(k.w.length - ans.length) <= 3).slice(0, 400)
        .forEach(k => cands.push(inflectLike(ans, e, { lemma: low(k.w), pos: mainPos(k.pos), forms: {} })));
    }
    if (cands.length < 3) pool.filter(d => d.lemma !== e.lemma && !same.includes(d)).forEach(d => cands.push(inflectLike(ans, e, d)));
    const seen = new Set([fold(ans)]);
    const scored = U.shuffle(cands).filter(w => w && WORD_RE.test(w)).map(w => ({ w, s: Math.abs(w.length - ans.length) + Math.random() * 2.5 })).sort((a, b) => a.s - b.s);
    const out = [];
    for (const { w } of scored) { if (out.length >= 3) break; const f = fold(w); if (seen.has(f)) continue; seen.add(f); out.push(w); }
    const cap = /^\p{Lu}/u.test(it.answer);
    return out.map(w => cap ? w.charAt(0).toUpperCase() + w.slice(1) : w);
  }
  /** sentences without a translation: the shared translation cache first, then the translators (when online) */
  async function fillTranslations(list) {
    list.forEach(it => { if (!it.ru) { const t = Study.sentTr(it.no); if (t) { it.ru = t; it.mt = true; } } });
    const need = list.filter(it => !it.ru);
    if (!need.length || offline()) return;
    try {
      const res = await Translators.translateMany(need.map(it => it.no), 'no', 'ru');
      const c = Study.exCache();
      need.forEach((it, i) => { const t = String(res.out[i] || '').trim(); if (t) { it.ru = t; it.mt = true; it.by = res.by; c['s:' + it.no] = t; } });
      Study.exSave();
    } catch (e) { /* the hint stays empty — the exercise still works */ }
  }

  async function buildCloze(src, n) {
    try { await loadKelly(); } catch (e) { /* distractors from the cards only */ }
    const entries = entriesFromCards();
    let pool;
    if (src === 'tatoeba') {
      if (offline()) throw new Error('Для Tatoeba нужен интернет — выберите «Мои карточки» или «Мой учебник»');
      if (!entries.length) throw new Error('Сначала добавьте карточки со словами — Tatoeba ищет предложения именно с ними');
      const r = await tatoebaSentences(entries, n);
      pool = r.items;
      if (!pool.length) throw new Error(r.fails ? `Tatoeba не ответила: ${netMsg(r.lastErr)}` : 'Tatoeba не нашла предложений с русским переводом для ваших слов — попробуйте ещё раз');
    } else if (src === 'book') pool = await bookSentences(entries, n);
    else {
      pool = cardSentences(entries);
      if (!pool.length) throw new Error('В ваших карточках пока нет примеров с этими словами. Добавьте примеры (💬) к карточкам — или выберите Tatoeba / учебник');
    }
    const P = prog().cloze;
    const scored = pool.map(it => { const p = P[it.key]; return { it, s: Math.random() + (p ? (p.bad > p.ok ? 0.8 : 0) - (p.ok >= 4 ? 0.6 : 0) : 0.3) }; }).sort((a, b) => b.s - a.s);
    const out = [], seen = new Set(), per = {};
    [2, 99].forEach(limit => scored.forEach(({ it }) => {
      if (out.length >= n || seen.has(it.key) || (per[it.e.lemma] || 0) >= limit) return;
      seen.add(it.key); per[it.e.lemma] = (per[it.e.lemma] || 0) + 1; out.push(it);
    }));
    await fillTranslations(out);
    const dpool = entries.concat(STRONG.filter(s => !entries.some(e => e.lemma === s.lemma)).map(s => prepEntry(Object.assign({}, s))));
    return out.map(it => clozeItem(it, dpool));
  }
  function clozeItem(it, dpool) {
    const p = prog().cloze[it.key];
    const step = p && p.ok >= 2 ? 2 : 1;
    const e = it.e;
    const slot = slotOf(e, it.answer);
    const cap = /^\p{Lu}/u.test(it.answer);
    const variants = slot && e.forms[slot] ? e.forms[slot].map(v => cap ? v.charAt(0).toUpperCase() + v.slice(1) : v) : [];
    const options = step === 1 ? U.shuffle([it.answer].concat(distractors(it, dpool))) : [];
    // the other words shown as answers — the user may not know them either: they can become cards too
    const others = options.filter(o => low(o) !== low(it.answer)).map(form => {
      const f = low(form);
      const en = dpool.find(x => x.lemma === f || Object.values(x.forms || {}).some(arr => (arr || []).some(v => low(v) === f)));
      return { form, e: en || null };
    }).filter(x => x.e || (kelly && kelly.idx.has(low(x.form)))); // a form guessed by analogy («formr») is not a word to make a card of
    const gap = (filled) => filled
      ? `<span class="dr-gap ${filled.ok ? 'ok' : 'bad'}">${esc(filled.text)}</span>`
      : `<span class="dr-gap" style="min-width:${Math.max(3, it.answer.length) + 1}ch" aria-label="пропущенное слово">&nbsp;</span>`;
    const sent = filled => `<div class="dr-sent" lang="nb">${esc(it.no.slice(0, it.start))}${gap(filled)}${esc(it.no.slice(it.end))}</div>`;
    return {
      key: it.key, data: it, kind: 'cloze', others,
      mode: step === 1 && options.length >= 2 ? 'choice' : 'type',
      options, correct: [it.answer].concat(variants.filter(v => v !== it.answer)),
      head: it.ru
        ? `<div class="dr-hint"><span class="dr-flag" aria-hidden="true">🇷🇺</span><span class="ru-text">${esc(it.ru)}</span>${it.mt ? '<span class="dr-mt" title="Перевод сделан машинным переводчиком — может быть неточным">машинный перевод</span>'
          : `<button type="button" class="dr-lit-btn" data-lit title="Это перевод человека — по смыслу (часто поговорка). Показать перевод слово в слово">🔎 дословно</button>`}</div><div class="dr-lit" data-lit-out hidden></div>`
        : '<div class="dr-hint muted">Перевода нет (нужен интернет) — угадайте слово по смыслу</div>',
      body: sent,
      meta: `<span class="chip">${it.src === 'tatoeba' ? '🌐' : it.src === 'book' ? '📘' : '🗂'} ${esc(it.label)}</span><span class="chip ${step === 2 ? 'learning' : 'new'}">${step === 2 ? 'Шаг 2 · впишите слово' : 'Шаг 1 · выберите'}</span>`,
      explain: () => {
        const parts = [];
        if (e.ru || e.en) parts.push(`<b lang="nb">${esc(dispLemma(e))}</b> — <span class="ru-text">${esc(e.ru || e.en)}</span>`);
        if (slot && SLOT_RU[slot] && low(it.answer) !== e.lemma) parts.push(`форма: ${SLOT_RU[slot]}`);
        if (e.pos === 'v' && slot === 'past' && verbKind(e) !== 'weak') parts.push(`сильный глагол: прошедшее — <b lang="nb">${esc((e.forms.past || [])[0] || it.answer)}</b>`);
        return parts.join(' · ');
      },
      say: it.no, saveable: true,
      summary: `<div lang="nb">${esc(it.no.slice(0, it.start))}<b class="dr-hl">${esc(it.answer)}</b>${esc(it.no.slice(it.end))}</div>${it.ru ? `<div class="small ru-text">${esc(it.ru)}</div>` : ''}`,
    };
  }
  /* ---------- ➕ «Создать карточку» from an exercise (CardMaker: automatically or by hand, always with the source) ---------- */
  const POS_WC = { v: 'verb', n: 'substantiv', adj: 'adjektiv' };
  function cardSpec(item) {
    const e = item.data.e;
    const wordNote = e.card ? 'ваша карточка' : 'словарь приложения';
    if (item.kind === 'cloze') {
      const d = item.data, tat = d.src === 'tatoeba';
      const srcName = tat ? 'Tatoeba' : d.src === 'book' ? 'ваш учебник' : 'ваша карточка';
      const sentBy = d.mt ? (d.by && d.by.length ? d.by : ['google']) : [];
      return {
        key: 'cloze', deck: DECK_SENT, deckDesc: 'Предложения и слова из упражнений «✍️ Вставь слово»', tags: ['drill', 'cloze'], pick: 'sent',
        source: { by: tat ? 'tr:tatoeba' : 'import', label: `упражнение «Вставь слово» · ${tat ? 'Tatoeba (tatoeba.org, CC BY 2.0 FR)' : d.label}`, url: tat ? 'https://tatoeba.org/ru/sentences/search?from=nob&query=' + encodeURIComponent(d.no) : '', name: srcName },
        groups: { other: '🔤 Другие слова из вариантов ответа — если не знаете их, добавьте тоже' },
        options: [
          { id: 'sent', kind: 'sent', label: '💬 Предложение целиком', no: d.no, ru: d.ru, by: sentBy, byNote: srcName, wordClass: 'uttrykk', description: `✍️ Пропущенное слово: ${d.answer}${e.ru ? ' — ' + e.ru : ''}` },
          { id: 'word', kind: 'word', label: `🔤 Слово из пропуска${low(d.answer) !== e.lemma ? ` (в предложении: ${d.answer})` : ''}`, no: dispLemma(e), ru: e.ru || '', by: [], byNote: wordNote,
            example: d.no, exampleRu: d.ru, exBy: sentBy, exNote: srcName, wordClass: POS_WC[e.pos] || '', description: low(d.answer) !== e.lemma ? `в предложении: ${d.answer}` : '' },
          ...(item.others || []).map((x, k) => {
            const oe = x.e;
            return {
              id: 'o' + k, kind: 'word', group: 'other', label: oe && low(x.form) !== oe.lemma ? `в упражнении: ${x.form}` : 'вариант ответа',
              no: oe ? dispLemma(oe) : x.form, ru: (oe && oe.ru) || '', by: [], byNote: oe && oe.card ? 'ваша карточка' : 'словарь приложения',
              wordClass: oe ? POS_WC[oe.pos] || '' : '', description: oe && low(x.form) !== oe.lemma ? `форма в упражнении: ${x.form}` : '',
            };
          }),
        ],
      };
    }
    // 🔤 forms: the word with all its forms
    const line = e.pos === 'v' ? verbLine(e) : e.pos === 'n' ? nounLine(e) : adjLine(e);
    const isSent = /^\p{Lu}.*[.!?]$/u.test(item.say || '');
    const builtin = STRONG.some(s => s.lemma === e.lemma) && !e.card;
    return {
      key: 'forms', deck: DECK_WORDS, deckDesc: 'Слова из упражнения «🔤 Формы слов» — со всеми формами', tags: ['drill', 'forms'],
      source: { by: 'import', label: `упражнение «Формы слов» · ${builtin ? 'встроенный список сильных глаголов' : e.card ? 'ваша карточка, формы — словарь Ordbøkene' : 'словарь Ordbøkene'}`, name: wordNote },
      options: [{ id: 'word', kind: 'word', label: '🔤 Слово со всеми формами', no: dispLemma(e), ru: e.ru || '', by: [], byNote: wordNote, example: isSent ? item.say : '', wordClass: POS_WC[e.pos] || '', description: `📚 Формы: ${line}` }],
    };
  }
  function makeCard(item, ctx, btn) {
    CardMaker.open(Object.assign(cardSpec(item), {
      onDone: cards => {
        ctx.dirty = true;
        if (btn && btn.isConnected) { btn.classList.add('done'); btn.innerHTML = btn.dataset.short != null ? '✓' : `✓ ${cards.length > 1 ? U.cards(cards.length) : 'Карточка создана'}`; }
      },
    }));
  }

  /* ================= 🔤 FORMS ================= */
  const SLOT_RU = {
    inf: 'инфинитив', pres: 'настоящее время (presens)', past: 'прошедшее время (preteritum)', perf: 'причастие для перфекта (har …)', imp: 'повелительное наклонение',
    si: 'неопр. ед. ч.', sd: 'определённая форма ед. ч. (bestemt entall)', pi: 'мн. ч., неопределённая форма', pd: 'мн. ч., определённая форма',
    am: 'м./ж. род', an: 'средний род (et-слово)', adef: 'определённая форма', apl: 'множественное число', cmp: 'сравнительная степень (komparativ)', sup: 'превосходная степень (superlativ)', supd: 'превосходная, опр. форма',
  };
  const f1 = (e, s) => ((e.forms || {})[s] || [])[0] || '';
  const artOf = g => !g ? '' : g.includes('f') ? 'ei' : g.includes('m') ? 'en' : 'et';
  function dispLemma(e) {
    if (e.pos === 'v') return 'å ' + e.lemma;
    if (e.pos === 'n' && e.gender) return `${e.gender.includes('f') ? 'ei/en' : artOf(e.gender)} ${e.lemma}`;
    return e.lemma;
  }
  function verbKind(e) {
    if (e.kind === 'modal' || e.kind === 'irr' || e.kind === 'strong') return e.kind;
    const inf = f1(e, 'inf') || e.lemma, past = f1(e, 'past');
    if (!past) return '';
    const stem = /e$/.test(inf) && inf.length > 2 ? inf.slice(0, -1) : inf;
    const stems = [stem, stem.replace(/(.)\1$/, '$1')];
    for (const [suf] of [['et'], ['a'], ['dde'], ['te'], ['de']]) if (stems.some(s => past === s + suf)) return 'weak';
    return 'strong';
  }
  function weakGroup(e) {
    const inf = f1(e, 'inf') || e.lemma, past = f1(e, 'past');
    const stem = /e$/.test(inf) && inf.length > 2 ? inf.slice(0, -1) : inf;
    const s2 = stem.replace(/(.)\1$/, '$1');
    if (past === stem + 'et' || past === stem + 'a') return '-et (kaste — kastet)';
    if (past === stem + 'dde' || past === s2 + 'dde') return '-dde (bo — bodde)';
    if (past === stem + 'te' || past === s2 + 'te') return '-te (lese — leste)';
    if (past === stem + 'de' || past === s2 + 'de') return '-de (leve — levde)';
    return '';
  }
  const verbLine = e => `${f1(e, 'inf') || e.lemma} — ${f1(e, 'pres')} — ${f1(e, 'past')} — har ${f1(e, 'perf')}`;
  function verbExplain(e, slot) {
    const k = verbKind(e);
    const all = s => (e.forms[s] || []).join(' / ');
    const line = `<span lang="nb">${esc(verbLine(e))}</span>`;
    if (k === 'modal') return `модальный глагол: настоящее — <b lang="nb">${esc(all('pres'))}</b> (без -r), после него инфинитив без «å». ${line}`;
    if (k === 'weak') return `слабый глагол, группа ${esc(weakGroup(e) || '')}: ${line}`;
    const what = { past: 'прошедшее', perf: 'причастие', pres: 'настоящее', inf: 'инфинитив' }[slot] || SLOT_RU[slot] || '';
    return `${k === 'irr' ? 'неправильный глагол' : 'сильный глагол'}: ${what} — <b lang="nb">${esc(all(slot))}</b>. Формы нужно запомнить: ${line}`;
  }
  const nounLine = e => [`${artOf(e.gender)} ${e.lemma}`, f1(e, 'sd'), f1(e, 'pi'), f1(e, 'pd')].filter(Boolean).join(' — ');
  function nounExplain(e, slot) {
    const g = e.gender || '';
    const notes = [];
    if (g.includes('f')) notes.push(`женский род: <b lang="nb">ei ${esc(e.lemma)}</b> (в bokmål можно и <span lang="nb">en ${esc(e.lemma)}</span>) — опр. форма <span lang="nb">${esc((e.forms.sd || []).join(' / '))}</span>`);
    else if (g === 'n') notes.push(`средний род: <b lang="nb">et ${esc(e.lemma)}</b> — такие слова лучше учить наизусть`);
    else if (g.includes('m')) notes.push(`мужской род: <b lang="nb">en ${esc(e.lemma)}</b>`);
    const pi = f1(e, 'pi');
    if (slot !== 'art' && pi) {
      if (g === 'n' && pi === e.lemma) notes.push('у коротких слов среднего рода мн. ч. без окончания');
      else if (![e.lemma + 'er', e.lemma + 'r', e.lemma.replace(/e$/, '') + 'er'].includes(pi)) notes.push(`неправильное мн. число: <b lang="nb">${esc(pi)}</b>`);
    }
    notes.push(`<span lang="nb">${esc(nounLine(e))}</span>`);
    return notes.join(' · ');
  }
  const adjLine = e => [f1(e, 'am'), f1(e, 'an'), f1(e, 'apl')].filter(Boolean).join(' — ') + (f1(e, 'cmp') ? ` · ${f1(e, 'cmp')} — ${f1(e, 'sup')}` : '');
  function adjExplain(e, slot) {
    const am = f1(e, 'am'), an = f1(e, 'an');
    let rule = '';
    if (slot === 'an') rule = an === am ? `слово не меняется в среднем роде (так у прилагательных на -ig, -isk, -sk и некоторых других): <b lang="nb">et ${esc(an)}</b>` : `средний род (et-слово) → окончание -t: <b lang="nb">${esc(an)}</b>`;
    else if (slot === 'apl' || slot === 'adef') rule = `множественное число и определённая форма → окончание -e: <b lang="nb">${esc(f1(e, slot))}</b>`;
    else if (slot === 'am') rule = `en-слово (м./ж. род) → основная форма: <b lang="nb">${esc(am)}</b>`;
    else if (slot === 'cmp' || slot === 'sup') {
      const regular = f1(e, 'cmp') === am + 'ere' || f1(e, 'cmp') === am.replace(/e$/, '') + 'ere';
      rule = `${regular ? 'сравнение: -ere / -est' : 'неправильные степени сравнения'}: <b lang="nb">${esc(f1(e, 'cmp'))} — ${esc(f1(e, 'sup'))}</b>`;
    }
    return `${rule} · <span lang="nb">${esc(adjLine(e))}</span>`;
  }
  const VERB_CTX = {
    past: { s: 'I går ___ hun.', why: '«i går» (вчера) → прошедшее время' },
    pres: { s: 'Hver dag ___ hun.', why: '«hver dag» (каждый день) → настоящее время' },
    perf: { s: 'Hun har allerede ___.', why: 'после «har» → причастие (перфект)' },
    inf: { s: 'Hun vil ___.', why: 'после «vil» (модальный глагол) → инфинитив без «å»' },
  };
  const ADJ_CTX = {
    am: { s: 'Bilen er ___.', why: '«bilen» — en-слово → основная форма' },
    an: { s: 'Huset er ___.', why: '«huset» — et-слово → средний род' },
    apl: { s: 'Husene er ___.', why: '«husene» — множественное число' },
  };
  const gapHtml = (filled, len) => filled ? `<span class="dr-gap ${filled.ok ? 'ok' : 'bad'}">${esc(filled.text)}</span>` : `<span class="dr-gap" style="min-width:${len + 1}ch">&nbsp;</span>`;
  const sentWithGap = (tpl, filled, len) => { const [a, b] = tpl.split('___'); return `<div class="dr-sent" lang="nb">${esc(a)}${gapHtml(filled, len)}${esc(b || '')}</div>`; };
  function wordHead(e) {
    return `<div class="dr-word"><b lang="nb">${esc(dispLemma(e))}</b>${e.ru ? ` <span class="dr-dash">—</span> <span class="ru-text">${esc(e.ru)}</span>` : ''}${POS_LONG[e.pos] ? `<span class="chip">${POS_LONG[e.pos]}</span>` : ''}</div>`;
  }
  function formsItem(e, type) {
    const key = 'f:' + e.lemma + ':' + type;
    const base = { key, kind: 'forms', data: { e }, saveable: false, head: wordHead(e) };
    const ask = t => `<div class="dr-ask">${t}</div>`;
    const maxLen = arr => Math.max(3, ...arr.map(x => x.length));
    if (type.startsWith('vt:')) { // type a verb form
      const slot = type.slice(3), ans = e.forms[slot];
      const tpl = { pres: 'Nå ___ jeg.', past: 'I går ___ jeg.', perf: 'Jeg har ___.' }[slot];
      return Object.assign(base, { mode: 'type', correct: ans, body: f => ask(`Впишите: ${SLOT_RU[slot]}`) + sentWithGap(tpl, f, maxLen(ans)),
        explain: () => verbExplain(e, slot), say: tpl.replace('___', ans[0]), summary: `<span lang="nb">${esc(verbLine(e))}</span>` });
    }
    if (type.startsWith('vc:')) { // which form fits the sentence
      const slot = type.slice(3), c = VERB_CTX[slot];
      const opts = U.shuffle([...new Set(['inf', 'pres', 'past', 'perf'].map(s => f1(e, s)).filter(Boolean))]);
      return Object.assign(base, { mode: 'choice', options: opts, correct: e.forms[slot], body: f => ask('Какая форма подходит?') + sentWithGap(c.s, f, maxLen(opts)),
        explain: () => `${c.why}: <b lang="nb">${esc(f1(e, slot))}</b> · ${verbExplain(e, slot)}`, say: c.s.replace('___', f1(e, slot)), summary: `<span lang="nb">${esc(c.s.replace('___', f1(e, slot)))}</span><div class="small muted" lang="nb">${esc(verbLine(e))}</div>` });
    }
    if (type === 'na') { // choose the article
      const g = e.gender, ok = [];
      if (g.includes('m') || g.includes('f')) ok.push('en');
      if (g.includes('f')) ok.push('ei');
      if (g.includes('n')) ok.push('et');
      const show = Object.assign({}, e, { pos: '' }); // the head must not give the article away
      return Object.assign(base, { head: wordHead(show), mode: 'choice', options: ['en', 'ei', 'et'], fixedOrder: true, correct: ok,
        body: f => ask('Какой артикль?') + `<div class="dr-sent" lang="nb">${gapHtml(f, 2)} ${esc(e.lemma)}</div>`,
        explain: () => nounExplain(e, 'art'), say: `${artOf(g)} ${e.lemma}`, summary: `<span lang="nb">${esc(nounLine(e))}</span>` });
    }
    if (type.startsWith('nt:')) {
      const slot = type.slice(3), ans = e.forms[slot];
      const tpl = { sd: `${artOf(e.gender)} ${e.lemma} → ___`, pi: `${artOf(e.gender)} ${e.lemma} → to ___`, pd: `${f1(e, 'pi') || e.lemma} → alle ___` }[slot];
      const hint = { sd: 'определённая форма ед. ч. («эта/та …»)', pi: 'множественное число («два …»)', pd: 'мн. ч., определённая форма («все эти …»)' }[slot];
      return Object.assign(base, { mode: 'type', correct: ans, body: f => ask(`Впишите: ${hint}`) + sentWithGap(tpl, f, maxLen(ans)),
        explain: () => nounExplain(e, slot), say: tpl.replace(' → ', ', ').replace('___', ans[0]), summary: `<span lang="nb">${esc(nounLine(e))}</span>` });
    }
    if (type.startsWith('ac:')) {
      const slot = type.slice(3), c = ADJ_CTX[slot];
      const opts = U.shuffle([...new Set(['am', 'an', 'apl'].map(s => f1(e, s)).filter(Boolean))]);
      return Object.assign(base, { mode: 'choice', options: opts, correct: e.forms[slot], body: f => ask('Какая форма подходит?') + sentWithGap(c.s, f, maxLen(opts)),
        explain: () => `${c.why}: <b lang="nb">${esc(f1(e, slot))}</b> · ${adjExplain(e, slot)}`, say: c.s.replace('___', f1(e, slot)), summary: `<span lang="nb">${esc(c.s.replace('___', f1(e, slot)))}</span><div class="small muted" lang="nb">${esc(adjLine(e))}</div>` });
    }
    if (type.startsWith('at:')) {
      const slot = type.slice(3), ans = e.forms[slot];
      const tpl = { an: 'et ___ hus', apl: 'to ___ hus', adef: 'det ___ huset', cmp: 'Huset er ___ enn bilen.', sup: 'Dette huset er ___.' }[slot];
      return Object.assign(base, { mode: 'type', correct: ans, body: f => ask(`Впишите: ${SLOT_RU[slot]}`) + sentWithGap(tpl, f, maxLen(ans)),
        explain: () => adjExplain(e, slot), say: tpl.replace('___', ans[0]), summary: `<span lang="nb">${esc(adjLine(e))}</span>` });
    }
    return null;
  }
  /** which exercise types this word supports */
  function formTypes(e) {
    const t = [], has = s => !!f1(e, s);
    if (e.pos === 'v') {
      // modal verbs only in the typing exercise: «Hver dag skal hun» / «Hun vil ville» are not natural sentences
      const ctx = e.kind !== 'modal';
      if (has('past')) t.push('vt:past', 'vt:past', ...(ctx ? ['vc:past'] : []));
      if (has('perf')) t.push('vt:perf', ...(ctx ? ['vc:perf'] : []));
      if (has('pres')) t.push('vt:pres', ...(ctx ? ['vc:pres'] : []));
      if (ctx && has('inf') && has('past') && has('pres')) t.push('vc:inf');
    } else if (e.pos === 'n') {
      if (e.gender) t.push('na', 'na');
      if (has('sd')) t.push('nt:sd');
      if (has('pi')) t.push('nt:pi');
      if (has('pd') && has('pi')) t.push('nt:pd');
    } else if (e.pos === 'adj') {
      if (has('an') && has('am')) t.push('ac:an', 'at:an');
      if (has('apl')) t.push('ac:apl', 'at:apl');
      if (has('am') && has('apl')) t.push('ac:am');
      if (has('adef') && f1(e, 'adef') !== f1(e, 'apl')) t.push('at:adef');
      if (has('cmp') && has('sup')) t.push('at:cmp', 'at:sup');
    }
    return t;
  }
  const usable = e => formTypes(e).length > 0 && !(e.pos === 'n' && !e.gender && !f1(e, 'sd'));
  async function buildForms(o) {
    const types = new Set(o.types && o.types.length ? o.types : ['v', 'n', 'adj']);
    let pool = [];
    let note = '';
    if (o.src !== 'mine' && types.has('v')) pool.push(...STRONG.map(s => prepEntry(Object.assign({}, s, { forms: Object.assign({}, s.forms) }))));
    if (o.src !== 'builtin') {
      try { await loadKelly(); } catch (e) { /* pos from the cards only */ }
      const mine = entriesFromCards().filter(e => !e.pos || types.has(e.pos));
      // forms the card already has, or Ordbøkene (cached on the device after the first time)
      const P = prog().forms;
      const pri = e => { let b = 0; Object.keys(P).forEach(k => { if (k.startsWith('f:' + e.lemma + ':')) b += P[k].bad - P[k].ok * 0.3; }); return b + Math.random(); };
      const todo = [];
      mine.forEach(e => {
        const c = cachedParadigm(e.lemma, e.pos);
        if (c !== undefined) mergeParadigm(e, c);
        else if (!usable(e) || (e.pos === 'v' && !e.forms.past) || (e.pos === 'n' && !e.gender)) todo.push(e);
      });
      const budget = todo.sort((a, b) => pri(b) - pri(a)).slice(0, 36);
      if (budget.length && !offline()) {
        const busy = UI.busy('Ищу формы слов в словаре Ordbøkene…');
        let i = 0, done = 0, fails = 0;
        try {
          await Promise.all(Array.from({ length: 4 }, async () => {
            while (i < budget.length) {
              const e = budget[i++];
              try { mergeParadigm(e, await paradigm(e.lemma, e.pos)); } catch (err) { fails++; }
              busy.set(`${++done} из ${budget.length}`, done, budget.length);
            }
          }));
        } finally { busy.close(); }
        if (fails > budget.length / 2) note = 'Словарь Ordbøkene ответил не на все запросы — часть ваших слов пропущена';
      } else if (budget.length) note = 'Без интернета — только слова, формы которых уже сохранены';
      const have = new Set(pool.map(e => e.lemma));
      mine.forEach(e => { if (types.has(e.pos) && usable(e)) { if (have.has(e.lemma)) pool = pool.filter(x => x.lemma !== e.lemma); pool.push(e); have.add(e.lemma); } });
    }
    pool = pool.filter(e => types.has(e.pos) && usable(e));
    if (!pool.length) {
      if (o.src === 'builtin' && !types.has('v')) throw new Error('Встроенный список — это сильные глаголы. Включите «Глаголы» или выберите «Мои карточки»');
      throw new Error(note || 'Среди ваших карточек не нашлось слов выбранных частей речи с формами. Попробуйте «Встроенные глаголы»');
    }
    const P = prog().forms;
    const weight = (e, t) => { const p = P['f:' + e.lemma + ':' + t]; return Math.random() + (p ? (p.bad > p.ok ? 1 : 0) - (p.ok >= 3 && !p.bad ? 0.5 : 0) : 0.2); };
    const n = o.n || 15;
    const cands = [];
    pool.forEach(e => { const ts = U.shuffle(formTypes(e)); ts.slice(0, 2).forEach((t, k) => cands.push({ e, t, w: weight(e, t) - k * 0.6 })); });
    cands.sort((a, b) => b.w - a.w);
    const out = [], used = {}, seenKey = new Set();
    [1, 2].forEach(limit => cands.forEach(c => {
      if (out.length >= n || (used[c.e.lemma] || 0) >= limit) return;
      const it = formsItem(c.e, c.t);
      if (!it || seenKey.has(it.key) || !it.correct || !it.correct.length) return;
      seenKey.add(it.key); used[c.e.lemma] = (used[c.e.lemma] || 0) + 1; out.push(it);
    }));
    return { items: U.shuffle(out), note };
  }

  /* ================= session runner (shared by cloze and forms) ================= */
  const navHtml = (label = '← Все упражнения') => `<div class="dr-nav"><button class="btn sm ghost" data-dr-back>${label}</button></div>`;
  function runSession(ctx, kind, items, again) {
    const S = { q: items.map(it => Object.assign({}, it)), total: items.length, first: 0, results: [], answered: false, cur: null, given: '' };
    ctx.inSession = () => S.results.length > 0 && S.q.length > 0 && !S.over;
    const okN = () => S.results.filter(r => r.ok).length;
    const typeHtml = () => `<div class="dr-type">
        <input class="input dr-input" data-inp lang="nb" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="Впишите слово" aria-label="Ответ">
        <div class="dr-keys" role="group" aria-label="Норвежские буквы">${['æ', 'ø', 'å'].map(k => `<button type="button" class="dr-key" data-key="${k}" aria-label="Вставить ${k}">${k}</button>`).join('')}</div>
        <div class="dr-type-act"><button class="btn ghost" data-dontknow>Не знаю</button><button class="btn ghost" data-hint title="Показать первую букву">💡 Подсказка</button><button class="btn primary" data-check>Проверить</button></div>
      </div>`;
    const choiceHtml = it => `<div class="quiz-opts dr-opts">${it.options.map((o, i) => `<button class="quiz-opt dr-opt" data-opt="${i}" lang="nb"><span class="n">${i + 1}</span><span class="dr-opt-t">${esc(o)}</span></button>`).join('')}</div>`;
    const bar = () => `<div class="dr-bar"><div class="dr-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${S.total}" aria-valuenow="${S.first}"><i style="width:${Math.round(S.first / S.total * 100)}%"></i></div>
      <span class="dr-count">${Math.min(S.first + 1, S.total)} / ${S.total}</span><span class="dr-score"><span class="ok">✓ ${okN()}</span><span class="bad">✗ ${S.results.length - okN()}</span></span></div>`;
    const show = () => {
      if (!S.q.length) { finish(); return; }
      const it = S.q[0]; S.cur = it; S.answered = false; S.given = '';
      ctx.body.innerHTML = `${navHtml('← Закончить')}${bar()}
        <div class="dr-card" data-card>${it.head || ''}<div class="dr-q" data-q>${it.body(null)}</div>
          <div class="dr-meta">${it.meta || ''}${it.retry ? '<span class="chip debt">повтор ошибки</span>' : ''}${CardMaker.btn('➕ Создать карточку', 'btn sm dr-mk', 'data-mk')}</div></div>
        <div class="dr-ans" data-ans>${it.mode === 'choice' ? choiceHtml(it) : typeHtml()}</div>
        <div class="dr-fb" data-fb aria-live="polite"></div>`;
      const inp = ctx.body.querySelector('[data-inp]');
      if (inp) {
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (!S.answered) checkTyped(); } });
        setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 60);
      }
      ctx.body.querySelectorAll('.dr-key').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
      const mb = ctx.m.$('.modal-body'); if (mb) mb.scrollTop = 0;
    };
    const checkTyped = () => {
      const inp = ctx.body.querySelector('[data-inp]'); if (!inp) return;
      const v = inp.value.trim();
      if (!v) { inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 450); inp.focus(); return; }
      const r = judge(v, S.cur.correct);
      answer(v, r.ok, r.how, r.best);
    };
    const answer = (given, ok, how, best) => {
      if (S.answered) return;
      S.answered = true; S.given = given;
      const it = S.cur;
      if (!it.retry) { S.first++; S.results.push({ it, ok, given }); bump(kind, it.key, ok); }
      if (!ok && !it.retry) S.q.push(Object.assign({}, it, { retry: true, mode: it.mode === 'choice' && it.options.length ? 'choice' : 'type' }));
      try { if (navigator.vibrate) navigator.vibrate(ok ? 12 : [18, 40, 18]); } catch (e) { /* ignore */ }
      const right = best || it.correct[0];
      ctx.body.querySelector('[data-q]').innerHTML = it.body({ text: right, ok });
      const inp = ctx.body.querySelector('[data-inp]');
      if (inp) { inp.readOnly = true; inp.classList.add(ok ? 'ok' : 'bad'); }
      ctx.body.querySelectorAll('[data-check],[data-dontknow],[data-hint],.dr-key').forEach(b => { b.disabled = true; });
      ctx.body.querySelectorAll('[data-opt]').forEach(b => {
        b.disabled = true;
        const val = it.options[+b.dataset.opt];
        if (it.correct.some(c => low(c) === low(val))) b.classList.add('correct');
        else if (val === given) b.classList.add('wrong');
      });
      const altRight = it.correct.filter(c => low(c) !== low(right));
      const msg = ok
        ? `<b>✅ Верно!</b>${how === 'nordic' ? ` <span class="small">Засчитано — но правильно пишется <b lang="nb">${esc(right)}</b> (буквы æ ø å)</span>` : how === 'typo' ? ` <span class="small">Засчитано с опечаткой: <span class="dr-diff" lang="nb">${U.diffHtml(given, right)}</span></span>` : ''}`
        : `<b>❌ ${given ? 'Неверно' : 'Ответ'}:</b> <b lang="nb" class="dr-right">${esc(right)}</b>${given && it.mode === 'type' ? ` <span class="small muted">· ваш ответ: <span class="dr-diff" lang="nb">${U.diffHtml(given, right)}</span></span>` : ''}`;
      const ex = it.explain ? it.explain(ok) : '';
      ctx.body.querySelector('[data-fb]').innerHTML = `<div class="dr-fb-box ${ok ? 'ok' : 'bad'}">
        <div class="dr-fb-line">${msg}${altRight.length && it.mode === 'type' ? ` <span class="small muted">· можно и: <span lang="nb">${esc(altRight.join(', '))}</span></span>` : ''}</div>
        ${ex ? `<div class="dr-explain">💡 ${ex}</div>` : ''}
        <div class="dr-fb-act"><button class="media-btn sm" data-say title="Прослушать" aria-label="Прослушать по-норвежски">${SPK(17)}</button>
          ${CardMaker.btn(it.kind === 'cloze' ? '➕ Создать карточки' : '➕ Создать карточку', 'btn sm', 'data-mk')}
          <span class="grow"></span><button class="btn primary" data-next>Дальше →</button></div></div>`;
      if (Store.settings.autoSpeak !== false && it.say) { try { TTS.speak(it.say, 'no'); } catch (e) { /* no voice */ } }
      setTimeout(() => { const n = ctx.body.querySelector('[data-next]'); if (n) try { n.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
      const fb = ctx.body.querySelector('[data-fb]');
      if (fb && fb.scrollIntoView) setTimeout(() => { try { fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* ignore */ } }, 60);
    };
    const next = () => { if (!S.answered) return; TTS.stop(); S.q.shift(); show(); };
    const finish = () => {
      S.over = true;
      const d = prog(); const st = d.stats[kind] || (d.stats[kind] = { n: 0, ok: 0, sessions: 0 }); st.sessions = (st.sessions || 0) + 1; Store.save();
      const ok = okN(), tot = S.results.length || 1, pct = Math.round(ok / tot * 100);
      const wrong = S.results.filter(r => !r.ok);
      ctx.onKey = null;
      const mb = ctx.m.$('.modal-body'); if (mb) mb.scrollTop = 0;
      if (pct >= 80 && S.results.length >= 5) { try { UI.confetti(120); } catch (e) { /* no canvas */ } }
      ctx.body.innerHTML = `${navHtml()}
        <div class="dr-results">
          <div class="dr-ring" style="--p:${pct}"><b>${pct}%</b><span>${ok} из ${S.results.length}</span></div>
          <h3>${pct >= 90 ? '🏆 Отлично!' : pct >= 70 ? '👍 Хорошо!' : pct >= 40 ? '💪 Неплохо — повторим ошибки' : '🌱 Начало положено — ошибки повторим'}</h3>
          <div class="dr-res-act"><button class="btn primary" data-again>🔁 Ещё раз</button>${wrong.length ? `<button class="btn" data-wrong>🎯 Только ошибки (${wrong.length})</button>` : ''}<button class="btn ghost" data-dr-back>← Все упражнения</button></div>
        </div>
        <div class="dr-res-list">${S.results.map((r, i) => `<div class="dr-res-row ${r.ok ? 'ok' : 'bad'}"><span class="dr-res-ico" aria-label="${r.ok ? 'верно' : 'ошибка'}">${r.ok ? '✓' : '✗'}</span>
          <div class="dr-res-txt">${r.it.summary || ''}${!r.ok && r.given ? `<div class="small muted">ваш ответ: <span lang="nb">${esc(r.given)}</span></div>` : ''}</div>
          <button class="media-btn sm" data-say-i="${i}" title="Прослушать" aria-label="Прослушать">${SPK(16)}</button>
          ${CardMaker.btn('➕', 'btn sm', `data-mk-i="${i}" data-short aria-label="Создать карточку"`)}</div>`).join('')}</div>`;
      ctx.body.onclick = e => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.hasAttribute('data-dr-back')) { ctx.go('hub'); return; }
        if (t.hasAttribute('data-again')) { again(); return; }
        if (t.hasAttribute('data-wrong')) { runSession(ctx, kind, wrong.map(r => Object.assign({}, r.it, { retry: false })), again); return; }
        if (t.dataset.sayI != null) { const r = S.results[+t.dataset.sayI]; if (r) TTS.speak(r.it.say, 'no'); return; }
        if (t.dataset.mkI != null) { const r = S.results[+t.dataset.mkI]; if (r) makeCard(r.it, ctx, t); }
      };
    };
    ctx.body.onclick = async e => {
      const t = e.target.closest('button'); if (!t || t.disabled) return;
      if (t.hasAttribute('data-dr-back')) {
        if (S.results.length && S.q.length && (await UI.askClose({ title: 'Закончить упражнение?', line: 'Ответы уже сохранены.', actions: [{ label: 'Закончить', value: 'end', cls: 'primary' }], cancel: 'Продолжить' })) !== 'end') return;
        if (S.results.length) finish(); else ctx.go('hub');
        return;
      }
      if (t.dataset.opt != null && !S.answered) {
        const val = S.cur.options[+t.dataset.opt];
        answer(val, S.cur.correct.some(c => low(c) === low(val)), 'exact', S.cur.correct.find(c => low(c) === low(val)) || S.cur.correct[0]);
        return;
      }
      if (t.dataset.key) {
        const inp = ctx.body.querySelector('[data-inp]'); if (!inp || inp.readOnly) return;
        const a = inp.selectionStart != null ? inp.selectionStart : inp.value.length, b = inp.selectionEnd != null ? inp.selectionEnd : a;
        inp.value = inp.value.slice(0, a) + t.dataset.key + inp.value.slice(b);
        try { inp.focus({ preventScroll: true }); inp.setSelectionRange(a + 1, a + 1); } catch (err) { /* ignore */ }
        return;
      }
      if (t.hasAttribute('data-check')) { checkTyped(); return; }
      if (t.hasAttribute('data-dontknow')) { answer('', false, 'wrong', S.cur.correct[0]); return; }
      if (t.hasAttribute('data-hint')) {
        const inp = ctx.body.querySelector('[data-inp]'); const c = S.cur.correct[0] || '';
        if (inp && c) { const n = Math.min(c.length - 1, Math.max(1, inp.dataset.hints ? +inp.dataset.hints + 1 : 1)); inp.dataset.hints = n; inp.value = c.slice(0, n); inp.focus(); }
        return;
      }
      if (t.hasAttribute('data-say')) { TTS.speak(S.cur.say, 'no'); return; }
      if (t.hasAttribute('data-mk')) { makeCard(S.cur, ctx, t); return; }
      if (t.hasAttribute('data-lit')) {
        // the person's translation is «по смыслу» (often a saying) — the word-for-word one next to it, on request
        const out = ctx.body.querySelector('[data-lit-out]'); if (!out) return;
        if (!out.hidden && out.innerHTML) { out.hidden = true; t.classList.remove('on'); return; }
        const it = S.cur;
        t.disabled = true; out.hidden = false; t.classList.add('on');
        out.innerHTML = '<span class="spinner sm"></span> перевожу дословно…';
        try {
          if (!it.lit) { const r = await Translators.translateMany([it.data.no], 'no', 'ru'); it.lit = { ru: String(r.out[0] || '').trim(), by: r.by || [] }; }
          if (S.cur !== it) return;
          out.innerHTML = it.lit.ru
            ? `<span class="muted">дословно:</span> <span class="ru-text">${esc(it.lit.ru)}</span> <span class="tg-who mt" title="Машинный перевод — слово в слово, неточный">⚠️ ${esc(Translators.provNames(it.lit.by))}</span>
               <div class="tiny muted">Вверху — перевод человека (${it.data.src === 'tatoeba' ? 'Tatoeba' : 'источник'}) по смыслу: поговорки так и переводят. Дословный помогает понять каждое слово.</div>`
            : '<span class="muted">Дословный перевод не пришёл — проверьте интернет</span>';
        } catch (err) { out.innerHTML = `<span class="muted">Дословный перевод не пришёл: ${esc(err.message)}</span>`; }
        t.disabled = false;
        return;
      }
      if (t.hasAttribute('data-next')) next();
    };
    ctx.onKey = e => {
      if (!S.cur || e.metaKey || e.ctrlKey || e.altKey) return;
      const inInput = e.target && e.target.matches && e.target.matches('input, textarea, select');
      if (!S.answered && S.cur.mode === 'choice' && !inInput && /^[1-9]$/.test(e.key)) {
        const b = ctx.body.querySelector(`[data-opt="${+e.key - 1}"]`); if (b) { e.preventDefault(); b.click(); }
        return;
      }
      if (S.answered && (e.key === 'Enter' || e.key === ' ') && !(e.target && e.target.closest && e.target.closest('button'))) { e.preventDefault(); next(); }
    };
    show();
  }

  /* ================= views ================= */
  const VIEWS = {};
  const loadingHtml = t => `<div class="dr-loading"><span class="spinner"></span><span>${esc(t)}</span></div>`;
  const emptyHtml = (t, extra = '') => `${navHtml()}<div class="dr-empty"><div class="dr-empty-ico">🤔</div><p>${esc(t)}</p>${extra}</div>`;
  const pickSeg = (name, opts, cur) => `<div class="seg dr-seg" data-seg="${name}" role="group">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(v) === String(cur) ? 'active' : ''}" aria-pressed="${String(v) === String(cur)}">${l}</button>`).join('')}</div>`;
  const segPick = (root, name, b) => { root.querySelectorAll(`[data-seg="${name}"] button`).forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); }); };

  VIEWS.hub = ctx => {
    ctx.title('🏋️ Упражнения');
    const st = prog().stats;
    const stat = k => { const x = st[k]; return x && x.n ? `${Math.round(x.ok / x.n * 100)}% верно · ${x.n} ${U.plural(x.n, ['ответ', 'ответа', 'ответов'])}` : 'ещё не пробовали'; };
    const tile = (id, ico, name, desc, s) => `<button class="dr-tile" data-tool="${id}"><span class="dr-tile-ico" aria-hidden="true">${ico}</span>
      <span class="dr-tile-txt"><b>${name}</b><span>${desc}</span><small data-stat="${id}">${esc(s)}</small></span><span class="dr-tile-go" aria-hidden="true">›</span></button>`;
    ctx.body.innerHTML = `<div class="dr-hub">
        ${tile('cloze', '✍️', 'Вставь слово', 'Предложение с пропуском и переводом: выберите слово, потом впишите его сами', stat('cloze'))}
        ${tile('forms', '🔤', 'Формы слов', 'Сильные глаголы (skrive — skrev — skrevet), артикли en/ei/et, формы существительных и прилагательных', stat('forms'))}
        ${tile('next20', '🎯', 'Следующие 20 слов', 'Самые частые слова норвежского, которых ещё нет в ваших колодах — с уровнем A1–B2', '…')}
        ${window.OrdTrainer ? OrdTrainer.tilesHtml() : ''}
        ${window.Klokka ? `<button class="dr-tile kl-dr-tile" data-klokka-open><span class="dr-tile-ico" aria-hidden="true">🕐</span><span class="dr-tile-txt"><b>Klokka — время по-норвежски</b><span>«halv fire» — это 3:30, а не 4:30! Урок с часами, 4 игры, 6 уровней, очки и рекорды</span><small>${(s => s.total ? `⭐ ${s.total} очков` : 'урок + игры')(Klokka.state())}</small></span><span class="dr-tile-go" aria-hidden="true">›</span></button>` : ''}
      </div>
      <div class="tiny muted">Ответы в упражнениях не меняют расписание повторений карточек — прогресс упражнений хранится отдельно.</div>`;
    ctx.body.onclick = e => { const b = e.target.closest('[data-tool]'); if (b) ctx.go(b.dataset.tool); };
    loadKelly().then(k => {
      const el = ctx.body.querySelector('[data-stat="next20"]'); if (!el) return;
      const known = knownSet(); const top = k.words.filter(x => x.rank <= 1000);
      el.textContent = `вы знаете ≈${top.filter(x => known.has(low(x.w))).length} из первых 1000`;
    }).catch(() => { const el = ctx.body.querySelector('[data-stat="next20"]'); if (el) el.textContent = 'список загрузится, когда будет интернет'; });
  };

  VIEWS.cloze = (ctx, o) => {
    ctx.title('✍️ Вставь слово');
    const last = prog().last;
    let src = o.source || last.clozeSrc || 'cards', n = +(o.n || last.clozeN || 15);
    const entries = entriesFromCards();
    const own = cardSentences(entries);
    const P = prog().cloze;
    const step2 = Object.values(P).filter(p => p.ok >= 2).length;
    const btn = (id, ico, name, sub) => `<button type="button" class="dr-src-btn ${src === id ? 'active' : ''}" data-src="${id}" aria-pressed="${src === id}"><span class="dr-src-ico" aria-hidden="true">${ico}</span><b>${name}</b><small ${id === 'book' ? 'data-books' : ''}>${sub}</small></button>`;
    ctx.body.innerHTML = `${navHtml()}
      <div class="lib-intro">✍️ <span>В норвежском предложении пропущено слово, сверху — перевод всего предложения. <b>Шаг 1:</b> выберите слово из четырёх. Когда вы <b>дважды</b> ответите верно, предложение переходит на <b>шаг 2</b>: слово нужно вписать самому (кнопки <b>æ ø å</b> — под полем; можно писать и ae / o / aa).</span></div>
      <div class="dr-field"><div class="dr-label">Откуда взять предложения</div>
        <div class="dr-src">${btn('cards', '🗂', 'Мои карточки', `${own.length} ${U.plural(own.length, ['предложение', 'предложения', 'предложений'])} из примеров · работает без интернета`)}
        ${btn('tatoeba', '🌐', 'Tatoeba', 'живые предложения с переводом от людей · нужен интернет')}
        ${btn('book', '📘', 'Мой учебник', 'проверяю книги…')}</div></div>
      <div class="dr-field"><div class="dr-label">Сколько предложений</div>${pickSeg('n', [[10, '10'], [15, '15'], [20, '20']], n)}</div>
      <div class="dr-start"><button class="btn primary lg" data-go>▶ Начать</button><span class="small muted">${step2 ? `На шаге 2 (вписать): ${step2} ${U.plural(step2, ['предложение', 'предложения', 'предложений'])}` : ''}</span></div>
      <div class="tiny muted">Предложения Tatoeba — tatoeba.org (CC BY 2.0 FR). Предложения без готового перевода переводит машинный переводчик (или подключённая нейросеть) — перепроверяйте.</div>`;
    books().then(list => {
      const el = ctx.body.querySelector('[data-books]'); if (!el) return;
      const pages = list.reduce((s, r) => s + bookPages(r).length, 0);
      el.textContent = list.length ? `${list.length} ${U.plural(list.length, ['книга', 'книги', 'книг'])} · ${pages} ${U.plural(pages, ['страница', 'страницы', 'страниц'])} с текстом` : 'учебников пока нет — «📚 Библиотека» → «Найти книгу» → «Загрузить учебник с переводом»';
    }).catch(() => { const el = ctx.body.querySelector('[data-books]'); if (el) el.textContent = 'книги недоступны в этом браузере'; });
    const start = async () => {
      Object.assign(prog().last, { clozeSrc: src, clozeN: n }); Store.save();
      ctx.body.innerHTML = navHtml() + loadingHtml(src === 'tatoeba' ? 'Ищу предложения на Tatoeba…' : src === 'book' ? 'Читаю предложения из учебника…' : 'Собираю предложения…');
      ctx.body.onclick = e => { if (e.target.closest('[data-dr-back]')) ctx.go('hub'); };
      try {
        const items = await buildCloze(src, n);
        if (!ctx.alive()) return;
        runSession(ctx, 'cloze', items, () => ctx.go('cloze', { source: src, n, autostart: true }));
      } catch (err) {
        if (!ctx.alive()) return;
        ctx.body.innerHTML = emptyHtml(err.message, `<button class="btn" data-back-setup>← Выбрать другой источник</button>`);
        ctx.body.onclick = e => { if (e.target.closest('[data-dr-back]')) ctx.go('hub'); if (e.target.closest('[data-back-setup]')) ctx.go('cloze', { source: src, n }); };
      }
    };
    ctx.body.onclick = e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.hasAttribute('data-dr-back')) { ctx.go('hub'); return; }
      if (t.dataset.src) { src = t.dataset.src; ctx.body.querySelectorAll('[data-src]').forEach(x => { x.classList.toggle('active', x === t); x.setAttribute('aria-pressed', String(x === t)); }); return; }
      if (t.closest('[data-seg="n"]')) { n = +t.dataset.v; segPick(ctx.body, 'n', t); return; }
      if (t.hasAttribute('data-go')) start();
    };
    if (o.autostart) start();
  };

  VIEWS.forms = (ctx, o) => {
    ctx.title('🔤 Формы слов');
    const last = prog().last;
    let src = o.src || last.formsSrc || 'both', n = +(o.n || last.formsN || 15);
    const types = new Set(o.types || last.formsTypes || ['v', 'n', 'adj']);
    ctx.body.innerHTML = `${navHtml()}
      <div class="lib-intro">🔤 <span>Тренируем формы: <b lang="nb">skrive — skriver — skrev — har skrevet</b>, артикли <b lang="nb">en / ei / et</b> и формы существительных (<span lang="nb">bilen, biler, bilene</span>), согласование прилагательных (<span lang="nb">stor / stort / store</span>, <span lang="nb">større — størst</span>). После каждой ошибки — короткое объяснение.</span></div>
      <div class="dr-field"><div class="dr-label">Что тренировать</div>
        <div class="dr-chips" role="group">${[['v', 'Глаголы'], ['n', 'Существительные'], ['adj', 'Прилагательные']].map(([k, l]) => `<button type="button" class="chip dr-chip ${types.has(k) ? 'active' : ''}" data-type="${k}" aria-pressed="${types.has(k)}">${types.has(k) ? '✓ ' : ''}${l}</button>`).join('')}</div></div>
      <div class="dr-field"><div class="dr-label">Слова</div>${pickSeg('src', [['builtin', `💪 ${STRONG.length} сильных глаголов`], ['mine', '🗂 Мои карточки'], ['both', 'Всё вместе']], src)}
        <div class="small muted">Встроенные глаголы работают без интернета. Формы слов из ваших карточек берутся из самих карточек или из словаря Ordbøkene (нужен интернет в первый раз, потом сохраняются на устройстве).</div></div>
      <div class="dr-field"><div class="dr-label">Сколько заданий</div>${pickSeg('n', [[10, '10'], [15, '15'], [20, '20']], n)}</div>
      <div class="dr-start"><button class="btn primary lg" data-go>▶ Начать</button></div>
      <div class="tiny muted">Формы и род: Bokmålsordboka / Ordbøkene (UiB и Språkrådet, CC BY 4.0).</div>`;
    const start = async () => {
      if (!types.size) { UI.toast('Выберите хотя бы одну часть речи', 'warn'); return; }
      Object.assign(prog().last, { formsSrc: src, formsN: n, formsTypes: [...types] }); Store.save();
      ctx.body.innerHTML = navHtml() + loadingHtml('Готовлю задания…');
      ctx.body.onclick = e => { if (e.target.closest('[data-dr-back]')) ctx.go('hub'); };
      try {
        const r = await buildForms({ src, n, types: [...types] });
        if (!ctx.alive()) return;
        if (r.note) UI.toast(r.note, 'warn', 5000);
        runSession(ctx, 'forms', r.items, () => ctx.go('forms', { src, n, types: [...types], autostart: true }));
      } catch (err) {
        if (!ctx.alive()) return;
        ctx.body.innerHTML = emptyHtml(err.message, `<button class="btn" data-back-setup>← Изменить выбор</button>`);
        ctx.body.onclick = e => { if (e.target.closest('[data-dr-back]')) ctx.go('hub'); if (e.target.closest('[data-back-setup]')) ctx.go('forms', { src, n, types: [...types] }); };
      }
    };
    ctx.body.onclick = e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.hasAttribute('data-dr-back')) { ctx.go('hub'); return; }
      if (t.dataset.type) {
        const k = t.dataset.type; if (types.has(k)) types.delete(k); else types.add(k);
        t.classList.toggle('active', types.has(k)); t.setAttribute('aria-pressed', String(types.has(k)));
        t.textContent = (types.has(k) ? '✓ ' : '') + t.textContent.replace(/^✓ /, '');
        return;
      }
      if (t.closest('[data-seg="src"]')) { src = t.dataset.v; segPick(ctx.body, 'src', t); return; }
      if (t.closest('[data-seg="n"]')) { n = +t.dataset.v; segPick(ctx.body, 'n', t); return; }
      if (t.hasAttribute('data-go')) start();
    };
    if (o.autostart) start();
  };

  /* ================= 🎯 NEXT WORDS (Kelly) ================= */
  function knownSet() {
    const set = new Set();
    Store.cards().forEach(c => String(c.no || '').split('\n')[0].split(/[,;/]/).forEach(part => {
      const w = low(part.replace(/\([^)]*\)/g, ' ').trim().replace(/^(å|en|ei|et)\s+/i, '').trim().replace(/[.!?…]+$/, ''));
      if (w) set.add(w);
    }));
    return set;
  }
  const TR_KEY = 'nk-kelly-ru';
  let trCache = null;
  const trStore = () => { if (!trCache) { try { trCache = JSON.parse(localStorage.getItem(TR_KEY) || '{}') || {}; } catch (e) { trCache = {}; } } return trCache; };
  const trSave = () => { try { localStorage.setItem(TR_KEY, JSON.stringify(trCache)); } catch (e) { /* full */ } };
  const kQuery = x => mainPos(x.pos) === 'v' ? 'å ' + x.w : x.w;
  /** Russian translations of Kelly words: AI (with the English meaning as a hint) or the machine translators */
  async function translateKelly(list) {
    const c = trStore();
    const need = list.filter(x => !c[x.w]);
    if (!need.length || offline()) return;
    if (AI.available()) {
      try {
        for (let k = 0; k < need.length; k += 40) {
          const part = need.slice(k, k + 40);
          const arr = AI.parseJSON(await AI.call({ system: 'You are a Norwegian–Russian dictionary.',
            user: `Translate each Norwegian Bokmål word into Russian: the 1–3 most common meanings, comma-separated, short. "pos" is the part of speech, "en" the English meaning (use it to pick the right sense). Return ONLY a JSON array of strings, same order.\n${JSON.stringify(part.map(x => ({ no: x.w, pos: x.pos, en: x.en })))}`,
            maxTokens: 160 + part.length * 30, temperature: 0.1 }));
          if (Array.isArray(arr)) part.forEach((x, j) => { const t = String(arr[j] || '').trim(); if (t && U.cyrRatio(t) > 0.5) c[x.w] = [t, 'ai:' + (AI.lastProvider || AI.current())]; });
        }
        Translators.lastAI = AI.lastProvider;
      } catch (e) { /* machine translation below */ }
    }
    // content words: the Norwegian word itself; short function words (i, en, på…) are ambiguous alone —
    // their English meaning from the list («in / at») translates far better
    const rest = need.filter(x => !c[x.w]);
    const content = rest.filter(x => ['n', 'v', 'adj'].includes(mainPos(x.pos)) || !x.en);
    const func = rest.filter(x => !content.includes(x));
    const run = async (list, texts, from) => {
      if (!list.length) return;
      const res = await Translators.translateMany(texts, from, 'ru');
      const id = (res.by || []).find(b => b !== 'ai') || (res.by || [])[0] || 'google';
      list.forEach((x, j) => {
        const t = String(res.out[j] || '').trim().replace(/^(чтобы|к)\s+/i, '');
        if (t && U.cyrRatio(t) > 0.5 && low(t) !== low(x.w)) c[x.w] = [t, id === 'ai' ? 'ai:' + (Translators.lastAI || AI.current()) : 'tr:' + id];
      });
    };
    await run(content, content.map(kQuery), 'no');
    await run(func, func.map(x => x.en), 'en');
    trSave();
  }
  async function addKellyCards(list, ctx) {
    // once more right before adding: a word that is already in any deck is never added twice
    const have = knownSet();
    list = list.filter(x => !have.has(low(x.w)));
    if (!list.length) { UI.toast('Эти слова уже есть в ваших карточках', 'good'); return 0; }
    const c = trStore();
    const noRu = list.filter(x => !c[x.w]);
    if (noRu.length) {
      const go = await UI.confirm(`У ${noRu.length} ${U.plural(noRu.length, ['слова', 'слов', 'слов'])} нет русского перевода (нет связи с переводчиком). Добавить их с английским значением вместо перевода? Его можно будет исправить позже.`, { ok: 'Добавить', cancel: 'Отмена' });
      if (!go) return 0;
    }
    // gender (en/ei/et) and forms from Ordbøkene — best effort, the words are added anyway
    const busy = !offline() ? UI.busy('Добавляю слова: род и формы из словаря Ordbøkene…') : null;
    const pars = new Map();
    let i = 0, done = 0;
    try {
      if (busy) {
        const todo = list.filter(x => ['n', 'v', 'adj'].includes(mainPos(x.pos)));
        await Promise.all(Array.from({ length: 4 }, async () => {
          while (i < todo.length) {
            const x = todo[i++];
            try { const p = await withTimeout(paradigm(low(x.w), mainPos(x.pos)), 12000); if (p) pars.set(x.w, p); } catch (e) { /* without forms */ }
            busy.set(`${++done} из ${todo.length}`, done, todo.length);
          }
        }));
      }
    } finally { if (busy) busy.close(); }
    const deck = Store.decks().find(d => d.name === DECK_NEXT) || Store.addDeck(DECK_NEXT, 'Самые частые слова норвежского (список Kelly, CC BY-SA 4.0), уровень ≈ A1–B2 по частотности');
    let made = 0, mt = false;
    // and again right before writing (the dictionary step above takes a while — another window may have added them)
    const have2 = knownSet();
    list = list.filter(x => !have2.has(low(x.w)));
    list.forEach(x => {
      const pos = mainPos(x.pos), p = pars.get(x.w);
      const tr = c[x.w];
      const ru = tr ? tr[0] : `(англ.) ${x.en}`;
      const g = p && p.pos === 'n' ? p.gender : '';
      const no = pos === 'v' ? 'å ' + x.w : pos === 'n' && g ? `${artOf(g)} ${x.w}` : x.w;
      const forms = [];
      if (p && p.forms) {
        const F = s => (p.forms[s] || [])[0];
        if (p.pos === 'n') [['si', 'Неопр. ед. (ubestemt entall)', w => `${artOf(g)} ${w}`.trim()], ['sd', 'Опр. ед. (bestemt entall)'], ['pi', 'Неопр. мн. (ubestemt flertall)'], ['pd', 'Опр. мн. (bestemt flertall)']]
          .forEach(([s, label, fn]) => { if (F(s)) forms.push({ label, no: fn ? fn(F(s)) : F(s), ru: '' }); });
        if (p.pos === 'v') [['inf', 'Инфинитив (infinitiv)', w => 'å ' + w], ['pres', 'Настоящее (presens)', w => 'jeg ' + w], ['past', 'Прошедшее (preteritum)', w => 'jeg ' + w], ['perf', 'Причастие прош. (perfektum partisipp)', w => 'jeg har ' + w]]
          .forEach(([s, label, fn]) => { if (F(s)) forms.push({ label, no: fn(F(s)), ru: '' }); });
        if (p.pos === 'adj') [['am', 'м/ж род (positiv)'], ['an', 'ср. род (positiv)'], ['apl', 'мн. число'], ['cmp', 'Сравнительная (komparativ)'], ['sup', 'Превосходная (superlativ)']]
          .forEach(([s, label]) => { if (F(s)) forms.push({ label, no: F(s), ru: '' }); });
      }
      const by = tr ? tr[1] : null;
      const machine = by && by.startsWith('tr:') ? [by.slice(3)] : [];
      if (machine.length) mt = true;
      const history = [Prov.entry('import', 'import', null, `список частотности Kelly (tekstlab.uio.no, CC BY-SA 4.0) · №${x.rank} · уровень ≈${x.level}`)];
      if (p) history.push(Prov.entry('tr:ordbok', 'forms', null, 'род и формы из Ordbøkene'));
      if (by) history.push(Prov.entry(by, 'translate', null, 'перевод слова'));
      Store.addCard(deck.id, {
        no, ru, en: x.en, wordClass: WORD_CLASS[pos] || '', forms,
        description: `🎯 Частотность: №${x.rank} в списке Kelly · уровень ≈ ${x.level} (по частотности, приблизительно)${x.en ? ` · англ.: ${x.en}` : ''}`,
        tags: ['kelly', x.level], history,
        mtWarn: by && by.startsWith('ai:') ? null : machine.length ? Translators.mtFlag(machine) : (tr ? null : { by: ['google'], t: Date.now() }),
      });
      made++;
    });
    await Store.saveNow();
    if (ctx) ctx.dirty = true;
    UI.toast(`Добавлено ${U.cards(made)} в колоду «${DECK_NEXT}»${mt ? ' · ⚠️ перевод машинный — перепроверьте' : ''}`, 'good', 6000);
    return made;
  }

  VIEWS.next20 = async (ctx, o) => {
    ctx.title('🎯 Следующие слова');
    ctx.body.innerHTML = navHtml() + loadingHtml('Загружаю список частотности…');
    ctx.body.onclick = e => { if (e.target.closest('[data-dr-back]')) ctx.go('hub'); };
    let K;
    try { K = await loadKelly(); } catch (err) {
      if (!ctx.alive()) return;
      ctx.body.innerHTML = emptyHtml(`Не удалось загрузить список слов: ${netMsg(err)}`, '<button class="btn" data-retry>🔄 Повторить</button>');
      ctx.body.onclick = e => { if (e.target.closest('[data-dr-back]')) ctx.go('hub'); if (e.target.closest('[data-retry]')) ctx.go('next20', o); };
      return;
    }
    if (!ctx.alive()) return;
    const last = prog().last;
    const levels = new Set(o.levels || last.kLevels || LEVELS);
    let n = +(o.n || last.kN || 20);
    let list = [], off = new Set();
    const draw = () => {
      const known = knownSet();
      const skip = new Set(prog().kellySkip);
      const has = x => known.has(low(x.w));
      const bands = [500, 1000, 2000, 3000, 6000].map(T => { const ws = K.words.filter(x => x.rank <= T); return { T, tot: ws.length, k: ws.filter(has).length }; });
      const lv = LEVELS.map(L => { const ws = K.words.filter(x => x.level === L); return { L, tot: ws.length, k: ws.filter(has).length }; });
      list = K.words.filter(x => levels.has(x.level) && !has(x) && !skip.has(low(x.w))).slice(0, n);
      off = new Set([...off].filter(w => list.some(x => x.w === w)));
      const c = trStore();
      const sel = list.filter(x => !off.has(x.w)).length;
      ctx.body.innerHTML = `${navHtml()}
        <div class="dr-field"><div class="dr-label">📈 Вы знаете <span class="small muted">(слово есть в ваших карточках)</span></div>
        <div class="dr-meters">${bands.map(b => `<div class="dr-meter" title="Слов из ${b.T >= 6000 ? 'всего списка' : `первых ${b.T} по частоте`}, которые есть в ваших карточках"><div class="dr-meter-top"><span>≈<b>${b.k}</b> из ${b.T >= 6000 ? `всех ${b.tot}` : `первых ${b.T}`}</span><b>${Math.round(b.k / b.tot * 100)}%</b></div><div class="dr-meter-bar"><i style="width:${(b.k / b.tot * 100).toFixed(1)}%"></i></div></div>`).join('')}</div></div>
        <div class="dr-field"><div class="dr-label">Уровень</div>
          <div class="dr-chips" role="group">${lv.map(x => `<button type="button" class="chip dr-chip dr-lvl-chip ${levels.has(x.L) ? 'active' : ''}" data-lvl="${x.L}" aria-pressed="${levels.has(x.L)}"><span class="dr-lvl ${x.L}">${x.L}</span> ${x.k} / ${x.tot}</button>`).join('')}</div>
          <div class="tiny muted">Уровень примерный — только по частотности слова: ${LEVELS.map(L => `${L} — ранги ${LEVEL_RANKS[L]}`).join(' · ')}.</div></div>
        <div class="dr-field"><div class="dr-label">Сколько слов показать</div>${pickSeg('n', [[10, '10'], [20, '20'], [50, '50']], n)}
          <div class="tiny muted" style="margin-top:6px">↪ Список продолжается с того места, где вы остановились: слова, которые уже есть в любой вашей колоде, и отмеченные «✓ Знаю» не показываются и повторно не добавляются. Слова без галочки не добавятся сейчас — они останутся первыми в списке в следующий раз.</div></div>
        ${list.length ? `<div class="dr-klist" role="list">${list.map(x => {
          const tr = c[x.w];
          return `<div class="dr-krow ${off.has(x.w) ? 'off' : ''}" role="listitem">
            <label class="dr-kcheck" title="Добавить это слово"><input type="checkbox" data-pick="${esc(x.w)}" ${off.has(x.w) ? '' : 'checked'}><span aria-hidden="true"></span></label>
            <div class="dr-kword"><b lang="nb">${esc(kQuery(x))}</b><span class="dr-lvl ${x.level}">${x.level}</span><span class="dr-kpos">${esc(POS_RU[mainPos(x.pos)] || x.pos)}</span><span class="dr-krank">№${x.rank}</span></div>
            <div class="dr-ktr">${tr ? `<span class="ru-text">${esc(tr[0])}</span>` : `<span class="muted small" data-tr-wait>${offline() ? 'нет интернета для перевода' : 'перевожу…'}</span>`}<span class="dr-ken">${esc(x.en)}</span></div>
            <div class="dr-kact"><button class="media-btn sm" data-say-w="${esc(x.w)}" title="Произнести" aria-label="Произнести ${esc(x.w)}">${SPK(15)}</button><button class="btn sm ghost" data-skip="${esc(x.w)}" title="Я знаю это слово — не показывать">✓ Знаю</button></div>
          </div>`; }).join('')}</div>` : `<div class="dr-empty"><div class="dr-empty-ico">🎉</div><p>На выбранных уровнях вы знаете все слова списка! Выберите другой уровень.</p></div>`}
        <div class="dr-kfoot">
          <button class="btn primary lg" data-add ${sel ? '' : 'disabled'}>➕ Добавить ${sel} ${U.plural(sel, ['слово', 'слова', 'слов'])}</button>
          <span class="small muted">в колоду «${esc(DECK_NEXT)}»${skip.size ? ` · скрыто как «знаю»: ${skip.size} <button class="dr-link" data-unskip>вернуть</button>` : ''}</span>
        </div>
        ${list.some(x => c[x.w] && c[x.w][1].startsWith('tr:')) ? '<div class="mt-warn">⚠️ <span>Перевод машинный — он может быть неточным. Для точного перевода по смыслу подключите нейросеть (бесплатно: Gemini или Groq в Настройках).</span></div>' : ''}
        <div class="tiny muted">${esc(K.meta.attribution || 'Norwegian KELLY list, CC BY-SA 4.0')} Уровень A1–B2 — приблизительный, только по частотности слова, а не официальная оценка CEFR.</div>`;
      const pending = list.filter(x => !c[x.w]);
      if (pending.length && !offline()) {
        translateKelly(pending).then(() => {
          if (!ctx.alive() || ctx.view !== 'next20') return;
          const cc = trStore();
          ctx.body.querySelectorAll('.dr-krow').forEach((row, i) => {
            const x = list[i]; const box = row.querySelector('[data-tr-wait]'); if (!x || !box) return;
            box.outerHTML = cc[x.w] ? `<span class="ru-text">${esc(cc[x.w][0])}</span>` : '<span class="muted small">перевод не пришёл</span>';
          });
          if (list.some(x => cc[x.w] && cc[x.w][1].startsWith('tr:')) && !ctx.body.querySelector('.mt-warn')) {
            const foot = ctx.body.querySelector('.dr-kfoot');
            if (foot) foot.insertAdjacentHTML('afterend', '<div class="mt-warn">⚠️ <span>Перевод машинный — он может быть неточным. Для точного перевода по смыслу подключите нейросеть (бесплатно: Gemini или Groq в Настройках).</span></div>');
          }
        }).catch(err => { if (ctx.alive()) UI.toast('Перевод: ' + netMsg(err), 'warn'); ctx.body.querySelectorAll('[data-tr-wait]').forEach(b => { b.textContent = 'перевод не пришёл'; }); });
      }
    };
    const updAdd = () => { const sel = list.filter(x => !off.has(x.w)).length; const b = ctx.body.querySelector('[data-add]'); if (b) { b.disabled = !sel; b.textContent = `➕ Добавить ${sel} ${U.plural(sel, ['слово', 'слова', 'слов'])}`; } };
    draw();
    ctx.body.onchange = e => {
      const cb = e.target.closest('[data-pick]'); if (!cb) return;
      if (cb.checked) off.delete(cb.dataset.pick); else off.add(cb.dataset.pick);
      cb.closest('.dr-krow').classList.toggle('off', !cb.checked);
      updAdd();
    };
    ctx.body.onclick = async e => {
      const t = e.target.closest('button'); if (!t || t.disabled) return;
      if (t.hasAttribute('data-dr-back')) { ctx.go('hub'); return; }
      if (t.dataset.lvl) {
        const L = t.dataset.lvl;
        if (levels.has(L) && levels.size === 1) { UI.toast('Нужен хотя бы один уровень', 'warn'); return; }
        if (levels.has(L)) levels.delete(L); else levels.add(L);
        prog().last.kLevels = [...levels]; Store.save(); draw(); return;
      }
      if (t.closest('[data-seg="n"]')) { n = +t.dataset.v; prog().last.kN = n; Store.save(); draw(); return; }
      if (t.dataset.sayW) { TTS.speak(t.dataset.sayW, 'no'); return; }
      if (t.dataset.skip) { const d = prog(); const w = low(t.dataset.skip); if (!d.kellySkip.includes(w)) d.kellySkip.push(w); Store.save(); draw(); return; }
      if (t.hasAttribute('data-unskip')) { prog().kellySkip = []; Store.save(); draw(); return; }
      if (t.hasAttribute('data-add')) {
        const pick = list.filter(x => !off.has(x.w));
        if (!pick.length) return;
        t.disabled = true;
        try {
          if (pick.some(x => !trStore()[x.w]) && !offline()) await translateKelly(pick);
          const made = await addKellyCards(pick, ctx);
          if (made && ctx.alive()) { off = new Set(); draw(); }
          else if (ctx.alive()) t.disabled = false;
        } catch (err) { UI.toast('Не удалось добавить слова: ' + netMsg(err), 'bad', 6000); if (ctx.alive()) t.disabled = false; }
      }
    };
  };

  /* ================= modal shell ================= */
  function shell() {
    const ctx = { dirty: false, onKey: null, view: '' };
    let closed = false;
    const keyH = e => {
      if (!ctx.onKey || closed) return;
      const backs = document.querySelectorAll('.modal-backdrop');
      if (backs[backs.length - 1] !== ctx.m.el.parentElement) return; // another window is on top
      ctx.onKey(e);
    };
    const m = UI.modal({
      title: '🏋️ Упражнения', cls: 'wide drills-modal', body: '<div class="dr-root" data-dr></div>',
      // an exercise in progress (answered something, questions still to go): asked first; the answers are already saved
      beforeClose: UI.guard(() => !(ctx.inSession && ctx.inSession()) ? null : { title: 'Закончить упражнение?', line: 'Ответы уже сохранены.',
        actions: [{ label: 'Закончить', value: 'close', cls: 'primary' }], cancel: 'Продолжить' }),
      onClose: () => {
        closed = true; document.removeEventListener('keydown', keyH);
        try { TTS.stop(); } catch (e) { /* ignore */ }
        if (ctx.dirty && window.App && App.view && App.view.name !== 'study') { try { App.render(); } catch (e) { /* ignore */ } }
      },
    });
    document.addEventListener('keydown', keyH);
    ctx.m = m;
    ctx.body = m.$('[data-dr]');
    ctx.alive = () => !closed;
    ctx.title = html => { const h = m.$('.modal-head h2'); if (h) h.innerHTML = html; };
    ctx.go = (view, o) => {
      if (closed) return;
      ctx.onKey = null; ctx.view = view; ctx.inSession = null;
      ctx.body.onclick = null; ctx.body.onchange = null;
      try { TTS.stop(); } catch (e) { /* ignore */ }
      const mb = m.$('.modal-body'); if (mb) mb.scrollTop = 0;
      Promise.resolve(VIEWS[view](ctx, o || {})).catch(err => { console.error(err); UI.toast('Упражнение: ' + netMsg(err), 'bad', 6000); });
    };
    return ctx;
  }
  function openAt(view, opts) { const ctx = shell(); ctx.go(view, opts || {}); return ctx; }

  const Drills = {
    /** 🏋️ hub: three tools */
    open() { return openAt('hub'); },
    /** ✍️ cloze; opts: { source: 'cards'|'tatoeba'|'book', n: 10..20, autostart } */
    cloze(opts) { return openAt('cloze', opts); },
    /** 🔤 word forms; opts: { src: 'builtin'|'mine'|'both', types: ['v','n','adj'], n, autostart } */
    forms(opts) { return openAt('forms', opts); },
    /** 🎯 next frequent words; opts: { n: 20, levels: ['A1','A2'] } */
    next20(opts) { return openAt('next20', opts); },
    STRONG, LEVELS, DECK_NEXT, DECK_SENT, DECK_WORDS,
    cardSpec,
    // internals (used by tests)
    _t: { judge, fold, findTarget, entriesFromCards, cardSentences, readArticle, paradigm, loadKelly, knownSet, verbKind, distractors, buildCloze, buildForms, books, prepEntry },
  };

  window.Drills = Drills;
})();
