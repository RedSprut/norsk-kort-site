/* ============ 🧠 FSRS personalised to your memory — automatic, in the background, with a safety check ============
 * Data: the answer log Store.state.log ({ts, c: card id, d: 'nr'|'rn', g: 1–4, n: 1 on a card's first answer}). For every
 * card and direction it gives the time-ordered answers (ts, grade) the optimiser needs; a history starts at its first answer
 * (n: 1), answers whose start fell out of the log (or that came with imported progress) are not used.
 * Optimiser: the official fsrs-rs (FSRS-6, 6.6) compiled to WebAssembly — npm «fsrs-browser@6.6.0» from cdn.jsdelivr.net,
 * loaded only when optimising, inside a Web Worker (js/fsrs-opt-worker.js): the page never freezes.
 * Safety: time split — weights fitted on your older answers must predict your newer answers clearly better than the current
 * weights (log-loss, paired test, and calibration RMSE by bins not worse) before anything changes; otherwise the average weights stay.
 * Adopted weights act from each card's next answer (due dates already set are not moved).
 * This file is shared by the page and the worker (pure functions + the page part, which needs Store / UI).
 */
(function (root) {
  const DAY = 864e5;
  const MIN_REVIEWS = 400;      // answers to cards that came back after ≥ 1 day (≈ Anki 24.04's 400-review minimum)
  const RERUN_DAYS = 30;        // then again after a month…
  const RERUN_NEW = 100;        // …and at least 100 new such answers
  const RETRY_DAYS = 1;         // after an error (offline, CDN): try again tomorrow
  const MAX_SEQ = 256;          // fsrs-rs max_seq_len
  const CDN = 'https://cdn.jsdelivr.net/npm/fsrs-browser@6.6.0/';
  const P_EPS = 1e-4;
  // the app version this script was loaded with (index.html → fsrs-opt.js?v=NNN) — the worker loads the same files
  const VER = (typeof document !== 'undefined' && document.currentScript && (/[?&]v=(\d+)/.exec(document.currentScript.src) || [])[1]) || '';

  /* ---------- data ---------- */
  /** the log → [{t: [timestamps], g: [grades]}] per card + direction, each starting at a first answer */
  function sequences(log) {
    const open = new Map();
    const out = [];
    const arr = Array.isArray(log) ? log.slice() : [];
    // the log is written in time order; a stable sort only repairs merged / restored logs
    let sorted = true;
    for (let i = 1; i < arr.length; i++) if (!(arr[i] && arr[i - 1]) || arr[i].ts < arr[i - 1].ts) { sorted = false; break; }
    if (!sorted) arr.sort((a, b) => ((a && a.ts) || 0) - ((b && b.ts) || 0));
    for (const e of arr) {
      if (!e || typeof e !== 'object') continue;
      const g = e.g, t = e.ts;
      if (!(g === 1 || g === 2 || g === 3 || g === 4) || typeof t !== 'number' || !Number.isFinite(t)) continue;
      if (e.d !== 'nr' && e.d !== 'rn') continue;
      const k = e.c + '|' + e.d;
      if (e.n) { const s = { t: [t], g: [g] }; open.set(k, s); out.push(s); continue; }
      const s = open.get(k);
      if (!s || s.t.length >= MAX_SEQ) continue; // start unknown (log trimmed / imported progress) — not used
      s.t.push(t); s.g.push(g);
    }
    return out.filter(s => s.t.length > 1);
  }
  /** days between answers as the app sees them: < 1 day = same-session (short-term) */
  const elapsedDays = (a, b) => (b - a) / DAY;
  /** fsrs-rs works in whole days: 0 = short-term, else the rounded number of days (≥ 1) */
  const intDays = e => (e < 1 ? 0 : Math.max(1, Math.round(e)));

  /** answers that can be predicted: the card came back after ≥ 1 day */
  function longTermCount(seqs) {
    let n = 0;
    for (const s of seqs) for (let i = 1; i < s.t.length; i++) if (elapsedDays(s.t[i - 1], s.t[i]) >= 1) n++;
    return n;
  }

  /** training data for fsrs-rs: one item per long-term answer (its whole history up to it), in time order */
  function items(seqs, until = Infinity) {
    const list = [];
    for (const s of seqs) {
      for (let i = 1; i < s.t.length; i++) {
        if (s.t[i] >= until) break;
        if (elapsedDays(s.t[i - 1], s.t[i]) >= 1) list.push({ s, i, ts: s.t[i] });
      }
    }
    list.sort((a, b) => a.ts - b.ts);
    const ratings = [], deltas = [], lengths = [];
    for (const { s, i } of list) {
      for (let j = 0; j <= i; j++) { ratings.push(s.g[j]); deltas.push(j ? intDays(elapsedDays(s.t[j - 1], s.t[j])) : 0); }
      lengths.push(i + 1);
    }
    return { ratings, deltas, lengths, count: list.length };
  }

  /* ---------- evaluation with the app's own FSRS formulas ---------- */
  /** probability to remember for every long-term answer: [{ts, p, y, bin}] */
  function predict(seqs, w) {
    const m = root.FSRS.model(w);
    const out = [];
    for (const s of seqs) {
      let st = null, ltBefore = 0, lapses = 0;
      for (let i = 0; i < s.t.length; i++) {
        const e = i ? elapsedDays(s.t[i - 1], s.t[i]) : 0;
        if (i && e >= 1) {
          let p = m.retrievability(e, st.stability);
          if (!Number.isFinite(p)) p = 0.5;
          p = Math.min(1 - P_EPS, Math.max(P_EPS, p));
          // bins as in fsrs-rs (r_matrix_index): interval, number of long-term answers, lapses
          const dt = intDays(e), len = ltBefore + 2;
          const dtBin = Math.round(2.48 * Math.pow(3.62, Math.floor(Math.log(dt) / Math.log(3.62))) * 100);
          const lenBin = Math.round(1.99 * Math.pow(1.89, Math.floor(Math.log(len) / Math.log(1.89))));
          const lapBin = lapses ? Math.round(1.65 * Math.pow(1.73, Math.floor(Math.log(lapses) / Math.log(1.73)))) : 0;
          out.push({ ts: s.t[i], p, y: s.g[i] > 1 ? 1 : 0, bin: dtBin + ':' + lenBin + ':' + lapBin });
        }
        st = m.step(st, s.g[i], e);
        if (i && e >= 1) { ltBefore++; if (s.g[i] === 1) lapses++; }
      }
    }
    return out;
  }
  const ll = r => -(r.y ? Math.log(r.p) : Math.log(1 - r.p));
  /** log-loss and RMSE(bins) of a list of predictions */
  function metrics(preds) {
    if (!preds.length) return { ll: NaN, rmse: NaN, n: 0 };
    let sum = 0;
    const bins = new Map();
    for (const r of preds) {
      sum += ll(r);
      const b = bins.get(r.bin) || { p: 0, y: 0, n: 0 };
      b.p += r.p; b.y += r.y; b.n++; bins.set(r.bin, b);
    }
    let se = 0;
    bins.forEach(b => { se += Math.pow(b.p / b.n - b.y / b.n, 2) * b.n; });
    return { ll: sum / preds.length, rmse: Math.sqrt(se / preds.length), n: preds.length };
  }
  /** paired comparison on the same answers: mean log-loss gain of b over a and its standard error */
  function paired(a, b) {
    const n = Math.min(a.length, b.length);
    if (!n) return { gain: 0, se: Infinity };
    let s = 0, s2 = 0;
    for (let i = 0; i < n; i++) { const d = ll(a[i]) - ll(b[i]); s += d; s2 += d * d; }
    const mean = s / n;
    const v = n > 1 ? (s2 - n * mean * mean) / (n - 1) : Infinity;
    return { gain: mean, se: Math.sqrt(Math.max(0, v) / n) };
  }
  /** b is clearly better than a: lower log-loss beyond noise (≥ 2 standard errors) and calibration not worse */
  function clearlyBetter(a, b) {
    const pr = paired(a, b);
    const ma = metrics(a), mb = metrics(b);
    return { ok: pr.gain > 0 && pr.gain > 2 * pr.se && mb.rmse <= ma.rmse + 1e-9 && Number.isFinite(mb.ll), gain: pr.gain, se: pr.se, a: ma, b: mb };
  }
  /** clean the optimiser's output: 21 finite numbers inside the bounds, else null */
  function sanitizeW(w) {
    if (!w || w.length !== 21) return null;
    const out = Array.from(w, v => +v);
    if (out.some(v => !Number.isFinite(v))) return null;
    // float32 from WebAssembly: round off the noise, then require the exact bounds
    for (let i = 0; i < 21; i++) out[i] = Math.round(out[i] * 1e6) / 1e6;
    return root.FSRS.valid(out) ? out : null;
  }

  /**
   * The whole run (in the worker). train(ratings, deltas, lengths) → 21 weights (fsrs-rs).
   * Time split: weights fitted on answers before 60 % / 80 % of the timeline predict the next 20 % each; the result is
   * compared on these 40 % with the current weights (and the defaults) — the same answers for every model.
   */
  async function optimise(seqs, train, opts = {}) {
    const D = root.FSRS.DEFAULT_W;
    const cur = opts.current && root.FSRS.valid(opts.current) ? Array.from(opts.current) : null;
    const all = predict(seqs, D).sort((a, b) => a.ts - b.ts);
    const n = all.length;
    if (n < (opts.minReviews || MIN_REVIEWS)) return { status: 'few', n };
    const cut = q => all[Math.min(n - 1, Math.floor(n * q))].ts;
    const folds = [[cut(0.6), cut(0.8)], [cut(0.8), Infinity]];
    const test = (preds, a, b) => preds.filter(r => r.ts >= a && r.ts < b).sort((x, y) => x.ts - y.ts);
    const refs = { def: all };
    if (cur) refs.cur = predict(seqs, cur).sort((a, b) => a.ts - b.ts);
    const heldRef = { def: [], cur: [] }, heldNew = [];
    const foldW = [];
    for (const [a, b] of folds) {
      const data = items(seqs, a);
      let w = null;
      if (data.count >= 64) w = sanitizeW(await train(data.ratings, data.deltas, data.lengths));
      if (!w) w = Array.from(cur || D); // not enough to fit on this fold: no change
      foldW.push(w);
      heldNew.push(...test(predict(seqs, w), a, b));
      heldRef.def.push(...test(refs.def, a, b));
      if (cur) heldRef.cur.push(...test(refs.cur, a, b));
    }
    const vsDef = clearlyBetter(heldRef.def, heldNew);
    const vsCur = cur ? clearlyBetter(heldRef.cur, heldNew) : vsDef;
    const curVsDef = cur ? clearlyBetter(heldRef.def, heldRef.cur) : null;
    const base = cur ? vsCur.a : vsDef.a;
    const res = { n, held: heldNew.length, def: vsDef.a, cand: vsDef.b, cur: cur ? vsCur.a : null, gain: vsCur.gain, se: vsCur.se };
    if (!(vsCur.ok && vsDef.ok)) {
      // personal weights that now predict clearly worse than the defaults are dropped
      if (cur && clearlyBetter(heldRef.cur, heldRef.def).ok) return Object.assign(res, { status: 'revert' });
      return Object.assign(res, { status: 'kept', curOk: curVsDef ? curVsDef.ok : null });
    }
    // adopt: fit on everything, and check once more on everything before saving
    const full = items(seqs);
    const W = sanitizeW(await train(full.ratings, full.deltas, full.lengths));
    if (!W) return Object.assign(res, { status: 'kept', why: 'invalid' });
    const inAll = metrics(predict(seqs, W)), defAll = metrics(all);
    if (!(inAll.ll < (cur ? metrics(refs.cur).ll : defAll.ll))) return Object.assign(res, { status: 'kept', why: 'in-sample' });
    return Object.assign(res, { status: 'adopt', w: W, base });
  }

  const FSRSOpt = {
    MIN_REVIEWS, RERUN_DAYS, RERUN_NEW, CDN,
    sequences, items, longTermCount, predict, metrics, paired, clearlyBetter, sanitizeW, optimise, intDays,
  };

  /* ---------- the page part: when to run, adopting, the line in Settings ---------- */
  if (typeof document !== 'undefined') {
    let cache = { len: -1, last: null, n: 0 };
    Object.assign(FSRSOpt, {
      running: false,
      /** long-term answers usable for fitting (cached by the log size) */
      usable() {
        const log = Store.state.log;
        const last = log[log.length - 1];
        if (cache.len === log.length && cache.last === last) return cache.n;
        cache = { len: log.length, last, n: longTermCount(sequences(log)) };
        return cache.n;
      },
      meta() { const m = Store.settings.fsrsOpt; return m && typeof m === 'object' ? m : {}; },
      personal() { return !!(Store.settings.fsrsW && FSRS.valid(Store.settings.fsrsW)); },
      /** is a run due now? (first time over the threshold, then monthly with ≥ 100 new answers, errors: next day) */
      due(now = Date.now()) {
        const n = this.usable();
        if (n < MIN_REVIEWS) return false;
        const m = this.meta();
        if (m.err && m.errAt && now - m.errAt < RETRY_DAYS * DAY) return false;
        if (!m.at) return true;
        return now - m.at >= RERUN_DAYS * DAY && n - (m.n || 0) >= RERUN_NEW;
      },
      /** called when the app is idle (start, end of a session) — never blocks anything */
      schedule(delay = 8000) {
        clearTimeout(this._t);
        this._t = setTimeout(() => {
          const go = () => { try { if (this.due()) this.run(); } catch (e) { console.warn('fsrs-opt', e); } };
          if (root.requestIdleCallback) requestIdleCallback(go, { timeout: 15000 }); else go();
        }, delay);
      },
      run() {
        if (this.running) return this._p;
        if (typeof Worker === 'undefined') return Promise.resolve(null);
        this.running = true;
        this.paint();
        const started = Date.now();
        const seqs = sequences(Store.state.log);
        const current = this.personal() ? Store.settings.fsrsW : null;
        return (this._p = new Promise(resolve => {
          let w;
          const done = res => {
            clearTimeout(timer);
            try { w && w.terminate(); } catch (e) { /* ignore */ }
            this.running = false;
            try { this.apply(res, started); } catch (e) { console.warn('fsrs-opt apply', e); }
            this.paint();
            resolve(res);
          };
          const timer = setTimeout(() => done({ status: 'error', error: 'timeout' }), 5 * 60000);
          try {
            w = new Worker('js/fsrs-opt-worker.js' + (VER ? '?v=' + VER : ''), { type: 'module' });
            w.onmessage = e => done(e.data || { status: 'error', error: 'empty' });
            w.onerror = e => { e.preventDefault && e.preventDefault(); done({ status: 'error', error: String(e.message || 'worker') }); };
            w.postMessage({ seqs, current });
          } catch (e) { done({ status: 'error', error: String(e.message || e) }); }
        }));
      },
      /** store the result; only clearly better, valid weights are saved */
      apply(res, started) {
        if (!res || !Store.state) return;
        const m = this.meta();
        if (m.resetAt && m.resetAt > started) return; // reset while it was running
        const now = Date.now();
        const round = x => (Number.isFinite(x) ? Math.round(x * 1e5) / 1e5 : null);
        const mt = x => (x ? { ll: round(x.ll), rmse: round(x.rmse), n: x.n } : null);
        if (res.status === 'error') { Store.setSetting('fsrsOpt', Object.assign({}, m, { err: String(res.error || '').slice(0, 200), errAt: now })); return; }
        if (res.status === 'few') return;
        const meta = { at: now, n: res.n, held: res.held, def: mt(res.def), cand: mt(res.cand), cur: mt(res.cur), status: res.status };
        if (res.status === 'adopt') {
          const W = sanitizeW(res.w);
          if (!W) { Store.setSetting('fsrsOpt', Object.assign(meta, { status: 'kept' })); return; }
          meta.adoptedAt = now; meta.base = mt(res.base);
          Store.settings.fsrsW = W;
          Store.setSetting('fsrsOpt', meta);
          const pct = x => { const v = x * 100; return (v < 10 ? v.toFixed(1).replace('.', ',') : Math.round(v)) + '%'; };
          // honest numbers only: the calibration error measured on his newer answers that the fit had not seen
          const a = pct(meta.base.rmse), b = pct(meta.cand.rmse);
          const how = a !== b ? `ошибка прогноза ${a} → ${b}` : 'прогноз точнее';
          if (root.UI) UI.toast(`🧠 Повторения подстроены под вашу память: ${how} на ваших последних ${res.held} ${U.plural(res.held, ['ответе', 'ответах', 'ответах'])}. Действует со следующего повторения каждой карточки.`, 'good', 9000);
          return;
        }
        if (res.status === 'revert') {
          Store.settings.fsrsW = null;
          Store.setSetting('fsrsOpt', meta);
          if (root.UI) UI.toast('🧠 Вернул средние настройки повторений: они точнее предсказывают ваши последние ответы.', '', 6000);
          return;
        }
        // kept: keep what is in use; remember personal weights' last good result
        if (this.personal() && m.adoptedAt) Object.assign(meta, { adoptedAt: m.adoptedAt, base: m.base, cand: m.cand, adoptN: m.adoptN != null ? m.adoptN : m.n, status: 'kept' });
        Store.setSetting('fsrsOpt', meta);
      },
      reset() {
        const m = this.meta();
        Store.settings.fsrsW = null;
        Store.setSetting('fsrsOpt', { at: Date.now(), n: this.usable(), status: 'reset', resetAt: Date.now(), prev: m.adoptedAt || null });
        this.paint();
        UI.toast('Вернул средние настройки повторений', 'good');
      },
      /** the read-only line next to the retention setting */
      lineHtml() {
        const m = this.meta();
        const n = this.usable();
        if (this.running) return '<span class="fsrs-line-run">⏳ Подстраиваю под вашу память… (в фоне)</span>';
        if (this.personal() && m.adoptedAt) {
          const used = m.adoptN != null ? m.adoptN : m.n;
          return `✅ Подстроено под вашу память: ${U.fmtDate(m.adoptedAt)}, по ${used} ${U.plural(used, ['повторению', 'повторениям', 'повторениям'])}`;
        }
        if (n < MIN_REVIEWS) {
          const need = MIN_REVIEWS - n;
          return `Средние настройки. Ещё рано подстраивать: нужно ещё ~${need} ${U.plural(need, ['повторение', 'повторения', 'повторений'])} по расписанию`;
        }
        if (m.status === 'reset') return `Средние настройки (сброшено ${U.fmtDate(m.resetAt)}). Проверю снова через месяц`;
        if (m.at && (m.status === 'kept' || m.status === 'revert')) return `Средние настройки — проверено ${U.fmtDate(m.at)} по ${m.n} ${U.plural(m.n, ['повторению', 'повторениям', 'повторениям'])}: свои параметры пока не точнее`;
        return 'Средние настройки — скоро подстрою под вашу память';
      },
      settingsHtml() {
        return `<div class="fsrs-line small muted" data-fsrs-line>${this.lineHtml()}</div>${this.personal() ? '<button class="btn sm" data-act="fsrs-reset" data-fsrs-reset>Сбросить к средним</button>' : ''}`;
      },
      paint() {
        const box = document.querySelector('[data-fsrs-box]');
        if (box) box.innerHTML = this.settingsHtml();
      },
    });
  }

  root.FSRSOpt = FSRSOpt;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window));
