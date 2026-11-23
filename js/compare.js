/* ============ ⚖️ Сравнение переводов — everything inside the app ============
 * Every service that can be called runs at once; the results fill in place (fixed rows, nothing jumps):
 *   translators — MyMemory, Google (limit → the Mac bridge / Mozhi), Microsoft and DeepL (with the user's free key),
 *   every connected neural network (translation + a short note),
 *   dictionaries — Ordbøkene (lemma, word class, the form of the word, a definition), Wiktionary (form, meaning),
 *   Tatoeba (sentences translated by people).
 * Below: the COMPARISON — agreement in percent, ✓ / ≈ / ✗ per service, dictionary evidence, the card's current
 * translation checked, and (if a neural network is connected) its verdict as JSON: best translation, what is right or
 * wrong and why, errors on the card, confidence. Actions: insert the best variant, add the explanation to the card.
 * Sites that give apps no data (Glosbe, NAOB, LEXIN, Forvo, Яндекс) — one calm line each, collapsed at the bottom.
 * Results are kept for the session per (text, direction): reopening is instant.
 * Opened through Translators.compareDialog(text, from, to, onPick, opts) (js/translators.js loads this file).
 * opts (optional): { current: 'the card's translation now', onExplain(block, marker, by, note) }.
 */
(function () {
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  const T_SVC = 12000;      // a translator / dictionary has 12 s
  const T_AI = 35000;       // a neural network (Claude through the bridge takes longer)
  const T_VERDICT = 45000;  // the verdict
  const MARKER = '⚖️ Сравнение переводов ·';
  const TR_ORDER = ['deepl', 'google', 'microsoft', 'mymemory'];
  const WEIGHT = { deepl: 1.25, google: 1, microsoft: 1, mymemory: 0.75, ai: 1.25 };
  const SITE_WHY = {
    glosbe: 'Glosbe не даёт приложениям доступ к своим данным — смотреть можно только на сайте.',
    naob: 'Академический словарь NAOB работает только на своём сайте.',
    lexin: 'Словарь LEXIN работает только на своём сайте. Слово скопируем — останется вставить его в поиск.',
    forvo: 'Записи носителей можно послушать только на самом Forvo.',
    yandex: 'Яндекс не даёт приложениям бесплатный доступ — только на своём сайте.',
  };
  const CLS_RU = { NOUN: 'существительное', VERB: 'глагол', ADJ: 'прилагательное', ADV: 'наречие', ADP: 'предлог', PRON: 'местоимение', CCONJ: 'союз', SCONJ: 'союз', INTJ: 'междометие', DET: 'определитель', EXPR: 'выражение' };
  const FORM_RU = {
    Inf: 'инфинитив', Pres: 'настоящее время (presens)', Past: 'прошедшее время (preteritum)', '<PerfPart>': 'причастие прошедшего времени (perfektum partisipp)',
    Imp: 'повелительное наклонение (imperativ)', '<PresPart>': 'причастие настоящего времени', 'Sing Ind': 'единственное число, неопределённая форма',
    'Sing Def': 'единственное число, определённая форма', 'Plur Ind': 'множественное число, неопределённая форма', 'Plur Def': 'множественное число, определённая форма',
    Cmp: 'сравнительная степень', 'Sup Ind': 'превосходная степень', 'Sup Def': 'превосходная степень',
  };
  // which Russian verb form fits the Norwegian one
  const WANT = { Pres: 'pres', Past: 'past', '<PerfPart>': 'past', Inf: 'inf' };
  const RU_FORM = { inf: 'неопределённая форма (инфинитив)', pres: 'настоящее время', past: 'прошедшее время' };
  const PRON = /^(я|ты|он|она|оно|мы|вы|они)\s+/;

  const cache = new Map();
  const esc = s => U.esc(String(s == null ? '' : s));
  const bridgeUp = () => !!(window.AI && AI.bridge && AI.bridge.up);
  const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
  const ofN = n => `${n} ${plural(n, 'сервиса', 'сервисов', 'сервисов')}`;
  const pct = (k, n) => n ? Math.round(k / n * 100) : 0;
  const q = s => `«${String(s).trim()}»`;
  const cap = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
  const low = s => String(s || '').charAt(0).toLowerCase() + String(s || '').slice(1);

  /** a promise with a time limit: «Google не ответил за 12 секунд» (the request itself is stopped too) */
  function within(p, ms, name, ctl) {
    let t;
    return Promise.race([p, new Promise((_, rej) => {
      t = setTimeout(() => { try { ctl && ctl.abort(); } catch (e) { /* gone */ } rej(Object.assign(new Error(`${name} не ответил за ${Math.round(ms / 1000)} секунд`), { timeout: true })); }, ms);
    })]).finally(() => clearTimeout(t));
  }
  const proxyGet = (url, signal) => fetch('/api/proxy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, method: 'GET' }), signal });
  /** GET JSON; the browser cannot reach it (CORS, blocker) and the Mac bridge runs → the bridge asks (allowed hosts only) */
  async function getJSON(url, signal, bridgeOk) {
    let r;
    try { r = await fetch(url, { signal }); } catch (e) {
      if ((signal && signal.aborted) || !bridgeOk || !bridgeUp()) throw e;
      r = await proxyGet(url, signal);
    }
    if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { status: r.status });
    return r.json();
  }
  const stripTags = h => String(h || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

  /* ---------- normalising and grouping the answers ---------- */
  function nrm(s, to) {
    let t = U.norm(String(s || '').split('\n')[0]);
    if (to === 'ru' && PRON.test(t) && t.split(' ').length <= 3) t = t.replace(PRON, '');
    if (to === 'no') t = t.replace(/^(å|en|ei|et)\s+/, '');
    return t;
  }
  function stemEq(a, b) {
    if (a === b) return true;
    let n = 0; while (n < a.length && n < b.length && a[n] === b[n]) n++;
    return n >= 4 || (n >= 3 && n >= Math.min(a.length, b.length) - 1);
  }
  /** the same word in another form («надеюсь» / «надеяться»), or the short answer inside the long one */
  function sameLex(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const wa = a.split(' '), wb = b.split(' ');
    if (wa.length !== wb.length) {
      const [s, l] = wa.length < wb.length ? [wa, wb] : [wb, wa];
      return s.length <= 2 && s.every(w => l.some(x => stemEq(w, x)));
    }
    return wa.every((w, i) => stemEq(w, wb[i]));
  }
  /** a Russian verb form by its ending (only used when the dictionary says the source is a verb) */
  function ruForm(n) {
    const w = String(n || '').split(' ')[0];
    if (!w || !/^[а-я]+$/.test(w)) return '';
    if (/(ть|ти|чь)(ся|сь)?$/.test(w)) return 'inf';
    if (/(л|ла|ло|ли)(сь|ся)?$/.test(w)) return 'past';
    if (/(ю|у|ешь|ет|ем|ете|ут|ют|ишь|ит|им|ите|ат|ят)(сь|ся)?$/.test(w)) return 'pres';
    return '';
  }
  const variants = (text, to) => U.alternatives(text).map(v => ({ raw: v.replace(/[.!?…]+$/, '').trim(), n: nrm(v, to) })).filter(v => v.n);

  /* ---------- the services ---------- */
  const R = {
    async google(e, signal) {
      const T = Translators, bridge = bridgeUp();
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${e.from}&tl=${e.to}&dt=t&dt=bd&q=${encodeURIComponent(e.text)}`;
      let r = null, via = '';
      // Google asked for a pause a moment ago: not a single request from this browser until it ends
      if (!T.gCooling()) {
        try { r = await fetch(url, { signal }); } catch (err) { if (signal.aborted) throw err; }
        if (r && !r.ok && (r.status === 429 || r.status === 403)) T.gCool();
      }
      // refused / resting / no link: the Mac bridge asks once (another client, often still allowed)
      if ((!r || !r.ok) && bridge) {
        try { const b = await proxyGet(url, signal); if (b.ok) { r = b; via = 'через мост на Mac'; } } catch (err) { if (signal.aborted) throw err; }
      }
      if (!r || !r.ok) {
        // the spare: Google's own translation through the open Mozhi servers
        if (!T.trResting('mozhi')) {
          try { const t = await T.mozhiOne(e.text, e.from, e.to); if (t) return { text: t, alts: [], via: 'через Mozhi' }; } catch (err) { /* below */ }
        }
        if (T.gCooling()) {
          const min = Math.max(1, Math.ceil(((T._gCoolUntil || Date.now()) - Date.now()) / 60000));
          throw new Error(`Google просит сделать паузу — повторите примерно через ${min} мин`);
        }
        throw new Error(r ? 'Google сейчас не ответил — попробуйте ещё раз' : 'Нет связи с Google Переводчиком');
      }
      const j = await r.json();
      const main = ((j && j[0]) || []).map(x => (x && x[0]) || '').join('').trim();
      if (!main) throw new Error('Google не прислал перевод');
      const alts = [];
      ((j && j[1]) || []).forEach(g => (g[1] || []).forEach(t => { if (alts.length < 6 && t && U.norm(t) !== U.norm(main) && !alts.some(a => U.norm(a) === U.norm(t))) alts.push(t); }));
      return { text: main, alts, via };
    },
    async mymemory(e, signal) {
      const c = { no: 'nb', ru: 'ru' };
      const j = await getJSON(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(e.text)}&langpair=${c[e.from]}|${c[e.to]}`, signal, false);
      const main = j && j.responseData && j.responseData.translatedText;
      if (!main || /MYMEMORY WARNING|INVALID|QUERY LENGTH/i.test(main)) {
        if (/WARNING/i.test(main || '')) Translators.trRest('mymemory', 60);
        throw new Error(/WARNING/i.test(main || '') ? 'MyMemory: дневной лимит исчерпан — завтра снова заработает' : 'MyMemory не нашёл перевода');
      }
      const alts = [];
      (j.matches || []).forEach(m => { const t = String(m.translation || '').trim(); if (t && t.length < 60 && U.norm(t) !== U.norm(main) && !alts.some(a => U.norm(a) === U.norm(t))) alts.push(t); });
      return { text: String(main).trim(), alts: alts.slice(0, 5) };
    },
    async deepl(e) {
      const t = await Translators.translate('deepl', e.text, e.from, e.to);
      if (!t) throw new Error('DeepL не прислал перевод');
      return { text: t, alts: [] };
    },
    async microsoft(e) {
      const t = await Translators.translate('microsoft', e.text, e.from, e.to);
      if (!t) throw new Error('Microsoft не прислал перевод');
      return { text: t, alts: [] };
    },
    async ai(e, signal, id) {
      const sys = e.from === 'no'
        ? 'Translate the Norwegian (Bokmål) text into natural, idiomatic Russian (no calques). Keep the grammatical form of the source exactly — tense, person, number: a bare present-tense verb like "spiser" is «ем / ест» (present), not the infinitive «есть» (that would be "å spise"). If there are 2–3 common equivalents, separate them with ", ". Return ONLY JSON: {"t":"<translation>","note":"<one short remark in Russian, max 90 characters: the form of the word or a nuance of meaning>"}'
        : 'Translate the Russian text into natural Norwegian Bokmål. Keep the grammatical form of the source (tense, person, number); a Russian infinitive becomes "å" + infinitive, a noun in the dictionary form gets en/ei/et. If there are 2–3 common equivalents, separate them with ", ". Return ONLY JSON: {"t":"<translation>","note":"<one short remark in Russian, max 90 characters: the form of the word or a nuance of meaning>"}';
      const raw = await AI.call({ system: sys, user: e.text, maxTokens: 260, temperature: 0.1, quiet: true, provider: id });
      let o = null;
      try { o = AI.parseJSON(raw); } catch (err) { /* plain text answer */ }
      let t = o && typeof o === 'object' && (o.t || o.translation) ? String(o.t || o.translation) : String(raw || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim().split('\n')[0];
      t = t.replace(/^["«]+|["»]+$/g, '').trim();
      if (!t || /^[{[]/.test(t)) throw new Error(`${AI.name(id)} прислал пустой ответ`);
      return { text: t, alts: [], note: o && o.note ? String(o.note).trim().slice(0, 160) : '' };
    },
    /** Ordbøkene: lemma, word class, which form the source is, the first definition */
    async ordbok(e, signal, word) {
      const a = await Ordbok.lookup({ no: word });
      const w = Ordbok.bare(word).toLowerCase();
      const tags = [...new Set((a.forms || []).filter(f => String(f.form).toLowerCase() === w).map(f => f.tags))];
      const d = (a.definitions || []).find(x => x.text) || {};
      return { lemma: String(a.lemma || ''), cls: a.wordClass || '', gender: a.gender || '', tags, def: String(d.text || '').slice(0, 220), defRu: '', word: w };
    },
    /** Wiktionary: the form («present of håpe») from en.wiktionary, the Russian meaning from ru.wiktionary */
    async wikt(e, signal, word) {
      const w = String(word || '').toLowerCase().trim();
      let j = null;
      try { j = await getJSON(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(w.replace(/ /g, '_'))}?redirect=true`, signal, false); }
      catch (err) { if (err.status !== 404) throw err; }
      const entries = j ? Object.values(j).flat().filter(x => x && /Norwegian( Bokmål)?$/.test(x.language || '') && !/Nynorsk/.test(x.language || '')) : [];
      const defs = entries.flatMap(x => (x.definitions || []).map(d => ({ pos: x.partOfSpeech || '', text: stripTags(d.definition) }))).filter(d => d.text);
      let form = '', of = '';
      const f = defs.length ? defs[0].text : '';
      const M = [[/^(?:simple )?present(?: tense)?(?: form)? of\s+(\S+)/i, 'Pres'], [/^(?:simple )?(?:past|preterite)(?: tense)? of\s+(\S+)/i, 'Past'],
        [/^past participle of\s+(\S+)/i, '<PerfPart>'], [/^imperative of\s+(\S+)/i, 'Imp'], [/^definite singular of\s+(\S+)/i, 'Sing Def'],
        [/^indefinite plural of\s+(\S+)/i, 'Plur Ind'], [/^definite plural of\s+(\S+)/i, 'Plur Def']];
      for (const [rx, tag] of M) { const m = f.match(rx); if (m) { form = tag; of = m[1].replace(/[.,;]+$/, ''); break; } }
      const verb = defs.some(d => /verb/i.test(d.pos));
      // the Russian meaning of the dictionary form (ru.wiktionary has many Norwegian entries)
      let ru = '';
      try {
        const title = of || w;
        const r = await getJSON(`https://ru.wiktionary.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=wiki&redirects=1&titles=${encodeURIComponent(title)}&format=json&origin=*`, signal, false);
        const page = Object.values((r && r.query && r.query.pages) || {})[0] || {};
        const x = String(page.extract || '');
        const at = x.search(/^=+\s*(Норвежский|Букмол|Норвежский \(букмол\))\s*=+\s*$/m);
        if (at >= 0) {
          const sec = x.slice(at);
          const z = sec.search(/^=+\s*Значение\s*=+\s*$/m);
          if (z >= 0) {
            const body = sec.slice(z).split('\n').slice(1);
            const out = [];
            for (const line of body) { if (/^=/.test(line)) break; const t = line.split('◆')[0].replace(/\s+/g, ' ').trim(); if (t && /[а-яё]/i.test(t)) out.push(t); if (out.length >= 2) break; }
            ru = out.join('; ');
          }
        }
      } catch (err) { /* ru.wiktionary is extra */ }
      if (!defs.length && !ru) throw Object.assign(new Error('В Wiktionary нет статьи об этом слове'), { empty: true });
      return { gloss: defs.slice(0, 2).map(d => d.text).join('; ').slice(0, 200), glossRu: '', form, of, verb, ru: ru.slice(0, 160), word: w };
    },
    /** Tatoeba: sentences with the exact word, translated by people */
    async tatoeba(e, signal) {
      const word = e.from === 'no' ? Ordbok.bare(e.text) : e.text.replace(/[.!?…]+$/, '').trim();
      const single = !/\s/.test(word);
      const [sl, tl] = e.from === 'no' ? ['nob', 'rus'] : ['rus', 'nob'];
      const url = `https://api.tatoeba.org/v1/sentences?lang=${sl}&q=${encodeURIComponent(single ? '=' + word.toLowerCase() : word)}&trans:lang=${tl}&showtrans=matching&sort=relevance&limit=6`;
      const j = await getJSON(url, signal, true);
      const flat = t => Array.isArray(t) ? t.flatMap(flat) : (t ? [t] : []);
      const pairs = (j.data || []).map(s => ({ a: String(s.text || '').trim(), b: flat(s.translations).filter(t => t && t.lang === tl).map(t => String(t.text || '').trim()).filter(Boolean) }))
        .filter(p => p.a && p.b.length);
      if (!pairs.length) throw Object.assign(new Error(`В Tatoeba пока нет примеров с ${q(word)} и переводом`), { empty: true });
      return { pairs, total: (j.paging && j.paging.total) || pairs.length };
    },
  };

  /* ---------- the plan: which rows this text gets ---------- */
  function plan(e) {
    const en = Translators.enabled();
    const words = e.text.trim().split(/\s+/).length;
    const tr = TR_ORDER.filter(id => en.includes(id)).map(id => ({ id, kind: 'tr', name: Translators.LIST[id].name, brand: id, what: id === 'mymemory' ? 'база переводов' : 'переводчик' }));
    const ai = (window.AI ? AI.chain() : []).filter(id => AI.PROVIDERS[id]).slice(0, 4)
      .map(id => ({ id: 'ai:' + id, aiId: id, kind: 'ai', name: AI.PROVIDERS[id].short, brand: 'ai:' + id, what: 'нейросеть' }));
    const dict = [];
    if (en.includes('ordbok')) dict.push({ id: 'ordbok', kind: 'dict', name: 'Ordbøkene', brand: 'ordbok', what: 'словарь' });
    dict.push({ id: 'wikt', kind: 'dict', name: 'Wiktionary', brand: 'wiktionary', what: 'словарь' });
    if (en.includes('tatoeba')) dict.push({ id: 'tatoeba', kind: 'dict', name: 'Tatoeba', brand: 'tatoeba', what: 'живые примеры' });
    const site = en.filter(id => Translators.LIST[id] && Translators.LIST[id].web);
    return { tr, ai, dict, site, words, all: [...tr, ...ai, ...dict] };
  }

  function entryFor(text, from, to) {
    const k = `${from}|${to}|${text}`;
    let e = cache.get(k);
    if (!e) { e = { text, from, to, rows: {}, verdicts: {}, views: new Set(), dictFilled: false }; cache.set(k, e); }
    return e;
  }
  const notify = (e, id) => e.views.forEach(v => { try { v(id); } catch (err) { console.warn('compare view', err); } });

  /** dictionary rows work on one Norwegian word / short expression: the source (NO→RU) or the leading answer (RU→NO) */
  function dictWord(e, an) {
    if (e.from === 'no') return Ordbok.bare(e.text);
    const w = an && an.winner ? an.winner.show : '';
    return w ? Ordbok.bare(w) : '';
  }

  /** run one row (again); results land in the session cache, every open window redraws that row */
  function run(e, d, force) {
    const row = e.rows[d.id] = { id: d.id, kind: d.kind, aiId: d.aiId, state: 'wait', tok: (e.rows[d.id] ? e.rows[d.id].tok || 0 : 0) + 1 };
    const tok = row.tok;
    const S = Store.settings;
    const set = patch => { if (e.rows[d.id] !== row || row.tok !== tok) return; Object.assign(row, patch); notify(e, d.id); afterRow(e); };
    const fail = err => set({ state: err && err.empty ? 'none' : 'fail', err: U.niceErr(err) });
    // no key yet: the in-app key window, never «open the site»
    if (d.id === 'deepl' && !(S.deeplKey || '').trim()) { set({ state: 'key' }); return; }
    if (d.id === 'microsoft' && !(S.msKey || '').trim()) { set({ state: 'key' }); return; }
    if (d.id === 'deepl' && !AI.onMac()) { set({ state: 'off', err: 'DeepL не принимает запросы из браузера — он работает в приложении на Mac (через мост Norsk Kort)' }); return; }
    if (d.kind === 'ai' && !force && AI.resting(d.aiId)) { set({ state: 'fail', err: `${AI.name(d.aiId)} отдыхает после лимита запросов — повторите через несколько минут` }); return; }
    if (d.kind === 'dict') {
      if (d.id !== 'tatoeba') {
        if (e.from === 'ru' && !e.rowsDone) { notify(e, d.id); return; } // waits for the translators' answer (the Norwegian word)
        const w = dictWord(e, e.from === 'ru' ? analyze(e) : null);
        if (!w) { set({ state: 'none', err: 'Нет норвежского слова, которое можно проверить по словарю' }); return; }
        if (w.split(/\s+/).length > 4) { set({ state: 'none', err: `${d.name} — словарь слов и выражений; для целой фразы статьи нет` }); return; }
        row.word = w;
      }
    }
    const ctl = window.AbortController ? new AbortController() : null;
    const ms = d.kind === 'ai' ? T_AI : T_SVC;
    const job = d.kind === 'ai' ? R.ai(e, ctl && ctl.signal, d.aiId) : R[d.id](e, ctl && ctl.signal, row.word);
    row.busy = true;
    within(job, ms, d.name, ctl).then(r => set(Object.assign({ state: 'ok', err: '', busy: false }, r)), err => { row.busy = false; fail(err); });
    notify(e, d.id);
  }

  /** after every answer: start what waited for the translators; the verdict when everything is in */
  function afterRow(e) {
    const p = e.plan; if (!p) return;
    const answering = [...p.tr, ...p.ai];
    const settled = ids => ids.every(d => e.rows[d.id] && e.rows[d.id].state !== 'wait');
    if (!e.rowsDone && settled(answering)) {
      e.rowsDone = true;
      if (e.from === 'ru') p.dict.filter(d => d.id !== 'tatoeba').forEach(d => run(e, d));
      fillDictRu(e);
    }
    if (e.rowsDone && settled(p.dict) && !e.dictFilled) fillDictRu(e);
    if (e.rowsDone && settled(p.all)) maybeVerdict(e);
  }

  /** the Norwegian / English dictionary lines get their Russian translation (after the translators: no parallel Google) */
  async function fillDictRu(e) {
    if (e.dictFilled || e.dictFilling || !e.rowsDone) return;
    const o = e.rows.ordbok, w = e.rows.wikt;
    const needO = o && o.state === 'ok' && o.def && !o.defRu, needW = w && w.state === 'ok' && w.gloss && !w.form && !w.ru && !w.glossRu;
    if ((o && o.state === 'wait') || (w && w.state === 'wait')) return;
    e.dictFilling = true;
    try {
      if (needO) { const r = await within(Translators.translateMany([o.def], 'no', 'ru', { quiet: true, noAI: true }), 15000, 'Перевод'); if (r.out[0]) { o.defRu = r.out[0]; notify(e, 'ordbok'); } }
      if (needW) { const r = await within(Translators.translateMany([w.gloss], 'en', 'ru', { quiet: true, noAI: true }), 15000, 'Перевод'); if (r.out[0]) { w.glossRu = r.out[0]; notify(e, 'wikt'); } }
    } catch (err) { /* the Norwegian text stays — the verdict explains it anyway */ }
    e.dictFilling = false; e.dictFilled = true;
  }

  /* ---------- the comparison (without AI: agreement + dictionaries) ---------- */
  function srcForm(e) {
    if (e.from !== 'no') return null;
    const o = e.rows.ordbok, w = e.rows.wikt;
    if (o && o.state === 'ok' && o.tags && o.tags.length) {
      const tag = o.tags.find(t => WANT[t]) || o.tags[0];
      return { tag, tags: o.tags, verb: o.cls === 'VERB', lemma: String(o.lemma).split(',')[0].trim(), cls: o.cls, by: 'Ordbøkene' };
    }
    if (w && w.state === 'ok' && w.form) return { tag: w.form, tags: [w.form], verb: w.verb, lemma: w.of, cls: w.verb ? 'VERB' : '', by: 'Wiktionary' };
    return null;
  }
  function analyze(e) {
    const p = e.plan || plan(e);
    const ans = [...p.tr, ...p.ai].map(d => Object.assign({ d }, e.rows[d.id] || {})).filter(r => r.state === 'ok' && r.text);
    const clusters = [];
    ans.forEach(r => {
      r.vars = variants(r.text, e.to);
      if (!r.vars.length) return;
      let c = clusters.find(x => x.n === r.vars[0].n);
      if (!c) clusters.push(c = { n: r.vars[0].n, show: r.vars[0].raw, members: [], also: [], w: 0, ev: 0, notes: [] });
      c.members.push(r); c.w += WEIGHT[r.kind === 'ai' ? 'ai' : r.id] || 1;
    });
    // second variants and Google's / MyMemory's other meanings support a cluster a little
    ans.forEach(r => [...(r.vars || []).slice(1), ...(r.alts || []).map(a => ({ n: nrm(a, e.to) }))].forEach(v => {
      const c = clusters.find(x => x.n === v.n);
      if (c && !c.members.includes(r) && !c.also.includes(r)) c.also.push(r);
    }));
    // dictionary evidence: the form of the source word, sentences translated by people
    const form = srcForm(e);
    const want = form && form.verb ? WANT[form.tag] : '';
    clusters.forEach(c => {
      if (want && e.to === 'ru') {
        const got = ruForm(c.n);
        if (got && got === want) { c.ev += 0.5; c.formOk = true; }
        else if (got && got !== want) { c.ev -= 0.75; c.formBad = { got, want }; }
      }
    });
    const tat = e.rows.tatoeba;
    if (tat && tat.state === 'ok') {
      const sents = tat.pairs.map(pp => pp.b.map(b => ' ' + nrm(b, e.to).replace(PRON, '') + ' ').join('|'));
      clusters.forEach(c => {
        const k = sents.filter(s => s.includes(' ' + c.n + ' ') || s.includes('|' + c.n + ' ') || s.startsWith(c.n + ' ')).length;
        c.tat = k; c.ev += 0.3 * Math.min(k, 3);
      });
      e._tatN = sents.length;
    }
    clusters.forEach(c => { c.score = c.w + 0.25 * c.also.length + c.ev; });
    clusters.sort((a, b) => b.score - a.score || b.members.length - a.members.length);
    const winner = clusters[0] || null;
    // the verdict of a neural network (if there is one for these answers) has the last word
    const v = verdictFor(e);
    let best = winner;
    if (v && v.state === 'ok' && v.data.best && v.data.best[0]) {
      const bn = nrm(v.data.best[0], e.to);
      best = clusters.find(c => c.n === bn) || { n: bn, show: v.data.best[0], members: [], also: [], ai: true };
    }
    const n = ans.length;
    const sure = best && (best.ai || best.members.length >= 2 || best.ev > 0.4);
    const lexN = best ? ans.filter(r => r.vars && r.vars.length && sameLex(r.vars[0].n, best.n)).length : 0;
    const marks = {};
    ans.forEach(r => {
      if (!best || !r.vars || !r.vars.length) return;
      if (r.vars[0].n === best.n) marks[r.id] = { m: 'ok' };
      else if (sameLex(r.vars[0].n, best.n) || r.vars.some(x => x.n === best.n)) marks[r.id] = { m: 'partly' };
      else marks[r.id] = { m: sure ? 'wrong' : '' };
    });
    if (v && v.state === 'ok') (v.data.services || []).forEach(s => {
      const id = String(s.id || '');
      const row = ans.find(r => r.id === id || r.id === 'ai:' + id || r.aiId === id);
      const m = { ok: 'ok', partly: 'partly', wrong: 'wrong' }[s.mark];
      if (row && m) marks[row.id] = { m, why: String(s.why || '').slice(0, 160) };
    });
    // the card's current translation
    let card = null;
    const cur = String(e.current || '').trim();
    if (cur && best) {
      const cv = variants(cur, e.to);
      if (cv.some(x => x.n === best.n)) card = { m: 'ok' };
      else if (cv.some(x => sameLex(x.n, best.n))) {
        const got = ruForm(cv[0].n);
        card = { m: 'partly', formBad: want && got && got !== want ? { got, want } : null };
      } else if (cv.some(x => clusters.some(c => c.n === x.n))) card = { m: 'partly', other: true };
      else card = { m: sure ? 'wrong' : '' };
    }
    if (v && v.state === 'ok' && v.data.card && cur) {
      const m = { ok: 'ok', partly: 'partly', wrong: 'wrong' }[v.data.card.mark];
      if (m) card = Object.assign({}, card || {}, { m, why: v.data.card.why || '', fix: v.data.card.fix || '' });
    }
    return { ans, n, clusters, winner, best, sure, lexN, marks, card, form, verdict: v };
  }

  /** the explanation without a neural network: what the dictionaries and the services say */
  function heurExplain(e, an) {
    const out = [];
    const f = an.form, best = an.best;
    const src = e.text.trim();
    if (f && f.verb && f.lemma && FORM_RU[f.tag]) {
      const presOk = best && best.formOk ? `: ${q(low(best.show))}` : '';
      out.push(`${q(src)} — ${FORM_RU[f.tag]} глагола ${q('å ' + f.lemma)}${presOk}.`);
      an.clusters.filter(c => c.formBad).slice(0, 2).forEach(c => {
        out.push(`${q(cap(c.show))} — ${RU_FORM[c.formBad.got]}${c.formBad.got === 'inf' ? `, по-норвежски это ${q('å ' + f.lemma)}` : ''}; в исходном тексте — ${RU_FORM[c.formBad.want] || FORM_RU[f.tag]}.`);
      });
    } else if (f && f.cls && CLS_RU[f.cls] && f.lemma) {
      out.push(`${q(src)} — ${CLS_RU[f.cls]}${f.tag && FORM_RU[f.tag] && f.tag !== 'Inf' ? `, ${FORM_RU[f.tag]}` : ''} (словарная форма ${q(f.lemma)}).`);
    }
    if (best && !best.ai) {
      const k = best.members.length;
      if (k >= 2) out.push(`Чаще всего переводят как ${q(low(best.show))} — так ответили ${k} из ${ofN(an.n)}.`);
      else if (an.n > 1 && best.ev > 0.4) out.push('Сервисы разошлись, поэтому вариант выбран по словарям и живым примерам.');
      else if (an.n > 1) out.push('Сервисы ответили по-разному — уверенно выбрать один вариант по совпадениям нельзя.');
      if (best.tat) out.push(`В живых примерах Tatoeba ${q(src.toLowerCase())} переводят как ${q(best.show.toLowerCase())} (${best.tat} из ${e._tatN || best.tat}).`);
    }
    return out.join(' ');
  }

  /** why the card's translation is right / close / wrong — the AI's words, or what the comparison saw */
  function cardWhy(c, cur) {
    if (c.why) return String(c.why).trim().replace(/\.?$/, '.');
    if (c.m === 'ok') return 'Совпадает с лучшим вариантом.';
    if (c.m === 'partly') return c.formBad ? `То же слово в другой форме — ${RU_FORM[c.formBad.got]}, а в исходном тексте ${RU_FORM[c.formBad.want]}.` : c.other ? 'Так ответили не все сервисы.' : 'По смыслу близко, но не точно.';
    return c.m === 'wrong' ? 'Не совпадает ни с одним надёжным вариантом.' : '';
  }
  function fixText(c, best) {
    const f = String(c.fix || '').trim();
    if (f) return /[«"]/.test(f) || f.split(/\s+/).length > 4 ? f : `Точнее: ${q(f)}.`;
    return best ? `Точнее: ${q(best.show)}.` : '';
  }

  /* ---------- the verdict of one neural network (JSON) ---------- */
  const sig = e => (e.plan ? [...e.plan.tr, ...e.plan.ai] : []).map(d => { const r = e.rows[d.id]; return r && r.state === 'ok' ? d.id + '=' + r.text : ''; }).filter(Boolean).join('|');
  function verdictFor(e) {
    const v = e.verdicts[String(e.current || '')];
    return v && v.sig === sig(e) ? v : null;
  }
  function maybeVerdict(e, force) {
    if (!window.AI || !AI.available()) return;
    const k = String(e.current || ''), s = sig(e);
    const v = e.verdicts[k];
    if (!s) return; // nobody answered — nothing to judge
    if (!force && v && v.sig === s && (v.state === 'ok' || v.state === 'wait' || v.state === 'fail')) return;
    const mine = e.verdicts[k] = { state: 'wait', sig: s };
    notify(e, 'verdict');
    within(askVerdict(e), T_VERDICT, 'Нейросеть').then(d => { if (e.verdicts[k] === mine) { Object.assign(mine, { state: 'ok' }, d); notify(e, 'verdict'); } },
      err => { if (e.verdicts[k] === mine) { Object.assign(mine, { state: 'fail', err: U.niceErr(err) }); notify(e, 'verdict'); } });
  }
  async function askVerdict(e) {
    const p = e.plan, ans = [...p.tr, ...p.ai].map(d => ({ d, r: e.rows[d.id] })).filter(x => x.r && x.r.state === 'ok');
    const idOf = d => d.kind === 'ai' ? d.aiId : d.id;
    const lines = ans.map(({ d, r }) => `- ${idOf(d)} (${d.name}): «${r.text}»${r.alts && r.alts.length ? ` (другие значения: ${r.alts.slice(0, 4).join(', ')})` : ''}`);
    const dl = [];
    const o = e.rows.ordbok, w = e.rows.wikt, t = e.rows.tatoeba;
    if (o && o.state === 'ok') dl.push(`- Ordbøkene: словарная форма «${o.lemma}», ${CLS_RU[o.cls] || o.cls || ''}${o.tags.length ? `; «${o.word}» = ${o.tags.join(' / ')}` : ''}${o.def ? `; значение: ${o.def}` : ''}`);
    if (w && w.state === 'ok') dl.push(`- Wiktionary: ${w.gloss || ''}${w.ru ? `; по-русски: ${w.ru}` : ''}`);
    if (t && t.state === 'ok') t.pairs.slice(0, 4).forEach(pp => dl.push(`- Tatoeba: «${pp.a}» → «${pp.b[0]}»`));
    const cur = String(e.current || '').trim();
    const user = `Исходный текст (${e.from === 'no' ? 'норвежский, bokmål' : 'русский'}): «${e.text}»
Направление: ${e.from === 'no' ? 'с норвежского на русский' : 'с русского на норвежский (bokmål)'}
${cur ? `Сейчас на обороте карточки: «${cur}»` : 'Перевода на карточке пока нет.'}
Ответы сервисов:
${lines.join('\n')}
${dl.length ? 'Данные словарей:\n' + dl.join('\n') : ''}
Задача: выбери лучший перевод именно этого текста, оцени каждый ответ и перевод на карточке. Учитывай грамматическую форму исходного текста (время, лицо, число, определённость): например, «spiser» — настоящее время («ем / ест»), а «есть» — инфинитив, по-норвежски «å spise». Пиши естественным русским языком, без канцелярита и кальки; норвежские слова — с переводом в скобках.
Верни ТОЛЬКО JSON:
{"best":["лучший перевод","второй допустимый (необязательно)"],
"services":[{"id":"<id из списка>","mark":"ok|partly|wrong","why":"коротко, до 80 символов"}],
"card":{"mark":"ok|partly|wrong|none","why":"коротко, что не так или что верно","fix":"как исправить (или пусто)"},
"explanation":"2–3 коротких предложения: почему так и чем отличаются варианты",
"confidence":0}`;
    const raw = await AI.call({ system: 'You are an expert Norwegian–Russian translator and a friendly teacher for Russian speakers. You judge translations precisely and explain briefly in natural Russian. Respond with ONLY valid JSON, no markdown.', user, maxTokens: 1200, temperature: 0.1, quiet: true });
    const by = AI.lastProvider || AI.current();
    const j = AI.parseJSON(raw);
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error(`${AI.name(by)} ответил не по форме — нажмите «Повторить»`);
    const best = (Array.isArray(j.best) ? j.best : [j.best]).map(x => String(x || '').trim()).filter(Boolean).slice(0, 3);
    if (!best.length) throw new Error(`${AI.name(by)} не выбрал перевод — нажмите «Повторить»`);
    const conf = Math.max(0, Math.min(100, Math.round(+j.confidence || 0)));
    return { by, data: { best, services: Array.isArray(j.services) ? j.services : [], card: j.card && typeof j.card === 'object' ? j.card : null,
      explanation: String(j.explanation || '').trim().slice(0, 700), confidence: conf } };
  }

  /* ---------- where the explanation can go (the card editor / the studied card / the caller) ---------- */
  function context(text, from, opts) {
    opts = opts || {};
    if (opts.onExplain || opts.current != null) return { kind: 'opts', current: String(opts.current || ''), write: opts.onExplain || null };
    const root = document.getElementById('modal-root');
    const eds = root ? [...root.querySelectorAll('.modal-backdrop:not(.closing) > .modal')].filter(m => m.querySelector('[data-f="no"]') && m.querySelector('[data-f="ru"]') && m.querySelector('[data-f="description"]')) : [];
    const ed = eds[eds.length - 1];
    if (ed) {
      const fNo = ed.querySelector('[data-f="no"]'), fRu = ed.querySelector('[data-f="ru"]'), fD = ed.querySelector('[data-f="description"]');
      if (Translators.prepare(from === 'no' ? fNo.value : fRu.value, from) === text) {
        return {
          kind: 'editor', current: String((from === 'no' ? fRu : fNo).value || '').trim(),
          write: (block, marker) => {
            if (!fD.isConnected) return false;
            const det = fD.closest('details'); if (det) det.open = true;
            fD.value = Ordbok.mergeBlock(fD.value, marker, block);
            fD.dispatchEvent(new Event('input', { bubbles: true }));
            fD.rows = Math.min(16, fD.value.split('\n').length + 1);
            fD.classList.add('glow-good'); setTimeout(() => fD.classList.remove('glow-good'), 900);
            return true;
          },
        };
      }
    }
    const S = window.Study && Study.current ? Study.current() : null;
    if (S && S.card && from === 'no' && Translators.prepare(S.card.no, 'no') === text) {
      const id = S.card.id;
      return {
        kind: 'study', current: String(S.card.ru || ''),
        write: (block, marker, by, note) => {
          const fresh = Store.card(id); if (!fresh) return false;
          Store.updateCard(id, { description: Ordbok.mergeBlock(fresh.description, marker, block), history: Prov.add(fresh, Prov.entry(by, 'explain', { description: { old: '', new: block } }, note)) });
          const c2 = Study.current();
          if (c2 && c2.card.id === id) { try { Study.renderCard(false); Study.flip(true); } catch (err) { /* another screen */ } }
          return true;
        },
      };
    }
    return { kind: '', current: '', write: null };
  }

  /** number the services that gave the inserted variant on the rails (Translators.markUsed: the corner badge) */
  function markSources(keys) {
    const put = () => document.querySelectorAll('.tr-rail').forEach(r => keys.forEach((k, i) => Translators.markUsed(r, k, i + 1)));
    put(); setTimeout(put, 450); // the studied card is drawn again after the insert
  }
  const provKey = r => r.kind === 'ai' ? 'ai:' + r.aiId : 'tr:' + r.id;
  const PRIO = r => r.id === 'deepl' ? 0 : r.kind === 'ai' ? 1 : r.id === 'google' ? 2 : r.id === 'microsoft' ? 3 : 4;

  /* ---------- the window ---------- */
  function open(text, from, to, onPick, opts) {
    text = String(text || '').trim();
    const e = entryFor(text, from, to);
    const ctx = context(text, from, opts);
    e.current = ctx.current;
    e.plan = plan(e);
    const P = e.plan;
    const rowHtml = d => `<div class="cmp-row" data-row="${esc(d.id)}" data-kind="${d.kind}">
        <span class="cmp-ico" aria-hidden="true">${Translators.brand(d.brand)}</span>
        <span class="cmp-who"><b>${esc(d.name)}</b><small>${esc(d.what)}</small></span>
        <span class="cmp-res" aria-live="polite"></span>
        <span class="cmp-mark" aria-hidden="true"></span>
        <span class="cmp-act"></span></div>`;
    const dirLabel = from === 'no' ? '🇳🇴 → 🇷🇺' : '🇷🇺 → 🇳🇴';
    const m = UI.modal({
      title: `⚖️ Сравнение переводов · ${dirLabel}`, cls: 'cmp-modal',
      body: `<div class="tr-src cmp-src">${UI.rich(text)}${ctx.current ? `<small class="cmp-now">На карточке сейчас: <b>${esc(ctx.current)}</b></small>` : ''}</div>
        <section class="cmp-sec"><h3 class="cmp-h">Переводчики${P.ai.length ? ' и нейросети' : ''}</h3>
          <div class="cmp-list">${[...P.tr, ...P.ai].map(rowHtml).join('')}</div></section>
        ${P.dict.length ? `<section class="cmp-sec"><h3 class="cmp-h">Словари и живые примеры</h3><div class="cmp-list">${P.dict.map(rowHtml).join('')}</div></section>` : ''}
        <section class="cmp-sec cmp-sum" data-sum aria-live="polite"></section>
        ${P.site.length ? `<details class="cmp-site"><summary>Только на сайте · ${P.site.map(id => esc(Translators.LIST[id].name)).join(', ')}</summary>
          <p class="small muted">Эти словари не дают приложениям свои данные, поэтому их результат здесь не показать. Если нужно — откройте сайт.</p>
          ${P.site.map(id => `<div class="cmp-site-row"><span class="cmp-ico" aria-hidden="true">${Translators.brand(id)}</span>
            <span class="cmp-who"><b>${esc(Translators.LIST[id].name)}</b><small>${esc(SITE_WHY[id] || 'Работает только на своём сайте.')}</small></span>
            <button class="btn sm" data-cmp-open="${id}">Открыть ↗</button></div>`).join('')}</details>` : ''}`,
      foot: '<button class="btn ghost" data-close2>Закрыть</button>',
      onClose: () => e.views.delete(view),
    });
    m.$('[data-close2]').onclick = () => m.close();

    const drawRow = id => {
      const d = P.all.find(x => x.id === id); if (!d) return;
      const el = m.$(`[data-row="${CSS.escape(id)}"]`); if (!el) return;
      const r = e.rows[id] || { state: 'wait' };
      el.dataset.state = r.state;
      const res = el.querySelector('.cmp-res'), act = el.querySelector('.cmp-act');
      let main = '', sub = '', a = '', title = '';
      const retry = `<button class="btn sm cmp-btn" data-cmp-retry="${esc(id)}" aria-label="Повторить: ${esc(d.name)}">${UI.icon('retry', 16)}<span>Повторить</span></button>`;
      if (r.state === 'wait') {
        const waitingWord = d.kind === 'dict' && d.id !== 'tatoeba' && from === 'ru' && !e.rowsDone;
        main = `<span class="cmp-skel" style="width:${d.kind === 'dict' ? 78 : 56}%"></span>`;
        sub = waitingWord ? '<small class="cmp-sub muted">проверю слово, когда ответят переводчики</small>' : '<span class="cmp-skel thin" style="width:34%"></span>';
      } else if (r.state === 'key') {
        const deepl = id === 'deepl';
        main = '<span class="cmp-main muted">Нужен бесплатный ключ</span>';
        sub = `<small class="cmp-sub muted">${deepl ? '500 000 символов в месяц бесплатно' : '2 млн символов в месяц бесплатно'} · подключается один раз</small>`;
        a = `<button class="btn sm primary cmp-btn" data-cmp-key="${id}">Подключить</button>`;
      } else if (r.state === 'fail') {
        main = `<span class="cmp-main muted">${esc(r.err || 'Сейчас не ответил')}</span>`;
        a = retry;
      } else if (r.state === 'none' || r.state === 'off') {
        main = `<span class="cmp-main muted">${esc(r.err || '')}</span>`;
      } else if (d.kind === 'tr' || d.kind === 'ai') {
        title = [r.text, r.alts && r.alts.length ? 'также: ' + r.alts.join(', ') : '', r.note || ''].filter(Boolean).join('\n');
        main = `<b class="cmp-main">${esc(r.text)}</b>`;
        const sb = r.note || (r.alts && r.alts.length ? 'также: ' + r.alts.slice(0, 5).join(', ') : '') || r.via || '';
        if (sb) sub = `<small class="cmp-sub">${esc(sb)}${r.via && sb !== r.via ? ` · ${esc(r.via)}` : ''}</small>`;
        if (onPick) a = `<button class="btn sm cmp-btn" data-cmp-pick="${esc(id)}" aria-label="Вставить перевод ${esc(d.name)} в карточку">Вставить</button>`;
      } else if (id === 'ordbok') {
        const tags = (r.tags || []).filter(t => FORM_RU[t]);
        main = `<span class="cmp-main"><b>${esc(r.lemma)}</b> · ${esc(CLS_RU[r.cls] || r.cls || 'словарная статья')}${tags.length && r.word && r.word !== String(r.lemma).split(',')[0].trim().toLowerCase() ? ` · ${esc(r.word)} — ${esc(tags.map(t => FORM_RU[t]).join(' или '))}` : ''}</span>`;
        if (r.def) sub = `<small class="cmp-sub">${esc(r.def)}${r.defRu ? ` <span class="gloss">(${esc(r.defRu)})</span>` : ''}</small>`;
        title = [r.lemma, r.def, r.defRu].filter(Boolean).join('\n');
      } else if (id === 'wikt') {
        const fr = r.form && FORM_RU[r.form] ? `${r.word} — ${FORM_RU[r.form]}${r.of ? ` от ${r.of}` : ''}` : '';
        main = `<span class="cmp-main">${fr ? esc(fr) : r.ru ? `<b>${esc(r.ru)}</b>` : esc(r.gloss)}</span>`;
        const sb = fr ? (r.ru ? `по-русски: ${r.ru}` : r.glossRu || r.gloss) : r.ru ? r.gloss : r.glossRu;
        if (sb) sub = `<small class="cmp-sub">${esc(sb)}</small>`;
        title = [r.gloss, r.glossRu, r.ru].filter(Boolean).join('\n');
      } else if (id === 'tatoeba') {
        const p0 = r.pairs[0], p1 = r.pairs[1];
        main = `<span class="cmp-main">${esc(p0.a)} <span class="gloss">— ${esc(p0.b[0])}</span></span>`;
        if (p1) sub = `<small class="cmp-sub">${esc(p1.a)} — ${esc(p1.b[0])}${r.total > 2 ? ` · всего примеров: ${r.total}` : ''}</small>`;
        title = r.pairs.map(pp => `${pp.a} — ${pp.b[0]}`).join('\n');
      }
      res.innerHTML = main + (sub || '');
      res.title = title;
      act.innerHTML = a;
    };
    const drawMarks = an => {
      [...P.tr, ...P.ai].forEach(d => {
        const el = m.$(`[data-row="${CSS.escape(d.id)}"] .cmp-mark`); if (!el) return;
        const mk = an.marks[d.id];
        const sym = mk && mk.m ? { ok: '✓', partly: '≈', wrong: '✗' }[mk.m] : '';
        el.className = 'cmp-mark' + (sym ? ' ' + mk.m : '');
        el.textContent = sym;
        el.title = mk && mk.m ? ({ ok: 'верно', partly: 'отчасти верно', wrong: 'неверно' }[mk.m] + (mk.why ? ': ' + mk.why : '')) : '';
        el.setAttribute('aria-hidden', sym ? 'false' : 'true');
        if (sym) el.setAttribute('aria-label', el.title);
      });
    };
    const icons = rows => rows.map(r => `<span class="cmp-mini" title="${esc(P.all.find(d => d.id === r.id).name)}">${Translators.brand(P.all.find(d => d.id === r.id).brand)}</span>`).join('');
    let lastAn = null;
    const drawSum = () => {
      const an = lastAn = analyze(e);
      drawMarks(an);
      const box = m.$('[data-sum]');
      const answering = [...P.tr, ...P.ai];
      const pending = answering.filter(d => !e.rows[d.id] || e.rows[d.id].state === 'wait').length;
      if (!an.n) {
        box.innerHTML = `<h3 class="cmp-h">Сравнение</h3>${pending ? `<div class="cmp-card-sk"><span class="cmp-skel" style="width:62%"></span><span class="cmp-skel thin" style="width:40%"></span><span class="small muted">Жду ответы сервисов…</span></div>`
          : '<p class="cmp-calm">Пока ни один сервис не ответил. Проверьте интернет и нажмите «Повторить» в нужной строке.</p>'}`;
        return;
      }
      const best = an.best, w = an.winner;
      const v = an.verdict, aiOn = window.AI && AI.available();
      const vRun = e.verdicts[String(e.current || '')];
      const bar = (k, n, cls = '') => `<div class="cmp-bar ${cls}" role="img" aria-label="${pct(k, n)} %"><i style="width:${pct(k, n)}%"></i></div>`;
      let h = '<h3 class="cmp-h">Сравнение</h3>';
      // consensus (facts: how many services gave exactly this)
      if (w) {
        const k = w.members.length;
        h += `<div class="cmp-cons">
          <div class="cmp-cons-line">${an.n === 1 ? `${pending ? 'Пока ответил' : 'Ответил'} только один сервис` : k === an.n && an.n > 1 ? `${an.n === 2 ? 'Оба сервиса' : `Все ${an.n} ${plural(an.n, 'сервис', 'сервиса', 'сервисов')}`} согласны (100 %)` : `${k} из ${ofN(an.n)} (${pct(k, an.n)} %)`} → <b>${esc(w.show)}</b>${pending ? ' <span class="small muted">· ещё отвечают</span>' : ''}</div>
          ${bar(k, an.n)}<div class="cmp-icons">${icons(w.members)}</div></div>`;
        const minor = an.clusters.slice(1, 5);
        if (minor.length) h += `<div class="cmp-minor">${minor.map(c => `<div class="cmp-minor-row"><span><b>${esc(c.show)}</b> — ${c.members.length} из ${an.n} (${pct(c.members.length, an.n)} %)</span>${bar(c.members.length, an.n, 'thin')}<span class="cmp-icons">${icons(c.members)}</span></div>`).join('')}</div>`;
        if (an.lexN > k && best) h += `<p class="cmp-lex">По смыслу сходятся ${an.lexN} из ${ofN(an.n)} (${pct(an.lexN, an.n)} %) — разница только в форме слова.</p>`;
      }
      // dictionary evidence
      const ev = [];
      const o = e.rows.ordbok, wk = e.rows.wikt, t = e.rows.tatoeba;
      if (an.form && an.form.verb && FORM_RU[an.form.tag] && from === 'no') ev.push(`<li>${Translators.brand(an.form.by === 'Ordbøkene' ? 'ordbok' : 'wiktionary')}<span>${esc(an.form.by)}: ${esc(text)} — ${esc(FORM_RU[an.form.tag])} глагола <b>å ${esc(an.form.lemma)}</b>.</span></li>`);
      else if (o && o.state === 'ok') ev.push(`<li>${Translators.brand('ordbok')}<span>Ordbøkene: <b>${esc(o.lemma)}</b> — ${esc(CLS_RU[o.cls] || 'есть в словаре')}${o.defRu ? `, «${esc(o.defRu)}»` : ''}.</span></li>`);
      if (wk && wk.state === 'ok' && wk.ru) ev.push(`<li>${Translators.brand('wiktionary')}<span>Wiktionary: ${esc(wk.of || wk.word)} — <b>${esc(wk.ru)}</b> (словарная форма).</span></li>`);
      if (t && t.state === 'ok' && best && best.tat) ev.push(`<li>${Translators.brand('tatoeba')}<span>Tatoeba: в ${best.tat} из ${e._tatN || t.pairs.length} живых примеров — <b>${esc(best.show)}</b>.</span></li>`);
      if (ev.length) h += `<ul class="cmp-ev">${ev.join('')}</ul>`;
      // the verdict
      if (v && v.state === 'ok') {
        const d = v.data;
        const rowOf = s => an.ans.find(x => x.id === String(s.id) || x.aiId === String(s.id));
        const bad = (d.services || []).filter(s => s && (s.mark === 'wrong' || s.mark === 'partly') && s.why && rowOf(s)).slice(0, 5);
        h += `<div class="cmp-verdict">
          <div class="cmp-vhead"><span class="cmp-mini">${Translators.brand('ai:' + v.by)}</span><b>Вывод ${esc(AI.name(v.by))}</b>${d.confidence ? `<span class="cmp-conf" title="уверенность нейросети">уверенность ${d.confidence} %</span>` : ''}</div>
          ${d.confidence ? bar(d.confidence, 100, 'conf') : ''}
          <div class="cmp-best">Лучший перевод: <b>${esc(d.best[0])}</b>${d.best[1] ? ` <span class="muted">· можно и ${esc(d.best.slice(1).join(', '))}</span>` : ''}</div>
          ${d.explanation ? `<p class="cmp-expl">${UI.rich(d.explanation)}</p>` : ''}
          ${bad.length ? `<ul class="cmp-why">${bad.map(s => { const r = rowOf(s); return `<li class="${s.mark}"><span class="cmp-mark ${s.mark}">${s.mark === 'wrong' ? '✗' : '≈'}</span><span><b>${esc(r ? r.d.name : s.id)}</b>${r ? ` (${esc(r.text)})` : ''}: ${esc(s.why)}</span></li>`; }).join('')}</ul>` : ''}
        </div>`;
      } else if (vRun && vRun.state === 'wait') {
        h += `<div class="cmp-verdict wait"><div class="cmp-vhead">${AI.current() ? `<span class="cmp-mini">${Translators.brand('ai:' + AI.current())}</span>` : ''}<b>${esc(AI.name())} сверяет ответы…</b></div><span class="cmp-skel" style="width:70%"></span><span class="cmp-skel thin" style="width:48%"></span></div>`;
      } else {
        const ex = heurExplain(e, an);
        if (ex) h += `<p class="cmp-expl">${esc(ex)}</p>`;
        if (vRun && vRun.state === 'fail') h += `<div class="cmp-calm row"><span>${esc(String(vRun.err || '').replace(/\s+—\s+(попробуйте|повторите).*$/i, '').replace(/\.$/, ''))} — поэтому вывод сделан по совпадениям и словарям.</span><button class="btn sm cmp-btn" data-cmp-reverdict>${UI.icon('retry', 16)}<span>Повторить</span></button></div>`;
        else if (!aiOn) h += `<div class="cmp-ai-hint"><span>${BOT()} Точнее объяснит нейросеть: какой перевод верный, где ошибка и почему.</span><button class="btn sm cmp-btn" data-cmp-ai-connect>Подключить</button></div>`;
      }
      // the card's current translation
      const cur = String(e.current || '').trim();
      if (cur && an.card && an.card.m) {
        const c = an.card;
        const txt = cardWhy(c, cur);
        const fix = c.m === 'ok' ? '' : fixText(c, best);
        h += `<div class="cmp-card ${c.m}"><span class="cmp-mark ${c.m}">${{ ok: '✓', partly: '≈', wrong: '✗' }[c.m]}</span><span><b>На карточке: ${esc(q(cur))}</b>${txt ? `<small>${esc(txt)}</small>` : ''}${fix ? `<span>${esc(fix)}</span>` : ''}</span></div>`;
      }
      // actions
      const acts = [];
      if (best && onPick) acts.push(`<button class="btn primary cmp-go" data-cmp-best>Вставить ${esc(q(best.show))} в карточку</button>`);
      if (best && ctx.write && (v && v.state === 'ok' ? v.data.explanation : heurExplain(e, an))) acts.push('<button class="btn cmp-go" data-cmp-explain>Добавить пояснение в карточку</button>');
      if (acts.length) h += `<div class="cmp-actions">${acts.join('')}</div>`;
      box.innerHTML = h;
    };
    let sumT = 0;
    const soon = () => { if (sumT) return; sumT = requestAnimationFrame(() => { sumT = 0; if (m.el.isConnected) drawSum(); }); };
    const view = id => {
      if (!m.el.isConnected) { e.views.delete(view); return; }
      if (id && id !== 'verdict') drawRow(id);
      soon();
    };
    e.views.add(view);
    P.all.forEach(d => drawRow(d.id));
    drawSum();
    // start what has no answer yet (cached answers are shown at once; failed ones / a key added since → again)
    const keyNow = d => (d.id === 'deepl' && (Store.settings.deeplKey || '').trim()) || (d.id === 'microsoft' && (Store.settings.msKey || '').trim());
    const toStart = P.all.filter(d => { const r = e.rows[d.id]; return !r || r.state === 'fail' || (r.state === 'key' && keyNow(d)) || (r.state === 'wait' && !r.busy); });
    e.rowsDone = [...P.tr, ...P.ai].every(d => !toStart.includes(d) && e.rows[d.id] && e.rows[d.id].state !== 'wait');
    toStart.forEach(d => run(e, d));
    afterRow(e);

    // the text for the card: best variant, agreement, the explanation
    const explainBlock = () => {
      const an = lastAn || analyze(e), v = an.verdict, best = an.best;
      const sup = best && best.members ? best.members.slice().sort((a, b) => PRIO(a) - PRIO(b)) : [];
      const names = sup.map(r => r.d.name);
      const lines = [`${MARKER} ${text}`];
      const agree = sup.length >= 2 ? ` — согласны ${sup.length} из ${ofN(an.n)} (${pct(sup.length, an.n)} %): ${names.join(', ')}` : sup.length === 1 ? ` — так перевёл ${names[0]}` : '';
      lines.push(`Лучший перевод: ${best.show}${agree}${v && v.state === 'ok' ? `; проверил ${AI.name(v.by)}` : best.ev > 0.4 ? '; подтверждают словари' : ''}`);
      const ex = v && v.state === 'ok' ? v.data.explanation : heurExplain(e, an);
      if (ex) lines.push(ex);
      if (an.card && an.card.m && an.card.m !== 'ok' && e.current) {
        const w = cardWhy(an.card, e.current).replace(/\.$/, '');
        lines.push(w.toLowerCase().startsWith(q(e.current).toLowerCase()) ? `На карточке было ${w}.` : `На карточке было ${q(e.current)}${w ? ': ' + low(w) : ''}.`);
      }
      return { block: lines.join('\n'), by: v && v.state === 'ok' ? 'ai:' + v.by : sup[0] ? provKey(sup[0]) : 'tr:google', an, sup };
    };

    m.el.addEventListener('click', ev => {
      const t = ev.target;
      const op = t.closest('[data-cmp-open]'); if (op) { Translators.open(op.dataset.cmpOpen, text, from, to); return; }
      const rt = t.closest('[data-cmp-retry]');
      if (rt) { const d = P.all.find(x => x.id === rt.dataset.cmpRetry); if (d) { if (d.id === 'google' && !bridgeUp()) { /* one request, Google's pause is respected inside */ } run(e, d, true); } return; }
      const k = t.closest('[data-cmp-key]');
      if (k) { keyDialog(k.dataset.cmpKey, () => { const d = P.all.find(x => x.id === k.dataset.cmpKey); if (d && m.el.isConnected) run(e, d, true); }); return; }
      if (t.closest('[data-cmp-reverdict]')) { maybeVerdict(e, true); return; }
      if (t.closest('[data-cmp-ai-connect]')) { if (window.Guides && Guides.needAI) Guides.needAI('Сравнение переводов: объяснение'); else App.go('settings'); return; }
      const pk = t.closest('[data-cmp-pick]');
      if (pk && onPick) {
        const r = e.rows[pk.dataset.cmpPick]; if (!r || r.state !== 'ok') return;
        if (r.kind === 'ai') Translators.lastAI = r.aiId;
        m.close();
        onPick(r.text, r.kind === 'ai' ? 'ai' : r.id);
        markSources([provKey(r)]);
        return;
      }
      if (t.closest('[data-cmp-best]') && onPick) {
        const an = lastAn || analyze(e), best = an.best; if (!best) return;
        const sup = (best.members || []).slice().sort((a, b) => PRIO(a) - PRIO(b));
        const v = an.verdict;
        let tid;
        if (sup.length) { const r0 = sup[0]; if (r0.kind === 'ai') Translators.lastAI = r0.aiId; tid = r0.kind === 'ai' ? 'ai' : r0.id; }
        else { Translators.lastAI = v && v.by; tid = 'ai'; }
        m.close();
        onPick(best.show, tid);
        markSources(sup.length ? sup.map(provKey) : v ? ['ai:' + v.by] : []);
        return;
      }
      if (t.closest('[data-cmp-explain]') && ctx.write) {
        const x = explainBlock();
        const ok = ctx.write(x.block, MARKER, x.by, `сравнение переводов: ${x.an.n} ${plural(x.an.n, 'сервис', 'сервиса', 'сервисов')}, лучший вариант «${x.an.best.show}»`);
        if (ok === false) { UI.toast('Карточка уже закрыта — пояснение некуда добавить', 'warn'); return; }
        markSources(x.sup.map(provKey));
        UI.toast('Пояснение добавлено в карточку ✓', 'good');
        const b = m.$('[data-cmp-explain]'); if (b) { b.disabled = true; b.textContent = 'Пояснение добавлено ✓'; }
      }
    });
    return m;
  }

  /* ---------- the in-app key window (DeepL API Free / Azure Translator F0) ---------- */
  function keyDialog(id, after) {
    const deepl = id === 'deepl';
    const t = Translators.LIST[id];
    const S = Store.settings;
    const m = UI.modal({
      title: `🔑 ${deepl ? 'DeepL' : 'Microsoft'}: бесплатный ключ`, cls: 'narrow cmp-key',
      body: `<p class="small" style="margin:0">${deepl ? 'DeepL API Free — 500 000 символов в месяц бесплатно.' : 'Azure Translator, тариф F0 — 2 млн символов в месяц бесплатно.'} Ключ вводится один раз — дальше перевод ${deepl ? 'DeepL' : 'Microsoft'} появляется прямо здесь, рядом с остальными.</p>
        <ol class="cmp-steps">${deepl
          ? '<li>Зарегистрируйтесь в DeepL API Free (кнопка ниже). DeepL может попросить карту для проверки, но денег не списывает.</li><li>В разделе <b>API Keys</b> скопируйте ключ — он заканчивается на <code>:fx</code>.</li><li>Вставьте его сюда.</li>'
          : '<li>Создайте бесплатный ресурс <b>Translator</b> в Azure (тариф F0) — кнопка ниже.</li><li>Скопируйте <b>ключ</b> и <b>регион</b> (например, westeurope).</li><li>Вставьте их сюда.</li>'}</ol>
        <a class="btn sm cmp-btn" href="${esc(t.keyUrl)}" target="_blank" rel="noopener">${deepl ? 'Получить ключ DeepL ↗' : 'Как получить ключ ↗'}</a>
        <label class="field"><span>Ключ</span><input class="input" type="password" data-k value="${esc(deepl ? S.deeplKey || '' : S.msKey || '')}" placeholder="${deepl ? 'xxxxxxxx-…:fx' : 'ключ Azure'}" autocomplete="off" spellcheck="false"></label>
        ${deepl ? '' : `<label class="field"><span>Регион</span><input class="input" data-r value="${esc(S.msRegion || '')}" placeholder="westeurope" autocomplete="off" spellcheck="false"></label>`}
        ${deepl ? `<p class="small muted" style="margin:0">${AI.onMac() ? 'DeepL не принимает запросы прямо из браузера — переводит через мост Norsk Kort на этом Mac.' : 'DeepL не принимает запросы прямо из браузера — перевод появится в приложении на Mac (через мост). Здесь сохраните ключ на будущее.'}</p>` : ''}
        <div class="small" data-st></div>`,
      foot: '<button class="btn ghost" data-x>Позже</button><button class="btn primary" data-save>Сохранить и перевести</button>',
    });
    const inp = m.$('[data-k]');
    setTimeout(() => { try { inp.focus(); } catch (e) { /* ok */ } }, 60);
    m.$('[data-x]').onclick = () => m.close();
    const save = () => {
      const v = inp.value.trim();
      const st = m.$('[data-st]');
      if (!v) { st.textContent = 'Вставьте ключ — без него сервис не сможет переводить'; inp.focus(); return; }
      if (deepl && !/:fx$/.test(v) && !/^[0-9a-f-]{30,}$/i.test(v)) { st.textContent = 'Ключ DeepL обычно выглядит как «xxxxxxxx-xxxx-…:fx» — проверьте, что скопирован целиком'; return; }
      if (deepl) Store.setSetting('deeplKey', v);
      else { Store.setSetting('msKey', v); Store.setSetting('msRegion', (m.$('[data-r]').value || '').trim()); }
      UI.toast(`${deepl ? 'DeepL' : 'Microsoft'}: ключ сохранён ✓`, 'good');
      m.close();
      after && after();
    };
    m.$('[data-save]').onclick = save;
    m.el.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.matches('input')) { ev.preventDefault(); save(); } });
    return m;
  }

  window.Compare = { open, keyDialog, analyze, _cache: cache, _nrm: nrm, _sameLex: sameLex, _ruForm: ruForm };
})();
