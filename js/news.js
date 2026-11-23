/* ============ 📰 Новости простым языком: Klar Tale · NRK · 🎧 NRK Supernytt ============
 * LingQ-style reader for news headlines: every Norwegian word is coloured by what YOU know
 *   known (the word or its dictionary form is on a card you have learned) — plain;
 *   learning (on a card, not learned yet) — yellow underline;   new (on no card) — blue.
 * Tap a word → translation, 🔊, «➕ В карточку» (with the sentence as the example and where it came from).
 *
 * LEGAL: Klar Tale and NRK do not allow copying their articles. Only what their RSS feeds publish for display is shown —
 * title, short summary, picture — with «↗ Читать на сайте». Full article texts are never fetched or stored.
 * The Supernytt podcast is played straight from NRK's own servers (nothing is re-hosted).
 */
(function () {
  const DECK = '📰 Слова из новостей';
  const TTL = 3600e3;                       // feeds are fetched again after an hour
  const LS_FEEDS = 'nk-news-v1';            // { url: { t, items } }
  const LS_KNOWN = 'nk-news-known';         // words marked «✓ Знаю» here (no card needed)
  const LS_VIEW = 'nk-news-ui';             // tab, NRK section, filters
  const MAX_ITEMS = 40;

  const KT = { id: 'kt', src: 'Klar Tale', url: 'https://www.klartale.no/?lab_viewport=rss', alt: 'https://www.klartale.no/rss', home: 'https://www.klartale.no' };
  const NRK = [
    { id: 'top', name: 'Главное', url: 'https://www.nrk.no/toppsaker.rss' },
    { id: 'siste', name: 'Последнее', url: 'https://www.nrk.no/nyheter/siste.rss' },
    { id: 'norge', name: 'Норвегия', url: 'https://www.nrk.no/norge/toppsaker.rss' },
    { id: 'urix', name: 'Мир', url: 'https://www.nrk.no/urix/toppsaker.rss' },
    { id: 'kultur', name: 'Культура', url: 'https://www.nrk.no/kultur/toppsaker.rss' },
    { id: 'viten', name: 'Наука', url: 'https://www.nrk.no/viten/toppsaker.rss' },
    { id: 'livsstil', name: 'Полезное', url: 'https://www.nrk.no/livsstil/toppsaker.rss' },
    { id: 'sport', name: 'Спорт', url: 'https://www.nrk.no/sport/toppsaker.rss' },
  ];
  const SN = { url: 'https://podkast.nrk.no/program/supernytt.rss', snapshot: 'data/news-supernytt.json', home: 'https://radio.nrk.no/podkast/supernytt', tv: 'https://tv.nrk.no/serie/supernytt' };

  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full — memory only */ } };
  const safeUrl = u => /^https:\/\/[^\s"'<>]+$/i.test(String(u || '').trim()) ? String(u).trim() : '';
  const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s; };

  /* ---------------- fetching: Net.get (js/net.js) — direct where the feed sends CORS (NRK news, Klar Tale), else the store
   * apps' native HTTP, the Mac bridge (only when it runs on this Mac), then the Norsk Kort server's fetch-public kind 'rss'
   * (an exact allow-list of these feed URLs — never an open proxy). Nothing works → a calm line + «Читать на сайте». ---------------- */
  // feeds known to send no CORS header (NRK podcasts): off the Mac they go straight to the server — no doomed browser request
  const NO_CORS = /^https:\/\/podkast\.nrk\.no\//;
  async function fetchText(url, alt) {
    let err = null;
    for (const u of [url, alt].filter(Boolean)) {
      if (NO_CORS.test(u) && window.Net && !Net.onMac() && !Net.isNative()) {
        if (!(window.NKConfig && NKConfig.ready())) { err = new Error('источник сейчас не ответил'); continue; } // → the list saved in the app
        try { const t = await (await Net.callFn('fetch-public', { kind: 'rss', url: u }, { raw: true, auth: 'optional' })).text(); if (/<rss|<feed|<channel/i.test(t)) return t; } catch (e) { err = e; }
        continue;
      }
      try {
        const t = window.Net && Net.get ? await Net.get(u, { kind: 'rss', as: 'text', cache: 'no-store' }) : await (await fetch(u, { cache: 'no-store' })).text();
        if (/<rss|<feed|<channel/i.test(t)) return t;
        err = new Error('лента пришла в непонятном виде');
      } catch (e) { err = e; }
    }
    const off = typeof navigator !== 'undefined' && navigator.onLine === false;
    throw new Error(off ? 'нет интернета' : err && err.nk ? err.message.replace(/^./, c => c.toLowerCase()) : 'источник сейчас не ответил');
  }
  const tag = (el, name) => { const x = el.getElementsByTagName(name)[0]; return x ? x.textContent.trim() : ''; };
  function parseRss(xml, src) {
    const doc = new DOMParser().parseFromString(String(xml).replace(/^﻿/, ''), 'application/xml');
    if (doc.getElementsByTagName('parsererror').length && !doc.getElementsByTagName('item').length) throw new Error('лента пришла в непонятном виде');
    return [...doc.getElementsByTagName('item')].slice(0, MAX_ITEMS).map(it => {
      const enc = it.getElementsByTagName('enclosure')[0];
      const media = it.getElementsByTagName('media:content')[0] || it.getElementsByTagName('media:thumbnail')[0];
      const itImg = it.getElementsByTagName('itunes:image')[0];
      const encUrl = enc ? enc.getAttribute('url') : '';
      const encType = enc ? enc.getAttribute('type') || '' : '';
      const isAudio = /^audio\//.test(encType) || /\.mp3(\?|$)/i.test(encUrl || '');
      const image = safeUrl(!isAudio && encUrl) || safeUrl(media && media.getAttribute('url')) || safeUrl(itImg && itImg.getAttribute('href'));
      const desc = U.stripHtml(tag(it, 'description').replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, ''));
      const dur = tag(it, 'itunes:duration');
      const sec = /:/.test(dur) ? dur.split(':').reduce((a, x) => a * 60 + (+x || 0), 0) : (+dur || 0);
      const guid = tag(it, 'guid');
      const d = Date.parse(tag(it, 'pubDate') || tag(it, 'dc:date'));
      return {
        id: guid || tag(it, 'link') || tag(it, 'title'),
        src, title: clip(U.stripHtml(tag(it, 'title')), 300), summary: clip(desc, 1200),
        link: safeUrl(tag(it, 'link')) || (src === 'NRK Supernytt' && /^l_[\w-]+$/.test(guid) ? `${SN.home}/${guid}` : ''),
        image, cat: clip(tag(it, 'category'), 40), date: isNaN(d) ? 0 : d,
        audio: isAudio ? safeUrl(encUrl) : '', duration: sec,
      };
    }).filter(x => x.title);
  }
  const mem = {};
  async function feed(url, alt, src, force, direct = true) {
    const all = lsGet(LS_FEEDS, {});
    const hit = mem[url] || all[url];
    if (!force && hit && Date.now() - hit.t < TTL) return { items: hit.items, t: hit.t };
    try {
      const items = parseRss(await fetchText(url, alt), src);
      const rec = { t: Date.now(), items };
      mem[url] = rec;
      // only the RSS fields (title, summary, picture, link) are kept — never article text
      Object.keys(all).forEach(k => { if (Date.now() - all[k].t > 3 * 86400e3) delete all[k]; });
      all[url] = rec; lsSet(LS_FEEDS, all);
      return { items, t: rec.t };
    } catch (e) {
      if (hit) return { items: hit.items, t: hit.t, stale: e.message };
      throw e;
    }
  }

  /* ---------------- what you know: words on your cards (+ «✓ Знаю») ---------------- */
  let index = null;
  const knownSet = () => new Set(lsGet(LS_KNOWN, []));
  function buildIndex() {
    const m = new Map();
    if (window.Store && Store.state) {
      Store.cards().forEach(c => {
        const st = Store.status(c) === 'learned' ? 'k' : 'l';
        String(c.no || '').split('\n')[0].toLowerCase().replace(/\([^)]*\)/g, ' ').split(/[,/;]/).forEach(x => {
          x = x.replace(/[«»"“”!?.:]/g, ' ').trim().replace(/^(en|ei|et|å)\s+/, '').trim();
          if (!x || /\s/.test(x)) return; // phrases do not colour single words
          if (m.get(x) !== 'k') m.set(x, st);
        });
      });
    }
    knownSet().forEach(w => m.set(w, 'k'));
    index = m;
    return m;
  }

  /* ---------------- dictionary form: Lexicon (offline) → cache → Ordbøkene ---------------- */
  let lc = null, lcT = null;
  const lemCache = () => { if (!lc) lc = lsGet('nk-lemma', {}) || {}; return lc; };
  const lemSave = () => { clearTimeout(lcT); lcT = setTimeout(() => {
    // merge with what the textbook may have saved meanwhile (same cache)
    const disk = lsGet('nk-lemma', {}) || {};
    lsSet('nk-lemma', Object.assign(disk, lemCache()));
  }, 800); };
  const asList = r => (Array.isArray(r) ? r : [r]).map(x => x && typeof x === 'object' ? (x.lemma || x.no || x.word || '') : x)
    .map(x => String(x || '').toLowerCase().trim()).filter(Boolean);
  function lemmaSync(w) {
    if (window.Lexicon && typeof Lexicon.lemma === 'function') {
      try { const r = Lexicon.lemma(w); if (r && typeof r.then !== 'function') { const l = asList(r); if (l.length) return l; } } catch (e) { /* lexicon not ready */ }
    }
    const c = lemCache()[w];
    return c === undefined ? null : (c ? [c] : []);
  }
  const pending = new Map();
  async function lemmas(w) {
    const s = lemmaSync(w); if (s) return s;
    if (pending.has(w)) return pending.get(w);
    const p = (async () => {
      if (window.Lexicon && typeof Lexicon.lemma === 'function') {
        try { const l = asList(await Lexicon.lemma(w)); if (l.length) return l; } catch (e) { /* fall back to Ordbøkene */ }
      }
      // the same lookup as «📘 Мой учебник» (Ordbøkene suggest): husene → hus, kjørte → kjøre
      let l = w;
      try {
        const j = await (await fetch(`https://ord.uib.no/api/suggest?q=${encodeURIComponent(w)}&dict=bm&n=5&include=ei&dform=int`)).json();
        const a = (j && j.a) || {};
        const ex = (a.exact || []).map(x => Array.isArray(x) ? x[0] : x);
        const inf = (a.inflect || []).map(x => Array.isArray(x) ? x[0] : x);
        if (ex.some(x => String(x).toLowerCase() === w)) l = w;
        else if (inf.length) l = String(inf[0]).toLowerCase();
        else if (!ex.length) l = '';
      } catch (e) { pending.delete(w); return []; } // offline: not cached, tried again later
      lemCache()[w] = l; lemSave();
      return l ? [l] : [];
    })();
    pending.set(w, p);
    return p;
  }
  /** 'k' known · 'l' learning · 'n' new */
  function classify(w) {
    const ix = index || buildIndex();
    if (ix.has(w)) return ix.get(w);
    const l = lemmaSync(w) || [];
    let best = 'n';
    l.forEach(x => { const s = ix.get(x); if (s === 'k') best = 'k'; else if (s === 'l' && best !== 'k') best = 'l'; });
    return best;
  }

  /* ---------------- text → coloured words ---------------- */
  // nynorsk (NRK writes part of its news in it): strong markers count 2, weak 1; «seier» (победа) and «blei» are bokmål too
  const NN_STRONG = /(?<![\p{L}])(ikkje|frå|eg|noreg|kva|korleis|kvifor|berre|mykje|sjølv|kven|enno|vere|òg|framleis|betre|ho)(?![\p{L}])/giu;
  const NN_WEAK = /(?<![\p{L}])(vore|vart|meir|noko|nokon|heile|fekk|fleire|ein|eit|dei|desse|gjekk|kjem|heilt|elevar|seinare)(?![\p{L}])/giu;
  const nynorsk = t => (String(t).match(NN_STRONG) || []).length * 2 + (String(t).match(NN_WEAK) || []).length >= 2;
  const sentsOf = it => it._s || (it._s = [it.title].concat(it.summary ? Study.splitSent(it.summary) : []).filter(Boolean));
  const WORD = /^([^\p{L}\p{N}]*)([\p{L}\p{N}](?:[\p{L}\p{N}'’.\-]*[\p{L}\p{N}])?)?(.*)$/u;
  /** each word chunk: { pre, core, post, low, k, name } (k = index used by Study.glossOf) */
  function tokens(s) {
    let k = -1;
    return String(s).split(/(\s+)/).map(ch => {
      if (!/\p{L}/u.test(ch)) return { raw: ch };
      k++;
      const m = ch.match(WORD) || ['', '', ch, ''];
      const core = m[2] || '';
      if (!/\p{L}/u.test(core)) return { raw: ch, k };
      const name = Study.isName(ch, k) || (/^\p{Lu}[\p{Lu}\d-]+$/u.test(core)); // names, NRK / USA / EM
      return { pre: m[1] || '', core, post: m[3] || '', low: core.toLowerCase(), k, ch, name };
    });
  }
  function sentHtml(s, view) {
    return tokens(s).map(t => {
      if (t.raw != null) return U.esc(t.raw);
      const cls = t.name ? 'nm' : 'k-' + classify(t.low);
      let w = `<span class="nw ${cls}" data-w="${U.esc(t.low)}" data-k="${t.k}" role="button" tabindex="0">${U.esc(t.core)}</span>`;
      if (view === 'word') {
        const g = Study.glossOf(s, t.ch, t.k);
        if (!(g === '' && t.name)) w = `<span class="wbw">${w}<span class="wbw-ru">(${g ? U.esc(g) : g === '' ? '—' : '…'})</span></span>`;
      }
      return U.esc(t.pre) + w + U.esc(t.post);
    }).join('');
  }
  function stats(it) {
    const r = { k: 0, l: 0, n: 0 };
    sentsOf(it).forEach(s => tokens(s).forEach(t => { if (t.core && !t.name) r[classify(t.low)]++; }));
    r.total = r.k + r.l + r.n;
    r.pct = r.total ? Math.round(r.k / r.total * 100) : 0;
    return r;
  }

  /* ---------------- the window ---------------- */
  const EXV = () => (window.Study && Study.EXV) || [['asis', 'Как есть', ''], ['sent', 'По предложениям', ''], ['word', 'Слово (перевод)', '']];
  const ago = t => {
    if (!t) return '';
    const m = (Date.now() - t) / 60000;
    if (m < 1) return 'только что';
    if (m < 60) return Math.round(m) + ' мин назад';
    if (m < 24 * 60) return Math.round(m / 60) + ' ч назад';
    return U.fmtDate(t);
  };
  const dur = s => s ? (s >= 3600 ? `${Math.floor(s / 3600)} ч ${Math.round(s % 3600 / 60)} мин` : `${Math.round(s / 60)} мин`) : '';

  const News = {
    _m: null, items: [], ui: null,

    open(tab) {
      if (this._m && document.body.contains(this._m.el)) this._m.close();
      if (!window.Store || !Store.state) { UI.toast('Приложение ещё загружается — попробуйте через секунду', 'warn'); return; }
      buildIndex();
      this.ui = Object.assign({ tab: 'kt', nrk: 'top', bm: true, easy: false }, lsGet(LS_VIEW, {}));
      if (tab) this.ui.tab = tab;
      const tabs = [['kt', 'Klar Tale', 'Новости простым языком — для тех, кто учит норвежский'], ['nrk', 'NRK', 'Новости NRK — обычный язык, сложнее'], ['sn', '🎧 Supernytt', 'Подкаст NRK Supernytt — новости для детей']];
      const m = this._m = UI.modal({
        title: '📰 Новости простым языком', cls: 'wide nw-modal',
        body: `<div class="nw-tabs" role="tablist">${tabs.map(([id, l, t]) => `<button role="tab" data-nw-tab="${id}" title="${U.esc(t)}">${U.esc(l)}</button>`).join('')}</div>
          <div class="nw-legend small"><span class="nw k-k">знаю</span><span class="nw k-l">учу</span><span class="nw k-n">новое</span>
            <span class="muted">— цвет по вашим карточкам. Нажмите на слово: перевод, 🔊, ➕ карточка.</span></div>
          <div class="nw-bar" data-nw-bar></div>
          <div class="nw-list" data-nw-list></div>
          <p class="tiny muted nw-legal">Тексты и фото © Klar Tale и NRK. Здесь — только заголовок, анонс и картинка из их RSS-лент; полная статья — «↗ Читать на сайте». Звук Supernytt играет прямо с серверов NRK.</p>`,
        onClose: () => { this.hidePop(); if (this._io) this._io.disconnect(); this._m = null; },
      });
      m.el.addEventListener('click', e => this.onClick(e));
      if (window.TrBadge) TrBadge.mount(m.$('.modal-head'), { place: 'news' }); // 🌐 who translates now
      m.el.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('nw')) { e.preventDefault(); this.wordPop(e.target); } });
      m.$('.modal-body').addEventListener('scroll', () => this.hidePop(), { passive: true });
      // one player at a time
      m.el.addEventListener('play', e => { m.$$('audio').forEach(a => { if (a !== e.target) a.pause(); }); }, true);
      this.tab(this.ui.tab);
      return m;
    },
    saveUi() { lsSet(LS_VIEW, this.ui); },

    tab(id) {
      const m = this._m; if (!m) return;
      this.ui.tab = id; this.saveUi(); this.hidePop();
      m.$$('[data-nw-tab]').forEach(b => { const on = b.dataset.nwTab === id; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
      m.$('.nw-legend').hidden = false;
      if (id === 'sn') return this.loadSn();
      return this.loadNews();
    },
    barHtml() {
      const u = this.ui;
      const nrk = u.tab === 'nrk' ? `<div class="nw-chips">${NRK.map(f => `<button class="chip ${u.nrk === f.id ? 'active' : ''}" data-nw-sec="${f.id}">${U.esc(f.name)}</button>`).join('')}</div>` : '';
      return `${nrk}<div class="nw-tools-row">
        <label class="nw-check" title="Сначала новости, где вы знаете больше слов"><input type="checkbox" data-nw-easy ${u.easy ? 'checked' : ''}> Сначала простые</label>
        ${u.tab === 'nrk' ? `<label class="nw-check" title="NRK пишет часть новостей на нюношке (ikkje, frå, eg…) — приложение учит букмолу"><input type="checkbox" data-nw-bm ${u.bm ? 'checked' : ''}> Только букмол</label>` : ''}
        <span class="grow"></span>
        <button class="btn sm listen-cta" data-nw="listen-all" title="Заголовки по очереди: по-норвежски, затем перевод — в наушниках или через динамик">🎧 Слушать заголовки</button>
        ${window.PrintX ? '<button class="btn sm ghost" data-nw="print" aria-haspopup="dialog" title="Распечатать заголовки и анонсы (с переводом, где он уже есть) или сохранить в Word — только для себя">🖨 Печать</button>' : ''}
        <button class="btn sm ghost" data-nw="refresh" title="Загрузить заново (иначе — раз в час)">🔄</button>
        <span class="small muted" data-nw-when></span></div>`;
    },
    srcOf() { return this.ui.tab === 'nrk' ? NRK.find(f => f.id === this.ui.nrk) || NRK[0] : KT; },

    async loadNews(force) {
      const m = this._m; if (!m) return;
      const tab = this.ui.tab, f = this.srcOf();
      m.$('[data-nw-bar]').innerHTML = this.barHtml();
      const list = m.$('[data-nw-list]');
      list.innerHTML = '<div class="nw-empty"><span class="spinner sm"></span> загружаю новости…</div>';
      let r;
      try { r = await feed(f.url, f.alt, tab === 'kt' ? 'Klar Tale' : 'NRK', force); }
      catch (e) {
        if (this._m !== m || this.ui.tab !== tab) return;
        list.innerHTML = `<div class="nw-empty"><div class="mt-warn"><span>📡</span><span><b>Не удалось загрузить новости</b>: ${U.esc(U.niceErr(e, '', true))}. Проверьте интернет и нажмите «Повторить».</span></div>
          <div class="row" style="gap:8px;justify-content:center;margin-top:10px"><button class="btn primary" data-nw="refresh">🔄 Повторить</button>
          <a class="btn ghost" href="${tab === 'kt' ? KT.home : 'https://www.nrk.no'}" target="_blank" rel="noopener noreferrer">↗ Открыть сайт</a></div></div>`;
        return;
      }
      if (this._m !== m || this.ui.tab !== tab || (tab === 'nrk' && this.srcOf() !== f)) return;
      this.items = r.items.map(x => Object.assign({}, x, { nn: tab === 'nrk' && nynorsk(x.title + ' ' + x.summary) }));
      const when = m.$('[data-nw-when]');
      if (when) when.textContent = r.stale ? `⚠️ нет связи — показаны сохранённые (${ago(r.t)})` : `обновлено ${ago(r.t)}`;
      this.drawList();
    },
    visible() {
      let a = this.items.filter(x => !(this.ui.tab === 'nrk' && this.ui.bm && x.nn));
      if (this.ui.easy) a = a.map(x => [x, stats(x).pct]).sort((p, q) => q[1] - p[1]).map(p => p[0]);
      return a;
    },
    drawList() {
      const m = this._m; if (!m) return;
      const list = m.$('[data-nw-list]');
      const a = this.visible();
      const hidden = this.items.length - a.length;
      list.innerHTML = a.length ? a.map(it => this.itemHtml(it)).join('') + (hidden ? `<div class="small muted center" style="padding:8px">Скрыто ${hidden} ${U.plural(hidden, ['новость', 'новости', 'новостей'])} на нюношке</div>` : '')
        : `<div class="nw-empty muted">${hidden ? 'Все новости этого раздела — на нюношке. Снимите «Только букмол», чтобы их увидеть.' : 'В ленте пока пусто.'}</div>`;
      this.observe();
    },
    find(el) { const a = el && el.closest('[data-nw-item]'); return a ? (this.items.find(x => x.id === a.dataset.nwItem) || null) : null; },

    itemHtml(it) {
      const v = it.view || 'asis';
      const img = it.image ? `<a class="nw-img" href="${U.esc(it.link || it.image)}" target="_blank" rel="noopener noreferrer" tabindex="-1"><img loading="lazy" decoding="async" referrerpolicy="no-referrer" src="${U.esc(it.image)}" alt="" onerror="this.parentNode.remove()"></a>` : '';
      return `<article class="nw-item ${it.audio ? 'nw-audio' : ''}" data-nw-item="${U.esc(it.id)}">${img}
        <div class="nw-main">
          <div class="nw-meta"><b class="nw-src">${U.esc(it.src)}</b>${it.date ? ` · ${U.esc(ago(it.date))}` : ''}${it.cat ? ` · ${U.esc(it.cat)}` : ''}${it.duration ? ` · ⏱ ${U.esc(dur(it.duration))}` : ''}${it.nn ? ' <span class="chip nw-nn" title="Написано на нюношке — второй письменной норме норвежского">нюношк</span>' : ''}</div>
          <div data-nw-body>${this.bodyHtml(it, v)}</div>
          ${it.audio ? `<audio controls preload="none" src="${U.esc(it.audio)}"></audio>` : ''}
          <div class="nw-tools">
            ${this.pctHtml(it)}
            <span class="seg-mini ex-view sm" title="Как показывать перевод">${EXV().map(([id, l, t]) => `<button class="${v === id ? 'active' : ''}" data-nwv="${id}" title="${U.esc(t)}">${U.esc(l)}</button>`).join('')}</span>
            <button class="btn sm listen-cta" data-nw="listen" title="Читать вслух: предложение по-норвежски → его перевод — в наушниках или через динамик">🎧 Слушать</button>
            ${it.link ? `<a class="btn sm ghost" href="${U.esc(it.link)}" target="_blank" rel="noopener noreferrer">↗ ${it.audio ? 'NRK' : 'Читать на сайте'}</a>` : ''}
          </div>
        </div></article>`;
    },
    bodyHtml(it, v) {
      const s = sentsOf(it);
      const sent = (x, i) => {
        const inner = `<span class="nw-s" data-si="${i}">${sentHtml(x, v)}</span>`;
        if (v !== 'sent') return inner;
        const tr = Study.sentTr(x);
        return `${inner} <span class="ex-ru-in">(${tr ? U.esc(tr) : tr === '' ? '—' : '…'})</span>`;
      };
      const title = `<h3 class="nw-title ${v === 'word' ? 'wbw-line' : ''}" lang="nb">${sent(s[0], 0)}</h3>`;
      const sum = s.length > 1 ? `<div class="nw-sum ${v === 'word' ? 'wbw-line' : ''}" lang="nb">${s.slice(1).map((x, i) => sent(x, i + 1)).join(' ')}</div>` : '';
      let ru = '';
      if (v === 'asis') {
        const tr = s.map(x => Study.sentTr(x));
        ru = tr.every(x => x) ? `<div class="ex-ru nw-ru">${U.esc(tr.join(' '))}</div>`
          : `<button class="btn sm ghost nw-show-tr" data-nw="tr">🇷🇺 Показать перевод</button>`;
      }
      // word view: «Дословно: …» under the words, when the neural network made a literal translation that differs
      if (v === 'word' && Study.litHtml) ru = Study.litHtml(s.map(x => [x]));
      return title + sum + ru;
    },
    pctHtml(it) {
      const r = stats(it);
      return `<span class="nw-pct" title="Известных слов: ${r.k} из ${r.total} · учу: ${r.l} · новых: ${r.n}">
        <span class="nw-pbar"><i class="pk" style="width:${r.total ? r.k / r.total * 100 : 0}%"></i><i class="pl" style="width:${r.total ? r.l / r.total * 100 : 0}%"></i></span>
        <b>${r.pct}%</b> известных слов</span>`;
    },
    redrawItem(it) {
      const m = this._m; if (!m || !it) return;
      const el = m.el.querySelector(`[data-nw-item="${CSS.escape(it.id)}"]`); if (!el) return;
      el.querySelector('[data-nw-body]').innerHTML = this.bodyHtml(it, it.view || 'asis');
      this.refreshPct(el, it);
      el.querySelectorAll('[data-nwv]').forEach(b => b.classList.toggle('active', b.dataset.nwv === (it.view || 'asis')));
    },
    refreshPct(el, it) { const p = el.querySelector('.nw-pct'); if (p) p.outerHTML = this.pctHtml(it); },
    /** recolour every word on screen (after a card was made, a lemma arrived, «✓ Знаю») */
    recolour(words) {
      const m = this._m; if (!m) return;
      const sel = words ? words.map(w => `.nw[data-w="${CSS.escape(w)}"]`).join(',') : '.nw[data-w]';
      if (!sel) return;
      const touched = new Set();
      m.el.querySelectorAll(sel).forEach(s => {
        if (s.classList.contains('nm')) return;
        const c = 'k-' + classify(s.dataset.w);
        if (!s.classList.contains(c)) { s.classList.remove('k-k', 'k-l', 'k-n'); s.classList.add(c); }
        const a = s.closest('[data-nw-item]'); if (a) touched.add(a);
      });
      touched.forEach(a => { const it = this.find(a); if (it) this.refreshPct(a, it); });
    },

    /* the dictionary form of words you might know: looked up only for news that are on screen */
    observe() {
      const m = this._m; if (!m) return;
      if (this._io) this._io.disconnect();
      if (!index || !index.size) return; // no cards yet: every word is new anyway
      this._io = new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) return;
        this._io.unobserve(e.target);
        const it = this.find(e.target); if (!it) return;
        const need = new Set();
        sentsOf(it).forEach(s => tokens(s).forEach(t => { if (t.core && !t.name && !/\d/.test(t.low) && classify(t.low) === 'n' && lemmaSync(t.low) == null) need.add(t.low); }));
        need.forEach(w => this.queue(w));
      }), { root: m.$('.modal-body'), rootMargin: '200px' });
      m.$$('[data-nw-item]').forEach(a => this._io.observe(a));
    },
    _q: [], _run: 0, _looked: 0,
    queue(w) {
      if (this._q.includes(w) || this._looked > 1500) return;
      this._q.push(w);
      while (this._run < 4 && this._q.length) {
        this._run++;
        (async () => {
          while (this._q.length) {
            const x = this._q.shift(); this._looked++;
            const l = await lemmas(x);
            if (l.some(y => index && index.has(y))) this.recolourSoon(x);
          }
          this._run--;
        })();
      }
    },
    recolourSoon(w) {
      (this._rw = this._rw || new Set()).add(w);
      clearTimeout(this._rt);
      this._rt = setTimeout(() => { const a = [...this._rw]; this._rw.clear(); this.recolour(a); }, 250);
    },

    /* ---------------- clicks ---------------- */
    async onClick(e) {
      const t = e.target;
      const tabB = t.closest('[data-nw-tab]'); if (tabB) { this.tab(tabB.dataset.nwTab); return; }
      const sec = t.closest('[data-nw-sec]');
      if (sec) { this.ui.nrk = sec.dataset.nwSec; this.saveUi(); this.loadNews(); return; }
      if (t.matches('[data-nw-easy]')) { this.ui.easy = t.checked; this.saveUi(); this.drawList(); return; }
      if (t.matches('[data-nw-bm]')) { this.ui.bm = t.checked; this.saveUi(); this.drawList(); return; }
      const w = t.closest('.nw[data-w]');
      if (w && t.closest('[data-nw-item]')) { e.preventDefault(); this.wordPop(w); return; }
      const vb = t.closest('[data-nwv]');
      if (vb) { const it = this.find(vb); if (it) this.setView(it, vb.dataset.nwv); return; }
      const b = t.closest('[data-nw]'); if (!b) return;
      const act = b.dataset.nw, it = this.find(b);
      if (act === 'refresh') { if (this.ui.tab === 'sn') this.loadSn(true); else this.loadNews(true); }
      if (act === 'tr' && it) this.setView(it, 'asis', b);
      if (act === 'listen' && it) this.listen([it], b);
      if (act === 'listen-all') this.listen(this.visible().slice(0, 25), b, true);
      if (act === 'print') this.print();
    },
    /** 🖨 «Печать и файлы» (js/printx.js): the headlines and summaries shown now (only what the RSS feeds publish),
     *  sentence by sentence with the translations already made; © Klar Tale / NRK — for personal use only */
    print() {
      if (!window.PrintX) return;
      const a = this.visible().slice(0, MAX_ITEMS), f = this.srcOf(), src = this.ui.tab === 'nrk' ? 'NRK' : 'Klar Tale';
      const blocks = [];
      a.forEach(it => { const ss = sentsOf(it), tr = ss.map(x => Study.sentTr(x)); blocks.push(Object.assign({ no: ss.join(' ') }, tr.every(Boolean) ? { ru: tr.join(' ') } : {})); });
      const name = this.ui.tab === 'nrk' ? `NRK · ${f.name}` : 'Klar Tale';
      PrintX.text({ title: `Новости: ${name}`, author: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }), blocks,
        source: { id: `news:${this.ui.tab}:${f.id}`, name: `${src} (RSS)`, kind: 'channel', url: f.home || f.url, protected: true } });
    },
    async translateItem(it, view, btn) {
      const s = sentsOf(it);
      const label = btn && btn.innerHTML;
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> перевожу…'; }
      let t = null;
      Translators.onPut = () => { if (t) return; t = setTimeout(() => { t = null; this.redrawItem(it); }, 400); };
      try { await Study.translateUnits(view === 'word' ? [] : s, view === 'word' ? s : []); }
      catch (e) { UI.toast('Перевод: ' + e.message, 'warn'); }
      finally { Translators.onPut = null; clearTimeout(t); if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = label; } }
      if (Study._lastFail && Study.failModal) Study.failModal(() => this.translateItem(it, view));
    },
    async setView(it, v, btn) {
      it.view = v;
      // 🎓 «Учить по книге»: three articles read with a translation — «Сделать колоду из прочитанного?» (js/learnby.js)
      if (window.LearnBy && LearnBy.offer) LearnBy.offer({ key: 'news', title: 'Новости простым языком', page: it.id, src: 'news', open: () => News.open(), text: () => sentsOf(it).join(' ') });
      this.redrawItem(it);
      const s = sentsOf(it);
      const missing = v === 'word' ? s.some(x => tokens(x).some(tk => tk.core && Study.glossOf(x, tk.ch, tk.k) === undefined))
        : s.some(x => Study.sentTr(x) === undefined);
      if (!missing || (v === 'asis' && !btn)) return;
      await this.translateItem(it, v, btn);
      this.redrawItem(it);
    },
    /** 🔊 sentence in Norwegian → its translation → next (Listen player: works with the screen off) */
    async listen(items, btn, titlesOnly) {
      if (!items.length) { UI.toast('Здесь нечего читать', 'warn'); return; }
      try { Listen.prime(); } catch (e) { /* not on this device */ }
      const units = items.map(it => titlesOnly ? [it.title] : sentsOf(it));
      const all = [].concat(...units);
      if (all.some(x => Study.sentTr(x) === undefined)) {
        const label = btn && btn.innerHTML;
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> перевожу…'; }
        try { await Study.translateUnits(all, []); } catch (e) { /* read Norwegian only */ }
        if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = label; }
        items.forEach(it => { if ((it.view || 'asis') !== 'word') this.redrawItem(it); });
      }
      const pieces = items.map((it, i) => ({ title: clip(it.title, 70), text: units[i].map(x => { const tr = Study.sentTr(x); return tr ? `${x}\n${tr}` : x; }).join('\n') }));
      Listen.startText(titlesOnly ? `📰 ${items[0].src}: заголовки` : `📰 ${clip(items[0].title, 60)}`, pieces, { loop: false });
    },

    /* ---------------- word bubble ---------------- */
    hidePop() { if (this._pop) { this._pop.remove(); this._pop = null; } this._cur = null; },
    async wordPop(span) {
      const it = this.find(span); if (!it) return;
      const form = span.dataset.w, k = +span.dataset.k;
      const sEl = span.closest('.nw-s');
      const sentence = sEl ? sentsOf(it)[+sEl.dataset.si] || '' : '';
      if (this._cur && this._cur.span === span) { this.hidePop(); return; }
      this.hidePop();
      if (window.SelPop) SelPop.hide();
      const cur = this._cur = { span, form, it, sentence, k, lem: lemmaSync(form) };
      const pop = this._pop = document.createElement('div');
      pop.className = 'sel-pop nw-pop';
      pop.setAttribute('role', 'dialog');
      document.body.appendChild(pop);
      const draw = () => {
        if (this._cur !== cur) return;
        const st = classify(form);
        const lem = (cur.lem || []).find(x => x && x !== form);
        const chip = span.classList.contains('nm') ? '<span class="chip">имя / сокращение</span>'
          : st === 'k' ? '<span class="chip learned">✓ знаю</span>' : st === 'l' ? '<span class="chip nw-chip-l">учу — есть в карточках</span>' : '<span class="chip nw-chip-n">новое слово</span>';
        const ctx = cur.ctx && cur.ctx !== cur.tr ? `<div class="small muted">в этом предложении: <b>${U.esc(cur.ctx)}</b></div>` : '';
        pop.innerHTML = `<div class="nw-pop-head"><b lang="nb">${U.esc(span.textContent)}</b>${lem ? ` <span class="muted">→ словарная форма</span> <b lang="nb">${U.esc(lem)}</b>` : ''} ${chip}</div>
          <div class="sp-tr">${cur.tr === undefined ? '<span class="spinner sm"></span> перевожу…' : cur.tr ? `<b>${U.esc(cur.tr)}</b><small> · ${cur.by && cur.by.length ? U.esc(Translators.provNames(cur.by)) : 'словарик'}</small>` : cur.setup ? `<span class="muted">${U.esc(cur.err)}</span> <button class="btn sm" data-np="setup">Подключить перевод</button>` : `<span class="muted">Перевод не пришёл${cur.err ? ': ' + U.esc(cur.err) : ''}</span>`}</div>
          ${ctx}
          <div class="sp-row">
            <button class="media-btn sm" data-np="say" title="Произнести">🔊</button>
            <button class="btn sm primary" data-np="card" title="Карточка в колоду «${U.esc(DECK)}» — с предложением из новости как примером">➕ В карточку</button>
            <button class="btn sm" data-np="more" title="Выбрать: слово или всё предложение, колоду, перевод — или заполнить карточку самому (картинка, переводчики)">✍️ Выбрать…</button>
            <button class="btn sm ${knownSet().has(form) ? 'good' : 'ghost'}" data-np="known" title="${knownSet().has(form) ? 'Снять отметку «знаю»' : 'Я знаю это слово — не выделять его (карточка не нужна)'}">✓ Знаю</button>
            <button class="icon-btn sm" data-np="x" title="Закрыть">✕</button>
          </div>`;
        this.place(pop, span);
      };
      pop.addEventListener('mousedown', e => e.stopPropagation());
      pop.addEventListener('click', e => {
        const b = e.target.closest('[data-np]'); if (!b) return;
        e.stopPropagation();
        const a = b.dataset.np;
        if (a === 'x') this.hidePop();
        if (a === 'say') { const say = window.TTS && TTS.speak; if (say) TTS.speak(span.textContent, 'no', { place: 'news' }); }
        if (a === 'known') this.toggleKnown(form, cur, draw);
        if (a === 'card') this.makeCard(cur, b);
        if (a === 'more') this.moreCard(cur);
        if (a === 'setup') { this.hidePop(); if (window.AI && AI.need) AI.need('Перевод слов в новостях'); }
      });
      draw();
      // dictionary form + translation (small words from the built-in list first, then the translators)
      cur.ready = (async () => {
        if (!span.classList.contains('nm')) { try { cur.lem = await lemmas(form); } catch (e) { cur.lem = []; } }
        if (this._cur === cur) draw();
        const head = (cur.lem || []).find(Boolean) || form;
        const g = Study.glossOf(sentence, span.textContent, k);
        if (g) cur.ctx = g;
        let tr = NoGloss.get(form) || NoGloss.get(head);
        let by = [];
        if (!tr) {
          try { const r = await Translators.translateMany([head], 'no', 'ru'); tr = Study.cleanGloss(head, r.out[0]) || String(r.out[0] || '').trim(); by = r.by || []; cur.err = r.error; cur.setup = !!r.needSetup; }
          catch (e) { tr = ''; cur.err = U.niceErr(e, '', true); }
        }
        cur.tr = tr || cur.ctx || ''; cur.by = tr ? by : []; cur.head = head;
      })();
      await cur.ready;
      draw();
    },
    place(pop, span) {
      const r = span.getBoundingClientRect();
      const pw = Math.min(360, window.innerWidth - 16);
      pop.style.width = pw + 'px';
      const left = Math.max(8, Math.min(window.innerWidth - pw - 8, r.left + r.width / 2 - pw / 2));
      const ph = pop.offsetHeight || 120;
      const top = r.top - ph - 10 > 8 ? r.top - ph - 10 : Math.min(window.innerHeight - ph - 8, r.bottom + 10);
      pop.style.left = left + 'px'; pop.style.top = Math.max(8, top) + 'px';
    },
    toggleKnown(form, cur, draw) {
      const s = knownSet();
      if (s.has(form)) s.delete(form); else s.add(form);
      lsSet(LS_KNOWN, [...s].slice(-5000));
      buildIndex();
      this.recolour();
      draw();
    },
    async makeCard(c, btn) {
      if (!c || c.saving) return;
      c.saving = true;
      if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner sm"></span> сохраняю…'; }
      try {
        if (c.ready) await c.ready;
        const no = c.head || c.form;
        let deck = Store.decks().find(d => d.name === DECK);
        if (!deck) deck = Store.addDeck(DECK, 'Слова из новостей Klar Tale и NRK (заголовки и анонсы) — с предложением, где встретилось слово');
        if (Store.cards(deck.id).some(x => U.norm(String(x.no).split('\n')[0], { stripArticles: true }) === U.norm(no))) {
          UI.toast(`«${no}» уже есть в «${deck.name}»`, 'warn'); this.hidePop(); return;
        }
        let exRu = '', exBy = [];
        if (c.sentence) {
          exRu = Study.sentTr(c.sentence) || '';
          if (!exRu) { try { const r = await Translators.translateMany([c.sentence], 'no', 'ru'); exRu = r.out[0] || ''; exBy = r.by || []; } catch (e) { /* no example translation */ } }
        }
        const by = [...new Set([...(c.by || []), ...exBy])];
        const it = c.it;
        const label = `📰 ${it.src} · ${clip(it.title, 140)}${it.link ? ' · ' + it.link : ''}`;
        Store.addCard(deck.id, {
          no, ru: c.tr || '', example: c.sentence || '', exampleRu: exRu,
          description: label + (no !== c.form ? `\nв тексте: ${c.form}` : ''),
          tags: ['news'],
          history: [Prov.entry('import', 'create', null, `📰 ${it.src}: «${clip(it.title, 120)}»`), ...Translators.provKeys(by).map(k => Prov.entry(k, 'translate', null, 'перевод слова и примера из новости'))],
          mtWarn: Translators.mtFlag(by),
        });
        await Store.saveNow();
        UI.toast(`➕ «${no.slice(0, 40)}» → ${deck.name}${Translators.mtFlag(by) ? ' · ⚠️ перевод машинный — перепроверьте' : ''}`, 'good', 3500);
        buildIndex();
        this.recolour();
        this.hidePop();
        if (window.App && App.view && App.view.name === 'deck') App.render();
      } catch (e) {
        UI.toast('Карточка не сохранилась: ' + e.message, 'bad');
        c.saving = false;
        if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = '➕ В карточку'; }
      }
    },

    /** «✍️ Выбрать…»: the CardMaker window — the word, its form in the text or the whole sentence; automatically or by hand */
    async moreCard(c) {
      if (!c) return;
      this.hidePop();
      if (c.ready) { try { await c.ready; } catch (e) { /* the window translates itself */ } }
      const it = c.it || {};
      const no = c.head || c.form;
      const options = [{ id: 'word', kind: 'word', label: '🔤 Слово (словарная форма)', no, ru: c.tr || '', by: c.by || [], byNote: c.tr && !(c.by || []).length ? 'словарик' : '',
        example: c.sentence || '', description: no !== c.form ? `в тексте: ${c.form}` : '', checked: true }];
      if (c.form && U.norm(c.form) !== U.norm(no)) options.push({ id: 'form', kind: 'word', label: '🔤 Форма, как в тексте', no: c.form, ru: '', example: c.sentence || '' });
      if (c.sentence) options.push({ id: 'sent', kind: 'sent', label: '💬 Всё предложение', no: c.sentence, ru: Study.sentTr(c.sentence) || '' });
      CardMaker.open({
        key: 'news', deck: DECK, deckDesc: 'Слова из новостей Klar Tale и NRK (заголовки и анонсы) — с предложением, где встретилось слово', tags: ['news'],
        source: { by: 'import', label: `📰 ${it.src || 'новости'} · ${clip(it.title || '', 140)}`, url: it.link || '', name: it.src || 'новость' },
        options,
        onDone: () => { buildIndex(); this.recolour(); },
      });
    },

    /* ---------------- 🎧 NRK Supernytt ---------------- */
    async loadSn(force) {
      const m = this._m; if (!m) return;
      m.$('[data-nw-bar]').innerHTML = `<div class="nw-tools-row"><span class="small muted">🎧 Supernytt — новости NRK для детей: медленно, просто и понятно. Звук — с сайта NRK.</span><span class="grow"></span>
        <button class="btn sm ghost" data-nw="refresh" title="Загрузить заново">🔄</button></div>`;
      const list = m.$('[data-nw-list]');
      list.innerHTML = '<div class="nw-empty"><span class="spinner sm"></span> загружаю выпуски…</div>';
      let items = null, note = '';
      try { items = (await feed(SN.url, '', 'NRK Supernytt', force, false)).items.filter(x => x.audio && x.duration >= 60); }
      catch (e) {
        // NRK does not let other sites read this list (no CORS) — the list saved in the app; the sound still comes from NRK
        try {
          const j = await (await fetch(SN.snapshot, { cache: 'no-cache' })).json();
          items = (j.items || []).map(x => ({ id: x.link || x.audio, src: 'NRK Supernytt', title: x.title, summary: x.summary || '', link: safeUrl(x.link), image: safeUrl(x.image), audio: safeUrl(x.audio), duration: x.duration || 0, date: Date.parse(x.date) || 0, cat: '' }));
          note = 'Свежий список выпусков сейчас не загрузился — показан список, сохранённый в приложении. Звук играет с серверов NRK.';
        } catch (e2) { items = null; }
      }
      if (this._m !== m || this.ui.tab !== 'sn') return;
      if (!items || !items.length) {
        list.innerHTML = `<div class="nw-empty"><div class="mt-warn"><span>📡</span><span><b>Выпуски не загрузились.</b> Послушайте Supernytt на сайте NRK.</span></div>
          <div class="row" style="gap:8px;justify-content:center;margin-top:10px"><a class="btn primary" href="${SN.home}" target="_blank" rel="noopener noreferrer">↗ NRK Radio</a><a class="btn ghost" href="${SN.tv}" target="_blank" rel="noopener noreferrer">↗ Supernytt на NRK TV</a></div></div>`;
        return;
      }
      items.sort((a, b) => b.date - a.date);
      const old = items[0].date && Date.now() - items[0].date > 365 * 86400e3;
      this.items = items;
      list.innerHTML = `${note ? `<div class="mt-warn nw-note"><span>ℹ️</span><span>${U.esc(note)}</span></div>` : ''}
        ${old ? `<div class="mt-warn nw-note"><span>📅</span><span>В подкасте только архивные выпуски (последний — ${U.esc(U.fmtDate(items[0].date))}). Свежий Supernytt выходит каждый будний день как видео — <a href="${SN.tv}" target="_blank" rel="noopener noreferrer">↗ NRK TV</a>.</span></div>` : ''}
        ${items.map(it => this.itemHtml(it)).join('')}`;
      this.observe();
    },
  };

  // a click anywhere else closes the word bubble; Escape closes the bubble only (not the window under it)
  document.addEventListener('mousedown', e => { if (News._pop && !e.target.closest('.nw-pop') && !e.target.closest('.nw[data-w]')) News.hidePop(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && News._pop) { e.stopPropagation(); e.preventDefault(); News.hidePop(); } }, true);
  window.addEventListener('resize', () => News.hidePop());

  // for tests / other modules
  News._t = { parseRss, nynorsk, tokens, classify, buildIndex, lemmas, stats, feeds: { KT, NRK, SN } };
  window.News = News;
})();
