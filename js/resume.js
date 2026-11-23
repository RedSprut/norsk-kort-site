/* ============ 📍 Resume — «Продолжить с места, где остановились» for everything long ============
 * One small shared helper: a video / programme / podcast / Telegram video or audio (media time), a book page,
 * a listening queue (card), a phrase… The place is kept on THIS device only (localStorage 'nk-resume').
 *
 *   Resume.save(kind, id, pos, meta)  remember the place (throttled: written at most every 2 s and when the page hides).
 *                                     meta = { unit: 'time'|'page'|'card'|'phrase'|'step', total (dur / pages / n), title }
 *                                     at the very start (< 5 s / page 1 / first item) or near the end (≥ 95 %) → forgotten
 *   Resume.get(kind, id)              → { pos, total, unit, title, at } or null
 *   Resume.clear(kind, id)            forget one place («Сбросить место»)
 *   Resume.clearAll()                 forget every place (Settings → «Забыть все места продолжения»)
 *   Resume.label(e)                   '12:34' · 'стр. 12' · 'карточка 3' · 'фраза 5' · 'шаг 2'
 *   Resume.ask({ kind, id, title, posLabel, owner }) → Promise<pos | null>: a small friendly choice
 *                                     «▶ Продолжить с места, где остановились (12:34)» / «Начать сначала»;
 *                                     no window when nothing (meaningful) is saved. «Начать сначала» forgets the place;
 *                                     ✕ / Esc → null too (from the start), the place stays; owner (an element):
 *                                     when it leaves the page (its window closed) the question closes too.
 *   Resume.count()                    how many places are remembered
 *   Resume.entries()                  every meaningful place: [{ kind, id, pos, total, unit, title, at }], newest first
 *                                     (home «▶ Продолжить», js/continue.js)
 *   Resume.prefer(kind, id, pos)      the next Resume.ask for this place answers by itself (pos — «Продолжить» there,
 *                                     null — «Начать сначала»): the home card already asked, the player must not ask again
 *   Resume.history()                  every place INCLUDING the finished ones (≥ 95 %): [{ kind, id, pos, total, unit,
 *                                     title, at, first, done }], newest first («📈 Мой прогресс», js/mypath.js)
 *   Resume.raw(kind, id) / Resume.restore(kind, id, raw)   the stored record as is — «Забыть» → «Отменить» puts it back
 *   Resume.note(kind, id, pos, cat)   a place that is kept elsewhere (the reader) only counts the time spent (no place here)
 *   Resume.minutes(days = 7)          → { listen, read, other } minutes over the last days (this device)
 * A finished place (≥ 95 %) is not offered again («Продолжить?» does not ask) but stays as «закончено» for «Мой прогресс»;
 * the store keeps at most 50 places of each kind, finished ones for 90 days.
 * A place written / forgotten → document event 'resume-changed' (the home card follows).
 * Live broadcasts never call it (they go on without us). Old places of the subtitle player ('nk-subs-pos') move here once.
 */
(function () {
  const KEY = 'nk-resume', LEGACY = 'nk-subs-pos';
  const MAX = 150;            // the most recent places (LRU)
  const MAX_CHARS = 60000;    // the whole store stays small
  const MIN_SEC = 5, END = 0.95;
  const PER_KIND = 50, DONE_DAYS = 90;       // the most recent places of one kind; a finished one is kept this long
  const MIN_KEY = 'nk-resume-min', MIN_DAYS = 28; // seconds spent per day: { 'YYYY-MM-DD': { l, r, o } }
  // other places this app keeps (cleared by «Забыть все места продолжения» too)
  const OTHER_KEYS = ['nk-listen-pos'];

  let all = null, dirty = false, timer = 0, want = null;
  const now = () => Date.now();
  const k = (kind, id) => String(kind || 'x') + '|' + String(id == null ? '' : id).slice(0, 300);
  const str = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);

  function load() {
    if (all) return all;
    all = {};
    try { const j = JSON.parse(localStorage.getItem(KEY) || '{}'); if (j && typeof j === 'object' && !Array.isArray(j)) all = j; } catch (e) { all = {}; }
    // the subtitle player's old places → here (once)
    try {
      const old = JSON.parse(localStorage.getItem(LEGACY) || 'null');
      if (old && typeof old === 'object') {
        Object.entries(old).forEach(([id, v]) => { if (v && +v.t >= MIN_SEC && !all[k('media', id)]) all[k('media', id)] = { p: +v.t, u: 'time', d: 0, t: '', at: +v.at || now() }; });
        localStorage.removeItem(LEGACY);
        dirty = true; flushSoon();
      }
    } catch (e) { /* nothing to move */ }
    return all;
  }
  function trim() {
    Object.keys(all).forEach(x => { if (!all[x] || typeof all[x] !== 'object') delete all[x]; });
    const keys = Object.keys(all);
    keys.sort((a, b) => (+all[b].at || 0) - (+all[a].at || 0));
    // finished long ago → gone; at most PER_KIND of each kind
    const per = {}, old = now() - DONE_DAYS * 864e5;
    keys.forEach(x => {
      const kind = x.slice(0, x.indexOf('|'));
      per[kind] = (per[kind] || 0) + 1;
      if (per[kind] > PER_KIND || (all[x].f && (+all[x].at || 0) < old)) delete all[x];
    });
    keys.filter(x => all[x]).slice(MAX).forEach(x => delete all[x]);
    let s = JSON.stringify(all);
    while (s.length > MAX_CHARS && Object.keys(all).length) {
      const old = Object.keys(all).sort((a, b) => (+all[a].at || 0) - (+all[b].at || 0)).slice(0, 10);
      old.forEach(x => delete all[x]);
      s = JSON.stringify(all);
    }
    return s;
  }
  /* ---- ⏱ time spent (listened / watched, read, other) — a few numbers per day ---- */
  let mins = null, minsDirty = false;
  const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  function minsLoad() {
    if (mins) return mins;
    try { const j = JSON.parse(localStorage.getItem(MIN_KEY) || '{}'); mins = j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch (e) { mins = {}; }
    return mins;
  }
  function spend(cat, sec) {
    if (!(sec > 0)) return;
    const m = minsLoad(), d = dayKey(now());
    const o = m[d] || (m[d] = {});
    o[cat] = Math.round(((+o[cat] || 0) + Math.min(sec, 600)) * 10) / 10;
    minsDirty = true; flushSoon();
  }
  /** how long was spent between two remembered places of the same thing */
  function track(cat, unit, oldP, oldAt, p) {
    const dt = (now() - (+oldAt || 0)) / 1000;
    if (!(dt > 0) || dt > 600) return;
    if (unit === 'time') { const adv = p - oldP; if (adv > 0 && adv <= dt * 3 + 3) spend(cat, Math.min(adv, dt + 1)); }
    else if (p !== oldP && dt <= 300) spend(cat, dt);
  }
  const catOf = (kind, unit) => unit === 'time' ? 'l' : unit === 'page' || kind === 'book' || kind === 'reader' ? 'r' : 'o';
  function minsFlush() {
    if (!minsDirty || !mins) return;
    minsDirty = false;
    const keep = Object.keys(mins).sort().slice(-MIN_DAYS);
    Object.keys(mins).forEach(d => { if (!keep.includes(d)) delete mins[d]; });
    try { localStorage.setItem(MIN_KEY, JSON.stringify(mins)); } catch (e) { /* full / private mode */ }
  }
  const noted = new Map(); // places kept elsewhere: key → { p, at } (this visit only)

  function flush() {
    clearTimeout(timer); timer = 0;
    minsFlush();
    if (!dirty || !all) return;
    dirty = false;
    try { localStorage.setItem(KEY, trim()); } catch (e) { /* full / private mode — kept for this visit */ }
    try { document.dispatchEvent(new CustomEvent('resume-changed')); } catch (e) { /* old browser */ }
  }
  function flushSoon() { if (!timer) timer = setTimeout(flush, 2000); }

  /** a place worth coming back to? (not at the very start, not at the end) */
  function meaningful(e) {
    if (!e || e.f || !isFinite(+e.p)) return false;
    const p = +e.p, d = +e.d || 0;
    if (e.u === 'time') { if (p < MIN_SEC) return false; if (d > 0 && (p >= d * END || d - p < 3)) return false; return true; }
    if (e.u === 'page') { if (p <= 1) return false; if (d > 1 && p >= d * END) return false; return true; }
    // 0-based item (card / phrase / step)
    if (p <= 0) return false;
    if (d > 1 && p + 1 >= d * END) return false;
    return true;
  }
  /** at (or past) the end? */
  function finished(e) {
    const p = +e.p, d = +e.d || 0;
    if (!(d > 0)) return false;
    if (e.u === 'time') return p >= d * END || d - p < 3;
    if (e.u === 'page') return d > 1 && p >= d * END;
    return d > 1 && p + 1 >= d * END;
  }
  const mss = s => { s = Math.max(0, Math.floor(+s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
  function label(e) {
    if (!e) return '';
    const p = e.pos != null ? +e.pos : +e.p;
    switch (e.unit || e.u) {
      case 'time': return mss(p);
      case 'page': return `стр. ${Math.round(p)}`;
      case 'phrase': return `фраза ${Math.round(p) + 1}`;
      case 'step': return `шаг ${Math.round(p) + 1}`;
      default: return `карточка ${Math.round(p) + 1}`;
    }
  }
  const ago = at => {
    const d = now() - (+at || 0);
    if (!(at > 0) || d < 0) return '';
    if (d < 3600e3) return 'недавно';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (at >= +today) return 'сегодня';
    if (at >= +today - 86400e3) return 'вчера';
    try { return new Date(at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); } catch (e) { return ''; }
  };
  const esc = s => { try { return U.esc(s == null ? '' : String(s)); } catch (e) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); } };

  const Resume = {
    save(kind, id, pos, meta = {}) {
      try {
        if (id == null || id === '' || !isFinite(+pos)) return;
        load();
        const key = k(kind, id), had = all[key], old = had || {};
        const e = { p: Math.round(+pos * 10) / 10, u: meta.unit || old.u || 'time', d: +meta.total || +old.d || 0, t: str(meta.title != null ? meta.title : old.t, 120), at: now(), s: +old.s || +old.at || now() };
        if (had && isFinite(+old.p)) track(catOf(kind, e.u), e.u, +old.p, old.at, e.p);
        if (!meaningful(e)) {
          // ≥ 95 %: kept as «закончено» (not offered again); back at the very start: a finished one stays finished
          if (had && finished(e)) { all[key] = Object.assign(e, { f: 1 }); dirty = true; flushSoon(); return; }
          if (had && had.f) return;
          if (had) { delete all[key]; dirty = true; flushSoon(); }
          return;
        }
        all[key] = e; dirty = true; flushSoon();
      } catch (err) { /* a place is a convenience — never an error */ }
    },
    get(kind, id) {
      try {
        const e = load()[k(kind, id)];
        if (!meaningful(e)) return null;
        return { pos: +e.p, total: +e.d || 0, unit: e.u, title: e.t || '', at: +e.at || 0 };
      } catch (err) { return null; }
    },
    clear(kind, id) {
      try { load(); const key = k(kind, id); if (all[key]) { delete all[key]; dirty = true; flush(); } } catch (err) { /* ignore */ }
    },
    clearAll() {
      all = {}; dirty = false; clearTimeout(timer); timer = 0;
      noted.clear();
      try { localStorage.removeItem(KEY); localStorage.removeItem(LEGACY); OTHER_KEYS.forEach(x => localStorage.removeItem(x)); } catch (err) { /* ignore */ }
      try { document.dispatchEvent(new CustomEvent('resume-cleared')); } catch (err) { /* ignore */ }
    },
    count() {
      let n = 0;
      try { n = Object.values(load()).filter(meaningful).length; } catch (err) { n = 0; }
      try { const l = JSON.parse(localStorage.getItem('nk-listen-pos') || '{}'); n += Object.keys(l || {}).length; } catch (err) { /* ignore */ }
      return n;
    },
    entries() {
      const out = [];
      try {
        Object.entries(load()).forEach(([key, e]) => {
          if (!meaningful(e)) return;
          const i = key.indexOf('|');
          out.push({ kind: key.slice(0, i), id: key.slice(i + 1), pos: +e.p, total: +e.d || 0, unit: e.u, title: e.t || '', at: +e.at || 0 });
        });
      } catch (err) { /* nothing */ }
      return out.sort((a, b) => b.at - a.at);
    },
    history() {
      const out = [];
      try {
        Object.entries(load()).forEach(([key, e]) => {
          if (!e || !isFinite(+e.p)) return;
          const done = !!e.f;
          if (!done && !meaningful(e)) return;
          const i = key.indexOf('|');
          out.push({ kind: key.slice(0, i), id: key.slice(i + 1), pos: +e.p, total: +e.d || 0, unit: e.u, title: e.t || '', at: +e.at || 0, first: +e.s || +e.at || 0, done });
        });
      } catch (err) { /* nothing */ }
      return out.sort((a, b) => b.at - a.at);
    },
    raw(kind, id) { try { const e = load()[k(kind, id)]; return e ? Object.assign({}, e) : null; } catch (err) { return null; } },
    restore(kind, id, raw) {
      try { if (!raw || typeof raw !== 'object') return; load(); all[k(kind, id)] = Object.assign({}, raw); dirty = true; flush(); } catch (err) { /* ignore */ }
    },
    note(kind, id, pos, cat) {
      try {
        const key = k(kind, id), o = noted.get(key);
        if (o) track(cat || catOf(kind, ''), '', o.p, o.at, +pos);
        noted.set(key, { p: +pos, at: now() });
      } catch (err) { /* a convenience */ }
    },
    minutes(days = 7) {
      const r = { listen: 0, read: 0, other: 0 };
      try {
        const m = minsLoad(), from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - (days - 1));
        const f = dayKey(+from);
        Object.entries(m).forEach(([d, o]) => { if (d >= f && o) { r.listen += +o.l || 0; r.read += +o.r || 0; r.other += +o.o || 0; } });
      } catch (err) { /* nothing */ }
      r.listen = Math.round(r.listen / 60); r.read = Math.round(r.read / 60); r.other = Math.round(r.other / 60);
      return r;
    },
    prefer(kind, id, pos) { want = { key: k(kind, id), pos: pos == null ? null : +pos, until: now() + 10 * 60e3 }; },
    label,
    mss,
    /** the friendly choice; → the saved position, or null (from the start) */
    ask({ kind, id, title = '', posLabel = '', owner = null } = {}) {
      // «▶ Продолжить» / «Начать сначала» was already chosen on the home card → no second question
      if (want && want.key === k(kind, id)) {
        const w = want; want = null;
        if (now() < w.until) {
          if (w.pos == null) { this.clear(kind, id); return Promise.resolve(null); }
          return Promise.resolve(this.get(kind, id) ? w.pos : null);
        }
      }
      const e = this.get(kind, id);
      if (!e || !(window.UI && UI.modal)) return Promise.resolve(null);
      const where = posLabel || label(e);
      const of = e.unit === 'time' && e.total ? ` из ${mss(e.total)}` : e.unit === 'page' && e.total ? ` из ${e.total}` : '';
      const when = ago(e.at);
      const name = title || e.title || '';
      return new Promise(resolve => {
        let result = null;
        const m = UI.modal({
          title: '📍 Продолжить?', cls: 'narrow resume-ask',
          body: `${name ? `<p class="ra-name">${esc(name)}</p>` : ''}<p class="ra-line">Вы остановились на <b>${esc(where)}</b>${of}${when ? ` · ${when}` : ''}.</p>`,
          foot: `<button type="button" class="btn ghost" data-ra="start">Начать сначала</button><button type="button" class="btn primary" data-ra="cont">▶ Продолжить с места, где остановились (${esc(where)})</button>`,
          onClose: () => { clearInterval(watch); resolve(result); },
        });
        // the player / book window closed before an answer → the question goes with it (the place stays)
        const watch = owner ? setInterval(() => { if (!owner.isConnected) m.close(); }, 400) : 0;
        m.el.querySelector('.modal-foot').addEventListener('click', ev => {
          const b = ev.target.closest('[data-ra]'); if (!b) return;
          if (b.dataset.ra === 'cont') result = e.pos;
          else { result = null; Resume.clear(kind, id); }
          m.close();
        });
        setTimeout(() => { const c = m.$('[data-ra="cont"]'); if (c) c.focus(); }, 50);
      });
    },
    _flush: flush,
  };

  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);

  window.Resume = Resume;
})();
