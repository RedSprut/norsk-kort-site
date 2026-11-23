/* ============ 🧪 Тренировка в формате Norskprøven — our own tasks, timers per part, a score PER PART ============
 * ExamTrainer.open(setId?) — choose a set (A1–A2 / A2–B1) and a part: Lesing, Lytting, Skriving, Muntlig.
 *  - an honest banner: a training in the format of the test, not the official exam; the result guarantees nothing;
 *  - a timer per part: «короткий» (scaled to the number of our tasks), «как на экзамене» (official durations, see OFFICIAL)
 *    or none; when the time is up the part is checked as it is;
 *  - Lesing / Lytting: one right answer per question, an explanation for every answer (RU / UA); Lytting is said by the
 *    app's voices (each speaker his own, as many plays as the official test allows: twice up to B1);
 *  - Skriving / Muntlig: graded 0–12 by Prove's checker (js/prove.js: the AI when connected, else the offline grade);
 *    Muntlig: answer by voice (js/speech.js recorder, on the device) or typing; preparation + speaking timers;
 *  - scores are shown PER PART only (no combined «official» score); «Что подтянуть» links the weak skills to the app.
 * Data: data/exam-practice.json (our own texts and tasks). Results: localStorage 'nk-examtr'. CSS: css/practice.css.
 * Official facts (HK-dir, prove.hkdir.no, checked 2026-11): reading 75 min; listening 30–60 min, A1–B1 tasks are played
 * twice, B2 once; writing 90 min (A1–A2, A2–B1) or 120 min (B1–B2); the oral test about 20–25 min, usually in pairs.
 */
(function () {
  'use strict';
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  const DATA_URL = 'data/exam-practice.json';
  const KEY = 'nk-examtr';
  const PARTS = [
    { id: 'les', no: 'Lesing', ru: 'Чтение', ico: '📖' },
    { id: 'lytt', no: 'Lytting', ru: 'Аудирование', ico: '🎧' },
    { id: 'skriv', no: 'Skriving', ru: 'Письмо', ico: '✍️' },
    { id: 'munt', no: 'Muntlig', ru: 'Устная часть', ico: '🗣' },
  ];
  /** minutes «как на экзамене» (HK-dir): listening varies 30–60 → 40; the oral test ≈ 20–25 → 25 */
  const OFFICIAL = { les: 75, lytt: 40, skriv: 90, munt: 25 };
  const OFFICIAL_TXT = {
    les: 'на экзамене — 75 минут на всю часть',
    lytt: 'на экзамене — от 30 до 60 минут; задания A1–B1 звучат два раза, B2 — один',
    skriv: 'на экзамене — 90 минут (A1–A2 и A2–B1), 120 минут (B1–B2)',
    munt: 'на экзамене — около 20–25 минут, обычно вдвоём с другим кандидатом',
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, k, ms) => { if (window.UI && UI.toast) UI.toast(m, k || '', ms || 2600); };
  const mmss = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const num = n => (+n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  const words = t => (String(t || '').match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
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
    if (!j || !Array.isArray(j.sets) || !j.sets.length) throw new Error('empty');
    DATA = j;
    return DATA;
  }
  function st() {
    let o = null;
    try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { o = null; }
    if (!o || typeof o !== 'object' || Array.isArray(o)) o = {};
    if (!o.res || typeof o.res !== 'object') o.res = {};
    if (!['short', 'full', 'off'].includes(o.mode)) o.mode = 'short';
    if (o.lang !== 'uk') o.lang = 'ru';
    return o;
  }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* private mode */ } }
  const uk = () => st().lang === 'uk';

  /* ---------- pure: scoring and «что подтянуть» ---------- */
  /** questions of a part → [{ key, item, block }] */
  function questions(set, part) {
    const out = [];
    if (part === 'les') (set.les.texts || []).forEach(t => (t.items || []).forEach(q => out.push({ key: `${t.id}.${q.id}`, item: q, block: t })));
    if (part === 'lytt') (set.lytt.clips || []).forEach(c => (c.items || []).forEach(q => out.push({ key: `${c.id}.${q.id}`, item: q, block: c })));
    return out;
  }
  function scoreChoice(set, part, ans) {
    const qs = questions(set, part);
    let ok = 0; const weak = {};
    qs.forEach(q => { if (ans[q.key] === q.item.answer) ok++; else (q.item.skill || []).forEach(s => { weak[s] = (weak[s] || 0) + 1; }); });
    return { ok, max: qs.length, pct: qs.length ? ok / qs.length : 0, weak };
  }
  /** a skill → what in the app helps (only what exists in this build) */
  const HELP = {
    detalj: ['📰 Новости простым языком — главная мысль и детали', () => window.News && News.open()],
    hovedinnhold: ['📰 Новости простым языком — главная мысль и детали', () => window.News && News.open()],
    mening: ['📚 Книги и тексты — мнение автора, «почему»', () => window.Books && Books.open()],
    tall: ['🕐 Часы, числа и даты', () => window.Klokka && Klokka.open()],
    ord: ['🪜 Лестница уровней — нужные слова', () => window.Levels && Levels.open()],
    grammatikk: ['📐 Грамматика — таблицы и тренажёры', () => window.GramRef && GramRef.open()],
    v2: ['🧩 Порядок слов — тренажёр', () => window.OrdTrainer && OrdTrainer.open('wo')],
    lytting: ['🎭 Диалоги по ролям — слушать и понимать', () => window.Dialogs && Dialogs.open()],
    snakke: ['🗣 Произношение и речь', () => window.Speech && Speech.open()],
  };
  const TOPIC = { bolig: 'life-bolig', lege: 'life-lege', nav: 'life-nav', jobb: 'life-jobb-kontor', skole: 'life-skole', transport: 'life-transport', butikk: 'life-butikk', fritid: 'life-smalltalk' };
  const TOPIC_RU = { bolig: 'Жильё', lege: 'Врач и аптека', nav: 'NAV и учреждения', jobb: 'Работа', skole: 'Школа и детский сад', transport: 'Транспорт', butikk: 'Магазин и деньги', fritid: 'Свободное время и смолток' };
  function advice(set, res) {
    const weak = {};
    ['les', 'lytt'].forEach(p => { const r = res[p]; if (r && r.weak) Object.entries(r.weak).forEach(([k, n]) => { weak[k] = (weak[k] || 0) + n; }); });
    if (res.lytt && res.lytt.pct < 0.7) weak.lytting = (weak.lytting || 0) + 2;
    if (res.munt && res.munt.pct < 0.6) weak.snakke = (weak.snakke || 0) + 2;
    ['skriv', 'munt'].forEach(p => {
      const w = res[p] && res[p].weakest; if (!w) return;
      const k = w === 'syntax' || w === 'order' ? 'v2' : w === 'vocab' ? 'ord' : w === 'fluency' ? 'snakke' : w === 'task' || w === 'coherence' ? '' : 'grammatikk';
      if (k) weak[k] = (weak[k] || 0) + 2;
    });
    const list = Object.entries(weak).sort((a, b) => b[1] - a[1]);
    const acts = [], topics = [];
    list.forEach(([k]) => { if (HELP[k]) { if (acts.length < 4 && !acts.some(a => HELP[a][0] === HELP[k][0])) acts.push(k); } else if (TOPIC[k] && topics.length < 3) topics.push(k); });
    return { acts, topics };
  }

  /* ---------- the voice ---------- */
  let speakTok = 0;
  const stopVoice = () => { speakTok++; try { if (window.TTS && TTS.stop) TTS.stop(); } catch (e) { /* ignore */ } };
  async function sayLines(lines, onLine) {
    stopVoice();
    const my = ++speakTok;
    const who = [...new Set(lines.map(l => l.who))];
    for (let i = 0; i < lines.length; i++) {
      if (my !== speakTok) return false;
      if (onLine) onLine(i);
      if (!window.TTS || !TTS.speak) { await new Promise(r => setTimeout(r, 600 + lines[i].t.length * 55)); continue; }
      // 🎭 two or more speakers: each with a voice of their own (js/voices.js; no other voice → the same one, lower)
      let o = { place: 'dialogs', keep: i > 0 };
      if (who.length > 1 && window.Voices && Voices.speakerOpts) {
        try { o = Object.assign(o, Voices.speakerOpts('no', lines[i].who, who.slice(), 'dialogs')); } catch (e) { /* the usual voice */ }
      }
      try { await Promise.race([TTS.speak(lines[i].t, 'no', o), new Promise(r => setTimeout(r, 5000 + lines[i].t.length * 140))]); } catch (e) { /* no voice */ }
      await new Promise(r => setTimeout(r, 380));
    }
    if (onLine) onLine(-1);
    return my === speakTok;
  }

  /* ---------- grading the writing / speaking (Prove's checker) ---------- */
  async function grade(task, text, speech) {
    const core = window.Prove && Prove._core;
    if (!core || !core.gradeOffline) {
      const w = words(text), min = +task.minWords || 30;
      return { by: 'auto', total: Math.min(12, Math.round(12 * Math.min(1, w / min) * 0.6)), summary: 'Примерная оценка только по объёму текста.', errors: [], crit: {}, notes: {} };
    }
    const ai = (() => { try { return !!(window.AI && AI.chain && AI.call && AI.chain().length && core.aiPrompt); } catch (e) { return false; } })();
    if (ai) {
      try {
        const { system, user } = speech ? core.aiSpeakPrompt(task, text) : core.aiPrompt(task, text);
        const raw = await Promise.race([AI.call({ system, user, maxTokens: 2600, temperature: 0.2, quiet: true }), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 90000))]);
        let j = null; try { j = AI.parseJSON ? AI.parseJSON(raw) : null; } catch (e) { j = null; }
        if (!j || typeof j !== 'object') j = core.parseLoose(raw);
        const g = core.normAiGrade(j, text, speech ? 'speak' : 'write');
        if (g) return g;
      } catch (e) { /* offline grade below */ }
    }
    return speech ? core.gradeOffline(text, Object.assign({ minWords: task.level === 'A1' ? 25 : 40 }, task), { speech: true }) : core.gradeOffline(text, task);
  }
  const GRADE_MAX = () => (window.Prove && Prove._core && Prove._core.GRADE_MAX) || 12;
  function weakestCrit(g) {
    const core = window.Prove && Prove._core; if (!core || !g || !g.crit) return '';
    const CR = g.mode === 'speak' ? core.SPEAK_CRIT : core.CRIT;
    if (!Array.isArray(CR)) return '';
    return (CR.slice().sort((a, b) => (g.crit[a.id] || 0) / a.max - (g.crit[b.id] || 0) / b.max)[0] || {}).id || '';
  }

  /* ======================================================================= */
  async function open(setId) {
    loadCss();
    if (!window.UI || !UI.modal) return;
    let D;
    try { D = await load(); } catch (e) { toast('Не получилось загрузить задания — проверьте интернет', 'warn', 3500); return; }
    let timer = null, left = 0, part = null, set = D.sets.find(s => s.id === setId) || D.sets.find(s => s.id === st().set) || D.sets[0];
    let ans = {}, checked = false, texts = {}, grades = {}, plays = {}, recs = [];
    const stopTimer = () => { if (timer) clearInterval(timer); timer = null; };
    const cleanup = () => { stopTimer(); stopVoice(); recs.forEach(r => { try { if (r && r.stop) r.stop(); } catch (e) { /* ignore */ } }); recs = []; };
    const busy = () => part && !checked && (Object.keys(ans).length || Object.values(texts).some(t => t && t.trim()));
    const m = UI.modal({
      title: '🧪 Тренировка в формате Norskprøven', cls: 'wide et-modal', body: '<div class="et-wrap"></div>',
      onClose: cleanup,
      beforeClose: async () => {
        if (!busy()) return true;
        try { return UI.confirm ? !!(await UI.confirm('Закрыть тренировку? Ответы этой части не сохранятся.', { ok: 'Закрыть' })) : true; } catch (e) { return true; }
      },
    });
    const box = m.$('.et-wrap');
    const banner = `<div class="et-banner" role="note"><b>ℹ️ Это тренировка в формате Norskprøven, а не официальный экзамен.</b> Задания и тексты написаны для приложения; результат ничего не гарантирует на настоящем экзамене. Официальные пробные задания — на сайте <a href="https://prove.hkdir.no/norskprove-a1-b2" target="_blank" rel="noopener">HK-dir ↗</a>.</div>`;
    const minutesOf = p => (st().mode === 'full' ? OFFICIAL[p] : st().mode === 'off' ? 0 : +(set[p] && set[p].minutes) || OFFICIAL[p]);

    /* ---------- the menu: set, time mode, the four parts with their own results ---------- */
    function menu() {
      cleanup(); part = null;
      const s = st(), R = s.res[set.id] || {};
      const res = p => {
        const r = R[p.id]; if (!r) return '<span class="small muted">ещё не пробовали</span>';
        const val = p.id === 'les' || p.id === 'lytt' ? `${r.ok} из ${r.max}` : `${num(r.total)} из ${r.max}`;
        return `<span class="et-score ${r.pct >= 0.7 ? 'good' : r.pct >= 0.5 ? 'mid' : 'low'}">${val}</span><span class="small muted"> · ${esc(new Date(r.at).toLocaleDateString('ru-RU'))}</span>`;
      };
      const adv = advice(set, R);
      box.innerHTML = `${banner}
        <div class="et-row"><span class="small">Набор заданий:</span><div class="et-seg" role="group" aria-label="Набор заданий">${D.sets.map(x => `<button type="button" class="pd-chip ${x.id === set.id ? 'on' : ''}" data-et-set="${esc(x.id)}" aria-pressed="${x.id === set.id}">${esc(x.level || x.title)}</button>`).join('')}</div></div>
        <div class="et-row"><span class="small">Время:</span><div class="et-seg" role="group" aria-label="Таймер">
          <button type="button" class="pd-chip ${s.mode === 'short' ? 'on' : ''}" data-et-mode="short" aria-pressed="${s.mode === 'short'}" title="Время уменьшено пропорционально числу заданий в наборе">⏱ Короткое</button>
          <button type="button" class="pd-chip ${s.mode === 'full' ? 'on' : ''}" data-et-mode="full" aria-pressed="${s.mode === 'full'}" title="Столько, сколько дают на экзамене">⏱ Как на экзамене</button>
          <button type="button" class="pd-chip ${s.mode === 'off' ? 'on' : ''}" data-et-mode="off" aria-pressed="${s.mode === 'off'}">Без таймера</button></div>
          <span class="pd-lang" role="group" aria-label="Язык пояснений"><button type="button" class="pd-chip ${uk() ? '' : 'on'}" data-et-lang="ru" aria-pressed="${!uk()}">RU</button><button type="button" class="pd-chip ${uk() ? 'on' : ''}" data-et-lang="uk" aria-pressed="${uk()}">UA</button></span></div>
        <div class="et-parts">${PARTS.map(p => `<button type="button" class="et-part" data-et-part="${p.id}">
            <span class="et-part-ico" aria-hidden="true">${p.ico}</span><span class="et-part-t"><b>${p.no}</b> · ${p.ru}<small>${minutesOf(p.id) ? `⏱ ${minutesOf(p.id)} мин` : 'без таймера'} · ${OFFICIAL_TXT[p.id]}</small><span class="et-part-r">${res(p)}</span></span></button>`).join('')}</div>
        <p class="small muted">Каждая часть оценивается отдельно, как на настоящем экзамене: общего «официального» балла нет. Чтение и аудирование — число верных ответов; письмо и устная часть — примерная оценка из 12 (нейросеть, если подключена, иначе встроенная проверка).</p>
        ${adv.acts.length || adv.topics.length ? `<section class="et-adv"><h4>🎯 Что подтянуть</h4><div class="et-adv-l">
            ${adv.acts.map(k => `<button type="button" class="btn sm" data-et-help="${k}">${esc(HELP[k][0])}</button>`).join('')}
            ${adv.topics.map(k => `<button type="button" class="btn sm ghost" data-et-topic="${k}">🧭 Колода «${esc(TOPIC_RU[k])}»</button>`).join('')}</div></section>` : ''}
        <p class="tiny muted">Длительность частей на экзамене — по сведениям HK-dir (prove.hkdir.no), пересказано своими словами; правила могут меняться. Тексты и задания — собственный материал Norsk Kort.</p>`;
    }

    /* ---------- a part ---------- */
    function startPart(p) {
      part = p; ans = {}; checked = false; texts = {}; grades = {}; plays = {};
      const mins = minutesOf(p);
      left = mins * 60;
      draw();
      stopTimer();
      if (mins) {
        timer = setInterval(() => {
          if (!m.el.isConnected) { stopTimer(); return; }
          left--;
          const t = box.querySelector('[data-et-time]');
          if (t) { t.textContent = mmss(left); t.parentElement.classList.toggle('warn', left <= 60); }
          if (left === 300) toast('⏱ Осталось 5 минут', '', 2500);
          if (left <= 0) { stopTimer(); toast('⏱ Время вышло — проверяю то, что успели', 'warn', 3500); check(); }
        }, 1000);
      }
    }
    const L = (x, f) => (uk() && x[f + 'Uk'] ? x[f + 'Uk'] : x[f]);
    function qHtml(q, key) {
      const a = ans[key], it = q;
      return `<fieldset class="et-q" data-et-q="${esc(key)}"><legend lang="nb">${esc(it.q)}</legend>
        ${it.options.map((o, i) => `<label class="et-o ${checked ? (i === it.answer ? 'ok' : i === a ? 'bad' : '') : a === i ? 'on' : ''}"><input type="radio" name="et-${esc(key)}" value="${i}" ${a === i ? 'checked' : ''} ${checked ? 'disabled' : ''}><span lang="nb">${esc(o)}</span></label>`).join('')}
        ${checked ? `<div class="et-why small">${a === it.answer ? '✓ ' : a == null ? '— Нет ответа. ' : '✗ '}${esc(L(it, 'why') || '')}</div>` : ''}</fieldset>`;
    }
    function draw() {
      const P = PARTS.find(x => x.id === part), mins = minutesOf(part);
      const head = `<div class="et-bar"><button type="button" class="btn sm ghost" data-et="menu">‹ Все части</button><b>${P.ico} ${P.no} · ${P.ru}</b>
        ${mins && !checked ? `<span class="et-timer" role="timer" aria-label="Осталось времени">⏱ <span data-et-time>${mmss(left)}</span></span>` : ''}</div>`;
      let body = '';
      if (part === 'les') {
        body = set.les.texts.map(t => `<section class="et-block"><h4>${esc(t.title)} <small class="muted">${esc(t.level || '')}</small></h4><div class="et-text" lang="nb">${esc(t.text).replace(/\n/g, '<br>')}</div>
          ${t.items.map(q => qHtml(q, `${t.id}.${q.id}`)).join('')}</section>`).join('');
      } else if (part === 'lytt') {
        const maxPlays = +set.lytt.plays || 2;
        body = `<p class="small muted">Каждую запись можно прослушать ${maxPlays === 1 ? 'один раз' : `${maxPlays} раза`} — как на экзамене. Текст покажу после проверки.</p>` + set.lytt.clips.map(c => {
          const n = plays[c.id] || 0;
          return `<section class="et-block"><h4>${esc(c.title)} <small class="muted">${esc(c.level || '')}</small></h4>
            <div class="et-play"><button type="button" class="btn ${n ? '' : 'primary'}" data-et-play="${esc(c.id)}" ${n >= maxPlays && !checked ? 'disabled' : ''}>▶ ${n ? 'Ещё раз' : 'Слушать'}</button><span class="small muted">${checked ? '' : `прослушано ${n} из ${maxPlays}`}</span></div>
            ${checked ? `<details class="et-tr"><summary>Текст записи</summary>${c.lines.map(l => `<p><small class="muted">${esc(l.who)}:</small> <span lang="nb">${esc(l.t)}</span></p>`).join('')}</details>` : ''}
            ${c.items.map(q => qHtml(q, `${c.id}.${q.id}`)).join('')}</section>`;
        }).join('');
      } else if (part === 'skriv' || part === 'munt') {
        const sp = part === 'munt';
        body = (sp ? set.munt : set.skriv).tasks.map(t => {
          const g = grades[t.id], txt = texts[t.id] || '';
          return `<section class="et-block" data-et-task="${esc(t.id)}"><h4>${sp ? '🗣' : '✍️'} ${esc({ melding: 'Сообщение', bilde: 'Описание картинки', tema: 'Текст на тему', 'e-post': 'Электронное письмо', mening: 'Своё мнение', presentasjon: 'Рассказ о себе', samtale: 'Разговор' }[t.kind] || 'Задание')} <small class="muted">${esc(t.level || '')}</small></h4>
            <div class="et-prompt" lang="nb">${esc(t.prompt).replace(/\n/g, '<br>')}</div>
            <details class="small"><summary>Перевести задание</summary><p>${esc((uk() ? t.promptUk : t.promptRu) || t.promptRu || '').replace(/\n/g, '<br>')}</p></details>
            ${sp && Array.isArray(t.ask) && t.ask.length ? `<div class="small"><b>Экзаменатор может спросить:</b><ul lang="nb">${t.ask.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
            ${sp ? `<div class="et-sp"><span class="small muted">Подготовка ${t.prepSec || 30} с, ответ до ${mmss(t.speakSec || 90)}.</span> <button type="button" class="btn sm" data-et-prep="${esc(t.id)}" ${checked || g ? 'disabled' : ''}>⏱ Подготовиться</button><span class="et-sp-t small" data-et-sp-t="${esc(t.id)}"></span></div>
              <div class="et-rec" data-et-rec="${esc(t.id)}"></div>` : ''}
            <label class="et-ta"><span class="small muted">${sp ? 'Ваш ответ (распознанная речь появится здесь; можно и напечатать):' : `Ваш текст (${t.minWords || 40}–${t.maxWords || 150} слов):`}</span>
              <textarea class="input" rows="${sp ? 4 : 7}" lang="nb" spellcheck="false" data-et-text="${esc(t.id)}" ${g ? 'readonly' : ''}>${esc(txt)}</textarea></label>
            <div class="et-wc small muted" data-et-wc="${esc(t.id)}">Слов: ${words(txt)}</div>
            ${g ? gradeHtml(g, t) : `<button type="button" class="btn sm primary" data-et-grade="${esc(t.id)}">Оценить ${sp ? 'ответ' : 'текст'}</button>`}
          </section>`;
        }).join('');
      }
      const choice = part === 'les' || part === 'lytt';
      box.innerHTML = `${head}${body}
        <div class="et-foot">${checked ? resultHtml() : choice ? '<button type="button" class="btn primary" data-et="check">✓ Проверить часть</button>' : '<button type="button" class="btn primary" data-et="check">✓ Закончить часть и посчитать результат</button>'}</div>`;
      if (part === 'munt' && !checked && window.Speech && Speech.recorder) {
        (set.munt.tasks || []).forEach(t => {
          const el = box.querySelector(`[data-et-rec="${CSS.escape(t.id)}"]`); if (!el || grades[t.id]) return;
          try {
            recs.push(Speech.recorder(el, { maxMs: Math.min(60000, (t.speakSec || 90) * 1000), onText: heard => {
              if (!heard) return;
              texts[t.id] = ((texts[t.id] || '') + ' ' + heard).trim();
              const ta = box.querySelector(`[data-et-text="${CSS.escape(t.id)}"]`); if (ta) ta.value = texts[t.id];
              const wc = box.querySelector(`[data-et-wc="${CSS.escape(t.id)}"]`); if (wc) wc.textContent = `Слов: ${words(texts[t.id])}`;
            } }));
          } catch (e) { el.innerHTML = '<p class="small muted">Запись голоса здесь недоступна — напечатайте ответ.</p>'; }
        });
      }
    }
    function gradeHtml(g, t) {
      const max = GRADE_MAX();
      const errs = (g.errors || []).slice(0, 8);
      return `<div class="et-grade"><div><b class="et-score ${g.total >= 8 ? 'good' : g.total >= 5 ? 'mid' : 'low'}">${g.total} из ${max}</b> ${g.cefr ? `<span class="small muted">≈ ${esc(g.cefr)}</span>` : ''} <span class="small muted">${g.by === 'ai' ? `${BOT()} оценила нейросеть` : '⚙️ встроенная проверка (примерно)'}</span></div>
        ${g.summary ? `<p class="small">${esc(g.summary)}</p>` : ''}
        ${errs.length ? `<ul class="small et-errs">${errs.map(e => `<li><s lang="nb">${esc(e.frag)}</s> → <b lang="nb">${esc(e.fix)}</b>${e.why ? ` — ${esc(e.why)}` : ''}</li>`).join('')}</ul>` : ''}
        ${t.model ? `<details class="small"><summary>Пример ответа</summary><p lang="nb">${esc(t.model).replace(/\n/g, '<br>')}</p>${t.modelRu ? `<p class="muted">${esc(t.modelRu).replace(/\n/g, '<br>')}</p>` : ''}<button type="button" class="btn sm ghost" data-et-model="${esc(t.id)}">🔊 Послушать пример</button></details>` : ''}</div>`;
    }
    function resultHtml() {
      const r = (st().res[set.id] || {})[part]; if (!r) return '';
      const P = PARTS.find(x => x.id === part);
      const val = part === 'les' || part === 'lytt' ? `${r.ok} из ${r.max}` : `${num(r.total)} из ${r.max}`;
      return `<div class="et-res"><h4>${P.ico} ${P.no}: <span class="et-score ${r.pct >= 0.7 ? 'good' : r.pct >= 0.5 ? 'mid' : 'low'}">${val}</span></h4>
        <p class="small">${r.pct >= 0.85 ? 'Отлично — эта часть вам по силам.' : r.pct >= 0.7 ? 'Хорошо! Посмотрите пояснения к ошибкам.' : r.pct >= 0.5 ? 'Неплохо, но есть что подтянуть — см. «Что подтянуть» в списке частей.' : 'Пока трудно — это нормально. Начните с рекомендаций в списке частей.'}</p>
        <p class="tiny muted">Это результат только этой части и только на наших тренировочных заданиях.</p>
        <div class="et-acts"><button type="button" class="btn" data-et="menu">‹ К частям и рекомендациям</button><button type="button" class="btn ghost" data-et-part="${part}">↻ Пройти часть заново</button></div></div>`;
    }
    async function check() {
      if (checked || !part) return;
      stopTimer(); stopVoice();
      const s = st(); const R = s.res[set.id] = s.res[set.id] || {};
      if (part === 'les' || part === 'lytt') {
        const r = scoreChoice(set, part, ans);
        R[part] = { ok: r.ok, max: r.max, pct: r.pct, weak: r.weak, at: Date.now() };
      } else {
        const sp = part === 'munt', tasks = (sp ? set.munt : set.skriv).tasks;
        const foot = box.querySelector('.et-foot'); if (foot) foot.innerHTML = '<p role="status"><span class="spinner sm"></span> Оцениваю…</p>';
        for (const t of tasks) if (!grades[t.id]) { const txt = (texts[t.id] || '').trim(); grades[t.id] = words(txt) >= 3 ? await grade(t, txt, sp) : { by: 'auto', total: 0, summary: 'Нет ответа.', errors: [], crit: {} }; }
        if (!m.el.isConnected) return;
        const max = GRADE_MAX(), total = tasks.reduce((a, t) => a + (grades[t.id].total || 0), 0);
        const wk = {}; tasks.forEach(t => { const w = weakestCrit(grades[t.id]); if (w) wk[w] = (wk[w] || 0) + 1; });
        R[part] = { total: Math.round(total / tasks.length * 10) / 10, max, pct: total / (tasks.length * max), weakest: Object.entries(wk).sort((a, b) => b[1] - a[1]).map(x => x[0])[0] || '', at: Date.now() };
      }
      s.set = set.id; save(s);
      checked = true;
      recs.forEach(r => { try { if (r && r.stop) r.stop(); } catch (e) { /* ignore */ } }); recs = [];
      if (window.XP) XP.add('exam', 5 + Math.round(15 * R[part].pct), { key: `exam:${set.id}:${part}`, label: PARTS.find(x => x.id === part).no });
      draw();
      const res = box.querySelector('.et-res'); if (res && res.scrollIntoView) res.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    }
    async function gradeOne(id) {
      const sp = part === 'munt', t = (sp ? set.munt : set.skriv).tasks.find(x => x.id === id); if (!t) return;
      const txt = (texts[id] || '').trim();
      if (words(txt) < 3) { toast(sp ? 'Скажите или напечатайте хотя бы пару предложений' : 'Напишите хотя бы пару предложений', 'warn'); return; }
      const b = box.querySelector(`[data-et-grade="${CSS.escape(id)}"]`); if (b) { b.disabled = true; b.innerHTML = '<span class="spinner sm"></span> Оцениваю…'; }
      grades[id] = await grade(t, txt, sp);
      if (m.el.isConnected && part && !checked) { const y = (m.$('.modal-body') || {}).scrollTop; draw(); const mb = m.$('.modal-body'); if (mb && y) mb.scrollTop = y; }
    }
    function prep(id) {
      const t = set.munt.tasks.find(x => x.id === id); if (!t) return;
      const el = box.querySelector(`[data-et-sp-t="${CSS.escape(id)}"]`); if (!el) return;
      let phase = 'prep', s = t.prepSec || 30;
      const tick = () => {
        if (!el.isConnected || checked) { clearInterval(iv); return; }
        el.textContent = phase === 'prep' ? ` Подготовка: ${mmss(s)}` : ` Говорите: ${mmss(s)}`;
        if (--s < 0) {
          if (phase === 'prep') { phase = 'talk'; s = t.speakSec || 90; toast('🗣 Время отвечать — нажмите запись и говорите', '', 2800); }
          else { clearInterval(iv); el.textContent = ' Время ответа вышло.'; }
        }
      };
      const iv = setInterval(tick, 1000); tick();
    }
    menu();
    const ask = async (q, ok) => { try { return window.UI && UI.confirm ? !!(await UI.confirm(q, { ok: ok || 'Да' })) : true; } catch (e) { return true; } };
    box.addEventListener('click', async e => {
      const t = e.target;
      const g = s => t.closest(s);
      let x;
      if ((x = g('[data-et-set]'))) { set = D.sets.find(s => s.id === x.dataset.etSet) || set; const o = st(); o.set = set.id; save(o); menu(); return; }
      if ((x = g('[data-et-mode]'))) { const o = st(); o.mode = x.dataset.etMode; save(o); menu(); return; }
      if ((x = g('[data-et-lang]'))) { const o = st(); o.lang = x.dataset.etLang; save(o); if (part) draw(); else menu(); return; }
      if ((x = g('[data-et-part]'))) { cleanup(); startPart(x.dataset.etPart); const mb = m.$('.modal-body'); if (mb) mb.scrollTop = 0; return; }
      if ((x = g('[data-et-help]'))) { const h = HELP[x.dataset.etHelp]; if (h) { m.close(); setTimeout(() => { try { h[1](); } catch (er) { /* not in this build */ } }, 220); } return; }
      if ((x = g('[data-et-topic]'))) { const id = TOPIC[x.dataset.etTopic]; m.close(); setTimeout(() => { try { if (window.OrdTrainer) OrdTrainer.open('decks', { focus: id }); } catch (er) { /* ignore */ } }, 220); return; }
      if ((x = g('[data-et-play]'))) {
        const c = set.lytt.clips.find(y => y.id === x.dataset.etPlay); if (!c) return;
        const maxPlays = +set.lytt.plays || 2;
        if (!checked) { if ((plays[c.id] || 0) >= maxPlays) return; plays[c.id] = (plays[c.id] || 0) + 1; }
        x.disabled = true;
        const lab = x.nextElementSibling; if (lab && !checked) lab.textContent = `прослушано ${plays[c.id]} из ${maxPlays}`;
        sayLines(c.lines).then(() => { if (x.isConnected) { x.disabled = !checked && (plays[c.id] || 0) >= maxPlays; x.textContent = '▶ Ещё раз'; x.classList.remove('primary'); } });
        return;
      }
      if ((x = g('[data-et-grade]'))) { gradeOne(x.dataset.etGrade); return; }
      if ((x = g('[data-et-prep]'))) { x.disabled = true; prep(x.dataset.etPrep); return; }
      if ((x = g('[data-et-model]'))) { const tk = (part === 'munt' ? set.munt : set.skriv).tasks.find(y => y.id === x.dataset.etModel); if (tk) sayLines([{ who: '', t: tk.model.replace(/\n+/g, ' ') }]); return; }
      if ((x = g('[data-et]'))) {
        const a = x.dataset.et;
        if (a === 'menu') { if (busy() && !(await ask('Выйти из этой части? Ответы не сохранятся.', 'Выйти'))) return; menu(); const mb = m.$('.modal-body'); if (mb) mb.scrollTop = 0; }
        else if (a === 'check') {
          if (part === 'les' || part === 'lytt') { const n = questions(set, part).length - Object.keys(ans).length; if (n > 0 && !(await ask(`Без ответа осталось вопросов: ${n}. Всё равно проверить?`, 'Проверить'))) return; }
          check();
        }
      }
    });
    box.addEventListener('change', e => {
      const r = e.target.closest('input[type=radio]'); if (!r || checked) return;
      const q = r.closest('[data-et-q]'); if (!q) return;
      ans[q.dataset.etQ] = +r.value;
      q.querySelectorAll('.et-o').forEach(l => l.classList.toggle('on', l.contains(r)));
    });
    box.addEventListener('input', e => {
      const ta = e.target.closest('[data-et-text]'); if (!ta) return;
      texts[ta.dataset.etText] = ta.value;
      const wc = box.querySelector(`[data-et-wc="${CSS.escape(ta.dataset.etText)}"]`); if (wc) wc.textContent = `Слов: ${words(ta.value)}`;
    });
  }

  const ExamTrainer = { open, load, results: () => Object.assign({}, st().res), OFFICIAL, _t: { questions, scoreChoice, advice, HELP, TOPIC } };
  window.ExamTrainer = ExamTrainer;
})();
