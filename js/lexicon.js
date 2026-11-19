/* Norsk Kort — offline Bokmål lexicon (lemmatiser, genders, paradigms).
 * Data: Norsk ordbank bokmål 2005 (Språkbanken / Nasjonalbiblioteket, CC BY 4.0), preprocessed into
 *   data/lexicon/forms.json      — every form → lexeme (lemma, part of speech, gender), ~1 MB (≈0.3 MB gzip)
 *   data/lexicon/paradigms.json  — full paradigms of the ~17 600 most frequent inflecting lemmas (≈0.33 MB gzip)
 * ranked by FrequencyWords no_50k (OpenSubtitles 2018, CC BY-SA 4.0).
 * Both files are fetched lazily on first use and kept in memory; the service worker caches them for offline use.
 *
 * API (all async, resolve after the data is loaded):
 *   Lexicon.ready()                 → Promise (forms index loaded)
 *   Lexicon.lemma(form)             → 'hus' | null                       best lemma
 *   Lexicon.lemmas(form)            → [{lemma, pos, gender}]             all readings, most likely first
 *   Lexicon.paradigm(lemma, pos?)   → {lemma, pos, gender, forms:{slot:[variants]}, aForms:[...]} | null
 *   Lexicon.paradigms(lemma)        → [paradigm, ...]                    all homographs
 *   Lexicon.gender(noun)            → 'm' | 'f' | 'n' | ['m','f'] | null (accepts inflected forms too)
 *   Lexicon.isKnownWord(w)          → boolean
 *   Lexicon.allForms(lemma, pos?)   → ['hus','huset','husa','husene']   (for highlighting / matching in texts)
 *   Lexicon.peek(form)              → same as lemmas() but synchronous; null while not loaded yet
 *   Lexicon.attribution             → 'Norsk ordbank (Språkbanken, CC BY)'
 * pos values: subst verb adj adv pron det prep konj sbu interj fork pref inf-merke
 * paradigm slots: subst sgIndef sgDef plIndef plDef · verb inf pres pret perf imp pass presPart perfPartMF perfPartN
 *   perfPartDef perfPartPl · adj mf f n def pl comp sup supDef · pron nom akk · det m f n def pl
 * Variants inside a slot: standard (moderate) Bokmål first; a-forms / optional feminine forms come last and are listed
 * in aForms (e.g. jente: sgDef ['jenten','jenta'], aForms ['jenta']).
 */
(function (root) {
  'use strict';
  const BASE = (root && root.LEXICON_BASE) || 'data/lexicon/';
  const POS = { s: 'subst', v: 'verb', a: 'adj', r: 'adv', p: 'pron', d: 'det', P: 'prep', k: 'konj', S: 'sbu',
    i: 'interj', f: 'fork', y: 'symb', x: 'pref', I: 'inf-merke' };
  const POS_ALIAS = { noun: 'subst', substantiv: 'subst', n: 'subst', verb: 'verb', v: 'verb', adjective: 'adj', adjektiv: 'adj',
    adj: 'adj', adverb: 'adv', adv: 'adv', pronoun: 'pron', pronomen: 'pron', pron: 'pron', determiner: 'det', determinativ: 'det',
    det: 'det', preposition: 'prep', preposisjon: 'prep', prep: 'prep', conjunction: 'konj', konjunksjon: 'konj', konj: 'konj',
    subjunksjon: 'sbu', sbu: 'sbu', interjection: 'interj', interjeksjon: 'interj', interj: 'interj', subst: 'subst' };

  let loader = async name => {
    const res = await fetch(BASE + name);
    if (!res.ok) throw new Error('Lexicon: ' + name + ' HTTP ' + res.status);
    return res.json();
  };

  // ---- forms index ----
  let LEX = null;      // [{lemma, pos, g, forms:[...]}] (index = frequency rank)
  let FORM = null;     // Map form → [lex index, ...] (most likely first)
  let formsP = null;
  function loadForms() {
    if (!formsP) formsP = Promise.resolve().then(() => loader('forms.json')).then(buildForms)
      .catch(e => { formsP = null; throw e; });
    return formsP;
  }
  function buildForms(d) {
    const lex = new Array(d.lex.length), form = new Map();
    for (let i = 0; i < d.lex.length; i++) {
      const p = d.lex[i].split('|');
      const lemma = p[0], code = p[1] || '';
      const forms = [lemma.toLowerCase()];
      if (p[2]) for (const f of p[2].split(',')) if (f && f !== forms[0]) forms.push(f);
      lex[i] = { lemma, pos: POS[code[0]] || code[0], g: code.slice(1), forms };
      for (const f of forms) { const a = form.get(f); if (a) { if (a[a.length - 1] !== i) a.push(i); } else form.set(f, [i]); }
    }
    for (const f in d.amb || {}) form.set(f, d.amb[f]);
    LEX = lex; FORM = form;
  }

  // ---- paradigms ----
  let PARA = null;     // Map lemma(lower) → [raw line, ...] (frequency order)
  let SLOTS = null;
  let parasP = null;
  function loadParadigms() {
    if (!parasP) parasP = Promise.resolve().then(() => loader('paradigms.json')).then(d => {
      const m = new Map();
      for (const line of d.p) {
        const k = line.slice(0, line.indexOf('|')).toLowerCase();
        const a = m.get(k); if (a) a.push(line); else m.set(k, [line]);
      }
      SLOTS = d.slots; PARA = m;
    }).catch(e => { parasP = null; throw e; });
    return parasP;
  }
  function decodeParadigm(line) {
    const p = line.split('|');
    const code = p[1], pos = POS[code[0]] || code[0], names = SLOTS[code[0]] || [];
    const forms = {}, aForms = [];
    for (let i = 0; i < names.length; i++) {
      const cell = p[i + 2];
      if (!cell) continue;
      forms[names[i]] = cell.split(',').map(v => {
        if (v.endsWith('*')) { v = v.slice(0, -1); if (!aForms.includes(v)) aForms.push(v); }
        return v;
      });
    }
    return { lemma: p[0], pos, gender: genderOut(code.slice(1)), forms, aForms };
  }

  // ---- helpers ----
  function norm(w) {
    if (w == null) return '';
    return String(w).normalize('NFC').replace(/[’ʼ`´]/g, "'").trim()
      .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').toLowerCase();
  }
  function normPos(pos) { if (!pos) return null; const k = String(pos).toLowerCase(); return POS_ALIAS[k] || k; }
  function genderOut(g) {
    if (!g) return null;
    const a = [...new Set(g.split(''))].sort((x, y) => 'mfn'.indexOf(x) - 'mfn'.indexOf(y));
    return a.length === 1 ? a[0] : a;
  }
  function candidates(form) {
    const ids = FORM.get(norm(form));
    if (!ids) return [];
    const out = [], seen = new Map();
    for (const i of ids) {
      const L = LEX[i]; if (!L) continue;
      const key = L.lemma + '|' + L.pos;
      const prev = seen.get(key);
      if (prev) { prev._g += L.g; prev.gender = genderOut(prev._g); continue; }
      const c = { lemma: L.lemma, pos: L.pos, gender: genderOut(L.g), _g: L.g };
      seen.set(key, c); out.push(c);
    }
    return out.map(({ lemma, pos, gender }) => ({ lemma, pos, gender }));
  }

  const Lexicon = {
    attribution: 'Norsk ordbank (Språkbanken, CC BY)',
    attributionHTML: 'Norsk ordbank bokmål 2005, <a href="https://www.nb.no/sprakbanken/ressurskatalog/oai-nb-no-sbr-5/" target="_blank" rel="noopener">Språkbanken / Nasjonalbiblioteket</a>, CC BY 4.0',
    ready() { return loadForms(); },
    loaded() { return !!FORM; },
    async lemmas(form) { await loadForms(); return candidates(form); },
    async lemma(form) {
      await loadForms();
      const c = candidates(form);
      return c.length ? c[0].lemma : null;
    },
    peek(form) { return FORM ? candidates(form) : null; },
    async isKnownWord(w) { await loadForms(); return FORM.has(norm(w)); },
    async gender(noun) {
      await loadForms();
      const key = norm(noun);
      const nouns = candidates(noun).filter(c => c.pos === 'subst' && c.gender);
      if (!nouns.length) return null;
      // prefer a noun whose lemma is the word itself (the user typed a dictionary form)
      const exact = nouns.find(c => c.lemma.toLowerCase() === key);
      return (exact || nouns[0]).gender;
    },
    async paradigms(lemma) {
      await loadParadigms();
      const lines = PARA.get(norm(lemma)) || [];
      const exact = String(lemma || '').trim();
      // exact-case matches first (e.g. 'I' pronoun vs 'i' preposition)
      return lines.map(decodeParadigm).sort((a, b) => (b.lemma === exact) - (a.lemma === exact));
    },
    async paradigm(lemma, pos) {
      const want = normPos(pos);
      let list = (await this.paradigms(lemma)).filter(p => !want || p.pos === want);
      if (!list.length) {
        // maybe an inflected form was passed: resolve it to its lemma first
        const c = (await this.lemmas(lemma)).filter(x => !want || x.pos === want);
        for (const x of c) {
          list = (await this.paradigms(x.lemma)).filter(p => p.pos === x.pos);
          if (list.length) break;
        }
        if (!list.length && c.length) {
          const x = c[0];   // known but uninflected (prep, adv, …) or rare: minimal object
          return { lemma: x.lemma, pos: x.pos, gender: x.gender, forms: {}, aForms: [] };
        }
      }
      return list[0] || null;
    },
    async allForms(lemma, pos) {
      await loadForms();
      const want = normPos(pos), key = norm(lemma), out = [];
      for (const i of FORM.get(key) || []) {
        const L = LEX[i];
        if (L.lemma.toLowerCase() !== key || (want && L.pos !== want)) continue;
        for (const f of L.forms) if (!out.includes(f)) out.push(f);
      }
      return out;
    },
    // testing / embedding hook: replace the JSON loader (name → Promise<object>)
    _setLoader(fn) { loader = fn; formsP = parasP = null; LEX = FORM = PARA = SLOTS = null; },
  };

  if (root) root.Lexicon = Lexicon;
  if (typeof module !== 'undefined' && module.exports) module.exports = Lexicon;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
