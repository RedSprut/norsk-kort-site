/* ============ 📢 «Норвежские каналы в Телеграме» + the Telegram intro ============
 *  - the shipped list data/tg-channels.json (filled by the owner through «Экспорт списка»), plus channels the user adds
 *    by @username / t.me link — cards: title, description, category, members; «Открыть в Телеграме» · «Добавить в
 *    приложение» (the channel joins the user's Telegram sources) · «Убрать»;
 *  - 🧭 «Подобрать норвежские каналы» (the owner's tool; Telegram connected): his dialogs → ONLY public channels and
 *    groups with a @username (private chats, private groups and personal chats are never listed) → tick, describe, category
 *    → saved here + «Экспорт списка» (tg-channels.json, to be shipped as data/tg-channels.json). ONLY channels where
 *    Norwegian is taught: the picker scores title / description / @name (nScore) — «⭐ учат норвежский» are ticked by
 *    default, the rest stay off (the owner can still tick them, with a warning); the export carries only the ticked ones,
 *    plus each channel's newest post number and latest post numbers (`last`, `posts`) read through the bridge;
 *  - 📖 «Читать здесь» (works on the site, without the bridge and without any login): the channel's newest posts through
 *    Telegram's own embeddable post widget (t.me/<channel>/<post>?embed=1, sandboxed iframes; videos play inside);
 *    «➕ В карточки» under a post takes the words the user copies from it. A channel that forbids the widget (protected
 *    content: every post is the same «Please open Telegram» bubble) gets a calm explanation instead of blank bubbles;
 *  - 📖 with the user's own Telegram on the Mac bridge the app draws the posts itself (/api/tg/posts — read-only, public
 *    channels): text with Telegram's formatting, pictures, video / sound in the app's players, views, reactions — so
 *    protected channels are readable too; «＋ В карточки» takes the words selected in the post (or the whole post), and
 *    cards from a protected channel say «из канала @… (личное обучение)» in their source;
 *  - 🌐 off the Mac (the site, the store apps) with the Norsk Kort server: «Читать здесь» draws the posts of a CURATED channel
 *    (data/tg-channels.json) from the server's tg-public — text, picture, «＋ В карточки» with the post's own words. A channel
 *    outside that list (added by the user) is never shown inside the app: «Открыть в Телеграме» (Net.linkOut on not_curated).
 *    No server yet → Telegram's own widget, as before. The owner's Mac: everything exactly as before;
 *  - the intro window (paper plane + chat bubbles) on the first visit of the Telegram section, then a soft reminder — only
 *    when no other guide is on screen (one guide at a time: the intro also counts as the section's coach marks).
 * Everything that comes from outside (the shared file, Telegram) is cleaned (Store.Safe) and escaped (U.esc): text only.
 */
(function () {
  const UI_KEY = 'nk-tg-ui', CUR_KEY = 'nk-tg-curated', MINE_KEY = 'nk-tg-mine', HIDE_KEY = 'nk-tg-hidden';
  const ls = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* full / private mode */ } };
  const state = () => ls(UI_KEY, {}) || {};
  const patch = o => { const s = Object.assign(state(), o); lsSet(UI_KEY, s); return s; };
  const esc = s => U.esc(s);
  const reduce = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const TG = (s = 18) => Telegram.TG_SVG(s);
  const modalOpen = () => !!document.querySelector('#modal-root > .modal-backdrop:not(.closing)');
  /** another guide is on screen (a tour, coach marks, the welcome, a hint bubble, the preloader) — ours waits: one at a time */
  const otherGuide = () => {
    try {
      if (window.Help && (Help.touring || (Help.now && Help.now()) || Help._here)) return true;
      if (window.CoachMarks && CoachMarks.running && CoachMarks.running()) return true;
    } catch (e) { /* not loaded */ }
    return !!document.querySelector('#nkp, body > .hl, .hc-here, .nk-here, .nk-hint, .hc-hint, .lt-hint, .guide-modal, .hc-modal');
  };

  const CATS = [['lessons', '📘', 'уроки'], ['words', '🔤', 'слова'], ['video', '🎬', 'видео'], ['news', '📰', 'новости'], ['chat', '💬', 'общение']];
  const CAT = Object.fromEntries(CATS.map(([k, i, t]) => [k, { i, t }]));
  /** ⭐ channels that are perfect for cards (posts of «норвежская фраза = перевод» pairs) — shown first with a badge */
  const FEATURED = {
    norsk24: 'Готовые фразы с переводом в каждом посте («Vi skravlet hele kvelden = Мы проболтали весь вечер») — нажмите «В карточки» под постом, и все пары станут карточками.',
  };
  /* «Только каналы, где учат норвежский»: the owner's picker suggests channels by their title / description / @name.
   * (no look-behind: old Safari must still parse this file) */
  const NOR = /norsk|norge|norw|noreg|nynorsk|bokm[aå]l|норвеж|норвег|норвез|норвеґ/i;
  // the language itself
  const LANG = /norsk|nynorsk|bokm[aå]l|norwegian\s*(?:language|lessons?|for|with|words?|grammar|course)|learn\s*norwegian|норвежск(?:ий|ого|ому|им)\s*(?:язык|язик|с|со|для|за|по|онлайн|легко|просто|нуля)|норвежский(?:$|[^а-яё])|норвезьк|(?:язык|мова|мови|мову)\s*норв/i;
  // learning words
  const LEARN = /язык|язик|(?:^|[^а-яёіїєґ])мов[аиуоі]|урок|(?:^|[^а-яёіїєґ])(?:учи|учим|изуч|выуч|вивч)|граммат|граматик|(?:^|[^а-яёіїєґ])слов[аоуе]?(?:$|[^а-яё])|лексик|произнош|вимов|разговор|розмов|курс|kurs|spr[aå]k|(?:^|[^a-zæøå])lær|grammatikk|gloser|ordforr[aå]d|uttale|undervisning|lesson|learn|study|vocab|grammar|speak|snakk|tutor|репетитор|преподав|учител|викладач|школ|skole|(?:^|[^a-z0-9])[ab][12](?:$|[^a-z0-9])|pr[øo]ve|bergenstest|экзамен|іспит|начинающ|початків|с нуля|з нуля|фраз|идиом|ідіом|dagens ord|слово дня/i;
  // other topics — news, jobs, travel, shopping…: not for the shared list
  const OFF = /работ|вакан|(?:^|[^a-z])jobb?|stilling|недвижим|eiendom|бизнес|business|крипт|crypto|bitcoin|новост|nyhet|news|туризм|turism|travel|путешеств|подорож|знакомств|dating|(?:^|[^а-яё])купл|прода|аренд|оренд|авто|казино|casino|ставк|tipping|odds|betting|политик|politikk|налог|skatt|иммиграц|імміграц|рынок|marked|скидк|магазин|shop|sale|погод|weather|футбол|fotball|юмор|мем|memes?|барахолк|loppemarked|finn\.no|переезд|переїзд|жизнь в норвегии|життя в норвегії|life in norway|livet i norge/i;
  /** 3 — «учат норвежский» (suggested, ticked by default) · 2 — «возможно» · 1 — about Norway, not the language · 0 — nothing */
  function nScore(title, about, username) {
    const t = `${title || ''} ${about || ''} ${username || ''}`;
    const nor = NOR.test(t), lang = LANG.test(t), learn = LEARN.test(t), off = OFF.test(t);
    if ((lang && (learn || !off)) || (nor && learn && !off)) return 3;
    if (lang || (nor && learn)) return 2;
    return nor ? 1 : 0;
  }
  const okUser = u => /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(String(u || ''));
  /** the owner's own machine (or the app opened as a file): the Mac bridge may be mentioned there — never on the site */
  const atHome = () => (window.Telegram && Telegram.home ? Telegram.home() : true);
  /** the Mac bridge answered (js/net.js) — the only case for /api/tg/* */
  const macBridge = () => (window.Net && Net.isMacBridge ? Net.isMacBridge() : !!(window.AI && AI.bridge && AI.bridge.up));
  /** the Norsk Kort server is set up — tg-public draws curated channels off the Mac */
  const serverOn = () => !!(window.Net && Net.callFn && window.NKConfig && NKConfig.ready());
  const IC = (n, sz) => (window.NavIcons && NavIcons.icon ? NavIcons.icon(n, sz) : '');
  /** off the Mac only the shipped (curated) list is read inside the app; the rest opens in Telegram */
  const readable = c => atHome() || macBridge() || !c || c.from === 'ship';
  const ids = a => (Array.isArray(a) ? [...new Set(a.map(n => Math.round(+n)).filter(n => n > 0 && n < 1e10))].sort((x, y) => y - x).slice(0, 40) : []);
  /** «@name», «t.me/name», «https://t.me/s/name/123», «telegram.me/name» → name; invite links (private) → '' */
  function parseUser(v) {
    v = String(v || '').trim();
    if (/joinchat|\/\+|^\+/.test(v)) return '';
    v = v.replace(/^https?:\/\//i, '').replace(/^(www\.)?(t\.me|telegram\.me|telegram\.dog)\/(s\/)?/i, '').replace(/^@/, '').split(/[/?#\s]/)[0];
    return okUser(v) && !/bot$/i.test(v) ? v : '';
  }
  const numRu = n => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',').replace(',0', '') + ' млн' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace('.', ',').replace(',0', '') + ' тыс.' : String(n));
  const hue = u => [...String(u)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  /** one channel from any source → plain, safe fields (or null) */
  function clean(x) {
    if (!x || typeof x !== 'object') return null;
    const username = parseUser(x.username || x.link || '');
    if (!username) return null;
    const S = Store.Safe;
    const one = s => S.text(String(s == null ? '' : s), 400).replace(/\s+/g, ' ').trim();
    return {
      username,
      title: one(x.title).slice(0, 90) || '@' + username,
      about: one(x.about).slice(0, 220),
      category: CAT[x.category] ? x.category : 'lessons',
      members: Math.max(0, Math.min(1e9, Math.round(+x.members || 0))) || 0,
      // the newest post's number and the latest posts (exported from the owner's Telegram) — the site shows them without a server
      last: Math.max(0, Math.min(1e10, Math.round(+x.last || 0))) || 0,
      posts: ids(x.posts),
      tid: /^-?\d{1,20}$/.test(String(x.tid == null ? '' : x.tid)) ? String(x.tid) : '', // the owner's local note only — never exported
    };
  }
  const lower = u => String(u).toLowerCase();

  /* ---------------- 📖 a channel on the site: Telegram's OWN post widget (no server, no login, no third party) ----------------
   * https://t.me/<channel>/<post>?embed=1 is Telegram's official embeddable post (t.me/s/<channel> refuses frames). The
   * widget tells its height with postMessage {event:'resize', height} — only from https://t.me, only a number is read.
   * «Post not found» is a tiny bubble (≈53 px): so a deleted / not yet written post number is recognised and skipped.
   * The newest post number comes with the shipped list (exported from the owner's Telegram) and is checked forward
   * here; for a channel the user added himself it is looked for with a few hidden widgets (a coarse-to-fine search). */
  const LAST_KEY = 'nk-tg-last', NOT_FOUND = 80;
  const winOf = new WeakMap(); // the widget's window -> its height handler
  let msgOn = false;
  function onMsg() {
    if (msgOn) return; msgOn = true;
    window.addEventListener('message', e => {
      if (e.origin !== 'https://t.me' || !e.source) return;
      const fn = winOf.get(e.source); if (!fn) return;
      let d = null;
      try { d = typeof e.data === 'string' && e.data.length < 2000 ? JSON.parse(e.data) : null; } catch (x) { return; }
      if (!d || d.event !== 'resize') return;
      const h = Math.round(+d.height);
      if (h > 0 && h < 20000) fn(h);
    });
  }
  /** an <iframe> with one post — sandboxed: scripts (the player), its own t.me storage, links open in a new tab; it can never
   *  navigate or script this page */
  function postFrame(u, id, onH) {
    onMsg();
    const f = document.createElement('iframe');
    const dark = document.documentElement.dataset.theme === 'dark';
    f.src = `https://t.me/${encodeURIComponent(u)}/${encodeURIComponent(id)}?embed=1${dark ? '&dark=1' : ''}`;
    f.title = `Пост ${id} из канала @${u}`;
    f.className = 'tcr-frame';
    f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
    f.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media');
    f.setAttribute('allowfullscreen', '');
    f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    f._onH = onH;
    return f;
  }
  const mount = (host, f) => { host.appendChild(f); if (f.contentWindow) winOf.set(f.contentWindow, h => f._onH && f._onH(h)); return f; };
  /** does post `id` exist? true / false; null — Telegram did not answer in time */
  function probe(host, u, id, ms = 15000) {
    return new Promise(res => {
      let done = false;
      const fin = v => { if (done) return; done = true; clearTimeout(t); f.remove(); res(v); };
      const f = postFrame(u, id, h => fin(h >= NOT_FOUND));
      const t = setTimeout(() => fin(null), ms);
      mount(host, f);
    });
  }
  async function pool(list, n, fn) {
    const out = []; let k = 0;
    await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (k < list.length) { const i = k++; out[i] = await fn(list[i]); } }));
    return out;
  }
  /** the newest post number of a channel nobody exported: powers of two, then 8 points a step (≈ 40 tiny widgets) */
  async function discover(host, u, alive) {
    const has = list => pool(list, 8, id => (alive() ? probe(host, u, id) : null));
    const pts = []; for (let v = 8; v <= 524288; v *= 2) pts.push(v);
    let r = await has(pts), L = 0, answered = r.some(x => x !== null);
    r.forEach((ok, i) => { if (ok) L = pts[i]; });
    if (!L) {
      const small = [1, 2, 3, 4, 5, 6, 7];
      const r2 = await has(small);
      answered = answered || r2.some(x => x !== null);
      r2.forEach((ok, i) => { if (ok) L = small[i]; });
      return { last: L, answered };
    }
    let U = L * 2;
    while (U - L > 6 && alive()) {
      const step = (U - L) / 8, mids = [];
      for (let k = 1; k < 8; k++) mids.push(Math.round(L + step * k));
      const rr = await has(mids);
      let nl = L; rr.forEach((ok, i) => { if (ok) nl = Math.max(nl, mids[i]); });
      const above = mids.filter(x => x > nl);
      U = above.length ? above[0] : U; L = nl;
    }
    return { last: L, answered: true };
  }

  /* ---------------- 📖 the posts drawn by the app itself — through the user's own Telegram on the Mac bridge ----------------
   * /api/tg/posts?u=<channel> (bridge/tg.py, read-only, public channels only): text + Telegram's formatting (bold, italic,
   * links…), views, reactions, pictures, video and sound (the bridge's own media proxy). Protected channels («Please open
   * Telegram to view this post» in the widget) are readable this way. Everything is escaped here: the text is never HTML. */
  const enc = encodeURIComponent;
  const OK_URL = /^(https?:\/\/|tg:\/\/|mailto:)/i;
  function inlineHtml(text, ents) {
    const n = text.length, cut = new Set([0, n]);
    ents.forEach(e => { cut.add(e.o); cut.add(e.o + e.l); });
    const pts = [...cut].filter(x => x >= 0 && x <= n).sort((a, b) => a - b);
    let out = '';
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      let s = esc(text.slice(a, b));
      if (!s) continue;
      const on = ents.filter(e => e.o <= a && e.o + e.l >= b);
      const has = t => on.find(e => e.t === t);
      if (has('code')) s = `<code>${s}</code>`;
      if (has('s')) s = `<s>${s}</s>`;
      if (has('u')) s = `<u>${s}</u>`;
      if (has('i')) s = `<em>${s}</em>`;
      if (has('b')) s = `<strong>${s}</strong>`;
      if (has('spoiler')) s = `<span class="tcn-spoiler" tabindex="0" title="Скрытый текст — нажмите, чтобы показать">${s}</span>`;
      const ln = on.find(e => ['a', 'url', 'mention', 'email'].includes(e.t));
      if (ln) {
        const whole = text.slice(ln.o, ln.o + ln.l).trim();
        const href = ln.t === 'a' ? ln.url : ln.t === 'mention' ? (okUser(whole.replace(/^@/, '')) ? 'https://t.me/' + whole.replace(/^@/, '') : '')
          : ln.t === 'email' ? 'mailto:' + whole : /^https?:\/\//i.test(whole) ? whole : /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(whole) ? 'https://' + whole : '';
        if (href && OK_URL.test(href)) s = `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${s}</a>`;
      }
      out += s;
    }
    return out;
  }
  /** a post's text + entities → safe HTML; quotes and code blocks are blocks of their own */
  function postText(text, ents) {
    text = String(text || '');
    ents = (Array.isArray(ents) ? ents : []).filter(e => e && +e.l > 0 && +e.o >= 0 && +e.o < text.length).map(e => ({ t: String(e.t), o: +e.o, l: Math.min(+e.l, text.length - +e.o), url: String(e.url || '') }));
    const blocks = ents.filter(e => e.t === 'quote' || e.t === 'pre').sort((a, b) => a.o - b.o);
    const inl = ents.filter(e => e.t !== 'quote' && e.t !== 'pre');
    const part = (a, b) => inlineHtml(text.slice(a, b), inl.filter(e => e.o < b && e.o + e.l > a).map(e => Object.assign({}, e, { o: Math.max(e.o, a) - a, l: Math.min(e.o + e.l, b) - Math.max(e.o, a) })));
    let out = '', at = 0;
    blocks.forEach(e => {
      if (e.o < at) return; // overlapping blocks: the first one wins
      out += part(at, e.o);
      out += e.t === 'quote' ? `<blockquote class="tcn-q">${part(e.o, e.o + e.l)}</blockquote>` : `<pre class="tcn-pre"><code>${esc(text.slice(e.o, e.o + e.l))}</code></pre>`;
      at = e.o + e.l;
    });
    return out + part(at, text.length);
  }
  /** the server's html_safe once more on this side: only b strong i em u s code pre br and https links survive (text otherwise) */
  const KEEP = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'CODE', 'PRE', 'BR', 'A']);
  function cleanHtml(h) {
    const box = new DOMParser().parseFromString(`<div>${String(h || '').slice(0, 40000)}</div>`, 'text/html').body.firstChild;
    const walk = n => [...n.childNodes].forEach(c => {
      if (c.nodeType === 3) return;
      if (c.nodeType !== 1 || !KEEP.has(c.tagName)) { if (c.nodeType === 1) { walk(c); c.replaceWith(...c.childNodes); } else c.remove(); return; }
      const href = c.tagName === 'A' ? c.getAttribute('href') || '' : '';
      [...c.attributes].forEach(a => c.removeAttribute(a.name));
      if (c.tagName === 'A') {
        if (!/^https:\/\/[^\s"'<>]+$/i.test(href)) { walk(c); c.replaceWith(...c.childNodes); return; }
        c.setAttribute('href', href); c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener noreferrer nofollow');
      }
      walk(c);
    });
    if (!box) return '';
    walk(box);
    return box.innerHTML;
  }
  const mss = t => { t = Math.max(0, Math.floor(t || 0)); const h = Math.floor(t / 3600); return h ? `${h}:${String(Math.floor(t % 3600 / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  const mb = n => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} МБ` : `${Math.max(1, Math.round((n || 0) / 1e3))} КБ`);
  function whenRu(iso) {
    const d = new Date(iso); if (isNaN(d)) return '';
    const now = new Date(), o = { day: 'numeric', month: 'long' };
    if (d.getFullYear() !== now.getFullYear()) o.year = 'numeric';
    return `${d.toLocaleDateString('ru-RU', o).replace(/\s*г\.$/, '')}, ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  }
  /** GET /api/tg/posts → {chat, posts, next} | {old: true} (a bridge without it) | {error} */
  async function fetchPosts(u, before) {
    try {
      const r = await fetch(`/api/tg/posts?u=${enc(u)}&limit=8${before ? '&before=' + enc(before) : ''}`, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (r.status === 404 && /unknown action/.test(j.error || '')) return { old: true };
      if (!r.ok || !Array.isArray(j.posts)) return { error: j.error || String(r.status) };
      return j;
    } catch (e) { return { error: 'offline' }; }
  }
  /** ↻ the bridge starts itself again (a new version of bridge/tg.py) → true when it answers again */
  async function restartBridge() {
    if (window.Voices && Voices.restartBridge) { try { return await Voices.restartBridge(); } catch (e) { return false; } }
    try { const r = await fetch('/api/restart', { method: 'POST', cache: 'no-store', headers: { 'content-type': 'application/json' }, body: '{}' }); if (r.status === 404) return false; } catch (e) { /* closes while restarting */ }
    for (let i = 0; i < 40; i++) {
      await new Promise(res => setTimeout(res, 700));
      try { const r = await fetch('/api/status?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) { if (window.AI && AI.detectBridge) await AI.detectBridge(); return true; } } catch (e) { /* not up yet */ }
    }
    return false;
  }
  /** the text selected inside this post (the selection may start or end anywhere in it) */
  function selIn(post) {
    const s = window.getSelection && getSelection();
    if (!post || !s || s.isCollapsed || !s.rangeCount) return '';
    const r = s.getRangeAt(0), n = r.commonAncestorContainer, e = n.nodeType === 1 ? n : n.parentElement;
    return e && post.contains(e) ? Store.Safe.text(s.toString(), 20000).trim() : '';
  }
  const SKEL = n => Array.from({ length: n }, () => `<div class="tcn-post tcn-skel" aria-hidden="true"><div class="tcn-head"><i class="tcn-ava sk"></i><span class="tcn-who"><i class="sk-l w45"></i><i class="sk-l w25"></i></span></div><i class="sk-l"></i><i class="sk-l"></i><i class="sk-l w70"></i><i class="sk-box"></i></div>`).join('');

  /* ---------------- the lists ---------------- */
  let shippedP = null;
  const TgChan = {
    CATS, parseUser, clean, nScore,
    shipped() {
      if (!shippedP) {
        shippedP = fetch('data/tg-channels.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : [])).catch(() => [])
          .then(a => (Array.isArray(a) ? a.slice(0, 300).map(clean).filter(Boolean) : []));
      }
      return shippedP;
    },
    curated() { return (ls(CUR_KEY, []) || []).map(clean).filter(Boolean); },
    mine() { return (ls(MINE_KEY, []) || []).map(clean).filter(Boolean); },
    hidden() { return new Set((ls(HIDE_KEY, []) || []).map(lower)); },
    /** shipped ∪ the owner's own selection (not published yet) ∪ the user's own — without the removed ones */
    async list() {
      const hid = this.hidden(), seen = new Set(), out = [];
      const add = (arr, from) => arr.forEach(c => { const k = lower(c.username); if (seen.has(k) || hid.has(k)) return; seen.add(k); out.push(Object.assign({ from }, c)); });
      add(await this.shipped(), 'ship'); add(this.curated(), 'draft'); add(this.mine(), 'mine');
      // ⭐ the best channels for making cards come first (stable order otherwise)
      return out.map((c, i) => ({ c, i, f: FEATURED[lower(c.username)] ? 0 : 1 })).sort((a, b) => a.f - b.f || a.i - b.i).map(x => x.c);
    },
    added(u) {
      const k = lower(u), st = Store.settings;
      if ((st.tgExtra || []).some(x => lower(x) === k)) return true;
      const off = new Set((st.tgOff || []).map(lower));
      return Telegram.CHANNELS.some(([x]) => lower(x) === k) && !off.has(k);
    },
    addToApp(u) {
      const st = Store.settings, k = lower(u);
      if (!Telegram.CHANNELS.some(([x]) => lower(x) === k)) Store.setSetting('tgExtra', [...new Set([...(st.tgExtra || []), u])]);
      Store.setSetting('tgOff', (st.tgOff || []).filter(x => lower(x) !== k));
      patch({ used: state().used || Date.now() });
    },
    removeFromApp(u) {
      const st = Store.settings, k = lower(u);
      Store.setSetting('tgExtra', (st.tgExtra || []).filter(x => lower(x) !== k));
    },

    /* ---------------- the block (Telegram section, «Что выучить?») ---------------- */
    cardHtml(c) {
      const cat = CAT[c.category] || CAT.lessons, on = this.added(c.username), u = esc(c.username), fe = FEATURED[lower(c.username)];
      return `<article class="tgc-card${fe ? ' tgc-featured' : ''}" data-tgc="${u}" style="--h:${hue(c.username)}">
          <span class="tgc-ava" aria-hidden="true">${esc((c.title.replace(/[^\p{L}\p{N}]/gu, '')[0] || c.username[0]).toUpperCase())}</span>
          <div class="tgc-main">
            <b class="tgc-title">${esc(c.title)}</b>
            ${fe ? `<span class="tgc-best" title="${esc(fe)}">⭐ Идеально для карточек</span><p class="tgc-best-why">${esc(fe)}</p>` : ''}
            <span class="tgc-meta"><span class="tgc-cat">${cat.i} ${cat.t}</span>${c.members ? `<span>👥 ${numRu(c.members)}</span>` : ''}<span class="tgc-at">@${u}</span>${c.from === 'draft' ? '<span class="tgc-draft" title="Ваш выбор — ещё не в общем списке">черновик</span>' : c.from === 'mine' ? '<span class="tgc-draft mine">добавили вы</span>' : ''}</span>
            ${c.about ? `<p class="tgc-about">${esc(c.about)}</p>` : ''}
          </div>
          <div class="tgc-acts">
            ${readable(c) ? `<button type="button" class="btn sm primary tgc-read" data-tgc-read="${u}" title="Свежие посты канала — прямо здесь, без входа в Телеграм">📖 Читать здесь</button>
            <a class="btn sm tgc-open" href="https://t.me/${u}" target="_blank" rel="noopener noreferrer" data-tgc-open="${u}">${TG(16)} Открыть в Телеграме</a>`
              : `<a class="btn sm primary tgc-open" href="https://t.me/${u}" target="_blank" rel="noopener noreferrer" data-tgc-open="${u}" title="Этого канала нет в проверенном списке — он открывается в самом Телеграме">${TG(16)} Открыть в Телеграме</a>`}
            ${on ? `<button type="button" class="btn sm tgc-in" data-tgc-out="${u}" title="Уже в поиске по слову — нажмите, чтобы убрать">✓ В поиске</button>`
              : `<button type="button" class="btn sm tgc-addbtn" data-tgc-add="${u}" title="Посты канала будут искаться во вкладке «Найти по слову»">➕ В поиск по слову</button>`}
            <button type="button" class="btn sm ghost tgc-del" data-tgc-del="${u}" title="Убрать из этого списка">Убрать</button>
          </div>
        </article>`;
    },
    emptyHtml() {
      return `<div class="tgc-empty">
          <div class="tgc-empty-ico" aria-hidden="true">${TG(40)}</div>
          <b>Список скоро появится</b>
          <p>Мы собираем проверенные норвежские каналы. А пока найти их легко самим:</p>
          <ol class="tgc-how">
            <li><span aria-hidden="true">🔎</span><span>Откройте Telegram и нажмите на поиск.</span></li>
            <li><span aria-hidden="true">⌨️</span><span>Напишите <b>«norsk»</b> или <b>«Норвегия язык»</b> — появятся каналы и группы.</span></li>
            <li><span aria-hidden="true">🔗</span><span>Откройте канал → его название → <b>«Поделиться»</b> или <b>«Копировать ссылку»</b>.</span></li>
            <li><span aria-hidden="true">📋</span><span>Вставьте ссылку ниже — канал появится здесь.</span></li>
          </ol>
        </div>`;
    },
    /** el: where to draw; o.compact — the short version for «Что вы хотите выучить?» */
    async render(el, o = {}) {
      if (!el) return;
      const authorized = !!(Telegram.status && Telegram.status.authorized);
      if (authorized) patch({ used: state().used || Date.now() });
      el.classList.add('tgc');
      el.innerHTML = `<div class="tgc-head">
            <div><h3>${TG(22)} Норвежские каналы в Телеграме</h3>
            <p class="tgc-sub">Открытые каналы, где учат норвежский: уроки, слова, видео. Читайте их прямо здесь — входить в Телеграм не нужно.</p></div>
            ${authorized && !o.compact ? '<button type="button" class="btn sm tgc-pick" data-tgc-pick title="Ваши каналы и группы — выбрать норвежские для общего списка">🧭 Подобрать норвежские каналы</button>' : ''}
          </div>
          <div class="tgc-filter" data-tgcf hidden></div>
          <div class="tgc-list" data-tgcl><div class="small muted"><span class="spinner sm"></span> загружаю…</div></div>
          ${o.compact ? '<button type="button" class="btn sm ghost tgc-all" data-tgc-allbtn>Все каналы и добавить свой ›</button>' : `
          <form class="tgc-add" data-tgc-form autocomplete="off">
            <label class="tgc-add-l"><span>Добавить канал</span><input class="input" data-tgc-in placeholder="@username или ссылка t.me/…" inputmode="url" spellcheck="false" aria-label="Ссылка на канал или @username"></label>
            <button type="submit" class="btn primary">＋ Добавить</button>
          </form>
          <p class="tgc-privacy">🔒 В список попадают только открытые каналы с публичной ссылкой. Ваши личные чаты не показываются никому.</p>
          ${this.curated().length ? `<div class="tgc-owner"><span>🧭 Ваш выбор: <b>${this.curated().length}</b> — пока виден только вам.</span><button type="button" class="btn sm" data-tgc-export>⬇ Экспорт списка</button></div>` : ''}`}`;
      let filter = 'all';
      const draw = async () => {
        const all = await this.list();
        el._tgcAll = all;
        const list = o.compact ? all.slice(0, 4) : all.filter(c => filter === 'all' || c.category === filter);
        const fl = el.querySelector('[data-tgcf]');
        const used = new Set(all.map(c => c.category));
        if (fl) {
          fl.hidden = o.compact || all.length < 4 || used.size < 2;
          if (!fl.hidden) fl.innerHTML = [['all', '', 'все']].concat(CATS.filter(([k]) => used.has(k))).map(([k, i, t]) => `<button type="button" class="chip ${filter === k ? 'active' : ''}" data-tgc-f="${k}">${i} ${t}</button>`).join('');
        }
        const box = el.querySelector('[data-tgcl]');
        box.innerHTML = list.length ? list.map(c => this.cardHtml(c)).join('') : all.length ? '<div class="small muted">В этой категории пока пусто.</div>' : o.compact ? `<div class="tgc-empty sm"><span aria-hidden="true">🔎</span><span>Найдите каналы в Telegram по словам <b>«norsk»</b> или <b>«Норвегия язык»</b> — и добавьте ссылку в разделе Telegram.</span></div>` : this.emptyHtml();
        const ab = el.querySelector('[data-tgc-allbtn]'); if (ab) ab.textContent = all.length > 4 ? `Все каналы (${all.length}) и добавить свой ›` : 'Добавить свой канал ›';
      };
      el._tgcDraw = draw;
      if (!el._tgcBound) {
        el._tgcBound = true;
        el.addEventListener('click', async e => {
          const f = e.target.closest('[data-tgc-f]'); if (f) { filter = f.dataset.tgcF; draw(); return; }
          const rd = e.target.closest('[data-tgc-read]');
          if (rd) {
            patch({ used: state().used || Date.now() });
            if (o.compact) { Telegram._chanRead = rd.dataset.tgcRead; if (o.onAll) o.onAll(); else Telegram.open(null, 'channels'); }
            else this.read(el, rd.dataset.tgcRead, o);
            return;
          }
          const add = e.target.closest('[data-tgc-add]');
          if (add) {
            this.addToApp(add.dataset.tgcAdd);
            UI.toast(macBridge() ? `Канал @${add.dataset.tgcAdd} добавлен — его посты теперь ищутся во вкладках «Найти по слову» и «Создать карточки из чата»` : `Канал @${add.dataset.tgcAdd} добавлен в поиск по слову${readable((el._tgcAll || []).find(x => lower(x.username) === lower(add.dataset.tgcAdd))) ? '. А читать его можно прямо здесь — кнопка «📖 Читать здесь»' : ' — посты откроются в Телеграме'}`, 'good', 6000);
            el._tgcDraw(); return;
          }
          const out = e.target.closest('[data-tgc-out]');
          if (out) { this.removeFromApp(out.dataset.tgcOut); UI.toast(`Канал @${out.dataset.tgcOut} больше не источник карточек`, '', 3000); el._tgcDraw(); return; }
          const del = e.target.closest('[data-tgc-del]');
          if (del) {
            const u = del.dataset.tgcDel, was = this.added(u);
            const card = del.closest('.tgc-card'); if (card) card.classList.add('gone');
            lsSet(HIDE_KEY, [...this.hidden(), lower(u)]);
            lsSet(MINE_KEY, (ls(MINE_KEY, []) || []).filter(c => lower(c.username || '') !== lower(u)));
            if (was) this.removeFromApp(u);
            setTimeout(() => el._tgcDraw(), reduce() ? 0 : 220);
            UI.toastAction(`Канал @${u} убран`, '↶ Вернуть', () => { lsSet(HIDE_KEY, [...this.hidden()].filter(x => x !== lower(u))); if (was) this.addToApp(u); el._tgcDraw(); }, 7000, '🙈');
            return;
          }
          if (e.target.closest('[data-tgc-open]')) patch({ used: state().used || Date.now() });
          if (e.target.closest('[data-tgc-pick]')) { this.curate(() => this.render(el, o)); return; }
          if (e.target.closest('[data-tgc-export]')) { this.exportList(); return; }
          if (e.target.closest('[data-tgc-allbtn]')) { if (o.onAll) o.onAll(); else Telegram.open(null, 'channels'); }
        });
        el.addEventListener('submit', e => {
          const form = e.target.closest('[data-tgc-form]'); if (!form) return;
          e.preventDefault();
          const inp = form.querySelector('[data-tgc-in]');
          const u = parseUser(inp.value);
          if (!u) { UI.toast(/joinchat|\/\+/.test(inp.value) ? 'Это ссылка-приглашение в закрытую группу — добавить можно только открытые каналы' : 'Вставьте ссылку t.me/… или @имя канала', 'warn', 4500); inp.focus(); return; }
          const mine = (ls(MINE_KEY, []) || []).filter(c => lower(c.username || '') !== lower(u));
          mine.unshift({ username: u, title: '@' + u, about: '', category: 'lessons', members: 0 });
          lsSet(MINE_KEY, mine.slice(0, 200));
          lsSet(HIDE_KEY, [...this.hidden()].filter(x => x !== lower(u)));
          this.addToApp(u);
          inp.value = '';
          UI.toast(`Канал @${u} добавлен`, 'good', 3000);
          el._tgcDraw();
        });
      }
      await draw();
    },
    /** the short block in «Что вы хотите выучить?» */
    mini(el, onAll) { return this.render(el, { compact: true, onAll }); },

    /* ---------------- 📖 «Читать здесь»: the channel's newest posts through Telegram's own widget ---------------- */
    async read(el, u, o = {}) {
      u = parseUser(u); if (!el || !u) return;
      const c = (await this.list()).find(x => lower(x.username) === lower(u)) || clean({ username: u }) || { username: u, title: '@' + u, posts: [], last: 0, members: 0 };
      const S = { u, c, next: 0, known: [], misses: 0, shown: 0, busy: false };
      el._tcr = S;
      const alive = () => el._tcr === S && el.isConnected;
      const link = `https://t.me/${esc(u)}`;
      el.innerHTML = `<div class="tcr">
          <div class="tcr-head" style="--h:${hue(u)}">
            <button type="button" class="btn ghost tcr-back" data-tcr-back>‹ Все каналы</button>
            <span class="tgc-ava" data-tcr-ava aria-hidden="true">${esc((c.title.replace(/[^\p{L}\p{N}]/gu, '')[0] || u[0]).toUpperCase())}</span>
            <div class="tcr-who"><b data-tcr-title>${esc(c.title)}</b><small>@${esc(u)}${c.members ? ` · 👥 ${numRu(c.members)}` : ''}</small></div>
            <a class="btn tcr-open" href="${link}" target="_blank" rel="noopener noreferrer">${TG(18)} Открыть в Телеграме</a>
          </div>
          ${c.about ? `<p class="tcr-about">${esc(c.about)}</p>` : ''}
          <p class="tcr-note" data-tcr-note><span aria-hidden="true">📖</span><span>Посты показывает сам Телеграм — входить не нужно. Видео и картинки открываются прямо в посте. Понравились слова? Выделите их в посте, скопируйте и нажмите <b>«➕ В карточки»</b>.</span></p>
          <div class="tcr-tip" data-tcr-tip hidden></div>
          <div class="tcr-status" data-tcr-status role="status"><span class="spinner sm"></span> Ищу свежие посты…</div>
          <div class="tcr-list" data-tcr-list></div>
          <div class="tcr-more-row"><button type="button" class="btn tcr-more" data-tcr-more hidden>Показать ещё</button></div>
          <div class="tcr-probe" data-tcr-probe aria-hidden="true"></div>
        </div>`;
      const $ = s => el.querySelector(s);
      const status = h => { const b = $('[data-tcr-status]'); if (b) { b.innerHTML = h || ''; b.hidden = !h; } };
      const host = $('[data-tcr-probe]');
      if (!el._tcrBound) {
        el._tcrBound = true;
        el.addEventListener('click', e => {
          const R = el._tcr; if (!R) return;
          if (e.target.closest('[data-tcr-back]')) { el._tcr = null; this.render(el, o); return; }
          if (e.target.closest('[data-tcr-more]')) { R.page(); return; }
          if (e.target.closest('[data-tcr-retry]')) { this.read(el, R.u, o); return; }
          if (e.target.closest('[data-tcr-setup]')) { const t = el.closest('.tg-modal') && el.closest('.tg-modal').querySelector('[data-tgtab="setup"]'); if (t) t.click(); else Telegram.open(null, 'setup'); return; }
          const rs = e.target.closest('[data-tcr-restart]');
          if (rs) {
            rs.disabled = true; rs.innerHTML = '<span class="spinner sm"></span> Перезапускаю мост…';
            restartBridge().then(ok => {
              if (!el.isConnected) return;
              if (ok) { Telegram.accStatus().catch(() => {}).then(() => this.read(el, R.u, o)); return; }
              rs.disabled = false; rs.textContent = '↻ Перезапустить мост';
              UI.toast('Мост не перезапустился сам. Откройте папку «Norsk - Russisk» → «tools» и дважды щёлкните restart-bridge.command', 'warn', 9000);
            });
            return;
          }
          const sp = e.target.closest('.tcn-spoiler'); if (sp) { sp.classList.add('on'); return; }
          const mo = e.target.closest('[data-tcn-more]');
          if (mo) {
            const t = mo.parentElement.querySelector('[data-tcn-text]'); const open = t.classList.toggle('clamp') === false;
            mo.setAttribute('aria-expanded', String(open)); mo.textContent = open ? 'Свернуть' : 'Читать дальше';
            if (!open) mo.closest('.tcn-post').scrollIntoView({ block: 'nearest', behavior: reduce() ? 'auto' : 'smooth' });
            return;
          }
          const cn = e.target.closest('[data-tcn-card]'); if (cn) { this.nativeToCards(R, +cn.dataset.tcnCard, cn); return; }
          const pr = e.target.closest('[data-tcn-print]'); if (pr) { this.nativePrint(R, +pr.dataset.tcnPrint); return; }
          const ph = e.target.closest('[data-tcn-photo]'); if (ph) { Telegram.viewPhoto(ph.dataset.tcnPhoto); return; }
          const vd = e.target.closest('[data-tcn-video]'); if (vd) { this.nativePlay(R, vd, +vd.dataset.tcnVideo); return; }
          const au = e.target.closest('[data-tcn-audio]'); if (au) { this.nativePlay(R, au, +au.dataset.tcnAudio); return; }
          const cb = e.target.closest('[data-tcr-card]');
          if (cb) this.pasteToCards(R.c, +cb.dataset.tcrCard);
        });
        // «＋ В карточки» takes the words selected in the post: remembered before the tap can clear the selection
        el.addEventListener('pointerdown', e => { const b = e.target.closest('[data-tcn-card]'); if (b) b._sel = selIn(b.closest('.tcn-post')); });
        el.addEventListener('keydown', e => { const sp = e.target.closest && e.target.closest('.tcn-spoiler'); if (sp && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sp.classList.add('on'); } });
        // a picture the bridge could not give: the tile stays (no jump), with a calm sign instead of a broken image
        el.addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG' && t.closest('.tcn-post, .tcr-head')) t.classList.add('broken'); }, true);
      }
      const fail = (title, text, retry) => {
        status('');
        $('[data-tcr-list]').innerHTML = `<div class="tgc-empty tcr-empty"><div class="tgc-empty-ico" aria-hidden="true">${TG(40)}</div><b>${title}</b><p>${text}</p>
            <div class="tcr-empty-acts"><a class="btn primary" href="${link}" target="_blank" rel="noopener noreferrer">${TG(18)} Открыть в Телеграме</a>${retry ? '<button type="button" class="btn" data-tcr-retry>↻ Попробовать ещё раз</button>' : ''}</div></div>`;
        $('[data-tcr-more]').hidden = true;
      };
      const cache = ls(LAST_KEY, {}) || {};
      const mem = cache[lower(u)] || {};
      const saveMem = v => { const cc = ls(LAST_KEY, {}) || {}; cc[lower(u)] = Object.assign(cc[lower(u)] || {}, v, { t: Date.now() }); const keys = Object.keys(cc); if (keys.length > 300) delete cc[keys[0]]; lsSet(LAST_KEY, cc); };
      /** the channel forbids showing its posts on other sites: a calm explanation + the way to read it */
      const blocked = () => {
        status('');
        $('[data-tcr-note]').hidden = true;
        const home = atHome();
        const setup = home && el.closest('.tg-modal') && el.closest('.tg-modal').querySelector('[data-tgtab="setup"]');
        $('[data-tcr-list]').innerHTML = `<div class="tgc-empty tcr-empty tcr-locked"><div class="tgc-empty-ico" aria-hidden="true">🔒</div>
            <p>${home ? 'Этот канал не разрешает показывать посты на сайтах. Прочитать их здесь можно через ваш Телеграм на Маке — подключите его в «Каналы и аккаунт».'
              : 'Этот канал не разрешает показывать посты на сайтах. Читать его можно в самом Телеграме — там видно всё.'}</p>
            <div class="tcr-empty-acts"><a class="btn primary" href="${link}" target="_blank" rel="noopener noreferrer">${TG(18)} Открыть в Телеграме</a>${setup ? '<button type="button" class="btn" data-tcr-setup>⚙️ Каналы и аккаунт</button>' : ''}</div></div>`;
        $('[data-tcr-more]').hidden = true;
        const end = el.querySelector('.tcr-end'); if (end) end.remove();
      };

      // 🌐 off the Mac: a channel outside the curated list is never shown inside the app (13+, docs/store/compliance.md §0)
      if (!atHome() && !macBridge()) {
        if (!(window.Telegram && Telegram.isCurated ? await Telegram.isCurated(u) : c.from === 'ship')) { this.notCurated(el, u, link); return; }
        if (serverOn()) {
          const r = await this.readPublic(el, S);
          if (!alive() || r === 'ok' || r === 'gone') return;
        }
      }
      // 0) the user's own Telegram on the Mac: the app draws the posts itself — every channel is readable, protected ones too
      const up = macBridge();
      let acc = up ? Telegram.status : null;
      if (up && (!acc || acc.authorized === undefined)) { try { acc = await Telegram.accStatus(); } catch (e) { acc = null; } }
      if (!alive()) return;
      if (up && acc && acc.authorized) {
        const r = await this.readNative(el, S);
        if (!alive() || r === 'ok') return;
        if (r === 'old') {
          const tip = $('[data-tcr-tip]');
          tip.innerHTML = `<span aria-hidden="true">✨</span><span>Мост на Маке обновился: после перезапуска здесь будут видны посты любых каналов — и тех, что закрыты от показа на сайтах.</span><button type="button" class="btn sm" data-tcr-restart>↻ Перезапустить мост</button>`;
          tip.hidden = false;
        }
        status('<span class="spinner sm"></span> Ищу свежие посты…');
      }
      // a channel already seen here as «protected» (within 3 days): no widgets that can only say «open Telegram»
      if (mem.prot && Date.now() - mem.prot < 3 * 864e5) { blocked(); return; }

      // 1) the newest post: the shipped number / the last one seen here → a few steps forward (newer posts)
      let top = Math.max(c.last || 0, (c.posts && c.posts[0]) || 0, +mem.last || 0);
      if (!top) {
        status('<span class="spinner sm"></span> Ищу посты канала — это займёт несколько секунд…');
        const d = await discover(host, u, alive);
        if (!alive()) return;
        if (!d.answered) { fail('Телеграм сейчас не отвечает', 'Проверьте интернет и попробуйте ещё раз — или откройте канал в самом Телеграме.', true); return; }
        top = d.last;
        if (!top) { fail('Посты этого канала здесь не показываются', 'Возможно, канал закрыт, переименован или пока пуст. Откройте его в Телеграме — там видно всё.', false); return; }
      }
      for (let b = 0; b < 12 && alive(); b++) {
        const batch = [1, 2, 3, 4, 5, 6].map(k => top + k);
        const r = await pool(batch, 6, id => probe(host, u, id, 12000));
        const got = batch.filter((id, i) => r[i]);
        if (!got.length) break;
        top = Math.max(...got);
      }
      if (!alive()) return;
      saveMem({ last: top });

      // 2) the posts, newest first: the known numbers (exported) first, the rest one by one; «not found» ones vanish
      S.next = top; S.known = (c.posts || []).filter(id => id <= top);
      const nextIds = n => {
        const out = [];
        while (out.length < n && S.next >= 1) {
          if (S.known.length && S.next <= S.known[0]) { const id = S.known.shift(); out.push(id); S.next = id - 1; }
          else out.push(S.next--);
        }
        return out;
      };
      const slot = id => new Promise(res => {
        const w = document.createElement('article');
        w.className = 'tcr-post wait'; w.dataset.id = id;
        w.innerHTML = `<div class="tcr-fwrap"></div><div class="tcr-acts"><a class="btn sm" href="${link}/${id}" target="_blank" rel="noopener noreferrer">↗ Открыть пост в Телеграме</a><button type="button" class="btn sm primary" data-tcr-card="${id}">➕ В карточки</button></div>`;
        let state = 'wait';
        const f = postFrame(u, id, h => {
          if (state === 'wait') {
            clearTimeout(t);
            if (h < NOT_FOUND) { state = 'gone'; w.remove(); res(false); return; }
            state = 'ok'; w._h = h; w.classList.remove('wait'); res(true);
          }
          if (state === 'ok' && h >= NOT_FOUND) f.style.height = h + 'px';
        });
        // Telegram is slow: show the post anyway (with its own «open» link below)
        const t = setTimeout(() => { if (state !== 'wait') return; state = 'ok'; f.style.height = '420px'; w.classList.remove('wait'); res(true); }, 20000);
        $('[data-tcr-list]').appendChild(w);
        mount(w.querySelector('.tcr-fwrap'), f);
      });
      /** «Please open Telegram to view this post» (protected content): every post is the same small bubble — the same height.
       *  Real posts differ (text length, pictures), so 3+ posts of one small height mean the channel forbids the widget. */
      const looksBlocked = () => {
        const hs = [...$('[data-tcr-list]').querySelectorAll('.tcr-post:not(.wait)')].map(w => w._h).filter(Boolean);
        return hs.length >= 3 && Math.max(...hs) - Math.min(...hs) <= 2 && Math.max(...hs) < 260;
      };
      S.page = async () => {
        if (S.busy || !alive()) return;
        S.busy = true;
        const more = $('[data-tcr-more]');
        more.hidden = false; more.disabled = true; more.innerHTML = '<span class="spinner sm"></span> загружаю посты…';
        let found = 0;
        while (found < 5 && S.misses < 30 && S.next >= 1 && alive()) {
          const batch = nextIds(5);
          if (!batch.length) break;
          const r = await Promise.all(batch.map(slot));
          r.forEach(ok => { if (ok) { found++; S.misses = 0; } else S.misses++; });
        }
        if (!alive()) return;
        const first = !S.shown;
        S.shown += found; S.busy = false;
        status('');
        if (first && looksBlocked()) { saveMem({ prot: Date.now() }); blocked(); return; }
        if (!S.shown) { fail('Посты этого канала здесь не показываются', 'Возможно, автор запретил показывать их на сайтах. Откройте канал в Телеграме — там видно всё.', false); return; }
        const end = S.next < 1 || S.misses >= 30;
        more.disabled = false; more.hidden = end; more.textContent = 'Показать ещё';
        if (end && !$('.tcr-end')) more.parentElement.insertAdjacentHTML('beforeend', `<p class="tcr-end small muted">Это все посты, которые Телеграм показывает здесь. Более ранние — <a href="${link}" target="_blank" rel="noopener noreferrer">в самом канале ↗</a></p>`);
      };
      status('<span class="spinner sm"></span> Загружаю посты…');
      await S.page();
    },

    /** 🌐 a channel that is not in the curated list, off the Mac: one calm card and «Открыть в Телеграме» — nothing from it here */
    notCurated(el, u, link) {
      const st = el.querySelector('[data-tcr-status]'); if (st) st.hidden = true;
      const note = el.querySelector('[data-tcr-note]'); if (note) note.hidden = true;
      const list = el.querySelector('[data-tcr-list]');
      if (list) list.innerHTML = `<div class="tgc-empty tcr-empty"><div class="tgc-empty-ico" aria-hidden="true">${TG(40)}</div><b>Этот канал открывается в Телеграме</b>
          <p>Внутри приложения мы показываем только проверенные каналы о норвежском. @${esc(u)} можно читать в самом Телеграме — а понравившиеся слова скопировать и вставить в приложение: оно сделает из них карточки.</p>
          <div class="tcr-empty-acts"><a class="btn primary" href="${link}" target="_blank" rel="noopener noreferrer">${TG(18)} Открыть в Телеграме</a></div></div>`;
      const more = el.querySelector('[data-tcr-more]'); if (more) more.hidden = true;
    },
    /** 🌐 the posts of a curated channel through the Norsk Kort server (tg-public): 'ok' | 'gone' (not curated → link out) | 'fail'
     *  (→ Telegram's own widget below, as before). The server's html_safe keeps only b/i/u/s/code/pre/br and https links. */
    async readPublic(el, S) {
      const $ = s => el.querySelector(s);
      const alive = () => el._tcr === S && el.isConnected;
      const list = $('[data-tcr-list]'), more = $('[data-tcr-more]');
      $('[data-tcr-status]').hidden = true;
      list.classList.add('tcn-list'); list.setAttribute('aria-busy', 'true');
      list.innerHTML = `<span class="tcn-sr" role="status">Загружаю посты…</span>${SKEL(3)}`;
      let j;
      try { j = await Telegram.tgPublic(S.u); } catch (e) {
        if (!alive()) return 'ok';
        list.removeAttribute('aria-busy'); list.classList.remove('tcn-list'); list.innerHTML = '';
        if (e && e.code === 'not_curated') { this.notCurated(el, S.u, esc(e.link || `https://t.me/${S.u}`)); return 'gone'; }
        if (e && e.key === 'err.tgNotPublic') { list.innerHTML = `<div class="tgc-empty tcr-empty"><div class="tgc-empty-ico" aria-hidden="true">${IC('lock', 36)}</div><p>${esc(e.message)}. Читать его можно в самом Телеграме.</p><div class="tcr-empty-acts"><a class="btn primary" href="https://t.me/${esc(S.u)}" target="_blank" rel="noopener noreferrer">${TG(18)} Открыть в Телеграме</a></div></div>`; more.hidden = true; return 'gone'; }
        $('[data-tcr-status]').hidden = false;
        return 'fail';
      }
      if (!alive()) return 'ok';
      list.removeAttribute('aria-busy');
      const ch = j.channel || {};
      const N = S.nat = { pub: true, chat: { title: ch.title, protected: false }, next: j.next, posts: new Map(), ava: ch.photo || '' };
      if (ch.title && (!S.c.title || /^@/.test(S.c.title))) { const t = $('[data-tcr-title]'); if (t) t.textContent = ch.title; }
      if (N.ava) { const a = $('[data-tcr-ava]'); if (a && !a.querySelector('img')) { a.classList.add('has-img'); a.insertAdjacentHTML('afterbegin', `<img src="${esc(N.ava)}" alt="" referrerpolicy="no-referrer">`); } }
      const note = $('[data-tcr-note]');
      note.innerHTML = `<span aria-hidden="true">${IC('info', 18)}</span><span>Свежие посты проверенного канала — без входа в Телеграм. Выделите слова в посте и нажмите <b>«＋ В карточки»</b> (или нажмите сразу — возьмётся весь пост).</span>`;
      list.innerHTML = '';
      const add = posts => list.insertAdjacentHTML('beforeend', posts.filter(p => !N.posts.has(p.id)).map(p => { N.posts.set(p.id, p); return this.publicHtml(S, p); }).join(''));
      add(j.posts);
      if (!N.posts.size) list.innerHTML = '<div class="tgc-empty tcr-empty"><div class="tgc-empty-ico" aria-hidden="true">📭</div><b>В канале пока нет постов</b></div>';
      const endNote = () => { if (!$('.tcr-end') && N.posts.size) more.parentElement.insertAdjacentHTML('beforeend', `<p class="tcr-end small muted">Более ранние посты — <a href="https://t.me/${esc(S.u)}" target="_blank" rel="noopener noreferrer">в самом канале ↗</a></p>`); };
      S.page = async () => {
        if (S.busy || !N.next || !alive()) return;
        S.busy = true;
        more.disabled = true; more.innerHTML = '<span class="spinner sm"></span> загружаю посты…';
        list.insertAdjacentHTML('beforeend', SKEL(2));
        let r = null;
        try { r = await Telegram.tgPublic(S.u, { before: N.next }); } catch (e) { r = { err: e }; }
        if (!alive()) return;
        list.querySelectorAll('.tcn-skel').forEach(x => x.remove());
        S.busy = false; more.disabled = false; more.textContent = 'Показать ещё';
        if (r.err) { UI.toast(r.err.nk ? r.err.message : 'Телеграм сейчас не ответил — нажмите «Показать ещё» ещё раз', 'warn', 4500); return; }
        N.next = r.next && r.next !== N.next ? r.next : 0;
        add(r.posts);
        more.hidden = !N.next;
        if (!N.next) endNote();
      };
      more.hidden = !N.next;
      more.textContent = 'Показать ещё';
      if (!N.next) endNote();
      return 'ok';
    },
    /** one post from tg-public as the app's own card: who · when, the picture, the text (server-made safe HTML), actions */
    publicHtml(S, p) {
      const N = S.nat, title = N.chat.title || S.c.title || '@' + S.u;
      const pic = (p.photos && p.photos[0]) || (p.video && p.video.thumb) || '';
      const media = pic ? `<div class="tcn-media">${p.video
        ? `<a class="tcn-tile vid" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer" style="aspect-ratio:16/9" aria-label="Смотреть видео в Телеграме"><img src="${esc(pic)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="tcn-play" aria-hidden="true">▶</span></a>`
        : `<button type="button" class="tcn-tile" data-tcn-photo="${esc(pic)}" style="aspect-ratio:4/3" aria-label="Открыть картинку крупно"><img src="${esc(pic)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></button>`}</div>`
        : p.video ? `<a class="tcn-file" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer"><span class="tcn-fi" aria-hidden="true">▶</span><span class="tcn-fn">Видео — в Телеграме</span></a>` : '';
      const text = String(p.text || '');
      const long = text.length > 700 || text.split('\n').length > 14;
      return `<article class="tcn-post" data-tcn="${+p.id}">
          <header class="tcn-head"><span class="tcn-ava${N.ava ? ' has-img' : ''}" style="--h:${hue(S.u)}" aria-hidden="true">${N.ava ? `<img src="${esc(N.ava)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<b>${esc((title.replace(/[^\p{L}\p{N}]/gu, '')[0] || S.u[0]).toUpperCase())}</b></span>
            <span class="tcn-who"><b>${esc(title)}</b><small><time datetime="${esc(p.date || '')}">${esc(whenRu(p.date))}</time></small></span></header>
          ${media}
          ${text.trim() ? `<div class="tcn-text${long ? ' clamp' : ''}" data-tcn-text>${p.html ? cleanHtml(p.html) : esc(text).replace(/\n/g, '<br>')}</div>${long ? '<button type="button" class="tcn-more" data-tcn-more aria-expanded="false">Читать дальше</button>' : ''}` : ''}
          ${p.file ? `<div class="tcn-files"><a class="tcn-file" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer"><span class="tcn-fi" aria-hidden="true">${p.file.audio ? '▶' : '📄'}</span><span class="tcn-fn">${p.file.audio ? 'Аудио' : 'Файл'} — в Телеграме</span></a></div>` : ''}
          <footer class="tcn-foot">
            <span class="tcn-stats"></span>
            <a class="tcn-open" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">Открыть в Телеграме ↗</a>
            <button type="button" class="btn sm primary tcn-card" data-tcn-card="${+p.id}" title="Выделите слова в посте — возьмутся только они. Без выделения — весь пост">＋ В карточки</button>
          </footer>
        </article>`;
    },
    /** 📖 the posts through the user's own Telegram (the Mac bridge): 'ok' | 'old' (the bridge has no /api/tg/posts) | 'fail' */
    async readNative(el, S) {
      const $ = s => el.querySelector(s);
      const alive = () => el._tcr === S && el.isConnected;
      const list = $('[data-tcr-list]'), more = $('[data-tcr-more]');
      $('[data-tcr-status]').hidden = true;
      list.classList.add('tcn-list'); list.setAttribute('aria-busy', 'true');
      list.innerHTML = `<span class="tcn-sr" role="status">Загружаю посты…</span>${SKEL(3)}`;
      const j = await fetchPosts(S.u, 0);
      if (!alive()) return 'ok';
      list.removeAttribute('aria-busy');
      if (j.old || j.error) { list.innerHTML = ''; list.classList.remove('tcn-list'); return j.old ? 'old' : 'fail'; }
      const ch = j.chat || {};
      const N = S.nat = { chat: ch, next: +j.next || 0, ffmpeg: !!j.ffmpeg, posts: new Map(), ava: ch.photo ? `/api/tg/avatar?u=${enc(S.u)}` : '' };
      // the header: the channel's real name and picture
      if (ch.title && (!S.c.title || /^@/.test(S.c.title))) { const t = $('[data-tcr-title]'); if (t) t.textContent = ch.title; }
      if (N.ava) { const a = $('[data-tcr-ava]'); if (a) { a.classList.add('has-img'); a.insertAdjacentHTML('afterbegin', `<img src="${esc(N.ava)}" alt="">`); } }
      const note = $('[data-tcr-note]');
      note.innerHTML = ch.protected
        ? '<span aria-hidden="true">🔒</span><span>Автор закрыл этот канал от копирования, поэтому на сайтах его посты не видны. Здесь вы читаете их через свой Телеграм — только для себя. Выделите слова в посте и нажмите <b>«＋ В карточки»</b> (или нажмите сразу — возьмётся весь пост).</span>'
        : '<span aria-hidden="true">📖</span><span>Посты читаются через ваш Телеграм на Маке — приложение только читает, ничего не отправляет. Выделите слова в посте и нажмите <b>«＋ В карточки»</b> (или нажмите сразу — возьмётся весь пост).</span>';
      note.classList.toggle('lock', !!ch.protected);
      list.innerHTML = '';
      this.addPosts(list, S, j.posts);
      if (!N.posts.size) list.innerHTML = '<div class="tgc-empty tcr-empty"><div class="tgc-empty-ico" aria-hidden="true">📭</div><b>В канале пока нет постов</b></div>';
      const endNote = () => { if (!$('.tcr-end') && N.posts.size) more.parentElement.insertAdjacentHTML('beforeend', `<p class="tcr-end small muted">Это самые первые посты канала.</p>`); };
      S.page = async () => {
        if (S.busy || !N.next || !alive()) return;
        S.busy = true;
        more.disabled = true; more.innerHTML = '<span class="spinner sm"></span> загружаю посты…';
        list.insertAdjacentHTML('beforeend', SKEL(2));
        const r = await fetchPosts(S.u, N.next);
        if (!alive()) return;
        list.querySelectorAll('.tcn-skel').forEach(x => x.remove());
        S.busy = false; more.disabled = false; more.textContent = 'Показать ещё';
        if (r.error || r.old) { UI.toast('Телеграм сейчас не ответил — нажмите «Показать ещё» ещё раз', 'warn', 4500); return; }
        N.next = +r.next || 0;
        this.addPosts(list, S, r.posts);
        more.hidden = !N.next;
        if (!N.next) endNote();
      };
      more.hidden = !N.next;
      more.textContent = 'Показать ещё';
      if (!N.next) endNote();
      return 'ok';
    },
    addPosts(list, S, posts) {
      const N = S.nat;
      const html = (posts || []).filter(p => p && +p.id > 0 && !N.posts.has(+p.id)).map(p => { N.posts.set(+p.id, p); return this.nativeHtml(S, p); }).join('');
      list.insertAdjacentHTML('beforeend', html);
    },
    /** one post as the app's own card: who · when, pictures / video, text, sound / files, views · reactions, actions */
    nativeHtml(S, p) {
      const N = S.nat, ch = N.chat, title = ch.title || S.c.title || '@' + S.u;
      const media = Array.isArray(p.media) ? p.media.filter(m => m && m.type) : [];
      const vis = media.filter(m => m.type === 'photo' || m.type === 'video').slice(0, 10);
      const rest = media.filter(m => m.type !== 'photo' && m.type !== 'video');
      const one = vis.length === 1;
      const ratio = m => { const r = m.w && m.h ? m.w / m.h : 16 / 9; return Math.max(0.8, Math.min(r, 2.2)).toFixed(3); };
      const tile = m => {
        const st = one ? ` style="aspect-ratio:${m.round ? 1 : ratio(m)}"` : '';
        if (m.type === 'photo') return `<button type="button" class="tcn-tile" data-tcn-photo="${esc(m.url)}"${st} aria-label="Открыть картинку крупно"><img src="${esc(m.url)}" alt="" loading="lazy" decoding="async"></button>`;
        return `<button type="button" class="tcn-tile vid${m.round ? ' round' : ''}" data-tcn-video="${+m.msg}"${st} aria-label="Смотреть видео${m.duration ? ' (' + mss(m.duration) + ')' : ''}">${m.thumb ? `<img src="${esc(m.thumb)}" alt="" loading="lazy" decoding="async">` : ''}<span class="tcn-play" aria-hidden="true">▶</span>${m.duration ? `<span class="tcn-dur">${mss(m.duration)}</span>` : ''}</button>`;
      };
      const row = m => (m.type === 'document'
        ? `<a class="tcn-file" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer"><span class="tcn-fi" aria-hidden="true">📄</span><span class="tcn-fn">${esc(m.name || 'Файл')}</span><small>${m.size ? mb(m.size) : ''}</small></a>`
        : `<button type="button" class="tcn-file aud" data-tcn-audio="${+m.msg}"><span class="tcn-fi" aria-hidden="true">▶</span><span class="tcn-fn">${m.type === 'voice' ? '🎤 Голосовое сообщение' : '🎵 ' + esc([m.performer, m.title].filter(Boolean).join(' — ') || m.name || 'Аудио')}</span><small>${m.duration ? mss(m.duration) : ''}</small></button>`);
      const text = String(p.text || '');
      const long = text.length > 700 || text.split('\n').length > 14;
      const linkOk = /^https:\/\/t\.me\//.test(String(p.link || '')) ? p.link : `https://t.me/${S.u}/${+p.id}`;
      return `<article class="tcn-post" data-tcn="${+p.id}">
          <header class="tcn-head"><span class="tcn-ava${N.ava ? ' has-img' : ''}" style="--h:${hue(S.u)}" aria-hidden="true">${N.ava ? `<img src="${esc(N.ava)}" alt="" loading="lazy">` : ''}<b>${esc((title.replace(/[^\p{L}\p{N}]/gu, '')[0] || S.u[0]).toUpperCase())}</b></span>
            <span class="tcn-who"><b>${esc(title)}</b><small><time datetime="${esc(p.date || '')}">${esc(whenRu(p.date))}</time>${p.author ? ' · ' + esc(p.author) : ''}</small></span></header>
          ${vis.length ? `<div class="tcn-media${one ? '' : ' grid'}${!one && vis.length % 2 ? ' odd' : ''}">${vis.map(tile).join('')}</div>` : ''}
          ${text.trim() ? `<div class="tcn-text${long ? ' clamp' : ''}" data-tcn-text>${postText(text, p.ents)}</div>${long ? '<button type="button" class="tcn-more" data-tcn-more aria-expanded="false">Читать дальше</button>' : ''}` : ''}
          ${rest.length ? `<div class="tcn-files">${rest.map(row).join('')}</div>` : ''}
          <footer class="tcn-foot">
            <span class="tcn-stats">${+p.views ? `<span title="Просмотры"><span aria-hidden="true">👁</span> ${numRu(+p.views)}</span>` : ''}${+p.reactions ? `<span title="Реакции"><span aria-hidden="true">${esc((p.top || []).slice(0, 3).join('') || '❤')}</span> ${numRu(+p.reactions)}</span>` : ''}</span>
            <a class="tcn-open" href="${esc(linkOk)}" target="_blank" rel="noopener noreferrer">Открыть в Телеграме ↗</a>
            ${text.trim() && window.PrintX ? `<button type="button" class="btn sm ghost tcn-print" data-tcn-print="${+p.id}" aria-haspopup="dialog" aria-label="Печать и файлы: распечатать пост или сохранить в Word" title="🖨 Распечатать пост или сохранить в Word${ch.protected ? ' — только для личного использования' : ''}">🖨</button>` : ''}
            <button type="button" class="btn sm primary tcn-card" data-tcn-card="${+p.id}" title="Выделите слова в посте — возьмутся только они. Без выделения — весь пост">＋ В карточки</button>
          </footer>
        </article>`;
    },
    /** ＋ the selected words (or the whole post, with its pictures for recognition) → the usual «from Telegram into cards» window */
    nativeToCards(R, id, btn) {
      const N = R.nat; if (!N) return;
      const p = N.posts.get(id); if (!p) return;
      const post = btn.closest('.tcn-post');
      const sel = selIn(post) || btn._sel || '';
      btn._sel = '';
      const ch = N.chat, title = ch.title || R.c.title || '@' + R.u;
      if (N.pub) {
        Telegram.toCards({ src: 'public', ch: R.u, chatTitle: ch.title || title, id: p.id, post: `${R.u}/${p.id}`, link: p.link || `https://t.me/${R.u}/${p.id}`,
          text: sel || String(p.text || ''), photos: sel ? [] : (p.photos || []), video: null, file: null, date: p.date || '' }, null, null);
        return;
      }
      const media = Array.isArray(p.media) ? p.media : [];
      const v = sel ? null : media.find(m => m.type === 'video');
      Telegram.toCards({
        src: 'public', ch: R.u, chatTitle: title, id: p.id, post: `${R.u}/${p.id}`, link: `https://t.me/${R.u}/${p.id}`,
        text: sel || String(p.text || ''), photos: sel ? [] : media.filter(m => m.type === 'photo').map(m => m.url),
        video: v ? { thumb: v.thumb || '', url: `/api/tg/video?chat=${enc(ch.id)}&msg=${enc(v.msg)}`, duration: v.duration || 0 } : null,
        file: null, date: p.date || '', protected: !!ch.protected,
      }, null, null);
    },
    /** 🖨 «Печать и файлы» (js/printx.js): one post, paragraph by paragraph; a protected channel — only for personal use */
    nativePrint(R, id) {
      const N = R.nat; if (!N || !window.PrintX) return;
      const p = N.posts.get(id); if (!p) return;
      const ch = N.chat || {}, title = ch.title || R.c.title || '@' + R.u;
      const blocks = String(p.text || '').split(/\n\s*\n|\n/).map(x => x.trim()).filter(Boolean).map(no => ({ no }));
      const when = whenRu(p.date);
      PrintX.text({ title: `${title}${when ? ' — пост ' + when : ''}`, author: '@' + R.u, blocks, mode: 'no',
        source: { id: `tg:${R.u}/${+p.id}`, name: title, kind: 'channel', url: `https://t.me/${R.u}/${+p.id}`, protected: !!ch.protected } });
    },
    /** ▶ a video / sound of a post — the app's own players (subtitles, translation, cards) */
    nativePlay(R, btn, msg) {
      const N = R.nat; if (!N) return;
      const p = [...N.posts.values()].find(x => (x.media || []).some(m => +m.msg === msg)); if (!p) return;
      const m = p.media.find(x => +x.msg === msg), ch = N.chat, title = ch.title || R.c.title || '@' + R.u;
      if (m.type === 'video' && window.TgVideo && TgVideo.play && window.Subs) {
        TgVideo.play({ chat: ch.id, info: { title, username: R.u, public: true }, ffmpeg: N.ffmpeg }, { id: msg, caption: p.text || '', date: p.date, duration: m.duration || 0, author: p.author || '' });
        return;
      }
      if ((m.type === 'audio' || m.type === 'voice') && window.TgAudio && TgAudio.play) {
        TgAudio._ff = N.ffmpeg;
        TgAudio.play({ chat: String(ch.id), msg, channel: title, username: R.u, link: `https://t.me/${R.u}/${msg}`, title: m.title || '', performer: m.performer || '', name: m.name || '',
          caption: String(p.text || '').slice(0, 600), date: p.date || '', duration: m.duration || 0, size: m.size || 0, mime: m.mime || 'audio/mpeg', voice: m.type === 'voice', thumb: !!m.thumb, author: p.author || '' }, btn);
        return;
      }
      window.open(`https://t.me/${R.u}/${msg}`, '_blank', 'noopener');
    },
    /** ➕ the post's words → cards: the user copies them from Telegram's widget (another site — its text can't be read) */
    pasteToCards(c, id) {
      const m = UI.modal({
        title: '➕ Слова из поста — в карточки', cls: 'narrow tcr-paste',
        body: `<ol class="tcr-steps"><li>Выделите в посте норвежские слова или фразы — с переводом, если он есть.</li><li>Скопируйте: <b>⌘C</b> / <b>Ctrl+C</b> или «Копировать».</li><li>Вставьте сюда и нажмите «Дальше».</li></ol>
          <textarea class="input tcr-text" data-tcr-text rows="7" placeholder="Например:\nå snakke — говорить\nJeg lærer norsk — Я учу норвежский" aria-label="Текст из поста"></textarea>`,
        foot: '<button type="button" class="btn ghost" data-x>Отмена</button><button type="button" class="btn primary" data-go>Дальше ›</button>',
      });
      const ta = m.$('[data-tcr-text]');
      setTimeout(() => ta.focus(), 60);
      m.$('[data-x]').onclick = () => m.close();
      m.$('[data-go]').onclick = () => {
        const text = Store.Safe.text(String(ta.value || ''), 20000).trim();
        if (!text) { UI.toast('Сначала вставьте текст из поста', 'warn', 3500); ta.focus(); return; }
        m.close();
        const u = c.username;
        Telegram.toCards({ src: 'public', ch: u, chatTitle: c.title || '@' + u, id, post: `${u}/${id}`, link: `https://t.me/${u}/${id}`, text, photos: [], video: null, file: null, date: '' }, null, null);
      };
      return m;
    },

    /* ---------------- 🧭 the owner's tool ---------------- */
    async curate(onDone) {
      const m = UI.modal({
        title: '🧭 Подобрать норвежские каналы', cls: 'wide tgcur-modal',
        body: `<div class="tgcur-rule"><span aria-hidden="true">🇳🇴</span><span><b>В общий список — только каналы, где учат норвежский язык:</b> уроки, слова, грамматика, разговор, экзамены.
            Каналы про новости, работу, жизнь в Норвегии и всё остальное не подходят — даже если они на норвежском.
            <b>⭐ Похожие на уроки норвежского</b> отмечены сами; остальные выключены — включите вручную, только если уверены.</span></div>
          <p class="tgc-privacy">🔒 В список попадают только открытые каналы с публичной ссылкой. Ваши личные чаты и закрытые группы не показываются никому.</p>
          <div data-cur><div class="small muted"><span class="spinner sm"></span> читаю ваши каналы и группы…</div></div>`,
        foot: `<span class="small muted grow" data-curn></span><button type="button" class="btn" data-cur-export disabled>⬇ Экспорт списка</button><button type="button" class="btn primary" data-cur-save disabled>💾 Сохранить выбор</button>`,
      });
      const box = m.$('[data-cur]');
      let rows = [];
      try {
        const r = await fetch('/api/tg/dialogs');
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Telegram не ответил');
        // ONLY public channels / groups: a @username is a must; personal chats and bots never (whatever the server sends)
        rows = (j.dialogs || []).filter(d => d && (!d.kind || d.kind === 'channel' || d.kind === 'group') && !d.bot && !d.user && okUser(d.username) && d.public !== false)
          .map(d => ({ id: d.id, username: d.username, title: Store.Safe.text(String(d.name || ''), 200).trim(), count: +d.count || 0, group: !!d.group, about: '' }));
      } catch (e) {
        box.innerHTML = `<div class="mt-warn"><span>⚠️</span><span>Не удалось прочитать ваши каналы: ${esc(U.niceErr(e, '', true))}. Проверьте, что Telegram подключён (вкладка «Каналы и аккаунт»).</span></div>`;
        return m;
      }
      const prev = new Map(this.curated().map(c => [lower(c.username), c]));
      // channels the owner has already looked at: their tick stays as he left it (a new channel that looks Norwegian is ticked)
      const seen = new Set((state().curSeen || []).map(lower));
      const guessCat = s => (/vide|видео|youtube|film|tv\b/i.test(s) ? 'video' : /nyhet|news|новост/i.test(s) ? 'news' : /\bord|glos|слов|vocab|lexi/i.test(s) ? 'words' : /chat|prat|чат|общен|клуб|group|групп/i.test(s) ? 'chat' : 'lessons');
      const score = r => nScore(r.title, r.about, r.username);
      const autoOn = r => { if (!r.touched && !prev.has(lower(r.username)) && !seen.has(lower(r.username))) r.on = r.s === 3; };
      rows.forEach(r => {
        const p = prev.get(lower(r.username));
        r.on = !!p; r.cat = p ? p.category : guessCat(`${r.title} ${r.username}`); r.desc = p ? p.about : '';
        r.s = score(r); autoOn(r);
      });
      const TAG = { 3: '<span class="tgcur-tag">⭐ учат норвежский</span>', 2: '<span class="tgcur-tag weak">🤔 возможно</span>', 1: '<span class="tgcur-tag off">про Норвегию, не про язык?</span>', 0: '' };
      const WARN = '<p class="tgcur-warn" role="note">⚠️ Не похоже на канал, где учат норвежский. Оставьте галочку, только если там правда уроки норвежского.</p>';
      let show = 'yes', q = '', aboutState = 'wait';
      const inShow = r => (show === 'all' ? true : show === 'maybe' ? r.s === 2 || r.s === 1 : r.s === 3 || r.on);
      const visible = () => rows.filter(r => inShow(r) && (!q || `${r.title} ${r.username} ${r.about}`.toLowerCase().includes(q)))
        .sort((a, b) => (b.on - a.on) || (b.s - a.s) || (b.count - a.count) || a.title.localeCompare(b.title, 'ru'));
      const rowHtml = r => {
        const i = rows.indexOf(r);
        return `<div class="tgcur-row ${r.on ? 'on' : ''} ${r.s < 3 ? 'low' : ''}" data-i="${i}" style="--h:${hue(r.username)}">
            <label class="tgcur-pick"><input type="checkbox" data-cur-on="${i}" ${r.on ? 'checked' : ''} aria-label="Включить в общий список"><span class="tgc-ava" aria-hidden="true">${esc((r.title.replace(/[^\p{L}\p{N}]/gu, '')[0] || r.username[0]).toUpperCase())}</span>
              <span class="tgcur-name"><b>${esc(r.title || '@' + r.username)}</b><small>@${esc(r.username)} · ${r.group ? 'группа' : 'канал'}${r.count ? ` · 👥 ${numRu(r.count)}` : ''} ${TAG[r.s] || ''}</small></span></label>
            ${r.about ? `<p class="tgcur-about">${esc(r.about.slice(0, 240))}</p>` : ''}
            <div class="tgcur-edit" ${r.on ? '' : 'hidden'}>
              ${r.s < 3 ? WARN : ''}
              <label class="field"><span>Коротко по-русски — чем полезен</span><input class="input" data-cur-desc="${i}" maxlength="200" value="${esc(r.desc)}" placeholder="Например: короткие уроки грамматики и слова дня"></label>
              <label class="field"><span>Категория</span><select class="input" data-cur-cat="${i}">${CATS.map(([k, ic, t]) => `<option value="${k}" ${r.cat === k ? 'selected' : ''}>${ic} ${t}</option>`).join('')}</select></label>
            </div>
          </div>`;
      };
      const count = () => {
        const on = rows.filter(r => r.on), n = on.length, low = on.filter(r => r.s < 3).length;
        m.$('[data-curn]').textContent = n ? `В общий список: ${n}${low ? ` · из них ${low} — не похожи на уроки норвежского` : ''}` : 'Отметьте каналы, где учат норвежский';
        m.$('[data-cur-save]').disabled = false;
        m.$('[data-cur-export]').disabled = !n;
      };
      const draw = () => {
        const v = visible(), yes = rows.filter(r => r.s === 3).length, maybe = rows.filter(r => r.s === 2 || r.s === 1).length;
        box.innerHTML = `<div class="tgcur-tools">
            <span class="seg-mini sm tgcur-seg" role="group" aria-label="Что показать">
              <button type="button" data-cur-show="yes" class="${show === 'yes' ? 'active' : ''}">⭐ Учат норвежский (${yes})</button>
              <button type="button" data-cur-show="maybe" class="${show === 'maybe' ? 'active' : ''}">🤔 Возможно (${maybe})</button>
              <button type="button" data-cur-show="all" class="${show === 'all' ? 'active' : ''}">Все открытые (${rows.length})</button></span>
            <input class="input" type="search" data-cur-q placeholder="🔎 Найти" value="${esc(q)}" aria-label="Найти канал">
          </div>
          ${aboutState === 'old' ? '<div class="mt-warn"><span>ℹ️</span><span>Описания каналов появятся, когда мост на Mac будет перезапущен (новая версия).</span></div>' : aboutState === 'wait' ? '<div class="small muted"><span class="spinner sm"></span> читаю описания каналов — подсказки станут точнее…</div>' : ''}
          <div class="tgcur-list">${v.length ? v.map(rowHtml).join('') : `<div class="tgc-empty sm"><span aria-hidden="true">🤷</span><span>${rows.length ? (show === 'yes' ? 'Каналов, похожих на уроки норвежского, не нашлось — загляните в «Возможно» или «Все открытые».' : 'Здесь пусто.') : 'У вас нет открытых каналов и групп. Подпишитесь на норвежские каналы в Telegram — и они появятся здесь.'}</span></div>`}</div>`;
        const qi = box.querySelector('[data-cur-q]');
        qi.addEventListener('input', () => { readEdits(); q = qi.value.trim().toLowerCase(); const pos = qi.selectionStart; draw(); const n = box.querySelector('[data-cur-q]'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } });
        count();
      };
      draw();
      // descriptions + member counts — only for the public ones (the bridge refuses the others too)
      (async () => {
        const all = rows.map(r => r.id);
        try {
          for (let k = 0; k < all.length; k += 40) {
            const r = await fetch('/api/tg/about?ids=' + all.slice(k, k + 40).join(','));
            if (r.status === 404) { aboutState = 'old'; break; }
            const j = await r.json().catch(() => ({}));
            const a = j.about || {};
            rows.forEach(x => { const v = a[String(x.id)]; if (v && !v.error) { x.about = Store.Safe.text(String(v.about || ''), 600).trim(); if (v.count) x.count = +v.count; x.s = score(x); autoOn(x); } });
            aboutState = 'done';
          }
        } catch (e) { aboutState = 'done'; }
        if (aboutState === 'wait') aboutState = 'done';
        if (m.el.isConnected) { readEdits(); draw(); }
      })();
      const readEdits = () => {
        box.querySelectorAll('[data-cur-desc]').forEach(i => { rows[+i.dataset.curDesc].desc = i.value; });
        box.querySelectorAll('[data-cur-cat]').forEach(s => { rows[+s.dataset.curCat].cat = s.value; });
      };
      // ONLY the ticked ones; the newest posts come from the owner's Telegram so the site can show them without a server
      const selection = async () => {
        readEdits();
        const list = rows.filter(r => r.on).map(r => clean({ username: r.username, title: r.title, about: (r.desc || '').trim() || r.about.slice(0, 200), category: r.cat, members: r.count, tid: r.id,
          last: (prev.get(lower(r.username)) || {}).last, posts: (prev.get(lower(r.username)) || {}).posts })).filter(Boolean);
        await this.withPosts(list, t => { m.$('[data-curn]').textContent = t; });
        return list;
      };
      const remember = () => patch({ curSeen: [...new Set([...seen, ...rows.map(r => lower(r.username))])].slice(-2000) });
      box.addEventListener('change', e => {
        const c = e.target.closest('[data-cur-on]');
        if (c) {
          const r = rows[+c.dataset.curOn]; r.on = c.checked; r.touched = true;
          const row = c.closest('.tgcur-row'); row.classList.toggle('on', r.on); row.querySelector('.tgcur-edit').hidden = !r.on;
          if (r.on && !r.desc) { const d = row.querySelector('[data-cur-desc]'); if (d) setTimeout(() => d.focus(), 30); }
          count();
        }
      });
      box.addEventListener('click', e => { const a = e.target.closest('[data-cur-show]'); if (a) { readEdits(); show = a.dataset.curShow; draw(); } });
      const busy = on => { m.$('[data-cur-save]').disabled = on; m.$('[data-cur-export]').disabled = on; };
      m.$('[data-cur-save]').onclick = async () => {
        busy(true);
        const list = await selection();
        lsSet(CUR_KEY, list); remember();
        UI.toast(list.length ? `Сохранено: ${list.length}. Чтобы список увидели все — «Экспорт списка»` : 'Выбор очищен', 'good', 5000);
        m.close(); if (onDone) onDone();
      };
      m.$('[data-cur-export]').onclick = async () => {
        busy(true);
        const list = await selection();
        lsSet(CUR_KEY, list); remember();
        this.exportList(list, true);
        busy(false); count();
      };
      return m;
    },
    /** the newest posts of each channel (the owner's Telegram through the bridge): `last` + up to 20 post numbers, albums once */
    async withPosts(list, onLog) {
      if (!macBridge()) return list;
      let k = 0;
      for (const c of list) {
        k++;
        if (!c.tid) continue;
        if (onLog) onLog(`Беру свежие посты каналов: ${k} из ${list.length}…`);
        try {
          const r = await fetch(`/api/tg/messages?chat=${encodeURIComponent(c.tid)}&limit=30`);
          const j = await r.json().catch(() => ({}));
          if (!r.ok) continue;
          const groups = new Set(), out = [];
          (j.messages || []).forEach(x => {
            if (!x || x.error || !(+x.id > 0)) return;
            if (x.grouped) { if (groups.has(x.grouped)) return; groups.add(x.grouped); }
            out.push(+x.id);
          });
          if (out.length) { c.posts = ids(out).slice(0, 20); c.last = Math.max(c.last || 0, c.posts[0]); }
        } catch (e) { /* this channel keeps what it had */ }
      }
      return list;
    },
    /** ⬇ tg-channels.json — the owner puts it into data/ of the app. Only the ticked channels; the chat ids never leave the Mac. */
    async exportList(list, fresh) {
      list = (list || this.curated()).map(clean).filter(Boolean);
      if (!list.length) { UI.toast('Сначала отметьте каналы', 'warn'); return; }
      if (!fresh) { await this.withPosts(list); lsSet(CUR_KEY, list); }
      const out = list.map(({ username, title, about, category, members, last, posts }) => Object.assign({ username, title, about, category, members }, last ? { last } : {}, posts.length ? { posts } : {}));
      U.download('tg-channels.json', JSON.stringify(out, null, 2) + '\n', 'application/json');
      const low = out.filter(c => nScore(c.title, c.about, c.username) < 3).length;
      UI.toast(`Скачан tg-channels.json (${out.length}). Положите его в папку data приложения — список увидят все${low ? `. Проверьте: ${low} — не похожи на уроки норвежского` : ''}`, low ? 'warn' : 'good', 8000);
    },

    /* ---------------- the intro: a paper plane and chat bubbles ---------------- */
    intro() {
      patch({ intro: state().intro || Date.now() });
      if (window.Guides) Guides.setOff('tg-intro');
      // one guide at a time (phone audit 2026-11-23): this intro explains the section, so its coach marks are not shown after it
      try { const h = JSON.parse(localStorage.getItem('nk-help') || '{}') || {}; h.coach = Object.assign({}, h.coach, { 'cm-telegram': Date.now() }); localStorage.setItem('nk-help', JSON.stringify(h)); } catch (e) { /* private mode */ }
      const auth = !!(Telegram.status && Telegram.status.authorized);
      const home = atHome() || macBridge(); // the site without the bridge: no «connect your Telegram»
      const m = UI.modal({
        title: '', cls: 'narrow tgi-intro',
        body: `<div class="tgi-stage ${reduce() ? 'still' : ''}" aria-hidden="true">
            <span class="tgi-ring r1"></span><span class="tgi-ring r2"></span>
            <svg class="tgi-svg" viewBox="0 0 260 160">
              <defs>
                <linearGradient id="tgiP" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9efff"/></linearGradient>
                <linearGradient id="tgiC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#37bbfe"/><stop offset="1" stop-color="#1d8fd8"/></linearGradient>
                <radialGradient id="tgiS" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>
              </defs>
              <path class="tgi-trail" d="M8 136 C 60 128, 80 70, 140 66 S 220 36, 258 8" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2.2" stroke-dasharray="2 9" stroke-linecap="round"/>
              <g transform="translate(130 82)"><g class="tgi-logo">
                <circle cx="0" cy="0" r="34" fill="url(#tgiC)"/><circle cx="0" cy="0" r="34" fill="url(#tgiS)"/>
                <path d="M-17-1.6 15-14.1c1.5-.6 2.9.3 2.4 2.5l-5.5 25.8c-.4 1.8-1.5 2.2-3.1 1.3l-8.4-6.2-4.1 3.9c-.4.4-.9.9-1.8.9l.7-8.6 15.4-14c.7-.7-.1-1-1.1-.4l-19 12-8.2-2.5c-1.8-.6-1.8-1.8.4-2.6z" fill="url(#tgiP)"/>
              </g></g>
              <g class="tgi-fly"><path d="M-12-1 10-9.6c1-.4 2 .2 1.7 1.8l-3.8 18c-.3 1.2-1.1 1.5-2.1.9l-5.9-4.3-2.8 2.7c-.3.3-.6.6-1.2.6l.5-6 10.7-9.7c.5-.5-.1-.7-.8-.3L-6.3 1.8-12 0c-1.2-.4-1.2-1.2.3-1.8z" fill="#fff"/></g>
            </svg>
            <span class="tgi-bub b1"><span class="tgi-flag">🇳🇴</span> Hei!</span>
            <span class="tgi-bub b2 me"><span class="tgi-flag">🇷🇺</span> Привет!</span>
            <span class="tgi-bub b3"><span class="tgi-flag">🇳🇴</span> et ord ✨</span>
          </div>
          <h2 class="tgi-h">Норвежский из Телеграма — прямо в карточки</h2>
          <ul class="tgi-list">
            <li><span aria-hidden="true">📢</span><span><b>Канал</b> — это как журнал в Телеграме: автор пишет посты, вы читаете. Есть каналы, где каждый день учат норвежский.</span></li>
            <li><span aria-hidden="true">🔎</span><span><b>Как найти:</b> в поиске Телеграма напишите «norsk» или «Норвегия язык». Или откройте наш список «Норвежские каналы».</span></li>
            <li><span aria-hidden="true">🃏</span><span><b>Что делает приложение:</b> находит в постах слова и фразы с переводом и делает из них карточки. Каждую пару сверяет с переводчиком — ошибки авторов отсеиваются.</span></li>
            ${home ? `<li><span aria-hidden="true">🎬</span><span><b>Скоро:</b> видео авторов с субтитрами и «слушать автора» — в наушниках.</span></li>
            <li><span aria-hidden="true">🔐</span><span><b>Что нужно:</b> один раз подключить свой Telegram. Ключи хранятся только на вашем устройстве, в защищённом месте. Приложение только читает — ничего не пишет от вашего имени.</span></li>`
            : `<li><span aria-hidden="true">📖</span><span><b>Читайте прямо здесь:</b> откройте канал — свежие посты, картинки и видео покажутся в приложении. Понравились слова — скопируйте их и нажмите «➕ В карточки».</span></li>
            <li><span aria-hidden="true">🙌</span><span><b>Входить не нужно:</b> открытые каналы читаются без регистрации и без вашего Telegram. Приложение ничего не пишет от вашего имени.</span></li>`}
          </ul>`,
        foot: `<button type="button" class="btn ghost" data-tgi="ok">Понятно</button>${auth || !home ? '<button type="button" class="btn primary lg tgi-cta" data-tgi="list">📢 Норвежские каналы</button>' : `<button type="button" class="btn primary lg tgi-cta" data-tgi="login">${TG(20)} Подключить Telegram</button>`}`,
      });
      m.el.addEventListener('click', e => {
        const b = e.target.closest('[data-tgi]'); if (!b) return;
        m.close();
        if (b.dataset.tgi === 'login') Telegram.loginWizard(() => { patch({ used: Date.now() }); });
        if (b.dataset.tgi === 'list') { const t = document.querySelector('#modal-root .tg-modal [data-tgtab="channels"]'); if (t) t.click(); else Telegram.open(null, 'channels'); }
      });
      return m;
    },
    firstVisit() {
      if (state().intro || otherGuide()) return;
      setTimeout(() => { if (!state().intro && !otherGuide() && document.querySelector('#modal-root .tg-modal')) this.intro(); }, 450);
    },
    /** the soft reminder: after the intro, until Telegram is really used — a dot + a bubble ≤ once a day, ≤ 5 times */
    remind() {
      const s = state();
      if (!s.intro || s.used || (window.Guides && Guides.off('tg-remind'))) return;
      const anchor = () => [document.querySelector('.sidebar [data-sb="telegram"]'), document.querySelector('#view [data-act="telegram"]')]
        .find(b => b && b.getBoundingClientRect().width && b.getBoundingClientRect().top > 0 && b.getBoundingClientRect().bottom < innerHeight - 60);
      document.querySelectorAll('.sidebar [data-sb="telegram"], #view [data-act="telegram"]').forEach(b => b.classList.add('tgr-new'));
      const now = Date.now(), day = 20 * 3600e3;
      if ((s.shown || 0) >= 5 || (s.last && now - s.last < day) || now - s.intro < day / 2) return;
      let tries = 0;
      const t = setInterval(() => {
        if (++tries > 120) { clearInterval(t); return; }
        if (!(App.view && App.view.name === 'home') || modalOpen() || otherGuide() || document.querySelector('.tgr-hint')) return;
        const b = anchor(); if (!b) return;
        clearInterval(t);
        patch({ shown: (state().shown || 0) + 1, last: Date.now() });
        const tip = document.createElement('div');
        tip.className = 'tgr-hint'; tip.setAttribute('role', 'status');
        tip.innerHTML = `<span class="tgr-txt">${TG(20)}<span>В Телеграме много <b>норвежских каналов</b>. Приложение превращает их посты в карточки — и проверяет перевод.</span></span>
          <span class="tgr-act"><button type="button" class="btn sm primary" data-tgr="go">Показать</button><button type="button" class="btn sm ghost" data-tgr="never">Больше не напоминать</button></span>`;
        document.body.appendChild(tip);
        const place = () => {
          if (!tip.isConnected) return;
          const r = b.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
          const left = Math.max(10, Math.min(innerWidth - w - 10, r.left + r.width / 2 - w / 2));
          const below = r.bottom + 12 + h < innerHeight - 10;
          tip.classList.toggle('above', !below);
          tip.style.left = left + 'px'; tip.style.top = (below ? r.bottom + 12 : r.top - 12 - h) + 'px';
          tip.style.setProperty('--arrow', Math.max(16, Math.min(w - 16, r.left + r.width / 2 - left)) + 'px');
        };
        place(); requestAnimationFrame(place);
        window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
        const gone = () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); tip.classList.add('out'); setTimeout(() => tip.remove(), 300); };
        tip.addEventListener('click', e => {
          const x = e.target.closest('[data-tgr]'); if (!x) return;
          gone();
          if (x.dataset.tgr === 'go') Telegram.open(null, 'channels');
          else { if (window.Guides) Guides.setOff('tg-remind'); document.querySelectorAll('.tgr-new').forEach(n => n.classList.remove('tgr-new')); UI.toast('Хорошо. Telegram — на главной и в меню слева', '', 3500); }
        });
        setTimeout(() => { if (tip.isConnected) gone(); }, 14000);
      }, 1000);
    },
  };

  /* ---------------- into the Telegram window: the «📢 Норвежские каналы» tab + the intro on the first visit ---------------- */
  Telegram.tab_channels = function (el) {
    const u = Telegram._chanRead; Telegram._chanRead = null; // «📖 Читать здесь» from the short block → straight into the channel
    if (u) TgChan.read(el, u); else TgChan.render(el);
  };
  const open0 = Telegram.open;
  Telegram.open = async function (...a) {
    const r = await open0.apply(this, a);
    try { if (this.status && this.status.authorized) patch({ used: state().used || Date.now() }); TgChan.firstVisit(); } catch (e) { console.warn('tg intro', e); }
    return r;
  };
  // the home screen is drawn again and again: the reminder dot comes back with it
  const boot = () => setTimeout(() => {
    try { TgChan.remind(); } catch (e) { console.warn('tg remind', e); }
    const v = document.getElementById('view');
    const mo = new MutationObserver(() => { const s = state(); if (s.intro && !s.used && !(window.Guides && Guides.off('tg-remind'))) document.querySelectorAll('.sidebar [data-sb="telegram"]:not(.tgr-new), #view [data-act="telegram"]:not(.tgr-new)').forEach(b => b.classList.add('tgr-new')); else document.querySelectorAll('.tgr-new').forEach(b => b.classList.remove('tgr-new')); });
    [v, document.getElementById('sidebar')].forEach(n => { if (n) mo.observe(n, { childList: true }); });
  }, 6000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  // words selected in a post drawn by the app: its button says it will take just them
  let selT = 0;
  document.addEventListener('selectionchange', () => {
    clearTimeout(selT);
    selT = setTimeout(() => {
      if (!document.querySelector('.tcn-post')) return;
      const s = window.getSelection && getSelection();
      let post = null;
      if (s && !s.isCollapsed && s.rangeCount) { const n = s.getRangeAt(0).commonAncestorContainer, e = n.nodeType === 1 ? n : n.parentElement; post = e && e.closest('.tcn-post'); }
      if (post && !s.toString().trim()) post = null;
      document.querySelectorAll('.tcn-card.sel').forEach(b => { if (b.closest('.tcn-post') !== post) { b.classList.remove('sel'); b.textContent = '＋ В карточки'; } });
      const b = post && post.querySelector('.tcn-card');
      if (b && !b.classList.contains('sel')) { b.classList.add('sel'); b.textContent = '＋ Выделенное в карточки'; }
    }, 120);
  });

  window.TgChan = TgChan;
})();
