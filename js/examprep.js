/* ============ 🎓 «Подготовка к экзамену» (js/examprep.js + css/examprep.css, loaded on first use) ============
 * Norskprøven A1–B2: one window with its own pages (UI.modal; Back on the page head, Esc closes the window):
 *   🧱 Конструктор ответа  — каркас для каждого типа задания, связки, «собрать ответ», проверка ИИ или самопроверка + образец
 *   💬 Универсальные фразы — колода по функциям (схема data/phrasebook-decks.json), в карточки одним нажатием
 *   🗂 Темы                — слова (en/ei/et), вопросы, образцы ответов A2 / B1 / B2, «＋ слова в карточки»
 *   📐 Грамматика под задание — коротко, в сравнении с русским, со ссылкой в справочник (GramRef.open)
 *   🎧 Один диалог — много раз — слушать → вопросы → пропуски → разбор фраз → повтор за голосом (ASR) → свой ответ
 *   ✉️ Письмо-жалоба       — генератор ситуаций, обязательные части (видно, что уже есть), таймер, проверка
 *   🎤 Пробный устный экзамен — ИИ-партнёр (AI.call) или экзаменатор по сценарию; голос: TTS + распознавание (Speech)
 *   🧘 Перед экзаменом     — как проходит день (по HK-dir, своими словами), что взять, ссылки, дыхание 1 минута
 *   🗓 Учебные маршруты    — 6–8 недель × 3 занятия из модулей приложения, «Сегодня по маршруту» на главной, .ics
 * Content: data/examprep-core.json · examprep-topics.json · examprep-listen.json · examprep-phrases.json (own material).
 * State: Store.settings.examPrep = { track, start, done: {track: {sessKey: ts}}, seen: {track: {sessKey: [codes]}},
 *   plan: { days: [1..7], time: 'HH:MM', start: 'YYYY-MM-DD' }, drafts: {}, listen: {}, mock: {} }
 * API: window.ExamPrep = { open(view, arg), todayCardHtml(), homeMount(el), schedule(), icsText(), load() }
 *   document event 'examprep:schedule' (detail = schedule()) whenever the route or its plan changes — for a future planner.
 */
(function () {
  'use strict';
  const BOT = (size, o) => (window.App && App.robotSvg ? App.robotSvg(size, o) : '🤖'); // 🤖 the app's one brand robot (js/app.js App.robotSvg)
  const esc = s => U.esc(s == null ? '' : String(s));
  const $ = (r, s) => r.querySelector(s), $$ = (r, s) => [...r.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const toast = (t, k, ms) => { try { UI.toast(t, k || '', ms); } catch (e) { /* no UI */ } };
  const plural = (n, f) => (window.U && U.plural ? U.plural(n, f) : f[2]);
  const aiOn = () => { try { return !!(window.AI && AI.available && AI.available()); } catch (e) { return false; } };
  const FILES = { core: 'data/examprep-core.json', topics: 'data/examprep-topics.json', listen: 'data/examprep-listen.json', phrases: 'data/examprep-phrases.json' };
  const ver = () => ((((document.querySelector('script[src*="js/examprep.js"]') || {}).src) || '').match(/\?v=[^&#]+/) || [''])[0];

  /* ---------------- state ---------------- */
  const st = () => { const s = window.Store && Store.settings && Store.settings.examPrep; return s && typeof s === 'object' ? s : {}; };
  function save(patch) { const o = Object.assign({}, st(), patch); try { Store.setSetting('examPrep', o); } catch (e) { /* storage full */ } return o; }
  let saveT = 0;
  function saveSoon(patch) { const o = Object.assign({}, st(), patch); try { Store.settings.examPrep = o; } catch (e) { /* ignore */ } clearTimeout(saveT); saveT = setTimeout(() => save({}), 700); }
  /** translation language for the learner's side (Settings → «Язык перевода») */
  const trLang = () => (window.Store && Store.settings && Store.settings.transLang) || 'ru';
  const tr = o => { if (!o) return ''; const l = trLang(); if (l === 'uk' && o.uk) return o.uk; if (l === 'both' && o.uk && o.uk !== o.ru) return `${o.ru} · ${o.uk}`; return o.ru || ''; };

  /* ---------------- data ---------------- */
  let DATA = null, dataP = null;
  function load() {
    if (DATA) return Promise.resolve(DATA);
    if (dataP) return dataP;
    const q = ver();
    dataP = Promise.all(Object.keys(FILES).map(k => fetch(FILES[k] + q).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(j => [k, j])))
      .then(a => { const d = {}; a.forEach(([k, j]) => { d[k] = j; }); DATA = d; return d; });
    dataP.catch(() => { dataP = null; });
    return dataP;
  }
  const task = id => DATA.core.tasks.find(t => t.id === id);
  const topic = id => DATA.topics.topics.find(t => t.id === id);
  const gram = id => DATA.core.grammar.find(g => g.id === id);
  const dlg = id => DATA.listen.dialogues.find(d => d.id === id);
  const phrGroup = id => (DATA.phrases.groups || []).find(g => g.id === id);
  const track = id => DATA.core.tracks.find(t => t.id === id);

  /* ---------------- 🔊 voice (+ karaoke) ---------------- */
  let karTok = 0, KAR = null;
  function kar() {
    if (KAR || !window.TTS || !TTS.Karaoke) return KAR;
    try { KAR = new TTS.Karaoke({ name: 'xp', cls: 'xp-kmark', host: el => el.closest('.xp-kar') || el.parentElement }); } catch (e) { KAR = null; }
    return KAR;
  }
  function karClear() { if (KAR) try { KAR.clear(); } catch (e) { /* ignore */ } }
  function ttsStop() { karTok++; karClear(); try { if (window.TTS && TTS.stop) TTS.stop(); } catch (e) { /* ignore */ } }
  /** 🎭 the voice of a speaker of a dialogue (js/voices.js: the first speaker the usual voice of «Диалоги», the second
   *  another voice — the other gender when there is one —, a third / fourth further voices; «Разные голоса» off → one) */
  const twoVoices = () => !st().oneVoice && (!window.Voices || !Voices.rolesOn || Voices.rolesOn());
  function roleOf(who, roster) {
    if (!twoVoices() || !window.Voices || !Voices.speakerOpts) return null;
    try { const o = Voices.speakerOpts('no', who, roster.slice(), 'dialogs'); return o.voiceId || o.pitch ? o : null; } catch (e) { return null; }
  }
  async function say(text, o = {}) {
    text = String(text || '').replace(/[[\]]/g, '');
    if (!text.trim()) return;
    if (!window.TTS || !TTS.speak) { toast('Озвучка в этом браузере недоступна', 'warn'); await sleep(600); return; }
    // a speaker's own voice (o.role); if it cannot speak now, TTS says the line with the usual voice of «Диалоги»
    const opts = Object.assign({ place: 'dialogs' }, o.role || {});
    const tok = ++karTok, el = o.el;
    const K = el && el.textContent === text && TTS.wordsOf ? kar() : null;
    karClear();
    if (K) {
      opts.onWord = (i, a, b, info) => {
        if (tok !== karTok) return;
        if (!el.isConnected) { karClear(); return; }
        try { K.show([{ el, cur: info && info.done ? null : [a, b], done: info && info.done ? b : a }]); } catch (e) { karClear(); }
      };
    }
    await Promise.race([Promise.resolve().then(() => TTS.speak(text, 'no', opts)).catch(() => {}), sleep(5000 + text.length * 140)]);
    if (tok === karTok) { karTok++; karClear(); }
  }

  /* ---------------- ➕ cards (the ready-deck schema, the same installer as the deck catalogue) ---------------- */
  function install(deck, attribution, only) {
    try {
      if (window.OrdTrainer && typeof OrdTrainer.installDeck === 'function') {
        const r = OrdTrainer.installDeck(deck, attribution, only ? { only } : {});
        return r;
      }
    } catch (e) { console.warn('examprep install', e); }
    // fallback: a plain deck with the cards (provenance kept)
    const name = `${deck.icon || ''} ${deck.name}`.trim();
    let d = Store.decks().find(x => x.name === name);
    let created = false;
    if (!d) { d = Store.addDeck(name, `${deck.description || ''}\n\n${attribution || ''}`.trim()); created = true; }
    const have = new Set(Store.cards(d.id).map(c => String(c.no).trim().toLowerCase()));
    let added = 0;
    deck.cards.forEach(c => {
      if (only && !only.includes(c.key)) return;
      if (have.has(String(c.no).trim().toLowerCase())) return;
      const hist = window.Prov && Prov.entry ? [Prov.entry('manual', 'create', null, 'Norsk Kort — подготовка к экзамену (собственный материал)')] : [];
      Store.addCard(d.id, { no: c.no, ru: c.ru, uk: c.uk || '', description: c.description || '', wordClass: c.wordClass || '', tags: (deck.tags || []).concat(['norsk-kort']), history: hist });
      added++;
    });
    return { deck: d, created, added, updated: 0 };
  }
  function installed(r, what) {
    if (!r || !r.deck) { toast('Не получилось добавить карточки', 'warn'); return; }
    const n = r.added || 0;
    toast(n ? `${what}: ${n} ${plural(n, ['карточка', 'карточки', 'карточек'])} в колоде «${r.deck.name}»` : `Эти карточки уже есть в колоде «${r.deck.name}»`, n ? 'good' : '', 3200);
    try { if (window.App && App.view && App.view.name === 'home') setTimeout(() => App.render && App.render(), 50); } catch (e) { /* ignore */ }
  }
  const slug = s => String(s).toLowerCase().replace(/å/g, 'aa').replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  function topicDeck(t) {
    return { id: 'xp-topic-' + t.id, ver: 1, kind: 'phrase', group: 'phrasebook', icon: '🎓', name: `Экзамен: ${t.no}`, tags: ['norskprøven', 'tema'],
      description: `Слова к теме «${t.no}» (${t.ru}) для устной части Norskprøven.`,
      cards: t.words.map(w => ({ key: `xp:${t.id}:${slug(w.no)}`, no: w.no, ru: w.ru, uk: w.uk, wordClass: '', description: '' })) };
  }
  function listenDeck() {
    const cards = [];
    DATA.listen.dialogues.forEach(d => d.phrases.forEach(p => cards.push({ key: `xp:dlg:${d.id}:${slug(p.no)}`, no: p.no, ru: p.ru, uk: p.uk, wordClass: 'frase', description: `💡 Из диалога «${d.no}»` })));
    return { id: 'xp-listen', ver: 1, kind: 'phrase', group: 'phrasebook', icon: '🎓', name: 'Экзамен: фразы из диалогов', tags: ['frase', 'norskprøven'], description: 'Фразы из диалогов раздела «Подготовка к экзамену».', cards };
  }

  /* ---------------- ✅ checks without AI: concrete hints ---------------- */
  const FRONT = '(i dag|i går|i morgen|nå|i fritiden|om helgene?|om sommeren|om vinteren|derfor|etter min mening|for eksempel|til venstre|til høyre|i midten|likevel|dessuten|først|så|da|i tillegg|for det første|for det andre|alt i alt|kanskje|heldigvis|dessverre|på den ene siden|på den andre siden|i framtiden|før|etterpå|hjemme)';
  const SUBJ = '(jeg|du|han|hun|vi|dere|de|det|man|den)';
  function words(t) { return (String(t).match(/[A-Za-zÆØÅæøåÉéÜü-]+/g) || []).length; }
  function autoHints(text, t) {
    const out = [], s = String(text || '');
    const sents = s.replace(/([.!?])\s+/g, '$1\n').split(/\n+/).map(x => x.trim()).filter(Boolean);
    const n = words(s);
    if (t && t.words) out.push({ ok: n >= t.words, msg: n >= t.words ? `Объём: ${n} слов — хорошо` : `Объём: ${n} слов — для задания нужно хотя бы ${t.words}` });
    else out.push({ ok: n >= 40, msg: `Объём: ${n} ${plural(n, ['слово', 'слова', 'слов'])}${n < 40 ? ' — для устного ответа на 1–2 минуты нужно больше (40–120 слов)' : ''}` });
    const inv = sents.filter(x => new RegExp(`^${FRONT},?\\s+${SUBJ}\\s+(?!som\\b)[a-zæøå]+`, 'i').test(x));
    if (inv.length) out.push({ ok: false, msg: `Порядок слов (V2): «${inv[0].slice(0, 60)}…» — после «${inv[0].split(/\s+/).slice(0, 2).join(' ')}…» глагол должен идти раньше подлежащего: «I dag jobber jeg», а не «I dag jeg jobber».` });
    const sub = s.match(/\b(fordi|at|hvis|når|som|selv om|om)\s+(jeg|du|han|hun|vi|dere|de|det|man)\s+(har|er|kan|vil|må|skal|liker|jobber|bor|vet|får|går|ser|bruker|snakker|forstår)\s+ikke\b/i);
    if (sub) out.push({ ok: false, msg: `Придаточное: «${sub[0]}» → ikke ставится перед глаголом: «${sub[1]} ${sub[2]} ikke ${sub[3]}».` });
    const modA = s.match(/\b(vil|kan|må|skal|bør|kunne|ville|skulle)\s+å\s+[a-zæøå]+/i);
    if (modA) out.push({ ok: false, msg: `После модального глагола å не нужно: «${modA[0]}» → «${modA[0].replace(/\s+å\s+/i, ' ')}».` });
    const yr = s.match(/\bhar\s+(kommet|flyttet|begynt)\b[^.!?]*\bi\s+(19|20)\d\d\b/i);
    if (yr) out.push({ ok: false, msg: 'С годом (i 2022) нужен претерит: «Jeg kom til Norge i 2022», а не «har kommet».' });
    const conn = ['fordi', 'derfor', 'men', 'likevel', 'dessuten', 'for eksempel', 'i tillegg', 'selv om', 'når', 'hvis', 'alt i alt', 'først', 'etterpå'].filter(c => new RegExp(`\\b${c}\\b`, 'i').test(s));
    out.push({ ok: conn.length >= 3, msg: conn.length ? `Связки: ${conn.join(', ')}${conn.length < 3 ? ' — добавьте ещё одну-две' : ''}` : 'Связок нет — добавьте fordi, derfor, men, for eksempel' });
    const starts = sents.filter(x => /^jeg\b/i.test(x)).length;
    if (sents.length >= 4 && starts / sents.length > 0.7) out.push({ ok: false, msg: 'Почти все предложения начинаются с «Jeg» — начните пару фраз с времени или места (Om helgene liker jeg …).' });
    return out;
  }
  const hintsHtml = list => `<ul class="xp-hints">${list.map(h => `<li class="${h.ok ? 'ok' : 'bad'}"><span aria-hidden="true">${h.ok ? '✓' : '!'}</span><span>${esc(h.msg)}</span></li>`).join('')}</ul>`;

  /* ---------------- 🤖 AI ---------------- */
  async function aiJson(system, user, maxTokens = 1800) {
    const raw = await Promise.race([AI.call({ system, user, maxTokens, temperature: 0.2, quiet: true }), sleep(90000).then(() => { throw new Error('Нейросеть долго не отвечает — попробуйте ещё раз'); })]);
    let j = null;
    try { j = AI.parseJSON ? AI.parseJSON(raw) : JSON.parse(String(raw).replace(/^```(json)?|```$/g, '')); } catch (e) { j = null; }
    if (!j || typeof j !== 'object') throw new Error('Нейросеть ответила не в том формате — попробуйте ещё раз');
    return j;
  }
  const SYS = 'You are an experienced, kind but honest examiner for Norskprøven (the Norwegian Bokmål test, CEFR A1–B2), helping a learner whose first language is Russian or Ukrainian. Write every explanation in natural, idiomatic Russian (never calques from English or Norwegian). Norwegian corrections must be correct Bokmål. Respond with ONLY valid JSON, no markdown.';
  function aiResultHtml(j, o = {}) {
    const arr = x => (Array.isArray(x) ? x : []);
    const crit = arr(j.criteria).map(c => `<li><b>${esc(c.name || c.id)}</b> <span class="xp-score" aria-label="${esc(c.score)} из 5">${'●'.repeat(Math.max(0, Math.min(5, +c.score || 0)))}${'○'.repeat(5 - Math.max(0, Math.min(5, +c.score || 0)))}</span><br><small>${esc(c.note || '')}</small></li>`).join('');
    const steps = arr(j.steps).map(s => `<li class="${s.ok ? 'ok' : 'bad'}"><span aria-hidden="true">${s.ok ? '✓' : '!'}</span><span><b>${esc(s.step)}</b>${s.note ? ` — ${esc(s.note)}` : ''}</span></li>`).join('');
    const fixes = arr(j.fixes).slice(0, 10).map(f => `<li><span class="xp-wrong">${esc(f.wrong)}</span> → <span class="xp-right">${esc(f.right)}</span>${f.why ? `<small>${esc(f.why)}</small>` : ''}</li>`).join('');
    const tips = arr(j.tips).map(t => `<li>${esc(t)}</li>`).join('');
    return `<section class="xp-ai" aria-label="Разбор нейросети">
      <div class="xp-ai-h"><span class="xp-badge">${esc(j.level || '?')}</span><b>Разбор ${window.AI && AI.name ? esc(AI.name()) : 'ИИ'}</b></div>
      ${j.summary ? `<p>${esc(j.summary)}</p>` : ''}
      ${crit ? `<h4>Критерии</h4><ul class="xp-crit">${crit}</ul>` : ''}
      ${steps ? `<h4>По каркасу</h4><ul class="xp-hints">${steps}</ul>` : ''}
      ${fixes ? `<h4>Исправления</h4><ul class="xp-fixes">${fixes}</ul>` : ''}
      ${j.better ? `<h4>Как можно сказать лучше</h4><div class="xp-model xp-kar"><p class="xp-no-text" data-say-el>${esc(j.better).replace(/\n/g, '<br>')}</p><button type="button" class="btn sm" data-xsay-prev>🔊 Послушать</button></div>` : ''}
      ${tips ? `<h4>Советы</h4><ul class="xp-tips">${tips}</ul>` : ''}
      ${o.note ? `<p class="xp-note">${esc(o.note)}</p>` : ''}
    </section>`;
  }

  /* ---------------- the window ---------------- */
  let CTX = null;
  const VIEWS = {};
  function cleanup(ctx) {
    ttsStop();
    (ctx.stops || []).forEach(f => { try { f(); } catch (e) { /* ignore */ } });
    ctx.stops = [];
  }
  function live(ctx, t) { const l = ctx.m && ctx.m.el.querySelector('[data-xp-live]'); if (l) { l.textContent = ''; setTimeout(() => { l.textContent = t; }, 30); } }
  async function open(view, arg) {
    if (CTX && CTX.alive()) { if (view) go(CTX, view, arg); return CTX; }
    if (!(window.UI && UI.modal)) return null;
    const ctx = { hist: [], stops: [], closed: false, view: null };
    ctx.alive = () => !ctx.closed && ctx.m && ctx.m.el.isConnected;
    ctx.m = UI.modal({
      title: '🎓 Подготовка к экзамену', cls: 'wide xp-modal',
      body: '<div class="xp-root" data-xp><div class="xp-loading"><span class="spinner"></span> Загружаю материалы…</div></div><div class="xp-sr" role="status" aria-live="polite" data-xp-live></div>',
      onClose: () => { ctx.closed = true; cleanup(ctx); if (CTX === ctx) CTX = null; setTimeout(refreshHome, 120); },
    });
    ctx.root = ctx.m.el.querySelector('[data-xp]');
    ctx.root.addEventListener('click', e => onClick(ctx, e));
    CTX = ctx;
    try { await load(); } catch (e) {
      ctx.root.innerHTML = `<div class="xp-empty"><div class="xp-empty-i" aria-hidden="true">📡</div><p>Материалы не загрузились. Проверьте интернет и попробуйте ещё раз.</p><button type="button" class="btn primary" data-x="retry">Повторить</button></div>`;
      ctx.act = (k) => { if (k === 'retry') { ctx.m.close(); setTimeout(() => open(view, arg), 250); } };
      return ctx;
    }
    if (ctx.alive()) go(ctx, view || 'hub', arg, true);
    return ctx;
  }
  function go(ctx, name, arg, fresh) {
    if (!VIEWS[name]) name = 'hub';
    cleanup(ctx);
    if (fresh) ctx.hist = [];
    else if (ctx.view) ctx.hist.push(ctx.view);
    ctx.view = { name, arg: arg == null ? '' : String(arg) };
    render(ctx);
  }
  function back(ctx) {
    cleanup(ctx);
    const prev = ctx.hist.pop();
    ctx.view = prev || { name: 'hub', arg: '' };
    render(ctx);
  }
  function render(ctx) {
    const V = VIEWS[ctx.view.name];
    ctx.act = null; ctx.onInput = null;
    let html = '';
    try { html = V.html(ctx, ctx.view.arg); } catch (e) { console.warn('examprep render', e); html = '<p class="xp-note">Эта страница сейчас не открылась.</p>'; }
    const title = typeof V.title === 'function' ? V.title(ctx.view.arg) : V.title;
    const pr = window.PrintX && printOf(ctx) ? '<button type="button" class="btn sm xp-print" data-xprint aria-haspopup="dialog" title="Распечатать этот раздел или сохранить в Word">🖨 Печать</button>' : '';
    ctx.root.innerHTML = `<div class="xp-page">${ctx.view.name === 'hub' ? '' : `<div class="xp-nav"><button type="button" class="btn sm xp-back" data-xback aria-label="Назад">‹ Назад</button><h3 class="xp-title">${title}</h3>${pr}</div>`}${html}</div>`;
    ctx.page = ctx.root.firstElementChild;
    try { if (V.mount) V.mount(ctx, ctx.view.arg); } catch (e) { console.warn('examprep mount', e); }
    const body = ctx.m.el.querySelector('.modal-body'); if (body) body.scrollTop = 0;
    const h = ctx.root.querySelector('.xp-title'); if (h) { h.tabIndex = -1; try { h.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }
  function onClick(ctx, e) {
    const b = e.target.closest('button, a[data-x], [data-x]');
    if (!b || !ctx.root.contains(b)) return;
    if (b.hasAttribute('data-xback')) { back(ctx); return; }
    if (b.hasAttribute('data-xprint')) { const f = printOf(ctx); if (f) { ttsStop(); f(); } return; }
    if (b.dataset.xg) { go(ctx, b.dataset.xg, b.dataset.xa || ''); return; }
    if (b.dataset.xsay != null && b.dataset.xsay !== '') { const el = b.dataset.xel ? ctx.root.querySelector(b.dataset.xel) : null; say(b.dataset.xsay, { el }); return; }
    if (b.hasAttribute('data-xsay-prev')) { const el = b.parentElement.querySelector('[data-say-el]'); if (el) say(el.textContent, { el }); return; }
    if (b.dataset.xref) { if (window.GramRef && GramRef.open) GramRef.open(b.dataset.xref); return; }
    if (b.dataset.xstep) { runStep(ctx, b.dataset.xstep, b.dataset.xtrack, b.dataset.xsess); return; }
    if (b.dataset.x && ctx.act) ctx.act(b.dataset.x, b, e);
  }
  /** 🖨 «Печать и файлы» (js/printx.js) for the page shown now → a function that opens it, or null (nothing to print) */
  function printOf(ctx) {
    const P = window.PrintX; if (!P || !ctx.view) return null;
    const { name, arg } = ctx.view, id = String(arg || '').split('|')[0];
    const ex = x => ({ no: x.no, ru: x.ru, uk: x.uk });
    try {
      if (name === 'builder') {
        const t = id && task(id); if (!t) return null;
        return () => P.examprep({ icon: t.icon, ru: t.ru, uk: t.uk, no: t.no, levels: t.levels, time: t.time, what: t.what, steps: t.steps,
          words: (t.connectors || []).map(ex), questions: (t.prompts || []).map(ex), models: t.model ? [t.model] : null });
      }
      if (name === 'topic') { const t = topic(id); return t ? () => P.examprep(t) : null; }
      if (name === 'grammar') {
        const t = id && task(id), g1 = !t && id && gram(id);
        const list = t ? t.grammar.map(gram).filter(Boolean) : g1 ? [g1] : DATA.core.grammar;
        return () => P.examprep({ icon: '📐', ru: t ? `Грамматика: ${t.ru}` : g1 ? g1.ru : 'Грамматика под задание', text: list.map(g => `**${g.ru}** (${g.lvl}). ${g.text}`).join('\n\n'),
          ex: [].concat(...list.map(g => g.ex || [])).map(ex) });
      }
      if (name === 'phrases') { const d = DATA.phrases.decks[0]; return () => P.examprep({ icon: '💬', ru: 'Универсальные фразы', uk: 'Універсальні фрази', words: d.cards.map(ex) }); }
      if (name === 'listen') { const d = id && dlg(id); return d ? () => P.dialogue({ title: d.ru, titleNo: d.no, uk: d.uk, speakers: d.speakers, lines: d.lines }) : null; }
      if (name === 'complaint') { const c = ctx.c; return c ? () => P.examprep({ icon: c.icon, ru: c.ru, uk: c.uk, no: c.subject, text: `Кому: ${c.to}. Напишите письмо: что случилось, почему это проблема и чего вы хотите.`, happened: c.happened, problem: c.problem, want: c.want ? `Jeg ønsker ${c.want}.` : '' }) : null; }
      if (name === 'guide') {
        const G = DATA.core.guide, li = (h, a) => (a && a.length ? `**${h}**\n` + a.map(x => '• ' + (typeof x === 'string' ? x : x.ru)).join('\n') : '');
        return () => P.examprep({ icon: '🧘', ru: 'Перед экзаменом', text: [li('Как устроен Norskprøven', G.facts), li('Что взять с собой', G.bring), li('Что нельзя', G.rules), li('Как проходит день', G.day)].filter(Boolean).join('\n\n') });
      }
    } catch (e) { /* this page has nothing printable */ }
    return null;
  }
  /** a seg of buttons: aria-pressed + .active */
  const seg = (name, items, cur, label) => `<div class="seg xp-seg" role="group" aria-label="${esc(label)}">${items.map(([v, t]) => `<button type="button" data-x="${name}" data-v="${esc(v)}" class="${v === cur ? 'active' : ''}" aria-pressed="${v === cur}">${t}</button>`).join('')}</div>`;
  const sayBtn = (text, label = '🔊', sel = '') => `<button type="button" class="btn sm xp-say" data-xsay="${esc(text)}"${sel ? ` data-xel="${esc(sel)}"` : ''} aria-label="Послушать: ${esc(text)}" title="Послушать">${label}</button>`;

  /* ===================== 🏠 HUB ===================== */
  const TILES = [
    ['builder', '🧱', 'Конструктор ответа', 'каркас, связки, проверка'],
    ['phrases', '💬', 'Универсальные фразы', 'начать, взять паузу, мнение'],
    ['topics', '🗂', 'Темы для устной части', 'слова, вопросы, образцы A2–B2'],
    ['grammar', '📐', 'Грамматика под задание', 'только то, что нужно'],
    ['listen', '🎧', 'Один диалог — много раз', 'слушать, понять, повторить'],
    ['complaint', '✉️', 'Письмо-жалоба', 'ситуация, таймер, проверка'],
    ['mock', '🎤', 'Пробный устный экзамен', 'с ИИ-партнёром или по сценарию'],
    ['guide', '🧘', 'Перед экзаменом', 'как проходит день, дыхание'],
    ['tracks', '🗓', 'Учебные маршруты', '6–8 недель по 3 занятия'],
  ];
  VIEWS.hub = {
    title: 'Подготовка к экзамену',
    html() {
      const t = st().track && track(st().track);
      return `<div class="xp-hero"><span class="xp-hero-i" aria-hidden="true">🎓</span><div><h3>Norskprøven A1–B2</h3>
          <p>Каркасы ответов, темы, аудирование, письма и пробный устный экзамен. Учите «скелет» ответа и связки, а сам ответ каждый раз стройте заново — выученные наизусть тексты на экзамене считаются нарушением.</p></div></div>
        ${t ? todayInner(true) : ''}
        <div class="xp-grid">${TILES.map(([k, i, h, s]) => `<button type="button" class="xp-tile" data-xg="${k}"><span class="xp-tile-i" aria-hidden="true">${i}</span><span class="xp-tile-t"><b>${h}</b><small>${s}</small></span></button>`).join('')}</div>
        <div class="xp-soon"><span aria-hidden="true">🇳🇴</span><span><b>Statsborgerprøven и Samfunnskunnskap</b> — тренировка скоро. Ссылки на официальные пробные тесты — в разделе «Экзамены».</span>${window.Exams && Exams.open ? '<button type="button" class="btn sm" data-x="exams">Экзамены ›</button>' : ''}</div>
        <p class="xp-foot">${esc(DATA.core.attribution)}</p>`;
    },
    mount(ctx) { ctx.act = k => { if (k === 'exams') { ctx.m.close(); setTimeout(() => Exams.open(), 220); } }; },
  };

  /* ===================== 🧱 ANSWER BUILDER ===================== */
  VIEWS.builder = {
    title: a => { const t = a && task(String(a).split('|')[0]); return t ? `${t.icon} ${esc(t.ru)}` : '🧱 Конструктор ответа'; },
    html(ctx, arg) {
      const [id, given] = String(arg || '').split('|');
      const t = id && task(id);
      if (!t) {
        const card = x => `<button type="button" class="xp-row" data-xg="builder" data-xa="${x.id}"><span class="xp-row-i" aria-hidden="true">${x.icon}</span><span class="xp-row-t"><b>${esc(x.ru)}</b><small>${esc(x.no)} · ${esc(x.levels)} · ${esc(x.time)}</small></span><span class="xp-chev" aria-hidden="true">›</span></button>`;
        return `<p class="xp-lead">Выберите тип задания. Для каждого — каркас (вступление → пункты → пример → вывод), связки и поля, которые вы заполняете своими словами.</p>
          <h4 class="xp-h">🗣 Устная часть</h4><div class="xp-list">${DATA.core.tasks.filter(x => x.kind === 'oral').map(card).join('')}</div>
          <h4 class="xp-h">✍️ Письменная часть</h4><div class="xp-list">${DATA.core.tasks.filter(x => x.kind === 'written').map(card).join('')}</div>`;
      }
      ctx.task = t;
      const prompts = (t.prompts || []).map(p => ({ no: p.no, ru: p.ru }));
      if (t.scenes) t.scenes.forEach(s => prompts.push({ no: 'Beskriv bildet.', ru: tr(s), scene: true }));
      if (given) prompts.unshift({ no: given, ru: '' });
      ctx.prompts = prompts; ctx.pi = 0;
      const dr = (st().drafts || {})[t.id] || {};
      const lvl = dr.lvl || (/B1–B2/.test(t.levels) ? 'B2' : /A1–A2|A1–B1/.test(t.levels) ? 'A2' : 'B1');
      ctx.lvl = lvl;
      return `<div class="xp-thead"><p class="xp-no">${esc(t.no)} · ${esc(t.levels)} · ${esc(t.time)}${t.words ? ` · от ${t.words} слов` : ''}</p><p>${esc(t.what)}</p></div>
        <div class="xp-prompt xp-kar" data-prompt></div>
        <div class="xp-rowline"><span class="xp-lab">Уровень, на который целитесь:</span>${seg('lvl', [['A2', 'A2'], ['B1', 'B1'], ['B2', 'B2']], lvl, 'Целевой уровень')}</div>
        <ol class="xp-steps">${t.steps.map((s, i) => `<li class="xp-step"><div class="xp-step-h"><b>${esc(s.ru)}</b><small>${esc(s.hint)}</small></div>
          <div class="xp-chips" role="group" aria-label="Начала фраз: ${esc(s.ru)}">${s.starters.map(x => `<button type="button" class="xp-chip" data-x="ins" data-t="${esc(x)}" data-i="${i}">${esc(x)}</button>`).join('')}</div>
          <textarea class="input xp-ta" rows="2" data-step="${i}" aria-label="${esc(s.ru)} — ваш текст" placeholder="Напишите своими словами…" spellcheck="false" lang="nb">${esc((dr.steps || [])[i] || '')}</textarea></li>`).join('')}</ol>
        <div class="xp-conn"><span class="xp-lab">Связки (вставятся туда, где курсор):</span><div class="xp-chips">${t.connectors.map(c => `<button type="button" class="xp-chip xp-chip-c" data-x="conn" data-t="${esc(c.no)}" title="${esc(c.ru)}">${esc(c.no)} <small>${esc(c.ru)}</small></button>`).join('')}</div></div>
        <div class="xp-actions"><button type="button" class="btn" data-x="join">🧩 Собрать ответ из частей</button>${t.grammar && t.grammar.length ? `<button type="button" class="btn" data-xg="grammar" data-xa="${t.id}">📐 Грамматика для задания</button>` : ''}</div>
        <label class="xp-lab" for="xp-full">Ваш ответ целиком</label>
        <textarea class="input xp-full" id="xp-full" rows="${t.kind === 'written' ? 10 : 7}" data-full spellcheck="false" lang="nb" placeholder="Соберите ответ из частей или пишите сразу здесь${t.kind === 'oral' ? ' (или скажите вслух — 🎙)' : ''}…">${esc(dr.full || '')}</textarea>
        <div class="xp-meta" data-meta></div>
        <div class="xp-actions">
          <button type="button" class="btn primary" data-x="check">✅ Проверить</button>
          <button type="button" class="btn" data-x="read">🔊 Прочитать вслух</button>
          ${t.kind === 'oral' && window.Speech && Speech.recorder ? '<button type="button" class="btn" data-x="mic">🎙 Сказать вслух</button>' : ''}
          <button type="button" class="btn" data-x="model">📄 Образец</button>
        </div>
        <div class="xp-rec" data-rec hidden></div>
        <div data-out aria-live="polite"></div>`;
    },
    mount(ctx, arg) {
      const t = ctx.task; if (!t || !String(arg || '').split('|')[0]) return;
      const R = ctx.page, full = $(R, '[data-full]'), out = $(R, '[data-out]'), meta = $(R, '[data-meta]');
      let lastTa = null, rec = null;
      const showPrompt = () => {
        const p = ctx.prompts[ctx.pi] || null, box = $(R, '[data-prompt]');
        if (!p) { box.hidden = true; return; }
        box.innerHTML = `<span class="xp-lab">${p.scene ? 'Картинка (представьте её):' : 'Задание:'}</span>
          ${p.scene ? `<p class="xp-scene">🖼 ${esc(p.ru)}</p>` : `<p class="xp-no-text" data-say-el>${esc(p.no)}</p>${p.ru ? `<small>${esc(p.ru)}</small>` : ''}`}
          <div class="xp-actions">${p.scene ? '' : '<button type="button" class="btn sm" data-xsay-prev>🔊</button>'}${ctx.prompts.length > 1 ? '<button type="button" class="btn sm" data-x="nextp">🎲 Другое задание</button>' : ''}</div>`;
      };
      const upd = () => {
        const n = words(full.value);
        meta.textContent = `${n} ${plural(n, ['слово', 'слова', 'слов'])}${t.words ? ` из рекомендуемых ${t.words}+` : ''}`;
        meta.classList.toggle('ok', !!t.words && n >= t.words);
      };
      const store = () => {
        const d = Object.assign({}, st().drafts || {});
        d[t.id] = { steps: $$(R, '[data-step]').map(x => x.value), full: full.value, lvl: ctx.lvl };
        saveSoon({ drafts: d });
      };
      showPrompt(); upd();
      R.addEventListener('focusin', e => { if (e.target.matches('textarea')) lastTa = e.target; });
      R.addEventListener('input', e => { if (e.target.matches('textarea')) { if (e.target === full) upd(); store(); } });
      const insert = (ta, txt) => {
        const sel = ta === lastTa && ta.selectionStart != null;
        const s = sel ? ta.selectionStart : ta.value.length, en = sel ? ta.selectionEnd : s;
        const before = ta.value.slice(0, s), after = ta.value.slice(en);
        const clean = txt.replace(/\s*…\s*$/, ' ').replace(/…/g, '');
        const pre = before && !/\s$/.test(before) ? ' ' : '';
        ta.value = before + pre + clean + after;
        const pos = (before + pre + clean).length;
        ta.focus(); try { ta.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
        if (ta === full) upd();
        store();
      };
      ctx.stops.push(() => { if (rec && rec.stop) try { rec.stop(); } catch (e) { /* ignore */ } store(); });
      ctx.act = async (k, b) => {
        if (k === 'ins') insert($(R, `[data-step="${b.dataset.i}"]`), b.dataset.t);
        else if (k === 'conn') { const ta = lastTa || full; lastTa = ta; insert(ta, b.dataset.t); }
        else if (k === 'lvl') { ctx.lvl = b.dataset.v; $$(R, '[data-x="lvl"]').forEach(x => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on)); }); store(); }
        else if (k === 'nextp') { ctx.pi = (ctx.pi + 1) % ctx.prompts.length; showPrompt(); }
        else if (k === 'join') {
          const parts = $$(R, '[data-step]').map(x => x.value.trim()).filter(Boolean);
          if (!parts.length) { toast('Сначала заполните хотя бы одну часть', 'warn'); return; }
          full.value = parts.join(t.kind === 'written' ? '\n\n' : ' '); upd(); store(); full.focus();
          live(ctx, 'Ответ собран из частей');
        } else if (k === 'read') { if (!full.value.trim()) { toast('Пока нечего читать', 'warn'); return; } say(full.value); }
        else if (k === 'mic') {
          const box = $(R, '[data-rec]'); box.hidden = false;
          if (!rec) rec = Speech.recorder(box, { maxMs: 60000, onText: txt => { full.value = (full.value.trim() ? full.value.trim() + ' ' : '') + txt.trim(); upd(); store(); } });
          box.scrollIntoView({ block: 'nearest', behavior: reduce() ? 'auto' : 'smooth' });
        } else if (k === 'model') {
          out.innerHTML = modelHtml(t);
          out.scrollIntoView({ block: 'start', behavior: reduce() ? 'auto' : 'smooth' });
        } else if (k === 'check') {
          const text = full.value.trim() || $$(R, '[data-step]').map(x => x.value.trim()).filter(Boolean).join(' ');
          if (words(text) < 5) { toast('Напишите или скажите хотя бы пару предложений', 'warn'); return; }
          const p = ctx.prompts[ctx.pi] || {};
          if (aiOn()) {
            b.disabled = true; out.innerHTML = '<div class="xp-loading"><span class="spinner"></span> Нейросеть читает ваш ответ…</div>';
            try {
              const j = await aiJson(SYS, `Task type: ${t.no} (${t.ru}). Target level: ${ctx.lvl}. Task prompt: "${p.scene ? 'Describe this picture: ' + p.ru : p.no}".
Expected skeleton (steps in Russian): ${t.steps.map((s, i) => `${i + 1}) ${s.ru} — ${s.hint}`).join('; ')}.
${t.words ? `Recommended length: at least ${t.words} words.` : 'This is an oral answer (typed or transcribed speech): ignore punctuation and capital letters.'}
Learner's answer:
"""${text.slice(0, 4000)}"""
Return JSON: {"level":"estimated CEFR level of the answer","summary":"2–3 sentences in Russian: what is good and what matters most to fix","steps":[{"step":"<the step name in Russian exactly as given>","ok":true,"note":"short Russian comment"}],"fixes":[{"wrong":"exact fragment from the answer","right":"corrected Norwegian","why":"short Russian explanation; compare with Russian grammar when it helps"}],"better":"an improved version of the learner's answer in Norwegian at level ${ctx.lvl}, keeping the learner's own content and ideas","tips":["1–3 concrete tips in Russian"]}. At most 8 fixes, the most important first.`);
              if (!ctx.alive()) return;
              out.innerHTML = aiResultHtml(j, { note: 'ИИ может ошибаться — сверяйтесь с правилом в справочнике, если сомневаетесь.' }) + selfHtml(t, text, true);
            } catch (err) {
              if (!ctx.alive()) return;
              toast(U.niceErr ? U.niceErr(err) : String(err.message || err), 'warn', 4000);
              out.innerHTML = selfHtml(t, text);
            } finally { b.disabled = false; }
          } else out.innerHTML = selfHtml(t, text);
          out.scrollIntoView({ block: 'start', behavior: reduce() ? 'auto' : 'smooth' });
        } else if (k === 'showmodel') { out.insertAdjacentHTML('beforeend', modelHtml(t)); b.remove(); }
      };
    },
  };
  function modelHtml(t) {
    const m = t.model;
    return `<section class="xp-modelbox"><h4>📄 Образец (${esc(m.level)})</h4>
      <div class="xp-model xp-kar"><p class="xp-no-text" data-say-el>${esc(m.no).replace(/\n/g, '<br>')}</p><button type="button" class="btn sm" data-xsay-prev>🔊 Послушать</button></div>
      <details class="xp-tr"><summary>Перевод</summary><p>${esc(m.ru).replace(/\n/g, '<br>')}</p></details>
      <p class="xp-note">Образец — для разбора: посмотрите, как устроен каркас и где стоят связки. Не заучивайте его целиком — на экзамене нужен ваш собственный ответ.</p></section>`;
  }
  function selfHtml(t, text, withAi) {
    return `<section class="xp-self"><h4>${withAi ? '🔎 Быстрые подсказки приложения' : '🔎 Самопроверка'}</h4>
      ${withAi ? '' : `<p class="xp-note">${aiOn() ? '' : 'Нейросеть не подключена — проверьте себя по списку. (Подключить: Настройки → ИИ.)'}</p>`}
      ${hintsHtml(autoHints(text, t))}
      ${withAi ? '' : `<h4>Отметьте, что есть в ответе</h4><ul class="xp-check">${t.checklist.map((c, i) => `<li><label><input type="checkbox" id="xp-c${i}"> <span>${esc(c)}</span></label></li>`).join('')}</ul>
      <button type="button" class="btn" data-x="showmodel">📄 Сравнить с образцом</button>`}</section>`;
  }

  /* ===================== 💬 UNIVERSAL PHRASES ===================== */
  VIEWS.phrases = {
    title: '💬 Универсальные фразы',
    html(ctx, arg) {
      const deck = DATA.phrases.decks[0], groups = DATA.phrases.groups;
      const byKey = {}; deck.cards.forEach(c => { byKey[c.key] = c; });
      const f = arg && groups.some(g => g.id === arg) ? arg : '';
      return `<p class="xp-lead">Фразы-«связки» для любого устного ответа. Они дают время подумать и делают речь связной. Само содержание ответа говорите своими словами.</p>
        <div class="xp-actions"><button type="button" class="btn primary" data-x="all">＋ Вся колода в карточки (${deck.cards.length})</button></div>
        <div class="xp-chips xp-filter" role="group" aria-label="Функция фразы"><button type="button" class="xp-chip ${f ? '' : 'on'}" data-x="f" data-v="" aria-pressed="${!f}">Все</button>${groups.map(g => `<button type="button" class="xp-chip ${f === g.id ? 'on' : ''}" data-x="f" data-v="${g.id}" aria-pressed="${f === g.id}">${g.icon} ${esc(g.ru)}</button>`).join('')}</div>
        ${groups.filter(g => !f || g.id === f).map(g => `<section class="xp-pgroup"><h4 class="xp-h">${g.icon} ${esc(tr(g))}</h4>
          ${g.keys.map(k => byKey[k]).filter(Boolean).map(c => `<div class="xp-ph"><span class="xp-kar"><b class="xp-no-text" data-say-el>${esc(c.no)}</b></span><span class="xp-ph-tr">${esc(tr(c))}</span>${c.description ? `<small>${esc(c.description)}</small>` : ''}
            <span class="xp-ph-b"><button type="button" class="btn sm" data-xsay-prev aria-label="Послушать: ${esc(c.no)}">🔊</button><button type="button" class="btn sm" data-x="one" data-k="${esc(c.key)}" aria-label="В карточки: ${esc(c.no)}" title="В карточки">＋</button></span></div>`).join('')}</section>`).join('')}
        <p class="xp-foot">${esc(DATA.phrases.attribution)}</p>`;
    },
    mount(ctx) {
      const deck = DATA.phrases.decks[0];
      ctx.act = (k, b) => {
        if (k === 'all') installed(install(deck, DATA.phrases.attribution), 'Добавлено');
        else if (k === 'one') { installed(install(deck, DATA.phrases.attribution, [b.dataset.k]), 'Добавлено'); b.textContent = '✓'; b.disabled = true; }
        else if (k === 'f') { ctx.view.arg = b.dataset.v; render(ctx); }
      };
    },
  };
  // the phrase rows use [data-xsay-prev] inside .xp-ph: the button's parent is .xp-ph-b — look one level up
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.xp-ph [data-xsay-prev]'); if (!b) return;
    e.stopPropagation();
    const el = b.closest('.xp-ph').querySelector('[data-say-el]'); if (el) say(el.textContent, { el });
  }, true);

  /* ===================== 🗂 TOPICS ===================== */
  VIEWS.topics = {
    title: '🗂 Темы для устной части',
    html() {
      return `<p class="xp-lead">Частые повседневные темы устной части. В каждой — слова с родом (en / ei / et), вопросы и образцы ответа на трёх уровнях.</p>
        <div class="xp-grid xp-grid-sm">${DATA.topics.topics.map(t => `<button type="button" class="xp-tile" data-xg="topic" data-xa="${t.id}"><span class="xp-tile-i" aria-hidden="true">${t.icon}</span><span class="xp-tile-t"><b>${esc(t.no)}</b><small>${esc(tr(t))}</small></span></button>`).join('')}</div>
        <p class="xp-note">Скоро: ${esc((DATA.topics.soon || []).join(', '))}.</p>`;
    },
  };
  VIEWS.topic = {
    title: a => { const t = topic(a); return t ? `${t.icon} ${esc(t.no)}` : 'Тема'; },
    html(ctx, id) {
      const t = topic(id); if (!t) return '<p class="xp-note">Тема не найдена.</p>';
      ctx.lv = 'B1';
      return `<p class="xp-lead">${esc(tr(t))}</p>
        <section><div class="xp-sec-h"><h4 class="xp-h">📒 Слова</h4><button type="button" class="btn sm primary" data-x="addw">＋ Слова в карточки</button></div>
          <ul class="xp-words">${t.words.map(w => `<li><button type="button" class="btn sm xp-say" data-xsay="${esc(w.no)}" aria-label="Послушать: ${esc(w.no)}">🔊</button><b>${esc(w.no)}</b><span>${esc(tr(w))}</span></li>`).join('')}</ul></section>
        <section><h4 class="xp-h">❓ Вопросы экзаменатора</h4>
          <ol class="xp-qs">${t.questions.map(q => `<li><div><b>${esc(q.no)}</b><small>${esc(q.ru)}</small></div><span class="xp-q-b">${sayBtn(q.no)}<button type="button" class="btn sm" data-xg="builder" data-xa="mening|${esc(q.no)}">Ответить ›</button></span></li>`).join('')}</ol></section>
        <section><h4 class="xp-h">📄 Образцы ответа на первый вопрос</h4>
          <div class="xp-rowline">${seg('lv', [['A2', 'A2'], ['B1', 'B1'], ['B2', 'B2']], 'B1', 'Уровень образца')}</div>
          <div data-model></div>
          <p class="xp-note">Сравните уровни: на A2 — короткие простые фразы, на B1 — причины и связки, на B2 — обобщения, контраст и сложные предложения. Не заучивайте — разберите, как сделано.</p></section>`;
    },
    mount(ctx, id) {
      const t = topic(id); if (!t) return;
      const box = $(ctx.root, '[data-model]');
      const show = () => { const m = t.models[ctx.lv]; box.innerHTML = `<div class="xp-model xp-kar"><p class="xp-no-text" data-say-el>${esc(m.no)}</p><button type="button" class="btn sm" data-xsay-prev>🔊 Послушать</button></div><details class="xp-tr"><summary>Перевод</summary><p>${esc(m.ru)}</p></details><p class="xp-meta">${words(m.no)} слов</p>`; };
      show();
      ctx.act = (k, b) => {
        if (k === 'lv') { ttsStop(); ctx.lv = b.dataset.v; $$(ctx.root, '[data-x="lv"]').forEach(x => { const on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', String(on)); }); show(); }
        else if (k === 'addw') installed(install(topicDeck(t), DATA.topics.attribution), 'Слова темы');
      };
    },
  };

  /* ===================== 📐 GRAMMAR FOR THE TASK ===================== */
  VIEWS.grammar = {
    title: '📐 Грамматика под задание',
    html(ctx, arg) {
      const t = arg && task(arg), g1 = !t && arg && gram(arg);
      const list = t ? t.grammar.map(gram).filter(Boolean) : g1 ? [g1] : DATA.core.grammar;
      const cur = t ? t.id : '';
      return `<p class="xp-lead">Только то, что нужно для конкретного задания, — коротко и в сравнении с русским. Подробности и упражнения — в справочнике.</p>
        <div class="xp-chips xp-filter" role="group" aria-label="Задание"><button type="button" class="xp-chip ${cur ? '' : 'on'}" data-xg="grammar" data-xa="" aria-pressed="${!cur}">Всё</button>${DATA.core.tasks.map(x => `<button type="button" class="xp-chip ${cur === x.id ? 'on' : ''}" data-xg="grammar" data-xa="${x.id}" aria-pressed="${cur === x.id}">${x.icon} ${esc(x.ru)}</button>`).join('')}</div>
        ${list.map(g => `<section class="xp-gram" id="xp-g-${g.id}"><h4><span aria-hidden="true">${g.icon}</span> ${esc(g.ru)} <span class="xp-badge">${esc(g.lvl)}</span></h4>
          <p>${esc(g.text)}</p>
          <ul class="xp-ex">${g.ex.map(x => `<li>${sayBtn(x.no)}<span><b>${esc(x.no)}</b><small>${esc(x.ru)}</small></span></li>`).join('')}</ul>
          ${window.GramRef && GramRef.open ? `<div class="xp-actions">${g.ref.map((r, i) => `<button type="button" class="btn sm" data-xref="${esc(r)}">📗 ${i ? 'Ещё в справочнике' : 'Подробнее в справочнике'}</button>`).join('')}</div>` : ''}</section>`).join('')}`;
    },
    mount(ctx) { if (ctx.hist.length && ctx.hist[ctx.hist.length - 1].name === 'grammar') ctx.hist.pop(); },
  };

  /* ===================== 🎧 LISTENING LOOP ===================== */
  const LSTEPS = ['Слушаем', 'Вопросы', 'Пропуски', 'Разбор фраз', 'Повторяем', 'Ваш ответ'];
  const lineText = l => l.no.replace(/[[\]]/g, '');
  VIEWS.listen = {
    title: a => { const d = a && dlg(String(a).split('|')[0]); return d ? `${d.icon} ${esc(d.no)}` : '🎧 Один диалог — много раз'; },
    html(ctx, arg) {
      const [id, stepS] = String(arg || '').split('|');
      const d = id && dlg(id);
      const prog = st().listen || {};
      if (!d) {
        return `<p class="xp-lead">Один короткий диалог проходит шесть шагов: слушаем без текста → отвечаем на вопросы → заполняем пропуски → разбираем фразы → повторяем за голосом → отвечаем сами этими фразами. Так фразы переходят в вашу речь.</p>
          <div class="xp-list">${DATA.listen.dialogues.map(x => { const n = Math.min(6, prog[x.id] || 0); return `<button type="button" class="xp-row" data-xg="listen" data-xa="${x.id}"><span class="xp-row-i" aria-hidden="true">${x.icon}</span><span class="xp-row-t"><b>${esc(x.no)}</b><small>${esc(tr(x))} · ${x.level}</small></span><span class="xp-prog" aria-label="Пройдено шагов: ${n} из 6">${n}/6</span><span class="xp-chev" aria-hidden="true">›</span></button>`; }).join('')}</div>
          <p class="xp-foot">${esc(DATA.listen.attribution)}</p>`;
      }
      const step = Math.max(0, Math.min(5, +stepS || 0));
      ctx.d = d; ctx.step = step;
      const sp = id2 => d.speakers.find(s => s.id === id2) || {};
      const pills = `<ol class="xp-pills" aria-label="Шаги">${LSTEPS.map((s, i) => `<li><button type="button" class="xp-pill ${i === step ? 'on' : ''} ${i < (prog[d.id] || 0) ? 'done' : ''}" data-x="step" data-v="${i}" ${i === step ? 'aria-current="step"' : ''}>${i + 1}. ${s}</button></li>`).join('')}</ol>`;
      const voices = `<label class="xp-tog"><input type="checkbox" data-x2="two" ${twoVoices() ? 'checked' : ''}> 🎭 Разные голоса</label>${window.Voices && Voices.langButtons ? `<span class="xp-vb">${Voices.langButtons('dialogs')}</span>` : ''}`;
      const who = l => `<span class="xp-who xp-who-${l.who}">${esc(sp(l.who).name)}</span>`;
      let body = '';
      if (step === 0) body = `<p>Слушайте без текста. Кто говорит? Где они? О чём договорились?</p>
        <ul class="xp-spk">${d.speakers.map(s => `<li><span class="xp-who xp-who-${s.id}">${esc(s.name)}</span> — ${esc(tr(s))}</li>`).join('')}</ul>
        <div class="xp-now" data-now aria-live="polite"></div>
        <div class="xp-actions"><button type="button" class="btn primary" data-x="play">▶ Слушать диалог</button><button type="button" class="btn" data-x="stop">⏹ Стоп</button><button type="button" class="btn" data-x="next">Дальше ›</button></div>`;
      else if (step === 1) body = `<p>Ответьте на вопросы. Можно послушать ещё раз.</p>
        ${d.questions.map((q, qi) => `<fieldset class="xp-mc"><legend>${qi + 1}. ${esc(q.q)}</legend>${q.opts.map((o, oi) => `<label><input type="radio" name="xp-q${qi}" value="${oi}"> <span>${esc(o)}</span></label>`).join('')}<div class="xp-mc-r" data-r="${qi}"></div></fieldset>`).join('')}
        <div class="xp-actions"><button type="button" class="btn primary" data-x="checkq">Проверить</button><button type="button" class="btn" data-x="play">▶ Ещё раз</button><button type="button" class="btn" data-x="stop">⏹</button><button type="button" class="btn" data-x="next">Дальше ›</button></div>`;
      else if (step === 2) body = `<p>Послушайте ещё раз и впишите пропущенные слова.</p>
        <div class="xp-cloze">${d.lines.map((l, i) => `<p class="xp-line">${who(l)} <span>${esc(l.no).replace(/\[([^\]]+)\]/g, (m, w) => `<input class="input xp-gap" data-ans="${esc(w)}" aria-label="Пропуск в реплике ${i + 1}" size="${Math.max(4, w.length + 1)}" autocomplete="off" autocapitalize="off" spellcheck="false" lang="nb">`)}</span> ${sayBtnLine(i)}</p>`).join('')}</div>
        <div class="xp-actions"><button type="button" class="btn primary" data-x="checkg">Проверить</button><button type="button" class="btn" data-x="play">▶ Слушать</button><button type="button" class="btn" data-x="stop">⏹</button><button type="button" class="btn" data-x="next">Дальше ›</button></div>`;
      else if (step === 3) body = `<div class="xp-script">${d.lines.map((l, i) => `<div class="xp-line xp-kar">${who(l)} <p class="xp-no-text" data-li="${i}">${esc(lineText(l))}</p><small>${esc(tr(l))}</small></div>`).join('')}</div>
        <h4 class="xp-h">🧩 Фразы, которые стоит забрать себе</h4>
        ${d.phrases.map(p => `<div class="xp-ph"><span class="xp-kar"><b class="xp-no-text" data-say-el>${esc(p.no)}</b></span><span class="xp-ph-tr">${esc(tr(p))}</span><span class="xp-ph-b"><button type="button" class="btn sm" data-xsay-prev aria-label="Послушать: ${esc(p.no)}">🔊</button><button type="button" class="btn sm" data-x="addp" data-k="xp:dlg:${d.id}:${slug(p.no)}" aria-label="В карточки: ${esc(p.no)}" title="В карточки">＋</button></span></div>`).join('')}
        <div class="xp-actions"><button type="button" class="btn" data-x="play">▶ Слушать с текстом</button><button type="button" class="btn" data-x="stop">⏹</button><button type="button" class="btn" data-x="next">Дальше ›</button></div>`;
      else if (step === 4) {
        ctx.sh = ctx.sh || 0;
        body = `<p>Повторяйте за голосом: послушайте реплику, затем скажите её сами. Приложение покажет, какие слова прозвучали верно.</p>
          <div class="xp-shadow" data-sh></div>
          ${window.Speech && Speech.recorder ? '<div class="xp-rec" data-rec></div>' : '<p class="xp-note">Распознавание речи в этом браузере недоступно — повторяйте вслух сами.</p>'}
          <div data-res aria-live="polite"></div>
          <div class="xp-actions"><button type="button" class="btn" data-x="shprev">‹ Предыдущая</button><button type="button" class="btn" data-x="shplay">🔊 Ещё раз</button><button type="button" class="btn" data-x="shnext">Следующая ›</button><button type="button" class="btn primary" data-x="next">Дальше ›</button></div>`;
      } else body = `<div class="xp-prompt xp-kar"><span class="xp-lab">Ваша очередь:</span><p class="xp-no-text" data-say-el>${esc(d.task.no)}</p><small>${esc(d.task.ru)}</small><div class="xp-actions"><button type="button" class="btn sm" data-xsay-prev>🔊</button></div></div>
          <p class="xp-note">Постарайтесь использовать фразы из диалога: ${d.phrases.map(p => `<b>${esc(p.no)}</b>`).join(' · ')}</p>
          <textarea class="input xp-full" rows="6" data-full lang="nb" spellcheck="false" placeholder="Напишите или скажите ответ…">${esc(((st().listenAns || {})[d.id]) || '')}</textarea>
          <div class="xp-actions"><button type="button" class="btn primary" data-x="lcheck">✅ Проверить</button>${window.Speech && Speech.recorder ? '<button type="button" class="btn" data-x="mic">🎙 Сказать вслух</button>' : ''}<button type="button" class="btn" data-xg="listen" data-xa="">Другие диалоги</button></div>
          <div class="xp-rec" data-rec hidden></div><div data-out aria-live="polite"></div>`;
      return `<div class="xp-lhead">${pills}<div class="xp-voices">${voices}</div></div><div class="xp-lbody">${body}</div>`;
    },
    mount(ctx, arg) {
      const d = ctx.d; if (!d || !String(arg || '').split('|')[0]) return;
      const R = ctx.page;
      const mark = n => { const p = Object.assign({}, st().listen || {}); if ((p[d.id] || 0) < n) { p[d.id] = n; save({ listen: p }); } };
      mark(ctx.step);
      // the speakers in the order they first speak: the first one has the usual voice
      const roster = [];
      d.lines.concat(d.speakers.map(x => ({ who: x.id }))).forEach(l => { if (!roster.includes(l.who)) roster.push(l.who); });
      const voiceOf = l => roleOf(l.who, roster);
      let playing = 0;
      const play = async (withText) => {
        const tok = ++playing;
        ttsStop(); playing = tok;
        const now = $(R, '[data-now]');
        for (let i = 0; i < d.lines.length; i++) {
          if (tok !== playing || !ctx.alive()) return;
          const l = d.lines[i], sp = d.speakers.find(s => s.id === l.who) || {};
          if (now) now.innerHTML = `<span class="xp-who xp-who-${l.who}">${esc(sp.name)}</span> говорит… <span class="xp-dots" aria-hidden="true"></span>`;
          const el = withText ? $(R, `[data-li="${i}"]`) : null;
          await say(lineText(l), { role: voiceOf(l), el });
          if (tok !== playing) return;
          await sleep(350);
        }
        if (now && tok === playing) now.textContent = 'Конец диалога. Послушать ещё раз или идти дальше?';
      };
      ctx.stops.push(() => { playing++; });
      let rec = null;
      ctx.stops.push(() => { if (rec && rec.stop) try { rec.stop(); } catch (e) { /* ignore */ } });
      // the same switch as 🔊 Голоса → «Разные голоса в диалогах» (the old «Два голоса» of this page follows it)
      R.addEventListener('change', e => {
        if (!e.target.matches('[data-x2="two"]')) return;
        save({ oneVoice: false });
        if (window.Voices && Voices.setRolesOn) Voices.setRolesOn(e.target.checked); else save({ oneVoice: !e.target.checked });
      });
      // shadowing
      const shDraw = () => {
        const box = $(R, '[data-sh]'); if (!box) return;
        const i = ctx.sh % d.lines.length, l = d.lines[i], sp = d.speakers.find(s => s.id === l.who) || {};
        box.innerHTML = `<div class="xp-line xp-kar xp-big"><span class="xp-who xp-who-${l.who}">${esc(sp.name)}</span> <span class="xp-cnt">${i + 1} / ${d.lines.length}</span><p class="xp-no-text" data-li="sh">${esc(lineText(l))}</p><small>${esc(tr(l))}</small></div>`;
        const res = $(R, '[data-res]'); if (res) res.innerHTML = '';
      };
      if (ctx.step === 4) {
        ctx.sh = 0; shDraw();
        const rb = $(R, '[data-rec]');
        if (rb) rec = Speech.recorder(rb, { maxMs: 12000, onText: txt => {
          const l = d.lines[ctx.sh % d.lines.length], target = lineText(l);
          let r = null; try { r = Speech.compare(target, txt); } catch (e) { r = null; }
          const res = $(R, '[data-res]'); if (!res) return;
          if (!r) { res.innerHTML = `<p>Услышано: «${esc(txt)}»</p>`; return; }
          res.innerHTML = `<div class="xp-cmp"><b class="xp-badge ${r.score >= 80 ? 'good' : r.score >= 50 ? 'mid' : 'low'}">${r.score}%</b> ${r.items.map(x => `<span class="xp-w ${x.kind}">${esc(x.t)}</span>`).join(' ')}</div><p class="xp-note">Услышано: «${esc(txt)}»${r.score >= 80 ? ' — отлично!' : ' — послушайте ещё раз и повторите медленнее.'}</p>`;
        } });
        setTimeout(() => { const el = $(R, '[data-li="sh"]'); if (el && ctx.alive()) say(el.textContent, { el, role: voiceOf(d.lines[0]) }); }, 300);
      }
      ctx.act = async (k, b) => {
        if (k === 'step') { cleanup(ctx); ctx.view = { name: 'listen', arg: `${d.id}|${b.dataset.v}` }; render(ctx); }
        else if (k === 'next') { mark(ctx.step + 1); if (ctx.step < 5) { cleanup(ctx); ctx.view = { name: 'listen', arg: `${d.id}|${ctx.step + 1}` }; render(ctx); } }
        else if (k === 'play') play(ctx.step === 3);
        else if (k === 'stop') { playing++; ttsStop(); }
        else if (k === 'line') { const l = d.lines[+b.dataset.i]; say(lineText(l), { role: voiceOf(l) }); }
        else if (k === 'checkq') {
          let ok = 0;
          d.questions.forEach((q, qi) => {
            const v = (R.querySelector(`input[name="xp-q${qi}"]:checked`) || {}).value, r = $(R, `[data-r="${qi}"]`);
            const good = v != null && +v === q.a; if (good) ok++;
            r.className = 'xp-mc-r ' + (good ? 'ok' : 'bad');
            r.textContent = v == null ? `Ответ: ${q.opts[q.a]}` : good ? '✓ Верно' : `✗ Правильно: ${q.opts[q.a]}`;
          });
          live(ctx, `Верно ${ok} из ${d.questions.length}`); toast(`Верно ${ok} из ${d.questions.length}`, ok === d.questions.length ? 'good' : '');
        } else if (k === 'checkg') {
          let ok = 0; const gs = $$(R, '.xp-gap');
          const nrm = s => String(s).trim().toLowerCase().replace(/[.,!?]/g, '');
          gs.forEach(g => { const good = nrm(g.value) === nrm(g.dataset.ans); if (good) ok++; g.classList.toggle('ok', good); g.classList.toggle('bad', !good); if (!good) { g.title = `Правильно: ${g.dataset.ans}`; g.setAttribute('aria-label', `Пропуск: правильно «${g.dataset.ans}»`); } });
          const miss = gs.filter(g => g.classList.contains('bad')).map(g => g.dataset.ans);
          live(ctx, `Верно ${ok} из ${gs.length}`);
          toast(`Верно ${ok} из ${gs.length}${miss.length ? ` · правильно: ${miss.join(', ')}` : ''}`, ok === gs.length ? 'good' : '', 4500);
        } else if (k === 'addp') { installed(install(listenDeck(), DATA.listen.attribution, [b.dataset.k]), 'Добавлено'); b.textContent = '✓'; b.disabled = true; }
        else if (k === 'shplay') { const el = $(R, '[data-li="sh"]'); if (el) say(el.textContent, { el, role: voiceOf(d.lines[ctx.sh % d.lines.length]) }); }
        else if (k === 'shnext' || k === 'shprev') {
          ttsStop(); ctx.sh = (ctx.sh + (k === 'shnext' ? 1 : d.lines.length - 1)) % d.lines.length; shDraw();
          const el = $(R, '[data-li="sh"]'); if (el) say(el.textContent, { el, role: voiceOf(d.lines[ctx.sh]) });
        } else if (k === 'mic') {
          const box = $(R, '[data-rec]'); box.hidden = false;
          const full = $(R, '[data-full]');
          if (!rec) rec = Speech.recorder(box, { maxMs: 45000, onText: txt => { full.value = (full.value.trim() ? full.value.trim() + ' ' : '') + txt.trim(); } });
        } else if (k === 'lcheck') {
          const full = $(R, '[data-full]'), text = full.value.trim(), out = $(R, '[data-out]');
          const a = Object.assign({}, st().listenAns || {}); a[d.id] = text.slice(0, 2000); save({ listenAns: a });
          if (words(text) < 4) { toast('Ответьте хотя бы двумя-тремя предложениями', 'warn'); return; }
          const nrm = s => s.toLowerCase().replace(/[.,!?…]/g, '').replace(/\s+/g, ' ').trim();
          const used = d.phrases.filter(p => nrm(text).includes(nrm(p.no).split(' ').slice(0, 3).join(' ')));
          let html = `<section class="xp-self"><h4>🔎 Фразы из диалога</h4>${hintsHtml([{ ok: used.length >= 2, msg: used.length ? `Использовано: ${used.map(p => p.no).join(' · ')}` : 'Пока ни одной фразы из диалога — попробуйте вставить хотя бы две' }].concat(autoHints(text).slice(1)))}</section>`;
          if (aiOn()) {
            b.disabled = true; out.innerHTML = '<div class="xp-loading"><span class="spinner"></span> Нейросеть читает ваш ответ…</div>';
            try {
              const j = await aiJson(SYS, `Situation: "${d.task.no}" (${d.task.ru}). Level: ${d.level}. Useful phrases from the dialogue: ${d.phrases.map(p => p.no).join(' | ')}.
Learner's answer (typed or transcribed speech):
"""${text.slice(0, 3000)}"""
Return JSON: {"level":"estimated CEFR level","summary":"2–3 sentences in Russian","fixes":[{"wrong":"fragment","right":"corrected Norwegian","why":"short Russian explanation"}],"better":"improved Norwegian version at level ${d.level}, keeping the learner's ideas and using the phrases","tips":["1–2 tips in Russian"]}. At most 6 fixes.`, 1400);
              if (ctx.alive()) html = aiResultHtml(j) + html;
            } catch (err) { toast(U.niceErr ? U.niceErr(err) : String(err.message || err), 'warn', 4000); }
            finally { b.disabled = false; }
          }
          if (ctx.alive()) { out.innerHTML = html; mark(6); }
        }
      };
    },
  };
  const sayBtnLine = i => `<button type="button" class="btn sm xp-say" data-x="line" data-i="${i}" aria-label="Послушать реплику ${i + 1}">🔊</button>`;

  /* ===================== ✉️ COMPLAINT LETTER ===================== */
  VIEWS.complaint = {
    title: '✉️ Письмо-жалоба',
    html(ctx, arg) {
      const list = DATA.core.complaints, L = DATA.core.letter;
      const c = list.find(x => x.id === arg) || list[Math.floor(Math.random() * list.length)];
      ctx.c = c;
      const draft = (st().letters || {})[c.id] || '';
      return `<p class="xp-lead">Письменное задание A2–B1 и B1–B2: письмо, где вы высказываете мнение о проблеме и обосновываете его. От ${L.words} слов. Рядом с полем для текста видно, какие обязательные части в письме уже есть.</p>
        <div class="xp-rowline"><label class="xp-lab" for="xp-sit">Ситуация:</label><select class="input xp-sel" id="xp-sit" data-sit>${list.map(x => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${x.icon} ${esc(tr(x))}</option>`).join('')}</select><button type="button" class="btn sm" data-x="rand">🎲 Случайная</button></div>
        <div class="xp-sitcard"><div class="xp-sit-h"><span aria-hidden="true">${c.icon}</span><b>${esc(tr(c))}</b></div>
          <p>Кому: <b lang="nb">${esc(c.to)}</b>. Напишите письмо: что случилось (дата, подробности), почему это для вас проблема и чего вы хотите.</p>
          <details class="xp-tr"><summary>Факты для письма (по-норвежски)</summary><p lang="nb">${esc(c.happened)} ${esc(c.problem)}</p><p class="xp-note">Пересказывайте своими словами — не копируйте: на экзамене вставлять готовый текст нельзя.</p></details></div>
        <div class="xp-letter">
          <div class="xp-letter-main">
            <div class="xp-timer" data-timer><span class="xp-time" data-time aria-live="off">${L.minutes}:00</span><button type="button" class="btn sm" data-x="tstart">▶ Таймер ${L.minutes} мин</button><button type="button" class="btn sm" data-x="treset" aria-label="Сбросить таймер">↺</button></div>
            <textarea class="input xp-full" rows="14" data-full lang="nb" spellcheck="false" aria-label="Текст письма" placeholder="Emne: …&#10;&#10;Hei!&#10;&#10;Jeg skriver fordi …">${esc(draft)}</textarea>
            <div class="xp-meta" data-meta></div>
          </div>
          <aside class="xp-parts" aria-label="Обязательные части письма"><b>Обязательные части</b><ul data-parts></ul></aside>
        </div>
        <div class="xp-actions"><button type="button" class="btn primary" data-x="check">✅ Проверить</button><button type="button" class="btn" data-x="model">📄 Образец письма</button><button type="button" class="btn" data-xg="builder" data-xa="epost">🧱 Каркас письма</button></div>
        <div data-out aria-live="polite"></div>`;
    },
    mount(ctx) {
      const R = ctx.page, L = DATA.core.letter, c = ctx.c, full = $(R, '[data-full]'), parts = $(R, '[data-parts]'), meta = $(R, '[data-meta]'), out = $(R, '[data-out]');
      const upd = () => {
        const v = full.value;
        parts.innerHTML = L.parts.map(p => { let ok = false; try { ok = new RegExp(p.re, 'im').test(v); } catch (e) { ok = false; } return `<li class="${ok ? 'ok' : ''}"><span aria-hidden="true">${ok ? '✓' : '○'}</span> ${esc(p.ru)}<span class="xp-vh">${ok ? ' — есть' : ' — пока нет'}</span></li>`; }).join('');
        const n = words(v); meta.textContent = `${n} ${plural(n, ['слово', 'слова', 'слов'])} из ${L.words}+`; meta.classList.toggle('ok', n >= L.words);
      };
      upd();
      full.addEventListener('input', () => { upd(); const a = Object.assign({}, st().letters || {}); a[c.id] = full.value.slice(0, 5000); saveSoon({ letters: a }); });
      $(R, '[data-sit]').addEventListener('change', e => { ctx.view.arg = e.target.value; cleanup(ctx); render(ctx); });
      // ⏱ timer
      let left = L.minutes * 60, tm = 0;
      const time = $(R, '[data-time]'), tb = $(R, '[data-x="tstart"]');
      const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      const stopT = () => { clearInterval(tm); tm = 0; };
      ctx.stops.push(stopT);
      ctx.act = async (k, b) => {
        if (k === 'rand') { const others = DATA.core.complaints.filter(x => x.id !== c.id); ctx.view.arg = others[Math.floor(Math.random() * others.length)].id; cleanup(ctx); render(ctx); }
        else if (k === 'tstart') {
          if (tm) { stopT(); tb.textContent = '▶ Продолжить'; return; }
          if (left <= 0) left = L.minutes * 60;
          tb.textContent = '⏸ Пауза';
          tm = setInterval(() => {
            left--; time.textContent = fmt(Math.max(0, left));
            if (left === 300) { live(ctx, 'Осталось 5 минут'); toast('Осталось 5 минут — проверьте, есть ли все части письма'); }
            if (left <= 0) { stopT(); tb.textContent = '▶ Ещё раз'; live(ctx, 'Время вышло'); toast('Время вышло. Перечитайте письмо и нажмите «Проверить»', 'warn', 4000); time.classList.add('over'); }
          }, 1000);
        } else if (k === 'treset') { stopT(); left = L.minutes * 60; time.textContent = fmt(left); time.classList.remove('over'); tb.textContent = `▶ Таймер ${L.minutes} мин`; }
        else if (k === 'model') {
          const name = (Store.settings.userName || '').trim() || 'Olga Petrova';
          const txt = L.frame.replace('{subject}', c.subject).replace('{about}', c.about).replace('{happened}', c.happened).replace('{problem}', c.problem).replace('{want}', c.want).replace('{name}', name);
          out.innerHTML = `<section class="xp-modelbox"><h4>📄 Образец (B1)</h4><div class="xp-model xp-kar"><p class="xp-no-text" data-say-el style="white-space:pre-line">${esc(txt)}</p><button type="button" class="btn sm" data-xsay-prev>🔊 Послушать</button></div><p class="xp-note">Обратите внимание: тема, одна фраза «зачем пишу», факты с датой, мнение с «fordi / derfor», конкретная просьба и вежливое завершение. Своё письмо пишите своими словами.</p></section>`;
        } else if (k === 'check') {
          const text = full.value.trim();
          if (words(text) < 20) { toast('Письмо пока слишком короткое для проверки', 'warn'); return; }
          const self = `<section class="xp-self"><h4>🔎 Подсказки приложения</h4>${hintsHtml(L.parts.map(p => { let ok = false; try { ok = new RegExp(p.re, 'im').test(text); } catch (e) { ok = false; } return { ok, msg: `${p.ru}${ok ? '' : ' — не нашёл'}` }; }).concat(autoHints(text, { words: L.words })))}</section>`;
          if (!aiOn()) { out.innerHTML = self + '<p class="xp-note">Нейросеть не подключена — сравните своё письмо с образцом. (Подключить: Настройки → ИИ.)</p><button type="button" class="btn" data-x="model">📄 Показать образец</button>'; return; }
          b.disabled = true; out.innerHTML = '<div class="xp-loading"><span class="spinner"></span> Нейросеть проверяет письмо…</div>';
          try {
            const j = await aiJson(SYS, `Task: a complaint e-mail with opinion and reasons (Norskprøven writing, levels A2–B1 / B1–B2, at least 80 words). Recipient: ${c.to}. Situation: ${c.happened} ${c.problem}
Learner's letter:
"""${text.slice(0, 5000)}"""
Assess like a rater: does it answer the task (what happened, why it is a problem with reasons, a concrete request), text structure, vocabulary, grammar, spelling and punctuation.
Return JSON: {"level":"estimated CEFR level","summary":"2–3 sentences in Russian","criteria":[{"name":"Ответ на задание","score":1-5,"note":"Russian"},{"name":"Структура текста","score":1-5,"note":"Russian"},{"name":"Словарный запас","score":1-5,"note":"Russian"},{"name":"Грамматика","score":1-5,"note":"Russian"},{"name":"Орфография и пунктуация","score":1-5,"note":"Russian"}],"fixes":[{"wrong":"exact fragment","right":"corrected Norwegian","why":"short Russian explanation"}],"better":"an improved version of the learner's letter in Norwegian, same content","tips":["1–3 tips in Russian"]}. At most 8 fixes.`, 2200);
            if (ctx.alive()) out.innerHTML = aiResultHtml(j, { note: 'Это ориентир, а не официальная оценка.' }) + self;
          } catch (err) { toast(U.niceErr ? U.niceErr(err) : String(err.message || err), 'warn', 4000); if (ctx.alive()) out.innerHTML = self; }
          finally { b.disabled = false; }
        }
      };
    },
  };

  /* ===================== 🎤 MOCK ORAL EXAM ===================== */
  VIEWS.mock = {
    title: '🎤 Пробный устный экзамен',
    html(ctx, arg) {
      const M = DATA.core.mock, last = st().mock || {};
      const lvl = M.levels[arg] ? arg : (last.lvl && M.levels[last.lvl] ? last.lvl : 'a2b1');
      ctx.mk = { lvl, ai: aiOn() && last.ai !== false, voice: last.voice !== false, mic: !!last.mic };
      const L = M.levels[lvl];
      return `<p class="xp-lead">Как на настоящем экзамене: несколько заданий подряд, у каждого — примерное время. На экзамене вы будете вдвоём с другим кандидатом; здесь вашим партнёром будет ${aiOn() ? 'нейросеть' : 'сценарий'}.</p>
        <div class="xp-rowline"><span class="xp-lab">Уровень:</span>${seg('mlvl', Object.keys(M.levels).map(k => [k, M.levels[k].ru]), lvl, 'Уровень экзамена')}</div>
        <ol class="xp-plan">${L.parts.map(p => { const t = task(p.task); return `<li>${t.icon} <b>${esc(t.ru)}</b> <small>≈ ${p.min} мин</small></li>`; }).join('')}</ol>
        <div class="xp-opts">
          <label class="xp-tog"><input type="checkbox" data-o="ai" ${ctx.mk.ai ? 'checked' : ''} ${aiOn() ? '' : 'disabled'}> ${BOT()} Партнёр и экзаменатор — нейросеть${aiOn() ? '' : ' <small>(подключите ИИ в Настройках)</small>'}</label>
          <label class="xp-tog"><input type="checkbox" data-o="voice" ${ctx.mk.voice ? 'checked' : ''}> 🔊 Озвучивать вопросы</label>
          ${window.Speech && Speech.recorder ? `<label class="xp-tog"><input type="checkbox" data-o="mic" ${ctx.mk.mic ? 'checked' : ''}> 🎙 Отвечать голосом (распознавание на устройстве)</label>` : ''}
        </div>
        ${last.at ? `<p class="xp-note">Прошлая попытка: ${new Date(last.at).toLocaleDateString('ru-RU')} · ${esc(M.levels[last.lvl] ? M.levels[last.lvl].ru : '')}${last.level ? ` · оценка ИИ: ${esc(last.level)}` : ''}</p>` : ''}
        <div class="xp-actions"><button type="button" class="btn primary lg" data-x="start">▶ Начать экзамен</button></div>`;
    },
    mount(ctx) {
      const R = ctx.page;
      R.addEventListener('change', e => { const o = e.target.dataset && e.target.dataset.o; if (o) { ctx.mk[o] = e.target.checked; save({ mock: Object.assign({}, st().mock || {}, { [o]: e.target.checked }) }); } });
      ctx.act = (k, b) => {
        if (k === 'mlvl') { ctx.view.arg = b.dataset.v; render(ctx); }
        else if (k === 'start') { ctx.hist.push(ctx.view); ctx.view = { name: 'mockrun', arg: ctx.mk.lvl }; ctx.mkOpts = Object.assign({}, ctx.mk); cleanup(ctx); render(ctx); }
      };
    },
  };
  VIEWS.mockrun = {
    title: a => `🎤 Экзамен ${esc((DATA.core.mock.levels[a] || {}).ru || '')}`,
    html() {
      return `<div class="xp-mhead"><div><b data-mtitle></b><small data-msub></small></div><div class="xp-clock" data-clock aria-label="Время задания">0:00</div></div>
        <div class="xp-chat" data-chat aria-live="polite"></div>
        <div class="xp-answer">
          <textarea class="input xp-full" rows="4" data-ans lang="nb" spellcheck="false" aria-label="Ваш ответ" placeholder="Ваш ответ по-норвежски…"></textarea>
          <div class="xp-rec" data-rec hidden></div>
          <div class="xp-actions"><button type="button" class="btn primary" data-x="send">Ответить ›</button>${window.Speech && Speech.recorder ? '<button type="button" class="btn" data-x="mic">🎙 Голосом</button>' : ''}<button type="button" class="btn" data-x="nextpart">Следующее задание ›</button><button type="button" class="btn" data-x="finish">Закончить</button></div>
        </div>`;
    },
    mount(ctx, lvl) {
      const R = ctx.page, M = DATA.core.mock, L = M.levels[lvl] || M.levels.a2b1, opt = ctx.mkOpts || { voice: true };
      const chat = $(R, '[data-chat]'), ans = $(R, '[data-ans]'), clock = $(R, '[data-clock]');
      const run = { pi: -1, turns: 0, log: [], t0: 0, partner: 0, follow: 0, busy: false, ended: false };
      ctx.run = run;
      let tick = 0, rec = null;
      ctx.stops.push(() => { clearInterval(tick); if (rec && rec.stop) try { rec.stop(); } catch (e) { /* ignore */ } run.ended = true; });
      const part = () => L.parts[run.pi];
      const bubble = (who, no, ru) => {
        const div = document.createElement('div');
        div.className = `xp-msg xp-msg-${who}`;
        const name = who === 'you' ? 'Вы' : who === 'partner' ? 'Партнёр' : 'Экзаменатор';
        div.innerHTML = `<span class="xp-msg-w">${name}</span><div class="xp-kar"><p class="xp-no-text"${who === 'you' ? '' : ' data-say-el'}>${esc(no)}</p></div>${ru ? `<details class="xp-tr"><summary>Перевод</summary><p>${esc(ru)}</p></details>` : ''}${who === 'you' ? '' : '<button type="button" class="btn sm" data-xsay-prev aria-label="Послушать">🔊</button>'}`;
        chat.appendChild(div);
        div.scrollIntoView({ block: 'end', behavior: reduce() ? 'auto' : 'smooth' });
        run.log.push({ part: run.pi, who, no });
        if (who !== 'you' && opt.voice) { const el = div.querySelector('[data-say-el]'); say(no, { el, role: roleOf(who, ['examiner', 'partner']) }); }
      };
      const sys = () => `${SYS.replace(' Respond with ONLY valid JSON, no markdown.', '')} You run a mock Norskprøven oral test at level ${L.ru}. The candidate's partner is not present, so for pair tasks you play the other candidate (an adult learner, also not native, speaking natural simple Norwegian at about ${L.ru}). Keep every turn short (1–3 sentences), in Norwegian Bokmål only, at a level the candidate can understand. Do not correct the candidate during the test. Respond with ONLY valid JSON: {"reply":"your next turn in Norwegian","role":"examiner" or "partner","done":true when this task has had enough turns}.`;
      const startPart = () => {
        clearInterval(tick);
        run.pi++; run.turns = 0; run.partner = 0; run.follow = 0;
        if (run.pi >= L.parts.length) { finish(); return; }
        const p = part(), t = task(p.task);
        let q = p.q, ru = p.ru, scene = null;
        if (p.topic) { const tp = DATA.topics.topics[Math.floor(Math.random() * DATA.topics.topics.length)]; const qq = tp.questions[Math.floor(Math.random() * 3)]; q = qq.no; ru = qq.ru; run.topic = tp; }
        if (p.scene && t.scenes) scene = t.scenes[Math.floor(Math.random() * t.scenes.length)];
        run.q = q;
        $(R, '[data-mtitle]').textContent = `Задание ${run.pi + 1} из ${L.parts.length} · ${t.ru}`;
        $(R, '[data-msub]').textContent = ` ≈ ${p.min} мин`;
        const sep = document.createElement('div'); sep.className = 'xp-sep'; sep.textContent = `${t.icon} ${t.ru}`; chat.appendChild(sep);
        if (scene) { const s = document.createElement('p'); s.className = 'xp-scene'; s.textContent = '🖼 ' + tr(scene); chat.appendChild(s); run.scene = scene.ru; }
        bubble('examiner', q, ru);
        if (p.task === 'samtale') {
          const first = (p.partner || [])[0];
          if (first && !opt.ai) { setTimeout(() => { if (!run.ended) { bubble('partner', first, ''); run.partner = 1; } }, opt.voice ? 2600 : 400); }
        }
        run.t0 = Date.now();
        clock.classList.remove('over');
        tick = setInterval(() => { const s = Math.floor((Date.now() - run.t0) / 1000); clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; clock.classList.toggle('over', s > p.min * 60); }, 1000);
        ans.focus();
      };
      const nextScripted = () => {
        const p = part();
        if (p.task === 'samtale' && run.partner < (p.partner || []).length) { bubble('partner', p.partner[run.partner++], ''); return; }
        if (p.follow && run.follow < p.follow.length) { bubble('examiner', p.follow[run.follow++], ''); return; }
        bubble('examiner', run.pi + 1 < L.parts.length ? 'Takk. Da går vi videre.' : 'Takk, det var siste oppgave.', run.pi + 1 < L.parts.length ? 'Спасибо. Переходим дальше.' : 'Спасибо, это было последнее задание.');
        run.busy = true; // no answer while the next task is coming
        setTimeout(() => { run.busy = false; if (!run.ended) startPart(); }, opt.voice ? 2200 : 700);
      };
      const nextAi = async () => {
        const p = part(), t = task(p.task);
        run.busy = true;
        const wait = document.createElement('div'); wait.className = 'xp-msg xp-msg-wait'; wait.innerHTML = '<span class="spinner sm"></span>'; chat.appendChild(wait);
        try {
          const hist = run.log.filter(x => x.part === run.pi).map(x => `${x.who === 'you' ? 'CANDIDATE' : x.who.toUpperCase()}: ${x.no}`).join('\n');
          const j = await aiJson(sys(), `Current task ${run.pi + 1}/${L.parts.length}: ${t.no} — ${p.task === 'samtale' ? 'a pair conversation: you are the OTHER CANDIDATE; react, give your own opinion briefly and ask the candidate a question' : 'an individual task: you are the EXAMINER; ask one short follow-up question about what the candidate said'}. Planned length ≈ ${p.min} min. Turns so far in this task: ${run.turns}. ${run.scene ? `Picture (described to the candidate in Russian): ${run.scene}.` : ''}
Transcript of this task:
${hist}
Give the next turn. Set "done": true if the task has had about ${p.task === 'samtale' ? 4 : 2} candidate turns already.`, 500);
          wait.remove();
          if (run.ended) return;
          const reply = String(j.reply || '').slice(0, 400);
          if (reply && !(j.done && run.turns >= 2)) bubble(j.role === 'partner' || p.task === 'samtale' ? 'partner' : 'examiner', reply, '');
          else { bubble('examiner', run.pi + 1 < L.parts.length ? 'Takk. Da går vi videre.' : 'Takk, det var siste oppgave.', ''); run.wrap = true; setTimeout(() => { run.wrap = false; if (!run.ended) startPart(); }, opt.voice ? 2200 : 700); }
        } catch (err) {
          wait.remove();
          toast((U.niceErr ? U.niceErr(err) : String(err.message || err)) + ' — продолжаю по сценарию', 'warn', 4000);
          opt.ai = false; nextScripted();
        } finally { run.busy = false; }
      };
      const send = () => {
        const v = ans.value.trim();
        if (!v) { toast('Напишите или скажите ответ', 'warn'); return; }
        if (run.busy || run.wrap) return;
        ttsStop();
        bubble('you', v, ''); ans.value = ''; run.turns++;
        if (opt.ai) nextAi(); else nextScripted();
      };
      const finish = async () => {
        clearInterval(tick); run.ended = true; ttsStop();
        const mine = run.log.filter(x => x.who === 'you');
        const box = document.createElement('section'); box.className = 'xp-result';
        $(R, '.xp-answer').hidden = true;
        chat.appendChild(box);
        const allText = mine.map(x => x.no).join(' ');
        const stats = `<p class="xp-note">Ваших реплик: ${mine.length} · слов: ${words(allText)}${mine.length ? ` · в среднем ${Math.round(words(allText) / mine.length)} на ответ` : ''}</p>`;
        const save1 = extra => save({ mock: Object.assign({}, st().mock || {}, { at: Date.now(), lvl }, extra || {}) });
        if (!mine.length) { box.innerHTML = '<h4>Экзамен закончен</h4><p>Ответов не было — попробуйте ещё раз, хотя бы по паре фраз на задание.</p>'; return; }
        if (opt.ai && aiOn()) {
          box.innerHTML = '<div class="xp-loading"><span class="spinner"></span> Нейросеть оценивает ответы…</div>';
          try {
            const tx = run.log.map(x => `[task ${x.part + 1}: ${task(L.parts[x.part].task).no}] ${x.who === 'you' ? 'CANDIDATE' : x.who.toUpperCase()}: ${x.no}`).join('\n');
            const j = await aiJson(SYS, `Mock Norskprøven oral test, level ${L.ru}. Answers were typed or transcribed from speech (${opt.mic ? 'speech recognition was used — ignore punctuation; pronunciation can only be judged roughly from recognition errors' : 'typed — pronunciation cannot be judged'}).
Transcript:
${tx.slice(0, 7000)}
Assess the CANDIDATE only, using the official oral criteria: understandable answers to the task, fluency, vocabulary, grammar${opt.mic ? ', pronunciation' : ''}.
Return JSON: {"level":"estimated CEFR level","summary":"3 sentences in Russian","criteria":[{"name":"Ответ на вопрос","score":1-5,"note":"Russian"},{"name":"Беглость и связность","score":1-5,"note":"Russian"},{"name":"Словарный запас","score":1-5,"note":"Russian"},{"name":"Грамматика","score":1-5,"note":"Russian"}${opt.mic ? ',{"name":"Произношение (по распознаванию)","score":1-5,"note":"Russian"}' : ''}],"fixes":[{"wrong":"fragment","right":"corrected","why":"Russian"}],"tips":["3 concrete tips in Russian for the real exam"]}. At most 8 fixes.`, 2200);
            if (!ctx.alive()) return;
            box.innerHTML = '<h4>Результат</h4>' + aiResultHtml(j, { note: 'Это ориентир, а не официальная оценка. На экзамене оценивают двое проверяющих.' }) + stats + modelsHtml();
            save1({ level: String(j.level || '').slice(0, 10) });
            return;
          } catch (err) { toast(U.niceErr ? U.niceErr(err) : String(err.message || err), 'warn', 4000); }
        }
        box.innerHTML = `<h4>Оцените себя</h4><p class="xp-note">Без нейросети приложение не может оценить ответы — отметьте сами, как получилось, и сравните с образцами.</p>
          <div class="xp-selfscore">${M.criteria.map(c => `<fieldset><legend><b>${esc(c.ru)}</b> <small>${esc(c.hint)}</small></legend>${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="xp-s-${c.id}" value="${n}"> ${n}</label>`).join('')}</fieldset>`).join('')}</div>
          <h4>Подсказки приложения</h4>${hintsHtml(autoHints(allText))}${stats}${modelsHtml()}`;
        save1({ level: '' });
      };
      const modelsHtml = () => {
        const seen = new Set();
        return `<h4>Образцы к заданиям</h4>${L.parts.map(p => { const t = task(p.task); if (seen.has(t.id)) return ''; seen.add(t.id); return `<details class="xp-tr"><summary>${t.icon} ${esc(t.ru)}</summary><div class="xp-model xp-kar"><p class="xp-no-text" data-say-el style="white-space:pre-line">${esc(t.model.no)}</p><button type="button" class="btn sm" data-xsay-prev>🔊</button></div></details>`; }).join('')}${run.topic ? `<details class="xp-tr"><summary>${run.topic.icon} Тема «${esc(run.topic.no)}» — образец B1</summary><div class="xp-model xp-kar"><p class="xp-no-text" data-say-el>${esc(run.topic.models.B1.no)}</p><button type="button" class="btn sm" data-xsay-prev>🔊</button></div></details>` : ''}
          <div class="xp-actions"><button type="button" class="btn primary" data-xg="mock" data-xa="${lvl}">Ещё раз</button></div>`;
      };
      ans.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
      ctx.act = (k) => {
        if (k === 'send') send();
        else if (k === 'nextpart') { ttsStop(); if (!run.busy) startPart(); }
        else if (k === 'finish') finish();
        else if (k === 'mic') {
          const box = $(R, '[data-rec]'); box.hidden = false;
          if (!rec) rec = Speech.recorder(box, { maxMs: 60000, onText: txt => { ans.value = (ans.value.trim() ? ans.value.trim() + ' ' : '') + txt.trim(); ans.focus(); } });
        }
      };
      if (opt.mic && window.Speech && Speech.recorder) { const box = $(R, '[data-rec]'); box.hidden = false; rec = Speech.recorder(box, { maxMs: 60000, onText: txt => { ans.value = (ans.value.trim() ? ans.value.trim() + ' ' : '') + txt.trim(); } }); }
      startPart();
    },
  };

  /* ===================== 🧘 BEFORE THE EXAM ===================== */
  VIEWS.guide = {
    title: '🧘 Перед экзаменом',
    html() {
      const G = DATA.core.guide, li = a => a.map(x => `<li>${esc(x)}</li>`).join('');
      return `<section><h4 class="xp-h">📋 Как устроен Norskprøven</h4><ul class="xp-facts">${G.facts.map(f => `<li><span aria-hidden="true">${f.icon}</span><span>${esc(f.ru)}</span></li>`).join('')}</ul></section>
        <section><h4 class="xp-h">🪪 Что взять с собой</h4><ul class="xp-ul">${li(G.bring)}</ul></section>
        <section><h4 class="xp-h">🚫 Что нельзя</h4><ul class="xp-ul">${li(G.rules)}</ul></section>
        <section><h4 class="xp-h">🗓 Как проходит день</h4><ul class="xp-ul">${li(G.day)}</ul></section>
        <section class="xp-breath" id="xp-breath"><h4 class="xp-h">🌬 Дыхание: одна минута</h4>
          <p>Вдох на 4 счёта, выдох на 6 — шесть раз. Длинный выдох успокаивает сердцебиение. Можно сделать прямо в коридоре перед экзаменом.</p>
          <div class="xp-br-stage"><div class="xp-circle" data-circle aria-hidden="true"></div><div class="xp-br-txt" data-btxt aria-live="polite">Готовы?</div></div>
          <div class="xp-actions"><button type="button" class="btn primary" data-x="breath">▶ Начать (1 минута)</button><button type="button" class="btn" data-x="bstop">⏹ Стоп</button></div></section>
        <section><h4 class="xp-h">💙 Если волнуетесь</h4><ul class="xp-ul">${li(G.calm)}</ul></section>
        <section><h4 class="xp-h">🔗 Официальные ссылки (HK-dir)</h4><ul class="xp-links">${G.links.map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.ru)} ↗</a></li>`).join('')}</ul></section>
        <div class="xp-soon"><span aria-hidden="true">🇳🇴</span><span><b>Statsborgerprøven и Samfunnskunnskap</b> — раздел скоро.</span></div>
        <p class="xp-foot">${esc(G.source)}</p>`;
    },
    mount(ctx, arg) {
      const R = ctx.page, circle = $(R, '[data-circle]'), txt = $(R, '[data-btxt]');
      let timer = 0, alive = false;
      const stop = () => { alive = false; clearTimeout(timer); circle.className = 'xp-circle'; circle.style.transitionDuration = ''; txt.textContent = 'Готовы?'; };
      ctx.stops.push(stop);
      const phase = (cycle, inhale, sec) => {
        if (!alive) return;
        if (cycle >= 6) { alive = false; circle.className = 'xp-circle'; txt.textContent = 'Готово. Вы молодец 💙'; return; }
        const total = inhale ? 4 : 6;
        if (sec === total) {
          if (!reduce()) { circle.style.transitionDuration = total + 's'; circle.className = 'xp-circle ' + (inhale ? 'in' : 'out'); }
        }
        txt.textContent = `${inhale ? 'Вдох' : 'Выдох'} · ${sec}  (${cycle + 1} из 6)`;
        timer = setTimeout(() => {
          if (sec > 1) phase(cycle, inhale, sec - 1);
          else if (inhale) phase(cycle, false, 6);
          else phase(cycle + 1, true, 4);
        }, 1000);
      };
      ctx.act = k => { if (k === 'breath') { stop(); alive = true; phase(0, true, 4); } else if (k === 'bstop') stop(); };
      if (arg === 'breath') setTimeout(() => { const s = $(R, '#xp-breath'); if (s) s.scrollIntoView({ block: 'start' }); }, 60);
    },
  };

  /* ===================== 🗓 FREE TRACKS ===================== */
  const DAYN = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  function sessions(t) {
    const out = [], pick = (arr, w) => arr[w % arr.length];
    for (let w = 0; w < t.weeks; w++) {
      for (let s = 0; s < 3; s++) {
        const last = w === t.weeks - 1 && s === 2;
        const steps = last ? t.final.slice() : t.pattern[s].map(c => c.replace('{T}', pick(t.topics, w)).replace('{B}', pick(t.tasks, w)).replace('{G}', pick(t.gram, w)).replace('{L}', pick(t.listen, w)).replace('{P}', pick(t.phr, w)));
        out.push({ key: `w${w + 1}s${s + 1}`, week: w + 1, n: s + 1, steps });
      }
    }
    return out;
  }
  /** what one step of a session is: { ico, label, view?, arg?, app? } */
  function stepInfo(code) {
    const [k, a] = String(code).split(':');
    switch (k) {
      case 'topic': { const x = topic(a); return { ico: '🗂', label: `Тема «${x ? x.no : a}»: слова и вопросы`, view: 'topic', arg: a }; }
      case 'build': { const x = task(a); return { ico: '🧱', label: `Конструктор: ${x ? x.ru.toLowerCase() : a}`, view: 'builder', arg: a }; }
      case 'gram': { const x = gram(a); return { ico: '📐', label: `Грамматика: ${x ? x.ru : a}`, view: 'grammar', arg: a }; }
      case 'listen': { const x = dlg(a); return { ico: '🎧', label: `Аудирование: ${x ? x.ru.toLowerCase() : a}`, view: 'listen', arg: a }; }
      case 'phr': { const x = phrGroup(a); return { ico: '💬', label: `Фразы: ${x ? x.ru.toLowerCase() : a}`, view: 'phrases', arg: a }; }
      case 'complaint': return { ico: '✉️', label: 'Письмо-жалоба с таймером', view: 'complaint', arg: '' };
      case 'mock': return { ico: '🎤', label: 'Пробный устный экзамен', view: 'mock', arg: a };
      case 'guide': return { ico: '🧘', label: 'Перед экзаменом: что взять и как проходит день', view: 'guide', arg: '' };
      case 'breath': return { ico: '🌬', label: 'Дыхание: одна минута', view: 'guide', arg: 'breath' };
      case 'phraseday': return window.PhraseDay && typeof PhraseDay.open === 'function' ? { ico: '🌟', label: 'Фраза дня', app: 'phraseday' } : { ico: '💬', label: 'Повторить универсальные фразы', view: 'phrases', arg: '' };
      case 'app': return ({
        study: { ico: '🧠', label: 'Карточки на сегодня', app: 'study' },
        dialogs: { ico: '🎭', label: 'Диалоги по ролям', app: 'dialogs' },
        speech: { ico: '🗣', label: 'Произношение и диктант', app: 'speech' },
        news: { ico: '📰', label: 'Новости простым языком', app: 'news' },
        nrk: { ico: '📺', label: 'NRK TV с субтитрами', app: 'nrk' },
        radio: { ico: '📻', label: 'Радио NRK: 10 минут', app: 'nrkradio' },
        drills: { ico: '🏋️', label: 'Упражнения', app: 'drills' },
        reader: { ico: '📚', label: 'Чтение: книга или статья', app: 'books' },
      })[a] || { ico: '•', label: a, app: a };
      default: return { ico: '•', label: code };
    }
  }
  function runApp(key) {
    if (key === 'study') {
      if (!Store.cards().length) { if (window.Create) Create.open(); return; }
      const n = Math.max(5, (Store.settings.goal || 20) - (window.Progress ? Progress.todayCount() : 0));
      Study.start({ deckId: null, size: Store.settings.goalOn !== false ? n : undefined });
      return;
    }
    if (key === 'phraseday') { PhraseDay.open(); return; }
    if (window.Views && Views.go) Views.go(key);
  }
  function markSeen(tid, sk, code) {
    const seen = Object.assign({}, st().seen || {}); const ts = Object.assign({}, seen[tid] || {});
    const arr = (ts[sk] || []).slice(); if (!arr.includes(code)) arr.push(code);
    ts[sk] = arr; seen[tid] = ts;
    const patch = { seen };
    const t = track(tid), s = t && sessions(t).find(x => x.key === sk);
    if (s && s.steps.every(c => arr.includes(c)) && !((st().done || {})[tid] || {})[sk]) {
      const done = Object.assign({}, st().done || {}); done[tid] = Object.assign({}, done[tid] || {}, { [sk]: Date.now() }); patch.done = done;
      setTimeout(() => toast('Занятие маршрута выполнено 🎉', 'good'), 400);
    }
    save(patch);
    emit();
  }
  function runStep(ctx, code, tid, sk) {
    if (tid && sk) markSeen(tid, sk, code);
    const s = stepInfo(code);
    if (s.view) { if (ctx) go(ctx, s.view, s.arg); else open(s.view, s.arg); return; }
    if (s.app) {
      if (ctx && ctx.alive()) { ctx.m.close(); setTimeout(() => runApp(s.app), 240); } else runApp(s.app);
    }
  }
  function nextSession(t) {
    const done = (st().done || {})[t.id] || {};
    const all = sessions(t);
    return { all, next: all.find(s => !done[s.key]) || null, n: all.filter(s => done[s.key]).length };
  }
  function stepsHtml(t, s, seenArr) {
    return `<ul class="xp-ssteps">${s.steps.map(c => { const i = stepInfo(c), ok = seenArr.includes(c); return `<li><button type="button" class="xp-sstep ${ok ? 'ok' : ''}" data-xstep="${esc(c)}" data-xtrack="${t.id}" data-xsess="${s.key}"><span aria-hidden="true">${ok ? '✓' : i.ico}</span><span>${esc(i.label)}</span>${i.app ? '<small>откроется раздел приложения</small>' : ''}</button></li>`; }).join('')}</ul>`;
  }
  /** the «Сегодня по маршруту» card (inside the window when inModal, on home otherwise) */
  function todayInner(inModal) {
    const s0 = st(); const t = s0.track && DATA && track(s0.track); if (!t) return '';
    const { all, next, n } = nextSession(t);
    const pct = Math.round(n / all.length * 100);
    const bar = `<div class="xp-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Пройдено занятий: ${n} из ${all.length}"><i style="width:${pct}%"></i></div>`;
    if (!next) return `<section class="xp-today done"><div class="xp-today-h"><span aria-hidden="true">🏁</span><div><b>Маршрут «${esc(t.ru)}» пройден!</b><small>Все ${all.length} занятий. Удачи на экзамене!</small></div></div>${bar}<div class="xp-actions"><button type="button" class="btn" ${inModal ? 'data-xg="tracks"' : 'data-xp-home="tracks"'}>Выбрать новый маршрут</button></div></section>`;
    const seenArr = ((s0.seen || {})[t.id] || {})[next.key] || [];
    return `<section class="xp-today"><div class="xp-today-h"><span aria-hidden="true">${t.icon}</span><div><b>Сегодня по маршруту</b><small>«${esc(t.ru)}» · неделя ${next.week} из ${t.weeks}, занятие ${next.n} из 3 · пройдено ${n} из ${all.length}</small></div></div>${bar}
      ${inModal ? stepsHtml(t, next, seenArr) : `<ul class="xp-ssteps xp-ssteps-home">${next.steps.map(c => { const i = stepInfo(c), ok = seenArr.includes(c); return `<li><button type="button" class="xp-sstep ${ok ? 'ok' : ''}" data-xp-home="step" data-code="${esc(c)}" data-xsess="${next.key}"><span aria-hidden="true">${ok ? '✓' : i.ico}</span><span>${esc(i.label)}</span></button></li>`; }).join('')}</ul>`}
      <div class="xp-actions">${inModal ? '<button type="button" class="btn" data-xg="tracks">Весь маршрут ›</button>' : '<button type="button" class="btn" data-xp-home="tracks">Весь маршрут ›</button><button type="button" class="btn" data-xp-home="open">🎓 Подготовка к экзамену</button>'}</div></section>`;
  }
  VIEWS.tracks = {
    title: '🗓 Учебные маршруты',
    html(ctx) {
      const s0 = st(), t = s0.track && track(s0.track);
      const list = DATA.core.tracks.map(x => `<div class="xp-track ${t && t.id === x.id ? 'on' : ''}"><span class="xp-row-i" aria-hidden="true">${x.icon}</span><div class="xp-row-t"><b>${esc(x.ru)}</b><small>${esc(x.sub)} · ${x.weeks} ${plural(x.weeks, ['неделя', 'недели', 'недель'])} × 3 занятия</small></div>${t && t.id === x.id ? '<span class="xp-badge good">идёт</span>' : `<button type="button" class="btn sm" data-x="pick" data-v="${x.id}">Выбрать</button>`}</div>`).join('');
      if (!t) return `<p class="xp-lead">Бесплатные маршруты на 6–8 недель, по три занятия в неделю по 20–40 минут. Занятие собирается из разделов приложения: карточки, диалоги, новости, NRK — и из этой подготовки. На главной появится карточка «Сегодня по маршруту».</p><div class="xp-list">${list}</div>`;
      const { all, next, n } = nextSession(t), done = (s0.done || {})[t.id] || {}, seen = (s0.seen || {})[t.id] || {};
      const plan = Object.assign({ days: [1, 3, 6], time: '19:00', start: isoDay(new Date()) }, s0.plan || {});
      const weeks = [];
      for (let w = 1; w <= t.weeks; w++) weeks.push(all.filter(s => s.week === w));
      return `${todayInner(true)}
        <section><h4 class="xp-h">Весь маршрут · ${n} из ${all.length}</h4>
          ${weeks.map((ws, wi) => `<details class="xp-week" ${next && next.week === wi + 1 ? 'open' : ''}><summary>Неделя ${wi + 1} <small>${ws.filter(s => done[s.key]).length} / 3</small></summary>
            ${ws.map(s => `<div class="xp-sess ${done[s.key] ? 'done' : ''}"><div class="xp-sess-h"><b>Занятие ${s.n}</b><button type="button" class="btn sm" data-x="done" data-v="${s.key}" aria-pressed="${!!done[s.key]}">${done[s.key] ? '✓ Сделано' : 'Отметить сделанным'}</button></div>${stepsHtml(t, s, seen[s.key] || [])}</div>`).join('')}</details>`).join('')}
        </section>
        <section class="xp-cal"><h4 class="xp-h">📅 В календарь телефона</h4>
          <p class="xp-note">Выберите три дня и время — приложение сделает файл календаря с напоминанием за 15 минут. В каждом событии есть ссылка, которая открывает маршрут.</p>
          <div class="xp-chips" role="group" aria-label="Дни занятий">${[1, 2, 3, 4, 5, 6, 7].map(d => `<button type="button" class="xp-chip ${plan.days.includes(d) ? 'on' : ''}" data-x="day" data-v="${d}" aria-pressed="${plan.days.includes(d)}">${DAYN[d]}</button>`).join('')}</div>
          <div class="xp-rowline"><label class="xp-lab" for="xp-time">Время</label><input class="input xp-in" type="time" id="xp-time" data-time value="${esc(plan.time)}"><label class="xp-lab" for="xp-start">Начать с</label><input class="input xp-in" type="date" id="xp-start" data-start value="${esc(plan.start)}"></div>
          <div class="xp-actions"><button type="button" class="btn primary" data-x="ics">📅 Добавить в календарь телефона</button></div></section>
        <section><h4 class="xp-h">Другие маршруты</h4><div class="xp-list">${list}</div>
          <div class="xp-actions"><button type="button" class="btn" data-x="reset">Начать этот маршрут заново</button><button type="button" class="btn" data-x="quit">Убрать маршрут с главной</button></div></section>`;
    },
    mount(ctx) {
      const R = ctx.page;
      const plan = () => Object.assign({ days: [1, 3, 6], time: '19:00', start: isoDay(new Date()) }, st().plan || {});
      R.addEventListener('change', e => {
        if (e.target.matches('[data-time]') && /^\d\d:\d\d$/.test(e.target.value)) { save({ plan: Object.assign(plan(), { time: e.target.value }) }); emit(); }
        if (e.target.matches('[data-start]') && /^\d{4}-\d\d-\d\d$/.test(e.target.value)) { save({ plan: Object.assign(plan(), { start: e.target.value }) }); emit(); }
      });
      ctx.act = async (k, b) => {
        if (k === 'pick') {
          const cur = st().track;
          if (cur && cur !== b.dataset.v && UI.confirm && !(await UI.confirm('Сменить маршрут? Отметки текущего маршрута сохранятся — к нему можно вернуться.', { ok: 'Сменить' }))) return;
          save({ track: b.dataset.v, start: Date.now(), plan: Object.assign(plan(), { start: isoDay(new Date()) }) }); emit(); render(ctx);
          toast('Маршрут выбран — карточка «Сегодня по маршруту» появится на главной', 'good', 3500);
        } else if (k === 'done') {
          const tid = st().track, done = Object.assign({}, st().done || {}); const m = Object.assign({}, done[tid] || {});
          if (m[b.dataset.v]) delete m[b.dataset.v]; else m[b.dataset.v] = Date.now();
          done[tid] = m; save({ done }); emit(); render(ctx);
        } else if (k === 'day') {
          const p = plan(); const d = +b.dataset.v; let days = p.days.includes(d) ? p.days.filter(x => x !== d) : p.days.concat(d).sort();
          if (!days.length) days = [d];
          save({ plan: Object.assign(p, { days }) }); emit();
          b.classList.toggle('on', days.includes(d)); b.setAttribute('aria-pressed', String(days.includes(d)));
          if (days.length !== 3) toast(`Выбрано дней: ${days.length}. Маршрут рассчитан на 3 занятия в неделю — можно и иначе.`, '', 2600);
        } else if (k === 'ics') downloadIcs();
        else if (k === 'reset') {
          if (UI.confirm && !(await UI.confirm('Снять все отметки этого маршрута и начать с первой недели?', { ok: 'Начать заново', danger: true }))) return;
          const tid = st().track; const done = Object.assign({}, st().done || {}), seen = Object.assign({}, st().seen || {}); delete done[tid]; delete seen[tid];
          save({ done, seen, start: Date.now() }); emit(); render(ctx);
        } else if (k === 'quit') { save({ track: null }); emit(); render(ctx); toast('Маршрут убран с главной. Отметки сохранены.'); }
      };
    },
  };

  /* ---------------- 📅 schedule + .ics ---------------- */
  const pad = n => String(n).padStart(2, '0');
  const isoDay = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  /** the plan as data: the route's undone sessions on the chosen days (local wall-clock, meant for Europe/Oslo) */
  function schedule() {
    const s0 = st(); if (!s0.track || !DATA) return [];
    const t = track(s0.track); if (!t) return [];
    const plan = Object.assign({ days: [1, 3, 6], time: '19:00', start: isoDay(new Date()) }, s0.plan || {});
    const done = (s0.done || {})[t.id] || {};
    const left = sessions(t).filter(s => !done[s.key]);
    const [y, mo, da] = plan.start.split('-').map(Number), [hh, mm] = plan.time.split(':').map(Number);
    const d = new Date(y, mo - 1, da, hh, mm);
    const out = [];
    for (let guard = 0; out.length < left.length && guard < 400; guard++) {
      const wd = d.getDay() || 7;
      if (plan.days.includes(wd)) { const s = left[out.length]; out.push({ track: t.id, trackName: t.ru, key: s.key, week: s.week, n: s.n, title: `${t.ru}: неделя ${s.week}, занятие ${s.n}`, steps: s.steps.map(c => stepInfo(c).label), date: `${isoDay(d)}T${pad(hh)}:${pad(mm)}`, tz: 'Europe/Oslo', minutes: 40 }); }
      d.setDate(d.getDate() + 1);
    }
    return out;
  }
  function emit() { try { document.dispatchEvent(new CustomEvent('examprep:schedule', { detail: DATA ? schedule() : [] })); } catch (e) { /* ignore */ } }
  const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function fold(line) {
    // lines longer than 75 octets are folded (RFC 5545); counted in UTF-8 bytes, never inside a character
    const enc = new TextEncoder(); if (enc.encode(line).length <= 75) return line;
    const out = []; let cur = '', n = 0;
    for (const ch of line) { const b = enc.encode(ch).length; if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; n = 0; } cur += ch; n += b; }
    if (cur) out.push(cur);
    return out.join('\r\n ');
  }
  function icsText() {
    const ev = schedule();
    const link = /^https?:/.test(location.protocol) ? `${location.origin}${location.pathname}?open=exam-track` : '';
    const now = new Date(), stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
    const dt = iso => iso.replace(/[-:]/g, '') + '00';
    const end = (iso, min) => { const [a, b] = iso.split('T'); const [y, mo, d] = a.split('-').map(Number), [h, m] = b.split(':').map(Number); const x = new Date(y, mo - 1, d, h, m + min); return `${isoDay(x)}T${pad(x.getHours())}:${pad(x.getMinutes())}`; };
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Norsk Kort//Exam prep//RU', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Norsk Kort — подготовка к экзамену', 'X-WR-TIMEZONE:Europe/Oslo',
      'BEGIN:VTIMEZONE', 'TZID:Europe/Oslo', 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
      'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD', 'END:VTIMEZONE'];
    ev.forEach(e => {
      const desc = `Сегодня по маршруту:\n${e.steps.map(s => '• ' + s).join('\n')}${link ? `\n\nОткрыть маршрут: ${link}` : ''}`;
      L.push('BEGIN:VEVENT', `UID:xp-${e.track}-${e.key}-${dt(e.date)}@norsk-kort`, `DTSTAMP:${stamp}`, `DTSTART;TZID=Europe/Oslo:${dt(e.date)}`, `DTEND;TZID=Europe/Oslo:${dt(end(e.date, e.minutes))}`,
        `SUMMARY:${icsEsc('🎓 ' + e.title)}`, `DESCRIPTION:${icsEsc(desc)}`);
      if (link) L.push(`URL:${link}`);
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT15M', `DESCRIPTION:${icsEsc('Через 15 минут — норвежский по маршруту')}`, 'END:VALARM', 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }
  function downloadIcs() {
    const ev = schedule();
    if (!ev.length) { toast('В маршруте не осталось занятий для календаря', 'warn'); return; }
    try {
      const blob = new Blob([icsText()], { type: 'text/calendar;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'norsk-kort-marshrut.ics';
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      toast(`Файл календаря готов: ${ev.length} ${plural(ev.length, ['занятие', 'занятия', 'занятий'])}. Откройте его — телефон предложит добавить события.`, 'good', 4500);
    } catch (e) { toast('Не получилось создать файл календаря', 'warn'); }
  }

  /* ---------------- 🏠 home: «Сегодня по маршруту» ---------------- */
  function todayCardHtml() { return DATA ? todayInner(false) : ''; }
  function ensureCss() {
    if (document.querySelector('link[href*="css/examprep.css"]')) return;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/examprep.css' + ver(); document.head.appendChild(l);
  }
  /** fill the home mount: the route's card when a route is on (the static plaque stays otherwise) */
  async function homeMount(el) {
    if (!el || !st().track) return;
    ensureCss();
    try { await load(); } catch (e) { return; }
    const h = todayCardHtml();
    if (h && el.isConnected) { el.innerHTML = h; el.classList.add('xp-home-on'); }
  }
  function refreshHome() {
    const el = document.querySelector('[data-xp-home-mount]'); if (!el) return;
    if (st().track) homeMount(el);
    else if (el.classList.contains('xp-home-on') && window.App && App.render) App.render();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-xp-home]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const k = b.dataset.xpHome;
    if (k === 'open') open('hub');
    else if (k === 'tracks') open('tracks');
    else if (k === 'step') {
      const tid = st().track; const code = b.dataset.code;
      const s = stepInfo(code);
      if (s.view) { markSeen(tid, b.dataset.xsess, code); open('tracks').then(ctx => { if (ctx && ctx.alive()) go(ctx, s.view, s.arg); }); }
      else runStep(null, code, tid, b.dataset.xsess);
      setTimeout(refreshHome, 300);
    }
  }, true);

  ensureCss();
  window.ExamPrep = {
    open: (view, arg) => open(view || 'hub', arg),
    todayCardHtml, homeMount, schedule: () => (DATA ? schedule() : []), icsText: () => (DATA ? icsText() : ''), load,
    _t: { autoHints, sessions, stepInfo, words, fold },
  };
})();
