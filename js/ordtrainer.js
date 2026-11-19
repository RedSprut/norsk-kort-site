/* ============ 🧩 Порядок слов, вопросы, модальные глаголы: тренажёры + готовые колоды грамматики ============
 * 🧱 «Собери предложение» — word chips: tap or drag them into order, «Проверить», a short rule in Russian for the mistake.
 *    Levels: V2 · inversion · ikke (main clause) · subordinate clause · modal + infinitive · pleier + å · questions ·
 *    indirect questions, and «Задай вопрос к ответу» (answer + question word → build the question).
 * å  «å или нет?» — gap-fill: Jeg kan ___ svømme → «—», Jeg pleier ___ svømme → «å» (with tricky cases).
 * ❓ «Какое вопросительное слово?» — «___ bor du? — I Bergen.» → Hvor.
 * 📊 «Порядок слов — таблица позиций» — the coloured slot table of a Norwegian sentence (helsetning · spørsmål · leddsetning):
 *    👀 watch a sentence fly into its columns · 🧩 sort words into columns · 🧱 build the sentence · 🔄 transform
 *    (inversion, sier at / spør om, som, derfor ↔ fordi, leddsetning first). Data: data/ordtrainer.json → slots
 *    (items flagged source:"bnorsk" = the Bnorsk.no example sheet, used with the author's permission; switch: slots.sources.bnorsk.on).
 * 📚 «Грамматика: готовые колоды / таблицы форм» — Модальные глаголы · Глаголы с å · Вопросительные слова (data/grammar-decks.json):
 *    every tense with a pronoun and its translation in card.forms (the card back shows them with 🔊), one tap to add,
 *    «Обновить» never duplicates cards (matched by card.gramKey / the Norwegian text).
 * Sentences: data/ordtrainer.json (hand-authored, Norsk Kort's own content) + optional simple sentences from the user's
 * own examples that match a pattern (modal + infinitive checked in the offline lexicon; å-verb + «å»).
 * Points, streak, best score: Store.settings.ordtr (separate from the FSRS schedule). Mistakes: replay + «➕ в карточки».
 */
(function () {
  const DATA_URL = 'data/ordtrainer.json';
  const DECKS_URL = 'data/grammar-decks.json';
  /** optional deck files after data/grammar-decks.json — each may be missing (skipped quietly); same schema: { attribution?, group?, decks: [...] }.
   *  deck.group (or the file's group) puts a deck under a heading of the catalogue — see SECTIONS below; no group → «Таблицы форм» */
  const EXTRA_DECKS = ['data/forms-decks.json', 'data/ordbok-sprut-decks.json', 'data/pronunciation-decks.json', 'data/writing-phrases.json', 'data/phrasebook-decks.json'];
  const DECK_MISTAKES = '🧩 Порядок слов: мои ошибки';
  const ROUND = 10;
  const esc = s => (window.U ? U.esc(s) : String(s == null ? '' : s));
  const low = s => String(s == null ? '' : s).toLowerCase().normalize('NFC');
  const normS = s => low(s).replace(/[.,!?;:«»"()]/g, ' ').replace(/\s+/g, ' ').trim();
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const SPK = (s = 18) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>`;
  const say = t => { try { if (t && window.TTS) TTS.speak(t, 'no'); } catch (e) { /* no voice */ } };

  /* ================= rules (pure: used by the game and by the checks) ================= */
  const MODAL = new Set(['kan', 'kunne', 'kunnet', 'vil', 'ville', 'villet', 'skal', 'skulle', 'skullet', 'må', 'måtte', 'måttet', 'bør', 'burde', 'burdet',
    'får', 'fikk', 'fått', 'tør', 'turte', 'torde', 'turt', 'tort']);
  const AA_VERB = /^(pleie[rd]?|pleide|pleid|prøvd|liker?|likte|likt|prøve[rd]?|prøvde|prøv|begynne[rt]?|begynte|begynn|slutte[rt]?|slutt|håpe[rt]?|huske[rt]?|husk|glemme[rt]?|glemte|glemt|glem|klare[rt]?|klarte|klart|orke[rt]?|orket|gidde[rt]?|gadd|giddet|ønske[rt]?|ønsket|trenge[rt]?|trengte|trengt|være|elske[rt]?|slapp|slippe[rt]?|sluppet|lære[rt]?|lærte|nekte[rt]?|nektet|bestemt oss|bestemt meg|bestemte (meg|oss|seg))$/;
  /** the sentence an order of chunks makes: first letter up, end mark */
  function sentence(words, p) {
    const t = words.join(' ').replace(/\s+,/g, ',').trim();
    return t ? t[0].toUpperCase() + t.slice(1) + (p || '.') : '';
  }
  const itemText = it => sentence(it.w, it.p);
  /** orders that are also right: the given alternatives + (main clauses) one adverbial / object moved to the front */
  function accepted(it) {
    const out = [it.w.join(' ')].concat(it.alt || []);
    const r = it.r;
    const main = !/[CQ]/.test(r) && it.p !== '?' && !it.fix && !(it.k > 0);
    if (main) {
      const iv = r.indexOf('V');
      if (r[0] === 'S' && iv === 1) {
        // Jeg spiser fisk i dag → I dag spiser jeg fisk · Fisk spiser jeg
        for (let i = 2; i < r.length; i++) {
          if (r[i] !== 'A' && r[i] !== 'O') continue;
          const rest = it.w.filter((_, j) => j !== 0 && j !== 1 && j !== i);
          out.push([it.w[i], it.w[1], it.w[0], ...rest].join(' '));
        }
      } else if (r[0] === 'A' && iv === 1 && r[2] === 'S' && !/,$/.test(it.w[0])) {
        // I dag spiser jeg fisk → Jeg spiser fisk i dag
        out.push([it.w[2], it.w[1], ...it.w.slice(3), it.w[0]].join(' '));
      }
    }
    return [...new Set(out.map(normS))];
  }
  /** does the correct order follow the rule its level claims? → '' or what is wrong (for the checks) */
  function validate(level, it) {
    const r = it.r, w = it.w;
    if (!Array.isArray(w) || w.length !== r.length || w.length < 2) return 'chunks/roles';
    if (!it.ru) return 'no translation';
    const idx = (ch, from = 0) => r.indexOf(ch, from);
    const qmark = it.p === '?';
    const main2 = () => (r[0] === 'V' ? true : idx('V') === 1);
    switch (level) {
      case 'v2': return /[CQ]/.test(r) ? 'clause' : idx('V') === 1 ? '' : 'V not 2nd';
      case 'inv': return /[AO]/.test(r[0]) && r[1] === 'V' && r[2] === 'S' ? '' : 'no inversion';
      case 'ikke': {
        const v = idx('V'), n = idx('N');
        if (v !== 1 || n < 0) return 'V2 / no ikke';
        if (r[0] === 'S') return n === v + 1 ? '' : 'ikke not right after V';
        return r[v + 1] === 'S' && n === v + 2 ? '' : 'ikke not after S (inversion)';
      }
      case 'sub': {
        const c = idx('C');
        if (c < 1 || it.k !== c + 1) return 'lock must end at the conjunction';
        if (!main2()) return 'main clause V2';
        const sr = r.slice(c + 1), s = sr.indexOf('S'), v = sr.indexOf('V'), n = sr.indexOf('N');
        if (v < 0) return 'no verb in sub';
        if (s >= 0 && s > v) return 'sub: S after V';
        if (n >= 0 && n > v) return 'sub: ikke after V';
        if (w[c] !== 'som' && s < 0) return 'sub: no subject';
        return '';
      }
      case 'modal': {
        if (/T/.test(r)) return 'has å';
        if (!(it.x || []).includes('å')) return 'no å distractor';
        const m = w.findIndex((x, j) => (r[j] === 'V' || r[j] === 'I') && MODAL.has(low(x)));
        if (m < 0) return 'no modal';
        let j = m + 1; while (j < r.length && /[SN]/.test(r[j])) j++;
        if (r[j] !== 'I') return 'no infinitive after the modal';
        return main2() ? '' : 'V2';
      }
      case 'aa': {
        const t = idx('T'); if (t < 1) return 'no å';
        if (r[t + 1] !== 'I') return 'å not before an infinitive';
        let j = t - 1; while (j >= 0 && r[j] === 'N') j--;
        if (!(r[j] === 'V' || r[j] === 'I') || !AA_VERB.test(low(w[j]))) return 'the verb before å is not an å-verb: ' + w[j];
        return main2() ? '' : 'V2';
      }
      case 'q': case 'ask': {
        if (!qmark) return 'no ?';
        if (r[0] === 'Q') return r[1] === 'V' && (it.qs || r[2] === 'S') ? '' : 'Q V S';
        if (level === 'ask') return 'ask must start with Q';
        return r[0] === 'V' && r[1] === 'S' ? '' : 'yes/no: V S';
      }
      case 'indq': {
        const q = idx('Q');
        if (q < 1 || it.k !== q) return 'lock must end before the question word';
        const sr = r.slice(q + 1), v = sr.indexOf('V'), s = sr.indexOf('S'), n = sr.indexOf('N');
        if (sr[0] === 'C') { if (w[q + 1] !== 'som') return 'C must be som'; return v >= 1 && (n < 0 || n < v) ? '' : 'som (ikke) V'; }
        if (s !== 0 || v < 1) return 'indirect: S before V';
        return n < 0 || n < v ? '' : 'indirect: ikke after V';
      }
    }
    return 'unknown level';
  }
  /** a gap item: is the answer what the words before the gap demand? → '' or why not */
  function validateGap(it) {
    if (!/^[^_]*___[^_]*$/.test(it.s)) return 'one gap';
    if (!['å', '-', '*'].includes(it.a)) return 'answer';
    if (!it.ru || !it.why) return 'ru / why';
    const before = low(it.s.split('___')[0]).replace(/[^a-zæøå ]/g, ' ').trim().split(/\s+/);
    // skip ikke / dessverre and the pronoun object of la / se / høre (lot meg, så ham, hørte henne)
    const words = before.filter(x => !['ikke', 'dessverre'].includes(x));
    const last = words[words.length - 1], prev = words[words.length - 2];
    const OBJ = ['meg', 'deg', 'ham', 'henne', 'oss', 'dem', 'barna'];
    const PRON = ['jeg', 'du', 'han', 'hun', 'vi', 'dere', 'de', 'man', 'det', 'barna'];
    let want;
    if (MODAL.has(last) || (PRON.includes(last) && MODAL.has(prev))) want = last === 'tør' || prev === 'tør' ? '*' : '-';
    else if (OBJ.includes(last) && ['la', 'lot', 'så', 'ser', 'hørte', 'hører'].includes(prev)) want = '-';
    else if (last === 'trenger' && before.includes('ikke')) want = '*';
    else if (['til', 'for'].includes(last) || AA_VERB.test(last) || ['lett', 'lov', 'hyggelig', 'viktig'].includes(last) || (last === 'meg' && prev === 'gleder')) want = 'å';
    else return 'no rule for: ' + before.join(' ');
    if (prev === 'la' && last === 'være') want = 'å';
    return want === it.a ? '' : `expected ${want}`;
  }
  function validateQw(it, list) {
    if (!/^___ /.test(it.q) || !it.a || !it.ru || !it.why) return 'shape';
    if (!list.includes(it.w)) return 'word not in list';
    if ((it.also || []).some(x => !list.includes(x) || x === it.w)) return 'also';
    return '';
  }

  /** the user's order → the hint key for the first broken rule (or 'other') */
  function diagnose(level, it, order, chunks) {
    const used = order.map(i => chunks[i]);
    const extra = used.find(c => c.x);
    if (extra) {
      const t = low(extra.t);
      if (t === 'å') return 'modalAa';
      if (t === 'som') return 'somNot';
      if (t === 'jeg') return 'askDu';
      if (t === 'fordi') return 'askFordi';
      return 'other';
    }
    const missing = chunks.filter((c, i) => !c.x && !order.includes(i));
    if (missing.some(c => c.r === 'T')) return 'needAa';
    if (missing.some(c => c.r === 'C' && low(c.t) === 'som')) return 'somNeed';
    if (missing.length) return 'missing';
    const r = used.map(c => c.r);
    const k = it.k || 0;
    const first = (ch, from = 0) => r.indexOf(ch, from);
    if (level === 'sub' || level === 'indq') {
      const start = level === 'sub' ? r.indexOf('C', Math.max(0, k - 1)) + 1 : k + 1;
      if (level === 'indq' && r[k] !== 'Q') return 'indOrder';
      const sr = r.slice(start), s = sr.indexOf('S'), v = sr.indexOf('V'), n = sr.indexOf('N');
      if (level === 'indq' && it.r[k + 1] === 'C' && sr[0] !== 'C') return 'somNeed';
      if (s >= 0 && v >= 0 && v < s) return level === 'sub' ? 'subInv' : 'indOrder';
      if (n >= 0 && v >= 0 && n > v) return 'subIkke';
      return 'other';
    }
    const v = first('V'), n = first('N'), iI = first('I'), t = first('T'), s = first('S');
    if (it.r[0] === 'Q') {
      if (r[0] !== 'Q' || r[1] !== 'V' || (!it.qs && r[2] !== 'S')) return 'whFirst';
    } else if (it.r[0] === 'V') {
      if (r[0] !== 'V') return it.p === '?' ? 'ynFirst' : 'impFirst';
      if (it.p === '?' && r[1] !== 'S') return 'ynFirst';
    } else {
      if (n >= 0 && v >= 0 && n < v) return 'ikkeMain';
      if (iI >= 0 && v >= 0 && iI < v) return 'infAfter';
      if (v !== 1) return v > 1 && r[1] === 'S' && /[AO]/.test(r[0]) ? 'inv' : 'v2';
      if (r[0] !== 'S' && s > 2) return n >= 0 && n < s ? 'ikkeInv' : 'inv';
    }
    if (t >= 0) {
      if (n > t) return 'aaNeg';
      if (r[t + 1] !== 'I') return 'needAa';
    }
    if (iI >= 0 && v >= 0 && iI < v) return 'infAfter';
    // ikke wandered to the end (Jeg kan svømme ikke): in a main clause it stands right after the verb (or the subject)
    if (n > v && r.slice(v + 1, n).some(x => /[IOAMPT]/.test(x))) return 'ikkeMain';
    return 'other';
  }

  /* ================= data ================= */
  let DATA = null, DECKS = null;
  const getJSON = async url => { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
  async function data() {
    if (!DATA) {
      const d = await getJSON(DATA_URL);
      if (!d || !Array.isArray(d.levels) || !Array.isArray(d.aa) || !Array.isArray(d.qw)) throw new Error('bad data');
      DATA = d;
    }
    return DATA;
  }
  async function decksData() {
    if (!DECKS) {
      const d = await getJSON(DECKS_URL);
      if (!d || !Array.isArray(d.decks)) throw new Error('bad data');
      d.decks.forEach(x => { x._attr = d.attribution; });
      d._credits = [];
      // 📐 form tables (data/forms-decks.json), the owner's dictionary, reading rules…: each deck carries its own short source line
      for (const url of EXTRA_DECKS) {
        let f = null;
        try { f = await getJSON(url); } catch (e) { continue; } // optional — the other decks still work
        if (!f || typeof f !== 'object' || !Array.isArray(f.decks)) continue;
        ['paradigmSlots', 'paradigmRu', 'paradigmShort'].forEach(k => { if (f[k] && typeof f[k] === 'object') d[k] = Object.assign({}, f[k], d[k] || {}); });
        let n = 0;
        f.decks.forEach(x => {
          if (!x || typeof x !== 'object' || !x.id || !Array.isArray(x.cards) || !x.cards.length || d.decks.some(y => y.id === x.id)) return;
          const src = x.source && x.source.name ? String(x.source.name).replace(/\s*\(.*?\)\s*/g, ' ').trim() : '';
          const url2 = x.source && /^https?:\/\//.test(String(x.source.url || '')) ? String(x.source.url) : '';
          x._attr = src ? `Источник: ${src}${url2 ? ` — ${url2}` : ''}` : (typeof f.attribution === 'string' && f.attribution) || d.attribution;
          x._src = src; x._srcUrl = url2;
          if (!x.group && typeof f.group === 'string') x.group = f.group;
          if (!x.name) x.name = x.id;
          if (!x.icon) x.icon = '📚';
          if (typeof x.description !== 'string') x.description = '';
          d.decks.push(x); n++;
        });
        if (n && typeof f.attribution === 'string' && f.attribution && f.attribution !== d.attribution) d._credits.push(url === EXTRA_DECKS[0] ? 'Таблицы форм — источник: grammatikk.com, формы сверены с ordbokene.no' : f.attribution);
      }
      DECKS = d;
    }
    return DECKS;
  }
  /* 📌 «Мои ошибки» — the owner's own filled worksheet (private/my-mistakes-ordstilling.json, the mistakes' trainer items):
   * a personal level at the top of «Собери предложение», fetched ONLY on this Mac (localhost — the same check as 📘 Мои учебники). */
  const MINE_URL = 'private/my-mistakes-ordstilling.json';
  const MINE_RULE = 'Глагол на 2-м месте, подлежащее сразу за ним — до «i Norge», «på norskkurs».';
  let MINE = null;
  const onOwnerMac = () => {
    try { if (window.MyCourse && typeof MyCourse.available === 'function') return !!MyCourse.available(); } catch (e) { /* below */ }
    try { return ['localhost', '127.0.0.1'].includes(String(location.hostname || '')); } catch (e) { return false; }
  };
  async function mineLevel() {
    if (!onOwnerMac()) return null;
    if (MINE !== null) return MINE || null;
    try {
      const r = await fetch(MINE_URL, { cache: 'no-store', credentials: 'same-origin' });
      const j = r && r.ok ? await r.json() : null;
      const items = (j && Array.isArray(j.mistakes) ? j.mistakes : []).filter(m => m && !m.orderOk && m.trainer && Array.isArray(m.trainer.w)
        && typeof m.trainer.r === 'string' && m.trainer.w.length === m.trainer.r.length && m.trainer.w.length > 1 && (m.trainer.ru || m.ru))
        .map(m => Object.assign({}, m.trainer, { ru: m.trainer.ru || m.ru, myErr: true, mrule: String(m.rule || ''), wrong: String(m.wrong || '') }));
      MINE = items.length ? { id: 'mine', icon: '🎯', name: 'Мои ошибки 📌', short: MINE_RULE, rule: (j.rules && j.rules.inv) || MINE_RULE, items, personal: true } : false;
    } catch (e) { MINE = false; }
    return MINE || null;
  }
  const levelOf = id => (id === 'mine' ? MINE || null : (DATA && DATA.levels.find(l => l.id === id)) || null);
  /** rules for the keys diagnose() / judgeLine() can return that data/ordtrainer.json → hints / slots.why do not have */
  const HINT_EXTRA = {
    askDu: 'Спрашиваем собеседника: в вопросе du, а jeg — в ответе.',
    askFordi: 'fordi — это ответ на «почему?», в вопросе его нет.',
    missing: 'Использованы не все слова — добавьте оставшиеся.',
    impFirst: 'Просьба или приказ: глагол стоит первым.',
    extra: 'Это слово здесь лишнее.',
  };
  const hintText = key => (DATA && DATA.hints && DATA.hints[key]) || HINT_EXTRA[key] || (DATA && DATA.hints && DATA.hints.other) || 'Порядок слов другой — сравните с правильным вариантом.';

  /* ================= progress: Store.settings.ordtr ================= */
  function prog() {
    const s = Store.settings;
    if (!s.ordtr || typeof s.ordtr !== 'object') s.ordtr = {};
    const p = s.ordtr;
    p.best = p.best && typeof p.best === 'object' ? p.best : {};
    p.stats = p.stats && typeof p.stats === 'object' ? p.stats : {};
    if (typeof p.points !== 'number') p.points = 0;
    if (typeof p.bestStreak !== 'number') p.bestStreak = 0;
    if (typeof p.mine !== 'boolean') p.mine = true;
    return p;
  }

  /* ================= sentences from the user's own cards (safe and simple) ================= */
  const SUBJ = '(Jeg|Du|Han|Hun|Vi|Dere|De|Man)';
  const GEN_RE = new RegExp(`^${SUBJ} (kan|vil|skal|må|bør|pleier|pleide|liker|prøver|begynner|håper|glemte|husker|trenger|orker|klarte) (ikke )?(å )?([a-zæøå]+)((?: [a-zæøå]+){0,3})([.!])$`);
  async function fromCards() {
    if (!window.Store || !Store.state) return { wo: [], aa: [] };
    const seen = new Set(), pairs = [];
    const add = (no, ru) => {
      no = String(no || '').replace(/\s+/g, ' ').trim(); ru = String(ru || '').replace(/\s+/g, ' ').trim();
      if (!no || !ru || no.length > 80 || seen.has(low(no)) || /[а-яё]/i.test(no)) return;
      seen.add(low(no)); pairs.push({ no, ru });
    };
    Store.cards().slice(-4000).forEach(c => {
      if (c.gramKey) return; // the ready-made grammar decks: their sentences are already in the built-in bank
      if (c.example && c.exampleRu) add(c.example, c.exampleRu);
      (c.examples || []).forEach(x => add(x.no, x.ru));
      if (/[.!]$/.test(String(c.no || '').trim())) add(c.no, c.ru);
    });
    const wo = [], aa = [];
    let lex = false;
    try { if (window.Lexicon) { await Lexicon.ready(); lex = true; } } catch (e) { /* offline lexicon not loaded */ }
    for (const p of pairs) {
      if (wo.length >= 40) break;
      const m = p.no.match(GEN_RE); if (!m) continue;
      const [, subj, verb, neg, aaMark, inf, rest, end] = m;
      const isModal = MODAL.has(verb);
      if (isModal === !!aaMark) continue; // modal must have no å, an å-verb must have it
      if (isModal) {
        if (!lex) continue;
        const rd = Lexicon.peek(inf) || [];
        if (!rd.some(x => x.pos === 'verb' && x.lemma === inf)) continue; // the word after the modal really is an infinitive
      }
      const w = [low(subj) === 'jeg' ? 'jeg' : low(subj), verb], r = ['S', 'V'];
      if (neg) { w.push('ikke'); r.push('N'); }
      if (aaMark) { w.push('å'); r.push('T'); }
      w.push(inf); r.push('I');
      if (rest.trim()) { w.push(rest.trim()); r.push('M'); }
      const it = { w, r: r.join(''), ru: p.ru, p: end === '!' ? '!' : '.', fix: 1, mine: true };
      if (isModal) it.x = ['å'];
      const level = isModal ? 'modal' : 'aa';
      if (validate(level, it)) continue;
      wo.push(Object.assign(it, { level }));
      const before = [subj, verb].concat(neg ? ['ikke'] : []).join(' ');
      aa.push({ s: `${before} ___ ${inf}${rest}${end}`, a: isModal ? '-' : 'å', ru: p.ru, why: isModal ? `${verb} — модальный глагол: инфинитив без å.` : `После ${verb} — å + инфинитив.`, mine: true });
    }
    return { wo, aa };
  }

  /* ================= window ================= */
  function shell(view, opts) {
    const ctx = { view: '', inGame: false, onKey: null };
    let closed = false;
    const m = UI.modal({
      title: '🧩 Порядок слов и вопросы', cls: 'wide ot-modal', body: '<div class="ot-root" data-ot></div>',
      beforeClose: UI.guard(() => (ctx.inGame ? { title: 'Закончить?', line: 'Очки сохранятся.', actions: [{ label: 'Закончить', value: 'end', cls: 'primary' }], cancel: 'Продолжить' } : null)),
      onClose: () => { closed = true; if (ctx.stop) { try { ctx.stop(); } catch (e) { /* ignore */ } ctx.stop = null; } document.removeEventListener('keydown', keyH); try { TTS.stop(); } catch (e) { /* ignore */ } if (ctx.dirty && window.App && App.view && App.view.name === 'home') { try { App.render(); } catch (e) { /* ignore */ } } },
    });
    const keyH = e => {
      if (!ctx.onKey || closed) return;
      const backs = document.querySelectorAll('#modal-root > .modal-backdrop:not(.closing)');
      if (backs[backs.length - 1] !== m.el.parentElement) return;
      ctx.onKey(e);
    };
    document.addEventListener('keydown', keyH);
    // ❓ this topic of «Как пользоваться»
    const head = m.$('.modal-head'), ref = m.$('.modal-head .modal-home') || m.$('.modal-head [data-close]');
    if (head && ref && !head.querySelector('.help-q')) ref.insertAdjacentHTML('beforebegin', '<button type="button" class="help-q" data-help="ordtr" aria-label="Как пользоваться: порядок слов и вопросы" data-tip="Как это работает?">?</button>');
    ctx.m = m;
    ctx.body = m.$('[data-ot]');
    ctx.alive = () => !closed;
    ctx.title = t => { const h = m.$('.modal-head h2'); if (h) h.textContent = t; };
    ctx.go = (v, o) => {
      if (closed) return;
      if (ctx.stop) { try { ctx.stop(); } catch (e) { /* ignore */ } ctx.stop = null; }
      ctx.view = v; ctx.inGame = false; ctx.onKey = null; ctx.body.onclick = null; ctx.body.onchange = null; ctx.body.onpointerdown = null; ctx.body.oninput = null;
      try { TTS.stop(); } catch (e) { /* ignore */ }
      const mb = m.$('.modal-body'); if (mb) mb.scrollTop = 0;
      Promise.resolve(VIEWS[v](ctx, o || {})).catch(err => {
        console.warn('ordtrainer', err);
        if (!closed) ctx.body.innerHTML = `<div class="ot-empty">😕 <p>Не удалось открыть упражнение. Проверьте интернет и попробуйте ещё раз.</p><button class="btn" data-ot-go="hub">← Все тренажёры</button></div>`;
        ctx.body.onclick = e => { if (e.target.closest('[data-ot-go="hub"]')) ctx.go('hub'); };
      });
    };
    ctx.go(view, opts);
    return ctx;
  }
  const backBtn = (to = 'hub', label = '← Все тренажёры') => `<button type="button" class="btn sm ghost ot-back" data-ot-go="${to}">${label}</button>`;
  const scoreBar = S => `<div class="ot-score" aria-live="polite"><span class="ot-pts" title="Очки">⭐ <b data-pts>${S.points}</b></span><span class="ot-streak ${S.streak >= 3 ? 'hot' : ''}" title="Серия верных ответов подряд">🔥 <b>${S.streak}</b></span><span class="ot-best" title="Рекорд">🏆 ${Math.max(S.best, S.points)}</span><span class="ot-prog">${Math.min(S.i + 1, S.items.length)} / ${S.items.length}</span></div>`;

  const VIEWS = {};
  const TOOL = {
    wo: { ico: '🧱', name: 'Собери предложение', desc: 'Нажимайте или перетаскивайте слова по порядку: V2, инверсия, ikke, придаточные, модальные, вопросы' },
    pos: { ico: '📊', name: 'Порядок слов — таблица позиций', desc: 'Цветная таблица, как на листе Bnorsk: смотрите, как слова встают в столбцы, раскладывайте и собирайте сами, переделывайте: инверсия, sier at / spør om, som, derfor ↔ fordi' },
    aa: { ico: 'å', name: 'å или нет?', desc: 'Jeg kan ___ svømme · Jeg pleier ___ svømme — нужен ли å перед инфинитивом' },
    qw: { ico: '❓', name: 'Какое вопросительное слово?', desc: 'По ответу выберите слово: «I Oslo» → Hvor, «To» → Hvor mange' },
    decks: { ico: '📚', name: 'Грамматика: готовые колоды и таблицы форм', desc: 'Глаголы · существительные · прилагательные · местоимения: таблица всех форм, колода в один тап (целиком или выбранные слова) и «Впиши форму»' },
  };
  const statLine = k => {
    if (k === 'decks') return 'добавить одним нажатием';
    const p = prog();
    if (k === 'pos') {
      const ks = ['posS', 'posB', 'posT', 'posW'], n = ks.reduce((a, x) => a + ((p.stats[x] || {}).n || 0), 0), okN = ks.reduce((a, x) => a + ((p.stats[x] || {}).ok || 0), 0);
      return n ? `${Math.round(okN / n * 100)}% верно · рекорд ${Math.max(...ks.map(x => p.best[x] || 0))} ⭐` : 'ещё не пробовали';
    }
    const st = p.stats[k], best = p.best[k];
    return st && st.n ? `${Math.round(st.ok / st.n * 100)}% верно · рекорд ${best || 0} ⭐` : 'ещё не пробовали';
  };
  /** big tiles for the exercises hub (🏋️ Упражнения) */
  function tilesHtml() {
    return Object.entries(TOOL).map(([id, t]) => `<button type="button" class="dr-tile ot-tile" data-ordtr="${id}"><span class="dr-tile-ico ${id === 'aa' ? 'ot-aa-ico' : ''}" aria-hidden="true">${t.ico}</span>
      <span class="dr-tile-txt"><b>${t.name}</b><span>${esc(t.desc)}</span><small>${esc(statLine(id))}</small></span><span class="dr-tile-go" aria-hidden="true">›</span></button>`).join('');
  }

  VIEWS.hub = ctx => {
    ctx.title('🧩 Порядок слов и вопросы');
    const p = prog();
    ctx.body.innerHTML = `<div class="lib-intro">🧭 <span>Норвежский порядок слов: <b>глагол на 2-м месте</b>, инверсия, <b>ikke</b> в главном и придаточном, модальные глаголы без <b>å</b>, вопросы. Ошибка — сразу короткое правило по-русски.</span></div>
      <div class="ot-hub">${Object.entries(TOOL).map(([id, t]) => `<button type="button" class="ot-hub-tile" data-ot-go="${id}"><span class="ot-hub-ico ${id === 'aa' ? 'ot-aa-ico' : ''}" aria-hidden="true">${t.ico}</span>
        <span class="ot-hub-txt"><b>${t.name}</b><span>${esc(t.desc)}</span><small>${esc(statLine(id))}</small></span><span class="ot-hub-go" aria-hidden="true">›</span></button>`).join('')}</div>
      <div class="ot-total">⭐ Всего очков: <b>${p.points}</b> · 🔥 лучшая серия: <b>${p.bestStreak}</b></div>
      <div class="tiny muted">Предложения и колоды — собственный материал Norsk Kort (составлены вручную); формы глаголов сверены с Ordbøkene. Таблица позиций — по схеме Bnorsk.no. Очки не меняют расписание повторений карточек.</div>`;
    ctx.body.onclick = e => { const b = e.target.closest('[data-ot-go]'); if (b) ctx.go(b.dataset.otGo); };
  };

  /* ---------- 🧱 word order: choose a level ---------- */
  VIEWS.wo = async (ctx, o) => {
    ctx.title('🧱 Собери предложение');
    ctx.body.innerHTML = '<div class="ot-loading"><span class="spinner"></span> Загружаю предложения…</div>';
    const d = await data();
    const mineLv = await mineLevel();
    if (!ctx.alive()) return;
    const p = prog();
    const lv = (mineLv ? [mineLv] : []).concat(d.levels).map(l => ({ id: l.id, icon: l.icon, name: l.name, short: l.short, n: l.items.length, mine: !!l.personal }))
      .concat([{ id: 'ask', icon: '💬', name: 'Задай вопрос к ответу', short: 'Jeg bor i Oslo + Hvor → Hvor bor du?', n: d.ask.length }]);
    // a saved level that is not here (📌 «Мои ошибки» off this Mac) is dropped — the round never starts empty
    let cur = new Set((o.levels || p.woLevels || ['v2']).filter(id => lv.some(l => l.id === id)));
    if (!cur.size) cur = new Set(['v2']);
    const draw = () => {
      ctx.body.innerHTML = `${backBtn()}
        <div class="lib-intro">🧱 <span>Сверху — перевод. <b>Нажимайте</b> на слова по порядку или <b>перетаскивайте</b> их. Слово в строке можно нажать, чтобы вернуть, или перетащить на другое место. Иногда среди слов есть <b>лишнее</b>.</span></div>
        <div class="dr-label">Что тренировать <span class="muted small">(можно несколько)</span></div>
        <div class="ot-levels">${lv.map(l => `<button type="button" class="ot-level ${cur.has(l.id) ? 'on' : ''}${l.mine ? ' ot-level-mine' : ''}" data-lv="${l.id}" aria-pressed="${cur.has(l.id)}"><span class="ot-lv-ico" aria-hidden="true">${l.icon}</span><span class="ot-lv-txt"><b>${esc(l.name)}</b><small lang="${l.mine ? 'ru' : 'nb'}">${esc(l.short)}</small></span><span class="ot-lv-n">${l.n}</span></button>`).join('')}</div>
        ${mineLv ? '<div class="tiny muted ot-mine-note">🔒 «Мои ошибки» — предложения из вашего листка «Ordstilling» (God i norsk, гл. 2). Видны только на этом Mac.</div>' : ''}
        ${UI.switchHtml('ot-mine', p.mine, 'Добавлять простые предложения из моих карточек (если подходят под правило)')}
        <div class="ot-start"><button type="button" class="btn primary lg" data-start ${cur.size ? '' : 'disabled'}>▶ Начать (${ROUND} предложений)</button></div>`;
    };
    draw();
    ctx.body.onclick = e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.otGo) { ctx.go(t.dataset.otGo); return; }
      if (t.dataset.lv) { const id = t.dataset.lv; if (cur.has(id)) cur.delete(id); else cur.add(id); draw(); return; }
      if (t.hasAttribute('data-start')) {
        const sw = ctx.body.querySelector('[data-key="ot-mine"]');
        p.mine = !!(sw && sw.checked); p.woLevels = [...cur]; Store.save();
        startWo(ctx, [...cur], p.mine);
      }
    };
    ctx.onKey = e => { if (e.key === 'Enter' && !(e.target && e.target.closest && e.target.closest('button,input'))) { const b = ctx.body.querySelector('[data-start]'); if (b && !b.disabled) b.click(); } };
  };
  async function startWo(ctx, levels, mine) {
    const d = await data();
    if (levels.includes('mine')) await mineLevel();
    let pool = [];
    levels.forEach(id => {
      if (id === 'ask') pool = pool.concat(d.ask.map((x, j) => Object.assign({ level: 'ask', key: 'ask:' + j }, x)));
      else { const l = id === 'mine' ? MINE || null : d.levels.find(x => x.id === id); if (l) pool = pool.concat(l.items.map((x, j) => Object.assign({ level: id, key: id + ':' + j }, x))); }
    });
    let items = shuffle(pool).slice(0, ROUND);
    if (mine && (levels.includes('modal') || levels.includes('aa'))) {
      try {
        const g = (await fromCards()).wo.filter(x => levels.includes(x.level));
        const k = Math.min(g.length, Math.floor(ROUND * 0.3));
        if (k) items = shuffle(items.slice(0, ROUND - k).concat(shuffle(g).slice(0, k)));
      } catch (e) { /* only the built-in sentences */ }
    }
    if (!ctx.alive()) return;
    runWo(ctx, items, levels);
  }

  /* ---------- 🧱 the game ---------- */
  const ROLE_RU = { S: 'подлежащее', V: 'глагол', I: 'инфинитив', T: 'å', N: 'ikke / наречие', Q: 'вопрос. слово', C: 'союз' };
  function newSession(kind, items, extra) {
    const p = prog();
    return Object.assign({ kind, items, i: 0, points: 0, streak: 0, maxStreak: 0, best: p.best[kind] || 0, results: [] }, extra || {});
  }
  function award(S, ok) {
    const p = prog();
    let got = 0;
    if (ok) { S.streak++; got = 10 + Math.min(S.streak - 1, 5) * 2; S.points += got; } else S.streak = 0;
    S.maxStreak = Math.max(S.maxStreak, S.streak);
    // saved at once: closing in the middle keeps the points
    p.points += got;
    p.bestStreak = Math.max(p.bestStreak, S.streak);
    if (S.points > (p.best[S.kind] || 0)) p.best[S.kind] = S.points;
    const st = p.stats[S.kind] || (p.stats[S.kind] = { n: 0, ok: 0 });
    st.n++; if (ok) st.ok++;
    Store.save();
    return got;
  }
  function runWo(ctx, items, levels, S0) {
    const S = S0 || newSession('wo', items, { levels });
    let chunks = [], line = [], pool = [], answered = false;
    const lvName = it => it.level === 'ask' ? 'Задай вопрос к ответу' : ((levelOf(it.level) || {}).name || '');
    const prepare = () => {
      const it = S.items[S.i];
      chunks = it.w.map((t, j) => ({ t, r: it.r[j], id: j })).concat((it.x || []).map((t, j) => ({ t, r: 'X', x: true, id: it.w.length + j })));
      const k = it.k || 0;
      line = chunks.slice(0, k).map(c => c.id);
      let rest = chunks.slice(k).map(c => c.id);
      // shuffled — never already in the right order
      for (let tries = 0; tries < 8; tries++) { rest = shuffle(rest); if (rest.map(i => chunks[i].t).join(' ') !== it.w.slice(k).join(' ')) break; }
      pool = rest; answered = false;
    };
    const chip = (id, where) => {
      const c = chunks[id], it = S.items[S.i], lock = where === 'line' && id < (it.k || 0);
      return `<button type="button" class="ot-chip ${lock ? 'lock' : ''}" data-chip="${id}" data-where="${where}" ${lock ? 'disabled aria-disabled="true" title="Это слово уже на месте"' : ''} lang="nb">${lock ? '<span class="ot-lock" aria-hidden="true">🔒</span>' : ''}${esc(c.t)}</button>`;
    };
    const drawAreas = () => {
      const ln = ctx.body.querySelector('[data-line]'), pl = ctx.body.querySelector('[data-pool]');
      if (!ln || !pl) return;
      ln.innerHTML = line.map(id => chip(id, 'line')).join('') + (line.length ? '' : '<span class="ot-line-ph">Нажмите на слова внизу или перетащите их сюда</span>');
      pl.innerHTML = pool.map(id => chip(id, 'pool')).join('') || '<span class="ot-pool-ph">Все слова в строке ✓</span>';
      const ch = ctx.body.querySelector('[data-check]'); if (ch) ch.disabled = line.length <= (S.items[S.i].k || 0);
    };
    const show = () => {
      if (S.i >= S.items.length) { finish(); return; }
      ctx.inGame = S.results.length > 0;
      prepare();
      const it = S.items[S.i];
      const ask = it.level === 'ask';
      ctx.body.innerHTML = `${backBtn()}${scoreBar(S)}
        <div class="ot-task" data-item="${esc(it.key || 'mine')}">
          <div class="ot-badges"><span class="ot-badge">${esc(lvName(it))}</span>${it.mine ? '<span class="ot-badge mine" title="Предложение из ваших карточек">🗂 из ваших карточек</span>' : ''}</div>
          ${ask ? `<div class="ot-ask"><div class="ot-ask-a"><span class="muted small">Ответ:</span> <b lang="nb">${esc(it.a)}</b> <button type="button" class="media-btn sm" data-say-a title="Прослушать ответ" aria-label="Прослушать ответ">${SPK(16)}</button><div class="ru-text small">${esc(it.aRu)}</div></div>
            <div class="ot-ask-q">Задайте вопрос со словом <b class="ot-qw" lang="nb">${esc(it.qw)}</b></div></div>`
            : `<div class="ot-ru ru-text">${esc(it.ru)}</div>`}
        </div>
        <div class="ot-line" data-line aria-label="Ваше предложение"></div>
        <div class="ot-pool" data-pool aria-label="Слова"></div>
        <div class="ot-act"><button type="button" class="btn ghost" data-reset>↺ Сначала</button><button type="button" class="btn ghost" data-dunno>🤷 Не знаю</button><button type="button" class="btn primary" data-check disabled>Проверить</button></div>
        <div class="ot-fb" data-fb hidden></div>`;
      drawAreas();
    };
    const check = (dunno) => {
      if (answered) return;
      const it = S.items[S.i];
      const user = line.map(i => chunks[i].t).join(' ');
      const acc = accepted(it);
      const ok = !dunno && acc.includes(normS(user));
      const exact = ok && normS(user) === normS(it.w.join(' '));
      const hk = ok ? '' : dunno ? '' : diagnose(it.level, it, line, chunks);
      answered = true;
      const got = award(S, ok);
      S.results.push({ it, ok, given: dunno ? '' : sentence(line.map(i => chunks[i].t), it.p), hint: hk ? hintText(hk) : '' });
      ctx.inGame = S.i < S.items.length - 1;
      const right = itemText(it);
      const roleHtml = `<span class="ot-roles" lang="nb">${it.w.map((w, j) => `<span class="ot-r r-${it.r[j]}" title="${esc(ROLE_RU[it.r[j]] || '')}">${esc(j === 0 ? w[0].toUpperCase() + w.slice(1) : w)}${j === it.w.length - 1 ? esc(it.p || '.') : ''}</span>`).join(' ')}</span>`;
      const fb = ctx.body.querySelector('[data-fb]');
      fb.hidden = false;
      fb.className = 'ot-fb ' + (ok ? 'ok' : 'bad');
      fb.innerHTML = `<div class="ot-fb-head">${ok ? `✓ Верно! <span class="ot-plus">+${got}</span>${S.streak >= 3 ? ` <span class="ot-hot">🔥 ${S.streak} подряд</span>` : ''}` : dunno ? '🤷 Правильный порядок:' : '✗ Не совсем'}</div>
        ${!ok && !dunno ? `<div class="ot-hint">📏 ${esc(hintText(hk))}</div><div class="ot-given small muted">Ваш вариант: <s lang="nb">${esc(sentence(line.map(i => chunks[i].t), it.p))}</s></div>` : ''}
        ${it.myErr ? `<div class="ot-mine-fb">${ok ? '🎉 Получилось! ' : `📌 ${esc(it.mrule || MINE_RULE)} `}${it.wrong ? `<span class="small muted">На листке было: <s lang="nb">${esc(it.wrong)}</s>${ok ? ' — а теперь верно.' : ''}</span>` : ''}</div>` : ''}
        ${ok && !exact ? `<div class="small muted">Так тоже правильно. Чаще говорят:</div>` : ''}
        <div class="ot-right">${roleHtml} <button type="button" class="media-btn sm" data-say-r title="Прослушать" aria-label="Прослушать предложение">${SPK(16)}</button></div>
        <div class="ot-right-ru ru-text small">${esc(it.ru)}</div>
        <div class="ot-legend small muted"><span class="ot-r r-V">глагол</span> <span class="ot-r r-S">подлежащее</span> <span class="ot-r r-N">ikke</span> <span class="ot-r r-I">инфинитив</span>${/[QC]/.test(it.r) ? ' <span class="ot-r r-Q">вопрос / союз</span>' : ''}</div>
        <div class="ot-fb-act">${!ok ? `<button type="button" class="btn sm" data-mk>➕ в карточки</button>` : ''}<button type="button" class="btn primary" data-next>${S.i + 1 < S.items.length ? 'Дальше →' : 'Итоги'}</button></div>`;
      ctx.body.querySelectorAll('[data-chip]').forEach(b => { b.disabled = true; });
      ['[data-check]', '[data-reset]', '[data-dunno]'].forEach(s => { const b = ctx.body.querySelector(s); if (b) b.disabled = true; });
      const sc = ctx.body.querySelector('.ot-score'); if (sc) sc.outerHTML = scoreBar(S);
      say(right);
      setTimeout(() => { const n = ctx.body.querySelector('[data-next]'); if (n) { try { n.focus({ preventScroll: true }); } catch (e) { /* ignore */ } n.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }, 60);
    };
    const move = (id, toLine, at) => {
      const it = S.items[S.i];
      if (answered || id < (it.k || 0)) return;
      line = line.filter(x => x !== id); pool = pool.filter(x => x !== id);
      if (toLine) { const k = it.k || 0; const pos = at == null ? line.length : Math.max(k, Math.min(at, line.length)); line.splice(pos, 0, id); }
      else pool.push(id);
      drawAreas();
    };
    const finish = () => { ctx.inGame = false; resultsView(ctx, S, () => startWo(ctx, levels, prog().mine), mistakes => runWo(ctx, mistakes, levels)); };
    ctx.body.onclick = async e => {
      const t = e.target.closest('button'); if (!t || t.disabled) return;
      if (t.dataset.otGo === 'hub') { if (await askEnd(ctx)) ctx.go('hub'); return; }
      if (t.dataset.chip != null) { if (dragJustEnded) return; move(+t.dataset.chip, t.dataset.where === 'pool'); return; }
      if (t.hasAttribute('data-reset')) { const k = S.items[S.i].k || 0; pool = pool.concat(line.slice(k)); line = line.slice(0, k); drawAreas(); return; }
      if (t.hasAttribute('data-check')) { check(false); return; }
      if (t.hasAttribute('data-dunno')) { check(true); return; }
      if (t.hasAttribute('data-say-r')) { say(itemText(S.items[S.i])); return; }
      if (t.hasAttribute('data-say-a')) { say(S.items[S.i].a); return; }
      if (t.hasAttribute('data-mk')) { addCards([S.results[S.results.length - 1]], ctx, t); return; }
      if (t.hasAttribute('data-next')) { S.i++; show(); }
    };
    ctx.onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (answered && (e.key === 'Enter' || e.key === ' ') && !(e.target && e.target.closest && e.target.closest('button'))) { e.preventDefault(); S.i++; show(); return; }
      if (!answered && e.key === 'Enter' && !(e.target && e.target.closest && e.target.closest('button'))) { const b = ctx.body.querySelector('[data-check]'); if (b && !b.disabled) { e.preventDefault(); check(false); } }
      if (!answered && e.key === 'Backspace' && !(e.target && e.target.matches && e.target.matches('input,textarea'))) { const k = S.items[S.i].k || 0; if (line.length > k) { e.preventDefault(); move(line[line.length - 1], false); } }
    };
    // ✋ drag: pointer events (mouse, finger, pen) — into the line at a place, inside the line, back to the pool
    let dragJustEnded = false;
    ctx.body.onpointerdown = e => {
      const b = e.target.closest('[data-chip]');
      if (!b || b.disabled || answered || e.button > 0) return;
      const id = +b.dataset.chip, sx = e.clientX, sy = e.clientY;
      let ghost = null, mark = null, dragging = false;
      const lineEl = ctx.body.querySelector('[data-line]'), poolEl = ctx.body.querySelector('[data-pool]');
      const inside = (el, x, y, pad = 14) => { const r = el.getBoundingClientRect(); return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad; };
      const slotAt = (x, y) => {
        const els = [...lineEl.querySelectorAll('[data-chip]')].filter(el => +el.dataset.chip !== id);
        let at = els.length;
        for (let j = 0; j < els.length; j++) {
          const r = els[j].getBoundingClientRect();
          if (y < r.top - 4) { at = j; break; }
          if (y <= r.bottom + 4 && x < r.left + r.width / 2) { at = j; break; }
        }
        return { at, before: els[at] || null };
      };
      const mv = ev => {
        if (!dragging) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
          dragging = true;
          const r = b.getBoundingClientRect();
          ghost = b.cloneNode(true); ghost.classList.add('ot-ghost'); ghost.removeAttribute('data-chip');
          ghost.style.width = r.width + 'px'; document.body.appendChild(ghost);
          b.classList.add('dragging');
          mark = document.createElement('span'); mark.className = 'ot-caret'; mark.setAttribute('aria-hidden', 'true');
        }
        ev.preventDefault();
        ghost.style.left = (ev.clientX - ghost.offsetWidth / 2) + 'px'; ghost.style.top = (ev.clientY - ghost.offsetHeight / 2) + 'px';
        const over = inside(lineEl, ev.clientX, ev.clientY);
        lineEl.classList.toggle('drop', over); poolEl.classList.toggle('drop', !over && inside(poolEl, ev.clientX, ev.clientY));
        if (over) { const s = slotAt(ev.clientX, ev.clientY); if (s.before) lineEl.insertBefore(mark, s.before); else lineEl.appendChild(mark); }
        else if (mark.parentNode) mark.remove();
      };
      const up = ev => {
        document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
        if (!dragging) return;
        dragJustEnded = true; setTimeout(() => { dragJustEnded = false; }, 60);
        if (ghost) ghost.remove(); b.classList.remove('dragging');
        lineEl.classList.remove('drop'); poolEl.classList.remove('drop');
        const overLine = ev.type !== 'pointercancel' && inside(lineEl, ev.clientX, ev.clientY);
        const overPool = ev.type !== 'pointercancel' && inside(poolEl, ev.clientX, ev.clientY);
        if (overLine) {
          // slotAt counts the chips of the line without the dragged one — the same list move() inserts into
          const s = slotAt(ev.clientX, ev.clientY);
          if (mark && mark.parentNode) mark.remove();
          move(id, true, s.at);
        } else {
          if (mark && mark.parentNode) mark.remove();
          if (overPool) move(id, false); else drawAreas();
        }
      };
      document.addEventListener('pointermove', mv, { passive: false }); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
    };
    show();
  }
  async function askEnd(ctx) {
    if (!ctx.inGame) return true;
    const r = await UI.askClose({ title: 'Закончить?', line: 'Очки сохранятся.', actions: [{ label: 'Закончить', value: 'end', cls: 'primary' }], cancel: 'Продолжить' });
    return r === 'end';
  }

  /* ---------- results + mistakes replay + «➕ в карточки» ---------- */
  function resultsView(ctx, S, again, replay) {
    ctx.inGame = false;
    const ok = S.results.filter(r => r.ok).length, n = S.results.length;
    const wrong = S.results.filter(r => !r.ok);
    const pct = n ? Math.round(ok / n * 100) : 0;
    const p = prog();
    const record = S.points > 0 && S.points >= (p.best[S.kind] || 0) && S.points > S.best;
    ctx.body.innerHTML = `${backBtn(S.back || 'hub', S.backLabel || '← Все тренажёры')}
      <div class="ot-results">
        <div class="dr-ring" style="--p:${pct}"><b>${S.points}</b><span>очков</span></div>
        <h3>${record ? '🏆 Новый рекорд!' : pct >= 90 ? '🎉 Отлично!' : pct >= 60 ? '👍 Хорошо!' : '💪 Ошибки — повторим'}</h3>
        <div class="ot-res-stats"><span>✓ ${ok} из ${n}</span><span>🔥 лучшая серия: ${S.maxStreak}</span><span>🏆 рекорд: ${Math.max(p.best[S.kind] || 0, S.points)}</span></div>
        <div class="dr-res-act"><button type="button" class="btn primary" data-again>🔁 Ещё раунд</button>${wrong.length ? `<button type="button" class="btn" data-replay>🎯 Повторить ошибки (${wrong.length})</button><button type="button" class="btn" data-mk-all>➕ Все ошибки в карточки</button>` : ''}</div>
      </div>
      <div class="dr-res-list">${S.results.map((r, i) => `<div class="dr-res-row ${r.ok ? 'ok' : 'bad'}"><span class="dr-res-ico" aria-label="${r.ok ? 'верно' : 'ошибка'}">${r.ok ? '✓' : '✗'}</span>
        <div class="dr-res-txt"><span lang="nb">${esc(resText(S.kind, r.it))}</span><div class="small ru-text">${esc(r.it.ru)}</div>${!r.ok && r.given ? `<div class="small muted">ваш ответ: <span lang="nb">${esc(r.given)}</span></div>` : ''}${!r.ok && r.hint ? `<div class="small ot-res-hint">📏 ${esc(r.hint)}</div>` : ''}</div>
        <button type="button" class="media-btn sm" data-say-i="${i}" title="Прослушать" aria-label="Прослушать">${SPK(16)}</button>
        ${!r.ok ? `<button type="button" class="btn sm" data-mk-i="${i}" title="Добавить в карточки">➕</button>` : ''}</div>`).join('')}</div>`;
    ctx.body.onclick = e => {
      const t = e.target.closest('button'); if (!t || t.disabled) return;
      if (t.dataset.otGo) { ctx.go(t.dataset.otGo); return; }
      if (t.hasAttribute('data-again')) { again(); return; }
      if (t.hasAttribute('data-replay')) { replay(shuffle(wrong.map(r => r.it))); return; }
      if (t.hasAttribute('data-mk-all')) { addCards(wrong, ctx, t); return; }
      if (t.dataset.sayI != null) { const r = S.results[+t.dataset.sayI]; if (r) say(resText(S.kind, r.it)); return; }
      if (t.dataset.mkI != null) { const r = S.results[+t.dataset.mkI]; if (r) addCards([r], ctx, t); }
    };
    ctx.onKey = null;
    if (record) { try { UI.confetti(90); } catch (e) { /* ignore */ } }
  }
  const gapText = (it, a) => it.s.replace(/___\s*/, a === 'å' ? 'å ' : '');
  const kindOf = it => it.wtask ? 'wr' : it.parts ? 'pos' : it.form ? 'tforms' : it.s ? 'aa' : it.q ? 'qw' : 'wo';
  const resText = (kind, it) => it.wtask ? it.no : it.parts ? slotText(it) : it.form ? `${it.form.head} → ${it.form.answer}` : kind === 'wo' ? itemText(it) : kind === 'aa' ? gapText(it, it.a === '-' ? '-' : 'å') : `${it.q.replace('___', it.w)} — ${it.a}`;
  /** missed sentences → the deck «🧩 Порядок слов: мои ошибки» (no twins) */
  function addCards(rows, ctx, btn) {
    let deck = Store.decks().find(d => d.name === DECK_MISTAKES);
    if (!deck) deck = Store.addDeck(DECK_MISTAKES, 'Предложения, в которых были ошибки, — из тренажёров «Собери предложение», «å или нет?», «Какое вопросительное слово?», «Порядок слов — таблица позиций», «Напиши сам», «Впиши форму».');
    const have = new Set(Store.cards(deck.id).map(c => U.norm(c.no)));
    let made = 0;
    rows.forEach(r => {
      const it = r.it, kind = kindOf(it);
      const no = Store.Safe.text(kind === 'qw' ? `${it.q.replace('___', it.w)} — ${it.a}` : resText(kind, it), 400);
      if (!no || have.has(U.norm(no))) return;
      have.add(U.norm(no));
      const rule = kind === 'wo' ? (it.myErr && it.mrule ? it.mrule : r.hint || ((levelOf(it.level) || {}).rule) || '') : kind === 'pos' || kind === 'tforms' ? r.hint || ''
        : kind === 'wr' ? [r.hint || tx(it.tip), r.given ? `Мой вариант: ${r.given}` : ''].filter(Boolean).join('\n') : it.why || '';
      const tool = kind === 'tforms' ? 'Впиши форму' : kind === 'wr' ? 'Напиши сам' : TOOL[kind].name;
      const bn = it.source && DATA.slots && DATA.slots.sources[it.source];
      const src = it.myErr ? '📌 Мой листок «Ordstilling» (God i norsk, гл. 2) — личное' : bn ? `${bn.label} (${bn.url})` : it.form && it.form.src ? `Источник: ${it.form.src}` : 'Norsk Kort (собственный материал)';
      Store.addCard(deck.id, Object.assign(it.myErr ? { personal: true } : {}, {
        no, ru: Store.Safe.text(it.ru, 400), wordClass: kind === 'qw' ? 'spørreord' : kind === 'tforms' ? (it.form.wordClass || 'form') : 'setning',
        description: Store.Safe.text(`📏 ${rule}\n${src} — тренажёр «${tool}»`, 1000),
        tags: kind === 'tforms' ? ['bøying', 'former'] : ['ordstilling', kind === 'aa' ? 'infinitiv' : kind === 'qw' ? 'spørreord' : kind === 'wr' ? 'skriving' : 'setning'],
        history: [Prov.entry('manual', 'create', null, `тренажёр «${tool}»`)],
      }));
      made++;
    });
    ctx.dirty = true;
    if (btn) { btn.disabled = true; btn.textContent = made ? '✓ Добавлено' : '✓ Уже в карточках'; }
    UI.toast(made ? `➕ ${U.cards(made)} в колоде «${DECK_MISTAKES}»` : 'Эти предложения уже есть в карточках', made ? 'good' : '', 3500);
  }

  /* ---------- å или нет? ---------- */
  VIEWS.aa = async (ctx, o) => {
    ctx.title('å или нет?');
    ctx.body.innerHTML = '<div class="ot-loading"><span class="spinner"></span> Загружаю предложения…</div>';
    const d = await data();
    let items = shuffle(d.aa).slice(0, ROUND);
    if (prog().mine) {
      try { const g = (await fromCards()).aa; const k = Math.min(g.length, 3); if (k) items = shuffle(items.slice(0, ROUND - k).concat(shuffle(g).slice(0, k))); } catch (e) { /* built-in only */ }
    }
    if (!ctx.alive()) return;
    runAa(ctx, o.items || items);
  };
  function runAa(ctx, items) {
    const S = newSession('aa', items);
    let answered = false;
    const show = () => {
      if (S.i >= S.items.length) { resultsView(ctx, S, () => ctx.go('aa'), m => runAa(ctx, m)); return; }
      ctx.inGame = S.results.length > 0; answered = false;
      const it = S.items[S.i];
      const [a, b] = it.s.split('___');
      ctx.body.innerHTML = `${backBtn()}${scoreBar(S)}
        <div class="ot-task">${it.mine ? '<div class="ot-badges"><span class="ot-badge mine">🗂 из ваших карточек</span></div>' : ''}
          <div class="ot-gap-s" lang="nb">${esc(a)}<span class="ot-gap" data-gap>___</span>${esc(b)}</div>
          <div class="ot-ru ru-text small">${esc(it.ru)}</div></div>
        <div class="ot-opts two"><button type="button" class="ot-opt" data-a="å"><b lang="nb">å</b><small>нужен å</small></button><button type="button" class="ot-opt" data-a="-"><b>—</b><small>без å</small></button></div>
        <div class="tiny muted ot-keys">Клавиши: 1 — «å», 2 — «без å»</div>
        <div class="ot-fb" data-fb hidden></div>`;
    };
    const answer = v => {
      if (answered) return;
      answered = true;
      const it = S.items[S.i];
      const ok = it.a === '*' || v === it.a;
      const got = award(S, ok);
      S.results.push({ it, ok, given: gapText(it, v), hint: ok ? '' : it.why });
      ctx.inGame = S.i < S.items.length - 1;
      ctx.body.querySelectorAll('[data-a]').forEach(b => { b.disabled = true; const right = it.a === '*' || b.dataset.a === it.a; b.classList.toggle('right', right); b.classList.toggle('wrong', b.dataset.a === v && !right); });
      const g = ctx.body.querySelector('[data-gap]');
      if (g) { const shown = it.a === '*' ? v : it.a; g.textContent = shown === 'å' ? 'å' : '—'; g.classList.add('ok'); }
      const spoken = gapText(it, it.a === '*' ? v : it.a);
      const fb = ctx.body.querySelector('[data-fb]');
      fb.hidden = false; fb.className = 'ot-fb ' + (ok ? 'ok' : 'bad');
      fb.innerHTML = `<div class="ot-fb-head">${ok ? `✓ Верно! <span class="ot-plus">+${got}</span>${S.streak >= 3 ? ` <span class="ot-hot">🔥 ${S.streak} подряд</span>` : ''}` : '✗ Не совсем'}</div>
        <div class="ot-hint">📏 ${esc(it.why)}</div>
        <div class="ot-right"><span lang="nb">${esc(spoken)}</span> <button type="button" class="media-btn sm" data-say-r title="Прослушать" aria-label="Прослушать предложение">${SPK(16)}</button></div>
        <div class="ot-fb-act">${!ok ? '<button type="button" class="btn sm" data-mk>➕ в карточки</button>' : ''}<button type="button" class="btn primary" data-next>${S.i + 1 < S.items.length ? 'Дальше →' : 'Итоги'}</button></div>`;
      const sc = ctx.body.querySelector('.ot-score'); if (sc) sc.outerHTML = scoreBar(S);
      say(spoken);
      setTimeout(() => { const n = ctx.body.querySelector('[data-next]'); if (n) { try { n.focus({ preventScroll: true }); } catch (e) { /* ignore */ } n.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }, 60);
    };
    ctx.body.onclick = async e => {
      const t = e.target.closest('button'); if (!t || t.disabled) return;
      if (t.dataset.otGo === 'hub') { if (await askEnd(ctx)) ctx.go('hub'); return; }
      if (t.dataset.a) { answer(t.dataset.a); return; }
      if (t.hasAttribute('data-say-r')) { const it = S.items[S.i]; say(gapText(it, it.a === '-' ? '-' : 'å')); return; }
      if (t.hasAttribute('data-mk')) { addCards([S.results[S.results.length - 1]], ctx, t); return; }
      if (t.hasAttribute('data-next')) { S.i++; show(); }
    };
    ctx.onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!answered && (e.key === '1' || e.key === '2')) { e.preventDefault(); answer(e.key === '1' ? 'å' : '-'); return; }
      if (answered && (e.key === 'Enter' || e.key === ' ') && !(e.target && e.target.closest && e.target.closest('button'))) { e.preventDefault(); S.i++; show(); }
    };
    show();
  }

  /* ---------- ❓ Какое вопросительное слово? ---------- */
  const CONFUSE = {
    'Hvor mye': ['Hvor mange', 'Hvor lenge', 'Hvor ofte'], 'Hvor mange': ['Hvor mye', 'Hvor ofte', 'Hvor gammel'], 'Hvor lenge': ['Når', 'Hvor ofte', 'Hvor mye'],
    'Hvor ofte': ['Når', 'Hvor lenge', 'Hvor mange'], 'Hvilken': ['Hvilket', 'Hvilke', 'Hva slags'], 'Hvilket': ['Hvilken', 'Hvilke', 'Hva slags'], 'Hvilke': ['Hvilken', 'Hvilket', 'Hva slags'],
    'Hva slags': ['Hvilken', 'Hva', 'Hvordan'], 'Hvem sin': ['Hvem', 'Hvilken', 'Hva'], 'Hvor gammel': ['Hvor mange', 'Hvor lenge', 'Når'],
    Hva: ['Hvem', 'Hvordan', 'Hvor'], Hvem: ['Hva', 'Hvem sin', 'Hvor'], Hvor: ['Når', 'Hva', 'Hvordan'], Når: ['Hvor', 'Hvor lenge', 'Hvor ofte'], Hvorfor: ['Hvordan', 'Hva', 'Når'], Hvordan: ['Hva', 'Hvorfor', 'Hvor'],
  };
  function qwOptions(it, list) {
    const bad = new Set([it.w, ...(it.also || [])]);
    const pick = (CONFUSE[it.w] || []).filter(x => !bad.has(x));
    const rest = shuffle(list.filter(x => !bad.has(x) && !pick.includes(x)));
    return shuffle([it.w, ...pick.concat(rest).slice(0, 3)]);
  }
  VIEWS.qw = async (ctx, o) => {
    ctx.title('❓ Какое вопросительное слово?');
    ctx.body.innerHTML = '<div class="ot-loading"><span class="spinner"></span> Загружаю вопросы…</div>';
    const d = await data();
    if (!ctx.alive()) return;
    runQw(ctx, o.items || shuffle(d.qw).slice(0, ROUND));
  };
  function runQw(ctx, items) {
    const S = newSession('qw', items);
    let answered = false, opts = [];
    const show = () => {
      if (S.i >= S.items.length) { resultsView(ctx, S, () => ctx.go('qw'), m => runQw(ctx, m)); return; }
      ctx.inGame = S.results.length > 0; answered = false;
      const it = S.items[S.i];
      opts = qwOptions(it, DATA.qwList);
      ctx.body.innerHTML = `${backBtn()}${scoreBar(S)}
        <div class="ot-task">
          <div class="ot-dialog"><div class="ot-bubble q" lang="nb"><span class="ot-gap" data-gap>___</span>${esc(it.q.replace(/^___/, ''))}</div>
          <div class="ot-bubble a" lang="nb">${esc(it.a)} <button type="button" class="media-btn sm" data-say-a title="Прослушать ответ" aria-label="Прослушать ответ">${SPK(16)}</button></div></div>
          <div class="small muted">Какое слово спрашивает об этом ответе?</div></div>
        <div class="ot-opts">${opts.map((x, j) => `<button type="button" class="ot-opt" data-o="${j}"><b lang="nb">${esc(x)}</b><small>${j + 1}</small></button>`).join('')}</div>
        <div class="ot-fb" data-fb hidden></div>`;
    };
    const answer = j => {
      if (answered) return;
      answered = true;
      const it = S.items[S.i], v = opts[j];
      const ok = v === it.w || (it.also || []).includes(v);
      const got = award(S, ok);
      S.results.push({ it, ok, given: `${it.q.replace('___', v)}`, hint: ok ? '' : it.why });
      ctx.inGame = S.i < S.items.length - 1;
      ctx.body.querySelectorAll('[data-o]').forEach(b => { b.disabled = true; const x = opts[+b.dataset.o]; const right = x === it.w || (it.also || []).includes(x); b.classList.toggle('right', right); b.classList.toggle('wrong', +b.dataset.o === j && !right); });
      const g = ctx.body.querySelector('[data-gap]'); if (g) { g.textContent = ok ? v : it.w; g.classList.add('ok'); }
      const q = it.q.replace('___', ok ? v : it.w);
      const fb = ctx.body.querySelector('[data-fb]');
      fb.hidden = false; fb.className = 'ot-fb ' + (ok ? 'ok' : 'bad');
      fb.innerHTML = `<div class="ot-fb-head">${ok ? `✓ Верно! <span class="ot-plus">+${got}</span>${S.streak >= 3 ? ` <span class="ot-hot">🔥 ${S.streak} подряд</span>` : ''}` : `✗ Правильно: <b lang="nb">${esc(it.w)}</b>`}</div>
        <div class="ot-hint">📏 ${esc(it.why)}${it.also && it.also.length ? ` Можно и: ${esc(it.also.join(', '))}.` : ''}</div>
        <div class="ot-right"><span lang="nb">${esc(q)} — ${esc(it.a)}</span> <button type="button" class="media-btn sm" data-say-r title="Прослушать" aria-label="Прослушать вопрос и ответ">${SPK(16)}</button></div>
        <div class="ot-right-ru ru-text small">${esc(it.ru)}</div>
        <div class="ot-fb-act">${!ok ? '<button type="button" class="btn sm" data-mk>➕ в карточки</button>' : ''}<button type="button" class="btn primary" data-next>${S.i + 1 < S.items.length ? 'Дальше →' : 'Итоги'}</button></div>`;
      const sc = ctx.body.querySelector('.ot-score'); if (sc) sc.outerHTML = scoreBar(S);
      say(`${q} ${it.a}`);
      setTimeout(() => { const n = ctx.body.querySelector('[data-next]'); if (n) { try { n.focus({ preventScroll: true }); } catch (e) { /* ignore */ } n.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }, 60);
    };
    ctx.body.onclick = async e => {
      const t = e.target.closest('button'); if (!t || t.disabled) return;
      if (t.dataset.otGo === 'hub') { if (await askEnd(ctx)) ctx.go('hub'); return; }
      if (t.dataset.o != null) { answer(+t.dataset.o); return; }
      if (t.hasAttribute('data-say-a')) { say(S.items[S.i].a); return; }
      if (t.hasAttribute('data-say-r')) { const it = S.items[S.i]; say(`${it.q.replace('___', it.w)} ${it.a}`); return; }
      if (t.hasAttribute('data-mk')) { addCards([S.results[S.results.length - 1]], ctx, t); return; }
      if (t.hasAttribute('data-next')) { S.i++; show(); }
    };
    ctx.onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!answered && /^[1-4]$/.test(e.key)) { e.preventDefault(); answer(+e.key - 1); return; }
      if (answered && (e.key === 'Enter' || e.key === ' ') && !(e.target && e.target.closest && e.target.closest('button'))) { e.preventDefault(); S.i++; show(); }
    };
    show();
  }

  /* ================= 📊 «Порядок слов — таблица позиций» (slot table, the Bnorsk.no sheet model) ================= */
  // texts that may later have a Ukrainian version: { ru, uk } — tx() picks the UI language (ru for now)
  const LANG = 'ru';
  const tx = o => (o == null ? '' : typeof o === 'string' ? o : o[LANG] || o.ru || '');
  const COLK = { hs: ['f', 'v', 's', 'sa', 'v2', 'o', 'a'], q: ['q', 'v', 's', 'sa', 'v2', 'o', 'a'], yn: ['v', 's', 'sa', 'v2', 'o', 'a'], ls: ['sj', 's', 'sa', 'v', 'o', 'a'] };
  const VERB_COL = { hs: ['v', 'v2'], q: ['v', 'v2'], yn: ['v', 'v2'], ls: ['v'] };
  const TIME_RE = /^(i (dag|går|morgen|kveld|fjor|år|sommer|vinter|helgene)|nå|om (morgenen|kvelden)|etter (jobben|skolen)|klokka \S+|på (mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag))$/i;
  const QSUBJ = ['hva', 'hvem', 'hvordan', 'hvilken', 'hvilket', 'hvilke', 'hvorfor'];
  const endMark = it => (/[?!]$/.test(it.no || '') ? it.no.slice(-1) : '.');
  /** the chunks of a sentence in order: { t, part, slot, lock?, punct? } (the lead main clause of a leddsetning is locked) */
  function slotChunks(it) {
    const out = [];
    it.parts.forEach((p, pi) => {
      if (p.lead) out.push({ t: p.lead, part: pi, slot: 'lead', lock: pi === 0 });
      COLK[p.t].forEach(k => { if (p.c[k]) out.push({ t: p.c[k], part: pi, slot: k }); });
      if (p.end && pi < it.parts.length - 1) out.push({ t: p.end, part: pi, slot: 'p', punct: true });
    });
    return out;
  }
  /** chunks → a sentence: «,» and «.» glued, capital letters at the start and after a full stop, end mark */
  function assemble(ts, p) {
    let s = ts.join(' ').replace(/\s+([,.])/g, '$1').replace(/\s+/g, ' ').trim();
    s = s.replace(/(^|[.!?]\s+)([a-zæøå])/g, (m, a, b) => a + b.toUpperCase());
    return s ? s + (p || '.') : '';
  }
  const slotText = it => assemble(slotChunks(it).map(c => c.t), endMark(it));
  /** for comparing built sentences: case, spaces, quotes and the end mark do not matter — commas and inner full stops do */
  const normB = s => low(s).replace(/[«»"!?]/g, ' ').replace(/\s+([,.])/g, '$1').replace(/\s+/g, ' ').trim().replace(/[.]$/, '').trim();
  const slotSets = () => {
    const S = (DATA && DATA.slots) || {};
    return { sa: new Set((S.sa || []).map(low)), names: new Set(S.names || []) };
  };
  /** which reason / rule explains a chunk's column (keys of slots.why) */
  function whyKey(it, ch) {
    if (!ch) return 'other';
    if (ch.slot === 'p') return 'p.' + ch.t;
    if (ch.slot === 'lead') return 'ls.lead';
    const p = it.parts[ch.part], c = p.c, sets = slotSets();
    if (p.t === 'hs') {
      if (ch.slot === 'f') {
        const f = low(c.f);
        if (!c.s) return 'hs.f.s';
        if (f === 'derfor') return 'hs.f.derfor';
        if (sets.sa.has(f)) return 'hs.f.sa';
        return p.fo ? 'hs.f.o' : 'hs.f.a';
      }
      if (ch.slot === 'v' && p.lsF) return 'hs.v.lsF';
      return 'hs.' + ch.slot;
    }
    if (p.t === 'ls' && ch.slot === 'sj') {
      const sj = low(c.sj);
      if (sj === 'som') return 'ls.sj.som';
      if (QSUBJ.includes(sj) || (['hvor', 'når'].includes(sj) && /\b(spør|spurte|lurer|vet|si|sier|forstår)\b/i.test(p.lead || ''))) return 'ls.sj.q';
      return 'ls.sj';
    }
    return p.t + '.' + ch.slot;
  }
  const whyText = key => {
    const W = (DATA && DATA.slots && DATA.slots.why) || {};
    return tx(W[key]) || HINT_EXTRA[key] || hintText('other');
  };
  /** the chips of «Собери» / «Переделай»: lower-case at the start of a sentence (names stay), the lead locked, distractors */
  function lineChunks(it, extra) {
    const sets = slotSets(), ch = slotChunks(it).map(c => Object.assign({}, c));
    ch.forEach((c, i) => {
      const start = i === 0 || (ch[i - 1].slot === 'p' && ch[i - 1].t === '.');
      if (start && !c.lock && !sets.names.has(c.t.split(' ')[0])) c.t = c.t[0].toLowerCase() + c.t.slice(1);
    });
    return ch.concat((extra || []).map(t => ({ t, x: true })));
  }
  /** other orders that are just as right (one main clause): time / sentence adverbial moved to the front or to the end */
  function slotAlts(it) {
    if (it.parts.length !== 1 || it.parts[0].t !== 'hs' || it.noAlt) return [];
    const c = it.parts[0].c, out = [], sets = slotSets();
    const j = a => a.filter(Boolean).join(' ');
    if (!c.s && c.a && TIME_RE.test(c.a)) out.push(j([c.a, c.v, c.f, c.sa, c.v2, c.o]));
    if (c.s && c.f) {
      const f = low(c.f);
      if (sets.sa.has(f)) out.push(j([c.s, c.v, f, c.sa, c.v2, c.o, c.a]));
      else if (TIME_RE.test(f)) out.push(j([c.s, c.v, c.sa, c.v2, c.o, c.a, f]));
    }
    return out.concat(it.alt || []);
  }
  /** a built order (chunk objects) → { ok, exact, key (why) , chunk } */
  function judgeLine(it, given) {
    const user = assemble(given.map(c => c.t), endMark(it));
    const right = slotText(it);
    const acc = new Set([right, ...slotAlts(it)].map(normB));
    const ok = !given.some(c => c.x) && acc.has(normB(user));
    if (ok) return { ok, exact: normB(user) === normB(right), user };
    const key = lineChunks(it);
    const x = given.find(c => c.x);
    if (x) { const k = 'x.' + low(x.t); return { ok, user, key: DATA.slots.why[k] ? k : it._tr && it._tr.type === 'som' ? 'x.som' : 'extra', chunk: x }; }
    const left = key.filter(k => !given.some(g => g === k || (g.t === k.t && g.part === k.part && g.slot === k.slot)));
    if (left.length) return { ok, user, key: left.every(k => k.punct) ? 'p.' + left[0].t : 'missing', chunk: left[0] };
    for (let i = 0; i < key.length; i++) {
      const k = key[i], g = given[i];
      if (g && low(g.t) === low(k.t)) continue;
      if (k.punct) return { ok, user, key: 'p.' + k.t, chunk: k };
      if (g && g.punct) return { ok, user, key: 'p.' + g.t, chunk: g };
      if (g && g.slot === 'sa' && g.part != null) return { ok, user, key: whyKey(it, g), chunk: g };
      return { ok, user, key: whyKey(it, k), chunk: k };
    }
    return { ok, user, key: 'other' };
  }
  /** «Разложи»: { 'part:slot': text } placed by the user → which cells are wrong (O ↔ A of the same clause is forgiven) */
  function sortCheck(it, place) {
    const key = {};
    it.parts.forEach((p, pi) => Object.entries(p.c).forEach(([k, v]) => { key[pi + ':' + k] = v; }));
    const pl = Object.assign({}, place), soft = [];
    it.parts.forEach((p, pi) => {
      const o = pi + ':o', a = pi + ':a';
      [[o, a], [a, o]].forEach(([x, y]) => {
        if (pl[x] && !key[x] && !pl[y] && key[y] && low(pl[x]) === low(key[y])) { soft.push({ cell: x, want: y, t: pl[x] }); pl[y] = pl[x]; delete pl[x]; }
      });
    });
    const cells = new Set(Object.keys(key).concat(Object.keys(pl)));
    const wrong = [...cells].filter(c => low(key[c] || '') !== low(pl[c] || ''));
    // the first wrong word in sentence order — for the one-line rule
    const order = slotChunks(it).filter(c => !c.punct && c.slot !== 'lead');
    const first = order.find(c => wrong.includes(c.part + ':' + c.slot));
    return { ok: !wrong.length, wrong, soft, first, why: first ? whyKey(it, first) : '' };
  }
  /** «Смотреть»: the steps of the animation (each word with its reason; the empty Subjekt after som; the leddsetning in front) */
  function watchSteps(it) {
    const steps = [], seen = new Set();
    slotChunks(it).forEach(ch => {
      const p = it.parts[ch.part];
      if (p.lsF && !seen.has(ch.part)) { seen.add(ch.part); steps.push({ empty: { part: ch.part, slot: 'f' }, why: 'hs.lsF' }); }
      steps.push({ ch, why: whyKey(it, ch) });
      if (p.t === 'ls' && ch.slot === 'sj' && low(p.c.sj) === 'som' && !p.c.s) steps.push({ empty: { part: ch.part, slot: 's' }, why: 'ls.s.som' });
    });
    return steps;
  }
  /** does the analysis follow the rules of its clause type? → '' or what is wrong (for the checks) */
  function validateSlots(it) {
    const S = DATA.slots, sa = new Set(S.sa), subj = new Set(S.subj.concat(S.subjQ));
    if (!it.id || !it.g || !it.no || !it.ru || !Array.isArray(it.parts) || !it.parts.length) return 'shape';
    if (slotText(it) !== it.no) return `text: «${slotText(it)}» ≠ «${it.no}»`;
    for (let i = 0; i < it.parts.length; i++) {
      const p = it.parts[i], c = p.c;
      if (!COLK[p.t]) return 'type';
      if (Object.keys(c).some(k => !COLK[p.t].includes(k))) return 'slot';
      if (!c.v) return 'no verb';
      if (c.sa && !c.sa.split(' ').every(w => sa.has(low(w)))) return 'not a setningsadverbial: ' + c.sa;
      if (p.t !== 'ls' && /\s/.test(c.v)) return 'one finite verb in V';
      if (p.t === 'hs') {
        if (!c.f && !p.lsF) return 'hs: F empty';
        if (p.lsF && (i === 0 || it.parts[i - 1].t !== 'ls' || it.parts[i - 1].end !== ',')) return 'hs: leddsetning first needs a comma';
        if (p.lsF && !c.s) return 'hs: no inversion after the leddsetning';
      }
      if (p.t === 'q' && (!c.q || !/^(hv|når)/i.test(c.q) || !c.s)) return 'q: Q V S';
      if (p.t === 'yn' && (!c.s || endMark(it) !== '?')) return 'yn: V S ?';
      if (p.t === 'ls') {
        if (!c.sj || !subj.has(low(c.sj))) return 'ls: not a subjunksjon: ' + c.sj;
        if (!c.s && low(c.sj) !== 'som') return 'ls: no subject';
        if (p.lead && i > 0) return 'ls: lead only first';
        if (!p.lead && i === 0 && !p.end) return 'ls: alone';
      }
    }
    return '';
  }
  function slotItems(d) {
    const S = d.slots, on = id => !(S.sources && S.sources[id] && S.sources[id].on === false);
    return S.items.filter(it => !it.source || on(it.source));
  }
  function trItems(d) {
    const items = slotItems(d), byId = id => items.find(x => x.id === id);
    return d.slots.tr.map(t => {
      const to = byId(t.to), from = typeof t.from === 'string' ? byId(t.from) : t.from;
      if (!to || !from) return null;
      return Object.assign({}, to, { _tr: Object.assign({}, t, { src: typeof t.from === 'string' ? { no: from.no, ru: from.ru } : from }) });
    }).filter(Boolean);
  }
  const bnorsk = () => (DATA && DATA.slots && DATA.slots.sources && DATA.slots.sources.bnorsk) || null;
  const srcBadge = it => (it.source === 'bnorsk' && bnorsk() ? `<span class="ot-badge pt-src" title="${esc(bnorsk().label)}">#${String(it.n).padStart(2, '0')} · Bnorsk.no</span>` : '');
  const credit = () => { const b = bnorsk(); return b && b.on !== false ? `<a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.label)}</a>` : ''; };

  /** the coloured table of one sentence. o.fill: { 'part:slot': html } (default: the analysis), o.mark: { cell: 'ok'|'bad'|'want' },
   *  o.drop: cells are buttons («Разложи»), o.empty: no words, o.compact: empty columns hidden on phones */
  function tableHtml(it, o = {}) {
    const S = DATA.slots, cols = S.cols;
    return `<div class="pt-wrap${o.compact ? ' pt-compact' : ''}">${it.parts.map((p, pi) => {
      const ty = S.types[p.t], hasLead = p.t === 'ls' && p.lead;
      const head = p.t === 'ls'
        ? `<div class="pt-band" aria-hidden="true">LEDDSETNING <small>· ${esc(tx(ty))}</small></div>`
        : `<div class="pt-cap"><b>${esc(ty.nb)}</b> <small>· ${esc(tx(ty))}</small></div>`;
      const cell = (k, label) => {
        const id = pi + ':' + k, verb = VERB_COL[p.t].includes(k);
        const val = o.fill ? o.fill[id] : o.empty ? '' : p.c[k] ? esc(p.c[k]) : '';
        const lsF = p.lsF && k === 'f';
        const inner = lsF ? '<span class="pt-lsf">⟵ LEDDSETNING</span>' : val || '';
        const mk = o.mark && o.mark[id] ? ' ' + o.mark[id] : '';
        const empty = !inner && !(o.drop && !lsF) ? ' pt-empty' : '';
        const c = o.drop && !lsF
          ? `<button type="button" class="pt-c${mk}" data-drop="${id}" aria-label="${esc(label[0])} · ${esc(label[1])}${val ? ': ' + esc(String(val).replace(/<[^>]+>/g, '')) : ''}">${inner}</button>`
          : `<div class="pt-c${mk}" data-cell="${id}" lang="nb">${inner}</div>`;
        return `<div class="pt-col pt-k-${k}${verb ? ' pt-verb' : ''}${empty}"><div class="pt-h"><b lang="nb">${esc(label[0])}</b><small>${esc(label[1])}</small></div>${c}</div>`;
      };
      const lead = hasLead ? `<div class="pt-col pt-lead"><div class="pt-h"><b lang="nb">Helsetning</b><small>главное</small></div><div class="pt-c" data-cell="${pi}:lead" lang="nb">${o.fill && (pi + ':lead') in o.fill ? o.fill[pi + ':lead'] : o.empty ? '' : esc(p.lead)}</div></div>` : '';
      const kcols = cols[p.t];
      return `<div class="pt pt-${p.t}${hasLead ? ' has-lead' : ''}">${head}<div class="pt-grid">${lead}${kcols.map(c => cell(c[0], [c[1], c[2]])).join('')}</div>${p.end && pi < it.parts.length - 1 ? `<div class="pt-end" aria-hidden="true">${p.end === ',' ? 'запятая ,' : 'точка .'}</div>` : ''}</div>`;
    }).join('')}</div>`;
  }
  /** the rule boxes, coloured like the sheet; examples open «Смотреть» */
  function rulesHtml(d) {
    const S = d.slots, items = slotItems(d), byId = id => items.find(x => x.id === id);
    const ex = ids => ids.map(byId).filter(Boolean).map(it => `<button type="button" class="pt-ex" data-watch="${esc(it.id)}" lang="nb" title="Посмотреть в таблице">${it.source === 'bnorsk' ? `<b>#${String(it.n).padStart(2, '0')}</b> ` : ''}${esc(it.no)}</button>`).join('');
    const list = k => {
      if (k === 'sa') return `<div class="pt-words">${S.sa.map(w => `<span><b lang="nb">${esc(w)}</b> ${esc(S.saRu[w] || '')}</span>`).join('')}</div>`;
      if (k === 'subj') return `<div class="pt-words">${S.subj.map(w => `<span><b lang="nb">${esc(w)}</b> ${esc(S.subjRu[w] || '')}</span>`).join('')}</div>`;
      return '';
    };
    return `<div class="pt-rules">${S.rules.map(r => `<section class="pt-rule pr-${esc(r.color)}"><h4>${esc(tx(r.title))}</h4>
      ${r.list ? list(r.list) : ''}${(r.items || []).map(([t, ids]) => `<p>${esc(tx(t))}</p>${ex(ids || []) ? `<div class="pt-exs">${ex(ids || [])}</div>` : ''}`).join('')}</section>`).join('')}</div>`;
  }

  const POS_MODES = {
    watch: { ico: '👀', name: 'Смотреть', desc: 'Предложение по словам встаёт в столбцы — с причиной в одну строку' },
    sort: { ico: '🧩', name: 'Разложи', desc: 'Нажмите на слово, потом на столбец (или перетащите)' },
    build: { ico: '🧱', name: 'Собери', desc: 'По переводу соберите всё предложение' },
    tr: { ico: '🔄', name: 'Переделай', desc: 'Инверсия · sier at / spør om · som · derfor ↔ fordi · придаточное впереди' },
    write: { ico: '✍️', name: 'Напиши сам', desc: 'Задание и пример — вы пишете своё предложение, программа проверяет порядок слов (и 🤖 нейросеть — подробно)' },
  };
  const POS_KIND = { sort: 'posS', build: 'posB', tr: 'posT', write: 'posW' };
  const posGroups = d => { const p = prog(), all = d.slots.groups.map(g => g.id); const g = Array.isArray(p.posGroups) ? p.posGroups.filter(x => all.includes(x)) : []; return g.length ? g : all; };
  const posBack = () => backBtn('pos', '← Таблица позиций');

  VIEWS.pos = async ctx => {
    ctx.title('📊 Порядок слов — таблица позиций');
    ctx.body.innerHTML = '<div class="ot-loading"><span class="spinner"></span> Загружаю таблицу…</div>';
    const d = await data();
    if (!ctx.alive()) return;
    const S = d.slots, p = prog(), cur = new Set(posGroups(d));
    const items = slotItems(d);
    const sample = ['b05', 'b17', 'b18', 'b20'].map(id => items.find(x => x.id === id)).filter(Boolean);
    const sampleIt = sample.length ? sample : ['hs', 'q', 'ls'].map(g => items.find(x => x.g === g || (g === 'ls' && x.parts[0].t === 'ls'))).filter(Boolean);
    const draw = () => {
      ctx.body.innerHTML = `${backBtn()}
        <div class="lib-intro">📊 <span>Каждое норвежское предложение раскладывается по <b>столбцам</b>: глагол на 2-м месте, подлежащее, <b>ikke/aldri</b>, второй глагол, дополнение, где/когда. В придаточном — свой порядок: <b>союз → подлежащее → ikke → глагол</b>.</span></div>
        <div class="pt-modes">${Object.entries(POS_MODES).map(([id, m]) => {
          const st = POS_KIND[id] ? p.stats[POS_KIND[id]] : null;
          return `<button type="button" class="pt-mode" data-pos-mode="${id}"><span class="pt-mode-ico" aria-hidden="true">${m.ico}</span><span class="pt-mode-txt"><b>${m.name}</b><span>${esc(m.desc)}</span>${st && st.n ? `<small>${Math.round(st.ok / st.n * 100)}% верно · рекорд ${p.best[POS_KIND[id]] || 0} ⭐</small>` : ''}</span></button>`;
        }).join('')}</div>
        <div class="dr-label">Темы <span class="muted small">(можно несколько)</span></div>
        <div class="ot-levels pt-groups">${S.groups.map(g => {
          const n = items.filter(x => x.g === g.id).length;
          return `<button type="button" class="ot-level ${cur.has(g.id) ? 'on' : ''}" data-grp="${g.id}" aria-pressed="${cur.has(g.id)}"><span class="ot-lv-ico" aria-hidden="true">${g.icon}</span><span class="ot-lv-txt"><b>${esc(tx(g.name))}</b><small lang="nb">${esc(g.short)}</small></span><span class="ot-lv-n">${n}</span></button>`;
        }).join('')}</div>
        <details class="pt-scheme"><summary>🗂 Схема: четыре таблицы</summary>${sampleIt.map(it => `<div class="pt-sample"><div class="pt-sample-s" lang="nb">${srcBadge(it)} ${esc(it.no)}</div>${tableHtml(it)}</div>`).join('')}</details>
        <h3 class="pt-h3">📏 Правила</h3>
        ${rulesHtml(d)}
        <div class="tiny muted ot-attr">${credit() ? credit() + ' · ' : ''}Переводы и пояснения, предложения без номера — собственный материал Norsk Kort.</div>`;
    };
    draw();
    ctx.body.onclick = e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.otGo) { ctx.go(t.dataset.otGo); return; }
      if (t.dataset.grp) {
        const id = t.dataset.grp;
        if (cur.has(id)) { if (cur.size > 1) cur.delete(id); else { UI.toast('Нужна хотя бы одна тема', '', 2000); return; } } else cur.add(id);
        p.posGroups = [...cur]; Store.save();
        t.classList.toggle('on', cur.has(id)); t.setAttribute('aria-pressed', String(cur.has(id)));
        return;
      }
      if (t.dataset.watch) { ctx.go('posWatch', { id: t.dataset.watch }); return; }
      if (t.dataset.posMode) {
        const m = t.dataset.posMode;
        if (m === 'watch') ctx.go('posWatch', {});
        else startPos(ctx, m);
      }
    };
  };
  async function startPos(ctx, mode, only) {
    const d = await data();
    const groups = posGroups(d);
    let pool;
    if (mode === 'write') {
      const all = writeItems(d);
      pool = all.filter(x => groups.includes(x.g));
      if (!pool.length) pool = all;
      if (!pool.length) { UI.toast('Задания пока не загрузились — попробуйте ещё раз', '', 3000); return; }
      const items = only || shuffle(pool).slice(0, W_ROUND);
      if (ctx.alive()) runWrite(ctx, items);
      return;
    }
    if (mode === 'tr') {
      const all = trItems(d);
      pool = all.filter(x => groups.includes(x.g));
      if (!pool.length) { pool = all; UI.toast('Для выбранных тем переделок нет — берём все', '', 3000); }
    } else pool = slotItems(d).filter(x => groups.includes(x.g));
    const items = only || shuffle(pool).slice(0, ROUND);
    if (!ctx.alive()) return;
    if (mode === 'sort') runSort(ctx, items);
    else runLine(ctx, items, mode);
  }

  /* ---------- 👀 Смотреть ---------- */
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  VIEWS.posWatch = async (ctx, o) => {
    ctx.title('👀 Смотреть: слова встают в столбцы');
    const d = await data();
    if (!ctx.alive()) return;
    const groups = posGroups(d), all = slotItems(d);
    let list = all.filter(x => groups.includes(x.g));
    if (o.id && !list.some(x => x.id === o.id)) list = all;
    let idx = Math.max(0, list.findIndex(x => x.id === o.id));
    let steps = [], k = 0, timer = null, playing = true;
    const flying = new Set();
    const stop = () => { clearTimeout(timer); timer = null; flying.forEach(el => el.remove()); flying.clear(); };
    ctx.stop = stop;
    const it = () => list[idx];
    const draw = () => {
      stop();
      const x = it();
      steps = watchSteps(x); k = 0;
      const ch = slotChunks(x);
      ctx.body.innerHTML = `${posBack()}
        <div class="pw-top"><div class="ot-badges"><span class="ot-badge">${esc(tx((d.slots.groups.find(g => g.id === x.g) || {}).name))}</span>${srcBadge(x)}</div>
          <label class="pw-pick"><span class="sr-only">Предложение</span><select data-pick aria-label="Выбрать предложение">${list.map((y, j) => `<option value="${j}" ${j === idx ? 'selected' : ''}>${y.source === 'bnorsk' ? '#' + String(y.n).padStart(2, '0') + ' ' : ''}${esc(y.no)}</option>`).join('')}</select></label></div>
        <div class="pw-sent" lang="nb">${ch.map((c, j) => `<span class="pw-w${c.punct ? ' punct' : ''}" data-w="${j}">${esc(c.t)}</span>`).join(' ')}<span class="pw-w punct">${esc(endMark(x))}</span>
          <button type="button" class="media-btn sm" data-say title="Прослушать" aria-label="Прослушать предложение">${SPK(16)}</button></div>
        <div class="ot-ru ru-text pw-ru">${esc(x.ru)}</div>
        ${x.from ? `<div class="pw-from small muted">Из: <span lang="nb">${esc(x.from.no)}</span></div>` : ''}
        <div class="pw-table">${tableHtml(x, { empty: true })}</div>
        <div class="pw-why" data-why aria-live="polite">${playing ? '▶ Смотрите…' : 'Нажмите «Шаг» или «Смотреть».'}</div>
        ${x.note ? `<div class="small pw-note">💡 ${esc(tx(x.note))}</div>` : ''}
        <div class="pw-act">
          <button type="button" class="btn ghost" data-prev ${idx ? '' : 'disabled'} aria-label="Предыдущее предложение">←</button>
          <button type="button" class="btn" data-play>${playing ? '⏸ Пауза' : '▶ Смотреть'}</button>
          <button type="button" class="btn" data-step>⏭ Шаг</button>
          <button type="button" class="btn ghost" data-again>↺ Сначала</button>
          <button type="button" class="btn primary" data-next>Следующее →</button>
        </div>
        ${x.source === 'bnorsk' && credit() ? `<div class="tiny muted ot-attr">${credit()}</div>` : ''}`;
      if (playing) timer = setTimeout(step, 500);
    };
    const setWhy = html => { const w = ctx.body.querySelector('[data-why]'); if (w) w.innerHTML = html; };
    const step = () => {
      clearTimeout(timer); timer = null;
      if (!ctx.alive()) return;
      const x = it();
      if (k >= steps.length) {
        setWhy(`✓ <span lang="nb"><b>${esc(x.no)}</b></span>`);
        say(x.no);
        const pb = ctx.body.querySelector('[data-play]'); if (pb) pb.textContent = '▶ Смотреть';
        playing = false;
        return;
      }
      const s = steps[k++];
      ctx.body.querySelectorAll('.pw-w.on').forEach(el => el.classList.remove('on'));
      ctx.body.querySelectorAll('.pt-c.now').forEach(el => el.classList.remove('now'));
      const cellId = s.ch ? (s.ch.slot === 'p' ? null : s.ch.part + ':' + s.ch.slot) : s.empty.part + ':' + s.empty.slot;
      const cell = cellId ? ctx.body.querySelector(`[data-cell="${cellId}"]`) : null;
      const word = s.ch ? ctx.body.querySelector(`[data-w="${slotChunks(x).findIndex(c => c.part === s.ch.part && c.slot === s.ch.slot)}"]`) : null;
      if (word) word.classList.add('on');
      const label = s.ch ? (s.ch.slot === 'p' ? `«${s.ch.t}»` : `<b lang="nb">${esc(s.ch.t)}</b>`) : '∅';
      setWhy(`${label} — ${esc(whyText(s.why))}`);
      const fill = () => {
        if (!cell) return;
        cell.classList.add('now', 'pop');
        if (s.ch) cell.textContent = s.ch.t;
        else if (s.empty.slot === 's') cell.innerHTML = '<span class="pt-none">— (som)</span>';
        cell.closest('.pt-col')?.classList.remove('pt-empty');
      };
      if (s.ch && s.ch.slot !== 'p' && cell && word && !reduced()) {
        try { cell.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ }
        const a = word.getBoundingClientRect(), b = cell.getBoundingClientRect();
        const g = document.createElement('span');
        g.className = 'pw-fly'; g.textContent = s.ch.t; g.setAttribute('aria-hidden', 'true');
        g.style.left = a.left + 'px'; g.style.top = a.top + 'px';
        document.body.appendChild(g); flying.add(g);
        const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
        const an = g.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${dx}px, ${dy}px)` }], { duration: 620, easing: 'cubic-bezier(.2,.8,.2,1)' });
        an.onfinish = () => { g.remove(); flying.delete(g); fill(); };
      } else fill();
      if (playing) timer = setTimeout(step, reduced() ? 1600 : 1500);
    };
    const go = j => { idx = (j + list.length) % list.length; playing = true; draw(); };
    draw();
    ctx.body.onclick = e => {
      const t = e.target.closest('button'); if (!t || t.disabled) return;
      if (t.dataset.otGo) { ctx.go(t.dataset.otGo); return; }
      if (t.hasAttribute('data-say')) { say(it().no); return; }
      if (t.hasAttribute('data-play')) {
        if (k >= steps.length) { playing = true; draw(); return; }
        playing = !playing; t.textContent = playing ? '⏸ Пауза' : '▶ Смотреть';
        if (playing) step(); else { clearTimeout(timer); timer = null; }
        return;
      }
      if (t.hasAttribute('data-step')) { playing = false; const pb = ctx.body.querySelector('[data-play]'); if (pb) pb.textContent = '▶ Смотреть'; step(); return; }
      if (t.hasAttribute('data-again')) { playing = true; draw(); return; }
      if (t.hasAttribute('data-prev')) { go(idx - 1); return; }
      if (t.hasAttribute('data-next')) go(idx + 1);
    };
    ctx.body.onchange = e => { if (e.target.matches('[data-pick]')) go(+e.target.value); };
    ctx.onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target && e.target.closest && e.target.closest('select,input,button'))) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); } else if (e.key === ' ') { e.preventDefault(); const b = ctx.body.querySelector('[data-play]'); if (b) b.click(); }
    };
  };

  /* ---------- feedback shared by the games: the table with the right column + the one-line rule ---------- */
  function posFeedback(S, it, ok, got, o) {
    const head = ok ? `✓ Верно! <span class="ot-plus">+${got}</span>${S.streak >= 3 ? ` <span class="ot-hot">🔥 ${S.streak} подряд</span>` : ''}` : o.dunno ? '🤷 Правильно так:' : '✗ Не совсем';
    return `<div class="ot-fb-head">${head}</div>
      ${!ok && o.rule ? `<div class="ot-hint">📏 ${o.rule}</div>` : ''}
      ${o.extra || ''}
      <div class="ot-right"><span lang="nb">${esc(slotText(it))}</span> <button type="button" class="media-btn sm" data-say-r title="Прослушать" aria-label="Прослушать предложение">${SPK(16)}</button></div>
      <div class="ot-right-ru ru-text small">${esc(it.ru)}</div>
      ${tableHtml(it, { compact: true, mark: o.mark || {} })}
      ${it.source === 'bnorsk' && credit() ? `<div class="tiny muted">${srcBadge(it)} ${credit()}</div>` : ''}
      <div class="ot-fb-act">${!ok ? '<button type="button" class="btn sm" data-mk>➕ в карточки</button>' : ''}<button type="button" class="btn primary" data-next>${S.i + 1 < S.items.length ? 'Дальше →' : 'Итоги'}</button></div>`;
  }
  const focusNext = ctx => setTimeout(() => { const n = ctx.body.querySelector('[data-next]'); if (n) { try { n.focus({ preventScroll: true }); } catch (e) { /* ignore */ } n.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); } }, 60);

  /* ---------- 🧩 Разложи: tap a word, then a column (or drag) ---------- */
  function runSort(ctx, items) {
    const S = newSession('posS', items, { back: 'pos', backLabel: '← Таблица позиций' });
    let chips = [], place = {}, sel = null, answered = false, dragJustEnded = false;
    const it = () => S.items[S.i];
    const prepare = () => {
      const x = it();
      chips = slotChunks(x).filter(c => !c.punct && c.slot !== 'lead').map((c, j) => ({ id: j, t: c.t }));
      place = {}; sel = null; answered = false;
      chips = shuffle(chips);
    };
    const inPool = () => chips.filter(c => !Object.values(place).includes(c.id));
    const fillHtml = () => { const f = {}; Object.entries(place).forEach(([cell, id]) => { const c = chips.find(y => y.id === id); f[cell] = `<span class="ot-chip pt-chip" data-chip="${id}" data-where="cell">${esc(c.t)}</span>`; }); return f; };
    const drawAreas = () => {
      const tb = ctx.body.querySelector('[data-tbl]'), pl = ctx.body.querySelector('[data-pool]');
      if (!tb || !pl) return;
      tb.innerHTML = tableHtml(it(), { drop: true, fill: fillHtml() });
      const pool = inPool();
      pl.innerHTML = pool.map(c => `<button type="button" class="ot-chip ${sel === c.id ? 'sel' : ''}" data-chip="${c.id}" data-where="pool" aria-pressed="${sel === c.id}" lang="nb">${esc(c.t)}</button>`).join('') || '<span class="ot-pool-ph">Все слова в таблице ✓</span>';
      tb.classList.toggle('picking', sel != null);
      const ch = ctx.body.querySelector('[data-check]'); if (ch) ch.disabled = pool.length > 0;
    };
    const show = () => {
      if (S.i >= S.items.length) { finish(); return; }
      ctx.inGame = S.results.length > 0;
      prepare();
      const x = it();
      ctx.body.innerHTML = `${posBack()}${scoreBar(S)}
        <div class="ot-task"><div class="ot-badges"><span class="ot-badge">🧩 Разложи по столбцам</span>${srcBadge(x)}</div>
          <div class="pt-sent" lang="nb">${esc(x.no)} <button type="button" class="media-btn sm" data-say-r title="Прослушать" aria-label="Прослушать предложение">${SPK(16)}</button></div>
          <div class="ot-ru ru-text small">${esc(x.ru)}</div></div>
        <div class="tiny muted pt-howto">Нажмите на слово, потом на столбец. Или перетащите. Слово в таблице можно нажать, чтобы вернуть.</div>
        <div class="ot-pool" data-pool aria-label="Слова"></div>
        <div class="pt-tbl" data-tbl></div>
        <div class="ot-act"><button type="button" class="btn ghost" data-reset>↺ Сначала</button><button type="button" class="btn ghost" data-dunno>🤷 Не знаю</button><button type="button" class="btn primary" data-check disabled>Проверить</button></div>
        <div class="ot-fb" data-fb hidden></div>`;
      drawAreas();
    };
    const put = (id, cell) => {
      if (answered) return;
      Object.keys(place).forEach(c => { if (place[c] === id) delete place[c]; });
      if (cell) place[cell] = id;
      sel = null; drawAreas();
    };
    const check = dunno => {
      if (answered) return;
      answered = true;
      const x = it();
      const pl = {}; Object.entries(place).forEach(([cell, id]) => { pl[cell] = chips.find(c => c.id === id).t; });
      const r = sortCheck(x, pl);
      const ok = !dunno && r.ok;
      const got = award(S, ok);
      const first = r.first;
      const plain = !ok && first ? `«${first.t}» → ${colName(x, first)}: ${whyText(r.why)}` : '';
      const rule = esc(plain);
      S.results.push({ it: x, ok, given: '', hint: plain });
      ctx.inGame = S.i < S.items.length - 1;
      // the user's table: right / wrong cells
      const tb = ctx.body.querySelector('[data-tbl]');
      const mark = {}; Object.keys(pl).forEach(c => { mark[c] = r.wrong.includes(c) ? 'bad' : 'ok'; });
      r.soft.forEach(sx => { mark[sx.cell] = 'ok'; });
      if (tb) tb.innerHTML = tableHtml(x, { fill: fillHtml(), mark });
      const want = {}; r.wrong.forEach(c => { if (x.parts[+c.split(':')[0]].c[c.split(':')[1]]) want[c] = 'want'; });
      const fb = ctx.body.querySelector('[data-fb]');
      fb.hidden = false; fb.className = 'ot-fb ' + (ok ? 'ok' : 'bad');
      fb.innerHTML = posFeedback(S, x, ok, got, { dunno, rule, mark: want, extra: ok && r.soft.length ? `<div class="small muted">Засчитано. На листе «${esc(r.soft[0].t)}» стоит в столбце ${r.soft[0].want.endsWith(':a') ? 'Adverbial' : 'Objekt / Predikativ'} — порядок слов тот же.</div>` : '' });
      ['[data-check]', '[data-reset]', '[data-dunno]'].forEach(s => { const b = ctx.body.querySelector(s); if (b) b.disabled = true; });
      const sc = ctx.body.querySelector('.ot-score'); if (sc) sc.outerHTML = scoreBar(S);
      say(x.no);
      focusNext(ctx);
    };
    const finish = () => { ctx.inGame = false; resultsView(ctx, S, () => startPos(ctx, 'sort'), m => runSort(ctx, m)); };
    ctx.body.onclick = async e => {
      const t = e.target.closest('button'); if (!t || t.disabled) return;
      if (t.dataset.otGo) { if (await askEnd(ctx)) ctx.go(t.dataset.otGo); return; }
      if (t.hasAttribute('data-say-r')) { say(it().no); return; }
      if (t.hasAttribute('data-mk')) { addCards([S.results[S.results.length - 1]], ctx, t); return; }
      if (t.hasAttribute('data-next')) { S.i++; show(); return; }
      if (answered || dragJustEnded) return;
      if (t.dataset.chip != null && t.dataset.where === 'pool') { const id = +t.dataset.chip; sel = sel === id ? null : id; drawAreas(); return; }
      if (t.dataset.drop) {
        const cell = t.dataset.drop, has = place[cell];
        if (sel != null) { if (has != null) delete place[cell]; put(sel, cell); }
        else if (has != null) put(has, null);
        else UI.toast('Сначала выберите слово', '', 1500);
        return;
      }
      if (t.hasAttribute('data-reset')) { place = {}; sel = null; drawAreas(); return; }
      if (t.hasAttribute('data-check')) { check(false); return; }
      if (t.hasAttribute('data-dunno')) check(true);
    };
    ctx.onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (answered && (e.key === 'Enter' || e.key === ' ') && !(e.target && e.target.closest && e.target.closest('button'))) { e.preventDefault(); S.i++; show(); return; }
      if (e.key === 'Escape' && sel != null) { e.stopPropagation(); sel = null; drawAreas(); }
    };
    // ✋ drag a word (from the pool or from a cell) onto a column / back to the pool
    ctx.body.onpointerdown = e => {
      const b = e.target.closest('[data-chip]');
      if (!b || answered || e.button > 0 || b.closest('[data-fb]')) return;
      const id = +b.dataset.chip, sx = e.clientX, sy = e.clientY;
      let ghost = null, dragging = false, over = null;
      const poolEl = ctx.body.querySelector('[data-pool]');
      const target = (x, y) => { const el = document.elementFromPoint(x, y); return el ? el.closest('[data-drop],[data-pool]') : null; };
      const mv = ev => {
        if (!dragging) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
          dragging = true;
          const r = b.getBoundingClientRect();
          ghost = b.cloneNode(true); ghost.classList.add('ot-ghost'); ghost.removeAttribute('data-chip'); ghost.style.width = r.width + 'px';
          document.body.appendChild(ghost); b.classList.add('dragging');
        }
        ev.preventDefault();
        ghost.style.left = (ev.clientX - ghost.offsetWidth / 2) + 'px'; ghost.style.top = (ev.clientY - ghost.offsetHeight / 2) + 'px';
        const tg = target(ev.clientX, ev.clientY);
        if (over && over !== tg) over.classList.remove('drop');
        over = tg; if (over) over.classList.add('drop');
      };
      const up = ev => {
        document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
        if (!dragging) return;
        dragJustEnded = true; setTimeout(() => { dragJustEnded = false; }, 60);
        if (ghost) ghost.remove(); b.classList.remove('dragging'); if (over) over.classList.remove('drop');
        const tg = ev.type === 'pointercancel' ? null : target(ev.clientX, ev.clientY);
        if (tg && tg.dataset.drop) { const has = place[tg.dataset.drop]; if (has != null && has !== id) delete place[tg.dataset.drop]; put(id, tg.dataset.drop); }
        else if (tg === poolEl) put(id, null);
        else drawAreas();
      };
      document.addEventListener('pointermove', mv, { passive: false }); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
    };
    show();
  }
  const colName = (it, ch) => {
    if (ch.slot === 'lead') return 'Helsetning';
    const p = it.parts[ch.part], c = (DATA.slots.cols[p.t] || []).find(x => x[0] === ch.slot);
    return c ? `${c[1]} (${c[2]})` : ch.slot;
  };

  /* ---------- 🧱 Собери и 🔄 Переделай: build the sentence from chips ---------- */
  function runLine(ctx, items, mode) {
    const S = newSession(POS_KIND[mode], items, { back: 'pos', backLabel: '← Таблица позиций' });
    let chunks = [], line = [], pool = [], answered = false, dragJustEnded = false;
    const it = () => S.items[S.i];
    const prepare = () => {
      const x = it();
      chunks = lineChunks(x, x._tr ? x._tr.x : x.x).map((c, j) => Object.assign(c, { id: j }));
      line = chunks.filter(c => c.lock).map(c => c.id);
      const right = chunks.filter(c => !c.lock && !c.x).map(c => c.t).join(' ');
      let rest = chunks.filter(c => !c.lock).map(c => c.id);
      for (let tries = 0; tries < 8; tries++) { rest = shuffle(rest); if (rest.map(i => chunks[i].t).filter((t, j) => !chunks[rest[j]].x).join(' ') !== right) break; }
      pool = rest; answered = false;
    };
    const chip = (id, where) => {
      const c = chunks[id], lock = where === 'line' && c.lock;
      return `<button type="button" class="ot-chip ${lock ? 'lock' : ''}${c.punct ? ' punct' : ''}" data-chip="${id}" data-where="${where}" ${lock ? 'disabled aria-disabled="true" title="Это уже на месте"' : ''} lang="nb"${c.punct ? ` aria-label="${c.t === ',' ? 'запятая' : 'точка'}"` : ''}>${lock ? '<span class="ot-lock" aria-hidden="true">🔒</span>' : ''}${esc(c.t)}</button>`;
    };
    const drawAreas = () => {
      const ln = ctx.body.querySelector('[data-line]'), pl = ctx.body.querySelector('[data-pool]');
      if (!ln || !pl) return;
      ln.innerHTML = line.map(id => chip(id, 'line')).join('') + (line.some(id => !chunks[id].lock) ? '' : '<span class="ot-line-ph">Нажмите на слова внизу или перетащите их сюда</span>');
      pl.innerHTML = pool.map(id => chip(id, 'pool')).join('') || '<span class="ot-pool-ph">Все слова в строке ✓</span>';
      const ch = ctx.body.querySelector('[data-check]'); if (ch) ch.disabled = !line.some(id => !chunks[id].lock);
    };
    const show = () => {
      if (S.i >= S.items.length) { finish(); return; }
      ctx.inGame = S.results.length > 0;
      prepare();
      const x = it(), t = x._tr, ty = t && DATA.slots.trTypes[t.type];
      ctx.body.innerHTML = `${posBack()}${scoreBar(S)}
        <div class="ot-task"><div class="ot-badges"><span class="ot-badge">${t ? '🔄 ' + esc(tx(ty && ty.name)) : '🧱 Собери предложение'}</span>${srcBadge(x)}</div>
          ${t ? `<div class="pt-src-box"><div class="pt-src-no" lang="nb">${esc(t.src.no)} <button type="button" class="media-btn sm" data-say-src title="Прослушать" aria-label="Прослушать исходное предложение">${SPK(16)}</button></div>${t.src.ru ? `<div class="small ru-text">${esc(t.src.ru)}</div>` : ''}</div>
            <div class="pt-task">✏️ ${esc(tx(t.task))}</div>`
            : `<div class="ot-ru ru-text">${esc(x.ru)}</div>`}
        </div>
        <div class="ot-line" data-line aria-label="Ваше предложение"></div>
        <div class="ot-pool" data-pool aria-label="Слова"></div>
        <div class="ot-act"><button type="button" class="btn ghost" data-reset>↺ Сначала</button><button type="button" class="btn ghost" data-dunno>🤷 Не знаю</button><button type="button" class="btn primary" data-check disabled>Проверить</button></div>
        <div class="ot-fb" data-fb hidden></div>`;
      drawAreas();
    };
    const check = dunno => {
      if (answered) return;
      answered = true;
      const x = it(), given = line.map(i => chunks[i]);
      const r = judgeLine(x, given);
      const ok = !dunno && r.ok;
      const got = award(S, ok);
      const plain = ok || dunno ? '' : r.chunk && !r.chunk.x && r.key !== 'missing' && r.chunk.slot !== 'p' ? `«${r.chunk.t}» → ${colName(x, r.chunk)}: ${whyText(r.key)}` : r.chunk && r.chunk.x ? `«${r.chunk.t}»: ${whyText(r.key)}` : whyText(r.key);
      const rule = esc(plain);
      S.results.push({ it: x, ok, given: dunno ? '' : r.user, hint: ok ? '' : plain || (x._tr ? tx(DATA.slots.trTypes[x._tr.type].why) : '') });
      ctx.inGame = S.i < S.items.length - 1;
      const mark = {}; if (!ok && r.chunk && r.chunk.part != null && r.chunk.slot !== 'p') mark[r.chunk.part + ':' + r.chunk.slot] = 'want';
      const ty = x._tr && DATA.slots.trTypes[x._tr.type];
      const fb = ctx.body.querySelector('[data-fb]');
      fb.hidden = false; fb.className = 'ot-fb ' + (ok ? 'ok' : 'bad');
      fb.innerHTML = posFeedback(S, x, ok, got, { dunno, rule, mark,
        extra: `${!ok && !dunno ? `<div class="ot-given small muted">Ваш вариант: <s lang="nb">${esc(r.user)}</s></div>` : ''}${ok && !r.exact ? '<div class="small muted">Так тоже правильно. Вариант из таблицы:</div>' : ''}${ty ? `<div class="small pt-trwhy">📐 ${esc(tx(ty.why))}</div>` : ''}` });
      ctx.body.querySelectorAll('[data-line] [data-chip], [data-pool] [data-chip]').forEach(b => { b.disabled = true; });
      ['[data-check]', '[data-reset]', '[data-dunno]'].forEach(s => { const b = ctx.body.querySelector(s); if (b) b.disabled = true; });
      const sc = ctx.body.querySelector('.ot-score'); if (sc) sc.outerHTML = scoreBar(S);
      say(slotText(x));
      focusNext(ctx);
    };
    const move = (id, toLine, at) => {
      if (answered || chunks[id].lock) return;
      line = line.filter(x => x !== id); pool = pool.filter(x => x !== id);
      if (toLine) { const k = line.filter(i => chunks[i].lock).length; const pos = at == null ? line.length : Math.max(k, Math.min(at, line.length)); line.splice(pos, 0, id); } else pool.push(id);
      drawAreas();
    };
    const finish = () => { ctx.inGame = false; resultsView(ctx, S, () => startPos(ctx, mode), m => runLine(ctx, m, mode)); };
    ctx.body.onclick = async e => {
      const t = e.target.closest('button'); if (!t || t.disabled) return;
      if (t.dataset.otGo) { if (await askEnd(ctx)) ctx.go(t.dataset.otGo); return; }
      if (t.dataset.chip != null) { if (dragJustEnded) return; move(+t.dataset.chip, t.dataset.where === 'pool'); return; }
      if (t.hasAttribute('data-reset')) { pool = pool.concat(line.filter(i => !chunks[i].lock)); line = line.filter(i => chunks[i].lock); drawAreas(); return; }
      if (t.hasAttribute('data-check')) { check(false); return; }
      if (t.hasAttribute('data-dunno')) { check(true); return; }
      if (t.hasAttribute('data-say-r')) { say(slotText(it())); return; }
      if (t.hasAttribute('data-say-src')) { say(String(it()._tr.src.no).replace(/^[^:«]+:\s*/, '')); return; }
      if (t.hasAttribute('data-mk')) { addCards([S.results[S.results.length - 1]], ctx, t); return; }
      if (t.hasAttribute('data-next')) { S.i++; show(); }
    };
    ctx.onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (answered && (e.key === 'Enter' || e.key === ' ') && !(e.target && e.target.closest && e.target.closest('button'))) { e.preventDefault(); S.i++; show(); return; }
      if (!answered && e.key === 'Enter' && !(e.target && e.target.closest && e.target.closest('button'))) { const b = ctx.body.querySelector('[data-check]'); if (b && !b.disabled) { e.preventDefault(); check(false); } }
      if (!answered && e.key === 'Backspace' && !(e.target && e.target.matches && e.target.matches('input,textarea'))) { const last = line[line.length - 1]; if (last != null && !chunks[last].lock) { e.preventDefault(); move(last, false); } }
    };
    ctx.body.onpointerdown = e => {
      const b = e.target.closest('[data-chip]');
      if (!b || b.disabled || answered || e.button > 0) return;
      const id = +b.dataset.chip, sx = e.clientX, sy = e.clientY;
      let ghost = null, mark = null, dragging = false;
      const lineEl = ctx.body.querySelector('[data-line]'), poolEl = ctx.body.querySelector('[data-pool]');
      const inside = (el, x, y, pad = 14) => { const r = el.getBoundingClientRect(); return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad; };
      const slotAt = (x, y) => {
        const els = [...lineEl.querySelectorAll('[data-chip]')].filter(el => +el.dataset.chip !== id);
        let at = els.length;
        for (let j = 0; j < els.length; j++) { const r = els[j].getBoundingClientRect(); if (y < r.top - 4) { at = j; break; } if (y <= r.bottom + 4 && x < r.left + r.width / 2) { at = j; break; } }
        return { at, before: els[at] || null };
      };
      const mv = ev => {
        if (!dragging) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
          dragging = true;
          const r = b.getBoundingClientRect();
          ghost = b.cloneNode(true); ghost.classList.add('ot-ghost'); ghost.removeAttribute('data-chip'); ghost.style.width = r.width + 'px'; document.body.appendChild(ghost);
          b.classList.add('dragging');
          mark = document.createElement('span'); mark.className = 'ot-caret'; mark.setAttribute('aria-hidden', 'true');
        }
        ev.preventDefault();
        ghost.style.left = (ev.clientX - ghost.offsetWidth / 2) + 'px'; ghost.style.top = (ev.clientY - ghost.offsetHeight / 2) + 'px';
        const over = inside(lineEl, ev.clientX, ev.clientY);
        lineEl.classList.toggle('drop', over); poolEl.classList.toggle('drop', !over && inside(poolEl, ev.clientX, ev.clientY));
        if (over) { const s = slotAt(ev.clientX, ev.clientY); if (s.before) lineEl.insertBefore(mark, s.before); else lineEl.appendChild(mark); } else if (mark.parentNode) mark.remove();
      };
      const up = ev => {
        document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
        if (!dragging) return;
        dragJustEnded = true; setTimeout(() => { dragJustEnded = false; }, 60);
        if (ghost) ghost.remove(); b.classList.remove('dragging'); lineEl.classList.remove('drop'); poolEl.classList.remove('drop');
        const overLine = ev.type !== 'pointercancel' && inside(lineEl, ev.clientX, ev.clientY), overPool = ev.type !== 'pointercancel' && inside(poolEl, ev.clientX, ev.clientY);
        const s = overLine ? slotAt(ev.clientX, ev.clientY) : null;
        if (mark && mark.parentNode) mark.remove();
        if (overLine) move(id, true, s.at); else if (overPool) move(id, false); else drawAreas();
      };
      document.addEventListener('pointermove', mv, { passive: false }); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
    };
    show();
  }

  /* ================= ✍️ «Напиши сам»: the learner writes a sentence — an offline word-order check (+ 🤖 a detailed one) =================
   * Tasks: data/ordtrainer.json → slots.write.tasks (source:"bnorsk" = the Bnorsk.no worksheet «Oppgaver til ark med eksempelsetninger»,
   * hidden when slots.sources.bnorsk.on is false). The check is a heuristic: V2 / inversion after a fronted element, questions,
   * leddsetning order (subjunction → subject → ikke → verb), ikke in the main clause, modal + infinitive; finite verbs come from the
   * offline lexicon (js/lexicon.js — Norsk ordbank) with a built-in list as a fallback. It never marks the meaning or every word. */
  const W_ROUND = 6;
  const W_SUBJ = new Set(['jeg', 'du', 'han', 'hun', 'vi', 'dere', 'de', 'man']);
  /** subjects only when a finite verb follows them (det regner · Kari bor) */
  const W_SUBJ2 = new Set(['det', 'den', 'dette', 'alle', 'noen', 'mange', 'folk']);
  const W_OBJ = new Set(['meg', 'deg', 'ham', 'henne', 'oss', 'dem', 'seg', 'det', 'den', 'dette']);
  const W_SA = new Set(['ikke', 'aldri', 'alltid', 'ofte', 'også', 'gjerne', 'sjelden', 'vanligvis', 'fortsatt', 'fremdeles', 'heller', 'kanskje', 'egentlig', 'allerede', 'virkelig', 'dessverre', 'heldigvis', 'snart', 'nok', 'sikkert', 'neppe']);
  /** setningsadverbial that must stand before the verb of a leddsetning */
  const W_SA_SUB = new Set(['ikke', 'aldri', 'alltid', 'ofte', 'også', 'gjerne', 'sjelden', 'vanligvis', 'fortsatt', 'fremdeles', 'heller', 'kanskje', 'egentlig', 'allerede', 'virkelig']);
  const W_QW = new Set(['hva', 'hvem', 'hvor', 'når', 'hvorfor', 'hvordan', 'hvilken', 'hvilket', 'hvilke']);
  const W_QW2 = { hvor: ['mye', 'mange', 'lenge', 'ofte', 'gammel', 'langt', 'stor', 'store', 'mange'], hva: ['slags'] };
  const W_SJ2 = ['selv om', 'etter at', 'slik at', 'for at'];
  const W_SJ_STRONG = new Set(['at', 'fordi', 'hvis', 'dersom', 'mens', 'ettersom', 'som']);
  /** subjunctions only when a subject follows (om morgenen · da gikk vi · for to år siden) */
  const W_SJ_WEAK = new Set(['om', 'når', 'da', 'siden', 'før']);
  const W_SJ_ALONE = new Set(['fordi', 'hvis', 'dersom', 'når', 'da', 'siden', 'før', 'selv om', 'mens', 'etter at', 'ettersom']);
  const W_PREP = new Set(['i', 'på', 'til', 'fra', 'med', 'etter', 'før', 'om', 'av', 'for', 'hos', 'ved', 'under', 'over', 'uten', 'mot', 'mellom', 'gjennom', 'rundt', 'langs', 'bak', 'foran', 'blant']);
  const W_REPORT = new Set(['spør', 'spurte', 'spørre', 'lurer', 'lurte', 'lure', 'vet', 'visste', 'vite', 'forstår', 'forsto', 'forstå', 'husker', 'husket', 'huske', 'sier', 'sa', 'si', 'skjønner', 'skjønte', 'aner', 'tenker', 'på', 'lurer']);
  const W_NOTFIN = new Set(('for om i på til at men og eller som da når hvis fra med av en et ei den det de dem min mitt mi mine din ditt di dine sin sitt si sine vår vårt våre hans hennes deres ikke også etter '
    + 'før mot under over ved hos mange noen alle hele litt mye godt bra her der nå to tre fire fem seks sju syv åtte ni ti mer mest enn like samme hver hvert jeg du han hun vi dere man meg deg ham henne oss seg '
    + 'heller lenge god stor fin ny gammel dag morgen kveld år hjem hjemme ute inne gang tid kaffe').split(' '));
  const W_FIN = new Set(('er var har hadde kan kunne vil ville skal skulle må måtte bør burde får fikk går gikk kommer kom blir ble gjør gjorde sier sa ser så vet visste tar tok gir ga står sto ligger lå sitter satt '
    + 'liker likte bor bodde heter het jobber jobbet spiser spiste drikker drakk leser leste skriver skrev snakker snakket lærer lærte trener trente tror trodde synes syntes mener mente regner regnet reiser reiste '
    + 'kjøper kjøpte lager laget trenger trengte pleier pleide prøver prøvde begynner begynte slutter sluttet føler følte finnes fins treffer traff hjelper hjalp sover sov spør spurte svarer svarte venter ventet '
    + 'handler handlet kjører kjørte sykler syklet løper løp ringer ringte elsker elsket forstår forsto husker husket glemmer glemte håper håpet ønsker ønsket betyr betydde koster kostet passer passet trives trivdes '
    + 'gleder gledet lurer lurte tenker tenkte hører hørte møter møtte bruker brukte vasker vasket studerer studerte flytter flyttet besøker besøkte henter hentet åpner åpnet stenger stengte dusjer dusjet tør turte '
    + 'leker lekte svømmer svømte går fant finner sender sendte inviterer inviterte gratulerer takker takket').split(' '));
  /** word → { known, fin, pres, inf, noun, lemma } from the offline lexicon (filled by wPrepare) */
  const W_TAG = new Map();
  let W_LEX_OK = false;
  const W_NAMES = new Set(['Kari', 'Anders', 'Maria', 'Alex', 'Per', 'Ola', 'Anna', 'Anne', 'Tommy', 'Olga', 'Ivan', 'Pål', 'Espen', 'Liv', 'Ole', 'Odd', 'Nina', 'Lars', 'Ali', 'Fatima']);
  const lexApi = () => (typeof globalThis !== 'undefined' ? globalThis.Lexicon : null);
  const wTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  /** tag the words of a text with the offline lexicon (finite verb? infinitive? noun?) — false when it is not available */
  async function wPrepare(text) {
    const L = lexApi();
    if (!L || typeof L.ready !== 'function') return false;
    try { await wTimeout(L.ready(), 20000); } catch (e) { return false; }
    const words = [...new Set((String(text).match(/[A-Za-zÆØÅæøåÀ-ÿ]+/g) || []).map(low))].filter(w => !W_TAG.has(w));
    for (const w of words) {
      const rd = (L.peek(w) || []);
      const tag = { known: rd.length > 0, verb: false, fin: false, pres: false, inf: false, noun: rd.some(r => r.pos === 'subst'), lemma: '' };
      for (const r of rd.filter(x => x.pos === 'verb')) {
        tag.verb = true;
        let p = null;
        try { p = await wTimeout(L.paradigm(r.lemma, 'verb'), 20000); } catch (e) { p = null; }
        const F = (p && p.forms) || {}, has = k => (F[k] || []).map(low).includes(w);
        if (p && Object.keys(F).length) {
          if (has('pres')) { tag.fin = true; tag.pres = true; }
          if (has('pret')) tag.fin = true;
          if (has('inf')) tag.inf = true;
        } else if (w === low(r.lemma)) tag.inf = true;
        else if (/r$/.test(w)) { tag.fin = true; tag.pres = true; }
        if ((tag.fin || tag.inf) && !tag.lemma) tag.lemma = r.lemma;
      }
      W_TAG.set(w, tag);
    }
    W_LEX_OK = true;
    return true;
  }
  /** finite verb? true / false / null (not known) */
  function wFin(w) {
    if (!w || w === ',' || W_NOTFIN.has(w)) return false;
    if (W_FIN.has(w)) return true;
    const t = W_TAG.get(w);
    return t ? t.fin : null;
  }
  /** a finite verb token; never right after a preposition («i går», «på lørdag») */
  const wIsFin = x => !!x && !x.np && wFin(x.l) === true;
  const wInf = w => { const t = W_TAG.get(w); return t ? t.inf : false; };
  const wPresOnly = w => { const t = W_TAG.get(w); if (t && t.known) return t.pres && !t.inf; return W_FIN.has(w) && /([^e]e|[aiouyæøå])r$/.test(w) && !MODAL.has(w); };
  const wLooksVerb = x => !!x && (wIsFin(x) || (wFin(x.l) === null && /(er|te|et|de|dde)$/.test(x.l) && x.l.length > 3));
  const wIsName = x => !!x && x.t !== 'I' && /^[A-ZÆØÅ]/.test(x.t) && (W_NAMES.has(x.t) || x.i > 0 || (W_LEX_OK && !(W_TAG.get(x.l) || {}).known));
  const wPrevBlocks = (T, i) => { const p = T[i - 1]; return !!p && (W_PREP.has(p.l) || p.l === 'og' || p.l === 'eller'); };
  /** a subject at T[i]: a personal pronoun, or det / a name / alle… with a finite verb right after it */
  function wSubjAt(T, i) {
    const x = T[i]; if (!x || wPrevBlocks(T, i)) return false;
    if (W_SUBJ.has(x.l)) return true;
    return (W_SUBJ2.has(x.l) || wIsName(x)) && wIsFin(T[i + 1]);
  }
  /** subject-like in a leddsetning / after it: pronouns, det, names and nouns */
  function wSubjLike(T, i) {
    const x = T[i]; if (!x || x.l === ',') return false;
    if (W_SUBJ.has(x.l) || W_SUBJ2.has(x.l) || wIsName(x)) return true;
    const t = W_TAG.get(x.l);
    return !!(t && t.noun && !t.fin);
  }
  function wTokens(s) {
    const out = [], re = /[A-Za-zÆØÅæøåÀ-ÿ0-9]+(?:[-'][A-Za-zÆØÅæøåÀ-ÿ0-9]+)*|,/g; let m;
    while ((m = re.exec(s))) { const p = out[out.length - 1]; out.push({ t: m[0], l: low(m[0]), i: out.length, np: !!p && W_PREP.has(p.l) && p.l !== 'for' }); }
    return out;
  }
  function wSentences(text) {
    const out = [], re = /[^.!?\n]+[.!?]*/g; let m;
    const t = String(text || '').replace(/«[^»]*»|"[^"]*"/g, s => s.replace(/[.!?]/g, ' '));
    while ((m = re.exec(t))) { const raw = m[0].trim(); if (/[A-Za-zÆØÅæøå]/.test(raw)) out.push(raw); }
    return out;
  }
  /** does a subjunction start at S[i]? → its length in words (0 = no) */
  function wSjAt(S, i, q) {
    const x = S[i]; if (!x) return 0;
    const two = S[i + 1] ? x.l + ' ' + S[i + 1].l : '';
    if (W_SJ2.includes(two)) return 2;
    if (W_SJ_STRONG.has(x.l)) {
      if (x.l === 'at' && S[i - 1] && ['for', 'etter', 'slik'].includes(S[i - 1].l)) return 0;
      return 1;
    }
    if (W_SJ_WEAK.has(x.l)) {
      const nx = S[i + 1];
      if (!nx || (i === 0 && q && wIsFin(nx))) return 0; // Når kommer bussen?
      if (W_SUBJ.has(nx.l) || ((W_SUBJ2.has(nx.l) || wIsName(nx)) && wIsFin(S[i + 2]))) return 1;
      if (i > 0 && wFin(nx.l) === true && S[i + 2] && W_SUBJ.has(S[i + 2].l)) { nx.np = false; return 1; } // «…vet ikke om kommer han» — wrong, but a leddsetning
      // a noun subject: «…om bussen kommer»; at the start only with a comma later («Om morgenen drikker jeg…» is a time adverbial)
      return wSubjLike(S, i + 1) && wIsFin(S[i + 2]) && (i > 0 || S.some(y => y.l === ',')) ? 1 : 0;
    }
    if (W_QW.has(x.l) && i > 0) {
      // an indirect question: …spør hvor, …vet ikke hva, …lurer på om
      let j = i - 1;
      while (j >= 0 && (W_SA.has(S[j].l) || W_OBJ.has(S[j].l) || W_SUBJ.has(S[j].l))) j--;
      return j >= 0 && (W_REPORT.has(S[j].l) || wFin(S[j].l) === true) ? 1 : 0;
    }
    return 0;
  }
  /** a sentence → clauses: split at commas, before a subjunction, and at og / men with a new clause after them */
  function wSegments(S, q) {
    const segs = []; let cur = null;
    const open = (i, sj, sjLen) => { cur = { toks: [], sj, sjLen, start: i }; segs.push(cur); };
    for (let i = 0; i < S.length; i++) {
      const x = S[i];
      if (x.l === ',') { cur = null; continue; }
      const n = wSjAt(S, i, q);
      if (n) { open(i, S.slice(i, i + n).map(y => y.l).join(' '), n); cur.toks.push(...S.slice(i, i + n)); i += n - 1; continue; }
      if (['og', 'men', 'eller'].includes(x.l) && cur && cur.toks.some(wIsFin)) { open(i + 1, '', 0); cur.coord = x.l; continue; }
      if (!cur) { open(i, '', 0); if (['og', 'men', 'eller', 'så'].includes(x.l) && i > 0) { cur.coord = x.l; cur.start = i + 1; continue; } }
      cur.toks.push(x);
    }
    return segs.filter(s => s.toks.length);
  }
  const wText = toks => toks.map(x => x.t).join(' ');
  /** the sentence with one clause rewritten (capital letter first; a word that moved from the start loses its capital) */
  function wFix(R, seg, toks, endMark) {
    const S = R.toks, a = seg.toks[0].i, b = seg.toks[seg.toks.length - 1].i;
    const all = S.slice(0, a).concat(toks, S.slice(b + 1));
    const out = all.map((x, k) => {
      let t = x.t;
      if (x.i === 0 && k > 0 && x.l !== ',' && !W_NAMES.has(x.t) && !(W_LEX_OK && !(W_TAG.get(x.l) || {}).known && x.t !== 'I')) t = x.l;
      if (k === 0) t = t[0].toUpperCase() + t.slice(1);
      return t;
    });
    return out.join(' ').replace(/\s+,/g, ',').replace(/,\s*,/g, ',') + (endMark == null ? (R.end || '.') : endMark);
  }
  const W_MSG = {
    inv: front => `После «${front}» на 1-м месте сразу идёт глагол, потом подлежащее (инверсия).`,
    whFirst: () => hintText('whFirst'),
    ynFirst: () => hintText('ynFirst'),
    lsFirst: () => 'Придаточное впереди занимает 1-е место. После запятой — сразу глагол главного, потом подлежащее: Hvis det regner, blir jeg hjemme.',
    lsComma: () => 'После придаточного в начале ставят запятую: Når jeg kommer hjem, lager jeg mat.',
    lsAlone: sj => `Придаточное с «${sj}» не может стоять одно — нужно главное предложение: Jeg blir hjemme fordi jeg er syk.`,
    saMain: w => `«${w}» в главном предложении стоит после глагола: Jeg spiser ${w} fisk.`,
    ikkeMain: () => hintText('ikkeMain'),
    ikkeInv: () => hintText('ikkeInv'),
    ikkeLate: w => `«${w}» стоит сразу после глагола (при инверсии — после подлежащего), а не в конце: Jeg kan ${w} svømme.`,
    subInv: () => hintText('subInv'),
    subIkke: w => `В придаточном «${w}» стоит перед глаголом: …fordi jeg ${w} har tid.`,
    indOrder: () => hintText('indOrder'),
    somNeed: () => hintText('somNeed'),
    modalAa: () => hintText('modalAa'),
    modalInf: m => `После «${m}» — инфинитив (словарная форма): ${m} svømme, а не ${m} svømmer.`,
    needAa: v => `После «${v}» нужен å + инфинитив: ${v} å lese.`,
  };
  /** one sentence → { issues: [{lvl:'err'|'warn'|'tip', msg, fix}], good: [...], q, startsSub, hasMain, subs, finN } */
  function wAnalyze(raw) {
    const end = ((raw.match(/[.!?]+$/) || [''])[0]).slice(-1);
    const q = end === '?';
    const S = wTokens(raw);
    const R = { raw, end, q, toks: S, issues: [], good: [], startsSub: false, hasMain: false, subs: [], finN: S.filter(wIsFin).length, unsure: false };
    if (!S.length) return R;
    const add = (lvl, msg, fix) => { if (!R.issues.some(x => x.msg === msg)) R.issues.push({ lvl, msg, fix: fix || '' }); };
    const good = s => { if (R.good.length < 4 && !R.good.includes(s)) R.good.push(s); };
    const segs = wSegments(S, q);
    R.startsSub = !!(segs[0] && segs[0].sj && segs[0].start === 0 && segs[0].sj !== 'som' && segs[0].sj !== 'at');
    let mainAfterLs = R.startsSub ? segs.findIndex(s => !s.sj) : -1;
    segs.forEach((seg, si) => {
      const T = seg.toks, first = seg.start === 0;
      if (seg.sj) { R.subs.push({ sj: seg.sj, first }); subClause(seg, T, si); return; }
      R.hasMain = true;
      if (si === mainAfterLs) { afterLs(seg, T); return; }
      mainClause(seg, T, first);
    });
    if (/^[a-zæøå]/.test(raw)) add('tip', 'Предложение начинается с большой буквы.', '');
    if (!end) add('tip', 'В конце предложения нужна точка (у вопроса — «?»).', '');
    return R;

    function mainClause(seg, T, first) {
      // ❓ questions
      if (first && q) {
        if (W_QW.has(T[0].l)) {
          let qe = 1;
          if ((W_QW2[T[0].l] || []).includes((T[1] || {}).l)) qe = 2;
          if (['hvilken', 'hvilket', 'hvilke'].includes(T[0].l) || (T[0].l === 'hva' && qe === 2)) qe++;
          // Hvor mange barn har du?
          else if (qe === 2 && ['mange', 'mye'].includes(T[1].l) && T[qe] && !wIsFin(T[qe]) && !W_SUBJ.has(T[qe].l) && wIsFin(T[qe + 1])) qe++;
          if (wIsFin(T[qe])) { good(`Вопрос: «${wText(T.slice(0, qe))}» → глагол «${T[qe].t}» → подлежащее ✓`); return checkV(seg, T, qe, true); }
          const v = T.findIndex((x, j) => j > qe && wIsFin(x));
          if (wSubjLike(T, qe) && v > qe) { add('err', W_MSG.whFirst(), wFix(R, seg, T.slice(0, qe).concat([T[v]], T.slice(qe, v), T.slice(v + 1)))); return; }
          R.unsure = true; return;
        }
        if (wIsFin(T[0])) { good('Вопрос без вопросительного слова: глагол первым ✓'); return checkV(seg, T, 0, true); }
        if (wSubjLike(T, 0) && wIsFin(T[1])) { add('err', W_MSG.ynFirst(), wFix(R, seg, [T[1], T[0]].concat(T.slice(2)))); return; }
        R.unsure = true; return;
      }
      // «…og bor i Oslo», «Kom hit!» — but «Mora mi …» (also a verb form) is a noun when another verb follows
      if (wIsFin(T[0]) && !(first && (W_TAG.get(T[0].l) || {}).noun && T.slice(1).some(wIsFin))) return;
      // subject first: Jeg spiser · Kari bor
      if (W_SUBJ.has(T[0].l) || ((W_SUBJ2.has(T[0].l) || W_NAMES.has(T[0].t)) && T.slice(1).some(wIsFin))) {
        const v = T.findIndex((x, j) => j > 0 && wIsFin(x));
        if (v === 1) { good(`Глагол на 2-м месте: ${T[0].t} ${T[1].t} ✓`); return checkV(seg, T, 1, false); }
        if (v > 1) {
          const mid = T.slice(1, v);
          if (mid.every(x => W_SA.has(x.l))) {
            const w = mid.map(x => x.l).join(' ');
            add('err', mid.some(x => x.l === 'ikke') ? W_MSG.ikkeMain() : W_MSG.saMain(w), wFix(R, seg, [T[0], T[v]].concat(mid, T.slice(v + 1))));
            return;
          }
          return checkV(seg, T, v, false);
        }
        R.unsure = true; return;
      }
      // something else first (I dag, Derfor, Nå, På bildet…) → inversion
      const v = T.findIndex((x, j) => j > 0 && wIsFin(x));
      const sp = T.findIndex((x, j) => j > 0 && wSubjAt(T, j));
      const front = sp > 0 ? wText(T.slice(0, sp)) : v > 0 ? wText(T.slice(0, v)) : T[0].t;
      if (sp > 0 && (v < 0 || sp < v)) {
        if (v > 0) { add('err', W_MSG.inv(front), wFix(R, seg, T.slice(0, sp).concat([T[v]], T.slice(sp, v), T.slice(v + 1)))); return; }
        if (wLooksVerb(T[sp + 1]) && !wLooksVerb(T[sp - 1])) { add('err', W_MSG.inv(front), wFix(R, seg, T.slice(0, sp).concat([T[sp + 1], T[sp]], T.slice(sp + 2)))); return; }
        R.unsure = true; return;
      }
      if (v < 0) { R.unsure = true; return; }
      // ikke / aldri before the verb: «Mora mi ikke jobber»
      let a = v - 1; while (a > 0 && W_SA.has(T[a].l)) a--;
      if (a < v - 1) {
        const sa = T.slice(a + 1, v);
        add('err', sa.some(x => x.l === 'ikke') ? W_MSG.ikkeMain() : W_MSG.saMain(sa.map(x => x.l).join(' ')), wFix(R, seg, T.slice(0, a + 1).concat([T[v]], sa, T.slice(v + 1))));
        return;
      }
      if (sp > v + 1 && T.slice(v + 1, sp).every(x => W_SA.has(x.l)) && W_SUBJ.has(T[sp].l)) {
        add('warn', W_MSG.ikkeInv(), wFix(R, seg, T.slice(0, v + 1).concat([T[sp]], T.slice(v + 1, sp), T.slice(sp + 1))));
        return;
      }
      if (sp === v + 1) good(`Инверсия: «${wText(T.slice(0, v))}» → ${T[v].t} → ${T[sp].t} ✓`);
      else good(`Глагол на 2-м месте: «${wText(T.slice(0, v))}» → ${T[v].t} ✓`);
      checkV(seg, T, v, sp === v + 1);
    }
    /** after the finite verb: ikke at the end, modal + å / + present, an å-verb without å */
    function checkV(seg, T, v, inv) {
      const verb = T[v];
      const n = T.findIndex((x, j) => j > v + 1 && (x.l === 'ikke' || x.l === 'aldri'));
      if (n > 0) {
        const mid = T.slice(v + 1, n).filter(x => !W_SUBJ.has(x.l) && !W_OBJ.has(x.l) && !wIsName(x) && !W_SA.has(x.l));
        if (mid.length) {
          const subjNext = T[v + 1] && (W_SUBJ.has(T[v + 1].l) || wIsName(T[v + 1])) && (inv || v === 0 || W_QW.has(T[0].l));
          const at = subjNext ? v + 2 : v + 1;
          const rest = T.filter((x, j) => j !== n);
          const fixed = rest.slice(0, at).concat([T[n]], rest.slice(at));
          add('err', T[n].l === 'ikke' ? W_MSG.ikkeLate('ikke') : W_MSG.ikkeLate(T[n].l), wFix(R, seg, fixed));
          return;
        }
      }
      let m = v + 1;
      while (T[m] && (W_SUBJ.has(T[m].l) || W_SA.has(T[m].l) || (inv && m === v + 1 && wIsName(T[m])))) m++;
      const nx = T[m];
      if (MODAL.has(verb.l) && nx) {
        if (nx.l === 'å') { add('err', W_MSG.modalAa(), wFix(R, seg, T.filter((x, j) => j !== m))); return; }
        if (wPresOnly(nx.l)) {
          const lem = (W_TAG.get(nx.l) || {}).lemma;
          add('err', W_MSG.modalInf(verb.l), lem ? wFix(R, seg, T.map((x, j) => (j === m ? Object.assign({}, x, { t: lem, l: low(lem) }) : x))) : '');
          return;
        }
        if (wInf(nx.l) || nx.l === 'ha' || nx.l === 'være') good(`${verb.l} + инфинитив без å: ${verb.l} … ${nx.t} ✓`);
        return;
      }
      if (AA_VERB.test(verb.l) && nx && nx.l !== 'å' && wInf(nx.l) && !(W_TAG.get(nx.l) || {}).noun && !wFin(nx.l)) {
        add('warn', W_MSG.needAa(verb.l), wFix(R, seg, T.slice(0, m).concat([{ t: 'å', l: 'å', i: -1 }], T.slice(m))));
      }
    }
    /** a leddsetning: subjunction → subject → (ikke) → verb; som / hvem / hva may be the subject themselves */
    function subClause(seg, T, si) {
      const k = seg.sjLen, sj = seg.sj, x = T[k];
      if (!x) return;
      if (sj === 'som' && wIsFin(x)) {
        if (T[k + 1] && W_SA_SUB.has(T[k + 1].l)) { add('err', W_MSG.subIkke(T[k + 1].l), wFix(R, seg, T.slice(0, k).concat([T[k + 1], x], T.slice(k + 2)))); return; }
        good(`som — подлежащее придаточного: «som ${x.t}» ✓`);
        return;
      }
      if (W_QW.has(sj) && wIsFin(x)) {
        if (wSubjLike(T, k + 1) && !['hvem', 'hva'].includes(sj)) { add('err', W_MSG.indOrder(), wFix(R, seg, T.slice(0, k).concat([T[k + 1], x], T.slice(k + 2)))); return; }
        if (['hvem', 'hva', 'hvilke', 'hvilken', 'hvilket'].includes(sj) && wSubjLike(T, k + 1) && W_SUBJ.has(T[k + 1].l)) { add('err', W_MSG.indOrder(), wFix(R, seg, T.slice(0, k).concat([T[k + 1], x], T.slice(k + 2)))); return; }
        if (['hvem', 'hva'].includes(sj)) { add('warn', W_MSG.somNeed(), wFix(R, seg, T.slice(0, k).concat([{ t: 'som', l: 'som', i: -1 }], T.slice(k)))); return; }
        return;
      }
      if (wIsFin(x) && wSubjLike(T, k + 1)) {
        add('err', W_QW.has(sj) ? W_MSG.indOrder() : W_MSG.subInv(), wFix(R, seg, T.slice(0, k).concat([T[k + 1], x], T.slice(k + 2))));
        return;
      }
      const v = T.findIndex((y, j) => j > k && wIsFin(y));
      if (v < 0) { R.unsure = true; return; }
      let e = v + 1; while (T[e] && W_SA_SUB.has(T[e].l)) e++;
      if (e > v + 1 && !(T.slice(k, v).some(y => W_SA_SUB.has(y.l)))) {
        const sa = T.slice(v + 1, e);
        add('err', W_MSG.subIkke(sa.map(y => y.l).join(' ')), wFix(R, seg, T.slice(0, v).concat(sa, [T[v]], T.slice(e))));
        return;
      }
      const sa = T.slice(k, v).filter(y => W_SA_SUB.has(y.l));
      good(`Придаточное: ${sj} → ${wText(T.slice(k, v).filter(y => !W_SA_SUB.has(y.l))) || '…'}${sa.length ? ' → ' + wText(sa) : ''} → ${T[v].t} ✓`);
      // a leddsetning first without a comma: «Hvis det regner jeg blir hjemme» / «Hvis det regner blir jeg hjemme»
      if (seg.start === 0 && si === 0 && R.startsSub && !segs.some(s => !s.sj)) {
        for (let j = v + 1; j < T.length - 1; j++) {
          if (wSubjAt(T, j) && W_SUBJ.has(T[j].l) && wIsFin(T[j + 1])) {
            add('err', W_MSG.lsFirst(), wFix(R, seg, T.slice(0, j).concat([{ t: ',', l: ',', i: -1 }, T[j + 1], T[j]], T.slice(j + 2))));
            R.hasMain = true; return;
          }
          if (wIsFin(T[j]) && wSubjLike(T, j + 1)) {
            add('tip', W_MSG.lsComma(), wFix(R, seg, T.slice(0, j).concat([{ t: ',', l: ',', i: -1 }], T.slice(j))));
            good(`После придаточного — глагол: ${T[j].t} ${T[j + 1].t} ✓`);
            R.hasMain = true; return;
          }
        }
        if (W_SJ_ALONE.has(sj)) add('err', W_MSG.lsAlone(sj), '');
      }
    }
    /** the main clause after a leddsetning in front: verb first, then the subject */
    function afterLs(seg, T) {
      if (wIsFin(T[0])) { good(`После придаточного — сразу глагол: «…, ${T[0].t} ${(T[1] || {}).t || ''}» ✓`); return checkV(seg, T, 0, true); }
      const v = T.findIndex((y, j) => j > 0 && wIsFin(y));
      if (v > 0 && v <= 3 && wSubjLike(T, 0)) { add('err', W_MSG.lsFirst(), wFix(R, seg, [T[v]].concat(T.slice(0, v), T.slice(v + 1)))); return; }
      R.unsure = true;
    }
  }
  /** what the task demands (start word, subjunction, question…) → the Russian lines of what is missing */
  function wRequire(task, A) {
    const N = task.need || {}, out = [];
    const toks = A.map(a => a.toks.map(x => x.l).filter(w => w !== ','));
    const words = toks.flat(), line = ' ' + words.join(' ') + ' ';
    const has = w => (w.includes(' ') ? line.includes(' ' + w + ' ') : words.includes(w));
    const pl = (n, f) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? f[0] : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? f[1] : f[2]}`;
    if (N.n && A.length < N.n) out.push(`Нужно ${pl(N.n, ['предложение', 'предложения', 'предложений'])} — сейчас ${A.length}.`);
    if (N.distinct && A.length > 1 && new Set(A.map(a => normS(a.raw))).size < A.length) out.push('Предложения должны быть разными.');
    if (N.start && A.length && !N.start.some(s => (' ' + toks[0].join(' ') + ' ').startsWith(' ' + s + ' '))) out.push(`Начните предложение с «${N.start[0][0].toUpperCase() + N.start[0].slice(1)}».`);
    (N.has || []).forEach(alts => { if (!alts.some(has)) out.push(alts.length > 3 ? 'Нужен модальный глагол: kan, vil, skal, må, bør…' : `Нужно слово «${alts[0]}».`); });
    (N.each || []).forEach(w => { if (A.length > 1 && toks.some(t => !t.includes(w))) out.push(`Слово «${w}» нужно в каждом предложении.`); });
    if (N.q === 'wh' && A.some(a => !a.q || !W_QW.has((a.toks[0] || {}).l))) out.push('Нужен вопрос с вопросительным словом в начале (Hva, Hvor, Når…) и «?» в конце.');
    if (N.q === 'yn' && A.some(a => !a.q || W_QW.has((a.toks[0] || {}).l) || wFin((a.toks[0] || {}).l) === false)) out.push('Нужен вопрос без вопросительного слова: глагол первым и «?» в конце — Bor du i Oslo?');
    if (N.stmt && A.some(a => a.q)) out.push('Здесь нужно утверждение, а не вопрос.');
    if (N.ls === 'first' && !A.some(a => a.startsSub)) out.push('Начните с придаточного (Når / Hvis / Fordi …), потом запятая, глагол и подлежащее.');
    if (N.ls === 'end' && !A.some(a => a.subs.some(s => !s.first))) out.push('Придаточное должно стоять в конце: «… fordi / når / hvis / at …».');
    if (N.words) {
      const miss = N.words.filter(alt => !alt.split('|').some(s => words.some(w => w.startsWith(s))));
      if (miss.length) out.push(`Используйте слова из задания (нет: ${miss.map(m => '«' + m.split('|')[0] + '»').join(', ')}).`);
    }
    if (N.order) {
      const pos = N.order.map(s => words.findIndex(w => w.startsWith(s)));
      if (pos.every(p => p >= 0) && pos.some((p, j) => j && p < pos[j - 1])) out.push(`Проверьте порядок частей: ${N.order.map(s => '«' + s + '»').join(' → ')}.`);
    }
    return out;
  }
  /** the whole check of a text for a task → { ok, perfect, issues, good, missing, unsure, sentences } */
  function wCheck(task, text) {
    const sents = wSentences(text);
    const A = sents.map(wAnalyze);
    const model = (task.model || []).map(normS);
    const perfect = model.length > 0 && model.includes(normS(text));
    const missing = perfect ? [] : wRequire(task, A);
    const issues = [];
    A.forEach((a, i) => a.issues.forEach(x => issues.push(Object.assign({ s: i, said: a.raw }, x))));
    const noV = A.filter(a => !a.finN && a.toks.length > 1);
    if (W_LEX_OK && noV.length) issues.push({ s: -1, lvl: noV.some(a => a.toks.length > 2) ? 'err' : 'warn', msg: 'Не вижу глагола в нужной форме (bor, spiser, er, var…) — проверьте, есть ли он и как написан.', fix: '' });
    const errs = issues.filter(x => x.lvl === 'err');
    const ok = !!A.length && (perfect || (!errs.length && !missing.length));
    return { ok, perfect, issues, missing, good: A.flatMap(a => a.good).slice(0, 4), unsure: A.some(a => a.unsure), n: A.length, A };
  }
  function writeItems(d) {
    const W = d.slots && d.slots.write, S = d.slots || {}, on = id => !(S.sources && S.sources[id] && S.sources[id].on === false);
    return (W && Array.isArray(W.tasks) ? W.tasks : []).filter(t => t && t.id && t.task && t.ex && (!t.source || on(t.source)));
  }
  /** a task as a round item (the example is the «right» sentence for the results and «➕ в карточки») */
  const wItem = t => Object.assign({}, t, { wtask: true, no: (t.model && t.model[0]) || String(t.ex.no).split(' → ').pop(), ru: t.model ? (t.modelRu || tx(t.task)) : t.ex.ru });
  const wBadge = t => (t.source === 'bnorsk' && bnorsk() && bnorsk().on !== false ? `<span class="ot-badge pt-src" title="${esc(bnorsk().label)}">${esc(t.n || '')} · Bnorsk.no</span>` : '');

  /* ---------- 🤖 «Проверить подробно» — the AI's JSON ---------- */
  const otAiReady = () => { try { return !!(globalThis.AI && AI.chain && AI.call && AI.chain().length); } catch (e) { return false; } };
  function wAiPrompt(t, text) {
    const system = 'Ты — доброжелательный учитель норвежского языка (букмол) для взрослого русскоязычного ученика уровня A2. Ты проверяешь короткие предложения, главное — порядок слов. Отвечай ТОЛЬКО одним JSON-объектом, без текста вокруг и без markdown.';
    const user = `Задание: «${tx(t.task)}»${t.nb ? `\nЗадание по-норвежски: «${t.nb}»` : ''}${t.given ? `\nИсходные предложения: «${t.given.no}»` : ''}
Текст ученика:
"""
${String(text).slice(0, 1500)}
"""
Проверь: выполнено ли задание; порядок слов — V2 (глагол на 2-м месте, инверсия после обстоятельства: «I dag går jeg»), вопросы, придаточные (союз → подлежащее → ikke → глагол: «fordi jeg ikke har tid»), место ikke в главном, модальный глагол + инфинитив без å; кратко — грамматику и слова.
Верни JSON строго такого вида:
{"ok":true,"task_done":true,"errors":[{"frag":"фрагмент из текста ученика буква в букву","fix":"исправление по-норвежски","why":"одно короткое правило по-русски","kind":"order"}],"corrected":"весь текст ученика, исправленный (сохрани мысль)","comment":"1–2 простых предложения по-русски: что хорошо и что исправить","alt":"ещё один естественный вариант по-норвежски на эту же тему"}
kind — одно из: "order", "grammar", "vocab", "spelling". ok = true, если ошибок в порядке слов и грамматике нет. Не придумывай ошибок и не исправляй то, что верно; не больше 6 ошибок.`;
    return { system, user };
  }
  function wAiParse(raw) {
    let j = null;
    try { j = AI.parseJSON ? AI.parseJSON(raw) : JSON.parse(raw); } catch (e) { j = null; }
    if (!j || typeof j !== 'object') { const m = String(raw || '').match(/\{[\s\S]*\}/); if (m) { try { j = JSON.parse(m[0]); } catch (e) { j = null; } } }
    if (!j || typeof j !== 'object') return null;
    const S_ = (v, n) => String(v == null ? '' : v).slice(0, n);
    return {
      ok: !!j.ok, done: j.task_done !== false,
      errors: (Array.isArray(j.errors) ? j.errors : []).slice(0, 8).filter(e => e && (e.frag || e.fix)).map(e => ({ frag: S_(e.frag, 200), fix: S_(e.fix, 200), why: S_(e.why, 300), kind: S_(e.kind, 20) })),
      corrected: S_(j.corrected, 1500), comment: S_(j.comment, 600), alt: S_(j.alt, 600),
    };
  }
  function wAiHtml(r) {
    const KIND = { order: 'порядок слов', grammar: 'грамматика', vocab: 'слово', spelling: 'написание' };
    return `<div class="wr-ai">
      <div class="wr-ai-head">🤖 <b>${r.ok && r.done ? 'Нейросеть: всё верно!' : r.done ? 'Нейросеть нашла, что поправить' : 'Нейросеть: задание выполнено не полностью'}</b></div>
      ${r.comment ? `<p class="wr-ai-c">${esc(r.comment)}</p>` : ''}
      ${r.errors.length ? `<ol class="wr-ai-errs">${r.errors.map(e => `<li><span><s lang="nb">${esc(e.frag)}</s> → <b lang="nb">${esc(e.fix)}</b>${KIND[e.kind] ? ` <span class="wr-kind">${KIND[e.kind]}</span>` : ''}</span>${e.why ? `<span class="small muted">${esc(e.why)}</span>` : ''}</li>`).join('')}</ol>` : ''}
      ${r.corrected && !(r.ok && !r.errors.length) ? `<div class="wr-ai-fix"><span class="small muted">Исправленный текст:</span> <b lang="nb">${esc(r.corrected)}</b> <button type="button" class="media-btn sm" data-say-t="${esc(r.corrected)}" title="Прослушать" aria-label="Прослушать исправленный текст">${SPK(16)}</button></div>` : ''}
      ${r.alt ? `<div class="wr-ai-alt small"><span class="muted">Ещё вариант:</span> <span lang="nb">${esc(r.alt)}</span></div>` : ''}
      <div class="tiny muted">Нейросеть может ошибаться — если сомневаетесь, сравните с правилом и образцом.</div></div>`;
  }

  /* ---------- ✍️ the round ---------- */
  function runWrite(ctx, items) {
    const S = newSession('posW', items, { back: 'pos', backLabel: '← Таблица позиций' });
    let checked = false, draft = '', aiBusy = false;
    const it = () => S.items[S.i];
    const show = () => {
      if (S.i >= S.items.length) { ctx.inGame = false; resultsView(ctx, S, () => startPos(ctx, 'write'), m => runWrite(ctx, m)); return; }
      ctx.inGame = S.results.length > 0;
      checked = false; draft = '';
      const x = it();
      const exNo = String(x.ex.no);
      ctx.body.innerHTML = `${posBack()}${scoreBar(S)}
        <div class="ot-task wr-task"><div class="ot-badges"><span class="ot-badge">✍️ Напиши сам</span><span class="ot-badge">${esc(tx(((DATA.slots.groups || []).find(g => g.id === x.g) || {}).name) || '')}</span>${wBadge(x)}</div>
          <div class="wr-q">${esc(tx(x.task))}</div>
          ${x.nb ? `<div class="wr-nb small" lang="nb">${esc(x.nb)}</div>` : ''}
          ${x.given ? `<div class="pt-src-box wr-given"><div class="pt-src-no" lang="nb">${esc(x.given.no)} <button type="button" class="media-btn sm" data-say-t="${esc(String(x.given.no).replace(/^[^:«]+:\s*/, ''))}" title="Прослушать" aria-label="Прослушать исходное предложение">${SPK(16)}</button></div>${x.given.ru ? `<div class="small ru-text">${esc(x.given.ru)}</div>` : ''}</div>` : ''}
          <div class="wr-ex"><span class="wr-ex-lbl">💡 Пример${x.given ? ' (на других словах)' : ''}:</span> <span lang="nb">${esc(exNo)}</span> <button type="button" class="media-btn sm" data-say-t="${esc(exNo.split(' → ').pop())}" title="Прослушать пример" aria-label="Прослушать пример">${SPK(16)}</button><div class="small ru-text">${esc(x.ex.ru)}</div></div>
          ${x.tip ? `<div class="wr-tip small">📏 ${esc(tx(x.tip))}</div>` : ''}
        </div>
        <label class="wr-label" for="wr-in">Ваше предложение по-норвежски</label>
        <textarea id="wr-in" class="input wr-in" data-wr-in rows="${(x.need && x.need.n > 1) ? 4 : 2}" lang="nb" spellcheck="false" autocapitalize="sentences" autocomplete="off" placeholder="Skriv her…"></textarea>
        <div class="ot-act"><button type="button" class="btn ghost" data-dunno title="Показать образец — без очков">🤷 Не знаю</button><button type="button" class="btn primary" data-check disabled title="Проверить порядок слов (Enter)">Проверить</button></div>
        <div class="ot-fb" data-fb hidden aria-live="polite"></div>
        ${x.source === 'bnorsk' && credit() ? `<div class="tiny muted ot-attr">Задание: ${credit()} · пример — Norsk Kort</div>` : ''}`;
      const ta = ctx.body.querySelector('[data-wr-in]');
      if (ta) setTimeout(() => { try { if (ctx.alive() && matchMedia('(pointer: fine)').matches) ta.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 80);
    };
    const fbHtml = (res, dunno, got) => {
      const x = it();
      const head = dunno ? '🤷 Вот как можно написать:' : res.ok ? (res.perfect ? '✓ Точно как в образце!' : '✓ Отлично! Порядок слов верный.') : '✗ Почти! Поправьте:';
      const errs = dunno ? [] : res.issues.filter(i => i.lvl !== 'tip');
      const tips = dunno ? [] : res.issues.filter(i => i.lvl === 'tip');
      const model = x.model && x.model[0] ? x.model[0] : String(x.ex.no).split(' → ').pop();
      return `<div class="ot-fb-head">${head}${got ? ` <span class="ot-plus">+${got}</span>${S.streak >= 3 ? ` <span class="ot-hot">🔥 ${S.streak} подряд</span>` : ''}` : ''}</div>
        ${!dunno && res.missing.length ? `<ul class="wr-list wr-miss">${res.missing.map(m => `<li>🎯 ${esc(m)}</li>`).join('')}</ul>` : ''}
        ${errs.length ? `<ul class="wr-list wr-errs">${errs.map(e => `<li class="${e.lvl}"><div>📏 ${esc(e.msg)}</div>${e.fix ? `<div class="wr-fix"><span class="small muted">Лучше:</span> <b lang="nb">${esc(e.fix)}</b> <button type="button" class="media-btn sm" data-say-t="${esc(e.fix)}" title="Прослушать" aria-label="Прослушать исправленное предложение">${SPK(16)}</button></div>` : ''}</li>`).join('')}</ul>` : ''}
        ${!dunno && res.good.length ? `<ul class="wr-list wr-good">${res.good.map(g => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
        ${tips.length ? `<ul class="wr-list wr-tips">${tips.map(t => `<li>✏️ ${esc(t.msg)}</li>`).join('')}</ul>` : ''}
        ${!dunno && res.ok && res.unsure && !res.perfect ? '<div class="small muted">Проверка примерная: программа смотрит порядок слов, но не смысл и не каждое слово.</div>' : ''}
        ${dunno || !res.ok || x.model ? `<div class="ot-right"><span class="small muted">${x.model ? 'Образец:' : 'Пример:'}</span> <span lang="nb">${esc(model)}</span> <button type="button" class="media-btn sm" data-say-t="${esc(model)}" title="Прослушать" aria-label="Прослушать образец">${SPK(16)}</button></div>` : ''}
        <div class="ot-fb-act">
          ${otAiReady() && !dunno ? '<button type="button" class="btn ai" data-ai title="Нейросеть проверит текст и объяснит ошибки">🤖 Проверить подробно</button>' : ''}
          ${!res.ok && !dunno ? '<button type="button" class="btn sm" data-mk title="Добавить образец в карточки">➕ в карточки</button>' : ''}
          <button type="button" class="btn primary" data-next>${S.i + 1 < S.items.length ? 'Дальше →' : 'Итоги'}</button></div>
        <div data-ai-out></div>`;
    };
    const check = async dunno => {
      const ta = ctx.body.querySelector('[data-wr-in]'), x = it();
      const text = ta ? ta.value.trim() : '';
      if (!dunno && !text) return;
      const btn = ctx.body.querySelector('[data-check]');
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> Проверяю…'; }
      if (!dunno) { try { await wPrepare(text); } catch (e) { /* the built-in word list only */ } }
      if (!ctx.alive() || it() !== x) return;
      const res = dunno ? { ok: false, issues: [], missing: [], good: [] } : wCheck(x, text);
      let got = 0;
      if (!checked) {
        checked = true;
        got = award(S, res.ok);
        const errs = res.missing.concat(res.issues.filter(i => i.lvl === 'err').map(i => i.msg));
        S.results.push({ it: wItem(x), ok: res.ok, got, given: dunno ? '' : text, hint: res.ok ? '' : errs[0] || tx(x.tip) || '' });
        ctx.inGame = S.i < S.items.length - 1;
        const sc = ctx.body.querySelector('.ot-score'); if (sc) sc.outerHTML = scoreBar(S);
      }
      const fb = ctx.body.querySelector('[data-fb]');
      fb.hidden = false; fb.className = 'ot-fb ' + (res.ok ? 'ok' : 'bad');
      fb.innerHTML = fbHtml(res, dunno, got);
      if (btn) { btn.innerHTML = dunno ? 'Проверить' : '↻ Проверить снова'; btn.disabled = !(ta && ta.value.trim()); btn.title = 'Исправьте текст и проверьте ещё раз (очки — за первую попытку)'; }
      const db = ctx.body.querySelector('[data-dunno]'); if (db) db.disabled = true;
      draft = text;
      if (res.ok) say(text); else if (dunno) say((x.model && x.model[0]) || String(x.ex.no).split(' → ').pop());
      focusNext(ctx);
    };
    const askAi = async () => {
      if (aiBusy) return;
      const ta = ctx.body.querySelector('[data-wr-in]'), out = ctx.body.querySelector('[data-ai-out]'), x = it();
      const text = ta ? ta.value.trim() : ''; if (!text || !out) return;
      aiBusy = true;
      const b = ctx.body.querySelector('[data-ai]'); if (b) b.disabled = true;
      out.innerHTML = '<div class="wr-ai wr-ai-wait" role="status"><span class="spinner sm"></span> Нейросеть читает ваше предложение…</div>';
      let r = null;
      try { const p = wAiPrompt(x, text); r = wAiParse(await wTimeout(AI.call({ system: p.system, user: p.user, maxTokens: 1200, temperature: 0.2, quiet: true }), 60000)); } catch (e) { r = null; }
      aiBusy = false;
      if (!ctx.alive() || it() !== x) return;
      if (b) b.disabled = false;
      out.innerHTML = r ? wAiHtml(r) : '<div class="wr-ai wr-ai-err" role="status">🤖 Нейросеть сейчас не ответила — попробуйте чуть позже. Простая проверка выше работает и без неё.</div>';
    };
    ctx.body.onclick = async e => {
      const t = e.target.closest('button'); if (!t || t.disabled) return;
      if (t.dataset.otGo) { if (await askEnd(ctx)) ctx.go(t.dataset.otGo); return; }
      if (t.dataset.sayT) { say(t.dataset.sayT); return; }
      if (t.hasAttribute('data-check')) { check(false); return; }
      if (t.hasAttribute('data-dunno')) { check(true); return; }
      if (t.hasAttribute('data-ai')) { askAi(); return; }
      if (t.hasAttribute('data-mk')) { addCards([S.results[S.results.length - 1]], ctx, t); return; }
      if (t.hasAttribute('data-next')) {
        const ta = ctx.body.querySelector('[data-wr-in]');
        if (!checked && ta && ta.value.trim() && !(await UI.confirm('Предложение ещё не проверено. Перейти к следующему заданию?', { ok: 'Дальше', title: 'Пропустить?' }))) return;
        S.i++; show();
      }
    };
    ctx.body.oninput = e => {
      if (!e.target.matches('[data-wr-in]')) return;
      const v = e.target.value.trim(), b = ctx.body.querySelector('[data-check]');
      if (b) b.disabled = !v || (checked && v === draft);
      if (!checked) ctx.inGame = !!v || S.results.length > 0;
    };
    ctx.onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const inTa = e.target && e.target.matches && e.target.matches('[data-wr-in]');
      if (inTa && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const b = ctx.body.querySelector('[data-check]');
        if (b && !b.disabled) check(false); else if (checked) { const n = ctx.body.querySelector('[data-next]'); if (n) n.click(); }
        return;
      }
      if (!inTa && checked && (e.key === 'Enter' || e.key === ' ') && !(e.target && e.target.closest && e.target.closest('button'))) { e.preventDefault(); S.i++; show(); }
    };
    show();
  }

  /* ================= 📚 ready-made grammar decks + 📐 «Таблицы форм» catalogue ================= */
  const S_TEXT = (s, max) => Store.Safe.text(String(s == null ? '' : s), max);
  const fullName = d => `${S_TEXT(d.icon, 8)} ${S_TEXT(d.name, 120)}`.trim();
  function findDeck(d) { return Store.decks().find(x => x.gramDeck === d.id) || Store.decks().find(x => x.name === fullName(d) || x.name === d.name); }
  const cardKey = c => String(c.key || c.no || '');
  /** the translation shown in previews: 🇷🇺 / 🇺🇦 / both (Settings → «Язык перевода») */
  const trOf = c => (window.Study && Study.tr ? Study.tr(c) : String(c.ru || ''));
  /** one card of the data file → the fields a card gets (everything through Store.Safe) */
  function cardFields(d, c, attribution) {
    const list = (arr, keys) => Store.Safe.list(Array.isArray(arr) ? arr.slice(0, 40) : [], keys).filter(x => x.no);
    const f = {
      gramKey: S_TEXT(c.key, 80), no: S_TEXT(c.no, 200), ru: S_TEXT(c.ru, 400), uk: S_TEXT(c.uk, 400), wordClass: S_TEXT(c.wordClass, 40),
      description: S_TEXT(c.description, 3000), example: S_TEXT(c.example, 400), exampleRu: S_TEXT(c.exampleRu, 400),
      forms: list(c.forms, ['label', 'no', 'ru', 'uk']), examples: list(c.examples, ['label', 'no', 'ru', 'note']),
      tags: (Array.isArray(d.tags) ? d.tags : []).slice(0, 6).map(t => S_TEXT(t, 40)).filter(Boolean).concat(['norsk-kort']),
    };
    // 🇺🇦 no Ukrainian in the data yet: leave the card's own (maybe typed by the user) untouched
    if (!f.uk) delete f.uk;
    return f;
  }
  // forms are compared without the extra translations the app adds later (trBy / uk typed or translated by the user)
  const formsKey = (arr, withUk) => JSON.stringify((arr || []).map(x => ({ label: x.label || '', no: x.no || '', ru: x.ru || '', uk: withUk ? x.uk || '' : '' })));
  const same = (c, f) => ['no', 'ru', 'wordClass', 'description', 'example', 'exampleRu'].every(k => (c[k] || '') === (f[k] || ''))
    && (!f.uk || (c.uk || '') === f.uk)
    && formsKey(c.forms, (f.forms || []).some(x => x.uk)) === formsKey(f.forms, true) && JSON.stringify(c.examples || []) === JSON.stringify(f.examples);
  const findOld = (have, f) => have.find(x => f.gramKey && x.gramKey === f.gramKey) || have.find(x => U.norm(x.no) === U.norm(f.no));

  /* 🗂 which tables the user has had in work: localStorage nk-tables { tableId: { added, deletedAt } } (deleted = the deck is gone from Store) */
  const TABLES_KEY = 'nk-tables';
  function tables() { try { const o = JSON.parse(localStorage.getItem(TABLES_KEY) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
  function saveTables(o) { try { localStorage.setItem(TABLES_KEY, JSON.stringify(o)); } catch (e) { /* private mode: only the hint is lost */ } }
  function markAdded(id) { const T = tables(); T[id] = { added: Date.now(), deletedAt: null }; saveTables(T); }
  /** 'use' (the deck exists) · 'gone' (was added, the deck was deleted) · 'new' */
  function tableStatus(d, deck) {
    const T = tables(), e = T[d.id];
    if (deck) {
      if (!e || !e.added || e.deletedAt) { T[d.id] = { added: (e && e.added && !e.deletedAt ? e.added : null) || deck.created || Date.now(), deletedAt: null }; saveTables(T); }
      return 'use';
    }
    if (e && e.added) { if (!e.deletedAt) { e.deletedAt = Date.now(); saveTables(T); } return 'gone'; }
    return 'new';
  }

  /** add the deck, or bring an added one up to date (cards matched by gramKey / Norwegian — never twins; progress kept).
   *  opts.only: keys of the cards to add (chosen rows) · opts.updateOnly: only refresh the cards that are already there */
  function installDeck(d, attribution, opts = {}) {
    const only = opts.only ? new Set(opts.only) : null;
    let deck = findDeck(d), created = false;
    const desc = S_TEXT(`${d.description}\n\n${attribution}`, 3000);
    if (!deck) {
      if (opts.updateOnly) return { deck: null, created: false, added: 0, updated: 0 };
      deck = Store.addDeck(fullName(d), desc); created = true;
    }
    Store.updateDeck(deck.id, { gramDeck: S_TEXT(d.id, 40), gramVer: +d.ver || 1, description: deck.description && !created && !/Norsk Kort|Источник/.test(deck.description) ? deck.description : desc });
    const have = Store.cards(deck.id);
    let added = 0, updated = 0;
    (Array.isArray(d.cards) ? d.cards.slice(0, 200) : []).forEach(c => {
      if (!c || typeof c !== 'object') return;
      const f = cardFields(d, c, attribution);
      if (!f.no) return;
      const old = findOld(have, f);
      if (old) {
        if (same(old, f)) return;
        Store.updateCard(old.id, Object.assign({}, f, { tags: [...new Set((old.tags || []).concat(f.tags))], history: Prov.add(old, Prov.entry('manual', 'edit', null, 'обновлено из готовой колоды Norsk Kort')) }));
        updated++;
      } else {
        if (opts.updateOnly || (only && !only.has(cardKey(c)))) return;
        Store.addCard(deck.id, Object.assign({}, f, { history: [Prov.entry('manual', 'create', null, d._src ? `Norsk Kort — готовая колода · источник: ${d._src}` : 'Norsk Kort — готовая колода (собственный материал)'), Prov.entry('manual', 'forms', null, 'формы сверены с Ordbøkene')] }));
        added++;
      }
    });
    if (created || added) markAdded(d.id);
    return { deck, created, added, updated };
  }
  /** { deck, n, todo, missing, changed, missingKeys } — todo = what «🔄 Обновить» of the old view did (missing + changed) */
  function deckState(d) {
    const deck = findDeck(d); if (!deck) return { deck: null, n: 0, todo: d.cards.length, missing: d.cards.length, changed: 0, missingKeys: d.cards.map(cardKey) };
    const have = Store.cards(deck.id);
    let missing = 0, changed = 0; const missingKeys = [];
    d.cards.forEach(c => { const f = cardFields(d, c); const old = findOld(have, f); if (!old) { missing++; missingKeys.push(cardKey(c)); } else if (!same(old, f)) changed++; });
    return { deck, n: have.length, todo: missing + changed, missing, changed, missingKeys };
  }
  async function closeAllThen(fn) {
    const open = [...document.querySelectorAll('#modal-root > .modal-backdrop:not(.closing)')].reverse();
    for (const bd of open) { if (bd._m) { if (!(await bd._m.tryClose())) return; } else bd.remove(); }
    fn();
  }
  const TGROUPS = [['verb', '🏃', 'Глаголы'], ['noun', '📦', 'Существительные'], ['adj', '📏', 'Прилагательные'], ['pron', '👥', 'Местоимения'], ['other', '❓', 'Вопросы и грамматика']];
  const WORDCLASS = new Set(TGROUPS.map(g => g[0]));
  const groupOf = d => (WORDCLASS.has(d.group) && d.group) || ({ noun: 'noun', verb: 'verb', adj: 'adj', pron: 'pron', poss: 'pron' }[d.kind]) || (['modal', 'aa', 'pairs'].includes(d.id) ? 'verb' : 'other');
  /** the catalogue's big headings (deck.group); a deck without one — or with an old word-class group — is a form table */
  const SECTIONS = [['forms', '📐', 'Таблицы форм'], ['verbs', '🏃', 'Глаголы'], ['prepositions', '📍', 'Предлоги'], ['dictionary', '📖', 'Мой словарь'], ['pronunciation', '🗣️', 'Произношение'], ['phrases', '✍️', 'Фразы для письма'], ['phrasebook', '💬', 'Разговорник по ситуациям']];
  const sectionOf = d => (SECTIONS.some(x => x[0] === d.group) ? d.group : 'forms');
  const hasParadigm = d => Array.isArray(d.cards) && d.cards.length && d.cards.every(c => c.paradigm && c.paradigm.forms);
  const srcLine = d => d._src
    ? `Источник: ${d._srcUrl ? `<a href="${esc(d._srcUrl)}" target="_blank" rel="noopener">${esc(d._src)}</a>` : esc(d._src)}`
    : 'Собственный материал Norsk Kort';
  const formsJoin = a => (Array.isArray(a) ? a : []).join(' / ');
  /** the whole table of a deck: paradigm columns (forms decks) or the form labels (grammar decks) */
  function deckTableHtml(d, D) {
    if (hasParadigm(d)) {
      const pos = d.cards[0].paradigm.pos, order = Object.keys((D.paradigmSlots || {})[pos] || {}).filter(k => k !== '_note');
      const keys = order.filter(k => d.cards.some(c => (c.paradigm.forms[k] || []).length));
      const head = k => ((D.paradigmShort || {})[pos] || {})[k] || k;
      return `<table class="tf-tbl"><thead><tr><th scope="col">Слово</th>${keys.map(k => `<th scope="col" title="${esc(((D.paradigmSlots || {})[pos] || {})[k] || '')}">${esc(head(k))}</th>`).join('')}</tr></thead>
        <tbody>${d.cards.map(c => `<tr><th scope="row"><span lang="nb">${esc(c.no)}</span><small>${esc(trOf(c))}</small></th>${keys.map(k => `<td lang="nb">${esc(formsJoin(c.paradigm.forms[k])) || '—'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    }
    const labels = [...new Set(d.cards.flatMap(c => (c.forms || []).map(f => f.label)))];
    if (labels.length && labels.length <= 8) {
      const short = l => l.replace(/\s*\(.*\)\s*/, '');
      return `<table class="tf-tbl"><thead><tr><th scope="col">Слово</th>${labels.map(l => `<th scope="col" title="${esc(l)}">${esc(short(l))}</th>`).join('')}</tr></thead>
        <tbody>${d.cards.map(c => `<tr><th scope="row"><span lang="nb">${esc(c.no)}</span><small>${esc(trOf(c))}</small></th>${labels.map(l => { const f = (c.forms || []).find(x => x.label === l); return `<td lang="nb">${f ? esc(f.no) : '—'}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
    }
    return `<table class="tf-tbl tf-list"><thead><tr><th scope="col">Слово</th><th scope="col">Формы и примеры</th></tr></thead>
      <tbody>${d.cards.map(c => `<tr><th scope="row"><span lang="nb">${esc(c.no)}</span><small>${esc(trOf(c))}</small></th><td>${(c.forms || []).length ? c.forms.map(f => `<div><small>${esc(f.label)}:</small> <span lang="nb">${esc(f.no)}</span></div>`).join('')
        // phrase decks (no forms): the example and the word-order note
        : `${c.example ? `<div lang="nb">${esc(c.example)}</div>${c.exampleRu ? `<small>${esc(c.exampleRu)}</small>` : ''}` : ''}${c.description ? `<div class="tf-note"><small>${esc(String(c.description).split('\n')[0])}</small></div>` : ''}`}</td></tr>`).join('')}</tbody></table>`;
  }

  VIEWS.decks = async ctx => {
    ctx.title('📚 Таблицы форм и готовые колоды');
    ctx.body.innerHTML = '<div class="ot-loading"><span class="spinner"></span> Загружаю таблицы…</div>';
    const D = await decksData();
    if (!ctx.alive()) return;
    const open = new Set();
    const deckHtml = d => {
      const st = deckState(d), n = d.cards.length, status = tableStatus(d, st.deck), par = hasParadigm(d);
      const stats = st.deck ? Store.deckStats(st.deck.id) : null;
      const quiz = par ? `<button type="button" class="btn sm ghost" data-quiz="${esc(d.id)}">✍️ Впиши форму</button>` : '';
      let state = '', act = '';
      if (status === 'use') {
        state = `<div class="tf-state use">✓ В работе: колода «${esc(st.deck.name)}» · ${U.cards(st.n)} · выучено ${stats.learnedPct}%</div>`;
        act = `<button type="button" class="btn sm primary" data-study="${esc(d.id)}">▶ Учить</button><button type="button" class="btn sm ghost" data-open="${esc(d.id)}">Открыть</button>`
          + (st.changed ? `<button type="button" class="btn sm" data-upd="${esc(d.id)}">🔄 Обновить (${st.changed})</button>` : '')
          + (st.missing ? `<button type="button" class="btn sm" data-more="${esc(d.id)}">➕ Добавить новые слова (${st.missing})</button>` : '') + quiz;
      } else {
        if (status === 'gone') state = '<div class="tf-state gone">🗑 Вы удалили эту колоду — ничего страшного. Если захотите, можете создать её заново: прогресс начнётся с нуля.</div>';
        act = `<button type="button" class="btn primary" data-add="${esc(d.id)}">➕ ${status === 'gone' ? 'Создать заново' : 'Создать колоду'}</button><button type="button" class="btn sm ghost" data-pick="${esc(d.id)}">☑ Выбрать слова</button>${quiz}`;
      }
      return `<div class="ot-deck tf-card ${status}" data-deck="${esc(d.id)}">
        <div class="ot-deck-ico" aria-hidden="true">${esc(d.icon)}</div>
        <div class="ot-deck-txt"><b>${esc(d.name)}</b><span>${esc(d.description)}</span>
          <small>${n} ${U.plural(n, ['карточка', 'карточки', 'карточек'])} · <span class="tf-src">${srcLine(d)}</span></small>
          ${state}
          <div class="ot-deck-sample" lang="nb">${d.cards.slice(0, 6).map(c => `<span>${esc(c.no)}</span>`).join('')}${n > 6 ? `<span class="more">+${n - 6}</span>` : ''}</div>
          <details class="tf-more" data-tbl-of="${esc(d.id)}" ${open.has(d.id) ? 'open' : ''}><summary>📋 Вся таблица (${n})</summary><div class="ot-scroll" tabindex="0" role="region" aria-label="Таблица: ${esc(d.name)}">${open.has(d.id) ? deckTableHtml(d, D) : ''}</div></details></div>
        <div class="ot-deck-act">${act}</div></div>`;
    };
    /** form tables by word class (as before); with more files — big headings «Таблицы форм · Глаголы · Предлоги · Мой словарь · Произношение» */
    const sectionsHtml = () => {
      const secs = SECTIONS.map(([id, ico, name]) => [id, ico, name, D.decks.filter(d => sectionOf(d) === id)]).filter(x => x[3].length);
      const many = secs.length > 1;
      return secs.map(([id, ico, name, ds]) => {
        const inner = id === 'forms'
          ? TGROUPS.map(([g, gi, gn]) => { const dd = ds.filter(d => groupOf(d) === g); return dd.length ? `<${many ? 'h4' : 'h3'} class="tf-group${many ? ' tf-sub' : ''}"><span aria-hidden="true">${gi}</span> ${gn}</${many ? 'h4' : 'h3'}><div class="ot-decks">${dd.map(deckHtml).join('')}</div>` : ''; }).join('')
          : `<div class="ot-decks">${ds.map(deckHtml).join('')}</div>`;
        return many ? `<section class="tf-section" data-sec="${esc(id)}"><h3 class="tf-group tf-sec-h"><span aria-hidden="true">${ico}</span> ${name} <span class="tf-sec-n">${ds.length}</span></h3>${inner}</section>` : inner;
      }).join('');
    };
    const draw = () => {
      const y = (ctx.m.$('.modal-body') || {}).scrollTop || 0;
      ctx.body.innerHTML = `${backBtn()}
        <div class="lib-intro">📚 <span>Таблицы форм и готовые колоды. Колода — одним нажатием, целиком или <b>только выбранные слова</b> (остальные можно добавить потом, без повторов). На обороте карточки — все формы с переводом и 🔊. <b>✍️ Впиши форму</b> — проверка по таблице.</span></div>
        ${sectionsHtml()}
        <div class="tiny muted ot-attr">© ${esc(D.attribution)}${(D._credits || []).map(c => ` · ${esc(c)}`).join('')}</div>`;
      const mb = ctx.m.$('.modal-body'); if (mb && y) mb.scrollTop = y;
      // the whole table is drawn when it is opened (70 verbs × 5 forms — not on every redraw)
      ctx.body.querySelectorAll('[data-tbl-of]').forEach(det => det.addEventListener('toggle', () => {
        const id = det.dataset.tblOf, d = D.decks.find(x => x.id === id); if (!d) return;
        if (det.open) { open.add(id); const sc = det.querySelector('.ot-scroll'); if (sc && !sc.firstElementChild) sc.innerHTML = deckTableHtml(d, D); } else open.delete(id);
      }));
    };
    draw();
    ctx.body.onclick = e => {
      const t = e.target.closest('button'); if (!t || t.disabled) return;
      if (t.dataset.otGo) { ctx.go(t.dataset.otGo); return; }
      const id = t.dataset.add || t.dataset.upd || t.dataset.study || t.dataset.open || t.dataset.pick || t.dataset.more || t.dataset.quiz;
      const d = D.decks.find(x => x.id === id); if (!d) return;
      if (t.dataset.pick) { ctx.go('pick', { id, mode: 'create' }); return; }
      if (t.dataset.more) { ctx.go('pick', { id, mode: 'add' }); return; }
      if (t.dataset.quiz) { ctx.go('tforms', { id }); return; }
      if (t.dataset.add || t.dataset.upd) {
        const r = installDeck(d, d._attr || D.attribution, t.dataset.upd ? { updateOnly: true } : {});
        Store.saveNow().catch(() => {});
        ctx.dirty = true;
        UI.toast(r.created ? `📚 Колода «${d.name}» создана: ${U.cards(r.added)}` : r.added || r.updated ? `🔄 «${d.name}»: обновлено ${r.updated}, добавлено ${r.added} — без повторов, прогресс сохранён` : `«${d.name}» уже актуальна`, 'good', 4500);
        draw();
        return;
      }
      const st = deckState(d); if (!st.deck) return;
      if (t.dataset.study) closeAllThen(() => Study.start({ deckId: st.deck.id }));
      else closeAllThen(() => App.go('deck', { id: st.deck.id }));
    };
  };

  /* ---------- ☑ choose the rows: a new deck from some words, or «добавить новые слова» later ---------- */
  VIEWS.pick = async (ctx, o) => {
    const D = await decksData();
    if (!ctx.alive()) return;
    const d = D.decks.find(x => x.id === o.id); if (!d) { ctx.go('decks'); return; }
    const st = deckState(d), add = o.mode === 'add' && st.deck;
    const rows = add ? d.cards.filter(c => st.missingKeys.includes(cardKey(c))) : d.cards;
    const chosen = new Set(add ? rows.map(cardKey) : []);
    ctx.title(add ? `➕ Новые слова: ${d.name}` : `☑ Выбрать слова: ${d.name}`);
    const draw = () => {
      ctx.body.innerHTML = `${backBtn('decks', '← Таблицы форм')}
        <div class="lib-intro">${d.icon} <span>${add ? `Этих слов ещё нет в колоде «${esc(st.deck.name)}». Отметьте, какие добавить — повторов не будет.` : 'Отметьте слова для новой колоды. Остальные можно добавить потом кнопкой «➕ Добавить новые слова».'}</span></div>
        <div class="tf-pick-bar"><button type="button" class="btn sm ghost" data-all>Выбрать все</button><button type="button" class="btn sm ghost" data-none>Снять все</button><span class="tf-count" aria-live="polite">Выбрано: <b>${chosen.size}</b> из ${rows.length}</span></div>
        <div class="tf-pick" role="group" aria-label="Слова">${rows.map(c => { const k = cardKey(c); return `<label class="tf-row ${chosen.has(k) ? 'on' : ''}"><input type="checkbox" data-k="${esc(k)}" ${chosen.has(k) ? 'checked' : ''}><span class="tf-row-no" lang="nb">${esc(c.no)}</span><span class="tf-row-ru">${esc(trOf(c))}</span></label>`; }).join('')}</div>
        <div class="ot-start"><button type="button" class="btn primary lg" data-go ${chosen.size ? '' : 'disabled'}>${add ? `➕ Добавить (${chosen.size})` : `➕ Создать колоду (${chosen.size})`}</button></div>`;
    };
    draw();
    const refresh = () => {
      const c = ctx.body.querySelector('.tf-count b'); if (c) c.textContent = chosen.size;
      const g = ctx.body.querySelector('[data-go]'); if (g) { g.disabled = !chosen.size; g.textContent = add ? `➕ Добавить (${chosen.size})` : `➕ Создать колоду (${chosen.size})`; }
    };
    ctx.body.onchange = e => {
      const i = e.target.closest('input[data-k]'); if (!i) return;
      if (i.checked) chosen.add(i.dataset.k); else chosen.delete(i.dataset.k);
      i.closest('.tf-row').classList.toggle('on', i.checked); refresh();
    };
    ctx.body.onclick = e => {
      const t = e.target.closest('button'); if (!t || t.disabled) return;
      if (t.dataset.otGo) { ctx.go(t.dataset.otGo); return; }
      if (t.hasAttribute('data-all') || t.hasAttribute('data-none')) {
        const on = t.hasAttribute('data-all');
        rows.forEach(c => { if (on) chosen.add(cardKey(c)); else chosen.delete(cardKey(c)); });
        ctx.body.querySelectorAll('input[data-k]').forEach(i => { i.checked = on; i.closest('.tf-row').classList.toggle('on', on); });
        refresh(); return;
      }
      if (t.hasAttribute('data-go')) {
        const r = installDeck(d, d._attr || D.attribution, { only: [...chosen] });
        Store.saveNow().catch(() => {});
        ctx.dirty = true;
        UI.toast(r.created ? `📚 Колода «${d.name}» создана: ${U.cards(r.added)}` : `➕ «${d.name}»: добавлено ${U.cards(r.added)} — без повторов`, 'good', 4500);
        ctx.go('decks');
      }
    };
  };

  /* ---------- ✍️ «Впиши форму»: any form table (card.paradigm) ---------- */
  const ASK_SLOTS = { n: ['sd', 'pi', 'pd'], v: ['pres', 'past', 'perf', 'imp'], adj: ['af', 'an', 'adef', 'apl', 'cmp', 'sup', 'supd'], pron: ['obj', 'refl'], det: ['f', 'n', 'pl'] };
  const CUE = { v: { pres: 'jeg ___', past: 'i går: jeg ___', perf: 'jeg har ___', imp: '___!' } };
  /** typed answer / a form → comparable: case, «å» / «jeg» / «har», «!», the «seg» / «med» of «glede seg», «drive med» do not matter */
  const normF = s => low(s).replace(/[!.?,;:«»"]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(å|jeg|har|hadde) (?=\S)/, '').replace(/^(har) (?=\S)/, '').replace(/ (seg|meg|deg|oss|med)$/, '').trim();
  /** a question: { form: { head, lemma, slot, label, answers, also, alsoNote, … }, ru } */
  function formQuestion(d, c, slot, D) {
    const P = c.paradigm, lbl = tx((((D.paradigmRu || {})[P.pos]) || {})[slot]) || slot;
    const answers = (P.forms[slot] || []).slice(), also = ((P.alsoOk || {})[slot] || []).slice();
    return { ru: `${c.ru} · ${lbl}`, form: { deck: d.id, key: c.key, head: c.no, lemma: P.lemma, pos: P.pos, slot, label: lbl, cue: (CUE[P.pos] || {})[slot] || '', answers, also, alsoNote: also.length ? tx(P.alsoNote) : '', answer: answers.join(' / '), with: P.with || '', src: d._src || '', wordClass: c.wordClass || '' } };
  }
  /** → { ok, also } : every alternative counts; «also» = accepted with a note (kål / sild / torsk) */
  function checkForm(q, input) {
    const v = normF(input); if (!v) return { ok: false, also: false };
    if (q.answers.some(a => normF(a) === v)) return { ok: true, also: false };
    if (q.also.some(a => normF(a) === v)) return { ok: true, also: true };
    return { ok: false, also: false };
  }
  function formOptions(q, d) {
    const bad = new Set(q.answers.concat(q.also).map(normF));
    const c = d.cards.find(x => x.key === q.key), out = [];
    const push = f => { const n = normF(f); if (f && !bad.has(n) && !out.some(x => normF(x) === n)) out.push(f); };
    shuffle(Object.entries(c.paradigm.forms).filter(([k]) => k !== q.slot).flatMap(([, v]) => v)).forEach(push);
    shuffle(d.cards.filter(x => x !== c && x.paradigm.forms[q.slot]).map(x => x.paradigm.forms[q.slot][0])).forEach(push);
    return shuffle([q.answers[0]].concat(out.slice(0, 3)));
  }
  VIEWS.tforms = async (ctx, o) => {
    const D = await decksData();
    if (!ctx.alive()) return;
    const d = D.decks.find(x => x.id === o.id && hasParadigm(x)); if (!d) { ctx.go('decks'); return; }
    ctx.title(`✍️ Впиши форму: ${d.name}`);
    const p = prog(), pos = d.cards[0].paradigm.pos;
    const avail = (ASK_SLOTS[pos] || []).filter(k => d.cards.some(c => (c.paradigm.forms[k] || []).length));
    const saved = (p.tformSlots || {})[d.id];
    const cur = new Set(Array.isArray(saved) && saved.some(k => avail.includes(k)) ? saved.filter(k => avail.includes(k)) : avail);
    const lbl = k => tx(((D.paradigmRu || {})[pos] || {})[k]) || k;
    const draw = () => {
      ctx.body.innerHTML = `${backBtn('decks', '← Таблицы форм')}
        <div class="lib-intro">✍️ <span>Слово и нужная форма — впишите её (или выберите из вариантов). Засчитываются все допустимые варианты из таблицы.</span></div>
        <div class="dr-label">Какие формы спрашивать</div>
        <div class="ot-levels">${avail.map(k => `<button type="button" class="ot-level ${cur.has(k) ? 'on' : ''}" data-slot="${k}" aria-pressed="${cur.has(k)}"><span class="ot-lv-txt"><b>${esc(lbl(k))}</b></span></button>`).join('')}</div>
        ${UI.switchHtml('tf-hints', p.tformHints !== false, 'С подсказками: выбрать из вариантов (без них — вписать самому)')}
        <div class="ot-start"><button type="button" class="btn primary lg" data-start ${cur.size ? '' : 'disabled'}>▶ Начать (${ROUND} вопросов)</button></div>
        <div class="tiny muted ot-attr">${srcLine(d)}</div>`;
    };
    draw();
    ctx.body.onclick = e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.otGo) { ctx.go(t.dataset.otGo); return; }
      if (t.dataset.slot) { const k = t.dataset.slot; if (cur.has(k)) { if (cur.size > 1) cur.delete(k); } else cur.add(k); draw(); return; }
      if (t.hasAttribute('data-start')) {
        const sw = ctx.body.querySelector('[data-key="tf-hints"]');
        p.tformHints = !!(sw && sw.checked); p.tformSlots = Object.assign({}, p.tformSlots, { [d.id]: [...cur] }); Store.save();
        const pairs = shuffle(d.cards.flatMap(c => [...cur].filter(k => (c.paradigm.forms[k] || []).length).map(k => [c, k])));
        // ⭐ the most important verbs come first (stable sort keeps the shuffle inside each group)
        pairs.sort((a, b) => (b[0].important ? 1 : 0) - (a[0].important ? 1 : 0));
        // one question per word where possible
        const seen = new Set(), pick = [];
        pairs.forEach(([c, k]) => { if (pick.length < ROUND && !seen.has(c.key)) { seen.add(c.key); pick.push([c, k]); } });
        pairs.forEach(([c, k]) => { if (pick.length < ROUND && !pick.some(x => x[0] === c && x[1] === k)) pick.push([c, k]); });
        runForms(ctx, d, D, pick.map(([c, k]) => formQuestion(d, c, k, D)), p.tformHints);
      }
    };
  };
  function runForms(ctx, d, D, items, hints) {
    const S = newSession('tforms', items, { back: 'decks', backLabel: '← Таблицы форм' });
    let answered = false, opts = [];
    const pos = d.cards[0].paradigm.pos;
    const rowHtml = q => {
      const c = d.cards.find(x => x.key === q.form.key), keys = Object.keys(c.paradigm.forms);
      return `<div class="ot-scroll" tabindex="0" role="region" aria-label="Все формы"><table class="tf-tbl tf-one"><thead><tr>${keys.map(k => `<th scope="col">${esc(((D.paradigmShort || {})[pos] || {})[k] || k)}</th>`).join('')}</tr></thead>
        <tbody><tr>${keys.map(k => `<td lang="nb" class="${k === q.form.slot ? 'tf-hl' : ''}">${esc(formsJoin(c.paradigm.forms[k]))}</td>`).join('')}</tr></tbody></table></div>`;
    };
    const show = () => {
      if (S.i >= S.items.length) { ctx.inGame = false; resultsView(ctx, S, () => ctx.go('tforms', { id: d.id }), m => runForms(ctx, d, D, m, hints)); return; }
      ctx.inGame = S.results.length > 0; answered = false;
      const q = S.items[S.i].form;
      opts = hints ? formOptions(q, d) : [];
      ctx.body.innerHTML = `${backBtn('decks', '← Таблицы форм')}${scoreBar(S)}
        <div class="ot-task tf-q"><div class="tf-head" lang="nb">${esc(q.head)} <button type="button" class="media-btn sm" data-say-h title="Прослушать" aria-label="Прослушать слово">${SPK(16)}</button></div>
          <div class="ru-text small">${esc(S.items[S.i].ru.split(' · ')[0])}</div>
          <div class="tf-ask">${esc(q.label)}${q.cue ? ` · <span lang="nb">${esc(q.cue)}</span>` : ''}</div></div>
        ${hints ? `<div class="ot-opts">${opts.map((x, j) => `<button type="button" class="ot-opt" data-o="${j}"><b lang="nb">${esc(x)}</b><small>${j + 1}</small></button>`).join('')}</div>`
          : `<form class="tf-type" data-form autocomplete="off"><input type="text" class="input" data-in lang="nb" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Форма слова" placeholder="впишите форму">
              <div class="tf-keys">${['æ', 'ø', 'å'].map(ch => `<button type="button" class="btn sm ghost" data-ch="${ch}" aria-label="Вставить ${ch}">${ch}</button>`).join('')}</div>
              <div class="ot-act"><button type="button" class="btn ghost" data-dunno>🤷 Не знаю</button><button type="submit" class="btn primary" data-check>Проверить</button></div></form>`}
        <div class="ot-fb" data-fb hidden></div>`;
      const inp = ctx.body.querySelector('[data-in]'); if (inp) setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 60);
      const f = ctx.body.querySelector('[data-form]'); if (f) f.onsubmit = ev => { ev.preventDefault(); answer(inp.value, false); };
    };
    const answer = (val, dunno, j) => {
      if (answered) return;
      const it = S.items[S.i], q = it.form;
      if (!dunno && !String(val || '').trim()) { UI.toast('Впишите форму или нажмите «Не знаю»', '', 2000); return; }
      answered = true;
      const r = dunno ? { ok: false, also: false } : checkForm(q, val);
      const got = award(S, r.ok);
      const hint = `${q.label}: ${q.answer}`;
      S.results.push({ it, ok: r.ok, given: dunno ? '' : `${q.head} → ${val}`, hint: r.ok ? '' : hint });
      ctx.inGame = S.i < S.items.length - 1;
      ctx.body.querySelectorAll('[data-o]').forEach(b => { b.disabled = true; const x = opts[+b.dataset.o]; const right = checkForm(q, x).ok; b.classList.toggle('right', right); b.classList.toggle('wrong', +b.dataset.o === j && !right); });
      ctx.body.querySelectorAll('[data-form] input, [data-form] button').forEach(b => { b.disabled = true; });
      const spoken = (q.cue ? q.cue.replace(/^i går: /, '').replace('___', q.answers[0]) : q.answers[0]) + (q.with && q.pos === 'v' ? ' ' + (q.cue ? q.with.replace(/\bseg\b/, q.cue.startsWith('___') ? 'deg' : 'meg') : q.with) : '');
      const fb = ctx.body.querySelector('[data-fb]');
      fb.hidden = false; fb.className = 'ot-fb ' + (r.ok ? 'ok' : 'bad');
      fb.innerHTML = `<div class="ot-fb-head">${r.ok ? `✓ Верно! <span class="ot-plus">+${got}</span>${S.streak >= 3 ? ` <span class="ot-hot">🔥 ${S.streak} подряд</span>` : ''}` : dunno ? '🤷 Правильно:' : '✗ Не совсем'}</div>
        ${!r.ok && !dunno ? `<div class="ot-given small muted">Ваш ответ: <s lang="nb">${esc(val)}</s></div>` : ''}
        ${r.also ? `<div class="small">💬 ${esc(q.alsoNote)}</div>` : ''}
        <div class="ot-right"><span>${esc(q.label)}:</span> <b lang="nb">${esc(q.answer)}</b>${q.answers.length > 1 ? ' <span class="small muted">(любой вариант верен)</span>' : ''} <button type="button" class="media-btn sm" data-say-r title="Прослушать" aria-label="Прослушать форму">${SPK(16)}</button></div>
        ${rowHtml(it)}
        <div class="ot-fb-act">${!r.ok ? '<button type="button" class="btn sm" data-mk>➕ в карточки</button>' : ''}<button type="button" class="btn primary" data-next>${S.i + 1 < S.items.length ? 'Дальше →' : 'Итоги'}</button></div>`;
      fb.dataset.say = spoken;
      const sc = ctx.body.querySelector('.ot-score'); if (sc) sc.outerHTML = scoreBar(S);
      say(spoken);
      focusNext(ctx);
    };
    ctx.body.onclick = async e => {
      const t = e.target.closest('button'); if (!t || t.disabled) return;
      if (t.dataset.otGo) { if (await askEnd(ctx)) ctx.go(t.dataset.otGo); return; }
      if (t.dataset.o != null) { answer(opts[+t.dataset.o], false, +t.dataset.o); return; }
      if (t.dataset.ch) { const i = ctx.body.querySelector('[data-in]'); if (i) { const a = i.selectionStart ?? i.value.length, b = i.selectionEnd ?? a; i.value = i.value.slice(0, a) + t.dataset.ch + i.value.slice(b); i.focus(); i.setSelectionRange(a + 1, a + 1); } return; }
      if (t.hasAttribute('data-dunno')) { answer('', true); return; }
      if (t.hasAttribute('data-say-h')) { say(S.items[S.i].form.head); return; }
      if (t.hasAttribute('data-say-r')) { const fb = ctx.body.querySelector('[data-fb]'); say(fb && fb.dataset.say); return; }
      if (t.hasAttribute('data-mk')) { addCards([S.results[S.results.length - 1]], ctx, t); return; }
      if (t.hasAttribute('data-next')) { S.i++; show(); }
    };
    ctx.onKey = e => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!answered && hints && /^[1-4]$/.test(e.key)) { e.preventDefault(); answer(opts[+e.key - 1], false, +e.key - 1); return; }
      if (answered && (e.key === 'Enter' || e.key === ' ') && !(e.target && e.target.closest && e.target.closest('button'))) { e.preventDefault(); S.i++; show(); }
    };
    show();
  }

  /* ================= «Как пользоваться» topic + its short tour ================= */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function tourHome() {
    const open = [...document.querySelectorAll('#modal-root > .modal-backdrop:not(.closing)')].reverse();
    for (const bd of open) { if (bd._m) { if (!(await bd._m.tryClose())) return false; } else bd.remove(); }
    await sleep(230);
    if (window.App) App.go('home');
    await sleep(350);
    return true;
  }
  async function tourHub() {
    const top = [...document.querySelectorAll('#modal-root > .modal-backdrop:not(.closing)')].pop();
    if (top && top.querySelector('.ot-modal .ot-hub')) return true;
    const open = [...document.querySelectorAll('#modal-root > .modal-backdrop:not(.closing)')].reverse();
    for (const bd of open) { if (bd._m) { if (!(await bd._m.tryClose())) return false; } else bd.remove(); }
    OrdTrainer.open('hub');
    await sleep(420);
    return true;
  }
  function registerHelp() {
    if (!window.Help || !Array.isArray(Help.TOPICS) || Help.TOPICS.some(t => t.id === 'ordtr')) return;
    Help.TOURS.ordtr = { steps: [
      { go: tourHome, target: ['#view [data-ordtr="hub"]', '#view [data-act="drills"]'], title: '🧩 Порядок слов и вопросы', text: 'Все тренажёры по грамматике — здесь (и в 🏋️ «Упражнения»).' },
      { go: tourHub, target: '.ot-modal [data-ot-go="wo"]', title: '🧱 Собери предложение', text: 'Нажимайте или перетаскивайте слова по порядку и нажмите «Проверить». Ошибка — короткое правило.' },
      { go: tourHub, target: '.ot-modal [data-ot-go="pos"]', title: '📊 Таблица позиций', text: 'Цветная таблица порядка слов: смотрите, как слова встают в столбцы, раскладывайте, собирайте и переделывайте предложения.' },
      { go: tourHub, target: '.ot-modal [data-ot-go="aa"]', title: 'å или нет?', text: 'Jeg kan ___ svømme? Нужен ли å перед инфинитивом.' },
      { go: tourHub, target: '.ot-modal [data-ot-go="qw"]', title: '❓ Вопросительные слова', text: 'По ответу «I Oslo» выберите слово: Hvor.' },
      { go: tourHub, target: '.ot-modal [data-ot-go="decks"]', title: '📚 Таблицы форм', text: 'Глаголы, существительные, прилагательные, местоимения: вся таблица, колода в один тап (или только выбранные слова) и «Впиши форму».' },
    ] };
    Help.TOPICS.push({ id: 'ordtr', icon: '🧩', hue: 160, title: 'Порядок слов, вопросы, модальные глаголы',
      desc: 'Собрать предложение, таблица позиций (как на листе Bnorsk), å или нет, вопросительные слова — и таблицы форм с готовыми колодами.',
      keys: 'напиши сам своё предложение письмо проверка порядок слов инверсия глагол второе место ikke придаточное вопрос вопросительные слова hvor hva hvem модальные глаголы kan vil skal må å инфинитив pleier грамматика тренажёр собери предложение таблица позиций ordstilling helsetning leddsetning setningsadverbial subjunksjon som derfor fordi sier at spør om bnorsk таблицы форм формы глаголов неправильные глаголы существительные прилагательные местоимения впиши форму kjenne vite',
      tour: 'ordtr', at: [0, 1, 2, 3, 4, 5],
      steps: [['🏠', 'На главной в «Учить» нажмите <b>«🧩 Порядок слов и вопросы»</b> (или 🏋️ «Упражнения»).'],
        ['🧱', '<b>«Собери предложение»</b>: нажимайте или перетаскивайте слова по порядку, потом «Проверить».'],
        ['📊', '<b>«Таблица позиций»</b>: 👀 Смотреть — слова сами встают в цветные столбцы; 🧩 Разложи — нажмите слово, потом столбец; 🧱 Собери; 🔄 Переделай (I går var han…, sier at / spør om, som, derfor ↔ fordi); ✍️ Напиши сам — своё предложение по заданию (начните с «Nå», с fordi, с som…), программа проверит порядок слов, а 🤖 нейросеть — подробно. Внизу — правила в цветных рамках.'],
        ['å', '<b>«å или нет?»</b> — нужен ли å перед инфинитивом: Jeg kan ___ svømme.'],
        ['❓', '<b>«Какое вопросительное слово?»</b> — по ответу выберите hvor, når, hvem…'],
        ['📚', '<b>«Таблицы форм»</b>: «📋 Вся таблица», «➕ Создать колоду» или «☑ Выбрать слова»; колода в работе подсвечена (карточек, выучено %); «✍️ Впиши форму» — проверка по таблице.']],
      expect: 'Ошибка — сразу короткое правило по-русски («глагол на 2-м месте», «в придаточном ikke перед глаголом») и таблица, где видно, в каком столбце стоит слово. Очки, серия 🔥, рекорд 🏆, повтор ошибок и «➕ в карточки». В колодах — все времена с местоимением, переводом и озвучкой.',
      limits: 'Предложения составлены вручную; таблица позиций — по схеме и примерам Bnorsk.no (с разрешения автора). Из ваших карточек берутся только простые предложения, которые точно подходят под правило. Иногда правильны оба порядка — тогда засчитываются оба. Озвучка — голос устройства или Google.',
      open: ['🧩 Открыть тренажёры', () => OrdTrainer.open('hub')] });
  }

  /* ================= entry points: any [data-ordtr="hub|wo|pos|aa|qw|decks"] ================= */
  if (typeof document !== 'undefined') {
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('[data-ordtr]'); if (!b) return;
      e.preventDefault();
      const v = b.dataset.ordtr in VIEWS ? b.dataset.ordtr : 'hub';
      if (b.hasAttribute('data-ordtr-close')) { const bd = b.closest('.modal-backdrop'); if (bd && bd._m) bd._m.close(); }
      OrdTrainer.open(v);
    });
    const boot = () => { try { registerHelp(); } catch (e) { console.warn('ordtrainer help', e); } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }

  const OrdTrainer = {
    /** view: 'hub' | 'wo' | 'pos' | 'posWatch' | 'aa' | 'qw' | 'decks' | 'pick' | 'tforms' */
    open(view = 'hub', opts) { return shell(VIEWS[view] ? view : 'hub', opts); },
    tilesHtml, installDeck, DECK_MISTAKES,
    // internals (used by the checks)
    _t: { sentence, itemText, accepted, validate, validateGap, validateQw, diagnose, fromCards, data, decksData, cardFields, deckState, hintText, MODAL, AA_VERB, GEN_RE,
      slotChunks, assemble, slotText, normB, whyKey, whyText, lineChunks, slotAlts, judgeLine, sortCheck, watchSteps, validateSlots, slotItems, trItems, tableHtml,
      formQuestion, checkForm, normF, formOptions, tables, tableStatus, installDeck,
      wPrepare, wCheck, wAnalyze, wRequire, writeItems, wAiParse,
      useData: (d, k) => { if (d) DATA = d; if (k) DECKS = k; } },
  };
  if (typeof window !== 'undefined') window.OrdTrainer = OrdTrainer;
  if (typeof module !== 'undefined' && module.exports) module.exports = OrdTrainer;
})();
