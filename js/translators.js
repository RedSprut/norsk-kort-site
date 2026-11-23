/* ============ Translators: DeepL, Google, Yandex, Microsoft, AI, MyMemory + dictionaries ============
 * Inline translators put the result straight into the card (or verify an existing translation).
 * Web-only ones (or ones without a key) open the service with the text already filled in.
 */
(function () {
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  const LIST = {
    deepl: { name: 'DeepL', domain: 'deepl.com', key: 'deeplKey', keyUrl: 'https://www.deepl.com/pro-api', note: 'Самый точный. Бесплатный API-ключ: 500 000 символов в месяц' },
    google: { name: 'Google', domain: 'translate.google.com', free: true, note: 'Бесплатно, без ключа' },
    yandex: { name: 'Яндекс', domain: 'translate.yandex.ru', web: true, note: 'Хорош для русского, но доступен не во всех странах — включите, если он у вас работает' },
    microsoft: { name: 'Microsoft', domain: 'bing.com', key: 'msKey', keyUrl: 'https://learn.microsoft.com/azure/ai-services/translator/create-translator-resource', note: 'Бесплатно 2 млн символов в месяц (ключ Azure)' },
    ai: { name: 'ИИ', ai: true, note: 'Подключённая нейросеть: перевод с учётом смысла, до 3 значений' },
    mymemory: { name: 'MyMemory', domain: 'mymemory.translated.net', free: true, note: 'Бесплатно, без ключа (база переводов)' },
    glosbe: { name: 'Glosbe', domain: 'glosbe.com', web: true, dict: true, note: 'Словарь RU⇄NO с примерами из реальных текстов' },
    ordbok: { name: 'Ordbøkene', domain: 'ordbokene.no', dict: true, note: 'Официальный словарь норвежского: значения, примеры, выражения и формы — прямо в карточку, с переводом в скобках' },
    naob: { name: 'NAOB', domain: 'naob.no', web: true, dict: true, note: 'Большой академический словарь норвежского: значения, примеры, устойчивые выражения' },
    tatoeba: { name: 'Tatoeba', domain: 'tatoeba.org', dict: true, note: 'Живые предложения NO→RU, переведённые людьми — прямо в карточку (CC BY 2.0 FR)' },
    lexin: { name: 'LEXIN', domain: 'lexin.oslomet.no', web: true, dict: true, note: 'Норвежско-русский словарь OsloMet для иммигрантов: слово копируется — вставьте его в поиск' },
    forvo: { name: 'Forvo', domain: 'forvo.com', web: true, dict: true, note: 'Произношение слова носителями языка' },
    grammatikk: { name: 'Grammatikk.com', domain: 'grammatikk.com', emoji: '📐', dict: true, panel: true, note: 'Грамматика норвежского (Kjell H. Ullestad): темы к слову карточки — объяснение с переводом на русский, нужное добавляется в карточку' },
    // spare translator for long texts: open-source front-end of Google Translate on its own servers (not limited by your address)
    mozhi: { name: 'Mozhi', domain: 'mozhi.ducks.party', emoji: '🌍', free: true, panel: true, note: 'Запасной бесплатный переводчик (открытый сервис: Google через свой сервер) — когда Google временно ограничил переводы' },
    telegram: { name: 'Telegram', domain: 'telegram.org', dict: true, panel: true, note: 'Посты, видео, карточки-картинки и файлы из каналов о норвежском — по слову карточки, прямо в приложении (через мост на Mac)' },
  };
  const CODES = {
    // en / uk: for extra translations of expression cards (DeepL: source "EN", target "EN-GB")
    deepl: { no: 'NB', ru: 'RU', en: 'EN-GB', uk: 'UK' }, google: { no: 'no', ru: 'ru', en: 'en', uk: 'uk' }, microsoft: { no: 'nb', ru: 'ru', en: 'en', uk: 'uk' },
    mymemory: { no: 'nb', ru: 'ru', en: 'en', uk: 'uk' }, yandex: { no: 'no', ru: 'ru', en: 'en', uk: 'uk' }, bing: { no: 'nb', ru: 'ru', en: 'en', uk: 'uk' },
  };
  const deeplSrc = c => String(c).split('-')[0];

  /* 🌐 where we are (W4 · docs/release-architecture.md §1.2 T1/T2/T4): the unofficial Google endpoint (gtx), Mozhi (Google
   * through other people's servers) and MyMemory are for the owner's Mac only. The public build (the site, the store apps,
   * every phone) translates with Norsk Kort Pro (the server's `translate`, through AI.call — AI.proBatch), the user's own keys
   * (Microsoft everywhere; DeepL in the store apps through native HTTP) and the connected AI; the dictionaries (Ordbøkene,
   * Tatoeba, Wiktionary) stay free. Google Translate and DeepL are still one tap away as their own sites with the word filled in.
   * js/config.js loads after this file, so NK_CONFIG is read lazily — with the same rule as a fallback. On the Mac nothing changes. */
  const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/;
  const isNative = () => { try { return !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); } catch (e) { return false; } };
  const pub = () => (window.NK_CONFIG ? !!NK_CONFIG.publicBuild : (isNative() || !(location.protocol === 'file:' || LOCAL_HOST.test(location.hostname))));
  const MAC_ONLY = ['google', 'mozhi', 'mymemory'];
  const macOnly = id => MAC_ONLY.includes(id) && pub();
  /** the Mac bridge answered (the only case for /api/proxy) */
  const macBridge = () => (window.Net && Net.isMacBridge ? Net.isMacBridge() : (typeof AI !== 'undefined' && !!(AI.bridge && AI.bridge.up)));
  /** DeepL refuses browsers: the bridge on the Mac (as before), native HTTP in the store apps; on the site — its page with the word */
  const deeplHere = () => !pub() || isNative();
  if (pub()) {
    LIST.google = Object.assign({}, LIST.google, { web: true, free: false, note: 'Откроется сайт Google Переводчика со словом. Прямо в приложении переводят Norsk Kort Pro, ваш ключ нейросети или Microsoft' });
    LIST.mozhi = Object.assign({}, LIST.mozhi, { hidden: true });
    LIST.mymemory = Object.assign({}, LIST.mymemory, { hidden: true });
    if (!isNative()) LIST.deepl = Object.assign({}, LIST.deepl, { web: true, note: 'Откроется сайт DeepL со словом. Со своим ключом DeepL переводит прямо в приложении для iPhone и Android' });
    LIST.telegram = Object.assign({}, LIST.telegram, { note: 'Посты, картинки и файлы из каналов о норвежском — по слову карточки, прямо в приложении' });
  }
  /** a calm «only on the Mac» error for a translator that does not work here */
  const notHere = id => Object.assign(new Error(`${(LIST[id] || {}).name || 'Этот переводчик'} переводит прямо в приложении только на Mac. Здесь — Norsk Kort Pro, ваш ключ нейросети или Microsoft`), { macOnly: true, friendly: true });

  /* 🎨 brand marks of the services on the card's rails — drawn inline (crisp, offline, never a grey favicon), like the share sheet (js/shareapp.js).
   * Glyphs from Simple Icons 16.38.0 (simpleicons.org, CC0): Google Translate, DeepL, Telegram (only the plane of its badge, as in js/shareapp.js).
   * The others have no Simple Icons glyph: simple marks drawn here in the service's colours (Microsoft's four squares, Yandex's «Я», …).
   * AI providers use App.aiLogo (js/app.js). [tile background, glyph, viewBox «x y size», glyph share of the tile, glow colour] */
  const SI = {
    googletranslate: 'M22.401 4.818h-9.927L10.927 0H1.599C.72 0 .002.719.002 1.599v16.275c0 .878.72 1.597 1.597 1.597h10L13.072 24H22.4c.878 0 1.597-.707 1.597-1.572V6.39c0-.865-.72-1.572-1.597-1.572zm-15.66 8.68c-2.07 0-3.75-1.68-3.75-3.75 0-2.07 1.68-3.75 3.75-3.75 1.012 0 1.86.375 2.512.976l-.99.952a2.194 2.194 0 0 0-1.522-.584c-1.305 0-2.363 1.08-2.363 2.409S5.436 12.16 6.74 12.16c1.507 0 2.13-1.08 2.19-1.808l-2.188-.002V9.066h3.51c.05.23.09.457.09.764 0 2.147-1.434 3.669-3.602 3.669zm16.757 8.93c0 .59-.492 1.072-1.097 1.072h-8.875l3.649-4.03h.005l-.74-2.302.006-.005s.568-.488 1.277-1.24c.712.771 1.63 1.699 2.818 2.805l.771-.772c-1.272-1.154-2.204-2.07-2.89-2.805.919-1.087 1.852-2.455 2.049-3.707h2.034v.002h.002v-.94h-4.532v-1.52h-1.471v1.52H14.3l-1.672-5.21.006.022h9.767c.605 0 1.097.48 1.097 1.072v16.038zm-6.484-7.311c-.536.548-.943.873-.943.873l-.008.004-1.46-4.548h4.764c-.307 1.084-.988 2.108-1.651 2.904-1.176-1.392-1.18-1.844-1.18-1.844h-1.222s.05.678 1.7 2.61z',
    deepl: 'M20.907 4.93953 12.68543.18573a1.3577 1.3577 0 0 0-1.3709 0L3.09298 4.9565a1.3766 1.3766 0 0 0-.68639 1.18233v9.52646a1.3766 1.3766 0 0 0 .68639 1.19363l8.22157 4.75946.06223.03583 4.04856 2.3458-.01131-2.06106.0075-1.1446.0038.01885v-.38467c0-.23006.1188-.43371.29605-.56005l.264-.15086.12633-.06977h-.0075l4.80283-2.7795a1.3803 1.3803 0 0 0 .68639-1.19551V6.13505a1.3803 1.3803 0 0 0-.68642-1.19552m-9.85269 9.68863a1.4275 1.4275 0 0 1-.39976 1.3841 1.4086 1.4086 0 0 1-1.97054 0 1.4199 1.4199 0 0 1 0-2.06294 1.4086 1.4086 0 0 1 2.0422.07543l3.32822-1.91585.6864.38656zm5.77019-2.41367a1.4086 1.4086 0 0 1-1.97054 0 1.4256 1.4256 0 0 1-.3696-1.47837l-.0132.0075-3.7525-2.1723-.05657.05656a1.4086 1.4086 0 0 1-1.97053 0 1.4199 1.4199 0 0 1 0-2.06293 1.4086 1.4086 0 0 1 1.97242 0c.3941.37713.52422.91832.39033 1.40672l3.7808 2.20059.01886-.01886a1.4086 1.4086 0 0 1 1.97242 0 1.42746 1.42746 0 0 1 0 2.06105z',
    telegram: 'M16.906 7.224C17.006 7.222 17.227 7.247 17.371 7.364A.506 .506 0 0 1 17.542 7.689C17.558 7.782 17.578 7.995 17.562 8.161C17.382 10.059 16.6 14.663 16.202 16.788C16.034 17.688 15.703 17.989 15.382 18.018C14.686 18.083 14.157 17.558 13.482 17.116C12.426 16.423 11.829 15.992 10.804 15.316C9.619 14.536 10.387 14.106 11.062 13.406C11.239 13.222 14.309 10.429 14.369 10.176C14.376 10.144 14.383 10.026 14.313 9.964S14.139 9.923 14.064 9.94C13.958 9.964 12.271 11.08 9.003 13.285C8.523 13.615 8.09 13.775 7.701 13.765C7.273 13.757 6.449 13.524 5.836 13.325C5.084 13.08 4.487 12.951 4.539 12.536C4.566 12.32 4.864 12.099 5.432 11.873C8.93 10.349 11.262 9.344 12.43 8.859C15.762 7.473 16.455 7.232 16.906 7.224Z',
  };
  const W = (w = 1.9) => `fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  const BRAND = {
    google: ['linear-gradient(160deg, #6aa5ff, #4285F4 55%, #2f6fe0)', `<path d="${SI.googletranslate}" fill="#fff"/>`, '0 0 24', .62, '#4285F4'],
    deepl: ['linear-gradient(160deg, #1c4470, #0F2B46)', `<path d="${SI.deepl}" fill="#fff"/>`, '0 0 24', .66, '#3d8fe0'],
    // Microsoft: its four squares on a white tile
    microsoft: ['#fff', '<rect x="2.5" y="2.5" width="9.1" height="9.1" fill="#F25022"/><rect x="12.4" y="2.5" width="9.1" height="9.1" fill="#7FBA00"/><rect x="2.5" y="12.4" width="9.1" height="9.1" fill="#00A4EF"/><rect x="12.4" y="12.4" width="9.1" height="9.1" fill="#FFB900"/>', '0 0 24', .54, '#00A4EF', 'light'],
    // MyMemory (Translated): an «M» in a speech bubble — the memory of human translations
    mymemory: ['linear-gradient(160deg, #ffa24a, #e8742a 60%, #d65a17)', `<path d="M5.2 4.6h13.6a2.3 2.3 0 0 1 2.3 2.3v8.3a2.3 2.3 0 0 1-2.3 2.3h-6.4l-4.3 3.3v-3.3H5.2a2.3 2.3 0 0 1-2.3-2.3V6.9a2.3 2.3 0 0 1 2.3-2.3z" ${W(1.7)}/><path d="M7.6 14.2V8.4l4.4 3.9 4.4-3.9v5.8" ${W(2)}/>`, '0 0 24', .66, '#ff8a3a'],
    // Mozhi: «文A» — the open translator on its own server (teal, as its coin in js/aihub.js)
    mozhi: ['linear-gradient(160deg, #3fb3a4, #2f8f83 60%, #237268)', `<path d="M7.4 3.6v1.9M3 6.4h8.8M5 6.9c.9 3.6 3.1 6.2 6.6 7.5M10 6.9c-1 3.6-3.3 6.3-6.9 7.6" ${W(1.7)}/><path d="M12.6 20.4 16.6 9.8l4 10.6M14 17.1h5.2" ${W(1.9)}/>`, '0 0 24', .7, '#3fc2b0'],
    // Ordbøkene (Språkrådet + UiB): the open dictionary on the flag's red, with a bookmark ribbon
    ordbok: ['linear-gradient(160deg, #e2364d, #C8102E 60%, #a50d26)', `<path d="M12 6.6C9.6 5 6.4 4.6 3.2 5.4v13c3.2-.8 6.4-.4 8.8 1.2 2.4-1.6 5.6-2 8.8-1.2v-13c-3.2-.8-6.4-.4-8.8 1.2z" ${W(1.8)}/><path d="M12 6.6v13" ${W(1.6)}/><path d="M15.4 5.3v5.4l1.5-1.2 1.5 1.2V5" fill="#fff"/>`, '0 0 24', .7, '#ff4d64'],
    // Tatoeba: living sentences translated by people — two speech bubbles on its green
    tatoeba: ['linear-gradient(160deg, #6cc55a, #4CAF50 55%, #388e3c)', `<path d="M9.6 3.8h8.6a2.2 2.2 0 0 1 2.2 2.2v5a2.2 2.2 0 0 1-2.2 2.2h-.8v2.6l-3-2.6" ${W(1.6)}/><path d="M3.6 9.4a2.2 2.2 0 0 1 2.2-2.2h8.2a2.2 2.2 0 0 1 2.2 2.2v5.2a2.2 2.2 0 0 1-2.2 2.2H9.4l-3.4 2.9v-2.9h-.2a2.2 2.2 0 0 1-2.2-2.2z" fill="#fff"/><path d="M6.6 11.3h6.8M6.6 13.9h4.4" stroke="#3c9a40" stroke-width="1.5" stroke-linecap="round"/>`, '0 0 24', .7, '#5fd35a'],
    // Grammatikk.com: the set square of grammar (its 📐)
    grammatikk: ['linear-gradient(160deg, #7c7cf0, #5b5bd6 55%, #4646b8)', `<path d="M4.5 3.8v16h16z" ${W(1.9)}/><path d="M8.4 12.9v3h3z" ${W(1.6)}/><path d="M4.6 7.4h2M4.6 10.9h1.4M4.6 14.4h2" ${W(1.4)}/>`, '0 0 24', .7, '#8f8fff'],
    telegram: ['linear-gradient(180deg, #2AABEE, #229ED9)', `<path d="${SI.telegram}" fill="#fff"/>`, '4.54 6.1 13.03', .58, '#2AABEE'],
    // web dictionaries (📚 «Ещё словари»)
    yandex: ['linear-gradient(160deg, #ff6a45, #FC3F1D 60%, #e02d0c)', `<path d="M15.4 4.6v14.8M15.4 4.6h-3.1a3.7 3.7 0 0 0 0 7.4h3.1M12.4 12 8.2 19.4" ${W(2.3)}/>`, '0 0 24', .66, '#ff6a45'],
    glosbe: ['linear-gradient(160deg, #4f8de0, #2b6cb0 60%, #22568d)', `<path d="M18.2 8.2A7 7 0 1 0 19 13h-6" ${W(2.2)}/>`, '0 0 24', .64, '#5aa0ff'],
    naob: ['linear-gradient(160deg, #2b3866, #1c2541)', '<path d="M7 18.6V5.4l10 13.2V5.4" fill="none" stroke="#e3b95a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.4 20.6h15.2" stroke="#e3b95a" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>', '0 0 24', .66, '#e3b95a'],
    lexin: ['linear-gradient(160deg, #1597b0, #0e7490 60%, #0b5d73)', `<path d="M4.6 8.6h13.6l-3.2-3.2M19.4 15.4H5.8l3.2 3.2" ${W(2.1)}/>`, '0 0 24', .66, '#22d3ee'],
    // Wiktionary (⚖️ comparison: forms and meanings): its «W» puzzle-piece mark on white
    wiktionary: ['#fff', '<path d="M3.2 6.4h3.1l2.6 9.4 2.3-7.2h1.6l2.3 7.2 2.6-9.4h3.1" fill="none" stroke="#202122" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.6 19.2h16.8" stroke="#3366cc" stroke-width="1.6" stroke-linecap="round"/>', '0 0 24', .7, '#9aa7ff', 'light'],
    forvo: ['linear-gradient(160deg, #9a6bff, #7b3fe4 60%, #6128c4)', `<path d="M4.4 9.6h3.2l4.2-3.6v12l-4.2-3.6H4.4z" fill="#fff" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/><path d="M15 9.3a3.8 3.8 0 0 1 0 5.4M17.6 6.8a7.4 7.4 0 0 1 0 10.4" ${W(1.9)}/>`, '0 0 24', .66, '#a77bff'],
    // our own tools on the rail: in the app's own colours
    compare: ['linear-gradient(135deg, #7c6cff, #29c7ff)', `<path d="M12 4.2v15.2M7.6 19.6h8.8M4.8 7.4c2.4.9 4.8.9 7.2-.4 2.4 1.3 4.8 1.3 7.2.4" ${W(1.7)}/><path d="M2.6 13.4 4.8 7.6 7 13.4a2.2 2.2 0 0 1-4.4 0zM17 13.4l2.2-5.8 2.2 5.8a2.2 2.2 0 0 1-4.4 0z" fill="#fff" fill-opacity=".9" stroke="#fff" stroke-width="1.1" stroke-linejoin="round"/>`, '0 0 24', .7, '#7c8bff'],
    more: ['linear-gradient(135deg, #f7b733, #fc4a7a)', '<rect x="4" y="4.4" width="3.6" height="15.2" rx="1" fill="#fff"/><rect x="8.9" y="6.4" width="3.6" height="13.2" rx="1" fill="#fff" fill-opacity=".82"/><path d="m14.1 7.6 3.3-.9 3.3 12.4-3.3.9z" fill="#fff" stroke="#fff" stroke-width=".8" stroke-linejoin="round"/><path d="M4 8h3.6M8.9 9.6h3.6" stroke="#f08a4b" stroke-width="1.1"/>', '0 0 24', .66, '#ff7a59'],
    add: ['transparent', `<path d="M12 6v12M6 12h12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`, '0 0 24', .55, '#8b80ff', 'ghost'],
  };
  // glow of the AI coins (their tile colour, or a brighter one when the tile is black / white)
  const AI_GLOW = { openai: '#10a37f', xai: '#8b93ff', zai: '#6f7bff', ollama: '#9aa3b5', cohere: '#ff9f84', pollinations: '#9bd34a', custom: '#8b80ff', gemini: '#7b8cff', mistral: '#fa520f' };
  /** a brand tile: { html, glow } — for a translator / dictionary id or 'ai:<provider>' */
  const brandOf = key => {
    if (String(key).startsWith('ai:')) {
      const id = key.slice(3);
      const logo = window.App && App.aiLogo ? App.aiLogo(id, ' tool-chip tool-ai') : `<span class="tool-chip tool-ai">${BOT()}</span>`;
      const hex = (logo.match(/--c:\s*(?:[a-z-]+\(\s*[^#]*)?(#[0-9a-f]{3,6})/i) || [])[1];
      const glow = AI_GLOW[id] || (hex && !/^#(fff|ffffff|0b0b0f|000)$/i.test(hex) ? hex : '#8b80ff');
      return { html: logo, glow, tone: id === 'openai' || id === 'ollama' ? 'light' : /^(xai|zai)$/.test(id) ? 'dark' : '' };
    }
    const b = BRAND[key];
    if (!b) return { html: `<span class="tool-chip" style="--chip-bg:linear-gradient(135deg, #7c6cff, #29c7ff);--gs:60%"><span class="tool-emoji">${(LIST[key] && LIST[key].emoji) || '🌐'}</span></span>`, glow: '#8b80ff', tone: '' };
    const [bg, glyph, vb, size, glow, tone] = b;
    const [x, y, s] = vb.split(' ');
    return { html: `<span class="tool-chip${tone ? ' ' + tone : ''}" style="--chip-bg:${bg};--gs:${Math.round(size * 100)}%"><svg viewBox="${x} ${y} ${s} ${s}" aria-hidden="true" focusable="false">${glyph}</svg></span>`, glow, tone: tone || (key === 'deepl' ? 'dark' : '') };
  };
  // what a click does, said in the tooltip («DeepL — перевести», «Ordbøkene — словарь»)
  const ACT = { ordbok: 'словарь', tatoeba: 'живые примеры', grammatikk: 'грамматика', telegram: 'посты из каналов', forvo: 'произношение', naob: 'словарь', lexin: 'словарь', glosbe: 'словарь' };
  // the 🔑 corner badge of a service that needs a key (drawn, so it stays crisp and calm at any size)
  const KEY_BADGE = '<span class="tool-key" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><circle cx="8" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M12.2 12H21M18 12v3.4M15.2 12v2.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></span>';

  const Translators = {
    LIST,
    enabled() {
      const order = Store.settings.translators || Object.keys(LIST);
      return order.filter(id => LIST[id] && !LIST[id].hidden);
    },
    /** text to translate: first line, without Russian glosses in brackets when going NO→RU */
    prepare(text, from) {
      let t = String(text || '').split('\n').map(s => s.trim()).filter(Boolean)[0] || '';
      if (from === 'no') t = t.replace(/\([^)]*[Ѐ-ӿ][^)]*\)/g, ' ');
      return U.stripHtml(t).replace(/\*\*|__|[*_`#]/g, '').replace(/\s+/g, ' ').trim().slice(0, 500);
    },
    detect(text) { return U.cyrRatio(text) > 0.3 ? { from: 'ru', to: 'no' } : { from: 'no', to: 'ru' }; },
    inline(id) {
      const t = LIST[id];
      if (!t || t.web || t.hidden || macOnly(id)) return false;
      if (t.ai) return AI.available();
      if (t.key) return !!(Store.settings[t.key] || '').trim();
      return true;
    },
    icon(id, size = 18) {
      const t = LIST[id];
      if (t.ai) return AI.current() ? AI.icon(AI.current(), size, 'Перевод нейросетью: ' + AI.name()) : BOT(size);
      if (t.emoji) return `<span class="ai-ico tr-ico tr-emoji" style="font-size:${size - 3}px;width:${size}px;height:${size}px;display:inline-grid;place-items:center;line-height:1" title="${U.esc(t.name)}">${t.emoji}</span>`;
      return `<img class="ai-ico tr-ico" src="https://www.google.com/s2/favicons?domain=${t.domain}&sz=64" width="${size}" height="${size}" alt="${U.esc(t.name)}" onerror="this.replaceWith(document.createTextNode('🌐'))">`;
    },
    label(id) { return LIST[id].ai ? (AI.current() ? AI.name() : 'ИИ') : LIST[id].name; },

    webUrl(id, text, from, to) {
      const q = encodeURIComponent(text);
      const c = k => CODES[k][from] + '';
      switch (id) {
        case 'deepl': return `https://www.deepl.com/translator#${from === 'no' ? 'nb' : 'ru'}/${to === 'no' ? 'nb' : 'ru'}/${q}`;
        case 'google': return `https://translate.google.com/?sl=${CODES.google[from]}&tl=${CODES.google[to]}&text=${q}&op=translate`;
        case 'yandex': return `https://translate.yandex.ru/?source_lang=${CODES.yandex[from]}&target_lang=${CODES.yandex[to]}&text=${q}`;
        case 'microsoft': return `https://www.bing.com/translator?from=${CODES.bing[from]}&to=${CODES.bing[to]}&text=${q}`;
        case 'mymemory': return `https://mymemory.translated.net/ru/${from === 'ru' ? 'Русский/Норвежский' : 'Норвежский/Русский'}/${q}`;
        case 'glosbe': return `https://glosbe.com/${from === 'no' ? 'nb' : 'ru'}/${to === 'no' ? 'nb' : 'ru'}/${q}`;
        case 'ordbok': return `https://ordbokene.no/nob/bm/${encodeURIComponent((from === 'no' ? text : text).replace(/^(en|ei|et|å)\s+/i, '').split(/[,(]/)[0].trim())}`;
        case 'tatoeba': return `https://tatoeba.org/ru/sentences/search?from=nob&to=rus&query=${encodeURIComponent(text.replace(/^(en|ei|et|å)\s+/i, ''))}`;
        case 'lexin': return 'https://lexin.oslomet.no/';
        case 'forvo': return `https://forvo.com/word/${encodeURIComponent(text.replace(/^(en|ei|et|å)\s+/i, '').split(/[,(]/)[0].trim().toLowerCase())}/#no`;
        case 'naob': return `https://naob.no/s%C3%B8k/${encodeURIComponent(text.replace(/^(en|ei|et|å)\s+/i, '').split(/[,(]/)[0].trim())}`;
        case 'mozhi': return `https://mozhi.ducks.party/?engine=google&from=${CODES.google[from]}&to=${CODES.google[to]}&text=${q}`;
        case 'ai': return '';
      }
      return '';
    },
    open(id, text, from, to) {
      if (id === 'lexin') {
        // LEXIN has no public link format: copy the word, the user pastes it into the search field
        const w = String(text).replace(/^(en|ei|et|å)\s+/i, '').split(/[,(]/)[0].trim();
        const told = ok => UI.toast(ok ? `«${w}» скопировано — вставьте в поиск LEXIN (⌘V) и выберите bokmål–russisk` : `Введите в поиск LEXIN: «${w}» и выберите bokmål–russisk`, ok ? 'good' : 'warn', 6000);
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(w).then(() => told(true), () => told(false));
        else told(false);
      }
      const url = this.webUrl(id, text, from, to);
      if (url) window.open(url, '_blank', 'noopener');
    },

    /** Google request for one card: no connection or refused (limit) -> the same request through the Mac bridge */
    /** 🧯 Google refused («too many requests»): it rests 10 minutes — the other translators work meanwhile
     *  (before, every line kept asking Google and the bridge again: dozens of refusals, a longer block) */
    /** the same rest for every other translator (DeepL monthly limit, MyMemory daily limit, Mozhi server down…) */
    _trRest: null,
    trRestMap() { if (!this._trRest) { try { this._trRest = JSON.parse(sessionStorage.getItem('nk-tr-rest') || '{}'); } catch (e) { this._trRest = {}; } } return this._trRest; },
    trRest(id, min) { const m = this.trRestMap(); m[id] = Date.now() + min * 60000; try { sessionStorage.setItem('nk-tr-rest', JSON.stringify(m)); } catch (e) { /* private mode */ } },
    trResting(id) { return Date.now() < (this.trRestMap()[id] || 0); },
    trUnrest(id) { const m = this.trRestMap(); if (m[id]) { delete m[id]; try { sessionStorage.setItem('nk-tr-rest', JSON.stringify(m)); } catch (e) { /* ok */ } } },
    gCool(min = 10) {
      this._gCoolUntil = Date.now() + min * 60000;
      try { sessionStorage.setItem('nk-gcool', String(this._gCoolUntil)); } catch (e) { /* private mode */ }
    },
    /** «🔄 Перевести снова» near the end of Google's pause: one more try is allowed (refused → a new pause) */
    gUncool() { this._gCoolUntil = 0; try { sessionStorage.removeItem('nk-gcool'); } catch (e) { /* ok */ } },
    gCooling() {
      if (!this._gCoolUntil) { try { this._gCoolUntil = +sessionStorage.getItem('nk-gcool') || 0; } catch (e) { this._gCoolUntil = 0; } }
      return Date.now() < this._gCoolUntil;
    },
    /** minutes left of Google's pause (0 = it translates) — for «Google попросил паузу на ~N минут» */
    gRestMin() { return this.gCooling() ? Math.max(1, Math.ceil((this._gCoolUntil - Date.now()) / 60000)) : 0; },
    /** the Mac bridge can ask Google for us (another client): up and not refused itself a moment ago */
    gBridgeOk() { return !pub() && macBridge() && !this.trResting('gbridge'); },
    /** Google cannot translate right now at all: this browser has to rest and the bridge cannot ask for it */
    gResting() { return this.gCooling() && !this.gBridgeOk(); },
    /** who really translated the last lines (a few minutes): { id, key, name, short, none (nobody answered), reason, gMin } or null */
    nowWho() {
      const n = this._now;
      if (!n || Date.now() - n.at > 15 * 60000) return null;
      const name = n.id === 'ai' ? (typeof AI !== 'undefined' ? AI.name(this.lastAI) : 'нейросеть') : n.id === 'google' ? 'Google Переводчик' : (LIST[n.id] || {}).name || n.id;
      return { id: n.id, key: n.key || (n.id ? this.whoKey(n.id) : ''), name, short: n.id ? this.whoName(n.id) : '', none: !!n.none, reason: n.reason || '', gMin: this.gRestMin() };
    },

    /* ---------- 🌐 «Кто переводит»: the live switch between translators → the 'tr-who' event (badges: js/trnotice.js) ----------
     * The badge at the top of a window shows who REALLY translates its lines now. Whenever that changes (Google asked for
     * a pause → MyMemory; MyMemory's daily allowance is over → the neural network; no internet → nobody), window gets
     * CustomEvent('tr-who', { detail: { who, key, name, prev, prevKey, prevName, reason, restUntil, none, place } }).
     * reason: start | pause (Google's pause) | limit (daily / monthly allowance) | busy (did not answer) | ai-fail |
     * ai-next (one neural network → another) | offline | back (the first one translates again) | pick (the user's choice).
     * A preferred translator can be chosen per place (a window / a source: 'subs:nrk', 'reader', …) — it is asked first. */
    PLACE_KEY: 'nk-tr-place',
    whoKey(id) { return id === 'ai' ? 'ai:' + ((typeof AI !== 'undefined' && (this.lastAI || AI.lastProvider || AI.current())) || '') : id; },
    /** a short name for the badge: «Google», «MyMemory», «Gemini» */
    whoName(id, prov) {
      if (id === 'ai') { const p = typeof AI !== 'undefined' && AI.PROVIDERS[prov || this.lastAI || AI.lastProvider || AI.current()]; return p ? p.short || p.name : 'нейросеть'; }
      return id === 'google' ? 'Google' : (LIST[id] || {}).name || id;
    },
    /** until when a translator rests (ms) — 0 = it may be asked */
    restUntil(id) {
      if (id === 'google') return this.gCooling() ? this._gCoolUntil : 0;
      const t = this.trRestMap()[id] || 0; return t > Date.now() ? t : 0;
    },
    /** why this translator did not translate right now (plain reason code) */
    whyOff(id) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
      if (id === 'google' && this.gCooling()) return 'pause';
      if (id === 'ai') return 'ai-fail';
      if (this.restUntil(id) - Date.now() > 30 * 60000) return 'limit';
      return 'busy';
    },
    /** the place's own preferred translator ('' = by the usual order) */
    prefMap() { try { return JSON.parse(localStorage.getItem(this.PLACE_KEY) || '{}') || {}; } catch (e) { return {}; } },
    prefFor(place) { return place ? this.prefMap()[place] || '' : ''; },
    setPref(place, id) {
      if (!place) return;
      const m = this.prefMap();
      if (id && id !== 'auto') m[place] = id; else delete m[place];
      try { localStorage.setItem(this.PLACE_KEY, JSON.stringify(m)); } catch (e) { /* private mode */ }
      try { window.dispatchEvent(new CustomEvent('tr-pref', { detail: { place, id: m[place] || '' } })); } catch (e) { /* old browser */ }
    },
    /** the place a translation belongs to: given, or the window whose badge was shown last (TrBadge.activePlace) */
    placeOf(opts) { return (opts && (opts.place || (opts._ctx && opts._ctx.place))) || (window.TrBadge && TrBadge.activePlace ? TrBadge.activePlace() : '') || ''; },
    /** the order translators are asked in (the same one translateMany uses) — the place's choice first, resting ones last */
    orderFor(opts = {}, keepResting) {
      let order = this.dictOrder().slice();
      // the free spares always stand in line too (switching between translators is always on)
      ['mozhi', 'mymemory'].forEach(id => { if (!order.includes(id) && !macOnly(id)) order.push(id); });
      const pref = this.prefFor(this.placeOf(opts));
      if (pref && order.includes(pref)) order = [pref, ...order.filter(id => id !== pref)];
      if (opts.only) order = order.filter(id => opts.only.includes(id));
      if (opts.noAI) order = order.filter(id => id !== 'ai');
      if (keepResting) return order;
      // 🔁 a translator that refused a moment ago (limit, down) goes to the end: the working ones translate first
      const resting = id => id === 'google' ? this.gResting() : this.trResting(id);
      return [...order.filter(id => !resting(id)), ...order.filter(id => resting(id))];
    },
    /** the chain for the badge's window: [{ id, key, name, state: work | next | rest | limit | key, until }] */
    chain(place) {
      const S = Store.settings, now = this.nowWho();
      const order = this.orderFor({ place });
      const cur = now && !now.none && order.includes(now.id) ? now.id : '';
      const out = order.map(id => {
        const until = id === 'google' ? (this.gResting() ? this._gCoolUntil : 0) : this.restUntil(id);
        const state = id === cur ? 'work' : until ? (until - Date.now() > 30 * 60000 ? 'limit' : 'rest') : 'next';
        return { id, key: this.whoKey(id), name: this.whoName(id), state, until };
      });
      // nobody has translated here yet: the first one that may be asked is the one at work
      if (!cur) { const f = out.find(x => x.state === 'next'); if (f) f.state = 'work'; }
      const need = [];
      if (!(S.deeplKey || '').trim() && deeplHere()) need.push('deepl');
      if (!(S.msKey || '').trim()) need.push('microsoft');
      if (typeof AI !== 'undefined' && !AI.available()) need.push('ai');
      need.forEach(id => out.push({ id, key: id === 'ai' ? 'ai:gemini' : id, name: id === 'ai' ? 'Нейросеть' : this.whoName(id), state: 'key', until: 0 }));
      return out;
    },
    _who: null,
    _emit(type, detail) { try { window.dispatchEvent(new CustomEvent(type, { detail })); } catch (e) { /* old browser */ } },
    /** a line was translated by `id` in a call (ctx: its order and who answered) → a new 'tr-who' when the translator changed */
    _whoPut(id, ctx) {
      const key = this.whoKey(id), prev = this._who;
      this._now = { id, key, at: Date.now() };
      if (prev && !prev.none && prev.key === key) { prev.at = Date.now(); return; }
      const base = (ctx && ctx.base) || [];
      const answered = (ctx && ctx.fresh) || {};
      const skipped = base.slice(0, Math.max(0, base.indexOf(id))).filter(x => !answered[x]);
      let from = '', reason = 'start';
      if (prev && prev.none) { reason = 'back'; from = ''; }
      else if (prev && prev.id === 'ai' && id === 'ai') { from = 'ai'; reason = 'ai-next'; }
      else if (prev && prev.id && prev.id !== id) {
        from = prev.id;
        if (skipped.includes(from) || this.restUntil(from)) reason = this.whyOff(from);
        else if (this.prefFor(ctx && ctx.place) === id) reason = 'pick';
        else reason = base[0] === id ? 'back' : 'busy';
      } else if (skipped.length) { from = skipped[0]; reason = this.whyOff(from); }
      if (reason === 'offline') reason = 'back'; // a line came, so the internet is there again
      const d = {
        who: id, key, name: this.whoName(id), prev: from, prevKey: prev && prev.key || (from ? this.whoKey(from) : ''),
        prevName: from ? (from === 'ai' && prev && prev.key ? this.whoName('ai', prev.key.slice(3)) : this.whoName(from)) : '',
        reason, restUntil: from ? this.restUntil(from) : 0, none: false, wasOffline: !!(prev && prev.none && prev.reason === 'offline'), place: (ctx && ctx.place) || '',
      };
      this._who = Object.assign({ id, key, at: Date.now() }, { reason });
      this._now.reason = reason;
      this._emit('tr-who', d);
    },
    /** nobody answered in a call: no internet, or every translator rests / is down */
    _whoNone(ctx) {
      const offline = (typeof navigator !== 'undefined' && navigator.onLine === false) || /нет интернета/i.test(this.lastError || '');
      const reason = offline ? 'offline' : 'busy';
      const prev = this._who;
      this._now = { id: '', none: true, reason, at: Date.now() };
      if (prev && prev.none && prev.reason === reason) { prev.at = Date.now(); return; }
      const rests = ((ctx && ctx.base) || []).map(id => this.restUntil(id)).filter(Boolean);
      this._who = { id: '', key: '', none: true, reason, at: Date.now() };
      this._emit('tr-who', { who: '', key: '', name: '', prev: prev && prev.id || '', prevKey: prev && prev.key || '', prevName: prev && prev.id ? this.whoName(prev.id) : '',
        reason, restUntil: rests.length ? Math.min(...rests) : 0, none: true, place: (ctx && ctx.place) || '' });
    },
    _busy: 0,
    /** fetch that gives up after ms (a hanging translator must not hold the subtitles) */
    async tfetch(url, init = {}, ms = 12000) {
      const c = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const t = c ? setTimeout(() => c.abort(), ms) : 0;
      try { return await fetch(url, c ? Object.assign({}, init, { signal: c.signal }) : init); } finally { clearTimeout(t); }
    },
    async gget(url) {
      if (pub()) throw notHere('google');
      const viaBridge = () => this.tfetch('/api/proxy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, method: 'GET' }) }, 20000);
      const bridge = macBridge();
      if (this.gCooling()) throw new Error('Google временно ограничил переводы — попробуйте через несколько минут');
      let r;
      try { r = await this.tfetch(url, {}, 20000); } catch (e) {
        // online, yet no answer: usually Google's «sorry» page (it has no CORS header) — let Google rest a little
        if (!bridge) { if (navigator.onLine !== false) this.gCool(5); throw new Error('нет связи с Google Переводчиком (интернет или блокировщик рекламы)'); }
        r = await viaBridge();
      }
      if (!r.ok && (r.status === 429 || r.status === 403) && bridge) { try { const b = await viaBridge(); if (b.ok) r = b; } catch (e) { /* keep the first answer */ } }
      if (!r.ok && (r.status === 429 || r.status === 403)) this.gCool();
      if (!r.ok) throw new Error(r.status === 429 || r.status === 403 ? 'Google временно ограничил переводы с вашего адреса — подождите 5–15 минут' : 'Google ответил ошибкой ' + r.status);
      return r.json();
    },
    /** Mozhi (spare Google front-end) for one text */
    async mozhiOne(text, from, to) {
      if (pub()) throw notHere('mozhi');
      for (const h of ['https://mozhi.ducks.party', 'https://mozhi.pussthecat.org']) {
        try {
          const r = await this.tfetch(`${h}/api/translate?engine=google&from=${CODES.google[from]}&to=${CODES.google[to]}&text=${encodeURIComponent(text)}`, {}, 20000);
          if (r.ok) { const j = await r.json(); const t = j && (j['translated-text'] || j.translated_text); if (t) return String(t).trim(); }
        } catch (e) { /* next server */ }
      }
      throw new Error('Mozhi сейчас не отвечает');
    },

    /** translate inline -> string */
    async translate(id, text, from, to, opts = {}) {
      text = String(text || '').trim();
      if (!text) throw new Error('Нет текста для перевода');
      if (macOnly(id) || (id === 'deepl' && !deeplHere())) throw notHere(id);
      switch (id) {
        case 'google': {
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${CODES.google[from]}&tl=${CODES.google[to]}&dt=t&q=${encodeURIComponent(text)}`;
          const j = await this.gget(url);
          return (j[0] || []).map(x => x[0]).join('').trim();
        }
        case 'mozhi': return this.mozhiOne(text, from, to);
        case 'mymemory': {
          const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${CODES.mymemory[from]}|${CODES.mymemory[to]}`;
          const r = await this.tfetch(url);
          const j = await r.json().catch(() => null);
          const t = j && j.responseData && j.responseData.translatedText;
          // the free daily allowance is used up («… NEXT AVAILABLE IN 10 HOURS …»): no more requests until then
          if (r.status === 429 || /MYMEMORY WARNING|USED ALL AVAILABLE/i.test(t || '')) {
            const h = +(String(t || '').match(/NEXT AVAILABLE IN\s+(\d+)\s+HOURS?/i) || [])[1] || 6;
            throw Object.assign(new Error('MyMemory: дневной лимит исчерпан'), { limit: true, restMin: Math.min(24, Math.max(1, h)) * 60 });
          }
          if (!t || /INVALID|QUERY LENGTH LIMIT/i.test(t)) throw new Error('MyMemory: лимит или ошибка');
          return t.trim();
        }
        case 'deepl': {
          const key = (Store.settings.deeplKey || '').trim();
          const host = /:fx$/.test(key) ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
          const r = await AI.post(host + '/v2/translate', { 'content-type': 'application/json', authorization: 'DeepL-Auth-Key ' + key },
            { text: [text], source_lang: deeplSrc(CODES.deepl[from]), target_lang: CODES.deepl[to] });
          if (!r.ok) throw new Error(r.status === 403 ? 'DeepL: неверный ключ' : r.status === 456 ? 'DeepL: месячный лимит исчерпан' : 'DeepL: ошибка ' + r.status);
          return ((r.data.translations || [])[0] || {}).text || '';
        }
        case 'microsoft': {
          const key = (Store.settings.msKey || '').trim();
          const h = { 'content-type': 'application/json', 'ocp-apim-subscription-key': key };
          if ((Store.settings.msRegion || '').trim()) h['ocp-apim-subscription-region'] = Store.settings.msRegion.trim();
          const r = await AI.post(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${CODES.microsoft[from]}&to=${CODES.microsoft[to]}`, h, [{ Text: text }]);
          if (!r.ok) throw new Error('Microsoft: ' + ((r.data && r.data.error && r.data.error.message) || 'ошибка ' + r.status));
          return (((r.data || [])[0] || {}).translations || [{}])[0].text || '';
        }
        case 'ai': {
          const LN = { no: 'Norwegian (Bokmål)', en: 'English', ru: 'Russian', uk: 'Ukrainian' };
          const sys = from === 'no' && to === 'ru'
            ? 'Translate the Norwegian (Bokmål) word or phrase into Russian. For a single word give up to 3 most common meanings separated by ", ". Output ONLY the translation.'
            : to === 'no'
            ? `Translate the ${LN[from] || 'Russian'} word or phrase into Norwegian Bokmål. Nouns with the indefinite article (en/ei/et), verbs with "å". If there are 2-3 common equivalents, separate them with ", ". Output ONLY the translation.`
            // 🇬🇧 English (or any other source) → the target: by meaning, names kept
            : `Translate the ${LN[from] || from} text into ${LN[to] || to} by meaning, as a native speaker would say it; keep names as they are. Output ONLY the translation.`;
          const t = await AI.call({ system: sys, user: text, maxTokens: 120, temperature: 0.1, quiet: true, provider: opts.provider });
          this.lastAI = AI.lastProvider;
          return String(t).replace(/<think>[\s\S]*?<\/think>/g, '').trim().split('\n')[0].replace(/^["«]|["»]$/g, '');
        }
      }
      throw new Error('Этот переводчик открывается на сайте');
    },

    /**
     * Translate many short texts at once, robustly (dictionary articles: definitions, examples, expressions).
     * Google gets a few batched requests (one line per text) instead of dozens of parallel calls — Google blocks those.
     * Gaps are then filled by DeepL / Microsoft (if keys are set), MyMemory, and finally the connected AI.
     * -> { out: [translations in the same order, '' where nothing worked], by: [translator ids used], missing }
     */
    _trCache: new Map(),
    /** translators that can translate a whole article, in the order they are tried (Settings → "Переводчик для статей") */
    DICT_TRANSLATORS: ['deepl', 'google', 'microsoft', 'mymemory', 'ai'],
    dictOrder() {
      const S = Store.settings;
      const usable = id => macOnly(id) ? false : id === 'deepl' ? !!(S.deeplKey || '').trim() && deeplHere() : id === 'microsoft' ? !!(S.msKey || '').trim() : id === 'ai' ? (typeof AI !== 'undefined' && AI.available()) : true;
      const pref = S.dictTranslator === 'lingva' ? 'mozhi' : S.dictTranslator || 'auto'; // Lingva was replaced by Mozhi
      const base = ['deepl', 'google', 'mozhi', 'microsoft', 'mymemory', 'ai'];
      const order = pref === 'auto' ? base : [pref, ...base.filter(x => x !== pref)];
      return order.filter(usable);
    },
    /** which translator will translate the next article (for the settings hint) */
    dictMain() { return this.dictOrder()[0] || (pub() ? 'ai' : 'google'); },
    /** the public build has nobody to translate with yet (no Pro, no AI key, no Microsoft / DeepL key): say how to get one */
    needSetup() { return pub() && !this.dictOrder().length; },
    /** one calm sentence: how translation starts working here (no technical words) */
    publicHint() {
      const pro = !!(window.Pro && Pro.offered && Pro.offered());
      return `Чтобы переводить прямо в приложении, подключите ${pro ? 'Norsk Kort Pro или ' : ''}бесплатный ключ нейросети (Gemini или Groq) в Настройках → Нейросети. Словари Ordbøkene и Tatoeba работают и без этого`;
    },
    /** 'google' -> 'tr:google', 'ai' -> 'ai:groq' — keys of the icons on the card */
    provKeys(ids) {
      return (ids || []).map(id => id === 'ai' ? 'ai:' + (this.lastAI || AI.current()) : 'tr:' + id);
    },
    provNames(ids) {
      return (ids || []).map(id => id === 'ai' ? AI.name(this.lastAI) : (LIST[id] || {}).name || id).join(' + ');
    },
    /** card.mtWarn: remembered on the card when its text was translated by machine only (no AI check) */
    mtFlag(by) {
      by = by || [];
      const machine = by.filter(id => ['google', 'mozhi', 'mymemory', 'microsoft', 'deepl'].includes(id));
      return machine.length && !by.includes('ai') ? { by: machine, t: Date.now() } : null;
    },
    /** warning under machine translations (Google & co.): they must be double-checked */
    machineWarnHtml(by, canRefine = true) {
      by = by || [];
      const machine = by.filter(id => ['google', 'mozhi', 'mymemory', 'microsoft', 'deepl'].includes(id));
      if (!machine.length) return '';
      if (by.includes('ai')) return `<div class="mt-warn ok">✓ Перевод проверен нейросетью (${U.esc(AI.name(this.lastAI))}). Нейросеть тоже может ошибаться — в важных случаях сверяйтесь со словарём.</div>`;
      const fix = AI.available()
        ? (canRefine ? 'кнопка «Уточнить перевод» (нейросеть проверит каждую строку)' : 'кнопка «Проверить карту» (нейросеть)')
        : 'подключите нейросеть (бесплатно: Gemini или Groq) — она проверит каждую строку';
      return `<div class="mt-warn">⚠️ <span><b>Машинный перевод (${U.esc(this.provNames(machine))}) — неточный, его нужно перепроверять.</b>
        Обычные фразы он переводит в основном верно, а устойчивые выражения и идиомы часто переводит дословно и неправильно.
        Как перепроверить: ${fix}, или сверьтесь с более точными источниками — DeepL, словари NAOB, LEXIN, Glosbe.</span></div>`;
    },
    /** opts.quiet: no «please wait» card (background work); opts.only: just these translators; opts.noAI: no neural network */
    async translateMany(texts, from = 'no', to = 'ru', opts = {}) {
      if (opts && opts.from) from = opts.from; // 🇬🇧 the source may also come as an option ({ from: 'en' })
      const clean = t => String(t || '').replace(/\s*\n\s*/g, ' ').trim();
      const src = texts.map(clean);
      const by = new Set();
      const out = src.map(t => { const c = this._trCache.get(`${from}|${to}|${t}`); if (c) by.add(c.id); return c ? c.t : ''; });
      const todo = () => src.map((t, i) => i).filter(i => src[i] && !out[i]);
      const fresh = {}; // who answered in this call (cached lines are not counted)
      // 🌐 «кто переводит»: the order of this call (the place's choice first) and who answered — for the 'tr-who' event
      const ctx = { place: this.placeOf(opts), base: this.orderFor(opts, true), fresh };
      opts = Object.assign({}, opts, { _ctx: ctx });
      // ⏳ more than a few lines to translate: a «please wait» card with the progress
      const total = todo().length;
      let done = 0;
      const busy = total > 3 && !opts.quiet ? UI.busy('Подождите — идёт перевод…') : null;
      if (busy) busy.set(`0 из ${total}`, 0, total);
      const put = (i, t, id) => {
        t = String(t || '').trim(); if (!t) return;
        if (!out[i]) { done++; if (busy) busy.set(`${done} из ${total}`, done, total); }
        out[i] = t; by.add(id); this._trCache.set(`${from}|${to}|${src[i]}`, { t, id });
        try { this._whoPut(id, ctx); } catch (e) { /* the badge is not our business */ }
        fresh[id] = (fresh[id] || 0) + 1;
        // whoever shows these lines can draw each one as it arrives (gradually, not all at the end)
        if (this.onPut) { try { this.onPut(); } catch (e) { /* drawing is not our business */ } }
      };
      if (total) { this._busy++; this._emit('tr-busy', { n: this._busy, place: ctx.place }); }
      try {
        const res = await this._translateMany(src, from, to, out, by, todo, put, opts);
        // 🌐 who really translated (the badge says «Переводит MyMemory» — and why the switch, for ~3 s)
        const top = Object.keys(fresh).sort((a, b) => fresh[b] - fresh[a])[0];
        if (!top && res.missing && total) { try { this._whoNone(ctx); } catch (e) { /* the badge is not our business */ } }
        return res;
      } finally {
        if (busy) busy.close();
        if (total) { this._busy = Math.max(0, this._busy - 1); this._emit('tr-busy', { n: this._busy, place: ctx.place }); }
      }
    },
    /** a translation already made in this session (lines that arrived while a long translation is still running) */
    cached(text, from = 'no', to = 'ru') {
      const c = this._trCache.get(`${from}|${to}|${String(text || '').replace(/\s*\n\s*/g, ' ').trim()}`);
      return c ? c.t : undefined;
    },
    async _translateMany(src, from, to, out, by, todo, put, opts = {}) {
      const S = Store.settings;
      const pool = async (ids, fn, n) => { let k = 0; await Promise.all(Array.from({ length: Math.min(n, ids.length) }, async () => { while (k < ids.length) await fn(ids[k++]); })); };
      const steps = {
        // DeepL: 40 texts per request
        deepl: async () => {
          const key = (S.deeplKey || '').trim();
          const host = /:fx$/.test(key) ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
          const ids = todo();
          for (let k = 0; k < ids.length; k += 40) {
            const part = ids.slice(k, k + 40);
            try {
              const r = await AI.post(host + '/v2/translate', { 'content-type': 'application/json', authorization: 'DeepL-Auth-Key ' + key },
                { text: part.map(i => src[i]), source_lang: deeplSrc(CODES.deepl[from]), target_lang: CODES.deepl[to] });
              if (!r.ok) {
                this.deeplError = r.status === 456 ? 'DeepL: месячный лимит исчерпан' : r.status === 403 ? 'DeepL: неверный ключ' : 'DeepL: ошибка ' + r.status;
                if (r.status === 456) this.trRest('deepl', 12 * 60); else if (r.status === 429 || r.status >= 500) this.trRest('deepl', 5);
                return;
              }
              (r.data.translations || []).forEach((t, n) => put(part[n], t.text, 'deepl'));
            } catch (e) { this.deeplError = e.message; this.trRest('deepl', 3); return; }
          }
        },
        // Google: a few requests of ~1200 characters, one text per line (dozens of parallel calls get blocked)
        google: async () => {
          if (pub()) return; // T1: the Mac only
          const LIMIT = 'Google временно ограничил переводы с вашего адреса (слишком много запросов за короткое время) — подождите 5–15 минут';
          const viaBridge = url => this.tfetch('/api/proxy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, method: 'GET' }) }, 15000);
          /** Google's answer → the text; its «sorry» page (HTML instead of JSON) counts as a refusal */
          const text = async r => { const j = await r.json().catch(() => null); if (!Array.isArray(j)) throw Object.assign(new Error(LIMIT), { limit: true }); return (j[0] || []).map(x => (x && x[0]) || '').join(''); };
          const gtx = async q => {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${CODES.google[from]}&tl=${CODES.google[to]}&dt=t&q=${encodeURIComponent(q)}`;
            // Google said «too many» a moment ago: this browser lets it rest (every extra request only makes the block
            // longer) — only the Mac bridge (another client) may ask, once per part; it refused too → it rests as well
            if (this.gCooling()) {
              if (!this.gBridgeOk()) throw Object.assign(new Error('Google временно ограничил переводы — перевожу другими переводчиками'), { limit: true });
              let b = null; try { b = await viaBridge(url); } catch (e) { /* below */ }
              if (b && b.ok) { try { return await text(b); } catch (e) { /* a refusal */ } }
              this.trRest('gbridge', 10);
              throw Object.assign(new Error(LIMIT), { limit: true });
            }
            let r = null;
            try { r = await this.tfetch(url); } catch (e) {
              // no answer although online: usually Google's «sorry» page (it has no CORS header) or a blocker —
              // the Mac bridge asks once; otherwise Google rests a little and the other translators go on
              if (navigator.onLine === false) throw new Error('нет интернета');
              this.gCool(5); // this browser rests in any case: the next parts go straight through the bridge or the spares
              if (this.gBridgeOk()) { try { r = await viaBridge(url); if (!r.ok) { this.trRest('gbridge', 10); r = null; } } catch (e2) { this.trRest('gbridge', 10); r = null; } }
              if (!r) {
                throw Object.assign(new Error('Google сейчас не отвечает — перевожу другими переводчиками'), { limit: true });
              }
            }
            // refused (limit): the same request once more through the Mac bridge — another client, often still allowed
            if (!r.ok && (r.status === 429 || r.status === 403)) {
              this.gCool(); // this browser rests in any case: the next parts go through the bridge or the spares
              if (this.gBridgeOk()) {
                try { const b = await viaBridge(url); if (b.ok) r = b; else this.trRest('gbridge', 10); } catch (e) { this.trRest('gbridge', 10); }
              }
            }
            if (!r.ok) throw Object.assign(new Error(r.status === 429 || r.status === 403 ? LIMIT : 'Google ответил ошибкой ' + r.status), { limit: r.status === 429 || r.status === 403 });
            return text(r);
          };
          const wait = ms => new Promise(res => setTimeout(res, ms));
          /** «gradually», like before: one line at a time with a small pause; stops only after several refusals in a row */
          const slow = async ids => {
            let fails = 0;
            for (const i of ids) {
              if (out[i]) continue;
              try { put(i, await gtx(src[i]), 'google'); fails = 0; await wait(250); } catch (e) {
                this.lastError = e.message;
                if (++fails >= 4) return false;
                await wait(1500 * fails); // back off a little and go on
              }
            }
            return true;
          };
          const chunks = []; let cur = [], len = 0;
          todo().forEach(i => { if (cur.length && (len + src[i].length > 1800 || cur.length >= 80)) { chunks.push(cur); cur = []; len = 0; } cur.push(i); len += src[i].length + 1; });
          if (cur.length) chunks.push(cur);
          // lines got merged by Google → split the part in halves (a few more requests, not one per line)
          const run = async ch => {
            const lines = (await gtx(ch.map(i => src[i]).join('\n'))).split('\n').map(s => s.trim());
            if (lines.length === ch.length) ch.forEach((i, k) => put(i, lines[k], 'google'));
            else if (ch.length === 1) put(ch[0], lines.join(' '), 'google');
            else { const h = Math.ceil(ch.length / 2); await run(ch.slice(0, h)); await run(ch.slice(h)); }
          };
          for (const ch of chunks) {
            try { await run(ch); } catch (e) {
              this.lastError = e.message;
              // refused for your address → first the spare translator (Mozhi), then — if something is still left —
              // Google again, gradually, one line at a time with pauses (as it used to). No internet → stop.
              if (e.limit && !this.gCooling()) this._gSlow = async () => { await wait(1200); await slow(todo()); };
              return;
            }
          }
        },
        // Mozhi: Google quality through public open-source servers — for when Google refuses your address
        // (Lingva, the older service of this kind, stopped working everywhere in 2026)
        mozhi: async () => {
          if (pub()) return; // T4: the Mac only
          const hosts = ['https://mozhi.ducks.party', 'https://mozhi.pussthecat.org'];
          let alive = hosts.slice();
          const ask = async q => {
            for (const h of alive.slice()) {
              try {
                const r = await this.tfetch(`${h}/api/translate?engine=google&from=${CODES.google[from]}&to=${CODES.google[to]}&text=${encodeURIComponent(q)}`, {}, 10000);
                if (r.ok) { const j = await r.json().catch(() => null); const t = j && (j['translated-text'] || j.translated_text); if (t) return t; }
                if (r.status >= 500 || r.status === 404 || r.status === 429) alive = alive.filter(x => x !== h);
              } catch (e) { alive = alive.filter(x => x !== h); }
            }
            throw new Error('Mozhi сейчас не отвечает');
          };
          const chunks = []; let cur = [], len = 0;
          todo().forEach(i => { if (cur.length && (len + src[i].length > 700 || cur.length >= 25)) { chunks.push(cur); cur = []; len = 0; } cur.push(i); len += src[i].length + 1; });
          if (cur.length) chunks.push(cur);
          const run = async ch => {
            const lines = String(await ask(ch.map(i => src[i]).join('\n'))).split('\n').map(s => s.trim());
            if (lines.length === ch.length) ch.forEach((i, k) => put(i, lines[k], 'mozhi'));
            else if (ch.length === 1) put(ch[0], lines.join(' '), 'mozhi');
            else { const h = Math.ceil(ch.length / 2); await run(ch.slice(0, h)); await run(ch.slice(h)); }
          };
          for (const ch of chunks) {
            if (!alive.length) { if (!this.lastError) this.lastError = 'Mozhi сейчас не отвечает'; this.trRest('mozhi', 10); return; }
            try { await run(ch); } catch (e) { if (!this.lastError) this.lastError = e.message; }
          }
          // every server died during the last (or only) part: it rests too, not only when a next part is left
          if (!alive.length) this.trRest('mozhi', 10);
        },
        // AI: parts of up to 40 lines per request (a long programme in one request gets cut off and is lost whole)
        ai: async () => {
          const left = todo(); if (!left.length) return;
          const lang = c => ({ no: 'Norwegian Bokmål', ru: 'Russian', en: 'English', uk: 'Ukrainian' })[c] || c;
          for (let k = 0; k < left.length; k += 40) {
            const part = left.slice(k, k + 40).filter(i => !out[i]); if (!part.length) continue;
            try {
              const arr = part.map(i => src[i]);
              const r = AI.parseJSON(await AI.call({
                system: `Translate each ${lang(from)} line of the JSON array into ${lang(to)}. The lines may be subtitles or short phrases: translate by meaning into natural, idiomatic ${lang(to)} as a native speaker would say it (not word for word), keep names as they are. Return ONLY a JSON array of strings with the same length and order.`,
                user: JSON.stringify(arr), maxTokens: Math.min(4000, 200 + arr.join(' ').length * 3), temperature: 0.1, quiet: true,
              }));
              this.lastAI = AI.lastProvider;
              const list = Array.isArray(r) ? r : (r && (r.translations || r.items || r.lines)) || [];
              if (list.length !== part.length) { if (list.length < part.length / 2) return; } // a broken answer: the next one
              part.forEach((i, n) => { if (typeof list[n] === 'string') put(i, list[n], 'ai'); });
            } catch (e) { if (!this.lastError) this.lastError = U.niceErr ? U.niceErr(e, '', true) : e.message; return; }
          }
        },
      };
      // Microsoft / MyMemory: one text per request, 3 at a time
      const single = id => async () => {
        let fails = 0, got = 0;
        let stop = 0;
        await pool(todo(), async i => {
          if (fails > 2 || stop) return;
          try { put(i, await this.translate(id, src[i], from, to), id); got++; } catch (e) {
            fails++; if (!this.lastError) this.lastError = `${(LIST[id] || {}).name || id}: ${e.message}`;
            if (e.limit) stop = e.restMin || 60; // the daily allowance is over: not one request more
          }
        }, 3);
        if (stop) this.trRest(id, stop);
        // it kept refusing (daily limit, server down): it rests; the next ones start without it
        else if (fails > 2 && !got) this.trRest(id, /лимит|limit|quota|warning/i.test(this.lastError) ? 60 : 10);
      };
      this.lastError = '';
      // the free spares (Mozhi, MyMemory) always stand in line; the place's own choice first; resting ones last
      const order = this.orderFor(opts);
      this._gSlow = null;
      for (const id of order) {
        if (!todo().length) break;
        // a long rest (a used-up daily allowance) is not tried at all — it would only refuse again
        if (id !== 'google' && this.trResting(id) && (this.trRestMap()[id] || 0) - Date.now() > 30 * 60000) continue;
        const before = todo().length;
        await (steps[id] || single(id))();
        if (todo().length < before) this.trUnrest(id); // it answered again — no more rest
      }
      if (todo().length && this._gSlow) { const s = this._gSlow; this._gSlow = null; await s(); }
      const missing = todo().length;
      // the public build without Pro / keys: one calm way forward instead of «nobody answered»
      const setup = !!missing && this.needSetup();
      if (setup) this.lastError = this.publicHint();
      return { out, by: [...by], missing, needSetup: setup, error: missing ? U.calm(this.lastError) || 'переводчики сейчас не отвечают' : '' };
    },

    /** other meanings of ONE Norwegian word (Google: dictionary + alternative translations) — for finding the word
     *  in a sentence translation. One request; refused / resting Google → throws (the caller stops asking). */
    async alts(word, from = 'no', to = 'ru') {
      if (pub()) throw notHere('google'); // the dictionary of the unofficial Google endpoint: the Mac only
      const j = await this.gget(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${CODES.google[from]}&tl=${CODES.google[to]}&dt=t&dt=bd&dt=at&q=${encodeURIComponent(word)}`);
      const out = [];
      const add = t => { t = String(t || '').trim(); if (t && t.length <= 40 && /[а-яё]/i.test(t) && !out.includes(t)) out.push(t); };
      ((j && j[0]) || []).forEach(x => add(x && x[0]));
      ((j && j[1]) || []).forEach(g => (g[1] || []).forEach(add));
      ((j && j[5]) || []).forEach(seg => (seg[2] || []).forEach(x => add(x && x[0])));
      return out.slice(0, 8);
    },
    /** main translation + other meanings (Google dictionary, MyMemory matches) */
    async detail(id, text, from, to, opts = {}) {
      if (macOnly(id) || (id === 'deepl' && !deeplHere())) throw notHere(id);
      if (id === 'google') {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${CODES.google[from]}&tl=${CODES.google[to]}&dt=t&dt=bd&q=${encodeURIComponent(text)}`;
        const j = await this.gget(url);
        const main = (j[0] || []).map(x => x[0]).join('').trim();
        const alts = [];
        const collect = jj => (jj[1] || []).forEach(group => (group[1] || []).forEach(t => { if (alts.length < 10 && !alts.includes(t)) alts.push(t); }));
        collect(j);
        // Google's dictionary doesn't know "å spise" / "en bil" — ask again with the bare word for other meanings
        const bare = text.replace(/^(å|en|ei|et)\s+/i, '');
        if (!alts.length && bare !== text) {
          try { collect(await this.gget(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${CODES.google[from]}&tl=${CODES.google[to]}&dt=t&dt=bd&q=${encodeURIComponent(bare)}`)); } catch (e) { /* ignore */ }
        }
        return { main, alts: alts.filter(a => U.norm(a) !== U.norm(main)) };
      }
      if (id === 'mymemory') {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${CODES.mymemory[from]}|${CODES.mymemory[to]}`;
        const j = await (await this.tfetch(url, {}, 20000)).json();
        const main = j && j.responseData && j.responseData.translatedText;
        if (!main || /MYMEMORY WARNING|INVALID/i.test(main)) throw new Error('MyMemory: лимит или ошибка');
        const alts = [];
        (j.matches || []).forEach(m => { const t = String(m.translation || '').trim(); if (t && t.length < 60 && !alts.some(a => U.norm(a) === U.norm(t)) && U.norm(t) !== U.norm(main)) alts.push(t); });
        return { main: main.trim(), alts: alts.slice(0, 6) };
      }
      return { main: await this.translate(id, text, from, to, opts), alts: [] };
    },

    /* ---------- word forms (from the card) translated one by one ---------- */
    LABELS: {
      verb: ['Инфинитив (infinitiv)', 'Настоящее (presens)', 'Прошедшее (preteritum)', 'Перфект (perfektum)', 'Повелительное (imperativ)'],
      substantiv: ['Неопр. ед. (ubestemt entall)', 'Опр. ед. (bestemt entall)', 'Неопр. мн. (ubestemt flertall)', 'Опр. мн. (bestemt flertall)'],
      adjektiv: ['м/ж род (hankjønn/hunkjønn)', 'ср. род (intetkjønn)', 'мн. / опр. (flertall/bestemt)', 'Сравнительная (komparativ)', 'Превосходная (superlativ)'],
    },
    /** forms of the card: saved ones, or parsed from "verb: å spise – spiser – spiste – har spist" */
    parseForms(card) {
      if ((card.forms || []).length) return { cls: card.wordClass || '', items: card.forms.map(f => ({ label: f.label, no: f.no })) };
      const m = String(card.description || '').match(/^\s*(verb|substantiv|adjektiv)\s*:\s*([^\n]+)/im);
      if (!m) return null;
      const cls = m[1].toLowerCase();
      const parts = m[2].replace(/\([^)]*\)/g, ' ').split(/\s+[–—-]\s+/).map(s => s.trim()).filter(Boolean).slice(0, 6);
      if (parts.length < 2) return null;
      const labels = this.LABELS[cls] || [];
      return { cls, items: parts.map((no, i) => ({ label: labels[i] || '', no })) };
    },
    /** verbs get a pronoun so the translation shows person and tense: "spiste" -> "jeg spiste" -> "я ел" */
    formQuery(cls, no, i) {
      if (cls === 'verb' && i > 0 && !/^(å|jeg|du|han|hun|vi|dere|de)\s/i.test(no)) return (i === 4 ? '' : 'jeg ') + no;
      return no;
    },
    async translateForms(id, card, opts = {}) {
      const p = this.parseForms(card);
      if (!p) return null;
      const items = await Promise.all(p.items.map(async (f, i) => {
        const q = this.formQuery(p.cls, f.no, i);
        try { return { label: f.label, no: q, ru: await this.translate(id, q, 'no', 'ru', opts) }; }
        catch (e) { return { label: f.label, no: q, ru: '' }; }
      }));
      return { cls: p.cls, items: items.filter(x => x.ru) };
    },

    /** does the translator agree with the card? */
    agrees(result, existing) {
      const alts = s => U.alternatives(String(s || '').split('\n')[0]).map(x => U.norm(x, { stripArticles: true }));
      const a = alts(result), b = alts(existing);
      return a.some(x => b.some(y => x && y && (x === y || x.includes(y) || y.includes(x))));
    },

    /** who took part in this card -> { 'tr:google': 2, 'ai:gemini': 1, ... } */
    activity(card, extraBys = []) {
      const counts = {};
      const add = by => { if (/^(tr|ai):/.test(by)) counts[by] = (counts[by] || 0) + 1; };
      if (card) {
        (card.history || []).forEach(h => add(h.by));
        if (!(card.history || []).some(h => String(h.by).startsWith('ai:'))) (card.aiChecks || []).forEach(x => add('ai:' + x.p));
      }
      extraBys.forEach(add);
      return counts;
    },
    /** one rail button (key = 'tr:google' | 'ai:gemini'); glows when it worked on this card */
    btnHtml(key, n, opts) {
      const [k, id] = key.split(':');
      const isAI = k === 'ai';
      const name = isAI ? AI.PROVIDERS[id].short : LIST[id].name;
      const state = n ? `работал с карточкой: ${n}×` : 'ещё не участвовал';
      const extra = opts.needsKey ? 'нужен ключ — пока откроется сайт ↗' : opts.web ? 'откроется сайт ↗' : isAI ? 'перевод и сверка нейросетью' : LIST[id].panel || ACT[id] ? 'прямо в приложении' : 'перевод прямо в карточку';
      const head = opts.needsKey ? `Подключить ${name}` : `${name} — ${isAI ? 'проверить' : ACT[id] || 'перевести'}`;
      return this.toolHtml(isAI ? key : id, {
        attrs: `${isAI ? `data-ai="${id}"` : `data-tr="${id}"`} data-rk="${key}" data-kind="${k}"`,
        cls: `${opts.needsKey ? 'nokey' : ''} ${n ? 'on' : ''}`, name, head, sub: n ? `${state}<br>${extra}` : extra, n, needsKey: opts.needsKey,
        act: opts.needsKey ? 'подключить' : isAI ? 'проверить' : ACT[id] || 'перевести',
      });
    },
    /** the brand tile of a service (translator / dictionary id or 'ai:<provider>'), e.g. for a list of sources */
    brand(key) { return brandOf(key).html; },
    /**
     * one tool button on a rail: the service's brand tile + its name and action on hover.
     * Slots: .tr-count (top right) — how often it worked on this card (light());
     *        .tool-badge (top left) — reserved for the «used» number: the source's footnote number in the card text (markUsed());
     *        .tool-key (bottom right) — 🔑 the service still needs a key.
     */
    toolHtml(brandKey, o) {
      const b = brandOf(brandKey);
      const label = `${o.head}${o.sub ? ' · ' + String(o.sub).replace(/<br>/g, ' · ') : ''}`;
      return `<button type="button" class="tool-btn ${o.cls || ''}${b.tone ? ' tone-' + b.tone : ''}" ${o.attrs || ''} data-brand="${U.esc(String(brandKey).replace(/^ai:/, ''))}" style="--glow:${b.glow}" aria-label="${U.esc(label)}">
          <span class="tool-ico" aria-hidden="true">${b.html}</span>${o.needsKey ? KEY_BADGE : ''}<span class="tool-badge" aria-hidden="true"></span>${o.n ? `<span class="tr-count">${o.n}</span>` : ''}
          <span class="tool-tip" aria-hidden="true"><b>${U.esc(o.head)}</b>${o.sub ? `<small>${o.sub}</small>` : ''}<i class="tool-name">${U.esc(String(o.name || o.head).replace(/\.com$/, ''))}</i>${o.act ? `<i class="tool-act">${U.esc(o.act)}</i>` : ''}</span></button>`;
    },
    /**
     * (prepared, not used yet) mark a service as a numbered source of the card: the number shows in the tile's corner
     * and can be cited in the card text. markUsed(rail, 'tr:deepl', 1); markUsed(rail, 'tr:deepl', 0) removes it.
     */
    markUsed(rail, key, num) {
      if (!rail) return;
      rail.querySelectorAll(`[data-rk="${key}"]`).forEach(b => {
        const s = b.querySelector('.tool-badge'); if (!s) return;
        if (num) { b.dataset.used = num; s.textContent = num; } else { delete b.dataset.used; s.textContent = ''; }
      });
    },
    /** RIGHT rail: translators (inline first) + dictionaries/sites */
    railHtml(extraCls = '', card = null) {
      const act = this.activity(card);
      const ids = this.enabled().filter(id => id !== 'ai');
      const inline = ids.filter(id => !LIST[id].web);
      const web = ids.filter(id => LIST[id].web);
      return `<div class="tr-rail ${extraCls}" data-tr-rail data-side="right">
        ${inline.map(id => this.btnHtml('tr:' + id, act['tr:' + id] || 0, { needsKey: LIST[id].key && !this.inline(id) })).join('')}
        ${this.toolHtml('compare', { attrs: 'data-tr="compare"', cls: 'compare', name: 'Сравнить все', head: 'Сравнить все', sub: 'все переводчики рядом', act: 'все рядом' })}
        ${web.length ? this.toolHtml('more', { attrs: 'data-tr="more"', cls: `more ${web.some(id => act['tr:' + id]) ? 'on' : ''}`, name: 'Ещё словари', head: 'Ещё словари', sub: web.map(id => U.esc(LIST[id].name)).join(' · '), act: 'на сайтах' }) : ''}
      </div>`;
    },
    /** popover with the dictionary websites (opened with the word already filled in) */
    /**
     * popover with the dictionary websites. Each: ↗ open with the word filled in, 📋 paste what you copied there
     * (translated line by line, with the dictionary as the source). Forvo is audio only — no paste.
     */
    moreMenu(anchor, text, from, to, onOpen, onPaste) {
      const web = this.enabled().filter(id => LIST[id] && LIST[id].web);
      const canPaste = id => !!onPaste && id !== 'forvo';
      const pop = UI.popover(anchor, `<div class="pop-title">📚 Словари и сайты</div>
        <div class="lt-grid">${web.map(id => `<div class="lt-tile web-tile">
          <span class="web-ico">${this.brand(id)}</span>
          <span class="lt-text"><b>${U.esc(LIST[id].name)}</b><small>${U.esc(LIST[id].note)}</small>
            <span class="row" style="gap:6px;margin-top:6px">
              <button class="btn sm" data-web="${id}">↗ Открыть</button>
              ${canPaste(id) ? `<button class="btn sm primary" data-paste="${id}">📋 Вставить в карточку</button>` : ''}
            </span></span></div>`).join('')}</div>`, 'layout-pop');
      pop.el.onclick = e => {
        const o = e.target.closest('[data-web]');
        const p = e.target.closest('[data-paste]');
        if (o) {
          const id = o.dataset.web;
          pop.close();
          const go = () => {
            this.open(id, text, from, to);
            onOpen && onOpen(id);
            // when the user comes back from the site — one click to bring the copied text into the card
            if (canPaste(id)) UI.toastAction(`Скопировали текст на сайте ${LIST[id].name}? Вставьте его в карточку с переводом`, `📋 Вставить из ${LIST[id].name}`, () => onPaste(id), 60000, '📋');
          };
          // explain the copy -> paste way once (Forvo is audio only — just open it)
          if (canPaste(id)) Guides.webDict(id, go); else go();
        }
        if (p) { pop.close(); onPaste(p.dataset.paste); }
      };
    },
    /** LEFT rail: connected neural networks (each with its own icon) */
    aiRailHtml(extraCls = '', card = null) {
      const act = this.activity(card);
      const ids = AI.chain();
      return `<div class="tr-rail ai-rail ${extraCls}" data-ai-rail data-side="left">
        ${ids.map(id => this.btnHtml('ai:' + id, act['ai:' + id] || 0, {})).join('')}
        ${this.toolHtml('add', { attrs: 'data-ai="add"', cls: 'add', name: 'Нейросеть', head: 'Подключить нейросеть', sub: 'Gemini, Groq, Claude, ChatGPT…', act: 'подключить' })}
      </div>`;
    },
    /**
     * FRONT side of the card: only the services that already worked on it, big and glowing,
     * in the same place as on the back (AIs left, translators right). Click -> history.
     */
    activeRailsHtml(card) {
      const act = this.activity(card);
      const keys = Object.keys(act);
      const btn = key => {
        const [k, id] = key.split(':');
        const name = k === 'ai' ? (AI.PROVIDERS[id] || {}).short : (LIST[id] || {}).name;
        if (!name) return '';
        return this.toolHtml(k === 'ai' ? key : id, { attrs: `data-prov="${key}" data-card="${card.id}" data-kind="${k}"`, cls: 'on', name, head: `${name} — история`, sub: `работал с карточкой: ${act[key]}×`, n: act[key], act: 'история' });
      };
      const ai = keys.filter(k => k.startsWith('ai:')), tr = keys.filter(k => k.startsWith('tr:'));
      return (ai.length ? `<div class="tr-rail vertical card-rail left front-rail" data-side="left">${ai.map(btn).join('')}</div>` : '')
        + (tr.length ? `<div class="tr-rail vertical card-rail right front-rail" data-side="right">${tr.map(btn).join('')}</div>` : '');
    },
    /**
     * a card rail too tall for one column flows into a second one (css: grid-auto-flow column). The first column
     * (at the card's edge) is filled right down to the card's bottom; only what is left goes to the second one —
     * measured from the real card, and again whenever the card changes size.
     */
    fitRails(root) {
      const rails = [...(root || document).querySelectorAll('.face .tr-rail.vertical.card-rail')];
      if (!rails.length) return;
      if (!this._balRO && window.ResizeObserver) {
        // a face that left the page (the next card) is let go — no pile of old faces in a long session
        this._balRO = new ResizeObserver(es => es.forEach(e => !e.target.isConnected ? this._balRO.unobserve(e.target) : e.target.querySelectorAll(':scope > .tr-rail.vertical.card-rail').forEach(r => this.fitOne(r))));
      }
      rails.forEach(r => {
        this.fitOne(r);
        const face = r.parentElement;
        if (this._balRO && face && !face._balObs) { face._balObs = true; this._balRO.observe(face); }
      });
    },
    fitOne(rail) {
      if (!rail || !rail.isConnected) return;
      rail.style.gridTemplateRows = ''; rail.style.maxHeight = '';
      const items = [...rail.children].filter(c => c.offsetWidth > 0);
      const face = rail.parentElement;
      if (!face || items.length < 2 || !face.clientHeight) return; // not laid out (hidden) — leave the css flow
      const cs = getComputedStyle(rail);
      const tb = parseFloat(cs.getPropertyValue('--tb')) || items[0].offsetHeight || 44;
      const gap = parseFloat(cs.rowGap) || 0;
      // from the first tile's top down to 6 px above the card's inner bottom edge (the rail's bottom padding is just air too)
      const avail = face.clientHeight - rail.offsetTop - (parseFloat(cs.paddingTop) || 0) - 6;
      const rows = Math.max(1, Math.floor((avail + gap) / (tb + gap)));
      // one column when they all fit (not the css max-height, which is a little stricter), else the edge column full
      const n = Math.min(rows, items.length);
      rail.style.maxHeight = 'none';
      rail.style.gridTemplateRows = `repeat(${n}, var(--tb))`;
      // the bottom tile of each column opens its label upwards — no label hanging past the card's bottom (clipped / a scroll on the back)
      items.forEach((c, i) => c.classList.toggle('tip-up', i % n === n - 1));
    },

    /** light up rails after an action (with a short "burst" on the icon just used) */
    light(rail, card, extraBys = [], burstKey = null) {
      if (!rail) return;
      const act = this.activity(card, extraBys);
      rail.querySelectorAll('[data-rk]').forEach(b => {
        const id = b.dataset.rk;
        const n = act[id] || 0;
        b.classList.toggle('on', !!n);
        let cnt = b.querySelector('.tr-count');
        if (n) { if (!cnt) { cnt = document.createElement('span'); cnt.className = 'tr-count'; b.appendChild(cnt); } cnt.textContent = n; }
        else if (cnt) cnt.remove();
        if (id === burstKey) { b.classList.remove('burst'); void b.offsetWidth; b.classList.add('burst'); setTimeout(() => b.classList.remove('burst'), 950); }
      });
    },

    /**
     * ⚖️ all translators side by side — inside the app (js/compare.js + css/compare.css, loaded on first use):
     * every callable service runs at once, results in place, then agreement %, ✓ / ≈ / ✗ and the AI verdict.
     * onPick(text, translatorId | 'ai') — «Вставить» (Translators.lastAI = the network for 'ai').
     * opts (optional): { current: the card's translation now, onExplain(block, marker, by, note) } — without them
     * the comparison finds the open card editor / the studied card itself.
     */
    compareDialog(text, from, to, onPick, opts) {
      if (window.Compare) return Compare.open(text, from, to, onPick, opts);
      this.loadCompare().then(ok => ok ? Compare.open(text, from, to, onPick, opts) : this.compareLegacy(text, from, to, onPick));
      return null;
    },
    /** js/compare.js + css/compare.css on first use (same ?v= as this file); → true when ready */
    loadCompare() {
      if (window.Compare) return Promise.resolve(true);
      if (this._cmpLoad) return this._cmpLoad;
      const me = document.querySelector('script[src*="js/translators.js"]');
      const v = me && me.getAttribute('src').includes('?') ? '?' + me.getAttribute('src').split('?')[1] : '';
      const css = document.querySelector('link[href*="css/compare.css"]') ? Promise.resolve() : new Promise(res => {
        const l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = 'css/compare.css' + v; l.onload = l.onerror = () => res();
        document.head.appendChild(l);
        setTimeout(res, 2500); // never wait for the look longer than that
      });
      const js = new Promise(res => {
        const sc = document.createElement('script');
        sc.src = 'js/compare.js' + v; sc.onload = () => res(!!window.Compare); sc.onerror = () => res(false);
        document.head.appendChild(sc);
      });
      this._cmpLoad = Promise.all([js, css]).then(([ok]) => { if (!ok) this._cmpLoad = null; return ok; });
      return this._cmpLoad;
    },
    /** the old simple list (only if js/compare.js could not be loaded, e.g. offline before the first use) */
    compareLegacy(text, from, to, onPick) {
      const ids = this.enabled().filter(id => !LIST[id].panel);
      const m = UI.modal({
        title: `⚖️ Сравнение переводов · ${from === 'no' ? '🇳🇴 → 🇷🇺' : '🇷🇺 → 🇳🇴'}`, cls: '',
        body: `<div class="tr-src">${UI.rich(text)}</div>
          <div class="tr-compare">${ids.map(id => `<div class="tr-row" data-row="${id}">
            <span class="tr-name">${this.icon(id, 20)} ${U.esc(this.label(id))}</span>
            <span class="tr-res">${this.inline(id) ? '<span class="spinner sm"></span>' : `<span class="muted small">${LIST[id].dict ? 'словарь' : 'на сайте'}</span>`}</span>
            <span class="tr-act">${this.inline(id) ? '' : `<button class="btn sm" data-open="${id}">Открыть ↗</button>`}</span>
          </div>`).join('')}</div>
          <div class="small muted">Совпадающие варианты отмечены ✓ — им можно доверять больше.</div>`,
        foot: `<button class="btn ghost" data-close2>Закрыть</button>`,
      });
      m.$('[data-close2]').onclick = () => m.close();
      const results = {};
      const mark = () => {
        const norm = s => U.norm(s, { stripArticles: true });
        const vals = Object.values(results).filter(Boolean).map(norm);
        Object.entries(results).forEach(([id, r]) => {
          const row = m.$(`[data-row="${id}"] .tr-res`); if (!row || !r) return;
          const n = vals.filter(v => v === norm(r)).length;
          row.querySelector('.agree') && row.querySelector('.agree').remove();
          if (n > 1) row.insertAdjacentHTML('beforeend', ` <span class="chip learned agree">✓ ${n}</span>`);
        });
      };
      ids.filter(id => this.inline(id)).forEach(async id => {
        const cell = m.$(`[data-row="${id}"] .tr-res`), act = m.$(`[data-row="${id}"] .tr-act`);
        try {
          const r = await this.translate(id, text, from, to);
          results[id] = r;
          cell.innerHTML = `<b>${UI.rich(r)}</b>`;
          if (onPick) act.innerHTML = `<button class="btn sm primary" data-pick="${id}">Вставить</button>`;
          mark();
        } catch (e) {
          cell.innerHTML = `<span class="muted small">${U.esc(U.niceErr(e))}</span>`;
          act.innerHTML = `<button class="btn sm" data-open="${id}">Открыть ↗</button>`;
        }
      });
      m.el.addEventListener('click', e => {
        const o = e.target.closest('[data-open]'); if (o) this.open(o.dataset.open, text, from, to);
        const p = e.target.closest('[data-pick]'); if (p && onPick) { onPick(results[p.dataset.pick], p.dataset.pick); m.close(); }
      });
      return m;
    },
  };

  window.Translators = Translators;
})();
