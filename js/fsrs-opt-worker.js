/* 🧠 Background worker: fits the owner's FSRS-6 weights with the official fsrs-rs (WebAssembly, «fsrs-browser» from
 * cdn.jsdelivr.net, loaded only now) and checks them on his newer answers (js/fsrs-opt.js → optimise). The page stays fluid. */
// the same app version as the page (…/fsrs-opt-worker.js?v=NNN): the shared maths in fsrs.js / fsrs-opt.js
// (the message handler is set at once and waits for them — no message can arrive before it exists)
const VER = new URL(import.meta.url).search;
const ready = import('./fsrs.js' + VER).then(() => import('./fsrs-opt.js' + VER));

let lib = null;
async function trainer() {
  if (!lib) {
    const mod = await import(self.FSRSOpt.CDN + 'fsrs_browser.js');
    await mod.default({ module_or_path: self.FSRSOpt.CDN + 'fsrs_browser_bg.wasm' });
    lib = mod;
  }
  return (ratings, deltas, lengths) => {
    const f = new lib.Fsrs();
    // fsrs-rs prints every epoch's loss (and a panic's text) to the console: keep the console clean, keep the panic text
    const saved = {}, said = [];
    for (const k of ['log', 'info', 'debug', 'warn', 'error']) { saved[k] = console[k]; console[k] = (...a) => { said.push(a.join(' ')); if (said.length > 20) said.shift(); }; }
    try {
      // no progress object (it needs a thread pool); short-term memory on; 1 relearning step (the app re-shows a miss once)
      return Array.from(f.computeParameters(new Uint32Array(ratings), new Uint32Array(deltas), new Uint32Array(lengths), null, true, null, 1, null));
    } catch (e) {
      const panic = said.filter(x => /panick/.test(x)).pop();
      throw new Error(((panic || (e && e.message) || String(e)) + '').slice(0, 300));
    } finally {
      Object.assign(console, saved);
      try { f.free(); } catch (e) { /* ignore */ }
    }
  };
}

self.onmessage = async e => {
  const { seqs, current, minReviews } = e.data || {};
  try {
    await ready;
    let train = null;
    const res = await self.FSRSOpt.optimise(seqs || [], async (r, d, l) => {
      if (!train) train = await trainer();
      return train(r, d, l);
    }, { current, minReviews });
    self.postMessage(res);
  } catch (err) {
    self.postMessage({ status: 'error', error: String((err && err.message) || err) });
  }
};
