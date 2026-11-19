/* ============ Anki .apkg / .colpkg import & export ============ */
(function () {
  const ZSTD_MAGIC = [0x28, 0xB5, 0x2F, 0xFD];
  const isZstd = b => b && b.length > 4 && ZSTD_MAGIC.every((x, i) => b[i] === x);

  /* ---------- minimal protobuf reader (for new media map) ---------- */
  function readVarint(b, p) {
    let x = 0, shift = 0, byte;
    do { byte = b[p++]; x += (byte & 0x7f) * Math.pow(2, shift); shift += 7; } while (byte & 0x80 && p < b.length);
    return [x, p];
  }
  function skip(b, p, wt) {
    if (wt === 0) return readVarint(b, p)[1];
    if (wt === 1) return p + 8;
    if (wt === 5) return p + 4;
    if (wt === 2) { const [len, q] = readVarint(b, p); return q + len; }
    return b.length;
  }
  function parseEntry(b) {
    let p = 0, name = '', legacy = null;
    while (p < b.length) {
      let tag; [tag, p] = readVarint(b, p);
      const f = Math.floor(tag / 8), wt = tag & 7;
      if (wt === 2) {
        let len; [len, p] = readVarint(b, p);
        if (f === 1) name = new TextDecoder().decode(b.subarray(p, p + len));
        p += len;
      } else if (wt === 0) {
        let v; [v, p] = readVarint(b, p);
        if (f === 255) legacy = v;
      } else p = skip(b, p, wt);
    }
    return { name, legacy };
  }
  function parseMediaEntries(b) {
    const out = []; let p = 0;
    while (p < b.length) {
      let tag; [tag, p] = readVarint(b, p);
      const f = Math.floor(tag / 8), wt = tag & 7;
      if (wt === 2 && f === 1) {
        let len; [len, p] = readVarint(b, p);
        out.push(parseEntry(b.subarray(p, p + len)));
        p += len;
      } else p = skip(b, p, wt);
    }
    return out;
  }

  async function readMediaMap(zip) {
    const map = {}; // filename -> zip entry name
    const f = zip.file('media');
    if (!f) return map;
    let bytes = await f.async('uint8array');
    if (isZstd(bytes)) bytes = (await U.lib.fzstd()).decompress(bytes);
    const txt = new TextDecoder().decode(bytes);
    try {
      const j = JSON.parse(txt);
      Object.entries(j).forEach(([k, v]) => { map[v] = k; });
      return map;
    } catch (e) { /* protobuf */ }
    try {
      parseMediaEntries(bytes).forEach((e, i) => { if (e.name) map[e.name] = String(e.legacy != null ? e.legacy : i); });
    } catch (e) { console.warn('media map parse failed', e); }
    return map;
  }

  function q(db, sql) {
    try { const r = db.exec(sql); return r[0] ? r[0].values : []; } catch (e) { return null; }
  }

  const Anki = {
    /** returns { headers, rows, meta, deckName } */
    async importPackage(buf, onProgress) {
      const JSZip = await U.lib.jszip();
      const zip = await JSZip.loadAsync(buf);
      let dbBytes = null;
      if (zip.file('collection.anki21b')) {
        const fz = await U.lib.fzstd();
        dbBytes = fz.decompress(await zip.file('collection.anki21b').async('uint8array'));
      } else if (zip.file('collection.anki21')) {
        dbBytes = await zip.file('collection.anki21').async('uint8array');
      } else if (zip.file('collection.anki2')) {
        dbBytes = await zip.file('collection.anki2').async('uint8array');
      } else throw new Error('В архиве нет коллекции Anki');
      if (isZstd(dbBytes)) dbBytes = (await U.lib.fzstd()).decompress(dbBytes);

      const SQL = await U.lib.sql();
      const db = new SQL.Database(dbBytes);
      const res = await this.readCollection(db, async (name) => {
        const entry = zip.file(name);
        if (!entry) return null;
        let b = await entry.async('uint8array');
        if (isZstd(b)) b = (await U.lib.fzstd()).decompress(b);
        return b;
      }, await readMediaMap(zip), onProgress);
      db.close();
      return res;
    },

    /** raw .anki2 / .anki21 sqlite file */
    async importCollectionFile(buf) {
      const SQL = await U.lib.sql();
      let bytes = new Uint8Array(buf);
      if (isZstd(bytes)) bytes = (await U.lib.fzstd()).decompress(bytes);
      const db = new SQL.Database(bytes);
      const res = await this.readCollection(db, async () => null, {});
      db.close();
      return res;
    },

    async readCollection(db, getMedia, mediaMap, onProgress) {
      // field names per note type
      const fieldNames = {};
      const hasFieldsTable = (q(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='fields'") || []).length > 0;
      if (hasFieldsTable) {
        (q(db, 'SELECT ntid, ord, name FROM fields ORDER BY ntid, ord') || []).forEach(([ntid, ord, name]) => {
          (fieldNames[ntid] = fieldNames[ntid] || [])[ord] = name;
        });
      } else {
        const m = q(db, 'SELECT models FROM col');
        if (m && m[0] && m[0][0]) {
          try {
            const models = JSON.parse(m[0][0]);
            Object.values(models).forEach(md => { fieldNames[md.id] = md.flds.slice().sort((a, b) => a.ord - b.ord).map(f => f.name); });
          } catch (e) { /* ignore */ }
        }
      }
      // deck names
      const deckNames = {};
      const dk = q(db, 'SELECT id, name FROM decks');
      if (dk && dk.length) dk.forEach(([id, name]) => { deckNames[id] = String(name).replace(/\x1f/g, '::'); });
      else {
        const d = q(db, 'SELECT decks FROM col');
        if (d && d[0] && d[0][0]) { try { Object.values(JSON.parse(d[0][0])).forEach(x => { deckNames[x.id] = x.name; }); } catch (e) { /* ignore */ } }
      }
      const noteDeck = {};
      (q(db, 'SELECT nid, did FROM cards') || []).forEach(([nid, did]) => { if (!(nid in noteDeck)) noteDeck[nid] = did; });

      const notes = q(db, 'SELECT id, mid, flds, tags FROM notes ORDER BY id') || [];
      if (!notes.length) throw new Error('В коллекции Anki нет карточек');
      // most common note type -> headers
      const cnt = {};
      notes.forEach(n => { cnt[n[1]] = (cnt[n[1]] || 0) + 1; });
      const mainMid = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
      const headers = (fieldNames[mainMid] || []).slice();
      const deckCnt = {};
      Object.values(noteDeck).forEach(d => { deckCnt[d] = (deckCnt[d] || 0) + 1; });
      const mainDeck = Object.keys(deckCnt).sort((a, b) => deckCnt[b] - deckCnt[a])[0];
      const deckName = deckNames[mainDeck] && deckNames[mainDeck] !== 'Default' ? deckNames[mainDeck].split('::').pop() : '';

      const rows = [], meta = [];
      let maxCols = headers.length;
      for (let i = 0; i < notes.length; i++) {
        const [nid, , flds, tags] = notes[i];
        const raw = String(flds).split('\x1f');
        maxCols = Math.max(maxCols, raw.length);
        let image = '';
        for (const f of raw) {
          const src = U.firstImgSrc(f);
          if (!src) continue;
          if (/^https?:|^data:/i.test(src)) { image = src; break; }
          let name = src;
          try { name = decodeURIComponent(src); } catch (e) { /* keep */ }
          const entry = mediaMap[name] || mediaMap[src];
          if (entry) {
            try {
              const bytes = await getMedia(entry);
              if (bytes) {
                const blob = new Blob([bytes], { type: U.mimeFromName(name) || 'image/jpeg' });
                image = await U.compressImage(blob, 600, 0.82).catch(() => U.blobToDataURL(blob));
              }
            } catch (e) { console.warn('media', name, e); }
          }
          break;
        }
        rows.push(raw.map(f => U.stripHtml(f)));
        meta.push({ image, tags: String(tags || '').trim().split(/\s+/).filter(Boolean) });
        if (onProgress && i % 50 === 0) onProgress(i, notes.length);
      }
      while (headers.length < maxCols) headers.push('Поле ' + (headers.length + 1));
      return { headers, rows, meta, deckName };
    },

    /* ---------------- export ---------------- */
    async exportPackage(deckName, cards, opts = {}) {
      const SQL = await U.lib.sql();
      const JSZip = await U.lib.jszip();
      const db = new SQL.Database();
      db.exec(`
        CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
        CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
        CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
        CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
        CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
        CREATE INDEX ix_notes_usn on notes (usn);
        CREATE INDEX ix_cards_usn on cards (usn);
        CREATE INDEX ix_revlog_usn on revlog (usn);
        CREATE INDEX ix_cards_nid on cards (nid);
        CREATE INDEX ix_cards_sched on cards (did, queue, due);
        CREATE INDEX ix_revlog_cid on revlog (cid);
        CREATE INDEX ix_notes_csum on notes (csum);
      `);
      const now = Date.now();
      const nowS = Math.floor(now / 1000);
      const did = now;
      const mid = now + 7;
      const both = opts.bothDirections !== false;
      const fieldList = ['Norsk', 'Russisk', 'Bilde', 'Beskrivelse', 'Eksempel', 'EksempelRu', 'Ordklasse'];
      const css = `.card{font-family:Arial,sans-serif;font-size:26px;text-align:center;color:#1b1b2f;background:#fafaff}
.word{font-size:34px;font-weight:bold}.tr{font-size:28px;color:#2b4bd8}.desc{font-size:16px;color:#555;margin-top:10px}
.ex{font-size:18px;font-style:italic;margin-top:12px}.ex span{font-style:normal;color:#666}img{max-width:320px;max-height:240px;border-radius:12px;margin-top:10px}
.nightMode .card,.night_mode .card{background:#1e1e2e;color:#eee}.nightMode .tr,.night_mode .tr{color:#8fb0ff}`;
      const back = `{{#Bilde}}<div>{{Bilde}}</div>{{/Bilde}}{{#Beskrivelse}}<div class="desc">{{Beskrivelse}}</div>{{/Beskrivelse}}{{#Eksempel}}<div class="ex">{{Eksempel}}<br><span>{{EksempelRu}}</span></div>{{/Eksempel}}`;
      const tmpls = [{ name: 'NO → RU', ord: 0, qfmt: '<div class="word">{{Norsk}}</div>', afmt: '{{FrontSide}}<hr id="answer"><div class="tr">{{Russisk}}</div>' + back, did: null, bqfmt: '', bafmt: '' }];
      if (both) tmpls.push({ name: 'RU → NO', ord: 1, qfmt: '<div class="tr">{{Russisk}}</div>', afmt: '{{FrontSide}}<hr id="answer"><div class="word">{{Norsk}}</div>' + back, did: null, bqfmt: '', bafmt: '' });
      const model = {
        id: mid, name: 'Norsk ⇄ Russisk (Norsk Kort)', type: 0, mod: nowS, usn: -1, sortf: 0, did,
        tmpls, flds: fieldList.map((name, ord) => ({ name, ord, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] })),
        css, latexPre: '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
        latexPost: '\\end{document}', latexsvg: false, req: both ? [[0, 'any', [0]], [1, 'any', [1]]] : [[0, 'any', [0]]], tags: [], vers: [],
      };
      const deckObj = (id, name) => ({ id, name, desc: '', mod: nowS, usn: -1, collapsed: false, browserCollapsed: false, conf: 1, dyn: 0, extendNew: 10, extendRev: 50, newToday: [0, 0], revToday: [0, 0], lrnToday: [0, 0], timeToday: [0, 0] });
      const decks = { 1: deckObj(1, 'Default') };
      decks[did] = deckObj(did, deckName);
      const conf = { activeDecks: [1], curDeck: 1, newSpread: 0, collapseTime: 1200, timeLim: 0, estTimes: true, dueCounts: true, curModel: null, nextPos: 1, sortType: 'noteFld', sortBackwards: false, addToCur: true };
      const dconf = { 1: { id: 1, name: 'Default', autoplay: true, maxTaken: 60, mod: 0, replayq: true, timer: 0, usn: 0, dyn: false,
        new: { bury: true, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 7], order: 1, perDay: 20, separate: true },
        lapse: { delays: [10], leechAction: 0, leechFails: 8, minInt: 1, mult: 0 },
        rev: { bury: true, ease4: 1.3, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, minSpace: 1, perDay: 200 } } };
      db.run('INSERT INTO col VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [1, nowS, now, now, 11, 0, 0, 0,
        JSON.stringify(conf), JSON.stringify({ [mid]: model }), JSON.stringify(decks), JSON.stringify(dconf), '{}']);

      const media = {}; const files = [];
      const html = s => U.esc(s || '').replace(/\n/g, '<br>');
      const guidChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-./:;<=>?@[]^_`{|}~';
      const guid = () => Array.from({ length: 10 }, () => guidChars[Math.floor(Math.random() * guidChars.length)]).join('');

      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        let imgField = '';
        if (c.image) {
          let bytes = null, ext = 'jpg';
          try {
            if (c.image.startsWith('data:')) {
              const r = U.dataURLToBytes(c.image); bytes = r.bytes; ext = (r.mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
            } else if (opts.embedRemote !== false) {
              const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 30000);
              const resp = await fetch(c.image, { signal: ctl.signal }); clearTimeout(t);
              if (resp.ok) {
                const b = await resp.blob(); bytes = new Uint8Array(await b.arrayBuffer());
                ext = ((b.type || 'image/jpeg').split('/')[1] || 'jpg').replace('jpeg', 'jpg').split(';')[0];
              }
            }
          } catch (e) { bytes = null; }
          if (bytes) {
            const idx = String(files.length);
            const name = `norskkort_${c.id}.${ext}`;
            media[idx] = name; files.push([idx, bytes]);
            imgField = `<img src="${name}">`;
          } else if (!c.image.startsWith('data:')) imgField = `<img src="${U.esc(c.image)}">`;
        }
        const extra = [(c.forms || []).length ? '📚 Формы:\n' + Prov.listText(c.forms) : '',
          (c.synonyms || []).length ? '🔁 Синонимы:\n' + c.synonyms.map(s => `${s.no}${s.ru ? ' (' + s.ru + ')' : ''}${s.note ? ' — ' + s.note : ''}`).join('\n') : '',
          (c.examples || []).length ? '💬 Примеры:\n' + Prov.listText(c.examples, true) : ''];
        const flds = [html(c.no), html(c.ru), imgField, html([c.description, ...extra].filter(Boolean).join('\n\n')), html(c.example), html(c.exampleRu), html(c.wordClass)];
        const sfld = U.stripHtml(flds[0]);
        const csum = parseInt((await U.sha1Hex(sfld)).slice(0, 8), 16);
        const nid = now + i;
        const tags = (c.tags || []).filter(Boolean).map(t => t.replace(/\s+/g, '_'));
        db.run('INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)', [nid, guid(), mid, nowS, -1, tags.length ? ' ' + tags.join(' ') + ' ' : '', flds.join('\x1f'), sfld, csum, 0, '']);
        for (let ord = 0; ord < tmpls.length; ord++) {
          db.run('INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [now + 1000000 + i * 2 + ord, nid, did, ord, nowS, -1, 0, 0, i + 1, 0, 0, 0, 0, 0, 0, 0, 0, '']);
        }
        opts.onProgress && opts.onProgress(i + 1, cards.length);
      }
      const zip = new JSZip();
      zip.file('collection.anki2', db.export());
      db.close();
      zip.file('media', JSON.stringify(media));
      files.forEach(([idx, bytes]) => zip.file(idx, bytes));
      return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/octet-stream' });
    },
  };

  window.Anki = Anki;
})();
