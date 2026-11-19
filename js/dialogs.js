/* ============ 🎭 Dialogs — «Диалоги по ролям» (window.Dialogs = { open() }) ============
 * Everyday A1–A2 dialogues (data/dialogues-public.json — own texts, ru + uk); on localhost also the personal
 * textbook dialogues (private/samtale-dialogues.json, never published).
 *   1. choose a dialogue  →  2. 🎧 listen: TTS line by line, the line highlighted, translation RU / UA / off
 *   3. 🎭 role-play: pick a role; the app says the other role, you answer by voice (NB-Whisper on the device or the
 *      browser's own recognition — as the 🗣 speaking tasks of js/prove.js do) or by typing; «💡 Подсказка» opens the
 *      line step by step (по памяти → пустые места → весь текст). Offline, tolerant comparison (case, punctuation,
 *      small spelling slips, numbers written as digits) with gentle feedback in Russian.
 * The place inside a role-play is kept with Resume (kind 'dialog'); leaving in the middle asks first.
 * Entry point anywhere: <button data-dialogs-open> (capture listener). Help topic «🎭 Диалоги по ролям».
 */
(function (root) {
  'use strict';
  const doc = root.document;
  const LS = 'nk-dialogs';
  const PUB = 'data/dialogues-public.json';
  const PRIV = 'private/samtale-dialogues.json';
  const THEME_ICO = { food: '🍽', transport: '🚆', family: '👨‍👩‍👧', work: '💼', health: '🩺', home: '🏠', shop: '🛒', school: '🏫', weather: '🌤' };
  const MODES = [
    { id: 'memory', ico: '🧠', name: 'По памяти', hint: 'видно только перевод — скажите по-норвежски' },
    { id: 'gaps', ico: '✏️', name: 'Пустые места', hint: 'часть слов скрыта — вспомните их' },
    { id: 'text', ico: '📄', name: 'С текстом', hint: 'ваша реплика видна — просто произнесите' },
  ];
  const LEVEL = { memory: 0, gaps: 1, text: 2 };

  const esc = s => (root.U && U.esc ? U.esc(s == null ? '' : String(s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const toast = (m, t, ms) => { try { if (root.UI && UI.toast) UI.toast(m, t || '', ms); } catch (e) { /* ignore */ } };
  const local = () => {
    try { if (root.MyCourse && MyCourse.available) return !!MyCourse.available(); } catch (e) { /* fall through */ }
    return ['localhost', '127.0.0.1'].includes(root.location && root.location.hostname);
  };
  const plural = (n, f) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? f[2] : b > 1 && b < 5 ? f[1] : b === 1 ? f[0] : f[2]; };
  const linesWord = n => `${n} ${plural(n, ['реплика', 'реплики', 'реплик'])}`;

  /* ---------------- preferences (this device only) ---------------- */
  let P = null;
  function prefs() {
    if (P) return P;
    P = { tr: 'ru', slow: false, mode: 'gaps', seen: false, best: {}, runs: {} };
    try { const j = JSON.parse(localStorage.getItem(LS) || '{}'); if (j && typeof j === 'object') Object.assign(P, j); } catch (e) { /* defaults */ }
    if (!['ru', 'uk', 'off'].includes(P.tr)) P.tr = 'ru';
    if (!LEVEL.hasOwnProperty(P.mode)) P.mode = 'gaps';
    if (!P.best || typeof P.best !== 'object') P.best = {};
    if (!P.runs || typeof P.runs !== 'object') P.runs = {};
    return P;
  }
  function savePrefs() {
    try {
      const keys = Object.keys(P.runs); // only the latest unfinished role-plays
      if (keys.length > 30) keys.sort((a, b) => (P.runs[a].at || 0) - (P.runs[b].at || 0)).slice(0, keys.length - 30).forEach(k => delete P.runs[k]);
      localStorage.setItem(LS, JSON.stringify(P));
    } catch (e) { /* private mode: kept for this visit */ }
  }

  /* ---------------- data ---------------- */
  let LIB = null;
  function norm(d, priv) {
    if (!d || !Array.isArray(d.lines)) return null;
    let speakers = (Array.isArray(d.speakers) ? d.speakers : []).map((s, i) => ({ id: String(s.id != null ? s.id : i), name: String(s.name || `Роль ${i + 1}`), ru: String(s.ru || ''), uk: String(s.uk || '') }));
    const lines = d.lines.map(l => ({
      who: String(l.who != null ? l.who : l.speaker), no: String(l.no || '').trim(), ru: String(l.ru || '').trim(), uk: String(l.uk || '').trim(),
      note: String(l.note || l.fix || '').trim(),
    })).filter(l => l.no);
    if (!speakers.length) speakers = [...new Set(lines.map(l => l.who))].map((id, i) => ({ id, name: id || `Роль ${i + 1}`, ru: '', uk: '' }));
    const ids = new Set(speakers.map(s => s.id));
    const ok = lines.filter(l => ids.has(l.who));
    speakers = speakers.filter(s => ok.some(l => l.who === s.id));
    if (speakers.length < 2 || ok.length < 2) return null;
    speakers.forEach((s, i) => { s.side = i % 2 ? 'b' : 'a'; });
    const key = (priv ? 'p:' : '') + String(d.id || d.titleNo || d.title);
    return {
      key, priv: !!priv, icon: d.icon || THEME_ICO[d.theme] || (priv ? '📘' : '💬'), level: d.level || '',
      title: String(d.title || d.titleNo || 'Диалог'), titleUk: String(d.titleUk || ''), titleNo: String(d.titleNo || ''),
      note: String(d.note || ''), deck: d.deck || '', speakers, lines: ok,
    };
  }
  async function getJson(url, opts) {
    const r = await fetch(url, opts || {});
    if (!r.ok) throw new Error('http ' + r.status);
    return r.json();
  }
  function load(force) {
    if (LIB && !force) return LIB;
    LIB = (async () => {
      const out = { pub: [], priv: [], failed: false };
      try { const j = await getJson(PUB); out.pub = (j.dialogues || []).map(d => norm(d, false)).filter(Boolean); } catch (e) { out.failed = true; }
      if (local()) {
        try { const j = await getJson(PRIV, { cache: 'no-store' }); out.priv = (j.dialogues || []).map(d => norm(d, true)).filter(Boolean); } catch (e) { /* no personal file here — fine */ }
      }
      if (out.failed && !out.priv.length) LIB = null; // try again next time
      return out;
    })();
    return LIB;
  }
  const allOf = lib => lib.pub.concat(lib.priv);

  /* ---------------- comparison (offline, tolerant) ---------------- */
  const ONES = ['null', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni', 'ti', 'elleve', 'tolv', 'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten'];
  const TENS = ['', '', 'tjue', 'tretti', 'førti', 'femti', 'seksti', 'sytti', 'åtti', 'nitti'];
  function numWords(n) {
    if (n < 20) return ONES[n];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ONES[n % 10] : '');
    if (n < 1000) { const h = Math.floor(n / 100), r = n % 100; return (h === 1 ? 'hundre' : ONES[h] + ' hundre') + (r ? ' og ' + numWords(r) : ''); }
    if (n >= 1100 && n < 2000) { const r = n % 100; return numWords(Math.floor(n / 100)) + (r ? numWords(r) : 'hundre'); } // years: nittenåttifem
    if (n < 10000) { const t = Math.floor(n / 1000), r = n % 1000; return (t === 1 ? 'tusen' : ONES[t] + ' tusen') + (r ? (r < 100 ? ' og ' : ' ') + numWords(r) : ''); }
    return String(n);
  }
  /** one word / phrase → comparable words */
  function words(s) {
    return String(s || '').toLowerCase()
      .replace(/[éèêë]/g, 'e').replace(/[óòô]/g, 'o').replace(/[àáâ]/g, 'a').replace(/ü/g, 'u').replace(/ä/g, 'æ').replace(/ö/g, 'ø')
      .replace(/\bkl\./g, 'klokka ').replace(/\bklokken\b/g, 'klokka')
      .replace(/\d+/g, m => ' ' + numWords(+m) + ' ')
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .split(/\s+/).filter(Boolean);
  }
  function lev(a, b) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 2) return 9;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  const near = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && lev(a, b) <= (Math.min(a.length, b.length) >= 8 ? 2 : 1));
  /**
   * compare(model, said) → { pct 0–100, marks: [{ t (the model's word as written), ok }], said }
   * Word overlap in order-free fashion (recall weighs most), tolerant to case, punctuation, small slips, digits,
   * a compound said as two words («ull sokker» = «ullsokker»).
   */
  function compare(model, said) {
    const toks = String(model || '').split(/\s+/).filter(Boolean);
    const exp = toks.map(t => ({ t, w: words(t) }));
    const got = words(said);
    const used = new Array(got.length).fill(false);
    let need = 0, hit = 0;
    const take = w => {
      for (let i = 0; i < got.length; i++) if (!used[i] && near(w, got[i])) { used[i] = true; return true; }
      for (let i = 0; i + 1 < got.length; i++) if (!used[i] && !used[i + 1] && near(w, got[i] + got[i + 1])) { used[i] = used[i + 1] = true; return true; }
      return false;
    };
    const marks = exp.map(e => {
      if (!e.w.length) return { t: e.t, ok: true };
      let ok = true;
      e.w.forEach(w => { need++; if (take(w)) hit++; else ok = false; });
      return { t: e.t, ok };
    });
    if (!got.length || !need) return { pct: 0, marks: marks.map(m => Object.assign(m, { ok: false })), said: String(said || '').trim() };
    const recall = hit / need, precision = used.filter(Boolean).length / got.length;
    const pct = Math.round(100 * Math.min(1, 0.85 * recall + 0.15 * precision));
    return { pct, marks, said: String(said || '').trim() };
  }
  /** the line with some words hidden: «h____» (the first letter stays) — every second word of 3+ letters */
  function gapsHtml(text) {
    let n = 0;
    return String(text).split(/(\s+)/).map(tok => {
      if (/^\s+$/.test(tok)) return tok;
      const m = tok.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}’'-]+)([^\p{L}\p{N}]*)$/u);
      if (!m || m[2].length < 3) return esc(tok);
      n++;
      if (n % 2) return esc(tok);
      return `${esc(m[1])}<span class="dlg-gap" aria-label="пропуск">${esc(m[2][0])}${'_'.repeat(Math.min(8, m[2].length - 1))}</span>${esc(m[3])}`;
    }).join('');
  }
  function verdict(pct) {
    if (pct >= 90) return { cls: 'good', head: '🎉 Отлично!', text: 'Сказано почти слово в слово.' };
    if (pct >= 70) return { cls: 'good', head: '👍 Очень хорошо!', text: 'Смысл передан — сравните мелочи с образцом.' };
    if (pct >= 45) return { cls: 'ok', head: '🙂 Неплохо!', text: 'Многие слова совпали. Послушайте образец и попробуйте ещё раз — или идите дальше.' };
    if (pct > 0) return { cls: 'try', head: '💪 Хорошее начало', text: 'Послушайте образец и скажите ещё разок — с подсказкой будет легче.' };
    return { cls: 'try', head: '🤔 Пока не получилось', text: 'Нажмите «💡 Подсказка» или послушайте образец — и попробуйте снова.' };
  }

  /* ---------------- voice ---------------- */
  const SRC = () => root.SpeechRecognition || root.webkitSpeechRecognition;
  const hasGum = () => !!(root.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  async function say(text, opts = {}) {
    if (!root.TTS || !TTS.speak) { await sleep(Math.min(5000, 700 + String(text).split(/\s+/).length * 380)); return; }
    let rate;
    try { rate = prefs().slow ? Math.max(0.45, (TTS.currentRate ? TTS.currentRate() : 0.9) * 0.72) : undefined; } catch (e) { rate = undefined; }
    const o = rate ? { rate } : {};
    if (opts.keep) o.keep = true;
    // a safety net: a voice that never says «done» must not stop the dialogue
    await Promise.race([Promise.resolve().then(() => TTS.speak(text, 'no', o)).catch(() => {}), sleep(5000 + String(text).length * 140)]);
  }
  const ttsStop = () => { try { if (root.TTS && TTS.stop) TTS.stop(); } catch (e) { /* ignore */ } };

  /* ======================= the window ======================= */
  let CUR = null;
  function open() {
    if (CUR && CUR.m && CUR.m.el && CUR.m.el.isConnected) { try { CUR.m.el.focus(); } catch (e) { /* ignore */ } return CUR; }
    if (!root.UI || !UI.modal) return null;
    const ctx = { view: 'list', gen: 0, closed: false };
    CUR = ctx;
    ctx.m = UI.modal({
      title: '🎭 Диалоги по ролям', cls: 'wide dlg-modal',
      body: '<div class="dlg-root" data-dlg></div><div class="dlg-sr" role="status" aria-live="polite" data-dlg-live></div>',
      beforeClose: UI.guard ? UI.guard(() => leaveQuestion(ctx)) : undefined,
      onClose: () => { ctx.closed = true; ctx.gen++; micAbort(ctx); ttsStop(); saveRun(ctx); if (CUR === ctx) CUR = null; },
      onMount: m => { ctx.body = m.el.querySelector('[data-dlg]'); },
    });
    ctx.m.el.addEventListener('click', e => onClick(ctx, e));
    ctx.m.el.addEventListener('keydown', e => onKey(ctx, e));
        renderList(ctx);
    return ctx;
  }
  const alive = ctx => !ctx.closed && ctx.body && ctx.body.isConnected;
  function live(ctx, t) { const el = ctx.m && ctx.m.el.querySelector('[data-dlg-live]'); if (el) { el.textContent = ''; setTimeout(() => { el.textContent = t; }, 30); } }
  function paint(ctx, html, focusSel) {
    if (!alive(ctx)) return;
    ctx.body.innerHTML = html;
    const scroller = ctx.m.el.querySelector('.modal-body'); if (scroller && !ctx.keepScroll) scroller.scrollTop = 0;
    ctx.keepScroll = false;
    if (focusSel) { const el = ctx.body.querySelector(focusSel); if (el) try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  const findDlg = (ctx, key) => ctx.lib && allOf(ctx.lib).find(d => d.key === key);
  const trOf = (l, force) => { const t = prefs().tr; if (t === 'off' && !force) return ''; return (t === 'uk' && l.uk) ? l.uk : l.ru; };
  const spk = (d, id) => d.speakers.find(s => s.id === id) || d.speakers[0];
  const roleRu = s => (prefs().tr === 'uk' && s.uk) ? s.uk : s.ru;
  const runKey = (d, role) => `${d.key}|${role}`;

  /** asked when the window is closed: only a role-play in progress has something to lose */
  function leaveQuestion(ctx) {
    if (ctx.view !== 'play' || !ctx.dlg) return null;
    const busy = ctx.mic && ctx.mic.state !== 'idle';
    if (!busy && ctx.i <= 0 && !ctx.res.some(r => r)) return null;
    return { title: 'Закончить диалог?', line: 'Место запомнится — потом можно продолжить с этой же реплики.', actions: [{ label: 'Выйти', value: 'close', cls: 'bad' }], cancel: 'Продолжить диалог' };
  }
  async function confirmLeavePlay(ctx) {
    const q = leaveQuestion(ctx);
    if (!q) return true;
    if (!UI.askClose) return true;
    return (await UI.askClose(q)) != null;
  }

  /* ---------------- the list ---------------- */
  async function renderList(ctx) {
    ctx.view = 'list'; ctx.gen++; ttsStop(); micAbort(ctx);
    if (!ctx.lib) {
      paint(ctx, '<div class="dlg-loading"><span class="spinner"></span> Загружаю диалоги…</div>');
      const lib = await load();
      if (!alive(ctx) || ctx.view !== 'list') return;
      if (!lib.pub.length && !lib.priv.length) {
        paint(ctx, `<div class="dlg-empty"><div class="dlg-empty-ico" aria-hidden="true">📡</div><p><b>Диалоги сейчас не загрузились.</b><br>Проверьте интернет и попробуйте ещё раз.</p>
          <button type="button" class="btn primary" data-retry title="Загрузить диалоги ещё раз">↻ Попробовать ещё раз</button></div>`);
        return;
      }
      ctx.lib = lib;
    }
    const p = prefs(), lib = ctx.lib;
    const intro = !p.seen ? `<div class="dlg-intro" data-intro>
        <div class="dlg-intro-ico" aria-hidden="true">🎭</div>
        <div class="dlg-intro-txt"><b>Разговоры из жизни в Норвегии — тренируйтесь говорить без стеснения.</b>
          <ol class="dlg-steps">
            <li><span aria-hidden="true">🎧</span> <b>Послушайте</b> диалог: каждая реплика подсвечивается, перевод — по кнопке.</li>
            <li><span aria-hidden="true">🎭</span> <b>Выберите роль</b>: приложение говорит за собеседника, а вы отвечаете.</li>
            <li><span aria-hidden="true">🎙</span> Отвечайте <b>голосом</b> или <b>напечатайте</b>. Забыли — «💡 Подсказка». Оценка мягкая: ошибки — это нормально.</li>
          </ol>
          <button type="button" class="btn sm" data-intro-ok title="Скрыть объяснение">👌 Понятно</button>
        </div></div>`
      : `<div class="dlg-introline"><span>🎧 Послушайте → 🎭 сыграйте роль → 🎙 отвечайте голосом или текстом.</span><button type="button" class="btn ghost sm" data-intro-show title="Показать, как это работает">❓ Как это работает</button></div>`;
    const card = d => {
      const best = p.best[d.key];
      const run = Object.keys(p.runs).find(k => k.startsWith(d.key + '|'));
      return `<article class="dlg-card" data-key="${esc(d.key)}">
        <div class="dlg-card-ico" aria-hidden="true">${esc(d.icon)}</div>
        <div class="dlg-card-main">
          <h4>${esc(p.tr === 'uk' && d.titleUk ? d.titleUk : d.title)}</h4>
          ${d.titleNo ? `<div class="dlg-card-no" lang="nb">${esc(d.titleNo)}</div>` : ''}
          <div class="dlg-card-meta">${d.level ? `<span class="dlg-tag">${esc(d.level)}</span>` : ''}<span class="dlg-tag">${linesWord(d.lines.length)}</span>
            ${best ? `<span class="dlg-tag good" title="Лучший результат">★ ${best.pct} %</span>` : ''}${run ? '<span class="dlg-tag warn" title="Есть незаконченная игра">📍 начато</span>' : ''}</div>
        </div>
        <div class="dlg-card-acts">
          <button type="button" class="btn sm" data-listen="${esc(d.key)}" title="Послушать весь диалог с переводом">🎧 Слушать</button>
          <button type="button" class="btn sm primary" data-setup="${esc(d.key)}" title="Сыграть одну из ролей">🎭 Играть роль</button>
        </div></article>`;
    };
    const group = (title, list, extra) => list.length ? `<section class="dlg-group"><h3>${title} <span class="dlg-muted">${list.length}</span></h3>${extra || ''}<div class="dlg-cards">${list.map(card).join('')}</div></section>` : '';
    paint(ctx, `<div class="dlg-list">${intro}${trSeg()}
      ${group('🏙 Повседневные ситуации', lib.pub)}
      ${group('📘 Из вашего учебника', lib.priv, '<p class="dlg-muted dlg-small">🔒 Только на этом компьютере: диалоги из личного учебника, не публикуются.</p>')}
      ${lib.failed && lib.priv.length ? '<p class="dlg-muted dlg-small">Общие диалоги сейчас не загрузились — проверьте интернет.</p>' : ''}
    </div>`);
  }
  function trSeg() {
    const t = prefs().tr;
    const b = (v, label, tip) => `<button type="button" class="dlg-segbtn" data-tr="${v}" aria-pressed="${t === v}" title="${tip}">${label}</button>`;
    return `<div class="dlg-seg" role="group" aria-label="Перевод"><span class="dlg-seg-l">Перевод:</span>${b('ru', 'RU', 'Перевод на русский')}${b('uk', 'UA', 'Переклад українською')}${b('off', 'Скрыть', 'Без перевода — только норвежский')}</div>`;
  }

  /* ---------------- 🎧 listen ---------------- */
  function bar(ctx, d, right) {
    return `<div class="dlg-bar">
      <button type="button" class="btn ghost sm dlg-back" data-back title="Вернуться к списку диалогов">← Все диалоги</button>
      <div class="dlg-bar-title"><span aria-hidden="true">${esc(d.icon)}</span> <b>${esc(d.title)}</b>${d.titleNo ? ` <span class="dlg-muted" lang="nb">· ${esc(d.titleNo)}</span>` : ''}</div>
      ${right || ''}</div>`;
  }
  function lineHtml(d, l, i, extra) {
    const s = spk(d, l.who), tr = trOf(l);
    return `<li class="dlg-line side-${s.side}" data-line="${i}">
      <div class="dlg-who">${esc(s.name)}</div>
      <button type="button" class="dlg-bubble" data-say="${i}" title="Послушать эту реплику"><span class="dlg-no" lang="nb">${esc(l.no)}</span>${tr ? `<span class="dlg-tr">${esc(tr)}</span>` : ''}</button>
      ${l.note && prefs().tr !== 'off' ? `<div class="dlg-lnote">${esc(l.note)}</div>` : ''}${extra || ''}</li>`;
  }
  function renderListen(ctx, d) {
    ctx.view = 'listen'; ctx.dlg = d; ctx.gen++; ttsStop(); micAbort(ctx);
    const p = prefs();
    paint(ctx, `${bar(ctx, d)}
      ${d.note ? `<p class="dlg-note">${esc(d.note)}</p>` : ''}
      <div class="dlg-tools">
        <button type="button" class="btn primary" data-playall title="Прочитать весь диалог вслух по очереди">▶ Слушать весь диалог</button>
        <button type="button" class="btn" data-slow aria-pressed="${!!p.slow}" title="Говорить медленнее">🐢 Медленнее${p.slow ? ' ✓' : ''}</button>
        ${trSeg()}
      </div>
      <p class="dlg-muted dlg-small">Нажмите на любую реплику, чтобы послушать только её.</p>
      <ol class="dlg-chat">${d.lines.map((l, i) => lineHtml(d, l, i)).join('')}</ol>
      <div class="dlg-foot-acts"><button type="button" class="btn primary" data-setup="${esc(d.key)}" title="Выбрать роль и сыграть диалог">🎭 Сыграть роль →</button></div>`, '[data-playall]');
  }
  function highlight(ctx, i) {
    ctx.body.querySelectorAll('.dlg-line.on').forEach(x => x.classList.remove('on'));
    if (i == null) return;
    const li = ctx.body.querySelector(`.dlg-line[data-line="${i}"]`);
    if (li) { li.classList.add('on'); try { li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* ignore */ } }
  }
  function setPlayAll(ctx, on) {
    const b = ctx.body.querySelector('[data-playall]'); if (!b) return;
    b.textContent = on ? '■ Остановить' : '▶ Слушать весь диалог';
    b.title = on ? 'Остановить чтение' : 'Прочитать весь диалог вслух по очереди';
    b.classList.toggle('bad', on); b.classList.toggle('primary', !on);
  }
  async function playAll(ctx, from = 0) {
    const d = ctx.dlg, g = ++ctx.gen; ttsStop();
    ctx.playing = true; setPlayAll(ctx, true);
    for (let i = from; i < d.lines.length; i++) {
      if (g !== ctx.gen || !alive(ctx)) return;
      highlight(ctx, i);
      await say(d.lines[i].no, { keep: i > from });
      if (g !== ctx.gen) return;
      await sleep(350);
    }
    if (g !== ctx.gen || !alive(ctx)) return;
    ctx.playing = false; setPlayAll(ctx, false); highlight(ctx, null);
    live(ctx, 'Диалог прочитан');
  }
  async function sayOne(ctx, i) {
    const d = ctx.dlg, g = ++ctx.gen; ttsStop();
    ctx.playing = false; setPlayAll(ctx, false);
    highlight(ctx, i);
    await say(d.lines[i].no);
    if (g === ctx.gen && alive(ctx)) highlight(ctx, null);
  }

  /* ---------------- 🎭 role choice ---------------- */
  function renderSetup(ctx, d) {
    ctx.view = 'setup'; ctx.dlg = d; ctx.gen++; ttsStop(); micAbort(ctx);
    const p = prefs();
    if (!ctx.role || !d.speakers.some(s => s.id === ctx.role) || ctx.roleFor !== d.key) { ctx.role = d.speakers[0].id; ctx.roleFor = d.key; }
    const roles = d.speakers.map(s => {
      const n = d.lines.filter(l => l.who === s.id).length, first = d.lines[0].who === s.id;
      return `<button type="button" class="dlg-role side-${s.side}" data-role="${esc(s.id)}" aria-pressed="${ctx.role === s.id}" title="Играть за ${esc(s.name)}">
        <span class="dlg-role-name">${esc(s.name)}</span>${roleRu(s) ? `<span class="dlg-role-ru">${esc(roleRu(s))}</span>` : ''}
        <span class="dlg-muted dlg-small">${linesWord(n)}${first ? ' · начинает разговор' : ''}</span></button>`;
    }).join('');
    const modes = MODES.map(m => `<button type="button" class="dlg-mode" data-mode="${m.id}" aria-pressed="${p.mode === m.id}" title="${esc(m.name)}: ${esc(m.hint)}">
        <span class="dlg-mode-ico" aria-hidden="true">${m.ico}</span><span><b>${m.name}</b><span class="dlg-muted dlg-small">${m.hint}</span></span></button>`).join('');
    paint(ctx, `${bar(ctx, d)}
      <div class="dlg-setup">
        <h3>Кем вы будете?</h3>
        <div class="dlg-roles">${roles}</div>
        <h3>Как показывать вашу реплику?</h3>
        <div class="dlg-modes">${modes}</div>
        <p class="dlg-muted dlg-small">Приложение произнесёт реплики собеседника. Вы отвечаете 🎙 голосом или ⌨️ текстом; «💡 Подсказка» открывает реплику шаг за шагом.</p>
        <div class="dlg-foot-acts">
          <button type="button" class="btn" data-listen="${esc(d.key)}" title="Сначала послушать весь диалог">🎧 Сначала послушать</button>
          <button type="button" class="btn primary dlg-big" data-start title="Начать диалог">▶ Начать</button>
        </div>
      </div>`, '[data-start]');
  }

  /* ---------------- 🎭 play ---------------- */
  async function startPlay(ctx, d, role) {
    ctx.dlg = d; ctx.role = role;
    const id = runKey(d, role), p = prefs();
    let from = 0, res = [];
    const saved = p.runs[id];
    if (root.Resume && Resume.get && Resume.get('dialog', id)) {
      const pos = await Resume.ask({ kind: 'dialog', id, title: `${d.title} — роль: ${spk(d, role).name}`, posLabel: `реплика ${(Resume.get('dialog', id).pos | 0) + 1}`, owner: ctx.m.el });
      if (!alive(ctx)) return;
      if (pos != null && pos > 0 && pos < d.lines.length) { from = pos | 0; res = saved && Array.isArray(saved.res) ? saved.res.slice(0, from) : []; }
      else { delete p.runs[id]; savePrefs(); }
    }
    ctx.view = 'play'; ctx.i = from; ctx.res = res; ctx.hint = 0; ctx.fb = null; ctx.typed = false;
    renderPlay(ctx);
    step(ctx);
  }
  function saveRun(ctx) {
    if (ctx.view !== 'play' || !ctx.dlg) return;
    const d = ctx.dlg, id = runKey(d, ctx.role), p = prefs();
    if (ctx.i > 0 && ctx.i < d.lines.length) {
      p.runs[id] = { i: ctx.i, res: ctx.res.slice(0, ctx.i), at: Date.now() }; savePrefs();
      try { if (root.Resume) Resume.save('dialog', id, ctx.i, { unit: 'phrase', total: d.lines.length, title: d.title }); } catch (e) { /* ignore */ }
    }
  }
  function myTurn(ctx) { const l = ctx.dlg.lines[ctx.i]; return !!l && l.who === ctx.role; }
  function renderPlay(ctx) {
    const d = ctx.dlg, me = spk(d, ctx.role), n = d.lines.length;
    const mine = d.lines.filter(l => l.who === ctx.role).length;
    const pos = Math.min(ctx.i, n);
    const past = d.lines.slice(0, pos).map((l, i) => {
      if (l.who !== ctx.role) return lineHtml(d, l, i);
      const r = ctx.res[i];
      const s = spk(d, l.who);
      return `<li class="dlg-line side-${s.side} mine" data-line="${i}">
        <div class="dlg-who">${esc(s.name)} · вы</div>
        <button type="button" class="dlg-bubble" data-say="${i}" title="Послушать, как надо"><span class="dlg-no" lang="nb">${esc(l.no)}</span>${r && r.said && r.pct < 90 ? `<span class="dlg-said">Вы: <span lang="nb">${esc(r.said)}</span></span>` : ''}</button>
        <span class="dlg-score ${r ? verdict(r.pct).cls : 'skip'}" title="Совпадение с образцом">${r ? (r.skip ? 'пропущено' : r.pct + ' %') + (r.hint ? ' · 💡' : '') : '—'}</span></li>`;
    }).join('');
    paint(ctx, `${bar(ctx, d, `<span class="dlg-prog" title="Реплика ${Math.min(pos + 1, n)} из ${n}">${Math.min(pos + 1, n)} / ${n}</span>`)}
      <div class="dlg-progbar" aria-hidden="true"><i style="width:${(pos / n * 100).toFixed(1)}%"></i></div>
      <p class="dlg-muted dlg-small">Вы — <b>${esc(me.name)}</b>${roleRu(me) ? ` (${esc(roleRu(me))})` : ''} · ${linesWord(mine)} · ${esc(MODES[LEVEL[prefs().mode]].name.toLowerCase())}</p>
      <ol class="dlg-chat dlg-chat-play">${past}</ol>
      <div class="dlg-turn" data-turn></div>`);
    paintTurn(ctx);
  }
  function paintTurn(ctx, focusSel) {
    if (!alive(ctx) || ctx.view !== 'play') return;
    const box = ctx.body.querySelector('[data-turn]'); if (!box) return;
    const d = ctx.dlg, l = d.lines[ctx.i];
    if (!l) { box.innerHTML = ''; return; }
    const s = spk(d, l.who);
    if (l.who !== ctx.role) {
      const tr = trOf(l);
      box.innerHTML = `<div class="dlg-line side-${s.side} on dlg-other">
          <div class="dlg-who">${esc(s.name)} <span class="dlg-speaking" aria-hidden="true"><i></i><i></i><i></i></span></div>
          <button type="button" class="dlg-bubble" data-say-cur title="Послушать ещё раз"><span class="dlg-no" lang="nb">${esc(l.no)}</span>${tr ? `<span class="dlg-tr">${esc(tr)}</span>` : ''}</button>
        </div>
        <div class="dlg-turn-acts">
          <button type="button" class="btn sm" data-again title="Повторить реплику собеседника">🔁 Повторить</button>
          <button type="button" class="btn sm" data-skip-other title="Не ждать — к следующей реплике">⏭ Дальше</button>
        </div>`;
      return;
    }
    const level = Math.max(LEVEL[prefs().mode], ctx.hint);
    const tr = trOf(l, true);
    const cue = level >= 2 ? `<div class="dlg-cue" lang="nb">${esc(l.no)}</div>`
      : level === 1 ? `<div class="dlg-cue" lang="nb">${gapsHtml(l.no)}</div>`
        : '<div class="dlg-cue dlg-cue-hidden">Скажите это по-норвежски 👇</div>';
    const fb = ctx.fb;
    let fbHtml = '';
    if (fb) {
      const v = verdict(fb.pct);
      fbHtml = `<div class="dlg-fb ${v.cls}" role="status">
          <div class="dlg-fb-head"><b>${v.head}</b><span class="dlg-score ${v.cls}">${fb.pct} %</span></div>
          <p>${v.text}</p>
          <div class="dlg-diff" lang="nb" aria-label="Образец: зелёным — совпало, оранжевым — пропущено">${fb.marks.map(m => `<span class="${m.ok ? 'ok' : 'miss'}">${esc(m.t)}</span>`).join(' ')}</div>
          ${fb.said ? `<p class="dlg-said">Вы: <span lang="nb">${esc(fb.said)}</span></p>` : ''}
          ${fb.voice && fb.pct < 70 ? '<p class="dlg-muted dlg-small">🎙 Распознавание иногда ошибается. Если вы уверены, что сказали верно, — просто идите дальше.</p>' : ''}
          ${l.note && prefs().tr !== 'off' ? `<p class="dlg-lnote">${esc(l.note)}</p>` : ''}
          <div class="dlg-turn-acts">
            <button type="button" class="btn sm" data-model title="Послушать правильную реплику">🔊 Образец</button>
            <button type="button" class="btn sm" data-retry-line title="Ответить на эту реплику ещё раз">↻ Ещё раз</button>
            <button type="button" class="btn primary" data-next title="К следующей реплике (Enter)">Дальше →</button>
          </div></div>`;
    }
    const m = ctx.mic, rec = m && m.state === 'rec', busy = m && (m.state === 'starting' || m.state === 'busy');
    box.innerHTML = `<div class="dlg-me">
        <div class="dlg-me-head"><span class="dlg-who">Ваша реплика · ${esc(s.name)}</span></div>
        ${tr ? `<div class="dlg-cue-tr">${esc(tr)}</div>` : ''}
        ${cue}
        ${fb ? fbHtml : `<div class="dlg-answer">
          <label class="dlg-sr" for="dlg-in">Ваш ответ по-норвежски</label>
          <input id="dlg-in" class="dlg-input" data-dlg-input type="text" lang="nb" autocomplete="off" autocapitalize="sentences" spellcheck="false" enterkeyhint="done" placeholder="Скажите 🎙 или напишите по-норвежски…" value="${esc(ctx.draft || '')}">
          <div class="dlg-ans-btns">
            <button type="button" class="btn ${rec ? 'bad' : ''} dlg-micbtn" data-mic aria-pressed="${!!rec}" ${busy ? 'disabled' : ''} title="${rec ? 'Остановить запись' : 'Сказать вслух — распознаю речь'}"><span class="dlg-dot ${rec ? 'on' : ''}" aria-hidden="true"></span>${rec ? '■ Стоп' : busy ? '⏳ Минутку…' : '🎙 Сказать'}</button>
            <button type="button" class="btn primary" data-check title="Сравнить с образцом (Enter)">✓ Проверить</button>
          </div>
          <div class="dlg-mic-status" data-mic-status role="status">${esc(ctx.micNote || '')}</div>
          ${ctx.micDenied ? '<div class="dlg-denied" role="note">🎙 <b>Микрофон не разрешён</b> — ничего страшного: напишите ответ в поле выше. Чтобы говорить голосом, разрешите микрофон для этого сайта в настройках браузера.</div>' : ''}
          <div class="dlg-turn-acts">
            <button type="button" class="btn sm" data-hint ${level >= 2 ? 'disabled' : ''} title="${level === 0 ? 'Показать реплику с пропусками' : 'Показать всю реплику и произнести её'}">💡 Подсказка</button>
            <button type="button" class="btn sm" data-model title="Послушать, как это сказать">🔊 Как сказать?</button>
            <button type="button" class="btn ghost sm" data-skip title="Пропустить эту реплику">Пропустить →</button>
          </div></div>`}
      </div>`;
    if (focusSel) { const el = box.querySelector(focusSel); if (el) try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    try { box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* ignore */ }
  }
  /** the dialogue goes on by itself until it is your turn */
  async function step(ctx) {
    const g = ++ctx.gen, d = ctx.dlg;
    while (alive(ctx) && ctx.view === 'play' && g === ctx.gen) {
      if (ctx.i >= d.lines.length) { finish(ctx); return; }
      if (myTurn(ctx)) { ctx.hint = 0; ctx.fb = null; ctx.draft = ''; ctx.micNote = ''; paintTurn(ctx, '[data-dlg-input]'); live(ctx, 'Ваша реплика'); return; }
      paintTurn(ctx);
      await say(d.lines[ctx.i].no);
      if (g !== ctx.gen || !alive(ctx)) return;
      await sleep(450);
      if (g !== ctx.gen || !alive(ctx)) return;
      ctx.i++; saveRun(ctx); ctx.keepScroll = true; renderPlay(ctx);
    }
  }
  function next(ctx) {
    micAbort(ctx); ttsStop();
    ctx.i++; ctx.fb = null; ctx.hint = 0; ctx.draft = '';
    saveRun(ctx);
    ctx.keepScroll = true; renderPlay(ctx); step(ctx);
  }
  function check(ctx, via) {
    const l = ctx.dlg.lines[ctx.i]; if (!l || !myTurn(ctx)) return;
    const inp = ctx.body.querySelector('[data-dlg-input]');
    const said = inp ? inp.value.trim() : '';
    if (!said) { ctx.micNote = 'Сначала скажите 🎙 или напишите ответ — или нажмите «💡 Подсказка».'; const st = ctx.body.querySelector('[data-mic-status]'); if (st) st.textContent = ctx.micNote; if (inp) inp.focus(); return; }
    micAbort(ctx);
    const r = compare(l.no, said);
    r.voice = via === 'voice'; r.hint = ctx.hint > LEVEL[prefs().mode];
    ctx.fb = r; ctx.draft = said;
    ctx.res[ctx.i] = { pct: r.pct, said: r.said, hint: r.hint };
    paintTurn(ctx, '[data-next]');
    live(ctx, `${verdict(r.pct).head} ${r.pct} процентов`);
  }
  function finish(ctx) {
    const d = ctx.dlg, id = runKey(d, ctx.role), p = prefs();
    ctx.view = 'done'; ctx.gen++; micAbort(ctx);
    delete p.runs[id];
    try { if (root.Resume) Resume.clear('dialog', id); } catch (e) { /* ignore */ }
    const mine = d.lines.map((l, i) => ({ l, i, r: ctx.res[i] })).filter(x => x.l.who === ctx.role);
    const done = mine.filter(x => x.r);
    const pct = done.length ? Math.round(done.reduce((a, x) => a + (x.r.pct || 0), 0) / mine.length) : 0;
    const prev = p.best[d.key];
    const record = done.length && (!prev || pct > prev.pct);
    if (record) p.best[d.key] = { pct, at: Date.now() };
    savePrefs();
    const v = verdict(pct);
    const other = d.speakers.find(s => s.id !== ctx.role);
    paint(ctx, `${bar(ctx, d)}
      <div class="dlg-done">
        <div class="dlg-done-ico" aria-hidden="true">${pct >= 70 ? '🏆' : pct >= 45 ? '🌟' : '🌱'}</div>
        <h3>Диалог сыгран!</h3>
        <div class="dlg-done-pct ${v.cls}">${pct} %</div>
        <p>${pct >= 70 ? 'Здорово! Так и говорят в жизни.' : pct >= 45 ? 'Хороший результат — ещё раз, и будет совсем уверенно.' : 'Начало положено! Послушайте диалог ещё раз и сыграйте снова — с каждым разом легче.'}${record && prev ? ' <b>Новый рекорд!</b>' : ''}</p>
        <ol class="dlg-sum">${mine.map(x => `<li><span class="dlg-score ${x.r ? (x.r.skip ? 'skip' : verdict(x.r.pct).cls) : 'skip'}">${x.r ? (x.r.skip ? '—' : x.r.pct + ' %') : '—'}</span>
            <button type="button" class="dlg-sum-line" data-say-any="${x.i}" title="Послушать реплику"><span lang="nb">${esc(x.l.no)}</span>${trOf(x.l) ? `<span class="dlg-tr">${esc(trOf(x.l))}</span>` : ''}</button></li>`).join('')}</ol>
        <div class="dlg-foot-acts">
          <button type="button" class="btn primary" data-replay title="Сыграть эту же роль ещё раз">↻ Ещё раз</button>
          ${other ? `<button type="button" class="btn" data-swap="${esc(other.id)}" title="Сыграть за ${esc(other.name)}">🔄 Сыграть за ${esc(other.name)}</button>` : ''}
          <button type="button" class="btn" data-listen="${esc(d.key)}" title="Послушать весь диалог">🎧 Послушать</button>
          <button type="button" class="btn ghost" data-back title="Вернуться к списку диалогов">← Все диалоги</button>
        </div>
      </div>`, '[data-replay]');
    live(ctx, `Диалог сыгран: ${pct} процентов`);
  }

  /* ---------------- 🎙 one phrase by voice ---------------- */
  async function micBlocked() {
    try { if (navigator.permissions && navigator.permissions.query) { const p = await navigator.permissions.query({ name: 'microphone' }); return p.state === 'denied'; } } catch (e) { /* not supported: just try */ }
    return false;
  }
  /** 'whisper' | 'browser' | 'cancel' | null — the same choice as the speaking tasks */
  async function pickEngine(ctx) {
    if (ctx.engine) return ctx.engine;
    const S = root.Speech;
    if (S && S.asrReady && hasGum()) { try { if (await S.asrReady()) return (ctx.engine = 'whisper'); } catch (e) { /* go on */ } }
    if (SRC() && root.Store && Store.settings && Store.settings.speechAsr === 'browser') return (ctx.engine = 'browser');
    if (S && S.consent && S.asrInfo && hasGum() && typeof WebAssembly === 'object' && 'caches' in root) {
      try {
        const info = await S.asrInfo();
        const r = await S.consent(info.group, { lead: '🎭 Чтобы отвечать в диалоге голосом, нужно распознавание норвежской речи.', reason: 'Не хотите скачивать — просто печатайте ответы.' });
        if (r === true) return (ctx.engine = 'whisper');
        if (r === 'browser' && SRC()) return (ctx.engine = 'browser');
        return 'cancel';
      } catch (e) { /* the dialog failed — the browser's own recognition, if any */ }
    }
    return SRC() ? (ctx.engine = 'browser') : null;
  }
  function primeAudio(ctx) {
    try {
      const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return;
      if (!ctx.ac || ctx.ac.state === 'closed') ctx.ac = new AC();
      if (ctx.ac.state === 'suspended') ctx.ac.resume().catch(() => {});
    } catch (e) { ctx.ac = null; }
  }
  function micPaint(ctx) {
    if (!alive(ctx) || ctx.view !== 'play' || ctx.fb) return;
    const inp = ctx.body.querySelector('[data-dlg-input]'); if (inp) ctx.draft = inp.value;
    paintTurn(ctx);
  }
  function micNote(ctx, t) { ctx.micNote = t; const st = alive(ctx) && ctx.body.querySelector('[data-mic-status]'); if (st) st.textContent = t; }
  async function micStart(ctx) {
    if (ctx.mic) return;
    primeAudio(ctx); // inside the tap (iPhone)
    ttsStop(); ctx.gen++;
    const lineAt = ctx.i;
    const m = ctx.mic = { state: 'starting', chunks: [], len: 0, speech: false, quiet: 0, peak: 0, t0: Date.now() };
    ctx.micNote = '⏳ Включаю микрофон…'; micPaint(ctx);
    const fail = (note, denied) => { if (ctx.mic === m) { micRelease(m); ctx.mic = null; } if (denied) ctx.micDenied = true; ctx.micNote = note || ''; micPaint(ctx); if (denied) { const i = ctx.body.querySelector('[data-dlg-input]'); if (i) try { i.focus(); } catch (e) { /* ignore */ } } };
    if (await micBlocked()) { fail('', true); return; }
    const eng = await pickEngine(ctx);
    if (ctx.mic !== m) return;
    if (eng === 'cancel') { fail('Хорошо — напишите ответ в поле выше. Голосом можно позже: «🎙 Сказать».'); return; }
    if (!eng) { fail('В этом браузере нет распознавания речи — напишите ответ в поле выше.'); return; }
    m.engine = eng;
    try {
      if (eng === 'whisper') await whisperStart(ctx, m, lineAt); else browserStart(ctx, m, lineAt);
      if (ctx.mic !== m) return;
      m.state = 'rec'; ctx.micDenied = false;
      ctx.micNote = eng === 'browser' ? '🎙 Говорите… (распознаёт браузер — звук может уйти на сервер Google / Apple)' : '🎙 Говорите… Пауза — и я пойму, что вы закончили.';
      micPaint(ctx); live(ctx, 'Запись идёт — говорите');
    } catch (e) {
      const n = e && e.name;
      if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') fail('', true);
      else if (n === 'NotFoundError' || n === 'OverconstrainedError') fail('Микрофон не найден — напишите ответ в поле выше.');
      else fail('Микрофон сейчас не включился — попробуйте ещё раз или напишите ответ.');
    }
  }
  async function whisperStart(ctx, m, lineAt) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    m.stream = stream;
    if (ctx.mic !== m) { micRelease(m); return; }
    primeAudio(ctx);
    const ac = ctx.ac; if (!ac) throw new Error('no audio');
    if (ac.state === 'suspended') { try { await ac.resume(); } catch (e) { /* ignore */ } }
    const src = ac.createMediaStreamSource(stream), proc = ac.createScriptProcessor(4096, 1, 1);
    Object.assign(m, { src, proc, rate: ac.sampleRate });
    proc.onaudioprocess = e => {
      if (ctx.mic !== m || m.state !== 'rec') return;
      const dd = e.inputBuffer.getChannelData(0);
      m.chunks.push(new Float32Array(dd)); m.len += dd.length;
      let s2 = 0; for (let i = 0; i < dd.length; i++) s2 += dd[i] * dd[i];
      const rms = Math.sqrt(s2 / dd.length), ms = dd.length / m.rate * 1000;
      if (rms > 0.02) { m.speech = true; m.quiet = 0; m.peak = Math.max(m.peak, rms); } else if (rms < 0.012) m.quiet += ms;
      const dot = ctx.body && ctx.body.querySelector('.dlg-dot'); if (dot) dot.style.setProperty('--lv', Math.min(1, rms * 12).toFixed(2));
      const dur = m.len / m.rate;
      if ((m.speech && m.quiet > 1300 && dur > 1) || dur > 15) whisperDone(ctx, m, lineAt);
      else if (!m.speech && dur > 8) whisperDone(ctx, m, lineAt);
    };
    src.connect(proc); proc.connect(ac.destination);
  }
  async function whisperDone(ctx, m, lineAt) {
    if (m.state !== 'rec') return;
    m.state = 'busy'; micRelease(m);
    if (!m.speech || m.peak < 0.015) { if (ctx.mic === m) ctx.mic = null; ctx.micNote = '🤫 Не слышно речи — говорите чуть громче или напишите ответ.'; micPaint(ctx); return; }
    ctx.micNote = '⏳ Распознаю речь…' + (ctx.firstAsr ? '' : ' (в первый раз чуть дольше)'); micPaint(ctx);
    let text = '';
    try {
      const pcm = await root.Speech.toMono16k(m.chunks, m.rate);
      if (pcm.length >= 16000 * 0.3) text = String(await root.Speech.transcribe(pcm) || '').trim();
      ctx.firstAsr = true;
    } catch (e) { text = ''; m.failed = true; }
    if (ctx.mic === m) ctx.mic = null;
    if (!alive(ctx) || ctx.view !== 'play' || ctx.i !== lineAt || ctx.fb) return;
    if (!text) { ctx.micNote = m.failed ? 'Не получилось распознать — попробуйте ещё раз или напишите ответ.' : '🤫 Не расслышал(а) — попробуйте ещё раз.'; micPaint(ctx); return; }
    ctx.micNote = ''; ctx.draft = text; micPaint(ctx);
    check(ctx, 'voice');
  }
  function browserStart(ctx, m, lineAt) {
    const S = SRC(); if (!S) throw new Error('no recognition');
    const sr = new S(); m.sr = sr;
    sr.lang = 'nb-NO'; sr.continuous = false; sr.interimResults = true; sr.maxAlternatives = 1;
    let fin = '', heard = false;
    sr.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) fin += r[0].transcript + ' '; else interim += r[0].transcript; }
      heard = true;
      const inp = alive(ctx) && ctx.body.querySelector('[data-dlg-input]'); if (inp) inp.value = (fin + interim).trim();
    };
    sr.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') m.denied = true; else if (e.error !== 'no-speech' && e.error !== 'aborted') m.err = true; };
    sr.onend = () => {
      if (ctx.mic === m) ctx.mic = null;
      if (m.aborted || !alive(ctx) || ctx.view !== 'play' || ctx.i !== lineAt || ctx.fb) return;
      if (m.denied) { ctx.micDenied = true; ctx.micNote = ''; micPaint(ctx); return; }
      const text = fin.trim();
      if (!text) { ctx.micNote = m.err ? 'Распознавание сейчас не работает (нет связи?) — напишите ответ.' : heard ? '🤫 Не расслышал(а) — попробуйте ещё раз.' : '🤫 Не слышно речи — попробуйте ещё раз или напишите ответ.'; micPaint(ctx); return; }
      ctx.micNote = ''; ctx.draft = text; micPaint(ctx);
      check(ctx, 'voice');
    };
    sr.start();
  }
  function micRelease(m) {
    try { if (m.proc) { m.proc.onaudioprocess = null; m.proc.disconnect(); } if (m.src) m.src.disconnect(); } catch (e) { /* ignore */ }
    try { if (m.stream) m.stream.getTracks().forEach(t => t.stop()); } catch (e) { /* ignore */ }
    m.proc = null; m.src = null; m.stream = null;
  }
  /** «■ Стоп»: what was said so far is recognised */
  function micStop(ctx) {
    const m = ctx.mic; if (!m) return;
    if (m.sr) { try { m.sr.stop(); } catch (e) { /* ignore */ } return; }
    if (m.state === 'rec') whisperDone(ctx, m, ctx.i);
  }
  /** drop the recording (leaving the line / the window) */
  function micAbort(ctx) {
    const m = ctx.mic; if (!m) return;
    m.aborted = true; ctx.mic = null;
    if (m.sr) { try { m.sr.abort(); } catch (e) { /* ignore */ } }
    m.state = 'idle'; micRelease(m);
  }

  /* ---------------- events ---------------- */
  async function onClick(ctx, e) {
    const b = e.target.closest('button'); if (!b || !ctx.body || !ctx.body.contains(b)) return;
    const ds = b.dataset;
    if (ds.retry != null && ctx.view === 'list') { load(true); renderList(ctx); return; }
    if (ds.introOk != null) { prefs().seen = true; savePrefs(); renderList(ctx); return; }
    if (ds.introShow != null) { prefs().seen = false; savePrefs(); renderList(ctx); return; }
    if (ds.tr) {
      prefs().tr = ds.tr; savePrefs();
      ctx.keepScroll = true;
      if (ctx.view === 'list') renderList(ctx);
      else if (ctx.view === 'listen') { const playing = ctx.playing; ctx.gen++; ttsStop(); renderListen(ctx, ctx.dlg); if (playing) live(ctx, 'Перевод переключён'); }
      return;
    }
    if (ds.back != null) {
      if (ctx.view === 'play' && !(await confirmLeavePlay(ctx))) return;
      saveRun(ctx); renderList(ctx); return;
    }
    if (ds.listen) { const d = findDlg(ctx, ds.listen); if (!d) return; if (ctx.view === 'play' && !(await confirmLeavePlay(ctx))) return; saveRun(ctx); renderListen(ctx, d); return; }
    if (ds.setup) { const d = findDlg(ctx, ds.setup); if (d) renderSetup(ctx, d); return; }
    if (ds.playall != null) { if (ctx.playing) { ctx.gen++; ttsStop(); ctx.playing = false; setPlayAll(ctx, false); highlight(ctx, null); } else playAll(ctx); return; }
    if (ds.slow != null) { const p = prefs(); p.slow = !p.slow; savePrefs(); b.setAttribute('aria-pressed', String(p.slow)); b.textContent = '🐢 Медленнее' + (p.slow ? ' ✓' : ''); return; }
    if (ds.say != null) { if (ctx.view === 'listen') sayOne(ctx, +ds.say); else { ttsStop(); say(ctx.dlg.lines[+ds.say].no); } return; }
    if (ds.sayAny != null) { ttsStop(); say(ctx.dlg.lines[+ds.sayAny].no); return; }
    if (ds.role) { ctx.role = ds.role; ctx.body.querySelectorAll('[data-role]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.role === ds.role))); return; }
    if (ds.mode) { prefs().mode = ds.mode; savePrefs(); ctx.body.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.mode === ds.mode))); return; }
    if (ds.start != null) { startPlay(ctx, ctx.dlg, ctx.role); return; }
    if (ds.replay != null) { startPlay(ctx, ctx.dlg, ctx.role); return; }
    if (ds.swap) { startPlay(ctx, ctx.dlg, ds.swap); return; }
    if (ctx.view !== 'play') return;
    const l = ctx.dlg.lines[ctx.i];
    if (ds.sayCur != null || ds.again != null) { if (!l || myTurn(ctx)) return; ttsStop(); step(ctx); return; } // says the line again, then goes on
    if (ds.skipOther != null) { ctx.gen++; ttsStop(); ctx.i++; saveRun(ctx); ctx.keepScroll = true; renderPlay(ctx); step(ctx); return; }
    if (ds.mic != null) { if (ctx.mic && ctx.mic.state === 'rec') micStop(ctx); else micStart(ctx); return; }
    if (ds.check != null) { check(ctx, 'typed'); return; }
    if (ds.hint != null) {
      const inp = ctx.body.querySelector('[data-dlg-input]'); if (inp) ctx.draft = inp.value;
      ctx.hint = Math.min(2, Math.max(LEVEL[prefs().mode], ctx.hint) + 1);
      paintTurn(ctx, '[data-dlg-input]');
      if (ctx.hint >= 2 && l) { ttsStop(); say(l.no); }
      live(ctx, ctx.hint >= 2 ? 'Подсказка: вся реплика' : 'Подсказка: реплика с пропусками');
      return;
    }
    if (ds.model != null) { if (l) { micAbort(ctx); ttsStop(); say(l.no); } return; }
    if (ds.skip != null) { ctx.res[ctx.i] = { pct: 0, said: '', skip: true }; next(ctx); return; }
    if (ds.retryLine != null) { ctx.fb = null; ctx.draft = ''; paintTurn(ctx, '[data-dlg-input]'); return; }
    if (ds.next != null) { next(ctx); return; }
  }
  function onKey(ctx, e) {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing || ctx.view !== 'play') return;
    if (e.target.matches && e.target.matches('[data-dlg-input]')) { e.preventDefault(); check(ctx, 'typed'); return; }
    if (ctx.fb && !(e.target.closest && e.target.closest('button'))) { e.preventDefault(); next(ctx); }
  }

  /* ---------------- help + entry point ---------------- */
  function registerHelp() {
    const H = root.Help;
    if (!H || !Array.isArray(H.TOPICS) || H.TOPICS.some(t => t.id === 'dialogs')) return;
    H.TOPICS.push({ id: 'dialogs', icon: '🎭', hue: 190, title: 'Диалоги по ролям',
      desc: 'Разговоры из жизни в Норвегии: магазин, врач, NAV, работа, детский сад. Слушайте и играйте роль.',
      keys: 'диалог диалоги роль роли разговор говорить разговорник ситуация магазин врач legevakt аптека nav банк квартира работа больничный садик 113 small talk samtale rollespill',
      steps: [['🎭', 'Откройте <b>«Диалоги по ролям»</b> на главной.'],
        ['🎧', '<b>«Слушать»</b>: диалог читается вслух, реплика подсвечивается. Перевод — RU, UA или без перевода; 🐢 — медленнее.'],
        ['👤', '<b>«Играть роль»</b>: выберите, за кого говорите, и как показывать вашу реплику — с текстом, с пропусками или по памяти.'],
        ['🎙', 'Собеседника озвучивает приложение. Вы отвечаете <b>голосом</b> или <b>печатаете</b>; «💡 Подсказка» открывает реплику по шагам.'],
        ['✓', 'Ответ сравнивается с образцом: зелёным — совпало, оранжевым — что пропущено. Потом <b>«Дальше →»</b>.'],
        ['🔄', 'В конце — процент и <b>«Сыграть за другого»</b>. Вышли посередине — место запомнится.']],
      expect: 'Готовые фразы для настоящих разговоров — и привычка отвечать вслух, не подбирая слова.',
      limits: 'Оценка примерная: мелкие ошибки и регистр не считаются, но порядок слов и синонимы тоже не проверяются. Распознавание речи иногда ошибается — доверяйте себе. Голоса обеих ролей одинаковые (системный норвежский голос).',
      open: ['🎭 Открыть диалоги', () => open()] });
  }
  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', registerHelp); else registerHelp();
    // entry point anywhere: <button data-dialogs-open> (capture listener, like MyCourse / Klokka)
    doc.addEventListener('click', async e => {
      const b = e.target.closest && e.target.closest('[data-dialogs-open]');
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      const bd = b.closest('.modal-backdrop');
      if (bd && bd._m && !bd.querySelector('.dlg-modal')) { if (!(await bd._m.tryClose())) return; }
      open();
    }, true);
  }

  root.Dialogs = { open, _core: { compare, words, numWords, gapsHtml, norm, load } };
})(typeof window !== 'undefined' ? window : globalThis);
