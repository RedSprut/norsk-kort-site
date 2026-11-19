/* ============ 📝 Prøve — тесты по главам (как бумажные тесты на курсе) ============
 *  - Prove.open()          the window with the list of tests («Мои тесты по курсу» — only on this Mac, «Тесты по уровню A2»)
 *  - Prove.openTest(id)    straight into one test (a half-finished one continues where it stopped)
 *  - anywhere: <button data-prove-open> (or data-prove-open="test-id") opens it; the sidebar item data-sb="prove" too.
 *  - data: data/prove-public.json (our own texts), data/prove-muntlig.json (own oral tasks; missing = skipped); personal files in private/ — prove-personal.json (the owner's course
 *    sheets), prove-workbook.json, or any list in private/prove-index.json {"files": [...]} — loaded ONLY on localhost /
 *    127.0.0.1, never published; a missing or broken file is silently ignored; a file's top-level «title» = its own group.
 *  - progress and results live on this device: localStorage 'nk-prove'.
 *  - item types: listen-short, true-false, choice, gap (text with [[answer|variant]] blanks), label-image (picture with
 *    numbered points, article + noun), order (chips → sentence), transform (rewrite a sentence), match, write, speak.
 *  - every gap / answer task has «Подсказки»: a word bank (tap a word, tap a gap — or drag it) instead of typing.
 *  - writing: the task in Norwegian («Перевести задание» = a hint), a grade 0–12 from 5 criteria + CEFR (A1/A2/A2+/B1):
 *    with an AI — its checked JSON (errors marked in the text); without — an honest approximate grade (gradeOffline).
 *  - speaking («speak», part «munt» — like the oral Norskprøve): the task in Norwegian (+ «Перевести задание»), a
 *    preparation timer and a speaking timer, the answer by voice (Speech: NB-Whisper on the device, or the browser's own
 *    recognition) — typing always works too; then a grade 0–12 (task, vocabulary, grammar, word order, fluency) + CEFR:
 *    the AI's JSON or gradeOffline(…, {speech: true}); a model answer to read and to listen to (TTS).
 *  - the pure checking rules are in Prove._core (tested in Node).
 */
(function (root) {
  'use strict';
  const doc = root.document;

  /* ======================================================================
   * 1. Pure core — no DOM
   * ====================================================================== */
  const arr = v => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  /** lowercase, no punctuation, single spaces: «Han er allergisk!» → «han er allergisk» */
  const norm = s => String(s == null ? '' : s).normalize('NFC').toLowerCase()
    .replace(/[’‘`´]/g, "'").replace(/[«»"“”„()[\]{}.,!?;:…–—\-/*]/g, ' ').replace(/\s+/g, ' ').trim();
  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  /** the same «random» order every time for the same seed (the page can be re-drawn without chips jumping around) */
  function seeded(list, seed) {
    const a = list.slice(); let x = hash(seed) || 1;
    for (let i = a.length - 1; i > 0; i--) { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; const j = x % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const ARTS = ['en', 'ei', 'et'];
  const artOf = v => ((String(v || '').match(/^\s*(en|ei|et)(?=\s|$)/i) || [])[1] || '').toLowerCase();
  const nounOf = v => String(v || '').replace(/^\s*(en|ei|et)(?=\s|$)\s*/i, '');
  const splitArt = v => { const m = norm(v).match(/^(en|ei|et)\s+(.+)$/); return m ? { art: m[1], noun: m[2] } : { art: '', noun: norm(v) }; };
  /** «Jeg [[synes at|synes]] det er fint.» → parts + blanks */
  function parseGap(text) {
    const parts = [], blanks = [];
    const re = /\[\[([^\]]+)\]\]/g; let last = 0, m;
    while ((m = re.exec(String(text || '')))) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      parts.push({ b: blanks.length });
      blanks.push(m[1].split('|').map(s => s.trim()).filter(Boolean));
      last = re.lastIndex;
    }
    if (last < String(text || '').length) parts.push(text.slice(last));
    return { parts, blanks };
  }
  /** words of a sentence → chips (no final punctuation, no commas); the first word in lower case unless it is a name */
  function chipsOf(sentence, names) {
    const keep = new Set(arr(names).map(String));
    return String(sentence || '').replace(/[.!?…]+\s*$/, '').replace(/,/g, ' ').split(/\s+/).filter(Boolean)
      .map((w, i) => (i === 0 && !keep.has(w) && w !== 'I' ? w.charAt(0).toLowerCase() + w.slice(1) : w));
  }
  /** chips → a sentence that looks right: capital letter, the ending of the model answer */
  function sentenceOf(words, model, noCap) {
    let s = words.join(' ').replace(/\s+([,.!?])/g, '$1').trim();
    if (!s) return '';
    if (!noCap) s = s.charAt(0).toUpperCase() + s.slice(1);
    const end = (String(model || '').trim().match(/[.!?]$/) || ['.'])[0];
    return /[.!?]$/.test(s) ? s : s + end;
  }
  /**
   * One answer field → { got: 1 | 0.5 | 0, note }.
   * blank = { ans: [variants], article?, lenient?, keys?: [[a, b], [c]] }
   */
  function checkBlank(blank, value) {
    const v = norm(value);
    const vars = arr(blank.ans).map(norm).filter(Boolean);
    if (!v) return { got: 0, note: 'empty' };
    if (vars.includes(v)) return { got: 1 };
    if (blank.article) {
      const u = splitArt(v);
      let best = { got: 0 };
      for (const x of vars) {
        const a = splitArt(x);
        if (u.noun === a.noun) {
          if (u.art === a.art) return { got: 1 };
          // the noun is right, the article is not (or missing): half a point — as on the paper test
          if (best.got < 0.5) best = { got: 0.5, note: u.art ? 'article' : 'no-article' };
        } else if (a.noun.length >= 4 && lev(u.noun, a.noun) === 1 && u.art === a.art && best.got < 0.5) best = { got: 0.5, note: 'spelling' };
      }
      // the article belongs to another variant (ei hånd / en hånd): fine
      return best;
    }
    if (blank.lenient) {
      const words = v.split(' ');
      for (const x of vars) {
        if ((' ' + v + ' ').includes(' ' + x + ' ')) return { got: 1 };
        const k = x.split(' ').length, tol = x.length >= 9 ? 2 : x.length >= 4 ? 1 : 0;
        if (tol) for (let i = 0; i + k <= words.length; i++) if (lev(words.slice(i, i + k).join(' '), x) <= tol) return { got: 1, note: 'typo' };
      }
      if (blank.keys && blank.keys.length) {
        const has = g => arr(g).map(norm).some(w => (w.includes(' ') ? (' ' + v + ' ').includes(' ' + w + ' ')
          : words.some(t => t === w || (w.length >= 5 && t.startsWith(w)) || (w.length >= 5 && lev(t, w) <= 1))));
        if (blank.keys.every(has)) return { got: 1 };
      }
    }
    return { got: 0 };
  }

  /** prepare one test from the JSON (ids, parsed gaps, blanks) — the same for public and personal tests */
  function prepTest(t, group) {
    t = Object.assign({}, t);
    t.group = group;
    t.sections = arr(t.sections).map((s0, si) => {
      const s = Object.assign({}, s0);
      s.id = s.id || 's' + (si + 1);
      s.items = arr(s.items).map((it0, ii) => prepItem(s, it0, ii));
      return s;
    });
    return t;
  }
  function prepItem(s, it0, ii) {
    const it = Object.assign({}, it0);
    it.id = String(it.id || ii + 1);
    it.type = it.type || s.type;
    const T = it.type;
    if (T === 'gap') {
      const p = parseGap(it.text);
      it.parts = p.parts;
      it.blanks = p.blanks.map((ans, k) => ({ ans, why: it.why ? it.why[String(k + 1)] || it.why[k + 1] : '' }));
    } else if (T === 'label-image') it.blanks = [{ ans: arr(it.answer), article: s.article !== false }];
    else if (T === 'listen-short') it.blanks = [{ ans: arr(it.answer), keys: it.keys, lenient: !it.strict }];
    else if (T === 'transform' || T === 'order') {
      // «Han sier at …»: the answer may be written with or without the given beginning
      let ans = arr(it.answer);
      if (it.prefix) {
        const pre = norm(it.prefix);
        ans = ans.concat(ans.filter(a => norm(a).startsWith(pre + ' ')).map(a => String(a).trim().slice(String(it.prefix).trim().length).trim()));
      }
      it.blanks = [{ ans, sentence: true }];
    }
    return it;
  }
  const HINTABLE = ['gap', 'label-image', 'listen-short', 'transform', 'order'];
  /** items graded on the 12-point scale (not counted in the test's percent) */
  const GRADED = ['write', 'speak'];
  const isGraded = it => GRADED.includes(it.type);
  const SELF_OK = ['listen-short', 'transform', 'order'];
  function itemMax(it) {
    if (it.type === 'gap') return it.blanks.length;
    if (it.type === 'match') return it.pairs.length;
    if (GRADED.includes(it.type)) return 0;
    return it.points || 1;
  }
  /** unit keys of an item: one per blank / pair, or the item itself */
  function unitKeys(sec, it) {
    const base = sec.id + '.' + it.id;
    if (it.type === 'gap') return it.blanks.map((_, k) => base + '.' + k);
    if (it.type === 'match') return it.pairs.map((_, k) => base + '.' + k);
    return [base];
  }
  /** score one item from the stored answers: { got, max, res: [{ got, note, self }] } */
  function scoreItem(sec, it, A, OK) {
    A = A || {}; OK = OK || {};
    const keys = unitKeys(sec, it), base = sec.id + '.' + it.id, pts = it.points || 1;
    const res = [];
    if (it.type === 'gap') it.blanks.forEach((b, k) => res.push(checkBlank(b, A[keys[k]])));
    else if (it.type === 'match') {
      const v = arr(A[base]);
      it.pairs.forEach((_, k) => res.push({ got: v[k] === k ? 1 : 0, note: v[k] == null ? 'empty' : '' }));
    } else if (it.type === 'true-false') res.push({ got: A[base] == null ? 0 : (A[base] === true) === !!it.answer ? pts : 0, note: A[base] == null ? 'empty' : '' });
    else if (it.type === 'choice') res.push({ got: A[base] == null ? 0 : +A[base] === +it.answer ? pts : 0, note: A[base] == null ? 'empty' : '' });
    else if (isGraded(it)) return { got: 0, max: 0, res: [] };
    else { const r = checkBlank(it.blanks[0], A[base]); res.push({ got: r.got * pts, note: r.note }); }
    keys.forEach((k, i) => { if (OK[k] && res[i] && res[i].got < (it.type === 'gap' || it.type === 'match' ? 1 : pts)) { res[i] = { got: it.type === 'gap' || it.type === 'match' ? 1 : pts, self: true }; } });
    return { got: res.reduce((n, r) => n + r.got, 0), max: itemMax(it), res };
  }
  function scoreSection(sec, A, OK, only) {
    let got = 0, max = 0;
    sec.items.forEach(it => { if (only && !only.has(sec.id + '.' + it.id)) return; const r = scoreItem(sec, it, A, OK); got += r.got; max += r.max; });
    return { got, max };
  }
  const PARTS = {
    lytt: { ru: 'Аудирование', no: 'Lytting', ico: '🎧' },
    gram: { ru: 'Грамматика и слова', no: 'Grammatikk', ico: '✏️' },
    skriv: { ru: 'Письмо', no: 'Skriving', ico: '📝' },
    munt: { ru: 'Устная речь', no: 'Muntlig', ico: '🗣' },
  };
  /** the whole test: per part { got, max } (+ the writing level) */
  function scoreTest(t, A, OK, only) {
    const parts = {};
    t.sections.forEach(sec => {
      const p = sec.part || 'gram';
      parts[p] = parts[p] || { got: 0, max: 0 };
      const r = scoreSection(sec, A, OK, only);
      parts[p].got += r.got; parts[p].max += r.max;
    });
    let got = 0, max = 0;
    Object.values(parts).forEach(p => { got += p.got; max += p.max; });
    return { parts, got, max, pct: max ? Math.round(got / max * 100) : 0 };
  }
  const pctOf = (g, m) => (m ? Math.round(g / m * 100) : 0);
  const fmtPts = n => String(Math.round(n * 2) / 2).replace('.', ',');

  /* ----------------------------------------------------------------------
   * Writing: a grade 0–12 from 5 criteria (as at the course: «Skrive»).
   * With an AI: the AI's JSON, checked and clamped (normAiGrade).
   * Without: gradeOffline() — honest, approximate rules that catch the typical A2 mistakes
   * of a Russian speaker (V2, word order in leddsetning, ikke, sin, articles, verb forms).
   * ---------------------------------------------------------------------- */
  const CRIT = [
    { id: 'task', max: 3, ru: 'Задание выполнено, по теме' },
    { id: 'vocab', max: 2, ru: 'Словарный запас' },
    { id: 'syntax', max: 3, ru: 'Построение предложений и порядок слов' },
    { id: 'grammar', max: 2, ru: 'Грамматика' },
    { id: 'coherence', max: 2, ru: 'Связность текста' },
  ];
  const GRADE_MAX = 12;
  /** the oral answer: the same 12 points, the criteria of a spoken test */
  const SPEAK_CRIT = [
    { id: 'task', max: 3, ru: 'Задание выполнено, по теме' },
    { id: 'vocab', max: 2, ru: 'Словарный запас' },
    { id: 'grammar', max: 2, ru: 'Грамматика' },
    { id: 'order', max: 3, ru: 'Порядок слов' },
    { id: 'fluency', max: 2, ru: 'Беглость и связность' },
  ];
  const critsOf = g => (g && g.mode === 'speak' ? SPEAK_CRIT : CRIT);
  const CEFRS = ['A1', 'A2', 'A2+', 'B1'];
  const ERR_KINDS = ['order', 'grammar', 'vocab', 'spelling', 'mech'];
  const W = s => new Set(s.split(/\s+/).filter(Boolean));
  const PRON = W('jeg du han hun vi dere de det man');
  const SA = W('ikke aldri alltid ofte også gjerne bare sjelden vanligvis kanskje egentlig fortsatt fremdeles heller');
  const SA_STRICT = W('ikke aldri alltid ofte også gjerne bare sjelden');
  // one word that may stand first in a sentence instead of the subject (then: verb, subject)
  const ADV1 = W('nå så etterpå deretter derfor kanskje heldigvis dessverre først senere ofte vanligvis alltid hjemme ute plutselig endelig ellers likevel dessuten tidligere snart noen hver neste forrige mandag tirsdag onsdag torsdag fredag lørdag søndag klokka kl hele');
  const PREP = W('i på om etter før med hos fra til under ved mot gjennom uten');
  const SUBJ_ANY = W('at som fordi hvis når da om mens siden før');
  const VIRR = W(`er var har hadde skal skulle vil ville kan kunne må måtte bør burde går gikk gjør gjorde kom kommer ser sa sier får fikk tar tok blir ble står sto
    drar dro vet visste liker bor bodde heter het spiser spiste ligger lå sitter satt sover sov trives trenger tror ber dør spør slår ler synes syntes`);
  const NOTVERB = W('der her eller over etter under mer sommer vinter søster datter lærer moster faster sammen hytte første siste andre dette neste beste eneste største fineste viktigste mitt ditt sitt litt mange');
  const FUNC_ER = W('der her eller over etter under mer');
  const VINF = { går: 'gå', er: 'være', har: 'ha', gjør: 'gjøre', sier: 'si', ser: 'se', drar: 'dra', tar: 'ta', får: 'få', står: 'stå', bor: 'bo', tror: 'tro', ber: 'be', spør: 'spørre', dør: 'dø', slår: 'slå', ler: 'le', vet: 'vite' };
  const MODAL = W('kan vil skal må bør kunne ville skulle måtte burde');
  const LIKE = W('liker elsker pleier prøver begynner slutter husker glemmer hater orker');
  const INF = W('spise lese se gå reise jobbe trene svømme lage danse synge sove snakke høre spille sykle løpe handle studere skrive tegne bake kjøre bo ta gjøre være ha møte besøke lære drikke jogge fiske gå sitte stå bade');
  const SIN = W('sin si sitt sine');
  // very common nouns: m = en, n = et, f = ei / en
  const GENDER = {};
  'dag bil venn by mann gutt kopp film butikk jobb skole familie tur buss time kveld morgen sønn bror far fisk hund katt stol telefon leilighet ferie måned fest vei sjokolade lærer kollega nabo hage park sykkel fotball kafé restaurant'.split(' ').forEach(w => { GENDER[w] = 'm'; });
  'hus år barn land språk eple bord vær rom kurs tog fjell brød liv glass bilde problem sted møte ord navn menneske kjøkken vindu hotell museum fly egg spill program måltid treningssenter arbeid sentrum'.split(' ').forEach(w => { GENDER[w] = 'n'; });
  'jente kone mor datter søster bok hytte uke avis dør klokke seng natt helg tante venninne jakke lue kake hånd'.split(' ').forEach(w => { GENDER[w] = 'f'; });
  const DEF = {}; // definite form → { noun, g }
  Object.keys(GENDER).forEach(n => {
    const g = GENDER[n], e = /e$/.test(n);
    if (g === 'm' || g === 'f') DEF[e ? n + 'n' : n + 'en'] = { noun: n, g };
    if (g === 'n') DEF[e ? n + 't' : n + 'et'] = { noun: n, g };
    if (g === 'f') DEF[e ? n.slice(0, -1) + 'a' : n + 'a'] = { noun: n, g };
  });
  const ADJ_T = { stor: 'stort', liten: 'lite', ny: 'nytt', god: 'godt', gammel: 'gammelt', kald: 'kaldt', varm: 'varmt', fin: 'fint', pen: 'pent', dyr: 'dyrt', lang: 'langt', rød: 'rødt', hvit: 'hvitt', grønn: 'grønt', blå: 'blått', ung: 'ungt', høy: 'høyt', rik: 'rikt', billig: 'billig', flink: 'flinkt', snill: 'snilt', hyggelig: 'hyggelig', koselig: 'koselig' };
  const ADJ_T_REV = {}; Object.keys(ADJ_T).forEach(a => { if (ADJ_T[a] !== a) ADJ_T_REV[ADJ_T[a]] = a; });
  const PLACES = W('norge oslo bergen trondheim stavanger tromsø russland ukraina sverige danmark europa');
  const LOWER_NAMES = W('mandag tirsdag onsdag torsdag fredag lørdag søndag januar februar mars april mai juni juli august september oktober november desember jul påske nyttår');
  const CONNECT = W('men fordi derfor så først etterpå deretter når da også dessuten likevel ellers hvis mens siden endelig senere');
  const CONNECT2 = ['for eksempel', 'i tillegg', 'til slutt', 'selv om', 'etter at', 'på grunn av'];
  const STOP = W('jeg du han hun vi dere de det den man meg deg seg oss dem og men eller som at er var har hadde skal vil kan må ikke en ei et i på om til fra med av for så da når hva hvem hvor hvordan hvorfor min mitt mine din ditt dine sin sitt sine hans hennes deres vår vårt våre også veldig mye litt bare dette denne disse noe noen alle mange');

  const LETTER = /[A-Za-zÆØÅæøåÀ-ÿ]/;
  const ABBR = W('kl f eks bl a ca nr dvs osv mvh ev');
  /** tokens with their place in the text: { t: original, w: lowercase, s: start, e: end, p: punctuation? } */
  function tokenize(text) {
    const out = [], re = /[A-Za-zÆØÅæøåÀ-ÿЀ-ӿ0-9]+(?:[-'][A-Za-zÆØÅæøåÀ-ÿЀ-ӿ0-9]+)*|[.!?…]+|[,;:]|\n/g;
    let m;
    while ((m = re.exec(String(text || '')))) {
      const t = m[0];
      out.push({ t, w: t.toLowerCase(), s: m.index, e: m.index + t.length, p: !/[A-Za-zÆØÅæøåÀ-ÿЀ-ӿ0-9]/.test(t) });
    }
    return out;
  }
  /** sentences: arrays of word tokens (commas kept as tokens with p:true, w:',') + the end mark */
  function sentencesOf(toks) {
    const out = []; let cur = [];
    const push = end => { if (cur.some(x => !x.p)) out.push({ toks: cur, end }); cur = []; };
    toks.forEach((x, i) => {
      const prev = toks[i - 1];
      // «17. mai», «kl. 8», «f.eks.» do not end a sentence
      if (x.t === '.' && prev && !prev.p && (/^\d+$/.test(prev.t) || ABBR.has(prev.w)) && toks[i + 1] && toks[i + 1].s === x.e + 1 && /^[a-zæøå0-9]/.test(toks[i + 1].t)) return;
      if (x.p && /[.!?…]/.test(x.t)) push(x.t);
      else if (x.t === '\n') push('');
      else cur.push(x);
    });
    push('');
    return out;
  }
  const isVerb = w => VIRR.has(w) || (/^[a-zæøå]{3,}(er|te|et|de|dde|tte)$/.test(w) && !NOTVERB.has(w));
  const presentInf = w => (VINF[w] ? VINF[w] : /^[a-zæøå]{2,}er$/.test(w) && !FUNC_ER.has(w) ? w.slice(0, -1) : null);
  const capFirst = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
  const words0 = text => (String(text || '').match(/[A-Za-zÆØÅæøåÀ-ÿ]+/g) || []);
  /** «a word or a phrase is in the text»: phrases as they are, single words also by their beginning (familie → familien) */
  function hasKey(nt, ws, k) {
    k = norm(k); if (!k) return false;
    if (k.includes(' ')) return (' ' + nt + ' ').includes(' ' + k + ' ');
    return ws.some(w => w === k || (k.length >= 4 && w.startsWith(k)));
  }

  /** the rules — every hit: { s, e, frag, fix, why, kind } (s/e: place in the text) */
  function findErrors(text) {
    const toks = tokenize(text), sents = sentencesOf(toks), errs = [];
    const stats = { sentences: sents.length, ledd: 0, inversions: 0, longest: 0 };
    const add = (a, b, fix, why, kind) => {
      if (!a || !b) return;
      const s = a.s, e = b.e;
      if (errs.some(x => s < x.e && e > x.s)) return; // one place — one remark
      errs.push({ s, e, frag: text.slice(s, e), fix, why, kind });
    };
    const WHY = {
      v2: 'Глагол — на 2-м месте. Если предложение начинается не с подлежащего (I dag, I Norge, Om sommeren…), сначала идёт глагол, потом подлежащее: «I dag går jeg…».',
      lead: 'Если предложение начинается с придаточного (Når…, Hvis…, Da…), после него запятая и сразу глагол, потом подлежащее: «Når jeg kommer hjem, spiser jeg».',
      leddInv: 'В придаточном (at, fordi, som, når, hvis, om) порядок прямой: сначала подлежащее, потом глагол — «fordi hun er syk».',
      leddSa: 'В придаточном ikke (aldri, alltid, også…) стоит перед глаголом: «…at jeg ikke liker», «…som ikke trener».',
      mainSa: 'В главном предложении ikke (aldri, alltid, også…) стоит после глагола: «Jeg liker ikke…».',
      sin: 'sin / si / sitt / sine не бывает в подлежащем. Скажите «hans …» или «hennes …» (kona hans, mora hennes).',
      artN: w => `«${w}» — слово среднего рода: et ${w}.`,
      artM: w => `«${w}» — слово мужского рода: en ${w}.`,
      artF: w => `«${w}» — en- или ei-слово: en ${w} / ei ${w}.`,
      artDef: 'Артикль en / ei / et не ставят перед определённой формой: или «en bil», или «bilen».',
      adjT: 'С et-словами прилагательное получает -t: et stort hus, et fint rom.',
      adjNoT: 'С en- и ei-словами прилагательное без -t: en stor bil, ei fin bok.',
      aaInf: 'После å — инфинитив (без -r): å gå, å spise, å være.',
      modal: 'После kan, vil, skal, må, bør — инфинитив без -r и без å: kan komme, vil spise.',
      likeAa: 'После liker (elsker, pleier, begynner, prøver) нужно å + инфинитив: liker å spise.',
      cap: 'Предложение начинается с большой буквы.',
      stop: 'В конце предложения нужна точка (или ! / ?).',
      place: 'Названия стран и городов пишутся с большой буквы: Norge, Oslo.',
      lowerName: 'Дни недели, месяцы и праздники по-норвежски пишутся с маленькой буквы: på mandag, i mai, til jul.',
      dbl: 'Одно и то же слово два раза подряд.',
      cyr: 'Здесь русские буквы — напишите это слово по-норвежски.',
    };
    // a front: «I dag», «Om sommeren», «På lørdag», «Etterpå» … — the tokens before the subject
    const frontOk = (ts, a, b) => {
      const n = b - a; if (n < 1 || n > 4) return false;
      const f = ts.slice(a, b);
      if (f.some(x => x.p)) return false;
      const w0 = f[0].w;
      if (f.some((x, i) => (i > 0 || !ADV1.has(x.w)) && x.w !== 'så' && isVerb(x.w))) return false;
      if (f.some((x, i) => i > 0 && SUBJ_ANY.has(x.w))) return false;
      if (PRON.has(w0) || w0 === 'da' || w0 === 'når' || w0 === 'der') return false;
      if (ADV1.has(w0)) return n <= 3;
      if (PREP.has(w0)) return n >= 2; // «før jeg …», «om jeg …» are subordinate clauses
      return false;
    };
    sents.forEach(S0 => {
      const all = S0.toks, ts = all.filter(x => x.t !== ','), q = S0.end === '?';
      const wc = ts.filter(x => LETTER.test(x.t)).length;
      stats.longest = Math.max(stats.longest, wc);
      if (!ts.length) return;
      // capital letter at the start
      if (/^[a-zæøå]/.test(ts[0].t)) add(ts[0], ts[0], capFirst(ts[0].t), WHY.cap, 'mech');
      // counting leddsetninger and good inversions
      ts.forEach((x, i) => { if (['at', 'som', 'fordi', 'hvis', 'mens', 'siden'].includes(x.w) || (['når', 'da', 'om', 'før'].includes(x.w) && ts[i + 1] && PRON.has(ts[i + 1].w))) stats.ledd++; });
      // clause starts: the sentence start and after og / men / eller
      const starts = [0];
      ts.forEach((x, i) => { if (i > 0 && ['og', 'men', 'eller'].includes(x.w)) starts.push(i + 1); });
      starts.forEach(st0 => {
        // main clause: «Jeg ikke liker» → «Jeg liker ikke» (not inside a subordinate clause)
        const s0 = ts[st0], s1 = ts[st0 + 1], s2 = ts[st0 + 2];
        if (s0 && s1 && s2 && PRON.has(s0.w) && SA_STRICT.has(s1.w) && isVerb(s2.w) && !ts.slice(0, st0).some(y => SUBJ_ANY.has(y.w))) add(s1, s2, `${s2.t} ${s1.t}`, WHY.mainSa, 'order');
        // V2: «I dag jeg går» → «I dag går jeg»
        for (let p = st0 + 1; p <= st0 + 4 && p < ts.length; p++) {
          if (!PRON.has(ts[p].w)) { if (isVerb(ts[p].w) && ts[p].w !== 'så') { if (frontOk(ts, st0, p) && ts[p + 1] && PRON.has(ts[p + 1].w)) stats.inversions++; break; } continue; }
          if (!frontOk(ts, st0, p)) break;
          const nx = ts[p + 1]; if (!nx) break;
          if (q && st0 === 0) break;
          if (SA.has(nx.w) && ts[p + 2] && isVerb(ts[p + 2].w)) add(ts[p], ts[p + 2], `${ts[p + 2].t} ${ts[p].w === 'jeg' ? 'jeg' : ts[p].t.toLowerCase()} ${nx.t}`, WHY.v2, 'order');
          else if (isVerb(nx.w)) add(ts[p], nx, `${nx.t} ${ts[p].t.toLowerCase()}`, WHY.v2, 'order');
          break;
        }
      });
      // a subordinate clause first, then the main clause: «Når jeg kommer hjem, jeg spiser» → «…, spiser jeg»
      const w0 = ts[0].w, w1 = ts[1] && ts[1].w;
      const lead = ['når', 'hvis', 'fordi', 'mens', 'siden'].includes(w0) || (['da', 'om', 'før'].includes(w0) && PRON.has(w1)) || (w0 === 'selv' && w1 === 'om') || (w0 === 'etter' && w1 === 'at');
      if (lead && !q) {
        const ci = all.findIndex(x => x.t === ',');
        if (ci > 0) {
          const a = all[ci + 1], b = all[ci + 2];
          if (a && b && PRON.has(a.w) && (isVerb(b.w) || SA.has(b.w))) add(a, b, `${b.t} ${a.t}`, WHY.lead, 'order');
        } else {
          // no comma: find the verb of the first clause, then a second «subject + verb»
          let j = ts.findIndex((x, i) => i >= 2 && isVerb(x.w));
          if (j > 0) for (let k = j + 1; k < Math.min(ts.length - 1, j + 6); k++) {
            if (['og', 'men', 'eller', 'at', 'som', 'fordi', 'hvis', 'når', 'om'].includes(ts[k].w)) break;
            if (PRON.has(ts[k].w) && isVerb(ts[k + 1].w)) { add(ts[k], ts[k + 1], `, ${ts[k + 1].t} ${ts[k].t}`, WHY.lead, 'order'); break; }
          }
        }
      }
      ts.forEach((x, i) => {
        const a = ts[i + 1], b = ts[i + 2], c = ts[i + 3];
        // leddsetning with the main-clause order: «fordi er hun syk»
        const subjInv = ['at', 'som', 'fordi', 'hvis', 'når', 'om', 'mens', 'siden'].includes(x.w) && !(i === 0 && ['om', 'som', 'at'].includes(x.w)) && !(i === 0 && x.w === 'når' && q);
        if (subjInv && a && b && isVerb(a.w) && PRON.has(b.w) && !(x.w === 'som' && (b.w === 'det' || b.w === 'den'))) add(a, b, `${b.t} ${a.t}`, WHY.leddInv, 'order');
        // leddsetning: ikke before the verb — «at jeg liker ikke» → «at jeg ikke liker»
        if (SUBJ_ANY.has(x.w) && x.w !== 'før' && a && b && c && (PRON.has(a.w) || (/^[A-ZÆØÅ]/.test(a.t) && !STOP.has(a.w))) && isVerb(b.w) && SA_STRICT.has(c.w)) add(b, c, `${c.t} ${b.t}`, WHY.leddSa, 'order');
        if (x.w === 'som' && a && b && isVerb(a.w) && SA_STRICT.has(b.w)) add(a, b, `${b.t} ${a.t}`, WHY.leddSa, 'order');
        // sin in the subject
        if (SIN.has(x.w) && a && LETTER.test(a.t) && !(x.w === 'si' && i === 0)) {
          const subjPos = i === 0 || (ts[i - 1] && ['at', 'fordi', 'hvis', 'når', 'som', 'da', 'om', 'mens'].includes(ts[i - 1].w));
          const coord = ts[i - 1] && ts[i - 1].w === 'og' && !ts.slice(0, i - 1).some(y => isVerb(y.w)) && b && isVerb(b.w);
          if (subjPos || coord) add(x, a, `hans ${a.w} / hennes ${a.w}`, WHY.sin, 'grammar');
        }
        // articles
        if (['en', 'ei', 'et'].includes(x.w) && a) {
          let nIdx = i + 1, adj = null;
          if ((ADJ_T[a.w] || ADJ_T_REV[a.w]) && b && LETTER.test(b.t)) { adj = a; nIdx = i + 2; }
          const nn = ts[nIdx], g = nn && GENDER[nn.w], d = nn && !adj && DEF[nn.w];
          if (d) add(x, nn, `${x.w === 'et' ? 'et' : x.t} ${d.noun} / ${nn.t}`, WHY.artDef, 'grammar');
          else if (g === 'n' && x.w !== 'et') add(x, nn, `et ${adj ? (ADJ_T[adj.w] || adj.w) + ' ' : ''}${nn.t}`, WHY.artN(nn.w), 'grammar');
          else if (g === 'm' && x.w !== 'en') add(x, nn, `en ${adj ? (ADJ_T_REV[adj.w] || adj.w) + ' ' : ''}${nn.t}`, WHY.artM(nn.w), 'grammar');
          else if (g === 'f' && x.w === 'et') add(x, nn, `en ${nn.t} / ei ${nn.t}`, WHY.artF(nn.w), 'grammar');
          else if (adj && x.w === 'et' && ADJ_T[adj.w] && ADJ_T[adj.w] !== adj.w) add(adj, adj, ADJ_T[adj.w], WHY.adjT, 'grammar');
          else if (adj && x.w !== 'et' && ADJ_T_REV[adj.w]) add(adj, adj, ADJ_T_REV[adj.w], WHY.adjNoT, 'grammar');
        }
        // verb forms: å + present, modal + present, liker + infinitive without å
        if (x.w === 'å' && a) { const inf = presentInf(a.w); if (inf && inf !== a.w) add(a, a, inf, WHY.aaInf, 'grammar'); }
        if (MODAL.has(x.w)) {
          let k = i + 1;
          if (ts[k] && PRON.has(ts[k].w) && ts[k].w !== 'det') k++;
          while (ts[k] && SA.has(ts[k].w)) k++;
          const v = ts[k]; const inf = v && presentInf(v.w);
          if (v && inf && inf !== v.w) add(v, v, inf, WHY.modal, 'grammar');
        }
        if (LIKE.has(x.w) && a) {
          let k = i + 1; if (ts[k] && ['ikke', 'også', 'veldig', 'godt', 'mest', 'best'].includes(ts[k].w)) k++;
          const v = ts[k]; if (v && INF.has(v.w) && !(ts[k - 1] && ts[k - 1].w === 'å')) add(v, v, 'å ' + v.t, WHY.likeAa, 'grammar');
        }
        // spelling / mechanics
        if (PLACES.has(x.w) && /^[a-zæøå]/.test(x.t)) add(x, x, capFirst(x.t), WHY.place, 'mech');
        if (i > 0 && LOWER_NAMES.has(x.w) && /^[A-ZÆØÅ]/.test(x.t)) add(x, x, x.w, WHY.lowerName, 'mech');
        if (a && a.w === x.w && LETTER.test(x.t) && !['veldig', 'mye', 'mer'].includes(x.w)) add(x, a, x.t, WHY.dbl, 'vocab');
        if (/[Ѐ-ӿ]/.test(x.t)) add(x, x, '…', WHY.cyr, 'vocab');
      });
    });
    // the last sentence without a full stop
    const trimmed = String(text || '').replace(/\s+$/, '');
    const lastWord = [...toks].reverse().find(x => !x.p);
    const lastLine = trimmed.split('\n').pop() || '';
    const lastSent = sents.length ? sents[sents.length - 1].toks.filter(x => !x.p) : [];
    const signature = (/\n/.test(trimmed) && words0(lastLine).length <= 3) // «Hilsen Olga» needs no full stop
      || (lastSent[0] && ['hilsen', 'klem', 'mvh', 'vennlig', 'beste'].includes(lastSent[0].w) && lastSent.length <= 4);
    if (lastWord && trimmed && !signature && /[A-Za-zÆØÅæøåÀ-ÿ0-9]$/.test(trimmed) && lastWord.e === trimmed.length) add(lastWord, lastWord, lastWord.t + '.', WHY.stop, 'mech');
    errs.sort((a, b) => a.s - b.s);
    return { errs, stats, toks, sents };
  }

  function cefrOf(total, st) {
    if (!st || st.words < 20 || total <= 4) return 'A1';
    if (total <= 7) return 'A2';
    if (total <= 9) return 'A2+';
    return st.ledd >= 2 && st.words >= 60 && st.sentences >= 5 ? 'B1' : 'A2+';
  }
  const TEACHER_SPEAK = t => (t >= 10 ? 'Så flott! Du snakker godt og sammenhengende!' : t >= 7 ? 'Bra! Jeg forstår deg godt. Se på de små feilene.'
    : t >= 4 ? 'Fint at du prøver! Øv litt til, så blir det enda bedre.' : 'Godt forsøk! Prøv å si litt mer neste gang — du klarer det!');
  const TEACHER = t => (t >= 10 ? 'Kjempefin tekst! Du er flink til å fortelle!' : t >= 7 ? 'Bra! Det er litt småfeil, men jeg forstår hva du skriver. Se det jeg har rettet.'
    : t >= 4 ? 'Fint at du skriver! Se på feilene og prøv en gang til.' : 'Godt forsøk! Skriv litt mer neste gang — du klarer det!');

  /** the approximate grade without an AI (opts.speech: a spoken answer — no marks for capital letters and full stops,
   *  recognised speech often has no punctuation at all; the criteria of the oral test) */
  function gradeOffline(text, item, opts) {
    item = item || {}; opts = opts || {};
    const sp = !!opts.speech;
    text = String(text || '');
    const ws = words0(text).map(w => w.toLowerCase());
    const words = ws.length, minW = +item.minWords || (sp ? 35 : 40);
    const found = findErrors(text), stats = found.stats;
    const errs = sp ? found.errs.filter(e => e.kind !== 'mech') : found.errs;
    // recognised speech without punctuation: one endless «sentence» — do not punish that
    const unpunct = sp && (text.match(/[.!?…]/g) || []).length < Math.max(1, words / 30);
    stats.words = words;
    const nt = norm(text);
    // the topic: groups of words that must be there (need), key words, or the content words of the task itself
    const need = arr(item.need).map(arr).filter(g => g.length);
    const keys = arr(item.keywords).length ? arr(item.keywords)
      : norm(item.prompt || '').split(' ').filter(w => w.length >= 5 && !STOP.has(w) && !['skriv', 'tekst', 'fortell', 'hvordan', 'hvorfor'].includes(w));
    let topicOk, topicTxt;
    if (need.length) {
      const got = need.filter(g => g.some(k => hasKey(nt, ws, k))).length;
      topicOk = got >= Math.ceil(need.length * 2 / 3);
      topicTxt = `${got} из ${need.length} пунктов задания`;
    } else {
      const hits = new Set(keys.filter(k => hasKey(nt, ws, k)).map(norm)).size;
      topicOk = hits >= (keys.length <= 2 ? 1 : 2);
      topicTxt = topicOk ? 'по теме' : 'тема почти не видна';
    }
    const ratio = words / minW;
    let task = (ratio >= 1 ? 2 : ratio >= 0.6 ? 1 : 0) + (topicOk ? 1 : 0);
    if (!topicOk) task = Math.min(task, 1);
    // vocabulary
    const distinct = new Set(ws);
    const content = new Set(ws.filter(w => w.length >= 4 && !STOP.has(w)));
    const ttr = words ? distinct.size / words : 0;
    let vocab = content.size >= 18 ? 2 : content.size >= 9 ? 1 : 0;
    if (words >= 30 && ttr < 0.38) vocab = Math.max(0, vocab - 1);
    const n = k => errs.filter(e => e.kind === k).length;
    if (n('vocab')) vocab = Math.max(0, vocab - 1);
    // sentences and word order
    const scale = 60 / Math.max(words, 60);
    const eo = n('order') * scale;
    let syntax = eo === 0 ? 3 : eo <= 1 ? 2 : eo <= 2.5 ? 1 : 0;
    if (stats.sentences < 3 && !unpunct) syntax = Math.min(syntax, 2);
    if (!stats.ledd && !stats.inversions) syntax = Math.min(syntax, 2);
    // grammar (spelling / capital letters count half)
    const eg = (n('grammar') + 0.5 * n('mech') + 0.5 * n('spelling')) * scale;
    let grammar = eg < 0.75 ? 2 : eg <= 2.5 ? 1 : 0;
    // coherence
    let conn = 0; const used = new Set();
    ws.forEach(w => { if (CONNECT.has(w)) used.add(w); });
    CONNECT2.forEach(c => { if ((' ' + nt + ' ').includes(' ' + c + ' ')) used.add(c); });
    conn = used.size;
    let coherence = conn >= 3 || (conn >= 2 && stats.sentences >= 4) ? 2 : conn >= 1 || ws.includes('og') ? 1 : 0;
    if (stats.sentences < 3 && !unpunct) coherence = Math.min(coherence, 1);
    if (stats.longest > 35 && !unpunct) coherence = Math.max(0, coherence - 1);
    // very short texts cannot show much
    if (words < 20) { vocab = Math.min(vocab, 1); coherence = Math.min(coherence, 1); syntax = Math.min(syntax, 1); grammar = Math.min(grammar, 1); }
    if (words < 8) { task = 0; vocab = 0; syntax = 0; grammar = 0; coherence = 0; }
    const crit = sp ? { task, vocab, grammar, order: syntax, fluency: coherence } : { task, vocab, syntax, grammar, coherence };
    const total = (sp ? SPEAK_CRIT : CRIT).reduce((s, c) => s + crit[c.id], 0);
    stats.connectors = conn; stats.content = content.size;
    const notes = {
      task: `${words} ${plural(words, ['слово', 'слова', 'слов'])} (${sp ? 'хорошо бы' : 'нужно'} от ${minW}), ${topicTxt}`,
      vocab: `${content.size} разных содержательных слов`,
      syntax: `${n('order') ? 'ошибок порядка слов: ' + n('order') : 'ошибок порядка слов не найдено'}${stats.ledd ? ', есть придаточные' : ', нет придаточных'}`,
      grammar: n('grammar') + n('mech') ? `замечаний: ${n('grammar') + n('mech')}` : 'явных ошибок не найдено',
      coherence: conn ? `слов-связок: ${conn}` : 'нет слов-связок (men, fordi, derfor, først…)',
    };
    if (sp) { notes.order = notes.syntax; notes.fluency = notes.coherence; }
    const good = [];
    if (ratio >= 1) good.push(sp ? 'Ответ достаточно длинный — вы говорите, а не отвечаете одним словом.' : 'Текст нужной длины.');
    if (stats.ledd) good.push('Есть придаточные предложения (at, fordi, når, som…).');
    if (stats.inversions) good.push('Есть правильная инверсия: «I dag går jeg…».');
    if (conn >= 2) good.push(sp ? 'Есть слова-связки — ответ звучит связно.' : 'Есть слова-связки — текст читается связно.');
    if (!n('order') && (stats.sentences >= 3 || unpunct) && words >= 20) good.push('Явных ошибок порядка слов не видно.');
    // the weakest criterion → one piece of advice
    const ADV = {
      task: 'Напишите подробнее и ответьте на все вопросы задания.',
      vocab: 'Попробуйте использовать больше разных слов: прилагательные, глаголы, слова по теме.',
      syntax: 'Главное сейчас — порядок слов: глагол на 2-м месте, в придаточном — подлежащее, ikke, глагол.',
      grammar: 'Проверьте артикли, формы глаголов и прилагательных.',
      coherence: 'Свяжите предложения: og, men, fordi, derfor, først, etterpå, til slutt.',
    };
    if (sp) Object.assign(ADV, {
      task: 'Говорите подробнее: ответьте на все вопросы задания и добавьте пример из своей жизни.',
      order: ADV.syntax,
      fluency: 'Связывайте фразы: og, men, fordi, derfor, først, etterpå, til slutt — и не бойтесь говорить дольше.',
    });
    const CR = sp ? SPEAK_CRIT : CRIT;
    const weakest = CR.slice().sort((a, b) => crit[a.id] / a.max - crit[b.id] / b.max)[0];
    const summary = words < 8 ? (sp ? 'Ответ слишком короткий для оценки — скажите (или напишите) хотя бы несколько предложений.' : 'Текст слишком короткий для оценки — напишите хотя бы несколько предложений.')
      : `Примерно ${total} из ${GRADE_MAX}. ${total >= 10 ? (sp ? 'Очень хороший ответ!' : 'Очень хороший текст!') : total >= 7 ? (sp ? 'Хороший ответ, есть небольшие ошибки.' : 'Хороший текст, есть небольшие ошибки.') : 'Есть над чем поработать.'} ${crit[weakest.id] < weakest.max ? ADV[weakest.id] : ''}`.trim();
    return {
      by: 'auto', mode: sp ? 'speak' : 'write', total, crit, notes, cefr: cefrOf(total, unpunct ? Object.assign({}, stats, { sentences: Math.max(stats.sentences, Math.round(words / 9)) }) : stats),
      errors: errs.map(e => ({ s: e.s, e: e.e, frag: e.frag, fix: e.fix, why: e.why, kind: e.kind })),
      teacher: sp ? TEACHER_SPEAK(total) : TEACHER(total), summary, good, stats: { words, sentences: stats.sentences, ledd: stats.ledd, inversions: stats.inversions, connectors: conn },
      text, at: Date.now(),
    };
  }

  /** where a fragment the AI quoted stands in the text (exactly / any case / any spaces and punctuation) */
  function findFrag(text, frag, taken) {
    text = String(text || ''); frag = String(frag || '').trim();
    if (!frag) return null;
    const free = (s, e) => !arr(taken).some(x => s < x.e && e > x.s);
    const scan = (hay, needle) => { let i = hay.indexOf(needle); while (i >= 0) { if (free(i, i + needle.length)) return { s: i, e: i + needle.length }; i = hay.indexOf(needle, i + 1); } return null; };
    let r = scan(text, frag) || scan(text.toLowerCase(), frag.toLowerCase());
    if (r) return r;
    const parts = frag.split(/[\s.,!?;:«»"“”()…–—-]+/).filter(Boolean).map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!parts.length || parts.length > 30) return null;
    try {
      const re = new RegExp(parts.join('[\\s.,!?;:«»"“”()…–—-]+'), 'gi'); let m;
      while ((m = re.exec(text))) { if (free(m.index, m.index + m[0].length)) return { s: m.index, e: m.index + m[0].length }; if (!m[0].length) re.lastIndex++; }
    } catch (e) { /* a strange fragment */ }
    return null;
  }
  const str = (x, n) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, n) : typeof x === 'number' ? String(x) : '');
  function normCefr(v) {
    const s = String(v || '').toUpperCase().replace(/\s+/g, '');
    if (/^A2\+|^A2PLUS/.test(s)) return 'A2+';
    const m = s.match(/A1|A2|B1|B2|C1|C2/); if (!m) return '';
    return m[0] === 'B2' || m[0][0] === 'C' ? 'B1' : m[0];
  }
  /** JSON from a chatty answer: ```json fences, text around the object */
  function parseLoose(raw) {
    const t = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try { return JSON.parse(t); } catch (e) { /* continue */ }
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* not JSON */ } }
    return null;
  }
  /** the AI's answer → a grade, or null when it is not usable (then the offline grade is shown) */
  function normAiGrade(j, text, mode) {
    if (!j || typeof j !== 'object' || Array.isArray(j)) return null;
    const CR = mode === 'speak' ? SPEAK_CRIT : CRIT;
    let sc = j.scores || j.score || j.criteria;
    if (!sc || typeof sc !== 'object') return null;
    // a spoken answer graded with the writing names: syntax = word order, coherence = fluency
    if (mode === 'speak') sc = Object.assign({ order: sc.syntax != null ? sc.syntax : sc.wordOrder, fluency: sc.coherence }, sc);
    const crit = {}; let have = 0, ratio = 0;
    CR.forEach(c => {
      let v = sc[c.id];
      if (v && typeof v === 'object') v = v.score != null ? v.score : v.points;
      v = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(',', '.').replace(/\/.*$/, '')) : NaN;
      if (Number.isFinite(v)) { crit[c.id] = Math.max(0, Math.min(c.max, Math.round(v))); have++; ratio += crit[c.id] / c.max; } else crit[c.id] = null;
    });
    if (have < 4) return null;
    CR.forEach(c => { if (crit[c.id] == null) crit[c.id] = Math.round(ratio / have * c.max); });
    const total = CR.reduce((s, c) => s + crit[c.id], 0);
    const ws = words0(text).length;
    const taken = [];
    const errors = arr(j.errors).filter(o => o && typeof o === 'object').map(o => ({
      frag: str(o.frag || o.original || o.wrong, 200), fix: str(o.fix || o.correction || o.right, 200),
      why: str(o.why || o.explanation || o.rule, 260), kind: ERR_KINDS.includes(o.kind) ? o.kind : 'grammar',
    })).filter(e => e.frag && e.fix && norm(e.frag) !== norm(e.fix)).slice(0, 15).map(e => {
      const at = findFrag(text, e.frag, taken); if (at) taken.push(at);
      return Object.assign(e, at ? { s: at.s, e: at.e } : {});
    });
    return {
      by: 'ai', mode: mode === 'speak' ? 'speak' : 'write', total, crit, cefr: normCefr(j.cefr || j.level) || cefrOf(total, { words: ws, ledd: 2, sentences: 5 }),
      errors, corrected: str(j.corrected || j.better, 5000).length ? String(j.corrected || j.better).trim().slice(0, 5000) : '',
      teacher: str(j.teacher, 220) || (mode === 'speak' ? TEACHER_SPEAK(total) : TEACHER(total)), summary: str(j.summary, 700),
      good: arr(j.good).map(g => str(g, 220)).filter(Boolean).slice(0, 4), text: String(text || ''), at: Date.now(),
    };
  }

  const core = { norm, lev, seeded, parseGap, chipsOf, sentenceOf, checkBlank, prepTest, prepItem, scoreItem, scoreSection, scoreTest, unitKeys, itemMax, splitArt, artOf, nounOf,
    tokenize, findErrors, gradeOffline, normAiGrade, parseLoose, findFrag, normCefr, cefrOf, CRIT, SPEAK_CRIT, GRADE_MAX, isGraded };

  /* ======================================================================
   * 2. Storage (this device)
   * ====================================================================== */
  const KEY = 'nk-prove';
  let S = null;
  function st() {
    if (S) return S;
    try { S = JSON.parse(root.localStorage.getItem(KEY) || 'null'); } catch (e) { S = null; }
    if (!S || typeof S !== 'object') S = {};
    S.v = 1; S.runs = S.runs || {}; S.best = S.best || {}; S.last = S.last || {}; S.wbest = S.wbest || {};
    return S;
  }
  function save() { try { root.localStorage.setItem(KEY, JSON.stringify(st())); } catch (e) { /* full or blocked: the test still works */ } }
  const newRun = (t, retry) => ({ id: t.id, started: Date.now(), at: Date.now(), sec: 0, a: {}, ok: {}, chk: {}, h: {}, hu: {}, oi: {}, w: {}, retry: retry || null });

  /* ======================================================================
   * 3. Data
   * ====================================================================== */
  let DATA = null, loading = null;
  // data files next to the app, found from this script's own address (works from any page)
  const SRC = (doc && doc.currentScript && doc.currentScript.src) || '';
  const url = rel => { try { return SRC ? new URL('../' + rel, SRC).href : rel; } catch (e) { return rel; } };
  const isOwnMac = () => { try { return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(root.location.hostname); } catch (e) { return false; } };
  // personal files (private/, this Mac only): the list from private/prove-index.json {"files": [...]}, or these two
  const PERSONAL_FILES = ['prove-personal.json', 'prove-workbook.json'];
  const safeName = f => typeof f === 'string' && /^[\w.-]+\.json$/.test(f) && !f.startsWith('.') && f !== 'prove-index.json';
  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('http ' + r.status);
    return r.json();
  }
  function load() {
    if (DATA) return Promise.resolve(DATA);
    if (loading) return loading;
    loading = (async () => {
      const out = { personal: [], public: [], muntlig: [] };
      // the oral tests (own tasks) — a separate file; missing or broken: the other tests still work
      const munt = getJSON(url('data/prove-muntlig.json')).then(j => arr(j && j.tests).filter(t => t && t.id && Array.isArray(t.sections)).map(t => prepTest(t, 'muntlig')), () => []);
      try { const j = await getJSON(url('data/prove-public.json')); out.public = arr(j.tests).map(t => prepTest(t, 'public')); }
      catch (e) { out.failed = true; }
      try { out.muntlig = (await munt).filter(t => !out.public.some(x => x.id === t.id)); } catch (e) { out.muntlig = []; }
      if (out.failed && out.muntlig.length) out.failed = false;
      if (isOwnMac()) {
        let files = PERSONAL_FILES;
        try { const ix = await getJSON(url('private/prove-index.json')); if (ix && Array.isArray(ix.files)) files = ix.files; }
        catch (e) { /* no index — the usual files */ }
        files = [...new Set(arr(files).filter(safeName))].slice(0, 40);
        const got = await Promise.all(files.map(f => getJSON(url('private/' + f)).then(j => ({ f, j }), () => null)));
        const seen = new Set();
        got.forEach(r => {
          if (!r || !r.j || !Array.isArray(r.j.tests)) return; // missing or broken file: silently skipped
          const head = typeof r.j.groupTitle === 'string' ? r.j.groupTitle : typeof r.j.title === 'string' ? r.j.title : '';
          r.j.tests.forEach(t0 => {
            if (!t0 || typeof t0 !== 'object' || !t0.id || seen.has(t0.id) || !Array.isArray(t0.sections)) return;
            try { const t = prepTest(t0, 'personal'); t.src = r.f; t.groupTitle = head; seen.add(t.id); out.personal.push(t); }
            catch (e) { console.warn('prove: test skipped', r.f, t0.id, e); }
          });
        });
      }
      if (!out.failed || out.personal.length) DATA = out;
      return out;
    })().finally(() => { loading = null; });
    return loading;
  }
  const allTests = () => (DATA ? [...DATA.personal, ...DATA.public, ...arr(DATA.muntlig)] : []);
  const testById = id => allTests().find(t => t.id === id);

  /* ======================================================================
   * 4. Pictures (our own drawings: a person in profile, families, a school, a sick day)
   * ====================================================================== */
  /** named points on the body figure (viewBox 0 0 360 520, the person looks to the right) */
  const BODY_PTS = {
    hode: [204, 62], 'hår': [170, 60], panne: [234, 58], 'øye': [226, 76], 'øre': [188, 86], nese: [250, 90], munn: [238, 108], kinn: [224, 98],
    hake: [230, 121], hals: [212, 138], nakke: [187, 134], skulder: [192, 162], arm: [179, 212], albue: [170, 246], 'hånd': [250, 222], finger: [276, 208],
    bryst: [224, 186], mage: [231, 250], rygg: [159, 228], rumpe: [152, 316], 'lår': [212, 352], kne: [226, 392], legg: [210, 432], ankel: [206, 462],
    fot: [232, 484], 'tå': [254, 486], 'hæl': [194, 486],
  };
  function bodySvg(labels, opts = {}) {
    const P = BODY_PTS;
    // badges in two columns (left / right of the figure), pushed apart so they never overlap
    const ls = (labels || []).filter(l => P[l.pt]).map(l => Object.assign({}, l, { p: P[l.pt], side: P[l.pt][0] < 205 ? -1 : 1 }));
    [-1, 1].forEach(side => {
      const col = ls.filter(l => l.side === side).sort((a, b) => a.p[1] - b.p[1]);
      let prev = -1e9;
      col.forEach(l => { l.ly = Math.max(l.p[1], prev + 31, 26); prev = l.ly; });
      const over = prev - 494;
      if (over > 0) { let nxt = 1e9; col.slice().reverse().forEach(l => { l.ly = Math.min(l.ly - over, nxt - 31); nxt = l.ly; }); }
    });
    const marks = ls.map(l => {
      const p = l.p, side = l.side, lx = side < 0 ? 34 : 326, ly = l.ly;
      const st = l.state ? ` pv-mk-${l.state}` : '';
      return `<g class="pv-mk${st}"><path d="M${p[0]} ${p[1]} L${lx - side * 34} ${ly} L${lx - side * 15} ${ly}"/><circle class="pv-mk-dot" cx="${p[0]}" cy="${p[1]}" r="3.4"/>
        <circle class="pv-mk-badge" cx="${lx}" cy="${ly}" r="14"/><text x="${lx}" y="${ly + .5}">${esc(l.n)}</text></g>`;
    }).join('');
    const ink = '#3a2d2a', skin = '#f6d3b5', skin2 = '#efc19d';
    return `<svg class="pv-pic pv-body" viewBox="0 0 360 520" role="img" aria-label="${esc(opts.alt || 'Рисунок: человек в профиль с пронумерованными частями тела')}">
      <defs>
        <radialGradient id="pvbg" cx="50%" cy="38%" r="72%"><stop offset="0" stop-color="#fff9f0"/><stop offset="1" stop-color="#ffe8cf"/></radialGradient>
        <linearGradient id="pvshirt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6aa0ff"/><stop offset="1" stop-color="#7c6cff"/></linearGradient>
      </defs>
      <rect x="4" y="4" width="352" height="512" rx="26" fill="url(#pvbg)"/>
      <ellipse cx="212" cy="494" rx="86" ry="9" fill="#e8c9a8" opacity=".75"/>
      <g stroke="${ink}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
        <path d="M166 296 L200 296 C200 340 196 376 192 398 L190 464 L170 464 L170 400 C168 370 166 330 166 296 Z" fill="#232b52"/>
        <path d="M166 462 C164 476 168 486 176 486 L216 486 C224 486 222 476 214 472 C204 468 196 466 190 462 Z" fill="#9a3412"/>
        <path d="M184 296 L228 296 C232 330 232 370 228 392 C224 418 218 440 216 464 L192 464 C194 440 200 418 204 394 C202 372 192 340 184 296 Z" fill="#2f3a66"/>
        <path d="M190 462 C188 478 192 490 200 490 L258 490 C266 490 266 480 256 476 C242 470 228 466 216 462 Z" fill="#c2410c"/>
        <path d="M166 296 C152 302 146 322 156 334 C162 340 176 338 184 330 L196 296 Z" fill="#2a3360" stroke="none"/><path d="M164 300 C150 306 146 324 156 334 C162 340 174 338 182 332" fill="none"/>
        <path d="M180 150 C166 156 158 178 158 202 C156 238 160 272 164 304 L224 304 C230 282 234 264 234 246 C234 218 230 192 222 172 C216 158 206 150 196 150 Z" fill="url(#pvshirt)"/>
        <line x1="166" y1="300" x2="224" y2="300" stroke-width="3"/>
        <path d="M190 116 L188 152 C196 158 208 158 214 152 L212 120" fill="${skin2}"/>
        <path d="M185 168 L171 246 L234 226" fill="none" stroke-width="22"/>
        <path d="M185 168 L171 246 L234 226" fill="none" stroke="${skin}" stroke-width="17"/>
        <path d="M189 160 C183 176 179 192 177 210" fill="none" stroke-width="30"/>
        <path d="M189 160 C183 176 179 192 177 210" fill="none" stroke="#6f95ff" stroke-width="25"/>
        <path d="M230 214 C240 206 252 204 260 200 C268 196 278 200 272 206 L262 212 C272 210 286 210 282 218 C278 226 260 234 240 236 Z" fill="${skin}"/>
        <path d="M158 80 C158 50 178 34 204 34 C230 34 246 50 246 74 C246 80 248 84 254 90 C256 94 252 97 247 97 C247 104 245 110 241 114 C237 122 229 126 217 126 C197 126 173 120 165 108 C160 100 158 90 158 80 Z" fill="${skin}"/>
        <path d="M158 86 C150 50 172 26 206 28 C226 30 240 40 242 54 C226 46 206 44 194 50 C190 64 184 80 176 100 C166 98 160 94 158 86 Z" fill="#7a4a2b"/>
        <ellipse cx="188" cy="86" rx="7" ry="10" fill="${skin2}"/>
      </g>
      <circle cx="226" cy="76" r="3.8" fill="#2b2220"/><circle cx="227.5" cy="74.6" r="1.2" fill="#fff"/>
      <path d="M217 66 Q225 62 233 66" stroke="#5a3a28" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M232 107 Q238 112 244 107" stroke="#b4485a" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <circle cx="222" cy="97" r="7" fill="#ff9aa2" opacity=".35"/>
      <g class="pv-marks">${marks}</g>
    </svg>`;
  }
  /** a simple, friendly figure (for family pictures) */
  function personSvg(p) {
    const x = p.x, h = p.h || 1, base = p.base || 290, kind = p.kind || 'man';
    const s = h, headR = (kind === 'baby' ? 20 : 22) * (0.75 + s * 0.25);
    const bodyH = 92 * s, legH = 80 * s;
    const dress0 = kind === 'woman' || kind === 'girl';
    const top = base - (headR * 2 + 2 + (dress0 ? bodyH + legH * 0.8 : bodyH * 0.78 + legH) + 4);
    const neckY = top + headR * 2 + 2;
    const c = p.color || '#5b8cff', skin = p.skin || '#f6d3b5', hair = p.hair || '#6b4226';
    const hy = top + headR;
    if (kind === 'dog') {
      const y = base - 34;
      return `<g class="pv-person"><ellipse cx="${x}" cy="${y}" rx="34" ry="18" fill="${c}" stroke="#3a2d2a" stroke-width="2.2"/>
        <circle cx="${x + 34}" cy="${y - 16}" r="15" fill="${c}" stroke="#3a2d2a" stroke-width="2.2"/><ellipse cx="${x + 28}" cy="${y - 24}" rx="6" ry="11" fill="#7a4a2b" transform="rotate(-20 ${x + 28} ${y - 24})"/>
        <circle cx="${x + 39}" cy="${y - 19}" r="2.2" fill="#222"/><circle cx="${x + 48}" cy="${y - 13}" r="3" fill="#222"/>
        <path d="M${x - 34} ${y - 4} q-14 -10 -10 -22" stroke="#3a2d2a" stroke-width="3" fill="none" stroke-linecap="round"/>
        ${[-22, -8, 10, 24].map(d => `<line x1="${x + d}" y1="${y + 12}" x2="${x + d}" y2="${base}" stroke="#3a2d2a" stroke-width="5" stroke-linecap="round"/>`).join('')}
        ${p.name ? `<text class="pv-name" x="${x}" y="${base + 26}">${esc(p.name)}</text>` : ''}</g>`;
    }
    const dress = kind === 'woman' || kind === 'girl';
    const bw = (kind === 'baby' ? 34 : 46) * (0.7 + s * 0.3);
    const body = dress
      ? `<path d="M${x - bw * 0.42} ${neckY} L${x + bw * 0.42} ${neckY} L${x + bw * 0.78} ${neckY + bodyH} L${x - bw * 0.78} ${neckY + bodyH} Z" fill="${c}"/>
         ${p.dots ? Array.from({ length: 9 }, (_, i) => `<circle cx="${x - bw * 0.45 + (i % 3) * bw * 0.45 + (Math.floor(i / 3) % 2 ? 6 : 0)}" cy="${neckY + 16 + Math.floor(i / 3) * bodyH * 0.28}" r="3.4" fill="${p.dotColor || '#fff'}" stroke="none" opacity=".9"/>`).join('') : ''}`
      : `<rect x="${x - bw / 2}" y="${neckY}" width="${bw}" height="${bodyH * 0.78}" rx="${bw * 0.3}" fill="${c}"/>
         ${p.tie ? `<path d="M${x} ${neckY + 2} l5 8 l-5 ${bodyH * 0.38} l-5 ${-bodyH * 0.38} z" fill="${p.tie}" stroke="none"/>` : ''}`;
    const legTop = dress ? neckY + bodyH : neckY + bodyH * 0.78;
    const legLen = dress ? legH * 0.8 : legH;
    const legs = `<line x1="${x - 9 * s}" y1="${legTop}" x2="${x - 11 * s}" y2="${legTop + legLen}" stroke="${dress ? skin : p.pants || '#2f3a66'}" stroke-width="${10 * (0.6 + s * 0.4)}" stroke-linecap="round"/>
      <line x1="${x + 9 * s}" y1="${legTop}" x2="${x + 11 * s}" y2="${legTop + legLen}" stroke="${dress ? skin : p.pants || '#2f3a66'}" stroke-width="${10 * (0.6 + s * 0.4)}" stroke-linecap="round"/>
      <ellipse cx="${x - 14 * s}" cy="${legTop + legLen + 3}" rx="${10 * (0.6 + s * 0.4)}" ry="5" fill="#3a2d2a"/><ellipse cx="${x + 14 * s}" cy="${legTop + legLen + 3}" rx="${10 * (0.6 + s * 0.4)}" ry="5" fill="#3a2d2a"/>`;
    const armY = neckY + 10, aw = 7 * (0.6 + s * 0.4);
    const armD = [`M${x - bw * 0.45} ${armY} q${-18 * s} ${30 * s} ${-14 * s} ${58 * s}`, `M${x + bw * 0.45} ${armY} q${18 * s} ${30 * s} ${14 * s} ${58 * s}`];
    const arms = armD.map(d => `<path d="${d}" stroke="#3a2d2a" stroke-width="${aw + 3.5}" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${dress ? skin : c}" stroke-width="${aw}" fill="none" stroke-linecap="round"/>`).join('');
    const hairD = dress
      ? `<path d="M${x - headR - 6} ${hy + 8} C${x - headR - 12} ${hy - headR - 10} ${x + headR + 12} ${hy - headR - 10} ${x + headR + 6} ${hy + 8} C${x + headR + 10} ${hy + headR + 14} ${x + headR - 4} ${hy + headR + 10} ${x + headR - 6} ${hy} C${x + 6} ${hy - headR * 0.4} ${x - 6} ${hy - headR * 0.4} ${x - headR + 6} ${hy} C${x - headR + 4} ${hy + headR + 10} ${x - headR - 10} ${hy + headR + 14} ${x - headR - 6} ${hy + 8} Z" fill="${hair}"/>`
      : kind === 'baby' ? `<path d="M${x - 4} ${hy - headR + 2} q4 -10 8 0" stroke="${hair}" stroke-width="3" fill="none"/>`
        : `<path d="M${x - headR + 1} ${hy - 2} C${x - headR} ${hy - headR - 6} ${x + headR} ${hy - headR - 6} ${x + headR - 1} ${hy - 2} C${x + 8} ${hy - headR * 0.55} ${x - 8} ${hy - headR * 0.55} ${x - headR + 1} ${hy - 2} Z" fill="${hair}"/>`;
    const face = `<circle cx="${x - headR * 0.35}" cy="${hy - 1}" r="2.4" fill="#2b2220"/><circle cx="${x + headR * 0.35}" cy="${hy - 1}" r="2.4" fill="#2b2220"/>
      <path d="M${x - headR * 0.32} ${hy + headR * 0.38} Q${x} ${hy + headR * 0.68} ${x + headR * 0.32} ${hy + headR * 0.38}" stroke="#7a2f3a" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <circle cx="${x - headR * 0.55}" cy="${hy + headR * 0.3}" r="${headR * 0.16}" fill="#ff9aa2" opacity=".45"/><circle cx="${x + headR * 0.55}" cy="${hy + headR * 0.3}" r="${headR * 0.16}" fill="#ff9aa2" opacity=".45"/>
      ${p.glasses ? `<g fill="none" stroke="#2b2220" stroke-width="1.8"><circle cx="${x - headR * 0.35}" cy="${hy - 1}" r="${headR * 0.26}"/><circle cx="${x + headR * 0.35}" cy="${hy - 1}" r="${headR * 0.26}"/><line x1="${x - headR * 0.1}" y1="${hy - 1}" x2="${x + headR * 0.1}" y2="${hy - 1}"/></g>` : ''}
      ${p.beard ? `<path d="M${x - headR * 0.7} ${hy + headR * 0.2} Q${x} ${hy + headR * 1.35} ${x + headR * 0.7} ${hy + headR * 0.2} Q${x} ${hy + headR * 0.8} ${x - headR * 0.7} ${hy + headR * 0.2} Z" fill="${p.beard}"/>` : ''}`;
    return `<g class="pv-person" stroke="#3a2d2a" stroke-width="2" stroke-linejoin="round">${legs}${arms}${body}
      <rect x="${x - 5}" y="${neckY - 6}" width="10" height="10" fill="${skin}" stroke="none"/>
      <circle cx="${x}" cy="${hy}" r="${headR}" fill="${skin}"/>${hairD}<g stroke="none">${face}</g>
      ${p.item === 'ball' ? (() => { const r = Math.max(11, 14 * s), bx = x + bw * 0.5 + r + 4, by = base - r; return `<circle cx="${bx}" cy="${by}" r="${r}" fill="#fff"/><path d="M${bx - r * .45} ${by - r * .2} l${r * .45} ${-r * .32} l${r * .45} ${r * .32} l${-r * .17} ${r * .52} h${-r * .56} z" fill="#3a2d2a" stroke="none"/>`; })() : ''}
      ${p.item === 'bag' ? `<rect x="${x - bw * 0.6 - 26 * s}" y="${armY + 50 * s}" width="${24 * s}" height="${20 * s}" rx="4" fill="#f59e0b"/>` : ''}
      ${p.item === 'book' ? `<rect x="${x + bw * 0.5 + 4}" y="${armY + 48 * s}" width="${22 * s}" height="${28 * s}" rx="3" fill="#22c55e"/>` : ''}
      <text class="pv-name" x="${x}" y="${base + 26}" stroke="none">${esc(p.name || '')}</text></g>`;
  }
  function familySvg(people, alt) {
    return `<svg class="pv-pic pv-family" viewBox="0 0 520 330" role="img" aria-label="${esc(alt || 'Рисунок: семья')}">
      <rect x="4" y="4" width="512" height="322" rx="24" fill="#f3f7ff"/>
      <circle cx="456" cy="58" r="26" fill="#ffd166" opacity=".9"/>
      <path d="M20 292 C120 282 220 300 320 290 C400 282 460 292 500 288 L500 322 L20 322 Z" fill="#cdeccf"/>
      ${people.map(personSvg).join('')}</svg>`;
  }
  function schoolSvg() {
    return `<svg class="pv-pic pv-school" viewBox="0 0 520 330" role="img" aria-label="Рисунок: класс в школе для взрослых">
      <rect x="4" y="4" width="512" height="322" rx="24" fill="#f3f7ff"/>
      <rect x="120" y="40" width="280" height="140" rx="10" fill="#2f5d50" stroke="#3a2d2a" stroke-width="3"/>
      <text x="260" y="98" text-anchor="middle" fill="#f2f7f2" font-size="26" font-family="Comic Sans MS, Chalkboard SE, sans-serif">Velkommen!</text>
      <text x="260" y="140" text-anchor="middle" fill="#cfe9dc" font-size="18" font-family="Comic Sans MS, Chalkboard SE, sans-serif">Når jeg … , …</text>
      <rect x="120" y="180" width="280" height="8" rx="3" fill="#a0785a"/>
      ${personSvg({ x: 70, h: 1, kind: 'woman', color: '#f43f5e', hair: '#3b2a20', name: 'Lærer', item: 'book', base: 280 })}
      <rect x="170" y="250" width="300" height="14" rx="5" fill="#c08a5a" stroke="#3a2d2a" stroke-width="2"/>
      <line x1="190" y1="264" x2="190" y2="300" stroke="#3a2d2a" stroke-width="5"/><line x1="450" y1="264" x2="450" y2="300" stroke="#3a2d2a" stroke-width="5"/>
      ${[{ x: 230, c: '#5b8cff', hair: '#2b2220', kind: 'man', beard: '#2b2220' }, { x: 320, c: '#22c55e', hair: '#e2b04a', kind: 'woman' }, { x: 410, c: '#a78bfa', hair: '#7a4a2b', kind: 'man', glasses: true }]
        .map(p => { const hy = 212; return `<g stroke="#3a2d2a" stroke-width="2"><rect x="${p.x - 22}" y="${hy + 18}" width="44" height="34" rx="12" fill="${p.c}"/><circle cx="${p.x}" cy="${hy}" r="20" fill="#f6d3b5"/>
          <path d="M${p.x - 20} ${hy - 2} C${p.x - 20} ${hy - 26} ${p.x + 20} ${hy - 26} ${p.x + 20} ${hy - 2} C${p.x + 8} ${hy - 12} ${p.x - 8} ${hy - 12} ${p.x - 20} ${hy - 2} Z" fill="${p.hair}"/>
          <circle cx="${p.x - 7}" cy="${hy}" r="2.2" fill="#2b2220" stroke="none"/><circle cx="${p.x + 7}" cy="${hy}" r="2.2" fill="#2b2220" stroke="none"/><path d="M${p.x - 6} ${hy + 8} Q${p.x} ${hy + 13} ${p.x + 6} ${hy + 8}" fill="none" stroke="#7a2f3a"/>
          ${p.glasses ? `<g fill="none" stroke-width="1.6"><circle cx="${p.x - 7}" cy="${hy}" r="5.5"/><circle cx="${p.x + 7}" cy="${hy}" r="5.5"/></g>` : ''}
          ${p.beard ? `<path d="M${p.x - 14} ${hy + 4} Q${p.x} ${hy + 26} ${p.x + 14} ${hy + 4} Q${p.x} ${hy + 14} ${p.x - 14} ${hy + 4} Z" fill="${p.beard}" stroke="none"/>` : ''}</g>`; }).join('')}
      <rect x="250" y="242" width="30" height="10" rx="2" fill="#fff" stroke="#3a2d2a" stroke-width="1.5"/><rect x="340" y="242" width="30" height="10" rx="2" fill="#ffd166" stroke="#3a2d2a" stroke-width="1.5"/>
    </svg>`;
  }
  function sickSvg() {
    return `<svg class="pv-pic pv-sick" viewBox="0 0 520 330" role="img" aria-label="Рисунок: человек болеет и лежит в кровати">
      <rect x="4" y="4" width="512" height="322" rx="24" fill="#f3f7ff"/>
      <rect x="350" y="40" width="120" height="96" rx="8" fill="#cfe7ff" stroke="#3a2d2a" stroke-width="3"/><line x1="410" y1="40" x2="410" y2="136" stroke="#3a2d2a" stroke-width="3"/><line x1="350" y1="88" x2="470" y2="88" stroke="#3a2d2a" stroke-width="3"/>
      <g fill="#fff" opacity=".9"><circle cx="372" cy="60" r="3"/><circle cx="440" cy="70" r="3"/><circle cx="390" cy="112" r="3"/><circle cx="452" cy="118" r="3"/></g>
      <g stroke="#3a2d2a" stroke-width="3" stroke-linejoin="round">
        <rect x="60" y="190" width="300" height="60" rx="14" fill="#c08a5a"/>
        <rect x="52" y="140" width="22" height="140" rx="8" fill="#a0704a"/><rect x="346" y="170" width="22" height="110" rx="8" fill="#a0704a"/>
        <ellipse cx="118" cy="182" rx="46" ry="20" fill="#ffffff"/>
        <path d="M150 168 C210 150 300 158 350 176 L352 214 C290 226 200 226 150 214 Z" fill="#7c6cff"/>
        <circle cx="122" cy="166" r="28" fill="#f6d3b5"/>
        <path d="M94 160 C94 132 150 132 150 160 C138 150 108 150 94 160 Z" fill="#7a4a2b"/>
      </g>
      <path d="M112 166 q4 -4 8 0 M128 166 q4 -4 8 0" stroke="#2b2220" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M116 180 q8 -5 14 0" stroke="#7a2f3a" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <rect x="140" y="168" width="34" height="6" rx="3" fill="#fff" stroke="#3a2d2a" stroke-width="1.5" transform="rotate(-12 140 168)"/><circle cx="173" cy="161" r="4" fill="#f43f5e"/>
      <g stroke="#3a2d2a" stroke-width="2.4"><rect x="400" y="210" width="80" height="10" rx="3" fill="#a0704a"/><line x1="412" y1="220" x2="412" y2="290" /><line x1="468" y1="220" x2="468" y2="290"/>
        <path d="M418 186 h30 v16 a10 10 0 0 1 -10 10 h-10 a10 10 0 0 1 -10 -10 z" fill="#fff"/><path d="M448 190 q10 2 0 12" fill="none"/></g>
      <path class="pv-steam" d="M426 180 q-6 -10 0 -18 q6 -8 0 -16 M438 180 q-6 -10 0 -18 q6 -8 0 -16" stroke="#9aa1c7" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <rect x="452" y="196" width="18" height="12" rx="3" fill="#f43f5e" stroke="#3a2d2a" stroke-width="1.5"/>
    </svg>`;
  }
  function pictureHtml(name, labels) {
    try {
      if (name === 'body') return bodySvg(labels);
      if (name === 'family-anna') return familySvg([
        { x: 95, h: 0.92, kind: 'man', color: '#ffffff', tie: '#16a34a', hair: '#3b2a20', name: 'Per' },
        { x: 205, h: 0.8, kind: 'man', color: '#ffffff', tie: '#2563eb', hair: '#3b2a20', name: 'Pål' },
        { x: 300, h: 0.48, kind: 'man', color: '#ffffff', tie: '#dc2626', hair: '#3b2a20', name: 'Espen' },
        { x: 405, h: 1.12, kind: 'woman', color: '#ffffff', dots: true, dotColor: '#e11d48', hair: '#4a3426', name: 'Anna' },
      ], 'Рисунок: мама Анна и три сына — Пер, Пол и маленький Эспен');
      if (name === 'family-public') return familySvg([
        { x: 80, h: 1.05, kind: 'man', color: '#64748b', hair: '#e5e7eb', beard: '#e5e7eb', glasses: true, name: 'Odd' },
        { x: 190, h: 1.0, kind: 'woman', color: '#f59e0b', hair: '#b45309', name: 'Kari', item: 'bag' },
        { x: 290, h: 0.62, kind: 'girl', color: '#a78bfa', hair: '#b45309', name: 'Liv' },
        { x: 360, h: 0.62, kind: 'boy', color: '#22c55e', hair: '#b45309', name: 'Ole', item: 'ball' },
        { x: 455, kind: 'dog', color: '#d6a46c', name: 'Bamse' },
      ], 'Рисунок: дедушка Уд, мама Кари, близнецы Лив и Уле и собака Бамсе');
      if (name === 'family-picnic') return familySvg([
        { x: 85, h: 1.0, kind: 'man', color: '#0ea5e9', hair: '#2b2220', beard: '#2b2220', name: 'Jonas' },
        { x: 190, h: 0.95, kind: 'woman', color: '#f43f5e', hair: '#e2b04a', name: 'Nora' },
        { x: 285, h: 0.55, kind: 'boy', color: '#f59e0b', hair: '#e2b04a', name: 'Emil', item: 'ball' },
        { x: 370, h: 0.98, kind: 'woman', color: '#94a3b8', hair: '#e5e7eb', glasses: true, name: 'Mormor' },
        { x: 460, h: 0.4, kind: 'baby', color: '#fbcfe8', hair: '#e2b04a', name: 'Ella' },
      ], 'Рисунок: семья на пикнике — папа Йонас, мама Нура, сын Эмиль, бабушка и малышка Элла');
      if (name === 'school') return schoolSvg();
      if (name === 'sick') return sickSvg();
    } catch (e) { /* a picture is a nice extra */ }
    return '';
  }

  /* ======================================================================
   * 5. The window
   * ====================================================================== */
  const hasUI = () => !!(root.UI && UI.modal);
  const toast = (m, t, ms) => { try { if (root.UI && UI.toast) UI.toast(m, t, ms); } catch (e) { /* ignore */ } };
  const reduced = () => { try { return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const aiReady = () => { try { return !!(root.AI && AI.chain && AI.call && AI.chain().length); } catch (e) { return false; } };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let cur = null;

  function open(testId) {
    if (!hasUI() || !doc) return null;
    if (cur && cur.alive()) { if (testId) cur.openTest(testId); else cur.list(); return cur; }
    const ctx = { view: 'list', t: null, run: null, selChip: null, selSlot: null, playTok: 0, playing: null };
    let closed = false;
    const m = UI.modal({
      title: '📝 Тесты по главам', cls: 'wide prove-modal', body: '<div class="pv-root" data-pv></div>',
      beforeClose: () => askLeave(ctx, 'close'),
      onClose: () => { closed = true; cur = null; speakOff(ctx); stopAudio(ctx); dragEnd(); if (ctx.ro) ctx.ro.disconnect(); try { if (ctx.ac) ctx.ac.close(); } catch (e) { /* ignore */ } },
    });
    ctx.m = m; ctx.body = m.$('[data-pv]');
    ctx.alive = () => !closed && m.el.isConnected;
    ctx.title = h => { const el = m.$('.modal-head h2'); if (el) el.innerHTML = h; };
    ctx.scrollTop = () => { const mb = m.$('.modal-body'); if (mb) mb.scrollTop = 0; };
    ctx.list = () => { speakOff(ctx); stopAudio(ctx); ctx.view = 'list'; ctx.t = null; ctx.run = null; renderList(ctx); };
    ctx.openTest = id => startTest(ctx, id);
    ctx.body.addEventListener('click', e => onClick(ctx, e));
    ctx.body.addEventListener('input', e => onInput(ctx, e));
    ctx.body.addEventListener('pointerdown', e => onPointerDown(ctx, e));
    ctx.body.addEventListener('keydown', e => onKey(ctx, e));
    // 🧰 «Шаблон и фразы»: where the cursor was when the text field lost focus (a tapped phrase goes there)
    ctx.body.addEventListener('focusout', e => { const t = e.target; if (t && t.dataset && t.dataset.wtext) (ctx.kitCaret || (ctx.kitCaret = {}))[t.dataset.wtext] = [t.selectionStart, t.selectionEnd]; });
    cur = ctx;
    ctx.body.innerHTML = `<div class="pv-loading" role="status"><span class="spinner"></span> Загружаю тесты…</div>`;
    load().then(() => {
      if (!ctx.alive()) return;
      if (testId && testById(testId)) startTest(ctx, testId); else renderList(ctx);
    }).catch(() => { if (ctx.alive()) renderList(ctx); });
    return ctx;
  }

  /** closing / leaving a test that is in progress: «continue later / finish now / cancel» */
  async function askLeave(ctx, why) {
    if (!(await confirmSpeakLeave(ctx))) return false;
    stopAudio(ctx); stopModel(ctx);
    if (ctx.view !== 'test' || !ctx.run || !hasAnswers(ctx.run)) return true;
    const r = await UI.askClose({
      title: why === 'list' ? 'Выйти из теста?' : 'Закрыть тест?',
      line: 'Ваши ответы сохранены — можно продолжить позже с того же места.',
      actions: [{ label: 'Продолжить позже', value: 'later', cls: 'primary' }, { label: 'Завершить сейчас', value: 'finish' }],
      cancel: 'Отмена',
    });
    if (r == null) return false;
    if (r === 'finish') { finish(ctx); return false; } // the window stays open with the results
    save();
    return true;
  }
  const hasAnswers = run => Object.keys(run.a || {}).length > 0 || Object.keys(run.chk || {}).length > 0;

  /* ---------- the list ---------- */
  function renderList(ctx) {
    ctx.view = 'list';
    ctx.title('📝 Тесты по главам');
    const s = st();
    if (!DATA) {
      ctx.body.innerHTML = `<div class="pv-empty"><div class="pv-empty-ico" aria-hidden="true">📭</div><p>Не получилось загрузить тесты. Проверьте интернет и попробуйте ещё раз.</p>
        <button type="button" class="btn primary" data-retry-load>Попробовать снова</button></div>`;
      return;
    }
    const card = t => {
      const best = s.best[t.id], last = s.last[t.id], run = s.runs[t.id];
      const going = run && !run.retry && hasAnswers(run);
      const nSec = t.sections.length;
      const oral = t.sections.length && t.sections.every(x => x.items.every(it => it.type === 'speak'));
      const sp = best && best.smax ? Math.round(best.sgot / best.smax * 100) : null;
      const ring = best && sp != null && !best.max ? `<div class="pv-ring ${sp >= 80 ? 'hi' : sp >= 55 ? 'mid' : 'lo'}" style="--p:${sp}" aria-hidden="true"><b>${esc(best.slevel || sp + '%')}</b></div>`
        : best && best.max ? `<div class="pv-ring ${best.pct >= 80 ? 'hi' : best.pct >= 60 ? 'mid' : 'lo'}" style="--p:${best.pct}" aria-hidden="true"><b>${best.pct}%</b></div>`
        : `<div class="pv-ring none" aria-hidden="true"><b>${esc(t.icon || '📝')}</b></div>`;
      const wrongN = last && last.wrong ? last.wrong.length : 0;
      return `<article class="pv-card" data-group="${t.group}">
        ${ring}
        <div class="pv-card-txt">
          <h4>${esc(t.title)}</h4>
          ${t.titleNo ? `<div class="pv-no" lang="nb">${esc(t.titleNo)}</div>` : ''}
          <p class="pv-card-desc">${esc(t.desc || '')}</p>
          <div class="pv-card-meta">
            <span class="pv-tag">${esc(t.level || 'A2')}</span><span class="pv-tag">${nSec} ${plural(nSec, ['задание', 'задания', 'заданий'])}</span>
            ${best ? (oral ? `<span class="pv-tag good">${best.smax ? `Устная часть: ${best.sgot}/${best.smax}${best.slevel ? ' · ' + esc(best.slevel) : ''}` : 'пройден'}</span>`
              : `<span class="pv-tag good">Лучший результат: ${best.pct}%${best.wmax ? ` · письмо ${best.wgot}/${best.wmax}` : best.level ? ' · письмо ' + esc(best.level) : ''}</span>`)
              + (best.hints ? '<span class="pv-tag hint">с подсказками</span>' : '') : '<span class="pv-tag">ещё не пройден</span>'}
            ${going ? `<span class="pv-tag warn">начат — ${progressOf(t, run)}%</span>` : ''}
          </div>
        </div>
        <div class="pv-card-act">
          <button type="button" class="btn primary" data-start="${esc(t.id)}">${going ? '▶ Продолжить' : best ? '↺ Пройти ещё раз' : '▶ Пройти'}</button>
          ${going ? `<button type="button" class="btn sm ghost" data-restart="${esc(t.id)}">Начать заново</button>` : ''}
          ${!going && wrongN ? `<button type="button" class="btn sm" data-retry-wrong="${esc(t.id)}">🔁 Повторить ошибки (${wrongN})</button>` : ''}
        </div>
      </article>`;
    };
    const personal = DATA.personal, pub = DATA.public;
    ctx.body.innerHTML = `<div class="pv-list">
      <div class="pv-intro"><span class="pv-intro-ico" aria-hidden="true">🌱</span><div>
        <b>Тесты как на курсе:</b> аудирование, грамматика и письмо. После каждого задания — «Проверить»: увидите ошибки и короткое правило.
        <span class="pv-muted">Ответы сохраняются — можно прерваться и продолжить позже.</span></div></div>
      ${personalGroups(personal).map(g => `<section class="pv-group"><h3>${g.title ? (/^\p{Extended_Pictographic}/u.test(g.title) ? '' : '📗 ') + esc(g.title) : '📒 Мои тесты по курсу'} <span class="pv-muted">— только на этом компьютере</span></h3><div class="pv-cards">${g.tests.map(card).join('')}</div></section>`).join('')}
      <section class="pv-group"><h3>🎯 Тесты по уровню A2</h3>${pub.length ? `<div class="pv-cards">${pub.map(card).join('')}</div>` : '<p class="pv-muted">Тесты не загрузились — попробуйте открыть окно ещё раз.</p>'}</section>
      ${arr(DATA.muntlig).length ? `<section class="pv-group"><h3>🗣 Устная часть — как на Norskprøve <span class="pv-muted">— подготовка, ответ голосом, оценка</span></h3><div class="pv-cards">${DATA.muntlig.map(card).join('')}</div></section>` : ''}
    </div>`;
  }
  /** personal tests: one group per file title (a file without «title» → «Мои тесты по курсу») */
  function personalGroups(list) {
    const out = [];
    list.forEach(t => { const k = t.groupTitle || ''; let g = out.find(x => x.title === k); if (!g) out.push(g = { title: k, tests: [] }); g.tests.push(t); });
    return out.sort((a, b) => (a.title ? 1 : 0) - (b.title ? 1 : 0));
  }
  const plural = (n, f) => { n = Math.abs(n) % 100; const n1 = n % 10; return n > 10 && n < 20 ? f[2] : n1 > 1 && n1 < 5 ? f[1] : n1 === 1 ? f[0] : f[2]; };
  function progressOf(t, run) {
    const n = t.sections.length || 1, d = t.sections.filter(sec => run.chk[sec.id]).length;
    return Math.round(d / n * 100);
  }

  /* ---------- a test ---------- */
  function startTest(ctx, id, opts = {}) {
    const t = testById(id); if (!t) { renderList(ctx); return; }
    const s = st();
    let run = s.runs[id];
    if (opts.fresh || !run || (opts.retry && !run.retry) || (!opts.retry && run.retry)) run = null;
    if (!run) { run = newRun(t, opts.retry || null); s.runs[id] = run; save(); }
    // a retry run whose items no longer exist (the test changed): start normally
    if (run.retry && !visibleSections(t, run).length) { run = newRun(t); s.runs[id] = run; save(); }
    ctx.t = t; ctx.run = run; ctx.view = 'test'; ctx.selChip = null; ctx.selSlot = null;
    const secs = visibleSections(t, run);
    run.sec = Math.min(Math.max(0, run.sec || 0), secs.length - 1);
    renderTest(ctx);
  }
  function retrySet(run) { return run.retry ? new Set(run.retry.map(k => k.split('.').slice(0, 2).join('.'))) : null; }
  function visibleSections(t, run) {
    const only = retrySet(run);
    return t.sections.filter(sec => !only || sec.items.some(it => only.has(sec.id + '.' + it.id)));
  }
  const visibleItems = (sec, run) => { const only = retrySet(run); return sec.items.filter(it => !only || only.has(sec.id + '.' + it.id)); };

  function renderTest(ctx) {
    const { t, run } = ctx;
    const secs = visibleSections(t, run);
    const sec = secs[run.sec] || secs[0];
    ctx.sec = sec;
    ctx.title(`${esc(t.icon || '📝')} ${esc(t.title)}`);
    const step = (x, i) => {
      const done = !!run.chk[x.id];
      const wr = x.items.length && x.items.every(isGraded) ? secGrade(x, run) : null;
      const sc = done && !wr ? scoreSection(x, run.a, run.ok, retrySet(run)) : null;
      const cls = [i === run.sec ? 'cur' : '', done ? 'done' : '', sc ? (sc.got >= sc.max ? 'full' : 'part') : ''].join(' ');
      return `<button type="button" class="pv-step ${cls}" data-go-sec="${i}" aria-label="Задание ${i + 1}${done ? ', проверено' : ''}" ${i === run.sec ? 'aria-current="step"' : ''}>
        <span class="pv-step-ico" aria-hidden="true">${(PARTS[x.part] || PARTS.gram).ico}</span><span>${i + 1}</span>${sc ? `<small>${fmtPts(sc.got)}/${sc.max}</small>` : wr && wr.n ? `<small>${wr.got}/${wr.max}</small>` : done ? '<small>✓</small>' : ''}</button>`;
    };
    ctx.body.innerHTML = `<div class="pv-test">
      <div class="pv-top">
        <button type="button" class="btn sm ghost pv-back" data-to-list>← Все тесты</button>
        ${run.retry ? '<span class="pv-tag warn">Работа над ошибками</span>' : ''}
        <nav class="pv-steps" aria-label="Задания теста">${secs.map(step).join('')}</nav>
      </div>
      <section class="pv-sec" data-sec="${esc(sec.id)}" aria-labelledby="pv-sec-h"></section>
      <div class="pv-sr" aria-live="polite" data-pv-live></div>
    </div>`;
    renderSection(ctx);
  }

  function partOf(sec) { return PARTS[sec.part] || PARTS.gram; }

  /** the current section (re-drawn after every chip move; typing does not re-draw) */
  function renderSection(ctx, focusKey) {
    const { run } = ctx, sec = ctx.sec;
    const el = ctx.body.querySelector('.pv-sec'); if (!el) return;
    const checked = !!run.chk[sec.id];
    const items = visibleItems(sec, run);
    const hintable = !checked && items.some(it => HINTABLE.includes(it.type));
    const hints = hintOn(run, sec);
    const secs = visibleSections(ctx.t, run);
    const last = run.sec >= secs.length - 1;
    const sc = checked ? scoreSection(sec, run.a, run.ok, retrySet(run)) : null;
    const P = partOf(sec);
    let body = '';
    try { body = sectionBody(ctx, sec, items, checked, hints); }
    catch (e) { console.warn('prove', e); body = '<p class="pv-muted">Это задание не открылось. Перейдите к следующему.</p>'; }
    const orderOnly = items.every(it => it.type === 'order');
    // writing / speaking: the task is in Norwegian, as on the real test; the Russian title comes with «Перевести задание»
    const isWrite = items.length && items.every(isGraded);
    const trShown = isWrite && items.some(it => (run.a[sec.id + '.' + it.id] || {}).tr);
    const head = isWrite
      ? `<h3 id="pv-sec-h" lang="nb">${esc(sec.titleNo || (items[0].type === 'speak' ? 'Muntlig oppgave' : 'Skriveoppgave'))}</h3>${trShown && sec.title ? `<div class="pv-muted pv-sec-no">${esc(sec.title)}</div>` : ''}`
      : `<h3 id="pv-sec-h">${esc(sec.title || '')}</h3>${sec.titleNo ? `<div class="pv-no pv-sec-no" lang="nb">${esc(sec.titleNo)}</div>` : ''}`;
    el.innerHTML = `
      <header class="pv-sec-head">
        <div class="pv-sec-part">${P.ico} ${esc(P.ru)} · задание ${run.sec + 1} из ${secs.length}</div>
        ${head}
        ${sec.note ? `<p class="pv-note">${esc(sec.note)}</p>` : ''}
        ${hintable ? `<div class="pv-hintbar"><button type="button" class="pv-toggle ${hints ? 'on' : ''}" data-hints aria-pressed="${hints}">
            <span class="pv-toggle-track" aria-hidden="true"></span><span>${orderOnly ? '🧩 Слова-фишки' : '💡 Подсказки'}</span></button>
          <span class="pv-muted pv-hint-tip">${orderOnly ? (hints ? 'Нажимайте слова по порядку. Выключите — и напишите предложение сами.' : 'Пишите сами. Включите — слова появятся фишками.')
            : hints ? 'Нажмите слово, потом пропуск — или перетащите слово. Нажмите на заполненный пропуск, чтобы убрать слово.' : 'Пишите по памяти. Нужна помощь — включите подсказки: внизу появятся слова.'}</span></div>` : ''}
        ${checked && sc && !isWrite ? `<div class="pv-sec-score ${sc.got >= sc.max ? 'full' : ''}">${sc.got >= sc.max ? '🎉 Всё верно!' : '✔ Проверено'} <b>${fmtPts(sc.got)} из ${sc.max}</b> · ${pctOf(sc.got, sc.max)}%${run.hu[sec.id] && !orderOnly ? ' <span class="pv-tag hint">с подсказками</span>' : ''}</div>` : ''}
      </header>
      <div class="pv-sec-body">${body}</div>
      <footer class="pv-sec-foot">
        ${run.sec > 0 ? '<button type="button" class="btn ghost" data-prev>← Назад</button>' : '<span></span>'}
        ${checked ? `<button type="button" class="btn primary" data-next>${last ? '🏁 Результаты' : 'Дальше →'}</button>`
          : sec.type === 'write' || sec.type === 'speak' || items.every(isGraded) ? `<button type="button" class="btn primary" data-check>${last ? '🏁 Готово — к результатам' : 'Готово, дальше →'}</button>`
            : '<button type="button" class="btn primary pv-check" data-check>✓ Проверить</button>'}
      </footer>`;
    afterRender(ctx, focusKey);
  }
  function hintOn(run, sec) {
    if (run.h[sec.id] != null) return !!run.h[sec.id];
    return sec.items.every(it => it.type === 'order'); // word-order tasks: the words are given on the sheet too
  }

  function sectionBody(ctx, sec, items, checked, hints) {
    const { run } = ctx;
    let html = '';
    // a picture for the whole section
    if (sec.picture && sec.picture !== 'body') html += `<div class="pv-picwrap">${pictureHtml(sec.picture)}</div>`;
    const typ = items[0] && items[0].type;
    if (typ === 'label-image' || sec.picture === 'body') {
      const labels = items.filter(it => it.type === 'label-image').map(it => {
        let state = '';
        if (checked) { const r = scoreItem(sec, it, run.a, run.ok); state = r.got >= r.max ? 'ok' : r.got > 0 ? 'half' : 'bad'; }
        return { n: it.n || it.id, pt: it.pt, state, ly: it.ly };
      });
      html += `<div class="pv-label-grid"><div class="pv-picwrap">${pictureHtml('body', labels)}</div><ol class="pv-label-list">${items.map(it => itemHtml(ctx, sec, it, checked, hints)).join('')}</ol></div>`;
    } else {
      // listening: items grouped under their clip
      const clips = arr(sec.audio);
      const used = new Set();
      clips.forEach(c => {
        const its = items.filter(it => it.clip === c.id);
        if (!its.length && retrySet(run)) return;
        its.forEach(it => used.add(it));
        html += `<div class="pv-clip-group">${clipHtml(ctx, sec, c, checked)}${its.length ? `<div class="pv-items">${its.map(it => itemHtml(ctx, sec, it, checked, hints)).join('')}</div>` : ''}</div>`;
      });
      const rest = items.filter(it => !used.has(it));
      if (rest.length) html += `<div class="pv-items ${rest.every(it => it.type === 'true-false') ? 'pv-tf-list' : ''}">${rest.map(it => itemHtml(ctx, sec, it, checked, hints)).join('')}</div>`;
    }
    if (sec.example) html = `<div class="pv-example"><span class="pv-muted">Пример:</span> <span lang="nb">${esc(sec.example)}</span>${sec.exampleAnswer ? `<br><span class="pv-muted">→</span> <b lang="nb">${esc(sec.exampleAnswer)}</b>` : ''}</div>` + html;
    // the word bank
    if (hints && !checked) {
      const bank = bankOf(ctx, sec, items);
      if (bank.length) {
        html += `<div class="pv-bank-wrap"><div class="pv-bank-lbl">💡 Слова-подсказки</div><div class="pv-bank" role="group" aria-label="Слова-подсказки">${bank.map(b =>
          `<button type="button" class="pv-chip ${ctx.selChip === b.i ? 'sel' : ''}" data-chip="${b.i}" lang="nb" aria-pressed="${ctx.selChip === b.i}">${esc(b.t)}${b.left > 1 ? `<small>×${b.left}</small>` : ''}</button>`).join('')}</div></div>`;
      }
    }
    return html;
  }

  /** word bank: the section's own list (used again and again) or the answers themselves (each as often as needed) */
  function bankAll(sec) {
    if (sec._bank) return sec._bank;
    let list, reuse;
    if (sec.bank) { list = arr(sec.bank).map(t => ({ t, n: Infinity })); reuse = true; }
    else {
      const cnt = new Map();
      sec.items.forEach(it => arr(it.blanks).forEach(b => {
        if (it.type === 'order' || it.type === 'transform') return;
        let w = arr(b.ans)[0]; if (!w) return;
        if (it.type === 'label-image') w = w.replace(/^(en|ei|et)\s+/i, '');
        cnt.set(w, (cnt.get(w) || 0) + 1);
      }));
      arr(sec.extra).forEach(w => cnt.set(w, cnt.get(w) || 1));
      list = seeded([...cnt.entries()].map(([t, n]) => ({ t, n })), sec.id + 'bank');
      reuse = false;
    }
    sec._bank = list.map((x, i) => Object.assign({ i }, x)); sec._reuse = reuse;
    return sec._bank;
  }
  function bankOf(ctx, sec, items) {
    if (!items.some(it => ['gap', 'label-image', 'listen-short'].includes(it.type))) return [];
    const all = bankAll(sec);
    if (sec._reuse) return all.map(b => Object.assign({ left: 0 }, b));
    // used words leave the bank (as many times as they are used)
    const usedN = new Map();
    sec.items.forEach(it => unitKeys(sec, it).forEach(k => {
      let v = ctx.run.a[k]; if (!v || it.type === 'order' || it.type === 'transform' || it.type === 'match') return;
      if (it.type === 'label-image') v = nounOf(v);
      const b = all.find(x => norm(x.t) === norm(v)); if (b) usedN.set(b.i, (usedN.get(b.i) || 0) + 1);
    }));
    return all.map(b => Object.assign({}, b, { left: b.n - (usedN.get(b.i) || 0) })).filter(b => b.left > 0);
  }

  /* ---------- listening ---------- */
  function clipHtml(ctx, sec, c, checked) {
    const key = sec.id + '|' + c.id, playing = ctx.playing === key;
    const shown = checked || (ctx.run.w['txt.' + key]);
    const lines = arr(c.lines).map(l => `<p lang="nb">${l.who ? `<b>${esc(l.who)}:</b> ` : ''}${esc(l.t)}</p>`).join('');
    return `<div class="pv-audio ${playing ? 'playing' : ''}" data-clip="${esc(key)}">
      <div class="pv-audio-lbl"><span class="pv-eq" aria-hidden="true"><i></i><i></i><i></i></span>${esc(c.label || 'Послушайте')}</div>
      <div class="pv-audio-btns">
        <button type="button" class="btn sm ${playing ? 'bad' : 'primary'}" data-play="${esc(key)}">${playing ? '■ Стоп' : '▶ Слушать'}</button>
        <button type="button" class="btn sm" data-play-slow="${esc(key)}" ${playing ? 'disabled' : ''}>🐢 Медленнее</button>
        ${shown ? '' : `<button type="button" class="btn sm ghost" data-show-text="${esc(key)}" title="Если голос не работает — прочитайте текст (будет отмечено «с подсказками»)">📄 Текст</button>`}
      </div>
      ${shown ? `<details class="pv-transcript" ${checked ? '' : 'open'}><summary>Текст${checked ? ' (показать)' : ''}</summary>${lines}</details>` : ''}
    </div>`;
  }
  function stopAudio(ctx) {
    if (!ctx) return;
    ctx.playTok++;
    if (ctx.playing) { ctx.playing = null; refreshClips(ctx); }
    try { if (root.TTS && TTS.stop) TTS.stop(); } catch (e) { /* ignore */ }
  }
  function refreshClips(ctx) {
    if (!ctx.sec || !ctx.alive || !ctx.alive()) return;
    ctx.body.querySelectorAll('[data-clip]').forEach(box => {
      const key = box.dataset.clip, c = arr(ctx.sec.audio).find(x => ctx.sec.id + '|' + x.id === key); if (!c) return;
      const tmp = doc.createElement('div'); tmp.innerHTML = clipHtml(ctx, ctx.sec, c, !!ctx.run.chk[ctx.sec.id]);
      box.replaceWith(tmp.firstElementChild);
    });
  }
  async function playClip(ctx, key, slow) {
    if (ctx.playing === key && !slow) { stopAudio(ctx); return; }
    stopAudio(ctx);
    const c = arr(ctx.sec.audio).find(x => ctx.sec.id + '|' + x.id === key); if (!c) return;
    if (!root.TTS || !TTS.speak) { toast('Голос сейчас недоступен — нажмите «📄 Текст» и прочитайте', 'warn', 4500); return; }
    const tok = ++ctx.playTok;
    ctx.playing = key; refreshClips(ctx);
    let rate;
    try { const base = TTS.currentRate ? TTS.currentRate() : 0.9; rate = slow ? Math.max(0.45, Math.min(0.75, base * 0.72)) : undefined; } catch (e) { rate = slow ? 0.6 : undefined; }
    let failed = false;
    try {
      try { TTS.stop(); } catch (e) { /* ignore */ }
      for (const ln of arr(c.lines)) {
        if (tok !== ctx.playTok || !ctx.alive()) break;
        const t0 = Date.now();
        await TTS.speak(ln.t, 'no', { keep: true, rate });
        if (Date.now() - t0 < 60 && String(ln.t).length > 10) failed = true;
        if (tok !== ctx.playTok) break;
        await sleep(slow ? 650 : 420);
      }
    } catch (e) { failed = true; }
    if (tok === ctx.playTok) { ctx.playing = null; refreshClips(ctx); }
    if (failed && tok === ctx.playTok) toast('Голос не прозвучал? Проверьте звук или нажмите «📄 Текст»', 'warn', 4500);
  }

  /* ---------- one item ---------- */
  function feedback(sec, it, r, k, ctx) {
    // under a wrong answer: the right one + the rule in Russian
    const b = it.blanks && it.blanks[k];
    const right = b ? arr(b.ans)[0] : '';
    const note = r.note === 'article' ? 'Слово верное, но артикль другой — половина балла.' : r.note === 'no-article' ? 'Слово верное, но без артикля — половина балла.'
      : r.note === 'spelling' ? 'Почти: одна буква не та — половина балла.' : '';
    const why = (b && b.why) || it.rule || sec.rule || '';
    const key = unitKeys(sec, it)[k];
    const canSelf = SELF_OK.includes(it.type) && r.got < (it.points || 1) && !r.self && r.note !== 'empty';
    return `<div class="pv-fb" role="note">${right ? `<div>Правильно: <b lang="nb">${esc(right)}</b>${arr(b.ans).length > 1 && it.type !== 'label-image' ? ` <span class="pv-muted">(можно и: ${arr(b.ans).slice(1, 3).map(esc).join('; ')})</span>` : ''}</div>` : ''}
      ${note ? `<div class="pv-fb-note">${note}</div>` : ''}${why ? `<div class="pv-rule">💡 ${esc(why)}</div>` : ''}
      ${canSelf ? `<button type="button" class="btn sm ghost pv-selfok" data-self-ok="${esc(key)}">✋ Засчитать мой ответ</button>` : ''}</div>`;
  }
  const mark = r => (r.self ? 'self' : r.got >= 1 ? 'ok' : r.got > 0 ? 'half' : 'bad');
  function itemHtml(ctx, sec, it, checked, hints) {
    const run = ctx.run, base = sec.id + '.' + it.id;
    const r = checked ? scoreItem(sec, it, run.a, run.ok) : null;
    const T = it.type;
    if (T === 'listen-short') {
      const res = r && r.res[0];
      return `<div class="pv-item pv-qa ${res ? 'pv-' + mark({ got: res.got / (it.points || 1), self: res.self }) : ''}">
        <div class="pv-q"><span class="pv-n">${esc(it.n || it.id)}</span>${it.say ? `<button type="button" class="btn sm primary pv-say" data-say-word="${esc(it.say)}" aria-label="Послушать слово ${esc(it.n || it.id)}">🔊 Слушать</button><span class="pv-muted">${esc(it.q || 'Послушайте и напишите слово')}</span>` : `<span lang="nb">${esc(it.q || '')}</span>`}</div>
        <div class="pv-a">${field(ctx, sec, it, base, it.blanks[0], checked, hints, res)}</div>
        ${res && (res.got < (it.points || 1)) && !res.self ? feedback(sec, it, res, 0, ctx) : ''}${res && res.self ? '<div class="pv-fb"><span class="pv-tag hint">засчитано вами</span></div>' : ''}</div>`;
    }
    if (T === 'true-false' || T === 'choice') {
      const v = run.a[base];
      const opts = T === 'true-false' ? [{ v: 'true', t: 'Riktig', ru: 'верно' }, { v: 'false', t: 'Feil', ru: 'неверно' }] : arr(it.options).map((o, i) => ({ v: String(i), t: o }));
      const good = T === 'true-false' ? String(!!it.answer) : String(it.answer);
      const sel = v == null ? null : String(v);
      return `<div class="pv-item pv-pick ${r ? 'pv-' + (r.got ? 'ok' : 'bad') : ''}" ${T === 'choice' ? 'data-choice' : ''}>
        <div class="pv-q"><span class="pv-n">${esc(it.n || it.id)}</span><span lang="nb">${esc(it.s || it.q || '')}</span></div>
        <div class="pv-pick-btns" role="group">${opts.map(o => {
          const cls = [sel === o.v ? 'on' : '', checked && o.v === good ? 'right' : '', checked && sel === o.v && o.v !== good ? 'wrong' : ''].join(' ');
          return `<button type="button" class="pv-pick-btn ${cls}" data-pick="${esc(base)}" data-v="${o.v}" aria-pressed="${sel === o.v}" ${checked ? 'disabled' : ''}><span lang="nb">${esc(o.t)}</span>${o.ru ? `<small>${o.ru}</small>` : ''}</button>`;
        }).join('')}</div>
        ${r && !r.got && (it.rule || it.why) ? `<div class="pv-fb"><div class="pv-rule">💡 ${esc(it.why || it.rule)}</div></div>` : ''}</div>`;
    }
    if (T === 'gap') {
      const keys = unitKeys(sec, it);
      const html = it.parts.map(p => {
        if (typeof p === 'string') return `<span lang="nb">${esc(p)}</span>`;
        const res = r && r.res[p.b];
        return field(ctx, sec, it, keys[p.b], it.blanks[p.b], checked, hints, res, p.b);
      }).join('');
      const fbs = r ? r.res.map((res, k) => (res.got < 1 ? `<li><span class="pv-n sm">${k + 1}</span>${feedback(sec, it, res, k, ctx)}</li>` : '')).join('') : '';
      return `<div class="pv-item pv-gap ${it.title ? 'pv-gap-text' : ''}">${it.title ? `<div class="pv-gap-title" lang="nb">${esc(it.title)}</div>` : ''}
        <p class="pv-gap-line">${it.n ? `<span class="pv-n">${esc(it.n)}</span>` : ''}${html}</p>${fbs ? `<ul class="pv-fb-list">${fbs}</ul>` : ''}</div>`;
    }
    if (T === 'label-image') {
      const res = r && r.res[0];
      return `<li class="pv-item pv-label ${res ? 'pv-' + mark(res) : ''}"><span class="pv-n">${esc(it.n || it.id)}</span>
        <div class="pv-label-f">${field(ctx, sec, it, base, it.blanks[0], checked, hints, res)}</div>
        ${res && res.got < 1 ? feedback(sec, it, res, 0, ctx) : ''}${res && res.got >= 1 && it.ru ? `<span class="pv-muted pv-ru">${esc(it.ru)}</span>` : ''}</li>`;
    }
    if (T === 'order' || T === 'transform') {
      const res = r && r.res[0];
      return `<div class="pv-item pv-sent ${res ? 'pv-' + mark(res) : ''}">
        ${T === 'transform' ? `<div class="pv-q"><span class="pv-n">${esc(it.n || it.id)}</span><span lang="nb">${esc(it.prompt || '')}</span></div>`
          : `<div class="pv-q"><span class="pv-n">${esc(it.n || it.id)}</span>${hints && !checked ? `<span class="pv-muted">${esc(it.q || 'Соберите предложение')}</span>` : `<span class="pv-words" lang="nb">${orderWords(it).map(w => `<span>${esc(w)}</span>`).join('')}</span>`}</div>`}
        <div class="pv-a">${it.prefix ? `<span class="pv-prefix" lang="nb">${esc(it.prefix)}</span>` : ''}${sentField(ctx, sec, it, base, checked, hints, res)}</div>
        ${it.ru && checked ? `<div class="pv-muted pv-ru">${esc(it.ru)}</div>` : ''}
        ${res && res.got < (it.points || 1) && !res.self ? feedback(sec, it, res, 0, ctx) : ''}${res && res.self ? '<div class="pv-fb"><span class="pv-tag hint">засчитано вами</span></div>' : ''}</div>`;
    }
    if (T === 'match') return matchHtml(ctx, sec, it, checked, r);
    if (T === 'write') return writeHtml(ctx, sec, it, checked);
    if (T === 'speak') return speakHtml(ctx, sec, it);
    return '';
  }

  /** a gap: an input (no hints) or a slot for a chip (hints) — after checking: the answer, coloured */
  function field(ctx, sec, it, key, blank, checked, hints, res, k) {
    const run = ctx.run, v = run.a[key] || '';
    const width = Math.max(4, Math.min(30, Math.max(...arr(blank.ans).map(a => String(a).length)) + 2));
    const lbl = `Пропуск ${it.type === 'gap' ? (k + 1) : esc(it.n || it.id)}`;
    if (blank.article) {
      const art = artOf(v);
      const artBtns = ARTS.map(a => `<button type="button" class="pv-art-btn ${art === a ? 'on' : ''}" data-art="${esc(key)}" data-v="${a}" aria-pressed="${art === a}" ${checked ? 'disabled' : ''} lang="nb">${a}</button>`).join('');
      const noun = nounOf(v);
      if (checked) return `<span class="pv-done ${res ? 'pv-' + mark(res) : ''}" lang="nb">${esc(v) || '—'}</span>`;
      const nf = hints
        ? `<button type="button" class="pv-slot ${noun ? 'filled' : ''} ${ctx.selSlot === key ? 'sel' : ''}" data-slot="${esc(key)}" data-noun="1" aria-label="${lbl}: ${noun ? esc(noun) : 'пусто'}" lang="nb" style="--w:${width}ch">${noun ? esc(noun) : '<span class="pv-ph">…</span>'}</button>`
        : `<input class="pv-in" data-in="${esc(key)}" data-noun="1" value="${esc(noun)}" aria-label="${lbl}: слово" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" lang="nb" style="--w:${width}ch">`;
      return `<span class="pv-artf"><span class="pv-arts" role="group" aria-label="Артикль">${artBtns}</span>${nf}</span>`;
    }
    if (checked) return `<span class="pv-done ${res ? 'pv-' + mark(res) : ''}" lang="nb">${esc(v) || '—'}${it.type === 'gap' && res && res.got < 1 ? `<sup class="pv-bn">${k + 1}</sup>` : ''}</span>`;
    if (hints) return `<button type="button" class="pv-slot ${v ? 'filled' : ''} ${ctx.selSlot === key ? 'sel' : ''}" data-slot="${esc(key)}" aria-label="${lbl}: ${v ? esc(v) : 'пусто'}" lang="nb" style="--w:${width}ch">${v ? esc(v) : '<span class="pv-ph">…</span>'}</button>`;
    const wide = it.type === 'listen-short';
    return `<input class="pv-in ${wide ? 'wide' : ''}" data-in="${esc(key)}" value="${esc(v)}" aria-label="${wide ? 'Ваш ответ' : lbl}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" lang="nb" style="--w:${width}ch" ${wide ? 'placeholder="Ваш ответ…"' : ''}>`;
  }

  /** chips of a sentence task: the sheet's own words (order) or the words of the answer (transform with hints) */
  function orderWords(it) {
    if (it._words) return it._words;
    let w = it.words ? arr(it.words).slice() : chipsOf(arr(it.answer)[0], it.names);
    if (it.type === 'transform' && it.prefix) {
      const pre = chipsOf(it.prefix).map(norm);
      const lw = w.map(norm);
      if (pre.every((p, i) => lw[i] === p)) w = w.slice(pre.length);
    }
    if (!it.keepOrder) {
      let sh = seeded(w, it.id + (it.prompt || '') + w.join(' '));
      if (sh.join(' ') === w.join(' ') && w.length > 1) sh = sh.slice(1).concat(sh[0]);
      w = sh;
    }
    it._words = w;
    return w;
  }
  function sentField(ctx, sec, it, key, checked, hints, res) {
    const run = ctx.run, v = run.a[key] || '';
    const model = arr(it.answer)[0];
    if (checked) return `<span class="pv-done pv-sentence ${res ? 'pv-' + mark(res) : ''}" lang="nb">${esc(v) || '—'}</span>`;
    if (!hints) return `<input class="pv-in pv-in-sent" data-in="${esc(key)}" value="${esc(v)}" aria-label="Ваше предложение" autocomplete="off" autocapitalize="sentences" autocorrect="off" spellcheck="false" lang="nb" placeholder="Напишите предложение…">`;
    const words = orderWords(it);
    let idx = arr(run.oi[key]).filter(i => i >= 0 && i < words.length);
    // typed earlier → try to lay the same words out as chips
    if (!idx.length && v) {
      const pool = words.map((w, i) => ({ w: norm(w), i })), toks = norm(v).split(' ');
      const out = []; let t = 0;
      while (t < toks.length) {
        const hit = pool.find(p => p.w === toks.slice(t, t + p.w.split(' ').length).join(' '));
        if (!hit) { break; }
        out.push(hit.i); pool.splice(pool.indexOf(hit), 1); t += hit.w.split(' ').length;
      }
      if (t >= toks.length) idx = out;
      run.oi[key] = idx;
    }
    const usedSet = new Set(idx);
    return `<div class="pv-order" data-order="${esc(key)}">
      <div class="pv-line ${idx.length ? '' : 'empty'}" aria-label="Ваше предложение">${idx.length ? idx.map((i, p) => `<button type="button" class="pv-chip in" data-ord-rm="${esc(key)}" data-p="${p}" lang="nb" aria-label="Убрать «${esc(words[i])}»">${esc(p === 0 && !it.prefix ? cap(words[i]) : words[i])}</button>`).join('') + `<span class="pv-end" aria-hidden="true">${esc((String(model).match(/[.!?]$/) || ['.'])[0])}</span>` : '<span class="pv-ph">Нажимайте слова по порядку…</span>'}</div>
      <div class="pv-pool">${words.map((w, i) => (usedSet.has(i) ? '' : `<button type="button" class="pv-chip" data-ord-add="${esc(key)}" data-i="${i}" lang="nb">${esc(w)}</button>`)).join('')}</div>
    </div>`;
  }
  const cap = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);

  /* ---------- matching ---------- */
  function matchHtml(ctx, sec, it, checked, r) {
    const run = ctx.run, base = sec.id + '.' + it.id, v = arr(run.a[base]);
    if (!it._right) {
      let r0 = seeded(it.pairs.map((p, i) => i), base + 'r');
      if (r0.every((j, i) => j === i) && r0.length > 1) r0 = r0.slice(1).concat(r0[0]);
      it._right = r0;
    }
    const right = it._right;
    const selL = ctx.selMatch && ctx.selMatch.key === base ? ctx.selMatch.i : null;
    const leftOf = j => v.indexOf(j);
    const left = it.pairs.map((p, i) => {
      const st = checked ? (v[i] === i ? 'right' : 'wrong') : v[i] != null ? 'linked' : '';
      return `<button type="button" class="pv-m pv-ml ${st} ${selL === i ? 'sel' : ''}" data-ml="${esc(base)}" data-i="${i}" ${checked ? 'disabled' : ''} aria-pressed="${selL === i}" lang="nb" style="--hue:${(i * 47) % 360}">${esc(p[0])}</button>`;
    }).join('');
    const rightH = right.map(j => {
      const li = leftOf(j);
      const st = checked ? (li === j ? 'right' : li >= 0 ? 'wrong' : '') : li >= 0 ? 'linked' : '';
      return `<button type="button" class="pv-m pv-mr ${st}" data-mr="${esc(base)}" data-j="${j}" ${checked ? 'disabled' : ''} lang="nb" style="--hue:${li >= 0 ? (li * 47) % 360 : 0}">${esc(it.pairs[j][1])}</button>`;
    }).join('');
    const wrongs = checked ? it.pairs.map((p, i) => (v[i] === i || (run.ok[base + '.' + i]) ? '' : `<li><b lang="nb">${esc(p[0])}</b> — <span lang="nb">${esc(p[1])}</span>${p[2] ? ` <span class="pv-muted">(${esc(p[2])})</span>` : ''}</li>`)).join('') : '';
    return `<div class="pv-item pv-match" data-match="${esc(base)}">
      ${checked ? '' : '<p class="pv-muted pv-match-tip">Нажмите слово слева, потом его объяснение справа — или протяните линию. Нажмите на соединённое слово ещё раз, чтобы разъединить.</p>'}
      <div class="pv-match-grid"><svg class="pv-match-lines" aria-hidden="true"></svg><div class="pv-mcol">${left}</div><div class="pv-mcol">${rightH}</div></div>
      ${wrongs ? `<div class="pv-fb"><div>Правильные пары:</div><ul class="pv-pairs">${wrongs}</ul>${it.rule || sec.rule ? `<div class="pv-rule">💡 ${esc(it.rule || sec.rule)}</div>` : ''}</div>` : ''}
    </div>`;
  }
  function drawMatchLines(ctx) {
    ctx.body.querySelectorAll('.pv-match').forEach(box => {
      const base = box.dataset.match, svg = box.querySelector('.pv-match-lines'), grid = box.querySelector('.pv-match-grid');
      if (!svg || !grid) return;
      const v = arr(ctx.run.a[base]), checked = !!ctx.run.chk[ctx.sec.id];
      const g = grid.getBoundingClientRect();
      svg.setAttribute('width', g.width); svg.setAttribute('height', g.height); svg.setAttribute('viewBox', `0 0 ${g.width} ${g.height}`);
      let out = '';
      v.forEach((j, i) => {
        if (j == null) return;
        const a = box.querySelector(`[data-ml][data-i="${i}"]`), b = box.querySelector(`[data-mr][data-j="${j}"]`); if (!a || !b) return;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const x1 = ra.right - g.left, y1 = ra.top + ra.height / 2 - g.top, x2 = rb.left - g.left, y2 = rb.top + rb.height / 2 - g.top;
        const cls = checked ? (i === j ? 'right' : 'wrong') : '';
        out += `<path class="${cls}" d="M${x1} ${y1} C${x1 + (x2 - x1) * 0.5} ${y1} ${x1 + (x2 - x1) * 0.5} ${y2} ${x2} ${y2}" style="--hue:${(i * 47) % 360}"/><circle class="${cls}" cx="${x1}" cy="${y1}" r="4" style="--hue:${(i * 47) % 360}"/><circle class="${cls}" cx="${x2}" cy="${y2}" r="4" style="--hue:${(i * 47) % 360}"/>`;
      });
      if (ctx.dragLine && ctx.dragLine.base === base) out += `<path class="drag" d="M${ctx.dragLine.x1} ${ctx.dragLine.y1} L${ctx.dragLine.x2} ${ctx.dragLine.y2}"/>`;
      svg.innerHTML = out;
    });
  }

  /* ---------- writing: the task in Norwegian, a 12-point grade ---------- */
  const wordCount = t => words0(t).length;
  const wKey = (ctx, base) => ctx.t.id + '|' + base;
  function writeHtml(ctx, sec, it, checked) {
    const base = sec.id + '.' + it.id, w = ctx.run.a[base] || {};
    const text = w.text || '', words = wordCount(text);
    const ai = aiReady();
    const best = st().wbest[wKey(ctx, base)];
    const g = w.grade && typeof w.grade === 'object' && w.grade.crit ? w.grade : null;
    const stale = g && g.text !== text;
    return `<div class="pv-item pv-write" data-write="${esc(base)}">
      ${it.picture ? `<div class="pv-picwrap">${pictureHtml(it.picture)}</div>` : ''}
      <div class="pv-task">
        <div class="pv-task-lbl"><span aria-hidden="true">📝</span> <span lang="nb">Oppgave</span></div>
        ${it.prompt ? `<p class="pv-task-no" lang="nb">${esc(it.prompt)}</p>` : ''}
        ${it.promptRu ? (w.tr ? `<p class="pv-task-ru"><span class="pv-muted">Перевод:</span> ${esc(it.promptRu)}</p>`
          : `<button type="button" class="btn sm ghost pv-tr" data-tr="${esc(base)}" title="Покажет задание по-русски — будет отмечено «с подсказками»">🌐 Перевести задание</button>`) : ''}
      </div>
      ${kitHtml(ctx, base, it, text)}
      <textarea class="input pv-textarea" data-wtext="${esc(base)}" rows="8" lang="nb" spellcheck="false" autocapitalize="sentences" placeholder="Skriv her… (пишите по-норвежски)" aria-label="Ваш текст по-норвежски">${esc(text)}</textarea>
      <div class="pv-write-bar"><span class="pv-muted" data-wcount>${countLine(words, it)}</span>
        ${best ? `<span class="pv-tag good">Лучшая оценка: ${best.total}/${GRADE_MAX} · ${esc(best.cefr || '')}</span>` : ''}</div>
      <div class="pv-write-btns">
        <button type="button" class="btn ${ai ? 'ai' : 'primary'}" data-grade="${esc(base)}" ${words < 3 ? 'disabled' : ''}>${ai ? '✨ Оценить текст (нейросеть)' : '📊 Оценить текст'}</button>
      </div>
      ${!ai && !g ? '<p class="pv-muted pv-small">Без нейросети оценка примерная: программа проверит длину, порядок слов, артикли и формы глаголов. Для точной проверки подключите нейросеть в Настройках.</p>' : ''}
      <div class="pv-grade-out" data-grade-out>${g ? gradeHtml(it, g, w, stale) : ''}</div>
    </div>`;
  }
  const countLine = (n, it) => `${n} ${plural(n, ['слово', 'слова', 'слов'])}${it && it.minWords ? ` · нужно от ${it.minWords}` : ''}`;

  /* ---------- 🧰 «Шаблон и фразы»: a plan for this kind of text + phrases to tap into the text at the cursor
   *  (data/writing-phrases.json — the same file as the decks «Фразы для письма»). Only a helper: the grade does not change. ---------- */
  const PHRASES_URL = 'data/writing-phrases.json';
  let PHR = null, phrP = null;
  function loadPhrases() {
    if (PHR) return Promise.resolve(PHR);
    if (!phrP) {
      phrP = fetch(PHRASES_URL, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null))
        .then(j => { PHR = j && Array.isArray(j.decks) && j.decks.length ? j : null; return PHR; })
        .catch(() => null).finally(() => { phrP = null; });
    }
    return phrP;
  }
  const GENRES = {
    msg: { ico: '✉️', ru: 'Сообщение / письмо', decks: ['phr-letter', 'phr-reason', 'phr-opinion', 'phr-end'],
      plan: [['Hilsen', 'приветствие', 'Hei Kari! · Kjære Anna,'], ['Hvorfor skriver du?', 'зачем вы пишете', 'Takk for … · Jeg skriver fordi …'],
        ['Svar på spørsmålene', 'ответьте на ВСЕ вопросы задания: что? когда? где? почему?', 'Dessverre kan jeg ikke … · Vi kan møtes …'],
        ['Spørsmål / avtale', 'вопрос или просьба к адресату', 'Har du lyst til å …? · Gi meg beskjed …'], ['Avslutning', 'прощание и подпись', 'Ha det bra! · Hilsen Olga']] },
    opinion: { ico: '💭', ru: 'Мнение / за и против', decks: ['phr-opinion', 'phr-proscons', 'phr-reason', 'phr-start', 'phr-compare', 'phr-end'],
      plan: [['Innledning', 'тема: о чём текст', 'I dag vil jeg skrive om … · … er et tema som mange snakker om.'], ['Min mening', 'ваше мнение', 'Jeg synes at … · Etter min mening er …'],
        ['Argumenter', '2–3 причины с примером', 'For det første … fordi … · For eksempel …'], ['Den andre siden', 'другое мнение, минусы', 'På den andre siden … · Selv om …, …'],
        ['Avslutning', 'вывод', 'Alt i alt … · Derfor mener jeg at …']] },
    story: { ico: '📖', ru: 'Рассказ / описание', decks: ['phr-start', 'phr-reason', 'phr-compare', 'phr-opinion', 'phr-end'],
      plan: [['Innledning', 'о ком / о чём текст', 'Jeg vil fortelle om … · På bildet ser vi …'], ['Hoveddel', 'по порядку: сначала, потом, после', 'Først … · Så … · Etterpå … (после них — глагол, потом подлежащее)'],
        ['Detaljer', 'почему? например?', '… fordi … · For eksempel …'], ['Min mening', 'что вы об этом думаете', 'Jeg synes at … · Det beste med … er at …'], ['Avslutning', 'итог', 'Til slutt vil jeg si at … · Alt i alt …']] },
  };
  /** the kind of text the task asks for (it.genre wins; the user can switch it in the panel) */
  function genreOf(it) {
    if (GENRES[it.genre]) return it.genre;
    const p = norm(`${it.prompt || ''} ${it.titleNo || ''}`);
    if (/melding|brev|e post|epost|sms|invit|skriv til|svar til|beskjed|søknad/.test(p)) return 'msg';
    if (/tegning|bilde|fortell|beskriv/.test(p)) return 'story';
    if (/mener du|synes du|tenker du|fordel|ulemp|diskuter|argument|enig|mening/.test(p)) return 'opinion';
    return 'story';
  }
  const CONNECTORS = ['og', 'men', 'fordi', 'derfor', 'så', 'først', 'etterpå', 'da', 'når', 'hvis', 'selv om', 'for eksempel', 'dessuten', 'i tillegg', 'til slutt', 'likevel', 'siden', 'mens'];
  function connectorsIn(text) {
    const t = ' ' + norm(text) + ' ';
    return CONNECTORS.map(c => ({ c, n: t.split(' ' + c + ' ').length - 1 })).filter(x => x.n);
  }
  const connLine = text => {
    const f = connectorsIn(text);
    return f.length ? `Связки в вашем тексте: ${f.map(x => `<b lang="nb">${esc(x.c)}</b>${x.n > 1 ? ' ×' + x.n : ''}`).join(', ')}${f.length < 3 ? ' — добавьте ещё 1–2 (derfor, først, til slutt…)' : ' 👍'}`
      : 'Связок пока нет — добавьте <b lang="nb">og, men, fordi, derfor</b>: текст станет связным.';
  };
  const KIT_CHECK = [
    'После <b lang="nb">I dag / Derfor / Etterpå / Dessverre</b> в начале — сначала глагол, потом подлежащее: <span lang="nb">I dag <b>går jeg</b> på jobb.</span>',
    '<b lang="nb">ikke</b> в главном — после глагола: <span lang="nb">Jeg <b>har ikke</b> tid.</span> В придаточном — перед глаголом: <span lang="nb">…fordi jeg <b>ikke har</b> tid.</span>',
    'Придаточное впереди → запятая → глагол → подлежащее: <span lang="nb">Hvis det regner, <b>blir jeg</b> hjemme.</span>',
    'После <b lang="nb">fordi, at, som, når, hvis</b> — без инверсии: <span lang="nb">…fordi <b>jeg er</b> syk</span> (не «fordi er jeg»).',
    'Вопрос без вопросительного слова — глагол первым: <span lang="nb"><b>Har du</b> lyst til å komme?</span>',
  ];
  const kitState = (ctx, base, it) => { const k = ctx.kit || (ctx.kit = {}); return k[base] || (k[base] = { open: false, genre: genreOf(it), deck: null }); };
  function kitPhrasesHtml(K) {
    if (!PHR) return '<div class="pv-kit-wait pv-muted" role="status"><span class="spinner sm"></span> Загружаю фразы…</div>';
    const g = GENRES[K.genre] || GENRES.story;
    const decks = g.decks.map(id => PHR.decks.find(d => d.id === id)).filter(Boolean);
    if (!decks.length) return '';
    const cur0 = decks.find(d => d.id === K.deck) || decks[0];
    return `<div class="pv-kit-tabs" role="group" aria-label="Группы фраз">${decks.map(d => `<button type="button" class="pv-kit-tab ${d === cur0 ? 'on' : ''}" data-kit-deck="${esc(d.id)}" aria-pressed="${d === cur0}" title="${esc(d.description || d.name)}">${esc(d.icon || '')} ${esc(d.name)}</button>`).join('')}</div>
      <div class="pv-kit-list">${(cur0.cards || []).map((c, i) => `<button type="button" class="pv-kit-p" data-kit-ins="${esc(cur0.id)}|${i}" title="Вставить в текст: ${esc(c.no)}">
        <span class="pv-kit-no" lang="nb">${esc(c.no)}</span><span class="pv-kit-ru">${esc(c.ru)}</span>${c.description ? `<span class="pv-kit-note">${esc(String(c.description).split('\n')[0])}</span>` : ''}</button>`).join('')}</div>`;
  }
  function kitBodyHtml(ctx, base, it, text) {
    const K = kitState(ctx, base, it), g = GENRES[K.genre] || GENRES.story;
    return `<div class="pv-kit-head"><b>🧰 Шаблон и фразы</b><span class="pv-muted">Нажмите на фразу — она встанет в текст там, где курсор. «…» — место для ваших слов. На оценку не влияет.</span></div>
      <div class="pv-kit-genres" role="group" aria-label="Какой это текст">${Object.entries(GENRES).map(([id, x]) => `<button type="button" class="pv-kit-genre ${id === K.genre ? 'on' : ''}" data-kit-genre="${id}" aria-pressed="${id === K.genre}" title="План и фразы для текста: ${esc(x.ru.toLowerCase())}">${x.ico} ${esc(x.ru)}</button>`).join('')}</div>
      <ol class="pv-kit-plan">${g.plan.map(p => `<li><b lang="nb">${esc(p[0])}</b> <span class="pv-muted">— ${esc(p[1])}</span>${p[2] ? `<div class="pv-kit-eg" lang="nb">${esc(p[2])}</div>` : ''}</li>`).join('')}</ol>
      <div class="pv-kit-phr" data-kit-phr>${kitPhrasesHtml(K)}</div>
      <details class="pv-kit-check"><summary>✅ Проверьте себя: порядок слов и связки</summary>
        <ul>${KIT_CHECK.concat(K.genre === 'msg' ? ['Есть приветствие, ответы на <b>все</b> вопросы задания и подпись?'] : []).map(x => `<li>${x}</li>`).join('')}</ul>
        <p class="pv-kit-conn" data-kit-conn>${connLine(text)}</p></details>`;
  }
  function kitHtml(ctx, base, it, text) {
    const K = kitState(ctx, base, it);
    if (K.open && !PHR) loadPhrases().then(() => kitRefresh(ctx, base));
    return `<div class="pv-kit-bar"><button type="button" class="btn sm ${K.open ? '' : 'ghost'} pv-kit-btn" data-kit="${esc(base)}" aria-expanded="${K.open}" title="План текста и готовые фразы: нажмите — фраза встанет в текст">🧰 Шаблон и фразы</button></div>
      <div class="pv-kit" data-kit-box="${esc(base)}" ${K.open ? '' : 'hidden'}>${K.open ? kitBodyHtml(ctx, base, it, text) : ''}</div>`;
  }
  function kitRefresh(ctx, base) {
    if (!ctx.alive() || !ctx.sec) return;
    const box = ctx.body.querySelector(`[data-kit-box="${cssEsc(base)}"]`), it = itemOfKey(ctx, base);
    if (!box || !it) return;
    const K = kitState(ctx, base, it), btn = ctx.body.querySelector(`[data-kit="${cssEsc(base)}"]`);
    box.hidden = !K.open;
    if (btn) { btn.setAttribute('aria-expanded', K.open); btn.classList.toggle('ghost', !K.open); }
    const det = box.querySelector('.pv-kit-check'), wasOpen = !!(det && det.open);
    box.innerHTML = K.open ? kitBodyHtml(ctx, base, it, (ctx.run.a[base] || {}).text || '') : '';
    if (wasOpen) { const d2 = box.querySelector('.pv-kit-check'); if (d2) d2.open = true; }
    if (K.open && !PHR) loadPhrases().then(j => { if (j) kitRefresh(ctx, base); else { const ph = box.querySelector('[data-kit-phr]'); if (ph) ph.innerHTML = '<p class="pv-muted pv-small">Фразы сейчас не загрузились — проверьте интернет и откройте «🧰 Шаблон и фразы» ещё раз. План выше работает и так.</p>'; } });
  }
  /** a phrase into the text: at the cursor (or the end), «…» = where the cursor stays; a capital letter at the start of a sentence */
  function kitInsert(ctx, base, phrase) {
    const ta = ctx.body.querySelector(`[data-wtext="${cssEsc(base)}"]`); if (!ta) return;
    const v = ta.value, saved = (ctx.kitCaret || {})[base];
    let s = v.length, e = v.length;
    if (doc.activeElement === ta) { s = ta.selectionStart; e = ta.selectionEnd; } else if (saved) { s = Math.min(saved[0], v.length); e = Math.min(saved[1], v.length); }
    let before = v.slice(0, s);
    const after = v.slice(e);
    const startOfSentence = !before.trim() || /[.!?:]\s*$/.test(before) || /\n\s*$/.test(before);
    let ph = String(phrase);
    // «… fordi …», «…, men …» in the middle of a sentence: the first «…» is what is already written
    if (/^…/.test(ph) && !startOfSentence) ph = ph.slice(1);
    const k = ph.indexOf('…');
    let a = k < 0 ? ph + ' ' : ph.slice(0, k), b = k < 0 ? '' : ph.slice(k + 1);
    if (/^[,.!?]/.test(a || b)) before = before.replace(/\s+$/, ''); // the comma sticks to the word before it
    else a = a.replace(/^\s+/, '');
    // a capital letter at the start of a sentence — not when the learner's own words come first («… er et tema som …»)
    if (startOfSentence && a.trim()) a = a.replace(/^([a-zæøå])/, ch => ch.toUpperCase());
    const pre = before && !/\s$/.test(before) && !/^[,.!?]/.test(a || b) ? ' ' : '';
    const post = after && !/^[\s,.!?]/.test(after) && !/\s$/.test(a + b) ? ' ' : '';
    ta.value = before + pre + a + b + post + after;
    const caret = (before + pre + a).length;
    try { ta.focus({ preventScroll: true }); } catch (err) { ta.focus(); }
    try { ta.setSelectionRange(caret, caret); } catch (err) { /* old browser */ }
    (ctx.kitCaret || (ctx.kitCaret = {}))[base] = [caret, caret];
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    try { ta.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); } catch (err) { /* ignore */ }
    live(ctx, 'Фраза вставлена в текст');
  }
  /** the learner's text with the problem places marked (each mark is a button → its explanation) */
  function markedHtml(text, errors) {
    const marks = errors.map((e, i) => Object.assign({ i }, e)).filter(e => Number.isInteger(e.s) && Number.isInteger(e.e) && e.e > e.s && e.e <= text.length)
      .sort((a, b) => a.s - b.s);
    let out = '', at = 0;
    const plain = s => esc(s).replace(/\n/g, '<br>');
    marks.forEach(m => {
      if (m.s < at) return;
      out += plain(text.slice(at, m.s));
      out += `<button type="button" class="pv-hl pv-hl-${esc(m.kind)}" data-err="${m.i}" aria-label="Ошибка ${m.i + 1}: ${esc(m.frag)}. Нажмите — объяснение">${plain(text.slice(m.s, m.e))}<sup aria-hidden="true">${m.i + 1}</sup></button>`;
      at = m.e;
    });
    return out + plain(text.slice(at));
  }
  const KIND_RU = { order: 'порядок слов', grammar: 'грамматика', vocab: 'слово', spelling: 'написание', mech: 'написание' };
  function gradeHtml(it, g, w, stale) {
    const pct = Math.round(g.total / GRADE_MAX * 100), cls = pct >= 80 ? 'hi' : pct >= 55 ? 'mid' : 'lo';
    const approx = g.by !== 'ai', spk = g.mode === 'speak';
    const crit = critsOf(g).map(c => {
      const v = g.crit[c.id] || 0;
      return `<li class="pv-crit-row"><span class="pv-crit-name">${esc(c.ru)}${approx && g.notes && g.notes[c.id] ? `<small class="pv-muted">${esc(g.notes[c.id])}</small>` : ''}</span>
        <span class="pv-dots" aria-hidden="true">${Array.from({ length: c.max }, (_, k) => `<i class="${k < v ? 'on' : ''}"></i>`).join('')}</span><b>${v} из ${c.max}</b></li>`;
    }).join('');
    const errs = arr(g.errors);
    const errList = errs.map((e, i) => `<li><button type="button" class="pv-err-item" data-err="${i}" ${Number.isInteger(e.s) ? '' : 'data-nomark="1"'}>
        <span class="pv-n sm">${i + 1}</span><span class="pv-err-body"><span><s lang="nb">${esc(e.frag)}</s> → <b lang="nb">${esc(e.fix)}</b> <span class="pv-err-kind">${esc(KIND_RU[e.kind] || '')}</span></span>${e.why ? `<span class="pv-muted">${esc(e.why)}</span>` : ''}</span></button></li>`).join('');
    const label = approx
      ? `<span class="pv-tag warn">оценка примерная — для точной проверки подключите нейросеть</span>`
      : `<span class="pv-tag good">оценка нейросети</span>`;
    const what = spk ? 'ответ' : 'текст';
    return `<section class="pv-grade ${stale ? 'stale' : ''}" aria-label="Оценка: ${what}">
      ${g.fallback ? `<p class="pv-grade-note" role="status">🤖 Нейросеть сейчас не ответила — показываю примерную оценку. Нажмите «Оценить ${what}» ещё раз чуть позже.</p>` : ''}
      <p class="pv-grade-stale" role="status">✏️ ${spk ? 'Ответ' : 'Текст'} изменился — нажмите «Оценить ${what}», чтобы оценить новую версию.</p>
      <div class="pv-grade-head">
        <div class="pv-ring big pv-grade-ring ${cls}" style="--p:${pct}"><b>${g.total}</b><small>из ${GRADE_MAX}</small></div>
        <div class="pv-grade-msg">
          <div class="pv-grade-lvl"><span class="pv-level" title="Примерный уровень по шкале CEFR">${esc(g.cefr || '—')}</span><span class="pv-muted">примерный уровень</span></div>
          ${g.teacher ? `<p class="pv-teacher" lang="nb">«${esc(g.teacher)}»</p>` : ''}
          ${g.summary ? `<p class="pv-grade-sum">${esc(g.summary)}</p>` : ''}
          ${label}
        </div>
      </div>
      <ul class="pv-crit">${crit}</ul>
      ${arr(g.good).length ? `<div class="pv-ai-good"><b>👍 Получилось:</b><ul>${arr(g.good).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      <div class="pv-marked-wrap"><div class="pv-marked-lbl"><b>${spk ? 'Ваш ответ' : 'Ваш текст'}</b> ${errs.some(e => Number.isInteger(e.s)) ? '<span class="pv-muted">— нажмите на подчёркнутое, чтобы увидеть объяснение</span>' : ''}</div>
        <p class="pv-marked" lang="nb">${markedHtml(g.text || '', errs)}</p>
        <div class="pv-err-detail" data-err-detail aria-live="polite" hidden></div></div>
      ${errs.length ? `<div class="pv-errs-wrap"><b>✏️ ${approx ? 'Что стоит проверить' : 'Исправления'} (${errs.length}):</b><ol class="pv-errs">${errList}</ol></div>`
        : `<p class="pv-muted">${approx ? 'Программа не нашла типичных ошибок. Но она проверяет не всё — сравните с образцом.' : 'Ошибок не найдено. 🎉'}</p>`}
      ${g.corrected ? `<details class="pv-ai-better"><summary>Исправленный текст</summary><p lang="nb">${esc(g.corrected)}</p></details>` : ''}
      ${spk ? speakModelHtml(it, w, approx) : approx ? selfCheckHtml(it, w) : it.model ? `<details class="pv-ai-better"><summary>📖 Образец</summary><p lang="nb">${esc(it.model)}</p></details>` : ''}
    </section>`;
  }
  const CHECKLIST = [
    'В обычном предложении глагол стоит на 2-м месте: «I dag <b>går</b> jeg…», а не «I dag jeg går…».',
    'В придаточном (at, som, fordi, når, hvis) — сначала подлежащее, потом ikke, потом глагол: «…fordi hun <b>ikke er</b> syk».',
    '<b>sin / si / sitt / sine</b> — если владелец = подлежащее: «Anna elsker barna <b>sine</b>». В подлежащем — hans / hennes.',
    '<b>synes at</b> — моё мнение, <b>tror at</b> — я не уверен(а), предполагаю.',
    'Артикли и формы: en gutt — gutten — gutter — guttene; ei jente — jenta; et barn — barnet — barn — barna.',
    'После kan / vil / skal / må и после å — инфинитив: «vil <b>spise</b>», «å <b>gå</b>».',
    'Каждое предложение — с большой буквы и с точкой в конце.',
  ];
  function selfCheckHtml(it, w) {
    return `<div class="pv-self">
      ${it.model ? `<div class="pv-model"><b>📖 Образец</b> <span class="pv-muted">(один из многих возможных текстов)</span><p lang="nb">${esc(it.model)}</p></div>` : ''}
      <div class="pv-checklist"><b>✅ Проверьте себя:</b><ul>${CHECKLIST.concat(arr(it.checklist)).map((c, i) => `<li><label><input type="checkbox" data-wcheck="${i}" ${w.checks && w.checks[i] ? 'checked' : ''}> <span>${c}</span></label></li>`).join('')}</ul></div>
    </div>`;
  }
  function aiPrompt(it, text) {
    const system = 'Ты — строгий, но доброжелательный экзаменатор норвежского языка (букмол) для взрослых русскоязычных учеников, курс уровня A2 (как Norskprøve). Ты оцениваешь письменные работы по шкале 0–12. Отвечай ТОЛЬКО одним JSON-объектом, без текста вокруг и без markdown.';
    const user = `Задание (по-норвежски): «${it.prompt || ''}»${it.promptRu ? `\nПеревод задания: «${it.promptRu}»` : ''}
Желательный объём: от ${it.minWords || 40} слов. В тексте ученика ${wordCount(text)} слов.
Текст ученика:
"""
${text.slice(0, 4000)}
"""
Оцени текст по 5 критериям (целые числа):
- task (0–3): задание выполнено, тема раскрыта, ответы на вопросы задания, достаточный объём;
- vocab (0–2): словарный запас — разнообразие и точность слов;
- syntax (0–3): построение предложений и порядок слов — V2 (глагол на 2-м месте, инверсия после обстоятельства: «I dag går jeg»), придаточные (подлежащее → ikke → глагол: «fordi jeg ikke har tid»), сложные предложения;
- grammar (0–2): артикли и род, формы существительных и глаголов, sin / hans, согласование прилагательных;
- coherence (0–2): связность — слова-связки (og, men, fordi, derfor, først, etterpå…), логичный порядок мыслей.
Уровень CEFR — одно из: "A1", "A2", "A2+", "B1".
Верни JSON строго такого вида:
{"scores":{"task":0,"vocab":0,"syntax":0,"grammar":0,"coherence":0},"cefr":"A2","errors":[{"frag":"дословный фрагмент из текста ученика","fix":"исправленный фрагмент по-норвежски","why":"одна короткая строка по-русски: какое правило","kind":"order"}],"corrected":"весь текст ученика, исправленный по-норвежски (сохрани его мысли)","teacher":"одна короткая тёплая фраза учителя по-норвежски, например: Kjempefin tekst! Du er flink til å fortelle!","summary":"2–3 простых предложения по-русски: общее впечатление и главное, над чем работать","good":["что получилось хорошо — по-русски, 1–3 пункта"]}
kind — одно из: "order" (порядок слов), "grammar", "vocab", "spelling".
Правила: "frag" копируй из текста ученика буква в букву, чтобы его можно было найти и подсветить; не больше 12 самых важных ошибок; если ошибок нет — пустой массив; не придумывай ошибок и не исправляй то, что верно.`;
    return { system, user };
  }
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
  /** «Оценить текст»: the AI if connected (any failure → the offline grade, quietly), else the offline grade */
  async function gradeWrite(ctx, base, box) {
    const sec = ctx.sec, it = sec.items.find(x => sec.id + '.' + x.id === base); if (!it) return;
    const run = ctx.run;
    const w = run.a[base] = Object.assign({}, run.a[base] || {});
    const text = String(w.text || '');
    if (wordCount(text) < 3) return;
    const spk = it.type === 'speak';
    let g = null, fallback = false;
    if (aiReady()) {
      const out = box && box.querySelector('[data-grade-out]');
      if (out) out.innerHTML = `<div class="pv-ai pv-ai-wait" role="status"><span class="spinner sm"></span> Нейросеть читает ваш ${spk ? 'ответ' : 'текст'} и ставит оценку…</div>`;
      try {
        const { system, user } = spk ? aiSpeakPrompt(it, text) : aiPrompt(it, text);
        const raw = await withTimeout(AI.call({ system, user, maxTokens: 2600, temperature: 0.2, quiet: true }), 90000);
        let j = null;
        try { j = AI.parseJSON ? AI.parseJSON(raw) : null; } catch (e) { j = null; }
        if (!j || typeof j !== 'object') j = parseLoose(raw);
        g = normAiGrade(j, text, spk ? 'speak' : 'write');
      } catch (e) { g = null; }
      if (!g) fallback = true;
    }
    if (!g) { g = spk ? gradeOffline(text, Object.assign({ minWords: it.level === 'A1' ? 25 : 40 }, it), { speech: true }) : gradeOffline(text, it); if (fallback) g.fallback = true; }
    w.grade = g; w.level = g.cefr; w.levelBy = g.by === 'ai' ? 'ai' : 'auto';
    run.a[base] = w; run.at = Date.now();
    // the best grade per task (this device)
    const k = wKey(ctx, base), best = st().wbest[k];
    if (!best || g.total > best.total || (g.total === best.total && g.by === 'ai' && best.by !== 'ai')) st().wbest[k] = { total: g.total, cefr: g.cefr, by: g.by, at: Date.now() };
    save();
    if (ctx.alive() && ctx.sec === sec && ctx.view === 'test') {
      renderSection(ctx);
      const out = ctx.body.querySelector(`[data-write="${cssEsc(base)}"] .pv-grade`);
      if (out && out.scrollIntoView) out.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      live(ctx, `Оценка: ${g.total} из ${GRADE_MAX}, уровень ${g.cefr}`);
    }
  }
  /** a click on a marked place (or on the list): its explanation under the text */
  function showErr(ctx, btn) {
    const box = btn.closest('[data-write]'); if (!box) return;
    const w = ctx.run.a[box.dataset.write] || {}, g = w.grade; if (!g) return;
    const i = +btn.dataset.err, e = arr(g.errors)[i]; if (!e) return;
    const det = box.querySelector('[data-err-detail]');
    const was = det && !det.hidden && det.dataset.i === String(i);
    box.querySelectorAll('[data-err]').forEach(x => { const on = !was && +x.dataset.err === i; x.classList.toggle('on', on); if (x.classList.contains('pv-hl')) x.setAttribute('aria-expanded', on); });
    if (!det) return;
    if (was) { det.hidden = true; det.dataset.i = ''; return; }
    det.dataset.i = String(i); det.hidden = false;
    det.innerHTML = `<span class="pv-n sm">${i + 1}</span><div><div><s lang="nb">${esc(e.frag)}</s> → <b lang="nb">${esc(e.fix)}</b></div>${e.why ? `<div class="pv-rule">💡 ${esc(e.why)}</div>` : ''}</div>`;
    // from the list: show the place in the text
    if (btn.classList.contains('pv-err-item')) {
      const hl = box.querySelector(`.pv-hl[data-err="${i}"]`);
      if (hl && hl.scrollIntoView) hl.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    }
  }

  /* ---------- speaking (Muntlig): timers, the answer by voice or typed, a 12-point grade ---------- */
  const mmss = sec => { sec = Math.max(0, Math.ceil(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
  const prepOf = it => (it.prepSec != null ? Math.max(0, +it.prepSec || 0) : it.level === 'A1' ? 30 : 60);
  const talkOf = it => Math.max(20, +it.speakSec || (it.level === 'A1' ? 60 : 120));
  const SRC_ = () => root.SpeechRecognition || root.webkitSpeechRecognition;
  const hasGum = () => { try { return !!(root.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); } catch (e) { return false; } };
  function speakHtml(ctx, sec, it) {
    const base = sec.id + '.' + it.id, w = ctx.run.a[base] || {};
    const text = w.text || '', words = wordCount(text);
    const ai = aiReady();
    const best = st().wbest[wKey(ctx, base)];
    const g = w.grade && typeof w.grade === 'object' && w.grade.crit ? w.grade : null;
    const stale = g && g.text !== text;
    const ask = arr(it.ask);
    return `<div class="pv-item pv-write pv-speak" data-write="${esc(base)}" data-speak="${esc(base)}">
      ${it.picture ? `<div class="pv-picwrap">${pictureHtml(it.picture)}</div>` : ''}
      <div class="pv-task">
        <div class="pv-task-lbl"><span aria-hidden="true">🗣</span> <span lang="nb">Oppgave${sec.items.length > 1 ? ' ' + esc(it.id) : ''}</span>${it.mode === 'pair' ? ' <span class="pv-tag">разговор с партнёром</span>' : ''}</div>
        ${it.prompt ? `<p class="pv-task-no" lang="nb">${esc(it.prompt)}</p>` : ''}
        ${ask.length ? `<div class="pv-ask"><span class="pv-muted">${it.mode === 'pair' ? 'Партнёр / экзаменатор может спросить:' : 'Помогут вопросы:'}</span><ul lang="nb">${ask.map(q => `<li>${esc(q)}</li>`).join('')}</ul></div>` : ''}
        ${it.scene ? `<div class="pv-scene"><b>🖼 На картинке:</b> ${esc(it.scene)}</div>` : ''}
        ${it.promptRu ? (w.tr ? `<p class="pv-task-ru"><span class="pv-muted">Перевод:</span> ${esc(it.promptRu)}</p>`
          : `<button type="button" class="btn sm ghost pv-tr" data-tr="${esc(base)}" title="Покажет задание по-русски — будет отмечено «с подсказками»">🌐 Перевести задание</button>`) : ''}
      </div>
      <div class="pv-sp-panel" data-sp-panel="${esc(base)}">${spPanelHtml(ctx, it, base)}</div>
      <label class="pv-sp-lbl" for="pv-sp-${esc(base)}"><b>Ваш ответ</b> <span class="pv-muted">— сюда попадает распознанная речь; можно и печатать (по-норвежски)</span></label>
      <textarea class="input pv-textarea pv-sp-text" id="pv-sp-${esc(base)}" data-wtext="${esc(base)}" rows="6" lang="nb" spellcheck="false" autocapitalize="sentences" placeholder="Нажмите 🎙 и говорите — или напишите ответ здесь…">${esc(text)}</textarea>
      <div class="pv-write-bar"><span class="pv-muted" data-wcount>${countLine(words, it)}</span>
        ${best ? `<span class="pv-tag good">Лучшая оценка: ${best.total}/${GRADE_MAX} · ${esc(best.cefr || '')}</span>` : ''}</div>
      <div class="pv-write-btns">
        <button type="button" class="btn ${ai ? 'ai' : 'primary'}" data-grade="${esc(base)}" ${words < 3 ? 'disabled' : ''}>${ai ? '✨ Оценить ответ (нейросеть)' : '📊 Оценить ответ'}</button>
        ${it.model && !g && !w.model ? `<button type="button" class="btn ghost" data-show-model="${esc(base)}" title="Покажет образец — будет отмечено «с подсказками»">📖 Образец ответа</button>` : ''}
      </div>
      ${it.model && !g && w.model ? speakModelHtml(it, w, true, true) : ''}
      ${!ai && !g ? '<p class="pv-muted pv-small">Без нейросети оценка примерная: программа проверит длину ответа, порядок слов, артикли и формы глаголов. Для точной проверки подключите нейросеть в Настройках.</p>' : ''}
      <div class="pv-grade-out" data-grade-out>${g ? gradeHtml(it, g, w, stale) : ''}</div>
    </div>`;
  }
  /** the timers and the microphone of one speaking task (re-drawn on its own — the typed text is never touched) */
  function spPanelHtml(ctx, it, base) {
    const t = ctx.sp && ctx.sp.key === base ? ctx.sp : null;
    const m = ctx.mic && ctx.mic.key === base ? ctx.mic : null;
    const prep = prepOf(it), talk = talkOf(it);
    const left = t ? (t.end - Date.now()) / 1000 : 0;
    let timer;
    if (!t || t.phase === 'done') {
      timer = `<div class="pv-sp-timer">
        <div class="pv-sp-plan"><span class="pv-sp-ico" aria-hidden="true">⏱</span><span>${prep ? `Подготовка <b>${mmss(prep)}</b> → ` : ''}ответ <b>${mmss(talk)}</b><small class="pv-muted">как на устном экзамене</small></span></div>
        ${t && t.phase === 'done' ? `<p class="pv-sp-done" role="status">✓ ${t.timeUp ? 'Время ответа закончилось.' : 'Ответ закончен.'} Проверьте текст ниже и нажмите «Оценить ответ».</p>` : ''}
        <button type="button" class="btn primary pv-sp-go" data-sp-go="${esc(base)}">${t ? '↺ Ещё раз с таймером' : prep ? '▶ Начать: подготовка' : '▶ Начать ответ'}</button>
      </div>`;
    } else {
      const total = t.phase === 'prep' ? t.prep : t.talk, pct = Math.max(0, Math.min(100, (1 - left / total) * 100));
      timer = `<div class="pv-sp-timer on ${t.phase}">
        <div class="pv-sp-clock" style="--p:${pct.toFixed(1)}" aria-hidden="true"><b data-sp-time>${mmss(left)}</b></div>
        <div class="pv-sp-now">
          <b>${t.phase === 'prep' ? '🧠 Подготовка' : '🗣 Говорите!'}</b>
          <span class="pv-muted">${t.phase === 'prep' ? 'Продумайте, что скажете: 3–4 мысли и слова к ним. Записывать ничего не нужно.' : m && m.state === 'rec' ? 'Говорите спокойно, полными предложениями.' : 'Нажмите 🎙, чтобы говорить, — или печатайте ответ ниже.'}</span>
          <span class="pv-sr" data-sp-sr>${t.phase === 'prep' ? 'Подготовка' : 'Ответ'}: осталось ${mmss(left)}</span>
        </div>
        ${t.phase === 'prep' ? `<button type="button" class="btn primary" data-sp-skip="${esc(base)}">🎙 Я готов(а) — говорить</button>`
          : `<button type="button" class="btn" data-sp-end="${esc(base)}">■ Закончить ответ</button>`}
      </div>`;
    }
    const recOn = m && m.state === 'rec', busy = m && (m.state === 'starting' || m.pending > 0 || m.state === 'stopping');
    const note = m && m.interim ? `🎙 <span lang="nb">${esc(m.interim)}</span>`
      : m && m.state === 'starting' ? '⏳ Включаю микрофон…'
        : m && m.pending > 0 ? '⏳ Распознаю речь…' + (recOn ? ' Можно говорить дальше.' : '')
          : recOn ? (m.engine === 'browser' ? '🎙 Слушаю… (распознаёт браузер)' : '🎙 Слушаю… Каждая фраза появится в поле ниже после паузы.')
            : ctx.micNote ? esc(ctx.micNote) : 'Нажмите 🎙 и говорите по-норвежски. Нет микрофона — просто напишите ответ.';
    const mic = `<div class="pv-sp-mic ${recOn ? 'rec' : ''}">
        <button type="button" class="btn ${recOn ? 'bad' : ''} pv-sp-micbtn" data-sp-mic="${esc(base)}" aria-pressed="${!!recOn}" ${m && m.state === 'starting' ? 'disabled' : ''}>
          <span class="pv-sp-dot" aria-hidden="true" style="--lv:${m && m.level ? m.level.toFixed(2) : 0}"></span>${recOn ? '■ Остановить запись' : '🎙 Говорить'}</button>
        <span class="pv-sp-status ${busy ? 'busy' : ''}" role="status" data-sp-status>${note}</span>
      </div>
      ${ctx.micDenied ? `<div class="pv-sp-denied" role="note">🎙 <b>Микрофон не разрешён</b> — ничего страшного: напишите ответ в поле ниже, оценка работает так же. Чтобы отвечать голосом, разрешите микрофон для этого сайта в настройках браузера и нажмите «🎙 Говорить» ещё раз.</div>` : ''}
      ${m && m.engine === 'browser' && recOn ? '<p class="pv-muted pv-small">🌐 Распознаёт браузер — звук может отправляться на сервер Google / Apple.</p>' : ''}`;
    return timer + mic;
  }
  function spPaint(ctx, key) {
    if (!ctx.alive || !ctx.alive() || ctx.view !== 'test' || !ctx.sec) return;
    ctx.body.querySelectorAll('[data-sp-panel]').forEach(box => {
      if (key && box.dataset.spPanel !== key) return;
      const it = itemOfKey(ctx, box.dataset.spPanel); if (!it) return;
      const had = doc.activeElement && box.contains(doc.activeElement) ? doc.activeElement.getAttribute('data-sp-go') != null ? '[data-sp-go]' : [...doc.activeElement.attributes].map(a => a.name).find(n => /^data-sp-/.test(n)) : null;
      box.innerHTML = spPanelHtml(ctx, it, box.dataset.spPanel);
      // the focus stays on the panel (the button changed under the finger / the keyboard)
      if (had) { const el = box.querySelector(`[${had.replace(/^\[|\]$/g, '')}]`) || box.querySelector('button'); if (el) try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    });
  }
  /** a light repaint every tick: only the numbers (the screen reader is not flooded) */
  function spPaintTime(ctx) {
    const t = ctx.sp; if (!t || !ctx.alive() || ctx.view !== 'test') return;
    const box = ctx.body.querySelector(`[data-sp-panel="${cssEsc(t.key)}"]`); if (!box) return;
    const left = (t.end - Date.now()) / 1000, total = t.phase === 'prep' ? t.prep : t.talk;
    const b = box.querySelector('[data-sp-time]'); if (b) b.textContent = mmss(left);
    const c = box.querySelector('.pv-sp-clock'); if (c) c.style.setProperty('--p', Math.max(0, Math.min(100, (1 - left / total) * 100)).toFixed(1));
    const sr = box.querySelector('[data-sp-sr]'); if (sr && Math.ceil(left) % 30 === 0) sr.textContent = `${t.phase === 'prep' ? 'Подготовка' : 'Ответ'}: осталось ${mmss(left)}`;
    const dot = box.querySelector('.pv-sp-dot'); if (dot && ctx.mic && ctx.mic.key === t.key) dot.style.setProperty('--lv', (ctx.mic.level || 0).toFixed(2));
  }
  /** the audio context must be made inside a tap (iPhone, Chrome): made at «Начать» / «🎙» and kept for the later start */
  function primeAudio(ctx) {
    try {
      const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return;
      if (!ctx.ac || ctx.ac.state === 'closed') ctx.ac = new AC();
      if (ctx.ac.state === 'suspended') ctx.ac.resume().catch(() => {});
    } catch (e) { ctx.ac = null; }
  }
  async function micBlocked() {
    try { if (root.navigator && navigator.permissions && navigator.permissions.query) { const p = await navigator.permissions.query({ name: 'microphone' }); return p.state === 'denied'; } } catch (e) { /* not supported: just try */ }
    return false;
  }
  /** 'whisper' (NB-Whisper on the device) | 'browser' (webkitSpeechRecognition) | 'cancel' | null — as «🗣 Речь» chooses */
  async function pickEngine(ctx) {
    if (ctx.engine) return ctx.engine;
    const S = root.Speech;
    if (S && S.asrReady && hasGum()) { try { if (await S.asrReady()) return (ctx.engine = 'whisper'); } catch (e) { /* go on */ } }
    if (SRC_() && root.Store && Store.settings && Store.settings.speechAsr === 'browser') return (ctx.engine = 'browser');
    if (S && S.consent && S.asrInfo && hasGum() && typeof WebAssembly === 'object' && 'caches' in root) {
      try {
        const info = await S.asrInfo();
        const r = await S.consent(info.group, { lead: '🗣 Чтобы отвечать голосом, нужно распознавание норвежской речи.', reason: 'Не хотите скачивать — просто напишите ответ в поле под заданием.' });
        if (r === true) return (ctx.engine = 'whisper');
        if (r === 'browser' && SRC_()) return (ctx.engine = 'browser');
        return 'cancel';
      } catch (e) { /* the dialog failed — the browser's own recognition, if any */ }
    }
    return SRC_() ? (ctx.engine = 'browser') : null;
  }
  /** the recognised words go to the end of the answer (saved at once) */
  function appendText(ctx, run, key, t) {
    t = String(t || '').replace(/\s+/g, ' ').trim(); if (!t || !run) return;
    const w = Object.assign({}, run.a[key] || {}), cur = String(w.text || '');
    w.text = (cur && !/\s$/.test(cur) ? cur + ' ' : cur) + t;
    run.a[key] = w; run.at = Date.now(); save();
    if (ctx.run !== run || !ctx.alive() || ctx.view !== 'test') return;
    const ta = ctx.body.querySelector(`[data-wtext="${cssEsc(key)}"]`);
    if (ta) { ta.value = w.text; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.scrollTop = ta.scrollHeight; }
  }
  async function micStart(ctx, key) {
    if (ctx.mic) return;
    const run = ctx.run;
    const m = ctx.mic = { key, state: 'starting', pending: 0, level: 0, interim: '', run };
    ctx.micNote = ''; spPaint(ctx, key);
    const fail = (note, denied) => {
      if (ctx.mic === m) ctx.mic = null;
      if (denied) ctx.micDenied = true;
      ctx.micNote = note || '';
      spPaint(ctx, key);
      if (denied || note) { const ta = ctx.alive() && ctx.body.querySelector(`[data-wtext="${cssEsc(key)}"]`); if (ta && denied) try { ta.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    };
    if (await micBlocked()) { fail('', true); return; }
    const eng = await pickEngine(ctx);
    if (ctx.mic !== m) return;
    if (eng === 'cancel') { fail('Хорошо — напишите ответ в поле ниже. Голосом можно позже: нажмите «🎙 Говорить».'); return; }
    if (!eng) { fail('В этом браузере нет распознавания речи — напишите ответ в поле ниже.'); return; }
    m.engine = eng;
    try {
      if (eng === 'whisper') await whisperStart(ctx, m); else browserStart(ctx, m);
      if (ctx.mic !== m) return;
      m.state = 'rec'; ctx.micDenied = false; spPaint(ctx, key);
      live(ctx, 'Запись идёт — говорите');
    } catch (e) {
      micRelease(m);
      const n = e && e.name;
      if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') fail('', true);
      else if (n === 'NotFoundError' || n === 'OverconstrainedError') fail('Микрофон не найден — напишите ответ в поле ниже.');
      else fail('Микрофон сейчас не включился — напишите ответ в поле ниже или попробуйте ещё раз.');
    }
  }
  /** NB-Whisper on the device: the microphone without a break, cut into phrases at the pauses, each phrase recognised in turn */
  async function whisperStart(ctx, m) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    m.stream = stream;
    if (ctx.mic !== m) { micRelease(m); return; }
    primeAudio(ctx);
    const ac = ctx.ac; if (!ac) throw new Error('no audio');
    if (ac.state === 'suspended') { try { await ac.resume(); } catch (e) { /* ignore */ } }
    const src = ac.createMediaStreamSource(stream), proc = ac.createScriptProcessor(4096, 1, 1);
    Object.assign(m, { src, proc, rate: ac.sampleRate, seg: [], segLen: 0, speech: false, quiet: 0, peak: 0, queue: Promise.resolve() });
    proc.onaudioprocess = e => {
      if (ctx.mic !== m || m.state === 'stopping') return;
      const d = e.inputBuffer.getChannelData(0);
      m.seg.push(new Float32Array(d)); m.segLen += d.length;
      let s2 = 0; for (let i = 0; i < d.length; i++) s2 += d[i] * d[i];
      const rms = Math.sqrt(s2 / d.length), ms = d.length / m.rate * 1000;
      m.level = Math.min(1, rms * 12);
      if (rms > 0.02) { m.speech = true; m.quiet = 0; m.peak = Math.max(m.peak, rms); } else if (rms < 0.012) m.quiet += ms;
      const dur = m.segLen / m.rate;
      if ((m.speech && dur > 3 && m.quiet > 900) || dur > 24) cutSeg(ctx, m);
      else if (!m.speech && dur > 3) { const last = m.seg[m.seg.length - 1]; m.seg = [last]; m.segLen = last.length; m.quiet = 0; } // only silence so far
      if (!ctx.sp || ctx.sp.key !== m.key) { const dot = ctx.body.querySelector(`[data-sp-panel="${cssEsc(m.key)}"] .pv-sp-dot`); if (dot) dot.style.setProperty('--lv', m.level.toFixed(2)); }
    };
    src.connect(proc); proc.connect(ac.destination);
  }
  function cutSeg(ctx, m) {
    const chunks = m.seg, rate = m.rate, had = m.speech && m.peak >= 0.015;
    m.seg = []; m.segLen = 0; m.speech = false; m.quiet = 0; m.peak = 0;
    if (!had || !chunks.length) return;
    m.pending++; spPaint(ctx, m.key);
    m.queue = m.queue.then(async () => {
      try {
        const pcm = await Speech.toMono16k(chunks, rate);
        if (pcm.length >= 16000 * 0.4) { const t = await Speech.transcribe(pcm); if (t) appendText(ctx, m.run, m.key, t); }
      } catch (e) { m.failed = (m.failed || 0) + 1; console.warn('prove: speech', e); }
      finally { m.pending--; micMaybeDone(ctx, m); spPaint(ctx, m.key); }
    });
  }
  /** the browser's own recognition (Chrome / Safari), restarted when it stops by itself while the answer goes on */
  function browserStart(ctx, m) {
    const S = SRC_(); if (!S) throw new Error('no recognition');
    const sr = new S(); m.sr = sr;
    sr.lang = 'nb-NO'; sr.continuous = true; sr.interimResults = true; sr.maxAlternatives = 1;
    sr.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) appendText(ctx, m.run, m.key, r[0].transcript); else interim += r[0].transcript; }
      m.interim = interim.trim();
      const el = ctx.alive() && ctx.body.querySelector(`[data-sp-panel="${cssEsc(m.key)}"] [data-sp-status]`);
      if (el) el.innerHTML = m.interim ? `🎙 <span lang="nb">${esc(m.interim)}</span>` : '🎙 Слушаю… (распознаёт браузер)';
    };
    sr.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') m.denied = true;
      else if (e.error !== 'no-speech' && e.error !== 'aborted') m.err = true;
    };
    sr.onend = () => {
      m.interim = '';
      if (ctx.mic === m && m.state === 'rec' && !m.denied && !m.err && (m.restarts = (m.restarts || 0) + 1) < 40) { try { sr.start(); return; } catch (e) { /* ended for good */ } }
      if (ctx.mic === m) {
        ctx.mic = null;
        if (m.denied) ctx.micDenied = true;
        else if (m.err) ctx.micNote = 'Распознавание речи сейчас не работает (нет связи?) — напишите ответ в поле ниже.';
        spPaint(ctx, m.key);
      }
    };
    sr.start();
  }
  function micRelease(m) {
    try { if (m.proc) { m.proc.onaudioprocess = null; m.proc.disconnect(); } if (m.src) m.src.disconnect(); } catch (e) { /* ignore */ }
    try { if (m.stream) m.stream.getTracks().forEach(t => t.stop()); } catch (e) { /* ignore */ }
    m.proc = null; m.src = null; m.stream = null;
  }
  function micMaybeDone(ctx, m) { if (m.state === 'stopping' && !m.pending && ctx.mic === m) { ctx.mic = null; if (m.failed && !ctx.micNote) ctx.micNote = 'Часть речи не распознана — допишите ответ в поле ниже.'; } }
  /** stop listening: the last phrase is still recognised (the text keeps coming in for a moment) */
  function micStop(ctx) {
    const m = ctx.mic; if (!m) return;
    if (m.sr) { m.state = 'stopping'; try { m.sr.stop(); } catch (e) { /* ignore */ } ctx.mic = null; spPaint(ctx, m.key); return; }
    if (m.state === 'rec' && m.seg) cutSeg(ctx, m);
    m.state = 'stopping'; micRelease(m);
    micMaybeDone(ctx, m);
    spPaint(ctx, m.key);
  }
  /* the two timers: preparation → answer (on the real oral test you think first, then speak) */
  async function spStart(ctx, key) {
    const it = itemOfKey(ctx, key); if (!it) return;
    primeAudio(ctx); // inside the tap
    spStop(ctx);
    if (ctx.mic && ctx.mic.key !== key) micStop(ctx);
    // the recognition is chosen (and, the first time, downloaded) before the clock starts — not in the middle of the answer
    if (!ctx.micDenied && !(await micBlocked())) { const e = await pickEngine(ctx); if (e === 'cancel' || !e) ctx.noVoice = true; }
    if (!ctx.alive() || ctx.view !== 'test') return;
    const prep = prepOf(it), talk = talkOf(it);
    ctx.sp = { key, phase: prep ? 'prep' : 'talk', prep, talk, end: Date.now() + (prep || talk) * 1000, tick: setInterval(() => spTick(ctx), 250) };
    if (!prep) spTalk(ctx); else { spPaint(ctx, key); live(ctx, `Подготовка: ${mmss(prep)}`); }
  }
  function spTalk(ctx) {
    const t = ctx.sp; if (!t) return;
    t.phase = 'talk'; t.end = Date.now() + t.talk * 1000;
    spPaint(ctx, t.key);
    live(ctx, `Говорите! На ответ ${mmss(t.talk)}`);
    try { if (root.navigator && navigator.vibrate) navigator.vibrate(120); } catch (e) { /* ignore */ }
    if (!ctx.micDenied && !ctx.noVoice && !(ctx.mic && ctx.mic.key === t.key)) micStart(ctx, t.key);
  }
  function spTick(ctx) {
    const t = ctx.sp;
    if (!t || !ctx.alive()) { spStop(ctx); return; }
    if (Date.now() >= t.end) {
      if (t.phase === 'prep') { spTalk(ctx); return; }
      if (t.phase === 'talk') { spDone(ctx, true); return; }
    }
    spPaintTime(ctx);
  }
  function spDone(ctx, timeUp) {
    const t = ctx.sp; if (!t) return;
    clearInterval(t.tick); t.tick = null; t.phase = 'done'; t.timeUp = !!timeUp;
    if (ctx.mic && ctx.mic.key === t.key) micStop(ctx);
    spPaint(ctx, t.key);
    if (timeUp) { live(ctx, 'Время ответа закончилось'); toast('⏱ Время ответа закончилось — проверьте текст и нажмите «Оценить ответ»', '', 4000); }
  }
  function spStop(ctx) {
    const t = ctx.sp; if (!t) return;
    if (t.tick) clearInterval(t.tick);
    ctx.sp = null;
  }
  /** timers / recording / recognition still going */
  const speakBusy = ctx => !!((ctx.sp && (ctx.sp.phase === 'prep' || ctx.sp.phase === 'talk')) || (ctx.mic && (ctx.mic.state === 'rec' || ctx.mic.state === 'starting' || ctx.mic.pending > 0)));
  /** before leaving a running answer: ask; «yes» stops the clock and the microphone (the text already there stays) */
  async function confirmSpeakLeave(ctx) {
    if (!speakBusy(ctx)) return true;
    const ok = await UI.confirm('Идёт ответ: таймер или запись ещё не закончились. Остановить и уйти? Текст, который уже появился, сохранится.', { ok: 'Остановить и уйти', cancel: 'Остаться', title: 'Остановить ответ?' });
    if (ok) speakOff(ctx);
    return ok;
  }
  function speakOff(ctx) {
    spStop(ctx);
    if (ctx.mic) micStop(ctx);
    stopModel(ctx);
  }
  /* the model answer: read it, listen to it */
  function speakModelHtml(it, w, approx, early) {
    if (!it.model) return '';
    return `<div class="pv-self pv-sp-model">
      <div class="pv-model"><div class="pv-sp-model-head"><b>📖 Образец ответа</b> <span class="pv-muted">(один из многих возможных)</span>
        <button type="button" class="btn sm primary" data-say-model aria-pressed="false">🔊 Послушать</button></div>
        <p lang="nb">${esc(it.model)}</p>${it.modelRu ? `<details class="pv-ai-better"><summary>Перевод образца</summary><p>${esc(it.modelRu)}</p></details>` : ''}</div>
      ${approx && !early ? `<div class="pv-checklist"><b>✅ Проверьте себя:</b><ul>${SPEAK_CHECK.map(c => `<li>${c}</li>`).join('')}</ul></div>` : ''}
    </div>`;
  }
  const SPEAK_CHECK = [
    'Вы ответили на все вопросы задания и добавили пример из своей жизни?',
    'Глагол на 2-м месте: «I helgene <b>går</b> jeg på tur», «Om sommeren <b>bor</b> vi på hytta».',
    'Есть мнение и причина: «Jeg synes at … fordi …», «Jeg tror at …».',
    'Сравнение (на A2): «I Norge … , men i hjemlandet mitt …», «Det er dyrere / kaldere her».',
    'Слова-связки: og, men, fordi, derfor, først, etterpå, til slutt.',
    'Если забыли слово — объясните его другими словами: «Det er en ting som …».',
  ];
  function stopModel(ctx) {
    if (!ctx.saying) return;
    ctx.saying = null; ctx.sayTok = (ctx.sayTok || 0) + 1;
    try { if (root.TTS && TTS.stop) TTS.stop(); } catch (e) { /* ignore */ }
    paintModelBtns(ctx);
  }
  function paintModelBtns(ctx) {
    if (!ctx.alive || !ctx.alive()) return;
    ctx.body.querySelectorAll('[data-say-model]').forEach(b => {
      const box = b.closest('[data-speak]'), on = !!(box && ctx.saying === box.dataset.speak);
      b.textContent = on ? '■ Стоп' : '🔊 Послушать'; b.classList.toggle('bad', on); b.classList.toggle('primary', !on); b.setAttribute('aria-pressed', on);
    });
  }
  async function sayModel(ctx, key) {
    const it = itemOfKey(ctx, key); if (!it || !it.model) return;
    if (ctx.saying === key) { stopModel(ctx); return; }
    stopAudio(ctx); stopModel(ctx);
    if (ctx.mic) micStop(ctx); // the voice must not be recorded into the answer
    if (!root.TTS || !TTS.speak) { toast('Голос сейчас недоступен — прочитайте образец глазами', 'warn', 4000); return; }
    const tok = ctx.sayTok = (ctx.sayTok || 0) + 1;
    ctx.saying = key; paintModelBtns(ctx);
    const t0 = Date.now();
    try { await TTS.speak(it.model, 'no', {}); } catch (e) { /* the button comes back */ }
    if (ctx.sayTok !== tok) return;
    if (Date.now() - t0 < 80) toast('Голос не прозвучал? Проверьте звук — или прочитайте образец глазами', 'warn', 4000);
    ctx.saying = null; paintModelBtns(ctx);
  }
  function aiSpeakPrompt(it, text) {
    const system = 'Ты — доброжелательный, но честный экзаменатор устной части норвежского экзамена (Norskprøve, букмол) для взрослых русскоязычных учеников уровня A1–A2. Ты оцениваешь устный ответ по его расшифровке по шкале 0–12. Отвечай ТОЛЬКО одним JSON-объектом, без текста вокруг и без markdown.';
    const user = `Устное задание (по-норвежски): «${it.prompt || ''}»${it.promptRu ? `\nПеревод задания: «${it.promptRu}»` : ''}${arr(it.ask).length ? `\nВопросы-подсказки: ${arr(it.ask).join(' / ')}` : ''}${it.scene ? `\nЧто на картинке (описание по-русски): ${it.scene}` : ''}
Уровень задания: ${it.level || 'A2'}. Время на ответ: ${mmss(talkOf(it))}. В расшифровке ${wordCount(text)} слов.
Расшифровка ответа ученика (распознанная речь или напечатанный текст; знаки препинания, большие буквы и мелкие ошибки распознавания НЕ оценивай):
"""
${text.slice(0, 4000)}
"""
Оцени ответ по 5 критериям (целые числа):
- task (0–3): задание выполнено — ответ по теме, на вопросы задания, достаточно подробно для уровня;
- vocab (0–2): словарный запас — разнообразие и точность слов по теме;
- grammar (0–2): артикли и род, формы существительных и глаголов (время!), согласование прилагательных, sin / hans;
- order (0–3): порядок слов — V2 (инверсия: «I dag går jeg»), придаточные (подлежащее → ikke → глагол: «fordi jeg ikke har tid»), вопросы;
- fluency (0–2): беглость и связность — связные фразы, слова-связки (og, men, fordi, derfor, først, etterpå), логичный рассказ, а не отдельные слова.
Уровень CEFR — одно из: "A1", "A2", "A2+", "B1".
Верни JSON строго такого вида:
{"scores":{"task":0,"vocab":0,"grammar":0,"order":0,"fluency":0},"cefr":"A2","errors":[{"frag":"дословный фрагмент из расшифровки","fix":"как правильно сказать по-норвежски","why":"одна короткая строка по-русски: какое правило","kind":"order"}],"corrected":"весь ответ, исправленный по-норвежски (сохрани мысли ученика, сделай естественную устную речь)","teacher":"одна короткая тёплая фраза экзаменатора по-норвежски, например: Bra! Du snakker fint!","summary":"2–3 простых предложения по-русски: общее впечатление и главное, над чем работать в устной речи","good":["что получилось хорошо — по-русски, 1–3 пункта"]}
kind — одно из: "order" (порядок слов), "grammar", "vocab".
Правила: "frag" копируй из расшифровки буква в букву, чтобы его можно было найти и подсветить; не больше 12 самых важных ошибок; если ошибок нет — пустой массив; не придумывай ошибок и не исправляй то, что верно; не считай ошибкой отсутствие точек и запятых.`;
    return { system, user };
  }

  /* ---------- after drawing: inputs width, lines of the matching task, focus ---------- */
  function afterRender(ctx, focusKey) {
    if (ctx.ro) { ctx.ro.disconnect(); ctx.ro = null; }
    if (ctx.body.querySelector('.pv-match')) {
      requestAnimationFrame(() => drawMatchLines(ctx));
      if (root.ResizeObserver) { ctx.ro = new ResizeObserver(() => drawMatchLines(ctx)); ctx.body.querySelectorAll('.pv-match-grid').forEach(g => ctx.ro.observe(g)); }
    }
    if (focusKey) {
      const el = ctx.body.querySelector(focusKey);
      if (el) try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    }
  }
  const live = (ctx, msg) => { const el = ctx.body.querySelector('[data-pv-live]'); if (el) el.textContent = msg; };

  /* ======================================================================
   * 6. Interaction
   * ====================================================================== */
  function setAns(ctx, key, val) {
    const run = ctx.run;
    if (val == null || val === '' || (Array.isArray(val) && !val.some(x => x != null))) delete run.a[key]; else run.a[key] = val;
    run.at = Date.now(); save();
  }
  /** a chip into a slot (hints) */
  function place(ctx, key, chipIdx) {
    const sec = ctx.sec, chip = bankAll(sec).find(b => b.i === chipIdx); if (!chip) return;
    const slot = ctx.body.querySelector(`[data-slot="${cssEsc(key)}"]`);
    if (slot && slot.dataset.noun) {
      const art = artOf(ctx.run.a[key]);
      setAns(ctx, key, (art ? art + ' ' : '') + chip.t);
    } else setAns(ctx, key, chip.t);
    ctx.selChip = null; ctx.selSlot = null;
    // the next empty gap gets the focus (keyboard users go on quickly)
    renderSection(ctx);
    const empty = [...ctx.body.querySelectorAll('[data-slot]:not(.filled)')];
    const all = [...ctx.body.querySelectorAll('[data-slot]')], at = all.findIndex(x => x.dataset.slot === key);
    const nxt = empty.find(x => all.indexOf(x) > at) || empty[0];
    if (nxt) try { nxt.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    live(ctx, `Вставлено: ${chip.t}`);
  }
  const cssEsc = s => (root.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'));

  function onInput(ctx, e) {
    const t = e.target;
    if (t.dataset.in) {
      const key = t.dataset.in;
      if (t.dataset.noun) {
        const art = artOf(ctx.run.a[key]);
        const v = t.value.trim();
        // the article typed into the word field: fine, it counts as the article
        setAns(ctx, key, ((!/^(en|ei|et)\s/i.test(v) && art ? art + ' ' : '') + v).trim());
      } else setAns(ctx, key, t.value);
      if (ctx.run.oi[key]) delete ctx.run.oi[key];
    } else if (t.dataset.wtext) {
      const key = t.dataset.wtext, w = Object.assign({}, ctx.run.a[key] || {}, { text: t.value });
      ctx.run.a[key] = w; ctx.run.at = Date.now(); save();
      const n = wordCount(t.value), box = t.closest('[data-write]') || ctx.body;
      const c = box.querySelector('[data-wcount]'), it = ctx.sec.items.find(x => ctx.sec.id + '.' + x.id === key);
      if (c) c.textContent = countLine(n, it);
      box.querySelectorAll('[data-grade]').forEach(b => { b.disabled = n < 3; });
      const gr = box.querySelector('.pv-grade'); if (gr) gr.classList.toggle('stale', !!(w.grade && w.grade.text !== t.value));
      const cn = box.querySelector('[data-kit-conn]'); if (cn) cn.innerHTML = connLine(t.value);
    } else if (t.dataset.wcheck != null) {
      const box = t.closest('[data-write]'); if (!box) return;
      const key = box.dataset.write, w = Object.assign({}, ctx.run.a[key] || {});
      w.checks = Object.assign({}, w.checks, { [t.dataset.wcheck]: t.checked }); ctx.run.a[key] = w; save();
    }
  }

  function onKey(ctx, e) {
    if (e.key === 'Escape' && (ctx.selChip != null || ctx.selSlot || ctx.selMatch)) {
      e.stopPropagation(); ctx.selChip = null; ctx.selSlot = null; ctx.selMatch = null;
      ctx.body.querySelectorAll('.sel').forEach(x => x.classList.remove('sel'));
    }
    // Enter in a gap: to the next gap
    if (e.key === 'Enter' && e.target.dataset && e.target.dataset.in) {
      e.preventDefault();
      const ins = [...ctx.body.querySelectorAll('[data-in]')], k = ins.indexOf(e.target);
      if (ins[k + 1]) ins[k + 1].focus(); else { const c = ctx.body.querySelector('[data-check]'); if (c) c.focus(); }
    }
  }

  async function onClick(ctx, e) {
    if (ctx.suppressClick) { ctx.suppressClick = false; e.preventDefault(); return; }
    const b = e.target.closest('button, [data-go-sec]'); if (!b || b.disabled) return;
    const d = b.dataset, run = ctx.run;
    try {
      if (d.retryLoad != null) { ctx.body.innerHTML = '<div class="pv-loading"><span class="spinner"></span> Загружаю тесты…</div>'; await load(); renderList(ctx); return; }
      if (d.start) { startTest(ctx, d.start); return; }
      if (d.restart) {
        if (!(await UI.confirm('Начать этот тест заново? Ваши текущие ответы сотрутся.', { ok: 'Начать заново', title: 'Начать заново?' }))) return;
        delete st().runs[d.restart]; save(); startTest(ctx, d.restart, { fresh: true }); return;
      }
      if (d.retryWrong) { const l = st().last[d.retryWrong]; if (l && l.wrong && l.wrong.length) startTest(ctx, d.retryWrong, { retry: l.wrong.slice() }); return; }
      if (d.toList != null) { if (await askLeave(ctx, 'list')) ctx.list(); return; }
      if ((d.goSec != null || d.prev != null || d.next != null || d.check != null) && !(await confirmSpeakLeave(ctx))) return;
      if (d.goSec != null) { goSec(ctx, +d.goSec); return; }
      if (d.prev != null) { goSec(ctx, run.sec - 1); return; }
      if (d.next != null) {
        const secs = visibleSections(ctx.t, run);
        if (run.sec >= secs.length - 1) finish(ctx); else goSec(ctx, run.sec + 1);
        return;
      }
      if (d.check != null) { await checkSection(ctx); return; }
      if (d.hints != null) {
        const on = !hintOn(run, ctx.sec);
        run.h[ctx.sec.id] = on;
        if (on && !ctx.sec.items.every(it => it.type === 'order')) run.hu[ctx.sec.id] = true;
        ctx.selChip = null; ctx.selSlot = null; save(); renderSection(ctx, '[data-hints]'); return;
      }
      if (d.play) { playClip(ctx, d.play, false); return; }
      if (d.playSlow) { playClip(ctx, d.playSlow, true); return; }
      if (d.showText) { run.w['txt.' + d.showText] = true; run.hu[ctx.sec.id] = true; save(); refreshClips(ctx); return; }
      if (d.sayWord) { try { TTS.speak(d.sayWord, 'no', {}); } catch (err) { toast('Голос сейчас недоступен', 'warn'); } return; }
      if (d.chip != null) {
        const i = +d.chip;
        if (ctx.selSlot) { place(ctx, ctx.selSlot, i); return; }
        ctx.selChip = ctx.selChip === i ? null : i;
        ctx.body.querySelectorAll('[data-chip]').forEach(x => { const on = +x.dataset.chip === ctx.selChip; x.classList.toggle('sel', on); x.setAttribute('aria-pressed', on); });
        ctx.body.querySelector('.pv-sec').classList.toggle('pv-choosing', ctx.selChip != null);
        if (ctx.selChip != null) live(ctx, 'Теперь нажмите на пропуск');
        return;
      }
      if (d.slot) {
        const key = d.slot;
        if (ctx.selChip != null) { place(ctx, key, ctx.selChip); return; }
        const v = run.a[key];
        if (v && (b.dataset.noun ? nounOf(v) : true)) {
          // a filled gap: the word goes back to the bank (the article stays)
          if (b.dataset.noun) setAns(ctx, key, artOf(v));
          else setAns(ctx, key, '');
          ctx.selSlot = key; renderSection(ctx, `[data-slot="${cssEsc(key)}"]`); live(ctx, 'Слово убрано'); return;
        }
        ctx.selSlot = ctx.selSlot === key ? null : key;
        ctx.body.querySelectorAll('[data-slot]').forEach(x => x.classList.toggle('sel', x.dataset.slot === ctx.selSlot));
        if (ctx.selSlot) live(ctx, 'Теперь выберите слово внизу');
        return;
      }
      if (d.art) {
        const key = d.art, v = String(run.a[key] || ''), noun = nounOf(v), cur0 = artOf(v);
        const nv = (cur0 === d.v ? noun : (d.v + (noun ? ' ' + noun : ''))).trim();
        setAns(ctx, key, nv);
        const now = artOf(nv);
        b.closest('.pv-arts').querySelectorAll('[data-art]').forEach(x => { const on = x.dataset.v === now; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
        return;
      }
      if (d.pick) {
        const v = d.v === 'true' ? true : d.v === 'false' ? false : +d.v;
        setAns(ctx, d.pick, v);
        b.parentElement.querySelectorAll('[data-pick]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
        return;
      }
      if (d.ordAdd) {
        const key = d.ordAdd, it = itemOfKey(ctx, key); if (!it) return;
        const idx = arr(run.oi[key]).concat(+d.i); run.oi[key] = idx;
        setAns(ctx, key, sentenceOf(idx.map(i => orderWords(it)[i]), arr(it.answer)[0], !!it.prefix));
        renderSection(ctx, `[data-order="${cssEsc(key)}"] [data-ord-add]`); return;
      }
      if (d.ordRm) {
        const key = d.ordRm, it = itemOfKey(ctx, key); if (!it) return;
        const idx = arr(run.oi[key]).slice(); idx.splice(+d.p, 1); run.oi[key] = idx;
        setAns(ctx, key, idx.length ? sentenceOf(idx.map(i => orderWords(it)[i]), arr(it.answer)[0], !!it.prefix) : '');
        renderSection(ctx, `[data-order="${cssEsc(key)}"] ${idx.length ? '[data-ord-rm]' : '[data-ord-add]'}`); return;
      }
      if (d.ml) {
        const base = d.ml, i = +d.i, v = arr(run.a[base]).slice();
        if (v[i] != null && !(ctx.selMatch && ctx.selMatch.key === base && ctx.selMatch.i === i)) { v[i] = null; setAns(ctx, base, v); ctx.selMatch = { key: base, i }; }
        else ctx.selMatch = ctx.selMatch && ctx.selMatch.key === base && ctx.selMatch.i === i ? null : { key: base, i };
        renderSection(ctx, `[data-ml="${cssEsc(base)}"][data-i="${i}"]`);
        if (ctx.selMatch) live(ctx, 'Теперь выберите объяснение справа');
        return;
      }
      if (d.mr) {
        const base = d.mr, j = +d.j;
        if (!ctx.selMatch || ctx.selMatch.key !== base) {
          // tapped the right side first: unlink it if it is linked
          const v = arr(run.a[base]).slice(), li = v.indexOf(j);
          if (li >= 0) { v[li] = null; setAns(ctx, base, v); renderSection(ctx); } else live(ctx, 'Сначала выберите слово слева');
          return;
        }
        link(ctx, base, ctx.selMatch.i, j); return;
      }
      if (d.selfOk) { run.ok[d.selfOk] = true; save(); renderTest(ctx); return; }
      // 🧰 «Шаблон и фразы» (a helper only: no hint mark, the grade is the same)
      if (d.kit) { const it = itemOfKey(ctx, d.kit); if (!it) return; const K = kitState(ctx, d.kit, it); K.open = !K.open; kitRefresh(ctx, d.kit); if (K.open) live(ctx, 'Шаблон и фразы открыты'); return; }
      if (d.kitGenre || d.kitDeck || d.kitIns) {
        const box = b.closest('[data-kit-box]'); if (!box) return;
        const base = box.dataset.kitBox, it = itemOfKey(ctx, base); if (!it) return;
        const K = kitState(ctx, base, it);
        if (d.kitGenre) { K.genre = d.kitGenre; K.deck = null; kitRefresh(ctx, base); return; }
        if (d.kitDeck) {
          K.deck = d.kitDeck;
          const ph = box.querySelector('[data-kit-phr]'); if (ph) ph.innerHTML = kitPhrasesHtml(K);
          const t2 = box.querySelector(`[data-kit-deck="${cssEsc(d.kitDeck)}"]`); if (t2) try { t2.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
          return;
        }
        const [did, i] = d.kitIns.split('|'), dk = PHR && PHR.decks.find(x => x.id === did), c = dk && dk.cards[+i];
        if (c) kitInsert(ctx, base, c.no);
        return;
      }
      if (d.grade) {
        if (ctx.grading) return;
        ctx.grading = true; b.disabled = true;
        try {
          // a spoken answer: stop the clock and the microphone, wait for the last phrase (a few seconds at most)
          if ((ctx.sp && ctx.sp.key === d.grade) || (ctx.mic && ctx.mic.key === d.grade)) {
            const m = ctx.mic; if (ctx.sp && ctx.sp.phase !== 'done') spDone(ctx, false); else if (m) micStop(ctx);
            if (m && m.queue) await withTimeout(m.queue, 20000).catch(() => {});
          }
          await gradeWrite(ctx, d.grade, b.closest('[data-write]'));
        } finally { ctx.grading = false; }
        return;
      }
      if (d.spGo) { await spStart(ctx, d.spGo); return; }
      if (d.spSkip) { if (ctx.sp && ctx.sp.phase === 'prep') { primeAudio(ctx); spTalk(ctx); } return; }
      if (d.spEnd) { spDone(ctx, false); return; }
      if (d.spMic) {
        if (ctx.mic && ctx.mic.key === d.spMic && ctx.mic.state === 'rec') { micStop(ctx); return; }
        if (ctx.mic && ctx.mic.key !== d.spMic) micStop(ctx);
        if (ctx.mic) return; // still finishing the last phrase
        stopModel(ctx); primeAudio(ctx); ctx.micDenied = false; ctx.noVoice = false;
        if (ctx.engine === 'cancel') ctx.engine = null;
        await micStart(ctx, d.spMic); return;
      }
      if (d.sayModel != null) { const box = b.closest('[data-speak]'); if (box) sayModel(ctx, box.dataset.speak); return; }
      if (d.showModel) {
        const w = Object.assign({}, run.a[d.showModel] || {}, { model: true }); run.a[d.showModel] = w; run.hu[ctx.sec.id] = true; run.at = Date.now(); save();
        renderSection(ctx, `[data-speak="${cssEsc(d.showModel)}"] [data-say-model]`); live(ctx, 'Образец ответа показан'); return;
      }
      if (d.tr) {
        // the Russian task is a hint (recorded, as on the course: you are expected to read the Norwegian one)
        const w = Object.assign({}, run.a[d.tr] || {}, { tr: true }); run.a[d.tr] = w; run.hu[ctx.sec.id] = true; run.at = Date.now(); save();
        renderSection(ctx, `[data-wtext="${cssEsc(d.tr)}"]`); live(ctx, 'Перевод задания показан'); return;
      }
      if (d.err != null) { showErr(ctx, b); return; }
      if (d.resRetry != null) { const keys = ctx.lastWrong || []; if (keys.length) startTest(ctx, ctx.t.id, { retry: keys.slice() }); return; }
      if (d.resCards != null) { makeCards(ctx); return; }
      if (d.resAgain != null) { delete st().runs[ctx.t.id]; save(); startTest(ctx, ctx.t.id, { fresh: true }); return; }
      if (d.resList != null) { ctx.list(); return; }
    } catch (err) {
      console.warn('prove', err);
      toast('Что-то пошло не так — попробуйте ещё раз', 'warn');
    }
  }
  function itemOfKey(ctx, key) { const sec = ctx.sec; return sec.items.find(it => sec.id + '.' + it.id === key); }
  function link(ctx, base, i, j) {
    const v = arr(ctx.run.a[base]).slice();
    const it = itemOfKey(ctx, base); while (it && v.length < it.pairs.length) v.push(null);
    const was = v.indexOf(j); if (was >= 0) v[was] = null;
    v[i] = j; ctx.selMatch = null; setAns(ctx, base, v);
    renderSection(ctx);
    // the next unlinked word on the left gets the focus
    const nxt = [...ctx.body.querySelectorAll(`[data-ml="${cssEsc(base)}"]`)].find(x => !x.classList.contains('linked'));
    if (nxt) try { nxt.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }
  function goSec(ctx, i) {
    const secs = visibleSections(ctx.t, ctx.run);
    if (i < 0 || i >= secs.length) return;
    speakOff(ctx); stopAudio(ctx); dragEnd();
    ctx.run.sec = i; ctx.selChip = null; ctx.selSlot = null; ctx.selMatch = null; save();
    renderTest(ctx); ctx.scrollTop();
    const h = ctx.body.querySelector('.pv-sec h3'); if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  async function checkSection(ctx) {
    const { run } = ctx, sec = ctx.sec, items = visibleItems(sec, run);
    stopAudio(ctx); speakOff(ctx);
    const isWrite = items.every(isGraded);
    if (!isWrite) {
      const empty = items.reduce((n, it) => n + scoreItem(sec, it, run.a, run.ok).res.filter(r => r.note === 'empty').length, 0);
      if (empty && !(await UI.confirm(`Не заполнено: ${empty}. Проверить всё равно?`, { ok: 'Проверить', cancel: 'Дописать', title: 'Не все ответы' }))) return;
    }
    run.chk[sec.id] = true; run.at = Date.now(); save();
    if (isWrite) {
      const secs = visibleSections(ctx.t, run);
      if (run.sec >= secs.length - 1) finish(ctx); else goSec(ctx, run.sec + 1);
      return;
    }
    renderTest(ctx);
    const sc = scoreSection(sec, run.a, run.ok, retrySet(run));
    live(ctx, `Проверено: ${fmtPts(sc.got)} из ${sc.max}`);
    if (sc.max && sc.got >= sc.max && !reduced()) { const el = ctx.body.querySelector('.pv-sec-score'); if (el) el.classList.add('pop'); }
    const first = ctx.body.querySelector('.pv-bad, .pv-half, .pv-fb') || ctx.body.querySelector('.pv-sec-score');
    if (first && first.scrollIntoView) first.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
  }

  /* ---------- drag & drop (pointer events): chips → gaps, left words → right words ---------- */
  let drag = null;
  function onPointerDown(ctx, e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const chip = e.target.closest('[data-chip]'), ml = e.target.closest('[data-ml]');
    if (!chip && !ml) return;
    if ((chip && chip.disabled) || (ml && ml.disabled)) return;
    drag = { ctx, chip, ml, x0: e.clientX, y0: e.clientY, id: e.pointerId, on: false, t0: Date.now(), touch: e.pointerType !== 'mouse' };
    doc.addEventListener('pointermove', onPointerMove, true);
    doc.addEventListener('pointerup', onPointerUp, true);
    doc.addEventListener('pointercancel', dragEnd, true);
  }
  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0, dist = Math.hypot(dx, dy);
    if (!drag.on) {
      // a finger: hold a moment first (a quick swipe scrolls the page); a mouse: start after a few pixels
      if (dist < 6) return;
      if (drag.touch && Date.now() - drag.t0 < 180) { dragEnd(); return; }
      drag.on = true;
      const ctx = drag.ctx;
      if (drag.chip) {
        const g = doc.createElement('div'); g.className = 'pv-ghost'; g.textContent = drag.chip.textContent.replace(/×\d+$/, ''); doc.body.appendChild(g); drag.ghost = g;
        drag.chip.classList.add('dragging'); ctx.body.querySelector('.pv-sec').classList.add('pv-dragging');
      } else {
        const grid = drag.ml.closest('.pv-match-grid'), r = drag.ml.getBoundingClientRect(), g = grid.getBoundingClientRect();
        drag.grid = grid; ctx.dragLine = { base: drag.ml.dataset.ml, x1: r.right - g.left, y1: r.top + r.height / 2 - g.top, x2: r.right - g.left, y2: r.top + r.height / 2 - g.top };
      }
    }
    e.preventDefault();
    const over = doc.elementFromPoint(e.clientX, e.clientY);
    if (drag.chip) {
      drag.ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -120%)`;
      const slot = over && over.closest && over.closest('[data-slot]');
      drag.ctx.body.querySelectorAll('.pv-slot.over').forEach(x => { if (x !== slot) x.classList.remove('over'); });
      if (slot) slot.classList.add('over');
    } else if (drag.grid) {
      const g = drag.grid.getBoundingClientRect();
      drag.ctx.dragLine.x2 = e.clientX - g.left; drag.ctx.dragLine.y2 = e.clientY - g.top;
      drawMatchLines(drag.ctx);
      const mr = over && over.closest && over.closest('[data-mr]');
      drag.grid.querySelectorAll('.pv-mr.over').forEach(x => { if (x !== mr) x.classList.remove('over'); });
      if (mr && mr.dataset.mr === drag.ml.dataset.ml) mr.classList.add('over');
    }
  }
  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    if (d.on) {
      const over = doc.elementFromPoint(e.clientX, e.clientY), ctx = d.ctx;
      d.ctx.suppressClick = true; setTimeout(() => { ctx.suppressClick = false; }, 0);
      dragEnd();
      if (d.chip) {
        const slot = over && over.closest && over.closest('[data-slot]');
        if (slot) place(ctx, slot.dataset.slot, +d.chip.dataset.chip);
      } else {
        const mr = over && over.closest && over.closest('[data-mr]');
        if (mr && mr.dataset.mr === d.ml.dataset.ml) link(ctx, d.ml.dataset.ml, +d.ml.dataset.i, +mr.dataset.j); else drawMatchLines(ctx);
      }
      return;
    }
    dragEnd();
  }
  function dragEnd() {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.ghost) d.ghost.remove();
    if (d.chip) d.chip.classList.remove('dragging');
    if (d.ctx) {
      d.ctx.dragLine = null;
      const s = d.ctx.body.querySelector('.pv-sec'); if (s) s.classList.remove('pv-dragging');
      d.ctx.body.querySelectorAll('.over').forEach(x => x.classList.remove('over'));
      if (d.ml) drawMatchLines(d.ctx);
    }
    doc.removeEventListener('pointermove', onPointerMove, true);
    doc.removeEventListener('pointerup', onPointerUp, true);
    doc.removeEventListener('pointercancel', dragEnd, true);
  }
  // while dragging with a finger the page must not scroll
  if (doc) doc.addEventListener('touchmove', e => { if (drag && drag.on) e.preventDefault(); }, { passive: false });

  /* ======================================================================
   * 7. Results
   * ====================================================================== */
  function wrongKeys(t, run) {
    const out = [];
    const only = retrySet(run);
    t.sections.forEach(sec => sec.items.forEach(it => {
      if (isGraded(it) || (only && !only.has(sec.id + '.' + it.id))) return;
      const r = scoreItem(sec, it, run.a, run.ok);
      if (r.got < r.max) out.push(sec.id + '.' + it.id);
    }));
    return out;
  }
  /** the grades of a writing section: { got, max, n (graded), cefr, by } */
  function secGrade(sec, run, type) {
    const out = { got: 0, max: 0, n: 0, cefr: '', by: '' };
    sec.items.forEach(it => {
      if (type ? it.type !== type : !isGraded(it)) return;
      out.max += GRADE_MAX;
      const g = (run.a[sec.id + '.' + it.id] || {}).grade;
      if (g && g.crit) { out.got += g.total; out.n++; out.cefr = g.cefr; out.by = out.by && out.by !== g.by ? 'mix' : g.by; }
    });
    return out;
  }
  function writingLevel(t, run, type) {
    type = type || 'write';
    // only graded texts count (an unwritten text is «не оценено», not 0)
    const r = { level: '', by: '', got: 0, max: 0, n: 0, tasks: 0 };
    const order = CEFRS;
    t.sections.forEach(sec => {
      const g = secGrade(sec, run, type); if (!g.max) return;
      r.got += g.got; r.max += g.n * GRADE_MAX; r.n += g.n; r.tasks += g.max / GRADE_MAX;
      if (g.cefr && (!r.level || order.indexOf(g.cefr) < order.indexOf(r.level))) r.level = g.cefr; // the weaker text decides
      if (g.by) r.by = r.by && r.by !== g.by ? 'mix' : g.by;
    });
    if (!r.n) { r.got = 0; }
    return r;
  }
  function finish(ctx) {
    const { t, run } = ctx;
    stopAudio(ctx); speakOff(ctx);
    // everything not yet checked is checked now
    visibleSections(t, run).forEach(sec => { run.chk[sec.id] = true; });
    const only = retrySet(run);
    const sc = scoreTest(t, run.a, run.ok, only);
    const wl = writingLevel(t, run);
    const sl = writingLevel(t, run, 'speak');
    const usedHints = t.sections.some(sec => run.hu[sec.id] && !sec.items.every(it => it.type === 'order'));
    const wrong = wrongKeys(t, run);
    const s = st();
    if (!run.retry) {
      const summary = { pct: sc.pct, got: sc.got, max: sc.max, parts: sc.parts, level: wl.level, levelBy: wl.by, wgot: wl.n ? wl.got : null, wmax: wl.n ? wl.max : null,
        sgot: sl.n ? sl.got : null, smax: sl.n ? sl.max : null, slevel: sl.level || '', hints: usedHints, at: Date.now() };
      const best = s.best[t.id];
      // an oral test (no points, only graded answers): the better share of the 12-point grades wins
      const sShare = x => (x && x.smax ? x.sgot / x.smax : -1);
      if (!best || sc.pct > best.pct || (sc.pct === best.pct && (sShare(summary) > sShare(best) || (sShare(summary) === sShare(best) && best.hints && !usedHints)))) s.best[t.id] = summary;
      s.last[t.id] = Object.assign({ wrong }, summary);
    } else if (s.last[t.id]) {
      // after working on the mistakes: what is still wrong stays for the next round
      s.last[t.id].wrong = wrong;
    }
    delete s.runs[t.id];
    save();
    ctx.lastWrong = wrong;
    ctx.view = 'result';
    renderResult(ctx, sc, wl, usedHints, wrong, sl);
  }
  /** the result row of the graded part (writing / speaking): points of the graded answers + the level */
  function gradedRow(wl, ico, ru, no, hint) {
    if (!wl.n) return `<div class="pv-res-row"><span class="pv-res-name">${ico} ${ru} <span class="pv-muted" lang="nb">${no}</span></span><span class="pv-res-lvl"><span class="pv-muted">не оценено — ${hint}</span></span></div>`;
    const wp = pctOf(wl.got, wl.max);
    return `<div class="pv-res-row"><span class="pv-res-name">${ico} ${ru} <span class="pv-muted" lang="nb">${no}</span></span>
      <span class="pv-bar"><i style="width:${wp}%" class="${wp >= 80 ? 'hi' : wp >= 55 ? 'mid' : 'lo'}"></i></span><b>${wl.got}/${wl.max} · <span class="pv-level sm">${esc(wl.level)}</span></b>
      <span class="pv-res-lvl">${wl.by === 'ai' ? 'оценка нейросети' : wl.by === 'auto' ? 'оценка примерная (без нейросети)' : 'часть — нейросеть, часть — примерно'}${wl.n < wl.tasks ? ` · оценено ${wl.n} из ${wl.tasks}` : ''}${wl.pctToo ? ' · в общий процент не входит' : ''}</span></div>`;
  }
  function renderResult(ctx, sc, wl, usedHints, wrong, sl) {
    sl = sl || { n: 0 };
    const { t, run } = ctx;
    const retry = !!run.retry;
    ctx.title(`${esc(t.icon || '📝')} ${retry ? 'Работа над ошибками' : 'Результаты'}`);
    const oral = !sc.max && sl.n > 0;
    const pct = oral ? pctOf(sl.got, sl.max) : sc.pct;
    const msg = oral ? (pct >= 80 ? 'Очень хорошо! Вы уверенно говорите на эти темы. 🌟' : pct >= 55 ? 'Хорошо! Посмотрите исправления и образцы — и попробуйте ещё раз.' : 'Начало положено! Послушайте образцы ответов, выучите пару фраз и повторите.')
      : pct >= 90 ? 'Отлично! Вы очень хорошо знаете эту тему. 🌟' : pct >= 80 ? 'Очень хорошо! Так держать! 💪'
      : pct >= 60 ? 'Хороший результат. Повторите ошибки — и будет ещё лучше.' : 'Есть над чем поработать — и это нормально. Посмотрите правила под ошибками и повторите их.';
    const row = (k) => {
      const p = sc.parts[k]; if (!p || !p.max) return '';
      const P = PARTS[k] || PARTS.gram, pp = pctOf(p.got, p.max);
      return `<div class="pv-res-row"><span class="pv-res-name">${P.ico} ${esc(P.ru)} <span class="pv-muted" lang="nb">${esc(P.no)}</span></span>
        <span class="pv-bar"><i style="width:${pp}%" class="${pp >= 80 ? 'hi' : pp >= 60 ? 'mid' : 'lo'}"></i></span><b>${fmtPts(p.got)}/${p.max} = ${pp}%</b></div>`;
    };
    const hasWrite = t.sections.some(sec => sec.items.some(it => it.type === 'write'));
    const hasSpeak = t.sections.some(sec => sec.items.some(it => it.type === 'speak'));
    wl.pctToo = sl.pctToo = !!sc.max;
    const secRows = visibleSections(t, run).map((sec, i) => {
      if (sec.items.every(isGraded)) { const g = secGrade(sec, run); return `<li class="${g.n && g.got >= g.n * GRADE_MAX * 0.8 ? 'full' : ''}"><span>${i + 1}. ${esc(sec.title)}${run.hu[sec.id] ? ' <span class="pv-tag hint">с переводом</span>' : ''}</span><b>${g.n ? `${g.got}/${g.n * GRADE_MAX} · ${esc(g.cefr)}` : 'не оценено'}</b></li>`; }
      const r = scoreSection(sec, run.a, run.ok, retrySet(run));
      return `<li class="${r.got >= r.max ? 'full' : ''}"><span>${i + 1}. ${esc(sec.title)}${run.hu[sec.id] && !sec.items.every(it => it.type === 'order') ? ' <span class="pv-tag hint">с подсказками</span>' : ''}</span><b>${fmtPts(r.got)}/${r.max}</b></li>`;
    }).join('');
    const canCards = !!(root.Store && Store.addCard && Store.addDeck && Store.decks);
    ctx.body.innerHTML = `<div class="pv-result">
      <div class="pv-res-hero">
        ${oral ? `<div class="pv-ring big ${pct >= 80 ? 'hi' : pct >= 55 ? 'mid' : 'lo'}" style="--p:${pct}"><b>${esc(sl.level || pct + '%')}</b><small>${sl.got} из ${sl.max}</small></div>`
          : !sc.max ? `<div class="pv-ring big none"><b>${esc(t.icon || '🗣')}</b></div>`
          : `<div class="pv-ring big ${pct >= 80 ? 'hi' : pct >= 60 ? 'mid' : 'lo'}" style="--p:${pct}"><b>${pct}%</b><small>${fmtPts(sc.got)} из ${sc.max}</small></div>`}
        <div class="pv-res-msg"><h3>${esc(t.title)}</h3><p>${msg}</p>
          ${usedHints ? '<span class="pv-tag hint">с подсказками</span>' : '<span class="pv-tag good">без подсказок</span>'}${retry ? ' <span class="pv-tag warn">работа над ошибками — в лучший результат не идёт</span>' : ''}</div>
      </div>
      <div class="pv-res-parts">${Object.keys(PARTS).map(row).join('')}
        ${hasWrite ? gradedRow(wl, '📝', 'Письмо', 'Skriving', 'нажмите «Оценить текст» в задании') : ''}
        ${hasSpeak ? gradedRow(sl, '🗣', 'Устная речь', 'Muntlig', 'нажмите «Оценить ответ» в задании') : ''}
      </div>
      <ul class="pv-res-secs">${secRows}</ul>
      <div class="pv-res-act">
        ${wrong.length ? `<button type="button" class="btn primary" data-res-retry>🔁 Повторить ошибки (${wrong.length})</button>` : ''}
        ${wrong.length && canCards ? '<button type="button" class="btn" data-res-cards>🃏 Сделать карточки из ошибок</button>' : ''}
        <button type="button" class="btn ${wrong.length ? 'ghost' : 'primary'}" data-res-again>↺ Пройти заново</button>
        <button type="button" class="btn ghost" data-res-list>← Все тесты</button>
      </div>
    </div>`;
    ctx.scrollTop();
    ctx.resultRun = run;
    if (pct >= 80 && !reduced() && root.UI && UI.confetti && doc.getElementById('confetti')) { try { UI.confetti(); } catch (e) { /* ignore */ } }
  }

  /** wrong answers → cards: the right sentence on the front, the rule on the back */
  function makeCards(ctx) {
    const { t } = ctx, run = ctx.resultRun; if (!run) return;
    if (!(root.Store && Store.addCard)) { toast('Карточки сейчас недоступны', 'warn'); return; }
    const DECK = 'Ошибки из тестов';
    try {
      const deck = Store.decks().find(d => d.name === DECK) || Store.addDeck(DECK, 'Предложения и слова, в которых были ошибки в тестах по главам');
      const have = new Set(Store.cards(deck.id).map(c => norm(c.no)));
      let made = 0;
      const add = (no, ru, desc) => {
        no = String(no || '').trim(); if (!no || have.has(norm(no))) return;
        have.add(norm(no));
        Store.addCard(deck.id, { no, ru: ru || '', description: desc || '', tags: ['prøve'] });
        made++;
      };
      const only = retrySet(run);
      t.sections.forEach(sec => sec.items.forEach(it => {
        if (only && !only.has(sec.id + '.' + it.id)) return;
        if (['write', 'speak', 'listen-short', 'true-false', 'choice'].includes(it.type)) return;
        const r = scoreItem(sec, it, run.a, run.ok);
        if (r.got >= r.max) return;
        const keys = unitKeys(sec, it);
        if (it.type === 'gap') {
          // the sentence with the gap, all gaps filled with the right words
          const full = it.parts.map(p => (typeof p === 'string' ? p : arr(it.blanks[p.b].ans)[0])).join('');
          const sentences = full.split(/(?<=[.!?])\s+/);
          r.res.forEach((x, k) => {
            if (x.got >= 1) return;
            const right = arr(it.blanks[k].ans)[0];
            // which sentence holds this gap: count the gaps before it
            let pos = 0, cnt = 0; for (const p of it.parts) { if (typeof p === 'string') pos += p.length; else { if (cnt === k) break; pos += arr(it.blanks[p.b].ans)[0].length; cnt++; } }
            let acc = 0, sent = full; for (const s of sentences) { if (pos >= acc && pos <= acc + s.length) { sent = s; break; } acc += s.length + 1; }
            add(sent.trim(), `правильно: ${right}`, [it.blanks[k].why || it.rule || sec.rule || '', run.a[keys[k]] ? `Ваш ответ: ${run.a[keys[k]]}` : ''].filter(Boolean).join('\n'));
          });
        } else if (it.type === 'label-image') add(arr(it.answer)[0], it.ru || '', sec.rule || '');
        else if (it.type === 'match') it.pairs.forEach((p, k) => { if (r.res[k].got < 1) add(p[0], p[2] || p[1], p[2] ? p[1] : ''); });
        else if (it.type === 'order' || it.type === 'transform') add(arr(it.answer)[0], it.ru || (it.prompt ? '' : ''), [it.rule || sec.rule || '', run.a[keys[0]] ? `Ваш ответ: ${run.a[keys[0]]}` : ''].filter(Boolean).join('\n'));
      }));
      toast(made ? `Добавлено ${made} ${plural(made, ['карточка', 'карточки', 'карточек'])} в колоду «${DECK}»` : `Эти ошибки уже есть в колоде «${DECK}»`, made ? 'good' : '', 4500);
      if (made && root.App && App.view && App.view.name !== 'study' && App.render) { try { App.render(); } catch (e) { /* ignore */ } }
    } catch (e) {
      console.warn('prove cards', e);
      toast('Не получилось сделать карточки — попробуйте ещё раз', 'warn');
    }
  }

  /* ======================================================================
   * 8. Entry points
   * ====================================================================== */
  if (doc) {
    doc.addEventListener('click', async e => {
      const b = e.target.closest && e.target.closest('[data-prove-open], .sidebar [data-sb="prove"]');
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      const bd = b.closest('.modal-backdrop');
      if (bd && bd._m && !bd.querySelector('.prove-modal')) { if (!(await bd._m.tryClose())) return; }
      open(b.dataset.proveOpen || undefined);
    }, true);
  }

  const Prove = {
    open: () => open(),
    openTest: id => open(id),
    _core: Object.assign(core, { BODY_PTS, pictureHtml }),
    _state: st,
    _reset() { S = null; DATA = null; },
    _load: load,
  };
  root.Prove = Prove;
  if (typeof module !== 'undefined' && module.exports) module.exports = Prove;

  /* «Как пользоваться» topics for 📝 tests and 📖 the reader (registered at runtime — help.js stays unchanged) */
  function registerHelp() {
    const H = root.Help;
    if (!H || !Array.isArray(H.TOPICS)) return;
    if (!H.TOPICS.some(t => t.id === 'prove')) H.TOPICS.push({ id: 'prove', icon: '📝', hue: 280, title: 'Тесты по главам',
      desc: 'Тесты как на курсе: аудирование, грамматика и письмо — с баллами и процентами.',
      keys: 'тест тесты проверка контрольная глава prøve kapittel баллы проценты аудирование грамматика письмо ошибки устный muntlig говорить экзамен norskprøve',
      steps: [['📝', 'Откройте <b>«Тесты по главам»</b> на главной в «Учить».'],
        ['🎧', 'Аудирование: <b>«▶ Слушать»</b> и <b>«🐢 Медленнее»</b> — сколько угодно раз. Текст откроется после проверки.'],
        ['💡', '<b>«Подсказки»</b>: внизу появятся слова — нажмите слово, потом пропуск (или перетащите). Без подсказок пишите по памяти.'],
        ['✓', '<b>«Проверить»</b> после каждого задания: зелёное — верно, красное — правильный ответ и короткое правило.'],
        ['🗣', 'Устная часть (как на Norskprøve): <b>«▶ Начать»</b> — сначала таймер подготовки, потом таймер ответа. Отвечайте голосом (🎙) или печатайте, затем <b>«Оценить ответ»</b> и послушайте <b>образец</b>.'],
        ['🏁', 'В конце — баллы и проценты по частям, <b>«Повторить ошибки»</b> и <b>«Сделать карточки из ошибок»</b>.']],
      expect: 'Вы увидите, что уже знаете хорошо, а что повторить: под каждой ошибкой — правило по-русски.',
      limits: 'Голос — системный норвежский. Письмо и устные ответы оценивает нейросеть, если она подключена; без неё — примерная оценка, образец и самопроверка. Результаты хранятся на этом устройстве.',
      open: ['📝 Открыть тесты', () => Prove.open()] });
    if (!H.TOPICS.some(t => t.id === 'reader')) H.TOPICS.push({ id: 'reader', icon: '📖', hue: 30, title: 'Читалка — свои книги вслух',
      desc: 'PDF, EPUB, TXT, Word: читайте страницами и слушайте двумя голосами — норвежский и русский.',
      keys: 'читалка книга книги pdf epub txt word fb2 читать вслух голос перевод сказки подсветка закладка продолжить',
      steps: [['📖', 'Нажмите <b>«📚 Библиотека — читать и слушать»</b> на главной → «Мои книги» → <b>«Добавить книгу»</b> и выберите файл. Книга хранится только на этом устройстве.'],
        ['Aa', 'Кнопка <b>«Aa»</b>: размер текста, шрифт, ширина строки, фон «сепия», цвет подсветки.'],
        ['▶', 'Нажмите ▶ — норвежский текст читает норвежский голос, перевод — русский (или украинский). В «🎧»: оба языка, только норвежский или только перевод, скорость, пауза, повтор фразы.'],
        ['🌙', 'В «🎧» — <b>таймер сна</b>: 10–60 минут или «до конца главы»; в последнюю минуту чтение затихает, место сохраняется.'],
        ['👆', 'Нажмите на слово — перевод и <b>«➕ В карточки»</b>.'],
        ['🔖', 'Место запоминается: при следующем открытии — «Продолжить» или «Начать сначала».']],
      expect: 'Любую свою книгу можно и читать, и слушать, а новые слова сразу превращать в карточки.',
      limits: 'Сканы без текста лучше открывать в «🔎 Найти книгу» → «Загрузить учебник с переводом» — там текст распознаётся с картинки. Подсветка — по предложениям.',
      open: ['📖 Открыть читалку', () => (root.Bookshelf ? root.Bookshelf.open('mine') : root.Reader && root.Reader.open())] });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', registerHelp); else registerHelp();
  }
})(typeof window !== 'undefined' ? window : globalThis);
