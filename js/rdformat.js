/* ============ 📖 RdFormat: books with their real look — EPUB / FB2 / MOBI / AZW3 / HTML → the reader's own model ============
 * The reader (js/reader.js) never shows a book's own HTML. Every format is WALKED and turned into plain blocks:
 *   block = [kind, text, x?]
 *     kind: 'h' heading (x.lv 1…6) · 'p' paragraph · 'q' quotation · 'v' poetry (x.gap: a new stanza) · 'li' list item
 *           (x.lv depth, x.ol marker) · 'pre' · 'img' picture (text = its alt; x.src resource key, x.w / x.h) ·
 *           'tb' table (text = the cells joined; x.rows = [[ [text, th, colspan] ]]) · 'hr' separator
 *     text: whitespace-collapsed plain text — the ONLY thing read aloud, searched, translated, highlighted
 *     x.m:  inline formatting as ranges [start, end, tag, arg] over the text — tags from a closed list:
 *           i b sc sup sub u s code br (a line break on that space) a (arg = an internal target key; '*key' = a note)
 *     x.al: 'c' / 'r' alignment · x.fn: a footnote group (the note's blocks share it)
 * So the sanitising is by construction: no tag, attribute, URL, script, event handler or style of the book ever reaches
 * the page. Book CSS is READ ONLY for a short whitelist (italic, bold, small caps, super/subscript, underline,
 * strike-through, centre / right alignment, display:none) mapped by class name onto the tags above.
 * Pictures: raster images only (JPEG, PNG, GIF, WebP, BMP — never SVG files), kept as Blobs (text.res) and shown later
 * through blob: URLs. External links are dropped (no fetches from inside a book). Internal links and footnotes become
 * keys «path#id» resolved through text.anchors (key → block index) or text.notes (key → blocks of an EPUB 3 aside / FB2
 * note, shown in a pop-up only).
 * TOC: EPUB 3 nav, EPUB 2 NCX, MOBI/KF8 NCX (js/mobi.js) or FB2 sections → [{ t, b, c: [...] }] (nested).
 * DRM: an encrypted EPUB / MOBI / KFX is recognised and refused with a friendly message (we never break DRM).
 * Public: window.RdFormat = { epub(file), fb2(file), mobi(file), html(text, name), imgSize(bytes), drmMsg }.
 */
(function () {
  'use strict';
  const friendly = (msg, code) => { const e = new Error(msg); e.friendly = true; if (code) e.code = code; return e; };
  const DRM_MSG = 'Эта книга защищена от копирования (DRM). Такие файлы открываются только в программе магазина, где книга куплена. Если у вас есть версия без защиты (например, из библиотеки общественного достояния) — загрузите её.';
  const KFX_MSG = 'Это книга Kindle в новом формате KFX — браузер её прочитать не может. Скачайте эту книгу как AZW3, MOBI или EPUB и загрузите снова.';
  const RASTER = /^image\/(jpeg|png|gif|webp|bmp)$/i;
  const MAX_IMG = 8e6, MAX_IMGS = 400;

  /* ---------- picture sizes from the first bytes (no decoding) ---------- */
  function imgSize(u) {
    try {
      if (!u || u.length < 24) return null;
      if (u[0] === 0x89 && u[1] === 0x50) return { w: (u[16] << 24 | u[17] << 16 | u[18] << 8 | u[19]) >>> 0, h: (u[20] << 24 | u[21] << 16 | u[22] << 8 | u[23]) >>> 0, type: 'image/png' };
      if (u[0] === 0x47 && u[1] === 0x49) return { w: u[6] | u[7] << 8, h: u[8] | u[9] << 8, type: 'image/gif' };
      if (u[0] === 0x42 && u[1] === 0x4d) return { w: Math.abs(u[18] | u[19] << 8 | u[20] << 16 | u[21] << 24), h: Math.abs(u[22] | u[23] << 8 | u[24] << 16 | u[25] << 24), type: 'image/bmp' };
      if (u[0] === 0x52 && u[1] === 0x49 && u[8] === 0x57 && u[9] === 0x45) {
        const f = String.fromCharCode(u[12], u[13], u[14], u[15]);
        if (f === 'VP8 ') return { w: (u[26] | u[27] << 8) & 0x3fff, h: (u[28] | u[29] << 8) & 0x3fff, type: 'image/webp' };
        if (f === 'VP8L') { const b = u[21] | u[22] << 8 | u[23] << 16 | u[24] << 24; return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1, type: 'image/webp' }; }
        if (f === 'VP8X') return { w: 1 + (u[24] | u[25] << 8 | u[26] << 16), h: 1 + (u[27] | u[28] << 8 | u[29] << 16), type: 'image/webp' };
        return { w: 0, h: 0, type: 'image/webp' };
      }
      if (u[0] === 0xff && u[1] === 0xd8) {
        let i = 2;
        while (i + 9 < u.length) {
          if (u[i] !== 0xff) { i++; continue; }
          const mk = u[i + 1];
          if (mk === 0xd8 || mk === 0x01 || (mk >= 0xd0 && mk <= 0xd7)) { i += 2; continue; }
          const len = u[i + 2] << 8 | u[i + 3];
          if ((mk >= 0xc0 && mk <= 0xcf) && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) return { h: u[i + 5] << 8 | u[i + 6], w: u[i + 7] << 8 | u[i + 8], type: 'image/jpeg' };
          i += 2 + len;
        }
        return { w: 0, h: 0, type: 'image/jpeg' };
      }
    } catch (e) { /* not a picture */ }
    return null;
  }

  /* ---------- the block builder: text runs with the active tags, whitespace collapsed ---------- */
  function Builder() {
    this.blocks = []; this.anchors = {}; this.notes = {}; this.cur = null; this.into = this.blocks; this.noteKey = ''; this.pendingAnchors = [];
  }
  Builder.prototype = {
    open(k, x) { this.flush(); this.cur = { k, t: '', m: [], x: Object.assign({}, x || {}) }; this.pendingAnchors.forEach(a => this.setAnchor(a, true)); this.pendingAnchors = []; },
    ensure(k, x) { if (!this.cur) this.open(k || 'p', x); },
    text(s, tags, pre) {
      if (!s) return;
      s = pre ? String(s).replace(/[\r\n\t]+/g, ' ') : String(s).replace(/[\s ]+/g, ' ');
      s = s.replace(/[­​﻿]/g, '');
      if (!s) return;
      const c = this.cur;
      if (!c) { if (!s.trim()) return; this.open('p'); return this.text(s, tags, pre); }
      if (!pre && (!c.t || c.t.endsWith(' '))) s = s.replace(/^ +/, '');
      if (!s) return;
      const a = c.t.length;
      c.t += s;
      (tags || []).forEach(([tag, arg]) => c.m.push([a, c.t.length, tag, arg]));
    },
    br() {
      const c = this.cur; if (!c || !c.t) return;
      if (!c.t.endsWith(' ')) c.t += ' ';
      c.m.push([c.t.length - 1, c.t.length, 'br']);
    },
    /** an id in the book: where its target is — the block being built, or the next one */
    anchor(key) { if (!key) return; if (this.cur && this.cur.t) this.setAnchor(key, true); else this.pendingAnchors.push(key); },
    setAnchor(key, now) {
      if (this.noteKey) { this.anchors[key] = 'n:' + this.noteKey; return; }
      if (!(key in this.anchors)) this.anchors[key] = now ? this.into.length : this.into.length;
    },
    push(b) {
      this.flush();
      this.pendingAnchors.forEach(a => this.setAnchor(a, false)); this.pendingAnchors = [];
      this.into.push(b);
    },
    flush() {
      const c = this.cur; this.cur = null;
      if (!c) return;
      let t = c.t;
      const lead = t.length - t.replace(/^\s+/, '').length;
      t = t.trim();
      if (!t || !/[\p{L}\p{N}]/u.test(t)) {
        // an empty paragraph that held an anchor: the anchor moves to the next block
        return;
      }
      const m = [];
      c.m.forEach(([s, e, tag, arg]) => {
        s = Math.max(0, s - lead); e = Math.min(t.length, e - lead);
        if (tag === 'br') { if (s > 0 && s < t.length) m.push([s, s + 1, 'br']); return; }
        if (e <= s) return;
        const last = m.length && m.find(q => q[2] === tag && q[3] === arg && q[1] === s);
        if (last) last[1] = e; else m.push(arg != null ? [s, e, tag, arg] : [s, e, tag]);
      });
      const x = c.x; if (m.length) x.m = m;
      Object.keys(x).forEach(k => { if (x[k] == null || x[k] === '') delete x[k]; });
      this.into.push(Object.keys(x).length ? [c.k, t, x] : [c.k, t]);
    },
    noteStart(key) { this.flush(); this.noteKey = key; this.into = this.notes[key] = this.notes[key] || []; },
    noteEnd() { this.flush(); this.noteKey = ''; this.into = this.blocks; },
  };

  /* ---------- book CSS: a whitelist read by class (never applied as CSS) ---------- */
  function styleProps(decl) {
    const o = {};
    String(decl || '').split(';').forEach(p => {
      const i = p.indexOf(':'); if (i < 0) return;
      const k = p.slice(0, i).trim().toLowerCase(), v = p.slice(i + 1).trim().toLowerCase().replace(/\s*!important$/, '');
      if (k === 'font-style' && /italic|oblique/.test(v)) o.i = 1;
      else if (k === 'font-style' && v === 'normal') o.i = 0;
      else if (k === 'font-weight' && (/bold/.test(v) || +v >= 600)) o.b = 1;
      else if ((k === 'font-variant' || k === 'font-variant-caps') && /small-caps/.test(v)) o.sc = 1;
      else if (k === 'vertical-align' && /super/.test(v)) o.sup = 1;
      else if (k === 'vertical-align' && /^sub/.test(v)) o.sub = 1;
      else if (k === 'text-decoration' || k === 'text-decoration-line') { if (/underline/.test(v)) o.u = 1; if (/line-through/.test(v)) o.s = 1; }
      else if (k === 'text-align' && /center/.test(v)) o.al = 'c';
      else if (k === 'text-align' && /right|end/.test(v)) o.al = 'r';
      else if (k === 'display' && v === 'none') o.hide = 1;
    });
    return o;
  }
  function cssRules(texts) {
    const rules = {};
    (texts || []).forEach(css => {
      css = String(css || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@(import|charset|namespace)[^;{}]*;/gi, ' ');
      const re = /([^{}]+)\{([^{}]*)\}/g;
      let m;
      while ((m = re.exec(css))) {
        const props = styleProps(m[2]);
        if (!Object.keys(props).length) continue;
        m[1].split(/[;{}]/).pop().split(',').forEach(sel => {
          const s = sel.trim();
          const mm = /^(?:[a-z][a-z0-9]*)?\.([\w-]+)$/i.exec(s);
          if (mm) rules[mm[1]] = Object.assign(rules[mm[1]] || {}, props);
        });
      }
    });
    return rules;
  }

  /* ---------- XHTML / HTML → blocks (EPUB, MOBI, HTML files) ---------- */
  const SKIP = new Set(['script', 'style', 'noscript', 'head', 'title', 'button', 'input', 'select', 'textarea', 'iframe', 'object', 'embed', 'audio', 'video', 'canvas', 'template', 'math', 'rt', 'rp', 'link', 'meta', 'map', 'area', 'frame', 'frameset', 'applet', 'source', 'track']);
  const INL = { i: 'i', em: 'i', cite: 'i', dfn: 'i', var: 'i', b: 'b', strong: 'b', sup: 'sup', sub: 'sub', u: 'u', ins: 'u', s: 's', strike: 's', del: 's', code: 'code', kbd: 'code', samp: 'code', tt: 'code' };
  const BLOCKS = new Set(['p', 'div', 'section', 'article', 'header', 'footer', 'main', 'aside', 'figure', 'figcaption', 'dd', 'dt', 'dl', 'address', 'center', 'body', 'html', 'nav', 'caption', 'details', 'summary', 'hgroup', 'blockquote', 'li', 'ul', 'ol', 'pre', 'table', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
  const epubType = el => { let v = ''; for (const a of el.attributes || []) if (/(^|:)type$/.test(a.name) && a.name !== 'type') v += ' ' + a.value; return v; };
  function normPath(p) { const out = []; String(p || '').split('/').forEach(s => { if (s === '..') out.pop(); else if (s && s !== '.') out.push(s); }); return out.join('/'); }
  function resolveHref(base, href) {
    href = String(href || '').trim();
    if (!href || /^(javascript|data|vbscript|mailto|tel|file):/i.test(href)) return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return null; // external: dropped
    const hash = href.indexOf('#');
    let path = hash >= 0 ? href.slice(0, hash) : href, frag = hash >= 0 ? href.slice(hash + 1) : '';
    try { path = decodeURIComponent(path); } catch (e) { /* as is */ }
    try { frag = decodeURIComponent(frag); } catch (e) { /* as is */ }
    const dir = base.includes('/') ? base.replace(/[^/]*$/, '') : '';
    const file = path ? normPath(dir + path) : base;
    return frag ? file + '#' + frag : file;
  }
  const isNoteText = t => /^\s*(\[?\(?\s*(\d{1,3}|[*†‡§¶]+|[ivxlc]{1,5}|[a-z])\s*\)?\]?)\s*$/i.test(t);
  function pageMarker(el) {
    const txt = String(el.textContent || '').trim();
    if (txt.length > 20) return false;
    const ty = epubType(el), cls = String(el.getAttribute('class') || '');
    return /\bpagebreak\b/.test(ty) || /doc-pagebreak/.test(el.getAttribute('role') || '') || /(^|\s)(pagenum|page-?num(ber)?|pageno|page-?break|folio)(\s|$)/i.test(cls);
  }

  /** walk one document body into the builder. ctx: { file, rules, B, res (path → true when used) } */
  function walkDoc(root, file, ctx) {
    const B = ctx.B, rules = ctx.rules || {};
    let fnSeq = ctx.fnSeq || 0;
    const imgBlock = (src, alt) => {
      const key = src && resolveHref(file, src);
      if (!key || key.includes('#')) return;
      ctx.need.add(key);
      B.push(['img', String(alt || '').replace(/\s+/g, ' ').trim().slice(0, 300), { src: key }]);
    };
    const walk = (el, st) => {
      for (const n of el.childNodes) {
        if (n.nodeType === 3 || n.nodeType === 4) { if (!st.hide) B.text(n.nodeValue, st.tags, st.pre); continue; }
        if (n.nodeType !== 1) continue;
        const tag = String(n.localName || n.nodeName || '').toLowerCase();
        if (SKIP.has(tag)) continue;
        if (n.hasAttribute && n.hasAttribute('hidden')) continue;
        const id = n.getAttribute && (n.getAttribute('id') || (tag === 'a' && n.getAttribute('name')));
        if (pageMarker(n)) { if (id) B.anchor(file + '#' + id); n.querySelectorAll && n.querySelectorAll('[id]').forEach(e => B.anchor(file + '#' + e.getAttribute('id'))); continue; }
        // styles: class rules + the inline style attribute (whitelist only)
        let props = {};
        String(n.getAttribute('class') || '').split(/\s+/).forEach(c => { if (c && rules[c]) Object.assign(props, rules[c]); });
        if (n.getAttribute('style')) Object.assign(props, styleProps(n.getAttribute('style')));
        if (props.hide) continue;
        // old HTML (MOBI 6): align="center" and a lone big <font size="6"> as a heading
        const alAttr = String(n.getAttribute('align') || '').toLowerCase();
        if (!props.al && alAttr === 'center') props.al = 'c'; else if (!props.al && alAttr === 'right') props.al = 'r';
        if ((tag === 'font' || tag === 'big') && B.cur && B.cur.k !== 'h' && !B.cur.t.trim()) {
          const raw = String(n.getAttribute('size') || ''), sz = tag === 'big' ? 5 : /^\+\d$/.test(raw) ? 3 + +raw.slice(1) : +raw || 0;
          const own = String(n.textContent || '').replace(/\s+/g, ' ').trim();
          if (sz >= 5 && own && own.length < 160 && n.parentNode && String(n.parentNode.textContent || '').replace(/\s+/g, ' ').trim() === own) { B.cur.k = 'h'; B.cur.x.lv = sz >= 7 ? 1 : sz === 6 ? 2 : 3; }
        }
        const ty = epubType(n), cls = String(n.getAttribute('class') || '');
        // an EPUB 3 footnote / endnote aside: out of the flow, into the notes
        if (/\b(footnote|endnote|rearnote|note)\b/.test(ty) && /^(aside|section|div|li|p)$/.test(tag) && id && tag === 'aside') {
          B.noteStart(file + '#' + id);
          walk(n, { tags: [], k: 'p', lv: 0 });
          B.noteEnd();
          continue;
        }
        const s2 = Object.assign({}, st);
        s2.tags = st.tags.slice();
        const addTag = (t, a) => { if (!s2.tags.some(x => x[0] === t)) s2.tags.push(a != null ? [t, a] : [t]); };
        if (props.i) addTag('i'); if (props.b) addTag('b'); if (props.sc) addTag('sc'); if (props.sup) addTag('sup'); if (props.sub) addTag('sub'); if (props.u) addTag('u'); if (props.s) addTag('s');
        if (props.i === 0) s2.tags = s2.tags.filter(x => x[0] !== 'i');
        if (INL[tag]) addTag(INL[tag]);
        if (tag === 'small' && /caps|smcap|sc\b/i.test(cls)) addTag('sc');
        if (/(^|\s)(smcap|smallcaps|small-caps|sc)(\s|$)/i.test(cls)) addTag('sc');
        // a group of footnote paragraphs in the flow (Gutenberg «div.footnote», EPUB 3 footnote sections)
        if ((/(^|\s)(footnotes?|endnotes?|fnote|note)(\s|$)/i.test(cls) || /\b(footnote|endnote|rearnote)\b/.test(ty)) && BLOCKS.has(tag)) s2.fn = 'g' + (++fnSeq);
        if (/(^|\s)(poem|poetry|stanza|verse|lg)(\s|$)/i.test(cls) || /z3998:(poem|verse)/.test(ty)) { s2.k = 'v'; s2.gap = 1; }
        if (props.al) s2.al = props.al;
        const bx = () => ({ al: s2.al, fn: s2.fn });
        if (id) B.anchor(file + '#' + id);
        if (tag === 'br') { B.br(); continue; }
        if (tag === 'img' || tag === 'image') {
          const src = n.getAttribute('src') || n.getAttribute('href') || n.getAttribute('xlink:href') || (n.getAttributeNS && n.getAttributeNS('http://www.w3.org/1999/xlink', 'href')) || '';
          const curK = B.cur && B.cur.k, curX = B.cur && B.cur.x;
          imgBlock(src, n.getAttribute('alt') || n.getAttribute('title') || '');
          if (curK && curK !== 'h') B.open(curK, curX);
          continue;
        }
        if (tag === 'svg') { n.querySelectorAll && [...n.getElementsByTagName('*')].filter(e => /^image$/i.test(e.localName)).forEach(e => imgBlock(e.getAttribute('href') || e.getAttribute('xlink:href') || (e.getAttributeNS && e.getAttributeNS('http://www.w3.org/1999/xlink', 'href')) || '', '')); continue; }
        if (tag === 'hr') { B.push(['hr', '']); continue; }
        if (tag === 'a') {
          const href = n.getAttribute('href') || n.getAttribute('xlink:href') || '';
          const key = href && resolveHref(file, href);
          if (key) {
            const note = /noteref|annoref/.test(ty) || /(^|\s)(fnanchor|noteref|footnote-?ref|fn-?ref|nref)(\s|$)/i.test(cls) || (n.parentNode && /^sup$/i.test(n.parentNode.localName || '') && isNoteText(n.textContent)) || (/^sup$/i.test((n.firstElementChild || {}).localName || '') && isNoteText(n.textContent));
            s2.tags = s2.tags.filter(x => x[0] !== 'a');
            s2.tags.push(['a', (note ? '*' : '') + key]);
          }
          walk(n, s2);
          continue;
        }
        if (tag === 'table') {
          B.flush();
          const rows = [];
          for (const tr of n.getElementsByTagName('tr')) {
            if (rows.length >= 300) break;
            const cells = [];
            for (const td of tr.children) {
              const tn = String(td.localName || '').toLowerCase();
              if (tn !== 'td' && tn !== 'th') continue;
              cells.push([String(td.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 600), tn === 'th' ? 1 : 0, Math.min(20, +td.getAttribute('colspan') || 1)]);
            }
            if (cells.length) rows.push(cells);
          }
          n.querySelectorAll && n.querySelectorAll('[id]').forEach(e => B.anchor(file + '#' + e.getAttribute('id')));
          const t = rows.map(r => r.map(c => c[0]).filter(Boolean).join(' · ')).filter(Boolean).join(' · ');
          if (rows.length && t) B.push(['tb', t, { rows }]);
          // pictures inside a table (a layout table around an illustration)
          for (const im of n.getElementsByTagName('img')) imgBlock(im.getAttribute('src') || '', im.getAttribute('alt') || '');
          continue;
        }
        if (/^h[1-6]$/.test(tag)) { B.open('h', Object.assign(bx(), { lv: +tag[1] })); walk(n, Object.assign(s2, { k: 'h' })); B.flush(); continue; }
        if (tag === 'ul' || tag === 'ol') {
          let num = +(n.getAttribute('start') || 1);
          const lv = (st.lv || 0) + 1;
          for (const li of n.childNodes) {
            if (li.nodeType === 1 && /^li$/i.test(li.localName)) {
              const lid = li.getAttribute('id'); if (lid) B.anchor(file + '#' + lid);
              B.open('li', Object.assign(bx(), { lv, ol: tag === 'ol' ? (num++) + '.' : '•' }));
              walk(li, Object.assign({}, s2, { k: 'li', lv, liCont: 1 }));
              B.flush();
            } else if (li.nodeType === 1) walk({ childNodes: [li] }, Object.assign({}, s2, { lv }));
            else if (li.nodeType === 3 && li.nodeValue.trim()) B.text(li.nodeValue, s2.tags);
          }
          continue;
        }
        if (tag === 'blockquote') { B.flush(); walk(n, Object.assign(s2, { k: s2.k === 'v' ? 'v' : 'q' })); B.flush(); continue; }
        if (tag === 'pre') { B.open('pre', bx()); walk(n, Object.assign(s2, { pre: 1, k: 'pre' })); B.flush(); continue; }
        if (BLOCKS.has(tag)) {
          const k = s2.liCont && B.cur && B.cur.k === 'li' && !B.cur.t ? 'li' : (s2.k === 'h' ? 'h' : s2.k || 'p');
          const keepLi = k === 'li' && B.cur && B.cur.k === 'li' && !B.cur.t;
          if (!keepLi) { B.flush(); }
          const gap = s2.gap && st.k !== 'v' ? 1 : (s2.gap && /stanza/i.test(cls) ? 1 : 0);
          const hasBlockKids = [...n.childNodes].some(c => c.nodeType === 1 && BLOCKS.has(String(c.localName || '').toLowerCase()));
          if (!keepLi && !hasBlockKids) B.open(k, Object.assign(bx(), gap ? { gap: 1 } : {}, k === 'li' ? { lv: s2.lv } : {}));
          walk(n, Object.assign(s2, { gap: 0, liCont: 0 }));
          B.flush();
          continue;
        }
        walk(n, s2);
      }
    };
    walk(root, { tags: [], k: 'p', lv: 0 });
    B.flush();
    ctx.fnSeq = fnSeq;
  }

  function parseXml(str, html) {
    let d = null;
    if (!html) { try { d = new DOMParser().parseFromString(str, 'application/xhtml+xml'); if (d.getElementsByTagName('parsererror').length) d = null; } catch (e) { d = null; } }
    if (!d) d = new DOMParser().parseFromString(str, 'text/html');
    return d;
  }
  const bodyOf = d => d.body || d.getElementsByTagName('body')[0] || d.documentElement;

  /** spine documents + resources → the model. src: { files: [{ href, html }], css: [text], getRes(path) → Promise<{ type, data }>, toc: [{ title, href, children }] } */
  async function fromSpine(src, busy) {
    const B = new Builder();
    const ctx = { B, rules: cssRules(src.css), need: new Set(), fnSeq: 0 };
    for (let i = 0; i < src.files.length; i++) {
      const f = src.files[i];
      if (busy && busy.set) busy.set(`глава ${i + 1} из ${src.files.length}`, i + 1, src.files.length);
      let doc;
      try { doc = parseXml(f.html, f.htmlMode); } catch (e) { continue; }
      B.anchor(f.href);
      walkDoc(bodyOf(doc), f.href, ctx);
      B.flush();
      if (i % 6 === 5) await new Promise(r => setTimeout(r, 0));
    }
    return tail(B, ctx.need, src);
  }
  /** TOC entries with hrefs → [{ t, b, c }] (entries whose target is unknown keep their children) */
  function tocTree(list, anchors, depth = 0) {
    const out = [];
    (list || []).forEach(e => {
      if (!e || depth > 8) return;
      const kids = tocTree(e.children, anchors, depth + 1);
      const key = e.href || '';
      let b = anchors[key];
      if (b == null && key.includes('#')) b = anchors[key.split('#')[0]];
      const t = String(e.title || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      if (typeof b === 'number' && t) out.push({ t, b, c: kids });
      else out.push(...kids);
    });
    return out;
  }

  /* ---------- EPUB ---------- */
  async function zipOf(file) {
    if (!window.U || !U.lib || !U.lib.jszip) throw friendly('Для этого формата нужен интернет при первой загрузке — попробуйте позже');
    let JSZip;
    try { JSZip = await U.lib.jszip(); } catch (e) { throw friendly('Не получилось загрузить помощника для этого формата — проверьте интернет и попробуйте ещё раз'); }
    try { return await JSZip.loadAsync(await file.arrayBuffer()); } catch (e) { throw friendly('Файл EPUB повреждён — откройте его в другой программе и сохраните заново'); }
  }
  async function epub(file, busy) {
    const zip = await zipOf(file);
    const broken = () => friendly('Файл EPUB повреждён — откройте его в другой программе и сохраните заново');
    // DRM: encrypted content (fonts obfuscated by the IDPF / Adobe rule are not DRM)
    const enc = zip.file('META-INF/encryption.xml');
    if (zip.file('META-INF/rights.xml')) throw friendly(DRM_MSG, 'drm');
    if (enc) {
      const x = await enc.async('text');
      const algs = (x.match(/Algorithm="([^"]+)"/g) || []).map(s => s.slice(11, -1));
      const uris = (x.match(/URI="([^"]+)"/g) || []).map(s => s.slice(5, -1));
      const fontsOnly = uris.length && uris.every(u => /\.(otf|ttf|woff2?|ttc)$/i.test(u));
      if (algs.some(a => !/idpf\.org\/2008\/embedding|ns\.adobe\.com\/pdf\/enc#RC/.test(a)) && !fontsOnly) throw friendly(DRM_MSG, 'drm');
    }
    const cf = zip.file('META-INF/container.xml');
    if (!cf) throw broken();
    const opfPath = (/full-path="([^"]+)"/.exec(await cf.async('text')) || [])[1];
    const of = opfPath && zip.file(opfPath);
    if (!of) throw broken();
    const opf = new DOMParser().parseFromString(await of.async('text'), 'application/xml');
    const base = opfPath.includes('/') ? opfPath.replace(/[^/]+$/, '') : '';
    const tag = n => [...opf.getElementsByTagNameNS('*', n)];
    const title = ((tag('title')[0] || {}).textContent || '').trim();
    const author = ((tag('creator')[0] || {}).textContent || '').trim();
    const lang = ((tag('language')[0] || {}).textContent || '').trim();
    const man = {};
    tag('item').forEach(i => {
      let href = i.getAttribute('href') || '';
      try { href = decodeURIComponent(href); } catch (e) { /* as is */ }
      man[i.getAttribute('id')] = { path: normPath(base + href), type: i.getAttribute('media-type') || '', props: i.getAttribute('properties') || '' };
    });
    const get = async (path, kind) => { const f = zip.file(path) || zip.file(decodeURIComponent(path)); return f ? f.async(kind) : null; };
    const files = [];
    for (const ir of tag('itemref')) {
      const it = man[ir.getAttribute('idref')];
      if (!it || (it.type && !/html|xml/.test(it.type)) || /\bnav\b/.test(it.props)) continue;
      const html = await get(it.path, 'text');
      if (html != null) files.push({ href: it.path, html, htmlMode: /html/.test(it.type) && !/xhtml/.test(it.type) });
    }
    if (!files.length) throw broken();
    const css = [];
    for (const it of Object.values(man)) if (/css/.test(it.type)) { const t = await get(it.path, 'text'); if (t && t.length < 400e3) css.push(t); }
    // table of contents: EPUB 3 nav, else EPUB 2 NCX
    let toc = [];
    try {
      const nav = Object.values(man).find(x => /\bnav\b/.test(x.props));
      if (nav) {
        const d = parseXml(await get(nav.path, 'text') || '');
        const navs = [...d.getElementsByTagName('*')].filter(e => /^nav$/i.test(e.localName));
        const tn = navs.find(e => /\btoc\b/.test(epubType(e))) || navs[0];
        const ol = tn && [...tn.children].find(e => /^ol$/i.test(e.localName));
        const rd = o => [...o.children].filter(li => /^li$/i.test(li.localName)).map(li => {
          const a = [...li.children].find(e => /^(a|span)$/i.test(e.localName));
          const sub = [...li.children].find(e => /^ol$/i.test(e.localName));
          return { title: a ? a.textContent : '', href: a && a.getAttribute('href') ? resolveHref(nav.path, a.getAttribute('href')) : '', children: sub ? rd(sub) : [] };
        });
        if (ol) toc = rd(ol);
      }
      if (!toc.length) {
        const spineToc = (tag('spine')[0] || { getAttribute: () => '' }).getAttribute('toc');
        const ncx = man[spineToc] || Object.values(man).find(x => /dtbncx/.test(x.type));
        if (ncx) {
          const d = new DOMParser().parseFromString(await get(ncx.path, 'text') || '<x/>', 'application/xml');
          const map = d.getElementsByTagNameNS('*', 'navMap')[0];
          const rd = el => [...el.children].filter(e => e.localName === 'navPoint').map(np => {
            const lab = [...np.children].find(e => e.localName === 'navLabel');
            const c = [...np.children].find(e => e.localName === 'content');
            return { title: lab ? lab.textContent : '', href: c ? resolveHref(ncx.path, c.getAttribute('src') || '') : '', children: rd(np) };
          });
          if (map) toc = rd(map);
        }
      }
    } catch (e) { /* no TOC: headings are used */ }
    const r = await fromSpine({ files, css, toc, getRes: async path => { const d = await get(path, 'uint8array'); const it = Object.values(man).find(x => x.path === path); return d ? { data: d, type: it ? it.type : '' } : null; } }, busy);
    // the cover picture (EPUB 3 «cover-image», EPUB 2 <meta name="cover">)
    let coverBlob = null;
    try {
      let it = Object.values(man).find(x => /\bcover-image\b/.test(x.props));
      if (!it) { const mc = tag('meta').find(x => x.getAttribute('name') === 'cover'); if (mc) it = man[mc.getAttribute('content')]; }
      if (it && /^image\//.test(it.type)) { const d = await get(it.path, 'uint8array'); if (d) coverBlob = new Blob([d], { type: it.type }); }
    } catch (e) { /* drawn cover */ }
    return Object.assign(r, { title, author, lang, coverBlob });
  }

  /* ---------- MOBI / AZW3 (js/mobi.js) ---------- */
  async function mobi(file, busy) {
    if (!window.MobiBook) throw friendly('Помощник для книг Kindle ещё загружается — попробуйте через секунду');
    const u8 = new Uint8Array(await file.arrayBuffer());
    let book;
    try { book = await MobiBook.parse(u8); } catch (e) {
      const c = e && e.code;
      if (c === 'drm') throw friendly(DRM_MSG, 'drm');
      if (c === 'kfx') throw friendly(KFX_MSG, 'kfx');
      if (c === 'notmobi') throw friendly('Этот файл не похож на книгу Kindle (MOBI / AZW3). Попробуйте другой файл этой книги — например, EPUB', 'notmobi');
      throw friendly('Не получилось прочитать эту книгу Kindle — файл повреждён. Попробуйте другой файл этой книги (EPUB, AZW3 или MOBI)');
    }
    const resources = book.resources || {};
    const css = Object.keys(resources).filter(k => /css/.test(resources[k].type)).map(k => { try { return new TextDecoder('utf-8').decode(resources[k].data); } catch (e) { return ''; } });
    const r = await fromSpine({ files: book.spine.map(s => ({ href: s.href, html: s.html, htmlMode: true })), css, toc: book.toc, getRes: async p => resources[p] || null }, busy);
    const cov = book.cover && resources[book.cover];
    return Object.assign(r, { title: book.title || '', author: book.author || '', lang: book.lang || '', coverBlob: cov ? new Blob([cov.data], { type: cov.type }) : null });
  }

  /* ---------- HTML file ---------- */
  async function html(text, name) {
    const d = parseXml(text, true);
    const t = d.querySelector && d.querySelector('title');
    const css = [...d.getElementsByTagName('style')].map(s => s.textContent);
    const r = await fromSpine({ files: [{ href: name || 'index.html', html: text, htmlMode: true }], css, toc: [], getRes: async () => null });
    return Object.assign(r, { title: t ? t.textContent.trim() : '', author: '' });
  }

  /* ---------- FB2 ---------- */
  async function fb2(file, busy) {
    const raw = window.U && U.decodeText ? U.decodeText(await file.arrayBuffer()) : await file.text();
    const d = new DOMParser().parseFromString(raw, 'application/xml');
    if (d.getElementsByTagName('parsererror').length) throw friendly('Файл FB2 повреждён — попробуйте сохранить его заново');
    const T = n => [...d.getElementsByTagName(n)];
    const ti = T('title-info')[0] || d;
    const title = ((ti.getElementsByTagName('book-title')[0] || {}).textContent || '').trim();
    const au = ti.getElementsByTagName('author')[0];
    const author = au ? ['first-name', 'middle-name', 'last-name'].map(n => ((au.getElementsByTagName(n)[0] || {}).textContent || '').trim()).filter(Boolean).join(' ') : '';
    const lang = ((ti.getElementsByTagName('lang')[0] || {}).textContent || '').trim();
    const hrefOf = el => el.getAttribute('l:href') || el.getAttribute('xlink:href') || (el.getAttributeNS && el.getAttributeNS('http://www.w3.org/1999/xlink', 'href')) || el.getAttribute('href') || '';
    const B = new Builder();
    const need = new Set();
    const FINL = { emphasis: 'i', strong: 'b', sup: 'sup', sub: 'sub', strikethrough: 's', code: 'code' };
    const inline = (el, tags) => {
      for (const n of el.childNodes) {
        if (n.nodeType === 3 || n.nodeType === 4) { B.text(n.nodeValue, tags); continue; }
        if (n.nodeType !== 1) continue;
        const tn = n.localName;
        if (n.getAttribute('id')) B.anchor('#' + n.getAttribute('id'));
        if (FINL[tn]) { inline(n, tags.concat([[FINL[tn]]])); continue; }
        if (tn === 'a') {
          const h = hrefOf(n);
          if (h && h.startsWith('#')) { const note = n.getAttribute('type') === 'note' || isNoteText(n.textContent); inline(n, tags.filter(x => x[0] !== 'a').concat([['a', (note ? '*' : '') + h]])); }
          else inline(n, tags);
          continue;
        }
        if (tn === 'image') { const h = hrefOf(n); if (h.startsWith('#')) { const k = B.cur && B.cur.k; need.add(h); B.push(['img', n.getAttribute('alt') || '', { src: h }]); if (k) B.open(k); } continue; }
        inline(n, tags);
      }
    };
    const para = (n, k, x) => { if (n.getAttribute('id')) B.anchor('#' + n.getAttribute('id')); B.open(k, x); inline(n, []); B.flush(); };
    const toc = [];
    let secN = 0;
    const walk = (el, depth, tocList, kind) => {
      for (const n of el.children) {
        const tn = n.localName;
        const id = n.getAttribute('id');
        if (tn === 'section') {
          const tEl = [...n.children].find(c => c.localName === 'title');
          const key = id ? '#' + id : '#\u0001s' + (++secN);
          B.anchor(key);
          const entry = { title: tEl ? tEl.textContent.replace(/\s+/g, ' ').trim() : '', href: key, children: [] };
          if (entry.title) tocList.push(entry);
          walk(n, depth + 1, entry.title ? entry.children : tocList, kind);
          continue;
        }
        if (id) B.anchor('#' + id);
        if (tn === 'title') { [...n.children].forEach(c => { if (c.localName === 'p') para(c, 'h', { lv: Math.min(6, depth + 1) }); else if (c.localName === 'empty-line') { /* gap */ } }); if (!n.children.length) para(n, 'h', { lv: Math.min(6, depth + 1) }); continue; }
        if (tn === 'subtitle') { para(n, 'h', { lv: Math.min(6, depth + 2) }); continue; }
        if (tn === 'p') { para(n, kind || 'p'); continue; }
        if (tn === 'empty-line') continue;
        if (tn === 'image') { const h = hrefOf(n); if (h.startsWith('#')) { need.add(h); B.push(['img', n.getAttribute('alt') || n.getAttribute('title') || '', { src: h }]); } continue; }
        if (tn === 'poem') {
          [...n.children].forEach(c => {
            if (c.localName === 'title') [...c.children].forEach(p => para(p, 'h', { lv: Math.min(6, depth + 2) }));
            else if (c.localName === 'stanza') {
              let first = true;
              [...c.children].forEach(v => {
                if (v.localName === 'v') { para(v, 'v', first ? { gap: 1 } : {}); first = false; }
                else if (v.localName === 'title' || v.localName === 'subtitle') [...(v.children.length ? v.children : [v])].forEach(p => para(p, 'h', { lv: Math.min(6, depth + 2) }));
              });
            } else if (c.localName === 'text-author' || c.localName === 'epigraph') para(c, 'q', { al: 'r' });
            else if (c.localName === 'date') para(c, 'p', { al: 'r' });
          });
          continue;
        }
        if (tn === 'epigraph' || tn === 'cite') { walk(n, depth, tocList, 'q'); continue; }
        if (tn === 'text-author') { para(n, 'q', { al: 'r' }); continue; }
        if (tn === 'table') {
          const rows = [...n.children].filter(r => r.localName === 'tr').slice(0, 300).map(r => [...r.children].filter(c => /^t[dh]$/.test(c.localName)).map(c => [c.textContent.replace(/\s+/g, ' ').trim().slice(0, 600), c.localName === 'th' ? 1 : 0, Math.min(20, +c.getAttribute('colspan') || 1)]));
          const t = rows.map(r => r.map(c => c[0]).filter(Boolean).join(' · ')).filter(Boolean).join(' · ');
          if (t) B.push(['tb', t, { rows }]);
          continue;
        }
        if (tn === 'annotation') continue;
        walk(n, depth, tocList, kind);
      }
    };
    const bodies = T('body');
    const main = bodies.filter(b => !/notes|comments/i.test(b.getAttribute('name') || ''));
    main.forEach(b => walk(b, 0, toc));
    // notes body: every section with an id is a note shown in a pop-up
    bodies.filter(b => /notes|comments/i.test(b.getAttribute('name') || '')).forEach(b => {
      const walkN = el => {
        for (const sec of el.children) {
          if (sec.localName !== 'section') continue;
          const id = sec.getAttribute('id');
          if (id) {
            B.noteStart('#' + id);
            for (const c of sec.children) {
              if (c.localName === 'title') { const t = c.textContent.replace(/\s+/g, ' ').trim(); if (t && !/^\[?\d+\]?$/.test(t)) para(c, 'h', { lv: 6 }); }
              else if (c.localName === 'p' || c.localName === 'v') para(c, 'p');
              else if (c.localName === 'poem') [...c.getElementsByTagName('v')].forEach(v => para(v, 'v'));
              else if (c.localName === 'cite') [...c.getElementsByTagName('p')].forEach(p => para(p, 'q'));
            }
            B.noteEnd();
          } else walkN(sec);
        }
      };
      walkN(b);
    });
    B.flush();
    // binaries (pictures, base64)
    const bins = {};
    T('binary').forEach(bn => { const id = bn.getAttribute('id'); if (id) bins['#' + id] = bn; });
    const getRes = async key => {
      const bn = bins[key];
      if (!bn) return null;
      try {
        const bin = atob(bn.textContent.replace(/\s+/g, ''));
        const u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        return { data: u, type: bn.getAttribute('content-type') || '' };
      } catch (e) { return null; }
    };
    // finish through the same path as EPUB (pictures, anchors, TOC)
    const r = await tail(B, need, { getRes, toc });
    let coverBlob = null;
    try {
      const img = (T('coverpage')[0] || { getElementsByTagName: () => [] }).getElementsByTagName('image')[0];
      const c = img && await getRes(hrefOf(img));
      if (c) coverBlob = new Blob([c.data], { type: c.type || 'image/jpeg' });
    } catch (e) { /* drawn cover */ }
    return Object.assign(r, { title, author, lang, coverBlob });
  }
  /** a filled builder → pictures (raster only, bounded), remapped anchors, notes, TOC — shared by every format */
  async function tail(B, needSet, src) {
    const res = {};
    for (const key of [...needSet].slice(0, MAX_IMGS)) {
      try {
        const r = await src.getRes(key);
        if (!r || !r.data || r.data.length > MAX_IMG) continue;
        const sz = imgSize(r.data);
        const type = (sz && sz.type) || r.type;
        if (!RASTER.test(type || '')) continue;
        res[key] = { blob: new Blob([r.data], { type }), w: sz ? sz.w : 0, h: sz ? sz.h : 0 };
      } catch (e) { /* skipped */ }
    }
    const blocks = [], remap = [];
    B.blocks.forEach((b, i) => {
      remap[i] = blocks.length;
      if (b[0] === 'img') { const r = res[b[2].src]; if (!r || (r.w && r.h && r.w <= 2 && r.h <= 2)) return; b[2].w = r.w; b[2].h = r.h; }
      blocks.push(b);
    });
    remap[B.blocks.length] = blocks.length;
    const anchors = {};
    Object.keys(B.anchors).forEach(k => { const v = B.anchors[k]; anchors[k] = typeof v === 'number' ? Math.min(remap[v] != null ? remap[v] : blocks.length, Math.max(0, blocks.length - 1)) : v; });
    const resOut = {};
    Object.keys(res).forEach(k => { resOut[k] = res[k].blob; });
    const notes = {};
    Object.keys(B.notes).forEach(k => { const a = B.notes[k].filter(b => b[0] !== 'img'); if (a.length) notes[k] = a; });
    return { blocks, anchors, notes, res: resOut, toc: tocTree(src.toc || [], anchors) };
  }

  window.RdFormat = { epub, fb2, mobi, html, imgSize, cssRules, styleProps, resolveHref, DRM_MSG, KFX_MSG, _t: { Builder, walkDoc, parseXml } };
})();
