/*
 * djvu-core.js — a self-contained DjVu (v3) decoder in plain JavaScript.
 *
 * Written from the public "Lizardtech DjVu Reference, DjVu v3" specification
 * (November 2005). No code from DjVuLibre or other GPL projects is used; the
 * numeric ZP-coder adaptation table is transcribed from that specification (its PDF
 * text is partly OCR'd: unreadable digits were restored from the table's own symmetry,
 * e.g. state 163 mirrors state 102 → p = 0x0117).
 *
 * Runs anywhere: inside a Web Worker (importScripts('djvu-core.js') → self.DjVuCore),
 * on the main thread, or in node (module.exports). It never touches the DOM.
 *
 * What the format is
 *   A DjVu file is an IFF85 container ("AT&T" + "FORM" chunk). A single page is a
 *   FORM:DJVU; a bundled multi-page book is a FORM:DJVM whose DIRM chunk lists the
 *   component files (pages FORM:DJVU, shared FORM:DJVI with shape dictionaries,
 *   thumbnails). A page is a compound image:
 *     - INFO   size / dpi / rotation
 *     - Sjbz   JB2 bilevel mask (text), may refer to a shared dictionary (Djbz via INCL)
 *     - BG44   IW44 wavelet background (colour or grey), usually at reduced resolution
 *     - FG44   IW44 foreground colours (tiny), or FGbz: palette + colour per JB2 blit
 *     - TXTz/TXTa hidden OCR text with a zone tree; NAVM (in DJVM) = bookmarks
 *   Pixels covered by the mask take the foreground colour, the rest the background.
 *
 * Supported
 *   bundled DJVM (+ DIRM with BZZ table), single-page DJVU, FORM:PM44 / BM44 photos,
 *   INCL shared components, ZP-coder, BZZ, JB2 (all record types incl. refinement,
 *   shared dictionaries, numcoder reset, comments), IW44 colour + grey, progressive
 *   multi-chunk BG44, FG44, FGbz palettes, INFO rotation, TXTz/TXTa zones, NAVM.
 * Not supported (skipped silently)
 *   indirect (multi-file) documents → error code 'indirect'; JPEG layers (BGjp/FGjp);
 *   G4/MMR masks (Smmr); annotations (ANTa/ANTz: background colour, hyperlinks...);
 *   embedded thumbnails (TH44); display gamma correction.
 *
 * Rendering: the background is resampled (box filter when shrinking ≥2x, else bilinear;
 * the wavelet is reconstructed at a coarser scale for small outputs); the mask is
 * area-averaged straight from the JB2 blits into the output (anti-aliased text) without
 * ever allocating a full-resolution bitmap. Decoded page layers are cached for the last
 * 3 pages (fewer when they exceed ~120 MB); shared JB2 dictionaries for the last 4.
 * Corrupt data never hangs: the arithmetic decoder stops 32 bytes past a chunk's end and
 * JB2 decoding has record / pixel budgets; such pages throw code 'broken'.
 *
 * API (synchronous)
 *   const doc = DjVuCore.open(uint8array)   // throws Error with .code 'notdjvu'|'indirect'|'broken'
 *   doc.pages                                // page count
 *   doc.info(i)                              // { width, height, dpi, rotate } (display orientation)
 *   doc.hasText                              // some page carries TXTz/TXTa
 *   doc.renderRGBA(i, width)                 // { width, height, data: Uint8ClampedArray RGBA }
 *   doc.text(i)                              // { text, words:[{x,y,w,h,s,e}], lines:[...] } | null
 *   doc.outline()                            // [{ title, page, children }] (page 0-based, -1 = external, + url)
 */
(function (root) {
  'use strict';

  function fail(code, message) {
    const e = new Error(message || code);
    e.code = code;
    return e;
  }

  /* ------------------------------------------------------------------ *
   * Byte helpers
   * ------------------------------------------------------------------ */
  function be16(b, p) { return (b[p] << 8) | b[p + 1]; }
  function be24(b, p) { return (b[p] << 16) | (b[p + 1] << 8) | b[p + 2]; }
  function be32(b, p) { return ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]) >>> 0; }
  function str4(b, p) { return String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]); }

  /* UTF-8 → string plus a map byteOffset → UTF-16 index (invalid bytes become U+FFFD). */
  function utf8Decode(b, start, end, wantMap) {
    const n = end - start;
    const map = wantMap ? new Uint32Array(n + 1) : null;
    const units = new Uint16Array(n * 2 + 1);
    let u = 0, i = start;
    while (i < end) {
      const c = b[i];
      let cp = 0xfffd, len = 1;
      if (c < 0x80) { cp = c; }
      else if (c >= 0xc2 && c < 0xe0 && i + 1 < end && (b[i + 1] & 0xc0) === 0x80) { cp = ((c & 0x1f) << 6) | (b[i + 1] & 0x3f); len = 2; }
      else if (c >= 0xe0 && c < 0xf0 && i + 2 < end && (b[i + 1] & 0xc0) === 0x80 && (b[i + 2] & 0xc0) === 0x80) {
        cp = ((c & 0x0f) << 12) | ((b[i + 1] & 0x3f) << 6) | (b[i + 2] & 0x3f); len = 3;
        if (cp < 0x800 || (cp >= 0xd800 && cp < 0xe000)) cp = 0xfffd;
      } else if (c >= 0xf0 && c < 0xf5 && i + 3 < end && (b[i + 1] & 0xc0) === 0x80 && (b[i + 2] & 0xc0) === 0x80 && (b[i + 3] & 0xc0) === 0x80) {
        cp = ((c & 0x07) << 18) | ((b[i + 1] & 0x3f) << 12) | ((b[i + 2] & 0x3f) << 6) | (b[i + 3] & 0x3f); len = 4;
        if (cp < 0x10000 || cp > 0x10ffff) { cp = 0xfffd; }
      }
      if (map) for (let k = 0; k < len; k++) map[i - start + k] = u;
      if (cp >= 0x10000) { cp -= 0x10000; units[u++] = 0xd800 + (cp >> 10); units[u++] = 0xdc00 + (cp & 0x3ff); }
      else units[u++] = cp;
      i += len;
    }
    if (map) map[n] = u;
    let s = '';
    for (let k = 0; k < u; k += 8192) s += String.fromCharCode.apply(null, units.subarray(k, Math.min(u, k + 8192)));
    return { str: s, map: map };
  }

  /* ------------------------------------------------------------------ *
   * IFF85 container
   * ------------------------------------------------------------------ */
  function readChunks(b, start, end) {
    const out = [];
    let p = start;
    while (p + 8 <= end) {
      const id = str4(b, p);
      const len = be32(b, p + 4);
      const ds = p + 8;
      let de = ds + len;
      if (de > end) de = end; // truncated file: keep what we have
      const ch = { id: id, start: ds, end: de };
      if (id === 'FORM' && de - ds >= 4) { ch.type = str4(b, ds); }
      out.push(ch);
      p = ds + len + (len & 1);
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * ZP-coder (Appendix 3). Adaptation table from the specification.
   * ------------------------------------------------------------------ */
  const ZP_P = new Uint16Array(251), ZP_M = new Uint16Array(251), ZP_UP = new Uint8Array(251), ZP_DN = new Uint8Array(251);
  (function buildZPTable() {
    // probabilities p_k for k = 0..250
    const p = ('8000 8000 8000 6bbd 6bbd 5d45 5d45 51b9 51b9 4813 4813 3fd5 3fd5 38b1 38b1 3275 3275 2cfd 2cfd 2825 2825 ' +
      '23ab 23ab 1f87 1f87 1bbb 1bbb 1845 1845 1523 1523 1253 1253 0fcf 0fcf 0d95 0d95 0b9d 0b9d 09e3 09e3 0861 0861 ' +
      '0711 0711 05f1 05f1 04f9 04f9 0425 0425 0371 0371 02d9 02d9 0259 0259 01ed 01ed 0193 0193 0149 0149 010b 010b ' +
      '00d5 00d5 00a5 00a5 007b 007b 0057 0057 003b 003b 0023 0023 0013 0013 0007 0007 0001 0001 ' +
      '5695 24ee 8000 0d30 481a 0481 3579 017a 24ef 007b 1978 0028 10ca 000d 0b5d 0034 078a 00a0 050f 0117 0358 01ea ' +
      '0234 0144 0173 0234 00f5 0353 00a1 05c5 011a 03cf 01aa 0285 0286 01ab 03d3 011a 05c5 00ba 08ad 007a 0ccc 01eb ' +
      '1302 02e6 1b81 045e 24ef 0690 2865 09de 3987 0dc8 2c99 10ca 3b5f 0b5d 5695 078a 8000 050f 24ee 0358 0d30 0234 ' +
      '0481 0173 017a 00f5 007b 00a1 0028 011a 000d 01aa 0034 0286 00a0 03d3 0117 05c5 01ea 08ad 0144 0ccc 0234 1302 ' +
      '0353 1b81 05c5 24ef 03cf 2b74 0285 201d 01ab 1715 011a 0fb7 00ba 0a67 01eb 06e7 02e6 0496 045e 030d 0690 0206 ' +
      '09de 0155 0dc8 00e1 2b74 0094 201d 0188 1715 0252 0fb7 0383 0a67 0547 06e7 07e2 0496 0bc0 030d 1178 0206 19da ' +
      '0155 24ef 00e1 320e 0094 432a 0188 447d 0252 5ece 0383 8000 0547 481a 07e2 3579 0bc0 24ef 1178 1978 19da 2865 ' +
      '24ef 3987 320e 2c99 432a 3b5f 447d 5695 5ece 8000 8000 5695 481a 481a').split(' ');
    // MPS thresholds m_k for k = 3..82 (pairs), zero elsewhere
    const m = ('10a5 1f28 2bd3 36e3 408c 48fd 505d 56d0 5c71 615b 65a5 6962 6ca2 6f74 71e6 7404 75d6 7768 78c2 79ea ' +
      '7ae7 7bbe 7c75 7d0f 7d91 7dfe 7e5a 7ea6 7ee6 7f1a 7f45 7f6b 7f8d 7faa 7fc3 7fd7 7fe7 7ff2 7ffa 7fff').split(' ');
    // next states (up, dn) for k = 83..250
    const t = ('9 85 86 226 5 6 88 176 89 143 90 138 91 141 92 112 93 135 94 104 95 133 96 100 97 129 82 98 99 127 76 72 ' +
      '101 125 70 102 103 123 66 60 105 121 106 110 107 119 66 108 109 117 60 54 111 115 56 48 69 113 114 134 65 59 ' +
      '116 132 61 55 118 130 57 51 120 128 53 47 122 126 49 41 124 62 43 37 72 66 39 31 60 54 33 25 56 50 29 131 52 46 ' +
      '23 17 48 40 23 15 42 136 137 7 38 32 21 139 140 172 15 9 142 170 9 85 144 168 141 248 146 166 147 247 148 164 ' +
      '149 197 150 162 151 95 152 160 153 173 154 158 155 165 70 156 157 161 66 60 81 159 62 56 75 71 58 52 69 163 ' +
      '54 48 65 59 50 42 167 171 44 38 65 169 40 32 59 53 34 26 55 47 30 174 175 193 24 18 177 191 178 222 179 189 ' +
      '180 218 181 187 182 216 183 185 184 214 69 61 186 212 59 53 188 210 55 49 190 208 51 45 192 206 47 39 194 204 ' +
      '41 195 196 202 37 31 198 200 199 243 72 64 201 239 62 56 203 237 58 52 205 235 54 48 207 233 50 44 209 231 ' +
      '46 38 211 229 40 34 213 227 36 28 215 225 30 22 217 223 26 16 219 221 20 220 71 63 14 8 61 55 14 224 57 51 ' +
      '8 2 53 47 228 87 49 43 230 246 45 37 232 244 39 33 234 238 35 27 138 236 29 21 24 16 25 15 240 8 19 241 22 242 ' +
      '13 7 16 10 13 245 10 2 7 1 244 83 249 250 10 2 89 143 230 246').split(' ');
    for (let k = 0; k < 251; k++) ZP_P[k] = parseInt(p[k], 16);
    for (let k = 3; k <= 82; k++) ZP_M[k] = parseInt(m[(k - 3) >> 1], 16);
    ZP_UP[0] = 84; ZP_DN[0] = 145; ZP_UP[1] = 3; ZP_DN[1] = 4; ZP_UP[2] = 4; ZP_DN[2] = 3;
    for (let k = 3; k <= 80; k++) { ZP_UP[k] = k + 2; ZP_DN[k] = k - 2; }
    ZP_UP[81] = 81; ZP_DN[81] = 79; ZP_UP[82] = 82; ZP_DN[82] = 80;
    for (let k = 83; k <= 250; k++) { ZP_UP[k] = +t[(k - 83) * 2]; ZP_DN[k] = +t[(k - 83) * 2 + 1]; }
  })();

  /*
   * Arithmetic decoder over bytes[start, end). Missing bytes read as 0xff (spec: "assumed
   * to be 1"); a stream that keeps reading well past its end is corrupt, so after 32 such
   * bytes decoding stops with a 'broken' error instead of producing endless garbage.
   */
  function ZP(b, start, end) {
    this.b = b; this.pos = start; this.end = end;
    this.over = 0;
    this.a = 0;
    this.buffer = 0;
    this.scount = 0;
    const b0 = this.pos < end ? b[this.pos++] : 0xff;
    const b1 = this.pos < end ? b[this.pos++] : 0xff;
    this.code = (b0 << 8) | b1;
    this.preload();
    this.fence = this.code >= 0x8000 ? 0x7fff : this.code;
  }
  ZP.prototype.preload = function () {
    while (this.scount <= 24) {
      let byte = 0xff;
      if (this.pos < this.end) byte = this.b[this.pos++];
      else if (++this.over > 32) throw fail('broken', 'compressed data ended early');
      this.buffer = ((this.buffer << 8) | byte) >>> 0;
      this.scount += 8;
    }
  };
  /* decode one bit with adaptive context ctx[i] */
  ZP.prototype.decode = function (ctx, i) {
    const s = ctx[i];
    let z = this.a + ZP_P[s];
    if (z <= this.fence) { this.a = z; return s & 1; }
    const d = 0x6000 + ((z + this.a) >> 2);
    if (z > d) z = d;
    if (z > this.code) {
      // least probable symbol
      z = 0x10000 - z;
      const a = this.a + z;
      const code = this.code + z;
      ctx[i] = ZP_DN[s];
      const shift = Math.clz32((~a) & 0xffff) - 16; // number of leading ones in 16 bits
      this.scount -= shift;
      this.a = (a << shift) & 0xffff;
      this.code = ((code << shift) | ((this.buffer >>> this.scount) & ((1 << shift) - 1))) & 0xffff;
      if (this.scount < 16) this.preload();
      this.fence = this.code >= 0x8000 ? 0x7fff : this.code;
      return (s & 1) ^ 1;
    }
    // most probable symbol with renormalisation
    if (this.a >= ZP_M[s]) ctx[i] = ZP_UP[s];
    this.scount -= 1;
    this.a = (z << 1) & 0xffff;
    this.code = ((this.code << 1) | ((this.buffer >>> this.scount) & 1)) & 0xffff;
    if (this.scount < 16) this.preload();
    this.fence = this.code >= 0x8000 ? 0x7fff : this.code;
    return s & 1;
  };
  ZP.prototype._simple = function (z) {
    if (z > this.code) {
      z = 0x10000 - z;
      const a = this.a + z;
      const code = this.code + z;
      const shift = Math.clz32((~a) & 0xffff) - 16;
      this.scount -= shift;
      this.a = (a << shift) & 0xffff;
      this.code = ((code << shift) | ((this.buffer >>> this.scount) & ((1 << shift) - 1))) & 0xffff;
      if (this.scount < 16) this.preload();
      this.fence = this.code >= 0x8000 ? 0x7fff : this.code;
      return 1;
    }
    this.scount -= 1;
    this.a = (z << 1) & 0xffff;
    this.code = ((this.code << 1) | ((this.buffer >>> this.scount) & 1)) & 0xffff;
    if (this.scount < 16) this.preload();
    this.fence = this.code >= 0x8000 ? 0x7fff : this.code;
    return 0;
  };
  /* pass-through (no context) decoding, as used by BZZ */
  ZP.prototype.raw = function () { return this._simple(0x8000 + (this.a >> 1)); };
  /* pass-through variant used by IW44 for signs and low mantissa bits */
  ZP.prototype.rawIW = function () { return this._simple(0x8000 + ((this.a * 3) >> 3)); };

  /* ------------------------------------------------------------------ *
   * BZZ (Appendix 4): Burrows-Wheeler + adaptive MTF + ZP
   * ------------------------------------------------------------------ */
  function bzzDecode(b, start, end) {
    const zp = new ZP(b, start, end);
    const ctx = new Uint8Array(262);
    const blocks = [];
    let total = 0;
    for (;;) {
      let n = 1;
      while (n < 0x1000000) n = (n << 1) | zp.raw();
      const size = n - 0x1000000;
      if (size === 0) break;
      if (size > 4096 * 1024) throw fail('broken', 'BZZ block too large');
      let fshift = 0;
      if (zp.raw()) fshift = zp.raw() ? 2 : 1;
      const data = new Uint8Array(size);
      const mtf = new Uint8Array(256);
      for (let i = 0; i < 256; i++) mtf[i] = i;
      const freq = new Uint32Array(4);
      let fadd = 4, mtfno = 3, markerpos = -1;
      for (let i = 0; i < size; i++) {
        const cid = mtfno < 2 ? mtfno : 2;
        if (zp.decode(ctx, cid)) mtfno = 0;
        else if (zp.decode(ctx, cid + 3)) mtfno = 1;
        else {
          let base = 6, bits = 1;
          mtfno = 256;
          for (; bits <= 7; bits++) {
            if (zp.decode(ctx, base)) {
              let v = 1;
              const lim = 1 << bits;
              while (v < lim) v = (v << 1) | zp.decode(ctx, base + v);
              mtfno = v; // = 2^bits + decoded (bits)-bit number
              break;
            }
            base += 1 << bits; // contexts used: 1 flag + (2^bits - 1) tree nodes, next flag after them
          }
        }
        if (mtfno === 256) { data[i] = 0; markerpos = i; continue; }
        const sym = mtf[mtfno];
        data[i] = sym;
        fadd = fadd + (fadd >>> fshift);
        if (fadd > 0x10000000) {
          fadd >>>= 24;
          freq[0] >>>= 24; freq[1] >>>= 24; freq[2] >>>= 24; freq[3] >>>= 24;
        }
        let fc = fadd;
        if (mtfno < 4) fc += freq[mtfno];
        let k = mtfno;
        for (; k > 3; k--) mtf[k] = mtf[k - 1];
        for (; k > 0 && fc >= freq[k - 1]; k--) { mtf[k] = mtf[k - 1]; freq[k] = freq[k - 1]; }
        mtf[k] = sym;
        freq[k] = fc;
      }
      if (markerpos < 1 || markerpos >= size) throw fail('broken', 'BZZ marker');
      // inverse Burrows-Wheeler transform
      const count = new Uint32Array(256);
      const posn = new Uint32Array(size);
      for (let i = 0; i < size; i++) {
        if (i === markerpos) { posn[i] = 0; continue; }
        const c = data[i];
        posn[i] = count[c]++;
      }
      let last = 1;
      for (let i = 0; i < 256; i++) { const t = count[i]; count[i] = last; last += t; }
      if (last !== size) throw fail('broken', 'BZZ count');
      const out = new Uint8Array(size - 1);
      let k = 0;
      last = size - 1;
      while (last > 0) {
        const c = data[k];
        out[--last] = c;
        k = count[c] + posn[k];
        if (k >= size) throw fail('broken', 'BZZ index');
      }
      if (k !== markerpos) throw fail('broken', 'BZZ checksum');
      blocks.push(out);
      total += out.length;
    }
    if (blocks.length === 1) return blocks[0];
    const res = new Uint8Array(total);
    let off = 0;
    for (const blk of blocks) { res.set(blk, off); off += blk.length; }
    return res;
  }

  /* ------------------------------------------------------------------ *
   * JB2 bilevel coding (Appendix 2)
   * ------------------------------------------------------------------ */
  const BIGPOS = 262142, BIGNEG = -262143;
  // integer contexts
  const N_RECTYPE = 0, N_MATCH = 1, N_ABS_W = 2, N_ABS_H = 3, N_REL_W = 4, N_REL_H = 5, N_ABS_X = 6, N_ABS_Y = 7,
    N_CUR_X = 8, N_CUR_Y = 9, N_NEW_X = 10, N_NEW_Y = 11, N_IMG_SIZE = 12, N_DICT = 13, N_COM_LEN = 14, N_COM_BYTE = 15;

  /*
   * Bitmap: { w, h, data: Uint8Array(w*h) } top-down rows, 1 = black. Library shapes also
   * carry the bounding box of their black pixels (bl, bt, br, bb inclusive, top-down): the
   * spec trims empty edge rows/columns of library symbols, so sizes, alignment and copies
   * are all relative to that box (equivalent to storing the trimmed bitmap).
   */
  function compactBitmap(w, h, buf, stride, off) {
    const data = new Uint8Array(w * h);
    for (let r = 0; r < h; r++) { const so = off + r * stride; data.set(buf.subarray(so, so + w), r * w); }
    return { w: w, h: h, data: data };
  }
  function withBox(bm) {
    const w = bm.w, h = bm.h, d = bm.data;
    let top = -1, bottom = -1, left = w, right = -1;
    for (let r = 0; r < h; r++) {
      const ro = r * w;
      let c = 0;
      while (c < w && !d[ro + c]) c++;
      if (c === w) continue;
      if (c < left) left = c;
      let e = w - 1;
      while (!d[ro + e]) e--;
      if (e > right) right = e;
      if (top < 0) top = r;
      bottom = r;
    }
    if (top < 0) { bm.bl = 0; bm.bt = 0; bm.br = -1; bm.bb = -1; }
    else { bm.bl = left; bm.bt = top; bm.br = right; bm.bb = bottom; }
    return bm;
  }

  function JB2Decoder(b, start, end) {
    this.zp = new ZP(b, start, end);
    this.direct = new Uint8Array(1024);
    this.refine = new Uint8Array(2048);
    this.flagCtx = new Uint8Array(2); // 0 = eventual refinement, 1 = offset type
    this.roots = new Int32Array(16);
    this.cells = 1;
    this.bit = new Uint8Array(4096);
    this.left = new Int32Array(4096);
    this.right = new Int32Array(4096);
  }
  JB2Decoder.prototype.resetNum = function () {
    this.roots.fill(0);
    this.cells = 1;
    this.bit.fill(0); this.left.fill(0); this.right.fill(0);
  };
  JB2Decoder.prototype.newCell = function () {
    if (this.cells >= this.bit.length) {
      const n = this.bit.length * 2;
      if (n > (1 << 24)) throw fail('broken', 'JB2 context overflow');
      const nb = new Uint8Array(n); nb.set(this.bit); this.bit = nb;
      const nl = new Int32Array(n); nl.set(this.left); this.left = nl;
      const nr = new Int32Array(n); nr.set(this.right); this.right = nr;
    }
    return this.cells++;
  };
  /* multivalue integer decoding (section 11.2.5) */
  JB2Decoder.prototype.num = function (low, high, rootIdx) {
    let negative = false, cutoff = 0, phase = 1, range = 0xffffffff;
    let node = this.roots[rootIdx];
    if (!node) { node = this.newCell(); this.roots[rootIdx] = node; }
    let parent = 0, side = 0;
    const zp = this.zp;
    while (range !== 1) {
      if (!node) {
        node = this.newCell();
        if (side) this.right[parent] = node; else this.left[parent] = node;
      }
      const decision = (low >= cutoff) || ((high >= cutoff) && zp.decode(this.bit, node) === 1);
      parent = node; side = decision ? 1 : 0;
      node = decision ? this.right[node] : this.left[node];
      switch (phase) {
        case 1:
          negative = !decision;
          if (negative) { const tmp = -low - 1; low = -high - 1; high = tmp; }
          phase = 2; cutoff = 1;
          break;
        case 2:
          if (!decision) {
            phase = 3;
            range = (cutoff + 1) >> 1;
            if (range === 1) cutoff = 0; else cutoff -= range >> 1;
          } else {
            cutoff += cutoff + 1;
          }
          break;
        default:
          range >>= 1;
          if (range !== 1) {
            if (!decision) cutoff -= range >> 1; else cutoff += range >> 1;
          } else if (!decision) {
            cutoff--;
          }
          break;
      }
    }
    return negative ? (-cutoff - 1) : cutoff;
  };
  /* direct coding of a w x h bitmap; returns padded buffer info */
  JB2Decoder.prototype.directBitmap = function (w, h) {
    const stride = w + 4;
    const buf = new Uint8Array(stride * (h + 3));
    const off = 2 * stride + 2;
    const zp = this.zp, ctxs = this.direct;
    for (let r = 0; r < h; r++) {
      const p0 = off + r * stride, p1 = p0 - stride, p2 = p1 - stride;
      let ctx = (buf[p2 - 1] << 9) | (buf[p2] << 8) | (buf[p2 + 1] << 7) |
        (buf[p1 - 2] << 6) | (buf[p1 - 1] << 5) | (buf[p1] << 4) | (buf[p1 + 1] << 3) | (buf[p1 + 2] << 2) |
        (buf[p0 - 2] << 1) | buf[p0 - 1];
      for (let c = 0; c < w; c++) {
        const n = zp.decode(ctxs, ctx);
        buf[p0 + c] = n;
        ctx = ((ctx << 1) & 0x37a) | (buf[p1 + c + 3] << 2) | (buf[p2 + c + 2] << 7) | n;
      }
    }
    return { buf: buf, stride: stride, off: off };
  };
  /* refinement coding against library shape ref (with bounding box) */
  JB2Decoder.prototype.refineBitmap = function (w, h, ref) {
    const stride = w + 4;
    const buf = new Uint8Array(stride * (h + 3));
    const off = 2 * stride + 2;
    // reference aligned to the current bitmap frame (centres aligned), padded identically.
    // Centre column = leftmost of the two central columns, centre row = lowermost of the
    // two central rows (rows counted bottom-up in the spec → floor(h/2) top-down).
    const bwid = ref.br - ref.bl + 1, bhei = ref.bb - ref.bt + 1;
    const dx = (ref.bl + ((bwid - 1) >> 1)) - ((w - 1) >> 1); // ref column = c + dx
    const dy = (ref.bt + (bhei >> 1)) - (h >> 1);             // ref row (top-down) = r + dy
    const al = new Uint8Array(stride * (h + 3));
    for (let r = -1; r <= h; r++) {
      const rr = r + dy;
      if (rr < 0 || rr >= ref.h) continue;
      const c0 = Math.max(-2, -dx), c1 = Math.min(w + 1, ref.w - 1 - dx);
      const ao = off + r * stride, ro = rr * ref.w + dx;
      for (let c = c0; c <= c1; c++) al[ao + c] = ref.data[ro + c];
    }
    const zp = this.zp, ctxs = this.refine;
    for (let r = 0; r < h; r++) {
      const p0 = off + r * stride, p1 = p0 - stride;
      const x0 = p0, xu = p0 - stride, xd = p0 + stride; // aligned ref rows: same, above, below
      let ctx = (buf[p1 - 1] << 10) | (buf[p1] << 9) | (buf[p1 + 1] << 8) | (buf[p0 - 1] << 7) |
        (al[xu] << 6) | (al[x0 - 1] << 5) | (al[x0] << 4) | (al[x0 + 1] << 3) |
        (al[xd - 1] << 2) | (al[xd] << 1) | al[xd + 1];
      for (let c = 0; c < w; c++) {
        const n = zp.decode(ctxs, ctx);
        buf[p0 + c] = n;
        ctx = ((ctx << 1) & 0x636) | (buf[p1 + c + 2] << 8) | (n << 7) | (al[xu + c + 1] << 6) |
          (al[x0 + c + 2] << 3) | al[xd + c + 2];
      }
    }
    return { buf: buf, stride: stride, off: off };
  };

  /*
   * Decode a JB2 stream (Sjbz or Djbz).
   * getDict(n) must return an array of at least n library bitmaps when a shared
   * dictionary is required. Result: { width, height, library, blits } where each blit is
   * { bm, x, y } with (x, y) the top-left in top-down page coordinates.
   */
  function decodeJB2(b, start, end, getDict, wantBlits) {
    const dec = new JB2Decoder(b, start, end);
    const zp = dec.zp;
    let library = [];
    const blits = [];
    let width = 0, height = 0, started = false;
    // relative location state
    let lastRowLeft = 0, lastRowBottom = 0, lastRight = 0, lastBottom = 0;
    const sl = [0, 0, 0];
    let slPos = 0;
    const median = function () {
      const a = sl[0], b2 = sl[1], c = sl[2];
      return (a >= b2) ? ((a > c) ? ((b2 >= c) ? b2 : c) : a) : ((a < c) ? ((b2 >= c) ? c : b2) : a);
    };
    // place a symbol: (rows, cols) = coded rectangle; (ox, oy) = offset of that rectangle inside bm
    const place = function (bm, rows, cols, ox, oy) {
      let left, top;
      if (zp.decode(dec.flagCtx, 1)) {
        // new line, relative to the first symbol of the previous line
        left = lastRowLeft + dec.num(BIGNEG, BIGPOS, N_NEW_X);
        top = lastRowBottom + dec.num(BIGNEG, BIGPOS, N_NEW_Y);
        const right = left + cols - 1, bottom = top - rows + 1;
        lastRowLeft = left; lastRight = right; lastRowBottom = bottom; lastBottom = bottom;
        sl[0] = sl[1] = sl[2] = bottom; slPos = 0;
      } else {
        left = lastRight + dec.num(BIGNEG, BIGPOS, N_CUR_X);
        const bottom = lastBottom + dec.num(BIGNEG, BIGPOS, N_CUR_Y);
        top = bottom + rows - 1;
        lastRight = left + cols - 1;
        if (++slPos === 3) slPos = 0;
        sl[slPos] = bottom;
        lastBottom = median();
      }
      if (wantBlits && bm) blits.push({ bm: bm, x: left - 1 - ox, y: height - top - oy });
    };
    let budget = 30e6; // total decoded symbol pixels: guards against corrupt streams (raised at start of image)
    const checkSize = function (w, h) {
      budget -= w * h;
      if (w < 0 || h < 0 || w > 32767 || h > 32767 || budget < 0) throw fail('broken', 'JB2 symbol size');
    };
    const absSize = function () {
      const w = dec.num(0, BIGPOS, N_ABS_W), h = dec.num(0, BIGPOS, N_ABS_H);
      checkSize(w, h);
      return [w, h];
    };
    const matchIndex = function () {
      if (!library.length) throw fail('broken', 'JB2 empty library');
      return dec.num(0, library.length - 1, N_MATCH);
    };
    for (let guard = 0; ; guard++) {
      if (guard > 2e6) throw fail('broken', 'JB2 runaway');
      const type = dec.num(0, 11, N_RECTYPE);
      switch (type) {
        case 0: { // start of image
          width = dec.num(0, BIGPOS, N_IMG_SIZE);
          height = dec.num(0, BIGPOS, N_IMG_SIZE);
          zp.decode(dec.flagCtx, 0); // eventual refinement flag (always 0)
          if (!started) budget += 2 * Math.min(width * height, 100e6);
          lastRowLeft = 0; lastRowBottom = height; lastRight = 0; lastBottom = height;
          sl[0] = sl[1] = sl[2] = height; slPos = 0;
          started = true;
          break;
        }
        case 1: case 2: case 3: { // new symbol, direct coding
          const s = absSize();
          const r = dec.directBitmap(s[0], s[1]);
          const bm = compactBitmap(s[0], s[1], r.buf, r.stride, r.off);
          if (type !== 2) place(bm, s[1], s[0], 0, 0);
          if (type !== 3) library.push(withBox(bm));
          break;
        }
        case 4: case 5: case 6: { // matched symbol with refinement
          const ref = library[matchIndex()];
          const w = (ref.br - ref.bl + 1) + dec.num(BIGNEG, BIGPOS, N_REL_W);
          const h = (ref.bb - ref.bt + 1) + dec.num(BIGNEG, BIGPOS, N_REL_H);
          checkSize(w, h);
          const r = dec.refineBitmap(w, h, ref);
          const bm = compactBitmap(w, h, r.buf, r.stride, r.off);
          if (type !== 5) place(bm, h, w, 0, 0);
          if (type !== 6) library.push(withBox(bm));
          break;
        }
        case 7: { // matched copy
          const ref = library[matchIndex()];
          place(ref, ref.bb - ref.bt + 1, ref.br - ref.bl + 1, ref.bl, ref.bt);
          if (blits.length > 4e6) throw fail('broken', 'JB2 too many blits');
          break;
        }
        case 8: { // non-symbol data at absolute location
          const s = absSize();
          const r = dec.directBitmap(s[0], s[1]);
          const left = dec.num(1, Math.max(1, width), N_ABS_X);
          const top = dec.num(1, Math.max(1, height), N_ABS_Y);
          if (wantBlits) blits.push({ bm: compactBitmap(s[0], s[1], r.buf, r.stride, r.off), x: left - 1, y: height - top });
          break;
        }
        case 9: { // required dictionary / numcoder reset
          if (!started) {
            const n = dec.num(0, BIGPOS, N_DICT);
            const dict = getDict ? getDict(n) : null;
            if (!dict || dict.length < n) throw fail('broken', 'JB2 dictionary missing');
            library = dict.slice(0, n);
          } else {
            dec.resetNum();
          }
          break;
        }
        case 10: { // comment
          const len = dec.num(0, BIGPOS, N_COM_LEN);
          for (let i = 0; i < len; i++) dec.num(0, 255, N_COM_BYTE);
          break;
        }
        case 11:
          return { width: width, height: height, library: library, blits: blits };
        default:
          throw fail('broken', 'JB2 record');
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * IW44 wavelet images (Appendix 1)
   * ------------------------------------------------------------------ */
  const IW_BAND_START = [0, 1, 2, 3, 4, 8, 12, 16, 32, 48];
  const IW_BAND_SIZE = [1, 1, 1, 1, 4, 4, 4, 16, 16, 16];
  const IW_QUANT = [0x004000, 0x008000, 0x008000, 0x010000, 0x010000, 0x010000, 0x020000, 0x020000,
    0x020000, 0x040000, 0x040000, 0x040000, 0x080000, 0x040000, 0x040000, 0x080000];
  const ZERO = 1, ACTIVE = 2, NEW = 4, UNK = 8;
  // coefficient index → (row, col) inside the 32x32 block (row 0 = bottom)
  const ZIG_ROW = new Uint8Array(1024), ZIG_COL = new Uint8Array(1024);
  for (let n = 0; n < 1024; n++) {
    ZIG_ROW[n] = (((n >> 1) & 1) << 4) | (((n >> 3) & 1) << 3) | (((n >> 5) & 1) << 2) | (((n >> 7) & 1) << 1) | ((n >> 9) & 1);
    ZIG_COL[n] = ((n & 1) << 4) | (((n >> 2) & 1) << 3) | (((n >> 4) & 1) << 2) | (((n >> 6) & 1) << 1) | ((n >> 8) & 1);
  }

  function IWCodec(w, h) {
    this.w = w; this.h = h;
    this.bw = (w + 31) & ~31; this.bh = (h + 31) & ~31;
    this.nbx = this.bw >> 5; this.nb = this.nbx * (this.bh >> 5);
    this.coef = new Int16Array(this.nb * 1024);
    this.quantLo = new Int32Array(16);
    this.quantHi = new Int32Array(10);
    for (let i = 0; i < 4; i++) this.quantLo[i] = IW_QUANT[i];
    for (let i = 4; i < 8; i++) this.quantLo[i] = IW_QUANT[4];
    for (let i = 8; i < 12; i++) this.quantLo[i] = IW_QUANT[5];
    for (let i = 12; i < 16; i++) this.quantLo[i] = IW_QUANT[6];
    for (let i = 1; i < 10; i++) this.quantHi[i] = IW_QUANT[6 + i];
    // contexts: [0..15] activate coefficient, [16..95] bucket (band*8 + n), [96] mantissa, [97] root
    this.ctx = new Uint8Array(98);
    this.curband = 0; this.curbit = 1;
    this.cstate = new Uint8Array(256);
    this.bstate = new Uint8Array(16);
  }
  IWCodec.prototype.slice = function (zp) {
    if (this.curbit < 0) return 0;
    const band = this.curband;
    let isNull = true;
    if (band === 0) {
      for (let i = 0; i < 16; i++) {
        const t = this.quantLo[i];
        this.cstate[i] = ZERO;
        if (t > 0 && t < 0x8000) { this.cstate[i] = UNK; isNull = false; }
      }
    } else {
      const t = this.quantHi[band];
      isNull = !(t > 0 && t < 0x8000);
    }
    if (!isNull) {
      const fb = IW_BAND_START[band], nbk = IW_BAND_SIZE[band];
      for (let blk = 0; blk < this.nb; blk++) this.buckets(zp, band, blk << 10, fb, nbk);
    }
    // reduce step sizes, advance band
    this.quantHi[band] >>= 1;
    if (band === 0) for (let i = 0; i < 16; i++) this.quantLo[i] >>= 1;
    if (++this.curband >= 10) {
      this.curband = 0;
      this.curbit++;
      if (this.quantHi[9] === 0) { this.curbit = -1; return 0; }
    }
    return 1;
  };
  IWCodec.prototype.buckets = function (zp, band, bo, fbucket, nbucket) {
    const coef = this.coef, cstate = this.cstate, bstate = this.bstate, ctx = this.ctx;
    // preliminary flags
    let bbstate = 0;
    if (band) {
      for (let k = 0; k < nbucket; k++) {
        const co = bo + ((fbucket + k) << 4), so = k << 4;
        let bs = 0;
        for (let i = 0; i < 16; i++) {
          const st = coef[co + i] ? ACTIVE : UNK;
          cstate[so + i] = st;
          bs |= st;
        }
        bstate[k] = bs;
        bbstate |= bs;
      }
    } else {
      for (let i = 0; i < 16; i++) {
        let st = cstate[i];
        if (st !== ZERO) st = coef[bo + i] ? ACTIVE : UNK;
        cstate[i] = st;
        bbstate |= st;
      }
      bstate[0] = bbstate;
    }
    // decode buckets decision
    if (nbucket < 16 || (bbstate & ACTIVE)) bbstate |= NEW;
    else if (bbstate & UNK) { if (zp.decode(ctx, 97)) bbstate |= NEW; }
    // decode coefficients decision per bucket
    if (bbstate & NEW) {
      for (let k = 0; k < nbucket; k++) {
        if (bstate[k] & UNK) {
          let n = 0;
          if (band) {
            const t = bo + ((fbucket + k) << 2);
            if (coef[t]) n++;
            if (coef[t + 1]) n++;
            if (coef[t + 2]) n++;
            if (n < 3 && coef[t + 3]) n++;
          }
          if (bbstate & ACTIVE) n |= 4;
          if (zp.decode(ctx, 16 + band * 8 + n)) bstate[k] |= NEW;
        }
      }
      // newly active coefficients
      let thres = this.quantHi[band];
      for (let k = 0; k < nbucket; k++) {
        if (!(bstate[k] & NEW)) continue;
        const co = bo + ((fbucket + k) << 4), so = k << 4;
        let gotcha = 0;
        for (let i = 0; i < 16; i++) if (cstate[so + i] & UNK) gotcha++;
        const act = (bstate[k] & ACTIVE) ? 8 : 0;
        for (let i = 0; i < 16; i++) {
          if (cstate[so + i] & UNK) {
            if (band === 0) thres = this.quantLo[i];
            if (zp.decode(ctx, (gotcha >= 7 ? 7 : gotcha) | act)) {
              cstate[so + i] |= NEW;
              const half = thres >> 1;
              const v = thres + half - (half >> 2);
              coef[co + i] = zp.rawIW() ? -v : v;
              gotcha = 0;
            } else if (gotcha > 0) gotcha--;
          }
        }
      }
    }
    // refine previously active coefficients
    if (bbstate & ACTIVE) {
      let thres = this.quantHi[band];
      for (let k = 0; k < nbucket; k++) {
        if (!(bstate[k] & ACTIVE)) continue;
        const co = bo + ((fbucket + k) << 4), so = k << 4;
        for (let i = 0; i < 16; i++) {
          if (!(cstate[so + i] & ACTIVE)) continue;
          const c0 = coef[co + i];
          let v = c0 < 0 ? -c0 : c0;
          if (band === 0) thres = this.quantLo[i];
          if (v <= 3 * thres) {
            v += thres >> 2;
            if (zp.decode(ctx, 96)) v += thres >> 1; else v = v - thres + (thres >> 1);
          } else {
            if (zp.rawIW()) v += thres >> 1; else v = v - thres + (thres >> 1);
          }
          coef[co + i] = c0 > 0 ? v : -v;
        }
      }
    }
  };
  /*
   * Inverse wavelet transform → Int8Array (w*h, row 0 = bottom, values -128..127).
   * minScale = 1 for full resolution; 2 (or more) reconstructs a coarser image and
   * returns it subsampled (dimensions ceil(w/minScale) x ceil(h/minScale)).
   */
  IWCodec.prototype.image = function (minScale) {
    const bw = this.bw, w = this.w, h = this.h, nbx = this.nbx;
    const d = new Int16Array(bw * this.bh);
    const coef = this.coef;
    for (let blk = 0; blk < this.nb; blk++) {
      const bx = (blk % nbx) << 5, by = ((blk / nbx) | 0) << 5;
      const bo = blk << 10, base = by * bw + bx;
      for (let n = 0; n < 1024; n++) {
        const v = coef[bo + n];
        if (v) d[base + ZIG_ROW[n] * bw + ZIG_COL[n]] = v;
      }
    }
    for (let s = 16; s >= minScale; s >>= 1) {
      liftVertical(d, w, h, bw, s);
      liftHorizontal(d, w, h, bw, s);
    }
    const ow = Math.ceil(w / minScale), oh = Math.ceil(h / minScale);
    const out = new Int8Array(ow * oh);
    for (let y = 0; y < oh; y++) {
      const ro = y * minScale * bw;
      for (let x = 0; x < ow; x++) {
        let v = (d[ro + x * minScale] + 32) >> 6;
        out[y * ow + x] = v < -128 ? -128 : v > 127 ? 127 : v;
      }
    }
    return { w: ow, h: oh, data: out };
  };

  /* vertical inverse lifting at scale s: rows 0, s, 2s, ...; columns 0, s, 2s, ... */
  function liftVertical(d, w, h, bw, s) {
    const n = (((h - 1) / s) | 0) + 1;
    const rs = s * bw;
    // lifting: even rows from (unmodified) odd neighbours
    for (let k = 0; k < n; k += 2) {
      const r = k * rs;
      const m1 = k >= 1, p1 = k + 1 < n, m3 = k >= 3, p3 = k + 3 < n;
      if (m1 && p1 && m3 && p3) {
        for (let x = 0; x < w; x += s) {
          const i = r + x;
          const a = d[i - rs] + d[i + rs], b = d[i - 3 * rs] + d[i + 3 * rs];
          d[i] -= (9 * a - b + 16) >> 5;
        }
      } else {
        for (let x = 0; x < w; x += s) {
          const i = r + x;
          const a = (m1 ? d[i - rs] : 0) + (p1 ? d[i + rs] : 0);
          const b = (m3 ? d[i - 3 * rs] : 0) + (p3 ? d[i + 3 * rs] : 0);
          d[i] -= (9 * a - b + 16) >> 5;
        }
      }
    }
    // prediction: odd rows from lifted even neighbours
    for (let k = 1; k < n; k += 2) {
      const r = k * rs;
      if (k >= 3 && k + 3 < n) {
        for (let x = 0; x < w; x += s) {
          const i = r + x;
          d[i] += (9 * (d[i - rs] + d[i + rs]) - (d[i - 3 * rs] + d[i + 3 * rs]) + 8) >> 4;
        }
      } else if (k + 1 < n) {
        for (let x = 0; x < w; x += s) { const i = r + x; d[i] += (d[i - rs] + d[i + rs] + 1) >> 1; }
      } else {
        for (let x = 0; x < w; x += s) { const i = r + x; d[i] += d[i - rs]; }
      }
    }
  }
  /* horizontal inverse lifting at scale s on rows 0, s, 2s, ... */
  function liftHorizontal(d, w, h, bw, s) {
    const n = (((w - 1) / s) | 0) + 1;
    const s3 = 3 * s;
    for (let y = 0; y < h; y += s) {
      const r = y * bw;
      // lifting (even k)
      for (let k = 0; k < n; k += 2) {
        const i = r + k * s;
        let a, b;
        if (k >= 3 && k + 3 < n) { a = d[i - s] + d[i + s]; b = d[i - s3] + d[i + s3]; }
        else {
          a = (k >= 1 ? d[i - s] : 0) + (k + 1 < n ? d[i + s] : 0);
          b = (k >= 3 ? d[i - s3] : 0) + (k + 3 < n ? d[i + s3] : 0);
        }
        d[i] -= (9 * a - b + 16) >> 5;
      }
      // prediction (odd k)
      for (let k = 1; k < n; k += 2) {
        const i = r + k * s;
        if (k >= 3 && k + 3 < n) d[i] += (9 * (d[i - s] + d[i + s]) - (d[i - s3] + d[i + s3]) + 8) >> 4;
        else if (k + 1 < n) d[i] += (d[i - s] + d[i + s] + 1) >> 1;
        else d[i] += d[i - s];
      }
    }
  }

  /* A progressive IW44 image fed with successive chunks (BG44 / FG44 / PM44 / BM44). */
  function IW44() {
    this.y = null; this.cb = null; this.cr = null;
    this.cslice = 0; this.delay = 0; this.grey = false;
    this.w = 0; this.h = 0; this.serial = 0;
  }
  IW44.prototype.addChunk = function (b, start, end) {
    if (end - start < 2) throw fail('broken', 'IW44 header');
    const serial = b[start], nslices = b[start + 1];
    let p = start + 2;
    if (serial !== this.serial) throw fail('broken', 'IW44 chunk order');
    if (serial === 0) {
      if (end - p < 6) throw fail('broken', 'IW44 header');
      const major = b[p], minor = b[p + 1];
      if ((major & 0x7f) !== 1) throw fail('broken', 'IW44 version');
      this.w = be16(b, p + 2); this.h = be16(b, p + 4);
      p += 6;
      let delay = 0;
      if (minor >= 2) { delay = b[p] & 0x7f; p++; }
      this.grey = (major & 0x80) !== 0;
      this.delay = delay;
      if (!this.w || !this.h || this.w * this.h > 80e6) throw fail('broken', 'IW44 size');
      this.y = new IWCodec(this.w, this.h);
      if (!this.grey) { this.cb = new IWCodec(this.w, this.h); this.cr = new IWCodec(this.w, this.h); }
    } else if (!this.y) throw fail('broken', 'IW44 first chunk missing');
    this.serial++;
    const zp = new ZP(b, p, end);
    const last = this.cslice + nslices;
    for (; this.cslice < last; this.cslice++) {
      let flag = this.y.slice(zp);
      if (this.cb && this.cslice >= this.delay) {
        flag |= this.cb.slice(zp);
        flag |= this.cr.slice(zp);
      }
      if (!flag) { this.cslice++; break; }
    }
  };
  /* → { w, h, rgb: Uint8Array (top-down, 3 bytes/pixel) } ; scale = 1, 2, 4... reduces resolution */
  IW44.prototype.toRGB = function (scale) {
    scale = scale || 1;
    const Y = this.y.image(scale);
    const w = Y.w, h = Y.h;
    const rgb = new Uint8Array(w * h * 3);
    const yd = Y.data;
    if (this.cb) {
      const cbd = this.cb.image(scale).data, crd = this.cr.image(scale).data;
      for (let row = 0; row < h; row++) {
        const so = (h - 1 - row) * w; // flip: IW44 row 0 is the bottom
        let o = row * w * 3;
        for (let x = 0; x < w; x++) {
          const yy = yd[so + x], bb = cbd[so + x], rr = crd[so + x];
          const t1 = bb >> 2, t2 = rr + (rr >> 1);
          const t3 = yy + 128 - t1;
          const R = yy + 128 + t2, G = t3 - (t2 >> 1), B = t3 + (bb << 1);
          rgb[o++] = R < 0 ? 0 : R > 255 ? 255 : R;
          rgb[o++] = G < 0 ? 0 : G > 255 ? 255 : G;
          rgb[o++] = B < 0 ? 0 : B > 255 ? 255 : B;
        }
      }
    } else {
      for (let row = 0; row < h; row++) {
        const so = (h - 1 - row) * w;
        let o = row * w * 3;
        for (let x = 0; x < w; x++) {
          const v = 127 - yd[so + x];
          rgb[o++] = v; rgb[o++] = v; rgb[o++] = v;
        }
      }
    }
    return { w: w, h: h, rgb: rgb };
  };

  /* ------------------------------------------------------------------ *
   * Hidden text (TXTa / TXTz) and outline (NAVM)
   * ------------------------------------------------------------------ */
  function parseText(t, pageH) {
    if (t.length < 3) return null;
    const len = be24(t, 0);
    if (3 + len > t.length) throw fail('broken', 'text length');
    const dec = utf8Decode(t, 3, 3 + len, true);
    // zone separators (VT, GS, RS, US, NUL) → newline / space, same length keeps offsets
    const text = dec.str.replace(/[\x0b\x1d\x1e\x1f]/g, '\n').replace(/\x00/g, ' ');
    const map = dec.map;
    const words = [], lines = [];
    let p = 3 + len;
    if (p < t.length) {
      p++; // version
      const toChar = function (byteOff) { return map[byteOff < 0 ? 0 : byteOff > len ? len : byteOff]; };
      const readZone = function (parent, prev, depth) {
        if (p + 17 > t.length || depth > 32) throw fail('broken', 'text zones');
        const type = t[p];
        let x = be16(t, p + 1) - 0x8000, y = be16(t, p + 3) - 0x8000;
        const w = be16(t, p + 5) - 0x8000, h = be16(t, p + 7) - 0x8000;
        let ts = be16(t, p + 9) - 0x8000;
        const tl = be24(t, p + 11);
        const nch = be24(t, p + 14);
        p += 17;
        if (prev) {
          if (type === 1 || type === 4 || type === 5) { x += prev.x0; y = prev.y0 - (y + h); }
          else { x += prev.x1; y += prev.y0; }
          ts += prev.ts + prev.tl;
        } else if (parent) {
          x += parent.x0; y = parent.y1 - (y + h);
          ts += parent.ts;
        }
        const z = { type: type, x0: x, y0: y, x1: x + w, y1: y + h, ts: ts, tl: tl };
        if (type === 5 || type === 6) {
          let s = toChar(ts), e = toChar(ts + tl);
          while (s < e && /\s/.test(text[s])) s++;
          while (e > s && /\s/.test(text[e - 1])) e--;
          const box = { x: z.x0, y: pageH - z.y1, w: w, h: h, s: s, e: e };
          (type === 6 ? words : lines).push(box);
        }
        let pc = null;
        for (let i = 0; i < nch; i++) pc = readZone(z, pc, depth + 1);
        return z;
      };
      try {
        let prevTop = null;
        while (p + 17 <= t.length) prevTop = readZone(null, prevTop, 0);
      } catch (e) { /* keep what was parsed */ }
    }
    return { text: text, words: words, lines: lines };
  }

  /*
   * NAVM bookmarks (already BZZ-decoded): UINT16 total count, then records in pre-order:
   * BYTE nChildren, INT24 len + UTF-8 title, INT24 len + UTF-8 url, children...
   * target(url) → 0-based page or -1. Returns [{ title, page, children, url? }].
   */
  function parseNavm(z, target) {
    if (z.length < 2) return [];
    const total = be16(z, 0);
    let q = 2, read = 0;
    const str = function () {
      if (q + 3 > z.length) throw fail('broken', 'NAVM');
      const n = be24(z, q); q += 3;
      const s = utf8Decode(z, q, Math.min(z.length, q + n), false).str; q += n;
      return s;
    };
    const one = function (depth) {
      if (q >= z.length || depth > 64) throw fail('broken', 'NAVM');
      const nch = z[q++];
      const title = str(), url = str();
      read++;
      const page = target(url);
      const item = { title: title.replace(/\s+/g, ' ').trim(), page: page, children: [] };
      if (page < 0 && url) item.url = url;
      for (let k = 0; k < nch && read < total; k++) item.children.push(one(depth + 1));
      return item;
    };
    const out = [];
    try { while (read < total && q < z.length) out.push(one(0)); } catch (e) { /* keep the partial outline */ }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Resampling helpers for compositing
   * ------------------------------------------------------------------ */
  /* integer source spans for each output index: src [lo[i], lo[i+1]) */
  function spans(srcN, dstN) {
    const lo = new Int32Array(dstN + 1);
    for (let i = 0; i <= dstN; i++) lo[i] = Math.floor(i * srcN / dstN);
    return lo;
  }
  /*
   * Resample an RGB layer image (top-down) into the RGBA output. sx / sy = layer pixels
   * per output pixel (the layer is anchored at the page's top-left corner; it may extend
   * a little past the right/bottom edge because its size is ceil(page / subsample)).
   * Shrinking by 2x or more uses a box filter, otherwise bilinear interpolation.
   */
  /* integer subsampling of a layer (BG44/FG44 are ceil(page/k) in size), else the ratio */
  function subsample(W, H, w, h) {
    const k = Math.max(1, Math.round(W / w));
    if (Math.ceil(W / k) === w && Math.abs(Math.ceil(H / k) - h) <= 1) return k;
    return W / w;
  }
  function drawBackground(out, outW, outH, img, sx, sy) {
    const iw = img.w, ih = img.h, rgb = img.rgb;
    if (sx >= 2 && sy >= 2) {
      const xs = new Int32Array(outW + 1), ys = new Int32Array(outH + 1);
      for (let i = 0; i <= outW; i++) xs[i] = Math.min(iw, Math.floor(i * sx));
      for (let i = 0; i <= outH; i++) ys[i] = Math.min(ih, Math.floor(i * sy));
      const acc = new Uint32Array(outW * 3);
      for (let oy = 0; oy < outH; oy++) {
        acc.fill(0);
        const y0 = Math.min(ys[oy], ih - 1), y1 = Math.max(ys[oy + 1], y0 + 1);
        for (let y = y0; y < y1; y++) {
          const ro = y * iw * 3;
          for (let ox = 0; ox < outW; ox++) {
            const x0 = Math.min(xs[ox], iw - 1), x1 = Math.max(xs[ox + 1], x0 + 1);
            let r = 0, g = 0, b = 0;
            for (let i = ro + x0 * 3, e = ro + x1 * 3; i < e; i += 3) { r += rgb[i]; g += rgb[i + 1]; b += rgb[i + 2]; }
            const a = ox * 3;
            acc[a] += r; acc[a + 1] += g; acc[a + 2] += b;
          }
        }
        let o = oy * outW * 4;
        for (let ox = 0; ox < outW; ox++) {
          const x0 = Math.min(xs[ox], iw - 1), x1 = Math.max(xs[ox + 1], x0 + 1);
          const n = (x1 - x0) * (y1 - y0), a = ox * 3;
          out[o++] = acc[a] / n; out[o++] = acc[a + 1] / n; out[o++] = acc[a + 2] / n; out[o++] = 255;
        }
      }
      return;
    }
    const x0s = new Int32Array(outW), x1s = new Int32Array(outW), wxs = new Float32Array(outW);
    for (let ox = 0; ox < outW; ox++) {
      let fxp = (ox + 0.5) * sx - 0.5;
      if (fxp < 0) fxp = 0;
      let xi = Math.floor(fxp);
      if (xi > iw - 1) xi = iw - 1;
      x0s[ox] = xi * 3; x1s[ox] = Math.min(xi + 1, iw - 1) * 3; wxs[ox] = Math.min(1, fxp - xi);
    }
    for (let oy = 0; oy < outH; oy++) {
      let fyp = (oy + 0.5) * sy - 0.5;
      if (fyp < 0) fyp = 0;
      let yi = Math.floor(fyp);
      if (yi > ih - 1) yi = ih - 1;
      const wy = Math.min(1, fyp - yi);
      const r0 = yi * iw * 3, r1 = Math.min(yi + 1, ih - 1) * iw * 3;
      let o = oy * outW * 4;
      for (let ox = 0; ox < outW; ox++) {
        const a = x0s[ox], b = x1s[ox], wx = wxs[ox];
        for (let c = 0; c < 3; c++) {
          const top = rgb[r0 + a + c] + (rgb[r0 + b + c] - rgb[r0 + a + c]) * wx;
          const bot = rgb[r1 + a + c] + (rgb[r1 + b + c] - rgb[r1 + a + c]) * wx;
          out[o++] = top + (bot - top) * wy + 0.5;
        }
        out[o++] = 255;
      }
    }
  }

  /*
   * Draw the JB2 mask (list of blits) onto the RGBA output.
   * Coverage is accumulated straight from the blits into an output-sized buffer, so no
   * full-resolution mask is ever allocated: when shrinking, every page pixel belongs to
   * exactly one output pixel (integer spans) and the output pixel gets the fraction of
   * its page pixels that are black (area averaging → anti-aliased text); when enlarging,
   * each output pixel samples its nearest page pixel. Foreground colour: FGbz palette
   * entry of the blit, else the FG44 image at that spot, else black.
   */
  function drawMask(out, outW, outH, jb, pageW, pageH, fg) {
    const W = pageW, H = pageH, blits = jb.blits;
    const pal = fg && fg.palette, pidx = fg && fg.indices;
    const nColors = pal ? (pal.length / 3) | 0 : 0;
    const usePal = nColors > 0;
    const shrink = outW < W;
    const n = outW * outH;
    const cov = new Uint32Array(n);               // black page pixels per output pixel
    const col = usePal ? new Uint16Array(n) : null; // palette index of the last blit there
    const xs = spans(W, outW), ys = spans(H, outH);
    let xmap = null, ymap = null;
    if (shrink) {
      xmap = new Int32Array(W); ymap = new Int32Array(H);
      for (let ox = 0; ox < outW; ox++) for (let x = xs[ox]; x < xs[ox + 1]; x++) xmap[x] = ox;
      for (let oy = 0; oy < outH; oy++) for (let y = ys[oy]; y < ys[oy + 1]; y++) ymap[y] = oy;
    }
    const kx = outW / W, ky = outH / H;
    for (let bi = 0; bi < blits.length; bi++) {
      const bl = blits[bi], bm = bl.bm;
      if (!bm || !bm.w || !bm.h) continue;
      let ci = 0;
      if (usePal && pidx && bi < pidx.length) { ci = pidx[bi]; if (ci >= nColors) ci = 0; }
      const data = bm.data, bw = bm.w;
      if (shrink) {
        const c0 = Math.max(0, -bl.x), c1 = Math.min(bw, W - bl.x);
        const r0 = Math.max(0, -bl.y), r1 = Math.min(bm.h, H - bl.y);
        for (let r = r0; r < r1; r++) {
          const so = r * bw, base = ymap[bl.y + r] * outW;
          for (let c = c0; c < c1; c++) {
            if (data[so + c]) {
              const o = base + xmap[bl.x + c];
              cov[o]++;
              if (usePal) col[o] = ci;
            }
          }
        }
      } else {
        // output pixels whose sample point (page coords) falls inside the blit
        const ox0 = Math.max(0, Math.ceil((bl.x) * kx - 0.5)), ox1 = Math.min(outW, Math.ceil((bl.x + bw) * kx - 0.5));
        const oy0 = Math.max(0, Math.ceil((bl.y) * ky - 0.5)), oy1 = Math.min(outH, Math.ceil((bl.y + bm.h) * ky - 0.5));
        for (let oy = oy0; oy < oy1; oy++) {
          const r = Math.min(bm.h - 1, Math.floor((oy + 0.5) / ky) - bl.y);
          if (r < 0) continue;
          const so = r * bw;
          for (let ox = ox0; ox < ox1; ox++) {
            const c = Math.min(bw - 1, Math.floor((ox + 0.5) / kx) - bl.x);
            if (c >= 0 && data[so + c]) {
              const o = oy * outW + ox;
              cov[o] = 1;
              if (usePal) col[o] = ci;
            }
          }
        }
      }
    }
    const fgImg = fg && fg.image;
    const fgW = fgImg ? fgImg.w : 0, fgH = fgImg ? fgImg.h : 0, fgRgb = fgImg ? fgImg.rgb : null;
    const fgK = fgImg ? (fg.k || W / fgW) : 1; // page pixels per FG44 pixel
    const fgSx = fgImg ? W / (outW * fgK) : 0, fgSy = fgImg ? H / (outH * fgK) : 0;
    for (let oy = 0; oy < outH; oy++) {
      const hy = shrink ? ys[oy + 1] - ys[oy] : 1;
      const fy = fgImg ? Math.min(fgH - 1, Math.floor((oy + 0.5) * fgSy)) : 0;
      let i = oy * outW, o = i * 4;
      for (let ox = 0; ox < outW; ox++, i++, o += 4) {
        const c = cov[i];
        if (!c) continue;
        const area = shrink ? (xs[ox + 1] - xs[ox]) * hy : 1;
        const k = c >= area ? 1 : c / area;
        let r = 0, g = 0, b = 0;
        if (usePal) { const pi = col[i] * 3; r = pal[pi]; g = pal[pi + 1]; b = pal[pi + 2]; }
        else if (fgImg) {
          const fx = Math.min(fgW - 1, Math.floor((ox + 0.5) * fgSx));
          const fi = (fy * fgW + fx) * 3;
          r = fgRgb[fi]; g = fgRgb[fi + 1]; b = fgRgb[fi + 2];
        }
        if (k === 1) { out[o] = r; out[o + 1] = g; out[o + 2] = b; }
        else {
          out[o] = out[o] + (r - out[o]) * k + 0.5;
          out[o + 1] = out[o + 1] + (g - out[o + 1]) * k + 0.5;
          out[o + 2] = out[o + 2] + (b - out[o + 2]) * k + 0.5;
        }
      }
    }
  }

  function rotateRGBA(src, w, h, rot) {
    // rot = clockwise degrees (90, 180, 270); returns { width, height, data }
    const s32 = new Uint32Array(src.buffer, src.byteOffset, w * h);
    const nw = (rot === 180) ? w : h, nh = (rot === 180) ? h : w;
    const dst = new Uint8ClampedArray(w * h * 4);
    const d32 = new Uint32Array(dst.buffer);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let nx, ny;
        if (rot === 90) { nx = h - 1 - y; ny = x; }
        else if (rot === 180) { nx = w - 1 - x; ny = h - 1 - y; }
        else { nx = y; ny = w - 1 - x; }
        d32[ny * nw + nx] = s32[y * w + x];
      }
    }
    return { width: nw, height: nh, data: dst };
  }
  function rotateBox(bx, W, H, rot) {
    // bx in unrotated top-left coords; W, H unrotated page size
    if (rot === 90) return { x: H - bx.y - bx.h, y: bx.x, w: bx.h, h: bx.w, s: bx.s, e: bx.e };
    if (rot === 180) return { x: W - bx.x - bx.w, y: H - bx.y - bx.h, w: bx.w, h: bx.h, s: bx.s, e: bx.e };
    if (rot === 270) return { x: bx.y, y: W - bx.x - bx.w, w: bx.h, h: bx.w, s: bx.s, e: bx.e };
    return bx;
  }

  /* ------------------------------------------------------------------ *
   * Document
   * ------------------------------------------------------------------ */
  function Doc(bytes) {
    this.b = bytes;
    this.components = []; // { id, name, title, kind, start, end, type }
    this.pageList = [];   // indices into components
    this.navm = null;
    this.cache = [];      // decoded page layers (LRU)
    this.dicts = new Map();

    this._parse();
  }
  Doc.prototype._parse = function () {
    const b = this.b;
    if (b.length < 16 || str4(b, 0) !== 'AT&T' || str4(b, 4) !== 'FORM') throw fail('notdjvu', 'Not a DjVu file');
    const top = readChunks(b, 4, b.length)[0];
    if (!top || !top.type) throw fail('notdjvu', 'Not a DjVu file');
    const type = top.type;
    if (type === 'DJVU' || type === 'PM44' || type === 'BM44') {
      this.components.push({ id: '', name: '', title: '', kind: 1, start: top.start + 4, end: top.end, type: type });
      this.pageList.push(0);
    } else if (type === 'DJVM') {
      const chunks = readChunks(b, top.start + 4, top.end);
      const dirm = chunks.find(function (c) { return c.id === 'DIRM'; });
      if (!dirm) throw fail('broken', 'DIRM missing');
      this._parseDirm(dirm);
      const navm = chunks.find(function (c) { return c.id === 'NAVM'; });
      if (navm) this.navm = navm;
    } else if (type === 'DJVI') {
      throw fail('broken', 'Shared component, not a document');
    } else {
      throw fail('notdjvu', 'Unknown FORM type ' + type);
    }
    if (!this.pageList.length) throw fail('broken', 'No pages');
    // page info + text presence (cheap: walks chunk headers only)
    this.pageMeta = [];
    this.hasText = false;
    for (let i = 0; i < this.pageList.length; i++) {
      const c = this.components[this.pageList[i]];
      let meta = { w: 0, h: 0, dpi: 300, rotate: 0, hasText: false, ok: false };
      try {
        const ch = readChunks(b, c.start, c.end);
        c.chunks = ch;
        if (c.type === 'PM44' || c.type === 'BM44') {
          const first = ch.find(function (x) { return x.id === 'PM44' || x.id === 'BM44'; });
          if (first && first.end - first.start >= 9 && b[first.start] === 0) {
            meta.w = be16(b, first.start + 4); meta.h = be16(b, first.start + 6); meta.ok = true; meta.dpi = 100;
          }
        } else {
          const info = ch.find(function (x) { return x.id === 'INFO'; });
          if (info && info.end - info.start >= 4) {
            const p = info.start, n = info.end - info.start;
            meta.w = be16(b, p); meta.h = be16(b, p + 2);
            if (n >= 8) { const dpi = b[p + 6] | (b[p + 7] << 8); if (dpi >= 25 && dpi <= 6000) meta.dpi = dpi; }
            if (n >= 10) {
              const f = b[p + 9] & 7;
              meta.rotate = f === 6 ? 270 : f === 2 ? 180 : f === 5 ? 90 : 0;
            }
            meta.ok = meta.w > 0 && meta.h > 0;
          }
          meta.hasText = ch.some(function (x) { return x.id === 'TXTz' || x.id === 'TXTa'; });
        }
      } catch (e) { meta.ok = false; }
      if (meta.hasText) this.hasText = true;
      this.pageMeta.push(meta);
    }
  };
  Doc.prototype._parseDirm = function (dirm) {
    const b = this.b;
    const p = dirm.start;
    if (dirm.end - p < 3) throw fail('broken', 'DIRM');
    const flags = b[p];
    if (!(flags & 0x80)) throw fail('indirect', 'Indirect (multi-file) DjVu documents are not supported');
    const n = be16(b, p + 1);
    if (dirm.end - p < 3 + 4 * n) throw fail('broken', 'DIRM');
    const offsets = [];
    for (let i = 0; i < n; i++) offsets.push(be32(b, p + 3 + 4 * i));
    const z = bzzDecode(b, p + 3 + 4 * n, dirm.end);
    let q = 0;
    const sizes = [], fl = [];
    for (let i = 0; i < n; i++) { sizes.push(be24(z, q)); q += 3; }
    for (let i = 0; i < n; i++) fl.push(z[q++]);
    const readStr = function () {
      const s = q;
      while (q < z.length && z[q] !== 0) q++;
      const str = utf8Decode(z, s, q, false).str;
      q++;
      return str;
    };
    for (let i = 0; i < n; i++) {
      const id = readStr();
      const name = (fl[i] & 0x80) ? readStr() : id;
      const title = (fl[i] & 0x40) ? readStr() : id;
      const off = offsets[i];
      let comp = { id: id, name: name, title: title, kind: fl[i] & 0x3f, start: 0, end: 0, type: '' };
      if (off + 12 <= b.length && str4(b, off) === 'FORM') {
        const len = be32(b, off + 4);
        comp.type = str4(b, off + 8);
        comp.start = off + 12;
        comp.end = Math.min(b.length, off + 8 + len);
      }
      this.components.push(comp);
      if (comp.kind === 1) this.pageList.push(i);
    }
  };
  Doc.prototype._compById = function (id) {
    for (const c of this.components) if (c.id === id) return c;
    for (const c of this.components) if (c.name === id || c.title === id) return c;
    return null;
  };
  Doc.prototype._chunksOf = function (c) {
    if (!c.chunks) c.chunks = c.start ? readChunks(this.b, c.start, c.end) : [];
    return c.chunks;
  };
  /* all chunks of a page plus those of INCL'ed shared components (recursively) */
  Doc.prototype._gather = function (c, seen, out) {
    if (seen.has(c)) return out;
    seen.add(c);
    for (const ch of this._chunksOf(c)) {
      if (ch.id === 'INCL') {
        const id = utf8Decode(this.b, ch.start, ch.end, false).str.replace(/[\s\x00]+$/, '');
        const inc = this._compById(id);
        if (inc) this._gather(inc, seen, out);
      } else {
        out.push({ ch: ch, owner: c });
      }
    }
    return out;
  };
  /* decode (and remember) the shape library of a Djbz chunk */
  Doc.prototype._dict = function (owner, ch, depth) {
    const key = ch.start;
    if (this.dicts.has(key)) {
      const v = this.dicts.get(key);
      this.dicts.delete(key); this.dicts.set(key, v);
      return v;
    }
    if (depth > 8) throw fail('broken', 'dictionary nesting');
    const self = this;
    const res = decodeJB2(this.b, ch.start, ch.end, function (n) {
      const list = self._gather(owner, new Set(), []);
      const inner = list.find(function (x) { return x.ch.id === 'Djbz' && x.ch !== ch; });
      if (!inner) return null;
      return self._dict(inner.owner, inner.ch, depth + 1);
    }, false);
    this.dicts.set(key, res.library);
    while (this.dicts.size > 4) this.dicts.delete(this.dicts.keys().next().value);
    return res.library;
  };
  Doc.prototype._check = function (i) {
    if (!(i >= 0 && i < this.pageList.length) || (i | 0) !== i) throw fail('range', 'No such page: ' + i);
  };
  /*
   * Decoded layers of a page, cached for the last 3 pages (fewer when they are large:
   * the cache is also bounded to ~120 MB so phones survive 600 dpi colour scans).
   */
  const CACHE_PAGES = 3, CACHE_BYTES = 120e6;
  function layersBytes(v) {
    let n = 0;
    const iwBytes = function (iw) {
      if (!iw || !iw.y) return 0;
      return iw.y.coef.byteLength * (iw.cb ? 3 : 1);
    };
    n += iwBytes(v.bg);
    if (v.bgImg) n += v.bgImg.rgb.byteLength;
    if (v.fg && v.fg.image) n += v.fg.image.rgb.byteLength;
    if (v.jb) {
      const seen = new Set();
      for (const bl of v.jb.blits) {
        n += 32;
        if (bl.bm && !seen.has(bl.bm)) { seen.add(bl.bm); n += bl.bm.data.byteLength + 64; }
      }
    }
    return n;
  }
  Doc.prototype._layers = function (i) {
    for (let k = 0; k < this.cache.length; k++) {
      if (this.cache[k].i === i) {
        const hit = this.cache.splice(k, 1)[0];
        this.cache.push(hit);
        return hit.v;
      }
    }
    // drop old pages before decoding a new one, so peak memory stays bounded
    while (this.cache.length >= CACHE_PAGES) this.cache.shift();
    const v = this._decodeLayers(i);
    this.cache.push({ i: i, v: v });
    return v;
  };
  /* after rendering: evict older pages while the cache is over its memory budget */
  Doc.prototype._trimCache = function () {
    let total = 0;
    for (const c of this.cache) total += (c.bytes = layersBytes(c.v));
    while (this.cache.length > 1 && total > CACHE_BYTES) total -= this.cache.shift().bytes;
  };
  Doc.prototype._decodeLayers = function (i) {
    const meta = this.pageMeta[i];
    const comp = this.components[this.pageList[i]];
    const b = this.b;
    if (!meta.ok) throw fail('broken', 'Page ' + (i + 1) + ' has no valid INFO');
    const W = meta.w, H = meta.h;
    const list = this._gather(comp, new Set(), []);
    const layers = { W: W, H: H, bg: null, jb: null, fg: null };
    try {
      if (comp.type === 'PM44' || comp.type === 'BM44') {
        const iw = new IW44();
        for (const it of list) if (it.ch.id === 'PM44' || it.ch.id === 'BM44') iw.addChunk(b, it.ch.start, it.ch.end);
        layers.bg = iw;
        return layers;
      }
      let sjbz = null, fgbz = null, fg44 = null;
      const bg = [];
      for (const it of list) {
        const id = it.ch.id;
        if (id === 'Sjbz' && !sjbz) sjbz = it;
        else if (id === 'BG44') bg.push(it);
        else if (id === 'FG44' && !fg44) fg44 = it;
        else if (id === 'FGbz' && !fgbz) fgbz = it;
      }
      const self = this;
      if (sjbz) {
        layers.jb = decodeJB2(b, sjbz.ch.start, sjbz.ch.end, function (n) {
          const d = list.find(function (x) { return x.ch.id === 'Djbz'; });
          return d ? self._dict(d.owner, d.ch, 0) : null;
        }, true);
        layers.jb.library = null; // only blits are needed from here on
      }
      if (bg.length) {
        const iw = new IW44();
        for (const it of bg) {
          try { iw.addChunk(b, it.ch.start, it.ch.end); } catch (e) { if (!iw.y) throw e; break; }
        }
        if (iw.y) layers.bg = iw;
      }
      if (fgbz) {
        try { layers.fg = parseFGbz(b, fgbz.ch.start, fgbz.ch.end); } catch (e) { layers.fg = null; }
      }
      if (layers.fg && !layers.fg.palette.length) layers.fg = null; // empty palette: ignore FGbz
      if (fg44 && !layers.fg) {
        try {
          const iw = new IW44();
          iw.addChunk(b, fg44.ch.start, fg44.ch.end);
          const img = iw.toRGB(1);
          layers.fg = { image: img, k: subsample(W, H, img.w, img.h) };
        } catch (e) { /* ignore broken foreground */ }
      }
    } catch (e) {
      throw fail('broken', 'Page ' + (i + 1) + ' cannot be decoded: ' + (e && e.message));
    }
    return layers;
  };
  function parseFGbz(b, start, end) {
    const ver = b[start];
    const n = be16(b, start + 1);
    if (start + 3 + n * 3 > end) throw fail('broken', 'FGbz');
    const pal = new Uint8Array(n * 3);
    for (let k = 0; k < n; k++) {
      const p = start + 3 + k * 3;
      pal[k * 3] = b[p + 2]; pal[k * 3 + 1] = b[p + 1]; pal[k * 3 + 2] = b[p]; // stored BGR
    }
    let indices = null;
    let p = start + 3 + n * 3;
    if ((ver & 0x80) && p + 3 <= end) {
      const cnt = be24(b, p);
      p += 3;
      const z = bzzDecode(b, p, end);
      const m = Math.min(cnt, z.length >> 1);
      indices = new Uint16Array(m);
      for (let k = 0; k < m; k++) indices[k] = (z[2 * k] << 8) | z[2 * k + 1];
    }
    return { palette: pal, indices: indices };
  }

  /* public API */
  Doc.prototype.info = function (i) {
    this._check(i);
    const m = this.pageMeta[i];
    const swap = m.rotate === 90 || m.rotate === 270;
    return { width: swap ? m.h : m.w, height: swap ? m.w : m.h, dpi: m.dpi, rotate: m.rotate };
  };
  Doc.prototype.renderRGBA = function (i, width) {
    this._check(i);
    const meta = this.pageMeta[i];
    const L = this._layers(i);
    const W = L.W, H = L.H, rot = meta.rotate;
    const dispW = (rot === 90 || rot === 270) ? H : W;
    let scale = width > 0 ? width / dispW : 1;
    if (!(scale > 0)) scale = 1;
    const outW = Math.max(1, Math.round(W * scale)), outH = Math.max(1, Math.round(H * scale));
    if (outW * outH > 64e6) throw fail('range', 'Requested size too large');
    const out = new Uint8ClampedArray(outW * outH * 4);
    try {
      if (L.bg) {
        // decode the background at a coarser wavelet scale when the output is much smaller
        let red = 1;
        const bgScaleNeeded = outW / L.bg.w;
        while (red < 8 && bgScaleNeeded * red * 2 <= 1.0001) red <<= 1;
        if (!L.bgImg || L.bgRed !== red) { L.bgImg = L.bg.toRGB(red); L.bgRed = red; }
        const k = subsample(W, H, L.bg.w, L.bg.h) * red; // page pixels per layer pixel
        drawBackground(out, outW, outH, L.bgImg, W / (outW * k), H / (outH * k));
      } else {
        out.fill(255);
      }
      if (L.jb && L.jb.blits.length) drawMask(out, outW, outH, L.jb, W, H, L.fg);
    } catch (e) {
      throw fail('broken', 'Page ' + (i + 1) + ' cannot be rendered: ' + (e && e.message));
    }
    this._trimCache();
    if (rot) return rotateRGBA(out, outW, outH, rot);
    return { width: outW, height: outH, data: out };
  };
  Doc.prototype.text = function (i) {
    this._check(i);
    const comp = this.components[this.pageList[i]];
    const meta = this.pageMeta[i];
    const list = this._gather(comp, new Set(), []);
    let t = null;
    for (const it of list) {
      if (it.ch.id === 'TXTz') { try { t = bzzDecode(this.b, it.ch.start, it.ch.end); } catch (e) { t = null; } break; }
      if (it.ch.id === 'TXTa') { t = this.b.subarray(it.ch.start, it.ch.end); break; }
    }
    if (!t) return null;
    let res;
    try { res = parseText(t, meta.h); } catch (e) { return null; }
    if (!res) return null;
    if (meta.rotate) {
      const f = function (bx) { return rotateBox(bx, meta.w, meta.h, meta.rotate); };
      res.words = res.words.map(f); res.lines = res.lines.map(f);
    }
    return res;
  };
  Doc.prototype.outline = function () {
    if (!this.navm) return [];
    let z;
    try { z = bzzDecode(this.b, this.navm.start, this.navm.end); } catch (e) { return []; }
    const self = this;
    return parseNavm(z, function (url) {
      // "#12" = page 12 (1-based); "#<component id>" or a bare component id = that page
      const hash = url.charAt(0) === '#';
      const ref = hash ? url.slice(1) : url;
      if (hash && /^\d+$/.test(ref)) {
        const pg = parseInt(ref, 10) - 1;
        return pg >= 0 && pg < self.pageList.length ? pg : -1;
      }
      const c = ref ? self._compById(ref) : null;
      return c ? self.pageList.indexOf(self.components.indexOf(c)) : -1;
    });
  };
  Object.defineProperty(Doc.prototype, 'pages', { get: function () { return this.pageList.length; } });

  const DjVuCore = {
    open: function (data) {
      let bytes;
      if (data instanceof Uint8Array) bytes = data;
      else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
      else if (data && data.buffer instanceof ArrayBuffer) bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      else throw fail('notdjvu', 'Expected bytes');
      try {
        return new Doc(bytes);
      } catch (e) {
        if (e && e.code) throw e;
        throw fail('broken', 'Cannot read DjVu: ' + (e && e.message));
      }
    },
    // exposed for tests
    _internal: { ZP: ZP, bzzDecode: bzzDecode, decodeJB2: decodeJB2, IW44: IW44, readChunks: readChunks, parseText: parseText, parseNavm: parseNavm, parseFGbz: parseFGbz, drawMask: drawMask, rotateRGBA: rotateRGBA, rotateBox: rotateBox }
  };

  if (typeof module === 'object' && module.exports) module.exports = DjVuCore;
  else root.DjVuCore = DjVuCore;
})(typeof self !== 'undefined' ? self : globalThis);
