/* ============ 🎧 «Аудиокурсы» — 50languages lessons kept INSIDE the app and played from there ============
 * The free MP3 course of 50languages (Goethe Verlag, free for personal use): 100 lessons RU–NO (and UK–NO).
 *  - ⬇ «Загрузить в приложение»: the archive is read lesson by lesson (HTTP Range: the zip's table of contents, then
 *    each lesson's bytes, unpacked here with DecompressionStream) through the Mac bridge (/api/proxy — the site does not
 *    let a browser read it directly). Every lesson is saved at once in Cache Storage «norsk-kort-audio» (the same store
 *    as the decks' offline voice and the saved Telegram audio — js/listenx.js, js/tgaudio.js; sw.js never touches it)
 *    under /__nk_audio/course/<course>/<file>. So a stopped or broken download simply continues where it was.
 *    Browsers without DecompressionStream('deflate-raw') — the whole archive with progress, unpacked by JSZip.
 *  - 📂 «У меня уже скачано»: a folder (RUNO-all…), MP3 files or the .zip itself — chosen or dropped here.
 *  - Lesson titles: the official list of 50languages (goethe-verlag.com/book2/RU/RUNO/RUNO002.HTM, UK/UKNO/UKNO002.HTM,
 *    NO/NORU/NORU002.HTM — read 2026-11); the archive's _readme.htm has no lesson names.
 *  - ▶ the lessons play in the app's listening player (Listen.startMedia — lock screen and headphone buttons, the bar,
 *    «Сейчас играет», sleep timer, speed); here: ±10 s, repeat a lesson, A–B repeat, «Слушать подряд», the place
 *    remembered (window.Resume when present + our own key).
 *  - 🔈 where: the system output (headphones, speaker, Bluetooth speaker), the output device on computers
 *    (ListenX.where — setSinkId), AirPlay in Safari, 📺 TV / Google speaker through the bridge (the lesson is sent to
 *    the bridge — /api/cast/upload — and the TV fetches it from the Mac; bridge/cast.py).
 * window.AudioCourse = { open(), openCourse(id), importFiles(files) }
 */
(function () {
  const STORE = 'norsk-kort-audio'; // = ListenX.cache.NAME, TgAudio
  const META_KEY = 'nk-ac', POS_KEY = 'nk-ac-pos', PREF_KEY = 'nk-ac-prefs';
  const enc = encodeURIComponent;
  const esc = s => U.esc(s == null ? '' : String(s));
  const ls = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const mb = n => (n >= 1e9 ? `${(n / 1e9).toFixed(1).replace('.', ',')} ГБ` : n >= 1e6 ? `${Math.round(n / 1e6)} МБ` : `${Math.max(1, Math.round((n || 0) / 1e3))} КБ`);
  const mss = t => { t = Math.max(0, Math.floor(t || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  const friendly = (msg, extra) => Object.assign(new Error(msg), { friendly: true }, extra || {});
  const HP = (s, on) => (window.Listen && Listen.HEADPHONES ? Listen.HEADPHONES(s, on) : '🎧');
  const TV = s => (window.UI && UI.TV_SVG ? UI.TV_SVG(s) : '📺');
  const bridgeUp = () => !!(window.AI && AI.bridge && AI.bridge.up);
  const AUDIO_RE = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac)$/i;
  const MIME = n => (/\.m4a$|\.aac$/i.test(n) ? 'audio/mp4' : /\.og[ga]$|\.opus$/i.test(n) ? 'audio/ogg' : /\.wav$/i.test(n) ? 'audio/wav' : /\.flac$/i.test(n) ? 'audio/flac' : 'audio/mpeg');
  // the app runs on this Mac itself: only here do hints with the Terminal command make sense (not for site visitors)
  const onMac = () => location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/.test(location.hostname);
  const NEED_BRIDGE_MAC = 'Сайт 50languages не даёт браузеру загрузить курс напрямую. Запустите мост на Mac (в Терминале: python3 …/bridge/server.py) и нажмите ещё раз. Или скачайте архив с сайта и добавьте его кнопкой «📂 У меня уже скачано».';
  const NEED_BRIDGE_SITE = 'Сайт 50languages не даёт браузеру загрузить курс напрямую. Скачайте архив с сайта курса (кнопка «⬇ Скачать файл» в «📚 Книгах») и добавьте его сюда кнопкой «📂 У меня уже скачано» — уроки будут играть без интернета.';
  const needBridge = () => (onMac() ? NEED_BRIDGE_MAC : NEED_BRIDGE_SITE);
  const RESTART = 'Мост на Mac нужно перезапустить — в нём новая функция: в окне Терминала, где он запущен, нажмите Ctrl+C и снова запустите python3 …/bridge/server.py. Потом нажмите «Загрузить» ещё раз.';
  const LICENCE = 'Источник: 50languages / Goethe Verlag — бесплатно для личного использования';

  /* ---------------- the catalogue (the same archives as «📚 Книги», js/books.js) ---------------- */
  // official lesson titles: [русский, українська, norsk] — goethe-verlag.com/book2 (RUNO002 / UKNO002 / NORU002)
  const T = [
    ["Люди", "Особи", "Personer"], ["Семья", "Сім’я", "Familie"], ["Знакомиться", "Знайомство", "Bli kjent"], ["В школе", "В школі", "På skolen"],
    ["Страны и языки", "Країни і мови", "Land og språk"], ["Читать и писать", "Читати і писати", "Lese og skrive"], ["Цифры", "Числа", "Tall"], ["Время дня", "Години доби", "Klokkeslett"],
    ["Дни недели", "Дні тижня", "Ukedager"], ["Вчера – сегодня – завтра", "Вчора – сьогодні – завтра", "I går – i dag – i morgen"], ["Месяцы", "Місяці", "Måneder"], ["Напитки", "Напої", "Drikke"],
    ["Виды деятельности", "Види діяльності", "Aktiviteter"], ["Цвета", "Кольори", "Farger"], ["Фрукты и продукты", "Плоди та продукти харчування", "Frukt og matvarer"], ["Времена года и погода", "Пори року і погода", "Årstider og vær"],
    ["В доме", "У будинку", "I huset"], ["Уборка дома", "Прибирання в домі", "Husvask"], ["На кухне", "На кухні", "På kjøkkenet"], ["Лёгкая беседа 1", "Коротка розмова 1", "Småprat 1"],
    ["Лёгкая беседа 2", "Коротка розмова 2", "Småprat 2"], ["Лёгкая беседа 3", "Коротка розмова 3", "Småprat 3"], ["Изучать иностранные языки", "Вивчення іноземних мов", "Å lære fremmedspråk"], ["Встреча", "Домовленість про зустріч", "Avtale"],
    ["В городе", "У місті", "I byen"], ["На природе", "На природі", "Ute i naturen"], ["В гостинице – Прибытие", "В готелі – прибуття", "På hotell – ankomst"], ["В гостинице – Жалобы", "В готелі – скарги", "På hotellet – klager"],
    ["В ресторане 1", "В ресторані 1", "På restaurant 1"], ["В ресторане 2", "В ресторані 2", "På restaurant 2"], ["В ресторане 3", "В ресторані 3", "På restaurant 3"], ["В ресторане 4", "В ресторані 4", "På restaurant 4"],
    ["На вокзале", "На вокзалі", "På togstasjonen"], ["В поезде", "У поїзді", "På toget"], ["В аэропорту", "В аеропорту", "På flyplassen"], ["Общественный транспорт", "Приміське сполучення", "Kollektivtrafikk"],
    ["В дороге", "В дорозі", "På vei"], ["В такси", "У таксі", "I drosjen"], ["Поломка машины", "Автопригоди", "Bilulykke"], ["Спрашивать дорогу", "Запитання шляху", "Spørre etter veien"],
    ["Ориентация", "Орієнтування", "Orientering"], ["Экскурсия по городу", "Екскурсія до міста", "Sightseeing i byen"], ["В зоопарке", "В зоопарку", "I dyreparken"], ["Вечернее времяпровождение", "Вечірні розваги", "Gå ut på kvelden"],
    ["В кино", "В кіно", "På kino"], ["На дискотеке", "На дискотеці", "På diskotek"], ["Подготовка к поездке", "Підготовка до подорожі", "Reiseforberedelser"], ["В отпуске", "Що ми робимо у відпустці", "Ferieaktiviteter"],
    ["Спорт", "Спорт", "Sport / idrett"], ["В бассейне", "В басейні", "I svømmehallen"], ["Делать покупки", "Робити покупки", "Gjøre ærender"], ["В магазине", "В магазині", "I butikken"],
    ["Магазины", "Магазини", "Butikker"], ["Покупки", "Покупки", "Handle"], ["Работать", "Робота", "Jobbe"], ["Чувства", "Почуття", "Følelser"],
    ["У врача", "У лікаря", "Hos legen"], ["Части тела", "Частини тіла", "Kroppsdeler"], ["На почте", "На пошті", "På postkontoret"], ["В банке", "В банку", "I banken"],
    ["Порядковые номера", "Порядкові числа", "Ordenstall"], ["Задавать вопросы 1", "Ставити запитання 1", "Stille spørsmål 1"], ["Задавать вопросы 2", "Ставити запитання 2", "Stille spørsmål 2"], ["Отрицание 1", "заперечення 1", "Nektelse 1"],
    ["Отрицание 2", "Заперечення 2", "Nektelse 2"], ["Относительные местоимения", "Присвійні займенники 1", "Possessiver 1"], ["Относительные местоимения 2", "Присвійні займенники 2", "Possessiver 2"], ["Большой / -ая – маленький / -ая", "Великий – малий", "stor – liten"],
    ["нуждаться – хотеть", "потребувати – хотіти", "trenge – ville"], ["Изъявлять желание", "Хотіти що-небудь", "ville noe 1"], ["Что-то хотеть", "Щось хотіти", "ville noe 2"], ["быть должным (что-то сделать)", "Щось мусити", "måtte noe"],
    ["Можно (разрешается) (что-то делать)", "Щось могти (мати дозвіл)", "ha lov til noe / kunne noe"], ["О чем-нибудь просить", "Щось просити", "be om noe"], ["Что-то обосновывать 1", "Щось обґрунтовувати 1", "begrunne noe 1"], ["Что-то обосновывать 2", "Щось обґрунтовувати 2", "begrunne noe 2"],
    ["Что-то обосновывать 3", "Щось обґрунтовувати 3", "begrunne noe 3"], ["Прилагательные 1", "Прикметники 1", "Adjektiv 1"], ["Прилагательные 2", "Прикметники 2", "Adjektiv 2"], ["Прилагательные 3", "Прикметники 3", "Adjektiv 3"],
    ["Прошедшая форма 1", "Минулий час 1", "Fortid 1"], ["Прошедшая форма 2", "Минулий час 2", "Fortid 2"], ["Прошедшая форма 3", "Минулий час 3", "Fortid 3"], ["Прошедшая форма 4", "Минулий час 4", "Fortid 4"],
    ["Спрашивать – прошедшая форма 1", "Питання – минулий час 1", "Spørsmål – fortid 1"], ["Спрашивать – прошедшая форма 2", "Питання – минулий час 2", "Spørsmål – fortid 2"], ["Прошедшая форма модальных глаголов 1", "Модальні дієслова у минулому 1", "Fortid av modalverb 1"], ["Прошедшая форма модальных глаголов 2", "Модальні дієслова у минулому 2", "Fortid av modalverb 2"],
    ["Повелительная форма 1", "Наказовий спосіб 1", "Imperativ 1"], ["Повелительная форма 2", "Наказовий спосіб 2", "Imperativ 2"], ["Подчиненные предложения с что 1", "Складнопідрядні речення із що 1", "Bisetninger med at 1"], ["Подчиненные предложения с что 2", "Складнопідрядні речення із що 2", "Bisetninger med at 2"],
    ["Подчиненные предложения с ли", "Складнопідрядні речення з чи", "Bisetninger med om"], ["Союзы 1", "Сполучники 1", "Konjunksjoner 1"], ["Союзы 2", "Сполучники 2", "Konjunksjoner 2"], ["Союзы 3", "Сполучники 3", "Konjunksjoner 3"],
    ["Союзы 4", "Сполучники 4", "Konjunksjoner 4"], ["Двойные союзы", "Подвійні сполучники", "Doble konjunksjoner"], ["Генитив (родительный падеж)", "Родовий відмінок", "Genitiv"], ["Наречия", "Прислівники", "Adverb"],
  ];
  const COURSES = [
    { id: 'runo', code: 'RUNO', flag: '🇷🇺🇳🇴', lang: 'ru', title: '50languages — 100 уроков RU–NO', short: '50languages RU–NO',
      zip: 'https://www.book2.nl/book2/RU/RUNO/RUNO-all.zip', zipBytes: 72918205, appBytes: 122441692, lessons: 100,
      site: 'https://www.goethe-verlag.com/book2/RU/RUNO/RUNO002.HTM', note: 'Разговорные фразы для начинающих (A1–A2): по-русски и по-норвежски, озвучено носителями.' },
    { id: 'ukno', code: 'UKNO', flag: '🇺🇦🇳🇴', lang: 'uk', title: '50languages — 100 уроків UK–NO', short: '50languages UK–NO',
      zip: 'https://www.linguafree.com/book2/UK/UKNO/UKNO-all.zip', zipBytes: 73027075, appBytes: 122600000, lessons: 100,
      site: 'https://www.goethe-verlag.com/book2/UK/UKNO/UKNO002.HTM', note: 'Те же 100 уроков: українською та норвезькою.' },
  ];

  /* ---------------- what is in the app (metadata in localStorage, the files in Cache Storage) ---------------- */
  // META: { [cid]: { files: { [file]: { n, bytes, sec } }, from, addedAt, custom?: { title, code, lang, flag } } }
  const meta = () => ls(META_KEY, {});
  const setMeta = m => lsSet(META_KEY, m);
  const prefs = () => Object.assign({ repeat: false }, ls(PREF_KEY, {}));
  const setPref = o => lsSet(PREF_KEY, Object.assign(prefs(), o));
  const positions = () => ls(POS_KEY, {});
  const cacheKey = (cid, f) => new URL(`__nk_audio/course/${enc(cid)}/${enc(f)}`, location.href).href;
  const keyPrefix = cid => new URL(`__nk_audio/course/${enc(cid)}/`, location.href).href;
  const fromKey = u => { const m = String(u || '').match(/\/__nk_audio\/course\/([^/]+)\/([^/?#]+)/); return m ? { cid: decodeURIComponent(m[1]), file: decodeURIComponent(m[2]) } : null; };

  function course(cid) {
    const k = COURSES.find(c => c.id === cid);
    if (k) return k;
    const m = meta()[cid];
    if (!m || !m.custom) return null;
    return Object.assign({ id: cid, flag: '🎧', lang: '', short: m.custom.title, lessons: 0, appBytes: 0 }, m.custom);
  }
  function courses() {
    const m = meta();
    return COURSES.concat(Object.keys(m).filter(id => !COURSES.some(c => c.id === id) && m[id].custom).map(course).filter(Boolean));
  }
  const filesOf = cid => ((meta()[cid] || {}).files || {});
  /** the stored lessons, in order: [{ file, n, bytes, sec }] */
  function stored(cid) {
    return Object.entries(filesOf(cid)).map(([file, v]) => Object.assign({ file }, v)).sort((a, b) => (a.n || 0) - (b.n || 0) || a.file.localeCompare(b.file));
  }
  const bytesOf = cid => stored(cid).reduce((s, x) => s + (x.bytes || 0), 0);
  /** 'none' | 'loading' | 'partial' | 'done' */
  function statusOf(cid) {
    if (DL.has(cid)) return 'loading';
    const c = course(cid), n = stored(cid).length;
    if (!n) return 'none';
    return c && c.lessons && n < c.lessons ? 'partial' : 'done';
  }
  function lessonNo(file) { const m = String(file).match(/(\d{1,4})\.[a-z0-9]+$/i); return m ? +m[1] : 0; }
  function lessonTitle(c, n, file) {
    const code = (c && c.code) || '';
    const t = /^[A-Z]{2}NO$/.test(code) && n >= 1 && n <= 100 ? T[n - 1] : null;
    if (t) {
      const loc = code.startsWith('UK') ? t[1] : code.startsWith('RU') ? t[0] : '';
      return { head: `Урок ${n}`, src: loc, no: t[2] };
    }
    return { head: n ? `Урок ${n}` : '', src: String(file || '').replace(/\.[^.]+$/, '').replace(/[._]+/g, ' '), no: '' };
  }
  const lessonLine = (c, n, file) => { const t = lessonTitle(c, n, file); return [t.head, [t.src, t.no].filter(Boolean).join(' — ')].filter(Boolean).join(' · '); };

  async function cachePut(cid, file, blob) {
    if (!window.caches) throw friendly('Этот браузер не умеет хранить файлы внутри приложения. Откройте приложение в Safari или Chrome (не в приватном окне).');
    const c = await caches.open(STORE);
    try { await c.put(cacheKey(cid, file), new Response(blob, { headers: { 'content-type': blob.type || MIME(file), 'x-size': String(blob.size) } })); }
    catch (e) { throw friendly(e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || '')) ? 'На устройстве закончилось место — уже загруженные уроки сохранены. Освободите место и нажмите «Догрузить».' : 'Браузер не дал сохранить урок — возможно, это приватное окно.'); }
  }
  async function cacheBlob(cid, file) {
    if (!window.caches) return null;
    try { const c = await caches.open(STORE); const r = await c.match(cacheKey(cid, file)); return r ? await r.blob() : null; } catch (e) { return null; }
  }
  function remember(cid, file, info, extra) {
    const m = meta();
    const e = m[cid] = m[cid] || { files: {}, addedAt: Date.now() };
    e.files = e.files || {};
    e.files[file] = info;
    if (extra) Object.assign(e, extra);
    if (!setMeta(m)) throw friendly('Браузер не дал сохранить список уроков — возможно, это приватное окно.');
  }
  /** the browser may have cleared its cache (iPhone, low space): the list follows what is really there */
  async function reconcile(cid) {
    if (!window.caches) return;
    try {
      const c = await caches.open(STORE);
      const pre = keyPrefix(cid);
      const have = new Set((await c.keys()).map(r => r.url).filter(u => u.startsWith(pre)).map(u => decodeURIComponent(u.slice(pre.length))));
      const m = meta(); const e = m[cid]; if (!e || !e.files) return;
      let gone = 0;
      Object.keys(e.files).forEach(f => { if (!have.has(f)) { delete e.files[f]; gone++; } });
      if (gone) { setMeta(m); emit(); }
    } catch (err) { /* ignore */ }
  }
  async function removeCourse(cid) {
    if (window.Listen && Listen.p && (Listen.p.o.mediaKey || '') === 'ac:' + cid) Listen.stop();
    if (cast && cast.cid === cid) await castStop(true);
    try {
      const c = await caches.open(STORE); const pre = keyPrefix(cid);
      await Promise.all((await c.keys()).filter(r => r.url.startsWith(pre)).map(r => c.delete(r)));
    } catch (e) { /* gone already */ }
    const m = meta(); delete m[cid]; setMeta(m);
    const p = positions(); delete p[cid]; lsSet(POS_KEY, p);
    emit();
  }

  /* ---------------- MP3 length (CBR / Xing / Info header) ---------------- */
  function mp3Sec(u8, size) {
    try {
      let i = 0;
      if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) i = 10 + ((u8[6] & 127) << 21 | (u8[7] & 127) << 14 | (u8[8] & 127) << 7 | (u8[9] & 127));
      const lim = Math.min(u8.length - 4, i + 65536);
      while (i < lim && !(u8[i] === 0xFF && (u8[i + 1] & 0xE0) === 0xE0)) i++;
      if (i >= lim) return 0;
      const b1 = u8[i + 1], b2 = u8[i + 2], b3 = u8[i + 3];
      const ver = (b1 >> 3) & 3, layer = (b1 >> 1) & 3;
      if (layer !== 1) return 0;
      const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] }[ver];
      const si = (b2 >> 2) & 3; if (!SR || si === 3) return 0;
      const sr = SR[si];
      const br = (ver === 3 ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320] : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160])[b2 >> 4] * 1000;
      const mono = (b3 >> 6) === 3;
      const x = i + 4 + (ver === 3 ? (mono ? 17 : 32) : (mono ? 9 : 17));
      const tag = String.fromCharCode(u8[x], u8[x + 1], u8[x + 2], u8[x + 3]);
      if ((tag === 'Xing' || tag === 'Info') && (u8[x + 7] & 1)) {
        const frames = ((u8[x + 8] << 24) | (u8[x + 9] << 16) | (u8[x + 10] << 8) | u8[x + 11]) >>> 0;
        if (frames) return Math.round(frames * (ver === 3 ? 1152 : 576) / sr);
      }
      return br ? Math.round((size - i) * 8 / br) : 0;
    } catch (e) { return 0; }
  }
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  const canInflate = (() => { try { if (typeof DecompressionStream === 'undefined') return false; new DecompressionStream('deflate-raw'); return true; } catch (e) { return false; } })();
  async function inflateRaw(u8) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); }

  /** store one lesson (bytes) → its info */
  async function storeLesson(cid, file, u8, from, extra) {
    const blob = new Blob([u8], { type: MIME(file) });
    await cachePut(cid, file, blob);
    const info = { n: lessonNo(file), bytes: blob.size, sec: /\.mp3$/i.test(file) ? mp3Sec(u8.subarray ? u8.subarray(0, 8192) : u8, blob.size) : 0 };
    remember(cid, file, info, Object.assign({ from }, extra || {}));
    return info;
  }

  /* ---------------- ⬇ download into the app ---------------- */
  const DL = new Map(); // cid -> { phase, done, total, got, totalBytes, ctrl, err }
  const emit = () => document.dispatchEvent(new CustomEvent('ac-state'));
  const noCors = new Set();
  /** GET a remote file (optionally a byte range): directly when the site allows it, otherwise through the Mac bridge */
  async function remote(url, range, signal) {
    const host = new URL(url).host;
    if (!noCors.has(host)) {
      try { const r = await fetch(url, { headers: range ? { Range: range } : {}, signal, mode: 'cors', credentials: 'omit' }); if (r.ok) return r; } catch (e) { if (e && e.name === 'AbortError') throw e; }
      noCors.add(host);
    }
    if (!bridgeUp() && window.AI && AI.detectBridge && /^https?:$/.test(location.protocol)) { try { await AI.detectBridge(); } catch (e) { /* ignore */ } }
    if (!bridgeUp()) throw friendly(needBridge(), { needBridge: true });
    let r;
    try {
      r = await fetch('/api/proxy', { method: 'POST', headers: { 'content-type': 'application/json' }, signal,
        body: JSON.stringify({ url, method: 'GET', headers: range ? { Range: range } : {} }) });
    } catch (e) { if (e && e.name === 'AbortError') throw e; throw friendly('Мост на Mac не отвечает — проверьте, что он запущен, и нажмите «Догрузить».'); }
    if (r.status === 400 || r.status === 404) { const j = await r.json().catch(() => ({})); if (/не разрешён|not found/.test(j.error || '')) throw friendly(RESTART, { restart: true }); }
    if (!r.ok) throw friendly(r.status >= 500 ? 'Сайт 50languages сейчас не отвечает — попробуйте чуть позже, загрузка продолжится с того же места.' : 'Сайт не отдал файл — попробуйте позже.');
    return r;
  }
  const u32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
  const u16 = (b, i) => b[i] | (b[i + 1] << 8);
  function parseCD(cd) {
    const out = []; let p = 0;
    const dec = new TextDecoder();
    while (p + 46 <= cd.length && u32(cd, p) === 0x02014b50) {
      const fl = u16(cd, p + 28), el = u16(cd, p + 30), cl = u16(cd, p + 32);
      const name = dec.decode(cd.subarray(p + 46, p + 46 + fl));
      out.push({ name, method: u16(cd, p + 10), crc: u32(cd, p + 16), csize: u32(cd, p + 20), usize: u32(cd, p + 24), off: u32(cd, p + 42) });
      p += 46 + fl + el + cl;
    }
    return out;
  }
  const baseName = n => String(n).split('/').pop();

  async function download(cid) {
    const c = course(cid); if (!c || !c.zip || DL.has(cid)) return;
    const d = { phase: 'list', done: 0, total: 0, got: 0, totalBytes: 0, ctrl: new AbortController() };
    DL.set(cid, d); emit();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(() => emit()).catch(() => {}); } catch (e) { /* ignore */ }
    try {
      const have = filesOf(cid);
      const left = Math.max(0, (c.appBytes || 0) - bytesOf(cid));
      const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate().catch(() => null) : null;
      if (est && est.quota && left && est.quota - est.usage < left * 1.05 + 10e6) {
        throw friendly(`Не хватает места на устройстве: курсу нужно ещё ~${mb(left)}, свободно ~${mb(Math.max(0, est.quota - est.usage))}.`);
      }
      if (canInflate) await downloadByLessons(c, d, have);
      else await downloadWhole(c, d);
      if (stored(cid).length >= (c.lessons || 0)) UI.toast(`🎧 «${c.short}» — в приложении. Можно слушать без интернета.`, 'good', 5000);
    } catch (e) {
      if (e && e.name === 'AbortError') { UI.toast('Загрузка остановлена — загруженные уроки сохранены, можно продолжить позже', '', 4500); return; }
      d.err = e && e.friendly ? e.message : 'Загрузка прервалась — уже загруженные уроки сохранены. Нажмите «Догрузить», чтобы продолжить.';
      UI.toast(d.err, 'warn', 9000);
      lastErr[cid] = d.err;
    } finally { DL.delete(cid); emit(); }
  }
  const lastErr = {};
  /** lesson by lesson: the table of contents (end of the zip), then each lesson's bytes (Range) — resumable */
  async function downloadByLessons(c, d, have) {
    const sig = d.ctrl.signal;
    const tr = await remote(c.zip, 'bytes=-65536', sig);
    const tail = new Uint8Array(await tr.arrayBuffer());
    if (tr.status !== 206) {
      // the server sent the whole archive instead of its end
      if (tail.length > 1e6) return unzipStore(c.id, new Blob([tail]), d, 'download');
      throw friendly('Сайт не отдал архив — попробуйте позже.');
    }
    let e = -1;
    for (let i = tail.length - 22; i >= 0; i--) if (u32(tail, i) === 0x06054b50) { e = i; break; }
    if (e < 0) throw friendly('Архив на сайте повреждён или изменился — попробуйте позже или скачайте файл вручную.');
    const cdSize = u32(tail, e + 12), cdOff = u32(tail, e + 16);
    const tailStart = cdOff + cdSize - e;
    let cd;
    if (cdOff >= tailStart) cd = tail.subarray(cdOff - tailStart, cdOff - tailStart + cdSize);
    else cd = new Uint8Array(await (await remote(c.zip, `bytes=${cdOff}-${cdOff + cdSize - 1}`, sig)).arrayBuffer());
    const all = parseCD(cd).sort((a, b) => a.off - b.off);
    all.forEach((x, i) => { x.end = i + 1 < all.length ? all[i + 1].off : cdOff; });
    const want = all.filter(x => AUDIO_RE.test(x.name) && !x.name.endsWith('/') && !have[baseName(x.name)]);
    d.phase = 'files'; d.total = want.length; d.totalBytes = want.reduce((s, x) => s + x.csize, 0); d.before = Object.keys(have).length; emit();
    let next = 0;
    const one = async x => {
      for (let attempt = 0; ; attempt++) {
        try {
          const r = await remote(c.zip, `bytes=${x.off}-${x.end - 1}`, sig);
          const b = new Uint8Array(await r.arrayBuffer());
          if (r.status !== 206 || u32(b, 0) !== 0x04034b50) throw friendly('Сайт отдал урок не целиком — попробуйте ещё раз.');
          const start = 30 + u16(b, 26) + u16(b, 28);
          const raw = b.subarray(start, start + x.csize);
          if (raw.length < x.csize) throw friendly('Урок пришёл не целиком — попробуйте ещё раз.');
          const data = x.method === 0 ? raw : x.method === 8 ? await inflateRaw(raw) : null;
          if (!data || data.length !== x.usize || crc32(data) !== x.crc) throw friendly('Урок пришёл с ошибкой — попробуйте ещё раз.');
          await storeLesson(c.id, baseName(x.name), data, 'download');
          return;
        } catch (err) {
          if ((err && err.name === 'AbortError') || attempt >= 2 || (err && (err.needBridge || err.restart || /место|приватное/.test(err.message || '')))) throw err;
          await new Promise(res => setTimeout(res, 1200 * (attempt + 1)));
        }
      }
    };
    const worker = async () => {
      while (next < want.length) {
        if (sig.aborted) throw new DOMException('stop', 'AbortError');
        const x = want[next++];
        await one(x);
        d.done++; d.got += x.csize; emit();
      }
    };
    // one lesson failing for good stops the others too (what is stored stays — «Догрузить» goes on from there)
    await Promise.all([worker(), worker(), worker()].map(w => w.catch(err => { if (!sig.aborted) d.ctrl.abort(); throw err; })));
  }
  /** the whole archive at once (old browsers without DecompressionStream; or a server without Range) */
  async function downloadWhole(c, d) {
    d.phase = 'zip'; d.totalBytes = c.zipBytes; emit();
    const r = await remote(c.zip, '', d.ctrl.signal);
    const total = +r.headers.get('Content-Length') || c.zipBytes;
    d.totalBytes = total;
    const parts = [];
    if (r.body && r.body.getReader) {
      const rd = r.body.getReader(); let last = 0;
      for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); d.got += value.length; if (Date.now() - last > 250) { last = Date.now(); emit(); } }
    } else parts.push(new Uint8Array(await r.arrayBuffer()));
    const blob = new Blob(parts, { type: 'application/zip' });
    if (blob.size < total * 0.98) throw friendly('Архив пришёл не целиком — нажмите «Догрузить», чтобы попробовать снова.');
    await unzipStore(c.id, blob, d, 'download');
  }
  /** a zip (Blob / File) → its audio files into the course; d: the progress record (optional) */
  async function unzipStore(cid, blob, d, from, extra) {
    const JSZip = await U.lib.jszip().catch(() => null);
    if (!JSZip) throw friendly('Нужен интернет, чтобы распаковать архив в первый раз — подключитесь и попробуйте снова.');
    let zip;
    try { zip = await JSZip.loadAsync(blob); } catch (e) { throw friendly('Этот архив не открывается — возможно, он скачан не до конца.'); }
    const have = filesOf(cid);
    const list = Object.values(zip.files).filter(f => !f.dir && AUDIO_RE.test(f.name) && !/__MACOSX\//.test(f.name) && !have[baseName(f.name)]);
    if (d) { d.phase = 'unzip'; d.total = list.length; d.done = 0; emit(); }
    let n = 0;
    for (const f of list) {
      if (d && d.ctrl.signal.aborted) throw new DOMException('stop', 'AbortError');
      await storeLesson(cid, baseName(f.name), await f.async('uint8array'), from, extra);
      n++; if (d) { d.done = n; emit(); }
    }
    return n;
  }
  async function stopDownload(cid) {
    const d = DL.get(cid); if (!d) return true;
    const r = await UI.askClose({ title: 'Остановить загрузку?', line: 'Уже загруженные уроки останутся в приложении — потом можно догрузить остальные.',
      actions: [{ label: 'Остановить', value: 'stop', cls: 'bad' }], cancel: 'Продолжить загрузку' });
    if (r !== 'stop') return false;
    d.ctrl.abort();
    return true;
  }

  /* ---------------- 📂 «У меня уже скачано»: a folder, MP3 files or the zip ---------------- */
  /** which course a file belongs to: RUNO001.mp3 → runo; ENNO001.mp3 → a new 50languages course; else «Мои MP3» */
  function detect(name, folder) {
    const m = baseName(name).match(/^([A-Z]{4})(\d{3})\.mp3$/i);
    if (m) {
      const code = m[1].toUpperCase();
      const k = COURSES.find(c => c.code === code);
      if (k) return { cid: k.id };
      return { cid: code.toLowerCase(), custom: { title: `50languages — ${code.slice(0, 2)}–${code.slice(2)}`, code, lang: '', flag: '🎧', source: '50languages / Goethe Verlag' } };
    }
    const f = String(folder || '').trim() || 'Мои MP3';
    const slug = 'my-' + (f.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'mp3');
    return { cid: slug, custom: { title: f, code: '', lang: '', flag: '🎧', source: 'ваши файлы' } };
  }
  /** everything dropped: folders are walked (webkitGetAsEntry) */
  async function filesFromDrop(dt) {
    const out = [];
    // read everything now: the browser empties dataTransfer after the event
    const plain = [...(dt.files || [])];
    const items = [...(dt.items || [])].map(it => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null));
    if (!items.some(Boolean)) return plain;
    const walk = async (entry, path) => {
      if (!entry) return;
      if (entry.isFile) { const f = await new Promise((res, rej) => entry.file(res, rej)).catch(() => null); if (f) { try { Object.defineProperty(f, 'acPath', { value: path + f.name }); } catch (e) { /* ignore */ } out.push(f); } return; }
      if (entry.isDirectory) {
        const rd = entry.createReader();
        for (;;) { const batch = await new Promise(res => rd.readEntries(res, () => res([]))); if (!batch.length) break; for (const x of batch) await walk(x, path + entry.name + '/'); }
      }
    };
    for (const e of items) await walk(e, '');
    return out.length ? out : plain; // (a WebView that gives entries it cannot read)
  }
  async function importFiles(files, onProgress) {
    files = [...(files || [])];
    const zips = files.filter(f => /\.zip$/i.test(f.name));
    const audio = files.filter(f => AUDIO_RE.test(f.name));
    if (!zips.length && !audio.length) { UI.toast('Здесь нет MP3 и архивов .zip — выберите папку с уроками (например, RUNO-all) или сам архив', 'warn', 6000); return { added: 0, courses: [] }; }
    let added = 0, skipped = 0, done = 0; const cids = new Set();
    const total = audio.length + zips.length;
    const tick = () => { if (onProgress) onProgress(done, total); };
    for (const z of zips) {
      // a zip: its audio go to the course of their names (RUNO-all.zip → RU–NO)
      const JSZip = await U.lib.jszip().catch(() => null);
      if (!JSZip) throw friendly('Нужен интернет, чтобы распаковать архив в первый раз — подключитесь и попробуйте снова.');
      let zip;
      try { zip = await JSZip.loadAsync(z); } catch (e) { throw friendly(`Архив «${z.name}» не открывается — возможно, он скачан не до конца.`); }
      const list = Object.values(zip.files).filter(f => !f.dir && AUDIO_RE.test(f.name) && !/__MACOSX\//.test(f.name));
      for (const f of list) {
        const det = detect(f.name, z.name.replace(/\.zip$/i, ''));
        cids.add(det.cid);
        if (filesOf(det.cid)[baseName(f.name)]) { skipped++; continue; }
        await storeLesson(det.cid, baseName(f.name), await f.async('uint8array'), 'import', det.custom ? { custom: det.custom } : null);
        added++;
      }
      done++; tick();
    }
    for (const f of audio) {
      const path = f.acPath || f.webkitRelativePath || '';
      const folder = path.includes('/') ? path.split('/').slice(-2, -1)[0] : '';
      const det = detect(f.name, folder);
      cids.add(det.cid);
      const ex = filesOf(det.cid)[f.name];
      if (ex && ex.bytes === f.size) { skipped++; done++; tick(); continue; }
      await storeLesson(det.cid, f.name, new Uint8Array(await f.arrayBuffer()), 'import', det.custom ? { custom: det.custom } : null);
      added++; done++; tick();
    }
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* ignore */ }
    emit();
    const names = [...cids].map(id => (course(id) || {}).short).filter(Boolean);
    UI.toast(added ? `🎧 Добавлено ${added} ${U.plural(added, ['урок', 'урока', 'уроков'])}${names.length ? ` — ${names.join(', ')}` : ''}${skipped ? ` (${skipped} уже были)` : ''}` : `Все эти уроки уже есть в приложении (${skipped})`, added ? 'good' : '', 5000);
    return { added, skipped, courses: [...cids] };
  }

  /* ---------------- ▶ playing (the app's listening player) ---------------- */
  const blobUrls = new Map(); // cache key → blob: URL (the last few)
  let missToast = 0;
  async function resolveUrl(c) {
    const k = c && c.media; const f = fromKey(k);
    if (!f) return k;
    if (blobUrls.has(k)) return blobUrls.get(k);
    const b = await cacheBlob(f.cid, f.file);
    if (!b) {
      if (Date.now() - missToast > 8000) { missToast = Date.now(); UI.toast('Этого урока больше нет в приложении (браузер освободил место) — откройте «🎧 Аудиокурсы» и нажмите «Догрузить»', 'warn', 8000); }
      reconcile(f.cid);
      throw new Error('missing');
    }
    const u = URL.createObjectURL(b);
    blobUrls.set(k, u);
    const playing = window.Listen && Listen.p && Listen.p.audio ? Listen.p.audio.src : '';
    for (const [ok, ou] of [...blobUrls]) {
      if (blobUrls.size <= 6) break;
      if (ou === playing || ok === k) continue; // never the lesson that plays now
      blobUrls.delete(ok); setTimeout(() => URL.revokeObjectURL(ou), 30000);
    }
    return u;
  }
  const ours = p => !!(p && p.o && /^ac:/.test(p.o.mediaKey || ''));
  const curOf = p => { if (!ours(p)) return null; const c = p.cards[p.i]; const f = c && fromKey(c.media); return f ? Object.assign(f, { i: p.i, n: lessonNo(f.file) }) : null; };
  const ab = { cid: '', file: '', a: null, b: null };
  function savePlace(p, now) {
    const cur = curOf(p); if (!cur) return;
    const a = p.audio, sec = Math.floor(a.currentTime || 0), dur = isFinite(a.duration) ? a.duration : 0;
    const all = positions();
    const e = all[cur.cid] = Object.assign(all[cur.cid] || {}, { file: cur.file, sec, t: Date.now() });
    e.heard = e.heard || {};
    if (dur && sec >= dur * 0.9) e.heard[cur.file] = 1;
    lsSet(POS_KEY, all);
    if (window.Resume && Resume.save) { try { Resume.save('audiocourse', `${cur.cid}/${cur.file}`, sec, { unit: 'time', total: dur, title: `${(course(cur.cid) || {}).short || ''} · ${lessonLine(course(cur.cid), cur.n, cur.file)}` }); } catch (err) { /* ignore */ } }
    if (dur && !filesOf(cur.cid)[cur.file]?.sec) { const m = meta(); const x = m[cur.cid] && m[cur.cid].files[cur.file]; if (x) { x.sec = Math.round(dur); setMeta(m); } }
    if (now) emit();
  }
  /** our extras on the player's <audio>: AirPlay, repeat a lesson, A–B, the place */
  function hook(p) {
    if (!p || p.__ac) return; p.__ac = true;
    const a = p.audio;
    try { a.setAttribute('x-webkit-airplay', 'allow'); } catch (e) { /* ignore */ }
    let last = 0;
    const apply = () => { if (Listen.p === p && ours(p)) { const want = !!prefs().repeat; if (a.loop !== want && p.cur && p.cur.media) a.loop = want; } };
    a.addEventListener('playing', apply);
    a.addEventListener('loadedmetadata', apply);
    a.addEventListener('timeupdate', () => {
      if (Listen.p !== p || !ours(p)) return;
      const cur = curOf(p);
      if (cur && ab.a != null && ab.b != null && ab.cid === cur.cid && ab.file === cur.file && a.currentTime >= ab.b) { try { a.currentTime = ab.a; } catch (e) { /* ignore */ } }
      if (Date.now() - last > 3000) { last = Date.now(); savePlace(p); }
    });
    a.addEventListener('pause', () => { if (Listen.p === p) savePlace(p, true); });
    a.addEventListener('ended', () => { if (Listen.p === p) savePlace(p, true); });
  }
  /** the remembered second inside a lesson */
  function secFor(cid, file) {
    let s = 0;
    if (window.Resume && Resume.get) { try { const r = Resume.get('audiocourse', `${cid}/${file}`); if (r && r.pos) s = +r.pos; } catch (e) { /* ignore */ } }
    const p = positions()[cid];
    if (!s && p && p.file === file) s = +p.sec || 0;
    const x = filesOf(cid)[file];
    if (x && x.sec && s > x.sec - 5) s = 0;
    return s > 3 ? s : 0;
  }
  /** play course cid from lesson index idx of the stored list (null → where it was left) */
  function play(cid, idx, opts = {}) {
    if (window.Listen) Listen.prime(); // inside the tap (iPhone / Safari) — before anything is awaited
    const c = course(cid); const L = stored(cid);
    if (!c || !L.length) { UI.toast('В этом курсе пока нет уроков в приложении', 'warn'); return; }
    const now = curOf(window.Listen && Listen.p);
    if (idx == null && now && now.cid === cid && !cast) { if (!Listen.p.playing) Listen.resume(); return; } // already this course: go on
    if (idx == null) { const p = positions()[cid]; idx = p ? Math.max(0, L.findIndex(x => x.file === p.file)) : 0; }
    idx = Math.max(0, Math.min(L.length - 1, idx));
    if (cast) { castPlay(cid, idx, opts.fromStart ? 0 : secFor(cid, L[idx].file)); return; }
    const items = L.map(x => ({ id: `ac:${cid}:${x.file}`, no: lessonLine(c, x.n, x.file), ru: `${c.short}${x.sec ? ' · ' + mss(x.sec) : ''}`, media: cacheKey(cid, x.file), sec: x.sec || 0 }));
    const p = Listen.startMedia(c.short, items, { mediaKey: 'ac:' + cid, at: idx, loop: false });
    if (!p) return;
    const sec = opts.fromStart ? 0 : secFor(cid, L[idx].file);
    p.o._seek = sec ? { i: idx, t: sec } : null;
    hook(p);
    if (window.ListenUI && ListenUI.markUsed) ListenUI.markUsed();
    emit();
  }

  /* ---------------- 📺 TV / Google speaker (through the Mac bridge) ---------------- */
  let cast = null; // { id, name, cid, idx, state, time, poll, busy }
  async function castApi(action, body) {
    let r;
    try { r = await fetch('/api/cast/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); }
    catch (e) { throw friendly('Мост на Mac не отвечает — проверьте, что он запущен.'); }
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 && /not found|unknown/.test(j.error || '')) throw friendly(RESTART, { restart: true });
    if (!r.ok) throw Object.assign(friendly(j.error && !/[a-z]{4,}/i.test(j.error) ? j.error : 'Телевизор не ответил — проверьте, что он включён и в той же Wi-Fi сети.'), { install: !!j.install });
    return j;
  }
  async function castSend(cid, idx, start) {
    const L = stored(cid), x = L[idx]; if (!x) return;
    const b = await cacheBlob(cid, x.file);
    if (!b) throw friendly('Этого урока нет в приложении — нажмите «Догрузить».');
    let r;
    const bytes = await b.arrayBuffer(); // (a Blob body is not sent by every WebView)
    try { r = await fetch('/api/cast/upload', { method: 'POST', headers: { 'Content-Type': b.type && /^audio\//.test(b.type) ? b.type : 'audio/mpeg' }, body: bytes }); }
    catch (e) { throw friendly('Мост на Mac не отвечает — проверьте, что он запущен.'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.token) throw friendly(r.status === 413 || r.status === 415 ? 'Этот файл нельзя отправить на телевизор.' : RESTART, { restart: !(r.status === 413 || r.status === 415) });
    const c = course(cid);
    await castApi('play', { id: cast.id, kind: 'audio', url: 'nkaudio:' + j.token, title: `${lessonLine(c, x.n, x.file)} — ${c.short}`, start: start || 0 });
    Object.assign(cast, { cid, idx, file: x.file, state: 'PLAYING', time: start || 0, seen: false });
    const pos = positions(); pos[cid] = Object.assign(pos[cid] || {}, { file: x.file, sec: start || 0, t: Date.now() }); lsSet(POS_KEY, pos);
    emit();
  }
  async function castPlay(cid, idx, start) {
    if (!cast || cast.busy) return;
    cast.busy = true; emit();
    try { await castSend(cid, idx, start); } catch (e) { UI.toast(e.friendly ? e.message : 'Телевизор не ответил — попробуйте ещё раз', 'warn', 7000); }
    finally { if (cast) { cast.busy = false; emit(); } }
  }
  function castPoll() {
    clearInterval(cast && cast.poll);
    if (!cast) return;
    let fails = 0;
    cast.poll = setInterval(async () => {
      if (!cast || cast.busy) return;
      let s; try { s = await castApi('control', { id: cast.id, action: 'status' }); fails = 0; } catch (e) { if (++fails >= 5) { UI.toast('📺 Телевизор больше не отвечает — трансляция остановлена', 'warn', 6000); castStop(true); } return; }
      if (!cast) return;
      cast.time = s.time || 0;
      if (s.state === 'PLAYING' || s.state === 'BUFFERING') cast.seen = true;
      const was = cast.state; cast.state = s.state || '';
      // the lesson ended on the TV → the same one again (🔂) or the next one
      if (cast.seen && (s.state === 'IDLE' || !s.state) && was !== 'IDLE') {
        const L = stored(cast.cid);
        const pos = positions(); const e = pos[cast.cid] = pos[cast.cid] || {}; e.heard = e.heard || {}; e.heard[cast.file] = 1; lsSet(POS_KEY, pos);
        if (prefs().repeat) castPlay(cast.cid, cast.idx, 0);
        else if (cast.idx + 1 < L.length) castPlay(cast.cid, cast.idx + 1, 0);
        else UI.toast('📺 Все уроки прослушаны', 'good');
      }
      emit();
    }, 2500);
  }
  async function castControl(action, value) {
    if (!cast) return;
    try {
      if (action === 'seekBy') { const t = Math.max(0, (cast.time || 0) + value); await castApi('control', { id: cast.id, action: 'seek', value: t }); cast.time = t; }
      else if (action === 'toggle') { const pl = cast.state === 'PLAYING' || cast.state === 'BUFFERING'; await castApi('control', { id: cast.id, action: pl ? 'pause' : 'play' }); cast.state = pl ? 'PAUSED' : 'PLAYING'; }
      else if (action === 'rate') await castApi('control', { id: cast.id, action: 'rate', value });
      emit();
    } catch (e) { UI.toast(e.friendly ? e.message : 'Телевизор не ответил', 'warn'); }
  }
  async function castStop(quiet) {
    if (!cast) return true;
    if (!quiet) {
      const r = await UI.askClose({ title: 'Остановить на телевизоре?', line: 'Место в уроке запомнится — потом можно продолжить здесь или снова на телевизоре.', actions: [{ label: 'Остановить', value: 'stop', cls: 'bad' }], cancel: 'Пусть играет' });
      if (r !== 'stop') return false;
    }
    const c = cast; cast = null; clearInterval(c.poll);
    if (c.cid) { const pos = positions(); pos[c.cid] = Object.assign(pos[c.cid] || {}, { file: c.file, sec: Math.floor(c.time || 0), t: Date.now() }); lsSet(POS_KEY, pos); }
    try { await castApi('control', { id: c.id, action: 'stop' }); } catch (e) { /* the TV is off anyway */ }
    emit();
    return true;
  }
  /** 📺 without the Mac bridge (the public site, or the bridge is off): the lessons live on this device (Cache Storage),
   *  a TV cannot fetch them by itself — so the ways that send the SOUND of this device: AirPlay, Bluetooth, mirroring */
  function castNoBridge(cid) {
    const ua = navigator.userAgent;
    const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const mac = /Macintosh/.test(ua) && !iOS, android = /Android/.test(ua);
    const chrome = /Chrome|Edg/.test(ua) && !/OPR|SamsungBrowser|CriOS/.test(ua);
    const airplay = !!(window.HTMLMediaElement && 'webkitShowPlaybackTargetPicker' in HTMLMediaElement.prototype);
    const way = (ic, h, t, btn = '') => `<div class="ac-way"><span class="ac-way-ic" aria-hidden="true">${ic}</span><div class="ac-way-t"><b>${h}</b><small>${t}</small>${btn}</div></div>`;
    const ways = [];
    if (airplay) ways.push(way('◎', 'AirPlay — Apple TV, телевизор или колонка с AirPlay', 'Включите урок и нажмите кнопку — появится список устройств.', '<button type="button" class="btn primary" data-acn-airplay>◎ Выбрать AirPlay</button>'));
    ways.push(way('🔈', 'Колонка Bluetooth или наушники', 'Подключите их в настройках Bluetooth этого устройства — урок зазвучит там.', '<button type="button" class="btn" data-lx="where">🔈 Где слушать</button>'));
    if (iOS) ways.push(way('📱', 'Повтор экрана на телевизор', 'Пункт управления (смахните вниз от правого верхнего угла) → <b>Повтор экрана</b> → телевизор с AirPlay. Звук урока пойдёт на телевизор.'));
    if (mac) ways.push(way('🍎', 'Mac → телевизор или колонка с AirPlay', 'Пункт управления в строке меню → <b>Звук</b> (или <b>Повтор экрана</b>) → выберите телевизор или колонку.'));
    if (android) ways.push(way('🤖', 'Трансляция экрана на телевизор', 'Быстрые настройки (смахните сверху вниз) → <b>Трансляция экрана</b> (или «Smart View» на Samsung) → выберите телевизор. Звук урока пойдёт тоже.'));
    if (chrome && !android) ways.push(way('🖥', 'Chrome → телевизор с Chromecast', 'Меню Chrome <b>⋮</b> → <b>Трансляция, сохранение и отправка</b> → <b>Трансляция…</b> → источник <b>«Транслировать вкладку»</b> → телевизор. Звук этой вкладки пойдёт на телевизор.'));
    if (!iOS && !android) ways.push(way('🔌', 'Кабель HDMI', 'Компьютер, подключённый к телевизору кабелем, сразу играет звук через телевизор.'));
    const m = UI.modal({ title: `${TV(22)} На телевизор или колонку`, cls: 'ac-cast-modal',
      body: `<p class="ac-msg">Уроки хранятся <b>прямо на этом устройстве</b>, поэтому телевизор сам их открыть не может. Но слушать на телевизоре или колонке можно — звук пойдёт отсюда:</p>
        <div class="ac-ways">${ways.join('')}</div>` });
    m.el.addEventListener('click', e => {
      if (e.target.closest('[data-lx]')) { m.close(); return; } // «Где слушать» opens its own window (js/listenx.js)
      if (!e.target.closest('[data-acn-airplay]')) return;
      const p = window.Listen && Listen.p, a = p && ours(p) ? p.audio : null;
      if (!a) { m.close(); play(cid); setTimeout(() => UI.toast('Урок играет — теперь нажмите «◎ AirPlay» и выберите устройство', '', 5000), 300); return; }
      try { a.setAttribute('x-webkit-airplay', 'allow'); a.webkitShowPlaybackTargetPicker(); m.close(); } catch (err) { UI.toast('AirPlay сейчас недоступен — выберите устройство в Пункте управления', 'warn', 5000); }
    });
  }
  /** 📺 the list of TVs and Google speakers; picking one plays the current / chosen lesson there */
  function castPick(cid) {
    if (!bridgeUp()) { castNoBridge(cid); return; }
    const m = UI.modal({ title: `${TV(22)} На телевизор или колонку`, cls: 'ac-cast-modal',
      body: `<p class="small muted">Телевизор с Chromecast, Android TV / Google TV или колонка Google Home — в той же Wi-Fi сети, что и этот Mac. Урок передаётся с Mac, поэтому мост должен быть запущен.</p><div data-acc></div>` });
    const box = m.$('[data-acc]');
    const load = async () => {
      if (!bridgeUp()) { m.close(); castNoBridge(cid); return; } // the bridge went away meanwhile
      box.innerHTML = '<div class="ac-msg"><span class="spinner sm"></span> Ищу телевизоры и колонки в вашей сети…</div>';
      try {
        const list = (await castApi('devices', { timeout: 7, audio: true })).devices || [];
        box.innerHTML = list.length
          ? `<div class="ac-devs">${list.map(d => `<button type="button" class="ac-dev" data-dev="${esc(d.id)}" data-name="${esc(d.name)}" title="Слушать на «${esc(d.name)}»"><span class="ac-dev-ic" aria-hidden="true">${d.speaker || d.group ? '🔊' : '📺'}</span><span class="ac-dev-t"><b>${esc(d.name)}</b>${d.model ? `<small>${esc(d.model)}</small>` : ''}</span><span class="ac-dev-go" aria-hidden="true">›</span></button>`).join('')}</div>
             <button type="button" class="btn sm ghost" data-rescan title="Поискать ещё раз">🔄 Искать снова</button>`
          : `<div class="ac-msg">Ничего не найдено. Телевизор или колонка должны быть <b>включены</b> и в <b>той же Wi-Fi сети</b>, что и этот Mac.</div><button type="button" class="btn sm" data-rescan title="Поискать ещё раз">🔄 Искать снова</button>`;
      } catch (e) {
        if (e.install) box.innerHTML = `<div class="ac-msg">Чтобы отправлять звук на телевизор, приложению нужен <b>модуль трансляции</b> — он ставится <b>один раз</b>, около минуты.</div><button type="button" class="btn primary" data-install title="Установить модуль трансляции на этот Mac">⬇ Установить модуль трансляции</button>`;
        else box.innerHTML = `<div class="ac-msg">⚠️ ${esc(e.friendly ? e.message : 'Не получилось найти телевизоры — попробуйте ещё раз.')}</div><button type="button" class="btn sm" data-rescan title="Поискать ещё раз">🔄 Попробовать снова</button>`;
      }
    };
    box.addEventListener('click', async e => {
      if (e.target.closest('[data-rescan]')) { load(); return; }
      const ins = e.target.closest('[data-install]');
      if (ins) { ins.disabled = true; ins.innerHTML = '<span class="spinner sm"></span> Устанавливаю… (около минуты)'; try { await castApi('install'); load(); } catch (err) { ins.disabled = false; ins.textContent = '⬇ Установить модуль трансляции'; UI.toast('Не получилось установить модуль — попробуйте ещё раз позже', 'warn', 7000); } return; }
      const d = e.target.closest('[data-dev]'); if (!d) return;
      box.querySelectorAll('[data-dev]').forEach(b => { b.disabled = true; });
      d.querySelector('.ac-dev-go').innerHTML = '<span class="spinner sm"></span>';
      const L = stored(cid);
      const p = window.Listen && Listen.p; const cur = curOf(p);
      let idx = cur && cur.cid === cid ? L.findIndex(x => x.file === cur.file) : -1;
      let start = cur && cur.cid === cid ? Math.floor(p.audio.currentTime || 0) : 0;
      if (idx < 0) { const ps = positions()[cid]; idx = ps ? Math.max(0, L.findIndex(x => x.file === ps.file)) : 0; start = secFor(cid, L[idx].file); }
      const prev = cast;
      cast = { id: d.dataset.dev, name: d.dataset.name, cid, idx, state: '', time: start, busy: true };
      try {
        if (prev) clearInterval(prev.poll);
        await castSend(cid, idx, start);
        cast.busy = false;
        if (cur && cur.cid === cid) Listen.stop();
        castPoll();
        m.close();
        UI.toast(`📺 Играет на «${d.dataset.name}»`, 'good', 4000);
        emit();
      } catch (err) {
        cast = prev;
        box.querySelectorAll('[data-dev]').forEach(b => { b.disabled = false; });
        d.querySelector('.ac-dev-go').textContent = '›';
        UI.toast(err.friendly ? err.message : `«${d.dataset.name}» сейчас не ответил — проверьте, что он включён, и нажмите ещё раз`, 'warn', 7000);
      }
    });
    load();
  }

  /* ---------------- the window ---------------- */
  let win = null; // { m, view: 'list' | cid }
  const pct = d => (d.phase === 'files' || d.phase === 'unzip') ? (d.total ? Math.floor(d.done * 100 / d.total) : 0) : d.totalBytes ? Math.floor(d.got * 100 / d.totalBytes) : 0;
  function statusHtml(cid) {
    const c = course(cid), s = statusOf(cid), n = stored(cid).length, d = DL.get(cid);
    if (s === 'loading') {
      const p = pct(d);
      const what = d.phase === 'list' ? 'подключаюсь к сайту…' : d.phase === 'zip' ? `архив: ${mb(d.got)} из ${mb(d.totalBytes)}` : d.phase === 'unzip' ? `распаковываю: ${d.done} из ${d.total}` : `уроков: ${(d.before || 0) + d.done} из ${(d.before || 0) + d.total}`;
      return `<div class="ac-st loading"><span class="ac-chip load">⬇ загружается ${p}%</span><small>${esc(what)}</small></div>
        <div class="ac-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-label="Загрузка курса"><i style="width:${p}%"></i></div>`;
    }
    if (s === 'done') return `<div class="ac-st"><span class="ac-chip ok">в приложении ✓</span><small>${n} ${U.plural(n, ['урок', 'урока', 'уроков'])} · ${mb(bytesOf(cid))} · играют без интернета</small></div>`;
    if (s === 'partial') return `<div class="ac-st"><span class="ac-chip part">частично: ${n} из ${c.lessons}</span><small>${mb(bytesOf(cid))} · можно слушать уже сейчас</small></div>${lastErr[cid] ? `<div class="ac-err small">${esc(lastErr[cid])}</div>` : ''}`;
    return `<div class="ac-st"><span class="ac-chip none">не загружен</span>${c.zip ? `<small>архив ${mb(c.zipBytes)} · в приложении займёт ≈ ${mb(c.appBytes)}</small>` : ''}</div>${lastErr[cid] ? `<div class="ac-err small">${esc(lastErr[cid])}</div>` : ''}`;
  }
  function actionsHtml(cid, big) {
    const c = course(cid), s = statusOf(cid), n = stored(cid).length;
    const pos = positions()[cid];
    const L = stored(cid);
    const k = pos ? L.findIndex(x => x.file === pos.file) : -1;
    const contLbl = k >= 0 && (k > 0 || pos.sec > 3) ? `▶ Продолжить: урок ${L[k].n || k + 1}${pos.sec > 3 ? ' · ' + mss(pos.sec) : ''}` : '▶ Слушать подряд';
    const b = [];
    if (s === 'loading') b.push(`<button type="button" class="btn sm ghost ac-stop" data-ac-stop="${esc(cid)}" title="Остановить загрузку (уже загруженное останется)">✕ Остановить</button>`);
    if (n) b.push(`<button type="button" class="btn ${big ? '' : 'sm'} primary listen-cta" data-ac-play="${esc(cid)}" title="Слушать уроки один за другим — в наушниках, через динамик, на колонке">${HP(big ? 18 : 16, true)} ${esc(contLbl.replace(/^▶ /, ''))}</button>`);
    if (c.zip && s === 'none') b.push(`<button type="button" class="btn ${big ? '' : 'sm'} primary" data-ac-dl="${esc(cid)}" title="Загрузить все уроки внутрь приложения (через мост на Mac)">⬇ Загрузить в приложение</button>`);
    if (c.zip && s === 'partial') b.push(`<button type="button" class="btn sm" data-ac-dl="${esc(cid)}" title="Загрузить недостающие уроки">⬇ Догрузить (ещё ${c.lessons - n})</button>`);
    if (s === 'none' || s === 'partial') b.push(`<button type="button" class="btn sm ghost" data-ac-import="${esc(cid)}" title="Добавить уже скачанную папку, MP3 или архив .zip">📂 У меня уже скачано</button>`);
    if (!big && s !== 'loading') b.push(`<button type="button" class="btn sm ghost" data-ac-view="${esc(cid)}" title="Все уроки курса">Уроки ›</button>`);
    if (big && n && s !== 'loading') b.push(`<button type="button" class="btn sm ghost ac-del" data-ac-del="${esc(cid)}" title="Удалить уроки этого курса из приложения">🗑 Удалить курс</button>`);
    return `<div class="ac-acts">${b.join('')}</div>`;
  }
  function cardHtml(c) {
    return `<article class="ac-card" data-ac-card="${esc(c.id)}">
      <div class="ac-card-h"><span class="ac-flag" aria-hidden="true">${esc(c.flag || '🎧')}</span><div class="ac-card-t"><b>${esc(c.title)}</b><small>${c.zip ? esc(LICENCE) : `Источник: ${esc(c.source || 'ваши файлы')}`}</small></div><span class="ac-mp3" aria-hidden="true">MP3</span></div>
      ${c.note ? `<p class="small muted ac-note">${esc(c.note)}</p>` : ''}
      <div data-ac-status="${esc(c.id)}">${statusHtml(c.id)}</div>
      <div data-ac-actions="${esc(c.id)}">${actionsHtml(c.id)}</div>
    </article>`;
  }
  async function spaceHtml() {
    const used = courses().reduce((s, c) => s + bytesOf(c.id), 0);
    let free = '', kept = '';
    try { const e = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; if (e && e.quota) free = ` · свободно для приложения ~${mb(Math.max(0, e.quota - e.usage))}`; } catch (e) { /* ignore */ }
    try { if (navigator.storage && navigator.storage.persisted && await navigator.storage.persisted()) kept = ' · 🔒 браузер не удалит их сам'; } catch (e) { /* ignore */ }
    return `💾 Аудиокурсы занимают ${used ? mb(used) : '0 МБ'}${free}${kept}`;
  }
  function listView() {
    return `<div class="ac-intro">${HP(28, true)}<span>Уроки хранятся <b>внутри приложения</b> и играют без интернета — в наушниках, через динамик телефона или Mac, на колонке Bluetooth, на телевизоре. Как обычный плеер: экран можно выключить.</span></div>
      <div class="ac-space small muted" data-ac-space>💾 …</div>
      <div class="ac-grid">${courses().map(cardHtml).join('')}</div>
      ${importHtml('')}
      <div class="tiny muted ac-foot">Названия уроков — из официального списка 50languages (goethe-verlag.com/book2). Мы не размещаем курс у себя: он загружается с сайта 50languages прямо в ваше приложение.</div>`;
  }
  function importHtml(cid) {
    const dirOk = 'webkitdirectory' in document.createElement('input') && !/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    return `<div class="ac-drop" data-ac-drop tabindex="0">
      <div class="ac-drop-ic" aria-hidden="true">📂</div>
      <div class="ac-drop-t"><b>У меня уже скачано</b><small>Перетащите сюда папку с уроками (например, «RUNO-all» из «Загрузок»), MP3-файлы или архив .zip — или выберите их:</small></div>
      <div class="ac-drop-b">
        ${dirOk ? `<button type="button" class="btn sm" data-ac-pick="dir" data-cid="${esc(cid)}" title="Выбрать папку с MP3 (например, Загрузки → RUNO-all)">📁 Выбрать папку</button>` : ''}
        <button type="button" class="btn sm" data-ac-pick="files" data-cid="${esc(cid)}" title="Выбрать MP3-файлы или архив .zip">🎵 Выбрать файлы (MP3 или ZIP)</button>
      </div>
      <div class="ac-drop-prog small" data-ac-iprog hidden></div>
    </div>`;
  }
  function lessonsHtml(cid) {
    const c = course(cid);
    const L = stored(cid);
    const have = new Set(L.map(x => x.file));
    const rows = [];
    if (c.lessons && /^[A-Z]{2}NO$/.test(c.code || '')) {
      for (let n = 1; n <= c.lessons; n++) {
        const file = `${c.code}${String(n).padStart(3, '0')}.mp3`;
        rows.push({ n, file, ok: have.has(file), info: filesOf(cid)[file] });
      }
      L.forEach(x => { if (!rows.some(r => r.file === x.file)) rows.push({ n: x.n, file: x.file, ok: true, info: x }); });
    } else L.forEach(x => rows.push({ n: x.n, file: x.file, ok: true, info: x }));
    const heard = (positions()[cid] || {}).heard || {};
    return rows.map(r => { const t = lessonTitle(c, r.n, r.file); const k = L.findIndex(x => x.file === r.file); return `<li class="ac-l ${r.ok ? '' : 'off'} ${heard[r.file] ? 'heard' : ''}" data-file="${esc(r.file)}">
          <button type="button" class="ac-l-b" ${r.ok ? `data-ac-lesson="${k}"` : 'disabled'} title="${r.ok ? 'Слушать этот урок (дальше — по порядку)' : 'Этот урок ещё не загружен'}">
            <span class="ac-l-n">${r.n || ''}</span><span class="ac-l-t"><b>${esc(t.src || t.head)}</b>${t.no ? `<small lang="nb">${esc(t.no)}</small>` : ''}</span>
            <span class="ac-l-m">${r.ok ? `${r.info && r.info.sec ? mss(r.info.sec) : ''}${heard[r.file] ? ' <span class="ac-heard" title="Прослушан">✓</span>' : ''}` : '<small>не загружен</small>'}</span>
            <span class="ac-l-go" aria-hidden="true">${r.ok ? '▶' : ''}</span></button></li>`; }).join('');
  }
  function courseView(cid) {
    const c = course(cid);
    return `<div class="ac-cv" data-ac-cv="${esc(cid)}">
      <div class="ac-cv-top"><button type="button" class="btn sm ghost" data-ac-back title="Ко всем аудиокурсам">‹ Все аудиокурсы</button></div>
      <article class="ac-card ac-card-big">
        <div class="ac-card-h"><span class="ac-flag" aria-hidden="true">${esc(c.flag || '🎧')}</span><div class="ac-card-t"><b>${esc(c.title)}</b>
          <small>${c.zip ? esc(LICENCE) : `Источник: ${esc(c.source || 'ваши файлы')}`}${c.site ? ` · <a href="${esc(c.site)}" target="_blank" rel="noopener" title="Тексты уроков на сайте 50languages">сайт курса ↗</a>` : ''}</small></div><span class="ac-mp3" aria-hidden="true">MP3</span></div>
        <div class="ac-sub small muted">🎧 Аудиокурсы › MP3 › ${esc(c.short)}</div>
        <div data-ac-status="${esc(cid)}">${statusHtml(cid)}</div>
        <div data-ac-actions="${esc(cid)}">${actionsHtml(cid, true)}</div>
      </article>
      <div data-ac-player></div>
      ${statusOf(cid) === 'none' || statusOf(cid) === 'partial' ? importHtml(cid) : ''}
      <h3 class="ac-h">Уроки</h3>
      <ol class="ac-lessons" data-ac-lessons>${lessonsHtml(cid)}</ol>
      <div class="tiny muted ac-foot">${esc(LICENCE)}. Тексты уроков (фразы по-русски и по-норвежски) — на сайте курса и в «Библиотеке выражений» → 50languages, откуда их можно взять в карточки.</div>
    </div>`;
  }
  const SPEEDS = [0.75, 0.9, 1, 1.25, 1.5];
  function playerHtml(cid) {
    const c = course(cid);
    const airplay = !!(window.HTMLMediaElement && 'webkitShowPlaybackTargetPicker' in HTMLMediaElement.prototype);
    const outRow = `<div class="ac-out">
        <button type="button" class="btn sm ghost" data-lx="where" title="Наушники, динамик, колонка — куда идёт звук">🔈 Где слушать</button>
        ${airplay ? '<button type="button" class="btn sm ghost" data-ac-airplay title="Слушать на колонке или телевизоре AirPlay">◎ AirPlay</button>' : ''}
        <button type="button" class="btn sm ghost" data-ac-cast="${esc(cid)}" title="${bridgeUp() ? 'Слушать на телевизоре или колонке Google (через мост на Mac)' : 'Слушать на телевизоре или колонке'}">${TV(16)} На телевизор</button>
      </div>`;
    if (cast && cast.cid === cid) {
      const L = stored(cid), x = L[cast.idx] || {};
      const pl = cast.state === 'PLAYING' || cast.state === 'BUFFERING';
      return `<section class="ac-player tv">
        <div class="ac-now"><span class="ac-eq ${pl ? 'on' : ''}" aria-hidden="true"><i></i><i></i><i></i></span><div class="ac-now-t"><small>📺 Играет на «${esc(cast.name)}»</small><b>${esc(lessonLine(c, x.n, x.file))}</b></div><span class="ac-time">${cast.busy ? '<span class="spinner sm"></span>' : mss(cast.time) + (x.sec ? ' / ' + mss(x.sec) : '')}</span></div>
        <div class="ac-ctl">
          <button type="button" class="ac-b" data-ac-tv="prev" title="Предыдущий урок" aria-label="Предыдущий урок">⏮</button>
          <button type="button" class="ac-b" data-ac-tv="back" title="На 10 секунд назад" aria-label="На 10 секунд назад">↺10</button>
          <button type="button" class="ac-b main" data-ac-tv="toggle" title="${pl ? 'Пауза' : 'Продолжить'}" aria-label="${pl ? 'Пауза' : 'Продолжить'}">${pl ? '⏸' : '▶'}</button>
          <button type="button" class="ac-b" data-ac-tv="fwd" title="На 10 секунд вперёд" aria-label="На 10 секунд вперёд">10↻</button>
          <button type="button" class="ac-b" data-ac-tv="next" title="Следующий урок" aria-label="Следующий урок">⏭</button>
        </div>
        <div class="ac-opts"><button type="button" class="ac-pill ${prefs().repeat ? 'on' : ''}" data-ac-repeat title="Повторять этот урок снова и снова">🔂 Повторять урок</button>
          <button type="button" class="ac-pill" data-ac-tv="stop" title="Остановить на телевизоре">⏹ Остановить на телевизоре</button></div>
      </section>`;
    }
    const p = window.Listen && Listen.p; const cur = curOf(p);
    if (!cur || cur.cid !== cid) {
      if (!stored(cid).length) return '';
      return `<section class="ac-player idle"><div class="ac-idle-t">${HP(22, true)}<span><b>Слушать курс</b><small>Уроки идут один за другим. Экран можно выключить — кнопки наушников и экрана блокировки работают.</small></span></div>${outRow}</section>`;
    }
    const a = p.audio, t = a.currentTime || 0, dur = isFinite(a.duration) ? a.duration : 0;
    const x = filesOf(cid)[cur.file] || {};
    const rate = p.o.mediaRate || 1;
    const abOn = ab.cid === cid && ab.file === cur.file;
    const abLbl = abOn && ab.b != null ? `A–B ✓ ${mss(ab.a)}–${mss(ab.b)}` : abOn && ab.a != null ? 'A–B: отметьте B' : 'A–B';
    return `<section class="ac-player">
      <div class="ac-now"><span class="ac-eq ${p.playing ? 'on' : ''}" aria-hidden="true"><i></i><i></i><i></i></span><div class="ac-now-t"><small>Сейчас играет · урок ${cur.i + 1} из ${p.cards.length}</small><b>${esc(lessonLine(c, cur.n, cur.file))}</b></div>
        <span class="ac-time" data-ac-time>${mss(t)} / ${mss(dur || x.sec || 0)}</span></div>
      <input type="range" class="ac-seek" data-ac-seek min="0" max="${Math.max(1, Math.floor(dur || x.sec || 1))}" step="1" value="${Math.floor(t)}" aria-label="Перемотка внутри урока" title="Перемотка внутри урока">
      <div class="ac-ctl">
        <button type="button" class="ac-b" data-ac-ctl="prev" title="Предыдущий урок" aria-label="Предыдущий урок">⏮</button>
        <button type="button" class="ac-b" data-ac-ctl="back" title="На 10 секунд назад" aria-label="На 10 секунд назад">↺10</button>
        <button type="button" class="ac-b main" data-ac-ctl="toggle" title="${p.playing ? 'Пауза (пробел)' : 'Продолжить'}" aria-label="${p.playing ? 'Пауза' : 'Продолжить'}">${p.playing ? '⏸' : '▶'}</button>
        <button type="button" class="ac-b" data-ac-ctl="fwd" title="На 10 секунд вперёд" aria-label="На 10 секунд вперёд">10↻</button>
        <button type="button" class="ac-b" data-ac-ctl="next" title="Следующий урок" aria-label="Следующий урок">⏭</button>
      </div>
      <div class="ac-opts">
        <div class="ac-speed" role="group" aria-label="Скорость"><span class="lbl">Скорость</span>${SPEEDS.map(s => `<button type="button" class="${Math.abs(rate - s) < 0.01 ? 'active' : ''}" data-ac-rate="${s}" title="Скорость ${String(s).replace('.', ',')}×">${String(s).replace('.', ',')}×</button>`).join('')}</div>
        <button type="button" class="ac-pill ${prefs().repeat ? 'on' : ''}" data-ac-repeat title="Повторять этот урок снова и снова">🔂 Повторять урок</button>
        <button type="button" class="ac-pill ${abOn && ab.b != null ? 'on' : ''}" data-ac-ab title="Повторять кусок: нажмите в начале (A) и в конце (B); ещё раз — снять">🔁 ${esc(abLbl)}</button>
        <button type="button" class="ac-pill" data-ac-ctl="restart" title="Этот урок с самого начала">⏪ Урок сначала</button>
        <button type="button" class="ac-pill" data-ac-ctl="big" title="Открыть большой плеер">${HP(15, true)} Большой плеер</button>
        <button type="button" class="ac-pill" data-ac-ctl="stop" title="Остановить (место запомнится)">⏹ Стоп</button>
      </div>
      ${window.ListenX && ListenX.sleepHtml ? `<div class="ac-sleep">${ListenX.sleepHtml()}</div>` : ''}
      ${outRow}
    </section>`;
  }
  const sigOf = () => courses().map(c => `${c.id}:${stored(c.id).length}:${statusOf(c.id)}`).join('|');
  function paint(full) {
    if (!win || !win.m.el.isConnected) return;
    const m = win.m;
    const sig = sigOf();
    if (!full && sig !== win.sig) {
      // lessons were added / removed: the list follows (the whole page when the set of courses or the import box changes)
      const lsEl = m.$('[data-ac-lessons]');
      const wantDrop = win.view !== 'list' && (statusOf(win.view) === 'none' || statusOf(win.view) === 'partial');
      if (win.view !== 'list' && lsEl) { lsEl.innerHTML = lessonsHtml(win.view); if (!!m.$('[data-ac-drop]') !== wantDrop) full = true; }
      else if (win.view === 'list' && m.$$('[data-ac-card]').length !== courses().length) full = true;
    }
    win.sig = sig;
    if (full) {
      const body = m.$('[data-ac-body]');
      body.innerHTML = win.view === 'list' ? listView() : courseView(win.view);
      spaceHtml().then(h => { const s = m.$('[data-ac-space]'); if (s) s.textContent = h; });
      if (window.ListenX && ListenX.paintAll) try { ListenX.paintAll(); } catch (e) { /* ignore */ }
    } else {
      m.$$('[data-ac-status]').forEach(el => { el.innerHTML = statusHtml(el.dataset.acStatus); });
      m.$$('[data-ac-actions]').forEach(el => { el.innerHTML = actionsHtml(el.dataset.acActions, !!el.closest('.ac-card-big')); });
    }
    if (win.view !== 'list') {
      const pl = m.$('[data-ac-player]');
      if (pl && !(document.activeElement && document.activeElement.matches('[data-ac-seek]'))) { pl.innerHTML = playerHtml(win.view); if (window.ListenX && ListenX.paintAll) try { ListenX.paintAll(); } catch (e) { /* ignore */ } }
      const cur = curOf(window.Listen && Listen.p);
      const heard = (positions()[win.view] || {}).heard || {};
      m.$$('.ac-l').forEach(li => { li.classList.toggle('now', !!(cur && cur.cid === win.view && cur.file === li.dataset.file) || !!(cast && cast.cid === win.view && cast.file === li.dataset.file)); li.classList.toggle('heard', !!heard[li.dataset.file]); });
    }
  }
  function tickTime() {
    if (!win || win.view === 'list' || !win.m.el.isConnected) return;
    const p = window.Listen && Listen.p; const cur = curOf(p);
    if (!cur || cur.cid !== win.view) return;
    const a = p.audio, dur = isFinite(a.duration) ? a.duration : 0;
    const tm = win.m.$('[data-ac-time]'); if (tm) tm.textContent = `${mss(a.currentTime)} / ${mss(dur || (filesOf(cur.cid)[cur.file] || {}).sec || 0)}`;
    const sk = win.m.$('[data-ac-seek]');
    if (sk && document.activeElement !== sk) { if (dur) sk.max = String(Math.floor(dur)); sk.value = String(Math.floor(a.currentTime || 0)); }
    const tg = win.m.$('[data-ac-ctl="toggle"]'); if (tg && tg.textContent !== (p.playing ? '⏸' : '▶')) paint(false);
  }
  function pickFiles(kind, cid) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.multiple = true;
    if (kind === 'dir') { inp.webkitdirectory = true; inp.setAttribute('webkitdirectory', ''); }
    else inp.accept = '.mp3,.m4a,.zip,audio/mpeg,audio/mp4,application/zip';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.onchange = () => { const fs = [...inp.files]; inp.remove(); if (fs.length) runImport(fs, cid); };
    inp.click();
  }
  async function runImport(files, cid) {
    const prog = win && win.m.$('[data-ac-iprog]');
    const show = t => { if (prog) { prog.hidden = false; prog.innerHTML = t; } };
    show('<span class="spinner sm"></span> Добавляю уроки в приложение…');
    try {
      const r = await importFiles(files, (d, t) => show(`<span class="spinner sm"></span> Добавляю: ${d} из ${t}…`));
      if (prog) prog.hidden = true;
      if (win && r.courses.length) { win.view = r.courses.includes(cid) ? cid : r.courses.length === 1 ? r.courses[0] : win.view; paint(true); }
    } catch (e) {
      show(`⚠️ ${esc(e.friendly ? e.message : 'Не получилось добавить файлы — попробуйте ещё раз.')}`);
      emit();
    }
  }
  function open(view) {
    if (win && win.m.el.isConnected) { win.view = view || 'list'; paint(true); return win.m; }
    const m = UI.modal({
      title: `${HP(24, true)} Аудиокурсы`, cls: 'wide ac-modal',
      body: '<div data-ac-body></div>',
      foot: '<button type="button" class="btn ghost" data-ac-help title="Как загрузить курс и где его слушать">❔ Как это работает</button>',
      beforeClose: UI.guard(async () => (DL.size ? {
        title: 'Закрыть окно?', line: 'Загрузка курса продолжится, пока приложение открыто. Её можно и остановить — загруженные уроки останутся.',
        actions: [{ label: 'Закрыть, пусть грузится', value: 'keep', cls: 'primary' }, { label: 'Остановить загрузку', value: 'stop', cls: 'bad' }],
        act: v => { if (v === 'stop') DL.forEach(d => d.ctrl.abort()); return true; },
      } : null)),
      onClose: () => { document.removeEventListener('ac-state', onState); document.removeEventListener('listen-state', onListen); document.removeEventListener('lx-state', onListen); clearInterval(iv); win = null; },
    });
    win = { m, view: view || 'list' };
    const onState = () => paint(false);
    const onListen = () => paint(false);
    document.addEventListener('ac-state', onState);
    document.addEventListener('listen-state', onListen);
    document.addEventListener('lx-state', onListen);
    const iv = setInterval(tickTime, 500);
    m.el.addEventListener('click', async e => {
      const t = e.target;
      const q = s => t.closest(s);
      let b;
      if ((b = q('[data-ac-help]'))) { openHelp(); return; }
      if ((b = q('[data-ac-back]'))) { win.view = 'list'; paint(true); return; }
      if ((b = q('[data-ac-view]'))) { win.view = b.dataset.acView; paint(true); reconcile(win.view); return; }
      if ((b = q('[data-ac-play]'))) { play(b.dataset.acPlay, null); if (win.view === 'list') { win.view = b.dataset.acPlay; paint(true); } else paint(false); return; }
      if ((b = q('[data-ac-dl]'))) { lastErr[b.dataset.acDl] = ''; download(b.dataset.acDl); if (win.view === 'list') { win.view = b.dataset.acDl; paint(true); } return; }
      if ((b = q('[data-ac-stop]'))) { await stopDownload(b.dataset.acStop); return; }
      if ((b = q('[data-ac-import]'))) { win.view = b.dataset.acImport; paint(true); const d = m.$('[data-ac-drop]'); if (d) { d.scrollIntoView({ block: 'center', behavior: 'smooth' }); d.classList.add('flash'); setTimeout(() => d.classList.remove('flash'), 1200); } return; }
      if ((b = q('[data-ac-pick]'))) { pickFiles(b.dataset.acPick, b.dataset.cid || ''); return; }
      if ((b = q('[data-ac-del]'))) {
        const cid = b.dataset.acDel, c = course(cid);
        if (await UI.confirm(`Удалить «${esc(c.short)}» из приложения? Уроки (${mb(bytesOf(cid))}) будут удалены с этого устройства — потом их можно загрузить снова.`, { ok: '🗑 Удалить', danger: true, title: 'Удалить курс?' })) {
          await removeCourse(cid); UI.toast('Курс удалён из приложения', 'good');
          if (win) { win.view = COURSES.some(x => x.id === cid) ? cid : 'list'; paint(true); }
        }
        return;
      }
      if ((b = q('[data-ac-lesson]'))) { play(win.view, +b.dataset.acLesson); paint(false); return; }
      if ((b = q('[data-ac-cast]'))) { castPick(b.dataset.acCast); return; }
      if ((b = q('[data-ac-airplay]'))) {
        const p = window.Listen && Listen.p;
        const a = p && ours(p) ? p.audio : null;
        if (a && a.webkitShowPlaybackTargetPicker) { try { a.setAttribute('x-webkit-airplay', 'allow'); a.webkitShowPlaybackTargetPicker(); } catch (err) { UI.toast('AirPlay сейчас недоступен — выберите колонку в Пункте управления', 'warn', 5000); } }
        else UI.toast('Сначала включите урок — потом выберите колонку или телевизор AirPlay', '', 4500);
        return;
      }
      if ((b = q('[data-ac-repeat]'))) {
        setPref({ repeat: !prefs().repeat });
        const p = window.Listen && Listen.p; if (ours(p) && p.cur && p.cur.media) p.audio.loop = !!prefs().repeat;
        UI.toast(prefs().repeat ? '🔂 Урок будет повторяться' : '▶ Дальше — следующий урок', '', 2500);
        paint(false); return;
      }
      if ((b = q('[data-ac-ab]'))) {
        const p = Listen.p, cur = curOf(p); if (!cur) return;
        const tnow = p.audio.currentTime || 0;
        if (ab.cid !== cur.cid || ab.file !== cur.file || ab.b != null) {
          if (ab.b != null && ab.cid === cur.cid && ab.file === cur.file) { Object.assign(ab, { cid: '', file: '', a: null, b: null }); UI.toast('Повтор куска выключен', '', 2000); }
          else { Object.assign(ab, { cid: cur.cid, file: cur.file, a: tnow, b: null }); UI.toast(`A — ${mss(tnow)}. Теперь нажмите в конце куска (B)`, '', 3500); }
        } else if (tnow > ab.a + 1) { ab.b = tnow; try { p.audio.currentTime = ab.a; } catch (err) { /* ignore */ } UI.toast(`🔁 Повторяю ${mss(ab.a)}–${mss(ab.b)}`, 'good', 2500); }
        else UI.toast('Кусок слишком короткий — дайте ему проиграть пару секунд', '', 3000);
        paint(false); return;
      }
      if ((b = q('[data-ac-rate]'))) { Listen.setMediaRate(+b.dataset.acRate); if (cast) castControl('rate', +b.dataset.acRate); paint(false); return; }
      if ((b = q('[data-ac-tv]'))) {
        const v = b.dataset.acTv;
        if (v === 'stop') { await castStop(false); paint(false); return; }
        if (v === 'toggle') castControl('toggle');
        else if (v === 'back') castControl('seekBy', -10);
        else if (v === 'fwd') castControl('seekBy', 10);
        else if (v === 'prev' && cast) castPlay(cast.cid, Math.max(0, cast.idx - 1), 0);
        else if (v === 'next' && cast) { const L = stored(cast.cid); if (cast.idx + 1 < L.length) castPlay(cast.cid, cast.idx + 1, 0); }
        return;
      }
      if ((b = q('[data-ac-ctl]'))) {
        const v = b.dataset.acCtl, p = Listen.p;
        if (v === 'big') { if (window.ListenUI) ListenUI.nowPlaying(); return; }
        if (!p) return;
        if (v === 'toggle') { if (!p.playing) Listen.prime(); Listen.toggle(); }
        else if (v === 'back') Listen.seekBy(-10);
        else if (v === 'fwd') Listen.seekBy(10);
        else if (v === 'prev') { Listen.prime(); if ((p.audio.currentTime || 0) > 5) { try { p.audio.currentTime = 0; } catch (err) { /* ignore */ } } else Listen.jump(-1); }
        else if (v === 'next') { Listen.prime(); Listen.jump(1); }
        else if (v === 'restart') { try { p.audio.currentTime = 0; } catch (err) { /* ignore */ } }
        else if (v === 'stop') {
          const r = await UI.askClose({ title: 'Остановить урок?', line: 'Место в уроке запомнится — «Продолжить» начнёт отсюда.', actions: [{ label: 'Остановить', value: 'stop', cls: 'bad' }], cancel: 'Пусть играет' });
          if (r === 'stop') { savePlace(p); Listen.stop(); }
        }
        setTimeout(() => paint(false), 60);
      }
    });
    m.el.addEventListener('input', e => {
      const s = e.target.closest('[data-ac-seek]'); if (!s) return;
      const p = Listen.p; if (!ours(p)) return;
      try { p.audio.currentTime = +s.value; } catch (err) { /* ignore */ }
    });
    m.el.addEventListener('change', e => { if (e.target.closest('[data-ac-seek]')) e.target.blur(); });
    // drag & drop a folder / MP3 / zip anywhere in the window
    m.el.addEventListener('dragover', e => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); const d = m.$('[data-ac-drop]'); if (d) d.classList.add('over'); } });
    m.el.addEventListener('dragleave', e => { if (!m.el.contains(e.relatedTarget)) { const d = m.$('[data-ac-drop]'); if (d) d.classList.remove('over'); } });
    m.el.addEventListener('drop', async e => {
      if (![...(e.dataTransfer.types || [])].includes('Files')) return;
      e.preventDefault(); e.stopPropagation(); // the files are for this window — not «import cards» (js/app.js)
      const d = m.$('[data-ac-drop]'); if (d) d.classList.remove('over');
      const fs = await filesFromDrop(e.dataTransfer);
      runImport(fs, win.view === 'list' ? '' : win.view);
    });
    m.el.addEventListener('keydown', e => {
      const k = e.target.closest('[data-ac-drop]');
      if (k && (e.key === 'Enter' || e.key === ' ') && e.target === k) { e.preventDefault(); pickFiles('files', win.view === 'list' ? '' : win.view); }
    });
    paint(true);
    if (win.view !== 'list') reconcile(win.view);
    return m;
  }
  function openHelp() {
    if (window.Help && Help.open) { try { Help.open('audiocourse'); return; } catch (e) { /* below */ } }
    UI.modal({ title: '❔ Аудиокурсы', cls: 'narrow', body: HELP_STEPS.map(s => `<p>${s[0]} ${s[1]}</p>`).join('') + `<p class="small muted">${HELP_LIMITS}</p>` });
  }

  /* ---------------- help topic (runtime registration, like js/ordtrainer.js) ---------------- */
  const HELP_STEPS = [
    ['📚', 'В «📚 Книги» у курса 50languages нажмите <b>«🎧 В приложение»</b> — или на главной <b>«🎧 Аудиокурсы»</b>.'],
    ['⬇', '<b>«⬇ Загрузить в приложение»</b>: уроки по одному загружаются внутрь приложения (нужен мост на Mac). Остановили или пропал интернет — <b>«Догрузить»</b> продолжит с того же места.'],
    ['📂', 'Уже скачали архив? <b>«📂 У меня уже скачано»</b>: выберите папку «RUNO-all» из «Загрузок», MP3-файлы или сам .zip — или просто перетащите их в окно.'],
    ['▶', '<b>«Слушать подряд»</b> или любой урок из списка. Кнопки: ⏮ ⏭ — уроки, ↺10 и 10↻ — на 10 секунд, скорость, 🔂 повторять урок, 🔁 A–B — повторять кусок, 🌙 таймер сна. Место запоминается.'],
    ['🔈', '<b>Где слушать</b>: наушники, динамик — как в системе; на Mac можно выбрать устройство. <b>Колонка Bluetooth или магнитофон</b>: подключите их к телефону или Mac по Bluetooth (или кабелем AUX) — звук пойдёт туда сам. <b>AirPlay</b> — в Safari и на iPhone. <b>📺 Телевизор</b> или колонка Google — кнопкой «На телевизор» (через мост на Mac).'],
  ];
  const HELP_LIMITS = 'Курс 50languages (Goethe Verlag) бесплатен для личного использования; мы не размещаем его у себя — он загружается с сайта 50languages в ваше приложение. Курс занимает около 120 МБ на устройстве. iPhone может удалить сохранённые файлы сайта, если приложение долго не открывали или мало места — добавьте приложение на экран «Домой», тогда это бывает реже; если урок пропал, «Догрузить» вернёт его. На iPhone звук продолжает играть с выключенным экраном, но переключение на следующий урок в фоне иногда задерживается — тогда помогает кнопка ⏭ на экране блокировки. На телевизор урок передаётся с Mac: мост должен быть запущен, Mac и телевизор — в одной сети.';
  function registerHelp() {
    if (!window.Help || !Array.isArray(Help.TOPICS) || Help.TOPICS.some(t => t.id === 'audiocourse')) return;
    Help.TOPICS.push({ id: 'audiocourse', icon: '🎧', hue: 265, title: 'Аудиокурсы: 50languages в приложении',
      desc: '100 уроков RU–NO с озвучкой — загрузить внутрь приложения (или добавить уже скачанную папку) и слушать где угодно: наушники, динамик, колонка, телевизор.',
      keys: 'аудиокурс аудиокурсы 50languages goethe book2 mp3 runo ukno уроки скачать загрузить zip архив папка загрузки finder слушать наушники колонка bluetooth магнитофон airplay телевизор chromecast повтор a-b скорость таймер сна',
      steps: HELP_STEPS, expect: 'Курс лежит внутри приложения и играет без интернета, как плеер: экран можно выключить, кнопки наушников и экрана блокировки работают, место в уроке запоминается.',
      limits: HELP_LIMITS, open: ['🎧 Открыть аудиокурсы', () => AudioCourse.open()] });
  }

  /* ---------------- entry points ---------------- */
  if (typeof document !== 'undefined') {
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('[data-audiocourse-open]'); if (!b) return;
      e.preventDefault();
      AudioCourse.open();
    });
    const boot = () => { try { registerHelp(); } catch (e) { /* help is optional */ } };
    // a course continued from elsewhere («Продолжить» in «Что послушать?», after a reload): our extras too
    document.addEventListener('listen-state', () => { const p = window.Listen && Listen.p; if (ours(p) && !p.__ac) hook(p); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }

  const AudioCourse = {
    COURSES, T,
    open() { return open('list'); },
    openCourse(id) { return open(course(id) ? id : 'list'); },
    importFiles,
    /** Listen (js/listen.js queueFor): the address of a stored lesson — a blob: URL from Cache Storage */
    resolveUrl,
    /** «📚 Книги»: the course of an archive url ('' if none) and its status */
    idForUrl(url) { const c = COURSES.find(x => x.zip === url); return c ? c.id : ''; },
    statusOf,
    statusLabel(id) { const s = statusOf(id), n = stored(id).length, c = course(id); return s === 'done' ? 'в приложении ✓' : s === 'partial' ? `частично: ${n} из ${c.lessons}` : s === 'loading' ? 'загружается…' : ''; },
    play, download,
    /** every course: the catalogue + the user's own added folders */
    list: () => courses(),
    /** how many lessons of a course are inside the app */
    storedCount: cid => stored(cid).length,
    /** the course listened to last (home strip «Продолжить», the library): { cid, file, sec, t, title, lesson, flag, n, of } or null */
    inProgress() {
      try {
        let best = null;
        Object.entries(positions() || {}).forEach(([cid, e]) => {
          const c = course(cid);
          if (!c || !e || !e.file || !e.t) return;
          const L = stored(cid), k = L.findIndex(x => x.file === e.file);
          if (k < 0) return; // the lesson is no longer in the app
          if (!best || e.t > best.t) best = { cid, file: e.file, sec: +e.sec || 0, t: +e.t, title: c.short || c.title || 'Аудиокурс', flag: c.flag || '🎧', lesson: lessonLine(c, lessonNo(e.file), e.file), n: k + 1, of: L.length };
        });
        return best;
      } catch (e) { return null; }
    },
    // internals for the checks
    _t: { mp3Sec, crc32, parseCD, detect, lessonTitle, stored, positions, meta, cacheKey, fromKey, removeCourse, castState: () => cast },
  };
  window.AudioCourse = AudioCourse;
})();
