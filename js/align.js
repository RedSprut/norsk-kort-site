/* ============ Meaning-first word glosses without a neural network ============
 * «Слово (перевод)»: the sentence is translated as a whole first; then every Norwegian word gets the Russian word(s)
 * that carry ITS meaning in THAT translation. Candidate meanings of a word come from the hand-made list (NoGloss),
 * the user's own cards, single-word machine translation (of the form and of the dictionary form), Google's alternative
 * translations and — the other way round — Russian words of the translation translated back to Norwegian.
 * A candidate counts only when it is found in the sentence translation (Russian stems compared, Snowball-like
 * stemmer below); the word is then shown in the form the translation uses («ønska» → «хотел», not «желание»).
 * Nothing found → the best single-word meaning is shown, but marked as uncertain (how: 'guess').
 * Pure functions, no DOM: also used by the offline quality test (node).
 */
(function (root) {
  'use strict';
  /* ---------- Russian stemmer (Snowball Russian, slightly simplified) ---------- */
  const V = 'аеиоуыэюя';
  const byLen = a => a.slice().sort((x, y) => y.length - x.length);
  const PG1 = byLen(['в', 'вши', 'вшись']), PG2 = byLen(['ив', 'ивши', 'ившись', 'ыв', 'ывши', 'ывшись']);
  const REFL = ['ся', 'сь'];
  const ADJ = byLen(['ее', 'ие', 'ые', 'ое', 'ими', 'ыми', 'ей', 'ий', 'ый', 'ой', 'ем', 'им', 'ым', 'ом', 'его', 'ого', 'ему', 'ому', 'их', 'ых', 'ую', 'юю', 'ая', 'яя', 'ою', 'ею']);
  const PART1 = byLen(['ем', 'нн', 'вш', 'ющ', 'щ']), PART2 = byLen(['ивш', 'ывш', 'ующ']);
  const VERB1 = byLen(['ла', 'на', 'ете', 'йте', 'ли', 'й', 'л', 'ем', 'н', 'ло', 'но', 'ет', 'ют', 'ны', 'ть', 'ешь', 'нно']);
  const VERB2 = byLen(['ила', 'ыла', 'ена', 'ейте', 'уйте', 'ите', 'или', 'ыли', 'ей', 'уй', 'ил', 'ыл', 'им', 'ым', 'ен', 'ило', 'ыло', 'ено', 'ят', 'ует', 'уют', 'ит', 'ыт', 'ены', 'ить', 'ыть', 'ишь', 'ую', 'ю']);
  const NOUN = byLen(['а', 'ев', 'ов', 'ие', 'ье', 'е', 'иями', 'ями', 'ами', 'еи', 'ии', 'и', 'ией', 'ей', 'ой', 'ий', 'й', 'иям', 'ям', 'ием', 'ем', 'ам', 'ом', 'о', 'у', 'ах', 'иях', 'ях', 'ы', 'ь', 'ию', 'ью', 'ю', 'ия', 'ья', 'я']);
  /** the longest ending of g1 (needs а/я before it) or g2 inside the region from `from` → the shorter word, or null */
  function among(w, from, g1, g2) {
    let best = null, bl = 0, need = false;
    for (const e of g1 || []) if (e.length > bl && w.endsWith(e) && w.length - e.length >= from) { best = e; bl = e.length; need = true; }
    for (const e of g2 || []) if (e.length > bl && w.endsWith(e) && w.length - e.length >= from) { best = e; bl = e.length; need = false; }
    if (!best) return null;
    if (need) { const i = w.length - bl - 1; if (i < from || (w[i] !== 'а' && w[i] !== 'я')) return null; }
    return w.slice(0, w.length - bl);
  }
  const STEMS = new Map();
  function stem(word) {
    let w = String(word || '').toLowerCase().replace(/ё/g, 'е');
    if (STEMS.has(w)) return STEMS.get(w);
    const key = w;
    let rv = w.length; for (let i = 0; i < w.length; i++) if (V.includes(w[i])) { rv = i + 1; break; }
    const r1 = s => { for (let j = Math.max(s, 1); j < w.length; j++) if (!V.includes(w[j]) && V.includes(w[j - 1])) return j + 1; return w.length; };
    const R2 = r1(r1(0));
    let r = among(w, rv, PG1, PG2);
    if (r !== null) w = r;
    else {
      r = among(w, rv, null, REFL); if (r !== null) w = r;
      const a = among(w, rv, null, ADJ);
      if (a !== null) { w = a; const p = among(w, rv, PART1, PART2); if (p !== null) w = p; }
      else {
        const v = among(w, rv, VERB1, VERB2);
        if (v !== null) w = v;
        else { const n = among(w, rv, null, NOUN); if (n !== null) w = n; }
      }
    }
    if (w.endsWith('и') && w.length - 1 >= rv) w = w.slice(0, -1);
    const d = among(w, R2, null, ['ость', 'ост']); if (d !== null) w = d;
    if (w.endsWith('нн') && w.length - 1 >= rv) w = w.slice(0, -1);
    else {
      const s = among(w, rv, null, ['ейше', 'ейш']);
      if (s !== null) { w = s; if (w.endsWith('нн')) w = w.slice(0, -1); }
      else if (w.endsWith('ь') && w.length - 1 >= rv) w = w.slice(0, -1);
    }
    if (STEMS.size > 20000) STEMS.clear();
    STEMS.set(key, w);
    return w;
  }
  const low = s => String(s || '').toLowerCase().replace(/ё/g, 'е');
  // pronouns, prepositions, particles: only the very same word counts («что» is not «чтобы», «они» is not «он»)
  const FUNC = new Set(('что чтобы как так там тут то это этот эта эти тот та те все весь вся всего всем он она оно они мы вы ты я их им ими его ее ей ему '
    + 'нее него ней нему них ним мне меня мной нам нас нами вам вас вами тебе тебя тобой себя себе собой не ни но на в во с со к ко о об обо от до из за по у '
    + 'для при без под над про через же ли бы да нет и а или уже еще ещё вот кто чем чего').split(' ').map(low));
  const YOU = { ты: 'вы', тебя: 'вас', тебе: 'вам', тобой: 'вами', твой: 'ваш', твоя: 'ваша', твое: 'ваше', твои: 'ваши', твоего: 'вашего', твоей: 'вашей', твоим: 'вашим', твоих: 'ваших' };
  const PRON = {};
  ['я меня мне мной', 'ты тебя тебе тобой', 'он его ему им нем него нему ним', 'она ее ей ею нее ней нею', 'оно', 'мы нас нам нами',
    'вы вас вам вами', 'они их им ими них ним ними', 'себя себе собой', 'кто кого кому кем ком', 'это этого этому этим этом']
    .forEach((g, i) => g.split(' ').forEach(w => { if (!PRON[w]) PRON[w] = 'p' + i; }));
  // the last consonant of a stem alternates in Russian verbs: вижу/видит, хожу/ходит, плачу/платит, пишу/писать
  const ALT = { ж: ['д', 'г', 'з'], ч: ['т', 'к'], ш: ['с', 'х'], щ: ['ст', 'ск'] };
  const alts = s => s.length >= 3 && ALT[s[s.length - 1]] ? [s, ...ALT[s[s.length - 1]].map(x => s.slice(0, -1) + x)] : [s];
  /** how sure two Russian words are the same word (0 = no): equal > same stem > one stem starts the other > close stems */
  function same(a, b) {
    a = low(a); b = low(b);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (YOU[a] === b || YOU[b] === a) return 0.9; // translators say «вы» where Norwegian says «du»
    if (PRON[a] && PRON[a] === PRON[b]) return 0.9; // «он» ~ «ему», «они» ~ «их»: the same pronoun in another case
    if (FUNC.has(a) || FUNC.has(b)) return 0;
    let best = 0;
    for (const sa of alts(stem(a))) for (const sb of alts(stem(b))) best = Math.max(best, sameStem(sa, sb));
    return best;
  }
  function sameStem(sa, sb) {
    if (sa.length < 2 || sb.length < 2) return 0; // «в», «с», «и» — only the very same word
    if (sa === sb) return 0.95;
    const n = Math.min(sa.length, sb.length);
    if (n < 3) return 0;
    let p = 0; while (p < n && sa[p] === sb[p]) p++;
    if (p === n) return n >= 4 || Math.abs(sa.length - sb.length) <= 1 ? 0.85 : 0; // хот(ел) ~ хот(еть)
    if (p >= 4 && p >= n - 1) return 0.8;
    return 0;
  }

  /* ---------- transliteration: «Han» must never be glossed «Хан», «radio» never «радио» ---------- */
  const TL = [['skj', 'ш'], ['sj', 'ш'], ['kj', 'х'], ['tj', 'х'], ['ch', 'ч'], ['sh', 'ш'], ['ph', 'ф'], ['th', 'т'], ['x', 'кс'],
    ['a', 'а'], ['b', 'б'], ['c', 'к'], ['d', 'д'], ['e', 'е'], ['f', 'ф'], ['g', 'г'], ['h', 'х'], ['i', 'и'], ['j', 'й'], ['k', 'к'], ['l', 'л'],
    ['m', 'м'], ['n', 'н'], ['o', 'о'], ['p', 'п'], ['q', 'к'], ['r', 'р'], ['s', 'с'], ['t', 'т'], ['u', 'у'], ['v', 'в'], ['w', 'в'], ['y', 'и'],
    ['z', 'з'], ['æ', 'е'], ['ø', 'е'], ['å', 'о'], ['ä', 'е'], ['ö', 'е'], ['ü', 'у'], ['é', 'е']];
  function translit(s) {
    let t = low(s), out = '';
    for (let i = 0; i < t.length;) {
      const m = TL.find(([l]) => t.startsWith(l, i));
      if (m) { out += m[1]; i += m[0].length; } else { out += t[i]; i++; }
    }
    return out;
  }
  const skel = s => translit(s).replace(/[ьъ]/g, '').replace(/[эе]/g, 'е').replace(/[ыи]/g, 'и').replace(/й/g, 'и').replace(/[юя]/g, 'у').replace(/(.)\1+/g, '$1').replace(/[^а-я0-9]/g, '');
  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length; if (!m || !n) return m || n;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  /** the gloss only repeats the Norwegian word (same letters, or the same word written in Cyrillic) */
  function echoes(src, gloss) {
    const a = skel(src), b = skel(String(gloss || '').replace(/\([^)]*\)/g, ''));
    if (!a || !b) return false;
    if (a === b) return true;
    const n = Math.max(a.length, b.length);
    return n >= 6 && lev(a, b) <= Math.floor(n / 6) && Math.abs(a.length - b.length) <= 1;
  }

  const bare = w => String(w || '').toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  /* ---------- candidates ---------- */
  /** «так/потом/увидел», «желание, желать», «один/(артикль)» → ['так', 'потом', 'увидел'] (notes in brackets dropped) */
  function split(str) {
    return String(str || '').split(/[\/,;]|\s+или\s+/).map(x => x.replace(/\([^)]*\)/g, ' ').replace(/[«»"“”„.!?…]/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(x => /[а-яё]/i.test(x) && x.length <= 40);
  }
  /** Russian words of the translation with their place */
  function ruWords(ru) {
    const out = [];
    const re = /[\p{L}\p{N}]+/gu; let m;
    const s = String(ru || '');
    while ((m = re.exec(s))) out.push({ w: m[0], lw: low(m[0]), i: m.index, e: m.index + m[0].length, j: out.length, start: !out.length || /[.!?…:]\s*[«"“—–-]?\s*$/.test(s.slice(0, m.index)) });
    return out;
  }
  const SRC = { user: 1, card: 0.97, dict: 0.95, mt: 0.9, mtl: 0.84, alt: 0.8, rev: 0.74 };

  /**
   * toks: Norwegian word tokens (as in the text); ru: the sentence translation;
   * cands(k) → [{t: 'гloss text', src: 'dict'|'card'|'mt'|'mtl'|'alt', full}] in order of preference;
   * opts.rev(ruWordLower) → Norwegian back-translation (string) or undefined; opts.same(noWord, k) → is it this token?
   * opts.skip(k) → no gloss at all (names, numbers).
   * → per token { g, how: 'align' | 'dict' (grammar note) | 'guess' | 'none' | 'skip' | 'wait', src, j }
   */
  function align(toks, ru, cands, opts = {}) {
    const R = ruWords(ru);
    const n = toks.length, m = R.length;
    const pos = (k, j) => (n > 1 ? k / (n - 1) : 0.5) - (m > 1 ? j / (m - 1) : 0.5);
    const opt = [];
    const C = toks.map((w, k) => opts.skip && opts.skip(k) ? null : (cands(k) || []));
    C.forEach((list, k) => {
      if (!list || !m) return;
      list.forEach(c => {
        split(c.t).forEach(ph => {
          const parts = ph.split(/[\s-]+/).filter(Boolean);
          if (!parts.length || parts.length > 4) return;
          for (let j = 0; j < m; j++) {
            let q = same(parts[0], R[j].w); if (!q) continue;
            // the other words of a phrase: in order, at most one word in between
            let at = j, ok = true;
            for (let p = 1; p < parts.length && ok; p++) {
              let f = -1;
              for (let x = at + 1; x <= Math.min(m - 1, at + 2); x++) { const s2 = same(parts[p], R[x].w); if (s2) { f = x; q = Math.min(q, s2); break; } }
              if (f < 0) ok = false; else at = f;
            }
            if (!ok) continue;
            // short function words («в», «и», «не») found far from their place are more likely another word's
            const short = parts.length === 1 && parts[0].length <= 2;
            const d = Math.abs(pos(k, j));
            if (short && d > 0.45) continue;
            opt.push({ k, j, j2: at, score: (SRC[c.src] || 0.7) * q - 0.35 * d - (short ? 0.05 : 0), src: c.src });
          }
        });
      });
      // the other way round: a Russian word whose back-translation is this Norwegian word
      if (opts.rev && opts.same) {
        const me = bare(toks[k]);
        for (let j = 0; j < m; j++) {
          const back = opts.rev(R[j].lw);
          if (!back) continue;
          // «откроется» → «vil åpne»: the content word counts, not the helper («vil», «har», «jeg kan»…)
          const words = String(back).split(/[\s,;\/]+/).map(bare).filter(Boolean);
          const content = words.length > 1 && opts.isFunc ? words.filter(b => !opts.isFunc(b)) : words;
          if ((content.length ? content : words).some(b => opts.isFunc && opts.isFunc(b) ? b === me : opts.same(b, k))) opt.push({ k, j, j2: j, score: SRC.rev - 0.35 * Math.abs(pos(k, j)), src: 'rev' });
        }
      }
    });
    opt.sort((a, b) => b.score - a.score);
    const got = new Array(n).fill(null), used = new Map();
    const take = o => { got[o.k] = o; for (let x = o.j; x <= o.j2; x++) used.set(x, (used.get(x) || 0) + 1); };
    // 1st: one Russian word — one Norwegian word; 2nd: what is left may share (Norwegian «ikke … aldri» → «никогда не»)
    opt.forEach(o => { if (!got[o.k] && o.score > 0.2 && ![...Array(o.j2 - o.j + 1)].some((_, x) => used.get(o.j + x))) take(o); });
    opt.forEach(o => { if (!got[o.k] && o.score > 0.8) take(o); });
    const s = String(ru || '');
    return toks.map((w, k) => {
      if (!C[k]) return { g: '', how: 'skip' };
      const o = got[k];
      if (o) {
        let g = s.slice(R[o.j].i, R[o.j2].e);
        if (R[o.j].start && !/^\p{Lu}[\p{Lu}\d-]+$/u.test(R[o.j].w)) g = g.charAt(0).toLowerCase() + g.slice(1);
        if (opts.echo !== false && echoes(w, g)) return { g: '', how: 'skip', echo: true }; // the translation keeps the word itself (DAB-radio → DAB-радио): nothing to add
        return { g, how: 'align', src: o.src, j: o.j };
      }
      const list = C[k];
      // nothing found, but the translation keeps the word as it is («DAB-radio» → «DAB-радио»): nothing to add
      const parts = String(w).split('-').map(bare).filter(x => x.length > 3); // («den» is not «день»)
      if (opts.echo !== false && parts.length && R.some(x => parts.some(p => echoes(p, x.w)))) return { g: '', how: 'skip', echo: true };
      if (!list.length) return { g: opts.wait && opts.wait(k) ? undefined : '', how: opts.wait && opts.wait(k) ? 'wait' : 'none' };
      // not in the translation: the hand-made gloss with one meaning is still right; anything else is a guess
      const first = list.find(c => c.t && !(opts.echo !== false && echoes(w, c.t)));
      if (!first) return { g: '', how: 'none' };
      // grammar words with no word of their own in Russian: the note of the hand-made list is right in any sentence
      // («å» — частица, «har» — вспом.); any other meaning not found in the translation is only a guess
      const t0 = first.full || first.t;
      if (first.src === 'dict' && !/[\/,;]/.test(t0) && /^\(|\((вспом|безл|частица|артикль)/.test(t0)) return { g: t0, how: 'dict', src: 'dict' };
      // «en: один/(артикль)» and «один» is not in the translation → it is the article here
      const note = first.src === 'dict' && String(t0).split('/').find(x => /^\((артикль|вспом|частица)/.test(x.trim()));
      if (note) return { g: note.trim(), how: 'dict', src: 'dict' };
      return { g: first.full || first.t, how: 'guess', src: first.src };
    });
  }

  /**
   * candidate meanings of one word, the most trusted first. L = lookups (all synchronous, from caches):
   *   cards(w) → [ru] (the user's own cards), dict(w) → hand-made gloss | null, mt(w) → single-word machine translation
   *   (cleaned; undefined = not asked yet), alts(w) → [ru] alternative translations, lemmas(w) → [dictionary forms]
   */
  function candidates(tok, L) {
    const f = String(tok || '').toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    const out = [];
    if (!f) return out;
    const all = (L.lemmas && L.lemmas(f)) || [];
    const lem = all[0] === f ? [] : all.filter(x => x && x !== f);
    const add = (t, src) => { t = String(t || '').trim(); if (t && /[а-яё]/i.test(t) && !out.some(c => c.t === t)) out.push({ t, src, full: t }); };
    [f, ...lem].forEach(x => ((L.cards && L.cards(x)) || []).forEach(t => add(t, 'card')));
    const d = L.dict ? L.dict(f) || (lem[0] ? L.dict(lem[0]) : null) : null; // only the most likely dictionary form («mener» is «mene», not «men» — «но»)
    if (d) add(d, 'dict');
    if (L.mt) { add(L.mt(f), 'mt'); lem.forEach(x => add(L.mt(x), 'mtl')); }
    // «FM-båndet», «DAB-radioen»: the Norwegian word after the hyphen carries the meaning
    const tail = /-/.test(f) ? f.split('-').pop() : '';
    if (tail && tail.length > 2 && /\p{L}/u.test(tail)) candidates(tail, L).forEach(c => add(c.t, c.src === 'mt' ? 'mtl' : c.src));
    if (L.alts) [f, ...lem].forEach(x => (L.alts(x) || []).forEach(t => add(t, 'alt')));
    return out;
  }

  /** is the Norwegian word `a` (from a back-translation) the token `f`: the same form or a shared dictionary form */
  function sameNo(a, f, lemmas) {
    a = bare(a); f = bare(f);
    if (!a || !f) return false;
    if (a === f) return true;
    const la = lemmas ? lemmas(a) || [] : [], lf = lemmas ? lemmas(f) || [] : [];
    return lf.includes(a) || la.some(x => x === f || lf.includes(x));
  }

  const Align = { stem, same, sameNo, translit, echoes, split, ruWords, align, candidates };
  if (root) root.Align = Align;
  if (typeof module !== 'undefined' && module.exports) module.exports = Align;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
