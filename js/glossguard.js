/* ============ Norsk Kort — a guard for the word glosses of a neural network («по словам», v231) ============
 * Older prompts (and some networks even with the v226 prompt) put a grammar label instead of a meaning under a word
 * that HAS a meaning in its sentence: «Og det var min mormor som har brodert den» → var «(вспом. глагол)»,
 * som «(относит. слово)». Here «var» is the main verb («была») and «som» is «которая».
 * The guard keeps a note in brackets only where it is true:
 *   • a bracket-only note («(артикль)», «(-ся)», «(частица инфинитива)») — only on real function words;
 *   • «(вспом. глагол)» on a form of være / ha / bli / få or a modal — only when the same clause (up to som / at / og /
 *     men / , . ! ?) has a participle (har brodert, ble skrevet) or, after a modal, an infinitive (kan gå, å + verb);
 *     otherwise a bracket-only label is blanked (the word then gets its meaning from the dictionary / the sentence
 *     translation: var → «был(а)»), and «была (вспом. глагол)» loses only the note;
 *   • «som» with a bracket-only gloss → blanked («который / которая / кто» comes from the translation or the dictionary).
 * Pure functions, no DOM: also used by the node test (tools/test-glossguard.mjs).
 *   GlossGuard.check(words, glosses, opts) → { g: [...], blanked: [k…], stripped: [k…], content: n, bad: n, ratio }
 *   opts.isName(word, k) → true for names (not counted) · opts.lex(form) → [{ lemma, pos }] | null (Lexicon.peek)
 */
(function (root) {
  'use strict';
  const bare = w => String(w || '').toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  const S = a => new Set(a.split(/\s+/).filter(Boolean));

  // forms of the auxiliaries and modals
  const AUX = S(`være er var vært vere ha har hadde hatt bli blir ble blei blitt få får fikk fått
    kunne kan kunnet ville vil villet skulle skal skullet måtte må måttet burde bør
    is was`);
  const MODAL = S('kunne kan ville vil skulle skal måtte må burde bør få får fikk');
  // the clause ends at these words (the boundary word itself belongs to the next clause)
  const BOUND = S('som at og men eller fordi når hvis dersom mens da enn');
  // words that may carry ONLY a note in brackets (no lexical meaning of their own in many sentences):
  // articles, the infinitive marker, reflexives, the formal subject, the complementizer «at», modal particles
  const FUNC = S('en ei et den det de å seg meg deg oss dere dem der at jo vel nok');
  // prepositions / adverbs: a note only when it names a particle verb («(часть «ta på seg»)»), never «(предлог)»
  const PARTICLE = S('på av opp ut inn ned fram frem bort til med om over igjen tilbake etter fra sammen unna løs i');
  // words that end like a participle but are not («det», «godt», «med»)
  const NOT_PART = S(`det at et ut alt litt mitt ditt sitt vårt hvit nytt fint stort lett rett fort natt mat slutt rundt
    sist best først mest minst nest godt helt vant bort sant kort kaldt varmt mykt sterkt høyt lavt
    med ved ned god glad tid sted rød død brød hund land bord ord fjord sand verd fred bad blad
    snart samt hit dit mot slett nett tett`);
  // strong / irregular participles (the suffix test below does not see all of them)
  const STRONG = S(`vært hatt blitt fått gått sett sagt gjort tatt gitt kommet skrevet funnet sittet ligget stått sovet
    drukket spist vunnet brutt forsvunnet skjedd dødd bodd fløyet flydd løpt sunget hjulpet tvunget truffet sprunget
    skutt brent lest kjørt hørt kjøpt solgt fortalt valgt lagt satt dratt slått grått lått bedt fridd født glemt husket
    begynt sluttet laget brodert reist flyttet jobbet snakket spurt svart trengt lært møtt`);
  // short infinitives (no -e)
  const SHORT_INF = S('gå se ha bli få ta gi dø stå slå nå be by si le spå snu bo tro gro må');

  function isParticiple(w, lex) {
    const b = bare(w);
    if (b.length < 3 || NOT_PART.has(b)) return false;
    if (STRONG.has(b)) return true;
    if (lex) {
      const r = lex(b);
      // the dictionary knows the form: a participle is a verb form other than the infinitive, ending in -t / -d
      // («mørkt» is only an adjective → no; «brodert», «skrevet» → yes)
      if (Array.isArray(r) && r.length) return r.some(x => x && x.pos === 'verb' && String(x.lemma || '').toLowerCase() !== b) && /(t|d)$/.test(b);
    }
    return /(?:[^aeiouyæøå]t|et|tt|dd|[lnr]d|vd)$/.test(b);
  }
  function isInfinitive(w, lex) {
    const b = bare(w);
    if (!b || AUX.has(b) && !/^(ha|bli|få|være|vere)$/.test(b)) return false;
    if (SHORT_INF.has(b)) return true;
    if (lex) {
      const r = lex(b);
      if (Array.isArray(r) && r.length) return r.some(x => x && x.pos === 'verb' && String(x.lemma || '').toLowerCase() === b);
    }
    return b.length > 2 && /e$/.test(b) && !FUNC.has(b) && !/^(alle|mange|denne|hele|andre|samme|egne|mine|dine|sine|fine|store|gamle|nye|unge|eneste|ingenting|ikke|deres|disse|hvilke)$/.test(b);
  }
  /** does the auxiliary at k really build a compound tense / passive / modal construction in its clause? */
  function auxOk(words, k, lex) {
    const a = bare(words[k]);
    if (/[,.!?;:…]["»”)]*$/.test(String(words[k]))) return false; // «…, var.» — nothing follows in its clause
    const modal = MODAL.has(a);
    for (let j = k + 1; j < words.length && j <= k + 8; j++) {
      const w = words[j], b = bare(w);
      if (BOUND.has(b)) break;
      if (isParticiple(w, lex)) return true;
      if (modal && b === 'å' && j + 1 < words.length && isInfinitive(words[j + 1], lex)) return true;
      if (modal && isInfinitive(w, lex)) return true;
      if (/[,.!?;:…]["»”)]*$/.test(String(w))) break;
    }
    return false;
  }
  const onlyNote = g => /^\(\s*[^()]*\)$/.test(String(g || '').trim());
  const AUX_LABEL = /вспом|модал|пассив|связк|auxil/i;
  const REL_LABEL = /относит|relat|союз|подчин/i;

  /** one gloss of word k → the cleaned gloss ('' = blanked) and what happened */
  function one(words, k, g, lex) {
    const t = String(g == null ? '' : g).trim();
    if (!t || !/\(/.test(t)) return { g: t };
    const b = bare(words[k]);
    if (onlyNote(t)) {
      if (b === 'som') return { g: '', act: 'blank' };
      if (AUX.has(b)) return AUX_LABEL.test(t) && auxOk(words, k, lex) ? { g: t } : { g: '', act: 'blank' };
      if (PARTICLE.has(b)) return /часть|particle/i.test(t) ? { g: t } : { g: '', act: 'blank' };
      if (FUNC.has(b)) return AUX_LABEL.test(t) || (REL_LABEL.test(t) && b !== 'at') ? { g: '', act: 'blank' } : { g: t };
      return { g: '', act: 'blank' }; // a content word with only a label: no meaning shown is better than a wrong one
    }
    // «была (вспом. глагол)»: the meaning stays; the note goes when it is not true
    if (AUX_LABEL.test(t) && (!AUX.has(b) || !auxOk(words, k, lex))) {
      const s = t.replace(/\s*\([^()]*(?:вспом|модал|пассив|связк|auxil)[^()]*\)\s*/gi, ' ').replace(/\s+/g, ' ').trim();
      if (s !== t) return s && /[а-яё]/i.test(s) ? { g: s, act: 'strip' } : { g: '', act: 'blank' };
    }
    if (b === 'som' && REL_LABEL.test(t)) {
      const s = t.replace(/\s*\([^()]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
      return s && /[а-яё]/i.test(s) ? { g: s, act: 'strip' } : { g: '', act: 'blank' };
    }
    return { g: t };
  }

  function check(words, glosses, opts = {}) {
    const lex = typeof opts.lex === 'function' ? opts.lex : null;
    const isName = typeof opts.isName === 'function' ? opts.isName : () => false;
    const out = [], blanked = [], stripped = [];
    let content = 0;
    (words || []).forEach((w, k) => {
      const g = Array.isArray(glosses) ? glosses[k] : '';
      if (isName(w, k)) { out.push(g == null ? '' : String(g)); return; }
      if (!FUNC.has(bare(w))) content++;
      const r = one(words, k, g, lex);
      if (r.act === 'blank') blanked.push(k); else if (r.act === 'strip') stripped.push(k);
      out.push(r.g);
    });
    const bad = blanked.filter(k => !FUNC.has(bare(words[k]))).length;
    return { g: out, blanked, stripped, content, bad, ratio: content ? bad / content : 0 };
  }
  /** a whole answer is rejected when the guard had to blank more than 30 % of its content words */
  function reject(res) { return !!res && res.content > 0 && res.bad / res.content > 0.3; }

  const api = { check, reject, auxOk, isParticiple, isInfinitive, onlyNote, bare, AUX, FUNC };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GlossGuard = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null);
