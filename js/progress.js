/* ============ 🎯 Progress: knowledge %, daily goal, streak (with rest days & vacation), charts, heatmap ============
 * Knowledge % = how surely your cards sit in long-term memory today: the FSRS probability to remember each card now
 * (a card counts by its better direction; new cards = 0). The history is rebuilt by replaying your answers.
 */
(function () {
  const DAY = 864e5;
  const st = () => Store.settings;
  const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  const jsDay = i => (i + 1) % 7; // our index 0 = Monday -> JS getDay()

  /** knowledge of one SRS record at time t (0..1) */
  const rOf = (s, t) => (s && s.reps && s.stability) ? FSRS.retrievability((t - (s.lastReview || t)) / DAY, s.stability) : 0;

  const Progress = {
    knowledgeNow() {
      const cards = Store.cards();
      if (!cards.length) return 0;
      const now = Date.now();
      const sum = cards.reduce((a, c) => a + Math.max(rOf(c.srs.nr, now), rOf(c.srs.rn, now)), 0);
      return Math.round(sum / cards.length * 100);
    },
    /** daily points [{t, v}] for knowledge % (replayed from the answer log) and card count */
    series(maxPoints = 140) {
      const log = Store.state.log.slice().sort((a, b) => a.ts - b.ts);
      const cards = Store.cards();
      const created = cards.map(c => c.created || Date.now()).sort((a, b) => a - b);
      const first = Math.min(created[0] || Date.now(), (log[0] || {}).ts || Date.now());
      const start = U.startOfDay(first), end = U.startOfDay() + DAY;
      const step = Math.max(DAY, Math.ceil((end - start) / maxPoints / DAY) * DAY);
      const createdAt = new Map(cards.map(c => [c.id, c.created || first]));
      const state = new Map(); // id|dir -> replayed srs
      const ret = st().retention || 0.9;
      const know = [], count = [];
      let li = 0, ci = 0;
      for (let t = start; t <= end; t += step) {
        while (li < log.length && log[li].ts < t) {
          const l = log[li++];
          const k = l.c + '|' + l.d;
          state.set(k, FSRS.review(state.get(k), l.g, { now: l.ts, retention: ret }));
        }
        while (ci < created.length && created[ci] < t) ci++;
        let sum = 0, n = 0;
        createdAt.forEach((ct, id) => { if (ct < t) { n++; sum += Math.max(rOf(state.get(id + '|nr'), t), rOf(state.get(id + '|rn'), t)); } });
        know.push({ t, v: n ? sum / n * 100 : 0 });
        count.push({ t, v: ci });
      }
      if (know.length) { know[know.length - 1] = { t: Date.now(), v: this.knowledgeNow() }; count[count.length - 1] = { t: Date.now(), v: cards.length }; }
      return { know, count };
    },
    /** SVG line + area chart */
    lineSvg(points, { fmt = v => Math.round(v), max: forcedMax } = {}) {
      if (points.length < 2) return '<div class="small muted">Мало данных — график появится после нескольких дней занятий.</div>';
      const W = 1000, H = 230, L = 52, B = 26, T = 10;
      const maxV = forcedMax || Math.max(1, ...points.map(p => p.v)) * 1.08;
      const t0 = points[0].t, t1 = points[points.length - 1].t;
      const x = t => L + (t - t0) / Math.max(1, t1 - t0) * (W - L - 8);
      const y = v => T + (1 - v / maxV) * (H - T - B);
      const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
      // 0 / middle / top; the middle label is dropped when it would repeat a neighbour ("1%, 1%, 0%")
      const lbls = [0, 0.5, 1].map(f => String(fmt(maxV / 1.08 * f)));
      const grid = [0, 0.5, 1].map((f, i) => `<line x1="${L}" x2="${W}" y1="${y(maxV / 1.08 * f)}" y2="${y(maxV / 1.08 * f)}" class="ch-grid"/>${i === 1 && (lbls[1] === lbls[0] || lbls[1] === lbls[2]) ? '' : `<text x="${L - 8}" y="${y(maxV / 1.08 * f) + 4}" class="ch-lbl" text-anchor="end">${lbls[i]}</text>`}`).join('');
      // x labels: years if long, months otherwise
      const labels = [];
      const long = t1 - t0 > 300 * DAY;
      const dt = new Date(t0); dt.setDate(1); dt.setHours(0, 0, 0, 0);
      for (let k = 0; k < 60; k++) {
        if (long) { dt.setMonth(0); dt.setFullYear(dt.getFullYear() + (k ? 1 : 1)); } else dt.setMonth(dt.getMonth() + 1);
        if (dt.getTime() > t1) break;
        if (dt.getTime() > t0) labels.push(`<text x="${x(dt.getTime())}" y="${H - 6}" class="ch-lbl" text-anchor="middle">${long ? dt.getFullYear() : dt.toLocaleDateString('ru-RU', { month: 'short' })}</text>`);
      }
      const last = points[points.length - 1];
      return `<svg class="ch" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img">
        <defs><linearGradient id="chg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#7c6cff" stop-opacity=".35"/><stop offset="1" stop-color="#7c6cff" stop-opacity="0"/></linearGradient></defs>
        ${grid}${labels.join('')}
        <path d="${d}L${x(last.t)},${y(0)}L${x(points[0].t)},${y(0)}Z" fill="url(#chg)"/>
        <path d="${d}" class="ch-line" vector-effect="non-scaling-stroke"/>
        <circle cx="${x(last.t)}" cy="${y(last.v)}" r="5" class="ch-dot"/></svg>`;
    },
    /** GitHub-style calendar: 26 weeks, Monday first, today outlined */
    heatmapHtml(weeks = 26) {
      const log = Store.state.log;
      const byDay = {};
      log.forEach(l => { const k = U.dayKey(l.ts); byDay[k] = (byDay[k] || 0) + 1; });
      const today = U.startOfDay();
      const dow = (new Date(today).getDay() + 6) % 7; // 0 = Monday
      const start = today - (weeks * 7 - 1 - (6 - dow)) * DAY;
      const vals = Object.values(byDay);
      const record = vals.length ? Math.max(...vals) : 0;
      const lvl = n => !n ? 0 : n < record * 0.25 ? 1 : n < record * 0.5 ? 2 : n < record * 0.8 ? 3 : 4;
      const cols = [];
      let months = '';
      for (let w = 0; w < weeks; w++) {
        let col = '';
        for (let d = 0; d < 7; d++) {
          const t = start + (w * 7 + d) * DAY;
          if (t > today) { col += '<i class="hm-c hm-f"></i>'; continue; }
          const n = byDay[U.dayKey(t)] || 0;
          col += `<i class="hm-c hm-${lvl(n)} ${t === today ? 'hm-today' : ''}" title="${U.fmtDate(t)}: ${n} ${U.plural(n, ['повторение', 'повторения', 'повторений'])}"></i>`;
        }
        cols.push(`<div class="hm-col">${col}</div>`);
        const first = new Date(start + w * 7 * DAY);
        if (first.getDate() <= 7) months += `<span style="grid-column:${w + 1}">${first.toLocaleDateString('ru-RU', { month: 'short' })}</span>`;
      }
      const todayN = byDay[U.dayKey(today)] || 0;
      const active = Object.keys(byDay).length;
      const avg = active ? Math.round(log.length / Math.max(1, Math.ceil((today - U.startOfDay((log[0] || {}).ts || today)) / DAY) + 1)) : 0;
      return `<div class="hm-stats">Сегодня: <b>${todayN}</b> · Ср/день: <b>${avg}</b> · Рекорд: <b>${record}</b> · Серия: <b>${Store.streakDays()} д</b></div>
        <div class="hm-wrap"><div class="hm-wd"><span>пн</span><span></span><span>ср</span><span></span><span>пт</span><span></span><span></span></div>
          <div><div class="hm-months" style="grid-template-columns:repeat(${weeks}, 1fr)">${months}</div><div class="hm-grid">${cols.join('')}</div></div></div>
        <div class="hm-legend">Меньше <i class="hm-c hm-0"></i><i class="hm-c hm-1"></i><i class="hm-c hm-2"></i><i class="hm-c hm-3"></i><i class="hm-c hm-4"></i> Больше</div>`;
    },
    /** the three Space-style cards for the statistics page */
    statsCardsHtml() {
      const { know, count } = this.series();
      const k = this.knowledgeNow();
      return `<div class="panel pg-card"><div class="pg-head"><h3>🧠 ${k}% Знание</h3><button class="icon-btn sm" data-act="pg-info" title="Что это?">ⓘ</button></div>${this.lineSvg(know, { fmt: v => (v > 0 && v < 10 ? v.toFixed(1).replace('.0', '') : Math.round(v)) + '%' })}</div>
        <div class="panel pg-card"><div class="pg-head"><h3>🃏 ${Store.cards().length} Карточки</h3></div>${this.lineSvg(count, { fmt: v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v) })}</div>
        <div class="panel pg-card"><div class="pg-head"><h3>🔁 ${Store.state.log.length} Повторения</h3></div>${this.heatmapHtml()}</div>`;
    },
    infoDialog() {
      UI.modal({
        title: '🧠 Знание', cls: 'narrow',
        body: `<p>Показывает, насколько надёжно ваши карточки закреплены в долговременной памяти <b>прямо сейчас</b>: для каждой карточки алгоритм FSRS считает вероятность вспомнить её сегодня, и мы берём среднее (новые карточки — 0%).</p>
          <p>Растёт с каждым правильным ответом и медленно снижается без повторения — поэтому график иногда плавно идёт вниз, пока вы не занимаетесь.</p>`,
      });
    },

    /* ---------- 🎯 daily goal ---------- */
    todayCount() { const s = U.startOfDay(); let n = 0; const l = Store.state.log; for (let i = l.length - 1; i >= 0 && l[i].ts >= s; i--) n++; return n; },
    goalTileHtml() {
      if (st().goalOn === false) return '';
      const goal = st().goal || 20, done = this.todayCount(), left = Math.max(0, goal - done);
      const pct = Math.min(100, Math.round(done / goal * 100));
      return `<button class="goal-tile ${left ? '' : 'done'}" data-act="goal-go">
        <div class="goal-top"><b>${left ? `Ещё ${left} ${U.plural(left, ['карточка', 'карточки', 'карточек'])}` : 'Цель на сегодня выполнена 🎉'}</b><span>›</span></div>
        <small>${left ? 'Продолжить учиться' : 'Можно повторить ещё — серия засчитана'}</small>
        <div class="goal-bar"><i style="width:${pct}%"></i></div><span class="goal-num">${Math.min(done, goal)}/${goal}</span></button>`;
    },
    streakTileHtml() {
      const n = Store.streakDays();
      const today = U.startOfDay();
      const dow = (new Date(today).getDay() + 6) % 7;
      const days = new Set(Store.state.log.map(l => U.dayKey(l.ts)));
      const rest = new Set(st().restDays || []);
      const dots = WD.map((w, i) => {
        const t = today - (dow - i) * DAY;
        const did = days.has(U.dayKey(t)), future = t > today, isRest = rest.has(jsDay(i)) || Store.onVacation(t);
        return `<div class="sk-day ${i === dow ? 'today' : ''}"><small>${w}</small><i class="${did ? 'on' : future ? 'fut' : isRest ? 'rest' : ''}" title="${isRest && !did ? 'день отдыха' : ''}">${did ? '🔥' : isRest ? '🌙' : ''}</i></div>`;
      }).join('');
      return `<div class="streak-tile"><div class="sk-n"><b>${n}</b><small>${U.plural(n, ['день', 'дня', 'дней'])}</small></div><div class="sk-week">${dots}</div>
        ${Store.onVacation(Date.now()) ? '<div class="small muted">🏖 Режим отпуска — серия заморожена</div>' : ''}</div>`;
    },
    goalSettingsHtml() {
      const s = st();
      const goal = s.goal || 20;
      return `<div class="setting"><div><div>Дневная цель включена</div><div class="desc">Сколько карточек повторять каждый день</div></div><div class="ctl">${UI.switchHtml('goalOn', s.goalOn !== false)}</div></div>
        <div class="goal-set"><b data-goal-lbl>${goal} ${U.plural(goal, ['карточка', 'карточки', 'карточек'])} в день</b>
          <div class="row" style="gap:10px;align-items:center;flex-wrap:nowrap"><button class="icon-btn" data-act="goal-minus">−</button><input type="range" min="5" max="200" step="5" value="${goal}" data-num="goal" class="grow"><button class="icon-btn" data-act="goal-plus">+</button></div>
          <div class="row" style="gap:6px"><span class="small muted">Часто выбирают:</span>${[5, 10, 20, 50, 100].map(v => `<button class="chip ${v === goal ? 'active' : ''}" data-act="goal-set" data-v="${v}">${v}</button>`).join('')}</div></div>`;
    },
    scheduleHtml() {
      const s = st();
      const rest = new Set(s.restDays || []);
      const v = s.vacation;
      return `<div class="small muted">Дни отдыха — серия в эти дни не прерывается.</div>
        <div class="rest-days">${WD.map((w, i) => `<button class="rest-day ${rest.has(jsDay(i)) ? 'on' : ''}" data-act="rest-day" data-d="${jsDay(i)}">${w.toUpperCase()}</button>`).join('')}</div>
        <div class="small muted" style="margin-top:10px">Режим отпуска — серия заморожена, а повторения не копятся в «долг» к возвращению.</div>
        ${v && v.to >= U.startOfDay() ? `<div class="row" style="gap:8px;align-items:center">🏖 <b>${U.fmtDate(v.from)} — ${U.fmtDate(v.to)}</b><button class="btn sm ghost" data-act="vac-off">Закончить отпуск</button></div>`
          : `<div class="row" style="gap:6px"><button class="btn sm" data-act="vac" data-days="7">1 неделя</button><button class="btn sm" data-act="vac" data-days="14">2 недели</button>
            <span class="small muted">или 📅 до даты:</span><input type="date" class="input" data-vac-to style="max-width:170px" min="${U.dayKey()}" title="отпуск с сегодня по это число"></div>`}`;
    },
    /** settings clicks (returns true if handled) */
    settingsClick(a, rerender) {
      const s = st();
      switch (a.dataset.act) {
        case 'goal-set': Store.setSetting('goal', +a.dataset.v); rerender(); return true;
        case 'goal-minus': Store.setSetting('goal', Math.max(5, (s.goal || 20) - 5)); rerender(); return true;
        case 'goal-plus': Store.setSetting('goal', Math.min(200, (s.goal || 20) + 5)); rerender(); return true;
        case 'rest-day': {
          const set = new Set(s.restDays || []); const d = +a.dataset.d;
          if (set.has(d)) set.delete(d); else set.add(d);
          if (set.size > 5) { UI.toast('Оставьте хотя бы 2 учебных дня в неделе', 'warn'); return true; }
          Store.setSetting('restDays', [...set]); rerender(); return true;
        }
        case 'vac': this.startVacation(Date.now(), Date.now() + (+a.dataset.days - 1) * DAY); rerender(); return true;
        case 'vac-off': this.endVacation(); rerender(); return true;
      }
      return false;
    },
    startVacation(from, to) {
      Store.setSetting('vacation', { from: U.startOfDay(from), to: U.startOfDay(to), t: Date.now() });
      UI.toast(`🏖 Отпуск до ${U.fmtDate(to)} — серия заморожена`, 'good', 4000);
    },
    /** back from vacation: what became due during it is spread over the next days instead of one big pile */
    endVacation() {
      const v = st().vacation;
      Store.setSetting('vacation', null);
      if (!v) return;
      const spread = Math.max(3, Math.round((Date.now() - v.from) / DAY / 2));
      const now = Date.now();
      const due = [];
      Store.cards().forEach(c => ['nr', 'rn'].forEach(d => { const s = c.srs[d]; if (s && s.reps && s.due < now && s.due >= v.from) due.push(s); }));
      due.sort((a, b) => a.due - b.due).forEach((s, i) => { s.due = U.startOfDay() + Math.floor(i / Math.max(1, Math.ceil(due.length / spread))) * DAY + 3600e3; });
      Store.save();
      UI.toast(due.length ? `С возвращением! ${due.length} повторений распределены на ${spread} дн.` : 'С возвращением!', 'good', 4500);
    },
    /** called on start: a vacation that has ended is closed automatically */
    checkVacation() {
      const v = st().vacation;
      if (v && U.startOfDay() > v.to) this.endVacation();
    },
  };

  window.Progress = Progress;
})();
