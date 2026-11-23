/* ============ Voices: one voice per language (no / uk / ru), free first, then Pro, then services with your own key ============
 * Engines: the device's voices (speechSynthesis) · Piper (offline, on the device) · Norsk Kort Pro ('nk': Google Cloud TTS on
 *          the Norsk Kort server, POST tts — Pro only, cached clips) · Azure Speech · Google Cloud TTS · Gemini TTS ·
 *          ElevenLabs (your own key, straight from the device) · and only on the owner's Mac: Microsoft Edge (bridge) and
 *          the unofficial Google Translate voice ('gtr').
 * Where (docs/release-architecture.md §1.3, §3.2, §3.4):
 *   · public build (the site, the store apps, every phone): no bridge voices, no 'gtr' — hidden with one calm line;
 *     Piper voices without a commercial-OK licence are hidden too. «Авто» = a good device voice → Norsk Kort Pro (Pro +
 *     AI consent given) → your own keys → downloaded Piper voices → a weak device voice (a Pro user with a poor device
 *     voice hears Pro first).
 *   · the Mac with the bridge (Net.isMacBridge()): Edge → own keys → Pro → device / Piper → Google Translate (as before).
 *   · a free user never makes a paid call: 'nk' is available only when Pro.isActive(); Net.callFn('tts') asks the AI
 *     consent by itself; the auto chain uses 'nk' only once the consent was given.
 * Limits (Limits): 75 % — a quiet line in «Голоса», 90 % — one toast, 100 % — one friendly window per engine and month
 *   (waits for a pause in playback); the fallback chain switches at once and keeps the voice's gender when it can.
 * Model: Store.settings.voices = { no: { pick: 'nk:nb-NO-Wavenet-F', chain: 'auto' | [ids] }, uk: …, ru: …, _v: 1 }
 *   voice id = 'engine:key' ('piper:no_NO-nvcc-medium#KNN' = model + speaker; 'sys:Милена'; 'gtr:ru'); pick '' = «Авто»
 *   (the best voice that works here right now, see recommend()).
 * Speaking: TTS._utter1 → Voices.speak(): the chosen voice, then the fallback chain of the same language — a voice that
 *   fails or is silent for ~4 s is replaced by the next one quietly (one calm line, once per session). A Ukrainian
 *   text is never read by a Russian voice.
 * Cloud audio is kept on the device (Cache API «norsk-kort-tts-clips», ≤ 60 МБ, oldest out first), so a card is
 *   synthesised once — not again after every start. Keys stay sealed on the device (Store).
 * The «Голоса» window itself is js/voicepicker.js + css/voicepicker.css, loaded on first use: Voices.openChooser(lang).
 * Icons: drawn line icons only (Voices.icon(name) → NavIcons.icon, or the same family drawn here) — never emoji.
 * Places: every place that speaks (cards, reader, listen, dialogues, video, news, interpreter, pronunciation, Telegram)
 *   may have its own voice per language — Store.settings.voicesBy = { reader: { no: 'piper:…', ru: 'nk:…' }, … }; a
 *   language without an entry reads «как везде» (Store.settings.voices). The place comes with the call
 *   (TTS.speak(text, lang, { place: 'reader' }), ctx is an alias) or is read from the screen: Voices.place().
 *   Its voice is tried first, then the voice «как везде», then the language's fallback chain.
 */
(function () {
  const F = '♀', M = '♂';
  const MB = 1048576;
  /** the app runs on the owner's Mac (file / localhost, never the store apps) — js/net.js is the one answer */
  const onMac = () => (window.Net && Net.onMac ? Net.onMac() : location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/.test(location.hostname));
  /** …and the bridge answered: the ONLY case for /api/* paths (Edge voices, install, restart) */
  const macBridge = () => (window.Net && Net.isMacBridge ? Net.isMacBridge() : onMac() && !!(window.AI && AI.bridge && AI.bridge.up));
  /** the site / store apps / phones: no bridge voices, no unofficial Google voice (NK_CONFIG.publicBuild, js/config.js) */
  const publicBuild = () => !(window.NK_CONFIG && NK_CONFIG.publicBuild === false);
  const online = () => navigator.onLine !== false;
  const LANGS = ['no', 'uk', 'ru'];
  const LANG_NAME = { no: 'Норвежский', uk: 'Украинский', ru: 'Русский' };
  const FLAG = { no: '🇳🇴', uk: '🇺🇦', ru: '🇷🇺' };  // kept for old callers; the UI draws Voices.langMark(l) instead
  const LC = { no: 'NO', uk: 'UA', ru: 'RU' };
  const LOC = { no: 'nb-NO', uk: 'uk-UA', ru: 'ru-RU' };
  const SAMPLE = {
    no: 'Hei! I dag lærer vi tjue nye ord på norsk.',
    uk: 'Привіт! Сьогодні ми вивчимо двадцять нових норвезьких слів.',
    ru: 'Привет! Сегодня мы выучим двадцать новых норвежских слов.',
  };
  const QUALITY = { 5: 'Как живой', 4: 'Хороший', 3: 'Нормальный', 2: 'Как робот' };
  /** Google's 30 star-named voices — Chirp 3 HD in Google Cloud and the prebuilt voices of Gemini TTS are the same set.
   *  Gender: docs.cloud.google.com/text-to-speech/docs/chirp3-hd; character: ai.google.dev (speech generation), in Russian.
   *  The owner's favourites (naturalreaders.com) come first. */
  const STARS = [
    ['Umbriel', M, 'спокойный'], ['Despina', F, 'бархатный'], ['Sulafat', F, 'тёплый'], ['Algenib', M, 'с хрипотцой'], ['Iapetus', M, 'чёткий'],
    ['Callirrhoe', F, 'спокойный'], ['Kore', F, 'уверенный'], ['Charon', M, 'обстоятельный'], ['Aoede', F, 'лёгкий'], ['Puck', M, 'бодрый'],
    ['Leda', F, 'молодой'], ['Fenrir', M, 'энергичный'], ['Zephyr', F, 'светлый'], ['Orus', M, 'уверенный'], ['Achernar', F, 'мягкий'],
    ['Achird', M, 'дружелюбный'], ['Algieba', M, 'мягкий'], ['Alnilam', M, 'твёрдый'], ['Autonoe', F, 'звонкий'], ['Enceladus', M, 'с придыханием'],
    ['Erinome', F, 'ясный'], ['Gacrux', F, 'зрелый'], ['Laomedeia', F, 'бодрый'], ['Pulcherrima', F, 'открытый'], ['Rasalgethi', M, 'обстоятельный'],
    ['Sadachbia', M, 'живой'], ['Sadaltager', M, 'знающий'], ['Schedar', M, 'ровный'], ['Vindemiatrix', F, 'нежный'], ['Zubenelgenubi', M, 'непринуждённый'],
  ];
  const STAR = {};
  STARS.forEach(([n, g, c]) => { STAR[n] = { g, c }; });
  /** Chirp 3 HD in Russian: only these 8 (Google's voice list, Nov 2026); Norwegian and Ukrainian have all 30 */
  const CHIRP_RU = ['Kore', 'Aoede', 'Leda', 'Zephyr', 'Charon', 'Puck', 'Fenrir', 'Orus'];
  const chirpOf = (loc, names) => STARS.filter(([n]) => !names || names.includes(n)).map(([n, g]) => [loc + '-Chirp3-HD-' + n, n, g]);
  const G_VOICES = {
    no: chirpOf('nb-NO').concat([['nb-NO-Wavenet-F', 'WaveNet F', F], ['nb-NO-Wavenet-G', 'WaveNet G', M], ['nb-NO-Standard-F', 'Standard F', F], ['nb-NO-Standard-G', 'Standard G', M]]),
    // uk-UA has only the «-B» WaveNet / Standard voices now (the «-A» ones are gone)
    uk: chirpOf('uk-UA').concat([['uk-UA-Wavenet-B', 'WaveNet B', F], ['uk-UA-Standard-B', 'Standard B', F]]),
    ru: chirpOf('ru-RU', CHIRP_RU).concat(['A', 'B', 'C', 'D', 'E'].map(x => ['ru-RU-Wavenet-' + x, 'WaveNet ' + x, /[BD]/.test(x) ? M : F]))
      .concat(['A', 'B', 'C', 'D', 'E'].map(x => ['ru-RU-Standard-' + x, 'Standard ' + x, /[BD]/.test(x) ? M : F])),
  };
  const G_OLD = { 'uk-UA-Wavenet-A': 'uk-UA-Wavenet-B', 'uk-UA-Standard-A': 'uk-UA-Standard-B' };
  /** Gemini TTS: Norwegian Bokmål and Russian — Ukrainian is not in Google's list of its languages */
  const GEM_VOICES = { no: STARS.map(([n, g]) => [n, n, g]), ru: STARS.map(([n, g]) => [n, n, g]), uk: [] };
  const MS_VOICES = {
    no: [['nb-NO-PernilleNeural', 'Pernille', F], ['nb-NO-IselinNeural', 'Iselin', F], ['nb-NO-FinnNeural', 'Finn', M]],
    ru: [['ru-RU-SvetlanaNeural', 'Светлана', F], ['ru-RU-DariyaNeural', 'Дарья', F], ['ru-RU-DmitryNeural', 'Дмитрий', M]],
    uk: [['uk-UA-PolinaNeural', 'Поліна', F], ['uk-UA-OstapNeural', 'Остап', M]],
  };
  /** the free Edge «read aloud» service has only these (edge-tts list_voices): Iselin and Дарья exist only in Azure (with a key) */
  const EDGE_ONLY_AZURE = { 'nb-NO-IselinNeural': 'nb-NO-PernilleNeural', 'ru-RU-DariyaNeural': 'ru-RU-SvetlanaNeural' };
  const EDGE_VOICES = { no: MS_VOICES.no.filter(v => !EDGE_ONLY_AZURE[v[0]]), ru: MS_VOICES.ru.filter(v => !EDGE_ONLY_AZURE[v[0]]), uk: MS_VOICES.uk };
  /** the Microsoft voice the app suggests first (plan: Finn for Norwegian, Svetlana, Polina) */
  const MS_DEFAULT = { no: 'nb-NO-FinnNeural', ru: 'ru-RU-SvetlanaNeural', uk: 'uk-UA-PolinaNeural' };
  /** Norsk Kort Pro: Google Cloud TTS on our server (docs/api-contract.md «POST tts» allow-list). WaveNet always;
   *  Chirp 3 HD only while the server says health.providers.tts_premium = 'chirp3-hd' (owner decision O-5) */
  const NK_HD = ['Kore', 'Aoede', 'Charon', 'Puck'];
  const nkHd = loc => NK_HD.map(n => [loc + '-Chirp3-HD-' + n, n, STAR[n].g]);
  const NK_VOICES = {
    no: [['nb-NO-Wavenet-F', 'Женский голос', F], ['nb-NO-Wavenet-G', 'Мужской голос', M]].concat(nkHd('nb-NO')),
    uk: [['uk-UA-Wavenet-B', 'Женский голос', F]].concat(nkHd('uk-UA')),
    ru: [['ru-RU-Wavenet-A', 'Женский голос', F], ['ru-RU-Wavenet-B', 'Мужской голос', M], ['ru-RU-Wavenet-E', 'Женский голос 2', F], ['ru-RU-Wavenet-D', 'Мужской голос 2', M]].concat(nkHd('ru-RU')),
  };
  const isHd = key => /-Chirp3-HD-/.test(String(key || ''));
  const ENGINES = {
    system: { name: 'Голоса устройства', short: 'Голос устройства', icon: 'phone', free: true },
    sys: { name: 'Голоса устройства', short: 'Голос устройства', icon: 'phone', free: true, hue: 262 },
    nk: { name: 'Голоса Norsk Kort Pro', short: 'Norsk Kort Pro', icon: 'crown', pro: true, hue: 268, voices: NK_VOICES },
    gtr: { name: 'Google Переводчик', short: 'Google Переводчик', icon: 'globe', free: true, hue: 145 },
    google: { name: 'Google Переводчик', short: 'Google Переводчик', icon: 'globe', free: true },
    piper: { name: 'Piper — офлайн-голоса', short: 'Piper · на устройстве', icon: 'cloud-off', free: true, offline: true, hue: 28 },
    edge: {
      name: 'Microsoft Edge — нейроголоса', short: 'Microsoft Edge', icon: 'laptop', free: true, bridge: true, hue: 200,
      voices: EDGE_VOICES,
    },
    azure: {
      name: 'Microsoft Azure Speech', short: 'Microsoft Azure', icon: 'key', hue: 214,
      keyUrl: 'https://portal.azure.com/#create/Microsoft.CognitiveServicesSpeechServices',
      voices: MS_VOICES, freeChars: 500000,
    },
    gcloud: {
      name: 'Google Cloud Text-to-Speech', short: 'Google Cloud', icon: 'key', hue: 120,
      keyUrl: 'https://console.cloud.google.com/apis/library/texttospeech.googleapis.com',
      voices: G_VOICES, freeChars: 1000000,
    },
    gemini: {
      name: 'Google Gemini — ключ AI Studio', short: 'Gemini', icon: 'key', hue: 330, perDay: true,
      keyUrl: 'https://aistudio.google.com/apikey',
      voices: GEM_VOICES,
    },
    eleven: {
      name: 'ElevenLabs', short: 'ElevenLabs', icon: 'key', hue: 290,
      keyUrl: 'https://elevenlabs.io/app/settings/api-keys',
      // premade voices usable on free accounts (ElevenLabs may retire them — «Загрузить мои голоса» shows what your account has)
      voices: {
        no: [['EXAVITQu4vr4xnSDxMaL', 'Sarah', F], ['JBFqnCBsd6RMkjVDRZzb', 'George', M], ['onwK4e9ZLuTAKqWW03F9', 'Daniel', M]],
        ru: [['EXAVITQu4vr4xnSDxMaL', 'Sarah', F], ['JBFqnCBsd6RMkjVDRZzb', 'George', M], ['onwK4e9ZLuTAKqWW03F9', 'Daniel', M]],
        uk: [['EXAVITQu4vr4xnSDxMaL', 'Sarah', F], ['JBFqnCBsd6RMkjVDRZzb', 'George', M], ['onwK4e9ZLuTAKqWW03F9', 'Daniel', M]],
      },
      freeChars: 10000,
    },
  };
  /** Piper voices: names, quality (research.md: alphacephei for Russian; «high» = the bigger Ukrainian models) */
  const PIPER = {
    'no_NO-talesyntese-medium': { lang: 'no', name: 'Talesyntese', g: M, q: 3, about: 'Språkbanken (Национальная библиотека Норвегии). Чёткий, немного «синтетический».' },
    'no_NO-nvcc-medium': { lang: 'no', name: 'NVCC', g: '', q: 3, about: '10 голосов дикторов Språkbanken — мужские и женские.',
      speakers: { KNN: 'Женский 1', KSV: 'Женский 2', KON: 'Женский 3', KMN: 'Женский 4', KNV: 'Женский 5', MMN: 'Мужской 1', MNN: 'Мужской 2', MSV: 'Мужской 3', MON: 'Мужской 4', MNV: 'Мужской 5' } },
    'ru_RU-irina-medium': { lang: 'ru', name: 'Ирина', g: F, q: 4, stress: true, about: 'Лучшая по замерам русская офлайн-модель Piper. Лицензия записи не указана — для личного использования.' },
    'ru_RU-denis-medium': { lang: 'ru', name: 'Денис', g: M, q: 3, stress: true, about: 'Новая модель Piper 1.5, запись CC0 (свободная лицензия).' },
    'ru_RU-dmitri-medium': { lang: 'ru', name: 'Дмитрий', g: M, q: 3, stress: true, about: 'Новая модель Piper 1.5, запись CC0 (свободная лицензия).' },
    'uk_UA-tetiana-high': { lang: 'uk', name: 'Тетяна', g: F, q: 4, about: 'Большая модель «high» — лучший офлайн-голос для украинского. Apache-2.0.' },
    'uk_UA-mykyta-high': { lang: 'uk', name: 'Микита', g: M, q: 4, about: 'Большая модель «high». Apache-2.0.' },
    'uk_UA-oleksa-high': { lang: 'uk', name: 'Олекса', g: M, q: 4, about: 'Большая модель «high». Apache-2.0.' },
    'uk_UA-ukrainian_tts-medium': { lang: 'uk', name: 'Ukrainian TTS', g: '', q: 3, about: 'Три голоса в одной модели, читает буквы (без espeak). Запись CC0.',
      speakers: { lada: 'Лада ♀', tetiana: 'Тетяна ♀', mykyta: 'Микита ♂' } },
  };
  const AUDIO = ['piper', 'nk', 'edge', 'azure', 'gcloud', 'gemini', 'eleven'];  // engines that make audio files
  const NET = ['nk', 'edge', 'azure', 'gcloud', 'gemini', 'eleven'];              // …over the network: kept on the device, 4-s timeout
  const KEYED = ['azure', 'gcloud', 'gemini', 'eleven'];
  const CLOUD = AUDIO;
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  /** 📍 the places that speak (order = the rows of «Где какой голос») */
  const PLACES = [
    { id: 'cards', ico: 'cards', name: 'Карточки', sub: 'занятия, арт-карточки, тесты, упражнения', for: 'для карточек' },
    { id: 'reader', ico: 'book', name: 'Читалка', sub: 'книги и учебник', for: 'для читалки' },
    { id: 'listen', ico: 'headphones', name: 'Слушать', sub: 'колоды вслух, плеер «Слушать»', for: 'для «Слушать»' },
    { id: 'dialogs', ico: 'dialogue', name: 'Диалоги', sub: 'диалоги по ролям', for: 'для диалогов' },
    { id: 'video', ico: 'tv', name: 'Видео и субтитры', sub: 'YouTube, NRK TV, свои субтитры', for: 'для видео' },
    { id: 'news', ico: 'news', name: 'Новости и радио', sub: 'новости простым языком, NRK Радио', for: 'для новостей и радио' },
    { id: 'interpreter', ico: 'translate', name: 'Переводчик', sub: 'переводчик в наушниках', for: 'для переводчика' },
    { id: 'speech', ico: 'mic', name: 'Произношение', sub: 'проверка произношения, диктант', for: 'для произношения' },
    { id: 'telegram', ico: 'send', name: 'Telegram-каналы', sub: 'посты, аудио и видео авторов', for: 'для Telegram' },
  ];
  const PLACE_IDS = PLACES.map(p => p.id);
  /** other names a caller may use */
  const PLACE_ALIAS = {
    study: 'cards', card: 'cards', art: 'cards', artcards: 'cards', quiz: 'cards', drills: 'cards', deck: 'cards', tests: 'cards',
    books: 'reader', book: 'reader', read: 'reader', textbook: 'reader', listenx: 'listen', player: 'listen', audiocourse: 'listen',
    dialog: 'dialogs', dialogue: 'dialogs', dialogues: 'dialogs', subs: 'video', subtitles: 'video', youtube: 'video', tv: 'video', nrk: 'video',
    radio: 'news', translator: 'interpreter', interp: 'interpreter', pron: 'speech', pronunciation: 'speech', dictation: 'speech', tg: 'telegram',
  };
  const normPlace = x => { const k = String(x || '').toLowerCase(); return PLACE_IDS.includes(k) ? k : PLACE_ALIAS[k] || ''; };
  /** which place a window belongs to, by its class (the top window decides; js/ui.js UI.modal({ cls })) */
  const PLACE_BY_CLASS = [
    ['reader', /\b(rd-modal|rd-toc-modal|rd-shelf-modal|book-reader|books-modal|bs-modal|tb-modal)\b/],
    ['dialogs', /\bdlg-modal\b/],
    ['listen', /\b(listen-modal|lc-modal|np-modal|lp-intro|lxw-modal|lxd-modal|lxv-modal|ac-modal|ac-cast-modal)\b/],
    ['news', /\b(nw-modal|nrkr-modal)\b/],
    ['telegram', /\b(tg-modal|tgl-modal|tgcur-modal|tcr-paste|tgi-intro|tga-modal|tga-noff|tgv-modal)\b/],
    ['video', /\b(subs-modal|yt-modal|nrk-modal|sv-modal|tv-modal|glass-modal)\b/],
    ['speech', /\b(sp-modal|sp-hub|sp-consent)\b/],
    ['cards', /\b(drills-modal|klokka-modal|prove-modal|exams-modal|lv-[a-z-]*modal|gr-modal|gk-modal|ot-modal|mc-modal|lib-modal|card-view|deck-editor|pic-modal|create-modal|cm-modal|photo-modal|fix-modal|tr-fail-modal|aim-study|aim-art|art-[a-z-]+|ac-apply-modal|ac-ideas-modal|ac-motion-modal|sc-lens-art|m-study-sheet)\b/],
  ];
  const placeOfClass = c => { for (const [id, re] of PLACE_BY_CLASS) if (re.test(c)) return id; return ''; };
  const MONTHS_IN = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];

  /* 🎭 dialogues: the speakers' voices (kept 5 min or until a voice is chosen / fails), a name label «Kari:» «Анна:»
     (1–3 capitalised words), labels that are not speakers, the pitch of a device voice when no other voice exists */
  const roleMemo = new Map();
  const ROLE_LABEL = /^\s*((?:[A-ZÆØÅÄÖÜÉА-ЯЁІЇЄҐ][\p{Ll}'’-]*\.?)(?:\s+[A-ZÆØÅÄÖÜÉА-ЯЁІЇЄҐ][\p{Ll}'’-]*){0,2})\s*:\s+(?=\S)/u;
  const ROLE_STOP = new Set(('merk nb obs ps tips info husk se oppgave oppgaver svar spørsmål eksempel eksempler tid sted dato ord ordliste '
    + 'tema kilde fra til emne pris adresse telefon tlf e-post epost kapittel side del tekst øvelse grammatikk regel les lytt skriv snakk '
    + 'oversettelse forklaring note example answer question task примечание пример примеры ответ вопрос задание перевод тема источник '
    + 'внимание правило слово слова упражнение глава часть текст итог важно совет запомните объяснение приклад відповідь питання завдання '
    + 'переклад увага правило вправа betydning uttale bøyning entall flertall synonym synonymer antonym kommentar bokmål nynorsk '
    + 'norsk engelsk russisk ukrainsk english значение произношение комментарий норвежский русский украинский английский').split(' '));
  const ROLE_PITCH = [0.8, 1.2, 0.9, 1.1];
  ['voices-pick', 'voices-changed'].forEach(t => document.addEventListener(t, () => roleMemo.clear()));
  const mem = new Map();        // key -> { url, marks } (this session)
  const inflight = new Map();   // the same text asked twice at once (player start, prefetch) -> one request
  let playGen = 0;
  const pct = rate => { const p = Math.round((rate / 0.9 - 1) * 100); return (p >= 0 ? '+' : '') + Math.max(-60, Math.min(100, p)) + '%'; };
  const xml = s => String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);
  const S = () => (window.Store && Store.state ? Store.settings : {});
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode: this session only */ } },
  };
  function fnv(s) {
    let h1 = 0x811c9dc5, h2 = 0x01000193 ^ s.length;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193); h2 = Math.imul(h2 ^ c, 0x5bd1e995); h2 ^= h2 >>> 15; }
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  }
  const b64blob = (b64, type) => { const bin = atob(b64 || ''); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type }); };
  const err = (kind, message) => Object.assign(new Error(message), { kind });

  /* ---------- drawn line icons (the family of NavIcons.icon, js/app.js: 24×24, a 1.9 line in the colour of the text,
   * round ends, `f` = lightly filled, `dot` = solid). NavIcons.icon first; the voice-only ones are drawn here ---------- */
  const ICO = {
    speaker: '<path class="f" d="M4.5 9.4h2.9l4.3-3.6c.55-.46 1.3-.07 1.3.64v11.12c0 .71-.75 1.1-1.3.64L7.4 14.6H4.5c-.6 0-1-.4-1-1V10.4c0-.6.4-1 1-1z"/><path d="M16.2 9.2a4 4 0 0 1 0 5.6"/><path d="M18.8 6.6a7.6 7.6 0 0 1 0 10.8"/>',
    play: '<path class="f" d="M8 5.7v12.6c0 .8.88 1.28 1.55.85l9.8-6.3c.62-.4.62-1.3 0-1.7l-9.8-6.3C8.88 4.42 8 4.9 8 5.7z"/>',
    stop: '<rect class="f" x="6.6" y="6.6" width="10.8" height="10.8" rx="2.4"/>',
    key: '<circle class="f" cx="8.2" cy="15.6" r="4"/><path d="M11.1 12.7 19.6 4.2"/><path d="M16.7 7.1l2.3 2.3M14.5 9.3l1.7 1.7"/>',
    phone: '<rect class="f" x="6.6" y="3.4" width="10.8" height="17.2" rx="2.6"/><path d="M10.6 17.4h2.8"/>',
    globe: '<circle class="f" cx="12" cy="12" r="8.4"/><path d="M3.8 12h16.4"/><path d="M12 3.6c2.3 2.4 3.4 5.2 3.4 8.4s-1.1 6-3.4 8.4c-2.3-2.4-3.4-5.2-3.4-8.4S9.7 6 12 3.6z"/>',
    laptop: '<rect class="f" x="5" y="5.2" width="14" height="10.2" rx="1.8"/><path d="M3 18.8h18"/>',
    star: '<path class="f" d="M12 3.9l2.47 5.02 5.53.8-4 3.9.94 5.5L12 16.53 7.06 19.12 8 13.62l-4-3.9 5.53-.8z"/>',
    crown: '<path class="f" d="M4.4 8.2l3.7 3.3L12 5.6l3.9 5.9 3.7-3.3-1.5 9.3H5.9z"/><path d="M6 20.2h12"/>',
    pin: '<path class="f" d="M12 20.6s6.4-5.6 6.4-10.6a6.4 6.4 0 0 0-12.8 0c0 5 6.4 10.6 6.4 10.6z"/><circle cx="12" cy="10" r="2.3"/>',
    fallback: '<path d="M4.6 7.6h9.2a5.6 5.6 0 0 1 0 11.2H9"/><path d="M8.1 4.1 4.6 7.6l3.5 3.5"/>',
    clock: '<circle class="f" cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3 2"/>',
    edit: '<path class="f" d="M4.6 19.4l.9-4L15.8 5.1a2 2 0 0 1 2.8 0l.3.3a2 2 0 0 1 0 2.8L8.6 18.5z"/><path d="M13.8 7.1l3.1 3.1"/>',
    user: '<circle class="f" cx="12" cy="8.4" r="3.8"/><path d="M4.8 20c.8-3.6 3.6-5.6 7.2-5.6s6.4 2 7.2 5.6"/>',
    sort: '<path d="M8 4.6v14.8M4.8 7.8 8 4.6l3.2 3.2"/><path d="M16 19.4V4.6M12.8 16.2l3.2 3.2 3.2-3.2"/>',
    back: '<path d="M19.4 12H5"/><path d="M10.5 6.5 5 12l5.5 5.5"/>',
    up: '<path d="M12 19.4V5"/><path d="M6.5 10.5 12 5l5.5 5.5"/>',
    down: '<path d="M12 4.6V19"/><path d="M6.5 13.5 12 19l5.5-5.5"/>',
    disk: '<path class="f" d="M5.6 4.4h10.2l3.8 3.8v10.4c0 .55-.45 1-1 1H5.6c-.55 0-1-.45-1-1V5.4c0-.55.45-1 1-1z"/><path d="M8.2 4.4v4.4h6.6V4.4"/><rect x="8" y="13.2" width="8" height="6.2" rx="1"/>',
    chevron: '<path d="M6.5 9.5 12 15l5.5-5.5"/>',
    dialogue: '<path class="f" d="M4 6.2C4 5 5 4 6.2 4h7.6C15 4 16 5 16 6.2v4.6c0 1.2-1 2.2-2.2 2.2H9l-3.4 2.6c-.4.3-.9 0-.9-.4V13h-.5C4 13 4 12 4 10.8z"/><path d="M18.6 9.4h.2c.66 0 1.2.54 1.2 1.2v5.2c0 .66-.54 1.2-1.2 1.2H18v1.8c0 .4-.47.63-.79.38L14.6 17.2H11c-.66 0-1.2-.54-1.2-1.2v-.6"/>',
    cards: '<rect class="f" x="3.5" y="7" width="13" height="13.5" rx="2.4"/><path d="M7.5 3.5h10.2c1.6 0 2.8 1.2 2.8 2.8v10.2"/>',
    book: '<path class="f" d="M4 5.6c2.7-1 5.3-1 8 .8v13c-2.7-1.8-5.3-1.8-8-.8z"/><path d="M20 5.6c-2.7-1-5.3-1-8 .8v13c2.7-1.8 5.3-1.8 8-.8z"/>',
    headphones: '<path d="M4.5 15v-2.5a7.5 7.5 0 0 1 15 0V15"/><rect class="f" x="3.5" y="13.4" width="4.6" height="6.6" rx="1.8"/><rect class="f" x="15.9" y="13.4" width="4.6" height="6.6" rx="1.8"/>',
    tv: '<rect class="f" x="3.5" y="5.4" width="17" height="11.6" rx="2.2"/><path d="M8.5 20.2h7"/><path d="M10.7 9.1v4.3l3.7-2.15z"/>',
    news: '<path class="f" d="M5.5 4.5h10c.55 0 1 .45 1 1v13c0 .83.67 1.5 1.5 1.5H6.5a2 2 0 0 1-2-2V5.5c0-.55.45-1 1-1z"/><path d="M16.5 9H19c.55 0 1 .45 1 1v8.5a1.5 1.5 0 0 1-3 0"/><path d="M7.8 8.6h5.4M7.8 12h5.4M7.8 15.4h3.4"/>',
    translate: '<path d="M4 6h8.2M8.1 4v2M10.6 6c-.6 3.4-2.9 6.2-6.3 7.8"/><path d="M6.2 9.3c1 1.8 2.6 3.3 4.6 4.3"/><path d="M12.6 20.2 16.1 11.6l3.5 8.6M13.9 17.1h4.4"/>',
    mic: '<rect class="f" x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.8 11.5a6.2 6.2 0 0 0 12.4 0"/><path d="M12 17.7v2.8"/>',
    send: '<path class="f" d="M20.1 4.3 3.9 10.6c-.72.28-.68 1.31.06 1.53l4.3 1.3 1.6 5c.22.7 1.12.88 1.6.32l2.3-2.5 4.2 3.1c.6.44 1.45.1 1.57-.63L21.6 5.5c.12-.8-.7-1.43-1.5-1.2z"/><path d="m8.3 13.4 8.4-5.6"/>',
    plug: '<path d="M9 3.8v4M15 3.8v4"/><path class="f" d="M6.6 7.8h10.8v3.4a5.4 5.4 0 0 1-10.8 0z"/><path d="M12 16.6v3.6"/>',
  };
  const paint = s => s.replace(/class="f"/g, 'class="f" fill="currentColor" fill-opacity=".22"').replace(/class="dot"/g, 'class="dot" fill="currentColor" stroke="none"');
  /** a drawn icon: NavIcons.icon(name) when js/app.js has it, else ours (same look); '' for an unknown name */
  function icon(name, size, cls) {
    const nav = window.NavIcons && NavIcons.icon && NavIcons.ICONS && NavIcons.ICONS.includes(name) ? NavIcons.icon(name, size, cls) : '';
    if (nav) return nav;
    const p = ICO[name];
    if (!p) return '';
    const sz = size || 18;
    return `<svg class="ico ui-ico ui-ico-${name}${cls ? ' ' + cls : ''}" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paint(p)}</svg>`;
  }
  /** the language as a small drawn badge (instead of a flag emoji) */
  const langMark = (l, cls) => `<span class="vs-lc vs-lc-${l}${cls ? ' ' + cls : ''}" aria-hidden="true">${LC[l] || ''}</span>`;
  /** the voices window's stylesheet (also styles the summary rows and language buttons in other screens) */
  function ensureCss() {
    if (document.querySelector('link[data-voicepicker]')) return;
    const v = (document.querySelector('script[src*="js/voices.js"]') || {}).src || '';
    const q = (v.match(/\?v=[^&]+/) || [''])[0];
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = 'css/voicepicker.css' + q; l.setAttribute('data-voicepicker', '');
    document.head.appendChild(l);
  }

  /* ---------- Norsk Kort Pro voices (engine 'nk'): server state, the one place that decides «may it speak» ----------
   * premium: Chirp 3 HD allowed by the server (health.providers.tts_premium === 'chirp3-hd'); unknown → hidden.
   * server: health.providers.tts ('google' | 'mock' | 'missing'). declined: the AI consent was declined this session —
   * the auto chain stops asking. hdOut: the monthly Chirp 3 HD characters are used up (until resetsAt). */
  const NK = {
    premium: null, server: '', checked: 0, busy: null, declined: false, hdOut: 0,
    init() { const c = ls.get('nk-tts-health', null); if (c && c.t && Date.now() - c.t < 6 * 3600000) { this.premium = !!c.premium; this.server = c.server || ''; this.checked = c.t; } },
    offered() { return !!(window.Pro && Pro.offered && Pro.offered() && window.Net && Net.callFn) && this.server !== 'missing'; },
    pro() { return !!(this.offered() && Pro.isActive && Pro.isActive()); },
    consent() { return !window.AIConsent || !AIConsent.granted || AIConsent.granted(); },
    /** GET health once in a while (public, free): which server voices are switched on */
    health(force) {
      if (!this.offered() && !(window.Pro && Pro.offered && Pro.offered())) return Promise.resolve(this);
      if (this.busy) return this.busy;
      if (!force && this.checked && Date.now() - this.checked < 6 * 3600000) return Promise.resolve(this);
      this.busy = Net.callFn('health', null, { method: 'GET', auth: false, retries: 0, timeout: 8000 }).then(j => {
        const pv = (j && j.providers) || {};
        const was = this.premium + '|' + this.server;
        this.premium = pv.tts_premium === 'chirp3-hd';
        this.server = String(pv.tts || '');
        this.checked = Date.now();
        ls.set('nk-tts-health', { t: this.checked, premium: this.premium, server: this.server });
        if (was !== this.premium + '|' + this.server) document.dispatchEvent(new CustomEvent('voices-changed'));
      }).catch(() => { this.checked = Date.now() - 5 * 3600000; /* ask again in an hour */ }).then(() => { this.busy = null; return this; });
      return this.busy;
    },
    /** the server's speed: the app's 0.9 = natural (1.0), 0.05 steps (the server rounds the same way — better cache reuse) */
    rate(rate) { return Math.max(0.5, Math.min(1.5, Math.round(((+rate || 0.9) / 0.9) * 20) / 20)); },
  };
  NK.init();

  /* ---------- 💾 cloud clips kept on the device (fixes: every start spent the free quota again) ---------- */
  const Clips = {
    NAME: 'norsk-kort-tts-clips', IDX: 'nk-tts-clips', MAX: 60 * MB,
    ok() { return 'caches' in window && /^https?:$/.test(location.protocol); },
    url(h) { return new URL('__nk_tts/' + h, location.href).href; },
    async get(key) {
      if (!this.ok()) return null;
      const h = fnv(key), idx = ls.get(this.IDX, {});
      if (!idx[h]) return null;
      try {
        const r = await (await caches.open(this.NAME)).match(this.url(h));
        if (!r) { delete idx[h]; ls.set(this.IDX, idx); return null; }
        idx[h][1] = Date.now(); ls.set(this.IDX, idx);
        let marks = null;
        try { marks = JSON.parse(r.headers.get('x-marks') || 'null'); } catch (e) { marks = null; }
        return { blob: await r.blob(), marks };
      } catch (e) { return null; }
    },
    async put(key, blob, marks) {
      if (!this.ok() || !blob || blob.size < 200 || blob.size > 8 * MB) return;
      try {
        const h = fnv(key), c = await caches.open(this.NAME);
        const headers = { 'content-type': blob.type || 'audio/mpeg' };
        if (marks && marks.length) headers['x-marks'] = JSON.stringify(marks.map(m => ({ t: +(+m.t).toFixed(3), c: m.c | 0 })));
        await c.put(this.url(h), new Response(blob, { headers }));
        const idx = ls.get(this.IDX, {});
        idx[h] = [blob.size, Date.now()];
        // over the limit: the clips not heard for the longest time go first
        let total = Object.values(idx).reduce((n, x) => n + x[0], 0);
        const old = Object.entries(idx).sort((a, b) => a[1][1] - b[1][1]);
        while (total > this.MAX && old.length) { const [k, v] = old.shift(); if (k === h) continue; total -= v[0]; delete idx[k]; c.delete(this.url(k)).catch(() => {}); }
        ls.set(this.IDX, idx);
      } catch (e) { /* storage full / private mode: just not kept */ }
    },
    stats() { const v = Object.values(ls.get(this.IDX, {})); return { count: v.length, bytes: v.reduce((n, x) => n + x[0], 0) }; },
    async clear() { try { await caches.delete(this.NAME); } catch (e) { /* ignore */ } ls.set(this.IDX, {}); mem.clear(); },
  };

  /* ---------- 📊 characters sent this month (approximate, this device only) ----------
   * Counted per meter: 'gcloud' = Chirp 3 HD (and other premium Google voices), 'gcloud-wn' = WaveNet / Standard (their own
   * free 4 M), else the engine. Only what really went to the network — a phrase kept on the device costs nothing. */
  const monthKey = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1); };
  const Usage = {
    get(meter) { const u = ls.get('nk-tts-usage', {}); return u.m === monthKey() ? u[meter] || 0 : 0; },
    add(meter, n) { let u = ls.get('nk-tts-usage', {}); if (u.m !== monthKey()) u = { m: monthKey() }; u[meter] = (u[meter] || 0) + n; ls.set('nk-tts-usage', u); },
  };

  /* ---------- 🩺 engine health: bad key, used-up quota (until it comes back), short breaks after network errors ---------- */
  const keyOf = e => { const s = S(); return e === 'azure' ? (s.azureKey || '').trim() + '|' + (s.azureRegion || '').trim() : e === 'gcloud' ? (s.gcloudKey || '').trim() : e === 'gemini' ? (s.geminiKey || '').trim() : e === 'eleven' ? (s.elevenKey || '').trim() : ''; };
  const nextMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); };
  /** kept on the device (per key): badkey — until the key changes; the others — for a while */
  const SAVED_FOR = { quota: 0, billing: 30 * 60000, blocked: 24 * 3600000, region: 24 * 3600000 };
  const Health = {
    brk: {},  // engine -> { until, fails } (this session)
    saved() { return ls.get('nk-voice-health', {}); },
    state(engine) {
      const h = this.saved()[engine];
      if (h && h.fp === fnv(keyOf(engine)) && (h.why === 'badkey' || h.until > Date.now())) return h.why;
      const b = this.brk[engine];
      return b && b.until > Date.now() ? 'down' : '';
    },
    mark(engine, why, until) {
      if (why === 'badkey' || why in SAVED_FOR) {
        const all = this.saved();
        all[engine] = { why, fp: fnv(keyOf(engine)), until: why === 'badkey' ? 0 : until > Date.now() ? until : why === 'quota' ? (engine === 'gemini' ? GEM.resetAt() : nextMonth()) : Date.now() + SAVED_FOR[why] };
        ls.set('nk-voice-health', all);
        return;
      }
      const b = this.brk[engine] || (this.brk[engine] = { fails: 0, until: 0 });
      b.fails++;
      // a network voice that failed twice in a row rests for 5 minutes (a per-minute rate limit: 1 minute)
      if (why === 'rate') b.until = Date.now() + 60000;
      else if (b.fails >= 2) b.until = Date.now() + 5 * 60000;
    },
    ok(engine) { delete this.brk[engine]; const all = this.saved(); if (all[engine] && all[engine].why !== 'badkey') { delete all[engine]; ls.set('nk-voice-health', all); } },
    forget(engine) { delete this.brk[engine]; const all = this.saved(); delete all[engine]; ls.set('nk-voice-health', all); },
  };

  /* ---------- ✦ Gemini TTS: your own AI Studio key, for yourself only ----------
   * Free tier: «Free of charge», the text may be used by Google to improve its products (ai.google.dev pricing); the
   * limits are per project and per model, requests per day reset at midnight Pacific time (ai.google.dev rate limits).
   * Google does not publish the free TTS numbers on the docs page any more (AI Studio shows them per project); users
   * report 10 requests a day per TTS model — so the app keeps to RPD 10 and 3 a minute per model, tries the models in
   * turn, and a 429 «per day» from Google closes that model until the reset whatever the local count says. */
  const GEM = {
    MODELS: ['gemini-3.8-flash-tts', 'gemini-2.5-flash-preview-tts', 'gemini-3.1-flash-tts-preview', 'gemini-3.8-flash-lite-tts'],
    RPD: 10, RPM: 3, LANGS: ['no', 'ru'],
    day() {
      try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
      catch (e) { return new Date(Date.now() - 8 * 3600000).toISOString().slice(0, 10); }
    },
    st() { let s = ls.get('nk-gemini-day', null); if (!s || s.d !== this.day()) s = { d: this.day(), n: {}, out: {} }; return s; },
    /** a model this key cannot use (not found / not for TTS) — remembered per key */
    isBad(m) { const b = ls.get('nk-gemini-bad', {}); return b.fp === fnv(keyOf('gemini')) && !!(b.m || {})[m]; },
    setBad(m) { let b = ls.get('nk-gemini-bad', {}); if (b.fp !== fnv(keyOf('gemini'))) b = { fp: fnv(keyOf('gemini')), m: {} }; b.m[m] = 1; ls.set('nk-gemini-bad', b); },
    models() { return this.MODELS.filter(m => !this.isBad(m)); },
    usable() { const s = this.st(); return this.models().filter(m => !s.out[m] && (s.n[m] || 0) < this.RPD); },
    count(m) { const s = this.st(); s.n[m] = (s.n[m] || 0) + 1; ls.set('nk-gemini-day', s); },
    out(m) { const s = this.st(); s.out[m] = 1; ls.set('nk-gemini-day', s); },
    used() { const s = this.st(); return this.models().reduce((a, m) => a + (s.out[m] ? this.RPD : Math.min(this.RPD, s.n[m] || 0)), 0); },
    total() { return this.models().length * this.RPD; },
    /** the next midnight in California (the daily reset), as a time on this device */
    resetAt() {
      try {
        const p = {};
        new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' })
          .formatToParts(new Date()).forEach(x => { p[x.type] = +x.value; });
        const since = ((p.hour % 24) * 3600 + p.minute * 60 + p.second) * 1000;
        return Math.round((Date.now() - since + 86400000) / 60000) * 60000;
      } catch (e) { return Date.now() + 86400000; }
    },
  };

  /* ---------- 📏 limits: our own monthly ceilings, percentages, the 90 % note and the friendly «limit is over» window ---------- */
  const CAPS = { gcloud: 950000, 'gcloud-wn': 3800000 };  // Google bills past its free 1 M / 4 M: the app stops a little earlier
  const Limits = {
    meter(engine, voice) { return engine === 'gcloud' && /-(Wavenet|Standard)-/i.test(String(voice || '')) ? 'gcloud-wn' : engine; },
    engineOf(meter) { return String(meter).startsWith('gcloud') ? 'gcloud' : meter; },
    /** the ceiling the app keeps to: ours for Google (may be set lower in the key window), the vendor's free amount else */
    cap(meter) {
      if (meter === 'gemini') return GEM.total();
      if (CAPS[meter]) { const own = +(S()[meter === 'gcloud' ? 'gcloudCap' : 'gcloudWnCap']) || 0; return own > 0 ? Math.min(CAPS[meter], own) : CAPS[meter]; }
      return (ENGINES[meter] || {}).freeChars || 0;
    },
    /** stops the voice by itself at the ceiling (Google: past it money would be charged; Gemini: the day's requests) */
    hard(meter) { return meter === 'gemini' || !!CAPS[meter]; },
    used(meter) { return meter === 'gemini' ? GEM.used() : Usage.get(meter); },
    pct(meter) { const c = this.cap(meter); return c ? this.used(meter) / c : 0; },
    left(meter) { return meter === 'gemini' ? (GEM.usable().length ? 1 : 0) : this.cap(meter) - this.used(meter); },
    over(meter) { return this.hard(meter) && this.left(meter) <= 0; },
    resetAt(meter) { return meter === 'gemini' ? GEM.resetAt() : nextMonth(); },
    /** «1 декабря» · «завтра около 9:00» */
    resetText(meter) {
      const d = new Date(this.resetAt(meter));
      if (meter !== 'gemini') return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
      const hm = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
      return (d.toDateString() === new Date().toDateString() ? 'сегодня' : 'завтра') + ' около ' + hm;
    },
    period(meter) { return meter === 'gemini' ? 'на сегодня' : 'этого месяца'; },
  };
  /** «once per engine per month» notes (Gemini's day runs out often: its window too comes once a month, later days a calm line) */
  const Notes = {
    once(kind, meter) {
      let n = ls.get('nk-limit-notes', {});
      if (n.m !== monthKey()) n = { m: monthKey(), k: {} };
      const k = kind + ':' + meter;
      if (n.k[k]) return false;
      n.k[k] = 1; ls.set('nk-limit-notes', n);
      return true;
    },
  };

  /* ---------- ⏱ requests per minute: Azure F0 takes 20 a minute, Gemini's free tier a few ----------
   * Requests wait for their turn (a phrase that waits too long is read by the next voice; it still arrives and is kept).
   * maxWait: more waiting than this → «rate» at once, nothing is sent (a whole deck never queues up for Gemini). */
  const Gate = {
    q: {},
    async take(name, perMin, maxWait) {
      const g = this.q[name] || (this.q[name] = { times: [], waiting: 0, chain: Promise.resolve() });
      if (maxWait != null && g.waiting >= maxWait) throw err('rate', 'слишком много запросов подряд');
      g.waiting++;
      const turn = g.chain.then(async () => {
        for (;;) {
          const now = Date.now();
          g.times = g.times.filter(t => now - t < 60000);
          if (g.times.length < perMin) { g.times.push(now); return; }
          await sleep(60000 - (now - g.times[0]) + 50);
        }
      });
      g.chain = turn.catch(() => {});
      try { await turn; } finally { g.waiting--; }
    },
  };
  /** 16-bit PCM (Gemini: audio/L16, 24 kHz, mono) → a WAV the <audio> element plays */
  function pcmWav(b64, rate) {
    const bin = atob(b64 || ''), n = bin.length, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
    const w = (o, t) => { for (let k = 0; k < t.length; k++) b[o + k] = t.charCodeAt(k); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) b[44 + i] = bin.charCodeAt(i);
    return new Blob([b], { type: 'audio/wav' });
  }

  /* ---------- 💻 Edge through the Mac bridge: is the edge-tts module installed there? ----------
   * installed: true / false / null (not asked yet) · old: the running bridge is from before v208 (no one-click install —
   * it must be restarted once) · installing: the bridge is installing it right now (the app's «⬇ Установить» button) */
  const Edge = { installed: null, version: '', checked: 0, busy: null, old: false, installing: false, canRestart: false, lastInstall: null, stale: false };
  // stale: Microsoft changed its protection and the bridge's edge-tts got 403 — «⬇ Обновить голоса Edge» (the same one-click install)
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- 🔓 sound that starts later (after a download, a slow voice, the bridge) ----------
   * Safari (and Chrome without an earlier tap) block audio.play() when the tap was more than ~1 s ago — the first phrase
   * of an offline voice (loading the model) or an Edge voice (asking the Mac) came too late, so the voice «did nothing».
   * An <audio> element that once played after a tap may play again later: a few of them are unlocked on the first taps
   * (a 50-ms silence) and every voice clip plays in one of them. */
  const Pool = { els: [], on: false };
  const SILENT = (() => {
    const n = 400, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
    const w = (o, t) => { for (let k = 0; k < t.length; k++) b[o + k] = t.charCodeAt(k); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
    b.fill(128, 44);
    let bin = ''; b.forEach(x => { bin += String.fromCharCode(x); });
    return 'data:audio/wav;base64,' + btoa(bin);
  })();
  const IOS_DEV = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  function unlockAudio() {
    if (Pool.els.length >= 3 && Pool.els.every(a => a._nkOk)) { detachUnlock(); return; }
    // iPhone plays one sound at a time: never interrupt something that is playing — the next tap will do
    if (IOS_DEV && window.TTS && ((TTS._audio && !TTS._audio.paused) || (TTS._keep && !TTS._keep.paused) || (window.Listen && Listen.p && Listen.p.playing))) return;
    while (Pool.els.length < 3) { const a = new Audio(); a.setAttribute('playsinline', ''); a.preload = 'auto'; Pool.els.push(a); }
    Pool.els.forEach(a => {
      if (a._nkOk || a._nkTry || (window.TTS && TTS._audio === a)) return;
      a._nkTry = true;
      try {
        a.src = SILENT;
        const p = a.play();
        if (p && p.then) p.then(() => { a._nkOk = true; a._nkTry = false; }, () => { a._nkTry = false; });
        else { a._nkOk = true; a._nkTry = false; }
      } catch (e) { a._nkTry = false; }
    });
  }
  const UNLOCK_EV = ['click', 'touchend', 'keydown'];
  function detachUnlock() { if (!Pool.on) return; Pool.on = false; UNLOCK_EV.forEach(t => document.removeEventListener(t, unlockAudio, true)); }
  if (typeof Audio === 'function') { Pool.on = true; UNLOCK_EV.forEach(t => document.addEventListener(t, unlockAudio, true)); }
  /** an <audio> for a voice clip: an unlocked one that is free, else a new one */
  function takeAudio(url) {
    const busy = window.TTS ? TTS._audio : null;
    // the one used longest ago (a word clock of the clip before may still look at the last one for a moment)
    let a = Pool.els.filter(x => x._nkOk && x !== busy && x.paused && !x._nkTry).sort((x, y) => (x._nkUsed || 0) - (y._nkUsed || 0))[0];
    if (a) { a.onended = a.onerror = a.onstalled = null; a.loop = false; a.src = url; a._nkUsed = Date.now(); }
    else { a = new Audio(url); a.setAttribute('playsinline', ''); }
    a.muted = !!(window.TTS && TTS.muted); // automated tests: never a sound
    return a;
  }

  /* ---------- the voice catalogue (per language) ---------- */
  const parse = id => {
    const s = String(id || ''), i = s.indexOf(':');
    const engine = i < 0 ? s : s.slice(0, i);
    let key = i < 0 ? '' : s.slice(i + 1), spk = '';
    if (engine === 'piper' && key.includes('#')) { spk = key.slice(key.indexOf('#') + 1); key = key.slice(0, key.indexOf('#')); }
    return { engine, key, spk };
  };
  const langOfVoice = (engine, key, lang) => {
    if (engine === 'piper') return (PIPER[key] || {}).lang;
    if (engine === 'gtr') return key;
    if (engine === 'sys') return lang; // only voicesFor(lang) are ever offered
    if (engine === 'eleven') return lang; // multilingual voices
    return /^nb-/.test(key) ? 'no' : /^uk-/.test(key) ? 'uk' : /^ru-/.test(key) ? 'ru' : lang;
  };
  function sysList(lang) {
    if (!window.TTS) return [];
    const seen = new Set();
    return TTS.voicesFor(lang).filter(v => !seen.has(v.name) && seen.add(v.name));
  }
  const gOf = name => /милен|milena|катя|katya|katja|nora|леся|lesya|yelena|елена|ирина|irina|pernille|iselin|светлан|дарья|anna|alva|female|женск|kvinne|♀/i.test(name) ? F
    : /yuri|юрий|henrik|maxim|максим|дмитр|dmitr|denis|денис|остап|ostap|finn|male|мужск|mann|♂/i.test(name) ? M : '';

  /** Google Cloud voices of a language: the built-in list + what voices.list gave for your key (new voices appear by themselves) */
  function gList(lang) {
    const base = G_VOICES[lang].slice(), live = (ls.get('nk-gcloud-voices', {}) || {})[lang];
    if (Array.isArray(live)) live.forEach(v => { if (v && v[0] && !base.some(b => b[0] === v[0])) base.push(v); else if (v && v[2]) { const b = base.find(x => x[0] === v[0]); if (b && !b[2]) b[2] = v[2]; } });
    return base;
  }

  /** a Piper voice whose recording may be used in a paid app (CC0 / CC BY / Apache / MIT) — the public build shows only these */
  const piperLicence = key => { const sp = window.Speech && Speech.piper && Speech.piper.VOICES ? Speech.piper.VOICES[key] : null; return sp ? String(sp[3] || '') : PIPER[key] && /неизвестн|личного/.test(PIPER[key].about) ? 'неизвестна' : ''; };
  const piperCommercial = key => /^(CC0|CC[- ]BY(?!-NC)|Apache|MIT)/i.test(piperLicence(key));

  function entries(lang) {
    const out = [];
    const add = o => out.push(Object.assign({ lang, g: '', q: 3, about: '' }, o));
    const pub = publicBuild();
    // Norsk Kort Pro (server voices) — when the server is set up; Chirp 3 HD only while the server allows it
    if (NK.offered()) {
      NK_VOICES[lang].forEach(([key, name, g]) => {
        if (isHd(key) && NK.premium !== true) return;
        const st = isHd(key) ? STAR[name] : null;
        add({ id: 'nk:' + key, engine: 'nk', key, name, g, ch: st ? st.c : '', q: isHd(key) ? 5 : 4, group: 'pro', hd: isHd(key),
          about: isHd(key) ? `Голос Google Chirp 3 HD${st ? ' — ' + st.c : ''}: один из самых естественных. Работает на любом устройстве, без ключей. Входит в Norsk Kort Pro.`
            : 'Живой голос Google (WaveNet) на сервере Norsk Kort: работает на любом устройстве, без ключей и настроек. Озвученная фраза остаётся на устройстве. Входит в Norsk Kort Pro.' });
      });
    }
    // Piper (offline) — the public build: only voices whose licence allows a paid app
    Object.entries(PIPER).forEach(([key, p]) => {
      if (p.lang !== lang) return;
      if (pub && !piperCommercial(key)) return;
      const sp = window.Speech && Speech.piper && Speech.piper.VOICES ? Speech.piper.VOICES[key] : null;
      add({ id: 'piper:' + key, engine: 'piper', key, name: p.name, g: p.g, q: p.q, about: p.about, size: sp ? sp[1] + sp[2] : 0,
        licence: sp ? sp[3] : '', speakers: p.speakers || null, stress: !!p.stress, group: 'offline' });
    });
    if (!pub) {
      // Google Translate (online, unofficial) and Edge (the Mac bridge, unofficial): only on the owner's Mac
      add({ id: 'gtr:' + lang, engine: 'gtr', key: lang, name: 'Google', g: F, q: 3, group: 'online', about: 'Голос Google Переводчика: один на язык, без выбора. Неофициальный — изредка может не отвечать. Только в версии для Mac.' });
      EDGE_VOICES[lang].forEach(([key, name, g]) => add({ id: 'edge:' + key, engine: 'edge', key, name, g, q: 5, group: 'mac', about: 'Нейроголос Microsoft — бесплатно, через мост на Mac. Неофициальный сервис, для личного использования.' }));
    }
    // your own key
    MS_VOICES[lang].forEach(([key, name, g]) => add({ id: 'azure:' + key, engine: 'azure', key, name, g, q: 5, group: 'key', about: 'Официальный нейроголос Microsoft Azure.' }));
    gList(lang).forEach(([key, name, g]) => {
      const st = /Chirp3-HD-/.test(key) ? STAR[name] : null;
      add({ id: 'gcloud:' + key, engine: 'gcloud', key, name, g, ch: st ? st.c : '', q: /Chirp/.test(key) ? 5 : /Wavenet|Neural2|Studio/.test(key) ? 4 : 3, group: 'key',
        about: /Chirp3/.test(key) ? `Google Chirp 3 HD — ${st ? st.c + ' голос, ' : ''}один из самых естественных голосов Google. Бесплатно 1 млн знаков в месяц; приложение само остановится на вашем потолке.`
          : /Wavenet|Standard/.test(key) ? 'Голос Google Cloud попроще (WaveNet / Standard): свой бесплатный лимит — 4 млн знаков в месяц.' : 'Голос Google Cloud.' });
    });
    GEM_VOICES[lang].forEach(([key, name, g]) => add({ id: 'gemini:' + key, engine: 'gemini', key, name, g, ch: (STAR[name] || {}).c || '', q: 5, group: 'key',
      about: `Голос Google через Gemini — ${(STAR[name] || {}).c || 'живой'} голос. Тот же голос, что в Google Cloud, но по ключу AI Studio без карты. Только для себя: бесплатно лишь несколько десятков новых фраз в день.` }));
    ((Voices.custom.eleven && Voices.custom.eleven[lang]) || ENGINES.eleven.voices[lang]).forEach(([key, name, g]) => add({ id: 'eleven:' + key, engine: 'eleven', key, name, g, q: 5, group: 'key', about: 'Очень живой голос ElevenLabs (модель Flash v2.5, говорит на 32 языках).' }));
    // the device
    sysList(lang).forEach(v => {
      const q = TTS.voiceQuality(v);
      add({ id: 'sys:' + v.name, engine: 'sys', key: v.name, name: v.name.replace(/\s*\((улучшенный|высшего качества|Enhanced|Premium)\)\s*/i, ''), g: gOf(v.name + ' ' + v.voiceURI),
        q, group: 'device', local: v.localService !== false, about: v.localService === false ? 'Онлайн-голос браузера.' : 'Голос, установленный на этом устройстве.' });
    });
    return out;
  }

  /* ---------- the settings model ---------- */
  function migrate() {
    const s = S(), eng = s.ttsEngine || 'auto', cv = s.cloudVoices || {};
    const out = { _v: 1 };
    LANGS.forEach(l => {
      const sysName = l === 'no' ? s.voiceNo : l === 'uk' ? s.voiceUk : s.voiceRu;
      let pick = '';
      const dflt = e => (e === 'edge' || e === 'azure' ? MS_DEFAULT[l] : ((((ENGINES[e] || {}).voices || {})[l] || [])[0] || [])[0] || '');
      const old = (cv[eng] || {})[l];
      // a Microsoft voice of another language (an old setting) never reads this one
      if (NET.includes(eng)) pick = eng + ':' + (old && langOfVoice(eng, old, l) === l ? old : dflt(eng));
      else if (eng === 'piper') pick = l === 'no' ? 'piper:no_NO-talesyntese-medium' : sysName ? 'sys:' + sysName : '';
      else if (eng === 'google') pick = 'gtr:' + l;
      else if (eng === 'browser') pick = 'sys:' + (sysName || '');
      else if (sysName) pick = 'sys:' + sysName;   // «Авто» with a voice chosen by hand: that voice stays
      out[l] = { pick, chain: 'auto' };
    });
    return out;
  }
  function model() {
    if (!window.Store || !Store.state) return { _v: 1, no: { pick: '', chain: 'auto' }, uk: { pick: '', chain: 'auto' }, ru: { pick: '', chain: 'auto' } };
    let v = Store.settings.voices;
    if (!v || !v._v) { v = migrate(); Store.settings.voices = v; try { Store.save(); } catch (e) { /* saved with the next change */ } }
    LANGS.forEach(l => { if (!v[l]) v[l] = { pick: '', chain: 'auto' }; });
    fixOld(v);
    return v;
  }
  /** Google retired uk-UA-Wavenet-A / Standard-A: a pick of them becomes the «-B» voice (once) */
  function fixOld(v) {
    const s = S(), cv = s.cloudVoices || {};
    const fix = id => String(id || '').replace(/uk-UA-(Wavenet|Standard)-A\b/, (x, t) => G_OLD['uk-UA-' + t + '-A'])
      .replace(/^edge:(nb-NO-IselinNeural|ru-RU-DariyaNeural)$/, (x, k) => 'edge:' + EDGE_ONLY_AZURE[k]); // not in free Edge
    if (!/uk-UA-(Wavenet|Standard)-A\b|edge:(nb-NO-IselinNeural|ru-RU-DariyaNeural)/.test(JSON.stringify([v, cv.gcloud, s.voicesBy]))) return;
    LANGS.forEach(l => {
      if (!v[l]) return;
      v[l].pick = fix(v[l].pick);
      if (Array.isArray(v[l].chain)) v[l].chain = v[l].chain.map(fix);
    });
    if (cv.gcloud && cv.gcloud.uk) cv.gcloud.uk = fix(cv.gcloud.uk);
    Object.values(s.voicesBy || {}).forEach(e => { if (e) LANGS.forEach(l => { if (e[l]) e[l] = fix(e[l]); }); });
    try { Store.save(); } catch (e) { /* saved with the next change */ }
  }
  function saveModel(v) { Store.setSetting('voices', JSON.parse(JSON.stringify(v))); document.dispatchEvent(new CustomEvent('voices-pick', { detail: {} })); }
  /** 📍 { place: { no|uk|ru: 'engine:voice' } } — only the overrides (no entry = «как везде») */
  function byPlace() { const b = S().voicesBy; return b && typeof b === 'object' && !Array.isArray(b) ? b : {}; }

  const Voices = {
    ENGINES, CLOUD, AUDIO, NET, KEYED, LANGS, LANG_NAME, FLAG, LC, SAMPLE, QUALITY, PIPER, MS_DEFAULT, MONTHS, MONTHS_IN,
    Clips, Usage, Health, Edge, parse, onMac, macBridge, publicBuild, PLACES, normPlace, Limits, GEM, STAR, G_VOICES, Gate,
    NK, NK_VOICES, icon, langMark, ensureCss, piperCommercial,
    /** Norsk Kort Pro voices: the server is set up here / this person has Pro now */
    nkOffered() { return NK.offered(); },
    nkPro() { return NK.pro(); },
    /** an <audio> that may start even long after the tap (see «🔓» above) — for any voice clip of the app */
    audio: takeAudio,
    custom: {}, // ElevenLabs: voices loaded from the user's own library
    isCloud(id) { return CLOUD.includes(id); },
    entries,
    /** the entry of a voice id (piper speaker ids resolve to their model's entry) */
    entry(id, lang) {
      const p = parse(id);
      if (!lang) lang = langOfVoice(p.engine, p.key, 'no') || 'no';
      if (p.engine === 'sys' && !p.key) { const v = window.TTS && TTS.pickVoice(lang); return v ? entries(lang).find(e => e.id === 'sys:' + v.name) || null : null; }
      const base = p.engine === 'piper' ? 'piper:' + p.key : id;
      return entries(lang).find(e => e.id === base) || null;
    },
    /** the voice of an engine for a language: the language's pick when it is this engine, else the last one chosen */
    voice(engine, lang, place) {
      const pp = this.placePick(place, lang);
      if (pp) { const p = parse(pp); if (p.engine === engine) return p.key + (p.spk ? '#' + p.spk : ''); }
      const v = window.Store && Store.state ? model()[lang] : null;
      if (v && v.pick) { const p = parse(v.pick); if (p.engine === engine) return p.key + (p.spk ? '#' + p.spk : ''); }
      const pref = ((S().cloudVoices || {})[engine] || {})[lang];
      if (pref && !(engine === 'nk' && isHd(pref) && NK.premium !== true)) return pref;
      if (engine === 'piper') {
        const ks = Object.keys(PIPER).filter(k => PIPER[k].lang === lang);
        return ks.find(k => this.piperReady(k)) || ks[0] || '';
      }
      if (engine === 'edge' || engine === 'azure') return MS_DEFAULT[lang] || '';
      if (engine === 'nk') { const l = NK_VOICES[lang] || []; const ok = l.find(x => !isHd(x[0]) || NK.premium === true); return ok ? ok[0] : ''; }
      const list = (this.custom[engine] && this.custom[engine][lang]) || ((ENGINES[engine] || {}).voices || {})[lang] || [];
      return (list[0] || [])[0] || '';
    },
    piperReady(key) { return !!(window.Speech && Speech.piper && Speech.piper.isReady(key)); },
    /** engine set up / reachable (sync) */
    ready(engine) {
      const s = S();
      if (engine === 'piper') return !!(window.Speech && Speech.piper.available());
      if (engine === 'edge') return !publicBuild() && macBridge() && !Edge.old && Edge.installed !== false;
      if (engine === 'nk') return NK.pro();
      if (engine === 'gtr') return !publicBuild();
      if (engine === 'azure') return !!(s.azureKey || '').trim() && !!(s.azureRegion || '').trim();
      if (engine === 'gcloud') return !!(s.gcloudKey || '').trim();
      if (engine === 'gemini') return !!(s.geminiKey || '').trim();
      if (engine === 'eleven') return !!(s.elevenKey || '').trim();
      return true;
    },
    /** can this voice speak right now? → { ok, why } — why: site | bridge | install | key | badkey | quota | down |
     *  offline | download | nosupport | nosys | old (the Mac bridge must be restarted once) | stale (Edge must be updated) |
     *  billing (Google Cloud: no billing account) | blocked (ElevenLabs paused the free plan) | region | nolang (Gemini: no Ukrainian)
     *  public (a Mac-only voice in the public build) | licence (a Piper voice not for a paid app) | noserver | nopremium
     *  (Chirp 3 HD switched off on the server) | pro (Norsk Kort Pro needed) | consent (declined this session) | hdquota */
    avail(id, lang) {
      const { engine, key } = parse(id);
      if (engine === 'sys') return (key ? sysList(lang || 'no').some(v => v.name === key) : !!(window.TTS && TTS.pickVoice(lang || 'no'))) ? { ok: true } : { ok: false, why: 'nosys' };
      if (engine === 'gtr') return publicBuild() ? { ok: false, why: 'public' } : online() ? { ok: true } : { ok: false, why: 'offline' };
      if (engine === 'piper') {
        if (publicBuild() && !piperCommercial(key)) return { ok: false, why: 'licence' };
        if (!window.Speech || !Speech.piper || !Speech.piper.available()) return { ok: false, why: 'nosupport' };
        return Speech.piper.isReady(key) ? { ok: true } : { ok: false, why: 'download' };
      }
      if (engine === 'nk') {
        // a free user never reaches the server: no Pro → not available (nothing is sent)
        if (!NK.offered()) return { ok: false, why: 'noserver' };
        if (isHd(key) && NK.premium !== true) return { ok: false, why: 'nopremium' };
        if (!NK.pro()) return { ok: false, why: 'pro' };
        if (NK.declined) return { ok: false, why: 'consent' };
        if (isHd(key) && NK.hdOut > Date.now()) return { ok: false, why: 'hdquota' };
        if (!online()) return { ok: false, why: 'offline' };
        const h = Health.state('nk');
        return h ? { ok: false, why: h } : { ok: true };
      }
      if (engine === 'edge') {
        if (publicBuild()) return { ok: false, why: 'public' };
        if (!onMac()) return { ok: false, why: 'site' };
        if (!macBridge()) return { ok: false, why: 'bridge' };
        if (Edge.old) return { ok: false, why: 'old' };
        if (Edge.installed === false) return { ok: false, why: 'install' };
        if (Edge.stale) return { ok: false, why: 'stale' };
      } else if (engine === 'gemini' && !GEM.LANGS.includes(lang || 'no')) return { ok: false, why: 'nolang' };
      else if (KEYED.includes(engine) && !this.ready(engine)) return { ok: false, why: 'key' };
      if (!online()) return { ok: false, why: 'offline' };
      const h = Health.state(engine);
      if (h) return { ok: false, why: h };
      // our own ceiling (Google Cloud) / the day's requests (Gemini): the voice rests until the limit comes back
      return KEYED.includes(engine) && Limits.over(Limits.meter(engine, key)) ? { ok: false, why: 'quota' } : { ok: true };
    },
    /** what the user chose for a language ('' = «Авто»); with a place: its own voice first */
    pickOf(lang, place) { return this.placePick(place, lang) || model()[lang].pick || ''; },
    /** the voice that is meant to read this language now (here): the pick, or «Авто» = recommend() */
    current(lang, place) { return this.pickOf(lang, place) || this.recommend(lang); },

    /* ---------- 📍 a voice per place ---------- */
    /** the place's own voice for a language ('' = «как везде») */
    placePick(place, lang) {
      place = normPlace(place);
      if (!place || !window.Store || !Store.state) return '';
      const e = byPlace()[place], v = e && e[lang];
      return typeof v === 'string' && v ? v : '';
    },
    /** id '' = «как везде» again */
    setPlacePick(place, lang, id) {
      place = normPlace(place);
      if (!place || !LANGS.includes(lang)) return;
      const all = JSON.parse(JSON.stringify(byPlace()));
      const e = Object.assign({}, all[place] || {});
      if (id) e[lang] = String(id); else delete e[lang];
      if (Object.keys(e).length) all[place] = e; else delete all[place];
      Store.setSetting('voicesBy', all);
      document.dispatchEvent(new CustomEvent('voices-pick', { detail: { place, lang } }));
    },
    /** «Сбросить — везде одинаково» */
    resetPlaces() { Store.setSetting('voicesBy', {}); document.dispatchEvent(new CustomEvent('voices-pick', { detail: { place: '*' } })); },
    /** how many places have a voice of their own (in any language) */
    placeCount() { return PLACE_IDS.filter(p => LANGS.some(l => this.placePick(p, l))).length; },
    placeInfo(place) { return PLACES.find(p => p.id === normPlace(place)) || null; },
    /**
     * Which place is speaking now, read from the screen (callers that say nothing): the window on top (the reader, a
     * dialogue, the subtitle player, news…; the voice chooser itself is skipped), a full-screen video, then the screen
     * (a card session / a deck → cards), then the running 🎧 player. '' (or fallback) = nowhere special → «как везде».
     */
    place(fallback) {
      try {
        const bds = [...document.querySelectorAll('#modal-root > .modal-backdrop:not(.closing), #modal-root > :not(.modal-backdrop):not(.closing)')].reverse();
        const cls = el => String(el.className || '') + ' ' + [...el.children].map(c => String(c.className || '')).join(' ');
        for (let i = 0; i < bds.length; i++) {
          const c = cls(bds[i]);
          if (/\bvp-modal\b/.test(c)) continue;
          const pl = placeOfClass(c);
          if (!pl) continue;
          // the shared subtitle player (and its own small windows) opened from the news / radio or a Telegram author: that place
          if (pl === 'video') {
            const under = bds.slice(i + 1).map(b => placeOfClass(cls(b))).find(Boolean);
            if (under === 'news' || under === 'telegram') return under;
          }
          return pl;
        }
        const fs = document.fullscreenElement || document.webkitFullscreenElement;
        if (fs && (fs.tagName === 'VIDEO' || (fs.querySelector && fs.querySelector('video')))) return 'video';
        const v = window.App && App.view && App.view.name;
        if (v === 'study' || v === 'deck' || v === 'levels') return 'cards';
        if (window.Listen && Listen.p && Listen.p.playing) return 'listen';
      } catch (e) { /* no screen yet */ }
      return normPlace(fallback);
    },
    /** the device's voice a place reads with (for callers that speak with the device's voice directly) */
    sysKey(lang, place) { const p = parse(this.current(lang, place)); return p.engine === 'sys' ? p.key : ''; },
    /** the best free voice that works here right now (plan §4) */
    recommend(lang) {
      return this.autoChain(lang).find(id => this.avail(id, lang).ok) || (lang === 'uk' && !publicBuild() ? 'gtr:uk' : 'sys:');
    },
    /** may «Авто» use Norsk Kort Pro now (Pro + the AI consent already given — the auto chain never opens a sheet) */
    nkAuto() { return NK.pro() && NK.consent() && !NK.declined; },
    /**
     * «Авто» order.
     * The Mac with the bridge (as before): Edge (free without a limit) → keyed services (Azure → Google Cloud → ElevenLabs →
     *   Gemini; one over 90 % of its limit goes last) → Norsk Kort Pro → the device's best Apple voice (premium / enhanced;
     *   Ukrainian: after Piper) → downloaded Piper voices → Google Translate → a weak device voice.
     * Everywhere else (phones, the site, the store apps): a good device voice → Norsk Kort Pro (Pro + consent) → own keys →
     *   downloaded Piper voices → a weak device voice (on the Mac without the bridge: Google Translate before it).
     *   A Pro user whose device voice is poor hears Pro first.
     * g: the gender to keep when a service's voice was not chosen by hand (♀ stays ♀).
     */
    autoChain(lang, g) {
      const out = [];
      const mac = macBridge() && !publicBuild();
      const keyed = ['azure', 'gcloud', 'eleven', 'gemini'].filter(e => this.ready(e) && this.voice(e, lang));
      const late = e => (Limits.pct(Limits.meter(e, this.voice(e, lang))) >= 0.9 ? 1 : 0);
      keyed.sort((a, b) => late(a) - late(b));
      const nk = this.nkAuto() && this.voice('nk', lang) ? 'nk:' + this.voiceOfEngine('nk', lang, g) : '';
      const sv = window.TTS && TTS.pickVoice(lang);
      const sq = sv ? TTS.voiceQuality(sv) : 0;
      const pg = k => (g && PIPER[k].g === g ? 1 : 0);
      const pipers = Object.keys(PIPER).filter(k => PIPER[k].lang === lang && this.piperReady(k) && (!publicBuild() || piperCommercial(k)))
        .sort((a, b) => PIPER[b].q - PIPER[a].q || pg(b) - pg(a)).map(k => 'piper:' + k + (this._spkOf(k) ? '#' + this._spkOf(k) : ''));
      if (mac) {
        // Edge only once the bridge said edge-tts is there (a missing module is never tried «just in case»)
        if (Edge.installed === true) out.push('edge:' + this.voiceOfEngine('edge', lang, g));
        keyed.forEach(e => out.push(e + ':' + this.voiceOfEngine(e, lang, g)));
        if (nk) out.push(nk);
        const sysFirst = sv && (sq >= 4 || (sq >= 3 && lang !== 'uk'));
        if (sysFirst) out.push('sys:' + sv.name);
        pipers.forEach(id => out.push(id));
        if (sv && sq >= 3 && !sysFirst) out.push('sys:' + sv.name);
        out.push('gtr:' + lang);
        if (sv && sq < 3) out.push('sys:' + sv.name);
        return out;
      }
      const sysGood = sv && sq >= 3;
      if (sysGood) out.push('sys:' + sv.name);
      if (nk) out.push(nk);
      keyed.forEach(e => out.push(e + ':' + this.voiceOfEngine(e, lang, g)));
      pipers.forEach(id => out.push(id));
      if (!publicBuild()) out.push('gtr:' + lang);
      if (sv && !sysGood) out.push('sys:' + sv.name);
      return out;
    },
    /** the voice of an engine for a language; g: a voice of this gender when the engine's voice was never chosen by hand */
    voiceOfEngine(engine, lang, g) {
      let v = this.voice(engine, lang);
      // a Microsoft voice of another language (an old setting) never reads this one
      if ((engine === 'edge' || engine === 'azure') && langOfVoice(engine, v, lang) !== lang) v = MS_DEFAULT[lang];
      const pk = window.Store && Store.state ? parse(model()[lang].pick) : { engine: '' };
      const mine = !!(((S().cloudVoices || {})[engine] || {})[lang]) || pk.engine === engine;
      if (g && !mine && engine !== 'piper') {
        let list = (this.custom[engine] && this.custom[engine][lang]) || (engine === 'gcloud' ? gList(lang) : ((ENGINES[engine] || {}).voices || {})[lang]) || [];
        if (engine === 'nk') list = list.filter(x => !isHd(x[0]) || NK.premium === true);
        const cur = list.find(x => x[0] === v);
        if (cur && cur[2] && cur[2] !== g) { const same = list.find(x => x[2] === g); if (same) v = same[0]; }
      }
      return v;
    },
    /** the same voice at another service: Azure ↔ Edge (Microsoft), Google Cloud Chirp 3 HD ↔ Gemini (Google's star voices) */
    twin(id, lang) {
      const p = parse(id);
      if (p.engine === 'azure') return EDGE_ONLY_AZURE[p.key] ? '' : 'edge:' + p.key; // Iselin / Дарья: no free Edge twin
      if (p.engine === 'edge') return 'azure:' + p.key;
      const m = p.engine === 'gcloud' && /-Chirp3-HD-(\w+)$/.exec(p.key);
      if (m) return GEM.LANGS.includes(lang) ? 'gemini:' + m[1] : '';
      if (p.engine === 'gemini') { const k = LOC[lang] + '-Chirp3-HD-' + p.key; return gList(lang).some(x => x[0] === k) ? 'gcloud:' + k : ''; }
      return '';
    },
    _spkOf(key) { const p = PIPER[key]; if (!p || !p.speakers) return ''; const v = ((S().cloudVoices || {}).piperSpk || {})[key]; return v || Object.keys(p.speakers)[0]; },
    /** the voices tried in turn for a language (only those that can work now; never a voice of another language) */
    chain(lang, only, place) {
      if (only) return [only];
      const conf = model()[lang].chain;
      // 📍 the place's own voice, then the voice «как везде» (each with its twin at the other service), then the fallbacks
      const own = this.placePick(place, lang), cur = this.current(lang);
      const fe = this.entry(own || cur, lang), g = fe ? fe.g : '';
      const rest = Array.isArray(conf) && conf.length ? conf : this.autoChain(lang, g);
      const seen = new Set();
      return [own, own && this.twin(own, lang), cur, this.twin(cur, lang)].concat(rest).filter(id => {
        if (!id || seen.has(id)) return false;
        seen.add(id);
        const p = parse(id);
        if (langOfVoice(p.engine, p.key, lang) !== lang) return false;
        return this.avail(id, lang).ok;
      });
    },
    /** the audio engine that reads this language first (for the 🎧 player and deck files) — '' when it is the device / Google.
     *  Gemini is skipped here: its few dozen phrases a day are for cards, not for whole decks read aloud */
    audioEngine(lang, place) {
      const id = this.chain(lang, '', place).find(x => parse(x).engine !== 'gemini');
      const p = parse(id || '');
      return AUDIO.includes(p.engine) ? p.engine : '';
    },
    /** «Светлана · Microsoft Edge» */
    label(lang, id, place) {
      id = id || this.current(lang, place);
      const p = parse(id), e = this.entry(id, lang);
      const eng = (ENGINES[p.engine] || {}).short || p.engine;
      if (!e) return p.engine === 'sys' ? 'Голос устройства' : eng;
      const spk = p.spk && e.speakers ? ' · ' + (e.speakers[p.spk] || p.spk) : '';
      return p.engine === 'gtr' || (p.engine === 'sys' && !p.key) ? eng : `${e.name}${spk} · ${eng}`;
    },
    setPick(lang, id) {
      const v = model();
      v[lang] = Object.assign({}, v[lang], { pick: id || '' });
      const p = parse(id || '');
      // keep the older settings in step (other screens still read them)
      if (p.engine === 'sys' && p.key) Store.settings[lang === 'no' ? 'voiceNo' : lang === 'uk' ? 'voiceUk' : 'voiceRu'] = p.key;
      if (AUDIO.includes(p.engine) && p.key) {
        const cv = Object.assign({}, S().cloudVoices || {});
        cv[p.engine] = Object.assign({}, cv[p.engine] || {}, { [lang]: p.key });
        if (p.engine === 'piper' && p.spk) cv.piperSpk = Object.assign({}, cv.piperSpk || {}, { [p.key]: p.spk });
        Store.settings.cloudVoices = cv;
      }
      saveModel(v);
    },
    setChain(lang, list) { const v = model(); v[lang] = Object.assign({}, v[lang], { chain: Array.isArray(list) && list.length ? list.slice() : 'auto' }); saveModel(v); },
    chainConf(lang) { return model()[lang].chain; },
    /** a downloaded voice was deleted: a pick that used it goes back to «Авто» */
    onRemoved(id) {
      const v = model(), base = parse(id).engine + ':' + parse(id).key;
      LANGS.forEach(l => { const p = parse(v[l].pick); if (v[l].pick && p.engine + ':' + p.key === base) v[l].pick = ''; });
      PLACE_IDS.forEach(pl => LANGS.forEach(l => { const id2 = this.placePick(pl, l); if (id2) { const p = parse(id2); if (p.engine + ':' + p.key === base) this.setPlacePick(pl, l, ''); } }));
      saveModel(v);
      [...mem.keys()].filter(k => k.startsWith('piper|')).forEach(k => { URL.revokeObjectURL(mem.get(k).url); mem.delete(k); });
    },

    /* ---------- making audio ---------- */
    /** text -> blob URL of the audio (kept). voiceOverride: the vendor's voice key (piper: model#speaker) */
    async synth(engine, text, lang, rate, voiceOverride) { return (await this.clip(engine, text, lang, rate, voiceOverride)).url; },
    /** text -> { url, marks? } — memory, then the device's clip store, then the engine (with a time limit) */
    async clip(engine, text, lang, rate, voiceOverride, limitMs) {
      const voice = voiceOverride || this.voice(engine, lang);
      // Gemini and Chirp 3 HD (Pro) have no speed setting: one clip for every speed (played faster / slower)
      const fixed = engine === 'gemini' || (engine === 'nk' && isHd(voice));
      const key = [engine, voice, lang, fixed ? '0.90' : engine === 'nk' ? (NK.rate(rate) * 0.9).toFixed(2) : (+rate || 0.9).toFixed(2), text].join('|');
      if (mem.has(key)) return mem.get(key);
      if (!inflight.has(key)) {
        const job = (async () => {
          if (NET.includes(engine)) {
            const hit = await Clips.get(key);
            if (hit) { const r = { url: URL.createObjectURL(hit.blob), marks: hit.marks || null, cached: true }; mem.set(key, r); return r; }
          }
          const made = await this._make(engine, text, lang, rate, voice);
          // a Pro clip whose file could not be read here: its signed link (1 hour) plays directly, it is just not kept
          if (!made.blob) return { url: made.url, marks: null, remote: true };
          const { blob, marks } = made;
          const r = { url: URL.createObjectURL(blob), marks: marks || null };
          mem.set(key, r);
          if (NET.includes(engine)) {
            Clips.put(key, blob, marks);
            // our own count only for keys on this device (the Pro server counts its own characters)
            if (engine !== 'edge' && engine !== 'nk') { const mt = Limits.meter(engine, voice); Usage.add(mt, text.length); this.limitCheck(mt); }
          }
          return r;
        })();
        inflight.set(key, job);
        job.then(() => inflight.delete(key), () => inflight.delete(key));
      }
      const job = inflight.get(key);
      if (!limitMs) return job;
      // too slow: the next voice takes over (the clip still arrives and is kept for next time)
      return new Promise((res, rej) => {
        const t = setTimeout(() => rej(err('timeout', 'голос не ответил вовремя')), limitMs);
        job.then(r => { clearTimeout(t); res(r); }, e => { clearTimeout(t); rej(e); });
      });
    },
    async _make(engine, text, lang, rate, voice) {
      const s = S();
      if (!voice && engine !== 'piper') throw err('voice', 'нет голоса для этого языка');
      const a = this.avail(engine + ':' + String(voice).split('#')[0], lang);
      if (!a.ok && a.why !== 'down') throw err(a.why, 'голос сейчас недоступен');
      const net = async (url, o) => {
        try { return await fetch(url, o); } catch (e) { throw err('net', 'нет связи с сервисом'); }
      };
      if (engine === 'piper') {
        const [model, spk] = String(voice || '').split('#');
        try { return { blob: await Speech.piper.synth(text, rate, { voice: model, speaker: spk }) }; }
        catch (e) {
          // the browser removed the voice's files (storage cleared): the card offers «⬇ Скачать» again
          if (/не найден/.test(e && e.message)) { try { await Speech.piper.status(model); document.dispatchEvent(new CustomEvent('voices-changed')); } catch (e2) { /* ignore */ } throw err('download', 'офлайн-голос нужно скачать заново'); }
          throw err('piper', 'офлайн-голос не смог прочитать текст');
        }
      }
      if (engine === 'edge') {
        const r = await net(`/api/tts?voice=${encodeURIComponent(voice)}&rate=${encodeURIComponent(pct(rate))}&marks=1&text=${encodeURIComponent(text)}`);
        if (r.status === 501) { Edge.installed = false; throw err('install', 'на Mac не установлен модуль edge-tts'); }
        if (!r.ok) {
          // Microsoft changed its protection (Oct 2026: «403 Invalid response status») — the bridge's edge-tts must be updated
          const j = r.status === 502 ? await r.json().catch(() => ({})) : {};
          if (/\b403\b|Invalid response status|Sec-MS-GEC/i.test(String(j.error || ''))) { Edge.stale = true; throw err('stale', 'голоса Edge нужно обновить'); }
          throw err(r.status === 400 ? 'voice' : 'net', 'голоса Edge сейчас недоступны');
        }
        Edge.installed = true; Edge.stale = false;
        if (/json/.test(r.headers.get('content-type') || '')) {
          const j = await r.json();
          const marks = [];
          let cur = 0;
          (j.marks || []).forEach(m => { const w = String(m.text || ''); const i = w ? text.indexOf(w, cur) : -1; if (i >= 0) { marks.push({ t: +m.t || 0, c: i }); cur = i + w.length; } });
          return { blob: b64blob(j.audio, 'audio/mpeg'), marks };
        }
        return { blob: await r.blob() };
      }
      if (engine === 'azure') {
        const region = String(s.azureRegion || '').trim().toLowerCase().replace(/\s+/g, '');
        await Gate.take('azure', 18); // F0: 20 requests a minute — a deck read ahead is spread out, never a 429
        const ssml = `<speak version='1.0' xml:lang='${voice.slice(0, 5)}'><voice name='${voice}'><prosody rate='${pct(rate)}'>${xml(text)}</prosody></voice></speak>`;
        const r = await net(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: 'POST', body: ssml,
          headers: { 'Ocp-Apim-Subscription-Key': String(s.azureKey || '').trim(), 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3' },
        });
        if (!r.ok) {
          const body = await r.text().catch(() => '');
          if (r.status === 401) throw err('badkey', 'ключ или регион не подходят');
          if (/quota/i.test(body) || r.status === 403) throw err('quota', 'бесплатный лимит на этот месяц закончился');
          throw err(r.status === 429 ? 'rate' : 'net', 'сервис сейчас не ответил');
        }
        return { blob: await r.blob() };
      }
      if (engine === 'gcloud') {
        // our own ceiling: past Google's free amount money would be charged — the voice stops a little before it
        const mt = Limits.meter('gcloud', voice);
        if (Usage.get(mt) + text.length > Limits.cap(mt)) throw err('quota', 'достигнут месячный потолок');
        // the key travels in a header, never in the address (addresses end up in logs)
        const r = await net('https://texttospeech.googleapis.com/v1/text:synthesize', {
          method: 'POST', headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': String(s.gcloudKey || '').trim() },
          body: JSON.stringify({ input: { text }, voice: { languageCode: voice.slice(0, 5), name: voice }, audioConfig: { audioEncoding: 'MP3', speakingRate: Math.max(0.25, Math.min(2, rate / 0.9)) } }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw this._gErr(r.status, j);
        return { blob: b64blob(j.audioContent, 'audio/mpeg') };
      }
      if (engine === 'gemini') return this._gemini(text, lang, voice);
      if (engine === 'nk') return this._nk(text, lang, rate, voice);
      if (engine === 'eleven') {
        // with timestamps: the words light up exactly (character alignment → word starts)
        const r = await net(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/with-timestamps?output_format=mp3_44100_128`, {
          method: 'POST', headers: { 'xi-api-key': String(s.elevenKey || '').trim(), 'content-type': 'application/json' },
          body: JSON.stringify({ text, model_id: 'eleven_flash_v2_5', language_code: lang === 'no' ? 'no' : lang === 'uk' ? 'uk' : 'ru', voice_settings: { speed: Math.max(0.7, Math.min(1.2, rate / 0.9)) } }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          const st = String((j.detail && (j.detail.status || j.detail.message)) || '');
          if (/quota/i.test(st)) throw err('quota', 'бесплатный лимит на этот месяц закончился');
          // the free plan paused for «unusual activity» (often a VPN) — the key itself is fine
          if (/unusual_activity|unusual activity/i.test(st)) throw err('blocked', 'бесплатный тариф приостановлен');
          if (r.status === 401) throw err('badkey', 'ключ не подходит');
          throw err(r.status === 429 ? 'rate' : 'net', 'сервис сейчас не ответил');
        }
        const al = j.alignment || j.normalized_alignment || {};
        const ch = al.characters || [], t0 = al.character_start_times_seconds || [];
        const marks = [];
        if (window.TTS && ch.length === t0.length && ch.length) TTS.wordsOf(text).forEach(w => { if (w.s < t0.length) marks.push({ t: t0[w.s], c: w.s }); });
        return { blob: b64blob(j.audio_base64, 'audio/mpeg'), marks };
      }
      throw err('voice', 'неизвестный голос');
    },
    /** Norsk Kort Pro: POST tts (Net asks the AI consent itself) → the signed link → the clip as a blob (kept on the device) */
    async _nk(text, lang, rate, voice) {
      if (!window.Net || !Net.callFn) throw err('noserver', 'голоса сервера недоступны');
      if (!NK.pro()) throw err('pro', 'нужен Norsk Kort Pro'); // never a paid call for a free user
      if (text.length > 1500) throw err('voice', 'слишком длинный текст для одного фрагмента');
      const hd = isHd(voice);
      let j;
      try { j = await Net.callFn('tts', { text, lang, voice, rate: hd ? 1 : NK.rate(rate) }, { feature: 'Голоса Norsk Kort Pro' }); }
      catch (e) { throw this._nkErr(e, hd); }
      if (!j || typeof j.url !== 'string' || !/^https?:/.test(j.url)) throw err('net', 'сервер не прислал звук');
      try {
        const r = await fetch(j.url, { cache: 'no-store', credentials: 'omit' });
        if (!r.ok) throw new Error('clip');
        const blob = await r.blob();
        if (blob.size < 200) throw new Error('clip');
        return { blob };
      } catch (e) { return { url: j.url }; }
    },
    /** the server's NetError → why (the person never sees technical text) */
    _nkErr(e, hd) {
      const c = (e && e.code) || '';
      if (c === 'no_entitlement') return err('pro', 'нужен Norsk Kort Pro');
      if (c === 'consent') return err('consent', 'без согласия голоса сервера не используются');
      if (c === 'signed_out' || c === 'unauthenticated') return err('signin', 'нужно войти');
      if (c === 'cap_reached') {
        const t = Date.parse((e && (e.resetsAt || (e.details && e.details.resets_at))) || '');
        if (e.details && e.details.cap === 'tts_premium') { NK.hdOut = Number.isFinite(t) ? t : nextMonth(); return Object.assign(err('hdquota', 'лимит голосов HD на месяц исчерпан'), { resetsAt: NK.hdOut }); }
        return Object.assign(err('quota', 'месячный лимит голосов Pro исчерпан'), { resetsAt: Number.isFinite(t) ? t : nextMonth() });
      }
      if (c === 'rate_limited') return err('rate', 'слишком много запросов подряд');
      if (c === 'bad_input' && e.key === 'err.badVoice') { if (hd) { NK.premium = false; ls.set('nk-tts-health', { t: Date.now(), premium: false, server: NK.server }); } return err('voice', 'этот голос сейчас недоступен'); }
      if (c === 'offline') return err('offline', 'нет интернета');
      if (c === 'not_configured') return err('noserver', 'голоса сервера недоступны');
      return err('net', 'сервер сейчас не ответил');
    },
    /** Google Cloud's error answer → why. 429 is a per-minute limit (Google has no «month is over»: it bills) */
    _gErr(status, j) {
      const e = j && j.error || {}, m = String((e.status || '') + ' ' + (e.message || '') + ' ' + JSON.stringify(e.details || ''));
      if (status === 429) return err('rate', 'слишком много запросов в минуту');
      if (/BILLING_DISABLED|billing/i.test(m)) return err('billing', 'в проекте Google Cloud не подключена оплата');
      if (status === 401 || /API_KEY_INVALID|API key not valid|API key expired/i.test(m) || (status === 403 && /PERMISSION_DENIED|SERVICE_DISABLED|API_KEY/i.test(m))) return err('badkey', 'ключ не подходит');
      if (status === 400) return err('voice', 'сервис не принял запрос');
      return err('net', 'сервис сейчас не ответил');
    },
    /** ✦ Gemini TTS (REST generateContent): the models in turn, each with its own day; the answer is 24 kHz PCM → WAV */
    async _gemini(text, lang, voice) {
      const key = String(S().geminiKey || '').trim();
      for (let guard = 0; guard < 8; guard++) {
        const model = GEM.usable()[0];
        if (!model) throw err('quota', 'бесплатный лимит Gemini на сегодня закончился');
        await Gate.take('gemini:' + model, GEM.RPM, 3); // the limits are per model
        const sc = { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } };
        if (!GEM.noLang) sc.languageCode = LOC[lang];
        let r;
        try {
          r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: sc } }),
          });
        } catch (e) { throw err('net', 'нет связи с сервисом'); }
        const j = await r.json().catch(() => ({}));
        if (r.ok) {
          GEM.count(model);
          const parts = ((((j.candidates || [])[0] || {}).content || {}).parts) || [];
          const d = parts.map(x => x.inlineData || x.inline_data).find(x => x && x.data);
          if (!d) throw err('net', 'Gemini не прислал звук');
          const mt = String(d.mimeType || d.mime_type || '');
          return { blob: /wav/i.test(mt) ? b64blob(d.data, 'audio/wav') : pcmWav(d.data, +((mt.match(/rate=(\d+)/) || [])[1]) || 24000) };
        }
        const e = j.error || {}, m = String((e.status || '') + ' ' + (e.message || '') + ' ' + JSON.stringify(e.details || ''));
        if (r.status === 429) {
          // per minute → a short rest; per day (or a free-tier count) → this model is done until midnight in California
          if (/PerMinute|per minute/i.test(m) && !/PerDay|per day/i.test(m)) throw err('rate', 'слишком много запросов в минуту');
          GEM.out(model);
          continue;
        }
        if (r.status === 400 && !GEM.noLang && /language/i.test(m) && !/API key/i.test(m)) { GEM.noLang = true; continue; }
        if (r.status === 404 || (r.status === 400 && /not found|not supported|does not support|response modalit/i.test(m))) { GEM.setBad(model); continue; }
        if (/location is not supported|FAILED_PRECONDITION/i.test(m)) throw err('region', 'Gemini недоступен в этой стране');
        if (r.status === 401 || r.status === 403 || /API_KEY_INVALID|API key not valid|API key expired/i.test(m)) throw err('badkey', 'ключ не подходит');
        throw err('net', 'сервис сейчас не ответил');
      }
      throw err('net', 'сервис сейчас не ответил');
    },
    /** how long a voice may stay silent before the next one takes over */
    limit(engine, text) {
      if (engine === 'piper') return window.Speech && Speech.piper._m ? 12000 : 45000; // the first phrase loads the model
      if (engine === 'gemini') return 9000 + Math.min(11000, String(text).length * 10); // a slower model: its phrase is precious
      return 4000 + Math.min(8000, String(text).length * 4);
    },

    /** play one piece through TTS._audio (so pause / resume / stop of the player work); wc: TTS's word clock (🎤).
     *  voiceKey: the vendor's voice; without it — the engine's voice for this place (place: given, else read from the screen) */
    async play(engine, text, lang, rate, p, wc, voiceKey, place) {
      const gen = ++playGen, tg = window.TTS ? TTS._gen : 0;
      if (!voiceKey) voiceKey = this.voice(engine, lang, place != null ? place : this.place());
      const c = await this.clip(engine, text, lang, rate, voiceKey, this.limit(engine, text));
      if (p && p !== TTS.player) return;
      if (!p && (gen !== playGen || TTS._gen !== tg)) return; // stopped, or a newer one-off phrase started meanwhile
      return new Promise((resolve, reject) => {
        const a = takeAudio(c.url);
        // ElevenLabs speed is limited to 0.7–1.2: the rest by playback speed
        if (engine === 'eleven') a.playbackRate = Math.max(0.5, Math.min(1.6, (rate / 0.9) / Math.max(0.7, Math.min(1.2, rate / 0.9))));
        if (engine === 'gemini' || (engine === 'nk' && isHd(voiceKey))) a.playbackRate = Math.max(0.5, Math.min(2, (+rate || 0.9) / 0.9));
        TTS._audio = a;
        // marks are in the clip's own seconds — currentTime too, whatever the playback speed
        if (wc) try { wc.audio(a, rate, engine, { marks: c.marks }); } catch (e) { /* no word timing: the sentence highlight stays */ }
        const end = () => { if (TTS._audio === a) TTS._audio = null; resolve(); };
        a.onended = end;
        a.onerror = () => { if (TTS._audio === a) TTS._audio = null; reject(err('play', 'не удалось проиграть звук')); };
        // stopped / replaced before it began (TTS.stop → pause): not an engine failure
        a.play().catch(e => { if (e && e.name === 'AbortError') end(); else reject(e); });
      });
    },

    /** speak a piece in a language: the chosen voice, then the chain (called by TTS._utter1). opts.voiceId: only that voice;
     *  opts.place (alias opts.ctx): where it is said — that place's voice first; missing = read from the screen, '' = «как везде» */
    async speak(text, lang, rate, opts, p, wc) {
      opts = opts || {};
      const g0 = TTS._gen;
      const alive = () => g0 === TTS._gen && (!p || p === TTS.player);
      const only = opts.voiceId || '';
      const place = only ? '' : opts.place != null ? normPlace(opts.place) : opts.ctx != null ? normPlace(opts.ctx) : this.place();
      const first = only || this.current(lang, place);
      if (!only) this.checkEdge();
      const ids = this.chain(lang, only, place);
      this.lastPlace = place;
      let lastErr = null;
      for (const id of ids) {
        if (!alive()) return;
        const { engine, key, spk } = parse(id);
        const o = Object.assign({}, opts, { local: true, voiceId: undefined, _wc: wc || undefined });
        if (engine === 'sys' || engine === 'gtr') {
          if (engine === 'sys') o.sysVoice = key || undefined; else o.gtr = true;
          this._spoke(lang, id, first);
          return TTS._utter(text, lang, o, p);
        }
        try {
          await this.play(engine, text, lang, rate, p, wc, key + (spk ? '#' + spk : ''));
          Health.ok(engine);
          this._spoke(lang, id, first);
          return;
        } catch (e) {
          lastErr = e;
          if (!alive() || (e && e.name === 'AbortError')) return;
          // the browser blocked sound before a tap: not the voice's fault (no note, no break for the engine)
          if (e && e.name === 'NotAllowedError') { if (only) throw e; continue; }
          this._fail(engine, e, id, lang, only || id !== first);
          if (only) throw e;
        }
      }
      if (only) throw lastErr || err('voice', 'голос недоступен');
      if (!alive()) return;
      // nothing in the chain can speak now: the device's voice / Google as before (Ukrainian: never a Russian voice)
      return TTS._utter(text, lang, Object.assign({}, opts, { local: true, voiceId: undefined, _wc: wc || undefined }), p);
    },
    lastSpoken: {},
    _spoke(lang, id, first) {
      const prev = this.lastSpoken[lang];
      this.lastSpoken[lang] = { id, fallback: id !== first, t: Date.now() };
      if (!prev || prev.id !== id) try { document.dispatchEvent(new CustomEvent('voices-spoke', { detail: { lang, id, fallback: id !== first } })); } catch (e) { /* old browser */ }
      this.nudge(lang, id);
    },
    _noted: false,
    /** a voice failed: remember why (bad key / quota / short break); quiet = no note (a preview, or not the main voice) */
    _fail(engine, e, id, lang, quiet) {
      if (engine === 'nk') return this._nkFail(e, id, lang, quiet);
      const kind = (e && e.kind) || 'net';
      let modal = false;
      if (kind === 'badkey' || kind in SAVED_FOR) Health.mark(engine, kind);
      else if (kind === 'install') Edge.installed = false;
      else if (['net', 'timeout', 'rate', 'play', 'piper'].includes(kind)) Health.mark(engine, kind === 'rate' ? 'rate' : 'net');
      // the vendor (or our own ceiling) says the limit is over: one friendly window per engine and month
      if (kind === 'quota') modal = this.limitOver(Limits.meter(engine, parse(id).key), lang, id);
      if (kind === 'stale') { this.offerEdgeUpdate(); return; }
      if (quiet || this._noted || !window.UI || modal) return;
      this._noted = true;
      const ent = this.entry(id, lang), nm = ent ? `«${ent.name}» (${(ENGINES[engine] || {}).short || engine})` : (ENGINES[engine] || {}).short || 'Голос';
      const mt = Limits.meter(engine, parse(id).key);
      const msg = kind === 'quota' ? `Бесплатный лимит ${(ENGINES[engine] || {}).short || ''} ${Limits.period(mt)} закончился — до ${Limits.resetText(mt)} читает запасной голос.`
        : kind === 'badkey' ? `${(ENGINES[engine] || {}).short || 'Сервис'} не принял ключ — пока читает запасной голос. Проверить можно в разделе «Голоса».`
        : kind === 'billing' ? 'Google Cloud просит подключить оплату — подключите её в консоли Google Cloud (деньги не спишутся, пока вы в бесплатном лимите). Пока читает запасной голос.'
        : kind === 'blocked' ? 'ElevenLabs приостановил бесплатный тариф (так бывает, если включён VPN) — пока читает запасной голос.'
        : kind === 'region' ? 'Бесплатный Gemini недоступен из этой страны — пока читает запасной голос.'
        : kind === 'install' ? 'Голоса Edge ждут установки на Mac — пока читает запасной голос.'
        : `Голос ${nm} сейчас не ответил — читает запасной.`;
      UI.toast(msg, '', kind === 'billing' ? 9000 : 5000);
    },
    /** Norsk Kort Pro failed: remember why (month used up / no Pro any more / consent declined / a short break), one calm line */
    _nkFail(e, id, lang, quiet) {
      const kind = (e && e.kind) || 'net';
      if (kind === 'quota') Health.mark('nk', 'quota', e.resetsAt);
      else if (kind === 'pro') {
        // the server says «no Pro» (expired / refunded): rest 10 minutes and ask the server again — never a loop of paid calls
        Health.brk.nk = { fails: 2, until: Date.now() + 10 * 60000 };
        try { if (window.Pro && Pro.refresh) Pro.refresh({ force: true }); } catch (x) { /* ignore */ }
      } else if (kind === 'consent') NK.declined = true;
      else if (['net', 'timeout', 'rate', 'play'].includes(kind)) Health.mark('nk', kind === 'rate' ? 'rate' : 'net');
      if (quiet || !window.UI) return;
      const when = t => { const d = new Date(t || nextMonth()); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
      if (kind === 'quota' && Notes.once('100', 'nk')) UI.toast(`Месячный лимит голосов Norsk Kort Pro закончился — до ${when(e.resetsAt)} читает голос устройства.`, '', 7000);
      else if (kind === 'hdquota' && Notes.once('100', 'nk-hd')) UI.toast(`Голоса HD на этот месяц закончились — до ${when(e.resetsAt)} читают обычные голоса Pro.`, '', 6000);
      else if (!this._noted && (kind === 'net' || kind === 'timeout')) { this._noted = true; UI.toast('Голос Norsk Kort Pro сейчас не ответил — читает запасной.', '', 4000); }
    },
    /** Edge answered 403 (Microsoft changed its protection): one quiet offer to update the voices on the Mac */
    offerEdgeUpdate() {
      if (this._edgeOffer || !window.UI || !UI.toastAction) return;
      this._edgeOffer = true;
      UI.toastAction('Голоса Edge перестали отвечать — похоже, Microsoft поменяла защиту. Пока читает запасной голос. Обновить голоса Edge на Mac?', 'Обновить', async () => {
        const t = UI.toast('Обновляю голоса Edge… обычно меньше минуты', '', 0);
        const r = await this.installEdge();
        t.close();
        if (r.ok) { Edge.stale = false; UI.toast('Голоса Edge обновлены', 'good', 3500); }
        else if (r.restart) UI.toast('Голоса обновлены — осталось перезапустить мост: «Голоса» → «Через мост на Mac».', '', 7000);
        else UI.toast((r.error || 'Не получилось обновить голоса.') + ' Пока читают другие голоса.', 'warn', 6000);
      }, 15000, icon('laptop', 18));
    },

    /* ---------- 📏 limits: 75 % (a quiet line in «Голоса»), 90 % (one toast), 100 % (one friendly window) ---------- */
    /** after a phrase went to the network */
    limitCheck(meter) {
      const p = Limits.pct(meter);
      if (Limits.hard(meter) && p >= 1) { this.limitOver(meter); return; }
      if (p >= 0.9 && p < 1 && meter !== 'gemini' && Notes.once('90', meter)) this.limit90(meter);
    },
    /** where an engine reads now: [{ lang, id }] — the language's voice, a place's voice, or what spoke last */
    usersOf(engine) {
      const out = [];
      LANGS.forEach(l => {
        const ids = [(this.lastSpoken[l] || {}).id, this.pickOf(l)].concat(PLACE_IDS.map(pl => this.placePick(pl, l)));
        const id = ids.find(x => x && parse(x).engine === engine);
        if (id) out.push({ lang: l, id });
      });
      return out;
    },
    /** the voice that reads instead of an engine (the chain without it) */
    insteadOf(lang, engine) { return this.chain(lang).find(id => parse(id).engine !== engine) || ''; },
    _vName(lang, id) { const e = this.entry(id, lang), p = parse(id); return e && p.engine !== 'gtr' ? `${e.name} · ${(ENGINES[p.engine] || {}).short || p.engine}` : this.label(lang, id); },
    limit90(meter) {
      const engine = Limits.engineOf(meter), u = this.usersOf(engine)[0];
      if (!u || !window.UI) return;
      const y = this.insteadOf(u.lang, engine);
      const el = document.createElement('div');
      el.className = 'toast warn toast-action vl-toast';
      el.setAttribute('role', 'status');
      el.innerHTML = `<span aria-hidden="true">${icon('clock', 18)}</span><span>${U.esc(`Голос ${this._vName(u.lang, u.id)}: потрачено 90 % бесплатного лимита ${Limits.period(meter)}${y ? ` — потом буду читать голосом ${this._vName(u.lang, y)}` : ''}.`)}</span>
        <span class="vl-btns"><button type="button" class="btn sm" data-vl-ok>Понятно</button><button type="button" class="btn sm primary" data-vl-pick>Выбрать заранее</button></span>`;
      const root = document.getElementById('toast-root');
      if (!root) return;
      root.appendChild(el);
      let done = false;
      const close = () => { if (done) return; done = true; el.classList.add('out'); setTimeout(() => el.remove(), 300); };
      el.querySelector('[data-vl-ok]').onclick = e => { e.stopPropagation(); close(); };
      el.querySelector('[data-vl-pick]').onclick = e => { e.stopPropagation(); close(); this.openChooser(u.lang); };
      setTimeout(close, 20000);
    },
    _over: new Map(),
    /** the limit is over → true when the friendly window will come (once per engine and month) */
    limitOver(meter, lang, id) {
      const engine = Limits.engineOf(meter);
      const users = this.usersOf(engine);
      if (id && lang && !users.some(u => u.lang === lang)) users.push({ lang, id });
      if (!users.length) return false;
      if (!Notes.once('100', meter)) return false;
      this._over.set(meter, users);
      clearTimeout(this._overT);
      // several languages (one key for all three) or engines at once → one window; it waits for a pause in playback
      this._overT = setTimeout(() => this._overShow(), 1200);
      return true;
    },
    /** something plays on and on (🎧 «Слушать», the interpreter, a video, a read-aloud): the window waits for a pause */
    busy() {
      try {
        if (window.Listen && Listen.p && Listen.p.playing) return true;
        if (window.Interp && Interp.on) return true;
        if (window.TTS && TTS.player && !TTS.player.paused) return true;
        if ([...document.querySelectorAll('video')].some(v => !v.paused && !v.ended)) return true;
      } catch (e) { /* nothing plays */ }
      return false;
    },
    _overShow(tries) {
      tries = tries || 0;
      if (!this._over.size || !window.UI) return;
      if (this.busy() && tries < 1200) { this._overT = setTimeout(() => this._overShow(tries + 1), 1500); return; }
      const items = [];
      this._over.forEach((users, meter) => users.forEach(u => items.push({ meter, engine: Limits.engineOf(meter), lang: u.lang, id: u.id })));
      this._over.clear();
      if (!items.length) return;
      items.sort((a, b) => LANGS.indexOf(a.lang) - LANGS.indexOf(b.lang));
      const rows = items.map(it => Object.assign(it, { to: this.insteadOf(it.lang, it.engine) }));
      const meters = [...new Set(rows.map(r => r.meter))];
      const when = [...new Set(meters.map(mt => Limits.resetText(mt)))].join(', ');
      const one = rows.length === 1 ? rows[0] : null;
      const per = meters.every(mt => mt === 'gemini') ? 'на сегодня' : meters.includes('gemini') ? '' : 'этого месяца';
      const head = one
        ? `На голосе <b>${U.esc(this._vName(one.lang, one.id))}</b> закончился бесплатный лимит ${Limits.period(one.meter)} — переключаю на <b>${U.esc(one.to ? this._vName(one.lang, one.to) : 'голос устройства')}</b>.`
        : `На голосах ${U.esc([...new Set(rows.map(r => (ENGINES[r.engine] || {}).short))].join(' и '))} закончился бесплатный лимит${per ? ' ' + per : ''} — переключаю:`;
      const list = one ? '' : `<ul class="vl-list">${rows.map(r => `<li>${langMark(r.lang)} <b>${LANG_NAME[r.lang]} голос:</b> ${U.esc(this._vName(r.lang, r.id))} → <b>${U.esc(r.to ? this._vName(r.lang, r.to) : 'голос устройства')}</b></li>`).join('')}</ul>`;
      const m = UI.modal({
        title: 'Бесплатный лимит закончился', cls: 'narrow vl-modal',
        body: `<p>${head}</p>${list}<p class="muted">Лимит вернётся ${U.esc(when)}.${meters.some(mt => mt.startsWith('gcloud')) ? ' Деньги не спишутся: приложение само остановилось на вашем потолке.' : ''}</p>`,
        foot: '<button type="button" class="btn primary" data-vl-ok>Хорошо</button><button type="button" class="btn" data-vl-pick>Выбрать другой голос</button>',
      });
      m.$('[data-vl-ok]').onclick = () => m.close();
      m.$('[data-vl-pick]').onclick = () => { m.close(); this.openChooser(rows[0].lang); };
      try { m.$('[data-vl-ok]').focus(); } catch (e) { /* ignore */ }
    },
    /** old callers (🎧 deck builder): a failed engine, said once and calmly */
    warn(engine, e) { this._fail(engine, e || {}, engine + ':' + this.voice(engine, 'no'), 'no', false); },
    resetWarnings() { this._noted = false; },

    /** 💻 ask the Mac bridge whether edge-tts is installed (GET /api/tts/status — always a fresh answer) */
    checkEdge(force) {
      if (publicBuild() || !macBridge()) return Promise.resolve(Edge);
      if (Edge.busy) return force ? Edge.busy.then(() => this.checkEdge(true)) : Edge.busy;
      if (!force && Edge.checked && Date.now() - Edge.checked < 5 * 60000) return Promise.resolve(Edge);
      Edge.busy = fetch('/api/tts/status?t=' + Date.now(), { cache: 'no-store' }).then(async r => {
        if (r.ok) {
          const j = await r.json().catch(() => null);
          if (j && typeof j.edge === 'boolean') {
            Edge.installed = j.edge; Edge.version = j.version || ''; Edge.installing = !!j.installing;
            Edge.canRestart = !!j.canRestart; Edge.lastInstall = j.lastInstall || null;
            // a bridge that knows the voices but cannot install them (Nov 20 – v207): it must be restarted once
            Edge.old = !j.edge && !j.canInstall;
            if (j.edge) Health.forget('edge');
          }
        } else if (r.status === 400 || r.status === 404) Edge.old = true; // a bridge from before: no /api/tts/status at all
      }).catch(() => { /* the bridge is not there right now */ }).then(() => { Edge.checked = Date.now(); Edge.busy = null; return Edge; });
      return Edge.busy;
    },
    /** 💻 «⬇ Установить голоса Edge»: the bridge installs edge-tts for its own python (POST /api/tts/install).
     *  → { ok } | { old: true } (a bridge from before: restart it once) | { restart: true } | { ok: false, error } */
    async installEdge() {
      if (publicBuild() || !macBridge()) return { ok: false, error: 'Мост на Mac не запущен.' };
      Edge.installing = true;
      let j = null;
      try {
        const r = await fetch('/api/tts/install', { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: '{}' });
        if (r.status === 404 || r.status === 405 || r.status === 501) { Edge.installing = false; Edge.old = true; return { ok: false, old: true }; }
        j = await r.json().catch(() => null);
      } catch (e) { j = null; }
      if (!j) {
        // the answer got lost on the way (a long wait): ask the bridge how the installation went
        for (let i = 0; i < 80; i++) {
          await sleep(3000);
          await this.checkEdge(true);
          if (!Edge.installing) break;
        }
        j = Edge.installed ? { ok: true } : Edge.lastInstall || { ok: false, error: 'Не получилось установить голоса.' };
      }
      Edge.installing = false;
      Edge.checked = 0;
      await this.checkEdge(true);
      if (j.ok && Edge.installed) { Edge.stale = false; this._edgeOffer = false; Health.forget('edge'); this.resetWarnings(); return { ok: true, version: Edge.version }; }
      return Object.assign({ ok: false, error: 'Не получилось установить голоса.' }, j, { ok: false });
    },
    /** ↻ the bridge starts itself again (POST /api/restart) → true when it answers again */
    async restartBridge() {
      if (publicBuild() || !onMac()) return false;
      try {
        const r = await fetch('/api/restart', { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: '{}' });
        if (r.status === 404 || r.status === 405) return false;
      } catch (e) { /* the bridge may close the connection while it restarts */ }
      await sleep(1200);
      for (let i = 0; i < 30; i++) {
        try {
          const r = await fetch('/api/status?t=' + Date.now(), { cache: 'no-store' });
          if (r.ok) { if (window.AI && AI.detectBridge) await AI.detectBridge(); Edge.checked = 0; await this.checkEdge(true); return true; }
        } catch (e) { /* not up yet */ }
        await sleep(700);
      }
      return false;
    },

    /** one-time, polite: the device's Russian / Norwegian voice sounds robotic → there are better free ones */
    nudge(lang, id) {
      const p = parse(id);
      if (p.engine !== 'sys' || this._nudged || !window.UI || !UI.toastAction) return;
      const v = window.TTS && TTS.pickVoice(lang, p.key || undefined);
      if (!v || TTS.voiceQuality(v) > 2) return;
      this._nudged = true;
      if (ls.get('nk-voice-nudge', 0)) return;
      ls.set('nk-voice-nudge', 1);
      const what = lang === 'ru' ? 'Русский' : lang === 'uk' ? 'Украинский' : 'Норвежский';
      const better = NK.pro() ? 'Есть живые голоса — они уже входят в ваш Norsk Kort Pro.' : 'Есть голоса живее — бесплатно.';
      setTimeout(() => UI.toastAction(`${what} голос этого устройства звучит «по-роботски». ${better}`, 'Выбрать', () => this.openChooser(lang), 12000, icon('speaker', 18)), 1200);
    },

    /** ElevenLabs: voices from the user's own library */
    async loadElevenVoices() {
      const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': (S().elevenKey || '').trim() } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 401 ? 'ключ не подходит' : 'сервис сейчас не ответил');
      const list = (j.voices || []).map(v => [v.voice_id, v.name, ((v.labels || {}).gender || '') === 'male' ? M : ((v.labels || {}).gender || '') === 'female' ? F : '']);
      this.custom.eleven = { no: list, ru: list, uk: list };
      ls.set('nk-eleven-voices', list.slice(0, 80));
      return list.length;
    },

    /** Google Cloud: the voices your key sees right now (voices.list) — kept a week, merged into the built-in list,
     *  so voices Google adds later appear by themselves. → how many voices for our three languages */
    async loadGoogleVoices(force) {
      const key = String(S().gcloudKey || '').trim();
      if (!key) return 0;
      const old = ls.get('nk-gcloud-voices', {});
      if (!force && old.t && Date.now() - old.t < 7 * 86400000 && old.fp === fnv(key)) return LANGS.reduce((n, l) => n + ((old[l] || []).length), 0);
      const out = { t: Date.now(), fp: fnv(key) };
      await Promise.all(LANGS.map(async l => {
        const r = await fetch('https://texttospeech.googleapis.com/v1/voices?languageCode=' + LOC[l], { headers: { 'X-Goog-Api-Key': key } });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw this._gErr(r.status, j);
        out[l] = (j.voices || []).filter(v => v && typeof v.name === 'string' && v.name.startsWith(LOC[l] + '-') && /-(Chirp3-HD|Chirp-HD|Wavenet|Standard|Neural2|Studio)-/.test(v.name))
          .map(v => {
            const star = (/-Chirp3-HD-(\w+)$/.exec(v.name) || [])[1];
            const short = star || v.name.slice(LOC[l].length + 1).replace(/-/g, ' ').replace('Wavenet', 'WaveNet');
            return [v.name, short, v.ssmlGender === 'FEMALE' ? F : v.ssmlGender === 'MALE' ? M : ''];
          });
      }));
      ls.set('nk-gcloud-voices', out);
      document.dispatchEvent(new CustomEvent('voices-changed'));
      return LANGS.reduce((n, l) => n + out[l].length, 0);
    },

    /* ---------- 🎭 a voice of its own for every speaker of a dialogue ----------
     * The owner's rule: when a dialogue with two or more speakers is read aloud, every speaker has a voice of their own —
     * the first speaker (and the narration) the usual voice of the place, the second another voice (the other gender when
     * there is one), a third and a fourth further voices — the same voice for the same speaker the whole dialogue.
     * Only voices that can speak now (set up, not resting); nothing distinct → '' (the same device voice a little lower
     * or higher instead — roleOpts). «🎭 Разные голоса в диалогах» (Store.settings.dialogVoices, on unless switched off). */
    rolesOn() { return S().dialogVoices !== false; },
    setRolesOn(on) {
      Store.setSetting('dialogVoices', !!on);
      roleMemo.clear();
      document.dispatchEvent(new CustomEvent('voices-pick', { detail: { roles: !!on } }));
    },
    /**
     * n voice ids for the speakers of a dialogue: [0] the voice the place reads with now, then the best other voice of the
     * other gender, then further distinct voices (genders taking turns); '' = no distinct voice is available for that one.
     * o.audio: only voices that make audio files (+ the Google voice) — the 🎧 player builds clips, it cannot use a device voice.
     */
    roleVoices(lang, n, place, o) {
      n = Math.max(1, Math.min(6, n | 0 || 1));
      o = o || {};
      place = normPlace(place);
      const mk = lang + '|' + place + '|' + (o.audio ? 'a' : '');
      let memo = roleMemo.get(mk);
      if (!memo || Date.now() - memo.t > 300000 || memo.n < n) {
        memo = { t: Date.now(), n, ids: this._roleIds(lang, n, place, o) };
        roleMemo.set(mk, memo);
      }
      return memo.ids.slice(0, n);
    },
    _roleIds(lang, n, place, o) {
      const ok = id => { try { return this.avail(id, lang).ok; } catch (e) { return false; } };
      // (the 🎧 player: audio files only, never Gemini — as Voices.audioEngine)
      const audioOk = id => !o.audio || (AUDIO.includes(parse(id).engine) && parse(id).engine !== 'gemini') || parse(id).engine === 'gtr';
      const chain = this.chain(lang, '', place).filter(audioOk);
      const main = chain[0] || this.current(lang, place);
      const me = this.entry(main, lang) || { engine: parse(main).engine, name: parse(main).key, g: '', q: 2 };
      const eng0 = parse(main).engine;
      const nameOf = e => String(e.name || '').toLowerCase().replace(/\s*\(.*\)\s*$/, '');
      // the engines that may speak here: those of the chain (set up and reachable) — Gemini only when it is the main voice
      // (its few dozen phrases a day are for cards)
      const engines = [];
      chain.forEach(id => { const e = parse(id).engine; if (!engines.includes(e)) engines.push(e); });
      const pool = [], seen = new Set([main]);
      const add = (id, e, g) => {
        if (seen.has(id)) return;
        seen.add(id);
        if (!ok(id)) return;
        pool.push({ id, eng: parse(id).engine, name: nameOf(e) + (parse(id).spk ? '#' + parse(id).spk : ''), g: g != null ? g : e.g || '', q: e.q || 2, k: engines.indexOf(parse(id).engine) });
      };
      const all = entries(lang);
      engines.filter(e => e !== 'gemini' || eng0 === 'gemini').forEach(eng => {
        all.filter(e => e.engine === eng).forEach(e => {
          if (eng === 'piper' && e.speakers) {
            Object.entries(e.speakers).forEach(([spk, label]) => add('piper:' + e.key + '#' + spk, e, /женск|♀/i.test(label) ? F : /мужск|♂/i.test(label) ? M : ''));
          } else add(e.id, e);
        });
      });
      // never the main voice again under another name (Finn at Azure = Finn at Edge; Kore at Gemini = Kore at Google Cloud)
      const mainName = nameOf(me) + (parse(main).spk ? '#' + parse(main).spk : '');
      const used = new Set([mainName]);
      const g0 = me.g || '';
      const other = g0 === F ? M : g0 === M ? F : '';
      const out = [main];
      for (let k = 1; k < n; k++) {
        const want = k % 2 ? other : g0;
        const gs = c => (!want || !c.g ? 1 : c.g === want ? 0 : 2);
        const best = pool.filter(c => !used.has(c.name)).sort((a, b) => gs(a) - gs(b) || b.q - a.q || (a.eng === eng0 ? 0 : 1) - (b.eng === eng0 ? 0 : 1) || a.k - b.k)[0];
        if (!best) { out.push(''); continue; }
        used.add(best.name);
        out.push(best.id);
      }
      return out;
    },
    /** the place of a speaker in a dialogue's roster (the roster grows in the order speakers appear); -1 = narration */
    roleIndex(roster, key) {
      if (key == null || key === '' || !Array.isArray(roster)) return -1;
      let i = roster.indexOf(key);
      if (i < 0) { roster.push(key); i = roster.length - 1; }
      return i;
    },
    /** the voice of a speaker ('' = the usual voice of the place) */
    speakerVoice(lang, key, roster, place, o) {
      const i = this.roleIndex(roster, key);
      if (i <= 0 || !this.rolesOn()) return '';
      return this.roleVoices(lang, i + 1, place, o)[i] || '';
    },
    /** TTS options for speaker i of a dialogue: { place } for the first speaker / narration / the setting off; { voiceId }
     *  for the others (TTS falls back to the place's voice if it fails); no distinct voice → the same device voice a
     *  little lower / higher ({ pitch }) */
    roleOpts(lang, i, place, o) {
      const out = place != null ? { place } : {};
      if (!(i > 0) || !this.rolesOn()) return out;
      const id = this.roleVoices(lang, i + 1, place, o)[i];
      if (id) out.voiceId = id;
      else out.pitch = ROLE_PITCH[(i - 1) % ROLE_PITCH.length];
      return out;
    },
    speakerOpts(lang, key, roster, place, o) { return this.roleOpts(lang, this.roleIndex(roster, key), place, o); },
    /** a voice given to a speaker failed: choose the speakers' voices again (the failed one is resting now) */
    roleFailed() { roleMemo.clear(); },
    /**
     * Who says each line of a text: [key | null] (null = narration, read by the usual voice). A line is a speaker's when it
     * starts with «–», «—» or «- » (consecutive ones take turns: 'd0', 'd1') or with a name label «Kari:» / «Анна:» (two
     * different names at least — not «Merk:», «Пример:»). A Russian / Ukrainian line right after a Norwegian one is its
     * translation: the same speaker. Fewer than two speaker lines → no dialogue (all null).
     */
    dialogRoles(lines) {
      lines = (Array.isArray(lines) ? lines : String(lines || '').split('\n')).map(x => String(x == null ? '' : x));
      const out = lines.map(() => null);
      const script = t => { const c = (t.match(/[Ѐ-ӿ]/g) || []).length, l = (t.match(/[A-Za-zÆØÅæøåÄÖÜäöüÉé]/g) || []).length; return c > l ? 'cyr' : l ? 'lat' : ''; };
      const info = lines.map(t => {
        const s = script(t);
        const d = /^\s*([–—]|-(?=\s))\s*(\S.*)$/.exec(t);
        if (d) return { s, dash: true, hy: d[1] === '-', rest: d[2] };
        const m = ROLE_LABEL.exec(t);
        if (m && m[1].length <= 24 && !ROLE_STOP.has(m[1].toLowerCase().replace(/\.$/, ''))) return { s, name: m[1].toLowerCase() };
        return { s };
      });
      // a translation line (Cyrillic right after Latin) belongs to the line before it
      let prevS = '';
      info.forEach(x => { if (!x.s) return; x.tr = x.s === 'cyr' && prevS === 'lat'; prevS = x.s; });
      const own = info.filter(x => !x.tr);
      const names = new Set(own.filter(x => x.name).map(x => x.name));
      const labels = names.size >= 2 && own.filter(x => x.name).length >= 2;
      const dashes = own.filter(x => x.dash);
      // «- egg / - melk» is a shopping list, not a dialogue: hyphen lines count when most of them are sentences
      const hyOnly = dashes.length && dashes.every(x => x.hy);
      const sentences = dashes.filter(x => /[.!?…»"”)]\s*$|[?!]/.test(x.rest)).length;
      const dashOk = dashes.length >= 2 && (!hyOnly || sentences * 2 >= dashes.length);
      if (!labels && !dashOk) return out;
      let turn = 0, quiet = 0, prev = null;
      info.forEach((x, i) => {
        if (!x.s && !x.dash && !x.name) return; // an empty line changes nothing
        if (x.tr) { out[i] = prev; return; }
        let key = null;
        if (labels && x.name) key = 'n:' + x.name;
        else if (dashOk && x.dash) { key = 'd' + (turn % 2); turn++; }
        if (key) quiet = 0;
        else if (++quiet >= 2) turn = 0; // two narration paragraphs in a row: the next dialogue starts again
        out[i] = key;
        prev = key;
      });
      return out;
    },

    /** three buttons «Норвежский голос / Украинский голос / Русский голос» for a place — always in this order */
    langButtons(place, o) {
      o = o || {};
      ensureCss();
      const pl = this.placeInfo(place), langs = o.langs || LANGS;
      return `<div class="vs-langs" role="group" aria-label="Голоса${pl ? ' ' + U.esc(pl.for) : ''}">${langs.map(l => {
        const nm = this.label(l, '', place);
        return `<button type="button" class="btn sm vs-lang" data-voices-open="${l}"${place ? ` data-voices-place="${U.esc(place)}"` : ''} aria-label="${LANG_NAME[l]} голос${pl ? ' ' + U.esc(pl.for) : ''}: ${U.esc(nm)}. Выбрать" title="${U.esc(nm)}">`
          + `${langMark(l)} <b>${LANG_NAME[l]} голос</b>${o.names ? `<small>${U.esc(nm)}</small>` : ''}</button>`;
      }).join('')}</div>`;
    },

    /* ---------- «🔊 Голоса»: the window lives in js/voicepicker.js (loaded on first use) ---------- */
    _ui: null,
    loadUi() {
      if (this._ui) return this._ui;
      const v = (document.querySelector('script[src*="js/voices.js"]') || {}).src || '';
      const q = (v.match(/\?v=[^&]+/) || [''])[0];
      ensureCss();
      this._ui = window.VoicePicker ? Promise.resolve(window.VoicePicker) : new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'js/voicepicker.js' + q; s.async = true;
        s.onload = () => (window.VoicePicker ? res(window.VoicePicker) : rej(new Error('no picker')));
        s.onerror = () => rej(new Error('no picker'));
        document.head.appendChild(s);
      });
      this._ui.catch(() => { this._ui = null; });
      return this._ui;
    },
    /** open the voice chooser on a language tab ('no' | 'uk' | 'ru'); o.section: 'keys' scrolls to the services,
     *  'places' to «Где какой голос»; o.place: choose the voice of that place (📖 the reader's «Aa», 📺 the subtitles…) */
    async openChooser(lang, o) {
      try { const VP = await this.loadUi(); return VP.open(LANGS.includes(lang) ? lang : 'no', o || {}); }
      catch (e) { if (window.UI) UI.toast('Не удалось открыть выбор голосов — проверьте интернет и попробуйте ещё раз', 'warn'); return null; }
    },

    /* ---------- Settings → 🔊 Озвучка: a short summary + the way into «Голоса» ---------- */
    settingsHtml() {
      this.loadUi().catch(() => {}); // the card styles come with it
      const row = l => {
        const id = this.current(l), e = this.entry(id, l), act = this.chain(l)[0] || id, fb = act !== id;
        const q = e ? e.q : 2;
        return `<button type="button" class="vs-row" data-voices-open="${l}" aria-label="${LANG_NAME[l]} голос: ${U.esc(this.label(l))}. Выбрать">
          <span class="vs-flag" aria-hidden="true">${langMark(l)}</span>
          <span class="vs-main"><span class="vs-lname">${LANG_NAME[l]} голос</span><b>${U.esc(this.label(l, id))}</b><small>${this.pickOf(l) ? '' : 'Авто · '}${'★'.repeat(q)}${'☆'.repeat(5 - q)} ${QUALITY[q] || ''}${fb ? ` · сейчас читает запасной: ${U.esc(this.label(l, act))}` : ''}</small></span>
          <span class="vs-go" aria-hidden="true">›</span></button>`;
      };
      const np = this.placeCount();
      const places = `<button type="button" class="vs-row" data-voices-open="no" data-voices-section="places" aria-label="Где какой голос: ${np ? 'свой голос в ' + np + ' ' + (np === 1 ? 'месте' : 'местах') : 'везде одинаково'}. Настроить">
          <span class="vs-flag" aria-hidden="true">${icon('pin', 22)}</span>
          <span class="vs-main"><b>Где какой голос</b><small>${np ? `Свой голос: ${PLACES.filter(p => LANGS.some(l => this.placePick(p.id, l))).map(p => p.name).join(', ')}` : 'Везде одинаково · можно дать читалке, видео, карточкам свой голос'}</small></span>
          <span class="vs-go" aria-hidden="true">›</span></button>`;
      return `<div class="vs-sum">
          <div class="small muted">Для каждого языка — свой голос. Бесплатно читают голоса этого устройства и офлайн-голоса${NK.offered() ? '; с Norsk Kort Pro — живые голоса сервера' : ''}. Сервисы со своим ключом (Azure, Google Cloud, Gemini, ElevenLabs) подключаются там же.</div>
          <div class="vs-rows">${LANGS.map(row).join('')}${places}</div>
          <div class="row" style="gap:8px;flex-wrap:wrap"><button type="button" class="btn primary vs-open" data-voices-open="no">${icon('speaker', 18)} Выбрать голоса</button>
            <button type="button" class="btn ghost" data-voices-open="no" data-voices-section="keys">${icon('key', 18)} Подключить свой ключ</button></div>
        </div>`;
    },
  };

  // ElevenLabs library loaded earlier on this device
  try { const l = ls.get('nk-eleven-voices', null); if (Array.isArray(l) && l.length) Voices.custom.eleven = { no: l, ru: l, uk: l }; } catch (e) { /* ignore */ }

  // any element with data-voices-open="ru" opens the chooser (Settings, the reader's menu, hints…)
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-voices-open]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    Voices.openChooser(b.getAttribute('data-voices-open') || 'no', { section: b.getAttribute('data-voices-section') || '', place: b.getAttribute('data-voices-place') || '' });
  }, true);
  // the Mac bridge is found at start (js/app.js): then ask it once whether the Edge voices are installed
  setTimeout(() => { if (!publicBuild() && macBridge()) Voices.checkEdge(); }, 3000);
  // Norsk Kort Pro: which server voices are on (free, public GET health) — once at start, again when Pro changes
  setTimeout(() => { if (NK.offered()) NK.health(); }, 4000);
  window.addEventListener('nk-pro', () => { roleMemo.clear(); if (NK.pro()) { NK.declined = false; Health.forget('nk'); NK.health(); } document.dispatchEvent(new CustomEvent('voices-changed')); });
  // back online / bridge found: voices that were skipped can be tried again
  window.addEventListener('online', () => { Object.keys(Health.brk).forEach(k => delete Health.brk[k]); });

  window.Voices = Voices;
})();
