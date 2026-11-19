/* ============ 📘 «Мои учебники» — личные колоды по главам купленных учебников (только на этом Mac) ============
 * The owner's own course books, one deck per chapter, cards grouped by the book's sections (tags):
 *   God i norsk 1  private/godinorsk-decks.json   (tag godinorsk1, deck.gin1Deck / card.gin1Key — as before)
 *   På vei         private/paavei-decks.json      (tag paavei)
 *   Поговорим по-норвежски  private/samtale-decks.json  (tag samtale; chapters are topics)
 *   Norsk pluss    private/norskpluss-decks.json  (tag norskpluss)
 * A file that is not there is skipped silently. The books' words and translations are © their publishers and were
 * bought by the owner for PERSONAL study, so the files live in private/ (never published) and are fetched ONLY on
 * localhost / 127.0.0.1 (the owner's Mac). Every deck and card made here is marked personal: true — sharing, export
 * and cloud copies skip them (Store.isPersonalDeck / isPersonalCard).
 *
 * File schema (God i norsk's; small differences are mapped): { title?, publisher?, source?, decks: [{ n, id, name,
 *   titleNo, titleRu, sections: [{ key, tag, no, ru, n }], cards: [{ key, front|no, ru, uk, wordClass, secs|sec,
 *   forms: [{label, no, ru}], example, exampleRu, gender, fix, note, formsSrc }] }] }
 *   (also accepted: chapters[] for decks, chapter / kap for n, title / no for titleNo, words[] / items[] for cards,
 *    nb / word for the Norwegian, russian for ru)
 *
 *   MyCourse.available()            → true only on localhost / 127.0.0.1 (where the private files can exist)
 *   MyCourse.books()                → Promise<[{ id, title, chapters, cards }]> — only the books whose file is there
 *   MyCourse.decks(book?)           → Promise<[{ book, n, id, name, titleNo, titleRu, count, have, sections }]> ('godinorsk' by default)
 *   MyCourse.importChapter(n, o?)   → Promise<{ ok, added, existed, deckId, msg }> (o.book: 'godinorsk' by default)
 *   MyCourse.importAll(o?)          → Promise<{ ok, added, existed, chapters, msg }> (o.book: one book; none — every book)
 *   MyCourse.open()                 → the window «📘 Мои учебники»: one section per book, every chapter with «➕ Добавить»
 * Re-import never makes twins: the deck is found by its course id, cards by their key or the Norwegian text.
 * Cards the owner already has are left exactly as they are (progress, edits) — «уже было M».
 */
(function () {
  const BOOKS = [
    { id: 'godinorsk', file: 'private/godinorsk-decks.json', title: 'God i norsk 1', tag: 'godinorsk1', kap: 'gin1-kap', legacy: true },
    { id: 'paavei', file: 'private/paavei-decks.json', title: 'På vei', tag: 'paavei', kap: 'paavei-kap' },
    { id: 'samtale', file: 'private/samtale-decks.json', title: 'Поговорим по-норвежски', tag: 'samtale', kap: 'samtale-kap' },
    { id: 'verbs', file: 'private/verbs-personal.json', title: 'Глаголы — личные материалы', tag: 'verbs-personal', kap: 'verbs-kap' },
    { id: 'renhold', file: 'private/renhold-decks.json', title: 'Renhold — моя профессия', tag: 'renhold', kap: 'renhold-kap' },
    { id: '360verb', file: 'private/360verb-decks.json', title: '360 глаголов в картинках', tag: '360verb', kap: '360verb-kap' },
    { id: 'arve613', file: 'private/613-decks.json', title: '613 самых нужных слов', tag: 'arve613', kap: 'arve613-kap' },
  ];
  const DEF = 'godinorsk';
  const DATA = {}, loading = {};
  let busy = false;

  const host = () => { try { return String(location.hostname || ''); } catch (e) { return ''; } };
  const available = () => ['localhost', '127.0.0.1'].includes(host());
  const T = (s, max) => { try { return window.Store && Store.Safe ? Store.Safe.text(s == null ? '' : String(s), max) : String(s == null ? '' : s).slice(0, max || 2000); } catch (e) { return ''; } };
  const norm = s => { try { return window.U && U.norm ? U.norm(s) : String(s || '').toLowerCase().trim(); } catch (e) { return String(s || '').toLowerCase().trim(); } };
  const esc = s => { try { return U.esc(s == null ? '' : String(s)); } catch (e) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); } };
  const toast = (msg, type) => { try { if (window.UI && UI.toast) UI.toast(msg, type || ''); } catch (e) { /* no toast */ } };
  const plural = (n, f) => { try { return U.plural(n, f); } catch (e) { return f[2]; } };
  const pad = n => String(n).padStart(2, '0');
  const bookOf = id => BOOKS.find(b => b.id === (id || DEF)) || null;
  const MSG = {
    notHere: '📘 Мои учебники открываются только на этом Mac (через мост на localhost) — на сайте их нет.',
    noFile: '📘 Файлы учебников не найдены: положите их (например, godinorsk-decks.json) в папку private/ и попробуйте ещё раз.',
    broken: '📘 Не удалось прочитать файл учебника — похоже, он повреждён. Соберите его заново.',
    notReady: '📘 Приложение ещё загружается — попробуйте через пару секунд.',
    busy: '📘 Уже добавляю карточки — подождите немного.',
    noChapter: '📘 Такой главы в файле учебника нет.',
    failed: '📘 Не получилось добавить карточки. Попробуйте ещё раз.',
  };

  /* ---------- data: fetched only on the owner's Mac, checked and mapped before use ---------- */
  function mapCard(c, B, n) {
    if (!c || typeof c !== 'object') return null;
    const front = c.front || c.no || c.nb || c.word || '';
    const ru = c.ru || c.russian || '';
    if (!front || !ru) return null;
    const x = Object.assign({}, c, { front, no: c.no || front, ru });
    if (!x.key) x.key = `${B.id}:${n}:${norm(front).replace(/\s+/g, '-').slice(0, 80)}`;
    if (!Array.isArray(x.secs) && x.sec == null && x.section != null) x.sec = x.section;
    return x;
  }
  function mapDeck(d, B, i) {
    if (!d || typeof d !== 'object') return null;
    const n = +(d.n != null ? d.n : d.chapter != null ? d.chapter : d.kap != null ? d.kap : i + 1);
    if (!Number.isFinite(n)) return null;
    const raw = Array.isArray(d.cards) ? d.cards : Array.isArray(d.words) ? d.words : Array.isArray(d.items) ? d.items : null;
    if (!raw) return null;
    const cards = raw.map(c => mapCard(c, B, n)).filter(Boolean);
    return Object.assign({}, d, {
      n, id: String(d.id || `${B.id}-k${pad(n)}`),
      titleNo: d.titleNo || d.title || d.no || '', titleRu: d.titleRu || d.ru || '',
      sections: Array.isArray(d.sections) ? d.sections.filter(s => s && typeof s === 'object') : [], cards,
    });
  }
  async function load(bookId) {
    const B = bookOf(bookId);
    if (!B) return { error: 'noFile' };
    if (!available()) return { error: 'notHere' };
    if (DATA[B.id]) return { data: DATA[B.id] };
    if (loading[B.id]) return loading[B.id];
    loading[B.id] = (async () => {
      let r;
      try {
        const ctl = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = ctl ? setTimeout(() => ctl.abort(), 15000) : null;
        r = await fetch(B.file, { cache: 'no-store', credentials: 'same-origin', signal: ctl ? ctl.signal : undefined });
        if (timer) clearTimeout(timer);
      } catch (e) { return { error: 'noFile' }; }
      if (!r || !r.ok) return { error: 'noFile' };
      let j;
      try { j = await r.json(); } catch (e) { return { error: 'broken' }; }
      const list = j && (Array.isArray(j.decks) ? j.decks : Array.isArray(j.chapters) ? j.chapters : null);
      if (!list || !list.length) return { error: 'broken' };
      const decks = list.map((d, i) => mapDeck(d, B, i)).filter(d => d && d.cards.length);
      if (!decks.length) return { error: 'broken' };
      const title = T(j.title || j.book || j.name, 120) || B.title;
      DATA[B.id] = { book: B, title, decks, source: T(j.source, 600), formsSource: T(j.formsSource, 400), publisher: T(j.publisher, 120) };
      return { data: DATA[B.id] };
    })().finally(() => { loading[B.id] = null; });
    return loading[B.id];
  }
  const storeReady = () => !!(window.Store && Store.state && typeof Store.addDeck === 'function' && typeof Store.addCard === 'function');

  /* ---------- pictures (360 глаголов): private/img/… → data: URL — Store.Safe.image keeps only data:image/* or https ---------- */
  const IMG = {};
  const imgPath = c => { const p = String((c && (c.img || c.image)) || ''); return /^private\/img\/[\w\/.-]+\.(jpe?g|png|webp)$/i.test(p) && !p.includes('..') ? p : ''; };
  async function loadImages(d) {
    await Promise.all(d.cards.map(async c => {
      const p = imgPath(c);
      if (!p || IMG[p]) return;
      for (let attempt = 0; attempt < 3 && !IMG[p]; attempt++) {   // a dropped connection gets two more tries
        try {
          const r = await fetch(p, { cache: 'no-store', credentials: 'same-origin' });
          if (!r.ok) return;
          const raw = await r.blob();
          if (!raw.size || raw.size > 400000) return;
          const type = /\.png$/i.test(p) ? 'image/png' : /\.webp$/i.test(p) ? 'image/webp' : 'image/jpeg';
          IMG[p] = await U.blobToDataURL(new Blob([raw], { type }));
        } catch (e) { await new Promise(res => setTimeout(res, 300 * (attempt + 1))); /* the card works without its picture */ }
      }
    }));
  }

  /* ---------- the owner's deck for a chapter ---------- */
  const findDeck = d => { try { return Store.decks().find(x => x.gin1Deck === d.id || x.courseDeck === d.id) || Store.decks().find(x => x.name === d.name) || null; } catch (e) { return null; } };
  const keyOf = c => T(c.key, 120);
  const frontOf = c => T(c.front || c.no, 300);
  function haveIndex(deckId, d) {
    // a text match counts unless every owner card with that text is another card of this same chapter (a homograph:
    // 360 глаголов has «å leie» 60 + 68, «å passe» 69 + 89 in one chapter — different keys, same text)
    const fileKeys = new Set(((d && d.cards) || []).map(keyOf).filter(Boolean));
    const keys = new Set(), texts = new Map();
    const addText = (t, k) => { if (!texts.has(t)) texts.set(t, []); texts.get(t).push(k || ''); };
    (Store.cards(deckId) || []).forEach(c => { const k = c.gin1Key || c.courseKey || ''; if (k) keys.add(k); addText(norm(c.no), k); });
    const textHit = t => (texts.get(t) || []).some(k => !k || !fileKeys.has(k));
    return { keys, addKeyed: (t, k) => addText(t, k), has: c => keys.has(keyOf(c)) || textHit(norm(frontOf(c))) || textHit(norm(c.no)) };
  }
  const secShort = s => String(s.key || '').replace(/\+.*/, '');
  function deckDescription(D, d) {
    const secs = (d.sections || []).filter(s => s && s.n).map(s => `${secShort(s)} ${s.no || s.ru || ''}${s.ru && s.no ? ' — ' + s.ru : ''}`.trim()).slice(0, 40).join('\n');
    const pub = D.book.id === 'godinorsk' ? ' (Aschehoug)' : D.publisher ? ` (${D.publisher})` : '';
    return T(`📘 Личная колода по учебнику «${D.title}»${pub}, глава ${d.n}: ${d.titleNo || ''}${d.titleRu ? ' — ' + d.titleRu : ''}.\n` +
      (d.description && D.book.id !== 'godinorsk' ? `${d.description}\n` : '') +
      'Слова и перевод из книги — из купленного учебника, только для личных занятий (не публиковать и не делиться). Русский перевод, поправки и примеры — собственные (Norsk Kort).\n' +
      (secs ? `Разделы (теги ${D.book.id === 'godinorsk' ? 'gin1' : D.book.tag}-…):\n${secs}` : ''), 4000);
  }
  function cardData(D, d, c, secByKey) {
    const B = D.book;
    const secs = (Array.isArray(c.secs) ? c.secs : [c.sec]).filter(Boolean);
    const sec = secByKey[secs[0]] || {};
    const front = frontOf(c);
    const lines = [`📘 ${D.title} · Глава ${d.n}${sec.key ? ` · ${secShort(sec)} ${sec.no || ''}${sec.ru ? ' (' + sec.ru + ')' : ''}` : ''}`.replace(/\s+/g, ' ').trim()];
    const asBook = c.no_book || c.no;
    if (asBook && norm(asBook) !== norm(front)) lines.push(`📖 В учебнике: ${asBook}`);
    if (c.ru_book && norm(c.ru_book) !== norm(c.ru)) lines.push(`📖 Перевод в учебнике: ${c.ru_book}`);
    if (c.uk) lines.push(`🇺🇦 ${c.uk}`);
    if (c.fix) lines.push(`⚠️ Поправка к списку: ${c.fix}`);
    if (c.note) lines.push(`💡 ${c.note}`);
    const own = t => (Array.isArray(t) ? t : []).filter(x => typeof x === 'string' && /^[\p{L}\p{N}._-]{1,40}$/u.test(x));
    const tags = [B.tag, B.kap + pad(d.n)].concat(secs.map(k => (secByKey[k] && secByKey[k].tag) || '').filter(Boolean), own(d.tags), own(c.tags));
    const forms = Array.isArray(c.forms) ? c.forms.slice(0, 12).filter(f => f && f.no).map(f => ({ label: T(f.label, 80), no: T(f.no, 200), ru: T(f.ru, 200) })) : [];
    const out = {
      no: front, ru: T(c.ru, 400), wordClass: T(c.wordClass, 40), description: T(lines.join('\n'), 3000),
      example: T(c.example, 400), exampleRu: T(c.exampleRu, 400), forms, tags: [...new Set(tags)].slice(0, 12),
      uk: T(c.uk, 400), personal: true,
    };
    if (B.legacy) out.gin1Key = keyOf(c); else { out.courseKey = keyOf(c); out.courseBook = B.id; }
    if (/^(m|f|n|mf)$/.test(c.gender || '')) out.gender = c.gender;
    const pic = IMG[imgPath(c)];
    if (pic) { out.image = pic; out.imageAuto = false; }
    if (c.prompt) out.description = T(out.description + '\n🖼 ' + c.prompt, 3000);
    try {
      if (window.Prov && Prov.entry) {
        out.history = [Prov.entry('import', 'import', null, `📘 Мои учебники · ${D.title} · глава ${d.n} · личный словарь (только на этом Mac)`),
          Prov.entry('manual', 'translate', null, 'русский перевод — подготовлен вручную по смыслу главы')];
        if (forms.length) out.history.push(Prov.entry('import', 'forms', null, c.formsSrc === 'book' ? 'формы — как в учебнике' : 'формы сверены с Ordbøkene / Norsk ordbank'));
      }
    } catch (e) { /* history is optional */ }
    return out;
  }

  /* ---------- import ---------- */
  function addChapter(D, d) {
    const B = D.book;
    let deck = findDeck(d), created = false;
    if (!deck) { deck = Store.addDeck(T(d.name, 200) || `${D.title} · Глава ${d.n}`, deckDescription(D, d)); created = true; }
    const marks = B.legacy ? { gin1Deck: d.id } : { courseDeck: d.id, courseBook: B.id };
    try { Store.updateDeck(deck.id, Object.assign(marks, { personal: true, description: created || !deck.description ? deckDescription(D, d) : deck.description })); } catch (e) { /* the deck works without the marks */ }
    const secByKey = {}; (d.sections || []).forEach(s => { if (s && s.key) secByKey[s.key] = s; });
    const have = haveIndex(deck.id, d);
    let added = 0, existed = 0;
    d.cards.forEach(c => {
      if (have.has(c)) {
        const pic = IMG[imgPath(c)];   // a card imported before pictures were supported gets its picture now
        if (pic) { const old = (Store.cards(deck.id) || []).find(x => x.courseKey === keyOf(c) && !x.image); if (old) Store.updateCard(old.id, { image: pic, imageAuto: false }); }
        // 🇺🇦 a card imported before the Ukrainian translation existed gets it now (one typed by the user is kept)
        const uk = T(c.uk, 400);
        if (uk) { const old = (Store.cards(deck.id) || []).find(x => (x.courseKey === keyOf(c) || x.gin1Key === keyOf(c)) && !String(x.uk || '').trim()); if (old) Store.updateCard(old.id, { uk }); }
        existed++; return;
      }
      const data = cardData(D, d, c, secByKey);
      if (!data.no || !data.ru) return;
      Store.addCard(deck.id, data);
      have.keys.add(keyOf(c)); have.addKeyed(norm(data.no), keyOf(c));
      added++;
    });
    return { deckId: deck.id, added, existed, created };
  }
  const refresh = () => { try { if (window.App && typeof App.render === 'function') App.render(); } catch (e) { /* the screen updates later */ } };
  const fail = (key, quiet) => { const msg = MSG[key] || MSG.failed; if (!quiet) toast(msg, 'bad'); return { ok: false, added: 0, existed: 0, msg }; };

  async function importChapter(n, opts = {}) {
    if (!available()) return fail('notHere', opts.quiet);
    if (busy && !opts._inner) return fail('busy', opts.quiet);
    if (!storeReady()) return fail('notReady', opts.quiet);
    const r = await load(opts.book);
    if (r.error) return fail(r.error, opts.quiet);
    const D = r.data, d = D.decks.find(x => x.n === +n);
    if (!d) return fail('noChapter', opts.quiet);
    if (!opts._inner) busy = true;
    try {
      await loadImages(d);
      const res = addChapter(D, d);
      if (!opts._inner) { try { await Store.saveNow(); } catch (e) { /* Store saves again on its own */ } refresh(); }
      const msg = `📘 ${D.title}, глава ${d.n}: добавлено ${res.added}, уже было ${res.existed}`;
      if (!opts.quiet) toast(msg, res.added ? 'good' : '');
      return { ok: true, added: res.added, existed: res.existed, deckId: res.deckId, msg };
    } catch (e) {
      return fail('failed', opts.quiet);
    } finally { if (!opts._inner) busy = false; }
  }
  async function importAll(opts = {}) {
    if (!available()) return fail('notHere', opts.quiet);
    if (busy) return fail('busy', opts.quiet);
    if (!storeReady()) return fail('notReady', opts.quiet);
    const ids = opts.book ? [opts.book] : BOOKS.map(b => b.id);
    const loaded = [];
    for (const id of ids) { const r = await load(id); if (r.data) loaded.push(r.data); else if (opts.book) return fail(r.error, opts.quiet); }
    if (!loaded.length) return fail('noFile', opts.quiet);
    busy = true;
    let added = 0, existed = 0, chapters = 0;
    try {
      for (const D of loaded) {
        for (const d of D.decks.slice().sort((a, b) => a.n - b.n)) {
          const x = await importChapter(d.n, { quiet: true, _inner: true, book: D.book.id });
          if (x.ok) { added += x.added; existed += x.existed; chapters++; }
        }
      }
      try { await Store.saveNow(); } catch (e) { /* saved later */ }
      refresh();
    } finally { busy = false; }
    if (!chapters) return fail('failed', opts.quiet);
    const who = loaded.length === 1 ? loaded[0].title : 'Мои учебники';
    const msg = `📘 ${who}: добавлено ${added}, уже было ${existed} (${chapters} ${plural(chapters, ['глава', 'главы', 'глав'])})`;
    if (!opts.quiet) toast(msg, added ? 'good' : '');
    return { ok: true, added, existed, chapters, msg };
  }
  async function decks(bookId) {
    const r = await load(bookId);
    if (r.error) return [];
    return r.data.decks.slice().sort((a, b) => a.n - b.n).map(d => {
      let have = 0;
      try { if (storeReady()) { const deck = findDeck(d); if (deck) { const h = haveIndex(deck.id, d); have = d.cards.filter(c => h.has(c)).length; } } } catch (e) { have = 0; }
      return { book: r.data.book.id, n: d.n, id: d.id, name: d.name, titleNo: d.titleNo || '', titleRu: d.titleRu || '', count: d.cards.length, have,
        sections: (d.sections || []).map(s => ({ key: s.key, no: s.no || '', ru: s.ru || '', n: s.n || 0 })) };
    });
  }
  async function books() {
    if (!available()) return [];
    const out = [];
    for (const B of BOOKS) {
      const r = await load(B.id);
      if (r.data) out.push({ id: B.id, title: r.data.title, chapters: r.data.decks.length, cards: r.data.decks.reduce((n, d) => n + d.cards.length, 0) });
    }
    return out;
  }

  /* ---------- the window «📘 Мои учебники»: one section per book, chapters with «➕ Добавить» ---------- */
  async function open() {
    if (!available()) { toast(MSG.notHere); return; }
    if (!(window.UI && UI.modal)) return;
    const have = await books();
    if (!have.length) { toast(MSG.noFile, 'bad'); return; }
    const row = d => `<div class="mc-row">
        <div class="mc-row-txt"><b>Глава ${d.n}</b>${d.titleNo ? ` · ${esc(d.titleNo)}` : ''}${d.titleRu ? ` — ${esc(d.titleRu)}` : ''}
          <div class="small muted">${d.count} ${plural(d.count, ['карточка', 'карточки', 'карточек'])}${d.have ? ` · уже в колоде: ${d.have}` : ''}</div></div>
        <button type="button" class="btn sm ${d.have >= d.count ? 'ghost' : ''}" data-mc-n="${d.n}" data-mc-book="${esc(d.book)}">${d.have >= d.count ? '✓ Есть' : d.have ? '➕ Дополнить' : '➕ Добавить'}</button></div>`;
    const section = (b, i) => `<details class="mc-book" data-mc-sec="${esc(b.id)}" ${i === 0 || have.length === 1 ? 'open' : ''}>
        <summary class="mc-book-head"><span class="mc-book-name">📘 ${esc(b.title)}</span><span class="small muted">${b.chapters} ${plural(b.chapters, ['глава', 'главы', 'глав'])} · ${b.cards} ${plural(b.cards, ['карточка', 'карточки', 'карточек'])}</span></summary>
        <div class="mc-book-body"><div data-mc-list="${esc(b.id)}"><span class="spinner sm"></span></div>
          <div class="mc-book-foot"><button type="button" class="btn sm primary" data-mc-all="${esc(b.id)}">➕ Добавить все главы «${esc(b.title)}»</button></div></div></details>`;
    const paint = async m => {
      for (const b of have) {
        const list = await decks(b.id);
        const box = m.$(`[data-mc-list="${b.id}"]`);
        if (box) box.innerHTML = list.map(row).join('') || `<p>${esc(MSG.noFile)}</p>`;
      }
    };
    UI.modal({
      title: '📘 Мои учебники', cls: 'mc-modal',
      body: `<p class="small muted">Личные колоды по главам ваших учебников: русский перевод, формы слов, поправки ⚠️. Файлы лежат только на этом Mac. 🔒 ${esc(window.Store && Store.PERSONAL_NOTE ? Store.PERSONAL_NOTE : 'Личные колоды из учебника не отправляются — они только для вас')}.</p>
        ${have.map(section).join('')}`,
      foot: have.length > 1 ? '<button type="button" class="btn primary" data-mc-all="*">➕ Добавить все главы всех учебников</button>' : '',
      onMount: m => {
        paint(m);
        m.el.addEventListener('click', async e => {
          const b = e.target.closest('[data-mc-n],[data-mc-all]'); if (!b || b.disabled) return;
          b.disabled = true;
          try {
            if (b.hasAttribute('data-mc-all')) { const id = b.dataset.mcAll; await importAll(id === '*' ? {} : { book: id }); }
            else await importChapter(+b.dataset.mcN, { book: b.dataset.mcBook });
          } finally { b.disabled = false; paint(m); }
        });
      },
    });
  }

  window.MyCourse = { available, books, decks, importChapter, importAll, open, BOOKS: BOOKS.map(b => ({ id: b.id, title: b.title, tag: b.tag })) };
  // entry point anywhere: <button data-mycourse-open> (capture listener, like Klokka)
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-mycourse-open]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    open();
  }, true);
})();
