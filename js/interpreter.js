/* ============ 🗣 Interpreter in the headphones ============
 * Someone speaks Norwegian to you -> listening pauses -> the phrase is recognized -> the Russian translation is
 * spoken into your headphones -> a suggested short answer is spoken in Norwegian (repeat it!).
 * You answer in Russian -> you hear how to say it in Norwegian.  "продолжить" / "fortsett" or a few seconds of
 * silence -> listening continues.
 * Recognition: Whisper (Groq — free key, or OpenAI) from the recorded phrase; without a key — the browser's speech
 * recognition (Chrome / Safari). Nothing is stored: the audio is sent for recognition and dropped.
 * Web version: the screen must stay on (use 🌑 dark screen); with the screen off it will work in the app (Capacitor).
 */
(function () {
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  const st = () => Store.settings;
  const MIC = (s = 20, on = false) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="${on ? '#22c55e' : 'none'}" stroke="${on ? '#22c55e' : 'currentColor'}" stroke-width="1.9"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" stroke="${on ? '#22c55e' : 'currentColor'}" stroke-width="1.9" stroke-linecap="round"/></svg>`;
  const RESUME_WORDS = /^(продолж|дальше|fortsett|fortsette|videre|continue|далее|поехали)/i;
  const STOP_WORDS = /^(стоп|хватит|stopp|stop)\b/i;

  function whisperKey() {
    const g = (AI.cfg('groq').key || '').trim(); if (g) return { url: 'https://api.groq.com/openai/v1/audio/transcriptions', key: g, model: 'whisper-large-v3-turbo', name: 'Groq Whisper' };
    const o = (AI.cfg('openai').key || '').trim(); if (o) return { url: 'https://api.openai.com/v1/audio/transcriptions', key: o, model: 'whisper-1', name: 'OpenAI Whisper' };
    return null;
  }
  async function transcribe(blob) {
    const w = whisperKey();
    const fd = new FormData();
    fd.append('file', blob, 'speech.' + (/mp4|aac/.test(blob.type) ? 'm4a' : 'webm'));
    fd.append('model', w.model);
    fd.append('response_format', 'verbose_json');
    fd.append('prompt', 'Norsk bokmål eller russisk. Норвежский или русский.');
    const r = await fetch(w.url, { method: 'POST', headers: { authorization: 'Bearer ' + w.key }, body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || 'распознавание: ошибка ' + r.status);
    return { text: String(j.text || '').trim(), lang: String(j.language || '').toLowerCase() };
  }
  /** speak and wait until done (foreground voice is fine here: the screen is on) */
  function say(text, lang) { return TTS.speak(text, lang, { keep: false, place: 'interpreter' }); }

  const Interp = {
    MIC, on: false, busy: false, log: [],
    opts() {
      const s = st();
      return { sens: s.interpSens != null ? +s.interpSens : 0.5, resume: s.interpResume != null ? +s.interpResume : 6, replies: s.interpReplies !== false, speakReply: s.interpSpeak !== false };
    },
    settingsHtml() {
      const o = this.opts(), w = whisperKey();
      return `<p class="small muted">Вам говорят по-норвежски — прослушивание встаёт на паузу, вы слышите перевод и подсказку ответа. Отвечаете по-русски — слышите, как это сказать по-норвежски. «Продолжить» / «fortsett» — дальше. Записи никуда не сохраняются.</p>
        <div class="small">Распознавание речи: ${w ? `✅ <b>${w.name}</b> — точно и быстро` : (window.SpeechRecognition || window.webkitSpeechRecognition) ? '🟡 встроенное в браузер (для лучшего качества добавьте бесплатный ключ Groq в «Нейросети»)' : '⚠️ нужен бесплатный ключ Groq («Нейросети» → Groq)'}</div>
        <div class="setting"><div><div>Чувствительность микрофона</div><div class="desc">Выше — реагирует на тихую речь (и на шум)</div></div><div class="ctl"><input type="range" min="0" max="1" step="0.1" data-num="interpSens" value="${o.sens}"></div></div>
        <div class="setting"><div><div>Продолжать прослушивание через</div><div class="desc">секунд тишины после перевода (0 — только по команде «продолжить»)</div></div><div class="ctl"><input class="input" type="number" min="0" max="60" data-num="interpResume" value="${o.resume}" style="width:80px"></div></div>
        <div class="setting"><div><div>Подсказывать ответы</div><div class="desc">2 коротких варианта ответа по-норвежски</div></div><div class="ctl">${UI.switchHtml('interpReplies', o.replies)}</div></div>
        <div class="setting"><div><div>Проговаривать подсказку ответа</div><div class="desc">«Можно ответить: Ja, jeg skal gjøre det»</div></div><div class="ctl">${UI.switchHtml('interpSpeak', o.speakReply)}</div></div>
        ${window.Voices && Voices.openChooser ? `<div class="setting"><div><div>Голос переводчика</div><div class="desc">Свой голос для перевода в наушниках — или как везде</div></div><div class="ctl">${Voices.langButtons('interpreter')}</div></div>` : ''}
        <div class="tiny muted">В веб-версии экран должен оставаться включённым (включите 🌑 тёмный экран). С выключенным экраном переводчик заработает в приложении для iPhone / Android.</div>`;
    },

    async toggle() { if (this.on) this.stopListening(); else await this.start(); },

    async start() {
      const o = this.opts();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { UI.toast('Этот браузер не даёт доступ к микрофону', 'bad'); return; }
      if (!whisperKey() && !(window.SpeechRecognition || window.webkitSpeechRecognition)) { Guides.needAI('Переводчик в наушниках'); return; }
      this.on = true;
      this.panel();
      if (whisperKey()) {
        try {
          this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
        } catch (e) { this.on = false; this.panel(); UI.toast('Нет доступа к микрофону — разрешите его в настройках браузера', 'bad', 6000); return; }
        this.vad(o);
      } else this.recognizer();
      this.status('Слушаю окружение… Когда к вам обратятся по-норвежски — переведу в наушники.');
      document.dispatchEvent(new CustomEvent('interp-state'));
      UI.toast('🗣 Переводчик включён. Экран не выключайте — включите 🌑 тёмный экран', 'good', 5000);
    },
    stopListening() {
      this.on = false;
      clearTimeout(this._resumeT);
      try { this.rec && this.rec.state !== 'inactive' && this.rec.stop(); } catch (e) { /* ignore */ }
      try { this.sr && this.sr.abort(); } catch (e) { /* ignore */ }
      if (this.stream) this.stream.getTracks().forEach(t => t.stop());
      if (this.ctx) { try { this.ctx.close(); } catch (e) { /* ignore */ } }
      this.stream = this.ctx = this.sr = this.rec = null;
      cancelAnimationFrame(this._raf);
      this.panel();
      document.dispatchEvent(new CustomEvent('interp-state'));
    },

    /* ---- voice activity detection + recording (for Whisper) ---- */
    vad(o) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      const src = this.ctx.createMediaStreamSource(this.stream);
      const an = this.ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
      const data = new Float32Array(an.fftSize);
      const thr = 0.012 + (1 - o.sens) * 0.05; // more sensitive -> lower threshold
      let speaking = false, loudSince = 0, quietSince = 0, startAt = 0;
      const tick = () => {
        if (!this.on) return;
        an.getFloatTimeDomainData(data);
        let sum = 0; for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length), now = performance.now();
        const meter = document.querySelector('.ip-meter i'); if (meter) meter.style.width = Math.min(100, rms / (thr * 3) * 100) + '%';
        if (!this.busy) {
          if (!speaking) {
            if (rms > thr) { if (!loudSince) loudSince = now; if (now - loudSince > 250) { speaking = true; startAt = now; quietSince = 0; this.beginPhrase(); } } else loudSince = 0;
          } else {
            if (rms < thr * 0.7) { if (!quietSince) quietSince = now; if (now - quietSince > 1100) { speaking = false; loudSince = 0; this.endPhrase(); } } else quietSince = 0;
            if (now - startAt > 20000) { speaking = false; this.endPhrase(); }
          }
        }
        this._raf = requestAnimationFrame(tick);
      };
      tick();
    },
    beginPhrase() {
      this.pauseMedia();
      clearTimeout(this._resumeT);
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
      this.chunks = [];
      try { this.rec = new MediaRecorder(this.stream, mime ? { mimeType: mime } : undefined); } catch (e) { this.rec = new MediaRecorder(this.stream); }
      this.rec.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
      this.rec.start();
      this.status('🎙 Слышу речь… записываю фразу');
    },
    endPhrase() {
      const rec = this.rec; if (!rec || rec.state === 'inactive') return;
      rec.onstop = async () => {
        const blob = new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' });
        if (blob.size < 6000) { this.status('Слушаю окружение…'); this.scheduleResume(); return; } // a cough / noise
        this.busy = true;
        this.status('⏳ Распознаю и перевожу…');
        try {
          const r = await transcribe(blob);
          await this.handle(r.text, r.lang);
        } catch (e) { this.status('⚠️ ' + U.niceErr(e)); }
        this.busy = false;
      };
      rec.stop();
    },

    /* ---- browser speech recognition (no key): Norwegian, continuous ---- */
    recognizer() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const sr = this.sr = new SR();
      sr.lang = 'nb-NO'; sr.continuous = true; sr.interimResults = true;
      sr.onspeechstart = () => { this.pauseMedia(); this.status('🎙 Слышу речь…'); };
      sr.onresult = async e => {
        const res = e.results[e.results.length - 1];
        if (!res.isFinal || this.busy) return;
        // noise turned into "words": "{skip}", one short word with low confidence…
        const tr = String(res[0].transcript || '').trim(), conf = res[0].confidence;
        if (/^[{[(<].*[}\])>]$/.test(tr) || (conf > 0 && conf < 0.45) || (tr.split(/\s+/).length < 2 && tr.length < 5)) return;
        this.busy = true;
        try { await this.handle(res[0].transcript.trim(), ''); } catch (err) { this.status('⚠️ ' + U.niceErr(err)); }
        this.busy = false;
      };
      sr.onerror = e => { if (e.error === 'not-allowed') { UI.toast('Нет доступа к микрофону', 'bad'); this.stopListening(); } };
      sr.onend = () => { if (this.on) { try { sr.start(); } catch (e) { /* restarting */ } } };
      sr.start();
    },

    /* ---- the core: phrase -> translation into the headphones + a suggested answer ---- */
    async handle(text, lang) {
      text = String(text || '').trim();
      // Whisper on silence/noise often returns "{skip}", "[музыка]", "Продолжение следует…", "Subtitles by…"
      if (!text || text.length < 2 || /^[{[(<].*[}\])>]$/.test(text) || /^(продолжение следует|субтитры|subtitles|teksting|takk for at du så)/i.test(text)) { this.status('Слушаю окружение…'); this.scheduleResume(); return; }
      if (RESUME_WORDS.test(text)) { this.resumeMedia(true); return; }
      if (STOP_WORDS.test(text)) { this.stopListening(); UI.toast('🗣 Переводчик выключен', ''); return; }
      const ru = /^(ru|russian)$/.test(lang) || U.cyrRatio(text) > 0.3;
      const o = this.opts();
      let out;
      if (AI.available()) {
        const user = ru
          ? `The learner (Russian speaker living in Norway, learning Norwegian) said in Russian: "${text}". Give the natural Norwegian Bokmål way to say it. Return ONLY JSON {"no":"...","ru":"${text.replace(/"/g, "'")}","note":"short tip in Russian or empty"}`
          : `Someone in Norway said to the learner (a Russian speaker): "${text}". Return ONLY JSON {"heard":"the phrase corrected (Norwegian)","ru":"natural Russian translation","replies":[{"no":"short natural reply in Norwegian","ru":"its Russian meaning"}]} with ${o.replies ? '2 short polite replies that fit (e.g. agreeing / asking to repeat)' : 'an empty replies array'}. If the phrase is not Norwegian, translate it to Russian anyway.`;
        try { out = AI.parseJSON(await AI.call({ system: 'You are a live Norwegian–Russian interpreter. Be brief and natural.', user, maxTokens: 400, temperature: 0.2, quiet: true })); } catch (e) { out = null; }
      }
      if (!out) {
        const r = await Translators.translateMany([text], ru ? 'ru' : 'no', ru ? 'no' : 'ru');
        out = ru ? { no: r.out[0], ru: text } : { heard: text, ru: r.out[0], replies: [] };
      }
      const item = ru ? { kind: 'mine', ru: text, no: out.no || '', note: out.note || '' } : { kind: 'heard', no: out.heard || text, ru: out.ru || '', replies: (out.replies || []).slice(0, 3) };
      this.log.unshift(Object.assign({ t: Date.now() }, item));
      this.renderLog();
      // into the headphones
      if (ru) {
        this.status('🇳🇴 Так по-норвежски:');
        if (item.no) { await say(item.no, 'no'); await new Promise(r => setTimeout(r, 400)); await say(item.no, 'no'); }
      } else {
        this.status('🇷🇺 Перевод:');
        if (item.ru) await say(item.ru, 'ru');
        if (o.speakReply && item.replies.length) {
          await say('Можно ответить', 'ru');
          await say(item.replies[0].no, 'no');
        }
      }
      this.status('Скажите «продолжить» — или подождите, прослушивание продолжится само.');
      this.scheduleResume();
    },

    /* ---- pause / resume whatever was playing ---- */
    pauseMedia() {
      this._wasListening = !!(window.Listen && Listen.p && Listen.p.playing);
      if (this._wasListening) Listen.pause();
      if (TTS.state() === 'playing') { TTS.pause(); this._wasTTS = true; }
      document.querySelectorAll('video, audio').forEach(m => { if (!m.paused && !m.closest('.ip-panel')) { m.pause(); (this._media = this._media || []).push(m); } });
    },
    scheduleResume() {
      clearTimeout(this._resumeT);
      const sec = this.opts().resume;
      if (sec > 0) this._resumeT = setTimeout(() => this.resumeMedia(), sec * 1000);
    },
    resumeMedia(said) {
      clearTimeout(this._resumeT);
      if (this._wasListening && window.Listen && Listen.p) Listen.resume();
      if (this._wasTTS) TTS.resume();
      (this._media || []).forEach(m => m.play().catch(() => {}));
      this._wasListening = this._wasTTS = false; this._media = [];
      if (said) this.status('▶ Продолжаю. Слушаю окружение…');
      else this.status('Слушаю окружение…');
    },

    /** who translates the conversation: a neural network (by meaning, with reply hints) or the free translator —
     *  a tap opens the same «Кто переводит» window, where a network is connected in a minute */
    whoLine(p) {
      const b = p && p.querySelector('[data-ipwho]'); if (!b) return;
      const ai = typeof AI !== 'undefined' && AI.available();
      b.classList.toggle('ai', ai);
      b.innerHTML = ai
        ? `<span>${BOT(20)}</span><span>Переводит нейросеть <b>${U.esc(AI.PROVIDERS[AI.current()].short)}</b> — по смыслу, с подсказками ответа</span><span class="tr-who-go">сменить</span>`
        : '<span>🌐</span><span>Переводит бесплатный переводчик — без подсказок ответа, может ошибаться</span><span class="tr-who-go">⚡ Точнее с нейросетью</span>';
      b.onclick = () => { if (window.TrNotice) { const m = TrNotice.open(); if (m && m.el) { const once = () => this.whoLine(p); const t = setInterval(() => { if (!m.el.isConnected) { clearInterval(t); once(); } }, 500); } } };
    },
    /** ✕ of the panel: while listening it asks — «Свернуть» (it keeps listening) / «Выключить» / «Отмена» */
    async offAsk() {
      if (!this.on) { this.stopListening(); return; }
      if (this._asking) return;
      this._asking = true;
      let r = null;
      try {
        r = await UI.askClose({ title: 'Выключить переводчик?', line: 'Микрофон перестанет слушать. Фразы разговора останутся до выхода из приложения.',
          actions: [{ label: 'Выключить', value: 'off', cls: 'bad' }, { label: 'Свернуть', value: 'min' }] });
      } finally { this._asking = false; }
      if (r === 'off') this.stopListening();
      else if (r === 'min') { const p = document.querySelector('.ip-panel'); if (p) p.classList.add('min'); }
    },
    /* ---- UI: floating panel ---- */
    status(t) { const s = document.querySelector('.ip-panel [data-ips]'); if (s) s.textContent = t; },
    panel() {
      let p = document.querySelector('.ip-panel');
      if (!this.on) { if (p) p.remove(); return; }
      if (!p) {
        p = document.createElement('div'); p.className = 'ip-panel';
        p.innerHTML = `<div class="ip-head">${MIC(20, true)} <b>Переводчик</b><span class="ip-meter"><i></i></span><span class="grow"></span>
            <button class="icon-btn sm" data-ip="min" title="Свернуть">▾</button><button class="icon-btn sm" data-ip="off" title="Выключить переводчик">✕</button></div>
          <div class="small" data-ips></div>
          <div class="tiny muted ip-what">🎙 Это переводчик для <b>живого разговора</b>: микрофон слушает людей рядом и переводит в наушники. Чтобы <b>слушать карточки</b> — кнопка «🎧 Слушать колоду» слева или 🎧 вверху (переводчик тогда сам поставит их на паузу, если к вам обратятся). Не нужен — ✕.</div>
          <span class="ip-trb" data-iptrb></span>
          <div class="ip-log" data-iplog></div>
          <div class="row" style="gap:6px;margin-top:6px"><button class="btn sm" data-ip="resume">▶ Продолжить прослушивание</button><button class="btn sm" data-ip="dark">🌑 Тёмный экран</button><button class="btn sm ghost" data-ip="save">➕ Фразы в колоду</button>${Listen.hereBtn('.ip-log', 'Разговор', 'Прослушать разговор')}</div>`;
        p.addEventListener('click', e => {
          const a = e.target.closest('[data-ip]'); if (!a) { const s = e.target.closest('[data-say]'); if (s) TTS.speak(s.dataset.say, s.dataset.lang || 'no', { place: 'interpreter' }); return; }
          ({ off: () => this.offAsk(), min: () => p.classList.toggle('min'), resume: () => this.resumeMedia(true), dark: () => Listen.dark(true), save: () => this.saveToDeck() })[a.dataset.ip]();
        });
        document.body.appendChild(p);
        if (window.TrBadge) TrBadge.mount(p.querySelector('[data-iptrb]'), { place: 'interpreter' }); // 🌐 who translates now
      }
      this.whoLine(p); // (no-op now: the shared «кто переводит» badge replaced the old line)
      this.renderLog();
    },
    renderLog() {
      const box = document.querySelector('.ip-panel [data-iplog]'); if (!box) return;
      box.innerHTML = this.log.slice(0, 12).map(x => x.kind === 'heard'
        ? `<div class="ip-item"><div>🇳🇴 <b>${U.esc(x.no)}</b> <button class="icon-btn sm" data-say="${U.esc(x.no)}" data-lang="no">🔊</button></div><div class="ru-text">🇷🇺 ${U.esc(x.ru)}</div>
            ${x.replies && x.replies.length ? `<div class="ip-replies">${x.replies.map(r => `<button class="chip" data-say="${U.esc(r.no)}" data-lang="no">💬 ${U.esc(r.no)} <span class="ru-text">(${U.esc(r.ru)})</span></button>`).join('')}</div>` : ''}</div>`
        : `<div class="ip-item mine"><div class="ru-text">🗣 ${U.esc(x.ru)}</div><div>🇳🇴 <b>${U.esc(x.no)}</b> <button class="icon-btn sm" data-say="${U.esc(x.no)}" data-lang="no">🔊</button></div>${x.note ? `<div class="small muted">💡 ${U.esc(x.note)}</div>` : ''}</div>`).join('');
    },
    saveToDeck() {
      const items = this.log.filter(x => x.no && x.ru);
      if (!items.length) { UI.toast('Пока нет фраз', 'warn'); return; }
      let d = Store.decks().find(x => x.name === '🗣 Живые разговоры');
      if (!d) d = Store.addDeck('🗣 Живые разговоры', 'Фразы, которые мне говорили и которые я отвечал — из переводчика в наушниках');
      const have = new Set(Store.cards(d.id).map(c => U.norm(c.no)));
      let n = 0;
      items.forEach(x => {
        [[x.no, x.ru]].concat((x.replies || []).map(r => [r.no, r.ru])).forEach(([no, ru]) => {
          if (!no || have.has(U.norm(no))) return;
          have.add(U.norm(no)); n++;
          Store.addCard(d.id, { no, ru, tags: ['samtale'], description: `🗣 Из разговора · ${new Date(x.t).toLocaleString('ru-RU')}`, history: [Prov.entry('import', 'create', null, 'переводчик в наушниках')] });
        });
      });
      UI.toast(n ? `Сохранено ${U.cards(n)} в «${d.name}»` : 'Эти фразы уже есть в колоде', 'good');
    },
  };

  /* the 🗣 button: muted when off, green and pulsing while listening */
  const paint = () => {
    const b = document.getElementById('interp-btn'); if (!b) return;
    b.innerHTML = MIC(20, Interp.on) + '<span class="lbl-t">Переводчик</span>';
    b.setAttribute('aria-label', Interp.on ? 'Переводчик включён — нажмите, чтобы выключить' : 'Переводчик: слушает людей вокруг и переводит в наушники');
    b.classList.toggle('on', Interp.on);
  };
  document.addEventListener('interp-state', paint);
  document.addEventListener('DOMContentLoaded', paint);
  setTimeout(paint, 0);

  window.Interp = Interp;
})();
