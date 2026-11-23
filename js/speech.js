/* ============ 🗣 Speech: pronunciation check, dictation, offline Norwegian recognition and voice ============
 * Recognition: NB-Whisper (Nasjonalbiblioteket, Apache-2.0, ONNX q4f16 by PierreMesure) in the browser via
 *   transformers.js. Two sizes — «Лёгкое» = base (phones, weak machines; WASM, ≈110 MB incl. the ONNX runtime) and
 *   «Точное» = small (computers with WebGPU; ≈580 MB, WER on FLEURS 8.3 vs 11.5 for base). «Авто» picks by the device.
 *   Downloaded once with the user's consent, kept in the Cache API ('norsk-kort-models') — afterwards it works
 *   without internet. Fallback: the browser's own speech recognition (webkitSpeechRecognition, nb-NO) — that one may
 *   send audio to Google / Apple.
 * Voice: Piper (MIT) via onnxruntime-web + espeak-ng (piper_phonemize WASM, GPL-3.0 — fetched from the CDN at run time,
 *   never kept in this repository). Voices: 🇳🇴 talesyntese / nvcc (10 speakers), 🇷🇺 denis / dmitri / irina,
 *   🇺🇦 tetiana / mykyta / oleksa «high» and ukrainian_tts (3 speakers, letters instead of phonemes) — see PIPER_VOICES.
 *   Registered as a voice engine in voices.js ('piper'); each voice is its own download, the runtime is shared.
 * Everything heavy is loaded lazily, only when the user starts it.
 */
(function () {
  const MC = 'norsk-kort-models';                                   // Cache API bucket for all model files
  const TJS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/';
  const ORT_BUNDLE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0-dev.20250409-89f8206ba4/dist/ort.webgpu.bundle.min.mjs';
  const PH_JS = 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.5/dist/piper-o91UDS6e.js';
  const PH_WASM = 'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/piper_phonemize';
  // small's encoder on the GPU: 'fp32' (353 MB) — ≈1.2 s per phrase on an M2 in Chrome, ≈2.7 s in Safari/WebKit;
  // 'q4' (66 MB) gives the same text but ≈2.3 s (Chrome) / ≈4.7 s (WebKit: slower than real time)
  const SMALL_ENC = 'fp32';
  // the two recognition models: «Лёгкое» (base) for phones and weak machines, «Точное» (small) for computers with WebGPU
  const ASR = {
    // q4f16 runs on WASM (CPU) only — on WebGPU it babbles; base stays on WASM everywhere (≈1× real time on an M2)
    base: { repo: 'PierreMesure/nb-whisper-base-ONNX', group: 'asr', name: 'NB-Whisper base', label: 'Лёгкое (быстрее)', dtype: { encoder_model: 'q4f16', decoder_model_merged: 'q4f16' } },
    // WebGPU needs a fp32 / q4 encoder and the q4 decoder (fp16, q4f16 and q8 give garbage in transformers.js 3.8)
    small: { repo: 'PierreMesure/nb-whisper-small-ONNX', group: 'asrSmall', name: 'NB-Whisper small', label: 'Точное (компьютер)', dtype: { encoder_model: SMALL_ENC, decoder_model_merged: 'q4' } },
  };
  const ASR_BASE = 'https://huggingface.co/' + ASR.base.repo + '/resolve/main/';
  const SMALL_ENC_FILE = SMALL_ENC === 'fp32' ? 'onnx/encoder_model.onnx' : 'onnx/encoder_model_' + SMALL_ENC + '.onnx';
  const ASR_SMALL = 'https://huggingface.co/' + ASR.small.repo + '/resolve/main/';
  const VOICE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/no/no_NO/talesyntese/medium/no_NO-talesyntese-medium.onnx';
  // the other Piper voices come from a pinned revision of rhasspy/piper-voices (sizes checked after the download);
  // talesyntese keeps its old address, so a voice that is already downloaded stays valid
  const PV = 'https://huggingface.co/rhasspy/piper-voices/resolve/e929968c3761f1c281875787685a745863db838d/';
  /** key -> [path, .onnx bytes, .json bytes, data licence, speakers (multi-speaker models)] */
  const PIPER_VOICES = {
    'no_NO-talesyntese-medium': [null, 63221984, 6256, 'CC0'],
    'no_NO-nvcc-medium': ['no/no_NO/nvcc/medium/', 76770227, 5397, 'CC0', ['KNN', 'KSV', 'MMN', 'KON', 'MNN', 'MSV', 'MON', 'MNV', 'KMN', 'KNV']],
    'ru_RU-denis-medium': ['ru/ru_RU/denis/medium/', 63221984, 6196, 'CC0'],
    'ru_RU-dmitri-medium': ['ru/ru_RU/dmitri/medium/', 63221984, 6197, 'CC0'],
    'ru_RU-irina-medium': ['ru/ru_RU/irina/medium/', 63201294, 4765, 'неизвестна (данные RHVoice)'],
    'uk_UA-tetiana-high': ['uk/uk_UA/tetiana/high/', 114204024, 4905, 'Apache-2.0'],
    'uk_UA-mykyta-high': ['uk/uk_UA/mykyta/high/', 114204024, 4904, 'Apache-2.0'],
    'uk_UA-oleksa-high': ['uk/uk_UA/oleksa/high/', 114204024, 4904, 'Apache-2.0'],
    'uk_UA-ukrainian_tts-medium': ['uk/uk_UA/ukrainian_tts/medium/', 76735663, 2002, 'CC0', ['lada', 'mykyta', 'tetiana']],
  };
  const PIPER_DEFAULT = 'no_NO-talesyntese-medium';
  const MB = 1048576;

  // every file with its (approximate) size — for the consent dialog and the progress bar
  const F = {
    tjs: [TJS + 'transformers.min.js', 888173, 'text/javascript'],
    ort: [TJS + 'ort-wasm-simd-threaded.jsep.wasm', 21596019, 'application/wasm'],     // shared by recognition and voice
    ortmjs: [TJS + 'ort-wasm-simd-threaded.jsep.mjs', 44484, 'text/javascript'],         // its JS glue (same build for both)
    a1: [ASR_BASE + 'config.json', 3649], a2: [ASR_BASE + 'generation_config.json', 3884], a3: [ASR_BASE + 'preprocessor_config.json', 339],
    a4: [ASR_BASE + 'tokenizer.json', 3931188], a5: [ASR_BASE + 'tokenizer_config.json', 282729],
    a6: [ASR_BASE + 'onnx/encoder_model_q4f16.onnx', 14127819], a7: [ASR_BASE + 'onnx/decoder_model_merged_q4f16.onnx', 68288623],
    s1: [ASR_SMALL + 'config.json', 3776], s2: [ASR_SMALL + 'generation_config.json', 3945], s3: [ASR_SMALL + 'preprocessor_config.json', 339],
    s4: [ASR_SMALL + 'tokenizer.json', 3931188], s5: [ASR_SMALL + 'tokenizer_config.json', 282729],
    s6: [ASR_SMALL + SMALL_ENC_FILE, SMALL_ENC === 'fp32' ? 352759106 : 66115340], s7: [ASR_SMALL + 'onnx/decoder_model_merged_q4.onnx', 232996219],
    ortjs: [ORT_BUNDLE, 398191, 'text/javascript'],
    phjs: [PH_JS, 158217, 'text/javascript'], phwasm: [PH_WASM + '.wasm', 635212, 'application/wasm'], phdata: [PH_WASM + '.data', 18077249],
    voice: [VOICE, 63221984], vjson: [VOICE + '.json', 6256],
  };
  const GROUPS = {
    asr: ['tjs', 'ort', 'ortmjs', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'],
    asrSmall: ['tjs', 'ort', 'ortmjs', 's1', 's2', 's3', 's4', 's5', 's6', 's7'],
    piper: ['ortjs', 'ort', 'ortmjs', 'phjs', 'phwasm', 'phdata', 'voice', 'vjson'],
  };
  const GROUP_NAME = { asr: 'модель распознавания речи', asrSmall: 'точную модель распознавания речи', piper: 'офлайн-голос Piper' };
  const PIPER_RT = ['ortjs', 'ort', 'ortmjs', 'phjs', 'phwasm', 'phdata'];   // shared by every Piper voice (≈40 МБ)
  /** the download group of a Piper voice ('piper' = talesyntese, as before) and its own two files */
  const pGroup = key => key === PIPER_DEFAULT ? 'piper' : 'piper:' + key;
  Object.keys(PIPER_VOICES).forEach(key => {
    const [path, size, jsize] = PIPER_VOICES[key];
    if (!path) return;
    F['pv:' + key] = [PV + path + key + '.onnx', size];
    F['pj:' + key] = [PV + path + key + '.onnx.json', jsize];
    GROUPS[pGroup(key)] = PIPER_RT.concat(['pv:' + key, 'pj:' + key]);
    GROUP_NAME[pGroup(key)] = 'офлайн-голос Piper';
  });
  const pFiles = key => key === PIPER_DEFAULT ? ['voice', 'vjson'] : ['pv:' + key, 'pj:' + key];
  const LS_READY = 'nk-speech-ready';     // sync flags for Voices.ready(): {asr:1, piper:1}
  const SR = () => window.SpeechRecognition || window.webkitSpeechRecognition;
  const hasWasm = typeof WebAssembly === 'object';
  const hasCaches = 'caches' in window;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const fmtMB = b => b > 0 && b < MB / 10 ? '<0.1 МБ' : (b / MB < 10 ? (b / MB).toFixed(1) : Math.round(b / MB)) + ' МБ';

  const flags = () => { try { return JSON.parse(localStorage.getItem(LS_READY) || '{}'); } catch (e) { return {}; } };
  const setFlag = (g, v) => { const f = flags(); if (v) f[g] = 1; else delete f[g]; try { localStorage.setItem(LS_READY, JSON.stringify(f)); } catch (e) { /* ignore */ } };

  /* ================= model files: Cache API ================= */
  const Models = {
    async cache() { return caches.open(MC); },
    async has(key) {
      if (!hasCaches) return false;
      try { return !!(await (await this.cache()).match(F[key][0])); } catch (e) { return false; }
    },
    /** {ready, missing: [keys], missingBytes, bytes (on disk)} */
    async status(group) {
      const out = { ready: false, missing: [], missingBytes: 0, bytes: 0 };
      let c = null;
      try { if (hasCaches) c = await this.cache(); } catch (e) { /* private mode etc. */ }
      if (!c) { out.missing = GROUPS[group].slice(); out.missingBytes = GROUPS[group].reduce((s, k) => s + F[k][1], 0); return out; }
      for (const k of GROUPS[group]) {
        const r = await c.match(F[k][0]);
        if (r) out.bytes += +(r.headers.get('x-size') || F[k][1]);
        else { out.missing.push(k); out.missingBytes += F[k][1]; }
      }
      out.ready = !out.missing.length;
      // a recognition model appeared / disappeared → the model choice is made again
      if ((group === 'asr' || group === 'asrSmall') && !!flags()[group] !== out.ready) replan();
      setFlag(group, out.ready);
      return out;
    },
    /** download the missing files of a group; onProgress(doneBytes, totalBytes, label) */
    async download(group, onProgress, signal) {
      const st = await this.status(group);
      const total = st.missingBytes;
      let done = 0;
      const c = await this.cache();
      for (const k of st.missing) {
        const [url, size, type] = F[k];
        let r;
        try { r = await fetch(url, { signal, mode: 'cors', credentials: 'omit' }); }
        catch (e) { if (signal && signal.aborted) throw e; throw new Error('Не удалось скачать — нет интернета?'); }
        if (!r.ok) throw new Error('Сервер ответил ' + r.status + ' (' + url.split('/').pop() + ')');
        const chunks = [];
        let got = 0;
        if (r.body && r.body.getReader) {
          const rd = r.body.getReader();
          for (;;) {
            const { done: end, value } = await rd.read();
            if (end) break;
            chunks.push(value); got += value.length;
            onProgress && onProgress(done + Math.min(got, size), total, url.split('/').pop());
          }
        } else { const b = new Uint8Array(await r.arrayBuffer()); chunks.push(b); got = b.length; }
        const blob = new Blob(chunks, { type: type || r.headers.get('content-type') || 'application/octet-stream' });
        // a voice model must arrive whole (pinned revision + exact size): a cut file would make noise, not speech
        if (/\.onnx$/.test(url) && size > 1e6 && Math.abs(blob.size - size) > 1024) throw new Error('Файл скачался не полностью — попробуйте ещё раз');
        await c.put(url, new Response(blob, { headers: { 'content-type': blob.type, 'x-size': String(blob.size) } }));
        done += size;
        onProgress && onProgress(done, total, url.split('/').pop());
      }
      try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (e) { /* ignore */ }
      return this.status(group);
    },
    /** delete a group; the shared ONNX runtime only when no other group needs it */
    async remove(group) {
      if (!hasCaches) return;
      const c = await this.cache();
      const other = Object.keys(GROUPS).filter(g => g !== group);
      const keep = new Set();
      for (const g of other) { const s = await this.status(g); if (s.bytes) GROUPS[g].forEach(k => keep.add(k)); }
      for (const k of GROUPS[group]) {
        if (keep.has(k)) continue;
        await c.delete(F[k][0]);
        if (this._blobs[k]) { URL.revokeObjectURL(this._blobs[k]); delete this._blobs[k]; }
      }
      setFlag(group, false);
      if (group === 'asr' || group === 'asrSmall') { if (asrId.startsWith(group === 'asr' ? 'base@' : 'small@')) { asrP = null; asrId = ''; } replan(); }
      if (group === 'piper' || group.startsWith('piper:')) Piper.drop(group === 'piper' ? PIPER_DEFAULT : group.slice(6));
    },
    /** bytes on disk that only this group uses (not the shared ONNX runtime) — what deleting it frees */
    async ownBytes(group) {
      if (!hasCaches) return 0;
      const shared = new Set(Object.keys(GROUPS).filter(g => g !== group).flatMap(g => GROUPS[g]));
      let n = 0;
      try {
        const c = await this.cache();
        for (const k of GROUPS[group]) { if (shared.has(k)) continue; const r = await c.match(F[k][0]); if (r) n += +(r.headers.get('x-size') || F[k][1]); }
      } catch (e) { /* ignore */ }
      return n;
    },
    async buf(key) {
      const r = await (await this.cache()).match(F[key][0]);
      if (!r) throw new Error('файл модели не найден — скачайте заново');
      return r.arrayBuffer();
    },
    _blobs: {},
    /** blob: URL of a cached ES module (null if not cached). A blob: module has no usable base URL — import.meta.url
     *  keeps the CDN address (the wasm itself is handed over from the cache, so nothing is fetched from there). */
    async blobUrl(key) {
      if (this._blobs[key]) return this._blobs[key];
      const r = await (await this.cache()).match(F[key][0]);
      if (!r) return null;
      const code = (await r.text()).split('import.meta.url').join(JSON.stringify(F[key][0]));
      return (this._blobs[key] = URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
    },
    /** import an ES module that is stored in the cache (works offline); falls back to the CDN */
    async importMod(key) {
      try { const url = await this.blobUrl(key); if (url) return await import(url); }
      catch (e) { console.warn('speech: cached module failed, using CDN', e); }
      return import(F[key][0]);
    },
    /** ONNX runtime wasm + its glue from the cache (offline) */
    async ortWasm(env) {
      env.numThreads = 1;
      env.proxy = false;
      try {
        env.wasmBinary = await this.buf('ort');
        const mjs = await this.blobUrl('ortmjs');
        if (mjs) env.wasmPaths = { mjs, wasm: F.ort[0] };
      } catch (e) { /* from the CDN */ }
    },
  };

  /* ================= download consent + progress (one modal) ================= */
  function consent(group, opts = {}) {
    return new Promise(async resolve => {
      const st = await Models.status(group);
      if (st.ready) { resolve(true); return; }
      const size = fmtMB(st.missingBytes);
      const isAsr = group === 'asr' || group === 'asrSmall';
      const am = group === 'asrSmall' ? ASR.small : ASR.base;
      const sr = isAsr && !!SR() && !opts.noBrowser;
      const title = opts.title || (isAsr ? '🗣 Распознавание речи на устройстве' : '📴 Офлайн норвежский голос');
      let result = false, ctrl = null;
      const m = UI.modal({
        title, cls: 'narrow sp-consent', dismissable: true,
        body: `<div class="sp-dl">
            ${opts.lead ? `<div class="sp-lead">${opts.lead}</div>` : ''}
            <p><b>${isAsr ? `Скачать модель распознавания (≈${size}) — один раз` : `Скачать голос Piper (≈${size}) — один раз`}</b></p>
            ${isAsr ? `<p class="small sp-dl-model" data-dl-model>Качество распознавания: <b>${am.label}</b> — ${am.name}${group === 'asrSmall' ? ', для компьютера с видеокартой (WebGPU)' : ''}. <span class="muted">Изменить — «⚙️ Настройки → 🎙 Распознавание речи».</span></p>` : ''}
            <p class="small muted">${isAsr
              ? 'NB-Whisper от Национальной библиотеки Норвегии (лицензия Apache-2.0) — понимает норвежскую речь. После скачивания работает без интернета.'
              : 'Голос «talesyntese» (Piper, лицензия MIT, запись CC0) — читает норвежский текст прямо на устройстве, без интернета. Русский текст читается вашим обычным голосом.'}
              Файлы сохраняются в браузере; удалить можно в «🗣 Речь».</p>
            ${isAsr ? `<p class="small sp-privacy">${opts.privacy || '🔒 Запись голоса обрабатывается прямо на устройстве и никуда не отправляется.'}</p>` : ''}
            ${opts.reason ? `<p class="small">${U.esc(opts.reason)}</p>` : ''}
            <div class="sp-dl-prog" hidden><div class="sp-dl-row"><span class="hourglass">⏳</span><span data-dl-txt>Скачиваю…</span></div>
              <div class="busy-bar"><i data-dl-bar style="width:0%"></i></div><div class="tiny muted" data-dl-sub></div></div>
          </div>`,
        foot: `<button class="btn ghost" data-dl-no>Отмена</button>
          ${sr ? '<button class="btn" data-dl-browser title="Распознаёт браузер — звук может отправляться на сервер Google / Apple">🌐 Через браузер</button>' : ''}
          <button class="btn primary" data-dl-yes>${opts.okLabel ? U.esc(opts.okLabel) + ` (≈${size})` : `⬇ Скачать ≈${size}`}</button>`,
        onClose: () => { if (ctrl) ctrl.abort(); resolve(result); },
        // while it downloads: «Остановить скачивание?» (the files already saved stay — the next download goes on from them)
        beforeClose: UI.guard(() => !ctrl ? null : { title: 'Остановить скачивание?', line: 'Уже скачанные файлы сохранятся — в следующий раз скачивание продолжится.',
          actions: [{ label: 'Остановить', value: 'stop', cls: 'bad' }], cancel: 'Скачивать дальше' }),
      });
      m.$('[data-dl-no]').onclick = () => m.tryClose();
      const b = m.$('[data-dl-browser]');
      if (b) b.onclick = () => { result = 'browser'; Store.setSetting('speechAsr', 'browser'); m.close(); };
      m.$('[data-dl-yes]').onclick = async () => {
        const yes = m.$('[data-dl-yes]');
        yes.disabled = true; if (b) b.disabled = true;
        m.$('.sp-dl-prog').hidden = false;
        ctrl = new AbortController();
        const t0 = Date.now();
        try {
          await Models.download(group, (d, t) => {
            const pct = t ? Math.min(100, Math.round(d / t * 100)) : 0;
            m.$('[data-dl-bar]').style.width = pct + '%';
            m.$('[data-dl-txt]').textContent = `Скачиваю ${GROUP_NAME[group]}… ${pct}%`;
            m.$('[data-dl-sub]').textContent = `${fmtMB(d)} из ${fmtMB(t)} · ${Math.round((Date.now() - t0) / 1000)} с`;
          }, ctrl.signal);
          ctrl = null;
          if (isAsr) { Store.setSetting('speechAsr', 'whisper'); replan(); }
          result = true;
          UI.toast(isAsr ? 'Модель распознавания скачана — работает без интернета' : 'Голос Piper скачан — работает без интернета', 'good');
          m.close();
        } catch (e) {
          ctrl = null;
          if (e.name === 'AbortError') return;
          m.$('[data-dl-txt]').textContent = '⚠️ ' + U.niceErr(e);
          yes.disabled = false; yes.textContent = '🔁 Попробовать ещё раз'; if (b) b.disabled = false;
        }
      };
    });
  }

  /** the download window for the recognition model this device uses now (base or small) */
  async function consentAsr(opts) { return consent((await asrPlan()).group, opts || {}); }

  /* ================= which recognition model: by device + the user's choice ================= */
  const mm = q => { try { return matchMedia(q).matches; } catch (e) { return false; } };
  const Dev = {
    /** phone / tablet: UA (iPadOS reports «Macintosh» + touch), else a touch-only screen without a mouse */
    phone() {
      const ua = navigator.userAgent || '';
      if (/iPhone|iPad|iPod|Android|Mobile|Silk|Kindle|webOS|BlackBerry/i.test(ua)) return true;
      if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
      return mm('(pointer: coarse)') && !mm('(any-pointer: fine)') && !mm('(any-hover: hover)');
    },
    /** a weak computer: little memory (Chrome reports deviceMemory, max 8) or few cores */
    weak() {
      const m = navigator.deviceMemory, c = navigator.hardwareConcurrency;
      return (m > 0 && m < 4) || (c > 0 && c < 4);
    },
    broken: false,     // WebGPU failed once in this session → WASM until reload
    _gpu: null,
    /** {ok, f16, name}: a real GPU (not a software one, e.g. SwiftShader in a headless browser) */
    gpu() {
      if (this._gpu) return this._gpu;
      return (this._gpu = (async () => {
        try {
          if (!navigator.gpu || !navigator.gpu.requestAdapter) return { ok: false, f16: false };
          const a = await Promise.race([navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }), sleep(4000).then(() => null)]);
          if (!a) return { ok: false, f16: false };
          const info = a.info || {};
          const soft = a.isFallbackAdapter || info.isFallbackAdapter || /swiftshader|llvmpipe|lavapipe|software|basic render/i.test(`${info.vendor || ''} ${info.architecture || ''} ${info.description || ''}`);
          return { ok: !soft, f16: !soft && !!(a.features && a.features.has('shader-f16')), name: [info.vendor, info.architecture].filter(Boolean).join(' ') };
        } catch (e) { return { ok: false, f16: false }; }
      })());
    },
  };
  const quality = () => (window.Store && Store.settings && Store.settings.asrQuality) || 'auto';
  let planP = null;
  /**
   * {key: 'base'|'small', group, device: 'webgpu'|'wasm', desktop, gpu, recommended, quality}
   * «auto»: a computer with WebGPU → small on the GPU; a phone, a tablet, a weak or GPU-less computer → base on WASM
   * (small on WASM is ≈4× slower than real time). «auto» never forces a second download: when only the other model
   * is on the device, that one is used (the settings offer the better one).
   */
  function asrPlan() {
    if (planP) return planP;
    planP = (async () => {
      const q = quality(), phone = Dev.phone(), weak = Dev.weak(), g = await Dev.gpu();
      const desktop = !phone && !weak, gpuOk = desktop && g.ok && !Dev.broken;
      const recommended = gpuOk ? 'small' : 'base';
      let key = q === 'fast' ? 'base' : q === 'accurate' ? 'small' : recommended;
      const ready = { base: false, small: false };
      if (hasCaches) [ready.base, ready.small] = (await Promise.all([Models.status('asr'), Models.status('asrSmall')])).map(x => x.ready);
      if (q === 'auto' && key === 'small' && !ready.small && ready.base) key = 'base';
      // what transcribe() runs: the chosen model, or — while it is not downloaded — the other one if that one is
      // (never a silent download from inside a transcription)
      const other = key === 'base' ? 'small' : 'base', run = !ready[key] && ready[other] ? other : key;
      const dev = k => k === 'small' && gpuOk ? 'webgpu' : 'wasm'; // phones and base: the proven WASM path
      return { key, group: ASR[key].group, device: dev(key), run, runDevice: dev(run), ready, desktop, phone, gpu: g, recommended, quality: q };
    })();
    planP.catch(() => { planP = null; });
    return planP;
  }
  const replan = () => { planP = null; };

  /* ================= recognition: NB-Whisper (on device) ================= */
  // the WASM model runs in a worker (js/asr-worker.js, same ?v= as this file): a 3–4 s recognition on the page itself
  // froze the player's buttons and subtitle line for as long
  const SELF_SRC = (document.currentScript && document.currentScript.src) || '';
  const WORKER_URL = (() => { try { return new URL('asr-worker.js' + ((SELF_SRC.match(/\?v=[^&#]*/) || [''])[0]), SELF_SRC || location.href.replace(/[^/]*$/, 'js/')).href; } catch (e) { return 'js/asr-worker.js'; } })();
  /** the model in a worker, called like the pipeline itself: run(pcm, opts) → output; null when workers can't */
  async function workerAsr(key) {
    if (typeof Worker !== 'function' || Dev.noWorker) return null;
    let w;
    try { w = new Worker(WORKER_URL, { type: 'module' }); } catch (e) { return null; }
    let seq = 0, dead = null;
    const wait = new Map();
    const fail = err => { dead = err; wait.forEach(p => p.reject(err)); wait.clear(); };
    w.onmessage = e => { const m = e.data || {}, p = wait.get(m.id); if (!p) return; wait.delete(m.id); if (m.ok) p.resolve(m.out); else p.reject(new Error(m.error)); };
    w.onerror = e => { if (e && e.preventDefault) e.preventDefault(); fail(new Error('worker: ' + ((e && e.message) || 'error'))); };
    const ask = (msg, transfer) => new Promise((resolve, reject) => {
      if (dead) { reject(dead); return; }
      const id = ++seq; wait.set(id, { resolve, reject }); w.postMessage(Object.assign({ id }, msg), transfer || []);
    });
    let wasmBinary = null, wasmPaths = null, tjs = F.tjs[0];
    try { wasmBinary = await Models.buf('ort'); const mjs = await Models.blobUrl('ortmjs'); if (mjs) wasmPaths = { mjs, wasm: F.ort[0] }; } catch (e) { /* from the CDN */ }
    try { tjs = (await Models.blobUrl('tjs')) || tjs; } catch (e) { /* from the CDN */ }
    try {
      await Promise.race([
        ask({ type: 'init', tjs, cacheName: MC, repo: ASR[key].repo, dtype: ASR[key].dtype, wasmBinary, wasmPaths }, wasmBinary ? [wasmBinary] : []),
        sleep(120000).then(() => { throw new Error('worker: no answer'); }),
      ]);
    } catch (e) {
      console.warn('speech: recognition worker failed — running on the page', e);
      try { w.terminate(); } catch (_) { /* ignore */ }
      Dev.noWorker = true;
      return null;
    }
    const run = (pcm, opts) => { const c = new Float32Array(pcm); return ask({ type: 'run', pcm: c, opts }, [c.buffer]); };
    run.dispose = async () => { try { await ask({ type: 'dispose' }); } catch (e) { /* ignore */ } try { w.terminate(); } catch (e) { /* ignore */ } };
    run.worker = true;
    return run;
  }
  let asrP = null, asrId = '', inflight = 0;
  function loadAsr(plan) {
    const key = plan.run || plan.key, device = plan.runDevice || plan.device;
    const id = key + '@' + device;
    if (asrP && asrId === id) return asrP;
    if (asrP) { // another model / device was chosen: free the old one once it is idle
      const old = asrP;
      (async () => { try { const p = await old; while (inflight) await sleep(200); if (p && p.dispose) await p.dispose(); } catch (e) { /* ignore */ } })();
    }
    asrId = id;
    const me = asrP = (async () => {
      if (device === 'wasm') { const wk = await workerAsr(key); if (wk) return wk; }
      const T = await Models.importMod('tjs');
      const env = T.env;
      env.allowLocalModels = false;
      env.useBrowserCache = false;
      env.useCustomCache = true;
      env.customCache = {
        match: async k => (await Models.cache()).match(typeof k === 'string' ? k : k.url),
        put: async (k, r) => { try { await (await Models.cache()).put(k, r); } catch (e) { /* ignore */ } },
      };
      const onnx = env.backends && env.backends.onnx;
      if (onnx && onnx.wasm) await Models.ortWasm(onnx.wasm);
      if (onnx) { try { onnx.logLevel = 'error'; } catch (e) { /* ignore */ } } // not «some nodes were not assigned to the preferred EP» on every load
      const opts = { dtype: Object.assign({}, ASR[key].dtype), device, session_options: { logSeverityLevel: 3 } };
      // NB-Whisper's tokenizer lists the 1501 timestamp tokens <|0.00|>…<|30.00|> as «special»: transformers.js then
      // skips them and every segment comes back as [null, null] — take them off that list
      const fixTs = p => { try { const tk = p.tokenizer, b = tk.timestamp_begin; if (b > 0 && Array.isArray(tk.all_special_ids)) tk.all_special_ids = tk.all_special_ids.filter(i => i < b); } catch (e) { /* plain text still works */ } return p; };
      try { return fixTs(await T.pipeline('automatic-speech-recognition', ASR[key].repo, opts)); }
      catch (e) {
        if (device === 'wasm') throw e;
        // WebGPU refused (driver, memory…): the same files run on WASM — slower, but they run
        console.warn('speech: WebGPU failed, using WASM', e);
        Dev.broken = true; replan();
        asrId = key + '@wasm';
        return fixTs(await T.pipeline('automatic-speech-recognition', ASR[key].repo, Object.assign(opts, { device: 'wasm' })));
      }
    })();
    me.catch(() => { if (asrP === me) { asrP = null; asrId = ''; } });
    return me;
  }
  let badRun = 0;
  /** «de de de de de…», «S 10 O S 10 O…»: one word / pair repeated over and over, or almost no distinct words */
  function degenerate(t) {
    const w = String(t || '').toLowerCase().split(/[\s.,!?;:–-]+/).filter(Boolean);
    if (w.length < 8) return false;
    let run = 1;
    for (let i = 1; i < w.length; i++) { run = w[i] === w[i - 1] || (i > 1 && w[i] === w[i - 2] && w[i - 1] === w[i - 3]) ? run + 1 : 1; if (run >= 8) return true; }
    return w.length >= 16 && new Set(w).size / w.length < 0.25;
  }
  const JUNK = /^(teksting|undertekst|tekst(ing)? av|takk for at du (så|ser|lyttet)|musikk|\[.*\]|\(.*\))\b/i;
  /**
   * 16 kHz mono → text. {timestamps: true} → {text, chunks: [{start, end, text}]} (Whisper's own segments, seconds
   * from the start of pcm; end may be null for the last one) — the subtitles split a long phrase by them.
   */
  async function whisper(pcm16k, o = {}) {
    const plan = await asrPlan();
    const asr = await loadAsr(plan);
    inflight++;
    const t0 = performance.now();
    let out;
    try { out = await asr(pcm16k, Object.assign({ language: 'no', task: 'transcribe' }, o.timestamps ? { return_timestamps: true } : {})); }
    finally { inflight--; }
    const ms = performance.now() - t0;
    // speed per call (the encoder always works on a 30 s window, so a call costs about the same for 2 s or 10 s)
    Speech.callMs = Speech.callMs ? Speech.callMs * 0.7 + ms * 0.3 : ms;
    Speech.engine = { model: ASR[asrId.split('@')[0] || plan.key].name, device: asrId.split('@')[1] || plan.device, worker: !!asr.worker };
    let text = String((out && out.text) || '').trim();
    // a broken GPU path (some drivers / quantizations) babbles «de de de de…»: three such answers in a row → WASM
    if (degenerate(text)) {
      text = '';
      if (asrId.endsWith('@webgpu') && ++badRun >= 3) { console.warn('speech: WebGPU output looks broken, using WASM'); Dev.broken = true; replan(); }
    } else if (text) badRun = 0;
    // {raw: true}: an object always, with Whisper's own answer before the clean-up — «[Musikk]», «♪», «Teksting av…»
    // tell the subtitles that music is playing (js/langid.js)
    const raw = String((out && out.text) || '').trim();
    if (!o.timestamps) return o.raw ? { text: JUNK.test(text) ? '' : text, chunks: [], raw } : JUNK.test(text) ? '' : text;
    const chunks = ((out && out.chunks) || []).map(c => ({ start: c.timestamp && c.timestamp[0], end: c.timestamp && c.timestamp[1], text: String(c.text || '').trim() }))
      .filter(c => c.text && !JUNK.test(c.text) && typeof c.start === 'number');
    return { text: JUNK.test(text) ? '' : text, chunks: text ? chunks : [], raw };
  }

  /* ================= microphone: raw PCM + level + auto-stop on silence ================= */
  function Recorder(o) {
    const maxMs = o.maxMs || 8000;
    let stream, ctx, src, proc, chunks = [], rate = 48000, stopped = false, started = 0;
    let speechAt = 0, quietSince = 0, peak = 0;
    const self = {
      async start() {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
        ctx = o.ctx || newCtx();
        if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) { /* ignore */ } }
        rate = ctx.sampleRate;
        src = ctx.createMediaStreamSource(stream);
        proc = ctx.createScriptProcessor(4096, 1, 1);
        started = performance.now();
        proc.onaudioprocess = e => {
          if (stopped) return;
          const d = e.inputBuffer.getChannelData(0);
          chunks.push(new Float32Array(d));
          let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
          const rms = Math.sqrt(s / d.length), now = performance.now();
          peak = Math.max(peak, rms);
          o.onLevel && o.onLevel(Math.min(1, rms * 12), now - started);
          const thr = 0.012;
          if (rms > thr * 1.6) { if (!speechAt) speechAt = now; quietSince = 0; }
          else if (speechAt && rms < thr) { if (!quietSince) quietSince = now; if (now - quietSince > (o.silenceMs || 1300)) self.stop('silence'); }
          if (now - started > maxMs) self.stop('max');
          else if (!speechAt && now - started > (o.noSpeechMs || 6000)) self.stop('nospeech');
        };
        src.connect(proc); proc.connect(ctx.destination);
      },
      stop(why = 'user') {
        if (stopped) return;
        stopped = true;
        try { proc && proc.disconnect(); src && src.disconnect(); } catch (e) { /* ignore */ }
        if (stream) stream.getTracks().forEach(t => t.stop());
        const c = ctx; ctx = null;
        o.onStop && o.onStop(why, { chunks, rate, speech: !!speechAt, peak, close: () => { try { c && c.close(); } catch (e) { /* ignore */ } } });
      },
      get active() { return !stopped; },
    };
    return self;
  }
  const newCtx = () => new (window.AudioContext || window.webkitAudioContext)();
  /** joined chunks -> 16 kHz mono Float32Array (trimmed around the speech) */
  async function to16k(chunks, rate) {
    const n = chunks.reduce((s, c) => s + c.length, 0);
    let pcm = new Float32Array(n);
    let off = 0; chunks.forEach(c => { pcm.set(c, off); off += c.length; });
    // trim silence at both ends (keep 0.3 s around the speech)
    const win = Math.round(rate * 0.02);
    let first = -1, last = -1;
    for (let i = 0; i + win <= pcm.length; i += win) {
      let s = 0; for (let j = i; j < i + win; j++) s += pcm[j] * pcm[j];
      if (Math.sqrt(s / win) > 0.012) { if (first < 0) first = i; last = i + win; }
    }
    if (first >= 0) pcm = pcm.subarray(Math.max(0, first - rate * 0.3), Math.min(pcm.length, last + rate * 0.3));
    if (rate === 16000) return pcm;
    const len = Math.max(1, Math.ceil(pcm.length * 16000 / rate));
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const oc = new OAC(1, len, 16000);
    const b = oc.createBuffer(1, pcm.length, rate);
    b.getChannelData(0).set(pcm);
    const s = oc.createBufferSource(); s.buffer = b; s.connect(oc.destination); s.start();
    const out = await oc.startRendering();
    return out.getChannelData(0);
  }

  /* ================= text comparison ================= */
  const NUM = ['null', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti', 'elleve', 'tolv', 'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten', 'tjue'];
  const EQUIV = [['en', 'ett', 'ei', 'én'], ['et', 'ett'], ['jeg', 'eg'], ['sju', 'syv'], ['tjue', 'tyve'], ['ikke', 'ikkje'], ['dem', 'de']];
  function words(s) {
    return String(s || '').toLowerCase().normalize('NFC')
      .replace(/[«»“”„"()[\]{}…!?.,;:–—/\\*#_]+/g, ' ').replace(/(^|\s)[-']+|[-']+(?=\s|$)/g, ' ')
      .split(/\s+/).filter(Boolean)
      .map(w => /^\d+$/.test(w) && +w <= 20 ? NUM[+w] : w);
  }
  const eq = (a, b) => a === b || EQUIV.some(g => g.includes(a) && g.includes(b));
  const fold = s => s.replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a');
  /** 'ok' | 'close' | 'bad' */
  function wordKind(t, h) {
    if (eq(t, h)) return 'ok';
    if (fold(t) === fold(h)) return 'close';
    const d = U.levenshtein(t, h), L = Math.max(t.length, h.length);
    return L >= 3 && d <= 2 && d / L <= 0.34 ? 'close' : 'bad';
  }
  /** glue split / joined words of the heard text to the target words: "tog stasjonen" ↔ "togstasjonen" */
  function glue(tw, hw) {
    const set = new Set(tw), out = [];
    for (let i = 0; i < hw.length; i++) {
      if (i + 1 < hw.length && !set.has(hw[i]) && set.has(hw[i] + hw[i + 1])) { out.push(hw[i] + hw[i + 1]); i++; continue; }
      const split = tw.findIndex((w, j) => j + 1 < tw.length && w + tw[j + 1] === hw[i]);
      if (split >= 0 && !set.has(hw[i])) { out.push(tw[split], tw[split + 1]); continue; }
      out.push(hw[i]);
    }
    return out;
  }
  /**
   * word-level alignment (Levenshtein on words, near words cost 0.5)
   * -> { items: [{t, h, kind: ok|close|bad|miss}], extra: [heard words not in the target], score 0..100 }
   */
  function compare(target, heard) {
    const tRaw = String(target || '').split(/\s+/).filter(w => words(w).length);
    const tw = tRaw.map(w => words(w).join(''));
    const hw = glue(tw, words(heard));
    const n = tw.length, m = hw.length;
    const cost = (i, j) => ({ ok: 0, close: 0.5, bad: 1 })[wordKind(tw[i], hw[j])];
    const D = Array.from({ length: n + 1 }, (_, i) => { const r = new Array(m + 1).fill(0); r[0] = i; return r; });
    for (let j = 0; j <= m; j++) D[0][j] = j;
    for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++)
      D[i][j] = Math.min(D[i - 1][j - 1] + cost(i - 1, j - 1), D[i - 1][j] + 1, D[i][j - 1] + 1);
    const items = [], extra = [];
    let i = n, j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && Math.abs(D[i][j] - (D[i - 1][j - 1] + cost(i - 1, j - 1))) < 1e-9) {
        const k = wordKind(tw[i - 1], hw[j - 1]);
        items.unshift({ t: tRaw[i - 1], tn: tw[i - 1], h: hw[j - 1], kind: k }); i--; j--;
      } else if (i > 0 && Math.abs(D[i][j] - (D[i - 1][j] + 1)) < 1e-9) { items.unshift({ t: tRaw[i - 1], tn: tw[i - 1], h: '', kind: 'miss' }); i--; }
      else { extra.unshift(hw[j - 1]); j--; }
    }
    const pts = items.reduce((s, x) => s + (x.kind === 'ok' ? 1 : x.kind === 'close' ? 0.5 : 0), 0);
    const score = n ? Math.max(0, Math.round((pts - extra.length * 0.25) / n * 100)) : 0;
    return { items, extra, score };
  }

  /* ---------- tips in Russian (generic Norwegian pronunciation rules) ---------- */
  const RULES = [
    [/skj|sj|sk(?=i|y|ei|øy)/, 'sj, skj и sk перед i, y, ei, øy звучат как «ш»: sjø ≈ «шё», ski ≈ «ши»'],
    [/kj|tj|^k(?=i|y)/, 'kj, tj и k перед i / y — мягкий звук, похожий на «хь» (почти «щ», но без свиста): kjøre ≈ «хьёре»'],
    [/^hv|^hj/, 'h в начале hv- и hj- не читается: hva ≈ «ва», hjem ≈ «йем»'],
    [/^gj|^g(?=i|y|ei|øy)/, 'gj и g перед i, y, ei, øy звучат как «й»: gjøre ≈ «йёре», gi ≈ «йи»'],
    [/rs/, 'rs сливается в «ш»: norsk ≈ «ношк»'],
    [/r[tdnl]/, 'r перед t, d, n, l почти не слышно — они сливаются в один «твёрдый» звук: kort ≈ «кот»'],
    [/[aeiouyæøå]d$/, 'd на конце после гласной часто не произносится: god ≈ «гу», med ≈ «ме»'],
    [/øy/, 'øy — дифтонг «ёй» с округлёнными губами'],
    [/ei/, 'ei — дифтонг «эй»'],
    [/ø/, 'ø — как «ё» в «мёд», губы округлены'],
    [/y/, 'y — «и» с губами, вытянутыми трубочкой (как немецкое ü)'],
    [/u/, 'u — между «у» и «ю», губы плотно сжаты'],
    [/æ/, 'æ — открытое «э», почти «а»'],
    [/å/, 'å читается как русское «о»'],
    [/o/, 'o часто звучит как «у»: bok ≈ «бук», god ≈ «гу»'],
  ];
  function tips(res, heardText) {
    const out = [], used = new Set();
    if (!String(heardText || '').trim()) return ['Ничего не расслышал — говорите громче и ближе к микрофону, без пауз в начале.'];
    res.items.filter(x => x.kind !== 'ok').slice(0, 3).forEach(x => {
      const w = x.tn, tw = x.t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      const rule = RULES.find(([re]) => re.test(w));
      let s = x.kind === 'miss' ? `слово «${tw}» не расслышано — произнесите его чётче` : `слово «${tw}» прозвучало как «${x.h}»`;
      if (rule && !used.has(rule[1])) { used.add(rule[1]); s += ' — ' + rule[1]; }
      out.push(s.charAt(0).toUpperCase() + s.slice(1));
    });
    if (res.extra.length && out.length < 4) out.push(`Лишнее: «${res.extra.join(' ')}» — возможно, вы запнулись или повторили слово.`);
    if (res.items.length >= 6 && res.score < 70) out.push('Длинную фразу скажите медленнее, по частям — сначала послушайте эталон 🔊.');
    return out;
  }
  const verdict = s => s >= 90 ? 'Отлично! 🎉' : s >= 70 ? 'Хорошо!' : s >= 40 ? 'Неплохо — попробуйте ещё раз' : 'Попробуйте ещё раз — медленнее и чётче';
  function wordsHtml(res, mode) {
    return res.items.map(x => {
      const cls = x.kind === 'ok' ? 'ok' : x.kind === 'close' ? 'close' : 'bad';
      const heard = x.kind === 'ok' ? '' : x.kind === 'miss' ? (mode === 'type' ? 'пропущено' : 'не слышно') : (mode === 'type' ? U.diffHtml(x.h, x.tn) : U.esc(x.h));
      const title = x.kind === 'ok' ? '' : x.kind === 'miss' ? 'не найдено' : (mode === 'type' ? 'написано: ' : 'услышано: ') + x.h;
      return `<span class="sp-w ${cls}" title="${U.esc(title)}">${U.esc(x.t)}${heard ? `<small>${heard}</small>` : ''}</span>`;
    }).join(' ');
  }

  /* ================= icons ================= */
  const MIC = (s = 30) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8.5" y="2.5" width="7" height="12" rx="3.5" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
  const STOP = s => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/></svg>`;

  /* ================= recogniser choice ================= */
  /** 'whisper' | 'browser' | null (asks for the download once) */
  async function chooseEngine() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (SR()) return 'browser';
      UI.toast('Этот браузер не даёт доступ к микрофону', 'bad'); return null;
    }
    if (hasWasm && hasCaches && (await Models.status((await asrPlan()).group)).ready) return 'whisper';
    if (Store.settings.speechAsr === 'browser' && SR()) return 'browser';
    if (!hasWasm || !hasCaches) {
      if (SR()) return 'browser';
      UI.toast('Распознавание речи недоступно в этом браузере', 'bad'); return null;
    }
    const r = await consentAsr();
    if (r === true) return 'whisper';
    if (r === 'browser') return 'browser';
    return null;
  }
  const engineNote = eng => eng === 'browser'
    ? '🌐 Распознаёт браузер (nb-NO) — звук может отправляться на сервер Google / Apple. <a href="#" data-sp-dl>Скачать модель для работы на устройстве</a>'
    : '🔒 Запись голоса обрабатывается прямо на устройстве и никуда не отправляется.';

  /**
   * one record button + its logic, reused by «Проверка произношения» and «Диктант (вслух)».
   * mount(box, {onText(text), onState(state)}) — box gets the button, the timer and the status line.
   */
  function recorderUI(box, o) {
    box.innerHTML = `<div class="sp-recwrap">
        <button class="media-btn main sp-rec" data-sp-rec aria-label="Записать" title="Нажмите и говорите · ещё раз — стоп (или удерживайте)"><span class="sp-ring"></span>${MIC(30)}</button>
        <div class="sp-timer" data-sp-timer></div>
      </div>
      <div class="small muted center" data-sp-status>Нажмите и говорите · нажмите ещё раз, чтобы закончить (или удерживайте)</div>
      <div class="tiny muted center sp-privacy" data-sp-eng></div>`;
    const btn = box.querySelector('[data-sp-rec]'), ring = box.querySelector('.sp-ring');
    const status = t => { box.querySelector('[data-sp-status]').innerHTML = t; };
    let state = 'idle', rec = null, sr = null, downAt = 0, eng = null, srTimer = null;
    const set = s => { state = s; btn.classList.toggle('rec', s === 'rec'); btn.classList.toggle('busy', s === 'busy'); btn.disabled = s === 'busy'; btn.innerHTML = `<span class="sp-ring"></span>${s === 'rec' ? STOP(26) : s === 'busy' ? '<span class="spinner sm"></span>' : MIC(30)}`; o.onState && o.onState(s); };
    const timer = ms => { const t = box.querySelector('[data-sp-timer]'); t.textContent = ms == null ? '' : `${(ms / 1000).toFixed(1)} / ${(o.maxMs || 8000) / 1000} с`; };
    const showEng = () => { const e = box.querySelector('[data-sp-eng]'); e.innerHTML = eng ? engineNote(eng) : ''; const a = e.querySelector('[data-sp-dl]'); if (a) a.onclick = async ev => { ev.preventDefault(); if (await consentAsr() === true) { eng = 'whisper'; showEng(); } }; };

    async function start() {
      if (state !== 'idle') return;
      downAt = 0;
      TTS.stop();
      // iPhone: the audio context must be created and resumed inside the tap itself
      let ctx = null;
      try { ctx = newCtx(); ctx.resume().catch(() => {}); } catch (e) { ctx = null; }
      eng = await chooseEngine();
      showEng();
      if (eng !== 'whisper' && ctx) { try { ctx.close(); } catch (e) { /* ignore */ } }
      if (!eng) return;
      if (eng === 'browser') return startBrowser();
      set('rec');
      status('🎙 Говорите…');
      rec = Recorder({
        ctx, maxMs: o.maxMs || 8000,
        onLevel: (lv, ms) => { const r = btn.querySelector('.sp-ring'); if (r) r.style.transform = `scale(${1 + lv * 0.9})`; timer(ms); },
        onStop: async (why, data) => {
          timer(null);
          data.close();
          if (!data.speech || data.peak < 0.015) { set('idle'); status(why === 'nospeech' || !data.speech ? '🤫 Не слышно речи — проверьте микрофон и говорите громче' : 'Слишком тихо — попробуйте ещё раз'); return; }
          set('busy');
          const first = !asrP;
          status(first ? '⏳ Загружаю модель распознавания… (первый раз за сеанс — несколько секунд)' : '⏳ Распознаю…');
          await sleep(40);
          try {
            const pcm = await to16k(data.chunks, data.rate);
            if (first) { await loadAsr(await asrPlan()); status('⏳ Распознаю…'); await sleep(20); }
            const t0 = performance.now();
            const text = await whisper(pcm);
            Speech.lastTiming = { transcribeMs: Math.round(performance.now() - t0), audioSec: +(pcm.length / 16000).toFixed(2) };
            set('idle');
            status('Нажмите, чтобы записать ещё раз');
            o.onText(text, 'whisper');
          } catch (e) {
            console.error(e);
            set('idle');
            status('⚠️ Не удалось распознать: ' + U.esc(U.niceErr(e, '', true)) + (SR() ? ' · <a href="#" data-sp-usebrowser>через браузер</a>' : ''));
            const a = box.querySelector('[data-sp-usebrowser]');
            if (a) a.onclick = ev => { ev.preventDefault(); Store.setSetting('speechAsr', 'browser'); eng = 'browser'; showEng(); startBrowser(); };
          }
        },
      });
      try { await rec.start(); downAt = performance.now(); }
      catch (e) { try { ctx && ctx.close(); } catch (_) { /* ignore */ } set('idle'); status('⚠️ Нет доступа к микрофону — разрешите его в настройках браузера'); }
    }
    function startBrowser() {
      const S = SR();
      if (!S) { status('⚠️ Распознавание речи в этом браузере недоступно'); return; }
      sr = new S();
      sr.lang = 'nb-NO'; sr.interimResults = true; sr.continuous = false; sr.maxAlternatives = 1;
      let final = '', got = false;
      set('rec'); status('🎙 Говорите… (распознаёт браузер)');
      const t0 = performance.now();
      const tick = setInterval(() => timer(performance.now() - t0), 100);
      srTimer = setTimeout(() => { try { sr.stop(); } catch (e) { /* ignore */ } }, o.maxMs || 8000);
      sr.onresult = e => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) final += r[0].transcript + ' '; else interim += r[0].transcript; }
        got = true;
        status('🎙 ' + U.esc((final + interim).trim()));
      };
      sr.onerror = e => { if (e.error === 'not-allowed') status('⚠️ Нет доступа к микрофону'); else if (e.error !== 'no-speech' && e.error !== 'aborted') status('⚠️ Ошибка распознавания браузера: ' + U.esc(e.error)); };
      sr.onend = () => {
        clearInterval(tick); clearTimeout(srTimer); timer(null); sr = null;
        set('idle');
        if (!got || !final.trim()) { if (!/⚠️/.test(box.querySelector('[data-sp-status]').textContent)) status('🤫 Не расслышал — попробуйте ещё раз'); return; }
        status('Нажмите, чтобы записать ещё раз');
        o.onText(final.trim(), 'browser');
      };
      try { sr.start(); downAt = performance.now(); } catch (e) { set('idle'); status('⚠️ ' + U.esc(U.niceErr(e))); }
    }
    function stop() {
      if (rec && rec.active) rec.stop('user');
      if (sr) { try { sr.stop(); } catch (e) { /* ignore */ } }
    }
    btn.addEventListener('pointerdown', e => {
      if (e.button > 0) return;
      e.preventDefault();
      if (state === 'rec') stop(); else if (state === 'idle') start();
    });
    btn.addEventListener('pointerup', () => { if (state === 'rec' && downAt && performance.now() - downAt > 600) stop(); });
    btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (state === 'rec') stop(); else if (state === 'idle') start(); } });
    btn.addEventListener('contextmenu', e => e.preventDefault());
    return { stop, start, get state() { return state; } };
  }

  /* ================= 🗣 pronunciation check ================= */
  const BUILTIN = [
    ['Hvor ligger togstasjonen?', 'Где находится вокзал?'],
    ['Jeg liker å kjøre bil om sommeren.', 'Я люблю водить машину летом.'],
    ['Kan du snakke litt saktere?', 'Можешь говорить чуть медленнее?'],
    ['Vi skal handle mat etter jobben.', 'Мы пойдём за продуктами после работы.'],
    ['Det regner mye i Bergen.', 'В Бергене часто идёт дождь.'],
    ['Jeg liker å gå på tur i skogen.', 'Я люблю гулять в лесу.'],
    ['Hva koster denne jakken?', 'Сколько стоит эта куртка?'],
    ['Barna leker ute i hagen.', 'Дети играют на улице в саду.'],
    ['Unnskyld, jeg forstår ikke.', 'Извините, я не понимаю.'],
    ['Vi ses i morgen!', 'Увидимся завтра!'],
    ['Hun kjøper sjokolade i butikken.', 'Она покупает шоколад в магазине.'],
    ['Gjør det vondt i hjertet ditt?', 'У тебя болит сердце?'],
  ];
  /** Norwegian text of a card field: first line, no html, no Russian glosses in brackets */
  function clean(s) {
    let t = U.stripHtml(s || '').split('\n').map(x => x.trim()).find(Boolean) || '';
    t = t.replace(/\([^)]*[Ѐ-ӿ][^)]*\)/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
    return t;
  }
  const isNo = s => s && U.cyrRatio(s) < 0.05 && /\p{L}/u.test(s);

  function pronounce(opts = {}) {
    const text = clean(opts.text) || '';
    if (!isNo(text)) { UI.toast('Нужен норвежский текст', 'warn'); return; }
    let last = null;
    const m = UI.modal({
      title: '🗣 Проверка произношения', cls: 'narrow sp-modal',
      body: `<div class="sp-target" data-sp-target lang="nb">${U.esc(text)}</div>
        ${opts.ru ? `<div class="sp-tr ru-text">${U.esc(clean(opts.ru) || opts.ru)}</div>` : ''}
        <div class="row sp-ref"><button class="btn sm" data-sp-say>🔊 Эталон</button><button class="btn sm" data-sp-slow>🐢 Медленно</button></div>
        <div data-sp-rec-box></div>
        <div class="sp-result" data-sp-result hidden></div>`,
      foot: `<button class="btn" data-sp-again hidden>🔁 Ещё раз</button><button class="btn primary" data-sp-done>Готово</button>`,
      onClose: () => { ctl && ctl.stop(); if (opts.onDone) opts.onDone(last); },
    });
    m.$('[data-sp-say]').onclick = () => TTS.speak(text, 'no', { place: 'speech' });
    m.$('[data-sp-slow]').onclick = () => TTS.speak(text, 'no', { rate: 0.55, place: 'speech' });
    m.$('[data-sp-done]').onclick = () => m.close();
    const ctl = recorderUI(m.$('[data-sp-rec-box]'), {
      maxMs: opts.maxMs || 8000,
      onState: s => { if (s === 'rec') { m.$('[data-sp-result]').hidden = true; m.$('[data-sp-target]').innerHTML = U.esc(text); } },
      onText: (heard, engine) => {
        const res = compare(text, heard);
        last = { text, heard, score: res.score, words: res.items.map(x => ({ word: x.t, heard: x.h, status: x.kind })), engine };
        m.$('[data-sp-target]').innerHTML = wordsHtml(res, 'say');
        const r = m.$('[data-sp-result]');
        r.hidden = false;
        r.innerHTML = `<div class="sp-score ${res.score >= 70 ? 'good' : res.score >= 40 ? 'mid' : 'low'}"><b>${res.score}%</b> <span>${verdict(res.score)}</span></div>
          <div class="small">Услышано: <b lang="nb">${heard ? '«' + U.esc(heard) + '»' : '—'}</b></div>
          ${tips(res, heard).length && res.score < 100 ? `<ul class="sp-tips">${tips(res, heard).map(t => `<li>${U.esc(t)}</li>`).join('')}</ul>` : ''}
          <div class="tiny muted">Распознавание не идеально: если уверены в себе — попробуйте ещё раз.</div>`;
        m.$('[data-sp-again]').hidden = false;
      },
    });
    m.$('[data-sp-again]').onclick = () => { m.$('[data-sp-result]').hidden = true; m.$('[data-sp-target]').innerHTML = U.esc(text); ctl.start(); };
    if (opts.autoplay !== false) setTimeout(() => TTS.speak(text, 'no', { place: 'speech' }), 250);
    return m;
  }

  /* ================= ✍️ dictation ================= */
  function pickItems(n = 10) {
    const out = [], seen = new Set();
    const add = (no, ru) => {
      no = clean(no);
      if (!isNo(no) || no.length < 5 || no.length > 140 || no.split(/\s+/).length < 2) return;
      const k = U.norm(no); if (seen.has(k)) return; seen.add(k);
      out.push({ no, ru: clean(ru) || String(ru || '').trim() });
    };
    (window.Store && Store.state ? Store.cards() : []).forEach(c => {
      const no = clean(c.no), wc = no.split(/\s+/).length;
      if (wc >= 3 || (wc >= 2 && /[.!?]$/.test(no))) add(c.no, c.ru);
      if (c.example) add(c.example, c.exampleRu);
      (c.examples || []).forEach(x => add(x.no, x.ru));
    });
    const mine = U.shuffle(out).slice(0, n);
    if (mine.length < n) U.shuffle(BUILTIN).forEach(([no, ru]) => { if (mine.length < n && !seen.has(U.norm(no))) mine.push({ no, ru, builtin: true }); });
    return mine;
  }

  function dictation(opts = {}) {
    const items = (opts.items && opts.items.length ? opts.items : pickItems(opts.count || 10))
      .map(x => typeof x === 'string' ? { no: clean(x) } : { no: clean(x.no || x.text || ''), ru: x.ru || '' }).filter(x => isNo(x.no));
    if (!items.length) { UI.toast('Нет предложений для диктанта', 'warn'); return; }
    let i = 0, mode = Store.settings.dictMode === 'say' ? 'say' : 'type', checked = false, ctl = null, over = false;
    const results = [];
    const m = UI.modal({
      title: '✍️ Диктант', cls: 'narrow sp-modal sp-dict', dismissable: true,
      // in the middle of a dictation (something answered, phrases still to go): asked first — the results are not kept
      beforeClose: UI.guard(() => over || !results.some(x => x) ? null : { title: 'Закончить диктант?', line: `Ответов: ${results.filter(Boolean).length} из ${items.length}. Итоги этого диктанта не сохранятся.`,
        actions: [{ label: 'Закончить', value: 'close', cls: 'bad' }], cancel: 'Продолжить' }),
      body: '<div data-dc></div>',
      foot: '<button class="btn ghost" data-dc-skip>Пропустить</button><button class="btn primary" data-dc-next>Проверить</button>',
      onClose: () => { ctl && ctl.stop(); TTS.stop(); opts.onDone && opts.onDone(results); },
    });
    const box = m.$('[data-dc]'), next = m.$('[data-dc-next]'), skip = m.$('[data-dc-skip]');
    const play = slow => TTS.speak(items[i].no, 'no', slow ? { rate: 0.55, place: 'speech' } : { place: 'speech' });

    function show() {
      checked = false; ctl && ctl.stop(); ctl = null;
      const it = items[i];
      m.el.querySelector('.modal-head h2').textContent = `✍️ Диктант · ${i + 1} из ${items.length}`;
      box.innerHTML = `<div class="sp-progress"><i style="width:${i / items.length * 100}%"></i></div>
        <div class="row sp-ref"><button class="btn" data-dc-play>🔊 Прослушать</button><button class="btn sm" data-dc-slow>🐢 Медленно</button><span class="grow"></span>
          ${UI.seg('dictMode', [['type', '⌨️ Написать'], ['say', '🎙 Сказать вслух']], mode)}</div>
        ${mode === 'type'
          ? `<textarea class="input sp-input" data-dc-in rows="2" lang="nb" placeholder="Напишите, что услышали…" autocomplete="off" autocapitalize="sentences" spellcheck="false"></textarea>
             <div class="row sp-letters">${['æ', 'ø', 'å'].map(ch => `<button class="btn sm" data-dc-ch="${ch}">${ch}</button>`).join('')}<span class="tiny muted">Enter — проверить</span></div>`
          : '<div class="small muted center">Послушайте и повторите вслух — сравню с оригиналом</div><div data-dc-rec></div>'}
        <div class="sp-result" data-dc-res hidden></div>`;
      next.textContent = 'Проверить'; next.hidden = mode === 'say'; skip.hidden = false;
      box.querySelector('[data-dc-play]').onclick = () => play(false);
      box.querySelector('[data-dc-slow]').onclick = () => play(true);
      box.querySelector('[data-seg="dictMode"]').onclick = e => {
        const b = e.target.closest('button'); if (!b || b.dataset.v === mode) return;
        mode = b.dataset.v; Store.setSetting('dictMode', mode); show();
      };
      const inp = box.querySelector('[data-dc-in]');
      if (inp) {
        inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); next.click(); } });
        box.querySelectorAll('[data-dc-ch]').forEach(b => b.onclick = () => {
          const s = inp.selectionStart, en = inp.selectionEnd;
          inp.value = inp.value.slice(0, s) + b.dataset.dcCh + inp.value.slice(en);
          inp.focus(); inp.selectionStart = inp.selectionEnd = s + 1;
        });
        setTimeout(() => inp.focus(), 80);
      } else {
        ctl = recorderUI(box.querySelector('[data-dc-rec]'), { maxMs: 10000, onText: (heard) => check(heard, 'say') });
      }
      setTimeout(() => play(false), 300);
    }
    function check(answer, how) {
      const it = items[i];
      const res = compare(it.no, answer);
      checked = true;
      results[i] = { no: it.no, ru: it.ru, answer, score: res.score, mode: how };
      const r = box.querySelector('[data-dc-res]');
      r.hidden = false;
      const foldOnly = how === 'type' && res.items.some(x => x.kind === 'close' && fold(x.tn) === fold(words(x.h).join('')));
      r.innerHTML = `<div class="sp-score ${res.score >= 70 ? 'good' : res.score >= 40 ? 'mid' : 'low'}"><b>${res.score}%</b> <span>${res.score === 100 ? 'Без ошибок! 🎉' : verdict(res.score)}</span></div>
        <div class="sp-target sm" lang="nb">${wordsHtml(res, how)}</div>
        <div class="sp-answer"><span class="muted small">Правильно:</span> <b lang="nb">${U.esc(it.no)}</b> <button class="icon-btn sm" data-dc-say title="Прослушать">🔊</button>
          ${it.ru ? `<div class="ru-text small">${U.esc(it.ru)}</div>` : ''}</div>
        ${how === 'say' ? `<div class="small muted">Услышано: «${U.esc(answer || '—')}»</div>` : ''}
        ${foldOnly ? '<div class="small">💡 Проверьте буквы æ, ø, å — на телефоне: удерживайте a / o.</div>' : ''}
        ${how === 'say' && res.score < 100 ? `<ul class="sp-tips">${tips(res, answer).map(t => `<li>${U.esc(t)}</li>`).join('')}</ul>` : ''}`;
      r.querySelector('[data-dc-say]').onclick = () => TTS.speak(it.no, 'no', { place: 'speech' });
      const inp = box.querySelector('[data-dc-in]'); if (inp) inp.readOnly = true;
      next.hidden = false; skip.hidden = true;
      next.textContent = i + 1 < items.length ? 'Дальше →' : 'Итоги';
    }
    function summary() {
      ctl && ctl.stop(); ctl = null; over = true;
      const done = results.filter(Boolean);
      const avg = done.length ? Math.round(done.reduce((s, x) => s + x.score, 0) / done.length) : 0;
      m.el.querySelector('.modal-head h2').textContent = '✍️ Диктант — итоги';
      box.innerHTML = `<div class="sp-score big ${avg >= 70 ? 'good' : avg >= 40 ? 'mid' : 'low'}"><b>${avg}%</b> <span>${done.length} из ${items.length} · ${verdict(avg)}</span></div>
        <div class="sp-sum">${items.map((it, k) => { const x = results[k]; return `<div class="sp-sum-row ${x ? (x.score >= 90 ? 'ok' : x.score >= 50 ? 'close' : 'bad') : 'skip'}">
          <span class="sp-sum-score">${x ? x.score + '%' : '—'}</span><span class="grow"><b lang="nb">${U.esc(it.no)}</b>${x && x.score < 100 && x.answer ? `<br><span class="small muted">${x.mode === 'say' ? 'услышано' : 'написано'}: ${U.esc(x.answer)}</span>` : ''}</span>
          <button class="icon-btn sm" data-sum-say="${k}" title="Прослушать">🔊</button></div>`; }).join('')}</div>`;
      box.querySelectorAll('[data-sum-say]').forEach(b => b.onclick = () => TTS.speak(items[+b.dataset.sumSay].no, 'no', { place: 'speech' }));
      skip.hidden = true; next.hidden = false; next.textContent = opts.items ? '🔁 Ещё раз' : `🔁 Ещё ${items.length}`;
      next.onclick = () => { m.close(); dictation(opts.items ? Object.assign({}, opts, { items: U.shuffle(items) }) : { count: items.length, onDone: opts.onDone }); };
      const f = m.el.querySelector('.modal-foot');
      if (!f.querySelector('[data-dc-close]')) f.insertAdjacentHTML('afterbegin', '<button class="btn ghost" data-dc-close>Готово</button>');
      f.querySelector('[data-dc-close]').onclick = () => m.close();
    }
    next.onclick = () => {
      if (!checked && mode === 'type') { const v = (box.querySelector('[data-dc-in]') || {}).value || ''; if (!v.trim()) { box.querySelector('[data-dc-in]').focus(); return; } check(v, 'type'); return; }
      if (!checked) return;
      if (++i < items.length) show(); else summary();
    };
    skip.onclick = () => { results[i] = null; if (++i < items.length) show(); else summary(); };
    show();
    return m;
  }

  /* ================= 📴 Piper: offline voices (Norwegian, Russian, Ukrainian) ================= */
  const Piper = {
    _rt: null, _m: null, _q: Promise.resolve(), _idle: 0,
    VOICES: PIPER_VOICES, DEFAULT: PIPER_DEFAULT,
    available() { return hasWasm && hasCaches; },
    group: pGroup,
    /** downloaded? (sync, from the flags kept by Models.status) — no key = the old Norwegian voice */
    isReady(key) { return this.available() && !!flags()[pGroup(key || PIPER_DEFAULT)]; },
    async status(key) { return Models.status(pGroup(key || PIPER_DEFAULT)); },
    /** {total, missing, runtimeMissing} bytes for the consent text: «63 МБ (+40 МБ общий модуль)» */
    async need(key) {
      const st = await Models.status(pGroup(key || PIPER_DEFAULT));
      const own = pFiles(key || PIPER_DEFAULT);
      const rt = st.missing.filter(k => !own.includes(k)).reduce((n, k) => n + F[k][1], 0);
      return { total: st.missingBytes, voice: st.missingBytes - rt, runtime: rt, ready: st.ready, bytes: st.bytes };
    },
    /** the old one-window download (Speech hub) */
    async download(key) { const r = await consent(pGroup(key || PIPER_DEFAULT)); return r === true; },
    /** download without a window: onProgress(doneBytes, totalBytes); signal cancels (finished files stay) */
    async downloadVoice(key, onProgress, signal) { return Models.download(pGroup(key || PIPER_DEFAULT), onProgress, signal); },
    async remove(key) { await Models.remove(pGroup(key || PIPER_DEFAULT)); },
    /** bytes only this voice uses (what deleting it frees) */
    async ownBytes(key) { return Models.ownBytes(pGroup(key || PIPER_DEFAULT)); },
    drop(key) {
      if (this._m && (!key || this._m.key === key)) { const m = this._m; this._m = null; m.p.then(x => { try { x.session.release && x.session.release(); } catch (e) { /* ignore */ } }, () => {}); }
    },
    /** the runtime (ONNX + espeak-ng phonemizer): loaded once for all voices */
    runtime() {
      if (this._rt) return this._rt;
      this._rt = (async () => {
        const [ortMod, phMod, phWasm, phData] = await Promise.all([Models.importMod('ortjs'), Models.importMod('phjs'), Models.buf('phwasm'), Models.buf('phdata')]);
        const ort = ortMod.default && ortMod.default.InferenceSession ? ortMod.default : ortMod;
        await Models.ortWasm(ort.env.wasm);
        let out = '';
        const ph = await phMod.createPiperPhonemize({
          noInitialRun: true, wasmBinary: phWasm, getPreloadedPackage: () => phData,
          print: d => { out = d; }, printErr: () => {}, locateFile: u => u,
        });
        const phonemize = (text, voice) => {
          out = '';
          ph.callMain(['-l', voice, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']);
          return out ? JSON.parse(out).phonemes || [] : [];
        };
        return { ort, phonemize };
      })();
      this._rt.catch(() => { this._rt = null; });
      return this._rt;
    },
    /** one voice in memory at a time (phones have little of it); unloaded after 2 minutes without use */
    load(key) {
      key = key || PIPER_DEFAULT;
      if (this._m && this._m.key === key) return this._m.p;
      this.drop();
      const [fv, fj] = pFiles(key);
      const p = (async () => {
        const [rt, cfgBuf, model] = await Promise.all([this.runtime(), Models.buf(fj), Models.buf(fv)]);
        const cfg = JSON.parse(new TextDecoder().decode(cfgBuf));
        const session = await rt.ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
        return { ort: rt.ort, cfg, session, phonemize: t => rt.phonemize(t, (cfg.espeak && cfg.espeak.voice) || 'nb') };
      })();
      this._m = { key, p };
      p.catch(() => { if (this._m && this._m.p === p) this._m = null; });
      return p;
    },
    /** phonemes (Piper 1.5 rules: sentences, merged vowel clusters, model's id map) -> id arrays per sentence */
    ids(cfg, phonemes) {
      const map = cfg.phoneme_id_map, clusters = (cfg.vowel_clusters || []).map(c => c.join(''));
      const sentences = [[]];
      phonemes.forEach(p => { sentences[sentences.length - 1].push(p); if (/^[.!?]$/.test(p)) sentences.push([]); });
      return sentences.filter(s => s.some(p => /\S/.test(p) && !/^[.!?,;:]$/.test(p))).map(s => {
        const merged = [];
        for (let i = 0; i < s.length; i++) {
          if (i + 1 < s.length && clusters.includes(s[i] + s[i + 1]) && map[s[i] + s[i + 1]]) { merged.push(s[i] + s[i + 1]); i++; } else merged.push(s[i]);
        }
        const ids = [...map['^'], ...map['_']];
        merged.forEach(p => { if (map[p]) ids.push(...map[p], ...map['_']); });
        ids.push(...map['$']);
        return ids;
      });
    },
    /** a «text» model (uk_UA-ukrainian_tts): letters instead of phonemes — lower case, й/ї split into letter + mark */
    textIds(cfg, text) {
      const map = cfg.phoneme_id_map;
      const chars = [...String(text).toLowerCase().replace(/[’ʼ`]/g, "'").normalize('NFD')].filter(c => map[c]);
      return this.ids(Object.assign({}, cfg, { vowel_clusters: [] }), chars);
    },
    /** text -> WAV Blob (rate: 0.9 = normal, like TTS rates); o: { voice: model key, speaker: name or number } */
    synth(text, rate = 0.9, o = {}) {
      const key = o.voice || PIPER_DEFAULT;
      const job = this._q.then(async () => {
        clearTimeout(this._idle);
        const { ort, cfg, session, phonemize } = await this.load(key);
        const inf = cfg.inference || {};
        const speed = Math.max(0.45, Math.min(2.2, (rate || 0.9) / 0.9));
        const ls = (inf.length_scale || 1) / speed;
        // the speaker of a multi-speaker model (nvcc: 10, ukrainian_tts: 3) — before, it was always speaker 0
        let sid = 0;
        if (cfg.num_speakers > 1) {
          const m = cfg.speaker_id_map || {};
          sid = o.speaker != null && m[o.speaker] != null ? m[o.speaker] : Number.isInteger(+o.speaker) ? Math.max(0, Math.min(cfg.num_speakers - 1, +o.speaker)) : (cfg.default_speaker_id || 0);
        }
        const pcms = [];
        const parts = String(text).replace(/\s+/g, ' ').trim().match(/[^.!?…]+[.!?…]*|[.!?…]+/g) || [];
        for (const part of parts) {
          if (!/\p{L}|\p{N}/u.test(part)) continue;
          const list = cfg.phoneme_type === 'text' ? this.textIds(cfg, part.trim()) : this.ids(cfg, phonemize(part.trim()));
          for (const ids of list) {
            const feeds = {
              input: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
              input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
              scales: new ort.Tensor('float32', Float32Array.from([inf.noise_scale ?? 0.667, ls, inf.noise_w ?? 0.8]), [3]),
            };
            if (cfg.num_speakers > 1) feeds.sid = new ort.Tensor('int64', BigInt64Array.from([BigInt(sid)]), [1]);
            const r = await session.run(feeds);
            pcms.push(r.output.data);
          }
        }
        if (!pcms.length) throw new Error('нечего читать');
        const sr = cfg.audio.sample_rate, gap = Math.round(sr * 0.18);
        const total = pcms.reduce((s, p) => s + p.length, 0) + gap * (pcms.length - 1);
        const v = new DataView(new ArrayBuffer(44 + total * 2));
        const w = (o, s) => { for (let k = 0; k < s.length; k++) v.setUint8(o + k, s.charCodeAt(k)); };
        w(0, 'RIFF'); v.setUint32(4, 36 + total * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, total * 2, true);
        // some models speak very quietly (nvcc: peak ≈ 0.1): brought up to the loudness of the others
        let peak = 0;
        pcms.forEach(p => { for (let j = 0; j < p.length; j++) { const a = p[j] < 0 ? -p[j] : p[j]; if (a > peak) peak = a; } });
        const gain = peak > 0.01 && peak < 0.5 ? Math.min(8, 0.85 / peak) : 1;
        let o2 = 44;
        pcms.forEach((p, k) => {
          for (let j = 0; j < p.length; j++) { const s = Math.max(-1, Math.min(1, p[j] * gain)); v.setInt16(o2, s < 0 ? s * 32768 : s * 32767, true); o2 += 2; }
          if (k < pcms.length - 1) o2 += gap * 2;
        });
        return new Blob([v.buffer], { type: 'audio/wav' });
      });
      this._q = job.catch(() => {});
      job.then(() => { clearTimeout(this._idle); this._idle = setTimeout(() => this.drop(), 120000); }, () => {});
      return job;
    },
  };

  /* ================= «Качество распознавания»: Авто / Лёгкое / Точное (settings + hub) ================= */
  async function qualityHtml() {
    if (!hasWasm || !hasCaches) return '<div class="small muted">⚠️ Этот браузер не умеет запускать модель распознавания на устройстве.</div>';
    const plan = await asrPlan(), q = plan.quality;
    const [sb, ss, ob, os] = await Promise.all([Models.status('asr'), Models.status('asrSmall'), Models.ownBytes('asr'), Models.ownBytes('asrSmall')]);
    const g = plan.gpu || {};
    const dev = plan.phone ? '📱 телефон или планшет' : !plan.desktop ? '💻 компьютер с небольшой памятью' : g.ok && !Dev.broken ? `💻 компьютер с видеокартой (WebGPU${g.name ? ': ' + U.esc(g.name) : ''})` : '💻 компьютер без WebGPU';
    // «partly» only when the model's own files are partly there (not just the ONNX runtime shared with the other one)
    const sz = (st, own) => st.ready ? `✅ скачано · ${fmtMB(st.bytes)}` : own ? `скачано частично · ещё ≈${fmtMB(st.missingBytes)}` : `≈${fmtMB(st.missingBytes)}`;
    const slowSmall = plan.device !== 'webgpu';
    const opt = (v, title, desc) => `<label class="sp-q-opt${q === v ? ' on' : ''}"><input type="radio" name="sp-asrq" value="${v}" data-asrq ${q === v ? 'checked' : ''}><span><b>${title}</b><span class="tiny muted">${desc}</span></span></label>`;
    return `<div class="sp-q">
      <div class="small muted">Это устройство: ${dev} → рекомендуется <b>${ASR[plan.recommended].label}</b>.</div>
      <div class="sp-q-opts">
        ${opt('auto', 'Авто', `сейчас: ${ASR[plan.key].label}${q === 'auto' && plan.key !== plan.recommended ? ` — ${ASR.small.label.split(' ')[0]} ещё не скачано, выберите его, чтобы скачать` : ''}`)}
        ${opt('fast', ASR.base.label, `${ASR.base.name} · ${sz(sb, ob)} · для телефонов и слабых компьютеров`)}
        ${opt('accurate', ASR.small.label, `${ASR.small.name} · ${sz(ss, os)} · на ≈30% меньше ошибок${slowSmall ? ` · <span class="sp-q-warn">⚠️ ${plan.phone || !plan.desktop ? 'на этом устройстве' : 'без WebGPU в этом браузере'} — в ≈4 раза медленнее реального времени: субтитры будут отставать от видео</span>` : ''}`)}
      </div>
      <div class="sp-q-del">${[['asr', ASR.base, ob], ['asrSmall', ASR.small, os]].filter(([gr, , b]) => b && gr !== plan.group).map(([gr, m, b]) => `<button class="btn sm" data-asrq-del="${gr}">🗑 Удалить ${m.name} — освободить ${fmtMB(b)}</button>`).join('')}</div>
    </div>`;
  }
  /** pick a quality: downloads the model it needs (with the consent window), then offers to delete the other one */
  async function setQuality(q) {
    const prev = quality();
    if (q === prev) return true;
    Store.setSetting('asrQuality', q); replan();
    const plan = await asrPlan();
    if (!(await Models.status(plan.group)).ready) {
      const ok = await consent(plan.group, { title: '🎙 ' + ASR[plan.key].label, noBrowser: true, okLabel: '⬇ Скачать' });
      if (ok !== true) { Store.setSetting('asrQuality', prev); replan(); return false; }
    }
    const otherG = plan.group === 'asr' ? 'asrSmall' : 'asr', other = otherG === 'asr' ? ASR.base : ASR.small;
    const b = await Models.ownBytes(otherG);
    if (b && await UI.confirm(`Теперь используется <b>${ASR[plan.key].name}</b>. Удалить ${other.name}, чтобы освободить ${fmtMB(b)}? Понадобится — скачаете снова.`, { ok: '🗑 Удалить', cancel: 'Оставить', title: 'Освободить место?' })) {
      await Models.remove(otherG); UI.toast('Удалено: ' + other.name, 'good');
    }
    UI.toast('Качество распознавания: ' + ASR[plan.key].label, 'good');
    return true;
  }
  /** fill a box (the settings panel) with the quality choice and keep it working */
  async function mountQuality(el) {
    if (!el) return;
    const draw = async () => { el.innerHTML = await qualityHtml(); };
    if (!el._spq) {
      el._spq = true;
      el.addEventListener('change', async e => {
        const r = e.target.closest('[data-asrq]'); if (!r || !r.checked) return;
        el.querySelectorAll('input[data-asrq]').forEach(x => { x.disabled = true; });
        await setQuality(r.value).catch(err => UI.toast(err.message || String(err), 'bad'));
        draw();
      });
      el.addEventListener('click', async e => {
        const d = e.target.closest('[data-asrq-del]'); if (!d) return;
        const gr = d.dataset.asrqDel, m = gr === 'asr' ? ASR.base : ASR.small;
        if (!await UI.confirm(`Удалить ${m.name} с этого устройства? Понадобится — скачаете снова.`, { ok: 'Удалить', danger: true })) return;
        await Models.remove(gr); UI.toast('Удалено', 'good'); draw();
      });
    }
    el.innerHTML = '<div class="small muted"><span class="spinner sm"></span> Проверяю устройство…</div>';
    await draw();
  }
  function qualityModal() {
    return new Promise(resolve => {
      const m = UI.modal({ title: '🎙 Качество распознавания', cls: 'narrow', body: '<div data-spq></div>', onClose: () => resolve() });
      mountQuality(m.$('[data-spq]'));
    });
  }

  /* ================= hub ================= */
  async function statusHtml() {
    const plan = await asrPlan(), am = ASR[plan.key], other = plan.key === 'base' ? ASR.small : ASR.base;
    const [a, p, ob, own] = await Promise.all([Models.status(plan.group), Models.status('piper'), Models.ownBytes(other.group), Models.ownBytes(plan.group)]);
    let est = '';
    try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); est = `Занято браузером: ${fmtMB(e.usage || 0)}${e.quota ? ' из ' + fmtMB(e.quota) : ''}`; } } catch (e) { /* ignore */ }
    const sr = !!SR();
    const asrPref = Store.settings.speechAsr;
    const piperOn = !!(window.Voices && Voices.current && Voices.current('no') === 'piper:' + PIPER_DEFAULT);
    return `<div class="sp-status">
      <div class="sp-st-row"><div class="grow"><b>🗣 Распознавание речи — ${am.name}</b>
          <div class="small muted">Национальная библиотека Норвегии · Apache-2.0 · работает на устройстве</div>
          <div class="small" data-hub-quality>Качество: <b>${am.label}</b>${plan.quality === 'auto' ? ' (авто)' : ''} · ${plan.device === 'webgpu' ? 'видеокарта (WebGPU)' : 'процессор'} · <a href="#" data-hub="quality">изменить</a></div>
          ${ob ? `<div class="tiny muted">Также скачана ${other.name} (${fmtMB(ob)}) · <a href="#" data-hub="del-other">🗑 удалить</a></div>` : ''}
          <div class="small">${!hasWasm || !hasCaches ? '⚠️ Этот браузер не умеет запускать модель' : a.ready ? `✅ Скачано · ${fmtMB(a.bytes)} · работает без интернета` : own ? `⏸ Скачано частично (${fmtMB(a.bytes)}) — докачайте ≈${fmtMB(a.missingBytes)}` : `Не скачано · ≈${fmtMB(a.missingBytes)} один раз`}</div>
          ${!a.ready ? `<div class="tiny muted">${sr ? `Без модели: распознавание браузера (звук может уходить на сервер Google / Apple)${asrPref === 'browser' ? ' — <b>выбрано</b>' : ''}` : 'Без модели проверка произношения недоступна в этом браузере'}</div>` : ''}
        </div>
        <div class="col sp-st-btns">${a.ready ? '<button class="btn sm" data-hub="del-asr">🗑 Удалить модель</button>' : hasWasm && hasCaches ? `<button class="btn sm primary" data-hub="dl-asr">⬇ Скачать ≈${fmtMB(a.missingBytes)}</button>` : ''}</div></div>
      <div class="sp-st-row"><div class="grow"><b>📴 Офлайн-голос Piper — norsk «talesyntese»</b>
          <div class="small muted">MIT · запись CC0 (Språkbanken) · русские и украинские офлайн-голоса — в <a href="#" data-voices-open="no">🔊 Голосах</a></div>
          <div class="small">${!hasWasm || !hasCaches ? '⚠️ Недоступно в этом браузере' : p.ready ? `✅ Скачано · ${fmtMB(p.bytes)}${piperOn ? ' · <b>используется для норвежского</b>' : ''}` : `Не скачано · ≈${fmtMB(p.missingBytes)} один раз`}</div></div>
        <div class="col sp-st-btns">${p.ready ? `<button class="btn sm" data-hub="test-piper">▶ Прослушать</button>${piperOn ? '' : '<button class="btn sm primary" data-hub="use-piper">★ Использовать</button>'}<button class="btn sm" data-hub="del-piper">🗑 Удалить</button>` : hasWasm && hasCaches ? `<button class="btn sm" data-hub="dl-piper">⬇ Скачать ≈${fmtMB(p.missingBytes)}</button>` : ''}</div></div>
      ${est ? `<div class="tiny muted">${est}</div>` : ''}
    </div>`;
  }
  function cardSuggestions(n = 6) {
    const list = (window.Store && Store.state ? Store.cards() : []).map(c => ({ no: clean(c.no), ru: clean(c.ru) })).filter(x => isNo(x.no) && x.no.length <= 90);
    return U.shuffle(list).slice(0, n);
  }
  function open() {
    const sug = cardSuggestions();
    const m = UI.modal({
      title: '🗣 Речь: произношение и диктант', cls: 'sp-hub',
      body: `<div class="sp-hub-grid">
          <section class="sp-tile"><h3>🗣 Проверка произношения</h3>
            <p class="small muted">Скажите норвежскую фразу — покажу, какие слова прозвучали верно, и подскажу, что поправить.</p>
            <textarea class="input" data-hub-text rows="2" lang="nb" placeholder="Введите норвежское слово или предложение…">${sug[0] ? U.esc(sug[0].no) : U.esc(BUILTIN[0][0])}</textarea>
            ${sug.length ? `<div class="sp-chips">${sug.map((x, k) => `<button class="chip" data-hub-pick="${k}" title="${U.esc(x.ru)}">${U.esc(x.no.length > 34 ? x.no.slice(0, 32) + '…' : x.no)}</button>`).join('')}<button class="chip" data-hub="shuffle" title="Другие карточки">🎲</button></div>` : ''}
            <button class="btn primary" data-hub="pron">🎙 Проверить произношение</button></section>
          <section class="sp-tile"><h3>✍️ Диктант</h3>
            <p class="small muted">Слушаете предложение — пишете (или говорите вслух) — видите ошибки, правильный ответ и перевод. 10 предложений из ваших карточек.</p>
            <button class="btn primary" data-hub="dict">✍️ Начать диктант</button></section>
        </div>
        <div data-hub-status><div class="small muted"><span class="spinner sm"></span> Проверяю модели…</div></div>
        <p class="small sp-privacy">🔒 Запись голоса обрабатывается прямо на устройстве и никуда не отправляется. <span class="muted">(Кроме режима «через браузер»: тогда браузер может отправлять звук на свой сервер.)</span></p>`,
    });
    let picks = sug;
    const refresh = async () => { m.$('[data-hub-status]').innerHTML = await statusHtml(); };
    refresh();
    m.el.addEventListener('click', async e => {
      const pick = e.target.closest('[data-hub-pick]');
      if (pick) { const x = picks[+pick.dataset.hubPick]; if (x) { m.$('[data-hub-text]').value = x.no; m.$('[data-hub-text]').dataset.ru = x.ru || ''; } return; }
      const b = e.target.closest('[data-hub]'); if (!b) return;
      const act = b.dataset.hub;
      if (act === 'pron') {
        const ta = m.$('[data-hub-text]'), t = ta.value.trim();
        const x = picks.find(p => p.no === t);
        if (!isNo(t)) { UI.toast('Введите норвежский текст', 'warn'); ta.focus(); return; }
        pronounce({ text: t, ru: x ? x.ru : '' });
      } else if (act === 'dict') dictation();
      else if (act === 'shuffle') {
        picks = cardSuggestions();
        const c = m.$('.sp-chips');
        c.innerHTML = picks.map((x, k) => `<button class="chip" data-hub-pick="${k}" title="${U.esc(x.ru)}">${U.esc(x.no.length > 34 ? x.no.slice(0, 32) + '…' : x.no)}</button>`).join('') + '<button class="chip" data-hub="shuffle" title="Другие карточки">🎲</button>';
      } else if (act === 'dl-asr') { if (await consentAsr() === true) refresh(); }
      else if (act === 'quality') { e.preventDefault(); qualityModal().then(refresh); }
      else if (act === 'del-other') {
        e.preventDefault();
        const plan = await asrPlan(), other = plan.key === 'base' ? ASR.small : ASR.base;
        if (!await UI.confirm(`Удалить ${other.name} с этого устройства? Сейчас используется ${ASR[plan.key].name}.`, { ok: 'Удалить', danger: true })) return;
        await Models.remove(other.group); UI.toast('Удалено', 'good'); refresh();
      }
      else if (act === 'dl-piper') { if (await consent('piper') === true) refresh(); }
      else if (act === 'del-asr' || act === 'del-piper') {
        const g = act === 'del-asr' ? (await asrPlan()).group : 'piper';
        if (!await UI.confirm(`Удалить ${GROUP_NAME[g]} с этого устройства? Понадобится — скачаете снова.`, { ok: 'Удалить', danger: true })) return;
        await Models.remove(g);
        if (g === 'piper' && window.Voices && Voices.onRemoved) Voices.onRemoved('piper:' + PIPER_DEFAULT);
        UI.toast('Удалено', 'good'); refresh();
      } else if (act === 'use-piper') { if (window.Voices && Voices.setPick) Voices.setPick('no', 'piper:' + PIPER_DEFAULT); UI.toast('Норвежский текст теперь читает Piper', 'good'); refresh(); }
      else if (act === 'test-piper') {
        b.disabled = true;
        try { await playBlob(await Piper.synth('Hei! Jeg leser norsk tekst, helt uten internett.', 0.9)); } catch (err) { UI.toast('Piper: ' + err.message, 'bad'); }
        b.disabled = false;
      }
    });
    return m;
  }
  function playBlob(blob) {
    return new Promise((res, rej) => {
      TTS.stop();
      const url = URL.createObjectURL(blob);
      // the first phrase loads the model (seconds): an unlocked element still plays after that wait (Safari)
      const a = window.Voices && Voices.audio ? Voices.audio(url) : new Audio(url);
      TTS._audio = a;
      a.onended = () => { if (TTS._audio === a) TTS._audio = null; URL.revokeObjectURL(a.src); res(); };
      a.onerror = () => rej(new Error('не удалось проиграть звук'));
      a.play().catch(rej);
    });
  }

  /* ready-made buttons for other screens: <button data-speech-pron="Jeg heter Anna" data-ru="Меня зовут Анна">…</button>,
   * data-speech-dict (dictation from the cards), data-speech-open (the hub). Capture phase: the card under it does not flip. */
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-speech-pron], [data-speech-dict], [data-speech-open]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    if (b.hasAttribute('data-speech-pron')) pronounce({ text: b.getAttribute('data-speech-pron'), ru: b.getAttribute('data-ru') || '' });
    else if (b.hasAttribute('data-speech-dict')) dictation();
    else open();
  }, true);
  const btnHtml = (text, ru, label = '🗣 Произношение', cls = 'btn sm') =>
    `<button class="${cls}" data-speech-pron="${U.esc(text)}"${ru ? ` data-ru="${U.esc(ru)}"` : ''} title="Проверка произношения: скажите вслух — покажу, что прозвучало верно">${label}</button>`;

  // refresh the sync «ready» flags (used by Voices.ready) once the page is idle
  if (hasCaches) setTimeout(() => { Object.keys(GROUPS).forEach(g => Models.status(g).catch(() => {})); }, 1500);

  const Speech = {
    open, pronounce, dictation, compare, tips, pickItems, btnHtml,
    /** the record button + engine choice, reused by other sections: recorder(box, { onText(text), maxMs }) → { start, stop, state } */
    recorder: recorderUI,
    piper: Piper, models: Models, consent,
    /** transcribe 16 kHz mono Float32Array with NB-Whisper (model must be downloaded) */
    transcribe: whisper,
    /** Float32Array chunks at `rate` → 16 kHz mono (silence at the ends trimmed) — for transcribe() */
    toMono16k: to16k,
    /** is the recognition model already on this device? */
    async asrReady() { try { return hasWasm && hasCaches && (await Models.status((await asrPlan()).group)).ready; } catch (e) { return false; } },
    /** download the recognition model this device uses (base or small) with the consent dialog -> true when ready */
    async ensureModel(opts) { return (await consentAsr(opts)) === true; },
    /** 🤖 the subtitles' own overlay (no window): download the model this device uses; onProgress(doneBytes, totalBytes) */
    async downloadAsr(onProgress, signal) {
      const plan = await asrPlan();
      await Models.download(plan.group, onProgress, signal);
      try { Store.setSetting('speechAsr', 'whisper'); } catch (e) { /* no settings yet */ }
      replan();
      return true;
    },
    /** start the model ahead of the first phrase (the worker starts, the files are read from the cache) */
    async warmAsr() { await loadAsr(await asrPlan()); return true; },
    /** «Лёгкое» from now on (the subtitles' offer when the accurate model can't keep up): downloaded if missing —
     *  until then the accurate one goes on working */
    async useLight(onProgress, signal) {
      Store.setSetting('asrQuality', 'fast'); replan();
      if (!(await Models.status('asr')).ready) await Models.download('asr', onProgress, signal);
      replan();
      return true;
    },
    async status() { const [asr, piper] = await Promise.all([Models.status((await asrPlan()).group), Models.status('piper')]); return { asr, piper, browserSR: !!SR() }; },
    /** which recognition model / device: {key, name, label, device, missingBytes, ready, quality, recommended} */
    async asrInfo() {
      const plan = await asrPlan(), st = await Models.status(plan.group);
      return Object.assign({}, plan, { name: ASR[plan.key].name, label: ASR[plan.key].label, ready: st.ready, missingBytes: st.missingBytes, size: fmtMB(st.missingBytes) });
    },
    /** «Качество распознавания» for the settings screen: mountQuality(box) */
    mountQuality, setQuality, qualityModal, device: Dev, ASR,
    /** average ms per transcribe() call (the subtitles adapt their phrase length to it) */
    callMs: 0, engine: null,
    lastTiming: null,
  };
  window.Speech = Speech;
})();
