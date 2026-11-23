/*
 * mobi.js — self-contained MOBI / AZW3 (KF8) e-book parser.
 *
 * Plain browser JS (also loadable from node via require), no dependencies,
 * no DOM access. Written from the public format descriptions (MobileRead wiki:
 * PDB, MOBI, EXTH, KF8, INDX/TAGX, HUFF/CDIC).
 *
 * Supported
 *   - PalmDB container ("BOOKMOBI", and plain PalmDOC "TEXtREAd").
 *   - PalmDOC header: compression 1 (none), 2 (PalmDOC LZ77),
 *     17480 (HUFF/CDIC, Huffman + dictionary, incl. recursive dictionary entries).
 *   - Trailing record entries (extra data flags: multibyte overlap + TBS etc.).
 *   - MOBI header (cp1252 / UTF-8, full name, first resource record, locale),
 *     EXTH (100 author, 101 publisher, 503 title, 524 language, 201/202 cover
 *     and thumbnail, 121 KF8 boundary, 125 resource count, ...).
 *   - MOBI 6 ("old Mobipocket") HTML: filepos links -> anchors
 *     (<a id="fpN"></a> + href="partNNNN.html#fpN"), <img recindex> -> images/…,
 *     <mbp:*> tags dropped, split into spine parts at <mbp:pagebreak/> (and at
 *     block boundaries for very large chunks), TOC from the NCX index or,
 *     failing that, from the guide <reference type="toc">.
 *   - KF8 (AZW3 and the KF8 half of combined MOBI6+KF8 files, preferred when
 *     present): FDST flows, SKEL + FRAG indexes (INDX/TAGX/IDXT/CNCX),
 *     skeleton/fragment reconstruction into parts, kindle:pos / kindle:embed /
 *     kindle:flow link rewriting, CSS flows as styles/flowNNNN.css (SVG flows as
 *     images/flowNNNN.svg), NCX index -> nested TOC.
 *   - Images: JPEG / PNG / GIF / BMP resource records (others are ignored),
 *     cover from EXTH 201 (fallback 202).
 *   - Errors are Error objects with .code: 'drm' (encrypted), 'kfx' (KFX /
 *     Ion containers), 'notmobi', 'broken'.
 *
 * Not supported (honestly): DRM removal (by design), embedded fonts (FONT
 * records; their url() references are blanked), audio/video, KF8 page maps,
 * MOBI "indexes" for dictionaries (orth/infl), Topaz (TPZ) files.
 *
 * API
 *   MobiBook.parse(ArrayBuffer | Uint8Array) -> Promise<{
 *     title, author, lang, publisher, kf8, spine: [{href, html}],
 *     resources: { path: {type, data: Uint8Array} }, toc: [{title, href, children}],
 *     cover: path | null }>
 *   MobiBook.sniff(Uint8Array) -> 'mobi' | 'kfx' | null
 *
 * HTML in the spine is NOT sanitized; image src / link href values are the
 * relative paths images/…, styles/…, partNNNN.html#id.
 */
(function (root) {
  'use strict';

  var NONE = 0xFFFFFFFF;

  function fail(code, msg) {
    var e = new Error(msg || code);
    e.code = code;
    return e;
  }

  // ---------------------------------------------------------------- bytes ---

  function u16(b, o) {
    if (o < 0 || o + 2 > b.length) throw fail('broken', 'read past end of record');
    return (b[o] << 8) | b[o + 1];
  }
  function u32(b, o) {
    if (o < 0 || o + 4 > b.length) throw fail('broken', 'read past end of record');
    return b[o] * 0x1000000 + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]);
  }
  function ascii(b, s, e) {
    var out = '';
    for (var i = s; i < e && i < b.length; i++) out += String.fromCharCode(b[i]);
    return out;
  }
  // "binary string": one char per byte, so byte offsets == string offsets.
  function bin(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return s;
  }
  function unbin(s) {
    var out = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xFF;
    return out;
  }
  // forward-encoded variable width integer (high bit marks the last byte)
  function varint(b, p) {
    var v = 0, c;
    do {
      if (p >= b.length) throw fail('broken', 'varint past end');
      c = b[p++];
      v = v * 128 + (c & 0x7F);
    } while (!(c & 0x80));
    return [v, p];
  }

  // growable output buffer
  function Buf(n) { this.a = new Uint8Array(Math.max(n, 1024)); this.n = 0; }
  Buf.prototype.ensure = function (k) {
    if (this.n + k > this.a.length) {
      var b = new Uint8Array(Math.max(this.a.length * 2, this.n + k));
      b.set(this.a.subarray(0, this.n));
      this.a = b;
    }
  };
  Buf.prototype.push = function (bytes) {
    this.ensure(bytes.length);
    this.a.set(bytes, this.n);
    this.n += bytes.length;
  };

  // ------------------------------------------------------------- decoding ---

  var CP1252 = [0x20AC, 0xFFFD, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021,
    0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0xFFFD, 0x017D, 0xFFFD, 0xFFFD, 0x2018,
    0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014, 0x02DC, 0x2122, 0x0161, 0x203A,
    0x0153, 0xFFFD, 0x017E, 0x0178];

  function makeDecoder(enc) {
    if (enc === 65001) {
      var u = new TextDecoder('utf-8');
      return function (b) { return u.decode(b); };
    }
    try {
      var w = new TextDecoder('windows-1252');
      return function (b) { return w.decode(b); };
    } catch (e) { /* fall through to the table */ }
    return function (b) {
      var parts = [], chunk = [];
      for (var i = 0; i < b.length; i++) {
        var c = b[i];
        chunk.push(c >= 0x80 && c < 0xA0 ? CP1252[c - 0x80] : c);
        if (chunk.length === 0x4000) { parts.push(String.fromCharCode.apply(null, chunk)); chunk = []; }
      }
      parts.push(String.fromCharCode.apply(null, chunk));
      return parts.join('');
    };
  }

  // ---------------------------------------------------------------- PalmDB ---

  function readPdb(bytes) {
    if (bytes.length < 78) throw fail('notmobi', 'file too small');
    var n = u16(bytes, 76);
    if (78 + n * 8 > bytes.length) throw fail('broken', 'record list past end of file');
    var offs = new Array(n + 1);
    for (var i = 0; i < n; i++) offs[i] = u32(bytes, 78 + i * 8);
    offs[n] = bytes.length;
    for (i = 0; i < n; i++) {
      if (offs[i] > bytes.length) offs[i] = bytes.length;
    }
    var name = ascii(bytes, 0, 32);
    var z = name.indexOf('\0');
    if (z >= 0) name = name.slice(0, z);
    return {
      bytes: bytes,
      type: ascii(bytes, 60, 68),
      name: name,
      count: n,
      rec: function (i) {
        if (!(i >= 0 && i < n)) throw fail('broken', 'record ' + i + ' does not exist');
        var s = offs[i], e = offs[i + 1];
        if (e < s) e = s;
        return bytes.subarray(s, e);
      },
      has: function (i) { return i >= 0 && i < n; }
    };
  }

  function readHeader(r) {
    if (r.length < 16) throw fail('broken', 'record 0 too small');
    var h = {
      compression: u16(r, 0),
      textLength: u32(r, 4),
      textRecords: u16(r, 8),
      recordSize: u16(r, 10),
      encryption: u16(r, 12),
      isMobi: r.length >= 24 && ascii(r, 16, 20) === 'MOBI',
      encoding: 1252, version: 1, extraFlags: 0, exth: {},
      firstImage: NONE, huffRec: NONE, huffCount: 0, ncx: NONE,
      fdst: NONE, frag: NONE, skel: NONE, locale: 0, fullName: ''
    };
    if (!h.isMobi) return h;
    var hlen = u32(r, 20);
    var lim = Math.min(r.length, 16 + hlen);
    var f32 = function (o) { return o + 4 <= lim ? u32(r, o) : NONE; };
    var f16 = function (o) { return o + 2 <= lim ? u16(r, o) : 0; };
    h.headerLength = hlen;
    h.encoding = f32(28) === 65001 ? 65001 : 1252;
    h.version = f32(36);
    if (h.version === NONE) h.version = 1;
    h.locale = f32(92);
    h.firstImage = f32(108);
    h.huffRec = f32(112);
    h.huffCount = f32(116);
    var exthFlags = f32(128);
    if (hlen >= 0xE4 && h.version >= 5) h.extraFlags = f16(0xF2);
    h.ncx = f32(0xF4);
    if (h.version >= 8) {
      h.fdst = f32(0xC0);
      h.frag = f32(0xF8);
      h.skel = f32(0xFC);
    }
    var dec = makeDecoder(h.encoding);
    var fnOff = f32(84), fnLen = f32(88);
    if (fnOff !== NONE && fnLen !== NONE && fnOff + fnLen <= r.length && fnLen < 4096) {
      h.fullName = dec(r.subarray(fnOff, fnOff + fnLen));
    }
    if (exthFlags !== NONE && (exthFlags & 0x40)) {
      var p = 16 + hlen;
      if (p + 12 <= r.length && ascii(r, p, p + 4) === 'EXTH') {
        var cnt = u32(r, p + 8);
        p += 12;
        for (var i = 0; i < cnt && p + 8 <= r.length; i++) {
          var t = u32(r, p), l = u32(r, p + 4);
          if (l < 8 || p + l > r.length) break;
          (h.exth[t] = h.exth[t] || []).push(r.subarray(p + 8, p + l));
          p += l;
        }
      }
    }
    h.exthStr = function (t) {
      return (h.exth[t] || []).map(function (b) { return dec(b).replace(/\0+$/, '').trim(); })
        .filter(Boolean);
    };
    h.exthNum = function (t) {
      var b = (h.exth[t] || [])[0];
      if (!b || !b.length || b.length > 4) return null;
      var v = 0;
      for (var i = 0; i < b.length; i++) v = v * 256 + b[i];
      return v;
    };
    return h;
  }

  // --------------------------------------------------------- decompression ---

  // size of the record without its trailing entries
  function trailingEnd(rec, flags) {
    var end = rec.length;
    for (var f = flags >> 1; f; f >>= 1) {
      if (f & 1) {
        var num = 0;
        for (var i = Math.max(0, end - 4); i < end; i++) {
          var v = rec[i];
          if (v & 0x80) num = 0;
          num = (num << 7) | (v & 0x7F);
        }
        if (num > end) return 0;
        end -= num;
      }
    }
    if (flags & 1 && end > 0) {
      end -= (rec[end - 1] & 3) + 1;
      if (end < 0) end = 0;
    }
    return end;
  }

  // PalmDOC LZ77
  function lz77(src, out) {
    out.ensure(src.length * 8 + 16);
    var a = out.a, n = out.n, i = 0, len = src.length;
    while (i < len) {
      var c = src[i++];
      if (c >= 1 && c <= 8) {
        for (var k = 0; k < c && i < len; k++) a[n++] = src[i++];
      } else if (c < 0x80) {
        a[n++] = c;
      } else if (c >= 0xC0) {
        a[n++] = 0x20;
        a[n++] = c ^ 0x80;
      } else {
        if (i >= len) break;
        c = (c << 8) | src[i++];
        var dist = (c >> 3) & 0x7FF, cnt = (c & 7) + 3;
        var from = n - dist;
        if (dist === 0 || from < 0) break; // corrupt back-reference

        for (k = 0; k < cnt; k++) a[n++] = a[from + k];
      }
    }
    out.n = n;
  }

  var POW2 = [];
  for (var pi = 0; pi <= 32; pi++) POW2.push(Math.pow(2, pi));

  // HUFF/CDIC: records[0] is the HUFF record, the rest are CDIC records.
  function makeHuff(records, recordSize) {
    var huff = records[0];
    if (ascii(huff, 0, 4) !== 'HUFF') throw fail('broken', 'missing HUFF record');
    var off1 = u32(huff, 8), off2 = u32(huff, 12);
    var len1 = new Uint8Array(256), term1 = new Uint8Array(256), max1 = new Float64Array(256);
    for (var i = 0; i < 256; i++) {
      var v = u32(huff, off1 + i * 4);
      var cl = v & 0x1F;
      if (!cl) throw fail('broken', 'bad HUFF table');
      len1[i] = cl;
      term1[i] = v & 0x80 ? 1 : 0;
      max1[i] = (Math.floor(v / 256) + 1) * POW2[32 - cl] - 1;
    }
    var minc = new Float64Array(33), maxc = new Float64Array(33);
    for (i = 1; i <= 32; i++) {
      minc[i] = u32(huff, off2 + (i - 1) * 8) * POW2[32 - i];
      maxc[i] = (u32(huff, off2 + (i - 1) * 8 + 4) + 1) * POW2[32 - i] - 1;
    }
    var dict = [];
    for (var r = 1; r < records.length; r++) {
      var c = records[r];
      if (ascii(c, 0, 4) !== 'CDIC') throw fail('broken', 'missing CDIC record');
      var hl = u32(c, 4), total = u32(c, 8), bits = u32(c, 12);
      var cnt = Math.min(Math.pow(2, bits), total - dict.length);
      for (var j = 0; j < cnt; j++) {
        var o = hl + u16(c, hl + j * 2);
        var bl = u16(c, o);
        var l = bl & 0x7FFF;
        if (o + 2 + l > c.length) throw fail('broken', 'CDIC entry past end');
        dict.push({ data: c.subarray(o + 2, o + 2 + l), done: !!(bl & 0x8000), busy: false });
      }
    }

    function unpack(data, out, depth) {
      if (depth > 64) throw fail('broken', 'HUFF recursion too deep');
      var len = data.length, bitsLeft = len * 8, pos = 0;
      while (true) {
        var bi = pos >> 3, s = pos & 7;
        var b0 = bi < len ? data[bi] : 0, b1 = bi + 1 < len ? data[bi + 1] : 0,
          b2 = bi + 2 < len ? data[bi + 2] : 0, b3 = bi + 3 < len ? data[bi + 3] : 0,
          b4 = bi + 4 < len ? data[bi + 4] : 0;
        var code = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
        if (s) code = ((code << s) | (b4 >>> (8 - s))) >>> 0;
        var top = code >>> 24, clen = len1[top], mx;
        if (term1[top]) {
          mx = max1[top];
        } else {
          while (clen < 32 && code < minc[clen]) clen++;
          mx = maxc[clen];
        }
        bitsLeft -= clen;
        if (bitsLeft < 0) break;
        pos += clen;
        var idx = Math.floor((mx - code) / POW2[32 - clen]);
        var e = dict[idx];
        if (!e) throw fail('broken', 'HUFF code out of dictionary');
        if (!e.done) {
          if (e.busy) throw fail('broken', 'HUFF dictionary loop');
          e.busy = true;
          var sub = new Buf(e.data.length * 4 + 16);
          unpack(e.data, sub, depth + 1);
          e.data = sub.a.slice(0, sub.n);
          e.done = true;
          e.busy = false;
        }
        out.push(e.data);
      }
    }
    return function (src, out) { unpack(src, out, 0); };
  }

  // Concatenated, decompressed text of a book section starting at record `start`.
  function extractText(pdb, start, h) {
    var comp = h.compression;
    var huff = null;
    if (comp === 17480) {
      var hr = h.huffRec;
      if (hr === NONE || !h.huffCount) throw fail('broken', 'HUFF records missing');
      var first = pdb.has(start + hr) && ascii(pdb.rec(start + hr), 0, 4) === 'HUFF' ? start + hr : hr;
      var recs = [];
      for (var i = 0; i < h.huffCount; i++) recs.push(pdb.rec(first + i));
      huff = makeHuff(recs);
    } else if (comp !== 1 && comp !== 2) {
      throw fail('broken', 'unknown compression ' + comp);
    }
    var out = new Buf(h.textLength + 8192);
    for (i = 1; i <= h.textRecords; i++) {
      if (!pdb.has(start + i)) break;
      var rec = pdb.rec(start + i);
      var data = rec.subarray(0, trailingEnd(rec, h.extraFlags));
      if (comp === 1) out.push(data);
      else if (comp === 2) lz77(data, out);
      else huff(data, out);
    }
    return out.a.subarray(0, Math.min(out.n, h.textLength || out.n));
  }

  // ----------------------------------------------------------------- INDX ---

  function popcount(x) { var c = 0; while (x) { c += x & 1; x >>= 1; } return c; }

  function readIndex(pdb, idx, decode) {
    var main = pdb.rec(idx);
    if (ascii(main, 0, 4) !== 'INDX') throw fail('broken', 'INDX expected at record ' + idx);
    var hlen = u32(main, 4), nRecs = u32(main, 24), nCncx = u32(main, 52);
    var tagx = [], cbCount = 1;
    if (ascii(main, hlen, hlen + 4) === 'TAGX') {
      var tl = u32(main, hlen + 4);
      cbCount = u32(main, hlen + 8);
      for (var p = hlen + 12; p + 4 <= hlen + tl && p + 4 <= main.length; p += 4) {
        tagx.push([main[p], main[p + 1], main[p + 2], main[p + 3]]);
      }
    }
    if (nRecs > 10000 || nCncx > 10000) throw fail('broken', 'bad INDX header');
    var cncx = [];
    for (var j = 0; j < nCncx; j++) {
      if (pdb.has(idx + nRecs + 1 + j)) cncx.push(pdb.rec(idx + nRecs + 1 + j));
    }
    var entries = [];
    for (var r = 1; r <= nRecs; r++) {
      var rec = pdb.rec(idx + r);
      if (ascii(rec, 0, 4) !== 'INDX') throw fail('broken', 'INDX data record expected');
      var it = u32(rec, 20), cnt = u32(rec, 24);
      if (ascii(rec, it, it + 4) !== 'IDXT') throw fail('broken', 'IDXT missing');
      var offs = [];
      for (j = 0; j < cnt; j++) offs.push(u16(rec, it + 4 + j * 2));
      offs.push(it);
      for (j = 0; j < cnt; j++) {
        var s = offs[j];
        var kl = rec[s];
        var key = ascii(rec, s + 1, s + 1 + kl);
        p = s + 1 + kl;
        var cbs = rec.subarray(p, p + cbCount);
        p += cbCount;
        var pending = [], cbi = 0;
        for (var t = 0; t < tagx.length; t++) {
          var tg = tagx[t];
          if (tg[3] & 1) { cbi++; continue; }
          var mask = tg[2], v = cbs[cbi] & mask;
          if (!v) continue;
          if (v === mask && popcount(mask) > 1) {
            var vr = varint(rec, p);
            p = vr[1];
            pending.push([tg[0], tg[1], -1, vr[0]]);
          } else {
            var m = mask;
            while (!(m & 1)) { m >>= 1; v >>= 1; }
            pending.push([tg[0], tg[1], v, 0]);
          }
        }
        var tags = {};
        for (t = 0; t < pending.length; t++) {
          var pd = pending[t], vals = [];
          if (pd[2] >= 0) {
            for (var k = 0; k < pd[2] * pd[1]; k++) { vr = varint(rec, p); vals.push(vr[0]); p = vr[1]; }
          } else {
            var stop = p + pd[3];
            while (p < stop) { vr = varint(rec, p); vals.push(vr[0]); p = vr[1]; }
          }
          tags[pd[0]] = vals;
        }
        entries.push({ key: key, tags: tags });
      }
    }
    return {
      entries: entries,
      cncx: function (off) {
        var c = cncx[Math.floor(off / 65536)];
        if (!c) return '';
        var q = off & 0xFFFF;
        if (q >= c.length) return '';
        var vr = varint(c, q);
        return decode(c.subarray(vr[1], vr[1] + vr[0]));
      }
    };
  }

  // --------------------------------------------------------------- shared ---

  var IMG_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/bmp': 'bmp' };
  var RES_MAGIC = /^(FLIS|FCIS|SRCS|RESC|FONT|DATP|CRES|CMET|PAGE|FDST|INDX|BOUN|kind|AUDI|VIDE|CONT|\xE9\x8E\r\n)/;

  function imageType(b) {
    if (b.length < 8) return null;
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png';
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
    if (b[0] === 0x42 && b[1] === 0x4D && b.length >= 26) {
      var sz = b[2] | (b[3] << 8) | (b[4] << 16) | (b[5] << 24);
      if (sz > 0 && sz <= b.length + 16) return 'image/bmp';
    }
    return null;
  }

  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  function partName(i) { return 'part' + pad(i, 4) + '.html'; }
  function imageName(i, type) { return 'images/' + pad(i, 5) + '.' + IMG_EXT[type]; }

  // Collect image resources. Returns { byIndex: {n: path}, resources: {} }.
  function collectImages(pdb, first, stopAt) {
    var res = { byIndex: {}, resources: {} };
    if (first === NONE || first < 1 || first >= pdb.count) return res;
    var end = Math.min(pdb.count, stopAt || pdb.count);
    for (var r = first; r < end; r++) {
      var b = pdb.rec(r);
      var type = imageType(b);
      if (!type) continue;
      var n = r - first + 1, path = imageName(n, type);
      res.byIndex[n] = path;
      res.resources[path] = { type: type, data: b.slice() };
    }
    return res;
  }

  function looksResource(b) {
    return !!imageType(b) || RES_MAGIC.test(ascii(b, 0, 4));
  }

  var ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—',
    ndash: '–', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };
  function decodeEntities(s) {
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (m, e) {
      if (e[0] === '#') {
        var c = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        try { return String.fromCodePoint(c); } catch (x) { return m; }
      }
      return ENT[e.toLowerCase()] || m;
    });
  }
  function plainText(html) {
    return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  }
  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isStartTag(h, i) {
    var c = h.charCodeAt(i + 1);
    return h.charCodeAt(i) === 60 && ((c >= 65 && c <= 90) || (c >= 97 && c <= 122));
  }

  /*
   * Give every target offset in html `h` an anchor. Offsets pointing at (or just
   * before) a start tag put an id on that element (or reuse its id); offsets in
   * text get an empty <a id> inserted. Offsets before <body> map to the file
   * itself. Returns { html, frag: Map(offset -> '' | '#id') }.
   */
  function anchorOffsets(h, offsets, mkId) {
    var bm = /<body\b[^>]*>/i.exec(h);
    var bodyEnd = bm ? bm.index + bm[0].length : 0;
    var edits = new Map(), frag = new Map();
    offsets.forEach(function (off) {
      if (off < bodyEnd || off > h.length) { frag.set(off, ''); return; }
      var p = off, tagStart = -1;
      var lt = h.lastIndexOf('<', p), gt = p > 0 ? h.lastIndexOf('>', p - 1) : -1;
      if (lt >= 0 && lt > gt) {
        if (isStartTag(h, lt)) tagStart = lt;
        else p = lt;
      } else {
        var q = p;
        while (q < h.length && h.charCodeAt(q) <= 32) q++;
        if (isStartTag(h, q)) tagStart = q;
      }
      if (tagStart >= 0) {
        var end = h.indexOf('>', tagStart);
        if (end < 0) end = h.length;
        var tag = h.slice(tagStart, end + 1);
        var m = /\sid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>\/]+))/i.exec(tag);
        if (m) { frag.set(off, '#' + (m[1] != null ? m[1] : m[2] != null ? m[2] : m[3])); return; }
        var nameEnd = tagStart + 1 + /^[^\s\/>]*/.exec(tag.slice(1))[0].length;
        var e = edits.get(nameEnd);
        if (!e) { e = { id: mkId(off) }; e.text = ' id="' + e.id + '"'; edits.set(nameEnd, e); }
        frag.set(off, '#' + e.id);
      } else {
        var a = edits.get(p);
        if (!a) { a = { id: mkId(off) }; a.text = '<a id="' + a.id + '"></a>'; edits.set(p, a); }
        frag.set(off, '#' + a.id);
      }
    });
    if (edits.size) {
      var keys = Array.from(edits.keys()).sort(function (x, y) { return x - y; });
      var out = [], last = 0;
      keys.forEach(function (k) { out.push(h.slice(last, k), edits.get(k).text); last = k; });
      out.push(h.slice(last));
      h = out.join('');
    }
    return { html: h, frag: frag };
  }

  // Fallback TOC from <h1>-<h3> headings of decoded parts (adds ids when missing).
  function headingToc(spine) {
    var toc = [], n = 0;
    spine.forEach(function (part) {
      part.html = part.html.replace(/<h([1-3])\b([^>]*)>([\s\S]*?)<\/h\1\s*>/gi, function (m, lvl, attrs, inner) {
        var title = plainText(inner);
        if (!title || toc.length > 2000) return m;
        var idm = /\sid\s*=\s*["']([^"']+)["']/i.exec(attrs);
        var id = idm ? idm[1] : 'mobitoc' + (++n);
        toc.push({ title: title.slice(0, 200), href: part.href + '#' + id, children: [] });
        return idm ? m : '<h' + lvl + ' id="' + id + '"' + attrs + '>' + inner + '</h' + lvl + '>';
      });
    });
    return toc;
  }

  // Build a nested TOC from NCX index entries. `hrefOf(entry)` -> href | null.
  function ncxTree(ix, hrefOf) {
    var nodes = ix.entries.map(function (e) {
      var t = e.tags;
      return {
        title: (t[3] ? ix.cncx(t[3][0]) : '').replace(/\s+/g, ' ').trim(),
        href: hrefOf(t),
        depth: t[4] ? t[4][0] : 0,
        parent: t[21] ? t[21][0] : -1,
        children: []
      };
    });
    var top = [], stack = [];
    var hasParents = nodes.some(function (n) { return n.parent >= 0; });
    nodes.forEach(function (n, i) {
      if (hasParents) {
        if (n.parent >= 0 && n.parent < i) nodes[n.parent].children.push(n);
        else top.push(n);
      } else {
        while (stack.length && stack[stack.length - 1].depth >= n.depth) stack.pop();
        (stack.length ? stack[stack.length - 1].children : top).push(n);
        stack.push(n);
      }
    });
    function clean(list) {
      var out = [];
      list.forEach(function (n) {
        var kids = clean(n.children);
        if (!n.href) { out.push.apply(out, kids); return; }
        out.push({ title: n.title || n.href, href: n.href, children: kids });
      });
      return out;
    }
    return clean(top);
  }

  // ------------------------------------------------------------------ KF8 ---

  function buildKF8(pdb, start, h, decode, images) {
    var raw = extractText(pdb, start, h);
    var flows = [[0, raw.length]];
    if (h.fdst !== NONE && pdb.has(start + h.fdst)) {
      var fd = pdb.rec(start + h.fdst);
      if (ascii(fd, 0, 4) === 'FDST') {
        var fo = u32(fd, 4), fc = u32(fd, 8), list = [];
        for (var i = 0; i < fc; i++) {
          var a = Math.min(u32(fd, fo + i * 8), raw.length), b = Math.min(u32(fd, fo + i * 8 + 4), raw.length);
          list.push([a, Math.max(a, b)]);
        }
        if (list.length) flows = list;
      }
    }
    var text = bin(raw.subarray(flows[0][0], flows[0][1]));

    // --- skeleton + fragment reconstruction
    var files = [], frags = [];
    if (h.skel !== NONE && h.frag !== NONE && pdb.has(start + h.skel) && pdb.has(start + h.frag)) {
      var skel = readIndex(pdb, start + h.skel, decode);
      var fragIx = readIndex(pdb, start + h.frag, decode);
      frags = fragIx.entries.map(function (e) {
        var t6 = e.tags[6] || [0, 0];
        return { insert: parseInt(e.key, 10), length: t6[1] || 0 };
      });
      var fi = 0;
      skel.entries.forEach(function (e) {
        var count = e.tags[1] ? e.tags[1][0] : 0;
        var t6 = e.tags[6] || [0, 0];
        var spos = t6[0], slen = t6[1];
        var html = text.slice(spos, spos + slen), base = spos + slen;
        for (var k = 0; k < count && fi < frags.length; k++, fi++) {
          var f = frags[fi];
          var data = text.slice(base, base + f.length);
          base += f.length;
          var ip = f.insert - spos;
          if (!(ip >= 0)) ip = 0;
          if (ip > html.length) ip = html.length;
          html = html.slice(0, ip) + data + html.slice(ip);
        }
        files.push({ start: spos, end: base, html: html });
      });
    }
    if (!files.length) files.push({ start: 0, end: text.length, html: text });

    function fileOf(abs) {
      var lo = 0, hi = files.length - 1;
      while (lo <= hi) {
        var mid = (lo + hi) >> 1;
        if (abs < files[mid].start) hi = mid - 1;
        else if (abs >= files[mid].end) lo = mid + 1;
        else return mid;
      }
      return -1;
    }
    function absOf(fid, off) {
      var f = frags[fid];
      return f ? f.insert + off : (fid === 0 && !frags.length ? off : -1);
    }

    // --- collect link targets (kindle:pos in the text + NCX)
    var targets = files.map(function () { return new Set(); });
    function addTarget(abs) {
      var i = fileOf(abs);
      if (i >= 0) targets[i].add(abs - files[i].start);
    }
    var POS_RE = /kindle:pos:fid:([0-9a-vA-V]+):off:([0-9a-vA-V]+)/g;
    files.forEach(function (f) {
      f.html.replace(POS_RE, function (m, fid, off) {
        addTarget(absOf(parseInt(fid, 32), parseInt(off, 32)));
        return m;
      });
    });
    var ncx = null;
    if (h.ncx !== NONE && pdb.has(start + h.ncx)) {
      try { ncx = readIndex(pdb, start + h.ncx, decode); } catch (e) { ncx = null; }
    }
    function ncxAbs(t) {
      if (t[6] && t[6].length >= 2) return absOf(t[6][0], t[6][1]);
      if (t[1]) return t[1][0];
      return -1;
    }
    if (ncx) ncx.entries.forEach(function (e) { addTarget(ncxAbs(e.tags)); });

    // --- anchor ids
    var fragMaps = files.map(function (f, i) {
      if (!targets[i].size) return new Map();
      var r = anchorOffsets(f.html, targets[i], function (off) { return 'kfpos' + (f.start + off); });
      f.html = r.html;
      return r.frag;
    });
    function hrefOfAbs(abs) {
      var i = fileOf(abs);
      if (i < 0) return null;
      var fr = fragMaps[i].get(abs - files[i].start);
      return partName(i) + (fr || '');
    }

    // --- flows -> resources
    var flowRes = {};
    var resources = images.resources;
    for (i = 1; i < flows.length; i++) {
      var fb = raw.subarray(flows[i][0], flows[i][1]);
      var fs = decode(fb);
      var isSvg = /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg\b/i.test(fs);
      var path = isSvg ? 'images/flow' + pad(i, 4) + '.svg' : 'styles/flow' + pad(i, 4) + '.css';
      flowRes[i] = { path: path, text: fs, svg: isSvg };
    }
    function embedPath(n, prefix) {
      var p = images.byIndex[n];
      return p ? prefix + p : '';
    }
    Object.keys(flowRes).forEach(function (k) {
      var fr = flowRes[k], prefix = '../'; // flows live in styles/ or images/
      var s = fr.text
        .replace(/kindle:embed:([0-9a-vA-V]+)(\?mime=[^"')\s;]*)?/g, function (m, n) { return embedPath(parseInt(n, 32), prefix); })
        .replace(/kindle:flow:([0-9a-vA-V]+)(\?mime=[^"')\s;]*)?/g, function (m, n) {
          var f = flowRes[parseInt(n, 32)];
          return f ? prefix + f.path : '';
        })
        .replace(/kindle:[^"')\s;]*/g, '');
      resources[fr.path] = { type: fr.svg ? 'image/svg+xml' : 'text/css', data: new TextEncoder().encode(s) };
    });

    // SVG flows used as <img> are inlined: an SVG loaded through <img> cannot
    // load the raster images it references.
    var IMG_FLOW_RE = /<img\b[^>]*?\bsrc\s*=\s*["']kindle:flow:([0-9a-vA-V]+)\?mime=image\/svg\+xml["'][^>]*>/gi;
    function inlineSvg(m, n) {
      var k = parseInt(n, 32), fr = flowRes[k];
      if (!fr || !fr.svg) return m;
      return bin(raw.subarray(flows[k][0], flows[k][1]))
        .replace(/^\s*<\?xml[^>]*>\s*/, '')
        .replace(/<!DOCTYPE[^>]*>\s*/i, '');
    }

    // --- rewrite links + decode
    var spine = files.map(function (f, i) {
      var html = f.html
        .replace(IMG_FLOW_RE, inlineSvg)
        .replace(POS_RE, function (m, fid, off) {
          return hrefOfAbs(absOf(parseInt(fid, 32), parseInt(off, 32))) || '';
        })
        .replace(/kindle:embed:([0-9a-vA-V]+)(\?mime=[^"')\s]*)?/g, function (m, n) { return embedPath(parseInt(n, 32), ''); })
        .replace(/kindle:flow:([0-9a-vA-V]+)(\?mime=[^"')\s]*)?/g, function (m, n) {
          var fr = flowRes[parseInt(n, 32)];
          return fr ? fr.path : '';
        })
        .replace(/kindle:[^"')\s>]*/g, '');
      return { href: partName(i), html: decode(unbin(html)) };
    });

    var toc = ncx ? ncxTree(ncx, function (t) { var a = ncxAbs(t); return a >= 0 ? hrefOfAbs(a) : null; }) : [];
    return { spine: spine, toc: toc };
  }

  // ---------------------------------------------------------------- MOBI6 ---

  var VOID = /^(br|img|hr|meta|link|input|col|area|base|wbr|param|source|embed|track|basefont|frame)$/i;
  var CLOSES_P = /^(p|div|h[1-6]|table|ul|ol|dl|blockquote|pre|hr|center|address|li|dt|dd)$/i;
  var BLOCK_END = /^(p|div|h[1-6]|table|ul|ol|dl|blockquote|pre|center)$/i;
  var SPLIT_SIZE = 256 * 1024;

  /*
   * Split body HTML (binary string) into parts at <mbp:pagebreak> (and at block
   * ends once a part grows past SPLIT_SIZE). Open elements are closed at the end
   * of a part and re-opened (without ids) at the start of the next one.
   */
  function splitBody(body) {
    var parts = [], stack = [], cur = [], curLen = 0;
    var re = /<!--[\s\S]*?-->|<(\/?)([A-Za-z][\w:.-]*)\b[^>]*>/g, last = 0, m;
    function hasContent(s) { return /<img\b/i.test(s) || /\S/.test(s.replace(/<[^>]*>/g, '')); }
    function cut() {
      var s = cur.join('');
      if (!hasContent(s)) return;
      // anchors sitting at the very end belong to the next part
      var tail = /(?:\s*<a id="fp\d+"><\/a>)+\s*$/.exec(s), carry = '';
      if (tail) { carry = tail[0]; s = s.slice(0, tail.index); }
      for (var i = stack.length - 1; i >= 0; i--) s += '</' + stack[i].name + '>';
      parts.push(s);
      cur = stack.map(function (t) { return t.open.replace(/\sid\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, ''); });
      cur.push(carry);
      curLen = 0;
    }
    while ((m = re.exec(body))) {
      var chunk = body.slice(last, m.index);
      cur.push(chunk);
      curLen += chunk.length;
      last = re.lastIndex;
      var tag = m[0];
      if (!m[2]) { cur.push(tag); continue; } // comment
      var name = m[2].toLowerCase();
      if (name.slice(0, 4) === 'mbp:') {
        if (name === 'mbp:pagebreak' && !m[1]) cut();
        continue; // drop all <mbp:*> tags
      }
      cur.push(tag);
      curLen += tag.length;
      if (m[1]) {
        for (var i = stack.length - 1; i >= 0; i--) {
          if (stack[i].name === name) { stack.length = i; break; }
        }
        if (curLen > SPLIT_SIZE && BLOCK_END.test(name) && stack.length <= 2) cut();
      } else if (!VOID.test(name) && !/\/\s*>$/.test(tag)) {
        if (CLOSES_P.test(name) && stack.length && stack[stack.length - 1].name === 'p') stack.pop();
        if (name === 'li' && stack.length && stack[stack.length - 1].name === 'li') stack.pop();
        if (stack.length < 64) stack.push({ name: name, open: tag });
      }
    }
    cur.push(body.slice(last));
    var rest = cur.join('');
    if (hasContent(rest) || !parts.length) {
      for (var j = stack.length - 1; j >= 0; j--) rest += '</' + stack[j].name + '>';
      parts.push(rest);
    } else if (parts.length) {
      parts[parts.length - 1] += rest.replace(/<[^>]*>/g, '');
    }
    return parts;
  }

  function buildMobi6(pdb, h, decode, images) {
    var raw = extractText(pdb, 0, h);
    var s = bin(raw);

    // NCX (filepos-based) if present
    var ncx = null;
    if (h.ncx !== NONE && h.ncx > 0 && pdb.has(h.ncx)) {
      try { ncx = readIndex(pdb, h.ncx, decode); } catch (e) { ncx = null; }
      if (ncx && !ncx.entries.length) ncx = null;
    }

    // all filepos targets
    var targets = new Set();
    s.replace(/\bfilepos\s*=\s*["']?0*(\d+)/gi, function (m, n) { targets.add(+n); return m; });
    if (ncx) ncx.entries.forEach(function (e) { if (e.tags[1]) targets.add(e.tags[1][0]); });

    var bm = /<body\b[^>]*>/i.exec(s);
    var bodyStart = bm ? bm.index + bm[0].length : 0;
    var be = s.search(/<\/body\s*>(?![\s\S]*<\/body\s*>)/i);
    var bodyEnd = be > bodyStart ? be : s.length;
    var head = bm ? s.slice(0, bm.index) : '';

    // insert <a id="fpN"></a> anchors (moved out of tags, clamped into the body)
    var ins = [];
    targets.forEach(function (fp) {
      var q = Math.min(Math.max(fp, bodyStart), bodyEnd);
      var lt = s.lastIndexOf('<', q - 1), gt = s.lastIndexOf('>', q - 1);
      if (lt > gt && lt >= bodyStart) q = lt;
      ins.push([q, fp]);
    });
    ins.sort(function (x, y) { return x[0] - y[0] || x[1] - y[1]; });
    var pieces = [], last = bodyStart;
    ins.forEach(function (it) {
      pieces.push(s.slice(last, it[0]), '<a id="fp' + it[1] + '"></a>');
      last = it[0];
    });
    pieces.push(s.slice(last, bodyEnd));
    var body = pieces.join('');

    var parts = splitBody(body);

    // which part holds which anchor
    var fpPart = new Map();
    parts.forEach(function (p, i) {
      p.replace(/<a id="fp(\d+)"><\/a>/g, function (m, n) { if (!fpPart.has(+n)) fpPart.set(+n, i); return m; });
    });
    function fpHref(fp) {
      var i = fpPart.get(fp);
      return i == null ? null : partName(i) + '#fp' + fp;
    }

    // TOC: NCX, else guide reference type="toc"
    var toc = [];
    if (ncx) {
      toc = ncxTree(ncx, function (t) { return t[1] ? fpHref(t[1][0]) : null; });
    } else {
      var gm = /<reference\b[^>]*\btype\s*=\s*["']?toc["']?[^>]*>/i.exec(head);
      var gfp = gm && /filepos\s*=\s*["']?0*(\d+)/i.exec(gm[0]);
      if (gfp && fpPart.has(+gfp[1])) {
        var pi = fpPart.get(+gfp[1]), ps = parts[pi];
        var from = ps.indexOf('<a id="fp' + gfp[1] + '"></a>');
        var are = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi, am;
        are.lastIndex = Math.max(0, from);
        while ((am = are.exec(ps))) {
          var lf = /filepos\s*=\s*["']?0*(\d+)/i.exec(am[1]);
          if (!lf) continue;
          var href = fpHref(+lf[1]);
          var title = plainText(decode(unbin(am[2])));
          if (href && title) toc.push({ title: title, href: href, children: [] });
        }
      }
    }

    // rewrite filepos, recindex, then decode
    var spine = parts.map(function (p, i) {
      p = p.replace(/<([A-Za-z][\w:.-]*)\b([^>]*)>/g, function (m, name, attrs) {
        var changed = false;
        if (/filepos/i.test(attrs)) {
          changed = true;
          attrs = attrs.replace(/\s*\bfilepos\s*=\s*["']?0*(\d+)["']?/gi, function (x, n) {
            var href = /^a$/i.test(name) ? fpHref(+n) : null;
            return href ? ' href="' + href + '"' : '';
          });
        }
        if (/recindex/i.test(attrs)) {
          changed = true;
          var src = null;
          attrs = attrs.replace(/\s*\b(hi|lo)?recindex\s*=\s*["']?0*(\d+)["']?/gi, function (x, kind, n) {
            if (!kind || !src) src = images.byIndex[+n] || src;
            return '';
          });
          if (/^img$/i.test(name)) {
            if (!src) return '';
            attrs = attrs.replace(/\s*\bsrc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, '');
            attrs = ' src="' + src + '"' + attrs;
          }
        }
        return changed ? '<' + name + attrs + '>' : m;
      });
      // MOBI 6 writers emit <br></br>, which HTML parsers read as two breaks
      p = p.replace(/<br\b([^>]*?)\s*\/?>\s*<\/br\s*>/gi, '<br$1/>');
      return { href: partName(i), html: decode(unbin(p)) };
    });
    return { spine: spine, toc: toc };
  }

  function buildPalmDoc(pdb, h) {
    var raw = extractText(pdb, 0, { compression: h.compression, textLength: h.textLength,
      textRecords: h.textRecords, extraFlags: 0 });
    var text = makeDecoder(1252)(raw).replace(/\r\n?/g, '\n');
    var paras = text.split(/\n\s*\n|\n(?=[ \t])/);
    var parts = [], cur = '';
    paras.forEach(function (p) {
      p = p.trim();
      if (!p) return;
      cur += '<p>' + escHtml(p).replace(/\n/g, '<br/>') + '</p>\n';
      if (cur.length > SPLIT_SIZE) { parts.push(cur); cur = ''; }
    });
    if (cur || !parts.length) parts.push(cur);
    return { spine: parts.map(function (p, i) { return { href: partName(i), html: p }; }), toc: [] };
  }

  // ------------------------------------------------------------- metadata ---

  var LCID = { 1: 'ar', 2: 'bg', 3: 'ca', 4: 'zh', 5: 'cs', 6: 'da', 7: 'de', 8: 'el', 9: 'en',
    10: 'es', 11: 'fi', 12: 'fr', 13: 'he', 14: 'hu', 15: 'is', 16: 'it', 17: 'ja', 18: 'ko',
    19: 'nl', 20: 'nb', 21: 'pl', 22: 'pt', 24: 'ro', 25: 'ru', 26: 'hr', 27: 'sk', 29: 'sv',
    31: 'tr', 34: 'uk', 35: 'be', 36: 'sl', 37: 'et', 38: 'lv', 39: 'lt', 41: 'fa', 42: 'vi',
    54: 'af', 57: 'hi', 62: 'ms' };

  function wrapDoc(html, title, lang) {
    return '<html xmlns="http://www.w3.org/1999/xhtml"' + (lang ? ' lang="' + escHtml(lang) + '"' : '') +
      '><head><meta charset="utf-8"/><title>' + escHtml(title || '') + '</title></head><body>' +
      html + '</body></html>';
  }

  // ---------------------------------------------------------------- sniff ---

  function toU8(input) {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (input && input.buffer instanceof ArrayBuffer) {
      return new Uint8Array(input.buffer, input.byteOffset || 0, input.byteLength);
    }
    throw fail('broken', 'expected ArrayBuffer or Uint8Array');
  }

  function sniff(u8) {
    var b = toU8(u8);
    if (b.length >= 68) {
      var t = ascii(b, 60, 68);
      if (t === 'BOOKMOBI' || t === 'TEXtREAd') return 'mobi';
    }
    var head = ascii(b, 0, 8);
    if (head.slice(0, 4) === 'CONT') return 'kfx';
    if (head === '\xEADRMION\xEE'.slice(0, 8)) return 'kfx';
    if (b[0] === 0xE0 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0xEA) return 'kfx';
    if (head.slice(0, 4) === 'PK\x03\x04') {
      var n = Math.min(b.length, 65536);
      var s = ascii(b, 0, n) + (b.length > n ? ascii(b, Math.max(n, b.length - 65536), b.length) : '');
      if (/\.kfx\b|\.kdf\b|book\.kdf|DRMION|CONT\x02\x00/i.test(s)) return 'kfx';
    }
    return null;
  }

  // ---------------------------------------------------------------- parse ---

  function parseSync(input) {
    var bytes = toU8(input);
    var kind = sniff(bytes);
    if (kind === 'kfx') throw fail('kfx', 'KFX books are not supported');
    if (kind !== 'mobi') throw fail('notmobi', 'not a MOBI/AZW3 file');
    var pdb = readPdb(bytes);

    if (pdb.type === 'TEXtREAd') {
      var ph = readHeader(pdb.rec(0));
      if (ph.compression !== 1 && ph.compression !== 2) throw fail('broken', 'unknown PalmDOC compression');
      var pr = buildPalmDoc(pdb, ph);
      return {
        title: pdb.name, author: '', lang: '', publisher: '', kf8: false,
        spine: pr.spine.map(function (p) { return { href: p.href, html: wrapDoc(p.html, pdb.name, '') }; }),
        resources: {}, toc: [], cover: null
      };
    }

    var h0 = readHeader(pdb.rec(0));
    if (h0.encryption) throw fail('drm', 'this book is DRM-protected');

    // locate KF8 part
    var kfStart = -1;
    if (h0.isMobi && h0.version >= 8) {
      kfStart = 0;
    } else if (h0.isMobi) {
      var bnd = h0.exthNum(121);
      if (bnd != null && bnd !== NONE) {
        if (pdb.has(bnd - 1) && ascii(pdb.rec(bnd - 1), 0, 8) === 'BOUNDARY' && pdb.has(bnd)) kfStart = bnd;
        else if (pdb.has(bnd) && ascii(pdb.rec(bnd), 0, 8) === 'BOUNDARY' && pdb.has(bnd + 1)) kfStart = bnd + 1;
      }
      if (kfStart < 0) {
        for (var r = 1; r < pdb.count; r++) {
          var rb = pdb.rec(r);
          if (rb.length >= 8 && rb.length < 64 && ascii(rb, 0, 8) === 'BOUNDARY') {
            if (pdb.has(r + 1) && ascii(pdb.rec(r + 1), 16, 20) === 'MOBI') kfStart = r + 1;
            break;
          }
        }
      }
    }
    var hk = null;
    if (kfStart > 0) {
      hk = readHeader(pdb.rec(kfStart));
      if (!hk.isMobi || hk.version < 8) { hk = null; kfStart = -1; }
      else if (hk.encryption) throw fail('drm', 'this book is DRM-protected');
    } else if (kfStart === 0) {
      hk = h0;
    }

    var meta = hk || h0;
    var decode = makeDecoder(meta.encoding);
    var title = meta.exthStr ? (meta.exthStr(503)[0] || meta.fullName || pdb.name) : pdb.name;
    if (!title && h0.exthStr) title = h0.exthStr(503)[0] || h0.fullName || pdb.name;
    var author = meta.exthStr ? meta.exthStr(100).join(', ') : '';
    var publisher = meta.exthStr ? (meta.exthStr(101)[0] || '') : '';
    var lang = meta.exthStr ? (meta.exthStr(524)[0] || '') : '';
    if (!lang && meta.locale && meta.locale !== NONE) lang = LCID[meta.locale & 0xFF] || '';

    var result = null, usedKf8 = false, imgFirst = NONE, images = null;
    if (hk) {
      try {
        // resource records: the KF8 header index is relative to the KF8 record 0,
        // but combined files may share the resources stored before the boundary.
        var cands = [];
        if (hk.firstImage !== NONE) cands.push(kfStart + hk.firstImage, hk.firstImage);
        if (h0 !== hk && h0.firstImage !== NONE) cands.push(h0.firstImage);
        imgFirst = NONE;
        for (var c = 0; c < cands.length; c++) {
          if (cands[c] > 0 && pdb.has(cands[c]) && looksResource(pdb.rec(cands[c]))) { imgFirst = cands[c]; break; }
        }
        images = collectImages(pdb, imgFirst);
        result = buildKF8(pdb, kfStart, hk, decode, images);
        usedKf8 = true;
      } catch (e) {
        if (kfStart === 0 || (e && (e.code === 'drm' || e.code === 'kfx'))) throw e;
        result = null; // fall back to the MOBI6 half
      }
    }
    if (!result) {
      decode = makeDecoder(h0.encoding);
      imgFirst = h0.firstImage;
      images = collectImages(pdb, imgFirst, kfStart > 0 ? kfStart - 1 : 0);
      result = buildMobi6(pdb, h0, decode, images);
      result.spine.forEach(function (p) { p.html = wrapDoc(p.html, title, lang); });
    }
    if (!result.toc.length) result.toc = headingToc(result.spine);

    var cover = null;
    var covOff = meta.exthNum ? meta.exthNum(201) : null;
    if (covOff == null || covOff === NONE || !images.byIndex[covOff + 1]) {
      covOff = meta.exthNum ? meta.exthNum(202) : null;
    }
    if (covOff != null && covOff !== NONE && images.byIndex[covOff + 1]) cover = images.byIndex[covOff + 1];

    return {
      title: title || '',
      author: author,
      lang: lang,
      publisher: publisher,
      kf8: usedKf8,
      spine: result.spine,
      resources: images.resources,
      toc: result.toc,
      cover: cover
    };
  }

  var MobiBook = {
    parse: function (input) {
      return new Promise(function (resolve) { resolve(parseSync(input)); }).catch(function (e) {
        if (e && e.code) throw e;
        var err = fail('broken', 'corrupt MOBI file: ' + (e && e.message ? e.message : String(e)));
        err.cause = e;
        throw err;
      });
    },
    sniff: function (u8) {
      try { return sniff(u8); } catch (e) { return null; }
    },
    // exposed for tests
    _internal: { makeHuff: makeHuff, lz77: lz77, trailingEnd: trailingEnd, Buf: Buf, readIndex: readIndex }
  };

  if (typeof module === 'object' && module.exports) module.exports = MobiBook;
  else root.MobiBook = MobiBook;
})(typeof self !== 'undefined' ? self : globalThis);
