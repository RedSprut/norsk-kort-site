/* ============ Pictures by meaning — always one per card ============
 * 1) an AI plans the picture: scene (for the generator) + photo query + emoji + is it concrete?
 * 2) AI picture (Pollinations). Its free tier allows 1 image / 45 s — we respect it and NEVER
 *    save the "Free limit reached" placeholder: the image is downloaded and checked first.
 * 3) a real photo (Wikimedia Commons) for concrete things
 * 4) an emoji picture drawn locally (instant, offline, no limits) — only when an emoji really fits the meaning
 * The plan comes from the card's OWN meaning (word + Russian gloss + part of speech + description hint; course, deck and
 * chapter names stripped): a person's name → a portrait, a place → its map / a landmark (Wikidata → Commons, with
 * credit), a function word (og, men, fordi) → no picture. Nothing fits → no picture (never the old generic «🇳🇴📘»).
 * Every picture is stored INSIDE the card (data URL), so it never changes or disappears later.
 */
(function () {
  const STYLES = {
    illustration: 'colorful detailed digital illustration, clear readable scene, expressive characters, soft lighting',
    photo: 'realistic high quality photograph, natural light, centered subject',
    '3d': 'cute 3D render, clay style, soft studio lighting, centered subject, pastel background',
    watercolor: 'delicate watercolor painting, white background, centered subject',
    cartoon: 'friendly cartoon drawing, bold outlines, bright colors, centered subject',
    sketch: 'minimal pencil sketch, white background, centered subject',
  };
  const STYLE_NAMES = { illustration: 'Иллюстрация', photo: 'Фото', '3d': '3D', watercolor: 'Акварель', cartoon: 'Мультяшный', sketch: 'Скетч' };

  // offline fallback when no AI is reachable: English keyword -> emoji
  const EMOJI_MAP = {
    car: '🚗', house: '🏠', home: '🏡', book: '📖', eat: '🍽️', drink: '🥤', water: '💧', cat: '🐈', dog: '🐕', apple: '🍎',
    girl: '👧', boy: '👦', man: '👨', woman: '👩', child: '🧒', big: '🐘', small: '🐭', walk: '🚶', go: '🚶', run: '🏃',
    talk: '🗣️', speak: '🗣️', understand: '💡', today: '📅☀️', tomorrow: '🌅📅', yesterday: '🌇📅', thanks: '🙏', thank: '🙏',
    hello: '👋', window: '🪟', chair: '🪑', table: '🍽️', sun: '☀️', mountain: '🏔️', friend: '🤝', cold: '🥶', hot: '🥵',
    warm: '☀️', beautiful: '🌸', city: '🏙️', hope: '🙏🌈', late: '⏰🌙', early: '🌅⏰', thirst: '🥵🥤', thirsty: '🥵🥤',
    hungry: '🍽️😋', sleep: '😴', tired: '😴', happy: '😊', sad: '😢', angry: '😠', love: '❤️', work: '💼', school: '🏫',
    teacher: '👩‍🏫', doctor: '🩺', hospital: '🏥', money: '💰', buy: '🛒', shop: '🏪', store: '🏪', food: '🍲', bread: '🍞',
    milk: '🥛', coffee: '☕', tea: '🍵', fish: '🐟', meat: '🥩', train: '🚆', bus: '🚌', plane: '✈️', boat: '⛵', bike: '🚲',
    bicycle: '🚲', road: '🛣️', street: '🛣️', tree: '🌳', forest: '🌲', sea: '🌊', rain: '🌧️', snow: '❄️', wind: '🌬️',
    weather: '🌦️', winter: '❄️', summer: '🏖️', spring: '🌷', autumn: '🍂', fall: '🍂', night: '🌙', morning: '🌅',
    evening: '🌆', day: '☀️', week: '📅', year: '📆', time: '⏰', clock: '🕰️', phone: '📱', computer: '💻', write: '✍️',
    read: '📖', listen: '👂', see: '👀', look: '👀', wait: '⏳', help: '🆘', clean: '🧽', cleaning: '🧹', wash: '🧼',
    change: '🔄', replace: '🔄', deliver: '📦', fetch: '📦', pick: '📦', wake: '⏰', hurry: '🏃💨', fast: '⚡', slow: '🐢',
    kind: '🤗', good: '👍', bad: '👎', new: '✨', old: '👴', young: '🧒', family: '👨‍👩‍👧', mother: '👩', father: '👨',
    family_: '👪', free: '🆓', vacant: '🪑✅', room: '🛏️', kitchen: '🍳', door: '🚪', key: '🔑', music: '🎵', game: '🎲',
  };

  /* ---------- what the card means (pure: no network) — the picture is chosen from THIS, never from the deck ---------- */
  // people's names: the course characters + common Norwegian names (gender for a neutral portrait)
  const FEMALE = new Set(('viola sompit hawa sofie anne inger kari marit ingrid liv eva berit astrid bjørg hilde anna solveig marianne randi ida nina ' +
    'maria marie elisabeth kristin bente heidi silje hanne nora emma sara sofia ingeborg maja olivia ella leah frida emilie thea tuva julie linnea mia ' +
    'hedda vilde amalie ragnhild sigrid tone turid gunn åse wenche camilla mari ane lise kristine karoline line ellen eli siri synnøve guro live aurora ' +
    'iben selma helene grete gro unni torill laila mona irene ellinor fatima amina aisha olga natalia irina svetlana').split(' '));
  const MALE = new Set(('håvard yousef biniam marek eivind bjørnar jan per bjørn ole lars kjell knut arne svein hans geir tor terje odd morten john erik ' +
    'martin andreas thomas jon rune trond harald olav nils kristian magnus jonas emil henrik oskar mathias william filip aksel jakob noah lucas isak ' +
    'sander tobias elias kasper sondre eirik sindre vegard øyvind espen håkon stian petter fredrik anders gunnar leif einar sverre sigurd halvard ' +
    'kåre rolf roar frode tore kjetil ivar ola ahmed mohammed ali omar ivan sergej dmitrij aleksandr').split(' '));
  // countries (Norwegian name → ISO code: the flag emoji for the offline picture) and well-known places
  const COUNTRY = {
    norge: 'NO', sverige: 'SE', danmark: 'DK', finland: 'FI', island: 'IS', polen: 'PL', italia: 'IT', syria: 'SY', eritrea: 'ER', thailand: 'TH',
    somalia: 'SO', tyskland: 'DE', frankrike: 'FR', spania: 'ES', england: 'GB', storbritannia: 'GB', skottland: 'GB', usa: 'US', russland: 'RU',
    ukraina: 'UA', hviterussland: 'BY', kina: 'CN', japan: 'JP', india: 'IN', pakistan: 'PK', afghanistan: 'AF', irak: 'IQ', iran: 'IR', tyrkia: 'TR',
    hellas: 'GR', portugal: 'PT', nederland: 'NL', belgia: 'BE', sveits: 'CH', østerrike: 'AT', litauen: 'LT', latvia: 'LV', estland: 'EE',
    romania: 'RO', bulgaria: 'BG', ungarn: 'HU', tsjekkia: 'CZ', slovakia: 'SK', kroatia: 'HR', serbia: 'RS', bosnia: 'BA', etiopia: 'ET',
    sudan: 'SD', egypt: 'EG', marokko: 'MA', kenya: 'KE', nigeria: 'NG', brasil: 'BR', chile: 'CL', colombia: 'CO', mexico: 'MX', canada: 'CA',
    australia: 'AU', vietnam: 'VN', filippinene: 'PH', irland: 'IE', georgia: 'GE', armenia: 'AM', kasakhstan: 'KZ', moldova: 'MD', libanon: 'LB',
  };
  const PLACES = new Set(('oslo bergen trondheim stavanger tromsø kristiansand drammen fredrikstad bodø ålesund lillehammer hammerfest kirkenes alta ' +
    'molde hamar gjøvik harstad narvik larvik sandnes haugesund arendal skien porsgrunn tønsberg moss sarpsborg halden lofoten svalbard finnmark ' +
    'nordland vestland rogaland trøndelag geiranger stockholm göteborg københavn helsingfors reykjavik london paris berlin roma madrid moskva kyiv ' +
    'kiev warszawa praha wien budapest istanbul damaskus aleppo bangkok mogadishu asmara beijing tokyo europa afrika asia amerika').split(' '));
  // function words: a picture does not help (and a random one confuses) — the card stays clean
  const FUNC = new Set(('og men eller fordi at som om hvis når da der her så i på til fra med av hos ved mot uten etter før under over mellom gjennom ' +
    'rundt langs bak foran siden enn både verken enten heller ikke også bare jo vel nok kanskje allerede ennå fortsatt jeg du han hun den det vi ' +
    'dere de meg deg ham henne oss dem seg min mi mitt mine din di ditt dine sin si sitt sine hans hennes vår vårt våre deres hvem hva hvor hvordan ' +
    'hvorfor hvilken hvilket hvilke noen noe ingen ingenting alle alt hver hvert denne dette disse selv sånn slik hit dit inn ut opp ned bort for ' +
    'mens skjønt dersom altså derfor likevel dessuten').split(' '));
  // course / deck / chapter labels that must never reach a picture prompt or a photo query
  const COURSE_RE = /\b(god\s+i\s+norsk(\s*\d+)?|på\s+vei|norsk\s+pluss|norskpluss|ny\s+i\s+norge|stein\s+på\s+stein|bo\s+i\s+norge|her\s+på\s+berget|tekstbok|arbeidsbok|grammatikk(bok)?|vol\.?\s*\d+|kapittel\s*\d+|kap\.?\s*\d+|leksjon\s*\d+|chapter\s*\d+)\b|(поговорим\s+по-норвежски|мои\s+учебники|глава\s*\d+[^,;)]*|урок\s*\d+|раздел\s*\d+|учебник[а-я]*|колод[а-я]*)/giu;
  const SRC_LINE = /^(Источник:|📍|▶\s*YouTube|📺|🎬|📰|🤖|⚠️|✍️|в тексте:|в предложении:|форма в упражнении:|https?:\/\/)/u;
  const PLACE_RU = /(город|страна|государство|столица|река|озеро|остров|фьорд|гора|регион|область|губерни|фюльке|fylke|коммуна|полуостров|континент|море|океан|деревня|посёлок)/i;
  const NAME_RU = /(^|[^а-яё])(имя|женское\s+имя|мужское\s+имя|фамилия|name)([^а-яё]|$)/i;
  const PORTRAIT = {
    f: ['👩', '👱‍♀️', '👩‍🦰', '👩‍🦱', '💁‍♀️', '🙋‍♀️', '👧'],
    m: ['👨', '👱‍♂️', '👨‍🦰', '👨‍🦱', '🧔', '🙋‍♂️', '👦'],
    '': ['🧑', '🧑‍🦰', '🧑‍🦱', '🙋', '💁', '🧑‍🦳'],
  };
  const hashOf = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; };
  const flagOf = iso => iso ? String.fromCodePoint(...[...iso].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : '';
  const low = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  /** «God i norsk 1 · Глава 3», deck names, chapter labels → out */
  function stripCourse(text, deckName) {
    let t = String(text || '');
    if (deckName && deckName.length >= 3) t = t.split(deckName).join(' ');
    return t.replace(COURSE_RE, ' ').replace(/\b\d+\.\d+\b/g, ' ').replace(/\s*[·•|]\s*(?=[·•|]|$)/g, ' ').replace(/\(\s*[,;:·\s]*\)/g, ' ')
      .replace(/^[\s,;:·•\-–—]+|[\s,;:·•\-–—]+$/g, '').replace(/\s{2,}/g, ' ').trim();
  }
  function posOf(wc, article, word, ru) {
    const w = low(wc);
    if (/egennavn|propn|proper|имя\s+собств/.test(w)) return 'name';
    if (/^(subst|n\b|noun|сущ)/.test(w)) return 'noun';
    if (/^(verb|v\b|глаг)/.test(w)) return 'verb';
    if (/^(adj|прил)/.test(w)) return 'adj';
    if (/^(adv|нареч)/.test(w)) return 'adv';
    if (/^(interj|междом)/.test(w)) return 'interj';
    if (/(konj|subj|prep|pron|determ|artikkel|conj|союз|предлог|местоим|частиц|infinitivsmerke|tallord|числ)/.test(w)) return 'func';
    if (/^(en|ei|et)$/i.test(article)) return 'noun';
    if (/^å$/i.test(article)) return 'verb';
    if (/^\p{Lu}\p{Ll}+$/u.test(word) && /^[А-ЯЁ]/.test(ru || '')) return 'name';
    return '';
  }

  /**
   * The meaning of a card: { word, article, ru, note, pos, kind, gender, iso, hint, key }
   * kind: person | place | function | phrase | abstract | word. ctx.deckName — stripped from every text.
   */
  function meaningOf(card, ctx = {}) {
    const line = String(card.no || '').split('\n')[0].trim();
    const am = line.match(/^(en|ei|et|å)\s+/i);
    const article = am ? am[1].toLowerCase() : '';
    const word = stripCourse(line.replace(/^(en|ei|et|å)\s+/i, '').split(/[,(;/]/)[0], ctx.deckName).trim();
    const ruLine = String(card.ru || '').split('\n')[0];
    const note = stripCourse((ruLine.match(/\(([^)]*)\)/g) || []).map(s => s.slice(1, -1)).join(', '), ctx.deckName);
    const ru = stripCourse(ruLine.replace(/\([^)]*\)/g, ' ').split(/[,;]/)[0], ctx.deckName).replace(/\s{2,}/g, ' ').trim();
    const pos = posOf(card.wordClass, article, word, ru);
    const hint = String(card.description || '').split('\n').map(s => s.trim()).filter(s => s && !SRC_LINE.test(s))
      .map(s => stripCourse(s, ctx.deckName)).filter(s => /\p{L}{3}/u.test(s)).slice(0, 2).join(' ').slice(0, 140);
    const w = word.toLowerCase();
    let kind = 'word', gender = '', iso = '';
    const many = word.split(/\s+/).filter(Boolean).length >= 2 || /[.!?…]$/.test(line);
    if (many) kind = 'phrase';
    else if (pos === 'func' || (!article && FUNC.has(w) && pos !== 'noun' && pos !== 'verb' && pos !== 'adj')) kind = 'function';
    else if (NAME_RU.test(note) || NAME_RU.test(card.wordClass || '') || (pos === 'name' && (FEMALE.has(w) || MALE.has(w)))) kind = 'person';
    else if (COUNTRY[w] || PLACES.has(w) || ((pos === 'name' || /^\p{Lu}/u.test(word)) && PLACE_RU.test(note))) kind = 'place';
    else if (pos === 'name') kind = 'place'; // a proper noun that is not a known name: checked on Wikidata (needs coordinates)
    else if (/(het|else|skap|sjon|itet|isme|dom)$/.test(w) && w.length >= 6) kind = 'abstract';
    else if (/ing$/.test(w) && w.length >= 7 && /^(en|ei)$/.test(article)) kind = 'abstract';
    else if (/^[а-яё]+ость$/i.test(ru) || /^(ожидание|надежда|любовь|страх|свобода|время|мысль|идея|опыт|помощь|ответственность)$/i.test(ru)) kind = 'abstract';
    if (kind === 'person') {
      if (/женск/i.test(note) || FEMALE.has(w)) gender = 'f';
      else if (/мужск/i.test(note) || MALE.has(w)) gender = 'm';
      else if (/[ая]$/i.test(ru)) gender = 'f';
      else if (/[бвгджзклмнпрстфхцчшщй]$/i.test(ru)) gender = 'm';
    }
    if (kind === 'place') iso = COUNTRY[w] || '';
    const key = [low(word), low(ru), pos || kind].join('|');
    return { word, article, ru, note, pos, kind, gender, iso, country: !!iso || /стран|государств/i.test(note), hint, key };
  }

  /** the picture plan without a neural network: { scene, query, emoji, concrete, kind, none, style } — pure */
  function basePlan(m, en, variant = 0) {
    const e = String(en || '').replace(/\([^)]*\)/g, ' ').replace(/^(a|an|the|to)\s+/i, '').replace(/\s{2,}/g, ' ').trim();
    const what = e || m.ru || m.word;
    const v = Math.max(0, variant | 0);
    if (m.kind === 'person') {
      const who = m.gender === 'f' ? 'young woman' : m.gender === 'm' ? 'young man' : 'young person';
      const list = PORTRAIT[m.gender] || PORTRAIT[''];
      return { kind: 'person', style: 'illustration', concrete: false, query: '',
        scene: `a friendly ${who}, head-and-shoulders portrait, warm smile, simple plain pastel background`,
        emoji: list[(hashOf(m.word) + v) % list.length] };
    }
    if (m.kind === 'place') {
      const name = e || m.word;
      return { kind: 'place', concrete: true, query: m.word, country: m.country,
        scene: m.country ? `a clean simple illustrated map of ${name}, the country highlighted, surrounding sea in soft blue`
          : `a famous landmark of ${name}, wide scenic view`,
        emoji: m.iso ? flagOf(m.iso) : m.country ? '🗺️' : '🏙️📍' };
    }
    if (m.kind === 'function') return { kind: 'function', none: true, concrete: false, query: '', scene: '', emoji: '' };
    const emoji = emojiFor(e);
    if (m.kind === 'phrase') return { kind: 'phrase', concrete: false, query: what, emoji, scene: `a simple everyday scene that clearly shows the meaning of the phrase "${what}"` };
    if (m.kind === 'abstract') return { kind: 'abstract', concrete: false, query: what, emoji, scene: `a person in a simple everyday situation that clearly shows the idea of "${what}"` };
    const scene = m.pos === 'verb' ? `a person in an everyday situation clearly showing the action "${what}"`
      : m.pos === 'adj' ? `a simple everyday scene where something is clearly "${what}"`
        : m.pos === 'adv' ? `a simple everyday situation that clearly shows "${what}"`
          : `a clear everyday scene that shows ${/^(a|an|the)\s/i.test(String(en || '').trim()) ? String(en).replace(/\([^)]*\)/g, ' ').trim() : 'a ' + what}`;
    return { kind: 'word', concrete: m.pos === 'noun' || (!m.pos && /^(en|ei|et)$/.test(m.article)), query: e || m.word, emoji, scene };
  }
  /** English keyword(s) → emoji ('' when nothing fits: no generic «flag + book» picture any more) */
  function emojiFor(en) {
    const words = String(en || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
    for (const w of words) {
      if (EMOJI_MAP[w]) return EMOJI_MAP[w];
      const stem = w.replace(/(ing|ed|es|s)$/, '');
      if (EMOJI_MAP[stem]) return EMOJI_MAP[stem];
    }
    return '';
  }
  const GENERIC_EMOJI = '🇳🇴📘'; // the old fallback: one and the same «flag + book» picture for every unknown word
  const noFit = msg => Object.assign(new Error(msg), { noFit: true });

  const Images = {
    STYLES, STYLE_NAMES,
    _lastAI: 0,
    lastSource: '',

    async translate(text, pair) {
      // W7: MyMemory is an unofficial free translator — only in the app on the Mac (as Google gtx / Mozhi, js/translators.js);
      // elsewhere the picture is found by the card's own words (no request leaves the device for it)
      const pub = window.NK_CONFIG ? !!NK_CONFIG.publicBuild : !(window.Net && Net.onMac && Net.onMac());
      if (pub) throw Object.assign(new Error('Перевод для поиска картинки есть только в версии для Mac'), { macOnly: true });
      const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text.slice(0, 400)) + '&langpair=' + pair;
      const r = await fetch(url);
      const j = await r.json();
      const t = j && j.responseData && j.responseData.translatedText;
      if (!t || /MYMEMORY WARNING|INVALID/i.test(t)) throw new Error('Перевод недоступен');
      return t;
    },

    /** English meaning of the card (cached on card.en). Words with an article (en bil, å spise) are translated from
     *  Norwegian first — the Russian gloss can be ambiguous («есть» = «to eat» / «is»); notes in brackets are dropped. */
    async english(card) {
      if (card.en) return card.en;
      const m = this.meaning(card);
      let en = '';
      const no = String(card.no || '').split('\n')[0].split(/[,(;/]/)[0].trim();
      const tries = [];
      if (m.article && no) tries.push(() => this.translate(no, 'no|en'));
      if (m.ru) tries.push(() => this.translate(m.ru, 'ru|en'));
      if (!m.article && m.word) tries.push(() => this.translate(m.word, 'no|en'));
      for (const t of tries) {
        try { en = String(await t() || '').replace(/\([^)]*\)/g, ' ').replace(/\s{2,}/g, ' ').trim(); if (en && /[a-z]/i.test(en)) break; en = ''; } catch (e) { en = ''; }
      }
      if (en && card.id && Store.card(card.id)) Store.updateCard(card.id, { en });
      return en;
    },

    isRemoteAI(url) { return /^https?:\/\/(image|gen)\.pollinations\.ai/.test(url || ''); },

    /** what the card means (word, clean Russian gloss, part of speech, person / place / function word…) — see meaningOf */
    meaning(card, ctx) {
      let deckName = ctx && ctx.deckName;
      if (deckName == null) { try { const d = card.deckId && window.Store && Store.state ? Store.deck(card.deckId) : null; deckName = d ? d.name : ''; } catch (e) { deckName = ''; } }
      return meaningOf(card, { deckName });
    },
    /** the plan without a neural network (pure) — exposed for tests and the editor */
    basePlan(card, en, variant, ctx) { return Object.assign(basePlan(this.meaning(card, ctx), en, variant), { key: this.meaning(card, ctx).key }); },
    /** the key of the stored plan / «no picture fits» mark: the word + its meaning + part of speech */
    planKey(card) { return this.meaning(card).key; },

    /**
     * What the picture must show: 'phrase' — several words or a sentence (the meaning of the WHOLE card, not of one
     * word in it), 'abstract' — an abstract noun (a situation that shows the idea), 'word' — one ordinary word
     * (as before: a concrete noun gets its Wikipedia photo). Names, places and function words: see meaning().kind.
     */
    kindOf(card) {
      const k = meaningOf(card).kind;
      return k === 'phrase' || k === 'abstract' ? k : 'word';
    },
    /** English meaning of the whole card (a phrase is translated as a whole, not word by word) — no neural network */
    async meaningEn(card) {
      const no = String(card.no || '').split('\n')[0].replace(/^(en|ei|et|å)\s+/i, '').trim().slice(0, 200);
      const ru = String(card.ru || '').split('\n')[0].replace(/\([^)]*\)/g, ' ').trim().slice(0, 200);
      const tries = [];
      if (window.Translators && Translators.translateMany) {
        if (no) tries.push(() => Translators.translateMany([no], 'no', 'en', { quiet: true, noAI: true }).then(r => r.out[0]));
        if (ru) tries.push(() => Translators.translateMany([ru], 'ru', 'en', { quiet: true, noAI: true }).then(r => r.out[0]));
      }
      if (ru) tries.push(() => this.translate(ru, 'ru|en'));
      for (const t of tries) { try { const en = String(await t() || '').trim(); if (en && /[a-z]/i.test(en)) return en.slice(0, 200); } catch (e) { /* the next one */ } }
      return card.en || '';
    },
    /** the full prompt sent to the picture generator (a scene + the style; never text in the picture) */
    promptFor(plan) {
      const style = STYLES[plan.style] || STYLES[Store.settings.imageStyle] || STYLES.illustration;
      return `${plan.scene}. ${style}, family-friendly, no text, no letters, no watermark`;
    },

    /* ---------- 1. plan ---------- */
    /**
     * { scene, query, emoji, concrete, kind, none, style, key }. Built from the card's OWN meaning (word + Russian
     * gloss + part of speech + description hint, course / deck / chapter names stripped). Stored on the card with
     * imagePlanKey, so an edited word or translation gets a new plan. A picture prompt typed by the user (or written
     * by the AI check) — imagePrompt that differs from the auto one — is always kept.
     */
    async plan(card, force, variant = 0) {
      const m = this.meaning(card);
      const key = m.key;
      const legacyAuto = card.imageEmoji && !card.imagePlanKey; // plans of the old version: prompt + emoji were auto
      const userScene = card.imagePrompt && card.imagePrompt !== card.imageAutoPrompt && !legacyAuto ? String(card.imagePrompt) : '';
      const save = plan => {
        const patch = { imageAutoPrompt: plan.scene || '', imageQuery: plan.query || '', imageEmoji: plan.emoji || '', imageConcrete: !!plan.concrete, imagePlanKey: key };
        if (!userScene) patch.imagePrompt = plan.scene || '';
        if (card.id && window.Store && Store.state && Store.card(card.id)) Store.updateCard(card.id, patch);
        Object.assign(card, patch);
      };
      const finish = plan => Object.assign(plan, { key, kind: plan.kind || m.kind, scene: userScene || plan.scene, none: userScene ? false : !!plan.none });
      // the stored plan is reused only while the card still means the same thing
      if (!force && card.imagePlanKey === key && !legacyAuto) {
        const base = basePlan(m, card.en, variant); // person / place details (emoji portrait, map) are cheap to rebuild
        return finish(Object.assign(base, {
          scene: card.imageAutoPrompt || base.scene, query: card.imageQuery || base.query,
          emoji: m.kind === 'person' ? base.emoji : (card.imageEmoji || base.emoji),
          concrete: base.kind === 'function' ? false : card.imageConcrete == null ? base.concrete : !!card.imageConcrete,
        }, card.imageAutoPrompt ? {} : { kind: 'function', none: true })); // the AI said «no picture helps»
      }
      // names, places and function words: a fixed recipe works better than any guess (no «Viola» → a violin)
      if (m.kind === 'person' || m.kind === 'place' || m.kind === 'function') {
        const en = m.kind === 'place' ? await this.english(card).catch(() => '') : '';
        const plan = basePlan(m, en, variant);
        save(plan);
        return finish(plan);
      }
      const word = String(card.no || '').split('\n')[0].slice(0, 80);
      const posName = { noun: 'noun', verb: 'verb', adj: 'adjective', adv: 'adverb', interj: 'interjection', name: 'proper noun' }[m.pos] || '';
      let system = `You plan pictures for vocabulary flashcards (Norwegian word + Russian meaning). The picture must make the MEANING of THIS word instantly obvious to a learner.
Return ONLY JSON: {"scene":"...","query":"...","emoji":"...","concrete":true|false,"none":false}
- scene: ONE English sentence (max 35 words) describing a concrete everyday visual scene for an image generator. Use people, objects and actions. For abstract words (time, feelings, adverbs, verbs) show a typical situation. Examples: "tomorrow" -> "a bedroom window at sunrise with warm morning light and a calendar on the wall showing the next day"; "late" -> "a man running to catch a bus at night, anxiously looking at his wristwatch"; "thirst" -> "an exhausted hiker in the hot sun greedily drinking a big glass of cold water". No text, letters or numbers in the image. Never draw books, textbooks, flags or the course itself — ignore any textbook, course, deck or chapter names.
- query: 2-4 English words to search a real photo of it (for abstract words, a typical object/scene).
- emoji: 1-3 emoji that together show the meaning (e.g. tomorrow -> "🌅🪟📅", late -> "🏃⏰🌙").
- concrete: true if a real photo would clearly show it (objects, animals, places), false for abstract words.
- none: true only if no picture can help (grammar words such as "og", "men", "fordi").`;
      let user = `Norwegian: ${word}\nRussian: ${m.ru || String(card.ru || '').split('\n')[0].slice(0, 80)}${posName ? '\nPart of speech: ' + posName : ''}${m.note ? '\nNote: ' + m.note : ''}${m.hint ? '\nHint: ' + m.hint : ''}${card.en ? '\nEnglish: ' + card.en : ''}`;
      // a phrase, a sentence, an abstract noun: the scene comes from the meaning of the WHOLE card
      const kind = m.kind;
      if (kind !== 'word') {
        system = `You plan ONE picture for a language flashcard. The card is a ${kind === 'phrase' ? 'Norwegian phrase or sentence' : 'Norwegian abstract noun'}. The picture must show the MEANING OF THE WHOLE CARD, not of any single word in it, so that a learner understands it at a glance.
Return ONLY JSON: {"scene":"...","query":"...","emoji":"...","concrete":false}
- scene: ONE concrete visual scene in English (max 35 words): who, where, doing what. Family-friendly. No text, letters, numbers, signs or speech bubbles in the image. Never draw books, textbooks, flags or the course itself — ignore any textbook, course, deck or chapter names. Examples: «ожидание» (venting) -> "a person waiting at a bus stop in the evening, looking at a wristwatch"; "i dag regner det" -> "a rainy city street with people under umbrellas and puddles reflecting the lights"; "Kan du hjelpe meg?" -> "a tourist holding a map asking a friendly passer-by for help on a sidewalk".
- query: 2-4 English words to search a real photo of that scene.
- emoji: 1-3 emoji that together show the meaning.
- concrete: false.`;
        user = `Card (Norwegian): ${stripCourse(String(card.no || '').split('\n')[0]).slice(0, 200)}\nRussian meaning: ${stripCourse(String(card.ru || '').split('\n')[0]).slice(0, 200)}${m.hint ? '\nHint: ' + m.hint : ''}${card.en ? '\nEnglish: ' + card.en : ''}`;
      }
      // the user's connected AI first (reliable), then Pollinations (works only with its free key)
      const providers = [];
      try {
        if (AI.available() && AI.current() !== 'pollinations') providers.push(AI.current());
        if ((Store.settings.pollinationsToken || '').trim() || AI.cfg('pollinations').key) providers.push('pollinations');
      } catch (e) { /* no AI module */ }
      for (const provider of providers) {
        try {
          const t = await AI.call({ provider, system, user, maxTokens: 260, temperature: force ? 0.8 : 0.4 });
          let p;
          try { p = AI.parseJSON(t); } catch (e) { p = { scene: String(t).split('\n')[0] }; }
          const scene = stripCourse(String(p.scene || '').replace(/^["'\s]+|["'\s]+$/g, '')).slice(0, 300);
          if (p.none === true && kind === 'word') { const plan = { kind: 'function', none: true, scene: '', query: '', emoji: this.emojiFor(card.en), concrete: false }; save(plan); return finish(plan); }
          if (scene.length > 12) {
            const plan = { kind, scene, query: stripCourse(String(p.query || '')).slice(0, 60), emoji: String(p.emoji || '').replace(/🇳🇴📘/gu, '').slice(0, 24), concrete: kind === 'word' && p.concrete !== false };
            if (!plan.emoji) plan.emoji = this.emojiFor(card.en || plan.query);
            save(plan);
            return finish(plan);
          }
        } catch (e) { console.warn('image plan via', provider, e.message); }
      }
      if (kind !== 'word') {
        // no AI: the whole phrase translated to English (translators) + the style suffix (added in promptFor)
        const plan = basePlan(m, await this.meaningEn(card), variant);
        return finish(plan); // not stored: a connected AI later makes a better one
      }
      const plan = basePlan(m, await this.english(card), variant);
      // no AI to judge: real photos only for nouns (en/ei/et …) — "today", "late" etc. get an emoji picture (or none)
      return finish(plan);
    },
    emojiFor(en) { return emojiFor(en); },

    /* ---------- 2. AI picture (Pollinations) ---------- */
    pollinationsUrl(prompt, seed) {
      const tpl = Store.settings.imageTemplate || Store.DEFAULT_SETTINGS.imageTemplate;
      let url = tpl.replace('{prompt}', encodeURIComponent(prompt)).replace('{seed}', String(seed));
      const tok = (Store.settings.pollinationsToken || '').trim();
      // query params only: Pollinations' CORS does not allow an Authorization header from the browser
      if (tok) url += (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(tok) + '&key=' + encodeURIComponent(tok);
      return url;
    },
    aiWaitMs() {
      const gap = (Store.settings.pollinationsToken || '').trim() ? 1500 : 47000;
      return Math.max(0, this._lastAI + gap - Date.now());
    },
    async aiImage(card, plan, opts = {}) {
      // anonymous Pollinations requests are now rejected (403 "Missing Turnstile token") — a free key is required
      if (!(Store.settings.pollinationsToken || '').trim() && /pollinations\.ai/.test(Store.settings.imageTemplate || '')) {
        throw new Error('Для ИИ-рисунков нужен бесплатный ключ Pollinations');
      }
      let w = this.aiWaitMs();
      if (w > 0) {
        if (!opts.wait) throw new Error(`Лимит бесплатных ИИ-картинок: следующая через ${Math.ceil(w / 1000)} с`);
        await U.sleep(w);
      }
      this._lastAI = Date.now();
      this.lastPrompt = this.promptFor(plan);
      const url = this.pollinationsUrl(this.lastPrompt, opts.seed != null ? opts.seed : Math.floor(Math.random() * 1e6));
      let res;
      try { res = await fetch(url); } catch (e) { throw new Error('Сервис ИИ-картинок недоступен'); }
      if (!res.ok) { this._lastAI = Date.now(); throw new Error(res.status === 429 || res.status === 402 ? 'Лимит бесплатных ИИ-картинок' : 'ИИ-картинка: ошибка ' + res.status); }
      const blob = await res.blob();
      if (!/^image\//.test(blob.type || res.headers.get('content-type') || '') || blob.size < 6000) throw new Error('ИИ-картинка не получена');
      return U.compressImage(blob, 560, 0.8);
    },

    /* ---------- 3. real photo (free licences; the credit is kept on the card: imageCredit / imageCreditUrl) ---------- */
    _credit(md, fallback) {
      const strip = h => String(h || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const who = strip((md && md.Artist || {}).value) || fallback || 'Wikimedia Commons';
      const lic = strip((md && md.LicenseShortName || {}).value);
      return [who.slice(0, 80), lic, 'Wikimedia Commons'].filter((x, i, a) => x && a.indexOf(x) === i).join(' · ');
    },
    async commonsSearch(q, variant = 0) {
      const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=12' +
        '&gsrsearch=' + encodeURIComponent(q + ' filetype:bitmap') + '&prop=imageinfo&iiprop=url|mime|extmetadata&iiextmetadatafilter=Artist|LicenseShortName&iiurlwidth=500'; // Wikimedia accepts only standard thumbnail widths
      const j = await (await fetch(url)).json();
      const pages = Object.values((j.query && j.query.pages) || {}).sort((a, b) => a.index - b.index)
        .filter(p => p.imageinfo && /image\/(jpeg|png|webp)/.test(p.imageinfo[0].mime));
      if (!pages.length) throw new Error('Фото не найдено');
      const ii = pages[variant % pages.length].imageinfo[0];
      return { src: ii.thumburl || ii.url, credit: this._credit(ii.extmetadata), page: ii.descriptionurl || '' };
    },
    async wikimediaUrl(q, variant = 0) { return (await this.commonsSearch(q, variant)).src; },
    /** main picture of a Wikipedia article ("Bil" -> a car photo) */
    async wikiPageImage(lang, title) {
      const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&prop=pageimages&piprop=thumbnail&pithumbsize=500&redirects=1&titles=${encodeURIComponent(title)}`;
      const j = await (await fetch(url)).json();
      const p = Object.values((j.query && j.query.pages) || {})[0];
      const src = p && p.thumbnail && p.thumbnail.source;
      if (src && !/\.svg/i.test(src)) { this._photoCredit = { credit: `Wikipedia · ${p.title}`, page: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(p.title)}` }; return src; }
      return null;
    },
    /**
     * "Draw another one": the OTHER photos inside the same Wikipedia article ("Car" has dozens of different cars).
     * (A search for related articles was tried — "car" also found "Central African Republic", so not used.)
     */
    _related: {},
    async wikiRelatedImages(lang, title) {
      const key = lang + ':' + title.toLowerCase();
      if (this._related[key]) return this._related[key];
      const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&titles=${encodeURIComponent(title)}` +
        `&generator=images&gimlimit=50&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiextmetadatafilter=Artist|LicenseShortName&iiurlwidth=500`;
      const j = await (await fetch(url)).json();
      const BAD = /\b(sex|mating|nude|naked|porn|erotic|corpse|dead|blood|autopsy|map|logo|flag|diagram|chart)\b/i;
      const seen = new Set();
      this._related[key] = Object.values((j.query && j.query.pages) || {})
        .filter(p => !BAD.test(p.title || ''))
        .map(p => p.imageinfo && p.imageinfo[0]).filter(ii => ii && ii.mime === 'image/jpeg' && (ii.width || 0) >= 400)
        .map(ii => ({ src: ii.thumburl || ii.url, credit: this._credit(ii.extmetadata), page: ii.descriptionurl || '' }))
        .filter(x => !seen.has(x.src) && seen.add(x.src));
      return this._related[key];
    },
    /**
     * A place (Norge, Bergen, Italia): its pictures on Wikidata — the locator map for a country, a photo of the place
     * (a landmark) for a town — all files on Wikimedia Commons with their author and licence. Only items with
     * coordinates count (and never a person), so «Viola» can't turn into anything here.
     */
    _places: {},
    async placeFiles(m) {
      const k = low(m.word) + '|' + low(m.ru);
      if (this._places[k]) return this._places[k];
      const api = 'https://www.wikidata.org/w/api.php?format=json&origin=*';
      // the search hits carry a short English description: «country in Northern Europe», «female given name»…
      const NOT = /(given name|family name|surname|human|person|disambiguation|album|film|song|band|genus|species|instrument|novel|magazine|ship|company)/i;
      const YES = /(country|city|town|municipalit|capital|village|island|region|county|state|kingdom|republic|fjord|mountain|lake|river|continent|archipelago|settlement|place|district|province)/i;
      let hits = [];
      for (const [lang, q] of [['nb', m.word], ['ru', m.ru]]) {
        if (!q || hits.length) continue;
        try {
          const s = await (await fetch(`${api}&action=wbsearchentities&type=item&limit=7&language=${lang}&uselang=en&search=${encodeURIComponent(q)}`)).json();
          hits = (s.search || []).filter(x => x.id && !NOT.test(x.description || ''));
        } catch (e) { /* next language */ }
      }
      const hit = hits.find(x => YES.test(x.description || '')) || hits[0];
      if (!hit) throw new Error('Место не найдено');
      // only the few properties needed (a country's full record is megabytes)
      const claim = async p => {
        try {
          const j = await (await fetch(`${api}&action=wbgetclaims&entity=${hit.id}&property=${p}`)).json();
          return ((j.claims || {})[p] || []).map(c => c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value).filter(Boolean);
        } catch (e) { return []; }
      };
      const [P31, P625, P297, P242, P1943, P18, P8592] = await Promise.all(['P31', 'P625', 'P297', 'P242', 'P1943', 'P18', 'P8592'].map(claim));
      if (P31.some(v => v && v.id === 'Q5')) throw new Error('Это человек, а не место');
      if (!P625.length && !P242.length && !P1943.length) throw new Error('Место не найдено');
      const country = !!P297.length || /country|kingdom|republic/i.test(hit.description || '') || m.country;
      const files = [...new Set((country ? [P242, P1943, P18, P8592] : [P18, P8592, P242, P1943]).flat().filter(f => typeof f === 'string'))].slice(0, 6);
      this._places[k] = { files, en: hit.label || '', country, id: hit.id };
      return this._places[k];
    },
    async commonsFile(file) {
      const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&prop=imageinfo&iiprop=url|mime|extmetadata' +
        '&iiextmetadatafilter=Artist|LicenseShortName&iiurlwidth=500&titles=' + encodeURIComponent('File:' + file);
      const j = await (await fetch(url)).json();
      const p = Object.values((j.query && j.query.pages) || {})[0];
      const ii = p && p.imageinfo && p.imageinfo[0];
      if (!ii || !(ii.thumburl || ii.url)) throw new Error('Файл не найден');
      return { src: ii.thumburl || ii.url, credit: this._credit(ii.extmetadata), page: ii.descriptionurl || '' };
    },
    async placePhoto(card, plan, variant = 0) {
      const m = this.meaning(card);
      const toData = async pic => { this._photoCredit = { credit: pic.credit, page: pic.page }; try { return await U.compressImage(pic.src, 560, 0.84); } catch (e) { return pic.src; } };
      let info = null;
      try { info = await this.placeFiles(m); } catch (e) { /* only the search below */ }
      const files = info ? info.files : [];
      if (files.length) {
        for (let k = 0; k < files.length; k++) {
          try { return await toData(await this.commonsFile(files[(variant + k) % files.length])); } catch (e) { /* the next file */ }
        }
      }
      // a free search only when it surely is a place (a known country / town, «город», «страна» in the note)
      if (!info && !(m.iso || PLACES.has(low(m.word)) || PLACE_RU.test(m.note))) throw noFit('Подходящей картинки не нашлось');
      const name = (info && info.en) || m.word;
      return toData(await this.commonsSearch(`"${name}" ${plan.country || (info && info.country) ? 'map' : 'landmark'}`, Math.max(0, variant - files.length)));
    },
    /**
     * Real photo. Free-text search on Commons matched "car" to the Carina nebula, so first take the
     * main photo of the Wikipedia article: Norwegian word on no.wikipedia, then English on en.wikipedia.
     */
    async photo(card, plan, variant = 0) {
      this._photoCredit = null;
      if (plan.kind === 'place') return this.placePhoto(card, plan, variant);
      if (plan.kind === 'person' || plan.kind === 'function') throw noFit('Для этого слова фото не подходит');
      const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
      const noWord = this.meaning(card).word;
      const en = String(card.en || (plan.query && plan.query.split(' ').length <= 3 ? plan.query : '') || await this.english(card) || '').replace(/\([^)]*\)/g, ' ').replace(/^(a|an|the|to)\s+/i, '').trim();
      if (variant === 0) {
        const tries = [];
        if (noWord && noWord.split(/\s+/).length <= 3) tries.push(['no', cap(noWord)]);
        if (en) tries.push(['en', cap(en)]);
        for (const [lang, title] of tries) {
          try {
            const u = await this.wikiPageImage(lang, title);
            if (u) { try { return await U.compressImage(u, 560, 0.84); } catch (e) { return u; } }
          } catch (e) { /* next */ }
        }
      }
      // "draw another one": photos from related articles (another car, another cat…)
      if (variant > 0) {
        // photos from the Norwegian AND the English article together (no "Bil" has 1 photo, en "Car" has dozens)
        let list = [];
        for (const [lang, q] of [['no', noWord], ['en', en]]) {
          if (!q || q.split(/\s+/).length > 3) continue;
          try { list = list.concat(await this.wikiRelatedImages(lang, cap(q))); } catch (e) { /* next */ }
        }
        list = list.filter((x, i) => list.findIndex(y => y.src === x.src) === i);
        if (list.length) {
          const pic = list[variant % list.length]; // index 0 is usually the main photo already on the card
          this._photoCredit = { credit: pic.credit, page: pic.page };
          try { return await U.compressImage(pic.src, 560, 0.84); } catch (e) { return pic.src; }
        }
      }
      const q = plan.query || en || noWord;
      if (!q) throw new Error('Нет запроса для фото');
      const pic = await this.commonsSearch(`"${q}"`, variant);
      this._photoCredit = { credit: pic.credit, page: pic.page };
      try { return await U.compressImage(pic.src, 560, 0.82); } catch (e) { return pic.src; }
    },
    /** kept for compatibility */
    async wikimedia(card, variant = 0) { return this.photo(card, await this.plan(card), variant); },

    /* ---------- 4. emoji picture (local, always works) ---------- */
    emojiImage(emoji, seedText) {
      const W = 640, H = 480;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      let h = 0; for (const ch of String(seedText || emoji)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
      const palettes = [['#ffecd2', '#fcb69f'], ['#a1c4fd', '#c2e9fb'], ['#d4fc79', '#96e6a1'], ['#fbc2eb', '#a6c1ee'], ['#fddb92', '#d1fdff'],
        ['#e0c3fc', '#8ec5fc'], ['#f6d365', '#fda085'], ['#cfd9df', '#e2ebf0'], ['#a8edea', '#fed6e3'], ['#ffe29f', '#ffa99f']];
      const [a, b] = palettes[h % palettes.length];
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, a); g.addColorStop(1, b);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 0.18; ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc((h >>> i) % W, (h >>> (i + 3)) % H, 40 + ((h >>> i) % 90), 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
      const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(emoji)].map(s => s.segment) : Array.from(emoji);
      const list = seg.filter(s => s.trim()).slice(0, 3);
      if (!list.length) list.push('🖼️');
      const font = s => `${s}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10;
      if (list.length === 1) { ctx.font = font(250); ctx.fillText(list[0], W / 2, H / 2 + 10); }
      else if (list.length === 2) { ctx.font = font(190); ctx.fillText(list[0], W * 0.31, H / 2 + 8); ctx.fillText(list[1], W * 0.69, H / 2 + 8); }
      else { ctx.font = font(200); ctx.fillText(list[0], W / 2, H * 0.44); ctx.font = font(120); ctx.fillText(list[1], W * 0.2, H * 0.72); ctx.fillText(list[2], W * 0.8, H * 0.72); }
      return c.toDataURL('image/jpeg', 0.88);
    },

    /* ---------- pipeline ---------- */
    /**
     * returns a data URL (or, rarely, a photo URL). opts: provider, seed, variant, wait, newScene.
     * Names → a portrait (AI or a gendered emoji portrait), places → a map / landmark from Wikimedia, function words →
     * no picture. When nothing fits, the error has noFit: true — the card simply stays without a picture
     * (never one and the same generic «flag + book»).
     */
    async generate(card, opts = {}) {
      const provider = opts.provider || Store.settings.imageProvider;
      if (provider === 'off') throw new Error('Генерация картинок выключена в настройках');
      const variant = opts.variant || 0;
      const plan = await this.plan(card, opts.newScene, variant);
      this.lastPlan = plan; this.lastCredit = ''; this.lastCreditUrl = '';
      const k = plan.kind;
      const steps = plan.none ? ['emoji']
        : provider === 'emoji' ? ['emoji']
          : provider === 'wikimedia' ? (k === 'person' ? ['emoji'] : ['photo', 'emoji'])
            : k === 'place' ? ['photo', 'ai', 'emoji']
              : k === 'person' ? ['ai', 'emoji']
                : ['ai', plan.concrete ? 'photo' : null, 'emoji'];
      let lastErr = null, temporary = false;
      for (const step of steps.filter(Boolean)) {
        try {
          let img;
          if (step === 'ai') img = await this.aiImage(card, plan, opts);
          else if (step === 'photo') img = await this.photo(card, plan, variant);
          else {
            const emo = String(plan.emoji || '').replace(GENERIC_EMOJI, '');
            if (!emo) throw noFit(k === 'function' ? `Для служебного слова «${this.meaning(card).word}» картинка не нужна — его лучше запомнить по примеру` : `Подходящей картинки для «${this.meaning(card).word || card.no}» не нашлось`);
            img = this.emojiImage(emo, card.no + (variant ? '#' + variant : ''));
          }
          this.lastSource = step;
          if (step === 'photo' && this._photoCredit) { this.lastCredit = this._photoCredit.credit || ''; this.lastCreditUrl = this._photoCredit.page || ''; }
          return img;
        } catch (e) {
          lastErr = e;
          // a network failure or the free AI limit: try again later; no key / nothing found: it really does not fit
          if (!e.noFit && (e.name === 'TypeError' || /Лимит|недоступен|ошибка \d|не получена|Таймаут/i.test(e.message || ''))) temporary = true;
          if (!e.noFit) console.warn('image step', step, e.message);
        }
      }
      if (lastErr && lastErr.noFit && temporary) lastErr.noFit = false;
      throw lastErr || new Error('Картинка не получилась');
    },

    /** what was stored with a new picture: where it came from and its credit (photos from Wikimedia / Wikipedia) */
    _patch(img) {
      return { image: img, imageAuto: true, imageSrc: this.lastSource || '', imageCredit: this.lastCredit || '', imageCreditUrl: this.lastCreditUrl || '', imageNone: '' };
    },
    /** «no picture fits this card» is remembered for the card's meaning + the picture settings of that moment */
    noneKey(card) {
      let ai = '';
      try { ai = AI.available() ? AI.current() : ''; } catch (e) { /* no AI module */ }
      return [this.planKey(card), Store.settings.imageProvider || '', (Store.settings.pollinationsToken || '').trim() ? 'key' : '', ai].join('|');
    },
    /** true → the card has no picture on purpose (a function word, nothing fits): show none, don't try again */
    skip(card) { return !!(card && !card.image && card.imageNone && card.imageNone === this.noneKey(card)); },

    /** make sure the card has a stored picture (also replaces old remote AI links that may show "limit reached") */
    async ensure(card, opts = {}) {
      if (Store.settings.imageProvider === 'off') return card.image;
      if (card.image && !this.isRemoteAI(card.image)) return card.image;
      if (!opts.force && this.skip(card)) throw noFit('Для этой карточки картинка не нужна');
      let img;
      try { img = await this.generate(card, opts); } catch (e) {
        if (e.noFit) {
          const patch = { imageNone: this.noneKey(card) };
          if (card.image) Object.assign(patch, { image: '', imageCredit: '', imageCreditUrl: '' });
          if (card.id && Store.card(card.id)) Store.updateCard(card.id, patch);
          Object.assign(card, patch);
        }
        throw e;
      }
      const patch = this._patch(img);
      if (card.id && Store.card(card.id)) Store.updateCard(card.id, patch);
      Object.assign(card, patch);
      return img;
    },

    /** throw away the current picture and draw a new one (by the card's meaning; the old one stays if nothing fits) */
    async redraw(card, opts = {}) {
      const fresh = Store.card(card.id) || card;
      const img = await this.generate(fresh, Object.assign({ seed: Math.floor(Math.random() * 1e6) }, opts));
      const patch = this._patch(img);
      if (Store.card(fresh.id)) Store.updateCard(fresh.id, patch);
      Object.assign(fresh, patch);
      if (card !== fresh) Object.assign(card, patch);
      return img;
    },

    /** batch: wait=true -> respect the free AI limit (slow, real AI pictures); otherwise photo/emoji when limited */
    async batch(cards, onProgress, opts = {}) {
      let done = 0, ok = 0, i = 0;
      const worker = async () => {
        while (i < cards.length) {
          const c = cards[i++];
          try {
            if (opts.redraw) await this.redraw(c, opts); else await this.ensure(c, opts);
            ok++;
          } catch (e) { if (!e.noFit) console.warn(e); }
          done++; onProgress && onProgress(done, cards.length);
        }
      };
      await Promise.all(Array.from({ length: Math.min(opts.wait ? 1 : 3, cards.length) }, worker));
      return ok;
    },

    /* ---------- old auto pictures: the generic «flag + book» and pictures shared by different words ---------- */
    /** the old emoji picture «🇳🇴📘» (640×480, flag on the left, blue book on the right)? — exact copy or by its colours */
    async looksGeneric(card) {
      const src = card.image || '';
      if (!/^data:image\/jpeg/.test(src)) return false;
      const img = new Image();
      img.src = src;
      try { await img.decode(); } catch (e) { return false; }
      if (img.naturalWidth !== 640 || img.naturalHeight !== 480) return false; // only the emoji pictures have this size
      if (card.imageEmoji === GENERIC_EMOJI) return true;
      try { if (this.emojiImage(GENERIC_EMOJI, card.no) === src) return true; } catch (e) { /* by colours */ }
      const W = 64, H = 48, c = document.createElement('canvas'); c.width = W; c.height = H;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, W, H);
      const d = ctx.getImageData(0, 0, W, H).data;
      const box = (x0, x1, test) => {
        let n = 0, hit = 0;
        for (let y = Math.round(H * 0.28); y < Math.round(H * 0.74); y++) for (let x = Math.round(W * x0); x < Math.round(W * x1); x++) {
          const i = (y * W + x) * 4; n++; if (test(d[i], d[i + 1], d[i + 2])) hit++;
        }
        return hit / n;
      };
      // measured on the Apple emoji: flag red ≈ (200,40,40)–(240,80,80) ~17 % of the left box, book blue ≈ (40,120,200) ~26 % of the right one
      const red = (r, g, b) => r > 150 && g < 110 && b < 110 && r - g > 90;
      const blue = (r, g, b) => b > 140 && r < 110 && g < 170 && b - r > 70;
      return box(0.15, 0.47, red) > 0.08 && box(0.53, 0.85, blue) > 0.15 && box(0.53, 0.85, red) < 0.04 && box(0.15, 0.47, blue) < 0.08;
    },
    /**
     * Once: auto pictures (imageAuto, made before this version — no imageSrc) that are the generic «flag + book», one
     * and the same picture on cards with different words, or any old auto picture of a person's name / function word, are removed — the card draws a new one by its meaning the
     * next time it is shown. Pictures the user chose (uploaded, linked, imported) are never touched.
     */
    async scanLegacy(force) {
      if (typeof document === 'undefined' || !window.Store || !Store.state || !Array.isArray(Store.state.cards)) return 0;
      if (!force && Store.state.imgGenericV1) return 0;
      if (this._scanning) return 0;
      this._scanning = true;
      try {
        const old = Store.state.cards.filter(c => c && c.imageAuto === true && c.image && !c.imageSrc);
        const bad = new Set();
        const byImg = new Map();
        old.forEach(c => { const l = byImg.get(c.image) || []; l.push(c); byImg.set(c.image, l); });
        byImg.forEach(list => { if (new Set(list.map(c => low(String(c.no || '').split('\n')[0]))).size >= 2) list.forEach(c => bad.add(c.id)); });
        // a person's name or a function word: the old pipeline had no recipe for them (Wikipedia «Viola» = a violin) —
        // a portrait / no picture now
        old.forEach(c => { const k = meaningOf(c).kind; if (k === 'person' || k === 'function') bad.add(c.id); });
        let n = 0;
        for (const c of old) {
          if (bad.has(c.id)) continue;
          if (await this.looksGeneric(c)) bad.add(c.id);
          if (++n % 15 === 0) await new Promise(r => setTimeout(r, 0)); // the app stays responsive
        }
        let cleared = 0;
        bad.forEach(id => {
          const c = Store.card(id);
          if (!c || c.imageAuto !== true) return;
          Object.assign(c, { image: '', imageCredit: '', imageCreditUrl: '', imagePlanKey: '', imageNone: '', updated: Date.now() });
          if (c.imageEmoji === GENERIC_EMOJI) c.imageEmoji = '';
          cleared++;
        });
        Store.state.imgGenericV1 = Date.now();
        Store.save();
        if (cleared) console.info(`🎨 Images: ${cleared} old generic picture(s) removed — new ones are drawn by meaning when the cards are shown`);
        return cleared;
      } finally { this._scanning = false; }
    },
    /** free AI limit applies? */
    limited() { return Store.settings.imageProvider === 'pollinations' && !(Store.settings.pollinationsToken || '').trim(); },

    /** old API used by the editor */
    async preload(url, timeout = 20000) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const t = setTimeout(() => { img.src = ''; reject(new Error('Таймаут загрузки картинки')); }, timeout);
        img.onload = () => { clearTimeout(t); resolve(url); };
        img.onerror = () => { clearTimeout(t); reject(new Error('Картинка не загрузилась')); };
        img.src = url;
      });
    },
  };

  window.Images = Images;

  // after the app has loaded the cards: the one-time clean-up of the old generic pictures (in the background)
  if (typeof document !== 'undefined' && typeof setInterval === 'function') {
    let tries = 0;
    const t = setInterval(() => {
      if (++tries > 60) { clearInterval(t); return; }
      if (!(window.Store && Store.state && Array.isArray(Store.state.cards))) return;
      clearInterval(t);
      setTimeout(() => { Images.scanLegacy().catch(e => console.warn('image scan', e)); }, 2500);
    }, 1000);
  }
})();
