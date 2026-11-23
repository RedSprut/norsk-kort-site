/* ============ 🎬 Субтитры → карточки: свой фильм / сериал / подкаст + файл субтитров ============
 * Как Language Reactor, но со своими файлами: видео или аудио + субтитры (.srt / .vtt / .ass / .ssa),
 * по желанию — второй файл субтитров (русский или английский) для двойных субтитров.
 *  - плеер + прокручиваемый текст: текущая строка подсвечена; клик по строке — проиграть только её;
 *    🔁 повтор строки, скорость, ← → — соседняя строка, пробел — пауза;
 *  - слово в строке — перевод во всплывающем окне и «➕ В карточку»;
 *  - «➕ Строка → карточка»: норвежская строка, перевод и ЗВУК этой строки из самого видео
 *    (card.audio = data:audio/wav;base64,… — 16 кГц, моно, 16 бит, до 15 с; card.audioText — что в нём сказано).
 * Нет русских субтитров — строки переводятся как в режиме «По предложениям» (Study.translateUnits, кэш 's:').
 * ▶ YouTube и 📺 NRK TV играют в этом же плеере (Subs.openStream): видео — во встроенном плеере YouTube или потоком NRK,
 * норвежские субтитры приносит мост на Mac (bridge/media.py), русская строка — переводчик. Звук строки из потока не
 * вырезается — карточку озвучивает голос приложения, в описании ссылка на этот момент видео.
 * ✈️ Видео авторов из Telegram (Subs.openStream({ kind: 'tg' })): поток идёт через мост (HTTP Range, js/tgvideo.js);
 * субтитров нет — их создаёт NB-Whisper, звук для распознавания и для карточек мост отдаёт кусками (ffmpeg → PCM 16 кГц),
 * так что у карточки есть настоящий голос автора. 🔎 «Найти слова в кадре» — текст, впечатанный в видео (js/frameocr.js).
 * 📝 «Надписи в кадре» (Ink): пока нет субтитров, надписи, впечатанные в картинку (титры, название), читаются сами
 * и переводятся — строкой «📝 В кадре» на видео и в списке строк (из неё тоже можно сделать карточку).
 * 🎤 «Бегущая строка» (Kar / KEnv): слово загорается, когда его произносят, — точное время из субтитров, иначе по звуку
 * (паузы речи), иначе по слогам; «⏱ Сдвиг слов» ±1 с для каждого видео. По умолчанию выключена.
 * 🎤📺 Она же на телевизоре: через мост — WebVTT, где строка разбита на реплики по словам (karSteps: жирное звучащее
 * слово или слова по одному), в системном полноэкранном плеере iPhone — так же (NativeSubs), на нашей странице для ТВ
 * (receiver.html, после регистрации Cast App ID) — настоящая подсветка по времени слов. Выключена — файл прежний.
 * 🌐 Перевод «Под строкой / По словам / Размыт / Скрыт» меняется и во время просмотра: строка под видео, «Aa Вид субтитров»,
 * кнопка «Aa Перевод: …» на видео (на весь экран — маленькое окно с выбором). 🎬 Титры (Cred): имена — как написаны
 * (+ примерное чтение по-русски), должности — по словарику; всё собирается в блок «🎬 Титры» под списком строк.
 * 🎵 Песни без субтитров (Song): там, где субтитров нет, слова распознаются по звуку (NB-Whisper на устройстве);
 * не норвежский и не английский — «Звучит песня на шведском языке». 🇬🇧 Английские строки переводятся с английского («EN»).
 * W6 (docs/release-architecture.md): мост на Mac — только Net.isMacBridge(); без него YouTube — официальный IFrame-плеер
 * (ничего поверх него: ни стекла, ни строк, ни своего полного экрана) + свой файл субтитров; Cast App ID — NK_CONFIG.castAppId;
 * Media Session (экран блокировки) для звука и видео этого плеера; MediaIcons — рисованные значки для окон медиа.
 */
(function () {
  /* ---------- 🎨 MediaIcons: drawn line icons for the media windows (NRK, radio, YouTube, Telegram media, TV) ----------
   * The same family as NavIcons.icon (js/app.js): 24×24, a 1.9 line in the colour of the text, round ends, a part lightly
   * filled (.f). MediaIcons.icon(name, size) → <svg>; a name it does not know goes to NavIcons.icon; unknown → ''. */
  const MI = {
    tv: '<rect class="f" x="3.4" y="5" width="17.2" height="11.6" rx="2.4"/><path d="M8.6 20h6.8M12 16.6V20"/>',
    radio: '<rect class="f" x="3.6" y="8.4" width="16.8" height="11.4" rx="2.4"/><path d="M7.4 8.4 16.6 4.2"/><circle cx="15.6" cy="14.1" r="2.6"/><path d="M7.2 12.4h3.6M7.2 15.8h3.6"/>',
    podcast: '<rect class="f" x="9" y="3.6" width="6" height="10.4" rx="3"/><path d="M5.8 11.2a6.2 6.2 0 0 0 12.4 0"/><path d="M12 17.4v3"/><path d="M9 20.4h6"/>',
    headphones: '<path d="M4.4 15.6v-3.2a7.6 7.6 0 0 1 15.2 0v3.2"/><rect class="f" x="3.8" y="13.6" width="4.4" height="6.6" rx="1.8"/><rect class="f" x="15.8" y="13.6" width="4.4" height="6.6" rx="1.8"/>',
    play: '<path class="f" d="M8 5.4v13.2c0 .8.86 1.28 1.54.86l10.3-6.6a1 1 0 0 0 0-1.72L9.54 4.54C8.86 4.12 8 4.6 8 5.4z"/>',
    pause: '<rect class="f" x="6.4" y="5" width="3.8" height="14" rx="1.2"/><rect class="f" x="13.8" y="5" width="3.8" height="14" rx="1.2"/>',
    stop: '<rect class="f" x="6" y="6" width="12" height="12" rx="2.4"/>',
    search: '<circle class="f" cx="10.6" cy="10.6" r="6.2"/><path d="m15.2 15.2 4.6 4.6"/>',
    external: '<path d="M13.6 4.4h6v6"/><path d="M19.6 4.4 11 13"/><path d="M17.6 13.8v3.6c0 1.2-1 2.2-2.2 2.2H6.6c-1.2 0-2.2-1-2.2-2.2V8.6c0-1.2 1-2.2 2.2-2.2h3.6"/>',
    subtitles: '<rect class="f" x="3.4" y="5.4" width="17.2" height="13.2" rx="2.6"/><path d="M7 11.6h5M14.4 11.6H17M7 15h2.6M12 15h5"/>',
    back: '<path d="M14.6 5.6 8.2 12l6.4 6.4"/>',
    next: '<path d="M9.4 5.6 15.8 12l-6.4 6.4"/>',
    live: '<circle class="dot" cx="12" cy="12" r="2.4"/><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6"/><path d="M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4"/>',
    video: '<rect class="f" x="3.4" y="6" width="12.6" height="12" rx="2.4"/><path d="m16 10.4 4.6-2.6v8.4L16 13.6"/>',
    file: '<path class="f" d="M7 3.6h6.6l4.4 4.4v10.2c0 1.2-1 2.2-2.2 2.2H7c-1.2 0-2.2-1-2.2-2.2V5.8c0-1.2 1-2.2 2.2-2.2z"/><path d="M13.4 3.8V8h4.4"/><path d="M8.4 12.6h6.2M8.4 16h4"/>',
    send: '<path class="f" d="M20.2 4 3.8 10.6c-.7.28-.66 1.28.06 1.5l5.5 1.7 1.7 5.5c.22.72 1.22.76 1.5.06z"/><path d="m9.4 13.8 4.4-4.4"/>',
    laptop: '<rect class="f" x="5" y="5" width="14" height="9.8" rx="1.8"/><path d="M3 18.6h18"/>',
    phone: '<rect class="f" x="7" y="3" width="10" height="18" rx="2.4"/><path d="M10.6 17.8h2.8"/>',
    cast: '<path d="M3.4 14.6V6.9c0-1.05.85-1.9 1.9-1.9h13.4c1.05 0 1.9.85 1.9 1.9v9.2c0 1.05-.85 1.9-1.9 1.9H13.6"/><path d="M3.4 14.9a6.1 6.1 0 0 1 6.1 6.1"/><path d="M3.4 18.1a2.9 2.9 0 0 1 2.9 2.9"/><circle class="dot" cx="4" cy="20.4" r="1"/>',
    airplay: '<path d="M6.4 17H5.6c-1.2 0-2.2-1-2.2-2.2V6.6c0-1.2 1-2.2 2.2-2.2h12.8c1.2 0 2.2 1 2.2 2.2v8.2c0 1.2-1 2.2-2.2 2.2h-.8"/><path class="f" d="M12 14.2 7.6 19.6h8.8z"/>',
    music: '<path d="M9.4 17.4V5.6l9.4-1.8v11.8"/><circle class="f" cx="7" cy="17.4" r="2.6"/><circle class="f" cx="16.4" cy="15.6" r="2.6"/>',
    mic: '<rect class="f" x="9" y="3.6" width="6" height="10.4" rx="3"/><path d="M5.8 11.2a6.2 6.2 0 0 0 12.4 0M12 17.4v3"/>',
    grid: '<rect class="f" x="4" y="4" width="7" height="7" rx="1.6"/><rect class="f" x="13" y="4" width="7" height="7" rx="1.6"/><rect class="f" x="4" y="13" width="7" height="7" rx="1.6"/><rect class="f" x="13" y="13" width="7" height="7" rx="1.6"/>',
    star: '<path class="f" d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"/>',
  };
  const miPaint = s => s.replace(/class="f"/g, 'class="f" fill="currentColor" fill-opacity=".22"').replace(/class="dot"/g, 'class="dot" fill="currentColor" stroke="none"');
  const MediaIcons = {
    NAMES: Object.keys(MI),
    icon(name, size, cls) {
      const p = MI[name], s = size || 18;
      if (!p) return window.NavIcons && NavIcons.icon ? NavIcons.icon(name, s, cls) : '';
      return `<svg class="ico ui-ico mi-ico mi-${name}${cls ? ' ' + cls : ''}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${miPaint(p)}</svg>`;
    },
  };
  window.MediaIcons = MediaIcons;
  /** the Mac bridge may be used: the app runs on that Mac AND the bridge answered (Net.isMacBridge — docs §3.4) */
  const macBridge = () => (window.Net && Net.isMacBridge ? Net.isMacBridge()
    : (location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/.test(location.hostname)) && !!(window.AI && AI.bridge && AI.bridge.up));
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  const MEDIA_EXT = /\.(mp4|m4v|mov|webm|mkv|ogv|mp3|m4a|m4b|aac|wav|ogg|oga|opus|flac)$/i;
  const SUB_EXT = /\.(srt|vtt|webvtt|ass|ssa)$/i;
  const AUDIO_EXT = /\.(mp3|m4a|m4b|aac|wav|ogg|oga|opus|flac)$/i;
  const PRE = 0.15, POST = 0.25;      // the clip: [start − 0.15 s, end + 0.25 s]
  const CLIP_MAX = 15;                // seconds
  const SR = 16000;                   // clip sample rate (speech: 16 kHz is plenty)
  const MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ''));
  // the whole sound track is decoded at once only for files that fit in memory; longer ones: the line is recorded while it plays (silently)
  const FULL_MAX_SEC = MOBILE ? 15 * 60 : 40 * 60;
  const FULL_MAX_BYTES = MOBILE ? 150e6 : 400e6;
  const POS_KEY = 'nk-subs-pos';
  const FORMAT_ERR = 'В этом видео звук в формате, который браузер не может разобрать — карточка будет без звука';

  const pad = n => String(Math.floor(n)).padStart(2, '0');
  const hms = t => { t = Math.max(0, Math.floor(t)); return `${pad(t / 3600)}:${pad(t % 3600 / 60)}:${pad(t % 60)}`; };
  const mss = t => { t = Math.max(0, Math.floor(t)); const h = Math.floor(t / 3600); return h ? `${h}:${pad(t % 3600 / 60)}:${pad(t % 60)}` : `${Math.floor(t / 60)}:${pad(t % 60)}`; };
  /* 🐢 playback speed for learners: three slow steps, normal, a little faster, fast (kept on this device) */
  const RATES = [[0.6, 'очень медленно'], [0.75, 'медленно'], [0.9, 'чуть медленнее'], [1, 'обычно'], [1.15, 'чуть быстрее'], [1.3, 'быстро']];
  const RATE_KEY = 'nk-rate';
  /* 🌐 how the translation is shown — one choice everywhere: the row under the video, «Aa Вид субтитров», the «Aa» button
   * on the video (full screen); applied at once, the video keeps playing, remembered on this device */
  const TR_MODES = [
    ['show', 'Под строкой', 'Перевод всей фразы — отдельной строкой под субтитром', '≡'],
    ['word', 'По словам', 'После каждого слова — его перевод в скобках, по смыслу фразы', '(а)'],
    ['blur', 'Размыт', 'Перевод размыт — наведите или нажмите на него, чтобы прочитать', '░'],
    ['hide', 'Скрыт', 'Только норвежский текст — проверьте себя', '✕'],
  ];
  const trName = m => (TR_MODES.find(x => x[0] === m) || TR_MODES[0])[1];
  /** 📍 the place whose voice speaks here (🔊 Голоса → «Где какой голос»): video — or the news / radio, a Telegram author,
   *  when the player was opened from there */
  const voicePlace = () => { let p = ''; try { p = window.Voices ? Voices.place('video') : ''; } catch (e) { p = ''; } return p === 'news' || p === 'telegram' ? p : 'video'; };
  const savedRate = () => { const r = +localStorage.getItem(RATE_KEY); return RATES.some(([x]) => x === r) ? r : 1; };
  const rateLabel = r => (RATES.find(([x]) => x === r) || [r, ''])[1];
  const rateNum = r => String(r).replace('.', ',') + '×';
  const rateSel = (cls = '') => `<label class="subs-speed ${cls}" title="Скорость видео — медленнее, чтобы успевать читать и слышать каждое слово">
      <span aria-hidden="true">${st && st.rate < 1 ? '🐢' : st && st.rate > 1 ? '🐇' : '⏱'}</span>
      <select data-rate-sel aria-label="Скорость видео">${RATES.map(([r, t]) => `<option value="${r}" ${st && st.rate === r ? 'selected' : ''}>${rateNum(r)} · ${t}</option>`).join('')}</select></label>`;
  const baseName = n => String(n || '').replace(/\.[^.]+$/, '').replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'видео';
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1).replace('.0', '') + ' МБ' : Math.max(1, Math.round(n / 1024)) + ' КБ';
  const bare = w => String(w).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

  /* =================== subtitle files =================== */
  /** bytes → text: BOM (UTF-8 / UTF-16), UTF-8, else Windows-1252 (Norwegian æøå) or a Cyrillic code page */
  function decodeSub(buf) {
    const b = new Uint8Array(buf);
    if ((b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) || (b[0] === 0xFF && b[1] === 0xFE) || (b[0] === 0xFE && b[1] === 0xFF)) return U.decodeText(buf);
    let zeros = 0; const n = Math.min(b.length, 4000);
    for (let i = 0; i < n; i++) if (b[i] === 0) zeros++;
    if (n && zeros / n > 0.25) return U.decodeText(buf);           // UTF-16 without BOM
    try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { /* an old 8-bit code page */ }
    // Cyrillic text in a 1-byte code page: most letters are bytes ≥ 0x80; Norwegian in Windows-1252: only æøå é
    let hi = 0, letters = 0;
    for (let i = 0; i < b.length; i++) { const c = b[i]; if (c >= 0xC0) { hi++; letters++; } else if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) letters++; }
    if (letters && hi / letters > 0.3) return U.decodeText(buf);   // Windows-1251 / KOI8-R
    return new TextDecoder('windows-1252').decode(b);
  }
  /** "01:02:03,456" · "02:03.456" · "0:01:02.45" (ASS) → seconds */
  function parseTime(s) {
    const m = String(s).trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/);
    if (!m) return NaN;
    return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (m[4] ? parseFloat('0.' + m[4]) : 0);
  }
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—', aring: 'å', Aring: 'Å', oslash: 'ø', Oslash: 'Ø', aelig: 'æ', AElig: 'Æ', eacute: 'é' };
  /** cue text → plain text: no HTML / VTT tags, no {\an8} / ASS codes, entities decoded, one line */
  function cleanCue(s) {
    return String(s)
      .replace(/\{[^}]*\}/g, '')                        // {\an8} {\i1} (SRT made from ASS, ASS itself)
      .replace(/\\[Nn]/g, '\n').replace(/\\h/g, ' ')     // ASS line breaks / hard spaces
      .replace(/<\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3}>/g, '') // VTT karaoke timestamps
      .replace(/<rt>.*?<\/rt>/gi, '')
      .replace(/<[^>]*>/g, '')                           // <i> <b> <font> <v Speaker> <c.class> <lang no>
      .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e] != null ? ENT[e] : m))
      .split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ')
      .replace(/\s+/g, ' ').trim();
  }
  /** 🎤 karaoke times inside a cue: raw text where every timing mark was replaced by a private-use character
   *  (U+E000 + k → times[k]) → { text (the same as cleanCue gives), wt: the start of each word (NaN: not marked) } */
  function markTimes(raw, times, start) {
    const s = cleanCue(raw);
    let txt = '', t = start, sp = false;
    const at = [];   // the time of each character of txt
    for (const ch of s) {
      const c = ch.codePointAt(0);
      if (c >= 0xE000 && c < 0xE000 + times.length) { t = times[c - 0xE000]; continue; }
      if (/\s/.test(ch)) { sp = !!txt; continue; }
      if (sp) { txt += ' '; at.push(t); sp = false; }
      txt += ch; at.push(t);
    }
    const wt = []; let i = 0;
    txt.split(' ').forEach(tok => { if (/\p{L}/u.test(tok)) wt.push(at[i]); i += tok.length + 1; });
    return { text: txt, wt };
  }
  /** WebVTT cue text with <00:00:01.250> marks (karaoke, YouTube's own VTT) → { text, wt } or null */
  function vttWordTimes(body, start) {
    if (!/<\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3}>/.test(body)) return null;
    const times = [];
    const raw = body.replace(/<(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})>/g, (m, ts) => { const v = parseTime(ts.replace(',', '.')); if (!isFinite(v) || times.length > 6000) return ''; times.push(v); return String.fromCharCode(0xE000 + times.length - 1); });
    const r = markTimes(raw, times, start);
    return r.wt.some(x => x > start + 0.01) ? r : null;
  }
  /** ASS karaoke {\k25}{\kf40}{\ko30} (centiseconds per syllable) → { text, wt } or null */
  function assWordTimes(body, start) {
    if (!/\{[^}]*\\[kK][fo]?\d/.test(body)) return null;
    const times = []; let cum = 0;
    const raw = body.replace(/\{([^}]*)\}/g, (m, inner) => {
      const ks = [...inner.matchAll(/\\[kK][fo]?(\d+)/g)];
      if (!ks.length) return m;
      times.push(start + cum);
      ks.forEach(k => { cum += (+k[1] || 0) / 100; });
      return String.fromCharCode(0xE000 + times.length - 1);
    });
    return markTimes(raw, times, start);
  }
  /** SRT and WebVTT: every "start --> end" line, then the text lines up to an empty line (VTT cue settings ignored) */
  function parseTimed(text) {
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^\s*([\d:.,]+)\s*-->\s*([\d:.,]+)/);
      if (!m) continue;
      const start = parseTime(m[1].replace(',', '.')), end = parseTime(m[2].replace(',', '.'));
      const body = [];
      while (i + 1 < lines.length && lines[i + 1].trim() !== '' && !/-->/.test(lines[i + 1])) body.push(lines[++i]);
      // a cue number of the NEXT cue stuck without an empty line (broken SRT): drop a trailing bare number
      if (body.length > 1 && /^\d+$/.test(body[body.length - 1].trim()) && /-->/.test(lines[i + 1] || '')) body.pop();
      if (isFinite(start) && isFinite(end)) {
        const c = { start, end: Math.max(end, start + 0.3), text: cleanCue(body.join('\n')) };
        const k = vttWordTimes(body.join('\n'), start); if (k && k.text === c.text) c.wt = k.wt; // 🎤 exact word times
        out.push(c);
      }
    }
    return out;
  }
  /** ASS / SSA: [Events] → Format: … → Dialogue: lines (Text is the last field and may contain commas) */
  function parseASS(text) {
    const out = [];
    let fmt = null, inEvents = false;
    text.replace(/\r\n?/g, '\n').split('\n').forEach(line => {
      const l = line.trim();
      if (/^\[.+\]$/.test(l)) { inEvents = /^\[events\]$/i.test(l); return; }
      if (!inEvents) return;
      const f = l.match(/^Format:\s*(.+)$/i);
      if (f) { fmt = f[1].split(',').map(x => x.trim().toLowerCase()); return; }
      const d = l.match(/^Dialogue:\s*(.+)$/i);
      if (!d) return;
      const cols = fmt || ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
      const parts = d[1].split(',');
      const head = parts.slice(0, cols.length - 1), body = parts.slice(cols.length - 1).join(',');
      const get = k => head[cols.indexOf(k)];
      const start = parseTime(get('start')), end = parseTime(get('end'));
      // drawings (\p1) and karaoke signs are not speech
      if (/\\p[1-9]/.test(body)) return;
      if (isFinite(start) && isFinite(end)) {
        const c = { start, end: Math.max(end, start + 0.3), text: cleanCue(body) };
        const k = assWordTimes(body, start); if (k && k.text === c.text) c.wt = k.wt; // 🎤 karaoke syllables → word times
        out.push(c);
      }
    });
    return out;
  }
  function parseSubs(text, name) {
    text = String(text || '').replace(/^﻿/, '');
    const ass = /\.(ass|ssa)$/i.test(name || '') || /^\s*\[Script Info\]/i.test(text);
    let cues = ass ? parseASS(text) : parseTimed(text);
    cues = cues.filter(c => c.text && /\p{L}/u.test(c.text)).sort((a, b) => a.start - b.start);
    // the same text cut into several cues right after each other (roll-up / karaoke subtitles): one line
    const res = [];
    cues.forEach(c => {
      const p = res[res.length - 1];
      if (p && p.text === c.text && c.start - p.end < 0.5) { p.end = Math.max(p.end, c.end); return; }
      res.push(c);
    });
    return res;
  }
  const NO_W = new Set('og er ikke jeg det på en et som har med til av du vi han hun men så kan skal vil meg deg hva hvor nå her der være ble var også bare hvis noe nei ja hei takk må kom går gjør godt dere seg sin sitt mitt min din ditt hvordan fordi etter eller'.split(' '));
  const EN_W = new Set('the and is are you to of it that what this was have not with he she they we be do don\'t i\'m it\'s can will would there your my me know just get'.split(' '));
  /** language of a subtitle file: from the name (film.no.srt, film.rus.srt), else from the words */
  function detectLang(cues, name) {
    const n = String(name || '').toLowerCase();
    if (/(^|[._\-\s\[(])(ru|rus|russian|русск\w*)([._\-\s\])]|$)/.test(n)) return 'ru';
    if (/(^|[._\-\s\[(])(nb|no|nn|nor|nob|norsk|norwegian|bokmål|bokmal)([._\-\s\])]|$)/.test(n)) return 'no';
    if (/(^|[._\-\s\[(])(en|eng|english)([._\-\s\])]|$)/.test(n)) return 'en';
    const sample = cues.slice(0, 300).map(c => c.text).join(' ');
    if (U.cyrRatio(sample) > 0.4) return 'ru';
    return noScore(cues) >= 0 ? 'no' : 'en';
  }
  function noScore(cues) {
    let no = 0, en = 0;
    cues.slice(0, 300).forEach(c => c.text.toLowerCase().split(/[^\p{L}']+/u).forEach(w => { if (NO_W.has(w)) no++; if (EN_W.has(w)) en++; if (/[æøå]/.test(w)) no += 2; }));
    return no - en;
  }
  /** dual subtitles: every cue of the second file goes to the Norwegian line it overlaps most (or the nearest one) */
  function pairUp(lines, cues, lang) {
    lines.forEach(l => { l.tr2 = []; });
    if (!lines.length) return;
    let j0 = 0;
    cues.forEach(c => {
      while (j0 < lines.length - 1 && lines[j0].end < c.start - 5) j0++;
      let best = -1, bestOv = 0, near = -1, nearD = 1.6;
      for (let j = j0; j < lines.length && lines[j].start <= c.end + 5; j++) {
        const l = lines[j];
        const ov = Math.min(l.end, c.end) - Math.max(l.start, c.start);
        if (ov > bestOv) { bestOv = ov; best = j; }
        const d = Math.abs((l.start + l.end) / 2 - (c.start + c.end) / 2);
        if (d < nearD) { nearD = d; near = j; }
      }
      const k = best >= 0 ? best : near;
      if (k >= 0) lines[k].tr2.push(c.text);
    });
    lines.forEach(l => {
      const t = l.tr2.join(' ').trim();
      delete l.tr2;
      if (lang === 'ru') { l.ruFile = t; l.en = ''; } else { l.en = t; l.ruFile = ''; }
    });
  }

  /* =================== audio clips =================== */
  const OAC = () => window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const renderOffline = oc => new Promise((res, rej) => {
    oc.oncomplete = e => res(e.renderedBuffer);
    const p = oc.startRendering();
    if (p && p.then) p.then(res, rej);
  });
  /** Float32 mono at `from` Hz → `to` Hz (OfflineAudioContext; linear interpolation if that is not possible) */
  async function resample(f32, from, to) {
    if (from === to) return f32;
    const len = Math.max(1, Math.ceil(f32.length * to / from));
    try {
      const oc = new (OAC())(1, len, to);
      const b = oc.createBuffer(1, f32.length, from);
      b.getChannelData(0).set(f32);
      const s = oc.createBufferSource(); s.buffer = b; s.connect(oc.destination); s.start(0);
      return (await renderOffline(oc)).getChannelData(0);
    } catch (e) {
      const out = new Float32Array(len), k = from / to;
      for (let i = 0; i < len; i++) { const x = i * k, a = Math.floor(x), f = x - a; out[i] = (f32[a] || 0) * (1 - f) + (f32[a + 1] || 0) * f; }
      return out;
    }
  }
  /** 16-bit PCM WAV, mono */
  function wavBytes(f32, rate) {
    const n = f32.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    const w = (o, s) => { for (let k = 0; k < s.length; k++) v.setUint8(o + k, s.charCodeAt(k)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0, o = 44; i < n; i++, o += 2) v.setInt16(o, Math.max(-1, Math.min(1, f32[i])) * 0x7fff, true);
    return buf;
  }
  /** soft edges (no clicks) + gentle loudness: quiet dialogue up to ×4, never clipping */
  function polish(f32, rate) {
    let peak = 0;
    for (let i = 0; i < f32.length; i++) { const a = Math.abs(f32[i]); if (a > peak) peak = a; }
    if (peak < 0.004) { const e = new Error('silent'); e.silent = true; throw e; }
    const g = Math.min(4, 0.89 / peak);
    const fade = Math.min(Math.round(rate * 0.012), f32.length >> 2);
    for (let i = 0; i < f32.length; i++) {
      const edge = Math.min(1, i / fade, (f32.length - 1 - i) / fade);
      f32[i] *= g * (fade ? Math.max(0, edge) : 1);
    }
    return f32;
  }

  const Clip = {
    mode: 'auto',        // auto: decode the file at once if it fits; 'capture': record the line while it plays (silently)
    _full: null,         // Promise<{ pcm: Int16Array (mono), rate }>
    decodeErr: null,
    reset() { this.mode = 'auto'; this._silentN = 0; this._full = null; this.decodeErr = null; this.stopCapture(); this._el = null; this._node = null; if (this._ctx) { try { this._ctx.close(); } catch (e) { /* ignore */ } } this._ctx = null; },
    /** called synchronously inside a click: Safari / Chrome allow sound only after a tap */
    prime() {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!this._ctx) { try { this._ctx = new Ctx(); } catch (e) { return; } }
      if (this._ctx.state === 'suspended') this._ctx.resume().catch(() => {});
    },
    fitsInMemory() {
      return st.media && st.media.size <= FULL_MAX_BYTES && (!st.dur || st.dur <= FULL_MAX_SEC);
    },
    /** the whole sound track, decoded once (mono, 16 kHz when the browser can do it) */
    full() {
      if (this._full) return this._full;
      const file = (st.stream && st.stream.blob) || st.media; // 🎵 a saved Telegram audio: its Blob
      this._full = (async () => {
        const buf = await U.readArrayBuffer(file);
        let oc;
        try { oc = new (OAC())(1, 1, SR); } catch (e) { oc = new (OAC())(1, 1, 44100); }
        const ab = await new Promise((res, rej) => {
          try { const p = oc.decodeAudioData(buf, res, rej); if (p && p.then) p.then(res, rej); } catch (e) { rej(e); }
        });
        const n = ab.length, chs = ab.numberOfChannels, pcm = new Int16Array(n);
        const data = []; for (let c = 0; c < chs; c++) data.push(ab.getChannelData(c));
        for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < chs; c++) s += data[c][i]; pcm[i] = Math.max(-1, Math.min(1, s / chs)) * 0x7fff; }
        return { pcm, rate: ab.sampleRate };
      })();
      this._full.catch(() => { /* handled by the caller */ });
      return this._full;
    },
    async fromFull(t0, t1) {
      const { pcm, rate } = await this.full();
      const a = Math.max(0, Math.floor(t0 * rate)), b = Math.min(pcm.length, Math.ceil(t1 * rate));
      if (b - a < rate * 0.1) { const e = new Error('silent'); e.silent = true; throw e; }
      const f = new Float32Array(b - a);
      for (let i = 0; i < f.length; i++) f[i] = pcm[a + i] / 0x7fff;
      return resample(f, rate, SR);
    },
    stopCapture() { if (this._stop) { try { this._stop(); } catch (e) { /* ignore */ } } },
    /** files that are too big / formats decodeAudioData refuses: play the line on a hidden element, record it, nothing is heard */
    async capture(t0, t1) {
      this.prime();
      const ctx = this._ctx;
      if (!ctx || !ctx.createScriptProcessor) throw new Error('nocapture');
      if (!this._el) {
        const el = this._el = document.createElement('audio');
        el.preload = 'auto'; el.playsInline = true; el.setAttribute('playsinline', ''); el.src = st.mediaUrl;
        this._node = ctx.createMediaElementSource(el);
      }
      const el = this._el;
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
      el.pause();
      if (el.readyState < 1) await new Promise((res, rej) => { el.addEventListener('loadedmetadata', res, { once: true }); el.addEventListener('error', () => rej(new Error('NotSupported')), { once: true }); setTimeout(res, 4000); });
      await new Promise(res => { const ok = () => { el.removeEventListener('seeked', ok); res(); }; el.addEventListener('seeked', ok); el.currentTime = t0; setTimeout(ok, 2500); });
      const proc = ctx.createScriptProcessor(4096, 2, 1);
      const mute = ctx.createGain(); mute.gain.value = 0;
      this._node.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
      const chunks = []; let on = false, total = 0;
      const rate = ctx.sampleRate;
      const want = (t1 - t0) * rate;
      await new Promise((resolve, reject) => {
        let fin = false;
        const finish = err => {
          if (fin) return; fin = true; this._stop = null;
          clearTimeout(guard); el.pause(); el.removeEventListener('playing', start);
          try { this._node.disconnect(proc); proc.disconnect(); mute.disconnect(); } catch (e) { /* ignore */ }
          err ? reject(err) : resolve();
        };
        const start = () => { on = true; };
        el.addEventListener('playing', start);
        proc.onaudioprocess = e => {
          if (!on) return;
          const ib = e.inputBuffer, n = ib.length, c0 = ib.getChannelData(0), c1 = ib.numberOfChannels > 1 ? ib.getChannelData(1) : c0;
          const m = new Float32Array(n);
          for (let i = 0; i < n; i++) m[i] = (c0[i] + c1[i]) / 2;
          chunks.push(m); total += n;
          if (total >= want || el.currentTime >= t1 || el.ended) finish();
        };
        const guard = setTimeout(() => finish(total ? null : new Error('timeout')), (t1 - t0) * 1000 + 6000);
        this._stop = () => finish(new Error('stopped'));
        el.playbackRate = 1;
        el.play().catch(err => finish(err));
      });
      const f = new Float32Array(Math.min(total, Math.ceil(want)));
      let o = 0; for (const c of chunks) { if (o >= f.length) break; f.set(c.subarray(0, f.length - o), o); o += c.length; }
      return resample(f, rate, SR);
    },
    /** → { audio: dataURL, sec, bytes, start, end } */
    async get(line) {
      if (!st.media) throw new Error('Нет видео или аудио — карточка без звука');
      if (this.mode === 'none') throw new Error(FORMAT_ERR);
      const dur = st.dur || Infinity;
      let t0 = Math.max(0, line.start + st.offset - PRE), t1 = Math.min(dur, line.end + st.offset + POST);
      if (t1 - t0 > CLIP_MAX) t1 = t0 + CLIP_MAX;
      if (t1 <= t0) throw new Error('Строка за пределами записи — проверьте сдвиг субтитров');
      let f;
      try {
        if (this.mode !== 'capture' && this.fitsInMemory()) {
          try { f = await this.fromFull(t0, t1); }
          catch (e) { if (e.silent) throw e; this.decodeErr = e; this.mode = 'capture'; this._full = null; }
        } else if (this.mode !== 'capture') this.mode = 'capture';
        if (!f) f = await this.capture(t0, t1);
        f = polish(f, SR);
      } catch (e) {
        const why = String((e && e.name) || '') + ' ' + String((e && e.message) || '');
        if (e.silent && !this.decodeErr) throw new Error('В этом месте записи тишина — карточка без звука (проверьте сдвиг субтитров)');
        if (/stopped/.test(why)) throw e;
        if (e.silent || this.decodeErr || /nocapture|NotSupported|decode|Encoding/i.test(why)) { this.mode = 'none'; throw new Error(FORMAT_ERR); }
        if (e && e.name === 'NotAllowedError') throw new Error('Браузер не дал записать звук строки — нажмите ещё раз (нужно касание экрана)');
        throw new Error('Звук строки вырезать не удалось — карточка без звука (' + (e.message || e.name) + ')');
      }
      const bytes = wavBytes(f, SR);
      const audio = await U.blobToDataURL(new Blob([bytes], { type: 'audio/wav' }));
      return { audio, sec: f.length / SR, bytes: bytes.byteLength, start: t0, end: t1 };
    },
  };

  /* =================== state =================== */
  let st = null;
  const fresh = () => ({
    m: null, stage: 'load', media: null, mediaUrl: '', kind: '', dur: 0, noFile: null, trFile: null, trLang: '',
    lines: [], cur: -1, loop: false, stopAt: null, playLine: -1, rate: savedRate(), offset: 0,
    trMode: localStorage.getItem('nk-subs-tr') || 'show', checked: new Set(), made: [], busy: false, cancel: false, userScrollT: 0,
    known: null, raf: 0, cleanup: [],
  });
  const lineT = (l, k) => l[k] + st.offset;

  /* ---------- new words (not in your cards yet) ---------- */
  function knownSet() {
    const k = new Set();
    Store.cards().forEach(c => {
      const no = String(c.no || '').split('\n')[0].toLowerCase().replace(/^(en|ei|et|å)\s+/, '');
      no.split(/[,/;]/).forEach(x => {
        x = x.trim(); if (!x) return;
        k.add(x);
        const ws = x.split(/\s+/);
        if (ws.length <= 3) ws.forEach(w => { w = bare(w); if (w && !/^(en|ei|et|å)$/.test(w)) k.add(w); });
      });
    });
    return k;
  }
  const ENDS = ['ene', 'ane', 'en', 'et', 'er', 'ere', 'est', 'ede', 'te', 'de', 'a', 'r', 'e', 's', 't', 'ne'];
  function isNewWord(w, k) {
    const b = bare(w), low = b.toLowerCase();
    if (low.length < 3 || /\d/.test(low) || (window.NoGloss && NoGloss.has(low))) return false;
    if (k > 0 && /^\p{Lu}/u.test(b)) return false;            // a name in the middle of a sentence
    const K = st.known;
    if (K.has(low)) return false;
    for (const e of ENDS) {
      if (low.length - e.length < 2 || !low.endsWith(e)) continue;
      const s = low.slice(0, -e.length);
      if (K.has(s) || K.has(s + 'e') || K.has(s + 'en')) return false;
    }
    return true;
  }
  function lineNew(l) {
    if (skipTr(l)) return new Set();
    if (l._new === undefined) { const t = String(l.text).split(/\s+/).filter(w => /\p{L}/u.test(w)), en = enLine(l); l._new = new Set(t.map((w, k) => (!en || (LID() && LangId.isNoWord(w, st.known))) && isNewWord(w, k) ? k : -1).filter(k => k >= 0)); }
    return l._new;
  }

  /* ---------- translation of the lines ---------- */
  const hasRuFile = () => st.trLang === 'ru';
  // yours ✓ (corrected / confirmed in the player or on a card) > the Russian subtitle file > the machine translation
  // a line not in the language being learned → '' (= nothing to translate: every «trOf(l) === undefined» check skips it)
  const trOf = l => (skipTr(l) ? '' : l.ruMine || (window.Study && Study.userSent ? Study.userSent(l.text) : undefined) || l.ruFile || (window.Study ? Study.sentTr(l.text) : undefined));

  /* ---------- 🌐 the line's language and music (js/langid.js) ----------
   * A live broadcast mixes languages: an English song on P3, a Swedish guest. Each line gets l.lang / l.music /
   * l.noWords; a line not in the learned language (nor a close neighbour: sv, da for Norwegian) is shown greyed with
   * a tag — no translation, no word glosses, no card (the free translators' quota is for Norwegian). «это норвежский —
   * перевести» (l.langOk) undoes it for one line. Music without words is one calm «🎵 Музыка» line. */
  const LID = () => window.LangId;
  const learnName = () => (LID() ? LangId.name(LangId.learn()) : 'норвежский');
  /** o: { asr (recognized by the app), music (a hint from the sound), prev ({lang} of the line just before) } */
  function tagLine(l, o = {}) {
    if (!LID() || !l || l.langOk || l.song) return l; // 🎵 a song line keeps the language decided when it was heard
    const r = LangId.detect(l.text, Object.assign({}, o, { music: !!(o.music || l.musicA) }));
    l.lang = r.lang; l.music = r.music; l.noWords = r.noWords; l.langWhy = r.why; l._new = undefined;
    return l;
  }
  /* 🇬🇧 English is a source language too: an English line (a teacher explaining Norwegian in English, an English song)
   * is translated from English, marked «EN»; the Norwegian words in it stay tappable (cards are made from them) */
  const enLine = l => !!l && !l.langOk && !l.noWords && l.lang === 'en';
  const srcOf = l => (enLine(l) ? 'en' : 'no');
  /** the words of this line can get «(перевод)» after them (Norwegian lines only) */
  const glOk = l => !!l && !l.noWords && !skipTr(l) && !enLine(l);
  function skipTr(l) { return !!l && !l.langOk && (!!l.noWords || (!!l.lang && l.lang !== 'en' && !!LID() && !LangId.translatable(l.lang))); }
  /** the line before (≤ 15 s): a foreign song goes on in its short leftovers («Oh baby») */
  const prevOf = (L, k) => { const p = L[k - 1]; return p && L[k].start - p.end < 15 && !p.noWords ? { lang: p.lang } : null; };
  /** stream lines (NRK / YouTube cues): tag them all; music lines in a row become one */
  function tagAll(asr) {
    const L = st.lines; if (!LID() || !L.length) return;
    L.forEach((l, k) => tagLine(l, { asr: asr || l.auto, prev: prevOf(L, k) }));
    for (let k = L.length - 1; k > 0; k--) {
      const a = L[k - 1], b = L[k];
      if (a.noWords && b.noWords && b.start - a.end < 20) { a.end = Math.max(a.end, b.end); L.splice(k, 1); }
    }
  }
  function tagHtml(l, i) {
    if (!l || !LID()) return '';
    if (l.songX) return `<span class="sl-tag mus song-x" title="Приложение услышало ${l.songSpeech ? 'речь' : 'пение'} не на норвежском и не на английском — слова не показываем и не переводим">${l.songSpeech ? `🗣 Говорят ${LangId.nameIn(l.songX)}` : `🎵 Звучит песня ${LangId.nameIn(l.songX)}`}</span>`;
    const song = !l.song ? '' : l.songSpeech
      ? `<span class="sl-tag song" title="Здесь нет субтитров — слова приложение распознало по звуку, в них возможны ошибки">🗣 Без субтитров (распознано по звуку, может быть неточно):</span> `
      : `<span class="sl-tag song" title="Здесь нет субтитров — слова песни приложение распознало по звуку, в пении их легко расслышать неверно">🎵 Песня (распознано по звуку, может быть неточно):</span> `;
    if (enLine(l)) return song + `<span class="sl-tag en" title="Строка на английском — переводим с английского. Норвежские слова в ней выделены: нажмите на слово — перевод и карточка">EN</span> `;
    if (l.noWords) return `<span class="sl-tag mus" title="Здесь звучит музыка без слов — переводить нечего">🎵 Музыка</span>`;
    const code = LangId.code(l.lang), nm = LangId.name(l.lang);
    if (skipTr(l)) {
      return `<span class="sl-tag xl" title="Похоже, это ${nm}${l.music ? ' (песня)' : ''} — строку не переводим и не разбираем по словам, чтобы не тратить лимит переводчика на чужой язык. Если это всё-таки ${learnName()} — нажмите «перевести».">${l.music ? '♪ ' : ''}${code} — не ${learnName()}, не переводим</span>`
        + ` <button type="button" class="sl-tagbtn" data-langok="${i}" title="Это ${learnName()}: перевести строку и разобрать по словам">это ${learnName()} — перевести</button> `;
    }
    const near = !l.langOk && l.lang && l.lang !== LangId.learn()
      ? `<span class="sl-tag near" title="Похоже, это ${nm} — он очень близок к языку, который вы учите, поэтому строку переводим">${code}</span> ` : '';
    return song + near + (l.music && !l.song ? `<span class="sl-tag song" title="Песня — переводим, как обычную речь">♪ песня</span> ` : '');
  }
  /** «это норвежский — перевести»: this line is translated and glossed after all */
  function langOk(i) {
    const l = st.lines[i]; if (!l) return;
    l.langOk = true; l._trFail = false; l._new = undefined; l._gl = false;
    redrawLine(i); musicHint();
    if (st.stream && st.stream.live) liveTrSoon();
    else translate([i]);
    if (st.trMode === 'word') glossNear(i);
  }
  /** 🎵 «Сейчас музыка…»: the newest line (live / recognized ahead) or the current one is music / a foreign song */
  function musicHint() {
    const el = st && st.m && st.m.$('[data-mhint]'); if (!el) return;
    const L = st.lines, live = st.stream && (st.stream.live || st.stream.autoAsr);
    const l = live ? L[L.length - 1] : L[st.cur];
    el.hidden = !(l && (l.noWords || (l.music && skipTr(l))));
  }
  function trByOf(l) {
    if (l.ruFile) return null;
    const c = window.Translators && Translators._trCache && Translators._trCache.get(srcOf(l) + '|ru|' + l.text);
    return c ? [c.id] : (Study._exBy && Study._exBy.length ? Study._exBy.slice() : ['google']);
  }
  /* ---------- 🌐 the lines' translation: in batches, the lines around the playing one first, cached for good ----------
   * A whole programme is never sent at once (that is what made Google refuse the address): the line playing now and
   * the next ~30 go first in ONE request, the rest follow in the background in parts of 60 with a pause between them —
   * only while Google (or a translator with a key) translates; while it rests, the spares (Mozhi, MyMemory, the
   * connected neural network — js/translators.js) translate just the lines around the playing one, so their small
   * free allowances last. Every translation goes into Study's 's:' cache (localStorage): the same programme opened
   * again costs no request at all.
   * A line waiting for its translation shows a soft shimmer; a line nobody could translate shows only the original,
   * and ONE calm line under the list says the translation will come a little later (with «🔄 Перевести снова»).
   * It is tried again by itself after a pause (1.5 → 3 → 6 … ≤ 10 minutes). */
  const TR_NEAR = 30, TR_PART = 60;
  const trWait = ms => new Promise(r => setTimeout(r, ms));
  const trQ = () => st.tq || (st.tq = { run: false, t: 0, retryT: 0, back: 0, all: false });
  /** this line still needs a translation (and is not waiting for its next try after a failure) */
  function trNeed(l) { return !!l && !l.ruFile && !skipTr(l) && trOf(l) === undefined && !(l._trFail && Date.now() < l._trFail); }
  /** the background (the whole programme) may go on: Google translates (itself or through the Mac bridge), or a
   *  translator with a key; «🌐 Перевести все» asks for it anyway */
  function trBgOk() {
    const T = window.Translators; if (!T) return false;
    return trQ().all || !T.gResting() || T.dictOrder().some(id => id === 'deepl' || id === 'microsoft');
  }
  /** the next part to translate: { idx, near } or null */
  function trPick() {
    const L = st.lines, n = L.length, c = Math.max(0, st.cur), live = st.stream && st.stream.live;
    const ids = [], add = (i, max) => { if (ids.length < max && trNeed(L[i]) && !ids.includes(i)) ids.push(i); };
    // urgent: the line now (or the newest lines on air) and the next ones — fetched with a margin of ~30 lines
    let urgent = false;
    for (let i = Math.max(0, c - 2); i < Math.min(n, c + 10) && !urgent; i++) urgent = trNeed(L[i]);
    if (live) for (let i = Math.max(0, n - 12); i < n && !urgent; i++) urgent = trNeed(L[i]);
    if (urgent) {
      if (live) for (let i = Math.max(0, n - 12); i < n; i++) add(i, 40);
      for (let i = Math.max(0, c - 3); i < Math.min(n, c + TR_NEAR); i++) add(i, 40);
      return ids.length ? { idx: ids, near: true } : null;
    }
    if (!trBgOk()) return null;
    for (let i = c; i < n; i++) add(i, TR_PART);
    for (let i = 0; i < c; i++) add(i, TR_PART);
    return ids.length ? { idx: ids, near: false } : null;
  }
  /** translate these lines in one go (several requests only for a long list) → how many are still without one */
  async function trBatch(idx) {
    const me = st, L = me.lines;
    const need = idx.filter(i => trNeed(L[i]) || (L[i] && L[i]._trFail && trOf(L[i]) === undefined && !L[i].ruFile && !skipTr(L[i])));
    // 🇬🇧 each line from its own language: Norwegian lines and English lines go in separate requests
    const groups = {};
    need.forEach(i => { const f = srcOf(L[i]); (groups[f] = groups[f] || new Set()).add(L[i].text); });
    const texts = [].concat(...Object.values(groups).map(g => [...g]));
    if (!texts.length) return 0;
    need.forEach(i => { L[i]._trWait = true; redrawLine(i); });
    // lines are drawn as their translations arrive (MyMemory answers line by line), unless someone else listens
    const T = Translators, mine = !T.onPut;
    let drawT = 0;
    if (mine) T.onPut = () => { if (drawT || st !== me) return; drawT = setTimeout(() => { drawT = 0; if (st !== me) return; need.forEach(i => { if (L[i]._trWait && trOf(L[i]) !== undefined) { L[i]._trWait = false; redrawLine(i); } }); }, 120); };
    const res = { out: [], by: [], missing: 0, error: '' };
    try {
      for (const [from, g] of Object.entries(groups)) {
        const part = [...g];
        let r; try { r = await T.translateMany(part, from, 'ru', { quiet: true, place: trPlace() }); } catch (e) { r = { out: [], by: [], missing: part.length, error: '' }; }
        part.forEach((t, k) => res.out.push(r.out && r.out[k] || ''));
        res.by.push(...(r.by || [])); res.missing += r.missing || 0; res.error = res.error || r.error || '';
        if (st !== me) break;
      }
    } finally { if (mine && T.onPut) T.onPut = null; clearTimeout(drawT); }
    // kept for good (Study's 's:' cache — the same as «По предложениям»); no answer = not saved, tried again later
    if (window.Study && Study.exCache) {
      const c = Study.exCache();
      texts.forEach((t, k) => { const v = res.out && res.out[k]; if (v) c['s:' + t] = String(v).trim(); });
      if (res.by && res.by.length) Study._exBy = [...new Set([...(Study._exBy || []), ...res.by])];
      try { Study.exSave(); } catch (e) { /* storage full — the session cache still has them */ }
    }
    if (st !== me) return 0;
    const q = trQ();
    let left = 0;
    need.forEach(i => {
      const l = L[i]; if (!l) return;
      l._trWait = false;
      if (trOf(l) === undefined) { left++; l._trFail = Date.now() + Math.min(600000, 90000 * Math.pow(2, q.back)); } else l._trFail = 0;
      redrawLine(i);
    });
    if (left && left === need.length) q.back = Math.min(q.back + 1, 3); else if (!left) q.back = 0;
    trStat();
    return left;
  }
  /** 🌐 where these translations belong — the «кто переводит» badge and the preferred translator are per place */
  function trPlace() {
    const S = st && st.stream;
    return !S ? 'subs:file' : S.kind === 'youtube' ? 'subs:youtube' : S.kind === 'tg' ? 'subs:tg' : S.radio ? 'subs:radio' : 'subs:nrk';
  }
  /** ONE «кто переводит» badge at the top of the window (js/trnotice.js) — only while the app translates the lines itself */
  function trBadge() {
    if (!st || !st.m || !window.TrBadge) return;
    const head = st.m.$('.modal-head'); if (!head) return;
    // (nothing to translate — a YouTube video without subtitles here: no «кто переводит» either)
    const nothing = !st.lines.length && st.stream && !st.stream.autoAsr && !st.stream.live;
    if (st.stage === 'player' && !hasRuFile() && !nothing) TrBadge.mount(head, { place: trPlace() }); else TrBadge.unmount(head);
  }
  /** start (or wake) the translation of the lines; ms: a small delay to gather several calls into one */
  function trKick(ms = 120) {
    if (!st || !st.m || hasRuFile() || !window.Translators) return;
    const q = trQ();
    clearTimeout(q.t);
    q.t = setTimeout(() => { q.t = 0; trRun(); }, ms);
  }
  async function trRun() {
    const me = st; if (!me || hasRuFile()) return;
    const q = trQ(); if (q.run) { q.again = true; return; }
    q.run = true; q.again = false;
    try {
      for (let guard = 0; guard < 400 && st === me; guard++) {
        const pick = trPick();
        if (!pick) { if (q.again) { q.again = false; continue; } break; }
        const left = await trBatch(pick.idx);
        if (st !== me) return;
        if (left === pick.idx.length) break; // nobody answered: a pause, then by itself again (below)
        if (!pick.near) await trWait(1500); // the background goes gently: a pause between parts
      }
      if (st !== me) return;
      if (q.all && !st.lines.some(l => trNeed(l))) q.all = false;
      // lines still waiting for their next try → wake up when the first of them may be asked again
      clearTimeout(q.retryT);
      let next = Math.min(...st.lines.filter(l => l._trFail && trOf(l) === undefined && !skipTr(l)).map(l => l._trFail));
      // Google's pause ends → the rest of the programme goes on by itself (even when the video stands still)
      if (Translators.gResting() && st.lines.some(l => trNeed(l))) next = Math.min(next, Translators._gCoolUntil + 1000);
      if (isFinite(next)) q.retryT = setTimeout(() => { if (st === me) trKick(0); }, Math.max(5000, next - Date.now() + 200));
    } finally { q.run = false; if (st === me) trStat(); }
  }
  /** «🔄 Перевести снова»: every line without a translation is tried at once (Google's own pause is kept) */
  function trRetry(all) {
    if (!st) return;
    const q = trQ(); q.back = 0; if (all) q.all = true;
    st.lines.forEach((l, i) => { if (l._trFail) { l._trFail = 0; redrawLine(i); } });
    // Google: one more try only near the end of its pause (asking earlier would only make the pause longer)
    if (Translators.gCooling() && Translators.gRestMin() <= 4) Translators.gUncool();
    ['mozhi', 'mymemory', 'deepl', 'microsoft'].forEach(id => { if (Translators.trRestMap && (Translators.trRestMap()[id] || 0) - Date.now() < 30 * 60000) Translators.trUnrest(id); });
    trKick(0);
  }
  /** ONE calm line under the list: some lines are still without a translation — it will come a little later */
  function trStat() {
    if (!st || !st.m) return;
    const el = st.m.$('[data-trstat]');
    if (window.TrNotice && st.stream) { try { TrNotice.badge(); } catch (e) { /* the player is redrawn */ } }
    if (!el) return;
    const n = hasRuFile() ? 0 : st.lines.filter(l => l._trFail && trOf(l) === undefined && !skipTr(l)).length;
    el.hidden = !n;
    if (!n) { el.innerHTML = ''; return; }
    const T = Translators, g = T.gRestMin();
    el.innerHTML = `<span class="ts-ico" aria-hidden="true">⏳</span><span class="ts-txt">Перевод ${n === 1 ? 'одной строки' : `${n} ${U.plural(n, ['строки', 'строк', 'строк'])}`} появится чуть позже: ${g ? `Google попросил сделать паузу примерно на ${g} ${U.plural(g, ['минуту', 'минуты', 'минут'])}, а запасные переводчики сейчас не отвечают` : 'переводчики сейчас не отвечают'}. Пока — только норвежский текст.</span>
      <button type="button" class="btn sm" data-trretry>🔄 Перевести снова</button>
      <button type="button" class="linklike tiny" data-trpick>другой переводчик…</button>`;
  }
  /** translate these lines now (a line marked «это норвежский», everything for the TV) → true when all have one */
  async function translate(idx) {
    const me = st;
    const need = idx.filter(i => st.lines[i] && !st.lines[i].ruFile && !skipTr(st.lines[i]) && trOf(st.lines[i]) === undefined);
    for (let k = 0; k < need.length && st === me; k += TR_PART) await trBatch(need.slice(k, k + TR_PART));
    return st === me && need.every(i => trOf(st.lines[i]) !== undefined);
  }
  /** the lines around what is playing / shown (called on every line change: cheap when they are there) */
  function prefetch() { if (st && !hasRuFile() && st.lines.length) trKick(); }

  /* =================== HTML =================== */
  function wordsHtml(l, i) {
    const tag = tagHtml(l, i);
    if (skipTr(l)) return tag + (l.noWords ? '' : `<span class="sl-xltext">${U.esc(l.text)}</span>`);
    return tag + wordsHtml0(l, i);
  }
  /** 🇬🇧 an English line: its English words are plain (they still light up with «Бегущая строка»), the Norwegian ones
   *  stay tappable words — highlighted, «new» ones underlined as usual */
  function enWordsHtml(l, i) {
    const nw = st.known ? lineNew(l) : new Set();
    let k = -1;
    return String(l.text).split(/(\s+)/).map(tok => {
      if (!/\p{L}/u.test(tok)) return U.esc(tok);
      k++;
      if (LID() && LangId.isNoWord(tok, st.known)) return `<span class="sw no-in-en${nw.has(k) ? ' new' : ''}" data-w="${U.esc(bare(tok))}" data-li="${i}" data-wi="${k}" title="Норвежское слово — нажмите: перевод и карточка">${U.esc(tok)}</span>`;
      return `<span class="sw-en" data-wi="${k}">${U.esc(tok)}</span>`;
    }).join('');
  }
  function wordsHtml0(l, i) {
    if (enLine(l)) return enWordsHtml(l, i);
    const nw = st.known ? lineNew(l) : new Set();
    // «слово (перевод)»: each word followed by its Russian (the same glosses as on the cards; loaded around the current line)
    // meaning first: the words follow the line's translation (the one shown under it)
    const gl = st.trMode === 'word' && window.Study ? cueText(l.text) : null;
    const ru = gl ? trOf(l) : undefined;
    let k = -1;
    return String(l.text).split(/(\s+)/).map(tok => {
      if (!/\p{L}/u.test(tok)) return U.esc(tok);
      k++;
      const r = gl ? Study.glossInfo(gl, k, ru || '') : null;
      const g = r && r.g && (Study.glossShow ? Study.glossShow(tok, r.g) : r.g); // short: «быть», not «быть (вспомогательный глагол)»
      const cls = r && r.how === 'guess' ? ' unsure' : r && r.how === 'user' ? ' mine' : '';
      const full = r && r.g && g !== r.g ? r.g + ' · ' : '';
      const tip = r && r.how === 'guess' ? ` title="${U.esc(full + Study.GUESS_TIP)}"` : r && r.how === 'user' ? ' title="ваш перевод ✓"' : full ? ` title="${U.esc(r.g)}"` : '';
      // 🪜 opt-in: a new word of the user's current / next level (js/levels.js) — coloured by its level
      const lv = nw.has(k) && window.Levels && Levels.subsOn() ? Levels.hit(bare(tok)) : '';
      return `<span class="sw${nw.has(k) ? ' new' : ''}${lv ? ' lv-hit lv-' + lv : ''}" data-w="${U.esc(bare(tok))}" data-li="${i}" data-wi="${k}"${lv ? ` title="Слово уровня ${lv} — его нет в ваших карточках"` : ''}>${U.esc(tok)}</span>${g ? `<span class="wbw-ru sw-gl${cls}" data-wi="${k}"${tip}>(${U.esc(g)}${r.how === 'guess' ? '?' : r.how === 'user' ? ' ✓' : ''})</span>` : ''}`;
    }).join('');
  }
  /**
   * «слово (перевод)»: every line, meaning first (the line is translated, then its words follow that translation) —
   * in the background, the lines around the current one first; a short status line under the controls shows how far
   * it is (no window in the way). Lines that arrive later (recognized speech) are picked up on the next line change.
   */
  function glossNear(i) {
    if (!st || st.trMode !== 'word' || !window.Study) return;
    st.glFocus = Math.max(0, i || 0);
    if (!st.glRun && !(st.glPause && Date.now() < st.glPause)) glossRun();
  }
  function glossProg(txt) { const el = st && st.m && st.m.$('[data-glprog]'); if (el) el.textContent = txt || ''; }
  async function glossRun() {
    const me = st; if (!me || me.glRun) return;
    me.glRun = true;
    const live = () => st === me && me.trMode === 'word';
    const ai = window.AI && AI.available();
    let did = 0;
    try {
      for (let guard = 0; guard < 5000 && live(); guard++) {
        const L = me.lines, f = Math.min(me.glFocus || 0, Math.max(0, L.length - 1));
        const order = [];
        for (let k = Math.max(0, f - 1); k < L.length; k++) order.push(k);
        for (let k = 0; k < Math.max(0, f - 1); k++) order.push(k);
        const batch = order.filter(k => !L[k]._gl && glOk(L[k])).slice(0, ai ? 16 : 24);
        if (!batch.length) break;
        const done = L.filter(l => l._gl && glOk(l)).length, all = L.filter(glOk).length;
        glossProg(`${ai ? AI.name() + ' переводит' : 'Перевожу'} слова по смыслу строки: ${Math.min(done, all)} из ${all}`);
        // the whole line first: its translation is what the words follow
        const need = [...new Set(batch.map(k => L[k]).filter(l => !l.ruFile && trOf(l) === undefined).map(l => l.text))];
        if (need.length) await Study.translateUnits(need, [], { quiet: true });
        if (!live()) break;
        if (need.length && Study._lastFail && need.every(t => Study.sentTr(t) === undefined)) { me.glPause = Date.now() + 60000; glossProg('⚠️ Перевод строк сейчас не приходит — слова переведу позже'); break; }
        await Study.translateUnits([], batch.map(k => ({ s: cueText(L[k].text), ru: trOf(L[k]) || '' })), { quiet: true, cancel: () => !live() });
        if (!live()) break;
        batch.forEach(k => { L[k]._gl = true; redrawLine(k); });
        did += batch.length;
      }
      if (live() && did) {
        glossProg('✓ Слова переведены по смыслу строки · «?» — перевод слова без контекста, нажмите на слово, чтобы исправить');
        setTimeout(() => { if (st === me && me.glRun === false) glossProg(''); }, 8000);
      }
    } catch (e) { /* the explicit buttons show the reason */ }
    me.glRun = false;
  }
  function trHtml(l) {
    if (skipTr(l)) return l.en ? `<span class="sl-en">${U.esc(l.en)}</span>` : '';
    const tr = trOf(l);
    // waiting: a soft shimmer; nobody could translate it yet: only the original (one calm line under the list says so)
    const ru = tr ? `<span class="sl-tr">(${U.esc(tr)})</span>` : hasRuFile() || !l._trWait ? '' : '<span class="sl-tr wait" role="img" aria-label="перевод загружается"><i class="sl-shim"></i></span>';
    return ru + (l.en ? `<span class="sl-en">${U.esc(l.en)}</span>` : '');
  }
  function lineHtml(l, i) {
    const made = l._made ? ' made' : '', nw = !l._made && st.known && lineNew(l).size ? ' has-new' : '';
    const xl = skipTr(l) ? (l.noWords ? ' xl mus' : ' xl') : '';
    return `<div class="subs-line${i === st.cur ? ' cur' : ''}${made}${nw}${xl}${l.frame ? ' ink' : ''}${enLine(l) ? ' en' : ''}${l.song ? ' song' : ''}" data-i="${i}">
      <label class="sl-chk" title="Отметить строку"><input type="checkbox" data-chk="${i}"${st.checked.has(i) ? ' checked' : ''}></label>
      <button class="sl-time" data-play="${i}" title="Проиграть только эту строку">${tLabel(lineT(l, 'start'))}</button>
      <div class="sl-body" data-play="${i}">${l.frame ? inkTag(l, true) + ' ' : ''}${l.auto && !l.song ? `<span class="sl-auto" title="Эту строку распознало приложение (в передаче нет субтитров) — в словах возможны ошибки">${BOT()}</span> ` : ''}<span class="sl-no">${wordsHtml(l, i)}</span> ${trHtml(l)}</div>
      <button class="icon-btn sm sl-add" data-add="${i}" ${xl ? 'disabled' : ''} title="${xl ? (l.noWords ? 'Музыка — карточку из неё не сделать' : `Строка не на языке, который вы учите, — карточку не делаем (если это ${learnName()} — нажмите «перевести»)`) : l._made ? 'Карточка уже есть — сделать ещё раз нельзя' : enLine(l) ? 'Норвежские слова этой английской строки → карточка (строка — как пример)' : 'Строка → карточка (со звуком этой строки)'}">${l._made ? '✓' : '➕'}</button>
    </div>`;
  }

  function loadHtml() {
    const slot = (k, ico, label, f, extra) => `<div class="subs-slot${f ? ' ok' : ''}" data-slot="${k}">
      <span class="ss-ico">${ico}</span>
      <span class="ss-txt"><b>${label}</b><small>${f ? U.esc(f.name) + (extra ? ' · ' + extra : '') : k === 'tr' ? 'необязательно: русские или английские субтитры того же видео' : k === 'media' ? 'mp4, webm, mov · mp3, m4a, wav, ogg' : '.srt, .vtt, .ass / .ssa'}</small></span>
      ${f ? `<button class="icon-btn sm" data-unset="${k}" title="Убрать">✕</button>` : ''}
      <button class="btn sm" data-pick="${k}">${f ? 'Заменить' : 'Выбрать…'}</button></div>`;
    return `<div class="subs-load">
      <div class="drop-zone subs-drop" data-drop>
        <div class="big">🎬</div>
        <b>Перетащите сюда видео (или аудио) и файл субтитров</b>
        <div class="small muted">Можно сразу оба файла. Или выберите их кнопками ниже.</div>
      </div>
      <div class="subs-slots">
        ${slot('media', '🎞', 'Видео или аудио', st.media, st.media ? kb(st.media.size) : '')}
        ${slot('no', '🇳🇴', 'Норвежские субтитры', st.noFile, st.noFile ? `${st.noLines} ${U.plural(st.noLines, ['строка', 'строки', 'строк'])}` : '')}
        ${slot('tr', '🇷🇺', 'Перевод (вторые субтитры)', st.trFile, st.trFile ? (st.trLang === 'ru' ? 'русский' : 'английский') : '')}
      </div>
      <div class="subs-note">${MediaIcons.icon('info', 18)} <span>${macBridge() ? `<b>Видео с YouTube и передачи NRK TV</b> открываются с субтитрами прямо в приложении — в разделах
        <a href="#" data-goto="youtube">YouTube</a> и <a href="#" data-goto="nrk">NRK TV</a>.` : '<b>Видео с YouTube</b> открываются прямо в приложении — в разделе <a href="#" data-goto="youtube">YouTube</a>; к ним можно добавить свой файл субтитров.'}
        Здесь — свои файлы: видео или аудио с компьютера / телефона и файл субтитров к нему (.srt, .vtt, .ass).
        Если русских субтитров нет — строки переведёт переводчик, как в режиме «По предложениям».</span></div>
      <div class="row subs-go"><span class="grow"></span>
        <button class="btn primary" data-open ${st.noFile ? '' : 'disabled'}>${st.media ? '▶ Открыть' : st.noFile ? '📄 Открыть без видео' : '▶ Открыть'}</button></div>
      <input type="file" data-in="media" accept="video/*,audio/*,.mkv,.m4a,.m4b,.opus,.flac" hidden>
      <input type="file" data-in="no" hidden>
      <input type="file" data-in="tr" hidden>
    </div>`;
  }

  /** the video in a 16:9 stage (always the whole width, never squeezed) + the subtitle layer and the bar for full screen */
  /** ▶ YouTube: its own player only — nothing of ours over it (YouTube API terms): no glass, no lines, no full screen of ours */
  const ytPlain = () => !!(st && st.stream && st.stream.kind === 'youtube');
  function stage(inner) {
    if (ytPlain()) return `<div class="subs-stage subs-stage-yt" data-stage>${inner}</div>`;
    return `<div class="subs-stage" data-stage>${inner}
        ${ocrOk() ? '<button type="button" class="subs-ocr-chip" data-k="ocr" data-ocr-chip hidden title="Прочитать надписи этого кадра и сделать из них карточки">🔎 Найти слова в кадре</button>' : ''}
        <div class="subs-glass-box" data-glass-box><div class="subs-glass" data-glass hidden>
          <span class="glass-grip" data-glass-grip title="Потяните — толще / тоньше" aria-hidden="true"></span>
          <span class="glass-tag"><span data-glass-peek title="Потяните — сдвинуть стекло; удерживайте — увидеть оригинал">▭ Надписи видео закрыты · 👁 удерживайте</span><button type="button" data-glass-off title="Убрать стекло" aria-label="Убрать стекло">✕</button></span>
        </div></div>
        <div class="subs-ov" data-ov aria-live="polite"></div>
        <div class="subs-cred" data-cred hidden aria-live="polite"></div>
        <button type="button" class="subs-fsbtn" data-k="full" data-fsbtn title="На весь экран — вместе с субтитрами и переводом (клавиша F или двойной щелчок по видео)" aria-label="На весь экран">⛶</button>
        <div class="subs-ovbar">
          <button class="media-btn sm" data-k="prev" title="Предыдущая строка (←)">${ico('prev')}</button>
          <button class="media-btn sm main" data-k="toggle" title="Пауза / продолжить (пробел)">${UI.icon('play', 18)}</button>
          <button class="media-btn sm" data-k="next" title="Следующая строка (→)">${ico('next')}</button>
          <button class="btn sm subs-loop${st.loop ? ' on' : ''}" data-k="loop" title="Повторять строку (R)">🔁</button>
          <button class="btn sm trc-btn" data-k="trpop" aria-haspopup="true" aria-expanded="false" title="Как показывать перевод: под строкой, по словам, размыт или скрыт">Aa <span class="trc-l">Перевод:</span> <b class="trc-t" data-trname>${trName(st.trMode).toLowerCase()}</b> <span aria-hidden="true">▾</span></button>
          ${Kar.btn('ov-kar')}
          ${rateSel('on-dark')}
          <button class="btn sm glass-btn" data-k="glass" aria-pressed="false" title="Закрыть надписи, впечатанные в видео, матовым стеклом">▭</button>
          ${inkBtn(true)}
          <button class="btn sm" data-k="subview" title="Вид субтитров: размер, цвета">Aa</button>
          ${bgBtn()}
          <span class="grow"></span>
          <button class="btn sm tv-btn" data-k="tv" title="Подключить к телевизору" aria-label="Подключить к телевизору">${UI.TV_SVG(18)}</button>
          <button class="btn sm primary" data-k="full">⤡ Выйти из полного экрана</button>
        </div>
      </div>`;
  }
  /** 🔲 the dark strip under OUR lines on the video — one switch (the same setting as in «Aa Вид субтитров» and on the TV) */
  const bgBtn = () => { const on = !!tvPrefs().bg;
    return `<button type="button" class="btn sm bg-btn${on ? ' on' : ''}" data-k="ovbg" aria-pressed="${on}" title="Подложка — тёмная полоса под нашими субтитрами на видео (включить / выключить). Без неё буквы с чёрной обводкой. Надписи, впечатанные в само видео, закрывает отдельная кнопка «▭ Закрыть надписи в видео»">🔲 Подложка</button>`; };
  /** under the video: layout (video left / right), full screen, TV */
  function viewBar() {
    const lay = layout();
    if (ytPlain()) return `<div class="subs-view">
        <span class="seg-mini sm subs-lay" role="group" aria-label="Где видео">
          <button data-lay="left" class="${lay === 'left' ? 'active' : ''}" title="Видео слева, субтитры справа">◧ Видео слева</button>
          <button data-lay="right" class="${lay === 'right' ? 'active' : ''}" title="Видео справа, субтитры слева">Видео справа ◨</button>
        </span>
        ${Kar.btn('kar-first')}${Kar.mini()}
        ${rateSel()}
        <button class="btn sm sv-btn" data-k="subview" title="Размер текста, размер перевода слов, цвета">Aa Вид субтитров</button>
        <button class="btn sm tv-btn" data-k="tv" title="Смотреть на телевизоре">${UI.TV_SVG(18)}<span>На телевизор</span></button>
      </div>`;
    return `<div class="subs-view">
        <span class="seg-mini sm subs-lay" role="group" aria-label="Где видео">
          <button data-lay="left" class="${lay === 'left' ? 'active' : ''}" title="Видео слева, субтитры справа">◧ Видео слева</button>
          <button data-lay="right" class="${lay === 'right' ? 'active' : ''}" title="Видео справа, субтитры слева">Видео справа ◨</button>
        </span>
        <button class="btn sm glass-btn ovwin-btn" data-k="ovwin" aria-pressed="true" title="Строка с переводом прямо на видео (как в YouTube) — включить / выключить">💬 Субтитры на видео</button>
        ${Kar.btn('kar-first')}${Kar.mini()}
        ${rateSel()}
        <button class="btn sm sv-btn" data-k="subview" title="Размер текста, размер перевода слов, цвета — на экране и на телевизоре">Aa Вид субтитров</button>
        ${bgBtn()}
        <button class="btn sm glass-btn" data-k="glass" aria-pressed="false" title="В видео впечатаны свои надписи? Закрыть их матовым стеклом">▭ Закрыть надписи в видео</button>
        ${inkBtn(false)}
        ${ocrOk() ? '<button class="btn sm ocr-btn" data-k="ocr" title="Пауза и прочитать надписи этого кадра: слова и фразы → карточки">🔎 Найти слова в кадре</button>' : ''}
        <button class="btn sm" data-k="full" title="Видео на весь экран, субтитры и перевод — поверх видео (F)">⛶ На весь экран</button>
        <button class="btn sm tv-btn" data-k="tv" title="Смотреть на телевизоре — с субтитрами и переводом">${UI.TV_SVG(18)}<span>На телевизор</span></button>
      </div>`;
  }
  /** where a stream comes from: YouTube · NRK TV · NRK Radio (podcasts too) */
  const brand = S => (S.kind === 'youtube' ? 'YouTube' : S.kind === 'tg' ? 'Telegram' : S.radio ? 'NRK Radio' : 'NRK TV');
  const brandIco = S => (S.kind === 'youtube' ? '▶' : S.kind === 'tg' ? '✈️' : S.radio ? '📻' : '📺');
  /** 🔎 the frame can be read (OCR): the picture comes from this site (Telegram through the bridge, own files) */
  const ocrOk = () => !!(window.FrameOcr && st && st.kind === 'video' && ((st.stream && (st.stream.kind === 'tg' || (st.stream.kind === 'nrk' && !st.stream.companion && !st.stream.audio))) || (!st.stream && st.media)));
  /** 📻 a radio channel / podcast: its picture and the sound player (no video stage) */
  const radioBox = S => `<div class="subs-radio">
      <div class="subs-radio-art">${S.poster ? `<img src="${U.esc(S.poster)}" alt="">` : `<span class="sr-ico" aria-hidden="true">${S.kind === 'tg' ? (S.voice ? '🎤' : '🎵') : '📻'}</span>`}
        <span class="sr-txt"><b>${U.esc(S.title)}</b>${S.channel ? `<small>${U.esc(S.channel)}</small>` : ''}${S.live ? '<span class="sr-live">● в эфире</span>' : ''}</span></div>
      <audio class="subs-media" data-media preload="auto" controls></audio>
    </div>`;
  /** 📡 live: where the player is (on air / behind) and «к прямому эфиру» */
  const liveBar = () => `<div class="subs-livebar" data-livebar><span class="lb-dot" aria-hidden="true"></span><span class="lb-pos" data-livepos>прямой эфир</span><span class="grow"></span>
      ${st.stream && st.stream.autoAsr ? '<button class="btn sm lb-dl" data-k="livedelay" aria-pressed="true" title="Эфир идёт на ≈40 секунд позже — приложение успевает распознать речь, и субтитры совпадают с голосом">⏱ Эфир с задержкой</button>' : ''}
      <button class="btn sm" data-k="golive" title="Перейти к тому, что идёт в эфире сейчас">⏭ К прямому эфиру</button></div>`;
  function playerHtml() {
    const nNew = st.lines.filter(l => !l._made && lineNew(l).size).length;
    const S = st.stream;
    // the row under the video (viewBar) has «🎤 Бегущая строка» next to «💬 Субтитры на видео»; without a picture — the row below
    const hasView = S ? !S.companion && !S.audio : !!(st.media && st.kind === 'video');
    const media = S && S.companion
      ? `${secondBox(S)}${secondBar()}
        <div class="subs-src"><span class="grow">📺 <b>${U.esc(S.title)}</b> · <span class="muted">второй экран к телевизору</span></span>
          <a class="btn sm ghost" href="${U.esc(S.link)}" target="_blank" rel="noopener" title="Открыть эфир в приложении или на сайте NRK TV">↗ Открыть в NRK</a></div>
        ${S.note ? `<div class="mt-warn ok subs-stream-note"><span>${MediaIcons.icon('info', 18)}</span><span>${S.note}</span></div>` : ''}`
      : S && S.audio
      ? `${radioBox(S)}${S.live ? liveBar() : ''}
        <div class="subs-src"><span class="grow small muted">${brandIco(S)} ${S.kind === 'tg' ? `${U.esc(S.channel || 'Telegram')}${S.author && S.author !== S.channel ? ' · ' + U.esc(S.author) : ''}${S.date ? ' · ' + U.esc(new Date(S.date).toLocaleDateString('ru-RU')) : ''}` : `${S.live ? 'прямой эфир' : 'выпуск'} ${brand(S)}`}</span>
          ${learnBtn()}${tvSource(S) ? `<button class="btn sm ghost tv-btn" data-k="tv" title="Слушать на телевизоре или колонке">${UI.TV_SVG(18)}<span>На ТВ / колонку</span></button>` : ''}${S.link ? `<a class="btn sm ghost" href="${U.esc(S.link)}" target="_blank" rel="noopener" title="Открыть в приложении или на сайте ${brand(S)}">↗ ${brand(S)}</a>` : ''}</div>
        ${S.note ? `<div class="mt-warn ${S.autoAsr ? '' : 'ok'} subs-stream-note"><span>${S.autoAsr ? BOT() : MediaIcons.icon('info', 18)}</span><span>${S.note}
          ${S.autoAsr ? `<span class="subs-asr-row"><button class="btn sm primary" data-asr-go>${BOT()} Создать субтитры и перевод</button><span class="small" data-asr-st></span></span>` : ''}</span></div>` : ''}`
      : S && S.kind === 'youtube' && !st.lines.length && S.note
      ? `${stage(`<iframe data-yt-frame src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(S.id)}?enablejsapi=1&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&cc_load_policy=0&fs=1&origin=${encodeURIComponent(location.origin)}${S.start ? '&start=' + Math.floor(S.start) : ''}" title="${U.esc(S.title)}" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`)}
        <div class="mt-warn ok subs-stream-note subs-yt-note"><span>${MediaIcons.icon('subtitles', 18)}</span><span>${S.note}</span></div>
        <div class="subs-src"><span class="grow">${brandIco(S)} <b>${U.esc(S.title)}</b>${S.channel ? ` · <span class="muted">${U.esc(S.channel)}</span>` : ''}</span>
          ${S.link ? `<a class="btn sm ghost" href="${U.esc(S.link)}" target="_blank" rel="noopener" title="Открыть в приложении или на сайте YouTube">${MediaIcons.icon('external', 16)} YouTube</a>` : ''}
          <button class="btn sm tv-btn" data-k="tv" title="Смотреть на телевизоре">${UI.TV_SVG(18)}<span>На телевизор</span></button></div>`
      : S
      ? `${stage(S.kind === 'youtube'
          ? `<iframe data-yt-frame src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(S.id)}?enablejsapi=1&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&cc_load_policy=0&fs=1&origin=${encodeURIComponent(location.origin)}${S.start ? '&start=' + Math.floor(S.start) : ''}" title="${U.esc(S.title)}" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`
          : `<video class="subs-media" data-media playsinline webkit-playsinline preload="auto" controls controlslist="nofullscreen" ${S.poster ? `poster="${U.esc(S.poster)}"` : ''}></video>`)}
        ${viewBar()}${S.live ? liveBar() : ''}
        <div class="subs-src"><span class="grow">${brandIco(S)} <b>${U.esc(S.title)}</b>${S.channel ? ` · <span class="muted">${U.esc(S.channel)}</span>` : ''}${S.kind === 'tg' && S.date ? ` · <span class="muted">${U.esc(new Date(S.date).toLocaleDateString('ru-RU'))}</span>` : ''}</span>
          ${learnBtn()}${S.link ? `<a class="btn sm ghost" href="${U.esc(S.link)}" target="_blank" rel="noopener" title="Открыть в ${S.kind === 'youtube' ? 'приложении или на сайте YouTube' : S.kind === 'tg' ? 'Telegram' : 'приложении или на сайте NRK TV'}">↗ ${S.kind === 'youtube' ? 'YouTube' : S.kind === 'tg' ? 'Telegram' : 'NRK TV'}</a>` : ''}</div>
        ${S.note ? `<div class="mt-warn ${S.autoAsr ? '' : 'ok'} subs-stream-note"><span>${S.autoAsr ? BOT() : MediaIcons.icon('info', 18)}</span><span>${S.note}
          ${S.autoAsr ? `<span class="subs-asr-row"><button class="btn sm primary" data-asr-go>${BOT()} Создать субтитры и перевод</button><span class="small" data-asr-st></span></span>
          <span class="subs-asr-row"><button class="btn sm glass-btn" data-k="glass" aria-pressed="false">▭ В видео видны свои надписи? Закрыть их стеклом</button></span>` : ''}</span></div>` : ''}`
      : st.media
      ? (st.kind === 'video'
        ? `${stage(`<video class="subs-media" data-media playsinline webkit-playsinline preload="auto" controls controlslist="nofullscreen" src="${U.esc(st.mediaUrl)}"></video>`)}${viewBar()}`
        : `<div class="subs-audio-art">🎧 <span>${U.esc(st.media.name)}</span></div><audio class="subs-media" data-media preload="auto" controls src="${U.esc(st.mediaUrl)}"></audio>`)
      : `<div class="subs-nomedia">📄 Только субтитры — без видео нельзя слушать строки и вырезать их звук. <button class="btn sm" data-files>🎞 Добавить видео / аудио</button></div>`;
    return `<div class="subs-wrap" data-lay="${layout()}">
      <div class="subs-left">
        ${media}
        <div class="subs-now" data-now></div>
        <div class="subs-mhint" data-mhint role="status" hidden>🎵 Сейчас музыка — строки появятся, когда начнут говорить</div>
        <div class="subs-ctrl">
          <button class="media-btn sm" data-k="prev" title="Предыдущая строка (←)">${ico('prev')}</button>
          <button class="media-btn sm main" data-k="toggle" title="Пауза / продолжить (пробел)">${UI.icon('play', 18)}</button>
          <button class="media-btn sm" data-k="next" title="Следующая строка (→)">${ico('next')}</button>
          <button class="btn sm subs-loop${st.loop ? ' on' : ''}" data-k="loop" title="Повторять текущую строку по кругу (R)">🔁 повторять строку</button>
          ${rateSel()}
          ${hasView ? '' : Kar.btn() + Kar.mini()}
          ${S ? '' : learnBtn()}
        </div>
        ${Kar.bar()}
        <div class="subs-ctrl2">
          <span class="small muted">Перевод:</span>
          <span class="seg-mini sm" data-trm role="group" aria-label="Перевод">${TR_MODES.map(([k, t, tip]) => `<button type="button" data-trmode="${k}" class="${st.trMode === k ? 'active' : ''}" aria-pressed="${st.trMode === k}" title="${tip}">${t}</button>`).join('')}</span>
          <span class="tiny muted subs-glprog" data-glprog role="status" aria-live="polite"></span>
          ${S && S.kind === 'youtube' ? '' : '<span class="tiny muted subs-glass-hint">работает с нашими субтитрами · надписи, впечатанные в видео, закройте <button type="button" class="linklike" data-k="glass">▭ стеклом</button></span>'}
          <span class="small muted subs-off" title="Если субтитры спешат или опаздывают">Сдвиг: <button class="btn sm ghost" data-off="-0.5">−</button><b data-offv>${fmtOff()}</b><button class="btn sm ghost" data-off="0.5">+</button></span>
        </div>
        <div class="tiny muted subs-keys">Клавиши: пробел — пауза · ← → — строка · R — повтор. Нажмите на слово — перевод; выделите несколько слов — перевод выделенного.</div>
        <div class="subs-made" data-made>${madeHtml()}</div>
      </div>
      <div class="subs-right">
        <div class="subs-tools">
          <input class="input subs-q" data-q placeholder="🔎 Найти в субтитрах" type="search">
          <button class="btn sm" data-sel="all" title="Поставить галочки на все строки — потом «➕ Отмеченные → карточки»">☑ Выбрать все строки</button>
          <button class="btn sm" data-sel="new" title="Отметить строки, где есть слова, которых нет в ваших карточках">🆕 С новыми словами</button>
          <button class="btn sm ghost" data-sel="none">Снять</button>
        </div>
        <div class="subs-tools">
          <button class="btn sm primary" data-bulk="checked" disabled>➕ Отмеченные → карточки</button>
          <button class="btn sm" data-bulk="new" ${nNew ? '' : 'disabled'} title="Каждая строка, в которой есть новое для вас слово, — отдельная карточка со звуком">➕ Все строки с новыми словами (${nNew})</button>
          ${hasRuFile() ? '' : '<button class="btn sm ghost" data-trall title="Перевести все строки сразу">🌐 Перевести все</button>'}
          <span class="small muted" data-cnt></span>
        </div>
        <div class="lv-subs" data-lv-subs hidden></div>
        <div class="subs-trstat" data-trstat role="status" aria-live="polite" hidden></div>
        <div class="subs-list" data-list>${st.lines.length ? st.lines.map(lineHtml).join('') : S && S.live ? `<div class="nrk-empty muted">${S.autoAsr ? BOT() + ' Здесь появятся строки эфира, которые распознает приложение, — с переводом. Нажмите ▶.' : `💬 Здесь появятся субтитры эфира NRK — с переводом.${S.companion ? '' : ' Нажмите ▶.'}`}</div>`
          : S && S.autoAsr ? `<div class="nrk-empty muted">${BOT()} Здесь появятся строки, которые распознает приложение, — с переводом.</div>` : ''}</div>
        <div class="subs-credwrap" data-credits ${st.cred && st.cred.list.length ? '' : 'hidden'}>${Cred.blockHtml()}</div>
        <div class="tiny muted subs-foot">🃏 Колода: <b>${U.esc(deckName())}</b> · строк: <span data-nlines>${st.lines.length}</span> · <span class="sw new">так</span> подчёркнуты слова, которых ещё нет в ваших карточках${S ? '' : ' · <button class="btn sm ghost" data-files>📂 Другие файлы</button>'}</div>
      </div>
    </div>`;
  }
  function ico(n) {
    const P = { prev: '<path d="M6 5v14"/><path d="M18 5 9 12l9 7z" fill="currentColor"/>', next: '<path d="M18 5v14"/><path d="M6 5l9 7-9 7z" fill="currentColor"/>' };
    return `<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
  }
  const fmtOff = () => (st.offset > 0 ? '+' : st.offset < 0 ? '−' : '') + Math.abs(st.offset).toFixed(1).replace('.', ',') + ' с';
  function madeHtml() {
    if (!st.made.length) return '';
    return `<div class="sm-title">🃏 Созданные карточки <span class="muted">(${st.made.length})</span>
        ${st.deckId ? `<button class="btn sm ghost" data-deck title="Открыть колоду">открыть колоду →</button>` : ''}</div>
      ${st.made.slice(-6).reverse().map(c => `<div class="subs-card">
        <div class="sc-no">${U.esc(c.no)}</div>
        <div class="sc-ru">${U.esc(c.ru || '—')}</div>
        <div class="sc-desc tiny muted">${U.esc(c.description)}</div>
        ${c.audio ? `<div class="sc-audio"><audio controls preload="metadata" src="${U.esc(c.audio)}"></audio><span class="tiny muted">${U.esc(c._clipInfo || '')}</span></div>` : `<div class="tiny muted">🔇 без звука${c._clipErr ? ': ' + U.esc(c._clipErr) : ''}</div>`}
      </div>`).join('')}`;
  }
  function drawNow() {
    if (!st || !st.m) return;
    NativeSubs.sync(); // the system's own full screen (iPhone, Safari): our lines as the video's text track
    const box = st.m.$('[data-now]'); if (!box) return;
    const l = st.lines[st.cur];
    // full screen: the same line over the video (words tappable, translation obeys «виден / размыт / скрыт»)
    const ov = st.m.$('[data-ov]'), comp = !!(st.stream && st.stream.companion);
    if (ov) ov.innerHTML = l && (st.full || ovOn() || comp) ? (l.frame ? inkBox(l, st.cur) : `<div class="ov-box${l.song ? ' song' : ''}"><div class="ov-no">${l.auto && !l.song ? `<span class="sl-auto">${BOT()}</span> ` : ''}${wordsHtml(l, st.cur)}</div><div class="ov-ru">${trHtml(l)}</div></div>`)
      + (comp ? `<div class="s2-act"><button class="btn sm primary" data-add="${st.cur}" ${l._made || skipTr(l) ? 'disabled' : ''}>${l._made ? '✓ уже в карточках' : '➕ Строка → карточка'}</button></div>` : '')
      : comp && !LiveSubs.quiet ? `<div class="s2-wait">${st.lines.length ? 'Сейчас по телевизору говорят без субтитров — следующая строка появится здесь' : '<span class="spinner sm"></span> Строки эфира появятся здесь через несколько секунд…'}</div>` : '';
    posFit(); // ⊞ a new line: the big / side looks find the size that fits
    if (!l) { box.innerHTML = `<div class="sn-empty muted">${st.lines.length ? 'Нажмите ▶ или на строку в списке' : ''}</div>`; Kar.bind(); return; }
    box.innerHTML = `${l.frame ? `<div class="sn-ink">${inkTag(l, true)}</div>` : ''}<div class="sn-no">${wordsHtml(l, st.cur)}</div><div class="sn-tr">${trHtml(l)}</div>
      <div class="sn-act"><button class="btn sm" data-play="${st.cur}" title="Ещё раз эту строку">↺ ещё раз</button>
      <button class="btn sm primary" data-add="${st.cur}" ${l._made || skipTr(l) ? 'disabled' : ''}>${l._made ? '✓ уже в карточках' : '➕ Строка → карточка'}</button></div>`;
    Kar.bind(); // 🎤 the words of the new line light up as they are said
  }
  function redrawLine(i) {
    if (!st || !st.m) return;
    const row = st.m.$(`.subs-line[data-i="${i}"]`);
    if (row) row.outerHTML = lineHtml(st.lines[i], i);
    if (i === st.cur) drawNow();
  }
  /** after a ✎ correction (here or on a card): the lines with this text — or all — show it at once; a corrected line
   *  translation also gets its words distributed again (they follow the new translation) */
  function redrawText(t) {
    if (!st || !st.m) return;
    const key = t ? String(t).replace(/\s+/g, ' ').trim() : null;
    let again = false;
    st.lines.forEach((l, i) => {
      const hit = !key || cueText(l.text) === key || String(l.text).replace(/\s+/g, ' ').trim() === key;
      if (!hit) return;
      if (key) { l._gl = false; again = true; }
      redrawLine(i);
    });
    if (again && st.trMode === 'word') glossNear(Math.max(0, st.cur));
  }
  function countSel() {
    if (!st || !st.m) return;
    const n = st.checked.size;
    const c = st.m.$('[data-cnt]'); if (c) c.textContent = n ? `отмечено: ${n}` : '';
    const b = st.m.$('[data-bulk="checked"]'); if (b) { b.disabled = !n || st.busy; b.textContent = `➕ Отмеченные → карточки${n ? ` (${n})` : ''}`; }
  }

  /* =================== player =================== */
  // a YouTube video plays in its own frame: st.yt is an object that behaves like a <video> (see ytMedia)
  // 📱 the second screen has no video at all: st.clk is a clock that behaves like one (see clockMedia)
  const media = () => st && (st.yt || st.clk || (st.m && st.m.$('[data-media]')));

  /* ---------- ▶ YouTube inside the app: IFrame API wrapped to look like a <video> ---------- */
  let ytApi = null;
  function loadYT() {
    if (window.YT && YT.Player) return Promise.resolve();
    if (!ytApi) ytApi = new Promise((res, rej) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { try { if (prev) prev(); } catch (e) { /* ignore */ } res(); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { ytApi = null; rej(new Error('YouTube не загрузился — проверьте интернет')); };
      document.head.appendChild(s);
      setTimeout(() => rej(new Error('YouTube не отвечает')), 20000);
    });
    return ytApi;
  }
  const YT_ERR = { 2: 'неверная ссылка на видео', 5: 'это видео не играет во встроенном плеере', 100: 'видео удалено или скрыто', 101: 'автор запретил показывать видео в других приложениях', 150: 'автор запретил показывать видео в других приложениях', 152: 'YouTube не разрешил встроенный показ', 153: 'YouTube не разрешил встроенный показ' };
  function ytMedia(iframe, url) {
    const ev = {};
    const fire = t => (ev[t] || []).slice().forEach(f => { try { f(); } catch (e) { /* ignore */ } });
    let p = null, ready = false, state = -1, rate = 1, seek = null, want = false, lastT = 0, lastAt = 0;
    const a = {
      src: url, videoWidth: 1, readyState: 0, errMsg: '',
      get currentTime() {
        if (!ready) return seek || 0;
        const t = +p.getCurrentTime() || 0, now = performance.now();
        if (t !== lastT) { lastT = t; lastAt = now; return t; }
        // the frame reports the time a few times a second: in between, count on (smooth line highlighting)
        return state === 1 ? t + Math.min(0.6, (now - lastAt) / 1000 * rate) : t;
      },
      set currentTime(v) { v = Math.max(0, +v || 0); if (ready) { p.seekTo(v, true); lastT = v; lastAt = performance.now(); } else seek = v; setTimeout(() => fire('seeked'), 60); },
      get paused() { return !(state === 1 || state === 3 || (want && state !== 2 && state !== 0 && state !== 5)); },
      get duration() { return ready ? +p.getDuration() || NaN : NaN; },
      get playbackRate() { return rate; },
      set playbackRate(r) { rate = r; if (ready) { try { p.setPlaybackRate(r); } catch (e) { /* not supported */ } } },
      play() { want = true; if (ready) p.playVideo(); return Promise.resolve(); },
      pause() { want = false; if (ready) { try { p.pauseVideo(); } catch (e) { /* gone */ } } },
      addEventListener(t, f, o) {
        if (o && o.once) { const g = () => { ev[t] = (ev[t] || []).filter(x => x !== g); f(); }; (ev[t] = ev[t] || []).push(g); }
        else (ev[t] = ev[t] || []).push(f);
      },
      removeEventListener(t, f) { ev[t] = (ev[t] || []).filter(x => x !== f); },
      removeAttribute() { /* <video> compatibility */ }, load() { /* idem */ },
      destroy() { try { if (p) p.destroy(); } catch (e) { /* gone */ } },
    };
    loadYT().then(() => {
      if (!iframe.isConnected) return;
      p = new YT.Player(iframe, {
        events: {
          onReady: () => {
            ready = true; a.readyState = 4;
            if (seek != null) p.seekTo(seek, true);
            try { p.setPlaybackRate(rate); } catch (e) { /* ignore */ }
            fire('loadedmetadata');
            if (want) p.playVideo();
          },
          onStateChange: e => {
            state = e.data;
            if (state === 1) { lastAt = performance.now(); fire('play'); }
            else if (state === 2 || state === 0) { want = false; fire('pause'); }
          },
          onError: e => { a.errMsg = YT_ERR[e.data] || 'видео не воспроизводится (' + e.data + ')'; fire('error'); },
        },
      });
    }).catch(err => { a.errMsg = U.niceErr(err); fire('error'); });
    return a;
  }

  /* ---------- 📺 NRK TV: plain HLS — Safari plays it itself, other browsers through hls.js ---------- */
  let hlsLib = null;
  function loadHls() {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (!hlsLib) hlsLib = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js';
      s.onload = () => (window.Hls ? res(window.Hls) : rej(new Error('плеер видео не загрузился')));
      s.onerror = () => { hlsLib = null; rej(new Error('плеер видео не загрузился — проверьте интернет')); };
      document.head.appendChild(s);
    });
    return hlsLib;
  }
  function attachHls(v, url) {
    // Chrome now also answers «maybe» for HLS, but its own HLS player fails on NRK streams (PIPELINE_ERROR_DECODE,
    // tested Chrome 157 on a Mac) — so native HLS only in Safari / iPhone (or where there is no MediaSource for hls.js)
    const ua = navigator.userAgent, safari = /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg|OPR|Android/.test(ua);
    // (own subtitles read the program's sound from NRK themselves — see Asr.stream — so native HLS is fine in Safari)
    noNativeSubs(v);
    if (v.canPlayType('application/vnd.apple.mpegurl') && (safari || !window.MediaSource)) { st.hlsNative = true; v.src = url; return; }
    loadHls().then(Hls => {
      if (!st || !v.isConnected) return;
      if (!Hls.isSupported()) { v.src = url; return; }
      // our overlay draws the lines: hls.js must not show (or even fetch) the stream's own subtitle / CEA-608 tracks
      const h = st.hls = new Hls({ maxBufferLength: 30, subtitleDisplay: false, renderTextTracksNatively: false, enableCEA708Captions: false });
      h.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (e, d) => { if (d && d.id !== -1) h.subtitleTrack = -1; });
      let tries = 0;
      h.on(Hls.Events.ERROR, (e, d) => {
        if (!d || !d.fatal || !st || st.hls !== h) return;
        // a long pause or a short network drop must not throw the viewer out: continue quietly from the same place,
        // and if NRK's stream address has expired meanwhile — ask NRK for a fresh one. Only after all that it says so.
        tries++;
        if (d.type === Hls.ErrorTypes.MEDIA_ERROR && tries <= 2) { h.recoverMediaError(); return; }
        if (tries <= 2) { setTimeout(() => { if (st && st.hls === h) try { h.startLoad(v.currentTime); } catch (err) { /* next try */ } }, 900 * tries); return; }
        if (tries <= 4 && streamReload(v)) return;
        if (d.details) console.warn('NRK stream:', d.details);
        st.streamErr = 'поток NRK сейчас не загружается — проверьте интернет и попробуйте ещё раз'; v.dispatchEvent(new Event('error'));
      });
      h.on(Hls.Events.FRAG_LOADED, () => { tries = 0; });
      // live: the wall clock of a piece (#EXT-X-PROGRAM-DATE-TIME) − its place on the player's timeline
      const clk = (e, d) => { const f = d && d.frag; if (st && st.hls === h && f && f.programDateTime && Live.on()) Live.setOff(f.programDateTime / 1000 - f.start); };
      h.on(Hls.Events.FRAG_BUFFERED, clk); h.on(Hls.Events.FRAG_CHANGED, clk);
      if (st.resumeAt) h.once(Hls.Events.MANIFEST_PARSED, () => { if (st && st.resumeAt) { v.currentTime = st.resumeAt; st.resumeAt = 0; } });
      h.loadSource(url); h.attachMedia(v);
    }).catch(err => { if (st) { st.streamErr = U.niceErr(err); v.dispatchEvent(new Event('error')); } });
  }
  /** the video's own text tracks (HLS subtitle renditions, CEA-608) stay off — our overlay shows the lines; Safari may
   *  switch one on by itself (AUTOSELECT / the system's «subtitles + SDH» setting), so this holds on addtrack / change too.
   *  (Lines burned into NRK's picture — e.g. Kodeknekkerne season 2 — are pixels: no track, nothing to switch off.) */
  function noNativeSubs(v) {
    const T = v.textTracks;
    if (!T || v._noNativeSubs) return;
    v._noNativeSubs = true;
    // (except OUR track — the lines for the system's own full screen, see NativeSubs)
    const off = () => { for (let i = 0; i < T.length; i++) if (T[i].mode !== 'disabled' && !T[i]._nk && T[i] !== v._nkTrack) T[i].mode = 'disabled'; };
    if (T.addEventListener) { T.addEventListener('addtrack', off); T.addEventListener('change', off); }
    off();
  }
  /** the stream again from the same place (after a long pause NRK's address may have expired) → true if it tries */
  function streamReload(v) {
    const S = st && st.stream; if (!S || !S.hls || st.reloading) return false;
    st.reloading = true;
    const t = v.currentTime || 0, play = !v.paused;
    (async () => {
      let url = S.hls;
      try { if (S.fresh) url = (await S.fresh()) || url; } catch (e) { /* the old address once more */ }
      if (!st || st.stream !== S || !v.isConnected) return;
      S.hls = url; st.resumeAt = S.live ? 0 : t;
      if (S.live) st.liveResume = Live.clock(t) || 0; // the new stream may have a new timeline (Live.setOff)
      if (st.hls) { try { st.hls.destroy(); } catch (e) { /* gone */ } st.hls = null; }
      if (st.hlsNative) {
        v.src = url;
        v.addEventListener('loadedmetadata', () => { if (st && st.resumeAt) { v.currentTime = st.resumeAt; st.resumeAt = 0; } }, { once: true });
      } else attachHls(v, url);
      if (play) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
      if (st.castInfo) st.castInfo.url = url; // the TV gets the fresh address too if it ever needs to start again
    })().finally(() => { setTimeout(() => { if (st) st.reloading = false; }, 4000); });
    return true;
  }
  /* ---------- 📡 live (NRK live channels, NRK Radio live): the wall clock ↔ the player's time ----------
   * A live stream has no fixed start: the player's time is «seconds since the oldest piece it saw» (hls.js) or Safari's
   * own. What comes with the stream (NRK's live subtitles, our recognized lines) is placed by the WALL CLOCK:
   * wall = currentTime + st.liveOff. hls.js: #EXT-X-PROGRAM-DATE-TIME of a piece − its start; Safari: getStartDate()
   * (snapped to the playlist's own clock). A fresh stream address (after a long pause) may start a new timeline —
   * then the lines move with it (Live.setOff). */
  const HLS_W = 8589934592 / 90000; // the MPEG-TS clock (33 bits, 90 kHz) wraps every ≈ 26.5 h
  /** a media playlist (a master → its smallest variant: the sound is the same in all) → { url, segs, target, ended } */
  async function mediaPlaylist(url) {
    const get = async u => { const r = await fetch(u, { cache: 'no-store' }); if (!r.ok) throw new Error('поток ' + r.status); return r.text(); };
    let base = url, text = await get(url);
    if (/#EXT-X-STREAM-INF/.test(text)) {
      const vars = []; const ls = text.split(/\r?\n/);
      ls.forEach((l, k) => { if (/^#EXT-X-STREAM-INF/.test(l)) { const bw = +((l.match(/BANDWIDTH=(\d+)/) || [])[1] || 9e9); const u = (ls.slice(k + 1).find(x => x && !x.startsWith('#')) || '').trim(); if (u) vars.push({ bw, u }); } });
      vars.sort((a, b) => a.bw - b.bw);
      if (!vars.length) throw new Error('нет потока');
      base = new URL(vars[0].u, url).href; text = await get(base);
    }
    return parseMedia(text, base);
  }
  /** segs: [{ url, seq, pdt (wall clock, s), start (from the playlist's beginning), dur }] */
  function parseMedia(text, base) {
    const segs = []; let t = 0, dur = 0, seq = 0, pdt = NaN, target = 4;
    text.split(/\r?\n/).forEach(l => {
      if (l.startsWith('#EXT-X-MEDIA-SEQUENCE:')) seq = parseInt(l.slice(22), 10) || 0;
      else if (l.startsWith('#EXT-X-TARGETDURATION:')) target = parseFloat(l.slice(22)) || 4;
      else if (l.startsWith('#EXT-X-PROGRAM-DATE-TIME:')) { const p = Date.parse(l.slice(25).trim()); pdt = isFinite(p) ? p / 1000 : NaN; }
      else if (l.startsWith('#EXTINF:')) dur = parseFloat(l.slice(8)) || 0;
      else if (l && !l.startsWith('#')) { segs.push({ url: new URL(l.trim(), base).href, seq, pdt, start: t, dur }); t += dur; seq++; if (isFinite(pdt)) pdt += dur; }
    });
    return { url: base, segs, target, ended: /#EXT-X-ENDLIST/.test(text) };
  }
  /** MPEG-TS bytes → the earliest presentation time of its first PES packets (seconds of the 90 kHz clock) */
  function tsPts(u8) {
    let best = Infinity, n = 0;
    for (let o = 0; o + 188 <= u8.length && n < 12; o += 188) {
      if (u8[o] !== 0x47 || !(u8[o + 1] & 0x40)) continue;
      const afc = (u8[o + 3] >> 4) & 3; let p = o + 4;
      if (afc === 2 || afc === 0) continue;
      if (afc === 3) p += 1 + u8[p];
      if (p + 14 > o + 188 || u8[p] !== 0 || u8[p + 1] !== 0 || u8[p + 2] !== 1) continue;
      const sid = u8[p + 3]; if (!((sid >= 0xC0 && sid <= 0xEF))) continue;
      if (!(u8[p + 7] & 0x80)) continue;
      const pts = ((u8[p + 9] >> 1) & 7) * 1073741824 + (u8[p + 10] << 22) + ((u8[p + 11] >> 1) << 15) + (u8[p + 12] << 7) + (u8[p + 13] >> 1);
      best = Math.min(best, pts / 90000); n++;
    }
    return best;
  }
  /* MP3 frames (MPEG-1 Layer III — NRK's podcasts: 192 kbit/s, 48 kHz): a piece of the file is cut on whole frames */
  const MP3_BR = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], MP3_SR = [44100, 48000, 32000];
  function mp3Hdr(u8, k) {
    if (k + 4 > u8.length || u8[k] !== 0xff || (u8[k + 1] & 0xfe) !== 0xfa) return null;
    const bi = u8[k + 2] >> 4, si = (u8[k + 2] >> 2) & 3;
    if (!bi || bi === 15 || si === 3) return null;
    return { kbps: MP3_BR[bi], sr: MP3_SR[si], len: Math.floor(144000 * MP3_BR[bi] / MP3_SR[si]) + ((u8[k + 2] >> 1) & 1) };
  }
  /** the first frame that is followed by two more (not a stray 0xFFF in the sound data) … the end of the last whole one */
  function mp3Frames(u8) {
    let k = 0;
    for (; k + 4 < u8.length; k++) { const h = mp3Hdr(u8, k), h2 = h && mp3Hdr(u8, k + h.len); if (h2 && mp3Hdr(u8, k + h.len + h2.len)) break; }
    let e = k, n = 0;
    for (;;) { const h = mp3Hdr(u8, e); if (!h || e + h.len > u8.length) break; e += h.len; n++; }
    return { k, e, n };
  }
  const clockOf = t => new Date(t * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  /** a line's time as shown: live — the time of day it was said (on air); otherwise minutes:seconds */
  const tLabel = t => (st && st.stream && st.stream.live && st.liveOff ? clockOf(t + st.liveOff) : mss(t));
  const Live = {
    on: () => !!(st && st.stream && st.stream.live),
    waiters: [],
    clock(t) { return st && st.liveOff ? t + st.liveOff : NaN; },
    /** Safari reports its start date to ~0.1–1 s: the playlist's own moment closest to it is the exact one */
    snap(x) { let best = x, bd = 1.7; (st.livePdt || []).forEach(p => { const d = Math.abs(p - x); if (d < bd) { bd = d; best = p; } }); return best; },
    ready() { return new Promise(r => { if (st && st.liveOff) r(); else this.waiters.push(r); }); },
    setOff(o) {
      if (!st || !isFinite(o) || o < 1e9) return;
      const old = st.liveOff, same = old && Math.abs(o - old) < 1; // the same timeline (pieces' clocks jitter by a few ms)
      if (!same) {
        st.liveOff = o;
        if (old) this.shift(old - o);
        const w = this.waiters; this.waiters = []; w.forEach(f => f());
      }
      if (st.liveResume) { const v = media(), at = st.liveResume - st.liveOff; st.liveResume = 0; if (v && at > 0) { try { v.currentTime = at; } catch (e) { /* not seekable yet */ } } }
      if (!same) LiveSubs.flush();
    },
    /** a new timeline (a fresh stream address): everything placed by time moves by d seconds (the wall clock stays) */
    shift(d) {
      st.lines.forEach(l => { l.start += d; l.end += d; });
      if (Asr.segs) Asr.segs.forEach(s => { s.start += d; });
      if (Asr.acc) Asr.acc.t0 += d;
      (Asr.rec || []).forEach(r => { r[0] += d; r[1] += d; });
      Asr.upTo += d;
      tick();
    },
    /** Safari plays HLS itself: its start date gives the clock (hls.js reports it from the playing piece — attachHls) */
    measure(v) {
      if (!this.on() || !v || !st.hlsNative || !v.getStartDate) return;
      const d = +v.getStartDate();
      if (isFinite(d) && d > 1e12) this.setOff(this.snap(d / 1000));
    },
    edge(v) {
      const h = st.hls, s = v.seekable;
      if (h && isFinite(h.liveSyncPosition) && h.liveSyncPosition > 0) return h.liveSyncPosition;
      return s && s.length ? s.end(s.length - 1) : v.currentTime;
    },
    /** ⏭ to what is on air now */
    go() {
      const v = media(); if (!v) return;
      st.stopAt = null; st.playLine = -1;
      if (st.clk) { Second.live(); return; } // 📱 second screen: back to the TV's delay
      AsrGate.goLive(); // 🤖 «Догнать эфир»: no more delay for the recognized lines (they come when ready)
      try { v.currentTime = Math.max(0, this.edge(v) - 0.5); } catch (e) { /* not loaded yet */ }
      const p = v.play(); if (p && p.catch) p.catch(() => {});
      setTimeout(() => this.bar(), 300);
    },
    /** «в прямом эфире» / «−2:15 от эфира · 18:42:07» + the ⏭ button lights up when behind */
    bar() {
      const v = media(); if (!v || !st || !st.m) return;
      if (st.clk) { Second.bar(); return; }
      this.measure(v);
      const el = st.m.$('[data-livepos]'); if (!el) return;
      const behind = Math.max(0, this.edge(v) - v.currentTime), at = this.clock(v.currentTime);
      const onAir = behind < 8;
      const dl = AsrGate.delayed(); // ⏱ on purpose: «эфир −40 с» while the app recognizes ahead
      el.innerHTML = (dl && !onAir ? `<b class="lb-delay">эфир −${behind < 100 ? Math.round(behind) + ' с' : mss(behind)}</b> <span class="muted">· субтитры успевают</span>` : onAir ? (v.paused ? 'эфир на паузе' : '<b>в прямом эфире</b>') : `<b>−${mss(behind)}</b> от эфира`) + (isFinite(at) ? ` · ${clockOf(at)}` : '');
      const box = st.m.$('[data-livebar]'); if (box) box.classList.toggle('behind', !onAir || v.paused);
      st.m.$$('[data-k="golive"]').forEach(b => { b.classList.toggle('primary', !dl && (!onAir || v.paused)); const t = dl ? '⏭ Догнать эфир' : '⏭ К прямому эфиру'; if (b.textContent !== t) b.textContent = t; b.title = dl ? 'Смотреть без задержки — субтитры будут появляться, когда успеют' : 'Перейти к тому, что идёт в эфире сейчас'; });
      AsrGate.delayBtn();
    },
  };
  /* ---------- 📱 second screen: NRK's live TV plays on the TV in NRK's own app (that stream is protected — the app never
   * touches its picture or sound); this device shows NRK's live subtitles for it, with the translation.
   * Instead of a <video> a CLOCK drives the same player: what is shown = the wall clock − the TV's delay. NRK's live
   * subtitles are placed on the wall clock by their own pieces (LiveSubs.bound), so only the delay has to match the TV:
   * a default for a TV app, nudges (−5 / −1 / +1 / +5 s) and «эта строка звучит сейчас»; it is kept per channel. */
  const TV_DELAY = 18; // s behind the moment on air: a TV app plays HLS ≈ 3 target durations (3 × 4 s) behind the end of
  // the playlist, which itself is ≈ 2–3 s behind real time (measured on NRK1/2/3), + ≈ 2–4 s start-up rounding / refresh
  const DELAY_KEY = 'nk-2nd-delay', DELAY_MAX = 3 * 3600, DELAY_KEEP = 120; // NRK keeps 3 h; longer than 2 min is not «the TV's delay»
  /** a <video>-like clock: currentTime = wall clock − base − delay; paused = the display stands still; video-like events */
  function clockMedia(base, delay) {
    const ev = {};
    const fire = t => (ev[t] || []).slice().forEach(f => { try { f(); } catch (e) { /* one listener */ } });
    const wall = () => Date.now() / 1000 - base;
    let paused = true, frozen = wall() - delay, peeked = false;
    const go = () => { peeked = false; if (paused) { paused = false; fire('play'); } else fire('seeked'); };
    const a = {
      tagName: 'CLOCK', src: '', readyState: 4, videoWidth: 0, duration: Infinity, playbackRate: 1, defaultPlaybackRate: 1,
      target: delay, // the TV's delay: «⏭ к эфиру» returns to it
      get currentTime() { return paused ? frozen : wall() - delay; },
      set currentTime(t) { t = +t; if (!isFinite(t)) return; if (paused) frozen = t; else delay = U.clamp(wall() - t, 0, DELAY_MAX); setTimeout(() => fire('seeked'), 0); },
      get paused() { return paused; },
      /** how far behind the wall clock the shown moment is now */
      get delay() { return paused ? wall() - frozen : delay; },
      get peeked() { return peeked; },
      /** after ⏸ (the TV was paused too): on from the same moment; after a look at a line: back to where the TV is */
      play() { if (paused) { if (!peeked) delay = U.clamp(wall() - frozen, 0, DELAY_MAX); peeked = false; paused = false; fire('play'); } return Promise.resolve(); },
      pause() { if (!paused) { frozen = wall() - delay; paused = true; fire('pause'); } },
      /** a line tapped in the list: the display stops on it while the TV goes on (▶ or ⏭ comes back) */
      peek(t) { frozen = t; peeked = true; if (!paused) { paused = true; fire('pause'); } fire('seeked'); },
      live() { delay = a.target; go(); },
      setDelay(d) { delay = a.target = U.clamp(d, 0, DELAY_MAX); go(); },
      addEventListener(t, f, o) {
        if (o && o.once) { const g = () => { ev[t] = (ev[t] || []).filter(x => x !== g); f(); }; (ev[t] = ev[t] || []).push(g); }
        else (ev[t] = ev[t] || []).push(f);
      },
      removeEventListener(t, f) { ev[t] = (ev[t] || []).filter(x => x !== f); },
      reset() { Object.keys(ev).forEach(k => delete ev[k]); }, // a redraw binds its listeners again
      dispatchEvent(e) { fire(e.type); return true; }, removeAttribute() { /* <video> compatibility */ }, load() { /* idem */ },
      destroy() { a.reset(); },
    };
    return a;
  }
  const Second = {
    saved(id) {
      try { const v = JSON.parse(localStorage.getItem(DELAY_KEY) || '{}')[id]; return typeof v === 'number' && v >= 0 && v <= DELAY_KEEP ? v : TV_DELAY; } catch (e) { return TV_DELAY; }
    },
    save() {
      const c = st && st.clk; if (!c) return;
      try {
        const all = JSON.parse(localStorage.getItem(DELAY_KEY) || '{}') || {};
        if (c.target <= DELAY_KEEP) all[st.stream.id] = Math.round(c.target * 10) / 10; else delete all[st.stream.id];
        localStorage.setItem(DELAY_KEY, JSON.stringify(all));
      } catch (e) { /* full */ }
    },
    /** bindMedia: the clock (one per window — a redraw keeps its time) */
    bind() { if (st.clk) st.clk.reset(); else st.clk = clockMedia(st.liveOff, this.saved(st.stream.id)); },
    /** after its listeners are bound: runs from the first moment (no ▶ needed — there is nothing to load) */
    run() {
      const c = st.clk; if (!c) return;
      if (!c.started) { c.started = true; c.live(); } else if (!c.paused && !st.raf) st.raf = requestAnimationFrame(loop);
      syncPlayBtn(); this.bar();
    },
    live() { const c = st.clk; if (!c) return; st.stopAt = null; st.playLine = -1; c.live(); this.bar(); },
    pause() { const c = st.clk; if (!c) return; if (c.paused) c.play(); else c.pause(); this.bar(); },
    nudge(n) { const c = st.clk; if (!c) return; c.setDelay(c.delay + n); this.save(); this.bar(); tick(); },
    /** the next tap on a line = «this line is being said on the TV right now» → the delay exactly */
    tapMode(on) {
      if (!st || !st.m) return;
      st.syncTap = !!on;
      st.m.el.classList.toggle('s2-tapping', !!on);
      st.m.$$('[data-s2="tap"]').forEach(b => { b.classList.toggle('primary', !!on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      const n = st.m.$('[data-s2note]'); if (n) n.hidden = !on;
    },
    syncTo(i) {
      const l = st.lines[i], c = st.clk; if (!l || !c) return;
      this.tapMode(false);
      st.stopAt = null; st.playLine = -1;
      c.setDelay(Date.now() / 1000 - st.liveOff - lineT(l, 'start'));
      this.save(); this.bar(); tick();
      UI.toast(c.target <= DELAY_KEEP ? `Готово: строки идут вместе с телевизором (задержка ${Math.round(c.target)} с)` : 'Готово: строки идут вместе с телевизором', 'good', 3200);
    },
    /** every second: the delay chip, where the display is, ⏭ lit when not with the TV, «no subtitles now», the programme */
    bar() {
      const c = st && st.clk; if (!c || !st.m) return;
      const d = c.delay, behind = !c.paused && d - c.target > 2.5, off = c.paused || behind;
      const chip = st.m.$('[data-s2delay]'); if (chip) chip.textContent = `задержка: ${Math.round(d)} с`;
      const el = st.m.$('[data-livepos]');
      if (el) el.innerHTML = (c.paused ? (c.peeked ? 'строка из списка — эфир идёт дальше' : '<b>пауза</b> — строки стоят') : behind ? `<b>−${mss(d - c.target)}</b> от телевизора` : '<b>вместе с телевизором</b>') + ` · ${clockOf(c.currentTime + st.liveOff)}`;
      const box = st.m.$('[data-livebar]'); if (box) box.classList.toggle('behind', off);
      st.m.$$('[data-k="golive"]').forEach(b => b.classList.toggle('primary', off));
      st.m.$$('[data-s2="pause"]').forEach(b => { b.textContent = c.paused ? '▶ Дальше' : '⏸ Пауза'; });
      // NRK's subtitles: none for a while → a calm word (the reading goes on, lines come as soon as they start)
      const none = st.m.$('[data-s2none]'), q = !!LiveSubs.quiet;
      if (none && none.hidden === q) { none.hidden = !q; drawNow(); }
      // what is on now (NRK's programme guide), once a minute
      const S = st.stream;
      if (S.onAir && Date.now() - (st.onAirAt || 0) > 60000) {
        st.onAirAt = Date.now();
        S.onAir().then(n => { if (st && st.stream === S && n && n.title) { const e = st.m.$('[data-s2now]'); if (e) e.textContent = 'сейчас: ' + n.title; } }).catch(() => { /* the old title stays */ });
      }
    },
  };
  /** 📱 the stage of the second screen: the channel, the big line (read across the room), how to use it, the delay */
  const secondBox = S => `<div class="subs-2nd" data-s2box>
      <div class="s2-top"><span class="s2-logo">${S.poster ? `<img src="${U.esc(S.poster)}" alt="">` : '<span aria-hidden="true">📺</span>'}</span>
        <span class="s2-ch"><b>${U.esc(S.title)}</b><small data-s2now>${U.esc(S.channel || 'NRK TV · прямой эфир')}</small></span>
        <span class="sr-live s2-onair">● эфир</span></div>
      <div class="s2-big" data-s2big><div class="s2-ov" data-ov aria-live="polite"></div>
        <div class="s2-none" data-s2none hidden><b>💬 У этой передачи сейчас нет субтитров NRK</b><span>— строки появятся, как только они начнутся.</span></div></div>
      <p class="s2-help">📺 Смотрите эфир на телевизоре в приложении NRK — здесь субтитры с переводом. Если строки спешат или опаздывают — подстройте.</p>
      <div class="s2-sync" role="group" aria-label="Подстроить под телевизор">
        <span class="s2-chip" data-s2delay title="На столько секунд телевизор показывает эфир позже, чем он идёт">задержка: … с</span>
        <span class="s2-nudge">${[-5, -1, 1, 5].map(n => `<button type="button" class="btn sm" data-s2="nudge" data-n="${n}" title="${n > 0 ? `Строки спешат — показывать на ${n} с позже` : `Строки опаздывают — показывать на ${-n} с раньше`}">${n > 0 ? '+' : '−'}${Math.abs(n)} с</button>`).join('')}</span>
        <button type="button" class="btn sm s2-tapbtn" data-s2="tap" aria-pressed="false" title="Нажмите, а потом — на строку, которую сейчас говорят по телевизору: строки пойдут точно вместе с ним">${window.Help && Help.handIcon ? Help.handIcon(17) : ''} Эта строка звучит сейчас</button>
        <button type="button" class="btn sm sv-btn" data-k="subview" title="Размер текста и цвета субтитров">Aa Вид субтитров</button>
      </div>
      <div class="s2-tapnote" data-s2note hidden role="status"><span>${window.Help && Help.handIcon ? Help.handIcon(17) : ''} Нажмите на строку в списке (или на большую строку), которую <b>сейчас</b> говорят по телевизору.</span>
        <button type="button" class="btn sm" data-s2="tapx">Отмена</button></div>
    </div>`;
  /** 📱 under it: where the display is (with the TV / paused / behind), ⏸ and «⏭ к эфиру» */
  const secondBar = () => `<div class="subs-livebar s2-bar" data-livebar><span class="lb-dot" aria-hidden="true"></span><span class="lb-pos" data-livepos>вместе с телевизором</span><span class="grow"></span>
      <button class="btn sm" data-s2="pause" title="Поставили телевизор на паузу? Строки остановятся тоже">⏸ Пауза</button>
      <button class="btn sm" data-k="golive" title="Снова вместе с телевизором (эфир с вашей задержкой)">⏭ К эфиру</button></div>`;
  /** a line that arrives while playing (recognized speech, NRK's live subtitles) goes into its place in the list */
  function insertLine(start, end, text, auto, info) {
    const L = st.lines;
    const line = { start, end, text: auto ? text.charAt(0).toUpperCase() + text.slice(1) : text, ruFile: '', en: '', auto: !!auto, musicA: !!(info && info.music) };
    // 📝 a line read from the picture (Ink): always translated (a short title must not be taken for another language)
    if (info && info.frame) {
      Object.assign(line, { frame: true, title: !!info.title, _key: info.key || '' });
      // 🇬🇧 an English inscription is translated from English; anything else as Norwegian (a short title must not be
      // taken for another language)
      const r = LID() ? LangId.detect(text) : null;
      if (r && r.lang === 'en' && !r.noWords) line.lang = 'en'; else line.langOk = true;
    }
    // 🎵 a song heard where there are no subtitles: its language was decided by the recognizer's words (Song)
    if (info && info.song) Object.assign(line, { song: true, music: info.music !== false, songSpeech: info.music === false, lang: info.lang || '', songX: info.songX || '', noWords: !!info.songX });
    let i = L.findIndex(l => l.start > start); if (i < 0) i = L.length;
    L.splice(i, 0, line);
    if (!line.frame && !line.song) tagLine(line, { asr: !!auto, prev: prevOf(L, i) });
    if (i < L.length - 1) st.checked = new Set([...st.checked].map(k => (k >= i ? k + 1 : k)));
    if (st.cur >= i) st.cur++;
    if (st.playLine >= i) st.playLine++;
    const list = st.m.$('[data-list]');
    if (list) {
      // the newest line at the end (live: hundreds of lines) — just add its row; in the middle — draw the list again
      if (i === L.length - 1 && list.querySelector('.subs-line')) list.insertAdjacentHTML('beforeend', lineHtml(line, i));
      else { const top = list.scrollTop; list.innerHTML = L.map(lineHtml).join(''); list.scrollTop = top; }
    }
    const foot = st.m.$('[data-nlines]'); if (foot) foot.textContent = L.length;
    musicHint();
    if (skipTr(line)) { /* not translated */ }
    else if (line.frame) trKick(0); // it is on screen now: its translation first
    else if (st.stream && st.stream.live) liveTrSoon();
    else trKick(1500); // recognized lines come one by one: gathered into one request
    tick();
    return line;
  }
  /** live: new lines are translated in small batches in the background (not one request per line), slower while Google rests */
  function liveTrSoon() {
    if (!st) return;
    const rest = window.Translators && Translators.gResting && Translators.gResting();
    const q = trQ();
    // the newest lines shimmer until their round comes (never a bare line that seems forgotten)
    const L = st.lines;
    for (let i = Math.max(0, L.length - 12); i < L.length; i++) if (trNeed(L[i]) && !L[i]._trWait) { L[i]._trWait = true; redrawLine(i); }
    if (q.t || q.run) { q.again = true; return; } // a round is planned / running: the new line joins it
    trKick(rest ? 6000 : 2500);
    if (st.trMode === 'word') setTimeout(() => { if (st && st.trMode === 'word') glossNear(Math.max(0, st.cur)); }, rest ? 7000 : 4000);
  }

  /* ---------- 💬 NRK's live subtitles: the stream's own WebVTT track, read as it comes ----------
   * NRK sends 3.2 s pieces of WebVTT: a line is repeated in every piece while it is on screen, an unfinished one has
   * no end time, live captions grow word by word (each cue = the previous text + a word). Here they become ordinary
   * lines: repeats and growing prefixes merge into one line, which closes when the next one starts or after a pause.
   * Cue times are the stream's MPEG-TS clock (X-TIMESTAMP-MAP); one piece of the picture / sound gives that clock ↔
   * #EXT-X-PROGRAM-DATE-TIME, so every line gets its wall-clock time → the player's time (Live).
   * 📱 Second screen (the picture is protected — never read): the subtitle pieces give that clock themselves (bound). */
  const nk = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  /** a WebVTT piece's X-TIMESTAMP-MAP → seconds to add to its cue times to get the MPEG-TS clock */
  function tsShift(text) {
    const map = text.match(/X-TIMESTAMP-MAP=([^\n\r]+)/); if (!map) return 0;
    const mp = map[1].match(/MPEGTS:(\d+)/), lc = map[1].match(/LOCAL:([\d:.]+)/);
    return (mp ? +mp[1] / 90000 : 0) - (lc ? parseTime(lc[1]) || 0 : 0);
  }
  const LiveSubs = {
    gen: 0, ctx: null, pend: [], C: NaN, made: 0,
    stop() { this.gen++; this.ctx = null; this.pend = []; },
    async start(url) {
      const gen = ++this.gen, S = st.stream;
      this.seen = new Set(); this.ctx = { open: null, recent: [] }; this.pend = []; this.C = NaN; this.made = 0; this.want = NaN;
      this.noTs = !!S.companion; this.B = null; this.cueAt = 0; this.quiet = undefined;
      let first = true, fails = 0;
      const alive = () => gen === this.gen && st && st.stream === S;
      while (alive()) {
        let P;
        try { P = await mediaPlaylist(url); fails = 0; } catch (e) {
          if (++fails === 4) this.say('⚠️ Субтитры эфира сейчас не приходят — пробую ещё…');
          // the address may have changed (NRK renews its live addresses now and then): ask NRK again
          if (fails % 4 === 0 && S.freshVtt) { const u = await S.freshVtt().catch(() => ''); if (u) url = u; }
          await new Promise(r => setTimeout(r, 5000)); continue;
        }
        if (!alive()) return;
        if (!isFinite(this.C) && !this.noTs) await this.clock().catch(() => {});
        if (!st.livePdt && P.segs.length) st.livePdt = P.segs.map(s => s.pdt);
        // rewound into the past (DVR): the subtitles of that part first, merged on their own
        if (isFinite(this.want)) {
          const w = this.want; this.want = NaN;
          const back = P.segs.filter(s => !this.seen.has(s.seq) && s.pdt >= w - 25 && s.pdt <= w + 150);
          if (back.length) { const c = { open: null, recent: [] }; await this.read(back, c, alive); this.close(c, Infinity); this.flush(); }
        }
        let segs = P.segs.filter(s => !this.seen.has(s.seq));
        if (first) {
          segs = segs.slice(-40); first = false; // ≈ 2 minutes back: the player starts near the live edge
          // 📱 the clock first, from ≈ 5 more minutes of pieces before them (a few hundred bytes each, NRK's CDN keeps them)
          if (this.noTs) await this.calib(P.segs.filter(s => s.seq < (segs[0] || {}).seq).slice(-100), alive);
        }
        await this.read(segs, this.ctx, alive);
        if (!alive()) return;
        const lastSeg = P.segs[P.segs.length - 1];
        if (lastSeg) this.close(this.ctx, lastSeg.pdt + lastSeg.dur, true);
        // no subtitle for 1½ minutes (a programme without live subtitles): a calm word on the second screen, reading goes on
        if (lastSeg) this.quiet = !(this.cueAt > lastSeg.pdt - 90);
        this.flush();
        if (P.ended) { this.close(this.ctx, Infinity); this.flush(); return; }
        await new Promise(r => setTimeout(r, Math.max(2000, P.target * 900)));
      }
    },
    say(html) { const el = st && st.m && st.m.$('[data-asr-st]'); if (el) el.innerHTML = html; },
    async read(segs, ctx, alive) {
      if (ctx.from == null && segs.length) ctx.from = segs[0].pdt + Math.min(1, segs[0].dur / 2);
      const texts = [];
      for (let k = 0; k < segs.length; k += 6) {
        texts.push(...await Promise.all(segs.slice(k, k + 6).map(s => fetch(s.url).then(r => (r.ok ? r.text() : '')).catch(() => ''))));
        if (!alive()) return;
      }
      // 📱 no picture to take the clock from: the pieces give it — before any of their lines is placed
      if (this.noTs) { segs.forEach((s, j) => this.bound(s, texts[j])); this.reclock(); }
      segs.forEach((s, j) => {
        this.seen.add(s.seq);
        if (!texts[j]) return;
        if (/-->/.test(texts[j])) this.cueAt = Math.max(this.cueAt, s.pdt || 0);
        this.take(texts[j], s, ctx);
      });
    },
    /** 📱 the clock from the subtitle pieces alone. Piece n covers [T, T + D) of the MPEG-TS clock and is stamped with its
     *  wall clock P (#EXT-X-PROGRAM-DATE-TIME — the same sequence numbers and stamps as the picture's playlists), so
     *  C = P − T. Every cue in a piece began before the piece ends: s < T + D → C < P − s + D (upper bound); a cue that
     *  was not in the piece before began inside this one: s ≥ T → C ≥ P − s (lower bound). Over a few dozen pieces the
     *  bounds close in to hundredths of a second (NRK1 / NRK2 / NRK3, 300 pieces: 0.01–0.04 s apart). */
    bound(seg, text) {
      const B = this.B || (this.B = { hi: Infinity, lo: -Infinity, prev: new Set(), prevSeq: NaN, ref: NaN });
      // a piece that did not come: the next one cannot tell which of its cues are new
      if (!isFinite(seg.pdt) || !/^\uFEFF?WEBVTT/.test(text || '')) { B.prevSeq = NaN; return; }
      const sh = tsShift(text), now = new Set();
      this.cues(text).forEach(c => {
        let d = seg.pdt - (c.s + sh);
        if (!isFinite(B.ref)) B.ref = d;
        while (d - B.ref > HLS_W / 2) d -= HLS_W;
        while (B.ref - d > HLS_W / 2) d += HLS_W; // the 33-bit clock wrapped
        B.hi = Math.min(B.hi, d + seg.dur);
        const key = Math.round(c.s * 1000); now.add(key);
        if (B.prevSeq === seg.seq - 1 && !B.prev.has(key)) B.lo = Math.max(B.lo, d);
      });
      B.prev = now; B.prevSeq = seg.seq;
    },
    /** 📱 bounds only (no lines) from earlier pieces, in their order */
    async calib(segs, alive) {
      for (let k = 0; k < segs.length; k += 10) {
        const part = segs.slice(k, k + 10);
        const texts = await Promise.all(part.map(s => fetch(s.url).then(r => (r.ok ? r.text() : '')).catch(() => '')));
        if (!alive()) return;
        part.forEach((s, j) => this.bound(s, texts[j]));
      }
    },
    /** C from the bounds (their middle; only the upper one yet: just under it); a later, finer C moves what is placed */
    reclock() {
      const B = this.B; if (!B || !isFinite(B.hi)) return;
      const c = isFinite(B.lo) && B.lo <= B.hi ? (B.lo + B.hi) / 2 : B.hi - 0.1;
      if (!isFinite(this.C)) { this.C = c; return; }
      const d = c - this.C; if (Math.abs(d) < 0.08) return;
      this.C = c;
      const done = new Set(), mv = o => { if (!o || done.has(o)) return; done.add(o); o.s += d; o.last += d; if (isFinite(o.e)) o.e += d; };
      if (this.ctx) { mv(this.ctx.open); this.ctx.recent.forEach(mv); if (this.ctx.lead != null) this.ctx.lead += d; }
      this.pend.forEach(mv);
      if (!st || !st.m) return;
      st.lines.forEach(l => { if (!l.auto) { l.start += d; l.end += d; } });
      st.m.$$('.sl-time').forEach(b => { const l = st.lines[+b.dataset.play]; if (l) b.textContent = tLabel(lineT(l, 'start')); });
      tick();
    },
    /** the stream's clock: the first presentation time of one piece of the picture / sound and its wall-clock time */
    async clock() {
      const P = await mediaPlaylist(st.stream.hls);
      const seg = P.segs[Math.max(0, P.segs.length - 3)];
      const pts = tsPts(new Uint8Array(await (await fetch(seg.url)).arrayBuffer()));
      if (!isFinite(pts) || !isFinite(seg.pdt)) throw new Error('no clock');
      this.C = seg.pdt - pts;
      if (!st.livePdt) st.livePdt = P.segs.map(s => s.pdt);
    },
    cues(text) {
      const out = [], L = text.replace(/\r\n?/g, '\n').split('\n');
      for (let i = 0; i < L.length; i++) {
        const m = L[i].match(/^\s*([\d:.]+)\s*-->\s*([\d:.]*)/); if (!m) continue;
        const s = parseTime(m[1]), e = m[2] ? parseTime(m[2]) : NaN, body = [];
        while (i + 1 < L.length && L[i + 1].trim() !== '' && !/-->/.test(L[i + 1])) body.push(L[++i]);
        const t = cleanCue(body.join('\n'));
        if (isFinite(s) && t) out.push({ s, e, t });
      }
      return out.sort((a, b) => a.s - b.s);
    },
    take(text, seg, ctx) {
      const sh = tsShift(text);
      const ref = isFinite(seg.pdt) ? seg.pdt : Date.now() / 1000;
      const cs = this.cues(text);
      // no clock from the stream (should not happen): a new cue is taken to start with its piece (±1.6 s)
      if (!isFinite(this.C) && cs.length) this.C = ref - (cs[cs.length - 1].s + sh);
      const wall = x => { let w = x + sh + this.C; while (w - ref > HLS_W / 2) w -= HLS_W; while (ref - w > HLS_W / 2) w += HLS_W; return w; };
      cs.forEach(c => this.merge(ctx, { s: wall(c.s), e: isFinite(c.e) ? wall(c.e) : NaN, t: c.t }));
    },
    merge(ctx, c) {
      const b = nk(c.t);
      if (!b) { ctx.lead = c.s; return; } // a lone «-» (a new speaker): the line starts here, its words come next
      const same = (o, tol) => {
        const a = nk(o.t), last = isFinite(o.e) ? Math.max(o.e, o.last) : o.last;
        if (c.s < o.s - 0.6 || c.s > last + tol) return false; // not within this line's time
        if (b === a || (b.length > a.length && b.startsWith(a))) {
          // the newest state of the line (grew by a word — or only a punctuation mark — or repeated in the next piece)
          if (c.s >= o.last) {
            o.last = c.s; o.e = c.e;
            if (c.t !== o.t && (b !== a || c.t.length >= o.t.length)) {
              const n0 = nWords(o.t); if (nWords(c.t) > n0) (o.ws || (o.ws = [])).push([n0, c.s]); // 🎤 the new word was said about now
              o.t = c.t; o.dirty = true;
            }
          }
          else if (b === a && isFinite(c.e) && !(o.e > c.e)) o.e = c.e; // an earlier state repeated with its real end
          return true;
        }
        return a.startsWith(b); // an earlier, shorter state of it
      };
      const o = ctx.open;
      if (o && same(o, 1.5)) return;
      if (ctx.recent.some(r => same(r, 0.6))) return; // a line closed a moment ago (still on screen)
      if (o) this.end(ctx, o, c.s);
      const lead = ctx.lead != null && ctx.lead < c.s && c.s - ctx.lead < 1.6 ? ctx.lead : c.s;
      ctx.lead = null;
      ctx.open = { s: lead, e: c.e, t: c.t, last: c.s };
    },
    /** a line that began before the first piece read (its first words are not known) is left out — never a cut line */
    cut: (ctx, o) => ctx.from != null && o.s < ctx.from,
    end(ctx, o, next) {
      if (!isFinite(o.e) || o.e > next) o.e = Math.max(o.s + 0.8, Math.min(isFinite(o.e) ? o.e : next, next));
      ctx.open = null;
      ctx.recent.push(o); if (ctx.recent.length > 6) ctx.recent.shift();
      if (!o.line && !this.cut(ctx, o)) this.pend.push(o);
    },
    /** the open line closes after a pause (its end passed > 1.5 s before the newest piece ends) or at the end */
    close(ctx, now, pauseOnly) {
      const o = ctx.open; if (!o) return;
      if (!pauseOnly || (isFinite(o.e) && now - o.e > 1.5) || now - o.last > 12) this.end(ctx, o, isFinite(o.e) ? o.e : Math.min(now, o.last + 3));
    },
    /** lines → the player (once the player's clock is known); a line close to the playhead shows even while it grows */
    flush() {
      if (!st || !st.liveOff || !this.ctx) return;
      const off = st.liveOff, v = media(), now = v ? v.currentTime : 0;
      const o = this.ctx.open;
      if (o && !o.line && o.s - off < now + 3 && !this.cut(this.ctx, o)) this.pend.push(o);
      const todo = this.pend.splice(0);
      todo.forEach(m => {
        if (m.line) return;
        const s = m.s - off, e = (isFinite(m.e) ? m.e : Math.max(m.last + 2, m.s + 2)) - off;
        // already there (a rewind read the same part again): the same words at an overlapping time
        if (st.lines.some(l => !l.auto && l.start < e && l.end > s && nk(l.text) === nk(m.t))) return;
        m.line = insertLine(s, e, m.t, false); m.dirty = false; this.made++;
        if (m.ws) { m.line.wt = liveWt(m, off); tick(); }
      });
      // lines that grew / closed after they were shown
      [].concat(this.ctx.recent, o ? [o] : []).forEach(m => {
        if (!m.line) return;
        const l = m.line, e = (isFinite(m.e) ? m.e : Math.max(m.last + 2, m.s + 2)) - off;
        if (!m.dirty && Math.abs(l.end - e) < 0.05) return;
        const k = st.lines.indexOf(l); if (k < 0) return;
        if (m.dirty && l.text !== m.t) { l.text = m.t; l._gl = false; l._trFail = false; l._new = undefined; tagLine(l, { prev: prevOf(st.lines, k) }); liveTrSoon(); }
        if (m.ws) l.wt = liveWt(m, off); else delete l.wt;
        l.end = e; m.dirty = false; redrawLine(k);
      });
      if (this.made) this.say(`💬 Субтитры эфира NRK: строк — <b>${this.made}</b>`);
    },
    /** the player went back into the past (DVR): read the subtitles of that part */
    seeked(t) {
      if (!st || !st.liveOff || !this.seen) return;
      const w = t + st.liveOff;
      if (!st.lines.some(l => !l.auto && l.start <= t + 20 && l.end >= t - 20)) this.want = w;
    },
  };
  /* ---------- 🤖 own subtitles: a program without subtitles → NB-Whisper (on the device) listens to its sound ----------
   * The program's sound is cut into phrases at pauses (1.2–7.5 s, adaptive), each phrase is recognized and
   * becomes a line (marked 🤖), then translated like any other line. Lines appear a few seconds after they are spoken;
   * rewinding shows them in sync. Nothing leaves the device. */
  const Asr = {
    on: false, ctx: null, src: null, proc: null, chunks: [], rate: 48000, t0: null, quiet: 0, peak: 0, dur: 0, queue: [], busy: false, made: 0, mute: 0, warned: false,
    status(html) { AsrGate.said = html; const el = st && st.m && st.m.$('[data-asr-st]'); if (el) el.innerHTML = html; },
    stop() {
      this.on = false; this.queue = []; this.reset();
      this.gen++; this.segs = null; this.done = null; this.acc = null; this.hist = null; this.upTo = 0; this.behind = 0; // the stream reader stops too
      this.rec = []; this.complete = false; AsrGate.off(); // ⏳ the overlay and the guard go too
      try { if (this.proc) this.proc.disconnect(); if (this.src) this.src.disconnect(); } catch (e) { /* ignore */ }
      try { if (this.ctx) this.ctx.close(); } catch (e) { /* ignore */ }
      this.ctx = this.src = this.proc = null; this.made = 0; this.mute = 0; this.warned = false;
    },
    /** inside a tap: the audio context must be created / resumed by a user gesture (iPhone, Safari) */
    prime() {
      if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; this.ctx = new AC(); this.rate = this.ctx.sampleRate; }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    },
    /** fromTap: called by a button (a user gesture — the sound can be taken at once); otherwise on the next ▶ */
    async enable(fromTap) {
      if (!st || !st.stream || !window.Speech) return;
      if (fromTap) this.prime();
      const btn = st.m.$('[data-asr-go]');
      const S0 = st.stream, v0 = st.m.$('[data-media]');
      if (S0.hls || S0.mp3 || S0.pcm || (S0.blob && !(S0.duration > FULL_MAX_SEC))) {
        // ⏳ the overlay on the video: the model (once) → started → the first phrases; the video waits for its lines
        AsrGate.compact();
        if (btn) btn.hidden = true;
        if (!(await AsrGate.prepare(fromTap))) return;
        if (!st || st.stream !== S0 || this.on) return;
        this.on = true; st.asrAsked = true;
        AsrGate.begin();
        this.stream(v0 ? v0.currentTime : 0).catch(() => { AsrGate.off(); this.fallback(v0); });
        return;
      }
      if (!(await Speech.asrReady())) {
        const info = await Speech.asrInfo().catch(() => null);
        this.status(`⏳ Нужна модель распознавания речи (${info ? '≈' + info.size + ', ' : ''}скачивается один раз, потом работает без интернета)…`);
        const sparse = st.lines.length > 0;
        // a clear window: why, what, how big — and one button (not a guessing game)
        const ok = await Speech.ensureModel({
          title: '🤖 Субтитры создаст приложение',
          lead: `<p><b>${sparse ? 'У этой передачи NRK субтитры только к отдельным фразам.' : st.stream.kind === 'tg' ? (st.stream.audio ? 'У аудио в Telegram нет субтитров.' : 'У видео в Telegram нет субтитров.') : st.stream.radio ? 'У радио и подкастов NRK нет субтитров.' : st.stream.live ? 'У этого эфира нет субтитров.' : 'У этой передачи нет субтитров.'}</b> Приложение может само распознать норвежскую речь и сделать субтитры с русским переводом — как у передач с субтитрами: строка под видео, нажатие на слово, карточки.</p>
            <p>Для этого нужна <b>модель распознавания речи</b> — её нужно скачать <b>один раз</b>. Потом она работает для всех передач, даже без интернета.</p>`,
          privacy: '🔒 Звук передачи обрабатывается прямо на этом устройстве и никуда не отправляется.',
          okLabel: '⬇ Скачать и создавать субтитры', noBrowser: true,
        });
        if (!st) return;
        if (!ok) { this.status('Модель не скачана — без неё субтитры не создать. Передачу можно смотреть и так. Передумаете — кнопка выше.'); return; }
      }
      this.on = true; st.asrAsked = true;
      if (btn) btn.hidden = true;
      const v = st.m.$('[data-media]');
      // (a program's sound read from NRK / the bridge / the file itself goes through AsrGate above)
      this.fallback(v);
    },
    /** fallback (should the stream not be readable): listen to the playing video through Web Audio */
    fallback(v) {
      if (!st) return;
      const go = () => {
        if (!st || this.src) return;
        this.prime(); this.hook();
        this.status('🎧 Слушаю передачу — строки появятся через несколько секунд после того, как прозвучат. Перемотайте назад, чтобы увидеть их вовремя.');
      };
      // the sound may be taken only with a running audio context (a tap) — otherwise the video would go silent
      if (this.ctx && this.ctx.state === 'running') { go(); if (v && v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } }
      else {
        if (v && !v.paused) v.pause();
        this.status('✅ Модель готова. Нажмите <b>▶</b> — и приложение начнёт создавать субтитры.');
        if (v) v.addEventListener('play', go, { once: true });
      }
    },
    /* ---- the program's sound straight from NRK (HLS segments → AAC → PCM 16 kHz): no browser audio tricks needed ---- */
    gen: 0, segs: null, done: null, acc: null, upTo: 0,
    async playlist(url) {
      // the smallest variant (the sound is the same in all of them); live: the playlist is read again for new pieces (more)
      const P = await mediaPlaylist(url);
      if (!P.segs.length) throw new Error('пустой поток');
      this.pl = P;
      return P.segs;
    },
    /** live: the pieces that appeared since the last read (placed by the wall clock) → were there any? */
    async more(gen) {
      let P; try { P = await mediaPlaylist(this.pl.url); } catch (e) { return false; }
      if (gen !== this.gen || !st || !this.segs) return false;
      const last = this.segs.length ? this.segs[this.segs.length - 1].seq : -1;
      const add = P.segs.filter(s => s.seq > last);
      add.forEach(s => { s.start = s.pdt - st.liveOff; this.segs.push(s); });
      return add.length > 0;
    },
    /* ---- a podcast (one MP3 file): 4.8 s pieces read with Range requests (NRK's files allow it), cut on whole frames ---- */
    async mp3Segs(url, dur) {
      const head = async a => { const r = await fetch(url, { headers: { Range: `bytes=${a}-${a + 65535}` } }); if (r.status !== 206) { try { if (r.body) r.body.cancel(); } catch (e) { /* ignore */ } throw new Error('no range'); } return new Uint8Array(await r.arrayBuffer()); };
      let u8 = await head(0), a0 = 0;
      // an ID3 tag first (title, cover picture — may be bigger than the first piece)
      if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) a0 = 10 + (((u8[6] & 127) << 21) | ((u8[7] & 127) << 14) | ((u8[8] & 127) << 7) | (u8[9] & 127)) + (u8[5] & 0x10 ? 10 : 0);
      let base = 0; if (a0 + 4096 > u8.length) { u8 = await head(a0); base = a0; }
      const f = mp3Frames(u8.subarray(a0 - base)), h = f.n ? mp3Hdr(u8, a0 - base + f.k) : null;
      if (!h) throw new Error('not mp3');
      a0 += f.k;
      if (!dur) { const v = st && st.m && st.m.$('[data-media]'); dur = v && isFinite(v.duration) ? v.duration : 0; }
      if (!dur) throw new Error('no duration');
      const Bps = h.kbps * 125, segB = Math.round(4.8 * Bps), n = Math.ceil(dur * Bps / segB), segs = [];
      for (let i = 0; i < n; i++) segs.push({ url, range: [a0 + i * segB, a0 + (i + 1) * segB - 1], a0, Bps, start: i * segB / Bps, dur: segB / Bps });
      return segs;
    },
    /** ✈️ a Telegram video: the bridge gives its sound as 16 kHz mono PCM, any piece by time (ffmpeg) — 4.8 s pieces */
    async pcmSegs(S, local) { // local: 🎵 a Telegram audio saved on this device — decoded here (no bridge needed)
      let dur = +S.duration || 0;
      const v = st && st.m && st.m.$('[data-media]');
      if (v && isFinite(v.duration) && v.duration > 0) dur = v.duration;
      else if (v && !dur) await new Promise(r => { v.addEventListener('loadedmetadata', r, { once: true }); setTimeout(r, 15000); });
      if (v && isFinite(v.duration) && v.duration > 0) dur = v.duration;
      if (!dur) throw new Error('no duration');
      const n = Math.ceil(dur / 4.8), segs = [];
      for (let i = 0; i < n; i++) segs.push({ pcm: local ? '' : S.pcm, local: !!local, start: i * 4.8, dur: Math.min(4.8, dur - i * 4.8) });
      return segs.filter(x => x.dur > 0.2);
    },
    /** MPEG-TS → the AAC (ADTS) bytes of its audio stream */
    adts(u8) {
      const out = []; let total = 0, apid = -1;
      for (let o = 0; o + 188 <= u8.length; o += 188) {
        if (u8[o] !== 0x47) { const n = u8.indexOf(0x47, o + 1); if (n < 0) break; o = n - 188; continue; }
        const pusi = u8[o + 1] & 0x40, pid = ((u8[o + 1] & 0x1f) << 8) | u8[o + 2], afc = (u8[o + 3] >> 4) & 3;
        let p = o + 4;
        if (afc === 2 || afc === 0) continue;
        if (afc === 3) p += 1 + u8[p];
        if (p >= o + 188) continue;
        if (pusi) {
          if (!(u8[p] === 0 && u8[p + 1] === 0 && u8[p + 2] === 1)) continue;
          const sid = u8[p + 3];
          if (apid < 0 && sid >= 0xC0 && sid <= 0xDF) apid = pid;
          if (pid !== apid) continue;
          p += 9 + u8[p + 8];
          if (p >= o + 188) continue;
        } else if (pid !== apid) continue;
        const c = u8.subarray(p, o + 188); out.push(c); total += c.length;
      }
      const r = new Uint8Array(total); let k = 0; out.forEach(c => { r.set(c, k); k += c.length; });
      return r;
    },
    async decode(seg) {
      if (seg.local) {
        const want = Math.round(seg.dur * 16000);
        let f;
        try { f = await Clip.fromFull(seg.start, seg.start + seg.dur); } catch (e) { if (!e.silent) throw e; f = new Float32Array(0); }
        if (f.length >= want) return f.subarray(0, want);
        const full = new Float32Array(want); full.set(f); return full;
      }
      if (seg.pcm) {
        // exactly seg.dur seconds: a sound track that ends before the picture (or AAC's short first frames) gives fewer
        // samples — the rest is silence, so the clock stays continuous and the last phrase is not thrown away
        const f = await pcmGet(seg.pcm, seg.start, seg.dur), want = Math.round(seg.dur * 16000);
        if (f.length >= want) return f.subarray(0, want);
        const full = new Float32Array(want); full.set(f); return full;
      }
      let data;
      if (seg.range) {
        // MP3: whole frames only (Safari refuses a cut one); the piece starts exactly at its first whole frame
        const r = await fetch(seg.url, { headers: { Range: `bytes=${seg.range[0]}-${seg.range[1]}` } });
        if (r.status !== 206) throw new Error('no range');
        const u8 = new Uint8Array(await r.arrayBuffer()), f = mp3Frames(u8);
        if (f.n < 3) throw new Error('нет звука в потоке');
        seg.start = (seg.range[0] + f.k - seg.a0) / seg.Bps;
        data = u8.slice(f.k, f.e).buffer;
      } else {
        const aac = this.adts(new Uint8Array(await (await fetch(seg.url)).arrayBuffer()));
        if (aac.length < 100) throw new Error('нет звука в потоке');
        data = aac.buffer;
      }
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const oc = new OAC(1, 16000, 16000);
      const ab = await new Promise((res, rej) => { const p = oc.decodeAudioData(data, res, rej); if (p && p.then) p.then(res, rej); });
      if (ab.sampleRate === 16000 && ab.numberOfChannels === 1) return ab.getChannelData(0);
      // a browser that decoded at the file's own rate: mix to mono and resample to 16 kHz
      const n = Math.ceil(ab.duration * 16000), oc2 = new OAC(1, n, 16000);
      const src = oc2.createBufferSource(); src.buffer = ab; src.connect(oc2.destination); src.start();
      return (await oc2.startRendering()).getChannelData(0);
    },
    segAt(t) { const S = this.segs || []; let k = S.findIndex(s => s.start + s.dur > t); return k < 0 ? S.length : k; },
    async stream(from) {
      const S = st.stream, live = !!S.live;
      if (!this.segs) this.segs = S.pcm ? await this.pcmSegs(S) : S.blob ? await this.pcmSegs(S, true) : S.mp3 ? await this.mp3Segs(S.mp3, S.duration) : await this.playlist(S.hls);
      if (!this.done) this.done = new Set();
      const gen = ++this.gen;
      const v = st.m.$('[data-media]');
      if (live) {
        // live: the pieces are placed by the wall clock — known once the player has loaded the stream
        if (!st.livePdt) st.livePdt = this.segs.map(s => s.pdt);
        if (!st.liveOff) {
          await Live.ready();
          if (gen !== this.gen || !st || st.stream !== S) return;
          AsrGate.info();
        }
        if (!this.segs.placed) { this.segs.forEach(s => { s.start = s.pdt - st.liveOff; }); this.segs.placed = true; }
        if (v) {
          // ⏱ «Эфир с задержкой»: the player stands ≈40 s behind the live edge — the recognizer gets that head start
          if (AsrGate.delayed()) { const x = AsrGate.liveTarget(v); if (v.currentTime > x + 3 || !v.currentTime) { try { v.currentTime = x; } catch (e) { /* not seekable yet */ } } }
          from = v.currentTime || Live.edge(v);
        }
      }
      if (v && !v._asrSeek) { v._asrSeek = true; v.addEventListener('seeked', () => { if (this.on && this.segs && !this.segOk(this.segAt(v.currentTime))) this.stream(v.currentTime).catch(() => {}); }); }
      let i = this.segAt(from), firstOk = false;
      this.acc = null;
      while (gen === this.gen && st && this.on) {
        if (i >= this.segs.length) {
          // live: wait for the next pieces of the broadcast
          if (live) { if (!(await this.more(gen))) await new Promise(r => setTimeout(r, 2000)); continue; }
          await this.flush(gen);
          // a jump forward left an unrecognized stretch behind (only when the viewer chose not to wait): that one now
          const hole = this.segs.findIndex((x, k) => !this.segOk(k));
          if (hole >= 0 && hole < i && gen === this.gen) { i = hole; this.acc = null; this.hist = null; continue; }
          if (gen === this.gen) { this.complete = true; AsrGate.info(); }
          return;
        }
        const now = v ? v.currentTime || 0 : 0;
        // the video is at a place not recognized yet (it went back, or jumped there) before the piece being read: that
        // place comes first — the sound collected in this.acc stays (its pieces are past the hole)
        if (!AsrGate.noWait) {
          let j = this.segAt(now); while (j < i && this.segOk(j)) j++;
          if (j < i && (!this.acc || this.segs[j].start + this.segs[j].dur <= this.acc.t0 + 0.05)) { i = j; this.acc = null; this.hist = null; continue; }
        }
        if (this.segs[i].start > now + 90) { await new Promise(r => setTimeout(r, 1500)); continue; } // far enough ahead
        if (this.segOk(i)) { i++; this.acc = null; continue; }
        // only when the viewer chose «не ждать»: a device that can't keep up jumps to just ahead of the playhead (the
        // video does not wait for it); otherwise the video waits (AsrGate) and no phrase is ever skipped
        if (AsrGate.noWait && v && !v.paused && this.segs[i].start + this.segs[i].dur < now - 1) {
          const j = this.segAt(now + 2);
          if (j > i) { i = j; this.acc = null; this.hist = null; this.behind = (this.behind || 0) + (this.made ? 1 : 0); continue; } // (not counted while the model is still warming up)
        }
        const t0 = performance.now();
        let pcm = null;
        try { pcm = await this.decode(this.segs[i]); }
        catch (e) {
          // one more try; a piece that still can't be read becomes a visible «…» (never a silent hole in the lines)
          try { pcm = await this.decode(this.segs[i]); } catch (e2) { if (!firstOk) throw e2; }
        }
        if (gen !== this.gen || !st) return;
        if (!pcm) { await this.flush(gen); if (gen !== this.gen || !st) return; this.gap(this.segs[i].start, this.segs[i].start + this.segs[i].dur); i++; continue; }
        firstOk = true;
        this.done.add(i);
        await this.push(pcm, this.segs[i].start, gen);
        if (gen !== this.gen || !st) return;
        AsrGate.sample(performance.now() - t0, this.segs[i].dur); // ⚡ how fast this device recognizes (real-time factor)
        this.upTo = this.segs[i].start + this.segs[i].dur;
        AsrGate.info();
        i++;
      }
    },
    /* ---- what is recognized (player time): merged stretches [a, b] — the lines of it are on the list ---- */
    rec: [], complete: false,
    mark(a, b) {
      if (!(b > a)) return;
      const R = (this.rec || []).concat([[a, b]]).sort((x, y) => x[0] - y[0]), out = [];
      R.forEach(r => { const p = out[out.length - 1]; if (p && r[0] <= p[1] + 0.35) p[1] = Math.max(p[1], r[1]); else out.push([r[0], r[1]]); });
      this.rec = out;
    },
    /** the lines are ready from t up to … (t itself when t is not recognized yet) */
    readyTo(t) { for (const r of this.rec || []) if (r[0] <= t + 0.5 && r[1] > t) return r[1]; return t; },
    /** the piece k is recognized all through */
    segOk(k) { const x = this.segs && this.segs[k]; return !!x && this.readyTo(x.start) >= x.start + x.dur - 0.1; },
    /** a piece that could not be read even twice: a «…» line marks the gap (not translated), the lines go on after it */
    gap(a, b) {
      this.mark(a, b);
      if (!st || st.lines.some(l => lineT(l, 'end') > a + 0.2 && lineT(l, 'start') < b - 0.2)) return;
      const l = insertLine(a - st.offset, b - st.offset, '…', true, { gap: true });
      if (l) { l.noWords = true; l.gap = true; }
    },
    /**
     * add sound, cut it into phrases at pauses and recognize each. The pause test adapts to the program: a frame is
     * «quiet» when it is below a level between the quiet floor (10th percentile of the last ≈12 s, in dB) and the
     * speech level (60th percentile) — so a pause is found over background music too. A phrase is 1.2–7.5 s (NRK's lines
     * average ≈3.6 s); a slow device gets longer phrases (each call costs about the same: Whisper always reads a 30 s
     * window) and Whisper's own timestamps split them into lines again.
     */
    hist: null,
    async push(pcm, t0, gen) {
      KEnv.add(pcm, t0); // 🎤 the same sound tells the karaoke where the words and the pauses are (no extra download)
      const SR16 = 16000, W = 320, FPS = SR16 / W;
      const gap = this.acc ? t0 - (this.acc.t0 + this.acc.len / SR16) : 0;
      if (!this.acc || Math.abs(gap) > 0.3) { this.acc = { parts: [], len: 0, t0 }; this.hist = null; } // a new place: new statistics
      // Safari decodes each 4.8 s piece 44 ms short (AAC priming): pad / trim at the seam, or the clock drifts and every
      // ~30 s the gap passed 0.3 s → the sound collected so far (a phrase) was thrown away
      else if (gap > 0.001) { const pad = new Float32Array(Math.round(gap * SR16)); this.acc.parts.push(pad); this.acc.len += pad.length; }
      else if (gap < -0.001) pcm = pcm.subarray(Math.min(pcm.length, Math.round(-gap * SR16)));
      this.acc.parts.push(pcm); this.acc.len += pcm.length;
      if (!this.hist) this.hist = [];
      for (;;) {
        // how long one recognition takes here → the shortest phrase worth a call (fast GPU 1.2 s … slow phone 4 s)
        const callS = (window.Speech && Speech.callMs || 0) / 1000;
        const minS = Math.min(4, Math.max(1.2, callS * 0.9)), maxS = Math.max(7.5, minS + 4);
        if (!this.acc || this.acc.len < SR16 * minS || gen !== this.gen) break;
        const all = new Float32Array(this.acc.len); let o = 0; this.acc.parts.forEach(p => { all.set(p, o); o += p.length; });
        const frames = Math.floor(all.length / W), L = new Float32Array(frames);
        for (let f = 0; f < frames; f++) { let q = 0; for (let j = f * W; j < f * W + W; j++) q += all[j] * all[j]; L[f] = 10 * Math.log10(q / W + 1e-10); }
        const pool = this.hist.concat(Array.from(L)).slice(-12 * FPS).sort((x, y) => x - y);
        const pct = x => pool[Math.min(pool.length - 1, Math.floor(x * pool.length))];
        const lo = pct(0.1), hi = pct(0.6), thr = Math.max(-62, lo + (hi - lo) * 0.35);
        const fMin = Math.round(minS * FPS), fMax = Math.round(maxS * FPS), need = Math.round(0.2 * FPS);
        // the first pause (≥ 0.2 s) that ends a phrase of at least minS: cut in its middle
        let cut = -1, quiet = 0;
        for (let f = 0; f < Math.min(frames, fMax); f++) {
          if (L[f] >= thr) { quiet = 0; continue; }
          if (++quiet < need || f - (quiet >> 1) < fMin) continue;
          let g = f; while (g + 1 < frames && L[g + 1] < thr && g - f < FPS) g++;
          if (g + 1 >= frames && frames < fMax) { cut = -2; break; } // the pause runs to the end of what we have: wait
          cut = f - quiet + 1 + ((g - f + quiet) >> 1);
          break;
        }
        if (cut === -2) break;
        if (cut < 0) {
          if (frames < fMax) break; // wait for more sound
          // no pause: the quietest moment (0.1 s average) between 2.5 s and the longest phrase
          let best = -1, bv = 1e9;
          for (let f = Math.round(2.5 * FPS); f < Math.min(fMax, frames - 2); f++) { let q = 0; for (let j = f - 2; j <= f + 2; j++) q += L[j]; if (q < bv) { bv = q; best = f; } }
          cut = best;
        }
        for (let f = 0; f < cut; f++) this.hist.push(L[f]);
        if (this.hist.length > 12 * FPS) this.hist.splice(0, this.hist.length - 12 * FPS);
        const piece = all.subarray(0, cut * W), start = this.acc.t0, end = start + cut * W / SR16;
        this.acc = { parts: [all.slice(cut * W)], len: all.length - cut * W, t0: end };
        await this.say(piece, start, end, gen);
        if (gen === this.gen) this.mark(start, end);
      }
    },
    async flush(gen) {
      const a = this.acc; this.acc = null;
      if (!a || !a.len) return;
      const s = a.t0, e = a.t0 + a.len / 16000;
      if (a.len > 16000 * 0.8) { const all = new Float32Array(a.len); let o = 0; a.parts.forEach(p => { all.set(p, o); o += p.length; }); await this.say(all, s, e, gen); }
      if (gen === this.gen) this.mark(s, e);
    },
    async say(pcm, start, end, gen) {
      // NRK's own lines (sparse subtitles) keep their place: only the sound around them is recognized — a recognized
      // line must not overlap them (nor repeat what they say)
      const own = st ? st.lines.filter(l => !l.auto && lineT(l, 'end') > start && lineT(l, 'start') < end).map(l => ({ start: lineT(l, 'start'), end: lineT(l, 'end') })).sort((a, b) => a.start - b.start) : [];
      if (own.length) {
        let t = start;
        for (const l of own.concat([{ start: end, end }])) {
          const b = Math.min(end, l.start);
          if (b - t >= 1) await this.say(pcm.subarray(Math.round((t - start) * 16000), Math.round((b - start) * 16000)), t, b, gen);
          t = Math.max(t, l.end);
        }
        return;
      }
      let peak = 0; for (let k = 0; k < pcm.length; k += 8) peak = Math.max(peak, Math.abs(pcm[k]));
      if (peak < 0.02) return; // silence / quiet music
      // 🎵 steady sound without the pauses of speech (a hint only: the chip «♪», the calm music line)
      const music = !!(window.LangId && LangId.audioHint(pcm).music);
      let res;
      // a long phrase: ask Whisper for its own segment times too — it becomes several shorter lines
      const opt = end - start > 4.5 ? { timestamps: true, raw: true } : { raw: true };
      // a failed recognition is tried once more; then the phrase becomes a visible «…» — never silently left out
      try { res = await Speech.transcribe(pcm, opt); }
      catch (e) { if (gen !== this.gen || !st) return; try { res = await Speech.transcribe(pcm, opt); } catch (e2) { if (gen === this.gen && st) this.gap(start, end); return; } }
      if (gen !== this.gen || !st) return;
      const lines = this.split(res, start, end);
      lines.forEach(l => this.add(l.start, l.end, l.text, { music }));
      // nothing said: Whisper's «[Musikk]» / «♪» / «Teksting av…», or music by the sound → one calm «🎵 Музыка» line
      if (!lines.length && (music || this.isMusic(res && res.raw))) this.music(start, end);
    },
    isMusic(raw) { return !!(raw && window.LangId && LangId.detect(raw, { asr: true }).noWords); },
    /** music without words: the previous music line (≤ 20 s before) just grows — one line for a whole song */
    music(start, end) {
      const L = st.lines;
      start -= st.offset; end -= st.offset; // player time → subtitle time (see add)
      let p = null; for (let k = L.length - 1; k >= 0; k--) if (L[k].start <= start) { p = L[k]; break; }
      if (p && p.noWords && !p.gap && start - p.end < 20) { p.end = Math.max(p.end, end); musicHint(); return; }
      if (L.some(l => Math.min(l.end, end) - Math.max(l.start, start) > 0.5 * (end - start))) return;
      insertLine(start, end, '🎵', true, { music: true });
    },
    /** recognized text (+ Whisper's segments) → subtitle lines [{start, end, text}] */
    split(res, start, end) {
      const tidy = t => String(t || '').replace(/\s+/g, ' ').trim();
      const ok = t => t && /\p{L}{2}/u.test(t);
      const text = tidy(typeof res === 'string' ? res : res && res.text), dur = end - start;
      const ch = (res && res.chunks || []).filter(c => c.start >= 0 && c.start < dur - 0.3 && tidy(c.text));
      if (ch.length < 2) return ok(text) ? [{ start, end, text }] : [];
      const out = [];
      ch.forEach((c, k) => {
        const s = start + c.start, nx = k + 1 < ch.length ? ch[k + 1].start : dur;
        const e = start + Math.min(dur, c.end != null && c.end > c.start ? Math.max(c.end, Math.min(nx, c.start + 1)) : nx);
        const t = tidy(c.text), prev = out[out.length - 1];
        // a scrap (< 1.2 s or one word) joins its neighbour: a line should be readable
        if (prev && (e - s < 1.2 || t.split(' ').length < 2 || prev.end - prev.start < 1.2)) { prev.end = Math.max(prev.end, e); prev.text += ' ' + t; }
        else out.push({ start: s, end: e, text: t });
      });
      out[0].start = start; out[out.length - 1].end = Math.max(out[out.length - 1].end, Math.min(end, out[out.length - 1].start + 1.5));
      return out.filter(l => ok(l.text));
    },
    hook() {
      const v = st.m.$('[data-media]'); if (!v || this.src) return;
      this.prime();
      this.src = this.ctx.createMediaElementSource(v);
      this.src.connect(this.ctx.destination);
      this.proc = this.ctx.createScriptProcessor(4096, 1, 1);
      this.src.connect(this.proc); this.proc.connect(this.ctx.destination);
      this.proc.onaudioprocess = e => this.feed(e.inputBuffer.getChannelData(0), v);
      v.addEventListener('play', () => { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); });
      v.addEventListener('seeking', () => this.reset());
    },
    reset() { this.chunks = []; this.t0 = null; this.quiet = 0; this.peak = 0; this.dur = 0; },
    feed(d, v) {
      if (!this.on || !st || v.paused || v.seeking) return;
      let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] * d[i];
      const rms = Math.sqrt(s / (d.length / 4)), sec = d.length / this.rate;
      // complete digital silence for a long time while playing: this browser gives no sound to the page
      this.mute = rms < 1e-6 ? this.mute + sec : 0;
      if (this.mute > 20 && !this.warned) { this.warned = true; this.status('⚠️ Этот браузер не даёт приложению звук передачи — распознать речь не получится. Попробуйте Chrome на компьютере.'); }
      if (this.t0 == null) { if (rms < 0.01) return; this.t0 = Math.max(0, v.currentTime - sec); }
      this.chunks.push(new Float32Array(d)); this.dur += sec; this.peak = Math.max(this.peak, rms);
      this.quiet = rms < 0.012 ? this.quiet + sec : 0;
      if ((this.quiet > 0.45 && this.dur > 2.5) || this.dur > 8) this.cut(v.currentTime);
    },
    cut(tEnd) {
      const job = { chunks: this.chunks, start: this.t0, end: Math.max(this.t0 + 0.5, tEnd - Math.min(this.quiet, 0.4)), peak: this.peak };
      this.reset();
      if (job.peak < 0.015 || job.end - job.start < 0.6) return;
      this.queue.push(job);
      this.work();
    },
    async work() {
      if (this.busy) return;
      this.busy = true;
      try {
        while (this.on && this.queue.length && st) {
          if (this.queue.length > 6) this.queue.splice(0, this.queue.length - 6); // far behind: the newest phrases matter
          const job = this.queue.shift();
          let text = '', res = null, music = false;
          try {
            const pcm = await Speech.toMono16k(job.chunks, this.rate);
            music = !!(window.LangId && LangId.audioHint(pcm).music);
            res = await Speech.transcribe(pcm, { raw: true }); text = res && typeof res === 'object' ? res.text : res;
          } catch (e) { this.status('⚠️ Распознавание: ' + U.esc(U.niceErr(e, '', true))); }
          if (!st) return;
          text = String(text || '').replace(/\s+/g, ' ').trim();
          if (text && /\p{L}{2}/u.test(text)) this.add(job.start, job.end, text, { music });
          else if (music || this.isMusic(res && res.raw)) this.music(job.start, job.end);
          this.status(`${BOT()} Строк создано приложением: <b>${this.made}</b>${this.queue.length > 1 ? ' · догоняю…' : ''}`);
        }
      } finally { this.busy = false; }
    },
    add(start, end, text, info) {
      const L = st.lines;
      // «la la la», «♪ … ♪» without words: part of the one music line, not a line of its own
      if (window.LangId && LangId.detect(text, { asr: true }).noWords) { this.music(start, end); return; }
      // the recognizer works in player time; the list keeps subtitle time (player time − «⇆ Сдвиг» of the subtitles)
      start -= st.offset; end -= st.offset;
      // rewound: this part was already recognized
      if (L.some(l => Math.min(l.end, end) - Math.max(l.start, start) > 0.5 * (end - start))) return;
      const prev = L[L.length - 1];
      if (prev && prev.auto && U.norm(prev.text) === U.norm(text)) return; // the model repeated itself
      this.made++;
      insertLine(start, end, text, true, info); // its place in the list, translation (live: in batches)
    },
  };

  /* ---------- ⏳ own subtitles in sync: the video waits for its lines ----------
   * A program without subtitles: before it plays, the model is downloaded (once) and started and the first ≈25 s are
   * recognized — the video stands, an overlay on it says what is happening («Смотреть без субтитров» skips the wait).
   * Then recognition keeps ≥ 20–40 s ahead of the playhead (the sound is read straight from the stream, ahead of the
   * picture). Should that lead drop under 10 s (a slow device, a jump to a place not recognized yet) the video goes a
   * little slower (0.9×); under 4 s it waits («Догоняю субтитры…») until 15 s are ready — the voice never runs ahead of
   * its line, and no phrase is skipped. A device that can't keep up with the accurate model (real-time factor > 0.8) is
   * offered the light one, once. Live (NRK direct): «⏱ Эфир с задержкой» — the stream plays ≈40 s behind the live
   * edge, which is the recognizer's head start; «⏭ Догнать эфир» goes back to the edge (lines then come when ready). */
  const GATE = { start: 25, resume: 15, slow: 10, stop: 4 }, LIVE_DELAY = 40, LITE_ASK = 'nk-asr-lite';
  const aheadTxt = s => (s >= 120 ? Math.floor(s / 60) + ' мин' : s >= 60 ? '1 мин' : Math.max(5, Math.floor(s / 5) * 5) + ' с');
  const devName = () => {
    const ua = navigator.userAgent || '';
    return /iPhone/.test(ua) ? 'Ваш iPhone' : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'Ваш iPad' : /Macintosh/.test(ua) ? 'Ваш Mac' : /Android|Mobile/.test(ua) ? 'Ваш телефон' : 'Ваш компьютер';
  };
  const AsrGate = {
    view: '', hold: false, noWait: false, wantPlay: false, timer: 0, selfAt: 0, slowed: false, dl: false, dlBg: false, pct: 0, err: '',
    size: '', samples: [], nSamples: 0, rtf: 0, offer: false, offerSeen: false, liteBusy: -1, delay: true, ctrl: null, waitFn: null, said: '',
    off() {
      clearInterval(this.timer); this.timer = 0;
      if (this.ctrl) { try { this.ctrl.abort(); } catch (e) { /* gone */ } this.ctrl = null; }
      if (this.waitFn) { const f = this.waitFn; this.waitFn = null; f(false); }
      const v = st && media(); if (v && this.slowed && v.playbackRate) v.playbackRate = st.rate;
      this.unmount();
      Object.assign(this, { view: '', hold: false, noWait: false, wantPlay: false, slowed: false, dl: false, dlBg: false, err: '', samples: [], nSamples: 0, rtf: 0, offer: false, offerSeen: false, said: '', delay: true });
    },
    /** live and on purpose behind the edge (the recognized lines in sync) */
    delayed() { return !!(st && st.stream && st.stream.live && Asr.on && this.delay && !this.noWait); },
    /* ---- the overlay on the video ---- */
    host() { return st && st.m && (st.m.$('[data-stage]') || st.m.$('.subs-radio')); },
    unmount() { const h = this.host(), g = h && h.querySelector(':scope > [data-asrgate]'); if (g) g.remove(); },
    steps() {
      const list = [this.dl ? ['dl', 'Скачать распознавание речи'] : null, ['warm', 'Подготовить распознавание'], ['first', 'Распознать первые фразы']].filter(Boolean);
      const k = list.findIndex(x => x[0] === this.view);
      return `<ol class="ag-steps">${list.map(([id, t], j) => `<li class="${j < k ? 'done' : j === k ? 'now' : ''}"><span class="ag-n" aria-hidden="true">${j < k ? '✓' : j + 1}</span>${t}${j < k ? '<span class="sr-only"> — готово</span>' : ''}</li>`).join('')}</ol>`;
    },
    offerHtml() {
      return `<div class="ag-offer" role="group" aria-label="Лёгкое распознавание">
          <p><b>${devName()} не успевает с точной моделью — включить лёгкую?</b> Быстрее, чуть менее точно.</p>
          <div class="ag-btns"><button type="button" class="btn sm primary" data-gate="lite">Включить лёгкую</button>
          <button type="button" class="btn sm" data-gate="keep">Оставить точную — смотреть с паузами</button></div></div>`;
    },
    /** the first ≈25 s: how much is ready */
    firstPart() { const v = media(), t = v ? v.currentTime || 0 : 0; return Math.max(0, Math.min(GATE.start, Asr.readyTo(t) - t)); },
    draw() {
      if (!st || !st.m) return;
      const V = this.view;
      if (!V) { this.unmount(); this.info(); return; }
      const h = this.host(); if (!h) return;
      let g = h.querySelector(':scope > [data-asrgate]');
      if (!g) { g = document.createElement('div'); g.dataset.asrgate = ''; g.setAttribute('role', 'group'); g.setAttribute('aria-label', 'Субтитры, созданные приложением'); h.appendChild(g); }
      const S = st.stream, what = S && S.audio ? 'Звук' : 'Видео';
      const offer = this.offer && (V === 'catch' || V === 'first'); // where the eyes are: on the video
      const key = V + (offer ? '+o' : '') + (V === 'err' ? this.err : '');
      g.className = 'subs-asrgate ' + (V === 'catch' ? 'pill' : 'full');
      if (g.dataset.key !== key) {
        g.dataset.key = key;
        const skip = `<button type="button" class="btn ag-skip" data-gate="skip">${V === 'catch' ? 'Не ждать' : 'Смотреть без субтитров'}</button>`;
        const bar = '<div class="ag-bar" aria-hidden="true"><i data-ag-bar></i></div>';
        g.innerHTML = V === 'ask' ? `<div class="ag-card">
            <div class="ag-ico" aria-hidden="true">${BOT(40)}</div>
            <p class="ag-t" aria-live="polite">Субтитры к этой передаче создаст приложение</p>
            <p class="ag-sub">Для этого нужно один раз скачать распознавание речи (${U.esc(this.size || '≈ 100 МБ')}). Потом оно хранится на устройстве и работает без интернета — для всех передач.</p>
            <p class="ag-sub small">🔒 Звук передачи обрабатывается только на этом устройстве.</p>
            <div class="ag-btns"><button type="button" class="btn primary" data-gate="dl">⬇ Скачать (${U.esc(this.size || '≈ 100 МБ')}, один раз)</button>${skip}</div></div>`
          : V === 'err' ? `<div class="ag-card">
            <div class="ag-ico" aria-hidden="true">⚠️</div>
            <p class="ag-t" aria-live="polite">Не получилось скачать распознавание речи</p>
            <p class="ag-sub">${U.esc(this.err)}. Уже скачанное сохранилось — продолжим с того же места.</p>
            <div class="ag-btns"><button type="button" class="btn primary" data-gate="dl">🔁 Ещё раз</button>${skip}</div></div>`
          : V === 'catch' ? `<div class="ag-pill"><span class="ag-spin" aria-hidden="true"></span><span class="ag-t" aria-live="polite">Догоняю субтитры…</span>${skip}</div>${offer ? this.offerHtml() : ''}`
          : `<div class="ag-card">
            <div class="ag-ico ag-hg" aria-hidden="true">⏳</div>
            <p class="ag-t" aria-live="polite" data-ag-t></p>
            <p class="ag-sub" data-ag-sub></p>
            ${V === 'warm' ? '' : bar}
            ${this.steps()}
            <p class="ag-sub small">${what} начнётся само, как только будут готовы первые субтитры.</p>
            <div class="ag-btns">${skip}</div>${offer ? this.offerHtml() : ''}</div>`;
      }
      const t = g.querySelector('[data-ag-t]'), sub = g.querySelector('[data-ag-sub]'), b = g.querySelector('[data-ag-bar]');
      let tt = '', ss = '', w = 0;
      if (V === 'dl') { tt = `Скачиваю распознавание речи — ${this.pct} %`; ss = `${this.size || '≈ 100 МБ'}, только в первый раз — потом субтитры будут начинаться через несколько секунд.`; w = this.pct; }
      else if (V === 'warm') { tt = 'Готовлю распознавание…'; ss = 'Модель запускается на этом устройстве.'; }
      else if (V === 'first') { const r = this.firstPart(); tt = 'Распознаю первые фразы…'; ss = `Готово ${Math.floor(r)} из ${GATE.start} с`; w = r / GATE.start * 100; }
      if (t && t.textContent !== tt) t.textContent = tt;
      if (sub && sub.textContent !== ss) sub.textContent = ss;
      if (b) b.style.width = Math.round(w) + '%';
      this.info();
    },
    /** a tap on ▶ while the video waits: it keeps waiting (the overlay says why and offers «Смотреть без субтитров») */
    nudge() { const h = this.host(), g = h && h.querySelector(':scope > [data-asrgate]'); if (!g) return; g.classList.remove('nudge'); void g.offsetWidth; g.classList.add('nudge'); },
    pause(v) { if (v && !v.paused) { this.wantPlay = true; this.selfAt = Date.now(); v.pause(); } },
    release() {
      this.hold = false; this.view = ''; this.draw();
      const v = media();
      if (v && this.slowed) { this.slowed = false; v.playbackRate = st.rate; }
      if (v && v.paused && this.wantPlay) { this.selfAt = Date.now(); const p = v.play(); if (p && p.catch) p.catch(() => { /* the browser wants a tap — ▶ is there */ }); }
      this.wantPlay = false;
    },
    hook() {
      const v = media(); if (!v || v._agPlay || !v.addEventListener) return;
      v._agPlay = true;
      v.addEventListener('play', () => {
        if (!st || Date.now() - this.selfAt < 1000) return;
        if (!this.hold) { this.tick(); return; } // ▶ at a place not recognized yet: it waits right away
        this.wantPlay = true; this.selfAt = Date.now(); v.pause(); this.nudge();
      });
      v.addEventListener('seeking', () => this.tick()); // a jump to a place not recognized yet: wait at once, not ¼ s later
    },
    /** download (once, with one tap) → start the model; the video stands meanwhile → false: no subtitles this time */
    async prepare(fromTap) {
      const S = st.stream;
      this.hook();
      if (!this.noWait) { this.hold = true; this.wantPlay = true; this.pause(media()); }
      const ready = await Speech.asrReady().catch(() => false);
      if (!st || st.stream !== S) return false;
      if (!ready) {
        const info = await Speech.asrInfo().catch(() => null);
        this.size = info && info.missingBytes > 0 ? '≈ ' + info.size : '≈ 100 МБ';
        this.dl = true;
        if (!fromTap) { this.view = 'ask'; this.draw(); if (!(await this.answer())) return this.declined(); }
        for (;;) {
          if (!st || st.stream !== S) return false;
          this.pct = 0; this.dlBg = true; this.err = '';
          if (!this.noWait) { this.view = 'dl'; this.hold = true; }
          this.draw();
          this.ctrl = new AbortController();
          try {
            await Speech.downloadAsr((d, t) => { const p = t ? Math.min(100, Math.floor(d / t * 100)) : 0; if (p !== this.pct) { this.pct = p; this.draw(); } }, this.ctrl.signal);
            this.ctrl = null; this.dlBg = false; break;
          } catch (e) {
            this.ctrl = null; this.dlBg = false;
            if (!st || st.stream !== S || (e && e.name === 'AbortError')) return false;
            this.err = U.niceErr(e);
            if (this.noWait) return this.declined('Не получилось скачать распознавание речи: ' + U.esc(this.err));
            this.view = 'err'; this.draw();
            if (!(await this.answer())) return this.declined();
          }
        }
        UI.toast('Распознавание речи скачано — теперь оно работает без интернета', 'good');
      }
      if (!st || st.stream !== S) return false;
      if (!this.noWait) this.view = 'warm';
      this.draw();
      try { await Speech.warmAsr(); } catch (e) { /* the first recognition tries again (and says why) */ }
      return !!st && st.stream === S;
    },
    answer() { return new Promise(r => { this.waitFn = r; }); },
    declined(why) {
      if (!st) return false;
      this.dl = false; this.release();
      const b = st.m.$('[data-asr-go]'); if (b) b.hidden = false;
      Asr.status(why || 'Субтитры не создаются — передачу можно смотреть и так. Передумаете — кнопка рядом.');
      return false;
    },
    /** the stream is being read: the first phrases (the video waits for them), then the guard */
    begin() {
      if (!this.timer) this.timer = setInterval(() => this.tick(), 250);
      this.hook();
      if (!this.noWait) { this.view = 'first'; this.hold = true; this.wantPlay = true; this.pause(media()); }
      this.draw();
    },
    tick() {
      if (!st || !Asr.on || !st.stream) return;
      const v = media(); if (!v || !('paused' in v)) return;
      const t = v.currentTime || 0, end = Asr.readyTo(t);
      const A = Asr.complete || (st.dur && end >= st.dur - 0.5) ? Infinity : end - t;
      if (this.view === 'first') { if (A >= GATE.start) this.release(); else this.draw(); }
      else if (this.view === 'catch') { if (A >= GATE.resume) this.release(); }
      else if (!this.noWait && !this.view && !v.paused) {
        if (A < GATE.stop) { this.view = 'catch'; this.hold = true; this.pause(v); this.draw(); return; }
        if (A < GATE.slow && !this.slowed) { this.slowed = true; v.playbackRate = st.rate * 0.9; } // gently: hardly heard
        else if (A >= GATE.resume && this.slowed) { this.slowed = false; v.playbackRate = st.rate; }
      }
      if (this.noWait && this.slowed) { this.slowed = false; v.playbackRate = st.rate; }
      this.info();
    },
    /* ---- ⚡ how fast this device recognizes: seconds of work per second of sound (the last ≈40 s of sound) ---- */
    sample(ms, dur) {
      if (!(dur > 0)) return;
      if (++this.nSamples <= 2) return; // the first pieces: the model is still warming up
      this.samples.push([ms / 1000, dur]); if (this.samples.length > 8) this.samples.shift();
      const a = this.samples.reduce((s, x) => s + x[0], 0), b = this.samples.reduce((s, x) => s + x[1], 0);
      this.rtf = a / b;
      if (this.samples.length >= 6 && this.rtf > 0.8 && !this.offerSeen) this.maybeOffer();
    },
    async maybeOffer() {
      this.offerSeen = true;
      try { if (localStorage.getItem(LITE_ASK)) return; } catch (e) { /* ask */ }
      let info = null; try { info = await Speech.asrInfo(); } catch (e) { return; }
      if (!st || !info || (info.run || info.key) !== 'small') return; // already the light one: nothing faster to offer
      this.offer = true; this.draw(); this.info();
    },
    async lite(on) {
      try { localStorage.setItem(LITE_ASK, on ? 'light' : 'accurate'); } catch (e) { /* asked once anyway */ }
      this.offer = false; this.draw();
      if (!on) { this.info(); return; }
      this.liteBusy = 0; this.info();
      try {
        await Speech.useLight((d, t) => { this.liteBusy = t ? Math.min(100, Math.floor(d / t * 100)) : 0; this.info(); });
        UI.toast('Включено лёгкое распознавание — субтитры пойдут быстрее', 'good');
      } catch (e) { UI.toast('Лёгкую модель скачать не получилось: ' + U.niceErr(e), 'warn'); }
      this.liteBusy = -1; this.samples = []; this.nSamples = 0; this.offerSeen = false;
      this.info();
    },
    /* ---- 📡 live ---- */
    liveTarget(v) { const e = Live.edge(v), s = v.seekable, lo = s && s.length ? s.start(0) + 2 : e; return Math.max(lo, e - LIVE_DELAY); },
    goLive() {
      if (!st || !Asr.on || !st.stream || !st.stream.live) return;
      this.delay = false; this.noWait = true; this.hold = false; this.view = ''; this.wantPlay = false; this.draw();
    },
    liveToggle() {
      const v = media(); if (!v || !st.stream || !st.stream.live) return;
      if (this.delayed()) { Live.go(); return; }
      this.delay = true; this.noWait = false;
      if (!Asr.on) { Asr.enable(true); return; }
      try { v.currentTime = this.liveTarget(v); } catch (e) { /* not loaded yet */ }
      this.info(); Live.bar();
    },
    delayBtn() {
      if (!st || !st.m) return;
      const on = this.delayed();
      st.m.$$('[data-k="livedelay"]').forEach(b => { b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.classList.toggle('on', on); });
    },
    /* ---- the line under the video: short and calm; «?» — the details ---- */
    compact() {
      const note = st && st.m && st.m.$('.subs-stream-note'); if (!note || note.dataset.asrc) return;
      const body = note.children[1]; if (!body) return;
      note.dataset.asrc = '1'; note.classList.add('asr-compact');
      const rows = [...body.children].filter(x => x.classList.contains('subs-asr-row'));
      const more = document.createElement('div'); more.className = 'asr-more small'; more.hidden = true; more.id = 'asr-more-' + Math.random().toString(36).slice(2, 8);
      [...body.childNodes].forEach(n => { if (!rows.includes(n) || n.querySelector('.glass-btn')) more.appendChild(n); });
      const old = body.querySelector('[data-asr-st]'); if (old) old.remove();
      const go = body.querySelector('[data-asr-go]'); if (go && !Asr.on) go.hidden = true;
      const det = document.createElement('div'); det.className = 'asr-detail tiny muted'; det.dataset.asrDetail = ''; more.prepend(det);
      const head = document.createElement('div'); head.className = 'asr-head';
      head.innerHTML = `<span class="asr-st" data-asr-st role="status"></span><button type="button" class="btn sm ghost asr-q" data-gate="help" aria-expanded="false" aria-controls="${more.id}" title="Подробнее о субтитрах, которые создаёт приложение" aria-label="Подробнее о субтитрах">?</button>`;
      const offer = document.createElement('div'); offer.dataset.asrOffer = ''; offer.className = 'asr-offer-box';
      body.prepend(head); head.after(offer); body.appendChild(more);
      if (this.said) head.querySelector('[data-asr-st]').innerHTML = this.said;
      else Asr.status('Субтитры к этой передаче создаст приложение');
    },
    info() {
      if (!st || !st.m || !st.stream) return;
      this.compact();
      const S = st.stream, v = media(), t = v && 'currentTime' in v ? v.currentTime || 0 : 0;
      const V = this.view, done = S.audio ? (S.kind === 'tg' ? 'Вся запись распознана' : 'Весь выпуск распознан') : S.kind === 'tg' ? 'Всё видео распознано' : 'Вся передача распознана';
      let html = '';
      if (V === 'ask') html = 'Для субтитров нужно один раз скачать распознавание речи';
      else if (V === 'dl' || this.dlBg) html = `Скачиваю распознавание речи — ${this.pct} %`;
      else if (V === 'warm') html = 'Готовлю распознавание…';
      else if (V === 'first') html = 'Распознаю первые фразы…';
      else if (V === 'catch') html = 'Догоняю субтитры — видео подождёт';
      else if (V === 'err') html = 'Распознавание речи не скачалось';
      else if (!Asr.on) return;
      else if (Asr.complete) html = `${done} · строк: ${Asr.made}`;
      else {
        const A = Asr.readyTo(t) - t; // (live: the bar above says «эфир −40 с»)
        if (A >= 5) html = `Субтитры готовы на ${aheadTxt(A)} вперёд`;
        else html = this.noWait ? 'Субтитры появляются, когда успевают' : 'Распознаю…';
        if (this.noWait && Asr.on && !(S.live && !this.delay)) html += ' <button type="button" class="btn sm" data-gate="wait" title="Видео будет ждать, пока строки готовы, — голос не обгонит строку">⏸ Ждать субтитры</button>';
        else if (this.noWait && S.live) html += ' <button type="button" class="btn sm" data-gate="delay">⏱ Эфир с задержкой</button>';
      }
      if (this.liteBusy >= 0) html += ` · скачиваю лёгкую модель — ${this.liteBusy} %`;
      if (html !== this.said) { this.said = html; Asr.status(html); }
      // the details: what the app does, how far, how fast
      const d = st.m.$('[data-asr-detail]');
      if (d) {
        const eng = window.Speech && Speech.engine, up = Asr.readyTo(t);
        const x = Asr.on ? `Строк создано: ${Asr.made} · распознано до ${tLabel(Math.max(up, Asr.upTo || 0))}${eng ? ` · ${U.esc(eng.model)} (${eng.device === 'webgpu' ? 'видеокарта' : 'процессор'})` : ''}${this.rtf ? ` · скорость: ${this.rtf.toFixed(1).replace('.', ',')} с работы на 1 с речи` : ''}` : '';
        if (d.textContent !== x) d.textContent = x;
      }
      const ob = st.m.$('[data-asr-offer]');
      if (ob) { const want = this.offer && V !== 'catch' && V !== 'first' ? this.offerHtml() : ''; if ((ob.dataset.on || '') !== (want ? '1' : '')) { ob.dataset.on = want ? '1' : ''; ob.innerHTML = want; } }
    },
    /** taps on the overlay / the line (onClick) → handled? */
    click(t) {
      const b = t.closest && t.closest('[data-gate]'); if (!b || !st) return false;
      const k = b.dataset.gate;
      if (k === 'dl') { if (this.waitFn) { const f = this.waitFn; this.waitFn = null; f(true); } }
      else if (k === 'skip') {
        if (this.waitFn) { const f = this.waitFn; this.waitFn = null; f(false); return true; } // no download this time
        this.noWait = true; this.release(); this.info();
        if (st.stream && st.stream.live) Live.bar();
      } else if (k === 'wait') { this.noWait = false; this.info(); }
      else if (k === 'delay') this.liveToggle();
      else if (k === 'lite') this.lite(true);
      else if (k === 'keep') this.lite(false);
      else if (k === 'help') {
        const m = st.m.$('.asr-more'); if (!m) return true;
        m.hidden = !m.hidden; b.setAttribute('aria-expanded', m.hidden ? 'false' : 'true');
        this.info();
      }
      return true;
    },
  };

  /* ---------- ⛶ full screen: the video over the whole screen, OUR line + translation on top of it ----------
   * The PAGE goes full screen — the element that holds the video AND our subtitle layer (and the word bubble, the cards
   * window and the messages, which live outside the player) — and the video stage covers it. Every way in leads here:
   * «⛶ На весь экран», the ⛶ on the video, F, a double click on the video. The browser's own full screen of the bare
   * <video> would show the picture WITHOUT our lines, so:
   *  · Chrome / Edge: the player's own ⛶ is hidden (controlslist="nofullscreen"); a double click is ours;
   *  · Safari on a Mac, Firefox (their player keeps its own ⛶): when the bare video goes full screen, the page takes over
   *    at once if the browser allows it; if not, the browser itself shows our lines (NativeSubs: a text track);
   *  · iPad: like a computer (the page goes full screen);
   *  · iPhone (only the bare video can be full screen there): «⛶ На весь экран» makes the stage cover the whole window
   *    with our layer; the system player's own full screen (its ⛶, or turning the phone) shows our lines via NativeSubs;
   *  · YouTube: its own ⛶ is off (fs=0, the frame has no full-screen permission) — ours puts our lines over it. */
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const Full = {
    on: false, leaving: 0, taking: false,
    enter() {
      if (!st || !st.m || this.on) return;
      if (ytPlain()) { UI.toast('Во весь экран — кнопкой в самом плеере YouTube (справа внизу видео)', '', 4000); return; }
      this.mark(true);
      const de = document.documentElement, req = de.requestFullscreen || de.webkitRequestFullscreen;
      if (fsEl() && fsEl() !== de) { this.takeOver(true); return; } // the bare video is full screen (F pressed there): it steps out first
      if (req && fsEl() !== de) { try { const p = req.call(de); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not allowed — the window-sized stage stays */ } }
      try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* phones only */ }
    },
    /** our full-screen look on / off (the browser's own state is followed in onFsChange) */
    mark(on) {
      this.on = on; if (st) st.full = on;
      if (st && st.m) st.m.el.classList.toggle('subs-full', on);
      document.body.classList.toggle('subs-fullscreen', on);
      if (st && st.m) { drawNow(); syncFullBtn(); }
    },
    exit(silent) {
      if (!this.on) return;
      this.on = false; if (st) st.full = false;
      if (st && st.m) st.m.el.classList.remove('subs-full');
      document.body.classList.remove('subs-fullscreen');
      if (fsEl()) {
        this.leaving = Date.now(); // the bare video may be under the page (it was full screen first): it goes too
        const ex = document.exitFullscreen || document.webkitExitFullscreen;
        try { const p = ex.call(document); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
      }
      try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* ignore */ }
      if (!silent) syncFullBtn();
    },
    toggle() { if (this.on) this.exit(); else this.enter(); },
    /** the bare video went full screen by the browser's own button: the page with our layer takes over.
     *  Not on top of it (the video would stay in the browser's top layer, UNDER the page — a black screen): the bare video
     *  leaves full screen first, then the page enters it (onFsChange → takeOn). Only while the browser still counts the
     *  click as fresh (it asks for one); otherwise the browser's own full screen stays, with our lines in it (NativeSubs). */
    takeOver(force) {
      if ((this.on && !force) || this.taking) return;
      const de = document.documentElement, req = de.requestFullscreen || de.webkitRequestFullscreen, ex = document.exitFullscreen || document.webkitExitFullscreen;
      if (!req || !ex) return;
      const ua = navigator.userActivation;
      if (!force && ua && !ua.isActive) return;
      this.taking = 'exit';
      clearTimeout(this.takeT); this.takeT = setTimeout(() => { this.taking = false; }, 4000);
      try { const p = ex.call(document); if (p && p.catch) p.catch(() => {}); } catch (e) { this.taking = false; }
    },
    /** the bare video is back in the page: now the page (with our layer) goes full screen */
    takeOn() {
      this.taking = 'req';
      if (!this.on) this.mark(true);
      const de = document.documentElement, req = de.requestFullscreen || de.webkitRequestFullscreen;
      const no = () => {
        if (!this.taking) return;
        this.taking = false; this.exit();
        UI.toast('⛶ Чтобы смотреть на весь экран с субтитрами, нажмите кнопку ⛶ на видео', '', 4500);
      };
      try { const p = req.call(de); if (p && p.then) p.then(() => { this.taking = false; }, no); } catch (e) { no(); }
    },
  };
  function onFsChange() {
    const el = fsEl();
    if (!st || !st.m) return;
    const v = st.m.$('video[data-media]'), fr = st.m.$('[data-yt-frame]');
    if (!el) {
      Full.leaving = 0;
      if (Full.taking === 'exit') Full.takeOn(); // the bare video is out → the page with our layer goes in
      else if (Full.taking !== 'req' && Full.on) Full.exit(); // Esc / the browser's own «exit» (all the way out now)
    } else if (el === v || el === fr) {
      // the bare video is full screen: our lines would be gone
      if (Date.now() - Full.leaving < 2500) { const ex = document.exitFullscreen || document.webkitExitFullscreen; try { const p = ex.call(document); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } }
      else if (!Full.on) Full.takeOver();
    } else if (el === document.documentElement && Full.taking) { Full.taking = false; if (!Full.on) Full.mark(true); }
    NativeSubs.sync();
  }
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, onFsChange));
  ['fullscreenerror', 'webkitfullscreenerror'].forEach(ev => document.addEventListener(ev, () => { if (Full.taking === 'req') { Full.taking = false; Full.exit(); } else NativeSubs.sync(); }));
  function syncFullBtn() {
    if (!st || !st.m) return;
    st.m.$$('[data-k="full"]:not([data-fsbtn])').forEach(b => { b.innerHTML = Full.on ? '⤡ Выйти из полного экрана' : '⛶ На весь экран'; b.title = Full.on ? 'Обычный вид (Esc)' : 'Видео на весь экран, субтитры и перевод — поверх видео (F или двойной щелчок по видео)'; });
    requestAnimationFrame(glassLayout); // the picture moved: the glass follows it
    requestAnimationFrame(ovApply); // subtitles on the video: the window's own size in the normal view
  }
  /** a double click on the picture (not on the player's buttons along the bottom, our words or the glass) = ⛶ */
  function fsDbl(e) {
    if (!st || st.stage !== 'player') return;
    const stg = e.target.closest && e.target.closest('[data-stage]'); if (!stg) return;
    if (e.target.closest('.subs-ov .sw, .subs-ovbar, .subs-glass, .subs-fsbtn, .subs-ocr-chip, .subs-asrgate, button, a, input, select')) return;
    const v = e.target.closest('video[data-media]');
    if (v) { const r = v.getBoundingClientRect(); if (e.clientY > r.bottom - 56) return; } // the bar of play / sound / time
    e.preventDefault(); e.stopPropagation();
    Full.toggle();
  }

  /* ---------- 💬 our lines for the SYSTEM's own player (iPhone full screen, Safari's / Firefox's own ⛶, picture in picture) ----------
   * There the page is not drawn — only the bare video, which shows its own text tracks. So the video gets one more
   * track of ours: the Norwegian line (with «слово (перевод)» when that mode is on) + the Russian line, the same as on our
   * layer, kept up to date when translations arrive. It is shown ONLY while the system shows the video by itself —
   * otherwise it is off (no double subtitles). No label: hls.js leaves unnamed tracks alone. */
  const NativeSubs = {
    native(v) {
      if (!v || v.tagName !== 'VIDEO') return false;
      if (Full.on && fsEl() && fsEl() !== v) return false; // the page (with our layer) is on top — Safari may still report the video
      return fsEl() === v || !!v.webkitDisplayingFullscreen || v.webkitPresentationMode === 'fullscreen' || v.webkitPresentationMode === 'picture-in-picture' || document.pictureInPictureElement === v;
    },
    sync() {
      const v = st && st.m && st.m.$('video[data-media]'); if (!v) return;
      const on = this.native(v) && !(st.stream && st.stream.companion);
      let tr = v._nkTrack;
      if (!on) { if (tr && tr.mode !== 'disabled') tr.mode = 'disabled'; if (tr) v._nkAll = false; return; }
      if (!tr) {
        if (typeof v.addTextTrack !== 'function' || typeof window.VTTCue !== 'function') return;
        try { tr = v._nkTrack = v.addTextTrack('subtitles', '', 'nb'); tr._nk = true; tr.mode = 'disabled'; } catch (e) { return; }
        v._nkCues = new Map(); // line → { cue, key }
      }
      try { this.fill(v, tr); } catch (e) { /* a line could not be added — the others are there */ }
      if (tr.mode !== 'showing') tr.mode = 'showing';
    },
    /** first time in: every line; then only around the current one (cheap — called on every new line / translation) */
    fill(v, tr) {
      const L = st.lines, M = v._nkCues, all = !v._nkAll;
      const K = Kar.prefs(), kar = K.on ? `${K.mode}:${st.ksh || 0}` : '';
      const from = all ? 0 : Math.max(0, st.cur - 20), to = all ? L.length : Math.min(L.length, Math.max(0, st.cur) + 150);
      for (let i = from; i < to; i++) {
        const l = L[i], a = lineT(l, 'start'), nx = L[i + 1];
        // a moment longer to finish reading — but never over the next line
        const b = Math.max(a + 0.3, Math.min(lineT(l, 'end') + 0.6, nx ? lineT(nx, 'start') - 0.02 : Infinity));
        // 🎤 «Бегущая строка»: a few cues for the line, one per word (karSteps) — off: one cue, as always
        const ks = kar ? karSteps(l, i, a, b) : null;
        const key = `${a}|${b}|${l.text}|${trOf(l) || ''}|${st.trMode}|${l._gl ? 1 : 0}` + (ks ? `|${kar}|${ks.map(s => `${s.s.toFixed(2)}:${s.c0}:${s.c1}`).join(',')}` : '');
        const old = M.get(l); if (old && old.key === key) continue;
        if (old) (old.cues || [old.cue]).forEach(c => { try { tr.removeCue(c); } catch (e) { /* gone */ } });
        const cues = ks ? ks.map(s => new VTTCue(s.s, s.e, this.text(l, s))) : [new VTTCue(a, b, this.text(l))];
        cues.forEach(c => tr.addCue(c)); M.set(l, { cue: cues[0], cues, key });
      }
      if (all) {
        const seen = new Set(L);
        M.forEach((x, l) => { if (!seen.has(l)) { (x.cues || [x.cue]).forEach(c => { try { tr.removeCue(c); } catch (e) { /* gone */ } }); M.delete(l); } });
        v._nkAll = true;
      }
    },
    /** s — a 🎤 step (karSteps): the word being said in bold, underlined (the system's player reads b / u) */
    text(l, s) {
      const ve = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const sk = skipTr(l), no = l.noWords ? '♪ ♪ ♪' : cueText(l.text), ru = String(trOf(l) || '').replace(/\s+/g, ' ').trim();
      if (s) return karPlain(no, ru, st.trMode === 'word' && glOk(l), s, Kar.prefs().mode === 'wbw', ve) + (ru && !sk && st.trMode !== 'hide' ? '\n' + ve(ru) : '');
      let top = no;
      if (st.trMode === 'word' && glOk(l)) { try { top = glossText(no, ru); } catch (e) { /* the plain line */ } }
      return (l.frame ? '📝 ' : '') + ve(top) + (ru && !sk && st.trMode !== 'hide' ? '\n' + ve(ru) : ''); // 📝 a text in the picture
    },
    /** the system's player shows / hides the video by itself: our track follows */
    bind(v) {
      if (!v || v.tagName !== 'VIDEO' || v._nkBound) return;
      v._nkBound = true;
      const f = () => NativeSubs.sync();
      ['webkitbeginfullscreen', 'webkitendfullscreen', 'webkitpresentationmodechanged', 'enterpictureinpicture', 'leavepictureinpicture'].forEach(ev => v.addEventListener(ev, f));
      // there the page may not be drawn (no animation frames): the time of the video moves the lines on
      v.addEventListener('timeupdate', () => { if (st && !v.paused && NativeSubs.native(v)) tick(); });
    },
  };

  /* ---------- ▭ matte glass over subtitles burned into the picture ----------
   * Some programs (NRK Super, e.g. Kodeknekkerne) have their subtitles drawn INTO the video: they cannot be read,
   * translated or split into words. The glass blurs that strip of the picture; our own lines (with the chosen
   * translation mode) are read under the video, and in full screen they sit right on the glass.
   * Never on by itself; the place and size are kept per series; hold the label to see the original. */
  const GLASS_KEY = 'nk-glass';
  const glassId = () => !st ? '' : st.stream ? st.stream.kind + ':' + (st.stream.channel && !/^NRK TV$/.test(st.stream.channel) ? st.stream.channel : st.stream.id) : 'file:' + ((st.media && st.media.name) || '');
  function glassPrefs() {
    let all = {}; try { all = JSON.parse(localStorage.getItem(GLASS_KEY) || '{}'); } catch (e) { /* defaults */ }
    const p = Object.assign({ on: false, b: 6, h: 17 }, all[glassId()] || {});
    p.b = Math.min(80, Math.max(0, +p.b || 0)); p.h = Math.min(60, Math.max(6, +p.h || 17));
    return p;
  }
  function glassSave(p) {
    try {
      const all = JSON.parse(localStorage.getItem(GLASS_KEY) || '{}');
      all[glassId()] = { on: !!p.on, b: Math.round(p.b * 10) / 10, h: Math.round(p.h * 10) / 10, at: Date.now() };
      Object.keys(all).sort((a, b) => (all[b].at || 0) - (all[a].at || 0)).slice(60).forEach(k => delete all[k]);
      localStorage.setItem(GLASS_KEY, JSON.stringify(all));
    } catch (e) { /* full */ }
  }
  /** the glass sits on the PICTURE (not on the black bars around it when the screen has another shape) */
  function glassLayout() {
    if (!st || !st.m) return;
    const stg = st.m.$('[data-stage]'), box = st.m.$('[data-glass-box]'); if (!stg || !box) return;
    const p = glassPrefs(), v = st.m.$('video[data-media]');
    const W = stg.clientWidth, H = stg.clientHeight; if (!W || !H) return;
    const ar = v && v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9;
    let w = W, h = W / ar; if (h > H) { h = H; w = H * ar; }
    Object.assign(box.style, { left: (W - w) / 2 + 'px', top: (H - h) / 2 + 'px', width: w + 'px', height: h + 'px' });
    const g = box.querySelector('[data-glass]');
    g.hidden = !p.on; g.style.bottom = p.b + '%'; g.style.height = p.h + '%';
    stg.classList.toggle('glass-on', p.on);
    // our lines sit right on the glass («Внизу» and the narrow-screen stacks; posFit places the other looks)
    st.ovGlassB = p.on && (Full.on || ovOn()) ? `${(H - h) / 2 + h * p.b / 100 + Math.max(4, h * p.h / 100 * 0.08)}px` : '';
    st.m.$$('[data-k="glass"]').forEach(b => { b.classList.toggle('on', p.on); b.setAttribute('aria-pressed', p.on ? 'true' : 'false'); });
    posFit();
  }
  function glassSet(on, quiet) {
    const p = glassPrefs(); p.on = on; glassSave(p); glassLayout();
    if (on && !quiet) UI.toast('▭ Надписи видео закрыты стеклом — потяните его выше / ниже, если нужно', '', 3500);
  }
  /** ▭ on / off. Turned on by hand in a video for the first time: the calm note (once per video) asks whether to keep it */
  function glassToggle() {
    if (ytPlain()) return; // nothing over YouTube's player
    if (glassPrefs().on) { glassSet(false); burnHide(); return; }
    const ask = !burnSaid() && !!st.m.$('[data-stage]');
    glassSet(true, ask);
    if (ask) burnNote('glass');
  }
  /* ---------- ▭ «надписи впечатаны в картинку» — a calm note, once per video; never covers anything by itself ----------
   * There is no reliable detector of text burned into the picture, so the note comes only on evidence: the user turned
   * the glass on here (the glass is on already — «Оставить как есть» takes it off again), or «🔎 Найти слова в кадре»
   * found lines in the lower part of the frame. The answer is remembered for this video (nk-burn). */
  const BURN_KEY = 'nk-burn';
  const burnId = () => (!st ? '' : st.stream ? st.stream.kind + ':' + st.stream.id : st.media ? 'file:' + st.media.name + '|' + st.media.size : '');
  function burnAll() { try { return JSON.parse(localStorage.getItem(BURN_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function burnSaid() { const id = burnId(); return !id || !!burnAll()[id]; }
  function burnSave(v) {
    const id = burnId(); if (!id) return;
    try {
      const all = burnAll(); all[id] = { v, at: Date.now() };
      Object.keys(all).sort((x, y) => all[y].at - all[x].at).slice(300).forEach(k => delete all[k]);
      localStorage.setItem(BURN_KEY, JSON.stringify(all));
    } catch (e) { /* full */ }
  }
  function burnNote(why) {
    if (ytPlain()) return;
    if (!st || !st.m || burnSaid() || st.m.$('[data-burn]')) return;
    const stg = st.m.$('[data-stage]'); if (!stg) return;
    if (why === 'ocr' && glassPrefs().on) return; // covered already
    const el = document.createElement('div');
    el.className = 'subs-burn'; el.dataset.burn = why; el.setAttribute('role', 'status');
    el.innerHTML = `<span class="sb-txt">В этом видео надписи впечатаны в картинку — бегущая строка работает на нашей строке. Закрыть их надписи матовым стеклом?</span>
      <span class="sb-act"><button type="button" class="btn sm primary" data-burn-go title="Надписи видео закроет матовое стекло — наша строка с переводом остаётся видна. Для этого видео запомнится">▭ Закрыть стеклом</button>
        <button type="button" class="btn sm" data-burn-keep title="Картинка остаётся как есть, без стекла. Для этого видео запомнится — больше не спрошу">Оставить как есть</button></span>`;
    stg.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
  }
  function burnHide() { const el = st && st.m && st.m.$('[data-burn]'); if (el) el.remove(); }
  function burnAnswer(glass) {
    burnSave(glass ? 'glass' : 'keep');
    burnHide();
    if (glass) glassSet(true); else if (glassPrefs().on) glassSet(false);
  }
  /** «🔎 Найти слова в кадре» read lines in the lower part of the frame (where subtitles sit): text burned into the picture */
  function ocrBurned(m) {
    try {
      const svg = m && m.el && m.el.querySelector('[data-fo-boxes]'); if (!svg) return false;
      const H = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.height; if (!H) return false;
      return [...svg.querySelectorAll('rect')].filter(r => +r.getAttribute('y') > H * 0.55).length >= 2;
    } catch (e) { return false; }
  }
  /** drag the glass (move), its top edge (thicker / thinner), hold the label (see the original), ✕ (off) */
  function glassWire() {
    const box = st.m.$('[data-glass-box]'), g = box && box.querySelector('[data-glass]'); if (!g || g._wired) return;
    g._wired = true;
    let drag = null, peekT = 0;
    const end = () => {
      clearTimeout(peekT); g.classList.remove('peek');
      if (drag && drag.moved) glassSave(drag.p);
      drag = null;
    };
    // the glass itself lets taps through (the player's own buttons under it keep working);
    // it is moved by its label and made thicker / thinner by the handle on its top edge
    g.addEventListener('pointerdown', e => {
      if (e.target.closest('[data-glass-off]')) return;
      const handle = e.target.closest('[data-glass-grip], .glass-tag'); if (!handle) return;
      e.preventDefault(); e.stopPropagation();
      const p = glassPrefs();
      drag = { y: e.clientY, b: p.b, h: p.h, p, grip: !!e.target.closest('[data-glass-grip]'), moved: false, H: box.clientHeight || 1 };
      try { handle.setPointerCapture(e.pointerId); } catch (_) { /* ok */ }
      if (e.target.closest('[data-glass-peek]')) peekT = setTimeout(() => { if (drag && !drag.moved) g.classList.add('peek'); }, 250);
    });
    g.addEventListener('pointermove', e => {
      if (!drag) return;
      const dy = (drag.y - e.clientY) / drag.H * 100; // up = positive
      if (!drag.moved && Math.abs(e.clientY - drag.y) < 5) return;
      drag.moved = true; clearTimeout(peekT); g.classList.remove('peek');
      if (drag.grip) drag.p.h = Math.min(60, Math.max(6, drag.h + dy));
      else drag.p.b = Math.min(100 - drag.p.h, Math.max(0, drag.b + dy));
      g.style.bottom = drag.p.b + '%'; g.style.height = drag.p.h + '%';
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => g.addEventListener(ev, () => { const moved = drag && drag.moved; end(); if (moved) glassLayout(); }));
    g.addEventListener('click', e => { if (e.target.closest('[data-glass-off]')) { e.stopPropagation(); glassSet(false); } });
    // moving the mouse / tapping the video: the glass fades a little, so the player's own buttons under it are readable
    const stg = st.m.$('[data-stage]'); let t = 0;
    const wake = () => { stg.classList.add('glass-ctl'); clearTimeout(t); t = setTimeout(() => stg.classList.remove('glass-ctl'), 2500); };
    listen(stg, 'pointermove', e => { if (e.pointerType === 'mouse' && !g.contains(e.target)) wake(); });
    listen(stg, 'pointerdown', e => { if (!g.contains(e.target)) wake(); });
    if (!st.glassWin) { st.glassWin = true; listen(window, 'resize', () => requestAnimationFrame(glassLayout)); }
    if (st.glassRO) st.glassRO.disconnect();
    if (window.ResizeObserver) { const ro = st.glassRO = new ResizeObserver(() => glassLayout()); ro.observe(stg); st.cleanup.push(() => ro.disconnect()); }
    const v = st.m.$('video[data-media]'); if (v) ['loadedmetadata', 'resize'].forEach(ev => v.addEventListener(ev, glassLayout));
    glassLayout();
  }
  /* ---------- 📝 «Надписи в кадре»: text burned into the picture, read and translated by itself ----------
   * While a video plays in OUR player (a <video>: NRK TV, own files, Telegram) and no subtitle line is on, a small copy
   * of the frame (≤ 960 px) is read every ~2 s (slower on a phone / on battery / after a long stretch with no letters;
   * never while the previous reading runs, the tab is hidden or the video stands still) — js/frameocr.js: Tesseract.js
   * in its own worker, Norwegian + English, the same download as «🔎 Найти слова в кадре» (asked once, with its size).
   * The same text in 2 readings in a row (a picture that has not changed counts as the same reading) → a «📝 В кадре»
   * line: it goes into the list at its time (a card can be made from it), is translated by the lines' own queue (the
   * cache, the fallback chain, «кто переводит»), and is shown on the video while it stays there (+1.5 s). A text that
   * repeats the subtitles around it is not shown again. A big single word in the first minutes is the title:
   * «Håp — Надежда (название)». A frame the browser won't let the page read (a video from another site without CORS)
   * switches it off for that video, with one calm note. YouTube plays in its own frame: it can't be read at all. */
  const INK_KEY = 'nk-ink', INK_SAID = 'nk-ink-taint';
  const inkPref = () => { try { return localStorage.getItem(INK_KEY) !== '0'; } catch (e) { return true; } };
  /** 0…1: how alike two texts are (a reading may differ in a letter or two from the one before) */
  function inkSim(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > Math.max(m, n) * 0.4) return 0;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return 1 - prev[n] / Math.max(m, n);
  }
  /** «DETTE ER MIN HISTORIE» / «HÅP» → «Dette er min historie» / «Håp» (capitals only are translated letter by letter) */
  const inkCase = s => (/\p{Ll}/u.test(s) || !/\p{Lu}/u.test(s) ? s : s.toLowerCase().replace(/^[^\p{L}]*\p{L}/u, c => c.toUpperCase()));
  /** the small label of a line read from the picture */
  const inkTag = (l, list) => `<span class="sl-tag ink-tag" title="Надпись, впечатанная в кадр: её прочитало и перевело приложение (в буквах возможны ошибки)">📝 В кадре${l.title && list ? ' · название' : ''}</span>`;
  /** on the video: the label + the text + its translation; a title — «Håp — Надежда (название)» in one line.
   *  The label sits in the line itself (a small picture has no room for one more row over the inscription) */
  function inkBox(l, i) {
    const tr = trOf(l);
    if (l.title) {
      return `<div class="ov-box ink title"><div class="ov-no">${inkTag(l)} ${wordsHtml(l, i)}${tr ? ` <span class="ink-dash">—</span> <span class="sl-tr ink-tr">${U.esc(tr)}</span>` : ''} <span class="ink-kind">(название)</span></div>${tr ? '' : `<div class="ov-ru">${trHtml(l)}</div>`}</div>`;
    }
    return `<div class="ov-box ink"><div class="ov-no">${inkTag(l)} ${wordsHtml(l, i)}</div><div class="ov-ru">${trHtml(l)}</div></div>`;
  }
  /** the switch in the bar on the video (short) and in the row under it; YouTube: none (its picture can't be read) */
  const inkBtn = short => (!st || st.kind !== 'video' || Ink.yt() || (st.stream && (st.stream.companion || st.stream.audio)) ? ''
    : `<button type="button" class="btn sm ink-btn${Ink.on() ? ' on' : ''}" data-k="ink" aria-pressed="${Ink.on()}" title="Надписи в кадре — титры, названия — читаются и переводятся сами, когда нет субтитров">📝 ${short ? 'Надписи' : 'Надписи в кадре'}</button>`);
  const Ink = {
    batt: null, battAsked: false,
    s() { return st.ink || (st.ink = { t: 0, busy: false, hit: null, line: null, empty: 0, cost: 0, fp: null, fpRes: null, asked: false, tainted: false }); },
    yt() { return !!(st && st.stream && st.stream.kind === 'youtube'); },
    /** the <video> whose picture can be read here (null: YouTube, sound only, the second screen, not the player yet) */
    video() {
      if (!st || !st.m || st.stage !== 'player' || st.kind !== 'video') return null;
      const S = st.stream; if (S && (S.kind === 'youtube' || S.companion || S.audio)) return null;
      return st.m.$('video[data-media]');
    },
    on() { return inkPref() && !!(window.FrameOcr && FrameOcr.auto) && FrameOcr.auto.answer() !== 'no'; },
    /** how often: ~2 s; a phone 3 s; on battery ×1.5; a long stretch without letters — up to ×3; never faster than 2× a reading */
    every() {
      const I = this.s();
      if (Cred.active()) return Math.round(Math.max(MOBILE ? 1500 : 1000, (I.cost || 0) * 1.5)); // 🎬 credits (they scroll): every second
      let ms = MOBILE ? 3000 : 2000;
      if (this.batt && this.batt.charging === false) ms *= 1.5;
      ms *= 1 + Math.min(2, Math.floor(I.empty / 6) * 0.5);
      return Math.round(Math.max(ms, (I.cost || 0) * 2));
    },
    kick(ms) {
      if (!st || !st.m) return;
      const I = this.s();
      clearTimeout(I.t); I.t = 0;
      const v = this.video();
      if (!v || v.paused || v.ended || document.hidden || I.tainted || !this.on()) return;
      if (!this.battAsked && navigator.getBattery) { this.battAsked = true; navigator.getBattery().then(b => { this.batt = b; }).catch(() => {}); }
      const me = st;
      I.t = setTimeout(() => { if (st === me) this.step(); }, ms == null ? this.every() : ms);
    },
    stop() { if (st && st.ink) { clearTimeout(st.ink.t); st.ink.t = 0; } },
    /** a jump: the text being followed ends where it was last seen; nothing is carried over */
    seek() {
      const I = st && st.ink; if (!I) return;
      if (I.line) { const l = I.line; l.end = Math.max(l.start + 0.5, (l._seen || 0) - st.offset + 1.5); I.line = null; }
      I.hit = null; I.fp = null; I.fpRes = null; I.empty = 0;
    },
    /** a subtitle line with words is on now (music-only lines and our own 📝 lines don't count) */
    cueAt(t) {
      const L = st.lines, i = indexAt(t);
      for (let k = i; k >= 0 && k > i - 6; k--) {
        const l = L[k];
        if (!l || l.frame || l.noWords || l.song) continue; // 🎵 a song heard by the app: the picture is still read (credits roll over it)
        if (t >= lineT(l, 'start') - 0.1 && t <= lineT(l, 'end') + 0.2 && /\p{L}/u.test(cueText(l.text))) return l;
      }
      return null;
    },
    async step() {
      const I = this.s(); I.t = 0;
      const v = this.video();
      if (!v || v.paused || v.ended || document.hidden || I.tainted || !this.on()) return;
      const me = st, A = FrameOcr.auto;
      let next = null;
      try {
        if (I.busy || v.seeking || v.readyState < 2 || st.ocrOpen) return;
        const t = v.currentTime;
        if (this.cueAt(t)) { this.gone(t); I.hit = null; return; }
        if (!A.ready()) { if (A.answer() === 'yes') this.load(); else this.ask(); return; }
        let shot;
        try { shot = A.grab(v); } catch (e) { if (e && e.tainted) { this.taint(); next = -1; } return; }
        if (!shot) return;
        let lines;
        if (I.fp && A.same(I.fp, shot.fp)) lines = I.fpRes; // the same picture: the same reading, no work
        else if (shot.edges < 250) lines = []; // no sharp strokes anywhere: no letters
        else {
          I.busy = true;
          const t0 = performance.now();
          try { lines = await A.read(shot); } finally { I.busy = false; }
          if (st !== me) return;
          I.cost = performance.now() - t0;
          I.empty = lines.length ? 0 : I.empty + 1;
        }
        I.fp = shot.fp; I.fpRes = lines;
        if (Cred.read(lines || [], t)) { if (I.line) this.gone(t); I.hit = null; } // 🎬 credits: names stay, roles translated
        else if (this.seen(lines || [], t)) next = 700; // something new: look again soon to be sure
      } catch (e) {
        console.warn('frame text', e);
      } finally {
        if (st === me && next !== -1) this.kick(next);
      }
    },
    /** the reading → { text, conf, h, spaced } or null (nothing / only what the subtitles around it say anyway) */
    textOf(lines, t) {
      if (!lines.length || lines.length > 5) return null; // a page of text (end credits, a document): not a caption
      const L = st.lines, i = indexAt(t), near = [];
      for (let k = Math.max(0, i - 3); k < Math.min(L.length, i + 4); k++) { const l = L[k]; if (l && !l.frame && Math.abs(lineT(l, 'start') - t) < 10) near.push(nk(cueText(l.text))); }
      const keep = lines.filter(x => { const k = nk(x.text); return k.length >= 2 && !near.some(n => n && (n.includes(k) || k.includes(n) || inkSim(n, k) >= 0.7)); });
      if (!keep.length) return null;
      const text = inkCase(keep.map(x => x.text).join(' ').replace(/\s+/g, ' ').trim());
      if (text.length < 3 || text.length > 220) return null;
      return { text, conf: keep.reduce((n, x) => n + x.conf, 0) / keep.length, h: Math.max(...keep.map(x => x.h || 0)), spaced: keep.some(x => x.spaced) };
    },
    /** → true when a new text waits for its second reading */
    seen(lines, t) {
      const I = this.s(), r = this.textOf(lines, t);
      if (!r) { I.hit = null; this.gone(t); return false; }
      const key = nk(r.text);
      if (I.line && inkSim(I.line._key, key) >= 0.75) { this.extend(I.line, t); return false; } // still there
      if (I.line) this.gone(t); // another text took its place
      if (I.hit && t - I.hit.t < 12 && inkSim(I.hit.key, key) >= 0.75) {
        this.add(I.hit.t, t, r.conf >= I.hit.conf ? r : I.hit, key);
        I.hit = null;
        return false;
      }
      I.hit = Object.assign({ key, t }, r);
      return true;
    },
    add(t0, t1, r, key) {
      const I = this.s(), L = st.lines;
      const a = Math.max(0, t0 - st.offset - 0.3), b = t1 - st.offset + this.every() / 1000 + 1;
      // the same text here before (watched again, a jump back): that line again, not a second one
      let l = L.find(x => x.frame && a >= x.start - 8 && a <= x.end + 8 && inkSim(x._key, key) >= 0.75);
      if (l) l.end = Math.max(l.end, b);
      else {
        // the title: a big single word (or letters spread wide) in the first minutes, the first one like that
        const title = !L.some(x => x.frame && x.title) && t1 < 300 && !/\s/.test(r.text) && r.text.length >= 2 && (r.h >= 0.06 || r.spaced);
        l = insertLine(a, b, r.text, false, { frame: true, key, title });
      }
      l._seen = t1; I.line = l;
      tick();
      return l;
    },
    extend(l, t) {
      l._seen = t;
      const b = t - st.offset + this.every() / 1000 + 1;
      if (b > l.end) { l.end = b; tick(); }
    },
    /** the text is no longer there (or a subtitle line came): it stays 1.5 s more */
    gone(t) {
      const I = st && st.ink, l = I && I.line; if (!l) return;
      I.line = null;
      l.end = Math.max(l.start + 0.5, (l._seen || t) - st.offset + 1.5, Math.min(l.end, t - st.offset + 1.5));
      tick();
    },
    /** «Скачать распознавание надписей?» — once, on the picture (nothing pauses, nothing moves) */
    ask() {
      const I = this.s();
      if (I.asked || !st.m) return;
      const stg = st.m.$('[data-stage]'); if (!stg || st.m.$('[data-burn]')) return;
      I.asked = true;
      const S = FrameOcr.auto.SIZE;
      const el = document.createElement('div');
      el.className = 'subs-burn subs-ink-ask'; el.dataset.inkAsk = ''; el.setAttribute('role', 'status');
      el.innerHTML = `<span class="sb-txt"><b>📝 Скачать распознавание надписей (${S})?</b> Тогда надписи, впечатанные в кадр, — титры, название фильма, вывески — будут переводиться сами, когда на экране нет субтитров. Скачивается один раз, кадры никуда не отправляются.</span>
        <span class="sb-act"><button type="button" class="btn sm primary" data-ink-dl title="Скачать один раз (${S}), дальше — из памяти браузера">⬇ Скачать (${S})</button>
          <button type="button" class="btn sm" data-ink-no title="Не скачивать. Включить можно кнопкой «📝 Надписи в кадре»">Не надо</button></span>`;
      stg.appendChild(el);
      requestAnimationFrame(() => el.classList.add('on'));
      // no answer: it steps aside after a while (asked again in the next video), the picture stays free
      setTimeout(() => { if (el.isConnected) { el.classList.remove('on'); setTimeout(() => el.remove(), 300); } }, 40000);
    },
    answer(yes) {
      const el = st && st.m && st.m.$('[data-ink-ask]'); if (el) el.remove();
      FrameOcr.auto.save(yes ? 'yes' : 'no');
      if (yes) this.load();
      else UI.toast(`Хорошо, не скачиваю.${ocrOk() ? ' Слова из кадра можно найти и вручную: пауза → «🔎 Найти слова в кадре».' : ''} Включить — кнопка «📝 Надписи в кадре».`, '', 5000);
      this.sync();
    },
    /** the engine: downloaded once (a small status on the picture while it comes) */
    load() {
      const I = this.s();
      if (I.loading || (I.loadFail && Date.now() - I.loadFail < 60000)) return;
      I.loading = true;
      const me = st, log = m => { if (st === me && I.loading && m && /load|init|download/i.test(m.status || '')) this.status(`📝 Загружаю распознавание надписей…${typeof m.progress === 'number' && m.progress > 0 ? ' ' + Math.round(m.progress * 100) + '%' : ''}`); };
      this.status('📝 Загружаю распознавание надписей…');
      FrameOcr.auto.load(log).then(() => {
        if (FrameOcr._onLog === log) FrameOcr._onLog = null;
        if (st !== me) return;
        I.loading = false; this.status(''); this.kick(200);
      }, () => {
        if (st !== me) return;
        I.loading = false; I.loadFail = Date.now(); this.status('');
        if (!I.failSaid) { I.failSaid = true; UI.toast('📝 Распознавание надписей пока не загрузилось — нужен интернет. Попробую ещё раз чуть позже.', 'warn', 5000); }
      });
    },
    status(txt) {
      if (!st || !st.m) return;
      let el = st.m.$('[data-ink-st]');
      if (!txt) { if (el) el.remove(); return; }
      const stg = st.m.$('[data-stage]'); if (!stg) return;
      if (!el) { el = document.createElement('div'); el.className = 'subs-ink-st'; el.dataset.inkSt = ''; el.setAttribute('role', 'status'); stg.appendChild(el); }
      el.textContent = txt;
    },
    /** the browser won't let the page read this picture: off for this video; the calm note once per video */
    taint() {
      const I = this.s(); I.tainted = true; this.stop();
      const id = burnId();
      let said = true;
      try {
        const all = JSON.parse(localStorage.getItem(INK_SAID) || '{}') || {};
        said = !!all[id];
        if (!said && id) { all[id] = Date.now(); Object.keys(all).sort((x, y) => all[y] - all[x]).slice(200).forEach(k => delete all[k]); localStorage.setItem(INK_SAID, JSON.stringify(all)); }
      } catch (e) { said = false; }
      if (!said) UI.toast('📝 В этом видео надписи в кадре прочитать нельзя. Субтитры и их перевод работают как обычно.', '', 5000);
      this.sync();
    },
    sync() {
      if (!st || !st.m) return;
      const bad = !!(st.ink && st.ink.tainted), on = this.on() && !bad;
      st.m.$$('[data-k="ink"]').forEach(b => {
        b.classList.toggle('on', on); b.classList.toggle('off', bad); b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.title = bad ? 'В этом видео надписи в кадре прочитать нельзя: браузер не даёт читать его картинку'
          : on ? 'Надписи в кадре — титры, названия — читаются и переводятся сами, когда нет субтитров. Нажмите, чтобы выключить'
          : 'Включить: надписи в кадре — титры, названия — будут читаться и переводиться сами, когда нет субтитров';
      });
    },
    toggle() {
      if (!st || !st.m) return;
      if (st.ink && st.ink.tainted) { UI.toast('📝 В этом видео надписи в кадре прочитать нельзя', '', 3000); return; }
      const on = !this.on();
      try { localStorage.setItem(INK_KEY, on ? '1' : '0'); } catch (e) { /* private mode */ }
      if (on && FrameOcr.auto.answer() === 'no') FrameOcr.auto.save('');
      const I = this.s();
      if (on) { I.asked = false; if (this.video() && !FrameOcr.auto.ready() && FrameOcr.auto.answer() !== 'yes') this.ask(); }
      else {
        const ask = st.m.$('[data-ink-ask]'); if (ask) ask.remove();
        this.stop(); const v = this.video(); if (v) this.gone(v.currentTime);
      }
      this.sync(); this.kick(300);
      UI.toast(on ? '📝 Надписи в кадре будут переводиться сами, когда на экране нет субтитров'
        : `📝 Надписи в кадре больше не переводятся сами${ocrOk() ? ' — их можно найти вручную: пауза → «🔎 Найти слова в кадре»' : ''}`, '', 3500);
    },
  };
  /* ---------- 🎬 Credits: «Надписи в кадре» reads them, names stay as they are, the roles are translated ----------
   * A reading is credits when it has a role word (Regi, Manus, I rollene…) or — near a role seen a moment ago, in the
   * first minutes or at the end of the film — lines that look like people's names. Names are never sent to a
   * translator: they are shown as written plus an approximate Russian reading; the roles come from a small glossary;
   * «Andrea Bræin Hovig — Anja» → «Andrea Bræin Hovig (Андреа Брэйн Ховиг) — в роли Ани (Anja)». Everything read is
   * gathered (without repeats) into one «🎬 Титры» block under the list of lines — to read after the film. While credits
   * are on screen (also scrolling end credits) the picture is read every second. */
  const CR_CAST = { ru: 'в ролях', kind: 'cast' };
  const CRED_ROLES = [
    [/^(i (hoved)?rollene|i rollene som|medvirkende|rolleliste|skuespillere|med|cast|starring)$/, 'в ролях', 'cast'],
    [/^(manus og regi|regi og manus|skrevet og regissert av)$/, 'сценарий и режиссура'],
    [/^(regi|regissør|regissert av|instruktør|instruert av|director|directed by)$/, 'режиссёр'],
    [/^(manus|manuskript|manusforfattere?|skrevet av|screenplay|written by)$/, 'сценарий'],
    [/^(foto|fotograf|filmfotograf|fotografi|kamera|kameramann|fotografisk leder|director of photography|cinematography)$/, 'оператор'],
    [/^(musikk|komponist|original ?musikk|musikk av|music|music by|original score)$/, 'музыка'],
    [/^(klipp|klipper|klippet av|redigering|editor|edited by|film editor)$/, 'монтаж'],
    [/^(utøvende produsent(er)?|executive producers?)$/, 'исполнительный продюсер'],
    [/^(produsent(er)?|produsert av|producers?|produced by)$/, 'продюсер'],
    [/^(produksjon|en produksjon (fra|av)|produksjonsselskap|production)$/, 'производство'],
    [/^(scenografi|scenograf|produksjonsdesign(er)?|production design(er)?|art director)$/, 'художник-постановщик'],
    [/^(kostymer?|kostymedesign(er)?|kostymeansvarlig|costumes?|costume design(er)?)$/, 'костюмы'],
    [/^(lyd|lyddesign(er)?|lydmiks|lydtekniker|lydmann|sound|sound design)$/, 'звук'],
    [/^(sminke|maske|maskør|make-?up)$/, 'грим'],
    [/^(casting|rollebesetning)$/, 'кастинг'],
    [/^(lys|lysmester|gaffer)$/, 'свет'],
    [/^(fargekorrigering|fargelegging|colorist)$/, 'цветокоррекция'],
    [/^(visuelle effekter|vfx|spesialeffekter)$/, 'визуальные эффекты'],
    [/^(animasjon|animation)$/, 'анимация'],
    [/^(koreografi|koreograf)$/, 'хореография'],
    [/^(stunt|stuntkoordinator)$/, 'трюки'],
    [/^(programledere?)$/, 'ведущий'],
    [/^(redaktør|ansvarlig redaktør)$/, 'редактор'],
    [/^(prosjektleder)$/, 'руководитель проекта'],
    [/^(innspillingsleder|opptaksleder|produksjonsleder)$/, 'директор съёмок'],
    [/^(teksting|oversettelse|oversatt av)$/, 'перевод и субтитры'],
    [/^(basert på|etter en roman av|basert på romanen)$/, 'по мотивам'],
    [/^((en )?(stor |spesiell |hjertelig )?takk til|takk|thanks to|special thanks)$/, 'благодарим', 'thanks'],
    [/^(i samarbeid med|støttet av|med støtte fra)$/, 'при поддержке'],
    [/^(distribusjon|distribuert av)$/, 'прокат'],
  ];
  const crRole = s => {
    const k = String(s || '').toLowerCase().replace(/[:.,;·—–\-]+\s*$/u, '').replace(/\s+/g, ' ').trim();
    if (!k) return null;
    for (const [re, ru, kind] of CRED_ROLES) if (re.test(k)) return kind === 'cast' ? CR_CAST : { ru, kind: kind || 'role' };
    return null;
  };
  // first names that are also ordinary words (Liv = жизнь, Stein = камень, Hans = его…): still names here
  const CR_FIRST = new Set('liv per stein bjørn ask sol siri vår hans eva kari mari ola ole tor are rune elin ida emma nora sara linn rolf eli rita anne mette heidi gro lise trine frode geir arne odd ulf leif kjell even sverre knut lars jon kristian henrik nils jens anja andrea maja'.split(' '));
  const CR_PART = /^(von|van|de|der|den|af|av|la|le|da|di|du|bin|mc)$/i;
  /** «ANDREA BRÆIN HOVIG» / «Andrea Bræin Hovig» → «Andrea Bræin Hovig»; anything that is not a person's name → null */
  function crName(s, one) {
    let ws = String(s || '').replace(/[,;:.]+$/, '').trim().split(/\s+/).filter(Boolean);
    if (!ws.length || ws.length > 5 || (!one && ws.length < 2)) return null;
    const caps = ws.every(w => w === w.toUpperCase());
    const tc = w => (caps ? w.toLowerCase().replace(/(^|-)\p{L}/gu, c => c.toUpperCase()) : w);
    ws = ws.map(w => (CR_PART.test(w) ? w.toLowerCase() : tc(w)));
    if (!ws.every(w => CR_PART.test(w) || /^\p{Lu}[\p{Ll}'’]*\.?(-\p{Lu}[\p{Ll}'’]*)*$/u.test(w))) return null;
    if (ws.filter(w => !CR_PART.test(w)).length < (one ? 1 : 2)) return null;
    // a misread name («Nlile» for «Nils» while the credits scroll): a name does not start with two such consonants
    if (ws.some(w => !CR_PART.test(w) && /^[^aeiouyæøåéäöü][^aeiouyæøåéäöühjlr]/i.test(w) && !/^(st|sk|sp|sv|sn|sm|sch|sh|ch|th|ph|kn|gn|ts|tz|ps|sw|wr)/i.test(w))) return null;
    const P = LID() && LangId._prof;
    const common = w => { const lw = w.toLowerCase().replace(/\.$/, ''); if (CR_FIRST.has(lw)) return false; return !!((P && (P.no.has(lw) || P.en.has(lw))) || (window.NoGloss && NoGloss.has && NoGloss.has(lw))); };
    if (ws.some(w => !CR_PART.test(w) && w.length > 1 && common(w))) return null;
    return ws.join(' ');
  }
  const crSplit = t => String(t || '').split(/\s*(?:,|&|\s+og\s+|\s+and\s+)\s*/).filter(Boolean);
  /** one reading (lines of FrameOcr.auto) → { out: [{ role, names, char }], any (a role word), names, other, role } */
  function crParse(lines, role) {
    const out = []; let any = false, names = 0, other = 0;
    for (const ln of lines) {
      const txt = String(ln.text || '').trim(), cols = ln.cols && ln.cols.length > 1 ? ln.cols : null;
      const r0 = crRole(txt);
      if (r0) { role = r0; any = true; continue; } // a heading: «I rollene», «Regi»
      if (cols) {
        const rc = crRole(cols[0]);
        if (rc) { const ns = [].concat(...cols.slice(1).map(c => crSplit(c).map(x => crName(x, true)))).filter(Boolean); if (ns.length) { out.push({ role: rc, names: ns }); any = true; role = rc; continue; } }
        // «Andrea Bræin Hovig — Anja»: the person and the character
        const pn = crName(cols[0]), ch = cols.length === 2 ? crName(cols[1], true) : null;
        if (pn && ch) { out.push({ role: CR_CAST, names: [pn], char: ch }); names++; continue; }
        const ch2 = cols.length === 2 ? crName(cols[0], true) : null, pn2 = cols.length === 2 ? crName(cols[1]) : null;
        if (role === CR_CAST && ch2 && pn2 && !pn) { out.push({ role: CR_CAST, names: [pn2], char: ch2 }); names++; continue; }
      }
      // «Regi: Ole Hansen» / «Musikk Kari Nordmann og Ola Hansen» on one line
      const ws = txt.split(/\s+/);
      let hit = null;
      for (let n = Math.min(4, ws.length - 1); n >= 1 && !hit; n--) {
        const rr = crRole(ws.slice(0, n).join(' ')); if (!rr) continue;
        const rest = ws.slice(n).join(' ').replace(/^[:—–\-]\s*/, '');
        const ns = crSplit(rest).map(x => crName(x, true)).filter(Boolean);
        if (ns.length && ns.join(' ').split(/\s+/).length >= rest.split(/\s+/).length - 1) hit = { role: rr, names: ns };
      }
      if (hit) { out.push(hit); any = true; role = hit.role; continue; }
      // just names: «Ole Hansen», «Kari Nordmann, Ola Hansen»
      const ns = crSplit(txt).map(x => crName(x)).filter(Boolean);
      if (ns.length && ns.join(' ').split(/\s+/).length >= txt.split(/\s+/).length - 1) { out.push({ role: role || null, names: ns }); names++; continue; }
      other++;
    }
    return { out, any, names, other, role };
  }
  /** an approximate Russian reading of a Norwegian name (the usual Norwegian–Russian practical transcription, simplified) */
  function crTranslitWord(w) {
    const s = w.toLowerCase(), V = 'aeiouyæøåéèêüöä';
    const isV = c => !!c && V.includes(c);
    const L1 = { a: 'а', b: 'б', d: 'д', f: 'ф', g: 'г', i: 'и', k: 'к', m: 'м', n: 'н', o: 'о', p: 'п', q: 'к', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'кс', z: 'с', æ: 'э', å: 'о', é: 'е', è: 'е', ê: 'е', ü: 'ю', ä: 'э' };
    let o = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i], n = s[i + 1] || '', p = i ? s[i - 1] : '', bi = c + n;
      if (s.startsWith('skj', i)) { o += 'ш'; i += 2; continue; }
      if (bi === 'sj') { o += 'ш'; i++; continue; }
      if (bi === 'sk' && /[iy]/.test(s[i + 2] || '')) { o += 'ш'; i++; continue; }
      if (bi === 'kj') { o += 'кь'; i++; continue; }
      if (bi === 'gj' || (bi === 'hj' && !p)) { o += 'й'; i++; continue; }
      if (bi === 'hv') { o += 'в'; i++; continue; }
      if (bi === 'ch' || bi === 'ck') { o += 'к'; i++; continue; }
      if (bi === 'ph') { o += 'ф'; i++; continue; }
      if (bi === 'th') { o += 'т'; i++; continue; }
      if (bi === 'qu') { o += 'кв'; i++; continue; }
      if (bi === 'aa') { o += 'о'; i++; continue; }
      if (c === 'j') {
        if (isV(n)) {
          const soft = { a: 'я', e: 'е', i: 'и', o: 'о', u: 'ю', y: 'ю', ø: 'ё', å: 'о', æ: 'е' }[n] || 'е';
          const head = { a: 'я', e: 'йе', i: 'йи', o: 'йо', u: 'ю', y: 'йю', ø: 'йё', å: 'йо', æ: 'йе' }[n] || 'йе';
          o += !p || isV(p) ? head : p === 'n' && n === 'a' ? 'я' : 'ь' + soft; i++; continue;
        }
        o += 'й'; continue;
      }
      if (isV(c) && c !== 'i' && (n === 'i' || n === 'y') && !isV(s[i + 2] || '')) { o += crTranslitWord(c).toLowerCase() + 'й'; i++; continue; } // ei, ai, øy: a diphthong
      if (c === 'e') { o += !p || (isV(p) && p !== 'i') ? 'э' : 'е'; continue; }
      if (c === 'ø' || c === 'ö') { o += !p ? 'э' : 'ё'; continue; }
      if (c === 'y') { o += !p ? 'и' : 'ю'; continue; }
      if (c === 'c') { o += /[eiy]/.test(n) ? 'с' : 'к'; continue; }
      if (c === 'h') { if (!(isV(p) && !isV(n))) o += 'х'; continue; } // Dahl → Даль
      if (c === 'l') { o += n === 'l' ? 'л' : !n || !isV(n) ? 'ль' : 'л'; continue; }
      o += L1[c] != null ? L1[c] : c;
    }
    return o;
  }
  const crTranslit = name => String(name || '').split(/(\s+|-)/).map(w => (/^\p{L}/u.test(w) && !CR_PART.test(w) ? (x => x.charAt(0).toUpperCase() + x.slice(1))(crTranslitWord(w)) : CR_PART.test(w) ? crTranslitWord(w) : w)).join('');
  /** «Аня» → «Ани», «Ларс» → «Ларса»; a woman's name without -а / -я (Ingrid, Solveig) stays as it is */
  function crGen(cyr, orig) {
    if (/\s/.test(cyr)) return cyr;
    if (/(rid|hild|ild|veig|run|borg|bjørg|git|rit|gunn|unn|liv|siv|karin|kristin|ellen|ann|elin|åse|dis)$/i.test(orig || '')) return cyr;
    if (/я$/.test(cyr)) return cyr.slice(0, -1) + 'и';
    if (/а$/.test(cyr)) { const b = cyr.slice(0, -1); return b + (/[гкхжшщч]$/.test(b) ? 'и' : 'ы'); }
    if (/[йь]$/.test(cyr)) return cyr.slice(0, -1) + 'я';
    if (/[бвгджзклмнпрстфхцчшщ]$/.test(cyr)) return cyr + 'а';
    return cyr;
  }
  const crCap = t => t.charAt(0).toUpperCase() + t.slice(1);
  const crNm = n => { const c = crTranslit(n); return `<b class="cr-nm">${U.esc(n)}</b>${c && c !== n ? ` <span class="cr-cyr" title="Как примерно читается по-русски">(${U.esc(c)})</span>` : ''}`; };
  const crChar = ch => `в роли ${U.esc(crGen(crTranslit(ch), ch))} <span class="cr-orig">(${U.esc(ch)})</span>`;
  /** one entry, in Russian (names as written + their reading) */
  function crHtml(e) {
    if (e.char) return `${crNm(e.names[0])} — ${crChar(e.char)}`;
    const role = e.role ? `<span class="cr-role">${U.esc(crCap(e.role.ru))}</span>${e.names.length ? ' — ' : ''}` : '';
    return role + e.names.map(crNm).join(', ');
  }
  const crKey = e => [e.role ? e.role.ru : '', e.names.map(n => n.toLowerCase()).join(','), (e.char || '').toLowerCase()].join('|');
  const Cred = {
    s() { return st.cred || (st.cred = { list: [], role: null, roleT: -1e9, seenAt: 0, until: 0 }); },
    /** credits were on screen a moment ago: the picture is read every second */
    active() { const C = st && st.cred; return !!C && Date.now() - C.seenAt < 15000; },
    /** a reading → true when it was credits (shown on the video and kept in «🎬 Титры») */
    read(lines, t) {
      if (!st || !lines || !lines.length) return false;
      const C = this.s();
      const ctx = C.role && Math.abs(t - C.roleT) < 30 ? C.role : null;
      const r = crParse(lines, ctx);
      const v = media(), dur = v && isFinite(v.duration) ? v.duration : 0;
      const zone = t < 420 || (dur > 0 && (t > dur - 900 || t > dur * 0.9));
      if (!(r.any || (r.out.length && (ctx || zone || this.active()) && r.names >= r.other))) return false;
      C.seenAt = Date.now();
      if (r.role) { C.role = r.role; C.roleT = t; }
      let changed = false;
      const pre = (x, y) => { x = x.toLowerCase(); y = y.toLowerCase(); return x === y || y.startsWith(x + ' ') || x.startsWith(y + ' '); };
      r.out.forEach(e => {
        const part = e.names.length === 1 && !e.char && C.list.find(x => x.names.length === 1 && (!x.role || !e.role || x.role.ru === e.role.ru) && pre(x.names[0], e.names[0]));
        if (part) { if (e.names[0].length > part.names[0].length) { part.names = e.names.slice(); changed = true; } if (!part.role && e.role) { part.role = e.role; changed = true; } return; }
        const same = C.list.find(x => x.names.join('|').toLowerCase() === e.names.join('|').toLowerCase() && (!x.role || !e.role || x.role.ru === e.role.ru));
        if (same) { if (!same.role && e.role) { same.role = e.role; changed = true; } if (!same.char && e.char) { same.char = e.char; changed = true; } return; }
        if (C.list.some(x => crKey(x) === crKey(e))) return;
        C.list.push(Object.assign({ t }, e)); changed = true;
      });
      this.show(r.out.length ? r.out : r.role && r.role !== CR_CAST ? [{ role: r.role, names: [] }] : r.role ? [{ role: r.role, names: [] }] : []);
      if (changed) this.block();
      return true;
    },
    show(list) {
      const el = st && st.m && st.m.$('[data-cred]'); if (!el) return;
      const C = this.s();
      C.until = Date.now() + (MOBILE ? 3500 : 2600);
      if (!list.length) return;
      el.innerHTML = `<div class="cr-box"><span class="sl-tag ink-tag cr-tag" title="Титры в кадре: имена — как написано, в скобках примерное чтение по-русски; должности переведены">🎬 Титры</span>${list.slice(0, 5).map(e => `<div class="cr-line">${crHtml(e)}</div>`).join('')}</div>`;
      el.hidden = false;
    },
    tick() {
      const C = st && st.cred; if (!C || !C.until || Date.now() < C.until) return;
      C.until = 0;
      const el = st.m && st.m.$('[data-cred]'); if (el) el.hidden = true;
    },
    blockHtml() {
      const C = st && st.cred; if (!C || !C.list.length) return '';
      const groups = new Map();
      C.list.forEach(e => { const g = e.char || (e.role && e.role.kind === 'cast') ? 'В ролях' : e.role ? crCap(e.role.ru) : 'Ещё в титрах'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(e); });
      return `<details class="subs-credits" open><summary>🎬 Титры <span class="muted">(${C.list.length})</span></summary>
        <p class="tiny muted cr-note">Имена — как написаны в фильме, в скобках — примерное чтение по-русски. Должности переведены.</p>
        ${[...groups].map(([g, es]) => `<div class="cr-grp"><div class="cr-gh">${U.esc(g)}</div><ul>${es.map(e => `<li>${e.char ? `${crNm(e.names[0])} — ${crChar(e.char)}` : e.names.map(crNm).join(', ')}</li>`).join('')}</ul></div>`).join('')}
      </details>`;
    },
    block() {
      const el = st && st.m && st.m.$('[data-credits]'); if (!el) return;
      const was = el.querySelector('details'), open = !was || was.open;
      el.innerHTML = this.blockHtml(); el.hidden = !el.innerHTML;
      const d = el.querySelector('details'); if (d && !open) d.open = false;
    },
  };

  /* ---------- 🎵 Songs (and speech) where the subtitles say nothing ----------
   * Subtitles skip the songs. Where there is no subtitle line but the sound is loud enough, the app listens to the
   * next ~8 s itself — with the same speech recognizer (NB-Whisper, on this device) that makes subtitles for
   * programmes without them — only for sources whose sound it can read: NRK (the HLS stream / a podcast), own files,
   * Telegram; never YouTube (its frame keeps the sound). NB-Whisper is told «Norwegian», so the language is judged by
   * the words it gives (js/langid.js songLang): Norwegian or English → «🎵 Песня (распознано по звуку, может быть
   * неточно): …» with a translation; another language → «🎵 Звучит песня на шведском языке», nothing translated.
   * Only with the recognizer downloaded (asked once, with its size; remembered); «Aa Вид субтитров» switches it off.
   * Gentle on the CPU: one window at a time, not while the full recognizer runs, not in a hidden tab, not on a pause. */
  const SONG_KEY = 'nk-song', SONG_ASK = 'nk-song-ask', SONG_W = 8;
  const songPref = () => { try { return localStorage.getItem(SONG_KEY) !== '0'; } catch (e) { return true; } };
  const songAns = () => { try { return localStorage.getItem(SONG_ASK) || ''; } catch (e) { return ''; } };
  const songSave = v => { try { if (v) localStorage.setItem(SONG_ASK, v); else localStorage.removeItem(SONG_ASK); } catch (e) { /* private mode */ } };
  const Song = {
    size: '', lastT: 0, busy: false, done: new Set(), segP: null, ready: false, readyAt: 0, asked: false, gen: 0,
    reset() { this.gen++; this.done = new Set(); this.segP = null; this.busy = false; this.asked = false; this.lastT = 0; this.upTo = -1; },
    on() { return songPref() && songAns() !== 'no'; },
    /** this source's sound can be read here (any: whatever the file's size — for the settings window) */
    can(any) {
      if (!st || !window.Speech || !window.LangId) return false;
      const S = st.stream;
      if (S) return !(S.kind === 'youtube' || S.companion || S.live) && !!(S.pcm || S.mp3 || S.hls || S.blob);
      if (!st.media || !st.mediaUrl) return false;
      return !!any || (Clip.fitsInMemory() && (st.media.size || 0) <= (MOBILE ? 120e6 : 400e6));
    },
    own: l => !!l && !l.auto && !l.frame && !l.song && !l.noWords && /\p{L}/u.test(l.text),
    /** the stretch without subtitle lines around t (player time) → [a, b] or null */
    gap(t) {
      let a = 0, b = Infinity;
      for (const l of st.lines) {
        if (!this.own(l)) continue;
        const s0 = lineT(l, 'start'), e0 = lineT(l, 'end');
        if (s0 <= t + 0.3 && e0 >= t - 0.3) return null;
        if (e0 < t) a = Math.max(a, e0 + 0.4); else if (s0 > t) { b = Math.min(b, s0 - 0.2); break; }
      }
      const v = media(); if (v && isFinite(v.duration) && v.duration > 0) b = Math.min(b, v.duration);
      return b - a >= 3 ? [a, b] : null;
    },
    async isReady() {
      if (this.ready) return true;
      if (Date.now() - this.readyAt < 30000) return false;
      this.readyAt = Date.now();
      try { this.ready = !!(await Speech.asrReady()); } catch (e) { this.ready = false; }
      if (!this.ready && !this.size) { try { const i = await Speech.asrInfo(); if (i && i.size) this.size = '≈' + i.size; } catch (e) { /* the usual size */ } }
      return this.ready;
    },
    /** from tick(): at most once a second */
    tick(t) {
      const now = Date.now(); if (now - this.lastT < 1000) return; this.lastT = now;
      if (this.busy || !st || st.stage !== 'player' || document.hidden || Asr.on || !this.on()) return;
      const v = media(); if (!v || v.paused || v.seeking || v.ended) return;
      if (!st.lines.some(l => this.own(l))) return; // no subtitles at all: «🤖 Создать субтитры» does the whole programme
      if (!this.can()) return;
      if (Speech.callMs > 15000) return; // this device recognizes too slowly for it to help
      this.go(t).catch(() => { /* a piece that could not be read: the next one */ });
    },
    async go(t) {
      let key = -1, a = 0, b = 0;
      // the window just ahead of what plays (recognition takes a few seconds): its words come in time
      for (const x of [t + 1, t + SONG_W + 1]) {
        const k = Math.floor(x / SONG_W); if (this.done.has(k)) continue;
        const g = this.gap(x); if (!g) continue;
        a = Math.max(g[0], k * SONG_W, t - 0.5); b = Math.min(g[1], (k + 1) * SONG_W + 1);
        if (this.upTo > a && this.upTo < b) a = this.upTo; // the window before already heard up to here
        if (b - a < 2.5) { this.done.add(k); continue; }
        key = k; break;
      }
      if (key < 0) return;
      if (!this.ready && (this.asked || songAns() === 'yes') && Date.now() - this.readyAt < 30000) return; // asked already: nothing to read until the model is here
      const me = st, gen = this.gen;
      this.busy = true;
      try {
        const pcm = await this.pcm(a, b);
        if (st !== me || gen !== this.gen) return;
        if (!pcm || pcm.length < 16000) { this.done.add(key); return; }
        let peak = 0, q = 0, n = 0; for (let i = 0; i < pcm.length; i += 4) { const x = Math.abs(pcm[i]); if (x > peak) peak = x; q += x * x; n++; }
        if (peak < 0.05 || Math.sqrt(q / Math.max(1, n)) < 0.012) { this.done.add(key); return; } // quiet: nothing to hear
        if (!(await this.isReady())) { this.done.add(key); if (b - a >= 5) this.ask(); return; } // each stretch is looked at once
        if (st !== me || gen !== this.gen || (st.ink && st.ink.busy)) return; // reading the picture right now: next second
        this.done.add(key); this.upTo = b;
        const music = !!(LangId.audioHint(pcm).music);
        const res = await Speech.transcribe(pcm, { raw: true });
        if (st !== me || gen !== this.gen) return;
        const text = String((res && res.text) || '').replace(/\s+/g, ' ').trim();
        if (!text || !/\p{L}{2}/u.test(text)) return;
        const sl = LangId.songLang(text);
        if (sl.noWords) return;
        this.put(a - st.offset, b - st.offset, text, sl.lang, music);
      } finally { if (gen === this.gen) this.busy = false; }
    },
    /** 16 kHz mono of [a, b] (player time) */
    async pcm(a, b) {
      const S = st.stream;
      if (S && S.pcm) return pcmGet(S.pcm, a, b - a);
      if (!S) return Clip.fromFull(a, b);
      if (!this.segP) this.segP = (S.blob ? Asr.pcmSegs(S, true) : S.mp3 ? Asr.mp3Segs(S.mp3, S.duration) : mediaPlaylist(S.hls).then(P => P.segs)).catch(() => []);
      const segs = await this.segP;
      const use = (segs || []).filter(x => x.start < b && x.start + x.dur > a);
      if (!use.length) return null;
      const out = new Float32Array(Math.round((b - a) * 16000));
      for (const sg of use) {
        const f = await Asr.decode(sg);
        KEnv.add(f, sg.start); // 🎤 the same sound tells the karaoke where the pauses are
        const off = Math.round((sg.start - a) * 16000);
        for (let i = Math.max(0, -off); i < f.length && i + off < out.length; i++) out[i + off] = f[i];
      }
      return out;
    },
    /** the recognized words → a line in its place («🎵 Песня…» / «🎵 Звучит песня на шведском языке») */
    put(a, b, text, lang, music) {
      const L = st.lines;
      if (L.some(l => (l.song || this.own(l)) && Math.min(l.end, b) - Math.max(l.start, a) > Math.min(1.5, (b - a) * 0.4))) return;
      if (lang === 'no' || lang === 'en') { insertLine(a, b, text, true, { song: true, lang: lang === 'en' ? 'en' : '', music }); return; }
      // another language: one calm line for the whole song (the line before grows)
      let p = null; for (let k = L.length - 1; k >= 0; k--) if (L[k].start <= a) { p = L[k]; break; }
      if (p && p.songX === lang && a - p.end < 12) { p.end = Math.max(p.end, b); redrawLine(L.indexOf(p)); tick(); return; }
      insertLine(a, b, '🎵', true, { song: true, songX: lang, music });
    },
    /** «Распознавать песни?» — once, on the picture (nothing pauses) */
    ask() {
      if (this.asked || songAns() || !st || !st.m) return;
      const stg = st.m.$('[data-stage]') || st.m.$('.subs-radio'); if (!stg || st.m.$('[data-burn]') || st.m.$('[data-ink-ask]')) return;
      this.asked = true;
      const S = this.size ? ` (${this.size})` : '';
      const el = document.createElement('div');
      el.className = 'subs-burn subs-song-ask'; el.dataset.songAsk = ''; el.setAttribute('role', 'status');
      el.innerHTML = `<span class="sb-txt"><b>🎵 Здесь поют или говорят без субтитров.</b> Распознавать такие места по звуку и переводить? Для этого один раз скачается модель распознавания речи${S}. Звук обрабатывается прямо на устройстве и никуда не отправляется.</span>
        <span class="sb-act"><button type="button" class="btn sm primary" data-song-dl>⬇ Скачать${S}</button>
          <button type="button" class="btn sm" data-song-no title="Не скачивать. Включить можно в «Aa Вид субтитров»">Не надо</button></span>`;
      stg.appendChild(el);
      requestAnimationFrame(() => el.classList.add('on'));
      setTimeout(() => { if (el.isConnected) { el.classList.remove('on'); setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 300); } }, 40000);
    },
    async answer(yes) {
      const el = st && st.m && st.m.$('[data-song-ask]'); if (el && el.parentNode) el.parentNode.removeChild(el);
      if (!yes) { songSave('no'); UI.toast('Хорошо, не скачиваю. Включить — «Aa Вид субтитров» → «🎵 Песни без субтитров».', '', 5000); return false; }
      const ok = await Speech.ensureModel({
        title: '🎵 Песни и речь без субтитров',
        lead: '<p>Там, где субтитров нет, а поют или говорят, приложение может само распознать слова по звуку и перевести их — с пометкой «🎵», потому что в пении слова легко расслышать неверно. Если поют не по-норвежски и не по-английски, приложение просто скажет, на каком языке песня.</p><p>Для этого нужна <b>модель распознавания речи</b> — её нужно скачать <b>один раз</b>.</p>',
        privacy: '🔒 Звук обрабатывается прямо на этом устройстве и никуда не отправляется.',
        okLabel: '⬇ Скачать', noBrowser: true,
      });
      if (ok) { songSave('yes'); this.ready = true; UI.toast('🎵 Готово: песни и речь без субтитров будут распознаваться сами', 'good', 3500); }
      return !!ok;
    },
    /** the switch in «Aa Вид субтитров» */
    async set(on) {
      try { localStorage.setItem(SONG_KEY, on ? '1' : '0'); } catch (e) { /* private mode */ }
      if (!on) { this.gen++; this.busy = false; return; }
      if (songAns() === 'no') songSave('');
      if (!(await this.isReady())) { this.readyAt = 0; if (!(await this.isReady())) await this.answer(true); }
    },
  };

  /* 💬 the line with its translation ON the video in the normal window too (not only in full screen) — on by default */
  const OVW_KEY = 'nk-ovwin';
  const ovOn = () => { if (!st || st.kind !== 'video' || (st.stream && (st.stream.companion || st.stream.kind === 'youtube'))) return false; try { return localStorage.getItem(OVW_KEY) !== '0'; } catch (e) { return true; } };
  function ovApply() {
    if (!st || !st.m) return;
    svApply(); // the chosen size / colours
    const on = ovOn();
    st.m.el.classList.toggle('subs-ovwin', on && !Full.on);
    st.m.$$('[data-k="ovwin"]').forEach(b => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    drawNow(); glassLayout();
  }
  function ovToggle() {
    try { localStorage.setItem(OVW_KEY, ovOn() ? '0' : '1'); } catch (e) { /* full */ }
    ovApply();
    UI.toast(ovOn() ? '💬 Субтитры с переводом — на видео' : 'Субтитры на видео скрыты (строка — под видео и в списке)', '', 2200);
  }
  /* ---------- ⊞ «Положение субтитров»: the place of OUR lines on the video (Aa Вид субтитров) ----------
   * «Внизу» (the start) and «Вверху» keep the usual size; «На весь экран» takes the biggest letters that fit the whole
   * picture; «Справа» / «Слева» put the block in a column at that edge, the two halves («Норвежский слева · перевод
   * справа» and back) put the Norwegian line and the translation in columns at the two edges — the middle of the picture
   * stays free. Black bars around the picture (a screen of another shape) are used first. A narrow video (a phone held
   * upright, under ~560 px) has no room for columns: the side looks stack under the picture, aligned to their side. */
  const POS_NARROW = 560;
  function posFit() {
    if (!st || !st.m) return;
    const ov = st.m.$('.subs-stage > [data-ov]'), stg = ov && ov.parentElement; if (!ov || !stg) return;
    const p = tvPrefs(), S = ov.style, W = stg.clientWidth, H = stg.clientHeight;
    let lay = p.pos;
    if (W && W < POS_NARROW && /^(left|right|split)/.test(lay)) lay = 'stack-' + lay;
    if (ov.dataset.pos !== lay) ov.dataset.pos = lay;
    const box = ov.firstElementChild;
    // «🔎 Найти слова в кадре» (shown on a pause) steps out of the way of the big / side looks in full screen: under the bar on top
    const chip = stg.querySelector('[data-ocr-chip]'), wide = /^(full|right|split)/.test(lay);
    if (chip && !(Full.on && wide)) { chip.style.removeProperty('top'); chip.style.removeProperty('transform'); }
    const clear = () => { ['left', 'top', 'width', 'height', '--fit', '--fit-ru', '--colw'].forEach(k => S.removeProperty(k)); delete ov.dataset.fit; st.posKey = ''; };
    if (lay === 'bottom' || lay.startsWith('stack-')) { clear(); S.bottom = st.ovGlassB || ''; return; }
    if (!W || !H || !box || !box.classList.contains('ov-box')) return; // nothing shown (or the overlay is off): placed with the next line
    // the picture inside the stage (object-fit: contain) and what must stay free: the bar on top (full screen), the player's buttons below
    const v = st.m.$('video[data-media]');
    const ar = v && v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : 16 / 9;
    let pw = W, ph = W / ar; if (ph > H) { ph = H; pw = H * ar; }
    const pl = (W - pw) / 2, pt = (H - ph) / 2, sr = stg.getBoundingClientRect();
    const sa = { t: 0, r: 0, b: 0, l: 0 };
    if (Full.on) { // the notch / rounded corners of a phone
      let pr = stg.querySelector('[data-safe]');
      if (!pr) { pr = document.createElement('span'); pr.dataset.safe = ''; pr.setAttribute('aria-hidden', 'true');
        pr.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'; stg.appendChild(pr); }
      const cs = getComputedStyle(pr); sa.t = parseFloat(cs.paddingTop) || 0; sa.r = parseFloat(cs.paddingRight) || 0; sa.b = parseFloat(cs.paddingBottom) || 0; sa.l = parseFloat(cs.paddingLeft) || 0;
    }
    const bar = Full.on && st.m.$('.subs-ovbar');
    let topRes = bar && bar.offsetHeight ? Math.max(8, bar.getBoundingClientRect().bottom - sr.top + 8) : Math.max(8, sa.t);
    if (wide && Full.on && chip) { chip.style.top = Math.round(topRes) + 'px'; chip.style.transform = 'none'; topRes += 48; }
    else if (wide && !Full.on && lay !== 'full') topRes = Math.max(topRes, 58); // the ⛶ on the video (and the 🔎 next to it) stay free above a column
    const botRes = Full.on ? Math.max(70, H * 0.09, sa.b + 56) : Math.max(48, H * 0.14);
    const m = Math.max(10, W * 0.02), xl = m + sa.l, xr = m + sa.r;
    const sc = SV_SCALE[p.size] || 1;
    const key = [lay, W, H, Math.round(topRes), Math.round(botRes), sc, p.gl, p.bg, ov.textContent, ar.toFixed(3)].join('|');
    if (st.posKey === key && ov.dataset.fit) return; // the same line in the same place: already fitted
    S.bottom = 'auto'; ['--fit-ru', '--colw', 'height'].forEach(k => S.removeProperty(k));
    const set = (k, px) => S.setProperty(k, Math.round(px) + 'px');
    // the biggest letters (≤ hi) with which the measured parts fit their room
    const fit = (lo, hi, ok) => {
      const put = f => S.setProperty('--fit', f.toFixed(1) + 'px');
      put(hi); if (ok()) return hi;
      let a = lo, b = hi;
      for (let k = 0; k < 8 && b - a > 0.5; k++) { const c = (a + b) / 2; put(c); if (ok()) a = c; else b = c; }
      put(a); return a;
    };
    ov.dataset.fit = '1';
    // the usual size of the line (as «Внизу») — columns start from it, «На весь экран» goes far above it
    const base = (Full.on ? Math.min(42, Math.max(18, innerWidth * 0.031)) : Math.min(26, Math.max(13, W * 0.033))) * sc;
    const no = box.querySelector('.ov-no'), ru = box.querySelector('.ov-ru');
    const fits = (el, w, h) => !el || (el.offsetHeight <= h + 0.5 && el.scrollWidth <= w + 1);
    if (lay === 'top') {
      // the usual size; in full screen a black bar above the picture holds it when there is room (nothing of the picture covered)
      S.removeProperty('--fit'); delete ov.dataset.fit;
      set('left', 0); set('width', W); S.removeProperty('height');
      let y = topRes;
      if (Full.on) { const h = ov.offsetHeight; y = pt - topRes >= h + 10 ? pt - h - 6 : Math.max(topRes, Math.min(pt + 6, H - botRes - h)); }
      set('top', y);
    } else if (lay === 'full') {
      // the whole room between the bar on top and the player's buttons below — the biggest letters that fit
      const aw = W - xl - xr, ah = Math.max(60, H - botRes - topRes);
      set('left', xl); set('top', topRes); set('width', aw); set('height', ah);
      S.setProperty('--fit-ru', '.74');
      fit(Math.max(12, base * 0.8), Math.max(base, Math.min(ah * 0.2, aw * 0.14, 100 * sc)), () => fits(box, aw, ah));
    } else {
      // a column at the edge: inside the black bar when it is wide enough, else ~ a third of the picture over its edge
      const bw = pl - 2 * m;
      const colW = Math.round(bw >= W * 0.2 ? Math.min(bw, W * 0.42) : Math.max(180, W * (Full.on ? 0.3 : 0.33)));
      const ah = Math.max(60, H - botRes - topRes);
      set('top', topRes); set('height', ah);
      if (lay === 'left' || lay === 'right') {
        set('left', lay === 'left' ? xl : W - xr - colW); set('width', colW);
        S.setProperty('--fit-ru', '.78');
        fit(11, base * 1.1, () => fits(box, colW, ah));
      } else { // the two halves: one column each
        set('left', xl); set('width', W - xl - xr); set('--colw', colW);
        S.setProperty('--fit-ru', '.88');
        fit(11, base * 1.1, () => fits(no, colW, ah) && fits(ru, colW, ah));
      }
    }
    st.posKey = key;
  }
  /** the small picture of a screen for each place (the chosen colours: Norwegian / translation) */
  function posIcon(k, p) {
    const r = (x, y, w, c, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h || 2.6}" rx="1.3" fill="${c}"/>`;
    const zone = x => `<rect x="${x}" y="3" width="21" height="30" rx="2.5" fill="#000" fill-opacity=".4"/>`;
    const col = (x, c1, c2) => r(x, 11, 17, c1) + r(x, 15.5, 14, c1) + r(x, 20, 17, c2) + r(x, 24.5, 11, c2);
    const no = p.no, ru = p.ru;
    const g = k === 'bottom' ? r(14, 23, 36, no) + r(20, 28, 24, ru)
      : k === 'top' ? r(14, 5, 36, no) + r(20, 10, 24, ru)
      : k === 'full' ? `<rect x="3" y="3" width="58" height="30" rx="2.5" fill="#000" fill-opacity=".3"/>` + r(8, 7, 48, no, 4.4) + r(12, 13.5, 40, no, 4.4) + r(10, 20.5, 44, ru, 3.4) + r(17, 26, 30, ru, 3.4)
      : k === 'right' ? zone(41) + col(43, no, ru)
      : k === 'left' ? zone(2) + col(4, no, ru)
      : zone(2) + zone(41) + r(4, 12, 17, k === 'split-no' ? no : ru) + r(4, 16.5, 14, k === 'split-no' ? no : ru) + r(4, 21, 16, k === 'split-no' ? no : ru)
        + r(43, 12, 17, k === 'split-no' ? ru : no) + r(43, 16.5, 13, k === 'split-no' ? ru : no) + r(43, 21, 16, k === 'split-no' ? ru : no);
    return `<svg class="sv-pos-ico" viewBox="0 0 64 36" aria-hidden="true" focusable="false"><rect x=".5" y=".5" width="63" height="35" rx="4" fill="#24324a" stroke="#fff" stroke-opacity=".25"/><path d="M1 30 L17 19 L27 26 L41 14 L63 29 V31 Q63 35 59 35 H5 Q1 35 1 31 Z" fill="#33496b"/>${g}</svg>`;
  }
  /* ---------- 🎤 «Бегущая строка»: the words light up as they are said (karaoke) ----------
   * The line is drawn as always (posFit, «Подложка», the 7 places, «слово (перевод)»); only classes on its words change
   * (kp — said, kc — being said, kf — still to come), so nothing jumps. Word times, the best the source allows:
   *  1. exact: WebVTT <00:00:01.250> marks, ASS {\k} karaoke, YouTube automatic captions (json3 word offsets — when the
   *     bridge sends them as cue.w), NRK live captions that grow word by word (each new word = its moment);
   *  2. by the sound — read WITHOUT touching the playing video: own files (the decoded sound track, the same one card
   *     sounds are cut from), NRK programmes / podcasts / Telegram (the 16 kHz pieces the recognizer reads too), our own
   *     recognized lines (the very sound Whisper heard). 10 ms frames, a level between the quiet floor and the speech
   *     level: where the speech starts / ends and its pauses; pauses go to word boundaries (punctuation first), the
   *     words share the voiced time by their syllables. Music under the speech (no clear pauses) → layer 3;
   *  3. estimated: syllables + punctuation pauses inside the line's own time (≈ 5.5 syllables a second, from the start
   *     of the line; a long display time is not stretched over the words).
   * «⏱ Сдвиг слов» ±1 s (remembered per video). Reduced motion (or the app's own motion setting): colour only. */
  const KAR_KEY = 'nk-kar', KSH_KEY = 'nk-kar-sh';
  const SPU = 0.17; // seconds per unit (≈ a syllable)
  const VOW = /[aeiouyæøåéèêëóòôöüúùûáàâäíìîï]+/giu;
  const nWords = t => String(t || '').split(/\s+/).filter(w => /\p{L}/u.test(w)).length;
  /** a cue's own word times: c.wt (aligned with its words) or c.w = [[seconds, piece], …] (the bridge: YouTube's json3) */
  function cueWordTimes(c) {
    const n = nWords(c.text); if (!n) return null;
    if (Array.isArray(c.wt) && c.wt.length === n) return c.wt.map(x => (x != null && isFinite(+x) ? +x : NaN));
    if (Array.isArray(c.w) && c.w.length && c.w.length < 3000) {
      const times = []; let raw = '';
      c.w.forEach(p => { if (Array.isArray(p) && p[0] != null && isFinite(+p[0])) { times.push(+p[0]); raw += ' ' + String.fromCharCode(0xE000 + times.length - 1) + String(p[1] == null ? '' : p[1]); } });
      if (!times.length) return null;
      const r = markTimes(raw, times, c.start);
      if (r.wt.length === n) return r.wt;
    }
    return null;
  }
  /** 📡 NRK live: the line grew word by word → the moment of each new word (the first words: the line's start) */
  function liveWt(m, off) {
    const n = nWords(m.t); if (!n) return undefined;
    const wt = new Array(n).fill(NaN); wt[0] = m.s - off;
    (m.ws || []).forEach(([k, g]) => { if (k > 0 && k < n) wt[k] = g - off; });
    return wt;
  }
  /** words → weights (syllables + a little for long consonant clusters) and the pause after each (punctuation, numbers) */
  function karShape(text) {
    const W = [], P = [];
    String(text || '').split(/\s+/).filter(Boolean).forEach(tok => {
      const pause = /[.!?…]["»”')\]]*$/.test(tok) ? 1.8 : /[,;:]["»”')\]]*$/.test(tok) ? 1 : 0;
      if (/\p{L}/u.test(tok)) {
        const core = bare(tok).toLowerCase(), syl = (core.match(VOW) || []).length || 1;
        W.push(0.6 * syl + 0.08 * core.length + 0.45);
        P.push(pause);
      } else if (W.length) P[P.length - 1] += /\d/.test(tok) ? tok.replace(/\D/g, '').length * 1.3 + 0.3 : 0.8; // «15» is said, «–» is a breath
    });
    return { W, P };
  }
  /** the line's word starts { t: [line time of each word], e: the end of the last word, src: exact | audio | est } */
  function kwCalc(l, prev, next) {
    const { W, P } = karShape(l.text), n = W.length; if (!n) return null;
    const a = l.start, b = Math.max(l.end, a + 0.3);
    const cum = [0]; for (let k = 0; k < n; k++) cum.push(cum[k] + W[k] + (k < n - 1 ? P[k] : 0));
    // 1. the subtitles know the time of the words
    if (l.wt && l.wt.length === n) {
      const t = l.wt.map(x => (isFinite(x) ? x : NaN));
      const known = t.filter(x => isFinite(x)).length;
      if (known >= Math.min(2, n)) {
        for (let k = 0; k < n; k++) {
          if (isFinite(t[k])) continue;
          let j = k + 1; while (j < n && !isFinite(t[j])) j++;
          if (k === 0 || !isFinite(t[k - 1])) t[k] = j < n ? Math.max(a, t[j] - (cum[j] - cum[k]) * SPU) : a;
          else if (j >= n) t[k] = t[k - 1] + (cum[k] - cum[k - 1]) * SPU;
          else t[k] = t[k - 1] + (t[j] - t[k - 1]) * (cum[k] - cum[k - 1]) / Math.max(1e-6, cum[j] - cum[k - 1]);
        }
        for (let k = 1; k < n; k++) t[k] = Math.max(t[k], t[k - 1] + 0.02);
        const last = t[n - 1];
        return { t, e: Math.max(last + 0.2, Math.min(Math.max(b, last + 0.3), last + Math.max(0.3, W[n - 1] * SPU * 1.2))), src: 'exact' };
      }
    }
    // 2. the sound of this moment is known: speech, pauses
    let lo = a - 0.3, hi = b + 0.3;
    if (prev && prev.end - 0.05 > lo) lo = Math.min(a, prev.end - 0.05);
    if (next && next.start + 0.05 < hi) hi = Math.max(a + 0.5, next.start + 0.05);
    const env = KEnv.slice(lo + st.offset, hi + st.offset);
    if (env) { const r = kwAudio(W, P, cum, env, st.offset); if (r) return r; }
    // 3. syllables in the line's own time
    const U = cum[n], nat = U * SPU, lead = Math.min(0.1, (b - a) * 0.04), avail = Math.max(0.2, b - a - lead);
    const span = Math.min(avail, Math.max(nat, Math.min(avail * 0.82, nat * 1.6)));
    return { t: cum.slice(0, n).map(c => a + lead + c / U * span), e: a + lead + span, src: 'est' };
  }
  /** layer 2: the words over the voiced frames of the line (null — the sound does not tell enough) */
  function kwAudio(W, P, cum, env, off) {
    const db = env.db, F = db.length, t0 = env.t0 - off, n = W.length;
    const srt = Float32Array.from(db).sort();
    const p10 = srt[Math.floor(F * 0.1)], p90 = srt[Math.floor(F * 0.9)];
    if (!(p90 - p10 >= 9) || p90 < -60) return null; // no clear speech against pauses (music, noise, silence)
    const thr = p10 + (p90 - p10) * 0.3;
    const v = new Uint8Array(F); for (let f = 0; f < F; f++) v[f] = db[f] >= thr ? 1 : 0;
    const smooth = (val, max, inner) => { // runs of `val` shorter than max frames flip (gaps inside speech / blips of noise)
      for (let f = 0; f < F;) { if (v[f] !== val) { f++; continue; } let g = f; while (g < F && v[g] === val) g++; if (g - f < max && (!inner || (f > 0 && g < F))) v.fill(1 - val, f, g); f = g; }
    };
    smooth(0, 6, true); smooth(1, 5, false);
    let f0 = v.indexOf(1), f1 = v.lastIndexOf(1); if (f0 < 0) return null;
    const nat = cum[n] * SPU;
    const gaps = [];
    for (let f = f0; f <= f1;) { if (v[f]) { f++; continue; } let g = f; while (g <= f1 && !v[g]) g++; if (g - f >= 12) gaps.push({ a: f, b: g }); f = g; }
    // a long display time with more sound after the words (music, the next speaker): stop at a clear pause after them
    if ((f1 - f0) / 100 > nat * 2.2) {
      const k = gaps.findIndex(g => (g.a - f0) / 100 > nat * 0.9 && g.b - g.a >= 25);
      if (k >= 0) { f1 = gaps[k].a - 1; gaps.splice(k); }
    }
    if ((f1 + 1 - f0) / 100 < Math.max(0.25, nat * 0.35)) return null; // too little speech for this line: not it
    const cv = new Float32Array(F + 1); for (let f = 0; f < F; f++) cv[f + 1] = cv[f] + (f >= f0 && f <= f1 && v[f] ? 1 : 0);
    const V = cv[f1 + 1]; if (V < 15) return null;
    const atV = x => { let p = f0, q = f1 + 1; while (p < q) { const m = (p + q) >> 1; if (cv[m + 1] <= x) p = m + 1; else q = m; } return Math.min(p, f1); };
    const cw = [0]; for (let k = 0; k < n; k++) cw.push(cw[k] + W[k] + (k < n - 1 ? P[k] * 0.3 : 0));
    const est = j => V * cw[j] / cw[n];
    // the clearest pauses first, each to the nearest word boundary (after a comma / full stop preferred), in order
    const anch = [];
    gaps.slice().sort((x, y) => (y.b - y.a) - (x.b - x.a)).forEach(g => {
      const gv = cv[g.a]; let best = -1, bc = Infinity;
      for (let j = 1; j < n; j++) {
        if (anch.some(q => q.j === j || (q.j < j) !== (q.a < g.a))) continue;
        const d = Math.abs(est(j) - gv), pun = P[j - 1] > 0;
        if (d > Math.max(30, V * 0.22) * (pun ? 1.6 : 1)) continue;
        const c = d * (pun ? 0.45 : 1); if (c < bc) { bc = c; best = j; }
      }
      if (best > 0) anch.push({ j: best, a: g.a, b: g.b });
    });
    anch.sort((x, y) => x.j - y.j);
    const pts = [{ j: 0, fb: f0 }].concat(anch.map(q => ({ j: q.j, fa: q.a, fb: q.b })), [{ j: n, fa: f1 + 1 }]);
    const t = new Array(n);
    for (let g = 0; g + 1 < pts.length; g++) {
      const A = pts[g], B = pts[g + 1], vA = cv[A.fb], vB = cv[B.fa];
      for (let k = A.j; k < B.j; k++) t[k] = t0 + atV(vA + (vB - vA) * (cw[k] - cw[A.j]) / Math.max(1e-6, cw[B.j] - cw[A.j])) / 100;
    }
    for (let k = 1; k < n; k++) t[k] = Math.max(t[k], t[k - 1] + 0.03);
    return { t, e: Math.max(t[n - 1] + 0.15, t0 + (f1 + 1) / 100), src: 'audio' };
  }
  function kwOf(l, prev, next) {
    const key = `${l.text}|${l.start}|${l.end}|${st.offset}|${KEnv.ver}|${l.wt ? l.wt.join(',') : ''}`;
    if (l._kw && l._kw.key === key) return l._kw.r;
    let r = null; try { r = kwCalc(l, prev, next); } catch (e) { r = null; }
    l._kw = { key, r };
    return r;
  }

  /* the sound's loudness, 100 frames a second (dB), by the player's time — only read while «Бегущая строка» is on */
  const KEnv = {
    ch: [], ver: 0, gen: 0, segP: null, done: new Set(), q: [], busy: false, fails: 0, fullP: null,
    reset() { this.ch = []; this.ver++; this.gen++; this.segP = null; this.done = new Set(); this.q = []; this.busy = false; this.fails = 0; this.fullP = null; },
    add(pcm, t0, rate = 16000) {
      const hop = Math.round(rate / 100), n = Math.floor((pcm && pcm.length || 0) / hop);
      if (n < 10 || !isFinite(t0) || this.has(t0 + 0.05, t0 + n / 100 - 0.05)) return;
      const db = new Float32Array(n);
      for (let f = 0; f < n; f++) { let q = 0; for (let j = f * hop, e = j + hop; j < e; j++) q += pcm[j] * pcm[j]; db[f] = 10 * Math.log10(q / hop + 1e-10); }
      this.put({ t0, db });
    },
    put(c) { this.ch.push(c); this.ch.sort((x, y) => x.t0 - y.t0); if (this.ch.length > 3000) this.ch.splice(0, this.ch.length - 3000); this.ver++; },
    has(a, b) { return this.ch.some(c => c.t0 <= a && c.t0 + c.db.length / 100 >= b); },
    /** [a, b] of the player's time → { t0, db } when ≥ 90 % of it is known */
    slice(a, b) {
      const n = Math.round((b - a) * 100); if (n < 10 || !this.ch.length) return null;
      const out = new Float32Array(n).fill(NaN);
      for (const c of this.ch) {
        if (c.t0 + c.db.length / 100 <= a || c.t0 >= b) continue;
        const o = Math.round((c.t0 - a) * 100), from = Math.max(0, -o), to = Math.min(c.db.length, n - o);
        for (let k = from; k < to; k++) out[k + o] = c.db[k];
      }
      let miss = 0, mn = 0; for (let k = 0; k < n; k++) { if (out[k] !== out[k]) miss++; else if (out[k] < mn) mn = out[k]; }
      if (miss > n * 0.1) return null;
      if (miss) for (let k = 0; k < n; k++) if (out[k] !== out[k]) out[k] = mn;
      return { t0: a, db: out };
    },
    /** the line i and the next two: their sound, if it can be read here */
    want(i) {
      if (!st || !Kar.prefs().on || st.stage !== 'player' || i < 0 || !st.lines[i]) return;
      const S = st.stream;
      if (S && (S.kind === 'youtube' || S.live || S.companion)) return; // YouTube: its frame only; live: the recognizer's own pieces
      if (!S || S.blob) { if (st.media) this.whole(); return; }
      if (!(S.pcm || S.mp3 || S.hls)) return;
      if (navigator.connection && navigator.connection.saveData) return; // «экономия трафика»: by syllables
      const need = [];
      for (let k = i; k < Math.min(st.lines.length, i + 3); k++) { const l = st.lines[k]; need.push([l.start + st.offset - 0.4, l.end + st.offset + 0.4]); }
      this.seg(need).catch(() => {});
    },
    /** own file: the whole sound track once (not for a big film — that would cost a lot of memory just for this) */
    whole() {
      if (this.fullP) return;
      const big = !Clip._full && (!Clip.fitsInMemory() || (st.media.size || 0) > (MOBILE ? 80e6 : 250e6));
      if (big) { this.fullP = Promise.resolve(); return; }
      const me = st, gen = this.gen;
      this.fullP = (async () => {
        try {
          const { pcm, rate } = await Clip.full();
          if (st !== me || gen !== this.gen) return;
          const hop = Math.round(rate / 100), n = Math.floor(pcm.length / hop), db = new Float32Array(n), K = 1 / (32767 * 32767 * hop);
          for (let f = 0; f < n; f++) {
            let q = 0; for (let j = f * hop, e = j + hop; j < e; j++) q += pcm[j] * pcm[j];
            db[f] = 10 * Math.log10(q * K + 1e-10);
            if ((f & 16383) === 16383) { await new Promise(r => setTimeout(r, 0)); if (st !== me || gen !== this.gen) return; }
          }
          this.put({ t0: 0, db });
        } catch (e) { /* this sound can't be decoded here — by syllables */ }
      })();
    },
    /** a stream: the same 4.8 s pieces the recognizer reads (NRK HLS, a podcast's MP3, Telegram's PCM from the bridge) */
    async seg(need) {
      const S = st.stream, me = st, gen = this.gen;
      if (this.fails > 3) return;
      if (!this.segP) this.segP = (S.pcm ? Asr.pcmSegs(S) : S.mp3 ? Asr.mp3Segs(S.mp3, S.duration) : mediaPlaylist(S.hls).then(P => P.segs)).catch(() => []);
      const segs = await this.segP; if (st !== me || gen !== this.gen || !segs.length) return;
      need.forEach(([x, y]) => segs.forEach((s, k) => { if (s.start < y && s.start + s.dur > x && !this.done.has(k) && !this.q.includes(k)) this.q.push(k); }));
      if (this.busy) return;
      this.busy = true;
      try {
        while (this.q.length && st === me && gen === this.gen && Kar.prefs().on) {
          const k = this.q.shift(), s = segs[k]; this.done.add(k);
          if (this.has(s.start + 0.1, s.start + s.dur - 0.1)) continue; // the recognizer has read it already
          try { const pcm = await Asr.decode(s); if (st !== me || gen !== this.gen) return; this.add(pcm, s.start); this.fails = 0; }
          catch (e) { if (++this.fails > 3) break; }
        }
      } finally { this.busy = false; }
    },
  };

  /** animate? the device's «reduce motion» — unless the app's own setting says otherwise (Store.settings.forceMotion) */
  function karMotion() {
    try {
      const s = window.Store && Store.state && Store.settings;
      const f = s && (s.forceMotion != null ? s.forceMotion : s.motion);
      if (f === true || f === 'on' || f === 'always') return true;
      if (f === false || f === 'off' || f === 'never') return false;
    } catch (e) { /* settings not loaded */ }
    return !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  const KAR_SRC = {
    exact: ['✓ Точно', 'Время каждого слова записано в самих субтитрах'],
    audio: ['🎧 По звуку', 'Приложение послушало звук этой строки: где начинается речь и где паузы'],
    est: ['≈ Примерно', 'Время слов рассчитано по слогам внутри строки. Спешат или опаздывают — поправьте «⏱ Сдвиг слов»'],
  };
  const fmtSh = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1).replace('.', ',') + ' с';
  const Kar = {
    p: null, boxes: null, ci: null, li: -2, r: null, fill: [], srcNow: '',
    prefs() {
      if (this.p) return this.p;
      let p = {}; try { p = JSON.parse(localStorage.getItem(KAR_KEY) || '{}') || {}; } catch (e) { /* defaults */ }
      // on by default — off only when the user turned it off (remembered)
      return (this.p = { on: p.on !== false, mode: p.mode === 'wbw' ? 'wbw' : 'hl' });
    },
    save() { try { localStorage.setItem(KAR_KEY, JSON.stringify(this.p)); } catch (e) { /* full */ } },
    /** «⏱ Сдвиг слов» of this video / programme (the last 80 kept) */
    shKey: () => (st.media ? st.media.name + '|' + st.media.size : st.noFile ? 'f:' + st.noFile.name : ''),
    shLoad() { let v = 0; try { const all = JSON.parse(localStorage.getItem(KSH_KEY) || '{}'); const x = all[this.shKey()]; v = x && isFinite(x.v) ? U.clamp(+x.v, -1, 1) : 0; } catch (e) { /* none */ } st.ksh = v; },
    shSave() {
      try {
        const all = JSON.parse(localStorage.getItem(KSH_KEY) || '{}') || {}, k = this.shKey(); if (!k) return;
        if (st.ksh) all[k] = { v: st.ksh, at: Date.now() }; else delete all[k];
        Object.keys(all).sort((a, b) => all[b].at - all[a].at).slice(80).forEach(x => delete all[x]);
        localStorage.setItem(KSH_KEY, JSON.stringify(all));
      } catch (e) { /* full */ }
    },
    btn(cls = '') {
      const on = this.prefs().on;
      return `<button type="button" class="btn sm kar-btn ${cls}${on ? ' on' : ''}" data-k="kar" aria-pressed="${on}" title="Бегущая строка: слово загорается в тот момент, когда его произносят — вместе с переводом">🎤<span class="kar-btn-t"> Бегущая строка</span></button>`;
    },
    /** the small «✨ Строка / 👣 По словам» switch next to «🎤 Бегущая строка» (a choice turns the karaoke on too) */
    mini() {
      const p = this.prefs();
      return `<span class="seg-mini sm kar-mini${p.on ? '' : ' off'}" data-karmini role="group" aria-label="Как бежит строка">${[['hl', '✨ Строка', 'Видна вся строка, звучащее слово светится'], ['wbw', '👣 По словам', 'Слова появляются по одному — как их произносят']].map(([k, t, tip]) =>
        `<button type="button" data-karmode="${k}" class="${p.mode === k ? 'active' : ''}" aria-pressed="${p.on && p.mode === k}" title="${tip}${p.on ? '' : ' (включит бегущую строку)'}">${t}</button>`).join('')}</span>`;
    },
    bar() {
      const p = this.prefs();
      return `<div class="subs-kar" data-karbar ${p.on ? '' : 'hidden'}>
          <span class="seg-mini sm kar-modes" role="group" aria-label="Как бежит строка">
            <button type="button" data-karmode="hl" class="${p.mode === 'hl' ? 'active' : ''}" aria-pressed="${p.mode === 'hl'}" title="Видна вся строка, звучащее слово светится, сказанные остаются">✨ Подсветка</button>
            <button type="button" data-karmode="wbw" class="${p.mode === 'wbw' ? 'active' : ''}" aria-pressed="${p.mode === 'wbw'}" title="Слова появляются по одному — как их говорят">👣 Слово за словом</button>
          </span>
          <span class="kar-sh" title="Слова спешат или опаздывают? Сдвиньте их — запомнится для этого видео"><span class="small muted">⏱ Сдвиг слов</span>
            <button type="button" class="btn sm ghost" data-karsh="-0.1" aria-label="Слова раньше на 0,1 секунды">−</button><b data-kshv>${fmtSh(st.ksh || 0)}</b><button type="button" class="btn sm ghost" data-karsh="0.1" aria-label="Слова позже на 0,1 секунды">+</button></span>
          <span class="tiny muted kar-src" data-karsrc role="status"></span>
          <button type="button" class="btn sm ghost kar-exact" data-karexact aria-expanded="false" title="Точная бегущая строка: приложение будет сверять каждое слово со звуком своим распознаванием речи. Скоро — нажмите, чтобы узнать подробнее">🎯 Точная <span class="kar-soon">скоро</span></button>
          <button type="button" class="btn sm ghost kar-q" data-karhelp title="Как работает бегущая строка" aria-label="Как работает бегущая строка">?</button>
          <div class="kar-exact-note small" data-karexact-note role="status" hidden></div>
        </div>`;
    },
    /** buttons, the bar and the words follow the choice */
    sync() {
      if (!st || !st.m) return;
      const p = this.prefs();
      st.m.$$('[data-k="kar"]').forEach(b => { b.classList.toggle('on', p.on); b.setAttribute('aria-pressed', p.on ? 'true' : 'false'); });
      st.m.$$('[data-karbar]').forEach(b => { b.hidden = !p.on; });
      st.m.$$('[data-karmode]').forEach(b => { const on = b.dataset.karmode === p.mode; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on && p.on ? 'true' : 'false'); });
      st.m.$$('[data-karmini]').forEach(b => b.classList.toggle('off', !p.on));
      st.m.$$('[data-kshv]').forEach(b => { b.textContent = fmtSh(st.ksh || 0); });
      this.srcNow = ''; this.bind();
    },
    set(on, mode, quiet) {
      if (!st) return;
      const p = this.prefs(), was = p.on;
      p.on = !!on; if (mode) p.mode = mode === 'wbw' ? 'wbw' : 'hl';
      this.save(); this.sync();
      if (p.on) KEnv.want(Math.max(0, st.cur));
      this.others(true);
      if (quiet) return;
      if (p.on && !was) {
        UI.toast(p.mode === 'wbw' ? '🎤 Бегущая строка: слова появляются по одному, как их говорят' : '🎤 Бегущая строка: звучащее слово светится', '', 2600);
        this.coach();
      } else if (!p.on && was) UI.toast('Бегущая строка выключена — обычные субтитры', '', 2000);
    },
    /** 🎯 «Точная бегущая строка» — not yet: what it will do and what it would download (the recognition model) */
    async exact() {
      if (!st || !st.m) return;
      const box = st.m.$('[data-karexact-note]'), btn = st.m.$('[data-karexact]'); if (!box) return;
      if (!box.hidden) { box.hidden = true; if (btn) btn.setAttribute('aria-expanded', 'false'); return; }
      let size = '≈110 МБ', ready = false;
      try { if (window.Speech && Speech.asrInfo) { const i = await Speech.asrInfo(); ready = !!i.ready; if (i.size && i.missingBytes > 0) size = '≈' + i.size; } } catch (e) { /* the usual size */ }
      if (!st || !st.m || !box.isConnected) return;
      box.innerHTML = `<span><b>🎯 Точная бегущая строка — скоро.</b> Приложение будет сверять каждое слово этой и следующей строки со звуком — своим распознаванием речи, прямо на устройстве.
        ${ready ? 'Модель распознавания у вас уже скачана — докачивать ничего не придётся.' : `Для этого один раз скачается модель распознавания норвежской речи (NB-Whisper, ${size}).`}
        Сейчас время слов приложение узнаёт по паузам в речи или по слогам.</span>
        <button type="button" class="btn sm" data-karexact-x title="Скрыть это пояснение">Понятно</button>`;
      box.hidden = false; if (btn) btn.setAttribute('aria-expanded', 'true');
    },
    /** 👆 the first time: what is where (Help.coach — shown once per device; «?» repeats the explanation) */
    coach() {
      if (!window.Help || !Help.coach || (Help.coachSeen && Help.coachSeen('kar'))) return;
      setTimeout(() => {
        if (!st || !st.m || !this.prefs().on) return;
        Help.coach([
          { target: ['.subs-modal .subs-ov:not(.gone) .ov-no', '.subs-modal .subs-now .sn-no', '.subs-modal [data-karbar]'], title: '🎤 Слово светится, когда его говорят', text: 'Слушайте и читайте одновременно: звучащее слово ярче, сказанные остаются, следующие — бледнее. Перевод слова загорается вместе с ним.' },
          { target: '.subs-modal [data-karbar] .kar-modes', title: '✨ Подсветка или 👣 Слово за словом', text: '«Подсветка» — видна вся строка. «Слово за словом» — слова появляются по одному, как их произносят.' },
          { target: '.subs-modal [data-karbar] .kar-sh', title: '⏱ Сдвиг слов', text: 'Слова спешат или опаздывают? Нажмите − или + (по 0,1 секунды). Приложение запомнит это для видео.' },
          { target: '.subs-modal [data-karbar] [data-karsrc]', title: '🎯 Насколько точно', text: '«Точно» — время слов есть в субтитрах. «По звуку» — приложение нашло паузы в речи. «Примерно» — по слогам.' },
          { target: '.subs-modal [data-karbar] [data-karhelp]', title: '? Как это работает', text: 'Короткая анимированная подсказка — всегда здесь.' },
        ], { id: 'kar', once: true });
      }, 650);
    },
    nudge(d) {
      st.ksh = U.clamp(Math.round(((st.ksh || 0) + d) * 10) / 10, -1, 1);
      this.shSave();
      st.m.$$('[data-kshv]').forEach(b => { b.textContent = fmtSh(st.ksh); });
      const v = media(); if (v) this.frame(v.currentTime, true);
      this.others(false);
    },
    /** after the line is drawn: its words, by their index (the line on the video and the one under it) */
    bind() {
      if (!st || !st.m) return;
      const cl = st.lines[st.cur], el = st.m.el, p = this.prefs(), on = p.on && st.stage === 'player' && !(cl && cl.frame); // 📝 a line in the picture is not said
      el.classList.toggle('kar-on', on); el.classList.toggle('kar-wbw', on && p.mode === 'wbw'); el.classList.toggle('kar-still', on && !karMotion());
      this.boxes = []; this.ci = null; this.li = st.cur; this.r = null; this.fill = [];
      if (!on) { st.m.$$('.kp, .kc, .kf').forEach(e => { e.classList.remove('kp', 'kc', 'kf'); e.style.removeProperty('--kp'); }); this.src(null); return; }
      st.m.$$('[data-ov] .ov-no, [data-now] .sn-no').forEach(root => {
        const m = new Map();
        root.querySelectorAll('[data-wi]').forEach(e => { const k = +e.dataset.wi; if (!m.has(k)) m.set(k, []); m.get(k).push(e); });
        if (m.size) this.boxes.push(m);
      });
      const v = media(); if (v && this.boxes.length) this.frame(v.currentTime, true);
      else this.src(null);
    },
    /** every frame (and on a seek / pause): which word is being said now */
    frame(t, force) {
      if (!this.boxes || !this.boxes.length || !st || st.cur < 0) return;
      if (this.li !== st.cur) { this.bind(); return; }
      const L = st.lines, l = L[st.cur]; if (!l) return;
      const r = kwOf(l, L[st.cur - 1], L[st.cur + 1]); if (!r) return;
      const x = t - st.offset - (st.ksh || 0), n = r.t.length, wbw = this.prefs().mode === 'wbw';
      let c = -1; while (c + 1 < n && r.t[c + 1] <= x) c++;
      if (c === n - 1 && x > r.e + 0.12) c = n; // said: every word stays lit
      if (wbw && c < 0) c = 0; // the first word is there with the line (no empty box)
      if (c !== this.ci || force || r !== this.r) {
        const bar = karMotion() && !wbw;
        this.fill = [];
        this.boxes.forEach(m => m.forEach((els, k) => {
          const cls = k < c ? 'kp' : k === c ? 'kc' : 'kf';
          els.forEach(e => { if (!e.classList.contains(cls)) { e.classList.remove('kp', 'kc', 'kf'); e.classList.add(cls); } if (k === c && bar && e.classList.contains('sw')) this.fill.push(e); });
        }));
        this.ci = c; this.r = r;
        this.src(r.src);
      }
      if (this.fill.length && c >= 0 && c < n) {
        const e = c + 1 < n ? r.t[c + 1] : r.e, p = U.clamp((x - r.t[c]) / Math.max(0.05, e - r.t[c]), 0, 1).toFixed(3);
        this.fill.forEach(el => el.style.setProperty('--kp', p));
      }
    },
    src(s) {
      if (s === this.srcNow || !st || !st.m) return;
      this.srcNow = s;
      const k = KAR_SRC[s], el = st.m.$('[data-karsrc]'); if (!el) return;
      el.textContent = k ? k[0] : ''; el.title = k ? k[1] : '';
      el.dataset.src = s || '';
    },
    /** the choice changed: the system's own player, our TV page and the TV through the bridge follow */
    others(resend) {
      try { NativeSubs.sync(); } catch (e) { /* not in the system's player */ }
      try { if (resend) Cast.kar(); else Cast.style(); } catch (e) { /* no TV */ }
      try { tvStale(); } catch (e) { /* no TV */ }
    },
  };
  /* ---------- 🎤 the same «Бегущая строка» on the TV and in the system's own player ----------
   * A WebVTT cue can't light up a word by itself, so one line becomes a few cues in a row — one per word (a word
   * shorter than 0.12 s goes together with the next one) — from the very same word times as on the screen
   * («⏱ Сдвиг слов» and the line «Сдвиг» included):
   *  ✨ «Подсветка»: every cue has the whole line; the word being said is bold + underlined (b / u — every TV player
   *     reads them; plus its own colour where the TV reads the STYLE block), the words to come a little dimmer there;
   *  👣 «Слово за словом»: cue k has words 1…k (each with its «(перевод)»); a row still to come keeps its place (a
   *     no-break space), so nothing jumps. The line's translation is there from the first word — as on the screen
   *     (the meaning first, the Norwegian words follow the voice), and the bottom of the block stays where it was.
   * Karaoke off: not a byte of the old file changes. */
  const KAR_MIN = 0.12;
  /** the steps of line i inside [a, b] (player time) → [{ s, e, c0, c1 }]: c0…c1 — the words being said
   *  (c0 = −1: before the first word; c0 = n: all said) — or null (karaoke off / nothing to light up) */
  function karSteps(l, i, a, b) {
    const p = Kar.prefs();
    if (!p.on || !st || !l || l.noWords || skipTr(l) || !(b - a > KAR_MIN * 2)) return null;
    const L = st.lines, r = kwOf(l, L[i - 1], L[i + 1]); if (!r || !r.t || !r.t.length) return null;
    const n = r.t.length, sh = st.offset + (st.ksh || 0), wbw = p.mode === 'wbw';
    const at = x => Math.min(b, Math.max(a, x + sh));
    const G = [];
    for (let k = 0; k < n; k++) { const s = at(r.t[k]), g = G[G.length - 1]; if (g && s - g.s < KAR_MIN) g.c1 = k; else G.push({ s, c0: k, c1: k }); }
    // the line appears at its usual moment: «слово за словом» with its first word (as on the screen), «подсветка» —
    // the whole line, nothing lit until the first word
    if (wbw || G[0].s - a < KAR_MIN) G[0].s = a; else G.unshift({ s: a, c0: -1, c1: -1 });
    const done = at(r.e + 0.12); // all said: every word stays, none lit (on the screen too)
    if (done - G[G.length - 1].s >= KAR_MIN && b - done >= KAR_MIN) G.push({ s: done, c0: n, c1: n });
    G.forEach((g, k) => { g.e = k + 1 < G.length ? G[k + 1].s : b; });
    const last = G[G.length - 1];
    if (G.length > 1 && last.e - last.s < KAR_MIN) { G.pop(); const pr = G[G.length - 1]; pr.e = b; if (last.c0 < n) pr.c1 = last.c1; }
    return G;
  }
  /** the words of a line for the TV: [{ w, g: its «(перевод)» or '', k: the word's index }] — the same words and glosses
   *  as glossText (a «–» or a number goes with the word before it) */
  function karUnits(no, ru, gloss) {
    let k = -1;
    return String(no).split(/\s+/).filter(Boolean).map(w => {
      if (!/\p{L}/u.test(w)) return { w, g: '', k: Math.max(0, k) };
      k++;
      let g = '';
      if (gloss) { try { const r = Study.glossInfo(no, k, ru || ''), x = Study.glossShow ? Study.glossShow(w, r.g) : r.g; if (x) g = x + (r.how === 'guess' ? '?' : ''); } catch (e) { /* the word alone */ } }
      return { w, g, k };
    });
  }
  /** the rows exactly as tvWrap cuts the line (a word and its «(перевод)» stay together) */
  function karRows(U, width) {
    const rows = []; let cur = [], len = 0;
    U.forEach(u => { const n = u.w.length + (u.g ? u.g.length + 3 : 0); if (cur.length && len + 1 + n > width) { rows.push(cur); cur = [u]; len = n; } else { len += (cur.length ? 1 : 0) + n; cur.push(u); } });
    if (cur.length) rows.push(cur);
    return rows;
  }
  const karState = (u, s) => (u.k < s.c0 ? 'p' : u.k > s.c1 ? 'f' : 'c');
  /** one row at a step as WebVTT cue text: C = the classes { no, ru, k (being said), fn, fr (still to come) } */
  function karRowVtt(row, s, wbw, C, ve) {
    const seg = [];
    row.forEach(u => {
      const x = karState(u, s); if (x === 'f' && wbw) return;
      const cur = x === 'c' && /\p{L}/u.test(u.w);
      seg.push([x === 'f' ? C.fn : cur ? C.k : C.no, cur ? `<b><u>${ve(u.w)}</u></b>` : ve(u.w)]);
      if (u.g) seg.push([x === 'f' ? C.fr : C.ru, cur ? `<b>(${ve(u.g)})</b>` : `(${ve(u.g)})`]);
    });
    if (!seg.length) return ' '; // a row still to come keeps its place
    const out = [];
    seg.forEach(([c, h]) => { const o = out[out.length - 1]; if (o && o[0] === c) o[1] += ' ' + h; else out.push([c, h]); });
    return out.map(([c, h]) => `<c.${c}>${h}</c>`).join(' ');
  }
  /** the same for a player without classes (the system's own full screen): the word being said in b / u */
  function karPlain(no, ru, gloss, s, wbw, ve) {
    const out = [];
    karUnits(no, ru, gloss).forEach(u => {
      const x = karState(u, s); if (x === 'f' && wbw) return;
      const cur = x === 'c' && /\p{L}/u.test(u.w);
      out.push(cur ? `<b><u>${ve(u.w)}</u></b>` : ve(u.w));
      if (u.g) out.push(cur ? `<b>(${ve(u.g)})</b>` : `(${ve(u.g)})`);
    });
    return out.join(' ') || ' ';
  }
  const LAY_KEY = 'nk-subs-lay';
  const layout = () => { try { return localStorage.getItem(LAY_KEY) === 'right' ? 'right' : 'left'; } catch (e) { return 'left'; } };

  function indexAt(t) {
    const L = st.lines;
    let lo = 0, hi = L.length - 1, r = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (lineT(L[mid], 'start') <= t + 0.05) { r = mid; lo = mid + 1; } else hi = mid - 1; }
    return r;
  }
  function setCur(i) {
    if (i === st.cur) return;
    const list = st.m.$('[data-list]');
    const old = list && list.querySelector('.subs-line.cur'); if (old) old.classList.remove('cur');
    st.cur = i;
    const row = list && list.querySelector(`.subs-line[data-i="${i}"]`);
    if (row) {
      row.classList.add('cur');
      // follow the line, unless the list was scrolled by hand a moment ago
      if (Date.now() - st.userScrollT > 3500) {
        const lr = list.getBoundingClientRect(), rr = row.getBoundingClientRect();
        if (rr.top < lr.top + 8 || rr.bottom > lr.bottom - 8) list.scrollTo({ top: list.scrollTop + rr.top - lr.top - list.clientHeight / 3, behavior: 'smooth' });
      }
    }
    drawNow();
    musicHint();
    prefetch();
    if (st.trMode === 'word') glossNear(i);
    KEnv.want(i); // 🎤 the sound around this line and the next ones (only while «Бегущая строка» is on)
  }
  function tick() {
    const v = media(); if (!v || !st) return;
    const t = v.currentTime;
    if (st.stopAt != null && t >= st.stopAt) {
      if (st.loop && st.playLine >= 0) { v.currentTime = Math.max(0, lineT(st.lines[st.playLine], 'start') - 0.1); }
      else { v.pause(); st.stopAt = null; st.playLine = -1; }
    }
    // while one line is being played (or repeated), it stays highlighted — also during the short run-up before it
    const pl = st.playLine >= 0 && st.lines[st.playLine];
    setCur(pl && t >= lineT(pl, 'start') - 0.4 && t <= lineT(pl, 'end') + 0.3 ? st.playLine : indexAt(t));
    // the line on the video / under it shows only while it is being said (+ a moment to finish reading) — a line from
    // minutes ago must not hang there (programs with few subtitles: it looked as if it was said again and again)
    const l = st.lines[st.cur];
    const grace = l && l.frame ? 0 : l ? Math.min(2.5, Math.max(0.8, (lineT(l, 'end') - lineT(l, 'start')) * 0.3)) : 0; // 📝 its end has the +1.5 s already
    const live = !!l && t <= lineT(l, 'end') + grace || (pl && st.cur === st.playLine);
    if (st.m && st.live !== live) {
      st.live = live;
      const ov = st.m.$('[data-ov]'); if (ov) ov.classList.toggle('gone', !live);
      const now = st.m.$('[data-now]'); if (now) now.classList.toggle('gone', !live && !v.paused);
    }
    Kar.frame(t);
    Cred.tick(); // 🎬 the credits box leaves when the credits are gone
    Song.tick(t); // 🎵 a song where the subtitles say nothing (once a second, only while it plays)
  }
  function loop() { if (!st) return; tick(); const v = media(); if (v && !v.paused) st.raf = requestAnimationFrame(loop); else st.raf = 0; }
  function playLine(i) {
    const v = media(), l = st.lines[i];
    if (!l) return;
    if (st.clk) { if (st.syncTap) Second.syncTo(i); else { st.stopAt = null; st.playLine = -1; st.clk.peek(lineT(l, 'start') + 0.01); setCur(i); Second.bar(); } return; }
    if (!v) { setCur(i); UI.toast('Без видео или аудио строку не послушать — добавьте файл', 'warn', 2500); return; }
    st.playLine = i;
    st.stopAt = lineT(l, 'end') + 0.12;
    try { v.currentTime = Math.max(0, lineT(l, 'start') - 0.08); } catch (e) { /* not loaded yet */ }
    setCur(i);
    const p = v.play(); if (p && p.catch) p.catch(() => {});
  }
  function step(d) {
    let i = st.cur;
    if (i < 0) i = d > 0 ? -1 : 0;
    playLine(U.clamp(i + d, 0, st.lines.length - 1));
  }
  function toggle() {
    const v = media(); if (!v) return;
    if (v.paused) {
      // after «play one line» ended: continue normally from here
      if (!st.loop) { st.stopAt = null; st.playLine = -1; }
      const p = v.play(); if (p && p.catch) p.catch(() => {});
    } else v.pause();
  }
  function setLoop(on) {
    st.loop = on;
    st.m.$$('[data-k="loop"]').forEach(b => b.classList.toggle('on', on));
    if (on) {
      const i = st.cur >= 0 ? st.cur : 0;
      st.playLine = i; st.stopAt = lineT(st.lines[i], 'end') + 0.12;
      const v = media(); if (v && v.paused) playLine(i);
    } else { st.stopAt = null; st.playLine = -1; }
  }
  function syncPlayBtn() {
    const v = media();
    if (st && st.m) st.m.$$('[data-k="toggle"]').forEach(b => { b.innerHTML = UI.icon(v && !v.paused ? 'pause' : 'play', 18); });
    if (st && st.m) st.m.el.classList.toggle('subs-playing', !!(v && !v.paused)); // the ⛶ on the video steps aside while it plays
  }
  /** 📍 the place of this video / programme / podcast / Telegram video or audio (js/resume.js) */
  const posId = () => st.media.name + '|' + st.media.size;
  function savePos() {
    const v = media(); if (!v || !st.media || (st.stream && st.stream.live)) return; // live: no place to come back to
    if (window.Resume) {
      // only after it really played (an unanswered «Продолжить?» and a quick close must not forget the old place)
      if (!st.posTouched) return;
      Resume.save('media', posId(), v.currentTime || 0, { unit: 'time', total: st.dur || (st.stream && +st.stream.duration) || 0, title: st.stream ? st.stream.title : st.media.name });
      return;
    }
    try {
      const all = JSON.parse(localStorage.getItem(POS_KEY) || '{}');
      all[st.media.name + '|' + st.media.size] = { t: v.currentTime, at: Date.now() };
      const keys = Object.keys(all).sort((a, b) => all[b].at - all[a].at); keys.slice(30).forEach(k => delete all[k]);
      localStorage.setItem(POS_KEY, JSON.stringify(all));
    } catch (e) { /* full */ }
  }
  function bindMedia() {
    if (st.stream && st.stream.companion) Second.bind(); // 📱 no video: the clock
    if (st.stream && st.stream.kind === 'youtube') {
      if (st.yt) st.yt.destroy();
      const fr = st.m.$('[data-yt-frame]');
      st.yt = fr ? ytMedia(fr, st.mediaUrl) : null;
    }
    const v = media(); if (!v) return;
    NativeSubs.bind(v); // the system's own full screen / picture in picture: our lines go with the video
    if (st.stream && (st.stream.kind === 'nrk' || st.stream.kind === 'tg') && (v.tagName === 'VIDEO' || v.tagName === 'AUDIO')) {
      // the sound and the picture may be read by the page (NRK serves the stream with CORS * — hls.js needs that anyway);
      // matters for Safari's own HLS player: 🤖 own subtitles from the sound, 📝 / 🔎 the text in the picture
      if (st.stream.kind === 'nrk' && v.tagName === 'VIDEO' && !st.stream.audio) v.crossOrigin = 'anonymous';
      if (st.stream.autoAsr) {
        if (st.stream.kind === 'nrk') v.crossOrigin = 'anonymous';
        AsrGate.compact(); // a short calm line under the video («?» — the details)
        // the audio context needs a tap (iPhone / Safari); the model already on the device → start on the first play
        st.m.el.addEventListener('pointerdown', () => { if (Asr.on || st.asrAsked) Asr.prime(); }, { capture: true });
        Speech.asrReady().then(ok => {
          if (!st || st.asrAsked) return;
          st.asrAsked = true;
          // no model yet: the window that explains and downloads opens by itself (the user doesn't have to find the button)
          // no model yet: the window that explains and downloads opens by itself; the model is there: start right away
          setTimeout(() => { if (st && !Asr.on) Asr.enable(false); }, ok ? 50 : 500);
        });
      }
      if (st.stream.video) v.src = st.stream.video; // ✈️ Telegram: the bridge's stream (HTTP Range — seeking works)
      else if (st.stream.mp3) v.src = st.stream.mp3; // a podcast: one MP3 file
      else attachHls(v, st.stream.hls);
      if (st.stream.live) v.addEventListener('seeked', () => { LiveSubs.seeked(v.currentTime); Live.bar(); });
    }
    v.playbackRate = v.defaultPlaybackRate = st.rate; // default too: a reloaded stream keeps the chosen speed
    if ('preservesPitch' in v) v.preservesPitch = true; // slower, but the voice stays natural (no «deep» voice)
    v.addEventListener('play', () => {
      syncPlayBtn(); ocrChip(false); if (!st.raf) st.raf = requestAnimationFrame(loop);
      Ink.kick(600); // 📝 the text in the picture is read while it plays
      // 📍 the place is kept while it plays too (a closed tab / a crash keeps it)
      if (st.media && !(st.stream && st.stream.live)) { st.posTouched = true; if (!st.posTimer) st.posTimer = setInterval(() => { const x = media(); if (x && !x.paused) savePos(); }, 5000); }
    });
    v.addEventListener('ended', () => { if (st && st.media && window.Resume) Resume.clear('media', posId()); }); // finished: nothing to come back to
    v.addEventListener('pause', () => { syncPlayBtn(); tick(); savePos(); ocrChip(true); Ink.stop(); });
    v.addEventListener('seeked', () => { if (v.paused) ocrChip(true); });
    v.addEventListener('seeking', () => Ink.seek());
    v.addEventListener('seeked', () => Ink.kick(500));
    v.addEventListener('seeked', tick);
    v.addEventListener('timeupdate', () => { if (v.paused) tick(); });
    v.addEventListener('resize', () => { if (st && st.m && v.videoWidth) st.m.el.classList.remove('subs-is-audio'); }); // the picture arrived after all
    v.addEventListener('loadedmetadata', () => {
      st.dur = isFinite(v.duration) && !(st.stream && st.stream.live) ? v.duration : 0;
      if (st.stream && st.stream.live) { Live.bar(); return; } // live: no «continue from …» — it goes on without us
      // a stream is always a video (Safari's native HLS reports the size only later → it was squeezed to a 64 px strip)
      if (st.kind === 'video' && !v.videoWidth && !st.stream) { st.m.el.classList.add('subs-is-audio'); }
      // 📍 «Продолжить с места, где остановились?» — asked once per opening (not when it was opened at a moment of its own)
      if (window.Resume && st.media && !st.restored) {
        st.restored = true;
        if (!(st.stream && st.stream.start)) {
          const s0 = st;
          Resume.ask({ kind: 'media', id: posId(), title: st.stream ? st.stream.title : st.media.name, owner: st.m && st.m.el }).then(pos => {
            if (pos == null || st !== s0) return;
            const x = media(); if (!x) return;
            try { x.currentTime = pos; } catch (e) { /* not seekable yet */ }
            st.posTouched = true;
          }).catch(() => {});
        }
      } else try {
        const p = JSON.parse(localStorage.getItem(POS_KEY) || '{}')[st.media.name + '|' + st.media.size];
        if (p && p.t > 5 && p.t < st.dur - 5 && !st.restored) { st.restored = true; v.currentTime = p.t; UI.toast(`Продолжаю с ${mss(p.t)}`, '', 2200); }
      } catch (e) { /* ignore */ }
    }, { once: true });
    v.addEventListener('error', () => {
      if (!st || !st.m) return;
      const box = st.m.$('[data-now]');
      if (st.stream) {
        // Safari / iPhone (their own HLS player): after a long pause — quietly start again from the same place (twice at most)
        if (st.hlsNative && !st.streamErr) {
          if (st.reloading) return; // the reload just started — this error belongs to the old address
          if ((st.nativeRetry || 0) < 2 && streamReload(v)) { st.nativeRetry = (st.nativeRetry || 0) + 1; return; }
        }
        const S = st.stream, why = (v.errMsg || st.streamErr || (S.audio ? 'звук не воспроизводится' : 'видео не воспроизводится'));
        if (box) box.innerHTML = `<div class="mt-warn"><span>⚠️</span><span><b>${S.kind === 'youtube' ? 'YouTube' : S.kind === 'tg' ? 'Telegram' : 'NRK'}: ${U.esc(why)}.</b> ${S.kind === 'tg' ? (onMac() ? 'Проверьте, что мост на Mac запущен, и попробуйте снова.' : 'Откройте запись в Telegram.') : 'Субтитры и карточки работают и так.'}
          ${S.kind === 'nrk' || S.kind === 'tg' ? '<button class="btn sm" data-k="retry">🔄 Попробовать снова</button>' : ''}
          ${S.link ? `<a href="${U.esc(S.link)}" target="_blank" rel="noopener">↗ ${S.kind === 'youtube' ? 'Смотреть в YouTube' : S.kind === 'tg' ? 'Открыть в Telegram' : S.radio ? 'Слушать в NRK Radio' : 'Смотреть в NRK TV'}</a>` : ''}</span></div>`;
        return;
      }
      if (box) box.innerHTML = `<div class="mt-warn"><span>⚠️</span><span><b>Браузер не может воспроизвести «${U.esc(st.media.name)}».</b> Скорее всего, видео или звук в нём в формате, который этот браузер не понимает (например, MKV с AC-3 / DTS, AVI, WMV). Сохраните его как MP4 (H.264 + AAC) или звук как MP3 / M4A. Субтитры и карточки работают и так — только без звука.</span></div>`;
    });
    if (st.clk) Second.run();
    MSess.bind(v);
  }

  /* ---------- 🔒 Media Session: the lock screen / headphones / car controls while this player plays sound ----------
   * Title, where it comes from and the picture; ⏯, ±10 s (not on air), ⏮ ⏭ = the previous / next LINE (handy for
   * learning with the screen off). Only our own <audio> / <video> (YouTube's player has its own). Cleared on close. */
  const MSess = {
    on: false,
    ok() { return 'mediaSession' in navigator && typeof window.MediaMetadata === 'function'; },
    bind(v) {
      if (!this.ok() || !v || !(v.tagName === 'AUDIO' || v.tagName === 'VIDEO')) return;
      const S = st.stream || {}, ms = navigator.mediaSession;
      const art = /^https:\/\//.test(S.poster || '') ? [{ src: S.poster, sizes: '512x512' }] : [];
      const set = () => {
        if (!st || media() !== v) return;
        try {
          ms.metadata = new MediaMetadata({ title: S.title || (st.media && baseName(st.media.name)) || 'Norsk Kort',
            artist: S.kind ? (S.channel || brand(S)) : 'Свой файл', album: 'Norsk Kort · субтитры и перевод', artwork: art });
        } catch (e) { /* an old browser */ }
        const h = (a, f) => { try { ms.setActionHandler(a, f); } catch (e) { /* not supported here */ } };
        h('play', () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); });
        h('pause', () => v.pause());
        h('stop', () => v.pause());
        h('previoustrack', st.lines.length ? () => step(-1) : null);
        h('nexttrack', st.lines.length ? () => step(1) : null);
        const seekable = !S.live && !S.companion;
        h('seekbackward', seekable ? d => { v.currentTime = Math.max(0, v.currentTime - ((d && d.seekOffset) || 10)); } : null);
        h('seekforward', seekable ? d => { v.currentTime = Math.min(v.duration || Infinity, v.currentTime + ((d && d.seekOffset) || 10)); } : null);
        this.on = true;
      };
      v.addEventListener('play', () => { set(); try { ms.playbackState = 'playing'; } catch (e) { /* ignore */ } });
      v.addEventListener('pause', () => { if (this.on) try { ms.playbackState = 'paused'; } catch (e) { /* ignore */ } });
    },
    clear() {
      if (!this.on || !this.ok()) return;
      this.on = false;
      const ms = navigator.mediaSession;
      try { ms.metadata = null; ms.playbackState = 'none'; } catch (e) { /* ignore */ }
      ['play', 'pause', 'stop', 'previoustrack', 'nexttrack', 'seekbackward', 'seekforward'].forEach(a => { try { ms.setActionHandler(a, null); } catch (e) { /* ignore */ } });
    },
  };

  /* =================== cards =================== */
  function deckName() {
    if (st.stream) return brandIco(st.stream) + ' ' + (st.stream.title.length > 60 ? st.stream.title.slice(0, 59) + '…' : st.stream.title);
    return '🎬 ' + baseName(st.media ? st.media.name : st.noFile ? st.noFile.name : 'видео');
  }
  function deck() {
    const name = deckName(), key = st.media ? st.media.name : st.noFile.name;
    let d = Store.decks().find(x => x.subsMedia === key) || Store.decks().find(x => x.name === name);
    if (!d) {
      const S = st.stream;
      d = Store.addDeck(name, S ? `${brand(S)}: «${S.title}»${S.channel ? ' · ' + S.channel : ''}${S.link ? ' · ' + S.link : ''}`
        : `Строки из «${st.media ? st.media.name : st.noFile.name}» · субтитры «${st.noFile.name}»`);
      Store.updateDeck(d.id, { subsMedia: key });
    }
    st.deckId = d.id;
    return d;
  }
  const where = l => whereAt(lineT(l, 'start'));
  /** the moment t (s) of what plays: ✈️ Telegram · channel · author · «video» · the video's date, 0:01:23 · t.me link */
  const whereAt = t => {
    const S = st.stream;
    if (S && S.kind === 'tg') {
      if (S.audio) return `✈️ Telegram · ${S.channel || 'канал'}${S.author && S.author !== S.channel ? ` · ${S.performer ? 'исполнитель' : 'автор'}: ${S.author}` : ''} · «${S.title}»${S.file && S.file !== S.title ? ` · файл: ${S.file}` : ''}${S.date ? ` · ${S.voice ? 'голосовое' : 'аудио'} от ${new Date(S.date).toLocaleDateString('ru-RU')}` : ''}, ${hms(t)}${S.link ? ' · ' + (S.at ? S.at(t) : S.link) : ''}`;
      return `✈️ Telegram · ${S.channel || 'канал'}${S.author && S.author !== S.channel ? ` · автор: ${S.author}` : ''} · «${S.title}»${S.date ? ` · видео от ${new Date(S.date).toLocaleDateString('ru-RU')}` : ''}, ${hms(t)}${S.link ? ' · ' + (S.at ? S.at(t) : S.link) : ''}`;
    }
    if (S) return `${brandIco(S)} ${brand(S)} «${S.title}»${S.channel ? ' · ' + S.channel : ''}, ${S.live && st.liveOff ? 'эфир ' + new Date((t + st.liveOff) * 1000).toLocaleString('ru-RU') : hms(t)} · ${S.at ? S.at(t) : S.link}`;
    return `🎬 ${st.media ? st.media.name : st.noFile.name}, ${hms(t)}`;
  };
  function exists(d, no) { const n = U.norm(no); return Store.cards(d.id).some(x => U.norm(String(x.no).split('\n')[0]) === n); }
  function markMade() {
    const d = Store.decks().find(x => x.subsMedia === (st.media ? st.media.name : st.noFile && st.noFile.name)) || Store.decks().find(x => x.name === deckName());
    if (!d) return;
    const have = new Set(Store.cards(d.id).map(x => U.norm(String(x.no).split('\n')[0])));
    st.lines.forEach(l => { l._made = have.has(U.norm(l.text)); });
    // a card made from a whole sentence over several lines: those lines are made too
    st.lines.forEach((l, i) => { if (!l._made) { const p = phrase(i); if (p && p.parts.length > 1 && have.has(U.norm(p.text))) p.parts.forEach(k => { st.lines[k]._made = true; }); } });
  }
  /** one card: a line (or a word with its line as the example) + the clip of that line */
  function addCard(l, clip, clipErr, word) {
    const d = deck();
    const no = word ? word.no : l.text;
    if (exists(d, no)) return { dup: true, no, deck: d };
    const lineRu = trOf(l) || '';
    const by = word ? word.by : trByOf(l);
    const fromFile = !word && !!l.ruFile;
    // a translation you corrected / confirmed (✓): the card carries it as checked — no ⚠️ «machine translation»
    const lineMine = !!(l.ruMine || (window.Study && Study.userSent && Study.userSent(l.text)));
    const mine = word ? !!word.me : lineMine;
    const verify = [...(mine ? [Prov.entry('manual', 'verify', { ru: { old: '', new: word ? word.ru : lineRu } }, word ? 'перевод слова в этой строке проверен вами' : 'перевод строки исправлен / подтверждён вами')] : []),
      ...(word && lineMine ? [Prov.entry('manual', 'verify', { exampleRu: { old: '', new: lineRu } }, 'перевод строки-примера проверен вами')] : [])];
    const note = `${where(l)} · ${l.frame ? 'надпись в кадре — её прочитало приложение' : l.song ? 'слова песни распознало приложение по звуку' : l.auto ? 'текст распознало приложение (NB-Whisper)' : `субтитры «${st.noFile.name}»`}`;
    // a line the app recognized itself (no subtitles in the program): may contain wrong words → «проверить»
    const asrNote = l.frame ? '\n📝 Надпись в кадре прочитана приложением — в буквах возможны ошибки, проверьте' : l.song ? '\n🎵 Слова песни распознаны приложением по звуку (субтитров там нет) — в пении легко расслышать неверно, проверьте' : l.auto ? '\n🤖 Текст распознан приложением по звуку передачи (в ней нет субтитров) — в словах возможны ошибки, проверьте' : '';
    // 🇬🇧 an English line: never the Norwegian side — the sentence goes to card.en and the note (with its translation)
    const en = enLine(l);
    const enNote = en ? `\n🇬🇧 Пример по-английски: «${l.text}»${lineRu ? ' — ' + lineRu : ''}` : '';
    const data = {
      no, ru: word ? word.ru : lineRu, en: en ? l.text : !word && l.en ? l.en : '',
      description: (word ? `${where(l)}${word.form && word.form !== word.no ? ` · в тексте: ${word.form}` : ''}` : where(l)) + asrNote + enNote,
      example: word && !en ? l.text : '', exampleRu: word && !en ? lineRu : '',
      tags: (word ? ['subtitles', 'word'] : ['subtitles']).concat(l.frame ? ['текст в кадре', 'проверить'] : l.auto ? ['проверить'] : []),
      history: [Prov.entry('import', 'create', null, note),
        ...(mine ? [] : fromFile ? [Prov.entry('import', 'translate', null, `перевод из субтитров «${st.trFile.name}»`)] : Translators.provKeys(by || []).map(k => Prov.entry(k, 'translate', null, word ? 'перевод слова из субтитров' : 'перевод строки субтитров'))),
        ...verify],
      mtWarn: mine ? false : fromFile ? null : Translators.mtFlag(by || []),
    };
    if (clip && !en) {
      data.audio = clip.audio;               // data:audio/wav;base64,… (16 kHz mono 16-bit)
      data.audioText = l.text;               // what is said in the clip (for a word card: its example)
      data.audioSrc = { file: st.media.name, start: +clip.start.toFixed(2), end: +clip.end.toFixed(2) };
    }
    const c = Store.addCard(d.id, data);
    const view = Object.assign({}, c, { _clipInfo: clip ? `${clip.sec.toFixed(1).replace('.', ',')} с · ${kb(clip.audio.length)}` : '', _clipErr: clipErr || '' });
    st.made.push(view);
    if (!word) l._made = true;
    st.known && String(no).toLowerCase().split(/\s+/).length <= 3 && st.known.add(bare(no).toLowerCase());
    return { card: c, deck: d };
  }
  async function clipFor(l) {
    if (l.frame) return { clip: null, err: '' }; // 📝 text in the picture: nobody says it — the app's voice reads the card
    // ✈️ a Telegram video: the bridge cuts the line's sound (the author's own voice on the card)
    if (st.stream && st.stream.pcm) {
      try { return { clip: await pcmClip(l), err: '' }; } catch (e) { return { clip: null, err: e.silent ? 'В этом месте видео тишина — карточку озвучит голос приложения' : 'Звук строки не вырезан — карточку озвучит голос приложения' }; }
    }
    // 🎵 a Telegram audio saved on this device: cut from the saved file itself (works without the bridge)
    if (st.stream && st.stream.blob) { try { return { clip: await Clip.get(l), err: '' }; } catch (e) { return { clip: null, err: e.silent ? 'В этом месте записи тишина — карточку озвучит голос приложения' : 'Звук строки не вырезан — карточку озвучит голос приложения' }; } }
    // a stream (YouTube / NRK) can't be cut on the device: the card is voiced by the app's voice, with a link to the moment
    if (!st.media || st.stream) return { clip: null, err: '' };
    try { return { clip: await Clip.get(l), err: '' }; } catch (e) { return { clip: null, err: U.niceErr(e) }; }
  }
  /** 16 kHz mono 16-bit PCM of [t0, t0 + dur] from the bridge (Telegram videos) → Float32 */
  async function pcmGet(url, t0, dur) {
    const r = await fetch(`${url}&from=${Math.max(0, t0).toFixed(3)}&dur=${Math.max(0.2, dur).toFixed(3)}`);
    if (!r.ok) throw new Error('нет звука');
    const i16 = new Int16Array(await r.arrayBuffer());
    const f = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) f[i] = i16[i] / 32768;
    return f;
  }
  async function pcmClip(l) {
    const dur = st.dur || Infinity;
    const t0 = Math.max(0, l.start + st.offset - PRE);
    let t1 = Math.min(dur, l.end + st.offset + POST);
    if (t1 - t0 > CLIP_MAX) t1 = t0 + CLIP_MAX;
    if (t1 <= t0) throw new Error('out');
    const f = polish(await pcmGet(st.stream.pcm, t0, t1 - t0), SR);
    const bytes = wavBytes(f, SR);
    const audio = await U.blobToDataURL(new Blob([bytes], { type: 'audio/wav' }));
    return { audio, sec: f.length / SR, bytes: bytes.byteLength, start: t0, end: t1 };
  }
  /** 🔎 the «Найти слова в кадре» chip over the paused video */
  function ocrChip(show) {
    const c = st && st.m && st.m.$('[data-ocr-chip]'); if (!c) return;
    const v = st.m.$('video[data-media]');
    c.hidden = !show || !v || v.ended || v.seeking || !(v.currentTime > 0.2) || !v.videoWidth || !!st.ocrOpen;
  }
  /** 🔎 read the words burned into the frame (pause → OCR → tick → cards with «текст в кадре» + where it came from) */
  function ocrFrame() {
    const v = st && st.m && st.m.$('video[data-media]');
    if (!v || !window.FrameOcr) return;
    if (!v.paused) v.pause();
    const t = v.currentTime || 0, S = st.stream;
    st.ocrOpen = true; st.ocrBurn = false; ocrChip(false);
    const me = st;
    const p = FrameOcr.open({
      video: v, at: t, label: whereAt(t), url: S ? (S.at ? S.at(t) : S.link || '') : '',
      key: 'frame:' + (st.media ? st.media.name : ''), deck: deckName(),
      deckId: (Store.decks().find(x => x.subsMedia === (st.media ? st.media.name : '')) || Store.decks().find(x => x.name === deckName()) || {}).id,
      onClose: () => { if (st) { st.ocrOpen = false; ocrChip(true); if (st === me && st.ocrBurn) setTimeout(() => { if (st === me) burnNote('ocr'); }, 350); } },
      onDone: cards => { if (!st) return; cards.forEach(c => st.made.push(Object.assign({}, c, { _clipInfo: '', _clipErr: '' }))); afterMade(); },
    });
    // the frame has been read (the OCR window is still open): lines at the bottom → the note after it closes
    Promise.resolve(p).then(m => { if (st === me && m && st.ocrOpen) st.ocrBurn = ocrBurned(m); }).catch(() => {});
  }
  function afterMade() {
    if (!st || !st.m) return;
    const box = st.m.$('[data-made]'); if (box) box.innerHTML = madeHtml();
    const nNew = st.lines.filter(l => !l._made && lineNew(l).size).length;
    const b = st.m.$('[data-bulk="new"]'); if (b) { b.textContent = `➕ Все строки с новыми словами (${nNew})`; b.disabled = !nNew || st.busy; }
    if (window.App && App.view && (App.view.name === 'deck' || App.view.name === 'home')) { try { App.render(); } catch (e) { /* not our view */ } }
  }
  /* ---------- ONE way to make a card from subtitles (own files, YouTube, NRK, recognized speech) ----------
   * A sentence is often split over 2–3 subtitle lines («Vi skal snakke om … mange år, -» + «- men som nå …»):
   * the card gets the WHOLE sentence (neighbouring lines joined while the sentence goes on, up to 4 lines / 300
   * characters), without the subtitle dashes; its translation is made for that whole sentence. */
  const SENT_END = /[.!?…]["»”')\]]*$/;
  const cueText = s => String(s || '').replace(/\s+/g, ' ').replace(/^\s*[-–—]\s+/, '').replace(/\s+[-–—]\s*$/, '').trim();
  function phrase(i) {
    const L = st.lines, l = L[i]; if (!l) return null;
    if (st.punctOf !== L || st.punctN !== L.length) { st.punctOf = L; st.punctN = L.length; st.punct = L.some(x => /[.!?]/.test(x.text)); } // automatic captions without punctuation: no joining
    const single = () => { const t = cueText(l.text); return Object.assign({}, l, { text: t, parts: [i] }); };
    if (!st.punct) return single();
    const goesOn = k => k >= 0 && k < L.length - 1 && !SENT_END.test(cueText(L[k].text)) && L[k + 1].start - L[k].end < 1.6 && !skipTr(L[k]) && !skipTr(L[k + 1]) && !L[k].frame && !L[k + 1].frame
      && srcOf(L[k]) === srcOf(L[k + 1]) && !L[k].song && !L[k + 1].song; // 🇬🇧 an English line never joins a Norwegian one
    let s = i, e = i;
    // …and no further than a line in which a sentence ends and the next begins (the sentence starts / ends inside it)
    const midEnd = k => /[.!?…]["»”')\]]*\s+\S/u.test(cueText(L[k].text));
    while (s > 0 && i - s < 2 && goesOn(s - 1) && (s === i || !midEnd(s))) s--;
    while (goesOn(e) && e - s < 3 && (e === i || !midEnd(e))) e++;
    if (s === e) return single();
    const parts = L.slice(s, e + 1);
    // exactly ONE sentence: a line before that also holds the end of an earlier sentence gives only its last part;
    // a line after that already starts the next sentence gives only its first part
    const texts = parts.map(p => cueText(p.text));
    if (s < i) { const m = texts[0].match(/^.*[.!?…]["»”')\]]*\s+(\S.*)$/u); if (m) texts[0] = m[1]; }
    if (e > i) { const k = texts.length - 1, m = texts[k].match(/^(.*?[.!?…]["»”')\]]*)\s+\S/u); if (m) texts[k] = m[1]; }
    const text = texts.join(' ').replace(/\s+([,.!?;:])/g, '$1');
    if (text.length > 300) return single();
    return {
      start: parts[0].start, end: parts[parts.length - 1].end, text, en: '',
      ruFile: parts.every(p => p.ruFile) ? parts.map(p => cueText(p.ruFile)).join(' ') : '',
      // every line of the sentence translated by you (✓): the sentence carries your translation
      ruMine: window.Study && Study.userSent && parts.every(p => Study.userSent(p.text)) ? parts.map(p => Study.userSent(p.text)).join(' ') : '',
      auto: parts.some(p => p.auto), parts: parts.map((p, k) => s + k),
    };
  }
  /** the translation of whole sentences (cached like every line: Study's 's:' cache) */
  async function ensureTr(list) {
    const need = [...new Set(list.filter(p => !p.ruFile && !enLine(p) && trOf(p) === undefined).map(p => p.text))];
    for (let k = 0; k < need.length; k += 250) await Study.translateUnits(need.slice(k, k + 250), []);
    // 🇬🇧 English lines: from English (kept in the same cache as every line)
    const en = [...new Set(list.filter(p => enLine(p) && trOf(p) === undefined).map(p => p.text))];
    if (en.length && window.Translators) {
      try {
        const r = await Translators.translateMany(en, 'en', 'ru', { quiet: true, place: trPlace() });
        const c = Study.exCache && Study.exCache();
        if (c) { en.forEach((t, k) => { if (r.out[k]) c['s:' + t] = String(r.out[k]).trim(); }); try { Study.exSave(); } catch (e) { /* full */ } }
      } catch (e) { /* the card keeps an empty translation */ }
    }
  }
  /** 🇬🇧 the Norwegian words of an English line, in runs: «we say "å snakke" here» → ['å snakke'] */
  function noRuns(l) {
    const out = []; let cur = [];
    String(l.text).split(/\s+/).filter(w => /\p{L}/u.test(w)).forEach(w => {
      if (LID() && LangId.isNoWord(w, st.known)) cur.push(bare(w)); else { if (cur.length) out.push(cur.join(' ')); cur = []; }
    });
    if (cur.length) out.push(cur.join(' '));
    return [...new Set(out)];
  }
  /** ➕ on an English line: the card is made of its Norwegian words; the English sentence goes to card.en and the note */
  async function enCard(i, btn) {
    const l = st.lines[i]; const runs = noRuns(l);
    if (!runs.length) { UI.toast('Строка на английском, норвежских слов в ней нет — карточку не делаем. Норвежское слово в строке можно нажать — будет перевод и карточка.', '', 5000); return; }
    const no = runs.slice(0, 3).join(', ');
    st.busy = true;
    const label = btn && btn.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span>'; }
    try {
      await ensureTr([l]);
      let ru = '', by = [];
      try { const r = await Translators.translateMany([no], 'no', 'ru', { quiet: true }); ru = String(r.out[0] || '').trim(); by = r.by || []; } catch (e) { /* the user fills it in */ }
      if (!st) return;
      const r = addCard(l, null, '', { no, ru, by, form: no });
      if (!r.dup) { l._made = true; }
      await Store.saveNow();
      if (r.dup) UI.toast(`«${no}» уже есть в «${r.deck.name}»`, 'warn');
      else UI.toast(`➕ «${no}» → ${r.deck.name} · английская строка сохранена как пример`, 'good', 3500);
      redrawLine(i); afterMade();
    } finally {
      if (st) st.busy = false;
      if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = label; }
    }
  }
  const markParts = p => (p.parts || []).forEach(k => { if (st.lines[k]) { st.lines[k]._made = true; redrawLine(k); } });

  async function addLine(i, btn) {
    const l0 = st.lines[i]; if (!l0 || st.busy) return;
    Clip.prime();
    if (l0._made) { UI.toast('Эта строка уже в карточках', '', 1800); return; }
    if (skipTr(l0)) { UI.toast(l0.noWords ? (l0.songX ? 'Песня не на норвежском — карточку из неё не делаем' : 'Здесь музыка без слов — карточку не сделать') : `Строка не на языке, который вы учите, — карточку не делаем. Если это ${learnName()} — нажмите «перевести» у строки.`, '', 3500); return; }
    if (enLine(l0)) { enCard(i, btn); return; }
    const l = phrase(i);
    st.busy = true;
    const label = btn && btn.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span>'; }
    try {
      await ensureTr([l]);
      const { clip, err } = await clipFor(l);
      if (!st) return;
      const r = addCard(l, clip, err);
      if (!r.dup) markParts(l);
      await Store.saveNow();
      if (r.dup) UI.toast(`Эта строка уже есть в «${r.deck.name}»`, 'warn');
      else {
        UI.toast(`➕ Карточка${clip ? ' со звуком' : ''} → ${r.deck.name}${r.card.mtWarn ? ' · ⚠️ перевод машинный — перепроверьте' : ''}`, 'good', 3500);
        if (err) UI.toast(err, 'warn', 6000);
      }
      redrawLine(i); afterMade();
    } finally {
      if (st) st.busy = false;
      if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = label; }
    }
  }
  async function bulk(idx) {
    if (st.busy) return;
    // 🇬🇧 English lines are not Norwegian sentences: their Norwegian words become cards one by one (➕ on the line)
    const skipped = idx.filter(i => skipTr(st.lines[i]) || enLine(st.lines[i])).length;
    idx = idx.filter(i => st.lines[i] && !st.lines[i]._made && !skipTr(st.lines[i]) && !enLine(st.lines[i]));
    if (!idx.length) { UI.toast(skipped ? 'В отмеченных строках нет строк на языке, который вы учите' : 'Все эти строки уже в карточках', '', 2200); return; }
    Clip.prime();
    const MAX = 150;
    if (idx.length > MAX) { UI.toast(`За один раз — до ${MAX} строк; беру первые ${MAX}`, 'warn', 4000); idx = idx.slice(0, MAX); }
    // say it before: the translation of the lines is a machine one, 🤖 lines were recognized by the app — cards get marked
    const autoN = idx.filter(i => st.lines[i].auto).length;
    const nCards = new Set(idx.map(i => U.norm(phrase(i).text))).size; // several ticked lines of one sentence → one card
    if (!hasRuFile() || autoN) {
      const mt = !hasRuFile() ? `⚠️ <b>Перевод строк — машинный</b> (${U.esc(Translators.provNames(Translators.dictOrder().slice(0, 1)))}): обычные фразы он переводит в основном верно, а выражения и идиомы — часто дословно. Карточки получат пометку <b>«перепроверьте»</b>.` : '';
      const asr = autoN ? `${BOT()} <b>${autoN}</b> ${U.plural(autoN, ['строку', 'строки', 'строк'])} распознало приложение (в передаче нет субтитров) — в словах возможны ошибки, такие карточки получат пометку <b>«проверить»</b>.` : '';
      if (!(await UI.confirm(`Создать ${U.cards(nCards)} из отмеченных строк?<br><br>${[mt, asr].filter(Boolean).join('<br><br>')}${AI.available() ? '<br><br>Проверить перевод нейросетью можно потом в колоде (🤖 «Проверить»).' : ''}`, { ok: `➕ Создать ${U.cards(nCards)}`, title: 'Карточки из субтитров' }))) return;
    }
    const slow = st.media && !st.stream && (Clip.mode === 'capture' || !Clip.fitsInMemory());
    if (slow && idx.length > 8) {
      const sec = idx.reduce((s, i) => s + Math.min(CLIP_MAX, st.lines[i].end - st.lines[i].start + PRE + POST), 0);
      if (!(await UI.confirm(`Файл большой — звук каждой строки записывается в реальном времени (без звука в колонках).<br>${idx.length} ${U.plural(idx.length, ['строка', 'строки', 'строк'])} ≈ <b>${Math.ceil(sec / 60)} мин</b>. Продолжить?`, { ok: '➕ Сделать карточки' }))) return;
      Clip.prime();
    }
    st.busy = true; st.cancel = false;
    const v = media(); if (v) v.pause();
    countSel();
    const pt = UI.progressToast('Делаю карточки…');
    const stopBtn = document.createElement('button');
    stopBtn.className = 'btn sm'; stopBtn.textContent = '⏹ Стоп';
    stopBtn.onclick = e => { e.stopPropagation(); st.cancel = true; Clip.stopCapture(); };
    try { pt.set(0, idx.length); document.querySelector('#toast-root .toast:last-child').appendChild(stopBtn); } catch (e) { /* ignore */ }
    let made = 0, dup = 0, silent = 0, lastErr = '';
    try {
      // whole sentences (a sentence over several ticked lines becomes ONE card)
      const phr = [], seenP = new Set();
      idx.forEach(i => { const p = phrase(i); const key = U.norm(p.text); if (key && !seenP.has(key)) { seenP.add(key); p._i = i; phr.push(p); } });
      if (phr.some(p => !p.ruFile)) { pt.set(0, phr.length, 'Перевожу предложения…'); await ensureTr(phr); }
      for (let k = 0; k < phr.length && st && !st.cancel; k++) {
        const l = phr[k];
        pt.set(k, phr.length, `Карточки: ${k + 1} из ${phr.length}${st.media && !st.stream ? ' · вырезаю звук' : ''}`);
        const { clip, err } = await clipFor(l);
        if (!st || st.cancel) break;
        if (err) { silent++; lastErr = err; }
        const r = addCard(l, clip, err);
        if (r.dup) dup++; else { made++; markParts(l); }
        (l.parts || [l._i]).forEach(j => st.checked.delete(j));
        redrawLine(l._i);
        // a format the browser cannot read: no point trying the other lines
      }
      await Store.saveNow();
    } finally {
      if (st) { st.busy = false; countSel(); afterMade(); }
      const d = st && st.deckId && Store.deck(st.deckId);
      pt.close(`➕ ${U.cards(made)}${d ? ' → ' + d.name : ''}${dup ? ` · ${dup} уже были` : ''}${st && st.cancel ? ' · остановлено' : ''}`, made ? 'good' : 'warn');
      if (silent) UI.toast(`${silent} ${U.plural(silent, ['карточка', 'карточки', 'карточек'])} без звука: ${lastErr}`, 'warn', 7000);
      if (made && Study._lastFail) UI.toast(`Часть перевода не пришла: ${Study._lastFail.error}`, 'warn', 6000);
    }
  }

  /* =================== word popup =================== */
  let wp = null;
  const hidePop = () => { if (wp) { wp.el.remove(); wp = null; } };
  async function wordPop(span) {
    hidePop();
    const i = +span.dataset.li, l = st.lines[i];
    const form = span.dataset.w;
    if (!form || !l) return;
    const v = media();
    // 📱 second screen: the display holds on this line while the TV goes on (▶ / ⏭ come back to it)
    if (v && !v.paused) { if (st.clk) { st.clk.peek(v.currentTime); Second.bar(); } else v.pause(); }
    const k = [...span.parentElement.querySelectorAll('.sw')].indexOf(span);
    const low = k > 0 && /^\p{Lu}/u.test(form) ? form : form.toLowerCase();
    const el = document.createElement('div');
    el.className = 'sel-pop subs-pop';
    el.innerHTML = `<div class="sp-tr"><b>${U.esc(low)}</b> — <span data-wtr><span class="spinner sm"></span> перевожу…</span><div class="tiny muted" data-wlem></div></div>
      <div class="sp-fix" data-wfix hidden>
        <button class="btn sm" data-wp="fix" title="Перевод слова неверный — исправить (только в этой строке)">✎ Неверный перевод</button>
        <button class="btn sm" data-wp="ok" title="Перевод слова верный — отметить ✓">✓ Верно</button>
        <button class="btn sm ghost" data-wp="fixline" title="Исправить или подтвердить перевод всей строки">✎ Перевод строки</button>
      </div>
      <div class="sp-row">
        <button class="media-btn sm" data-wp="say" title="Произнести">🔊</button>
        <button class="btn sm primary" data-wp="card" title="Карточка: слово, перевод, строка как пример и её звук">➕ В карточку</button>
        <button class="btn sm" data-wp="more" title="Выбрать: слово, словарную форму или всю строку, колоду, перевод — или заполнить карточку самому">✍️ Выбрать…</button>
        <button class="icon-btn sm" data-wp="x" title="Закрыть">✕</button>
      </div>`;
    document.body.appendChild(el);
    const rect = span.getBoundingClientRect();
    const pw = Math.min(340, window.innerWidth - 16);
    el.style.width = pw + 'px';
    const left = Math.max(8, Math.min(window.innerWidth - pw - 8, rect.left + rect.width / 2 - pw / 2));
    const ph = el.offsetHeight || 96;
    el.style.left = left + 'px';
    el.style.top = (rect.top - ph - 10 > 8 ? rect.top - ph - 10 : Math.min(window.innerHeight - ph - 8, rect.bottom + 10)) + 'px';
    // meaning first: the word as the line's translation says it (yours ✓ > AI > found in the translation > dictionary);
    // only when it is not there — the single word translated alone, marked «без контекста»
    const gs = cueText(l.text), lineRu = trOf(l) || '';
    const me = wp = { el, i, k, gs, lineRu, form: low, no: low, ru: '', by: [], how: '' };
    me.ready = (async () => {
      const ctx = window.Study && Study.glossInfo && !enLine(l) ? Study.glossInfo(gs, k, lineRu) : null; // 🇬🇧 an English line: the word alone
      if (ctx && ctx.g && ['user', 'ai', 'align', 'dict'].includes(ctx.how)) {
        me.ru = ctx.g; me.how = ctx.how; me.me = ctx.how === 'user';
        me.by = ctx.how === 'ai' ? ['ai'] : ctx.how === 'align' && !l.ruFile ? (trByOf(l) || []) : [];
      } else {
        const g = window.NoGloss && NoGloss.get(low);
        me.how = 'guess';
        if (g) { me.ru = g; me.by = []; }
        else if (ctx && ctx.g) { me.ru = ctx.g; me.by = trByOf(l) || []; }
        else {
          try {
            const r = await Translators.translateMany([low], 'no', 'ru');
            me.ru = (Study.cleanGloss ? Study.cleanGloss(low, r.out[0]) : '') || String(r.out[0] || '').trim(); me.by = r.by; me.err = r.error;
            if (me.ru && window.Align && Align.echoes(low, me.ru)) me.ru = ''; // «Han» → «Хан» is no translation
          } catch (e) { me.err = U.niceErr(e); }
        }
      }
      if (wp !== me) return;
      const box = el.querySelector('[data-wtr]');
      const src = { user: '✓ ваш перевод', ai: '🤖 по смыслу строки', align: 'из перевода строки', dict: 'словарик' }[me.how]
        || `перевод слова без контекста — может не совпадать по смыслу${me.by.length ? ' · ' + Translators.provNames(me.by) : ''}`;
      if (box) box.innerHTML = me.ru ? `<b class="sp-ru">${U.esc(me.ru)}</b>${me.how === 'guess' ? '?' : ''}<div class="tiny muted sp-ctx${me.how === 'guess' ? ' unsure' : ''}">${U.esc(src)}</div>` : `<span class="muted">перевод не пришёл${me.err ? ': ' + U.esc(me.err) : ''}</span>`;
      // «Дословно: …» of the whole line — only here in the popup (no extra line over the video)
      const lit = window.Study && Study.litOf && !enLine(l) ? Study.litOf(gs, lineRu) : '';
      if (lit && box && !el.querySelector('.sp-lit')) box.closest('.sp-tr').insertAdjacentHTML('beforeend', `<div class="tiny muted sp-lit">Дословно: ${U.esc(lit)}</div>`);
      const fx = el.querySelector('[data-wfix]');
      if (fx && window.Study && Study.fixGloss) { fx.hidden = false; const ok = fx.querySelector('[data-wp="ok"]'); if (ok) ok.hidden = !me.ru || me.how === 'user'; }
    })();
    // dictionary form (husene → hus) — Ordbøkene, not longer than 2.5 s
    me.lemma = (async () => {
      if (!window.Textbook || !Textbook.lemma || low !== form.toLowerCase()) return;
      try {
        const lem = await Promise.race([Textbook.lemma(low), U.sleep(2500).then(() => null)]);
        if (lem && lem !== low && wp === me) { me.no = lem; const b = el.querySelector('[data-wlem]'); if (b) b.textContent = `словарная форма: ${lem}`; }
      } catch (e) { /* offline */ }
    })();
  }
  async function wordCard() {
    const me = wp; if (!me || me.saving) return;
    me.saving = true;
    Clip.prime();
    const b = me.el.querySelector('[data-wp="card"]');
    if (b) { b.disabled = true; b.innerHTML = '<span class="spinner sm"></span> сохраняю…'; }
    await me.ready; await me.lemma;
    if (me.no !== me.form && me.ru) {
      // the translation was for the form in the text; the dictionary form usually means the same
    }
    const l = phrase(me.i); // the example: the whole sentence the word is in
    await ensureTr([l]);
    const { clip, err } = await clipFor(l);
    if (!st) return;
    const r = addCard(l, clip, err, { no: me.no, ru: me.ru, by: me.by, form: me.form, me: !!me.me });
    await Store.saveNow();
    if (r.dup) UI.toast(`«${me.no}» уже есть в «${r.deck.name}»`, 'warn');
    else { UI.toast(`➕ «${me.no}» → ${r.deck.name}`, 'good', 3000); if (err) UI.toast(err, 'warn', 5000); }
    hidePop(); afterMade();
  }

  /* =================== files =================== */
  async function readSub(f) {
    const text = decodeSub(await U.readArrayBuffer(f));
    const cues = parseSubs(text, f.name);
    return { f, cues, lang: cues.length ? detectLang(cues, f.name) : '', score: noScore(cues) };
  }
  const isSub = f => SUB_EXT.test(f.name) || /^text\/vtt/.test(f.type);
  const isMedia = f => MEDIA_EXT.test(f.name) || /^(video|audio)\//.test(f.type);
  async function addFiles(files, slot) {
    files = [...files];
    const bad = files.filter(f => !isSub(f) && !isMedia(f) && !slot);
    if (bad.length) UI.toast(`Не знаю, что это: ${bad.map(f => f.name).join(', ')}. Нужны видео / аудио и субтитры .srt, .vtt, .ass`, 'warn', 5000);
    let changed = false;
    const media = files.find(f => slot === 'media' || (!slot && isMedia(f) && !isSub(f)));
    if (media) { setMedia(media); changed = true; }
    const subs = [];
    for (const f of files.filter(f => f !== media && (slot ? slot !== 'media' : isSub(f)))) {
      try {
        const s = await readSub(f);
        if (!s.cues.length) { UI.toast(`В «${f.name}» не нашлось строк субтитров (поддерживаются .srt, .vtt, .ass / .ssa)`, 'warn', 5000); continue; }
        subs.push(s);
      } catch (e) { UI.toast(`«${f.name}»: ${e.message}`, 'warn'); }
    }
    if (subs.length) {
      changed = true;
      // which file is the Norwegian one: the slot it was chosen for, else Cyrillic → translation, the most Norwegian → main
      const forced = slot && slot !== 'media' ? subs.map(s => (s.slot = slot, s)) : null;
      if (!forced) {
        const latin = subs.filter(s => s.lang !== 'ru').sort((a, b) => b.score - a.score);
        if (latin.length) { latin[0].slot = latin[0].lang === 'en' && st.noFile && !st.trFile ? 'tr' : 'no'; latin.slice(1).forEach(s => { s.slot = 'tr'; }); }
        subs.filter(s => s.lang === 'ru').forEach(s => { s.slot = 'tr'; });
      }
      subs.forEach(s => {
        if (s.slot === 'no') {
          if (s.lang === 'ru') UI.toast(`«${s.f.name}» — русские субтитры. Нужны норвежские; русские можно добавить как перевод`, 'warn', 6000);
          st.noFile = s.f; st.noCues = s.cues; st.noLines = s.cues.length;
          // a stream got the person's own file: the note says so (no more «нет субтитров»)
          if (st.stream) { st.stream.subName = 'ваш файл субтитров'; st.stream.ownSubs = s.f.name; st.stream.note = `Субтитры из вашего файла «${U.esc(s.f.name)}». Если строки спешат или опаздывают — «Сдвиг» ниже.`; }
          if (s.lang === 'en') UI.toast(`«${s.f.name}» похож на английские субтитры — если это так, выберите норвежские`, 'warn', 6000);
        } else {
          st.trFile = s.f; st.trCues = s.cues; st.trLang = s.lang === 'ru' ? 'ru' : 'en';
        }
      });
    }
    if (!changed) return;
    buildLines();
    if (st.stage === 'player') { render(); return; }
    render();
    // both files at hand → straight to the player
    if (st.noFile && st.media && (media || subs.some(s => s.slot === 'no'))) openPlayer();
  }
  /** 📄 «Свой файл субтитров» for a stream (YouTube without the Mac): the person's own .srt / .vtt / .ass becomes the lines */
  function ownSubPick() {
    if (!st || !st.m) return;
    let inp = st.m.$('input[data-in="no"]');
    if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.hidden = true; inp.dataset.in = 'no'; inp.accept = '.srt,.vtt,.webvtt,.ass,.ssa,text/vtt'; st.m.el.appendChild(inp); }
    inp.value = ''; inp.click();
  }
  function setMedia(f) {
    if (st.mediaUrl) URL.revokeObjectURL(st.mediaUrl);
    Clip.reset(); KEnv.reset(); Song.reset();
    st.media = f; st.mediaUrl = URL.createObjectURL(f); st.dur = 0; st.restored = false; st.posTouched = false;
    st.kind = AUDIO_EXT.test(f.name) || /^audio\//.test(f.type) ? 'audio' : 'video';
  }
  function buildLines() {
    if (!st.noCues) { st.lines = []; return; }
    st.lines = st.noCues.map(c => { const l = { start: c.start, end: c.end, text: c.text, ruFile: '', en: '' }; const wt = cueWordTimes(c); if (wt) l.wt = wt; if (c.lang) l.trackLang = c.lang; return l; });
    if (st.trCues) pairUp(st.lines, st.trCues, st.trLang);
    if (st.stream) { tagAll(false); trackLang(); }
    // own subtitle files: as they are — only an English line is marked (translated from English, «EN»)
    else if (LID()) st.lines.forEach(l => { const r = LangId.detect(l.text); if (r.lang === 'en' && !r.noWords) l.lang = 'en'; });
    st.cur = -1; st.checked.clear();
    markMade();
  }
  /** 🇬🇧 an English subtitle track (YouTube says which language a track is): every line is English unless it is
   *  clearly Norwegian (a teacher quoting a Norwegian sentence) */
  function trackLang() {
    const S = st.stream, tl = String((S && (S.subLang || S.lang)) || '').toLowerCase();
    if (!LID()) return;
    st.lines.forEach(l => {
      const lg = String(l.trackLang || tl).toLowerCase();
      if (!/^en/.test(lg) || l.noWords) return;
      const r = LangId.detect(l.text, { learn: 'en' });
      l.lang = r.lang; l._new = undefined; // 'en', or 'no' / a neighbour when it clearly is Norwegian
    });
  }
  function openPlayer() {
    if (!st.noFile) return;
    st.stage = 'player';
    st.known = knownSet();
    render();
  }

  /* =================== render + events =================== */
  function render() {
    if (!st || !st.m) return;
    hidePop();
    const body = st.m.el.querySelector('.modal-body');
    st.m.el.dataset.tr = st.trMode;
    st.m.el.classList.toggle('subs-is-audio', st.kind === 'audio');
    if (st.stage === 'load') { body.innerHTML = loadHtml(); trBadge(); return; }
    const keepT = (() => { const v = media(); return v && v.src === st.mediaUrl ? v.currentTime : 0; })();
    Kar.shLoad(); // 🎤 «⏱ Сдвиг слов» of this video
    body.innerHTML = playerHtml();
    if (window.AIHub && AIHub.paintWork) AIHub.paintWork(); // 🌀 who translates the lines: its living logo (js/aihub.js)
    bindMedia();
    glassWire();
    ovApply();
    Ink.sync(); Ink.kick(); // 📝 «Надписи в кадре»: the buttons' state; reading goes on if the video plays
    svHint(); // a gentle reminder that the subtitle look can be changed (until it has been used once)
    trBadge(); // 🌐 «кто переводит» — one badge at the top of the window, after every redraw
    const v = media(); if (v && keepT) { try { v.currentTime = keepT; } catch (e) { /* not loaded yet */ } }
    const list = st.m.$('[data-list]');
    ['wheel', 'touchmove'].forEach(ev => list.addEventListener(ev, () => { st.userScrollT = Date.now(); hidePop(); }, { passive: true }));
    list.addEventListener('scroll', () => { if (wp) hidePop(); }, { passive: true });
    const c = st.cur; st.cur = -2; setCur(c);
    drawNow(); countSel();
    prefetch();
    if (window.Levels) Levels.subsBar(st.m.$('[data-lv-subs]')); // 🪜 «в этой передаче N слов уровня A2…» (opt-in)
    learnHook(); // 🎓 «Учить по материалам»: a step's mode, the plan's button and bar (js/learnby.js)
  }
  function onClick(e) {
    const t = e.target;
    // the «Aa» choice of the translation closes when anything else is pressed
    if (st.m && st.m.$('[data-trpop]') && !t.closest('[data-trpop], [data-k="trpop"]')) trPopClose();
    // «Размыт»: a tap on the blurred translation shows it (a mouse: hovering is enough); a second tap blurs it again
    if (st.trMode === 'blur' && t.closest('.sl-tr, .sl-en, .ov-ru, .sn-tr')) {
      const box = t.closest('.subs-line, .ov-box, .subs-now');
      if (box) { e.preventDefault(); e.stopPropagation(); box.classList.toggle('tr-peek'); return; }
    }
    if (st.clk) {
      // «эта строка звучит сейчас»: the next line tapped (in the list or the big one) sets the delay
      const row = st.syncTap && (t.closest('.subs-line[data-i]') || t.closest('[data-s2big] .ov-box'));
      if (row && !t.closest('[data-add], .sl-chk')) { e.preventDefault(); e.stopPropagation(); Second.syncTo(row.dataset.i != null ? +row.dataset.i : st.cur); return; }
      const b = t.closest('[data-s2]');
      if (b) {
        const a = b.dataset.s2;
        if (a === 'nudge') Second.nudge(+b.dataset.n); else if (a === 'tap') Second.tapMode(!st.syncTap); else if (a === 'tapx') Second.tapMode(false); else if (a === 'pause') Second.pause();
        return;
      }
    }
    if (t.closest('[data-pick]')) { const k = t.closest('[data-pick]').dataset.pick; const inp = st.m.$(`[data-in="${k}"]`); inp.value = ''; inp.click(); return; }
    if (t.closest('[data-unset]')) {
      const k = t.closest('[data-unset]').dataset.unset;
      if (k === 'media') { if (st.mediaUrl) URL.revokeObjectURL(st.mediaUrl); Clip.reset(); st.media = null; st.mediaUrl = ''; st.kind = ''; }
      if (k === 'no') { st.noFile = null; st.noCues = null; }
      if (k === 'tr') { st.trFile = null; st.trCues = null; st.trLang = ''; }
      buildLines(); render(); return;
    }
    if (t.closest('[data-open]')) { openPlayer(); return; }
    const go = t.closest('[data-goto]');
    if (go) { e.preventDefault(); st.m.close(); if (go.dataset.goto === 'youtube') YouTube.open(null); else if (window.NrkTV) NrkTV.open(); return; }
    if (t.closest('[data-drop]')) { const inp = st.m.$('[data-in="any"]') || makeAnyInput(); inp.value = ''; inp.click(); return; }
    if (t.closest('[data-files]')) { const v = media(); if (v) v.pause(); st.stage = 'load'; render(); return; }
    // the deck itself — every window closes (the NRK / YouTube list under the player too), not just this one
    if (t.closest('[data-deck]')) { const id = st.deckId; if (id) UI.goTo('deck', { id }); else st.m.close(); return; }
    const lok = t.closest('[data-langok]');
    if (lok) { e.preventDefault(); e.stopPropagation(); langOk(+lok.dataset.langok); return; }
    const w = t.closest('.sw[data-w]');
    if (w && st.stage === 'player') {
      const sel = window.getSelection && window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) return; // several words selected: the app's selection bubble
      e.stopPropagation(); wordPop(w); return;
    }
    const add = t.closest('[data-add]'); if (add) { addLine(+add.dataset.add, add); return; }
    if (t.closest('[data-chk]') || t.closest('.sl-chk')) return;
    const pl = t.closest('[data-play]');
    if (pl) { const sel = window.getSelection && window.getSelection(); if (sel && !sel.isCollapsed && sel.toString().trim()) return; playLine(+pl.dataset.play); return; }
    const k = t.closest('[data-k]');
    if (k) {
      const a = k.dataset.k;
      if (a === 'toggle') toggle(); else if (a === 'prev') step(-1); else if (a === 'next') step(1); else if (a === 'loop') setLoop(!st.loop);
      else if (a === 'full') Full.toggle();
      else if (a === 'golive') Live.go();
      else if (a === 'livedelay') AsrGate.liveToggle();
      else if (a === 'retry') retryStream();
      else if (a === 'tv') tvHelp();
      else if (a === 'glass') glassToggle();
      else if (a === 'ocr') ocrFrame();
      else if (a === 'ink') Ink.toggle();
      else if (a === 'ovwin') ovToggle();
      else if (a === 'subview') svPanel();
      else if (a === 'ovbg') bgSet(!tvPrefs().bg, true);
      else if (a === 'kar') Kar.set(!Kar.prefs().on);
      else if (a === 'trpop') trPop(k);
      else if (a === 'ownsub') ownSubPick();
      return;
    }
    const ly = t.closest('.subs-lay [data-lay]'); // not the .subs-wrap[data-lay] around everything (that swallowed every click below)
    if (ly) {
      try { localStorage.setItem(LAY_KEY, ly.dataset.lay); } catch (_) { /* full */ }
      const w = st.m.$('.subs-wrap'); if (w) w.dataset.lay = ly.dataset.lay;
      st.m.$$('.subs-lay [data-lay]').forEach(b => b.classList.toggle('active', b.dataset.lay === ly.dataset.lay));
      return;
    }
    if (t.closest('[data-asr-go]')) { Asr.enable(true); return; }
    if (AsrGate.click(t)) return; // ⏳ the overlay of own subtitles: skip / download / wait / the light model
    const r = t.closest('[data-rate]');
    if (r) { setRate(+r.dataset.rate); return; }
    const tm = t.closest('[data-trmode]');
    if (tm) { setTrMode(tm.dataset.trmode); if (tm.closest('[data-trpop]')) trPopClose(true); return; }
    const km = t.closest('[data-karmode]'); if (km) { Kar.set(true, km.dataset.karmode, true); return; }
    const ks = t.closest('[data-karsh]'); if (ks) { Kar.nudge(+ks.dataset.karsh); return; }
    if (t.closest('[data-karhelp]')) { if (window.Help && Help.open) Help.open('karaoke'); return; }
    if (t.closest('[data-karexact-x]')) { const n = st.m.$('[data-karexact-note]'); if (n) n.hidden = true; const b = st.m.$('[data-karexact]'); if (b) { b.setAttribute('aria-expanded', 'false'); b.focus({ preventScroll: true }); } return; }
    if (t.closest('[data-karexact]')) { Kar.exact(); return; }
    if (t.closest('[data-burn-go]')) { burnAnswer(true); return; }
    if (t.closest('[data-ink-dl]')) { Ink.answer(true); return; }
    if (t.closest('[data-song-dl]')) { Song.answer(true); return; }
    if (t.closest('[data-song-no]')) { Song.answer(false); return; }
    if (t.closest('[data-ink-no]')) { Ink.answer(false); return; }
    if (t.closest('[data-burn-keep]')) { burnAnswer(false); return; }
    const off = t.closest('[data-off]');
    if (off) { st.offset = Math.round((st.offset + +off.dataset.off) * 10) / 10; st.m.$('[data-offv]').textContent = fmtOff(); st.m.$$('.sl-time').forEach(b => { b.textContent = tLabel(lineT(st.lines[+b.dataset.play], 'start')); }); tick(); return; }
    const s = t.closest('[data-sel]');
    if (s) {
      const how = s.dataset.sel;
      const vis = i => { const row = st.m.$(`.subs-line[data-i="${i}"]`); return row && !row.classList.contains('hid'); };
      if (how === 'none') st.checked.clear();
      else st.lines.forEach((l, i) => { if (!l._made && !skipTr(l) && vis(i) && (how === 'all' || lineNew(l).size)) st.checked.add(i); });
      st.m.$$('[data-chk]').forEach(x => { x.checked = st.checked.has(+x.dataset.chk); });
      countSel(); return;
    }
    const b = t.closest('[data-bulk]');
    if (b) { bulk(b.dataset.bulk === 'checked' ? [...st.checked].sort((x, y) => x - y) : st.lines.map((l, i) => i).filter(i => !st.lines[i]._made && lineNew(st.lines[i]).size)); return; }
    if (t.closest('[data-trall]')) { trRetry(true); UI.toast('Перевожу все строки — частями, начиная с текущей', '', 3500); return; }
    if (t.closest('[data-trretry]')) { trRetry(false); return; }
    if (t.closest('[data-trpick]')) {
      // the app's own «choose a translator» window (Google / Mozhi / MyMemory / keys / neural networks)
      const n = st.lines.filter(l => l._trFail && trOf(l) === undefined && !skipTr(l)).length;
      if (window.Study && Study.failModal) { Study._lastFail = { missing: n || 1, error: Translators.gCooling() ? 'Google временно ограничил переводы' : 'переводчики сейчас не отвечают' }; Study.failModal(() => trRetry(false)); }
      return;
    }
  }
  /** «Aa» on the video: a small window with the four ways to show the translation (the video keeps playing) */
  function trPop(btn) {
    if (!st || !st.m) return;
    if (st.m.$('[data-trpop]')) { trPopClose(true); return; }
    const host = btn.closest('[data-stage]') || btn.parentElement;
    const el = document.createElement('div');
    el.className = 'subs-trpop'; el.dataset.trpop = ''; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Как показывать перевод');
    el.innerHTML = `<div class="tp-head">Перевод</div><div class="tp-list" role="radiogroup" aria-label="Перевод">${TR_MODES.map(([k, t, tip, ic]) =>
      `<button type="button" class="tp-opt${st.trMode === k ? ' on' : ''}" data-trmode="${k}" role="radio" aria-checked="${st.trMode === k}"><span class="tp-ico" aria-hidden="true">${ic}</span><span class="tp-txt"><b>${t}</b><small>${tip}</small></span></button>`).join('')}</div>`;
    host.appendChild(el);
    const hr = host.getBoundingClientRect(), br = btn.getBoundingClientRect();
    const w = Math.min(320, hr.width - 16);
    el.style.width = w + 'px';
    el.style.left = Math.max(8, Math.min(hr.width - w - 8, br.left - hr.left)) + 'px';
    el.style.top = (br.bottom - hr.top + 6) + 'px';
    btn.setAttribute('aria-expanded', 'true');
    const on = el.querySelector('.tp-opt.on') || el.querySelector('.tp-opt'); if (on) on.focus({ preventScroll: true });
    el.addEventListener('keydown', e => {
      const opts = [...el.querySelectorAll('.tp-opt')], i = opts.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); opts[(i + (e.key === 'ArrowDown' ? 1 : opts.length - 1)) % opts.length].focus(); }
    });
  }
  function trPopClose(focus) {
    const el = st && st.m && st.m.$('[data-trpop]'); if (!el) return;
    el.parentNode.removeChild(el);
    const b = st.m.$('[data-k="trpop"]'); if (b) { b.setAttribute('aria-expanded', 'false'); if (focus) b.focus({ preventScroll: true }); }
  }
  function setTrMode(mode, temp) {
    if (!TR_MODES.some(x => x[0] === mode)) mode = 'show';
    const wasWord = st.trMode === 'word';
    st.trMode = mode;
    if (wasWord !== (mode === 'word')) { st.lines.forEach((x, i) => redrawLine(i)); if (mode === 'word') glossNear(Math.max(0, st.cur)); else glossProg(''); }
    if (!temp) try { localStorage.setItem('nk-subs-tr', mode); } catch (_) { /* full */ } // 🎓 a step's mode is not the saved choice
    st.m.el.dataset.tr = mode;
    st.m.$$('[data-trmode]').forEach(b => { const on = b.dataset.trmode === mode; b.classList.toggle('active', on); b.classList.toggle('on', on); b.setAttribute(b.getAttribute('role') === 'radio' ? 'aria-checked' : 'aria-pressed', on ? 'true' : 'false'); });
    st.m.$$('[data-trname]').forEach(b => { b.textContent = trName(mode).toLowerCase(); }); // the «Aa» button on the video too
    st.m.$$('.tr-peek').forEach(b => b.classList.remove('tr-peek'));
    NativeSubs.sync(); // the system's own full screen follows the mode too
  }

  /* ---------- 📺 «Подключиться к телевизору»: one window, the list of TVs (like YouTube's cast button) ----------
   * The Mac bridge finds Chromecast / Android TV / Google TV on the home network and makes the chosen TV play the
   * program itself — with our subtitles (Norwegian + Russian). Works from any browser on the Mac (Safari too). */
  /** a short fingerprint of the subtitles sent to the TV (to notice when the screen has newer translations) */
  const vttHash = s => { let h = 0; s = String(s || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
  /** what the TV's subtitles depend on: the lines + the 🎤 choice («Бегущая строка», its look, «Сдвиг слов») — not the
   *  word times themselves (they get finer while the sound is read; that alone is no reason to ask for a refresh) */
  const tvSig = () => { const k = Kar.prefs(); return k.on ? tvVtt(true) + `|🎤${k.mode}|${st.ksh || 0}` : tvVtt(); };
  /** the screen's subtitles differ from the TV's (translation, look, place, 🎤): offer «🔄 Обновить субтитры на телевизоре» */
  function tvStale() {
    if (!st || !st.m || !st.castInfo || st.castInfo.youtube || !st.tvVttHash || st.castLost || st.castBusy) return;
    const stale = vttHash(tvSig()) !== st.tvVttHash || (st.tvStyleKey != null && JSON.stringify(tvStyle(tvPrefs())) !== st.tvStyleKey), bar = st.m.$('[data-castbar]'); // the size (A−…A++) is in the style
    let note = bar && bar.querySelector('[data-tvstale]');
    if (stale && bar && !note) {
      note = document.createElement('div'); note.className = 'cast-lost cast-stale'; note.dataset.tvstale = '';
      note.innerHTML = '<span>📝 Субтитры на экране изменились (перевод, цвет, размер, положение или бегущая строка) — на телевизоре пока прежние.</span><button class="btn sm primary" data-tvc="refresh">🔄 Обновить субтитры на телевизоре</button>';
      bar.prepend(note);
    } else if (!stale && note) note.remove();
  }
  async function castApi(action, body) {
    if (action === 'play' && body && body.vtt && st) { st.tvVttHash = vttHash(tvSig()); st.tvStyleKey = body.style ? JSON.stringify(body.style) : null; }
    let r;
    try { r = await fetch('/api/cast/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); }
    catch (e) { throw new Error('мост на Mac не отвечает'); }
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 && /not found/.test(j.error || '')) throw Object.assign(new Error('мост на Mac старой версии'), { oldBridge: true });
    if (!r.ok) throw Object.assign(new Error(j.error || 'ошибка ' + r.status), { install: !!j.install });
    return j;
  }
  /** 🔄 after «поток не загружается»: the same program / broadcast again (a fresh address from NRK) */
  function retryStream() {
    const v = media(), S = st && st.stream; if (!v || !S) return;
    st.streamErr = ''; st.nativeRetry = 0; st.reloading = false;
    const box = st.m.$('[data-now]'); if (box) box.innerHTML = '<div class="sn-empty muted"><span class="spinner sm"></span> Загружаю снова…</div>';
    if (S.video || S.mp3) { const t = v.currentTime; v.src = S.video || S.mp3; v.addEventListener('loadedmetadata', () => { if (t) v.currentTime = t; }, { once: true }); const p = v.play(); if (p && p.catch) p.catch(() => {}); return; }
    streamReload(v);
  }
  /* ---------- 📺 without the Mac bridge (the public site, or the bridge is off) ---------- */
  /** the app runs on this Mac itself: only here do hints with the Terminal command make sense */
  const onMac = () => location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/.test(location.hostname);
  /** what this device and browser can do */
  function tvDevice() {
    const ua = navigator.userAgent;
    const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const mac = /Macintosh/.test(ua) && !iOS, android = /Android/.test(ua);
    const chrome = /Chrome|CriOS|Edg/.test(ua) && !/OPR|SamsungBrowser/.test(ua);
    const safari = /Safari/.test(ua) && !/Chrome|CriOS|Edg|FxiOS|OPR|Android/.test(ua);
    return { iOS, mac, android, chrome, safari, cast: Cast.supported() };
  }
  /** an address the TV can open by itself (on the internet — not a file on this device, not the Mac's bridge):
   *  { url, type, audio, hls } or null */
  function tvSource(S) {
    if (!S || S.live || S.companion || S.kind === 'youtube') return null;
    const pub = u => /^https?:\/\//i.test(u || '') && !/^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(u);
    if (S.kind === 'nrk' && S.hls && pub(S.hls)) return { url: S.hls, type: 'application/x-mpegurl', audio: !!S.audio, hls: true };
    if (S.mp3 && pub(S.mp3)) return { url: S.mp3, type: 'audio/mpeg', audio: true };
    if (S.video && pub(S.video) && !S.blob) {
      const ext = (String(S.video).split(/[?#]/)[0].match(/\.([a-z0-9]{2,4})$/i) || [])[1] || '';
      const type = { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', wav: 'audio/wav', m3u8: 'application/x-mpegurl' }[ext.toLowerCase()] || (S.audio ? 'audio/mpeg' : 'video/mp4');
      return { url: S.video, type, audio: !!S.audio || /^audio\//.test(type), hls: ext.toLowerCase() === 'm3u8' };
    }
    return null;
  }
  /** 🪞 screen mirroring for this device: [[title, how]] */
  function mirrorSteps(d) {
    const steps = [];
    if (d.chrome && !d.iOS && !d.android) steps.push(['🖥 Chrome на компьютере → телевизор с Chromecast', 'Меню Chrome <b>⋮</b> → <b>Трансляция, сохранение и отправка</b> → <b>Трансляция…</b> → выберите телевизор. Источник: <b>«Транслировать вкладку»</b> (звук пойдёт тоже). Затем здесь <b>⛶ На весь экран</b>.']);
    if (d.mac) steps.push(['🍎 Mac → Apple TV или телевизор с AirPlay (Samsung, LG, Sony…)', 'Пункт управления (два переключателя в строке меню) → <b>Повтор экрана</b> → выберите телевизор. Затем здесь <b>⛶ На весь экран</b>. <i>Android-приставки AirPlay не принимают.</i>']);
    if (d.iOS) steps.push(['📱 iPhone / iPad → Apple TV или телевизор с AirPlay', 'Пункт управления (смахните вниз от правого верхнего угла) → <b>Повтор экрана</b> → выберите телевизор, затем здесь <b>⛶ На весь экран</b>. <i>Android-приставки AirPlay не принимают.</i>']);
    if (d.android) steps.push(['🤖 Android → Chromecast / Android TV / Google TV', 'Быстрые настройки (смахните сверху вниз) → <b>Трансляция экрана</b> (или «Smart View» на Samsung) → выберите телевизор. Затем здесь <b>⛶ На весь экран</b>.']);
    if (!steps.length) steps.push(['📺 Любой телевизор', 'Включите на устройстве повтор (трансляцию) экрана на телевизор, затем здесь нажмите <b>⛶ На весь экран</b>.']);
    return steps;
  }
  /** the app's own address (GitHub Pages serves it under a sub-path) */
  const appAddr = () => location.origin + location.pathname.replace(/[^/]*$/, '');
  /** 🎤 Google's own player (Chrome's cast, no bridge) shows NRK's own subtitle file only — say so once, kindly */
  const tvKarNote = () => (Kar.prefs().on && !Cast.appId()
    ? `<div class="tv-kar-note" data-tv-kar>Бегущая строка так на телевизор не пойдёт — там будут обычные строки. ${onMac() ? 'Со словами, которые загораются, — через мост на Mac; ' : ''}при повторе экрана или AirPlay экрана телевизор покажет её как здесь.</div>`
    : '');
  /** the window «Подключиться к телевизору» when there is no bridge: the best way for this device first */
  function tvNoBridge(m, box, S) {
    const d = tvDevice(), src = tvSource(S);
    const v = st.m.$('video[data-media]') || st.m.$('audio[data-media]');
    const sound = !!(src ? src.audio : (S.audio || st.kind === 'audio'));
    const airplay = !!(src && v && typeof v.webkitShowPlaybackTargetPicker === 'function' && !st.hls);
    const local = !S.kind || !!S.blob || S.kind === 'tg'; // own files, Telegram (through the Mac or saved here)
    const ytAt = () => { let t = 0; try { t = st.yt && st.yt.getCurrentTime ? st.yt.getCurrentTime() || 0 : 0; } catch (e) { /* the start */ } return S.at && t > 5 ? S.at(t) : S.link; };
    const subsHere = S.nrkVtt
      ? 'На телевизоре — норвежские субтитры NRK, а строка с переводом остаётся здесь, на экране: удобно читать с телефона.'
      : 'Строки с переводом остаются здесь, на экране, и идут вместе с телевизором.';
    let main = '', openMirror = false; // the mirroring steps open at once when there is no better way here
    if (S.live) {
      main = `<div class="tv-msg">📡 <b>Прямой эфир лучше смотреть на телевизоре в приложении NRK:</b> наши субтитры к эфиру появляются на ходу, и телевизор показал бы его <b>без них</b>. Или повторите экран этого устройства — тогда будут и субтитры, и перевод (ниже).</div>
        ${S.link ? `<a class="btn tv-wide" href="${U.esc(S.link)}" target="_blank" rel="noopener">↗ Открыть в NRK</a>` : ''}`;
    } else if (S.kind === 'youtube') {
      main = `<div class="tv-step tv-main"><b>▶ Видео YouTube — через само приложение YouTube</b>
          <div class="small">Откройте видео в YouTube и нажмите там значок трансляции (экран с волнами, вверху видео) — выберите телевизор. ${d.iOS ? 'На iPhone приложение YouTube умеет и Chromecast, и AirPlay.' : ''} Видео пойдёт <b>без наших субтитров</b>; с переводом — повтором экрана (ниже).</div>
          <a class="btn primary tv-wide" data-tvn-yt href="${U.esc(ytAt() || '')}" target="_blank" rel="noopener">▶ Открыть в YouTube</a></div>`;
    } else if (src && d.cast) {
      main = `<button class="btn primary lg tv-cast" data-tvn-cast>📡 Выбрать телевизор <small>Chromecast · Android TV · Google TV${sound ? ' · колонка Google' : ''}</small></button>
        <div class="small muted tv-cast-note">${sound ? 'Звук пойдёт на телевизор или колонку, строки с переводом — здесь, на экране.' : subsHere} Здесь останется пульт: пауза и стоп.</div>
        ${sound ? '' : tvKarNote()}
        <div data-tvn-out></div>`;
    } else if (airplay) {
      main = `<button class="btn primary lg tv-cast" data-tvn-airplay>◎ AirPlay <small>Apple TV · телевизор с AirPlay (Samsung, LG, Sony…)</small></button>
        <div class="small muted tv-cast-note">${sound ? 'Звук пойдёт на телевизор или колонку' : 'Телевизор покажет видео'}, а строки с переводом останутся здесь, на экране.
          ${d.iOS ? `Chromecast и Android-приставки AirPlay не принимают${S.kind === 'nrk' && S.link ? ' — для них откройте передачу в приложении NRK: у него есть своя кнопка трансляции (но без нашего перевода)' : ''}.` : 'Chromecast и Android-приставки AirPlay не принимают — для них откройте приложение в Google Chrome или повторите экран (ниже).'}</div>
        ${d.iOS && S.kind === 'nrk' && S.link ? `<a class="btn tv-wide" href="${U.esc(S.link)}" target="_blank" rel="noopener">↗ Открыть в приложении NRK</a>` : ''}`;
    } else if (src) {
      openMirror = true;
      main = `<div class="tv-step tv-main"><b>📡 Chromecast, Android TV, Google TV</b>
          <div class="small">${d.iOS ? 'На iPhone и iPad браузер не умеет отправлять видео на Chromecast — так решила Apple. Откройте это приложение в <b>Safari</b> (там есть AirPlay) — или повторите экран (ниже).'
            : `Кнопка выбора телевизора есть в браузере <b>Google Chrome</b> (Android, Windows, Mac). Откройте это же приложение в Chrome: <b>${U.esc(appAddr())}</b>`}</div>
          ${d.iOS ? '' : '<button class="btn sm" data-tvn-copy>📋 Скопировать адрес для Chrome</button>'}</div>`;
    } else {
      openMirror = true;
      main = `<div class="tv-msg">${sound ? '🎧 Эта запись' : '🎬 Это видео'} ${S.kind === 'tg' && !S.blob ? 'из Telegram открывается только здесь, в приложении' : local ? 'хранится на этом устройстве' : 'играет только здесь'} — телевизор сам открыть ${sound ? 'её' : 'его'} не может. Но смотреть на большом экране можно — повтором экрана, это просто:</div>`;
    }
    const steps = mirrorSteps(d);
    const extra = sound && !src ? '<div class="tv-step"><b>🔊 Колонка Bluetooth или наушники</b><div class="small">Подключите их в настройках Bluetooth этого устройства — звук пойдёт туда.</div></div>' : '';
    box.innerHTML = `${main}
      <details class="tv-more" ${openMirror ? 'open' : ''}><summary>🪞 Повтор экрана — телевизор показывает ровно то, что здесь (вместе с субтитрами и переводом)</summary>
        ${steps.map(([h, t]) => `<div class="tv-step"><b>${h}</b><div class="small">${t}</div></div>`).join('')}
        ${sound ? '' : '<button class="btn tv-wide" data-tvn-full>⛶ На весь экран</button>'}
      </details>${extra}`;
    box.addEventListener('click', async e => {
      if (e.target.closest('[data-tvn-full]')) { m.close(); setTimeout(() => Full.enter(), 220); return; }
      if (e.target.closest('[data-tvn-yt]')) { try { if (st.yt && st.yt.pauseVideo) st.yt.pauseVideo(); } catch (err) { /* it plays on */ } return; }
      if (e.target.closest('[data-tvn-airplay]')) { try { v.webkitShowPlaybackTargetPicker(); } catch (err) { UI.toast('AirPlay сейчас недоступен — включите повтор экрана в Пункте управления', 'warn', 5000); } return; }
      if (e.target.closest('[data-tvn-copy]')) {
        try { await navigator.clipboard.writeText(appAddr()); UI.toast('Адрес скопирован — вставьте его в Google Chrome', 'good'); } catch (err) { UI.toast('Адрес: ' + appAddr(), '', 6000); }
        return;
      }
      const c = e.target.closest('[data-tvn-cast]'); if (!c || c.disabled) return;
      const out = box.querySelector('[data-tvn-out]'); if (out) out.innerHTML = '';
      c.disabled = true; const label = c.innerHTML; c.innerHTML = '<span class="spinner sm"></span> ищу телевизоры…';
      try { if (await Cast.start()) { m.close(); UI.toast('📡 Идёт на телевизоре', 'good', 4000); } }
      catch (err) {
        // no technical text: what to check and how else
        if (out) out.innerHTML = `<div class="tv-prep warn" role="status"><span class="tv-hourglass" aria-hidden="true">📺</span><span class="grow"><b>${U.esc(err && err.message ? U.niceErr(err) : 'Телевизор сейчас не ответил')}</b>
          <small>Телевизор или приставка должны быть включены и в той же Wi-Fi сети, что и это устройство. Можно нажать ещё раз — или повторить экран (ниже).</small></span></div>`;
      }
      if (c.isConnected) { c.disabled = false; c.innerHTML = label; }
    });
  }
  function tvHelp() {
    const S = st.stream || {};
    const canCast = S.kind === 'nrk' || S.kind === 'youtube';
    const bridge = macBridge(); // /api/cast/* only on the Mac with its bridge
    const m = UI.modal({
      title: `${UI.TV_SVG(24)} Подключиться к телевизору`, cls: 'tv-modal',
      body: `<div data-tv></div><button class="btn sm ghost tv-other" data-tv-other>Другие способы (повтор экрана, AirPlay)</button>`,
    });
    const box = m.$('[data-tv]');
    m.$('[data-tv-other]').onclick = () => { m.close(); setTimeout(tvOther, 220); };
    // no bridge (the public site, or the Mac's bridge is off): straight to the best way for this device
    if (!bridge) { m.$('[data-tv-other]').remove(); tvNoBridge(m, box, S); return; }
    if (!canCast) { box.innerHTML = `<div class="tv-msg">${S.kind === 'tg' ? 'Видео из Telegram идёт через мост на этом Mac — телевизор открыть его сам не может.' : 'Свои файлы с этого Mac телевизор открыть не может.'} Используйте повтор экрана — «Другие способы» ниже.</div>`; return; }
    // live: our subtitles are made on the fly here — a TV playing the stream itself would show it without them
    if (S.live) { box.innerHTML = `<div class="tv-msg">📡 <b>Прямой эфир приложение на телевизор не отправляет:</b> наши субтитры к эфиру появляются на ходу, и телевизор показал бы эфир <b>без них</b>. Смотрите эфир на телевизоре в приложении NRK — или повторите экран этого устройства (тогда будут и субтитры, и перевод): «Другие способы» ниже.</div>
      <a class="btn" href="${U.esc(S.link)}" target="_blank" rel="noopener">↗ Открыть в NRK</a>`; return; }
    const devHtml = list => list.length
      ? `${Kar.prefs().on && !S.audio ? '<div class="tv-kar-note ok" data-tv-kar>🎤 Бегущая строка тоже пойдёт на телевизор: звучащее слово выделено жирным и цветом.</div>' : ''}<div class="tv-hint small muted">Выберите телевизор:</div>
         <div class="tv-devs">${list.map(d => `<button class="tv-dev" data-dev="${U.esc(d.id)}" data-name="${U.esc(d.name)}"><span class="tv-ico">${d.group ? '🔊' : '📺'}</span><span class="grow"><b>${U.esc(d.name)}</b>${d.model ? `<small>${U.esc(d.model)}</small>` : ''}</span><span class="tv-go">›</span></button>`).join('')}</div>
         <button class="btn sm ghost" data-tv-rescan>🔄 Искать снова</button>`
      : `<div class="tv-msg">Телевизоры не найдены. Они должны быть <b>включены</b> и в <b>той же Wi-Fi сети</b>, что и этот Mac.</div><button class="btn" data-tv-rescan>🔄 Искать снова</button>`;
    const load = async () => {
      box.innerHTML = '<div class="tv-msg"><span class="spinner sm"></span> Ищу телевизоры в вашей сети…</div>';
      try { box.innerHTML = devHtml((await castApi('devices', { timeout: 7 })).devices || []); } // a short search misses TVs
      catch (e) {
        if (e.install) {
          box.innerHTML = `<div class="tv-msg">Чтобы отправлять передачи на телевизор (Chromecast, Android-приставка, Google TV), приложению нужен <b>модуль трансляции</b> — он устанавливается <b>один раз</b>, около минуты.</div>
            <button class="btn primary lg tv-install" data-tv-install>⬇ Установить модуль трансляции</button>`;
        } else if (e.oldBridge) {
          box.innerHTML = '<div class="tv-msg">Мост на Mac нужно перезапустить (в нём новая функция): в окне Терминала, где он запущен, нажмите <b>Ctrl+C</b> и запустите снова <code>python3 "…/bridge/server.py"</code>. Потом снова нажмите «📺 На телевизор».</div>';
        } else box.innerHTML = `<div class="tv-msg">⚠️ ${U.esc(U.niceErr(e))}</div><button class="btn" data-tv-rescan>🔄 Попробовать снова</button>`;
      }
    };
    box.addEventListener('click', async e => {
      if (e.target.closest('[data-tv-rescan]')) { load(); return; }
      const ins = e.target.closest('[data-tv-install]');
      if (ins) {
        ins.disabled = true; ins.innerHTML = '<span class="spinner sm"></span> Устанавливаю… (около минуты)';
        try { await castApi('install'); UI.toast('Модуль трансляции установлен', 'good'); load(); }
        catch (err) { ins.disabled = false; ins.innerHTML = '⬇ Установить модуль трансляции'; UI.toast(err.message, 'bad', 9000); }
        return;
      }
      const d = e.target.closest('[data-dev]'); if (!d) return;
      box.querySelectorAll('[data-dev]').forEach(b => { b.disabled = true; });
      d.querySelector('.tv-go').innerHTML = '<span class="spinner sm"></span>';
      // ⏳ what is happening right now, step by step (translating can take a while for a long program)
      const devName = d.dataset.name;
      box.querySelector('[data-tv-prep]')?.remove();
      box.insertAdjacentHTML('afterbegin', `<div class="tv-prep" data-tv-prep role="status" aria-live="polite">
        <span class="tv-hourglass" data-aiw-live="tr" data-aiw-idle="tv" data-aiw-size="34" aria-hidden="true"></span><span class="grow"><b data-tv-step></b><small data-tv-sub></small></span></div>`);
      if (window.AIHub && AIHub.paintWork) AIHub.paintWork(); // 🌀 the translator's living logo instead of an hourglass
      const step = (t, sub = '') => { const b = box.querySelector('[data-tv-step]'), s = box.querySelector('[data-tv-sub]'); if (b) b.textContent = t; if (s) s.textContent = sub; };
      let tick = 0;
      try {
        const v = media();
        let body;
        if (S.kind === 'youtube') body = { id: d.dataset.dev, kind: 'youtube', videoId: S.id };
        else {
          const mode = tvPrefs().mode, total = st.lines.length;
          if (total && mode !== 'asis') {
            const done = () => st ? st.lines.filter(l => l.ruFile || trOf(l) !== undefined).length : total;
            const show = () => step('Перевожу субтитры на русский…', `${done()} из ${total} строк${mode === 'word' ? ' · потом перевод каждого слова' : ''} — для телевизора нужен перевод всех строк сразу`);
            show(); tick = setInterval(show, 700);
          } else step('Готовлю субтитры для телевизора…');
          await tvPrepare(mode, (dn, tot, ph) => {
            clearInterval(tick); tick = 0;
            step('Перевожу каждое слово по смыслу строки…', ph === 'ai' ? `${dn} из ${tot} строк · ${window.AI && AI.available() ? AI.name() : 'нейросеть'}` : 'ищу каждое слово в переводе строки');
          });
          clearInterval(tick); tick = 0;
          body = { id: d.dataset.dev, kind: 'hls', url: S.hls, title: S.title, vtt: tvVtt(), style: tvStyle(tvPrefs()), start: v ? v.currentTime || 0 : 0 };
        }
        step(`Подключаюсь к «${devName}»…`, 'телевизор или приставка должны быть включены');
        tick = setTimeout(() => step(`«${devName}» загружает передачу…`, 'обычно 5–15 секунд'), 3500);
        let r;
        try { r = await castApi('play', body); }
        catch (err1) { // one quiet second try (a TV that was asleep often answers the second time)
          if (err1.install || err1.oldBridge) throw err1;
          clearTimeout(tick);
          step(`Ещё раз подключаюсь к «${devName}»…`, 'первая попытка не удалась — так бывает, если приставка спала');
          await new Promise(res => setTimeout(res, 1500));
          tick = setTimeout(() => step(`«${devName}» загружает передачу…`, 'обычно 5–15 секунд'), 5000);
          r = await castApi('play', body);
        }
        clearTimeout(tick); tick = 0;
        m.close();
        st.castInfo = { id: d.dataset.dev, name: r.name || d.dataset.name, url: S.hls, title: S.title, youtube: S.kind === 'youtube' };
        castBar(d.dataset.dev, r.name || d.dataset.name, S.kind === 'youtube');
        if (st.rate !== 1 && S.kind !== 'youtube') setTimeout(tvRate, 1500); // the chosen slow speed on the TV too
        if (S.kind === 'youtube') { if (v && !v.paused) v.pause(); } else castSync(true);
        UI.toast(`📺 Идёт на телевизоре «${r.name || d.dataset.name}»${S.kind === 'youtube' ? ' (в приложении YouTube, без наших субтитров)' : ''}`, 'good', 5000);
      } catch (err) {
        clearInterval(tick); clearTimeout(tick);
        box.querySelectorAll('[data-dev]').forEach(b => { b.disabled = false; });
        d.querySelector('.tv-go').textContent = '›';
        const p = box.querySelector('[data-tv-prep]');
        // no technical text: what to check and how to go on
        if (p) {
          p.classList.add('warn');
          p.innerHTML = `<span class="tv-hourglass" aria-hidden="true">📺</span><span class="grow"><b>«${U.esc(devName)}» сейчас не ответил.</b>
            <small>Проверьте, что телевизор или приставка включены и в той же Wi-Fi сети, и нажмите на него ещё раз.${err.oldBridge ? ' Мост на Mac нужно перезапустить.' : ''}</small></span>`;
        }
      }
    });
    load();
  }
  /* ---------- the subtitles on the TV: the user's look (kept on this device) ---------- */
  const TV_KEY = 'nk-tv';
  // quick choices; any other colour comes from the full palette (<input type="color">)
  const TV_COLORS = [['#ffffff', 'белый'], ['#ffd84d', 'жёлтый'], ['#5ee7ff', 'голубой'], ['#7dff7a', 'зелёный'], ['#ff9f43', 'оранжевый'], ['#ff7eb6', 'розовый']];
  const NAMED = { white: '#ffffff', yellow: '#ffd84d', cyan: '#5ee7ff', lime: '#7dff7a' }; // older saved choices
  const HEX = /^#[0-9a-f]{6}$/i;
  /* ⊞ «Положение субтитров»: where OUR lines sit on the video — here, in full screen and on our TV page */
  const SV_POS = [['bottom', 'Внизу'], ['top', 'Вверху'], ['full', 'На весь экран'], ['right', 'Справа'], ['left', 'Слева'],
    ['split-no', 'Норвежский слева · перевод справа'], ['split-tr', 'Перевод слева · норвежский справа']];
  const SV_POS_KEYS = SV_POS.map(x => x[0]);
  // «↺ Сбросить всё» in «Aa Вид субтитров»: the look as it was at the start (the TV mode is not in that window — it stays)
  const SV_DEF = { no: '#ffffff', ru: '#ffd84d', size: 'm', bg: false, gl: 'small', pos: 'bottom' };
  const tvPrefs = () => {
    let p = {}; try { p = JSON.parse(localStorage.getItem(TV_KEY) || '{}'); } catch (e) { /* defaults */ }
    if (!p || typeof p !== 'object' || Array.isArray(p)) p = {};
    // gl: how big the (перевод) after each word is — 'same' as the word, 'mid', 'small' (the old look)
    p = Object.assign({ mode: 'sent' }, SV_DEF, p);
    if (!SV_POS_KEYS.includes(p.pos)) p.pos = 'bottom';
    // 🔲 the dark strip under the lines is OFF unless chosen with the new switch (bgv: 2) — before, it was on for everyone
    // (and saved with every other change), so an old «bg: true» is not a choice
    if (p.bgv !== 2) p.bg = false;
    ['no', 'ru'].forEach(k => { if (NAMED[p[k]]) p[k] = NAMED[p[k]]; if (!HEX.test(p[k])) p[k] = k === 'no' ? '#ffffff' : '#ffd84d'; });
    if (!['s', 'm', 'l', 'xl'].includes(p.size)) p.size = 'm';
    if (!['same', 'mid', 'small'].includes(p.gl)) p.gl = 'small';
    return p;
  };
  const tvSave = p => { try { localStorage.setItem(TV_KEY, JSON.stringify(p)); } catch (e) { /* full */ } };
  /* ---------- Aa the look of the subtitles ON THIS SCREEN — the same colours and size as on the TV (one setting) ---------- */
  const SV_SCALE = { s: 0.85, m: 1, l: 1.2, xl: 1.4 };
  const SV_GL = { same: [1, 1], mid: [0.8, 0.8], small: [0.62, 0.8] }; // [on the video, under it / in the list]
  function svApply() {
    if (!st || !st.m) return;
    const p = tvPrefs(), el = st.m.el, g = SV_GL[p.gl] || SV_GL.small;
    el.style.setProperty('--sv-no', p.no); el.style.setProperty('--sv-ru', p.ru);
    el.style.setProperty('--sv-scale', String(SV_SCALE[p.size] || 1));
    el.style.setProperty('--sv-gl', String(g[0])); el.style.setProperty('--sv-gl2', String(g[1]));
    el.style.setProperty('--sv-bga', p.bg ? '.64' : '0');
    el.classList.toggle('sv-nobg', !p.bg); // no strip: the letters get a black outline (readable on a light picture)
    st.m.$$('[data-k="ovbg"]').forEach(b => { b.classList.toggle('on', !!p.bg); b.setAttribute('aria-pressed', p.bg ? 'true' : 'false'); });
    posFit(); // ⊞ the place of the lines (and their size there) follows
  }
  /** 🔲 «Подложка» on / off — ONE setting (this screen, full screen, «Aa Вид субтитров», the TV) */
  function bgSet(on, toast) {
    const p = tvPrefs(); p.bg = !!on; p.bgv = 2; tvSave(p);
    svApply();
    const cb = st && st.m && st.m.$('[data-castbar]'); if (cb && cb._draw) cb._draw(); // the TV bar shows the same choice
    Cast.style(); // our TV page (if it is the one showing): at once
    if (toast) UI.toast(on ? '🔲 Подложка включена: тёмная полоса под субтитрами' : '🔲 Подложка выключена: буквы с чёрной обводкой', '', 2200);
  }
  /* ---------- 💡 «where are the subtitle settings?» — not a one-time tip that is easy to miss:
   * a soft dot on the «Aa» button until it has been opened once, and a small bubble pointing at it —
   * on the first player, then at most once a day, up to 5 times; «Показать» opens the settings,
   * «Больше не напоминать» stops it; the bubble fades away by itself after 10 s and never blocks anything. */
  const SVH_KEY = 'nk-sv-hint';
  const svHintState = () => { try { return JSON.parse(localStorage.getItem(SVH_KEY) || '{}') || {}; } catch (e) { return {}; } };
  const svHintSave = s => { try { localStorage.setItem(SVH_KEY, JSON.stringify(s)); } catch (e) { /* full */ } };
  function svHintDone(why) {
    const s = svHintState(); s.done = why || 'used'; svHintSave(s);
    if (!st || !st.m) return;
    st.m.$$('[data-k="subview"]').forEach(b => b.classList.remove('sv-new'));
    st.m.$$('[data-svhint]').forEach(x => x.remove());
  }
  function svHint() {
    if (!st || !st.m || st.stage !== 'player' || st.kind !== 'video') return;
    if (!st.lines.length && st.stream && !st.stream.autoAsr) return; // no lines to style yet
    const s = svHintState(); if (s.done) return;
    st.m.$$('[data-k="subview"]').forEach(b => b.classList.add('sv-new'));
    const day = 20 * 3600e3, now = Date.now();
    if ((s.shown || 0) >= 5 || (s.last && now - s.last < day) || st.svHintShown) return;
    const btn = st.m.$('.subs-view [data-k="subview"]'); if (!btn) return;
    st.svHintShown = true; // once per player window
    s.shown = (s.shown || 0) + 1; s.last = now; svHintSave(s);
    setTimeout(() => {
      if (!st || !st.m || !btn.isConnected) return;
      const bar = btn.closest('.subs-view'); if (!bar) return;
      const tip = document.createElement('div');
      tip.className = 'sv-hint'; tip.dataset.svhint = ''; tip.setAttribute('role', 'status');
      tip.innerHTML = `<span class="sv-hint-txt">💡 Можно менять <b>размер и цвет субтитров</b>, а перевод слов сделать такого же размера, как сами слова.</span>
        <span class="sv-hint-act"><button type="button" class="btn sm primary" data-svh="show">Показать</button><button type="button" class="btn sm ghost" data-svh="never">Больше не напоминать</button></span>`;
      bar.appendChild(tip);
      // the arrow points at the button (wherever the row has wrapped it to)
      const place = () => { if (!tip.isConnected) return; const bx = btn.offsetLeft + btn.offsetWidth / 2, by = btn.offsetTop + btn.offsetHeight;
        // the bubble is its own row under the buttons (it pushes the page down a little, never covers a button)
        void by; tip.style.setProperty('--arrow', Math.max(18, Math.min(tip.clientWidth - 18, bx - tip.offsetLeft)) + 'px'); };
      place(); requestAnimationFrame(place);
      tip.addEventListener('click', e => {
        const b = e.target.closest('[data-svh]'); if (!b) return;
        if (b.dataset.svh === 'show') svPanel(); else { svHintDone('never'); UI.toast('Хорошо. Настройки всегда здесь: кнопка «Aa Вид субтитров»', '', 3500); }
        tip.remove();
      });
      setTimeout(() => { if (tip.isConnected) { tip.classList.add('out'); setTimeout(() => tip.remove(), 400); } }, 10000);
    }, 1200);
  }
  /** the window: size, the size of the word translations, colours (full palette), dark box — with a live preview */
  function svPanel() {
    let m;
    const draw = () => {
      const p = tvPrefs(), sc = SV_SCALE[p.size] || 1, g = (SV_GL[p.gl] || SV_GL.small)[0];
      const sw = (key, hex, label) => `<button type="button" class="tv-sw ${p[key].toLowerCase() === hex ? 'on' : ''}" data-svp="${key}" data-v="${hex}" style="--sw:${hex}" title="${label}" aria-label="${label}"></button>`;
      const pick = key => { const custom = !TV_COLORS.some(([h]) => h === p[key].toLowerCase());
        return `<label class="tv-pick ${custom ? 'on' : ''}" title="Любой цвет — полная палитра" style="--sw:${p[key]}"><input type="color" data-svcolor="${key}" value="${p[key]}" aria-label="Любой цвет"><span>🎨 Любой цвет</span></label>`; };
      const seg = (key, opts) => `<span class="seg-mini sm">${opts.map(([v, t]) => `<button type="button" data-svp="${key}" data-v="${v}" class="${p[key] === v ? 'active' : ''}">${t}</button>`).join('')}</span>`;
      const tm = st ? st.trMode : 'show', glp = w => tm === 'word' ? ` <span class="sv-pv-gl" style="color:${p.ru}">(${w})</span>` : '';
      m.$('[data-sv]').innerHTML = `
        <div class="sv-tr-head"><span class="small muted">Перевод:</span></div>
        <div class="sv-tr" role="radiogroup" aria-label="Перевод">${TR_MODES.map(([k, t, tip, ic]) => `<button type="button" class="sv-tr-opt${tm === k ? ' on' : ''}" data-svtr="${k}" role="radio" aria-checked="${tm === k}" title="${tip}"><span class="sv-tr-ico" aria-hidden="true">${ic}</span><span class="sv-tr-t">${t}</span></button>`).join('')}</div>
        <p class="tiny muted sv-tr-note">${U.esc((TR_MODES.find(x => x[0] === tm) || TR_MODES[0])[2])}. Меняется сразу — видео не останавливается.</p>
        <div class="sv-preview ${p.bg ? 'bg' : ''} sv-pv-${tm}" style="--pv-scale:${sc};--pv-gl:${g}" data-svpv>
          <div class="sv-pv-no" style="color:${p.no}">Jeg${glp('я')} vet${glp('знаю')} hvem${glp('кто')} jeg${glp('я')} er.${glp('есть')}</div>
          ${tm === 'hide' ? '<div class="sv-pv-off">перевод скрыт</div>' : `<div class="sv-pv-ru" style="color:${p.ru}">(Я знаю, кто я.)</div>`}</div>
        <div class="sv-pos-head"><span class="small muted">Положение субтитров:</span>
          <button type="button" class="btn sm sv-reset" data-svreset="pos" title="Вернуть субтитры вниз — как было сначала" ${p.pos === 'bottom' ? 'disabled' : ''}>↺ Сбросить</button></div>
        <div class="sv-pos" role="group" aria-label="Положение субтитров">${SV_POS.map(([k, t]) => `<button type="button" class="sv-pos-opt${p.pos === k ? ' on' : ''}" data-svp="pos" data-v="${k}" aria-pressed="${p.pos === k}" title="${t}${k === 'bottom' ? ' — как сначала' : ''}">${posIcon(k, p)}<span>${t}</span></button>`).join('')}</div>
        <p class="tiny muted sv-pos-note">Работает и в окне, и на весь экран. На узком экране (телефон вертикально) «Справа», «Слева» и половинки встают под видео — каждая строка у своего края, чтобы буквы оставались крупными.</p>
        <div class="cast-row"><span class="small muted cast-lab">Размер текста:</span>${seg('size', [['s', 'A−'], ['m', 'A'], ['l', 'A+'], ['xl', 'A++']])}</div>
        <div class="cast-row"><span class="small muted cast-lab">Перевод слов в скобках:</span>${seg('gl', [['same', 'как слова'], ['mid', 'чуть меньше'], ['small', 'мелко']])}</div>
        <div class="cast-row sv-kar"><span class="small muted cast-lab">🎤 Бегущая строка:</span><span class="seg-mini sm" role="group" aria-label="Бегущая строка">${[['off', 'Выкл'], ['hl', '✨ Подсветка'], ['wbw', '👣 Слово за словом']].map(([v, t]) => { const k = Kar.prefs(), on = v === 'off' ? !k.on : k.on && k.mode === v;
          return `<button type="button" data-svkar="${v}" class="${on ? 'active' : ''}" aria-pressed="${on}">${t}</button>`; }).join('')}</span></div>
        <p class="tiny muted sv-kar-note">Слово загорается, когда его произносят, — вместе с переводом: слушаете и читаете одновременно. Работает во всех положениях и на весь экран — и на телевизоре через мост на Mac.</p>
        ${svInk()}
        ${svSong()}
        ${window.Voices && Voices.openChooser ? `<div class="cast-row sv-voice"><span class="small muted cast-lab">🔊 Озвучка слов:</span>${Voices.langButtons(voicePlace())}</div>` : ''}
        <div class="cast-row"><span class="small muted cast-lab">Норвежский:</span>${TV_COLORS.map(([h, l]) => sw('no', h, l)).join('')}${pick('no')}</div>
        <div class="cast-row"><span class="small muted cast-lab">Перевод:</span>${TV_COLORS.map(([h, l]) => sw('ru', h, l)).join('')}${pick('ru')}</div>
        <label class="cast-bg" title="То же, что кнопка «🔲 Подложка» под видео"><input type="checkbox" data-svbg ${p.bg ? 'checked' : ''}> 🔲 Подложка — тёмная полоса под субтитрами на видео</label>
        <p class="tiny muted">Без подложки буквы с чёрной обводкой. Надписи, впечатанные в само видео, закрывает отдельная кнопка «▭ Закрыть надписи в видео» — там всегда матовое стекло.</p>
        <p class="tiny muted">Цвета и размер — те же и на телевизоре, положение — если телевизор это умеет. Цвета применяются к строке на видео (на тёмном фоне); под видео и в списке текст остаётся в цветах темы, чтобы всегда читался.</p>`;
    };
    const set = (key, val) => { const p = tvPrefs(); p[key] = val; tvSave(p); svApply(); draw();
      const cb = st && st.m && st.m.$('[data-castbar]'); if (cb && cb._draw) cb._draw(); // the TV bar shows the same choice
      if (key === 'pos') Cast.style(); }; // our TV page: the new place at once
    /** ↺ back to the start: only the place («Внизу»), or the whole look of this window */
    const reset = all => {
      const p = tvPrefs();
      if (all) { Object.assign(p, SV_DEF); p.bgv = 2; } else p.pos = 'bottom';
      tvSave(p); svApply(); draw();
      const cb = st && st.m && st.m.$('[data-castbar]'); if (cb && cb._draw) cb._draw();
      Cast.style();
      UI.toast(all ? '↺ Вид субтитров — как было сначала: внизу, обычный размер, белый и жёлтый' : '↺ Субтитры снова внизу, как было', '', 2600);
    };
    svHintDone('used'); // found it: the dot and the reminders stop for good
    /** 📝 «Надписи в кадре» — the same switch as in the bar on the video */
    function svInk() {
      const no = Ink.yt() ? 'недоступно для YouTube — его картинку браузер не даёт прочитать' : st && st.ink && st.ink.tainted ? 'в этом видео недоступно — браузер не даёт прочитать его картинку' : '';
      const on = Ink.on();
      return `<div class="cast-row sv-ink"><span class="small muted cast-lab">📝 Надписи в кадре:</span>${no ? `<span class="small muted">${no}</span>`
        : `<span class="seg-mini sm" role="group" aria-label="Надписи в кадре">${[['off', 'Выкл'], ['on', 'Переводить сами']].map(([v, t]) => { const a = (v === 'on') === on;
          return `<button type="button" data-svink="${v}" class="${a ? 'active' : ''}" aria-pressed="${a}" title="${v === 'on' ? 'Титры, название, вывески в кадре читаются и переводятся сами, когда нет субтитров' : 'Не читать надписи в кадре'}">${t}</button>`; }).join('')}</span>`}</div>
        <p class="tiny muted sv-ink-note">Титры, название фильма, вывески — всё, что впечатано в картинку, — приложение читает само, пока на экране нет субтитров, и показывает перевод с пометкой «📝 В кадре». Эти строки попадают и в список — из них тоже можно делать карточки.</p>`;
    }
    /** 🎵 «Песни без субтитров» — on / off (needs the speech recognizer, downloaded once) */
    function svSong() {
      const no = !Song.can(true) ? (st && st.stream && st.stream.kind === 'youtube' ? 'недоступно для YouTube — его звук браузер не даёт приложению' : 'недоступно для этого видео — приложение не может прочитать его звук') : '';
      const on = Song.on();
      return `<div class="cast-row sv-song"><span class="small muted cast-lab">🎵 Песни без субтитров:</span>${no ? `<span class="small muted">${no}</span>`
        : `<span class="seg-mini sm" role="group" aria-label="Песни без субтитров">${[['off', 'Выкл'], ['on', 'Распознавать']].map(([v, t]) => { const a = (v === 'on') === on;
          return `<button type="button" data-svsong="${v}" class="${a ? 'active' : ''}" aria-pressed="${a}">${t}</button>`; }).join('')}</span>`}</div>
        <p class="tiny muted sv-song-note">Когда субтитров нет, а звучит песня или речь, приложение само распознаёт слова по звуку (прямо на устройстве) и показывает их с переводом и пометкой «🎵». Если поют не по-норвежски и не по-английски — просто скажет, на каком языке песня.${Song.size ? ` Нужна модель распознавания речи — ${Song.size}, скачивается один раз.` : ''}</p>`;
    }
    m = UI.modal({ title: 'Aa Вид субтитров', cls: 'narrow sv-modal', body: '<div data-sv></div>', onClose: () => { if (st && Kar.prefs().on) Kar.coach(); },
      foot: '<button type="button" class="btn ghost sv-reset" data-svreset="all" title="Положение, размер, перевод слов, цвета и подложка — как было сначала">↺ Сбросить всё</button><span class="grow"></span><button class="btn primary" data-sv-ok>Готово</button>' });
    draw();
    m.$('[data-sv-ok]').onclick = () => m.close();
    m.el.addEventListener('click', e => {
      const r = e.target.closest('[data-svreset]'); if (r) { reset(r.dataset.svreset === 'all'); return; }
      const tb = e.target.closest('[data-svtr]');
      if (tb) { if (st && st.m) setTrMode(tb.dataset.svtr); draw(); const nb = m.$(`[data-svtr="${tb.dataset.svtr}"]`); if (nb) nb.focus({ preventScroll: true }); return; }
      const pv = e.target.closest('[data-svpv]'); if (pv && st && st.trMode === 'blur') { pv.classList.toggle('tr-peek'); return; }
      const sg = e.target.closest('[data-svsong]');
      if (sg) { Song.set(sg.dataset.svsong === 'on').then(() => { draw(); const nb = m.$(`[data-svsong="${sg.dataset.svsong}"]`); if (nb) nb.focus({ preventScroll: true }); }); return; }
      const ik = e.target.closest('[data-svink]');
      if (ik) { if ((ik.dataset.svink === 'on') !== Ink.on()) Ink.toggle(); draw(); const nb = m.$(`[data-svink="${ik.dataset.svink}"]`); if (nb) nb.focus({ preventScroll: true }); return; }
      const kb = e.target.closest('[data-svkar]');
      if (kb) { const v = kb.dataset.svkar; if (v === 'off') Kar.set(false, null, true); else Kar.set(true, v, true); draw(); const nb = m.$(`[data-svkar="${v}"]`); if (nb) nb.focus({ preventScroll: true }); return; }
      const b = e.target.closest('[data-svp]'); if (!b) return;
      const k = b.dataset.svp, v = b.dataset.v; set(k, v);
      const nb = m.$$('[data-svp]').find(x => x.dataset.svp === k && x.dataset.v === v); if (nb) nb.focus({ preventScroll: true }); // the keyboard stays where it was
    });
    m.el.addEventListener('change', e => {
      if (e.target.matches('[data-svbg]')) { bgSet(e.target.checked); draw(); }
      const k = e.target.dataset && e.target.dataset.svcolor; if (k && HEX.test(e.target.value)) set(k, e.target.value.toLowerCase());
    });
    m.el.addEventListener('input', e => { // the preview follows while choosing in the palette
      const k = e.target.dataset && e.target.dataset.svcolor; if (!k) return;
      m.$$(k === 'no' ? '.sv-pv-no' : '.sv-pv-gl, .sv-pv-ru').forEach(x => { x.style.color = e.target.value; });
    });
  }
  /** the nearest of the WebVTT colour classes — for TV players that ignore the STYLE block with the exact colour */
  function vttNamed(hex) {
    const C = { white: [255, 255, 255], yellow: [255, 255, 0], cyan: [0, 255, 255], lime: [0, 255, 0], red: [255, 0, 0], magenta: [255, 0, 255], blue: [0, 0, 255] };
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    let best = 'white', d = 1e9;
    Object.entries(C).forEach(([k, [R, G, B]]) => { const x = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2; if (x < d) { d = x; best = k; } });
    return best;
  }
  /** Cast TextTrackStyle: a normal font (not the typewriter one), the box under the text, the size; the Norwegian colour */
  const tvStyle = p => ({ foregroundColor: (HEX.test(p.no) ? p.no : '#ffffff').toUpperCase() + 'FF', backgroundColor: p.bg ? '#000000B8' : '#00000000', edgeType: p.bg ? 'NONE' : 'OUTLINE', edgeColor: '#000000FF',
    fontScale: { s: 0.78, m: 0.92, l: 1.1, xl: 1.28 }[p.size] || 0.92, fontGenericFamily: 'SANS_SERIF', fontFamily: 'Roboto' });
  /** short lines (the TV player does not wrap long ones — words were cut at the screen edges) */
  const tvWrap = (s, n) => { const out = []; let cur = ''; String(s || '').split(/\s+/).filter(Boolean).forEach(w => { if (cur && (cur + ' ' + w).length > n) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }); if (cur) out.push(cur); return out; };
  /** «Слово (перевод)»: every Norwegian word followed by its Russian in brackets (the same glosses as on the cards) */
  // exactly as on the screen: every word gets its gloss, an uncertain one with «?», a long note shortened («быть»)
  // (before, uncertain glosses were left out on the TV — the user saw gaps there and full glosses on the computer)
  function glossText(s, ru) {
    let k = -1;
    return String(s).split(/(\s+)/).map(w => {
      if (!/\p{L}/u.test(w)) return w;
      k++;
      const r = Study.glossInfo(s, k, ru || ''), g = Study.glossShow ? Study.glossShow(w, r.g) : r.g;
      return g ? `${w} (${g}${r.how === 'guess' ? '?' : ''})` : w;
    }).join('');
  }
  /** onWords(done, total, phase): the word step has started / moves on (the ⏳ panel of the TV window shows it) */
  async function tvPrepare(mode, onWords) {
    if (!st || !st.lines.length) return;
    try {
      if (mode !== 'asis' && !hasRuFile()) await translate(st.lines.map((l, i) => i), true);
      // meaning first, in the background: no «please wait» window over the TV window — its ⏳ panel shows the progress
      if (mode === 'word') {
        if (onWords) onWords(0, st.lines.length, 'start');
        await Study.translateUnits([], st.lines.filter(glOk).map(l => ({ s: cueText(l.text), ru: trOf(l) || '' })), { quiet: true, onProgress: onWords });
        if (st) st.lines.forEach(l => { l._gl = true; });
      }
    } catch (e) { /* lines without a translation go as they are */ }
  }
  /** WebVTT for the TV in the chosen mode and colours (🎤 with «Бегущая строка» on: a cue per word — karSteps;
   *  plain: as if it were off — what the «субтитры изменились» check compares) */
  function tvVtt(plain) {
    if (!st || !st.lines.length) return '';
    const p = tvPrefs();
    const ve = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const ts = t => { t = Math.round(Math.max(0, t) * 1000) / 1000; const h = Math.floor(t / 3600), mm = Math.floor(t % 3600 / 60), ss = (t % 60).toFixed(3).padStart(6, '0'); return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${ss}`; };
    // any colour: the exact one in a STYLE block (::cue), plus the nearest standard class for players that ignore it
    const noC = 'nkno.' + vttNamed(p.no), ruC = 'nkru.' + vttNamed(p.ru);
    const c = (cls, s) => `<c.${cls}>${ve(s)}</c>`;
    // ⊞ the place (WebVTT cue settings — the TV's player follows them where it can): «Внизу» exactly as before;
    // columns get short lines; the two halves are two cues side by side (line-snapped: a player that ignores the side
    // puts them one above the other, never on top of each other)
    const pos = p.pos, col = /^(left|right|split)/.test(pos), wN = col ? 22 : 38, wR = col ? 22 : 40, wG = col ? 24 : 44;
    const SET = { bottom: 'line:90%,end position:50% align:center size:92%', top: 'line:8%,start position:50% align:center size:92%',
      full: 'line:50%,center position:50% align:center size:92%', right: 'line:50%,center position:97%,line-right align:center size:36%',
      left: 'line:50%,center position:3%,line-left align:center size:36%' };
    const SIDE = { L: 'line:-2 position:3%,line-left align:center size:44%', R: 'line:-2 position:97%,line-right align:center size:44%' };
    // 🎤 the word being said: its own colour (pink as on the screen — or another one when the lines are pinkish), the
    // nearest standard class for players that ignore STYLE; the words still to come a little dimmer (STYLE only)
    const K = !plain && Kar.prefs().on ? { wbw: Kar.prefs().mode === 'wbw' } : null;
    let KC = null, KST = '';
    if (K) {
      const acc = ['#ff7eb6', '#5ee7ff', '#7dff7a', '#ff9f43'].find(h => vttNamed(h) !== vttNamed(p.no) && vttNamed(h) !== vttNamed(p.ru)) || '#ff7eb6';
      const dim = h => `rgba(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)}, 0.55)`;
      KC = { no: noC, ru: ruC, k: 'nkk.' + vttNamed(acc), fn: 'nkfn.' + vttNamed(p.no), fr: 'nkfr.' + vttNamed(p.ru) };
      KST = `::cue(.nkk) { color: ${acc}; }\n::cue(.nkfn) { color: ${dim(p.no)}; }\n::cue(.nkfr) { color: ${dim(p.ru)}; }\n`;
    }
    let n = 0;
    const cues = st.lines.map((l, i) => {
      const sk = skipTr(l), no = l.noWords ? '♪ ♪ ♪' : cueText(l.text), ru = String(trOf(l) || '').replace(/\n+/g, ' ').trim();
      let noTxt, ruTxt = '';
      if (p.mode === 'word' && glOk(l)) {
        noTxt = tvWrap(glossText(no, ru).replace(/ ?\((?:[^()]|\([^()]*\))*\)/g, g => g.replace(/ /g, '\u0001')), wG) // a word and its (перевод) stay on one line
          .map(x => `<c.${noC}>${ve(x.replace(/\u0001/g, ' ')).replace(/\(((?:[^()]|\([^()]*\))*)\)/g, `</c><c.${ruC}>($1)</c><c.${noC}>`)}</c>`.replace(/<c\.[\w.]+><\/c>/g, '')).join('\n');
        // and the whole line's translation under it — as on the computer's screen
        if (ru) ruTxt = tvWrap(`(${ru})`, wG).map(x => c(ruC, x)).join('\n');
      } else {
        noTxt = tvWrap(no, wN).map(x => c(noC, x)).join('\n');
        if (p.mode === 'sent' && ru) ruTxt = tvWrap(ru, wR).map(x => c(ruC, x)).join('\n');
      }
      const tt = `${ts(lineT(l, 'start'))} --> ${ts(lineT(l, 'end'))}`;
      const ks = K && !sk && !l.noWords ? karSteps(l, i, lineT(l, 'start'), lineT(l, 'end')) : null;
      if (ks) {
        const rows = karRows(karUnits(no, ru, p.mode === 'word' && glOk(l)), p.mode === 'word' ? wG : wN);
        const words = s => rows.map(r => karRowVtt(r, s, K.wbw, KC, ve)).join('\n');
        const at = s => `${ts(s.s)} --> ${ts(s.e)}`;
        if (pos === 'split-no' || pos === 'split-tr') { // the translation: one cue for the whole line on its side
          const sN = pos === 'split-no' ? SIDE.L : SIDE.R, sR = pos === 'split-no' ? SIDE.R : SIDE.L;
          return (ruTxt ? [`${++n}\n${tt} ${sR}\n${ruTxt}\n`] : []).concat(ks.map(s => `${++n}\n${at(s)} ${sN}\n${words(s)}\n`)).join('\n');
        }
        return ks.map(s => `${++n}\n${at(s)} ${SET[pos] || SET.bottom}\n${words(s)}${ruTxt ? '\n' + ruTxt : ''}\n`).join('\n');
      }
      if (pos === 'split-no' || pos === 'split-tr') {
        const a = pos === 'split-no' ? noTxt : ruTxt, b = pos === 'split-no' ? ruTxt : noTxt;
        return [a ? `${++n}\n${tt} ${SIDE.L}\n${a}\n` : '', b ? `${++n}\n${tt} ${SIDE.R}\n${b}\n` : ''].filter(Boolean).join('\n');
      }
      // «line:90%,end»: the BOTTOM of the block stays at 90% — a tall block (words + the line's translation) grows upwards,
      // never off the bottom edge of the TV
      return `${++n}\n${tt} ${SET[pos] || SET.bottom}\n${noTxt}${ruTxt ? '\n' + ruTxt : ''}\n`;
    });
    return `WEBVTT\n\nSTYLE\n::cue(.nkno) { color: ${p.no}; }\n::cue(.nkru) { color: ${p.ru}; }\n${KST}\n` + cues.join('\n');
  }
  /** the TV again with the new look / mode, from where it is now */
  async function tvRecast(el) {
    const ci = st && st.castInfo; if (!ci || ci.youtube) return;
    if (st.castLost) { castResume(); return; } // the TV had closed it: the new look goes with the restart
    el.classList.add('busy'); st.castBusy = true; // the short stop while the TV reloads is not «the TV closed it»
    try {
      let t = 0; try { t = (await castApi('control', { id: ci.id, action: 'status' })).time || 0; } catch (e) { const v = media(); t = v ? v.currentTime : 0; }
      await tvPrepare(tvPrefs().mode);
      ci.alive = false;
      await castApi('play', { id: ci.id, kind: 'hls', url: ci.url, title: ci.title, vtt: tvVtt(), style: tvStyle(tvPrefs()), start: t });
      if (st && st.rate !== 1) setTimeout(tvRate, 1500);
    } catch (err) { UI.toast('Телевизор не ответил — попробуйте ещё раз через пару секунд', 'warn', 5000); }
    el.classList.remove('busy');
    setTimeout(() => { if (st) st.castBusy = false; }, 3000);
  }

  /** 🐢 the speed: here, on every speed selector, kept for next time — and on the TV while it plays */
  function setRate(r) {
    if (!st || !RATES.some(([x]) => x === r)) return;
    st.rate = r;
    try { localStorage.setItem(RATE_KEY, String(r)); } catch (e) { /* full */ }
    const v = media(); if (v) { v.playbackRate = r; if ('defaultPlaybackRate' in v) v.defaultPlaybackRate = r; }
    st.m.$$('[data-rate-sel]').forEach(s => { s.value = String(r); const ic = s.parentElement.querySelector('span'); if (ic) ic.textContent = r < 1 ? '🐢' : r > 1 ? '🐇' : '⏱'; });
    if (st.stream && st.stream.kind === 'youtube' && r !== 1 && !st.ytRateNote) { st.ytRateNote = true; UI.toast('YouTube меняет скорость шагами (0,5× · 0,75× · 1× · 1,25× · 1,5×) — включена ближайшая', '', 4500); }
    else UI.toast(`Скорость: ${rateNum(r)} — ${rateLabel(r)}`, '', 1600);
    tvRate();
  }
  /** the same speed on the TV (Chromecast / Google TV play slower too; a TV that cannot — says so once) */
  async function tvRate() {
    const ci = st && st.castInfo; if (!ci || ci.youtube || st.castLost) return;
    const v = media();
    try { await castApi('control', { id: ci.id, action: 'rate', value: st.rate }); if (v && st.castInfo) v.playbackRate = st.rate; }
    catch (e) {
      // the screen here follows the TV: it keeps the TV's normal speed (else it would jump back every 2 seconds)
      if (v && st && st.castInfo) v.playbackRate = 1;
      if (st && !st.tvRateNote && st.rate !== 1) { st.tvRateNote = true; UI.toast('Этот телевизор не умеет замедлять видео — на нём идёт обычная скорость. Медленно можно смотреть здесь, на экране.', 'warn', 6000); }
    }
  }

  /* ---------- the same program on this screen too, without sound, in step with the TV ----------
   * Lines highlight here as on the TV; a tap on a word (pause), ▶ / ⏸ and moving the slider here act on the TV too. */
  function castSync(on) {
    const v = st && st.m && st.m.$('video[data-media]');
    if (st.castTimer) { clearInterval(st.castTimer); st.castTimer = 0; }
    if (!v) return;
    if (!on) { v.muted = false; v.playbackRate = st.rate; return; }
    v.muted = true; v.playbackRate = 1; // the TV starts at normal speed; tvRate() switches both once the TV accepts the chosen one
    const quiet = () => { st.castQuiet = Date.now(); };
    const mine = () => Date.now() - (st.castQuiet || 0) > 900;
    if (!v._castHooked) {
      v._castHooked = true;
      v.addEventListener('pause', () => { if (st && st.castInfo && st.castTimer && mine()) castApi('control', { id: st.castInfo.id, action: 'pause' }).catch(() => {}); });
      v.addEventListener('play', () => {
      if (!(st && st.castInfo && mine())) return;
      if (st.castLost) { castResume(); return; } // the TV closed it during a long pause: ▶ sends it again from there
      if (st.castTimer) castApi('control', { id: st.castInfo.id, action: 'play' }).catch(() => {});
    });
      v.addEventListener('seeked', () => { if (st && st.castInfo && st.castTimer && mine()) castApi('control', { id: st.castInfo.id, action: 'seek', value: v.currentTime }).catch(() => {}); });
    }
    quiet(); const p = v.play(); if (p && p.catch) p.catch(() => {});
    let fails = 0, n = 0;
    st.castTimer = setInterval(async () => {
      if (!st || !st.castInfo || st.castLost || st.castBusy) return;
      // every ~16 s: are the translations on the screen newer than on the TV (fixed word, late translation)? → offer to update
      if (++n % 8 === 0 && st.tvVttHash && !st.castInfo.youtube) tvStale();
      let s; try { s = await castApi('control', { id: st.castInfo.id, action: 'status' }); fails = 0; }
      catch (e) { if (++fails >= 4 && st && st.castInfo && st.castInfo.alive && !st.castBusy) castLost(); return; } // the TV is gone (turned off, network)
      if (!st || !st.castTimer || st.castLost || st.castBusy) return;
      const playing = s.state === 'PLAYING' || s.state === 'BUFFERING';
      if (playing || s.state === 'PAUSED') {
        // the TV plays this program: remember where it is (to continue from there if the TV ever closes it)
        st.castInfo.alive = true; st.castInfo.last = s.state;
        if (typeof s.time === 'number' && s.time > 0) st.castInfo.t = s.time;
        if (playing && v.paused) { quiet(); v.play().catch(() => {}); }
        if (s.state === 'PAUSED' && !v.paused) { quiet(); v.pause(); }
        if (typeof s.time === 'number' && s.time > 0 && Math.abs(v.currentTime - s.time) > 1.5) { quiet(); v.currentTime = s.time; }
      } else if (st.castInfo.alive) castLost(); // IDLE / nothing: the TV's own player closed it (e.g. after a long pause)
    }, 2000);
  }
  /** the TV closed the program by itself — nothing is lost: ▶ (here or on the remote) sends it again from the same place */
  function castLost() {
    if (!st || !st.castInfo || st.castLost) return;
    const ci = st.castInfo, v = st.m && st.m.$('video[data-media]');
    const dur = v && isFinite(v.duration) ? v.duration : st.dur || 0;
    ci.ended = !!(dur && ci.t && dur - ci.t < 10); // the program simply came to its end
    st.castLost = true;
    if (v) { st.castQuiet = Date.now(); if (!v.paused) v.pause(); if (ci.t && !ci.ended) v.currentTime = ci.t; }
    lostNote();
  }
  /** the calm note in the TV remote: what happened and one button to go on (no error talk) */
  function lostNote(html) {
    const bar = st && st.m && st.m.$('[data-castbar]'); if (!bar) return null;
    let n = bar.querySelector('[data-castlost]');
    if (!st.castLost) { if (n) n.remove(); return null; }
    if (!n) { n = document.createElement('div'); n.className = 'cast-lost'; n.dataset.castlost = ''; bar.prepend(n); }
    const ci = st.castInfo || {};
    n.innerHTML = html || (ci.ended
      ? `<span>📺 Передача на телевизоре закончилась.</span><button class="btn sm" data-tvc="play" data-from0>↺ Смотреть сначала на телевизоре</button>`
      : `<span>📺 ${ci.last === 'PAUSED' ? 'Телевизор сам закрыл передачу, пока она стояла на паузе, — так делает его плеер.' : 'Телевизор перестал показывать передачу (его выключили или пропала сеть).'} Место запомнено.</span>
        <button class="btn sm primary" data-tvc="play">▶ Продолжить на телевизоре с ${mss(ci.t || 0)}</button>`);
    return n;
  }
  async function castResume(from0) {
    const ci = st && st.castInfo; if (!ci || ci.youtube || st.castResuming) return;
    st.castResuming = true; st.castBusy = true;
    lostNote('<span><span class="spinner sm"></span> Снова подключаюсь к телевизору…</span>');
    const t = from0 || ci.ended ? 0 : ci.t || 0;
    try {
      const S = st.stream;
      if (S && S.fresh) { try { const u = await S.fresh(); if (u) { ci.url = u; S.hls = u; } } catch (e) { /* the old address */ } } // it may have expired meanwhile
      await tvPrepare(tvPrefs().mode);
      ci.alive = false; ci.ended = false; ci.t = t;
      await castApi('play', { id: ci.id, kind: 'hls', url: ci.url, title: ci.title, vtt: tvVtt(), style: tvStyle(tvPrefs()), start: t });
      st.castLost = false; lostNote();
      if (st.rate !== 1) setTimeout(tvRate, 1500);
      const v = st.m.$('video[data-media]'); if (v) { st.castQuiet = Date.now(); v.currentTime = t; v.play().catch(() => {}); }
      UI.toast(`📺 Снова на телевизоре «${ci.name}» — с ${mss(t)}`, 'good', 3000);
    } catch (err) {
      lostNote(`<span>📺 Телевизор пока не отвечает. Проверьте, что он включён и в той же Wi-Fi сети, — и нажмите ещё раз.</span><button class="btn sm primary" data-tvc="play">▶ Продолжить с ${mss(t)}</button>`);
    } finally { st.castResuming = false; setTimeout(() => { if (st) st.castBusy = false; }, 3000); }
  }
  /** closing the player while the TV plays: keep it on the TV, stop it, or go back — never by accident */
  async function castCloseAsk() {
    const r = await UI.askClose({
      title: `${UI.TV_SVG(22)} Закрыть трансляцию?`,
      text: `${(st.castInfo || {}).name ? `На телевизоре «${U.esc(st.castInfo.name)}»` : 'На телевизоре'} идёт передача.`,
      line: '«Оставить на ТВ» — передача продолжит идти на телевизоре, а это окно закроется (управлять можно пультом телевизора).',
      actions: [{ label: 'Оставить на ТВ и закрыть окно', value: 'keep', cls: 'primary', attr: 'data-r="keep"' },
        { label: '⏹ Остановить и закрыть', value: 'stop', cls: 'bad', attr: 'data-r="stop"' }],
      cancel: 'Вернуться', cancelAttr: 'data-r="stay"',
    });
    return r || 'stay';
  }

  /** the remote under the video while the TV plays (through the bridge) */
  function castBar(devId, name, youtube) {
    if (!st || !st.m) return;
    const box = st.m.$('.subs-view'); if (!box) return;
    let el = st.m.$('[data-castbar]');
    if (!el) { el = document.createElement('div'); el.className = 'cast-bar'; el.dataset.castbar = ''; box.after(el); }
    const draw = () => {
      const p = tvPrefs();
      const sw = (key, hex, label) => `<button class="tv-sw ${p[key].toLowerCase() === hex ? 'on' : ''}" data-tvp="${key}" data-v="${hex}" style="--sw:${hex}" title="${label}" aria-label="${label}"></button>`;
      // the full palette: any colour (the system colour picker — Mac, Windows, iPhone, Android)
      const pick = key => { const custom = !TV_COLORS.some(([h]) => h === p[key].toLowerCase());
        return `<label class="tv-pick ${custom ? 'on' : ''}" title="Любой цвет — полная палитра" style="--sw:${p[key]}"><input type="color" data-tvcolor="${key}" value="${p[key]}" aria-label="Любой цвет"><span>🎨 Любой цвет</span></label>`; };
      el.innerHTML = `<div class="cast-row"><span class="cast-live">${UI.TV_SVG(18)} На телевизоре «${U.esc(name)}»</span>
          <span class="aiw-live cast-aiw" data-aiw-live="tr" data-aiw-label data-aiw-size="20" role="status" hidden></span>
          <button class="btn sm" data-tvc="pause">⏸ Пауза</button><button class="btn sm" data-tvc="play">▶ Продолжить</button>
          <button class="btn sm bad" data-tvc="stop">⏹ Стоп</button></div>
        ${youtube ? '<div class="small muted">Видео YouTube идёт в приложении YouTube на телевизоре — наши субтитры там не показываются.</div>' : `
        <div class="cast-row"><span class="small muted">Субтитры:</span>
          <span class="seg-mini sm">${[['asis', 'Как есть'], ['sent', 'По предложениям'], ['word', 'Слово (перевод)'], ['off', 'выкл']].map(([k, t]) => `<button data-tvp="mode" data-v="${k}" class="${(p.mode === k) ? 'active' : ''}">${t}</button>`).join('')}</span></div>
        <div class="cast-row"><span class="small muted cast-lab">Норвежский:</span>${TV_COLORS.map(([h, l]) => sw('no', h, l)).join('')}${pick('no')}</div>
        <div class="cast-row"><span class="small muted cast-lab">Перевод:</span>${TV_COLORS.map(([h, l]) => sw('ru', h, l)).join('')}${pick('ru')}</div>
        <div class="cast-row"><span class="small muted cast-lab">Так будет:</span><span class="tv-preview ${p.bg ? 'bg' : ''}"><span style="color:${p.no}">Hei, hvordan går det?</span><span style="color:${p.ru}">Привет, как дела?</span></span></div>
        <div class="cast-row"><span class="small muted">Размер:</span><span class="seg-mini sm">${[['s', 'A−'], ['m', 'A'], ['l', 'A+'], ['xl', 'A++']].map(([k, t]) => `<button data-tvp="size" data-v="${k}" class="${p.size === k ? 'active' : ''}">${t}</button>`).join('')}</span>
          <label class="cast-bg"><input type="checkbox" data-tvbg ${p.bg ? 'checked' : ''}> 🔲 подложка под текстом</label>
          <span class="tiny muted">изменения применяются на телевизоре за 2–3 секунды</span></div>`}`;
      if (st.castLost) lostNote();
    };
    draw(); el._draw = draw; // the Aa window redraws it after a change there
    if (window.AIHub && AIHub.paintWork) AIHub.paintWork();
    el.onclick = async e => {
      const b = e.target.closest('[data-tvc]');
      if (b) {
        // ▶ after the TV closed the program by itself: send it again from the same place
        if (b.dataset.tvc === 'play' && st.castLost) { castResume('from0' in b.dataset); return; }
        // the newer translations from the screen → the TV (it reloads from the same moment, 2–3 seconds)
        if (b.dataset.tvc === 'refresh') { const nt = el.querySelector('[data-tvstale]'); if (nt) nt.remove(); await tvRecast(el); return; }
        if (b.dataset.tvc === 'stop' && !(await UI.confirm('Остановить трансляцию на телевизоре?<br><span class="small muted">Передачу можно будет снова отправить кнопкой «На телевизор».</span>', { ok: '⏹ Остановить', cancel: 'Нет, смотреть дальше', danger: true }))) return;
        try {
          if (!(b.dataset.tvc === 'stop' && st.castLost)) await castApi('control', { id: devId, action: b.dataset.tvc });
          if (b.dataset.tvc === 'stop') { castSync(false); st.castInfo = null; st.castLost = false; el.remove(); }
          else { const v = st.m.$('video[data-media]'); if (v && st.castTimer) { st.castQuiet = Date.now(); if (b.dataset.tvc === 'pause') v.pause(); else v.play().catch(() => {}); } }
        } catch (err) { UI.toast('Телевизор: ' + err.message, 'warn', 5000); }
        return;
      }
      const o = e.target.closest('[data-tvp]'); if (!o) return;
      const p = tvPrefs(), key = o.dataset.tvp, val = o.dataset.v;
      // «выкл» only hides them on the TV now (not kept: the next cast shows subtitles again)
      if (key === 'mode' && val === 'off') { try { await castApi('control', { id: devId, action: 'subs', value: 0 }); el.querySelectorAll('[data-tvp="mode"]').forEach(x => x.classList.toggle('active', x === o)); } catch (err) { UI.toast(err.message, 'warn'); } return; }
      p[key] = val; tvSave(p); draw(); svApply(); // one setting: the screen follows the TV choice
      await tvRecast(el);
    };
    // the palette: the preview follows while choosing, the TV gets the colour when the palette closes
    el.oninput = e => {
      const k = e.target.dataset && e.target.dataset.tvcolor; if (!k) return;
      const pv = el.querySelector(`.tv-preview span:nth-child(${k === 'no' ? 1 : 2})`); if (pv) pv.style.color = e.target.value;
      const lab = e.target.closest('.tv-pick'); if (lab) lab.style.setProperty('--sw', e.target.value);
    };
    el.onchange = async e => {
      const k = e.target.dataset && e.target.dataset.tvcolor;
      if (k) { const p = tvPrefs(); p[k] = e.target.value; tvSave(p); draw(); svApply(); await tvRecast(el); return; }
      if (!e.target.matches('[data-tvbg]')) return; bgSet(e.target.checked); await tvRecast(el);
    };
  }
  /** other ways: screen mirroring, AirPlay (and the Chrome cast SDK) */
  function tvOther() {
    const S = st.stream || {};
    const d = tvDevice(), { iOS } = d;
    const ua = navigator.userAgent, chrome = d.chrome;
    const v = st.m.$('video[data-media]');
    const airplay = v && typeof v.webkitShowPlaybackTargetPicker === 'function' && !(st.hls); // native video only (not hls.js / YouTube)
    const steps = mirrorSteps(d);
    const src = tvSource(S);
    const castable = !!src && d.cast;
    // the main way: like the cast button in YouTube — Chrome shows the list of TVs (Chromecast / Android TV / Google TV)
    const castBlock = src
      ? (castable
        ? `<button class="btn primary lg tv-cast" data-tv-cast>📡 Выбрать телевизор <small>Chromecast · Android TV · Google TV</small></button>
           <div class="small muted tv-cast-note">${src.audio ? 'Звук пойдёт прямо на телевизор или колонку' : 'Передача пойдёт прямо на приставку (её же плеером)'}${S.nrkVtt && !src.audio ? ' с норвежскими субтитрами NRK' : ''}; строка с переводом остаётся здесь, на экране. Здесь же — пульт: пауза, стоп.</div>${src.audio ? '' : tvKarNote()}`
        : `<div class="tv-step tv-main"><b>📡 Android-приставка, Chromecast, Google TV — со списком телевизоров, как в YouTube</b>
             <div class="small">${iOS ? 'На iPhone и iPad браузеры не умеют отправлять видео на Chromecast — это запрет Apple. Откройте приложение на компьютере или Android в <b>Google Chrome</b> — или смотрите передачу в приложении NRK TV (↗): у него есть кнопка трансляции, но без наших субтитров и перевода.'
               : `Эта кнопка работает в браузере <b>Google Chrome</b> (на Mac, Windows, Android) — в ${/Safari/.test(ua) && !chrome ? 'Safari' : 'этом браузере'} её нет. Откройте это же приложение в Chrome: адрес <b>${U.esc(appAddr())}</b> — там здесь появится «📡 Выбрать телевизор».`}</div>
             ${iOS ? '' : '<button class="btn sm" data-tv-copy>📋 Скопировать адрес для Chrome</button>'}</div>`)
      : S.kind === 'youtube'
        ? `<div class="tv-step tv-main"><b>▶ Видео YouTube на телевизор</b><div class="small">Нажмите значок трансляции <b>в самом плеере YouTube</b> (правый верхний угол видео) и выберите телевизор — видео откроется в приложении YouTube на телевизоре, <b>без наших субтитров</b>. С субтитрами и переводом — повтором экрана (ниже).</div>${S.link ? `<a class="btn sm" href="${U.esc(S.link)}" target="_blank" rel="noopener">▶ Открыть в YouTube</a>` : ''}</div>`
        : '';
    const m = UI.modal({
      title: '📺 Смотреть на телевизоре', cls: 'tv-modal',
      body: `${castBlock}
        <details class="tv-more" ${castBlock ? '' : 'open'}><summary>🪞 Повтор экрана — телевизор показывает ровно то, что здесь (субтитры и перевод поверх видео)</summary>
          ${steps.map(([h, t]) => `<div class="tv-step"><b>${h}</b><div class="small">${t}</div></div>`).join('')}
        </details>
        ${airplay ? `<details class="tv-more"><summary>Только видео через AirPlay (без наших субтитров)</summary>
          <div class="small">AirPlay передаёт телевизору одно видео — субтитры и перевод останутся на этом экране.</div><button class="btn sm" data-tv-airplay>AirPlay — только видео</button></details>` : ''}`,
      foot: `<button class="btn ghost" data-close-tv>Закрыть</button><button class="btn" data-tv-full>⛶ На весь экран (для повтора экрана)</button>`,
    });
    m.el.addEventListener('click', async e => {
      if (e.target.closest('[data-close-tv]')) m.close();
      if (e.target.closest('[data-tv-full]')) { m.close(); setTimeout(() => Full.enter(), 220); }
      if (e.target.closest('[data-tv-airplay]') && v) { try { v.webkitShowPlaybackTargetPicker(); } catch (err) { UI.toast(err.message, 'warn'); } }
      if (e.target.closest('[data-tv-copy]')) {
        // the app's own address, sub-path included (GitHub Pages serves it under /norsk-kort-site/)
        const addr = appAddr();
        try { await navigator.clipboard.writeText(addr); UI.toast('Адрес скопирован — вставьте его в Google Chrome', 'good'); } catch (err) { UI.toast('Адрес: ' + addr, '', 6000); }
      }
      const c = e.target.closest('[data-tv-cast]');
      if (c) {
        c.disabled = true; const label = c.innerHTML; c.innerHTML = '<span class="spinner sm"></span> ищу телевизоры…';
        try { const ok = await Cast.start(); if (ok) m.close(); }
        catch (err) { UI.toast(`📺 ${err.message || 'Телевизор сейчас не ответил'} — проверьте, что он включён и в той же Wi-Fi сети, или повторите экран`, 'warn', 7000); }
        if (c.isConnected) { c.disabled = false; c.innerHTML = label; }
      }
    });
  }

  /* ---------- 📡 Google Cast (Chrome / Edge on Android, Windows, Mac, Linux): the TV list like in YouTube ----------
   * Works WITHOUT the Mac bridge: the TV fetches the stream itself from the internet, so only public addresses can go —
   * NRK programs (HLS), NRK podcasts (MP3), direct https video / audio files. Files on this device (blob:, Cache
   * Storage) and the bridge's streams cannot: the TV has no way to reach them.
   * Default Media Receiver (no registration, no cost). Subtitles: NRK's own WebVTT file as a text track (NRK serves it
   * with CORS). Our dual lines (Norwegian + Russian) are NOT sent as a data: track: Google documents only URLs for
   * trackContentId, and every Cast message is limited to 64 KB — a long programme's subtitles inline would break the
   * LOAD. They stay on the phone screen, which follows the TV's time (the phone's own player runs muted in step).
   * With a registered custom receiver (CAST_APP_ID + receiver.html) the lines go as messages and the TV draws both.
   * 🎤 «Бегущая строка»: Google's player gets NRK's file only — no karaoke there (the TV window says so kindly); our TV
   * page gets the word times with the lines and lights the words up by the TV's own clock. */
  // the Cast App ID of OUR TV page (receiver.html on the site's https domain, registered once in the Google Cast SDK
  // Developer Console — a one-time developer fee). Empty = Google's standard receiver.
  const CAST_APP_ID = String((window.NK_CONFIG && NK_CONFIG.castAppId) || '').trim(); // js/config.js (one place)
  const CAST_NS = 'urn:x-cast:no.norskkort.subs';
  const Cast = {
    ready: null,
    appId() { return (Store.settings.castAppId || CAST_APP_ID || '').trim(); },
    /** our TV page: the lines go as messages (≤ 64 KB each) — [start, end, norwegian, russian, 🎤 word times, glosses]:
     *  word times = the start of every word (player time, the line «Сдвиг» included) + the end of the last one, or 0;
     *  glosses = «(перевод)» of every word when «Слово (перевод)» is on. «Сдвиг слов» and the look go as kar: {…}. */
    async sendCues(ses) {
      const P = tvPrefs(), gl = P.mode === 'word' || st.trMode === 'word', L = st.lines;
      const cues = L.map((l, i) => {
        const no = cueText(l.text), ru = String(trOf(l) || '').replace(/\n+/g, ' '), c = [+lineT(l, 'start').toFixed(2), +lineT(l, 'end').toFixed(2), no, ru];
        if (l.noWords || skipTr(l)) return c;
        let r = null; try { r = kwOf(l, L[i - 1], L[i + 1]); } catch (e) { /* no word times */ }
        c.push(r && r.t.length === nWords(no) ? r.t.map(x => +(x + st.offset).toFixed(2)).concat(+(r.e + st.offset).toFixed(2)) : 0);
        if (gl && glOk(l)) c.push(karUnits(no, ru.trim(), true).filter(u => /\p{L}/u.test(u.w)).map(u => u.g));
        return c;
      });
      // ≤ 150 lines and ≤ ~48 KB a message (a Cast message may be 64 KB at most)
      const enc = new TextEncoder(), size = c => enc.encode(JSON.stringify(c)).length + 1;
      const parts = []; let cur = [], bytes = 0;
      cues.forEach(c => { const b = size(c); if (cur.length && (cur.length >= 150 || bytes + b > 48000)) { parts.push(cur); cur = []; bytes = 0; } cur.push(c); bytes += b; });
      parts.push(cur);
      for (let k = 0; k < parts.length; k++) await ses.sendMessage(CAST_NS, Object.assign({ reset: k === 0, cues: parts[k] }, this.look()));
      this.trSend(ses, true);
    },
    /** 🌀 who translates the lines — its coin (the same artwork as in the app) + its name, and whether it works right now.
     *  OUR TV page shows it in a corner for a moment (older TV pages ignore it). null = nobody translated yet. */
    trInfo() {
      const W = window.AIHub && AIHub.work && AIHub.tvCoin ? AIHub.work : null;
      if (!W) return null;
      const j = W.cur('tr'), p = j ? j.p : W.last ? W.last('tr') : null;
      if (!p) return null;
      try { return Object.assign(AIHub.tvCoin(p), { on: !!j }); } catch (e) { return null; }
    },
    trSend(ses, force) {
      ses = ses || this.ses;
      if (!ses || !this.appId()) return;
      if (!this._trHooked && window.AIHub && AIHub.work && AIHub.work.on) { this._trHooked = true; AIHub.work.on(() => this.trSend()); }
      const tr = this.trInfo(), key = tr ? tr.k + (tr.on ? ':on' : ':off') : '';
      if (!force && key === this._trKey) return;
      this._trKey = key;
      try { const p = ses.sendMessage(CAST_NS, { tr }); if (p && p.catch) p.catch(() => {}); } catch (e) { /* the TV is gone */ }
    },
    /** the look of OUR TV page: 🔲 the strip, ⊞ the place, 🎤 «Бегущая строка» (on, how, «Сдвиг слов»), the size of the «(перевод)» */
    look() {
      const p = tvPrefs(), k = Kar.prefs();
      return { bg: !!p.bg, pos: p.pos, kar: { on: !!k.on, mode: k.mode, sh: +(st && st.ksh || 0) }, gs: (SV_GL[p.gl] || SV_GL.small)[0] };
    },
    /** 🔲 the strip under the lines / ⊞ their place / 🎤 on OUR TV page changed (Google's own player gets the look with the next start) */
    style() {
      if (!this.ses || !this.appId()) return;
      try { const p = this.ses.sendMessage(CAST_NS, this.look()); if (p && p.catch) p.catch(() => {}); } catch (e) { /* the TV is gone */ }
    },
    /** 🎤 switched on / to the other look: our TV page gets the lines again (the freshest word times) */
    kar() {
      if (!this.ses || !this.appId() || !st || !st.lines.length) return;
      this.sendCues(this.ses).catch(() => {});
    },
    supported() {
      const ua = navigator.userAgent;
      // Chrome / Edge (not on iPhone — Apple allows no Cast there; not in in-app WebViews or Samsung Internet)
      return /Chrome|CriOS|Edg/.test(ua) && !/iPhone|iPad|iPod|OPR|SamsungBrowser|; wv\)/.test(ua) && !!window.isSecureContext;
    },
    load() {
      if (window.cast && cast.framework) return Promise.resolve();
      if (this.ready) return this.ready;
      this.ready = new Promise((res, rej) => {
        window.__onGCastApiAvailable = ok => {
          if (ok && window.cast && cast.framework) {
            // our own TV page (receiver.html, draws the Norwegian + Russian lines) once it is registered; else Google's player
            const ctx = cast.framework.CastContext.getInstance();
            ctx.setOptions({ receiverApplicationId: this.appId() || chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID, autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED });
            // the TV was turned off / another phone took it: the remote here goes away, the sound here comes back
            try { ctx.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, e => { if (e && e.sessionState === cast.framework.SessionState.SESSION_ENDED) this.ended(); }); } catch (e) { /* older SDK */ }
            res();
          } else rej(new Error('Этот браузер сейчас не может искать телевизоры'));
        };
        const s = document.createElement('script');
        s.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
        s.onerror = () => { this.ready = null; rej(new Error('Не получилось подключиться к службе трансляции — проверьте интернет')); };
        document.head.appendChild(s);
        setTimeout(() => rej(new Error('Служба трансляции не ответила — попробуйте ещё раз')), 15000);
      });
      this.ready.catch(() => { this.ready = null; });
      return this.ready;
    },
    /** our lines as WebVTT: the Norwegian line + the Russian translation under it */
    /** WebVTT text: every line = the Norwegian line + the Russian translation under it */
    vttText() {
      // whole milliseconds first: 119.99999999999999 (recognized lines) gave «00:01:60.000» — a broken cue
      const ts = t => { t = Math.round(Math.max(0, t) * 1000) / 1000; const h = Math.floor(t / 3600), mm = Math.floor(t % 3600 / 60), ss = (t % 60).toFixed(3).padStart(6, '0'); return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${ss}`; };
      // 🎤 «Бегущая строка»: a cue per word, the word being said in b / u (off: as always)
      const ve = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const K = Kar.prefs(); let n = 0;
      const body = st.lines.map((l, i) => {
        const ru = trOf(l), a = lineT(l, 'start'), b = lineT(l, 'end'), ks = K.on ? karSteps(l, i, a, b) : null;
        if (ks) return ks.map(s => `${++n}\n${ts(s.s)} --> ${ts(s.e)}\n${karPlain(cueText(l.text), '', false, s, K.mode === 'wbw', ve)}${ru ? '\n' + ve(cueText(String(ru))) : ''}\n`).join('\n');
        return `${K.on ? ++n : i + 1}\n${ts(a)} --> ${ts(b)}\n${cueText(l.text)}${ru ? '\n' + cueText(String(ru)) : ''}\n`;
      }).join('\n');
      return 'WEBVTT\n\n' + body;
    },
    dualVtt() { return 'data:text/vtt;base64,' + btoa(unescape(encodeURIComponent(this.vttText()))); },
    /** → true when the TV plays */
    async start(at) {
      const S = st && st.stream, src = tvSource(S); if (!src) return false;
      await this.load();
      const ctx = cast.framework.CastContext.getInstance();
      // still connected (e.g. the TV only closed the paused program): no device picker again — straight on
      if (!(at != null && ctx.getCurrentSession())) {
        try { await ctx.requestSession(); }
        catch (e) {
          if (e === 'cancel' || e === chrome.cast.ErrorCode.CANCEL) return false;
          throw new Error(e === 'receiver_unavailable' || e === chrome.cast.ErrorCode.RECEIVER_UNAVAILABLE ? 'Телевизор не найден' : 'Не получилось подключиться к телевизору');
        }
      }
      const ses = ctx.getCurrentSession(); if (!ses || !st) return false;
      if (at != null && S.fresh && src.hls) { try { const u = await S.fresh(); if (u) { S.hls = u; src.url = u; } } catch (e) { /* the old address */ } }
      const custom = !!this.appId();
      // our TV page draws the Russian line too: translate all lines first
      if (custom && !hasRuFile() && st.lines.length) { try { await translate(st.lines.map((l, i) => i), true); } catch (e) { /* lines without translation go as they are */ } }
      const C = chrome.cast.media;
      const mi = new C.MediaInfo(src.url, src.type);
      mi.streamType = C.StreamType.BUFFERED;
      if (src.hls && !src.audio && C.HlsSegmentFormat) mi.hlsSegmentFormat = C.HlsSegmentFormat.TS;
      const md = new C.GenericMediaMetadata(); md.title = S.title || ''; md.subtitle = S.channel || (S.kind === 'nrk' ? 'NRK' : '');
      if (/^https:\/\//.test(S.poster || '') && chrome.cast.Image) md.images = [new chrome.cast.Image(S.poster)];
      mi.metadata = md;
      if (custom) { try { await this.sendCues(ses); } catch (e) { /* the TV page draws nothing — the video still plays */ } }
      const tracks = [];
      // Google's player: NRK's own subtitle file (a URL with CORS). Our dual lines stay on this screen (see above).
      if (!custom && !src.audio && S.nrkVtt) { const t = new C.Track(2, C.TrackType.TEXT); t.trackContentId = S.nrkVtt; t.trackContentType = 'text/vtt'; t.subtype = C.TextTrackType.SUBTITLES; t.name = 'Norsk (NRK)'; t.language = 'nb'; tracks.push(t); }
      mi.tracks = tracks;
      if (tracks.length) {
        const style = new C.TextTrackStyle();
        style.backgroundColor = '#00000099'; style.foregroundColor = '#FFFFFFFF'; style.fontScale = 1.15;
        style.edgeType = C.TextTrackEdgeType.DROP_SHADOW; style.edgeColor = '#000000FF';
        mi.textTrackStyle = style;
      }
      const req = new C.LoadRequest(mi);
      const v = this.el();
      req.currentTime = at != null ? at : v ? v.currentTime || 0 : 0; req.autoplay = true;
      this.t = req.currentTime;
      req.activeTrackIds = tracks.length ? [tracks[0].trackId] : [];
      try { await ses.loadMedia(req); }
      catch (e) { throw new Error('Телевизор не смог открыть эту передачу'); }
      this.ses = ses;
      // this screen keeps the lines going with the TV: the player here plays on without sound, in step with the TV
      if (v) { if (this.muted == null) this.muted = v.muted; this.quiet = Date.now(); v.muted = true; this.hook(v); }
      this.bar(ses, tracks);
      return true;
    },
    /** the player on this screen (video or audio element) */
    el() { return st && st.m ? st.m.$('video[data-media]') || st.m.$('audio[data-media]') : null; },
    /** ⏯ / seeking the player here moves the TV too (but not our own moves that follow the TV) */
    hook(v) {
      if (v._cfHooked) return; v._cfHooked = true;
      const act = (a, t) => {
        if (!this.ses || Date.now() - (this.quiet || 0) < 1500) return;
        const ms = this.ses.getMediaSession && this.ses.getMediaSession(); if (!ms) return;
        try {
          if (a === 'pause') ms.pause(null, () => {}, () => {});
          else if (a === 'play') ms.play(null, () => {}, () => {});
          else { const r = new chrome.cast.media.SeekRequest(); r.currentTime = t; ms.seek(r, () => {}, () => {}); this.t = t; }
        } catch (e) { /* the TV is gone */ }
      };
      v.addEventListener('pause', () => act('pause'));
      v.addEventListener('play', () => act('play'));
      v.addEventListener('seeked', () => act('seek', v.currentTime));
    },
    /** the cast is over (stopped here, or the TV ended it): the remote goes, the sound here comes back */
    ended() {
      clearInterval(this.timer); this.timer = 0; this.ses = null;
      const v = this.el();
      if (v && this.muted != null) { this.quiet = Date.now(); v.muted = this.muted; }
      this.muted = null;
      const el = st && st.m && st.m.$('[data-castbar]'); if (el && el.dataset.gcast) el.remove();
    },
    /** the remote under the video while the TV plays */
    bar(ses, tracks) {
      if (!st || !st.m) return;
      const name = (ses.getCastDevice() || {}).friendlyName || 'телевизор';
      const box = st.m.$('.subs-view') || st.m.$('[data-media]'); if (!box) return;
      let el = st.m.$('[data-castbar]');
      if (!el) { el = document.createElement('div'); el.className = 'cast-bar'; el.dataset.castbar = ''; box.after(el); }
      el.dataset.gcast = '1';
      el.innerHTML = `<div class="cast-row"><span class="cast-live">📡 На телевизоре «${U.esc(name)}»</span>
        <button class="btn sm" data-cast="pp">⏯ Пауза / продолжить</button>
        <button class="btn sm bad" data-cast="stop">⏹ Остановить</button></div>
        ${tracks.length ? `<div class="cast-row"><span class="small muted">Субтитры на телевизоре:</span><span class="seg-mini sm">${tracks.map(t => `<button data-cast-tr="${t.trackId}" class="${t.trackId === tracks[0].trackId ? 'active' : ''}">${U.esc(t.name)}</button>`).join('')}<button data-cast-tr="0">без субтитров</button></span></div>` : ''}
        <div class="small muted">💬 Строки с переводом — здесь, на экране: они идут вместе с телевизором.</div>`;
      // remember where the TV is (if its player closes a long-paused program, ⏯ starts it again from there),
      // and keep the lines here in step with the TV
      if (this.timer) clearInterval(this.timer);
      this.timer = setInterval(() => {
        if (!st || !el.isConnected) { clearInterval(this.timer); this.timer = 0; return; }
        const ms = ses.getMediaSession && ses.getMediaSession(), P = chrome.cast.media.PlayerState;
        if (!ms || ms.playerState === P.IDLE) return;
        const t = ms.getEstimatedTime ? ms.getEstimatedTime() : ms.currentTime; if (t > 0) this.t = t;
        const v = this.el(); if (!v) return;
        const mark = () => { this.quiet = Date.now(); };
        if (ms.playerState === P.PLAYING && v.paused) { mark(); const p = v.play(); if (p && p.catch) p.catch(() => {}); }
        else if (ms.playerState === P.PAUSED && !v.paused) { mark(); v.pause(); }
        if (t > 0 && Math.abs((v.currentTime || 0) - t) > 2.5) { mark(); try { v.currentTime = t; } catch (e) { /* not ready */ } }
      }, 2000);
      el.onclick = async e => {
        const b = e.target.closest('[data-cast], [data-cast-tr]'); if (!b) return;
        const ms = ses.getMediaSession && ses.getMediaSession();
        if (b.dataset.cast === 'pp') {
          if (!ms || ms.playerState === chrome.cast.media.PlayerState.IDLE) { // the TV had closed it: again from the same place
            try { await this.start(this.t || 0); UI.toast(`📺 Снова на телевизоре — с ${mss(this.t || 0)}`, 'good', 3000); } catch (err) { UI.toast('Телевизор пока не отвечает — нажмите ещё раз', 'warn', 5000); }
          } else if (ms.playerState === chrome.cast.media.PlayerState.PLAYING) ms.pause(null, () => {}, () => {}); else ms.play(null, () => {}, () => {});
        }
        if (b.dataset.cast === 'stop' && await UI.confirm('Остановить трансляцию на телевизоре?', { ok: '⏹ Остановить', cancel: 'Нет, смотреть дальше', danger: true })) {
          const t = this.t || 0;
          try { cast.framework.CastContext.getInstance().endCurrentSession(true); } catch (err) { /* already gone */ }
          this.ended();
          const v = this.el(); if (v && t) { try { v.currentTime = t; } catch (err) { /* ignore */ } }
        }
        if (b.dataset.castTr != null && ms) {
          const id = +b.dataset.castTr;
          ms.editTracksInfo(new chrome.cast.media.EditTracksInfoRequest(id ? [id] : []), () => {
            el.querySelectorAll('[data-cast-tr]').forEach(x => x.classList.toggle('active', x === b));
          }, () => UI.toast('Телевизор не переключил субтитры', 'warn'));
        }
      };
    },
  };
  function makeAnyInput() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.multiple = true; inp.hidden = true; inp.dataset.in = 'any';
    st.m.el.appendChild(inp);
    return inp;
  }
  function onChange(e) {
    const t = e.target;
    if (t.matches('[data-rate-sel]')) { setRate(+t.value); return; }
    if (t.matches('input[type=file][data-in]')) { if (t.files && t.files.length) addFiles(t.files, t.dataset.in === 'any' ? null : t.dataset.in); return; }
    if (t.matches('[data-chk]')) { const i = +t.dataset.chk; t.checked ? st.checked.add(i) : st.checked.delete(i); countSel(); }
  }
  function onInput(e) {
    if (!e.target.matches('[data-q]')) return;
    const q = U.norm(e.target.value);
    st.m.$$('.subs-line').forEach(row => {
      const l = st.lines[+row.dataset.i];
      row.classList.toggle('hid', !!q && !U.norm(l.text + ' ' + (trOf(l) || '') + ' ' + (l.en || '')).includes(q));
    });
  }
  const topmost = () => { const root = document.getElementById('modal-root'); return st && st.m && root && root.lastElementChild === st.m.el.parentElement; };
  function onKey(e) {
    if (!topmost()) return;
    if (e.key === 'Escape' && wp) { e.stopPropagation(); e.preventDefault(); hidePop(); return; }
    if (e.key === 'Escape' && st.m && st.m.$('[data-trpop]')) { e.stopPropagation(); e.preventDefault(); trPopClose(true); return; }
    if (e.target.closest && e.target.closest('[data-trpop]') && (e.key === ' ' || e.key === 'Enter')) return; // a choice in «Aa», not play / pause
    if (e.key === 'Escape' && Full.on) { e.stopPropagation(); e.preventDefault(); Full.exit(); return; } // not the whole window
    if ((e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') && st.stage === 'player' && !(st.stream && (st.stream.audio || st.stream.companion)) && !(e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); Full.toggle(); return; }
    if (st.stage !== 'player' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    const k = e.key;
    if (k === ' ' || k === 'Spacebar') toggle();
    else if (k === 'ArrowLeft') step(-1);
    else if (k === 'ArrowRight') step(1);
    else if (k === 'r' || k === 'R' || k === 'к' || k === 'К') setLoop(!st.loop);
    else return;
    e.preventDefault(); e.stopPropagation();
  }
  /* drag & drop: this window takes the files itself (not the app's «import cards») */
  const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  function onDrag(e) {
    if (!topmost() || !hasFiles(e)) return;
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') { e.dataTransfer.dropEffect = 'copy'; st.m.el.classList.add('over'); }
    if (e.type === 'dragleave' && (!e.relatedTarget || !st.m.el.contains(e.relatedTarget))) st.m.el.classList.remove('over');
    if (e.type === 'drop') {
      st.m.el.classList.remove('over');
      const ov = document.getElementById('drop-overlay'); if (ov) ov.classList.remove('show');
      if (e.dataTransfer.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    }
  }
  /* a focused button must not «click» on space — space is play / pause here */
  function onKeyUp(e) {
    if (topmost() && st.stage === 'player' && (e.key === ' ' || e.key === 'Spacebar') && e.target.closest && e.target.closest('button')) { e.preventDefault(); e.stopPropagation(); }
  }
  function onDocDown(e) { if (wp && !e.target.closest('.subs-pop')) hidePop(); }
  function onPopClick(e) {
    const b = e.target.closest('.subs-pop [data-wp]'); if (!b || !wp) return;
    e.stopPropagation();
    if (b.dataset.wp === 'x') hidePop();
    else if (b.dataset.wp === 'say') TTS.speak(wp.form, 'no', { place: voicePlace() });
    else if (b.dataset.wp === 'fix') { const me = wp; hidePop(); Study.fixGloss(me.gs, me.k, () => redrawText(me.gs), me.lineRu); }
    else if (b.dataset.wp === 'ok') { const me = wp; hidePop(); if (me.ru) { Study.setUserGloss(me.gs, me.k, me.ru); Study.afterFix(); UI.toast(`✓ «${me.form}» — ${me.ru}`, 'good', 2000); } }
    else if (b.dataset.wp === 'fixline') { const me = wp; hidePop(); const l = st.lines[me.i]; if (l) Study.fixSent(l.text); }
    else if (b.dataset.wp === 'card') wordCard();
    else if (b.dataset.wp === 'more') wordMore();
  }
  /** «✍️ Выбрать…» on a word: CardMaker — the word, its dictionary form, the whole line; automatically or by hand */
  async function wordMore() {
    const me = wp; if (!me || !st) return;
    hidePop();
    try { await me.ready; await me.lemma; } catch (e) { /* the window translates itself */ }
    if (!st) return;
    if (!st.lines[me.i]) return;
    const l = phrase(me.i); // the whole sentence, not a piece of a subtitle line
    try { await ensureTr([l]); } catch (e) { /* CardMaker translates itself */ }
    if (!st) return;
    const lineRu = trOf(l) || '';
    const lineBy = l.ruFile ? [] : (trByOf(l) || []);
    const lineMine = !!(l.ruMine || Study.userSent(l.text)); // ✓ yours: no ⚠️ on the card
    const options = [];
    if (me.no !== me.form) options.push({ id: 'lemma', kind: 'word', label: '🔤 Словарная форма', no: me.no, ru: me.ru, by: me.by || [], byNote: 'словарик', example: l.text, exampleRu: lineRu, exBy: lineBy, exMe: lineMine, description: `в тексте: ${me.form}`, checked: true });
    options.push({ id: 'form', kind: 'word', label: me.no !== me.form ? '🔤 Как в тексте' : '🔤 Слово', no: me.form, ru: me.no !== me.form ? '' : me.ru, by: me.no !== me.form ? undefined : (me.by || []), me: me.no === me.form && !!me.me, byNote: 'словарик', example: l.text, exampleRu: lineRu, exBy: lineBy, exMe: lineMine, checked: me.no === me.form });
    options.push({ id: 'line', kind: 'sent', label: '💬 Всё предложение', no: l.text, ru: lineRu, by: lineBy, me: lineMine, byNote: l.ruFile ? 'субтитры' : '' });
    const S = st.stream;
    CardMaker.open({
      key: S ? S.kind : 'subs', deck: deckName(),
      deckId: (Store.decks().find(x => x.subsMedia === (st.media ? st.media.name : st.noFile.name)) || {}).id, // the deck of this video (not created on cancel)
      tags: ['subtitles'], options,
      source: { by: 'import', label: where(l), name: S ? (S.kind === 'youtube' ? 'YouTube' : S.kind === 'tg' ? 'Telegram' : 'NRK') : 'субтитры' },
      onDone: cards => {
        if (!st) return;
        cards.forEach(c => st.made.push(Object.assign({}, c, { _clipInfo: '', _clipErr: '' })));
        const made = new Set(cards.map(c => U.norm(String(c.no).split('\n')[0])));
        st.lines.forEach((x, i) => { if (!x._made && made.has(U.norm(x.text))) { x._made = true; redrawLine(i); } });
        if (made.has(U.norm(l.text))) markParts(l); // the whole sentence (several lines) became a card
        afterMade();
      },
    });
  }
  function listen(target, ev, fn, opt) { target.addEventListener(ev, fn, opt); st.cleanup.push(() => target.removeEventListener(ev, fn, opt)); }

  /* =================== 🎓 «Учить по материалам» (js/learnby.js) ===================
   * The open player as LearnBy needs it: the lines with their translations (the same queue and 's:' cache), the sound of
   * any moment (own file · Telegram through the bridge · NRK's HLS / podcast MP3 — Song.pcm; YouTube: none), the picture.
   * Subs.openStep(material, part, mode): a step of a plan opens with its own way of showing the translation
   * ('show' · 'blur' · 'hide' · 'off' = no subtitles at all), at its place; the saved choice of the person stays. */
  let stepWant = null;
  const learnBtn = () => (window.LearnBy && LearnBy.btnHtml && st && st.media && !(st.stream && (st.stream.live || st.stream.companion)) ? LearnBy.btnHtml(st.stream ? st.stream : { file: true, audio: st.kind === 'audio' }) : '');
  function learnStep(w) {
    st.step = w;
    setTrMode(w.mode === 'off' ? 'hide' : w.mode, true);
    st.m.el.classList.toggle('lb-nosubs', w.mode === 'off');
  }
  function learnHook() {
    if (!st || !st.m || st.stage !== 'player' || !st.media || (st.stream && (st.stream.live || st.stream.companion))) return;
    if (stepWant && stepWant.key === posId()) { const w = stepWant; stepWant = null; learnStep(w); }
    else if (st.step) st.m.el.classList.toggle('lb-nosubs', st.step.mode === 'off'); // a redraw keeps «без субтитров»
    if (window.LearnBy && LearnBy.attach) { try { LearnBy.attach(learnCtx()); } catch (e) { console.warn('learnby', e); } }
  }
  /** 16 kHz mono Float32 of [a, b] (player time) — null when this source has no readable sound (YouTube) */
  async function learnPcm(a, b) {
    const S = st.stream;
    if (S && (S.kind === 'youtube' || S.companion || S.live)) return null;
    if (S && (S.pcm || S.blob || S.mp3 || S.hls)) return Song.pcm(a, b);
    if (S || !st.media) return null;
    if (Clip.mode === 'none') return null;
    if (Clip.mode !== 'capture' && Clip.fitsInMemory()) {
      try { return await Clip.fromFull(a, b); } catch (e) { if (e.silent) throw e; Clip.decodeErr = e; Clip.mode = 'capture'; Clip._full = null; }
    }
    return Clip.capture(a, b);
  }
  function learnCtx() {
    const me = st, S = st.stream;
    const alive = () => st === me && !!st.m;
    return {
      key: posId(), stream: S || null, file: S ? null : { name: st.media.name, size: st.media.size },
      kind: S ? (S.audio ? 'audio' : 'video') : st.kind, youtube: !!(S && S.kind === 'youtube'),
      title: S ? S.title : baseName(st.media.name), channel: (S && S.channel) || '', poster: (S && S.poster) || '',
      el: st.m.el, alive, step: () => me.step || null, clearStep: () => { if (!alive()) return; me.step = null; me.m.el.classList.remove('lb-nosubs'); },
      dur: () => me.dur || (S && +S.duration) || 0,
      /** the lines in player time: { i, a, b, t, ru, song, frame, auto, en, skip } */
      lines: () => me.lines.map((l, i) => ({ i, a: l.start + me.offset, b: l.end + me.offset, t: l.text, ru: trOf(l), song: !!l.song && !l.songX, songX: l.songX || '', frame: !!l.frame, auto: !!l.auto, en: enLine(l), skip: skipTr(l) })),
      translate: idx => (alive() ? translate(idx) : Promise.resolve(false)),
      tr: i => (alive() && me.lines[i] ? trOf(me.lines[i]) : undefined),
      media: () => (alive() ? media() : null),
      setTr: (mode, temp = true) => { if (alive()) setTrMode(mode, temp); },
      trMode: () => me.trMode,
      pcm: (a, b) => (alive() ? learnPcm(a, b) : Promise.resolve(null)),
      /** a direct address of the picture for a hidden <video> (own file, Telegram) — '' for HLS / YouTube / sound only */
      frameSrc: () => (!alive() || st.kind !== 'video' ? '' : !S ? st.mediaUrl : S.kind === 'tg' && S.video && !S.audio ? S.video : ''),
      video: () => (alive() ? st.m.$('video[data-media]') : null),
      where: t => whereAt(t), at: t => (S && S.at ? S.at(t) : (S && S.link) || ''),
      deckName: () => deckName(),
    };
  }

  /* =================== public API =================== */
  const Subs = {
    /** 🎬 the window; files (optional): File[] to start with */
    open(files) {
      if (st && st.m) { try { st.m.close(); } catch (e) { /* ignore */ } }
      if (window.TTS) TTS.stop();
      st = fresh();
      KEnv.reset(); Kar.p = null; Kar.boxes = null; // 🎤 a new video: nothing of the old one's sound
      Song.reset(); // 🎵 nothing of the old one's songs
      Kar.srcNow = '';
      const m = st.m = UI.modal({
        title: '🎬 Субтитры → карточки', cls: 'wide subs-modal',
        body: '',
        // never closed by an accidental tap (✕, Esc, outside, 🏠): while the TV plays — keep it there / stop it / go back;
        // while watching here — «закрыть просмотр?»
        beforeClose: async () => {
          const s = st; if (!s) return true;
          // casting through Chrome's own Cast button (and still connected — it may have been ended from Chrome's menu or the TV)
          let sdk = false; try { sdk = !!(Cast.timer && s.m.$('[data-castbar]') && cast.framework.CastContext.getInstance().getCurrentSession()); } catch (e) { /* no Cast */ }
          if ((s.castInfo && !s.castLost) || sdk) {
            const r = await castCloseAsk();
            if (r === 'stay' || st !== s) return false;
            if (r === 'stop') {
              if (s.castInfo) { try { await castApi('control', { id: s.castInfo.id, action: 'stop' }); } catch (e) { /* the TV is off anyway */ } s.castInfo = null; }
              if (sdk) { try { cast.framework.CastContext.getInstance().endCurrentSession(true); } catch (e) { /* gone */ } }
            }
            if (sdk) { clearInterval(Cast.timer); Cast.timer = 0; }
            return true;
          }
          const v = media(), asr = Asr.on, S = s.stream;
          const asrLine = asr ? ' Распознавание речи остановится (распознанные строки не сохраняются).' : '';
          // 📡 live / 📱 second screen: closing stops the broadcast — asked while it runs (no «свернуть»: the player has no mini form)
          if (S && S.live) {
            if (!(v && !v.paused) && !asr) return true; // nothing plays (it failed to start / paused) — nothing to stop
            return (await UI.askClose({ title: 'Закрыть эфир?',
              line: `${S.companion ? 'Второй экран отключится. ' : ''}Карточки, которые вы сделали, сохранены.${asrLine}`,
              actions: [{ label: 'Закрыть', value: 'close', cls: 'bad' }], cancel: 'Смотреть дальше' })) === 'close';
          }
          if (!v || !(v.currentTime > 3 || !v.paused || asr)) return true;
          return (await UI.askClose({ title: 'Закрыть просмотр?',
            line: `Вы остановились на ${mss(v.currentTime || 0)}${window.Resume || !(S && S.kind === 'youtube') ? ' — место запомнится' : ''}. Карточки, которые вы сделали, сохранены.${asrLine}`,
            actions: [{ label: 'Закрыть', value: 'close', cls: 'bad' }], cancel: 'Смотреть дальше' })) === 'close';
        },
        onClose: () => {
          const s = st; if (!s) return;
          try { savePos(); } catch (e) { /* ignore */ }
          const v = s.m && s.m.$('[data-media]'); if (v) { v.pause(); v.removeAttribute('src'); try { v.load(); } catch (e) { /* ignore */ } }
          if (s.yt) { try { s.yt.pause(); } catch (e) { /* ignore */ } s.yt.destroy(); s.yt = null; }
          if (s.clk) { s.clk.pause(); s.clk.destroy(); s.clk = null; }
          Asr.stop();
          LiveSubs.stop();
          if (s.liveTimer) { clearInterval(s.liveTimer); s.liveTimer = 0; }
          if (s.liveTrT) { clearTimeout(s.liveTrT); s.liveTrT = 0; }
          if (s.tq) { clearTimeout(s.tq.t); clearTimeout(s.tq.retryT); s.tq.t = s.tq.retryT = 0; }
          if (s.ink) { clearTimeout(s.ink.t); s.ink.t = 0; }
          Full.exit(true);
          if (s.castTimer) { clearInterval(s.castTimer); s.castTimer = 0; } // the TV plays on; this window stops following it
          if (s.hls) { try { s.hls.destroy(); } catch (e) { /* ignore */ } s.hls = null; }
          if (s.raf) cancelAnimationFrame(s.raf);
          if (s.posTimer) { clearInterval(s.posTimer); s.posTimer = 0; }
          Clip.reset(); KEnv.reset(); Kar.boxes = null; Song.reset();
          MSess.clear(); // 🔒 the lock screen forgets this player
          if (s.mediaUrl) setTimeout(() => URL.revokeObjectURL(s.mediaUrl), 500);
          hidePop();
          s.cleanup.forEach(f => f());
          st = null;
        },
      });
      m.el.addEventListener('click', onClick);
      m.el.addEventListener('change', onChange);
      m.el.addEventListener('input', onInput);
      m.el.addEventListener('dblclick', fsDbl, true); // a double click on the picture = ⛶ with our subtitles (not the browser's bare one)
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => listen(window, ev, onDrag, true));
      listen(window, 'keydown', onKey, true);
      listen(window, 'keyup', onKeyUp, true);
      listen(document, 'mousedown', onDocDown, false);
      listen(document, 'touchstart', onDocDown, { passive: true });
      listen(document, 'click', onPopClick, true);
      listen(window, 'nk-userfix', e => redrawText(e.detail && e.detail.sent));
      listen(document, 'visibilitychange', () => { if (document.hidden) Ink.stop(); else Ink.kick(800); }); // 📝 a hidden tab reads nothing
      // 🌐 the internet is back: the lines without a translation are asked again at once (not after their long wait)
      listen(window, 'online', () => { if (st && st.stage === 'player' && st.lines.some(l => l._trFail)) trRetry(false); });
      render();
      if (files && files.length) addFiles(files);
      return m;
    },
    close() { if (st && st.m) st.m.close(); },
    isOpen() { return !!(st && st.m); },
    /** 🎤 «Бегущая строка» on / off (mode: 'hl' — подсветка, 'wbw' — слово за словом); no args → the current choice */
    karaoke(on, mode) { if (on === undefined) return Object.assign({}, Kar.prefs()); if (st && st.m) Kar.set(on, mode, true); else { const p = Kar.prefs(); p.on = !!on; if (mode) p.mode = mode === 'wbw' ? 'wbw' : 'hl'; Kar.save(); } return Object.assign({}, Kar.prefs()); },
    /** for checks: the word times of line i (the current one by default) */
    karInfo(i) {
      if (!st) return null; i = i == null ? st.cur : i; const L = st.lines, l = L[i]; if (!l) return null;
      const r = kwOf(l, L[i - 1], L[i + 1]);
      return r && { i, text: l.text, src: r.src, t: r.t.map(x => Math.round(x * 1000) / 1000), e: Math.round(r.e * 1000) / 1000, cur: Kar.ci, shift: st.ksh || 0, env: KEnv.ch.length };
    },

    /** a live master playlist → its Norwegian subtitle track (the whole speech before «kun ved annet språk»), '' if none */
    async liveVttUrl(master) {
      const r = await fetch(master, { cache: 'no-store' }); if (!r.ok) return '';
      const text = await r.text();
      const subs = text.split(/\r?\n/).filter(l => /^#EXT-X-MEDIA:/.test(l) && /TYPE=SUBTITLES/.test(l) && /URI="/.test(l));
      const score = l => (/transcribes-spoken-dialog/.test(l) ? 4 : 0) + (/LANGUAGE="(no|nb|nor)/i.test(l) ? 2 : 0) - (/kun ved annet/i.test(l) ? 3 : 0);
      subs.sort((a, b) => score(b) - score(a));
      const u = subs.length ? (subs[0].match(/URI="([^"]+)"/) || [])[1] : '';
      return u ? new URL(u, r.url || master).href : '';
    },
    /** the Mac bridge's media helpers (/api/media/…): YouTube subtitles and channel videos, NRK TV catalogue */
    async api(action, params = {}) {
      // the bridge's paths only on the Mac itself, with the bridge running (never from the site or the store apps)
      if (!macBridge()) throw Object.assign(new Error(onMac() ? 'нужен мост на Mac (python3 bridge/server.py)' : 'здесь это пока недоступно'), { noBridge: true, site: !onMac() });
      let r;
      try { r = await fetch(`/api/media/${action}?` + new URLSearchParams(params)); } catch (e) { throw new Error('мост на Mac не отвечает'); }
      const ct = r.headers.get('Content-Type') || '';
      const OLD = 'мост на Mac старой версии — перезапустите его: в Терминале Ctrl+C, затем снова python3 "…/bridge/server.py"';
      if (!/json/.test(ct)) throw Object.assign(new Error(OLD), { oldBridge: true });
      const j = await r.json().catch(() => ({}));
      // a request this bridge does not know yet (e.g. 📡 live channels, 📻 radio, podcasts) — it is older than the app
      if (r.status === 400 && /не разрешён/.test(j.error || '')) throw Object.assign(new Error(OLD), { oldBridge: true });
      if (!r.ok) throw new Error(j.error || 'ошибка ' + r.status);
      return j;
    },

    /**
     * ▶ YouTube / 📺 NRK TV inside the app with dual subtitles (the same player as for own files).
     * src = { kind: 'youtube'|'nrk'|'tg', id, title, channel, link (open outside), at(t) → link to that moment,
     *         cues: [{start, end, text}], subName, note (html), hls (NRK), poster, start,
     *         ✈️ tg: video (the bridge's stream), pcm (its sound by time, when the Mac has ffmpeg), author, date, duration }
     */
    openStream(src) {
      this.open();
      st.stream = src;
      st.media = { name: (src.kind === 'youtube' ? 'yt:' : src.kind === 'tg' ? 'tg:' : src.radio ? 'nrkr:' : 'nrk:') + src.id, size: 0 };
      st.mediaUrl = src.kind === 'youtube' ? 'yt:' + src.id : src.video || src.hls || src.mp3;
      st.kind = src.audio ? 'audio' : 'video'; // 📻 radio / podcasts: sound only
      // 📱 second screen: the player's time = the wall clock − the TV's delay (from a fixed moment a few hours back)
      if (src.companion) st.liveOff = Math.floor(Date.now() / 1000) - 6 * 3600;
      st.noFile = { name: src.subName || 'субтитры' };
      st.noCues = (src.cues || []).filter(c => c && c.text && c.end > c.start);
      st.noLines = st.noCues.length;
      const h = st.m.$('.modal-head h2');
      if (h) h.innerHTML = `${src.companion ? '📱' : brandIco(src)} ${brand(src)}${src.live ? ' · <span class="subs-live-tag">● эфир</span>' : ''}${src.companion ? ' · второй экран' : ''} · субтитры и перевод`;
      st.m.el.classList.add('subs-stream');
      st.m.el.classList.toggle('subs-companion', !!src.companion);
      st.m.el.classList.toggle('subs-live', !!src.live);
      buildLines();
      openPlayer();
      if (src.live) {
        // 📡 the bar (on air / behind) every second; NRK's own live subtitles, if the stream has them
        st.liveTimer = setInterval(() => Live.bar(), 1000);
        if (src.liveVtt) LiveSubs.start(src.liveVtt).catch(() => {});
      }
      // 🌐 who translates: the free translator can be wrong — offer a neural network (once; a badge stays in the player)
      // (only when there are lines to translate or the app will make them — not over a video that has none)
      if (window.TrNotice && (st.noCues.length || src.autoAsr)) setTimeout(() => { if (st && st.stream === src) TrNotice.maybe(src); }, 350);
      return st.m;
    },

    /* ---------- 🎓 «Учить по материалам» (js/learnby.js) ---------- */
    /** a step of a plan: material = { key } (the place id of js/resume.js), part = { a, b, at }, mode = 'show' | 'blur' |
     *  'hide' | 'off' (no subtitles). The player already shows it → applied at once (and moved to part.at); otherwise kept
     *  until it opens (the caller opens it; Resume.prefer moves it to the place) → true when applied now */
    openStep(material, part, mode) {
      const w = { key: String(material && material.key || ''), a: +(part && part.a) || 0, b: +(part && part.b) || 0, at: +(part && part.at) || 0, mode: ['show', 'word', 'blur', 'hide', 'off'].includes(mode) ? mode : 'show' };
      if (st && st.m && st.stage === 'player' && st.media && posId() === w.key) {
        stepWant = null; learnStep(w);
        const v = media(); if (v) { try { v.currentTime = w.at || w.a; } catch (e) { /* not seekable yet */ } }
        if (window.LearnBy && LearnBy.attach) { try { LearnBy.attach(learnCtx()); } catch (e) { console.warn('learnby', e); } }
        return true;
      }
      stepWant = w;
      return false;
    },
    /** the open player for js/learnby.js (null when none) */
    learnCtx() { return st && st.m && st.stage === 'player' && st.media ? learnCtx() : null; },

    /* ---------- for the study card ---------- */
    /** does the card have its own recording (a line cut from a video / audio)? */
    hasAudio(card) { return !!(card && typeof card.audio === 'string' && /^data:audio\//.test(card.audio)); },
    /**
     * play card.audio; resolves when it ends (or is stopped / fails). Uses TTS._audio, so TTS.stop() and the
     * app's pause / stop buttons work for it too. Returns false when the card has no recording (→ speak with TTS).
     */
    playAudio(card, opts = {}) {
      if (!this.hasAudio(card)) return Promise.resolve(false);
      if (window.TTS && !opts.keep) TTS.stop();
      return new Promise(resolve => {
        const a = new Audio(card.audio);
        a.playbackRate = opts.rate || 1;
        if (window.TTS) TTS._audio = a;
        const end = ok => { if (window.TTS && TTS._audio === a) TTS._audio = null; resolve(ok); };
        a.onended = () => end(true);
        a.onerror = () => end(false);
        a.onpause = () => { if (!a.ended && !(window.TTS && TTS.player && TTS.player.paused)) end(true); };
        const p = a.play(); if (p && p.catch) p.catch(() => end(false));
      });
    },
    /** 🎬🔊 button for a card that has a recording ('' otherwise) — the caller handles data-act */
    audioBtnHtml(card, act = 'card-audio') {
      return this.hasAudio(card) ? `<button class="icon-btn sm subs-say" data-act="${act}" title="🎬 Оригинальный звук из видео${card.audioText && card.audioText !== card.no ? ': «' + U.esc(String(card.audioText).slice(0, 80)) + '»' : ''}">🎬</button>` : '';
    },

    /* ---------- 🪜 levels (js/levels.js): the player's new words, and a redraw when the highlight is switched ---------- */
    /** distinct new words (not in the cards) of the open player's lines, as written */
    levelWords() {
      if (!st || !st.known) return [];
      const out = new Set();
      st.lines.forEach(l => { const nw = lineNew(l); if (!nw.size) return; String(l.text).split(/\s+/).filter(w => /\p{L}/u.test(w)).forEach((w, k) => { if (nw.has(k)) out.add(bare(w)); }); });
      return [...out];
    },
    /** the highlight was switched (or the word list arrived): redraw the words and the bar — not the video */
    levelRedraw(wordsOnly) {
      if (!st || !st.m || st.stage !== 'player') return;
      st.lines.forEach((l, k) => redrawLine(k));
      if (!wordsOnly && window.Levels) Levels.subsBar(st.m.$('[data-lv-subs]'));
    },

    /** the Mac bridge may be used here (the Mac itself + the bridge answered) — for js/youtube.js, js/nrk*.js, js/tg*.js */
    macBridge,
    /* ---------- internals (tests) ---------- */
    _ms: MSess, _ytPlain: () => ytPlain(),
    _ocrFrame: () => ocrFrame(), _whereAt: t => whereAt(t),
    _parse: parseSubs, _decode: decodeSub, _detect: detectLang, _pair: pairUp, _clip: Clip, _wav: wavBytes, _asr: Asr, _cast: Cast, _phrase: i => phrase(i),
    _tv: { tvVtt, tvPrefs, tvSave, glossText, castBar, tvSource, tvDevice, mirrorSteps, onMac },
    _live: { Live, LiveSubs, mediaPlaylist, parseMedia, tsPts, mp3Frames, mp3Hdr, insertLine },
    _lang: { tagLine, skipTr, langOk, musicHint },
    _ink: () => Ink,
    _song: () => Song, _cred: { Cred, crParse, crTranslit, crGen, crName, crRole },
    _tr: { setTrMode, enLine, srcOf, trPop },
    get _st() { return st; },
  };

  window.Subs = Subs;
})();
