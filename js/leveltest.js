/* ============ 🎯 Тест уровня — a short adaptive test A1 → B2 (our own questions) ============
 * LevelTest.open() — words, grammar, a mini reading and listening (the text is said by the app's voice, TTS place 'cards').
 * Adaptive: each level starts with 5 questions (words, grammar ×2, reading, listening); 4–5 right → the next level,
 * 3 → one more question decides, 3 wrong → the test stops. ≤ 24 questions, usually 10–20.
 * Result: «≈ A2» + the level to work on → Levels.setLevel(start, { level, src: 'leveltest' }) (js/levels.js) when the
 * learner agrees. Retake any time; history in localStorage 'nk-leveltest' { runs: [{ t, level, start, by }] }.
 * Honest: this is an orientation by our own questions on the CEFR scale, not an official test.
 * Data: data/level-test.json. CSS: css/practice.css (lazy).
 */
(function () {
  'use strict';
  const DATA_URL = 'data/level-test.json';
  const KEY = 'nk-leveltest';
  const LEVELS = ['A1', 'A2', 'B1', 'B2'];
  const NEXT = { '': 'A1', A1: 'A2', A2: 'B1', B1: 'B2', B2: 'C1' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, k, ms) => { if (window.UI && UI.toast) UI.toast(m, k || '', ms || 2600); };
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function loadCss() {
    if (document.querySelector('link[data-practice-css]')) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/practice.css?v=1'; l.setAttribute('data-practice-css', '');
    document.head.appendChild(l);
  }
  let DATA = null;
  async function load() {
    if (DATA) return DATA;
    const r = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    DATA = (j.items || []).filter(x => x && LEVELS.includes(x.level) && Array.isArray(x.options) && x.options[x.answer] != null);
    return DATA;
  }
  function hist() { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); return o && Array.isArray(o.runs) ? o : { runs: [] }; } catch (e) { return { runs: [] }; } }
  function saveHist(o) { o.runs = o.runs.slice(-20); try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* private mode */ } }

  /** the questions of a level: vocab, grammar, grammar, reading, listening — then the spare ones */
  function levelQueue(items, L) {
    const of = k => shuffle(items.filter(x => x.level === L && x.kind === k));
    const v = of('vocab'), g = of('grammar'), r = of('reading'), l = of('listening');
    const first = [v.shift(), g.shift(), g.shift(), r.shift(), l.shift()].filter(Boolean);
    return { first: shuffle(first), spare: shuffle([...v, ...g, ...r, ...l]) };
  }
  /** pure: given the answers per level → { level ('' = below A1), start, by } */
  function verdict(res) {
    let level = '';
    for (const L of LEVELS) { const x = res[L]; if (x && x.passed) level = L; else break; }
    const by = {}; LEVELS.forEach(L => { const x = res[L]; by[L] = x && x.n ? x.ok / x.n : 0; });
    return { level, start: NEXT[level] || 'A1', by };
  }

  async function open() {
    loadCss();
    if (!window.UI || !UI.modal) return;
    let items;
    try { items = await load(); } catch (e) { toast('Не получилось загрузить тест — проверьте интернет', 'warn', 3500); return; }
    let lang = 'ru';
    try { lang = (JSON.parse(localStorage.getItem('nk-phraseday') || '{}') || {}).lang === 'uk' ? 'uk' : 'ru'; } catch (e) { lang = 'ru'; }
    const m = UI.modal({ title: '🎯 Тест уровня', cls: 'wide lt-modal', body: '<div class="lt-wrap"></div>', onClose: () => { try { if (window.TTS && TTS.stop) TTS.stop(); } catch (e) { /* ignore */ } } });
    const box = m.$('.lt-wrap');
    let S = null;
    const intro = () => {
      const last = hist().runs.slice(-1)[0];
      box.innerHTML = `<div class="lt-intro">
          <p>Около 15–20 вопросов: слова, грамматика, короткий текст и аудирование. Тест подстраивается под вас: отвечаете верно — вопросы становятся сложнее (A1 → A2 → B1 → B2), ошибаетесь — тест заканчивается раньше.</p>
          <p class="small muted">Это ориентир по шкале уровней CEFR на наших собственных заданиях, а не официальный экзамен. Займёт 5–10 минут. Пройти заново можно в любой момент.</p>
          ${last ? `<p class="small">Прошлый результат: <b>${last.level || 'начальный'}</b> · ${esc(new Date(last.t).toLocaleDateString('ru-RU'))}</p>` : ''}
          <div class="lt-acts"><button type="button" class="btn primary" data-lt="start">▶ Начать тест</button>
            <span class="pd-lang" role="group" aria-label="Язык подсказок"><button type="button" class="pd-chip ${lang === 'ru' ? 'on' : ''}" data-lt-lang="ru" aria-pressed="${lang === 'ru'}">RU</button><button type="button" class="pd-chip ${lang === 'uk' ? 'on' : ''}" data-lt-lang="uk" aria-pressed="${lang === 'uk'}">UA</button></span></div></div>`;
    };
    const startLevel = L => { const q = levelQueue(items, L); S.L = L; S.queue = q.first; S.spare = q.spare; S.res[L] = { n: 0, ok: 0, passed: false }; };
    const start = () => { S = { res: {}, total: 0, cur: null, answered: false, log: [] }; startLevel('A1'); next(); };
    const say = (t, slow) => {
      if (!window.TTS || !TTS.speak) { toast('Голос недоступен — прочитайте текст', 'warn'); return; }
      const o = { place: 'cards' };
      if (slow) { let r = 0.9; try { r = TTS.currentRate ? TTS.currentRate() : 0.9; } catch (e) { r = 0.9; } o.rate = Math.max(0.45, r * 0.7); }
      // 🎭 a listening dialogue («– …» lines, «Kari: …»): every speaker with a voice of their own (js/voices.js)
      let dlg = false;
      try { dlg = /\n/.test(t) && !!TTS.speakText && !!(window.Voices && Voices.dialogRoles) && Voices.dialogRoles(String(t).split('\n')).some(x => x != null); } catch (e) { dlg = false; }
      try { if (dlg) TTS.speakText(t, 'no', o); else TTS.speak(t, 'no', o); } catch (e) { /* no voice */ }
    };
    function next() {
      const r = S.res[S.L];
      // the level is decided?
      const wrong = r.n - r.ok;
      let decided = null;
      if (wrong >= 3) decided = 'fail';
      else if (r.n >= 5 && !S.queue.length) {
        if (r.ok >= 4) decided = 'pass';
        else if (r.ok === 3 && r.n === 5 && S.spare.length) S.queue.push(S.spare.shift());
        else decided = r.ok >= 4 ? 'pass' : 'fail';
      }
      if (decided) {
        r.passed = decided === 'pass';
        const i = LEVELS.indexOf(S.L);
        if (r.passed && i < LEVELS.length - 1) startLevel(LEVELS[i + 1]); else { result(); return; }
      }
      S.cur = S.queue.shift(); S.answered = false;
      if (!S.cur) { result(); return; }
      ask();
    }
    function ask() {
      const x = S.cur, q = lang === 'uk' && x.q_uk ? x.q_uk : x.q_ru;
      const opts = x.options.map((o, i) => ({ o, i }));
      S.order = x.kind === 'reading' || x.kind === 'listening' ? opts : shuffle(opts);
      box.innerHTML = `<div class="lt-q">
          <div class="lt-top"><span class="lt-lvl">${esc(S.L)}</span><span class="small muted">Вопрос ${S.total + 1} · ${{ vocab: 'слова', grammar: 'грамматика', reading: 'чтение', listening: 'аудирование' }[x.kind] || ''}</span></div>
          <h3 class="lt-ask">${esc(q)}</h3>
          ${x.text ? `<div class="lt-text" lang="nb">${esc(x.text).replace(/\n/g, '<br>')}</div>` : ''}
          ${x.audio ? `<div class="lt-audio"><button type="button" class="btn" data-lt="play">▶ Послушать</button><button type="button" class="btn ghost" data-lt="slow">🐢 Медленнее</button><span class="small muted">Можно слушать несколько раз.</span></div>` : ''}
          ${x.no ? `<p class="lt-no" lang="nb">${esc(x.no).replace(/___/g, '<span class="lt-gap">_____</span>')}</p>` : ''}
          <div class="lt-opts" role="group" aria-label="Варианты ответа">${S.order.map((y, k) => `<button type="button" class="lt-opt" data-lt-o="${y.i}" lang="nb"><span class="lt-k" aria-hidden="true">${'ABCD'[k]}</span>${esc(y.o)}</button>`).join('')}</div>
          <div class="lt-why" aria-live="polite"></div>
          <div class="lt-acts"><button type="button" class="btn sm ghost" data-lt="dunno">Не знаю</button></div></div>`;
      if (x.audio) setTimeout(() => { if (m.el.isConnected && S.cur === x) say(x.audio); }, 350);
      const f = box.querySelector('.lt-opt'); if (f) f.focus({ preventScroll: true });
    }
    function answer(i) {
      if (S.answered) return;
      S.answered = true;
      const x = S.cur, ok = i === x.answer, r = S.res[S.L];
      r.n++; if (ok) r.ok++; S.total++;
      S.log.push({ id: x.id, ok });
      box.querySelectorAll('.lt-opt').forEach(b => {
        const k = +b.dataset.ltO; b.disabled = true;
        if (k === x.answer) b.classList.add('ok'); else if (k === i) b.classList.add('bad');
      });
      const why = lang === 'uk' && x.why_uk ? x.why_uk : x.why_ru;
      box.querySelector('.lt-why').innerHTML = `<p class="${ok ? 'lt-good' : 'lt-badt'}">${ok ? '✓ Верно' : i < 0 ? 'Правильный ответ выделен' : '✗ Неверно'}</p>${why ? `<p class="small">${esc(why)}</p>` : ''}${x.audio ? `<details class="small"><summary>Текст аудио</summary><p lang="nb">${esc(x.audio)}</p></details>` : ''}`;
      box.querySelector('.lt-acts').innerHTML = '<button type="button" class="btn primary" data-lt="next">Дальше ›</button>';
      const n = box.querySelector('[data-lt="next"]'); if (n) n.focus({ preventScroll: true });
    }
    function result() {
      const v = verdict(S.res);
      const h = hist(); h.runs.push({ t: Date.now(), level: v.level, start: v.start, by: v.by, n: S.total }); saveHist(h);
      if (window.XP) XP.add('leveltest', 15, { key: 'leveltest', label: 'Тест уровня' });
      const bar = p => `<span class="lt-bar"><span style="width:${Math.round(p * 100)}%"></span></span>`;
      const NAMES = { A1: 'начальный', A2: 'элементарный', B1: 'средний', B2: 'выше среднего', C1: 'продвинутый' };
      box.innerHTML = `<div class="lt-res">
          <div class="lt-res-ico" aria-hidden="true">${v.level ? '🧭' : '🌱'}</div>
          <h3>${v.level ? `Ваш уровень ≈ <span class="lt-lvl big">${v.level}</span> <small>(${NAMES[v.level]})</small>` : 'Начнём с самого начала'}</h3>
          <p>${v.level ? `Дальше советую работать над уровнем <b>${v.start}</b>.` : 'Советую начать с уровня <b>A1</b> — самые нужные слова и фразы.'} Вопросов: ${S.total}.</p>
          <div class="lt-levels">${LEVELS.map(L => { const x = S.res[L]; return `<div class="lt-row"><span class="lt-lvl">${L}</span>${bar(v.by[L])}<b>${x ? `${x.ok} из ${x.n}` : '—'}</b></div>`; }).join('')}</div>
          <p class="tiny muted">Это ориентир по шкале CEFR на собственных заданиях Norsk Kort, а не официальный тест и не оценка экзамена.</p>
          <div class="lt-acts">${window.Levels ? `<button type="button" class="btn primary" data-lt="apply">🪜 Учить слова уровня ${v.start}</button>` : ''}
            <button type="button" class="btn" data-lt="again">↻ Пройти ещё раз</button><button type="button" class="btn ghost" data-lt="close">Готово</button></div></div>`;
      S.v = v;
    }
    intro();
    box.addEventListener('click', e => {
      const o = e.target.closest('[data-lt-o]'); if (o) { answer(+o.dataset.ltO); return; }
      const lg = e.target.closest('[data-lt-lang]'); if (lg) { lang = lg.dataset.ltLang; try { const s = JSON.parse(localStorage.getItem('nk-phraseday') || '{}') || {}; s.lang = lang; localStorage.setItem('nk-phraseday', JSON.stringify(s)); } catch (er) { /* ignore */ } intro(); return; }
      const b = e.target.closest('[data-lt]'); if (!b) return;
      const a = b.dataset.lt;
      if (a === 'start' || a === 'again') start();
      else if (a === 'play' || a === 'slow') say(S.cur.audio, a === 'slow');
      else if (a === 'dunno') answer(-1);
      else if (a === 'next') next();
      else if (a === 'close') m.close();
      else if (a === 'apply') {
        try { Levels.setLevel ? Levels.setLevel(S.v.start, { level: S.v.level, by: S.v.by, src: 'leveltest' }) : null; } catch (er) { /* old levels.js */ }
        toast(`🪜 Уровень для работы: ${S.v.start}`, 'good', 3000);
        m.close();
        try { if (Levels.open) Levels.open(); } catch (er) { /* ignore */ }
      }
    });
    box.addEventListener('keydown', e => {
      if (!S || !S.cur || S.answered || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(String(e.key).toLowerCase());
      if (k >= 0 && S.order && S.order[k] && !(e.target.matches && e.target.matches('input, textarea'))) { e.preventDefault(); answer(S.order[k].i); }
    });
  }
  const LevelTest = { open, load, history: () => hist().runs.slice(), last: () => hist().runs.slice(-1)[0] || null, _t: { verdict, levelQueue } };
  window.LevelTest = LevelTest;
})();
