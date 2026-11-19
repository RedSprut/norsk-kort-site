/* ============ 🎙 Voices: better Norwegian, Russian & Ukrainian voices (male / female), free first, then with an API key ============
 * Engines: system (browser) · Google Translate · Microsoft Edge neural (free, via the Mac bridge)
 *          · Azure Speech (free 500k chars/month) · Google Cloud TTS · ElevenLabs.
 * Cloud audio is cached per text+voice+speed, so a card is synthesized only once per session.
 * If an engine fails (no key, limit, offline) the app falls back to the system voice and says why once.
 */
(function () {
  const F = '♀', M = '♂';
  const CHIRP = [['Kore', F], ['Aoede', F], ['Leda', F], ['Zephyr', F], ['Charon', M], ['Puck', M], ['Fenrir', M], ['Orus', M]];
  const ENGINES = {
    system: {
      name: 'Системные голоса', icon: '💻', free: true, where: 'везде', quality: 'зависит от устройства',
      desc: 'Голоса вашего устройства. Бесплатно и офлайн. Качество сильно лучше, если скачать «улучшенные» голоса (инструкция ниже).',
    },
    piper: {
      name: 'Piper — офлайн норвежский голос (бесплатно)', icon: '📴', free: true, offline: true,
      where: 'Chrome, Edge, Safari (Mac, iPhone, Android) — после скачивания без интернета', quality: 'хорошо (нейросеть, 1 норвежский голос)',
      desc: 'Нейросетевой голос «talesyntese» (Piper, лицензия MIT; запись — Språkbanken, CC0) работает прямо на устройстве: один раз скачать ≈ 80–100 МБ — дальше без интернета и без ключей. Читает только норвежский; русский текст звучит вашим обычным (системным) голосом.',
    },
    google: {
      name: 'Google Translate (онлайн)', icon: '🌐', free: true, where: 'везде, нужен интернет', quality: 'средне, 1 голос',
      desc: 'Голос Google Переводчика: один голос на язык, без выбора. Бесплатно, неофициально — может иногда не отвечать.',
    },
    edge: {
      name: 'Microsoft Edge — нейроголоса', icon: '🆓', free: true, bridge: true, where: 'только на Mac с мостом', quality: 'отлично (нейросеть)',
      desc: 'Те же живые нейроголоса, что в Azure, но бесплатно — через мост на Mac. Один раз установите модуль: в Терминале  pip3 install edge-tts  и перезапустите мост. Неофициальный сервис Microsoft — для личного использования, может однажды перестать работать.',
      voices: { no: [['nb-NO-PernilleNeural', 'Pernille', F], ['nb-NO-FinnNeural', 'Finn', M]], ru: [['ru-RU-SvetlanaNeural', 'Светлана', F], ['ru-RU-DmitryNeural', 'Дмитрий', M]], uk: [['uk-UA-PolinaNeural', 'Поліна', F], ['uk-UA-OstapNeural', 'Остап', M]] },
    },
    azure: {
      name: 'Microsoft Azure Speech', icon: '🔑', where: 'везде (iPhone тоже)', quality: 'отлично (нейросеть)', price: 'бесплатно 500 000 символов в месяц (тариф F0), дальше ≈ $15 за 1 млн',
      keyUrl: 'https://portal.azure.com/#create/Microsoft.CognitiveServicesSpeechServices',
      steps: ['Войдите на portal.azure.com (бесплатный аккаунт Microsoft; карта нужна только для проверки)', 'Create a resource → «Speech» → Pricing tier: Free F0 → регион, например West Europe', 'Откройте ресурс → Keys and Endpoint → скопируйте KEY 1 и Location/Region (например westeurope)', 'Вставьте ключ и регион сюда и нажмите «▶ Прослушать»'],
      desc: 'Официальные нейроголоса Microsoft: 3 норвежских, 3 русских и 2 украинских, мужские и женские. Работает прямо из браузера — и на iPhone.',
      voices: { no: [['nb-NO-PernilleNeural', 'Pernille', F], ['nb-NO-IselinNeural', 'Iselin', F], ['nb-NO-FinnNeural', 'Finn', M]], ru: [['ru-RU-SvetlanaNeural', 'Светлана', F], ['ru-RU-DariyaNeural', 'Дарья', F], ['ru-RU-DmitryNeural', 'Дмитрий', M]], uk: [['uk-UA-PolinaNeural', 'Поліна', F], ['uk-UA-OstapNeural', 'Остап', M]] },
    },
    gcloud: {
      name: 'Google Cloud Text-to-Speech', icon: '🔑', where: 'везде (iPhone тоже)', quality: 'отлично (Chirp 3 HD)', price: 'бесплатно 1 млн символов в месяц (Chirp 3 HD), дальше $30 за 1 млн; нужен платёжный аккаунт Google Cloud',
      keyUrl: 'https://console.cloud.google.com/apis/library/texttospeech.googleapis.com',
      steps: ['console.cloud.google.com → создайте проект и подключите платёжный аккаунт (бесплатный лимит не списывается)', 'APIs & Services → Library → «Cloud Text-to-Speech API» → Enable', 'Credentials → Create credentials → API key; ограничьте ключ: только Text-to-Speech API и адрес вашего сайта', 'Вставьте ключ сюда'],
      desc: 'Самый большой выбор норвежских голосов (около 30 мужских и женских). Работает прямо из браузера.',
      voices: { no: CHIRP.map(([n, g]) => ['nb-NO-Chirp3-HD-' + n, n, g]), ru: CHIRP.map(([n, g]) => ['ru-RU-Chirp3-HD-' + n, n, g]),
        uk: CHIRP.map(([n, g]) => ['uk-UA-Chirp3-HD-' + n, n, g]).concat([['uk-UA-Wavenet-A', 'Wavenet A', F], ['uk-UA-Standard-A', 'Standard A', F]]) },
    },
    eleven: {
      name: 'ElevenLabs', icon: '🔑', where: 'везде (iPhone тоже)', quality: 'премиум, очень живые', price: 'бесплатно ≈10 000 символов в месяц (некоммерческое использование), платно от $6 в месяц',
      keyUrl: 'https://elevenlabs.io/app/settings/api-keys',
      steps: ['Зарегистрируйтесь на elevenlabs.io', 'Profile → API Keys → Create API key (права: Text to Speech)', 'Вставьте ключ сюда; кнопка «Загрузить мои голоса» покажет голоса из вашей библиотеки'],
      desc: 'Самые живые голоса, один голос говорит и по-норвежски, и по-русски, и по-украински (модель Flash v2.5). Бесплатного лимита хватит примерно на 300–500 карточек в месяц.',
      voices: {
        // premade voices usable on free accounts (ElevenLabs may retire them — «Загрузить мои голоса» shows what your account has)
        no: [['EXAVITQu4vr4xnSDxMaL', 'Sarah', F], ['JBFqnCBsd6RMkjVDRZzb', 'George', M], ['onwK4e9ZLuTAKqWW03F9', 'Daniel', M]],
        ru: [['EXAVITQu4vr4xnSDxMaL', 'Sarah', F], ['JBFqnCBsd6RMkjVDRZzb', 'George', M], ['onwK4e9ZLuTAKqWW03F9', 'Daniel', M]],
        uk: [['EXAVITQu4vr4xnSDxMaL', 'Sarah', F], ['JBFqnCBsd6RMkjVDRZzb', 'George', M], ['onwK4e9ZLuTAKqWW03F9', 'Daniel', M]],
      },
    },
  };
  const CLOUD = ['piper', 'edge', 'azure', 'gcloud', 'eleven']; // engines that make audio files (Piper: on the device)
  const cache = new Map();
  const inflight = new Map(); // the same text asked twice at once (player start, prefetch) -> one request
  const warned = {};
  let playGen = 0;
  const pct = rate => { const p = Math.round((rate / 0.9 - 1) * 100); return (p >= 0 ? '+' : '') + Math.max(-60, Math.min(100, p)) + '%'; };
  const xml = s => String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

  const Voices = {
    ENGINES, CLOUD,
    isCloud(id) { return CLOUD.includes(id); },
    /** chosen voice of an engine for a language (default: the first = female; the user picks in Settings) */
    voice(engine, lang) {
      const pref = ((Store.settings.cloudVoices || {})[engine] || {})[lang];
      const list = (this.custom[engine] && this.custom[engine][lang]) || (ENGINES[engine].voices || {})[lang] || [];
      return pref || (list[0] || [])[0] || '';
    },
    custom: {}, // ElevenLabs: voices loaded from the user's own library
    ready(engine) {
      const s = Store.settings;
      if (engine === 'piper') return !!(window.Speech && Speech.piper.isReady());
      if (engine === 'edge') return !!(window.AI && AI.bridge.up);
      if (engine === 'azure') return !!(s.azureKey || '').trim() && !!(s.azureRegion || '').trim();
      if (engine === 'gcloud') return !!(s.gcloudKey || '').trim();
      if (engine === 'eleven') return !!(s.elevenKey || '').trim();
      return true;
    },

    /** text -> blob URL of the audio (cached) */
    async synth(engine, text, lang, rate, voiceOverride) {
      const voice = voiceOverride || this.voice(engine, lang);
      const key = [engine, voice, lang, rate.toFixed(2), text].join('|');
      if (cache.has(key)) return cache.get(key);
      if (inflight.has(key)) return inflight.get(key);
      const job = this._make(engine, text, lang, rate, voice, key);
      inflight.set(key, job);
      job.then(() => inflight.delete(key), () => inflight.delete(key));
      return job;
    },
    async _make(engine, text, lang, rate, voice, key) {
      const s = Store.settings;
      // Piper speaks only Norwegian: Russian goes to the usual voices, without a warning
      if (engine === 'piper' && lang !== 'no') throw Object.assign(new Error('Piper читает только норвежский'), { quiet: true });
      // no voice of this engine for the language (🇺🇦 in an old ElevenLabs list): the usual voices, without a warning
      if (engine !== 'piper' && !voice) throw Object.assign(new Error('нет голоса для этого языка'), { quiet: true });
      if (!this.ready(engine)) throw new Error(engine === 'edge' ? 'мост на Mac не запущен'
        : engine === 'piper' ? (window.Speech && Speech.piper.available() ? 'голос ещё не скачан — Настройки → Озвучка → Piper → «Скачать»' : 'не работает в этом браузере')
        : 'нет ключа — добавьте его в Настройках → Озвучка');
      let blob;
      if (engine === 'piper') {
        blob = await Speech.piper.synth(text, rate);
      } else if (engine === 'edge') {
        const r = await fetch(`/api/tts?voice=${encodeURIComponent(voice)}&rate=${encodeURIComponent(pct(rate))}&text=${encodeURIComponent(text)}`);
        if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'ошибка ' + r.status); }
        blob = await r.blob();
      } else if (engine === 'azure') {
        const region = s.azureRegion.trim().toLowerCase().replace(/\s+/g, '');
        const loc = voice.slice(0, 5);
        const ssml = `<speak version='1.0' xml:lang='${loc}'><voice name='${voice}'><prosody rate='${pct(rate)}'>${xml(text)}</prosody></voice></speak>`;
        const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: 'POST', body: ssml,
          headers: { 'Ocp-Apim-Subscription-Key': s.azureKey.trim(), 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3' },
        });
        if (!r.ok) throw new Error(r.status === 401 ? 'неверный ключ или регион' : r.status === 429 ? 'лимит запросов, подождите' : 'ошибка ' + r.status);
        blob = await r.blob();
      } else if (engine === 'gcloud') {
        const r = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(s.gcloudKey.trim())}`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ input: { text }, voice: { languageCode: voice.slice(0, 5), name: voice }, audioConfig: { audioEncoding: 'MP3', speakingRate: Math.max(0.25, Math.min(2, rate / 0.9)) } }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((j.error && j.error.message) || 'ошибка ' + r.status);
        const bin = atob(j.audioContent || '');
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        blob = new Blob([bytes], { type: 'audio/mpeg' });
      } else if (engine === 'eleven') {
        const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
          method: 'POST', headers: { 'xi-api-key': s.elevenKey.trim(), 'content-type': 'application/json' },
          body: JSON.stringify({ text, model_id: 'eleven_flash_v2_5', language_code: lang === 'no' ? 'no' : lang === 'uk' ? 'uk' : 'ru', voice_settings: { speed: Math.max(0.7, Math.min(1.2, rate / 0.9)) } }),
        });
        if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(r.status === 401 ? 'неверный ключ' : ((j.detail && (j.detail.message || j.detail.status)) || 'ошибка ' + r.status)); }
        blob = await r.blob();
      }
      const url = URL.createObjectURL(blob);
      cache.set(key, url);
      return url;
    },

    /** play one piece through TTS._audio (so pause / resume / stop of the player work) */
    async play(engine, text, lang, rate, p) {
      if (engine === 'piper' && lang !== 'no') return TTS._utter(text, lang, { local: true, rate }, p); // Russian: the usual voice
      const gen = ++playGen;
      const url = await this.synth(engine, text, lang, rate);
      if (p && p !== TTS.player) return;
      if (!p && gen !== playGen) return; // a newer one-off phrase started while this one was being made
      return new Promise((resolve, reject) => {
        const a = new Audio(url);
        // ElevenLabs speed is limited to 0.7–1.2: the rest by playback speed
        if (engine === 'eleven') a.playbackRate = Math.max(0.5, Math.min(1.6, (rate / 0.9) / Math.max(0.7, Math.min(1.2, rate / 0.9))));
        TTS._audio = a;
        const end = () => { if (TTS._audio === a) TTS._audio = null; resolve(); };
        a.onended = end;
        a.onerror = () => { if (TTS._audio === a) TTS._audio = null; reject(new Error('не удалось проиграть звук')); };
        // stopped / replaced before it began (TTS.stop → pause): not an engine failure
        a.play().catch(e => { if (e && e.name === 'AbortError') end(); else reject(e); });
      });
    },
    warn(engine, e) {
      if (warned[engine] || (e && e.quiet)) return;
      warned[engine] = true;
      UI.toast(`${ENGINES[engine].name}: ${e.message} — читаю системным голосом`, 'warn', 6000);
    },
    resetWarnings() { Object.keys(warned).forEach(k => delete warned[k]); },

    /** ElevenLabs: voices from the user's own library */
    async loadElevenVoices() {
      const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': (Store.settings.elevenKey || '').trim() } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status === 401 ? 'неверный ключ' : 'ошибка ' + r.status);
      const list = (j.voices || []).map(v => [v.voice_id, v.name, ((v.labels || {}).gender || '') === 'male' ? M : ((v.labels || {}).gender || '') === 'female' ? F : '']);
      this.custom.eleven = { no: list, ru: list, uk: list };
      return list.length;
    },

    /* ---------- Settings panel ---------- */
    settingsHtml() {
      const s = Store.settings;
      const cur = s.ttsEngine || 'auto';
      const opt = (id, label) => `<option value="${id}" ${cur === id ? 'selected' : ''}>${label}</option>`;
      const voiceSel = (eng, lang) => {
        const list = (this.custom[eng] && this.custom[eng][lang]) || (ENGINES[eng].voices || {})[lang] || [];
        const v = this.voice(eng, lang);
        return `<select class="input" data-cvoice="${eng}.${lang}">${list.map(([id, n, g]) => `<option value="${U.esc(id)}" ${id === v ? 'selected' : ''}>${g} ${U.esc(n)}</option>`).join('')}</select>`;
      };
      const card = (id) => {
        const e = ENGINES[id];
        const ok = this.ready(id);
        const keyFields = {
          azure: `<div class="field-row"><label class="field"><span>Ключ Azure Speech</span><input class="input" type="password" data-text="azureKey" value="${U.esc(s.azureKey || '')}" autocomplete="off"></label>
                  <label class="field"><span>Регион (Location)</span><input class="input" data-text="azureRegion" value="${U.esc(s.azureRegion || '')}" placeholder="westeurope"></label></div>`,
          gcloud: `<label class="field"><span>API-ключ Google Cloud</span><input class="input" type="password" data-text="gcloudKey" value="${U.esc(s.gcloudKey || '')}" autocomplete="off" placeholder="AIza…"></label>`,
          eleven: `<label class="field"><span>API-ключ ElevenLabs</span><input class="input" type="password" data-text="elevenKey" value="${U.esc(s.elevenKey || '')}" autocomplete="off"></label>`,
        }[id] || '';
        return `<details class="prov voice-eng" ${cur === id ? 'open' : ''}><summary>${e.icon} <b>${U.esc(e.name)}</b>
            ${e.free ? '<span class="chip learned">бесплатно</span>' : '<span class="chip learning">ключ</span>'}${ok && id !== 'system' && id !== 'google' ? '<span class="chip learned">✓ готово</span>' : ''}${cur === id ? '<span class="chip due">★ выбрано</span>' : ''}</summary>
          <div class="col" style="padding:10px 2px 4px">
            <div class="small">${U.esc(e.desc)}</div>
            <div class="small muted">Качество: ${U.esc(e.quality)} · Где работает: ${U.esc(e.where)}${e.price ? ' · ' + U.esc(e.price) : ''}</div>
            ${e.steps ? `<ol class="small voice-steps">${e.steps.map(x => `<li>${U.esc(x)}</li>`).join('')}</ol><a class="small" href="${e.keyUrl}" target="_blank" rel="noopener">Получить ключ →</a>` : ''}
            ${id === 'piper' ? this.piperHtml() : ''}
            ${id === 'edge' ? `<div class="small">${AI.bridge.up ? '✓ Мост запущен.' : '⚠️ Мост не запущен: в Терминале  <code style="user-select:all">python3 "/Users/sprut/Norsk - Russisk/bridge/server.py"</code>'} Один раз: <code style="user-select:all">pip3 install edge-tts</code></div>` : ''}
            ${id === 'system' ? this.systemUkHtml() : ''}
            ${id === 'system' ? `<div class="small voice-steps"><b>Как получить лучшие системные голоса:</b><br>
              <b>Mac:</b> Системные настройки → Универсальный доступ → Устный контент → Системный голос → Управлять голосами → Норвежский: <b>Nora (улучшенный)</b> ♀, <b>Henrik</b> ♂; Русский: <b>Milena</b> ♀, <b>Yuri</b> ♂, <b>Katya (улучшенный)</b> ♀; Украинский: <b>Lesya</b> ♀. Затем выберите голос выше.<br>
              <b>iPhone / iPad:</b> Настройки → Универсальный доступ → Устный контент → Голоса → Норвежский / Русский / Украинский → скачайте «улучшенный». В Safari на iPhone выбор конкретного голоса иногда не работает — тогда звучит голос по умолчанию для языка.<br>
              <b>Android:</b> Настройки → Озвучивание текста (Text-to-speech) → Синтезатор речи Google → Установить голосовые данные → Norsk, Русский и Українська.<br>
              <b>Windows:</b> Параметры → Время и язык → Речь → Добавить голоса (норвежский, русский, украинский) — или откройте приложение в Microsoft Edge: там есть онлайн-нейроголоса.</div>` : ''}
            ${keyFields}
            ${e.voices ? `<div class="field-row"><label class="field"><span>🇳🇴 Норвежский голос</span>${voiceSel(id, 'no')}</label><label class="field"><span>🇷🇺 Русский голос</span>${voiceSel(id, 'ru')}</label>${e.voices.uk ? `<label class="field"><span>🇺🇦 Украинский голос</span>${voiceSel(id, 'uk')}</label>` : ''}</div>` : ''}
            <div class="row" style="gap:6px">
              ${cur !== id ? `<button class="btn sm primary" data-act="voice-use" data-id="${id}">★ Использовать</button>` : ''}
              <button class="btn sm" data-act="voice-test" data-id="${id}" data-lang="no">▶ Прослушать 🇳🇴</button>
              <button class="btn sm" data-act="voice-test" data-id="${id}" data-lang="ru">▶ Прослушать 🇷🇺</button>
              ${id !== 'piper' ? `<button class="btn sm" data-voice-uk-test="${id}">▶ Прослушать 🇺🇦</button>` : ''}
              ${id === 'eleven' ? '<button class="btn sm" data-act="voice-eleven">⬇ Загрузить мои голоса</button>' : ''}
            </div></div></details>`;
      };
      return `<div class="small muted">Выберите движок озвучки. Бесплатные — сверху, с ключом — ниже. У каждого можно выбрать мужской ♂ или женский ♀ голос. Если выбранный не сработает (нет ключа, лимит, нет интернета) — приложение само перейдёт на системный голос и скажет почему.</div>
        <label class="field"><span>Движок</span><select class="input" data-sel="ttsEngine">
          ${opt('auto', 'Авто — системный голос, если есть норвежский, иначе Google')}${opt('browser', '💻 Системные голоса')}${opt('google', '🌐 Google Translate (онлайн)')}${opt('piper', '📴 Piper — офлайн норвежский голос (бесплатно)')}
          ${opt('edge', '🆓 Microsoft Edge нейроголоса (мост на Mac)')}${opt('azure', '🔑 Azure Speech (500 000 симв./мес бесплатно)')}${opt('gcloud', '🔑 Google Cloud TTS')}${opt('eleven', '🔑 ElevenLabs')}</select></label>
        <div class="voice-list">${['system', 'google', 'piper', 'edge', 'azure', 'gcloud', 'eleven'].map(card).join('')}</div>`;
    },
  };

  /** 💻 system card: the device's Ukrainian voice (saved as Store.settings.voiceUk by the settings' data-sel handler) */
  Voices.systemUkHtml = function () {
    const list = TTS.voicesFor('uk'), cur = Store.settings.voiceUk || '';
    const sel = `<select class="input" data-sel="voiceUk"><option value="">Авто${list.length ? '' : ' (нет голоса → онлайн-голос Google)'}</option>${list.map(v => `<option ${v.name === cur ? 'selected' : ''}>${U.esc(v.name)}</option>`).join('')}</select>`;
    return `<label class="field"><span>🇺🇦 Системный украинский голос</span>${sel}</label>
      ${list.length ? '<div class="small">✓ Украинский голос на устройстве есть.</div>' : `<div class="small">⚠️ Украинского голоса на этом устройстве нет — украинский текст читает онлайн-голос Google (или выбранный облачный голос), но никогда русский голос.</div>${TTS.ukHelpHtml()}`}`;
  };
  const UK_SAMPLE = 'Привіт! Як у тебе сьогодні справи?';
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-voice-uk-test]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const id = b.dataset.voiceUkTest;
    if (!Voices.isCloud(id)) {
      const prev = Store.settings.ttsEngine;
      Store.settings.ttsEngine = id === 'system' ? 'browser' : 'google';
      TTS.speak(UK_SAMPLE, 'uk'); // the engine is chosen synchronously — the setting can be put back right away
      Store.settings.ttsEngine = prev;
      return;
    }
    b.disabled = true;
    try { TTS.stop(); await Voices.play(id, UK_SAMPLE, 'uk', TTS.currentRate()); }
    catch (err) { UI.toast(`${ENGINES[id].name}: ${err.message}`, 'bad', 6000); }
    b.disabled = false;
  }, true);

  /** 📴 Piper card: download / delete (the work is done by speech.js) */
  Voices.piperHtml = function () {
    if (!window.Speech) return '<div class="small muted">⚠️ Модуль речи не загружен.</div>';
    if (!Speech.piper.available()) return '<div class="small">⚠️ Этот браузер не умеет запускать офлайн-голос (нужны WebAssembly и Cache API) — выберите другой движок.</div>';
    return Speech.piper.isReady()
      ? '<div class="small">✅ Голос скачан — работает без интернета. <button class="btn sm ghost" data-piper-del>🗑 Удалить голос</button></div>'
      : '<div class="small">Голос ещё не скачан. <button class="btn sm primary" data-piper-dl>⬇ Скачать голос (один раз)</button></div>';
  };
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-piper-dl], [data-piper-del]');
    if (!b || !window.Speech) return;
    e.preventDefault();
    if (b.hasAttribute('data-piper-dl')) {
      if (await Speech.piper.download()) { Voices.resetWarnings(); if (window.App && App.render) App.render(); }
      return;
    }
    if (!await UI.confirm('Удалить офлайн-голос Piper с этого устройства? Понадобится — скачаете снова.', { ok: 'Удалить', danger: true })) return;
    await Speech.piper.remove();
    if (Store.settings.ttsEngine === 'piper') Store.setSetting('ttsEngine', 'auto');
    [...cache.keys()].filter(k => k.startsWith('piper|')).forEach(k => { URL.revokeObjectURL(cache.get(k)); cache.delete(k); });
    if (window.App && App.render) App.render();
  });

  window.Voices = Voices;
})();
