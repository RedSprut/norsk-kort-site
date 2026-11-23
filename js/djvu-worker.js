/*
 * djvu-worker.js — Web Worker hosting the DjVu decoder (djvu-core.js).
 *
 * Keeps open documents by numeric id and answers request messages:
 *   { id, cmd: 'open',    args: { buffer } }            → { doc, pages, hasText, infos }
 *   { id, cmd: 'render',  doc, args: { page, width } }   → { width, height, bitmap }
 *   { id, cmd: 'text',    doc, args: { page } }          → { text, words, lines } | null
 *   { id, cmd: 'outline', doc }                          → [{ title, page, children }]
 *   { id, cmd: 'close',   doc }                          → { remaining }
 * Replies: { id, ok: true, result } or { id, ok: false, error: { code, message } }.
 * `bitmap` is an ImageBitmap when createImageBitmap exists here, else an ImageData
 * (or a plain { data, width, height } object if ImageData is missing too).
 */
/* global importScripts, DjVuCore */
importScripts('djvu-core.js');

(function () {
  'use strict';
  const docs = new Map();
  let nextDoc = 1;

  function getDoc(id) {
    const d = docs.get(id);
    if (!d) { const e = new Error('Document is closed'); e.code = 'closed'; throw e; }
    return d;
  }

  async function handle(msg) {
    const args = msg.args || {};
    switch (msg.cmd) {
      case 'open': {
        const d = DjVuCore.open(new Uint8Array(args.buffer));
        const id = nextDoc++;
        docs.set(id, d);
        const infos = [];
        for (let i = 0; i < d.pages; i++) infos.push(d.info(i));
        return { result: { doc: id, pages: d.pages, hasText: d.hasText, infos: infos } };
      }
      case 'render': {
        const d = getDoc(msg.doc);
        const r = d.renderRGBA(args.page, args.width);
        let bitmap, transfer;
        if (typeof ImageData === 'function') {
          const img = new ImageData(r.data, r.width, r.height);
          if (typeof createImageBitmap === 'function') {
            try {
              bitmap = await createImageBitmap(img);
              transfer = [bitmap];
            } catch (e) { bitmap = img; transfer = [r.data.buffer]; }
          } else { bitmap = img; transfer = [r.data.buffer]; }
        } else {
          bitmap = { data: r.data, width: r.width, height: r.height };
          transfer = [r.data.buffer];
        }
        return { result: { width: r.width, height: r.height, bitmap: bitmap }, transfer: transfer };
      }
      case 'text':
        return { result: getDoc(msg.doc).text(args.page) };
      case 'outline':
        return { result: getDoc(msg.doc).outline() };
      case 'close':
        docs.delete(msg.doc);
        return { result: { remaining: docs.size } };
      default: {
        const e = new Error('Unknown command ' + msg.cmd);
        e.code = 'badcmd';
        throw e;
      }
    }
  }

  self.onmessage = function (ev) {
    const msg = ev.data || {};
    handle(msg).then(function (out) {
      self.postMessage({ id: msg.id, ok: true, result: out.result }, out.transfer || []);
    }, function (e) {
      const code = (e && typeof e.code === 'string') ? e.code : 'broken';
      const message = (e && e.message) ? String(e.message) : String(e);
      self.postMessage({ id: msg.id, ok: false, error: { code: code, message: message } });
    });
  };
})();
