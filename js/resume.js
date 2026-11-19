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
 * Live broadcasts never call it (they go on without us). Old places of the subtitle player ('nk-subs-pos') move here once.
 */
(function () {
  const KEY = 'nk-resume', LEGACY = 'nk-subs-pos';
  const MAX = 150;            // the most recent places (LRU)
  const MAX_CHARS = 60000;    // the whole store stays small
  const MIN_SEC = 5, END = 0.95;
  // other places this app keeps (cleared by «Забыть все места продолжения» too)
  const OTHER_KEYS = ['nk-listen-pos'];

  let all = null, dirty = false, timer = 0;
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
    const keys = Object.keys(all).filter(x => all[x] && typeof all[x] === 'object');
    keys.sort((a, b) => (+all[b].at || 0) - (+all[a].at || 0));
    keys.slice(MAX).forEach(x => delete all[x]);
    let s = JSON.stringify(all);
    while (s.length > MAX_CHARS && Object.keys(all).length) {
      const old = Object.keys(all).sort((a, b) => (+all[a].at || 0) - (+all[b].at || 0)).slice(0, 10);
      old.forEach(x => delete all[x]);
      s = JSON.stringify(all);
    }
    return s;
  }
  function flush() {
    clearTimeout(timer); timer = 0;
    if (!dirty || !all) return;
    dirty = false;
    try { localStorage.setItem(KEY, trim()); } catch (e) { /* full / private mode — kept for this visit */ }
  }
  function flushSoon() { if (!timer) timer = setTimeout(flush, 2000); }

  /** a place worth coming back to? (not at the very start, not at the end) */
  function meaningful(e) {
    if (!e || !isFinite(+e.p)) return false;
    const p = +e.p, d = +e.d || 0;
    if (e.u === 'time') { if (p < MIN_SEC) return false; if (d > 0 && (p >= d * END || d - p < 3)) return false; return true; }
    if (e.u === 'page') { if (p <= 1) return false; if (d > 1 && p >= d * END) return false; return true; }
    // 0-based item (card / phrase / step)
    if (p <= 0) return false;
    if (d > 1 && p + 1 >= d * END) return false;
    return true;
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
        const key = k(kind, id), old = all[key] || {};
        const e = { p: Math.round(+pos * 10) / 10, u: meta.unit || old.u || 'time', d: +meta.total || +old.d || 0, t: str(meta.title != null ? meta.title : old.t, 120), at: now() };
        if (!meaningful(e)) { if (all[key]) { delete all[key]; dirty = true; flushSoon(); } return; }
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
      try { localStorage.removeItem(KEY); localStorage.removeItem(LEGACY); OTHER_KEYS.forEach(x => localStorage.removeItem(x)); } catch (err) { /* ignore */ }
      try { document.dispatchEvent(new CustomEvent('resume-cleared')); } catch (err) { /* ignore */ }
    },
    count() {
      let n = 0;
      try { n = Object.values(load()).filter(meaningful).length; } catch (err) { n = 0; }
      try { const l = JSON.parse(localStorage.getItem('nk-listen-pos') || '{}'); n += Object.keys(l || {}).length; } catch (err) { /* ignore */ }
      return n;
    },
    label,
    mss,
    /** the friendly choice; → the saved position, or null (from the start) */
    ask({ kind, id, title = '', posLabel = '', owner = null } = {}) {
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
