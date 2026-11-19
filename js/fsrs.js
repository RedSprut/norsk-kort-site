/* ============ FSRS-6 spaced repetition (defaults from ts-fsrs v6) ============
 * The 21 weights are the population averages unless the app has fitted the owner's own weights from his answers
 * (js/fsrs-opt.js → Store.settings.fsrsW). Personal weights are used only when they are valid; otherwise the defaults.
 * New weights act from each card's next answer — due dates already set are never moved.
 * Works in the page and in a Web Worker (the optimiser's evaluation uses the same maths).
 */
(function (root) {
  const DEFAULT_W = Object.freeze([0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796,
    1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542]);
  /** allowed range of every weight — the same clamps as fsrs-rs (parameter_clipper.rs, FSRS-6, ≤ 1 relearning step) */
  const BOUNDS = Object.freeze([[0.001, 100], [0.001, 100], [0.001, 100], [0.001, 100], [1, 10], [0.001, 4], [0.001, 4], [0.001, 0.75],
    [0, 4.5], [0, 0.8], [0.001, 3.5], [0.001, 5], [0.001, 0.25], [0.001, 0.9], [0, 4], [0, 1], [1, 6], [0, 2], [0, 2], [0, 0.8], [0.1, 0.8]]);
  const MIN = 60000;
  const DAY = 86400000;
  const clampD = d => Math.min(10, Math.max(1, d));
  const clampS = s => Math.max(0.01, Math.min(36500, s));

  /** 21 finite numbers inside the fsrs-rs bounds, initial stabilities in rising order (else it is not used) */
  function valid(w) {
    if (!w || typeof w.length !== 'number' || w.length !== 21) return false;
    for (let i = 0; i < 21; i++) {
      const v = w[i];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < BOUNDS[i][0] - 1e-6 || v > BOUNDS[i][1] + 1e-6) return false;
    }
    return w[0] <= w[1] + 1e-6 && w[1] <= w[2] + 1e-6 && w[2] <= w[3] + 1e-6;
  }

  /** the FSRS-6 formulas for one set of weights */
  function model(W) {
    const DECAY = -W[20];
    const FACTOR = Math.pow(0.9, 1 / DECAY) - 1;
    const m = {
      W,
      DECAY, FACTOR,
      retrievability(elapsedDays, S) {
        if (!S) return 0;
        return Math.pow(1 + FACTOR * Math.max(0, elapsedDays) / S, DECAY);
      },
      intervalDays(S, retention) {
        return S / FACTOR * (Math.pow(retention, 1 / DECAY) - 1);
      },
      initS(g) { return clampS(W[g - 1]); },
      initD(g, raw) { const d = W[4] - Math.exp(W[5] * (g - 1)) + 1; return raw ? d : clampD(d); },
      nextD(D, g) {
        const delta = -W[6] * (g - 3);
        const d1 = D + delta * (10 - D) / 9;
        return clampD(W[7] * m.initD(4, true) + (1 - W[7]) * d1);
      },
      recallS(D, S, R, g) {
        const hard = g === 2 ? W[15] : 1;
        const easy = g === 4 ? W[16] : 1;
        return clampS(S * (Math.exp(W[8]) * (11 - D) * Math.pow(S, -W[9]) * (Math.exp(W[10] * (1 - R)) - 1) * hard * easy + 1));
      },
      forgetS(D, S, R) {
        const f = W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R));
        return clampS(Math.min(f, S / Math.exp(W[17] * W[18])));
      },
      shortTermS(S, g) {
        let inc = Math.exp(W[17] * (g - 3 + W[18])) * Math.pow(S, -W[19]);
        // as in fsrs-rs (FSRS-6): a same-day «Трудно» / «Хорошо» / «Легко» never lowers the stability
        if (g >= 2) inc = Math.max(inc, 1);
        return clampS(S * inc);
      },
      /** memory state after answer g; elapsed in days (fractional), prev = {stability, difficulty} or null for the first answer */
      step(prev, g, elapsed) {
        if (!prev) return { stability: m.initS(g), difficulty: m.initD(g) };
        let S;
        if (elapsed < 1) S = m.shortTermS(prev.stability, g);
        else {
          const R = m.retrievability(elapsed, prev.stability);
          S = g === 1 ? m.forgetS(prev.difficulty, prev.stability, R) : m.recallS(prev.difficulty, prev.stability, R, g);
        }
        return { stability: S, difficulty: m.nextD(prev.difficulty, g) };
      },
    };
    return m;
  }

  const DEFAULT_MODEL = model(DEFAULT_W);
  let memoSrc = null, memoModel = null;
  /** the weights in use: the owner's fitted weights when valid, else the defaults */
  function active() {
    let w = null;
    try { const st = root.Store && root.Store.state; w = st && st.settings && st.settings.fsrsW; } catch (e) { w = null; }
    if (!w) return DEFAULT_MODEL;
    if (w === memoSrc) return memoModel;
    memoSrc = w;
    memoModel = valid(w) ? model(Object.freeze(Array.from(w))) : DEFAULT_MODEL;
    return memoModel;
  }

  /* ---------- fuzz + load balancing ----------
   * Fuzz ranges of FSRS (ts-fsrs / Anki): ±(1 + 15 % of 2.5–7 d + 10 % of 7–20 d + 5 % above 20 d).
   * Inside that small range the day is chosen like Anki's load balancer: days with fewer cards already due weigh more
   * ((1/count)^2.15 · (1/interval)^3, a day where the card's other direction is due ×0.001), random draw. Up to 90 days. */
  const FUZZ_RANGES = [[2.5, 7, 0.15], [7, 20, 0.1], [20, Infinity, 0.05]];
  function fuzzRange(ivl) {
    let delta = 1;
    for (const [a, b, f] of FUZZ_RANGES) delta += f * Math.max(Math.min(ivl, b) - a, 0);
    let lo = Math.max(2, Math.round(ivl - delta));
    const hi = Math.min(36500, Math.round(ivl + delta));
    lo = Math.min(lo, hi);
    return [lo, hi];
  }
  const LB_MAX = 90;
  /** local calendar day number of a time (for counting cards per day) */
  const dayNo = t => Math.floor((t - new Date(t).getTimezoneOffset() * MIN) / DAY);

  /** cards due per day, built once from the store and kept up to date on every answer */
  const Load = {
    map: null, src: null, len: -1,
    counts() {
      const st = root.Store && root.Store.state;
      if (!st || !Array.isArray(st.cards)) return null;
      if (this.map && this.src === st.cards && this.len === st.cards.length) return this.map;
      const map = new Map();
      for (const c of st.cards) {
        const srs = c && c.srs; if (!srs) continue;
        for (const d of ['nr', 'rn']) { const s = srs[d]; if (s && s.reps && s.due) { const k = dayNo(s.due); map.set(k, (map.get(k) || 0) + 1); } }
      }
      this.map = map; this.src = st.cards; this.len = st.cards.length;
      return map;
    },
    /** a card's due date moved (answer / undo): keep the counts without rebuilding */
    move(oldDue, newDue) {
      if (!this.map) return;
      if (oldDue) { const k = dayNo(oldDue); const n = (this.map.get(k) || 0) - 1; if (n > 0) this.map.set(k, n); else this.map.delete(k); }
      if (newDue) { const k = dayNo(newDue); this.map.set(k, (this.map.get(k) || 0) + 1); }
    },
    invalidate() { this.map = null; this.src = null; this.len = -1; },
    count(t) { const m = this.counts(); return m ? (m.get(dayNo(t)) || 0) : 0; },
  };

  /** pick the interval inside the fuzz range; load(dueTime) → cards already due that day (optional) */
  function fuzzInterval(ivl, now, opts) {
    const [lo, hi] = fuzzRange(ivl);
    const rnd = opts.random || Math.random;
    if (opts.load && hi <= LB_MAX) {
      const avoid = opts.avoidDay != null ? dayNo(opts.avoidDay) : null;
      const cand = [], weights = [];
      let sum = 0;
      for (let d = lo; d <= hi; d++) {
        const t = now + d * DAY;
        const n = opts.load(t);
        let w = (n > 0 ? Math.pow(1 / n, 2.15) : 1) * Math.pow(1 / d, 3);
        if (avoid != null && dayNo(t) === avoid) w *= 0.001;
        cand.push(d); weights.push(w); sum += w;
      }
      if (sum > 0 && Number.isFinite(sum)) {
        let r = rnd() * sum;
        for (let i = 0; i < cand.length; i++) { r -= weights[i]; if (r <= 0) return cand[i]; }
        return cand[cand.length - 1];
      }
    }
    return Math.min(hi, lo + Math.floor(rnd() * (hi - lo + 1)));
  }

  const FSRS = {
    DEFAULT_W,
    BOUNDS,
    valid,
    model,
    fuzzRange,
    Load,
    dayNo,
    /** the weights in use (personal when fitted and valid, else the defaults) */
    get W() { return active().W; },
    get personal() { return active() !== DEFAULT_MODEL; },
    retrievability(elapsedDays, S) { return active().retrievability(elapsedDays, S); },
    intervalDays(S, retention) { return active().intervalDays(S, retention); },
    initS(g) { return active().initS(g); },
    initD(g, raw) { return active().initD(g, raw); },
    nextD(D, g) { return active().nextD(D, g); },
    recallS(D, S, R, g) { return active().recallS(D, S, R, g); },
    forgetS(D, S, R) { return active().forgetS(D, S, R); },
    shortTermS(S, g) { return active().shortTermS(S, g); },

    /**
     * Apply a rating to a per-direction SRS record.
     * g: 1 = Again (не знаю), 2 = Hard, 3 = Good (знаю), 4 = Easy
     * opts: now, retention, fuzz, balance (spread over the days with fewer cards due), avoidDay (the other direction's due), w (weights)
     */
    review(prev, g, opts = {}) {
      const m = opts.w ? model(opts.w) : active();
      const now = opts.now || Date.now();
      const retention = opts.retention || 0.9;
      const s = Object.assign({ reps: 0, lapses: 0, streak: 0 }, prev || {});
      const isNew = !s.reps || s.stability == null;
      const next = m.step(isNew ? null : s, g, (now - (s.lastReview || now)) / DAY);
      const S = next.stability;
      s.stability = S;
      s.difficulty = next.difficulty;
      let dueIn;
      if (g === 1) {
        dueIn = MIN;
        s.interval = 0;
        if (!isNew && s.state === 'review') s.lapses = (s.lapses || 0) + 1;
        s.state = isNew || s.state !== 'review' ? 'learning' : 'relearning';
      } else {
        let ivl = Math.max(1, Math.round(m.intervalDays(S, retention)));
        if (g === 2) ivl = Math.max(1, Math.round(ivl * 0.8));
        if (opts.fuzz && ivl >= 3) {
          ivl = fuzzInterval(ivl, now, { load: opts.balance ? (opts.load || (t => Load.count(t))) : null, avoidDay: opts.avoidDay, random: opts.random });
        }
        ivl = Math.min(36500, Math.max(1, ivl));
        s.interval = ivl;
        dueIn = ivl * DAY;
        s.state = 'review';
      }
      s.due = now + dueIn;
      s.reps = (s.reps || 0) + 1;
      s.lastReview = now;
      s.lastGrade = g;
      s.streak = g === 1 ? 0 : (s.streak || 0) + 1;
      return s;
    },
    /** preview: due-in milliseconds for every grade (for button labels) */
    preview(prev, retention) {
      const out = {};
      for (const g of [1, 2, 3, 4]) {
        const r = this.review(prev, g, { retention });
        out[g] = r.due - Date.now();
      }
      return out;
    },
  };

  root.FSRS = FSRS;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window));
