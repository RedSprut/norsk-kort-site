/* NB-Whisper on WASM off the main thread (module worker, started by speech.js).
 * One recognition keeps the CPU busy for 3–4 s; on the page itself that froze the player's buttons and subtitle line
 * for as long. Here the page stays responsive. Everything it needs comes in the 'init' message: the transformers.js
 * module (a blob: URL of the cached copy, or the CDN), the ONNX runtime wasm, the model and its dtype.
 * Messages: {id, type: 'init' | 'run' | 'dispose'} → {id, ok, out | error}. */
let asr = null;
self.onmessage = async e => {
  const m = e.data || {};
  try {
    if (m.type === 'init') {
      const T = await import(m.tjs);
      const env = T.env;
      env.allowLocalModels = false;
      env.useBrowserCache = false;
      env.useCustomCache = true;
      const C = () => caches.open(m.cacheName);
      env.customCache = {
        match: async k => (await C()).match(typeof k === 'string' ? k : k.url),
        put: async (k, r) => { try { await (await C()).put(k, r); } catch (err) { /* ignore */ } },
      };
      const onnx = env.backends && env.backends.onnx;
      if (onnx) {
        try { onnx.logLevel = 'error'; } catch (err) { /* ignore */ }
        if (onnx.wasm) {
          onnx.wasm.numThreads = 1;
          onnx.wasm.proxy = false;
          if (m.wasmBinary) onnx.wasm.wasmBinary = m.wasmBinary;
          if (m.wasmPaths) onnx.wasm.wasmPaths = m.wasmPaths;
        }
      }
      asr = await T.pipeline('automatic-speech-recognition', m.repo, { dtype: m.dtype, device: 'wasm', session_options: { logSeverityLevel: 3 } });
      // NB-Whisper's tokenizer lists the timestamp tokens as «special» → segments would come back as [null, null]
      try { const tk = asr.tokenizer, b = tk.timestamp_begin; if (b > 0 && Array.isArray(tk.all_special_ids)) tk.all_special_ids = tk.all_special_ids.filter(i => i < b); } catch (err) { /* ignore */ }
      self.postMessage({ id: m.id, ok: true });
    } else if (m.type === 'run') {
      if (!asr) throw new Error('модель не загружена');
      const out = await asr(m.pcm, m.opts || {});
      self.postMessage({ id: m.id, ok: true, out: { text: out && out.text, chunks: out && out.chunks } });
    } else if (m.type === 'dispose') {
      const a = asr; asr = null;
      if (a && a.dispose) await a.dispose();
      self.postMessage({ id: m.id, ok: true });
    }
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: String((err && err.message) || err) });
  }
};
