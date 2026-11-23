/* ============ ▶ «Продолжить» — the place you stopped, at the very top of home (js/continue.js) ============
 * One card above «Сегодня: N карточек»: the most recent unfinished thing — a video / programme / podcast / Telegram
 * video or own video (js/resume.js, kind 'media'), a book from «Книги» ('book') or the reader (Reader.recent), a role
 * dialogue ('dialog'), an audio course (AudioCourse.inProgress), a listening queue (ListenX.lastResume) and the live
 * radio / TV that was playing («Слушать дальше» — a broadcast has no place to seek).
 *   «▶ Продолжить»   opens exactly there: the player's own «Продолжить?» answers by itself (Resume.prefer).
 *   «Начать сначала» forgets the place and opens it from the start.
 *   «✕»              hides this one from HOME only (it comes back by itself when you go on with it later); it stays in
 *                    «📈 Мой прогресс» (js/mypath.js, #/progress).
 *   «Всё незаконченное →» — that page (without it: «Ещё N незаконченных» — the list in a window, Mobile.sheet).
 * «Потом» on that page snoozes an item for 7 days ('nk-cont-later': key → until) — not on the home card till then;
 * «Забыть» removes the place of js/resume.js (others: 'nk-cont-forgot' key → at, until it is opened again).
 * Older than 14 days (a broadcast: 3 days) or ≥ 95 % → not shown. A study session is not kept between visits
 * (js/study.js), so there is nothing of it to continue here.
 * How a stream is opened again is learnt when it opens (Subs.openStream / NrkRadio.play are wrapped — nothing in those
 * files changes): localStorage 'nk-cont-open'; hidden ones: 'nk-cont-hide'.
 *   window.Continue = { items(), all(), html(), sheet(), run(key, how), snooze(key, days), unsnooze(key), forget(item) → undo,
 *                       unhide(key) }
 */
(function () {
  'use strict';
  const OPEN_KEY = 'nk-cont-open', HIDE_KEY = 'nk-cont-hide';
  const DAY = 864e5, DAYS = 14, LIVE_DAYS = 3, MAX_OPEN = 60;
  const esc = s => (window.U && U.esc ? U.esc(s == null ? '' : String(s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
  const str = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
  const ls = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v && typeof v === 'object' && !Array.isArray(v) ? v : d; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* full / private mode */ } };
  const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const mss = s => (window.Resume && Resume.mss ? Resume.mss(s) : String(Math.floor(s / 60)) + ':' + String(Math.floor(s % 60)).padStart(2, '0'));
  const pl = (n, f) => (window.U && U.plural ? U.plural(n, f) : f[2]);
  /** an https picture or our own (bridge) address only */
  const safeImg = u => { u = String(u || ''); return /^https:\/\/[^\s"'<>]+$/i.test(u) || /^\/api\/[^\s"'<>]+$/.test(u) ? u.slice(0, 1000) : ''; };

  /* ---------------- how a stream opens again (learnt when it opens) ---------------- */
  let lastRadio = null;
  function remember(src) {
    if (!src || src.id == null || src.companion) return;
    const pre = src.kind === 'youtube' ? 'yt:' : src.kind === 'tg' ? 'tg:' : src.radio ? 'nrkr:' : 'nrk:';
    const mid = pre + src.id + '|0';
    const how = src.kind === 'youtube' ? 'yt' : src.kind === 'tg' ? 'tg' : src.radio ? (src.live ? 'radio-live' : 'radio') : (src.live ? 'tv-live' : 'nrk');
    const e = { how, id: String(src.id), title: str(src.title, 140), sub: str(src.channel, 100), at: Date.now(),
      img: safeImg(src.poster || (how === 'yt' ? `https://i.ytimg.com/vi/${encodeURIComponent(src.id)}/mqdefault.jpg` : '')) };
    if (/^radio/.test(how) && lastRadio && String(lastRadio.id) === String(src.id) && Date.now() - lastRadio.t < 60e3) {
      const o = lastRadio.o; e.ro = { kind: o.kind || '', id: o.id, title: str(o.title, 140), sub: str(o.sub, 100), img: safeImg(o.img) };
      if (!e.img) e.img = e.ro.img;
    }
    if (how === 'tg') e.tg = { video: src.video || '', pcm: src.pcm || '', poster: src.poster || '', duration: +src.duration || 0, link: str(src.link, 300), author: str(src.author, 80), date: src.date || '' };
    if (src.live) e.live = 1;
    const all = ls(OPEN_KEY, {});
    const old = all[mid];
    if (old && old.ok) e.ok = old.ok;
    all[mid] = e;
    Object.keys(all).sort((a, b) => (all[b].at || 0) - (all[a].at || 0)).slice(MAX_OPEN).forEach(k => delete all[k]);
    put(OPEN_KEY, all);
    // a broadcast counts as «unfinished» only after it really played a little (not a quick look at the channel)
    if (src.live) setTimeout(() => {
      const m = document.querySelector('#modal-root .subs-live');
      const v = m && m.querySelector('[data-media]');
      if (!m || !v || v.paused) return;
      const a2 = ls(OPEN_KEY, {}); if (a2[mid]) { a2[mid].ok = Date.now(); a2[mid].at = Date.now(); put(OPEN_KEY, a2); refreshSoon(); }
    }, 25000);
  }
  function wrap() {
    if (window.Subs && Subs.openStream && !Subs.openStream._cont) {
      const orig = Subs.openStream;
      Subs.openStream = function (src) { try { remember(src); } catch (e) { /* a convenience — never an error */ } return orig.apply(this, arguments); };
      Subs.openStream._cont = true;
    }
    if (window.NrkRadio && NrkRadio.play && !NrkRadio.play._cont) {
      const orig = NrkRadio.play;
      NrkRadio.play = function (o) { try { if (o && o.id != null) lastRadio = { id: o.id, o, t: Date.now() }; } catch (e) { /* ignore */ } return orig.apply(this, arguments); };
      NrkRadio.play._cont = true;
    }
  }

  /* ---------------- hidden («✕») ---------------- */
  const hidden = () => ls(HIDE_KEY, {});
  function hide(key, at) {
    const o = hidden(); o[key] = Math.max(Date.now(), +at || 0);
    const keep = Object.keys(o).sort((a, b) => o[b] - o[a]).slice(0, 80);
    put(HIDE_KEY, Object.fromEntries(keep.map(k => [k, o[k]])));
  }

  /* ---------------- words ---------------- */
  function ago(at) {
    const d = Date.now() - (+at || 0);
    if (!(at > 0) || d < 0) return '';
    if (d < 3600e3) return 'недавно';
    const t = new Date(); t.setHours(0, 0, 0, 0);
    if (at >= +t) return 'сегодня';
    if (at >= +t - DAY) return 'вчера';
    try { return new Date(at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }); } catch (e) { return ''; }
  }
  const SVG = {
    play: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/></svg>',
    restart: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
  };

  /* ---------------- open helpers ---------------- */
  const later = f => setTimeout(() => { try { f(); } catch (e) { console.warn('continue', e); UI.toast('Не получилось открыть — попробуйте ещё раз', 'warn'); } }, 30);
  const need = (o, what) => { if (!o) { UI.toast(`${what} сейчас недоступно — попробуйте обновить страницу`, 'warn'); return false; } return true; };
  /** the reader asks «Продолжить?» itself; «Начать сначала» here already is the answer (one question, not two) */
  function answerReaderOnce(v) {
    if (!(window.UI && UI.choose) || UI.choose._cont) return;
    const orig = UI.choose;
    const f = function (title, body) {
      if (/Вы остановились/.test(String(body || ''))) { restore(); return Promise.resolve(v); }
      return orig.apply(this, arguments);
    };
    f._cont = true;
    const restore = () => { if (UI.choose === f) UI.choose = orig; clearTimeout(t); };
    const t = setTimeout(restore, 15000);
    UI.choose = f;
  }
  const listenForget = key => { try { const a = JSON.parse(localStorage.getItem('nk-listen-pos') || '{}') || {}; delete a[key]; localStorage.setItem('nk-listen-pos', JSON.stringify(a)); } catch (e) { /* ignore */ } };

  /* ---------------- everything unfinished ---------------- */
  // every item: { key, at, title, sub, kind, ico, img, verb, where, pct, go, restart } and for «📈 Мой прогресс» (js/mypath.js):
  //   grp ('video' | 'audio' | 'book' | 'course' | 'dialog' | 'listen'), word («просмотрено»…), line (a short human line),
  //   done (≥ 95 %), first (when it was started), res ({ kind, id } — the place of js/resume.js)
  const pctOf = (p, d) => (d > 0 ? Math.max(0, Math.min(1, p / d)) : null);
  function mediaItem(e, open) {
    const m = /^(yt|nrk|nrkr|tg):(.+)\|0$/.exec(e.id);
    const r = open[e.id] || null;
    const title = e.title || (r && r.title) || '';
    const where = e.done ? 'Досмотрено до конца' : `Остановились на ${mss(e.pos)}${e.total ? ` из ${mss(e.total)}` : ''}`;
    const left = e.total && !e.done ? Math.max(0, Math.round((e.total - e.pos) / 60)) : 0;
    const base = { key: 'media:' + e.id, at: e.at, first: e.first, done: !!e.done, res: { kind: 'media', id: e.id }, title, where, pct: e.done ? 1 : pctOf(e.pos, e.total), verb: 'Продолжить просмотр',
      grp: 'video', word: 'просмотрено', line: e.done ? 'Досмотрено до конца' : `Остановились на ${mss(e.pos)}${left ? ` · осталось ${left} мин` : ''}` };
    const prefer = p => Resume.prefer('media', e.id, p);
    if (!m) { // 🎬 own file: the browser needs the same file again
      const name = e.id.split('|')[0];
      return Object.assign(base, { title: title || name, kind: 'Своё видео', ico: '🎬',
        go: () => { prefer(e.pos); if (!need(window.Subs, 'Плеер')) return; Subs.open(); UI.toast(`Выберите тот же файл «${name}» — продолжу с ${mss(e.pos)}`, '', 7000); },
        restart: () => { Resume.clear('media', e.id); if (!need(window.Subs, 'Плеер')) return; Subs.open(); UI.toast(`Выберите файл «${name}» — начнём сначала`, '', 6000); } });
    }
    const [, pre, sid] = m;
    const sub = r && r.sub ? r.sub : '';
    if (pre === 'yt') return Object.assign(base, { kind: 'YouTube', ico: window.YouTube && YouTube.YT_SVG ? YouTube.YT_SVG(30) : '▶️', img: (r && r.img) || `https://i.ytimg.com/vi/${encodeURIComponent(sid)}/mqdefault.jpg`, sub,
      go: () => { prefer(e.pos); if (need(window.YouTube, 'YouTube')) YouTube.watch(sid, title, sub === 'YouTube' ? '' : sub); },
      restart: () => { prefer(null); if (need(window.YouTube, 'YouTube')) YouTube.watch(sid, title, ''); } });
    if (pre === 'nrk') return Object.assign(base, { kind: 'NRK TV', ico: '📺', img: r && r.img, sub,
      go: () => { prefer(e.pos); if (need(window.NrkTV, 'NRK TV')) NrkTV.watch(sid, title, sub && sub !== 'NRK TV' ? sub : ''); },
      restart: () => { prefer(null); if (need(window.NrkTV, 'NRK TV')) NrkTV.watch(sid, title, sub && sub !== 'NRK TV' ? sub : ''); } });
    if (pre === 'nrkr') {
      const ro = r && r.ro;
      const open1 = p => { prefer(p); if (!need(window.NrkRadio, 'Радио')) return; if (ro) NrkRadio.play(ro); else { NrkRadio.open(); UI.toast(`Найдите «${title}» — продолжу с ${mss(e.pos)}`, '', 7000); } };
      return Object.assign(base, { kind: 'NRK Радио', ico: '📻', img: r && r.img, sub, verb: 'Продолжить прослушивание', grp: 'audio', word: 'прослушано',
        where: e.done ? 'Дослушано до конца' : base.where, line: e.done ? 'Дослушано до конца' : base.line, go: () => open1(e.pos), restart: () => open1(null) });
    }
    // ✈️ Telegram video: the same stream through the bridge
    const tg = r && r.tg;
    const openTg = p => {
      prefer(p);
      if (tg && tg.video && window.Subs) {
        Subs.openStream({ kind: 'tg', id: sid, title, channel: sub, author: tg.author, date: tg.date, link: tg.link, at: tg.link ? t => `${tg.link}?t=${Math.floor(t)}` : null,
          video: tg.video, pcm: tg.pcm, poster: tg.poster, duration: tg.duration, cues: [], autoAsr: true, subName: 'субтитры, созданные приложением',
          note: '<b>У видео в Telegram нет субтитров — приложение создаст их само</b> и переведёт каждую строку.' });
      } else if (window.Views && Views.section) { Views.section('telegram'); UI.toast(`Найдите это видео — продолжу с ${mss(e.pos)}`, '', 7000); }
    };
    return Object.assign(base, { kind: 'Видео из Telegram', ico: window.Telegram && Telegram.TG_SVG ? Telegram.TG_SVG(30) : '✈️', img: r && r.img, sub, go: () => openTg(e.pos), restart: () => openTg(null) });
  }
  function bookItem(e) {
    const shelf = window.Books && Books.SHELF;
    let b = null;
    try { (shelf || []).some(g => (g[1] || []).some(x => (x[4] === e.id ? (b = x) : null))); } catch (err) { b = null; }
    if (!b) return null;
    const left = e.total ? Math.max(0, Math.round(e.total - e.pos)) : 0;
    return { key: 'book:' + e.id, at: e.at, first: e.first, done: !!e.done, res: { kind: 'book', id: e.id }, title: e.title || b[0], kind: 'Книга', ico: '📚', verb: 'Продолжить чтение',
      grp: 'book', word: 'прочитано', line: e.done ? 'Дочитано до конца' : left ? `Стр. ${Math.round(e.pos)} · осталось ${left} ${pl(left, ['страница', 'страницы', 'страниц'])}` : `Остановились на стр. ${Math.round(e.pos)}`,
      where: e.done ? 'Дочитано до конца' : `Остановились на стр. ${Math.round(e.pos)}${e.total ? ` из ${e.total}` : ''}`, pct: e.done ? 1 : pctOf(e.pos, e.total),
      go: () => { Resume.prefer('book', e.id, e.done ? null : e.pos); Books.read(b); },
      restart: () => { Resume.prefer('book', e.id, null); Books.read(b); } };
  }
  function dialogItem(e) {
    if (!(window.Dialogs && Dialogs.resumeRun)) return null;
    const n = Math.round(e.pos) + 1;
    return { key: 'dialog:' + e.id, at: e.at, first: e.first, done: !!e.done, res: { kind: 'dialog', id: e.id }, title: e.title || 'Диалог по ролям', kind: 'Диалог по ролям', ico: '🎭', verb: 'Продолжить диалог',
      grp: 'dialog', word: 'пройдено', line: e.done ? 'Пройден до конца' : `Реплика ${n}${e.total ? ` из ${e.total}` : ''}`,
      where: e.done ? 'Пройден до конца' : `Остановились на реплике ${n}${e.total ? ` из ${e.total}` : ''}`, pct: e.done ? 1 : e.total ? (n - 1) / e.total : null,
      go: () => { Resume.prefer('dialog', e.id, e.done ? null : e.pos); Dialogs.resumeRun(e.id); },
      restart: () => { Resume.prefer('dialog', e.id, null); Dialogs.resumeRun(e.id); } };
  }
  function courseItem(c) {
    const sec = Math.max(0, Math.floor(c.sec || 0));
    const pct = c.of ? Math.max(0, (c.n - 1)) / c.of : null;
    return { key: 'ac:' + c.cid, at: +c.t || 0, title: `${c.title}${c.lesson ? ' · ' + c.lesson : ''}`, kind: 'Аудиокурс', ico: c.flag || '🎧', verb: 'Продолжить урок',
      grp: 'course', word: 'прослушано', done: pct != null && pct >= 0.95, line: `Урок ${c.n} из ${c.of}${sec ? ` · остановились на ${mss(sec)}` : ''}`,
      where: `Урок ${c.n} из ${c.of}${sec ? `, остановились на ${mss(sec)}` : ''}`, pct,
      go: () => AudioCourse.play(c.cid),
      restart: () => {
        let idx = null; try { idx = AudioCourse._t.stored(c.cid).findIndex(x => x.file === c.file); } catch (err) { idx = null; }
        AudioCourse.play(c.cid, idx >= 0 ? idx : null, { fromStart: true });
      } };
  }
  /** every audio course with a place (not only the last one) — the course's own data, read as AudioCourse.inProgress does */
  function courses() {
    const out = [];
    try {
      const T = AudioCourse._t, list = AudioCourse.list() || [];
      Object.entries(T.positions() || {}).forEach(([cid, e]) => {
        const c = list.find(x => x && String(x.id) === String(cid));
        if (!c || !e || !e.file || !e.t) return;
        const L = T.stored(cid) || [], k = L.findIndex(x => x.file === e.file);
        if (k < 0) return;
        const one = AudioCourse.inProgress && AudioCourse.inProgress();
        const lesson = one && one.cid === cid ? one.lesson : '';
        out.push({ cid, file: e.file, sec: +e.sec || 0, t: +e.t, title: c.short || c.title || 'Аудиокурс', flag: c.flag || '🎧', lesson: lesson || '', n: k + 1, of: L.length });
      });
    } catch (err) { const one = AudioCourse.inProgress && AudioCourse.inProgress(); if (one) out.push(one); }
    return out;
  }
  function listenItem(e) {
    const where = e.kind === 'book' && e.page ? `Остановились на стр. ${e.page}${e.pages ? ` из ${e.pages}` : ''}`
      : e.kind === 'media' ? `Остановились на видео ${(e.i | 0) + 1} из ${e.n}${e.sec ? `, ${mss(e.sec)}` : ''}`
        : e.kind === 'text' ? `Остановились на части ${(e.i | 0) + 1} из ${e.n}` : `Остановились на карточке ${(e.i | 0) + 1} из ${e.n}`;
    const pct = e.kind === 'book' && e.page && e.pages ? pctOf(e.page, e.pages) : e.n ? (e.i | 0) / e.n : null;
    return { key: 'listen:' + e.key, at: +e.t || 0, title: e.title || 'Прослушивание', kind: e.kind === 'deck' ? 'Слушаю колоду' : e.kind === 'book' ? 'Книга вслух' : 'Слушаю', ico: '🎧', verb: 'Продолжить прослушивание',
      grp: 'listen', word: 'прослушано', done: pct != null && pct >= 0.95, line: where, where, pct,
      go: () => ListenX.continueEntry(e),
      restart: () => { listenForget(e.key); ListenX.continueEntry(Object.assign({}, e, { page: 1 })); } };
  }
  const listenOk = e => !!e && (e.kind !== 'deck' || !e.deckId || (window.Store && Store.deck(e.deckId))) && (e.kind !== 'text' || e.pieces) && (e.kind !== 'book' || e.book) && (e.kind !== 'media' || (e.items && e.items.length));

  /* ---------------- «Потом» (snoozed) and «Забыть» (forgotten until it is opened again) ---------------- */
  const LATER_KEY = 'nk-cont-later', FORGOT_KEY = 'nk-cont-forgot';
  function laterMap() { const o = ls(LATER_KEY, {}), t = Date.now(); let ch = false; Object.keys(o).forEach(k => { if (!(+o[k] > t)) { delete o[k]; ch = true; } }); if (ch) put(LATER_KEY, o); return o; }
  function snooze(key, days = 7) { const o = laterMap(); o[key] = Date.now() + days * DAY; const keep = Object.keys(o).sort((a, b) => o[b] - o[a]).slice(0, 100); put(LATER_KEY, Object.fromEntries(keep.map(k => [k, o[k]]))); refreshSoon(0); }
  function unsnooze(key) { const o = laterMap(); if (key in o) { delete o[key]; put(LATER_KEY, o); } refreshSoon(0); }
  const forgotMap = () => ls(FORGOT_KEY, {});
  /** «Забыть»: the place of js/resume.js is really removed; others (reader, audio course, listening) are hidden until opened again
   *  → an undo function («Отменить») */
  function forget(x) {
    if (!x || !x.key) return () => {};
    const key = x.key, wasLater = laterMap()[key], wasHid = hidden()[key];
    let raw = null;
    if (x.res && window.Resume && Resume.raw) { raw = Resume.raw(x.res.kind, x.res.id); Resume.clear(x.res.kind, x.res.id); }
    const f = forgotMap(); f[key] = Math.max(Date.now(), +x.at || 0);
    const keep = Object.keys(f).sort((a, b) => f[b] - f[a]).slice(0, 150);
    put(FORGOT_KEY, Object.fromEntries(keep.map(k => [k, f[k]])));
    const l = laterMap(); if (key in l) { delete l[key]; put(LATER_KEY, l); }
    refreshSoon(0);
    return () => {
      if (raw && Resume.restore) Resume.restore(x.res.kind, x.res.id, raw);
      const f2 = forgotMap(); delete f2[key]; put(FORGOT_KEY, f2);
      if (wasLater) { const l2 = laterMap(); l2[key] = wasLater; put(LATER_KEY, l2); }
      if (wasHid) { const h = hidden(); h[key] = wasHid; put(HIDE_KEY, h); }
      refreshSoon(0);
    };
  }

  /** all = true: everything ever started (finished too, old too, hidden from home too) — «📈 Мой прогресс» */
  function gather(all) {
    const out = [], now = Date.now(), hid = hidden(), open = ls(OPEN_KEY, {}), seen = new Set(), snoozed = laterMap(), forgot = forgotMap();
    const add = x => {
      if (!x || !x.key || seen.has(x.key)) return;
      if (!(x.at > 0)) return;
      if (+forgot[x.key] >= x.at) return;
      if (x.pct != null && x.pct >= 0.95) x.done = true;
      if (!all) {
        const days = x.live ? LIVE_DAYS : DAYS;
        if (now - x.at > days * DAY) return;
        if (+hid[x.key] >= x.at) return;
        if (+snoozed[x.key] > now) return;
        if (x.done) return;
      } else {
        x.hiddenHome = +hid[x.key] >= x.at;
        x.laterUntil = +snoozed[x.key] > now ? +snoozed[x.key] : 0;
      }
      seen.add(x.key); out.push(x);
    };
    // 🎓 a material learnt by parts and steps (js/learnby.js): «Håp · часть 3 · второй просмотр · 4:12» — instead of its plain place
    const learnt = new Set();
    try {
      (window.LearnBy ? (all ? LearnBy.progressList() : LearnBy.continueItems()) : []).forEach(x => { if (x.mkey) learnt.add('media:' + x.mkey); add(x); });
    } catch (err) { console.warn('continue: learnby', err); }
    learnt.forEach(k => seen.add(k));
    // 📍 places of js/resume.js
    try {
      const list = window.Resume ? (all && Resume.history ? Resume.history() : Resume.entries ? Resume.entries() : []) : [];
      list.forEach(e => {
        if (e.kind === 'media') add(mediaItem(e, open));
        else if (e.kind === 'book') add(bookItem(e));
        else if (e.kind === 'dialog') add(dialogItem(e));
        // 'audiocourse': its course below (lesson n of N); other kinds have no way back from here
      });
    } catch (err) { console.warn('continue: places', err); }
    // 📖 the reader's books (PDF / EPUB / own texts)
    try {
      (window.Reader && Reader.recent ? Reader.recent() : []).slice(0, all ? 12 : 6).forEach(r => {
        if (!r || !r.id || !(r.page > 1 || r.pct > 0.01)) return;
        const left = r.pages ? Math.max(0, r.pages - r.page) : 0;
        add({ key: 'reader:' + r.id, at: +r.at || 0, title: r.title || 'Книга', sub: r.author || '', kind: 'Читалка', ico: '📖', verb: 'Продолжить чтение',
          grp: 'book', word: 'прочитано', line: left ? `Стр. ${r.page} · осталось ${left} ${pl(left, ['страница', 'страницы', 'страниц'])}` : `Стр. ${r.page}`,
          where: `Остановились на стр. ${r.page}${r.pages ? ` из ${r.pages}` : ''}`, pct: r.pct != null ? +r.pct : null,
          go: () => Reader.openBook(r.id, { cont: true }),
          restart: () => { answerReaderOnce('start'); Reader.openBook(r.id); } });
      });
    } catch (err) { /* no reader */ }
    // 🎧 audio courses
    try {
      if (window.AudioCourse) {
        if (all && AudioCourse._t && AudioCourse.list) courses().forEach(c => add(courseItem(c)));
        else { const c = AudioCourse.inProgress ? AudioCourse.inProgress() : null; if (c) add(courseItem(c)); }
      }
    } catch (err) { /* no course */ }
    // 🎧 a listening queue (a deck, a text, a book read aloud, videos one after another)
    try {
      if (window.ListenX) {
        if (all && ListenX.positions) Object.values(ListenX.positions() || {}).filter(listenOk).sort((a, b) => b.t - a.t).slice(0, 20).forEach(e => add(listenItem(e)));
        else { const e = ListenX.lastResume ? ListenX.lastResume() : null; if (e) add(listenItem(e)); }
      }
    } catch (err) { /* no listening */ }
    // 📻 a broadcast that was playing: no place to seek — «Слушать дальше» (the home card only)
    if (!all) try {
      Object.entries(open).forEach(([mid, r]) => {
        if (!r || !r.live || !r.ok) return;
        const radio = r.how === 'radio-live';
        add({ key: 'live:' + mid, at: +r.at || 0, live: true, title: r.title || (radio ? 'Прямой эфир' : 'Прямой эфир NRK'), sub: r.sub, kind: radio ? 'Радио · прямой эфир' : 'NRK TV · прямой эфир',
          ico: radio ? '📻' : '📺', img: r.img, verb: radio ? 'Слушать дальше' : 'Смотреть дальше', where: 'Прямой эфир — включится то, что звучит сейчас', pct: null,
          go: () => {
            if (radio) { if (!need(window.NrkRadio, 'Радио')) return; NrkRadio.play(r.ro || { kind: 'channel', id: r.id, title: r.title }); }
            else { if (!need(window.NrkTV, 'NRK TV')) return; NrkTV.watchLive(r.id, r.title, ''); }
          }, restart: null });
      });
    } catch (err) { /* ignore */ }
    // a broadcast has no place to come back to: a programme / book with a real place goes first unless the radio is much newer
    const rank = x => x.at - (x.live ? 12 * 3600e3 : 0);
    out.sort((a, b) => rank(b) - rank(a));
    return out;
  }
  const items = () => gather(false);

  /* ---------------- drawing ---------------- */
  let cur = new Map(); // key → item (the last drawn)
  function thumb(x, cls = '') {
    const img = safeImg(x.img);
    return `<span class="cc-thumb ${cls}${img ? ' has-img' : ''}" aria-hidden="true"><span class="cc-ico">${x.ico || '▶️'}</span>${img ? `<img src="${esc(img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>`;
  }
  function bar(x) {
    if (x.pct == null) return x.live ? '<span class="cc-live" aria-hidden="true"><i></i><i></i><i></i></span>' : '';
    const p = Math.max(2, Math.min(100, Math.round(x.pct * 100)));
    return `<span class="cc-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-label="Пройдено ${p}%"><i style="width:${p}%"></i></span>`;
  }
  function html() {
    const list = items();
    cur = new Map(list.map(x => [x.key, x]));
    if (!list.length) return '';
    const x = list[0], more = list.length - 1, when = ago(x.at);
    const goLbl = x.live ? x.verb : 'Продолжить';
    return `<section class="cont-card${x.live ? ' is-live' : ''}" data-cont-card aria-label="${esc(x.verb)}: ${esc(x.title)}">
      <button type="button" class="cc-hit" data-cont="go" data-key="${esc(x.key)}" title="${esc(`${x.verb}: ${x.title}`)}" aria-label="${esc(`${x.verb}: ${x.title} — ${x.where}`)}">${thumb(x)}
        <span class="cc-main"><span class="cc-kick">${esc(x.verb)} · ${esc(x.kind)}</span>
          <b class="cc-title">${esc(x.title)}</b>
          <span class="cc-where">${esc(x.where)}${when ? ` · ${esc(when)}` : ''}</span>
          ${bar(x)}</span></button>
      <span class="cc-acts">
        <button type="button" class="btn primary cc-go" data-cont="go" data-key="${esc(x.key)}">${SVG.play}<span>${esc(goLbl)}</span></button>
        ${x.restart ? `<button type="button" class="btn ghost cc-restart" data-cont="restart" data-key="${esc(x.key)}" title="Забыть место и начать с самого начала">${SVG.restart}<span>Начать сначала</span></button>` : ''}
        ${window.Views && Views.progress ? `<button type="button" class="btn ghost cc-more cc-all" data-cont="all" title="${esc(more ? `Ещё ${more} — всё, что вы начали: видео, книги, курсы, колоды` : 'Всё, что вы начали: видео, книги, курсы, колоды')}">Всё незаконченное →</button>`
          : more ? `<button type="button" class="btn ghost cc-more" data-cont="more" aria-haspopup="dialog" title="Всё, что вы не досмотрели, не дочитали и не дослушали">${more === 1 ? 'Ещё одно незаконченное' : `Ещё ${more} незаконченных`} ›</button>` : ''}
      </span>
      <button type="button" class="icon-btn cc-x" data-cont="hide" data-key="${esc(x.key)}" title="Убрать отсюда" aria-label="Убрать «${esc(x.title)}» из «Продолжить»">✕</button>
    </section>`;
  }
  function rowHtml(x) {
    const when = ago(x.at);
    return `<div class="cc-row" data-cont-row="${esc(x.key)}">
      <button type="button" class="cc-row-go" data-cont="go" data-key="${esc(x.key)}" title="${esc(`${x.verb}: ${x.title}`)}">${thumb(x, 'sm')}
        <span class="cc-main"><span class="cc-kick">${esc(x.kind)}</span><b class="cc-title">${esc(x.title)}</b>
          <span class="cc-where">${esc(x.where)}${when ? ` · ${esc(when)}` : ''}</span>${bar(x)}</span>
        <span class="cc-row-play" aria-hidden="true">${SVG.play}</span></button>
      <button type="button" class="icon-btn cc-x" data-cont="hide" data-key="${esc(x.key)}" title="Убрать из списка" aria-label="Убрать «${esc(x.title)}» из списка">✕</button>
    </div>`;
  }
  let sheetOpen = null;
  function sheet() {
    const list = items();
    list.forEach(x => cur.set(x.key, x));
    const body = `<p class="m-note cc-lead">Всё, что вы начали и не закончили за последние две недели. Нажмите — откроется ровно там, где вы остановились.</p>
      <div class="cc-list">${list.map(rowHtml).join('')}</div>`;
    const o = { title: '▶ Незаконченное', body, cls: 'cc-sheet', detent: 'large',
      onClick(e, sh) {
        const b = e.target.closest('[data-cont]'); if (!b) return;
        e.stopPropagation();
        const key = b.dataset.key, x = cur.get(key);
        if (b.dataset.cont === 'hide') {
          if (x) hide(key, x.at);
          const row = b.closest('.cc-row'); if (row) { row.classList.add('gone'); setTimeout(() => { row.remove(); if (!sh.el.querySelector('.cc-row')) sh.close(); }, reduce() ? 0 : 220); }
          refreshSoon(0);
          return;
        }
        sh.close();
        if (x) later(() => run(x, b.dataset.cont));
      } };
    if (window.Mobile && Mobile.sheet) sheetOpen = Mobile.sheet(o);
    else { const m = UI.modal({ title: o.title, body, cls: 'cc-sheet' }); m.el.addEventListener('click', e => o.onClick(e, { close: () => m.close(), el: m.el })); sheetOpen = m; }
    return sheetOpen;
  }

  function run(x, how) {
    if (!x) return;
    if (window.Listen && Listen.prime) { try { Listen.prime(); } catch (e) { /* ignore */ } } // inside the tap (iPhone / Safari)
    if (how === 'restart' && x.restart) x.restart(); else x.go();
  }

  /* ---------------- wiring ---------------- */
  function refresh() { if (window.Views && Views.refreshContinue && window.App && App.view && App.view.name === 'home') Views.refreshContinue(); }
  let rT = 0;
  function refreshSoon(ms = 600) { clearTimeout(rT); rT = setTimeout(refresh, ms); }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-cont]');
    if (!b || !b.closest('[data-cont-card]')) return;
    e.preventDefault(); e.stopPropagation();
    const k = b.dataset.cont, key = b.dataset.key;
    if (k === 'more') { sheet(); return; }
    if (k === 'all') { if (window.App && App.goAsk) App.goAsk('progress'); return; }
    const x = cur.get(key) || items().find(i => i.key === key);
    if (!x) { refresh(); return; }
    if (k === 'hide') {
      hide(key, x.at);
      const card = b.closest('[data-cont-card]');
      if (card && !reduce()) { card.classList.add('gone'); setTimeout(refresh, 240); } else refresh();
      UI.toastAction ? UI.toastAction('Убрано с главной — найдёте в «Мой прогресс»', 'Вернуть', () => { const o = hidden(); delete o[key]; put(HIDE_KEY, o); refresh(); }, 6000, '✕') : UI.toast('Убрано из «Продолжить»', '', 3000);
      return;
    }
    run(x, k);
  }, true);
  ['resume-changed', 'resume-cleared', 'reader-shelf', 'listen-state', 'audiocourse-state', 'learnby-changed'].forEach(t => document.addEventListener(t, () => refreshSoon()));
  window.addEventListener('pageshow', () => refreshSoon(300));

  wrap();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrap); else setTimeout(wrap, 0);

  function unhide(key) { const o = hidden(); if (key in o) { delete o[key]; put(HIDE_KEY, o); } refreshSoon(0); }
  window.Continue = { items, all: () => gather(true), html, sheet, run: (key, how) => run(cur.get(key) || gather(true).find(i => i.key === key), how),
    snooze, unsnooze, forget, unhide, _remember: remember };
})();
