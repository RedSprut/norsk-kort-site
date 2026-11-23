/* ============ 🪜 «Лестница уровней» — learn by CEFR level, A1 → A2 → B1 → B2 → C1 → C2 ============
 * Data: the Norwegian KELLY list (data/kelly.json — Kelly project, Kilgarriff et al. 2014; Norwegian list by Shu Wang,
 * Tekstlaboratoriet, University of Oslo; CC BY-SA 4.0). The public Norwegian Kelly files have NO official CEFR column:
 * the level here is derived from the frequency rank (1–800 ≈ A1, 801–1800 ≈ A2, 1801–3500 ≈ B1, 3501–4400 ≈ B2,
 * 4401–5200 ≈ C1, 5201–6000 ≈ C2 — the file itself stops at «B2»; its rarest tail is split into C1 / C2 here), plus a
 * small editorial correction: everyday closed sets (numbers, days, colours, family, food, rooms, transport) that the
 * public curriculum («Læreplan i norsk for voksne innvandrere», HK-dir) puts at A1/A2 are moved down from B1/B2.
 * C1 and C2 are honest about what they are: the rarest ~1600 words of the Kelly list, not a full «C1–C2 vocabulary»
 * (no open Norwegian list with official levels exists).
 *
 * - A deck per level («Колода A1» … «Колода C2»; the first version's «Уровень A1» is renamed once), created lazily: words are added in portions (20 / 50 / 100), and every card is
 *   made with the app's own pipeline in the background, batch by batch: translation (AI by meaning, with the English
 *   sense as a hint — else the free translators, which rest when they hit a limit), gender + forms (Norsk ordbank,
 *   offline), an example (AI, or a human-translated Tatoeba sentence), a picture (Images, after the cards), AI check.
 * - Topics inside a level («Еда», «Числа и время»…): by AI when connected (in the same cheap batched call), otherwise
 *   by a built-in keyword map over the word and its English sense. The deck page shows topic chips → a study session.
 * - «🎯 Где я сейчас?» — a 28-word placement test (знаю / не уверен / не знаю + a 4-option check).
 * - ~80 % of a level learned (FSRS: review state, stability ≥ 7 days — or «выучено») → «Уровень A1 пройден! Открыть A2?».
 *   Levels are never locked.
 * - Subtitle player: optional (off by default) highlight of the current / next level's words that are not in the cards.
 * State: Store.settings.levels (synced with the rest of the settings).
 */
(function () {
  const esc = s => U.esc(s == null ? '' : String(s));
  /** the drawn ladder (js/app.js NavIcons) — no coloured emoji as an icon */
  const LAD = (sz, cls) => (window.NavIcons && NavIcons.icon ? NavIcons.icon('ladder', sz || 18, 'lv-ico' + (cls ? ' ' + cls : '')) : '');
  const low = s => String(s || '').toLowerCase();
  const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const DATA = LEVELS;            // every level has its words now: C1 / C2 are the rarest bands of the Kelly list (see load())
  const SRC = ['A1', 'A2', 'B1', 'B2']; // the levels written in data/kelly.json
  const C1_FROM = 4401, C2_FROM = 5201; // ranks: B2 3501–4400, C1 4401–5200, C2 5201–6000 (≈800–900 words each)
  const NAMES = { A1: 'Начальный', A2: 'Элементарный', B1: 'Средний', B2: 'Выше среднего', C1: 'Продвинутый', C2: 'Свободный' };
  const PASS = 0.8;               // share of a level learned → «пройден»
  const BATCH = 20;               // words per background batch
  const TR_KEY = 'nk-kelly-ru';   // the same translation cache as «🎯 Следующие слова» (js/drills.js)
  const ATTR = 'Слова: Norwegian KELLY list — Kelly project (Kilgarriff et al. 2014), норвежский список Shu Wang, Tekstlaboratoriet, Университет Осло (tekstlab.uio.no/kelly), CC BY-SA 4.0. Уровни ≈ по частотности (не официальная оценка CEFR): A1 — места 1–800, A2 — до 1800, B1 — до 3500, B2 — до 4400, C1 — до 5200, C2 — до 6000. Формы и род: Norsk ordbank (Språkbanken, CC BY 4.0).';
  const ATTR_HTML = 'Слова: <a href="https://tekstlab.uio.no/kelly/" target="_blank" rel="noopener">Norwegian KELLY list</a> (Kelly project, Kilgarriff et al. 2014; норвежский список — Shu Wang, Tekstlab UiO), <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>. Уровень — по частотности слова, приблизительно (официальных уровней CEFR у этого списка нет): A1 — первые 800 слов, A2 — до 1800, B1 — до 3500, B2 — до 4400, C1 — до 5200, C2 — до 6000. Род и формы: <a href="https://www.nb.no/sprakbanken/ressurskatalog/oai-nb-no-sbr-5/" target="_blank" rel="noopener">Norsk ordbank</a>, CC BY 4.0. Темы — по мотивам открытой учебной программы HK-dir для взрослых иммигрантов.';
  const WORD_CLASS = { n: 'substantiv', v: 'verb', adj: 'adjektiv', adv: 'adverb', prep: 'preposisjon', pron: 'pronomen', conj: 'konjunksjon', subj: 'konjunksjon', det: 'determinativ', num: 'tallord', interj: 'interjeksjon' };
  const mainPos = p => String(p || '').split(',')[0].trim();
  const offline = () => navigator.onLine === false;

  /* ---------- topics (inspired by the public curriculum themes; our own word lists) ---------- */
  const TOPICS = [
    { id: 'общение', ico: '👋', name: 'Я и общение', ai: 'greetings, talking, language, opinions',
      no: 'hei hallo takk ja nei navn hilse snakke si spørre svare språk norsk ord unnskyld velkommen spørsmål svar samtale fortelle forstå mene synes tro vite kjenne ønske be beklage',
      en: /\b(hello|hi|thank|yes|greet|speak|talk|say|ask|answer|language|word|sorry|excuse|welcome|question|conversation|tell|understand|opinion|believe|mean|wish|explain|call)/ },
    { id: 'семья', ico: '👨‍👩‍👧', name: 'Семья и люди', ai: 'family, people, relationships, age',
      no: 'mor far bror søster barn sønn datter foreldre familie mann kone kvinne gutt jente venn venninne bestemor bestefar onkel tante kjæreste gift baby person menneske folk nabo søsken mamma pappa tippoldebarn',
      en: /\b(mother|father|mum|mom|dad|brother|sister|child|son|daughter|parent|family|husband|wife|woman|boy|girl|friend|grand|uncle|aunt|cousin|baby|people|person|neighbo|married|wedding|born|birth|human|guy)/ },
    { id: 'еда', ico: '🍞', name: 'Еда', ai: 'food, drinks, cooking, meals',
      no: 'mat spise drikke brød melk ost kaffe te vann eple frukt grønnsak kjøtt fisk middag frokost lunsj kake egg smør sukker salt øl vin sulten tørst potet ris suppe sjokolade bær',
      en: /\b(food|eat|drink|bread|milk|cheese|coffee|tea\b|apple|fruit|vegetable|meat|fish|dinner|breakfast|lunch|cake|egg|butter|sugar|salt|beer|wine|hungry|thirst|cook|meal|taste|potato|chicken|rice|soup|sauce|chocolate|juice|berr|dish|recipe|bake)/ },
    { id: 'покупки', ico: '💳', name: 'Покупки и деньги', ai: 'shopping, money, prices, banking',
      no: 'kjøpe selge butikk pris krone penge penger betale billig dyr regning handle kunde tilbud kroner',
      en: /\b(buy|sell|shop|store|price|cost|money|pay|cheap|expensive|bill|bank|salary|tax|econom|euro|dollar|krone|sale|customer|market|offer|loan|debt|budget|purchase|spend|fee)/ },
    { id: 'время', ico: '🕐', name: 'Числа и время', ai: 'numbers, time, days, months, dates',
      no: 'dag uke måned år time minutt sekund morgen kveld natt mandag tirsdag onsdag torsdag fredag lørdag søndag januar februar mars april mai juni juli august september oktober november desember helg tid klokke nå snart alltid aldri ofte tidlig sen første andre tredje halv tall prosent million',
      en: /\b(day|week|month|year|hour|minute|second|morning|evening|night|today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may\b|june|july|august|september|october|november|december|time|clock|early|late|soon|always|never|often|season|spring|summer|autumn|winter|date|weekend|first|third|half|number|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|hundred|thousand|million|percent|age|century|period|moment)/ },
    { id: 'дом', ico: '🏠', name: 'Дом и быт', ai: 'home, housing, rooms, furniture, chores',
      no: 'hus hjem hjemme leilighet rom kjøkken bad stue soverom dør vindu seng stol bord vegg tak hage nøkkel bo flytte vaske rydde møbel lampe gulv trapp husleie',
      en: /\b(house|home|flat|apartment|room|kitchen|bath|living|bedroom|door|window|bed\b|chair|table|wall|roof|garden|key|furniture|lamp|floor|stair|clean|wash|rent|live|move|tidy|toilet|shower|sofa|cupboard)/ },
    { id: 'работа', ico: '💼', name: 'Работа', ai: 'work, jobs, office, career',
      no: 'jobb arbeid jobbe arbeide kontor sjef kollega lønn firma bedrift søke møte stilling ansatt arbeidsgiver yrke',
      en: /\b(job|work|office|boss|colleague|salary|company|firm|business|employ|meeting|career|profession|manager|worker|industry|staff|position|task|project|contract|union|leader)/ },
    { id: 'здоровье', ico: '🩺', name: 'Тело и здоровье', ai: 'body, health, doctor, illness',
      no: 'lege syk sykehus helse kropp hode hånd fot øye øre nese munn tann arm bein rygg hjerte blod vondt medisin tannlege frisk sykepleier',
      en: /\b(doctor|ill|sick|hospital|health|body|head|hand|foot|feet|eye|ear\b|nose|mouth|tooth|teeth|arm\b|leg\b|back\b|heart|blood|pain|hurt|medicine|pill|nurse|disease|fever|injur|patient|healthy|dentist|skin|hair)/ },
    { id: 'транспорт', ico: '🚌', name: 'Транспорт и город', ai: 'transport, travel, city, directions',
      no: 'buss tog bil fly båt sykkel vei gate by stasjon reise kjøre trikk t-bane billett flyplass kart nord sør øst vest nordøst nordvest sørøst sørvest venstre høyre',
      en: /\b(bus|train|car\b|plane|flight|fly|boat|ship|bike|bicycle|road|street|city|town|station|travel|drive|trip|ticket|airport|map|north|south|east|west|traffic|tram|metro|left|journey|bridge|village|place)/ },
    { id: 'учёба', ico: '🎓', name: 'Учёба', ai: 'school, studying, education, books',
      no: 'skole lærer elev student studere bok lekse kurs prøve eksamen universitet klasse lære lese skrive barnehage utdanning',
      en: /\b(school|teacher|pupil|student|study|book|homework|course|test|exam|universit|class|lesson|educat|learn|read|write|kindergarten|knowledge|research|subject)/ },
    { id: 'общество', ico: '🏛', name: 'Общество и службы', ai: 'society, government, law, public services, politics',
      no: 'kommune stat land regjering politikk lov rett valg parti politi samfunn borger demokrati statsminister konge nasjon krig stemme kirke religion nav skatt',
      en: /\b(municipal|state|country|government|politic|law|court|society|public|citizen|democra|minister|king|nation|war\b|military|vote|duty|church|religio|police|election|party|council|authorit|rights|crime|prison|social)/ },
    { id: 'досуг', ico: '⚽', name: 'Досуг и культура', ai: 'free time, sport, culture, holidays',
      no: 'film musikk sport spill spille fotball ferie tur kino teater konsert sang danse kunst bilde fest feire jul påske bursdag hobby',
      en: /\b(film|movie|music|sport|game|play|football|holiday|vacation|cinema|theat|concert|song|sing|dance|art\b|photo|picture|party|celebrat|christmas|easter|birthday|hobby|match|team|ski|swim|culture|festival|fun)/ },
    { id: 'природа', ico: '🌲', name: 'Природа и погода', ai: 'nature, weather, animals, environment',
      no: 'natur vær regn snø sol vind skog fjell sjø hav innsjø tre blomst dyr hund katt fugl kald varm klima miljø elv øy himmel stjerne jord is',
      en: /\b(nature|weather|rain|snow|sun\b|wind|forest|mountain|sea\b|ocean|lake|tree|flower|animal|dog|cat\b|bird|cold|warm|hot\b|climate|environment|river|island|sky|star|earth|ice\b|horse|cow|grass|stone|water)/ },
    { id: 'чувства', ico: '💭', name: 'Чувства и характер', ai: 'feelings, emotions, character',
      no: 'glad trist redd sint lei elske like hate håpe føle følelse snill vennlig morsom kjedelig sliten fornøyd lykkelig',
      en: /\b(happy|glad|sad|afraid|fear|angry|love|like|hate|hope|feel|emotion|worr|tired|bored|kind\b|friendly|funny|boring|proud|lonely|calm|nervous|shy|polite|honest|beautiful|ugly|nice)/ },
    { id: 'медиа', ico: '💻', name: 'Интернет и СМИ', ai: 'internet, media, news, phones, computers',
      no: 'internett nett nettside innlegg kommentar artikkel blogg avis tv radio nyhet data datamaskin telefon mobil e-post melding video lenke side',
      en: /\b(internet|web|page|post\b|comment|article|blog|newspaper|tv\b|radio|news|computer|phone|email|e-mail|online|site|link|video|media|message|data|screen|forum|program|software|user)/ },
  ];
  const T_GRAM = { id: 'грамматика', ico: '🔤', name: 'Маленькие слова', ai: 'function words: pronouns, prepositions, conjunctions, articles' };
  const T_MISC = { id: 'разное', ico: '📦', name: 'Разное', ai: 'anything else' };
  const ALL_T = [...TOPICS, T_GRAM, T_MISC];
  const TOPIC = Object.fromEntries(ALL_T.map(t => [t.id, t]));
  const NO_T = new Map();
  TOPICS.forEach(t => t.no.split(/\s+/).forEach(w => { if (w && !NO_T.has(w)) NO_T.set(w, t.id); }));
  const FUNC = new Set(['pron', 'prep', 'conj', 'subj', 'det', 'interj', 'inf', 'part']);
  /** offline topic: the word itself (built-in lists) → its English sense (keywords) → function words → «Разное» */
  function topicOf(x) {
    const w = low(x.w);
    if (NO_T.has(w)) return NO_T.get(w);
    if (FUNC.has(mainPos(x.pos))) return T_GRAM.id;
    const en = low(x.en);
    if (mainPos(x.pos) === 'num') return 'время';
    for (const t of TOPICS) if (en && t.en.test(en)) return t.id;
    if (mainPos(x.pos) === 'adv' && x.rank < 600) return T_GRAM.id;
    return T_MISC.id;
  }
  const topicTag = id => 'тема:' + id;
  const cardTopic = c => { const t = (c.tags || []).find(x => x.startsWith('тема:')); return t ? t.slice(5) : ''; };

  /* ---------- editorial corrections: everyday closed sets the curriculum teaches early ---------- */
  const CORE = {
    A1: 'seks syv åtte ni elleve tolv tjue hundre tusen blå grønn gul brun bror søster datter sønn brød melk ost kaffe te eple banan kjøtt kjøkken stue soverom bad buss tog sykkel mars nord sør øst vest',
    A2: 'bestemor bestefar onkel tante tannlege lege sykehus apotek frisk syk vondt kald varm regn snø vinter sommer høst vår',
  };
  const CORE_SET = {}; Object.entries(CORE).forEach(([L, s]) => s.split(/\s+/).forEach((w, i) => { CORE_SET[w] = { L, i }; }));
  const lvIdx = L => LEVELS.indexOf(L);

  /* ---------- the word list ---------- */
  let K = null, kP = null;
  function load() {
    if (K) return Promise.resolve(K);
    if (!kP) kP = fetch('data/kelly.json').then(r => { if (!r.ok) throw new Error('список слов не загрузился'); return r.json(); }).then(j => {
      const words = (j.words || []).map(([w, rank, pos, level, en]) => {
        const x = { w: String(w), rank: +rank || 0, pos: String(pos || ''), level: SRC.includes(level) ? level : 'B2', en: String(en || ''), key: +rank || 0 };
        // the file marks everything after rank 3500 as «B2»: its rarer tail is split into C1 and C2 (by frequency, like the rest)
        if (x.level === 'B2' && x.rank >= C2_FROM) x.level = 'C2'; else if (x.level === 'B2' && x.rank >= C1_FROM) x.level = 'C1';
        const c = CORE_SET[low(x.w)];
        if (c && lvIdx(c.L) < lvIdx(x.level)) { x.level = c.L; x.core = true; x.key = (c.L === 'A1' ? 300 : 1100) + c.i * 3; }
        x.topic = topicOf(x);
        return x;
      }).filter(x => /^[\p{L}][\p{L} .-]*$/u.test(x.w) && x.w.length > 1 || ['i', 'å', 'ø'].includes(x.w));
      words.sort((a, b) => a.key - b.key);
      const by = {}; DATA.forEach(L => { by[L] = words.filter(x => x.level === L); });
      K = { meta: j, words, by, idx: new Map(words.map(x => [low(x.w), x])) };
      return K;
    }).catch(e => { kP = null; throw e; });
    return kP;
  }

  /* ---------- state ---------- */
  function st() {
    const s = Store.settings;
    if (!s.levels || typeof s.levels !== 'object') s.levels = {};
    const d = s.levels;
    ['pending', 'passed', 'celebrated', 'stat'].forEach(k => { if (!d[k] || typeof d[k] !== 'object') d[k] = {}; });
    if (!Array.isArray(d.known)) d.known = [];
    return d;
  }
  const trStore = (() => { let c = null; return () => { if (!c) { try { c = JSON.parse(localStorage.getItem(TR_KEY) || '{}') || {}; } catch (e) { c = {}; } } return c; }; })();
  const trSave = () => { try { localStorage.setItem(TR_KEY, JSON.stringify(trStore())); } catch (e) { /* full */ } };
  const deckName = L => 'Колода ' + L;
  const OLD_NAME = L => 'Уровень ' + L; // the first version's name — renamed once
  function deckOf(L) {
    const d = Store.decks().find(x => x.levelId === L) || Store.decks().find(x => x.name === deckName(L) || x.name === OLD_NAME(L));
    if (d && d.name === OLD_NAME(L)) { try { Store.updateDeck(d.id, { name: deckName(L) }); } catch (e) { /* later */ } }
    return d;
  }
  function deckFor(L) {
    let d = deckOf(L);
    if (!d) {
      d = Store.addDeck(deckName(L), `🪜 Слова уровня ≈${L} (${NAMES[L].toLowerCase()}) — лестница уровней. ${ATTR}`);
      Store.updateDeck(d.id, { levelId: L });
    } else if (!d.levelId) Store.updateDeck(d.id, { levelId: L });
    return d;
  }
  const levelOfDeck = d => d && (d.levelId || (/^(?:Колода|Уровень) (A1|A2|B1|B2|C1|C2)$/.exec(d.name) || [])[1]) || '';

  /* ---------- what the user knows ---------- */
  const strip = s => low(s).replace(/\([^)]*\)/g, ' ').trim().replace(/^(å|en|ei|et)\s+/i, '').trim().replace(/[.!?…]+$/, '');
  function keysOf(c) { const out = []; String(c.no || '').split('\n')[0].split(/[,;/]/).forEach(p => { const w = strip(p); if (w) out.push(w); }); return out; }
  /** learned by FSRS: «выучено», firmly known, or in review with a memory of a week+ and the last answer not «не знаю» */
  function learnedCard(c) {
    const ss = ['nr', 'rn'].map(d => c.srs && c.srs[d]).filter(s => s && s.reps);
    if (!ss.length) return false;
    if (Store.firmlyKnown(c) || Store.status(c) === 'learned') return true;
    return ss.some(s => s.state === 'review' && s.lastGrade !== 1 && (s.stability || 0) >= 7);
  }
  function scan() {
    const inCards = new Set(), learned = new Set();
    Store.cards().forEach(c => { const ks = keysOf(c); const l = learnedCard(c); ks.forEach(k => { inCards.add(k); if (l) learned.add(k); }); });
    const s = st();
    const known = new Set(s.known.map(low));
    let skip = [];
    try { skip = (Store.settings.drills && Store.settings.drills.kellySkip) || []; } catch (e) { /* none */ }
    skip.forEach(w => known.add(low(w)));
    return { inCards, learned, known };
  }
  function progress(L, sc) {
    if (!K || !K.by[L]) return { total: 0, cards: 0, learned: 0, pct: 0 };
    sc = sc || scan();
    const ws = K.by[L];
    const all = !!st().passed[L];
    let cards = 0, learned = 0;
    ws.forEach(x => { const w = low(x.w); if (sc.inCards.has(w)) cards++; if (all || sc.learned.has(w) || sc.known.has(w)) learned++; });
    return { total: ws.length, cards, learned, pct: ws.length ? learned / ws.length : 0, all };
  }
  /** the level to work on now: the chosen one, else the first not passed */
  function currentLevel(sc) {
    const s = st();
    if (s.current && DATA.includes(s.current) && !(progress(s.current, sc).pct >= PASS)) return s.current;
    return DATA.find(L => progress(L, sc).pct < PASS) || 'C2';
  }
  const nextOf = L => DATA[DATA.indexOf(L) + 1] || '';

  /* ---------- translation (+ topic + example by AI, in one batched call) ---------- */
  const kQuery = x => mainPos(x.pos) === 'v' ? 'å ' + x.w : x.w;
  const extra = new Map();   // word → { topic, ex, exRu } from the AI (this session)
  async function aiBatch(items, L) {
    const ids = ALL_T.map(t => `${t.id} = ${t.ai}`).join('; ');
    const arr = AI.parseJSON(await AI.call({
      system: 'You are a Norwegian–Russian dictionary for language learners. Answer with JSON only.',
      user: `For each Norwegian Bokmål word return an object:
"ru": the 1–3 most common Russian meanings, comma-separated, short ("pos" = part of speech, "en" = the English sense — use it to pick the right meaning);
"topic": ONE id from this list: ${ids};
"ex": a short natural Norwegian example sentence (level ${L}, at most 8 words) with the word;
"exRu": the Russian translation of the example (by meaning).
Return ONLY a JSON array, same order, same length.
${JSON.stringify(items.map(x => ({ no: x.w, pos: x.pos, en: x.en })))}`,
      maxTokens: 200 + items.length * 90, temperature: 0.2,
    }));
    if (!Array.isArray(arr)) throw new Error('bad answer');
    const c = trStore(), by = 'ai:' + (AI.lastProvider || AI.current());
    items.forEach((x, j) => {
      const o = arr[j] && typeof arr[j] === 'object' ? arr[j] : { ru: arr[j] };
      const ru = String(o.ru || '').trim();
      if (ru && U.cyrRatio(ru) > 0.5) c[x.w] = [ru, by];
      const e = { topic: TOPIC[String(o.topic || '').trim()] ? String(o.topic).trim() : '', by };
      const ex = String(o.ex || '').trim(), exRu = String(o.exRu || '').trim();
      if (ex && exRu && U.cyrRatio(exRu) > 0.5 && ex.length < 140) { e.ex = ex; e.exRu = exRu; }
      extra.set(x.w, e);
    });
    trSave();
  }
  async function mtBatch(items) {
    const c = trStore();
    const content = items.filter(x => ['n', 'v', 'adj'].includes(mainPos(x.pos)) || !x.en);
    const func = items.filter(x => !content.includes(x));
    const run = async (list, texts, from) => {
      if (!list.length) return;
      const res = await Translators.translateMany(texts, from, 'ru', { quiet: true, noAI: true });
      const id = (res.by || []).find(b => b !== 'ai') || (res.by || [])[0] || 'google';
      list.forEach((x, j) => {
        const t = String(res.out[j] || '').trim().replace(/^(чтобы|к)\s+/i, '');
        if (t && U.cyrRatio(t) > 0.5 && low(t) !== low(x.w)) c[x.w] = [t, 'tr:' + id];
      });
    };
    await run(content, content.map(kQuery), 'no');
    await run(func, func.map(x => x.en), 'en');
    trSave();
  }
  async function translate(items, L, wantExtra) {
    const c = trStore();
    if (offline()) return;
    if (AI.available()) {
      const need = items.filter(x => !c[x.w] || (wantExtra && !extra.has(x.w)));
      if (need.length) { try { await aiBatch(need, L); } catch (e) { console.warn('levels: AI batch', e && e.message); } }
    }
    const rest = items.filter(x => !c[x.w]);
    if (rest.length) { try { await mtBatch(rest); } catch (e) { console.warn('levels: translators', e && e.message); } }
  }

  /* ---------- gender + forms (Norsk ordbank, offline) ---------- */
  const artOf = g => { const a = [].concat(g || []); return !a.length ? '' : a.includes('m') ? 'en' : a.includes('f') ? 'ei' : 'et'; };
  async function para(x) {
    if (!window.Lexicon) return null;
    const pos = { n: 'subst', v: 'verb', adj: 'adj' }[mainPos(x.pos)];
    if (!pos) return null;
    try { return await Lexicon.paradigm(x.w, pos); } catch (e) { return null; }
  }
  function formsOf(p) {
    const out = []; if (!p || !p.forms) return out;
    const F = s => (p.forms[s] || [])[0];
    const art = artOf(p.gender);
    if (p.pos === 'subst') [['sgIndef', 'Неопр. ед. (ubestemt entall)', w => `${art} ${w}`.trim()], ['sgDef', 'Опр. ед. (bestemt entall)'], ['plIndef', 'Неопр. мн. (ubestemt flertall)'], ['plDef', 'Опр. мн. (bestemt flertall)']]
      .forEach(([s, label, fn]) => { if (F(s)) out.push({ label, no: fn ? fn(F(s)) : F(s), ru: '' }); });
    if (p.pos === 'verb') [['inf', 'Инфинитив (infinitiv)', w => 'å ' + w], ['pres', 'Настоящее (presens)', w => 'jeg ' + w], ['pret', 'Прошедшее (preteritum)', w => 'jeg ' + w], ['perf', 'Причастие прош. (perfektum partisipp)', w => 'jeg har ' + w]]
      .forEach(([s, label, fn]) => { if (F(s)) out.push({ label, no: fn(F(s)), ru: '' }); });
    if (p.pos === 'adj') [['mf', 'м/ж род (positiv)'], ['n', 'ср. род (positiv)'], ['pl', 'мн. число'], ['comp', 'Сравнительная (komparativ)'], ['sup', 'Превосходная (superlativ)']]
      .forEach(([s, label]) => { if (F(s)) out.push({ label, no: F(s), ru: '' }); });
    return out;
  }

  /* ---------- the background job: portions of words → cards, batch by batch ---------- */
  const Job = { running: false, stop: false, L: '', msg: '', pause: '', toast: null };
  const listeners = new Set();
  function emit() { listeners.forEach(fn => { try { fn(); } catch (e) { /* a view that is gone */ } }); paintJobs(); }
  function jobInfo(L) {
    const s = st(), p = (s.pending[L] || []).length, t = s.stat[L] || { done: 0, total: 0 };
    return { pending: p, done: t.done || 0, total: Math.max(t.total || 0, (t.done || 0) + p), running: Job.running && Job.L === L, paused: Job.running && Job.L === L ? Job.pause : '' };
  }
  function jobHtml(L) {
    const j = jobInfo(L);
    if (!j.pending) return '';
    const pct = j.total ? Math.round(j.done / j.total * 100) : 0;
    return `<div class="lv-job" data-lv-job="${L}" role="status" aria-live="polite">
      <div class="lv-job-top"><span>${j.running ? '<span class="spinner sm"></span>' : '⏸'} ${j.running ? (j.paused ? esc(j.paused) : `Готовлю карточки: перевод, род, формы, пример…`) : `Осталось добавить ${j.pending} ${U.plural(j.pending, ['слово', 'слова', 'слов'])}`}</span><b>${j.done} / ${j.total}</b></div>
      <div class="lv-job-bar"><i style="width:${pct}%"></i></div>
      <div class="lv-job-btns">${j.running ? `<button class="btn sm ghost" data-lv-act="stop" data-l="${L}">⏸ Пауза</button>` : `<button class="btn sm" data-lv-act="resume" data-l="${L}">▶ Продолжить</button><button class="btn sm ghost" data-lv-act="drop" data-l="${L}">✕ Не добавлять</button>`}</div></div>`;
  }
  function paintJobs() { document.querySelectorAll('[data-lv-job]').forEach(el => { const h = jobHtml(el.dataset.lvJob); if (h) el.outerHTML = h; else el.remove(); }); }

  /** add words of a level (lemmas) — the deck is created if needed; the cards are made in the background */
  async function enqueue(L, words) {
    await load();
    const s = st(), sc = scan();
    const have = new Set(s.pending[L] || []);
    const add = words.map(w => (K.idx.get(low(w)) || {}).w).filter(w => w && !have.has(w) && !sc.inCards.has(low(w)));
    if (!add.length) return 0;
    deckFor(L);
    s.pending[L] = [...(s.pending[L] || []), ...add];
    const t = s.stat[L] || (s.stat[L] = { done: 0, total: 0 });
    if (!Job.running || Job.L !== L) { if (!(s.pending[L].length - add.length)) { t.done = 0; t.total = 0; } }
    t.total = (t.total || 0) + add.length;
    Store.save();
    run();
    emit();
    return add.length;
  }
  /** the next n words of a level (optionally of one topic) that are not in the cards and not marked as known */
  function nextWords(L, n, topic) {
    const sc = scan(), s = st(), pend = new Set(s.pending[L] || []);
    return K.by[L].filter(x => !sc.inCards.has(low(x.w)) && !sc.known.has(low(x.w)) && !pend.has(x.w) && (!topic || x.topic === topic)).slice(0, n).map(x => x.w);
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function run() {
    if (Job.running) return;
    Job.running = true; Job.stop = false;
    let made = 0, mt = false, lastL = '';
    try {
      for (;;) {
        if (Job.stop) break;
        const s = st();
        const L = DATA.find(l => (s.pending[l] || []).length);
        if (!L) break;
        Job.L = L; lastL = L;
        const deck = deckOf(L);
        if (!deck) { delete s.pending[L]; delete s.stat[L]; Store.save(); continue; } // the deck was deleted meanwhile
        if (!Job.toast) Job.toast = UI.progressToast(`${deckName(L)}: готовлю карточки…`);
        const batch = s.pending[L].slice(0, BATCH);
        // the free translators rest after «too many requests»: wait a little instead of asking again and again
        if (!AI.available() && Translators.gCooling && Translators.gCooling()) { Job.pause = '⏳ Переводчик Google отдыхает — перевожу другими, медленнее'; emit(); await wait(4000); }
        Job.pause = ''; emit();
        const r = await makeBatch(L, deck, batch);
        made += r.made; mt = mt || r.mt;
        const s2 = st();
        s2.pending[L] = (s2.pending[L] || []).filter(w => !batch.includes(w));
        const t = s2.stat[L] || (s2.stat[L] = { done: 0, total: 0 });
        t.done = (t.done || 0) + batch.length;
        if (!s2.pending[L].length) { delete s2.pending[L]; delete s2.stat[L]; }
        Store.save();
        const j = jobInfo(L);
        if (Job.toast) Job.toast.set(j.done, j.total, `${deckName(L)}: ${j.done} из ${j.total}`);
        emit();
        refreshViews(deck.id);
        await wait(AI.available() ? 600 : 1500);
      }
    } catch (e) {
      console.warn('levels: job', e);
    } finally {
      Job.running = false; Job.L = ''; Job.pause = '';
      if (Job.toast) { Job.toast.close(made ? `Готово: ${U.cards(made)} в «${deckName(lastL)}»${mt ? ' · ⚠️ перевод машинный — перепроверьте' : ''}` : '', mt ? 'warn' : 'good'); Job.toast = null; }
      emit();
      if (lastL) refreshViews((deckOf(lastL) || {}).id);
    }
  }
  function refreshViews(deckId) {
    if (!window.App || !App.view) return;
    if (document.querySelector('#modal-root .modal-backdrop:not(.closing)')) return; // a window is open: do not redraw under it
    const v = App.view;
    if (v.name === 'levels' || (v.name === 'deck' && v.params && v.params.id === deckId)) { try { App.render(); } catch (e) { /* not ours */ } }
  }

  async function makeBatch(L, deck, words) {
    await load();
    const sc = scan();
    let items = words.map(w => K.idx.get(low(w))).filter(Boolean).filter(x => !sc.inCards.has(low(x.w)));
    if (!items.length) return { made: 0, mt: false };
    await translate(items, L, true);
    const pars = new Map();
    await Promise.all(items.map(async x => { const p = await para(x); if (p) pars.set(x.w, p); }));
    // once more right before writing: another window may have added some of them meanwhile
    const sc2 = scan();
    items = items.filter(x => !sc2.inCards.has(low(x.w)));
    if (!Store.deck(deck.id)) return { made: 0, mt: false };
    const c = trStore();
    let mt = false;
    const cards = items.map(x => {
      const pos = mainPos(x.pos), p = pars.get(x.w), tr = c[x.w], e = extra.get(x.w) || {};
      const art = p && p.pos === 'subst' ? artOf(p.gender) : '';
      const no = pos === 'v' ? 'å ' + x.w : art ? `${art} ${x.w}` : x.w;
      const topic = e.topic || x.topic;
      const by = tr ? tr[1] : null;
      const machine = by && by.startsWith('tr:') ? [by.slice(3)] : [];
      if (machine.length || !tr) mt = true;
      const history = [Prov.entry('import', 'import', null, `🪜 Лестница уровней · список Kelly (tekstlab.uio.no, CC BY-SA 4.0) · №${x.rank} · уровень ≈${L}`)];
      if (p) history.push(Prov.entry('import', 'forms', null, 'род и формы: Norsk ordbank (Språkbanken, CC BY 4.0)'));
      if (by) history.push(Prov.entry(by, 'translate', null, 'перевод слова (по смыслу, с подсказкой — английским значением)'));
      if (e.ex) history.push(Prov.entry(e.by || 'import', 'examples', null, 'пример и его перевод'));
      const card = Store.addCard(deck.id, {
        no, ru: tr ? tr[0] : `(англ.) ${x.en}`, en: x.en, wordClass: WORD_CLASS[pos] || '', forms: formsOf(p),
        example: e.ex || '', exampleRu: e.exRu || '',
        description: `🪜 Уровень ≈${L} · ${TOPIC[topic].ico} ${TOPIC[topic].name} · №${x.rank} в частотном списке Kelly (уровень по частотности, приблизительно)${x.en ? ` · англ.: ${x.en}` : ''}`,
        tags: ['kelly', L, topicTag(topic)], history,
        mtWarn: by && by.startsWith('ai:') ? null : machine.length ? Translators.mtFlag(machine) : (tr ? null : { by: ['google'], t: Date.now() }),
      });
      return card;
    });
    await Store.saveNow();
    after(cards);
    return { made: cards.length, mt };
  }

  /* ---------- after the cards: examples (Tatoeba, without AI), pictures, AI check — slow, one by one ---------- */
  const bgQ = [];
  let bgRun = false;
  function after(cards) {
    if (!cards.length) return;
    if (Store.settings.aiAutoSave && AI.available() && Views.runAiCheck) { try { Views.runAiCheck(cards, { quietIfOk: true }); } catch (e) { /* the check is optional */ } }
    bgQ.push(...cards.map(c => c.id));
    bgWork();
  }
  async function bgWork() {
    if (bgRun) return; bgRun = true;
    try {
      while (bgQ.length) {
        const c = Store.card(bgQ.shift()); if (!c) continue;
        if (!c.example && !offline() && window.Sources && Sources.tatoeba && ['substantiv', 'verb', 'adjektiv'].includes(c.wordClass)) {
          try {
            const ex = (await Sources.tatoeba(c, 3)) || [];
            const best = ex.filter(Boolean).sort((a, b) => a.no.length - b.no.length)[0];
            if (best && best.no.length < 120 && Store.card(c.id) && !Store.card(c.id).example) {
              Store.updateCard(c.id, { example: best.no, exampleRu: best.ru, history: Prov.add ? Prov.add(Store.card(c.id), Prov.entry('tr:tatoeba', 'examples', null, 'пример: tatoeba.org (CC BY 2.0 FR), переведён человеком')) : Store.card(c.id).history });
            }
          } catch (e) { /* no example */ }
          await wait(700);
        }
        const cc = Store.card(c.id);
        if (cc && Store.settings.autoImages && Store.settings.imageProvider !== 'off' && window.Images && !cc.image) {
          try { await Images.ensure(cc); } catch (e) { /* the picture comes later, while studying */ }
          await wait(400);
        }
      }
    } finally { bgRun = false; }
  }

  /* ---------- marking words as known (placement) ---------- */
  function markKnown(words, wholeLevels) {
    const s = st();
    const set = new Set(s.known.map(low));
    words.forEach(w => set.add(low(w)));
    s.known = [...set];
    (wholeLevels || []).forEach(L => { s.passed[L] = true; s.celebrated[L] = s.celebrated[L] || Date.now(); });
    // cards of these words that were never studied: «знаю» (FSRS «легко»: next review in about a week) — real progress is never overwritten
    const all = new Set(set);
    (wholeLevels || []).forEach(L => K.by[L].forEach(x => all.add(low(x.w))));
    let n = 0;
    Store.cards().forEach(c => {
      if (!keysOf(c).some(k => all.has(k))) return;
      if (['nr', 'rn'].some(d => c.srs && c.srs[d] && c.srs[d].reps)) return;
      const srs = Object.assign({}, c.srs, { nr: FSRS.review(null, 4) });
      Store.updateCard(c.id, { srs, tags: [...new Set([...(c.tags || []), 'знаю-по-тесту'])] });
      n++;
    });
    if (n && FSRS.Load) FSRS.Load.invalidate();
    Store.save();
    return n;
  }
  function unmark(L) {
    const s = st();
    delete s.passed[L]; delete s.celebrated[L];
    const lv = new Set(K.by[L].map(x => low(x.w)));
    s.known = s.known.filter(w => !lv.has(low(w)));
    Store.cards().forEach(c => {
      if (!(c.tags || []).includes('знаю-по-тесту') || !keysOf(c).some(k => lv.has(k))) return;
      const nr = c.srs && c.srs.nr;
      if (nr && nr.reps === 1 && nr.lastGrade === 4) Store.updateCard(c.id, { srs: {}, tags: c.tags.filter(t => t !== 'знаю-по-тесту') });
    });
    if (FSRS.Load) FSRS.Load.invalidate();
    Store.save();
  }

  /* ---------- UI helpers ---------- */
  const badge = L => `<span class="lv-badge lv-${L}">${L}</span>`;
  function bar(pct, n = 10) {
    const k = Math.round(pct * n);
    return `<span class="lv-seg" role="img" aria-label="${Math.round(pct * 100)}%">${Array.from({ length: n }, (_, i) => `<i class="${i < k ? 'on' : ''}"></i>`).join('')}</span>`;
  }

  /* ---------- 🎉 a level passed ---------- */
  let celebrating = false, celeT = 0;
  async function checkCelebrate() {
    if (celebrating || !K) return;
    // another window is open (welcome, a card…): ask again a little later, not on top of it
    if (document.querySelector('#modal-root .modal-backdrop:not(.closing)')) { clearTimeout(celeT); celeT = setTimeout(checkCelebrate, 2500); return; }
    const s = st(), sc = scan();
    const L = DATA.find(l => !s.celebrated[l] && !s.passed[l] && deckOf(l) && progress(l, sc).pct >= PASS);
    if (!L) return;
    celebrating = true;
    s.celebrated[L] = Date.now(); Store.save();
    const N = nextOf(L);
    const p = progress(L, sc);
    try { UI.confetti(); } catch (e) { /* no canvas */ }
    const r = await UI.choose(`🎉 Уровень ${L} пройден!`,
      `<div class="lv-cele"><div class="lv-cele-ico" aria-hidden="true">🏆</div><p>Вы выучили <b>${p.learned}</b> из ${p.total} слов уровня ${badge(L)} — это ${Math.round(p.pct * 100)}%.</p>
       ${N ? `<p><b>Открыть ${N}?</b> Колода ${badge(N)} создастся сама, слова добавятся порциями. Уровни не закрыты — можно учить любые, в любом порядке.</p>` : `<p>Это вершина лестницы — все шесть ступенек пройдены. Дальше — живой язык: новости, NRK, книги и субтитры.</p>`}</div>`,
      N ? [{ label: 'Позже', value: null, cls: 'ghost' }, { label: `${LAD()}<span>Открыть ${N}</span>`, value: 'next', cls: 'primary' }] : [{ label: 'Отлично!', value: null, cls: 'primary' }]);
    celebrating = false;
    if (r === 'next' && N) { st().current = N; Store.save(); await startLevel(N, 30); }
  }

  /** a level: its deck + the first portion (when it has no cards yet) → the deck page */
  async function startLevel(L, n = 30, topic) {
    try { await load(); } catch (e) { UI.toast('Не удалось загрузить список слов — проверьте интернет и попробуйте ещё раз', 'warn'); return; }
    const d = deckFor(L);
    const s = st();
    s.current = L; Store.save();
    if (!Store.cards(d.id).length && !(s.pending[L] || []).length) await enqueue(L, nextWords(L, n, topic));
    App.go('deck', { id: d.id });
  }

  /** ➕ portion dialog: how many words, which topic */
  async function addDialog(L) {
    await load();
    const sc = scan();
    const left = K.by[L].filter(x => !sc.inCards.has(low(x.w)) && !sc.known.has(low(x.w)));
    if (!left.length) { UI.toast(`Все слова уровня ${L} уже в ваших карточках 🎉`, 'good'); return; }
    const counts = {}; left.forEach(x => { counts[x.topic] = (counts[x.topic] || 0) + 1; });
    let n = Math.min(30, left.length), topic = '';
    const m = UI.modal({
      title: `➕ Слова уровня ${L}`, cls: 'narrow lv-add-modal',
      body: `<p class="small muted" style="margin-top:0">Ещё не в карточках: <b>${left.length}</b> ${U.plural(left.length, ['слово', 'слова', 'слов'])}. Добавляю по частоте — сначала самые нужные. Карточки готовятся в фоне, понемногу: перевод, род и формы, пример, картинка.</p>
        <div class="lv-field"><div class="lv-label">Сколько</div><div class="lv-chips" data-n>${[10, 20, 30, 50, 100].filter(v => v < left.length).concat([left.length]).map(v => `<button type="button" class="chip lv-chip ${v === n ? 'active' : ''}" data-v="${v}" aria-pressed="${v === n}">${v === left.length ? `все ${v}` : v}</button>`).join('')}</div></div>
        <div class="lv-field"><div class="lv-label">Тема</div><div class="lv-chips" data-t><button type="button" class="chip lv-chip active" data-v="" aria-pressed="true">Все темы</button>${ALL_T.filter(t => counts[t.id]).map(t => `<button type="button" class="chip lv-chip" data-v="${t.id}" aria-pressed="false">${t.ico} ${esc(t.name)} <span class="muted">${counts[t.id]}</span></button>`).join('')}</div>
        <div class="tiny muted">Темы без нейросети — по встроенному словарю тем (примерно); с нейросетью уточняются при добавлении.</div></div>`,
      foot: `<button class="btn ghost" data-cancel>Отмена</button><button class="btn primary" data-ok>➕ Добавить ${n}</button>`,
    });
    const okBtn = m.$('[data-ok]');
    const upd = () => { const max = topic ? counts[topic] : left.length; okBtn.textContent = `➕ Добавить ${Math.min(n, max)}`; };
    m.el.addEventListener('click', e => {
      const b = e.target.closest('.lv-chip'); if (!b) return;
      const box = b.parentElement;
      box.querySelectorAll('.lv-chip').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', x === b); });
      if (box.hasAttribute('data-n')) n = +b.dataset.v; else topic = b.dataset.v;
      upd();
    });
    m.$('[data-cancel]').onclick = () => m.close();
    okBtn.onclick = async () => {
      m.close();
      const k = await enqueue(L, nextWords(L, n, topic));
      UI.toast(k ? `Добавляю ${k} ${U.plural(k, ['слово', 'слова', 'слов'])} в «${deckName(L)}» — карточки появятся по мере готовности` : 'Нечего добавлять', k ? 'good' : 'warn', 5000);
    };
  }

  /* =====================================================================
   * 🎯 «Где я сейчас?» — placement test
   * ===================================================================== */
  const PER = 5;
  function sample(rand = Math.random) {
    const out = [];
    DATA.forEach(L => {
      const pool = K.by[L].filter(x => ['n', 'v', 'adj', 'adv'].includes(mainPos(x.pos)) && x.en && x.w.length >= 3 && /^[a-zæøå]+$/.test(x.w));
      const step = pool.length / PER;
      for (let i = 0; i < PER; i++) { const a = Math.floor(i * step), b = Math.max(a + 1, Math.floor((i + 1) * step)); out.push(pool[a + Math.floor(rand() * (b - a))]); }
    });
    return out.filter(Boolean);
  }
  /** answers: [{ L, a: 'know'|'unsure'|'no', ok: true|false|null (the 4-option check, null = not asked) }] */
  function score(answers) {
    const pts = { know: { true: 1, false: 0.15, null: 0.85 }, unsure: { true: 0.6, false: 0, null: 0.35 }, no: { true: 0, false: 0, null: 0 } };
    const by = {};
    DATA.forEach(L => { const a = answers.filter(x => x.L === L); by[L] = a.length ? a.reduce((s, x) => s + pts[x.a][String(x.ok)], 0) / a.length : 0; });
    let level = '';
    for (const L of DATA) { if (by[L] >= 0.7) level = L; else break; }
    const start = level ? (nextOf(level) || 'C2') : 'A1';
    return { by, level, start };
  }
  async function placement() {
    try { await load(); } catch (e) { UI.toast('Не удалось загрузить список слов — проверьте интернет', 'warn'); return; }
    const items = sample();
    const answers = [];
    let check = st().placeCheck !== false, i = 0;
    const c = trStore();
    const ruOf = x => (c[x.w] ? c[x.w][0] : '');
    const m = UI.modal({
      title: '🎯 Где я сейчас?', cls: 'lv-place-modal',
      body: '<div class="lv-place" data-place></div>',
      beforeClose: UI.guard(() => (i > 0 && i < items.length ? { title: 'Прервать тест?', line: 'Ответы не сохранятся.', actions: [{ label: 'Прервать', value: 'close', cls: 'bad' }] } : null)),
    });
    const box = m.$('[data-place]');
    const intro = () => {
      box.innerHTML = `<div class="lv-pl-intro"><div class="lv-pl-ico" aria-hidden="true">🎯</div>
        <p><b>${items.length} слов</b> разных уровней — от A1 до C2. Про каждое ответьте честно: <b>знаю</b>, <b>не уверен</b> или <b>не знаю</b>. Это 3–4 минуты.</p>
        <label class="switch"><input type="checkbox" data-check ${check ? 'checked' : ''}><span class="track"></span><span>Проверять выбором перевода из 4 (точнее)</span></label>
        <p class="tiny muted">Результат — примерный: уровни списка Kelly определены по частотности слов. Тест ничего не меняет без вашего согласия.</p>
        <div class="lv-pl-go"><button class="btn primary lg" data-go>Начать</button></div></div>`;
      box.querySelector('[data-check]').onchange = e => { check = e.target.checked; st().placeCheck = check; Store.save(); };
      box.querySelector('[data-go]').onclick = async () => {
        if (check && items.some(x => !ruOf(x)) && !offline()) {
          box.innerHTML = '<div class="lv-pl-wait"><span class="spinner"></span> Готовлю варианты перевода…</div>';
          try { await Promise.race([translate(items.filter(x => !ruOf(x)), 'A1', false), wait(20000)]); } catch (e) { /* English then */ }
        }
        if (m.el.isConnected) ask();
      };
    };
    const shown = x => (mainPos(x.pos) === 'v' ? 'å ' : '') + x.w;
    const label = x => ruOf(x) || `(англ.) ${x.en}`;
    const ask = () => {
      const x = items[i];
      box.innerHTML = `<div class="lv-pl-q"><div class="lv-pl-top"><span>${i + 1} / ${items.length}</span><div class="lv-pl-bar"><i style="width:${i / items.length * 100}%"></i></div></div>
        <div class="lv-pl-word" lang="nb">${esc(shown(x))} <button class="media-btn sm" data-say title="Произнести" aria-label="Произнести">🔊</button></div>
        <div class="lv-pl-btns"><button class="btn lv-a-know" data-a="know">✅ Знаю</button><button class="btn lv-a-unsure" data-a="unsure">🤔 Не уверен</button><button class="btn lv-a-no" data-a="no">❌ Не знаю</button></div>
        <div class="tiny muted">Клавиши: 1 — знаю · 2 — не уверен · 3 — не знаю</div></div>`;
      box.querySelector('[data-say]').onclick = () => { try { TTS.speak(x.w, 'no', { place: 'cards' }); } catch (e) { /* no voice */ } };
      box.querySelectorAll('[data-a]').forEach(b => { b.onclick = () => answer(b.dataset.a); });
    };
    const answer = a => {
      const x = items[i];
      if (a !== 'no' && check) return choose(x, a);
      answers.push({ L: x.level, w: x.w, a, ok: null });
      nextQ();
    };
    const choose = (x, a) => {
      const pool = items.filter(y => y !== x && label(y) !== label(x));
      const same = U.shuffle(pool.filter(y => mainPos(y.pos) === mainPos(x.pos)));
      const opts = U.shuffle([x, ...[...same, ...U.shuffle(pool)].filter((y, k, arr) => arr.indexOf(y) === k).slice(0, 3)]);
      box.innerHTML = `<div class="lv-pl-q"><div class="lv-pl-top"><span>${i + 1} / ${items.length}</span><div class="lv-pl-bar"><i style="width:${i / items.length * 100}%"></i></div></div>
        <div class="lv-pl-word" lang="nb">${esc(shown(x))}</div><p class="small muted">Что это значит?</p>
        <div class="lv-pl-opts">${opts.map((y, k) => `<button class="btn lv-opt" data-k="${k}">${esc(label(y))}</button>`).join('')}</div>
        <button class="btn sm ghost" data-skip>Не знаю</button></div>`;
      box.querySelectorAll('[data-k]').forEach(b => {
        b.onclick = () => {
          const ok = opts[+b.dataset.k] === x;
          b.classList.add(ok ? 'ok' : 'bad');
          if (!ok) { const r = [...box.querySelectorAll('[data-k]')].find(q => opts[+q.dataset.k] === x); if (r) r.classList.add('ok'); }
          box.querySelectorAll('[data-k]').forEach(q => { q.disabled = true; });
          answers.push({ L: x.level, w: x.w, a, ok });
          setTimeout(nextQ, ok ? 450 : 1100);
        };
      });
      box.querySelector('[data-skip]').onclick = () => { answers.push({ L: x.level, w: x.w, a, ok: false }); nextQ(); };
    };
    const nextQ = () => { i++; if (!m.el.isConnected) return; if (i < items.length) ask(); else result(); };
    const onKey = e => {
      if (!m.el.isConnected) { document.removeEventListener('keydown', onKey, true); return; }
      const b = box.querySelector({ 1: '[data-a="know"]', 2: '[data-a="unsure"]', 3: '[data-a="no"]' }[e.key]);
      if (b && !e.metaKey && !e.ctrlKey) { e.preventDefault(); b.click(); }
    };
    document.addEventListener('keydown', onKey, true);
    const result = () => {
      const r = score(answers);
      const s = st();
      s.placement = { t: Date.now(), level: r.level, start: r.start, by: r.by };
      s.current = r.start; Store.save();
      const knownW = answers.filter(x => x.a === 'know' && x.ok !== false).map(x => x.w);
      const lower = DATA.slice(0, DATA.indexOf(r.level) + 1);
      box.innerHTML = `<div class="lv-pl-res"><div class="lv-pl-ico" aria-hidden="true">${r.level ? '🧭' : '🌱'}</div>
        <h3>${r.level ? `Ваш словарный запас ≈ ${badge(r.level)}` : 'Начните с самого начала'}</h3>
        <p>${r.level ? `Советую начать с уровня ${badge(r.start)}.` : `Советую начать с уровня ${badge('A1')} — самые частые слова.`}${r.level === 'C2' ? ' Все ступеньки лестницы вам по силам — дальше учитесь на живом языке: новости, NRK, книги.' : ''}</p>
        <div class="lv-pl-levels">${DATA.map(L => `<div class="lv-pl-row">${badge(L)}${bar(r.by[L])}<b>${Math.round(r.by[L] * 100)}%</b></div>`).join('')}</div>
        <p class="tiny muted">Примерно: ${PER} слов на уровень. Проходите тест ещё раз когда угодно.</p>
        <div class="lv-pl-acts"><button class="btn primary" data-start>${LAD()}Начать с ${r.start}</button>${(r.level || knownW.length) ? '<button class="btn" data-mark>✓ Отметить известное…</button>' : ''}<button class="btn ghost" data-done>Готово</button></div></div>`;
      box.querySelector('[data-done]').onclick = () => { m.close(); if (App.view.name === 'levels') App.render(); };
      box.querySelector('[data-start]').onclick = () => { m.close(); startLevel(r.start, 30); };
      const mk = box.querySelector('[data-mark]');
      if (mk) mk.onclick = async () => {
        const total = lower.reduce((n, L) => n + K.by[L].length, 0);
        const opts = [{ label: 'Не отмечать', value: null, cls: 'ghost' }];
        if (knownW.length) opts.push({ label: `Только слова из теста (${knownW.length})`, value: 'words', cls: '' });
        if (lower.length) opts.push({ label: `Весь ${lower.join(', ')} (${total})`, value: 'levels', cls: 'primary' });
        const v = await UI.choose('✓ Отметить как известные?',
          `<p>${lower.length ? `Можно считать уровень ${lower.map(badge).join(' ')} пройденным: его слова будут засчитаны как выученные, новых карточек для них не будет, а уже созданные (ещё не изученные) карточки получат «знаю» — следующий повтор примерно через неделю.` : ''}
           ${knownW.length ? ` Или отметить только слова, которые вы знали в тесте (${knownW.length}).` : ''}</p><p class="small muted">Отменить можно на экране «Лестница уровней» — «Снять отметку».</p>`, opts);
        if (!v) return;
        const n = v === 'levels' ? markKnown(knownW, lower) : markKnown(knownW, []);
        UI.toast(v === 'levels' ? `✓ Уровень ${lower.join(', ')} отмечен как пройденный${n ? ` · карточек со статусом «знаю»: ${n}` : ''}` : `✓ Отмечено слов: ${knownW.length}`, 'good', 5000);
        mk.disabled = true; mk.textContent = '✓ Отмечено';
      };
    };
    intro();
    return { m, items, answers };
  }

  /* =====================================================================
   * 🪜 the ladder screen
   * ===================================================================== */
  function ladderHtml() {
    const sc = scan(), s = st();
    const cur = currentLevel(sc);
    const rows = LEVELS.map(L => {
      const p = progress(L, sc), d = deckOf(L), j = jobInfo(L);
      const pct = Math.round(p.pct * 100);
      return `<div class="lv-row ${L === cur ? 'cur' : ''} ${p.pct >= PASS ? 'done' : ''}" data-l="${L}">${badge(L)}
        <div class="lv-row-main">
          <div class="lv-row-head"><b>${L} · ${NAMES[L]}</b>${L === cur ? '<span class="lv-here">вы здесь</span>' : ''}${p.pct >= PASS ? '<span class="lv-passed">✓ пройден</span>' : ''}<span class="grow"></span><b class="lv-pct">${pct}%</b></div>
          <div class="lv-row-bar">${bar(p.pct)}</div>
          <div class="small muted">выучено <b>${p.learned}</b> из ${p.total} · в карточках ${p.cards}${p.all ? ' · отмечен по тесту' : ''}</div>
          ${j.pending ? jobHtml(L) : ''}
          <div class="lv-row-acts">${d
            ? `<button class="btn sm primary" data-lv-act="open" data-l="${L}">📂 Открыть колоду</button><button class="btn sm" data-lv-act="add" data-l="${L}">➕ Ещё слова</button>${Store.cards(d.id).length ? `<button class="btn sm" data-lv-act="study" data-l="${L}">▶ Учить</button>` : ''}`
            : `<button class="btn sm ${L === cur ? 'primary' : ''}" data-lv-act="begin" data-l="${L}">${LAD()}Начать ${L}</button><button class="btn sm ghost" data-lv-act="add" data-l="${L}">➕ Выбрать слова</button>`}
            ${p.all ? `<button class="btn sm ghost" data-lv-act="unmark" data-l="${L}" title="Снова учитывать только выученные карточки">↶ Снять отметку</button>` : ''}</div>
        </div></div>`;
    }).join('');
    const pl = s.placement;
    return `<div class="lv-page">
      <div class="lv-head"><button class="icon-btn" data-lv-act="back" title="Назад" aria-label="Назад">←</button><h1>${LAD()}Лестница уровней</h1></div>
      <div class="panel lv-intro">
        <p>Учите норвежский по ступенькам: <b>A1 → A2 → B1 → B2 → C1 → C2</b>. У каждой ступеньки своя колода («Колода A1»…) и свой «город тем» — «Еда», «Числа и время», «Дом»… Карточки полные: перевод, род, формы, пример, озвучка, картинка. Уровни не закрыты — можно учить любой.</p>
        <div class="lv-intro-acts"><button class="btn primary" data-lv-act="placement">🎯 Где я сейчас? — тест</button>
          ${pl ? `<span class="small muted">Последний тест: ≈ ${pl.level || 'начало'} · ${esc(new Date(pl.t).toLocaleDateString('ru-RU'))}</span>` : `<span class="small muted">${PER * DATA.length} слов, 3–4 минуты — подскажу, с какого уровня начать</span>`}</div>
      </div>
      <div class="lv-ladder" role="list">${rows}</div>
      <div class="panel lv-opts">
        <label class="switch"><input type="checkbox" data-lv-subs-on ${s.subsHL ? 'checked' : ''}><span class="track"></span><span>🎬 Подсвечивать в субтитрах слова моего уровня, которых нет в карточках</span></label>
        <p class="tiny muted">В плеере субтитров (NRK, YouTube, свои видео): «в этой передаче 12 слов уровня A2, которых нет в ваших карточках» — и «➕ Добавить».</p>
      </div>
      <p class="tiny muted lv-attr">${ATTR_HTML}</p>
    </div>`;
  }
  async function onLadderClick(e) {
    const b = e.target.closest('[data-lv-act]'); if (!b) return;
    const L = b.dataset.l;
    switch (b.dataset.lvAct) {
      case 'back': App.back ? App.back() : App.go('home'); break;
      case 'placement': placement(); break;
      case 'begin': startLevel(L, 30); break;
      case 'open': { const d = deckOf(L); if (d) App.go('deck', { id: d.id }); break; }
      case 'add': addDialog(L); break;
      case 'study': { const d = deckOf(L); if (d) Study.start({ deckId: d.id }); break; }
      case 'stop': Job.stop = true; emit(); break;
      case 'resume': run(); emit(); break;
      case 'drop': { const s = st(); delete s.pending[L]; delete s.stat[L]; Store.save(); emit(); if (App.view.name === 'levels') App.render(); break; }
      case 'unmark': if (await UI.confirm(`Снять отметку «уровень ${L} пройден по тесту»? Карточки этого уровня, отмеченные «знаю» по тесту и ещё ни разу не повторённые, снова станут новыми.`, { ok: 'Снять' })) { unmark(L); App.render(); } break;
    }
  }

  /* ---------- home: a tile in «Учить» + a compact ladder ---------- */
  function homeStripHtml() {
    const sc = scan(), cur = currentLevel(sc), s = st();
    const started = DATA.some(L => deckOf(L)) || s.placement;
    return `<div class="panel lv-home" data-lv-home>
      <div class="lv-home-top"><b>${LAD()}Лестница уровней</b><span class="grow"></span><button class="btn sm ${started ? '' : 'primary'}" data-lv-go="ladder">${started ? 'Открыть ›' : 'Начать ›'}</button></div>
      <div class="lv-home-steps">${DATA.map(L => { const p = progress(L, sc); return `<button type="button" class="lv-step ${L === cur ? 'cur' : ''} ${p.pct >= PASS ? 'done' : ''}" data-lv-go="level" data-l="${L}" title="${L}: выучено ${p.learned} из ${p.total}">${badge(L)}${bar(p.pct, 5)}<small>${Math.round(p.pct * 100)}%</small></button>`; }).join('')}</div>
      ${started ? '' : '<div class="small muted">Не знаете, с чего начать? <a href="#" data-lv-go="placement">🎯 Где я сейчас? — тест на 3 минуты</a></div>'}
    </div>`;
  }
  function decorateHome(root) {
    const body = root.querySelector('#qa-learn');
    if (body && !body.querySelector('[data-lv-open]')) {
      body.insertAdjacentHTML('afterbegin', '<button type="button" class="qa-tile" data-lv-open title="Колоды A1 → C2 по темам, тест «Где я сейчас?», прогресс по уровням"><span class="qa-ico" aria-hidden="true">' + LAD(20) + '</span><span class="qa-lbl">Лестница уровней</span></button>');
      const n = root.querySelector('[data-qa-group="learn"] .qa-n'); if (n) n.textContent = body.querySelectorAll('.qa-tile').length;
      body.querySelector('[data-lv-open]').addEventListener('click', e => { e.stopPropagation(); Levels.open(); });
    }
    const stats = root.querySelector('.home-stats');
    const paint = () => {
      if (!stats.isConnected) return;
      const old = root.querySelector('[data-lv-home]');
      if (old) old.remove();
      stats.insertAdjacentHTML('afterend', homeStripHtml());
      const el = root.querySelector('[data-lv-home]');
      el.addEventListener('click', e => {
        const g = e.target.closest('[data-lv-go]'); if (!g) return;
        e.preventDefault(); e.stopPropagation();
        if (g.dataset.lvGo === 'placement') placement();
        else if (g.dataset.lvGo === 'level') { const d = deckOf(g.dataset.l); if (d) App.go('deck', { id: d.id }); else Levels.open(); }
        else Levels.open();
      });
      checkCelebrate();
    };
    if (stats) { if (K) paint(); else load().then(paint).catch(() => { /* no list: no strip */ }); }
  }

  /* ---------- the deck page of a level: progress + «🏙 город тем» (a tile per topic → study / listen / more words) ---------- */
  const HUE = Object.fromEntries(ALL_T.map((t, i) => [t.id, (i * 47 + 200) % 360]));
  const isNewCard = c => !['nr', 'rn'].some(d => c.srs && c.srs[d] && c.srs[d].reps);
  /** per topic of level L: Kelly words (total / learned / still to add) + the deck's cards of that topic */
  function cityStats(L, deck, sc) {
    const cards = Store.cards(deck.id);
    const byKey = new Map(), T = {};
    const o = id => T[id] || (T[id] = { id, total: 0, learned: 0, left: 0, cards: 0, due: 0, fresh: 0 });
    const now = Date.now();
    cards.forEach(c => {
      const t = cardTopic(c) || T_MISC.id, x = o(t);
      x.cards++; if (Store.isDue(c, null, now)) x.due++; if (isNewCard(c)) x.fresh++;
      keysOf(c).forEach(k => byKey.set(k, t));
    });
    const all = !!st().passed[L], pend = new Set(st().pending[L] || []);
    K.by[L].forEach(w => {
      const k = low(w.w), t = byKey.get(k) || w.topic, x = o(t);
      x.total++;
      if (all || sc.learned.has(k) || sc.known.has(k)) x.learned++;
      if (!sc.inCards.has(k) && !sc.known.has(k) && !pend.has(w.w) && w.topic === t) x.left++;
    });
    return { cards, T };
  }
  function ring(pct, ico) {
    const r = 19, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, pct));
    return `<span class="lv-ring" aria-hidden="true"><svg viewBox="0 0 44 44" width="44" height="44"><circle class="lv-ring-bg" cx="22" cy="22" r="${r}"/>
      <circle class="lv-ring-fg" cx="22" cy="22" r="${r}" stroke-dasharray="${(c * v).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 22 22)"/></svg><span class="lv-ring-ico">${ico}</span></span>`;
  }
  function cityHtml(L, stats) {
    const tiles = ALL_T.filter(t => stats.T[t.id] && (stats.T[t.id].total || stats.T[t.id].cards)).map(t => {
      const x = stats.T[t.id], pct = x.total ? x.learned / x.total : 0;
      const sub = x.cards ? `${x.cards} ${U.plural(x.cards, ['карточка', 'карточки', 'карточек'])}${x.total ? ` из ${x.total}` : ''}` : `${x.total} ${U.plural(x.total, ['слово', 'слова', 'слов'])} · ещё не начата`;
      return `<button type="button" class="lv-house ${x.cards ? '' : 'empty'} ${pct >= PASS ? 'done' : ''}" role="listitem" data-lv-house="${t.id}" style="--h:${HUE[t.id]}"
          title="${esc(t.name)}: выучено ${x.learned} из ${x.total}${x.due ? ` · к повторению ${x.due}` : ''}" aria-label="${esc(t.name)}: ${esc(sub)}, выучено ${Math.round(pct * 100)}%">
          ${ring(pct, t.ico)}<span class="lv-house-t"><b>${esc(t.name)}</b><small>${esc(sub)}</small></span>
          <span class="lv-house-pct">${Math.round(pct * 100)}%</span>${x.due ? `<span class="lv-house-due" title="К повторению сегодня">${x.due}</span>` : ''}</button>`;
    }).join('');
    return `<div class="lv-city-h"><b>🏙 Город тем</b><span class="small muted">нажмите на тему — учить или слушать только её</span></div>
      <div class="lv-city" role="list" aria-label="Темы уровня ${L}">${tiles}</div>`;
  }
  /** a topic tile: ▶ Учить / 🎧 Слушать / ➕ слова этой темы — every action runs right inside the tap (sound on iPhone) */
  function houseMenu(L, deck, id) {
    const sc = scan(), { T } = cityStats(L, deck, sc), x = T[id] || { total: 0, learned: 0, left: 0, cards: 0, due: 0, fresh: 0 }, t = TOPIC[id];
    const n = Math.min(20, x.left);
    const m = UI.modal({
      title: `${t.ico} ${esc(t.name)} · ${L}`, cls: 'narrow lv-house-modal',
      body: `<div class="lv-hm"><div class="lv-hm-top" style="--h:${HUE[id]}">${ring(x.total ? x.learned / x.total : 0, t.ico)}<div><b>Выучено ${x.learned} из ${x.total}</b>
          <div class="small muted">${x.cards ? `в колоде ${U.cards(x.cards)} · ${x.due} к повторению · ${x.fresh} новых` : 'в колоде пока нет карточек этой темы'}</div></div></div>
        <div class="lv-hm-acts">
          ${x.cards ? `<button class="btn primary" data-hm="study">▶ Учить тему</button><button class="btn" data-hm="listen">🎧 Слушать тему</button>` : ''}
          ${n ? `<button class="btn ${x.cards ? 'ghost' : 'primary'}" data-hm="add">➕ Добавить ${n} ${U.plural(n, ['слово', 'слова', 'слов'])} темы</button>` : (x.cards ? '' : '<p class="small muted">Все слова этой темы уже в карточках или отмечены как известные.</p>')}
        </div></div>`,
    });
    m.el.addEventListener('click', e => {
      const b = e.target.closest('[data-hm]'); if (!b) return;
      const a = b.dataset.hm;
      const ids = () => Store.cards(deck.id).filter(c => (cardTopic(c) || T_MISC.id) === id).map(c => c.id);
      if (a === 'listen') { const list = ids(); m.close(); if (window.ListenUI) ListenUI.cards(list, 0, `${deckName(L)} · ${t.name}`); return; }
      m.close();
      if (a === 'study') studyTopic(deck.id, id);
      else if (a === 'add') enqueue(L, nextWords(L, n, id)).then(k => UI.toast(k ? `Добавляю ${k} ${U.plural(k, ['слово', 'слова', 'слов'])} темы «${t.name}» — карточки появятся по мере готовности` : 'Нечего добавлять', k ? 'good' : 'warn', 5000));
    });
    return m;
  }
  function decorateDeck(root, params) {
    const deck = Store.deck(params && params.id);
    const L = levelOfDeck(deck);
    if (!L || !DATA.includes(L)) return;
    const launcher = root.querySelector('.launcher'); if (!launcher) return;
    const paint = () => {
      if (!launcher.isConnected) return;
      const old = root.querySelector('[data-lv-deck]'); if (old) old.remove();
      const sc = scan(), p = progress(L, sc);
      const stats = cityStats(L, deck, sc), cards = stats.cards;
      const now = Date.now();
      const due = cards.filter(c => Store.isDue(c, null, now)).length, fresh = cards.filter(isNewCard).length;
      launcher.insertAdjacentHTML('afterend', `<div class="panel lv-deck" data-lv-deck>
        <div class="lv-deck-top">${badge(L)}<b>${deckName(L)} · ${NAMES[L].toLowerCase()}</b>${bar(p.pct)}<b class="lv-pct">${Math.round(p.pct * 100)}%</b><span class="small muted">выучено ${p.learned} из ${p.total} слов уровня</span>
          <span class="grow"></span><button class="btn sm" data-lv-d="add">➕ Ещё слова</button><button class="btn sm ghost" data-lv-d="ladder">${LAD()}Все уровни</button></div>
        ${jobHtml(L)}
        ${cards.length ? `<div class="lv-topic-go"><button class="btn primary" data-lv-d="study">▶ Учить весь уровень</button><button class="btn" data-lv-d="listen">🎧 Слушать</button><span class="small muted">${due} к повторению · ${fresh} новых</span></div>` : ''}
        ${cityHtml(L, stats)}
        <p class="tiny muted lv-attr">${ATTR_HTML}</p></div>`);
      const el = root.querySelector('[data-lv-deck]');
      el.addEventListener('click', e => {
        e.stopPropagation();
        const h = e.target.closest('[data-lv-house]');
        if (h) { houseMenu(L, deck, h.dataset.lvHouse); return; }
        const j = e.target.closest('[data-lv-act]'); if (j) { onLadderClick(e); return; }
        const b = e.target.closest('[data-lv-d]'); if (!b || b.disabled) return;
        if (b.dataset.lvD === 'add') addDialog(L);
        else if (b.dataset.lvD === 'ladder') Levels.open();
        else if (b.dataset.lvD === 'study') studyTopic(deck.id, '');
        else if (b.dataset.lvD === 'listen' && window.ListenUI) ListenUI.deck(deck.id);
      });
      checkCelebrate();
    };
    if (K) paint(); else load().then(paint).catch(() => { /* no list */ });
  }
  /** a study session of one topic: due cards first, then new ones — the session size from the settings */
  function studyTopic(deckId, topic) {
    const cards = Store.cards(deckId).filter(c => !topic || (cardTopic(c) || T_MISC.id) === topic);
    const now = Date.now();
    const isNew = c => !['nr', 'rn'].some(d => c.srs && c.srs[d] && c.srs[d].reps);
    const due = cards.filter(c => Store.isDue(c, null, now)), fresh = cards.filter(isNew);
    let ids = [...due, ...fresh].map(c => c.id);
    if (!ids.length) ids = cards.map(c => c.id); // everything repeated today: the whole topic once more
    if (!ids.length) { UI.toast('В этой теме пока нет карточек', 'warn'); return; }
    const size = Store.settings.sessionSize || 0;
    Study.start({ deckId, cardIds: size ? ids.slice(0, size) : ids, filter: 'all', size: 0 });
  }

  /* ---------- Settings: the source and the licence ---------- */
  function decorateSettings(root) {
    if (root.querySelector('[data-lv-about]')) return;
    const res = [...root.querySelectorAll('.panel h3')].find(h => /Полезные ресурсы/.test(h.textContent));
    const after = res ? res.closest('.panel') : null;
    const html = `<div class="panel lv-about" data-lv-about style="grid-column:1/-1"><h3>${LAD()}Лестница уровней — источники</h3>
      <p class="small">${ATTR_HTML}</p>
      <p class="small muted">Уровни C1 и C2 — самые редкие слова того же списка (≈ места 4400–6000 по частотности): это словарь продвинутого уровня, а не полный «словарь C1–C2» — официального открытого списка для норвежского нет. Слова из учебников (På vei, Stein på stein, Her på berget, Ny i Norge) защищены авторским правом и в приложение не копируются.</p>
      <label class="switch"><input type="checkbox" data-lv-subs-on ${st().subsHL ? 'checked' : ''}><span class="track"></span><span>🎬 Подсвечивать в субтитрах слова моего уровня</span></label>
      <div style="margin-top:8px"><button class="btn sm" data-lv-open-ladder>${LAD()}Открыть лестницу</button></div></div>`;
    if (after) after.insertAdjacentHTML('afterend', html);
    else { const grid = root.querySelector('.panel') && root.querySelector('.panel').parentElement; if (grid) grid.insertAdjacentHTML('beforeend', html); }
    const el = root.querySelector('[data-lv-about]'); if (!el) return;
    el.addEventListener('change', e => { if (e.target.matches('[data-lv-subs-on]')) { e.stopPropagation(); setSubs(e.target.checked); } });
    el.addEventListener('click', e => { if (e.target.closest('[data-lv-open-ladder]')) { e.stopPropagation(); Levels.open(); } });
  }
  function setSubs(on) { st().subsHL = !!on; Store.save(); if (on) { load().catch(() => {}); if (window.Lexicon) Lexicon.ready().catch(() => {}); } if (window.Subs && Subs.levelRedraw) Subs.levelRedraw(); }

  /* =====================================================================
   * 🎬 the subtitle player: words of the current / next level that are not in the cards (opt-in)
   * ===================================================================== */
  function lemmaHits(tok) {
    if (!K) return null;
    const w = low(tok);
    const x = K.idx.get(w); if (x) return x;
    const c = window.Lexicon && Lexicon.peek ? Lexicon.peek(w) : null;
    if (c) for (const r of c) { const y = K.idx.get(low(r.lemma)); if (y) return y; }
    return null;
  }
  let subsSc = null, subsScT = 0, subsTg = null;
  function subsTargets() {
    if (!subsSc || Date.now() - subsScT > 5000) { subsSc = scan(); subsScT = Date.now(); const cur = currentLevel(subsSc); subsTg = [cur, nextOf(cur)].filter(Boolean); }
    return subsTg;
  }
  /** the level of a word in the player (only the current and the next level; '' = not highlighted) */
  function hit(tok) {
    if (!st().subsHL || !K) return '';
    const x = lemmaHits(tok); if (!x) return '';
    if (!subsTargets().includes(x.level)) return '';
    if (subsSc.inCards.has(low(x.w)) || subsSc.known.has(low(x.w))) return '';
    return x.level;
  }
  /** the bar above the lines: «в этой передаче 12 слов уровня A2, которых нет в ваших карточках · ➕ Добавить» */
  function subsBar(el) {
    if (!el) return;
    const s = st();
    if (!s.subsHL) {
      el.hidden = false;
      el.innerHTML = '<button type="button" class="btn sm ghost lv-subs-on" data-lv-s="on" title="Подсветить слова вашего уровня, которых нет в карточках">' + LAD() + 'Слова моего уровня</button>';
      el.onclick = e => { if (e.target.closest('[data-lv-s="on"]')) { e.stopPropagation(); setSubs(true); } };
      return;
    }
    const draw = () => {
      if (!el.isConnected) return;
      subsSc = null;
      const targets = subsTargets();
      const words = window.Subs && Subs.levelWords ? Subs.levelWords() : [];
      const found = {}; targets.forEach(L => { found[L] = new Map(); });
      words.forEach(w => { const L = hit(w); if (L && found[L]) { const x = lemmaHits(w); found[L].set(x.w, x); } });
      const parts = targets.filter(L => found[L].size);
      el.hidden = false;
      el.innerHTML = `<div class="lv-subs-bar">${parts.length ? parts.map(L => `<span class="lv-subs-n">${badge(L)} в этой передаче <b>${found[L].size}</b> ${U.plural(found[L].size, ['слово', 'слова', 'слов'])} уровня ${L}, которых нет в ваших карточках
          <button type="button" class="btn sm" data-lv-s="add" data-l="${L}" title="${esc([...found[L].keys()].slice(0, 40).join(', '))}">➕ Добавить</button></span>`).join('')
          : `<span class="small muted">${LAD()}Слов уровня ${targets.join(' / ')}, которых нет в ваших карточках, здесь пока нет</span>`}
        <button type="button" class="btn sm ghost" data-lv-s="off" title="Не подсвечивать слова уровня">✕</button></div>`;
      el.onclick = async e => {
        const b = e.target.closest('[data-lv-s]'); if (!b) return;
        e.stopPropagation();
        if (b.dataset.lvS === 'off') { setSubs(false); return; }
        if (b.dataset.lvS === 'add') {
          const L = b.dataset.l, list = [...found[L].keys()];
          b.disabled = true;
          const k = await enqueue(L, list);
          UI.toast(k ? `${k} ${U.plural(k, ['слово', 'слова', 'слов'])} → «${deckName(L)}»: карточки готовятся в фоне` : 'Эти слова уже добавляются', 'good', 5000);
        }
      };
    };
    const ready = [load()];
    if (window.Lexicon && !Lexicon.loaded()) ready.push(Lexicon.ready().catch(() => {}));
    if (K && (!window.Lexicon || Lexicon.loaded())) draw();
    else Promise.all(ready).then(() => { draw(); if (window.Subs && Subs.levelRedraw) Subs.levelRedraw(true); }).catch(() => { el.hidden = true; });
  }

  /* =====================================================================
   * wiring: new view «levels», decorations of home / deck / settings (no edits in views.js)
   * ===================================================================== */
  Views.levels = function (root) {
    const draw = () => { root.innerHTML = ladderHtml(); checkCelebrate(); };
    root.innerHTML = '<div class="lv-page"><div class="lv-head"><button class="icon-btn" data-lv-act="back" title="Назад" aria-label="Назад">←</button><h1>' + LAD() + 'Лестница уровней</h1></div><div class="panel"><span class="spinner sm"></span> Загружаю список слов…</div></div>';
    root.onclick = onLadderClick;
    root.onchange = e => { if (e.target.matches('[data-lv-subs-on]')) setSubs(e.target.checked); };
    load().then(() => { if (App.view.name === 'levels' && root.isConnected) draw(); }).catch(() => {
      root.innerHTML = '<div class="lv-page"><div class="lv-head"><button class="icon-btn" data-lv-act="back" title="Назад" aria-label="Назад">←</button><h1>' + LAD() + 'Лестница уровней</h1></div><div class="panel empty"><p>Не удалось загрузить список слов. Проверьте интернет и попробуйте ещё раз.</p><button class="btn" data-lv-act="retry">🔄 Повторить</button></div></div>';
      root.onclick = e => { if (e.target.closest('[data-lv-act="retry"]')) App.render(); else onLadderClick(e); };
    });
  };
  const wrap = (name, fn) => {
    const orig = Views[name];
    if (typeof orig !== 'function') return;
    Views[name] = function (root, params) { const r = orig.apply(this, arguments); try { fn(root, params); } catch (e) { console.warn('levels: ' + name, e); } return r; };
  };
  wrap('home', decorateHome);
  wrap('deck', decorateDeck);
  wrap('settings', decorateSettings);
  // the job left unfinished last time (the app was closed) goes on by itself, a little later
  setTimeout(() => { try { if (window.Store && Store.state && DATA.some(L => (st().pending[L] || []).length)) run(); } catch (e) { /* later */ } }, 8000);

  const Levels = {
    LEVELS, DATA, TOPICS: ALL_T, ATTR, PASS,
    open() { if (window.App) App.go('levels'); },
    /** 🎯 «Тест уровня» (js/leveltest.js) or any other placement: the level to work on now (A1…C2) + what the test said.
     *  o = { level: the measured level ('' = below A1), by: { A1: share right … }, src } → true when set */
    setLevel(L, o = {}) {
      if (!DATA.includes(L)) return false;
      const s = st();
      s.current = L;
      s.placement = { t: Date.now(), level: LEVELS.includes(o.level) ? o.level : '', start: L, by: o.by && typeof o.by === 'object' ? o.by : {}, src: String(o.src || '').slice(0, 20) };
      Store.save();
      return true;
    },
    load, placement, startLevel, addDialog, enqueue, progress: L => progress(L), currentLevel: () => currentLevel(), checkCelebrate,
    /** subtitle player API */
    subsOn: () => !!st().subsHL, hit, subsBar, setSubs,
    get job() { return Object.assign({}, Job, { toast: undefined }); },
    _t: { topicOf, score, sample, scan, learnedCard, markKnown, unmark, studyTopic, run, nextWords, get K() { return K; }, st },
  };
  window.Levels = Levels;
})();
