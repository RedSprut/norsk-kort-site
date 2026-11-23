/* ============ 🎧 Listening extras: where to listen, volume, voice commands, sleep timer, «знаю / не знаю», offline ============
 * On top of Listen (js/listen.js — the one <audio> element that keeps playing with the iPhone locked) and used by
 * ListenUI (js/listenui.js — «Сейчас играет», «Что послушать?»):
 *  - ListenX.where()        «Где слушать?» — 🎧 in the headphones (pocket mode) or 🔊 through the speaker; on computers
 *                           whose browser lets a page choose (Chrome / Edge: setSinkId; Firefox: selectAudioOutput) also
 *                           the output device: speakers, headphones, Bluetooth, TV;
 *  - volume                 a big slider + «тише / громче». The iPhone ignores audio.volume and routing the <audio> through
 *                           Web Audio (createMediaElementSource) is NOT used: on iOS the AudioContext is suspended in the
 *                           background / with the screen locked (WebKit bugs 261554, 291892; 211394 / 203435) and a
 *                           cross-origin voice clip (the free Google voice) would come out as silence. So the volume is
 *                           baked into the samples Listen renders itself (the master stays untouched; the part that plays
 *                           is re-made in a few ms) and into clips of our own (cloud voice / downloaded); where the browser
 *                           honours audio.volume (computers, Android) that is used too, at once;
 *  - voice commands         opt-in, Web Speech API: тише, громче, пауза, продолжи, дальше, назад, повтори, стоп,
 *                           знаю, не знаю, «таймер на 30 минут»; optional wake word «Норск»; only while the page is visible
 *                           and the 🗣 interpreter does not hold the microphone.
 *                           Language of the commands (one recognizer can listen to only one language):
 *                             «Язык перевода» uk → uk-UA (тихіше, голосніше, пауза, продовжуй, далі, назад, повтори, стоп,
 *                             знаю, не знаю, «таймер на 30 хвилин»); ru and both → ru-RU (the app speaks Russian to the user;
 *                             the Russian recognizer also catches the Ukrainian words that sound alike: пауза, стоп, назад,
 *                             знаю, «далі» → «дали»…). The owner can override it in «Управление голосом» (prefs.cmdLang).
 *                             parse() always accepts both vocabularies, so a mixed phrase works in either mode;
 *  - sleep timer            15 / 30 / 60 min / to the end of the deck; fades out over the last 10 s (iPhone: stops at the
 *                           end of the card instead — the page cannot change the volume there smoothly);
 *  - resume                 the place in every deck / text / book is remembered (localStorage) → «▶ Продолжить»;
 *  - «знаю / не знаю»       grades the card in FSRS exactly like studying (Study.gradeCard) — undoable for a few seconds;
 *  - headphones unplugged   → pause (devicechange where the browser tells; the system pause on iPhone / Android);
 *  - offline                «⬇ Скачать озвучку колоды»: every phrase of a deck saved in Cache Storage («norsk-kort-audio»,
 *                           never touched by sw.js) — Listen plays and renders from it without the network.
 */
(function () {
  const st = () => Store.settings;
  /** the Mac bridge exists only when the app is opened on the Mac (file / localhost) — on the site its hints are not shown */
  const onMac = () => location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/.test(location.hostname);
  const KEY = 'nk-listen2', POS = 'nk-listen-pos', DL = 'nk-listen-dl';
  const load = k => { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } };
  const keep = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* full / private mode */ } };
  const prefs = () => Object.assign({ out: '', vol: 1, sink: '', sinkLabel: '', voice: false, voiceOk: false, wake: null }, load(KEY));
  const emit = () => document.dispatchEvent(new CustomEvent('lx-state'));
  const setPref = o => { const s = Object.assign(load(KEY), o); keep(KEY, s); emit(); return s; };
  const esc = s => U.esc(s == null ? '' : String(s));
  const HP = (s, on = true) => Listen.HEADPHONES(s, on);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const visible = () => document.visibilityState !== 'hidden';
  const HP_RE = /airpods|headphone|head-?set|наушник|гарнитур|buds|earphone|beats|hands-?free|bluetooth|jabra|bose|wh-1000|wf-1000|freebuds|pixel buds|galaxy buds/i;
  const TV_RE = /hdmi|\btv\b|телевиз|display|monitor|displayport|airplay|chromecast|lg |samsung tv/i;
  const SPK_RE = /speaker|динамик|built-?in|встроен|macbook|internal|realtek|колонк/i;
  const MAX_VOL = 1.5;

  /* ---------- icons: our own earbuds and speaker for «Где слушать?» ---------- */
  const BUDS = `<svg class="lxw-svg" viewBox="0 0 120 90" aria-hidden="true"><defs>
      <radialGradient id="lxwHead" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".65" stop-color="#eef1f7"/><stop offset="1" stop-color="#c3c9d8"/></radialGradient>
      <linearGradient id="lxwStem" x1="0" x2="1"><stop offset="0" stop-color="#d7dce8"/><stop offset=".45" stop-color="#fff"/><stop offset="1" stop-color="#c6ccda"/></linearGradient></defs>
    <g class="lxw-wave"><path d="M10 40a26 26 0 0 1 0-20" /><path d="M110 20a26 26 0 0 1 0 20" /></g>
    <g class="lxw-bud lxw-bud-l" transform="translate(40 30) rotate(-12)"><rect x="-5" y="2" width="10" height="38" rx="5" fill="url(#lxwStem)"/><ellipse cx="3" cy="-3" rx="15" ry="14" fill="url(#lxwHead)"/><ellipse cx="9" cy="-6" rx="4" ry="3" fill="#3a3f57" opacity=".7"/></g>
    <g class="lxw-bud lxw-bud-r" transform="translate(80 30) rotate(12)"><rect x="-5" y="2" width="10" height="38" rx="5" fill="url(#lxwStem)"/><ellipse cx="-3" cy="-3" rx="15" ry="14" fill="url(#lxwHead)"/><ellipse cx="-9" cy="-6" rx="4" ry="3" fill="#3a3f57" opacity=".7"/></g></svg>`;
  const SPEAKER = `<svg class="lxw-svg" viewBox="0 0 120 90" aria-hidden="true"><defs><linearGradient id="lxwSpk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b80ff"/><stop offset="1" stop-color="#29c7ff"/></linearGradient></defs>
    <rect x="34" y="8" width="44" height="74" rx="12" fill="url(#lxwSpk)"/><circle cx="56" cy="30" r="8" fill="#0f1222" opacity=".55"/><circle cx="56" cy="58" r="15" fill="#0f1222" opacity=".55"/><circle cx="56" cy="58" r="6" fill="#fff" opacity=".85"/><circle cx="56" cy="30" r="3" fill="#fff" opacity=".85"/>
    <g class="lxw-wave"><path d="M86 34a18 18 0 0 1 0 22"/><path d="M94 27a28 28 0 0 1 0 36"/><path d="M102 20a38 38 0 0 1 0 50"/></g></svg>`;
  const MIC = (s = 16) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="8.5" y="2.5" width="7" height="12" rx="3.5"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/></svg>`;
  const VOL = (s = 18, lvl = 2) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/>${lvl > 0 ? '<path d="M15.5 9a4 4 0 0 1 0 6"/>' : ''}${lvl > 1 ? '<path d="M18.5 6.5a8 8 0 0 1 0 11"/>' : ''}</svg>`;

  /* ---------- small chips: «🎙 услышал: тише», «✓ Знаю — ↶ Отменить» (above the dark screen too) ---------- */
  function chip(msg, { action, ms = 2600, cls = '' } = {}) {
    let box = document.getElementById('lx-chips');
    if (!box) { box = document.createElement('div'); box.id = 'lx-chips'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = 'lx-chip ' + cls;
    el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button" class="lx-chip-btn">${esc(action.label)}</button>` : ''}`;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    let gone = false;
    const close = () => { if (gone) return; gone = true; el.classList.add('out'); setTimeout(() => el.remove(), 260); };
    if (action) el.querySelector('button').onclick = e => { e.stopPropagation(); close(); action.fn(); };
    setTimeout(close, ms);
    return { el, close };
  }
  /** «через 3 дн.», «через 10 мин» */
  function inTxt(ms) {
    const m = Math.round(ms / 60000);
    if (m < 60) return `через ${Math.max(1, m)} мин`;
    const h = Math.round(m / 60); if (h < 24) return `через ${h} ч`;
    const d = Math.round(h / 24); if (d < 31) return `через ${d} ${U.plural(d, ['день', 'дня', 'дней'])}`;
    const mo = Math.round(d / 30); return `через ${mo} мес.`;
  }

  /* ============ volume ============ */
  let volOk = null;
  const decodeCtx = (() => { let c = null; return () => { if (!c) { const C = window.OfflineAudioContext || window.webkitOfflineAudioContext; c = new C(1, 1, 22050); } return c; }; })();
  const decode = (ab) => new Promise((res, rej) => { const r = decodeCtx().decodeAudioData(ab, res, rej); if (r && r.then) r.then(res, rej); });
  function wavBlob(f32, sr, g) {
    const len = f32.length, buf = new ArrayBuffer(44 + len * 2), v = new DataView(buf);
    const w = (off, s) => { for (let k = 0; k < s.length; k++) v.setUint8(off + k, s.charCodeAt(k)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + len * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, len * 2, true);
    const out = new Int16Array(buf, 44, len);
    for (let k = 0; k < len; k++) out[k] = Listen.soft(f32[k] * g) * 0x7fff;
    return new Blob([buf], { type: 'audio/wav' });
  }
  const scaled = new Map(); // `${url}|${gain}` -> Promise<url>

  /* ============ the sleep timer ============ */
  const sleep = { mode: 0, until: 0, wait: null, waitSince: 0, loopWas: null, iv: null, fading: false };

  /* ============ voice commands ============ */
  // «Норск» as the Russian (норск) and the Ukrainian (норськ) recognizers write it
  const WAKE = /(^|\s)(норськ[а-яіїєґ]*|норск[а-яіїєґ]*|нурск[а-яіїєґ]*|норс|norsk|норз[а-яіїєґ]*|нор\s?ск)(\s|$|,)/;
  // Russian and Ukrainian numbers (apostrophes are dropped before: п'ять → пять, дев'яносто → девяносто)
  const NUM = { 'пять': 5, 'десять': 10, 'пятнадцать': 15, 'двадцать': 20, 'двадцать пять': 25, 'тридцать': 30, 'сорок': 40, 'сорок пять': 45, 'пятьдесят': 50, 'шестьдесят': 60, 'девяносто': 90,
    'пятнадцять': 15, 'двадцять': 20, 'двадцять пять': 25, 'тридцять': 30, 'пятдесят': 50, 'шістдесят': 60 };
  function minutesIn(t) {
    if (/(полчаса|півгодин)/.test(t)) return 30;
    if (/(полтора час|півтори годин)/.test(t)) return 90;
    let m = t.match(/(\d{1,3})\s*(час|год|ч(?=\s|$))?/);
    if (m) return +m[1] * (m[2] ? 60 : 1);
    if (/(^|\s)(два|дві|2) (час|годин)/.test(t)) return 120;
    const words = Object.keys(NUM).sort((a, b) => b.length - a.length).find(w => t.includes(w));
    if (words) return NUM[words];
    if (/(^|\s)(час|годин)/.test(t)) return 60;
    return 0;
  }
  /** lower case, ё → е, no punctuation and no apostrophes (п’ять → пять), single spaces, a space on both ends */
  const normCmd = raw => ' ' + String(raw || '').toLowerCase().replace(/ё/g, 'е').replace(/['’ʼ`]/g, '').replace(/[.,!?;:«»"()-]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  /** the language the commands are listened in: the owner's choice, else «Язык перевода» (uk → Ukrainian; ru / both → Russian) */
  function autoCmdLang() {
    let l = 'ru'; try { l = window.Study && Study.trLang ? Study.trLang() : (st().transLang || 'ru'); } catch (e) { /* ru */ }
    return l === 'uk' ? 'uk' : 'ru';
  }
  function cmdLang() {
    const c = prefs().cmdLang;
    return c === 'uk' || c === 'ru' ? c : autoCmdLang();
  }
  const CMD_WORDS = {
    ru: ['тише', 'громче', 'пауза', 'продолжи', 'дальше', 'назад', 'повтори', 'стоп', 'знаю', 'не знаю', 'таймер на 30 минут'],
    uk: ['тихіше', 'голосніше', 'пауза', 'продовжуй', 'далі', 'назад', 'повтори', 'стоп', 'знаю', 'не знаю', 'таймер на 30 хвилин'],
  };
  /** a heard phrase → a command (the order matters: «не знаю» before «знаю», «стоп пауза» before «стоп», «дальше играй» before «дальше») */
  function parse(raw) {
    // Russian and Ukrainian words side by side (the Russian recognizer writes Ukrainian «далі» as «дали», «тихіше» as «тихише»…)
    const t = normCmd(raw);
    if (/(таймер|усни|засыпа|засина|засн|выключись через|выключи через|вимкнись через|вимкни через|сон через|сна|сну)/.test(t)) {
      if (/(выкл|вимк|отмен|скасу|убери|прибери|без таймера)/.test(t) && !/через/.test(t)) return { cmd: 'sleep', arg: 0, label: 'таймер выключен' };
      if (/(до конца|до кінця)/.test(t)) return { cmd: 'sleep', arg: 'end', label: 'таймер до конца колоды' };
      const m = minutesIn(t); if (m) return { cmd: 'sleep', arg: clamp(m, 1, 240), label: `таймер на ${m} мин` };
    }
    if (/ не ?знаю /.test(t)) return { cmd: 'grade', arg: 1, label: 'не знаю' };
    if (/ знаю /.test(t)) return { cmd: 'grade', arg: 3, label: 'знаю' };
    if (/ (пауза|паузу|подожди|погоди|замолчи|стоп пауза|зачекай|почекай|замовкни|постав на паузу) /.test(t)) return { cmd: 'pause', label: 'пауза' };
    if (/(дальше играй|далі грай|дали грай|продолж|продовж|играй|грай|воспроизв|відтвор|поехали|поїхали|включи звук|увімкни звук|снять с паузы|зніми з паузи)/.test(t)) return { cmd: 'resume', label: 'продолжаю' };
    if (/ (стоп|хватит|досить|вистачить|выключи|вимкни|закончи|заверши|завершуй|остановись|останови|зупинись|зупини) /.test(t)) return { cmd: 'stop', label: 'стоп' };
    if (/ (тише|потише|тихо|тихіше|тихише|убавь|убавить|зменш[а-яіїєґ]*|потише пожалуйста) /.test(t)) return { cmd: 'vol', arg: -0.15, label: 'тише' };
    if (/ (громче|погромче|голосніше|голоснише|гучніше|гучнише|прибавь|прибавить|додай|збільш[а-яіїєґ]*) /.test(t)) return { cmd: 'vol', arg: 0.15, label: 'громче' };
    if (/ (следующ[а-яіїєґ]*|наступн[а-яіїєґ]*|дальше|далі|дали|вперед|уперед|пропусти|пропуск|некст) /.test(t)) return { cmd: 'next', label: 'дальше' };
    if (/ (предыдущ[а-яіїєґ]*|попередн[а-яіїєґ]*|назад|вернись|повернись|обратно) /.test(t)) return { cmd: 'prev', label: 'назад' };
    if (/ (повтори|повторить|повторити|еще раз|ще раз|снова|знову) /.test(t)) return { cmd: 'repeat', label: 'повторяю' };
    if (/ (сначала|с начала|из начала|в начало|спочатку|з початку|на початок) /.test(t)) return { cmd: 'restart', label: 'с начала' };
    return null;
  }

  const Voice = {
    sr: null, running: false, fails: 0, lastSpeak: 0, poll: null, restartT: null,
    supported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); },
    want() {
      const pr = prefs();
      return !!(pr.voice && pr.voiceOk && this.supported() && Listen.p && visible() && !(window.Interp && Interp.on));
    },
    sync() { if (this.want()) this.start(); else this.stop(); X.paintAll(); },
    start() {
      if (this.running) return;
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      let sr;
      try { sr = new SR(); } catch (e) { return; }
      this.lang = cmdLang();
      sr.lang = this.lang === 'uk' ? 'uk-UA' : 'ru-RU'; sr.continuous = true; sr.interimResults = false; sr.maxAlternatives = 3;
      sr.onresult = e => {
        for (let i = e.resultIndex || 0; i < e.results.length; i++) {
          const r = e.results[i]; if (!r || r.isFinal === false) continue;
          const alts = []; for (let k = 0; k < (r.length || 1); k++) if (r[k] && r[k].transcript) alts.push(r[k].transcript);
          this.fails = 0;
          this.heard(alts);
        }
      };
      sr.onerror = e => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          setPref({ voice: false });
          chip('🎙 Нет доступа к микрофону — голосовое управление выключено', { ms: 5000 });
          this.stop();
        } else if (e.error !== 'no-speech' && e.error !== 'aborted') this.fails++;
      };
      sr.onend = () => {
        if (this.sr !== sr) return;
        this.running = false; this.sr = null;
        // continuous recognition stops by itself now and then: start again (slower after repeated failures)
        if (this.want()) { clearTimeout(this.restartT); this.restartT = setTimeout(() => this.sync(), Math.min(10000, 250 * Math.pow(2, this.fails))); }
        X.paintAll();
      };
      try { sr.start(); this.sr = sr; this.running = true; } catch (e) { this.running = false; return; }
      clearInterval(this.poll);
      this.poll = setInterval(() => { if (Listen.speaking()) this.lastSpeak = Date.now(); }, 200);
      X.paintAll();
    },
    stop() {
      clearTimeout(this.restartT); clearInterval(this.poll); this.poll = null;
      const sr = this.sr; this.sr = null; this.running = false;
      if (sr) { sr.onend = null; sr.onresult = null; try { sr.abort(); } catch (e) { /* ignore */ } }
    },
    /** the wake word is needed: set by the owner, otherwise only with the speaker (the app must not obey its own voice) */
    wakeOn() { const pr = prefs(); return pr.wake == null ? pr.out !== 'headphones' : !!pr.wake; },
    heard(alts) {
      if (!Listen.p) return;
      const norm = normCmd;
      let best = null, wake = false, first = norm(alts[0] || '');
      for (const a of alts) {
        const t = norm(a), w = WAKE.test(t);
        const c = parse(t.replace(WAKE, ' '));
        if (c) { best = c; wake = w; first = t; break; }
        if (w) wake = true;
      }
      // our own voice is speaking (or just spoke): only a phrase with the wake word counts
      const echo = Listen.speaking() || Date.now() - this.lastSpeak < 1200;
      if (echo && !wake) return;
      if (this.wakeOn() && !wake) return;
      if (!best) { if (wake) chip(`🎙 Не понял: «${first.trim().slice(0, 40)}»`); return; }
      X.run(best);
      chip(`🎙 услышал: ${best.label}`, { cls: 'heard' });
    },
  };

  /* ============ headphones unplugged ============ */
  const Dev = {
    last: null, pausedAt: 0,
    async list() {
      try { return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput').map(d => ({ id: d.deviceId, label: d.label || '', group: d.groupId })); } catch (e) { return []; }
    },
    async snap() { if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) this.last = await this.list(); },
    async change() {
      const now = await this.list(), before = this.last || [];
      this.last = now;
      if (document.querySelector('.lxw-modal')) X.renderDevices();
      const p = Listen.p, pr = prefs();
      if (pr.out !== 'headphones' || !p || !p.playing) return;
      const gone = before.filter(b => !now.some(n => n.id === b.id && n.label === b.label));
      const hpGone = gone.some(b => HP_RE.test(b.label) || (pr.sink && b.id === pr.sink && pr.sink !== 'default'));
      const db = before.find(d => d.id === 'default'), dn = now.find(d => d.id === 'default');
      const defSwitched = db && dn && HP_RE.test(db.label) && !HP_RE.test(dn.label);
      if (!hpGone && !defSwitched) return;
      this.pausedAt = Date.now();
      Listen.pause();
      chip('⏸ Наушники отключены — пауза', { ms: 9000, cls: 'warn', action: { label: '▶ Продолжить', fn: () => { Listen.prime(); Listen.resume(); } } });
    },
  };

  /* ============ offline: the deck's voice in Cache Storage ============ */
  function fnv(s) {
    let h1 = 0x811c9dc5, h2 = 0x01000193 ^ s.length;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193); h2 = Math.imul(h2 ^ c, 0x5bd1e995); h2 ^= h2 >>> 15; }
    return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  }
  const urlMemo = new Map();
  const Cache = {
    NAME: 'norsk-kort-audio',
    ok() { return !!window.caches; },
    index() { return load(DL); },
    any() { return Object.keys(this.index()).length > 0; },
    cloud(lang) { return window.Voices ? Voices.audioEngine(lang, 'listen') : ''; }, // 📍 the voice of «Слушать»
    /** the voices a clip may have been saved with — the configured cloud voice first, then the free Google voice */
    sigs(lang, rate) {
      const out = [], eng = this.cloud(lang);
      if (eng) out.push({ sig: `${eng}:${Voices.voice(eng, lang, 'listen')}`, b: rate.toFixed(2) });
      out.push({ sig: 'google', b: rate < 0.8 ? 'slow' : 'n' });
      return out;
    },
    key(sig, b, lang, text) { return new URL(`__nk_audio/${fnv([sig, b, lang, text].join('|'))}`, location.href).href; },
    async get(text, lang, rate) {
      if (!this.ok() || !this.any()) return null;
      const c = await caches.open(this.NAME);
      for (const s of this.sigs(lang, rate)) { const r = await c.match(this.key(s.sig, s.b, lang, text)); if (r) return r.blob(); }
      return null;
    },
    /** a blob: URL of the saved clip (kept: the playlist may use it again on the next round) */
    async url(text, lang, rate) {
      if (!this.ok() || !this.any()) return null;
      const k = [lang, rate, text].join('|');
      if (urlMemo.has(k)) return urlMemo.get(k);
      const b = await this.get(text, lang, rate); if (!b) return null;
      const u = URL.createObjectURL(b);
      urlMemo.set(k, u);
      if (urlMemo.size > 400) { const [ok, ou] = urlMemo.entries().next().value; urlMemo.delete(ok); setTimeout(() => URL.revokeObjectURL(ou), 60000); }
      return u;
    },
    /** every phrase a deck can speak (word, translation and — with «вся карточка» — the back side) */
    items(deckId) {
      const o = Object.assign(Listen.opts(), { dir: 'nr', repeat: 1 });
      const seen = new Set(), out = [];
      Store.cards(deckId || null).filter(c => Listen.hasTr(c)).forEach(c => Listen.cardItems(c, o).forEach(it => {
        const k = it.lang + '|' + it.text; if (!seen.has(k)) { seen.add(k); out.push({ lang: it.lang, text: it.text }); }
      }));
      return out;
    },
    /** the deck is fully saved for the voice and speed that are set now ('' = all decks) */
    complete(deckId) {
      const idx = this.index();
      if (!deckId) { const ds = Store.decks().filter(d => Store.cards(d.id).some(c => Listen.hasTr(c))); return ds.length > 0 && ds.every(d => this.complete(d.id)); }
      const e = idx[deckId]; if (!e || !e.done) return false;
      const rate = TTS.currentRate();
      return this.sigs('no', rate).some(s => s.sig === e.sig && s.b === e.b) || (e.sig === 'google' && e.b === (rate < 0.8 ? 'slow' : 'n'));
    },
    status(deckId) {
      const e = this.index()[deckId];
      if (!e) return { state: 'none' };
      if (this.complete(deckId)) return Object.assign({ state: 'done' }, e);
      return Object.assign({ state: e.done ? 'other' : 'partial' }, e);
    },
    /** one phrase as audio: the cloud voice; else the Google voice (through the Mac bridge, or directly where it is allowed) */
    async fetchClip(it, rate) {
      const eng = this.cloud(it.lang);
      if (eng && Voices.ready(eng)) {
        try {
          const vk = Voices.voice(eng, it.lang, 'listen');
          const u = await Voices.synth(eng, it.text, it.lang, rate, vk);
          const blob = await (await fetch(u)).blob();
          if (blob.size > 200) return { blob, sig: `${eng}:${vk}`, b: rate.toFixed(2) };
        } catch (e) { /* the Google voice below */ }
      }
      const parts = [];
      for (const url of Listen.googleUrls(it.text, it.lang, rate)) {
        let r;
        if (window.AI && AI.bridge && AI.bridge.up) r = await fetch('/api/proxy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url, method: 'GET' }) });
        else r = await fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!r.ok) throw new Error('voice');
        parts.push(await r.arrayBuffer());
      }
      const blob = new Blob(parts, { type: 'audio/mpeg' });
      if (blob.size < 200) throw new Error('voice');
      return { blob, sig: 'google', b: rate < 0.8 ? 'slow' : 'n' };
    },
    async download(deckId, { onProgress, signal } = {}) {
      if (!this.ok()) throw Object.assign(new Error('Этот браузер не умеет сохранять файлы для офлайна'), { friendly: true });
      const items = this.items(deckId), rate = TTS.currentRate(), total = items.length;
      if (!total) throw Object.assign(new Error('В колоде нет карточек со словом и переводом'), { friendly: true });
      // room on the device: a short phrase is ~10–25 KB
      try {
        const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
        if (est && est.quota && est.quota - est.usage < total * 30000 * 1.5) throw Object.assign(new Error('На устройстве мало места для озвучки этой колоды'), { friendly: true });
      } catch (e) { if (e.friendly) throw e; }
      const c = await caches.open(this.NAME);
      const keys = [];
      let done = 0, bytes = 0, ok = 0, bad = 0, sig = null, b = null, quota = false;
      let next = 0;
      const one = async () => {
        while (next < items.length) {
          const it = items[next++];
          if (signal && signal.aborted) return;
          if (quota || (!ok && bad >= 3)) return;
          try {
            let have = null;
            for (const s of this.sigs(it.lang, rate)) { const k = this.key(s.sig, s.b, it.lang, it.text); const r = await c.match(k); if (r) { have = { k, size: +(r.headers.get('x-size') || 0), s }; break; } }
            if (have) { keys.push(have.k); bytes += have.size; ok++; sig = sig || have.s.sig; b = b || have.s.b; }
            else {
              const r = await this.fetchClip(it, rate);
              const k = this.key(r.sig, r.b, it.lang, it.text);
              await c.put(k, new Response(r.blob, { headers: { 'content-type': r.blob.type || 'audio/mpeg', 'x-size': String(r.blob.size) } }));
              keys.push(k); bytes += r.blob.size; ok++; sig = sig || r.sig; b = b || r.b;
            }
          } catch (e) {
            if (e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || ''))) quota = true;
            bad++;
          }
          done++;
          if (onProgress) onProgress(done, total, bytes);
        }
      };
      await Promise.all([one(), one(), one()]);
      const idx = this.index();
      const prev = idx[deckId];
      idx[deckId] = { total, n: ok, bytes, sig: sig || (prev && prev.sig) || 'google', b: b || (prev && prev.b) || 'n', t: Date.now(), done: ok >= total };
      if (ok || prev) keep(DL, idx); else { delete idx[deckId]; keep(DL, idx); }
      try { await c.put(new URL(`__nk_audio/index/${encodeURIComponent(deckId)}`, location.href).href, new Response(JSON.stringify([...new Set(keys)]), { headers: { 'content-type': 'application/json' } })); } catch (e) { /* the list is only for deleting */ }
      emit();
      if (quota) throw Object.assign(new Error('Закончилось место на устройстве — сохранено не всё'), { friendly: true, partial: true });
      if (!ok && !(signal && signal.aborted)) throw Object.assign(new Error('nosource'), { nosource: true });
      return idx[deckId];
    },
    async remove(deckId) {
      if (!this.ok()) return;
      const c = await caches.open(this.NAME);
      const listKey = id => new URL(`__nk_audio/index/${encodeURIComponent(id)}`, location.href).href;
      const read = async id => { try { const r = await c.match(listKey(id)); return r ? await r.json() : []; } catch (e) { return []; } };
      const mine = await read(deckId);
      // a phrase that another downloaded deck also has stays
      const others = new Set();
      for (const id of Object.keys(this.index())) if (id !== deckId) (await read(id)).forEach(k => others.add(k));
      await Promise.all(mine.filter(k => !others.has(k)).map(k => c.delete(k)));
      await c.delete(listKey(deckId));
      const idx = this.index(); delete idx[deckId]; keep(DL, idx);
      urlMemo.forEach(u => URL.revokeObjectURL(u)); urlMemo.clear();
      emit();
    },
  };
  const mb = n => n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} МБ` : `${Math.max(1, Math.round(n / 1e3))} КБ`;

  /* ============ ListenX ============ */
  const X = {
    prefs, setPref, chip, parse, cmdLang, Voice, Dev, cache: Cache, sleep,
    _forceBake: false,

    /* ---------- volume ---------- */
    /** does this browser honour audio.volume? (the iPhone does not — it is always 1 there) */
    volumeWorks() {
      if (this._forceBake) return false;
      if (volOk == null) { try { const a = new Audio(); a.volume = 0.5; volOk = Math.abs(a.volume - 0.5) < 0.01 && !TTS.IOS; } catch (e) { volOk = false; } }
      return volOk;
    },
    vol() { return clamp(+prefs().vol || 0, 0, MAX_VOL); },
    /** what the <audio> element gets (≤ 1) and what is baked into the samples (the rest) */
    elemVol() { return this.volumeWorks() ? Math.min(1, this.vol()) : 1; },
    bakeGain() { const v = this.vol(); return Math.round((this.volumeWorks() ? Math.max(1, v) : v) * 100) / 100; },
    prepAudio(a) {
      try { a.volume = this.elemVol(); } catch (e) { /* read-only */ }
      const s = prefs().sink;
      if (s && a.setSinkId) a.setSinkId(s).catch(() => { /* the device is gone: the system's default */ });
    },
    setVolume(v, src) {
      v = Math.round(clamp(v, 0, MAX_VOL) * 20) / 20;
      setPref({ vol: v });
      const p = Listen.p;
      if (p && !sleep.fading) { try { p.audio.volume = this.elemVol(); } catch (e) { /* ignore */ } }
      clearTimeout(this._rebake);
      this._rebake = setTimeout(() => Listen.rebake(), src === 'slider' ? 350 : 60);
      // clips made with the old volume are made again (cloud voice / downloaded — the iPhone)
      if (p && !p.rendered && !this.volumeWorks()) { p.pre = {}; }
      if (src && src !== 'slider') chip(`${v === 0 ? '🔇' : '🔊'} Громкость ${Math.round(v * 100)}%`);
      this.paintAll();
    },
    /** iPhone: a clip of our own (blob:) with the volume baked in; other clips as they are */
    scaleUrl(u) {
      const g = this.bakeGain();
      if (Math.abs(g - 1) < 0.01 || !u || !u.startsWith('blob:')) return Promise.resolve(u);
      const k = u + '|' + g;
      if (!scaled.has(k)) {
        scaled.set(k, (async () => {
          try {
            const buf = await decode(await (await fetch(u)).arrayBuffer());
            return URL.createObjectURL(wavBlob(buf.getChannelData(0), buf.sampleRate, g));
          } catch (e) { return u; }
        })());
        if (scaled.size > 300) { const [ok, op] = scaled.entries().next().value; scaled.delete(ok); op.then(x => { if (x !== ok.split('|')[0]) setTimeout(() => URL.revokeObjectURL(x), 60000); }); }
      }
      return scaled.get(k);
    },
    /** the slider can really change the sound of this session? (iPhone + the free Google voice stream: no) */
    volumeEffective() {
      if (this.volumeWorks()) return true;
      const p = Listen.p; if (!p) return true;
      if (p.rendered) return true;
      return !!(window.Voices && Voices.audioEngine('no', 'listen')) || Cache.complete(p.o.deckId);
    },
    volumeHtml() {
      return `<div class="lx-vol-wrap"><div class="lx-vol">
          <button type="button" class="lx-vb" data-lxv="-" title="Тише" aria-label="Тише">${VOL(18, 0)}<span>тише</span></button>
          <input type="range" class="lx-range" data-lxv-range min="0" max="${MAX_VOL * 100}" step="5" value="${Math.round(this.vol() * 100)}" aria-label="Громкость">
          <button type="button" class="lx-vb" data-lxv="+" title="Громче" aria-label="Громче">${VOL(18, 2)}<span>громче</span></button>
          <output class="lx-vout" data-lxv-out>${Math.round(this.vol() * 100)}%</output></div>
        <div class="lx-hint">🔊 Громкость: боковые кнопки телефона, этот ползунок или голосом</div>
        <div class="lx-hint warn" data-lx-volnote hidden>На iPhone с бесплатным голосом Google ползунок не действует — только боковые кнопки. Он заработает с облачным голосом или со скачанной озвучкой.</div></div>`;
    },

    /* ---------- «Где слушать?» ---------- */
    outLabel() { const o = prefs().out; return o === 'headphones' ? '🎧 В наушниках' : o === 'speaker' ? '🔊 Через динамик' : '🔈 Где слушать?'; },
    sinkSupported() { return !!(window.HTMLMediaElement && 'setSinkId' in HTMLMediaElement.prototype && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices); },
    where({ first = false } = {}) {
      if (document.querySelector('.lxw-modal')) return;
      this._asked = true;
      const m = this._wm = UI.modal({
        title: `${HP(24, true)} Где слушать?`, cls: 'lxw-modal',
        body: `<p class="lxw-lead">${first ? 'Прежде чем начать — как вы слушаете? Приложение подстроится. Выбор запомнится, поменять можно в плеере.' : 'Выбор запоминается. Звук не прерывается.'}</p>
          <div class="lxw-cards" role="radiogroup" aria-label="Где слушать">
            <button type="button" class="lxw-card" role="radio" data-lxw="headphones"><span class="lxw-art">${BUDS}</span><span class="lxw-txt"><b>🎧 В наушниках</b><small>Карманный режим: тёмный экран с защитой от касаний, пауза, если наушники отключатся</small></span><span class="lxw-check" aria-hidden="true">✓</span></button>
            <button type="button" class="lxw-card" role="radio" data-lxw="speaker"><span class="lxw-art">${SPEAKER}</span><span class="lxw-txt"><b>🔊 Через динамик</b><small>Обычный экран: крупные строки и кнопки — удобно слушать вместе</small></span><span class="lxw-check" aria-hidden="true">✓</span></button>
          </div>
          <p class="lxw-honest">ℹ️ На телефоне звук направляет система: <b>если подключены наушники, звук всегда идёт в них</b>, иначе — в динамик.</p>
          <div class="lxw-mode" data-lxw-mode></div>
          <div class="lxw-dev" data-lxw-dev></div>`,
        foot: `<button class="btn primary lxw-done" data-lxw-done>Готово</button>`,
        onClose: () => { this._wm = null; },
      });
      m.el.addEventListener('click', e => {
        const c = e.target.closest('[data-lxw]');
        if (c) { this.setOut(c.dataset.lxw); return; }
        if (e.target.closest('[data-lxw-done]')) { if (!prefs().out) this.setOut('speaker', true); m.close(); return; }
        if (e.target.closest('[data-lxw-dark]')) { m.close(); Listen.dark(true); return; }
        const d = e.target.closest('[data-lxw-sink]'); if (d) { this.setSink(d.dataset.lxwSink, d.dataset.label || ''); return; }
        if (e.target.closest('[data-lxw-labels]')) { this.askLabels(); return; }
        if (e.target.closest('[data-lxw-pick]')) { this.pickFirefox(); return; }
      });
      this.paintWhere();
      this.renderDevices();
      return m;
    },
    setOut(out, quiet) {
      setPref({ out });
      if (out === 'headphones') Dev.snap();
      this.paintWhere();
      Voice.sync();
      if (!quiet) chip(out === 'headphones' ? '🎧 Слушаем в наушниках' : '🔊 Слушаем через динамик');
    },
    paintWhere() {
      const m = this._wm; if (!m) return;
      const out = prefs().out;
      m.$$('[data-lxw]').forEach(c => { const on = c.dataset.lxw === out; c.classList.toggle('on', on); c.setAttribute('aria-checked', on ? 'true' : 'false'); });
      const box = m.$('[data-lxw-mode]');
      box.innerHTML = out === 'headphones'
        ? `<div class="lxw-tip"><span class="lxw-tip-ic">🌑</span><span><b>Тёмный экран с защитой от касаний</b> — чёрный экран, телефон можно убрать в карман; меню — двойным касанием или удержанием пальца. Можно и просто заблокировать телефон — звук не прервётся.</span>
            <button type="button" class="btn sm lxw-dark" data-lxw-dark>🌑 Затемнить</button></div>
           <div class="lxw-tip"><span class="lxw-tip-ic">⏸</span><span>Если наушники отключатся, прослушивание встанет на паузу${this.sinkSupported() ? '' : ' (на телефоне это делает система)'}.</span></div>`
        : out === 'speaker'
          ? `<div class="lxw-tip"><span class="lxw-tip-ic">🔊</span><span>В плеере — <b>крупные строки и кнопки</b>. Голосовые команды начинайте со слова <b>«Норск»</b> («Норск, тише») — чтобы приложение не слушалось собственного голоса.</span></div>`
          : '';
    },
    /** the output devices of this computer (Chrome / Edge: setSinkId; Firefox: the browser's own picker) */
    async renderDevices() {
      const m = this._wm; if (!m) return;
      const box = m.$('[data-lxw-dev]');
      if (!this.sinkSupported()) {
        box.innerHTML = `<details class="lxw-sys"><summary>🔈 Устройство выбирает система — как переключить?</summary>
          <p><b>iPhone:</b> Пункт управления → в плеере значок AirPlay ◎ → «iPhone» (динамик) или наушники.</p>
          <p><b>Android:</b> шторка уведомлений → в плеере кнопка устройства → «Этот телефон» или наушники.</p>
          <p><b>Mac:</b> строка меню → 🔊 → «Выход» → «Динамики MacBook» или наушники.</p></details>`;
        return;
      }
      const list = await Dev.list();
      if (!this._wm) return;
      const pr = prefs();
      const real = list.filter(d => d.id !== 'communications');
      const named = real.some(d => d.label);
      const icon = l => HP_RE.test(l) ? '🎧' : TV_RE.test(l) ? '📺' : SPK_RE.test(l) ? '🔊' : '🔈';
      const cur = pr.sink || 'default';
      const rows = real.filter(d => d.id && d.id !== 'default').map((d, i) => {
        const label = d.label || `Устройство ${i + 1}`;
        return `<button type="button" class="lxw-devb ${cur === d.id ? 'on' : ''}" data-lxw-sink="${esc(d.id)}" data-label="${esc(label)}"><span class="lxw-di">${icon(label)}</span><span class="lxw-dl">${esc(label)}</span><span class="lxw-dc" aria-hidden="true">✓</span></button>`;
      });
      const canPick = !!navigator.mediaDevices.selectAudioOutput;
      box.innerHTML = `<h4 class="lxw-h">🖥 Устройство вывода на этом компьютере</h4>
        <div class="lxw-devs">
          <button type="button" class="lxw-devb ${cur === 'default' ? 'on' : ''}" data-lxw-sink="default" data-label="Как в системе"><span class="lxw-di">⚙️</span><span class="lxw-dl">Как в системе (по умолчанию)</span><span class="lxw-dc" aria-hidden="true">✓</span></button>
          ${rows.join('')}
        </div>
        ${canPick ? `<button type="button" class="btn sm ghost lxw-more" data-lxw-pick>🔈 Выбрать устройство…</button><div class="tiny muted">Браузер сам покажет список колонок и наушников.</div>`
          : !named ? `<button type="button" class="btn sm ghost lxw-more" data-lxw-labels>🏷 Показать названия устройств</button>
            <div class="tiny muted">Браузер называет колонки, наушники и телевизор только после разрешения на микрофон. Микрофон при этом не записывает — приложение лишь читает список устройств.</div>` : ''}`;
    },
    async askLabels() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach(t => t.stop());
      } catch (e) { chip('Без разрешения браузер не называет устройства — выберите «Как в системе»', { ms: 5000 }); }
      await Dev.snap();
      this.renderDevices();
    },
    async pickFirefox() {
      try { const d = await navigator.mediaDevices.selectAudioOutput(); await this.setSink(d.deviceId, d.label); } catch (e) { /* cancelled */ }
    },
    async setSink(id, label) {
      const els = [Listen.p && Listen.p.audio, Listen._primed].filter(a => a && a.setSinkId);
      try {
        await Promise.all(els.map(a => a.setSinkId(id === 'default' ? '' : id)));
        setPref({ sink: id === 'default' ? '' : id, sinkLabel: label || '' });
        chip(`🔈 Звук: ${id === 'default' ? 'как в системе' : label}`);
      } catch (e) { chip('Не получилось переключить на это устройство — звук остался там, где был', { ms: 5000, cls: 'warn' }); }
      this.renderDevices();
    },

    /* ---------- the session ---------- */
    onStart(p) {
      this._lastI = -1;
      if (!prefs().out && !this._asked && !document.querySelector('.lxw-modal')) setTimeout(() => { if (Listen.p && !prefs().out && !this._asked) this.where({ first: true }); }, 450);
      if (prefs().out === 'headphones') Dev.snap();
      Voice.sync();
      if (sleep.mode) this.sleepRun();
      this.paintAll();
    },
    onStop(p, internal) {
      if (internal) return;
      this.savePos(p, true);
      this.clearSleep(true, p);
      setTimeout(() => Voice.sync(), 0);
    },

    /* ---------- ▶ resume where it was stopped ---------- */
    srcKey(o, cards) {
      if (o && o.media) return 'media:' + (o.mediaKey || o.srcTitle || '');
      if (cards && cards[0] && cards[0].raw) return 'text:' + (o.bookUrl || o.srcTitle || '');
      return `deck:${o.deckId || '*'}:${o.filter || 'all'}${o.dir === 'recall' ? ':recall' : ''}`;
    },
    positions() { return load(POS); },
    savePos(p, now) {
      if (!p || p.list || !p.cards || !p.cards.length) return;
      const key = this.srcKey(p.o, p.cards);
      if (key === 'text:') return;
      const all = this.positions();
      const c = p.cards[p.i] || {};
      if (p.o.media) {
        // 🎬 a queue of videos: which video and the second inside it (+ the list, to start again after a reload)
        const sk = p.o._seek;
        const sec = p.cur && p.cur.media ? Math.floor(p.audio.currentTime || 0) : sk && sk.i === p.i ? Math.floor(sk.t) : 0;
        if (p.finished || (p.i <= 0 && sec < 5)) { if (all[key]) { delete all[key]; keep(POS, all); } return; }
        const items = p.cards.map(x => ({ id: x.id, no: String(x.no || '').slice(0, 140), ru: x.ru || '', media: x.media, art: x.art || '', sec: x.sec || 0, link: x.link || '', tg: x.tg }));
        all[key] = { key, kind: 'media', title: p.deck ? p.deck.name : 'Видео', i: p.i, n: p.cards.length, t: Date.now(), cardId: c.id, sec,
          items: JSON.stringify(items).length < 80000 ? items : items.slice(Math.max(0, p.i - 20), p.i + 60),
          mo: { mediaKey: p.o.mediaKey || '', loop: !!p.o.loop, tgFf: !!p.o.tgFf } };
        Object.values(all).sort((a, b) => b.t - a.t).slice(30).forEach(x => delete all[x.key]);
        keep(POS, all);
        return;
      }
      const book = !!(c.page && p.o.book);
      if (p.finished || (p.i <= 0 && !(book && c.page > 1))) { if (all[key]) { delete all[key]; keep(POS, all); } return; }
      const e = { key, title: p.deck ? p.deck.name : 'Все колоды', i: p.i, n: p.cards.length, t: Date.now() };
      if (c.raw) {
        e.kind = book ? 'book' : 'text';
        if (book) { e.book = p.o.book; e.page = c.page; e.pages = p.o.totalPages || 0; }
        else {
          const pieces = p.cards.map(x => ({ title: x.no, text: x.raw, page: x.page || 0 }));
          if (JSON.stringify(pieces).length < 60000) e.pieces = pieces;
        }
      } else Object.assign(e, { kind: 'deck', cardId: c.id, deckId: p.o.deckId || '', filter: p.o.filter || 'all', dir: p.o.dir });
      all[key] = e;
      // the 30 most recent sources
      Object.values(all).sort((a, b) => b.t - a.t).slice(30).forEach(x => delete all[x.key]);
      keep(POS, all);
    },
    /** where this source was left: {at, ...entry} — or null (new, finished, or the list changed beyond recognition) */
    resumeFor(cards, o) {
      const e = this.positions()[this.srcKey(o, cards)]; if (!e) return null;
      if (e.kind === 'media') {
        const at = cards.findIndex(c => c.id === e.cardId);
        if (at < 0 || (at === 0 && !(e.sec > 3))) return null;
        return Object.assign({}, e, { at });
      }
      let at = -1;
      if (e.cardId) at = cards.findIndex(c => c.id === e.cardId);
      else if (e.page) at = cards.findIndex(c => c.page === e.page);
      else if (e.n === cards.length) at = e.i;
      if (at <= 0 || at >= cards.length) return null;
      return Object.assign({}, e, { at });
    },
    offerResume(p) {
      const r = p.resumed; if (!r) return;
      setTimeout(() => { if (p.resumed === r) { r.done = true; this.paintAll(); document.dispatchEvent(new CustomEvent('listen-state')); } }, 25000);
      setTimeout(() => {
        if (Listen.p !== p || r.done || document.querySelector('.np-modal')) return;
        chip(`▶ Продолжаю с места, где остановились (${this.resumeWhere(r)})`, { ms: 9000, action: { label: 'Начать сначала', fn: () => { r.done = true; Listen.prime(); Listen.goTo(0); } } });
      }, 700);
    },
    resumeWhere(r) {
      // the same words as everywhere (js/resume.js): «стр. 12», «карточка 3», «видео 2, 3:04»
      if (r.kind === 'media') { const s = Math.floor(r.sec || 0); return `${/^ac:/.test((r.mo && r.mo.mediaKey) || '') ? 'урок' : /^tga:/.test((r.mo && r.mo.mediaKey) || '') ? 'запись' : 'видео'} ${r.at + 1}${s > 3 ? `, ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : ''}`; }
      return r.page ? `стр. ${r.page}` : `${r.kind === 'text' ? 'часть' : 'карточка'} ${r.at + 1}`;
    },
    /** 📍 «Сбросить место»: is a listening place of this deck remembered? / forget it */
    hasPlace(deckId) { return !!deckId && Object.keys(this.positions()).some(k => k.startsWith(`deck:${deckId}:`)); },
    forgetDeck(deckId) {
      const all = this.positions(); let n = 0;
      Object.keys(all).forEach(k => { if (k.startsWith(`deck:${deckId}:`)) { delete all[k]; n++; } });
      if (n) keep(POS, all);
      return n;
    },
    /** the most recent place to come back to (not the one that plays now) */
    lastResume() {
      const cur = Listen.p ? this.srcKey(Listen.p.o, Listen.p.cards) : '';
      return Object.values(this.positions()).filter(e => e.key !== cur && (e.kind !== 'deck' || !e.deckId || Store.deck(e.deckId)) && (e.kind !== 'text' || e.pieces) && (e.kind !== 'book' || e.book) && (e.kind !== 'media' || (e.items && e.items.length))).sort((a, b) => b.t - a.t)[0] || null;
    },
    continueEntry(e) {
      if (!e) return;
      Listen.prime();
      if (e.kind === 'deck') {
        const o = Object.assign(Listen.opts(), { deckId: e.deckId || '', filter: e.filter || 'all', limit: 0, noRender: false });
        if (/:recall$/.test(e.key)) o.dir = 'recall'; else if (o.dir === 'recall') o.dir = e.dir && e.dir !== 'recall' ? e.dir : 'nr';
        const cards = Listen.cards(o);
        if (!cards.length) { UI.toast('В этой колоде больше нет таких карточек', 'warn'); return; }
        Listen.saveOpts(Object.assign({}, o));
        Listen.start(cards, o);
        if (window.ListenUI) { ListenUI.markUsed(); ListenUI.nowPlaying(); }
      } else if (e.kind === 'media' && e.items) {
        // 🎬 the same videos again; Listen finds the remembered video and second by itself
        if (Listen.startMedia(e.title, e.items, Object.assign({}, e.mo)) && window.ListenUI) { ListenUI.markUsed(); ListenUI.nowPlaying(); }
      } else if (e.kind === 'book' && window.Books) Books.listen(e.book, e.page || 1);
      else if (e.pieces) Listen.startText(e.title, e.pieces, { loop: false });
    },

    /* ---------- «знаю / не знаю» → FSRS, like studying ---------- */
    gradeHtml(where = 'np') {
      return `<div class="lx-grade lx-grade-${where}" data-lx-gradebox>
          <button type="button" class="lx-g bad" data-lx-grade="1" title="Не знаю — карточка вернётся скоро; сейчас прозвучит ещё раз"><span class="lx-g-ic">✗</span><span>Не знаю</span></button>
          <button type="button" class="lx-g good" data-lx-grade="3" title="Знаю — следующее повторение позже; сразу следующая карточка"><span class="lx-g-ic">✓</span><span>Знаю</span></button></div>`;
    },
    grade(g) {
      const p = Listen.p; if (!p) return;
      const c = p.cards[p.i];
      const card = c && !c.raw && Store.card(c.id);
      if (!card) { chip('Это не карточка — отмечать нечего'); return; }
      if (!window.Study || !Study.gradeCard) return;
      const dir = Listen.gradeDir(p.o);
      p.graded = p.graded || {};
      const k = card.id + dir;
      if (p.graded[k]) Study.ungradeCard(p.graded[k]); // changed one's mind: the newest answer counts
      const snap = Study.gradeCard(card, dir, g);
      p.graded[k] = snap;
      try { if (navigator.vibrate) navigator.vibrate(g > 1 ? 12 : [18, 40, 18]); } catch (e) { /* ignore */ }
      const no = String(card.no).split('\n')[0].slice(0, 30);
      chip(g > 1 ? `✓ Знаю «${no}» — повторю ${inTxt(snap.next.due - Date.now())}` : `✗ «${no}» — повторю скоро, а сейчас ещё раз`, {
        ms: 6000, cls: g > 1 ? 'good' : 'bad',
        action: { label: '↶ Отменить', fn: () => { if (p.graded && p.graded[k] === snap) { Study.ungradeCard(snap); delete p.graded[k]; chip('↶ Ответ отменён'); this.paintAll(); } } },
      });
      // listening goes on: «знаю» → the next card; «не знаю» → this card once more
      if (Listen.p === p) { if (g > 1) Listen.jump(1); else Listen.goTo(p.i); }
      this.paintAll();
    },

    /* ---------- 🌙 sleep timer ---------- */
    sleepHtml() {
      const opts = [[0, 'Выкл', 'Без таймера'], [15, '15 мин', 'Пауза через 15 минут'], [30, '30 мин', 'Пауза через 30 минут'], [60, '60 мин', 'Пауза через час'], ['end', 'До конца', 'Остановить, когда колода закончится']];
      return `<div class="lx-sleep"><span class="lx-sl-lbl">🌙 Таймер сна <span class="lx-sl-chip" data-lx-sleepchip></span></span>
        <div class="seg-mini lx-sl-seg">${opts.map(([v, l, t]) => `<button type="button" data-lx-sleep="${v}" title="${t}">${l}</button>`).join('')}</div></div>`;
    },
    sleepLeft() {
      if (!sleep.mode || !Listen.p) return '';
      if (sleep.mode === 'end') return 'до конца';
      const s = Math.max(0, Math.ceil((sleep.until - Date.now()) / 1000));
      return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    },
    setSleep(mode, quiet) {
      const p = Listen.p;
      this.clearSleep(false, p);
      if (!mode || !p) { if (!quiet) chip('🌙 Таймер сна выключен'); this.paintAll(); Listen.bar(); return; }
      sleep.mode = mode;
      if (mode === 'end') { sleep.loopWas = p.o.loop; p.o.loop = false; }
      else sleep.until = Date.now() + mode * 60000;
      this.sleepRun();
      if (!quiet) chip(mode === 'end' ? '🌙 Остановлю, когда колода закончится' : `🌙 Таймер сна: ${mode} мин — потом тихо остановлю`);
      this.paintAll(); Listen.bar();
    },
    sleepRun() { clearInterval(sleep.iv); sleep.iv = setInterval(() => this.sleepTick(), 1000); },
    clearSleep(sessionEnd, p) {
      clearInterval(sleep.iv); sleep.iv = null;
      p = p || Listen.p;
      if (sleep.mode === 'end' && p && sleep.loopWas != null && !sessionEnd) p.o.loop = sleep.loopWas;
      if (sleep.fading && p) { try { p.audio.volume = this.elemVol(); } catch (e) { /* ignore */ } }
      Object.assign(sleep, { mode: 0, until: 0, wait: null, waitSince: 0, loopWas: null, fading: false });
    },
    sleepTick() {
      const p = Listen.p;
      if (!sleep.mode) return;
      if (!p) { this.clearSleep(true); return; }
      if (sleep.mode !== 'end') {
        const left = sleep.until - Date.now();
        // the last 10 s: fade out (where the browser lets the page change the volume)
        if (left > 0 && left <= 10000 && p.playing && this.volumeWorks()) {
          sleep.fading = true;
          try { p.audio.volume = this.elemVol() * Math.max(0, left / 10000); } catch (e) { /* ignore */ }
        }
        if (left <= 0) {
          if (this.volumeWorks() || !p.playing) return this.sleepDone();
          // iPhone: no smooth volume — stop at the end of this card (its pause is silence anyway)
          if (sleep.wait == null) { sleep.wait = p.i; sleep.waitSince = Date.now(); }
          else if (p.i !== sleep.wait || Date.now() - sleep.waitSince > 25000) return this.sleepDone();
        }
      }
      document.querySelectorAll('[data-lx-sleepchip]').forEach(x => { x.textContent = this.sleepLeft(); });
      const mb = document.querySelector('#listen-bar [data-lb="more"]'); if (mb) mb.dataset.chip = this.sleepLeft();
    },
    sleepDone() {
      const p = Listen.p;
      this.clearSleep(false, p);
      if (p) { Listen.pause(); try { p.audio.volume = this.elemVol(); } catch (e) { /* ignore */ } }
      chip('🌙 Спокойной ночи — пауза по таймеру сна', { ms: 6000 });
      this.paintAll(); Listen.bar();
    },

    /* ---------- voice commands ---------- */
    run(c) {
      const p = Listen.p; if (!p) return;
      if (c.cmd === 'vol') this.setVolume(this.vol() + c.arg, 'voice');
      else if (c.cmd === 'pause') Listen.pause();
      else if (c.cmd === 'resume') Listen.resume();
      else if (c.cmd === 'next') Listen.jump(1);
      else if (c.cmd === 'prev') Listen.jump(-1);
      else if (c.cmd === 'repeat') Listen.goTo(p.i);
      else if (c.cmd === 'restart') Listen.restart();
      else if (c.cmd === 'grade') this.grade(c.arg);
      else if (c.cmd === 'sleep') this.setSleep(c.arg, false);
      else if (c.cmd === 'stop') {
        Listen.stop();
        const e = this.lastResume();
        if (e) chip('⏹ Остановлено — место запомнено', { ms: 7000, action: { label: '▶ Продолжить', fn: () => this.continueEntry(e) } });
      }
    },
    voiceSetup() {
      const pr = prefs(), sup = Voice.supported();
      const m = UI.modal({
        title: `${MIC(22)} Управление голосом`, cls: 'narrow lxv-modal',
        body: sup ? `<p>Скажите команду — плеер послушается. Работает, пока плеер открыт и <b>экран включён</b>.</p>
            <div class="lxv-lang"><span class="small">Язык команд:</span><div class="seg" role="group" aria-label="Язык голосовых команд">${[['ru', '🇷🇺 Русский'], ['uk', '🇺🇦 Українська']].map(([v, l]) => `<button type="button" data-lxv-lang="${v}" class="${cmdLang() === v ? 'active' : ''}" aria-pressed="${cmdLang() === v}" title="${v === 'uk' ? 'Говорить команды по-украински: «тихіше», «далі», «стоп»' : 'Говорить команды по-русски: «тише», «дальше», «стоп»'}">${l}</button>`).join('')}</div></div>
            <div class="lxv-cmds" data-lxv-cmds>${CMD_WORDS[cmdLang()].map(w => `<span>«${w}»</span>`).join('')}</div>
            <label class="lxv-wake">${UI.switchHtml('lx-wake', Voice.wakeOn(), 'Начинать со слова <b>«Норск»</b> — «Норск, тише»')}</label>
            <div class="tiny muted">Со словом «Норск» приложение не путает команды с собственным голосом — советуем, когда звук идёт через динамик.</div>
            <div class="lxv-note">🔒 <span>Речь распознаёт сам браузер: <b>Chrome отправляет звук в Google</b>, <b>Safari — в Apple</b>. Приложение звук не записывает и не хранит.</span></div>
            <div class="lxv-note">🔒 <span><b>С заблокированным экраном голосовые команды не работают</b> — браузер выключает микрофон. Пока включён 🗣 Переводчик, они тоже молчат: микрофон один.${TTS.IOS ? ' На iPhone, пока слушает микрофон, звук может стать тише — так iOS работает с микрофоном.' : ''}</span></div>`
          : `<p>Этот браузер не умеет распознавать речь. Голосовые команды работают в <b>Chrome</b>, <b>Edge</b> и <b>Safari</b>.</p>`,
        foot: sup ? `<button class="btn ghost" data-lxv-x>${pr.voice ? 'Выключить' : 'Не сейчас'}</button><button class="btn primary" data-lxv-on>${MIC(16)} ${pr.voice ? 'Сохранить' : 'Включить'}</button>` : '<button class="btn" data-lxv-x>Понятно</button>',
      });
      let lang = cmdLang();
      m.el.addEventListener('click', e => {
        const lb = e.target.closest('[data-lxv-lang]');
        if (lb) {
          lang = lb.dataset.lxvLang;
          m.$$('[data-lxv-lang]').forEach(b => { const on = b === lb; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
          const box = m.$('[data-lxv-cmds]'); if (box) box.innerHTML = CMD_WORDS[lang].map(w => `<span>«${w}»</span>`).join('');
          return;
        }
        if (e.target.closest('[data-lxv-x]')) { if (prefs().voice) { setPref({ voice: false }); chip('🎙 Голосовое управление выключено'); } m.close(); Voice.sync(); return; }
        if (e.target.closest('[data-lxv-on]')) {
          const wake = m.$('[data-key="lx-wake"]').checked;
          // the language: «auto» (null) while it matches «Язык перевода», so a later change there is followed
          setPref({ voice: true, voiceOk: true, wake: wake === (prefs().out !== 'headphones') ? null : wake, cmdLang: lang === autoCmdLang() ? null : lang });
          m.close();
          if (Voice.running && Voice.lang !== lang) Voice.stop(); // listen again in the new language
          Voice.sync();
          chip(Listen.p ? `🎙 Слушаю команды${Voice.wakeOn() ? ' — начинайте со слова «Норск»' : ''}` : '🎙 Включено — заработает, когда начнёте слушать', { ms: 4000 });
        }
      });
      return m;
    },
    toggleVoice() { if (prefs().voice && Voice.running) { setPref({ voice: false }); Voice.sync(); chip('🎙 Голосовое управление выключено'); } else this.voiceSetup(); },

    /* ---------- ⬇ offline ---------- */
    offlineChip(deckId) {
      const s = Cache.status(deckId);
      return s.state === 'done' ? '<span class="chip lx-off" title="Озвучка колоды сохранена на этом устройстве — слушать можно без интернета">✓ офлайн</span>' : '';
    },
    dlLabel(deckId) { const s = Cache.status(deckId); return s.state === 'done' ? '✓ Доступно офлайн' : s.state === 'partial' ? '⬇ Докачать озвучку' : '⬇ Скачать озвучку колоды'; },
    async download(deckId) {
      const d = Store.deck(deckId);
      if (!d) { UI.toast('Сначала выберите колоду', 'warn'); return; }
      const items = Cache.items(deckId);
      const voice = window.Voices && Voices.audioEngine('no', 'listen') ? Voices.label('no', '', 'listen') : 'Google (бесплатный)';
      let ctl = null;
      const m = UI.modal({
        title: '⬇ Озвучка колоды — без интернета', cls: 'narrow lxd-modal',
        body: `<div class="lxd-head"><span class="lxd-ico">${HP(28, true)}</span><span><b>${esc(d.name)}</b><small>${items.length} ${U.plural(items.length, ['фраза', 'фразы', 'фраз'])} · голос: ${esc(voice)} · скорость как сейчас</small></span></div>
          <p class="small muted">Слова и переводы сохраняются <b>на этом устройстве</b>. Без интернета колода зазвучит из сохранённых файлов — и в наушниках с выключенным экраном.</p>
          <div class="lxd-st" data-lxd-st></div>
          <div class="lxd-bar"><i data-lxd-fill></i></div>
          <div class="lxd-num small muted" data-lxd-num></div>`,
        foot: `<button class="btn ghost lxd-del" data-lxd="del">🗑 Удалить озвучку</button><button class="btn ghost" data-lxd="cancel" hidden>Остановить</button><button class="btn primary" data-lxd="go"></button>`,
        onClose: () => { if (ctl) ctl.abort(); },
        // while it saves: «Остановить скачивание?» (what is saved stays — «Докачать» goes on later)
        beforeClose: UI.guard(() => !(ctl && !ctl.signal.aborted) ? null : { title: 'Остановить скачивание?', line: 'Уже сохранённые фразы останутся — потом можно докачать.',
          actions: [{ label: 'Остановить', value: 'stop', cls: 'bad' }], cancel: 'Скачивать дальше' }),
      });
      const paint = async (busy) => {
        const s = Cache.status(deckId);
        const stEl = m.$('[data-lxd-st]');
        if (!busy) {
          stEl.innerHTML = s.state === 'done' ? `<span class="lxd-ok">✓ Доступно офлайн</span> · ${mb(s.bytes)} · ${s.n} ${U.plural(s.n, ['фраза', 'фразы', 'фраз'])}`
            : s.state === 'partial' ? `Скачано ${s.n} из ${s.total} · ${mb(s.bytes)} — можно докачать`
              : s.state === 'other' ? 'Скачано другим голосом или для другой скорости — нажмите «Обновить»'
                : `Ещё не скачано · примерно ${mb(items.length * 16000)}`;
          m.$('[data-lxd-fill]').style.width = s.total ? Math.round((s.n || 0) / s.total * 100) + '%' : '0';
        }
        m.$('[data-lxd="go"]').textContent = s.state === 'done' ? '🔄 Проверить и докачать' : s.state === 'partial' ? '⬇ Докачать' : s.state === 'other' ? '🔄 Обновить' : '⬇ Скачать';
        m.$('[data-lxd="del"]').hidden = s.state === 'none' || busy;
        m.$('[data-lxd="go"]').hidden = busy;
        m.$('[data-lxd="cancel"]').hidden = !busy;
        try {
          const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
          if (est && est.quota) m.$('[data-lxd-num]').textContent = `На устройстве свободно ~${mb(est.quota - est.usage)}`;
        } catch (e) { /* ignore */ }
      };
      m.el.addEventListener('click', async e => {
        const b = e.target.closest('[data-lxd]'); if (!b) return;
        if (b.dataset.lxd === 'cancel') { if (ctl) ctl.abort(); return; }
        if (b.dataset.lxd === 'del') {
          if (!(await UI.confirm('Удалить сохранённую озвучку этой колоды с устройства? Без интернета она тогда звучать не будет.', { ok: '🗑 Удалить', danger: true, title: 'Удалить озвучку?' }))) return;
          await Cache.remove(deckId); paint(); UI.toast('Озвучка удалена с устройства', 'good'); return;
        }
        ctl = window.AbortController ? new AbortController() : { abort() { this.signal.aborted = true; }, signal: { aborted: false } };
        paint(true);
        const stEl = m.$('[data-lxd-st]');
        stEl.innerHTML = '<span class="spinner sm"></span> Сохраняю озвучку…';
        try {
          const r = await Cache.download(deckId, {
            signal: ctl.signal,
            onProgress: (n, total, bytes) => { if (!m.el.isConnected) return; m.$('[data-lxd-fill]').style.width = Math.round(n / total * 100) + '%'; stEl.innerHTML = `<span class="spinner sm"></span> ${n} из ${total} · ${mb(bytes)}`; },
          });
          if (m.el.isConnected) { ctl = null; paint(); }
          if (r && r.done) UI.toast(`✓ «${d.name}» доступна офлайн`, 'good');
          else if (r && !(ctl && ctl.signal.aborted)) UI.toast(`Сохранено ${r.n} из ${r.total} — часть фраз голос не отдал; можно докачать позже`, 'warn', 6000);
        } catch (err) {
          ctl = null;
          if (m.el.isConnected) paint();
          if (err.nosource) {
            if (m.el.isConnected) stEl.innerHTML = `<span class="lxd-bad">Голос не отдал звук для сохранения.</span> Бесплатный голос Google в браузере можно только слушать, а не сохранять. Подключите облачный голос (Настройки → Озвучка: Azure — бесплатно 500 000 символов в месяц)${onMac() ? ' или откройте приложение на Mac с мостом' : ''} — и скачайте снова.`;
          } else UI.toast(err.friendly ? err.message : 'Не удалось сохранить озвучку — проверьте интернет и попробуйте ещё раз', 'warn', 6000);
        }
      });
      paint();
      return m;
    },

    /* ---------- «⋯» in the floating bar / a book's player row ---------- */
    morePop(anchor) {
      const p = Listen.p; if (!p) return;
      const c = p.cards[p.i];
      const deck = !p.list && p.o.deckId && !(c && c.raw);
      const pop = UI.popover(anchor, `<div class="pop-title">${HP(18, true)} Ещё</div>
        ${this.volumeHtml()}
        ${c && !c.raw ? this.gradeHtml('pop') : ''}
        ${this.sleepHtml()}
        <div class="lx-pop-row">
          <button type="button" class="np-pill" data-lx="where">${this.outLabel()}</button>
          <button type="button" class="np-pill" data-lx="voice">${MIC(15)} Голос</button>
          <button type="button" class="np-pill" data-lx="dark">🌑 Тёмный экран</button>
          ${deck ? `<button type="button" class="np-pill" data-lx="dl">${this.dlLabel(p.o.deckId)}</button>` : ''}
        </div>`, 'lx-pop');
      pop.el.addEventListener('click', e => { if (e.target.closest('[data-lx]')) pop.close(); });
      this.paintAll();
    },

    /* ---------- everything that shows the extras ---------- */
    paintAll() {
      const v = this.vol(), p = Listen.p;
      document.querySelectorAll('[data-lxv-range]').forEach(r => {
        if (document.activeElement !== r || !r.matches(':active')) r.value = String(Math.round(v * 100));
        r.style.setProperty('--fill', `${(+r.value / (MAX_VOL * 100)) * 100}%`);
      });
      document.querySelectorAll('[data-lxv-out]').forEach(o => { o.textContent = Math.round(v * 100) + '%'; });
      const eff = this.volumeEffective();
      document.querySelectorAll('[data-lx-volnote]').forEach(n => { n.hidden = eff; });
      const sm = sleep.mode;
      document.querySelectorAll('[data-lx-sleep]').forEach(b => b.classList.toggle('active', String(b.dataset.lxSleep) === String(sm || 0)));
      document.querySelectorAll('[data-lx-sleepchip]').forEach(x => { x.textContent = this.sleepLeft(); });
      const c = p && p.cards[p.i];
      document.querySelectorAll('[data-lx-gradebox]').forEach(g => {
        g.hidden = !c || !!c.raw || !!c.media;
        const done = c && p.graded && p.graded[c.id + Listen.gradeDir(p.o)];
        g.querySelectorAll('[data-lx-grade]').forEach(b => b.classList.toggle('chosen', !!done && done.log && String(done.log.g) === b.dataset.lxGrade));
      });
      document.querySelectorAll('[data-lx="where"]').forEach(b => { b.textContent = this.outLabel(); b.classList.toggle('set', !!prefs().out); });
      const pr = prefs();
      document.querySelectorAll('[data-lx="voice"]').forEach(b => { b.classList.toggle('on', !!pr.voice); b.classList.toggle('live', Voice.running); b.innerHTML = `${MIC(15)} ${pr.voice ? (Voice.running ? 'Слушаю команды' : 'Голос: вкл.') : 'Голос'}`; });
      document.querySelectorAll('[data-lx="dl"]').forEach(b => { const id = p && p.o.deckId; if (id) b.textContent = this.dlLabel(id); });
    },
  };

  /* ---------- one handler for every copy of the controls (player, dark-screen menu, «⋯») ---------- */
  document.addEventListener('click', e => {
    const t = e.target;
    const v = t.closest('[data-lxv]'); if (v) { X.setVolume(X.vol() + (v.dataset.lxv === '+' ? 0.1 : -0.1), 'btn'); return; }
    const sl = t.closest('[data-lx-sleep]'); if (sl) { const m = sl.dataset.lxSleep; X.setSleep(m === 'end' ? 'end' : +m); return; }
    const g = t.closest('[data-lx-grade]'); if (g) { X.grade(+g.dataset.lxGrade); return; }
    const a = t.closest('[data-lx]'); if (!a) return;
    const act = a.dataset.lx, p = Listen.p;
    if (act === 'where') X.where();
    if (act === 'voice') X.toggleVoice();
    if (act === 'dark') Listen.dark(true);
    if (act === 'dl' && p && p.o.deckId) X.download(p.o.deckId);
  });
  document.addEventListener('input', e => { if (e.target.matches && e.target.matches('[data-lxv-range]')) { e.target.style.setProperty('--fill', `${(+e.target.value / (MAX_VOL * 100)) * 100}%`); X.setVolume(+e.target.value / 100, 'slider'); } });
  // the dark screen: Esc opens / closes its menu
  document.addEventListener('keydown', e => {
    const d = document.querySelector('.dark-screen'); if (!d || e.key !== 'Escape') return;
    e.preventDefault(); e.stopPropagation();
    const menu = d.querySelector('[data-dsm]');
    Listen.darkMenu(d, menu.hidden);
  }, true);
  document.addEventListener('listen-state', () => {
    const p = Listen.p;
    if (p && p.i !== X._lastI) {
      X._lastI = p.i;
      clearTimeout(X._saveT); X._saveT = setTimeout(() => X.savePos(Listen.p), 1200);
      if (sleep.mode) X.sleepTick();
    }
    X.paintAll();
  });
  document.addEventListener('lx-state', () => X.paintAll());
  document.addEventListener('listen-syspause', () => {
    // the system paused (headphones out on iPhone / Android, a call, Siri): the UI already follows it
    if (prefs().out === 'headphones' && Date.now() - Dev.pausedAt > 2000) chip('⏸ Пауза — звук остановила система (например, отключили наушники)', { ms: 8000, cls: 'warn', action: { label: '▶ Продолжить', fn: () => { Listen.prime(); Listen.resume(); } } });
  });
  document.addEventListener('interp-state', () => Voice.sync());
  document.addEventListener('visibilitychange', () => { if (!visible() && Listen.p) X.savePos(Listen.p); Voice.sync(); });
  window.addEventListener('pagehide', () => { if (Listen.p) X.savePos(Listen.p); });
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', () => Dev.change());

  window.ListenX = X;
})();
