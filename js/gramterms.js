/* ============ 🔤 Gram — bilingual grammar labels: «Preteritum · прошедшее», «substantiv · существительное» ============
 * One place for the grammar words the app shows. Cards keep whatever label they were made with (Russian, Norwegian or
 * mixed: «Прошедшее (preteritum)», «Неопр. ед. (ubestemt entall)», «verb», «NOUN»…) — they are recognised here at display
 * time, so nothing in the saved data changes.
 *  - Gram.term(raw)        → { key, no, ru, tip, ex } | null   (a form / tense / gender / part of speech)
 *  - Gram.label(raw)       → HTML «<no> · <ru>» with a tooltip (unknown labels: shown as they are, escaped)
 *  - Gram.pos(wordClass)   → HTML «substantiv · существительное» (unknown: as is) · Gram.posKey / Gram.posText
 *  - Gram.gender(g)        → HTML «hankjønn · мужской род» (g: m | f | n | mf | ['m','f'] | en | ei | et | …)
 *  - Gram.badges(card)     → the badges for the back of a card: part of speech + gender (from the card or its article)
 *  - Gram.posSelect(value) → the <select data-f="wordClass"> of the card editor (a custom value is kept)
 *  - Gram.glossaryHtml()   → the glossary with 🔊 examples (the help centre topic «🔤 Грамматические термины»)
 * Every 🔊 here is a [data-gram-say] button — one listener on the document speaks it in Norwegian.
 */
(function () {
  const esc = s => U.esc(s == null ? '' : String(s));
  const low = s => String(s || '').toLowerCase().trim();

  /* ---------- parts of speech ---------- */
  const POS = {
    substantiv: { no: 'substantiv', ru: 'существительное', tip: 'Предмет, человек, понятие: en bil — машина.', ex: 'en bil' },
    verb: { no: 'verb', ru: 'глагол', tip: 'Действие или состояние: å lese — читать.', ex: 'å lese' },
    adjektiv: { no: 'adjektiv', ru: 'прилагательное', tip: 'Признак: stor — большой.', ex: 'stor' },
    adverb: { no: 'adverb', ru: 'наречие', tip: 'Как, где, когда: ofte — часто.', ex: 'ofte' },
    preposisjon: { no: 'preposisjon', ru: 'предлог', tip: 'Связывает слова: på bordet — на столе.', ex: 'på' },
    pronomen: { no: 'pronomen', ru: 'местоимение', tip: 'Вместо имени: jeg, du, han — я, ты, он.', ex: 'jeg' },
    konjunksjon: { no: 'konjunksjon', ru: 'союз', tip: 'Соединяет равные части: og, men — и, но.', ex: 'og' },
    subjunksjon: { no: 'subjunksjon', ru: 'подчинительный союз', tip: 'Начинает придаточное: fordi, at, når — потому что, что, когда.', ex: 'fordi' },
    determinativ: { no: 'determinativ', ru: 'определитель', tip: 'Уточняет существительное: denne, min, alle — этот, мой, все.', ex: 'denne' },
    artikkel: { no: 'artikkel', ru: 'артикль', tip: 'en, ei, et — показывают род и неопределённость.', ex: 'en' },
    tallord: { no: 'tallord', ru: 'числительное', tip: 'Число или порядок: tre, tredje — три, третий.', ex: 'tre' },
    interjeksjon: { no: 'interjeksjon', ru: 'междометие', tip: 'Восклицание: hei, au, oi.', ex: 'hei' },
    infinitivsmerke: { no: 'infinitivsmerke', ru: 'частица å', tip: 'å перед глаголом: å spise — есть (кушать).', ex: 'å' },
    egennavn: { no: 'egennavn', ru: 'имя собственное', tip: 'Имя, город, страна: Oslo, Norge.', ex: 'Norge' },
    uttrykk: { no: 'uttrykk', ru: 'выражение', tip: 'Устойчивое сочетание слов.', ex: 'ha det bra' },
    spørreord: { no: 'spørreord', ru: 'вопросительное слово', tip: 'hva, hvem, hvor — что, кто, где.', ex: 'hvor' },
    setning: { no: 'setning', ru: 'предложение', tip: 'Целое предложение.', ex: 'Jeg bor i Oslo.' },
    forkortelse: { no: 'forkortelse', ru: 'сокращение', tip: 'Сокращённое слово: f.eks. — например.', ex: 'f.eks.' },
  };
  const POS_ORDER = ['substantiv', 'verb', 'adjektiv', 'adverb', 'pronomen', 'preposisjon', 'konjunksjon', 'subjunksjon', 'determinativ', 'tallord', 'interjeksjon', 'uttrykk', 'spørreord', 'egennavn', 'setning'];
  const POS_ALIAS = {
    n: 'substantiv', noun: 'substantiv', subst: 'substantiv', substantiv: 'substantiv', 'существительное': 'substantiv', propn: 'egennavn',
    v: 'verb', verb: 'verb', 'глагол': 'verb', aux: 'verb',
    a: 'adjektiv', adj: 'adjektiv', adjective: 'adjektiv', adjektiv: 'adjektiv', 'прилагательное': 'adjektiv',
    adv: 'adverb', adverb: 'adverb', 'наречие': 'adverb',
    prep: 'preposisjon', adp: 'preposisjon', preposition: 'preposisjon', preposisjon: 'preposisjon', 'предлог': 'preposisjon',
    pron: 'pronomen', pronoun: 'pronomen', pronomen: 'pronomen', 'местоимение': 'pronomen',
    conj: 'konjunksjon', cconj: 'konjunksjon', konj: 'konjunksjon', konjunksjon: 'konjunksjon', 'союз': 'konjunksjon',
    subj: 'subjunksjon', sconj: 'subjunksjon', subjunksjon: 'subjunksjon',
    det: 'determinativ', determinativ: 'determinativ', determiner: 'determinativ',
    art: 'artikkel', artikkel: 'artikkel', article: 'artikkel', 'артикль': 'artikkel',
    num: 'tallord', tallord: 'tallord', numeral: 'tallord', 'числительное': 'tallord',
    interj: 'interjeksjon', intj: 'interjeksjon', interjeksjon: 'interjeksjon', 'междометие': 'interjeksjon',
    inf: 'infinitivsmerke', infinitivsmerke: 'infinitivsmerke', part: 'infinitivsmerke',
    egennavn: 'egennavn', 'имя собственное': 'egennavn',
    uttrykk: 'uttrykk', expression: 'uttrykk', phrase: 'uttrykk', 'выражение': 'uttrykk', idiom: 'uttrykk',
    'spørreord': 'spørreord', 'setning': 'setning', 'предложение': 'setning', forkortelse: 'forkortelse', abbr: 'forkortelse',
  };
  const posKey = wc => {
    const k = low(wc).replace(/[.]/g, '');
    if (!k) return '';
    if (POS_ALIAS[k]) return POS_ALIAS[k];
    const first = k.split(/[\s,;/(]+/)[0];
    return POS_ALIAS[first] || '';
  };

  /* ---------- gender ---------- */
  const GEN = {
    m: { no: 'hankjønn', ru: 'мужской род', tip: 'Артикль en: en gutt — мальчик. Определённая форма на -en: gutten.', ex: 'en gutt' },
    f: { no: 'hunkjønn', ru: 'женский род', tip: 'Артикль ei: ei jente — девочка. Определённая форма на -a: jenta. Можно и как мужской род: en jente.', ex: 'ei jente' },
    n: { no: 'intetkjønn', ru: 'средний род', tip: 'Артикль et: et hus — дом. Определённая форма на -et: huset.', ex: 'et hus' },
    mf: { no: 'hankjønn / hunkjønn', ru: 'мужской / женский род', tip: 'Можно и en, и ei: en/ei bok — книга.', ex: 'ei bok' },
  };
  const genKey = g => {
    if (Array.isArray(g)) { const s = new Set(g.map(x => genKey(x))); return s.has('m') && s.has('f') ? 'mf' : [...s][0] || ''; }
    const k = low(g).replace(/[.]/g, '');
    if (!k) return '';
    if (/^(m|mask|masc|masculine|hankjønn|en|м|муж|мужской|мужской род)$/.test(k)) return 'm';
    if (/^(f|fem|feminine|hunkjønn|ei|ж|жен|женский|женский род)$/.test(k)) return 'f';
    if (/^(n|nøytr|nøytrum|neut|neuter|intetkjønn|et|ср|средний|средний род)$/.test(k)) return 'n';
    if (/^(mf|fm|m\/f|en\/ei|ei\/en|hankjønn\/hunkjønn)$/.test(k.replace(/\s+/g, ''))) return 'mf';
    return '';
  };

  /* ---------- forms, tenses, degrees (the order matters: the longer names first) ---------- */
  const TERMS = [
    ['pluskv', /pluskvamperfektum|плюсквам|предпрошедш|\bhadde \+/, 'Pluskvamperfektum', 'предпрошедшее', 'Что случилось раньше другого прошлого: hadde + причастие.', 'jeg hadde lest'],
    ['perfektum', /^перфект|\bhar \+/, 'Perfektum', 'перфект', 'har + причастие: действие в прошлом, важное сейчас.', 'jeg har lest'],
    ['perfpart', /perfektum partisipp|perf\.? ?part|причастие прош|partisipp perfektum|past participle/, 'Perfektum partisipp', 'причастие прошедшего времени', 'Форма после har / hadde: lest (har lest — прочитал).', 'lest'],
    ['prespart', /presens partisipp|причастие наст|present participle/, 'Presens partisipp', 'причастие настоящего времени', 'Форма на -ende: lesende — читающий.', 'lesende'],
    ['futurum', /futurum|будущ/, 'Futurum', 'будущее', 'skal / vil / kommer til å + инфинитив.', 'jeg skal lese'],
    ['perfektum', /perfektum|перфект|^perf\.?$|present perfect/, 'Perfektum', 'перфект', 'har + причастие: действие в прошлом, важное сейчас.', 'jeg har lest'],
    ['preteritum', /preteritum|прошедш|^past$|^pret\.?$/, 'Preteritum', 'прошедшее', 'Прошедшее время: что было в прошлом.', 'jeg leste'],
    ['presens', /presens|настоящ|^pres\.?$|^present$/, 'Presens', 'настоящее', 'Настоящее время: что происходит сейчас или обычно.', 'jeg leser'],
    ['infinitiv', /infinitiv|инфинитив|начальн|^inf\.?$/, 'Infinitiv', 'инфинитив', 'Начальная форма глагола, часто с å.', 'å lese'],
    ['imperativ', /imperativ|повелит/, 'Imperativ', 'повелительное', 'Просьба или приказ.', 'les!'],
    ['passiv', /passiv|страдат/, 'Passiv', 'страдательный залог', 'Действие над предметом: -s или bli + причастие.', 'boka leses'],
    ['ue', /ubestemt entall|неопр\.?\w* ед|неопределённ\w* ед|indefinite singular|^sg ?indef/, 'Ubestemt entall', 'неопр. форма, ед. ч.', 'Один, «какой-то»: en bil — машина.', 'en bil'],
    ['be', /bestemt entall|опр\.?\w* ед|определённ\w* ед|definite singular|^sg ?def/, 'Bestemt entall', 'опр. форма, ед. ч.', 'Один, известный: bilen — (эта) машина.', 'bilen'],
    ['uf', /ubestemt flertall|неопр\.?\w* мн|неопределённ\w* мн|indefinite plural|^pl ?indef/, 'Ubestemt flertall', 'неопр. форма, мн. ч.', 'Много, «какие-то»: biler — машины.', 'biler'],
    ['bf', /bestemt flertall|опр\.?\w* мн|определённ\w* мн|definite plural|^pl ?def/, 'Bestemt flertall', 'опр. форма, мн. ч.', 'Много, известные: bilene — (эти) машины.', 'bilene'],
    ['komparativ', /komparativ|сравнит|comparative/, 'Komparativ', 'сравнительная степень', 'Больше / лучше: større — больше.', 'større'],
    ['superlativ', /superlativ|превосход|superlative/, 'Superlativ', 'превосходная степень', 'Самый: størst — самый большой.', 'størst'],
    ['adjmf', /м\/ж род|hankjønn\/hunkjønn|^m\/f|hankjønn og hunkjønn|мужской\/женский/, 'Hankjønn / hunkjønn', 'м. / ж. род', 'Прилагательное при en / ei: en stor bil.', 'en stor bil'],
    ['adjn', /ср\.? род|intetkjønn|nøytrum|средний род|^n$/, 'Intetkjønn', 'средний род', 'Прилагательное при et: обычно + -t: et stort hus.', 'et stort hus'],
    ['adjpl', /^мн\.? число|^flertall|bestemt form|мн\.? ч\.?$|plural$/, 'Flertall / bestemt form', 'мн. ч. / опр. форма', 'Обычно + -e: store biler, den store bilen.', 'store biler'],
    ['positiv', /positiv|основн/, 'Positiv', 'основная форма', 'Прилагательное без сравнения: stor — большой.', 'stor'],
    ['entall', /^entall$|единств/, 'Entall', 'единственное число', 'Один предмет.', 'en bil'],
    ['flertall', /^flertall$|множеств/, 'Flertall', 'множественное число', 'Много предметов.', 'biler'],
  ];
  const TERM = Object.fromEntries(TERMS.map(([key, re, no, ru, tip, ex]) => [key, { key, re, no, ru, tip, ex }]));
  const memo = new Map();
  /** a label as it was saved → its term (or null) */
  function term(raw) {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return null;
    if (memo.has(s)) return memo.get(s);
    let t = null;
    const l = low(s).replace(/ё/g, 'е');
    // the whole label first («м/ж род (positiv)» is the m/f form), then the name in brackets («Форма (preteritum)»)
    const inner = (l.match(/\(([^)]+)\)/) || [])[1];
    for (const probe of [l, inner]) {
      if (!probe || t) continue;
      const hit = TERMS.find(x => x[1].test(probe.trim()));
      if (hit) t = TERM[hit[0]];
    }
    if (!t) { const pk = posKey(s); if (pk && POS[pk] && !/\s/.test(l)) t = Object.assign({ key: 'pos:' + pk }, POS[pk]); }
    if (!t) { const gk = genKey(s); if (gk && !/\s/.test(l.replace(/ род$/, ''))) t = Object.assign({ key: 'g:' + gk }, GEN[gk]); }
    if (memo.size > 400) memo.clear();
    memo.set(s, t);
    return t;
  }
  const pair = (t, cls = '') => `<span class="gt ${cls}" title="${esc(`${t.no} — ${t.ru}${t.tip ? '. ' + t.tip : ''}`)}"><span class="gt-no" lang="nb">${esc(t.no)}</span><span class="gt-dot" aria-hidden="true"> · </span><span class="gt-ru">${esc(t.ru)}</span></span>`;
  /** a form label for display: «Preteritum · прошедшее» (unknown: as it is) */
  function label(raw) {
    const t = term(raw);
    return t ? pair(t) : esc(raw);
  }
  /** plain text «Preteritum · прошедшее» (for copies, titles) */
  const labelText = raw => { const t = term(raw); return t ? `${t.no} · ${t.ru}` : String(raw || ''); };
  function pos(wc) {
    const k = posKey(wc);
    return k ? pair(Object.assign({}, POS[k]), 'gt-pos') : esc(wc);
  }
  const posText = wc => { const k = posKey(wc); return k ? `${POS[k].no} · ${POS[k].ru}` : String(wc || ''); };
  function gender(g) {
    const k = genKey(g);
    return k ? pair(GEN[k], 'gt-gen gt-' + k) : '';
  }
  /** the article of a card's Norwegian side → its gender ('' when it is not «en/ei/et + one noun») */
  const ART = { en: 'm', ei: 'f', et: 'n' };
  function cardGender(card) {
    if (!card) return '';
    const g = genKey(card.gender);
    if (g) return g;
    const first = String(card.no || '').split('\n')[0].trim().replace(/^(en|ei|et)\s*\/\s*(en|ei|et)\s+([\p{L}-]+)$/iu, '$1 $3, $2 $3');
    const m = /^(en|ei|et)\s+([\p{L}-]+)(?:\s*[,/]\s*(en|ei|et)\s+\2)?$/iu.exec(first.replace(/\s*\([^)]*\)\s*$/, ''));
    if (!m) return '';
    const pk = posKey(card.wordClass);
    if (pk && pk !== 'substantiv') return '';
    const a = new Set([ART[m[1].toLowerCase()], m[3] ? ART[m[3].toLowerCase()] : null].filter(Boolean));
    return a.has('m') && a.has('f') ? 'mf' : [...a][0] || '';
  }
  function cardPos(card) {
    if (!card) return '';
    const k = posKey(card.wordClass);
    if (k) return k;
    const first = String(card.no || '').split('\n')[0].trim();
    if (/^å\s+[\p{L}-]+$/iu.test(first)) return 'verb';
    if (cardGender(card)) return 'substantiv';
    return '';
  }
  /** the badges on the back of a card */
  function badges(card) {
    const k = cardPos(card), g = cardGender(card);
    const unknown = !k && card && card.wordClass ? `<span class="gt-badge"><span class="gt">${esc(card.wordClass)}</span></span>` : '';
    if (!k && !g && !unknown) return '';
    return `<div class="gt-badges" aria-label="Грамматика">${k ? `<span class="gt-badge gt-b-pos">${pair(POS[k])}</span>` : unknown}${g ? `<span class="gt-badge gt-b-gen gt-b-${g}">${pair(GEN[g])}</span>` : ''}</div>`;
  }
  /** the card editor's part-of-speech selector (a value that is not in the list stays as its own option) */
  function posSelect(value) {
    const v = String(value || '').trim(), k = posKey(v);
    const opts = POS_ORDER.map(x => `<option value="${x}" ${k === x && v.toLowerCase() === x ? 'selected' : ''}>${esc(POS[x].no)} · ${esc(POS[x].ru)}</option>`);
    let extra = '';
    if (v && !(k && v.toLowerCase() === k && POS_ORDER.includes(k))) extra = `<option value="${esc(v)}" selected>${esc(k ? `${v} (${POS[k].no} · ${POS[k].ru})` : v)}</option>`;
    return `<select class="input gt-select" data-f="wordClass" aria-label="Часть речи" title="Часть речи: по-норвежски · по-русски">
      <option value="" ${v ? '' : 'selected'}>— не указана —</option>${extra}${opts.join('')}</select>`;
  }
  /** a value written into the selector by AI / a dictionary: the canonical name, an option of its own if unknown */
  function setSelect(el, v) {
    if (!el || el.tagName !== 'SELECT') return false;
    const k = posKey(v), want = k && POS_ORDER.includes(k) ? k : String(v || '').trim();
    if (want && ![...el.options].some(o => o.value === want)) el.insertAdjacentHTML('beforeend', `<option value="${esc(want)}">${esc(want)}</option>`);
    el.value = want;
    return true;
  }

  /* ---------- 📖 the glossary (help centre) ---------- */
  const say = t => `<button type="button" class="icon-btn sm gt-say" data-gram-say="${esc(t)}" title="Произнести: ${esc(t)}" aria-label="Произнести: ${esc(t)}">🔊</button>`;
  const GROUPS = [
    ['🔤 Части речи', POS_ORDER.slice(0, 11).map(k => POS[k])],
    ['⚧ Род существительных', ['m', 'f', 'n'].map(k => GEN[k])],
    ['📦 Формы существительных', ['ue', 'be', 'uf', 'bf'].map(k => TERM[k])],
    ['⏱ Глаголы: формы и времена', ['infinitiv', 'presens', 'preteritum', 'perfpart', 'perfektum', 'pluskv', 'futurum', 'imperativ', 'passiv'].map(k => TERM[k])],
    ['📏 Прилагательные', ['positiv', 'adjmf', 'adjn', 'adjpl', 'komparativ', 'superlativ'].map(k => TERM[k])],
  ];
  function glossaryHtml() {
    return `<div class="gt-gloss" lang="ru">
      <p class="gt-gloss-intro small">Так эти слова подписаны на карточках: <b lang="nb">по-норвежски</b> · по-русски. Наведите на подпись (или нажмите на телефоне) — появится пояснение. 🔊 — пример вслух.</p>
      ${GROUPS.map(([h, list]) => `<section class="gt-gsec"><h4>${h}</h4><div class="gt-glist">${list.map(t => `<div class="gt-gi">
          <div class="gt-gt"><b lang="nb">${esc(t.no)}</b><span>${esc(t.ru)}</span></div>
          <div class="gt-gtip">${esc(t.tip || '')}</div>
          <div class="gt-gex"><span lang="nb">${esc(t.ex || '')}</span>${t.ex ? say(t.ex) : ''}</div></div>`).join('')}</div></section>`).join('')}
    </div>`;
  }
  // one listener for every 🔊 of the glossary / the badges
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-gram-say]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    try { if (window.TTS) TTS.speak(b.dataset.gramSay, 'no'); } catch (err) { /* no voice */ }
  }, true);
  // phones: a tap on a label shows its explanation (there is no hover)
  document.addEventListener('click', e => {
    const g = e.target.closest && e.target.closest('.gt-badge .gt, .fg-label .gt');
    if (!g || !(window.matchMedia && matchMedia('(hover: none)').matches) || !window.UI || !UI.toast) return;
    const t = g.getAttribute('title'); if (t) UI.toast(t, '', 4500);
  });

  // the help centre: «🔤 Грамматические термины» (before «Проверить и исправить перевод»)
  try {
    if (window.Help && Array.isArray(Help.TOPICS) && !Help.TOPICS.some(t => t.id === 'gram')) {
      const at = Help.TOPICS.findIndex(t => t.id === 'fix');
      Help.TOPICS.splice(at >= 0 ? at : Help.TOPICS.length, 0, {
        id: 'gram', icon: '🔤', hue: 190, title: 'Грамматические термины', desc: 'Preteritum, bestemt form, hankjønn… — что значит каждая подпись на карточке. С примерами вслух.',
        keys: 'грамматика термины часть речи род формы время глагол существительное прилагательное preteritum presens perfektum infinitiv bestemt ubestemt hankjønn hunkjønn intetkjønn substantiv словарь глоссарий',
        steps: [['🃏', 'На обороте карточки — значки: <b>часть речи</b> и <b>род</b>, по-норвежски и по-русски.'], ['📚', 'В «Формах слова» каждая форма подписана так же: <b>Preteritum · прошедшее</b>.'],
          ['💡', 'Наведите на подпись (на телефоне — нажмите) — появится короткое пояснение с примером.'], ['✏️', 'В редакторе карточки часть речи выбирается из списка.']],
        art: glossaryHtml,
        expect: 'Норвежские названия форм — те же, что в учебниках и словарях (Ordbøkene), а рядом — понятный русский перевод.',
        limits: 'Род и часть речи берутся из карточки: если у неё нет артикля и не указана часть речи, значков не будет — укажите часть речи в редакторе.',
        open: null,
      });
    }
  } catch (e) { /* the help centre is optional */ }

  window.Gram = { term, label, labelText, pos, posText, posKey, gender, genKey, cardGender, cardPos, badges, posSelect, setSelect, glossaryHtml, POS, GEN, TERMS: TERM };
})();
