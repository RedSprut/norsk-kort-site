/* ============ 📗 Справочник грамматики — the public grammar reference (A1–B1, in Russian) ============
 * Data: data/grammar-reference.json (Norsk Kort's own text; books were only a checklist of topics).
 *   { version, groups: [{ id, icon, pos, ru, no }], topics: [{ id, group, level A1|A2|B1, no, ru, keys, rule, uk,
 *     tables: [{ title?, h: [headers], r: [[cells]], ru?: [Russian-only column indexes] }], ex: [[no, ru, uk?]],
 *     err: { t, bad?, good? }, tip?, see: [topic ids], train: [trainer ids] }] }
 *   A cell «Norwegian|Russian» shows the form with its translation and is read aloud on a tap (🔊 TTS.speak).
 *   A header «no · ru» is shown as a bilingual label (like Gram.label); a known term («Preteritum») goes through Gram.label.
 *   Text: **bold**, «\n» = new paragraph.
 *   Examples follow «Язык перевода» (Study.trLang): ru → Russian, uk → Ukrainian (Russian when a translation is missing),
 *   both → both lines. The search looks in all of them.
 *
 *   GramRef.open(topicId?)   → the window «📗 Справочник грамматики»: topics grouped by part of speech, search (Russian or
 *                              Norwegian), level filter A1/A2/B1; a topic: rule, tables, examples with 🔊, «типичная ошибка»,
 *                              «к тренажёру» buttons (only for trainers that exist here), see also, ‹ › to the next topic.
 *   GramRef.load()           → Promise<data | null>
 *   GramRef.TRAINERS         → the trainer ids a topic can point to
 * Entry points anywhere: <button data-gramref-open> (the list) or <button data-gramref-open="verb-passiv"> (one topic).
 * A topic «📗 Справочник грамматики» is added to the help centre (Help.TOPICS) at start.
 */
(function () {
  const DATA_URL = 'data/grammar-reference.json';
  let DATA = null, loading = null, cur = null;

  const esc = s => { try { return U.esc(s == null ? '' : String(s)); } catch (e) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); } };
  const toast = (msg, type) => { try { if (window.UI && UI.toast) UI.toast(msg, type || ''); } catch (e) { /* no toast */ } };
  const plural = (n, f) => { try { return U.plural(n, f); } catch (e) { return f[2]; } };
  const fold = s => String(s == null ? '' : s).toLowerCase().normalize('NFC').replace(/ё/g, 'е').replace(/[’ʼ`]/g, "'");
  const ascii = s => s.replace(/å/g, 'a').replace(/[øö]/g, 'o').replace(/[æä]/g, 'ae');
  const MSG = {
    load: '📗 Справочник не загрузился. Проверьте интернет и попробуйте ещё раз.',
    notReady: '📗 Приложение ещё загружается — попробуйте через пару секунд.',
    noTopic: '📗 Такой темы в справочнике нет — показываю список тем.',
    noVoice: '🔊 Озвучка недоступна на этом устройстве.',
    noTrainer: '🏋️ Этот тренажёр сейчас недоступен — попробуйте позже.',
    broken: '📗 Не получилось показать тему. Попробуйте открыть её ещё раз.',
  };

  /* ---------- trainers a topic can point to (shown only when that module is loaded) ---------- */
  const PROVE = {
    'a2-preposisjoner': 'Тест: предлоги i, på, til, hos', 'a2-passiv': 'Тест: пассив',
    'a2-sverb-seg': 'Тест: s-глаголы и seg', 'a2-skole': 'Тест: придаточные предложения',
    'a2-familie': 'Тест: семья и повседневная жизнь', 'a2-helse': 'Тест: тело и здоровье', 'a2-dyr': 'Тест: животные',
  };
  const ot = (v, ico, label) => ({ ico, label, ok: () => !!(window.OrdTrainer && OrdTrainer.open), go: () => OrdTrainer.open(v) });
  const TRAINERS = {
    'ot:wo': ot('wo', '🧱', 'Собери предложение'),
    'ot:pos': ot('pos', '📊', 'Порядок слов — таблица позиций'),
    'ot:aa': ot('aa', 'å', 'å или нет?'),
    'ot:qw': ot('qw', '❓', 'Вопросительные слова'),
    'ot:decks': ot('decks', '📚', 'Таблицы форм'),
    klokka: { ico: '🕐', label: 'Время по-норвежски', ok: () => !!(window.Klokka && Klokka.open), go: () => Klokka.open() },
    genders: { ico: '🌳', label: 'Колоды по родам', ok: () => !!(window.Genders && Genders.open), go: () => Genders.open() },
    'drills:forms': { ico: '🔤', label: 'Формы слов', ok: () => !!(window.Drills && Drills.forms), go: () => Drills.forms() },
    'drills:cloze': { ico: '✍️', label: 'Вставь слово', ok: () => !!(window.Drills && Drills.cloze), go: () => Drills.cloze() },
  };
  function trainer(id) {
    if (TRAINERS[id]) return TRAINERS[id];
    const m = /^prove:(.+)$/.exec(id || '');
    if (m) return { ico: '📝', label: PROVE[m[1]] || 'Тест по теме', ok: () => !!(window.Prove && Prove.openTest), go: () => Prove.openTest(m[1]) };
    return null;
  }

  /* ---------- data ---------- */
  function check(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.topics) || !Array.isArray(d.groups)) return null;
    const groups = d.groups.filter(g => g && g.id);
    const gid = new Set(groups.map(g => g.id));
    const topics = d.topics.filter(t => t && t.id && gid.has(t.group) && t.ru && t.rule).map(t => Object.assign({
      no: '', keys: '', uk: '', tables: [], ex: [], err: null, tip: '', see: [], train: [], level: 'A1',
    }, t));
    if (!topics.length) return null;
    topics.forEach(t => {
      const cells = (t.tables || []).map(tb => (tb.r || []).map(r => r.join(' ')).join(' ')).join(' ');
      const hay = fold([t.ru, t.no, t.keys, t.uk || '', t.level, (t.ex || []).map(e => e.join(' ')).join(' '), cells].join(' ')).replace(/\*\*/g, '');
      t._hay = hay + ' ' + ascii(hay);
      t._title = fold(t.ru + ' ' + t.no);
    });
    return { groups, topics, byId: new Map(topics.map(t => [t.id, t])) };
  }
  function load() {
    if (DATA) return Promise.resolve(DATA);
    if (loading) return loading;
    loading = fetch(DATA_URL).then(r => (r.ok ? r.json() : null)).then(d => { DATA = check(d); return DATA; })
      .catch(() => null).then(d => { loading = null; return d; });
    return loading;
  }

  /* ---------- small renderers ---------- */
  const rich = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  const paras = s => String(s || '').split(/\n+/).filter(x => x.trim()).map(p => `<p>${rich(p)}</p>`).join('');
  const levelTag = lv => `<span class="gr-lv gr-lv-${esc(String(lv).toLowerCase())}" title="Уровень ${esc(lv)}">${esc(lv)}</span>`;
  const SPK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  const spk = (text, cls = '') => `<button type="button" class="gr-spk ${cls}" data-gr-say="${esc(text)}" title="Прослушать по-норвежски" aria-label="Прослушать по-норвежски">${SPK}</button>`;
  /** a header: «no · ru» → bilingual label; a known grammar term → Gram.label; anything else as it is */
  function headHtml(h) {
    const s = String(h || '');
    const parts = s.split(' · ');
    if (parts.length === 2) return `<span class="gt"><span class="gt-no" lang="nb">${esc(parts[0])}</span><span class="gt-dot" aria-hidden="true"> · </span><span class="gt-ru">${esc(parts[1])}</span></span>`;
    try { if (window.Gram && Gram.term && Gram.term(s)) return Gram.label(s); } catch (e) { /* plain */ }
    return esc(s);
  }
  function headText(h) {
    const s = String(h || '');
    if (s.includes(' · ')) return s;
    try { if (window.Gram && Gram.labelText && Gram.term && Gram.term(s)) return Gram.labelText(s); } catch (e) { /* plain */ }
    return s;
  }
  function cellHtml(c, ruCol) {
    const s = String(c == null ? '' : c);
    if (!s.trim() || /^[—–-]$/.test(s.trim())) return '<span class="gr-dash">—</span>';
    if (ruCol) return `<span class="gr-cell-ru">${rich(s)}</span>`;
    const i = s.indexOf('|');
    const no = i < 0 ? s : s.slice(0, i), ru = i < 0 ? '' : s.slice(i + 1);
    const sayable = /[a-zæøå]/i.test(no) && !/^\d+[.:]?\d*\.?$/.test(no.trim());
    const noHtml = sayable
      ? `<button type="button" class="gr-say" data-gr-say="${esc(no)}" title="Нажмите — прочитать вслух" lang="nb">${esc(no)}</button>`
      : `<span class="gr-cell-no" lang="nb">${esc(no)}</span>`;
    return `<span class="gr-cell">${noHtml}${ru ? `<span class="gr-cell-tr">${esc(ru)}</span>` : ''}</span>`;
  }
  function tableHtml(tb) {
    const h = Array.isArray(tb.h) ? tb.h : [];
    const ru = new Set(Array.isArray(tb.ru) ? tb.ru : []);
    const wide = h.length >= 3 ? ' gr-table-wide' : '';
    return `<div class="gr-tw">${tb.title ? `<div class="gr-tcap">${esc(tb.title)}</div>` : ''}<table class="gr-table${wide}">
      <thead><tr>${h.map(x => `<th scope="col">${headHtml(x)}</th>`).join('')}</tr></thead>
      <tbody>${(tb.r || []).map(r => `<tr>${r.map((c, k) => `<td data-h="${esc(headText(h[k]))}">${cellHtml(c, ru.has(k))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  /* ---------- the list ---------- */
  function listHtml(ctx) {
    const D = DATA;
    const lv = ['', 'A1', 'A2', 'B1'];
    const sec = g => {
      const ts = D.topics.filter(t => t.group === g.id);
      if (!ts.length) return '';
      let pos = '';
      try { if (window.Gram && Gram.pos && g.pos) pos = Gram.pos(g.pos); } catch (e) { pos = ''; }
      return `<section class="gr-sec" data-gr-sec="${esc(g.id)}" id="gr-sec-${esc(g.id)}">
        <h3 class="gr-sec-h"><span class="gr-sec-ico" aria-hidden="true">${esc(g.icon || '📗')}</span><span class="gr-sec-name">${esc(g.ru)}</span>${pos ? `<span class="gr-sec-pos">${pos}</span>` : ''}<span class="gr-n" data-gr-n>${ts.length}</span></h3>
        <div class="gr-list">${ts.map(t => `<button type="button" class="gr-item" data-gr-topic="${esc(t.id)}" data-gr-lv="${esc(t.level)}" title="Открыть тему «${esc(t.ru)}»">
          ${levelTag(t.level)}<span class="gr-item-txt"><b>${esc(t.ru)}</b><span class="gr-item-no" lang="nb">${esc(t.no)}</span></span><span class="gr-go" aria-hidden="true">›</span></button>`).join('')}</div></section>`;
    };
    return `<div class="gr-intro"><span aria-hidden="true">📗</span><span>Грамматика норвежского (букмол) от A1 до B1 простыми словами: короткое правило, таблица форм с переводом, примеры с 🔊 и <b>типичная ошибка русскоязычных</b>. Нажмите на тему.</span></div>
      <div class="gr-tools">
        <label class="gr-search"><span aria-hidden="true">🔍</span><input type="search" class="input" data-gr-q value="${esc(ctx.q)}" placeholder="Поиск: «предлоги», «sin», «прошедшее»…" aria-label="Поиск по темам — по-русски, по-украински или по-норвежски" autocomplete="off" spellcheck="false"></label>
        <div class="gr-levels" role="group" aria-label="Уровень">${lv.map(l => `<button type="button" class="gr-lvbtn ${l ? 'gr-lv-' + l.toLowerCase() : ''}" data-gr-level="${l}" aria-pressed="${ctx.level === l}" title="${l ? `Показать только темы уровня ${l}` : 'Показать все уровни'}">${l || 'Все'}</button>`).join('')}</div>
      </div>
      <nav class="gr-jump" aria-label="Разделы">${D.groups.map(g => `<button type="button" class="gr-jumpbtn" data-gr-jump="${esc(g.id)}" title="Перейти к разделу «${esc(g.ru)}»"><span aria-hidden="true">${esc(g.icon || '')}</span> ${esc(g.ru)}</button>`).join('')}</nav>
      <p class="gr-count small muted" data-gr-count aria-live="polite"></p>
      <div class="gr-groups">${D.groups.map(sec).join('')}</div>
      <div class="gr-empty" data-gr-empty hidden>🔎 <span>Ничего не нашлось. Попробуйте другое слово — по-русски или по-норвежски: «род», «ikke», «perfektum», «предлоги».</span></div>`;
  }
  function filter(ctx) {
    const root = ctx.body;
    const words = fold(ctx.q).split(/\s+/).filter(Boolean);
    let shown = 0;
    root.querySelectorAll('.gr-item').forEach(b => {
      const t = DATA.byId.get(b.dataset.grTopic);
      const okLv = !ctx.level || (t && t.level === ctx.level);
      const okQ = !words.length || (t && words.every(w => t._hay.includes(w) || t._hay.includes(ascii(w))));
      const on = okLv && okQ;
      b.hidden = !on;
      if (on) shown++;
    });
    root.querySelectorAll('.gr-sec').forEach(s => {
      const n = s.querySelectorAll('.gr-item:not([hidden])').length;
      s.hidden = !n;
      const c = s.querySelector('[data-gr-n]'); if (c) c.textContent = n;
      const j = root.querySelector(`[data-gr-jump="${s.dataset.grSec}"]`); if (j) j.hidden = !n;
    });
    const empty = root.querySelector('[data-gr-empty]'); if (empty) empty.hidden = shown > 0;
    const cnt = root.querySelector('[data-gr-count]');
    if (cnt) cnt.textContent = words.length || ctx.level ? (shown ? `Найдено: ${shown} ${plural(shown, ['тема', 'темы', 'тем'])}` : '') : `${shown} ${plural(shown, ['тема', 'темы', 'тем'])} · A1–B1`;
  }
  function showList(ctx, keepScroll) {
    ctx.view = 'list'; ctx.id = null;
    ctx.body.innerHTML = listHtml(ctx);
    filter(ctx);
    const mb = ctx.scroller();
    if (mb) mb.scrollTop = keepScroll ? ctx.listScroll || 0 : 0;
  }

  /* ---------- one topic ---------- */
  const trl = () => { try { return window.Study && Study.trLang ? Study.trLang() : 'ru'; } catch (e) { return 'ru'; } };
  /** an example's translation by «Язык перевода»: ru · uk (Russian when there is no Ukrainian) · both */
  function exTr(e) {
    const ru = String(e[1] || ''), uk = String(e[2] || ''), l = trl();
    const ruLine = ru ? `<div class="gr-ex-ru" lang="ru">${esc(ru)}</div>` : '';
    const ukLine = uk ? `<div class="gr-ex-ru gr-ex-uk" lang="uk">${esc(uk)}</div>` : '';
    if (l === 'uk') return ukLine || ruLine;
    if (l === 'both') return uk && ru ? `<div class="gr-ex-ru" lang="ru"><span class="gr-flag" aria-hidden="true">🇷🇺</span> ${esc(ru)}</div><div class="gr-ex-ru gr-ex-uk" lang="uk"><span class="gr-flag" aria-hidden="true">🇺🇦</span> ${esc(uk)}</div>` : ruLine || ukLine;
    return ruLine || ukLine;
  }
  function topicHtml(t) {
    const D = DATA;
    const g = D.groups.find(x => x.id === t.group) || {};
    const same = D.topics;
    const i = same.indexOf(t), prev = same[i - 1], next = same[i + 1];
    const trains = (t.train || []).map(id => [id, trainer(id)]).filter(([, x]) => x && x.ok());
    const see = (t.see || []).map(id => D.byId.get(id)).filter(Boolean);
    const err = t.err && typeof t.err === 'object' ? t.err : (t.err ? { t: String(t.err) } : null);
    return `<div class="gr-topbar"><button type="button" class="btn sm ghost gr-back" data-gr-back title="Вернуться к списку тем">‹ Все темы</button>
        <span class="gr-crumb small muted"><span aria-hidden="true">${esc(g.icon || '')}</span> ${esc(g.ru || '')}</span></div>
      <article class="gr-topic" aria-labelledby="gr-th-${esc(t.id)}">
        <header class="gr-th">${levelTag(t.level)}<div><h3 id="gr-th-${esc(t.id)}">${esc(t.ru)}</h3>${t.no ? `<div class="gr-th-no" lang="nb">${esc(t.no)}</div>` : ''}</div></header>
        <section class="gr-rule"><h4><span aria-hidden="true">📌</span> Правило</h4>${(() => {
          const l = trl();
          return l === 'uk' && t.uk ? `<div lang="uk">${paras(t.uk)}</div>`
            : l === 'both' && t.uk ? `${paras(t.rule)}<details class="gr-uk"><summary>🇺🇦 Українською</summary><div lang="uk">${paras(t.uk)}</div></details>`
            : paras(t.rule);
        })()}</section>
        ${(t.tables || []).length ? `<section class="gr-tables"><h4><span aria-hidden="true">📋</span> Таблица <span class="gr-hint small muted">нажмите на норвежское слово — 🔊</span></h4>${t.tables.map(tableHtml).join('')}</section>` : ''}
        ${(t.ex || []).length ? `<section class="gr-exs"><h4><span aria-hidden="true">💬</span> Примеры</h4><ul class="gr-ex">${t.ex.map(e => `<li>${spk(e[0])}<div class="gr-ex-txt"><div class="gr-ex-no" lang="nb">${esc(e[0])}</div>${exTr(e)}</div></li>`).join('')}</ul></section>` : ''}
        ${err ? `<section class="gr-err"><h4><span aria-hidden="true">⚠️</span> Типичная ошибка русскоязычных</h4>${paras(err.t)}
          ${err.bad || err.good ? `<div class="gr-bg">${err.bad ? `<div class="gr-bad"><span class="gr-mark" aria-hidden="true">✗</span><span class="gr-bad-t" lang="nb"><span class="sr-only">Неправильно: </span>${esc(err.bad)}</span></div>` : ''}
            ${err.good ? `<div class="gr-good"><span class="gr-mark" aria-hidden="true">✓</span><span class="gr-good-t" lang="nb"><span class="sr-only">Правильно: </span>${esc(err.good)}</span>${spk(err.good, 'sm')}</div>` : ''}</div>` : ''}</section>` : ''}
        ${t.tip ? `<div class="gr-tip"><span aria-hidden="true">💡</span><span>${rich(t.tip)}</span></div>` : ''}
        ${trains.length ? `<section class="gr-train"><h4><span aria-hidden="true">🏋️</span> К тренажёру</h4><div class="gr-btns">${trains.map(([id, x]) => `<button type="button" class="btn gr-trbtn" data-gr-train="${esc(id)}" title="Открыть: ${esc(x.label)}"><span aria-hidden="true">${x.ico === '📊' && window.NavIcons ? NavIcons.statsIco() : esc(x.ico)}</span> ${esc(x.label)}</button>`).join('')}</div></section>` : ''}
        ${see.length ? `<section class="gr-see"><h4><span aria-hidden="true">🔗</span> См. также</h4><div class="gr-chips">${see.map(s => `<button type="button" class="gr-chip" data-gr-topic="${esc(s.id)}" title="Открыть тему «${esc(s.ru)}»">${levelTag(s.level)} ${esc(s.ru)}</button>`).join('')}</div></section>` : ''}
        <nav class="gr-nav" aria-label="Соседние темы">
          ${prev ? `<button type="button" class="gr-navbtn" data-gr-topic="${esc(prev.id)}" title="Предыдущая тема"><span aria-hidden="true">‹</span><span><small>Назад</small>${esc(prev.ru)}</span></button>` : '<span></span>'}
          ${next ? `<button type="button" class="gr-navbtn gr-next" data-gr-topic="${esc(next.id)}" title="Следующая тема"><span><small>Дальше</small>${esc(next.ru)}</span><span aria-hidden="true">›</span></button>` : '<span></span>'}
        </nav>
      </article>`;
  }
  function showTopic(ctx, id) {
    const t = DATA.byId.get(id);
    if (!t) { toast(MSG.noTopic); showList(ctx); return; }
    if (ctx.view === 'list') { const mb = ctx.scroller(); ctx.listScroll = mb ? mb.scrollTop : 0; }
    try {
      ctx.body.innerHTML = topicHtml(t);
    } catch (e) {
      console.warn('gramref: topic', e);
      toast(MSG.broken, 'bad'); showList(ctx, true); return;
    }
    ctx.view = 'topic'; ctx.id = id;
    const mb = ctx.scroller(); if (mb) mb.scrollTop = 0;
    const back = ctx.body.querySelector('[data-gr-back]'); if (back) try { back.focus({ preventScroll: true }); } catch (e) { /* old browser */ }
  }

  /* ---------- reading aloud ---------- */
  function say(text) {
    if (!text) return;
    if (!window.TTS || !TTS.speak) { toast(MSG.noVoice); return; }
    try { const p = TTS.speak(text, 'no'); if (p && p.catch) p.catch(() => {}); } catch (e) { toast(MSG.noVoice); }
  }

  /* ---------- the window ---------- */
  function onClick(ctx, e) {
    const el = e.target.closest('button'); if (!el || !ctx.body.contains(el)) return;
    const d = el.dataset;
    if (d.grSay != null) { say(d.grSay); return; }
    if (d.grTopic) { showTopic(ctx, d.grTopic); return; }
    if (el.hasAttribute('data-gr-back')) { showList(ctx, true); return; }
    if (d.grLevel != null) {
      ctx.level = d.grLevel;
      ctx.body.querySelectorAll('[data-gr-level]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.grLevel === ctx.level)));
      filter(ctx); return;
    }
    if (d.grJump) {
      const s = ctx.body.querySelector(`#gr-sec-${d.grJump}`);
      const mb = ctx.scroller();
      if (s && mb) mb.scrollTo({ top: s.offsetTop - 8, behavior: 'smooth' });
      return;
    }
    if (d.grTrain) {
      const x = trainer(d.grTrain);
      if (!x || !x.ok()) { toast(MSG.noTrainer); return; }
      try { x.go(); } catch (err) { console.warn('gramref: trainer', err); toast(MSG.noTrainer); }
    }
  }
  async function open(topicId) {
    if (!(window.UI && UI.modal) || !document.getElementById('modal-root')) { toast(MSG.notReady); return null; }
    const want = typeof topicId === 'string' && topicId.trim() ? topicId.trim() : '';
    if (cur && cur.alive()) {
      // already open: bring it to the asked topic (or the list)
      if (DATA) { if (want) showTopic(cur, want); else if (cur.view !== 'list') showList(cur, true); }
      return cur;
    }
    const ctx = { view: 'list', q: '', level: '', id: null, listScroll: 0 };
    let closed = false;
    const m = UI.modal({
      title: '📗 Справочник грамматики', cls: 'wide gr-modal',
      body: '<div class="gr-root" data-gr><div class="gr-loading"><span class="spinner sm"></span> Загружаю справочник…</div></div>',
      onClose: () => { closed = true; if (cur === ctx) cur = null; try { if (window.TTS && TTS.stop) TTS.stop(); } catch (e) { /* ignore */ } },
    });
    ctx.m = m; ctx.body = m.$('[data-gr]');
    ctx.alive = () => !closed && m.el.isConnected;
    ctx.scroller = () => m.$('.modal-body');
    cur = ctx;
    ctx.body.addEventListener('click', e => onClick(ctx, e));
    ctx.body.addEventListener('input', e => { if (e.target.matches('[data-gr-q]')) { ctx.q = e.target.value; filter(ctx); } });
    ctx.body.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.matches('[data-gr-q]')) {
        // Enter in the search: open the only (or the first) topic found
        const first = ctx.body.querySelector('.gr-item:not([hidden])');
        if (first) { e.preventDefault(); showTopic(ctx, first.dataset.grTopic); }
      }
    });
    const d = await load();
    if (!ctx.alive()) return null;
    if (!d) {
      ctx.body.innerHTML = `<div class="gr-fail"><p>${esc(MSG.load)}</p><button type="button" class="btn primary" data-gr-retry title="Загрузить справочник ещё раз">↻ Попробовать ещё раз</button></div>`;
      const b = ctx.body.querySelector('[data-gr-retry]');
      if (b) b.onclick = async () => { b.disabled = true; const again = await load(); if (!ctx.alive()) return; if (again) { if (want && again.byId.has(want)) showTopic(ctx, want); else showList(ctx); } else { b.disabled = false; toast(MSG.load, 'bad'); } };
      return ctx;
    }
    if (want && d.byId.has(want)) showTopic(ctx, want);
    else { if (want) toast(MSG.noTopic); showList(ctx); }
    return ctx;
  }

  /* ---------- the help centre topic ---------- */
  function registerHelp() {
    const H = window.Help;
    if (!H || !Array.isArray(H.TOPICS) || H.TOPICS.some(t => t.id === 'gramref')) return;
    H.TOPICS.push({ id: 'gramref', icon: '📗', hue: 140, title: 'Справочник грамматики',
      desc: 'Вся грамматика A1–B1 по-русски: правило, таблица форм с переводом, примеры с озвучкой и типичная ошибка.',
      keys: 'справочник грамматика правило правила таблица формы существительное глагол прилагательное местоимение предлог союз порядок слов v2 инверсия придаточное пассив перфект претерит sin seg ikke род артикль grammatikk regel substantiv verb adjektiv pronomen preposisjon ordstilling',
      steps: [['📗', 'Откройте <b>«📗 Справочник грамматики»</b> на главной в «Учить» (или кнопкой ниже).'],
        ['🔍', 'Найдите тему поиском — по-русски («прошедшее», «предлоги») или по-норвежски («sin», «ikke») — или выберите раздел: существительные, глаголы, порядок слов…'],
        ['🏷', 'Кнопки <b>A1 · A2 · B1</b> оставляют темы только нужного уровня.'],
        ['🔊', 'В теме: правило, таблица форм с переводом и примеры. Нажмите на норвежское слово или 🔊 — оно прозвучит.'],
        ['⚠️', '<b>«Типичная ошибка русскоязычных»</b> — как часто ошибаются и как правильно.'],
        ['🏋️', '<b>«К тренажёру»</b> — сразу потренировать тему: собрать предложение, таблицы форм, тест.']],
      expect: 'Короткое и понятное объяснение любой темы до уровня B1 — с примерами, которые можно послушать, и ссылками на соседние темы.',
      limits: 'Справочник написан для приложения своими словами; это букмол (bokmål). Озвучка — голос устройства или Google.',
      open: ['📗 Открыть справочник', () => open()] });
  }

  /* ---------- entry points: any [data-gramref-open] or [data-gramref-open="topic-id"] ---------- */
  if (typeof document !== 'undefined') {
    document.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('[data-gramref-open]');
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      open(b.getAttribute('data-gramref-open') || '');
    }, true);
    const boot = () => { try { registerHelp(); } catch (e) { console.warn('gramref help', e); } };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }

  window.GramRef = { open, load, TRAINERS: Object.keys(TRAINERS).concat(Object.keys(PROVE).map(k => 'prove:' + k)), _t: { check, trainer, headText, cellHtml } };
})();
