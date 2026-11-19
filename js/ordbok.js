/* ============ Ordbøkene (official Norwegian dictionary, ord.uib.no) -> card, with Russian translation ============
 * The API allows browser requests (CORS *), no key — works on phones too.
 * Norwegian definitions / examples / expressions are copied into the card, each followed by
 * its Russian translation in brackets: "motordrevet vogn … (транспортное средство с мотором …)".
 */
(function () {
  const API = 'https://ord.uib.no';
  const FORM_LABELS = {
    'Inf': 'Инфинитив (infinitiv)', 'Pres': 'Настоящее (presens)', 'Past': 'Прошедшее (preteritum)',
    '<PerfPart>': 'Причастие прош. (perfektum partisipp)', 'Imp': 'Повелительное (imperativ)', '<PresPart>': 'Причастие наст. (presens partisipp)',
    'Sing Ind': 'Неопр. ед. (ubestemt entall)', 'Sing Def': 'Опр. ед. (bestemt entall)', 'Plur Ind': 'Неопр. мн. (ubestemt flertall)', 'Plur Def': 'Опр. мн. (bestemt flertall)',
    'Pos Masc/Fem': 'м/ж род (positiv)', 'Pos Neuter': 'ср. род (positiv)', 'Pos Def': 'опр. форма', 'Pos Plur': 'мн. число', 'Cmp': 'Сравнительная (komparativ)',
    'Sup Ind': 'Превосходная (superlativ)', 'Sup Def': 'Превосходная опр.',
  };
  const CLASS_RU = { NOUN: 'существительное', VERB: 'глагол', ADJ: 'прилагательное', ADV: 'наречие', ADP: 'предлог', PRON: 'местоимение', CCONJ: 'союз', SCONJ: 'союз', INTJ: 'междометие', DET: 'определитель', EXPR: 'выражение' };
  const GENDER_RU = { Masc: 'мужской род (en)', Fem: 'женский род (ei)', Neuter: 'средний род (et)' };

  /** article JSON -> { lemma, wordClass, gender, forms, definitions:[{text, examples}], expressions:[{lemma, definitions}] } */
  function extract(article, concepts) {
    concepts = concepts || {};
    const abbr = id => { const c = concepts[id]; return c && c.expansion ? c.expansion : String(id).replace(/_/g, '.'); };
    function itemText(it) {
      switch (it.type_) {
        case 'usage': case 'superscript': case 'subscript': return it.items && it.items.length ? fill(it.text, it.items) : (it.text || '');
        case 'article_ref': return (it.lemmas || []).map(l => l.lemma).join(', ');
        case 'fraction': return it.numerator + '/' + it.denominator;
        case 'entity': case 'relation': case 'domain': case 'language': case 'grammar': case 'rhetoric': case 'temporal': return abbr(it.id);
        default: return it.text || (it.id ? abbr(it.id) : '');
      }
    }
    function fill(content, items) {
      let i = 0; items = items || [];
      return String(content || '').replace(/\$/g, () => { const it = items[i++]; return it ? itemText(it) : ''; }).replace(/\s+/g, ' ').trim();
    }
    const txt = o => o ? fill(o.content, o.items) : '';
    function senses(defs, out, subs) {
      (defs || []).forEach(d => {
        if (d.type_ !== 'definition') return;
        const expl = [], exs = [];
        (d.elements || []).forEach(e => {
          // "Se: fremst, først" is only a link to other articles — not part of the meaning (machine translation turns it into garbage)
          if (e.type_ === 'explanation') { const t = txt(e); if (t && !/^(se|sjå)\s*:/i.test(t)) expl.push(t); }
          else if (e.type_ === 'example') { const q = txt(e.quote), x = txt(e.explanation); if (q) exs.push(x ? `${q} (${x})` : q); }
          else if (e.type_ === 'sub_article' && e.article && subs) {
            subs.push({
              lemma: (e.article.lemmas || []).map(l => l.lemma).join(', ') || (e.lemmas || []).join(', '),
              definitions: senses(e.article.body && e.article.body.definitions, [], null),
            });
          }
        });
        if (expl.length || exs.length) out.push({ text: expl.join('; '), examples: exs });
        senses((d.elements || []).filter(e => e.type_ === 'definition'), out, subs);
      });
      return out;
    }
    const lem = (article.lemmas || [])[0] || {};
    const par = (lem.paradigm_info || [])[0] || {};
    const tags = par.tags || [];
    const expressions = [];
    return {
      id: article.article_id,
      lemma: (article.lemmas || []).map(l => l.lemma).join(', '),
      wordClass: tags[0] || null,
      gender: tags.slice(1).join(' ') || null,
      // all paradigms of the main word class (verbs often have a separate "-a" paradigm: snakka next to snakket)
      forms: (lem.paradigm_info || []).filter(p => (p.tags || [])[0] === tags[0]).flatMap(p => p.inflection || [])
        .filter(f => f.word_form).map(f => ({ tags: (f.tags || []).join(' '), form: f.word_form })),
      definitions: senses(article.body && article.body.definitions, [], expressions),
      expressions,
    };
  }

  const Ordbok = {
    _concepts: null,
    async concepts() {
      if (this._concepts) return this._concepts;
      // a failure is not remembered: next time the abbreviations are asked for again
      try { const r = await fetch(API + '/bm/concepts.json'); if (!r.ok) return {}; this._concepts = (await r.json()).concepts || {}; } catch (e) { return {}; }
      return this._concepts;
    },
    /** GET JSON from the dictionary; a refusal (429 / 5xx) says so plainly instead of «JSON parse error» */
    async getJSON(url) {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status === 429 ? 'словарь просит подождать (слишком много запросов) — попробуйте через минуту' : `словарь ответил ошибкой ${r.status} — попробуйте ещё раз`);
      return r.json();
    },
    /** an error in plain words (the browser says only «Load failed» / «Failed to fetch») */
    errText(e) {
      const m = String((e && e.message) || e || '');
      if (/load failed|failed to fetch|networkerror|network error/i.test(m)) return 'нет связи с сайтом словаря (интернет, VPN или блокировщик рекламы). Попробуйте ещё раз';
      if (/json|unexpected token|unexpected end|did not match the expected pattern/i.test(m)) return 'словарь ответил не так, как обычно (возможно, сайт временно недоступен). Попробуйте ещё раз через минуту';
      return m || 'неизвестная ошибка';
    },
    /** "**Hei!**" / "hus – huset" / "å snakke (говорить)" -> "hei" / "hus" / "snakke" (no markdown, punctuation or wildcards) */
    bare(no) {
      return String(no || '').split('\n')[0].replace(/\([^)]*\)/g, ' ').replace(/[*_`#!?¡¿"«»“”]/g, '').replace(/^(å|en|ei|et)\s+/i, '')
        .split(/[,;/–—]|\s-\s/)[0].replace(/[.:]+$/, '').trim();
    },

    /** find the dictionary article that fits the card (å … -> verb, en/ei/et … -> noun) */
    async lookup(card) {
      const word = this.bare(card.no);
      if (!word) throw new Error('Нет норвежского слова');
      const search = scope => this.getJSON(`${API}/api/articles?w=${encodeURIComponent(word)}&dict=bm&scope=${scope}`).then(s => ((s.articles || {}).bm || []).slice(0, 4));
      // exact headword first; then inflected forms too (huset -> hus, gikk -> gå)
      let ids = await search('e'), infl = false;
      if (!ids.length) { ids = await search('ei'); infl = true; }
      if (!ids.length && /\s/.test(word)) {
        // a phrase: maybe it is a fixed expression with its own article (ta det med ro), or starts with one (ha det bra -> ha det)
        try {
          const ws = word.split(/\s+/);
          for (let n = ws.length; n >= 2; n--) { const x = await this.expression(ws.slice(0, n).join(' ')); if (x) return x; }
        } catch (e) { /* not an expression */ }
        throw new Error(`Ordbøkene: «${word}» не найдено. Это словарь отдельных слов и устойчивых выражений — у обычной фразы или предложения статьи нет`);
      }
      if (!ids.length) throw new Error(`Ordbøkene: «${word}» не найдено`);
      const [concepts, articles] = await Promise.all([this.concepts(), Promise.all(ids.map(id => this.getJSON(`${API}/bm/article/${id}.json`)))]);
      const all = articles.map(a => extract(a, concepts));
      const no = String(card.no).trim();
      const want = /^å\s/i.test(no) ? 'VERB' : /^(en|ei|et)\s/i.test(no) ? 'NOUN' : (card.wordClass === 'verb' ? 'VERB' : card.wordClass === 'substantiv' ? 'NOUN' : card.wordClass === 'adjektiv' ? 'ADJ' : null);
      const hit = all.find(a => a.wordClass === want);
      if (hit || !infl || all.length < 2) return hit || all[0];
      // an inflected form fits several articles (huset: hus «дом» / huse «приютить»; snakket: snakke / snakk):
      // the more frequent word wins (Kelly frequency list, local file); without a rank — the shorter headword
      const ranks = await this.kellyRanks();
      const rank = a => ranks.get(String(a.lemma).split(',')[0].trim().toLowerCase()) || 99999;
      const score = a => rank(a) + String(a.lemma).length / 100;
      return all.slice().sort((x, y) => score(x) - score(y))[0];
    },
    /** word -> frequency rank (data/kelly.json, ≈6 000 words, loaded once) */
    _ranks: null,
    async kellyRanks() {
      if (this._ranks) return this._ranks;
      const m = new Map();
      try {
        const j = await (await fetch('data/kelly.json')).json();
        (j.words || []).forEach(([w, rank]) => { const k = String(w).toLowerCase(); if (!m.has(k)) m.set(k, +rank || 99999); });
        this._ranks = m;
      } catch (e) { /* offline: no ranks this time */ }
      return m;
    },

    /** article + Russian translation of every definition / example / expression (Google, free) */
    async build(card) {
      const a = await this.lookup(card);
      const isVerb = a.wordClass === 'VERB';
      // forms are translated with a pronoun: "spiste" -> "jeg spiste" -> "я ел"
      const verbQuery = f => f.tags === 'Inf' ? 'å ' + f.form : (f.tags === 'Pres' || f.tags === 'Past') ? 'jeg ' + f.form : f.tags === '<PerfPart>' ? 'jeg har ' + f.form : f.tags === 'Imp' ? f.form + '!' : f.form;
      // one form per grammatical slot; where Bokmål allows two (snakka / snakket) take the -et / standard one
      const bySlot = new Map();
      a.forms.forEach(f => {
        if (!FORM_LABELS[f.tags]) return;
        const had = bySlot.get(f.tags);
        const preferEt = had && (f.tags === 'Past' || f.tags === '<PerfPart>') && /a$/.test(had.form) && /et$/.test(f.form) && had.form.slice(0, -1) === f.form.slice(0, -2);
        if (!had || preferEt) bySlot.set(f.tags, f);
      });
      const order = Object.keys(FORM_LABELS);
      const out = {
        lemma: a.lemma, wordClass: a.wordClass, gender: a.gender, id: a.id,
        definitions: a.definitions.slice(0, 8).map(d => ({ no: d.text, ru: '', examples: d.examples.slice(0, 6).map(x => ({ no: x, ru: '' })) })),
        expressions: a.expressions.slice(0, 14).map(x => ({ no: x.lemma, ru: '', def: x.definitions[0] ? x.definitions[0].text : '' })),
        forms: [...bySlot.values()].sort((x, y) => order.indexOf(x.tags) - order.indexOf(y.tags))
          .slice(0, 8).map(f => ({ label: FORM_LABELS[f.tags], no: isVerb ? verbQuery(f) : f.form, ru: '' })),
      };
      // translators see a lone "prate, samtale" or "jatte med" as nouns / nonsense — for verbs, "å prate, å samtale" works
      const lemma1 = String(a.lemma).split(',')[0].trim();
      const asVerb = s => s.split(/\s*;\s*/).map(part => {
        if (!part || /^(å|brukt|særlig|om|i|ofte|også)\b|:/i.test(part)) return part;
        return part.split(/\s*,\s*/).map(p => /^å\s/i.test(p) || p.replace(/\([^)]*\)/g, ' ').trim().split(/\s+/).length > 4 ? p : 'å ' + p).join(', ');
      }).join('; ');
      const verbEx = s => isVerb && new RegExp('^' + U.escapeRegExp(lemma1) + '\\b', 'i').test(s) ? 'å ' + s : s;
      // every Norwegian phrase -> one list -> translated in one go (Google in batches, then the other translators / AI).
      // q = what is actually sent to the translator; post = fixed tail added after the translation.
      const slots = [];
      out.definitions.forEach(d => {
        if (d.no) {
          // "prate, samtale; jamfør snakkes" — a cross-reference is not translated ("jamfør snakkes" -> "ср. snakkes")
          const m = d.no.match(/^(.*?)[;,]?\s*\b(?:jamfør|jf\.)\s+([^;]+)$/i);
          const body = m && m[1].trim() ? m[1].trim() : d.no;
          slots.push({ o: d, q: isVerb ? asVerb(body) : body, post: m && m[1].trim() ? `; ср. ${m[2].trim()}` : '' });
        }
        d.examples.forEach(x => slots.push({ o: x, q: verbEx(x.no) }));
      });
      // idioms: a word-for-word translation is usually wrong ("snakke noen til rette" ≠ «сделать замечание»),
      // so the dictionary's own explanation of the idiom is translated instead
      out.expressions.forEach(x => slots.push({ o: x, q: x.def && x.def.length < 160 ? (isVerb ? asVerb(x.def) : x.def) : verbEx(x.no) }));
      out.forms.forEach(f => slots.push({ o: f, q: f.no }));
      const res = await Translators.translateMany(slots.map(s => s.q), 'no', 'ru');
      slots.forEach((s, i) => { s.o.ru = res.out[i] ? this.tidy(s.q, res.out[i]) + (s.post || '') : ''; });
      out.translatedBy = res.by;
      out.missing = res.missing;
      return out;
    },
    /** keep the dictionary style: "snakke med hverandre (поговорить…)", not "(Поговорить….)" */
    tidy(src, ru) {
      let t = String(ru).trim();
      if (/^\p{Ll}/u.test(src)) t = t.charAt(0).toLowerCase() + t.slice(1);
      if (!/[.]$/.test(src.trim())) t = t.replace(/\.$/, '');
      return t;
    },

    /**
     * 🤖 AI pass over the whole article: fixes idioms and dictionary notes that machine translators get wrong.
     * Mutates r (ru fields), returns the number of changed lines.
     */
    async refineAI(r) {
      const items = [];
      r.definitions.forEach(d => { if (d.no) items.push({ o: d, kind: 'definition' }); d.examples.forEach(x => items.push({ o: x, kind: 'example' })); });
      r.expressions.forEach(x => items.push({ o: x, kind: 'idiom', def: x.def }));
      (r.forms || []).forEach(f => items.push({ o: f, kind: 'word form: ' + f.label + ' — keep the tense' }));
      const user = `Norwegian Bokmål dictionary article (Ordbøkene) for «${r.lemma}» (${r.wordClass || ''}).
Check the Russian translation of every line. Idioms must be translated by their MEANING (use "def" — the dictionary explanation), not word for word.
Dictionary notes like "jamfør X" mean "ср. X" (keep X in Norwegian). Keep translations short, lower-case unless a full sentence.
Return ONLY a JSON array of Russian strings, same length and order.
${JSON.stringify(items.map(x => ({ no: x.o.no, kind: x.kind, ...(x.def ? { def: x.def } : {}), ru: x.o.ru || '' })))}`;
      const arr = AI.parseJSON(await AI.call({ system: 'You are an expert Norwegian–Russian lexicographer.', user, maxTokens: 3000, temperature: 0.1 }));
      if (!Array.isArray(arr)) throw new Error('Нейросеть вернула некорректный ответ — попробуйте ещё раз');
      let changed = 0;
      items.forEach((x, i) => {
        const v = String(arr[i] || '').trim();
        if (v && U.norm(v) !== U.norm(x.o.ru || '')) { x.o.ru = this.tidy(x.o.no, v); changed++; }
      });
      Translators.lastAI = AI.lastProvider;
      r.translatedBy = [...new Set([...(r.translatedBy || []), 'ai'])];
      r.missing = 0;
      return changed;
    },

    /**
     * Synonyms without AI: Ordbøkene definitions often ARE synonym lists ("oppfatte, skjønne; kunne").
     * Short comma-separated items (1–3 words) are taken, then translated by Google.
     */
    async synonyms(card) {
      const a = await this.lookup(card);
      const self = this.bare(card.no).toLowerCase();
      const seen = new Set([self]);
      const cands = [];
      a.definitions.slice(0, 4).forEach(d => String(d.text || '').split(/[;,]/).forEach(p => {
        const w = p.replace(/\([^)]*\)/g, '').trim();
        // keep real synonyms only: no notes ("brukt som adverb:"), no "x eller y", no phrases starting/ending with a preposition
        const PREP = /^(med|om|i|av|til|som|på|for|fra|ved|under|over|uten|mot|brukt|særlig|især|også)\b|\b(med|om|i|av|til|på|for|fra|ved|mot)$/i;
        if (!w || w.split(/\s+/).length > 2 || /\d|:|\beller\b|\bog\b/i.test(w) || PREP.test(w) || seen.has(w.toLowerCase())) return;
        seen.add(w.toLowerCase()); cands.push(w);
      }));
      if (!cands.length) throw new Error(`В Ordbøkene нет синонимов для «${self}» — подключите нейросеть для лучшего результата`);
      const pre = a.wordClass === 'VERB' ? 'å ' : '';
      return Promise.all(cands.slice(0, 6).map(async w => {
        const no = pre && !/^å\s/.test(w) ? pre + w : w;
        let ru = ''; try { ru = await Translators.translate('google', no, 'no', 'ru'); } catch (e) { /* ignore */ }
        return { no, ru, note: 'из словаря Ordbøkene' };
      }));
    },

    /** one article by id -> extracted { lemma, definitions:[{text, examples}], … } */
    async article(id) {
      const [concepts, a] = await Promise.all([this.concepts(), fetch(`${API}/bm/article/${id}.json`).then(r => r.json())]);
      return extract(a, concepts);
    },
    /**
     * a fixed expression ("ta det med ro", "av og til") -> its own dictionary article (Ordbøkene stores expressions
     * as separate articles). -> { id, lemma, definitions } or null if the dictionary does not have it.
     */
    async expression(phrase) {
      const idx = await this.exprIndex();
      const k = this.exprKey(phrase);
      const hit = idx.map.get(k) || idx.map.get(k.replace(/^å /, ''));
      if (!hit) return null;
      const a = await this.article(hit.id);
      if (!a.definitions.length) return null;
      a.lemma = this.exprLabel(a.lemma || hit.lemma);
      return a;
    },
    /** all ≈9 000 fixed expressions of Bokmålsordboka (lemma.json, 4.9 MB, loaded once): { list:[{lemma,id,key}], map } */
    _exprIndex: null,
    async exprIndex() {
      if (this._exprIndex) return this._exprIndex;
      const all = await (await fetch(API + '/bm/fil/lemma.json')).json();
      const list = all.filter(x => x[2] === 'EXPR' && /\s/.test(x[0]) && !/^[A-ZÆØÅ]{2,}/.test(x[0])).map(x => ({ lemma: x[0], id: x[1], key: this.exprKey(x[0]) }));
      const map = new Map();
      list.forEach(x => { if (!map.has(x.key)) map.set(x.key, x); });
      this._exprIndex = { list, map };
      return this._exprIndex;
    },
    /** comparable form: no "[noen|noe]" placeholders, no "…", lower case */
    exprKey(s) { return String(s || '').toLowerCase().replace(/\[[^\]]*\]/g, ' ').replace(/\.\.\.|…/g, ' ').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim(); },
    /** readable form: "ta [noen|noe] på kornet" -> "ta noen/noe på kornet" */
    exprLabel(s) { return String(s || '').replace(/\[([^\]]*)\]/g, (m, a) => a.replace(/\|/g, '/')).replace(/\s+/g, ' ').trim(); },
    /** expressions that start with / contain a word: autocomplete of Ordbøkene ("ta det" -> ta det kuli, ta det piano…) */
    async suggestExpressions(q, n = 30) {
      const r = await (await fetch(`${API}/api/suggest?q=${encodeURIComponent(q)}&dict=bm&include=e&n=${n}`)).json();
      const list = ((r.a || {}).exact || []).concat(((r.a || {}).inflect || []), ((r.a || {}).freetext || []));
      const seen = new Set();
      return list.map(x => Array.isArray(x) ? x[0] : x).filter(x => x && /\s/.test(x) && !seen.has(x) && seen.add(x));
    },

    title(r) {
      const cls = CLASS_RU[r.wordClass] || '';
      const g = r.gender ? GENDER_RU[r.gender.split(' ')[0]] || '' : '';
      return `📖 Ordbøkene · ${r.lemma}${cls ? ' — ' + cls : ''}${g ? ', ' + g : ''}`;
    },
    /** text block for the card: Norwegian + (Russian) */
    toText(r) {
      const p = (no, ru) => ru ? `${no} (${ru})` : no;
      const lines = [this.title(r)];
      r.definitions.forEach((d, i) => {
        if (d.no) lines.push(`${i + 1}. ${p(d.no, d.ru)}`);
        d.examples.forEach(x => lines.push(`   • ${p(x.no, x.ru)}`));
      });
      if (r.expressions.length) {
        lines.push('Uttrykk (выражения):');
        r.expressions.forEach(x => lines.push(`   • ${p(x.no, x.ru)}`));
      }
      return lines.join('\n');
    },
    /** put the block into the description: replaces an earlier Ordbøkene block, otherwise adds below */
    merge(description, block) { return this.mergeBlock(description, '📖 Ordbøkene ·', block); },
    /** generic: replace the block that starts with `marker` (same source), otherwise add below */
    mergeBlock(description, marker, block) {
      const d = String(description || '');
      const re = new RegExp(U.escapeRegExp(marker) + '[\\s\\S]*?(?=\\n\\n(?!   )|$)');
      if (re.test(d)) return d.replace(re, block);
      return d.trim() ? d.replace(/\s+$/, '') + '\n\n' + block : block;
    },
    siteUrl(card) { return 'https://ordbokene.no/nob/bm/' + encodeURIComponent(this.bare(card.no)); },
  };

  window.Ordbok = Ordbok;
})();
