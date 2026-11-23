/*
 * djvu.js — main-thread API for reading DjVu books (window.DjVuDoc).
 *
 * All decoding happens in a Web Worker (js/djvu-worker.js → js/djvu-core.js), so the
 * page stays responsive. One worker is shared by all open documents and is terminated
 * when the last document is closed.
 *
 *   const doc = await DjVuDoc.open(arrayBufferOrBlobOrUint8Array);
 *       // An ArrayBuffer is transferred to the worker (it becomes detached for the caller).
 *       // Rejects with an Error whose .code is 'notdjvu' | 'indirect' | 'broken'.
 *   doc.pages                       // number of pages
 *   doc.info(i)                     // { width, height, dpi, rotate } (0-based page, sync)
 *   doc.hasText                     // true if at least one page has a text layer
 *   await doc.render(i, { width })  // → { width, height, bitmap } (ImageBitmap, or ImageData
 *                                   //   when the worker cannot create bitmaps); default width:
 *                                   //   the page's own width, capped at 2000 px
 *   await doc.text(i)               // → { text, words:[{x,y,w,h,s,e}], lines:[...] } | null
 *                                   //   boxes in page pixels (top-left origin) of info(i) size;
 *                                   //   s/e = offsets into text
 *   await doc.outline()             // → [{ title, page, children }] (page -1 = external link, + url)
 *   doc.close()
 *   DjVuDoc.sniff(bytes)            // true if the bytes start like a DjVu file ("AT&TFORM")
 *
 * Errors are always Error objects with a string .code ('notdjvu', 'indirect', 'broken',
 * 'range' for a bad page index/size, 'closed' after close(), 'noworker').
 */
(function () {
  'use strict';

  const script = document.currentScript;
  const WORKER_URL = (function () {
    try { if (script && script.src) return new URL('djvu-worker.js', script.src).href; } catch (e) { /* fall back */ }
    return 'js/djvu-worker.js';
  })();

  let worker = null;
  let generation = 0; // bumped whenever the worker goes away; older documents become invalid
  let seq = 0;
  let liveDocs = 0;
  const pending = new Map();

  function makeError(code, message) {
    const e = new Error(message || code);
    e.code = code;
    return e;
  }

  function failAll(code, message) {
    for (const p of pending.values()) p.reject(makeError(code, message));
    pending.clear();
  }

  function getWorker() {
    if (worker) return worker;
    if (typeof Worker !== 'function') throw makeError('noworker', 'Web Workers are not available');
    worker = new Worker(WORKER_URL);
    worker.onmessage = function (ev) {
      const m = ev.data || {};
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      if (m.ok) p.resolve(m.result);
      else p.reject(makeError((m.error && m.error.code) || 'broken', (m.error && m.error.message) || 'DjVu error'));
    };
    worker.onerror = function (ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      // the worker died (e.g. out of memory): every open document is gone with it
      failAll('broken', 'DjVu worker failed' + (ev && ev.message ? ': ' + ev.message : ''));
      try { worker.terminate(); } catch (e) { /* ignore */ }
      worker = null;
      liveDocs = 0;
      generation++;
    };
    return worker;
  }

  function call(cmd, doc, args, transfer) {
    return new Promise(function (resolve, reject) {
      let w;
      try { w = getWorker(); } catch (e) { reject(e); return; }
      const id = ++seq;
      pending.set(id, { resolve: resolve, reject: reject });
      try {
        w.postMessage({ id: id, cmd: cmd, doc: doc, args: args }, transfer || []);
      } catch (e) {
        pending.delete(id);
        reject(makeError('broken', e && e.message));
      }
    });
  }

  function DjVuDocument(meta) {
    this._id = meta.doc;
    this._gen = generation;
    this._infos = meta.infos;
    this._closed = false;
    this.pages = meta.pages;
    this.hasText = !!meta.hasText;
  }
  DjVuDocument.prototype._check = function (i) {
    if (this._closed || this._gen !== generation) return makeError('closed', 'Document is closed');
    if (typeof i !== 'undefined' && !(Number.isInteger(i) && i >= 0 && i < this.pages)) return makeError('range', 'No such page: ' + i);
    return null;
  };
  DjVuDocument.prototype.info = function (i) {
    if (!(Number.isInteger(i) && i >= 0 && i < this.pages)) throw makeError('range', 'No such page: ' + i);
    const m = this._infos[i];
    return { width: m.width, height: m.height, dpi: m.dpi, rotate: m.rotate };
  };
  DjVuDocument.prototype.render = function (i, opts) {
    const err = this._check(i);
    if (err) return Promise.reject(err);
    let width = opts && opts.width;
    if (!(width > 0)) width = Math.min(this._infos[i].width || 1000, 2000);
    width = Math.max(1, Math.round(width));
    return call('render', this._id, { page: i, width: width });
  };
  DjVuDocument.prototype.text = function (i) {
    const err = this._check(i);
    if (err) return Promise.reject(err);
    return call('text', this._id, { page: i });
  };
  DjVuDocument.prototype.outline = function () {
    const err = this._check();
    if (err) return Promise.reject(err);
    return call('outline', this._id, {});
  };
  DjVuDocument.prototype.close = function () {
    if (this._closed) return;
    this._closed = true;
    if (this._gen !== generation || !worker) return;
    liveDocs--;
    const w = worker;
    call('close', this._id, {}).then(function (r) {
      // terminate the worker once nothing is open and nothing is in flight
      if (r && r.remaining === 0 && liveDocs <= 0 && pending.size === 0 && worker === w) {
        try { w.terminate(); } catch (e) { /* ignore */ }
        worker = null;
        generation++;
      }
    }, function () { /* ignore */ });
  };

  function toBuffer(src) {
    if (src instanceof ArrayBuffer) return Promise.resolve(src);
    if (ArrayBuffer.isView(src)) {
      // copy the viewed bytes so the caller's (possibly larger) buffer is not detached
      return Promise.resolve(src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength));
    }
    if (typeof Blob !== 'undefined' && src instanceof Blob) {
      if (src.arrayBuffer) return src.arrayBuffer();
      return new Promise(function (resolve, reject) {
        const fr = new FileReader();
        fr.onload = function () { resolve(fr.result); };
        fr.onerror = function () { reject(makeError('broken', 'Cannot read file')); };
        fr.readAsArrayBuffer(src);
      });
    }
    return Promise.reject(makeError('notdjvu', 'Expected an ArrayBuffer, typed array or Blob'));
  }

  function sniff(src) {
    let b;
    if (src instanceof ArrayBuffer) b = new Uint8Array(src, 0, Math.min(8, src.byteLength));
    else if (ArrayBuffer.isView(src)) b = new Uint8Array(src.buffer, src.byteOffset, Math.min(8, src.byteLength));
    else return false;
    return b.length >= 8 && b[0] === 0x41 && b[1] === 0x54 && b[2] === 0x26 && b[3] === 0x54 &&
      b[4] === 0x46 && b[5] === 0x4f && b[6] === 0x52 && b[7] === 0x4d;
  }

  window.DjVuDoc = {
    open: function (src) {
      return toBuffer(src).then(function (buf) {
        if (!sniff(buf)) throw makeError('notdjvu', 'Not a DjVu file');
        return call('open', 0, { buffer: buf }, [buf]);
      }).then(function (meta) {
        liveDocs++;
        return new DjVuDocument(meta);
      });
    },
    sniff: sniff
  };
})();
