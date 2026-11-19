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
 */
(function () {
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
      if (isFinite(start) && isFinite(end)) out.push({ start, end: Math.max(end, start + 0.3), text: cleanCue(body.join('\n')) });
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
      if (isFinite(start) && isFinite(end)) out.push({ start, end: Math.max(end, start + 0.3), text: cleanCue(body) });
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
    if (l._new === undefined) { const t = String(l.text).split(/\s+/).filter(w => /\p{L}/u.test(w)); l._new = new Set(t.map((w, k) => isNewWord(w, k) ? k : -1).filter(k => k >= 0)); }
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
    if (!LID() || !l || l.langOk) return l;
    const r = LangId.detect(l.text, Object.assign({}, o, { music: !!(o.music || l.musicA) }));
    l.lang = r.lang; l.music = r.music; l.noWords = r.noWords; l.langWhy = r.why; l._new = undefined;
    return l;
  }
  function skipTr(l) { return !!l && !l.langOk && (!!l.noWords || (!!l.lang && !!LID() && !LangId.translatable(l.lang))); }
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
    if (l.noWords) return `<span class="sl-tag mus" title="Здесь звучит музыка без слов — переводить нечего">🎵 Музыка</span>`;
    const code = LangId.code(l.lang), nm = LangId.name(l.lang);
    if (skipTr(l)) {
      return `<span class="sl-tag xl" title="Похоже, это ${nm}${l.music ? ' (песня)' : ''} — строку не переводим и не разбираем по словам, чтобы не тратить лимит переводчика на чужой язык. Если это всё-таки ${learnName()} — нажмите «перевести».">${l.music ? '♪ ' : ''}${code} — не ${learnName()}, не переводим</span>`
        + ` <button type="button" class="sl-tagbtn" data-langok="${i}" title="Это ${learnName()}: перевести строку и разобрать по словам">это ${learnName()} — перевести</button> `;
    }
    const near = !l.langOk && l.lang && l.lang !== LangId.learn()
      ? `<span class="sl-tag near" title="Похоже, это ${nm} — он очень близок к языку, который вы учите, поэтому строку переводим">${code}</span> ` : '';
    return near + (l.music ? `<span class="sl-tag song" title="Песня — переводим, как обычную речь">♪ песня</span> ` : '');
  }
  /** «это норвежский — перевести»: this line is translated and glossed after all */
  function langOk(i) {
    const l = st.lines[i]; if (!l) return;
    l.langOk = true; l._trFail = false; l._new = undefined; l._gl = false;
    redrawLine(i); musicHint();
    if (st.stream && st.stream.live) liveTrSoon();
    else translate([i], true).then(() => { if (st) { const k = st.lines.indexOf(l); if (k >= 0) redrawLine(k); } });
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
    const c = window.Translators && Translators._trCache && Translators._trCache.get('no|ru|' + l.text);
    return c ? [c.id] : (Study._exBy && Study._exBy.length ? Study._exBy.slice() : ['google']);
  }
  /** translate these lines (cached for good: Study's 's:' cache) */
  async function translate(idx, quiet) {
    const need = [...new Set(idx.map(i => st.lines[i]).filter(l => l && !l.ruFile && trOf(l) === undefined).map(l => l.text))];
    if (!need.length) return true;
    for (let k = 0; k < need.length; k += 250) {
      await Study.translateUnits(need.slice(k, k + 250), []);
      if (!st) return false;
    }
    if (Study._lastFail && !quiet) { Study.failModal(() => translate(idx)); return false; }
    return true;
  }
  /** quietly translate lines ahead of what is playing / shown (3 at a time: no «please wait» card) */
  async function prefetch() {
    if (!st || st.trBusy || hasRuFile() || !st.lines.length) return;
    st.trBusy = true;
    try {
      for (let guard = 0; guard < 40 && st; guard++) {
        const from = Math.max(0, st.cur - 2), to = Math.min(st.lines.length, Math.max(st.cur, 0) + 30);
        const todo = [];
        for (let i = from; i < to && todo.length < 3; i++) if (trOf(st.lines[i]) === undefined && !st.lines[i]._trFail) todo.push(i);
        if (!todo.length) break;
        await Study.translateUnits(todo.map(i => st.lines[i].text), []);
        if (!st) return;
        todo.forEach(i => { if (trOf(st.lines[i]) === undefined) st.lines[i]._trFail = true; redrawLine(i); });
        if (Study._lastFail) break;
      }
    } catch (e) { /* the explicit button shows the reason */ }
    if (st) { st.trBusy = false; drawNow(); }
  }

  /* =================== HTML =================== */
  function wordsHtml(l, i) {
    const tag = tagHtml(l, i);
    if (skipTr(l)) return tag + (l.noWords ? '' : `<span class="sl-xltext">${U.esc(l.text)}</span>`);
    return tag + wordsHtml0(l, i);
  }
  function wordsHtml0(l, i) {
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
      return `<span class="sw${nw.has(k) ? ' new' : ''}${lv ? ' lv-hit lv-' + lv : ''}" data-w="${U.esc(bare(tok))}" data-li="${i}"${lv ? ` title="Слово уровня ${lv} — его нет в ваших карточках"` : ''}>${U.esc(tok)}</span>${g ? `<span class="wbw-ru sw-gl${cls}"${tip}>(${U.esc(g)}${r.how === 'guess' ? '?' : r.how === 'user' ? ' ✓' : ''})</span>` : ''}`;
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
        const batch = order.filter(k => !L[k]._gl && !skipTr(L[k])).slice(0, ai ? 16 : 24);
        if (!batch.length) break;
        const done = L.filter(l => l._gl).length, all = L.filter(l => !skipTr(l)).length;
        glossProg(`⏳ ${ai ? AI.name() + ' переводит' : 'Перевожу'} слова по смыслу строки: ${Math.min(done, all)} из ${all}`);
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
    const ru = tr ? `<span class="sl-tr">(${U.esc(tr)})</span>` : hasRuFile() ? '' : `<span class="sl-tr wait">(${l._trFail ? '—' : '…'})</span>`;
    return ru + (l.en ? `<span class="sl-en">${U.esc(l.en)}</span>` : '');
  }
  function lineHtml(l, i) {
    const made = l._made ? ' made' : '', nw = !l._made && st.known && lineNew(l).size ? ' has-new' : '';
    const xl = skipTr(l) ? (l.noWords ? ' xl mus' : ' xl') : '';
    return `<div class="subs-line${i === st.cur ? ' cur' : ''}${made}${nw}${xl}" data-i="${i}">
      <label class="sl-chk" title="Отметить строку"><input type="checkbox" data-chk="${i}"${st.checked.has(i) ? ' checked' : ''}></label>
      <button class="sl-time" data-play="${i}" title="Проиграть только эту строку">${tLabel(lineT(l, 'start'))}</button>
      <div class="sl-body" data-play="${i}">${l.auto ? '<span class="sl-auto" title="Эту строку распознало приложение (в передаче нет субтитров) — в словах возможны ошибки">🤖</span> ' : ''}<span class="sl-no">${wordsHtml(l, i)}</span> ${trHtml(l)}</div>
      <button class="icon-btn sm sl-add" data-add="${i}" ${xl ? 'disabled' : ''} title="${xl ? (l.noWords ? 'Музыка — карточку из неё не сделать' : `Строка не на языке, который вы учите, — карточку не делаем (если это ${learnName()} — нажмите «перевести»)`) : l._made ? 'Карточка уже есть — сделать ещё раз нельзя' : 'Строка → карточка (со звуком этой строки)'}">${l._made ? '✓' : '➕'}</button>
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
      <div class="subs-note">ℹ️ <span><b>Видео с YouTube и передачи NRK TV</b> открываются с субтитрами прямо в приложении — в разделах
        <a href="#" data-goto="youtube">▶ YouTube</a> и <a href="#" data-goto="nrk">📺 NRK TV</a>.
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
  function stage(inner) {
    return `<div class="subs-stage" data-stage>${inner}
        ${ocrOk() ? '<button type="button" class="subs-ocr-chip" data-k="ocr" data-ocr-chip hidden title="Прочитать надписи этого кадра и сделать из них карточки">🔎 Найти слова в кадре</button>' : ''}
        <div class="subs-glass-box" data-glass-box><div class="subs-glass" data-glass hidden>
          <span class="glass-grip" data-glass-grip title="Потяните — толще / тоньше" aria-hidden="true"></span>
          <span class="glass-tag"><span data-glass-peek title="Потяните — сдвинуть стекло; удерживайте — увидеть оригинал">▭ Надписи видео закрыты · 👁 удерживайте</span><button type="button" data-glass-off title="Убрать стекло" aria-label="Убрать стекло">✕</button></span>
        </div></div>
        <div class="subs-ov" data-ov aria-live="polite"></div>
        <div class="subs-ovbar">
          <button class="media-btn sm" data-k="prev" title="Предыдущая строка (←)">${ico('prev')}</button>
          <button class="media-btn sm main" data-k="toggle" title="Пауза / продолжить (пробел)">${UI.icon('play', 18)}</button>
          <button class="media-btn sm" data-k="next" title="Следующая строка (→)">${ico('next')}</button>
          <button class="btn sm subs-loop${st.loop ? ' on' : ''}" data-k="loop" title="Повторять строку (R)">🔁</button>
          <button class="btn sm" data-k="trcycle" title="Перевод: виден / размыт / скрыт">Aa ${st.trMode === 'show' ? 'RU' : st.trMode === 'blur' ? 'RU ░' : 'RU ✕'}</button>
          ${rateSel('on-dark')}
          <button class="btn sm glass-btn" data-k="glass" aria-pressed="false" title="Закрыть надписи, впечатанные в видео, матовым стеклом">▭</button>
          <button class="btn sm" data-k="subview" title="Вид субтитров: размер, цвета">Aa</button>
          <span class="grow"></span>
          <button class="btn sm tv-btn" data-k="tv" title="Подключить к телевизору" aria-label="Подключить к телевизору">${UI.TV_SVG(18)}</button>
          <button class="btn sm primary" data-k="full">⤡ Выйти из полного экрана</button>
        </div>
      </div>`;
  }
  /** under the video: layout (video left / right), full screen, TV */
  function viewBar() {
    const lay = layout();
    return `<div class="subs-view">
        <span class="seg-mini sm subs-lay" role="group" aria-label="Где видео">
          <button data-lay="left" class="${lay === 'left' ? 'active' : ''}" title="Видео слева, субтитры справа">◧ Видео слева</button>
          <button data-lay="right" class="${lay === 'right' ? 'active' : ''}" title="Видео справа, субтитры слева">Видео справа ◨</button>
        </span>
        ${rateSel()}
        <button class="btn sm glass-btn ovwin-btn" data-k="ovwin" aria-pressed="true" title="Строка с переводом прямо на видео (как в YouTube) — включить / выключить">💬 Субтитры на видео</button>
        <button class="btn sm sv-btn" data-k="subview" title="Размер текста, размер перевода слов, цвета — на экране и на телевизоре">Aa Вид субтитров</button>
        <button class="btn sm glass-btn" data-k="glass" aria-pressed="false" title="В видео впечатаны свои надписи? Закрыть их матовым стеклом">▭ Закрыть надписи в видео</button>
        ${ocrOk() ? '<button class="btn sm ocr-btn" data-k="ocr" title="Пауза и прочитать надписи этого кадра: слова и фразы → карточки">🔎 Найти слова в кадре</button>' : ''}
        <button class="btn sm" data-k="full" title="Видео на весь экран, субтитры и перевод — поверх видео (F)">⛶ На весь экран</button>
        <button class="btn sm tv-btn" data-k="tv" title="Смотреть на телевизоре — с субтитрами и переводом">${UI.TV_SVG(18)}<span>На телевизор</span></button>
      </div>`;
  }
  /** where a stream comes from: YouTube · NRK TV · NRK Radio (podcasts too) */
  const brand = S => (S.kind === 'youtube' ? 'YouTube' : S.kind === 'tg' ? 'Telegram' : S.radio ? 'NRK Radio' : 'NRK TV');
  const brandIco = S => (S.kind === 'youtube' ? '▶' : S.kind === 'tg' ? '✈️' : S.radio ? '📻' : '📺');
  /** 🔎 the frame can be read (OCR): the picture comes from this site (Telegram through the bridge, own files) */
  const ocrOk = () => !!(window.FrameOcr && st && st.kind === 'video' && ((st.stream && st.stream.kind === 'tg') || (!st.stream && st.media)));
  /** 📻 a radio channel / podcast: its picture and the sound player (no video stage) */
  const radioBox = S => `<div class="subs-radio">
      <div class="subs-radio-art">${S.poster ? `<img src="${U.esc(S.poster)}" alt="">` : `<span class="sr-ico" aria-hidden="true">${S.kind === 'tg' ? (S.voice ? '🎤' : '🎵') : '📻'}</span>`}
        <span class="sr-txt"><b>${U.esc(S.title)}</b>${S.channel ? `<small>${U.esc(S.channel)}</small>` : ''}${S.live ? '<span class="sr-live">● в эфире</span>' : ''}</span></div>
      <audio class="subs-media" data-media preload="auto" controls></audio>
    </div>`;
  /** 📡 live: where the player is (on air / behind) and «к прямому эфиру» */
  const liveBar = () => `<div class="subs-livebar" data-livebar><span class="lb-dot" aria-hidden="true"></span><span class="lb-pos" data-livepos>прямой эфир</span><span class="grow"></span>
      <button class="btn sm" data-k="golive" title="Перейти к тому, что идёт в эфире сейчас">⏭ К прямому эфиру</button></div>`;
  function playerHtml() {
    const nNew = st.lines.filter(l => !l._made && lineNew(l).size).length;
    const S = st.stream;
    const media = S && S.companion
      ? `${secondBox(S)}${secondBar()}
        <div class="subs-src"><span class="grow">📺 <b>${U.esc(S.title)}</b> · <span class="muted">второй экран к телевизору</span></span>
          <a class="btn sm ghost" href="${U.esc(S.link)}" target="_blank" rel="noopener" title="Открыть эфир в приложении или на сайте NRK TV">↗ Открыть в NRK</a></div>
        ${S.note ? `<div class="mt-warn ok subs-stream-note"><span>ℹ️</span><span>${S.note}</span></div>` : ''}`
      : S && S.audio
      ? `${radioBox(S)}${S.live ? liveBar() : ''}
        <div class="subs-src"><span class="grow small muted">${brandIco(S)} ${S.kind === 'tg' ? `${U.esc(S.channel || 'Telegram')}${S.author && S.author !== S.channel ? ' · ' + U.esc(S.author) : ''}${S.date ? ' · ' + U.esc(new Date(S.date).toLocaleDateString('ru-RU')) : ''}` : `${S.live ? 'прямой эфир' : 'выпуск'} ${brand(S)}`}</span>
          ${S.link ? `<a class="btn sm ghost" href="${U.esc(S.link)}" target="_blank" rel="noopener" title="Открыть в приложении или на сайте ${brand(S)}">↗ ${brand(S)}</a>` : ''}</div>
        ${S.note ? `<div class="mt-warn ${S.autoAsr ? '' : 'ok'} subs-stream-note"><span>${S.autoAsr ? '🤖' : 'ℹ️'}</span><span>${S.note}
          ${S.autoAsr ? '<span class="subs-asr-row"><button class="btn sm primary" data-asr-go>🤖 Создать субтитры и перевод</button><span class="small" data-asr-st></span></span>' : ''}</span></div>` : ''}`
      : S
      ? `${stage(S.kind === 'youtube'
          ? `<iframe data-yt-frame src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(S.id)}?enablejsapi=1&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&cc_load_policy=0&origin=${encodeURIComponent(location.origin)}${S.start ? '&start=' + Math.floor(S.start) : ''}" title="${U.esc(S.title)}" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`
          : `<video class="subs-media" data-media playsinline webkit-playsinline preload="auto" controls ${S.poster ? `poster="${U.esc(S.poster)}"` : ''}></video>`)}
        ${viewBar()}${S.live ? liveBar() : ''}
        <div class="subs-src"><span class="grow">${brandIco(S)} <b>${U.esc(S.title)}</b>${S.channel ? ` · <span class="muted">${U.esc(S.channel)}</span>` : ''}${S.kind === 'tg' && S.date ? ` · <span class="muted">${U.esc(new Date(S.date).toLocaleDateString('ru-RU'))}</span>` : ''}</span>
          ${S.link ? `<a class="btn sm ghost" href="${U.esc(S.link)}" target="_blank" rel="noopener" title="Открыть в ${S.kind === 'youtube' ? 'приложении или на сайте YouTube' : S.kind === 'tg' ? 'Telegram' : 'приложении или на сайте NRK TV'}">↗ ${S.kind === 'youtube' ? 'YouTube' : S.kind === 'tg' ? 'Telegram' : 'NRK TV'}</a>` : ''}</div>
        ${S.note ? `<div class="mt-warn ${S.autoAsr ? '' : 'ok'} subs-stream-note"><span>${S.autoAsr ? '🤖' : 'ℹ️'}</span><span>${S.note}
          ${S.autoAsr ? `<span class="subs-asr-row"><button class="btn sm primary" data-asr-go>🤖 Создать субтитры и перевод</button><span class="small" data-asr-st></span></span>
          <span class="subs-asr-row"><button class="btn sm glass-btn" data-k="glass" aria-pressed="false">▭ В видео видны свои надписи? Закрыть их стеклом</button></span>` : ''}</span></div>` : ''}`
      : st.media
      ? (st.kind === 'video'
        ? `${stage(`<video class="subs-media" data-media playsinline webkit-playsinline preload="auto" controls src="${U.esc(st.mediaUrl)}"></video>`)}${viewBar()}`
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
        </div>
        <div class="subs-ctrl2">
          <span class="small muted">Перевод:</span>
          <span class="seg-mini sm" data-trm>${[['show', 'виден'], ['word', 'слово (перевод)'], ['blur', 'размыт'], ['hide', 'скрыт']].map(([k, t]) => `<button data-trmode="${k}" class="${st.trMode === k ? 'active' : ''}">${t}</button>`).join('')}</span>
          <span class="tiny muted subs-glprog" data-glprog role="status" aria-live="polite"></span>
          <span class="tiny muted subs-glass-hint">работает с нашими субтитрами · надписи, впечатанные в видео, закройте <button type="button" class="linklike" data-k="glass">▭ стеклом</button></span>
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
        <div class="subs-list" data-list>${st.lines.length ? st.lines.map(lineHtml).join('') : S && S.live ? `<div class="nrk-empty muted">${S.autoAsr ? '🤖 Здесь появятся строки эфира, которые распознает приложение, — с переводом. Нажмите ▶.' : `💬 Здесь появятся субтитры эфира NRK — с переводом.${S.companion ? '' : ' Нажмите ▶.'}`}</div>`
          : S && S.autoAsr ? `<div class="nrk-empty muted">🤖 Здесь появятся строки, которые распознает приложение, — с переводом (запускать ${S.audio ? 'звук' : 'видео'} для этого не нужно).</div>` : ''}</div>
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
    const box = st.m.$('[data-now]'); if (!box) return;
    const l = st.lines[st.cur];
    // full screen: the same line over the video (words tappable, translation obeys «виден / размыт / скрыт»)
    const ov = st.m.$('[data-ov]'), comp = !!(st.stream && st.stream.companion);
    if (ov) ov.innerHTML = l && (st.full || ovOn() || comp) ? `<div class="ov-box"><div class="ov-no">${l.auto ? '<span class="sl-auto">🤖</span> ' : ''}${wordsHtml(l, st.cur)}</div><div class="ov-ru">${trHtml(l)}</div></div>`
      + (comp ? `<div class="s2-act"><button class="btn sm primary" data-add="${st.cur}" ${l._made || skipTr(l) ? 'disabled' : ''}>${l._made ? '✓ уже в карточках' : '➕ Строка → карточка'}</button></div>` : '')
      : comp && !LiveSubs.quiet ? `<div class="s2-wait">${st.lines.length ? 'Сейчас по телевизору говорят без субтитров — следующая строка появится здесь' : '<span class="spinner sm"></span> Строки эфира появятся здесь через несколько секунд…'}</div>` : '';
    if (!l) { box.innerHTML = `<div class="sn-empty muted">${st.lines.length ? 'Нажмите ▶ или на строку в списке' : ''}</div>`; return; }
    box.innerHTML = `<div class="sn-no">${wordsHtml(l, st.cur)}</div><div class="sn-tr">${trHtml(l)}</div>
      <div class="sn-act"><button class="btn sm" data-play="${st.cur}" title="Ещё раз эту строку">↺ ещё раз</button>
      <button class="btn sm primary" data-add="${st.cur}" ${l._made || skipTr(l) ? 'disabled' : ''}>${l._made ? '✓ уже в карточках' : '➕ Строка → карточка'}</button></div>`;
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
    }).catch(err => { a.errMsg = err.message; fire('error'); });
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
    }).catch(err => { if (st) { st.streamErr = err.message; v.dispatchEvent(new Event('error')); } });
  }
  /** the video's own text tracks (HLS subtitle renditions, CEA-608) stay off — our overlay shows the lines; Safari may
   *  switch one on by itself (AUTOSELECT / the system's «subtitles + SDH» setting), so this holds on addtrack / change too.
   *  (Lines burned into NRK's picture — e.g. Kodeknekkerne season 2 — are pixels: no track, nothing to switch off.) */
  function noNativeSubs(v) {
    const T = v.textTracks;
    if (!T || v._noNativeSubs) return;
    v._noNativeSubs = true;
    const off = () => { for (let i = 0; i < T.length; i++) if (T[i].mode !== 'disabled') T[i].mode = 'disabled'; };
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
      el.innerHTML = (onAir ? (v.paused ? 'эфир на паузе' : '<b>в прямом эфире</b>') : `<b>−${mss(behind)}</b> от эфира`) + (isFinite(at) ? ` · ${clockOf(at)}` : '');
      const box = st.m.$('[data-livebar]'); if (box) box.classList.toggle('behind', !onAir || v.paused);
      st.m.$$('[data-k="golive"]').forEach(b => b.classList.toggle('primary', !onAir || v.paused));
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
    let i = L.findIndex(l => l.start > start); if (i < 0) i = L.length;
    L.splice(i, 0, line);
    tagLine(line, { asr: !!auto, prev: prevOf(L, i) });
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
    else if (st.stream && st.stream.live) liveTrSoon();
    else translate([i], true).then(() => { if (st) { const k = st.lines.indexOf(line); if (k >= 0) redrawLine(k); } });
    tick();
    return line;
  }
  /** live: new lines are translated in small batches in the background (not one request per line), slower while Google rests */
  function liveTrSoon() {
    if (!st || st.liveTrT) return;
    const me = st, rest = window.Translators && Translators.gCooling && Translators.gCooling();
    st.liveTrT = setTimeout(async () => {
      if (st !== me) return;
      const from = Math.max(0, st.cur - 2), idx = [];
      for (let i = from; i < st.lines.length && idx.length < 12; i++) if (!st.lines[i].ruFile && trOf(st.lines[i]) === undefined && !st.lines[i]._trFail) idx.push(i);
      try { if (idx.length) await translate(idx, true); } catch (e) { /* the next round */ }
      if (st !== me) return;
      st.liveTrT = 0;
      idx.forEach(i => { if (st.lines[i] && trOf(st.lines[i]) === undefined) st.lines[i]._trFail = true; redrawLine(i); });
      if (st.trMode === 'word') glossNear(Math.max(0, st.cur));
      if (idx.length === 12) liveTrSoon(); // more were waiting
    }, rest ? 15000 : 2500);
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
          if (c.s >= o.last) { o.last = c.s; o.e = c.e; if (c.t !== o.t && (b !== a || c.t.length >= o.t.length)) { o.t = c.t; o.dirty = true; } }
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
      });
      // lines that grew / closed after they were shown
      [].concat(this.ctx.recent, o ? [o] : []).forEach(m => {
        if (!m.line) return;
        const l = m.line, e = (isFinite(m.e) ? m.e : Math.max(m.last + 2, m.s + 2)) - off;
        if (!m.dirty && Math.abs(l.end - e) < 0.05) return;
        const k = st.lines.indexOf(l); if (k < 0) return;
        if (m.dirty && l.text !== m.t) { l.text = m.t; l._gl = false; l._trFail = false; l._new = undefined; tagLine(l, { prev: prevOf(st.lines, k) }); liveTrSoon(); }
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
    status(html) { const el = st && st.m && st.m.$('[data-asr-st]'); if (el) el.innerHTML = html; },
    stop() {
      this.on = false; this.queue = []; this.reset();
      this.gen++; this.segs = null; this.done = null; this.acc = null; this.hist = null; this.upTo = 0; this.behind = 0; // the stream reader stops too
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
      // the main way (every browser, iPhone too): the app reads the program's sound track from NRK itself, ahead of the video
      if (st.stream && (st.stream.hls || st.stream.mp3 || st.stream.pcm || (st.stream.blob && !(st.stream.duration > FULL_MAX_SEC)))) {
        this.status(st.stream.live ? '🎧 Распознаю речь эфира — строки появляются через несколько секунд после того, как прозвучали.'
          : `🎧 Распознаю речь ${st.stream.audio ? (st.stream.kind === 'tg' ? 'в записи' : 'выпуска') : st.stream.kind === 'tg' ? 'в видео' : 'передачи'} — строки появятся через несколько секунд и пойдут чуть впереди ${st.stream.audio ? 'звука' : 'видео'}.`);
        this.stream(v ? v.currentTime : 0).catch(() => this.fallback(v));
        return;
      }
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
          this.status('🎧 Нажмите <b>▶</b> — приложение начнёт распознавать речь эфира.');
          await Live.ready();
          if (gen !== this.gen || !st || st.stream !== S) return;
          this.status('🎧 Распознаю речь эфира — строки появляются через несколько секунд после того, как прозвучали.');
        }
        if (!this.segs.placed) { this.segs.forEach(s => { s.start = s.pdt - st.liveOff; }); this.segs.placed = true; }
        if (v) from = v.currentTime || Live.edge(v);
      }
      if (v && !v._asrSeek) { v._asrSeek = true; v.addEventListener('seeked', () => { if (this.on && this.segs && !this.done.has(this.segAt(v.currentTime))) this.stream(v.currentTime).catch(() => {}); }); }
      let i = this.segAt(from), firstOk = false;
      this.acc = null;
      while (gen === this.gen && st && this.on) {
        if (i >= this.segs.length) {
          // live: wait for the next pieces of the broadcast
          if (live) { if (!(await this.more(gen))) await new Promise(r => setTimeout(r, 2000)); continue; }
          await this.flush(gen); this.status(`✅ ${S.audio ? (S.kind === 'tg' ? 'Вся запись распознана' : 'Весь выпуск распознан') : S.kind === 'tg' ? 'Всё видео распознано' : 'Вся передача распознана'}: строк — <b>${this.made}</b>.`); return;
        }
        const now = v ? v.currentTime || 0 : 0;
        if (this.segs[i].start > now + 90) {
          // far enough ahead — unless the video went back to a recognized part: the unrecognized gap after it comes first
          let j = this.segAt(now); while (j < i && this.done.has(j)) j++;
          if (j < i) { i = j; this.acc = null; continue; }
          await new Promise(r => setTimeout(r, 1500)); continue;
        }
        if (this.done.has(i)) { i++; this.acc = null; continue; }
        // recognition can't keep up (slow device / big model on a CPU): the video never waits for it — jump to just
        // ahead of the playhead instead of trailing behind it (the skipped part is recognized if the user goes back there)
        if (v && !v.paused && this.segs[i].start + this.segs[i].dur < now - 1) {
          const j = this.segAt(now + 2);
          if (j > i) { i = j; this.acc = null; this.hist = null; this.behind = (this.behind || 0) + (this.made ? 1 : 0); continue; } // (not counted while the model is still warming up)
        }
        let pcm;
        try { pcm = await this.decode(this.segs[i]); firstOk = true; }
        catch (e) { if (!firstOk) throw e; i++; this.acc = null; continue; } // a single broken piece: skip it
        if (gen !== this.gen || !st) return;
        this.done.add(i);
        await this.push(pcm, this.segs[i].start, gen);
        this.upTo = this.segs[i].start + this.segs[i].dur;
        if (gen === this.gen && st) this.status(`🤖 Строк создано приложением: <b>${this.made}</b> · распознано до ${tLabel(this.upTo)}${this.upTo > now + 5 ? ` — впереди ${S.audio ? 'звука' : 'видео'}` : ''}${this.behind ? ` · ⚠️ распознавание не успевает за ${S.audio ? 'звуком' : 'видео'}, часть фраз пропущена — быстрее: «⚙️ Настройки → 🎙 Распознавание речи → Лёгкое»` : ''}`);
        i++;
      }
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
      }
    },
    async flush(gen) { if (this.acc && this.acc.len > 16000 * 0.8) { const all = new Float32Array(this.acc.len); let o = 0; this.acc.parts.forEach(p => { all.set(p, o); o += p.length; }); await this.say(all, this.acc.t0, this.acc.t0 + this.acc.len / 16000, gen); } this.acc = null; },
    async say(pcm, start, end, gen) {
      // NRK's own lines (sparse subtitles) keep their place: only the sound around them is recognized — a recognized
      // line must not overlap them (nor repeat what they say)
      const own = st ? st.lines.filter(l => !l.auto && l.end > start && l.start < end).sort((a, b) => a.start - b.start) : [];
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
      try { res = await Speech.transcribe(pcm, end - start > 4.5 ? { timestamps: true, raw: true } : { raw: true }); } catch (e) { return; }
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
      let p = null; for (let k = L.length - 1; k >= 0; k--) if (L[k].start <= start) { p = L[k]; break; }
      if (p && p.noWords && start - p.end < 20) { p.end = Math.max(p.end, end); musicHint(); return; }
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
          } catch (e) { this.status('⚠️ Распознавание: ' + U.esc(e.message || e)); }
          if (!st) return;
          text = String(text || '').replace(/\s+/g, ' ').trim();
          if (text && /\p{L}{2}/u.test(text)) this.add(job.start, job.end, text, { music });
          else if (music || this.isMusic(res && res.raw)) this.music(job.start, job.end);
          this.status(`🤖 Строк создано приложением: <b>${this.made}</b>${this.queue.length > 1 ? ' · догоняю…' : ''}`);
        }
      } finally { this.busy = false; }
    },
    add(start, end, text, info) {
      const L = st.lines;
      // «la la la», «♪ … ♪» without words: part of the one music line, not a line of its own
      if (window.LangId && LangId.detect(text, { asr: true }).noWords) { this.music(start, end); return; }
      // rewound: this part was already recognized
      if (L.some(l => Math.min(l.end, end) - Math.max(l.start, start) > 0.5 * (end - start))) return;
      const prev = L[L.length - 1];
      if (prev && prev.auto && U.norm(prev.text) === U.norm(text)) return; // the model repeated itself
      this.made++;
      insertLine(start, end, text, true, info); // its place in the list, translation (live: in batches)
    },
  };

  /* ---------- ⛶ full screen: the video over the whole window, the Norwegian line + translation on top of it ----------
   * The page itself goes full screen (so the word bubble, cards window and messages stay visible) and the video
   * stage covers it; iPhone has no page full screen — there the stage simply covers the whole window. */
  const Full = {
    on: false,
    enter() {
      if (!st || !st.m || this.on) return;
      this.on = true; st.full = true;
      st.m.el.classList.add('subs-full'); document.body.classList.add('subs-fullscreen');
      const de = document.documentElement, req = de.requestFullscreen || de.webkitRequestFullscreen;
      if (req) { try { const p = req.call(de); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not allowed — the window-sized stage stays */ } }
      try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* phones only */ }
      drawNow(); syncFullBtn();
    },
    exit(silent) {
      if (!this.on) return;
      this.on = false; if (st) st.full = false;
      if (st && st.m) st.m.el.classList.remove('subs-full');
      document.body.classList.remove('subs-fullscreen');
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        const ex = document.exitFullscreen || document.webkitExitFullscreen;
        try { const p = ex.call(document); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
      }
      try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* ignore */ }
      if (!silent) syncFullBtn();
    },
    toggle() { if (this.on) this.exit(); else this.enter(); },
  };
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, () => {
    if (Full.on && !(document.fullscreenElement || document.webkitFullscreenElement)) Full.exit(); // Esc of the browser
  }));
  function syncFullBtn() {
    if (!st || !st.m) return;
    st.m.$$('[data-k="full"]').forEach(b => { b.innerHTML = Full.on ? '⤡ Выйти из полного экрана' : '⛶ На весь экран'; b.title = Full.on ? 'Обычный вид (Esc)' : 'Видео на весь экран, субтитры и перевод — поверх видео (F)'; });
    requestAnimationFrame(glassLayout); // the picture moved: the glass follows it
    requestAnimationFrame(ovApply); // subtitles on the video: the window's own size in the normal view
  }

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
    const ov = st.m.$('[data-ov]');
    if (ov) ov.style.bottom = p.on && (Full.on || ovOn()) ? `${(H - h) / 2 + h * p.b / 100 + Math.max(4, h * p.h / 100 * 0.08)}px` : '';
    st.m.$$('[data-k="glass"]').forEach(b => { b.classList.toggle('on', p.on); b.setAttribute('aria-pressed', p.on ? 'true' : 'false'); });
  }
  function glassSet(on) {
    const p = glassPrefs(); p.on = on; glassSave(p); glassLayout();
    if (on) UI.toast('▭ Надписи видео закрыты стеклом — потяните его выше / ниже, если нужно', '', 3500);
  }
  /** the first time: why the glass (the translation modes work only with our own lines, not with text drawn into the picture) */
  function glassToggle() {
    if (glassPrefs().on) { glassSet(false); return; }
    let told = false; try { told = !!localStorage.getItem('nk-glass-told'); } catch (e) { /* ask */ }
    if (told) { glassSet(true); return; }
    let go = false;
    const m = UI.modal({
      title: '▭ Надписи впечатаны в видео', cls: 'narrow glass-modal',
      body: `<p>Если в самом видео видны свои субтитры — они <b>впечатаны в картинку</b>. Это просто изображение: их нельзя перевести и разобрать по словам.</p>
        <p>Режимы <b>«Как есть»</b>, <b>«По предложениям»</b> и <b>«Слово (перевод)»</b> работают только с <b>нашими субтитрами</b>.</p>
        <p>Чтобы читать спокойно, включите <b>матовое стекло</b>: оно закроет надписи видео, а наши строки с переводом идут под видео, а на весь экран — прямо на стекле.</p>
        <p class="small muted">Потяните надпись на стекле — оно сдвинется выше / ниже; ручка сверху делает его толще. Удерживайте надпись — увидите оригинал. Кнопки плеера под стеклом продолжают работать. Для сериала стекло запоминается.</p>`,
      foot: '<button class="btn ghost" data-no>Не сейчас</button><button class="btn primary" data-yes>▭ Включить стекло</button>',
      onClose: () => { try { localStorage.setItem('nk-glass-told', '1'); } catch (e) { /* ok */ } if (go) glassSet(true); },
    });
    m.$('[data-yes]').onclick = () => { go = true; m.close(); };
    m.$('[data-no]').onclick = () => m.close();
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
  /* 💬 the line with its translation ON the video in the normal window too (not only in full screen) — on by default */
  const OVW_KEY = 'nk-ovwin';
  const ovOn = () => { if (!st || st.kind !== 'video' || (st.stream && st.stream.companion)) return false; try { return localStorage.getItem(OVW_KEY) !== '0'; } catch (e) { return true; } };
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
    const live = !!l && t <= lineT(l, 'end') + Math.min(2.5, Math.max(0.8, (lineT(l, 'end') - lineT(l, 'start')) * 0.3)) || (pl && st.cur === st.playLine);
    if (st.m && st.live !== live) {
      st.live = live;
      const ov = st.m.$('[data-ov]'); if (ov) ov.classList.toggle('gone', !live);
      const now = st.m.$('[data-now]'); if (now) now.classList.toggle('gone', !live && !v.paused);
    }
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
    if (st.stream && (st.stream.kind === 'nrk' || st.stream.kind === 'tg') && (v.tagName === 'VIDEO' || v.tagName === 'AUDIO')) {
      if (st.stream.autoAsr) {
        if (st.stream.kind === 'nrk') v.crossOrigin = 'anonymous'; // the sound may be read by the page (NRK serves the stream with CORS *)
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
      // 📍 the place is kept while it plays too (a closed tab / a crash keeps it)
      if (st.media && !(st.stream && st.stream.live)) { st.posTouched = true; if (!st.posTimer) st.posTimer = setInterval(() => { const x = media(); if (x && !x.paused) savePos(); }, 5000); }
    });
    v.addEventListener('ended', () => { if (st && st.media && window.Resume) Resume.clear('media', posId()); }); // finished: nothing to come back to
    v.addEventListener('pause', () => { syncPlayBtn(); tick(); savePos(); ocrChip(true); });
    v.addEventListener('seeked', () => { if (v.paused) ocrChip(true); });
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
        if (box) box.innerHTML = `<div class="mt-warn"><span>⚠️</span><span><b>${S.kind === 'youtube' ? 'YouTube' : S.kind === 'tg' ? 'Telegram' : 'NRK'}: ${U.esc(why)}.</b> ${S.kind === 'tg' ? 'Проверьте, что мост на Mac запущен, и попробуйте снова.' : 'Субтитры и карточки работают и так.'}
          ${S.kind === 'nrk' || S.kind === 'tg' ? '<button class="btn sm" data-k="retry">🔄 Попробовать снова</button>' : ''}
          ${S.link ? `<a href="${U.esc(S.link)}" target="_blank" rel="noopener">↗ ${S.kind === 'youtube' ? 'Смотреть в YouTube' : S.kind === 'tg' ? 'Открыть в Telegram' : S.radio ? 'Слушать в NRK Radio' : 'Смотреть в NRK TV'}</a>` : ''}</span></div>`;
        return;
      }
      if (box) box.innerHTML = `<div class="mt-warn"><span>⚠️</span><span><b>Браузер не может воспроизвести «${U.esc(st.media.name)}».</b> Скорее всего, видео или звук в нём в формате, который этот браузер не понимает (например, MKV с AC-3 / DTS, AVI, WMV). Сохраните его как MP4 (H.264 + AAC) или звук как MP3 / M4A. Субтитры и карточки работают и так — только без звука.</span></div>`;
    });
    if (st.clk) Second.run();
  }

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
    const note = `${where(l)} · ${l.auto ? 'текст распознало приложение (NB-Whisper)' : `субтитры «${st.noFile.name}»`}`;
    // a line the app recognized itself (no subtitles in the program): may contain wrong words → «проверить»
    const asrNote = l.auto ? '\n🤖 Текст распознан приложением по звуку передачи (в ней нет субтитров) — в словах возможны ошибки, проверьте' : '';
    const data = {
      no, ru: word ? word.ru : lineRu, en: !word && l.en ? l.en : '',
      description: (word ? `${where(l)}${word.form && word.form !== word.no ? ` · в тексте: ${word.form}` : ''}` : where(l)) + asrNote,
      example: word ? l.text : '', exampleRu: word ? lineRu : '',
      tags: (word ? ['subtitles', 'word'] : ['subtitles']).concat(l.auto ? ['проверить'] : []),
      history: [Prov.entry('import', 'create', null, note),
        ...(mine ? [] : fromFile ? [Prov.entry('import', 'translate', null, `перевод из субтитров «${st.trFile.name}»`)] : Translators.provKeys(by || []).map(k => Prov.entry(k, 'translate', null, word ? 'перевод слова из субтитров' : 'перевод строки субтитров'))),
        ...verify],
      mtWarn: mine ? false : fromFile ? null : Translators.mtFlag(by || []),
    };
    if (clip) {
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
    // ✈️ a Telegram video: the bridge cuts the line's sound (the author's own voice on the card)
    if (st.stream && st.stream.pcm) {
      try { return { clip: await pcmClip(l), err: '' }; } catch (e) { return { clip: null, err: e.silent ? 'В этом месте видео тишина — карточку озвучит голос приложения' : 'Звук строки не вырезан — карточку озвучит голос приложения' }; }
    }
    // 🎵 a Telegram audio saved on this device: cut from the saved file itself (works without the bridge)
    if (st.stream && st.stream.blob) { try { return { clip: await Clip.get(l), err: '' }; } catch (e) { return { clip: null, err: e.silent ? 'В этом месте записи тишина — карточку озвучит голос приложения' : 'Звук строки не вырезан — карточку озвучит голос приложения' }; } }
    // a stream (YouTube / NRK) can't be cut on the device: the card is voiced by the app's voice, with a link to the moment
    if (!st.media || st.stream) return { clip: null, err: '' };
    try { return { clip: await Clip.get(l), err: '' }; } catch (e) { return { clip: null, err: e.message }; }
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
    st.ocrOpen = true; ocrChip(false);
    FrameOcr.open({
      video: v, at: t, label: whereAt(t), url: S ? (S.at ? S.at(t) : S.link || '') : '',
      key: 'frame:' + (st.media ? st.media.name : ''), deck: deckName(),
      deckId: (Store.decks().find(x => x.subsMedia === (st.media ? st.media.name : '')) || Store.decks().find(x => x.name === deckName()) || {}).id,
      onClose: () => { if (st) { st.ocrOpen = false; ocrChip(true); } },
      onDone: cards => { if (!st) return; cards.forEach(c => st.made.push(Object.assign({}, c, { _clipInfo: '', _clipErr: '' }))); afterMade(); },
    });
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
    const goesOn = k => k >= 0 && k < L.length - 1 && !SENT_END.test(cueText(L[k].text)) && L[k + 1].start - L[k].end < 1.6 && !skipTr(L[k]) && !skipTr(L[k + 1]);
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
    const need = [...new Set(list.filter(p => !p.ruFile && trOf(p) === undefined).map(p => p.text))];
    for (let k = 0; k < need.length; k += 250) await Study.translateUnits(need.slice(k, k + 250), []);
  }
  const markParts = p => (p.parts || []).forEach(k => { if (st.lines[k]) { st.lines[k]._made = true; redrawLine(k); } });

  async function addLine(i, btn) {
    const l0 = st.lines[i]; if (!l0 || st.busy) return;
    Clip.prime();
    if (l0._made) { UI.toast('Эта строка уже в карточках', '', 1800); return; }
    if (skipTr(l0)) { UI.toast(l0.noWords ? 'Здесь музыка без слов — карточку не сделать' : `Строка не на языке, который вы учите, — карточку не делаем. Если это ${learnName()} — нажмите «перевести» у строки.`, '', 3500); return; }
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
    const skipped = idx.filter(i => skipTr(st.lines[i])).length;
    idx = idx.filter(i => st.lines[i] && !st.lines[i]._made && !skipTr(st.lines[i]));
    if (!idx.length) { UI.toast(skipped ? 'В отмеченных строках нет строк на языке, который вы учите' : 'Все эти строки уже в карточках', '', 2200); return; }
    Clip.prime();
    const MAX = 150;
    if (idx.length > MAX) { UI.toast(`За один раз — до ${MAX} строк; беру первые ${MAX}`, 'warn', 4000); idx = idx.slice(0, MAX); }
    // say it before: the translation of the lines is a machine one, 🤖 lines were recognized by the app — cards get marked
    const autoN = idx.filter(i => st.lines[i].auto).length;
    const nCards = new Set(idx.map(i => U.norm(phrase(i).text))).size; // several ticked lines of one sentence → one card
    if (!hasRuFile() || autoN) {
      const mt = !hasRuFile() ? `⚠️ <b>Перевод строк — машинный</b> (${U.esc(Translators.provNames(Translators.dictOrder().slice(0, 1)))}): обычные фразы он переводит в основном верно, а выражения и идиомы — часто дословно. Карточки получат пометку <b>«перепроверьте»</b>.` : '';
      const asr = autoN ? `🤖 <b>${autoN}</b> ${U.plural(autoN, ['строку', 'строки', 'строк'])} распознало приложение (в передаче нет субтитров) — в словах возможны ошибки, такие карточки получат пометку <b>«проверить»</b>.` : '';
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
      const ctx = window.Study && Study.glossInfo ? Study.glossInfo(gs, k, lineRu) : null;
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
          } catch (e) { me.err = e.message; }
        }
      }
      if (wp !== me) return;
      const box = el.querySelector('[data-wtr]');
      const src = { user: '✓ ваш перевод', ai: '🤖 по смыслу строки', align: 'из перевода строки', dict: 'словарик' }[me.how]
        || `перевод слова без контекста — может не совпадать по смыслу${me.by.length ? ' · ' + Translators.provNames(me.by) : ''}`;
      if (box) box.innerHTML = me.ru ? `<b class="sp-ru">${U.esc(me.ru)}</b>${me.how === 'guess' ? '?' : ''}<div class="tiny muted sp-ctx${me.how === 'guess' ? ' unsure' : ''}">${U.esc(src)}</div>` : `<span class="muted">перевод не пришёл${me.err ? ': ' + U.esc(me.err) : ''}</span>`;
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
  function setMedia(f) {
    if (st.mediaUrl) URL.revokeObjectURL(st.mediaUrl);
    Clip.reset();
    st.media = f; st.mediaUrl = URL.createObjectURL(f); st.dur = 0; st.restored = false; st.posTouched = false;
    st.kind = AUDIO_EXT.test(f.name) || /^audio\//.test(f.type) ? 'audio' : 'video';
  }
  function buildLines() {
    if (!st.noCues) { st.lines = []; return; }
    st.lines = st.noCues.map(c => ({ start: c.start, end: c.end, text: c.text, ruFile: '', en: '' }));
    if (st.trCues) pairUp(st.lines, st.trCues, st.trLang);
    if (st.stream) tagAll(false); // (own subtitle files: as they are)
    st.cur = -1; st.checked.clear();
    markMade();
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
    if (st.stage === 'load') { body.innerHTML = loadHtml(); return; }
    const keepT = (() => { const v = media(); return v && v.src === st.mediaUrl ? v.currentTime : 0; })();
    body.innerHTML = playerHtml();
    bindMedia();
    glassWire();
    ovApply();
    svHint(); // a gentle reminder that the subtitle look can be changed (until it has been used once)
    if (st.stream && window.TrNotice) TrNotice.badge(); // «кто переводит» stays visible after every redraw
    const v = media(); if (v && keepT) { try { v.currentTime = keepT; } catch (e) { /* not loaded yet */ } }
    const list = st.m.$('[data-list]');
    ['wheel', 'touchmove'].forEach(ev => list.addEventListener(ev, () => { st.userScrollT = Date.now(); hidePop(); }, { passive: true }));
    list.addEventListener('scroll', () => { if (wp) hidePop(); }, { passive: true });
    const c = st.cur; st.cur = -2; setCur(c);
    drawNow(); countSel();
    prefetch();
    if (window.Levels) Levels.subsBar(st.m.$('[data-lv-subs]')); // 🪜 «в этой передаче N слов уровня A2…» (opt-in)
  }
  function onClick(e) {
    const t = e.target;
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
      else if (a === 'retry') retryStream();
      else if (a === 'tv') tvHelp();
      else if (a === 'glass') glassToggle();
      else if (a === 'ocr') ocrFrame();
      else if (a === 'ovwin') ovToggle();
      else if (a === 'subview') svPanel();
      else if (a === 'trcycle') {
        const order = ['show', 'blur', 'hide'];
        setTrMode(order[(order.indexOf(st.trMode) + 1) % 3]);
      }
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
    const r = t.closest('[data-rate]');
    if (r) { setRate(+r.dataset.rate); return; }
    const tm = t.closest('[data-trmode]');
    if (tm) { setTrMode(tm.dataset.trmode); return; }
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
    if (t.closest('[data-trall]')) {
      const btn = t.closest('[data-trall]'); btn.disabled = true;
      translate(st.lines.map((l, i) => i)).then(() => { if (st && st.m) { st.lines.forEach((l, i) => { l._trFail = false; redrawLine(i); }); btn.disabled = false; } });
    }
  }
  function setTrMode(mode) {
    const wasWord = st.trMode === 'word';
    st.trMode = mode;
    if (wasWord !== (mode === 'word')) { st.lines.forEach((x, i) => redrawLine(i)); if (mode === 'word') glossNear(Math.max(0, st.cur)); else glossProg(''); }
    try { localStorage.setItem('nk-subs-tr', mode); } catch (_) { /* full */ }
    st.m.el.dataset.tr = mode;
    st.m.$$('[data-trmode]').forEach(b => b.classList.toggle('active', b.dataset.trmode === mode));
    st.m.$$('[data-k="trcycle"]').forEach(b => { b.textContent = `Aa ${mode === 'show' ? 'RU' : mode === 'blur' ? 'RU ░' : 'RU ✕'}`; }); // also when changed under the video
  }

  /* ---------- 📺 «Подключиться к телевизору»: one window, the list of TVs (like YouTube's cast button) ----------
   * The Mac bridge finds Chromecast / Android TV / Google TV on the home network and makes the chosen TV play the
   * program itself — with our subtitles (Norwegian + Russian). Works from any browser on the Mac (Safari too). */
  /** a short fingerprint of the subtitles sent to the TV (to notice when the screen has newer translations) */
  const vttHash = s => { let h = 0; s = String(s || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
  async function castApi(action, body) {
    if (action === 'play' && body && body.vtt && st) { st.tvVttHash = vttHash(body.vtt); st.tvStyleKey = body.style ? JSON.stringify(body.style) : null; }
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
  function tvHelp() {
    const S = st.stream || {};
    const canCast = S.kind === 'nrk' || S.kind === 'youtube';
    const bridge = window.AI && AI.bridge && AI.bridge.up;
    const m = UI.modal({
      title: `${UI.TV_SVG(24)} Подключиться к телевизору`, cls: 'tv-modal',
      body: `<div data-tv></div><button class="btn sm ghost tv-other" data-tv-other>Другие способы (повтор экрана, AirPlay)</button>`,
    });
    const box = m.$('[data-tv]');
    m.$('[data-tv-other]').onclick = () => { m.close(); setTimeout(tvOther, 220); };
    if (!canCast) { box.innerHTML = `<div class="tv-msg">${S.kind === 'tg' ? 'Видео из Telegram идёт через мост на этом Mac — телевизор открыть его сам не может.' : 'Свои файлы с этого Mac телевизор открыть не может.'} Используйте повтор экрана — «Другие способы» ниже.</div>`; return; }
    // live: our subtitles are made on the fly here — a TV playing the stream itself would show it without them
    if (S.live) { box.innerHTML = `<div class="tv-msg">📡 <b>Прямой эфир приложение на телевизор не отправляет:</b> наши субтитры к эфиру появляются на ходу, и телевизор показал бы эфир <b>без них</b>. Смотрите эфир на телевизоре в приложении NRK — или повторите экран этого устройства (тогда будут и субтитры, и перевод): «Другие способы» ниже.</div>
      <a class="btn" href="${U.esc(S.link)}" target="_blank" rel="noopener">↗ Открыть в NRK</a>`; return; }
    if (!bridge) { box.innerHTML = '<div class="tv-msg">Отправка на телевизор работает через мост на Mac — запустите его (python3 …/bridge/server.py). Пока можно использовать повтор экрана — «Другие способы» ниже.</div>'; return; }
    const devHtml = list => list.length
      ? `<div class="tv-hint small muted">Выберите телевизор:</div>
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
        } else box.innerHTML = `<div class="tv-msg">⚠️ ${U.esc(e.message)}</div><button class="btn" data-tv-rescan>🔄 Попробовать снова</button>`;
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
        <span class="tv-hourglass" aria-hidden="true">⏳</span><span class="grow"><b data-tv-step></b><small data-tv-sub></small></span></div>`);
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
  const tvPrefs = () => {
    let p = {}; try { p = JSON.parse(localStorage.getItem(TV_KEY) || '{}'); } catch (e) { /* defaults */ }
    // gl: how big the (перевод) after each word is — 'same' as the word, 'mid', 'small' (the old look)
    p = Object.assign({ mode: 'sent', no: '#ffffff', ru: '#ffd84d', size: 'm', bg: true, gl: 'small' }, p);
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
      m.$('[data-sv]').innerHTML = `
        <div class="sv-preview ${p.bg ? 'bg' : ''}" style="--pv-scale:${sc};--pv-gl:${g}">
          <div class="sv-pv-no" style="color:${p.no}">Jeg <span class="sv-pv-gl" style="color:${p.ru}">(я)</span> vet <span class="sv-pv-gl" style="color:${p.ru}">(знаю)</span> hvem <span class="sv-pv-gl" style="color:${p.ru}">(кто)</span> jeg <span class="sv-pv-gl" style="color:${p.ru}">(я)</span> er. <span class="sv-pv-gl" style="color:${p.ru}">(есть)</span></div>
          <div class="sv-pv-ru" style="color:${p.ru}">(Я знаю, кто я.)</div></div>
        <div class="cast-row"><span class="small muted cast-lab">Размер текста:</span>${seg('size', [['s', 'A−'], ['m', 'A'], ['l', 'A+'], ['xl', 'A++']])}</div>
        <div class="cast-row"><span class="small muted cast-lab">Перевод слов в скобках:</span>${seg('gl', [['same', 'как слова'], ['mid', 'чуть меньше'], ['small', 'мелко']])}</div>
        <div class="cast-row"><span class="small muted cast-lab">Норвежский:</span>${TV_COLORS.map(([h, l]) => sw('no', h, l)).join('')}${pick('no')}</div>
        <div class="cast-row"><span class="small muted cast-lab">Перевод:</span>${TV_COLORS.map(([h, l]) => sw('ru', h, l)).join('')}${pick('ru')}</div>
        <label class="cast-bg"><input type="checkbox" data-svbg ${p.bg ? 'checked' : ''}> тёмная подложка под текстом на видео</label>
        <p class="tiny muted">Цвета и размер — те же и на телевизоре. Цвета применяются к строке на видео (на тёмном фоне); под видео и в списке текст остаётся в цветах темы, чтобы всегда читался.</p>`;
    };
    const set = (key, val) => { const p = tvPrefs(); p[key] = val; tvSave(p); svApply(); draw();
      const cb = st && st.m && st.m.$('[data-castbar]'); if (cb && cb._draw) cb._draw(); }; // the TV bar shows the same choice
    svHintDone('used'); // found it: the dot and the reminders stop for good
    m = UI.modal({ title: 'Aa Вид субтитров', cls: 'narrow sv-modal', body: '<div data-sv></div>', foot: '<button class="btn primary" data-sv-ok>Готово</button>' });
    draw();
    m.$('[data-sv-ok]').onclick = () => m.close();
    m.el.addEventListener('click', e => { const b = e.target.closest('[data-svp]'); if (b) set(b.dataset.svp, b.dataset.v); });
    m.el.addEventListener('change', e => {
      if (e.target.matches('[data-svbg]')) set('bg', e.target.checked);
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
        await Study.translateUnits([], st.lines.filter(l => !skipTr(l)).map(l => ({ s: cueText(l.text), ru: trOf(l) || '' })), { quiet: true, onProgress: onWords });
        if (st) st.lines.forEach(l => { l._gl = true; });
      }
    } catch (e) { /* lines without a translation go as they are */ }
  }
  /** WebVTT for the TV in the chosen mode and colours */
  function tvVtt() {
    if (!st || !st.lines.length) return '';
    const p = tvPrefs();
    const ve = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const ts = t => { t = Math.round(Math.max(0, t) * 1000) / 1000; const h = Math.floor(t / 3600), mm = Math.floor(t % 3600 / 60), ss = (t % 60).toFixed(3).padStart(6, '0'); return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${ss}`; };
    // any colour: the exact one in a STYLE block (::cue), plus the nearest standard class for players that ignore it
    const noC = 'nkno.' + vttNamed(p.no), ruC = 'nkru.' + vttNamed(p.ru);
    const c = (cls, s) => `<c.${cls}>${ve(s)}</c>`;
    const cues = st.lines.map((l, i) => {
      const sk = skipTr(l), no = l.noWords ? '♪ ♪ ♪' : cueText(l.text), ru = String(trOf(l) || '').replace(/\n+/g, ' ').trim();
      let txt;
      if (p.mode === 'word' && !sk) txt = tvWrap(glossText(no, ru).replace(/ ?\((?:[^()]|\([^()]*\))*\)/g, g => g.replace(/ /g, '\u0001')), 44) // a word and its (перевод) stay on one line
        .map(x => `<c.${noC}>${ve(x.replace(/\u0001/g, ' ')).replace(/\(((?:[^()]|\([^()]*\))*)\)/g, `</c><c.${ruC}>($1)</c><c.${noC}>`)}</c>`.replace(/<c\.[\w.]+><\/c>/g, '')).join('\n')
        // and the whole line's translation under it — as on the computer's screen
        + (ru ? '\n' + tvWrap(`(${ru})`, 44).map(x => c(ruC, x)).join('\n') : '');
      else txt = tvWrap(no, 38).map(x => c(noC, x)).join('\n') + (p.mode === 'sent' && ru ? '\n' + tvWrap(ru, 40).map(x => c(ruC, x)).join('\n') : '');
      // «line:90%,end»: the BOTTOM of the block stays at 90% — a tall block (words + the line's translation) grows upwards,
      // never off the bottom edge of the TV
      return `${i + 1}\n${ts(lineT(l, 'start'))} --> ${ts(lineT(l, 'end'))} line:90%,end position:50% align:center size:92%\n${txt}\n`;
    });
    return `WEBVTT\n\nSTYLE\n::cue(.nkno) { color: ${p.no}; }\n::cue(.nkru) { color: ${p.ru}; }\n\n` + cues.join('\n');
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
      if (++n % 8 === 0 && st.tvVttHash && !st.castInfo.youtube) {
        const stale = vttHash(tvVtt()) !== st.tvVttHash || (st.tvStyleKey != null && JSON.stringify(tvStyle(tvPrefs())) !== st.tvStyleKey), bar = st.m.$('[data-castbar]'); // the size (A−…A++) is in the style
        let note = bar && bar.querySelector('[data-tvstale]');
        if (stale && bar && !note) {
          note = document.createElement('div'); note.className = 'cast-lost cast-stale'; note.dataset.tvstale = '';
          note.innerHTML = '<span>📝 Субтитры на экране изменились (перевод, цвет или размер) — на телевизоре пока прежние.</span><button class="btn sm primary" data-tvc="refresh">🔄 Обновить субтитры на телевизоре</button>';
          bar.prepend(note);
        } else if (!stale && note) note.remove();
      }
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
          <button class="btn sm" data-tvc="pause">⏸ Пауза</button><button class="btn sm" data-tvc="play">▶ Продолжить</button>
          <button class="btn sm bad" data-tvc="stop">⏹ Стоп</button></div>
        ${youtube ? '<div class="small muted">Видео YouTube идёт в приложении YouTube на телевизоре — наши субтитры там не показываются.</div>' : `
        <div class="cast-row"><span class="small muted">Субтитры:</span>
          <span class="seg-mini sm">${[['asis', 'Как есть'], ['sent', 'По предложениям'], ['word', 'Слово (перевод)'], ['off', 'выкл']].map(([k, t]) => `<button data-tvp="mode" data-v="${k}" class="${(p.mode === k) ? 'active' : ''}">${t}</button>`).join('')}</span></div>
        <div class="cast-row"><span class="small muted cast-lab">Норвежский:</span>${TV_COLORS.map(([h, l]) => sw('no', h, l)).join('')}${pick('no')}</div>
        <div class="cast-row"><span class="small muted cast-lab">Перевод:</span>${TV_COLORS.map(([h, l]) => sw('ru', h, l)).join('')}${pick('ru')}</div>
        <div class="cast-row"><span class="small muted cast-lab">Так будет:</span><span class="tv-preview ${p.bg ? 'bg' : ''}"><span style="color:${p.no}">Hei, hvordan går det?</span><span style="color:${p.ru}">Привет, как дела?</span></span></div>
        <div class="cast-row"><span class="small muted">Размер:</span><span class="seg-mini sm">${[['s', 'A−'], ['m', 'A'], ['l', 'A+'], ['xl', 'A++']].map(([k, t]) => `<button data-tvp="size" data-v="${k}" class="${p.size === k ? 'active' : ''}">${t}</button>`).join('')}</span>
          <label class="cast-bg"><input type="checkbox" data-tvbg ${p.bg ? 'checked' : ''}> тёмная подложка под текстом</label>
          <span class="tiny muted">изменения применяются на телевизоре за 2–3 секунды</span></div>`}`;
      if (st.castLost) lostNote();
    };
    draw(); el._draw = draw; // the Aa window redraws it after a change there
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
      if (!e.target.matches('[data-tvbg]')) return; const p = tvPrefs(); p.bg = e.target.checked; tvSave(p); draw(); svApply(); await tvRecast(el);
    };
  }
  /** other ways: screen mirroring, AirPlay (and the Chrome cast SDK) */
  function tvOther() {
    const S = st.stream || {};
    const ua = navigator.userAgent;
    const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const mac = /Macintosh/.test(ua) && !iOS, android = /Android/.test(ua);
    const chrome = /Chrome|CriOS|Edg/.test(ua) && !/OPR/.test(ua);
    const v = st.m.$('video[data-media]');
    const airplay = v && typeof v.webkitShowPlaybackTargetPicker === 'function' && !(st.hls); // native video only (not hls.js / YouTube)
    const steps = [];
    if (chrome && !iOS && !android) steps.push(['🖥 Chrome на компьютере → любой телевизор с Chromecast', 'Меню Chrome <b>⋮</b> → <b>Трансляция, сохранение и отправка</b> → <b>Трансляция…</b> → выберите телевизор. Источник: <b>«Транслировать вкладку»</b>. Затем здесь <b>⛶ На весь экран</b>.']);
    if (mac) steps.push(['🍎 Mac → Apple TV или телевизор с AirPlay (Samsung, LG, Sony…)', 'Пункт управления (два переключателя в строке меню) → <b>Повтор экрана</b> → выберите телевизор. Затем здесь <b>⛶ На весь экран</b>. <i>Android-приставки AirPlay не принимают.</i>']);
    if (iOS) steps.push(['📱 iPhone / iPad → Apple TV или телевизор с AirPlay', 'Пункт управления → <b>Повтор экрана</b> → выберите телевизор, затем здесь <b>⛶ На весь экран</b>. <i>Android-приставки AirPlay не принимают.</i>']);
    if (android) steps.push(['🤖 Android → Chromecast / Android TV / Google TV', 'Быстрые настройки (смахните вниз) → <b>Трансляция экрана</b> → выберите телевизор. Затем здесь <b>⛶ На весь экран</b>.']);
    if (!steps.length) steps.push(['📺 Любой телевизор', 'Включите на устройстве повтор (трансляцию) экрана на телевизор, затем здесь нажмите <b>⛶ На весь экран</b>.']);
    const castable = S.kind === 'nrk' && Cast.supported();
    // the main way: like the cast button in YouTube — Chrome shows the list of TVs (Chromecast / Android TV / Google TV)
    const castBlock = S.kind === 'nrk'
      ? (castable
        ? `<button class="btn primary lg tv-cast" data-tv-cast>📡 Выбрать телевизор <small>Chromecast · Android TV · Google TV</small></button>
           <div class="small muted tv-cast-note">Передача пойдёт прямо на приставку (её же плеером), с субтитрами: норвежская строка + русский перевод. Здесь останется пульт: пауза, субтитры, стоп.</div>`
        : `<div class="tv-step tv-main"><b>📡 Android-приставка, Chromecast, Google TV — со списком телевизоров, как в YouTube</b>
             <div class="small">${iOS ? 'На iPhone и iPad браузеры не умеют отправлять видео на Chromecast — это запрет Apple. Откройте приложение на компьютере в <b>Google Chrome</b> — или смотрите передачу в приложении NRK TV (↗): у него есть кнопка трансляции, но без наших субтитров и перевода.'
               : `Эта кнопка работает в браузере <b>Google Chrome</b> (на Mac, Windows, Android) — в ${/Safari/.test(ua) && !chrome ? 'Safari' : 'этом браузере'} её нет. Откройте это же приложение в Chrome: адрес <b>${U.esc(location.origin)}</b> — там здесь появится «📡 Выбрать телевизор».`}</div>
             ${iOS ? '' : '<button class="btn sm" data-tv-copy>📋 Скопировать адрес для Chrome</button>'}</div>`)
      : S.kind === 'youtube'
        ? `<div class="tv-step tv-main"><b>▶ Видео YouTube на телевизор</b><div class="small">Нажмите значок трансляции <b>в самом плеере YouTube</b> (правый верхний угол видео) и выберите телевизор — видео откроется в приложении YouTube на телевизоре, <b>без наших субтитров</b>. С субтитрами и переводом — повтором экрана (ниже).</div></div>`
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
      if (e.target.closest('[data-tv-copy]')) { try { await navigator.clipboard.writeText(location.origin + '/'); UI.toast('Адрес скопирован — вставьте его в Google Chrome', 'good'); } catch (err) { UI.toast('Адрес: ' + location.origin, '', 6000); } }
      const c = e.target.closest('[data-tv-cast]');
      if (c) {
        c.disabled = true; const label = c.innerHTML; c.innerHTML = '<span class="spinner sm"></span> ищу телевизоры…';
        try { const ok = await Cast.start(); if (ok) m.close(); }
        catch (err) { UI.toast('Трансляция: ' + err.message, 'bad', 6000); }
        if (c.isConnected) { c.disabled = false; c.innerHTML = label; }
      }
    });
  }

  /* ---------- 📡 Google Cast (Chrome): the TV list like in YouTube → the NRK stream plays on the TV itself ----------
   * Default Media Receiver (no registration). Subtitles go along as text tracks: «Norsk + русский» (our lines with the
   * translation, built here) and «Norsk (NRK)» (NRK's own file) — switchable from the remote bar here. */
  // the Cast App ID of OUR TV page (receiver.html on the site's https domain, registered once in the Google Cast SDK
  // Developer Console). Empty = Google's standard receiver with the subtitles as a text track.
  const CAST_APP_ID = '';
  const CAST_NS = 'urn:x-cast:no.norskkort.subs';
  const Cast = {
    ready: null,
    appId() { return (Store.settings.castAppId || CAST_APP_ID || '').trim(); },
    /** our TV page: the lines go as messages (≤ 64 KB each) — [start, end, norwegian, russian] */
    async sendCues(ses) {
      const cues = st.lines.map(l => [+lineT(l, 'start').toFixed(2), +lineT(l, 'end').toFixed(2), cueText(l.text), String(trOf(l) || '').replace(/\n+/g, ' ')]);
      for (let k = 0; k < cues.length || k === 0; k += 150) {
        await ses.sendMessage(CAST_NS, { reset: k === 0, cues: cues.slice(k, k + 150) });
        if (!cues.length) break;
      }
    },
    supported() {
      const ua = navigator.userAgent;
      return /Chrome|CriOS|Edg/.test(ua) && !/iPhone|iPad|iPod|OPR|SamsungBrowser/.test(ua) && window.isSecureContext;
    },
    load() {
      if (window.cast && cast.framework) return Promise.resolve();
      if (this.ready) return this.ready;
      this.ready = new Promise((res, rej) => {
        window.__onGCastApiAvailable = ok => {
          if (ok && window.cast && cast.framework) {
            // our own TV page (receiver.html, draws the Norwegian + Russian lines) once it is registered; else Google's player
            cast.framework.CastContext.getInstance().setOptions({ receiverApplicationId: this.appId() || chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID, autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED });
            res();
          } else rej(new Error('трансляция в этом браузере недоступна'));
        };
        const s = document.createElement('script');
        s.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
        s.onerror = () => { this.ready = null; rej(new Error('модуль трансляции Google не загрузился (нужен интернет)')); };
        document.head.appendChild(s);
        setTimeout(() => rej(new Error('модуль трансляции не ответил')), 15000);
      });
      this.ready.catch(() => { this.ready = null; });
      return this.ready;
    },
    /** our lines as WebVTT: the Norwegian line + the Russian translation under it */
    /** WebVTT text: every line = the Norwegian line + the Russian translation under it */
    vttText() {
      // whole milliseconds first: 119.99999999999999 (recognized lines) gave «00:01:60.000» — a broken cue
      const ts = t => { t = Math.round(Math.max(0, t) * 1000) / 1000; const h = Math.floor(t / 3600), mm = Math.floor(t % 3600 / 60), ss = (t % 60).toFixed(3).padStart(6, '0'); return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${ss}`; };
      const body = st.lines.map((l, i) => { const ru = trOf(l); return `${i + 1}\n${ts(lineT(l, 'start'))} --> ${ts(lineT(l, 'end'))}\n${cueText(l.text)}${ru ? '\n' + cueText(String(ru)) : ''}\n`; }).join('\n');
      return 'WEBVTT\n\n' + body;
    },
    dualVtt() { return 'data:text/vtt;base64,' + btoa(unescape(encodeURIComponent(this.vttText()))); },
    /** → true when the TV plays */
    async start(at) {
      const S = st && st.stream; if (!S || S.kind !== 'nrk') return false;
      await this.load();
      const ctx = cast.framework.CastContext.getInstance();
      // still connected (e.g. the TV only closed the paused program): no device picker again — straight on
      if (!(at != null && ctx.getCurrentSession())) {
        try { await ctx.requestSession(); } catch (e) { if (e === 'cancel' || e === chrome.cast.ErrorCode.CANCEL) return false; throw new Error('не удалось подключиться к телевизору'); }
      }
      const ses = ctx.getCurrentSession(); if (!ses || !st) return false;
      if (at != null && S.fresh) { try { const u = await S.fresh(); if (u) S.hls = u; } catch (e) { /* the old address */ } }
      if (!hasRuFile() && st.lines.length) { try { await translate(st.lines.map((l, i) => i), true); } catch (e) { /* lines without translation go as they are */ } }
      const C = chrome.cast.media;
      const mi = new C.MediaInfo(S.hls, 'application/x-mpegurl');
      mi.streamType = C.StreamType.BUFFERED;
      if (C.HlsSegmentFormat) mi.hlsSegmentFormat = C.HlsSegmentFormat.TS;
      const md = new C.GenericMediaMetadata(); md.title = S.title; md.subtitle = S.channel || 'NRK TV'; mi.metadata = md;
      const custom = !!this.appId();
      if (custom) { try { await this.sendCues(ses); } catch (e) { /* the TV page draws nothing — the video still plays */ } }
      const tracks = [];
      const mk = (id, url, name) => { if (custom) return; /* our TV page draws the lines itself */ const t = new C.Track(id, C.TrackType.TEXT); t.trackContentId = url; t.trackContentType = 'text/vtt'; t.subtype = C.TextTrackType.SUBTITLES; t.name = name; t.language = 'nb'; tracks.push(t); };
      if (st.lines.length) mk(1, this.dualVtt(), 'Norsk + русский');
      if (S.nrkVtt) mk(2, S.nrkVtt, 'Norsk (NRK)');
      mi.tracks = tracks;
      const style = new C.TextTrackStyle();
      style.backgroundColor = '#00000099'; style.foregroundColor = '#FFFFFFFF'; style.fontScale = 1.15;
      style.edgeType = C.TextTrackEdgeType.DROP_SHADOW; style.edgeColor = '#000000FF';
      mi.textTrackStyle = style;
      const req = new C.LoadRequest(mi);
      const v = media();
      req.currentTime = at != null ? at : v ? v.currentTime || 0 : 0; req.autoplay = true;
      this.t = req.currentTime;
      req.activeTrackIds = tracks.length ? [tracks[0].trackId] : [];
      await ses.loadMedia(req);
      if (v && !v.paused) v.pause();
      this.bar(ses, tracks);
      return true;
    },
    /** the remote under the video while the TV plays */
    bar(ses, tracks) {
      if (!st || !st.m) return;
      const name = (ses.getCastDevice() || {}).friendlyName || 'телевизор';
      const box = st.m.$('.subs-view'); if (!box) return;
      let el = st.m.$('[data-castbar]');
      if (!el) { el = document.createElement('div'); el.className = 'cast-bar'; el.dataset.castbar = ''; box.after(el); }
      el.innerHTML = `<span class="cast-live">📡 На телевизоре «${U.esc(name)}»</span>
        <button class="btn sm" data-cast="pp">⏯ Пауза / продолжить</button>
        <span class="seg-mini sm" title="Субтитры на телевизоре">${tracks.map(t => `<button data-cast-tr="${t.trackId}" class="${t.trackId === tracks[0].trackId ? 'active' : ''}">${U.esc(t.name)}</button>`).join('')}<button data-cast-tr="0">без субтитров</button></span>
        <button class="btn sm bad" data-cast="stop">⏹ Остановить трансляцию</button>`;
      // remember where the TV is: if its player closes a long-paused program, ⏯ starts it again from there
      if (this.timer) clearInterval(this.timer);
      this.timer = setInterval(() => {
        if (!st || !el.isConnected) { clearInterval(this.timer); this.timer = 0; return; }
        const ms = ses.getMediaSession && ses.getMediaSession();
        if (ms && ms.playerState !== chrome.cast.media.PlayerState.IDLE) { const t = ms.getEstimatedTime ? ms.getEstimatedTime() : ms.currentTime; if (t > 0) this.t = t; }
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
          cast.framework.CastContext.getInstance().endCurrentSession(true); clearInterval(this.timer); this.timer = 0; el.remove();
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
    else if (b.dataset.wp === 'say') TTS.speak(wp.form, 'no');
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

  /* =================== public API =================== */
  const Subs = {
    /** 🎬 the window; files (optional): File[] to start with */
    open(files) {
      if (st && st.m) { try { st.m.close(); } catch (e) { /* ignore */ } }
      if (window.TTS) TTS.stop();
      st = fresh();
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
          Full.exit(true);
          if (s.castTimer) { clearInterval(s.castTimer); s.castTimer = 0; } // the TV plays on; this window stops following it
          if (s.hls) { try { s.hls.destroy(); } catch (e) { /* ignore */ } s.hls = null; }
          if (s.raf) cancelAnimationFrame(s.raf);
          if (s.posTimer) { clearInterval(s.posTimer); s.posTimer = 0; }
          Clip.reset();
          if (s.mediaUrl) setTimeout(() => URL.revokeObjectURL(s.mediaUrl), 500);
          hidePop();
          s.cleanup.forEach(f => f());
          st = null;
        },
      });
      m.el.addEventListener('click', onClick);
      m.el.addEventListener('change', onChange);
      m.el.addEventListener('input', onInput);
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => listen(window, ev, onDrag, true));
      listen(window, 'keydown', onKey, true);
      listen(window, 'keyup', onKeyUp, true);
      listen(document, 'mousedown', onDocDown, false);
      listen(document, 'touchstart', onDocDown, { passive: true });
      listen(document, 'click', onPopClick, true);
      listen(window, 'nk-userfix', e => redrawText(e.detail && e.detail.sent));
      render();
      if (files && files.length) addFiles(files);
      return m;
    },
    close() { if (st && st.m) st.m.close(); },
    isOpen() { return !!(st && st.m); },

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
      if (!(window.AI && AI.bridge && AI.bridge.up)) throw Object.assign(new Error('нужен мост на Mac (python3 bridge/server.py) — в облачной версии появится позже'), { noBridge: true });
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
      if (window.TrNotice) setTimeout(() => { if (st && st.stream === src) TrNotice.maybe(src); }, 350);
      return st.m;
    },

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

    /* ---------- internals (tests) ---------- */
    _ocrFrame: () => ocrFrame(), _whereAt: t => whereAt(t),
    _parse: parseSubs, _decode: decodeSub, _detect: detectLang, _pair: pairUp, _clip: Clip, _wav: wavBytes, _asr: Asr, _cast: Cast, _phrase: i => phrase(i),
    _tv: { tvVtt, tvPrefs, tvSave, glossText, castBar },
    _live: { Live, LiveSubs, mediaPlaylist, parseMedia, tsPts, mp3Frames, mp3Hdr, insertLine },
    _lang: { tagLine, skipTr, langOk, musicHint },
    get _st() { return st; },
  };

  window.Subs = Subs;
})();
