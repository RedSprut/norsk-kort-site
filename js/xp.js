/* ============ ⭐ XP — light points for finished activities (this device only) ============
 * XP.add(kind, points, { key, label }) — once per key per day (key defaults to kind + today), returns the points added.
 *   kinds used now: 'phrase' (🌅 Фраза дня, 10), 'leveltest' (🎯 Тест уровня, 15), 'exam' (🧪 часть тренировки, 5–20).
 * XP.total() · XP.today() · XP.week() · XP.streak() (the app's own streak: Store.streakDays(), days with answers,
 *   plus days with XP here — one streak, not a second one) · XP.badgeHtml() · XP.open() — a small window with the log.
 * Storage: localStorage 'nk-xp' { total, days: { 'YYYY-MM-DD': n }, done: { key: 1 }, log: [{ t, kind, n, label }] (last 60) }.
 * Event: window 'nk-xp' { detail: { added, total } } — a home tile can redraw itself.
 */
(function () {
  'use strict';
  const KEY = 'nk-xp';
  const dayKey = (t) => { const d = new Date(t == null ? Date.now() : t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function st() {
    let o = null;
    try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { o = null; }
    if (!o || typeof o !== 'object' || Array.isArray(o)) o = {};
    if (!o.days || typeof o.days !== 'object') o.days = {};
    if (!o.done || typeof o.done !== 'object') o.done = {};
    if (!Array.isArray(o.log)) o.log = [];
    o.total = Math.max(0, +o.total || 0);
    return o;
  }
  function save(o) {
    // keep it small: «done» marks older than 40 days are not needed any more
    const old = dayKey(Date.now() - 40 * 864e5);
    Object.keys(o.done).forEach(k => { const d = k.slice(0, 10); if (/^\d{4}-\d\d-\d\d$/.test(d) && d < old) delete o.done[k]; });
    o.log = o.log.slice(-60);
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* private mode: points for this visit only */ }
  }
  const plural = (n, f) => (window.U && U.plural ? U.plural(n, f) : f[n % 10 === 1 && n % 100 !== 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2]);

  const XP = {
    add(kind, points, o = {}) {
      const n = Math.max(0, Math.min(100, Math.round(+points || 0)));
      if (!n) return 0;
      const s = st(), today = dayKey();
      const k = `${today}|${o.key || kind}`;
      if (s.done[k]) return 0;
      s.done[k] = 1;
      s.total += n;
      s.days[today] = (s.days[today] || 0) + n;
      s.log.push({ t: Date.now(), kind: String(kind).slice(0, 20), n, label: String(o.label || '').slice(0, 80) });
      save(s);
      try { window.dispatchEvent(new CustomEvent('nk-xp', { detail: { added: n, total: s.total } })); } catch (e) { /* old browser */ }
      if (o.toast !== false && window.UI && UI.toast) UI.toast(`⭐ +${n} XP${o.label ? ' · ' + o.label : ''}`, 'good', 2200);
      return n;
    },
    /** was this activity already counted today? */
    doneToday(kind, key) { return !!st().done[`${dayKey()}|${key || kind}`]; },
    total() { return st().total; },
    today() { return st().days[dayKey()] || 0; },
    week() { const s = st(); let n = 0; for (let i = 0; i < 7; i++) n += s.days[dayKey(Date.now() - i * 864e5)] || 0; return n; },
    /** the app's streak (answers in study), extended by days with XP — so a day of «Фраза дня» counts too */
    streak() {
      const s = st();
      let base = 0;
      try { base = window.Store && Store.streakDays ? Store.streakDays() : 0; } catch (e) { base = 0; }
      // days in a row with XP, ending today or yesterday
      let n = 0, t = Date.now();
      if (!s.days[dayKey(t)]) t -= 864e5;
      while (s.days[dayKey(t)] && n < 3660) { n++; t -= 864e5; }
      return Math.max(base, n);
    },
    badgeHtml() {
      const d = this.streak();
      return `<span class="xp-badge" title="Очки за пройденные занятия — только на этом устройстве"><span aria-hidden="true">⭐</span> ${this.total()} XP${d ? ` · <span aria-hidden="true">🔥</span> ${d} ${plural(d, ['день', 'дня', 'дней'])}` : ''}</span>`;
    },
    open() {
      if (!window.UI || !UI.modal) return;
      const s = st();
      const names = { phrase: '🌅 Фраза дня', leveltest: '🎯 Тест уровня', exam: '🧪 Тренировка экзамена' };
      const rows = s.log.slice().reverse().slice(0, 20).map(x => `<li><span>${esc(names[x.kind] || x.kind)}${x.label ? ` · ${esc(x.label)}` : ''}</span><small>${esc(new Date(x.t).toLocaleDateString('ru-RU'))}</small><b>+${x.n}</b></li>`).join('');
      UI.modal({
        title: '⭐ Мои очки', cls: 'narrow xp-modal',
        body: `<div class="xp-sum"><div><b>${s.total}</b><small>всего</small></div><div><b>${this.today()}</b><small>сегодня</small></div><div><b>${this.week()}</b><small>за 7 дней</small></div><div><b>${this.streak()}</b><small>${plural(this.streak(), ['день', 'дня', 'дней'])} подряд</small></div></div>
          <p class="small muted">Очки начисляются за законченные занятия: фраза дня, тест уровня, части тренировки экзамена. Это просто для радости — они хранятся только на этом устройстве.</p>
          ${rows ? `<ul class="xp-log">${rows}</ul>` : '<p class="small">Пока пусто — начните с «🌅 Фразы дня».</p>'}`,
      });
      if (!document.getElementById('xp-css')) {
        const st2 = document.createElement('style'); st2.id = 'xp-css';
        st2.textContent = '.xp-sum{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}.xp-sum div{background:var(--panel2,rgba(127,127,127,.1));border-radius:12px;padding:10px 6px;text-align:center}.xp-sum b{display:block;font-size:1.35rem}.xp-sum small{opacity:.75}.xp-log{list-style:none;margin:8px 0 0;padding:0}.xp-log li{display:flex;gap:8px;align-items:baseline;padding:6px 0;border-bottom:1px solid rgba(127,127,127,.18)}.xp-log li span{flex:1}.xp-log small{opacity:.7}.xp-badge{white-space:nowrap}';
        document.head.appendChild(st2);
      }
    },
    _dayKey: dayKey, _st: st,
  };
  window.XP = XP;
})();
