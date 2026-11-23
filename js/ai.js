/* ============ Claude AI integration ============ */
(function () {
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  const API = 'https://api.anthropic.com/v1/messages';
  /** the Mac bridge (bridge/server.py, 127.0.0.1 only) can exist only when the app is opened on the Mac itself:
   *  a file or localhost. On the site (GitHub Pages) there is no bridge — hints about it are not shown there.
   *  ONE definition: js/net.js Net.onMac() (also false in the store apps, whose «localhost» is not the Mac). */
  const onMac = () => (window.Net && Net.onMac ? Net.onMac() : location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/.test(location.hostname));
  /** the learner's language for explanations / glosses (the setting comes from the UI-language workstream): ru | uk */
  const trLang = () => { try { const s = Store.settings; return (s.transLang || s.trLang) === 'uk' ? 'uk' : 'ru'; } catch (e) { return 'ru'; } };
  const SITE_NO_BRIDGE = 'в версии на сайте это пока недоступно';
  const FIELDS = ['no', 'ru', 'en', 'description', 'example', 'exampleRu', 'wordClass', 'imagePrompt'];
  const FIELD_NAMES = {
    no: 'Норвежский', ru: 'Русский', en: 'English', description: 'Описание', example: 'Пример (NO)',
    exampleRu: 'Пример (RU)', wordClass: 'Часть речи', imagePrompt: 'Промпт картинки', tags: 'Теги',
  };

  /* ---------- 📚 word forms: ONE table «tag → Norwegian grammar name · Russian name · Ukrainian name» ----------
   * The AI returns a `tag` for every form (the fixed list below); the card keeps label = the Norwegian name (+ « · note»),
   * so the tag can always be found again from the label (older cards: AI.formTag infers it from their label text).
   * Shown everywhere as «presens · настоящее время — håper — надеюсь» (js/study.js, js/aihub.js). */
  const FORM_TAGS = {
    inf: { no: 'infinitiv', ru: 'неопределённая форма', uk: 'неозначена форма', pos: 'verb' },
    pres: { no: 'presens', ru: 'настоящее время', uk: 'теперішній час', pos: 'verb' },
    pret: { no: 'preteritum', ru: 'прошедшее время', uk: 'минулий час', pos: 'verb' },
    perf: { no: 'perfektum', ru: 'перфект («уже»)', uk: 'перфект («вже»)', pos: 'verb' },
    pluskv: { no: 'pluskvamperfektum', ru: 'предпрошедшее («уже» к тому времени)', uk: 'давноминулий час', pos: 'verb' },
    fut: { no: 'futurum', ru: 'будущее время', uk: 'майбутній час', pos: 'verb' },
    imp: { no: 'imperativ', ru: 'повелительное наклонение', uk: 'наказовий спосіб', pos: 'verb' },
    perfpart: { no: 'perfektum partisipp', ru: 'причастие прошедшего времени', uk: 'дієприкметник минулого часу', pos: 'verb' },
    prespart: { no: 'presens partisipp', ru: 'причастие настоящего времени', uk: 'дієприкметник теперішнього часу', pos: 'verb' },
    passiv: { no: 'passiv', ru: 'страдательный залог', uk: 'пасивний стан', pos: 'verb' },
    ue: { no: 'ubestemt entall', ru: 'ед. ч., неопределённая', uk: 'одн., неозначена', pos: 'substantiv' },
    be: { no: 'bestemt entall', ru: 'ед. ч., определённая', uk: 'одн., означена', pos: 'substantiv' },
    uf: { no: 'ubestemt flertall', ru: 'мн. ч., неопределённая', uk: 'мн., неозначена', pos: 'substantiv' },
    bf: { no: 'bestemt flertall', ru: 'мн. ч., определённая', uk: 'мн., означена', pos: 'substantiv' },
    adjmf: { no: 'hankjønn/hunkjønn', ru: 'мужской и женский род', uk: 'чоловічий і жіночий рід', pos: 'adjektiv' },
    adjn: { no: 'intetkjønn', ru: 'средний род', uk: 'середній рід', pos: 'adjektiv' },
    adjpl: { no: 'flertall/bestemt', ru: 'мн. ч. и определённая форма', uk: 'мн. і означена форма', pos: 'adjektiv' },
    adjdef: { no: 'bestemt form', ru: 'определённая форма', uk: 'означена форма', pos: 'adjektiv' },
    positiv: { no: 'positiv', ru: 'исходная форма', uk: 'звичайний ступінь', pos: 'adjektiv' },
    komp: { no: 'komparativ', ru: 'сравнительная степень', uk: 'вищий ступінь', pos: 'adjektiv' },
    sup: { no: 'superlativ', ru: 'превосходная степень', uk: 'найвищий ступінь', pos: 'adjektiv' },
    supdef: { no: 'superlativ, bestemt', ru: 'превосходная, определённая', uk: 'найвищий, означена', pos: 'adjektiv' },
  };
  /** kjønn of a noun: shown above its forms */
  const GENDER_TAGS = {
    m: { no: 'hankjønn', art: 'en', ru: 'мужской род', uk: 'чоловічий рід' },
    f: { no: 'hunkjønn', art: 'ei', ru: 'женский род', uk: 'жіночий рід' },
    n: { no: 'intetkjønn', art: 'et', ru: 'средний род', uk: 'середній рід' },
    mf: { no: 'hankjønn / hunkjønn', art: 'en / ei', ru: 'мужской или женский род', uk: 'чоловічий або жіночий рід' },
  };
  /** the list the AI chooses from (said in the prompts) */
  const FORM_TAG_HINT = 'verb: inf, pres, pret, perf, pluskv, fut, imp, perfpart, prespart, passiv; noun: ue, be, uf, bf; adjective: adjmf, adjn, adjpl, adjdef, positiv, komp, sup, supdef; adverb with comparison: positiv, komp, sup';
  /** adverbs that have degrees of comparison (the check must give their forms: gjerne – heller – helst) */
  const COMPARABLE_ADV = ['gjerne', 'mye', 'lenge', 'ofte', 'tidlig', 'sent', 'langt', 'nær', 'nært', 'fort', 'godt', 'bra', 'vel', 'ille', 'dårlig', 'lite', 'snart', 'høyt', 'lavt', 'raskt', 'sakte', 'langsomt', 'sjelden', 'nøye', 'pent', 'stygt', 'hardt', 'lett', 'tungt', 'billig', 'dyrt', 'varmt', 'kaldt', 'kort', 'smått', 'stort'];
  /** one form from an AI answer → { tag?, label, no, ru } (label = the Norwegian name + « · note», so it is found again later) */
  function formFromAI(f) {
    const tag = String(f.tag || '').trim().toLowerCase();
    const note = String(f.note || '').trim().slice(0, 40);
    const out = { label: String(f.label || '').slice(0, 60), no: String(f.no).slice(0, 120), ru: String(f.ru || '').slice(0, 160) };
    if (FORM_TAGS[tag]) { out.tag = tag; out.label = FORM_TAGS[tag].no + (note ? ' · ' + note : ''); }
    return out;
  }

  /** a list field (forms / examples / synonyms) as text for the report: «presens: håper (надеюсь)» line by line */
  const listTxt = (arr, note) => (window.Prov && Prov.listText ? Prov.listText(arr, note) : (arr || []).map(x => `${x.label ? x.label + ': ' : ''}${x.no} (${x.ru || ''})`).join('\n'));

  /** shared context: every connected AI immediately knows where it is and what is expected */
  function appContext() {
    const name = (Store.settings.userName || '').trim();
    return `CONTEXT: You are the AI assistant built into "Norsk Kort" — a flashcard app for learning Norwegian (Bokmål) for a Russian-speaking learner${name ? ' named ' + name : ''}. Each card has a Norwegian side, a Russian side and an explanation (grammar forms, notes, examples). Your job: check that the translation is correct, fix mistakes, and add clear explanations — always helping the learner learn Norwegian as fast as possible.
HOUSE STYLE (very important): whenever you write Norwegian words, phrases, expressions or example sentences, put the Russian translation right after them in parentheses, e.g. "Jeg skal hente barna fra skolen. (Я заберу детей из школы.)" or "å hente seg inn (восстановиться)". Explanations themselves are in Russian.${trLang() === 'uk' ? `
LANGUAGE: this learner reads UKRAINIAN — write every translation, gloss and explanation in Ukrainian instead of Russian (the field named "ru" holds the learner's-language translation).` : ''}`;
  }

  function systemPrompt() {
    const art = Store.settings.aiArticles;
    return `${appContext()}
You are an expert lexicographer and teacher of Norwegian Bokmål for Russian speakers. You check, correct and enrich vocabulary flashcards.
MAIN GOAL: help the learner learn Norwegian as fast as possible. Every change must make the card better for memorising (correct, clear, memorable) and must never break the learner's format or remove their content. You may fix and complete Russian glosses in parentheses, add missing glosses for hard words, add grammar forms and a good example — but keep the card recognisable.
Card fields:
- "no": the Norwegian side (Bokmål). Correct spelling and letters æ ø å.${art ? ' Nouns MUST have the indefinite article (en/ei/et; for feminine nouns use "ei"). Verbs MUST have the infinitive marker "å".' : ' Keep the user\'s style regarding articles.'} Keep it short (the word or phrase only).
- "ru": accurate, natural Russian translation; the most common meaning first; up to 3 meanings separated by ", ".
- "en": English equivalent (1-3 words), used for image search.
- "description": a short helpful note IN RUSSIAN (max ~300 chars): part of speech and grammar forms (nouns: ubestemt entall – bestemt entall – ubestemt flertall – bestemt flertall; verbs: infinitiv – presens – preteritum – perfektum; adjectives: m/f – n – pl/bestemt), plus nuance/usage and 1 common expression if useful — every Norwegian phrase followed by its Russian translation in parentheses (house style).
- "example": one short natural Norwegian sentence (A1–B1) using the word.
- "exampleRu": Russian translation of that sentence.
- "wordClass": one of: substantiv, verb, adjektiv, adverb, preposisjon, pronomen, konjunksjon, tallord, interjeksjon, uttrykk.
- "imagePrompt": an English prompt for an image generator that depicts the MEANING clearly and unambiguously (a concrete object/scene/action/emotion; no text, no letters, no words in the image).
Rules: keep the user's content when it is correct (do not rephrase for style only). The user often writes interlinear text like "Hun (Она) er (есть) snill (добрая)" — Russian glosses in parentheses after Norwegian words: this format is intentional, KEEP it (only fix wrong glosses/spelling inside it). Multi-line notes with examples written by the user are intentional too. If a field value ends with "…[truncated]", return exactly "__KEEP__" for that field. Fix real errors: wrong translation, misspelling, wrong gender/article, Norwegian and Russian sides swapped or mismatched, nynorsk/danish forms instead of bokmål. Fill empty fields. Write "issues" IN RUSSIAN, short, only for real errors in the user's original "no"/"ru" fields. Respond with ONLY valid JSON, no markdown.`;
  }

  /* ---------- catalogue of AI services ----------
   * type: bridge (a subscription through a program on the Mac, via bridge/server.py) | anthropic | openai (OpenAI-compatible chat/completions)
   *   bridge + cli: 'codex' → ChatGPT by the ChatGPT subscription (OpenAI Codex CLI); 'gemini' → Gemini by a Google account
   *   (Google Antigravity CLI — it replaced Gemini CLI for personal accounts in June 2026). See bridge/aicli.py.
   * sub: a subscription / account entry (listed first, a small Mac badge); twin: the same company's key-based entry
   * logo: the brand coin to draw (App.aiLogo) when the id has none of its own
   * domain -> real service icon (favicon)
   */
  const PROVIDERS = {
    claude: { name: 'Claude (подписка)', short: 'Claude', domain: 'claude.ai', type: 'bridge', sub: true, twin: 'anthropic', note: 'Ваш вход в Claude Code (Pro/Max) через мост — без ключа', models: ['', 'sonnet', 'opus', 'haiku'] },
    chatgpt: { name: 'ChatGPT (подписка)', short: 'ChatGPT', domain: 'chatgpt.com', type: 'bridge', cli: 'codex', logo: 'openai', sub: true, twin: 'openai', note: 'Ваша подписка ChatGPT (Plus, Pro, Business, Edu, Enterprise) через программу OpenAI Codex на этом Mac — без ключа и без оплаты за запросы', models: [''] },
    'gemini-cli': { name: 'Gemini (аккаунт Google)', short: 'Gemini', domain: 'gemini.google.com', type: 'bridge', cli: 'gemini', logo: 'gemini', sub: true, twin: 'gemini', free: true, limits: 'бесплатно, с лимитом Google в день/неделю · только на Mac', note: 'Ваш аккаунт Google через программу Google Antigravity CLI на этом Mac — без ключа. На бесплатном плане Google может использовать запросы для улучшения своих продуктов', models: [''] },
    anthropic: { name: 'Claude API (по ключу)', short: 'Claude', domain: 'claude.ai', type: 'anthropic', base: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-5', keyUrl: 'https://console.anthropic.com/settings/keys', models: ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5'] },
    openai: { name: 'ChatGPT API (по ключу)', short: 'ChatGPT', domain: 'chatgpt.com', type: 'openai', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', keyUrl: 'https://platform.openai.com/api-keys', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-mini'] },
    deepseek: { name: 'DeepSeek', short: 'DeepSeek', domain: 'deepseek.com', type: 'openai', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat', keyUrl: 'https://platform.deepseek.com/api_keys', models: ['deepseek-chat', 'deepseek-reasoner'], cheap: true },
    // Gemini Flash by default (Google's current stable Flash, Nov 2026: gemini-3.8-flash; gemini-2.5-flash is deprecated).
    // With a Gemini key it is the first AI asked for translations (subtitles, books, comparison) — see translateChain()
    gemini: { name: 'Gemini Flash (по ключу Google)', short: 'Gemini', domain: 'gemini.google.com', type: 'openai', base: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.8-flash', keyUrl: 'https://aistudio.google.com/apikey',
      note: 'Gemini Flash — быстрая и недорогая, хороша для перевода. Когда ключ добавлен, она первой переводит субтитры, книги и сравнение переводов.',
      models: ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-3.6-flash'],
      modelNames: { 'gemini-3.8-flash': 'Gemini Flash — быстрая и недорогая, хороша для перевода', 'gemini-flash-latest': 'Gemini Flash — всегда последняя версия', 'gemini-3.5-flash-lite': 'Gemini Flash-Lite — ещё дешевле, попроще', 'gemini-3.6-flash': 'Gemini Flash прошлого поколения' },
      free: true, limits: 'бесплатный лимит Google в минуту и в день · без карты' },
    groq: { name: 'Groq (GPT-OSS, Qwen, Llama)', short: 'Groq', domain: 'groq.com', type: 'openai', base: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b', keyUrl: 'https://console.groq.com/keys', models: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'llama-3.3-70b-versatile'], free: true, limits: '≈30 запросов/мин, ~1000 в день · без карты' },
    openrouter: { name: 'OpenRouter (бесплатные :free модели)', short: 'OpenRouter', domain: 'openrouter.ai', type: 'openai', base: 'https://openrouter.ai/api/v1', model: 'google/gemma-4-31b-it:free', keyUrl: 'https://openrouter.ai/keys', models: ['google/gemma-4-31b-it:free', 'nvidia/nemotron-3-ultra-550b-a55b:free', 'openai/gpt-4o-mini'], free: true, limits: '20 запросов/мин, 50 в день · без карты (список :free моделей меняется)' },
    mistral: { name: 'Mistral (план Experiment)', short: 'Mistral', domain: 'mistral.ai', type: 'openai', base: 'https://api.mistral.ai/v1', model: 'mistral-medium-latest', keyUrl: 'https://console.mistral.ai/api-keys', models: ['mistral-medium-latest', 'mistral-small-latest', 'mistral-large-latest'], free: true, limits: '≈1 запрос/сек, огромный месячный лимит · без карты (нужен телефон)' },
    cohere: { name: 'Cohere (есть модель-переводчик)', short: 'Cohere', domain: 'cohere.com', type: 'openai', base: 'https://api.cohere.ai/compatibility/v1', model: 'command-a-03-2025', keyUrl: 'https://dashboard.cohere.com/api-keys', models: ['command-a-03-2025', 'command-a-translate-08-2025'], free: true, limits: '20 запросов/мин, 1000 в месяц · без карты' },
    nvidia: { name: 'NVIDIA NIM (через мост на Mac)', short: 'NVIDIA', domain: 'nvidia.com', type: 'openai', base: 'https://integrate.api.nvidia.com/v1', model: 'meta/llama-3.3-70b-instruct', keyUrl: 'https://build.nvidia.com', models: ['meta/llama-3.3-70b-instruct', 'openai/gpt-oss-120b', 'qwen/qwen3-235b-a22b'], free: true, proxyOnly: true, limits: '40 запросов/мин, ~1000 кредитов · браузер не пускает — нужен мост' },
    zai: { name: 'Z.ai GLM Flash (через мост на Mac)', short: 'GLM', domain: 'z.ai', type: 'openai', base: 'https://api.z.ai/api/paas/v4', model: 'glm-4.5-flash', keyUrl: 'https://z.ai/manage-apikey/apikey-list', models: ['glm-4.5-flash', 'glm-4.7-flash'], free: true, proxyOnly: true, limits: 'бесплатные flash-модели · браузер не пускает — нужен мост' },
    xai: { name: 'Grok (xAI)', short: 'Grok', domain: 'x.ai', type: 'openai', base: 'https://api.x.ai/v1', model: 'grok-3-mini', keyUrl: 'https://console.x.ai', models: ['grok-3-mini', 'grok-3', 'grok-4'] },
    pollinations: { name: 'Pollinations — бесплатный ключ', short: 'Pollinations', domain: 'pollinations.ai', type: 'openai', base: 'https://text.pollinations.ai/openai', fullUrl: true, model: 'openai', free: true, keyUrl: 'https://enter.pollinations.ai', note: 'Тот же ключ, что для ИИ-рисунков (Настройки → Картинки)', models: ['openai', 'mistral', 'deepseek'] },
    ollama: { name: 'Ollama — локально на Mac, бесплатно', short: 'Ollama', domain: 'ollama.com', type: 'openai', base: 'http://localhost:11434/v1', model: 'llama3.1', noKey: true, free: true, local: true, keyUrl: 'https://ollama.com/download', models: ['llama3.1', 'qwen2.5', 'gemma2'] },
    custom: { name: 'Своя нейросеть (OpenAI-совместимая)', short: 'ИИ', domain: '', type: 'openai', base: '', model: '', editableBase: true, models: [] },
  };

  /* ---------- 🔢 tokens and money: approximate list prices, USD per 1 M tokens [input, output] (Nov 2026) ----------
   * Only to give a feel for paid keys — always shown as «примерно». Free tiers, subscriptions and Ollama cost nothing extra. */
  const PRICES = {
    anthropic: { 'claude-sonnet-4-5': [3, 15], 'claude-opus-4-5': [5, 25], 'claude-haiku-4-5': [1, 5], '*': [3, 15] },
    openai: { 'gpt-4o-mini': [0.15, 0.6], 'gpt-4o': [2.5, 10], 'gpt-4.1': [2, 8], 'gpt-4.1-mini': [0.4, 1.6], '*': [2.5, 10] },
    deepseek: { 'deepseek-chat': [0.28, 0.42], 'deepseek-reasoner': [0.28, 0.42], '*': [0.28, 0.42] },
    xai: { 'grok-3-mini': [0.3, 0.5], 'grok-3': [3, 15], 'grok-4': [3, 15], '*': [3, 15] },
  };
  /** ≈ tokens of a text when the service does not say (about 4 characters per token) */
  const estTok = s => Math.ceil(String(s || '').length / 4);
  const STRATEGIES = ['one', 'free', 'all', 'mine'];
  /* ---------- ⭐ «Norsk Kort Pro» — the app's own server (js/net.js → Edge Functions `ai` / `translate`) ----------
   * For signed-in Pro users (js/pro.js): no keys, the server holds them and the limits. NOT enumerable: the key/model lists
   * (Settings, 🤖 menus) walk Object.keys(PROVIDERS) and must not draw key fields for it; a direct look-up works everywhere
   * (AI.current() === 'pro' → PROVIDERS.pro.short). chain() / selected() add it themselves when Pro.ready().
   * The old hidden «Plus» placeholder (plusEnabled / plusToken / plusProxy) is gone: 'plus' is read as 'pro'. */
  const PRO = { name: 'Norsk Kort Pro', short: 'Pro', domain: '', type: 'server', model: 'claude-haiku-5-5', models: [], noSettings: true,
    note: 'Подписка Norsk Kort Pro: нейросеть без своих ключей' };
  Object.defineProperty(PROVIDERS, 'pro', { value: PRO, enumerable: false, configurable: true, writable: true });
  Object.defineProperty(PROVIDERS, 'plus', { value: PRO, enumerable: false, configurable: true, writable: true }); // old cards / settings
  const proReady = () => { try { return !!(window.Pro && Pro.ready()); } catch (e) { return false; } };
  /** a provider that cannot work in THIS environment, and why (one calm line) — '' when it can.
   *  Bridge subscriptions and «browser-blocked» keys need the Mac bridge; Ollama lives on this computer only. */
  function envBlock(id) {
    const p = PROVIDERS[id];
    if (!p) return 'недоступно';
    if (p.type === 'bridge' && !onMac()) return 'работает только в приложении на Mac';
    // «browser-blocked» keys: through the bridge on the Mac, through native HTTP in the store apps (Net.native), not on the site
    if (p.proxyOnly && !onMac() && !(window.Net && Net.isNative && Net.isNative())) return 'работает только в приложении на Mac и в приложении для телефона';
    if ((p.local || p.noKey) && !onMac()) return 'работает только на компьютере, где установлена программа';
    return '';
  }
  /* the Mac keeps the old dictionary: 'plus' chosen earlier → auto */
  const selSetting = () => { const v = (window.Store && Store.settings && Store.settings.aiProvider) || ''; return v === 'plus' ? 'pro' : v; };

  const AI = {
    FIELDS, FIELD_NAMES, PROVIDERS, FORM_TAGS, GENDER_TAGS, FORM_TAG_HINT,
    /* ---------- 📚 word forms: tag → «norsk name · Russian name» ---------- */
    /** the form's tag: its own `tag`, else found from the label (old cards: «Прошедшее (preteritum)», «Неопр. ед.», «presens»…) */
    formTag(f) {
      if (!f) return '';
      const own = String(f.tag || '').toLowerCase();
      if (FORM_TAGS[own]) return own;
      const l = String(f.label || '').trim().toLowerCase().replace(/ё/g, 'е'), no = String(f.no || '').trim().toLowerCase();
      if (l) {
        const head = l.split(' · ')[0].trim();
        const exact = Object.keys(FORM_TAGS).sort((a, b) => FORM_TAGS[b].no.length - FORM_TAGS[a].no.length).find(k => head === FORM_TAGS[k].no || head === FORM_TAGS[k].no.replace('/', ' / '));
        if (exact) return exact;
      }
      const t = window.Gram && Gram.term && l ? Gram.term(f.label) : null;
      const MAP = { infinitiv: 'inf', presens: 'pres', preteritum: 'pret', perfektum: 'perf', perfpart: 'perfpart', prespart: 'prespart', futurum: 'fut', pluskv: 'pluskv', imperativ: 'imp', passiv: 'passiv',
        ue: 'ue', be: 'be', uf: 'uf', bf: 'bf', entall: 'ue', flertall: 'uf', komparativ: 'komp', superlativ: 'sup', adjmf: 'adjmf', adjn: 'adjn', adjpl: 'adjpl', positiv: 'positiv' };
      let s = (t && MAP[t.key]) || '';
      if (!s && /опр\.?\s*форма|bestemt form|pos def/.test(l)) s = 'adjdef';
      if (s === 'sup' && /опр|bestemt|def/.test(l)) s = 'supdef';
      if (s === 'perfpart' && /^(jeg\s+)?har\s/.test(no)) s = 'perf';
      if (!s && /^å\s/.test(no)) s = 'inf';
      if (!s && /^(jeg\s+)?har\s/.test(no)) s = 'perf';
      if (!s && /^(jeg\s+)?hadde\s/.test(no)) s = 'pluskv';
      if (!s && /^(jeg\s+)?(skal|vil)\s|kommer til å/.test(no)) s = 'fut';
      return s;
    },
    /** a short note kept next to the name: «неправильный», «вариант с en» (from « · note» or an old label) */
    formNote(f) {
      const l = String(f && f.label || '');
      const tag = String(f && f.tag || '').toLowerCase();
      const parts = l.split(' · ');
      if (parts.length > 1 && (FORM_TAGS[tag] || Object.values(FORM_TAGS).some(x => x.no === parts[0].trim().toLowerCase()))) return parts.slice(1).join(' · ').trim();
      if (/неправильн|sterkt|uregelm/i.test(l)) return 'неправильный';
      if (/\ben[- ]?(вариант|форма|variant|form)\b|с en\b|\(en\)/i.test(l)) return 'вариант с en';
      return '';
    },
    /** { tag, no, name, note, tip } — name in Russian, or Ukrainian when the translation language is uk — or null (unknown label) */
    formInfo(f, lang) {
      const tag = this.formTag(f), T = FORM_TAGS[tag];
      if (!T) return null;
      lang = lang || ((window.Store && Store.settings && Store.settings.transLang) === 'uk' ? 'uk' : 'ru');
      const g = window.Gram && Gram.TERMS ? Object.values(Gram.TERMS).find(x => x.no && x.no.toLowerCase() === T.no.split(',')[0]) : null;
      let note = this.formNote(f);
      if (lang === 'uk') note = { неправильный: 'неправильне', 'вариант с en': 'варіант з en' }[note] || note;
      return { tag, no: T.no, name: lang === 'uk' ? T.uk : T.ru, note, tip: g && g.tip ? g.tip : '', pos: T.pos };
    },
    /** plain text «presens · настоящее время» (unknown: the label as it is) */
    formLabelText(f, lang) {
      const i = this.formInfo(f, lang);
      return i ? `${i.no} · ${i.name}${i.note ? ` (${i.note})` : ''}` : String(f && f.label || '');
    },
    /** HTML: «<b lang=nb>presens</b> · настоящее время» (unknown labels: through Gram, or escaped) */
    formLabelHtml(f, lang) {
      const i = this.formInfo(f, lang), esc = s => (window.U && U.esc ? U.esc(s) : String(s));
      if (!i) return window.Gram && Gram.label ? Gram.label(f && f.label) : esc(f && f.label || '');
      const title = `${i.no} — ${i.name}${i.tip ? '. ' + i.tip : ''}`;
      return `<span class="fl" title="${esc(title)}"><span class="fl-no" lang="nb">${esc(i.no)}</span><span class="fl-dot" aria-hidden="true"> · </span><span class="fl-ru">${esc(i.name)}</span>${i.note ? `<span class="fl-note"> (${esc(i.note)})</span>` : ''}</span>`;
    },
    /** kjønn of a noun → { key, no, art, name } or null */
    genderInfo(card, lang) {
      const g = window.Gram && Gram.cardGender ? Gram.cardGender(card) : '';
      const G = GENDER_TAGS[g];
      if (!G) return null;
      lang = lang || ((window.Store && Store.settings && Store.settings.transLang) === 'uk' ? 'uk' : 'ru');
      return { key: g, no: G.no, art: G.art, name: lang === 'uk' ? G.uk : G.ru };
    },
    /** auth: 'ok' | 'bad' (the Claude Code login on this Mac expired) | 'unknown' | 'error' (bridge/server.py checks it with one tiny request);
     *  path / loginCmd / tokenCmd: the exact commands for this Mac (never a token) */
    bridge: { ok: false, up: false, version: '', error: '', auth: 'unknown' },
    /** true when the app runs on the Mac (file / localhost) — only there the bridge and the Terminal hints make sense */
    onMac,
    SITE_NO_BRIDGE,
    async detectBridge(o = {}) {
      const was = this.bridge;
      const off = error => ({ ok: false, up: false, version: '', error, auth: 'unknown', cli: {} });
      // on the site the bridge cannot exist (it listens only on the Mac's own 127.0.0.1): don't even ask
      if (!onMac()) { this.bridge = off('Claude по подписке работает только в приложении на Mac — ' + SITE_NO_BRIDGE); return this.bridge; }
      if (!/^https?:$/.test(location.protocol)) { this.bridge = off('Приложение открыто как файл — запустите мост (bridge/server.py)'); return this.bridge; }
      // the old answer stays while the bridge is asked (it may wait for Claude a few seconds): a button pressed meanwhile
      // must not see «no AI» just because the question is still on its way
      try {
        const r = await fetch('/api/status' + (o.fresh ? '?fresh=1' : ''), { cache: 'no-store' });
        if (r.ok) { const j = await r.json(); this.setBridge(j, was); }
        else this.bridge = off('Мост не запущен');
      } catch (e) { this.bridge = off('Мост не запущен'); }
      // whoever asked (the voice window, the audio course…): the 🤖 button never keeps saying «Claude Max» after the login expired
      if (was && (was.ok !== this.bridge.ok || was.auth !== this.bridge.auth || this.cliSig(was) !== this.cliSig()) && window.App && App.updateBadge) { try { App.updateBadge(); } catch (e) { /* not drawn yet */ } }
      return this.bridge;
    },
    /** /api/status → this.bridge. An older bridge says nothing about the login (auth stays 'unknown' = as before).
     *  ok is false when the login is known to be broken: then the app never shows «Claude Max» */
    setBridge(j, was) {
      const auth = j.auth || (was && was.auth === 'bad' ? 'bad' : 'unknown');
      this.bridge = { ok: !!j.ok && auth !== 'bad', up: true, version: j.version || '', error: j.error || '', auth, authSource: j.authSource || '',
        path: j.path || (was && was.path) || '', loginCmd: j.loginCmd || '', tokenCmd: j.tokenCmd || '', tokenFile: j.tokenFile || '', checking: !!j.checking, newBridge: 'auth' in j,
        cli: j.cli || {}, cliBridge: 'cli' in j };
      if (auth === 'bad') this.bridge.error = 'Вход в Claude Code на этом Mac устарел — нужно войти снова';
      // the bridge is still asking Claude «are you there?» (its first tiny request): look again in a few seconds
      clearTimeout(this._authT);
      // (the bridge waits up to 90 s for that answer: keep looking for 2 minutes; detectBridge redraws the 🤖 button on a change)
      if (j.checking && (this._authTries = (this._authTries || 0) + 1) < 24) {
        this._authT = setTimeout(() => { this.detectBridge().catch(() => {}); }, 5000);
      } else if (!j.checking) this._authTries = 0;
    },
    /** «Я вошёл — проверить снова»: the bridge makes one tiny real request now → true when Claude answers */
    async recheckClaude() {
      await this.detectBridge({ fresh: true });
      if (this.bridge.up && !this.bridge.newBridge && this.bridge.ok) {
        // an older bridge cannot check the login itself: one tiny real request tells the truth
        try { await this.callBridge({ system: 'Reply with exactly: OK', user: 'OK?', quiet: true }); } catch (e) { /* callBridge marked it */ }
      }
      if (window.App && App.updateBadge) App.updateBadge();
      return !!this.bridge.ok;
    },

    /* ---------- providers ---------- */
    cfg(id) {
      const st = Store.settings;
      st.aiCfg = st.aiCfg || {};
      const c = st.aiCfg[id] || (st.aiCfg[id] = {});
      // migrate the old single Claude key
      if (id === 'anthropic' && !c.key && st.claudeKey) { c.key = st.claudeKey; c.model = c.model || st.claudeModel; }
      if (id === 'claude' && c.model == null && st.bridgeModel) c.model = st.bridgeModel;
      return c;
    },
    /** connected AND usable here: off the Mac, Ollama (no key, localhost) and the bridge-only keys never count as connected
     *  (phone audit 2026-11-23: Ollama showed «подключена» on a phone). On the Mac everything is exactly as before. */
    configured(id) {
      const p = PROVIDERS[id]; if (!p) return false;
      if (p.type === 'server') return proReady();
      if (p.type === 'bridge') return p.cli ? this.cliReady(p.cli) : this.bridge.ok;
      if (envBlock(id)) return false;
      const c = this.cfg(id);
      // Pollinations now rejects anonymous requests — its free key is required
      if (id === 'pollinations') return !!((c.key || '').trim() || (Store.settings.pollinationsToken || '').trim());
      if (p.editableBase && !(c.base || '').trim()) return false;
      return !!(p.noKey || (c.key || '').trim());
    },
    /** '' = this AI can work here; else one calm line why not (for the lists: hide it or show the line — W7 hook) */
    envBlock,
    /** usable in this environment at all (with a key / sign-in), regardless of whether it is set up yet */
    usableHere(id) { return !!PROVIDERS[id] && !envBlock(id); },
    /** the AI the person chose (Settings → 🤖 Нейросети; «auto»: the subscription on the Mac, Plus, else the first connected) */
    selected() {
      const sel = selSetting() || 'auto';
      if (sel !== 'auto' && !(sel === 'pro' && !proReady())) return PROVIDERS[sel] ? sel : null;
      if (this.bridge.ok) return 'claude';
      if (proReady()) return 'pro';
      const ids = Object.keys(PROVIDERS).filter(id => !PROVIDERS[id].noKey && this.configured(id));
      return ids.find(id => !this.resting(id)) || ids[0] || null;
    },
    /** provider actually used now: the chosen one — unless it cannot answer right now (the login expired, the bridge is off,
     *  Ollama is not running, its limit ran out a moment ago): then the next AI of the chosen order answers meanwhile (AI.call
     *  asks it anyway) and the 🤖 button, the live check and the card marks say who — back by itself when the chosen one rests no more */
    current() {
      const sel = this.selected();
      if (!sel) return null;
      if (this.strategy() === 'one') return sel;
      // the first of the chosen order that can answer now («Мой порядок» may start with another; «бесплатные» skip a paid choice)
      const ch = this.chain();
      return ch.find(id => !this.resting(id)) || ch[0] || sel;
    },
    /* ---------- 🔁 the order of AIs (Settings → 🤖 Нейросети and the check sheet; Store.settings.aiStrategy) ----------
     * 'one'  — only the chosen AI (it rests → the work waits for it);
     * 'free' — the free ones, one after another (one takes over when another reaches its limit);
     * 'all'  — every connected AI: the chosen one, then the free ones, the subscriptions, the paid keys (default);
     * 'mine' — the person's own order (Store.settings.aiOrder) */
    STRATEGIES,
    strategy() { let s = ''; try { s = Store.settings.aiStrategy; } catch (e) { /* not loaded yet */ } return STRATEGIES.includes(s) ? s : 'all'; },
    /** 'free' (a free tier) | 'local' (Ollama on this Mac) | 'sub' (a subscription) | 'paid' (a key that is billed per token) */
    costKind(id) {
      const p = PROVIDERS[id];
      if (!p) return 'paid';
      if (p.local) return 'local';
      if (p.type === 'bridge' || p.type === 'server') return p.free ? 'free' : 'sub';
      if (id === 'openrouter') return /:free$/.test(this.model(id)) ? 'free' : 'paid';
      return p.free ? 'free' : 'paid';
    },
    isFree(id) { const k = this.costKind(id); return k === 'free' || k === 'local'; },
    /** ≈ USD for a usage { in, out } with a paid key (null: free / subscription / price unknown) */
    costOf(id, u) {
      if (!u || this.costKind(id) !== 'paid') return null;
      if (u.usd != null && isFinite(u.usd)) return +u.usd;
      let tab = PRICES[id], m = this.model(id);
      if (id === 'openrouter' && /^openai\//.test(m)) { tab = PRICES.openai; m = m.replace(/^openai\//, ''); }
      const pr = tab && (tab[m] || tab['*']);
      return pr ? ((u.in || 0) * pr[0] + (u.out || 0) * pr[1]) / 1e6 : null;
    },
    /** a service's own count of tokens: OpenAI-compatible `usage`, Gemini `usageMetadata`, Anthropic `usage`, Claude Code `usage` + `total_cost_usd` */
    usageOf(d) {
      if (!d || typeof d !== 'object') return null;
      const u = d.usage || d.usageMetadata || (d.response && (d.response.usage || d.response.usageMetadata)) || null;
      if (!u || typeof u !== 'object') return null;
      const n = v => (isFinite(+v) ? +v : 0);
      const inp = n(u.prompt_tokens != null ? u.prompt_tokens : u.input_tokens != null ? u.input_tokens : u.promptTokenCount) + n(u.cache_read_input_tokens) + n(u.cache_creation_input_tokens);
      const out = n(u.completion_tokens != null ? u.completion_tokens : u.output_tokens != null ? u.output_tokens : u.candidatesTokenCount) + n(u.thoughtsTokenCount);
      if (!inp && !out) return null;
      const r = { in: inp, out };
      if (d.total_cost_usd != null && isFinite(+d.total_cost_usd)) r.usd = +d.total_cost_usd;
      return r;
    },
    estTokens: estTok,
    PRICES,
    mode() { return this.current() === 'claude' ? 'bridge' : 'api'; },
    available(id) { id = id || this.current(); return !!id && this.configured(id); },
    model(id) { const p = PROVIDERS[id]; return (this.cfg(id).model || '').trim() || p.model || ''; },
    name(id) { id = id || this.current(); return id && PROVIDERS[id] ? PROVIDERS[id].short : 'ИИ'; },
    shortName() { return this.name(); },
    who() {
      const st = Store.settings;
      const name = (st.userName || '').trim();
      const id = this.current();
      const label = id === 'claude' ? `Claude ${st.plan || ''}`.trim() : (id ? PROVIDERS[id].short : 'ИИ');
      return `${name ? name + ' · ' : ''}${label}`;
    },
    /** real service icon */
    icon(id, size = 16, title) {
      const p = PROVIDERS[id];
      if (!p) return '';
      const t = U.esc(title || p.name);
      if (!p.domain) return `<span class="ai-ico ai-ico-bot" title="${t}">${BOT(size)}</span>`;
      return `<img class="ai-ico" src="https://www.google.com/s2/favicons?domain=${p.domain}&sz=64" width="${size}" height="${size}" alt="${U.esc(p.short)}" title="${t}" onerror="this.outerHTML=window.App&amp;&amp;App.robotSvg?App.robotSvg(${+size}):''">`;
    },
    /** icons of every AI that checked this card */
    cardBadges(card, size = 15) {
      const list = (card.aiChecks || []).slice();
      if (!list.length && card.aiChecked) list.push({ p: card.aiBy || 'claude', t: card.aiChecked });
      const seen = new Set();
      return list.filter(x => PROVIDERS[x.p] && !seen.has(x.p) && seen.add(x.p))
        .map(x => this.icon(x.p, size, `Проверено: ${PROVIDERS[x.p].name}${x.m ? ' (' + x.m + ')' : ''} · ${U.fmtDate(x.t)}`)).join('');
    },
    /** fields to store on a card after a check */
    /** opts: { action, fields, note, history:false, pend: [fields waiting for a decision] } — also writes the card history (provenance) */
    stamp(card, id, opts = {}) {
      id = id || this.lastProvider || this.current();
      const entry = { p: id, m: this.model(id), t: Date.now() };
      const list = ((card && card.aiChecks) || []).filter(x => x.p !== id).concat(entry);
      const out = { aiChecked: entry.t, aiBy: id, aiChecks: list };
      // ✓ a check marks both sides of the card «проверено» (js/aihub.js draws the marks), each side with the AI that checked it
      // (byFront / byBack; `by` = the last one). A side with a fix that still waits for the person's decision (opts.pend) keeps
      // its earlier mark (or stays unmarked); a proposal that only ADDS (the field was empty) holds nothing back.
      // opts.fields of the faces = «исправлено: было → стало» (an empty «было» = «добавлено»)
      if (opts.action === 'check') {
        const F = (window.Store && Store.AI_FACE) || { front: ['no', 'example'], back: ['ru', 'uk', 'exampleRu', 'description'] };
        const prev = (card && card.aiCheck) || null;
        const empty = f => !String(card && card[f] != null ? card[f] : '').trim();
        const pend = (opts.pend || []).filter(f => !empty(f)), fields = opts.fields || {};
        const ac = { by: id }, fixed = {};
        ['front', 'back'].forEach(side => {
          const who = side === 'front' ? 'byFront' : 'byBack';
          const was = prev && prev[side] ? prev[who] || prev.by : '';
          const keepFx = () => F[side].forEach(k => { if (prev.fixed && prev.fixed[k]) fixed[k] = prev.fixed[k]; });
          if (!F[side].some(f => pend.includes(f))) {
            ac[side] = entry.t; ac[who] = id;
            if (was === id) keepFx(); // the same AI looked again: its earlier fixes of this side still describe the text
            F[side].forEach(k => { const v = fields[k]; if (v) fixed[k] = { o: String(v.old == null ? '' : v.old).slice(0, 300), n: String(v.new == null ? '' : v.new).slice(0, 300) }; });
          } else if (was && !F[side].some(k => fields[k])) { ac[side] = prev[side]; ac[who] = was; keepFx(); } // still waiting: the earlier mark stays
        });
        if (Object.keys(fixed).length) ac.fixed = fixed;
        out.aiCheck = ac.front || ac.back ? ac : null;
      }
      if (opts.history !== false && window.Prov) {
        out.history = Prov.add(card, Prov.entry('ai:' + id, opts.action || 'check', opts.fields, opts.note || (entry.m ? 'модель ' + entry.m : '')));
      }
      return out;
    },

    async callBridge({ system, user, quiet, sink }) {
      let res;
      try {
        res = await fetch('/api/claude', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ system, user, model: quiet ? 'haiku' : this.model('claude') }) });
      } catch (e) { throw new Error(onMac() ? 'Мост к Claude не отвечает — запустите bridge/server.py' : 'Claude по подписке работает только в приложении на Mac. Здесь подключите другую нейросеть: Настройки → 🤖 Нейросети (есть бесплатные).'); }
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        // the Claude Code login on this Mac expired (a new bridge says auth:true; an older one sends Claude Code's words):
        // stop using it at once (the badge stops saying «Claude Max»), no retries, one calm explanation (js/aihub.js)
        if (j.auth || (res.status !== 429 && /\b401\b|oauth|authenticat|re-?authenticate|not logged in|\/login|token (has )?expired|login expired/i.test(j.error || ''))) {
          const b = this.bridge;
          Object.assign(b, { ok: false, auth: 'bad', error: 'Вход в Claude Code на этом Mac устарел — нужно войти снова' });
          if (j.path) b.path = j.path;
          if (j.loginCmd) b.loginCmd = j.loginCmd;
          if (j.tokenCmd) b.tokenCmd = j.tokenCmd;
          if (j.authSource) b.authSource = j.authSource;
          if (window.App && App.updateBadge) App.updateBadge();
          if (!quiet && window.AIHub && AIHub.authNotice) try { AIHub.authNotice(); } catch (e) { /* optional */ }
          throw Object.assign(new Error('Claude: нужно снова войти в Claude Code на этом Mac'), { auth: true, provider: 'claude' });
        }
        throw new Error('Claude: ' + (j.error || res.statusText));
      }
      if (this.bridge.auth !== 'ok' && this.bridge.up) { this.bridge.auth = 'ok'; this.bridge.ok = true; this.bridge.error = ''; }
      if (sink) sink._raw = j;
      return j.text || '';
    },

    /* ---------- 💬 ChatGPT / Gemini by subscription through their programs on the Mac (bridge/aicli.py) ---------- */
    /** what the bridge knows about one program: { installed, version, loggedIn, authMode, install, login, limitUntil, problem… } or null */
    cliState(tool) { const c = this.bridge && this.bridge.up && this.bridge.cli; return (c && c[tool]) || null; },
    /** the program is installed, signed in (the last check / real answer said so) and its plan fits */
    cliReady(tool) { const s = this.cliState(tool); return !!(s && s.installed && s.loggedIn === true && s.problem !== 'plan' && s.problem !== 'moved'); },
    cliSig(b) { const c = (b || this.bridge || {}).cli || {}; return Object.keys(c).sort().map(k => `${k}:${c[k].installed ? 1 : 0}${c[k].loggedIn}${c[k].problem || ''}`).join('|'); },
    cliMerge(cli) {
      if (!cli || !this.bridge.up) return;
      const before = this.cliSig();
      this.bridge.cli = Object.assign({}, this.bridge.cli || {}, cli);
      if (before !== this.cliSig() && window.App && App.updateBadge) { try { App.updateBadge(); } catch (e) { /* not drawn yet */ } }
    },
    /** GET /api/ai/status (fresh: «Проверить» — one tiny real request) → the program's state */
    async cliRefresh(tool, fresh) {
      const r = await fetch(`/api/ai/status?tool=${encodeURIComponent(tool)}${fresh ? '&fresh=1' : ''}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('Мост не ответил');
      const j = await r.json();
      this.cliMerge(j.cli);
      if (fresh && this.cliReady(tool)) { const id = this.cliId(tool); if (id) this.unrest(id); }
      return this.cliState(tool);
    },
    async cliPost(path, body) {
      const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (j.cli) this.cliMerge(j.cli);
      if (!r.ok) throw new Error(j.error || 'Мост ответил ошибкой');
      return j;
    },
    cliInstall(tool) { return this.cliPost('/api/ai/install', { tool }); },
    cliLogin(tool, terminal) { return this.cliPost('/api/ai/login', { tool, terminal: !!terminal }); },
    cliId(tool) { return Object.keys(PROVIDERS).find(id => PROVIDERS[id].cli === tool) || null; },
    async callCli(id, { system, user, sink }) {
      const p = PROVIDERS[id], tool = p.cli, label = `${p.short} · ${id === 'gemini-cli' ? 'аккаунт Google' : 'подписка'}`;
      const s = this.cliState(tool);
      if (s && s.limitUntil > Date.now()) {
        throw Object.assign(new Error(`${label}: лимит исчерпан до ${new Date(s.limitUntil).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`), { retryAfter: Math.ceil((s.limitUntil - Date.now()) / 1000), provider: id });
      }
      let res;
      try {
        res = await fetch('/api/ai/cli', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tool, system, user, model: this.model(id) }) });
      } catch (e) { throw new Error(onMac() ? `${label}: мост на Mac не отвечает — запустите его снова` : `${label} работает только в приложении на Mac. Здесь подключите нейросеть по ключу.`); }
      const j = await res.json().catch(() => ({}));
      const st = this.bridge.cli && this.bridge.cli[tool];
      if (res.ok) {
        if (st && (st.loggedIn !== true || st.limitUntil)) { st.loggedIn = true; st.limitUntil = 0; st.problem = ''; if (window.App && App.updateBadge) App.updateBadge(); }
        if (sink) sink._raw = j;
        return j.text || '';
      }
      if (j.auth || j.kind === 'moved' || j.kind === 'plan' || j.notInstalled) {
        // it cannot answer until the person signs in / installs: stop offering it (the 🤖 button too), the next AI answers
        if (st) { if (j.notInstalled) st.installed = false; else if (j.auth) st.loggedIn = false; else st.problem = j.kind; }
        if (window.App && App.updateBadge) App.updateBadge();
        throw Object.assign(new Error(j.error || `${label}: нужно войти в аккаунт`), { provider: id, cli: true });
      }
      if (j.limit) {
        const ra = Math.max(60, +j.retryAfter || 3600);
        if (st) { st.limitUntil = Date.now() + ra * 1000; st.problem = 'limit'; }
        throw Object.assign(new Error(j.error || `${label}: лимит исчерпан`), { retryAfter: ra, provider: id });
      }
      throw new Error(j.error || `${label}: ${res.statusText || 'ошибка'}`);
    },

    /** HTTP POST: direct from the browser; if blocked (CORS): native HTTP in the store apps (Net.native), the bridge on the
     *  Mac when it is running (Net.isMacBridge), else a calm line */
    async post(url, headers, body) {
      let res;
      try {
        res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      } catch (e) {
        if (navigator.onLine === false) throw new Error(window.U && U.NICE && U.NICE.off ? U.NICE.off : 'Нет интернета — попробуйте, когда связь появится');
        if (window.Net && Net.isNative && Net.isNative()) {
          res = await Net.native(url, { method: 'POST', headers, body: JSON.stringify(body) }).catch(() => null);
          if (!res) throw new Error('Нет связи с сервисом — проверьте интернет и попробуйте ещё раз');
          const d = await res.json().catch(() => ({}));
          return { ok: res.ok, status: res.status, data: d };
        }
        // the bridge's /api/proxy only on the Mac with the bridge running (Net.isMacBridge)
        if (!(onMac() && this.bridge.up)) throw new Error(onMac() ? 'Этот сервис не принимает запросы прямо из браузера — запустите мост Norsk Kort на Mac, он передаст запрос.'
          : 'Нет связи с сервисом. Проверьте интернет. Если интернет есть — этот сервис не принимает запросы прямо из браузера: выберите другую нейросеть в Настройках → 🤖 Нейросети (например, Gemini или Groq — бесплатно).');
        res = await fetch('/api/proxy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, headers, body }) })
          .catch(err => { throw new Error(window.U && U.niceErr ? U.niceErr(err) : 'Сервис сейчас не отвечает — попробуйте позже'); });
      }
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    },
    errText(id, status, data) {
      const n = PROVIDERS[id].short;
      const msg = (data && (data.error && (data.error.message || data.error)) || data.message || data.detail) || '';
      if (status === 401 || status === 403) return `${n}: неверный ключ или нет доступа`;
      if (status === 404) return `${n}: модель «${this.model(id)}» не найдена — выберите другую в Настройках`;
      if (status === 429) return `${n}: лимит запросов исчерпан, подождите немного`;
      if (status === 402) return `${n}: на счёте нет средств`;
      const t = `${n}: ${typeof msg === 'string' && msg ? msg : 'сервис ответил ошибкой'}`;
      return (window.U && U.calm ? U.calm(t) : t).slice(0, 400);
    },

    /** order of AIs to try: the chosen one first, then every other connected one (free first);
     *  a network whose limit ran out a moment ago goes to the end (it is asked only if all others fail too) */
    chain() {
      const sel = this.selected(), strat = this.strategy();
      const ok = id => !!PROVIDERS[id] && this.configured(id);
      const order = (Array.isArray(Store.settings.aiOrder) ? Store.settings.aiOrder : []).map(id => (id === 'plus' ? 'pro' : id)).filter(id => PROVIDERS[id]);
      // key-less local services (Ollama) only when chosen (or put in «Мой порядок») — otherwise every failure would end with a localhost error
      const conn = Object.keys(PROVIDERS).filter(id => ok(id) && (!PROVIDERS[id].noKey || id === sel || (strat === 'mine' && order.includes(id))));
      if (proReady()) conn.unshift('pro'); // ⭐ Pro (not enumerable): right after the Mac subscriptions (selected() puts it first in auto)
      // ⭐ Pro right after the chosen one (§3.2: Mac subscriptions → Pro → own keys); then free, subscriptions, paid keys
      const tier = id => (id === 'pro' ? -1 : ({ free: 0, local: 0, sub: 1, paid: 2 })[this.costKind(id)]);
      const rest = conn.filter(id => id !== sel).sort((a, b) => tier(a) - tier(b));
      let all;
      if (strat === 'one') all = sel && ok(sel) ? [sel] : [];
      else if (strat === 'free') { all = [sel, ...rest].filter(id => id && ok(id) && this.isFree(id)); if (!all.length && sel && ok(sel)) all = [sel]; }
      else if (strat === 'mine') { const mine = order.filter(id => conn.includes(id)); all = [...mine, ...[sel, ...rest].filter(id => id && ok(id) && !mine.includes(id))]; }
      else all = [sel, ...rest].filter(id => id && ok(id));
      all = all.filter((id, i) => all.indexOf(id) === i);
      return [...all.filter(id => !this.resting(id)), ...all.filter(id => this.resting(id))];
    },
    /** every AI of the chosen order rests (a limit / not running): { at, id } — when the first of them is back; else null */
    allResting() {
      const ids = this.chain();
      if (!ids.length || ids.some(id => !this.resting(id))) return null;
      let best = null;
      ids.forEach(id => { const r = this.restMap()[id]; if (r && (!best || r.until < best.at)) best = { at: r.until, id }; });
      return best;
    },
    restUntil(id) { const r = this.restMap()[id]; return r && Date.now() < r.until ? r.until : 0; },
    /** translations (subtitles, books, comparison — js/translators.js asks with a «Translate …» system prompt):
     *  Norsk Kort Pro (signed in + Pro → the server's `translate`), then Gemini Flash (when its key is set) go first */
    translateChain() {
      const all = this.chain();
      const lead = ['pro', 'gemini'].filter(id => all.includes(id) && !this.resting(id));
      return [...lead, ...all.filter(id => !lead.includes(id))];
    },
    isTranslateAsk(args) { return !!(args && (args.translate || /^Translate\b/.test(String(args.system || '')))); },
    /* ---------- ⭐ Norsk Kort Pro: the server (js/net.js) ---------- */
    proReady,
    trLang,
    /** the task name the server expects (docs/api-contract.md `ai`): args.task, else read from the prompt */
    proTask(args) {
      if (args.task) return args.task;
      const sy = String(args.system || ''), us = String(args.user || '').slice(0, 400);
      if (/^Check these Norwegian|^Check and improve these flashcards/.test(us)) return 'card.check';
      if (/^Create a complete flashcard/.test(us)) return 'card.fill';
      if (/^Напиши объяснение для карточки/.test(us)) return 'card.explain';
      if (/^Give ALL main grammatical forms/.test(us)) return 'card.forms';
      if (/example sentences/.test(us) && /"examples"/.test(String(args.user || ''))) return 'card.examples';
      if (/SYNONYMS/.test(us)) return 'card.synonyms';
      if (/^Generate \d+ useful, distinct Norwegian/.test(us)) return 'deck.generate';
      if (/^Translate to English\. Reply with 1-3 words/.test(sy)) return 'card.english';
      if (/gloss/i.test(sy + us)) return 'gloss';
      return 'generic';
    },
    /** «Translate each <lang> line of the JSON array into <lang>» + a JSON array of strings → the server's `translate` */
    proBatch(args) {
      const m = /^Translate each (.+?) line of the JSON array into (.+?)\./.exec(String(args.system || ''));
      if (!m) return null;
      const code = n => (/norw|bokm/i.test(n) ? 'no' : /russ/i.test(n) ? 'ru' : /ukrain/i.test(n) ? 'uk' : /engl/i.test(n) ? 'en' : '');
      const src = code(m[1]), dst = code(m[2]);
      if (!src || !['ru', 'uk', 'no'].includes(dst) || src === dst) return null;
      let arr; try { arr = JSON.parse(String(args.user || '')); } catch (e) { return null; }
      if (!Array.isArray(arr) || !arr.length || arr.length > 200 || arr.some(x => typeof x !== 'string' || x.length > 1000) || arr.join('').length > 20000) return null;
      return { src, dst, lines: arr.map((text, i) => ({ id: String(i), text })) };
    },
    /** one request to the Norsk Kort server; errors become calm lines the chain understands (limit → rests, others → next AI) */
    async callPro(args) {
      const calm = (e, extra) => Object.assign(new Error('Norsk Kort Pro: ' + (e && e.nk ? e.message.charAt(0).toLowerCase() + e.message.slice(1) : 'сервер сейчас недоступен')), { provider: 'pro', nk: e && e.nk ? e.code : '' }, extra || {});
      try {
        const batch = this.proBatch(args);
        if (batch) {
          const r = await Net.callFn('translate', Object.assign(batch, { ctx: 'subs' }));
          const out = batch.lines.map(l => { const x = (r.lines || []).find(y => y && String(y.id) === l.id); return x ? String(x.translation || '') : ''; });
          if (!out.some(Boolean)) throw Object.assign(new Error('empty'), { nk: false });
          args._raw = null;
          return JSON.stringify(out);
        }
        const task = this.proTask(args);
        const input = { system: String(args.system || ''), user: String(args.user || '') };
        if (task === 'deck.generate') { const n = /^Generate (\d+)/.exec(input.user); if (n) input.count = Math.max(1, Math.min(50, +n[1])); }
        const r = await Net.callFn('ai', { task, lang: { explain: trLang() }, input, max_out: Math.max(16, Math.min(16000, +args.maxTokens || 1200)) });
        args._raw = { usage: { input_tokens: (r.usage && r.usage.in) || 0, output_tokens: (r.usage && r.usage.out) || 0 } };
        args.cut = !!r.cut;
        if (!r.text) throw Object.assign(new Error('Norsk Kort Pro: пустой ответ'), { provider: 'pro' });
        return String(r.text);
      } catch (e) {
        if (!e || !e.nk) throw e && /^Norsk Kort Pro/.test(e.message || '') ? e : calm(null, { restMin: 2, down: true });
        switch (e.code) {
          case 'no_entitlement': if (window.Pro) Pro.markInactive(); throw calm(e);
          case 'cap_reached': { const t = Date.parse(e.resetsAt || ''); throw calm(e, { retryAfter: Number.isFinite(t) ? Math.max(60, Math.ceil((t - Date.now()) / 1000)) : (e.retryAfter || 6 * 3600), limit: true }); }
          case 'rate_limited': throw calm(e, { retryAfter: Math.max(30, e.retryAfter || 60), limit: true });
          case 'provider_unavailable': case 'internal': case 'timeout': case 'network': throw calm(e, { restMin: 2, down: true });
          case 'unauthenticated': case 'signed_out': throw calm(e, { auth: false });
          default: throw calm(e);
        }
      }
    },
    /** 🔑 the one entry for a button that needs an AI (W7 hook — instead of Guides.needAI directly):
     *  an AI is available → run(); else, when the Norsk Kort server is set up → Pro.require(feature) (sign-in → paywall →
     *  purchase) and run() right after; else the «Нужна нейросеть» guide. → run()'s result, or null */
    async need(feature, run) {
      // ⭐ Pro answers: the one-time «may we send this text?» first (js/aiconsent.js; asked again when pressed again)
      if (this.available() && this.current() === 'pro' && window.AIConsent && !AIConsent.granted() && !(await AIConsent.ensure({ feature, force: true }))) {
        if (!this.chain().some(id => id !== 'pro')) return null;
      }
      if (this.available()) return run ? run() : true;
      if (window.Pro && Pro.offered()) {
        const ok = await Pro.require(feature, { reason: 'ai' });
        if (ok && this.available()) return run ? run() : true;
        return null;
      }
      if (window.Guides && Guides.needAI) Guides.needAI(feature); else if (window.App) App.go('settings');
      return null;
    },
    /* ---------- 🔁 limits: a network that said «limit reached» rests, the next one answers meanwhile ---------- */
    _rest: null,
    restMap() {
      if (!this._rest) { try { this._rest = JSON.parse(localStorage.getItem('nk-ai-rest') || '{}'); } catch (e) { this._rest = {}; } }
      return this._rest;
    },
    /** how long: a per-minute limit — a few minutes (longer each time in a row); a daily limit / no money — hours */
    rest(id, err) {
      const m = this.restMap(), now = Date.now(), msg = String(err && err.message || '');
      const prev = m[id] && now - m[id].at < 3 * 3600e3 ? m[id].n || 0 : 0;
      let min = Math.min(60, 3 * 2 ** prev); // 3, 6, 12, 24, 48, 60 minutes
      if (/day|daily|сутки|в день|per.?day|quota|на счёте нет|402|credit|billing/i.test(msg)) min = 6 * 60;
      // a subscription on the Mac says when its limit resets (ChatGPT: «try again in 1 hour 5 minutes»): exactly that long
      if (err && err.retryAfter > 0) min = Math.max(1, Math.min(7 * 24 * 60, Math.ceil(err.retryAfter / 60)));
      // not running / no such model (Ollama on this Mac): a short rest — it is asked again a little later, cheaply
      if (err && err.restMin > 0) min = err.restMin;
      m[id] = { until: now + min * 60e3, at: now, n: prev + 1, why: err && err.down ? 'down' : 'limit' };
      try { localStorage.setItem('nk-ai-rest', JSON.stringify(m)); } catch (e) { /* full */ }
      // the 🤖 button shows the AI that answers now (a resting one gives way until its limit resets)
      this.badge();
    },
    badge() { if (window.App && App.updateBadge) { try { App.updateBadge(); } catch (e) { /* not drawn yet */ } } },
    resting(id) { const r = this.restMap()[id]; return !!(r && Date.now() < r.until); },
    unrest(id) { const m = this.restMap(); if (m[id]) { const was = Date.now() < m[id].until; delete m[id]; try { localStorage.setItem('nk-ai-rest', JSON.stringify(m)); } catch (e) { /* full */ } if (was) this.badge(); } },
    /* ---------- 🖥 a local AI (Ollama): one quick look «is it running, is the model there?» before the long request ----------
     * Without it a stopped Ollama made every card wait for its error before the next AI answered, and the check showed
     * «Ollama проверяет» all the while. The answer is kept 30 s. */
    _probe: {},
    /** null when the local AI can answer; else the calm error (down: true, restMin) — not running / no such model */
    async localProblem(id, base) {
      const p = PROVIDERS[id];
      if (!base) { const c = this.cfg(id); base = ((c.base || '') || p.base).trim().replace(/\/$/, ''); }
      const pr = await this.localUp(id, base);
      const down = (m, restMin) => Object.assign(new Error(`${p.short}: ${m}`), { provider: id, down: true, restMin });
      if (!pr.up) return down(!onMac() ? 'работает только в приложении на Mac' : pr.timeout ? 'не ответила за 1,5 секунды — программа Ollama занята или зависла' : 'не запущена на этом Mac — откройте программу Ollama', 5);
      const m = this.model(id);
      if (pr.models && !pr.models.some(x => x === m || x.split(':')[0] === m.split(':')[0])) {
        return down(pr.models.length ? `модель «${m}» не скачана — в Терминале: ollama pull ${m} (или выберите в Настройках одну из скачанных: ${pr.models.slice(0, 3).join(', ')})` : `ни одной модели не скачано — в Терминале: ollama pull ${m}`, 30);
      }
      return null;
    },
    /** before a long job (the deck check sheet): is the chosen local AI there? No → it rests a little, the next one starts. → the error or null */
    async checkLocal(id) {
      id = id || this.selected();
      if (!PROVIDERS[id] || !PROVIDERS[id].local || this.resting(id) || this.strategy() === 'one') return null;
      const err = await this.localProblem(id);
      if (err) this.rest(id, err);
      return err;
    },
    async localUp(id, base) {
      const c = this._probe[id];
      if (c && Date.now() - c.t < 30000 && c.base === base) return c;
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const tm = setTimeout(() => { if (ctl) ctl.abort(); }, 1500);
      let res;
      try {
        const r = await fetch(base + '/models', { cache: 'no-store', signal: ctl ? ctl.signal : undefined });
        const j = await r.json().catch(() => ({}));
        res = { up: r.ok || r.status === 404, models: Array.isArray(j.data) ? j.data.map(x => String(x.id || '')) : null };
      } catch (e) { res = { up: false, timeout: !!(ctl && ctl.signal.aborted) }; }
      finally { clearTimeout(tm); }
      res.t = Date.now(); res.base = base;
      return (this._probe[id] = res);
    },
    /** «limit» answers (not a wrong key or a broken request — those are not cured by waiting) */
    isLimit(err) { return !!(err && err.limit) || /лимит|limit|429|quota|402|нет средств|rate|перегруж|overload|503|временно/i.test(String(err && err.message || '')); },
    /**
     * Ask the AI. If it fails (limit reached, quota, error, offline) and auto-switching is on,
     * the next connected AI answers instead. this.lastProvider = the AI that really answered
     * (its icon goes on the card).
     */
    async call(args) {
      // always the whole chain: when one network's limit runs out, the next connected one answers (no setting turns it off)
      const tr = !args.provider && this.isTranslateAsk(args);
      const ids = args.provider ? [args.provider] : tr ? this.translateChain() : this.chain();
      if (!ids.length) throw new Error('Подключите нейросеть в Настройках (Claude по подписке, бесплатные Gemini / Groq / Cerebras или любую другую)');
      let lastErr, authErr;
      // who was to answer (before a limit makes another one «current»): the toast names it
      const chosen0 = tr ? ids[0] : this.current();
      const hook = (fn, ...a) => { if (typeof fn === 'function') { try { fn(...a); } catch (e) { console.warn('AI hook', e); } } };
      for (let k = 0; k < ids.length; k++) {
        // args.onTry(id): the AI being asked right now · args.onSwitch(from, to, err): the previous one did not answer
        if (k > 0) hook(args.onSwitch, ids[k - 1], ids[k], lastErr);
        hook(args.onTry, ids[k]);
        args._raw = null;
        try {
          const t = await this.callOnce(ids[k], args);
          this.lastProvider = ids[k];
          args.answeredBy = ids[k];
          // 🔢 tokens: the service's own count when it sends one, else ≈ characters / 4
          const u = this.usageOf(args._raw) || { in: estTok(args.system) + estTok(args.user), out: estTok(t), est: true };
          u.p = ids[k];
          const usd = this.costOf(ids[k], u);
          if (usd != null) u.usd = usd; else delete u.usd;
          args.usage = u; args._raw = null;
          if (Array.isArray(args.meter)) args.meter.push(u);
          this.unrest(ids[k]);
          const chosen = chosen0;
          if (ids[k] !== chosen && chosen && !args.quiet && !args.onSwitch && Date.now() - (this._switchToast || 0) > 60000 && (this._switchToast = Date.now())) {
            UI.toast(`${PROVIDERS[chosen].short} ${this.resting(chosen) ? 'исчерпал лимит' : 'не ответил'} — переводит ${PROVIDERS[ids[k]].short}`, '', 4000);
          }
          if (window.TrNotice) try { TrNotice.badge(); } catch (e) { /* no player */ }
          return t;
        } catch (e) {
          lastErr = e;
          if (e && e.auth) authErr = authErr || e;
          // a limit — or a local AI that is not running: it rests; the next calls start with another one
          if (!args.provider && (this.isLimit(e) || (e && e.down))) this.rest(ids[k], e);
          console.warn('AI', ids[k], e.message);
        }
      }
      // nobody answered and Claude asked to log in again: that is the one thing the person can fix — say it, not the last error
      throw authErr || lastErr;
    },

    /** one AI, one request. args._raw ← the service's answer object (AI.call reads its token count from it) */
    async callOnce(id, args) {
      const { system, user, maxTokens = 2048, temperature = 0.2 } = args;
      if (id === 'plus') id = 'pro';
      if (!PROVIDERS[id] || (id === 'pro' && !proReady())) throw new Error('Эта нейросеть сейчас недоступна — работает другая');
      if (id === 'claude' && this.bridge.up && this.bridge.auth === 'bad') throw Object.assign(new Error('Claude: нужно снова войти в Claude Code на этом Mac'), { auth: true, provider: 'claude' });
      if (!this.configured(id)) throw new Error(envBlock(id) ? `${PROVIDERS[id].short}: ${envBlock(id)}` : `${PROVIDERS[id].name}: не настроено — добавьте ключ в Настройках`);
      const p = PROVIDERS[id];
      if (p.type === 'server') return this.callPro(args);
      const c = this.cfg(id);
      if (p.type === 'bridge') return p.cli ? this.callCli(id, { system, user, sink: args }) : this.callBridge({ system, user, sink: args });
      if (p.type === 'anthropic') {
        const r = await this.post(p.base, {
          'content-type': 'application/json', 'x-api-key': c.key.trim(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true',
        }, { model: this.model(id), max_tokens: maxTokens, temperature, system, messages: [{ role: 'user', content: user }] });
        if (!r.ok) throw new Error(this.errText(id, r.status, r.data));
        args._raw = r.data;
        return (r.data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      }
      // OpenAI-compatible
      const base = ((p.editableBase || id === 'ollama' ? c.base : '') || p.base).trim().replace(/\/$/, '');
      // 🖥 Ollama on this Mac: a 1.5-second look first — not running / no such model → the next AI answers at once
      if (p.local || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\//i.test(base + '/')) {
        const err = await this.localProblem(id, base);
        if (err) throw err;
      }
      const url = p.fullUrl ? base : base + '/chat/completions';
      const headers = { 'content-type': 'application/json' };
      const key = ((c.key || '') || (id === 'pollinations' ? Store.settings.pollinationsToken || '' : '')).trim();
      if (key) headers.authorization = 'Bearer ' + key;
      if (id === 'openrouter') { headers['HTTP-Referer'] = location.origin.startsWith('http') ? location.origin : 'https://norsk-kort.local'; headers['X-Title'] = 'Norsk Kort'; }
      const body = { model: this.model(id), messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature, max_tokens: maxTokens };
      // args.think: 'low' — a short mechanical task (word glosses): Gemini «thinks» by default and its OpenAI-compatible
      // endpoint counts those thinking tokens inside max_tokens, so the JSON answer came back cut or empty (v231).
      // reasoning_effort 'low' is the documented switch there (thinking cannot be turned off for Gemini 3+); only for Gemini
      if (args.think === 'low' && id === 'gemini') body.reasoning_effort = 'low';
      let r = await this.post(url, headers, body);
      if (!r.ok && r.status === 400 && body.reasoning_effort && /reasoning/i.test(JSON.stringify(r.data))) {
        delete body.reasoning_effort; // an older model / a changed API: ask once more without it
        r = await this.post(url, headers, body);
      }
      if (!r.ok && r.status === 400 && /temperature|max_tokens|max_completion/i.test(JSON.stringify(r.data))) {
        // some reasoning models reject these parameters
        delete body.temperature; delete body.max_tokens;
        r = await this.post(url, headers, body);
      }
      if (!r.ok) throw new Error(this.errText(id, r.status, r.data));
      args._raw = r.data;
      const ch = r.data.choices && r.data.choices[0];
      // the answer hit max_tokens (args.cut tells the caller why its JSON may be broken)
      args.cut = !!(ch && /length|max_tokens/i.test(String(ch.finish_reason || '')));
      const txt = ch && ch.message ? (ch.message.content || '') : (typeof r.data === 'string' ? r.data : '');
      if (!txt) throw new Error(`${p.short}: пустой ответ${args.cut ? ' (не хватило места для ответа)' : ''}`);
      return Array.isArray(txt) ? txt.map(x => x.text || '').join('') : String(txt).replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    },

    parseJSON(text) {
      let t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
      try { return JSON.parse(t); } catch (e) { /* continue */ }
      const first = Math.min(...['{', '['].map(ch => { const i = t.indexOf(ch); return i < 0 ? Infinity : i; }));
      const last = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
      if (first !== Infinity && last > first) {
        try { return JSON.parse(t.slice(first, last + 1)); } catch (e) { /* continue */ }
      }
      throw new Error(`${this.name(this.lastProvider)} вернул некорректный ответ — попробуйте ещё раз или другую модель`);
    },

    async test(provider) {
      let t;
      try { t = await this.call({ provider, system: 'Reply with one short sentence.', user: 'Say "Hei! Jeg er klar." exactly.', maxTokens: 60 }); }
      catch (e) { if (window.AIHub && AIHub.onTestFail) try { AIHub.onTestFail(provider); } catch (x) { /* optional */ } throw e; }
      // 🤖 a network passed the check: right after the first one the «Центр нейросети» opens once (js/aihub.js)
      if (window.AIHub && AIHub.onConnected) try { AIHub.onConnected(provider); } catch (x) { /* optional */ }
      return t.trim().slice(0, 80);
    },

    cardPayload(c) {
      const o = { id: c.id };
      FIELDS.forEach(k => {
        const v = String(c[k] || '');
        o[k] = v.length > 350 ? v.slice(0, 350) + '…[truncated]' : v;
      });
      return o;
    },

    /* ---------- ✅ the teacher's check (js/aihub.js): a verdict on the translation + all forms + (whole card) every field ----------
     * opts.depth: 'word' — the headword, its translation and the word's forms (+ one example when the card has none);
     *             'card' — also the Ukrainian translation, word class, example + its translation, explanation, examples, synonyms.
     * Result per card (on top of the usual { id, ok, issues, changes }): verdict 'correct' | 'alternative' | 'wrong', reason
     * (one natural Russian sentence), and array fields (forms / examples / synonyms) as changes[f] = { old, new (text), arr, oldArr }.
     * opts.full (default: the setting «📚 Добавлять все формы и примеры по временам», on): the check ALWAYS leaves the card with
     * all forms of the word — also when the translation is right — and (whole card) short examples per tense; an answer without
     * the forms of a word that has them is not taken as is: one small follow-up request (AI.forms / AI.examples) fills them. */
    checkFull() { return !(window.Store && Store.settings && Store.settings.aiCheckFull === false); },
    /** cards per request of the teacher's check: forms + examples for every card make the answer long — smaller portions */
    reviewBatch(depth, full) {
      // ⭐ the Pro server caps an answer (card.check ≤ 1 500 tokens): small portions there
      if (this.current() === 'pro') return depth === 'card' && (full == null ? this.checkFull() : full) ? 1 : 2;
      return depth === 'card' && (full == null ? this.checkFull() : full) ? 4 : 6;
    },
    /** which forms a word must have: { kind, req: [tags] } — null for words without forms (prepositions, phrases, «ikke»…) */
    formsNeed(card, wc) {
      const h = String(card && card.no || '').split('\n')[0].replace(/[!?.,;:«»"()]/g, ' ').trim().toLowerCase().replace(/\s+/g, ' ');
      if (!h || h.split(' ').length > 3) return null;
      wc = String(wc || (card && card.wordClass) || '').toLowerCase();
      const word = h.replace(/^(å|en|ei|et)\s+/, '');
      if (/^verb/.test(wc) || /^å\s/.test(h)) return { kind: 'verb', req: ['inf', 'pres', 'pret', 'perf', 'fut'] };
      if (/^subst|^noun|^сущ/.test(wc) || /^(en|ei|et)\s/.test(h)) return { kind: 'noun', req: ['ue', 'be', 'uf', 'bf'] };
      if (/^adj|^прил/.test(wc)) return { kind: 'adj', req: ['adjmf', 'adjn', 'adjpl', 'komp', 'sup'] };
      // adverbs with comparison: gjerne – heller – helst, mye – mer – mest, lenge – lenger – lengst, ofte – oftere – oftest…
      if (/^adv|^нареч/.test(wc) && !word.includes(' ') && (COMPARABLE_ADV.includes(word) || /(lig|ig)$/.test(word))) return { kind: 'adv', req: ['komp', 'sup'] };
      // the part of speech is not known at all (neither the card nor the answer says): one word may still have forms — ask once
      if (!wc && !word.includes(' ')) return { kind: 'any', req: [] };
      return null;
    },
    /** the required tags a list of forms still lacks */
    formsMissing(forms, need) {
      if (!need) return [];
      if (need.kind === 'any') return (forms || []).length ? [] : ['?'];
      const have = new Set((forms || []).map(f => this.formTag(f)).filter(Boolean));
      if (have.has('supdef')) have.add('sup');
      return need.req.filter(t => !have.has(t));
    },
    /** the learner's forms stay; the missing tags come from the AI's list — all in the usual order (infinitiv → futurum, ue → bf…) */
    formsMerge(had, add) {
      const tags = new Set(had.map(f => this.formTag(f)).filter(Boolean));
      const out = had.slice();
      add.forEach(f => { const t = this.formTag(f); if (t && !tags.has(t)) { tags.add(t); out.push(f); } });
      const ord = Object.keys(FORM_TAGS), at = f => { const i = ord.indexOf(this.formTag(f)); return i < 0 ? 999 : i; };
      return out.map((f, i) => [f, i]).sort((a, b) => (at(a[0]) - at(b[0])) || (a[1] - b[1])).map(x => x[0]);
    },
    reviewPayload(c, depth) {
      const cut = (v, n) => { v = String(v || ''); return v.length > n ? v.slice(0, n) + '…[truncated]' : v; };
      const o = { id: c.id, no: cut(c.no, 200), ru: cut(c.ru, 200), wordClass: String(c.wordClass || '') };
      if ((c.forms || []).length) o.forms = c.forms.slice(0, 14).map(f => ({ tag: this.formTag(f) || '', label: f.label || '', no: f.no || '', ru: f.ru || '' }));
      o.example = cut(c.example, 300); o.exampleRu = cut(c.exampleRu, 300);
      if (depth === 'card') {
        if (String(c.uk || '').trim()) o.uk = cut(c.uk, 200);
        o.description = cut(c.description, 700);
        if ((c.examples || []).length) o.examples = c.examples.slice(0, 10).map(x => ({ label: x.label || '', no: x.no || '', ru: x.ru || '' }));
        if ((c.synonyms || []).length) o.synonyms = c.synonyms.slice(0, 8).map(x => ({ no: x.no || '', ru: x.ru || '', note: x.note || '' }));
      }
      return o;
    },
    reviewPrompt(part, depth, full) {
      const whole = depth === 'card';
      if (full == null) full = this.checkFull();
      const exNew = whole && full;
      return `Check these Norwegian Bokmål ⇄ Russian flashcards the way a careful teacher would, and complete them.
For EACH card return one object:
{"id":"<same id>","verdict":"correct|alternative|wrong","reason":"...","ru":"...","alt":"","no":"...","wordClass":"...","gender":"","forms":[{"tag":"...","no":"...","ru":"...","note":""}],"formsOk":true,"example":"...","exampleRu":"..."${whole ? ',"uk":"...","description":"...","examples":[{"label":"...","no":"...","ru":"...","note":""}],"examplesOk":true,"synonyms":[{"no":"...","ru":"...","note":"..."}],"synonymsOk":true' : ''},"issues":["..."]}
RULES
1. The Norwegian headword "no" stays EXACTLY as the learner wrote it (same form, same capital letter). Example: "Håper" is the present tense — do NOT turn it into "å håpe". Change "no" only for a real misspelling (then explain it in "issues").
2. The translation "ru" must translate THAT form: "Håper" → "надеюсь" (present tense), not the infinitive "надеяться".
3. verdict:
   - "correct": the card's translation is right → "ru" = the card's translation unchanged.
   - "alternative": the card's translation is acceptable, but a clearly more common or more exact variant exists → "ru" unchanged, "alt" = that variant (1–3 words).
   - "wrong": wrong meaning, wrong tense/person/number, wrong part of speech, or a different word → "ru" = the corrected translation.
4. "reason": ONE short sentence in natural, idiomatic Russian, the way a Russian teacher would say it — never a word-for-word calque. Example: "Håper — настоящее время: «(я) надеюсь»". For "correct" an empty string is fine.
${full ? `5. "forms" is REQUIRED in EVERY answer, whatever the verdict — also when the translation is correct: the learner learns the word in all its forms and tenses, one form alone is useless. Give ALL main forms of the word's lemma, each with the Russian translation of THAT form (natural Russian). Every form has a "tag" from this fixed list (exactly one of: ${FORM_TAG_HINT}); "note" is optional, 1–3 Russian words (e.g. "неправильный", "вариант с en"), usually "".
   - verb (at least inf, pres, pret, perf, fut; imp when it exists): inf å håpe — надеяться; pres håper — надеюсь / надеешься / надеется; pret håpet — надеялся; perf har håpet — надеялся (уже); fut skal/vil håpe — буду надеяться; imp håp! — надейся!
   - noun: "gender" en/ei/et; ue en bil — машина; be bilen — (эта) машина; uf biler — машины; bf bilene — (эти) машины.
   - adjective: adjmf stor — большой, большая; adjn stort — большое; adjpl store — большие; komp større — больше; sup størst — самый большой.
   - adverb with degrees of comparison: positiv gjerne — охотно; komp heller — охотнее, лучше; sup helst — охотнее всего, лучше всего. Likewise mye – mer – mest, lenge – lenger – lengst, ofte – oftere – oftest, godt – bedre – best.
   - preposition, conjunction, phrase, adverb without comparison: [].
   If the card already has "forms": check every form and its translation — all correct and complete → "formsOk": true and return them unchanged; anything wrong or missing → "formsOk": false and return the full corrected list.` : `5. "forms": only when the card already has "forms" — check every form and its translation: all correct → "formsOk": true and return them unchanged; anything wrong → "formsOk": false and return the full corrected list. A card without forms → "forms": [] (do not add them).`}
6. "example"/"exampleRu": if the card has an example, return it unchanged when it is correct, otherwise corrected (and say so in "issues"). If it has none — write ONE short natural sentence (A1–B1) with the headword and its Russian translation.
7. "wordClass": one of substantiv, verb, adjektiv, adverb, preposisjon, pronomen, konjunksjon, tallord, interjeksjon, uttrykk.${whole ? `
8. Whole card: also check "uk" (Ukrainian translation, only if the card has one), "description" (the explanation: grammar, usage, expressions — every Norwegian phrase followed by its Russian translation in parentheses), "examples" and "synonyms" with their translations. A field that is correct → return exactly "__KEEP__" (for text) or the same list with "examplesOk"/"synonymsOk": true. Only real errors are fixed; keep the learner's format and content (interlinear glosses like "Hun (Она) er (есть)" are intentional). A card with no description or synonyms → leave them empty ("" / []); do not invent them.${exNew ? `
   "examples" — EXAMPLES PER TENSE: a card with no "examples" gets 3–5 short natural sentences (A2–B1, everyday life in Norway), one for each main form/tense of the word, with a natural Russian translation: verb — presens, preteritum, perfektum, futurum (+ imperativ when natural); noun — singular and plural, indefinite and definite; adjective — the forms and the comparison; adverb with comparison — positiv, komparativ, superlativ; other words — 3 typical situations. "label": a short Russian name with the Norwegian term, e.g. "Настоящее (presens)", "Прошедшее (preteritum)", "Перфект (perfektum)", "Будущее (futurum)". "note": a very short Russian hint when this form is used (max 70 chars), or "". At most 5 examples.` : ' A card with no examples → "examples": [].'}` : ''}
9. "issues": short notes in Russian only about real errors in the learner's card ([] when everything is right).
Respond with ONLY valid JSON: {"cards":[...]} — one object per input card, same ids.

Cards:
${JSON.stringify(part.map(c => this.reviewPayload(c, depth)))}`;
    },
    reviewDiff(card, r, depth, full) {
      if (full == null) full = this.checkFull();
      const s = v => String(v == null ? '' : v).trim();
      const keep = v => !v || v === '__KEEP__' || /\[truncated\]$/.test(v);
      const changes = {}, issues = (Array.isArray(r.issues) ? r.issues : []).map(String).filter(Boolean).slice(0, 6);
      let verdict = ['correct', 'alternative', 'wrong'].includes(r.verdict) ? r.verdict : 'correct';
      const reason = s(r.reason).slice(0, 240);
      const ru = s(card.ru), nru = s(r.ru), alt = s(r.alt).slice(0, 120);
      const firstRu = ru.split('\n')[0];
      if (verdict === 'wrong' && nru && !keep(nru) && nru !== ru && !/\[truncated\]$/.test(ru)) {
        // the card had several lines (a translation + notes): only its first line is replaced
        changes.ru = { old: ru, new: ru.includes('\n') ? nru.split('\n')[0] + ru.slice(firstRu.length) : nru, kind: 'fix' };
      } else if (verdict === 'alternative' && alt && !(window.Translators && Translators.agrees(alt, ru)) && !U.norm(ru).includes(U.norm(alt))) {
        changes.ru = { old: ru, new: (ru.includes('\n') ? firstRu.replace(/[,\s]+$/, '') + ', ' + alt + ru.slice(firstRu.length) : `${ru.replace(/[,\s]+$/, '')}, ${alt}`), kind: 'alt', alt };
      } else if (verdict !== 'correct') verdict = verdict === 'wrong' && nru === ru ? 'correct' : verdict;
      const no = s(card.no), nno = s(r.no);
      // the headword: only a real misspelling (a case change or the infinitive instead of the learner's form is not taken)
      if (nno && !keep(nno) && nno.toLowerCase() !== no.toLowerCase() && !no.includes('\n') && !/^å\s/i.test(nno) === !/^å\s/i.test(no)) changes.no = { old: no, new: nno };
      const wc = s(r.wordClass).toLowerCase();
      const wcOk = wc && !keep(wc) && /^[a-zæøå]{3,20}$/.test(wc);
      if (wcOk && (!s(card.wordClass) || (depth === 'card' && wc !== s(card.wordClass).toLowerCase()))) changes.wordClass = { old: s(card.wordClass), new: wc };
      const list = (a, max, fn) => (Array.isArray(a) ? a : []).filter(x => x && x.no).slice(0, max).map(fn);
      const forms = list(r.forms, 14, formFromAI);
      const had = card.forms || [];
      // 📚 the forms: added whatever the verdict (a right translation still needs all its forms); an answer that left them out
      // (or gave only some) is completed by a follow-up request in checkCards (gaps.forms)
      const need = full ? this.formsNeed(card, wcOk ? wc : card.wordClass) : null;
      let best = null, fix = false;
      if (forms.length && had.length && r.formsOk === false) { best = forms; fix = true; }
      else if (forms.length && !had.length && full) best = forms;
      else if (forms.length && had.length && full && this.formsMissing(had, need).length) best = this.formsMerge(had, forms);
      // kind: 'add' — the forms were added (or the missing ones added to the learner's), 'fix' — the AI corrected them
      if (best && listTxt(best) !== listTxt(had)) changes.forms = { old: listTxt(had), new: listTxt(best), arr: best, oldArr: had, kind: fix ? 'fix' : 'add' };
      const gaps = {};
      if (need && this.formsMissing(best || had, need).length) gaps.forms = { base: best || had, need, fix };
      const ex = s(r.example), exr = s(r.exampleRu);
      if (!s(card.example)) {
        if (ex && !keep(ex)) { changes.example = { old: '', new: ex }; if (exr && !keep(exr)) changes.exampleRu = { old: s(card.exampleRu), new: exr }; }
      } else {
        if (ex && !keep(ex) && ex !== s(card.example) && issues.length) changes.example = { old: s(card.example), new: ex };
        if (exr && !keep(exr) && exr !== s(card.exampleRu) && (issues.length || !s(card.exampleRu))) changes.exampleRu = { old: s(card.exampleRu), new: exr };
      }
      if (depth === 'card') {
        const uk = s(r.uk);
        if (s(card.uk) && uk && !keep(uk) && uk !== s(card.uk)) changes.uk = { old: s(card.uk), new: uk };
        const d = s(r.description);
        if (s(card.description) && d && !keep(d) && d !== s(card.description)) changes.description = { old: s(card.description), new: d };
        const exs = list(r.examples, 10, x => ({ label: String(x.label || '').slice(0, 60), no: String(x.no).slice(0, 300), ru: String(x.ru || '').slice(0, 300), note: String(x.note || '').slice(0, 120) }));
        const hadEx = card.examples || [];
        if (hadEx.length && r.examplesOk === false && exs.length && listTxt(exs) !== listTxt(hadEx)) {
          // the hints «когда так говорят» stay with their sentences
          exs.forEach((x, i) => { const o = hadEx.find(y => U.norm(y.no) === U.norm(x.no)) || hadEx[i]; x.note = o && o.note ? o.note : ''; });
          changes.examples = { old: listTxt(hadEx, true), new: listTxt(exs, true), arr: exs, oldArr: hadEx };
        } else if (!hadEx.length && full) {
          // 💬 examples per tense: a card without them gets a few short sentences (one per main form)
          const add = exs.slice(0, 5);
          if (add.length) changes.examples = { old: '', new: listTxt(add, true), arr: add, oldArr: [], kind: 'add' };
          else if (this.exampleable(card)) gaps.examples = true;
        }
        const syn = list(r.synonyms, 8, x => ({ no: String(x.no).slice(0, 80), ru: String(x.ru || '').slice(0, 120), note: String(x.note || '').slice(0, 200) }));
        const hadSyn = card.synonyms || [];
        if (hadSyn.length && r.synonymsOk === false && syn.length && listTxt(syn, true) !== listTxt(hadSyn, true)) changes.synonyms = { old: listTxt(hadSyn, true), new: listTxt(syn, true), arr: syn, oldArr: hadSyn };
      }
      if (verdict !== 'correct' && reason && !issues.includes(reason)) issues.unshift(reason);
      const ok = verdict === 'correct' && !issues.length && !changes.no;
      const out = { id: card.id, ok, verdict, reason, alt, gender: s(r.gender).slice(0, 3), issues, changes };
      if (gaps.forms || gaps.examples) Object.defineProperty(out, 'gaps', { value: gaps, enumerable: false, configurable: true });
      return out;
    },
    /** a word or a short phrase (not a long text): examples per tense make sense for it */
    exampleable(card) {
      const h = String(card && card.no || '').split('\n')[0].trim();
      return !!h && h.length <= 60 && h.split(/\s+/).length <= 4;
    },
    /** the answer left gaps (no forms for a word that has them, no examples): one small request each — never an empty list taken as is */
    async fillGaps(card, res, o = {}) {
      const g = res.gaps;
      if (!g) return res;
      delete res.gaps;
      const had = card.forms || [];
      if (g.forms) {
        try {
          const f = await this.forms(card, { provider: o.provider, meter: o.meter, onTry: o.onTry, onSwitch: o.onSwitch });
          const base = g.forms.base || [];
          const arr = base.length ? this.formsMerge(base, f.forms) : f.forms;
          if (arr.length && listTxt(arr) !== listTxt(had)) res.changes.forms = { old: listTxt(had), new: listTxt(arr), arr, oldArr: had, kind: g.forms.fix ? 'fix' : 'add' };
          if (!res.gender && f.gender) res.gender = String(f.gender).slice(0, 3);
          const wc = String(f.wordClass || '').toLowerCase();
          if (wc && /^[a-zæøå]{3,20}$/.test(wc) && !String(card.wordClass || '').trim() && !res.changes.wordClass) res.changes.wordClass = { old: '', new: wc };
        } catch (e) { console.warn('AI check: forms follow-up', e && e.message); }
      }
      if (g.examples) {
        try {
          const forms = res.changes.forms ? res.changes.forms.arr : had;
          const exs = (await this.examples(Object.assign({}, card, { forms }), { provider: o.provider, max: 5, meter: o.meter, onTry: o.onTry, onSwitch: o.onSwitch })).slice(0, 5);
          if (exs.length) res.changes.examples = { old: '', new: listTxt(exs, true), arr: exs, oldArr: [], kind: 'add' };
        } catch (e) { console.warn('AI check: examples follow-up', e && e.message); }
      }
      return res;
    },

    /** check many cards; onProgress(done,total). Returns [{id, ok, issues, changes:{field:{old,new}}}]
     *  opts.depth ('word' | 'card') → the teacher's check above (verdict, forms…); opts.provider → only that AI answers;
     *  opts.full → all forms + examples per tense (default: the setting) */
    async checkCards(cards, onProgress, opts = {}) {
      const prov = opts.provider || this.current();
      const out = [];
      const depth = opts.depth === 'word' || opts.depth === 'card' ? opts.depth : '';
      const full = opts.full == null ? this.checkFull() : !!opts.full;
      const chunk = depth ? this.reviewBatch(depth, full) : 12;
      for (let i = 0; i < cards.length; i += chunk) {
        const part = cards.slice(i, i + chunk);
        const user = depth ? this.reviewPrompt(part, depth, full)
          : `Check and improve these flashcards (Norwegian ⇄ Russian). Return JSON: {"cards":[{"id":"<same id>","ok":true|false,"issues":["..."],${FIELDS.map(f => `"${f}":"..."`).join(',')}}]} — one object per input card, same ids, all fields filled.\n\nCards:\n${JSON.stringify(part.map(c => this.cardPayload(c)))}`;
        let parsed;
        // opts.meter: every request's tokens are added to it; opts.onTry / opts.onSwitch: who is asked right now (js/aihub.js)
        const a = { system: systemPrompt(), user, maxTokens: depth ? 9000 : 6000, provider: opts.provider, meter: opts.meter, onTry: opts.onTry, onSwitch: opts.onSwitch };
        try {
          parsed = this.parseJSON(await this.call(a));
        } catch (e) {
          if (i === 0) throw e;
          UI.toast('Часть карт не проверена: ' + e.message, 'warn');
          continue;
        }
        const by = a.answeredBy || this.lastProvider || prov;
        const arr = Array.isArray(parsed) ? parsed : (parsed.cards || []);
        for (const r of arr) {
          const c = r && part.find(x => x.id === r.id);
          if (!c) continue;
          const res = Object.assign(depth ? this.reviewDiff(c, r, depth, full) : this.diff(c, r), { by });
          // the gaps: a small follow-up request (the same chain of AIs; the mark keeps the name of the one that checked)
          if (res.gaps) await this.fillGaps(c, res, { provider: opts.provider, meter: opts.meter, onTry: opts.onTry, onSwitch: opts.onSwitch });
          out.push(res);
        }
        onProgress && onProgress(Math.min(i + chunk, cards.length), cards.length);
      }
      return out;
    },
    /** ≈ tokens of the teacher's check of these cards in ONE request (the instruction + the cards), before it is sent */
    estimateCheck(cards, depth, full) {
      if (!cards || !cards.length) return 0;
      return estTok(systemPrompt()) + estTok(this.reviewPrompt(cards, depth === 'word' ? 'word' : 'card', full));
    },
    diff(card, r) {
      const changes = {};
      FIELDS.forEach(f => {
        if (r[f] == null) return;
        const nv = String(r[f]).trim();
        if (nv === '__KEEP__' || nv.endsWith('[truncated]')) return;
        const ov = String(card[f] || '').trim();
        if (nv && nv !== ov) changes[f] = { old: ov, new: nv };
      });
      return { id: card.id, ok: r.ok !== false && !(r.issues && r.issues.length), issues: Array.isArray(r.issues) ? r.issues : [], changes };
    },

    /** fill a card from partial input (no and/or ru) */
    async fillCard(partial) {
      const user = `Create a complete flashcard from this partial input. If only Russian is given, find the best Norwegian equivalent. Return JSON object with keys ${FIELDS.join(', ')}.\nInput: ${JSON.stringify({ no: partial.no || '', ru: partial.ru || '', description: partial.description || '' })}`;
      return this.parseJSON(await this.call({ system: systemPrompt(), user, maxTokens: 1200 }));
    },

    /**
     * Explanation written straight into the card, in the learner's format:
     * Norwegian phrases / expressions / examples, each followed by the Russian translation in parentheses.
     */
    async explain(card) {
      const no = String(card.no || '').slice(0, 600), ru = String(card.ru || '').slice(0, 600);
      const desc = String(card.description || '').slice(0, 800);
      const user = `Напиши объяснение для карточки. Формат — обычный текст (без заголовков #, можно **жирный**), строго по разделам:
**Значение:** кратко по-русски, оттенки и когда употребляется.
**Формы:** грамматические формы на норвежском, у каждой перевод в скобках — например: hente – henter (забирает) – hentet (забрал) – har hentet (забрал).
**Примеры:** 4–6 естественных предложений, каждое на отдельной строке: норвежское предложение, затем перевод в скобках — «Jeg skal hente barna fra skolen i dag. (Я заберу детей из школы сегодня.)».
**Выражения:** 2–4 устойчивых выражения/словосочетания: «å hente seg inn (восстановиться)».
**Запомнить:** короткая мнемоника для русскоговорящего и частая ошибка.
Не повторяй то, что уже есть в объяснении карточки. Если перевод на карточке неточен — первой строкой напиши «⚠️ Точнее: …».
Карточка:
Норвежский: ${no}
Русский: ${ru}${desc ? '\nУже есть в объяснении: ' + desc : ''}`;
      const t = await this.call({ system: `${appContext()}\nYou are a friendly, precise Norwegian teacher for Russian speakers. Answer in Russian, following the house style strictly.`, user, maxTokens: 1600, temperature: 0.5 });
      return String(t).replace(/^#+\s*/gm, '').trim();
    },

    /** all grammatical forms of the word, each with its own Russian translation */
    async forms(card, o = {}) {
      const user = `Give ALL main grammatical forms of this Norwegian Bokmål word, each with an accurate Russian translation of THAT form.
Return ONLY JSON: {"wordClass":"verb|substantiv|adjektiv|...","gender":"","forms":[{"tag":"...","no":"...","ru":"...","note":""}]}
- tag: exactly one of this fixed list — ${FORM_TAG_HINT}. note: optional, 1–3 Russian words, usually "".
- verb: inf (å + verb), pres, pret, perf (har + partisipp), pluskv (hadde + partisipp), fut (skal / vil + infinitiv; "kommer til å" as a second fut with note "kommer til å"), imp, perfpart. ru: translate each form naturally, e.g. drakk -> "пил / выпил", har drukket -> "выпил, пил (уже)", skal drikke -> "буду пить", drikk! -> "пей!". Irregular (sterkt) verbs: pret with note "неправильный".
- noun: gender in "gender" (en/ei/et), forms: ue, be, uf, bf; for feminine also the "en"-variant (ue / be with note "вариант с en"). ru: "машина", "(эта) машина", "машины", "(эти) машины".
- adjective: adjmf, adjn, adjpl, komp, sup (and supdef when useful) — with translations.
- adverb with degrees of comparison: positiv, komp, sup — gjerne (охотно) – heller (охотнее, лучше) – helst (охотнее всего, лучше всего); mye – mer – mest; lenge – lenger – lengst; ofte – oftere – oftest.
- preposition/conjunction/phrase, adverb without comparison: forms = [] (empty) unless it has real variants.
Card: Norwegian: ${String(card.no).split('\n')[0].slice(0, 120)} · Russian: ${String(card.ru).split('\n')[0].slice(0, 120)}${card.wordClass ? ' · word class: ' + String(card.wordClass).slice(0, 30) : ''}`;
      const r = this.parseJSON(await this.call({ system: systemPrompt(), user, maxTokens: 1500, temperature: 0.1, provider: o.provider, meter: o.meter, onTry: o.onTry, onSwitch: o.onSwitch }));
      const forms = (Array.isArray(r.forms) ? r.forms : []).filter(f => f && f.no).map(formFromAI);
      return { forms, wordClass: r.wordClass || '', gender: r.gender || '' };
    },

    /** example sentences for every form / tense, with translation and usage */
    async examples(card, o = {}) {
      const formsHint = (card.forms || []).map(f => f.no).join(', ');
      const max = o.max > 0 ? o.max : 0;
      const user = `Write ${max ? 'short ' : ''}natural example sentences (level A2–B1, everyday Norway life) showing how this word is used in EACH of its ${max ? 'main ' : ''}forms/tenses.
Return ONLY JSON: {"examples":[{"label":"...","no":"...","ru":"...","note":"..."}]}${max ? `
- AT MOST ${max} examples, short sentences (up to ~10 words).` : ''}
- verb: one sentence for each: ${max ? 'Настоящее (presens), Прошедшее (preteritum), Перфект (perfektum), Будущее (futurum), and Повелительное (imperativ) when it is natural.' : 'Настоящее (presens), Прошедшее (preteritum), Перфект (perfektum), Будущее (skal …), Будущее (kommer til å …), Повелительное (imperativ), and one with a modal verb (kan/må/vil + infinitiv).'}
- noun: sentences using indefinite/definite singular and plural.
- adjective: sentences with the different forms + comparison.
- adverb with comparison (gjerne – heller – helst): positiv, komparativ, superlativ.
- other words: ${max ? '3' : '4–5'} sentences in typical situations.
- label: short Russian label with Norwegian term, e.g. "Прошедшее (preteritum)". ru: natural Russian translation. note: very short Russian hint WHEN this form is used (max 70 chars), e.g. "законченное действие в прошлом с указанием времени".
Card: Norwegian: ${String(card.no).split('\n')[0].slice(0, 120)} · Russian: ${String(card.ru).split('\n')[0].slice(0, 120)}${formsHint ? ' · forms: ' + formsHint : ''}`;
      const r = this.parseJSON(await this.call({ system: systemPrompt(), user, maxTokens: max ? 1400 : 2200, temperature: 0.5, provider: o.provider, meter: o.meter, onTry: o.onTry, onSwitch: o.onSwitch }));
      return (Array.isArray(r.examples) ? r.examples : []).filter(e => e && e.no).map(e => ({
        label: String(e.label || '').slice(0, 60), no: String(e.no).slice(0, 300), ru: String(e.ru || '').slice(0, 300), note: String(e.note || '').slice(0, 120),
      }));
    },

    /** synonyms with translation and the difference in meaning / usage */
    async synonyms(card) {
      const user = `Give 3–6 Norwegian Bokmål SYNONYMS (or very close words) for this word, the most useful for a learner first.
Return ONLY JSON: {"synonyms":[{"no":"...","ru":"...","note":"...","register":"..."}]}
- no: the synonym in dictionary form (nouns with en/ei/et, verbs with å).
- ru: accurate Russian translation.
- note: SHORT Russian explanation (max 110 chars) of how it differs from the card word and when to use it; you may add one tiny example in house style: "Jeg skjønner. (Я понимаю.)".
- register: one of "нейтральное", "разговорное", "книжное", "официальное", "устаревшее".
If the word has no real synonyms, return the closest related words and say so in note.
Card: Norwegian: ${String(card.no).split('\n')[0].slice(0, 120)} · Russian: ${String(card.ru).split('\n')[0].slice(0, 120)}`;
      const r = this.parseJSON(await this.call({ system: systemPrompt(), user, maxTokens: 1400, temperature: 0.3 }));
      return (Array.isArray(r.synonyms) ? r.synonyms : []).filter(s => s && s.no).map(s => ({
        no: String(s.no).slice(0, 80), ru: String(s.ru || '').slice(0, 120), note: [s.register ? String(s.register) : '', String(s.note || '')].filter(Boolean).join(' · ').slice(0, 200),
      }));
    },

    async generateDeck(topic, count, level, withExplain = true, exclude = []) {
      const user = `Generate ${count} useful, distinct Norwegian Bokmål vocabulary flashcards on the topic: "${topic}" (level ${level}).${exclude.length ? ' Do NOT repeat these already created words: ' + exclude.slice(-120).join(', ') + '.' : ''} Choose the words a Russian-speaking learner living in Norway needs most for this topic; mix nouns, verbs, adjectives and common everyday phrases. ${withExplain ? 'The "description" must follow the house style: grammar forms and 1–2 useful phrases, every Norwegian phrase followed by its Russian translation in parentheses.' : 'Keep "description" very short.'} Return JSON {"cards":[{${FIELDS.map(f => `"${f}":"..."`).join(',')}}]}.`;
      const parsed = this.parseJSON(await this.call({ system: systemPrompt(), user, maxTokens: Math.min(16000, 500 + count * (withExplain ? 380 : 260)), temperature: 0.6 }));
      return (Array.isArray(parsed) ? parsed : parsed.cards || []).filter(c => c && c.no && c.ru);
    },

    /** short English term for images (fallback when no image prompt) */
    async englishTerm(card) {
      const t = await this.call({ system: 'Translate to English. Reply with 1-3 words only.', user: `${card.no} (${card.ru})`, maxTokens: 20 });
      return t.trim().replace(/["'.]/g, '');
    },
  };

  window.AI = AI;
})();
